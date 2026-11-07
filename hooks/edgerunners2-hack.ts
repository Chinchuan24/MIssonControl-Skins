// Cyberpunk: Edgerunners 2, Capri's red hack lines (an easter egg for edgerunners-2 and CAPRICORN).
// In the show, when Capri hacks, thin red lines appear out of nowhere and race across the screen. Here, now and
// then, 2 to 5 hairlines (#FF1F4E / #F43444, a faint magenta afterglow) shoot across the band and one pane card as
// angular circuit traces or lightning, branch once or twice, draw on in about 0.3 s with a tiny bright head, hold
// a moment and retract in about 0.6 s. Where a line crosses a card's edge there is a brief tiny glitch.
//
// Pure SVG strings, no `$`, no state. Like roamer.ts, the plan is a function of a seed and the clock window alone
// (`hackPlan`), and every animation is pinned to the wall clock (`pin` from ./smooth), so a redraw anywhere in an
// event resumes it instead of replaying it. The fragment is empty outside the event.
//
//   rare at a normal context (about one event per 1 to 3 minutes), more often from 85% (CHIP HOT), a burst of five
//   lines from 95% (CAPRI'S AWAKE), always in her takeover, and more often while she walks, peeks or sits.
//   never while the job-done celebration draws; never more than 3 lines start per second; none at all under
//   prefers-reduced-motion.
import { rng } from './edgerunners2'
import { ROAM_WINDOW_MS } from './roamer'
import type { RoamPlan } from './roamer'
import { pin } from './smooth'

/** One window: the plan is the same for every moment inside it (the roamer's own 30 s). */
export const HACK_WINDOW_MS = ROAM_WINDOW_MS
/** Lines never start closer together than this (3 flashes a second at most). */
export const HACK_MIN_GAP_S = 0.34

export type HackSurface = 'band' | 'pane'
/** Which pane card carries an event's lines. */
export type HackCard = 'cred' | 'log'
export type HackLine = { /** Seconds after the event starts. */ t: number; on: HackSurface; i: number }
export type HackPlan = { on: boolean; seed: string; bucket: number; startAt: number; endAt: number; burst: boolean; paneCard: HackCard; lines: HackLine[] }

/**
 * The chance that a 30 s window holds an event. Rare at a normal context (about 0.12 per window; with her own
 * walks and peeks about one event per 2.5 min), more often from 85%, nearly always from 95%; her takeover
 * always has one, and a walk, peek or sit makes it likelier.
 */
export const hackChance = (ctxPct: number, sec: boolean, roam: RoamPlan['kind']): number => {
  if (roam === 'takeover') return 1
  const base = ctxPct >= 95 ? 0.6 : ctxPct >= 85 ? 0.4 : sec ? 0.15 : 0.12
  return roam ? Math.min(1, base + 0.3) : base
}

const END_PAD_S = 1.5
const LATEST_S = 26

/** The event in the window containing `at`; the same for every moment inside it. `roam` is her plan for that window. */
export const hackPlan = (seed: string, at: number, ctxPct: number, sec: boolean, roam: RoamPlan | null): HackPlan => {
  const bucket = Math.floor(at / HACK_WINDOW_MS)
  const w0 = bucket * HACK_WINDOW_MS
  const off: HackPlan = { on: false, seed, bucket, startAt: w0, endAt: w0, burst: false, paneCard: 'cred', lines: [] }
  const rnd = rng(`${seed}|hk|${bucket}`)
  const kind = roam?.on ? roam.kind : null
  const hit = rnd()
  const where = rnd()
  const n0 = rnd()
  const gap0 = rnd()
  const card = rnd()
  if (hit >= hackChance(ctxPct, sec, kind)) return off
  const burst = ctxPct >= 95 || kind === 'takeover'
  const n = burst ? 5 : ctxPct >= 85 || kind ? 3 + Math.floor(n0 * 2) : 2 + Math.floor(n0 * 2)
  const gap = burst ? HACK_MIN_GAP_S + 0.03 + gap0 * 0.05 : 0.45 + gap0 * 0.25
  const lines: HackLine[] = []
  let first: HackSurface = 'band'
  for (let i = 0; i < n; i++) {
    const t = Math.round(i * gap * 100) / 100
    const on: HackSurface = i === 0 ? ((first = rnd() < 0.5 ? 'band' : 'pane'), first) : i === 1 ? (first === 'band' ? 'pane' : 'band') : rnd() < 0.5 ? 'band' : 'pane'
    lines.push({ t, on, i })
  }
  const raw = kind && roam ? roam.startAt + (kind === 'takeover' ? 300 : kind === 'walk' ? Math.round(roam.durMs * 0.2) : kind === 'peek' ? 800 : 1500) : w0 + 500 + Math.floor(where * 24_000)
  const startAt = Math.max(w0 + 200, Math.min(w0 + LATEST_S * 1000, raw))
  const last = (lines[lines.length - 1] as HackLine).t
  return { on: true, seed, bucket, startAt, endAt: startAt + Math.round((last + 1.3 + END_PAD_S) * 1000), burst, paneCard: card < 0.55 ? 'cred' : 'log', lines }
}

/** Is the event under way at `now`? */
export const hackLive = (p: HackPlan, now: number): boolean => p.on && now >= p.startAt && now < p.endAt

// --- the CSS -----------------------------------------------------------------------
// A line draws on in 28% of its time (0.27 to 0.36 s), holds to 46%, and retracts from its start while it fades
// (0.5 to 0.7 s). The head is a 3 px dash that leads the draw. Under reduced motion nothing shows.
export const HACK_CSS = `.hk-d{stroke:var(--c,#FF1F4E);stroke-dasharray:var(--l) var(--l);animation:hkd 1.1s linear both}
.hk-h{stroke:#FFE6EC;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:3 var(--l);animation:hkh 1.1s linear both}
.hk-g{stroke:#FF2E7E;stroke-width:1.4;animation:hkg .26s steps(1) both}
@keyframes hkd{0%{stroke-dashoffset:var(--l);opacity:0}2%{opacity:1}28%,46%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:var(--n);opacity:0}}
@keyframes hkh{0%{stroke-dashoffset:3;opacity:0}2%{opacity:1}28%{stroke-dashoffset:var(--h);opacity:1}29%,100%{stroke-dashoffset:var(--h);opacity:0}}
@keyframes hkg{0%{opacity:0}1%{opacity:1;transform:translate(2px,0)}40%{opacity:.5;transform:translate(-2px,0)}70%{opacity:1;transform:none}100%{opacity:0}}
@media (prefers-reduced-motion: reduce){.hk{display:none}.hk-d,.hk-h,.hk-g{animation:none}}`

// --- the geometry --------------------------------------------------------------------
type Pt = [number, number]
const OUT = 6

const pick = <T>(rnd: () => number, a: T[]): T => a[Math.floor(rnd() * a.length)] as T
const dedupe = (pts: Pt[]): Pt[] => pts.filter((p, i) => i === 0 || p[0] !== (pts[i - 1] as Pt)[0] || p[1] !== (pts[i - 1] as Pt)[1])

// A circuit trace: runs along a rail, jogs at 45 degrees to the next rail, runs on, and often leaves by the far edge.
const trace = (rnd: () => number, W: number, H: number, ys: number[]): Pt[] => {
  const dir = rnd() < 0.5 ? 1 : -1
  let x = dir > 0 ? -OUT : W + OUT
  let y = pick(rnd, ys)
  const pts: Pt[] = [[x, y]]
  const steps = 3 + Math.floor(rnd() * 3)
  const run = (W * (0.55 + rnd() * 0.55)) / steps
  const lim = (v: number) => Math.max(-OUT, Math.min(W + OUT, v))
  for (let k = 0; k < steps; k++) {
    x = lim(x + dir * run * (0.6 + rnd() * 0.8))
    pts.push([x, y])
    if (k === steps - 1) break
    let ty = pick(rnd, ys)
    if (ty === y) ty = Math.max(2, Math.min(H - 2, y + (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 20)))
    const dy = ty - y
    const j = Math.min(Math.abs(dy), 6 + rnd() * 14)
    x = lim(x + dir * j)
    y += Math.sign(dy) * j
    pts.push([x, y])
    if (Math.abs(dy) > j + 0.5) {
      y = ty
      pts.push([x, y])
    }
  }
  if (rnd() < 0.55) pts.push([dir > 0 ? W + OUT : -OUT, y])
  return pts
}

// Lightning: a jagged line from one edge across, alternating sides of the straight path.
const bolt = (rnd: () => number, W: number, H: number, vertical: boolean): Pt[] => {
  const a = rnd() < 0.5
  const [x0, y0, x1, y1] = vertical ? [rnd() * W, a ? -OUT : H + OUT, rnd() * W, a ? H + OUT : -OUT] : [a ? -OUT : W + OUT, rnd() * H, a ? W + OUT : -OUT, rnd() * H]
  const k = Math.max(6, Math.min(14, Math.round(Math.hypot(x1 - x0, y1 - y0) / (45 + rnd() * 30))))
  const pts: Pt[] = []
  for (let j = 0; j <= k; j++) {
    const t = j / k
    const side = j === 0 || j === k ? 0 : (j % 2 ? 1 : -1) * (8 + rnd() * 14)
    pts.push(vertical ? [x0 + (x1 - x0) * t + side, y0 + (y1 - y0) * t] : [x0 + (x1 - x0) * t, Math.max(2, Math.min(H - 2, y0 + (y1 - y0) * t + side))])
  }
  return pts
}

const rd = (pts: Pt[]): Pt[] => dedupe(pts.map(p => [Math.round(p[0]), Math.round(p[1])] as Pt))
const lenOf = (pts: Pt[]): number => Math.ceil(pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - (pts[i - 1] as Pt)[0], p[1] - (pts[i - 1] as Pt)[1]) : 0), 0))
// Compact path data: absolute start, then h, v or l steps.
const dOf = (pts: Pt[]): string =>
  pts.reduce((s, p, i) => {
    if (!i) return `M${p[0]} ${p[1]}`
    const dx = p[0] - (pts[i - 1] as Pt)[0]
    const dy = p[1] - (pts[i - 1] as Pt)[1]
    return s + (dy === 0 ? `h${dx}` : dx === 0 ? `v${dy}` : `l${dx} ${dy}`)
  }, '')
/** The length up to vertex `m`. */
const lenTo = (pts: Pt[], m: number): number => lenOf(pts.slice(0, m + 1))

// A branch: a short 45 degree stub off a vertex.
const branch = (rnd: () => number, from: Pt, dir: 1 | -1, W: number, H: number): Pt[] => {
  const s = 8 + rnd() * 10
  const sy = from[1] > H / 2 ? -1 : 1
  return rd([from, [from[0] + dir * s, from[1] + sy * s], [Math.max(-OUT, Math.min(W + OUT, from[0] + dir * (s + 12 + rnd() * 28))), from[1] + sy * s]])
}

const STAMP = (ms: number): string => pin(ms)
const num = (n: number): number => Math.round(n * 100) / 100

/** One line's pieces: the line, its head, maybe a branch, and the glitch ticks. `ms`: when it starts (absolute). */
const lineOf = (seed: string, bucket: number, surface: HackSurface, i: number, ms: number, W: number, H: number, ys: number[], allowBranch: boolean): { svg: string; branched: boolean } => {
  const rnd = rng(`${seed}|${bucket}|${surface}|${i}`)
  const useBolt = rnd() < 0.4
  const pts = rd(useBolt ? bolt(rnd, W, H, H >= 150 && rnd() < 0.35) : trace(rnd, W, H, ys))
  if (pts.length < 2) return { svg: '', branched: false }
  const L = lenOf(pts)
  const D = num(0.95 + rnd() * 0.35)
  const draw = D * 0.28
  const alt = rnd() < 0.3 ? '--c:#F43444;' : ''
  const at = STAMP(ms)
  const sty = `--l:${L};--n:${-L};--h:${3 - L};${alt}animation-duration:${D}s;animation-delay:${at}`
  const d = dOf(pts)
  let s = `<path class="hk-d" d="${d}" style="${sty}"/><path class="hk-h" d="${d}" style="${sty.replace(alt, '')}"/>`
  // A branch off a middle vertex, launched as the head passes it.
  let branched = false
  if (allowBranch && pts.length >= 4 && rnd() < 0.55) {
    const m = 1 + Math.floor(rnd() * (pts.length - 2))
    const dirx = (pts[m + 1] as Pt)[0] >= (pts[m] as Pt)[0] ? 1 : -1
    const bp = branch(rnd, pts[m] as Pt, dirx, W, H)
    if (bp.length >= 2) {
      branched = true
      const bl = lenOf(bp)
      const bAt = ms + Math.round((lenTo(pts, m) / L) * draw * 1000)
      s += `<path class="hk-d" d="${dOf(bp)}" style="--l:${bl};--n:${-bl};animation-duration:${num(D * 0.7)}s;animation-delay:${STAMP(bAt)}"/>`
    }
  }
  // The tiny glitch where it crosses the card's edge: on the way in, and (when it leaves) on the way out.
  const first = pts[0] as Pt
  const lastP = pts[pts.length - 1] as Pt
  const tick = (cx: number, cy: number, t: number): string => `<path class="hk-g" d="M${cx - 4} ${cy - 2}h8M${cx - 1} ${cy + 2}h6" style="animation-delay:${STAMP(ms + Math.round(t * 1000))}"/>`
  if (first[0] < 0 || first[0] > W) s += tick(first[0] < 0 ? 1 : W - 1, first[1], 0.02)
  if (lastP[0] < 0 || lastP[0] > W) s += tick(lastP[0] < 0 ? 1 : W - 1, lastP[1], draw * 0.98)
  return { svg: s, branched }
}

// The rails lines run along: the frame, the progress beam, and the rows between.
const bandYs = (H: number): number[] => [2, 30, 64, 98, H - 3]
const paneYs = (H: number): number[] => [2, 26, Math.round(H / 2), H - 3]

export type HackArgs = {
  W: number
  H: number
  surface: HackSurface
  /** Which pane card is being drawn (a band ignores it). */
  card?: HackCard
  at: number
  ctxPct: number
  /** The job-done celebration is drawing: nothing here. */
  party?: boolean
  /** Her plan for this window (null: she is not out). */
  roam: RoamPlan | null
}

/**
 * The red lines for a panel as an SVG fragment to lay over it (W × H), or '' when there is no event, it is not
 * under way at `args.at`, this panel carries none of its lines, or a celebration is drawing. Includes its CSS.
 */
export const er2Hack = (seed: string, a: HackArgs, sec: boolean): string => {
  if (a.party) return ''
  if (a.surface === 'pane' && (a.W < 200 || a.H < 40)) return ''
  const plan = hackPlan(`${seed}|hack`, a.at, a.ctxPct, sec, a.roam)
  if (!hackLive(plan, a.at)) return ''
  if (a.surface === 'pane' && (a.card ?? 'cred') !== plan.paneCard) return ''
  const mine = plan.lines.filter(l => l.on === a.surface)
  if (!mine.length) return ''
  const ys = a.surface === 'band' ? bandYs(a.H) : paneYs(a.H)
  let branches = 0
  const body = mine
    .map(l => {
      const r = lineOf(plan.seed, plan.bucket, a.surface, l.i, plan.startAt + Math.round(l.t * 1000), a.W, a.H, ys, branches < 2)
      if (r.branched) branches++
      return r.svg
    })
    .join('')
  return body ? `<style>${HACK_CSS}</style><g class="hk" fill="none" stroke-width="1.3" pointer-events="none" style="filter:drop-shadow(0 0 2px #FF2E7E)">${body}</g>` : ''
}
