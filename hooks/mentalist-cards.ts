// The Mentalist's props: the Personnel File (a CBI badge, a manila folder and the badges as
// evidence tags), the Case Board (a corkboard of pinned index cards joined by red string)
// and the pieces of the slim band (the context chip, the pixel Jane, the teacup).
// Pure SVG strings, no state and no I/O. The props keep their own colours (paper, manila,
// cork): they are objects, not UI. Type is the skin's serif at weights 400 and 700 only.

import { levelOf, xpFor } from './extras'
import type { Beat, Cred, Frame } from './extras'
import { CBI_BADGES, RED, cbiRankOf } from './mentalist'

export type CardTheme = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }

const P = {
  paper: '#E6EBF2', paperInk: '#0F1A2E', paperSub: '#3A4F72', paperRule: '#C3CEDD',
  manila: '#3A3226', manilaBack: '#2C261D', manilaEdge: '#6E5F45', manilaInk: '#D2C29E',
  tag: '#E3D6B8', tagInk: '#2A2216', tagSub: '#5E5038',
  cork: '#2A2219', corkSpeck: '#3A2F22', corkSpeck2: '#1F1912', frame: '#4A3B29',
  stamp: '#F28A82',
}
const SYM = "'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2',sans-serif"
const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = (v: number): number => +v.toFixed(1)
const hash = (s: string): number => [...s].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7)

/** Serif widths, measured in Chrome for Iowan: bold capitals ~.74em, lower case ~.52em, digits .6em. */
export const serifW = (s: string, size: number, ls = 0, caps = false): number =>
  [...s].reduce((w, ch) => w + (ch === ' ' ? 0.28 : /[A-Z]/.test(ch) ? (caps ? 0.74 : 0.72) : /[0-9]/.test(ch) ? 0.6 : /[.,:;'!il|]/.test(ch) ? 0.3 : 0.52) * size + ls, 0)
export const serifClip = (s: string, size: number, max: number, ls = 0): string => {
  if (serifW(s, size, ls) <= max) return s
  const a = [...s]
  while (a.length && serifW(`${a.join('')}…`, size, ls) > max) a.pop()
  return a.length ? `${a.join('').trimEnd()}…` : ''
}

// --- Pixel bits ---
export const sprite = (x: number, y: number, px: number, rows: string[], pal: Record<string, string>): string => {
  const out: string[] = []
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && pal[ch]) out.push(`<rect x="${n1(x + i * px)}" y="${n1(y + j * px)}" width="${px}" height="${px}" fill="${pal[ch]}"/>`) }))
  return `<g shape-rendering="crispEdges">${out.join('')}</g>`
}
// Jane, faceless: hair, skin, a three-piece suit, a pale-blue shirt (12 x 13).
export const JANE = ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hssssssh..', '..ssssssss..', '..ssssssss..', '...ssssss...', '....ssss....', '..nnnwwnnn..', '.nnnnbwbnnn.', 'nnnnnbwbnnnn', 'nnnnnbbbnnnn', 'nnnnnnnnnnnn']
export const JANE_PAL = { h: '#C9A35A', s: '#D9B99B', n: '#1B2A4A', w: '#F2F5FA', b: '#8DB4EA' }
const CUP = ['.s.s...', '..s....', 'ccccc..', 'ccccccc', 'ccccc.c', '.ccc...']
const SMILE = [[3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [2, 1], [8, 1], [1, 2], [9, 2], [0, 3], [10, 3], [0, 4], [10, 4], [0, 5], [10, 5], [0, 6], [10, 6], [0, 7], [10, 7], [1, 8], [9, 8], [2, 9], [8, 9], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [3, 3], [3, 4], [7, 3], [7, 4], [2, 6], [8, 6], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7]].map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('')
export const flatSmiley = (x: number, y: number, size: number, color: string, op = 1, cls = ''): string =>
  `<g${cls ? ` class="${cls}"` : ''} transform="translate(${n1(x)} ${n1(y)}) scale(${+(size / 11).toFixed(3)})" opacity="${op}" shape-rendering="crispEdges"><path d="${SMILE}" fill="${color}"/></g>`

const starPath = (cx: number, cy: number, R: number, r: number): string =>
  `${Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r : R
    return `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`
  }).join('')}Z`

// --- The context chip of the slim band: NEEDS TEA (85%) and RED JOHN IS WATCHING (95%) ---
export const ctxChip = (x: number, y: number, ctxPct: number, _t: CardTheme, font: string): { svg: string; w: number } => {
  if (ctxPct < 85) return { svg: '', w: 0 }
  const watching = ctxPct >= 95
  const label = watching ? 'RED JOHN IS WATCHING' : 'NEEDS TEA'
  const fill = watching ? RED : '#E8C26A'
  const ink = watching ? '#FFFFFF' : '#1A1408'
  const w = Math.round(serifW(label, 9.5, 0.8, true) + 34)
  const icon = watching ? flatSmiley(x + 7, y - 9.5, 11, '#FFFFFF') : sprite(x + 7, y - 9, 1.6, CUP, { s: ink, c: ink })
  return { w, svg: `<g class="tea"><rect x="${x}" y="${y - 12}" width="${w}" height="16" rx="3" fill="${fill}"/>${icon}<text x="${x + 24}" y="${y}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${ink}">${label}</text></g>` }
}

// --- 1. PERSONNEL FILE ---
const TAG_W = 83, TAG_H = 50, TAG_GAP = 8
const tagsPer = (W: number): number => Math.max(1, Math.floor((W - 32 + TAG_GAP) / (TAG_W + TAG_GAP)))
const stacked = (W: number): boolean => W < 400
export const fileHeight = (W: number): number => 262 + (stacked(W) ? 200 : 0) + Math.ceil(CBI_BADGES.length / tagsPer(W)) * (TAG_H + 22) + 34

export const FILE_CSS = `.fresh{animation:fresh 1.6s ease-in-out 3}@keyframes fresh{50%{opacity:.4}}
.stampin{animation:stampin .35s cubic-bezier(.3,1.6,.5,1) both}@keyframes stampin{from{transform:scale(1.6);opacity:0}}
@media (prefers-reduced-motion: reduce){.fresh,.stampin{animation:none}}`

// Tally marks: groups of five (four bars and a slash), 26px a group, up to five groups; the rest as "+N".
const tallyGroups = (n: number, room: number): number => {
  let g = Math.min(5, Math.ceil(n / 5))
  while (g > 1 && g * 26 - 6 + (n > g * 5 ? 30 : 0) > room) g--
  return g * 26 - 6 + (n > g * 5 ? 30 : 0) > room ? 0 : g
}
const tally = (x: number, y: number, n: number, groups: number, ink: string, faint: string, font: string): string => {
  if (!n || !groups) return ''
  const shown = Math.min(n, groups * 5)
  const out: string[] = []
  for (let i = 0; i < shown; i++) {
    const g = Math.floor(i / 5), j = i % 5
    const gx = x + g * 26
    out.push(j < 4 ? `<rect x="${gx + j * 5}" y="${y + 1}" width="2" height="12" fill="${ink}"/>` : `<line x1="${gx - 3}" y1="${y + 11}" x2="${gx + 20}" y2="${y + 3}" stroke="${ink}" stroke-width="1.8"/>`)
  }
  const more = n > shown ? `<text x="${x + groups * 26 + 2}" y="${y + 11}" font-family="${font}" font-size="10.5" fill="${faint}">+${n - shown}</text>` : ''
  return `<g shape-rendering="crispEdges">${out.join('')}</g>${more}`
}

export const personnelFile = (W: number, c: Cred, t: CardTheme, font: string, frame: Frame, opts: { fresh?: boolean; stamp?: boolean; heat?: string } = {}): string => {
  const H = fileHeight(W)
  const level = levelOf(c.xp)
  const lo = xpFor(level), hi = xpFor(level + 1)
  const share = Math.max(0, Math.min(1, (c.xp - lo) / (hi - lo)))
  const rank = cbiRankOf(level)
  const stack = stacked(W)
  const s: string[] = []
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${FILE_CSS}</style>`)
  s.push(frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".35"`, 10))
  s.push(`<rect x="16" y="13" width="3" height="13" fill="${t.accent}"/><text x="25" y="24" font-family="${font}" font-size="13" font-weight="700" letter-spacing="1" fill="${t.text}">PERSONNEL FILE</text>`)
  if (W >= 330) s.push(`<text x="${W - 16}" y="24" text-anchor="end" font-family="${font}" font-size="11" font-style="italic" fill="${t.muted}">CBI · Serious Crimes Unit</text>`)

  // The badge: 136 x 186, on a lanyard clip.
  const bx = 16, by = 52, bw = 136, bh = 186
  s.push(`<path d="M${bx + bw / 2 - 7} 34h14v12h-14z" fill="#1B2A4A"/><path d="M${bx + bw / 2 - 7} 34h14" stroke="${t.accent}" stroke-opacity=".5"/>`)
  s.push(`<rect x="${bx + bw / 2 - 9}" y="43" width="18" height="14" rx="3" fill="#B4C0D3"/><rect x="${bx + bw / 2 - 4}" y="47" width="8" height="5" rx="1.5" fill="${t.tile}"/>`)
  s.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="7" fill="${P.paper}"/>`)
  s.push(`<rect x="${bx + 2.5}" y="${by + 2.5}" width="${bw - 5}" height="${bh - 5}" rx="5" fill="none" stroke="#FFFFFF" stroke-opacity=".7"/>`)
  s.push(`<rect x="${bx + bw / 2 - 11}" y="${by + 6}" width="22" height="4" rx="2" fill="${t.tile}"/>`)
  s.push(`<path d="M${bx} ${by + 14}h${bw}v24h-${bw}z" fill="#1B2A4A"/>`)
  s.push(`<circle cx="${bx + 15}" cy="${by + 26}" r="7.5" fill="none" stroke="${t.warn}" stroke-width="1.2"/><path d="${starPath(bx + 15, by + 26.5, 5, 2.1)}" fill="${t.warn}"/>`)
  s.push(`<text x="${bx + 28}" y="${by + 30}" font-family="${font}" font-size="11" font-weight="700" letter-spacing="1.4" fill="#FFFFFF">CBI</text>`)
  s.push(`<text x="${bx + bw - 8}" y="${by + 30}" text-anchor="end" font-family="${font}" font-size="8" font-weight="700" letter-spacing=".8" fill="${t.warn}">CONSULTANT</text>`)
  const phx = bx + 10, phy = by + 46
  s.push(`<rect x="${phx}" y="${phy}" width="54" height="66" fill="#A9B8CE"/>`)
  s.push(sprite(phx + 3, phy + 1, 4, JANE, JANE_PAL))
  s.push(`<rect x="${phx}" y="${phy}" width="54" height="66" fill="none" stroke="#1B2A4A" stroke-opacity=".35"/>`)
  const cx = phx + 62
  s.push(`<text x="${cx}" y="${phy + 9}" font-family="${font}" font-size="8" font-weight="700" letter-spacing=".3" fill="${P.paperSub}">CLEARANCE</text>`)
  s.push(`<text x="${cx - 1}" y="${phy + 45}" font-family="${font}" font-size="${level >= 10 ? 34 : 40}" font-weight="700" fill="${P.paperInk}" font-variant-numeric="tabular-nums">${level}</text>`)
  s.push(`<text x="${bx + 10}" y="${by + 130}" font-family="${font}" font-size="12.5" font-weight="700" letter-spacing=".9" fill="${P.paperInk}">PATRICK JANE</text>`)
  s.push(`<text${opts.fresh ? ' class="fresh"' : ''} x="${bx + 10}" y="${by + 146}" font-family="${font}" font-size="12" font-style="italic" fill="${P.paperSub}">${esc(serifClip(rank, 12, bw - 20))}</text>`)
  // The barcode is the XP printing itself.
  const bars = 30, bcx = bx + 10, bcy = by + 156, bcw = bw - 20
  const lit = Math.round(share * bars)
  const widths = Array.from({ length: bars }, (_, i) => 1 + ((hash(`jane${i}`) >> 3) % 3))
  const k = bcw / (widths.reduce((a, b) => a + b, 0) + bars)
  let x = bcx
  const bc = widths.map((w, i) => {
    const r = `<rect x="${x.toFixed(1)}" y="${bcy}" width="${(w * k).toFixed(1)}" height="14" fill="${i < lit ? P.paperInk : P.paperRule}"/>`
    x += (w + 1) * k
    return r
  }).join('')
  s.push(`<g shape-rendering="crispEdges">${bc}</g>`)
  s.push(`<text x="${bcx}" y="${bcy + 24}" font-family="${font}" font-size="8" letter-spacing=".4" fill="${P.paperSub}" font-variant-numeric="tabular-nums">${c.xp} / ${hi} XP</text>`)
  s.push(`<path d="M${bx + 70} ${by}h22l-58 ${bh}h-22z" fill="#FFFFFF" fill-opacity=".10"/>`)

  // The folder: beside the badge, or under it when the card is narrow.
  const fx = stack ? 16 : bx + bw + 16, fy = stack ? 248 : 44, fw = W - fx - 16, fh = 194
  s.push(`<path d="M${fx} ${fy + 14}h${fw}v${fh - 14}h-${fw}z" fill="${P.manilaBack}"/>`)
  const tabLabel = 'JANE, P.  ·  No. 0001'
  const tabW = Math.min(fw - 20, serifW(tabLabel, 9.5, 0.6, true) + 24)
  s.push(`<rect x="${fx + tabW + 18}" y="${fy + 8}" width="${Math.max(0, fw - tabW - 30)}" height="20" fill="#CFC6B2" opacity=".8"/>`)
  s.push(`<path d="M${fx + 8} ${fy + 18}l6 -18h${tabW - 12}l6 18z" fill="${P.manila}" stroke="${P.manilaEdge}"/>`)
  s.push(`<text x="${fx + 20}" y="${fy + 12}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing=".6" fill="${P.manilaInk}">${esc(tabLabel)}</text>`)
  s.push(`<rect x="${fx}" y="${fy + 18}" width="${fw}" height="${fh - 18}" rx="3" fill="${P.manila}" stroke="${P.manilaEdge}"/>`)
  const rows: [string, number][] = [['CASES CLOSED', c.jobs], ['LONG CASES', c.longJobs], ['AGENTS BRIEFED', c.agents]]
  const lx = fx + 14, rx = fx + fw - 14
  rows.forEach(([key, v], i) => {
    const y = fy + 48 + i * 30
    const kw = serifW(key, 9.5, 0.8, true)
    const val = v ? String(v) : '—'
    const vw = serifW(val, 16)
    s.push(`<text x="${lx}" y="${y}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${P.manilaInk}">${key}</text>`)
    const room = rx - vw - 12 - (lx + kw + 10) - 12
    const groups = i === 0 && v ? tallyGroups(v, room) : 0
    const tw = groups ? groups * 26 - 6 + (v > groups * 5 ? 30 : 0) + 10 : 0
    if (tw) s.push(tally(lx + kw + 10, y - 11, v, groups, t.text, P.manilaInk, font))
    s.push(`<line x1="${n1(lx + kw + 6 + tw)}" y1="${y}" x2="${n1(rx - vw - 6)}" y2="${y}" stroke="${P.manilaInk}" stroke-opacity=".45" stroke-dasharray="1 3"/>`)
    s.push(`<text x="${rx}" y="${y + 1}" text-anchor="end" font-family="${font}" font-size="16" font-weight="700" fill="${v ? t.text : t.muted}" font-variant-numeric="tabular-nums">${val}</text>`)
  })
  s.push(`<line x1="${lx}" y1="${fy + 132}" x2="${rx}" y2="${fy + 132}" stroke="${P.manilaEdge}"/>`)
  s.push(`<text x="${lx}" y="${fy + 150}" font-family="${font}" font-size="11.5" fill="${t.subtext}" font-variant-numeric="tabular-nums"><tspan font-weight="700" fill="${t.text}">${c.xp} XP</tspan> · ${hi - c.xp} to clearance ${level + 1}</text>`)
  s.push(`<text x="${lx}" y="${fy + 168}" font-family="${font}" font-size="11.5" fill="${t.subtext}" font-variant-numeric="tabular-nums"><tspan font-weight="700" fill="${t.text}">${c.badges.length} of ${CBI_BADGES.length}</tspan> evidence tagged</text>`)
  if (c.jobs > 0) {
    const sx = fx + fw - 62, sy = fy + 160
    s.push(`<g transform="rotate(-9 ${sx} ${sy})"><g${opts.stamp ? ' class="stampin"' : ''} style="transform-origin:${sx}px ${sy}px"><rect x="${sx - 42}" y="${sy - 13}" width="84" height="24" rx="2" fill="none" stroke="${P.stamp}" stroke-width="2"/><rect x="${sx - 39}" y="${sy - 10}" width="78" height="18" rx="1" fill="none" stroke="${P.stamp}" stroke-width=".8"/><text x="${sx}" y="${sy + 4.5}" text-anchor="middle" font-family="${font}" font-size="13" font-weight="700" letter-spacing="2.4" fill="${P.stamp}">SOLVED</text></g></g>`)
  }
  if (opts.heat) s.push(opts.heat)

  // Evidence: the badges as tags on a string.
  const ey = 262 + (stack ? 200 : 0)
  s.push(`<text x="16" y="${ey - 2}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${t.muted}">EVIDENCE</text>`)
  const per = tagsPer(W)
  const cell = (W - 32 + TAG_GAP) / per
  const next = CBI_BADGES.filter(b => !c.badges.includes(b.id)).sort((a, b) => b.progress(c) - a.progress(c))[0]
  for (let r = 0; r < Math.ceil(CBI_BADGES.length / per); r++) {
    const ly = ey + 10 + r * (TAG_H + 22)
    s.push(`<path d="M12 ${ly}Q${W / 2} ${ly + 5} ${W - 12} ${ly}" fill="none" stroke="${t.subtext}" stroke-opacity=".55"/>`)
    s.push(`<circle cx="12" cy="${ly}" r="2.5" fill="${t.muted}"/><circle cx="${W - 12}" cy="${ly}" r="2.5" fill="${t.muted}"/>`)
    CBI_BADGES.slice(r * per, r * per + per).forEach((b, i) => {
      const on = c.badges.includes(b.id)
      const tx = 16 + i * cell + (cell - TAG_W - TAG_GAP) / 2
      const ty = ly + 12
      const hx = tx + TAG_W / 2
      const sag = ly + 5 * (1 - ((hx - W / 2) / (W / 2 - 12)) ** 2)
      const tilt = on ? ((hash(b.id) % 5) - 2) * 1.2 : 0
      const shape = `M${n1(tx + 10)} ${ty}h${TAG_W - 20}l10 10v${TAG_H - 10}h-${TAG_W}v-${TAG_H - 10}z`
      const no = String(r * per + i + 1).padStart(2, '0')
      const g = [`<g transform="rotate(${n1(tilt)} ${n1(hx)} ${n1(sag)})">`, `<line x1="${n1(hx)}" y1="${n1(sag)}" x2="${n1(hx)}" y2="${ty + 7}" stroke="${t.subtext}" stroke-opacity=".7"/>`]
      if (on) {
        g.push(`<path d="${shape}" fill="${P.tag}"/><circle cx="${n1(hx)}" cy="${ty + 7}" r="2.6" fill="${t.tile}" stroke="${P.tagSub}" stroke-width=".8"/>`)
        g.push(`<text x="${n1(tx + 8)}" y="${ty + 30}" font-family="${SYM}" font-size="15" fill="${P.tagInk}">${esc(b.icon)}</text>`)
        g.push(`<text x="${n1(tx + TAG_W - 7)}" y="${ty + 26}" text-anchor="end" font-family="${font}" font-size="8" fill="${P.tagSub}" font-variant-numeric="tabular-nums">No. ${no}</text>`)
        g.push(`<text x="${n1(tx + 7)}" y="${ty + 43}" font-family="${font}" font-size="8" font-weight="700" letter-spacing=".3" fill="${P.tagInk}">${esc(serifClip(b.name, 8, TAG_W - 12, 0.3))}<title>${esc(b.name)}: ${esc(b.how)}</title></text>`)
      } else {
        const p = b.progress(c)
        g.push(`<path d="${shape}" fill="${t.tile}" stroke="${t.muted}" stroke-opacity=".6" stroke-dasharray="3 3"/><circle cx="${n1(hx)}" cy="${ty + 7}" r="2.6" fill="none" stroke="${t.muted}" stroke-opacity=".6"/>`)
        g.push(`<text x="${n1(tx + 8)}" y="${ty + 30}" font-family="${font}" font-size="9.5" font-weight="700" letter-spacing="1.2" fill="${t.muted}">SEALED<title>${esc(b.name)}: ${esc(b.how)} (${Math.round(p * 100)}%)</title></text>`)
        g.push(`<rect x="${n1(tx + 8)}" y="${ty + 38}" width="${TAG_W - 16}" height="3" fill="${t.track}"/>${p > 0 ? `<rect x="${n1(tx + 8)}" y="${ty + 38}" width="${n1((TAG_W - 16) * p)}" height="3" fill="${t.accent}"/>` : ''}`)
      }
      g.push('</g>')
      s.push(g.join(''))
    })
  }
  const nextLine = next ? `Next: ${next.name} · ${next.how} · ${Math.round(next.progress(c) * 100)}%` : "Every piece of evidence tagged. Tea's on."
  s.push(`<text x="16" y="${H - 14}" font-family="${font}" font-size="11.5" font-style="italic" fill="${t.subtext}">${esc(serifClip(nextLine, 11.5, W - 32))}</text>`)
  s.push('</svg>')
  return s.join('\n')
}

// --- 2. CASE BOARD ---
const kindOf = (tool: string): 'read' | 'change' | 'ask' | 'other' =>
  /^(Read|Grep|Glob|LS)$/.test(tool) ? 'read' : /^(Edit|MultiEdit|Write|NotebookEdit|Bash|PowerShell)$/.test(tool) ? 'change' : /^(Agent|WebFetch|WebSearch|ToolSearch)$/.test(tool) ? 'ask' : 'other'
const VERB: Record<string, string> = { Read: 'Study', Edit: 'Amend', MultiEdit: 'Amend', Write: 'Note', Bash: 'Run', PowerShell: 'Run', Grep: 'Search', Glob: 'Sift', Agent: 'Brief', WebFetch: 'Look up', WebSearch: 'Canvass', ToolSearch: 'Ask around' }
const verbOf = (tool: string): string => VERB[tool] ?? tool
const PAST: Record<string, string> = { Study: 'studied', Amend: 'amended', Note: 'noted', Run: 'ran', Search: 'searched', Sift: 'sifted', Brief: 'briefed', 'Look up': 'looked up', Canvass: 'canvassed', 'Ask around': 'asked around' }
export const BOARD_H = 214
const CARD_W = 62, CARD_H = 54, CARD_GAP = 6
export const BOARD_CSS = `.pinlive{animation:pinlive 1.4s ease-in-out infinite}@keyframes pinlive{50%{opacity:.45}}
.drop{animation:drop .4s cubic-bezier(.2,1.4,.4,1) both}@keyframes drop{from{transform:translateY(-8px);opacity:0}}
@media (prefers-reduced-motion: reduce){.pinlive,.drop{animation:none}}`
const clock = (ms: number): string => {
  const sec = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), r = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
const pinAt = (x: number, y: number, color: string, live = false): string =>
  `<g${live ? ' class="pinlive"' : ''}><circle cx="${n1(x + 0.8)}" cy="${n1(y + 1.4)}" r="4.6" fill="#000" fill-opacity=".35"/><circle cx="${n1(x)}" cy="${n1(y)}" r="4.4" fill="${color}"/><circle cx="${n1(x)}" cy="${n1(y)}" r="4.4" fill="none" stroke="#000" stroke-opacity=".25"/><circle cx="${n1(x - 1.4)}" cy="${n1(y - 1.4)}" r="1.3" fill="#fff" fill-opacity=".75"/></g>`
const wrap = (text: string, size: number, max: number, lines: number): string[] => {
  const words = String(text).split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  let cut = false
  for (const w of words) {
    const tryL = cur ? `${cur} ${w}` : w
    if (serifW(tryL, size) <= max || !cur) cur = tryL
    else {
      out.push(cur)
      cur = w
      if (out.length === lines) { cut = true; break }
    }
  }
  if (out.length < lines && cur) out.push(cur)
  else if (cur) cut = true
  const res = out.slice(0, lines).map(l => serifClip(l, size, max))
  if (cut && res.length) res[res.length - 1] = serifClip(`${res[res.length - 1]?.replace(/…$/, '')} …`, size, max)
  return res
}

/** The words for the board's alt text: "Case board: lead 7 of 12, Engineer amended parser.ts at 03:41". */
export const caseBoardAlt = (beats: Beat[], pick: number): string => {
  const n = beats.length
  if (!n) return 'Case board: no leads yet'
  const i = Math.max(0, Math.min(n - 1, pick < 0 ? n - 1 : pick))
  const b = beats[i] as Beat
  const v = verbOf(b.tool)
  return `Case board: lead ${i + 1} of ${n}, ${b.who} ${PAST[v] ?? v.toLowerCase()} ${b.text} at ${clock(b.at - (beats[0] as Beat).at)}${pick < 0 ? ', live' : ''}`
}

export const caseBoard = (W: number, beats: Beat[], pick: number, t: CardTheme, font: string, frame: Frame, opts: { dropLast?: boolean } = {}): string => {
  const H = BOARD_H
  const PIN = { read: t.accent, ask: '#F2F5FA', change: t.warn, other: t.muted }
  const n = beats.length
  const sel = n ? Math.max(0, Math.min(n - 1, pick < 0 ? n - 1 : pick)) : -1
  const isLive = pick < 0
  const s: string[] = []
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${BOARD_CSS}</style>`)
  s.push(`<defs><pattern id="cork" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${P.cork}"/><rect x="2" y="3" width="1" height="1" fill="${P.corkSpeck}"/><rect x="8" y="1" width="1" height="1" fill="${P.corkSpeck2}"/><rect x="6" y="8" width="1" height="1" fill="${P.corkSpeck}"/><rect x="10" y="10" width="1" height="1" fill="${P.corkSpeck2}"/><rect x="1" y="9" width="1" height="1" fill="${P.corkSpeck2}"/><rect x="4" y="6" width="1" height="1" fill="${P.corkSpeck}"/></pattern><filter id="lift" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".5"/></filter></defs>`)
  s.push(frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".35"`, 10))
  s.push(`<rect x="16" y="13" width="3" height="13" fill="${t.accent}"/><text x="25" y="24" font-family="${font}" font-size="13" font-weight="700" letter-spacing="1" fill="${t.text}">CASE BOARD</text>`)
  const hx = 25 + serifW('CASE BOARD', 13, 1, true) + 10
  const state = !n ? 'no leads yet' : `${n} lead${n === 1 ? '' : 's'}${n > 12 ? ' · last 12 pinned' : ''} · ${isLive ? 'live' : `replaying no. ${sel + 1}`}`
  s.push(`<text x="${n1(hx)}" y="23.5" font-family="${font}" font-size="11.5" font-style="italic" fill="${isLive && n ? t.accent : t.subtext}">${state}</text>`)
  if (W >= 480) {
    let lx = W - 16
    for (const k of ['change', 'ask', 'read'] as const) {
      lx -= serifW(k, 11)
      s.push(`<text x="${n1(lx)}" y="23.5" font-family="${font}" font-size="11" fill="${t.muted}">${k}</text><circle cx="${n1(lx - 8)}" cy="19.5" r="3.4" fill="${PIN[k]}"/>`)
      lx -= 22
    }
  }
  const bx = 14, by = 36, bw = W - 28, bh = H - by - 14
  s.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="url(#cork)" stroke="${P.frame}" stroke-width="2"/>`)
  const polW = W >= 520 ? 132 : 112
  const area = { x: bx + 10, y: by + 12, w: bw - polW - 30, h: bh - 20 }
  const per = Math.max(1, Math.floor((area.w + CARD_GAP) / (CARD_W + CARD_GAP)))
  const cap = per * 2
  let from = Math.max(0, n - cap)
  if (sel >= 0 && sel < from) from = sel
  const shown = beats.slice(from, from + cap)
  const rowsN = shown.length > per ? 2 : 1
  const rowH = CARD_H + 10
  const top = area.y + (area.h - rowsN * rowH + 12) / 2
  const pos = shown.map((b, i) => {
    const r = Math.floor(i / per), j = i % per
    const col = r === 0 ? j : per - 1 - j
    const cols = r === 0 ? Math.min(per, shown.length) : per
    const span = cols * (CARD_W + CARD_GAP) - CARD_GAP
    const x0 = area.x + (r === 0 ? (area.w - span) / 2 : (area.w - (per * (CARD_W + CARD_GAP) - CARD_GAP)) / 2)
    const jitter = (hash(String(b.at)) % 7) - 3
    return { x: x0 + col * (CARD_W + CARD_GAP), y: top + r * rowH + (col % 2 ? 2 : -1) + jitter * 0.3, rot: ((hash(b.tool + b.at) % 5) - 2) * 0.8 }
  })
  if (!n) {
    const ex = area.x + area.w / 2 - 110, ey = by + bh / 2 - 26
    s.push(`<g transform="rotate(-1.5 ${n1(ex + 110)} ${n1(ey + 26)})"><rect x="${n1(ex)}" y="${n1(ey)}" width="220" height="52" fill="${P.paper}" filter="url(#lift)"/><line x1="${n1(ex)}" y1="${n1(ey + 14)}" x2="${n1(ex + 220)}" y2="${n1(ey + 14)}" stroke="${t.alert}"/><text x="${n1(ex + 10)}" y="${n1(ey + 31)}" font-family="${font}" font-size="11.5" font-weight="700" fill="${P.paperInk}">No leads yet.</text><text x="${n1(ex + 10)}" y="${n1(ey + 45)}" font-family="${font}" font-size="10.5" font-style="italic" fill="${P.paperSub}">Every tool call gets pinned here.</text></g>`)
    s.push(pinAt(ex + 110, ey + 6, t.muted))
  }
  const t0 = (beats[0] as Beat | undefined)?.at ?? 0
  shown.forEach((b, i) => {
    const p = pos[i] as { x: number; y: number; rot: number }
    const isSel = from + i === sel
    s.push(`<g transform="rotate(${n1(p.rot)} ${n1(p.x + CARD_W / 2)} ${n1(p.y + CARD_H / 2)})"${opts.dropLast && i === shown.length - 1 ? ' class="drop"' : ''}>`)
    s.push(`<rect x="${n1(p.x)}" y="${n1(p.y)}" width="${CARD_W}" height="${CARD_H}" fill="${P.paper}" filter="url(#lift)"/>`)
    s.push(`<line x1="${n1(p.x)}" y1="${n1(p.y + 12.5)}" x2="${n1(p.x + CARD_W)}" y2="${n1(p.y + 12.5)}" stroke="${t.alert}"/>`)
    s.push(`<line x1="${n1(p.x + 5)}" y1="${n1(p.y + 41.5)}" x2="${n1(p.x + CARD_W - 5)}" y2="${n1(p.y + 41.5)}" stroke="${P.paperRule}"/>`)
    s.push(`<text x="${n1(p.x + 5)}" y="${n1(p.y + 25)}" font-family="${font}" font-size="9.5" font-weight="700" fill="${P.paperInk}">${esc(serifClip(b.who, 9.5, CARD_W - 7))}</text>`)
    s.push(`<text x="${n1(p.x + 5)}" y="${n1(p.y + 37)}" font-family="${font}" font-size="10" font-style="italic" fill="${P.paperSub}">${esc(serifClip(verbOf(b.tool), 10, CARD_W - 9))}</text>`)
    s.push(`<text x="${n1(p.x + 5)}" y="${n1(p.y + 50.5)}" font-family="${font}" font-size="9" fill="${P.paperSub}" font-variant-numeric="tabular-nums">${clock(b.at - t0)}</text>`)
    if (isSel) s.push(`<rect x="${n1(p.x - 2.5)}" y="${n1(p.y - 2.5)}" width="${CARD_W + 5}" height="${CARD_H + 5}" fill="none" stroke="${t.accent}" stroke-width="1.6"/>`)
    s.push('</g>')
  })
  const pins = pos.map(p => [p.x + CARD_W / 2, p.y + 6] as [number, number])
  if (pins.length > 1) {
    const d = pins.map(([x, y], i) => {
      if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`
      const [px, py] = pins[i - 1] as [number, number]
      if (Math.abs(y - py) < 20) return `Q${((px + x) / 2).toFixed(1)} ${(Math.max(py, y) + 5).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
      const ox = px + (px > area.x + area.w / 2 ? 1 : -1) * (CARD_W / 2 + 22)
      return `C${ox.toFixed(1)} ${py.toFixed(1)} ${ox.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join('')
    s.push(`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.6" transform="translate(.8 1.4)"/><path d="${d}" fill="none" stroke="${RED}" stroke-width="1.5"/>`)
  }
  pins.forEach(([x, y], i) => s.push(pinAt(x, y, PIN[kindOf((shown[i] as Beat).tool)], isLive && from + i === n - 1)))
  const px = bx + bw - polW - 12, py = by + 12, ph = bh - 22
  const b = sel >= 0 ? (beats[sel] as Beat) : null
  if (b) {
    s.push(`<g transform="rotate(1.6 ${n1(px + polW / 2)} ${n1(py + ph / 2)})"><rect x="${px}" y="${py}" width="${polW}" height="${ph}" fill="#F4F2EC" filter="url(#lift)"/>`)
    const ix = px + 8, iy = py + 8, iw = polW - 16, ih = ph - 46
    s.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="#101A2C"/><rect x="${ix}" y="${iy}" width="3" height="${ih}" fill="${PIN[kindOf(b.tool)]}"/>`)
    s.push(`<text x="${ix + 10}" y="${iy + 20}" font-family="${font}" font-size="15" font-weight="700" fill="${t.text}">${esc(serifClip(verbOf(b.tool), 15, iw - 14))}</text>`)
    s.push(`<text x="${ix + 10}" y="${iy + 34}" font-family="${font}" font-size="10" fill="${t.muted}">${esc(serifClip(`${b.tool} · ${b.who}`, 10, iw - 14))}</text>`)
    wrap(b.text, 11, iw - 18, 3).forEach((ln, i) => s.push(`<text x="${ix + 10}" y="${iy + 53 + i * 14}" font-family="${font}" font-size="11" fill="${t.subtext}">${esc(ln)}</text>`))
    s.push(`<text x="${px + 10}" y="${py + ph - 22}" font-family="${font}" font-size="12" font-style="italic" fill="${P.paperInk}" font-variant-numeric="tabular-nums">No. ${sel + 1} of ${n}</text>`)
    s.push(`<text x="${px + 10}" y="${py + ph - 9}" font-family="${font}" font-size="10" fill="${P.paperSub}" font-variant-numeric="tabular-nums">at ${clock(b.at - t0)}</text></g>`)
    s.push(`<rect x="${n1(px + polW / 2 - 20)}" y="${py - 6}" width="40" height="13" fill="#E8E2D0" fill-opacity=".55" transform="rotate(-4 ${n1(px + polW / 2)} ${py})"/>`)
  } else {
    s.push(`<rect x="${px}" y="${py}" width="${polW}" height="${ph}" fill="none" stroke="${P.manilaInk}" stroke-opacity=".35" stroke-dasharray="3 4"/><text x="${n1(px + polW / 2)}" y="${n1(py + ph / 2 + 4)}" text-anchor="middle" font-family="${font}" font-size="10.5" font-style="italic" fill="${P.manilaInk}">photo goes here</text>`)
  }
  s.push('</svg>')
  return s.join('\n')
}
