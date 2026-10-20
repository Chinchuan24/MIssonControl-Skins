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


test('pane Today line rolls over after midnight with no new activity', async ($, on) => {
  const clock = base(on, new Date(2026, 9, 19, 23, 58, 0).getTime())
  await start($)
  await ask($, 'late job')
  await turnStart($)
  await step($, 0.2)
  await step($, 0.9)
  await complete($)
  const before = todayLine(await text($))
  expect(before).toContain('Today 1 tasks')
  await clock.advance(5 * 60_000)
  await clock.settle()
  const after = todayLine(await text($))
  expect(after).toContain('Today 0 tasks')
})

test('band today rolls over after midnight with no new activity', async ($, on) => {
  const clock = base(on, new Date(2026, 9, 19, 23, 50, 0).getTime())
  await start($)
  await ask($, 'late job')
  await turnStart($)
  await step($, 0.9)
  await complete($)
  const b1 = await bandSvg($)
  await clock.advance(30 * 60_000)
  await clock.settle()
  const b2 = await bandSvg($)
  expect(b2).not.toMatch(/today 1 task/)
})

test('control: a new prompt after midnight does roll Today over', async ($, on) => {
  const clock = base(on, new Date(2026, 9, 19, 23, 50, 0).getTime())
  await start($)
  await ask($, 'late job')
  await turnStart($)
  await step($, 0.9)
  await complete($)
  await clock.advance(30 * 60_000)
  await clock.settle()
  await ask($, 'morning job')
  const after = todayLine(await text($))
  expect(after).toContain('Today 1 tasks')
})
