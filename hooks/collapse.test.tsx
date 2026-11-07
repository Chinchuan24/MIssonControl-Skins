import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { liveText, steadyTree } from './smooth'

// "Collapse, then Expand, and the whole pane glitches." A small crew on a skin with
// big cards sat at the pane's size limit: it was measured with every source raw (the
// app gets them compacted, a third shorter), and with no margin, so a few characters
// more or less (a log line, a roamer's visit) flipped the whole pane between layouts
// (cards, slim rows, the short view) redraw after redraw. And on Expand every card came
// back as a new image with a source pinned to the start of the one that had gone.

const T0 = Date.parse('2026-10-19T10:00:00Z')
// A seasoned person's store: the cards a skin with eggs draws are at their fullest.
const SEED: Record<string, unknown> = {
  cred: { xp: 5992, jobs: 314, longJobs: 94, agents: 636, crewJobs: 15, nightJobs: 93, chromed: true, samurai: false, badges: ['choom', 'merc', 'netrunner', 'owl', 'chromed', 'edgerunner', 'legend', 'crewboss'] },
  legends: [45, 27, 60, 60, 60].map((n, i) => ({ task: `A long job number ${i} that took a while to finish properly`.padEnd(n, '.').slice(0, n), costUsd: 20 + i * 7.5, at: T0 - (i + 1) * 3_600_000, ms: 3_000_000 + i * 600_000 })),
  today: { date: '2026-10-19', tasks: 101, agents: 37, tokens: 588_542_875, costUsd: 189.39 },
  allTime: { since: '2026-09-20T06:36:30.675Z', models: { 'claude-opus-5-5': 6_660_303_105, 'claude-sonnet-5-5': 514_351_605, 'claude-haiku-5-5': 8_161_277 } },
  oneShot: 'on',
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

const crew = async ($: Engine, on: On, skin: string) => {
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, structuredClone(SEED))
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 400_000 }, rateLimits: [], cost: { usd: 12 } } }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: skin } as never)
  await $.prompt.submit({ text: 'Build the new skins and verify them all', cursor: 0, origin: { kind: 'composer' } } as never)
  const names = ['Engineer: Breaking Bad skin cards', 'Designer: Edgerunners 2 skin', 'Researcher: Edgerunners lore']
  for (const [i, type] of ['mc-heavy', 'mc-medium', 'Explore'].entries())
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: names[i], subagentType: type, provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  return clock
}
// The main desktop pane at about 780 px.
const mount = ($: Engine) =>
  $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: { title: '', isFocused: false, bodyColumns: 97, placement: 'dock', scroll: { offset: 0, bodyRows: 45 }, view: {} } } as never)
const fillLog = async ($: Engine, clock: { advance: (ms: number) => Promise<unknown> }) => {
  for (let i = 0; i < 14; i++) {
    await $.tool.call({ tool: 'Bash', command: `npm test -- --grep step-${i} && echo a long command line to fill the log`, agentId: `a${(i % 3) + 1}` } as never).catch(() => undefined)
    await clock.advance(1_000)
  }
}

const svgs = (root: unknown) => {
  const out: { alt: string; source: string }[] = []
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk)
    if (!x || typeof x !== 'object') return
    const n = x as Node
    if (n.type === 'Svg') out.push({ alt: String(n.props?.alt), source: String(n.props?.source ?? '') })
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return out
}
// Which layout is drawn: running cards, slim rows, the hierarchy's drawing, the short view.
const layout = (root: unknown) => {
  const all = svgs(root)
  const agents = all.filter(v => /: (Opus|Sonnet|Haiku)[^,]*, running/.test(v.alt))
  const slim = agents.filter(v => /^<svg[^>]*\sheight="36"/.test(v.source)).length
  const org = all.find(v => v.alt.startsWith('Hierarchy'))?.source.length ?? 0
  const isShort = !all.some(v => v.alt.startsWith('Manager:'))
  return `${isShort ? 'short' : 'full'} cards=${agents.length - slim} slim=${slim} org=${org > 20_000 ? 'rich' : 'light'}`
}
const sentChars = (root: unknown) => svgs(root).reduce((sum, v) => sum + v.source.length + v.alt.length, 0)

for (const skin of ['breaking-bad', 'crab-classic', 'mentalist', 'edgerunners-2'])
  // Ten minutes of redraws on a skin with big cards: slower than the 5-second default on a busy machine.
  test(`${skin}: after Collapse then Expand the pane draws as before and holds its layout as the work goes on`, { timeoutMs: 20_000 }, async ($, on) => {
    const clock = await crew($, on, skin)
    const ui = await mount($)
    await fillLog($, clock)
    const before = layout(await ui.drawn())
    await ui.press({ key: 'compact' })
    expect(layout(await ui.drawn())).toMatch(/^short/)
    await ui.press({ key: 'compact' })
    expect(layout(await ui.drawn())).toBe(before)
    // Ten minutes of work: the layout never flips (to the short view and back, cards to rows).
    const seen: string[] = []
    for (let i = 0; i < 40; i++) {
      if (i % 3 === 0) await $.tool.call({ tool: 'Read', file_path: `/repo/src/file-${i}.ts`, agentId: `a${(i % 3) + 1}` } as never).catch(() => undefined)
      await clock.advance(15_000)
      const root = await ui.drawn()
      const now = layout(root)
      if (seen.at(-1) !== now) seen.push(now)
      expect(sentChars(root)).toBeLessThan(262_144)
    }
    await ui.unmount()
    expect(seen).toEqual([before])
    // Three agents are few: no short view, every one in a row of its own.
    expect(before).toMatch(/^full /)
    expect(Number(/cards=(\d)/.exec(before)?.[1]) + Number(/slim=(\d)/.exec(before)?.[1])).toBe(3)
  })

for (const skin of ['breaking-bad', 'mentalist'])
  test(`${skin}: three agents keep their cards, the pane measured as it is sent`, async ($, on) => {
    const clock = await crew($, on, skin)
    await fillLog($, clock)
    const ui = await mount($)
    const root = await ui.drawn()
    await ui.unmount()
    expect(layout(root)).toBe('full cards=3 slim=0 org=rich')
    expect(sentChars(root)).toBeLessThan(262_144)
  })

test('steadyTree: a drawing that comes back after one without it is phased to its new start', () => {
  const strip = liveText(10, 20, T0, 12, 'class="t"', t => String(Math.floor((t - T0) / 1000)))
  const card = { type: 'Box', props: {}, children: [{ type: 'Svg', key: 'card', props: { key: 'card', source: `<svg>${strip}</svg>`, alt: 'card' } }] }
  const none = { type: 'Box', props: {}, children: [{ type: 'Svg', key: 'other', props: { key: 'other', source: '<svg/>', alt: 'other' } }] }
  const sourceOf = (tree: unknown) => String(((tree as Node).children?.[0] as Node).props?.source)
  const delayOf = (src: string) => Number(/animation-delay:(-?[\d.]+)s/.exec(src)?.[1])
  const first = sourceOf(steadyTree(card, 'test:back', T0 + 5_000))
  // Drawn again while it stays: the very same source (no new image, no restart).
  expect(sourceOf(steadyTree(card, 'test:back', T0 + 8_000))).toBe(first)
  expect(delayOf(first)).toBe(-5)
  // Gone for a drawing (the pane collapsed), back 20 s later (expanded): a new image,
  // its strip standing on the second it is drawn at, not the one the old image began at.
  steadyTree(none, 'test:back', T0 + 10_000)
  const back = sourceOf(steadyTree(card, 'test:back', T0 + 25_000))
  expect(delayOf(back)).toBe(-25)
  expect(sourceOf(steadyTree(card, 'test:back', T0 + 26_000))).toBe(back)
})

// --- A running agent's slim row opens to its full card, as a finished row does.

const W97 = Math.max(240, Math.min(1100, Math.round(97 * 10) - 8))
const six = async ($: Engine, on: On, store: Record<string, unknown> = {}) => {
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  const kv = new Map<string, unknown>(Object.entries(store))
  const reads = { pane: 0 }
  on('store.get', async (_$, e) => {
    const k = (e as { key: string }).key
    if (k === 'legends') reads.pane++
    return { value: structuredClone(kv.get(k)) } as never
  })
  on('store.set', async (_$, e) => {
    kv.set((e as { key: string }).key, structuredClone((e as { value: unknown }).value))
    return { value: undefined } as never
  })
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('fs.exists', async () => ({ value: false }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: 'crab-classic' } as never)
  for (let i = 0; i < 6; i++)
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: 'mc-heavy', provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm run build', agentId: 'a1' } as never).catch(() => undefined)
  return { clock, kv, reads }
}
type Row = { alt: string; source: string; isSlim: boolean }
const rowsOf = async (ui: Awaited<ReturnType<typeof mount>>) => {
  const root = await ui.drawn()
  const buttons = (await ui.findAll({ type: 'Button' })).map(b => ({ key: String(b.props.key), label: String(b.props.label) }))
  const rows: Row[] = svgs(root)
    .filter(v => /^Engineer: piece \d/.test(v.alt))
    .map(v => ({ alt: v.alt, source: v.source, isSlim: /^<svg[^>]*\sheight="36"/.test(v.source) }))
  return { root, rows, buttons }
}
const slimOpen = (buttons: { key: string; label: string }[]) => buttons.filter(b => b.label === 'Open ▸').map(b => b.key)

test('a running agent past the cards has a slim row with Open ▸; it opens to its full card and closes again', async ($, on) => {
  const { clock, reads } = await six($, on)
  const ui = await mount($)
  const first = await rowsOf(ui)
  // Four cards, two slim live rows, each with its own Open button.
  expect(first.rows.filter(r => r.isSlim).length).toBe(2)
  const opens = slimOpen(first.buttons)
  expect(opens.length).toBe(2)
  const slimAlt = first.rows.find(r => r.isSlim)?.alt ?? ''
  // The slim row shrinks by the button's share: both end at the pane's edge.
  const slimSrc = first.rows.find(r => r.isSlim)?.source ?? ''
  expect(Number(/^<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/.exec(slimSrc)?.[1]) + 80).toBe(W97)
  const pieceN = Number(/piece (\d)/.exec(slimAlt)?.[1])
  const who = `Engineer: piece ${pieceN}:`
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/login.ts', agentId: `a${pieceN + 1}` } as never).catch(() => undefined)
  await ui.press({ key: opens[0] as string })
  const open = await rowsOf(ui)
  // That agent now has its card; the other stays slim.
  expect(open.rows.filter(r => r.isSlim).length).toBe(1)
  const card = open.rows.find(r => r.alt.startsWith(who))
  expect(card?.isSlim).toBe(false)
  // The full card: what it is doing now, the model, effort, context, cost, time, and the Ultra switch.
  expect(card?.alt).toMatch(/Opus 5\.5, running/)
  for (const field of ['reading login.ts', 'Opus 5.5', 'Model', 'Effort', 'Context', 'Cost', 'Time']) expect(card?.source).toContain(field)
  expect(open.buttons.some(b => b.label === '▴ Collapse')).toBe(true)
  expect(open.buttons.filter(b => /Turn Ultra (on|off)/.test(b.label)).length).toBe(5)
  // Opening is one redraw, not a storm; then the live card still moves with its work.
  const n0 = reads.pane
  for (let i = 0; i < 30; i++) await clock.advance(100)
  expect(reads.pane - n0).toBeLessThanOrEqual(1)
  await $.tool.call({ tool: 'mcp__crab-progress__step', done: 2, total: 4, agentId: `a${pieceN + 1}` } as never)
  const moved = (await rowsOf(ui)).rows.find(r => r.alt.startsWith(who))
  expect(moved?.isSlim).toBe(false)
  expect(moved?.source).not.toBe(card?.source)
  // Collapse folds it back to its slim live row.
  const close = open.buttons.find(b => b.label === '▴ Collapse')?.key as string
  await ui.press({ key: close })
  const back = await rowsOf(ui)
  await ui.unmount()
  expect(back.rows.find(r => r.alt.startsWith(who))?.isSlim).toBe(true)
  expect(slimOpen(back.buttons).length).toBe(2)
})

test('an opened running card is kept in the store: a reload keeps it open, a gone agent is dropped', async ($, on) => {
  const { kv } = await six($, on, { paneView: { isCompact: false, isDoneCollapsed: false, expanded: ['ghost'] } })
  const ui = await mount($)
  const key = slimOpen((await rowsOf(ui)).buttons)[0] as string
  await ui.press({ key })
  await ui.unmount()
  const saved = kv.get('paneView') as { expanded?: string[] }
  // The opened agent is saved; the id of one no longer listed is not.
  expect(saved.expanded?.length).toBe(1)
  expect(saved.expanded).not.toContain('ghost')
  // A reload reads the view back from the store: the card is still open.
  await $.session.start({ source: 'resume', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  const again = await mount($)
  const after = await rowsOf(again)
  await again.unmount()
  expect(after.rows.filter(r => r.isSlim).length).toBe(1)
  expect(slimOpen(after.buttons).length).toBe(1)
  expect(after.buttons.some(b => b.label === '▴ Collapse')).toBe(true)
})
