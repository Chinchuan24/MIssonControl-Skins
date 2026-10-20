import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro: a flow reported with the progress tool outlives its request.
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const toasts: string[] = []
const base = (on: On) => {
  toasts.length = 0
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => { toasts.push(String((e as { text?: string }).text ?? '')); return { value: undefined } as never })
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'composer' } } as never)
const report = ($: Engine, input: Record<string, unknown>) => $.tool.call({ tool: 'mcp__crab-progress__progress', ...input } as never)
const spawn = ($: Engine, i: number, description: string) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
const mainDone = ($: Engine, reason = 'answer') => $.turn.complete({ reason, isAborted: reason === 'aborted', answer: 'ok', durationMs: 1000, turnId: 'm' } as never)
const agentDone = ($: Engine, agentId: string) => $.turn.complete({ agentId, reason: 'answer', isAborted: false, answer: 'ok', durationMs: 1000, turnId: `t-${agentId}` } as never)

const bandTerm = async ($: Engine, isWorking: boolean) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking, maxRows: 4, bodyColumns: 140 } as never })
  const t = (await ui.findAll({ type: 'Text' })).map(x => String((x as { text?: string }).text ?? '')).join(' ')
  await ui.unmount()
  return t
}
const bandDesk = async ($: Engine, isWorking: boolean) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 100 } as never })
  const t = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt ?? '')).join(' || ')
  await ui.unmount()
  return t
}
const deskPane = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const t = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt ?? '')).join('\n')
  await ui.unmount()
  return t
}
const termPane = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const t = (await ui.findAll({ type: 'Text' })).map(x => String((x as { text?: string }).text ?? '')).join('\n')
  await ui.unmount()
  return t
}

test('stale flow, finished: full real flow with workers, then an unrelated prompt 10 min later', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'ship the release')
  await report($, { title: 'Ship release', phase: 'delegate', tasks: [{ title: 'Engineer: api', tier: 'medium' }, { title: 'Engineer: ui', tier: 'medium' }], done: 0 })
  await spawn($, 1, 'Engineer: api'); await spawn($, 2, 'Engineer: ui')
  await clock.advance(60_000)
  await agentDone($, 'a1'); await agentDone($, 'a2')
  await report($, { done: 2, finished: true })
  await mainDone($)
  await clock.advance(600_000)
  await ask($, 'what does the -r flag of cp do?')
  await clock.settle()
  const term = await bandTerm($, true)
  const desk = await bandDesk($, true)
  const p = await termPane($)
  expect(term).not.toContain('Ship release')
  expect(desk).not.toContain('Ship release')
})

test('stale flow, unfinished: plan left at 1/2 with no agents running, then an unrelated prompt', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'ship the release')
  await report($, { title: 'Ship release', phase: 'delegate', tasks: [{ title: 'Engineer: api', tier: 'medium' }, { title: 'Engineer: ui', tier: 'medium' }], done: 0 })
  await spawn($, 1, 'Engineer: api')
  await agentDone($, 'a1')
  await report($, { done: 1 })
  await mainDone($)
  await clock.advance(300_000)
  await ask($, 'what time zone is the server in?')
  await clock.settle()
  const term = await bandTerm($, true)
  const alts = await deskPane($)
  const wf = alts.split('\n').find(a => a.startsWith('Workflow:')) ?? ''
  expect(term).not.toContain('Ship release')
  expect(wf).not.toContain('Engineer: ui waiting')
})

test('stale flow, stopped: Esc at 2/5, then an unrelated prompt', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'ship the release')
  await report($, { title: 'Ship release', phase: 'delegate', total: 5, done: 2, tasks: [1, 2, 3, 4, 5].map(i => ({ title: `Engineer: piece ${i}`, tier: 'medium' })) })
  await clock.advance(5_000)
  await mainDone($, 'aborted')
  const afterEsc = await bandTerm($, false)
  await clock.advance(30_000)
  await ask($, 'what is 2 + 2')
  await clock.settle()
  const term = await bandTerm($, true)
  expect(term).not.toContain('Ship release')
})
