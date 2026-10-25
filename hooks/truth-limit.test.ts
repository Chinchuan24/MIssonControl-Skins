import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro: the engine's session.usage().rateLimits is "the windows the LAST API
// response reported" (index.d.ts SessionUsage.rateLimits), so with no new reply it keeps
// returning the pre-reset reading. The mod has resetsAt and the clock; does it notice?
type Limit = { kind: string; percentUsed: number; resetsAt?: string }
let limits: Limit[] = []
let usageCalls = 0
const pane = { title: '', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200 } as never } as const

const base = (on: On) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, {})
  usageCalls = 0
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => { usageCalls++; return { value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: limits, cost: { usd: 0.3 } } } as never })
  on('session.messages', async () => ({ value: [] }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.start', async () => ({ turnId: 'turn' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return clock
}
const paneText = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const bandSvg = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const svg = (await ui.findAll({ type: 'Svg' })) as { props?: { source?: string } }[]
  await ui.unmount()
  return svg.map(s => String(s.props?.source ?? '')).join('\n')
}

test('limit reset: pane, /tokens and band after the five-hour window resets with no new reply', async ($, on) => {
  const clock = base(on)
  limits = [{ kind: 'five_hour', percentUsed: 96, resetsAt: '2026-10-19T11:00:00Z' }]
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.prompt.submit({ text: 'quick one', cursor: 0 } as never)
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ text: '', turnId: 'turn' })
  for await (const _ of ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) void _
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok' })
  const before = await paneText($)
  const bandBefore = await bandSvg($)
  // Wait out the window: 12:00, an hour past the reset. No reply, so the engine's reading is the last one.
  await clock.advance(2 * 3600_000)
  await clock.settle()
  const callsBefore = usageCalls
  const after = await paneText($)
  const report = String(((await $.command.run({ command: 'tokens', args: '' } as never)) as { text?: string }).text)
  const bandAfter = await bandSvg($)
  expect(after).not.toContain('Session limit at 96%')
  expect(after).not.toMatch(/Session limit .*96%/)
  expect(report).not.toContain('Session limit at 96%')
  expect(bandAfter).not.toMatch(/>96%</)
})
