import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth bugs in costs, tokens and limits: what Mission Control says vs what was spent.
// The engine's session usage is modelled the way /cost totals it: every priced API
// response of the session, the main loop's and every sub-agent's.

type Limit = { kind: string; percentUsed: number; resetsAt?: string }
const live = { cost: 0, ctx: 100_000, limits: [] as Limit[] }
const toasts: string[] = []
const saved: Record<string, unknown> = {}
let stepUsage = { model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

const pane = { title: '', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200 } as never } as const

const base = (on: On, now = Date.parse('2026-10-19T10:00:00Z'), ownStore = false) => {
  live.cost = 0
  live.ctx = 100_000
  live.limits = []
  toasts.length = 0
  const clock = mock.clock(on, { now })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  for (const k of Object.keys(saved)) delete saved[k]
  if (!ownStore) mock.store(on, saved)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: live.ctx }, rateLimits: live.limits, cost: { usd: live.cost } } }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.start', async () => ({ turnId: 'turn' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: stepUsage } as never
  })
  return clock
}

const start = ($: Engine, source = 'startup') => $.session.start({ source, cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0 } as never)
const turnStart = ($: Engine, agentId?: string) => ($.turn.start as (e: unknown) => Promise<unknown>)({ text: '', turnId: 'turn', agentId })
// One model request; `cost` is the session's /cost total once it is answered.
const step = async ($: Engine, cost: number, agentId?: string) => {
  live.cost = cost
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of stream) void _
}
const complete = ($: Engine, agentId?: string) => ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId, reason: 'answer', answer: 'ok' })
const spawn = ($: Engine, description: string, background = false) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background, fork: false } as never)
const tokens = async ($: Engine): Promise<string> => String(((await $.command.run({ command: 'tokens', args: '' } as never)) as { text?: string }).text)

const text = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const bandSvg = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const svg = (await ui.findAll({ type: 'Svg' })) as { props?: { source?: string } }[]
  await ui.unmount()
  return svg.map(s => String(s.props?.source ?? '')).join('\n')
}
const todayLine = (t: string): string => t.split('\n').find(l => l.startsWith('Today ')) ?? ''


// ---------------------------------------------------------------------------
// Independent, engine-realistic reproductions (verify-env-frozen-while-subagents-run).
const askAs = ($: Engine, text: string, kind: string) => $.prompt.submit({ text, cursor: 0, origin: { kind }, wait: false } as never)
const tick = async (clock: ReturnType<typeof base>, ms: number) => { await clock.advance(ms); await clock.settle() }
const managerLine = (t: string) => t.split('\n').find(l => l.includes('Token Manager')) ?? ''

test('R-a: foreground Agent spends $2 over 3 minutes while main waits; budget $1', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.command.run({ command: 'tokens', args: 'budget 1' } as never)
  await askAs($, 'build the feature', 'composer')
  await turnStart($)
  await step($, 0.1)
  await $.tool.call({ tool: 'Agent', input: { description: 'Engineer: build it', prompt: 'p' }, toolUseId: 't-eng' } as never).catch(() => undefined)
  await spawn($, 'Engineer: build it')
  await turnStart($, 'a1')
  for (let i = 1; i <= 6; i++) { await tick(clock, 30_000); await step($, 0.1 + i * (2 / 6), 'a1') }
  const report = await tokens($)
  const pane = await text($)
  expect(report).toContain('(≈$2.10)')
  expect(report).toContain('Over budget')
})

test('R-b: rate-limit window climbs to 97% from workers; engine pushes session.measure', async ($, on) => {
  const clock = base(on)
  live.limits = [{ kind: 'five_hour', percentUsed: 60, resetsAt: '2026-10-19T13:00:00Z' }]
  await start($)
  await askAs($, 'big refactor', 'composer')
  await turnStart($)
  await step($, 0.2)
  await spawn($, 'Engineer: part one')
  await spawn($, 'Engineer: part two')
  live.limits = [{ kind: 'five_hour', percentUsed: 97, resetsAt: '2026-10-19T13:00:00Z' }]
  await turnStart($, 'a1')
  await step($, 1.5, 'a1')
  await turnStart($, 'a2')
  await step($, 2.8, 'a2')
  // The engine pushes the move (a window moved a whole point).
  await ($.session as unknown as { measure?: (e: unknown) => Promise<unknown> }).measure?.({ context: { window: 1_000_000, tokens: live.ctx }, rateLimits: live.limits, cost: { usd: 2.8 }, changed: ['rateLimits', 'cost'] })?.catch?.((x: unknown) => console.log('measure err', String(x)))
  await tick(clock, 5_000)
  const pane = await text($)
  expect(pane).toMatch(/Session limit.*97%/)
})

test('R-c: background agent finishes, engine delivers its task-notification turn; legend price', async ($, on) => {
  const clock = base(on, Date.parse('2026-10-19T10:00:00Z'), true)
  const db = new Map<string, unknown>()
  on('store.get', async (_$, e) => ({ value: db.get(String((e as { key: string }).key)) }) as never)
  on('store.set', async (_$, e) => { db.set(String((e as { key: string }).key), (e as { value: unknown }).value); return { value: undefined } as never })
  const legends = () => db.get('legends') as { costUsd: number }[] | undefined
  await start($)
  await askAs($, 'research and report', 'composer')
  await turnStart($)
  await step($, 1.0)
  await spawn($, 'Researcher: dig deep', true)
  await complete($)
  await turnStart($, 'a1')
  for (let i = 1; i <= 4; i++) { await tick(clock, 60_000); await step($, 1 + i * 0.75, 'a1') }
  await complete($, 'a1')
  await tick(clock, 1000)
  const doneToasts = toasts.filter(t => t.startsWith('🎉 Done'))
  const legendAtDone = JSON.stringify(legends())
  const reportAtDone = await tokens($)
  // The engine dequeues the agent's notification: a main turn of its own.
  await askAs($, '<task-notification><task-id>a1</task-id><status>completed</status></task-notification>', 'task-notification')
  await turnStart($)
  await step($, 4.05)
  await complete($)
  await tick(clock, 1000)
  expect(legends()?.[0]?.costUsd ?? 0).toBeGreaterThan(3.9)
})

test('R-d: job 2 typed while job 1 background agent is still running (owner scenario)', async ($, on) => {
  const clock = base(on)
  await start($)
  await askAs($, 'first job', 'composer')
  await turnStart($)
  await step($, 0.5)
  await step($, 1.0)
  await spawn($, 'Researcher: background dig', true)
  await complete($)
  await turnStart($, 'a1')
  for (let i = 1; i <= 4; i++) { await tick(clock, 60_000); await step($, 1 + i * 0.5, 'a1') }
  // $3.00 session total now; agent still running. The person types job 2.
  await askAs($, 'second job', 'composer')
  await turnStart($)
  await step($, 3.2)
  const report = await tokens($)
  expect(report).toContain('(≈$0.20)')
})
