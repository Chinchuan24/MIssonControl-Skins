import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { LIVE_N, liveText, phased, steady } from './smooth'

// The desktop draws each Svg as an image from its source: a new source is decoded
// again and its animations start over. These hold the drawings still while what
// they show holds, and keep the motion going when it changes.

const PLUGIN = 'crab-progress'
const PANE = { title: '', isFocused: false, bodyColumns: 110, placement: 'dock', scroll: { offset: 0, bodyRows: 45 }, view: {} }
const BAND = { hasSurvey: false, isWorking: true, maxRows: 12, bodyColumns: 140 }
const T0 = Date.parse('2026-10-19T10:00:05Z')

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const svgs = (root: unknown) => {
  const out: { alt: string; source: string; height: number }[] = []
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk)
    if (!x || typeof x !== 'object') return
    const n = x as Node
    if (n.type === 'Svg') out.push({ alt: String(n.props?.alt ?? ''), source: String(n.props?.source ?? ''), height: Number(n.props?.height) || 0 })
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return out
}

const writes: Record<string, number> = {}
const reset = () => {
  for (const k of Object.keys(writes)) delete writes[k]
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
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('session.usage', async () =>
    ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-19T12:30:00Z' }], cost: { usd: 1.25 } } }) as never,
  )
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('state.set', async (_$, e, next) => {
    const key = String((e as { key?: string }).key)
    writes[key] = (writes[key] ?? 0) + 1
    return next(e)
  })
  return clock
}
const crew = async ($: Engine) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'Build the feature', cursor: 0 } as never)
  for (let i = 0; i < 3; i++)
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: i ? 'mc-medium' : 'Explore', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
}
const mountBoth = async ($: Engine) => ({
  band: await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND } as never),
  pane: await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: PANE } as never),
})
// The delay the source gives its first endless animation of `name`, in seconds.
const delayOf = (source: string, name: string): number => {
  const m = new RegExp(`animation:${name} [\\d.]+s [^;}]*infinite (-?[\\d.]+)s`).exec(source)
  return m ? Number(m[1]) : NaN
}

test('phased: an endless animation keeps its phase across new images; one that ends plays from its start', () => {
  const content = `<svg><style>.a{animation:a 1.6s ease-in-out infinite}.b{animation:b .5s steps(1) infinite -.25s}.c{animation:c 1s both}</style><g style="animation-delay:-.6s"/><rect><animate attributeName="x" dur="1.8s" repeatCount="indefinite"/></rect><circle><animateMotion dur="1.4s" begin="-0.3s" repeatCount="indefinite" path="M0 0"/></circle><rect><animate attributeName="width" dur=".4s" fill="freeze"/></rect></svg>`
  const at1 = T0 + 12_345
  const at2 = T0 + 73_210
  const one = phased(content, at1)
  const two = phased(content, at2)
  // Seen at any wall time, the two images stand at the same point of every loop.
  const same = (d1: number, d2: number) => expect(Math.abs(d1 + at1 / 1000 - (d2 + at2 / 1000))).toBeLessThan(0.002)
  same(delayOf(one, 'a'), delayOf(two, 'a'))
  same(delayOf(one, 'b'), delayOf(two, 'b'))
  // The delays are negative: a new image starts mid-loop, never from zero.
  expect(delayOf(two, 'a')).toBeLessThan(0)
  expect(Math.abs(delayOf(two, 'b') - delayOf(two, 'a') + 0.25)).toBeLessThan(0.002)
  const longhand = (s: string) => Number(/animation-delay:(-?[\d.]+)s/.exec(s)?.[1])
  same(longhand(one), longhand(two))
  const begins = (s: string) => [...s.matchAll(/repeatCount="indefinite"|begin="(-?[\d.]+)s"/g)].flatMap(m => (m[1] ? [Number(m[1])] : []))
  const [b1, m1] = begins(one)
  const [b2, m2] = begins(two)
  same(b1 as number, b2 as number)
  same(m1 as number, m2 as number)
  expect(Math.abs((m2 as number) - (b2 as number) + 0.3)).toBeLessThan(0.002)
  // An entrance and a one-shot glide are left to play from their own start.
  expect(two).toContain('.c{animation:c 1s both}')
  expect(two).toContain('<animate attributeName="width" dur=".4s" fill="freeze"/>')
})

test('steady: the same content keeps the very same source; a bar glides from its last width', () => {
  const card = (w: number) => `<svg><style>.p{animation:p 1.6s infinite}</style><rect width="${w}">@@Gbar:${w}@@</rect></svg>`
  const first = steady('t:card', card(40), T0)
  // Later, the same content: not a new image (no decode, no restart).
  expect(steady('t:card', card(40), T0 + 17_000)).toBe(first)
  expect(first).not.toContain('@@')
  expect(first).not.toContain('<animate')
  const grown = steady('t:card', card(90), T0 + 30_000)
  expect(grown).toContain('<animate attributeName="width" from="40" to="90"')
  expect(grown).not.toContain('@@')
  // Drawn again unchanged, it does not glide again.
  expect(steady('t:card', card(90), T0 + 31_000)).toBe(grown)
})

test('liveText: one strip a minute, standing on the right second when it is drawn', () => {
  const clock = (t: number) => `0:${String(Math.floor((t - T0) / 1000) % 60).padStart(2, '0')}`
  const a = liveText(10, 20, T0 + 1_000, 12, 'class="t"', clock)
  expect(liveText(10, 20, T0 + 40_000, 12, 'class="t"', clock)).toBe(a)
  expect(liveText(10, 20, T0 + 61_000, 12, 'class="t"', clock)).not.toBe(a)
  expect([...a.matchAll(/<text /g)].length).toBe(LIVE_N)
  // Resolved at the draw, the strip's delay puts the drawn second in view.
  const at = T0 + 31_400
  const src = phased(a, at)
  const delay = Number(/animation-delay:(-?[\d.]+)s/.exec(src)?.[1])
  const shown = Math.floor(-delay)
  const lines = [...src.matchAll(/<text y="\d+">([^<]*)<\/text>/g)].map(m => m[1])
  expect(lines[shown]).toBe(clock(at))
})

test('ticks: a crew at work for ten seconds draws nothing new: no tick writes, the same sources, the same heights', async ($, on) => {
  const clock = base(on)
  await crew($)
  const { band, pane } = await mountBoth($)
  await clock.advance(2_000) // the first tick takes its readings and the budgets are set
  const before = { band: svgs(await band.drawn()), pane: svgs(await pane.drawn()) }
  reset()
  for (let s = 0; s < 8; s++) {
    await clock.advance(1_000)
    const now = { band: svgs(await band.drawn()), pane: svgs(await pane.drawn()) }
    expect(now.band.map(x => x.source)).toEqual(before.band.map(x => x.source))
    expect(now.pane.map(x => x.source)).toEqual(before.pane.map(x => x.source))
    expect(now.pane.map(x => x.height)).toEqual(before.pane.map(x => x.height))
    expect(now.band.map(x => x.height)).toEqual(before.band.map(x => x.height))
  }
  await band.unmount()
  await pane.unmount()
  // `now` still ticks for the terminal; nothing the desktop reads was written.
  expect(writes.bandTick ?? 0).toBe(0)
  expect(writes.paneTick ?? 0).toBe(0)
  expect(Object.keys(writes).filter(k => k !== 'now')).toEqual([])
  // The clocks tick inside the images: the cards hold a strip of the minute's seconds.
  const manager = before.pane.find(x => x.alt.startsWith('Manager:'))
  expect(manager?.source).toMatch(/<text y="\d+">0:0\d \/ 60m<\/text>/)
})

test('ticks: a minute of work moves each desktop tick about once (a strip per minute), not sixty times', async ($, on) => {
  const clock = base(on)
  await crew($)
  await clock.advance(2_000)
  reset()
  await clock.advance(60_000)
  // The wall minute's new strips, and the limit's "Resets in" label: that is all.
  expect(writes.paneTick ?? 0).toBeLessThanOrEqual(2)
  expect(writes.bandTick ?? 0).toBeLessThanOrEqual(2)
  expect(writes.now ?? 0).toBeGreaterThanOrEqual(59) // the terminal still ticks
})

test('ticks: idle, the band never ticks and the pane only for its minute labels', async ($, on) => {
  const clock = base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(6_000) // at rest the readings are taken every few seconds
  reset()
  await clock.advance(120_000)
  expect(writes.bandTick ?? 0).toBe(0)
  expect(writes.paneTick ?? 0).toBeLessThanOrEqual(4)
})

test('phase: a card drawn again carries on its animations instead of restarting them', async ($, on) => {
  const clock = base(on)
  await crew($)
  const { pane } = await mountBoth($)
  await clock.advance(2_000)
  const card = async () => (svgs(await pane.drawn()).find(x => x.alt.startsWith('Engineer: piece 1')) as { source: string }).source
  // Something the card shows changes: a new image, phased to the time it is drawn.
  await $.tool.call({ tool: 'mcp__crab-progress__step', done: 1, total: 4, agentId: 'a2' } as never)
  const first = await card()
  const at1 = clock.now()
  await clock.advance(7_300)
  await $.tool.call({ tool: 'mcp__crab-progress__step', done: 2, total: 4, agentId: 'a2' } as never)
  const second = await card()
  const at2 = clock.now()
  await pane.unmount()
  expect(second).not.toBe(first)
  const d1 = delayOf(first, 'p')
  const d2 = delayOf(second, 'p')
  expect(d2).toBeLessThan(0)
  // 7.3 s later, 7.3 s further into every loop: the pulse goes on where it was.
  expect(Math.abs(d1 + at1 / 1000 - (d2 + at2 / 1000))).toBeLessThan(0.002)
  // The reported share glides in from where the bar stood.
  expect(second).toMatch(/<animate attributeName="width" from="[\d.]+" to="[\d.]+"/)
})

test('writes: equal session readings are not written', async ($, on) => {
  base(on)
  await crew($)
  const step = async () => {
    const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
    for await (const _ of stream) void _
  }
  await step()
  reset()
  await step()
  // The step's own token count is one write; the unchanged readings add none.
  expect(writes.env ?? 0).toBe(1)
})
