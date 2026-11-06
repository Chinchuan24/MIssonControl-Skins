// Easter eggs for The Mentalist skin (and its hidden Red John skin): small nods a fan
// of the show will catch. A fan homage: only episode titles, short phrases and
// Blake's public-domain "The Tyger". Pure SVG strings and tables, no state: the
// hooks module decides when each shows.

import { BADGES, inkOn, textW, clipW } from './extras'
import type { Badge, CredWords, Frame } from './extras'
import { hashOf } from './cast'
import { pin } from './smooth'

type Th = { accent: string; accent2: string; done: string; warn: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }

export const RED = '#E0261F'
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- The red smiley: a ring of pixels, two eyes and a smile, a little uneven like paint ---
// 11 × 11 grid; `size` is the drawn width in px (9 to 13 reads best in the band).
const SMILE_FULL: [number, number][] = [
  // ring
  ...[3, 4, 5, 6, 7].map((x): [number, number] => [x, 0]),
  [2, 1], [8, 1], [1, 2], [9, 2],
  [0, 3], [10, 3], [0, 4], [10, 4], [0, 5], [10, 5], [0, 6], [10, 6], [0, 7], [10, 7],
  [1, 8], [9, 8], [2, 9], [8, 9],
  ...[3, 4, 5, 6, 7].map((x): [number, number] => [x, 10]),
  // eyes
  [3, 3], [3, 4], [7, 3], [7, 4],
  // smile
  [2, 6], [8, 6], ...[3, 4, 5, 6, 7].map((x): [number, number] => [x, 7]),
]
// The paint thins at a few pixels.
const SMILE_THIN = new Set(['0,4', '10,6', '4,0', '6,10', '2,9', '9,2'])
export const smiley = (x: number, y: number, size = 11, opacity = 1, cls = ''): string => {
  const p = size / 11
  const full: string[] = []
  const thin: string[] = []
  for (const [cx, cy] of SMILE_FULL) (SMILE_THIN.has(`${cx},${cy}`) ? thin : full).push(`M${cx} ${cy}h1v1h-1z`)
  return `<g${cls ? ` class="${cls}"` : ''} transform="translate(${+x.toFixed(1)} ${+y.toFixed(1)}) scale(${+p.toFixed(3)})" opacity="${opacity}" shape-rendering="crispEdges"><path d="${full.join('')}" fill="${RED}"/><path d="${thin.join('')}" fill="${RED}" fill-opacity=".65"/></g>`
}

// --- Motion ---
export const MENT_CSS = `.rjs{animation:rjs 3.6s ease-in-out infinite}@keyframes rjs{50%{opacity:.55}}
.rjb{opacity:0;animation:rjb 2.6s steps(1) both}@keyframes rjb{0%,50%{opacity:0}55%,82%{opacity:.8}86%,100%{opacity:0}}
.mflash{animation:mflash .9s steps(1) 3}@keyframes mflash{33%{opacity:.15}66%{opacity:.9}}
.tea{animation:tea 1.6s ease-in-out infinite}@keyframes tea{50%{opacity:.55}}
.cold{animation:cold 1.4s steps(1) infinite}@keyframes cold{50%{opacity:.25}}
@media (prefers-reduced-motion: reduce){.rjs,.mflash,.tea,.cold{animation:none}.rjb{animation:none;opacity:.5}}`

// --- Episode ticker: one real title an hour (the show's red episodes) ---
export const EPISODES: string[] = [
  'S1E3 Red Tide', 'S1E4 Ladies in Red', 'S1E6 Red Handed', 'S1E7 Seeing Red', 'S1E9 Flame Red', "S1E11 Red John's Friends", 'S1E12 Red Rum',
  'S1E13 Paint it Red', 'S1E14 Crimson Casanova', 'S1E15 Scarlett Fever', 'S1E16 Bloodshot', 'S1E19 A Dozen Red Roses', "S1E23 Red John's Footsteps",
  'S2E2 The Scarlet Letter', 'S2E3 Red Badge', 'S2E15 Red Herring', 'S2E16 Code Red', 'S2E17 The Red Box', 'S2E19 Blood Money', 'S2E23 Red Sky in the Morning',
  'S3E1 Red Sky at Night', 'S3E4 Red Carpet Treatment', 'S3E13 Red Alert', 'S3E16 Red Queen', 'S3E22 Rhapsody in Red',
  'S4E1 Scarlet Ribbons', 'S4E2 Little Red Book', 'S4E7 Blinking Red Light', 'S4E11 Always Bet on Red', 'S4E21 Ruby Slippers', 'S4E23 Red Rover, Red Rover', 'S4E24 The Crimson Hat',
  'S5E5 Red Dawn', 'S5E6 Cherry Picked', 'S5E10 Panama Red', 'S5E12 Little Red Corvette', "S5E22 Red John's Rules", 'S6E3 Wedding in Red', 'S6E8 Red John',
]
// After the reveal the titles change colour: the Red John skin plays them as if he had erased the red.
export const AFTER_RED: string[] = ['S6E9 My Blue Heaven', 'S6E10 Green Thumb', 'S6E22 Blue Bird', 'S7E1 Nothing But Blue Skies', 'S7E13 White Orchids']
export const episodeAt = (at: number, isRedJohn = false): string => {
  const hour = Math.floor(at / 3_600_000)
  const list = isRedJohn ? AFTER_RED : EPISODES
  return `${isRedJohn ? '☺ ' : '▶︎ '}${list[hour % list.length] as string}`
}

// --- Cold Read: playful mind-reading about the task in hand ---
const TEMPLATES = [
  'You want this done yesterday.',
  'You already know the answer to {task}. You want proof.',
  'Third coffee? Try tea.',
  'You have been putting {task} off since Tuesday.',
  'You read the error twice before you believed it.',
  'Someone said it was a small change. It was not.',
  'You have a theory. You are afraid it is right.',
  'You checked the clock just now.',
  'You will say "one more thing" before this ends.',
  'There is a tab open you swore you would close.',
  'You trust the tests. You trust me a little less.',
  'You are smiling a bit. Good sign for {task}.',
  'The hard part of {task} is not the code.',
  'You named a variable at 2 a.m. You regret it.',
  'It worked on your machine.',
]
export const coldReads = (task: string, n = 3): string[] => {
  const t = task.replace(/\s+/g, ' ').trim()
  const short = t ? clipW(t, 12, 200) : 'this'
  const seed = t || 'idle'
  const picked: number[] = []
  for (let i = 0; picked.length < Math.min(n, TEMPLATES.length) && i < 60; i++) {
    const at = (hashOf(`${seed}:${i}`) + i) % TEMPLATES.length
    if (!picked.includes(at)) picked.push(at)
  }
  return picked.map(i => (TEMPLATES[i] as string).replace(/\{task\}/g, short))
}
export const readStatus = (isWorking: boolean, done: number, total: number): string => (isWorking ? 'Reading…' : total > 0 && done >= total ? 'Got you.' : 'Waiting for a subject.')

// The band's little ticker: the label, the status, the steps as dots.
// The label is set in the skin's serif caps, wider than the sans the measure assumes:
// the status starts well clear of it.
export const COLD_W = 184
export const coldTicker = (x: number, y: number, isWorking: boolean, done: number, total: number, t: Th, font: string): string => {
  const slots = Math.max(1, Math.min(6, total || 6))
  const filled = total ? Math.min(slots, Math.round((done / total) * slots)) : 0
  const dots = Array.from({ length: slots }, (_, i) => `<circle${i === filled && isWorking ? ' class="cold"' : ''} cx="${x + 140 + i * 7 + 2.5}" cy="${y - 3}" r="2.4" fill="${i < filled ? t.accent : 'none'}" stroke="${t.accent}" stroke-opacity="${i < filled ? 1 : 0.55}"/>`).join('')
  const status = readStatus(isWorking, done, total)
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="9" font-weight="800" letter-spacing=".6" fill="${t.muted}">COLD READ</text><text x="${x + 80}" y="${y}" font-family="${font}" font-size="9.5" font-style="italic" fill="${isWorking ? t.accent : t.subtext}">${esc(clipW(status, 9.5, 54))}</text>${dots}`
}

export const COLD_H = 124
// A card of the reading: 2-3 fake mind-reads about the current task.
export const coldReadCard = (W: number, task: string, isWorking: boolean, done: number, total: number, t: Th, font: string, frame: Frame, watermark = false): string => {
  const lines = coldReads(task, 3)
  const room = W - 36 - 40
  const body = lines.map((l, i) => `<text x="18" y="${54 + i * 20}" font-family="${font}" font-size="12.5" font-style="italic" fill="${t.text}" fill-opacity="${1 - i * 0.12}">› ${esc(clipW(l, 12.5, room))}</text>`).join('')
  const status = readStatus(isWorking, done, total)
  const eye = `<g transform="translate(${W - 44} 12)"><path d="M0 7Q13 -4 26 7Q13 18 0 7Z" fill="none" stroke="${t.accent}" stroke-width="1.4"/><circle cx="13" cy="7" r="3.4" fill="${t.accent}"${isWorking ? ' class="cold"' : ''}/></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${COLD_H}" viewBox="0 0 ${W} ${COLD_H}"><style>${MENT_CSS}</style>
${frame(0.5, 0.5, W - 1, COLD_H - 1, `fill="${t.tile}" stroke="${t.accent}" stroke-opacity=".35"`, 10)}
${watermark ? smiley(W - 78, COLD_H - 62, 44, 0.12) : ''}
<rect x="16" y="11" width="3" height="14" fill="${t.accent}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${t.text}">COLD READ</text>
<text x="${25 + textW('COLD READ', 14, 0.8) + 12}" y="22.5" font-family="${font}" font-size="10" font-style="italic" fill="${isWorking ? t.accent : t.subtext}">${esc(status)}</text>
${eye}
${body}
</svg>`
}

// --- Needs tea / Red John is watching: the context chip ---
export const teaChip = (x: number, y: number, ctxPct: number, t: Th, font: string): { svg: string; w: number } => {
  if (ctxPct < 85) return { svg: '', w: 0 }
  const isWatching = ctxPct >= 95
  const label = isWatching ? 'RED JOHN IS WATCHING ☺' : 'NEEDS TEA ☕︎'
  const fill = isWatching ? RED : t.warn
  const w = textW(label, 9.5, 0.5) + 14
  return {
    w,
    svg: `<g class="tea"><rect x="${x}" y="${y - 10}" width="${w}" height="13" rx="2" fill="${fill}"/><text x="${x + w / 2}" y="${y - 0.5}" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="800" letter-spacing=".5" fill="${inkOn(fill)}">${label}</text></g>`,
  }
}
export const TEA_WARNING = (ctx: number): string => `☕ Context nearly full (${ctx}%): time for a cup of tea. /compact`

// --- Case Closed: the cheer when a job is done, with the smiley in a corner, briefly ---
export const caseClosed = (W: number, H: number, font: string, t: Th, startAt?: number): string => {
  const at = startAt ? pin(startAt) : '0s'
  const label = "CASE CLOSED · TEA'S ON"
  const w = textW(label, 15, 1.5) + 30
  return `<g class="mflash" style="animation-delay:${at}"><rect x="${(W - w) / 2}" y="${H / 2 - 13}" width="${w}" height="24" fill="${t.accent}" transform="rotate(-1.5 ${W / 2} ${H / 2})"/>
<text x="${W / 2}" y="${H / 2 + 5}" text-anchor="middle" font-family="${font}" font-size="15" font-weight="800" letter-spacing="1.5" fill="${inkOn(t.accent)}" transform="rotate(-1.5 ${W / 2} ${H / 2})">${esc(label)}</text></g>
${smiley(W - 26, H - 22, 10, 1, 'rjb').replace('<g class="rjb"', `<g class="rjb" style="animation-delay:${at}"`)}`
}

// The hidden egg on The Mentalist: faint, in the band's corner, only when a job runs past
// its time budget or the context is past 95%.
export const hiddenSmiley = (W: number, H: number): string => smiley(W - 26, H - 21, 9, 0.2, 'rjs')

// --- CBI Cred: the ladder, the badges and the words ---
const RANKS: [number, string][] = [
  [20, 'The Mentalist'], [14, 'FBI Consultant'], [10, 'Serious Crimes'], [8, "CBI's Finest"], [6, 'Couch Legend'], [5, 'Senior Consultant'], [4, 'Consultant'], [3, 'Fake Psychic'], [2, 'Boy Wonder'], [1, 'Carnival Kid'],
]
export const cbiRankOf = (level: number): string => (RANKS.find(([from]) => level >= from) ?? (RANKS[RANKS.length - 1] as [number, string]))[1]
const CBI_NAMES: Record<string, [string, string, string]> = {
  choom: ['FIRST CASE', '✦', 'Close your first case'],
  merc: ['CBI REGULAR', '◆', 'Close 10 cases'],
  edgerunner: ['CLOSER', '★', 'Close 50 cases'],
  legend: ['LONG CON', '♛', '10 long cases (3+ minutes each)'],
  netrunner: ['THE TEAM', '⌁', 'Call 100 sub-agents'],
  crewboss: ['ALL HANDS', '⚑', 'Run a case with 5+ sub-agents'],
  chromed: ['NEEDS TEA', '♨', 'Push the context past 90%'],
  owl: ['NIGHT SHIFT', '☾', 'Close a case after midnight'],
  samurai: ['TYGER TYGER', '☺', 'Find the secret skin'],
}
export const CBI_BADGES: Badge[] = BADGES.map(b => {
  const n = CBI_NAMES[b.id]
  return n ? { ...b, name: n[0], icon: n[1], how: n[2] } : b
})
export const CBI_WORDS: CredWords = { badges: CBI_BADGES, cases: 'CASES', long: 'LONG CASES', all: "EVERY BADGE EARNED. TEA'S ON." }
export const cbiToast = (level: number): string => `CBI CRED ↑ ${level} · ${cbiRankOf(level)}`

// --- Words ---
export const MENTALIST_WORDS: string[] = [
  'Red Herring', 'Code Red', 'Red Alert', 'Little Red Book', 'Red Queen', 'Red Dawn', 'Cherry Picked', 'Blinking Red Light', 'Always Bet on Red', 'Ruby Slippers', 'Scarlet Ribbons', 'Red Carpet Treatment',
  'Reading the room', 'Cold reading', 'Brewing tea', 'Palming a card', 'Building a memory palace', 'Napping on the couch',
]
export const MENTALIST_TOOLS: Record<string, string> = {
  Read: 'Read the room', Grep: 'Cold read', Glob: 'Sift', Edit: 'Amend', MultiEdit: 'Amend', Write: 'Note', Bash: 'Palm', PowerShell: 'Palm',
  Agent: 'Brief the team', WebFetch: 'Pull the file', WebSearch: 'Canvass', ToolSearch: 'Ask around',
}
export const MENTALIST_GREETING = "☕ Jane's on the couch. CBI Serious Crimes is open."
export const MENTALIST_BOOT = ['OPENING THE CASE FILE…', 'CBI · SERIOUS CRIMES UNIT · SACRAMENTO · CONSULTANT ON SITE']
export const REDJOHN_BOOT = ['TYGER TYGER…', '☺ BURNING BRIGHT · FEARFUL SYMMETRY']
export const REDJOHN_GREETING = 'Tyger Tyger, burning bright…'
export const CLOSED_FILES_TOAST = '🗂 Case filed with the CBI'
// Typing this (with the Mentalist skin on) wakes the hidden skin.
export const TYGER_RE = /tyger\s+tyger/i
