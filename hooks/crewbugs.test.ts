import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const writes: Record<string, number> = {}
const last: Record<string, unknown> = {}
const toasts: string[] = []
const reset = () => {
  for (const k of Object.keys(writes)) delete writes[k]
  toasts.length = 0
}
let failCommand = ''
const registered: string[] = []
const total = () => Object.values(writes).reduce((a, b) => a + b, 0)

const base = (on: On, store: Record<string, unknown> = {}) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async (_$, e) => {
    const name = String((e as { name?: string }).name)
    if (name === failCommand) throw new Error('refused')
    registered.push(name)
    return { value: undefined } as never
  })
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  on('state.set', async (_$, e, next) => {
    const key = String((e as { key?: string }).key)
    writes[key] = (writes[key] ?? 0) + 1
    last[key] = (e as { value?: unknown }).value
    return next(e)
  })
  return clock
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const spawn = ($: Engine, i: number) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
const step = async ($: Engine, agentId?: string) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of stream) void _
}
const agentsOf = async (_$: Engine) => (last.agents ?? []) as { agentId?: string; status: string }[]

test('PROBE writes: one subagent model request, one subagent tool call', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
  await spawn($, 1)
  reset()
  await step($, 'a1')
  reset()
  await $.tool.call({ tool: 'Read', file_path: '/r/a.ts', agentId: 'a1' } as never)
  reset()
  await step($)
  reset()
  await $.tool.call({ tool: 'Read', file_path: '/r/a.ts' } as never)
  reset()
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
})

test('PROBE ticks: 10 s with one agent running, then 10 s idle after a turn', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
  await spawn($, 1)
  reset()
  await clock.advance(10_000)
  expect(writes.now ?? 0).toBeGreaterThanOrEqual(9)
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
  await clock.advance(10_000) // past the party
  reset()
  await clock.advance(10_000)
  // Idle: no per-second writes; the tick moves once a minute at most.
  expect(writes.session ?? 0).toBe(0)
  expect(writes.now ?? 0).toBeLessThanOrEqual(1)
})

test('BUG reload: session.start again replays the greeting and rolls today/allTime back to the store', async ($, on) => {
  base(on, { skin: 'cyberpunk-2077' })
  await start($)
  await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
  await spawn($, 1)
  await spawn($, 2)
  await step($, 'a1')
  const get = async (key: string) => last[key] as Record<string, unknown>
  const before = await get('today')
  const greetBefore = toasts.length
  await start($) // what a hot reload does: register + session.start in a fresh env; $.state survives
  const after = await get('today')
  expect(after.agents).toBe(2)
  expect(toasts.filter(t => t.startsWith('Wake up')).length).toBe(1)
})

test('PROBE update that returns prev: is it still a write?', async ($, on) => {
  base(on)
  await start($)
  const stepE = async () => {
    const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, effort: 'high' })
    for await (const _ of stream) void _
  }
  await stepE()
  reset()
  await stepE()
})

test('BUG session.start: one failing $ call early on skips the timers and later commands', async ($, on) => {
  failCommand = 'prefs'
  registered.length = 0
  const clock = base(on)
  await start($)
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
  reset()
  await clock.advance(5_000)
  expect(registered).toContain('skins')
  expect(writes.now ?? 0).toBeGreaterThanOrEqual(1)
})
