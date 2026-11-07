import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { minMove, noteSample, planProgress, stopSignal } from './stopsignal'

// Stop Signal: money going out while the plan stalls asks once, again only after the plan moves.
const live = { cost: 0 }
const toasts: string[] = []
const base = (on: On) => {
  live.cost = 0
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
  on('ui.notify', async () => ({ value: { isSent: true } }) as never)
  on('prompt.suggest', async () => ({ isShown: true }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: live.cost } } }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.start', async () => ({ turnId: 'turn' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return clock
}
const PLAN = 'mcp__ccd_turn__update_plan'
const plan = ($: Engine, done: number) =>
  $.tool.call({ tool: PLAN, items: ['a', 'b', 'c', 'd', 'e'].map((content, i) => ({ content, status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending' })) } as never)
// One model request each 30 s, the session's cost going up $0.10 each: $0.20 a minute.
const work = async ($: Engine, clock: { advance: (ms: number) => Promise<unknown>; settle: () => Promise<unknown> }, secs: number) => {
  for (let s = 0; s < secs; s += 30) {
    live.cost += 0.1
    const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
    for await (const _ of stream) void _
    await clock.advance(30_000)
    await clock.settle()
  }
}
const stops = () => toasts.filter(t => t.includes('Stop signal'))
const report = async ($: Engine) => String(((await $.command.run({ command: 'tokens', args: '' } as never)) as { text?: string }).text)

test('stop signal: warns once when stalled, shows a tip, and not again the moment the plan moves', { timeoutMs: 20_000 }, async ($, on) => {
  const clock = base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.prompt.submit({ text: 'build it', cursor: 0 } as never)
  await plan($, 1)
  await work($, clock, 9 * 60)
  expect(stops()).toEqual([])
  await work($, clock, 3 * 60)
  expect(stops().length).toBe(1)
  expect(await report($)).toContain('Stop signal')
  await work($, clock, 5 * 60)
  expect(stops().length).toBe(1)
  // The plan moves between two samples: that is no reason to warn again.
  await clock.advance(10_000)
  await plan($, 2)
  await work($, clock, 2 * 60)
  expect(stops().length).toBe(1)
  expect(await report($)).not.toContain('Stop signal')
})

// The turn ends with the plan open (waiting on a background shell); 12 minutes on, the
// shell's notification starts a turn whose first request re-reads a cold cache.
test('stop signal: a pause is not stalled history (an idle gap, then a short costly burst)', async ($, on) => {
  const clock = base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.prompt.submit({ text: 'build it', cursor: 0 } as never)
  await plan($, 1)
  await work($, clock, 60)
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', turnId: 'turn' })
  await clock.advance(12 * 60_000)
  await clock.settle()
  await $.prompt.submit({ text: 'shell done', cursor: 0, origin: { kind: 'task-notification' } } as never)
  live.cost += 1.2
  await work($, clock, 90)
  expect(stops()).toEqual([])
})

test('stop signal logic: window, history, spend, long plans, and estimates', () => {
  const T = 1_000_000
  let s = noteSample([], { at: T, costUsd: 0, progress: 0.2, plan: 'p', steps: 5 })
  for (let i = 1; i <= 20; i++) s = noteSample(s, { at: T + i * 30_000, costUsd: i * 0.1, progress: 0.2, plan: 'p', steps: 5 })
  expect(stopSignal(s, T + 20 * 30_000)?.minutes).toBe(10)
  expect(stopSignal(s.slice(0, 19), T + 18 * 30_000)).toBe(null)
  expect(minMove(30)).toBeLessThan(1 / 30)
  // A running step with no reported progress counts nothing; a done one counts whole.
  expect(planProgress([{ state: 'done', progress: 1 }, { state: 'running', progress: null }])).toBe(0.5)
  expect(planProgress([{ state: 'running', progress: null }])).toBe(null)
})
