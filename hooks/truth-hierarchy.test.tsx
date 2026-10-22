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

// Independent repro: prompt 1 starts a background Researcher, prompt 2 starts a Writer.
test('Hierarchy keeps the carried background agent (Researcher) next to the new Writer', async ($, on) => {
  const { clock } = base(on)
  await start($)
  await ask($, 'build the launch video')
  await spawn($, 1, 'general-purpose', 'Researcher: launch videos', { background: true })
  await $.turn.complete({ reason: 'answer', answer: 'started the researcher in the background' } as never)
  await clock.advance(60_000)
  await ask($, 'meanwhile, fix the typo in the copy')
  await spawn($, 2, 'general-purpose', 'Writer: copy')
  const alts = (await desktopSvgs($)).map(s => s.alt)
  expect(alts.some(a => a.includes('launch videos'))).toBe(true)
  const h = alts.find(a => a.startsWith('Hierarchy:')) ?? ''
  expect(h).toContain('Researcher')
})

// Variant: no new agent in prompt 2 -> fallback slice(-12) includes finished agents from long ago.
test('Hierarchy with no new agent leaves out old finished agents', async ($, on) => {
  const { clock } = base(on)
  await start($)
  await ask($, 'review the PR')
  await spawn($, 1, 'Explore', 'Old finished explorer')
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'mapped' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'ok' } as never)
  await clock.advance(10 * 60_000)
  await ask($, 'what is 2+2')
  const alts = (await desktopSvgs($)).map(s => s.alt)
  // The hierarchy is this request's crew: no agent from the job before.
  expect(alts.find(a => a.startsWith('Hierarchy:'))).toBe('Hierarchy: Manager, then Token Manager (0)')
})
