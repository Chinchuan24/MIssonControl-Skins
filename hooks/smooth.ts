// Smooth drawing on the desktop. There an Svg is an image drawn from its source: a
// new source is a new image, decoded again, its animations started from zero. So a
// drawing keeps its source while what it shows holds (`steady`), a new one carries on
// its animations' phase (`phased`), and what moves each second moves inside the image
// (`liveText`, `liveWidth`) instead of asking for a redraw.

// Every phased animation counts from here: fixed for the module's life, so two images
// drawn a second apart agree on the phase. Kept small: a whole minute near the first draw.
let EPOCH: number | null = null
const epoch = (at: number): number => (EPOCH ??= at - (at % 60_000))

const TIME = /^(-?(?:\d+\.?\d*|\.\d+))(m?s)$/
const seconds = (tok: string): number | null => {
  const m = TIME.exec(tok.trim())
  return m ? Number(m[1]) / (m[2] === 'ms' ? 1000 : 1) : null
}
const sec = (n: number): string => `${Math.round(n * 1000) / 1000}s`

// An endless animation's shorthand with its delay moved by `shift`; one that ends
// (an entrance, a strip) plays from its own start, so it is left alone.
const shiftShorthand = (value: string, shift: number): string => {
  if (!/\binfinite\b/.test(value)) return value
  const parts = value.trim().split(/\s+/)
  const times = parts.flatMap((p, i) => (seconds(p) === null ? [] : [i]))
  const at = times[1]
  if (at === undefined) return `${parts.join(' ')} ${sec(shift)}`
  parts[at] = sec((seconds(parts[at] ?? '') ?? 0) + shift)
  return parts.join(' ')
}

// `@@T<ms>@@` stands for "seconds from this image's start to that moment": how a
// strip or a countdown is pinned to the wall clock.
const PIN = /@@T(-?\d+)@@/g
export const pin = (ms: number): string => `@@T${Math.round(ms)}@@`

/**
 * The source as drawn at `at`: each endless CSS or SMIL animation is delayed by the
 * time since the epoch, so a new image picks up where the one it replaces was, and
 * each pin is resolved. Animations that end are left to play from their start.
 */
export const phased = (content: string, at: number): string => {
  const shift = (epoch(at) - at) / 1000
  return content
    .replace(/animation:([^;}"]+)/g, (_, v: string) => `animation:${shiftShorthand(v, shift)}`)
    .replace(/animation-delay:([^;}"]+)/g, (all, v: string) => {
      const s = seconds(v)
      return s === null ? all : `animation-delay:${sec(s + shift)}`
    })
    .replace(/<(animate|animateTransform|animateMotion)\b([^>]*)>/g, (all, tag: string, attrs: string) => {
      if (!/repeatCount="indefinite"/.test(attrs)) return all
      const begin = /\bbegin="([^"]*)"/.exec(attrs)
      if (!begin) return `<${tag} begin="${sec(shift)}"${attrs}>`
      const s = seconds(begin[1] ?? '')
      return s === null ? all : `<${tag}${attrs.replace(begin[0], `begin="${sec(s + shift)}"`)}>`
    })
    .replace(PIN, (_, ms: string) => sec((Number(ms) - at) / 1000))
}

// `@@G<id>:<width>@@` inside a bar's rect: drawn as a short glide from the width the
// slot showed last, so a bar grows to its new value instead of jumping.
const GLIDE = /@@G([\w-]+):(-?[\d.]+)@@/g
export const glide = (id: string, width: number): string => `@@G${id.replace(/[^\w-]/g, '_')}:${Math.round(width * 10) / 10}@@`
const glides = (content: string): Map<string, string> => new Map([...content.matchAll(GLIDE)].map(m => [m[1] ?? '', m[2] ?? '']))

// --- fewer bytes for the same picture.

const STYLE = /<style>([\s\S]*?)<\/style>/g
const RULE = /[^{}]+\{[^{}]*\}/g
const FAMILY = / font-family="([^"]*)"/g

/**
 * The same drawing in fewer bytes: each new source is sent to the desktop and decoded
 * there, so a big crew's every redraw paid for kilobytes nothing reads. Rules whose
 * every selector starts with a class the markup never uses are dropped (a card with no
 * crab carries no crab CSS), and a drawing set in one font names it once, on its root.
 */
export const compact = (content: string): string => {
  if (!content.startsWith('<svg')) return content
  const markup = content.replace(STYLE, '')
  const used = new Set<string>()
  for (const m of markup.matchAll(/\bclass="([^"]*)"/g)) for (const c of (m[1] ?? '').split(/\s+/)) if (c) used.add(c)
  const isDead = (rule: string): boolean =>
    rule
      .slice(0, rule.indexOf('{'))
      .split(',')
      .every(sel => {
        const m = /^\s*\.([\w-]+)/.exec(sel)
        return Boolean(m && !used.has(m[1] ?? ''))
      })
  let out = content.replace(STYLE, (all, css: string) => {
    const kept = css
      .split('\n')
      .map(line => {
        const rules = line.match(RULE)
        return rules && rules.join('') === line ? rules.filter(r => !isDead(r)).join('') : line
      })
      .filter(Boolean)
      .join('\n')
    return kept.trim() ? `<style>${kept}</style>` : ''
  })
  // One font named once: only when it is the only one, attributes and styles alike.
  const families = new Set([...out.matchAll(FAMILY)].map(m => m[1]))
  const root = /^<svg\b[^>]*>/.exec(out)?.[0] ?? ''
  const rootFamily = / font-family="([^"]*)"/.exec(root)?.[1]
  if (families.size === 1 && !out.includes('font-family:')) {
    const family = [...families][0] as string
    if (rootFamily === undefined || rootFamily === family) {
      const body = out.slice(root.length).split(` font-family="${family}"`).join('')
      out = `${rootFamily === undefined ? root.replace(/^<svg\b/, `<svg font-family="${family}"`) : root}${body}`
    }
  }
  return out
}

type Kept = { content: string; source: string; widths: Map<string, string> }
const kept = new Map<string, Kept>()
const KEPT_MAX = 400

/**
 * The source for one slot of a drawing (`slot` names it across redraws): the very
 * same string while the content is the same, so the image is neither decoded again
 * nor restarted; a new content is phased at `at`, its bars gliding from their last widths.
 */
export const steady = (slot: string, content: string, at: number): string => {
  const was = kept.get(slot)
  if (was && was.content === content) return was.source
  const widths = glides(content)
  const source = phased(compact(content), at).replace(GLIDE, (_, id: string, to: string) => {
    const from = was?.widths.get(id)
    return from === undefined || from === to
      ? ''
      : `<animate attributeName="width" from="${from}" to="${to}" dur=".45s" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1" fill="freeze"/>`
  })
  kept.delete(slot)
  kept.set(slot, { content, source, widths })
  if (kept.size > KEPT_MAX) kept.delete(kept.keys().next().value as string)
  return source
}

type Node = { type?: string; key?: unknown; props?: Record<string, unknown>; children?: unknown[] }
const keyOf = (n: Node): string => String(n.key ?? n.props?.key ?? '')

/**
 * A whole drawing's sources made steady: each Svg's slot is its own key, else its
 * nearest keyed box's (an agent's row), so a card keeps its slot as rows come and go.
 */
export const steadyTree = <T>(tree: T, scope: string, at: number): T => {
  const seen = new Map<string, number>()
  const walk = (x: unknown, near: string): unknown => {
    if (Array.isArray(x)) return x.map(c => walk(c, near))
    if (!x || typeof x !== 'object') return x
    const n = x as Node
    const name = keyOf(n) || near
    if (n.type === 'Svg' && typeof n.props?.source === 'string') {
      const k = seen.get(name) ?? 0
      seen.set(name, k + 1)
      return { ...n, props: { ...n.props, source: steady(`${scope}:${name}#${k}`, n.props.source, at) } }
    }
    return Array.isArray(n.children) ? { ...n, children: n.children.map(c => walk(c, name)) } : n
  }
  return walk(tree, '') as T
}

// --- what moves each second, drawn once a minute.

/** Seconds a strip covers: the wall minute and a few past it, for a redraw that comes late. */
export const LIVE_N = 66
const minuteOf = (at: number): number => at - (at % 60_000)
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r1 = (n: number): number => Math.round(n * 10) / 10

/**
 * A text that changes each second (a clock, a countdown, an estimate), as one line per
 * second of the wall minute stepped through by CSS, so it reads right with no redraw.
 * The same minute gives the same markup. `attrs` go on the line group (x via `x`);
 * `fill` is repeated on each line, so a toned value still reads as one element.
 */
export const liveText = (x: number, y: number, at: number, size: number, attrs: string, value: (t: number) => string, fill = ''): string => {
  const t0 = minuteOf(at)
  const step = Math.ceil(size * 1.6)
  const lines: string[] = []
  for (let i = 0; i < LIVE_N; i++) lines.push(`<text y="${i * step}"${fill ? ` fill="${fill}"` : ''}>${esc(value(t0 + i * 1000 + 500))}</text>`)
  const name = `lv${step}`
  return `<svg x="0" y="${r1(y - size * 1.1)}" width="100%" height="${r1(size * 1.5)}" overflow="hidden"><style>@keyframes ${name}{to{transform:translateY(-${(LIVE_N - 1) * step}px)}}</style><g transform="translate(${r1(x)} ${r1(size * 1.1)})" ${attrs}><g style="animation:${name} ${LIVE_N - 1}s steps(${LIVE_N - 1}) forwards;animation-delay:${pin(t0)}">${lines.join('')}</g></g></svg>`
}

/** A bar's width over the same minute, sampled each second: it glides as the time goes. */
export const liveWidth = (at: number, width: (t: number) => number): { start: number; animate: string } => {
  const t0 = minuteOf(at)
  const values = Array.from({ length: LIVE_N }, (_, i) => r1(width(t0 + i * 1000)))
  return {
    start: values[0] ?? 0,
    animate: `<animate attributeName="width" values="${values.join(';')}" dur="${LIVE_N - 1}s" begin="${pin(t0)}" fill="freeze"/>`,
  }
}

/** The wall minute: what a strip's markup is keyed on. */
export const wallMinute = (at: number): number => Math.floor(at / 60_000)

// --- writes that redraw only when something drawn changed.

/** Equal as data: a write of an equal value would still redraw every reader. */
export const isSame = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

// The last drawn-time reading per tick: a tick is written only when it moved.
const readings = new Map<string, string>()
/** True, once, when `reading` differs from the last one under `name`. */
export const isNewReading = (name: string, reading: string): boolean => {
  if (readings.get(name) === reading) return false
  readings.set(name, reading)
  return true
}
