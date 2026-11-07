import { expect, test } from 'claude-code/testing'
import { MENT_EXTRA_CSS, cardGlyphs, hypnosis, mentSkyline, redJohnHeat, smileGlitch, teaSteam } from './mentalist-extra'
import { RED } from './mentalist'

const T = { accent: '#8DB4EA', accent2: '#DCE6F5', done: '#7FD1A0', warn: '#F2D98A', text: '#F2F5FA', subtext: '#93A0B5', muted: '#6B7890', tile: '#0E1524', track: '#1A2438', line: '#26324A' }
const TR = { ...T, accent: RED, accent2: '#F2F2F2', warn: '#E0A09A', text: '#F2F2F2', subtext: '#8C7A7A', muted: '#6E5A5A', tile: '#0B0708', line: '#3A1A1C' }
const LIMIT = 3000

// Every fragment the drawers make over a spread of sizes and states.
const frags = (): [string, string][] => {
  const out: [string, string][] = []
  for (const [W, H] of [[120, 14], [300, 24], [520, 40], [900, 60]] as const) {
    for (const [th, red] of [[T, false], [TR, true]] as const) {
      out.push([`skyline ${W}x${H} ${red ? 'red' : 'blue'}`, mentSkyline(W, H, th, red)])
      out.push([`glyphs ${W}x${H}`, cardGlyphs(W, H, 123456, th)])
    }
  }
  for (const at of [0, 1234, 9_999_999]) out.push([`hypnosis ${at}`, hypnosis(40, 12, T, at)])
  for (const lv of [-2, 0, 1, 3, 5, 9, Number.NaN]) out.push([`heat ${lv}`, redJohnHeat(10, 20, lv, TR)])
  out.push(['glitch', smileGlitch(10, 20, 'Fix the flaky <login> test & "retry"', 'font-size="12" font-weight="700" fill="#F2F5FA"', T)])
  out.push(['glitch mid', smileGlitch(100, 20, 'Short', 'font-size="14" text-anchor="middle" fill="#fff"', T)])
  out.push(['tea', teaSteam(6, 4, T)])
  return out
}

test('mentalist-extra: every fragment is balanced SVG with no undefined or NaN, under the size limit', async () => {
  for (const [name, svg] of frags()) {
    expect(svg.length > 20, `${name} is empty`).toBe(true)
    expect(svg, name).not.toContain('undefined')
    expect(svg, name).not.toContain('NaN')
    expect(svg, name).not.toContain('Infinity')
    expect((svg.match(/<g[\s>]/g) ?? []).length, `${name} <g> balance`).toBe((svg.match(/<\/g>/g) ?? []).length)
    expect((svg.match(/<text[\s>]/g) ?? []).length, `${name} <text> balance`).toBe((svg.match(/<\/text>/g) ?? []).length)
    expect(svg, name).not.toContain('<svg')
    expect(svg.length < LIMIT, `${name} is ${svg.length} chars`).toBe(true)
    // attribute quotes balance: an even number of double quotes
    expect((svg.match(/"/g) ?? []).length % 2, `${name} quotes`).toBe(0)
  }
})

test('mentalist-extra: the skyline has the bridge gold, Capitol and cars; Red John is red with a smiley and The Mentalist is not', async () => {
  const blue = mentSkyline(400, 28, T, false)
  const red = mentSkyline(400, 28, TR, true)
  expect(blue).toContain('#C9A227')
  expect(red).toContain('#C9A227')
  expect(red).toContain(RED)
  expect(red).toContain('#1A0507')
  expect(blue).not.toContain(RED)
  expect(blue).not.toContain('#1A0507')
  expect(blue).toContain('#111B33')
  expect(red).toContain('shape-rendering') // the pixel smiley
  expect(blue).not.toContain('shape-rendering')
  expect(blue).toContain('<rect x="21"') // the Airstream
  expect(mentSkyline(400, 28, T, false)).toBe(blue) // steady picture
})

test('mentalist-extra: heat lights one smiley per level, clamped to five, and flickers at five', async () => {
  const lit = (lv: number) => (redJohnHeat(0, 10, lv, T).match(/<path/g) ?? []).length
  const hollow = (lv: number) => (redJohnHeat(0, 10, lv, T).match(/<rect/g) ?? []).length
  expect(lit(0)).toBe(0)
  expect(hollow(0)).toBe(5)
  expect(lit(3)).toBe(3)
  expect(hollow(3)).toBe(2)
  expect(lit(99)).toBe(5)
  expect(lit(Number.NaN)).toBe(0)
  expect(redJohnHeat(0, 10, 5, T)).toContain('mx-heat')
  expect(redJohnHeat(0, 10, 4, T)).not.toContain('mx-heat')
})

test('mentalist-extra: the glitch keeps the title, escapes it, and swaps in a red smiley', async () => {
  const g = smileGlitch(10, 20, 'a <b> & c', 'font-size="12" fill="#fff"', T)
  expect(g).toContain('a &lt;b&gt; &amp; c')
  expect(g).not.toContain('<b>')
  expect(g).not.toContain('mx-ttl') // the title is never animated away
  expect(g).toContain('>a &lt;b&gt; &amp; c</text>')
  expect(g).toContain('mx-smile')
  expect(g).toContain(RED)
  // the red ghost copy carries no second fill
  const ghost = /<text class="mx-ghost"[^>]*>/.exec(g)?.[0] ?? ''
  expect((ghost.match(/fill="/g) ?? []).length).toBe(1)
})

test('mentalist-extra: the CSS switches off every mx- animation under prefers-reduced-motion', async () => {
  const at = MENT_EXTRA_CSS.indexOf('@media (prefers-reduced-motion: reduce)')
  expect(at > 0).toBe(true)
  const main = MENT_EXTRA_CSS.slice(0, at)
  const reduced = MENT_EXTRA_CSS.slice(at)
  const animated = [...main.matchAll(/\.(mx-[a-z0-9-]+)\{animation:/g)].map(m => m[1] as string)
  expect(animated.length >= 8).toBe(true)
  for (const c of animated) expect(reduced, `${c} in reduced-motion`).toContain(`.${c}`)
  expect(reduced).toContain('animation:none')
  // every keyframe is prefixed too, and no class outside the mx- family animates
  for (const k of main.matchAll(/@keyframes ([\w-]+)/g)) expect(k[1]).toMatch(/^mx-/)
  expect([...main.matchAll(/\.([\w-]+)\{animation:/g)].every(m => (m[1] as string).startsWith('mx-'))).toBe(true)
  expect(MENT_EXTRA_CSS).not.toContain('undefined')
})

test('mentalist-extra: every class the fragments use is defined in the CSS', async () => {
  const used = new Set<string>()
  for (const [, svg] of frags()) for (const m of svg.matchAll(/class="([^"]+)"/g)) for (const c of (m[1] as string).split(/\s+/)) used.add(c)
  expect(used.size >= 8).toBe(true)
  for (const c of used) {
    expect(c.startsWith('mx-'), `${c} is prefixed`).toBe(true)
    expect(MENT_EXTRA_CSS, `${c} defined`).toContain(`.${c}{`)
  }
})

test('mentalist-extra: the falling glyphs include suits, a coin and a cup, and carry on from `at`', async () => {
  const g = cardGlyphs(400, 40, 5000, T)
  for (const s of ['♠', '♥', '♦', '♣']) expect(g).toContain(s)
  expect(g).toContain('#C9A227') // coin
  expect(g).toContain('mx-coin')
  expect(cardGlyphs(400, 40, 5000, T)).toBe(g)
  expect(cardGlyphs(400, 40, 6000, T)).not.toBe(g)
  expect(cardGlyphs(Number.NaN, Number.NaN, Number.NaN, T)).not.toContain('NaN')
})
