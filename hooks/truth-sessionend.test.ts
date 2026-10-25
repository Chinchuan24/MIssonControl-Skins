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
// Independent realism variants (verify-no-save-on-session-end-r)

test('R1 background agent still running when the person quits: its spent tokens are saved', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'build the video')
  await spawn($, 'Researcher: launch videos', true)
  await $.turn.complete({ reason: 'answer', answer: 'started', text: 'started' } as never)
  await step($, 'a1')
  await step($, 'a1')
  const shown = await text($)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1', resume: {} } as never)
  const day = (await stored($, 'today')) as { tokens?: number } | undefined
  expect({ paneShows2k: /2[.,]?0?\s*k|2,000|2000/i.test(shown), saved: day?.tokens }).toEqual({ paneShows2k: true, saved: 2000 })
})

test('R2 background agent reports back, engine wakes the main session for a turn: tokens saved (control)', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'build the video')
  await spawn($, 'Researcher: launch videos', true)
  await $.turn.complete({ reason: 'answer', answer: 'started', text: 'started' } as never)
  await step($, 'a1')
  await step($, 'a1')
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok', text: 'ok' } as never)
  // The task notification wakes the main agent: one main step and its answer.
  await step($)
  await $.turn.complete({ reason: 'answer', answer: 'it is done', text: 'it is done' } as never)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1', resume: {} } as never)
  const day = (await stored($, 'today')) as { tokens?: number } | undefined
  expect(day?.tokens).toBe(3000)
})

test('R3 Esc/ctrl+c aborts the turn first, then exit: Today saved (control)', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'build the video')
  await spawn($, 'Researcher: launch videos')
  await step($)
  await $.turn.complete({ reason: 'aborted', answer: '', text: '' } as never)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1', resume: {} } as never)
  const day = (await stored($, 'today')) as { tasks?: number; agents?: number; tokens?: number } | undefined
  expect({ tasks: day?.tasks, agents: day?.agents, tokens: day?.tokens }).toEqual({ tasks: 1, agents: 1, tokens: 1000 })
})

test('R4 window closed mid-turn (signal, reason other): Today saved', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'build the video')
  await step($)
  await step($)
  await $.session.end({ reason: 'other', sessionId: 's1', resume: {} } as never)
  const day = (await stored($, 'today')) as { tasks?: number; tokens?: number } | undefined
  const every = (await stored($, 'allTime')) as { models?: Record<string, number> } | undefined
  expect({ tasks: day?.tasks, tokens: day?.tokens, all: every?.models?.['claude-opus-5-5'] }).toEqual({ tasks: 1, tokens: 2000, all: 2000 })
})
