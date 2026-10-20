import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

const base = (on: On, context = 100_000) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never) // the Cyberpunk Skins add-on is installed
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: context }, rateLimits: [] } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('agent.spawn', (_$, e) => {
    spawned.push(String((e as { model?: string }).model ?? ''))
    return { model: 'claude-opus-5-5', agentId: 'a1' } as never
  })
  return clock
}

// The model each spawn was asked for, as the plugins passed it down.
const spawned: string[] = []

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)

const text = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}

const spawn = ($: Engine, _on: On, description: string, type = 'general-purpose') => $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description, subagentType: type, provider: 'engine', parentModel: 'x', background: false, fork: false } as never)

test('live activity: an agent row shows what its latest tool call does', async ($, on) => {
  base(on)
  await start($)
  await spawn($, on, 'Engineer: inspect the code')
  await $.tool.call({ tool: 'Read', file_path: 'C:\\repo\\hooks\\register.tsx', agentId: 'a1' } as never)
  expect(await text($)).toContain('▸ reading register.tsx')
})

test('stuck alarm: a running agent quiet for two minutes is flagged', async ($, on) => {
  const clock = base(on)
  await start($)
  await spawn($, on, 'Researcher: dig deep')
  await clock.advance(125_000)
  await clock.settle()
  expect(await text($)).toMatch(/⚠ quiet 2:0\d/)
})

test('token manager: context past 70% gives a /compact tip; the budget is set by command', async ($, on) => {
  base(on, 720_000)
  await start($)
  await $.prompt.submit({ text: 'do the thing', cursor: 0 } as never)
  const before = await text($)
  expect(before).toContain('Token Manager')
  expect(before).toContain('Context 72%: /compact soon')
  const set = await $.command.run({ command: 'tokens', args: 'budget 2' } as never)
  expect(String((set as { text?: string }).text)).toContain('Budget set: $2.00 per task')
})

test('token manager: autopilot sends a read-only explorer to Haiku', async ($, on) => {
  base(on)
  spawned.length = 0
  await start($)
  await $.command.run({ command: 'tokens', args: 'autopilot on' } as never)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Map the repo', subagentType: 'Explore', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  expect(spawned.at(-1)).toBe('haiku')
})

test('today: tasks and agents add up on the scoreboard', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'first task', cursor: 0 } as never)
  await spawn($, on, 'Writer: copy')
  expect(await text($)).toContain('Today 1 tasks · 1 agents')
})

test('a finished agent folds to one line; Open shows its card, Collapse folds it back', async ($, on) => {
  base(on)
  on('turn.complete', async () => ({ text: '' }) as never)
  await start($)
  await spawn($, on, 'Writer: copy')
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok', text: 'ok' } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const joined = async () => (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? '')).join('\n')
  expect(await joined()).not.toContain('tokens used')
  await ui.press((await ui.find({ key: 'open-a1' })) as never)
  expect(await joined()).toContain('tokens used')
  await ui.press((await ui.find({ key: 'close-a1' })) as never)
  expect(await joined()).not.toContain('tokens used')
  await ui.unmount()
})

test('a finished job celebrates, then the panel starts clean: no old crew or task', async ($, on) => {
  const clock = base(on)
  on('turn.complete', async () => ({ text: '' }) as never)
  await start($)
  await $.prompt.submit({ text: 'old job', cursor: 0 } as never)
  await spawn($, on, 'Writer: copy')
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok', text: 'ok' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done', text: 'done' } as never)
  expect(await text($)).toContain('Writer: copy')
  await clock.advance(7_000)
  await clock.settle()
  const after = await text($)
  expect(after).not.toContain('Writer: copy')
  expect(after).not.toContain('old job')
  expect(after).toContain('waiting for your next request')
})

test('usage lists every session, seeded from the history file', async ($, on) => {
  base(on)
  on('fs.read', async () => ({ value: JSON.stringify({ since: '2026-07-08T05:00:00Z', models: { 'claude-opus-5-5': 1_162_600_000, 'claude-haiku-5-5': 12_000_000 } }) }) as never)
  await start($)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const usage = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).find(src => src.includes('>Usage<')) ?? ''
  await ui.unmount()
  expect(usage).toContain('All sessions since Jul 8')
  expect(usage).toContain('Opus 5.5')
})
