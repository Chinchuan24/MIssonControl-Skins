import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const
const band = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 200 } as never

type PaneRow = { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }

// `panes` is what ui.panes answers; `calls` records closes and opens in order; `toasts` the toasts.
const base = (on: On, opts: { panes?: PaneRow[]; store?: Record<string, unknown> } = {}) => {
  const calls: string[] = []
  const toasts: string[] = []
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, opts.store ?? {})
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('ui.panes', async () => ({ value: opts.panes ?? [] }) as never)
  on('ui.close', async (_$, e) => {
    calls.push(`close ${(e as { id: string }).id}`)
    return { value: undefined } as never
  })
  on('ui.open', async (_$, e) => {
    calls.push(`open ${(e as { id: string }).id}`)
    return { value: { isPlaced: true } } as never
  })
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return { calls, toasts, clock }
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'composer' } } as never)
const spawn = ($: Engine, i: number, type: string, description: string, extra: Record<string, unknown> = {}) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description, subagentType: type, provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false, ...extra } as never)
const desktopSvgs = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  const svgs = (await ui.findAll({ type: 'Svg' })).map(el => ({ alt: String(el.props.alt), source: String(el.props.source) }))
  await ui.unmount()
  return svgs
}
const terminalText = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return texts.join('\n')
}

// 2. "Finished ▸" collapsed: a background helper started by a sub-agent keeps
// running after its parent finished. Collapsing the finished rows hides the
// running helper too: it is in no row at all.
test('collapsing Finished keeps a still-running agent whose parent finished', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'fix the login bug')
  await spawn($, 1, 'mc-heavy', 'Lead the fix')
  await spawn($, 2, 'Explore', 'Helper search', { parentAgentId: 'a1', background: true })
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok' } as never)
  const rowsOf = async () => (await desktopSvgs($)).map(x => x.alt)
  expect((await rowsOf()).find(a => a.startsWith('Helper search:'))).toBe('Helper search: Opus 5.5, running')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  await ui.press({ key: 'done' })
  await ui.drawn()
  const label = String((await ui.findAll({ type: 'Button' })).find(b => String(b.props.label).includes('Finished'))?.props.label)
  await ui.unmount()
  expect(label).toStartWith('▸') // collapsed
  // Expected: the running helper keeps its row. Actual: no row for it at all, though it runs.
  expect((await rowsOf()).filter(a => a.startsWith('Helper search:')).length).toBe(1)
})


const collapse = async ($: Engine, surface: 'desktop' | 'terminal') => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  await ui.press({ key: 'done' })
  await ui.drawn()
  await ui.unmount()
}

test('VARIANT parent failed (error), background helper still running, collapse Finished (desktop)', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'fix the login bug')
  await spawn($, 1, 'mc-heavy', 'Lead the fix')
  await spawn($, 2, 'Explore', 'Helper search', { parentAgentId: 'a1', background: true })
  await $.turn.complete({ agentId: 'a1', reason: 'error', answer: '' } as never)
  const before = (await desktopSvgs($)).map(x => x.alt).filter(a => a.startsWith('Helper search:'))
  expect(before.length).toBe(1)
  await collapse($, 'desktop')
  const after = (await desktopSvgs($)).map(x => x.alt)
  expect(after.filter(a => a.startsWith('Helper search:')).length).toBe(1)
})

test('VARIANT terminal surface: collapse Finished keeps the running child of a finished parent', async ($, on) => {
  base(on)
  await start($)
  await ask($, 'fix the login bug')
  await spawn($, 1, 'mc-heavy', 'Lead the fix')
  await spawn($, 2, 'Explore', 'Helper search', { parentAgentId: 'a1', background: true })
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok' } as never)
  const rowLines = (t: string) => t.split('\n').filter(l => l.includes('Helper search') && !l.includes('Haiku'))
  const b = await terminalText($)
  expect(rowLines(b).length).toBeGreaterThan(0)
  await collapse($, 'terminal')
  const txt = await terminalText($)
  expect(rowLines(txt).length).toBeGreaterThan(0)
})
