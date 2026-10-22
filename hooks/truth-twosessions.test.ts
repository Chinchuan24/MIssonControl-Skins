import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Session lifecycle truth checks: what Mission Control says across aborts, exits,
// /clear, two sessions sharing one store, and a session's first spend.

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const DAY = '2026-10-20'

let toasts: string[] = []
let notes: string[] = []
let cost = 0
let ctx = 100_000
let disk: Record<string, unknown> = {}

const base = (on: On, store: Record<string, unknown> = {}) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  // The plugin's store file, shared by every session open at once: a test writes
  // to it directly to play the other session.
  disk = JSON.parse(JSON.stringify(store))
  on('store.get', async (_$, e) => ({ value: disk[(e as { key: string }).key] }) as never)
  on('store.set', async (_$, e) => {
    const { key, value } = e as { key: string; value: unknown }
    disk[key] = JSON.parse(JSON.stringify(value))
    return { value: undefined } as never
  })
  on('store.delete', async (_$, e) => {
    delete disk[(e as { key: string }).key]
    return { value: undefined } as never
  })
  on('store.keys', async () => ({ value: Object.keys(disk) }) as never)
  toasts = []
  notes = []
  cost = 0
  ctx = 100_000
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async (_$, e) => {
    notes.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.start', async () => ({ turnId: 'x' }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: ctx }, rateLimits: [], cost: { usd: cost } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 500, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0 } as never)
const spawn = ($: Engine, description: string, background = false) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background, fork: false } as never)
const step = async ($: Engine, agentId?: string) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of stream) void _
}
const stored = async (_$: Engine, key: string): Promise<unknown> => disk[key]
const text = async ($: Engine, surface: 'terminal' | 'desktop' = 'terminal'): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface, component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}

// ---------------------------------------------------------------------------
// Independent repro (verifier). Not even overlapping work: session A sits idle
// while the person opens session B, does two quick jobs there and quits it.
// Back in A, one job. The store file is the plugin's one JSON file for every
// session on the machine ($.store: "kept between sessions").

test('a second session opened and closed while this one sat idle keeps its Today and All-time', async ($, on) => {
  base(on, {
    today: { date: DAY, tasks: 1, agents: 0, tokens: 1000, costUsd: 0.1 },
    allTime: { since: '2026-07-08T05:00:00Z', models: { 'claude-opus-5-5': 500_000 } },
  })
  await start($)
  // Session B (its own process) started from the same file, did 2 jobs with one
  // agent, then quit; its last turn end saved:
  disk.today = { date: DAY, tasks: 3, agents: 1, tokens: 51_000, costUsd: 2.1 }
  disk.allTime = { since: '2026-07-08T05:00:00Z', models: { 'claude-opus-5-5': 550_000 } }
  // Back in A: one job, one 1,000-token request.
  await ask($, 'rename the flag')
  await step($)
  await $.turn.complete({ reason: 'answer', answer: 'ok', text: 'ok' } as never)
  const day = disk.today as { tasks: number; agents: number; tokens: number; costUsd: number }
  const every = disk.allTime as { models: Record<string, number> }
  const pane = await text($)
  const todayLine = pane.split('\n').find(l => l.startsWith('Today')) ?? ''
  expect({ tasks: day.tasks, agents: day.agents, tokens: day.tokens }).toEqual({ tasks: 4, agents: 1, tokens: 52_000 })
  expect(every.models['claude-opus-5-5']).toBe(551_000)
  expect(todayLine).toContain('4 tasks')
})
