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

// 1. The band's ◈ crew button: Mission Control is open but behind another tab (or
// waiting undrawn). The person clicks ◈ to see the crew; the pane is closed instead.
test('band ◈ brings forward a Mission Control pane that sits behind another tab', async ($, on) => {
  const { calls } = base(on, {
    panes: [
      { id: 'crab-agents', title: 'Mission Control', isShown: false, isFocused: false, isPlaced: true },
      { id: 'crab-memory', title: 'Memory', isShown: true, isFocused: false, isPlaced: true },
    ],
  })
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band } as never)
  calls.length = 0
  await ui.press({ key: 'crab-agents' })
  await ui.drawn()
  await ui.unmount()
  // Expected: brought forward (close then open, as /missioncontrol does). Actual: only closed.
  expect(calls.at(-1)).toBe('open crab-agents')
})

// Undrawn variant: Mission Control auto-opened (unasked) on a narrow terminal waits undrawn.
test('band ◈ shows an undrawn (isPlaced:false) Mission Control', async ($, on) => {
  const { calls } = base(on, {
    panes: [{ id: 'crab-agents', title: 'Mission Control', isShown: false, isFocused: false, isPlaced: false }],
  })
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band } as never)
  calls.length = 0
  await ui.press({ key: 'crab-agents' })
  await ui.drawn()
  await ui.unmount()
  expect(calls).toEqual(['close crab-agents', 'open crab-agents'])
})
// Control: the shown pane is closed on press (toggle works when it is in front).
test('CONTROL band ◈ closes Mission Control when it is the shown tab', async ($, on) => {
  const { calls } = base(on, {
    panes: [{ id: 'crab-agents', title: 'Mission Control', isShown: true, isFocused: false, isPlaced: true }],
  })
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band } as never)
  calls.length = 0
  await ui.press({ key: 'crab-agents' })
  await ui.drawn()
  await ui.unmount()
  expect(calls).toEqual(['close crab-agents'])
})
