import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth audit: what the band and pane SAY against what Claude is really doing.

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const BAND = (isWorking: boolean) => ({ hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 120 }) as never

let disk: Record<string, unknown> = {}
type Rec = { toasts: string[]; notes: string[] }
const base = (on: On) => {
  const rec: Rec = { toasts: [], notes: [] }
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  disk = {}
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
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    rec.toasts.push(String((e as { message?: string; text?: string }).message ?? (e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async (_$, e) => {
    rec.notes.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.start', async () => ({}) as never)
  on('agent.spawn', (_$, e) => {
    const ev = e as { resume?: { agentId: string }; description: string }
    return { model: 'claude-opus-5-5', agentId: ev.resume?.agentId ?? ids[ev.description] ?? 'a1' } as never
  })
  return { clock, rec }
}
// Which agentId each description spawns as.
const ids: Record<string, string> = {}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'composer' } } as never)
const spawn = ($: Engine, description: string, agentId: string, extra: Record<string, unknown> = {}) => {
  ids[description] = agentId
  return $.agent.spawn({ tool_use_id: `t-${agentId}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false, ...extra } as never)
}
const mainDone = ($: Engine, reason = 'answer') => $.turn.complete({ reason, answer: 'ok', text: 'ok', isAborted: reason === 'aborted', durationMs: 1000, turnId: 'm' } as never)
const agentDone = ($: Engine, agentId: string, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ agentId, reason: 'answer', answer: 'ok', text: 'ok', isAborted: false, durationMs: 1000, turnId: `t-${agentId}`, ...extra } as never)

const paneText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const bandTerminal = async ($: Engine, isWorking: boolean): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'AbovePrompt', props: BAND(isWorking) })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join(' | ')
}
const bandDesktopAlt = async ($: Engine, isWorking: boolean): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: BAND(isWorking) })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return svgs.map(s => String(s.props.alt ?? '')).join(' || ')
}
const desktopPaneAlts = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return svgs.map(s => String(s.props.alt ?? '')).join('\n')
}

// Independent repro of carry-done-wrong-task, with the engine's real follow-up:
// a background agent's end is followed by a task-notification turn on the main loop.
const notify = ($: Engine) => $.prompt.submit({ text: '<task-notification><task-id>r1</task-id><status>completed</status></task-notification>', cursor: 0, origin: { kind: 'task-notification' } } as never)

const flow = async ($: Engine, clock: { advance: (ms: number) => Promise<void>; settle: () => Promise<void> }, reason: string) => {
  await start($)
  await ask($, 'build the video')
  await spawn($, 'Researcher: launch videos', 'r1', { background: true })
  await mainDone($) // "started it in the background"
  await clock.advance(30_000)
  await ask($, 'are you working?')
  await mainDone($) // "yes, it's still running"
  await clock.advance(150_000)
  await agentDone($, 'r1', { reason, isAborted: false })
  await clock.settle()
  // The engine then wakes the main loop with the task notification and it answers.
  await notify($)
  await clock.advance(3_000)
  await mainDone($)
  await clock.settle()
}

test('carry-done-wrong-task (answer): toast, notification and legend name the job that finished', async ($, on) => {
  const { clock, rec } = base(on)
  await flow($, clock, 'answer')
  const legends = (disk.legends ?? []) as { task: string; ms: number }[]
  expect({
    done: rec.toasts.filter(t => t.includes('🎉 Done')),
    note: rec.notes.filter(n => n.includes('Claude finished')).map(n => (JSON.parse(n) as { text: string }).text),
    legend: legends.map(l => ({ task: l.task, secs: Math.round(l.ms / 1000) })),
  }).toEqual({
    done: ['🎉 Done: build the video'],
    note: ['Claude finished: build the video'],
    legend: [{ task: 'build the video', secs: 183 }],
  })
})

test('carry-done-wrong-task (error): a carried agent that failed is not cheered, under either name', async ($, on) => {
  const { clock, rec } = base(on)
  await flow($, clock, 'error')
  expect(rec.toasts.filter(t => t.includes('🎉 Done'))).toEqual([])
})
