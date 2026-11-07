// Cyberpunk: Edgerunners 2 v2, the pane's cards (fan homage; the hidden CAPRICORN skin draws the same cards in her
// colours). NEURAL SYNC is the level card: Capri's engram (the ER_CAPRI_BUST pixel sprite) resolves eyes-first in a holo
// capsule as fragments are recovered. NETRUN TRACE is the tool-call log on a four-lane oscilloscope with Roman's REC
// viewfinder. CLOSED GIGS lists each closed job. Pure SVG strings, no `$`, no state. Kept lean (shared defs, merged
// pixel runs): each card stays under CARD_BUDGET characters.
import { levelOf, xpFor } from './extras'
import type { Badge, Beat, Cred } from './extras'
import type { Legend } from './eggs'
import { ER_CAPRI_BUST } from './cast'
import { CJK, ER2_FONT, ER2_TOOLS, HEX_CODES, K, M, MONO, T, brackets, beam, cardDefs, cham, clamp, er2Clip, er2W, er2Wrap, esc, mw, palOf, pane, pixels, r1, rng, streaks } from './edgerunners2'

/** What one card may weigh, in characters of SVG (the pane has a total budget too). */
export const CARD_BUDGET = 25_000

const share = (n: number, of: number): number => Math.max(0, Math.min(1, n / of))

// --- NEURAL SYNC ---------------------------------------------------------------------
export const ER2_BADGES: Badge[] = [
  { id: 'choom', name: 'FIRST SHARD', icon: '✦', how: 'Finish your first job', progress: c => share(c.jobs, 1) },
  { id: 'merc', name: 'CHOOMBA', icon: '◆', how: 'Finish 10 jobs', progress: c => share(c.jobs, 10) },
  { id: 'edgerunner', name: "KING'S CREW", icon: '♛', how: 'Finish 50 jobs', progress: c => share(c.jobs, 50) },
  { id: 'legend', name: 'BADLANDS RUN', icon: '▲', how: '10 long jobs (3+ minutes each)', progress: c => share(c.longJobs, 10) },
  { id: 'netrunner', name: 'SNAKE NATION', icon: '≈', how: 'Call 100 sub-agents', progress: c => share(c.agents, 100) },
  { id: 'crewboss', name: 'FULL CREW', icon: '⚑', how: 'Run a job with 5+ sub-agents', progress: c => share(c.crewJobs, 1) },
  { id: 'chromed', name: 'POSSESSED', icon: '✕', how: 'Push the context past 90%', progress: c => (c.chromed ? 1 : 0) },
  { id: 'owl', name: 'WATSON NIGHTS', icon: '☾', how: 'Finish a job after midnight', progress: c => share(c.nightJobs, 1) },
  { id: 'samurai', name: '0+2=1', icon: '∞', how: 'Find the secret skin', progress: c => (c.samurai ? 1 : 0) },
]
export const ER2_WORDS = { badges: ER2_BADGES, cases: 'JOBS', long: 'LONG JOBS', all: 'EVERY FRAGMENT RECOVERED.' }
/** D's arc, with no spoilers: from a signal-less nomad to Capri's host. */
export const er2RankOf = (lv: number): string => (lv >= 20 ? '0+2=1' : lv >= 15 ? "CAPRI'S HOST" : lv >= 10 ? 'CHIPPED' : lv >= 7 ? "KING'S CREW" : lv >= 4 ? 'RUNNER' : lv >= 2 ? 'SNAKE NATION' : 'NO SIGNAL')
const NEXT_RANKS: [number, string][] = [[2, 'SNAKE NATION'], [4, 'RUNNER'], [7, "KING'S CREW"], [10, 'CHIPPED'], [15, "CAPRI'S HOST"], [20, '0+2=1']]
export const er2Toast = (level: number): string => `NEURAL SYNC ↑ ${level} · ${er2RankOf(level)}`
/** SYNC %: the XP share of the next level's threshold, the same two numbers the card prints (10500 / 11550 XP is 91%). */
export const syncPct = (xp: number): number => {
  const next = xpFor(levelOf(xp) + 1)
  return clamp(Math.round((Math.max(0, xp) / next) * 100), 0, 100)
}

/** Only the motion the cards use. Each card carries its own copy; `pieces` picks the rules it needs. */
const CSS_RULES: Record<string, string> = {
  led: '.v2-led{animation:v2led 1.4s steps(1) infinite}@keyframes v2led{50%{opacity:.25}}',
  rec: '.v2-rec{animation:v2led 1.2s steps(1) infinite}',
  streak: '.v2-streak{animation:v2streak 2.8s steps(1) infinite}@keyframes v2streak{0%,100%{transform:translateX(0)}30%{transform:translateX(-5px)}31%{transform:translateX(4px)}60%{transform:translateX(2px)}61%{transform:translateX(-6px)}}',
  ring: '.v2-ring{animation:v2ring 9s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes v2ring{to{transform:rotate(360deg)}}',
  cone: '.v2-cone{animation:v2cone 3.6s ease-in-out infinite}@keyframes v2cone{50%{opacity:.55}}',
  slide: '.v2-slide{animation:v2slide .3s cubic-bezier(.2,.9,.2,1) both}@keyframes v2slide{from{transform:translateX(6px);opacity:0}}',
  sprite: '.hair{animation:v2sway 1.8s steps(1) infinite}@keyframes v2sway{50%{transform:translateX(1px)}}.vis{animation:v2vis 2.2s ease-in-out infinite}@keyframes v2vis{50%{opacity:.45}}.led{animation:v2led 1.2s steps(1) infinite}',
}
const cardCss = (...pieces: string[]): string => {
  const names = pieces.flatMap(p => (p === 'sprite' ? ['sprite'] : [p]))
  const classes = names.flatMap(p => ({ led: ['.v2-led'], rec: ['.v2-rec'], streak: ['.v2-streak'], ring: ['.v2-ring'], cone: ['.v2-cone'], slide: ['.v2-slide'], sprite: ['.hair', '.vis', '.led'] })[p] ?? [])
  return `${names.map(p => CSS_RULES[p]).join('')}@media (prefers-reduced-motion: reduce){${classes.join(',')}{animation:none}}`
}
/** Every rule the cards may carry, for the reduced-motion check. */
export const CARD_CSS = cardCss('led', 'rec', 'streak', 'ring', 'cone', 'slide', 'sprite')
const open = (W: number, H: number, css: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ER2_FONT}" style="font-variant-numeric:tabular-nums"><style>${css}</style>`

/** A card's frame: the glass pane, the accent bar, the title; `right` is more drawing at the far side. */
const cardFrame = (W: number, H: number, title: string, right: string, sec: boolean, near: boolean, sid: string): string => {
  const P = palOf(sec)
  return `${cardDefs(sid, sec)}${pane(0.5, 0.5, W - 1, H - 1, { sec, near, cut: 10, fillOp: 1, fill: P.tile, scanId: sid, nodes: true, ghost: false, sheenH: 56 })}<rect x="16" y="17" width="3" height="13" fill="${near ? K.hot : P.a}"/>${T(26, 28, title, 11, 800, P.text, 'letter-spacing="1.6"')}${right}`
}
const monoRight = (W: number, P: { muted: string }, text: string): string => (W >= 400 ? `<text x="${W - 16}" y="28" text-anchor="end" font-family="${MONO}" font-size="8.5" fill="${P.muted}" letter-spacing=".6">${text}</text>` : '')

const FRAG_W = 83
const perRow = (W: number): number => Math.max(3, Math.floor((W - 24) / 91))
const STACK_DY = 236
export const syncHeight = (W: number): number => 300 + Math.ceil(9 / perRow(W)) * 62 + 26 + (W < 400 ? STACK_DY : 0)

export const syncCard = (W: number, c: Cred, sec: boolean): string => {
  const P = palOf(sec)
  const H = syncHeight(W)
  const sid = `sc${W}${sec ? 's' : ''}`
  const level = levelOf(c.xp)
  const next = xpFor(level + 1)
  const sync = syncPct(c.xp)
  const earned = ER2_BADGES.filter(b => c.badges.includes(b.id)).length
  const stack = W < 400
  const oy = stack ? STACK_DY : 0
  const near = earned >= 9 || sec
  const nr = NEXT_RANKS.find(([l]) => l > level)
  const s: string[] = [open(W, H, cardCss('streak', 'ring', 'cone', 'sprite'))]
  s.push(cardFrame(W, H, 'NEURAL SYNC', W >= 400 ? `<text x="${W - 16}" y="28" text-anchor="end" font-family="${MONO}" font-size="8.5" fill="${P.muted}" letter-spacing=".6">ARASAKA · PROJECT CAPRICORN · <tspan font-family="${CJK}">山羊座</tspan></text>` : '', sec, false, sid))
  // The capsule.
  const cw = 168
  const cx0 = stack ? Math.max(16, Math.round((W - cw) / 2)) : 16
  const cy0 = 46
  const chh = 220
  s.push(pane(cx0, cy0, cw, chh, { sec, near, cut: 8, scanId: sid, nodes: true, fillOp: 0.95, ghost: false, shared: sid }))
  s.push(M(cx0 + 10, cy0 + 16, 'ENGRAM · CAPRI', 8, near ? K.green : P.aT, 'letter-spacing="1"'))
  s.push(M(cx0 + cw - 10, cy0 + 16, `v.${String(level).padStart(2, '0')}`, 8, P.muted, 'text-anchor="end"'))
  const mx = cx0 + cw / 2
  const fy = cy0 + 176
  s.push(`<defs><linearGradient id="${sid}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${near ? K.hot : P.a}" stop-opacity="0"/><stop offset="1" stop-color="${near ? K.hot : P.a}" stop-opacity=".2"/></linearGradient></defs>`)
  s.push(`<path class="v2-cone" d="M${mx - 60} ${cy0 + 26}L${mx + 60} ${cy0 + 26}L${mx + 40} ${fy}L${mx - 40} ${fy}Z" fill="url(#${sid}c)"/>`)
  s.push(`<g class="v2-ring"><ellipse cx="${mx}" cy="${fy + 2}" rx="56" ry="9" fill="none" stroke="${near ? K.green : P.a}" stroke-opacity=".55" stroke-dasharray="14 6"/></g><ellipse cx="${mx}" cy="${fy + 2}" rx="40" ry="6" fill="none" stroke="${near ? K.hot : P.aT}" stroke-opacity=".5"/><ellipse cx="${mx}" cy="${fy + 2}" rx="12" ry="2" fill="${near ? K.hot : P.ice}" fill-opacity=".6"/>`)
  // The bust (ER_CAPRI_BUST, 42 by 48 at 3x): the rows within `half` of the eye row resolve in colour, the rest is a wireframe.
  const bs = 3
  const bx = mx - 21 * bs
  const by = cy0 + 30
  const EYE = 27
  const half = earned === 0 ? 0 : Math.round(3 + (earned / 9) * 26)
  const from = clamp(EYE - half, 0, 48)
  const to = clamp(EYE + half + 1, 0, 48)
  if (earned === 0) {
    s.push(pixels(ER_CAPRI_BUST, bx, by, bs, { mono: P.a, op: 0.16 }))
    s.push(M(mx, by + 76, 'NO ENGRAM', 9, P.aT, 'text-anchor="middle" letter-spacing="1.4"'))
    s.push(streaks(bx, by + 20, 126, 100, 'noeng', 6, { colors: [P.a, P.ice], max: 40 }))
  } else {
    if (from > 0) s.push(pixels(ER_CAPRI_BUST, bx, by, bs, { mono: P.a, op: 0.16, rows: [0, from] }))
    if (to < 48) s.push(pixels(ER_CAPRI_BUST, bx, by, bs, { mono: P.a, op: 0.16, rows: [to, 48] }))
    s.push(pixels(ER_CAPRI_BUST, bx, by, bs, { rows: [from, to], rim: K.hot, rimOp: earned >= 9 ? 0.5 : 0.3 }))
    if (earned < 9) {
      s.push(`<rect x="${bx - 8}" y="${by + from * bs - 0.5}" width="${42 * bs + 16}" height="1" fill="${P.ice}" fill-opacity=".7"/><rect x="${bx - 8}" y="${by + to * bs - 0.5}" width="${42 * bs + 16}" height="1" fill="${P.ice}" fill-opacity=".7"/>`)
      s.push(M(bx + 42 * bs + 8, by + to * bs + 3, `${Math.round((earned / 9) * 100)}%`, 7.5, P.aT, 'text-anchor="end"'))
    }
  }
  s.push(`<rect x="${bx}" y="${by}" width="${42 * bs}" height="${48 * bs}" fill="url(#${sid})"/>`)
  s.push(T(cx0 + 12, cy0 + 205, `SYNC ${sync}%`, 15, 800, P.text))
  s.push(M(cx0 + cw - 12, cy0 + 205, `${c.xp} / ${next} XP`, 8.5, P.muted, 'text-anchor="end"'))
  s.push(beam(cx0 + 12, cy0 + 210, cw - 24, 4, sync, { sec, near }))
  // The right column (under the capsule when narrow).
  const rx = stack ? 16 : 204
  const rwid = W - 16 - rx
  const ry = stack ? cy0 + chh + 14 : cy0
  s.push(M(rx, ry + 14, 'HOST', 8.5, P.muted, 'letter-spacing="1.2"'))
  s.push(`<path d="${cham(rx + 34, ry + 2, 15, 15, 3, 1)}" fill="${P.a}"/>${T(rx + 38, ry + 14, 'D', 11, 800, '#FFFFFF')}`)
  s.push(T(rx + 55, ry + 14, 'SNAKE NATION', 9.5, 800, P.aT, 'letter-spacing="1.2"'))
  s.push(M(W - 16, ry + 14, `LEVEL ${String(level).padStart(2, '0')}`, 8.5, P.muted, 'text-anchor="end" letter-spacing="1.2"'))
  const rank = er2RankOf(level)
  s.push(T(rx, ry + 50, rank, rank.length > 11 ? 22 : 26, 800, P.text, 'letter-spacing=".5"'))
  s.push(T(rx, ry + 67, nr ? `next: ${nr[1]} at level ${nr[0]}` : 'top of the arc, choom.', 11.5, 500, P.sub, 'font-style="italic"'))
  const py = ry + 80
  s.push(pane(rx, py, rwid, 82, { sec, cut: 5, scanId: sid, fillOp: 0.6, ghost: false, shared: sid }))
  const rows: [string, number][] = [['JOBS DONE', c.jobs], ['LONG JOBS', c.longJobs], ['CREW CALLED', c.agents]]
  rows.forEach(([k, v], i) => {
    const y = py + 22 + i * 24
    const val = v ? String(v) : '—'
    const lw = er2W(k, 9.5, 1.2, 800)
    const vw = er2W(val, 15, 0, 800)
    s.push(T(rx + 12, y, k, 9.5, 800, P.muted, 'letter-spacing="1.2"'))
    s.push(`<line x1="${r1(rx + 12 + lw + 8)}" y1="${y - 3}" x2="${r1(rx + rwid - 12 - vw - 8)}" y2="${y - 3}" stroke="${P.line}" stroke-dasharray="1 3"/>`)
    s.push(T(rx + rwid - 12, y + 1, val, 15, 800, v ? P.text : P.muted, 'text-anchor="end"'))
    if (i === 0 && v) s.push(`<rect x="${rx + 1}" y="${y - 11}" width="2" height="14" fill="${P.a}"/>`)
  })
  s.push(`<text x="${rx}" y="${py + 104}" font-size="12.5" font-weight="500" fill="${P.sub}"><tspan font-weight="800" fill="${P.text}">${c.xp} XP</tspan> · ${Math.max(0, next - c.xp)} to level ${level + 1}</text>`)
  s.push(`<text x="${rx}" y="${py + 122}" font-size="12.5" font-weight="500" fill="${P.sub}"><tspan font-weight="800" fill="${P.text}">${earned} of 9</tspan> engram fragments recovered</text>`)
  s.push(beam(rx, py + 131, rwid, 3, (earned / 9) * 100, { sec, near, color: P.a }))
  // The fragments.
  const fy0 = cy0 + chh + 18 + oy
  s.push(T(16, fy0, 'ENGRAM FRAGMENTS', 9.5, 800, P.muted, 'letter-spacing="1.2"'))
  const per = perRow(W)
  const gap = Math.floor((W - 32 - per * FRAG_W) / Math.max(1, per - 1))
  let nextB: [Badge, number] | undefined
  ER2_BADGES.forEach((b, i) => {
    const tx = 16 + (i % per) * (FRAG_W + gap)
    const ty = fy0 + 8 + Math.floor(i / per) * 62
    const got = c.badges.includes(b.id)
    const prog = clamp(b.progress(c), 0, 1)
    if (!got && !nextB) nextB = [b, prog]
    if (got) {
      s.push(pane(tx, ty, FRAG_W, 50, { sec, cut: 6, scanId: sid, fillOp: 0.75, ghost: false, shared: sid }))
      s.push(T(tx + 10, ty + 23, b.icon, 15, 500, P.aT))
      s.push(M(tx + FRAG_W - 8, ty + 14, `No. ${String(i + 1).padStart(2, '0')}`, 7.5, P.muted, 'text-anchor="end"'))
      const ns = er2W(b.name, 10, 0.3, 800) > 69 ? 9 : 10
      s.push(T(tx + 8, ty + 41, b.name, ns, 800, P.text, 'letter-spacing=".3"'))
      // Her signature on a recovered fragment: a hairline in pink and green along the foot.
      s.push(`<rect x="${tx + 6}" y="${ty + 48}" width="${(FRAG_W - 12) / 2}" height="1" fill="${K.hot}"/><rect x="${tx + 6 + (FRAG_W - 12) / 2}" y="${ty + 48}" width="${(FRAG_W - 12) / 2}" height="1" fill="${K.green}"/>`)
    } else {
      s.push(`<path d="${cham(tx, ty, FRAG_W, 50, 6, 2)}" fill="${P.tile2}" fill-opacity=".4" stroke="${P.muted}" stroke-opacity=".6" stroke-dasharray="3 3"><title>${esc(`${b.name} · ${b.how} · ${Math.round(prog * 100)}%`)}</title></path>`)
      s.push(T(tx + 8, ty + 22, 'CORRUPT', 9.5, 800, P.muted, 'letter-spacing="1.4"'))
      const r = rng(b.id)
      s.push(`<g fill="${P.muted}" fill-opacity=".5">${Array.from({ length: 3 }, () => `<rect x="${r1(tx + 50 + r() * 24)}" y="${r1(ty + 10 + r() * 12)}" width="${r1(2 + r() * 6)}" height="${r() < 0.5 ? 1 : 2}"/>`).join('')}</g>`)
      s.push(`<rect x="${tx + 8}" y="${ty + 37}" width="${FRAG_W - 16}" height="3" fill="${P.track}"/><rect x="${tx + 8}" y="${ty + 37}" width="${r1((FRAG_W - 16) * prog)}" height="3" fill="${P.aT}"/>`)
      s.push(M(tx + FRAG_W - 8, ty + 31, `${Math.round(prog * 100)}%`, 7.5, P.muted, 'text-anchor="end"'))
    }
  })
  const nb = nextB as [Badge, number] | undefined
  s.push(T(16, H - 12, nb ? er2Clip(`Next: ${nb[0].name} · ${nb[0].how} · ${Math.round(nb[1] * 100)}%`, 11.5, W - 32, 0, 500) : 'Every fragment recovered. She remembers you, choom.', 11.5, 500, P.sub, 'font-style="italic"'))
  return `${s.join('')}</svg>`
}
export const syncAlt = (c: Cred): string => `Neural sync: level ${levelOf(c.xp)} ${er2RankOf(levelOf(c.xp))}, ${c.xp} XP, sync ${syncPct(c.xp)}%, ${c.badges.length} of 9 engram fragments recovered`

// --- NETRUN TRACE ----------------------------------------------------------------------
type Kind = 'read' | 'write' | 'link' | 'sys'
const KIND: Record<string, Kind> = { Read: 'read', Grep: 'read', Glob: 'read', LS: 'read', WebFetch: 'read', WebSearch: 'read', Edit: 'write', MultiEdit: 'write', NotebookEdit: 'write', Write: 'write', Agent: 'link', ToolSearch: 'link', Bash: 'sys', PowerShell: 'sys' }
const LANES: Kind[] = ['read', 'write', 'link', 'sys']
const LANE_LABEL: Record<Kind, string> = { read: 'PROBE', write: 'WRITE', link: 'LINK', sys: 'SYS' }
const verbOf = (tool: string): string => ER2_TOOLS[tool] ?? tool
export const TRACE_H = 214
export const TRACE_CAP = 12
const selOf = (n: number, pick: number): number => (n ? (pick < 0 ? n - 1 : Math.min(pick, n - 1)) : -1)
const timecode = (ms: number): string => [3_600_000, 60_000, 1000].map(u => String(Math.floor((Math.max(0, ms) / u) % (u === 3_600_000 ? 100 : 60))).padStart(2, '0')).join(':')

export const traceCard = (W: number, beats: Beat[], pick: number, sec: boolean): string => {
  const P = palOf(sec)
  const H = TRACE_H
  const sid = `tc${W}${sec ? 's' : ''}`
  const live = pick < 0
  const n = beats.length
  const p = selOf(n, pick)
  let first = Math.max(0, n - TRACE_CAP)
  if (p >= 0 && p < first) first = p
  const win = beats.slice(first, first + TRACE_CAP)
  const pi = p - first
  const state = n === 0 ? 'standing by' : `${n} node${n === 1 ? '' : 's'}${n > TRACE_CAP ? ` · last ${win.length} shown` : ''}${live ? ' · live' : ` · node ${String(p + 1).padStart(2, '0')}`}`
  const laneColor: Record<Kind, string> = { read: P.a, write: P.ice, link: P.done, sys: P.muted }
  const tw0 = er2W('NETRUN TRACE', 11, 1.6, 800)
  const s: string[] = [open(W, H, cardCss('led', 'rec', 'slide'))]
  s.push(cardFrame(W, H, 'NETRUN TRACE', `${live && n ? `<circle class="v2-rec" cx="${r1(26 + tw0 + 14)}" cy="24.5" r="2.8" fill="${P.alert}"/>` : ''}${T(26 + tw0 + (live && n ? 22 : 12), 28, state, 11.5, 500, live && n ? P.text : P.sub, 'font-style="italic"')}`, sec, false, sid))
  // The preview: Roman's viewfinder.
  const vx = 14
  const vy = 38
  const vw = W < 520 ? 176 : 212
  const vh = H - 52
  s.push(pane(vx, vy, vw, vh, { sec, cut: 7, scanId: sid, fillOp: 0.9, nodes: true, ghost: false, shared: sid }))
  s.push(brackets(vx + 10, vy + 24, vw - 20, vh - 46, 8, P.done, 1, 0.55))
  const b = p >= 0 ? (beats[p] as Beat) : undefined
  if (!b) {
    s.push(M(vx + 10, vy + 15, 'STBY', 8, P.muted, 'letter-spacing="1.2"'))
    s.push(T(vx + 20, vy + 72, 'No trace yet.', 13, 700, P.text))
    s.push(T(vx + 20, vy + 90, 'Every tool call is a node.', 11.5, 500, P.sub))
  } else {
    const kind = KIND[b.tool] ?? 'sys'
    s.push(`<circle${live ? ' class="v2-rec"' : ''} cx="${vx + 13}" cy="${vy + 12}" r="2.5" fill="${live ? P.alert : P.done}"/>`)
    s.push(M(vx + 20, vy + 15, live ? 'REC' : 'PLAY', 8, live ? P.alert : P.done, 'letter-spacing="1.2"'))
    s.push(M(vx + vw - 10, vy + 15, timecode(b.at - (beats[0] as Beat).at), 9, P.sub, 'text-anchor="end"'))
    s.push(`<rect x="${vx + 20}" y="${vy + 36}" width="3" height="18" fill="${laneColor[kind]}"/>`)
    s.push(T(vx + 30, vy + 51, verbOf(b.tool).toUpperCase(), 19, 800, P.text, 'letter-spacing=".5"'))
    s.push(T(vx + 30, vy + 66, `${b.tool} · ${b.who}`, 10.5, 600, P.muted))
    er2Wrap(b.text, 11.5, vw - 40, 3).forEach((ln, i) => s.push(T(vx + 20, vy + 86 + i * 15, ln, 11.5, 500, P.sub)))
    s.push(M(vx + 10, vy + vh - 9, `NODE ${String(p + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`, 8.5, P.aT, 'letter-spacing=".8"'))
    s.push(M(vx + vw - 10, vy + vh - 9, `0x${HEX_CODES[p % 6]}·${HEX_CODES[(p + 2) % 6]}`, 8, P.muted, 'text-anchor="end"'))
  }
  // The four-lane trace.
  const gx = vx + vw + 16 + 38
  const gr = W - 16
  const gw = gr - gx
  const ly = (i: number) => vy + 22 + i * 32
  LANES.forEach((k, i) => {
    s.push(M(gx - 8, ly(i) + 3, LANE_LABEL[k], 7.5, laneColor[k], 'text-anchor="end" letter-spacing=".8"'))
    s.push(`<line x1="${gx}" y1="${ly(i)}" x2="${gr}" y2="${ly(i)}" stroke="${P.line}"/>`)
  })
  const axY = vy + vh - 10
  s.push(`<line x1="${gx}" y1="${axY}" x2="${gr}" y2="${axY}" stroke="${P.line}"/>`)
  if (!n) s.push(M(gx, axY + 10, 'standing by', 7.5, P.muted))
  if (win.length) {
    const step = win.length > 1 ? (gw - 12) / 11 : 0
    const pickX = gx + 6 + pi * step
    if (pickX > gx + 30) s.push(M(gx, axY + 10, 'first', 7.5, P.muted))
    if (pickX < gr - 30) s.push(M(gr, axY + 10, live ? 'now' : 'last', 7.5, P.muted, 'text-anchor="end"'))
    const pts = win.map((bt, i) => [r1(gx + 6 + i * step), ly(LANES.indexOf(KIND[bt.tool] ?? 'sys'))] as [number, number])
    if (pts.length > 1) s.push(`<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${P.a}" stroke-opacity=".45"/>`)
    pts.forEach(([x, y], i) => {
      const k = KIND[(win[i] as Beat).tool] ?? 'sys'
      const last = i === win.length - 1 && live && first + i === n - 1
      s.push(`<g${last && i !== pi ? ' class="v2-slide"' : ''}><path d="${cham(x - 3.5, y - 3.5, 7, 7, 2, 1)}" fill="${laneColor[k]}"${k === 'sys' ? ' fill-opacity=".8"' : ''}/>${last ? `<path class="v2-led" d="${cham(x - 6, y - 6, 12, 12, 3, 1)}" fill="none" stroke="${laneColor[k]}" stroke-opacity=".8"/>` : ''}</g>`)
      if (i === pi) {
        s.push(brackets(x - 9, y - 9, 18, 18, 5, P.ice, 1.3))
        s.push(`<line x1="${x}" y1="${y + 10}" x2="${x}" y2="${axY}" stroke="${P.ice}" stroke-opacity=".5" stroke-dasharray="2 2"/>`)
        s.push(`<rect x="${r1(x - 9)}" y="${axY + 2}" width="18" height="11" fill="${P.ice}"/>${M(x, axY + 10.5, String(first + i + 1).padStart(2, '0'), 8, '#07101C', 'text-anchor="middle" font-weight="700"')}`)
      }
    })
  }
  return `${s.join('')}</svg>`
}
export const traceAlt = (beats: Beat[], pick: number): string => {
  const p = selOf(beats.length, pick)
  const b = beats[p]
  return b ? `Netrun trace: node ${p + 1} of ${beats.length}, ${b.who} ${verbOf(b.tool)} ${b.text}` : 'Netrun trace: no nodes yet'
}

// --- CLOSED GIGS -------------------------------------------------------------------------------
export const gigsHeight = (n: number): number => 50 + Math.max(1, n) * 26 + 24
const durOf = (ms: number): string => (ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m` : ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s` : `${Math.floor(ms / 1000)}s`)
export const gigsCard = (W: number, list: Legend[], sec: boolean): string => {
  const P = palOf(sec)
  const H = gigsHeight(list.length)
  const sid = `gg${W}${sec ? 's' : ''}`
  const s: string[] = [open(W, H, '')]
  s.push(cardFrame(W, H, 'CLOSED GIGS', monoRight(W, P, 'WATSON · NET LOG'), sec, false, sid))
  if (!list.length) {
    s.push(`<path d="${cham(16, 44, W - 32, 26, 5, 1)}" fill="${P.tile2}" fill-opacity=".5" stroke="${P.line}" stroke-dasharray="3 3"/>`)
    s.push(T(28, 61, 'No gigs closed yet. Finish one and it posts here.', 12, 500, P.sub, 'font-style="italic"'))
  }
  list.forEach((g, i) => {
    const y = 44 + i * 26
    const tier = g.costUsd >= 1 ? P.warn : g.ms >= 10 * 60_000 ? P.done : P.a
    if (i % 2 === 0) s.push(`<rect x="16" y="${y}" width="${W - 32}" height="26" fill="${P.tile2}" fill-opacity=".55"/>`)
    s.push(`<rect x="16" y="${y + 6}" width="2" height="14" fill="${tier}"/>`)
    const cost = `$${g.costUsd.toFixed(2)}`
    const dur = durOf(g.ms)
    const costW = er2W(cost, 13, 0, 800)
    const durW = mw(dur, 9)
    s.push(T(W - 20, y + 17.5, cost, 13, 800, P.aT, 'text-anchor="end"'))
    s.push(M(W - 20 - costW - 14, y + 17, dur, 9, P.muted, 'text-anchor="end"'))
    s.push(T(28, y + 17.5, er2Clip(g.task, 13, W - 20 - costW - 14 - durW - 14 - 28, 0, 700), 13, 700, P.text))
    s.push(`<line x1="16" y1="${y + 26}" x2="${W - 16}" y2="${y + 26}" stroke="${P.line}" stroke-opacity=".6"/>`)
  })
  s.push(T(16, H - 10, list.length ? `${list.length} gig${list.length === 1 ? '' : 's'} closed · newest first` : 'The log fills as jobs close.', 10.5, 500, P.muted, 'font-style="italic"'))
  return `${s.join('')}</svg>`
}
export const gigsAlt = (list: Legend[]): string => `Closed gigs: ${list.map(l => l.task).join(', ') || 'none yet'}`

// --- the boot line ----------------------------------------------------------------------------
/** The neural link handshake, 30 tall: LINKING (a hex scramble, the beam at 38%), then after 1.8 s LINKED. Plays once, then rests. */
export const bootLine = (W: number, sec: boolean, words: [string, string]): string => {
  const P = palOf(sec)
  const hasBar = W >= 360
  const bx = W - 16 - 120
  const css = `.bl1{animation:bl1 1.8s steps(1) both}@keyframes bl1{0%,99%{opacity:1}100%{opacity:0}}.bl2{animation:bl2 1.8s steps(1) both}@keyframes bl2{0%,99%{opacity:0}100%{opacity:1}}.v2-hex{animation:v2hex 1.2s steps(1) infinite}@keyframes v2hex{0%,100%{opacity:1}33%{opacity:0}66%{opacity:0}}.v2-hex2{animation:v2hex 1.2s steps(1) infinite -.4s}.v2-hex3{animation:v2hex 1.2s steps(1) infinite -.8s}@media (prefers-reduced-motion: reduce){.bl1,.v2-hex,.v2-hex2,.v2-hex3{animation:none}.bl1,.v2-hex2,.v2-hex3{display:none}.bl2{animation:none;opacity:1}}`
  const room = (hasBar ? bx - 12 : W - 12) - 44
  const linking = `<g class="bl1">${['0x3F2A', '0xE91C', '0x7A55'].map((h, i) => (hasBar ? M(bx - 12, 19, h, 9, P.aT, `text-anchor="end" class="v2-hex${i ? i + 1 : ''}"`) : '')).join('')}${T(36, 19, er2Clip(words[0], 11.5, room - 70, 0, 600), 11.5, 600, P.sub)}${hasBar ? beam(bx, 12, 120, 3, 38, { sec }) : ''}</g>`
  const linked = `<g class="bl2" opacity="0">${T(36, 19, er2Clip(words[1], 11.5, room, 0, 700), 11.5, 700, P.text)}${hasBar ? beam(bx, 12, 120, 3, 100, { sec }) : ''}</g>`
  const glyph = (c: string) => `<g transform="translate(16 10) scale(1.1)" fill="${c}"><path d="${cham(2, 0, 8, 8, 2, 1)}" fill="none" stroke="${c}" stroke-width="1.2"/><rect x="4.5" y="2.5" width="3" height="3"/></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="30" viewBox="0 0 ${W} 30" font-family="${ER2_FONT}"><style>${css}</style>${glyph(P.a)}${linking}${linked}</svg>`
}
