// Cyberpunk: Edgerunners 2, v2 "D's optics" (fan homage; the hidden CAPRICORN skin shares everything here).
// A next-gen netrunner HUD on layered holographic glass: chamfered panes with 1 px gradient frames, a top
// sheen and a parallax ghost, one beam travelling the frame, a beam gauge with a white-hot tip, a LINK hex
// stream. D's cobalt and cool white are the city layer; hot pink and acid green are Capri's and show only when
// she is near (95%+ context, a roam, a takeover) or in CAPRICORN, where she owns the HUD.
// The band's pieces, the takeover and the pixel helpers live here; the pane's cards are in edgerunners2-cards.ts.
// Pure SVG strings, no `$`, no state. Every "random" streak and speck comes from a seed, so a redraw gives the
// same picture.
//
// Capri is NEVER drawn with vector paths: every Capri is one of the pixel sprites in cast.ts (ER_CAPRI roams,
// ER_CAPRI_BUST is the Neural Sync capsule and the name patch, ER_CAPRI_BIG is the takeover). Holo effects frame
// them (scan glow, slices, rings, a trail); they never replace them. Her boxed eye is an icon of her mark.
//
// A fan homage to Cyberpunk: Edgerunners (CD PROJEKT RED / Studio Trigger / Netflix). Only episode titles,
// short phrases and original drawing; no logos, no spoilers.
import { ER_CAPRI, ER_CAPRI_BIG, ER_CAPRI_BUST, ER_D, ER_RUNNER, ER_RUNNER2, ER_RUNNER3, hashOf } from './cast'
import type { Sprite } from './cast'
import type { RoamPlan, RoamTiming } from './roamer'

// --- tokens ----------------------------------------------------------------------
/** The city layer (D's HUD) and the secret skin (Capri owns it). */
export type Pal = { tile: string; tile2: string; line: string; track: string; a: string; aT: string; ice: string; text: string; sub: string; muted: string; done: string; warn: string; alert: string }
export const CITY: Pal = { tile: '#070A12', tile2: '#0C1622', line: '#1C2740', track: '#131B2E', a: '#3E80F7', aT: '#8FB5FF', ice: '#BFD8FF', text: '#EAF2FF', sub: '#AEBDD6', muted: '#7A8AA8', done: '#5EE3C0', warn: '#FFB547', alert: '#FF3D71' }
export const CAPRICORN: Pal = { tile: '#0C0410', tile2: '#180818', line: '#2E1430', track: '#20101F', a: '#FF2E7E', aT: '#3DF27A', ice: '#FFD6E6', text: '#FFF0F6', sub: '#E0B8CC', muted: '#9A7A90', done: '#3DF27A', warn: '#FFB547', alert: '#FF2E7E' }
/** Capri only. Never used for ordinary UI in the city layer. */
export const K = { hot: '#FF2E7E', pink: '#FF6AD0', red: '#FC1444', green: '#3DF27A', eye: '#2F6BFF', white: '#F7F4EA', black: '#050305' }
export const palOf = (sec: boolean): Pal => (sec ? CAPRICORN : CITY)
export const ER2_FONT = "'Avenir Next Condensed','Roboto Condensed','Arial Narrow',Bahnschrift,sans-serif"
export const MONO = "'SF Mono',Menlo,Consolas,monospace"
/** Band pieces carry their own face: the band's root sets none. */
const ff = (svg: string): string => `<g font-family="${ER2_FONT}">${svg}</g>`
export const CJK = "'Hiragino Sans','Hiragino Kaku Gothic ProN','PingFang SC','Yu Gothic UI','Noto Sans CJK JP',sans-serif"

export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const r1 = (n: number): number => +(+n).toFixed(1)
export const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n))
export const hash = (s: string): number => hashOf(String(s))
/** A stable id for a def: the same drawing always gets the same one, so a redraw gives the same source. */
export const did = (p: string, ...a: (string | number | boolean | undefined)[]): string => `${p}${hash(a.join('|')) % 1_000_000}`

// A small seeded generator (mulberry32).
export const rng = (seed: string): (() => number) => {
  let a = hash(seed) || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- text widths (Avenir Next Condensed, measured in Chrome) -----------------------
// em per glyph at weights 500 / 700 / 800: caps, lower, digits, space. Add the letter-spacing per glyph.
const RATIO: Record<number, [number, number, number, number]> = { 500: [0.493, 0.409, 0.482, 0.19], 700: [0.535, 0.463, 0.525, 0.2], 800: [0.571, 0.497, 0.56, 0.2] }
export const er2W = (s: string, size: number, ls = 0, weight = 700): number => {
  const [caps, low, dig, sp] = RATIO[weight >= 800 ? 800 : weight >= 600 ? 700 : 500] as [number, number, number, number]
  let w = 0
  for (const ch of String(s)) {
    let em: number
    if (ch === ' ') em = sp
    else if (/[MW]/.test(ch)) em = caps * 1.3
    else if (/[A-Z]/.test(ch)) em = ch === 'I' ? caps * 0.55 : caps
    else if (/[mw]/.test(ch)) em = low * 1.35
    else if (/[il]/.test(ch)) em = low * 0.55
    else if (/[jtfr]/.test(ch)) em = low * 0.78
    else if (/[a-z]/.test(ch)) em = low
    else if (/[0-9]/.test(ch)) em = ch === '1' ? dig * 0.8 : dig
    else if (/[.,:;'’|!]/.test(ch)) em = 0.25
    else if (/[-–—/()[\]·•]/.test(ch)) em = 0.32
    else if (/[%@&]/.test(ch)) em = caps * 1.5
    else if (/[+=<>?]/.test(ch)) em = 0.55
    else em = ch.charCodeAt(0) < 128 ? low : 0.9
    w += em * size + ls
  }
  return w
}
export const er2Clip = (s: string, size: number, maxW: number, ls = 0, weight = 700): string => {
  if (er2W(s, size, ls, weight) <= maxW) return s
  const a = [...s]
  while (a.length > 1 && er2W(`${a.join('')}…`, size, ls, weight) > maxW) a.pop()
  return `${a.join('').trimEnd()}…`
}
export const er2Wrap = (s: string, size: number, maxW: number, max = 3, weight = 500): string[] => {
  const out: string[] = []
  let cur = ''
  for (const w of String(s).split(/\s+/)) {
    const n = cur ? `${cur} ${w}` : w
    if (er2W(n, size, 0, weight) <= maxW) cur = n
    else {
      if (cur) out.push(cur)
      cur = w
    }
    if (out.length === max) break
  }
  if (cur && out.length < max) out.push(cur)
  if (out.length === max && out.join(' ').length < s.length) out[max - 1] = er2Clip(`${out[max - 1]} …`, size, maxW, 0, weight)
  return out
}
export const T = (x: number, y: number, s: string, size: number, weight: number, fill: string, extra = ''): string =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(s)}</text>`


export const mw = (s: string, size: number, ls = 0): number => [...String(s)].length * (0.602 * size + ls)
export const M = (x: number, y: number, s: string, size: number, fill: string, extra = ''): string =>
  `<text x="${r1(x)}" y="${r1(y)}" font-family="${MONO}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`
/** `#rrggbb` as rgba(). */
export const lift = (hex: string, a: number): string => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r},${g},${b},${a})`
}
/** A chamfer path: cut `c1` at the top-left and bottom-right corners, `c2` at the other two (the HUD's asymmetric cut). */
export const cham = (x: number, y: number, w: number, h: number, c1 = 6, c2 = 2): string =>
  `M${r1(x + c1)} ${r1(y)}H${r1(x + w - c2)}L${r1(x + w)} ${r1(y + c2)}V${r1(y + h - c1)}L${r1(x + w - c1)} ${r1(y + h)}H${r1(x + c2)}L${r1(x)} ${r1(y + h - c2)}V${r1(y + c1)}Z`

// --- motion: every animation has a reduced-motion fallback ----------------------------
export const ER2_CSS = `.v2-led{animation:v2led 1.4s steps(1) infinite}@keyframes v2led{50%{opacity:.25}}
.v2-rec{animation:v2led 1.2s steps(1) infinite}
.v2-vis{animation:v2vis 2.4s ease-in-out infinite}@keyframes v2vis{50%{opacity:.45}}
.v2-blink{animation:v2blink 4.2s steps(1) infinite}@keyframes v2blink{0%,92%,100%{opacity:1}94%{opacity:.1}}
.v2-beam{animation:v2beam 7s linear infinite}@keyframes v2beam{to{stroke-dashoffset:-1000}}
.v2-rail{animation:v2rail 3.2s linear infinite}@keyframes v2rail{to{stroke-dashoffset:-220}}
.v2-sweep{animation:v2sweep 8s linear infinite}@keyframes v2sweep{from{transform:translateY(0)}to{transform:translateY(var(--h))}}
.v2-bx{animation:v2bx 3s steps(6) infinite}@keyframes v2bx{to{transform:translateX(78px)}}
.v2-chrom{animation:v2chrom 4.2s steps(1) infinite}@keyframes v2chrom{0%,86%,100%{opacity:0}88%{opacity:.9}90%{opacity:.5}93%{opacity:.9}96%{opacity:0}}
.v2-streak{animation:v2streak 2.8s steps(1) infinite}@keyframes v2streak{0%,100%{transform:translateX(0)}30%{transform:translateX(-5px)}31%{transform:translateX(4px)}60%{transform:translateX(2px)}61%{transform:translateX(-6px)}}
.v2-drift{animation:v2drift 5s linear infinite}@keyframes v2drift{from{transform:translateY(0)}to{transform:translateY(-6px)}}
.v2-psy{animation:v2psy 1.6s steps(1) infinite}@keyframes v2psy{0%,100%{transform:translateX(0)}22%{transform:translateX(1px)}25%{transform:translateX(-1px)}27%{transform:translateX(0)}}
.v2-ring{animation:v2ring 9s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes v2ring{to{transform:rotate(360deg)}}
.v2-cone{animation:v2cone 3.6s ease-in-out infinite}@keyframes v2cone{50%{opacity:.55}}
.v2-hex{animation:v2hex 1.2s steps(1) infinite}@keyframes v2hex{0%,100%{opacity:1}33%{opacity:0}66%{opacity:0}}
.v2-hex2{animation:v2hex 1.2s steps(1) infinite -.4s}.v2-hex3{animation:v2hex 1.2s steps(1) infinite -.8s}
.v2-drop{animation:v2drop .35s cubic-bezier(.2,.9,.2,1) both}@keyframes v2drop{from{transform:translateY(-6px);opacity:0}}
.v2-slide{animation:v2slide .3s cubic-bezier(.2,.9,.2,1) both}@keyframes v2slide{from{transform:translateX(6px);opacity:0}}
.v2-cheer{animation:v2cheer 2.4s steps(1) both}@keyframes v2cheer{0%{opacity:0}8%,88%{opacity:1}100%{opacity:0}}
.hair{animation:v2sway 1.8s steps(1) infinite}@keyframes v2sway{50%{transform:translateX(1px)}}
.vis{animation:v2vis 2.2s ease-in-out infinite}
.led{animation:v2led 1.2s steps(1) infinite}
@media (prefers-reduced-motion: reduce){.v2-led,.v2-rec,.v2-vis,.v2-blink,.v2-beam,.v2-rail,.v2-sweep,.v2-bx,.v2-chrom,.v2-streak,.v2-drift,.v2-psy,.v2-ring,.v2-cone,.v2-hex,.v2-hex2,.v2-hex3,.v2-drop,.v2-slide,.v2-cheer,.hair,.vis,.led{animation:none}.v2-sweep,.v2-chrom,.v2-mo,.v2-hex2,.v2-hex3{display:none}}
`
/** The takeover, 3.5 s (animation-fill both). Reduced motion: the animated layer is hidden and a still note shows for 3 s. */
export const TK_CSS = `.tk-scrim{animation:tkscrim .25s linear both}@keyframes tkscrim{from{opacity:0}to{opacity:.92}}
.tk-field{animation:tkfield .3s cubic-bezier(.2,.9,.2,1) both;transform-box:fill-box;transform-origin:center}@keyframes tkfield{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.tk-strobe{animation:tkstrobe .8s steps(1) both}@keyframes tkstrobe{0%,100%{opacity:1}25%{opacity:.35}50%{opacity:1}75%{opacity:.5}}
.tk-ret{animation:tkret .5s cubic-bezier(.2,.9,.2,1) both;transform-box:fill-box;transform-origin:center}@keyframes tkret{from{transform:scale(1.5);opacity:0}to{transform:scale(1);opacity:1}}
.tk-ring{animation:tkring 6s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes tkring{to{transform:rotate(360deg)}}
.tk-in{animation:tkin .5s steps(1) both}@keyframes tkin{0%{opacity:0}12%{opacity:1;clip-path:inset(0 0 72% 0);transform:translateX(-4px)}28%{opacity:.5;clip-path:inset(46% 0 0 0);transform:translateX(4px)}44%{opacity:1;clip-path:inset(0 0 34% 0);transform:translateX(-2px)}60%{opacity:.6;clip-path:inset(18% 0 18% 0);transform:translateX(2px)}78%,100%{opacity:1;clip-path:none;transform:none}}
.tk-g1{animation:tkg1 3.1s steps(1) infinite}@keyframes tkg1{0%{opacity:.8;transform:translate(-4px,0)}5%{opacity:.6;transform:translate(-3px,1px)}9%,44%,52%,89%,97%,100%{opacity:0;transform:none}45%{opacity:.8;transform:translate(-4px,-1px)}90%{opacity:.8;transform:translate(-3px,0)}}
.tk-g2{animation:tkg2 3.1s steps(1) infinite}@keyframes tkg2{0%{opacity:.8;transform:translate(4px,0)}5%{opacity:.6;transform:translate(3px,-1px)}9%,44%,52%,89%,97%,100%{opacity:0;transform:none}45%{opacity:.8;transform:translate(4px,1px)}90%{opacity:.8;transform:translate(3px,0)}}
.tk-bar{animation:tkbar .2s steps(2) both;transform-box:fill-box;transform-origin:center}@keyframes tkbar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.tk-ty{animation:tkty linear both;transform-box:fill-box;transform-origin:100% 50%}@keyframes tkty{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.tk-cur{animation:tkcur .5s steps(1) infinite}@keyframes tkcur{50%{opacity:0}}
.tk-off{animation:tkoff .6s steps(1) both}@keyframes tkoff{0%{opacity:1;clip-path:inset(0)}20%{clip-path:inset(0);transform:translateX(5px)}40%{clip-path:inset(30% 0 30% 0);transform:translateX(-4px)}60%{clip-path:inset(46% 0 46% 0);transform:none;opacity:1}80%{clip-path:inset(49.5% 0 49.5% 0);opacity:1}100%{clip-path:inset(50% 0 50% 0);opacity:0}}
.tk-still{display:none}
@media (prefers-reduced-motion: reduce){.tk-scrim,.tk-field,.tk-strobe,.tk-ret,.tk-ring,.tk-in,.tk-g1,.tk-g2,.tk-bar,.tk-ty,.tk-cur,.tk-off{animation:none}.tk-anim{display:none}.tk-still{display:block;animation:tkstill 3.5s steps(1) both}@keyframes tkstill{0%,85%{opacity:1}100%{opacity:0;visibility:hidden}}}
`

// --- primitives ---------------------------------------------------------------------
/** Scanlines: a 1 px line every 3 px. One pattern def per drawing. */
export const scanDefs = (id: string, color = '#FFFFFF', op = 0.045): string => `<pattern id="${id}" width="1" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${color}" fill-opacity="${op}"/></pattern>`
const bloomDefs = (id: string, sd = 3): string => `<filter id="${id}" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="${sd}"/></filter>`
const frameDefs = (id: string, c1: string, c2: string, c3: string): string => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>`
const sheenDefs = (id: string, color: string): string => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".16"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`

export type PaneOpts = { /** A card's shared frame gradients (`cardDefs`): no per-pane defs, ghost or sheen. */ shared?: string; sec?: boolean; near?: boolean; cut?: number; fill?: string; fillOp?: number; scanId?: string; nodes?: boolean; ghost?: boolean; beam?: boolean; sheenH?: number; frame?: string; scan?: boolean }
/**
 * A holographic glass pane: chamfered, translucent fill, a 1 px gradient frame, a top sheen and a parallax ghost of
 * the frame offset (+2, -2). `near` switches the frame to Capri's colours.
 */
export const pane = (x: number, y: number, w: number, h: number, o: PaneOpts = {}): string => {
  const P = palOf(Boolean(o.sec))
  const id = did('pn', x, y, w, h, o.sec, o.near, o.frame, o.beam)
  const near = Boolean(o.near)
  const c1 = near ? K.hot : o.frame || P.a
  const c3 = near ? K.green : P.line
  const c2 = near ? K.pink : lift(c1, 0.45)
  const cut = o.cut ?? 6
  const c2cut = Math.max(2, Math.round(cut / 3))
  const d = cham(x, y, w, h, cut, c2cut)
  const sheenH = Math.min(h, o.sheenH ?? 40)
  if (o.shared) {
    const sd = cham(x, y, w, h, cut, c2cut)
    let t = `<path d="${sd}" fill="${o.fill ?? P.tile2}" fill-opacity="${o.fillOp ?? 0.92}"/>`
    if (o.scan !== false && o.scanId) t += `<path d="${sd}" fill="url(#${o.scanId})"/>`
    t += `<path d="${sd}" fill="none" stroke="url(#${o.shared}${near ? 'n' : 'f'})"/>`
    if (o.nodes) t += `<g fill="${near ? K.white : P.ice}" fill-opacity=".9"><rect x="${r1(x + cut - 1)}" y="${y - 1}" width="2" height="2"/><rect x="${r1(x + w - 1)}" y="${r1(y + h - cut - 1)}" width="2" height="2"/></g>`
    return t
  }
  let s = `<defs>${frameDefs(`${id}f`, c1, c2, c3)}${sheenDefs(`${id}s`, near ? K.pink : o.frame || P.ice)}<clipPath id="${id}c"><path d="${d}"/></clipPath></defs>`
  if (o.ghost !== false) s += `<path d="${cham(x + 2, y - 2, w, h, cut, c2cut)}" fill="none" stroke="${c1}" stroke-opacity=".22"/>`
  s += `<path d="${d}" fill="${o.fill ?? P.tile2}" fill-opacity="${o.fillOp ?? 0.92}"/>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${sheenH}" fill="url(#${id}s)" clip-path="url(#${id}c)"/>`
  if (o.scan !== false && o.scanId) s += `<path d="${d}" fill="url(#${o.scanId})"/>`
  s += `<path d="${d}" fill="none" stroke="url(#${id}f)" stroke-width="1"${o.beam ? ' class="v2-beam" stroke-dasharray="70 930"' : ''}/>`
  if (o.beam) s += `<path d="${d}" fill="none" stroke="url(#${id}f)" stroke-width="1" stroke-opacity=".45"/>`
  if (o.nodes) {
    const n = near ? K.white : P.ice
    s += `<g fill="${n}" fill-opacity=".9"><rect x="${r1(x + cut - 1)}" y="${y - 1}" width="2" height="2"/><rect x="${x - 1}" y="${r1(y + cut - 1)}" width="2" height="2"/><rect x="${r1(x + w - cut - 1)}" y="${r1(y + h - 1)}" width="2" height="2"/><rect x="${r1(x + w - 1)}" y="${r1(y + h - cut - 1)}" width="2" height="2"/></g>`
  }
  return s
}
/** A card's shared defs: the scanline pattern and the frame gradient in the city's and in Capri's colours. */
export const cardDefs = (sid: string, sec: boolean, scanOp = 0.035): string => {
  const P = palOf(sec)
  return `<defs>${scanDefs(sid, sec ? K.hot : '#FFFFFF', sec ? 0.05 : scanOp)}${frameDefs(`${sid}f`, P.a, lift(P.a, 0.45), P.line)}${frameDefs(`${sid}n`, K.hot, K.pink, K.green)}</defs>`
}
/** Reticle brackets at the four corners of a box. */
export const brackets = (x: number, y: number, w: number, h: number, len: number, color: string, sw = 1.2, op = 1): string =>
  `<path d="M${r1(x)} ${r1(y + len)}V${r1(y)}H${r1(x + len)}M${r1(x + w - len)} ${r1(y)}H${r1(x + w)}V${r1(y + len)}M${r1(x + w)} ${r1(y + h - len)}V${r1(y + h)}H${r1(x + w - len)}M${r1(x + len)} ${r1(y + h)}H${r1(x)}V${r1(y + h - len)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-opacity="${op}"/>`
export type BeamOpts = { sec?: boolean; near?: boolean; ticks?: boolean; color?: string; color2?: string }
/** A beam gauge: a chamfered track, a gradient fill and a white-hot tip with bloom. Ticks every 10%. */
export const beam = (x: number, y: number, w: number, h: number, pct: number, o: BeamOpts = {}): string => {
  const P = palOf(Boolean(o.sec))
  const id = did('bm', x, y, w, h, Math.round(pct), o.sec, o.near, o.color)
  const f1 = o.near ? K.hot : o.color || P.a
  const f2 = o.near ? K.green : o.color2 || P.aT
  const tip = o.near ? K.white : P.ice
  const fw = r1((w * clamp(pct, 0, 100)) / 100)
  let s = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${f1}" stop-opacity=".75"/><stop offset=".85" stop-color="${f1}"/><stop offset="1" stop-color="${f2}"/></linearGradient>${bloomDefs(`${id}b`, h >= 6 ? 3 : 2)}</defs>`
  s += `<path d="${cham(x + 1.5, y - 1.5, w, h, 2, 1)}" fill="none" stroke="${P.line}" stroke-opacity=".7"/>`
  s += `<path d="${cham(x, y, w, h, 2, 1)}" fill="${P.track}"/>`
  if (o.ticks) s += `<g fill="${P.line}">${Array.from({ length: 9 }, (_, i) => `<rect x="${r1(x + (w * (i + 1)) / 10)}" y="${y + h + 2}" width="1" height="2"/>`).join('')}</g>`
  if (fw > 0) {
    s += `<rect x="${x}" y="${y}" width="${fw}" height="${h}" fill="url(#${id}g)"/>`
    s += `<rect x="${r1(x + Math.max(0, fw - 14))}" y="${y}" width="14" height="${h}" fill="${tip}" fill-opacity=".55" filter="url(#${id}b)"/>`
    s += `<rect x="${r1(x + Math.max(0, fw - 2))}" y="${y}" width="2" height="${h}" fill="${tip}"/>`
  }
  return s
}

export type PxOpts = { rim?: string; rimOp?: number; mono?: string; op?: number; rows?: [number, number]; flip?: boolean; tint?: string }
/**
 * Pixel art, crisp, merged into one path per colour and motion class (hair, vis, led). `rim`: a 1 px rim around the
 * silhouette (ignored for a sprite with `rim: false`); `mono`: every pixel in one colour (the wireframe look);
 * `rows`: draw only that window of rows. `s` is px per sprite pixel.
 */
export const pixels = (sp: Sprite, x: number, y: number, s: number, o: PxOpts = {}): string => {
  const W = Math.max(...sp.rows.map(r => r.length))
  const H = sp.rows.length
  const from = o.rows ? o.rows[0] : 0
  const to = o.rows ? o.rows[1] : H
  const rim = sp.rim === false ? undefined : o.rim
  const by = new Map<string, string[]>()
  // Runs of one colour merge down the rows when the next row has the same run, so a block is one rect.
  const live = new Map<string, { k: string; px: number; n: number; y0: number; y1: number }>()
  const flush = (py: number) => {
    for (const [id, r] of live) {
      if (r.y1 < py) {
        const a = by.get(r.k)
        const d = `M${r.px} ${r.y0}h${r.n}v${r.y1 - r.y0 + 1}h${-r.n}z`
        if (a) a.push(d)
        else by.set(r.k, [d])
        live.delete(id)
      }
    }
  }
  const colorOf = (ch: string | undefined): string | undefined => (ch === undefined || ch === '.' ? undefined : (o.mono ?? (ch === 't' && !sp.pal.t ? (o.tint ?? K.hot) : sp.pal[ch])))
  const filled = (px: number, py: number): boolean => colorOf(sp.rows[py]?.[px]) !== undefined
  const addRect = (k: string, px: number, py: number, n: number) => {
    const id = `${k}#${px}#${n}`
    const r = live.get(id)
    if (r && r.y1 === py - 1) r.y1 = py
    else {
      if (r) {
        const a = by.get(k)
        const d = `M${r.px} ${r.y0}h${r.n}v${r.y1 - r.y0 + 1}h${-r.n}z`
        if (a) a.push(d)
        else by.set(k, [d])
      }
      live.set(id, { k, px, n, y0: py, y1: py })
    }
  }
  for (let py = Math.max(-1, from - 1); py <= Math.min(H, to); py++) {
    const row = sp.rows[py] ?? ''
    for (let px = -1; px <= W; px++) {
      const ch = row[px]
      const c = colorOf(ch)
      if (c === undefined) {
        if (rim && py >= from && py < to && (filled(px + 1, py) || filled(px - 1, py) || filled(px, py + 1) || filled(px, py - 1))) addRect(`|rim|${rim}`, px, py, 1)
        continue
      }
      if (py < from || py >= to) continue
      let n = 1
      while (row[px + n] === ch) n++
      addRect(`${o.mono ? '' : (sp.cls?.[ch as string] ?? '')}||${c}`, px, py, n)
      px += n - 1
    }
    flush(py)
  }
  flush(H + 5)
  const paths = [...by.entries()].map(([k, ds]) => {
    const [cls, kind, color] = k.split('|') as [string, string, string]
    const isRim = kind === 'rim'
    return `<path${cls ? ` class="${cls}"` : ''} d="${ds.join('')}" fill="${color}"${isRim ? ` fill-opacity="${o.rimOp ?? 0.5}"` : o.op ? ` fill-opacity="${o.op}"` : ''}/>`
  })
  const tf = o.flip ? `translate(${r1(x + W * s)} ${r1(y)}) scale(${-s} ${s})` : `translate(${r1(x)} ${r1(y)}) scale(${s})`
  return `<g transform="${tf}" shape-rendering="crispEdges">${paths.join('')}</g>`
}
/** Capri's boxed eye (the key art's presence icon): a green box, black sclera, blue iris, white pupil. 14 by 8 at s = 1. An icon of her mark, not her figure. */
export const eye = (x: number, y: number, s = 1, cls = 'v2-vis'): string =>
  `<g transform="translate(${r1(x)} ${r1(y)}) scale(${s})"><rect x="0" y="0" width="14" height="8" rx=".8" fill="${K.green}"/><rect x="1.3" y="1.3" width="11.4" height="5.4" fill="${K.black}"/><circle class="${cls}" cx="7" cy="4" r="2" fill="${K.eye}"/><circle cx="7.6" cy="3.4" r=".7" fill="${K.white}"/></g>`
/** Pixel-sort streaks (the redline interference texture): thin bars in Capri's pinks that slide a few px. */
export const streaks = (x: number, y: number, w: number, h: number, seed: string, n: number, o: { colors?: string[]; max?: number; cls?: string } = {}): string => {
  const r = rng(seed)
  const cols = o.colors ?? [K.hot, K.pink, K.green, K.white]
  let s = `<g class="${o.cls ?? 'v2-streak'}">`
  for (let i = 0; i < n; i++) {
    const sw = 6 + r() * (o.max ?? 54)
    const sx = x + r() * Math.max(0, w - sw)
    const sy = y + Math.floor(r() * h)
    const c = cols[Math.floor(r() * cols.length)] as string
    s += `<rect x="${r1(sx)}" y="${sy}" width="${r1(sw)}" height="${r() < 0.3 ? 2 : 1}" fill="${c}" fill-opacity="${r1(0.45 + r() * 0.5)}"/>`
  }
  return `${s}</g>`
}
/** Data particles: 1-2 px green squares in a margin, drifting up. */
export const motes = (x: number, y: number, w: number, h: number, seed: string, n: number): string => {
  const r = rng(seed)
  return `<g class="v2-drift" fill="${K.green}">${Array.from({ length: n }, () => `<rect x="${r1(x + r() * w)}" y="${r1(y + r() * h)}" width="${r() < 0.4 ? 2 : 1}" height="${r() < 0.4 ? 2 : 1}" fill-opacity="${r1(0.4 + r() * 0.6)}"/>`).join('')}</g>`
}
/** The red interference field (the clip's centre panel): red base, vertical subpixel stripes, pink tear streaks, dark dropped bands. */
export const field = (x: number, y: number, w: number, h: number, seed: string, o: { n?: number } = {}): string => {
  const id = did('fd', x, y, w, h)
  const r = rng(seed)
  let s = `<defs><pattern id="${id}" width="3" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#000" fill-opacity=".22"/></pattern><clipPath id="${id}c"><rect x="${r1(x)}" y="${y}" width="${r1(w)}" height="${h}"/></clipPath></defs>`
  s += `<g clip-path="url(#${id}c)"><rect x="${r1(x)}" y="${y}" width="${r1(w)}" height="${h}" fill="${K.red}"/>`
  const n = o.n ?? Math.round(h / 6)
  for (let i = 0; i < n; i++) {
    const sy = y + r() * h
    const sh = r() < 0.2 ? 3 : r() < 0.5 ? 2 : 1
    const sw = w * (0.2 + r() * 0.8)
    const sx = x + (r() < 0.5 ? 0 : w - sw)
    const dark = r() < 0.3
    s += `<rect x="${r1(sx)}" y="${r1(sy)}" width="${r1(sw)}" height="${sh}" fill="${dark ? '#7A0A2A' : r() < 0.5 ? K.pink : '#FFB3E6'}" fill-opacity="${r1(dark ? 0.6 : 0.5 + r() * 0.5)}"/>`
  }
  for (let i = 0; i < Math.round(n / 3); i++) s += `<rect x="${r1(x + r() * w)}" y="${r1(y + r() * h)}" width="${r1(3 + r() * 10)}" height="${r1(2 + r() * 4)}" fill="#FFD2F0" fill-opacity="${r1(0.5 + r() * 0.5)}"/>`
  return `${s}<rect x="${r1(x)}" y="${y}" width="${r1(w)}" height="${h}" fill="url(#${id})"/></g>`
}
const CODES = ['1C', 'BD', '55', 'E9', '7A', 'FF']
export const HEX_CODES = CODES
export const HEX_W = 30 + 13 * 6
/** The LINK hex stream: six codes with a lit cell running while the job works. Capri recolours it pink. Drawn from x. */
export const hexStream = (x: number, y: number, working: boolean, near: boolean, sec: boolean): string => {
  const P = palOf(sec)
  const cell = 13
  const lit = near ? K.hot : P.a
  let s = M(x, y, 'LINK', 8, P.muted, 'letter-spacing="1"')
  s += `<g>${CODES.map((c, i) => M(x + 30 + i * cell + cell / 2, y, c, 8.5, working ? (near ? K.pink : P.aT) : P.muted, `text-anchor="middle" fill-opacity="${working ? 0.9 : 0.6}"`)).join('')}</g>`
  if (working) s += `<rect class="v2-bx" x="${x + 30}" y="${y - 8}" width="${cell}" height="11" fill="${lit}" fill-opacity=".18" stroke="${lit}" stroke-opacity=".75" stroke-width=".8"/>`
  return s
}
/** The Arasaka datashard: a chamfered chip with three pins each side. 12 by 8 at s = 1. */
export const chipGlyph = (x: number, y: number, color: string, s = 1): string =>
  `<g transform="translate(${r1(x)} ${r1(y)}) scale(${s})" fill="${color}"><path d="${cham(2, 0, 8, 8, 2, 1)}" fill="none" stroke="${color}" stroke-width="1.2"/><rect x="4.5" y="2.5" width="3" height="3"/><rect x="0" y="1.5" width="2" height="1"/><rect x="0" y="3.5" width="2" height="1"/><rect x="0" y="5.5" width="2" height="1"/><rect x="10" y="1.5" width="2" height="1"/><rect x="10" y="3.5" width="2" height="1"/><rect x="10" y="5.5" width="2" height="1"/></g>`

// --- sprites for the band ---------------------------------------------------------------
const RUNNERS = [ER_RUNNER, ER_RUNNER2, ER_RUNNER3]
export const BUST_W = 42
export const BUST_H = 48

// --- the episodes (titles only, never synopses) ---------------------------------------
export const ER2_EPISODES = ['Last Chance for a Slow Dance', 'Give Me Another Day', '0+2=1', 'Someone That I Used to Know', 'Fades (Pass the Distance)', 'Everything Hate', 'To the Depths with You', 'Serce', 'Strictly Reserved for You', 'Then Everyone Went Home']
/** The hour's episode: "EP 03 0+2=1". */
export const er2EpisodeAt = (at: number): string => {
  const i = Math.floor(at / 3_600_000) % 10
  return `EP ${String(i + 1).padStart(2, '0')} ${ER2_EPISODES[i]}`
}

export const ER2_GREETING = 'No signal, no survival. Wake up, choom.'
export const CAPRICORN_GREETING = "we're one now, choom."
export const ER2_BOOT: [string, string] = ['LINKING · handshake with D…', 'LINKED · No signal, no survival.']
export const ER2_WARNING = (ctx: number): string => (ctx >= 95 ? "Capri's awake. /compact now, choom." : "Chip's running hot. /compact soon.")
export const ER2_WORDS = ['Linking in', 'Syncing the chip', 'Running the trace', 'Pinging Snake Nation', 'Loading the engram', 'Crawling Night City']
export const ER2_TITLE_WORDS = ['Slow Dance', 'Another Day', 'Fades', 'Serce', 'Strictly Reserved', 'Everyone Went Home']
/** D's netrunner verbs for the tool calls. */
export const ER2_TOOLS: Record<string, string> = { Read: 'Probe', Grep: 'Sweep', Glob: 'Map', LS: 'Map', Edit: 'Rewrite', MultiEdit: 'Rewrite', NotebookEdit: 'Rewrite', Write: 'Inject', Bash: 'Run', PowerShell: 'Run', Agent: 'Link', WebFetch: 'Pull', WebSearch: 'Crawl', ToolSearch: 'Load' }
/** The secret skin's unlock: the ep 3 title in a prompt, or "hi capri" within a minute of a takeover. */
export const CAPRICORN_RE = /0\s*\+\s*2\s*=\s*1/
export const HI_CAPRI_RE = /\bhi,?\s+capri\b/i
export const HI_CAPRI_MS = 60_000

// --- the band's pieces ---------------------------------------------------------------------
export const ER2_BAND_H = 132
export type BandCtx = { ctxPct: number; overBudget: boolean; isWorking?: boolean; capri?: boolean }
export type BandTheme = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }
/** Is Capri's HUD on: 95%+ context, Capri roaming, or the secret skin. */
export const isNear = (c: Partial<BandCtx> | undefined, sec: boolean): boolean => sec || (c?.ctxPct ?? 0) >= 95 || Boolean(c?.capri)

/** The ground layer: the glass tile, sheen, scanlines, a faint optic sweep, the frame (with a beam while working), the link rail, possession in the margins and the corner egg. */
export const er2Foot = (W: number, H: number, sec: boolean, ctx: BandCtx): string => {
  const P = palOf(sec)
  const near = isNear(ctx, sec)
  const working = ctx.isWorking !== false
  const id = did('ft', W, H, near, sec)
  const cut = 9
  const d = cham(0.5, 0.5, W - 1, H - 1, cut, 3)
  const c1 = near ? K.hot : P.a
  const c3 = near ? K.green : P.line
  let s = `<defs>${scanDefs(`${id}s`, sec ? K.hot : '#FFFFFF', sec ? 0.05 : 0.04)}${frameDefs(`${id}f`, c1, near ? K.pink : lift(P.a, 0.4), c3)}${sheenDefs(`${id}h`, near ? K.pink : P.ice)}<clipPath id="${id}c"><path d="${d}"/></clipPath></defs>`
  s += `<path d="${d}" fill="${P.tile}"/>`
  s += `<g clip-path="url(#${id}c)"><rect x="0" y="0" width="${W}" height="48" fill="url(#${id}h)"/><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}s)"/>`
  if (working) s += `<rect class="v2-sweep" style="--h:${H}px" x="0" y="-2" width="${W}" height="1" fill="${near ? K.pink : P.a}" fill-opacity=".14"/>`
  // Possession: streaks and motes stay in the top and bottom margins, never under a value.
  if (near) s += streaks(12, 1, Math.round(W * 0.55), 5, `${sec ? 'sec' : 'ctx'}T${W}`, 9) + streaks(12, H - 6, Math.round(W * 0.5), 5, `${sec ? 'sec' : 'ctx'}B${W}`, 8) + motes(12, 1, 300, 5, `mo${W}`, 7)
  s += '</g>'
  s += `<path d="${d}" fill="none" stroke="url(#${id}f)" stroke-opacity="${working ? 0.45 : 0.6}"/>`
  if (working) s += `<path class="v2-beam" d="${d}" fill="none" stroke="${near ? K.white : P.ice}" stroke-width="1" stroke-dasharray="70 930" stroke-opacity=".9"/>`
  s += `<g fill="${near ? K.white : P.ice}" fill-opacity=".85"><rect x="${cut - 0.5}" y="-0.5" width="2" height="2"/><rect x="-0.5" y="${cut - 0.5}" width="2" height="2"/><rect x="${W - cut - 1.5}" y="${H - 1.5}" width="2" height="2"/><rect x="${W - 1.5}" y="${H - cut - 1.5}" width="2" height="2"/></g>`
  s += `<line x1="5" y1="14" x2="5" y2="${H - 14}" stroke="${near ? K.hot : P.a}" stroke-width="2" stroke-opacity=".55"/>`
  if (working) s += `<line class="v2-rail" x1="5" y1="14" x2="5" y2="${H - 14}" stroke="${near ? K.white : P.ice}" stroke-width="2" stroke-dasharray="12 208"/>`
  return s + corner(W, H, near, sec)
}
/** The 14 px egg box at (W-21, H-19): the optic reticle blinks; when Capri is near her eye opens there. */
const corner = (W: number, H: number, near: boolean, sec: boolean): string => {
  const P = palOf(sec)
  const x = W - 21
  const y = H - 19
  if (near) return eye(x, y + 3, 1)
  return `<g class="v2-blink"><circle cx="${x + 7}" cy="${y + 7}" r="4.5" fill="none" stroke="${P.a}" stroke-opacity=".6"/><circle cx="${x + 7}" cy="${y + 7}" r="1.2" fill="${P.aT}"/><path d="M${x + 7} ${y}v2M${x + 7} ${y + 12}v2M${x} ${y + 7}h2M${x + 12} ${y + 7}h2" stroke="${P.a}" stroke-opacity=".6"/></g>`
}

/** The header's name: MISSION CONTROL as a holo tag, D's patch and his id (shorter, then gone, as the band narrows). */
export const er2Name = (x: number, y: number, W: number, sec: boolean, near: boolean): { svg: string; w: number } => {
  const P = palOf(sec)
  const label = 'MISSION CONTROL'
  const lw = r1(er2W(label, 9.5, 1.6, 800) + 26)
  let s = pane(x, y - 12, lw, 17, { sec, near, cut: 4, fillOp: 0.85, scan: false, ghost: false })
  s += `<rect class="v2-led" x="${x + 7}" y="${y - 5.5}" width="4" height="4" fill="${near ? K.green : P.ice}"/>`
  const attrs = `font-size="9.5" font-weight="800" letter-spacing="1.6"`
  if (near) s += `<text class="v2-chrom" x="${x + 15.5}" y="${y}" ${attrs} fill="${K.hot}" opacity="0">${label}</text><text class="v2-chrom" x="${x + 18.5}" y="${y}" ${attrs} fill="${K.green}" opacity="0">${label}</text>`
  else s += `<text x="${x + 18}" y="${y}" ${attrs} fill="${P.a}" fill-opacity=".35">${label}</text>`
  s += `<text x="${x + 17}" y="${y}" ${attrs} fill="${P.text}">${label}</text>`
  const px = x + lw + 10
  if (sec) s += `<path d="${cham(px, y - 12, 17, 17, 3, 1)}" fill="${K.black}" stroke="${K.green}" stroke-width="1"/>${pixels(ER_CAPRI_BUST, px + 2, y - 11, 0.31)}`
  else s += `<path d="${cham(px, y - 12, 16, 16, 3, 1)}" fill="${P.a}"/>${T(px + 4.3, y + 0.6, 'D', 12, 800, '#FFFFFF')}`
  const id = sec ? 'PROJECT CAPRICORN · HOST D' : W >= 1100 ? 'SNAKE NATION · NETRUNNER' : W >= 900 ? 'SNAKE NATION' : ''
  if (id) s += T(px + 23, y + 0.5, id, 9.5, 800, P.aT, 'letter-spacing="1.3"')
  return { svg: ff(s), w: lw + 10 + 17 + (id ? 7 + er2W(id, 9.5, 1.3, 800) : 0) }
}

/** The context chip: 85% CHIP HOT (amber), 95% CAPRI'S AWAKE (her colours, a jitter, her eye). */
export const er2Chip = (x: number, y: number, pct: number, sec: boolean): { svg: string; w: number } => {
  const P = palOf(sec)
  if (pct < 85) return { svg: '', w: 0 }
  const hot = pct >= 95
  const label = hot ? "CAPRI'S AWAKE" : 'CHIP HOT'
  const w = r1(er2W(label, 9.5, 1.2, 800) + 34)
  const c = hot ? K.green : P.warn
  let s = `<g${hot ? ' class="v2-psy"' : ''}><path d="${cham(x, y - 11.5, w, 16, 4, 1)}" fill="${hot ? K.hot : c}" fill-opacity="${hot ? 0.22 : 0.16}" stroke="${c}" stroke-opacity=".8"/>`
  s += hot ? eye(x + 6, y - 7.5, 0.85, 'v2-led') : chipGlyph(x + 6, y - 7.5, c, 0.9)
  s += T(x + 23, y, label, 9.5, 800, c, 'letter-spacing="1.2"')
  return { svg: ff(`${s}</g>`), w }
}

/** The episode readout: the code in a chamfered mono tag, the title in italics. */
export const er2EpW = (code: string, title: string, full: boolean): number => r1(mw(code, 8.5, 0.8) + 12 + (full ? er2W(title, 11.5, 0, 500) + 8 : 0))
export const er2Ep = (xr: number, y: number, code: string, title: string, full: boolean, sec: boolean): string => {
  const P = palOf(sec)
  const cw = r1(mw(code, 8.5, 0.8) + 12)
  const x = r1(xr - er2EpW(code, title, full))
  let s = `<path d="${cham(x, y - 11, cw, 15, 3, 1)}" fill="${P.a}" fill-opacity=".14" stroke="${P.a}" stroke-opacity=".6"/>${M(x + 6, y, code, 8.5, P.aT, 'letter-spacing=".8"')}`
  if (full) s += T(x + cw + 8, y, title, 11.5, 500, P.sub, 'font-style="italic"')
  return ff(s)
}
/** The right-hand LINK hex stream; the engine drops it first when there is no room. */
export const er2Gauge = (xr: number, y: number, working: boolean, near: boolean, sec: boolean): { svg: string; w: number } => ({ svg: hexStream(xr - HEX_W, y, working, near, sec), w: HEX_W })

/** D in the 34 by 40 box at (20, 36) on a cobalt base line; Capri herself in the secret skin. */
export const er2Figure = (sec: boolean): string => {
  const P = palOf(sec)
  const base = `<rect x="22" y="76" width="30" height="1" fill="${P.a}" fill-opacity=".5"/>`
  return sec ? `${base}${pixels(ER_CAPRI, 26, 35, 0.86, { rim: K.hot, rimOp: 0.45 })}` : `${base}${pixels(ER_D, 31, 36, 0.85)}`
}
/** A runner at the top-left of its box, the jacket in the role colour, with a 1 px base. */
export const er2Crew = (x: number, y: number, color: string): string => {
  const sp = RUNNERS[hash(color) % 3] as Sprite
  const tinted: Sprite = { ...sp, pal: { ...sp.pal, c: color, e: color } }
  return `${pixels(tinted, x, y, 0.38)}<rect x="${x - 1}" y="${y + 18.5}" width="9" height="1" fill="${color}" fill-opacity=".55"/>`
}
/** A step as a 9 px chamfered cell: done filled, running outlined with a pulsing core, failed an X. */
export const er2Pip = (st: string, cx: number, cy: number, sec: boolean): string => {
  const P = palOf(sec)
  const d = cham(cx - 4.5, cy - 4.5, 9, 9, 2.5, 1)
  if (st === 'done') return `<path d="${d}" fill="${P.a}"/>`
  if (st === 'running') return `<path d="${d}" fill="none" stroke="${P.a}" stroke-width="1.2"/><rect class="v2-led" x="${cx - 1.5}" y="${cy - 1.5}" width="3" height="3" fill="${P.ice}"/>`
  if (st === 'failed') return `<path d="M${cx - 3.2} ${cy - 3.2}l6.4 6.4M${cx + 3.2} ${cy - 3.2}l-6.4 6.4" stroke="${P.alert}" stroke-width="1.8" stroke-linecap="round"/>`
  if (st === 'stopped') return `<path d="${d}" fill="${P.muted}" fill-opacity=".7"/>`
  return `<path d="${d}" fill="none" stroke="${P.muted}" stroke-opacity=".7" stroke-width="1.1"/>`
}
/** The task gauge: the beam, 8 tall, with ticks. */
export const er2Tear = (x: number, y: number, w: number, pct: number, sec: boolean, near: boolean): string => beam(x, y, w, 8, pct, { sec, near, ticks: true })
/** A chamfered status or role pill (the engine's `pill` hook). */
export const er2Pill = (x: number, y: number, w: number, h: number, fill: string, op: number, stroke?: string): string =>
  `<path d="${cham(x, y, w, h, 4, 1)}" fill="${fill}" fill-opacity="${op}"${stroke ? ` stroke="${stroke}" stroke-opacity=".55"` : ''}/>`
/** The cheer: a chamfered ice bar flashes JOB DONE, CHOOM. across the band. */
export const er2Cheer = (W: number, H: number, sec: boolean): string => {
  const P = palOf(sec)
  const text = 'JOB DONE, CHOOM.'
  const w = r1(er2W(text, 15, 1.4, 800) + 36)
  const cx = W / 2
  const cy = H / 2
  return ff(`<g class="v2-cheer"><path d="${cham(cx - w / 2 + 2, cy - 15, w, 28, 6, 2)}" fill="none" stroke="${sec ? K.green : P.a}" stroke-opacity=".5"/><path d="${cham(cx - w / 2, cy - 13, w, 28, 6, 2)}" fill="${sec ? K.hot : P.ice}"/>${T(cx, cy + 6, text, 15, 800, sec ? K.black : '#07101C', 'text-anchor="middle" letter-spacing="1.4"')}</g>`)
}

// --- Capri's holo framing (drawn around the roamer's own figure) -----------------------------------
/**
 * The framing for her walk or sit, in a frame whose origin is her feet. `s` is the roamer's scale (the band's 1.8). The
 * figure itself is the engine's (cast.ts spriteMarkup of ER_CAPRI); the copies here are the same sprite, mono-tinted.
 */
export const er2Halo = (s: number, dir: 1 | -1): string => {
  const sp = ER_CAPRI
  const k = 0.5625 * s
  const w = 20 * k
  const h = sp.rows.length * k
  const top = -h
  const x0 = -10 * k
  const id = did('wk', s, dir)
  let g = `<defs><radialGradient id="${id}" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${K.hot}" stop-opacity=".28"/><stop offset=".6" stop-color="${K.hot}" stop-opacity=".08"/><stop offset="1" stop-color="${K.green}" stop-opacity="0"/></radialGradient>${bloomDefs(`${id}b`, 3)}</defs>`
  g += `<ellipse cx="0" cy="${r1(top + h * 0.55)}" rx="${r1(w * 1.4)}" ry="${r1(h * 0.62)}" fill="url(#${id})"/>`
  g += streaks(-w * 1.2, top + 4, w * 2.4, h - 10, `${id}sl`, 7, { max: Math.round(w * 1.6) })
  g += `<ellipse cx="0" cy="-1" rx="${r1(w * 0.9)}" ry="${r1(3 * s)}" fill="none" stroke="${K.green}" stroke-opacity=".6"/><ellipse cx="0" cy="-1" rx="${r1(w * 0.5)}" ry="${r1(1.6 * s)}" fill="none" stroke="${K.hot}" stroke-opacity=".7"/>`
  const flip = dir === -1
  g += `<g class="v2-mo" opacity=".55" filter="url(#${id}b)">${pixels(sp, x0, top, k, { mono: K.hot, op: 0.6, flip })}</g>`
  g += `<g opacity=".35">${pixels(sp, x0 - 2.5, top, k, { mono: K.hot, flip })}${pixels(sp, x0 + 2.5, top, k, { mono: K.green, flip })}</g>`
  const r = rng(id)
  g += `<g fill="${K.green}" fill-opacity=".75">${Array.from({ length: 9 }, (_, i) => `<rect x="${r1(-dir * (14 + i * 9))}" y="${r1(-4 - r() * h * 0.55)}" width="${i % 3 ? 1 : 2}" height="${i % 3 ? 1 : 2}"/>`).join('')}</g>`
  return g
}

const delayer = (startAt: number | undefined, tm: RoamTiming): ((x: number) => string) => {
  if (tm.delay) return x => `calc(${tm.delay} + ${r1(x)}s)`
  const base = tm.now !== undefined && startAt !== undefined ? (startAt - tm.now) / 1000 : 0
  return x => `${r1(base + x)}s`
}
/** Her peek at a spot (the episode tag on the band): her bust leaning out, a pink / green split, glitching in and out like her other acts. */
export const er2Peek = (x: number, y: number, plan: RoamPlan, tm: RoamTiming): string => {
  const dly = delayer(plan.startAt, tm)
  const dur = plan.durMs / 1000
  const bx = x - 19.5
  const by = y - 17
  return `<g class="rm-pk"><g class="rm-in" style="animation-delay:${dly(0)}"><g class="rm-out" style="animation-delay:${dly(dur - 0.45)}"><g transform="rotate(-10 ${r1(x - 9)} ${r1(y)})"><g class="v2-mo" opacity=".4">${pixels(ER_CAPRI_BUST, bx - 1.5, by, 0.5, { mono: K.hot })}${pixels(ER_CAPRI_BUST, bx + 1.5, by, 0.5, { mono: K.green })}</g>${pixels(ER_CAPRI_BUST, bx, by, 0.5, { rim: K.hot, rimOp: 0.5 })}</g>${streaks(x - 40, y - 14, 36, 14, 'pk', 4, { max: 22 })}</g></g></g>`
}
/** Where she peeks and sits on a pane card (W by H): out of the top-right corner, and on the capsule's top (or the header's right). */
export const er2PaneSpots = (W: number, H: number): { peek?: { x: number; y: number }; sit?: { x: number; y: number } } => ({ peek: { x: W - 24, y: 46 }, sit: H >= 300 ? { x: 100, y: 48 } : { x: W - 70, y: 40 } })
/** Past 95% context, her streaks and motes creep in along the card's top margin (the pane's possession), never under a label. */
export const er2PaneCreep = (W: number, _H: number, ctxPct: number): string => (ctxPct >= 95 ? `${streaks(Math.round(W * 0.4), 1, Math.round(W * 0.5), 4, `pcreep${W}`, 8, { max: 46 })}${motes(Math.round(W * 0.4), 1, Math.round(W * 0.5), 4, `pmo${W}`, 5)}` : '')

// --- the takeover ----------------------------------------------------------------------------------
/**
 * D's HUD hijacked: a scrim, the red interference field slams in as a centre panel, strobes twice (2.5 Hz), a reticle
 * frame materialises, big pixel Capri glitches in, the line types in a black dialogue bar and the whole layer
 * collapses to a line like a CRT switching off (3.5 s). Reduced motion: a still holo note for 3 s. `H < 200` is the band layout.
 */
export const er2Takeover = (W: number, H: number, line: string, tm: RoamTiming, sec: boolean): string => {
  const dly = delayer(tm.startAt, tm)
  const P = palOf(sec)
  const isBand = H < 200
  const sp = ER_CAPRI_BIG
  const id = did('tk', W, H, line)
  const SH = isBand ? H * 0.88 : Math.min(H * 0.62, 400)
  const sc = r1(SH / 96)
  const cw = 42 * sc
  const cx = isBand ? W * 0.3 : W / 2
  const floor = isBand ? H - 4 : H * 0.73
  const top = floor - 96 * sc
  const fw = isBand ? Math.max(cw + 80, W * 0.2) : Math.max(cw + 80, W * 0.36)
  const fx = cx - fw / 2
  const D = (t: number) => `style="animation-delay:${dly(t)}"`
  let a = `<g class="tk-anim"><rect class="tk-scrim" x="0" y="0" width="${W}" height="${H}" fill="#02030A" ${D(0)}/>`
  a += `<defs>${scanDefs(`${id}s`, '#FFFFFF', 0.06)}</defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}s)"/>`
  a += `<g class="tk-field" ${D(0.2)}><g class="tk-strobe" ${D(0.5)}>${field(fx, 0, fw, H, `${line}|${W}`, { n: Math.round(H / 5) })}</g></g>`
  a += `<g class="tk-field" ${D(0.3)}>${streaks(fx - 60, 0, fw + 120, H, `${id}leak`, isBand ? 10 : 22, { colors: [K.hot, K.pink, K.white], max: 120 })}</g>`
  const rx = cx - cw / 2 - 14
  const ry = top - 10
  const rw = cw + 28
  const rh = 96 * sc + 16
  a += `<g class="tk-ret" ${D(0.45)}>${brackets(rx, ry, rw, rh, Math.max(8, rw * 0.18), K.white, 1.5)}<g class="tk-ring"><circle cx="${r1(cx)}" cy="${r1(top + 48 * sc)}" r="${r1(Math.max(rw, rh) * 0.62)}" fill="none" stroke="${K.green}" stroke-opacity=".5" stroke-dasharray="6 10"/></g><ellipse cx="${r1(cx)}" cy="${r1(floor + 2)}" rx="${r1(cw * 0.9)}" ry="${r1(4 * sc)}" fill="none" stroke="${K.green}" stroke-opacity=".7"/><ellipse cx="${r1(cx)}" cy="${r1(floor + 2)}" rx="${r1(cw * 0.55)}" ry="${r1(2.4 * sc)}" fill="none" stroke="${K.white}" stroke-opacity=".6"/></g>`
  const bx = cx - cw / 2
  a += `<g class="tk-in" ${D(0.65)}><g class="tk-g1" opacity="0">${pixels(sp, bx, top, sc, { mono: K.hot, op: 0.85 })}</g><g class="tk-g2" opacity="0">${pixels(sp, bx, top, sc, { mono: K.green, op: 0.85 })}</g>${pixels(sp, bx, top, sc)}</g>`
  // The dialogue bar and the typed line.
  const fs = isBand ? 18 : clamp(Math.round(W * 0.06), 18, 30)
  const twd = mw(line, fs, 1)
  const cap = 'CAPRI · PERSONALITY CONSTRUCT · ONLY YOU CAN SEE HER'
  const bw = Math.max(twd + fs * 1.6, isBand ? 0 : mw(cap, 8, 1) + fs * 1.6)
  const bh = fs * 1.75 + (isBand ? 0 : 14)
  const bxx = isBand ? W * 0.62 - 20 : cx - bw / 2
  const by2 = isBand ? H / 2 - bh / 2 : Math.min(H - bh - 24, H * 0.8)
  const typeS = r1(0.07 * [...line].length)
  a += `<g class="tk-bar" ${D(1)}><path d="${cham(bxx, by2, bw, bh, 8, 2)}" fill="#030308"/><path d="${cham(bxx, by2, bw, bh, 8, 2)}" fill="none" stroke="${K.hot}" stroke-opacity=".7"/>`
  const tyy = by2 + fs * 1.22
  const attrs = `font-family="${MONO}" font-size="${fs}" font-weight="700" letter-spacing="1"`
  const tx = bxx + fs * 0.8
  a += `<text x="${r1(tx - 2)}" y="${r1(tyy)}" ${attrs} fill="${K.hot}" opacity=".85">${esc(line)}</text><text x="${r1(tx + 2)}" y="${r1(tyy)}" ${attrs} fill="${K.green}" opacity=".85">${esc(line)}</text><text x="${r1(tx)}" y="${r1(tyy)}" ${attrs} fill="${K.white}">${esc(line)}</text>`
  a += `<rect class="tk-ty" style="animation-delay:${dly(1.15)};animation-duration:${typeS}s;animation-timing-function:steps(${Math.max(1, [...line].length)},end)" x="${r1(tx - 4)}" y="${r1(by2 + 2)}" width="${r1(twd + 8)}" height="${r1(bh - 4)}" fill="#030308"/>`
  a += `<rect class="tk-cur" x="${r1(tx + twd + 2)}" y="${r1(tyy - fs * 0.75)}" width="${Math.max(2, fs / 7)}" height="${r1(fs * 0.9)}" fill="${K.green}"/>`
  if (!isBand) a += M(tx, by2 + bh - 9, cap, 8, K.pink, 'letter-spacing="1"')
  a += '</g></g>'
  const anim = `<g class="tk-off" ${D(2.9)}>${a}</g>`
  // Reduced motion: a still holo note.
  const nw = 236
  const nh = 48
  const nx = isBand ? W * 0.62 : W / 2 - nw / 2
  const ny = isBand ? H / 2 - nh / 2 : H - nh - 16
  let still = `<g class="tk-still" ${D(0)}>${pane(nx, ny, nw, nh, { sec, near: true, cut: 7, scan: false, fillOp: 0.96, fill: '#05060E', nodes: true })}`
  still += `<path d="${cham(nx + 8, ny + 6, 32, 36, 4, 1)}" fill="${K.black}"/>${pixels(ER_CAPRI_BUST, nx + 11, ny + 7, 0.62)}`
  still += `<text x="${r1(nx + 50)}" y="${r1(ny + 24)}" font-family="${MONO}" font-size="16" font-weight="700" fill="${K.white}">${esc(line)}</text>`
  still += `${M(nx + 50, ny + 39, 'CAPRI · ONLY YOU CAN SEE HER', 8, K.pink, 'letter-spacing="1"')}</g>`
  void P
  return `<g pointer-events="none">${anim}${still}</g>`
}
