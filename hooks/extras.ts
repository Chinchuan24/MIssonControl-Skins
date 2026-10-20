// Extras for Mission Control: Street Cred (XP, levels, badges), the Braindance
// replay of a session's tool calls, and the boot-up strip. Pure functions and SVG
// strings; the hooks module keeps the state and decides when each shows.

// --- Street Cred ---

export type Cred = {
  xp: number
  jobs: number
  longJobs: number
  agents: number
  crewJobs: number
  nightJobs: number
  chromed: boolean
  samurai: boolean
  badges: string[]
}
export const BLANK_CRED: Cred = { xp: 0, jobs: 0, longJobs: 0, agents: 0, crewJobs: 0, nightJobs: 0, chromed: false, samurai: false, badges: [] }

// Level L needs 25·L·(L−1) XP: 0, 50, 150, 300, 500, 750…
export const levelOf = (xp: number): number => Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 6.25)) / 2))
export const xpFor = (level: number): number => 25 * level * (level - 1)

// Badge ids are what the store keeps; the names are what Night City calls them.
export type Badge = { id: string; name: string; icon: string; how: string; progress: (c: Cred) => number }
const share = (n: number, of: number) => Math.max(0, Math.min(1, n / of))
export const BADGES: Badge[] = [
  { id: 'choom', name: 'FIRST GIG', icon: '✦', how: 'Finish your first gig', progress: c => share(c.jobs, 1) },
  { id: 'merc', name: "FIXER'S FAVORITE", icon: '◆', how: 'Finish 10 gigs', progress: c => share(c.jobs, 10) },
  { id: 'edgerunner', name: 'ICONIC', icon: '★', how: 'Finish 50 gigs', progress: c => share(c.jobs, 50) },
  { id: 'legend', name: 'THE BIG LEAGUES', icon: '♛', how: '10 major gigs (3+ minutes each)', progress: c => share(c.longJobs, 10) },
  { id: 'netrunner', name: 'NETRUNNER', icon: '⌁', how: 'Call 100 sub-agents', progress: c => share(c.agents, 100) },
  { id: 'crewboss', name: 'FIXER', icon: '⚑', how: 'Run a gig with 5+ sub-agents', progress: c => share(c.crewJobs, 1) },
  { id: 'chromed', name: 'CYBERPSYCHO', icon: '⚙', how: 'Push the context past 90%', progress: c => (c.chromed ? 1 : 0) },
  { id: 'owl', name: 'GRAVEYARD SHIFT', icon: '☾', how: 'Finish a gig after midnight', progress: c => share(c.nightJobs, 1) },
  { id: 'samurai', name: 'SAMURAI', icon: '♪', how: 'Find the secret skin', progress: c => (c.samurai ? 1 : 0) },
]

// The badges a cred has just earned, and the cred with them recorded.
export const award = (c: Cred): { cred: Cred; fresh: Badge[] } => {
  const fresh = BADGES.filter(b => !c.badges.includes(b.id) && b.progress(c) >= 1)
  return { cred: fresh.length ? { ...c, badges: [...c.badges, ...fresh.map(b => b.id)] } : c, fresh }
}

export const cleanCred = (v: unknown): Cred => {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<Cred>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)
  return {
    xp: n(r.xp),
    jobs: n(r.jobs),
    longJobs: n(r.longJobs),
    agents: n(r.agents),
    crewJobs: n(r.crewJobs),
    nightJobs: n(r.nightJobs),
    chromed: r.chromed === true,
    samurai: r.samurai === true,
    badges: Array.isArray(r.badges) ? [...new Set(r.badges.filter((b): b is string => typeof b === 'string' && BADGES.some(x => x.id === b)))] : [],
  }
}

export type Frame = (x: number, y: number, w: number, h: number, attrs: string, r?: number) => string
type Theme = { accent: string; accent2: string; done: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string; alert?: string }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// '#rgb' or '#rrggbb' as [r, g, b] in 0..255; null for anything else.
const rgbOf = (hex: string): [number, number, number] | null => {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = (m[1] as string).length === 3 ? [...(m[1] as string)].map(ch => ch + ch).join('') : (m[1] as string)
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}
// WCAG relative luminance, 0 (black) .. 1 (white).
const luminance = (hex: string): number => {
  const rgb = rgbOf(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
// The ink for text drawn on a solid `bg`: near-black on light fills, white on dark ones.
export const inkOn = (bg: string): string => (luminance(bg) > 0.18 ? '#111111' : '#FFFFFF')
// Two colours a glance can tell apart ("redmean" distance; unparseable ones count as apart).
const isApart = (a: string, b: string): boolean => {
  const x = rgbOf(a)
  const y = rgbOf(b)
  if (!x || !y) return a.toLowerCase() !== b.toLowerCase()
  const rm = (x[0] + y[0]) / 2
  const [dr, dg, db] = [x[0] - y[0], x[1] - y[1], x[2] - y[2]]
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) >= 150
}
// Glyphs macOS may draw as colour emoji, held to their text form with U+FE0E.
const asText = (s: string): string => s.replace(/([⚙▶◀⏮⚠▫‼])(?!\uFE0E)/gu, '$1\uFE0E')

// Rough advance of UI text in px (bold, a touch wide on purpose): enough to keep
// a label inside its slot at narrow widths.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿가-힣豈-﫿！-｠☀-➿\u{1F300}-\u{1FAFF}]/u
export const textW = (s: string, size: number, ls = 0): number =>
  [...s].reduce((w, ch) => (ch === '\uFE0E' ? w : w + (WIDE.test(ch) ? 1 : /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.32 : /[A-Z@%MW]/.test(ch) ? 0.74 : 0.6) * size + ls), 0)
// `s` cut to fit `maxW`, with an ellipsis when cut; '' when not even that fits.
export const clipW = (s: string, size: number, maxW: number, ls = 0): string => {
  if (textW(s, size, ls) <= maxW) return s
  const chars = [...s]
  while (chars.length && textW(`${chars.join('')}…`, size, ls) > maxW) chars.pop()
  return chars.length ? `${chars.join('').trimEnd()}…` : ''
}
// The largest size from `max` down to `min` at which `s` fits `maxW`.
const fitSize = (s: string, max: number, min: number, maxW: number, ls = 0): number => {
  let size = max
  while (size > min && textW(s, size, ls) > maxW) size -= 0.5
  return size
}

// The replay's selection when the timeline drops its `dropped` oldest beats: it
// follows its beat, and holds on the oldest kept one if its own was dropped.
export const shiftPick = (pick: number, dropped: number): number => (pick < 0 || dropped <= 0 ? pick : Math.max(0, pick - dropped))
// One step back (-1) or forward (+1) through `n` beats; -1 is "live" (the newest).
export const stepPick = (pick: number, n: number, d: -1 | 1): number => {
  if (n <= 0) return -1
  const at = pick < 0 || pick >= n ? n - 1 : pick
  if (d > 0) return pick < 0 || at + 1 >= n ? -1 : at + 1
  return Math.max(0, at - 1)
}

// Ranks by level, the way Night City sizes you up.
export const rankOf = (level: number): string =>
  level >= 20 ? 'LEGEND OF THE AFTERLIFE' : level >= 15 ? 'EDGERUNNER' : level >= 10 ? 'SOLO' : level >= 7 ? 'MERC' : level >= 4 ? 'PUNK' : level >= 2 ? 'STREET RAT' : 'NOBODY'
// SAMURAI climbs a Rockerboy's ladder instead.
export const rockerRankOf = (level: number): string =>
  level >= 20 ? 'LEGEND' : level >= 10 ? 'ROCKERBOY' : level >= 4 ? 'HEADLINER' : level >= 2 ? 'ROADIE' : 'OPENING ACT'

const hexPath = (cx: number, cy: number, r: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join('') + 'Z'

const CRED_CSS = `.spin{animation:spin 9s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes spin{to{transform:rotate(360deg)}}
.pulse{animation:pulse 2.2s ease-in-out infinite}@keyframes pulse{50%{opacity:.45}}
.sweep{animation:sweep 2.8s ease-in-out infinite}@keyframes sweep{from{transform:translateX(-40px);opacity:0}25%{opacity:.9}to{transform:translateX(var(--sw));opacity:0}}
.fresh{animation:fresh 1.4s ease-in-out infinite}@keyframes fresh{50%{opacity:.35}}
.gl1{animation:gl 5s steps(1) infinite}@keyframes gl{0%,93%,100%{transform:translate(0,0)}94%{transform:translate(-2px,0)}96%{transform:translate(2px,1px)}}
@media (prefers-reduced-motion: reduce){.spin,.pulse,.sweep,.fresh,.gl1{animation:none}.sweep{opacity:0}}`

const MED = 46
// Below this width the stats leave the emblem's side for two rows under it.
const NARROW = 360
// The head: emblem, rank, bar and stats; the medallions follow in cells at least
// 100px wide, so the longest name ("AFTERLIFE LEGEND") keeps clear of its neighbours.
const credHead = (W: number): number => (W < NARROW ? 206 : 146)
// (the medallion rows start a little lower, under the "NEXT" line)
const credPer = (W: number): number => Math.max(1, Math.floor((W - 28) / 100))
export const credHeight = (W: number): number => credHead(W) + 20 + Math.ceil(BADGES.length / credPer(W)) * 70
export const credCard = (W: number, c: Cred, t: Theme, font: string, frame: Frame, title: string, kana = '', ranks: (level: number) => string = rankOf): string => {
  const H = credHeight(W)
  const head = credHead(W)
  const isNarrow = W < NARROW
  const level = levelOf(c.xp)
  const lo = xpFor(level)
  const hi = xpFor(level + 1)
  const share = Math.max(0, Math.min(1, (c.xp - lo) / Math.max(1, hi - lo)))
  // The emblem: a hex with the level, a ring of 12 segments lit by the progress, a scan ring turning.
  const cx = 66
  const cy = 72
  const segs = Array.from({ length: 12 }, (_, i) => {
    const a0 = (Math.PI * 2 * i) / 12 - Math.PI / 2 + 0.06
    const a1 = (Math.PI * 2 * (i + 1)) / 12 - Math.PI / 2 - 0.06
    const r = 46
    const on = i < Math.round(share * 12)
    return `<path d="M${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)}A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}" fill="none" stroke="${on ? t.accent : t.line}" stroke-width="5"${on && i === Math.round(share * 12) - 1 ? ' class="pulse"' : ''}/>`
  }).join('')
  const emblem = `<g filter="url(#cg)"><path d="${hexPath(cx, cy, 34)}" fill="${t.accent}" fill-opacity=".14" stroke="${t.accent}" stroke-width="2"/></g>
<path d="${hexPath(cx, cy, 27)}" fill="none" stroke="${t.accent}" stroke-opacity=".35"/>
<circle class="spin" cx="${cx}" cy="${cy}" r="54" fill="none" stroke="${t.accent2}" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 9 22 9"/>
${segs}
<text x="${cx + 1.5}" y="${cy + 13}" text-anchor="middle" font-family="${font}" font-size="34" font-weight="900" fill="${t.accent2}" fill-opacity=".55" font-variant-numeric="tabular-nums">${level}</text>
<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="${font}" font-size="34" font-weight="900" fill="${t.text}" font-variant-numeric="tabular-nums">${level}</text>
<text x="${cx}" y="${cy - 17}" text-anchor="middle" font-family="${font}" font-size="9" font-weight="900" letter-spacing="1.5" fill="${t.accent}">LVL</text>`
  // The rank and the XP: an angled, segmented bar with a light running along it.
  const rx = 136
  const barW = Math.max(80, W - rx - 18)
  const n = Math.max(10, Math.floor(barW / 12))
  const sw = barW / n
  const lit = Math.round(share * n)
  const bar = Array.from({ length: n }, (_, i) => {
    const x = rx + i * sw
    const on = i < lit
    return `<path d="M${(x + 3).toFixed(1)} 84h${(sw - 3).toFixed(1)}l-3 10h-${(sw - 3).toFixed(1)}z" fill="${on ? t.accent : t.track}"${on ? ` fill-opacity="${(0.5 + 0.5 * ((i + 1) / Math.max(1, lit))).toFixed(2)}"` : ''}/>`
  }).join('')
  const rank = ranks(level)
  const stat = (x: number, y: number, slot: number, k: string, v: string) =>
    `<text x="${x.toFixed(1)}" y="${y}" font-family="${font}" font-size="9" font-weight="800" letter-spacing=".8" fill="${t.muted}">${esc(clipW(k, 9, slot - 6, 0.8))}</text><text x="${x.toFixed(1)}" y="${y + 13}" font-family="${font}" font-size="13" font-weight="800" fill="${v === '0' ? t.muted : t.text}" font-variant-numeric="tabular-nums">${v === '0' ? '—' : esc(clipW(v, 13, slot - 6))}</text>`
  const statList: [string, string][] = [
    ['GIGS', `${c.jobs}`],
    ['MAJOR GIGS', `${c.longJobs}`],
    ['AGENTS', `${c.agents}`],
    ['BADGES', `${c.badges.length}/${BADGES.length}`],
  ]
  // Wide: one row beside the emblem. Narrow: two rows of two under it, edge to edge.
  const stats = isNarrow
    ? statList.map(([k, v], i) => stat(14 + (i % 2) * ((W - 28) / 2), 152 + Math.floor(i / 2) * 28, (W - 28) / 2, k, v)).join('')
    : statList.map(([k, v], i) => stat(rx + i * Math.min(110, barW / 4), 116, Math.min(110, barW / 4), k, v)).join('')
  // The right column's text, sized to its room: shrunk first, then cut.
  const room = W - rx - 14
  const rankSize = fitSize(rank, rank.length > 14 ? 17 : 24, 10, room, 1.5)
  const rankText = clipW(rank, rankSize, room, 1.5)
  const titleSize = fitSize(title, 10, 7, room, 2)
  const titleText = clipW(title, titleSize, room, 2)
  const showKana = kana !== '' && textW(titleText, titleSize, 2) + 8 + textW(kana, 7, 1) <= room
  const toGo = hi - c.xp
  const xpTail = textW(`${c.xp} XP · ${toGo} to level ${level + 1}`, 11) <= room ? ` XP · ${toGo} to level ${level + 1}` : textW(`${c.xp} XP · +${toGo}`, 11) <= room ? ` XP · +${toGo}` : ' XP'
  // The medallions: hexes with an icon; earned ones glow, locked ones are dark with a "?".
  const per = credPer(W)
  const cell = (W - 28) / per
  const meds = BADGES.map((b, i) => {
    const on = c.badges.includes(b.id)
    const mx = 14 + (i % per) * cell + cell / 2
    const my = head + 40 + Math.floor(i / per) * 70
    const label = on ? b.name : 'CLASSIFIED'
    const labelSize = fitSize(label, 8.5, 6.5, cell - 8, 0.6)
    const p = on ? 1 : b.progress(c)
    const ring = !on && p > 0 ? `<path d="${hexPath(mx, my, MED / 2)}" pathLength="100" fill="none" stroke="${t.accent}" stroke-width="2" stroke-dasharray="${(p * 100).toFixed(1)} 100"/>` : ''
    return `<g${on ? ' filter="url(#cg)"' : ''}><path d="${hexPath(mx, my, MED / 2)}" fill="${on ? t.accent : t.tile}" fill-opacity="${on ? 0.2 : 1}" stroke="${on ? t.accent : t.line}" stroke-width="${on ? 1.8 : 1}"${on ? '' : ' stroke-dasharray="3 3"'}/></g>${ring}
<text x="${mx}" y="${my + 7}" text-anchor="middle" font-family="'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2',sans-serif" font-size="19" fill="${on ? t.accent : t.text}" fill-opacity="${on ? 1 : 0.13}">${asText(b.icon)}<title>${esc(b.name)}: ${esc(b.how)}${on ? '' : ` (${Math.round(p * 100)}%)`}</title></text>
<text x="${mx}" y="${my + MED / 2 + 15}" text-anchor="middle" font-family="${font}" font-size="${labelSize}" font-weight="800" letter-spacing=".6" fill="${on ? t.text : t.muted}">${esc(clipW(label, labelSize, cell - 8, 0.6))}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${CRED_CSS}</style>
<defs><filter id="cg" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<radialGradient id="cbg" cx="${cx}" cy="${cy}" r="80" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.accent}" stop-opacity=".12"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<clipPath id="cxb"><rect x="${rx}" y="84" width="${barW.toFixed(1)}" height="10"/></clipPath></defs>
${frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".35"`, 10)}
<circle cx="${cx}" cy="${cy}" r="80" fill="url(#cbg)"/>
${emblem}
<text x="${rx}" y="26" font-family="${font}" font-size="${titleSize}" font-weight="800" letter-spacing="2" fill="${t.accent2}">${esc(titleText)}${showKana ? `<tspan dx="8" font-size="7" letter-spacing="1" fill-opacity=".55">${esc(kana)}</tspan>` : ''}</text>
<g class="gl1"><text x="${rx}" y="56" font-family="${font}" font-size="${rankSize}" font-weight="900" letter-spacing="1.5" fill="${t.accent}">${esc(rankText)}</text></g>
<text x="${rx}" y="77" font-family="${font}" font-size="11" fill="${t.subtext}" font-variant-numeric="tabular-nums"><tspan font-weight="800" fill="${t.text}">${c.xp}</tspan>${xpTail}</text>
${bar}
<g clip-path="url(#cxb)"><rect class="sweep" style="--sw:${barW + 40}px" x="${rx}" y="83" width="28" height="12" fill="#ffffff" fill-opacity=".5" transform="skewX(-16)"/></g>
${stats}
<line x1="14" y1="${head + 0.5}" x2="${W - 14}" y2="${head + 0.5}" stroke="${t.line}"/>
${(() => {
  const next = BADGES.filter(b => !c.badges.includes(b.id)).sort((a, b2) => b2.progress(c) - a.progress(c))[0]
  const line = next ? `NEXT: ${next.name} · ${next.how}` : 'ALL BADGES EARNED. PREEM.'
  return `<text x="${W - 14}" y="${head + 12}" text-anchor="end" font-family="${font}" font-size="8.5" font-weight="800" letter-spacing=".8" fill="${t.muted}">${esc(clipW(line, 8.5, W - 28, 0.8))}</text>`
})()}
${meds}
</svg>`
}

// --- Braindance: a replay of the session's tool calls, styled like the BD editor ---

export type Beat = { at: number; tool: string; text: string; who: string }
export const BEATS_KEPT = 160

const kindOf = (tool: string): 'read' | 'edit' | 'run' | 'agent' | 'web' | 'other' =>
  /^(Read|Grep|Glob|LS)$/.test(tool) ? 'read'
  : /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool) ? 'edit'
  : /^(Bash|PowerShell)$/.test(tool) ? 'run'
  : tool === 'Agent' ? 'agent'
  : /^Web/.test(tool) ? 'web'
  : 'other'

// The BD editor's layers: what you saw, what you heard, what ran hot.
type Layer = 'VISUAL' | 'AUDIO' | 'THERMAL'
const LAYER: Record<string, Layer> = { read: 'VISUAL', other: 'VISUAL', web: 'AUDIO', agent: 'AUDIO', edit: 'THERMAL', run: 'THERMAL' }
const layerName = (kind: string): Layer => LAYER[kind] ?? 'VISUAL'
// The game's own colours, for a caller without a theme.
const GAME: Record<Layer, string> = { VISUAL: '#FCEE0A', AUDIO: '#2DE2E6', THERMAL: '#FF5A1F' }
// The skin's colours for the layers: accent, accent2, alert (or accent). When one
// would read as another's colour, it takes the text colour instead.
export const layerColors = (t: Theme): Record<Layer, string> => {
  const visual = t.accent
  const audio = isApart(t.accent2, visual) ? t.accent2 : t.text
  const hot = t.alert ?? t.accent
  const thermal = isApart(hot, visual) && isApart(hot, audio) ? hot : t.text
  return { VISUAL: visual, AUDIO: audio, THERMAL: thermal }
}
export const layerOf = (tool: string, t?: Theme): { name: string; color: string } => {
  const name = layerName(kindOf(tool))
  return { name, color: t ? layerColors(t)[name] : GAME[name] }
}

// Up to five lanes: the Manager's, then whoever acted, in order of appearance.
const bdRows = (beats: Beat[]): string[] => ['Manager', ...[...new Set(beats.map(b => b.who))].filter(w => w !== 'Manager')].slice(0, 5)
// The card's height for these beats: header and ruler, one 17px lane per row shown, the detail line.
export const bdHeight = (beats: Beat[]): number => 91 + 17 * bdRows(beats).length
// The tallest card (five lanes); the default room to keep for it.
export const BD_H = 176
export const braindanceCard = (W: number, beats: Beat[], pick: number, t: Theme, font: string, frame: Frame, title: string, _tone?: (k: string) => string): string => {
  // The layers in the skin's colours; a caller may pass its own.
  const colors = layerColors(t)
  const tone = (k: string) => (_tone ? _tone(k) : colors[layerName(k)])
  const H = bdHeight(beats)
  const x0 = 104
  const x1 = W - 16
  const trackW = Math.max(40, x1 - x0)
  const rows = bdRows(beats)
  const t0 = beats[0]?.at ?? 0
  const t1 = Math.max(t0 + 1, beats.at(-1)?.at ?? t0 + 1)
  const xOf = (at: number) => x0 + ((at - t0) / (t1 - t0)) * trackW
  const yOf = (w: string) => 58 + Math.max(0, rows.indexOf(w)) * 17
  const sel = beats.length ? Math.max(0, Math.min(beats.length - 1, pick < 0 ? beats.length - 1 : pick)) : -1
  // Timecode from the start of the recording, like the editor's: 00:06:25.
  const time = (at: number) => {
    const sec = Math.max(0, Math.round((at - t0) / 1000))
    return `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
  }
  // A ruler with ticks and times, like the editor's.
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const x = x0 + (trackW * i) / 10
    const major = i % 5 === 0
    const isLabelled = major && beats.length > 0 && (i !== 5 || trackW >= 150)
    return `<line x1="${x.toFixed(1)}" y1="${major ? 38 : 41}" x2="${x.toFixed(1)}" y2="45" stroke="${t.muted}" stroke-opacity="${major ? 0.8 : 0.4}"/>${isLabelled ? `<text x="${x.toFixed(1)}" y="35" text-anchor="${i === 0 ? 'start' : i === 10 ? 'end' : 'middle'}" font-family="${font}" font-size="8.5" fill="${t.muted}" font-variant-numeric="tabular-nums">${time(t0 + ((t1 - t0) * i) / 10)}</text>` : ''}`
  }).join('')
  const lanes = rows
    .map((w, i) => {
      const y = yOf(w)
      return `<rect x="${x0}" y="${y - 7}" width="${trackW}" height="14" fill="${t.track}" fill-opacity="${i % 2 ? 0.35 : 0.6}"/>
<text x="16" y="${y + 3.5}" font-family="${font}" font-size="10" font-weight="700" letter-spacing=".4" fill="${t.subtext}">${esc(clipW(w.toUpperCase(), 10, x0 - 22, 0.4))}</text>`
    })
    .join('')
  const s = sel >= 0 ? (beats[sel] as Beat) : null
  // Each layer has its own mark, so it reads without its colour: a bar for VISUAL,
  // a diamond for AUDIO, a triangle for THERMAL. The picked beat's is larger and outlined.
  const mark = (b: Beat, isPicked: boolean): string => {
    const kind = kindOf(b.tool)
    const x = xOf(b.at)
    const y = yOf(b.who)
    const fill = `fill="${tone(kind)}"${isPicked ? ` stroke="${t.text}" stroke-width="1"` : ' fill-opacity=".85"'}`
    const hh = isPicked ? 7 : 6
    const layer = layerName(kind)
    if (layer === 'AUDIO') {
      const hw = isPicked ? 4 : 3
      return `<path d="M${x.toFixed(1)} ${y - hh}l${hw} ${hh}l-${hw} ${hh}l-${hw} -${hh}z" ${fill}/>`
    }
    if (layer === 'THERMAL') {
      const hw = isPicked ? 4.5 : 3.5
      return `<path d="M${x.toFixed(1)} ${y - hh}l${hw} ${hh * 2}h-${hw * 2}z" ${fill}/>`
    }
    const w = isPicked ? 5 : 3
    return `<rect x="${(x - w / 2).toFixed(1)}" y="${y - hh}" width="${w}" height="${hh * 2}" rx="1" ${fill}/>`
  }
  const marks = beats
    .filter(b => rows.includes(b.who))
    .map(b => mark(b, b === s))
    .join('')
  const bottom = 58 + (rows.length - 1) * 17 + 9
  const head = s
    ? `<rect x="${(xOf(s.at) - 8).toFixed(1)}" y="46" width="16" height="${bottom - 46}" fill="${t.accent}" fill-opacity=".10"/>
<line x1="${xOf(s.at).toFixed(1)}" y1="44" x2="${xOf(s.at).toFixed(1)}" y2="${bottom}" stroke="${t.accent}" stroke-width="1.6" filter="url(#bg)"/>
<path d="M${xOf(s.at).toFixed(1)} 46l-5 -7h10z" fill="${t.accent}"/>`
    : ''
  // The selected beat's line, fitted to the box: the index always, then the tool,
  // who did it, the time, and the text with whatever room is left.
  const detail = (() => {
    const box = `<rect x="14" y="${H - 34}" width="${W - 28}" height="22" rx="3" fill="${t.accent}" fill-opacity=".08" stroke="${t.accent}" stroke-opacity=".3"/>`
    if (!s) {
      const empty = W >= 520 ? 'No recording yet: every tool call lands on the timeline as the session runs.' : 'No recording yet.'
      return `<text x="22" y="${H - 19}" font-family="${font}" font-size="12" fill="${t.muted}">${esc(clipW(empty, 12, W - 44))}</text>`
    }
    const SEP = 10
    let left = W - 44
    const idx = `◆ ${sel + 1}/${beats.length}`
    left -= textW(idx, 12) + SEP
    const tool = clipW(s.tool, 12, Math.max(0, Math.min(150, left * 0.5)))
    if (tool) left -= textW(tool, 12) + SEP
    const who = left >= 40 ? clipW(s.who, 12, Math.min(110, left * 0.6)) : ''
    if (who) left -= textW(who, 12) + SEP
    const clock = time(s.at)
    const showTime = left >= textW(clock, 12) + SEP + 60
    if (showTime) left -= textW(clock, 12) + SEP
    const text = s.text && left >= 30 ? clipW(s.text, 12, left) : ''
    const parts = [
      `<tspan fill="${t.accent}" font-weight="900">${idx}</tspan>`,
      showTime ? `<tspan fill="${t.subtext}" font-variant-numeric="tabular-nums">${clock}</tspan>` : '',
      who ? `<tspan font-weight="800">${esc(who)}</tspan>` : '',
      tool ? `<tspan fill="${tone(kindOf(s.tool))}" font-weight="700">${esc(tool)}</tspan>` : '',
      text ? esc(text) : '',
    ].filter(Boolean)
    return `${box}
<text x="22" y="${H - 19}" font-family="${font}" font-size="12" fill="${t.text}" xml:space="preserve">${parts.join('  ')}</text>`
  })()
  // The layer tabs; the selected beat's layer is lit.
  const active = s ? layerOf(s.tool).name : 'VISUAL'
  const legend = (['VISUAL', 'AUDIO', 'THERMAL'] as const)
    .map((name, i) => {
      const color = tone(name === 'VISUAL' ? 'read' : name === 'AUDIO' ? 'web' : 'edit')
      const x = W - 14 - (3 - i) * 74
      const on = name === active
      return `<path d="M${x + 4} 10h64l-4 14h-64z" fill="${on ? color : 'none'}" fill-opacity="${on ? 0.9 : 0}" stroke="${color}" stroke-opacity="${on ? 1 : 0.55}"/><text x="${x + 34}" y="21" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="900" letter-spacing="1" fill="${on ? inkOn(color) : color}">${name}</text>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>.rec{animation:rec 1.2s steps(1) infinite}@keyframes rec{50%{opacity:.2}}@media (prefers-reduced-motion: reduce){.rec{animation:none}}</style>
<defs><filter id="bg" x="-200%" y="-10%" width="500%" height="120%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
${frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".35"`, 10)}
<rect x="16" y="11" width="3" height="14" fill="${t.accent}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${t.text}">${esc(title)}</text>
<text class="rec" x="${(25 + textW(title, 14, 0.8) + 12).toFixed(1)}" y="22.5" font-family="${font}" font-size="9" font-weight="900" letter-spacing="1" fill="${t.accent2}">▶\uFE0E PLAYBACK</text>
${W >= 520 && W - 236 > 25 + textW(title, 14, 0.8) + 100 ? legend : ''}
${ticks}
${lanes}${marks}${head}
${detail}
</svg>`
}

// --- Boot-up: a strip that plays its jack-in once, when the pane is drawn, then rests.
// Its source never changes between redraws, so the animation does not restart.
export const BOOT_H = 30
export const bootStrip = (W: number, t: Theme, font: string, line: string, done: string): string => {
  // The loading bar keeps to wide panes; the words shrink, then cut, to their room.
  const hasBar = W >= 360
  const room = (hasBar ? W - 132 - 12 : W - 12) - 12
  const lineSize = fitSize(line, 11, 8, room - 10, 1.2)
  const doneSize = fitSize(done, 11, 8, room, 1.2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BOOT_H}" viewBox="0 0 ${W} ${BOOT_H}"><style>
.bt1{animation:bt1 1.8s steps(1) both}@keyframes bt1{0%{opacity:1}99%{opacity:1}100%{opacity:0}}
.bt2{animation:bt2 1.8s steps(1) both}@keyframes bt2{0%{opacity:0}99%{opacity:0}100%{opacity:1}}
.bar{animation:bar 1.6s steps(12) both}@keyframes bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.bc{animation:bc 1s steps(1) infinite}@keyframes bc{50%{opacity:0}}
.ty{transform-origin:0 0;animation:ty 1.4s steps(28) 1.8s both}@keyframes ty{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){.bt1{animation:none;opacity:0}.bt2,.bar,.bc,.ty{animation:none}.bt2{opacity:1}}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${BOOT_H - 1}" rx="4" fill="${t.tile}" stroke="${t.line}"/>
<g class="bt1"><text x="12" y="19" font-family="${font}" font-size="${lineSize}" font-weight="800" letter-spacing="1.2" fill="${t.accent2}">${esc(clipW(line, lineSize, room - 10, 1.2))}<tspan class="bc">▮</tspan></text></g>
<defs><clipPath id="bty"><rect class="ty" x="0" y="0" width="${W}" height="${BOOT_H}"/></clipPath></defs>
<g class="bt2" clip-path="url(#bty)"><text x="12" y="19" font-family="${font}" font-size="${doneSize}" font-weight="800" letter-spacing="1.2" fill="${t.done}">${esc(clipW(done, doneSize, room, 1.2))}</text></g>
${hasBar ? `<rect x="${W - 132}" y="11" width="120" height="8" rx="1" fill="${t.track}"/>
<rect class="bar" style="transform-origin:${W - 132}px 15px" x="${W - 132}" y="11" width="120" height="8" rx="1" fill="${t.accent}"/>` : ''}
</svg>`
}
