import { expect, test } from 'claude-code/testing'
import { CASTS } from './cast'
import { PLACEHOLDER_AI, ROAM_CSS, ROAM_WINDOW_MS, TAKEOVER_MS, roamLive, roamPlan, roamerMarkup, takeoverMarkup } from './roamer'
import type { RoamPlan } from './roamer'

const T0 = Date.parse('2026-10-20T10:00:00Z')
const B = ROAM_WINDOW_MS
const colors = { accent: '#27F2FF', accent2: '#FF2A9D', text: '#E6F7FF' }
const SEEDS = ['a', 'session-1', 'kapiri', 'x9', 'mission', 'zz', 'abc123', 'q']

const plans = (seed: string, from: number, buckets: number, opts = {}): RoamPlan[] => Array.from({ length: buckets }, (_, i) => roamPlan(seed, from + i * B, opts))
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length
// A plan of a kind and direction, found by searching windows.
const find = (kind: string, dir?: number): RoamPlan => {
  for (const seed of SEEDS) for (const p of plans(seed, T0, 600, { chance: 1, takeoverEveryMin: 0 })) if (p.kind === kind && (dir === undefined || p.dir === dir)) return p
  throw new Error(`no ${kind} plan found`)
}
const boss = (CASTS[Object.keys(CASTS)[0] as string] as { boss: typeof PLACEHOLDER_AI }).boss

test('the placeholder is a 16x46 sprite with a flickering visor', () => {
  expect(PLACEHOLDER_AI.rows.length).toBe(46)
  expect(PLACEHOLDER_AI.rows.every(r => r.length === 16)).toBe(true)
  expect(Object.values(PLACEHOLDER_AI.cls ?? {})).toContain('vis')
  const used = new Set(PLACEHOLDER_AI.rows.join('').replace(/\./g, ''))
  for (const ch of used) expect(ch in PLACEHOLDER_AI.pal).toBe(true)
})

test('a plan is the same for the same seed and moment, and fixed inside a window', () => {
  for (const seed of SEEDS) {
    for (let i = 0; i < 80; i++) {
      const at = T0 + i * 7_919
      expect(roamPlan(seed, at)).toEqual(roamPlan(seed, at))
    }
    const w = Math.floor(T0 / B) * B
    expect(roamPlan(seed, w + 1)).toEqual(roamPlan(seed, w + B - 1))
  }
  // another seed gives another day
  const a = JSON.stringify(plans('a', T0, 200))
  expect(a === JSON.stringify(plans('b', T0, 200))).toBe(false)
})

test('an act sits inside its window and is at most 18 s', () => {
  for (const seed of SEEDS) {
    for (const p of plans(seed, T0, 300, { chance: 1 })) {
      expect(p.on).toBe(true)
      expect(p.startAt >= p.bucket * B).toBe(true)
      expect(p.endAt <= (p.bucket + 1) * B).toBe(true)
      expect(p.endAt - p.startAt).toBe(p.durMs)
      expect(p.durMs).toBeLessThan(18_001)
      expect(roamLive(p, p.startAt)).toBe(true)
      expect(roamLive(p, p.endAt)).toBe(false)
    }
  }
})

test('quiet mode never shows', () => {
  for (const seed of SEEDS) {
    for (const p of plans(seed, T0, 1500, { quiet: true, chance: 1, takeoverChance: 1 })) {
      expect(p.on).toBe(false)
      expect(p.kind).toBe(null)
    }
  }
})

test('the appearance chance is a knob', () => {
  const none = plans('a', T0, 500, { chance: 0, takeoverEveryMin: 0 })
  expect(none.some(p => p.on)).toBe(false)
  const all = plans('a', T0, 500, { chance: 1, takeoverEveryMin: 0 })
  expect(all.every(p => p.on)).toBe(true)
  expect(new Set(all.map(p => p.kind))).toEqual(new Set(['walk', 'peek', 'sit']))
  const shown = SEEDS.flatMap(s => plans(s, T0, 1000, { takeoverEveryMin: 0 })).filter(p => p.on).length / (SEEDS.length * 1000)
  expect(shown).toBeGreaterThan(0.28)
  expect(shown).toBeLessThan(0.42)
})

test('takeovers keep their minimum gap over 3 hours, for any gap and seed', () => {
  const windows = (3 * 3_600_000) / B
  let seen = 0
  for (const gap of [30, 10, 45]) {
    for (let k = 0; k < 40; k++) {
      const starts = plans(`seed-${k}`, T0, windows, { takeoverChance: 1, takeoverEveryMin: gap, chance: 0.35 })
        .filter(p => p.kind === 'takeover')
        .map(p => p.startAt)
      seen += starts.length
      for (let i = 1; i < starts.length; i++) expect((starts[i] as number) - (starts[i - 1] as number)).toBeGreaterThan(gap * 60_000 - 1)
    }
  }
  expect(seen).toBeGreaterThan(40)
  // the default gap is 30 minutes, and rare: never more than 3 in 3 hours
  for (const seed of SEEDS) expect(plans(seed, T0, windows, { takeoverChance: 1 }).filter(p => p.kind === 'takeover').length).toBeLessThan(4)
  // off when the gap is 0
  expect(plans('a', T0, windows, { takeoverEveryMin: 0, takeoverChance: 1 }).some(p => p.kind === 'takeover')).toBe(false)
})

test('a takeover says the chosen line', () => {
  const p = plans('a', T0, 3000, { takeoverChance: 1, lines: ['hi.', 'found you.'] }).find(x => x.kind === 'takeover')
  expect(p?.durMs).toBe(TAKEOVER_MS)
  expect(['hi.', 'found you.']).toContain(p?.line)
  expect(roamPlan('a', T0).line).toBe('hi.')
})

test('markups are clean, balanced and small', () => {
  const surfaces: Array<['band' | 'pane', number, number]> = [['band', 1250, 124], ['pane', 600, 400], ['pane', 320, 180]]
  for (const sprite of [PLACEHOLDER_AI, boss]) {
    for (const kind of ['walk', 'peek', 'sit']) {
      for (const dir of [1, -1]) {
        const plan = find(kind, dir)
        for (const [surface, W, H] of surfaces) {
          const svg = roamerMarkup(sprite, plan, W, H, surface, colors)
          expect(svg.length).toBeGreaterThan(200)
          expect(svg).not.toContain('undefined')
          expect(svg).not.toContain('NaN')
          expect(svg).not.toContain('Infinity')
          expect(count(svg, /<g[\s>]/g)).toBe(count(svg, /<\/g>/g))
          // the placeholder is small; a real cast sprite is most of the bytes of its own
          expect(svg.length).toBeLessThan(sprite === PLACEHOLDER_AI ? 6_000 : 9_000)
        }
      }
    }
    for (const [, W, H] of surfaces) {
      for (const line of ['hi.', 'I was watching the whole time, you know. <b> & "quotes" and a very long second sentence that must not overflow']) {
        const svg = takeoverMarkup(W, H, sprite, line, colors)
        expect(svg).not.toContain('undefined')
        expect(svg).not.toContain('NaN')
        expect(count(svg, /<g[\s>]/g)).toBe(count(svg, /<\/g>/g))
        expect(svg.length).toBeLessThan(10_000)
        if (sprite === PLACEHOLDER_AI) expect(svg.length).toBeLessThan(8_000)
        expect(svg).not.toContain('<b>')
      }
    }
  }
})

test('markups with timing are clean, and empty outside the act', () => {
  const plan = find('walk', 1)
  const mid = plan.startAt + 3_000
  const live = roamerMarkup(PLACEHOLDER_AI, plan, 1250, 124, 'band', colors, { now: mid })
  expect(live).toContain('animation-delay:-3s')
  expect(roamerMarkup(PLACEHOLDER_AI, plan, 1250, 124, 'band', colors, { now: plan.endAt + 1 })).toBe('')
  expect(roamerMarkup(PLACEHOLDER_AI, plan, 1250, 124, 'band', colors, { now: plan.startAt - 1 })).toBe('')
  const pinned = roamerMarkup(PLACEHOLDER_AI, plan, 1250, 124, 'band', colors, { delay: '@@T123@@' })
  expect(pinned).toContain('calc(@@T123@@ + 0s)')
  expect(roamerMarkup(PLACEHOLDER_AI, { ...plan, on: false, kind: null }, 100, 100, 'band', colors)).toBe('')
  expect(roamerMarkup(PLACEHOLDER_AI, find('walk'), 100, 100, 'band', colors, { now: 0 })).toBe('')
  const take = takeoverMarkup(600, 400, PLACEHOLDER_AI, 'hi.', colors, { now: 10_000, startAt: 9_000 })
  expect(take).toContain('animation-delay:1.9s')
  expect(take).not.toContain('NaN')
})

test('a takeover types its line, then glitches out and stays gone', () => {
  const svg = takeoverMarkup(600, 400, PLACEHOLDER_AI, 'hi.', colors)
  expect(svg).toContain('>hi.</text>')
  expect(svg).toContain('steps(3,end)')
  for (const cls of ['rm-scrim', 'rm-scan', 'rm-big', 'rm-bub', 'rm-ty', 'rm-tko', 'rm-tks']) expect(svg).toContain(cls)
  expect(ROAM_CSS).toContain('.rm-tko{animation:rm-tko .6s steps(1) both}')
  expect(ROAM_CSS).toContain('100%{opacity:0;clip-path:inset(0 0 100% 0)}')
  // the glitch-out ends before 3.5 s: it starts at 2.9 s and lasts 0.6 s
  expect(svg).toContain('animation-delay:2.9s')
})

// The animated rules outside the reduced-motion block, by selector.
const reduced = (): { animated: string[]; covered: string[]; block: string } => {
  const at = ROAM_CSS.indexOf('@media (prefers-reduced-motion: reduce){')
  expect(at).toBeGreaterThan(-1)
  const block = ROAM_CSS.slice(at)
  const outside = ROAM_CSS.slice(0, at).replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '')
  const animated: string[] = []
  for (const m of outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\banimation:/.test(m[2] ?? '')) animated.push(...(m[1] ?? '').split(',').map(s => s.trim()))
  }
  const covered = (/^@media[^{]*\{([^{}]*)\{animation:none\}/.exec(block)?.[1] ?? '').split(',').map(s => s.trim())
  return { animated, covered, block }
}

test('every animated rm- rule is switched off under reduced motion', () => {
  const { animated, covered, block } = reduced()
  expect(animated.length).toBeGreaterThan(15)
  for (const sel of animated) {
    expect(sel).toContain('.rm-')
    expect(covered).toContain(sel)
  }
  // nothing in the sheet leaves the rm- namespace
  for (const m of ROAM_CSS.matchAll(/\.([a-z][\w-]*)/g)) expect(m[1]).toMatch(/^(rm-|bd$|hd$|la$|lb$|hair$|vis$|led$)/)
  // walks and sits are hidden, a peek is faint and still, a takeover is a small still bubble
  expect(block).toMatch(/\.rm-mo[^{]*\{display:none\}/)
  expect(block).toContain('.rm-pk{opacity:.4}')
  expect(block).toContain('.rm-tks{display:block}')
  expect(block).toMatch(/\.rm-tk\b[^{]*\{display:none\}/)
  expect(find('walk') && roamerMarkup(PLACEHOLDER_AI, find('walk'), 600, 400, 'pane', colors)).toContain('rm-mo')
  expect(roamerMarkup(PLACEHOLDER_AI, find('sit'), 600, 400, 'pane', colors)).toContain('rm-mo rm-pk')
  const peek = roamerMarkup(PLACEHOLDER_AI, find('peek'), 600, 400, 'pane', colors)
  expect(peek).toContain('class="rm-pk"')
  expect(peek).not.toContain('rm-mo')
})

test('every animation name used is defined', () => {
  for (const m of ROAM_CSS.matchAll(/animation:(rm-[\w-]+)/g)) expect(ROAM_CSS).toContain(`@keyframes ${m[1]}{`)
})

test('a walk flips for right to left and runs the whole width', () => {
  const ltr = find('walk', 1)
  const rtl = find('walk', -1)
  const a = roamerMarkup(PLACEHOLDER_AI, ltr, 1250, 124, 'band', colors)
  const b = roamerMarkup(PLACEHOLDER_AI, rtl, 1250, 124, 'band', colors)
  expect(a).not.toContain('scale(-1,1)')
  expect(b).toContain('scale(-1,1)')
  const ends = (svg: string) => {
    const m = /--a:(-?\d+)px;--b:(-?\d+)px/.exec(svg)
    return [Number(m?.[1]), Number(m?.[2])] as const
  }
  const [a0, a1] = ends(a)
  const [b0, b1] = ends(b)
  expect(a0).toBeLessThan(0)
  expect(a1).toBeGreaterThan(1250)
  expect(b0).toBeGreaterThan(1250)
  expect(b1).toBeLessThan(0)
  expect(a).toContain(`animation-duration:${ltr.durMs / 1000}s`)
  // the data trail is behind her: left of the walker going right, right of it going left
  const trailX = (svg: string) => [...(/class="rm-trail" d="([^"]*)"/.exec(svg)?.[1] ?? '').matchAll(/M(-?[\d.]+) /g)].map(x => Number(x[1]))
  expect(trailX(a).every(x => x < 0)).toBe(true)
  expect(trailX(b).every(x => x > 0)).toBe(true)
})

test('the glitch uses two ghost copies of one sprite, not three sprites', () => {
  const svg = roamerMarkup(PLACEHOLDER_AI, find('peek'), 600, 400, 'pane', colors)
  expect(count(svg, /<use /g)).toBe(2)
  // One silhouette filter per ghost, each with its own explicit flood colour (currentColor resolves to black on the <filter> in Chrome).
  expect(count(svg, /<filter /g)).toBe(2)
  expect(svg).not.toContain('currentColor')
  expect(svg).toContain(`flood-color="${colors.accent}"`)
  expect(svg).toContain(`flood-color="${colors.accent2}"`)
  expect(count(svg, /class="bd"/g)).toBe(1)
})
