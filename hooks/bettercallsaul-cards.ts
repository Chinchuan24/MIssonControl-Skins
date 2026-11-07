// The Better Call Saul skin's cards (and GENE's): ATTORNEY AT LAW (the level card: a business card that changes with
// your tier, a time sheet, nine matchbooks), LEGAL PAD (Kim's pad, one pen line per tool call), THE DOCKET (the open matter
// and the closed cases in a cocobolo tray) and the boot strip. Pure SVG strings, no state. A fan homage to AMC / Sony
// Pictures Television; the props keep their own colours (paper, wood, brass): they are objects, not UI.

import { BADGES, levelOf, xpFor } from './extras'
import type { Badge, Beat, Cred, CredWords } from './extras'
import type { Legend } from './eggs'
import {
  BCS_BOOT, CARD_CSS, C, GENE_BOOT, Hd, PROPS, STATUE, S, T, bell, clamp, clipBy, condW, durOf, eraBar, esc, fitBy, grey, handW, hhmm, money, pal, pip, prop, px, r1, serifW, sansW, star, statue, tab, verbOf, vignette, grain, wood, wrap,
} from './bettercallsaul'

/** The ranks, by level. The ladder ends where the show does: the top tier is Gene's name tag. */
export const RANKS: [number, string][] = [[20, 'Saul Gone'], [12, 'Gene Takavic'], [10, 'Friend of the Cartel'], [9, 'Criminal Lawyer'], [8, '& Associates'], [7, 'Saul Goodman'], [6, 'Wexler McGill'], [5, 'Davis & Main'], [4, 'Elder Law'], [3, 'Public Defender'], [2, 'The Mailroom'], [1, "Slippin' Jimmy"]]
export const bcsRankOf = (level: number): string => (RANKS.find(([from]) => level >= from) ?? (RANKS[RANKS.length - 1] as [number, string]))[1]
const nextRank = (level: number): [string, number] | null => {
  const cur = bcsRankOf(level)
  for (let l = level + 1; l <= 60; l++) if (bcsRankOf(l) !== cur) return [bcsRankOf(l), l]
  return null
}
export const tierOf = (level: number): 1 | 2 | 3 | 4 => (level >= 12 ? 4 : level >= 7 ? 3 : level >= 4 ? 2 : 1)
const TIER_NAMES = ['', 'the McGill card', 'the Wexler McGill card', 'the Saul Goodman card', "Gene's name tag"]
export const bcsToast = (level: number): string => `LEVEL ${level} · ${bcsRankOf(level).toUpperCase()}`

/** The nine matchbooks: the same ids and progress as `extras.BADGES`, so the store is unchanged. */
const BCS_NAMES: Record<string, [string, string, string]> = {
  choom: ['FIRST CLIENT', '✦', 'Finish your first job'],
  merc: ['NEED A WILL?', '◆', 'Finish 10 jobs'],
  edgerunner: ['CLASS ACTION', '★', 'Finish 50 jobs'],
  legend: ['SANDPIPER', '♛', '10 long matters (3+ minutes each)'],
  netrunner: ['& ASSOCIATES', '⚖', 'Call 100 sub-agents'],
  crewboss: ['FILM CREW', '⚑', 'Run a job with 5+ sub-agents'],
  chromed: ['CHICANERY', '!', 'Push the context past 90%'],
  owl: ['LANTERN', '☾', 'Finish a job after midnight'],
  samurai: ['NIPPY', '▣', 'Find the secret skin'],
}
export const BCS_BADGES: Badge[] = BADGES.map(b => {
  const e = BCS_NAMES[b.id]
  return e ? { ...b, name: e[0], icon: e[1], how: e[2] } : b
})
export const BCS_CRED_WORDS: CredWords = { badges: BCS_BADGES, cases: 'CLIENTS', long: 'LONG MATTERS', all: "EVERY MATCHBOOK STRUCK. S'ALL GOOD, MAN!" }

const grey2 = (c: string, gene: boolean): string => (gene ? grey(c) : c)
const svgOpen = (W: number, H: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-variant-numeric:tabular-nums"><style>${CARD_CSS}</style>`
const frameOf = (W: number, H: number, tile: string, line: string): string => `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="${tile}" stroke="${line}"/>`
const cardTitle = (x: number, y: number, text: string, gold: string, ink: string): string => `<rect x="${x}" y="${y - 11}" width="3" height="13" fill="${gold}"/>${S(x + 9, y, text, 12.5, 700, ink, 'letter-spacing="1.2"')}`

// ---------------------------------------------------------------- the four business cards (the level hero), 176 by 100
export const bizCard = (x: number, y: number, tier: number, gene: boolean, rot = -1.2): string => {
  const w = 176
  const h = 100
  let s = `<g transform="rotate(${rot} ${r1(x + w / 2)} ${r1(y + h / 2)})"><rect x="${x + 2}" y="${y + 4}" width="${w}" height="${h}" rx="2" fill="#000" opacity=".4"/>`
  if (tier === 4) {
    // Gene's name tag: grey plastic, a pin bar, the words of the hideout. Always grey, even on the Saul skin.
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${PROPS.tag}"/><rect x="${r1(x + 1.5)}" y="${r1(y + 1.5)}" width="${w - 3}" height="${h - 3}" rx="5" fill="none" stroke="#B9B9B9"/>`
    s += `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="18" rx="2" fill="#4A4A4A"/>${C(x + w / 2, y + 23, 'MALL BAKERY · OMAHA', 10, '#F2F2F2', 'text-anchor="middle" letter-spacing="1.2"')}`
    s += S(x + w / 2, y + 62, 'GENE', 30, 700, PROPS.tagInk, 'text-anchor="middle" letter-spacing="2"')
    s += T(x + w / 2, y + 80, 'Manager', 11.5, 400, '#4A4A4A', 'text-anchor="middle" font-style="italic"')
    s += `<rect x="${r1(x + w / 2 - 14)}" y="${y - 3}" width="28" height="5" rx="2" fill="#9A9A9A"/>`
    return `${s}</g>`
  }
  const cream = prop('cream', gene)
  const navy = prop('navy', gene)
  const ink = prop('creamInk', gene)
  if (tier === 1) {
    // The cheap card: a hairline border, Georgia, the whole block printed 2 px off centre, the matchbook slogan.
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cream}"/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="none" stroke="${navy}" stroke-opacity=".6"/>`
    const cx = x + w / 2 + 2
    s += S(cx, y + 36, 'JAMES M. McGILL, ESQ.', 11, 700, navy, 'text-anchor="middle" letter-spacing=".4"')
    s += S(cx, y + 52, 'ATTORNEY AT LAW', 8.5, 400, ink, 'text-anchor="middle" letter-spacing="2"')
    s += `<line x1="${r1(cx - 50)}" y1="${y + 60}" x2="${r1(cx + 50)}" y2="${y + 60}" stroke="${navy}" stroke-opacity=".5"/>`
    s += S(cx, y + 76, 'Need a will? Call McGill!', 11, 400, ink, 'text-anchor="middle" font-style="italic"')
    s += T(cx, y + 90, 'Wills · Elder Law · Walk-ins welcome', 7.5, 400, ink, 'text-anchor="middle" opacity=".8"')
  } else if (tier === 2) {
    // Wexler McGill: a clean firm card, two names on one navy rule, a double hairline.
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cream}"/><rect x="${x}" y="${y}" width="6" height="${h}" fill="${navy}"/>`
    s += S(x + 20, y + 44, 'WEXLER', 13, 700, navy, 'letter-spacing="1.2"')
    s += S(x + 20 + serifW('WEXLER', 13, 1.2, true) + 7, y + 44, 'McGILL', 13, 700, navy, 'letter-spacing="1.2"')
    s += `<line x1="${x + 22}" y1="${y + 52}" x2="${x + w - 16}" y2="${y + 52}" stroke="${navy}"/><line x1="${x + 22}" y1="${y + 54.5}" x2="${x + w - 16}" y2="${y + 54.5}" stroke="${navy}" stroke-opacity=".5"/>`
    s += S(x + 22, y + 68, 'ATTORNEYS AT LAW', 8.5, 400, ink, 'letter-spacing="2.2"')
    s += T(x + 22, y + 86, 'Albuquerque, New Mexico', 8, 400, ink, 'opacity=".8" font-style="italic"')
  } else {
    // Saul Goodman & Associates: the ad card. A red top band, yellow shout, a blue strip, the Statue, stars.
    const red = prop('adRed', gene)
    const yel = prop('adYellow', gene)
    const blue = prop('adBlue', gene)
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cream}"/><rect x="${x}" y="${y}" width="${w}" height="34" fill="${red}"/>`
    s += C(x + 12, y + 26, 'SAUL GOODMAN', 22, yel, 'letter-spacing=".5"')
    s += C(x + 12, y + 54, '& ASSOCIATES', 13, blue, 'letter-spacing="1.2"')
    s += `<rect x="${x}" y="${y + 62}" width="${w}" height="16" fill="${blue}"/>${C(x + 12, y + 74, 'ATTORNEY AT LAW', 10, cream, 'letter-spacing="2"')}`
    s += C(x + 12, y + 93, 'CALL NOW! · FREE CONSULTATION', 8, red, 'letter-spacing=".6"')
    s += star(x + w - 22, y + 50, 7, yel) + star(x + w - 36, y + 55, 4, yel) + star(x + w - 12, y + 58, 3.5, yel)
    s += px(STATUE, x + w - 26, y + 78, 1.1, { grey: gene })
  }
  return `${s}</g>`
}

// ---------------------------------------------------------------- matchbooks (the badges), 58 by 36
const MATCH_COLORS: [PK, PK][] = [['adRed', 'adYellow'], ['adBlue', 'cream'], ['adYellow', 'navy'], ['navy', 'cream'], ['cream', 'adRed']]
type PK = 'adRed' | 'adYellow' | 'adBlue' | 'cream' | 'navy'
export const matchbook = (x: number, y: number, b: Badge, i: number, earned: boolean, pctDone: number, gene: boolean, fresh: boolean): string => {
  const w = 58
  const h = 36
  const P = pal(gene)
  let s = `<g${fresh ? ' class="bcs-flip"' : ''}><title>${esc(`${b.name} · ${b.how} · ${Math.round(pctDone * 100)}%`)}</title>`
  if (earned) {
    const [bgK, fgK] = MATCH_COLORS[i % MATCH_COLORS.length] as [PK, PK]
    const bg = prop(bgK, gene)
    const fg = prop(fgK, gene)
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${bg}"/><rect x="${x}" y="${y + h - 7}" width="${w}" height="7" fill="${grey2('#3A2E24', gene)}"/><rect x="${x + 5}" y="${y + h - 4.5}" width="${w - 10}" height="2" fill="${grey2('#6E5A46', gene)}"/>`
    s += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 11}" rx="1" fill="none" stroke="${fg}" stroke-opacity=".55"/>`
    const lines = wrap(b.name, 8.5, w - 10, 2, condW)
    lines.forEach((l, k) => { s += C(x + w / 2, y + (lines.length === 1 ? 17 : 13 + k * 9.5), l, 8.5, fg, 'text-anchor="middle" letter-spacing=".6"') })
    if (lines.length === 1) s += T(x + w / 2, y + 26, b.icon, 7.5, 700, fg, 'text-anchor="middle" opacity=".9"')
  } else {
    s += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="2" fill="${P.tile2}" stroke="${P.muted}" stroke-opacity=".6" stroke-dasharray="3 2"/>`
    s += `<rect x="${x}" y="${y + h - 7}" width="${w}" height="7" fill="${P.line}"/>`
    s += C(x + w / 2, y + 14, 'BLANK', 8.5, P.muted, 'text-anchor="middle" letter-spacing="1.4"')
    s += T(x + w - 5, y + 25, `${Math.round(pctDone * 100)}%`, 7.5, 700, P.sub, 'text-anchor="end" font-variant-numeric="tabular-nums"')
    s += `<rect x="${x + 5}" y="${y + 22}" width="${w - 30}" height="2" fill="${P.track}"/><rect x="${x + 5}" y="${y + 22}" width="${r1((w - 30) * clamp(pctDone, 0, 1))}" height="2" fill="${P.aT}"/>`
  }
  return `${s}</g>`
}

/** The red CLOSED stamp (the docket), rotated -8 degrees; the class slams it on a fresh row. */
export const stamp = (x: number, y: number, text: string, gene: boolean, fresh: boolean, op = 0.85): string => {
  const red = prop('adRed', gene)
  const w = condW(text, 9, 1) + 12
  return `<g class="${fresh ? 'bcs-stamp' : ''}" transform="rotate(-8 ${r1(x + w / 2)} ${r1(y + 6)})" opacity="${op}"><rect x="${r1(x)}" y="${y}" width="${r1(w)}" height="12" rx="1.5" fill="none" stroke="${red}" stroke-width="1.5"/>${C(x + w / 2, y + 9.5, text, 9, red, 'text-anchor="middle" letter-spacing="1"')}</g>`
}

// ---------------------------------------------------------------- ATTORNEY AT LAW (the level card)
const attorneyPer = (W: number): number => Math.max(3, Math.floor((W - 24) / 66))
export const attorneyHeight = (W: number): number => 262 + Math.ceil(9 / attorneyPer(W)) * 46 + 30
export const attorneyCard = (W: number, c: Cred, gene: boolean, o: { fresh?: boolean; freshBadge?: string } = {}): string => {
  const P = pal(gene)
  const level = levelOf(c.xp)
  const tier = tierOf(level)
  const H = attorneyHeight(W)
  const s = [svgOpen(W, H), frameOf(W, H, P.tile, P.line)]
  s.push(cardTitle(16, 26, 'ATTORNEY AT LAW', P.gold, P.text))
  s.push(T(W - 16, 26, gene ? 'Omaha · Nebraska' : 'Albuquerque · New Mexico', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  s.push(`<g${o.fresh ? ' class="bcs-flip"' : ''}>${bizCard(16, 46, tier, gene)}</g>`)
  const cx0 = 210
  const cw = W - 16 - cx0
  s.push(T(cx0, 56, 'RANK', 9.5, 700, P.muted, 'letter-spacing=".8"'))
  const rank = bcsRankOf(level)
  s.push(S(cx0, 78, rank, fitBy(serifW, rank, cw, 19, 13), 700, P.text, o.fresh ? 'class="bcs-fresh"' : ''))
  s.push(T(cx0, 96, clipBy(sansW, `Level ${level} · ${TIER_NAMES[tier]}`, 11.5, cw), 11.5, 400, P.sub))
  s.push(T(cx0, 120, 'NEXT CARD', 9.5, 700, P.muted, 'letter-spacing=".8"'))
  const need = xpFor(level + 1)
  const have = xpFor(level)
  const pct = need > have ? (c.xp - have) / (need - have) : 1
  s.push(`<rect x="${cx0}" y="126" width="${cw}" height="5" rx="1" fill="${P.track}"/><rect x="${cx0}" y="126" width="${r1(cw * clamp(pct, 0, 1))}" height="5" rx="1" fill="${P.gold}"/>`)
  const xw = sansW(`${c.xp}`, 13, 0, true)
  s.push(`${T(cx0, 150, `${c.xp}`, 13, 700, P.text, 'font-variant-numeric="tabular-nums"')}${T(cx0 + xw + 4, 150, clipBy(sansW, `billables · ${Math.max(0, need - c.xp)} to level ${level + 1}`, 11.5, Math.max(0, cw - xw - 4)), 11.5, 400, P.sub)}`)
  const nx = nextRank(level)
  s.push(T(cx0, 166, nx ? clipBy(sansW, `${nx[0]} at level ${nx[1]}`, 11.5, cw) : 'Top of the ladder.', 11.5, 400, P.muted, 'font-style="italic"'))
  // the time sheet: a ruled billing form
  const ty = 178
  const th = 52
  const paper = prop('cream', gene)
  const ink = prop('creamInk', gene)
  const rule = prop('padRule', gene)
  s.push(`<rect x="16" y="${ty}" width="${W - 32}" height="${th}" fill="${paper}"/><rect x="16" y="${ty}" width="${W - 32}" height="12" fill="${prop('navy', gene)}"/>`)
  s.push(S(22, ty + 9, 'TIME SHEET', 8, 700, paper, 'letter-spacing="1.6"'))
  s.push(S(W - 22, ty + 9, gene ? 'G. TAKAVIC' : 'S. GOODMAN, ESQ.', 8, 400, paper, 'text-anchor="end" letter-spacing="1"'))
  const cols: [string, number][] = [['CLIENTS', c.jobs], ['LONG MATTERS', c.longJobs], ['ASSOCIATES', c.agents], ['BILLABLES', c.xp]]
  const colW = (W - 32) / cols.length
  cols.forEach(([k, v], i) => {
    const x = 16 + i * colW
    if (i) s.push(`<line x1="${r1(x)}" y1="${ty + 12}" x2="${r1(x)}" y2="${ty + th}" stroke="${rule}" stroke-opacity=".7"/>`)
    s.push(T(x + 6, ty + 25, clipBy(sansW, k, 7.5, colW - 10, 0.6, true), 7.5, 700, ink, 'letter-spacing=".6" opacity=".75"'))
    s.push(T(x + 6, ty + 44, v ? String(v) : '—', 15, 700, ink, 'font-variant-numeric="tabular-nums"'))
  })
  s.push(`<line x1="16" y1="${ty + 30}" x2="${W - 16}" y2="${ty + 30}" stroke="${rule}" stroke-opacity=".5"/>`)
  // the matchbooks
  const my = ty + th + 22
  const earned = BCS_BADGES.filter(b => c.badges.includes(b.id)).length
  s.push(T(16, my, 'MATCHBOOKS', 9.5, 700, P.muted, 'letter-spacing=".8"'))
  s.push(T(16 + sansW('MATCHBOOKS', 9.5, 0.8, true) + 8, my, `${earned} of ${BCS_BADGES.length}`, 11.5, 700, P.text, 'font-variant-numeric="tabular-nums"'))
  s.push(T(W - 16, my, 'one per client won', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  const per = attorneyPer(W)
  const gap = per > 1 ? (W - 32 - per * 58) / (per - 1) : 0
  BCS_BADGES.forEach((b, i) => {
    const col = i % per
    const row = Math.floor(i / per)
    s.push(matchbook(16 + col * (58 + gap), my + 10 + row * 46, b, i, c.badges.includes(b.id), b.progress(c), gene, o.freshBadge === b.id))
  })
  const next = BCS_BADGES.find(b => !c.badges.includes(b.id))
  s.push(T(16, H - 12, next ? clipBy(sansW, `Next: ${next.name} · ${next.how} · ${Math.round(next.progress(c) * 100)}%`, 11.5, W - 32) : gene ? 'Every matchbook struck. It was just a name.' : "Every matchbook struck. S'all good, man!", 11.5, 400, P.sub, 'font-style="italic"'))
  if (gene) s.push(vignette(W, H) + grain(W, H))
  return `${s.join('\n')}</svg>`
}

// ---------------------------------------------------------------- LEGAL PAD (the activity card)
export const PAD_ROWS = 10
export const PAD_H = 236
export const legalPad = (W: number, beats: Beat[], pick: number, gene: boolean, task = ''): string => {
  const P = pal(gene)
  const H = PAD_H
  const total = beats.length
  const live = pick < 0 || pick >= total - 1
  const shown = beats.slice(-PAD_ROWS)
  const dropped = total - shown.length
  let pk = pick < 0 ? shown.length - 1 : pick - dropped
  let start = 0
  if (pk < 0) {
    start = Math.max(0, pick)
    pk = 0
  }
  const win = start ? beats.slice(start, start + PAD_ROWS) : shown
  const s = [svgOpen(W, H), frameOf(W, H, P.tile, P.line)]
  s.push(cardTitle(16, 26, 'LEGAL PAD', P.gold, P.text))
  const state = !total ? 'nothing on the pad' : live ? `${total} ${total === 1 ? 'call' : 'calls'} · live` : `${total} calls · line ${String(pick + 1).padStart(2, '0')}`
  s.push(T(16 + 9 + serifW('LEGAL PAD', 12.5, 1.2, true) + 10, 26, state + (total > PAD_ROWS ? ` · last ${PAD_ROWS} listed` : ''), 11, 400, live && total ? P.aT : P.sub, 'font-style="italic"'))
  s.push(T(W - 16, 26, gene ? 'G. Takavic' : 'K. Wexler', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  const px0 = 14
  const py0 = 38
  const pw = W - 28
  const ph = H - py0 - 12
  const rule = prop('padRule', gene)
  const marg = prop('padMargin', gene)
  const ink = prop('ink', gene)
  const inkL = prop('inkLight', gene)
  const pencil = prop('pencil', gene)
  s.push(`<rect x="${px0 + 2}" y="${py0 + 3}" width="${pw}" height="${ph}" fill="#000" opacity=".35"/><rect x="${px0}" y="${py0}" width="${pw}" height="${ph}" fill="${prop('pad', gene)}"/>`)
  s.push(`<rect x="${px0}" y="${py0}" width="${pw}" height="8" fill="${prop('padTop', gene)}"/>`)
  for (let i = 0; i < 6; i++) s.push(`<rect x="${r1(px0 + 10 + (i * (pw - 20)) / 5)}" y="${py0 + 2}" width="3" height="4" fill="${grey2('#5A2520', gene)}" opacity=".7"/>`)
  const mx = px0 + 36
  s.push(`<line x1="${mx}" y1="${py0 + 8}" x2="${mx}" y2="${py0 + ph}" stroke="${marg}"/><line x1="${mx + 3}" y1="${py0 + 8}" x2="${mx + 3}" y2="${py0 + ph}" stroke="${marg}" opacity=".7"/>`)
  const lh = 15
  const ly0 = py0 + 8 + 22
  for (let i = 0; i <= PAD_ROWS; i++) s.push(`<line x1="${px0}" y1="${r1(ly0 + i * lh)}" x2="${px0 + pw}" y2="${r1(ly0 + i * lh)}" stroke="${rule}" stroke-opacity=".75"/>`)
  s.push(Hd(mx + 10, ly0 - 5, clipBy(handW, `Re: ${task || 'the matter at hand'}`, 13, Math.max(20, pw - 110)), 13, ink))
  const dt = new Date(beats[total - 1]?.at ?? 0)
  s.push(Hd(px0 + pw - 10, ly0 - 5, `${dt.getMonth() + 1}/${dt.getDate()}`, 12, ink, 'text-anchor="end"'))
  if (!total) {
    s.push(T(mx + 12, ly0 + 11, 'Nothing on the pad yet.', 11.5, 700, pencil))
    s.push(T(mx + 12, ly0 + lh + 11, 'Every tool call gets a line.', 11, 400, pencil))
  }
  win.forEach((b, i) => {
    const y = ly0 + i * lh + 11
    const picked = i === pk
    const isLast = start === 0 && i === win.length - 1
    if (picked && !live) s.push(`<rect x="${mx + 5}" y="${r1(y - 10.5)}" width="${pw - (mx + 5 - px0) - 6}" height="13" fill="${prop('hi', gene)}" opacity=".45"/>`)
    if (isLast && live) s.push(`<circle class="bcs-pen" cx="${mx - 6}" cy="${y - 4}" r="2.4" fill="${ink}"/>`)
    else s.push(`<path d="M${mx - 10} ${r1(y - 5)}l2.5 3l5 -6.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    const t = hhmm(b.at)
    s.push(T(px0 + 4, y, t, 8, 400, pencil, 'font-variant-numeric="tabular-nums"'))
    const verb = verbOf(b.tool)
    let x = mx + 10
    s.push(T(x, y, b.who, 10.5, 700, ink))
    x += sansW(b.who, 10.5, 0, true) + 5
    s.push(T(x, y, verb, 10.5, 400, inkL, 'font-style="italic"'))
    x += sansW(verb, 10.5) + 5
    const room = px0 + pw - 8 - x
    s.push(`<text x="${r1(x)}" y="${r1(y)}" font-family="${'-apple-system,BlinkMacSystemFont,sans-serif'}" font-size="10.5" fill="${ink}"><title>${esc(`${t} ${b.who} ${b.tool}: ${b.text}`)}</title>${esc(clipBy(sansW, b.text, 10.5, room))}</text>`)
  })
  if (!live && total) {
    const sx = px0 + pw - 74
    const sy = py0 + 10
    s.push(`<g transform="rotate(4 ${sx + 32} ${sy + 20})"><rect x="${sx + 1}" y="${sy + 2}" width="64" height="40" fill="#000" opacity=".25"/><rect x="${sx}" y="${sy}" width="64" height="40" fill="${prop('sticky', gene)}"/>${Hd(sx + 32, sy + 17, 'line', 11, ink, 'text-anchor="middle"')}${Hd(sx + 32, sy + 33, String(pick + 1).padStart(2, '0'), 16, ink, 'text-anchor="middle"')}</g>`)
  }
  if (gene) s.push(vignette(W, H) + grain(W, H))
  return `${s.join('\n')}</svg>`
}
export const legalPadAlt = (beats: Beat[], pick: number): string => {
  if (!beats.length) return 'Legal pad: nothing yet'
  const b = beats[pick < 0 ? beats.length - 1 : Math.min(pick, beats.length - 1)] as Beat
  return `Legal pad: line ${pick < 0 ? beats.length : pick + 1} of ${beats.length}, ${b.who} ${verbOf(b.tool)} ${b.text} at ${hhmm(b.at)}`
}

// ---------------------------------------------------------------- THE DOCKET (the open matter and the closed cases)
export const DOCKET_ROW = 24
export const docketHeight = (n: number): number => 112 + 18 + Math.max(1, n) * DOCKET_ROW + 34
export const docketCard = (W: number, task: string, isWorking: boolean, done: number, total: number, legends: Legend[], gene: boolean, fresh = false): string => {
  const P = pal(gene)
  const n = Math.min(legends.length, 5)
  const H = docketHeight(n)
  const s = [svgOpen(W, H), frameOf(W, H, P.tile, P.line)]
  s.push(cardTitle(16, 26, 'THE DOCKET', P.gold, P.text))
  const status = isWorking ? 'In session…' : total > 0 && done >= total ? 'Matter closed.' : 'In recess.'
  s.push(T(16 + 9 + serifW('THE DOCKET', 12.5, 1.2, true) + 10, 26, status, 11, 400, isWorking ? P.aT : P.sub, 'font-style="italic"'))
  if (W >= 440) s.push(T(W - 16, 26, gene ? 'Omaha · Nebraska' : 'Saul Goodman & Associates', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  // the open matter: a manila folder pulled out of the tray
  const fx = 16
  const fy = 50
  const fw = W - 32
  const fh = 50
  const manila = prop('manila', gene)
  const mdark = prop('manilaDark', gene)
  const ink = prop('creamInk', gene)
  s.push(tab(fx + 6, fy - 10, 70, 10, prop('manilaTab', gene)) + S(fx + 41, fy - 2, 'OPEN', 8, 700, ink, 'text-anchor="middle" letter-spacing="1.4"'))
  s.push(`<rect x="${fx + 2}" y="${fy + 3}" width="${fw}" height="${fh}" fill="#000" opacity=".3"/><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="${manila}"/><rect x="${fx}" y="${fy}" width="${fw}" height="3" fill="${mdark}"/>`)
  const stickyW = 64
  const titleRoom = fw - 24 - stickyW - 12
  s.push(S(fx + 12, fy + 24, clipBy(serifW, task || 'No matter on the docket', 14, Math.max(20, titleRoom), 0, true), 14, 700, ink))
  if (total) {
    const k = Math.min(total, 16)
    for (let i = 0; i < k; i++) s.push(pip(i < done ? 'done' : i === done && isWorking ? 'running' : 'todo', fx + 17 + i * 13, fy + 38, gene))
    s.push(T(fx + 17 + k * 13 + 6, fy + 42, `${done} of ${total} steps`, 11, 400, ink, 'opacity=".85"'))
  } else s.push(T(fx + 12, fy + 42, 'No steps on the docket yet.', 11, 400, ink, 'opacity=".85"'))
  const sx = fx + fw - stickyW - 10
  const sy = fy + 8
  const word = isWorking ? 'IN PROGRESS' : total > 0 && done >= total ? 'CLOSED' : 'IN RECESS'
  s.push(`<g transform="rotate(-3 ${sx + stickyW / 2} ${sy + 16})"><rect x="${sx + 1}" y="${sy + 2}" width="${stickyW}" height="32" fill="#000" opacity=".25"/><rect x="${sx}" y="${sy}" width="${stickyW}" height="32" fill="${prop('adYellow', gene)}"/>${C(sx + stickyW / 2, sy + 20, word, 9.5, grey2('#241A05', gene), 'text-anchor="middle" letter-spacing="1"')}</g>`)
  // the tray
  const ty = fy + fh + 22
  s.push(T(16, ty, 'CLOSED CASES', 9.5, 700, P.muted, 'letter-spacing="1.2"'))
  s.push(T(W - 16, ty, 'matters of 3+ minutes', 11, 400, P.muted, 'text-anchor="end" font-style="italic"'))
  const ry0 = ty + 10
  const trayH = Math.max(1, n) * DOCKET_ROW + 14
  s.push(wood(10, ry0, 6, trayH, gene, 'trayL') + wood(W - 16, ry0, 6, trayH, gene, 'trayR') + wood(10, ry0 + trayH - 6, W - 20, 6, gene, 'trayB'))
  if (!n) {
    s.push(`<rect x="16.5" y="${ry0 + 4}" width="${W - 33}" height="${DOCKET_ROW - 4}" rx="2" fill="none" stroke="${P.muted}" stroke-dasharray="4 3" stroke-opacity=".6"/>`)
    s.push(T(26, ry0 + 18, clipBy(sansW, 'No closed cases yet. A matter that runs 3+ minutes gets filed here.', 11.5, W - 52), 11.5, 400, P.muted, 'font-style="italic"'))
  }
  legends.slice(0, n).forEach((l, i) => {
    const y = ry0 + 4 + i * DOCKET_ROW
    const fw2 = W - 32
    s.push(`<rect x="16" y="${y}" width="${fw2}" height="${DOCKET_ROW - 3}" fill="${i % 2 ? mdark : manila}"/><rect x="16" y="${y}" width="${fw2}" height="2" fill="${i % 2 ? '#B59A66' : mdark}"/>`)
    s.push(tab(22, y + 1, 16, DOCKET_ROW - 5, i % 2 ? manila : prop('manilaTab', gene)))
    const dur = durOf(l.ms)
    const cost = money(l.costUsd)
    const rw = sansW(`${dur} · ${cost}`, 11, 0, false)
    const stW = condW('CLOSED', 9, 1) + 12
    const taskRoom = fw2 - 32 - rw - 16 - stW - 12
    s.push(`<text x="46" y="${y + 15}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11.5" font-weight="700" fill="${ink}"><title>${esc(`${l.task} · ${dur} · ${cost}`)}</title>${esc(clipBy(sansW, l.task, 11.5, Math.max(10, taskRoom), 0, true))}</text>`)
    s.push(`<text x="${W - 22}" y="${y + 15}" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11" fill="${ink}" font-variant-numeric="tabular-nums" opacity=".9">${esc(dur)} · <tspan font-weight="700">${esc(cost)}</tspan></text>`)
    s.push(stamp(W - 22 - rw - 12 - stW, y + 4, 'CLOSED', gene, fresh && i === 0, i === 0 ? 0.95 : 0.6))
  })
  s.push(T(16, H - 11, n ? `${legends.length} closed · newest on top` : 'The tray fills as matters close.', 10.5, 400, P.muted, 'font-style="italic"'))
  if (gene) s.push(vignette(W, H) + grain(W, H))
  return `${s.join('\n')}</svg>`
}
export const docketAlt = (isWorking: boolean, done: number, total: number): string => `The docket: ${isWorking ? 'in session' : 'in recess'}, ${done} of ${total} steps`

/** The boot strip (W by 30): the Statue, OPENING THE OFFICE… with the season bars filling, then OPEN FOR BUSINESS. */
export const bcsBootLine = (W: number, gene: boolean, done = false): string => {
  const P = pal(gene)
  const words = gene ? GENE_BOOT : BCS_BOOT
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="30" viewBox="0 0 ${W} 30"><style>${CARD_CSS}</style>`
  s += statue(14, 6, 1, gene, done || gene ? '' : 'bcs-sway')
  const line = done ? (gene ? 'CLOCKED IN · It’s just a name.' : 'OPEN FOR BUSINESS · Better call Saul.') : `${words[0]}  ${words[1]}`
  s += T(34, 19, clipBy(sansW, line, 11.5, Math.max(20, W - 34 - 150), 0, done), 11.5, done ? 700 : 400, done ? P.text : P.sub, done ? '' : 'letter-spacing=".3"')
  s += eraBar(W - 134, 11, 120, 4, done ? 100 : 55, gene)
  return `${s}</svg>`
}
export { bell }
