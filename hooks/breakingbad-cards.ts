// The Breaking Bad skin's props (v2): the PERIODIC TABLE (level as an element, an A1A Car Wash
// receipt, the badges lit on a real table), ON AIR (Saul's TV and tonight's listings), the
// CLASSROOM chalkboard, and the pieces of its slim band (Br and Ba tiles, the purity gauge, the
// context chip, Walt, the crew, the crystal pips and the desert strip). Pure SVG strings, no
// state, no I/O. A fan homage: chemistry and purity are flavour only (a periodic table, a
// car-wash receipt, a TV, a chalkboard); nothing here shows a process. The props keep their own
// colours (paper, wood, slate, a CRT): they are objects, not UI. Type is the skin's system sans
// at weights 400 and 700 only, and widths come from `sansW` (measured in Chrome), not `textW`.

import { BADGES, levelOf, xpFor } from './extras'
import type { Beat, Cred, Frame } from './extras'
import type { Legend } from './eggs'
import { BB_TOOLS, ELEMENTS, empireRankOf } from './breakingbad'
import { BB_HEIS_BUST, BB_WALT_BUST, spriteMarkup } from './cast'
import type { Sprite } from './cast'

export type CardTheme = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }
/** The theme colours plus the skin's own tokens (the element tile, the empty cell, the desert). */
type Tok = CardTheme & { heis: boolean; el: string; elInk: string; cell: string; sky: string; lit: string; sel: string }
export const tokens = (t: CardTheme, heis: boolean): Tok => ({
  ...t, heis,
  el: heis ? '#5EC8F0' : '#4FB37A', elInk: heis ? '#06222E' : '#0B1F12',
  cell: heis ? '#121214' : '#132019', sky: heis ? '#1D1D21' : '#1F3529',
  lit: heis ? '#14303B' : '#1C3A29', sel: heis ? '#16242B' : '#1A3026',
})

const MONO = "'SF Mono',Menlo,Consolas,'Liberation Mono',monospace"
const BLUE = '#5EC8F0'
const YELLOW = '#F2C318'
const P = {
  paper: '#ECEEE6', paperInk: '#202422', paperSub: '#596059', paperRule: '#B9BDB3',
  board: '#1F2F26', boardEdge: '#162219', chalk: '#E6ECE3', chalkSub: '#AEBDB1',
  wood: '#5B4430', woodDark: '#3E2E20', woodLight: '#7A5C40',
  tv: '#3B2A1D', tvEdge: '#5A4430', bezel: '#141110', screen: '#0B1410', saulBlue: '#1D4E8C', saulRed: '#C8332B',
}
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r1 = (v: number): number => +(+v).toFixed(1)
const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v))
const hash = (s: string): number => [...String(s)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7)
let uid = 0
const uniq = (p: string): string => `${p}${(uid = (uid + 1) % 100000)}`

/** System sans (SF Pro Text, 9.5 to 13 px), measured in Chrome: caps .68/.72 em (400/700), lower .56/.60, digits .61/.66, narrow .30/.34, space .29/.27, M W @ % .93/.97, m w .86/.90. */
export const sansW = (s: string, size: number, ls = 0, bold = false): number =>
  [...String(s)].reduce((w, ch) => w + (ch === ' ' ? (bold ? 0.27 : 0.29) : /[MW@%]/.test(ch) ? (bold ? 0.97 : 0.93) : /[A-Z]/.test(ch) ? (bold ? 0.72 : 0.68) : /[0-9]/.test(ch) ? (bold ? 0.66 : 0.61) : /[.,:;'|!il()[\]jtf·]/.test(ch) ? (bold ? 0.34 : 0.3) : /[mw]/.test(ch) ? (bold ? 0.9 : 0.86) : (bold ? 0.6 : 0.56)) * size + ls, 0)
export const sansClip = (s: string, size: number, max: number, ls = 0, bold = false): string => {
  s = String(s)
  if (sansW(s, size, ls, bold) <= max) return s
  const a = [...s]
  while (a.length && sansW(`${a.join('')}…`, size, ls, bold) > max) a.pop()
  return a.length ? `${a.join('').trimEnd()}…` : ''
}
const fit = (s: string, max: number, from: number, to: number, bold = true): number => {
  for (let z = from; z >= to; z -= 0.5) if (sansW(s, z, 0, bold) <= max) return z
  return to
}
const wrap = (text: string, size: number, max: number, lines: number): string[] => {
  const words = String(text).split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (sansW(t, size) <= max) cur = t
    else {
      out.push(cur)
      cur = w
      if (out.length === lines) break
    }
  }
  if (out.length < lines && cur) out.push(cur)
  if (out.join(' ') !== words.join(' ')) out[out.length - 1] = sansClip(`${out[out.length - 1] ?? ''} …`, size, max)
  return out.slice(0, lines).map(l => sansClip(l, size, max))
}

// --- Pixel art from rows of letters ('.' is empty) ---
const sprite = (x: number, y: number, px: number, rows: string[], pal: Record<string, string>, extra = ''): string => {
  const out: string[] = []
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i] as string
      const c = pal[ch]
      if (!c) continue
      let n = 1
      while (r[i + n] === ch) n++
      out.push(`<rect x="${r1(x + i * px)}" y="${r1(y + j * px)}" width="${r1(n * px)}" height="${r1(px)}" fill="${c}"/>`)
      i += n - 1
    }
  })
  return `<g shape-rendering="crispEdges"${extra}>${out.join('')}</g>`
}
const HAT = ['...kkkkkkk...', '...khhhhhk...', '...ggggggg...', '..kkkkkkkkk..', 'kkkkkkkkkkkkk', '.kkkkkkkkkkk.']
/** The pork-pie hat, 13 x 6 pixels, one ink. */
export const hatPx = (x: number, y: number, w: number, ink: string, cls = '', op = 1): string =>
  sprite(x, y, w / 13, HAT, { k: ink, h: ink, g: ink }, `${cls ? ` class="${cls}"` : ''} opacity="${op}"`)
/**
 * A pixel-art bust (cast.ts's BB_WALT_BUST, or the hat one for Heisenberg), scaled to fit a w by h box
 * at (x, y): crisp pixels, centred, standing on the box's floor. The class `bbbust` marks it.
 */
export const bustPx = (sp: Sprite, x: number, y: number, w: number, h: number): string => {
  const cols = Math.max(...sp.rows.map(r => r.length))
  const nw = cols * 0.5625
  const nh = sp.rows.length * 0.5625
  const k = Math.min(w / nw, h / nh)
  // spriteMarkup draws at its own 0.5625 pixel inside a nw x nh box; the group scales that up to the slot.
  const inner = spriteMarkup(sp, '#FFFFFF', nw, nh)
  return `<g class="bbbust" shape-rendering="crispEdges" transform="translate(${r1(x + (w - nw * k) / 2)} ${r1(y + h - nh * k)}) scale(${+k.toFixed(4)})">${inner}</g>`
}
/** Mr. White's portrait for the band's figure slot (a 34 by 40 box at x 20, y 36); Heisenberg wears the hat. */
export const walt = (x: number, y: number, w: number, h: number, heis: boolean): string => bustPx(heis ? BB_HEIS_BUST : BB_WALT_BUST, x, y, w, h)
const CREW = ['..sss..', '.sssss.', '..sss..', '...s...', '.ccccc.', 'ccccccc', 'c.ccc.c', 'c.ccc.c', '..c.c..', '..c.c..']
export const crewPx = (x: number, y: number, px: number, color: string): string => sprite(x, y, px, CREW, { s: '#D8B89A', c: color })
const RV = ['.wwwwwwwwwww..', 'wbbwwbbwwwwww.', 'wbbwwbbwwwbbww', 'wwwwwwwwwwwwww', 'gggggggggggggg', '.kk.......kk..']
const rvPx = (x: number, y: number, px: number, op = 1): string => sprite(x, y, px, RV, { w: '#C9CEC2', b: BLUE, g: '#6F7E66', k: '#0B0F0C' }, ` opacity="${op}"`)

// --- Real chemistry data ---
const SYM = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ')
const NAME = 'Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium Aluminium Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon Caesium Barium'.split(' ')
const MASS = [1.008, 4.0026, 6.94, 9.0122, 10.81, 12.011, 14.007, 15.999, 18.998, 20.18, 22.99, 24.305, 26.982, 28.085, 30.974, 32.06, 35.45, 39.948, 39.098, 40.078, 44.956, 47.867, 50.942, 51.996, 54.938, 55.845, 58.933, 58.693, 63.546, 65.38, 69.723, 72.63, 74.922, 78.971, 79.904, 83.798, 85.468, 87.62, 88.906, 91.224, 92.906, 95.95, 98, 101.07, 102.91, 106.42, 107.87, 112.41, 114.82, 118.71, 121.76, 127.6, 126.9, 131.29, 132.91, 137.33]
const symOf = (z: number): string => SYM[z - 1] ?? '?'
const nameOf = (z: number): string => NAME[z - 1] ?? `Element ${z}`
/** [period, group] of an atomic number; 57-71 and 89-103 sit in the group-3 placeholder. */
const posOf = (z: number): [number, number] =>
  z === 1 ? [1, 1] : z === 2 ? [1, 18] : z <= 4 ? [2, z - 2] : z <= 10 ? [2, z + 8] : z <= 12 ? [3, z - 10] : z <= 18 ? [3, z] : z <= 36 ? [4, z - 18] : z <= 54 ? [5, z - 36] : z <= 56 ? [6, z - 54] : z <= 71 ? [6, 3] : z <= 86 ? [6, z - 68] : z <= 88 ? [7, z - 86] : z <= 103 ? [7, 3] : [7, z - 100]

/** The toast on a level-up: LEVEL 5 · BORON · The Professor. */
export const empireToast = (level: number): string => `LEVEL ${level} · ${nameOf(Math.min(118, level)).toUpperCase()} · ${empireRankOf(level)}`

export const CARD_CSS = `.onair{animation:onair 1.4s ease-in-out infinite}@keyframes onair{50%{opacity:.3}}
.bbp{animation:bbp 1.2s ease-in-out infinite}@keyframes bbp{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.onair,.bbp{animation:none}}`

const head = (W: number, t: Tok, font: string, title: string, meta: string, status = '', statusFill = t.subtext): string => {
  const tw = sansW(title, 13, 1, true)
  return `<rect x="16" y="13" width="3" height="13" fill="${t.accent}"/><text x="25" y="24" font-family="${font}" font-size="13" font-weight="700" letter-spacing="1" fill="${t.text}">${esc(title)}</text>`
    + (status ? `<text x="${r1(25 + tw + 10)}" y="24" font-family="${font}" font-size="11.5" font-style="italic" fill="${statusFill}">${esc(status)}</text>` : '')
    + (meta ? `<text x="${W - 16}" y="24" text-anchor="end" font-family="${font}" font-size="11" font-style="italic" fill="${t.muted}">${esc(meta)}</text>` : '')
}
const LBL = (x: number, y: number, s: string, fill: string, font: string, anchor = 'start', ls = 0.8): string =>
  `<text x="${r1(x)}" y="${y}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''} font-family="${font}" font-size="9.5" font-weight="700" letter-spacing="${ls}" fill="${fill}">${esc(s)}</text>`
const open = (W: number, H: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${CARD_CSS}</style>`

// ================================================================= 1. PERIODIC TABLE
const TILE_W = 108
const TILE_H = 128
const RECEIPT_W = 146
const narrow = (W: number): boolean => W < 420
const tableGeom = (W: number) => {
  const p = Math.floor((W - 32 + 2) / 18)
  return { p, cell: p - 2, x0: Math.round((W - (18 * p - 2)) / 2), y0: 198 + (narrow(W) ? 110 : 0) }
}
export const periodicHeight = (W: number): number => { const g = tableGeom(W); return g.y0 + 7 * g.p + 16 + 3 * 17 + 4 }

export const periodicCard = (W: number, c: Cred, theme: CardTheme, font: string, frame: Frame, heis = false): string => {
  const t = tokens(theme, heis)
  const H = periodicHeight(W)
  const level = levelOf(c.xp)
  const lo = xpFor(level)
  const hi = xpFor(level + 1)
  const share = clamp((c.xp - lo) / (hi - lo))
  const rank = empireRankOf(level)
  const z = Math.min(118, level)
  const s: string[] = [open(W, H), frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".3"`, 10), head(W, t, font, 'PERIODIC TABLE', 'Mr. White · Chemistry · ABQ')]
  // Hero: your element, drawn like the title card.
  const hx = 16
  const hy = 44
  s.push(`<rect x="${hx + 2}" y="${hy + 4}" width="${TILE_W}" height="${TILE_H}" rx="4" fill="#000" fill-opacity=".35"/><rect x="${hx}" y="${hy}" width="${TILE_W}" height="${TILE_H}" rx="4" fill="${t.el}"/><path d="M${hx + 5} ${hy + 1.5}h${TILE_W - 10}" stroke="#FFFFFF" stroke-opacity=".35"/>`)
  s.push(`<text x="${hx + 10}" y="${hy + 21}" font-family="${font}" font-size="15" font-weight="700" fill="${t.elInk}" font-variant-numeric="tabular-nums">${level}</text>`)
  s.push(`<text x="${hx + TILE_W - 9}" y="${hy + 19}" text-anchor="end" font-family="${font}" font-size="8" font-weight="700" letter-spacing=".8" fill="${t.elInk}" fill-opacity=".72">LEVEL</text>`)
  s.push(`<text x="${hx + TILE_W / 2}" y="${hy + 86}" text-anchor="middle" font-family="${font}" font-size="56" font-weight="700" letter-spacing="-1.5" fill="${t.elInk}">${level > 118 ? '?' : symOf(z)}</text>`)
  s.push(`<text x="${hx + TILE_W / 2}" y="${hy + 106}" text-anchor="middle" font-family="${font}" font-size="11.5" font-weight="700" fill="${t.elInk}">${esc(sansClip(level > 118 ? '?' : nameOf(z), 11.5, TILE_W - 12, 0, true))}</text>`)
  s.push(`<text x="${hx + TILE_W / 2}" y="${hy + 120}" text-anchor="middle" font-family="${font}" font-size="9.5" fill="${t.elInk}" fill-opacity=".75" font-variant-numeric="tabular-nums">${level <= MASS.length ? (MASS[level - 1] as number).toFixed(3) : ''}</text>`)
  // Text column.
  const nr = narrow(W)
  const rX = nr ? 16 : W - 16 - RECEIPT_W
  const cx = hx + TILE_W + 16
  const colW = (nr ? W - 16 : rX - 16) - cx
  s.push(LBL(cx, 58, 'RANK', t.muted, font))
  const rz = fit(rank, colW, 17, 13)
  s.push(`<text x="${cx}" y="78" font-family="${font}" font-size="${rz}" font-weight="700" fill="${t.text}">${esc(sansClip(rank, rz, colW, 0, true))}</text>`)
  s.push(`<text x="${cx}" y="96" font-family="${font}" font-size="11.5" fill="${t.subtext}">${esc(sansClip(`Level ${level} · ${level > 118 ? '?' : nameOf(z)}`, 11.5, colW))}</text>`)
  const nz = Math.min(118, level + 1)
  const gw = 26
  const barW = Math.max(10, colW - gw - 8)
  s.push(LBL(cx, 122, 'NEXT ELEMENT', t.muted, font))
  s.push(`<rect x="${cx}" y="131" width="${barW}" height="5" rx="1" fill="${t.track}"/><rect x="${cx}" y="131" width="${r1(barW * share)}" height="5" rx="1" fill="${t.accent}"/>`)
  const gx = cx + colW - gw
  const gy = 120
  s.push(`<rect x="${gx + 0.5}" y="${gy + 0.5}" width="${gw - 1}" height="${gw - 1}" rx="2" fill="none" stroke="${t.el}" stroke-opacity=".7" stroke-dasharray="2.5 2"/><text x="${gx + 3}" y="${gy + 8}" font-family="${font}" font-size="6.5" font-weight="700" fill="${t.muted}">${nz}</text><text x="${gx + gw / 2}" y="${gy + 20}" text-anchor="middle" font-family="${font}" font-size="11" font-weight="700" fill="${t.subtext}">${symOf(nz)}</text>`)
  const rest = ` / ${hi} XP · ${hi - c.xp} to ${nameOf(nz)}`
  s.push(`<text x="${cx}" y="156" font-family="${font}" font-size="11.5" fill="${t.subtext}"><tspan font-weight="700" fill="${t.text}" font-variant-numeric="tabular-nums">${c.xp}</tspan>${esc(sansClip(rest, 11.5, colW - sansW(String(c.xp), 11.5, 0, true)))}</text>`)
  const nextRank = [5, 7, 9, 12, 15, 20, 4, 3, 2].sort((a, b) => a - b).find(l => l > level)
  s.push(`<text x="${cx}" y="172" font-family="${font}" font-size="11.5" fill="${t.muted}">${esc(sansClip(nextRank ? `${empireRankOf(nextRank)} at level ${nextRank}` : 'Top of the ladder.', 11.5, colW))}</text>`)
  // The A1A Car Wash receipt.
  const ry = nr ? 190 : 40
  const rh = nr ? 96 : 138
  const rw = nr ? W - 32 : RECEIPT_W
  const rxx = nr ? 16 : rX
  const teeth = nr ? 24 : 18
  const tw = rw / teeth
  let zig = ''
  for (let i = 0; i < teeth; i++) zig += `L${r1(rxx + rw - (i + 0.5) * tw)} ${ry + rh + 4}L${r1(rxx + rw - (i + 1) * tw)} ${ry + rh}`
  const paperPath = `M${rxx} ${ry}H${rxx + rw}V${ry + rh}${zig}Z`
  const mid = rxx + rw / 2
  const row = (y: number, k: string, v: string, bold = false, x = rxx, w = rw) => `<text x="${x + 10}" y="${y}" font-family="${MONO}" font-size="9.5"${bold ? ' font-weight="700"' : ''} fill="${P.paperInk}">${esc(k)}</text><text x="${x + w - 10}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="${bold ? 11 : 9.5}" font-weight="700" fill="${P.paperInk}">${esc(v)}</text>`
  const dash = (y: number) => `<line x1="${rxx + 8}" y1="${y}" x2="${rxx + rw - 8}" y2="${y}" stroke="${P.paperRule}" stroke-dasharray="3 2.5"/>`
  s.push(`<g transform="rotate(1.4 ${r1(mid)} ${ry + rh / 2})"><path d="${paperPath}" fill="#000" fill-opacity=".4" transform="translate(2 3)"/><path d="${paperPath}" fill="${P.paper}"/>`)
  s.push(`<text x="${r1(mid)}" y="${ry + 18}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="700" letter-spacing="1.2" fill="${P.paperInk}">A1A CAR WASH</text><text x="${r1(mid)}" y="${ry + 30}" text-anchor="middle" font-family="${MONO}" font-size="8" fill="${P.paperSub}">ALBUQUERQUE, NM</text>${dash(ry + 38)}`)
  if (nr) {
    const half = rw / 2
    s.push(row(ry + 53, 'BATCHES', String(c.jobs), false, rxx, half - 4) + row(ry + 53, 'LONG', String(c.longJobs), false, rxx + half, half - 4))
    s.push(row(ry + 68, 'CREW', String(c.agents), false, rxx, half - 4) + row(ry + 68, 'XP', String(c.xp), true, rxx + half, half - 4))
    s.push(`<text x="${r1(mid)}" y="${ry + 86}" text-anchor="middle" font-family="${MONO}" font-size="8" fill="${P.paperSub}">HAVE AN A1A DAY!</text></g>`)
  } else {
    s.push(row(ry + 53, 'BATCHES', String(c.jobs)) + row(ry + 68, 'LONG BATCHES', String(c.longJobs)) + row(ry + 83, 'CREW CALLED', String(c.agents)) + dash(ry + 92) + row(ry + 108, 'XP', String(c.xp), true))
    s.push(`<text x="${r1(mid)}" y="${ry + 128}" text-anchor="middle" font-family="${MONO}" font-size="8" fill="${P.paperSub}">HAVE AN A1A DAY!</text></g>`)
  }
  // The table: the nine badge elements light up where they really live.
  const g = tableGeom(W)
  const cellAt = (per: number, grp: number): [number, number] => [g.x0 + (grp - 1) * g.p, g.y0 + (per - 1) * g.p]
  const bz = new Map(BADGES.map(b => [Number((ELEMENTS[b.id] ?? [])[1]), b]))
  const cells: string[] = []
  const seen = new Set<string>()
  const tiny = W < 300
  for (let zz = 1; zz <= 118; zz++) {
    const [per, grp] = posOf(zz)
    const key = `${per}:${grp}`
    if (seen.has(key)) continue
    seen.add(key)
    const [x, y] = cellAt(per, grp)
    const isRange = per >= 6 && grp === 3
    const b = bz.get(zz)
    const sym = isRange ? '' : symOf(zz)
    const symSize = g.p < 20 ? 7.5 : 8
    if (b) {
      const e = ELEMENTS[b.id] as string[]
      if (c.badges.includes(b.id)) {
        cells.push(`<g><title>${esc(`${e[2]}: ${e[3]}`)}</title><rect x="${x}" y="${y}" width="${g.cell}" height="${g.cell}" rx="2" fill="${t.el}"/><text x="${x + 2.5}" y="${y + 7}" font-family="${font}" font-size="6" font-weight="700" fill="${t.elInk}" fill-opacity=".8">${zz}</text><text x="${x + g.cell / 2}" y="${y + g.cell - 5}" text-anchor="middle" font-family="${font}" font-size="${g.p < 20 ? 9 : 10.5}" font-weight="700" fill="${t.elInk}">${sym}</text></g>`)
      } else {
        const pr = b.progress(c)
        cells.push(`<g><title>${esc(`${e[2]}: ${e[3]} (${Math.round(pr * 100)}%)`)}</title><rect x="${x + 0.5}" y="${y + 0.5}" width="${g.cell - 1}" height="${g.cell - 1}" rx="2" fill="${t.tile}" stroke="${t.el}" stroke-opacity=".75" stroke-dasharray="2.5 2"/><text x="${x + g.cell / 2}" y="${y + g.cell - 8}" text-anchor="middle" font-family="${font}" font-size="${g.p < 20 ? 8.5 : 9.5}" font-weight="700" fill="${t.subtext}">${sym}</text><rect x="${x + 4}" y="${y + g.cell - 5}" width="${g.cell - 8}" height="2" fill="${t.track}"/><rect x="${x + 4}" y="${y + g.cell - 5}" width="${r1((g.cell - 8) * pr)}" height="2" fill="${t.accent}"/></g>`)
      }
      continue
    }
    const isYou = zz === z && !isRange
    const isPast = zz < z && !isRange
    cells.push(`<rect x="${x}" y="${y}" width="${g.cell}" height="${g.cell}" rx="2" fill="${isPast || isYou ? t.lit : t.cell}"${isYou ? ` stroke="${t.accent}" stroke-width="1.4"` : ''}/>`
      + (tiny && !isYou ? '' : sym ? `<text x="${x + g.cell / 2}" y="${y + g.cell / 2 + 3}" text-anchor="middle" font-family="${font}" font-size="${isYou ? 9.5 : symSize}" font-weight="700" fill="${isYou ? t.accent : t.muted}" fill-opacity="${isYou ? 1 : isPast ? 0.75 : 0.4}">${sym}</text>` : `<text x="${x + g.cell / 2}" y="${y + g.cell / 2 + 2.5}" text-anchor="middle" font-family="${font}" font-size="7" fill="${t.muted}" fill-opacity=".4">*</text>`))
  }
  s.push(`<g>${cells.join('')}</g>`)
  // The table's own gaps hold the legend, as a printed table does.
  const found = BADGES.filter(b => c.badges.includes(b.id)).length
  const [g1x, g1y] = cellAt(1, 2)
  const gapR = cellAt(1, 18)[0] - 10
  const fw = sansW('ELEMENTS FOUND', 9.5, 0.8, true)
  s.push(LBL(g1x + 8, g1y + 15, 'ELEMENTS FOUND', t.muted, font) + `<text x="${r1(g1x + 8 + fw + 7)}" y="${g1y + 15}" font-family="${font}" font-size="11.5" font-weight="700" fill="${t.text}" font-variant-numeric="tabular-nums">${found} of ${BADGES.length}</text>`)
  const keyItems: [string, string][] = [['found', `<rect width="9" height="9" rx="1.5" fill="${t.el}"/>`], ['to find', `<rect x=".5" y=".5" width="8" height="8" rx="1.5" fill="none" stroke="${t.el}" stroke-dasharray="2 1.5"/>`], ['you', `<rect x=".5" y=".5" width="8" height="8" rx="1.5" fill="${t.lit}" stroke="${t.accent}" stroke-width="1.2"/>`]]
  let kx = gapR
  const keyMin = g1x + 8 + fw + 7 + sansW(`${found} of ${BADGES.length}`, 11.5, 0, true) + 12
  for (const [w, sw] of [...keyItems].reverse()) {
    const need = sansW(w, 11) + 14 + 18
    if (kx - need < keyMin) break
    s.push(`<text x="${r1(kx)}" y="${g1y + 15}" text-anchor="end" font-family="${font}" font-size="11" fill="${t.muted}">${w}</text>`)
    kx -= sansW(w, 11) + 14
    s.push(`<g transform="translate(${r1(kx)} ${g1y + 7})">${sw}</g>`)
    kx -= 18
  }
  // The transition-metal void (periods 2-3, groups 3-12): the next element to find.
  const [vx, vy] = cellAt(2, 3)
  const vw = 10 * g.p - 2
  const next = BADGES.find(b => !c.badges.includes(b.id))
  if (next) {
    const e = ELEMENTS[next.id] as string[]
    const pr = next.progress(c)
    s.push(LBL(vx + 6, vy + 14, 'NEXT', t.muted, font) + `<text x="${r1(vx + 6 + sansW('NEXT', 9.5, 0.8, true) + 7)}" y="${vy + 14}" font-family="${font}" font-size="11.5" font-weight="700" fill="${t.text}">${esc(sansClip(`${e[0]} · ${e[2]}`, 11.5, vw - 60, 0, true))}</text>`)
    s.push(`<text x="${vx + 6}" y="${vy + 30}" font-family="${font}" font-size="11.5" fill="${t.subtext}">${esc(sansClip(e[3] as string, 11.5, vw - 50))}</text><text x="${vx + vw - 4}" y="${vy + 30}" text-anchor="end" font-family="${font}" font-size="11.5" font-weight="700" fill="${t.text}" font-variant-numeric="tabular-nums">${Math.round(pr * 100)}%</text>`)
    s.push(`<rect x="${vx + 6}" y="${vy + 37}" width="${vw - 10}" height="3" fill="${t.track}"/><rect x="${vx + 6}" y="${vy + 37}" width="${r1((vw - 10) * pr)}" height="3" fill="${t.accent}"/>`)
  } else s.push(`<text x="${vx + 6}" y="${vy + 22}" font-family="${font}" font-size="11.5" font-style="italic" fill="${t.subtext}">${esc(sansClip('Every element found. Yeah, science!', 11.5, vw - 10))}</text>`)
  // Key: the nine names, three columns.
  const ky = g.y0 + 7 * g.p + 16
  const colw = (W - 32) / 3
  BADGES.forEach((b, i) => {
    const e = ELEMENTS[b.id] as string[]
    const x = 16 + (i % 3) * colw
    const y = ky + Math.floor(i / 3) * 17
    const got = c.badges.includes(b.id)
    s.push(got
      ? `<rect x="${r1(x)}" y="${y - 10}" width="13" height="13" rx="1.5" fill="${t.el}"/><text x="${r1(x + 6.5)}" y="${y}" text-anchor="middle" font-family="${font}" font-size="7.5" font-weight="700" fill="${t.elInk}">${e[0]}</text>`
      : `<rect x="${r1(x + 0.5)}" y="${y - 9.5}" width="12" height="12" rx="1.5" fill="none" stroke="${t.el}" stroke-opacity=".75" stroke-dasharray="2 1.5"/><text x="${r1(x + 6.5)}" y="${y - 0.5}" text-anchor="middle" font-family="${font}" font-size="7" font-weight="700" fill="${t.muted}">${e[0]}</text>`)
    s.push(`<text x="${r1(x + 19)}" y="${y}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing=".4" fill="${got ? t.text : t.muted}">${esc(sansClip(e[2] as string, 9.5, colw - 24, 0.4, true))}</text>`)
  })
  s.push('</svg>')
  return s.join('\n')
}
export const periodicAlt = (c: Cred): string => `Periodic table: level ${levelOf(c.xp)}, ${nameOf(Math.min(118, levelOf(c.xp)))}, ${c.xp} XP, ${BADGES.filter(b => c.badges.includes(b.id)).length} of ${BADGES.length} elements found`

// ================================================================= 2. ON AIR
type Kind = 'read' | 'ask' | 'change' | 'other'
const kindOf = (tool: string): Kind => (/^(Read|Grep|Glob|LS)$/.test(tool) ? 'read' : /^(Agent|WebFetch|WebSearch|ToolSearch|Task)$/.test(tool) ? 'ask' : /^(Edit|MultiEdit|Write|NotebookEdit|Bash|PowerShell)$/.test(tool) ? 'change' : 'other')
const kindFill = (k: Kind, t: Tok): string => (k === 'read' ? t.accent : k === 'ask' ? t.text : k === 'change' ? t.warn : t.muted)
const hm = (at: number): string => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
export const ONAIR_H = 212
export const ONAIR_CAP = 12
const verbOf = (tool: string): string => BB_TOOLS[tool] ?? tool
const selOf = (n: number, pick: number): number => (n ? (pick < 0 ? n - 1 : Math.min(pick, n - 1)) : -1)

export const onAirCard = (W: number, beats: Beat[], pick: number, theme: CardTheme, font: string, frame: Frame, heis = false): string => {
  const t = tokens(theme, heis)
  const H = ONAIR_H
  const n = beats.length
  const live = pick < 0
  const sel = selOf(n, pick)
  let start = Math.max(0, n - ONAIR_CAP)
  if (sel >= 0 && sel < start) start = sel
  const shown = beats.slice(start, start + ONAIR_CAP)
  const ids = { scan: uniq('bbscan'), crt: uniq('bbcrt'), scr: uniq('bbscr') }
  const s: string[] = [open(W, H), frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".3"`, 10)]
  const state = !n ? 'off air' : `${n} ${n === 1 ? 'spot' : 'spots'}${n > ONAIR_CAP ? ` · last ${ONAIR_CAP} listed` : ''} · ${live ? 'live' : `replaying no. ${sel + 1}`}`
  s.push(head(W, t, font, 'ON AIR', '', state, live && n ? t.accent : t.subtext))
  if (W >= 480) {
    let lx = W - 16
    for (const k of ['change', 'ask', 'read'] as const) {
      s.push(`<text x="${lx}" y="24" text-anchor="end" font-family="${font}" font-size="11" fill="${t.muted}">${k}</text>`)
      lx -= sansW(k, 11) + 12
      s.push(`<rect x="${r1(lx)}" y="16" width="8" height="8" rx="1" fill="${kindFill(k, t)}"/>`)
      lx -= 12
    }
  }
  // The set: a wood cabinet, a CRT screen, knobs and a speaker grille.
  const x = 14
  const y = 38
  const tw = W < 520 ? 196 : 232
  const th = H - 50
  const sx = x + 11
  const sy = y + 11
  const sw = tw - 11 - 44
  const sh = th - 22
  s.push(`<rect x="${x + 2}" y="${y + 4}" width="${tw}" height="${th}" rx="12" fill="#000" fill-opacity=".35"/><rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="12" fill="${P.tv}" stroke="${P.tvEdge}"/>`)
  s.push(Array.from({ length: 5 }, (_, i) => `<path d="M${x + 6} ${y + 18 + i * 29}q${tw / 2} ${i % 2 ? 3 : -3} ${tw - 12} 0" stroke="${P.woodDark}" stroke-opacity=".45" fill="none"/>`).join(''))
  s.push(`<rect x="${sx - 4}" y="${sy - 4}" width="${sw + 8}" height="${sh + 8}" rx="20" fill="${P.bezel}"/>`)
  s.push(`<defs><pattern id="${ids.scan}" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#000" fill-opacity=".28"/></pattern><radialGradient id="${ids.crt}" cx=".5" cy=".5" r=".7"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient><clipPath id="${ids.scr}"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="16"/></clipPath></defs>`)
  s.push(`<g clip-path="url(#${ids.scr})"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${P.screen}"/>`)
  const b = sel >= 0 ? (beats[sel] as Beat) : null
  if (b) {
    const k = kindOf(b.tool)
    s.push(LBL(sx + 12, sy + 20, `CH ${sel + 1}`, t.muted, font))
    const tag = k.toUpperCase()
    const tagW = sansW(tag, 8.5, 0.6, true) + 10
    s.push(`<rect x="${r1(sx + sw - 12 - tagW)}" y="${sy + 10}" width="${r1(tagW)}" height="13" rx="2" fill="${kindFill(k, t)}"/><text x="${r1(sx + sw - 12 - tagW / 2)}" y="${sy + 19.5}" text-anchor="middle" font-family="${font}" font-size="8.5" font-weight="700" letter-spacing=".6" fill="${t.tile}">${tag}</text>`)
    const verb = verbOf(b.tool)
    const vz = fit(`${verb}!`, sw - 24, 22, 15)
    s.push(`<text x="${sx + 12}" y="${sy + 54}" font-family="${font}" font-size="${vz}" font-weight="700" fill="${t.text}">${esc(verb)}!</text>`)
    s.push(`<text x="${sx + 12}" y="${sy + 71}" font-family="${font}" font-size="10.5" fill="${t.muted}"><tspan font-weight="700" fill="${t.subtext}">${esc(sansClip(b.who, 10.5, sw - 80, 0, true))}</tspan> · ${esc(sansClip(b.tool, 10.5, 60))}</text>`)
    wrap(b.text, 11, sw - 24, 2).forEach((l, i) => s.push(`<text x="${sx + 12}" y="${sy + 90 + i * 14}" font-family="${font}" font-size="11" fill="${t.subtext}">${esc(l)}</text>`))
    const ly = sy + sh - 28
    s.push(`<rect x="${sx}" y="${ly}" width="${sw}" height="2" fill="${P.saulRed}"/><rect x="${sx}" y="${ly + 2}" width="${sw}" height="20" fill="${P.saulBlue}"/><text x="${sx + 12}" y="${ly + 16}" font-family="${font}" font-size="10" font-weight="700" fill="#FFFFFF" font-variant-numeric="tabular-nums">No. ${sel + 1} of ${n} · ${hm(b.at)}</text>`)
  } else {
    const dots: string[] = []
    let q = 7
    const rnd = () => ((q = (q * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < 420; i++) dots.push(`<rect x="${r1(sx + rnd() * sw)}" y="${Math.floor(sy + rnd() * sh)}" width="${1 + Math.floor(rnd() * 2)}" height="1" fill="#FFFFFF" fill-opacity="${(0.06 + rnd() * 0.22).toFixed(2)}"/>`)
    s.push(`<g shape-rendering="crispEdges">${dots.join('')}</g>`)
    s.push(`<text x="${sx + sw / 2}" y="${sy + sh / 2 - 2}" text-anchor="middle" font-family="${font}" font-size="13" font-weight="700" letter-spacing="1.6" fill="${t.text}">OFF AIR</text><text x="${sx + sw / 2}" y="${sy + sh / 2 + 15}" text-anchor="middle" font-family="${font}" font-size="10.5" fill="${t.subtext}">No calls yet.</text>`)
  }
  s.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#${ids.scan})"/><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#${ids.crt})"/></g>`)
  s.push(`<path d="M${sx + 14} ${sy + 6}q${r1(sw * 0.35)} -3 ${r1(sw * 0.6)} 2" stroke="#FFFFFF" stroke-opacity=".1" stroke-width="3" fill="none" stroke-linecap="round"/>`)
  const kx = x + tw - 22
  const ang = n ? -135 + 270 * (sel / Math.max(1, n - 1)) : -135
  s.push(`<circle cx="${kx}" cy="${y + 30}" r="11" fill="#1C1510" stroke="${P.woodLight}"/><line x1="${kx}" y1="${y + 30}" x2="${kx}" y2="${y + 21}" stroke="${P.paper}" stroke-width="2" stroke-linecap="round" transform="rotate(${ang.toFixed(0)} ${kx} ${y + 30})"/><text x="${kx}" y="${y + 52}" text-anchor="middle" font-family="${font}" font-size="7" font-weight="700" letter-spacing=".6" fill="#C9B59A">CH</text>`)
  s.push(`<circle cx="${kx}" cy="${y + 70}" r="7" fill="#1C1510" stroke="${P.woodLight}"/><line x1="${kx}" y1="${y + 70}" x2="${kx + 4}" y2="${y + 66}" stroke="${P.paper}" stroke-width="1.5" stroke-linecap="round"/>`)
  s.push(Array.from({ length: 6 }, (_, i) => `<rect x="${kx - 10}" y="${y + 92 + i * 9}" width="20" height="3" rx="1.5" fill="#1C1510"/>`).join(''))
  // Tonight's listings: one spot per tool call, in time order down the columns.
  const lx = x + tw + 14
  const lw = W - 14 - lx
  const cols = shown.length > 6 ? 2 : 1
  const cw = cols === 2 ? (lw - 8) / 2 : lw
  const rh = 24
  const rp = 27
  if (!shown.length) s.push(`<rect x="${lx + 0.5}" y="${y + 0.5}" width="${lw - 1}" height="${rp * 2 - 3}" rx="2" fill="none" stroke="${t.muted}" stroke-opacity=".5" stroke-dasharray="3 3"/><text x="${lx + 12}" y="${y + 21}" font-family="${font}" font-size="11.5" font-weight="700" fill="${t.subtext}">Nothing scheduled.</text><text x="${lx + 12}" y="${y + 38}" font-family="${font}" font-size="11.5" font-style="italic" fill="${t.muted}">${esc(sansClip('Every tool call gets a spot here.', 11.5, lw - 20))}</text>`)
  shown.forEach((bt, i) => {
    const col = Math.floor(i / 6)
    const r = i % 6
    const cx = lx + col * (cw + 8)
    const cy = y + r * rp
    const isSel = start + i === sel
    const k = kindOf(bt.tool)
    const verb = verbOf(bt.tool)
    s.push(`<g><title>${esc(`${hm(bt.at)} ${bt.who}: ${verb}, ${bt.text}`)}</title>`)
    s.push(`<rect x="${r1(cx)}" y="${cy}" width="${r1(cw)}" height="${rh}" rx="2" fill="${isSel ? t.sel : t.cell}"${isSel ? ` stroke="${t.accent}" stroke-width="1.2"` : ''}/><rect x="${r1(cx)}" y="${cy}" width="3" height="${rh}" fill="${kindFill(k, t)}"/>`)
    s.push(`<text x="${r1(cx + 9)}" y="${cy + 10.5}" font-family="${font}" font-size="9.5" fill="${t.muted}" font-variant-numeric="tabular-nums">${hm(bt.at)}</text><text x="${r1(cx + 40)}" y="${cy + 10.5}" font-family="${font}" font-size="10" font-weight="700" fill="${t.text}">${esc(sansClip(bt.who, 10, cw - 60, 0, true))}</text>`)
    const vw = sansW(verb, 10) + 5
    s.push(`<text x="${r1(cx + 9)}" y="${cy + 21}" font-family="${font}" font-size="10" font-style="italic" fill="${t.subtext}">${esc(sansClip(verb, 10, cw - 18))}</text><text x="${r1(cx + 9 + vw)}" y="${cy + 21}" font-family="${font}" font-size="10" fill="${t.muted}">${esc(sansClip(bt.text, 10, cw - 18 - vw))}</text>`)
    if (isSel) s.push(`<circle${live ? ' class="onair"' : ''} cx="${r1(cx + cw - 8)}" cy="${cy + 7}" r="2.8" fill="${t.alert}"/>`)
    s.push('</g>')
  })
  s.push('</svg>')
  return s.join('\n')
}
export const onAirAlt = (beats: Beat[], pick: number): string => {
  const n = beats.length
  if (!n) return 'On air: off air, no tool calls yet'
  const i = selOf(n, pick)
  const b = beats[i] as Beat
  return `On air: spot ${i + 1} of ${n}, ${b.who} ${verbOf(b.tool).toLowerCase()} ${b.text} at ${hm(b.at)}${pick < 0 ? ', live' : ''}`
}

// ================================================================= 3. CLASSROOM
const NOTES = ['Respect the chemistry.', 'No half measures on {task}.', 'Tread lightly.', 'Apply yourself.', 'The chemistry checks out.', 'Better call Saul.', 'Get it right the first time.', 'Clean the lab before you leave.', 'Check the margins on {task}.', 'We are done when I say we are done.']
export const noteOf = (task: string): string => (NOTES[hash(task || 'idle') % NOTES.length] as string).replace('{task}', task || 'this')
const ROLL_ROW = 18
export const classroomHeight = (n: number): number => 36 + 6 + 108 + Math.max(1, n) * ROLL_ROW + 48
export const durOf = (ms: number): string => (ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)} h ${Math.round((ms % 3_600_000) / 60_000)} min` : `${Math.round(ms / 60_000)} min`)
const chalkLine = (x1: number, y: number, x2: number, seed: string): string => {
  let d = `M${r1(x1)} ${y}`
  const n = Math.max(2, Math.round((x2 - x1) / 24))
  for (let i = 1; i <= n; i++) d += `Q${r1(x1 + ((i - 0.5) * (x2 - x1)) / n)} ${r1(y + ((hash(`${seed}:${i}`) % 3) - 1) * 1.2)} ${r1(x1 + (i * (x2 - x1)) / n)} ${y}`
  return d
}
export const classroomCard = (W: number, task: string, isWorking: boolean, done: number, total: number, legends: Legend[], theme: CardTheme, font: string, frame: Frame, heis = false): string => {
  const t = tokens(theme, heis)
  const roll = legends.slice(0, 5)
  const H = classroomHeight(roll.length)
  const status = isWorking ? 'In the lab…' : total && done >= total ? 'Batch complete.' : 'Class is in session.'
  const chalkId = uniq('bbchalk')
  const s: string[] = [open(W, H), `<defs><filter id="${chalkId}" x="-2%" y="-10%" width="104%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.8 1.32"/><feComposite in="SourceGraphic" operator="in"/></filter></defs>`]
  s.push(frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".3"`, 10))
  s.push(head(W, t, font, 'CLASSROOM', W >= 440 ? 'Mr. White · Chemistry' : '', status, isWorking ? t.accent : t.subtext))
  const fx = 14
  const fy = 36
  const fw = W - 28
  const fh = H - 36 - 14
  s.push(`<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="3" fill="${P.wood}"/><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="3" fill="none" stroke="${P.woodDark}"/>`)
  const bx = fx + 6
  const by = fy + 6
  const bw = fw - 12
  const bh = fh - 12 - 8
  s.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${P.board}"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="${P.boardEdge}" stroke-width="2"/>`)
  s.push(`<g fill="#FFFFFF" fill-opacity=".035"><ellipse cx="${r1(bx + bw * 0.62)}" cy="${by + 34}" rx="${r1(bw * 0.26)}" ry="9" transform="rotate(-3 ${r1(bx + bw * 0.62)} ${by + 34})"/><ellipse cx="${r1(bx + bw * 0.34)}" cy="${by + bh - 20}" rx="${r1(bw * 0.3)}" ry="7"/></g>`)
  const ty = by + bh
  s.push(`<rect x="${bx - 2}" y="${ty}" width="${bw + 4}" height="8" fill="${P.woodLight}"/><rect x="${bx - 2}" y="${ty + 6}" width="${bw + 4}" height="2" fill="${P.woodDark}"/>`)
  s.push(`<rect x="${bx + 18}" y="${ty - 1.5}" width="16" height="3.5" rx="1.5" fill="${P.chalk}"/><rect x="${bx + 42}" y="${ty - 5}" width="26" height="6" rx="1" fill="#3A3A3E"/><rect x="${bx + 42}" y="${ty - 7}" width="26" height="3" rx="1" fill="#9C7A55"/>`)
  const cx = bx + 14
  const g: string[] = []
  const shownTask = task || 'no lesson yet'
  const lead = 'Today: '
  const lw = sansW(lead, 11.5)
  const room = bw - 28 - lw - 70
  const tz = fit(shownTask, room, 15, 12.5)
  const tclip = sansClip(shownTask, tz, room, 0, true)
  g.push(`<text x="${cx}" y="${by + 24}" font-family="${font}" font-size="11.5" fill="${P.chalkSub}">${lead}</text><text x="${r1(cx + lw)}" y="${by + 24}" font-family="${font}" font-size="${tz}" font-weight="700" fill="${P.chalk}">${esc(tclip)}</text>`)
  g.push(`<path d="${chalkLine(cx + lw, by + 30, Math.min(bx + bw - 80, cx + lw + sansW(tclip, tz, 0, true)), shownTask)}" stroke="${P.chalk}" stroke-opacity=".7" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)
  g.push(`<text x="${cx}" y="${by + 52}" font-family="${font}" font-size="12" font-style="italic" fill="${P.chalk}">“${esc(sansClip(noteOf(task), 12, bw - 110))}”</text>`)
  const nBoxes = Math.min(total, Math.max(0, Math.floor((bw - 28 - 120) / 17)))
  for (let i = 0; i < nBoxes; i++) {
    const x = cx + i * 17
    const y = by + 64
    const st = i < done ? 'done' : i === done && isWorking ? 'running' : 'todo'
    g.push(`<rect x="${x}" y="${y}" width="11" height="11" fill="none" stroke="${P.chalk}" stroke-opacity="${st === 'todo' ? 0.55 : 0.95}" stroke-width="1.3"/>`)
    if (st === 'done') g.push(`<path d="M${x + 2} ${y + 5.5}l2.8 3l5.5 -7.5" stroke="${P.chalk}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    if (st === 'running') g.push(`<circle class="bbp" cx="${x + 5.5}" cy="${y + 5.5}" r="2.2" fill="${BLUE}"/>`)
  }
  g.push(total ? `<text x="${r1(cx + nBoxes * 17 + 6)}" y="${by + 74}" font-family="${font}" font-size="11.5" fill="${P.chalkSub}"><tspan font-weight="700" fill="${P.chalk}" font-variant-numeric="tabular-nums">${done} of ${total}</tspan> steps</text>` : `<text x="${cx}" y="${by + 74}" font-family="${font}" font-size="11.5" font-style="italic" fill="${P.chalkSub}">No steps on the board yet.</text>`)
  const dx = bx + bw - 44
  const dy = by + 40
  if (heis) g.push(`<g stroke="${P.chalk}" stroke-opacity=".75" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M${dx - 13} ${dy + 4}L${dx - 11} ${dy - 12}Q${dx} ${dy - 15} ${dx + 11} ${dy - 12}L${dx + 13} ${dy + 4}"/><path d="M${dx - 12} ${dy - 1}H${dx + 12}"/><path d="M${dx - 26} ${dy + 6}Q${dx} ${dy + 1} ${dx + 26} ${dy + 6}Q${dx} ${dy + 11} ${dx - 26} ${dy + 6}Z"/></g>`)
  else {
    const hex = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${r1(dx + Math.cos(a) * 20)} ${r1(dy + Math.sin(a) * 20)}` })
    g.push(`<path d="M${hex.join('L')}Z" stroke="${P.chalk}" stroke-opacity=".6" stroke-width="1.4" fill="none" stroke-linejoin="round"/><circle cx="${dx}" cy="${dy}" r="11" stroke="${P.chalk}" stroke-opacity=".45" stroke-width="1.3" fill="none"/>`)
  }
  const hy = by + 92
  g.push(`<path d="${chalkLine(cx - 2, hy, bx + bw - 14, 'rule')}" stroke="${P.chalk}" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`)
  g.push(`<text x="${cx}" y="${hy + 19}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing="1.4" fill="${P.chalk}">HONOR ROLL</text><text x="${bx + bw - 14}" y="${hy + 19}" text-anchor="end" font-family="${font}" font-size="11" font-style="italic" fill="${P.chalkSub}">batches of 3+ minutes</text>`)
  if (!roll.length) g.push(`<text x="${cx}" y="${hy + 38}" font-family="${font}" font-size="11.5" font-style="italic" fill="${P.chalkSub}">${esc(sansClip('Nobody yet. A batch that runs 3+ minutes goes up here.', 11.5, bw - 28))}</text>`)
  roll.forEach((l, i) => {
    const y = hy + 38 + i * ROLL_ROW
    const right = `${durOf(l.ms)} · ${l.costUsd < 0.005 ? '$0' : `$${l.costUsd.toFixed(2)}`}`
    const rw = sansW(right, 11.5) + 4
    const name = sansClip(l.task, 11.5, bw - 28 - 16 - rw - 24)
    const nw = sansW(name, 11.5)
    g.push(`<g><path d="M${cx + 4} ${y - 9}l1.3 2.9 3.1.3-2.4 2 .8 3.1-2.8-1.7-2.8 1.7.8-3.1-2.4-2 3.1-.3z" fill="${YELLOW}" fill-opacity=".85"/><text x="${cx + 16}" y="${y}" font-family="${font}" font-size="11.5" fill="${P.chalk}">${esc(name)}</text><line x1="${r1(cx + 22 + nw)}" y1="${y - 2}" x2="${r1(bx + bw - 18 - rw)}" y2="${y - 2}" stroke="${P.chalk}" stroke-opacity=".4" stroke-dasharray="1 3"/><text x="${bx + bw - 14}" y="${y}" text-anchor="end" font-family="${font}" font-size="11.5" fill="${P.chalk}" font-variant-numeric="tabular-nums">${esc(right)}</text></g>`)
  })
  s.push(`<g filter="url(#${chalkId})">${g.join('')}</g></svg>`)
  return s.join('\n')
}
export const classroomAlt = (task: string, isWorking: boolean, done: number, total: number, legends: Legend[]): string =>
  `Classroom: ${task || 'no lesson yet'}, ${isWorking ? 'in the lab' : 'waiting'}, ${done} of ${total} steps. Honor roll: ${legends.slice(0, 5).map(l => l.task).join(', ') || 'nobody yet'}`

// ================================================================= 4. The slim band's pieces
export const BAND_H = 134
/** Br and Ba, as on the title card: the atomic number top-left, the symbol centred. */
export const brba = (x: number, y: number, theme: CardTheme, font: string, heis: boolean, size = 17): string => {
  const t = tokens(theme, heis)
  return [['35', 'Br'], ['56', 'Ba']].map(([n, sy], i) => {
    const tx = x + i * (size + 2)
    return `<rect x="${tx}" y="${y}" width="${size}" height="${size}" rx="1.5" fill="${t.el}"><title>${sy} ${n}</title></rect><text x="${tx + 2}" y="${r1(y + 5.5)}" font-family="${font}" font-size="4.8" font-weight="700" fill="${t.elInk}" fill-opacity=".8">${n}</text><text x="${tx + size / 2}" y="${y + size - 4}" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="700" fill="${t.elInk}">${sy}</text>`
  }).join('')
}
/** The header's start: Br Ba (and, on Heisenberg, the hat as the logo before them). */
export const bbHead = (x: number, y: number, theme: CardTheme, font: string, heis: boolean): { svg: string; w: number } => {
  const t = tokens(theme, heis)
  const hx = heis ? 26 : 0
  const logo = heis ? sprite(x, y - 9.5, 19 / 13, HAT, { k: t.text, h: t.text, g: t.tile }) : ''
  return { svg: logo + brba(x + hx, y - 13.5, theme, font, heis), w: hx + 36 }
}
/** The context chip past 85%: NO HALF MEASURES, then SAY MY NAME, with a pixel hat. */
export const bbChip = (x: number, y: number, ctxPct: number, theme: CardTheme, font: string): { svg: string; w: number } => {
  if (ctxPct < 85) return { svg: '', w: 0 }
  const name = ctxPct >= 95
  const label = name ? 'SAY MY NAME' : 'NO HALF MEASURES'
  const fill = name ? theme.alert : theme.warn
  const ink = name ? '#1A0807' : '#1A1505'
  const w = Math.round(sansW(label, 9.5, 0.8, true) + 32)
  return { w, svg: `<g class="bbchip"><rect x="${x}" y="${y - 12}" width="${w}" height="16" rx="3" fill="${fill}"/>${hatPx(x + 6, y - 7.5, 14, ink)}<text x="${x + 25}" y="${y}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${ink}">${label}</text></g>` }
}
/** Purity as a small gauge from 96 to 100, with a tick at the famous 99.1; right-aligned at `xr`. */
export const purityOf = (done: number, total: number): number => +(96.2 + 2.9 * (total > 0 ? clamp(done / total) : 0)).toFixed(1)
export const purityGauge = (xr: number, y: number, isWorking: boolean, done: number, total: number, theme: CardTheme, font: string): { svg: string; w: number } => {
  const pct = purityOf(done, total)
  const gw = 44
  const gx = xr - gw
  const v = `${pct.toFixed(1)}%`
  const vx = gx - 8
  const lx = vx - sansW(v, 11.5, 0, true) - 7
  const at = gw * clamp((pct - 96) / 4)
  return {
    w: xr - (lx - sansW('PURITY', 9.5, 0.8, true)),
    svg: `${LBL(lx, y, 'PURITY', theme.muted, font, 'end')}<text x="${r1(vx)}" y="${y}" text-anchor="end" font-family="${font}" font-size="11.5" font-weight="700" fill="${isWorking ? BLUE : theme.subtext}" font-variant-numeric="tabular-nums">${v}</text><rect x="${r1(gx)}" y="${y - 6}" width="${gw}" height="4" fill="${theme.track}"/><rect x="${r1(gx)}" y="${y - 6}" width="${r1(at)}" height="4" fill="${BLUE}"/><rect x="${r1(gx + gw * 0.775)}" y="${y - 9}" width="1" height="10" fill="${theme.text}" fill-opacity=".55"><title>99.1%</title></rect>`,
  }
}
/** A crystal-diamond step pip, centred at (cx, cy). */
export const bbPip = (st: string, cx: number, cy: number, theme: CardTheme): string => {
  const dia = (r: number) => `M${cx} ${cy - r}L${r1(cx + r * 0.78)} ${cy}L${cx} ${cy + r}L${r1(cx - r * 0.78)} ${cy}Z`
  return st === 'done' ? `<path d="${dia(5.2)}" fill="${theme.accent}"/>`
    : st === 'running' ? `<path d="${dia(5)}" fill="none" stroke="${theme.accent}" stroke-width="1.3"/><path class="bbp" d="${dia(2.4)}" fill="${theme.accent}"/>`
    : st === 'failed' ? `<path d="M${cx - 3.2} ${cy - 3.2}l6.4 6.4M${cx + 3.2} ${cy - 3.2}l-6.4 6.4" stroke="${theme.alert}" stroke-width="1.8" stroke-linecap="round"/>`
    : `<path d="${dia(5)}" fill="none" stroke="${theme.muted}" stroke-width="1.2"/>`
}
/** The desert along the band's foot: low mesas, the RV parked, and on the last mesa the hidden hat (95% context or past budget). */
export const bbFoot = (W: number, H: number, theme: CardTheme, heis: boolean, ctx: { ctxPct: number; overBudget: boolean }): string => {
  const t = tokens(theme, heis)
  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const base = H - 1.5
  const d: string[] = []
  let x = 6
  while (x < W - 70) {
    const w = 26 + Math.floor(rnd() * 56)
    const h = 3 + Math.floor(rnd() * 5)
    d.push(`M${x} ${base}L${x + 3} ${base - h}H${x + w - 3}L${x + w} ${base}Z`)
    x += w + 10 + Math.floor(rnd() * 46)
  }
  d.push(`M${W - 64} ${base}L${W - 60} ${base - 7}H${W - 10}L${W - 6} ${base}Z`)
  const rvx = Math.round(W * 0.46)
  const cid = uniq('bbclip')
  const hidden = !heis && (ctx.ctxPct >= 95 || ctx.overBudget)
  const rvOn = W >= 700
  return `<defs><clipPath id="${cid}"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="9.5"/></clipPath></defs><g clip-path="url(#${cid})"><path d="${d.join('')}" fill="${t.sky}"/><rect x="0" y="${base}" width="${W}" height="1.5" fill="${t.sky}"/>${rvOn ? `${rvPx(rvx, base - 6.5, 1.1, 0.75)}<rect class="bbwin" x="${r1(rvx + 5.5)}" y="${r1(base - 5.4)}" width="2.2" height="2.2" fill="${YELLOW}" opacity=".8"/>` : ''}</g>${hidden ? hatPx(W - 38, r1(H - 8.5 - (18 * 6) / 13), 18, theme.subtext, 'bbhat', 0.5) : ''}`
}
