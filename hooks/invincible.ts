// Invincible (fan homage to Robert Kirkman, Cory Walker, Ryan Ottley, Image Comics, Skybound and Amazon MGM Studios): the tokens,
// type, motion, drawing primitives and the slim band's hooks. Two eras in one skin: era 1 the classic suit (S1-S2), era 2 the new
// suit (S3+). People are only ever the approved pixel sprites (invincible-sprites.ts); effects around them are drawn. Cartoon,
// never gory. Pure SVG strings and tables, no state. The cards are in invincible-cards.ts, the big eggs (the fight, the
// showdown, the era swap) in invincible-eggs.ts and invincible-fight.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as SP from './invincible-sprites'
import { pin } from './smooth'

export { SP, pin }
export type Era = 1 | 2
export const ERA1 = {
  tile: '#0E1322', tile2: '#151C30', line: '#273354', track: '#1A2340',
  a: '#3D7FE0', aT: '#8FC0FF', hero: '#F5C518', heroInk: '#0B0D14', text: '#F3F5FA', sub: '#B9C3D8', muted: '#8C98B3',
  done: '#7FD39A', warn: '#F5C518', alert: '#E8453C', name: 'classic', season: 'S1',
}
// Era 2: the new suit. Light blue and platinum on black.
export const ERA2 = {
  tile: '#0A0B10', tile2: '#13151C', line: '#262B36', track: '#181B24',
  a: '#3F8FE0', aT: '#8BC6FF', hero: '#6FB4F5', heroInk: '#07090E', text: '#F4F6FA', sub: '#B6BFCC', muted: '#8893A6',
  done: '#7FD39A', warn: '#F5C518', alert: '#E8453C', name: 'new suit', season: 'S3',
}
export const pal = (era: any): Record<string, any> => (era === 2 ? ERA2 : ERA1)
// Props keep their own colours in both eras.
export const PROPS: Record<string, string> = {
  ink: '#0B0D14', paper: '#F1E9D2', paperDark: '#D9CFB2', captionYellow: '#F5C518', red: '#C0272D', redDeep: '#8E1C22', white: '#FFFFFF',
  skyLight: '#9FD0FF', sky: '#5AA8F0', eve: '#F28CB1', evePale: '#FFD6E6', gda: '#5E6B73', gdaDark: '#2A3238', screen: '#0F1417', screenText: '#CFE3D8', screenGreen: '#7FE0A8',
  flash: '#FFFFFF', star: '#FFE066', allen: '#C9D64A', allenDark: '#7E8A2A', mug: '#C9D9E6', coffee: '#4A2E1B', burger: '#D9893B', bun: '#E9B86B',
  s1: '#FFF209', s2: '#0D3A4D', s3: '#E5E4E2', s4: '#F08D35',
}
export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI','Noto Sans',sans-serif"
export const COND = "'Avenir Next Condensed','Roboto Condensed','Arial Narrow',Bahnschrift,sans-serif"
export const MONO = "ui-monospace,Menlo,Consolas,monospace"

// ---------------------------------------------------------------- helpers
export const esc = (s: any) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const r1 = (n: any) => +(+n).toFixed(1)
export const clamp = (n: any, a: any, b: any) => Math.max(a, Math.min(b, n))
export const hash = (s: any) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 } return h }
export const unit = (s: any) => { let h = hash(s); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
export const rng = (seed: any) => { let a = hash(seed) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
let uid = 0
export const uniq = (p: any) => `${p}${(uid = (uid + 1) % 100000)}`
export const hex3 = (h: any) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
export const lum = (h: any) => { const [r = 0, g = 0, b = 0] = hex3(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contrast = (a: any, b: any) => { const [x, y] = [lum(a), lum(b)]; return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(1) }
export const inkOn = (bg: any) => (lum(bg) > 0.18 ? PROPS.ink : '#FFFFFF')

// Width tables measured in Chrome (ratios of the font size).
export const sansW = (s: any, size: any, ls: any = 0, bold: any = false) => [...String(s)].reduce((w, ch) => w + (ch === ' ' ? (bold ? 0.26 : 0.29) : /[MW@%]/.test(ch) ? (bold ? 0.97 : 0.93) : /[A-Z]/.test(ch) ? (bold ? 0.72 : 0.68) : /[0-9]/.test(ch) ? (bold ? 0.66 : 0.61) : /[.,:;'|!il()[\]jtf·]/.test(ch) ? (bold ? 0.36 : 0.31) : /[mw]/.test(ch) ? (bold ? 0.89 : 0.82) : (bold ? 0.58 : 0.54)) * size + ls, 0)
export const condW = (s: any, size: any, ls: any = 0) => [...String(s)].reduce((w, ch) => w + (ch === ' ' ? 0.2 : /[MW]/.test(ch) ? 0.76 : /[A-Z&!?#]/.test(ch) ? (ch === 'I' ? 0.32 : 0.57) : /[0-9]/.test(ch) ? 0.56 : /[.,:;'·]/.test(ch) ? 0.25 : 0.5) * size + ls, 0)
export const monoW = (s: any, size: any) => [...String(s)].length * size * 0.6
export const clipBy = (wf: any, s: any, size: any, max: any, ls: any = 0, bold: any = false) => {
  s = String(s)
  if (wf(s, size, ls, bold) <= max) return s
  let lo = 0, hi = s.length
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (wf(`${s.slice(0, mid)}…`, size, ls, bold) <= max) lo = mid; else hi = mid - 1 }
  return lo <= 0 ? '' : `${s.slice(0, lo).trimEnd()}…`
}
export const clip = (s: any, size: any, max: any, ls: any = 0, bold: any = false) => clipBy(sansW, s, size, max, ls, bold)
export const clipC = (s: any, size: any, max: any, ls: any = 0) => clipBy(condW, s, size, max, ls)
export const clipM = (s: any, size: any, max: any) => clipBy(monoW, s, size, max)
export const T = (x: any, y: any, text: any, size: any, weight: any, fill: any, extra: any = '') => `<text x="${r1(x)}" y="${r1(y)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`
export const C = (x: any, y: any, text: any, size: any, fill: any, extra: any = '') => `<text x="${r1(x)}" y="${r1(y)}" font-family="${COND}" font-size="${size}" font-weight="800" fill="${fill}" ${extra}>${esc(text)}</text>`
export const M = (x: any, y: any, text: any, size: any, fill: any, extra: any = '') => `<text x="${r1(x)}" y="${r1(y)}" font-family="${MONO}" font-size="${size}" font-weight="500" fill="${fill}" ${extra}>${esc(text)}</text>`
export const durOf = (ms: any) => (ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)} h ${Math.round((ms % 3_600_000) / 60_000)} min` : ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`)
export const money = (usd: any) => (usd < 0.005 ? '$0' : `$${usd.toFixed(2)}`)
export const hhmm = (at: any) => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
export const spW = (sp: any) => sp.rows[0].length
export const spH = (sp: any) => sp.rows.length

// Pixel art from the binding sprites: crisp, grouped by colour, horizontal runs merged (3-5x fewer commands than a
// command per pixel). o.tint replaces the GDA agents' `t` pixels; o.rows draws a row window; o.flip mirrors; o.id names
// the group so <use> can repeat it without a second copy of its pixels.
export const px = (sp: any, x: any, y: any, s: any, o: any = {}) => {
  const rows: string[] = o.rows ? sp.rows.slice(o.rows[0], o.rows[1]) : sp.rows
  const w: number = sp.rows[0]?.length ?? 0
  const colOf = (ch: string): string | null => (ch === '.' ? null : ch === 't' ? (o.tint || sp.pal.t || '#2C4B4E') : sp.pal[ch] || null)
  const grid = rows.map(row => { const cells = [...row].map(colOf); if (o.flip) cells.reverse(); return cells })
  const used = grid.map(r => r.map(() => false))
  const by = new Map<string, string>()
  // Rectangles, not one box per pixel: a run is widened, then grown downward while the same run sits below.
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < w; c++) {
      const col = grid[r]?.[c]
      if (!col || used[r]?.[c]) continue
      let rw = 1
      while (c + rw < w && grid[r]?.[c + rw] === col && !used[r]?.[c + rw]) rw++
      let rh = 1
      for (; r + rh < grid.length; rh++) {
        let ok = true
        for (let i = 0; i < rw; i++) if (grid[r + rh]?.[c + i] !== col || used[r + rh]?.[c + i]) { ok = false; break }
        if (!ok) break
      }
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) (used[r + j] as boolean[])[c + i] = true
      by.set(col, `${by.get(col) ?? ''}M${c} ${r}h${rw}v${rh}h-${rw}z`)
    }
  }
  const inner = `<g shape-rendering="crispEdges" transform="translate(${r1(x)} ${r1(y)}) scale(${+(+s).toFixed(3)})"${o.id ? ` id="${o.id}"` : ''}>${[...by.entries()].map(([col, d]) => `<path d="${d}" fill="${col}"/>`).join('')}</g>`
  // A class that animates the transform (a bob) goes on a wrapper, so it does not replace the placement.
  return o.cls || o.op !== undefined ? `<g${o.op !== undefined ? ` opacity="${o.op}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${inner}</g>` : inner
}
// A sprite centred on the origin (its middle at 0,0) for the flight paths; `s` the pixel size; faces its drawn way.
export const spriteC = (sp: any, s: any, o: any = {}) => px(sp, -spW(sp) * s / 2, -spH(sp) * s / 2, s, o)

// ---------------------------------------------------------------- CSS (every animation has a reduced-motion fallback)
// The fight, the showdown and the swap each run ONE duration with keyframes in percent, so one pinned delay drives all.
export const CSS = `
.inv-blink{transform-box:fill-box;transform-origin:50% 50%;animation:inv-blink 6s steps(1) infinite}
@keyframes inv-blink{0%,3%{transform:scaleY(.1)}4%,100%{transform:none}}
.inv-wide{animation:inv-wide .8s steps(1) infinite}
@keyframes inv-wide{50%{transform:translateY(-1px)}}
.inv-bob{animation:inv-bob 1.6s steps(1) infinite}
@keyframes inv-bob{50%{transform:translateY(-1px)}}
.inv-run{animation:inv-run 1.2s steps(1) infinite}
@keyframes inv-run{50%{opacity:.35}}
.inv-chip{animation:inv-chip 1.6s ease-in-out infinite}
@keyframes inv-chip{50%{opacity:.72}}
.inv-steam{animation:inv-steam 2.4s steps(1) infinite}
@keyframes inv-steam{50%{transform:translateY(-1px);opacity:.5}}
.inv-rec{animation:inv-rec 1.4s steps(1) infinite}
@keyframes inv-rec{50%{opacity:.2}}
.inv-scan{animation:inv-scan 4s linear infinite}
@keyframes inv-scan{to{transform:translateY(12px)}}
.inv-twirl{transform-box:fill-box;transform-origin:50% 50%;animation:inv-twirl 1.2s linear infinite}
@keyframes inv-twirl{to{transform:rotate(360deg)}}
.inv-fresh{animation:inv-fresh 1.8s steps(1) both}
@keyframes inv-fresh{0%,16%,33%,50%{opacity:.2}8%,25%,41%,100%{opacity:1}}
.inv-stitch{transform-box:fill-box;transform-origin:50% 50%;animation:inv-stitch .5s cubic-bezier(.2,1.4,.4,1) both}
@keyframes inv-stitch{0%{transform:scale(0) rotate(-30deg)}}
.inv-stamp{transform-box:fill-box;transform-origin:50% 50%;animation:inv-stamp .4s cubic-bezier(.2,1.4,.4,1) both}
@keyframes inv-stamp{0%{transform:scale(2) ;opacity:0}60%{transform:scale(.94);opacity:1}100%{transform:scale(1)}}
.inv-cheer{animation:inv-cheer 2.6s steps(1) both}
@keyframes inv-cheer{0%,94%{opacity:1}95%,100%{opacity:0}}
.inv-flashf{animation:inv-flashf 2.6s steps(1) both}
@keyframes inv-flashf{0%,3%{opacity:.85}4%,100%{opacity:0}}
.inv-slam{transform-box:fill-box;transform-origin:50% 50%;animation:inv-slam 2.6s cubic-bezier(.2,1.2,.3,1) both}
@keyframes inv-slam{0%,4%{transform:scale(3.2);opacity:0}5%{opacity:1}18%{transform:scale(.96)}24%{transform:scale(1)}88%{transform:scale(1);opacity:1}100%{transform:scale(1.04) translateY(-6px);opacity:0}}
.inv-sub{animation:inv-sub 2.6s steps(1) both}
@keyframes inv-sub{0%,22%{opacity:0}23%,88%{opacity:1}89%,100%{opacity:0}}
.inv-cshake{animation:inv-cshake 2.6s steps(1) both}
@keyframes inv-cshake{18%{transform:translate(-2px,1px)}19%{transform:translate(2px,-1px)}20%{transform:translate(-1px,0)}21%,100%{transform:none}}
.inv-crack{animation:inv-crack 2.6s steps(1) both}
@keyframes inv-crack{0%,17%{opacity:0}18%,86%{opacity:1}87%,100%{opacity:0}}
.inv-think{animation:inv-think 3.2s steps(1) both}
@keyframes inv-think{0%{opacity:0}4%,88%{opacity:1}89%,100%{opacity:0}}
.inv-tbub{animation:inv-tbub 3.2s steps(1) both}
@keyframes inv-tbub{0%,24%{opacity:0}25%,88%{opacity:1}89%,100%{opacity:0}}
.inv-tdrop{animation:inv-tdrop 3.2s cubic-bezier(.2,.9,.2,1) both}
@keyframes inv-tdrop{0%{transform:translateY(-70px)}12%,86%{transform:none}100%{transform:translateY(-70px)}}

.inv-cheer,.inv-flashf,.inv-slam,.inv-sub,.inv-cshake,.inv-crack{animation-delay:var(--cd,0s)}
@media (prefers-reduced-motion: reduce){
 .inv-blink,.inv-wide,.inv-bob,.inv-run,.inv-chip,.inv-steam,.inv-rec,.inv-scan,.inv-twirl,.inv-fresh,.inv-stitch,.inv-stamp,.inv-cheer,.inv-flashf,.inv-slam,.inv-sub,.inv-cshake,.inv-crack,.inv-think,.inv-tbub,.inv-tdrop{animation:none}
 .inv-run{opacity:.6}.inv-flashf{opacity:0}.inv-slam,.inv-sub,.inv-cheer,.inv-crack,.inv-think,.inv-tbub{opacity:1;transform:none}.inv-tdrop{transform:none}
}`

// ---------------------------------------------------------------- comic primitives
/** A halftone dot field (pattern defs once per drawing): `r` the dot radius at `pitch`, in `col` at `op`. */
export const halftoneDefs = (id: any, col: any, r: any = 1, pitch: any = 4, op: any = 0.35) => `<pattern id="${id}" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="${pitch / 2}" cy="${pitch / 2}" r="${r}" fill="${col}" fill-opacity="${op}"/></pattern>`
/** A comic caption box: a yellow (or any) box with a 1.5 px ink border and a 2 px offset ink shadow; condensed caps inside. Returns svg and width. */
export const caption = (x: any, y: any, text: any, size: any = 9.5, fill: any = PROPS.captionYellow, o: any = {}) => {
  const ls = o.ls ?? 0.6
  const w = Math.round(condW(text, size, ls) + 14)
  const h = Math.round(size + 7)
  const ink = o.ink || inkOn(fill)
  const svg = `<g${o.cls ? ` class="${o.cls}"` : ''}><rect x="${r1(x + 2)}" y="${r1(y + 2)}" width="${w}" height="${h}" fill="${PROPS.ink}"/><rect x="${r1(x)}" y="${r1(y)}" width="${w}" height="${h}" fill="${fill}" stroke="${PROPS.ink}" stroke-width="1.5"/>${C(x + 7, y + h - 4.5, text, size, ink, `letter-spacing="${ls}"`)}</g>`
  return { svg, w, h }
}
/** Sound-effect lettering: condensed 800, skewed, an ink stroke behind. */
export const sfx = (x: any, y: any, text: any, size: any, fill: any, o: any = {}) => `<g transform="translate(${r1(x)} ${r1(y)}) skewX(${o.skew ?? -9})"${o.cls ? ` class="${o.cls}"` : ''}><text font-family="${COND}" font-size="${size}" font-weight="800" fill="${PROPS.ink}" stroke="${PROPS.ink}" stroke-width="${r1(size * 0.22)}" stroke-linejoin="round" letter-spacing="${o.ls ?? 0.5}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(text)}</text><text font-family="${COND}" font-size="${size}" font-weight="800" fill="${fill}" letter-spacing="${o.ls ?? 0.5}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(text)}</text></g>`
/** A jagged impact star (12 points), white with an ink edge. */
export const impact = (cx: any, cy: any, r: any, o: any = {}) => {
  const pts = []
  for (let i = 0; i < 24; i++) { const a = (Math.PI * 2 * i) / 24 - Math.PI / 2; const rr = i % 2 ? r * (0.42 + 0.12 * ((i * 7) % 3)) : r; pts.push(`${r1(cx + Math.cos(a) * rr)},${r1(cy + Math.sin(a) * rr)}`) }
  return `<polygon points="${pts.join(' ')}" fill="${o.fill || PROPS.flash}" stroke="${PROPS.ink}" stroke-width="${o.sw ?? 1.5}" stroke-linejoin="round"${o.cls ? ` class="${o.cls}"` : ''}${o.op !== undefined ? ` opacity="${o.op}"` : ''}/>`
}
/** A five-point star (KO stars, the patch). */
export const star = (cx: any, cy: any, r: any, fill: any, extra: any = '') => {
  const pts = []
  for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 * i) / 10 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; pts.push(`${r1(cx + Math.cos(a) * rr)},${r1(cy + Math.sin(a) * rr)}`) }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${extra}/>`
}
/** Speed lines: `n` tapered strokes trailing from (x, y) in `dir` (-1 trails to the left), `len` long. */
export const speedLines = (x: any, y: any, len: any, n: any, dir: any, col: any, o: any = {}) => {
  let s = `<g${o.cls ? ` class="${o.cls}"` : ''} opacity="${o.op ?? 0.8}">`
  for (let i = 0; i < n; i++) { const yy = y + (i - (n - 1) / 2) * (o.gap ?? 4); const l = len * (0.55 + 0.45 * unit(`sl${i}`)); s += `<path d="M${r1(x)} ${r1(yy)}h${r1(-dir * l)}" stroke="${col}" stroke-width="${i % 2 ? 1 : 1.6}" stroke-linecap="round"/>` }
  return `${s}</g>`
}
/** Three KO stars circling a point, 1.2 s a turn (`.inv-twirl`), with a dashed swirl under them. */
export const koStars = (cx: any, cy: any, o: any = {}) => `<g${o.cls ? ` class="${o.cls}"` : ''}><ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="12" ry="4" fill="none" stroke="${PROPS.star}" stroke-width="1" stroke-dasharray="3 3" opacity=".8"/><g class="inv-twirl">${star(cx - 11, cy - 1, 3.2, PROPS.star, `stroke="${PROPS.ink}" stroke-width=".8"`)}${star(cx + 5, cy - 4, 2.6, PROPS.star, `stroke="${PROPS.ink}" stroke-width=".8"`)}${star(cx + 7, cy + 3, 2.2, PROPS.star, `stroke="${PROPS.ink}" stroke-width=".8"`)}</g></g>`
/** A dust puff: three ink-edged clouds. */
export const dust = (cx: any, cy: any, s: any = 1, o: any = {}) => `<g${o.cls ? ` class="${o.cls}"` : ''} transform="translate(${r1(cx)} ${r1(cy)}) scale(${s})" fill="${PROPS.paperDark}" stroke="${PROPS.ink}" stroke-width="1"><circle cx="-9" cy="0" r="5"/><circle cx="0" cy="-3" r="6.5"/><circle cx="9" cy="1" r="4.5"/></g>`
/** A comic panel frame: ink border 2 px with a hard 3 px shadow. */
export const panel = (x: any, y: any, w: any, h: any, fill: any, o: any = {}) => `<rect x="${r1(x + 3)}" y="${r1(y + 3)}" width="${r1(w)}" height="${r1(h)}" fill="${PROPS.ink}" opacity=".9"/><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fill}" stroke="${PROPS.ink}" stroke-width="${o.sw ?? 2}"${o.cls ? ` class="${o.cls}"` : ''}/>`

// ---------------------------------------------------------------- props
/** Allen the Alien's one eye, `s` scale: lid blinks every 6 s; `wide` at 95 %+ (no lid, a wobble); `still` never moves. */
export const allenEye = (x: any, y: any, s: any, mode: any) => {
  const g = `transform="translate(${r1(x)} ${r1(y)}) scale(${s})"`
  const lid = mode === 'still' ? '' : mode === 'wide' ? '' : `<ellipse class="inv-blink" cx="0" cy="0" rx="7" ry="5" fill="${PROPS.allen}"/>`
  return `<g ${g} class="${mode === 'wide' ? 'inv-wide' : ''}"><ellipse cx="0" cy="0" rx="7" ry="5" fill="${PROPS.white}" stroke="${PROPS.allenDark}" stroke-width="1"/><circle cx="${mode === 'wide' ? 0 : 1}" cy="0" r="${mode === 'wide' ? 3.2 : 2.6}" fill="${PROPS.allenDark}"/><circle cx="${mode === 'wide' ? 1 : 2}" cy="-1" r=".9" fill="${PROPS.white}"/>${lid}<path d="M-8 -5q8 -4 16 0" fill="none" stroke="${PROPS.allen}" stroke-width="2"/></g>`
}
/** Debbie's mug (the idle slot, a 12 by 16 box), steam rising while it is hot. */
export const mug = (x: any, y: any, hot: any = true) => `<g transform="translate(${r1(x)} ${r1(y)})"><rect x="1" y="6" width="9" height="9" rx="1.5" fill="${PROPS.mug}" stroke="${PROPS.ink}" stroke-width="1"/><path d="M10 8h2.5a2 2 0 0 1 0 4H10" fill="none" stroke="${PROPS.ink}" stroke-width="1"/><rect x="2" y="7" width="7" height="2" fill="${PROPS.coffee}"/>${hot ? `<g class="inv-steam" fill="none" stroke="${PROPS.sub || '#B9C3D8'}" stroke-width="1" opacity=".8"><path d="M4 4q1 -2 0 -3.5"/><path d="M7 4q1 -2 0 -3.5"/></g>` : ''}</g>`
/** A Burger Mart burger, 10 by 8 (the off-duty gauge). */
export const burger = (x: any, y: any) => `<g transform="translate(${r1(x)} ${r1(y)})"><path d="M0 3a5 3 0 0 1 10 0z" fill="${PROPS.bun}"/><rect x="0" y="3" width="10" height="2" fill="${PROPS.burger}"/><rect x="0" y="5" width="10" height="1.2" fill="#7FB55A"/><rect x="0" y="6.2" width="10" height="2" rx="1" fill="${PROPS.bun}"/></g>`
/** A GDA monitor: a bezel with four screws and a dark screen; `o.rec` blinks a red dot; `o.live` adds a faint scan bar. */
export const monitor = (x: any, y: any, w: any, h: any, o: any = {}) => {
  const id = o.id || uniq('mon')
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="3" fill="${PROPS.gdaDark}" stroke="${PROPS.gda}" stroke-width="1"/>${[[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]].map(([cx, cy]) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="1" fill="${PROPS.gda}"/>`).join('')}<defs><clipPath id="${id}"><rect x="${r1(x + 8)}" y="${r1(y + 8)}" width="${r1(w - 16)}" height="${r1(h - 16)}"/></clipPath></defs><rect x="${r1(x + 8)}" y="${r1(y + 8)}" width="${r1(w - 16)}" height="${r1(h - 16)}" fill="${PROPS.screen}"/>${o.live ? `<g clip-path="url(#${id})"><rect class="inv-scan" x="${r1(x + 8)}" y="${r1(y + 2)}" width="${r1(w - 16)}" height="3" fill="${PROPS.screenGreen}" opacity=".12"/></g>` : ''}${o.rec ? `<circle class="inv-rec" cx="${r1(x + w - 14)}" cy="${r1(y + 14)}" r="2.5" fill="${PROPS.alert || '#E8453C'}"/>` : ''}`
}
/** The flight bar (the task row's gauge): a dotted trajectory, the tiny flying Mark at the progress point with speed lines, a landing ring at the end. */
export const flightBar = (x: any, y: any, w: any, pct: any, era: any, o: any = {}) => {
  const P = pal(era)
  const p = clamp(pct, 0, 100) / 100
  const fx = x + (w - 14) * p
  const sp = era === 2 ? SP.INV_MARK_S3_FLY : SP.INV_MARK_FLY
  let s = `<line x1="${r1(x)}" y1="${y + 3}" x2="${r1(x + w)}" y2="${y + 3}" stroke="${P.track}" stroke-width="2" stroke-dasharray="2 3"/>`
  s += `<line x1="${r1(x)}" y1="${y + 3}" x2="${r1(fx)}" y2="${y + 3}" stroke="${o.near ? P.alert : P.hero}" stroke-width="2"/>`
  s += `<circle cx="${r1(x + w - 2)}" cy="${y + 3}" r="3.5" fill="none" stroke="${p >= 1 ? P.done : P.muted}" stroke-width="1.2"/>${p >= 1 ? `<circle cx="${r1(x + w - 2)}" cy="${y + 3}" r="1.5" fill="${P.done}"/>` : ''}`
  if (pct > 0 || o.working) s += speedLines(fx - 2, y + 3, 10, 3, 1, P.hero, { op: 0.6, gap: 3 }) + px(sp, fx - 2, y - 1.5, 0.55, { cls: o.working ? 'inv-bob' : '' })
  return s
}
/** A step pip: comic panels. done = ink panel with a hero star; running = outline with a pulsing core; todo = outline; failed = red X; stopped = faint. */
export const pip = (st: any, cx: any, cy: any, era: any) => {
  const P = pal(era)
  const box = (fill: any, stroke: any, op: any = 1) => `<rect x="${r1(cx - 4.5)}" y="${r1(cy - 4.5)}" width="9" height="9" fill="${fill}" stroke="${stroke}" stroke-width="1.2" opacity="${op}"/>`
  if (st === 'done') return `${box(P.hero, P.hero)}${star(cx, cy, 3, P.heroInk)}`
  if (st === 'running') return `${box('none', P.aT)}<rect class="inv-run" x="${r1(cx - 2)}" y="${r1(cy - 2)}" width="4" height="4" fill="${P.aT}"/>`
  if (st === 'failed') return `${box('none', P.alert)}<path d="M${r1(cx - 2.5)} ${r1(cy - 2.5)}l5 5M${r1(cx + 2.5)} ${r1(cy - 2.5)}l-5 5" stroke="${P.alert}" stroke-width="1.4"/>`
  if (st === 'stopped') return box('none', P.muted, 0.5)
  return box('none', P.muted)
}

// ---------------------------------------------------------------- band pieces (the ThemeEggs.slim hooks)
export const BAND_H = 134
/** The foot: a halftone wash rising at the right, an ink rule, Allen's eye in the corner (the hidden egg). */
export const foot = (W: any, H: any, ctx: any, era: any) => {
  const P = pal(era)
  const id = uniq('ht')
  let s = `<defs>${halftoneDefs(id, P.hero, 1.1, 5, 0.16)}<linearGradient id="${id}g" x1="0" x2="1"><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="${id}m"><rect x="0" y="${H - 34}" width="${W}" height="34" fill="url(#${id}g)"/></mask></defs>`
  s += `<rect x="0" y="${H - 34}" width="${W}" height="34" fill="url(#${id})" mask="url(#${id}m)"/>`
  s += `<rect x="12" y="${H - 6.5}" width="${W - 24}" height="1.5" fill="${P.hero}" opacity=".35"/>`
  return s
}
export const corner = (W: any, H: any, ctx: any, era: any) => allenEye(W - 22, H - 15, 1.1, ctx.ctxPct >= 95 || ctx.overBudget ? 'wide' : 'blink')
/** The session total, "Total $1.23", as bcsTotal does it: a self-contained tag, 11.5 px, `w` wide. */
export const total = (x: any, y: any, usd: any, era: any) => {
  const P = pal(era)
  const v = `$${(Number.isFinite(usd) && usd > 0 ? usd : 0).toFixed(2)}`
  const w = sansW('Total ', 11.5) + sansW(v, 11.5, 0, true) + 2
  return { svg: `<text x="${r1(x)}" y="${y}" font-family="${FONT}" font-size="11.5" fill="${P.muted}" font-variant-numeric="tabular-nums">Total <tspan font-weight="700" fill="${P.text}">${v}</tspan></text>`, w }
}
/** MISSION CONTROL as a comic caption box; then the Total; then the agency line on wide bands. */
export const name = (x: any, y: any, W: any, era: any, totalUsd: any = 0) => {
  const P = pal(era)
  const cap = caption(x, y - 13, 'MISSION CONTROL', 9.5, P.hero, { ls: 1.2 })
  let s = cap.svg
  let tw = cap.w + 2
  const tot = total(x + tw + 12, y, totalUsd, era)
  s += tot.svg
  tw += 12 + tot.w
  const firm = W >= 1100 ? 'GLOBAL DEFENSE AGENCY · PENTAGON FEED' : W >= 900 ? 'GLOBAL DEFENSE AGENCY' : ''
  if (firm) { s += M(x + tw + 14, y, firm, 9, P.muted, 'letter-spacing="1.2"'); tw += 14 + monoW(firm, 9) + firm.length * 1.2 }
  return { svg: s, w: tw }
}
/** The context chip: 85-94 THAT ACTUALLY HURT (S1E5) on the hero colour; 95+ THINK, MARK! on Viltrumite red, white ink. */
export const chip = (x: any, y: any, pct: any, era: any) => {
  if (pct < 85) return { svg: '', w: 0 }
  const P = pal(era)
  const hot = pct >= 95
  const label = hot ? 'THINK, MARK!' : 'THAT ACTUALLY HURT'
  const cap = caption(x, y - 13, label, 10, hot ? PROPS.red : P.hero, { ink: hot ? '#FFFFFF' : P.heroInk, cls: hot ? 'inv-chip' : '' })
  return { svg: cap.svg, w: cap.w + 2 }
}
/** The episode as an ink panel tag (code in white) then the title in italic. */
export const epW = (code: any, title: any, full: any) => condW(code, 9.5, 0.8) + 14 + (full ? 8 + sansW(title, 11.5) : 0)
export const ep = (xr: any, y: any, code: any, title: any, full: any, era: any) => {
  const P = pal(era)
  const cw = condW(code, 9.5, 0.8) + 14
  let s = ''
  let x = xr
  if (full) { x -= sansW(title, 11.5); s += T(x, y, title, 11.5, 400, P.sub, 'font-style="italic"'); x -= 8 }
  x -= cw
  s += `<rect x="${r1(x)}" y="${y - 11.5}" width="${r1(cw)}" height="15" fill="${PROPS.ink}" stroke="${P.sub}" stroke-opacity=".5" stroke-width="1"/>${C(x + 7, y, code, 9.5, '#FFFFFF', 'letter-spacing=".8"')}`
  return s
}
/** The gauge: ON PATROL n/m with the tiny flying Mark while working; BURGER MART n/m with a burger when idle (his day job). */
export const gauge = (xr: any, y: any, isWorking: any, done: any, total: any, era: any) => {
  const P = pal(era)
  const label = isWorking ? 'ON PATROL' : 'BURGER MART'
  const count = `${done}/${total}`
  const lw = sansW(label, 9.5, 0.8, true)
  const cw = sansW(count, 13, 0, true)
  const w = 16 + lw + 7 + cw
  const x = xr - w
  const sp = era === 2 ? SP.INV_MARK_S3_FLY : SP.INV_MARK_FLY
  let s = isWorking ? speedLines(x + 3, y - 5, 8, 3, 1, P.hero, { op: 0.5, gap: 3 }) + px(sp, x + 1, y - 9, 0.55, { cls: 'inv-bob' }) : burger(x + 1, y - 9)
  s += T(x + 16, y, label, 9.5, 700, isWorking ? P.hero : P.muted, 'letter-spacing=".8"')
  s += T(x + 16 + lw + 7, y, count, 13, 700, P.text, 'font-variant-numeric="tabular-nums"')
  return { svg: s, w }
}
/** The avatar: the Mark bust of the era at 0.9 (34 x 36). */
export const figure = (era: any) => (era === 2 ? px(SP.INV_MARK_S3_BUST, 19, 38, 0.9) : px(SP.INV_MARK_BUST, 18, 38, 0.9))
/** The avatar slot while Mark is out: the cracked frame, the hole and a dust trail (THE FIGHT draws it in its timeline). */
export const crew = (x: any, y: any, color: any, era: any, i: any = 0) => {
  const sp = [SP.INV_AGENT, SP.INV_AGENT2, SP.INV_AGENT3][i % 3]
  return px(sp, x, y, 0.34, { tint: color })
}
/** The job-done cheer: the title-card SLAM. A white flash frame, INVINCIBLE in the era's colour slams in (scale 3.2 to 1) with a camera shake and a cracked-frame line, JOB DONE under it; 2.6 s. */
export const cheer = (W: any, H: any, era: any, o: any = {}) => {
  const P = pal(era)
  const size = W < 800 ? 34 : 42
  const cx = W / 2
  const cy = H / 2 + 6
  const sub = 'JOB DONE · INVINCIBLE'
  const crack = `<path class="inv-crack" d="M${r1(cx - 70)} ${r1(cy - 40)}l12 10 -6 8 14 9 -5 11 10 6" fill="none" stroke="${P.text}" stroke-width="1.2" opacity=".7"/><path class="inv-crack" d="M${r1(cx + 64)} ${r1(cy + 36)}l-10 -9 7 -7 -12 -10 4 -9 -8 -5" fill="none" stroke="${P.text}" stroke-width="1.2" opacity=".7"/>`
  return `<g class="inv-cheer" pointer-events="none"${o.delay ? ` style="--cd:${o.delay}"` : ''}><rect x="0" y="0" width="${W}" height="${H}" fill="${P.tile}" opacity=".78"/><rect class="inv-flashf" x="0" y="0" width="${W}" height="${H}" fill="${PROPS.flash}"/><g class="inv-cshake">${crack}<g class="inv-slam">${sfx(cx, cy + size * 0.32, 'INVINCIBLE', size, P.hero, { anchor: 'middle', skew: -12, ls: 1.5 })}</g><g class="inv-sub">${C(cx, cy + size * 0.32 + 16, sub, 9.5, P.text, 'text-anchor="middle" letter-spacing="2"')}</g></g></g>`
}
/** THINK, MARK: typed as a code, or at 95 %. Omni-Man drops in beside the avatar, arms crossed, and his bubble says the line (S1E8); 3.2 s. */
export const thinkMark = (W: any, H: any, era: any, dly: any = '0s') => {
  const P = pal(era)
  const x = Math.round(clamp(W * 0.4, 300, 520))
  const y = H - 6
  const bw = condW('THINK, MARK.', 11, 1) + 18
  return `<g class="inv-think" pointer-events="none" style="animation-delay:${dly}"><g class="inv-tdrop" style="animation-delay:${dly}"><ellipse cx="${x + 10}" cy="${y}" rx="11" ry="2" fill="#000" opacity=".35"/>${px(SP.INV_OMNI_HOVER, x, y - 36, 1.2)}</g><g class="inv-tbub" style="animation-delay:${dly}"><rect x="${x + 26}" y="${y - 38}" width="${r1(bw)}" height="20" rx="2" fill="${PROPS.white}" stroke="${PROPS.ink}" stroke-width="1.5"/><path d="M${x + 26} ${y - 26}l-7 4 7 2z" fill="${PROPS.white}" stroke="${PROPS.ink}" stroke-width="1.5" stroke-linejoin="round"/>${C(x + 35, y - 24, 'THINK, MARK.', 11, PROPS.ink, 'letter-spacing="1"')}</g></g>`
}

export const WARNING = (pct: any) => (pct >= 95 ? `Context ${pct}%: think, Mark. /compact now.` : `Context ${pct}%: that actually hurt. /compact soon.`)
// Every verified title (S2E2 left out), one per hour; the Atom Eve special sits between the seasons.
export const EPISODES = [['S1E1', "It's About Time"], ['S1E2', 'Here Goes Nothing'], ['S1E3', 'Who You Calling Ugly?'], ['S1E4', 'Neil Armstrong, Eat Your Heart Out'], ['S1E5', 'That Actually Hurt'], ['S1E6', 'You Look Kinda Dead'], ['S1E7', 'We Need to Talk'], ['S1E8', 'Where I Really Come From'],
  ['S0E1', 'Atom Eve'], ['S2E1', 'A Lesson for Your Next Life'], ['S2E3', 'This Missive, This Machination!'], ['S2E4', "It's Been a While"], ['S2E5', 'This Must Come as a Shock'], ['S2E6', "It's Not That Simple"], ['S2E7', "I'm Not Going Anywhere"], ['S2E8', 'I Thought You Were Stronger'],
  ['S3E1', "You're Not Laughing Now"], ['S3E2', 'A Deal with the Devil'], ['S3E3', 'You Want a Real Costume, Right?'], ['S3E4', 'You Were My Hero'], ['S3E5', 'This Was Supposed to Be Easy'], ['S3E6', "All I Can Say Is I'm Sorry"], ['S3E7', 'What Have I Done?'], ['S3E8', "I Thought You'd Never Shut Up"],
  ['S4E1', 'Making the World a Better Place'], ['S4E2', "I'll Give You the Grand Tour"], ['S4E3', 'I Gotta Get Some Air'], ['S4E4', 'Hurm'], ['S4E5', 'Give Us a Moment'], ['S4E6', 'You Look Horrible'], ['S4E7', "Don't Do Anything Rash"], ['S4E8', "Don't Leave Me Hanging Here"]]
export const episodeAt = (at: any) => EPISODES[Math.floor(at / 3_600_000) % EPISODES.length]

export const TITLE_WORDS = ["It's About Time", 'Here Goes Nothing', 'That Actually Hurt', 'We Need to Talk', "It's Been a While", "It's Not That Simple", "You're Not Laughing Now", 'A Deal with the Devil', 'This Was Supposed to Be Easy', 'What Have I Done?', 'Hurm', 'Give Us a Moment', "Don't Leave Me Hanging Here"]
