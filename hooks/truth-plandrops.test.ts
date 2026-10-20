import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth bugs in plans and progress: what the band and pane say against what Claude does.

const toasts: string[] = []
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const

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
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined } as never
  })
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

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0 } as never)
const spawn = ($: Engine, i: number, description: string, extra: Record<string, unknown> = {}) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false, ...extra } as never)
const plan = ($: Engine, input: Record<string, unknown>) => $.tool.call({ tool: 'mcp__ccd_turn__update_plan', ...input } as never)
const items = (names: string[], done: number, inProgress = true) =>
  names.map((content, i) => ({ content, status: i < done ? 'completed' : i === done && inProgress ? 'in_progress' : 'pending' }))

// The band's one Svg: its alt reads "<title>: <status>, <activity>, <pct>%, context N%".
const band = async ($: Engine, isWorking: boolean) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 100 } as never })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return String(svgs[0]?.props.alt ?? '')
}

const desktopPane = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return svgs.map(s => ({ alt: String(s.props.alt ?? ''), source: String(s.props.source ?? '') }))
}

const terminalPane = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return texts.map(t => String((t as { text?: string }).text ?? '')).join('\n')
}

// The manager card's "Overall progress" readout.
const overall = async ($: Engine) => {
  const card = (await desktopPane($)).find(s => s.alt.startsWith('Manager:'))
  const m = /Overall progress<\/text>[\s\S]*?text-anchor="end"[^>]*>([^<]*)<\/text>/.exec(card?.source ?? '')
  return m?.[1] ?? '(none)'
}


const usage = { model: 'claude-opus-5-5', input_tokens: 50_000, output_tokens: 5_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

test('control: without the progress call the scout and its 55k stay', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'big refactor')
  await spawn($, 1, 'Explorer: map the repo', { subagentType: 'Explore' })
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'mapped', usage } as never)
  const p = await terminalPane($)
  expect(p).toContain('Explorer: map the repo')
  expect(p).toContain('55k')
})

test('the first plan after a scout keeps the scout and its tokens', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'big refactor')
  await spawn($, 1, 'Explorer: map the repo', { subagentType: 'Explore' })
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'mapped', usage } as never)
  const before = await terminalPane($)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Big refactor', tasks: [{ title: 'Engineer: parser', tier: 'medium' }], minutes: 30 } as never)
  const after = await terminalPane($)
  expect(after).toContain('Explorer: map the repo')
  expect(after).toContain('55k')
})

test('a re-plan under a new title mid-job keeps a finished worker', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'ship the api')
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Ship API', tasks: [{ title: 'Engineer: schema', tier: 'medium' }, { title: 'Engineer: routes', tier: 'medium' }] } as never)
  await spawn($, 1, 'Engineer: schema')
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'schema done', usage } as never)
  const before = await terminalPane($)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Ship API v2', tasks: [{ title: 'Engineer: schema', tier: 'medium' }, { title: 'Engineer: routes', tier: 'medium' }, { title: 'Tester: e2e', tier: 'light' }], done: 1 } as never)
  const after = await terminalPane($)
  expect(after).toContain('55k')
})
