// Easter eggs for the Breaking Bad skin (and its hidden Heisenberg skin): small nods a
// fan of the show will catch. A fan homage to AMC / Sony Pictures Television: only
// episode titles, short phrases and the periodic table. "Cook", "blue" and "purity" are
// show flavour only: nothing here describes how to make anything. Pure SVG strings and
// tables, no state: the hooks module decides when each shows.

import { BADGES, inkOn, textW, clipW, levelOf, xpFor } from './extras'
import type { Badge, Beat, Cred, CredWords, Frame } from './extras'
import { hashOf } from './cast'
import { pin } from './smooth'

type Th = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }

export const BLUE = '#5EC8F0'
export const GREEN = '#4FB37A'
export const YELLOW = '#F2C318'
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
let uid = 0
const id = (p: string) => `${p}${(uid = (uid + 1) % 100000)}`

// --- Motion ---
export const BB_CSS = `.bbp{animation:bbp 1.2s steps(1) infinite}@keyframes bbp{50%{opacity:.25}}
.bbs{animation:bbs 1.4s ease-in-out infinite}@keyframes bbs{50%{opacity:.05}}
.bbsp{transform-box:fill-box;transform-origin:center;animation:bbsp 1.8s ease-in-out infinite}@keyframes bbsp{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:.9;transform:scale(1)}}
.bbg{animation:bbg 7s ease-in-out infinite}@keyframes bbg{0%{opacity:0;transform:translateX(-4px)}30%,70%{opacity:.8}100%{opacity:0;transform:translateX(5px)}}
.bbt{animation:bbt 9s steps(1) infinite}@keyframes bbt{0%,92%{opacity:1}93%,96%{opacity:0}97%,100%{opacity:1}}
.bbh{opacity:0;animation:bbh 9s steps(1) infinite}@keyframes bbh{0%,92%{opacity:0}93%,96%{opacity:1}97%,100%{opacity:0}}
.bbheat{animation:bbheat .5s steps(1) infinite}@keyframes bbheat{50%{fill:${BLUE}}}
.bbwin{animation:bbwin 3.4s steps(1) infinite}@keyframes bbwin{50%{opacity:.25}}
.bbcheer{animation:bbcheer .9s steps(1) 3}@keyframes bbcheer{33%{opacity:.15}66%{opacity:.9}}
.bbrv{opacity:0;animation:bbrv 2.6s steps(1) both}@keyframes bbrv{0%,50%{opacity:0}55%,82%{opacity:.85}86%,100%{opacity:0}}
.bbhat{animation:bbhat 4s ease-in-out infinite}@keyframes bbhat{50%{opacity:.12}}
.bbchip{animation:bbchip 1.4s steps(1) infinite}@keyframes bbchip{50%{opacity:.6}}
@media (prefers-reduced-motion: reduce){.bbp,.bbs,.bbsp,.bbg,.bbt,.bbheat,.bbwin,.bbcheer,.bbhat,.bbchip{animation:none}.bbh{animation:none;opacity:0}.bbrv{animation:none;opacity:.5}.bbsp{opacity:.5}.bbg{opacity:.5}}`

// --- Pixel drawing: rows of letters, runs merged into one path per colour ---
const pixels = (rows: string[], pal: Record<string, string>, x: number, y: number, px: number, opacity = 1, cls = ''): string => {
  const by = new Map<string, string[]>()
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] as string
      const color = pal[ch]
      if (!color) continue
      let n = 1
      while (row[i + n] === ch) n++
      if (!by.has(color)) by.set(color, [])
      by.get(color)?.push(`M${i} ${j}h${n}v1h${-n}z`)
      i += n - 1
    }
  })
  const paths = [...by.entries()].map(([c, d]) => `<path d="${d.join('')}" fill="${c}"/>`).join('')
  return `<g${cls ? ` class="${cls}"` : ''} transform="translate(${+x.toFixed(1)} ${+y.toFixed(1)}) scale(${+px.toFixed(3)})" opacity="${opacity}" shape-rendering="crispEdges">${paths}</g>`
}

// The pork-pie hat: a short flat crown, a band, a brim. 15 × 7 pixels.
const HAT_ROWS = [
  '....kkkkkkk....',
  '...kkhhhhhkk...',
  '...kkkkkkkkk...',
  '...ggggggggg...',
  '..kkkkkkkkkkk..',
  'kkkkkkkkkkkkkkk',
  '.kkkkkkkkkkkkk.',
]
const HAT_PAL = { k: '#2C2C31', h: '#4A4A53', g: '#8E8E98' }
// size = drawn width in px.
export const hat = (x: number, y: number, size = 15, opacity = 1, cls = ''): string => pixels(HAT_ROWS, HAT_PAL, x, y, size / 15, opacity, cls)

// The hidden egg on Breaking Bad: faint, in the band's corner, only when the context is
// past 95% or a job runs past its time budget.
export const hiddenHat = (W: number, H: number): string => hat(W - 30, H - 20, 15, 0.22, 'bbhat')
// On the Heisenberg skin it sits by the title, plain to see.
export const hatMark = (x: number, y: number): string => hat(x, y, 13, 0.95, 'bbhat')

// --- The RV: a few pixels of white camper with a blue window ---
const RV_ROWS = [
  '..ssssssssssssss..',
  '.swwwwwwwwwwwwwws.',
  '.wbbbwbbbwwwwwbbbw',
  '.wbbbwbbbwwwwwbbbw',
  '.wwwwwwwwwwwwwwwww',
  '.gggggggggggggggg.',
  '.wwwwwwwwwwwwwwwww',
  '..kkk........kkk..',
  '..kok........kok..',
]
const RV_PAL = { s: '#B7BEB0', w: '#D8DDD0', b: BLUE, g: '#7A8A70', k: '#101410', o: '#8A8F88' }
export const rv = (x: number, y: number, size = 18, opacity = 1, cls = ''): string => pixels(RV_ROWS, RV_PAL, x, y, size / 18, opacity, cls)

// --- Episode ticker: one real title an hour ---
export const BB_EPISODES: string[] = [
  'S1E1 Pilot', 'S1E4 Cancer Man', 'S1E5 Gray Matter', "S1E6 Crazy Handful of Nothin'",
  'S2E2 Grilled', 'S2E6 Peekaboo', 'S2E7 Negro y Azul', 'S2E8 Better Call Saul', 'S2E9 4 Days Out', 'S2E12 Phoenix', 'S2E13 ABQ',
  'S3E1 No Más', 'S3E4 Green Light', 'S3E7 One Minute', 'S3E8 I See You', 'S3E9 Kafkaesque', 'S3E10 Fly', 'S3E12 Half Measures', 'S3E13 Full Measure',
  'S4E1 Box Cutter', 'S4E7 Problem Dog', 'S4E8 Hermanos', 'S4E10 Salud', 'S4E11 Crawl Space', 'S4E12 End Times', 'S4E13 Face Off',
  'S5E1 Live Free or Die', 'S5E2 Madrigal', 'S5E3 Hazard Pay', 'S5E5 Dead Freight', 'S5E7 Say My Name', 'S5E8 Gliding Over All', 'S5E14 Ozymandias', 'S5E15 Granite State', 'S5E16 Felina',
]
export const bbEpisodeAt = (at: number): string => `▶︎ ${BB_EPISODES[Math.floor(at / 3_600_000) % BB_EPISODES.length] as string}`

// --- Element tiles: "Br" 35 and "Ba" 56 in green, like the title card ---
const TILES: [string, string][] = [['35', 'Br'], ['56', 'Ba']]
export const TILE = 17
export const elementTiles = (x: number, y: number, t: Th, font: string): { svg: string; w: number } => {
  const ink = inkOn(GREEN)
  const svg = TILES.map(([n, s], i) => {
    const tx = x + i * (TILE + 3)
    return `<rect x="${tx}" y="${y - 13}" width="${TILE}" height="${TILE}" rx="1.5" fill="${GREEN}"><title>${s} ${n}</title></rect><text x="${tx + TILE / 2}" y="${y - 0.8}" text-anchor="middle" font-family="${font}" font-size="10.5" font-weight="800" fill="${ink}">${s}</text>`
  }).join('')
  return { svg: `<g>${svg}</g>`, w: TILES.length * TILE + (TILES.length - 1) * 3 }
}

// Element symbols (symbols only) drifting in the thin strip under the name.
const SYMS = ['Br', 'Ba', 'C', 'H', 'O', 'N', 'Na', 'Cl', 'S', 'Fe']
export const elementRain = (x: number, y: number, w: number, t: Th, font: string): string => {
  const n = Math.max(2, Math.min(SYMS.length, Math.floor(w / 20)))
  return Array.from({ length: n }, (_, i) => `<text class="bbg" style="animation-delay:${(-i * 0.7).toFixed(1)}s" x="${(x + i * (w / n)).toFixed(1)}" y="${y}" font-family="${font}" font-size="7" font-weight="700" letter-spacing=".6" fill="${t.accent}" fill-opacity=".6">${SYMS[i]}</text>`).join('')
}

// --- Purity: the band's ticker. 96.2% with nothing done, 99.1% with every step ---
export const purityOf = (done: number, total: number): number => +(96.2 + 2.9 * (total > 0 ? Math.max(0, Math.min(1, done / total)) : 0)).toFixed(1)
const diamond = (cx: number, cy: number, r: number): string => `M${cx} ${cy - r}L${cx + r * 0.75} ${cy}L${cx} ${cy + r}L${cx - r * 0.75} ${cy}Z`
export const PURITY_W = 148
export const purityTicker = (x: number, y: number, isWorking: boolean, done: number, total: number, t: Th, font: string): string => {
  const slots = Math.max(1, Math.min(6, total || 6))
  const filled = total ? Math.min(slots, Math.round((done / total) * slots)) : 0
  const cells = Array.from({ length: slots }, (_, i) => {
    const cx = x + 96 + i * 8 + 3
    const on = i < filled
    return `<path${i === filled && isWorking ? ' class="bbp"' : ''} d="${diamond(cx, y - 4, 4)}" fill="${on ? BLUE : 'none'}" stroke="${BLUE}" stroke-opacity="${on ? 1 : 0.5}" stroke-width=".9"/>`
  }).join('')
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="9" font-weight="800" letter-spacing=".6" fill="${t.muted}">PURITY</text><text x="${x + 44}" y="${y}" font-family="${font}" font-size="10" font-weight="800" font-variant-numeric="tabular-nums" fill="${isWorking ? BLUE : t.subtext}">${purityOf(done, total).toFixed(1)}%</text>${cells}`
}

// --- Lab Notes: a few deterministic lines about the task in hand ---
const NOTES = [
  'Respect the chemistry.',
  'No half measures on {task}.',
  'Tread lightly.',
  'Apply yourself.',
  'The chemistry checks out.',
  'Better call Saul.',
  'Jesse, we need to talk.',
  '{task} is not a hobby. It is an empire.',
  'Say my name.',
  'Stay out of my territory.',
  'We are done when I say we are done.',
  'Clean the lab before you leave.',
  'Check the margins on {task}.',
  'I am the one who ships {task}.',
  'Get it right the first time.',
]
export const labNotes = (task: string, n = 3): string[] => {
  const t = task.replace(/\s+/g, ' ').trim()
  const short = t ? clipW(t, 12, 200) : 'this'
  const seed = t || 'idle'
  const picked: number[] = []
  for (let i = 0; picked.length < Math.min(n, NOTES.length) && i < 60; i++) {
    const at = (hashOf(`${seed}:${i}`) + i) % NOTES.length
    if (!picked.includes(at)) picked.push(at)
  }
  return picked.map(i => (NOTES[i] as string).replace(/\{task\}/g, short))
}
export const labStatus = (isWorking: boolean, done: number, total: number): string => (isWorking ? 'In the lab…' : total > 0 && done >= total ? 'Batch complete.' : 'Class is in session.')

export const LAB_H = 128
export const labNotesCard = (W: number, task: string, isWorking: boolean, done: number, total: number, t: Th, font: string, frame: Frame, isHeisenberg = false): string => {
  const lines = labNotes(task, 3)
  const room = W - 36 - 24
  const body = lines.map((l, i) => `<text x="18" y="${52 + i * 19}" font-family="${font}" font-size="12.5" font-style="italic" fill="${t.text}" fill-opacity="${1 - i * 0.12}">› ${esc(clipW(l, 12.5, room))}</text>`).join('')
  const tiles = elementTiles(W - 14 - (TILES.length * TILE + 3), 25, t, font)
  const status = labStatus(isWorking, done, total)
  const titleW = textW('LAB NOTES', 14, 0.8)
  const showStatus = 25 + titleW + 12 + textW(status, 10) < W - 14 - 40 - 8
  const slots = 20
  const filled = Math.round(((purityOf(done, total) - 96.2) / 2.9) * slots)
  const barX = 72
  const barW = Math.max(40, W - barX - 70)
  const seg = barW / slots
  const bar = Array.from({ length: slots }, (_, i) => `<rect${i === filled && isWorking ? ' class="bbp"' : ''} x="${(barX + i * seg).toFixed(1)}" y="108" width="${Math.max(1, seg - 1.5).toFixed(1)}" height="8" rx="1" fill="${i < filled ? BLUE : t.track}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LAB_H}" viewBox="0 0 ${W} ${LAB_H}"><style>${BB_CSS}</style>
${frame(0.5, 0.5, W - 1, LAB_H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".35"`, 10)}
${isHeisenberg ? hat(W - 70, 56, 40, 0.1) : ''}
<rect x="16" y="11" width="3" height="14" fill="${t.accent}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${t.text}">LAB NOTES</text>
${showStatus ? `<text x="${25 + titleW + 12}" y="22.5" font-family="${font}" font-size="10" font-style="italic" fill="${isWorking ? t.accent : t.subtext}">${esc(status)}</text>` : ''}
${tiles.svg}
${body}
<text x="18" y="116" font-family="${font}" font-size="9" font-weight="800" letter-spacing=".6" fill="${t.muted}">PURITY</text>
${bar}
<text x="${W - 18}" y="116.5" text-anchor="end" font-family="${font}" font-size="12" font-weight="800" font-variant-numeric="tabular-nums" fill="${t.accent}">${purityOf(done, total).toFixed(1)}%</text>
</svg>`
}

// --- Context chip: no half measures, then say my name ---
export const crystalChip = (x: number, y: number, ctxPct: number, t: Th, font: string): { svg: string; w: number } => {
  if (ctxPct < 85) return { svg: '', w: 0 }
  const isName = ctxPct >= 95
  const label = isName ? 'SAY MY NAME' : 'NO HALF MEASURES'
  const fill = isName ? t.alert : t.warn
  const w = textW(label, 9.5, 0.5) + 14
  return {
    w,
    svg: `<g class="bbchip"><rect x="${x}" y="${y - 10}" width="${w}" height="13" rx="2" fill="${fill}"/><text x="${x + w / 2}" y="${y - 0.5}" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="800" letter-spacing=".5" fill="${inkOn(fill)}">${label}</text></g>`,
  }
}
export const BB_WARNING = (_ctx: number): string => '⚗︎ Context nearly full: tread lightly. /compact'

// --- DEA heat: Hank's badge stars, up to five ---
const starPath = (cx: number, cy: number, r: number): string => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.45
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}
export const deaStars = (x: number, y: number, level: number, t: Th): string => {
  const lit = Math.max(0, Math.min(5, Math.round(level)))
  return Array.from({ length: 5 }, (_, i) => {
    const on = i < lit
    return `<path${on && lit === 5 ? ' class="bbheat"' : ''} d="${starPath(x + 4 + i * 9, y - 3.5, 4.2)}" fill="${on ? YELLOW : t.muted}" fill-opacity="${on ? 1 : 0.45}"/>`
  }).join('')
}
// Time spent also raises the heat: a star at 1, 5, 15, 30 and 60 minutes.
export const timeStars = (ms: number): number => (ms >= 3_600_000 ? 5 : ms >= 1_800_000 ? 4 : ms >= 900_000 ? 3 : ms >= 300_000 ? 2 : ms >= 60_000 ? 1 : 0)

// --- The desert skyline: mesas, flat sand, the RV and a chicken sign on a pole ---
export const desertSkyline = (W: number, y0: number, h: number, t: Th): string => {
  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const base = y0 + h
  const mesas: string[] = []
  let x = 0
  while (x < W) {
    const w = 26 + Math.floor(rnd() * 46)
    const th = 4 + Math.floor(rnd() * Math.max(1, h - 6))
    mesas.push(`M${x} ${base}L${x + 3} ${base - th}H${x + w - 3}L${x + w} ${base}Z`)
    x += w + 6 + Math.floor(rnd() * 30)
  }
  const rvx = Math.round(W * 0.34)
  const sx = Math.round(W * 0.86)
  const camper = `<g opacity=".6"><rect x="${rvx}" y="${base - 8}" width="16" height="6" rx="1" fill="#D8DDD0"/><rect x="${rvx + 11}" y="${base - 7}" width="3" height="2" fill="${BLUE}"/><rect class="bbwin" x="${rvx + 2}" y="${base - 7}" width="3" height="2" fill="${YELLOW}"/><circle cx="${rvx + 4}" cy="${base - 1.6}" r="1.5" fill="#101410"/><circle cx="${rvx + 12}" cy="${base - 1.6}" r="1.5" fill="#101410"/></g>`
  // A generic fried-chicken sign: a round bird on a pole (a head, a comb, a beak), no lettering.
  const sign = `<g opacity=".6"><rect x="${sx}" y="${base - 11}" width="1" height="11" fill="#6B7A6F"/><ellipse cx="${sx + 0.5}" cy="${base - 14}" rx="4" ry="3" fill="${YELLOW}"/><circle cx="${sx + 3.6}" cy="${base - 17}" r="1.6" fill="${YELLOW}"/><rect x="${sx + 3.2}" y="${base - 19}" width="1" height="1.2" fill="${t.alert}"/><path d="M${sx + 5} ${base - 17}l1.8 .6l-1.8 .6z" fill="#E88A2E"/></g>`
  return `<g opacity=".3" fill="#2A4A38"><path d="${mesas.join('')}"/><rect x="0" y="${base - 1.5}" width="${W}" height="1.5"/></g>${camper}${sign}`
}

// --- Crystal sparkle: blue afterimages and glints trailing a working figure ---
export const crystalGlints = (figure: string, box: { x: number; y: number; w: number; h: number }): { defs: string; svg: string } => {
  const f = id('bg')
  const glints = [
    [0.05, 0.2, 0],
    [0.95, 0.5, 0.6],
    [0.3, 0.9, 1.2],
  ]
    .map(([fx, fy, d]) => `<path class="bbsp" style="animation-delay:${-(d as number)}s" d="M0 -3L.7 -.7L3 0L.7 .7L0 3L-.7 .7L-3 0L-.7 -.7Z" transform="translate(${+(box.x + (fx as number) * box.w).toFixed(1)} ${+(box.y + (fy as number) * box.h).toFixed(1)})" fill="#BFEBFF"/>`)
    .join('')
  return {
    defs: `<filter id="${f}"><feColorMatrix type="matrix" values="0.2 0 0 0 0.2  0 0.6 0 0 0.45  0 0 0.9 0 0.55  0 0 0 1 0"/></filter>`,
    svg:
      [8, 5, 2].map((dx, i) => `<g class="bbs" style="animation-delay:${-i * 0.2}s" opacity="${(0.1 + i * 0.08).toFixed(2)}" filter="url(#${f})" transform="translate(${-dx} 0)">${figure}</g>`).join('') + glints,
  }
}

// --- Title glitch: now and then the task's title flickers to HEISENBERG ---
export const heisenbergGlitch = (x: number, y: number, text: string, attrs: string, titleW: number): string => {
  const alt = 'HEISENBERG'
  // The word is wider than a short title: then it would run into the status pill, so the title stays.
  if (textW(alt, 13) > titleW) return `<text x="${x}" y="${y}" ${attrs}>${esc(text)}</text>`
  return `<text class="bbt" x="${x}" y="${y}" ${attrs}>${esc(text)}</text><text class="bbh" x="${x}" y="${y}" ${attrs.replace(/fill="[^"]*"/, '')} fill="#F4F4F4">${alt}</text>`
}

// --- Done: the cheer, with a pixel RV in the corner for a moment ---
export const yeahScience = (W: number, H: number, font: string, t: Th, startAt?: number): string => {
  const at = startAt ? pin(startAt) : '0s'
  const label = 'YEAH, SCIENCE!'
  const w = textW(label, 15, 1.5) + 30
  return `<g class="bbcheer" style="animation-delay:${at}"><rect x="${(W - w) / 2}" y="${H / 2 - 13}" width="${w}" height="24" fill="${t.accent}" transform="rotate(-1.5 ${W / 2} ${H / 2})"/>
<text x="${W / 2}" y="${H / 2 + 5}" text-anchor="middle" font-family="${font}" font-size="15" font-weight="800" letter-spacing="1.5" fill="${inkOn(t.accent)}" transform="rotate(-1.5 ${W / 2} ${H / 2})">${label}</text></g>
${rv(W - 34, H - 22, 18, 1, 'bbrv').replace('<g class="bbrv"', `<g class="bbrv" style="animation-delay:${at}"`)}`
}

// --- Empire Cred: a chemistry exam page, not a ladder of medals ---
// Progress is purity (it rises batch by batch and never quite reaches 100), the rank is a
// title from Walt's arc, the grade is written in red pen, a flask fills towards the next
// rank, and each badge is an element you discover on a periodic-table row.
const RANKS: [number, string][] = [
  [20, 'Blue Sky'], [15, 'Empire Business'], [12, 'Kingpin'], [9, 'Distributor'], [7, 'Heisenberg'], [5, 'The Professor'], [4, 'Cook'], [3, 'Partner'], [2, 'Car Wash Cashier'], [1, 'Chemistry Teacher'],
]
export const empireRankOf = (level: number): string => (RANKS.find(([from]) => level >= from) ?? (RANKS[RANKS.length - 1] as [number, string]))[1]
export const empireToast = (level: number): string => `EMPIRE CRED ↑ ${level} · ${empireRankOf(level)}`
const GRADES = ['D', 'C-', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A', 'A+']
export const gradeOf = (level: number): string => (level >= 12 ? 'A+' : (GRADES[Math.max(1, level) - 1] as string))
// Purity from the batches finished: 88% to begin with, 99.1% as the limit.
export const purityOfCred = (jobs: number): number => +(88 + 11.1 * (1 - 0.95 ** Math.max(0, jobs))).toFixed(1)
// The element each badge id discovers: symbol, atomic number, and what finds it.
const ELEMENTS: Record<string, [string, string, string, string]> = {
  choom: ['Br', '35', 'FIRST BATCH', 'Finish your first batch'],
  merc: ['Ba', '56', 'PARTNER', 'Finish 10 batches'],
  edgerunner: ['Au', '79', 'THE ONE WHO KNOCKS', 'Finish 50 batches'],
  legend: ['Pt', '78', 'FULL MEASURE', '10 long batches (3+ minutes each)'],
  netrunner: ['Na', '11', 'THE ORGANIZATION', 'Call 100 sub-agents'],
  crewboss: ['Fe', '26', 'HAZMAT CREW', 'Run a batch with 5+ sub-agents'],
  chromed: ['Cl', '17', 'NO HALF MEASURES', 'Push the context past 90%'],
  owl: ['Si', '14', 'NIGHT SHIFT', 'Finish a batch after midnight'],
  samurai: ['He', '2', 'SAY MY NAME', 'Find the secret skin'],
}
export const EMPIRE_BADGES: Badge[] = BADGES.map(b => {
  const e = ELEMENTS[b.id]
  return e ? { ...b, name: e[2], icon: e[0], how: e[3] } : b
})
export const EMPIRE_WORDS: CredWords = { badges: EMPIRE_BADGES, cases: 'BATCHES', long: 'LONG BATCHES', all: 'EVERY ELEMENT FOUND. YEAH, SCIENCE!' }

const EL_TILE = 30
const elPer = (W: number): number => Math.max(1, Math.floor((W - 36 + 5) / (EL_TILE + 5)))
export const empireHeight = (W: number): number => 158 + Math.ceil(BADGES.length / elPer(W)) * (EL_TILE + 6) + 30
export const empireCard = (W: number, c: Cred, t: Th, font: string, frame: Frame): string => {
  const H = empireHeight(W)
  const level = levelOf(c.xp)
  const from = xpFor(level)
  const span = xpFor(level + 1) - from
  const f = Math.max(0, Math.min(1, (c.xp - from) / span))
  const fid = id('fl')
  const FLASK = 'M43 44h12v22l19 42q3 9-6 9H30q-9 0-6-9l19-42z'
  const liquidY = 120 - f * 50
  const rank = empireRankOf(level)
  const textX = 92
  const room = Math.max(40, W - textX - 84)
  const found = BADGES.filter(b => c.badges.includes(b.id))
  const rules = Array.from({ length: 5 }, (_, i) => `<line x1="14" y1="${58 + i * 18}" x2="${W - 14}" y2="${58 + i * 18}" stroke="${t.line}" stroke-opacity=".5"/>`).join('')
  const per = elPer(W)
  const tiles = BADGES.map((b, i) => {
    const e = ELEMENTS[b.id] as [string, string, string, string]
    const x = 18 + (i % per) * (EL_TILE + 5)
    const y = 168 + Math.floor(i / per) * (EL_TILE + 6)
    return c.badges.includes(b.id)
      ? `<rect x="${x}" y="${y}" width="${EL_TILE}" height="${EL_TILE}" rx="2" fill="${GREEN}"><title>${esc(e[2])}</title></rect><text x="${x + 3}" y="${y + 9}" font-family="${font}" font-size="7.5" font-weight="700" fill="${inkOn(GREEN)}" fill-opacity=".85">${e[1]}</text><text x="${x + EL_TILE / 2}" y="${y + 24}" text-anchor="middle" font-family="${font}" font-size="14" font-weight="800" fill="${inkOn(GREEN)}">${e[0]}</text>`
      : `<rect x="${x + 0.5}" y="${y + 0.5}" width="${EL_TILE - 1}" height="${EL_TILE - 1}" rx="2" fill="none" stroke="${t.muted}" stroke-opacity=".6" stroke-dasharray="3 3"/><text x="${x + EL_TILE / 2}" y="${y + 21}" text-anchor="middle" font-family="${font}" font-size="14" font-weight="700" fill="${t.muted}">?</text>`
  }).join('')
  const next = BADGES.find(b => !c.badges.includes(b.id))
  const hint = next ? `Next: ${(ELEMENTS[next.id] as string[])[0]} · ${(ELEMENTS[next.id] as string[])[3]}` : 'Every element found. Yeah, science!'
  const toGo = Math.max(0, xpFor(level + 1) - c.xp)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${BB_CSS}</style>
${frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".3"`, 10)}
${rules}
<rect x="16" y="11" width="3" height="14" fill="${t.accent}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${t.text}">EMPIRE CRED</text>
<defs><clipPath id="${fid}"><path d="${FLASK}"/></clipPath></defs>
<g clip-path="url(#${fid})"><rect x="20" y="${liquidY.toFixed(1)}" width="60" height="${(120 - liquidY + 2).toFixed(1)}" fill="${BLUE}" fill-opacity=".8"/><rect x="20" y="${liquidY.toFixed(1)}" width="60" height="1.5" fill="#BFEBFF"/><circle class="bbp" cx="46" cy="${(liquidY + 12).toFixed(1)}" r="1.6" fill="#BFEBFF"/><circle class="bbp" style="animation-delay:-.5s" cx="56" cy="${(liquidY + 6).toFixed(1)}" r="1.2" fill="#BFEBFF"/></g>
<path d="${FLASK}" fill="none" stroke="${t.subtext}" stroke-width="1.6" stroke-linejoin="round"/>
<line x1="40" y1="44" x2="58" y2="44" stroke="${t.subtext}" stroke-width="1.6"/>
<text x="${textX}" y="72" font-family="${font}" font-size="19" font-weight="700" font-style="italic" fill="${t.text}">${esc(clipW(rank, 19, room))}</text>
<text x="${textX}" y="92" font-family="${font}" font-size="12" fill="${t.subtext}">Level ${level} · ${c.xp} XP · ${found.length}/${BADGES.length} elements</text>
<text x="${textX}" y="112" font-family="${font}" font-size="13" font-weight="800" font-variant-numeric="tabular-nums" fill="${BLUE}">Purity ${purityOfCred(c.jobs).toFixed(1)}%</text>
<text x="${textX}" y="132" font-family="${font}" font-size="11" fill="${t.muted}">${esc(clipW(`${toGo} XP to ${empireRankOf(level + 1)}`, 11, W - textX - 18))}</text>
<g transform="rotate(-8 ${W - 44} 42)"><circle cx="${W - 44}" cy="42" r="21" fill="none" stroke="${t.alert}" stroke-width="2"/><text x="${W - 44}" y="50" text-anchor="middle" font-family="${font}" font-size="22" font-weight="800" font-style="italic" fill="${t.alert}">${gradeOf(level)}</text></g>
<text x="18" y="156" font-family="${font}" font-size="9.5" font-weight="800" letter-spacing=".6" fill="${t.muted}">ELEMENTS DISCOVERED</text>
${tiles}
<text x="18" y="${H - 12}" font-family="${font}" font-size="11" font-style="italic" fill="${t.subtext}">${esc(clipW(hint, 11, W - 36))}</text>
</svg>`
}

// --- Lab Log: the last tool calls, written up as notebook lines ---
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LOG_ROWS = 7
const LOG_ROW = 19
export const labLogHeight = (n: number): number => 46 + Math.max(1, Math.min(LOG_ROWS, n)) * LOG_ROW + 12
export const labLogCard = (W: number, beats: Beat[], t: Th, font: string, frame: Frame): string => {
  const shown = beats.slice(-LOG_ROWS)
  const H = labLogHeight(shown.length)
  const last = beats[beats.length - 1]
  const d = last ? new Date(last.at) : undefined
  const date = d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : ''
  const hm = (at: number) => `${String(new Date(at).getHours()).padStart(2, '0')}:${String(new Date(at).getMinutes()).padStart(2, '0')}`
  const verbX = 80
  const rows = shown.length
    ? shown
        .map((b, i) => {
          const y = 62 + i * LOG_ROW
          const isNow = i === shown.length - 1
          const verb = BB_TOOLS[b.tool] ?? b.tool
          const vw = textW(verb, 11.5) + 8
          return `<line x1="14" y1="${y + 5}" x2="${W - 14}" y2="${y + 5}" stroke="${t.line}" stroke-opacity=".6"/>
<text x="38" y="${y}" font-family="${font}" font-size="12" font-weight="800" fill="${isNow ? BLUE : GREEN}">${isNow ? '✎' : '✓'}</text>
<text x="52" y="${y}" font-family="${font}" font-size="10.5" font-variant-numeric="tabular-nums" fill="${t.muted}">${hm(b.at)}</text>
<text x="${verbX + 10}" y="${y}" font-family="${font}" font-size="11.5" font-weight="700" fill="${t.text}">${esc(clipW(verb, 11.5, 90))}</text>
<text x="${verbX + 10 + Math.min(vw, 98)}" y="${y}" font-family="${font}" font-size="11.5" font-style="italic" fill="${t.subtext}">${esc(clipW(b.text, 11.5, Math.max(0, W - verbX - 10 - Math.min(vw, 98) - 20)))}</text>`
        })
        .join('')
    : `<text x="38" y="62" font-family="${font}" font-size="12" font-style="italic" fill="${t.muted}">Nothing written yet. Start the first batch.</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${BB_CSS}</style>
${frame(0.5, 0.5, W - 1, H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".3"`, 10)}
<line x1="30" y1="34" x2="30" y2="${H - 8}" stroke="${t.alert}" stroke-opacity=".4"/>
<rect x="16" y="11" width="3" height="14" fill="${t.accent}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${t.text}">LAB LOG</text>
<text x="${W - 14}" y="22.5" text-anchor="end" font-family="${font}" font-size="11" font-style="italic" fill="${t.subtext}">${date}</text>
${rows}
</svg>`
}

// --- Words ---
export const BB_TITLE_WORDS: string[] = ['Gray Matter', 'Half Measures', 'Full Measure', 'Better Call Saul', 'Say My Name', 'Green Light', 'Live Free or Die', 'Hazard Pay', 'Crawl Space', 'Granite State', 'Felina', 'Problem Dog']
export const BB_SKIN_WORDS: string[] = ['Respecting the chemistry', 'Applying yourself', 'Calling Saul', 'Washing cars', 'Treading lightly', 'Building an empire']
export const BB_TOOLS: Record<string, string> = {
  Read: 'Study', Grep: 'Trace', Glob: 'Sort', Edit: 'Adjust', MultiEdit: 'Adjust', Write: 'Label', Bash: 'Cook', PowerShell: 'Cook',
  Agent: 'Call Saul', WebFetch: 'Pick up', WebSearch: 'Canvass ABQ', ToolSearch: 'Ask Mike',
}
export const BB_GREETING = '⚗︎ Mr. White is in the lab. Class is in session.'
export const BB_BOOT = ['OPENING THE LAB…', 'ALBUQUERQUE · NEW MEXICO · CLASS IS IN SESSION']
export const HEIS_BOOT = ['SAY MY NAME…', 'HEISENBERG · BLUE SKY · NO HALF MEASURES']
export const HEIS_GREETING = 'Say my name… Heisenberg.'
export const BATCH_TOAST = '🧪 Batch logged. 99.1% pure.'
// Typing this (with the Breaking Bad skin on) wakes the hidden skin.
export const SAY_MY_NAME_RE = /say\s+my\s+name/i
