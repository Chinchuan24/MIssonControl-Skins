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
const paneSvgSrc = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await ui.unmount()
  return all.join('')
}
const wf = ($: Engine, description: string, i: number) =>
  $.agent.spawn({ tool_use_id: 'toolu_wf', prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false, workflow: { runId: 'wf_1', agentIndex: i } } as never)

test('(a) workflow fan-out of 5 same-label workers: xp and rounds', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'review every file')
  await $.tool.call({ tool: 'Workflow', script: 'review.js' } as never)
  for (let i = 1; i <= 5; i++) await wf($, 'Reviewer: review file', i)
  const src = await paneSvgSrc($)
  const txt = await paneText($)
  const rounds = [...(src.match(/round \d+/g) ?? []), ...(txt.match(/round \d+/g) ?? [])]
  expect({ agents: credNow?.agents, xp: credNow?.xp, rounds }).toEqual({ agents: 5, xp: 10, rounds: [] })
})

test('control: 5 workers with distinct labels', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'review every file')
  for (let i = 1; i <= 5; i++) await wf($, `Reviewer: file ${i}`, i)
  expect({ agents: credNow?.agents, xp: credNow?.xp }).toEqual({ agents: 5, xp: 10 })
})

test('(b) same description on an unrelated prompt 3h later', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'how does auth work?')
  await spawn($, 'Explore: map the repo', false, 'Explore')
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'map', turnId: 'x1' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'it works like so', turnId: 'm1' } as never)
  await clock.advance(600_000)
  const before = credNow?.xp ?? 0
  await ask($, 'where are payments handled?')
  await spawn($, 'Explore: map the repo', false, 'Explore')
  const after = credNow?.xp ?? 0
  const txt = await paneText($)
  const src = await paneSvgSrc($)
  const rounds = [...(src.match(/round \d+/g) ?? []), ...(txt.match(/round \d+/g) ?? [])]
  expect({ delta: after - before, rounds }).toEqual({ delta: 2, rounds: [] })
})

test('(c) a real retry in the same job still reads round 2 (sanity)', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'fix the bug')
  await spawn($, 'Engineer: fix the bug')
  await $.turn.complete({ agentId: 'a1', reason: 'error', answer: '', turnId: 'x1' } as never)
  await spawn($, 'Engineer: fix the bug')
  const src = await paneSvgSrc($)
  const txt = await paneText($)
  expect([...(src.match(/round \d+/g) ?? []), ...(txt.match(/round \d+/g) ?? [])]).toContain('round 2')
})
