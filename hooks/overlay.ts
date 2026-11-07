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
import type { ExtraArgs, PaneCard, ThemeEggs, ThemeRoamer } from './themes'
import { GLITCH_SEED, TRANSITION_MS, glitchEvents, glitchInto, transitionAt } from './edgerunners2-duet'
import type { Er2ModeName, TransitionOpts } from './edgerunners2-duet'
import { er2HackBurst } from './edgerunners2-hack'

export type Spots = { peek?: { x: number; y: number }; sit?: { x: number; y: number } }
export type OverlayArgs = { W: number; H: number; surface: 'band' | 'pane'; at: number; ctxPct: number; spots?: Spots; /** The job-done celebration is drawing: no hack lines. */ party?: boolean }
export type OverlayCard = PaneCard

/** The plan's options: the theme's chance for this context, a takeover at most once per 30 minutes. */
export const roamOptsOf = (r: ThemeRoamer, ctxPct: number): RoamOpts => ({ chance: r.chance(ctxPct), takeoverEveryMin: 30, lines: r.lines })

/** The theme's hack lines for a panel (if it has them), with her plan for the window: more often while she is out. */
const hackOf = (th: ThemeEggs, o: OverlayArgs, plan: RoamPlan, card?: 'cred' | 'log'): string =>
  th.roamer?.hack ? th.roamer.hack({ W: o.W, H: o.H, surface: o.surface, at: o.at, ctxPct: o.ctxPct, roam: th.roamer.still ? null : plan, roamFor: t => (th.roamer && !th.roamer.still ? roamPlan(th.roamer.seed, t, roamOptsOf(th.roamer, o.ctxPct)) : null), ...(o.party ? { party: true } : {}), ...(card ? { card } : {}) }) : ''

export const roamOverlay = (th: ThemeEggs, o: OverlayArgs & { card?: PaneCard }): string => {
  const r = th.roamer
  if (!r) return ''
  const creep = r.creep && o.surface === 'pane' ? r.creep(o.W, o.H, o.ctxPct, o.card) : ''
  const plan = roamPlan(r.seed, o.at, roamOptsOf(r, o.ctxPct))
  const hack = hackOf(th, o, plan, o.card === 'task' ? undefined : o.card)
  // A theme that spreads her acts over the cards (Mike peeks at the log, sits on the task card): the other cards draw none of it.
  if (r.cardOf && o.surface === 'pane' && plan.kind && o.card && r.cardOf(plan.kind) !== o.card) return `${creep}${hack}`
  // CAPRI mode: she is the HUD and never walks; the hack lines (and the creep) carry her presence.
  if (r.still || !roamLive(plan, o.at)) return `${creep}${hack}`
  // Pinned to the wall clock: a redraw anywhere in the act resumes the same animation.
  const tm: RoamTiming = { delay: pin(plan.startAt), startAt: plan.startAt }
  const css = `<style>${ROAM_CSS}${r.css ?? ''}</style>`
  if (plan.kind === 'takeover') return `${creep}${css}${th.takeover ? th.takeover(o.W, o.H, plan.line, tm) : takeoverMarkup(o.W, o.H, r.sprite, plan.line, r.colors, tm)}${hack}`
  const spot = plan.kind === 'sit' ? o.spots?.sit : o.spots?.peek
  if (plan.kind === 'peek' && spot && r.peek) return `${creep}${css}${r.peek(spot.x, spot.y, plan, tm)}${hack}`
  const timing: RoamTiming = { ...(spot ? { ...tm, peekAt: spot, ...(plan.kind === 'sit' ? { perchY: spot.y } : {}) } : tm), ...(r.halo ? { halo: r.halo } : {}), ...(r.walk ? { walk: r.walk } : {}), ...(r.sit ? { sit: r.sit } : {}) }
  return `${creep}${css}${roamerMarkup(r.sprite, plan, o.W, o.H, o.surface, r.colors, timing)}${hack}`
}

/** A card's drawing with the overlay spliced in before its closing tag (W and H read from its root). */
export const overlayInto = (svg: string, th: ThemeEggs, o: { at: number; ctxPct: number; party?: boolean; card?: PaneCard }): string => {
  const r = th.roamer
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  if (!r || !root) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H)) return svg
  const over = roamOverlay(th, { W, H, surface: 'pane', at: o.at, ctxPct: o.ctxPct, card: o.card ?? 'cred', ...(o.party ? { party: true } : {}), ...(r.spots ? { spots: r.spots(W, H) } : {}) })
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
  if (!r || r.still) return false
  for (let b = Math.floor((now - ms) / ROAM_WINDOW_MS); b <= Math.floor(now / ROAM_WINDOW_MS); b++) {
    const plan = roamPlan(r.seed, b * ROAM_WINDOW_MS, roamOptsOf(r, 0))
    if (plan.kind === 'takeover' && plan.startAt <= now && now - plan.startAt <= ms) return true
  }
  return false
}

/** Is she out on the band right now (a walk, peek or sit, not a takeover)? The band's frame goes possessed while she is. */
export const roamOnBand = (th: ThemeEggs, at: number, ctxPct: number): boolean => {
  const r = th.roamer
  if (!r || r.still) return false
  const plan = roamPlan(r.seed, at, roamOptsOf(r, ctxPct))
  return roamLive(plan, at) && plan.kind !== 'takeover'
}

// --- the two modes of Edgerunners 2 ------------------------------------------------------------

/** Which mode a theme draws (undefined: not Edgerunners 2). */
export const modeOf = (th: ThemeEggs | undefined): Er2ModeName | undefined => th?.mode

/**
 * A panel's drawing with its whole-panel glitches applied (CAPRI mode only; none while the celebration draws): CSS on a root
 * group, every event of the next minute and a quarter scheduled ahead and pinned to the clock, so an idle draw shows them.
 * `i` is the pane card's place in the cascade (the band is 0). The drawing is returned as it was when nothing is planned.
 */
export const glitchPanel = (svg: string, th: ThemeEggs | undefined, o: { at: number; ctxPct: number; party?: boolean; i?: number }): string =>
  th?.mode === 'capri' && !o.party ? glitchInto(svg, glitchEvents(GLITCH_SEED, o.at, o.ctxPct), o.i ?? 0) : svg

/** Is the possession transition still drawing? */
export const transitionLive = (since: number, now: number): boolean => since > 0 && now >= since - 1000 && now - since < TRANSITION_MS

/**
 * The transition overlay for a panel W by H right after a switch: the dying mode's veil, shards, avatar slices and the
 * mode chip typing in, plus the hack module's burst of five red lines pinned to the switch. '' once it is over.
 */
export const transitionLayer = (th: ThemeEggs | undefined, o: { W: number; H: number; surface: 'band' | 'pane'; since: number; now: number; i?: number; party?: boolean } & TransitionOpts): string => {
  if (!th?.mode || !transitionLive(o.since, o.now) || o.party) return ''
  const { W, H, surface, since, now, i, party: _party, ...rest } = o
  void _party
  const body = transitionAt(W, H, th.mode === 'capri' ? 'in' : 'out', since, now, { surface, ...rest })
  const burst = th.roamer?.hack && (surface === 'band' || (i ?? 0) === 0) ? er2HackBurst(th.mode === 'capri' ? 'capricorn' : 'er2', { W, H, surface, at: now, ctxPct: 0, roam: null }, since, th.mode === 'capri') : ''
  return `${body}${burst}`
}

/** A pane card's drawing with the transition layer spliced in before its closing tag. */
export const transitionInto = (svg: string, th: ThemeEggs | undefined, o: { since: number; now: number; i: number; lean?: boolean; party?: boolean }): string => {
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  if (!th?.mode || !root || !transitionLive(o.since, o.now)) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H) || H < 40) return svg
  const layer = transitionLayer(th, { W, H, surface: 'pane', since: o.since + 60 * o.i, now: o.now, i: o.i, ...(o.lean ? { lean: true } : {}), ...(o.party ? { party: true } : {}) })
  return layer ? `${svg.slice(0, svg.lastIndexOf('</svg>'))}${layer}</svg>` : svg
}

/** A card's drawing with the theme's rare scheduled eggs spliced in before its closing tag (Lalo through the floor, Chuck's dim). */
export const extrasInto = (svg: string, th: ThemeEggs, o: { at: number; ctxPct: number; card: PaneCard; party?: boolean; unplugAt?: number; fx?: { kind: string; at: number } }): string => {
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  if (!th.extras || !root) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H)) return svg
  const x: ExtraArgs = { W, H, surface: 'pane', at: o.at, ctxPct: o.ctxPct, card: o.card, ...(o.party ? { party: true } : {}), ...(o.unplugAt !== undefined ? { unplugAt: o.unplugAt } : {}), ...(o.fx ? { fx: o.fx } : {}) }
  const over = th.extras(x)
  return over ? `${svg.slice(0, svg.lastIndexOf('</svg>'))}${over}</svg>` : svg
}
