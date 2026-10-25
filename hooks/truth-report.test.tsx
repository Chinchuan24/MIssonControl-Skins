import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth audit: background agents and workflow runs across many prompts.
const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never

const toasts: string[] = []
const notes: string[] = []
const opens: string[] = []
let gate: Promise<void> | null = null

const base = (on: On) => {
  toasts.length = 0
  notes.length = 0
  opens.length = 0
  gate = null
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async (_$, e) => {
    opens.push(String((e as { id?: string }).id))
    return { value: { isPlaced: true } } as never
  })
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async (_$, e) => {
    notes.push(String((e as { text?: string; message?: string }).text ?? (e as { message?: string }).message ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  // A tool call waits on `gate` when one is set: a long build or a nested Agent call.
  on('tool.call', async () => {
    if (gate) await gate
    return { result: 'ok' } as never
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.start', async (_$, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('classic.Stop', async () => ({}) as never)
  on('classic.SubagentStop', async () => ({}) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', (_$, e) => {
    const resume = (e as { resume?: { agentId: string } }).resume
    return { model: 'claude-opus-5-5', agentId: resume ? resume.agentId : `a${++n}` } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'composer' } } as never)
const notify = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'task-notification' } } as never)
const spawn = ($: Engine, description: string, extra: Record<string, unknown> = {}) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: true, fork: false, ...extra } as never)
const wf = ($: Engine, description: string, agentIndex: number) =>
  spawn($, description, { tool_use_id: 'toolu_workflow', workflow: { runId: 'wf_1', agentIndex } })
const finish = ($: Engine, agentId?: string, reason = 'answer') =>
  $.turn.complete({ ...(agentId ? { agentId } : {}), reason, answer: 'ok', isAborted: reason === 'aborted', durationMs: 1, turnId: 'x' } as never)
const step = async ($: Engine, agentId?: string) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of stream) void _
}
const done = () => toasts.filter(t => t.startsWith('🎉 Done'))

// Everything the terminal pane says, one string.
const paneText = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
// The desktop pane's drawings: alts and sources.
const paneSvgs = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => ({ alt: String(el.props.alt), src: String(el.props.source) }))
  await ui.unmount()
  return all
}
// The terminal band's crew button: "◈ N".
const bandCrew = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const b = await ui.find({ key: 'crab-agents' })
  await ui.unmount()
  return String((b as { props?: { label?: string } } | null)?.props?.label ?? '')
}
// The desktop band's status, from its Svg alt ("Claude: Working, ...").
const bandAlt = async ($: Engine, isWorking = false) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...(BAND as object), isWorking } as never })
  const svg = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return String(svg[0]?.props.alt ?? '')
}


// Realistic: the full event order the engine sends for "research X in the background".
test('real order: Done waits for the report turn; band says Working during it; Done after it', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'research the launch videos')
  await $.turn.start({ text: 'research the launch videos', turnId: 'm1' } as never)
  await step($)
  await spawn($, 'Researcher: launch videos')
  await finish($) // main answers "started it in the background"
  const bgTask = [{ id: 'a1', type: 'subagent', status: 'running', description: 'Researcher: launch videos', agent_type: 'general-purpose' }]
  await $.classic.Stop({ stop_hook_active: false, background_tasks: bgTask, session_crons: [] } as never)
  const afterMainStop = { toasts: done().length, notes: notes.length }
  await clock.advance(90_000)
  await $.turn.start({ text: '', turnId: 'b1', agentId: 'a1' } as never)
  await step($, 'a1')
  await clock.advance(30_000)
  await $.classic.SubagentStop({ stop_hook_active: false, agent_id: 'a1', agent_type: 'general-purpose', agent_transcript_path: '/t', background_tasks: bgTask, session_crons: [] } as never)
  await finish($, 'a1')
  await clock.settle()
  const atAgentEnd = { toasts: done().length, notes: notes.length }
  // The engine dequeues the notification once idle and runs a main turn on it.
  await notify($, '<task-notification><task-id>a1</task-id>Researcher: launch videos completed</task-notification>')
  await $.turn.start({ text: '<task-notification>...', turnId: 'm2' } as never)
  await step($)
  await clock.advance(5_000)
  const bandDuring = (await bandAlt($, true)).split(',')[0]
  const paneDuring = (await paneText($)).includes('Done!')
  await clock.advance(85_000)
  await finish($)
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [], session_crons: [] } as never)
  await clock.settle()
  const atSummaryEnd = { toasts: done().length, notes: notes.length }
  expect({ afterMainStop, atAgentEnd, bandDuring, paneDuring, atSummaryEnd }).toEqual({
    afterMainStop: { toasts: 0, notes: 0 },
    atAgentEnd: { toasts: 0, notes: 0 },
    bandDuring: 'Claude: Working',
    paneDuring: false,
    atSummaryEnd: { toasts: 1, notes: 1 },
  })
})
