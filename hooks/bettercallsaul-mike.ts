// Mike Ehrmantraut, the Better Call Saul skins' roaming easter egg (a fan homage to AMC / Sony Pictures Television).
// He walks across the band or the foot of a card, sits in his lawn chair with the paper, peeks over a ledge, and now and
// then (at most once per 30 minutes) a near-silent cameo takes the place of the engine's takeover: his bust slides in at
// a bottom corner with a plain bubble that says next to nothing. On the shared roamer engine (roamer.ts). Plain: no glow,
// no ghost copies. Hector creeps in at 95% context on THE DOCKET. Pure SVG strings, no state, all from the clock.

import { BCS_HECTOR, BCS_MIKE, BCS_MIKE_CHAIR } from './cast'
import { FONT, bell, clamp, grey, pal, px, r1, sansClip, sansW, sid, spW, BCS_CSS } from './bettercallsaul'
import type { RoamPlan, RoamTiming } from './roamer'
import type { ThemeRoamer } from './themes'

/** The words: next to nothing. The silence is the joke; no unverified quotes. */
export const MIKE_LINES = ['…', 'Mm-hm.', 'Yeah.', 'No.']
export const MIKE_COLORS = { accent: '#9FC2F0', accent2: '#E6C35C', text: '#F5EEE2' }
/** Appearances per 30 s window: more when the context runs high. */
export const mikeChance = (ctxPct: number): number => (ctxPct >= 95 ? 0.35 : 0.25)
export const CAMEO_MS = 3_000

const delayer = (startAt: number | undefined, tm: RoamTiming): ((x: number) => string) => {
  if (tm.delay) return x => `calc(${tm.delay} + ${r1(x)}s)`
  const base = tm.now !== undefined && startAt !== undefined ? (startAt - tm.now) / 1000 : 0
  return x => `${r1(base + x)}s`
}

/** The walk: feet at the origin, centred on x, a soft shadow, a 2-step bob. `s` is the pixel size. */
export const mikeWalk = (s: number, dir: 1 | -1, gene: boolean): string => {
  const w = spW(BCS_MIKE) * s
  const h = BCS_MIKE.rows.length * s
  return `<g pointer-events="none"><ellipse cx="0" cy="0" rx="${r1(w * 0.55)}" ry="${r1(s * 1.2)}" fill="#000" opacity=".35"/><g class="bcs-walk">${px(BCS_MIKE, -w / 2, -h, s, { grey: gene, flip: dir < 0 })}</g></g>`
}
/** The lawn-chair sit (his feet on the floor at floorY), centred on x. */
export const mikeSit = (x: number, floorY: number, s: number, dir: 1 | -1, gene: boolean): string => {
  const w = spW(BCS_MIKE_CHAIR) * s
  const h = BCS_MIKE_CHAIR.rows.length * s
  return `<g pointer-events="none"><ellipse cx="${r1(x)}" cy="${r1(floorY)}" rx="${r1(w * 0.5)}" ry="${r1(s * 1.2)}" fill="#000" opacity=".35"/>${px(BCS_MIKE_CHAIR, x - w / 2, floorY - h, s, { grey: gene, flip: dir < 0 })}</g>`
}
/** The peek: his top rows over a ledge at (x, y), glitching in and out like the engine's other acts. */
export const mikePeek = (x: number, y: number, plan: RoamPlan, tm: RoamTiming, gene: boolean): string => {
  const dly = delayer(plan.startAt, tm)
  const dur = plan.durMs / 1000
  const s = 1.6
  const w = spW(BCS_MIKE) * s
  const h = 20 * s
  const id = sid('bcspk', plan.bucket, x, y)
  return `<defs><clipPath id="${id}"><rect x="${r1(x - w)}" y="${r1(y - h - 4)}" width="${r1(w * 2)}" height="${r1(h + 4)}"/></clipPath></defs><g class="rm-pk" clip-path="url(#${id})"><g class="rm-in" style="animation-delay:${dly(0)}"><g class="rm-out" style="animation-delay:${dly(dur - 0.45)}"><g transform="rotate(-5 ${r1(x)} ${r1(y)})">${px(BCS_MIKE, x - w / 2, y - h + 2, s, { grey: gene, rows: [0, 20] })}</g></g></g></g>`
}

/** The cameo (the takeover): his bust slides in at a bottom corner, says next to nothing, slides out; 3 s. */
export const mikeCameo = (W: number, H: number, line: string, tm: RoamTiming, gene: boolean): string => {
  const P = pal(gene)
  const dly = delayer(tm.startAt, tm)
  const s = clamp((H * 0.4) / 20, 1.6, 2.7)
  const bw = spW(BCS_MIKE) * s
  const bh = 20 * s
  const right = (line.length + W) % 2 === 0
  const bx = right ? W - bw - 10 : 10
  const by = H - bh - 6
  const fs = 11.5
  const text = sansClip(line || '…', fs, Math.max(30, W - bw - 60), 0, true)
  const bbw = sansW(text, fs, 0, true) + 18
  const bbx = right ? bx - 8 - bbw : bx + bw + 8
  const bby = by + bh * 0.25
  const tail = right ? `M${r1(bbx + bbw)} ${r1(bby + 7)}l7 5l-7 5z` : `M${r1(bbx)} ${r1(bby + 7)}l-7 5l7 5z`
  const sx = right ? bw + 24 : -(bw + 24)
  return `<g class="bcs-cam" pointer-events="none" style="--sx:${r1(sx)}px;animation-delay:${dly(0)}">${px(BCS_MIKE, bx, by, s, { grey: gene, rows: [0, 20], flip: !right })}<g class="bcs-bub" style="animation-delay:${dly(0)}"><rect x="${r1(bbx)}" y="${r1(bby)}" width="${r1(bbw)}" height="24" rx="4" fill="${P.tile2}" stroke="${P.sub}" stroke-width="1.2"/><path d="${tail}" fill="${P.sub}"/><text x="${r1(bbx + bbw / 2)}" y="${r1(bby + 16)}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" font-weight="700" fill="${P.text}">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></g></g>`
}

/** Hector in his wheelchair at a card's bottom-right corner, ringing the bell, mad (past 95% context; THE DOCKET only). */
export const hectorCreep = (W: number, H: number, ctxPct: number, gene: boolean): string => {
  if (ctxPct < 95) return ''
  const sc = 1.1
  const w = spW(BCS_HECTOR) * sc
  const h = BCS_HECTOR.rows.length * sc
  const x = W - w - 14
  const y = H - h - 10
  return `<g pointer-events="none"><ellipse cx="${r1(x + w / 2)}" cy="${r1(y + h)}" rx="${r1(w * 0.6)}" ry="2" fill="#000" opacity=".35"/>${px(BCS_HECTOR, x, y, sc, { grey: gene })}${bell(x - 16, y + h - 12, 1.2, 'mad', gene)}</g>`
}

/** Where he peeks and sits on the pane's cards (W wide, H tall): over the LEGAL PAD's top edge, on THE DOCKET's tray. */
export const mikePaneSpots = (W: number, H: number): { peek: { x: number; y: number }; sit: { x: number; y: number } } => ({ peek: { x: Math.max(40, W - 110), y: 38 }, sit: { x: Math.max(40, W - 44), y: H - 22 } })
/** The band's ledge: the bottom edge at the far right, clear of the readouts. */
export const mikeBandSpots = (W: number, H: number): { peek: { x: number; y: number } } => ({ peek: { x: Math.max(40, W - 22), y: H } })

/** One skin's Mike: the plan's seed differs between the two skins, so they do not cameo in step. */
export const mikeRoamer = (gene: boolean): ThemeRoamer => ({
  sprite: BCS_MIKE,
  colors: MIKE_COLORS,
  seed: gene ? 'bcs-gene-mike' : 'bcs-mike',
  lines: MIKE_LINES,
  chance: mikeChance,
  peek: (x, y, plan, tm) => mikePeek(x, y, plan, tm, gene),
  spots: mikePaneSpots,
  bandSpots: mikeBandSpots,
  walk: (s, dir) => mikeWalk(s, dir, gene),
  sit: (x, floorY, s, dir) => mikeSit(x, floorY, s, dir, gene),
  creep: (W, H, ctxPct, card) => (card === 'task' ? hectorCreep(W, H, ctxPct, gene) : ''),
  cardOf: kind => (kind === 'peek' ? 'log' : kind === 'sit' ? 'task' : 'cred'),
  sitBar: false,
  hushParty: true,
  css: '',
})
export { BCS_CSS, grey }
