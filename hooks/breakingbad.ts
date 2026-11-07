// Easter eggs for the Breaking Bad skin (and its hidden Heisenberg skin): small nods a
// fan of the show will catch. A fan homage to AMC / Sony Pictures Television: only
// episode titles, short phrases and the periodic table. "Cook", "blue" and "purity" are
// show flavour only: nothing here describes how to make anything. Pure SVG strings and
// tables, no state: the hooks module decides when each shows.

import { BADGES, inkOn, textW, clipW } from './extras'
import type { Badge, CredWords } from './extras'
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
.bbchip{animation:bbchip 1.6s ease-in-out infinite}@keyframes bbchip{50%{opacity:.62}}
.bbright{transform-box:fill-box;transform-origin:left center;animation:bbright .45s cubic-bezier(.2,.9,.3,1.25) both}@keyframes bbright{0%{opacity:0;transform:scale(1.35)}55%{opacity:1}100%{opacity:1;transform:scale(1)}}
.onair{animation:onair 1.4s ease-in-out infinite}@keyframes onair{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.bbp,.bbs,.bbsp,.bbg,.bbt,.bbheat,.bbwin,.bbcheer,.bbhat,.bbchip,.bbright,.onair{animation:none}.bbh{animation:none;opacity:0}.bbrv{animation:none;opacity:.5}.bbsp{opacity:.5}.bbg{opacity:.5}}`

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
export const bbEpisodeAt = (at: number): string => BB_EPISODES[Math.floor(at / 3_600_000) % BB_EPISODES.length] as string

// --- Purity (flavour only): 96.2% with nothing done, 99.1% with every step ---
export const purityOf = (done: number, total: number): number => +(96.2 + 2.9 * (total > 0 ? Math.max(0, Math.min(1, done / total)) : 0)).toFixed(1)
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

export const BB_WARNING = (_ctx: number): string => 'Context nearly full: tread lightly. /compact'

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
// The element each badge id discovers: symbol, atomic number, and what finds it.
export const ELEMENTS: Record<string, [string, string, string, string]> = {
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

// --- Words ---
export const BB_TITLE_WORDS: string[] = ['Gray Matter', 'Half Measures', 'Full Measure', 'Better Call Saul', 'Say My Name', 'Green Light', 'Live Free or Die', 'Hazard Pay', 'Crawl Space', 'Granite State', 'Felina', 'Problem Dog']
export const BB_SKIN_WORDS: string[] = ['Respecting the chemistry', 'Applying yourself', 'Calling Saul', 'Washing cars', 'Treading lightly', 'Building an empire']
export const BB_TOOLS: Record<string, string> = {
  Read: 'Study', Grep: 'Trace', Glob: 'Sort', Edit: 'Adjust', MultiEdit: 'Adjust', Write: 'Label', Bash: 'Cook', PowerShell: 'Cook',
  Agent: 'Call Saul', WebFetch: 'Pick up', WebSearch: 'Canvass ABQ', ToolSearch: 'Ask Mike',
}
export const BB_GREETING = 'Mr. White is in the lab. Class is in session.'
export const BB_BOOT = ['OPENING THE LAB…', 'ALBUQUERQUE · NEW MEXICO · CLASS IS IN SESSION']
export const HEIS_BOOT = ['SAY MY NAME…', 'HEISENBERG · BLUE SKY · NO HALF MEASURES']
export const HEIS_GREETING = 'Say my name… Heisenberg.'
// The line that lands when the phrase turns Breaking Bad into Heisenberg: a toast, then a chip on the band for 6 s.
export const BB_RIGHT = "You're goddamn right!"
export const BB_REVEAL_MS = 6000
export const BATCH_TOAST = (task: string): string => `On the honor roll: ${task}`
// Typing this (with the Breaking Bad skin on) wakes the hidden skin.
// The Heisenberg unlock phrases: "say my name", or "what's my name" (also whats / wats / wat's / what is, straight or curly
// apostrophe, any spacing). Whole words only, so "somewhat's my name" or "what's my names" do not count; surrounding
// punctuation ("?", "!", quotes) is fine.
export const SAY_MY_NAME_RE = /(?<![a-z0-9])(?:say\s+my\s+name|wh?at(?:\s*['\u2018\u2019\u02BC`\u00B4]?\s*s|\s+is)\s+my\s+name)(?![a-z0-9])/i
export function isSayMyName(text: string): boolean {
  return SAY_MY_NAME_RE.test(text)
}
