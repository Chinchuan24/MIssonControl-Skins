import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { BUSY_LIMIT, IDLE_LIMIT, LEAD_MS, isWarmDue, isWarmed, warmCall, warmLimitHit } from './warm'

// Smart Keep-Warm: the Token Manager refreshes the hour-long prompt cache shortly
// before it lapses, through one side request ($.model.fork), when that should save
// more than it costs.

const OPUS: readonly [number, number, number, number] = [4, 20, 0.2, 8]
const HOUR = 3_600_000

test('keep-warm: a big idle cache pays, a small idle one does not, a small busy one does', () => {
  expect(warmCall(OPUS, 500_000, false, 40).isWarm).toBe(true)
  const small = warmCall(OPUS, 20_000, false, 40)
  expect(small.isWarm).toBe(false)
  expect(small.reason).toMatch(/too small/)
  expect(warmCall(OPUS, 20_000, true, 40).isWarm).toBe(true)
})

test('keep-warm: a context about to be compacted is not warmed', () => {
  const full = warmCall(OPUS, 500_000, true, 90)
  expect(full.isWarm).toBe(false)
  expect(full.reason).toMatch(/compact/)
})

test('keep-warm: the refresh is due in the last minutes, not too early or too late', () => {
  const until = Date.parse('2026-10-21T11:00:00Z')
  expect(isWarmDue(until, until - LEAD_MS - 60_000)).toBe(false)
  expect(isWarmDue(until, until - LEAD_MS + 1)).toBe(true)
  expect(isWarmDue(until, until - 5_000)).toBe(false)
  expect(isWarmDue(null, until)).toBe(false)
})

test('keep-warm: a refresh that read under half the prefix found the cache gone', () => {
  expect(isWarmed(480_000, 500_000)).toBe(true)
  expect(isWarmed(3_000, 500_000)).toBe(false)
})

test('keep-warm: a busy session may refresh longer than an idle one', () => {
  expect(warmLimitHit(false, IDLE_LIMIT, 0)).toBe(true)
  expect(warmLimitHit(true, IDLE_LIMIT, 0)).toBe(false)
  expect(warmLimitHit(true, 0, BUSY_LIMIT)).toBe(true)
})

// ── In the session ───────────────────────────────────────────────────
const toasts: string[] = []
const forks: string[] = []
let forkRead = 500_000
const usage = { model: 'claude-opus-5-5', input_tokens: 20_000, output_tokens: 800, cache_read_input_tokens: 480_000, cache_creation_input_tokens: 0 }
const pane = { title: '', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200 } as never } as const

const base = (on: On) => {
  toasts.length = 0
  forks.length = 0
  forkRead = 500_000
  const clock = mock.clock(on, { now: Date.parse('2026-10-21T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, {})
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 500_000 }, rateLimits: [], cost: { usd: 1 } } }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.start', async (_$, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage } as never
  })
  on('model.fork', async (_$, e) => {
    forks.push(String((e as { prompt: string }).prompt))
    return { value: { isAnswered: true, text: 'ok', usage: { input_tokens: 10, output_tokens: 3, cache_read_input_tokens: forkRead, cache_creation_input_tokens: 0 } } } as never
  })
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const tokens = async ($: Engine, args = ''): Promise<string> => String(((await $.command.run({ command: 'tokens', args } as never)) as { text?: string }).text)
// One answered prompt of the main thread, with a 500k-token prompt behind it.
const turn = async ($: Engine) => {
  await $.prompt.submit({ text: 'refactor the parser', cursor: 0 } as never)
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ text: 'refactor the parser', turnId: 'turn' })
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _ of stream) void _
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ turnId: 'turn', reason: 'answer', answer: 'ok' })
}
const wait = async (clock: ReturnType<typeof base>, minutes: number) => {
  for (let i = 0; i < minutes; i++) await clock.advance(60_000)
  await clock.settle()
}
const bandSvg = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  const svg = (await ui.findAll({ type: 'Svg' })) as { props?: { source?: string } }[]
  await ui.unmount()
  return svg.map(s => String(s.props?.source ?? '')).join('\n')
}
void pane

test('keep-warm off (the default): no refresh goes out, the toast offers it', async ($, on) => {
  const clock = base(on)
  await start($)
  await turn($)
  await wait(clock, 56)
  expect(forks.length).toBe(0)
  expect(toasts.some(t => /Prompt cache expires in \d+ min · \/tokens warm on keeps it warm/.test(t))).toBe(true)
})

test('keep-warm on: one refresh before the hour runs out, and the cache counts from an hour again', async ($, on) => {
  const clock = base(on)
  await start($)
  expect(await tokens($, 'warm on')).toMatch(/Keep-warm on/)
  await turn($)
  await wait(clock, 56)
  expect(forks.length).toBe(1)
  expect(forks[0]).toMatch(/^\[mission-control keep-warm\]/)
  expect(toasts.some(t => /Cache kept warm .* saves ≈\$/.test(t))).toBe(true)
  // The refresh moved the cache's hour on: it is not about to expire.
  expect(await bandSvg($)).toMatch(/>(5\d|60) min</)
  expect(await tokens($)).toMatch(/Keep-warm on · 1 refresh · spent ≈\$[\d.]+ · saved ≈\$[\d.]+/)
})

test('keep-warm: a refresh that finds the cache gone pauses until the next prompt', async ($, on) => {
  const clock = base(on)
  await start($)
  await tokens($, 'warm on')
  await turn($)
  forkRead = 0
  await wait(clock, 56)
  expect(forks.length).toBe(1)
  expect(toasts.some(t => /the cache had lapsed/.test(t))).toBe(true)
  expect(await tokens($)).toMatch(/paused: the cache had already lapsed/)
  await wait(clock, 70)
  expect(forks.length).toBe(1)
  // A prompt clears the pause.
  forkRead = 500_000
  await turn($)
  await wait(clock, 56)
  expect(forks.length).toBe(2)
})

test('keep-warm idle: it stops after the idle limit, about four warm hours', async ($, on) => {
  const clock = base(on)
  await start($)
  await tokens($, 'warm on')
  await turn($)
  await wait(clock, (HOUR / 60_000) * (IDLE_LIMIT + 2))
  expect(forks.length).toBe(IDLE_LIMIT)
  expect(await tokens($)).toMatch(/paused: idle limit reached/)
})
