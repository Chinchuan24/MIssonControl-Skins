import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// The desktop app refuses a whole drawing past these and shows a blank pane.
const MAX_CHARS = 262_144
const MAX_NODES = 2_000
const MAX_SVG = 131_072
const TYPES = ['Explore', 'mc-heavy', 'mc-medium', 'mc-light', 'general-purpose', 'mc-careful', 'Plan']

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
// Counted the way the app counts: texts, an Svg's source and alt, a button's words, string props.
const own = (o: Record<string, unknown> | undefined) => Object.entries(o ?? {}).reduce((s, [k, v]) => s + k.length + (typeof v === 'string' ? v.length : 0), 0)
const size = (root: unknown) => {
  const r = { chars: 0, nodes: 0, svgs: 0, maxSvg: 0, maxH: 0, alts: [] as string[], buttons: [] as string[] }
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk)
    r.nodes++
    if (typeof x === 'string') {
      r.chars += x.length
      return
    }
    if (!x || typeof x !== 'object') return
    const n = x as Node
    const p = n.props ?? {}
    if (n.type === 'Svg') {
      const src = String(p.source ?? '')
      r.svgs++
      r.chars += src.length + String(p.alt ?? '').length
      r.maxSvg = Math.max(r.maxSvg, src.length)
      r.maxH = Math.max(r.maxH, Number(p.height) || 0)
      r.alts.push(String(p.alt ?? ''))
    } else if (n.type === 'Button') {
      r.chars += String(p.key ?? '').length + String(p.label ?? '').length + 'crab-progress'.length
      r.buttons.push(String(p.label ?? ''))
    } else r.chars += own(p)
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return r
}

const crew = async ($: Engine, on: On, skin: string, count: number) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: skin } as never)
  for (let i = 0; i < count; i++) {
    await $.agent.spawn({
      tool_use_id: `t${i}`,
      prompt: 'p',
      description: `Task number ${i} doing a fairly long description of work`,
      subagentType: TYPES[i % TYPES.length],
      provider: 'engine',
      parentModel: 'claude-opus-5-5',
      // Some agents start agents of their own: the tree nests.
      parentAgentId: i > 3 && i % 5 === 0 ? `a${i - 1}` : undefined,
      background: false,
      fork: false,
    } as never)
  }
}

const mount = ($: Engine, columns: number) =>
  $.ui.mount({
    plugin: 'crab-progress',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'crab-agents',
    props: { title: '', isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: 45 }, view: {} },
  } as never)

const fits = (s: ReturnType<typeof size>) => {
  expect(s.chars).toBeLessThan(MAX_CHARS)
  expect(s.nodes).toBeLessThan(MAX_NODES)
  expect(s.maxSvg).toBeLessThanOrEqual(MAX_SVG)
  expect(s.maxH).toBeLessThanOrEqual(4096)
  // Never blank: something is drawn.
  expect(s.svgs).toBeGreaterThan(0)
}

for (const skin of ['cyberpunk-2077', 'default'])
  for (const count of [10, 30])
    for (const columns of [60, 120])
      test(`${skin}: ${count} running agents fit the desktop pane at ${columns} columns`, async ($, on) => {
        await crew($, on, skin, count)
        const ui = await mount($, columns)
        const s = size(await ui.drawn())
        await ui.unmount()
        fits(s)
        // The long view, not the fallback: every agent in a row of its own (four as
        // cards, the rest slim), none lumped into a "+N more" row, the hierarchy kept.
        expect(s.alts.some(a => a.startsWith('Hierarchy:'))).toBe(true)
        expect(s.alts.filter(a => a.startsWith('Task number')).length).toBe(count)
        expect(s.alts.some(a => /^\+\d+ more agents/.test(a))).toBe(false)
        expect(s.buttons).toContain('Collapse')
      })

test('a finished crew opened card by card stays drawable, down to the short view and back', async ($, on) => {
  await crew($, on, 'cyberpunk-2077', 12)
  for (let i = 1; i <= 12; i++) await $.turn.complete({ agentId: `a${i}`, reason: 'answer', answer: 'ok' } as never)
  const ui = await mount($, 120)
  // Open every folded agent, one by one, while the pane offers one.
  let opened = 0
  for (; opened < 12; opened++) {
    const s = size(await ui.drawn())
    fits(s)
    expect(s.alts.some(a => a.startsWith('Hierarchy:'))).toBe(true)
    const open = (await ui.findAll({ type: 'Button' })).find(b => String(b.props.label) === 'Open ▸')
    if (!open) break
    await ui.press({ key: String(open.props.key) })
  }
  expect(opened).toBeGreaterThan(2)
  // Too many cards for the app: the short view, with the crew's picture and a way back.
  const short = size(await ui.drawn())
  fits(short)
  expect(short.alts.some(a => a.startsWith('Usage:'))).toBe(false)
  expect(short.alts.some(a => a.startsWith('Hierarchy:'))).toBe(true)
  expect(short.buttons).toContain('Fold the opened agents')
  await ui.press({ key: 'fold-all' })
  const back = size(await ui.drawn())
  await ui.unmount()
  fits(back)
  expect(back.alts.some(a => a.startsWith('Usage:'))).toBe(true)
})

// A folded (finished) row and its "Open ▸" button end at the pane's edge, as the running
// card above them does: the row's drawing shrinks into what the button leaves, the button
// never shrinks, and the drawing is the card's width less the button's share.
for (const columns of [40, 60, 120, 140])
  test(`finished rows and their Open button fit the pane at ${columns} columns`, async ($, on) => {
    await crew($, on, 'default', 4)
    for (const id of ['a1', 'a2']) await $.turn.complete({ agentId: id, reason: 'answer', answer: 'ok' } as never)
    const ui = await mount($, columns)
    const root = await ui.drawn()
    await ui.unmount()
    const W = Math.max(240, Math.min(1100, Math.round(columns * 10) - 8))
    const widthOf = (n: Node) => Number(/^<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/.exec(String(n.props?.source ?? ''))?.[1])
    const nodes: Node[] = []
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) return x.forEach(walk)
      if (!x || typeof x !== 'object') return
      nodes.push(x as Node)
      for (const c of (x as Node).children ?? []) walk(c)
    }
    walk(root)
    const kids = (n: Node) => (n.children ?? []).filter((c): c is Node => Boolean(c) && typeof c === 'object')
    const isOpen = (n: Node) => n.type === 'Button' && String(n.props?.label) === 'Open ▸'
    const rows = nodes.filter(n => n.type === 'Box' && kids(n).some(k => kids(k).some(isOpen)))
    expect(rows.length).toBe(2)
    const card = nodes.find(n => n.type === 'Svg' && /^Task number \d/.test(String(n.props?.alt)) && !String(n.props?.alt).includes('tokens'))
    expect(card && widthOf(card)).toBe(W)
    for (const row of rows) {
      expect(row.props?.flexDirection).toBe('row')
      const [pic, btn] = kids(row)
      expect(pic?.props).toMatchObject({ flexGrow: 1, flexShrink: 1, minWidth: 0 })
      expect(btn?.props).toMatchObject({ flexShrink: 0 })
      const svg = kids(pic as Node)[0] as Node
      expect(svg.type).toBe('Svg')
      // No fixed width: the app shrinks it to its slot, as it does the card.
      expect(svg.props?.width).toBeUndefined()
      expect(widthOf(svg) + 80).toBe(W)
    }
  })
