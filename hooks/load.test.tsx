import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { compact } from './smooth'

// A heavy session, measured: about 60 sub-agents (most of them finished), background
// work, an active job, the desktop drawing both the band and the pane. Each second of
// the mocked clock counts the renders, the Svg sources the desktop must decode again,
// the writes, and the wall time spent. The budgets below fail a regression.

const PLUGIN = 'crab-progress'
const PANE = { title: '', isFocused: false, bodyColumns: 110, placement: 'dock', scroll: { offset: 0, bodyRows: 45 }, view: {} }
const BAND = { hasSurvey: false, isWorking: true, maxRows: 12, bodyColumns: 140 }
const T0 = Date.parse('2026-10-19T10:00:05Z')
const AGENTS = 60
const RUNNING = 14
const SECONDS = 30

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const alts = new Map<string, string>()
const churn: Record<string, number> = {}
const sources = (root: unknown): string[] => {
  const out: string[] = []
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk)
    if (!x || typeof x !== 'object') return
    const n = x as Node
    if (n.type === 'Svg') {
      out.push(String(n.props?.source ?? ''))
      alts.set(String(n.props?.source ?? ''), String(n.props?.alt ?? '').slice(0, 40))
    }
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return out
}

const count = { pane: 0, band: 0, usage: 0, writes: {} as Record<string, number> }
const reset = () => {
  count.pane = 0
  count.band = 0
  count.usage = 0
  count.writes = {}
}
const base = (on: On) => {
  reset()
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.start', async (_$, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('session.measure', async () => ({ changed: ['cost'] }) as never)
  on('classic.Stop', async () => ({}) as never)
  on('classic.SubagentStop', async () => ({}) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('session.usage', async () => {
    count.usage++
    return { value: { startedAt: 0, context: { window: 1_000_000, tokens: 400_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-19T12:30:00Z' }], cost: { usd: 31.25 } } } as never
  })
  on('turn.step', async function* (_$, e) {
    const { turnId, index } = e as { turnId: string; index: number }
    return { turnId, index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 } } as never
  })
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('state.set', async (_$, e, next) => {
    const key = String((e as { key?: string }).key)
    count.writes[key] = (count.writes[key] ?? 0) + 1
    return next(e)
  })
  // Only the desktop pane's render reads its tick: one read, one pane render.
  on('state.get', async (_$, e, next) => {
    if ((e as { key?: string }).key === 'paneTick') count.pane++
    return next(e)
  })
  on('ui.render', { component: 'AbovePrompt' }, async (_$, e, next) => {
    count.band++
    return next(e)
  })
  return clock
}

const BG = [
  { id: 'bsh001', type: 'shell', status: 'running', description: 'Dev server', command: 'npm run dev -- --port 5173' },
  { id: 'wf0001', type: 'workflow', status: 'running', description: 'Release check', name: 'release-check' },
  { id: 'mon001', type: 'monitor', status: 'pending', description: 'Watch the deploy', server: 'vercel', tool: 'watch' },
]

const heavy = async ($: Engine, clock: { advance: (ms: number) => Promise<unknown> }) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'Build the whole feature set', cursor: 0 } as never)
  await $.turn.start({ turnId: 'main', text: 'Build the whole feature set' } as never)
  for (let i = 0; i < AGENTS; i++) {
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: i % 3 ? 'mc-medium' : 'Explore', provider: 'engine', parentModel: 'x', background: i % 7 === 0, fork: false } as never)
    await clock.advance(200)
  }
  // Most of the crew is done; the newest few still work.
  for (let i = 1; i <= AGENTS - RUNNING; i++) await $.turn.complete({ agentId: `a${i}`, reason: 'answer', answer: 'ok' } as never)
  await $.classic.Stop({ stop_hook_active: false, background_tasks: BG, session_crons: [] } as never)
  for (let i = AGENTS - RUNNING + 1; i <= AGENTS; i++) await $.tool.call({ tool: 'mcp__crab-progress__step', done: 1, total: 5, agentId: `a${i}` } as never)
}

const mountBoth = async ($: Engine) => ({
  band: await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND } as never),
  pane: await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: PANE } as never),
})

type Second = { pane: number; band: number; svgNew: number; svgBytes: number; writes: number; ms: number; usage: number }
// Runs `each` once a second for `seconds`, measuring what each second costs.
const measure = async (
  clock: { advance: (ms: number) => Promise<unknown> },
  ui: { band: { drawn: () => Promise<unknown> }; pane: { drawn: () => Promise<unknown> } },
  seconds: number,
  each: (s: number) => Promise<void>,
) => {
  const drawnNow = async () => [...sources(await ui.band.drawn()), ...sources(await ui.pane.drawn())]
  let seen = new Set(await drawnNow())
  const out: Second[] = []
  const pinned: string[] = []
  const keys: Record<string, number> = {}
  for (let s = 0; s < seconds; s++) {
    reset()
    const t = Date.now()
    await each(s)
    await clock.advance(1_000)
    const ms = Date.now() - t
    const now = await drawnNow()
    const fresh = now.filter(x => !seen.has(x))
    for (const x of fresh) for (const bad of x.match(/(?:delay:|begin=")-?[\d.]+ss\b/g) ?? []) pinned.push(bad)
    for (const x of fresh) churn[alts.get(x) ?? '?'] = (churn[alts.get(x) ?? '?'] ?? 0) + x.length
    seen = new Set(now)
    const writes = Object.values(count.writes).reduce((a, b) => a + b, 0)
    for (const [k, v] of Object.entries(count.writes)) keys[k] = (keys[k] ?? 0) + v
    out.push({ pane: count.pane, band: count.band, svgNew: fresh.length, svgBytes: fresh.reduce((a, x) => a + x.length, 0), writes, ms, usage: count.usage })
  }
  const sum = (k: keyof Second) => out.reduce((a, x) => a + x[k], 0)
  const per = (k: keyof Second) => Math.round((sum(k) / seconds) * 10) / 10
  const max = (k: keyof Second) => Math.max(...out.map(x => x[k]))
  return { out, pinned, keys, per, max, total: (k: keyof Second) => sum(k), size: (await drawnNow()).reduce((a, x) => a + x.length, 0) }
}
const report = (name: string, m: Awaited<ReturnType<typeof measure>>) =>
  console.log(
    `[load] ${name}: per s pane=${m.per('pane')} band=${m.per('band')} svgNew=${m.per('svgNew')} svgBytes=${m.per('svgBytes')} (max ${m.max('svgBytes')}) writes=${m.per('writes')} usage=${m.per('usage')} ms=${m.per('ms')} (max ${m.max('ms')}); drawn ${m.size} B; writes by key ${JSON.stringify(m.keys)}`,
  )

test('load: 60 agents, the clock alone for 30 s re-sends next to nothing', async ($, on) => {
  const clock = base(on)
  await heavy($, clock)
  const ui = await mountBoth($)
  await clock.advance(3_000)
  const m = await measure(clock, ui, SECONDS, async () => undefined)
  report('clock only', m)
  await ui.band.unmount()
  await ui.pane.unmount()
  // A strip per minute at most: under half a redraw a second, a few kB a second.
  expect(m.per('pane')).toBeLessThanOrEqual(0.5)
  expect(m.per('band')).toBeLessThanOrEqual(0.5)
  expect(m.total('svgBytes') / SECONDS).toBeLessThanOrEqual(8_000)
  expect(m.per('ms')).toBeLessThanOrEqual(150)
})

// Every one of the 60 agents is drawn in a row of its own: slower than the 5-second
// default on a busy machine.
test('load: 60 agents at work for 30 s (steps, measures, tool calls) redraw at most a few times a second', { timeoutMs: 20_000 }, async ($, on) => {
  const clock = base(on)
  await heavy($, clock)
  const ui = await mountBoth($)
  await clock.advance(3_000)
  const running = Array.from({ length: RUNNING }, (_, i) => `a${AGENTS - RUNNING + 1 + i}`)
  const step = async (agentId: string, index: number) => {
    const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: `turn-${agentId}`, index, model: 'claude-opus-5-5', messageCount: 1, agentId })
    for await (const _ of stream) void _
  }
  const m = await measure(clock, ui, SECONDS, async s => {
    // Each second three sub-agent requests, a measure each, and one reported step.
    for (let k = 0; k < 3; k++) {
      await step(running[(s * 3 + k) % RUNNING] as string, s)
      await $.session.measure({ context: { window: 1_000_000, tokens: 400_000 }, rateLimits: [] } as never)
    }
    await $.tool.call({ tool: 'mcp__crab-progress__step', done: 1 + (s % 4), total: 5, agentId: running[s % RUNNING] } as never)
  })
  report('at work', m)
  // Baseline before the fixes (25 Oct): 93.7 kB/s re-sent, 6 usage reads a second, 211 kB drawn.
  console.log('[load] bytes re-sent by drawing:', JSON.stringify(Object.entries(churn).sort((a, b) => b[1] - a[1]).slice(0, 8)))
  await ui.band.unmount()
  await ui.pane.unmount()
  // The pictures change with the work (tokens, steps): each change costs its bytes, no more.
  expect(m.total('svgBytes') / SECONDS).toBeLessThanOrEqual(80_000)
  expect(m.size).toBeLessThanOrEqual(190_000)
  expect(m.per('pane')).toBeLessThanOrEqual(3)
  expect(m.per('band')).toBeLessThanOrEqual(3)
  // A measure pushed right after a step's own reading waits for the tick.
  expect(m.per('usage')).toBeLessThanOrEqual(4.5)
  expect(m.per('ms')).toBeLessThanOrEqual(400)
  // Pinned delays resolve to valid CSS and SMIL times ("-23s", never "-23ss").
  expect(m.pinned).toEqual([])
})

test('compact: the same picture in fewer bytes (dead rules out, one font named once)', () => {
  const F = "-apple-system,'SF Pro Text',sans-serif"
  const src = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><style>\n.t{fill:#111}.s{fill:#222}\n.ch g{transform-box:fill-box}\n.run .la,.ch .x{animation:st .5s infinite}\n@keyframes st{50%{opacity:.5}}\n@media (prefers-color-scheme: dark){.t{fill:#eee}.s{fill:#ddd}}\n</style><g class="run"><text class="t" font-family="${F}">a</text><text font-family="${F}" font-size="9">b</text></g></svg>`
  const out = compact(src)
  expect(out.length).toBeLessThan(src.length)
  // Used rules and every at-rule stay; a rule only for absent classes goes.
  expect(out).toContain('.t{fill:#111}')
  expect(out).not.toContain('.s{fill:#222}')
  expect(out).not.toContain('.ch g{')
  expect(out).toContain('.run .la,.ch .x{animation:st .5s infinite}')
  expect(out).toContain('@keyframes st{50%{opacity:.5}}')
  expect(out).toContain('@media (prefers-color-scheme: dark){.t{fill:#eee}.s{fill:#ddd}}')
  // The one font sits on the root, inherited by every text.
  expect(out.startsWith(`<svg font-family="${F}" xmlns=`)).toBe(true)
  expect(out.split('font-family=').length).toBe(2)
  // Two fonts: each text keeps its own.
  const two = src.replace(`<text font-family="${F}"`, '<text font-family="monospace"')
  expect(compact(two).split('font-family=').length).toBe(3)
})
