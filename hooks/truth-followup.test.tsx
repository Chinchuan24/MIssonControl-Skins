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


// Independent repro, full engine order: agent ends -> idle -> task-notification
// prompt -> main turn.start -> main step -> Agent spawn -> the agent's own start/steps.
test('hidden-after-done-followup: an agent Claude starts while answering a report stays visible while it runs', async ($, on) => {
  const clock = base(on)
  on('turn.start', async (_$, e) => ({ turnId: String((e as { turnId?: string }).turnId ?? 't') }) as never)
  await start($)
  await ask($, 'research launch videos in the background')
  await $.turn.start({ text: 'research', turnId: 'm1' } as never)
  await step($)
  await spawn($, 'Researcher: launch videos')
  await finish($)
  await $.turn.start({ text: 'p', turnId: 'r1', agentId: 'a1' } as never)
  await step($, 'a1')
  await clock.advance(60_000)
  await finish($, 'a1')
  const cheered = done().length
  await clock.advance(1_000)
  await notify($, '<task-notification>Researcher: launch videos completed</task-notification>')
  await $.turn.start({ text: '', turnId: 'm2' } as never)
  await step($)
  await spawn($, 'Writer: summarise findings')
  await $.turn.start({ text: 'p', turnId: 'w1', agentId: 'a2' } as never)
  for (let i = 0; i < 4; i++) { await clock.advance(5_000); await step($, 'a2') }
  await clock.settle()
  const text = await paneText($)
  const today = (await paneSvgs($)).find(s => s.alt.startsWith('Today:'))?.alt ?? ''
  // No Done before the report is answered (done-before-report-answered), so the job is
  // still open: its crew is the finished researcher and the running writer.
  expect({ cheered, crew: await bandCrew($), shown: text.includes('Writer: summarise findings'), waiting: text.includes('waiting for your next request'), today }).toEqual({ cheered: 0, crew: '◈ 2', shown: true, waiting: false, today: 'Today: 1 tasks, 2 agents, 140 tokens, ≈$0.00' })
})
