// The Better Call Saul skins' trigger words, toasts and the celebration's pieces (meme pass; only lines verified in the
// research notes). Pure functions: the hooks module keeps the little state (when a word was typed, when a toast last
// showed) and passes it in. Every drawing is pinned to the clock with `pin()`, brief, ≤ 3 Hz, still under reduced motion.
//
//   chicanery  Chuck pops up in the band, "I AM NOT CRAZY!" (S3E5), and 1216 <-> 1261 flips beside him
//   1216       the number flip alone
//   namaste    a tiny bowling ball rolls into Howard's small pixel car (S5E4), with a crack flash
//   ding       Hector's bell rings three times
//   saul3d     the band's Saul bust bobs and zooms to a beat for ~4 s (CSS transform only)
import { BCS_CHUCK } from './cast'
import type { Sprite } from './cast'
import { C, FONT, T, bell, clamp, esc, fingerGuns, pal, prop, px, r1, sansW, sid, spW, star } from './bettercallsaul'
import { pin } from './smooth'
import { hashOf } from './cast'

export type FxKind = 'chicanery' | '1216' | 'namaste' | 'ding' | 'saul3d'
export type Fx = { kind: FxKind; at: number }
export const FX_MS: Record<FxKind, number> = { chicanery: 5_000, '1216': 4_000, namaste: 4_500, ding: 3_000, saul3d: 4_000 }
export const fxLive = (fx: Fx | undefined, at: number): fx is Fx => Boolean(fx) && at >= (fx as Fx).at - 1000 && at < (fx as Fx).at + FX_MS[(fx as Fx).kind]

const word = (w: string): RegExp => new RegExp(`(?<![a-z0-9])${w}(?![a-z0-9])`, 'i')
const FX_RES: [FxKind, RegExp][] = [['chicanery', word('chicanery')], ['1216', word('1216')], ['namaste', word('namaste')], ['ding', word('ding')], ['saul3d', word('saul3d')]]
/** The trigger word in a prompt (the first of the list found), or undefined. The prompt itself always goes on unchanged. */
export const fxOf = (text: string): FxKind | undefined => FX_RES.find(([, re]) => re.test(text))?.[0]

// --- toasts: each at most once per a few minutes, only on the two skins
export const TOASTS = {
  done: "S'all good, man!",
  tests: 'I AM NOT CRAZY!',
  force: 'No more half measures.',
  lint: 'Greatest legal mind I ever knew.',
  agent: 'Hey, guys! Can I come in?',
  first: "It's showtime, folks!",
  mcgill: "The name's McGill.",
} as const
export type ToastKey = keyof typeof TOASTS
/** How long each toast waits before it may show again. */
export const TOAST_GAP_MS: Record<ToastKey, number> = { done: 180_000, tests: 180_000, force: 180_000, lint: 180_000, agent: 600_000, first: 3_600_000, mcgill: 3_600_000 }
/** May the toast show now? `last` holds when each last showed. */
export const toastDue = (last: Partial<Record<ToastKey, number>>, key: ToastKey, now: number): boolean => now - (last[key] ?? -Infinity) >= TOAST_GAP_MS[key]
/** The rare "The name's McGill." on GENE (about one job finish in five, seeded by the moment). */
export const mcgillNow = (at: number): boolean => hashOf(`mcgill|${Math.floor(at / 1000)}`) % 5 === 0

export type CmdKind = 'test' | 'lint' | 'force' | null
/** What a Bash command is: a test run, a lint or type check, a force push. */
export const cmdKind = (command: string): CmdKind => {
  const c = command.toLowerCase()
  if (/git\s+push\b[^|;&]*(--force\b|--force-with-lease\b|\s-f\b)/.test(c)) return 'force'
  if (/(^|[\s;&|])(jest|vitest|pytest|go test|cargo test|bun test|npm (run )?test|yarn test|pnpm test|npx (jest|vitest))\b|(^|\s)test(\s|$)/.test(c)) return 'test'
  if (/\b(tsc|eslint|ruff|flake8|mypy|biome|lint|typecheck|type-check)\b/.test(c)) return 'lint'
  return null
}
/** Did a tool result report a failure? Looks at an error flag, then at the text. */
export const resultFailed = (res: unknown): boolean => {
  try {
    const r = res as { isError?: boolean; is_error?: boolean; error?: unknown; result?: unknown } | null
    if (!r || typeof r !== 'object') return false
    if (r.isError === true || r.is_error === true || r.error) return true
    const t = typeof r.result === 'string' ? r.result : JSON.stringify(r.result ?? '')
    return /\b(\d+ fail(ed|ing)?|FAIL\b|exit code [1-9]|exited with [1-9]|error TS\d+|Tests?:\s+\d+ failed|\d+ errors?\b)/i.test(t.slice(0, 6000))
  } catch {
    return false
  }
}
/** The toast a finished Bash call earns, from what came before: `state` is the run of failures this skin has seen. */
export type BashState = { testFails: number; lintFailed: boolean }
export const bashToast = (kind: CmdKind, failed: boolean, state: BashState): { toast?: ToastKey; state: BashState } => {
  if (kind === 'force') return { toast: 'force', state }
  if (kind === 'test') return failed ? (state.testFails >= 1 ? { toast: 'tests', state: { ...state, testFails: state.testFails + 1 } } : { state: { ...state, testFails: 1 } }) : { state: { ...state, testFails: 0 } }
  if (kind === 'lint') return failed ? { state: { ...state, lintFailed: true } } : state.lintFailed ? { toast: 'lint', state: { ...state, lintFailed: false } } : { state }
  return { state }
}

// --- drawings
const FIX = (fx: Fx): string => `style="--d:${FX_MS[fx.kind] / 1000}s;animation-delay:calc(${pin(fx.at)} + 0s)"`

/** 1216 <-> 1261 flipping beside a number tag (Chuck: "I knew it was 1216!"); two frames at ~0.8 Hz. */
export const numberFlip = (x: number, y: number, gene: boolean): string => {
  const P = pal(gene)
  const one = (n: string, cls: string): string => `<g class="${cls}">${T(x + 24, y, n, 13, 700, P.warn, 'text-anchor="middle" font-variant-numeric="tabular-nums"')}</g>`
  return `<rect x="${r1(x)}" y="${r1(y - 13)}" width="48" height="19" rx="2" fill="${prop('manila', gene)}"/><rect x="${r1(x)}" y="${r1(y - 13)}" width="48" height="19" rx="2" fill="${P.tile}" opacity=".78"/>${one('1216', 'bcs-gun1')}${one('1261', 'bcs-gun2')}`
}

/** Chuck pops up at the band's bottom edge with his bubble and the flipping number. */
export const chuckRant = (W: number, H: number, fx: Fx, gene: boolean): string => {
  const P = pal(gene)
  const s = 1.7
  const rows: [number, number] = [0, 26]
  const w = spW(BCS_CHUCK) * s
  const h = (rows[1] - rows[0]) * s
  const x = Math.round(W * 0.55)
  const id = sid('bcsrant', W, H, x)
  const text = 'I AM NOT CRAZY!'
  const bw = sansW(text, 11.5, 0, true) + 18
  const bx = x + w * 0.6
  const by = H - h - 2
  const flip = numberFlip(bx + bw + 8, by + 16, gene)
  const body = fx.kind === 'chicanery' ? `<defs><clipPath id="${id}"><rect x="${r1(x - w)}" y="${r1(H - h - 2)}" width="${r1(w * 2)}" height="${r1(h + 2)}"/></clipPath></defs><g clip-path="url(#${id})">${px(BCS_CHUCK, x - w / 2, H - h, s, { grey: gene, rows })}</g><rect x="${r1(bx)}" y="${r1(by)}" width="${r1(bw)}" height="24" rx="4" fill="${P.tile2}" stroke="${P.sub}" stroke-width="1.2"/><path d="M${r1(bx)} ${r1(by + 7)}l-7 5l7 5z" fill="${P.sub}"/><text x="${r1(bx + bw / 2)}" y="${r1(by + 16)}" text-anchor="middle" font-family="${FONT}" font-size="11.5" font-weight="700" fill="${P.text}">${esc(text)}</text>${flip}` : numberFlip(Math.round(W * 0.55), H - 30, gene)
  return `<g class="bcs-fx" pointer-events="none" ${FIX(fx)}>${body}</g>`
}

/** Howard's small pixel car (silver, a plate-sized dent) and the bowling ball that finds it. */
const HCAR: Sprite = {
  rows: ['................', '....ssssss......', '...sswwwwss.....', '..ssswwwwsss....', '.ssssssssssssss.', 'sssssssssssssssd', 'dsssssssssssssss', '.kkk.dddddd.kkk.'],
  pal: { s: '#AEB6BD', w: '#33414F', d: '#6E767C', k: '#15161A' },
}
export const bowling = (W: number, H: number, fx: Fx, gene: boolean): string => {
  const hit = Math.round(W * 0.62)
  const y = H - 9
  const dly = `animation-delay:calc(${pin(fx.at)} + 0s)`
  const dly2 = `animation-delay:calc(${pin(fx.at)} + 2.4s)`
  const ball = `<circle cx="0" cy="-2.6" r="2.8" fill="${gene ? '#222' : '#1B2A5E'}"/><circle cx="-0.8" cy="-3.6" r="0.5" fill="#000"/><circle cx="0.4" cy="-3.7" r="0.5" fill="#000"/>`
  const car = `<g transform="translate(${hit} ${y})" shape-rendering="crispEdges">${px(HCAR, 0, -8, 1.3, { grey: gene })}</g>`
  const crack = `<g class="bcs-fx" style="--d:1.6s;${dly2.slice(0)}" transform="translate(${hit + 4} ${y - 6})">${star(0, 0, 9, prop('adYellow', gene))}${star(0, 0, 5, gene ? '#F4F4F4' : '#FFF4D6')}<path d="M-2 -3l3 3l-2 3" stroke="#222" stroke-width="1" fill="none"/></g>`
  return `<g pointer-events="none"><g transform="translate(0 ${y})"><g class="bcs-go" style="--a:-10px;--b:${hit - 2}px;animation-duration:2.4s;animation-delay:calc(${pin(fx.at)} + 0s)">${ball}</g></g><g class="bcs-fx" style="--d:${FX_MS.namaste / 1000}s;${dly.slice(0)}">${car}</g>${crack}</g>`
}

/** Hector's bell rings three times (its own copy over the corner one). */
export const dingBell = (W: number, H: number, fx: Fx, gene: boolean): string => {
  const x = W - 21
  const y = H - 17
  const col = prop('bell', gene)
  const arcs = `<g class="bcs-ding" fill="none" stroke="${col}" stroke-width="1.2" stroke-linecap="round" style="animation-delay:calc(${pin(fx.at)} + 0s)"><path d="M${r1(x - 2.6)} ${r1(y + 1.3)}q-2 1.5 0 3.5"/><path d="M${r1(x + 14.3)} ${r1(y + 1.3)}q2 1.5 0 3.5"/><path d="M${r1(x - 5.2)} ${y}q-3 2.5 0 5.5" opacity=".6"/><path d="M${r1(x + 16.9)} ${y}q3 2.5 0 5.5" opacity=".6"/></g>`
  return `<g class="bcs-fx" pointer-events="none" ${FIX(fx)}>${arcs}<g class="bcs-dingt" style="animation-delay:calc(${pin(fx.at)} + 0s)">${bell(x, y, 1.3, 'still', gene)}</g></g>`
}

/** The band layer for a live trigger word. (saul3d is the figure's own zoom.) */
export const fxLayer = (W: number, H: number, fx: Fx | undefined, at: number, gene: boolean): string => {
  if (!fxLive(fx, at)) return ''
  if (fx.kind === 'chicanery' || fx.kind === '1216') return chuckRant(W, H, fx, gene)
  if (fx.kind === 'namaste') return bowling(W, H, fx, gene)
  if (fx.kind === 'ding') return dingBell(W, H, fx, gene)
  return ''
}
/** The Saul bust wrapped in the 3D Saul zoom while `saul3d` is live. */
export const zoomWrap = (inner: string, fx: Fx | undefined, at: number): string => (fxLive(fx, at) && fx.kind === 'saul3d' ? `<g class="bcs-z3" style="animation-delay:calc(${pin(fx.at)} + 0s)">${inner}</g>` : inner)
void clamp
void C
export { fingerGuns }
