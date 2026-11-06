// Cyberpunk: Edgerunners 2 (fan homage; the hidden CAPRICORN skin shares everything here).
// Torn magenta paper pasted on black, paper tape, the key art's concentric eye, and Capri
// bleeding in from the edges. The band's pieces, the context chip, the takeover and the
// pixel helpers live here; the pane's cards are in edgerunners2-cards.ts. Pure SVG strings,
// no `$`, no state. Every "random" tear, shard and speck comes from a seed, so a redraw
// gives the same picture.
//
// Capri is NEVER drawn with vector paths: every Capri is one of the pixel sprites in cast.ts
// (ER_CAPRI roams, ER_CAPRI_BUST is the portrait and the mask, ER_CAPRI_BIG is the takeover).
//
// A fan homage to Cyberpunk: Edgerunners (CD PROJEKT RED / Studio Trigger / Netflix). Only
// episode titles, short phrases and original drawing; no logos, no spoilers.
import { CAST_CSS, ER_CAPRI, ER_CAPRI_BIG, ER_CAPRI_BUST, ER_D, ER_RUNNER, ER_RUNNER2, ER_RUNNER3, hashOf, spriteMarkup } from './cast'
import { pin } from './smooth'
import type { Sprite } from './cast'
import type { RoamPlan, RoamTiming } from './roamer'

// --- tokens ----------------------------------------------------------------------
export const P = {
  ink: '#0A0709', ink2: '#151014', line: '#2C2128', track: '#1A333C',
  mag: '#FD0250', crim: '#A02241', pink: '#FF5A92', paper: '#E9E6D8', paper2: '#CBC6B4',
  text: '#F1EEE4', sub: '#C2B9B3', muted: '#968B90',
  cobalt: '#3E80F7', cobaltT: '#79A6FF', done: '#8ED1BF', warn: '#F5A35C',
  // Capri only: never used for ordinary UI.
  hot: '#FF2E7E', hotD: '#C8124E', green: '#3DF27A', eye: '#2F6BFF', white: '#F7F4EA', black: '#050305',
}
export const ER2_FONT = "'Avenir Next Condensed','Roboto Condensed','Arial Narrow',Bahnschrift,sans-serif"
export const MONO = "'SF Mono',Menlo,Consolas,monospace"

export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const r1 = (n: number): number => +(+n).toFixed(1)
export const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n))
export const hash = (s: string): number => hashOf(String(s))
let uid = 0
export const uniq = (p: string): string => `${p}${(uid = (uid + 1) % 100000)}`

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

// --- the motifs --------------------------------------------------------------------
/** A torn rectangle: each chosen edge walks in 3-8 px steps and bites inward by up to `j` px. */
export const torn = (x: number, y: number, w: number, h: number, seed: string, j = 2, edges = 'trbl'): string => {
  const R = rng(seed)
  const pts: [number, number][] = []
  const walk = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, amp: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    let t = 0
    while (t < len) {
      const f = t / len
      const d = amp ? (R() < 0.12 ? amp * 1.9 : R() * amp) : 0
      pts.push([x0 + (x1 - x0) * f + nx * d, y0 + (y1 - y0) * f + ny * d])
      t += 3 + R() * 5
    }
  }
  const J = (e: string) => (edges.includes(e) ? j : 0)
  walk(x, y, x + w, y, 0, 1, J('t'))
  walk(x + w, y, x + w, y + h, -1, 0, J('r'))
  walk(x + w, y + h, x, y + h, 0, -1, J('b'))
  walk(x, y + h, x, y, 1, 0, J('l'))
  return `M${pts.map(p => `${r1(p[0])} ${r1(p[1])}`).join('L')}Z`
}
/** Two-ply paper: an under-layer offset down-right, then the sheet. */
export const paper = (x: number, y: number, w: number, h: number, seed: string, fill = P.mag, under = P.crim, j = 2, edges = 'trbl', off: [number, number] = [1.6, 2]): string =>
  `<path d="${torn(x + off[0], y + off[1], w, h, `${seed}u`, j, edges)}" fill="${under}"/><path d="${torn(x, y, w, h, seed, j, edges)}" fill="${fill}"/>`
export const tape = (cx: number, cy: number, w: number, h: number, rot: number, seed: string, op = 0.62): string =>
  `<path d="${torn(-w / 2, -h / 2, w, h, seed, 1.4, 'lr')}" transform="translate(${r1(cx)} ${r1(cy)}) rotate(${rot})" fill="${P.paper}" fill-opacity="${op}"/>`
export type LabelOpts = { size?: number; weight?: number; ls?: number; fill?: string; ink?: string; under?: string; rot?: number; padX?: number; h?: number; seed?: string }
/** A paper label, the skin's title style (the band's name, every card title). */
export const label = (x: number, y: number, text: string, o: LabelOpts = {}): { svg: string; w: number } => {
  const { size = 9.5, weight = 800, ls = 1.5, fill = P.paper, ink = P.ink, under = '#000', rot = -1.2, padX = 7, h = 16, seed = text } = o
  const w = r1(er2W(text, size, ls, weight) + padX * 2)
  return { w, svg: `<g transform="rotate(${rot} ${r1(x + w / 2)} ${r1(y + h / 2)})">${paper(x, y, w, h, seed, fill, under, 1.5, 'trbl', [1.2, 1.6])}${T(x + padX, y + h / 2 + size * 0.36, text, size, weight, ink, `letter-spacing="${ls}"`)}</g>` }
}
/** Shards: irregular triangles in the given colours. */
export const shards = (x: number, y: number, w: number, h: number, n: number, seed: string, cols: string[], smin = 3, smax = 11): string => {
  const R = rng(seed)
  let s = ''
  for (let i = 0; i < n; i++) {
    const cx = x + R() * w
    const cy = y + R() * h
    const sz = smin + R() * (smax - smin)
    const a = R() * 6.283
    const pt = (ang: number, rr: number) => `${r1(cx + Math.cos(ang) * rr)} ${r1(cy + Math.sin(ang) * rr)}`
    s += `<path d="M${pt(a, sz)}L${pt(a + 2.1 + R() * 0.7, sz * (0.35 + R() * 0.4))}L${pt(a + 4 + R() * 0.6, sz * (0.5 + R() * 0.5))}Z" fill="${cols[Math.floor(R() * cols.length)]}"/>`
  }
  return s
}
/** Capri's pink lightning: a jagged line with a white core. */
export const bolt = (x1: number, y1: number, x2: number, y2: number, seed: string, seg = 6, amp = 5, wdt = 1.8, col = P.hot): string => {
  const R = rng(seed)
  const pts: [number, number][] = [[x1, y1]]
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  for (let i = 1; i < seg; i++) {
    const f = i / seg
    const o = (i % 2 ? 1 : -1) * amp * (0.4 + R() * 0.8)
    pts.push([x1 + dx * f + nx * o, y1 + dy * f + ny * o])
  }
  pts.push([x2, y2])
  const p = pts.map(q => `${r1(q[0])},${r1(q[1])}`).join(' ')
  return `<polyline points="${p}" fill="none" stroke="${col}" stroke-width="${wdt}" stroke-linejoin="miter" stroke-linecap="square"/><polyline points="${p}" fill="none" stroke="${P.white}" stroke-width="${r1(wdt * 0.35)}"/>`
}
/** Static: single pixels. */
export const grain = (x: number, y: number, w: number, h: number, n: number, seed: string, col = '#fff'): string => {
  const R = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const big = R() < 0.2 ? 1.4 : 0.8
    d += `M${r1(x + R() * w)} ${r1(y + R() * h)}h${big}v${big}h-${big}z`
  }
  return `<path d="${d}" fill="${col}" opacity=".75"/>`
}
/** The key art's concentric eye. */
export const eyeRings = (cx: number, cy: number, r: number, ring = P.mag, base = P.ink): string =>
  `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${base}"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.8)}" fill="none" stroke="${ring}" stroke-width="${r1(r * 0.1)}"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.52)}" fill="none" stroke="${ring}" stroke-width="${r1(r * 0.09)}"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.25)}" fill="${ring}"/>`
/** A torn hole: a jagged radial outline. */
export const burst = (cx: number, cy: number, rx: number, ry: number, seed: string, n = 46, depth = 0.22): string => {
  const R = rng(seed)
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + (R() - 0.5) * 0.06
    const k = 1 - R() * depth * (R() < 0.25 ? 2 : 1)
    pts.push(`${r1(cx + Math.cos(a) * rx * k)} ${r1(cy + Math.sin(a) * ry * k)}`)
  }
  return `M${pts.join('L')}Z`
}
/** The tear gauge: a night-teal slot filled with magenta paper whose leading edge is ripped. */
export const tearGauge = (x: number, y: number, w: number, h: number, pct: number, seed: string, fill = P.mag, under = P.crim, track = P.track): string => {
  const fw = Math.max(0, w * clamp(pct, 0, 100) / 100)
  const j = Math.min(3, h * 0.5)
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${h}" rx="1" fill="${track}"/>${fw > 2 ? `<path d="${torn(x, y, fw, h, `${seed}u`, j, 'r')}" fill="${under}" transform="translate(1.6 0)"/><path d="${torn(x, y, fw, h, seed, j, 'r')}" fill="${fill}"/>` : ''}`
}

// --- pixel sprites ------------------------------------------------------------------
/** A sprite as crisp rects, merged into one path per colour. `t` takes `tint`. */
export const pixels = (sp: Sprite, x: number, y: number, size: number, tint = P.cobalt, rim?: string): string => {
  const d = new Map<string, string[]>()
  const colorOf = (ch: string | undefined): string | undefined => (ch === undefined || ch === '.' ? undefined : ch === 't' && !sp.pal.t ? tint : sp.pal[ch])
  const add = (c: string, i: number, j: number, n: number) => {
    if (!d.has(c)) d.set(c, [])
    d.get(c)?.push(`M${r1(x + i * size)} ${r1(y + j * size)}h${r1(n * size)}v${r1(size)}h-${r1(n * size)}z`)
  }
  const filled = (i: number, j: number) => colorOf(sp.rows[j]?.[i]) !== undefined
  const w = Math.max(...sp.rows.map(r => r.length))
  if (rim) for (let j = -1; j <= sp.rows.length; j++) for (let i = -1; i <= w; i++) if (!filled(i, j) && (filled(i + 1, j) || filled(i - 1, j) || filled(i, j + 1) || filled(i, j - 1))) add(rim, i, j, 1)
  sp.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] as string
      const c = colorOf(ch)
      if (c === undefined) continue
      let n = 1
      while (row[i + n] === ch) n++
      add(c, i, j, n)
      i += n - 1
    }
  })
  return `<g>${[...d.entries()].map(([c, p]) => `<path d="${p.join('')}" fill="${c}"/>`).join('')}</g>`
}
const RUNNERS = [ER_RUNNER, ER_RUNNER2, ER_RUNNER3]

// A sprite through the cast's own drawing (its hair sways, its eyes flicker, its lightning pulses),
// the top-left of its box at (x, y) and `k` px per sprite pixel.
const spriteAt = (sp: Sprite, x: number, y: number, k: number, extra: string): string => {
  const w = Math.max(...sp.rows.map(r => r.length))
  return `<g class="ch" transform="translate(${r1(x)} ${r1(y)}) scale(${r1(k)})" ${extra} shape-rendering="crispEdges"><g transform="scale(${r1(1 / 0.5625)})">${spriteMarkup(sp, P.hot, w, sp.rows.length).replace(/^<g transform="translate\([^)]*\) scale\([^)]*\)">/, '<g transform="scale(0.5625)">')}</g></g>`
}
export const BUST_W = 42
export const BUST_H = 48
/** Capri's portrait (ER_CAPRI_BUST): the BIOCHIP's core and the mask in miniature. */
export const capriBust = (x: number, y: number, k: number, extra = ''): string => spriteAt(ER_CAPRI_BUST, x, y, k, extra)
/** Capri, big (ER_CAPRI_BIG, 42 by 96): the takeover. */
export const capriBig = (x: number, y: number, k: number, extra = ''): string => spriteAt(ER_CAPRI_BIG, x, y, k, extra)

// --- the palettes: the skin, and the secret skin where Capri owns the paper ----------
export type Pal = { bg: string; raised: string; line: string; text: string; sub: string; muted: string; track: string; fill: string; fillInk: string; under: string; lbl: string; lblInk: string; edge: string; d: string; dT: string; pill: string; pillInk: string; accentT: string; hotT: string }
export const palOf = (sec: boolean): Pal =>
  sec
    ? { bg: P.mag, raised: '#E0023F', line: '#B8003A', text: P.black, sub: '#22030C', muted: '#2A0510', track: '#B0003A', fill: P.black, fillInk: P.green, under: '#000', lbl: P.black, lblInk: P.green, edge: P.black, d: P.black, dT: P.black, pill: P.black, pillInk: P.green, accentT: P.black, hotT: P.black }
    : { bg: P.ink, raised: P.ink2, line: P.line, text: P.text, sub: P.sub, muted: P.muted, track: P.track, fill: P.mag, fillInk: P.ink, under: P.crim, lbl: P.paper, lblInk: P.ink, edge: P.mag, d: P.cobalt, dT: P.cobaltT, pill: P.cobalt, pillInk: P.white, accentT: P.cobaltT, hotT: P.pink }

// --- the episodes (titles only, never synopses) ---------------------------------------
export const ER2_EPISODES = ['Last Chance for a Slow Dance', 'Give Me Another Day', '0+2=1', 'Someone That I Used to Know', 'Fades (Pass the Distance)', 'Everything Hate', 'To the Depths with You', 'Serce', 'Strictly Reserved for You', 'Then Everyone Went Home']
/** The hour's episode: "EP 03 0+2=1". */
export const er2EpisodeAt = (at: number): string => {
  const i = Math.floor(at / 3_600_000) % 10
  return `EP ${String(i + 1).padStart(2, '0')} ${ER2_EPISODES[i]}`
}

export const ER2_GREETING = 'No signal, no survival. Wake up, choom.'
export const CAPRICORN_GREETING = "We're one now."
export const ER2_BOOT: [string, string] = ['SYNCING BIOCHIP · handshake with D…', 'LINKED · No signal, no survival.']
export const ER2_WARNING = (ctx: number): string => (ctx >= 95 ? "Capri's awake. /compact now, choom." : "Chip's running hot. /compact soon.")
export const ER2_WORDS = ['Syncing the chip', 'Reading the engram', 'Rolling tape', 'Pasting it up', 'Asking Sal', "Calling King's crew", 'Crossing the Badlands', 'Riding through Watson']
export const ER2_TITLE_WORDS = ['Slow Dance', 'Another Day', 'Fades', 'Serce', 'Strictly Reserved', 'Everyone Went Home']
/** Roman's camera words, in place of season 1's hacking verbs. */
export const ER2_TOOLS: Record<string, string> = { Read: 'Pan', Grep: 'Zoom', Glob: 'Wide shot', LS: 'Wide shot', Edit: 'Cut', MultiEdit: 'Cut', NotebookEdit: 'Cut', Write: 'Print', Bash: 'Action', PowerShell: 'Action', Agent: 'Cast', WebFetch: 'B-roll', WebSearch: 'Scout', ToolSearch: 'Ask Sal' }
/** The secret skin's unlock: the ep 3 title in a prompt, or "hi capri" within a minute of a takeover. */
export const CAPRICORN_RE = /0\s*\+\s*2\s*=\s*1/
export const HI_CAPRI_RE = /\bhi,?\s+capri\b/i
export const HI_CAPRI_MS = 60_000

// --- motion ----------------------------------------------------------------------------
export const ER2_CSS = `${CAST_CSS}.rec{animation:er-rec 1.2s steps(1) infinite}@keyframes er-rec{50%{opacity:.25}}
.er-chip{animation:er-ch 2s steps(1) infinite}@keyframes er-ch{50%{opacity:.35}}
.er-eye{animation:er-eye 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes er-eye{50%{transform:scale(.8)}}
.er-drift{animation:er-dr 3s ease-in-out infinite alternate}@keyframes er-dr{to{transform:translateY(1px)}}
.er-ep{animation:er-ep .25s steps(2) both;transform-box:fill-box;transform-origin:center}@keyframes er-ep{from{transform:rotate(-3deg) scale(.96)}to{transform:none}}
.er-fresh{animation:er-fr .5s steps(1) 3}@keyframes er-fr{50%{opacity:.2}}
.er-drop{animation:er-dp .35s cubic-bezier(.2,.9,.3,1) both}@keyframes er-dp{from{transform:translateY(-6px) rotate(2deg);opacity:0}}
.er-in{animation:er-in .3s ease-out both}@keyframes er-in{from{transform:translateX(6px);opacity:0}}
.er-cheer{animation:er-cheer .9s steps(1) 3}@keyframes er-cheer{33%{opacity:.15}66%{opacity:.9}}
@media (prefers-reduced-motion: reduce){.rec,.er-chip,.er-eye,.er-drift,.er-ep,.er-fresh,.er-drop,.er-in,.er-cheer{animation:none}}
`

// --- the band's pieces -------------------------------------------------------------------
export const ER2_BAND_H = 132
export type BandTheme = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }

/** The context chip past 85%: CHIP HOT, then CAPRI'S AWAKE (acid-green paper, her portrait, two sparks). `y` is the header's baseline. */
export const er2Chip = (x: number, y: number, pct: number, sec: boolean): { svg: string; w: number } => {
  if (pct < 85) return { svg: '', w: 0 }
  const top = y - 11
  const awake = pct >= 95
  const txt = awake ? "CAPRI'S AWAKE" : 'CHIP HOT'
  const w = r1(er2W(txt, 9.5, 1.2, 800) + 34)
  if (!awake) {
    const chip = `<g transform="translate(${x + 8} ${top + 4})"><rect width="11" height="8" rx="1" fill="${P.ink}"/>${[1.5, 4.5, 7.5].map(q => `<rect x="${q}" y="-2" width="1.4" height="2" fill="${P.ink}"/><rect x="${q}" y="8" width="1.4" height="2" fill="${P.ink}"/>`).join('')}<rect x="3" y="2.4" width="5" height="3.2" fill="${P.mag}"/></g>`
    return { w, svg: `<g>${paper(x, top, w, 16, 'chiphot', sec ? P.black : P.mag, sec ? '#000' : P.crim, 1.6)}${chip}${T(x + 25, top + 11.6, txt, 9.5, 800, sec ? P.green : P.ink, 'letter-spacing="1.2"')}</g>` }
  }
  // Her portrait in miniature: the crown and the eyes, 0.25 of the mask's size.
  const mini = `<rect x="${x + 5}" y="${top + 2}" width="14" height="12" fill="${P.black}"/>${capriBust(x + 5.8, top + 2.6, 0.3)}`
  return { w, svg: `<g class="er-chip">${paper(x, top, w, 16, 'awake', P.green, P.hotD, 1.6, 'trbl', [1.4, 1.8])}${mini}${T(x + 25, top + 11.6, txt, 9.5, 800, P.black, 'letter-spacing="1.2"')}${bolt(x + w - 4, top - 5, x + w + 9, top + 3, 'sp1', 3, 2, 1.3)}${bolt(x - 2, top + 18, x + 9, top + 23, 'sp2', 3, 2, 1.1)}</g>` }
}

/** The header's name: the MISSION CONTROL paper label, D's shoulder patch, and his line (shorter, then gone, as the band narrows). */
export const er2Name = (x: number, y: number, W: number, sec: boolean): { svg: string; w: number } => {
  const C = palOf(sec)
  const L = label(x, y - 11, 'MISSION CONTROL', { fill: C.lbl, ink: C.lblInk, seed: 'mc' })
  const px = x + L.w + 12
  const patch = `<g transform="rotate(1.5 ${px + 8} ${y - 3})">${paper(px, y - 11, 16, 16, 'dpatch', C.d, sec ? '#000' : '#1E3E7A', 1.2)}${T(px + 4.2, y + 1.2, sec ? 'C' : 'D', 12, 800, sec ? P.green : P.white)}</g>`
  const id = sec ? 'HOST · 0+2=1' : W >= 1100 ? 'SNAKE NATION · NETRUNNER' : W >= 900 ? 'SNAKE NATION' : ''
  const idW = id ? er2W(id, 9.5, 1.3, 800) : 0
  return { w: L.w + 12 + 16 + (id ? 7 + idW : 0), svg: `${L.svg}${patch}${id ? T(px + 23, y + 0.5, id, 9.5, 800, C.dT, 'letter-spacing="1.3"') : ''}` }
}

/** The episode strip, right-aligned at `xr`: torn magenta paper with tape on its left end. Full: code and title; short: the code. */
export const er2EpW = (code: string, title: string, full: boolean): number => r1(er2W(code, 9.5, 1, 800) + 8 + (full ? er2W(title, 12.5, 0, 700) + 14 : 0) + 14)
export const er2Ep = (xr: number, y: number, code: string, title: string, full: boolean, sec: boolean): string => {
  const C = palOf(sec)
  const w = er2EpW(code, title, full)
  const ex = r1(xr - w)
  return `<g class="er-ep"><g transform="rotate(${sec ? 1 : -0.8} ${r1(ex + w / 2)} ${y - 3})">${paper(ex, y - 12, w, 18, `ep${title}`, sec ? P.black : P.mag, C.under, 1.8)}${T(ex + 10, y + 0.6, code, 9.5, 800, sec ? P.green : P.ink, 'letter-spacing="1"')}${full ? T(ex + 18 + er2W(code, 9.5, 1, 800), y + 1.4, title, 12.5, 700, sec ? P.green : P.ink, 'font-style="italic"') : ''}</g>${tape(ex + 4, y - 11, 16, 7, -24, 'ept', sec ? 0.8 : 0.62)}</g>`
}

/** D's figure in the task row, in the 34 by 40 box at (20, 36); Capri herself in the secret skin (a pixel sprite, with her rim). */
export const er2Figure = (sec: boolean): string => (sec ? pixels(ER_CAPRI, 26, 35, 0.86, P.hot, P.green) : pixels(ER_D, 31, 36, 0.85, P.cobalt))

/** One crew member (a teal-jacket runner) at the top-left of its 7 by 18 box, the jacket in the role's colour. */
export const er2Crew = (x: number, y: number, color: string, sec: boolean): string => pixels(RUNNERS[hash(color) % 3] as Sprite, x, y, 0.38, sec ? P.black : color)
/** A step pip, centred at (cx, cy): a small torn square, tilted either way. */
export const er2Pip = (st: string, cx: number, cy: number, t: BandTheme, sec: boolean): string => {
  const C = palOf(sec)
  const rot = hash(`${cx}`) % 2 ? 4 : -4
  const at = `transform="rotate(${rot} ${cx} ${cy})"`
  if (st === 'done') return `<path d="${torn(cx - 5, cy - 5, 10, 10, `pd${cx}`, 1.4)}" fill="${sec ? P.black : P.mag}" ${at}/>`
  if (st === 'running') return `<path class="rec" d="${torn(cx - 5, cy - 5, 10, 10, `pr${cx}`, 1.4)}" fill="${sec ? P.green : P.cobalt}" ${at}/>`
  if (st === 'failed') return `<path d="M${cx - 3.2} ${cy - 3.2}l6.4 6.4M${cx + 3.2} ${cy - 3.2}l-6.4 6.4" stroke="${t.alert}" stroke-width="1.8" stroke-linecap="round"/>`
  return `<rect x="${r1(cx - 4.5)}" y="${r1(cy - 4.5)}" width="9" height="9" fill="none" stroke="${C.muted}" stroke-width="1.2" ${at}/>`
}
/** The tear gauge in the task row. */
export const er2Tear = (x: number, y: number, w: number, pct: number, sec: boolean): string => {
  const C = palOf(sec)
  return tearGauge(x, y, w, 8, pct, `g${Math.round(pct)}`, C.fill, C.under, C.track)
}
/** The strip along the foot: the torn left edge, the possession creep from 95% on, and in the corner Capri's eye. */
export const er2Foot = (W: number, H: number, sec: boolean, ctx: { ctxPct: number; overBudget: boolean; isWorking?: boolean }): string => {
  const C = palOf(sec)
  const cid = uniq('erclip')
  const near = ctx.ctxPct >= 95 || sec
  let s = `<defs><clipPath id="${cid}"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="9.5"/></clipPath></defs><g clip-path="url(#${cid})">`
  if (sec) s += grain(0, 0, W, H, Math.min(420, Math.round((W * H) / 300)), 'secgrain', '#fff') + shards(W - 420, -5, 400, 9, 16, 'secsh', [P.black, P.green, P.white], 2.5, 6) + shards(10, H - 4, 600, 7, 18, 'secsh2', [P.black, P.green], 2, 5)
  const edge = sec ? P.black : ctx.isWorking === false ? P.paper2 : P.mag
  s += `<path d="${torn(-4, -4, 14, H + 8, 'edge', 3.4, 'r')}" fill="${sec ? '#000' : P.crim}" transform="translate(1.5 0)"/><path d="${torn(-4, -4, 14, H + 8, 'edge', 3.4, 'r')}" fill="${edge}"/>`
  // Possession creep: shards in the top and bottom margins only, so none sits under a number.
  if (ctx.ctxPct >= 95 && !sec) s += `<g class="er-drift">${shards(10, -4, 300, 7, 16, 'creepT', [P.hot, P.green, P.hotD], 2, 5.5)}${shards(10, H - 4, 420, 6, 18, 'creepB', [P.hot, P.green, P.hotD], 2, 5)}${bolt(12, 3, 70, 5, 'cb1', 5, 2, 1.1)}</g>`
  s += '</g>'
  if (near || ctx.overBudget) s += `<g opacity="${sec ? 1 : 0.9}" class="er-eye">${eyeRings(W - 14, H - 12, 6, sec ? P.black : P.green, sec ? P.green : P.black)}<circle cx="${W - 14}" cy="${H - 12}" r="1.7" fill="${P.eye}"/></g>`
  return s
}
/** The job-done cheer: paper scraps and a taped note. */
export const er2Cheer = (W: number, H: number, _font: string, _t: BandTheme, startAt: number | undefined, sec: boolean): string => {
  const at = startAt ? pin(startAt) : '0s'
  const text = 'JOB DONE, CHOOM.'
  const w = r1(er2W(text, 15, 1.4, 800) + 30)
  const cx = W / 2
  const cy = H / 2
  return `<g class="er-cheer" style="animation-delay:${at}">${shards(cx - 150, cy - 40, 300, 80, 14, 'cheer', [P.mag, P.paper, sec ? P.black : P.cobalt], 4, 9)}<g transform="rotate(-1.5 ${cx} ${cy})">${paper(cx - w / 2, cy - 14, w, 26, 'cheernote', sec ? P.black : P.paper, '#000', 2)}${T(cx, cy + 5, text, 15, 800, sec ? P.green : P.ink, 'text-anchor="middle" letter-spacing="1.4"')}</g>${tape(cx - w / 2 + 6, cy - 14, 22, 8, -30, 'ch1')}</g>`
}

// --- the takeover ----------------------------------------------------------------------------
// The paper tears open from the middle, the key art's eyes settle in, pink bolts strobe (at most two
// flashes), ER_CAPRI_BIG rises, the line is pasted up glyph by glyph on ransom-note scraps, and the whole
// layer rips out along a jagged vertical seam. Reduced motion: one still taped note, no cover.
export const TK_CSS = `.tk{animation:tk-all 3.5s linear both}
.tk-scrim{animation:tk-sc .3s linear both}
@keyframes tk-sc{from{opacity:0}to{opacity:1}}
.tk-tear{animation:tk-te .4s cubic-bezier(.2,.9,.2,1) both;transform-box:fill-box;transform-origin:50% 50%}
@keyframes tk-te{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
.tk-eye{animation:tk-ey .5s ease-out both;transform-box:fill-box;transform-origin:center}
@keyframes tk-ey{from{transform:rotate(-8deg);opacity:0}to{transform:none;opacity:1}}
.tk-sh{animation:tk-sh .4s ease-out both}
@keyframes tk-sh{from{transform:translate(12px,-12px);opacity:0}to{transform:none;opacity:1}}
.tk-bolt{animation:tk-bo .4s steps(1) both}
@keyframes tk-bo{0%,100%{opacity:0}25%,50%{opacity:1}}
.tk-big{animation:tk-bg .5s cubic-bezier(.2,.9,.2,1) both;transform-box:fill-box;transform-origin:50% 100%}
@keyframes tk-bg{from{transform:translateY(10px) scale(.85);opacity:0}to{transform:none;opacity:1}}
.rn{animation:tk-rn .14s ease-out both;transform-box:fill-box;transform-origin:center}
@keyframes tk-rn{from{transform:scale(1.4);opacity:0}to{transform:none;opacity:1}}
.tk-L{animation:tk-l .6s ease-in both}
@keyframes tk-l{to{transform:translateX(-18px) rotate(-2deg);opacity:0}}
.tk-R{animation:tk-r .6s ease-in both}
@keyframes tk-r{to{transform:translateX(18px) rotate(2deg);opacity:0}}
.tk-still{display:none}
@media (prefers-reduced-motion: reduce){.tk{display:none}.tk-still{display:block}.tk-scrim,.tk-tear,.tk-eye,.tk-sh,.tk-bolt,.tk-big,.rn,.tk-L,.tk-R{animation:none}}
`
const delayer = (startAt: number | undefined, tm: RoamTiming): ((x: number) => string) => {
  if (tm.delay) return x => `calc(${tm.delay} + ${r1(x)}s)`
  const base = tm.now !== undefined && startAt !== undefined ? (startAt - tm.now) / 1000 : 0
  return x => `${r1(base + x)}s`
}
// The ransom-note line: every glyph on its own torn scrap (paper with ink, or black with green), pasted one per 70 ms.
const ransom = (cx: number, y: number, text: string, size: number, seed: string, dly: (x: number) => string, sec: boolean): string => {
  const R = rng(seed)
  const chars = [...text]
  const ws = chars.map(ch => (ch === ' ' ? size * 0.35 : er2W(ch, size, 0, 800) + size * 0.42))
  let x = cx - ws.reduce((a, b) => a + b, 0) / 2
  let s = ''
  chars.forEach((ch, i) => {
    const w = ws[i] as number
    if (ch === ' ') {
      x += w
      return
    }
    const h = size * 1.32
    const rot = (R() - 0.5) * 12
    const dy = (R() - 0.5) * size * 0.25
    const ink = i % 3 === 1 || sec
    const f = ink ? P.black : P.paper
    const tx = ink ? P.green : P.ink
    s += `<g class="rn" style="animation-delay:${dly(1.1 + i * 0.07)}" transform="rotate(${r1(rot)} ${r1(x + w / 2)} ${r1(y + dy)})"><rect x="${r1(x + 1.2)}" y="${r1(y + dy - h * 0.72 + 1.6)}" width="${r1(w - 2)}" height="${r1(h)}" fill="#000"/><path d="${torn(x, y + dy - h * 0.72, w - 2, h, `${seed}${i}`, 1.6)}" fill="${f}"/>${T(x + (w - 2) / 2, y + dy + size * 0.12, ch, size, 800, tx, 'text-anchor="middle"')}</g>`
    x += w
  })
  return s
}
/** The takeover for a panel (W × H): `tm.delay` (a pinned start) or `tm.now` + `tm.startAt` set where it is in its 3.5 s. */
export const er2Takeover = (W: number, H: number, line: string, tm: RoamTiming, sec: boolean): string => {
  const dly = delayer(tm.startAt, tm)
  const cx = W / 2
  const mid = H * 0.46
  const text = line || 'hi, choom.'
  const small = H < 200
  const id = uniq('tk')
  const cover = clamp(Math.round(Math.min(W * 0.075, H * 0.14)), 14, 42)
  // The still note (reduced motion): taped, bottom centre.
  const nw = 200
  const nh = 46
  const nx = cx - nw / 2
  const ny = H - nh - 18
  const still = `<g class="tk-still">${paper(nx, ny, nw, nh, 'rnote', sec ? P.black : P.paper, '#000', 2.4)}${tape(nx + 10, ny + 2, 26, 9, -32, 'rn1')}${tape(nx + nw - 10, ny + 2, 26, 9, 32, 'rn2')}<rect x="${nx + 10}" y="${ny + 8}" width="30" height="30" fill="${P.black}"/>${capriBust(nx + 11.4, ny + 9.2, 0.55)}${T(nx + 50, ny + 22, text, 16, 800, sec ? P.green : P.ink)}${T(nx + 50, ny + 36, 'Capri · only you can see her', 10, 600, sec ? P.green : '#4A4440')}</g>`
  // The layer: scrim, torn paper, eyes, shards, bolts, Capri, the line.
  const bgPaper = sec ? P.crim : P.crim
  const figH = small ? H - 14 : Math.min(H * 0.7, (mid + Math.min(H * 0.24, 118)) - H * 0.1)
  const k = r1(figH / 54)
  const figW = 23.6 * k
  const floor = small ? H - 6 : mid + Math.min(H * 0.24, 118)
  const fx = small ? W * 0.3 : cx
  let layer = `<rect class="tk-scrim" width="${W}" height="${H}" fill="${P.black}" style="animation-delay:${dly(0)}"/>`
  layer += `<g class="tk-tear" style="animation-delay:${dly(0.2)}"><path d="${burst(cx, mid, W * 0.66, H * 0.6, 'tkc')}" fill="${bgPaper}"/><path d="${burst(cx, mid, W * 0.57, H * 0.52, 'tkm', 52, 0.26)}" fill="${P.mag}"/>${grain(0, 0, W, H, Math.min(220, Math.round((W * H) / 240)), 'tkg')}</g>`
  layer += `<g class="tk-eye" style="animation-delay:${dly(0.4)}">${eyeRings(W * 0.16, H * 0.2, Math.min(W, H) * 0.12)}${eyeRings(W * 0.86, H * 0.78, Math.min(W, H) * 0.15)}</g>`
  layer += `<g class="tk-sh" style="animation-delay:${dly(0.4)}" opacity=".95">${shards(W * 0.04, H * 0.05, W * 0.92, H * 0.9, 22, 'tkw', [P.paper, P.white, P.black], 6, 22)}</g>`
  // Pink bolts strobe on once or twice (under 3 Hz).
  layer += [[0.5, 0.18, 0.2, 0.02], [0.5, 0.2, 0.86, 0.06], [0.5, 0.6, 0.1, 0.9], [0.52, 0.6, 0.92, 0.94], [0.48, 0.3, 0.02, 0.42]]
    .map(([a, b, c, d], i) => `<g class="tk-bolt" style="animation-delay:${dly(0.5 + (i % 2) * 0.2)}">${bolt(W * (a as number), H * (b as number), W * (c as number), H * (d as number), `tkb${i}`, 7, 9, 2.4)}</g>`)
    .join('')
  layer += `<path d="${burst(fx, floor - figH * 0.5, figW * 0.95, figH * 0.56, 'tkh', 30, 0.2)}" fill="${P.black}" opacity=".85"/>`
  layer += `<g class="tk-big" style="animation-delay:${dly(0.6)}">${capriBig(fx - figW / 2, floor - figH, k, 'style="filter:drop-shadow(0 0 3px #FF2E7E)"')}</g>`
  layer += small ? ransom(W * 0.62, H * 0.6, text, Math.min(30, H * 0.26), 'rn', dly, sec) : ransom(cx, floor + cover * 1.45 > H - 6 ? H - 10 : floor + cover * 1.45, text, cover, 'rn', dly, sec)
  // The rip out: two copies of the layer, split by a jagged vertical seam, slide apart.
  const R = rng('seam')
  const seam: number[] = []
  for (let y = 0; y <= H; y += 8) seam.push(r1(cx + (R() - 0.5) * 18))
  const left = `M0 0L${seam.map((x, i) => `${x} ${i * 8}`).join('L')}L${seam[seam.length - 1]} ${H}L0 ${H}Z`
  const right = `M${W} 0L${seam.map((x, i) => `${x} ${i * 8}`).join('L')}L${seam[seam.length - 1]} ${H}L${W} ${H}Z`
  return `<defs><clipPath id="${id}l"><path d="${left}"/></clipPath><clipPath id="${id}r"><path d="${right}"/></clipPath><g id="${id}g">${layer}</g></defs><g class="tk" pointer-events="none"><g class="tk-L" style="animation-delay:${dly(2.9)}" clip-path="url(#${id}l)"><use href="#${id}g"/></g><g class="tk-R" style="animation-delay:${dly(2.9)}" clip-path="url(#${id}r)"><use href="#${id}g"/></g></g>${still}`
}

// --- Capri's own pieces for the roamer ----------------------------------------------------------
/** Her peek at a spot on the band (the left end of the episode strip): her portrait, half size, leaning out, with one bolt; it glitches in and out like her other acts. */
export const er2Peek = (x: number, y: number, plan: RoamPlan, tm: RoamTiming): string => {
  const dly = delayer(plan.startAt, tm)
  const dur = plan.durMs / 1000
  return `<g class="rm-pk"><g class="rm-in" style="animation-delay:${dly(0)}"><g class="rm-out" style="animation-delay:${dly(dur - 0.45)}"><g transform="rotate(-10 ${r1(x - 9)} ${r1(y)})" style="filter:drop-shadow(0 0 2px ${P.hot})">${capriBust(x - 19.5, y - 17, 0.5)}</g>${bolt(x - 34, y - 14, x - 20, y - 6, 'pk1', 3, 2, 1.2)}</g></g></g>`
}
/** Where she peeks and sits on a pane card (W by H): out from the right strips, and on the chip's top. */
export const er2PaneSpots = (W: number, H: number): { peek?: { x: number; y: number }; sit?: { x: number; y: number } } => ({ peek: { x: W - 30, y: Math.min(H - 6, 152) }, sit: { x: 150, y: 74 } })
/** Past 95% context, shards creep in along the card's top edge (and a bolt), never under a label. */
export const er2PaneCreep = (W: number, _H: number, ctxPct: number): string => (ctxPct >= 95 ? `<g class="er-drift">${shards(W * 0.3, -3, W * 0.65, 6, 12, 'pcreep', [P.hot, P.green, P.hotD], 2, 5)}${bolt(W * 0.32, 3, W * 0.45, 5, 'pcb', 5, 2, 1.1)}</g>` : '')
