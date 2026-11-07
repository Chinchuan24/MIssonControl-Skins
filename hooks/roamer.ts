// The roaming AI: a character who wanders through both panels now and then.
//
// Pure functions, no `$`. `roamPlan` decides, from a seed and the clock alone, whether
// she is out and what she does in the current 30 s window; `roamerMarkup` and
// `takeoverMarkup` draw it as SVG fragments with CSS-only motion (no JS loop), so a
// redraw anywhere in the window gives the same plan and resumes the same animation.
//
//   walk      enters at one edge, walks across, leaves by the other
//   peek      glitches in at a spot, idles a few seconds, glitches out
//   sit       perches on a card edge or a bar, then glitches out
//   takeover  rare: a dark cover over the whole panel, her big, a typed line, a glitch out
//
// Timing: every animation starts after `delay`. Pass `delay: pin(plan.startAt)` (from
// ./smooth) so the picture follows the wall clock (it is spliced into a CSS calc()), or
// pass `now` and the delay is worked out for you. Draw the roamer only while
// `roamLive(plan, now)`; the fragments are empty outside the plan's window when `now` is given.
import { type Sprite, hashOf, spriteMarkup } from './cast'

// --- the plan -------------------------------------------------------------------

/** One window: the plan is the same for every moment inside it. */
export const ROAM_WINDOW_MS = 30_000
/** The takeover's length, start to invisible. */
export const TAKEOVER_MS = 3_500

export type RoamKind = 'walk' | 'peek' | 'sit' | 'takeover'

export type RoamOpts = {
  /** No appearances at all. */
  quiet?: boolean
  /** Chance of a walk, peek or sit per window (default 0.35). */
  chance?: number
  /** A takeover at most once per this many minutes; 0 turns it off (default 30). */
  takeoverEveryMin?: number
  /** Chance that a takeover slot really has one (default 0.6). */
  takeoverChance?: number
  /** What a takeover says, one picked per takeover (default "hi."). */
  lines?: string[]
}

export type RoamPlan = {
  on: boolean
  kind: RoamKind | null
  /** Which 30 s window of the clock this plan is for. */
  bucket: number
  /** When her act starts and ends (ms, inside the window). */
  startAt: number
  endAt: number
  durMs: number
  /** Walking direction: 1 left to right, -1 right to left. */
  dir: 1 | -1
  /** Where she shows up, as a fraction of the width and of the height. */
  x: number
  y: number
  /** What a sit is on. */
  perch: 'card' | 'bar'
  /** What a takeover says. */
  line: string
}

// A stable number in [0, 1) from a string: the cast's hash, then a murmur-style mix.
const unit = (s: string): number => {
  let h = hashOf(s)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const r2 = (n: number): number => +n.toFixed(2)
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/**
 * What she does in the window containing `at`. Deterministic in (seed, window, opts).
 * Takeovers sit in slots twice as long as the gap, always in the slot's first half, so
 * two of them are never closer than the gap, with no memory of the last one.
 */
export const roamPlan = (seed: string, at: number, opts: RoamOpts = {}): RoamPlan => {
  const bucket = Math.floor(at / ROAM_WINDOW_MS)
  const start = bucket * ROAM_WINDOW_MS
  const rnd = (salt: string) => unit(`${seed}|${bucket}|${salt}`)
  const lines = opts.lines?.length ? opts.lines : ['hi.']
  const base: RoamPlan = { on: false, kind: null, bucket, startAt: start, endAt: start, durMs: 0, dir: 1, x: 0.5, y: 0.5, perch: 'bar', line: lines[Math.floor(rnd('line') * lines.length)] ?? 'hi.' }
  if (opts.quiet) return base
  const spot = { x: r2(0.1 + 0.8 * rnd('x')), y: r2(0.3 + 0.6 * rnd('y')), dir: (rnd('dir') < 0.5 ? 1 : -1) as 1 | -1, perch: (rnd('perch') < 0.5 ? 'card' : 'bar') as 'card' | 'bar' }
  const act = (kind: RoamKind, durMs: number): RoamPlan => {
    const startAt = start + Math.floor(rnd('at') * (ROAM_WINDOW_MS - durMs - 500))
    return { ...base, ...spot, on: true, kind, startAt, endAt: startAt + durMs, durMs }
  }
  const every = opts.takeoverEveryMin ?? 30
  if (every > 0) {
    const half = Math.max(1, Math.ceil((every * 60_000) / ROAM_WINDOW_MS))
    const slot = Math.floor(bucket / (2 * half))
    const isSlotHit = unit(`${seed}|tk|${slot}`) < (opts.takeoverChance ?? 0.6)
    const at0 = slot * 2 * half + Math.floor(unit(`${seed}|tkb|${slot}`) * half)
    if (isSlotHit && bucket === at0) return act('takeover', TAKEOVER_MS)
  }
  if (rnd('on') >= (opts.chance ?? 0.35)) return base
  const k = rnd('kind')
  if (k < 0.45) return act('walk', Math.round((9_000 + rnd('dur') * 5_000) / 100) * 100)
  if (k < 0.8) return act('peek', Math.round((4_000 + rnd('dur') * 3_000) / 100) * 100)
  return act('sit', Math.round((10_000 + rnd('dur') * 8_000) / 100) * 100)
}

/** Is her act under way at `now`? */
export const roamLive = (plan: RoamPlan, now: number): boolean => plan.on && now >= plan.startAt && now < plan.endAt

// --- a placeholder character ----------------------------------------------------

/** A glowing humanoid, 16×46: magenta hair, a cyan visor and trim, until the real sprite exists. */
export const PLACEHOLDER_AI: Sprite = {
  rows: [
    '.....hhhhhhh....',
    '....hhhhhhhhh...',
    '....hhkkkkkhh...',
    '....hkkkkkkkh...',
    '....hvvvvvvvh...',
    '....hkkkkkkkh...',
    '....hhkkkkkhh...',
    '.....hkkkkkh....',
    '.......kkk......',
    '...bbbbbbbbbbb..',
    '..bbbbbbbbbbbbb.',
    '..bbbcbbbbbcbbb.',
    '..bbbcbbebbcbbb.',
    '..bbbcbbbbbcbbb.',
    '..bb.bcbbbcb.bb.',
    '..bb.bbbbbbb.bb.',
    '..bb.bbbbbbb.bb.',
    '..bb.bbbbbbb.bb.',
    '..bb.bmmmmmb.bb.',
    '..kk.bbbbbbb.kk.',
    '..kk.bbbbbbb.kk.',
    '....bbbbbbbbb...',
    '....bbbbbbbbb...',
    ...Array.from({ length: 17 }, (_, i) => (i % 5 === 2 ? '.....cbb.bbc....' : '.....bbb.bbb....')),
    '.....ggg.ggg....',
    '....gggg.gggg...',
    '....gggg.gggg...',
    '....gmmg.gmmg...',
    '....gggg.gggg...',
    '...mmmmm.mmmmm..',
  ],
  pal: { h: '#FF2A9D', k: '#D8E8F2', v: '#27F2FF', b: '#2A3C70', c: '#27F2FF', m: '#FF2A9D', e: '#FF5CC8', g: '#141A33' },
  cls: { h: 'hair', v: 'vis', e: 'led' },
}

// --- motion ---------------------------------------------------------------------

// Every animated rule is listed again in the reduced-motion block below. Under reduced
// motion nothing moves: walks and sits do not show, a peek is one static faint figure,
// and a takeover is a small still bubble instead of the cover.
export const ROAM_CSS = `.rm-sp g{transform-box:fill-box}
.rm-sp .bd{animation:rm-br 2.6s steps(1) infinite}
@keyframes rm-br{50%{transform:translateY(1px)}}
.rm-sp .hair{animation:rm-sway 1.8s steps(1) infinite}
@keyframes rm-sway{50%{transform:translateX(1px)}}
.rm-sp .vis{animation:rm-vis 2.2s ease-in-out infinite}
@keyframes rm-vis{50%{opacity:.45}}
.rm-sp .led{animation:rm-led 1.2s steps(1) infinite}
@keyframes rm-led{50%{opacity:.3}}
.rm-walking .la{animation:rm-step .5s steps(1) infinite}
.rm-walking .lb{animation:rm-step .5s steps(1) infinite -.25s}
@keyframes rm-step{50%{transform:translateY(-1px)}}
.rm-walk{animation:rm-walk linear both}
@keyframes rm-walk{from{transform:translateX(var(--a))}to{transform:translateX(var(--b))}}
.rm-in{animation:rm-in .45s steps(1) both}
@keyframes rm-in{0%{opacity:0}12%{opacity:1;clip-path:inset(0 0 72% 0);transform:translateX(-3px)}28%{opacity:.5;clip-path:inset(46% 0 0 0);transform:translateX(3px)}44%{opacity:1;clip-path:inset(0 0 34% 0);transform:translateX(-2px)}60%{opacity:.6;clip-path:inset(18% 0 18% 0);transform:translateX(1px)}78%,100%{opacity:1;clip-path:none;transform:none}}
.rm-out{animation:rm-out .45s steps(1) both}
@keyframes rm-out{0%{opacity:1}14%{opacity:.5;clip-path:inset(0 0 60% 0);transform:translateX(3px)}30%{opacity:1;clip-path:inset(40% 0 0 0);transform:translateX(-3px)}48%{opacity:.4;clip-path:inset(0 0 25% 0);transform:translateX(2px)}68%{opacity:.7;clip-path:inset(55% 0 0 0);transform:translateX(-1px)}86%{opacity:.25;clip-path:inset(0 0 80% 0)}100%{opacity:0;clip-path:inset(0 0 100% 0)}}
.rm-g1{animation:rm-gh 3.1s steps(1) infinite}
.rm-g2{animation:rm-gh2 3.1s steps(1) infinite}
@keyframes rm-gh{0%{opacity:.9;transform:translate(-3px,0)}4%{opacity:.7;transform:translate(-2px,1px)}9%,44%,52%,89%,97%,100%{opacity:0;transform:none}45%{opacity:.8;transform:translate(-3px,-1px)}90%{opacity:.8;transform:translate(-2px,0)}93%{opacity:.6;transform:translate(-4px,1px)}}
@keyframes rm-gh2{0%{opacity:.9;transform:translate(3px,0)}4%{opacity:.7;transform:translate(2px,-1px)}9%,44%,52%,89%,97%,100%{opacity:0;transform:none}45%{opacity:.8;transform:translate(3px,1px)}90%{opacity:.8;transform:translate(2px,0)}93%{opacity:.6;transform:translate(4px,-1px)}}
.rm-trail{animation:rm-tr .7s steps(1) infinite}
@keyframes rm-tr{50%{opacity:.35}}
.rm-scrim{animation:rm-scrim .45s linear both}
@keyframes rm-scrim{from{opacity:0}to{opacity:.86}}
.rm-scan{animation:rm-scan .4s steps(4) infinite}
@keyframes rm-scan{to{transform:translateY(3px)}}
.rm-big{animation:rm-big .7s cubic-bezier(.2,.9,.2,1) both;transform-box:fill-box;transform-origin:50% 100%}
@keyframes rm-big{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
.rm-bub{animation:rm-bub .2s steps(3) both;transform-box:fill-box;transform-origin:0 50%}
@keyframes rm-bub{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.rm-ty{animation:rm-ty linear both;transform-box:fill-box;transform-origin:100% 50%}
@keyframes rm-ty{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.rm-cur{animation:rm-cur .6s steps(1) infinite}
@keyframes rm-cur{0%{opacity:1}50%{opacity:0}}
.rm-tko{animation:rm-tko .6s steps(1) both}
@keyframes rm-tko{0%{opacity:1}15%{opacity:.5;clip-path:inset(0 0 55% 0);transform:translateX(6px)}30%{opacity:1;clip-path:inset(35% 0 0 0);transform:translateX(-5px)}50%{opacity:.4;clip-path:inset(0 0 20% 0);transform:translateX(3px)}70%{opacity:.8;clip-path:inset(60% 0 0 0);transform:translateX(-2px)}100%{opacity:0;clip-path:inset(0 0 100% 0)}}
.rm-tks{display:none}
@media (prefers-reduced-motion: reduce){.rm-sp .bd,.rm-sp .hair,.rm-sp .vis,.rm-sp .led,.rm-walking .la,.rm-walking .lb,.rm-walk,.rm-in,.rm-out,.rm-g1,.rm-g2,.rm-trail,.rm-scrim,.rm-scan,.rm-big,.rm-bub,.rm-ty,.rm-cur,.rm-tko{animation:none}
.rm-mo,.rm-g1,.rm-g2,.rm-trail,.rm-tk{display:none}
.rm-pk{opacity:.4}
.rm-tks{display:block}}
`

// --- drawing --------------------------------------------------------------------

export type RoamColors = { accent: string; accent2: string; text: string }

export type RoamTiming = {
  /** The clock now: the picture resumes where the plan's act has got to. */
  now?: number
  /** A CSS time (e.g. `pin(plan.startAt)` from ./smooth) for when the act starts, from this image's start. */
  delay?: string
  /** Where a sit's feet are (px); by default a spot picked from the plan. */
  perchY?: number
  /** For a takeover: when it starts (ms), to pair with `now`. */
  startAt?: number
  /** Where a peek stands, or a sit sits (its feet), instead of the spot picked from the plan: a theme names the edge she leans out of. */
  peekAt?: { x: number; y: number }
  /** A theme's framing drawn behind her walk or sit, in a frame whose origin is her feet (`s` is her scale, `dir` her way). */
  halo?: (s: number, dir: 1 | -1) => string
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// `delay + x` seconds, as a plain number or as a calc() on a pinned time.
const delayer = (startAt: number | undefined, tm: RoamTiming): ((x: number) => string) => {
  if (tm.delay) return x => `calc(${tm.delay} + ${r2(x)}s)`
  const base = tm.now !== undefined && startAt !== undefined ? (startAt - tm.now) / 1000 : 0
  return x => `${r2(base + x)}s`
}

// A solid silhouette of the sprite in the current colour: the offset ghost copies.
const ghostFilter = (id: string): string => `<filter id="${id}" x="-25%" y="-10%" width="150%" height="120%"><feFlood flood-color="currentColor"/><feComposite in2="SourceAlpha" operator="in"/></filter>`

// The sprite once (it carries the id), and two ghost copies of it with <use>.
const figure = (sprite: Sprite, id: string, s: number, flip: boolean, isWalking: boolean, t: RoamColors, ghostDelay: string): string => {
  const at = `style="animation-delay:${ghostDelay}"`
  const place = `${flip ? 'scale(-1,1) ' : ''}translate(${r2(-15 * s)} ${r2(-27 * s)}) scale(${r2(s)})`
  return `<g style="filter:drop-shadow(0 0 2px ${t.accent})"><g class="rm-g1" color="${t.accent}" ${at}><use href="#${id}" filter="url(#${id}f)"/></g><g class="rm-g2" color="${t.accent2}" ${at}><use href="#${id}" filter="url(#${id}f)"/></g><g id="${id}" class="rm-sp${isWalking ? ' rm-walking' : ''}" transform="${place}">${spriteMarkup(sprite, t.accent, 30, 27)}</g></g>`
}

/**
 * The roamer for a walk, peek or sit plan, as an SVG fragment to lay over a band or pane
 * (W × H). Empty when the plan is off or a takeover (that is `takeoverMarkup`), or, with
 * `tm.now`, when `now` is outside the plan's window. Needs ROAM_CSS in the drawing.
 */
export const roamerMarkup = (sprite: Sprite, plan: RoamPlan, W: number, H: number, surface: 'band' | 'pane', t: RoamColors, tm: RoamTiming = {}): string => {
  if (!plan.on || plan.kind === null || plan.kind === 'takeover') return ''
  if (tm.now !== undefined && !roamLive(plan, tm.now)) return ''
  const dly = delayer(plan.startAt, tm)
  const dur = plan.durMs / 1000
  const id = `rm${surface === 'band' ? 'b' : 'p'}${plan.bucket}`
  const s = r2(surface === 'band' ? Math.min(1.8, (H * 0.36) / 26) : Math.min(2.2, (H * 0.2) / 26))
  const top = s * 27 + 3
  const floor = r2(clamp(surface === 'band' ? H - 5 : H * (0.35 + 0.6 * plan.y), top, H - 2))
  const defs = `<defs>${ghostFilter(`${id}f`)}</defs>`
  const ghostAt = dly(0)

  if (plan.kind === 'walk') {
    const pad = Math.ceil(12 * s + 64)
    const a = plan.dir === 1 ? -pad : W + pad
    const b = plan.dir === 1 ? W + pad : -pad
    // The data trail: bits shed behind her, thinning out.
    const bits = Array.from({ length: 8 }, (_, i) => {
      const w = i % 3 === 0 ? 2 : 1
      return `M${r2(-plan.dir * (9 + i * 7))} ${r2(-2 - unit(`${plan.bucket}|y${i}`) * 24 * s)}h${w}v${w}h${-w}z`
    }).join('')
    return `${defs}<g transform="translate(0 ${floor})"><g class="rm-walk rm-mo" style="--a:${a}px;--b:${b}px;animation-duration:${r2(dur)}s;animation-delay:${dly(0)}"><path class="rm-trail" d="${bits}" fill="${t.accent2}" fill-opacity=".6"/>${tm.halo ? tm.halo(s, plan.dir) : ''}${figure(sprite, id, s, plan.dir === -1, true, t, ghostAt)}</g></g>`
  }

  // peek and sit: glitch in, stay, glitch out.
  const x = r2(clamp(tm.peekAt ? tm.peekAt.x : W * plan.x, 20 * s, W - 20 * s))
  const isSit = plan.kind === 'sit'
  const spotY = tm.peekAt ? tm.peekAt.y : undefined
  const y = isSit ? r2(clamp(tm.perchY ?? spotY ?? (surface === 'band' ? H * 0.55 : H * (0.3 + 0.5 * plan.y)), top, H - 2)) : spotY !== undefined ? r2(clamp(spotY, top, H - 2)) : floor
  const pw = r2(34 * s)
  const perch = isSit
    ? `<rect x="${r2(-pw / 2)}" y="1" width="${pw}" height="${plan.perch === 'bar' ? 4 : 2}" rx="1" fill="${plan.perch === 'bar' ? t.accent2 : t.accent}" fill-opacity=".75"/>`
    : ''
  return `${defs}<g transform="translate(${x} ${y})"><g class="${isSit ? 'rm-mo ' : ''}rm-pk"><g class="rm-in" style="animation-delay:${dly(0)}"><g class="rm-out" style="animation-delay:${dly(dur - 0.45)}">${perch}${isSit && tm.halo ? tm.halo(s, 1) : ''}${figure(sprite, id, s, false, false, t, ghostAt)}</g></g></g></g>`
}

/**
 * The takeover: a dark scrim fades over the whole panel (W × H) with scanlines, the
 * sprite scales up in the middle, a speech bubble types `line`, then it all glitches
 * out and stays invisible (~3.5 s, animation-fill-mode forwards). Under reduced motion
 * only a small still bubble shows. Needs ROAM_CSS in the drawing.
 */
export const takeoverMarkup = (W: number, H: number, sprite: Sprite, line: string, t: RoamColors, tm: RoamTiming = {}): string => {
  const dly = delayer(tm.startAt, tm)
  const id = `rt${hashOf(`${line}|${W}|${H}`) % 100000}`
  const fs = clamp(Math.round(H * 0.05), 11, 20)
  const cw = fs * 0.62
  const maxCh = Math.max(4, Math.floor((W - 48) / cw))
  const chars = [...(line || 'hi.')]
  const text = esc(chars.length > maxCh ? `${chars.slice(0, maxCh - 1).join('')}…` : chars.join(''))
  const n = Math.min(chars.length, maxCh)
  const tw = r2(n * cw)
  const bw = r2(tw + 20)
  const bh = fs + 14
  const SH = Math.min(H * 0.55, 260)
  const s = r2(Math.min(SH / 26, (W * 0.4) / 9))
  const cx = r2(W / 2)
  const floor = r2(clamp((H + SH) / 2 + 6, SH, H - 4))
  const bx = r2(Math.max(8, Math.min(cx + 4.5 * s + 12, W - 8 - bw)))
  const by = r2(Math.max(6, floor - 26 * s * 0.98))
  const tx = r2(bx + 10)
  const ty = r2(by + bh / 2 + fs * 0.35)
  const mono = `font-family="ui-monospace,Menlo,Consolas,monospace" font-size="${fs}" font-weight="700"`
  const typeAt = 1.25
  const typeFor = r2(clamp(0.07 * n + 0.15, 0.5, 1.3))
  const bubble = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="#0B1020" stroke="${t.accent}" stroke-width="1.2"/><path d="M${bx} ${r2(by + bh / 2 - 5)}l-8 5l8 5z" fill="${t.accent}"/>`
  const label = `<text x="${tx}" y="${ty}" ${mono} fill="${t.text}" xml:space="preserve">${text}</text>`
  const defs = `<defs><radialGradient id="${id}g"><stop offset="0" stop-color="${t.accent}" stop-opacity=".5"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient><pattern id="${id}n" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="${t.accent}" fill-opacity=".16"/></pattern>${ghostFilter(`${id}f`)}</defs>`
  const still = `<g class="rm-tks"><rect x="${r2(cx - bw / 2)}" y="${r2(H - bh - 12)}" width="${bw}" height="${bh}" rx="3" fill="#0B1020" stroke="${t.accent}" stroke-width="1.2"/><text x="${r2(cx - tw / 2)}" y="${r2(H - 12 - bh / 2 + fs * 0.35)}" ${mono} fill="${t.text}" xml:space="preserve">${text}</text></g>`
  return `${defs}<g class="rm-tk" pointer-events="none"><g class="rm-tko" style="animation-delay:${dly(2.9)}">
<rect class="rm-scrim" width="${W}" height="${H}" fill="#05060C" style="animation-delay:${dly(0)}"/>
<ellipse class="rm-scrim" cx="${cx}" cy="${r2(floor - 13 * s)}" rx="${r2(Math.min(W * 0.4, 13 * s * 1.6))}" ry="${r2(13 * s)}" fill="url(#${id}g)" fill-opacity=".5" style="animation-delay:${dly(0)}"/>
<g class="rm-scrim" style="animation-delay:${dly(0)}"><rect class="rm-scan" y="-3" width="${W}" height="${H + 3}" fill="url(#${id}n)"/></g>
<g transform="translate(${cx} ${floor})"><g class="rm-big" style="animation-delay:${dly(0.25)}"><g class="rm-in" style="animation-delay:${dly(0.25)}">${figure(sprite, id, s, false, false, t, dly(0.25))}</g></g></g>
<g class="rm-bub" style="animation-delay:${dly(1)}">${bubble}${label}<rect class="rm-ty" x="${r2(tx - 1)}" y="${r2(by + 3)}" width="${r2(tw + 3)}" height="${bh - 6}" fill="#0B1020" style="animation-duration:${typeFor}s;animation-delay:${dly(typeAt)};animation-timing-function:steps(${Math.max(1, n)},end)"/></g>
<rect class="rm-cur" x="${r2(tx + tw + 1)}" y="${r2(by + (bh - fs) / 2)}" width="${r2(fs * 0.5)}" height="${fs}" fill="${t.text}" opacity="0" style="animation-delay:${dly(typeAt + typeFor)}"/>
</g></g>${still}`
}
