import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth audit: alarms, toasts, the done cheer and Street Cred.
// Every test here states what a real session does, and what Mission Control should then say.

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

const toasts: string[] = []
const notes: string[] = []
const sounds: string[] = []
type Cred = { xp: number; jobs: number; agents: number }
let credNow: Cred | undefined
const reset = () => {
  credNow = undefined
  toasts.length = 0
  notes.length = 0
  sounds.length = 0
}

// A tool call the test holds open: a 10-minute build, or one waiting at a permission dialog.
let gate: Promise<void> | null = null
let openGate = () => {}
const holdTools = () => {
  gate = new Promise<void>(r => (openGate = r))
}

const base = (on: On, store: Record<string, unknown> = {}) => {
  reset()
  gate = null
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
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
    return { value: { isSent: true } } as never
  })
  on('audio.play', async (_$, e) => {
    sounds.push(String((e as { asset?: string }).asset))
    return { value: undefined } as never
  })
  on('tool.call', async () => {
    if (gate) await gate
    return { result: 'ok' } as never
  })
  on('turn.start', async (_$, e) => ({ turnId: (e as { turnId?: string }).turnId ?? 'm' }) as never)
  on('state.set', async (_$, e, next) => {
    if ((e as { key?: string }).key === 'cred') credNow = (e as { value?: unknown }).value as Cred
    return next(e)
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0 } as never)
const spawn = ($: Engine, description: string, background = false, type = 'general-purpose') =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: type, provider: 'engine', parentModel: 'x', background, fork: false } as never)
const paneText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const dones = () => toasts.filter(t => t.startsWith('🎉 Done'))
const quiets = () => toasts.filter(t => t.includes('has gone quiet'))

// ---------------------------------------------------------------------------
const PLAN = (s: string[]) => ({ tool: 'mcp__ccd_turn__update_plan', items: [
  { content: 'Map the old calls', status: s[0] }, { content: 'Port the client', status: s[1] },
  { content: 'Port the server', status: s[2] }, { content: 'Run the tests', status: s[3] } ] }) as never

test('V1 plan pending + question: no Done, Claude needs you', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'migrate the app to the new API')
  await $.tool.call(PLAN(['completed', 'in_progress', 'pending', 'pending']))
  await $.tool.call({ tool: 'Read', file_path: '/repo/server/auth.ts' } as never)
  await clock.advance(60_000)
  await $.turn.complete({ reason: 'answer', answer: 'The server uses a deprecated auth flow. Should I replace it or keep it?', turnId: 'm1' } as never)
  await clock.settle()
  const shown = await paneText($)
  // Not done: the person is asked for, the notification still useful.
  expect({ dones: dones(), notes }).toEqual({ dones: [], notes: ['Claude needs you: migrate the app to the new API'] })
})

test('V2 control: plan fully completed -> cheer is right', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'migrate the app to the new API')
  await $.tool.call(PLAN(['completed', 'completed', 'completed', 'completed']))
  await clock.advance(60_000)
  await $.turn.complete({ reason: 'answer', answer: 'All migrated, tests pass.', turnId: 'm1' } as never)
  await clock.settle()
  expect(dones()).toEqual(['🎉 Done: migrate the app to the new API'])
})

test('V3 follow-up: the person answers, the plan finishes, one Done for it', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'migrate the app to the new API')
  await $.tool.call(PLAN(['completed', 'in_progress', 'pending', 'pending']))
  await clock.advance(60_000)
  await $.turn.complete({ reason: 'answer', answer: 'Should I replace it or keep it?', turnId: 'm1' } as never)
  await clock.settle()
  await clock.advance(30_000)
  await ask($, 'replace it')
  await $.tool.call(PLAN(['completed', 'completed', 'completed', 'completed']))
  await clock.advance(60_000)
  await $.turn.complete({ reason: 'answer', answer: 'Done, all tests pass.', turnId: 'm2' } as never)
  await clock.settle()
  expect(dones()).toEqual(['🎉 Done: replace it'])
})
