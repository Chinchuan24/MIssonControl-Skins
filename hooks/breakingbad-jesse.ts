// Jesse, the Breaking Bad skins' roaming easter egg (a fan homage to AMC / Sony Pictures Television).
// Walter stays the main guy; Jesse is his partner and pops up here and there in both panels, on the
// shared roamer engine (roamer.ts): he walks across the band or the foot of a card, peeks over a ledge,
// perches on the XP bar, and now and then (at most once per 30 minutes) a small cameo takes the place of
// the engine's takeover: a waving pixel bust slides in at a corner with a clean one-line speech bubble
// and slides out after about 3 s. Pure SVG strings, no state. The words are the show's own catchphrases.
import { BB_JESSE, BB_JESSE_BUST, hashOf } from './cast'
import { bustPx, sansClip, sansW } from './breakingbad-cards'
import type { RoamPlan, RoamTiming } from './roamer'
import type { ThemeRoamer } from './themes'

export const JESSE_LINES: string[] = ['Yeah, science!', 'Yo, Mr. White!', "We're cooking now.", 'Science, yo!', "Mr. White, it's me."]
/** The hoodie's red and the crystal's blue: the ghost copies of his glitch-in. */
export const JESSE_COLORS = { accent: '#E0463E', accent2: '#5EC8F0', text: '#F4F4F4' }
/** Appearances per 30 s window: lower than Capri's, a little more when the context runs high. */
export const jesseChance = (ctxPct: number): number => (ctxPct >= 95 ? 0.35 : 0.25)
/** How long the cameo is on screen, start to gone. */
export const CAMEO_MS = 3_000

const r2 = (n: number): number => +n.toFixed(2)
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const SANS = 'ui-sans-serif,-apple-system,BlinkMacSystemFont,system-ui,sans-serif'

// `delay + x` seconds, as a calc() on a pinned time, or as a plain number from `now`.
const delayer = (startAt: number | undefined, tm: RoamTiming): ((x: number) => string) => {
  if (tm.delay) return x => `calc(${tm.delay} + ${r2(x)}s)`
  const base = tm.now !== undefined && startAt !== undefined ? (startAt - tm.now) / 1000 : 0
  return x => `${r2(base + x)}s`
}

// Every rule is named again in the reduced-motion block: the cameo is then a still, faint bust with its bubble.
export const JESSE_CSS = `.bbj-cam{animation:bbj-cam ${CAMEO_MS / 1000}s ease-in-out both}
@keyframes bbj-cam{0%{opacity:0;transform:translate(var(--sx),0)}15%,82%{opacity:1;transform:none}100%{opacity:0;transform:translate(var(--sx),0)}}
.bbj-bub{animation:bbj-bub ${CAMEO_MS / 1000}s steps(1) both}
@keyframes bbj-bub{0%,18%{opacity:0}19%,100%{opacity:1}}
.bbj-wave{transform-box:fill-box;transform-origin:50% 100%;animation:bbj-wave .6s steps(1) infinite}
@keyframes bbj-wave{50%{transform:rotate(-2deg)}}
@media (prefers-reduced-motion: reduce){.bbj-cam,.bbj-bub,.bbj-wave{animation:none}.bbj-cam{opacity:1;transform:none}.bbj-bus{opacity:.5}}
`

/**
 * The cameo for a panel (W by H): the bust slides in at a bottom corner (right or left, picked from the line) with
 * a speech bubble, waves, and slides out. `tm.delay` (a pinned start) or `tm.now` + `tm.startAt` set where it is.
 */
export const jesseCameo = (W: number, H: number, line: string, tm: RoamTiming): string => {
  const dly = delayer(tm.startAt, tm)
  const text = line || JESSE_LINES[0] as string
  const bh = r2(clamp(H * 0.36, 40, 64))
  const bw = r2((bh * 39) / 40)
  const right = hashOf(text) % 2 === 0
  const bx = r2(right ? W - bw - 10 : 10)
  const by = r2(H - bh - 6)
  const fs = 11.5
  const room = Math.max(40, W - bw - 10 - 10 - 8 - 26)
  const shown = sansClip(text, fs, room, 0, true)
  const tw = r2(sansW(shown, fs, 0, true))
  const bbw = r2(tw + 18)
  const bbh = 24
  const bbx = r2(right ? bx - 8 - bbw : bx + bw + 8)
  const bby = r2(by + bh * 0.3)
  const tail = right ? `M${r2(bbx + bbw)} ${r2(bby + 7)}l7 5l-7 5z` : `M${bbx} ${r2(bby + 7)}l-7 5l7 5z`
  const bubble = `<g class="bbj-bub" style="animation-delay:${dly(0)}"><rect x="${bbx}" y="${bby}" width="${bbw}" height="${bbh}" rx="4" fill="#101410" stroke="${JESSE_COLORS.accent}" stroke-width="1.2"/><path d="${tail}" fill="${JESSE_COLORS.accent}"/><text x="${r2(bbx + bbw / 2)}" y="${r2(bby + 16)}" text-anchor="middle" font-family="${SANS}" font-size="${fs}" font-weight="700" fill="${JESSE_COLORS.text}">${esc(shown)}</text></g>`
  const sx = right ? bw + 24 : -(bw + 24)
  return `<g class="bbj-cam" pointer-events="none" style="--sx:${sx}px;animation-delay:${dly(0)}"><g class="bbj-bus"><g class="bbj-wave">${bustPx(BB_JESSE_BUST, bx, by, bw, bh)}</g></g>${bubble}</g>`
}

/** His peek over a ledge at (x, y): the bust from the chest up, glitching in and out like the engine's other acts. */
export const jessePeek = (x: number, y: number, plan: RoamPlan, tm: RoamTiming): string => {
  const dly = delayer(plan.startAt, tm)
  const dur = plan.durMs / 1000
  const id = `bbjc${plan.bucket}`
  const w = 36
  const h = 39
  return `<defs><clipPath id="${id}"><rect x="${r2(x - w)}" y="${r2(y - h - 6)}" width="${w * 2}" height="${h + 6}"/></clipPath></defs><g class="rm-pk" clip-path="url(#${id})"><g class="rm-in" style="animation-delay:${dly(0)}"><g class="rm-out" style="animation-delay:${dly(dur - 0.45)}"><g transform="rotate(-6 ${x} ${y})" style="filter:drop-shadow(0 0 2px ${JESSE_COLORS.accent})">${bustPx(BB_JESSE_BUST, x - w / 2, y - h + 10, w, h)}</g></g></g></g>`
}

/** The band's ledge: the bottom edge at the far right, clear of the readouts (a bust peeks up over it). */
export const jesseBandSpots = (W: number, H: number): { peek: { x: number; y: number } } => ({ peek: { x: Math.max(40, W - 22), y: H } })

/** Where he peeks and perches on the Periodic Table card (W wide): over the top of the next-element box, and on the NEXT ELEMENT bar. */
export const jessePaneSpots = (W: number, _H: number): { peek?: { x: number; y: number }; sit?: { x: number; y: number } } => {
  const nr = W < 420
  const colW = (nr ? W - 16 : W - 16 - 146 - 16) - 140
  const barW = Math.max(10, colW - 34)
  return { peek: { x: 140 + colW - 13, y: 120 }, sit: { x: 140 + barW * 0.75, y: 131 } }
}

/** One theme's Jesse: the plan's seed differs between the two skins, so they do not cameo in step. */
export const jesseRoamer = (heis: boolean): ThemeRoamer => ({
  sprite: BB_JESSE,
  colors: JESSE_COLORS,
  seed: heis ? 'bb-jesse-h' : 'bb-jesse',
  lines: JESSE_LINES,
  chance: jesseChance,
  peek: jessePeek,
  spots: jessePaneSpots,
  bandSpots: jesseBandSpots,
  sitBar: true,
  hushParty: true,
  css: JESSE_CSS,
})
