import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth audit: what the band and pane SAY against what Claude is really doing.

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const BAND = (isWorking: boolean) => ({ hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 120 }) as never

type Rec = { toasts: string[]; notes: string[] }
const base = (on: On) => {
  const rec: Rec = { toasts: [], notes: [] }
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
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

test('stale-manager-activity: background agent keeps working with its own tools; the band never names the manager\'s old Read', async ($, on) => {
  const { clock } = base(on)
  await start($)
  await ask($, 'build the video')
  await $.tool.call({ tool: 'Read', file_path: '/repo/old-notes.md' } as never)
  await spawn($, 'Researcher: launch videos', 'r1', { background: true })
  await mainDone($)
  await clock.advance(60_000)
  await $.tool.call({ tool: 'WebSearch', query: 'launch videos 2026', agentId: 'r1' } as never)
  await clock.advance(60_000)
  await clock.settle()
  const altIdle = await bandDesktopAlt($, false)
  const altBusy = await bandDesktopAlt($, true)
  const term = await bandTerminal($, false)
  expect(altIdle).not.toContain('old-notes.md')
  expect(altBusy).not.toContain('old-notes.md')
})
