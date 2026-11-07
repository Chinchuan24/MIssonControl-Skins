// Invincible: the three pane cards (COVER STORY the level card, THE PAGE the activity log, GDA WALL the closed jobs), the ladder,
// the mission patches and the boot strip. Ported from the design mock; pure SVG strings, no state.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { C, CSS, FONT, M, PROPS, SP, T, caption, clamp, clip, clipC, clipM, condW, durOf, esc, hhmm, halftoneDefs, impact, money, pal, px, r1, sansW, speedLines, sfx, spH, spW, star, unit, uniq } from './invincible'
import { flightBar, monitor, pip } from './invincible'

export const svgOpen = (W: any, H: any) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-variant-numeric:tabular-nums"><style>${CSS}</style>`
export const frame = (W: any, H: any, P: any) => `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="${P.tile}" stroke="${P.line}"/>`
/** A card title: a 3 x 13 bar in the hero colour, then condensed caps 13/800 ls 1.5. */
export const cardTitle = (x: any, y: any, text: any, P: any) => `<rect x="${x}" y="${y - 11}" width="3" height="13" fill="${P.hero}"/>${C(x + 9, y, text, 13, P.text, 'letter-spacing="1.5"')}`

// ---------------------------------------------------------------- the ladder, the patches
export const RANKS: [number, string][] = [[20, 'Invincible, Full Stop'], [12, "Grand Regent's Headache"], [10, 'Viltrumite-Level'], [8, 'Half-Viltrumite'], [7, 'Coalition of Planets'], [6, 'GDA Asset'], [5, 'Guardian of the Globe'], [4, 'Invincible'], [3, 'Teen Team'], [2, 'Rookie Cape'], [1, 'Burger Mart Cashier']]
export const rankOf = (level: any) => (RANKS.find(([from]) => level >= from) ?? RANKS[RANKS.length - 1] as [number, string])[1]
export const nextRank = (level: any) => { const cur = rankOf(level); for (let l = level + 1; l <= 60; l++) if (rankOf(l) !== cur) return [rankOf(l), l]; return null }
export const tierOf = (level: any) => (level >= 12 ? 4 : level >= 7 ? 3 : level >= 4 ? 2 : 1)
export const TIER_NAMES: string[] = ['', 'the rookie cover', 'the sky cover', 'the Viltrum cover', 'the space cover']
export const levelOf = (xp: any) => Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 6.25)) / 2))
export const xpFor = (level: any) => 25 * level * (level - 1)
export const share = (n: any, of: any) => clamp(n / of, 0, 1)
// Same ids and progress as extras.BADGES (the store is unchanged); the names are GDA mission patches.
export const BADGES = [
  { id: 'choom', name: 'FIRST FLIGHT', how: 'First mission done', icon: '✦', progress: (c: any) => share(c.jobs, 1) },
  { id: 'merc', name: 'BURGER MART', how: '10 missions', icon: '◆', progress: (c: any) => share(c.jobs, 10) },
  { id: 'edgerunner', name: 'TEEN TEAM', how: '50 missions', icon: '★', progress: (c: any) => share(c.jobs, 50) },
  { id: 'legend', name: 'GUARDIAN', how: '10 long missions', icon: '♛', progress: (c: any) => share(c.longJobs, 10) },
  { id: 'netrunner', name: 'COALITION', how: '100 team-ups', icon: '⚑', progress: (c: any) => share(c.agents, 100) },
  { id: 'crewboss', name: 'DUPLI-KATE', how: 'A mission with 5+ agents', icon: '⁂', progress: (c: any) => share(c.crewJobs, 1) },
  { id: 'chromed', name: 'THAT HURT', how: 'Context past 90%', icon: '!', progress: (c: any) => (c.chromed ? 1 : 0) },
  { id: 'owl', name: 'NIGHT PATROL', how: 'A mission after midnight', icon: '☾', progress: (c: any) => share(c.nightJobs, 1) },
  { id: 'samurai', name: 'NEW SUIT', how: 'Find the other era', icon: '◈', progress: (c: any) => (c.samurai ? 1 : 0) },
]
export const WORDS = { cases: 'MISSIONS', long: 'LONG MISSIONS', all: 'EVERY PATCH STITCHED. INVINCIBLE.' }
export const PATCH_COLORS = [[PROPS.captionYellow, '#1E4FB8'], ['#1E4FB8', PROPS.captionYellow], [PROPS.red, '#FFFFFF'], ['#2F8F5B', '#FFFFFF'], ['#E5E4E2', PROPS.ink]]

/** A GDA mission patch, 30 px round: earned = a colourway with a stitched ring and the icon; locked = dark with the % and a progress arc. */
export const patch = (x: any, y: any, b: any, i: any, earned: any, pctDone: any, era: any, fresh: any) => {
  const P = pal(era)
  const cx = x + 29
  const cy = y + 16
  const [bg, fg] = PATCH_COLORS[i % PATCH_COLORS.length] as [string, string]
  let s = `<g class="${fresh ? 'inv-stitch' : ''}"><title>${esc(`${b.name} · ${b.how} · ${Math.round(pctDone * 100)}%`)}</title>`
  if (earned) {
    s += `<circle cx="${cx}" cy="${cy}" r="15" fill="${bg}" stroke="${PROPS.ink}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="12.5" fill="none" stroke="${fg}" stroke-width="1" stroke-dasharray="2 2"/>`
    s += `<text x="${cx}" y="${cy + 5}" font-family="${FONT}" font-size="13" font-weight="700" fill="${fg}" text-anchor="middle">${b.icon}</text>`
  } else {
    const a = pctDone * Math.PI * 2
    const ex = cx + Math.sin(a) * 13.5
    const ey = cy - Math.cos(a) * 13.5
    s += `<circle cx="${cx}" cy="${cy}" r="15" fill="${P.tile2}" stroke="${P.muted}" stroke-width="1" stroke-dasharray="3 2"/>`
    if (pctDone > 0) s += `<path d="M${cx} ${cy - 13.5}A13.5 13.5 0 ${a > Math.PI ? 1 : 0} 1 ${r1(ex)} ${r1(ey)}" fill="none" stroke="${P.hero}" stroke-width="2"/>`
    s += `<text x="${cx}" y="${cy + 3.5}" font-family="${FONT}" font-size="9" font-weight="700" fill="${P.muted}" text-anchor="middle">${Math.round(pctDone * 100)}%</text>`
  }
  const lines = b.name.split(' ')
  const l1 = lines.length > 1 && condW(b.name, 7.5, 0.4) > 56 ? lines.slice(0, -1).join(' ') : b.name
  const l2 = l1 === b.name ? '' : lines[lines.length - 1]
  s += C(cx, y + 42, l1, 7.5, earned ? P.text : P.muted, 'text-anchor="middle" letter-spacing=".4"')
  if (l2) s += C(cx, y + 50, l2, 7.5, earned ? P.text : P.muted, 'text-anchor="middle" letter-spacing=".4"')
  return `${s}</g>`
}

/** The comic cover: 136 x 178 at (x, y). Tier 1 rookie halftone grey, 2 sky, 3 Viltrum red, 4 space. The era's Mark in the middle. */
export const cover = (x: any, y: any, tier: any, level: any, rank: any, era: any, o: any = {}) => {
  const P = pal(era)
  const id = uniq('cv')
  const w = 136
  const h = 178
  const bg = tier === 1 ? '#C9CCD2' : tier === 2 ? '#8EC9FF' : tier === 3 ? '#C9342F' : '#0A0C18'
  const dot = tier === 1 ? '#8E939C' : tier === 2 ? '#3D7FE0' : tier === 3 ? '#7C1A1F' : '#2A3560'
  let s = `<defs>${halftoneDefs(`${id}h`, dot, 1.2, 5, 0.5)}<clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`
  s += `<g class="${o.cls || ''}"><rect x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" fill="${PROPS.ink}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>`
  s += `<g clip-path="url(#${id}c)"><rect x="${x}" y="${y + 46}" width="${w}" height="${h - 46}" fill="url(#${id}h)"/>`
  if (tier === 4) for (let i = 0; i < 18; i++) s += `<rect x="${r1(x + 6 + unit(`${id}sx${i}`) * (w - 12))}" y="${r1(y + 30 + unit(`${id}sy${i}`) * (h - 40))}" width="1.5" height="1.5" fill="#FFFFFF" opacity="${r1(0.4 + unit(`${id}so${i}`) * 0.6)}"/>`
  // speed lines behind him
  s += speedLines(x + w - 6, y + 92, 60, 7, 1, tier === 4 ? '#6B7BB8' : PROPS.white, { op: 0.55, gap: 7 })
  const sp = era === 2 ? SP.INV_MARK_S3 : SP.INV_MARK
  const ss = 2.1
  s += px(sp, x + w / 2 - spW(sp) * ss / 2, y + 50, ss)
  s += '</g>'
  // the logotype across the top, the issue box, the agency corner
  s += sfx(x + w / 2 + 2, y + 42, 'INVINCIBLE', 19, era === 2 && tier <= 2 ? PROPS.s3 : P.hero, { anchor: 'middle', skew: -12, ls: 0.6 })
  s += `<rect x="${x + 5}" y="${y + 5}" width="26" height="14" fill="${PROPS.ink}"/>${C(x + 18, y + 16, `#${level}`, 10, '#FFFFFF', 'text-anchor="middle"')}`
  s += `<rect x="${x + w - 31}" y="${y + 5}" width="26" height="14" fill="${PROPS.white}" stroke="${PROPS.ink}" stroke-width="1"/>${C(x + w - 18, y + 16, 'GDA', 9, PROPS.ink, 'text-anchor="middle" letter-spacing=".6"')}`
  // the tagline: the rank in a caption box at the foot
  const tag = caption(x + 6, y + h - 26, clipC(rank.toUpperCase(), 9, w - 44, 0.6), 9, P.hero, { ink: P.heroInk })
  s += tag.svg
  // barcode
  let bx = x + w - 30
  for (let i = 0; i < 12; i++) { const bw = i % 3 === 0 ? 2 : 1; s += `<rect x="${r1(bx)}" y="${y + h - 18}" width="${bw}" height="12" fill="${PROPS.ink}"/>`; bx += bw + 1 }
  s += `<rect x="${x + w - 34}" y="${y + h - 20}" width="30" height="16" fill="none" stroke="${PROPS.ink}" stroke-width="1" opacity="0"/>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${PROPS.ink}" stroke-width="2"/></g>`
  return s
}

// ---------------------------------------------------------------- COVER STORY (the level card)
export const coverPer = (W: any) => Math.max(3, Math.floor((W - 32 + 8) / 66))
export const coverHeight = (W: any) => 300 + Math.ceil(9 / coverPer(W)) * 50 + 34
export const coverCard = (W: any, c: any, o: any = {}) => {
  const era = o.era || 1
  const P = pal(era)
  const H = coverHeight(W)
  const level = levelOf(c.xp)
  const rank = rankOf(level)
  const tier = tierOf(level)
  const nxt = nextRank(level)
  const need = xpFor(level + 1)
  const have = xpFor(level)
  const toNext = Math.max(0, need - c.xp)
  const s = [svgOpen(W, H), frame(W, H, P)]
  s.push(cardTitle(16, 26, 'COVER STORY', P))
  s.push(T(W - 16, 26, `Issue #${level} · Grayson, M.`, 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  s.push(cover(16, 44, tier, level, rank, era, { cls: o.fresh ? 'inv-fresh' : '' }))
  // the column
  const cx = 170
  const colW = W - cx - 16
  const Lb = (x: number, y: number, t: string) => T(x, y, t, 9.5, 700, P.muted, 'letter-spacing=".8"')
  s.push(Lb(cx, 60, 'RANK'))
  let rs = 19
  while (rs > 13 && condW(rank.toUpperCase(), rs, 0.5) > colW) rs -= 0.5
  s.push(C(cx, 82, clipC(rank.toUpperCase(), rs, colW, 0.5), rs, P.hero, `letter-spacing=".5"${o.fresh ? ' class="inv-fresh"' : ''}`))
  s.push(T(cx, 100, clip(`Issue #${level} · ${TIER_NAMES[tier]}`, 11.5, colW), 11.5, 400, P.sub))
  s.push(Lb(cx, 124, 'NEXT ISSUE'))
  // the threat gauge: a GDA bar with five ticks
  const gw = colW
  const pctL = share(c.xp - have, need - have)
  s.push(`<rect x="${cx}" y="130" width="${gw}" height="6" fill="${P.track}"/><rect x="${cx}" y="130" width="${r1(gw * pctL)}" height="6" fill="${P.hero}"/>`)
  for (let i = 1; i < 5; i++) s.push(`<rect x="${r1(cx + (gw * i) / 5)}" y="129" width="1" height="8" fill="${P.tile}"/>`)
  s.push(`<text x="${cx}" y="153" font-family="${FONT}" font-size="11.5" fill="${P.sub}"><tspan font-size="13" font-weight="700" fill="${P.text}" font-variant-numeric="tabular-nums">${c.xp}</tspan> punches thrown · ${toNext} to #${level + 1}</text>`)
  s.push(T(cx, 171, clip(nxt ? `${nxt[0]} at #${nxt[1]}` : 'Top of the ladder.', 11.5, colW), 11.5, 400, P.muted, 'font-style="italic"'))
  // the GDA field report (grey tech, mono)
  const ry = 234
  const rw = W - 32
  s.push(`<rect x="16" y="${ry}" width="${rw}" height="52" fill="${PROPS.gdaDark}" stroke="${PROPS.gda}" stroke-width="1"/><rect x="16" y="${ry}" width="${rw}" height="13" fill="${PROPS.gda}"/>`)
  s.push(M(22, ry + 9.5, 'GDA FIELD REPORT', 7.5, PROPS.white, 'letter-spacing="1.2"'))
  s.push(M(W - 22, ry + 9.5, clipM('ASSET: GRAYSON, M.', 7.5, rw / 2 - 20), 7.5, PROPS.white, 'text-anchor="end" letter-spacing="1"'))
  const cols = [['MISSIONS', c.jobs], ['LONG MISSIONS', c.longJobs], ['TEAM-UPS', c.agents], ['PUNCHES', c.xp]]
  const cw = rw / 4
  cols.forEach(([k, v], i) => {
    const x = 16 + i * cw
    if (i) s.push(`<rect x="${r1(x)}" y="${ry + 16}" width="1" height="33" fill="${PROPS.gda}" opacity=".6"/>`)
    s.push(M(x + 8, ry + 25, clipM(k, 7.5, cw - 14), 7.5, PROPS.screenText, 'letter-spacing=".8"'))
    s.push(T(x + 8, ry + 44, v ? String(v) : '—', 15, 700, PROPS.white, 'font-variant-numeric="tabular-nums"'))
  })
  // the patches
  const py = 300
  const per = coverPer(W)
  const earnedN = c.badges.length
  s.push(Lb(16, py + 10, `MISSION PATCHES  ${earnedN} of 9`))
  s.push(T(W - 16, py + 10, 'stitched one per mission', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  const gap = per > 1 ? (W - 32 - per * 58) / (per - 1) : 0
  BADGES.forEach((b, i) => {
    const col = i % per
    const row = Math.floor(i / per)
    const x = 16 + col * (58 + gap)
    const y = py + 18 + row * 50
    const earned = c.badges.includes(b.id)
    s.push(patch(x, y, b, i, earned, earned ? 1 : b.progress(c), era, o.freshBadge === b.id))
  })
  const nextB = BADGES.find(b => !c.badges.includes(b.id))
  const foot = nextB ? `Next: ${nextB.name} · ${nextB.how} · ${Math.round(nextB.progress(c) * 100)}%` : WORDS.all
  s.push(T(16, H - 10, clip(foot, 11, W - 32), 11, 400, P.muted, 'font-style="italic"'))
  return `${s.join('\n')}</svg>`
}
export const coverToast = (level: any) => `ISSUE #${level} · ${rankOf(level).toUpperCase()}`

// ---------------------------------------------------------------- THE PAGE (the activity card)
export const PAGE_H = 236
export const VERBS: Record<string, string> = { Read: 'SCAN', Grep: 'TRACK', Glob: 'SWEEP', LS: 'SWEEP', Edit: 'PUNCH', MultiEdit: 'PUNCH', NotebookEdit: 'PUNCH', Write: 'INK', Bash: 'BLAST', PowerShell: 'BLAST', Agent: 'TEAM-UP', ToolSearch: 'RECON', WebFetch: 'FLY-BY', WebSearch: 'SCOUT' }
export const verbOf = (tool: any) => VERBS[tool] || String(tool).toUpperCase()
export const pageCols = (W: any) => (W >= 440 ? 4 : 3)
export const pageCard = (W: any, beats: any, pick: any, o: any = {}) => {
  const era = o.era || 1
  const P = pal(era)
  const H = PAGE_H
  const n = beats.length
  const cols = pageCols(W)
  const small = cols * 2
  const live = pick < 0 || pick >= n - 1
  const sel = live ? n - 1 : pick
  // the window: the newest `small + 1` calls, slid back to hold an older pick
  let from = Math.max(0, n - (small + 1))
  if (!live && sel < from) from = Math.max(0, sel - small)
  const shown = beats.slice(from, from + small + 1)
  const s = [svgOpen(W, H), frame(W, H, P)]
  s.push(cardTitle(16, 26, 'THE PAGE', P))
  const status = !n ? 'nothing drawn yet' : live ? `${n} calls · live` : `${n} calls · panel ${String(sel + 1).padStart(2, '0')} · last ${shown.length} drawn`
  s.push(T(16 + 9 + condW('THE PAGE', 13, 1.5) + 12, 26, status, 11, 400, live && n ? P.aT : P.muted, 'font-style="italic"'))
  // the page
  const id = uniq('pg')
  const pxy = 38
  const pw = W - 28
  const ph = H - pxy - 12
  s.push(`<defs>${halftoneDefs(`${id}h`, PROPS.paperDark, 0.9, 6, 0.5)}</defs>`)
  s.push(`<rect x="17" y="${pxy + 3}" width="${pw}" height="${ph}" fill="${PROPS.ink}"/><rect x="14" y="${pxy}" width="${pw}" height="${ph}" fill="${PROPS.paper}" stroke="${PROPS.ink}" stroke-width="2"/>`)
  s.push(`<rect x="${14 + pw - 60}" y="${pxy + ph - 40}" width="58" height="38" fill="url(#${id}h)" opacity=".5"/>`)
  if (!n) {
    s.push(`<rect x="24" y="${pxy + 10}" width="${pw - 20}" height="${ph - 44}" fill="none" stroke="${PROPS.ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`)
    s.push(T(W / 2, pxy + ph / 2 - 6, 'Nothing drawn yet.', 11.5, 700, PROPS.ink, 'text-anchor="middle"'))
    s.push(T(W / 2, pxy + ph / 2 + 10, 'Every tool call gets a panel.', 11, 400, '#5A5340', 'text-anchor="middle" font-style="italic"'))
    s.push(M(W / 2, pxy + ph - 8, '– 0 –', 7.5, PROPS.ink, 'text-anchor="middle"'))
    return `${s.join('\n')}</svg>`
  }
  // the splash panel: the live or picked call
  const b = beats[sel]
  const sx = 22
  const sy = pxy + 8
  const sw = pw - 16
  const sh = 62
  s.push(`<defs>${halftoneDefs(`${id}s`, PROPS.sky, 1, 4, 0.45)}</defs>`)
  s.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#CFE6FF"/><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#${id}s)"/>`)
  s.push(speedLines(sx + sw - 4, sy + sh * 0.45, Math.min(160, sw * 0.5), 6, 1, PROPS.white, { op: 0.7, gap: 7 }))
  const cap = caption(sx + 6, sy + 6, `${hhmm(b.at)} · ${String(b.who || '').toUpperCase()}`, 9, PROPS.captionYellow)
  s.push(cap.svg)
  if (live) s.push(`<circle class="inv-run" cx="${sx + 6 + cap.w + 9}" cy="${sy + 14}" r="3" fill="${PROPS.red}" stroke="${PROPS.ink}" stroke-width="1"/>`)
  const verb = verbOf(b.tool)
  const vs = 22
  const vw = condW(verb, vs, 1) + 12
  s.push(sfx(sx + sw - 10, sy + 30, `${verb}!`, vs, P.hero, { anchor: 'end', skew: -12, ls: 1 }))
  s.push(T(sx + 8, sy + sh - 10, clip(b.text, 11.5, sw - vw - 24, 0, true), 11.5, 700, PROPS.ink))
  s.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="none" stroke="${PROPS.ink}" stroke-width="${live ? 2 : 2.5}"/>`)
  // the grid of small panels (the other calls in the window, oldest first)
  const others = shown.map((bb: any, i: number) => [bb, from + i] as [any, number]).filter(([, i]: [any, number]) => i !== sel).slice(-small)
  const gy = sy + sh + 8
  const gutter = 6
  const cw = (sw - gutter * (cols - 1)) / cols
  const chh = 40
  others.forEach(([bb, idx]: [any, number], i: number) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = sx + col * (cw + gutter)
    const y = gy + row * (chh + gutter)
    const isNew = idx === n - 1
    s.push(`<rect x="${r1(x)}" y="${y}" width="${r1(cw)}" height="${chh}" fill="${PROPS.white}" stroke="${PROPS.ink}" stroke-width="1.5"/>`)
    s.push(`<rect x="${r1(x)}" y="${y}" width="${r1(Math.min(cw * 0.45, 40))}" height="10" fill="${PROPS.captionYellow}" stroke="${PROPS.ink}" stroke-width="1"/>`)
    s.push(M(x + 3, y + 8, hhmm(bb.at), 7, PROPS.ink))
    s.push(C(x + cw - 4, y + 11, clipC(verbOf(bb.tool), 9, cw * 0.5, 0.4), 9, PROPS.ink, 'text-anchor="end" letter-spacing=".4"'))
    s.push(T(x + 4, y + 25, clip(String(bb.who || ''), 8.5, cw - 8, 0, true), 8.5, 700, '#3A3A3A'))
    s.push(T(x + 4, y + 35, clip(bb.text, 8.5, cw - 8), 8.5, 400, PROPS.ink))
    s.push(`<title>${esc(`${hhmm(bb.at)} ${bb.who} ${verbOf(bb.tool)} ${bb.text}`)}</title>`)
    if (isNew && live) s.push(`<circle class="inv-run" cx="${r1(x + cw - 6)}" cy="${y + chh - 6}" r="2.5" fill="${PROPS.red}"/>`)
  })
  // page number and the window note
  s.push(M(W / 2, pxy + ph - 7, `– ${n} –`, 7.5, PROPS.ink, 'text-anchor="middle"'))
  s.push(M(22, pxy + ph - 7, `panels ${from + 1}–${from + shown.length}`, 7, '#5A5340'))
  return `${s.join('\n')}</svg>`
}
export const pageAlt = (beats: any, pick: any) => { if (!beats.length) return 'The page: nothing drawn yet'; const b = beats[pick < 0 ? beats.length - 1 : pick]; return `The page: panel ${pick < 0 ? beats.length : pick + 1} of ${beats.length}, ${b.who} ${verbOf(b.tool)} ${b.text} at ${hhmm(b.at)}` }

// ---------------------------------------------------------------- GDA WALL (the task card and the closed jobs)
export const WALL_ROW = 24
export const wallHeight = (n: any) => 124 + 18 + Math.max(1, n) * WALL_ROW + 34
export const wallCard = (W: any, task: any, isWorking: any, done: any, total: any, legends: any, o: any = {}) => {
  const era = o.era || 1
  const P = pal(era)
  const n = Math.min(5, legends.length)
  const H = wallHeight(n)
  const s = [svgOpen(W, H), frame(W, H, P)]
  s.push(cardTitle(16, 26, 'GDA WALL', P))
  const status = isWorking ? 'LIVE FEED…' : task ? 'FEED CLOSED.' : 'STANDBY.'
  s.push(M(16 + 9 + condW('GDA WALL', 13, 1.5) + 12, 26, status, 9, isWorking ? PROPS.screenGreen : P.muted, 'letter-spacing="1.2"'))
  if (W >= 440) s.push(T(W - 16, 26, 'Global Defense Agency', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  // the main monitor, Cecil watching it from the right
  const mx = 16
  const my = 40
  const mw = W - 32 - 48
  const mh = 68
  s.push(monitor(mx, my, mw, mh, { live: isWorking, rec: isWorking }))
  s.push(M(mx + 12, my + 19, `FEED 01 · ${isWorking ? 'LIVE' : task ? 'HELD' : 'STANDBY'}`, 7.5, PROPS.screenGreen, 'letter-spacing="1"'))
  if (task) {
    s.push(T(mx + 12, my + 38, clip(task, 14, mw - 24, 0, true), 14, 700, PROPS.white))
    const pipsN = Math.min(12, total)
    for (let i = 0; i < pipsN; i++) s.push(pip(i < done ? 'done' : i === done && isWorking ? 'running' : 'todo', mx + 17 + i * 13, my + 52, era))
    s.push(M(mx + 17 + pipsN * 13 + 6, my + 55.5, `${done} of ${total} objectives`, 8.5, PROPS.screenText))
  } else {
    s.push(T(mx + 12, my + 38, 'No feed on the wall', 14, 700, PROPS.screenText))
    s.push(M(mx + 12, my + 55.5, 'No objectives on the feed yet.', 8.5, PROPS.screenText))
  }
  const cs = 1.4
  s.push(`<ellipse cx="${W - 16 - 20}" cy="${my + mh + 2}" rx="12" ry="2" fill="#000" opacity=".35"/>`)
  s.push(px(SP.INV_CECIL, W - 16 - 20 - spW(SP.INV_CECIL) * cs / 2, my + mh - 28 * cs + 2, cs, { rows: [0, 28] }))
  // the archived feeds
  const ay = my + mh + 14
  s.push(T(16, ay + 10, 'ARCHIVED FEEDS', 9.5, 700, P.muted, 'letter-spacing=".8"'))
  s.push(T(W - 16, ay + 10, 'missions of 3+ minutes', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  const ry0 = ay + 18
  if (!n) {
    s.push(`<rect x="16" y="${ry0}" width="${W - 32}" height="21" rx="2" fill="none" stroke="${P.line}" stroke-dasharray="4 3"/>`)
    s.push(T(24, ry0 + 14.5, clip('No archived feeds yet. A mission that runs 3+ minutes is archived here.', 11, W - 48), 11, 400, P.muted, 'font-style="italic"'))
  }
  legends.slice(0, n).forEach((l: any, i: number) => {
    const y = ry0 + i * WALL_ROW
    const fresh = i === 0 && o.fresh
    s.push(`<rect x="16" y="${y}" width="${W - 32}" height="21" rx="2" fill="${PROPS.gdaDark}" stroke="${PROPS.gda}" stroke-width="1"/><rect x="20" y="${y + 3}" width="${W - 40}" height="15" fill="${PROPS.screen}"/>`)
    s.push(M(26, y + 14, `FEED ${String(legends.length - i + 1).padStart(2, '0')}`, 7.5, PROPS.screenGreen, 'letter-spacing="1"'))
    const right = `${durOf(l.ms)} · ${money(l.costUsd)}`
    const rw = sansW(right, 11, 0, true) + 4
    s.push(`<text x="${W - 26}" y="${y + 14.5}" font-family="${FONT}" font-size="11" fill="${PROPS.screenText}" text-anchor="end" font-variant-numeric="tabular-nums">${esc(durOf(l.ms))} · <tspan font-weight="700" fill="${PROPS.white}">${esc(money(l.costUsd))}</tspan></text>`)
    const tagW = condW('CLOSED', 8, 1) + 10
    const tagX = W - 26 - rw - 10 - tagW
    s.push(`<g class="${fresh ? 'inv-stamp' : ''}"><rect x="${r1(tagX)}" y="${y + 5}" width="${r1(tagW)}" height="11" fill="none" stroke="${PROPS.screenGreen}" stroke-width="1"/>${C(tagX + 5, y + 13.5, 'CLOSED', 8, PROPS.screenGreen, 'letter-spacing="1"')}</g>`)
    s.push(T(70, y + 14.5, clip(l.task, 11.5, tagX - 80, 0, true), 11.5, 700, PROPS.screenText))
  })
  s.push(T(16, H - 10, n ? `${legends.length} archived · newest on top` : 'The wall fills as missions close.', 11, 400, P.muted, 'font-style="italic"'))
  return `${s.join('\n')}</svg>`
}
export const wallAlt = (task: any, isWorking: any, done: any, total: any, legends: any) => `GDA wall: ${task || 'no feed'}, ${isWorking ? 'live' : 'standby'}, ${done} of ${total} objectives, ${legends.length} archived feeds`

// ---------------------------------------------------------------- boot, words
export const BOOT = ['GDA FEED COMING ONLINE…', 'THINK, MARK']
export const bootLine = (W: any, era: any, done: any = false) => {
  const P = pal(era)
  const sp = era === 2 ? SP.INV_MARK_S3_FLY : SP.INV_MARK_FLY
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="30" viewBox="0 0 ${W} 30"><style>${CSS}</style><rect x=".5" y=".5" width="${W - 1}" height="29" rx="8" fill="${P.tile}" stroke="${P.line}"/>`
  s += speedLines(14, 15, 10, 3, 1, P.hero, { op: 0.6, gap: 3 }) + px(sp, 14, 9, 0.6, { cls: done ? '' : 'inv-bob' })
  s += T(36, 19, done ? 'FEED LIVE · Invincible.' : `${BOOT[0]}  ${BOOT[1]}`, 11.5, done ? 700 : 400, P.text)
  s += flightBar(W - 134, 12, 120, done ? 100 : 55, era, { working: !done })
  return `${s}</svg>`
}
export const GREETING = "Mark Grayson. Invincible. Let's go."