// What a theme's roaming character draws over a panel: her walk, peek or sit, or in rare windows the
// takeover, plus whatever creeps in as the context climbs. Pure functions, no `$`: the plan comes from
// the seed and the clock alone (roamer.ts), so a redraw anywhere in her act gives the same picture.
//
//   band:  `roamOverlay(th, { W, H, surface: 'band', at, ctxPct, spots })`, appended last to the band
//          (after the celebration), so the takeover covers everything.
//   pane:  `overlayInto(cardSvg, th, { at, ctxPct })`, spliced into a card's drawing.
import { roamLive, roamPlan, roamerMarkup, takeoverMarkup, ROAM_CSS, ROAM_WINDOW_MS } from './roamer'
import type { RoamOpts, RoamPlan, RoamTiming } from './roamer'
import { pin } from './smooth'
import type { ThemeEggs, ThemeRoamer } from './themes'

export type Spots = { peek?: { x: number; y: number }; sit?: { x: number; y: number } }
export type OverlayArgs = { W: number; H: number; surface: 'band' | 'pane'; at: number; ctxPct: number; spots?: Spots; /** The job-done celebration is drawing: no hack lines. */ party?: boolean }

/** The plan's options: the theme's chance for this context, a takeover at most once per 30 minutes. */
export const roamOptsOf = (r: ThemeRoamer, ctxPct: number): RoamOpts => ({ chance: r.chance(ctxPct), takeoverEveryMin: 30, lines: r.lines })

/** The theme's hack lines for a panel (if it has them), with her plan for the window: more often while she is out. */
const hackOf = (th: ThemeEggs, o: OverlayArgs, plan: RoamPlan, card?: 'cred' | 'log'): string =>
  th.roamer?.hack ? th.roamer.hack({ W: o.W, H: o.H, surface: o.surface, at: o.at, ctxPct: o.ctxPct, roam: plan, ...(o.party ? { party: true } : {}), ...(card ? { card } : {}) }) : ''

export const roamOverlay = (th: ThemeEggs, o: OverlayArgs & { card?: 'cred' | 'log' }): string => {
  const r = th.roamer
  if (!r) return ''
  const creep = r.creep && o.surface === 'pane' ? r.creep(o.W, o.H, o.ctxPct) : ''
  const plan = roamPlan(r.seed, o.at, roamOptsOf(r, o.ctxPct))
  const hack = hackOf(th, o, plan, o.card)
  if (!roamLive(plan, o.at)) return `${creep}${hack}`
  // Pinned to the wall clock: a redraw anywhere in the act resumes the same animation.
  const tm: RoamTiming = { delay: pin(plan.startAt), startAt: plan.startAt }
  const css = `<style>${ROAM_CSS}${r.css ?? ''}</style>`
  if (plan.kind === 'takeover') return `${creep}${css}${th.takeover ? th.takeover(o.W, o.H, plan.line, tm) : takeoverMarkup(o.W, o.H, r.sprite, plan.line, r.colors, tm)}${hack}`
  const spot = plan.kind === 'sit' ? o.spots?.sit : o.spots?.peek
  if (plan.kind === 'peek' && spot && r.peek) return `${creep}${css}${r.peek(spot.x, spot.y, plan, tm)}${hack}`
  const timing: RoamTiming = { ...(spot ? { ...tm, peekAt: spot, ...(plan.kind === 'sit' ? { perchY: spot.y } : {}) } : tm), ...(r.halo ? { halo: r.halo } : {}) }
  return `${creep}${css}${roamerMarkup(r.sprite, plan, o.W, o.H, o.surface, r.colors, timing)}${hack}`
}

/** A card's drawing with the overlay spliced in before its closing tag (W and H read from its root). */
export const overlayInto = (svg: string, th: ThemeEggs, o: { at: number; ctxPct: number; party?: boolean }): string => {
  const r = th.roamer
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  if (!r || !root) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H)) return svg
  const over = roamOverlay(th, { W, H, surface: 'pane', at: o.at, ctxPct: o.ctxPct, card: 'cred', ...(o.party ? { party: true } : {}), ...(r.spots ? { spots: r.spots(W, H) } : {}) })
  return over ? `${svg.slice(0, svg.lastIndexOf('</svg>'))}${over}</svg>` : svg
}

/** A card's drawing with only the theme's hack lines spliced in (for a card that carries no roamer, such as the log). */
export const hackInto = (svg: string, th: ThemeEggs, o: { at: number; ctxPct: number; card: 'cred' | 'log'; party?: boolean }): string => {
  const r = th.roamer
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  if (!r?.hack || !root) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H)) return svg
  const plan = roamPlan(r.seed, o.at, roamOptsOf(r, o.ctxPct))
  const over = hackOf(th, { W, H, surface: 'pane', at: o.at, ctxPct: o.ctxPct, ...(o.party ? { party: true } : {}) }, plan, o.card)
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

/** Is she out on the band right now (a walk, peek or sit, not a takeover)? The band's frame goes possessed while she is. */
export const roamOnBand = (th: ThemeEggs, at: number, ctxPct: number): boolean => {
  const r = th.roamer
  if (!r) return false
  const plan = roamPlan(r.seed, at, roamOptsOf(r, ctxPct))
  return roamLive(plan, at) && plan.kind !== 'takeover'
}
