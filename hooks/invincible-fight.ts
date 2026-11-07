// THE FIGHT (Invincible fan homage): Mark vs Omni-Man as a frame-by-frame flipbook, one timeline across the band and the pane.
// Mark is thrown out of the band's avatar slot, trades blows in the band (5.5 s), and is thrown DOWN into the pane, where the
// fight goes on over three cards, one act each: COVER STORY "The Catch", THE PAGE "Every Angle", GDA WALL "Think, Mark".
// Cartoon rules: no red sparks (white / yellow / cyan stars), a 1-frame 35% white flash on the big hits, a 70 ms hit-freeze,
// the PANEL shakes (1 / 3 / 4 px tiers) and never the sprites, SFX words, 3-5 speed lines and 2 ghost afterimages, a quiet
// last act, no blood, no gore. Under reduced motion there is no animation: one still "clash" frame.
//
// Technique: every pose is cut once per Svg into <defs> (pixel runs merged into rectangles, the palette reduced to K colours) and
// shown with <use> inside a frame-swap group whose CSS keyframes (steps(1)) toggle its opacity; a separate transform track moves
// the actor along its path. Every piece runs the SAME duration with its keyframes in percent and one delay, `pin(startAt)`, so a
// redraw anywhere in the fight resumes it and a draw up to AHEAD_MS before it schedules it (a positive delay).
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Sprite } from './cast'
import { C, COND, PROPS, SP, condW, hash, koStars, pal, pin, r1, speedLines, unit } from './invincible'
import type { Era } from './invincible'

export const FIGHT_MS = 18_400
export const FIGHT_T = FIGHT_MS / 1000
export const BAND_CUT = 5.5
/** Where each pane act starts on the timeline (s), and how long it is. The band cut hands Mark down at 4.4 s. */
export const ACT_OFF = [4.4, 9.0, 13.8] as const
export const ACT_LEN = [4.6, 4.8, 4.6] as const
export const HOLE_END = FIGHT_T + 0.6
/**
 * What the pane keeps in reserve for THE FIGHT while a job works: the three acts together, at the widest card (the engine counts the
 * drawing without the layers between `<!--dl-->` markers and adds this instead, so the pane never changes layout as a fight comes
 * and goes). Tested against the real sizes.
 */
export const FIGHT_PANE_RESERVE = 100_000

const r3 = (n: number): number => Math.round(n * 1000) / 1000
const COMBO_NAMES = ['A', 'B', 'C'] as const
export type ActIndex = 0 | 1 | 2

// ---------------------------------------------------------------- the frames
type FrameInfo = { name: string; ax: number; face: 1 | -1 }
const OM: Record<string, string> = { O1: 'O1_IDLE', O2: 'O2_CROSS', O3: 'O3_PITCH', O4: 'O4_CATCH', O6: 'O6_BACKWIND', O7: 'O7_BACKHAND', O8: 'O8_JAB', O9: 'O9_HAMMERUP', O9B: 'O9B_HAMMERDOWN', O10: 'O10_GRAB', O11: 'O11_FLINCH', O12: 'O12_HANDS', O13: 'O13_FLY' }
const MK: Record<string, string> = { M1: 'M1_READY', M2: 'M2_CHARGE', M3: 'M3_PUNCH', M4: 'M4_JABL', M5: 'M5_JABR', M6: 'M6_GRAB', M7: 'M7_BLOCK', M8: 'M8_HIT', M9: 'M9_BALL', M10: 'M10_SKID', M11: 'M11_RECOVER', M12: 'M12_KNEEL' }
/** Where the body stands in each frame (a fraction of its width), so a wide frame with an arm out does not shift the body. */
const AX: Record<string, number> = { O1: 0.5, O2: 0.5, O3: 0.5, O4: 0.38, O6: 0.45, O7: 0.42, O8: 0.42, O9: 0.45, O9B: 0.45, O10: 0.4, O11: 0.5, O12: 0.5, O13: 0.55, M1: 0.45, M2: 0.5, M3: 0.4, M4: 0.35, M5: 0.4, M6: 0.45, M7: 0.5, M8: 0.5, M9: 0.5, M10: 0.6, M11: 0.5, M12: 0.5 }
export const FRAME_KEYS = [...Object.keys(OM), ...Object.keys(MK)]
const ALL = SP as unknown as Record<string, Sprite>
/** The sprite of a frame key (`O4`, `M3`) in an era: Omni-Man's are shared, Mark's follow the suit. */
export const frameSprite = (key: string, era: Era): Sprite => {
  const o = OM[key]
  if (o) return ALL[`FX_${o}`] as Sprite
  return ALL[`${era === 2 ? 'FX3_' : 'FX_'}${MK[key]}`] as Sprite
}
const info = (key: string): FrameInfo => ({ name: key, ax: AX[key] ?? 0.5, face: 1 })

// Pixel runs merged into rectangles, the palette reduced to the `K` most used colours (the nearest merged into them).
const hex3 = (h: string): number[] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const d2 = (a: string, b: string): number => {
  const x = hex3(a)
  const y = hex3(b)
  return ((x[0] ?? 0) - (y[0] ?? 0)) ** 2 + ((x[1] ?? 0) - (y[1] ?? 0)) ** 2 + ((x[2] ?? 0) - (y[2] ?? 0)) ** 2
}
const PATHS = new Map<string, string>()
/** The `<path>`s of a sprite in pixel units (one per colour), rectangles merged, at most `K` colours. */
export const rectPaths = (sp: Sprite, K: number): string => {
  const key = `${sp.rows.length}|${sp.rows[0]}|${sp.rows[sp.rows.length >> 1]}|${K}`
  const hit = PATHS.get(key)
  if (hit !== undefined) return hit
  const count = new Map<string, number>()
  for (const r of sp.rows) for (const ch of r) { const c = ch === '.' ? undefined : sp.pal[ch]; if (c) count.set(c, (count.get(c) ?? 0) + 1) }
  let cols = [...count.keys()]
  const map = new Map<string, string>(cols.map(c => [c, c]))
  while (cols.length > K) {
    cols.sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0))
    const a = cols[0] as string
    let best = cols[1] as string
    let bd = Infinity
    for (const b of cols.slice(1)) { const d = d2(a, b); if (d < bd) { bd = d; best = b } }
    count.set(best, (count.get(best) ?? 0) + (count.get(a) ?? 0))
    for (const [k, v] of map) if (v === a) map.set(k, best)
    cols = cols.slice(1)
  }
  const h = sp.rows.length
  const w = sp.rows[0]?.length ?? 0
  const grid = sp.rows.map(r => [...r].map(ch => { const c = ch === '.' ? undefined : sp.pal[ch]; return c ? (map.get(c) ?? c) : undefined }))
  const used = grid.map(r => r.map(() => false))
  const by = new Map<string, string>()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid[y]?.[x]
      if (!c || used[y]?.[x]) continue
      let rw = 1
      while (x + rw < w && grid[y]?.[x + rw] === c && !used[y]?.[x + rw]) rw++
      let rh = 1
      for (; y + rh < h; rh++) {
        let ok = true
        for (let i = 0; i < rw; i++) if (grid[y + rh]?.[x + i] !== c || used[y + rh]?.[x + i]) { ok = false; break }
        if (!ok) break
      }
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) (used[y + j] as boolean[])[x + i] = true
      by.set(c, `${by.get(c) ?? ''}M${x} ${y}h${rw}v${rh}h-${rw}z`)
    }
  }
  const out = [...by.entries()].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('')
  PATHS.set(key, out)
  return out
}

// ---------------------------------------------------------------- shared CSS (once per Svg that carries a piece of the fight)
export const FIGHT_CSS = `.dl-c{transform-box:fill-box;transform-origin:50% 50%}.dl-still{display:none}
@keyframes dl-a{0%,99%{opacity:1}100%{opacity:0}}
.dl-w{opacity:0;animation:dl-a var(--d,.06s) steps(1) forwards;animation-delay:calc(var(--s) + var(--t,0s))}
.dl-f{opacity:0;animation-duration:${FIGHT_T}s;animation-timing-function:steps(1);animation-fill-mode:both;animation-delay:var(--q)}
.dl-m{animation-duration:${FIGHT_T}s;animation-timing-function:linear;animation-fill-mode:both;animation-delay:var(--q)}
.dl-rs{animation-duration:${FIGHT_T}s;animation-timing-function:steps(1);animation-fill-mode:both;animation-delay:var(--q)}
.dl-p{opacity:0;animation:dl-pop var(--d,.6s) ease-out forwards;animation-delay:calc(var(--s) + var(--t))}
.dl-u{opacity:0;animation:dl-burst .45s ease-out forwards;animation-delay:calc(var(--s) + var(--t))}
.dl-g{opacity:0;animation:dl-ring .5s ease-out forwards;animation-delay:calc(var(--s) + var(--t))}
.dl-s1,.dl-s2,.dl-s3{opacity:0;animation:dl-a .06s steps(1) forwards;animation-delay:calc(var(--s) + var(--t))}
.dl-s2{animation-delay:calc(var(--s) + var(--t) + .06s)}.dl-s3{animation:dl-a .08s steps(1) forwards;animation-delay:calc(var(--s) + var(--t) + .12s)}
text.dl-t{font-family:${COND};font-weight:800;fill:#FFE066;stroke:${PROPS.ink};paint-order:stroke;stroke-linejoin:round;letter-spacing:.5px}
.dl-pf{fill:${PROPS.paperDark};stroke:${PROPS.ink}}
@keyframes dl-pop{0%{opacity:1;transform:scale(.6)}16%{transform:scale(1.1)}30%{transform:scale(1)}78%{opacity:1}100%{opacity:0;transform:scale(1)}}
@keyframes dl-burst{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.8)}}
@keyframes dl-ring{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(2.6)}}
@keyframes dl-sh1{0%{transform:translate(1px,0)}34%{transform:translate(-1px,1px)}67%{transform:translate(1px,-1px)}100%{transform:none}}
@keyframes dl-sh2{0%{transform:translate(2px,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(1px,-1px)}75%{transform:translate(-1px,0)}100%{transform:none}}
@keyframes dl-sh3{0%{transform:translate(3px,1px)}20%{transform:translate(-3px,-1px)}40%{transform:translate(2px,1px)}60%{transform:translate(-2px,0)}80%{transform:translate(1px,0)}100%{transform:none}}
@keyframes dl-sh4{0%{transform:translate(4px,0)}17%{transform:translate(-4px,2px)}34%{transform:translate(3px,-2px)}51%{transform:translate(-2px,1px)}68%{transform:translate(1px,-1px)}85%{transform:translate(-1px,0)}100%{transform:none}}
@media (prefers-reduced-motion: reduce){.dl-anim{display:none}.dl-cam{animation:none!important}.dl-still{display:block;animation:dl-stay ${FIGHT_T}s steps(1) both}@keyframes dl-stay{0%,96%{opacity:1}100%{opacity:0;visibility:hidden}}}`

// ---------------------------------------------------------------- the timeline builder
type Key = [number, number, number, number?, number?, number?]
type Seg = [number, number, string, (1 | -1)?]
export type ActorOpts = { spin?: boolean; ghosts?: [number, number]; trail?: [number, number, 1 | -1, string?][]; lift?: boolean }
export type Shake = [number, 1 | 2 | 3 | 4, number]

class Tl {
  css = ''
  defs = ''
  body = ''
  still = ''
  shakes: Shake[] = []
  chain: [number, string][] = []
  private made = new Set<string>()
  constructor(readonly p: string, readonly start: number, readonly off: number, readonly era: Era, readonly sc: number, readonly K: number, readonly W: number, readonly H: number) {}
  /** The percent of the whole timeline at act time `t`. */
  g(t: number): number { return r3(((this.off + t) / FIGHT_T) * 100) }
  /** A pinned delay: the fight's start plus act time `t` (calc keeps the engine's phase shift off it). */
  dl(t = 0): string { return `calc(${pin(this.start)} + ${r3(this.off + t)}s)` }
  private kf(name: string, rows: [number, string][]): void { this.css += `@keyframes ${name}{${rows.map(([p, v]) => `${p}%{${v}}`).join('')}}` }
  private def(key: string): { id: string; w: number; h: number; ax: number } {
    const sp = frameSprite(key, this.era)
    const id = `${this.p}${key}`
    if (!this.made.has(id)) {
      this.made.add(id)
      this.defs += `<g id="${id}">${rectPaths(sp, this.K)}</g>`
    }
    return { id, w: sp.rows[0]?.length ?? 1, h: sp.rows.length, ax: info(key).ax }
  }
  /** A frame-swap actor: its frames toggled by `segs`, moved along `path` (time, x, y, rotation, opacity, y-squash). */
  actor(name: string, segs: Seg[], path: Key[], o: ActorOpts = {}): void {
    const id = `${this.p}${name}`
    for (const [a, , k] of segs) this.chain.push([a, k])
    const frames = new Map<string, [number, number][]>()
    for (const [a, b, k, dir = 1] of segs) { const fk = `${k}|${dir}`; (frames.get(fk) ?? frames.set(fk, []).get(fk))?.push([a, b]) }
    const rotates = path.some(k => k[3] !== undefined || k[5] !== undefined)
    const mk = (lag: number, op: number, withTrail: boolean): string => {
      let uses = ''
      for (const [fk, wins] of frames) {
        const [k, dirS] = fk.split('|') as [string, string]
        const f = this.def(k)
        const fid = `${id}${k}${dirS === '-1' ? 'l' : 'r'}`
        if (lag === 0) {
          const rows: [number, string][] = [[0, 'opacity:0']]
          for (const [a, b] of [...wins].sort((x, y) => x[0] - y[0])) rows.push([this.g(a), 'opacity:1'], [this.g(b), 'opacity:0'])
          this.kf(fid, rows)
        }
        uses += `<g class="dl-f" style="animation-name:${fid}"><use href="#${f.id}" transform="scale(${r3(Number(dirS) * this.sc)} ${this.sc}) translate(${r3(-f.ax * f.w)} ${r3(-f.h / 2)})"/></g>`
      }
      let trail = ''
      if (withTrail) for (const [a, b, dir, col] of o.trail ?? []) trail += `<g class="dl-w" style="--t:${r3(a)}s;--d:${r3(b - a)}s">${speedLines(-dir * 22 * this.sc / 1.5, 0, 26, 4, dir, col ?? PROPS.white, { gap: 5, op: 0.85 })}</g>`
      const inner = rotates ? `<g class="dl-c ${o.spin ? 'dl-rs' : 'dl-m'}" style="animation-name:${id}r">${uses}</g>` : uses
      return `<g class="dl-m" style="${lag ? `--q:calc(var(--p) + ${lag}s);` : ''}${op < 1 ? `opacity:${op};` : ''}animation-name:${id}">${trail}${inner}</g>`
    }
    const fades = path.some(k => k[4] !== undefined)
    this.kf(id, path.map(([t, x, y, , op]) => [this.g(t), `transform:translate(${r1(x)}px,${r1(y)}px)${fades ? `;opacity:${op ?? 1}` : ''}`]))
    if (rotates) this.kf(`${id}r`, path.map(([t, , , rot, , sy]) => [this.g(t), `transform:rotate(${r1(rot ?? 0)}deg)${sy !== undefined && sy !== 1 ? ` scale(1,${sy})` : ''}`]))
    this.body += mk(0, 1, true)
    if (o.ghosts) {
      const [a, b] = o.ghosts
      for (const [i, lag] of [0.07, 0.14].entries()) this.body += `<g class="dl-w" style="--t:${r3(a)}s;--d:${r3(b - a + lag)}s">${mk(lag, i ? 0.18 : 0.34, false)}</g>`
    }
  }
  win(a: number, b: number, inner: string): void { this.body += `<g class="dl-w" style="--t:${r3(a)}s;--d:${r3(b - a)}s">${inner}</g>` }
  private at(t: number): string { return `--t:${r3(t)}s` }
  /** The 3-frame impact star: a white 4-point core, a yellow 8-point star, a cyan ring. Never red. */
  star3(t: number, x: number, y: number, r: number): void {
    const pts = (n: number, ro: number, ri: number): string => Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2; const rr = i % 2 ? ri : ro; return `${r1(x + Math.cos(a) * rr)},${r1(y + Math.sin(a) * rr)}` }).join(' ')
    this.body += `<g style="${this.at(t)}"><polygon class="dl-s1" points="${pts(4, r * 0.5, r * 0.14)}" fill="#FFF"/><polygon class="dl-s2" points="${pts(8, r, r * 0.42)}" fill="#FFE066" stroke="${PROPS.ink}"/><circle class="dl-s3" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 1.15)}" fill="none" stroke="#9FE8FF"/></g>`
  }
  flash(t: number, a = 0.35): void { this.win(t, t + 0.06, `<rect width="${this.W}" height="${this.H}" fill="#FFF" opacity="${a}"/>`) }
  /** An SFX word: yellow with an ink outline, tilted, popping 0.6 -> 1.1 -> 1.0. */
  pop(t: number, x: number, y: number, word: string, size: number, tilt: number, dur = 0.6): void {
    this.body += `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${tilt})"><g class="dl-c dl-p" style="${this.at(t)};--d:${dur}s"><text class="dl-t" text-anchor="middle" font-size="${size}" stroke-width="${r1(size * 0.2)}">${word}</text></g></g>`
  }
  puff(t: number, x: number, y: number, s = 1): void {
    this.body += `<g transform="translate(${r1(x)} ${r1(y)})"><g class="dl-c dl-u" style="${this.at(t)}"><g class="dl-pf" transform="scale(${s})"><circle cx="-8" cy="1" r="5"/><circle cy="-3" r="6.5"/><circle cx="8" cy="1" r="4.5"/></g></g></g>`
  }
  /** Square pixel confetti thrown outward (white, yellow, cyan). */
  confetti(t: number, x: number, y: number, n = 6): void {
    const cols = ['#FFF', '#FFE066', '#9FE8FF']
    const sq = Array.from({ length: n }, (_, i) => { const a = (Math.PI * 2 * i) / n + unit(`${this.p}c${t}${i}`); const r = 7 + unit(`${this.p}d${t}${i}`) * 5; return `<rect x="${r1(Math.cos(a) * r - 1)}" y="${r1(Math.sin(a) * r - 1)}" width="2.5" height="2.5" fill="${cols[i % 3]}"/>` }).join('')
    this.body += `<g transform="translate(${r1(x)} ${r1(y)})"><g class="dl-c dl-u" style="${this.at(t)}">${sq}</g></g>`
  }
  /** The dust donut: a flat ring that spreads. */
  ring(t: number, x: number, y: number, rx = 16): void {
    this.body += `<g transform="translate(${r1(x)} ${r1(y)})"><g class="dl-c dl-g" style="${this.at(t)}"><ellipse rx="${rx}" ry="${r1(rx * 0.3)}" fill="none" stroke="#FFF" stroke-width="2"/></g></g>`
  }
  bubble(a: number, b: number, x: number, y: number, text: string, left = false): void {
    const w = Math.round(condW(text, 10, 0.6) + 16)
    const bx = left ? x - w : x
    this.win(a, b, `<rect x="${r1(bx)}" y="${r1(y - 22)}" width="${w}" height="20" rx="3" fill="#FFFFFF" stroke="${PROPS.ink}" stroke-width="1.5"/><path d="M${r1(left ? x - 10 : x + 8)} ${r1(y - 3)}l${left ? 5 : -5} 8 ${left ? 5 : 10}-8z" fill="#FFFFFF" stroke="${PROPS.ink}" stroke-width="1.5" stroke-linejoin="round"/><rect x="${r1(left ? x - 14 : x + 6)}" y="${r1(y - 4)}" width="9" height="3" fill="#FFFFFF"/>${C(bx + 8, y - 8, text, 10, PROPS.ink, 'letter-spacing=".6"')}`)
  }
  shake(t: number, tier: 1 | 2 | 3 | 4, ms: number): void { this.shakes.push([this.off + t, tier, ms]) }
  /** A still pose (reduced motion): the frame at (x, y). */
  actorStill(key: string, x: number, y: number, dir: 1 | -1): string {
    const f = this.def(key)
    return `<use href="#${f.id}" transform="translate(${r1(x)} ${r1(y)}) scale(${r3(dir * this.sc)} ${this.sc}) translate(${r3(-f.ax * f.w)} ${r3(-f.h / 2)})"/>`
  }
  /** Pose chain in time order (consecutive repeats once). */
  chainKeys(): string[] { return this.chain.sort((a, b) => a[0] - b[0]).map(c => c[1]).filter((k, i, a) => a[i - 1] !== k) }
  out(): { css: string; defs: string; body: string; still: string } { return { css: this.css, defs: this.defs, body: this.body, still: this.still } }
}

// ---------------------------------------------------------------- the choreography
type Built = { tl: Tl; chain: string[] }
const spin = (t0: number, t1: number, x0: number, y0: number, x1: number, y1: number, n = 5, arc = 0): Key[] =>
  Array.from({ length: n + 1 }, (_, i) => { const u = i / n; return [t0 + (t1 - t0) * u, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - arc * 4 * u * (1 - u), (i % 4) * 90 + Math.floor(i / 4) * 360] as Key })
/** Jabs alternated every 90 ms from `t0` to `t1`. */
const alt = (t0: number, t1: number, a: string, b: string, dir: 1 | -1 = 1): Seg[] => {
  const out: Seg[] = []
  for (let t = t0, i = 0; t < t1 - 0.001; t += 0.09, i++) out.push([r3(t), r3(Math.min(t + 0.09, t1)), i % 2 ? b : a, dir])
  return out
}

/** The band cut: 5.5 s, H about 134, all the action left of 0.7 W. `big` keeps the ghosts and the extra frames. */
const bandCut = (tl: Tl, big: boolean): void => {
  const { W, H, sc } = tl
  const yc = Math.round(H * 0.5) + 4
  const ox = Math.round(W * 0.62)
  const hit = ox - 34 * sc
  const gy = H - 16
  const slot: [number, number] = [37, 62]
  // Omni-Man: drops in arms crossed, catches, backhands, watches, throws, folds his arms again.
  tl.actor('o', [[0, 0.6, 'O2', -1], [0.6, 1.0, 'O4', -1], [1.0, 1.5, 'O7', -1], [1.5, 3.95, 'O2', -1], [3.95, 4.5, 'O7', -1], [4.5, 5.45, 'O2', -1]], [
    [0, ox, -50], [0.4, ox, yc], [0.6, ox, yc], [1.0, ox - 3, yc], [1.5, ox, yc], [3.95, ox, yc], [4.0, ox - 3, yc], [4.5, ox, yc - 1], [5.0, ox, yc + 1], [5.4, ox, yc], [5.5, ox, yc - 30, undefined, 0],
  ])
  // Mark: out of the slot, the flying punch, the hit; later the skid, the dash back, the flurry, grabbed and thrown.
  tl.actor('m', [[0, 0.55, 'M2'], [0.55, 1.0, 'M3'], [1.0, 1.32, 'M8'], [2.6, 3.0, 'M8', -1], [3.0, 3.3, 'M2'], ...alt(3.3, 4.0, 'M4', 'M3'), [4.0, 4.22, 'M8']], [
    [0, slot[0], slot[1]], [0.55, hit, yc], [1.0, hit, yc], [1.0, hit, yc], [1.32, hit - 22, yc - 4],
    [2.6, W * 0.16, gy - 8], [3.0, W * 0.16 - 20, gy - 8], [3.0, W * 0.1, yc + 8], [3.3, hit, yc], [4.0, hit, yc], [4.22, hit - 8, yc - 2],
  ], { trail: [[0, 0.5, -1, '#FFE066'], [3.0, 3.3, -1, '#FFE066']], ...(big ? { ghosts: [0.05, 0.6] as [number, number] } : {}) })
  // The ball: knocked through three skyline blocks, then thrown down out of the band toward the pane.
  tl.actor('b', [[1.32, 2.6, 'M9'], [4.22, 4.8, 'M9']], [
    [1.3, hit - 22, yc - 4, 0], [1.65, W * 0.5, gy - 30, 90], [1.95, W * 0.36, gy - 22, 180], [2.3, W * 0.22, gy - 18, 270], [2.6, W * 0.16, gy - 10, 360],
    [4.2, hit - 8, yc - 2, 0], [4.5, hit + W * 0.03, H * 0.7, 180], [4.8, hit + W * 0.06, H + 40, 360],
  ], { spin: true, trail: [[4.3, 4.7, -1, '#FFFFFF']] })
  // Skyline blocks: they stand from the backhand, each pops into a puff and confetti as Mark goes through.
  const blocks: [number, number, number][] = [[W * 0.5, 40, 1.65], [W * 0.36, 52, 1.95], [W * 0.22, 34, 2.3]]
  blocks.forEach(([bx, bh, t], i) => {
    tl.win(1.1, t, `<rect x="${r1(bx - 13)}" y="${r1(H - 8 - bh)}" width="26" height="${bh}" fill="#1B2236" stroke="${PROPS.ink}" stroke-width="1.5"/><rect x="${r1(bx - 8)}" y="${r1(H - 8 - bh + 6)}" width="4" height="4" fill="#FFE066" opacity=".7"/><rect x="${r1(bx + 3)}" y="${r1(H - 8 - bh + 6)}" width="4" height="4" fill="#9FE8FF" opacity=".7"/>`)
    tl.puff(t, bx, gy - 8, 1.1)
    tl.confetti(t, bx, gy - 18, 8)
    tl.pop(t + 0.02, bx, gy - 40 - i * 4, 'KRAK!', 15, i % 2 ? 7 : -7)
    tl.shake(t, 2, 0.12)
  })
  // Hits.
  tl.star3(0, slot[0], slot[1], 22)
  tl.star3(0.55, hit + 20 * sc, yc - 8, 16)
  tl.pop(0.58, hit + 8, yc - 44, 'TAK!', 15, -6)
  tl.shake(0.55, 1, 0.1)
  tl.flash(1.0, 0.35)
  tl.star3(1.0, hit + 26 * sc, yc - 6, 26)
  tl.pop(1.04, ox - 6, yc - 50, 'WHAM!', 19, 7)
  tl.shake(1.0, 3, 0.22)
  tl.pop(0.1, 90, yc - 22, 'FWOOSH', 12, -5, 0.5)
  tl.pop(2.65, W * 0.16, gy - 34, 'SKRRT', 12, 5, 0.5)
  for (const i of [0, 1, 2, 3]) tl.puff(2.62 + i * 0.09, W * 0.16 + 14 - i * 9, gy - 2, 0.55)
  tl.pop(3.4, hit + 16, yc - 46, 'POW', 14, -8, 0.4)
  tl.pop(3.7, hit + 30, yc - 36, 'BAM', 14, 8, 0.4)
  tl.star3(3.42, hit + 22 * sc, yc - 10, 9)
  tl.star3(3.78, hit + 22 * sc, yc - 14, 9)
  tl.shake(3.4, 1, 0.1)
  tl.shake(3.7, 1, 0.1)
  tl.flash(4.3, 0.3)
  tl.pop(4.45, hit + 40, yc + 4, 'BOOM', 18, -6, 0.6)
  tl.shake(4.45, 3, 0.22)
  // The outro: a glint on his cape.
  tl.star3(5.0, ox + 10, yc - 16, 7)
  // The clash still (reduced motion): the catch frame and the punch frame with the star between.
  const so = tl.actorStill('O4', ox, yc, -1)
  const sm = tl.actorStill('M3', hit, yc, 1)
  tl.still = `<g class="dl-still" style="animation-delay:var(--s)">${sm}${so}<polygon points="${Array.from({ length: 16 }, (_, i) => { const a = (Math.PI * i) / 8 - Math.PI / 2; const r = i % 2 ? 6 : 14; return `${r1(hit + 20 * sc + Math.cos(a) * r)},${r1(yc - 8 + Math.sin(a) * r)}` }).join(' ')}" fill="#FFE066" stroke="${PROPS.ink}" stroke-width="1"/></g>`
}

/** Pane acts. `cx` positions are fractions of W. */
const actCut = (tl: Tl, act: ActIndex): void => {
  const { W, H, sc } = tl
  const yc = Math.round(H * (act === 1 ? 0.5 : act === 0 ? 0.42 : 0.5))
  const ox = Math.round(W * (act === 2 ? 0.68 : 0.72))
  const mx = Math.round(W * 0.28)
  const hit = ox - 34 * sc
  const gy = yc + 70
  if (act === 0) {
    // ---- Combo A, "The Catch" (cover: 4.6 s)
    tl.actor('o', [[0, 0.8, 'O2', -1], [0.8, 1.4, 'O3', -1], [1.4, 2.0, 'O2', -1], [2.0, 2.95, 'O4', -1], [2.95, 3.4, 'O7', -1], [3.4, 4.6, 'O2', -1]], [
      [0, ox, yc], [0.4, ox, yc - 1], [0.8, ox, yc + 1], [2.0, ox, yc], [2.95, ox + 4, yc], [3.4, ox, yc], [4.6, ox, yc],
    ])
    tl.actor('m', [[0.35, 0.8, 'M1'], [0.8, 1.4, 'M1'], [1.4, 1.7, 'M2'], [1.7, 3.0, 'M3'], [3.0, 3.1, 'M8'], [4.0, 4.4, 'M10', -1]], [
      [0.35, mx, yc], [1.4, mx, yc], [1.4, mx, yc], [0.8, mx - 1, yc], [1.7, mx + (hit - mx) * 0.55, yc], [2.0, hit, yc], [2.2, hit, yc], [2.3, hit - 1, yc], [2.4, hit + 1, yc], [2.5, hit - 1, yc], [2.6, hit + 1, yc], [2.7, hit - 1, yc], [2.8, hit, yc], [3.0, hit, yc], [3.1, hit - 14, yc - 2],
      [4.0, W * 0.2, gy - 20], [4.6, W * 0.2 - 30, gy - 20],
    ].sort((a, b) => (a[0] as number) - (b[0] as number)) as Key[], { trail: [[1.4, 2.0, -1, '#FFE066']], ghosts: [1.4, 2.05] })
    tl.actor('b', [[0, 0.35, 'M9'], [3.1, 4.0, 'M9'], [4.4, 4.6, 'M9']], [
      [0, mx, -30, 0], [0.35, mx, yc, 270],
      [3.1, hit - 14, yc - 2, 0], [3.35, W * 0.46, yc + 44, 90], [3.65, W * 0.3, yc + 62, 180], [3.95, W * 0.2, gy - 20, 270], [4.0, W * 0.2, gy - 20, 360],
      [4.4, W * 0.2 - 30, gy - 20, 0], [4.6, W * 0.2 - 30, H + 30, 180],
    ], { spin: true })
    tl.pop(1.45, mx + 40, yc - 40, 'FWOOSH', 13, -6, 0.5)
    tl.bubble(0.8, 1.4, ox - 24, yc - 46, 'JOIN ME', true)
    tl.star3(2.0, hit + 18 * sc, yc - 6, 12)
    tl.pop(2.04, hit, yc - 46, 'TAK!', 15, -6)
    tl.shake(2.0, 1, 0.1)
    for (const [i, dx] of [[0, -6], [1, 2], [2, 9]] as [number, number][]) tl.win(2.2 + i * 0.12, 2.8, `<rect x="${r1(hit + dx)}" y="${r1(yc - 34 + i * 4)}" width="2" height="3" fill="#FFFFFF"/>`)
    tl.flash(3.0, 0.35)
    tl.star3(3.0, hit + 28 * sc, yc - 6, 24)
    tl.pop(3.04, ox - 10, yc - 50, 'WHAM!', 19, 7)
    tl.shake(3.0, 3, 0.22)
    for (const [bx, bh, t, w] of [[W * 0.46, 54, 3.35, 'KRAK!'], [W * 0.3, 40, 3.65, 'KRAK!']] as [number, number, number, string][]) {
      tl.win(3.0, t, `<rect x="${r1(bx - 13)}" y="${r1(gy + 14 - bh)}" width="26" height="${bh}" fill="#1B2236" stroke="${PROPS.ink}" stroke-width="1.5"/><rect x="${r1(bx - 7)}" y="${r1(gy + 14 - bh + 6)}" width="4" height="4" fill="#FFE066" opacity=".7"/>`)
      tl.puff(t, bx, gy, 1.2)
      tl.confetti(t, bx, gy - 14, 8)
      tl.pop(t + 0.02, bx, gy - 34, w, 14, bx > W * 0.4 ? 7 : -7, 0.5)
      tl.shake(t, 2, 0.12)
    }
    tl.pop(4.0, W * 0.2, gy - 36, 'SKRRT', 12, 5, 0.5)
    for (const i of [0, 1, 2, 3]) tl.puff(4.0 + i * 0.1, W * 0.2 - i * 9, gy + 4, 0.55)
    const so = tl.actorStill('O4', ox, yc, -1)
    const sm = tl.actorStill('M3', hit, yc, 1)
    tl.still = `<g class="dl-still" style="animation-delay:var(--s)">${sm}${so}<polygon points="${Array.from({ length: 16 }, (_, i) => { const a = (Math.PI * i) / 8 - Math.PI / 2; const r = i % 2 ? 7 : 16; return `${r1(hit + 18 * sc + Math.cos(a) * r)},${r1(yc - 6 + Math.sin(a) * r)}` }).join(' ')}" fill="#FFE066" stroke="${PROPS.ink}" stroke-width="1"/></g>`
  } else if (act === 1) {
    // ---- Combo B, "Every Angle" (page: 4.8 s)
    const spots: [number, number][] = [[-52, -10], [-34, -40], [-54, 22], [-36, 34], [-56, -26], [-30, 6]]
    const mpath: Key[] = [[0.3, mx, yc], [0.6, mx, yc], [1.1, hit, yc]]
    const jab: Seg[] = alt(1.1, 2.6, 'M4', 'M5')
    for (let t = 1.1, i = 0; t < 2.6; t += 0.3, i++) { const s = spots[i % spots.length] as [number, number]; mpath.push([r3(t), ox + s[0] * sc / 1.5, yc + s[1] * sc / 1.5], [r3(t + 0.29), ox + s[0] * sc / 1.5, yc + s[1] * sc / 1.5]) }
    mpath.push([2.6, hit, yc], [3.0, hit, yc], [3.4, hit, yc - 6])
    tl.actor('m', [[0.3, 0.6, 'M11'], [0.6, 0.62, 'M2'], [0.62, 1.1, 'M2'], ...jab, [2.6, 3.0, 'M6'], [3.0, 3.45, 'M6']], mpath, { trail: [[0.62, 1.1, -1, '#FFE066']], ghosts: [0.62, 1.15] })
    const oseg: Seg[] = [[0, 1.1, 'O1', -1]]
    for (let t = 1.1, i = 0; t < 2.6; t += 0.18, i++) oseg.push([r3(t), r3(Math.min(t + 0.09, 2.6)), 'O11', -1], [r3(t + 0.09), r3(Math.min(t + 0.18, 2.6)), 'O1', -1])
    oseg.push([2.6, 3.0, 'O1', -1], [3.0, 3.4, 'O10', -1], [3.4, 3.9, 'O7', -1], [3.9, 4.8, 'O1', -1])
    tl.actor('o', oseg, [[0, ox, yc], [0.6, ox, yc], [3.0, ox, yc], [3.4, ox + 3, yc], [3.9, ox, yc], [4.8, ox, yc]])
    tl.actor('b', [[0, 0.3, 'M9'], [3.45, 4.5, 'M9'], [4.5, 4.8, 'M9']], [
      [0, mx, -30, 0], [0.3, mx, yc, 270],
      [3.45, hit - 4, yc - 6, 0], [3.8, hit - 40, yc + 20, 180], [4.15, W * 0.26, gy - 8, 360], [4.3, W * 0.26, gy - 8, 450], [4.5, W * 0.26, gy - 8, 450], [4.8, W * 0.26, H + 30, 540],
    ], { spin: true })
    tl.win(0.3, 0.7, koStars(mx, yc - 36))
    tl.pop(0.64, mx + 40, yc - 36, 'FWOOSH', 13, -6, 0.5)
    ;(['POW', 'BAM', 'BIFF'] as const).forEach((w, i) => tl.pop(1.3 + i * 0.5, ox - 60 + i * 12, yc - 52 + (i % 2) * 8, w, 14, i % 2 ? 8 : -8, 0.4))
    for (let i = 0; i < 8; i++) tl.star3(1.2 + i * 0.18, ox - 40 - (i % 3) * 6, yc - 18 + ((i * 17) % 40), 7)
    for (let t = 1.1; t < 2.6; t += 0.18) tl.shake(t, 1, 0.09)
    tl.shake(3.0, 1, 0.3)
    tl.pop(3.05, hit + 14, yc - 44, 'GRAB', 13, -6, 0.4)
    tl.flash(4.15, 0.35)
    tl.ring(4.15, W * 0.26, gy + 6, 22)
    tl.puff(4.15, W * 0.26, gy + 4, 1.1)
    tl.pop(4.2, W * 0.26, gy - 30, 'BOOM!', 20, -6, 0.7)
    tl.shake(4.15, 4, 0.3)
  } else {
    // ---- Combo C, "Think, Mark" (wall: 4.6 s): a quiet beat
    const kx = mx + 4
    tl.actor('o', [[0, 0.8, 'O1', -1], [0.8, 1.0, 'O9', -1], [1.0, 1.3, 'O9B', -1], [1.3, 2.5, 'O3', -1], [2.5, 3.3, 'O12', -1], [3.3, 4.6, 'O13', -1]], [
      [0, ox, yc - 46], [0.8, ox, yc - 26], [1.0, ox, yc - 28], [1.3, ox, yc - 22], [2.5, ox, yc - 22], [3.3, ox, yc - 22], [4.0, ox - 26, yc - 70], [4.6, ox - 70, -70, undefined, 0],
    ])
    tl.actor('m', [[0.35, 0.6, 'M11'], [0.6, 1.3, 'M7'], [1.3, 4.6, 'M12']], [[0.35, kx, yc + 6], [0.6, kx, yc + 6], [1.0, kx, yc + 6, 0, 1, 1], [1.05, kx, yc + 8, 0, 1, 0.85], [1.3, kx, yc + 8, 0, 1, 0.85], [1.35, kx, yc + 6, 0, 1, 1], [4.6, kx, yc + 6, 0, 1, 1]])
    tl.actor('b', [[0, 0.35, 'M9']], [[0, kx, -30, 0], [0.35, kx, yc + 6, 270]], { spin: true })
    tl.flash(1.0, 0.35)
    tl.star3(1.0, kx + 10, yc - 4, 26)
    tl.pop(1.04, kx + 30, yc - 44, 'KRAK!', 18, -6, 0.5)
    tl.shake(1.0, 4, 0.25)
    tl.bubble(1.3, 1.9, ox - 24, yc - 48, 'THINK, MARK!', true)
    tl.bubble(1.9, 2.5, kx + 26, yc - 34, "I'D STILL HAVE YOU, DAD.")
    tl.win(2.7, 3.3, `<rect x="${r1(ox - 30)}" y="${r1(yc - 52)}" width="2" height="3" fill="#9FE8FF"/>`)
    tl.pop(3.5, ox - 10, yc - 60, 'FWOOSH', 12, -6, 0.5)
    tl.win(3.3, 4.2, `<g opacity=".8">${speedLines(ox - 20, yc + 6, 22, 4, -1, '#FFFFFF', { gap: 5 })}</g>`)
    const sm = tl.actorStill('M12', kx, yc + 6, 1)
    const so = tl.actorStill('O3', ox, yc - 22, -1)
    tl.still = `<g class="dl-still" style="animation-delay:var(--s)">${sm}${so}</g>`
  }
}

export type FightArgs = { W: number; H: number; era: Era; startAt: number; /** Colours kept per frame; ghosts only when true. */ K?: number; big?: boolean }
const pid = (s: string, a: FightArgs, k: string): string => `f${(hash(`${s}${a.W}${a.H}${a.era}${k}`) % 46656).toString(36)}`
const assemble = (tl: Tl, extra = ''): string => {
  const o = tl.out()
  return `<!--dl--><g pointer-events="none" style="--p:${pin(tl.start)};--q:var(--p);--s:${tl.dl(0)}"><style>${FIGHT_CSS}${o.css}</style><defs>${o.defs}</defs><g class="dl-anim">${o.body}${extra}</g>${o.still}</g><!--/dl-->`
}

/** The band's layer of THE FIGHT (the 5.5 s cut, from `startAt`). */
export const fightBand = (a: FightArgs): { svg: string; chain: string[]; frames: number } => {
  const tl = new Tl(pid('b', a, 'b'), a.startAt, 0, a.era, 1.45, a.K ?? 5, a.W, a.H)
  bandCut(tl, a.big ?? false)
  return { svg: assemble(tl), chain: tl.chainKeys(), frames: new Set(tl.chain.map(c => c[1])).size }
}
/** One pane act (0 COVER STORY, 1 THE PAGE, 2 GDA WALL) as a layer to splice into that card. */
export const fightAct = (a: FightArgs, act: ActIndex): { svg: string; chain: string[]; frames: number } => {
  const tl = new Tl(pid('p', a, String(act)), a.startAt, ACT_OFF[act], a.era, 1.9, a.K ?? 5, a.W, a.H)
  actCut(tl, act)
  return { svg: assemble(tl), chain: tl.chainKeys(), frames: new Set(tl.chain.map(c => c[1])).size }
}
/** The panel's shake for a surface: the CSS animation list (none overlap; fill none so a later one never cancels an earlier). */
export const fightShake = (surface: 'band' | 'pane', startAt: number, W: number, H: number, era: Era, act?: ActIndex): string => {
  const a: FightArgs = { W, H, era, startAt }
  const tl = surface === 'band' ? new Tl('s', startAt, 0, era, 1.45, 5, W, H) : new Tl('s', startAt, ACT_OFF[act ?? 0], era, 1.9, 5, W, H)
  if (surface === 'band') bandCut(tl, false)
  else actCut(tl, act ?? 0)
  void a
  return tl.shakes.sort((x, y) => x[0] - y[0]).map(([t, tier, ms]) => `dl-sh${tier} ${ms}s steps(1) none;animation-delay:calc(${pin(startAt)} + ${r3(t)}s)`).join(',')
}
/** The chains of poses each act plays, in time order (the three combos). */
export const COMBOS = COMBO_NAMES
export const chainOfAct = (act: ActIndex | 'band', era: Era = 1): string[] => (act === 'band' ? fightBand({ W: 900, H: 134, era, startAt: 0 }).chain : fightAct({ W: 480, H: act === 0 ? 434 : act === 1 ? 236 : 260, era, startAt: 0 }, act).chain)
/** The slot's hole while Mark is out (the whole fight), sealed by a burst at the end. */
export const fightHole = (era: Era, startAt: number, tile: string): string => {
  const P = pal(era)
  const d = (t: number): string => `calc(${pin(startAt)} + ${r3(t)}s)`
  const hole = `<rect x="14" y="34" width="44" height="46" fill="${tile}"/><path d="M36 40l-6 10 5 6-8 9 6 6m4-31l7 8-6 7 9 8" fill="none" stroke="${P.muted}" stroke-width="1.2"/><ellipse cx="36" cy="58" rx="13" ry="15" fill="${PROPS.ink}"/>`
  return `<g pointer-events="none" style="opacity:0;animation:dl-a ${r3(FIGHT_T)}s steps(1) forwards;animation-delay:${d(0)}">${hole}</g>`
}
export { info as frameInfo }
