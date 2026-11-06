// Extra easter eggs for The Mentalist skin and its hidden Red John skin: a Sacramento
// skyline, Jane's hypnosis swirl, red smileys for heat, drifting card suits, a title
// that flickers to the smiley and a cup of tea. A fan homage: pure SVG strings, no
// state and no I/O. Each drawer fills one of the slots the cyber eggs use in eggs.ts
// (skyline, sandevistan, heatStars, the glyph rain, relicText); the hooks module decides
// when each shows. Every fragment is kept small: the band drawing has a size limit.

import { RED, smiley } from './mentalist'

// The same shape as the theme type in mentalist.ts (which does not export it).
export type MxTheme = { accent: string; accent2: string; done: string; warn: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }

const GOLD = '#C9A227'
const r1 = (v: number): number => +v.toFixed(1)
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d)
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// A small repeatable random: the same picture every time for the same width.
const lcg = (seed: number) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)

// --- Motion: every animated class is `mx-` and is switched off for reduced motion ---
export const MENT_EXTRA_CSS = `.mx-win{animation:mx-win 3.4s steps(1) infinite}@keyframes mx-win{50%{opacity:.2}}
.mx-spin{animation:mx-spin 9s linear infinite}@keyframes mx-spin{to{transform:rotate(360deg)}}
.mx-echo{animation:mx-echo 2.6s ease-in-out infinite}@keyframes mx-echo{50%{opacity:.4}}
.mx-heat{animation:mx-heat .9s steps(1) infinite}@keyframes mx-heat{50%{opacity:.35}}
.mx-fall{animation:mx-fall 16s linear infinite}@keyframes mx-fall{0%{transform:translate(0,-8px);opacity:0}10%,85%{opacity:1}100%{transform:translate(var(--dx,0px),var(--dy,60px));opacity:0}}
.mx-coin{animation:mx-coin 1.8s linear infinite}@keyframes mx-coin{50%{transform:scaleX(.12)}}
.mx-ttl{animation:mx-ttl 11s steps(1) infinite}@keyframes mx-ttl{0%{opacity:1}92%{opacity:0}95%{opacity:1}96%{opacity:0}97%{opacity:1}}
.mx-smile{animation:mx-smile 11s steps(1) infinite}@keyframes mx-smile{0%{opacity:0}92%{opacity:1}95%{opacity:0}96%{opacity:.8}97%{opacity:0}}
.mx-ghost{animation:mx-ghost 11s steps(1) infinite}@keyframes mx-ghost{0%{opacity:0}91%{opacity:.8;transform:translate(-2px,0)}92%{opacity:0}95%{opacity:.7;transform:translate(2px,0)}96%{opacity:0}}
.mx-steam{animation:mx-steam 2.6s ease-in-out infinite}@keyframes mx-steam{0%{transform:translateY(2px);opacity:0}30%{opacity:.7}100%{transform:translateY(-4px);opacity:0}}
@media (prefers-reduced-motion: reduce){.mx-win,.mx-spin,.mx-echo,.mx-heat,.mx-coin,.mx-ttl,.mx-smile,.mx-ghost,.mx-steam{animation:none}.mx-fall{animation:none;transform:translate(0,var(--ys,0px));opacity:1}}`

// --- 1. Sacramento by night: the skyline slot ---
// Drawn in a 24-unit-high space with the ground at y=0 and scaled to the band height.
// From the left: Jane's Citroën DS and his Airstream parked, a few low towers, the
// State Capitol dome and the gold lift towers of Tower Bridge. In the Red John skin the
// night is deep red and black, and one lit window holds a tiny red smiley.
export const mentSkyline = (W: number, H: number, t: MxTheme, isRedJohn: boolean): string => {
  const w0 = Math.max(40, fin(W, 300))
  const h0 = Math.max(8, fin(H, 24))
  const s = Math.min(1.5, Math.max(0.3, h0 / 24))
  const Wd = Math.round(w0 / s)
  const red = isRedJohn
  const far = red ? '#1A0507' : '#111B33'
  const near = red ? '#2B0709' : '#1C2B4D'
  const lit = red ? RED : t.warn
  const capX = Math.max(62, Math.round(Wd * 0.3))
  const hasCap = capX + 18 <= Wd
  const brX = Math.max(hasCap ? capX + 34 : 62, Math.round(Wd * 0.62))
  const hasBr = brX + 46 <= Wd
  const rnd = lcg(7)

  // Low towers: the first is a fixed one right after the trailer (it carries the smiley).
  const towers: string[] = ['M40 0V-14h10V0z']
  const wins: string[][] = [[], [], []]
  const win = (g: number, x: number, y: number) => wins[g]?.push(`M${x} ${y}h1v1h-1z`)
  win(0, 42, -11)
  win(1, 46, -8)
  const pitch = Math.max(14, Wd / 22)
  for (let x = 54; x + 12 < Wd; ) {
    const w = 6 + Math.floor(rnd() * 6)
    const th = 5 + Math.floor(rnd() * 9)
    const clash = (hasCap && x + w > capX - 16 && x < capX + 16) || (hasBr && x + w > brX - 14 && x < brX + 46)
    if (!clash) {
      towers.push(`M${x} 0V-${th}h${w}V0z`)
      if (rnd() < 0.7) win(1 + Math.floor(rnd() * 2), x + 1 + Math.floor(rnd() * (w - 3)), -th + 2 + Math.floor(rnd() * Math.max(1, th - 4)))
    }
    x += Math.max(w + 3, Math.round(pitch * (0.8 + rnd() * 0.5)))
  }

  // The State Capitol: wings, a portico, the drum, the dome and its lantern.
  let cap = ''
  if (hasCap) {
    const c = capX
    cap = `<path d="M${c - 14} 0V-6h28V0zM${c - 8} -6V-10h16V-6zM${c - 3} -10V-14h6V-10zM${c - 4.5} -14a4.5 4.5 0 0 1 9 0zM${c - 1} -18.5v-2h2v2zM${c - 0.5} -21.5h1v1h-1z" fill="${near}"/>`
    for (const dx of [-10, -4, 3, 9]) win(0, c + dx, -4)
  }

  // Tower Bridge: two gold lift towers, the lift span between them and the approaches.
  let bridge = ''
  if (hasBr) {
    const b = brX
    const g = red ? 0.5 : 0.85
    bridge =
      `<path d="M${b - 14} -3h60v2h-60z" fill="${near}"/>` +
      `<path d="M${b} 0V-22h5V0zM${b + 27} 0V-22h5V0zM${b - 1} -23h7v1h-7zM${b + 26} -23h7v1h-7z" fill="${GOLD}" fill-opacity="${g}"/>` +
      `<path d="M${b + 5} -19h22v1h-22zM${b + 5} -5h22v1h-22z" fill="${GOLD}" fill-opacity="${r1(g * 0.65)}"/>` +
      `<path d="M${b + 2} -15h1v4h-1zM${b + 29} -15h1v4h-1z" fill="${far}"/>`
  }

  // Parked at the left end: the DS (long, low, sloped, pale blue-grey) and the Airstream.
  const body = red ? '#6E4A4E' : '#9DB0C8'
  const glass = red ? '#2B0709' : '#5F7390'
  const car =
    `<path d="M5 -6h5v1h2v1h4v2h-1v1h-14v-1h-1v-2h3v-1h2z" fill="${body}"/><path d="M4 -5h7v1h-7z" fill="${glass}"/>` +
    `<path d="M2 -2h3v2h-3zM11 -2h3v2h-3z" fill="#0A1020"/><path d="M15 -4h1v1h-1z" fill="${lit}"/>`
  const trailer =
    `<rect x="21" y="-6" width="13" height="5" rx="2.5" fill="${red ? '#6A5456' : '#C6CFDA'}"/><path d="M23 -4h9v1h-9z" fill="${glass}"/>` +
    `<path d="M26 -2h3v2h-3zM34 -2h2v1h-2z" fill="#0A1020"/>`

  const blink = wins
    .slice(1)
    .map((p, i) => (p.length ? `<path class="mx-win" style="animation-delay:-${(i * 1.7 + 0.6).toFixed(1)}s" d="${p.join('')}" fill="${lit}"/>` : ''))
    .join('')
  const pane = red ? `<rect x="41.5" y="-12.5" width="7" height="7" fill="#4A0A0C"/>${smiley(42, -12, 6, 1)}` : ''
  return (
    `<g opacity=".92" transform="translate(0 ${r1(h0)}) scale(${r1(s)})">` +
    `<rect x="0" y="-1" width="${Wd}" height="1" fill="${t.line}" fill-opacity=".5"/>` +
    `<path d="${towers.join('')}" fill="${far}"/>${cap}${bridge}` +
    `<path d="${wins[0]?.join('')}" fill="${lit}" fill-opacity=".7"/>${blink}${pane}${car}${trailer}</g>`
  )
}

// --- 2. Hypnosis: the afterimage slot ---
// A faint spiral over the working figure at (x, y), with two smaller echoes trailing to
// its left, turning slowly. Low opacity: Jane never makes a show of it.
const spiral = (k: number, step: number): string => {
  const pts: string[] = []
  for (let a = 0; a <= 15.8; a += step) pts.push(`${r1(Math.cos(a) * 0.62 * a * k)} ${r1(Math.sin(a) * 0.62 * a * k)}`)
  return `M0 0L${pts.slice(1).join('L')}`
}
export const hypnosis = (x: number, y: number, t: MxTheme, at: number): string => {
  const ph = (fin(at, 0) / 1000) % 9
  const echo = (dx: number, k: number, op: number, rev: boolean) =>
    `<g class="mx-echo" transform="translate(${r1(x + dx)} ${r1(y)})" opacity="${op}"><g class="mx-spin" style="animation-delay:-${ph.toFixed(1)}s;animation-duration:${rev ? 13 : 9}s${rev ? ';animation-direction:reverse' : ''}"><path d="${spiral(k, k > 0.8 ? 0.7 : 0.9)}" fill="none" stroke="${t.accent2}" stroke-width="${k > 0.8 ? 0.9 : 0.7}" stroke-linecap="round"/></g></g>`
  return `${echo(0, 1, 0.26, false)}${echo(-9, 0.7, 0.16, true)}${echo(-16, 0.45, 0.1, false)}<circle cx="${r1(x)}" cy="${r1(y)}" r="11.5" fill="none" stroke="${t.accent}" stroke-opacity=".12" stroke-dasharray="1.5 3.5"/>`
}

// --- 3. Heat: the heat-stars slot ---
// Five tiny red smileys instead of stars, lit by level (0 to 5); unlit ones are hollow
// dots. At five they all flicker. `y` is the text baseline, as in heatStars.
const MINI = 'M3 0h3v1h-3zM1 1h2v1h-2zM6 1h2v1h-2zM0 2h1v5h-1zM8 2h1v5h-1zM3 3h1v2h-1zM5 3h1v2h-1zM2 5h1v1h-1zM6 5h1v1h-1zM3 6h3v1h-3zM1 7h2v1h-2zM6 7h2v1h-2zM3 8h3v1h-3z'
export const redJohnHeat = (x: number, y: number, level: number, t: MxTheme): string => {
  const lit = Math.max(0, Math.min(5, Math.round(fin(level, 0))))
  return Array.from({ length: 5 }, (_, i) => {
    const px = r1(x + i * 10)
    const py = r1(y - 8)
    return i < lit
      ? `<path${lit === 5 ? ' class="mx-heat"' : ''} transform="translate(${px} ${py}) scale(.89)" d="${MINI}" fill="${RED}" shape-rendering="crispEdges"/>`
      : `<rect x="${r1(px + 1.5)}" y="${r1(py + 1.5)}" width="5" height="5" rx="1" fill="none" stroke="${t.muted}" stroke-opacity=".5"/>`
  }).join('')
}

// --- 4. Cards, a coin and a cup of tea: the glyph-rain slot ---
// Suits drift down the band, faint; now and then Jane's coin and his teacup go by.
const SUITS = ['♠', '♥', '♦', '♣']
export const cardGlyphs = (W: number, H: number, at: number, t: MxTheme): string => {
  const w = Math.max(40, fin(W, 300))
  const h = Math.max(10, fin(H, 40))
  const sec = fin(at, 0) / 1000
  const n = Math.min(7, Math.max(3, Math.round(w / 110)))
  const rnd = lcg(11)
  const dy = r1(h + 14)
  // One drifting thing: its fall is phased by `at`, so a redraw carries on where it was.
  const fall = (i: number, dur: number, dx: number, inner: string): string => {
    const ph = (sec + i * 4.3) % dur
    return `<g class="mx-fall" style="--dx:${dx}px;--dy:${dy}px;--ys:${r1((ph / dur) * (h + 22) - 8)}px;animation-duration:${dur}s;animation-delay:-${ph.toFixed(1)}s">${inner}</g>`
  }
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const suit = SUITS[i % 4] as string
    const hot = i % 4 === 1 || i % 4 === 2
    const gx = r1(((i + 0.3 + rnd() * 0.4) * w) / (n + 2) + 6)
    out.push(fall(i, 13 + Math.floor(rnd() * 8), Math.floor(rnd() * 11) - 5, `<text x="${gx}" y="0" font-size="${8 + Math.floor(rnd() * 3)}" fill="${hot ? RED : t.subtext}" fill-opacity="${hot ? 0.3 : 0.25}">${suit}</text>`))
  }
  const cx = r1(w * (0.3 + rnd() * 0.4))
  out.push(fall(n, 29, 4, `<g transform="translate(${cx} 0)" opacity=".5"><g class="mx-coin"><circle r="3" fill="${GOLD}"/><path d="M-1.4 -1.4a2 2 0 0 1 2.8 0" fill="none" stroke="#F2E2A0" stroke-width=".7"/></g></g>`))
  const ux = r1(w * (0.1 + rnd() * 0.3))
  out.push(fall(n + 1, 37, -4, `<g transform="translate(${ux} 0)" opacity=".4" fill="${t.text}"><path d="M-3.5 -2h7v2.5a3 3 0 0 1 -3 3h-1a3 3 0 0 1 -3 -3z"/><path d="M3.5 -1h1a1.4 1.4 0 0 1 0 2.6h-1" fill="none" stroke="${t.text}" stroke-width=".8"/><path d="M-5 3.8h10v.8h-10z"/></g>`))
  return out.join('')
}

// --- 5. The title that blinks: the title-glitch slot (like relicText) ---
// Every eleven seconds the task title flickers away for a moment, a red smiley takes its
// place, a red ghost of the text tears sideways, and the title comes back. `attrs` are the
// title's own text attributes (font-size, fill, text-anchor). Needs MENT_EXTRA_CSS.
export const smileGlitch = (x: number, y: number, text: string, attrs: string, _t: MxTheme): string => {
  const fs = +(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 12) || 12
  const size = Math.min(16, Math.max(9, Math.round(fs * 1.1)))
  const anchor = /text-anchor="(middle|end)"/.exec(attrs)?.[1]
  const sx = anchor === 'middle' ? x - size / 2 : anchor === 'end' ? x - size : x
  const body = esc(text)
  return (
    `<text class="mx-ttl" x="${r1(x)}" y="${r1(y)}" ${attrs}>${body}</text>` +
    `<text class="mx-ghost" opacity="0" x="${r1(x)}" y="${r1(y)}" ${attrs.replace(/fill="[^"]*"/, '')} fill="${RED}" style="mix-blend-mode:screen">${body}</text>` +
    smiley(r1(sx), r1(y - size * 0.9), size, 0, 'mx-smile')
  )
}

// --- 6. Tea: the idle state of the band ---
// A tiny teacup with three wisps of steam. (x, y) is the top-left of a 12 by 16 box.
export const teaSteam = (x: number, y: number, t: MxTheme): string => {
  const X = r1(x)
  const Y = r1(y)
  const wisp = (dx: number, delay: number) =>
    `<path class="mx-steam" style="animation-delay:-${delay}s" opacity=".5" transform="translate(${r1(X + dx)} ${r1(Y + 7)})" d="M0 0q1.5-1.5 0-3t0-3" fill="none" stroke="${t.subtext}" stroke-width=".8" stroke-linecap="round"/>`
  const P = (dx: number, dy: number): string => `${r1(X + dx)} ${r1(Y + dy)}`
  return (
    `${wisp(4, 0)}${wisp(6.5, 0.9)}${wisp(9, 1.7)}` +
    `<path d="M${P(2, 8)}h8v3a3 3 0 0 1 -3 3h-2a3 3 0 0 1 -3 -3z" fill="${t.text}" fill-opacity=".85"/>` +
    `<path d="M${P(2, 8)}h8v1h-8z" fill="${t.warn}" fill-opacity=".9"/>` +
    `<path d="M${P(10, 9.5)}h1a1.5 1.5 0 0 1 0 3h-1" fill="none" stroke="${t.text}" stroke-opacity=".85" stroke-width=".9"/>` +
    `<path d="M${P(0, 14)}h12v1h-12z" fill="${t.text}" fill-opacity=".6"/>`
  )
}
