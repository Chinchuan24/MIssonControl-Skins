// The Better Call Saul skins' rare scheduled eggs. Every one is a pure function of the clock (a seeded slot, like the
// roamer's takeover), drawn only inside its window and pinned to the wall clock with `pin()`, so an idle redraw still
// shows it and resumes where it was. Pixel art and props only; no sound; nothing above 3 Hz; reduced motion in BCS_CSS.
//
//   car     Jimmy's beat-up yellow two-door hatchback putters across the foot of the band, ~once per 10-20 min
//   gus     Gus walks onto the band, straightens his tie in two frames and walks out, ~once per 30-45 min (never with Mike's cameo)
//   lalo    Lalo rises through the floorboards at the bottom edge of THE DOCKET or the LEGAL PAD, rarely
//   unplug  Chuck "unplugs": 4+ tool calls in 10 s (or 4+ running agents) dim the band and the LEGAL PAD to lantern light for 4 s
import { BCS_CHUCK, BCS_GUS, BCS_LALO } from './cast'
import type { Sprite } from './cast'
import { PROPS, clamp, px, r1, sid, spW, prop } from './bettercallsaul'
import { ROAM_WINDOW_MS, roamPlan, unit } from './roamer'
import { pin } from './smooth'

import type { ExtraArgs } from './themes'
import { fxLayer } from './bettercallsaul-fx'
export type Surface = 'band' | 'pane'

export type Slot = { on: boolean; startAt: number; endAt: number; bucket: number }
/**
 * A rare act as a function of the clock: slots twice as long as the gap, the act always in the slot's first half, so two
 * of them are never closer than `gapMin` minutes, with no memory of the last one.
 */
export const slotPlan = (seed: string, at: number, gapMin: number, chance: number, durMs: number): Slot => {
  const gap = gapMin * 60_000
  const slot = Math.floor(at / (2 * gap))
  const startAt = slot * 2 * gap + Math.floor(unit(`${seed}|b|${slot}`) * Math.max(1, gap - durMs))
  const on = unit(`${seed}|on|${slot}`) < chance
  return { on, startAt, endAt: startAt + durMs, bucket: slot }
}
const live = (p: Slot, at: number): boolean => p.on && at >= p.startAt && at < p.endAt

export const CAR_MS = 14_000
export const GUS_MS = 13_000
export const LALO_MS = 5_000
export const UNPLUG_MS = 4_000
/** After one, the next waits this long (an engine rule, not a slot). */
export const UNPLUG_GAP_MS = 120_000
export const carSeed = (gene: boolean): string => (gene ? 'bcs-gene-car' : 'bcs-car')
export const gusSeed = (gene: boolean): string => (gene ? 'bcs-gene-gus' : 'bcs-gus')
export const laloSeed = (gene: boolean): string => (gene ? 'bcs-gene-lalo' : 'bcs-lalo')
const mikeSeed = (gene: boolean): string => (gene ? 'bcs-gene-mike' : 'bcs-mike')
export const carPlan = (at: number, gene: boolean): Slot => slotPlan(carSeed(gene), at, 5, 0.7, CAR_MS)
export const lalooPlan = (at: number, gene: boolean): Slot & { card: 'task' | 'log' } => {
  const p = slotPlan(laloSeed(gene), at, 15, 0.6, LALO_MS)
  return { ...p, card: unit(`${laloSeed(gene)}|card|${p.bucket}`) < 0.5 ? 'task' : 'log' }
}
/** Gus never comes in the same breath as Mike's cameo: a plan whose window meets a takeover of Mike's is off. */
export const gusPlan = (at: number, gene: boolean): Slot => {
  const p = slotPlan(gusSeed(gene), at, 20, 0.95, GUS_MS)
  if (!p.on) return p
  for (let b = Math.floor((p.startAt - 3_000) / ROAM_WINDOW_MS); b <= Math.floor((p.endAt + 3_000) / ROAM_WINDOW_MS); b++) {
    if (roamPlan(mikeSeed(gene), b * ROAM_WINDOW_MS, { chance: 0, takeoverEveryMin: 30 }).kind === 'takeover') return { ...p, on: false }
  }
  return p
}

/** Chuck unplugs when 4 or more tool calls ran within 10 s, or 4 or more agents are running. */
export const shouldUnplug = (callTimes: number[], now: number, running: number): boolean => running >= 4 || callTimes.filter(t => t > now - 10_000 && t <= now).length >= 4

// --- Jimmy's car: a tiny beat-up yellow two-door hatchback, no badge. 16 by 8 pixels.
const CAR: Sprite = {
  rows: ['................', '....yyyyyyy.....', '...ywwwywwwy....', '..yywwwywwwyy...', '.yyyyyyyyyyyyy..', 'yyyyyyyyyyyyyyyd', 'dyyyyyydyyyyyyyd', '.kkk.dddddd.kkk.'],
  pal: { y: PROPS.car, w: '#33414F', d: PROPS.carDark, k: '#15161A' },
}
export const car = (W: number, H: number, p: Slot, gene: boolean): string => {
  const s = 1.3
  return `<g transform="translate(0 ${r1(H - 9.5 - 0)})" pointer-events="none"><g class="bcs-go" style="--a:-30px;--b:${W + 30}px;animation-duration:${CAR_MS / 1000}s;animation-delay:calc(${pin(p.startAt)} + 0s)"><g class="bcs-putt">${px(CAR, 0, -8 * s + 8, s, { grey: gene })}</g></g></g>`
}

// --- Gus: walks in, straightens his tie (two frames), walks out. His tie is the dark column on his chest; frame two shifts it a pixel.
const tieShifted = (rows: string[]): string[] =>
  rows.map((row, i) => {
    if (i < 10 || i > 18) return row
    const a = [...row]
    const at = a.map((ch, j) => (ch === 'd' && j >= 5 && j <= 8 ? j : -1)).filter(j => j >= 0)
    if (!at.length) return row
    at.forEach(j => { a[j] = 'c' })
    at.forEach(j => { if (j + 1 <= 9) a[j + 1] = 'd' })
    return a.join('')
  })
export const gus = (W: number, H: number, at: number, p: Slot, gene: boolean): string => {
  const s = 1.7
  const w = spW(BCS_GUS) * s
  const h = BCS_GUS.rows.length * s
  const stand = Math.round(W * (0.3 + 0.35 * unit(`gusx|${p.bucket}`)))
  const d0 = `calc(${pin(p.startAt)} + 0s)`
  const d1 = `calc(${pin(p.startAt)} + 8.6s)`
  const frames = `<g class="bcs-tie1">${px(BCS_GUS, -w / 2, -h, s, { grey: gene })}</g><g class="bcs-tie2">${px(BCS_GUS, -w / 2, -h, s, { grey: gene, rowsOverride: tieShifted(BCS_GUS.rows) })}</g>`
  void at
  return `<g transform="translate(${stand} ${H - 5})" pointer-events="none"><g class="bcs-go" style="--a:${-(stand + 60)}px;--b:0px;animation-duration:4s;animation-delay:${d0}"><g class="bcs-go" style="--a:0px;--b:${W - stand + 60}px;animation-duration:4s;animation-delay:${d1}"><ellipse cx="0" cy="0" rx="${r1(w * 0.55)}" ry="2" fill="#000" opacity=".35"/><g class="bcs-walk">${frames}</g></g></g></g>`
}

// --- Lalo rises through the floorboards at a card's bottom edge: head and shoulders, then sinks back.
export const lalo = (W: number, H: number, p: Slot, gene: boolean): string => {
  const s = 1.6
  const rows: [number, number] = [0, 22]
  const w = spW(BCS_LALO) * s
  const h = (rows[1] - rows[0]) * s
  const x = Math.round(W * (0.3 + 0.4 * unit(`lalox|${p.bucket}`)))
  const id = sid('bcslalo', W, H, x)
  const wd = prop('wood', gene)
  const wdk = prop('woodDark', gene)
  return `<defs><clipPath id="${id}"><rect x="${r1(x - w)}" y="${r1(H - 4 - h)}" width="${r1(w * 2)}" height="${r1(h)}"/></clipPath></defs><g pointer-events="none"><g clip-path="url(#${id})"><g class="bcs-up" style="--d:${LALO_MS / 1000}s;animation-delay:calc(${pin(p.startAt)} + 0s)">${px(BCS_LALO, x - w / 2, H - 4 - h, s, { grey: gene, rows })}</g></g><rect x="${r1(x - w * 0.8)}" y="${H - 4}" width="${r1(w * 1.6)}" height="4" fill="${wd}"/><path d="M${r1(x - w * 0.8)} ${H - 2}h${r1(w * 1.6)}M${r1(x - w * 0.2)} ${H - 4}v4" stroke="${wdk}"/></g>`
}

// --- Chuck unplugs: the panel dims to warm lantern light for 4 s, and Chuck peeks in under his space blanket.
export const unplug = (W: number, H: number, unplugAt: number, gene: boolean, surface: Surface): string => {
  const s = 1.6
  const rows: [number, number] = [0, 26]
  const w = spW(BCS_CHUCK) * s
  const h = (rows[1] - rows[0]) * s
  const x = Math.round(W * (surface === 'band' ? 0.42 : 0.62))
  const id = sid('bcschk', W, H, x)
  const dly = `animation-delay:calc(${pin(unplugAt)} + 0s)`
  const blanket = prop('blanket', gene)
  const top = H - h + 2
  const lamp = prop('lamp', gene)
  const bl = `<path d="M${r1(x - w * 0.62)} ${r1(top + h * 0.5)}L${r1(x - w * 0.2)} ${r1(top + h * 0.34)}L${r1(x + w * 0.2)} ${r1(top + h * 0.34)}L${r1(x + w * 0.62)} ${r1(top + h * 0.5)}L${r1(x + w * 0.7)} ${H}L${r1(x - w * 0.7)} ${H}Z" fill="${blanket}" opacity=".92"/><path d="M${r1(x - w * 0.3)} ${r1(top + h * 0.56)}l3 6l3 -5l3 7M${r1(x + w * 0.1)} ${r1(top + h * 0.58)}l3 7l3 -6l3 6" stroke="#8D949C" stroke-width="1" fill="none"/>`
  return `<g pointer-events="none"><g class="bcs-dim" style="${dly}"><rect width="${W}" height="${H}" fill="#120A03" opacity=".5"/><rect class="bcs-lamp" width="${W}" height="${H}" fill="${lamp}" opacity=".16"/></g><defs><clipPath id="${id}"><rect x="${r1(x - w)}" y="${r1(H - h - 2)}" width="${r1(w * 2)}" height="${r1(h + 2)}"/></clipPath></defs><g clip-path="url(#${id})"><g class="bcs-up" style="--d:${UNPLUG_MS / 1000}s;${dly}">${px(BCS_CHUCK, x - w / 2, top, s, { grey: gene, rows })}${bl}</g></g></g>`
}

/** The theme's extras for a panel: the car and Gus on the band; Lalo on THE DOCKET or the LEGAL PAD; Chuck's dim on the band and the LEGAL PAD. */
export const bcsExtras = (gene: boolean) => (o: ExtraArgs): string => {
  if (o.party) return ''
  const out: string[] = []
  if (o.surface === 'band') {
    const c = carPlan(o.at, gene)
    if (live(c, o.at)) out.push(car(o.W, o.H, c, gene))
    const g = gusPlan(o.at, gene)
    if (live(g, o.at)) out.push(gus(o.W, o.H, o.at, g, gene))
    if (o.fx) out.push(fxLayer(o.W, o.H, { kind: o.fx.kind as never, at: o.fx.at }, o.at, gene))
  } else {
    const l = lalooPlan(o.at, gene)
    if (live(l, o.at) && o.card === l.card) out.push(lalo(o.W, o.H, l, gene))
  }
  if (o.unplugAt !== undefined && o.at >= o.unplugAt - 1000 && o.at < o.unplugAt + UNPLUG_MS && (o.surface === 'band' || o.card === 'log')) out.push(unplug(o.W, o.H, o.unplugAt, gene, o.surface))
  void clamp
  return out.join('')
}
