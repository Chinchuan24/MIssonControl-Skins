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
let $$: Engine
const stored = async (): Promise<number> => Number(/≈\$([0-9.]+)/.exec(todayLine(await text($$)))?.[1] ?? NaN)

// Realistic: the engine fires session.start once, before the first prompt, with the
// session's /cost at $0. Only main-loop requests (no sub-agents), as a quick question.
test('fresh session, one $0.50 request: Today should say $0.50', async ($, on) => {
  $$ = $
  base(on)
  await start($)
  await ask($, 'quick question')
  await turnStart($)
  await step($, 0.5)
  await complete($)
  expect(await stored()).toBe(0.5)
})

test('fresh session, three prompts of one request each ($0.50, $0.30, $0.20): Today should say $1.00', async ($, on) => {
  $$ = $
  base(on)
  await start($)
  let total = 0
  for (const [q, c] of [['one', 0.5], ['two', 0.3], ['three', 0.2]] as const) {
    total += c
    await ask($, q)
    await turnStart($)
    await step($, total)
    await complete($)
  }
  expect(await stored()).toBe(1)
})

// Realistic /clear: the engine does NOT fire session.start on /clear (types: "never /clear").
// If /cost starts over at /clear, the drop is lost and the next request is lost with it.
test('/clear without session.start (cost resets to 0): Today should keep counting', async ($, on) => {
  $$ = $
  base(on)
  await start($)
  await ask($, 'first job')
  await turnStart($)
  await step($, 0.2)
  await step($, 1.0)
  await complete($)
  const before = await stored()
  live.cost = 0 // /clear, if the ledger starts over
  await ask($, 'second job')
  await turnStart($)
  await step($, 0.75)
  await complete($)
  expect(await stored()).toBe(1.75)
})

// Control: a resumed session whose ledger already holds $2 must not add the $2 again.
test('CONTROL resume with $2 already spent adds only new spend', async ($, on) => {
  $$ = $
  base(on)
  live.cost = 2
  await start($, 'resume')
  await ask($, 'continue')
  await turnStart($)
  await step($, 2.4)
  await complete($)
  expect(await stored()).toBe(0.4)
})
