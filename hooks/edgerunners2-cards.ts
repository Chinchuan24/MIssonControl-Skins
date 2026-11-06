// Cyberpunk: Edgerunners 2, the pane's cards (fan homage; the hidden CAPRICORN skin draws the same
// cards on magenta paper). BIOCHIP is the level card: a chip whose core wakes Capri's portrait (the
// ER_CAPRI_BUST pixel sprite) as fragments are recovered. ROMAN'S TAPE is the tool-call log as a 35 mm
// contact sheet. WATSON WALL pastes up each closed job. Pure SVG strings, no `$`, no state.
import { levelOf, xpFor } from './extras'
import type { Badge, Beat, Cred } from './extras'
import type { Legend } from './eggs'
import { BUST_H, ER2_FONT, ER2_TOOLS, MONO, P, T, capriBust, clamp, er2Clip, er2W, er2Wrap, esc, grain, hash, label, palOf, paper, r1, shards, tape, torn } from './edgerunners2'

const share = (n: number, of: number): number => Math.max(0, Math.min(1, n / of))

// --- 1. BIOCHIP ---------------------------------------------------------------------
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
export const er2Toast = (level: number): string => `BIOCHIP SYNC ↑ ${level} · ${er2RankOf(level)}`

const FRAG_W = 83
const FRAG_H = 52
const perRow = (W: number): number => Math.max(3, Math.floor((W - 24) / (FRAG_W + 8)))
const STACK_DY = 214
export const biochipHeight = (W: number): number => 274 + Math.ceil(9 / perRow(W)) * (FRAG_H + 14) + 30 + (W < 400 ? STACK_DY : 0)

/** A card's frame and its paper title; `right` is a line of flavour at the far side. */
export const cardFrame = (W: number, H: number, title: string, right: string, sec: boolean): string => {
  const C = palOf(sec)
  const L = label(16, 11, title, { size: 11, ls: 1.6, h: 19, seed: `card${title}`, fill: C.lbl, ink: C.lblInk })
  return `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="${C.bg}" stroke="${C.line}"/>${sec ? grain(2, 2, W - 4, H - 4, Math.min(500, Math.round((W * H) / 400)), `cg${title}`, '#fff') : ''}${L.svg}${right && W >= 400 ? T(W - 16, 25, right, 11.5, 500, C.muted, 'text-anchor="end" font-style="italic"') : ''}`
}
const open = (W: number, H: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ER2_FONT}" style="font-variant-numeric:tabular-nums">`

export const biochipCard = (W: number, c: Cred, sec: boolean): string => {
  const C = palOf(sec)
  const lv = levelOf(c.xp)
  const lo = xpFor(lv)
  const hi = xpFor(lv + 1)
  const sync = clamp((c.xp - lo) / (hi - lo), 0, 1)
  const k = ER2_BADGES.filter(b => c.badges.includes(b.id)).length
  const stack = W < 400
  const dy0 = stack ? STACK_DY : 0
  const H = biochipHeight(W)
  let s = `${open(W, H)}${cardFrame(W, H, 'BIOCHIP', 'Project Capricorn · Arasaka', sec)}`
  // The chip: dark body, connector teeth along the foot, the etched maker line, the core dial.
  const cx0 = stack ? Math.max(16, (W - 168) / 2) : 16
  const cy0 = 46
  const cw = 168
  const ch = 200
  s += `<rect x="${cx0}" y="${cy0}" width="${cw}" height="${ch}" rx="8" fill="${C.raised}" stroke="${C.line}"/>`
  for (let i = 0; i < 9; i++) s += `<rect x="${cx0 + 18 + i * 15}" y="${cy0 + ch - 2}" width="8" height="9" rx="1" fill="${sec ? P.black : P.paper2}"/>`
  s += T(cx0 + 12, cy0 + 18, 'ARASAKA · CAPRICORN', 8.5, 800, C.muted, 'letter-spacing="1.4"') + T(cx0 + cw - 12, cy0 + 18, `v.${String(lv).padStart(2, '0')}`, 8.5, 800, C.muted, 'text-anchor="end" letter-spacing="1"')
  // The dial: the outer ring is the sync to the next level (the XP share), torn at its end.
  const dx = cx0 + cw / 2
  const dy = cy0 + 92
  const R = 58
  s += `<circle cx="${dx}" cy="${dy}" r="${R}" fill="none" stroke="${C.track}" stroke-width="9"/>`
  if (sync > 0.005) {
    const a = sync * 2 * Math.PI - Math.PI / 2
    const ex = dx + R * Math.cos(a)
    const ey = dy + R * Math.sin(a)
    s += `<path d="M${dx} ${dy - R}A${R} ${R} 0 ${sync > 0.5 ? 1 : 0} 1 ${r1(ex)} ${r1(ey)}" fill="none" stroke="${C.fill}" stroke-width="9"/>${shards(ex - 6, ey - 6, 12, 12, 4, `dialtip${lv}`, [C.fill, P.paper], 2, 4)}`
  }
  s += `<circle cx="${dx}" cy="${dy}" r="${R - 10}" fill="${P.black}"/><circle cx="${dx}" cy="${dy}" r="${R - 16}" fill="none" stroke="${P.crim}" stroke-width="3"/><circle cx="${dx}" cy="${dy}" r="${R - 27}" fill="none" stroke="${P.crim}" stroke-width="2"/>`
  // In the core: Capri's portrait wakes from the crown down, so the eyes show from the third fragment
  // and the mouth at the ninth. With no fragments the core is static.
  if (k === 0) s += `${grain(dx - 26, dy - 26, 52, 52, 60, 'static', P.muted)}${T(dx, dy + 4, 'NO ENGRAM', 9.5, 800, P.muted, 'text-anchor="middle" letter-spacing=".8"')}`
  else {
    const kk = 1.55
    const hgt = BUST_H * kk
    const top = dy - 38
    const cut = top + hgt * (0.4 + (0.6 * k) / 9)
    const cid = `core${lv}k${k}`
    s += `<clipPath id="${cid}"><circle cx="${dx}" cy="${dy}" r="${R - 17.5}"/></clipPath><g clip-path="url(#${cid})">${capriBust(dx - 21 * kk, top, kk)}${k < 9 ? `<path d="${torn(dx - 44, cut, 88, top + hgt - cut + 20, `veil${k}`, 3.5, 't')}" fill="${P.black}"/>` : ''}</g>`
  }
  s += T(dx, cy0 + 172, `SYNC ${Math.round(sync * 100)}%`, 15, 800, C.text, 'text-anchor="middle"') + T(dx, cy0 + 186, `${c.xp} / ${hi} XP`, 10, 600, C.muted, 'text-anchor="middle"')
  // Right: the host line, the rank, three pasted strips (jobs, long jobs, crew called).
  const rx0 = stack ? 16 : 204
  const rw = W - 16 - rx0
  const o = dy0
  s += T(rx0, 60 + o, 'HOST', 9.5, 800, C.muted, 'letter-spacing="1.2"') + T(rx0 + 36, 60 + o, 'D', 9.5, 800, C.accentT, 'letter-spacing="1.2"') + T(rx0 + rw, 60 + o, `LEVEL ${lv}`, 9.5, 800, C.muted, 'text-anchor="end" letter-spacing="1.2"')
  const rank = er2RankOf(lv)
  s += `<g class="er-fresh">${T(rx0, 88 + o, rank, rank.length > 11 ? 22 : 26, 800, C.text, 'letter-spacing=".4"')}</g>`
  const nr = NEXT_RANKS.find(([l]) => l > lv)
  s += T(rx0, 104 + o, nr ? `next: ${nr[1]} at level ${nr[0]}` : 'top of the arc', 11.5, 500, C.sub, 'font-style="italic"')
  const rows: [number, string, string, string][] = [[c.jobs, 'JOBS DONE', C.fill, C.fillInk], [c.longJobs, 'LONG JOBS', P.paper, P.ink], [c.agents, 'CREW CALLED', C.fill, C.fillInk]]
  rows.forEach(([n, lab, fill, ink], i) => {
    const y = 118 + o + i * 34
    const rot = [-1.4, 0.9, -0.6][i] as number
    const w = rw - ([0, 14, 6][i] as number)
    const num = n ? String(n) : '—'
    s += `<g transform="rotate(${rot} ${r1(rx0 + w / 2)} ${y + 13})">${paper(rx0, y, w, 26, `row${lab}`, fill, fill === P.paper ? '#000' : C.under, 2)}${T(rx0 + 10, y + 19.5, num, 19, 800, ink)}${T(rx0 + 10 + Math.max(30, er2W(num, 19, 0, 800) + 10), y + 17.5, lab, 10, 800, ink, 'letter-spacing="1.3"')}</g>`
  })
  s += tape(rx0 + rw - 6, 118 + o, 22, 8, 32, 'tp1') + tape(rx0 + 2, 186 + o, 18, 7, -28, 'tp2')
  const xpA = `${c.xp} XP`
  s += T(rx0, 232 + o, xpA, 12.5, 800, C.text) + T(rx0 + er2W(xpA, 12.5, 0, 800) + 6, 232 + o, `· ${hi - c.xp} to level ${lv + 1}`, 12.5, 500, C.sub)
  const kA = `${k} of 9`
  s += T(rx0, 248 + o, kA, 12.5, 800, C.text) + T(rx0 + er2W(kA, 12.5, 0, 800) + 5, 248 + o, 'engram fragments recovered', 12.5, 500, C.sub)
  // Engram fragments: torn shard tiles. Recovered is paper with a Capri decal; corrupt is dark.
  const per = perRow(W)
  const fy0 = 286 + o
  s += T(16, fy0 - 6, 'ENGRAM FRAGMENTS', 9.5, 800, C.muted, 'letter-spacing="1.3"')
  const gap = per > 1 ? (W - 32 - per * FRAG_W) / (per - 1) : 0
  let next: [Badge, number] | null = null
  ER2_BADGES.forEach((b, i) => {
    const col = i % per
    const row = Math.floor(i / per)
    const x = 16 + col * (FRAG_W + gap)
    const y = fy0 + 4 + row * (FRAG_H + 14)
    const on = c.badges.includes(b.id)
    const pr = clamp(b.progress(c), 0, 1)
    if (!on && !next) next = [b, pr]
    if (on) {
      const rot = ((hash(b.id) % 5) - 2) * 1.3
      const deco = i % 3 === 0 ? P.green : i % 3 === 1 ? P.hot : P.mag
      const fs = er2W(b.name, 10, 0.3, 800) <= FRAG_W - 14 ? 10 : 9
      s += `<g transform="rotate(${r1(rot)} ${r1(x + FRAG_W / 2)} ${r1(y + FRAG_H / 2)})"><title>${esc(b.name)}: ${esc(b.how)}</title>${paper(x, y, FRAG_W, FRAG_H, `fr${b.id}`, P.paper, '#000', 2.6)}<path d="M${r1(x + FRAG_W - 22)} ${y + 2}L${r1(x + FRAG_W - 2)} ${y + 2}L${r1(x + FRAG_W - 2)} ${y + 20}Z" fill="${deco}"/>${T(x + 7, y + 22, b.icon, 15, 700, P.ink, `font-family="'Apple Symbols','Segoe UI Symbol',sans-serif"`)}${T(x + FRAG_W - 26, y + 15, `No. ${String(i + 1).padStart(2, '0')}`, 8.5, 700, '#4A4440', 'text-anchor="end"')}${T(x + 7, y + 42, er2Clip(b.name, fs, FRAG_W - 12, 0, 800), fs, 800, P.ink, fs === 10 ? 'letter-spacing=".3"' : '')}</g>`
    } else {
      s += `<g><title>${esc(b.name)}: ${esc(b.how)} (${Math.round(pr * 100)}%)</title><path d="${torn(x, y, FRAG_W, FRAG_H, `fr${b.id}`, 2.6)}" fill="${C.raised}" stroke="${C.muted}" stroke-width=".8" stroke-dasharray="3 3"/>${T(x + 9, y + 26, 'CORRUPT', 10, 800, C.muted, 'letter-spacing="1.4"')}<rect x="${x + 9}" y="${y + 36}" width="${FRAG_W - 18}" height="3" fill="${C.track}"/><rect x="${x + 9}" y="${y + 36}" width="${r1((FRAG_W - 18) * pr)}" height="3" fill="${C.accentT}"/></g>`
    }
  })
  const nx = next as [Badge, number] | null
  s += T(16, H - 14, nx ? er2Clip(`Next: ${nx[0].name} · ${nx[0].how} · ${Math.round(nx[1] * 100)}%`, 11.5, W - 32, 0, 500) : 'Every fragment recovered. She remembers you, choom.', 11.5, 500, C.sub, 'font-style="italic"')
  return `${s}</svg>`
}
export const biochipAlt = (c: Cred): string => `BIOCHIP: level ${levelOf(c.xp)} ${er2RankOf(levelOf(c.xp))}, ${c.xp} XP, ${c.badges.length} of 9 engram fragments recovered`

// --- 2. ROMAN'S TAPE ------------------------------------------------------------------------
type Kind = 'read' | 'change' | 'ask' | 'other'
const kindOf = (tool: string): Kind => (/^(Read|Grep|Glob|LS)$/.test(tool) ? 'read' : /^(Edit|MultiEdit|Write|NotebookEdit|Bash|PowerShell)$/.test(tool) ? 'change' : /^(Agent|Web|ToolSearch)/.test(tool) ? 'ask' : 'other')
const KIND: Record<Kind, string> = { read: P.cobaltT, change: P.mag, ask: P.paper, other: P.muted }
const verbOf = (tool: string): string => ER2_TOOLS[tool] ?? tool
const picto = (k: Kind, cx: number, cy: number, col = P.paper): string =>
  k === 'read'
    ? `<path d="M${cx - 9} ${cy}Q${cx} ${cy - 8} ${cx + 9} ${cy}Q${cx} ${cy + 8} ${cx - 9} ${cy}Z" fill="none" stroke="${col}" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="2.6" fill="${col}"/>`
    : k === 'change'
      ? `<path d="M${cx - 7} ${cy + 6}L${cx + 5} ${cy - 6}L${cx + 8} ${cy - 3}L${cx - 4} ${cy + 9}L${cx - 8} ${cy + 10}Z" fill="none" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/>`
      : k === 'ask'
        ? `<circle cx="${cx}" cy="${cy - 4}" r="3.6" fill="none" stroke="${col}" stroke-width="1.4"/><path d="M${cx - 7} ${cy + 8}Q${cx} ${cy - 1} ${cx + 7} ${cy + 8}" fill="none" stroke="${col}" stroke-width="1.4"/>`
        : `<circle cx="${cx}" cy="${cy}" r="3" fill="${col}"/>`
const fmtT = (ms: number): string => {
  const s2 = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s2 / 3600)
  const m = Math.floor((s2 % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s2 % 60).padStart(2, '0')}`
}
export const TAPE_H = 214
export const TAPE_CAP = 12
/** A wax-pencil ring: an open loop that overshoots, the way a contact sheet's keeper gets marked. */
const grease = (x: number, y: number, w: number, h: number, seed: string): string => {
  const cx = x + w / 2
  const cy = y + h / 2
  const rx = w / 2 + 5
  const ry = h / 2 + 5
  let d = ''
  for (let i = 0; i <= 26; i++) {
    const a = -2.2 + (i / 26) * 6.9
    const j = 1 + (((hash(`${seed}${i}`) % 100) / 100) - 0.5) * 0.06
    d += `${i ? 'L' : 'M'}${r1(cx + Math.cos(a) * rx * j)} ${r1(cy + Math.sin(a) * ry * j)}`
  }
  return `<path d="${d}" fill="none" stroke="${P.mag}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`
}
/** The beat the card plays (the picked one, or the newest when live). */
const selOf = (n: number, pick: number): number => (n ? (pick < 0 ? n - 1 : Math.min(pick, n - 1)) : -1)
export const tapeCard = (W: number, beats: Beat[], pick: number, sec: boolean): string => {
  const C = palOf(sec)
  const H = TAPE_H
  const n = beats.length
  const live = pick < 0
  const sel = selOf(n, pick)
  // The newest twelve; a picked shot older than that slides the window back to it.
  const start = n <= TAPE_CAP ? 0 : sel < n - TAPE_CAP ? clamp(sel - 6, 0, n - TAPE_CAP) : n - TAPE_CAP
  const shown = beats.slice(start, start + TAPE_CAP)
  const state = n === 0 ? 'standing by' : n > TAPE_CAP ? `${n} shots · last ${TAPE_CAP} printed${live ? ' · rec' : ''}` : `${n} shot${n === 1 ? '' : 's'}${live ? ' · rec' : ` · playing no. ${sel + 1}`}`
  const lw = label(16, 11, "ROMAN'S TAPE", { size: 11, ls: 1.6, h: 19 }).w
  let s = `${open(W, H)}${cardFrame(W, H, "ROMAN'S TAPE", '', sec)}`
  s += (live && n ? `<circle class="rec" cx="${16 + lw + 16}" cy="21" r="3.4" fill="${sec ? P.black : P.mag}"/>` : '') + T(16 + lw + (live && n ? 25 : 12), 25, state, 11.5, 500, live && n ? C.hotT : C.sub, 'font-style="italic"')
  if (W >= 480) {
    let lx = W - 16
    const parts = (['other', 'ask', 'change', 'read'] as Kind[]).map(kd => {
      const w = er2W(kd, 11, 0, 500)
      lx -= w
      const tx = lx
      lx -= 13
      const sq = lx + 2
      lx -= 10
      return `<rect x="${sq}" y="16" width="8" height="8" fill="${sec && kd === 'change' ? P.black : KIND[kd]}"/>${T(tx, 24.5, kd, 11, 500, C.muted)}`
    })
    s += parts.join('')
  }
  // The camcorder (Roman's white handheld): paper body, ink outline, a cel shade, the LCD.
  const vx = 14
  const vy = 38
  const vw = W >= 520 ? 212 : 176
  const vh = H - vy - 12
  s += `<rect x="${vx + 2}" y="${vy + 3}" width="${vw}" height="${vh}" rx="10" fill="#000" opacity=".6"/><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="10" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.5"/><path d="M${vx + vw - 10} ${vy + 1}Q${vx + vw - 1} ${vy + 1} ${vx + vw - 1} ${vy + 10}L${vx + vw - 1} ${vy + vh - 10}Q${vx + vw - 1} ${vy + vh - 1} ${vx + vw - 10} ${vy + vh - 1}L${vx + 22} ${vy + vh - 1}L${vx + vw - 18} ${vy + vh - 9}L${vx + vw - 9} ${vy + 12}Z" fill="${P.paper2}"/>`
  const lx0 = vx + 9
  const ly0 = vy + 9
  const lW = vw - 18
  const lH = vh - 30
  s += `<rect x="${lx0}" y="${ly0}" width="${lW}" height="${lH}" rx="3" fill="#0B1417" stroke="${P.ink}"/><rect x="${lx0 + 10}" y="${ly0 + 20}" width="${lW - 20}" height="${lH - 34}" fill="none" stroke="${P.paper}" stroke-opacity=".22" stroke-dasharray="2 3"/>`
  s += `<circle cx="${vx + vw - 16}" cy="${vy + vh - 11}" r="4" fill="${P.ink}"/><circle cx="${vx + vw - 16}" cy="${vy + vh - 11}" r="1.6" fill="#3A6B7A"/>`
  s += `<g transform="rotate(-2 ${vx + 40} ${vy + vh - 11})">${paper(vx + 12, vy + vh - 18, 56, 13, 'roman', P.mag, P.crim, 1.2, 'trbl', [1, 1.2])}${T(vx + 18, vy + vh - 8.6, 'ROMAN', 8.5, 800, P.ink, 'letter-spacing="1.6"')}</g>`
  if (n === 0) {
    s += T(lx0 + 8, ly0 + 13, 'STBY', 9.5, 800, P.paper, 'letter-spacing="1.2"') + T(lx0 + lW - 8, ly0 + 13, '00:00:00', 9.5, 600, P.paper, `text-anchor="end" font-family="${MONO}"`)
    s += T(lx0 + lW / 2, ly0 + lH / 2 - 2, 'Nothing on tape yet.', 13, 700, P.text, 'text-anchor="middle"') + T(lx0 + lW / 2, ly0 + lH / 2 + 15, 'Every tool call is a shot.', 11.5, 500, P.sub, 'text-anchor="middle"')
  } else {
    const b = beats[sel] as Beat
    const kd = kindOf(b.tool)
    const t0 = (beats[0] as Beat).at
    s += (live ? `<circle class="rec" cx="${lx0 + 11}" cy="${ly0 + 10}" r="3.2" fill="${P.mag}"/>${T(lx0 + 18, ly0 + 13.4, 'REC', 9.5, 800, P.paper, 'letter-spacing="1.2"')}` : T(lx0 + 8, ly0 + 13.4, '▶ PLAY', 9.5, 800, P.paper, 'letter-spacing="1.2"')) + T(lx0 + lW - 8, ly0 + 13.4, fmtT(b.at - t0), 9.5, 600, P.paper, `text-anchor="end" font-family="${MONO}"`)
    s += `<rect x="${lx0 + 14}" y="${ly0 + 28}" width="3" height="18" fill="${KIND[kd]}"/>${T(lx0 + 22, ly0 + 43, verbOf(b.tool), 19, 800, P.text)}${T(lx0 + 22, ly0 + 58, er2Clip(`${b.tool} · ${b.who}`, 10.5, lW - 36, 0, 700), 10.5, 600, P.muted)}`
    er2Wrap(b.text, 11.5, lW - 36, 3, 500).forEach((ln, i) => {
      s += T(lx0 + 14, ly0 + 76 + i * 15, ln, 11.5, 500, P.sub)
    })
    s += T(lx0 + 8, ly0 + lH - 7, `SHOT ${String(sel + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`, 9, 800, P.paper, 'letter-spacing="1"')
  }
  // The film: two strips of six frames, laid at slight angles and taped, read left to right.
  const fx0 = vx + vw + 14
  const fw = W - 14 - fx0
  const perStrip = 6
  const frW = (fw - 16 - (perStrip - 1) * 4) / perStrip
  for (let st = 0; st < 2; st++) {
    const sy = 42 + st * 84
    const rot = st ? 0.7 : -0.9
    const items = shown.slice(st * perStrip, st * perStrip + perStrip)
    s += `<g transform="rotate(${rot} ${r1(fx0 + fw / 2)} ${sy + 35})"><rect x="${r1(fx0)}" y="${sy}" width="${r1(fw)}" height="74" fill="#17100E"/>`
    for (let h2 = 0; h2 < Math.floor(fw / 9); h2++) s += `<rect x="${r1(fx0 + 4 + h2 * 9)}" y="${sy + 3}" width="4.4" height="3.4" rx=".8" fill="#4A3C35"/><rect x="${r1(fx0 + 4 + h2 * 9)}" y="${sy + 67.6}" width="4.4" height="3.4" rx=".8" fill="#4A3C35"/>`
    for (let i = 0; i < perStrip; i++) {
      const x = fx0 + 8 + i * (frW + 4)
      const y = sy + 10
      const idx = st * perStrip + i
      const b = items[i]
      if (!b) {
        s += `<rect x="${r1(x)}" y="${y}" width="${r1(frW)}" height="44" fill="#0D0908"/>`
        continue
      }
      const kd = kindOf(b.tool)
      const gi = start + idx
      const isNew = live && gi === n - 1
      s += `<g${isNew ? ' class="er-in"' : ''}><rect x="${r1(x)}" y="${y}" width="${r1(frW)}" height="44" fill="#16303A"/><rect x="${r1(x)}" y="${y}" width="${r1(frW)}" height="3" fill="${KIND[kd]}"/>${picto(kd, r1(x + frW / 2), y + 19)}${T(x + frW / 2, y + 39.5, er2Clip(verbOf(b.tool), 9.5, frW - 6, 0, 700), 9.5, 700, P.paper, 'text-anchor="middle"')}</g>`
      s += T(x + 2, sy + 63, `${gi + 1}`, 7.5, 700, '#A8957F') + T(x + frW - 2, sy + 63, '▸', 7.5, 700, '#A8957F', 'text-anchor="end"')
      if (gi === sel) s += grease(x, y, frW, 44, `gp${gi}`)
      if (live && gi === n - 1 && gi !== sel) s += `<circle class="rec" cx="${r1(x + frW - 5)}" cy="${y + 8}" r="2.4" fill="${P.mag}"/>`
    }
    s += `</g>${tape(fx0 + 6, sy + 4, 22, 8, -30, `ft${st}`)}${tape(fx0 + fw - 6, sy + 70, 22, 8, -26, `fb${st}`)}`
  }
  if (n === 0) s += T(fx0 + fw / 2, 42 + 84 + 41, 'unexposed', 10, 600, '#6E5F58', 'text-anchor="middle" font-style="italic"')
  return `${s}</svg>`
}
export const tapeAlt = (beats: Beat[], pick: number): string => {
  const n = beats.length
  if (!n) return "Roman's tape: nothing on tape yet"
  const sel = selOf(n, pick)
  const b = beats[sel] as Beat
  return `Roman's tape: shot ${sel + 1} of ${n}, ${b.who} ${verbOf(b.tool).toLowerCase()}: ${b.text} at ${fmtT(b.at - (beats[0] as Beat).at)}`
}

// --- 3. WATSON WALL ----------------------------------------------------------------------------
export const wallHeight = (n: number): number => 50 + Math.max(1, n) * 26 + 24
const durOf = (ms: number): string => (ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m` : `${Math.max(1, Math.round(ms / 60_000))}m`)
/** Each closed job is a torn flyer pasted up, newest on top. */
export const wallCard = (W: number, list: Legend[], sec: boolean): string => {
  const C = palOf(sec)
  const H = wallHeight(list.length)
  let s = `${open(W, H)}${cardFrame(W, H, 'WATSON WALL', 'jobs done, pasted up', sec)}`
  s += `<g opacity="${sec ? 0.35 : 0.55}">${shards(12, 44, W - 24, H - 56, 26, 'wallold', sec ? ['#E0023F', '#C8023A'] : ['#1C1418', '#21181C', '#2A1C22'], 8, 22)}</g>`
  if (!list.length) {
    s += `<g transform="rotate(-1.5 ${W / 2} 66)">${paper(28, 50, W - 56, 30, 'empty', P.paper, '#000', 2.4)}${T(40, 70, er2Clip('Bare wall. Finish a job and paste it up.', 13, W - 90, 0, 700), 13, 700, P.ink)}</g>${tape(36, 52, 24, 8, -34, 'e1')}${tape(W - 34, 76, 24, 8, -34, 'e2')}`
    return `${s}</svg>`
  }
  const money = (u: number) => (u < 0.005 ? '$0' : `$${u.toFixed(2)}`)
  list.forEach((L, i) => {
    const y = 46 + i * 26
    const rot = ([-0.9, 0.6, -0.4, 0.8, -0.7, 0.5][i % 6] as number)
    const dark = i % 2 === 0
    const fill = dark ? (sec ? P.black : P.mag) : P.paper
    const ink = dark && sec ? P.green : P.ink
    const w = W - 32 - (hash(L.task) % 18)
    const x = 16 + (i % 2) * 6
    const dur = durOf(L.ms)
    const right = money(L.costUsd)
    const rw = er2W(right, 13, 0, 800)
    const dw = er2W(dur, 11, 0, 600)
    s += `<g transform="rotate(${rot} ${r1(x + w / 2)} ${y + 13})">${paper(x, y, w, 26, `job${i}`, fill, dark ? (sec ? '#000' : P.crim) : '#000', 2.4)}${T(x + 12, y + 18, er2Clip(L.task, 13, w - rw - dw - 44, 0, 700), 13, 700, ink)}${T(x + w - 12, y + 18, right, 13, 800, ink, 'text-anchor="end"')}${T(x + w - 20 - rw, y + 18, dur, 11, 600, dark ? (sec ? P.green : '#3A0716') : '#4A4440', 'text-anchor="end"')}</g>`
  })
  s += tape(22, 48, 22, 8, -36, 'w1') + tape(W - 22, 46 + list.length * 26 - 4, 22, 8, -30, 'w2')
  s += T(16, H - 9, `${list.length} job${list.length === 1 ? '' : 's'} on the wall · newest on top`, 10.5, 500, C.muted, 'font-style="italic"')
  return `${s}</svg>`
}
export const wallAlt = (list: Legend[]): string => `Watson Wall: ${list.map(l => l.task).join(', ') || 'bare'}`
