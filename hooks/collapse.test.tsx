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
  test(`${skin}: after Collapse then Expand the pane draws as before and holds its layout as the work goes on`, async ($, on) => {
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
