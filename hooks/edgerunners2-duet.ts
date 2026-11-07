// Cyberpunk: Edgerunners 2, the two modes of one skin: D mode and CAPRI mode (fan homage).
//
//   D mode      the duets (RIDE, LINK, POSSESS, PAIR): D and Capri together in the band's figure box, a bubble between the
//               header rule and the title's cap height (never over the title). D mode only.
//   both        the possession transition, 2 s, D <-> CAPRI: a hue veil in the old colour wipes away, the old avatar
//               dissolves in row slices, shards fly in (or out), the mode chip types in.
//   CAPRI mode  the fully possessed palette (black, hot red, acid green, white; text 5.2:1 or better) for the band AND the
//               whole pane, and in place of the roamer and the duets: occasional whole-panel glitches (a slice
//               displacement, an RGB split, a one-frame inversion in her colours, scanline jitter, a pixel-sort tear),
//               each 400 ms at most, applied as CSS on a panel's root group (nothing is copied).
//
// Pure SVG strings, no `$`, no state. Every plan is a pure function of (seed, 30 s window, clock) like roamer.ts, and
// every animation is pinned (`tm.delay` = `pin(startAt)`) so a redraw resumes instead of replaying.
//
// Capri is ONLY ER_CAPRI / ER_CAPRI_BUST / ER_CAPRI_BIG, D only ER_D. Holo effects frame them; nothing redraws them.
// No angle bracket may appear in the CSS below (not even in a comment): inside inline SVG the HTML parser does not treat a
// style element as raw text and the sheet dies at the first one.
import { ER_CAPRI, ER_CAPRI_BUST, ER_D } from './cast'
import { D_TRACE, K, KC, M, cham, clamp, delayer, er2W, mw, pixels, r1, streaks } from './edgerunners2'
import { ROAM_WINDOW_MS, unit } from './roamer'
import type { RoamPlan, RoamTiming } from './roamer'
import { pin } from './smooth'

export type Er2ModeName = 'd' | 'capri'
/** The skin's mode: when it last switched (ms, 0 after a restart) and whether the context rule did it. */
export type Er2Mode = { mode: Er2ModeName; since: number; auto: boolean }
export const ER2_MODE_DEFAULT: Er2Mode = { mode: 'd', since: 0, auto: false }
/** The transition is drawn while now - since is under this. */
export const TRANSITION_MS = 2500

// =====================================================================================================================
// 1. The CAPRI mode palette for register.tsx (drives PANE_CSS, the roles, the boss ring and the backdrop).
// =====================================================================================================================
export const CAPRI_MODE = {
  colors: { accent: '#FF1F4E', accent2: '#3DF27A', done: '#3DF27A', warn: '#FFB547', alert: '#FF1F4E', meter: '#FF1F4E', text: '#FFF3F5', subtext: '#F0B9C6', muted: '#A87F8D', tile: '#050305', track: '#1A0810', line: '#3A0E1E', grid: '#0B060A' },
  boss: ['#FF1F4E', '#3DF27A', '#050305', '#FFFFFF', '#FD0250'],
  roles: ['#FF1F4E', '#3DF27A', '#FF7A9E', '#9BFFC0', '#FF1459', '#1FBF5F'],
  backdrop: { fill: '#030203', pattern: 'none', ink: '' },
} as const

// =====================================================================================================================
// 2. The duets (D mode only): ride, link, possess, pair. A plan per 30 s window, like roamer.ts.
// =====================================================================================================================
export type DuetKind = 'ride' | 'link' | 'possess' | 'pair'
export type DuetPlan = { on: boolean; kind: DuetKind | null; bucket: number; startAt: number; endAt: number; durMs: number; line: string }
export const DUET_DUR: Record<DuetKind, number> = { ride: 5000, link: 4000, possess: 3200, pair: 6000 }
export const RIDE_LINES = ['relax, choom.', 'eyes up, D.', 'you need me.']
export const DUET_SEED = 'er2duet'

/** The chance of a duet in a free 30 s window: a little at the start, more from 85%, much more from 95%. */
export const duetChance = (ctxPct: number): number => (ctxPct >= 95 ? 0.6 : ctxPct >= 85 ? 0.2 : 0.12)

/**
 * What the pair does in the window containing `at`. Deterministic in (seed, window, context).
 * `roamFor(windowStart)` is the roamer's plan for a window (null: she is not out), so the duet never doubles her:
 *   - never in a window where she walks, peeks, sits or takes over;
 *   - RIDE chains after a right-to-left walk in the previous window (she left at D's side and comes back for him);
 *   - POSSESS in the window right after a takeover ("she is still in him"), or from 95% context;
 *   - otherwise a small chance of LINK, PAIR or RIDE, higher as the context climbs.
 */
export const duetPlan = (seed: string, at: number, ctxPct: number, roamFor: (windowStart: number) => RoamPlan | null = () => null): DuetPlan => {
  const bucket = Math.floor(at / ROAM_WINDOW_MS)
  const start = bucket * ROAM_WINDOW_MS
  const rnd = (salt: string) => unit(`${seed}|duet|${bucket}|${salt}`)
  const off: DuetPlan = { on: false, kind: null, bucket, startAt: start, endAt: start, durMs: 0, line: RIDE_LINES[Math.floor(rnd('line') * RIDE_LINES.length)] ?? 'relax, choom.' }
  const here = roamFor(start)
  if (here?.on) return off
  const prev = roamFor(start - ROAM_WINDOW_MS)
  const act = (kind: DuetKind, t0?: number): DuetPlan => {
    const durMs = DUET_DUR[kind]
    const startAt = start + Math.round(t0 ?? rnd('at') * (ROAM_WINDOW_MS - durMs - 1000))
    return { ...off, on: true, kind, startAt, endAt: startAt + durMs, durMs }
  }
  if (prev?.on && prev.kind === 'walk' && prev.dir === -1 && rnd('ride') < 0.55) return act('ride', 600)
  if (prev?.on && prev.kind === 'takeover' && rnd('after') < 0.7) return act('possess', 900)
  if (rnd('on') >= duetChance(ctxPct)) return off
  const k = rnd('kind')
  if (ctxPct >= 95) return act(k < 0.4 ? 'possess' : k < 0.7 ? 'link' : 'pair')
  return act(k < 0.45 ? 'link' : k < 0.85 ? 'pair' : 'ride')
}
export const duetLive = (plan: DuetPlan, now: number): boolean => plan.on && now >= plan.startAt && now < plan.endAt

/** A solid silhouette of whatever is drawn through it, in one explicit colour (the ghost copies are <use> through this). */
const silDefs = (id: string, color: string): string => `<filter id="${id}" x="-25%" y="-10%" width="150%" height="120%"><feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`
const silSet = (id: string): string => silDefs(`${id}h`, K.hot) + silDefs(`${id}g`, K.green) + silDefs(`${id}w`, K.white)

// D's box: ER_D at (31, 36) scale .85 on a 30 x 1 cobalt base at y 76 (er2Figure).
const DX = 31
const DY = 36
const DS = 0.85
const D_HEAD = 8 // rows [0, 8) nod
const D_ROWS = ER_D.rows.length
/** D in two parts (the head nods, the body breathes), plus a class hook for a flinch. */
const dFigure = (cls = ''): string => `<g class="cd-d ${cls}"><g class="cd-dh">${pixels(ER_D, DX, DY, DS, { rows: [0, D_HEAD] })}</g><g class="cd-db">${pixels(ER_D, DX, DY, DS, { rows: [D_HEAD, D_ROWS] })}</g></g>`
const dBase = (color: string): string => `<rect x="22" y="76" width="30" height="1" fill="${color}" fill-opacity=".5"/>`
// D's face: the scar (down the left cheek) and his eyes (row 5, cols 5 and 7).
const scar = (): string => `<g class="cd-scar" transform="translate(${DX} ${DY}) scale(${DS})" shape-rendering="crispEdges" fill="${K.red}"><rect x="5" y="4" width="1" height="1"/><rect x="5" y="5" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/></g>`
const eyesPink = (): string => `<g class="cd-eyes" transform="translate(${DX} ${DY}) scale(${DS})" shape-rendering="crispEdges" fill="${K.pink}"><rect x="5" y="5" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/></g>`
/** Capri beside him, floating in the gap between the link rail and his box. */
const CX = 11
const CY = 35
/** Capri once, with an id (a faint hot glow instead of a rim, which blurs her at this size); copies are <use>. */
const capriAt = (id: string, x: number, y: number): string => `<g class="cd-sp" style="filter:drop-shadow(0 0 1.2px ${K.hot})"><g id="${id}">${pixels(ER_CAPRI, x, y, DS)}</g></g>`
/** Her pink / green split: two silhouettes of the figure `id`, flashing now and then (<use>, no second copy of her pixels). */
const ghostPair = (id: string, dx = 2.5, at = ''): string => `<g class="cd-g1" opacity="0" ${at}><use href="#${id}" x="${-dx}" filter="url(#${id}h)" opacity=".7"/></g><g class="cd-g2" opacity="0" ${at}><use href="#${id}" x="${dx}" filter="url(#${id}g)" opacity=".7"/></g>`
/** A tiny chamfered bubble that types `line` (mono 7.5 px) at (x, y): 10 tall, between the header rule and the title's cap height. */
const bubble = (x: number, y: number, line: string, dly: (t: number) => string, at: number): string => {
  const n = [...line].length
  const twd = r1(n * 4.6)
  const w = twd + 12
  const typeFor = r1(clamp(0.06 * n + 0.1, 0.4, 1))
  return `<g class="cd-bub" style="animation-delay:${dly(at)}"><path d="${cham(x, y, w, 10, 3, 1)}" fill="${K.black}" fill-opacity=".94" stroke="${K.hot}" stroke-opacity=".8" stroke-width=".8"/><path d="M${r1(x)} ${r1(y + 5)}l-4 2.5l4 2.5z" fill="${K.hot}"/>${M(x + 6, y + 7.6, line, 7.5, K.white, 'font-weight="700"')}<rect class="cd-ty" x="${r1(x + 5)}" y="${r1(y + 1)}" width="${r1(twd + 3)}" height="8" fill="${K.black}" style="animation-delay:${dly(at + 0.2)};animation-duration:${typeFor}s;animation-timing-function:steps(${n},end)"/></g>`
}

/**
 * The figure slot's whole content while a duet is on (D, Capri, effects, bubble), or '' when it is off. Drawn where the
 * band draws its figure (before the title text), so the bubble sits under the title and can never hide it. `tm.delay`
 * is the pinned start (`pin(plan.startAt)`), or `tm.now` plays the plan from a plain clock. Needs DUET_CSS.
 */
export const duet = (plan: DuetPlan, tm: RoamTiming = {}): string => {
  if (!plan.on || plan.kind === null) return ''
  if (tm.now !== undefined && !duetLive(plan, tm.now)) return ''
  const dly = delayer(plan.startAt, tm)
  const dur = plan.durMs / 1000
  const D = (t: number) => `style="animation-delay:${dly(t)}"`
  const out = (t: number) => `class="cd-out" ${D(t)}`
  const base = dBase('#3E80F7')
  const id = `cd${plan.bucket % 100000}`
  if (plan.kind === 'ride') {
    // She glides in from the left edge (where her walk ended) to his shoulder, drapes over it from behind, bobs; he nods; the
    // bubble types; she glitches out. Her pixels once, behind him; her arm (rows 15-19, the reach) is a clipped <use> in front.
    const RX = DX + 7 * DS
    const RY = DY - 5.5 * DS
    const defs = `<defs>${silSet(id)}<clipPath id="${id}a"><rect x="${r1(RX)}" y="${r1(RY + 15 * DS)}" width="${r1(8 * DS)}" height="${r1(5 * DS)}"/></clipPath></defs>`
    const glide = `class="cd-glide" style="--a:-62px;--b:18px;animation-delay:${dly(0)}"`
    return `${defs}${base}<g class="cd-in" ${D(0)}><g ${out(dur - 0.45)}><g ${glide}><g class="cd-bob" ${D(0.9)}>${capriAt(id, RX, RY)}</g></g></g></g>${dFigure('cd-nodding')}<g class="cd-in" ${D(0)}><g ${out(dur - 0.45)}><g ${glide}><g class="cd-bob" ${D(0.9)}><use href="#${id}" clip-path="url(#${id}a)"/>${ghostPair(id, 2, D(0))}</g></g>${bubble(58, 33, plan.line, dly, 1.3)}</g></g>`
  }
  if (plan.kind === 'link') {
    // She glitches in by the link rail; a beam arcs from her eyes to his head; he flinches, the scar flashes red, his eyes
    // glow pink for a beat; the beam retracts; she glitches out.
    const ex = CX + 9.5 * DS
    const ey = CY + 12 * DS
    const hx = DX + 6.5 * DS
    const hy = DY + 5 * DS
    const d = `M${r1(ex)} ${r1(ey)}Q${r1((ex + hx) / 2)} ${r1(Math.min(ey, hy) - 9)} ${r1(hx)} ${r1(hy)}`
    const beam = `<g class="cd-beam" ${D(0.9)}><path d="${d}" fill="none" stroke="${K.green}" stroke-width="1.6" stroke-opacity=".35"/><path class="cd-draw" d="${d}" fill="none" stroke="${K.hot}" stroke-width="1" stroke-dasharray="40 40" ${D(0.9)}/><circle class="cd-led" cx="${r1(hx)}" cy="${r1(hy)}" r="1.6" fill="${K.white}" ${D(1.1)}/></g>`
    return `<defs>${silSet(id)}</defs>${base}<g class="cd-in" ${D(0)}><g ${out(dur - 0.45)}><g class="cd-bob" ${D(0)}>${capriAt(id, CX, CY)}${ghostPair(id, 2.5, D(0))}</g></g></g><g class="cd-flinch" ${D(1.05)}>${dFigure()}<g class="cd-flash" ${D(1.05)}>${scar()}</g><g class="cd-glow" ${D(1.15)}>${eyesPink()}</g></g>${beam}`
  }
  if (plan.kind === 'possess') {
    // His own pixels, re-used through a hue filter (cobalt to her hot pink) and his eyes pink; her ghost is one mono
    // silhouette of her figure (white, 35%) with the pink / green split flashing over it; pixel-sort streaks across the box.
    const swapped = `<defs>${silSet(id)}</defs><g class="cd-poss" ${D(0)}><g class="cd-snap" ${D(dur - 0.7)}><use href="#${id}d" style="filter:hue-rotate(128deg) saturate(1.8) brightness(1.15)"/><g class="cd-glow" ${D(0.3)}>${eyesPink()}</g><use href="#${id}" filter="url(#${id}w)" opacity=".35"/>${ghostPair(id, 2.5, D(0))}${streaks(14, 38, 44, 36, `${id}ps`, 5, { max: 30 })}</g></g>`
    return `${base}<g id="${id}d">${dFigure()}</g><g opacity="0">${capriAt(id, DX - 2, DY - 2)}</g>${swapped}`
  }
  // pair: she floats beside him and bobs in rhythm with his breath (the same 2.6 s step), her hair sways, three motes drift
  // up between them; then she glitches out.
  const motes = `<g class="cd-motes" ${D(0.5)} fill="${K.green}"><rect x="27" y="52" width="1" height="1"/><rect x="29" y="47" width="2" height="2" fill-opacity=".7"/><rect x="26" y="60" width="1" height="1"/></g>`
  return `<defs>${silSet(id)}</defs>${base}<g class="cd-in" ${D(0)}><g ${out(dur - 0.45)}><g class="cd-bob" ${D(0)}>${capriAt(id, CX, CY)}${ghostPair(id, 2.5, D(0))}</g>${motes}</g></g>${dFigure('cd-breath')}`
}

/** The figure slot while the plan for `at` is live: the duet, pinned to the wall clock (a redraw anywhere in it resumes); '' otherwise. */
export const duetAt = (plan: DuetPlan, at: number): string => (duetLive(plan, at) ? `<style>${DUET_CSS}</style>${duet(plan, { delay: pin(plan.startAt), startAt: plan.startAt })}` : '')

export const DUET_CSS = `.cd-bob{animation:cd-bob 2.6s steps(1) infinite}@keyframes cd-bob{50%{transform:translateY(1px)}}
.cd-breath .cd-db{animation:cd-bob 2.6s steps(1) infinite}
.cd-nodding .cd-dh{animation:cd-nod 2s steps(1) infinite}@keyframes cd-nod{30%,45%{transform:translateY(1px)}}
.cd-sp .hair{animation:cd-sway 1.8s steps(1) infinite}@keyframes cd-sway{50%{transform:translateX(1px)}}
.cd-sp .vis{animation:cd-vis 2.2s ease-in-out infinite}@keyframes cd-vis{50%{opacity:.45}}
.cd-glide{animation:cd-glide .9s cubic-bezier(.2,.9,.2,1) both}@keyframes cd-glide{from{transform:translate(var(--a),var(--b))}to{transform:none}}
.cd-in{animation:cd-in .45s steps(1) both}@keyframes cd-in{0%{opacity:0}12%{opacity:1;clip-path:inset(0 0 72% 0);transform:translateX(-3px)}28%{opacity:.5;clip-path:inset(46% 0 0 0);transform:translateX(3px)}44%{opacity:1;clip-path:inset(0 0 34% 0);transform:translateX(-2px)}60%{opacity:.6;clip-path:inset(18% 0 18% 0);transform:translateX(1px)}78%,100%{opacity:1;clip-path:none;transform:none}}
.cd-out{animation:cd-out .45s steps(1) both}@keyframes cd-out{0%{opacity:1}14%{opacity:.5;clip-path:inset(0 0 60% 0);transform:translateX(3px)}30%{opacity:1;clip-path:inset(40% 0 0 0);transform:translateX(-3px)}48%{opacity:.4;clip-path:inset(0 0 25% 0);transform:translateX(2px)}68%{opacity:.7;clip-path:inset(55% 0 0 0);transform:translateX(-1px)}86%{opacity:.25;clip-path:inset(0 0 80% 0)}100%{opacity:0;clip-path:inset(0 0 100% 0)}}
.cd-g1{animation:cd-gh 3.1s steps(1) infinite}.cd-g2{animation:cd-gh2 3.1s steps(1) infinite}
@keyframes cd-gh{0%{opacity:.9;transform:translate(-1px,0)}4%{opacity:.7;transform:translate(0,1px)}9%,44%,52%,89%,97%,100%{opacity:0;transform:none}45%{opacity:.8;transform:translate(-1px,-1px)}90%{opacity:.8;transform:translate(0,0)}93%{opacity:.6;transform:translate(-2px,1px)}}
@keyframes cd-gh2{0%{opacity:.9;transform:translate(1px,0)}4%{opacity:.7;transform:translate(0,-1px)}9%,44%,52%,89%,97%,100%{opacity:0;transform:none}45%{opacity:.8;transform:translate(1px,1px)}90%{opacity:.8;transform:translate(0,0)}93%{opacity:.6;transform:translate(2px,-1px)}}
.cd-bub{animation:cd-bub .2s steps(3) both;transform-box:fill-box;transform-origin:0 50%}@keyframes cd-bub{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.cd-ty{animation:cd-ty linear both;transform-box:fill-box;transform-origin:100% 50%}@keyframes cd-ty{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.cd-beam{animation:cd-beam 2.2s steps(1) both;opacity:0}@keyframes cd-beam{0%,100%{opacity:0}2%,30%,40%,70%{opacity:1}35%{opacity:.4}75%{opacity:.5}}
.cd-draw{animation:cd-draw .3s linear both;stroke-dashoffset:40}@keyframes cd-draw{to{stroke-dashoffset:0}}
.cd-led{animation:cd-led 1s steps(1) 2;opacity:0}@keyframes cd-led{0%,50%{opacity:1}25%,75%{opacity:.2}}
.cd-flinch{animation:cd-flinch .4s steps(1) both}@keyframes cd-flinch{0%,100%{transform:none}20%{transform:translateX(1px)}45%{transform:translateX(-1px)}70%{transform:translateX(1px)}}
.cd-flash{animation:cd-flash 1.2s steps(1) both;opacity:0}@keyframes cd-flash{0%,33%,66%{opacity:1}16%,50%,83%,100%{opacity:0}}
.cd-glow{animation:cd-glow 1.8s ease-in-out both;opacity:0}@keyframes cd-glow{10%,60%{opacity:1}100%{opacity:0}}
.cd-poss{animation:cd-in .45s steps(1) both}
.cd-snap{animation:cd-snap .7s steps(1) both}@keyframes cd-snap{0%,30%{opacity:1}15%,45%,100%{opacity:0}60%{opacity:.6}}
.cd-motes{animation:cd-mote 2.4s linear infinite}@keyframes cd-mote{from{transform:translateY(0)}to{transform:translateY(-8px)}}
@media (prefers-reduced-motion: reduce){.cd-bob,.cd-breath .cd-db,.cd-nodding .cd-dh,.cd-sp .hair,.cd-sp .vis,.cd-glide,.cd-in,.cd-out,.cd-g1,.cd-g2,.cd-bub,.cd-ty,.cd-beam,.cd-draw,.cd-led,.cd-flinch,.cd-flash,.cd-glow,.cd-poss,.cd-snap,.cd-motes{animation:none}
.cd-g1,.cd-g2,.cd-ty,.cd-flash,.cd-motes,.cd-beam,.cd-snap{display:none}.cd-glow{opacity:1}.cd-in{opacity:.55}}`

// =====================================================================================================================
// 3. The possession transition: D mode -> CAPRI mode ('in'), and back ('out'). 2 s on the band and on each pane card.
// =====================================================================================================================
const hashOf = (w: string): number => [...String(w)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
export type TransitionOpts = {
  surface?: 'band' | 'pane'
  /** The mode chip's box (typed in at the end). */
  chip?: { x: number; y: number; w: number; h: number }
  /** The band's avatar morph (default on for the band). */
  figure?: boolean
  /** Fewer shards and no streaks (a pane card low in the cascade). */
  lean?: boolean
}
/**
 * An overlay for a panel that is ALREADY drawn in the new mode. It shows the old one dying: a hue veil in the old colour
 * (mix-blend-mode: hue, so every text stays readable) wipes away, the old avatar dissolves slice by slice off the new
 * one, shards fly in from (or out to) the edges, the mode chip types in. `tm.delay` is the pinned `since`. Needs TR_CSS.
 */
export const transition = (W: number, H: number, dir: 'in' | 'out', tm: RoamTiming = {}, o: TransitionOpts = {}): string => {
  const dly = delayer(tm.startAt, tm)
  const D = (t: number) => `style="animation-delay:${dly(t)}"`
  const toCapri = dir === 'in'
  const band = (o.surface ?? 'band') === 'band'
  const id = `tr${hashOf(`${W}|${H}|${dir}`) % 100000}`
  const old = toCapri ? D_TRACE : KC.hot
  const nu = toCapri ? KC.hot : D_TRACE
  let s = `<g class="tr-anim" pointer-events="none">`
  // The veil: the old hue over everything, wiping out left -> right (to Capri) or right -> left (back to D). The blend sits
  // on the clipped group, not on its rect: a clipped group is isolated, so a blending child would blend with nothing.
  const wipe = toCapri ? 'tr-wipe' : 'tr-wipe tr-wipe-r'
  s += `<g class="${wipe} tr-veil" ${D(0.55)}><rect x="0" y="0" width="${W}" height="${H}" fill="${old}"/></g><g class="${wipe}" ${D(0.55)}><rect x="0" y="0" width="${W}" height="${H}" fill="${toCapri ? '#070A12' : '#050305'}" fill-opacity=".3"/></g>`
  // The flood front: a 2 px white-hot line with a bloom, crossing the panel with the wipe.
  s += `<defs><filter id="${id}b" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="3"/></filter></defs>`
  s += `<g class="${toCapri ? 'tr-front' : 'tr-front tr-front-r'}" style="--w:${W}px;animation-delay:${dly(0.55)}"><rect x="-8" y="0" width="16" height="${H}" fill="${nu}" fill-opacity=".55" filter="url(#${id}b)"/><rect x="-1" y="0" width="2" height="${H}" fill="${KC.white}"/></g>`
  // Shards: slivers in her colours (or his) bleeding in from the four edges, then fading.
  const r = (i: number, k: string) => unit(`${id}|${i}|${k}`)
  const cols = toCapri ? [KC.hot, KC.green, KC.white, KC.pink] : [D_TRACE, '#BFD8FF', '#8FB5FF']
  const n = o.lean ? 5 : band ? 10 : 8
  s += `<g class="${toCapri ? 'tr-shards' : 'tr-shards tr-shards-out'}" ${D(0.2)}>`
  for (let i = 0; i < n; i++) {
    const edge = i % 4
    const len = 10 + r(i, 'l') * 36
    const th = 2 + r(i, 't') * 3
    const c = cols[Math.floor(r(i, 'c') * cols.length)] as string
    const t = r(i, 'p')
    let x: number, y: number, w: number, h: number
    if (edge === 0) { x = t * (W - len); y = 1 + r(i, 'y') * 6; w = len; h = th }
    else if (edge === 1) { x = t * (W - len); y = H - 7 + r(i, 'y') * 5; w = len; h = th }
    else if (edge === 2) { x = 1 + r(i, 'y') * 6; y = t * (H - len); w = th; h = len }
    else { x = W - 7 + r(i, 'y') * 5; y = t * (H - len); w = th; h = len }
    const dx = edge === 2 ? -30 : edge === 3 ? 30 : 0
    const dy = edge === 0 ? -30 : edge === 1 ? 30 : 0
    s += `<path class="tr-shard" d="${cham(x, y, w, h, Math.min(w, h) * 0.6, 1)}" fill="${c}" fill-opacity="${r1(0.6 + r(i, 'o') * 0.4)}" style="--dx:${dx}px;--dy:${dy}px;animation-delay:${dly(0.2 + r(i, 'd') * 0.5)}"/>`
  }
  s += '</g>'
  if (!o.lean) s += streaks(12, 1, Math.round(W * 0.6), 5, `${id}T`, 4, { cls: 'tr-streak', colors: cols }) + streaks(Math.round(W * 0.3), H - 6, Math.round(W * 0.6), 5, `${id}B`, 4, { cls: 'tr-streak', colors: cols })
  // The avatar morph (band): the old figure drawn over the new one on a tile backing, dissolving in six row slices, each
  // with a one-frame pink / green split before it goes; a 2 px tear follows the slices down.
  if (band && o.figure !== false) {
    const bx = 20
    const by = 35
    const bw = 36
    const oldSp = toCapri ? ER_D : ER_CAPRI
    const ox = toCapri ? DX : 26
    const oy = toCapri ? DY : 35
    const os = toCapri ? DS : 0.86
    const rows = oldSp.rows.length
    const sliceH = Math.ceil(rows / 6)
    const back = toCapri ? '#070A12' : '#050305'
    // The old figure's pixels once (hidden), then six row slices, each a clipped <use> with two silhouette <use>s for the split.
    let defs = `<defs>${silDefs(`${id}a`, toCapri ? KC.hot : D_TRACE)}${silDefs(`${id}c`, toCapri ? KC.green : '#BFD8FF')}`
    let slices = ''
    for (let i = 0; i < 6; i++) {
      const win = [i * sliceH, Math.min(rows, (i + 1) * sliceH)] as const
      const at = 0.7 + unit(`${id}|s${i}`) * 0.55
      const y0 = r1(oy + win[0] * os)
      const h = r1((win[1] - win[0]) * os + 0.5)
      defs += `<clipPath id="${id}k${i}"><rect x="${bx}" y="${y0}" width="${bw}" height="${h}"/></clipPath>`
      const u = (dx: number, f = '') => `<use href="#${id}o" clip-path="url(#${id}k${i})"${dx ? ` x="${dx}"` : ''}${f ? ` filter="url(#${id}${f})"` : ''}/>`
      slices += `<g class="tr-slice" ${D(at)}><rect x="${bx}" y="${y0}" width="${bw}" height="${h}" fill="${back}"/><g class="tr-split">${u(-2, 'a')}${u(2, 'c')}</g>${u(0)}<rect class="tr-tear" x="${bx - 4}" y="${r1(y0 + h - 1)}" width="${bw + 8}" height="2" fill="${nu}" fill-opacity=".9"/></g>`
    }
    s += `${defs}</defs><g opacity="0"><g id="${id}o">${pixels(oldSp, ox, oy, os)}</g></g><g class="tr-flinch" ${D(0)}>${slices}${toCapri ? `<g class="tr-flash" ${D(0.05)}>${scar()}</g><g class="tr-eyes" ${D(0.2)}>${eyesPink()}</g>` : ''}</g>`
  }
  // The mode chip types in last (the band and the sync card draw it; the overlay only uncovers it).
  if (o.chip) {
    const c = o.chip
    s += `<rect class="tr-ty" x="${r1(c.x - 2)}" y="${r1(c.y - 2)}" width="${r1(c.w + 4)}" height="${r1(c.h + 4)}" fill="${toCapri ? '#050305' : '#070A12'}" style="animation-delay:${dly(1.5)};animation-duration:.4s;animation-timing-function:steps(8,end)"/>`
  }
  s += '</g>'
  // Reduced motion: one still note for 2.5 s, no veil, no shards.
  const note = toCapri ? 'CAPRI IN CONTROL · host D' : 'HOST D · link stable'
  const nw = mw(note, 9, 1) + (band ? 54 : 30)
  const nh = 30
  const nx = band ? Math.max(60, W * 0.62) : Math.max(8, W / 2 - nw / 2)
  const ny = band ? H / 2 - nh / 2 : 12
  // The bust is a <use> of the band's own name patch (er2bust, drawn in CAPRI mode), so her pixels are not copied again; a pane card's
  // note is words only. D's head is the one pixel figure the note carries (the way back).
  const still = band ? (toCapri ? `<use href="#er2bust" transform="translate(${r1(nx + 6)} ${r1(ny + 2.5)}) scale(1.5) translate(${-(20 + r1(er2W('MISSION CONTROL', 9.5, 1.6, 800) + 26) + 10)} -10)"/>` : pixels(ER_D, nx + 12, ny + 2, 0.55, { rows: [0, 22] })) : ''
  s += `<g class="tr-still" ${D(0)}><path d="${cham(nx, ny, nw, nh, 6, 2)}" fill="#050305" fill-opacity=".96" stroke="${nu}"/>${still}${M(nx + (band ? 34 : 14), ny + 19, note, 9, KC.white, 'letter-spacing="1" font-weight="700"')}</g>`
  return s
}
export const TR_CSS = `.tr-veil{mix-blend-mode:hue}
@supports not (mix-blend-mode:hue){.tr-veil{display:none}}

.tr-wipe{animation:tr-wipe .9s cubic-bezier(.7,0,.3,1) both}@keyframes tr-wipe{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 0 100%)}}
.tr-wipe-r{animation-name:tr-wipe-r}@keyframes tr-wipe-r{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 100% 0 0)}}
.tr-front{animation:tr-front .9s cubic-bezier(.7,0,.3,1) both;opacity:0}@keyframes tr-front{0%{opacity:0;transform:translateX(0)}8%,92%{opacity:1}100%{opacity:0;transform:translateX(var(--w))}}
.tr-front-r{animation-name:tr-front-r}@keyframes tr-front-r{0%{opacity:0;transform:translateX(var(--w))}8%,92%{opacity:1}100%{opacity:0;transform:translateX(0)}}
.tr-shard{animation:tr-shard 1s cubic-bezier(.2,.9,.2,1) both;opacity:0}@keyframes tr-shard{0%{opacity:0;transform:translate(var(--dx),var(--dy))}25%,70%{opacity:1;transform:none}100%{opacity:0;transform:none}}
.tr-shards-out .tr-shard{animation-name:tr-shard-out}@keyframes tr-shard-out{0%{opacity:0;transform:none}25%,60%{opacity:1;transform:none}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
.tr-streak{animation:tr-streak 1.2s steps(1) both;opacity:0}@keyframes tr-streak{0%{opacity:0}20%{opacity:1;transform:translateX(-5px)}40%{transform:translateX(4px)}60%{opacity:1;transform:translateX(0)}100%{opacity:0}}
.tr-flinch{animation:cd-flinch .4s steps(1) both}
.tr-flash{animation:cd-flash 1.2s steps(1) both;opacity:0}.tr-eyes{animation:cd-glow 1.6s ease-in-out both;opacity:0}
.tr-slice{animation:tr-slice .3s steps(1) both}@keyframes tr-slice{0%,60%{opacity:1}100%{opacity:0}}
.tr-slice .tr-split{animation:tr-split .3s steps(1) both;opacity:0}@keyframes tr-split{0%,25%{opacity:0}26%,55%{opacity:.9}56%,100%{opacity:0}}
.tr-slice .tr-tear{animation:tr-tear .3s steps(1) both;opacity:0}@keyframes tr-tear{0%,55%{opacity:0}56%,80%{opacity:1}81%,100%{opacity:0}}
.tr-ty{animation:tr-ty linear both;transform-box:fill-box;transform-origin:100% 50%}@keyframes tr-ty{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.tr-still{display:none}
@media (prefers-reduced-motion: reduce){.tr-anim{display:none}.tr-still{display:block;animation:tr-stay 2.5s steps(1) both}@keyframes tr-stay{0%,90%{opacity:1}100%{opacity:0;visibility:hidden}}}`

/** The transition for a panel (`W` by `H`) at `now`, with its CSS, or '' when it is over (or has not begun). `tm.delay` pins `since`. */
export const transitionAt = (W: number, H: number, dir: 'in' | 'out', since: number, now: number, o: TransitionOpts = {}): string =>
  since > 0 && now >= since - 1000 && now - since < TRANSITION_MS ? `<style>${TR_CSS}</style>${transition(W, H, dir, { delay: pin(since), startAt: since }, o)}` : ''

// =====================================================================================================================
// 4. Whole-panel glitches (CAPRI mode): one class on a panel's root <g>, shared keyframes, filters (no copies).
// =====================================================================================================================
export type GlitchKind = 'slice' | 'rgb' | 'invert' | 'jitter' | 'tear'
export type GlitchEvent = { kind: GlitchKind; startAt: number; durMs: number; /** The pane's cards follow the band, 60 ms apart. */ cascade: boolean }
export type GlitchPlan = { bucket: number; events: GlitchEvent[] }
export const GLITCH_KINDS: GlitchKind[] = ['slice', 'rgb', 'invert', 'jitter', 'tear']
export const GLITCH_SEED = 'capri'
/** A draw includes every glitch under way and the first few that start within this long (the idle band redraws about once a minute). */
export const GLITCH_AHEAD_MS = 75_000
const GLITCH_MAX_AHEAD = 3

/** The window's glitch events, each at most 400 ms: chance 0.5 (< 85%), 0.8 (85 - 94), 1.0 (95+, and half the time a second event 9 s later). */
export const glitchPlan = (seed: string, at: number, ctxPct: number): GlitchPlan => {
  const bucket = Math.floor(at / ROAM_WINDOW_MS)
  const start = bucket * ROAM_WINDOW_MS
  const rnd = (salt: string) => unit(`${seed}|glitch|${bucket}|${salt}`)
  const chance = ctxPct >= 95 ? 1 : ctxPct >= 85 ? 0.8 : 0.5
  const events: GlitchEvent[] = []
  const n = rnd('on') < chance ? (ctxPct >= 95 && rnd('two') < 0.5 ? 2 : 1) : 0
  for (let i = 0; i < n; i++) {
    const kind = GLITCH_KINDS[Math.floor(rnd(`k${i}`) * GLITCH_KINDS.length)] as GlitchKind
    const startAt = start + 800 + Math.floor(rnd('t0') * (ROAM_WINDOW_MS - 2000 - 9000)) + i * 9000
    events.push({ kind, startAt, durMs: kind === 'invert' ? 160 : kind === 'tear' ? 360 : 300, cascade: rnd(`c${i}`) < 0.5 })
  }
  return { bucket, events }
}
/** Every glitch of the windows around `at` that has not finished and starts within the look-ahead, soonest first (at most 3 not yet begun). */
export const glitchEvents = (seed: string, at: number, ctxPct: number, ahead = GLITCH_AHEAD_MS): GlitchEvent[] => {
  const out: GlitchEvent[] = []
  for (let b = Math.floor(at / ROAM_WINDOW_MS); b <= Math.floor((at + ahead) / ROAM_WINDOW_MS); b++) {
    for (const ev of glitchPlan(seed, b * ROAM_WINDOW_MS, ctxPct).events) {
      if (ev.startAt + ev.durMs + 60 * 24 <= at || ev.startAt > at + ahead) continue
      if (ev.startAt > at && out.filter(e => e.startAt > at).length >= GLITCH_MAX_AHEAD) continue
      out.push(ev)
    }
  }
  return out
}
/** Defs once per drawing: the slice-displacement map, the RGB split, the inversion in her colours. */
export const glitchDefs = (id = 'cg'): string => `<defs>
<filter id="${id}sl" x="-5%" y="0" width="110%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0 .09" numOctaves="1" seed="7" result="n"/><feComponentTransfer in="n" result="m"><feFuncR type="discrete" tableValues="0 0 .5 .5 1 1 .5"/><feFuncG type="discrete" tableValues=".5"/><feFuncB type="discrete" tableValues=".5"/></feComponentTransfer><feDisplacementMap in="SourceGraphic" in2="m" scale="28" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="${id}rgb" x="-3%" y="0" width="106%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="-4" dy="0" result="r2"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb"/><feOffset in="gb" dx="4" dy="0" result="gb2"/><feBlend in="r2" in2="gb2" mode="screen"/></filter>
<filter id="${id}inv" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-.65 0 0 0 .7 0 -.03 0 0 .07 0 0 -.14 0 .18 0 0 0 1 0"/></filter>
</defs>`
/** The class and delay for a panel's root <g> (a pane card `i` deep in a cascade starts 60 ms later per card). `tm.delay` pins the event. */
export const glitchWrap = (ev: GlitchEvent, tm: RoamTiming = {}, i = 0, id = 'cg'): { cls: string; style: string } => {
  const dly = delayer(ev.startAt, tm)
  return { cls: `cg cg-${ev.kind}`, style: `--sl:url(#${id}sl);--rgb:url(#${id}rgb);--inv:url(#${id}inv);animation-delay:${dly(ev.cascade ? i * 0.06 : 0)}` }
}
/** The pixel-sort tear on a card edge: the one glitch that draws something (a few streaks, 360 ms). */
export const glitchTear = (W: number, H: number, ev: GlitchEvent, tm: RoamTiming = {}, seed = 'tear', i = 0): string => {
  const dly = delayer(ev.startAt, tm)
  const top = unit(`${seed}|${ev.startAt}|side`) < 0.5
  return `<g class="cg-tearbits" style="animation-delay:${dly(ev.cascade ? i * 0.06 : 0)}">${streaks(Math.round(W * 0.2), top ? 0 : H - 8, Math.round(W * 0.6), 7, `${seed}|${ev.startAt}`, 9, { max: 70, colors: [KC.hot, KC.green, KC.white, KC.pink] })}</g>`
}
export const GLITCH_CSS = `.cg{animation-fill-mode:both;animation-timing-function:steps(1)}
.cg-slice{animation-name:cg-slice;animation-duration:.3s}@keyframes cg-slice{0%,100%{filter:none}10%,60%{filter:var(--sl)}35%{filter:var(--rgb)}}
.cg-rgb{animation-name:cg-rgb;animation-duration:.3s}@keyframes cg-rgb{0%,100%{filter:none}10%,70%{filter:var(--rgb)}40%{filter:none}}
.cg-invert{animation-name:cg-inv;animation-duration:.16s}@keyframes cg-inv{0%,100%{filter:none}20%,80%{filter:var(--inv)}}
.cg-jitter{animation-name:cg-jit;animation-duration:.3s}@keyframes cg-jit{0%,100%{transform:none}20%{transform:translateY(1px)}45%{transform:translate(-1px,-1px)}70%{transform:translate(1px,1px)}}
.cg-tear{animation-name:cg-rgb;animation-duration:.2s}
.cg-tearbits{animation:cg-bits .36s steps(1) both;opacity:0}@keyframes cg-bits{0%{opacity:0}10%,40%{opacity:1;transform:translateX(-6px)}41%,75%{opacity:1;transform:translateX(5px)}100%{opacity:0}}
@media (prefers-reduced-motion: reduce){.cg,.cg-tearbits{animation:none}.cg-tearbits{display:none}}`

/**
 * A panel's whole drawing (`<svg ...>...</svg>`, W by H read from its root) with its glitches applied as CSS on a root group:
 * the content is wrapped once per event, never copied. `i` is the pane card's place in the cascade (0: the band).
 * Nothing when there are no events (the common case), so a quiet panel stays byte for byte as it was.
 */
export const glitchInto = (svg: string, events: GlitchEvent[], i = 0): string => {
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0]
  const end = svg.lastIndexOf('</svg>')
  if (!root || end < 0 || events.length === 0) return svg
  const W = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1])
  const H = Number(/\bheight="([\d.]+)"/.exec(root)?.[1])
  if (!Number.isFinite(W) || !Number.isFinite(H)) return svg
  let inner = svg.slice(root.length, end)
  let bits = ''
  for (const ev of events) {
    const w = glitchWrap(ev, { delay: pin(ev.startAt), startAt: ev.startAt }, i)
    inner = `<g class="${w.cls}" style="${w.style}">${inner}</g>`
    if (ev.kind === 'tear') bits += glitchTear(W, H, ev, { delay: pin(ev.startAt), startAt: ev.startAt }, `tear${Math.round(W)}`, i)
  }
  return `${root}<style>${GLITCH_CSS}</style>${glitchDefs()}${inner}${bits}</svg>`
}
