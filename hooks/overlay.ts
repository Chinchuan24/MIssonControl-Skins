// What a theme's roaming character draws over a panel: her walk, peek or sit, or in rare windows the
// takeover, plus whatever creeps in as the context climbs. Pure functions, no `$`: the plan comes from
// the seed and the clock alone (roamer.ts), so a redraw anywhere in her act gives the same picture.
//
//   band:  `roamOverlay(th, { W, H, surface: 'band', at, ctxPct, spots })`, appended last to the band
//          (after the celebration), so the takeover covers everything.
//   pane:  `overlayInto(cardSvg, th, { at, ctxPct })`, spliced into a card's drawing.
import { roamLive, roamPlan, roamerMarkup, takeoverMarkup, ROAM_CSS, ROAM_WINDOW_MS } from './roamer'
import type { RoamOpts, RoamTiming } from './roamer'
import { pin } from './smooth'
import type { ThemeEggs, ThemeRoamer } from './themes'

export type Spots = { peek?: { x: number; y: number }; sit?: { x: number; y: number } }
export type OverlayArgs = { W: number; H: number; surface: 'band' | 'pane'; at: number; ctxPct: number; spots?: Spots }

/** The plan's options: the theme's chance for this context, a takeover at most once per 30 minutes. */
export const roamOptsOf = (r: ThemeRoamer, ctxPct: number): RoamOpts => ({ chance: r.chance(ctxPct), takeoverEveryMin: 30, lines: r.lines })

export const roamOverlay = (th: ThemeEggs, o: OverlayArgs): string => {
  const r = th.roamer
  if (!r) return ''
  const creep = r.creep ? r.creep(o.W, o.H, o.ctxPct) : ''
  const plan = roamPlan(r.seed, o.at, roamOptsOf(r, o.ctxPct))
  if (!roamLive(plan, o.at)) return creep
  // Pinned to the wall clock: a redraw anywhere in the act resumes the same animation.
  const tm: RoamTiming = { delay: pin(plan.startAt), startAt: plan.startAt }
  const css = `<style>${ROAM_CSS}${r.css ?? ''}</style>`
  if (plan.kind === 'takeover') return `${creep}${css}${th.takeover ? th.takeover(o.W, o.H, plan.line, tm) : takeoverMarkup(o.W, o.H, r.sprite, plan.line, r.colors, tm)}`
  const spot = plan.kind === 'sit' ? o.spots?.sit : o.spots?.peek
  if (plan.kind === 'peek' && spot && r.peek) return `${creep}${css}${r.peek(spot.x, spot.y, plan, tm)}`
  const timing: RoamTiming = spot ? { ...tm, peekAt: spot, ...(plan.kind === 'sit' ? { perchY: spot.y } : {}) } : tm
  return `${creep}${css}${roamerMarkup(r.sprite, plan, o.W, o.H, o.surface, r.colors, timing)}`
}

/** A card's drawing with the overlay spliced in before its closing tag (W and H read from its root). */
export const overlayInto = (svg: string, th: ThemeEggs, o: { at: number; ctxPct: number }): string => {
  const r = th.roamer
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  if (!r || !root) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H)) return svg
  const over = roamOverlay(th, { W, H, surface: 'pane', at: o.at, ctxPct: o.ctxPct, ...(r.spots ? { spots: r.spots(W, H) } : {}) })
  return over ? `${svg.slice(0, svg.lastIndexOf('</svg>'))}${over}</svg>` : svg
}

/**
 * Did a takeover start within the last `ms` before `now`? The plan is a pure function of the clock, so
 * this needs no memory of what was drawn: "hi capri" typed within a minute of one is the secret skin's key.
 */
export const takeoverWithin = (th: ThemeEggs, now: number, ms: number): boolean => {
  const r = th.roamer
  if (!r) return false
  for (let b = Math.floor((now - ms) / ROAM_WINDOW_MS); b <= Math.floor(now / ROAM_WINDOW_MS); b++) {
    const plan = roamPlan(r.seed, b * ROAM_WINDOW_MS, roamOptsOf(r, 0))
    if (plan.kind === 'takeover' && plan.startAt <= now && now - plan.startAt <= ms) return true
  }
  return false
}
