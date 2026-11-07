// Better Call Saul (fan homage to AMC / Sony Pictures Television) and its hidden GENE skin: the strip-mall law office.
// Cheap TV-ad showmanship (red / yellow / powder blue) laid over the paper world of a law practice (business cards, manila
// folders, Kim's legal pad, a time sheet, docket stamps, matchbooks) on dark cocobolo wood. The six season colour bars are
// the progress gauge. People are only ever the approved pixel sprites (cast.ts), never vector-drawn.
//
// This file: the tokens, type, motion, the drawing primitives and the slim band's hooks. The cards are in
// bettercallsaul-cards.ts, Mike in bettercallsaul-mike.ts, the rare scheduled eggs in bettercallsaul-extra.ts.
// Pure SVG strings and tables, no state. GENE draws the same things through `grey()` with a film grain.

import { BCS_GENE_BUST, BCS_PARALEGAL, BCS_PARALEGAL2, BCS_PARALEGAL3, BCS_SAUL_BUST, hashOf } from './cast'
import type { Sprite } from './cast'
import { sansClip, sansW } from './breakingbad-cards'
import { pin } from './smooth'
import { inkOn } from './extras'

export { sansClip, sansW }

// ---------------------------------------------------------------- tokens
export type Pal = { tile: string; tile2: string; line: string; track: string; a: string; aT: string; gold: string; cream: string; text: string; sub: string; muted: string; done: string; warn: string; alert: string }
/** The skin JSON: dark walnut, Saul's powder blue as the accent, gold and cream from the tie and the shirt. */
export const SAUL: Pal = {
  tile: '#1A1410', tile2: '#241B15', line: '#3B2D23', track: '#2B2019',
  a: '#5B8FD6', aT: '#9FC2F0', gold: '#E6C35C', cream: '#F3E7C9',
  text: '#F5EEE2', sub: '#CBBDA9', muted: '#9C8C79', done: '#7FC68F', warn: '#F2C94C', alert: '#EE5F55',
}
/** GENE: the same roles in grey only. Every state keeps a second cue (pattern, shape or words). */
export const GENE: Pal = {
  tile: '#121212', tile2: '#1B1B1B', line: '#343434', track: '#262626',
  a: '#9A9A9A', aT: '#D2D2D2', gold: '#C9C9C9', cream: '#E4E4E4',
  text: '#F2F2F2', sub: '#C2C2C2', muted: '#8E8E8E', done: '#DADADA', warn: '#BDBDBD', alert: '#EDEDED',
}
export const pal = (gene: boolean): Pal => (gene ? GENE : SAUL)
/** Props keep fixed colours (they are objects, not UI). In GENE each passes through `grey()`. */
export const PROPS = {
  pad: '#F4E58C', padRule: '#8FB0DD', padMargin: '#E0706A', padTop: '#A8443B', ink: '#1E3C86', inkLight: '#4A63A6', pencil: '#6E6B5A', hi: '#FF9F3D', sticky: '#F7B6CC',
  manila: '#E9D5A6', manilaDark: '#CBB07A', manilaTab: '#F3E4BF', wood: '#4A3222', woodDark: '#2E1F15', woodLight: '#6B4A34',
  brass: '#D9B45A', adRed: '#D7262C', adYellow: '#FFD23F', adBlue: '#1F4FA3', navy: '#1E2F55', cream: '#F3E7C9', creamInk: '#2A2318',
  bell: '#D9B45A', bellDark: '#8A6A24', flame: '#FFB347', flameCore: '#FFF0B0', tag: '#D8D8D8', tagInk: '#2B2B2B',
  statue: '#7FB8A4', statueDark: '#5B8F7E', torch: '#FFD23F', car: '#E0B93A', carDark: '#8C6E1E', blanket: '#C8CDD3', lamp: '#FFB347',
} as const
export type PropKey = keyof typeof PROPS
/** The official season colour bars (Wikipedia), S1 to S6: the era progression. */
export const ERA = ['#133E51', '#CFB7A0', '#4F4F5E', '#111111', '#6D4955', '#B11222']
export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI','Noto Sans',sans-serif"
export const SERIF = "Georgia,'Times New Roman',serif"
export const COND = "'Avenir Next Condensed','Roboto Condensed','Arial Narrow',Bahnschrift,sans-serif"
export const HAND = "'Bradley Hand','Segoe Print','Comic Sans MS',cursive"
export const BAND_H = 134

// ---------------------------------------------------------------- helpers
export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const r1 = (n: number): number => +(+n).toFixed(1)
export const r2 = (n: number): number => +(+n).toFixed(2)
export const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n))
export const hash = (s: string): number => hashOf(s)
/** A stable id from its parts: the same drawing always gets the same id (a redraw changes nothing). */
export const sid = (p: string, ...parts: (string | number)[]): string => `${p}${hashOf(parts.join('|')).toString(36)}`
export const rng = (seed: string): (() => number) => {
  let a = hashOf(seed) || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hex3 = (h: string): number[] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
/** Grey for GENE: perceptual luma, kept as a hex. */
export const grey = (h: string): string => {
  if (!/^#[0-9a-f]{6}$/i.test(h)) return h
  const [r, g, b] = hex3(h) as [number, number, number]
  const s = Math.round(0.299 * r + 0.587 * g + 0.114 * b).toString(16).padStart(2, '0')
  return `#${s}${s}${s}`
}
export const prop = (k: PropKey, gene: boolean): string => (gene ? grey(PROPS[k]) : PROPS[k])
export { inkOn }

/** Georgia, measured: caps .68/.77, lower .50/.58, digits .55/.62, narrow .31/.37, space .24/.25, M W .91/1.0. */
export const serifW = (s: string, size: number, ls = 0, bold = false): number =>
  [...String(s)].reduce((w, ch) => w + (ch === ' ' ? 0.25 : /[MW@%]/.test(ch) ? (bold ? 1.0 : 0.91) : /[A-Z&]/.test(ch) ? (bold ? 0.77 : 0.68) : /[0-9]/.test(ch) ? (bold ? 0.62 : 0.55) : /[.,:;'|!il()[\]jtf·]/.test(ch) ? (bold ? 0.37 : 0.31) : /[mw]/.test(ch) ? (bold ? 0.94 : 0.81) : (bold ? 0.58 : 0.5)) * size + ls, 0)
/** Avenir Next Condensed 800 (the ad shout): caps .57, lower .50, digits .56, space .2. */
export const condW = (s: string, size: number, ls = 0): number =>
  [...String(s)].reduce((w, ch) => w + (ch === ' ' ? 0.2 : /[MW]/.test(ch) ? 0.76 : /[A-Z&!?]/.test(ch) ? (ch === 'I' ? 0.32 : 0.57) : /[0-9]/.test(ch) ? 0.56 : /[.,:;'·]/.test(ch) ? 0.25 : 0.5) * size + ls, 0)
export const handW = (s: string, size: number): number => [...String(s)].reduce((w, ch) => w + (ch === ' ' ? 0.26 : /[A-Z]/.test(ch) ? 0.69 : /[0-9]/.test(ch) ? 0.6 : /[.,:;'il]/.test(ch) ? 0.34 : 0.52) * size, 0)
type Wf = (s: string, size: number, ls?: number, bold?: boolean) => number
export const clipBy = (wf: Wf, s: string, size: number, max: number, ls = 0, bold = false): string => {
  s = String(s)
  if (wf(s, size, ls, bold) <= max) return s
  const a = [...s]
  while (a.length && wf(`${a.join('')}…`, size, ls, bold) > max) a.pop()
  return a.length ? `${a.join('').trimEnd()}…` : ''
}
export const fitBy = (wf: Wf, s: string, max: number, from: number, to: number, bold = true): number => {
  for (let z = from; z >= to; z -= 0.5) if (wf(s, z, 0, bold) <= max) return z
  return to
}
export const wrap = (text: string, size: number, max: number, lines: number, wf: Wf = sansW): string[] => {
  const words = String(text).split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (wf(t, size) <= max) cur = t
    else {
      out.push(cur)
      cur = w
      if (out.length === lines) break
    }
  }
  if (out.length < lines && cur) out.push(cur)
  if (out.join(' ') !== words.join(' ')) out[out.length - 1] = clipBy(wf, `${out[out.length - 1] ?? ''} …`, size, max)
  return out.slice(0, lines).map(l => clipBy(wf, l, size, max))
}
export const durOf = (ms: number): string => (ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)} h ${Math.round((ms % 3_600_000) / 60_000)} min` : ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`)
export const money = (usd: number): string => (usd < 0.005 ? '$0' : `$${usd.toFixed(2)}`)
export const hhmm = (at: number): string => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Text in the system sans (T), Georgia (S), the ad's condensed face (C) or pen (Hd). */
export const T = (x: number, y: number, text: string, size: number, weight: number, fill: string, extra = ''): string => `<text x="${r1(x)}" y="${r1(y)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`
export const S = (x: number, y: number, text: string, size: number, weight: number, fill: string, extra = ''): string => `<text x="${r1(x)}" y="${r1(y)}" font-family="${SERIF}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`
export const C = (x: number, y: number, text: string, size: number, fill: string, extra = ''): string => `<text x="${r1(x)}" y="${r1(y)}" font-family="${COND}" font-size="${size}" font-weight="800" fill="${fill}" ${extra}>${esc(text)}</text>`
export const Hd = (x: number, y: number, text: string, size: number, fill: string, extra = ''): string => `<text x="${r1(x)}" y="${r1(y)}" font-family="${HAND}" font-size="${size}" font-weight="700" fill="${fill}" ${extra}>${esc(text)}</text>`

// ---------------------------------------------------------------- pixel art from the approved sprites
export type PxOpts = { tint?: string; grey?: boolean; rows?: [number, number]; flip?: boolean; op?: number; cls?: string; mono?: string; rowsOverride?: string[] }
/**
 * A sprite as crisp pixel paths grouped by colour, horizontal runs of one colour merged into one command each.
 * `tint` replaces the crew's `t` pixels; `grey` turns every pixel grey (GENE); `rows` draws a row window; `flip` mirrors.
 */
export const px = (sp: Sprite, x: number, y: number, s: number, o: PxOpts = {}): string => {
  const src = o.rowsOverride ?? sp.rows
  const rows = o.rows ? src.slice(o.rows[0], o.rows[1]) : src
  const w = Math.max(...sp.rows.map(r => r.length))
  const by = new Map<string, string>()
  const colOf = (ch: string | undefined): string | null => {
    if (!ch || ch === '.') return null
    let col: string | undefined = ch === 't' ? (o.tint ?? '#2C4B4E') : sp.pal[ch]
    if (!col) return null
    if (o.grey) col = grey(col)
    if (o.mono) col = o.mono
    return col
  }
  rows.forEach((row, r) => {
    const cells = Array.from({ length: w }, (_, i) => colOf(row[i]))
    if (o.flip) cells.reverse()
    let c = 0
    while (c < w) {
      const col = cells[c]
      if (!col) { c++; continue }
      let n = 1
      while (c + n < w && cells[c + n] === col) n++
      by.set(col, `${by.get(col) ?? ''}M${c} ${r}h${n}v1h-${n}z`)
      c += n
    }
  })
  const paths = [...by.entries()].map(([col, d]) => `<path d="${d}" fill="${col}"/>`).join('')
  return `<g shape-rendering="crispEdges" transform="translate(${r2(x)} ${r2(y)}) scale(${+s.toFixed(3)})"${o.op !== undefined ? ` opacity="${o.op}"` : ''}>${o.cls ? `<g class="${o.cls}">${paths}</g>` : paths}</g>`
}
export const spW = (sp: Sprite): number => Math.max(...sp.rows.map(r => r.length))

// ---------------------------------------------------------------- motion (every animation has a reduced-motion fallback)
// Bell rings: the idle one once per 24 s, then 6 s (from 50% context), 2 s (from 85%), mad at 2 Hz (95%+): never above 3 Hz.
const ringKf = (n: string, period: number): string => {
  const on = Math.min(60, (0.6 / period) * 100)
  return `@keyframes bcs-ring${n}{0%,${r2(on)}%{opacity:1}${r2(on + 0.1)}%,100%{opacity:0}}@keyframes bcs-tilt${n}{${r2(on * 0.25)}%,${r2(on * 0.75)}%{transform:rotate(-8deg)}${r2(on * 0.5)}%,${r2(on)}%{transform:rotate(8deg)}${r2(on + 0.1)}%,100%{transform:none}}`
}
export const BCS_CSS = `.bcs-flame{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-flame 1.1s steps(2) infinite}
@keyframes bcs-flame{50%{transform:scaleY(.8) translateX(.5px)}}
.bcs-pen{animation:bcs-pen 1.4s steps(1) infinite}
@keyframes bcs-pen{50%{opacity:.25}}
.bcs-run{animation:bcs-run 1.2s steps(1) infinite}
@keyframes bcs-run{50%{opacity:.35}}
.bcs-chip{animation:bcs-chip 1.6s ease-in-out infinite}
@keyframes bcs-chip{50%{opacity:.7}}
.bcs-sway{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-sway 3.2s ease-in-out infinite}
@keyframes bcs-sway{50%{transform:rotate(-4deg)}}
.bcs-tube{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-tube 1.8s steps(1) infinite}
@keyframes bcs-tube{0%{transform:rotate(-9deg)}25%{transform:rotate(7deg)}50%{transform:rotate(-5deg)}75%{transform:rotate(10deg)}}
.bcs-arms{animation:bcs-arms .9s steps(1) infinite}
@keyframes bcs-arms{50%{transform:scaleY(-1)}}
.bcs-arms{transform-box:fill-box;transform-origin:50% 50%}
.bcs-ring0{animation:bcs-ring0 24s steps(1) infinite}.bcs-tilt0{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-tilt0 24s steps(1) infinite}
.bcs-ring1{animation:bcs-ring1 6s steps(1) infinite}.bcs-tilt1{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-tilt1 6s steps(1) infinite}
.bcs-ring2{animation:bcs-ring2 2s steps(1) infinite}.bcs-tilt2{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-tilt2 2s steps(1) infinite}
${ringKf('0', 24)}${ringKf('1', 6)}${ringKf('2', 2)}
.bcs-mad{animation:bcs-mad .5s steps(1) infinite}
@keyframes bcs-mad{50%{opacity:.1}}
.bcs-madtilt{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-madtilt .5s steps(1) infinite}
@keyframes bcs-madtilt{50%{transform:rotate(-10deg)}}
.bcs-star{transform-box:fill-box;transform-origin:50% 50%;animation:bcs-star 2.4s linear both}
@keyframes bcs-star{0%{transform:scale(0) rotate(0)}22%{transform:scale(1.08) rotate(40deg)}85%{transform:scale(1) rotate(60deg);opacity:1}100%{transform:scale(1.3) rotate(70deg);opacity:0}}
.bcs-wipe{transform-box:fill-box;transform-origin:0 50%;animation:bcs-wipe 2.4s ease-out both}
@keyframes bcs-wipe{0%{transform:scaleX(0)}18%{transform:scaleX(1)}85%{opacity:1}100%{opacity:0}}
.bcs-shout{animation:bcs-shout 2.4s steps(1) both}
@keyframes bcs-shout{0%,14%{opacity:0}15%,100%{opacity:1}}
.bcs-cheer{animation:bcs-cheerout 2.4s steps(1) both}
@keyframes bcs-cheerout{0%,92%{opacity:1}93%,100%{opacity:0}}
.bcs-ad{animation:bcs-adout 3s steps(1) both}
@keyframes bcs-adout{0%,93%{opacity:1}94%,100%{opacity:0}}
.bcs-blink{animation:bcs-blink .8s steps(1) infinite}
@keyframes bcs-blink{50%{opacity:.35}}
.bcs-stamp{transform-box:fill-box;transform-origin:50% 50%;animation:bcs-stamp .45s cubic-bezier(.2,1.4,.4,1) both}
@keyframes bcs-stamp{0%{transform:scale(2.2) rotate(-14deg);opacity:0}60%{transform:scale(.92) rotate(-8deg);opacity:1}100%{transform:scale(1) rotate(-8deg)}}
.bcs-fresh{animation:bcs-fresh 1.8s steps(1) both}
@keyframes bcs-fresh{0%,16%,33%,50%{opacity:.2}8%,25%,41%,100%{opacity:1}}
.bcs-flip{transform-box:fill-box;transform-origin:50% 50%;animation:bcs-flip .5s ease-out both}
@keyframes bcs-flip{0%{transform:scaleX(0)}}
.bcs-cam{animation:bcs-cam 3s ease-in-out both}
@keyframes bcs-cam{0%{opacity:0;transform:translate(var(--sx),0)}15%,82%{opacity:1;transform:none}100%{opacity:0;transform:translate(var(--sx),0)}}
.bcs-bub{animation:bcs-bub 3s steps(1) both}
@keyframes bcs-bub{0%,22%{opacity:0}23%,100%{opacity:1}}
.bcs-grain{animation:bcs-grain .4s steps(1) infinite}
@keyframes bcs-grain{50%{transform:translate(-1px,1px)}}
.bcs-walk{animation:bcs-walk .7s steps(2) infinite}
@keyframes bcs-walk{50%{transform:translateY(-1px)}}
.bcs-go{animation:bcs-go linear both}
@keyframes bcs-go{from{transform:translateX(var(--a))}to{transform:translateX(var(--b))}}
.bcs-putt{animation:bcs-putt .5s steps(1) infinite}
@keyframes bcs-putt{50%{transform:translateY(-.8px)}}
.bcs-tie1{animation:bcs-tie1 1.2s steps(1) infinite}.bcs-tie2{animation:bcs-tie2 1.2s steps(1) infinite}
@keyframes bcs-tie1{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes bcs-tie2{0%,49%{opacity:0}50%,100%{opacity:1}}
.bcs-up{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-up var(--d) ease-in-out both}
@keyframes bcs-up{0%{transform:translateY(100%)}12%,82%{transform:none}100%{transform:translateY(100%)}}
.bcs-dim{animation:bcs-dim 4s ease-in-out both}
@keyframes bcs-dim{0%{opacity:0}12%,80%{opacity:1}100%{opacity:0}}
.bcs-fx{animation:bcs-fx var(--d) ease-in-out both}
@keyframes bcs-fx{0%{opacity:0}8%,86%{opacity:1}100%{opacity:0}}
.bcs-ding{animation:bcs-ding .6s steps(1) 3 both}
@keyframes bcs-ding{0%{opacity:1}50%,100%{opacity:0}}
.bcs-dingt{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-dingt .6s steps(1) 3 both}
@keyframes bcs-dingt{0%{transform:rotate(-9deg)}25%{transform:rotate(9deg)}50%,100%{transform:none}}
.bcs-z3{transform-box:fill-box;transform-origin:50% 100%;animation:bcs-z3 .5s steps(1) 8 both}
@keyframes bcs-z3{0%{transform:scale(1)}50%{transform:scale(1.3) translateY(-1px)}}
.bcs-gun1{animation:bcs-tie1 .8s steps(1) infinite}.bcs-gun2{animation:bcs-tie2 .8s steps(1) infinite}
.bcs-lamp{animation:bcs-lamp 1.6s steps(1) infinite}
@keyframes bcs-lamp{50%{opacity:.8}}
@media (prefers-reduced-motion: reduce){
 .bcs-flame,.bcs-pen,.bcs-run,.bcs-chip,.bcs-sway,.bcs-tube,.bcs-arms,.bcs-ring0,.bcs-tilt0,.bcs-ring1,.bcs-tilt1,.bcs-ring2,.bcs-tilt2,.bcs-mad,.bcs-madtilt,.bcs-star,.bcs-wipe,.bcs-shout,.bcs-cheer,.bcs-ad,.bcs-blink,.bcs-stamp,.bcs-fresh,.bcs-flip,.bcs-cam,.bcs-bub,.bcs-grain,.bcs-walk,.bcs-go,.bcs-putt,.bcs-tie1,.bcs-tie2,.bcs-up,.bcs-dim,.bcs-lamp,.bcs-fx,.bcs-ding,.bcs-dingt,.bcs-z3,.bcs-gun1,.bcs-gun2{animation:none}
 .bcs-ring0,.bcs-ring1,.bcs-ring2{opacity:0}.bcs-mad{opacity:1}.bcs-star,.bcs-wipe,.bcs-shout,.bcs-cheer,.bcs-ad,.bcs-cam,.bcs-bub{opacity:1;transform:none}.bcs-run{opacity:.6}
 .bcs-tie2,.bcs-gun2{opacity:0}.bcs-ding{opacity:0}.bcs-fx{opacity:1}.bcs-up{transform:none}.bcs-dim{opacity:.85}.bcs-go{transform:translateX(var(--b))}
}`

/** The rules of a stylesheet that mention one of `names` (a class or keyframe name without the `bcs-` prefix), reduced-motion block included. */
export const pickCss = (css: string, names: string[]): string => {
  const parse = (src: string): string[] => {
    const out: string[] = []
    let depth = 0
    let from = 0
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}' && --depth === 0) {
        out.push(src.slice(from, i + 1).trim())
        from = i + 1
      }
    }
    return out
  }
  const has = (sel: string): boolean => names.some(n => new RegExp(`bcs-${n}(?![a-z0-9])`).test(sel))
  const keep = (st: string): string => {
    const open = st.indexOf('{')
    const head = st.slice(0, open)
    if (head.startsWith('@media')) {
      const inner = parse(st.slice(open + 1, st.lastIndexOf('}')))
        .map(r => {
          const o = r.indexOf('{')
          const sel = r.slice(0, o).split(',').filter(x => has(x)).join(',')
          return sel ? `${sel}${r.slice(o)}` : ''
        })
        .filter(Boolean)
      return inner.length ? `${head}{${inner.join('')}}` : ''
    }
    return has(head) ? st : ''
  }
  return parse(css).map(keep).filter(Boolean).join('\n')
}
/** What the pane's cards need (their own motion, Mike and Lalo on them, Chuck's dim, Hector's bell). */
export const CARD_CSS = pickCss(BCS_CSS, ['pen', 'run', 'flip', 'fresh', 'stamp', 'sway', 'grain', 'walk', 'cam', 'bub', 'up', 'dim', 'lamp', 'mad', 'madtilt'])

// ---------------------------------------------------------------- primitives
/** Film grain for GENE: fractal noise, desaturated, 7% alpha, jittering 1 px in steps so it reads as projected film. */
export const grain = (W: number, H: number): string =>
  `<defs><filter id="bcsgr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .07"/></feComponentTransfer></filter></defs><rect class="bcs-grain" x="-2" y="-2" width="${W + 4}" height="${H + 4}" filter="url(#bcsgr)" pointer-events="none"/>`
/** A soft vignette for GENE (the Omaha scenes are shot dark at the edges). */
export const vignette = (W: number, H: number): string =>
  `<defs><radialGradient id="bcsvg" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></radialGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#bcsvg)" pointer-events="none"/>`

/** Cocobolo: a dark brown field with a few faint wavy grain lines. */
export const wood = (x: number, y: number, w: number, h: number, gene: boolean, seed = 'wood', rx = 0): string => {
  const rnd = rng(seed)
  let s = `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="${prop('wood', gene)}"/>`
  const n = Math.max(2, Math.round(h / 5))
  for (let i = 0; i < n; i++) {
    const yy = y + 2 + (h - 4) * ((i + rnd()) / n)
    const a = 1.5 + rnd() * 3
    s += `<path d="M${r1(x)} ${r1(yy)}Q${r1(x + w * 0.25)} ${r1(yy - a)} ${r1(x + w * 0.5)} ${r1(yy)}T${r1(x + w)} ${r1(yy)}" fill="none" stroke="${prop('woodDark', gene)}" stroke-opacity=".7" stroke-width="1"/>`
  }
  return s
}
/** A 5-point star (the TV ad's star and the stars on the Saul card). */
export const star = (cx: number, cy: number, r: number, fill: string, extra = ''): string => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    d += `${i ? 'L' : 'M'}${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * Math.sin(a))}`
  }
  return `<path d="${d}Z" fill="${fill}" ${extra}/>`
}
/** A 16-point starburst behind the cheer's shout. */
export const burst = (cx: number, cy: number, r: number, fill: string, extra = ''): string => {
  let d = ''
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16
    const rr = i % 2 ? r * 0.72 : r
    d += `${i ? 'L' : 'M'}${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * Math.sin(a))}`
  }
  return `<path d="${d}Z" fill="${fill}" ${extra}/>`
}

/** The inflatable Statue of Liberty on the strip-mall roof (a prop, 10 by 16 px): pixel art, torch up. */
export const STATUE: Sprite = { rows: ['......t...', '......t...', '.....tt...', '.....ss...', '..sssss...', '.ssasss...', '..sasas...', '.ssssss...', '..ssss....', '..ssss....', '..dssd....', '..ssss....', '.ssssss...', '.ssssss...', 'ssssssss..', 'dddddddd..'], pal: { t: PROPS.torch, s: PROPS.statue, a: '#2A3F3A', d: PROPS.statueDark } }
export const statue = (x: number, y: number, s: number, gene: boolean, cls = 'bcs-sway'): string => px(STATUE, x, y, s, { grey: gene, cls })

/** The wacky waving inflatable tube man (a prop built from rects, 9 wide and 20 tall at s 1): a head, a tube body, flailing arms. */
export const tubeMan = (x: number, y: number, s: number, gene: boolean, still = false): string => {
  const red = prop('adRed', gene), yel = prop('adYellow', gene), blue = prop('adBlue', gene)
  const body = `<rect x="3" y="4" width="3" height="14" fill="${red}"/><rect x="3" y="8" width="3" height="2" fill="${yel}"/><rect x="3" y="13" width="3" height="2" fill="${yel}"/><rect x="2" y="3" width="5" height="3" fill="${red}"/><rect x="2.5" y="0.5" width="4" height="3" fill="${yel}"/><rect x="2" y="18" width="5" height="2" fill="${blue}"/>`
  const arms = `<g class="bcs-arms"><path d="M3 6L0 2M6 6L9 2" stroke="${yel}" stroke-width="1.4" stroke-linecap="round" fill="none"/></g>`
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${s})" shape-rendering="crispEdges"><g class="${still ? '' : 'bcs-tube'}">${body}${arms}</g></g>`
}

/** Hector's desk bell (9 by 7). `mode`: idle rings once per 24 s, slow per 6 s, fast per 2 s, mad at 2 Hz, still never. */
export const BELL: Sprite = { rows: ['...bbb...', '..bbbbb..', '.bbbbbbb.', '.bbbbbbb.', 'ddddddddd', '....k....', '..kkkkk..'], pal: { b: PROPS.bell, d: PROPS.bellDark, k: '#5A4A2A' } }
export type BellMode = 'idle' | 'slow' | 'fast' | 'mad' | 'still'
/** The bell's mode for a context: idle below 50%, a slow ding from 50%, faster from 85%, mad from 95% (or over budget). */
export const bellMode = (ctxPct: number, over = false): BellMode => (ctxPct >= 95 || over ? 'mad' : ctxPct >= 85 ? 'fast' : ctxPct >= 50 ? 'slow' : 'idle')
export const bell = (x: number, y: number, s: number, mode: BellMode, gene: boolean): string => {
  const n = mode === 'idle' ? '0' : mode === 'slow' ? '1' : '2'
  const ring = mode === 'mad' ? 'bcs-mad' : `bcs-ring${n}`
  const tilt = mode === 'mad' ? 'bcs-madtilt' : `bcs-tilt${n}`
  const col = mode === 'mad' ? prop('adRed', gene) : prop('bell', gene)
  const arcs = mode === 'still' ? '' : `<g class="${ring}" fill="none" stroke="${col}" stroke-width="1.2" stroke-linecap="round"><path d="M${r1(x - 2 * s)} ${r1(y + s)}q-2 1.5 0 3.5"/><path d="M${r1(x + 11 * s)} ${r1(y + s)}q2 1.5 0 3.5"/><path d="M${r1(x - 4 * s)} ${r1(y)}q-3 2.5 0 5.5" opacity=".6"/><path d="M${r1(x + 13 * s)} ${r1(y)}q3 2.5 0 5.5" opacity=".6"/></g>`
  return `<g>${arcs}<g class="${mode === 'still' ? '' : tilt}">${px(BELL, x, y, s, { grey: gene })}</g></g>`
}

/** Finger guns: two frames of a pixel hand (pointing, then the recoil), 8 by 6 pixels. */
const GUN1: Sprite = { rows: ['..ss....', '..ss.s..', '.ssssss.', '.ssssss.', '.ssssss.', '..sss...'], pal: { s: '#F0B58C' } }
const GUN2: Sprite = { rows: ['.ss.....', '.ss..s..', '.ssssss.', '.ssssss.', '.ssssss.', '..sss...'], pal: { s: '#F0B58C' } }
export const fingerGuns = (x: number, y: number, s: number, gene: boolean): string => `<g class="bcs-gun1">${px(GUN1, x, y, s, { grey: gene })}</g><g class="bcs-gun2">${px(GUN2, x, y, s, { grey: gene })}</g>`


/** Chuck's lantern (8 by 13): lit while the clock runs, out otherwise. */
export const lantern = (x: number, y: number, lit: boolean, gene: boolean): string => {
  const g = gene ? '#3A3A3A' : '#3A3128'
  const fr = gene ? '#9A9A9A' : '#9A8560'
  let s = `<rect x="${r1(x + 3)}" y="${y}" width="2" height="2" fill="${fr}"/><rect x="${r1(x + 1)}" y="${y + 2}" width="6" height="1.5" fill="${fr}"/><rect x="${r1(x + 1.5)}" y="${y + 3.5}" width="5" height="7" fill="${g}" stroke="${fr}" stroke-width="1"/><rect x="${x}" y="${y + 10.5}" width="8" height="2" fill="${fr}"/>`
  if (lit) s += `<g class="bcs-flame"><path d="M${r1(x + 4)} ${r1(y + 4.5)}q2 2 0 5q-2 -3 0 -5z" fill="${prop('flame', gene)}"/><path d="M${r1(x + 4)} ${r1(y + 6.3)}q.9 1 0 2.4q-.9 -1.4 0 -2.4z" fill="${prop('flameCore', gene)}"/></g><ellipse cx="${r1(x + 4)}" cy="${r1(y + 7)}" rx="8" ry="6" fill="${prop('flame', gene)}" opacity=".2"/>`
  else s += `<path d="M${r1(x + 3)} ${r1(y + 8.5)}h2" stroke="${gene ? '#666666' : '#6E6050'}" stroke-width="1"/>`
  return s
}

/** A manila folder tab (the episode tag, the docket rows): a trapezoid `w` wide and `h` tall. */
export const tab = (x: number, y: number, w: number, h: number, fill: string, extra = ''): string => `<path d="M${r1(x + 3)} ${r1(y)}h${r1(w - 6)}l3 ${r1(h)}h-${r1(w)}z" fill="${fill}" ${extra}/>`

/** The era progression gauge: six season bars revealed left to right as `pct` grows (the job runs S1 to S6). */
export const eraBar = (x: number, y: number, w: number, h: number, pct: number, gene: boolean, o: { near?: boolean } = {}): string => {
  const gap = 2
  const segW = (w - gap * 5) / 6
  const fillW = (w * clamp(pct, 0, 100)) / 100
  let s = ''
  const hi = o.near ? prop('adYellow', gene) : prop('cream', gene)
  ERA.forEach((c, i) => {
    const sx = x + i * (segW + gap)
    const col = gene ? grey(c) : c
    s += `<rect x="${r1(sx)}" y="${r1(y)}" width="${r1(segW)}" height="${h}" rx="1" fill="${col}" opacity=".22"/>`
    const f = clamp(fillW - i * (segW + gap), 0, segW)
    if (f > 0.4) s += `<rect x="${r1(sx)}" y="${r1(y)}" width="${r1(f)}" height="${h}" rx="1" fill="${col}"/><rect x="${r1(sx)}" y="${r1(y)}" width="${r1(f)}" height="1" fill="${hi}" opacity=".45"/>`
  })
  if (fillW > 1 && fillW < w) s += `<rect x="${r1(x + fillW - 1)}" y="${r1(y - 1)}" width="1.5" height="${h + 2}" fill="${prop('cream', gene)}"/>`
  return s
}

/** A legal-pad checkbox pip (9 px): done navy with a cream tick, running yellow (pulses), todo outline, failed red X, stopped muted. */
export const pip = (st: string, cx: number, cy: number, gene: boolean): string => {
  const P = pal(gene)
  const x = cx - 4.5
  const y = cy - 4.5
  if (st === 'done') return `<rect x="${r1(x)}" y="${r1(y)}" width="9" height="9" rx="1" fill="${P.a}"/><path d="M${r1(x + 2)} ${r1(y + 4.6)}l2 2l3.2 -4" fill="none" stroke="${P.cream}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  if (st === 'running') return `<rect x="${r1(x)}" y="${r1(y)}" width="9" height="9" rx="1" fill="none" stroke="${P.warn}" stroke-width="1.2"/><rect class="bcs-run" x="${r1(x + 2.5)}" y="${r1(y + 2.5)}" width="4" height="4" fill="${P.warn}"/>`
  if (st === 'failed') return `<rect x="${r1(x)}" y="${r1(y)}" width="9" height="9" rx="1" fill="none" stroke="${P.alert}" stroke-width="1.2"/><path d="M${r1(x + 2.5)} ${r1(y + 2.5)}l4 4M${r1(x + 6.5)} ${r1(y + 2.5)}l-4 4" stroke="${P.alert}" stroke-width="1.4" stroke-linecap="round"/>`
  if (st === 'stopped') return `<rect x="${r1(x)}" y="${r1(y)}" width="9" height="9" rx="1" fill="${P.muted}" opacity=".55"/>`
  return `<rect x="${r1(x + 0.5)}" y="${r1(y + 0.5)}" width="8" height="8" rx="1" fill="none" stroke="${P.muted}" stroke-opacity=".8"/>`
}

// ---------------------------------------------------------------- words
export const BCS_BOOT = ['OPENING THE OFFICE…', "S'ALL GOOD, MAN"]
export const GENE_BOOT = ['CLOCKING IN…', 'OMAHA · THE MALL']
export const BCS_GREETING = "Saul Goodman, attorney at law. S'all good, man!"
export const GENE_GREETING = 'Gene speaking. …It’s just a name.'
export const BCS_TITLE_WORDS = ['Chicanery', 'Sunk Costs', 'Expenses', 'Slip', 'Something Stupid', 'Bagman', 'Wine and Roses', 'Fun and Games', 'Waterworks', 'Quite a Ride', 'Namaste', 'Magic Man', 'Off Brand', 'Winner']
export const BCS_SKIN_WORDS = BCS_TITLE_WORDS
export const BCS_TOOLS: Record<string, string> = {
  Read: 'Review', Grep: 'Discovery', Glob: 'Docket', LS: 'Docket', Edit: 'Redline', MultiEdit: 'Redline', NotebookEdit: 'Redline', Write: 'Draft',
  Bash: 'Run', PowerShell: 'Run', Agent: 'Retain', ToolSearch: 'Precedent', WebFetch: 'File', WebSearch: 'Research',
}
export const verbOf = (tool: string): string => BCS_TOOLS[tool] ?? tool
export const bcsWarning = (gene: boolean) => (pct: number): string =>
  pct >= 95 ? `Context ${pct}%: ${gene ? "it's just a name." : 'better call Saul.'} /compact now.` : `Context ${pct}%: s'all good, man? /compact soon.`
/** The secret skin's words: typing "takavic" while wearing Better Call Saul switches to GENE; "saul goodman" or "better call saul" in GENE switches back. */
export const TAKAVIC_RE = /(?<![a-z0-9])takavic(?![a-z0-9])/i
export const SAUL_GOODMAN_RE = /(?<![a-z0-9])(?:saul\s+goodman|better\s+call\s+saul)(?![a-z0-9])/i

/** The 63 episodes, in order (code, title): all verified against the show's episode list. */
export const EPISODES: [string, string][] = [['S1E1', 'Uno'], ['S1E2', 'Mijo'], ['S1E3', 'Nacho'], ['S1E4', 'Hero'], ['S1E5', 'Alpine Shepherd Boy'], ['S1E6', 'Five-O'], ['S1E7', 'Bingo'], ['S1E8', 'RICO'], ['S1E9', 'Pimento'], ['S1E10', 'Marco'],
  ['S2E1', 'Switch'], ['S2E2', 'Cobbler'], ['S2E3', 'Amarillo'], ['S2E4', 'Gloves Off'], ['S2E5', 'Rebecca'], ['S2E6', "Bali Ha'i"], ['S2E7', 'Inflatable'], ['S2E8', 'Fifi'], ['S2E9', 'Nailed'], ['S2E10', 'Klick'],
  ['S3E1', 'Mabel'], ['S3E2', 'Witness'], ['S3E3', 'Sunk Costs'], ['S3E4', 'Sabrosito'], ['S3E5', 'Chicanery'], ['S3E6', 'Off Brand'], ['S3E7', 'Expenses'], ['S3E8', 'Slip'], ['S3E9', 'Fall'], ['S3E10', 'Lantern'],
  ['S4E1', 'Smoke'], ['S4E2', 'Breathe'], ['S4E3', 'Something Beautiful'], ['S4E4', 'Talk'], ['S4E5', 'Quite a Ride'], ['S4E6', 'Piñata'], ['S4E7', 'Something Stupid'], ['S4E8', 'Coushatta'], ['S4E9', 'Wiedersehen'], ['S4E10', 'Winner'],
  ['S5E1', 'Magic Man'], ['S5E2', '50% Off'], ['S5E3', 'The Guy for This'], ['S5E4', 'Namaste'], ['S5E5', 'Dedicado a Max'], ['S5E6', 'Wexler v. Goodman'], ['S5E7', 'JMM'], ['S5E8', 'Bagman'], ['S5E9', 'Bad Choice Road'], ['S5E10', 'Something Unforgivable'],
  ['S6E1', 'Wine and Roses'], ['S6E2', 'Carrot and Stick'], ['S6E3', 'Rock and Hard Place'], ['S6E4', 'Hit and Run'], ['S6E5', 'Black and Blue'], ['S6E6', 'Axe and Grind'], ['S6E7', 'Plan and Execution'], ['S6E8', 'Point and Shoot'], ['S6E9', 'Fun and Games'], ['S6E10', 'Nippy'], ['S6E11', 'Breaking Bad'], ['S6E12', 'Waterworks'], ['S6E13', 'Saul Gone']]
/** One title an hour, as the ticker's "S3E5 Chicanery". */
export const bcsEpisodeAt = (at: number): string => {
  const e = EPISODES[Math.floor(at / 3_600_000) % EPISODES.length] as [string, string]
  return `${e[0]} ${e[1]}`
}
/** Season 1's titles all end in "O" except "Alpine Shepherd Boy" (Vince Gilligan, the Insider podcast): that last letter gets its own colour. */
export const s1Ending = (code: string, title: string): boolean => /^S1E\d+$/.test(code) && title !== 'Alpine Shepherd Boy' && /o$/i.test(title)

// ---------------------------------------------------------------- the slim band's hooks
export type BandCtx = { ctxPct: number; overBudget: boolean; isWorking?: boolean; capri?: boolean; at?: number }

/** The ground layer: wood grain, the strip-mall roofline with faux-Roman column ticks, the Statue, the tube man, Hector's bell. GENE: vignette, grain. */
export const bcsFoot = (W: number, H: number, ctx: BandCtx, gene: boolean): string => {
  const P = pal(gene)
  let s = `<g>`
  const rnd = rng(`grain${W}`)
  for (let i = 0; i < 7; i++) {
    const yy = 6 + rnd() * (H - 12)
    s += `<path d="M0 ${r1(yy)}Q${r1(W * 0.3)} ${r1(yy - 2 - rnd() * 3)} ${r1(W * 0.6)} ${r1(yy)}T${W} ${r1(yy + 1)}" fill="none" stroke="${P.tile2}" stroke-width="1.2" opacity=".9"/>`
  }
  const ry = H - 7.5
  s += `<line x1="6" y1="${ry}" x2="${W - 6}" y2="${ry}" stroke="${P.muted}" stroke-opacity=".45" stroke-width="1.5"/>`
  for (let x = 36; x < W - 60; x += 52) s += `<rect x="${x}" y="${ry + 2}" width="1.5" height="${H - ry - 3}" fill="${P.muted}" opacity=".35"/><rect x="${x + 5}" y="${ry + 2}" width="1.5" height="${H - ry - 3}" fill="${P.muted}" opacity=".35"/>`
  // The inflatable Statue at the left end of the roof (x 6 to 19), clear of the tip dot at x 20; the tube man dances on the roof by the bell.
  s += statue(6, ry - 20.8, 1.3, gene, gene ? '' : 'bcs-sway')
  s += tubeMan(W - 37, ry - 18, 0.9, gene, gene)
  const mode = bellMode(ctx.ctxPct, ctx.overBudget)
  s += `<g opacity="${mode === 'mad' ? 0.95 : 0.6}">${bell(W - 21, H - 17, 1.3, mode, gene)}</g>`
  s += '</g>'
  if (gene) s += vignette(W, H) + grain(W, H)
  return s
}

/** MISSION CONTROL as a cream business card (17 tall) with a navy pinstripe, then the firm in gold (wide bands only). */
/** The session total in dollars, "Total $1.23" (every band shows it): a self-contained tag after the name, 11.5 px, `w` wide. */
export const bcsTotal = (x: number, y: number, usd: number, gene: boolean): { svg: string; w: number } => {
  const P = pal(gene)
  const v = `$${(Number.isFinite(usd) && usd > 0 ? usd : 0).toFixed(2)}`
  const w = sansW('Total ', 11.5) + sansW(v, 11.5, 0, true) + 2
  return { svg: `<text x="${r1(x)}" y="${y}" font-family="${FONT}" font-size="11.5" fill="${P.muted}" font-variant-numeric="tabular-nums">Total <tspan font-weight="700" fill="${P.text}">${v}</tspan></text>`, w }
}
export const bcsName = (x: number, y: number, W: number, gene: boolean, totalUsd = 0): { svg: string; w: number } => {
  const P = pal(gene)
  const label = 'MISSION CONTROL'
  const lw = serifW(label, 9.5, 1.4, true)
  const w = lw + 22
  const cream = prop('cream', gene)
  const navy = prop('navy', gene)
  let s = `<rect x="${r1(x)}" y="${y - 12.5}" width="${r1(w)}" height="17" rx="1.5" fill="${cream}"/><rect x="${r1(x + 4)}" y="${y - 10}" width="1.5" height="12" fill="${navy}"/><rect x="${r1(x + 7)}" y="${y - 10}" width="1" height="12" fill="${navy}" opacity=".5"/>`
  s += S(x + 13, y, label, 9.5, 700, navy, 'letter-spacing="1.4"')
  let tw = w
  const tot = bcsTotal(x + w + 12, y, totalUsd, gene)
  s += tot.svg
  tw += 12 + tot.w
  const firm = gene ? (W >= 1100 ? 'GENE TAKAVIC · MALL BAKERY · OMAHA' : W >= 900 ? 'GENE TAKAVIC · OMAHA' : '') : W >= 1100 ? 'SAUL GOODMAN & ASSOCIATES · ATTORNEY AT LAW' : W >= 900 ? 'SAUL GOODMAN & ASSOCIATES' : ''
  if (firm) {
    s += S(x + tw + 14, y, firm, 9.5, 700, P.gold, 'letter-spacing="1"')
    tw += 14 + serifW(firm, 9.5, 1, true)
  }
  return { svg: s, w: tw }
}

/** The context chip: 85 to 94 S'ALL GOOD, MAN? on legal-pad yellow; 95+ BETTER CALL SAUL! on ad red. GENE: hatched grey, then IT'S JUST A NAME. */
export const bcsChip = (x: number, y: number, pct: number, gene: boolean): { svg: string; w: number } => {
  if (pct < 85) return { svg: '', w: 0 }
  const hot = pct >= 95
  const label = hot ? (gene ? "IT'S JUST A NAME" : 'BETTER CALL SAUL!') : "S'ALL GOOD, MAN?"
  const fill = gene ? (hot ? '#E8E8E8' : '#BDBDBD') : hot ? PROPS.adRed : PROPS.adYellow
  const ink = hot && !gene ? '#FFF4D6' : '#1A1A1A'
  const w = condW(label, 10.5, 0.6) + 32
  let s = `<g class="${hot ? 'bcs-chip' : ''}">`
  if (gene && !hot) s += `<defs><pattern id="bcshatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${fill}"/><rect width="1.5" height="4" fill="#7A7A7A"/></pattern></defs>`
  s += `<rect x="${r1(x)}" y="${y - 12}" width="${r1(w)}" height="16" rx="2" fill="${gene && !hot ? 'url(#bcshatch)' : fill}"/>`
  s += star(x + 11, y - 4, 5, ink)
  s += C(x + 21, y, label, 10.5, ink, 'letter-spacing=".6"')
  return { svg: `${s}</g>`, w: Math.round(w) }
}

/** The episode as a manila file tab holding the code, then the title in italic (a season 1 title's last "O" in the ad's yellow). */
export const bcsEpW = (code: string, title: string, full: boolean): number => serifW(code, 9.5, 0.6, true) + 14 + (full ? 8 + sansW(title, 11.5) : 0)
export const bcsEp = (xr: number, y: number, code: string, title: string, full: boolean, gene: boolean): string => {
  const P = pal(gene)
  const cw = serifW(code, 9.5, 0.6, true) + 14
  let s = ''
  let right = xr
  if (full) {
    const hi = s1Ending(code, title)
    const body = hi ? `${esc(title.slice(0, -1))}<tspan fill="${prop('adYellow', gene)}" font-weight="700" font-style="normal">${esc(title.slice(-1))}</tspan>` : esc(title)
    s += `<text x="${r1(xr)}" y="${y}" font-family="${FONT}" font-size="11.5" fill="${P.sub}" text-anchor="end" font-style="italic">${body}</text>`
    right = xr - sansW(title, 11.5) - 8
  }
  const x = right - cw
  return s + tab(x, y - 11.5, cw, 15, prop('manila', gene)) + S(x + cw / 2, y, code, 9.5, 700, prop('creamInk', gene), 'text-anchor="middle" letter-spacing=".6"')
}

/** Chuck's lantern, then BILLING n/m (lit) or OFF THE CLOCK n/m (out), right-aligned at `xr`. */
export const bcsGauge = (xr: number, y: number, isWorking: boolean, done: number, total: number, gene: boolean): { svg: string; w: number } => {
  const P = pal(gene)
  const label = isWorking ? 'BILLING' : 'OFF THE CLOCK'
  const cnt = total > 0 ? `${done}/${total}` : '—'
  const lw = sansW(label, 9.5, 0.8, true)
  const cw = sansW(cnt, 11.5, 0, true)
  const w = 8 + 8 + lw + 6 + cw
  const x = xr - w
  let s = lantern(x, y - 12, isWorking, gene)
  s += T(x + 16, y, label, 9.5, 700, isWorking ? P.gold : P.muted, 'letter-spacing=".8"')
  s += T(x + 16 + lw + 6, y, cnt, 11.5, 700, isWorking ? P.text : P.sub, 'font-variant-numeric="tabular-nums"')
  return { svg: s, w }
}

/** The boss bust in the task row's 34 by 40 box at (20, 36): Saul at 0.9 (37 by 36), Gene at 0.9 (30 by 36). */
export const bcsFigure = (gene: boolean): string =>
  gene
    ? // The only colour in GENE: a tiny ad for "Better Call Saul" reflected in the glasses (two pixels, red and yellow).
      `<g class="bcs-bust">${px(BCS_GENE_BUST, 22, 38, 0.9)}<rect x="${r1(22 + 13 * 0.9)}" y="${r1(38 + 13 * 0.9)}" width=".9" height=".9" fill="#D7262C"/><rect x="${r1(22 + 19 * 0.9)}" y="${r1(38 + 13 * 0.9)}" width=".9" height=".9" fill="#FFD23F"/></g>`
    : `<g class="bcs-bust">${px(BCS_SAUL_BUST, 18, 38, 0.9)}</g>`

/** A paralegal at 0.34 (5 by 16), the blazer tinted by role (one look per role colour). */
export const bcsCrew = (x: number, y: number, color: string, gene: boolean): string => {
  const sp = [BCS_PARALEGAL, BCS_PARALEGAL2, BCS_PARALEGAL3][hashOf(color) % 3] as Sprite
  const s = 0.34
  const w = spW(sp) * s
  return `<g>${px(sp, x + (7 - w) / 2, y - 2, s, { tint: gene ? grey(color) : color, grey: gene })}</g>`
}

/** The task row's gauge: the six season bars, 6 tall, in place of the segment bar. */
export const bcsTear = (x: number, y: number, w: number, pct: number, ctxPct: number, gene: boolean): string => eraBar(x, y, w, 6, pct, gene, { near: ctxPct >= 95 })

/** The one-in-four cheesy late-night ad in place of the plain cheer (seeded by the moment the job finished). */
export const isAdCheer = (startAt: number | undefined): boolean => startAt !== undefined && hashOf(`bcs-ad|${Math.floor(startAt / 1000)}`) % 4 === 0
/** The made-up phone number on the ad's banner: a fictional 555-01xx. */
export const AD_PHONE = '505-555-0100'

/**
 * The cheer: the TV ad's star-wipe. A red band wipes across, a yellow starburst spins up with DONE!, BETTER CALL SAUL! with a navy
 * shadow. One time in four (`isAdCheer`) it is a cheesy late-night ad with a phone banner. GENE: NIPPY!
 */
export const bcsCheer = (W: number, H: number, gene: boolean, startAt?: number): string => {
  const red = prop('adRed', gene), yel = prop('adYellow', gene), blue = prop('adBlue', gene)
  const cream = gene ? '#F4F4F4' : '#FFF4D6'
  const cy = H * 0.5
  const ad = !gene && isAdCheer(startAt)
  const text = gene ? 'NIPPY!' : 'BETTER CALL SAUL!'
  const fs = W < 800 ? 19 : 23
  const tw = condW(text, fs, 1)
  const cx = W / 2 + 14
  const at = startAt !== undefined ? ` style="animation-delay:${pin(startAt)}"` : ''
  let s = `<g class="${ad ? 'bcs-ad' : 'bcs-cheer'}" pointer-events="none"${at}>`
  s += `<rect class="bcs-wipe" x="0" y="${r1(cy - 23)}" width="${W}" height="46" fill="${red}" opacity=".94"${at}/>`
  const bx = cx - tw / 2 - 34
  s += `<g class="bcs-star"${at}>${burst(bx, cy, 30, yel)}${burst(bx, cy, 22, gene ? '#E8E8E8' : '#FFF2A8', 'opacity=".9"')}<g transform="rotate(-12 ${r1(bx)} ${r1(cy)})">${C(bx, cy + 3.5, 'DONE!', 10, prop('navy', gene), 'text-anchor="middle" letter-spacing=".5"')}</g></g>`
  s += `<g class="bcs-shout"${at}>${C(cx + 1.5, cy + 2.5, text, fs, prop('navy', gene), 'text-anchor="middle" letter-spacing="1"')}${C(cx, cy + 1, text, fs, cream, 'text-anchor="middle" letter-spacing="1"')}`
  s += gene ? C(cx, cy + 16, 'MALL BAKERY · JOB DONE', 8.5, cream, 'text-anchor="middle" letter-spacing="1.6" opacity=".9"') : ad ? '' : C(cx, cy + 16, "S'ALL GOOD, MAN!", 8.5, cream, 'text-anchor="middle" letter-spacing="1.6" opacity=".95"')
  s += '</g>'
  // Saul's finger guns (a two-frame pixel hand) to the right of the shout, then Hector's bell dings three times at the far end.
  if (!gene) s += `<g class="bcs-shout"${at}>${fingerGuns(cx + tw / 2 + 12, cy - 9, 2, false)}</g>`
  s += `<g class="bcs-shout"${at}><g class="bcs-ding" fill="none" stroke="${prop('bell', gene)}" stroke-width="1.2" stroke-linecap="round" style="animation-delay:calc(${startAt !== undefined ? pin(startAt) : '0s'} + 1.1s)"><path d="M${r1(W - 36)} ${r1(cy - 6)}q-2 1.5 0 3.5"/><path d="M${r1(W - 14)} ${r1(cy - 6)}q2 1.5 0 3.5"/></g>${bell(W - 31, cy - 7, 1.2, 'still', gene)}</g>`
  if (ad) {
    // The late-night ad: a phone banner across the foot (a fictional 555-01xx number) on blue with yellow stars, blinking at 1.25 Hz.
    const bw = Math.min(W - 40, condW(AD_PHONE, 16, 1.2) + 130)
    const bxx = (W - bw) / 2
    s += `<g class="bcs-shout"${at}><rect x="${r1(bxx)}" y="${r1(cy + 20)}" width="${r1(bw)}" height="${r1(Math.min(24, H - cy - 22))}" rx="2" fill="${blue}"/>${star(bxx + 12, cy + 32, 5, yel)}${star(bxx + bw - 12, cy + 32, 5, yel)}${C(W / 2 - 30, cy + 37, 'CALL NOW!', 10, cream, 'text-anchor="middle" letter-spacing="1"')}<g class="bcs-blink"${at}>${C(W / 2 + 46, cy + 38, AD_PHONE, 16, yel, 'text-anchor="middle" letter-spacing="1.2"')}</g></g>`
  }
  return `${s}</g>`
}
