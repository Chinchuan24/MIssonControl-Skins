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


const spawnWf = ($: Engine, description: string, i: number) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: true, fork: false, workflow: { runId: 'wf_build', agentIndex: i } } as never)
const stepOf = ($: Engine, agentId: string) =>
  $.turn.step({ turnId: 's', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId } as never)

// V1. Foreground agent: one 'npm test' Bash call (timeout 10 min) still running at 2:30.
test('V1: an agent inside a 2:30 npm test call is not called stuck; its row says what runs', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'run the tests')
  await spawn($, 'Tester: run tests')
  holdTools()
  const call = $.tool.call({ tool: 'Bash', command: 'npm test', timeout: 600000, agentId: 'a1' } as never)
  await clock.advance(150_000)
  await clock.settle()
  const shown = await paneText($)
  const row = shown.split('\n').filter(l => l.includes('quiet') || l.includes('npm test')).join(' | ')
  openGate()
  await call
  expect({ toasts: quiets(), says: row.includes('▸ running npm test'), quiet: row.includes('quiet') }).toEqual({ toasts: [], says: true, quiet: false })
})

// V2. Same agent, permission dialog not yet answered: the core call is pending the same way.
test('V2: an agent waiting 2:30 on a permission dialog is not called "may be stuck"', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'tidy the repo')
  await spawn($, 'Engineer: delete old files')
  holdTools()
  const call = $.tool.call({ tool: 'Bash', command: 'rm -rf dist', agentId: 'a1' } as never)
  await clock.advance(150_000)
  await clock.settle()
  openGate()
  await call
  expect(quiets()).toEqual([])
})

// V3. Workflow with 5 agents each in a long build: one toast per agent.
test('V3: 5 workflow agents in long builds give no stuck toasts', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'build every package')
  for (let i = 1; i <= 5; i++) await spawnWf($, `Engineer: build pkg ${i}`, i)
  holdTools()
  const calls = [1, 2, 3, 4, 5].map(i => $.tool.call({ tool: 'Bash', command: `npm run build -w pkg${i}`, timeout: 600000, agentId: `a${i}` } as never))
  await clock.advance(150_000)
  await clock.settle()
  openGate()
  await Promise.all(calls)
  expect(quiets().length).toBe(0)
})

// V4. Release misfire: at 2:30 into the build, /missioncontrol release marks the busy agent failed.
test('V4: /missioncontrol release leaves an agent whose build is still running', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'run the tests')
  await spawn($, 'Tester: run tests')
  holdTools()
  const call = $.tool.call({ tool: 'Bash', command: 'npm test', timeout: 600000, agentId: 'a1' } as never)
  await clock.advance(150_000)
  await clock.settle()
  const reply = (await $.command.run({ command: 'missioncontrol', args: 'release' } as never)) as { text?: string }
  openGate()
  await call
  expect(String(reply.text)).toContain('No quiet agents to release')
})

// V5. Ends are never stamped: a 100 s tool, then a 25 s model reply (normal), is flagged at 2:01.
test('V5: a 100 s tool followed by a 25 s model reply is not flagged: the call\'s end is a sign of life', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'run the tests')
  await spawn($, 'Tester: run tests')
  holdTools()
  const call = $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'a1' } as never)
  await clock.advance(100_000)
  openGate()
  await call
  await clock.advance(25_000) // the model is writing its next step
  await clock.settle()
  const flagged = [...quiets()]
  await stepOf($, 'a1')
  expect(flagged).toEqual([])
})

// V6. Control: an agent with NO call in flight that is silent 2:30 is flagged (the alarm itself works).
test('V6 control: an idle agent with no call in flight, silent 2:30, is flagged', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'run the tests')
  await spawn($, 'Tester: run tests')
  await $.tool.call({ tool: 'Read', file_path: 'a.ts', agentId: 'a1' } as never)
  await clock.advance(150_000)
  await clock.settle()
  expect(quiets().length).toBe(1)
})
