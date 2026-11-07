// Invincible: the big eggs besides THE FIGHT (invincible-fight.ts): THE GUARDIANS SHOWDOWN on the GDA WALL, the ERA SWAP
// transition, THINK, MARK, and the plans that schedule them from the clock alone. Each act runs ONE CSS duration with its keyframes
// in percent, so a single pinned delay (`pin(startAt)`) drives every piece: a redraw anywhere in the act resumes it, and a draw up
// to AHEAD_MS before it schedules it (the delay is then positive). Cartoon, never gory: impact stars, flashes, KO swirl stars.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ACT_LEN, ACT_OFF, BAND_CUT, HOLE_END, fightAct, fightBand, fightHole, fightShake } from './invincible-fight'
import type { ActIndex } from './invincible-fight'
import { thinkMark } from './invincible'
import type { Era } from './invincible'
import type { ExtraArgs, PaneCard } from './themes'
import { C, PROPS, SP, caption, halftoneDefs, impact, koStars, pal, px, r1, sfx, speedLines, spH, spW, unit, uniq } from './invincible'

export const slotPlan = (seed: any, at: any, gapMin: any, chance: any, durMs: any) => {
  const gap = gapMin * 60_000
  const slot = Math.floor(at / (2 * gap))
  const startAt = slot * 2 * gap + Math.floor(unit(`${seed}|b|${slot}`) * Math.max(1, gap - durMs))
  const on = unit(`${seed}|on|${slot}`) < chance
  return { on, startAt, endAt: startAt + durMs, bucket: slot }
}
export const live = (p: any, at: any) => p.on && at >= p.startAt && at < p.endAt
export const AHEAD_MS = 75_000
export const DUEL_MS = Math.round(HOLE_END * 1000)
export const SHOWDOWN_MS = 7_400
export const SWAP_MS = 2_200
export const THINK_MS = 3_200
/** THE FIGHT: at most once per 6 minutes, 80 % of slots, so about one per 12-15 min; only drawn while a job is working. */
export const duelPlan = (at: any, era: any) => slotPlan(era === 2 ? 'inv-duel-2' : 'inv-duel', at, 6, 0.8, DUEL_MS)
/** THE SHOWDOWN: one seeded time a day (between 09:00 and 22:00 local), plus the typed trigger `guardians`. */
export const showdownPlan = (at: any, era: any) => {
  const day = Math.floor(at / 86_400_000)
  const d0 = new Date(at)
  d0.setHours(9, 0, 0, 0)
  const startAt = d0.getTime() + Math.floor(unit(`inv-showdown|${era}|${day}`) * 13 * 3_600_000)
  return { on: true, startAt, endAt: startAt + SHOWDOWN_MS, bucket: day }
}
/** Should a draw at `at` include the act: live now, or starting within the look-ahead (an idle draw still shows it). */
export const due = (p: any, at: any) => p.on && at < p.endAt && p.startAt <= at + AHEAD_MS
export const kf = (name: any, frames: any) => `@keyframes ${name}{${frames.map(([p, v]: [number, string]) => `${r1(p)}%{${v}}`).join('')}}`
/** A mover: frames [pct, x, y, rot?, op?]. `${id}` translates (and fades); `${id}r` rotates the inner sprite group. */
export const mover = (id: any, frames: any[][]) => {
  let css = kf(id, frames.map(([p, x, y, , op]: any[]) => [p, `transform:translate(${r1(x)}px,${r1(y)}px)${op !== undefined ? `;opacity:${op}` : ''}`]))
  const rots = frames.filter((f: any[]) => f[3] !== undefined).map(([p, , , rot]: any[]) => [p, `transform:rotate(${r1(rot)}deg)`])
  if (rots.length) css += kf(`${id}r`, rots)
  return css
}
export const dlyOf = (tm: any) => (tm.delay !== undefined ? tm.delay : tm.now !== undefined && tm.startAt !== undefined ? `${r1((tm.startAt - tm.now) / 1000)}s` : '0s')
export const anim = (name: any, ms: any, dly: any, timing: any = 'linear') => `style="animation:${name} ${ms / 1000}s ${timing} both;animation-delay:${dly}"`
export const CTR = 'class="dl-c"'
export const BASE_CSS = `.dl-c{transform-box:fill-box;transform-origin:50% 50%}.dl-still{display:none}`
export const opOnly = (name: any, ons: any) => {
  // ons: [[from, to, op]] windows where the thing shows; 0 elsewhere.
  const f: any[] = [[0, 'opacity:0']]
  for (const [a, b, op] of ons) f.push([a, 'opacity:0'], [a + 0.1, `opacity:${op}`], [b, `opacity:${op}`], [b + 0.1, 'opacity:0'])
  f.push([100, 'opacity:0'])
  return kf(name, f.sort((x: any, y: any) => x[0] - y[0]))
}
export const GUARDIANS = ['INV_REDRUSH', 'INV_DARKWING', 'INV_WARWOMAN', 'INV_IMMORTAL', 'INV_GREENGHOST', 'INV_AQUARUS', 'INV_MARTIANMAN']
export const SD = (t: any) => (t / 7.4) * 100
export const showdown = (W: any, H: any, era: any, tm: any = {}) => {
  const P = pal(era)
  const dly = dlyOf(tm)
  const id = uniq('sd')
  const B = (name: string, timing?: string) => anim(name, SHOWDOWN_MS, dly, timing)
  const ground = H - 36
  const ox = W - 62
  const os = 2.2
  let css = `${BASE_CSS}.sd-still{display:none}@media (prefers-reduced-motion: reduce){.sd-anim{display:none}.sd-still{display:block;animation:sd-stay ${SHOWDOWN_MS / 1000}s steps(1) both}@keyframes sd-stay{0%,96%{opacity:1}100%{opacity:0;visibility:hidden}}}`
  css += kf(`${id}cv`, [[0, 'opacity:0'], [2, 'opacity:1'], [96, 'opacity:1'], [100, 'opacity:0']])
  css += kf(`${id}c1`, [[0, 'opacity:0'], [1.5, 'opacity:1'], [SD(1.0), 'opacity:1'], [SD(1.05), 'opacity:0'], [100, 'opacity:0']])
  css += kf(`${id}c2`, [[0, 'opacity:0'], [SD(6.2), 'opacity:0'], [SD(6.25), 'opacity:1'], [96, 'opacity:1'], [100, 'opacity:0']])
  const hits: number[] = []
  let body = ''
  let defs = ''
  GUARDIANS.forEach((k, i) => {
    const sp = (SP as any)[k]
    const t0 = 0.9 + 0.72 * i
    const th = t0 + 0.45
    const tg = t0 + 0.8
    hits.push(SD(th))
    const GS = 1.4
    const w = spW(sp) * GS
    const h = spH(sp) * GS
    const stop = ox - 16 - w / 2
    defs += `<g id="${id}g${i}">${px(sp, -w / 2, -h / 2, GS)}</g>`
    css += mover(`${id}r${i}`, [[0, -40, ground - h / 2, 0, 0], [SD(t0), -40, ground - h / 2, 0, 0], [SD(t0) + 0.1, -40, ground - h / 2, 0, 1], [SD(th), stop, ground - h / 2, 0, 1], [SD(th) + 0.1, stop - 4, ground - h / 2 - 10, -40], [SD(tg), -60, ground - 120, -720, 1], [SD(tg) + 0.1, -60, ground - 120, -720, 0], [100, -60, ground - 120, -720, 0]])
    css += kf(`${id}k${i}`, [[0, 'opacity:0'], [SD(th), 'opacity:0'], [SD(th) + 0.1, 'opacity:1'], [SD(th + 0.8), 'opacity:1'], [SD(th + 1.2), 'opacity:0'], [100, 'opacity:0']])
    css += kf(`${id}f${i}`, [[0, 'opacity:0;transform:scale(.3)'], [SD(th), 'opacity:0;transform:scale(.3)'], [SD(th) + 0.1, 'opacity:1;transform:scale(1.2)'], [SD(th + 0.2), 'opacity:1;transform:scale(1)'], [SD(th + 0.3), 'opacity:0'], [100, 'opacity:0']])
    body += `<g ${B(`${id}r${i}`)}>${speedLines(-w / 2 - 2, 0, 28, 5, 1, PROPS.white, { gap: 5, op: 0.8 })}<g ${CTR} ${B(`${id}r${i}r`)}><use href="#${id}g${i}"/></g></g>`
    body += `<g transform="translate(${r1(ox - 30)} ${r1(ground - 36)})"><g ${CTR} ${B(`${id}f${i}`, 'steps(2)')}>${impact(0, 0, 15)}</g></g>`
    body += `<g ${B(`${id}k${i}`, 'steps(1)')}>${koStars(ox - 36 - (i % 3) * 12, ground - 74 - Math.floor(i / 3) * 14)}</g>`
  })
  // Omni-Man never uncrosses his arms; a one-frame recoil at each hit.
  css += kf(`${id}om`, [[0, 'transform:none'], ...hits.flatMap(p => [[p, 'transform:none'], [p + 0.1, 'transform:translate(2px,0)'], [p + 1.5, 'transform:none']]), [100, 'transform:none']])
  const omni = `<g transform="translate(${r1(ox)} ${r1(ground)})"><ellipse cx="0" cy="0" rx="14" ry="2.5" fill="#000" opacity=".35"/><g ${B(`${id}om`, 'steps(1)')}>${px(SP.INV_OMNI_HOVER, -spW(SP.INV_OMNI_HOVER) * os / 2, -spH(SP.INV_OMNI_HOVER) * os, os)}</g></g>`
  const sky = `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="#BFE0FF"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="url(#${id}h)"/><rect x="10" y="${ground}" width="${W - 20}" height="${H - 10 - ground}" fill="#8E9AA3"/><rect x="10" y="${ground}" width="${W - 20}" height="2" fill="${PROPS.ink}"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${PROPS.ink}" stroke-width="2.5"/>`
  const c1 = caption(18, 18, 'THE GUARDIANS OF THE GLOBE', 9.5)
  const c2 = caption(18, 18, 'LAST ONE STANDING.', 9.5, PROPS.red, { ink: '#FFFFFF' })
  const cover = `<g ${B(`${id}cv`, 'steps(1)')}><rect width="${W}" height="${H}" fill="${P.tile}" opacity=".9"/>${sky}</g>`
  const captions = `<g ${B(`${id}c1`, 'steps(1)')}>${c1.svg}</g><g ${B(`${id}c2`, 'steps(1)')}>${c2.svg}</g>`
  const still = `<g class="sd-still"><rect width="${W}" height="${H}" fill="${P.tile}" opacity=".9"/>${sky}${omni}${GUARDIANS.map((_, i) => koStars(26 + i * ((W - 120) / 6), ground - 14 - (i % 2) * 20)).join('')}${c2.svg}</g>`
  return `<g pointer-events="none"><style>${css}</style><defs>${halftoneDefs(`${id}h`, PROPS.sky, 1.1, 5, 0.5)}${defs}</defs><g class="sd-anim">${cover}<g ${B(`${id}cv`, 'steps(1)')}>${omni}${body}${captions}</g></g>${still}</g>`
}

// ---------------------------------------------------------------- THE ERA SWAP (2.2 s, over a panel already drawn in the new era)
export const SW = (t: any) => (t / 2.2) * 100
export const swap = (W: any, H: any, surface: any, toEra: any, tm: any = {}) => {
  const NU = pal(toEra)
  const OLD = pal(toEra === 2 ? 1 : 2)
  const dly = dlyOf(tm)
  const id = uniq('sw')
  const S = (name: string, timing?: string) => anim(name, SWAP_MS, dly, timing)
  const band = surface === 'band'
  const size = band ? (W < 800 ? 32 : 40) : W < 400 ? 20 : 26
  const cx = W / 2
  const cy = band ? H / 2 + 4 : H / 2
  const sub = toEra === 2 ? 'YOU WANT A REAL COSTUME, RIGHT?' : "IT'S ABOUT TIME"
  let css = `${BASE_CSS}.sw-still{display:none}@media (prefers-reduced-motion: reduce){.sw-anim{display:none}.sw-still{display:block;animation:sw-stay ${SWAP_MS / 1000}s steps(1) both}@keyframes sw-stay{0%,92%{opacity:1}100%{opacity:0;visibility:hidden}}}
.sw-veil{mix-blend-mode:hue}@supports not (mix-blend-mode:hue){.sw-veil{display:none}}`
  css += kf(`${id}fl`, [[0, 'opacity:.9'], [SW(0.15), 'opacity:0'], [100, 'opacity:0']])
  css += kf(`${id}sl`, [[0, 'opacity:0;transform:scale(3.2)'], [SW(0.05), 'opacity:1;transform:scale(3.2)'], [SW(0.4), 'transform:scale(.94)'], [SW(0.5), 'transform:scale(1)'], [SW(1.7), 'opacity:1;transform:scale(1)'], [100, 'opacity:0;transform:scale(1.04) translateY(-8px)']])
  css += kf(`${id}sb`, [[0, 'opacity:0'], [SW(0.5), 'opacity:0'], [SW(0.55), 'opacity:1'], [SW(1.7), 'opacity:1'], [SW(1.75), 'opacity:0'], [100, 'opacity:0']])
  css += kf(`${id}sh`, [[0, 'transform:none'], [SW(0.4), 'transform:translate(-3px,1px)'], [SW(0.45), 'transform:translate(3px,-1px)'], [SW(0.5), 'transform:translate(-1px,0)'], [SW(0.55), 'transform:none'], [100, 'transform:none']])
  css += kf(`${id}vl`, [[0, 'clip-path:inset(0 0 0 0)'], [SW(0.55), 'clip-path:inset(0 0 0 0)'], [SW(1.45), 'clip-path:inset(0 0 0 100%)'], [100, 'clip-path:inset(0 0 0 100%)']])
  css += kf(`${id}fr`, [[0, 'opacity:0;transform:translateX(0)'], [SW(0.55), 'opacity:0;transform:translateX(0)'], [SW(0.6), 'opacity:1'], [SW(1.4), 'opacity:1'], [SW(1.45), `opacity:0;transform:translateX(${W}px)`], [100, `opacity:0;transform:translateX(${W}px)`]])
  let s = `<g pointer-events="none"><style>${css}</style><g class="sw-anim">`
  s += `<rect width="${W}" height="${H}" fill="${PROPS.flash}" ${S(`${id}fl`, 'steps(2)')}/>`
  s += `<g class="sw-veil" ${S(`${id}vl`, 'cubic-bezier(.7,0,.3,1)')}><rect width="${W}" height="${H}" fill="${OLD.hero}"/></g>`
  s += `<g ${S(`${id}fr`, 'cubic-bezier(.7,0,.3,1)')}><rect x="-6" y="0" width="12" height="${H}" fill="${NU.hero}" opacity=".5"/><rect x="-1" y="0" width="2" height="${H}" fill="${PROPS.white}"/></g>`
  // the band's avatar morph: the old bust over the new one, in six row slices that go one by one
  if (band) {
    const oldSp = toEra === 2 ? SP.INV_MARK_BUST : SP.INV_MARK_S3_BUST
    const ox = toEra === 2 ? 18 : 19
    const rows = spH(oldSp)
    const sliceH = Math.ceil(rows / 6)
    let defs = `<defs><g id="${id}b">${px(oldSp, ox, 38, 0.9)}</g>`
    let slices = ''
    for (let i = 0; i < 6; i++) {
      const y0 = r1(38 + i * sliceH * 0.9)
      const hh = r1(sliceH * 0.9 + 0.5)
      const at = 0.7 + unit(`${id}|${i}`) * 0.6
      css += kf(`${id}s${i}`, [[0, 'opacity:1'], [SW(at), 'opacity:1'], [SW(at) + 0.5, 'opacity:0'], [100, 'opacity:0']])
      defs += `<clipPath id="${id}k${i}"><rect x="16" y="${y0}" width="40" height="${hh}"/></clipPath>`
      slices += `<g ${S(`${id}s${i}`, 'steps(1)')}><rect x="16" y="${y0}" width="40" height="${hh}" fill="${NU.tile}"/><use href="#${id}b" clip-path="url(#${id}k${i})"/><rect x="14" y="${r1(y0 + hh - 1)}" width="44" height="1.5" fill="${NU.hero}"/></g>`
    }
    s += `${defs}</defs>${slices}`
  }
  s += `<g ${S(`${id}sh`, 'steps(1)')}><g ${CTR} ${S(`${id}sl`, 'cubic-bezier(.2,1.2,.3,1)')}>${sfx(cx, cy + size * 0.32, 'INVINCIBLE', size, NU.hero, { anchor: 'middle', skew: -12, ls: 1.5 })}</g>`
  const cap = caption(0, 0, sub, band ? 9.5 : 8.5, NU.hero, { ink: NU.heroInk })
  s += `<g ${S(`${id}sb`, 'steps(1)')}><g transform="translate(${r1(cx - cap.w / 2)} ${r1(cy + size * 0.32 + 8)})">${cap.svg}</g></g></g></g>`
  const note = toEra === 2 ? 'NEW SUIT · S3+' : 'CLASSIC SUIT · S1–S2'
  const nc = caption(0, 0, note, 9.5, NU.hero, { ink: NU.heroInk })
  s += `<g class="sw-still"><g transform="translate(${r1(cx - nc.w / 2)} ${r1(cy - 8)})">${nc.svg}</g></g></g>`
  // the slice keyframes were added after the style was emitted: put the final css in
  return s.replace(/<style>[\s\S]*?<\/style>/, `<style>${css}</style>`)
}
export const THINK_RE = /\bthink,?\s+mark\b/i
export const NEW_SUIT_RE = /\b(?:new\s+suit|season\s*(?:3|three|4|four))\b/i
export const CLASSIC_RE = /\b(?:classic\s+suit|old\s+suit|season\s*(?:1|one|2|two))\b/i
export const GUARDIANS_RE = /\bguardians\b/i

// ---------------------------------------------------------------- what the theme's `extras` slot draws
/** Which pane card carries which act: COVER STORY the catch, GDA WALL every angle, THE PAGE think, Mark. */
export const ACT_OF: Record<PaneCard, ActIndex> = { cred: 0, task: 1, log: 2 }
const liveAt = (since: number | undefined, at: number, ms: number): since is number => since !== undefined && since > 0 && at >= since - 1000 && at < since + ms
const dly = (t: number): string => `calc(${pin(t)} + 0s)`
const pin = (ms: number): string => `@@T${Math.round(ms)}@@`
/** The showdown is on the GDA WALL for its 7.4 s: typed (`fx`), or the day's seeded time. */
export const showdownDue = (at: number, era: Era, fx?: { kind: string; at: number }): number | undefined => {
  if (fx?.kind === 'showdown' && liveAt(fx.at, at, SHOWDOWN_MS)) return fx.at
  const p = showdownPlan(at, era)
  return due(p, at) ? p.startAt : undefined
}
/** The fight's plan for a draw, or undefined: only while a job works, never with the swap, THINK, MARK or the showdown. */
export const fightDue = (at: number, era: Era, working: boolean | undefined, fx?: { kind: string; at: number }, swapAt?: number): number | undefined => {
  if (!working) return undefined
  if (liveAt(swapAt, at, SWAP_MS + 500) || (fx && liveAt(fx.at, at, fx.kind === 'think' ? THINK_MS : fx.kind === 'showdown' ? SHOWDOWN_MS : 0))) return undefined
  const p = duelPlan(at, era)
  if (!due(p, at)) return undefined
  if (showdownPlan(at, era).startAt < p.endAt + 5000 && showdownPlan(at, era).endAt > p.startAt - 5000) return undefined
  return p.startAt
}
/** The slot's hole, THE FIGHT's band cut and the pane acts, THE SHOWDOWN, the era swap and THINK, MARK for a panel. */
export const invExtras = (era: Era, tile: string) => (o: ExtraArgs): string => {
  if (o.party) return ''
  const out: string[] = []
  const idx = o.card ? ACT_OF[o.card] : 0
  if (liveAt(o.swapAt, o.at, SWAP_MS)) out.push(swap(o.W, o.H, o.surface, era, { delay: dly((o.swapAt as number) + (o.surface === 'pane' ? 60 * idx : 0)) }))
  if (o.surface === 'band') {
    if (o.fx?.kind === 'think' && liveAt(o.fx.at, o.at, THINK_MS)) out.push(thinkMark(o.W, o.H, era, dly(o.fx.at)))
    const f = fightDue(o.at, era, o.working, o.fx, o.swapAt)
    if (f !== undefined) {
      out.push(fightHole(era, f, tile))
      if (o.at < f + BAND_CUT * 1000 + 600) out.push(fightBand({ W: o.W, H: o.H, era, startAt: f }).svg)
    }
  } else {
    const sd = showdownDue(o.at, era, o.fx)
    if (o.card === 'task' && sd !== undefined && !(o.working && fightDue(o.at, era, true, o.fx, o.swapAt) !== undefined)) out.push(`<!--dl-->${showdown(o.W, o.H, era, { delay: dly(sd) })}<!--/dl-->`)
    const f = fightDue(o.at, era, o.working, o.fx, o.swapAt)
    if (f !== undefined && o.card && o.at < f + (ACT_OFF[idx] + ACT_LEN[idx]) * 1000 + 600) out.push(fightAct({ W: o.W, H: o.H, era, startAt: f }, idx).svg)
  }
  return out.join('')
}
/** The panel's camera shake (CSS animation list for a wrapper), or '' when no fight is due. */
export const invShake = (era: Era) => (o: { W: number; H: number; surface: 'band' | 'pane'; at: number; card?: PaneCard; working?: boolean; fx?: { kind: string; at: number }; swapAt?: number }): string => {
  const f = fightDue(o.at, era, o.working, o.fx, o.swapAt)
  if (f === undefined) return ''
  return fightShake(o.surface, f, o.W, o.H, era, o.surface === 'pane' ? ACT_OF[o.card ?? 'cred'] : undefined)
}
