import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// A big plan: 23 tasks, some done, some running (one over its budget), the rest
// still to start. The pane lists every one of them, long, until the person folds it.

const PLUGIN = 'crab-progress'
const MIN = 60_000
const toasts: string[] = []
const kept = new Map<string, unknown>()

const base = (on: On) => {
  toasts.length = 0
  kept.clear()
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('store.get', async (_$, e) => ({ value: kept.get(String((e as { key?: string }).key)) }) as never)
  on('store.set', async (_$, e) => {
    const { key, value } = e as { key: string; value: unknown }
    kept.set(key, value)
    return { value: undefined } as never
  })
  on('store.delete', async (_$, e) => {
    kept.delete(String((e as { key?: string }).key))
    return { value: undefined } as never
  })
  on('store.keys', async () => ({ value: [...kept.keys()] }) as never)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}

const TITLES = Array.from({ length: 23 }, (_, i) => `Engineer: mecha part ${i + 1} with a long description`)
const pane = { title: '', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} }

// 8 finished, 6 running (task 9 over its 1 min budget), 9 not started.
const setup = async ($: Engine, clock: ReturnType<typeof base>) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'Build the mecha', cursor: 0 } as never)
  await $.tool.call({
    tool: 'mcp__crab-progress__progress',
    title: 'Mecha build',
    total: 23,
    done: 8,
    minutes: 120,
    phase: 'delegate',
    tasks: TITLES.map((title, i) => ({ title, tier: i % 2 ? 'medium' : 'heavy', minutes: i === 8 ? 1 : 30 })),
  } as never)
  for (let i = 0; i < 14; i++)
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: TITLES[i], subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  for (let i = 0; i < 8; i++) await $.turn.complete({ agentId: `a${i + 1}`, reason: 'answer', answer: 'ok' } as never)
  await clock.advance(3 * MIN)
}

const chars = (x: unknown): number => {
  if (typeof x === 'string') return x.length
  if (Array.isArray(x)) return x.reduce((n: number, c) => n + chars(c), 0)
  if (!x || typeof x !== 'object') return 0
  const n = x as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  const p = n.props ?? {}
  const own = n.type === 'Svg' ? String(p.source ?? '').length + String(p.alt ?? '').length : Object.entries(p).reduce((s, [k, v]) => s + k.length + (typeof v === 'string' ? v.length : 0), 0)
  return own + chars(n.children ?? [])
}

const mount = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'crab-agents', props: pane as never })
const look = async ($: Engine) => {
  const ui = await mount($)
  const svgs = (await ui.findAll({ type: 'Svg' })).map(el => el.props as { source?: string; alt?: string })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  const labels = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.label))
  const size = chars(await ui.drawn())
  await ui.unmount()
  const alts = svgs.map(s => String(s.alt ?? ''))
  const workflow = svgs.filter(s => String(s.alt).startsWith('Workflow')).map(s => String(s.source)).join('')
  return { svgs, alts, texts, labels, size, workflow }
}
const press = async ($: Engine, key: string, surface: 'desktop' | 'terminal' = 'desktop') => {
  const ui = await mount($, surface)
  await ui.press({ key })
  await ui.drawn()
  await ui.unmount()
}
const agentRows = (alts: string[]) => TITLES.filter(t => alts.some(a => a.startsWith(`${t}:`)))

test('long view: every task and every agent of a 23-task plan is listed, under the size limit', async ($, on) => {
  const clock = base(on)
  await setup($, clock)
  const v = await look($)
  expect(v.size).toBeLessThan(262_144)
  expect(v.texts.join('\n')).not.toContain('short view')
  // The workflow lists all 23 steps, no "+N more".
  for (let i = 1; i <= 23; i++) expect(v.workflow).toContain(`${i}. Engineer: mecha part ${i} `)
  expect(v.workflow).not.toContain('more steps')
  // Each of the 14 agents that started has its own row: no "+N more working".
  expect(agentRows(v.alts).length).toBe(14)
  expect(v.alts.some(a => a.startsWith('+'))).toBe(false)
  // The over-budget one is still flagged, in its row and by a toast.
  expect(v.alts.find(a => a.startsWith(`${TITLES[8]}:`))).toEndWith('over budget')
  expect(toasts.some(t => t.includes('is over its 1 min budget'))).toBe(true)
  expect(v.labels.some(l => l.includes('Finished'))).toBe(true)
  expect(v.labels).toContain('Collapse')
})

test('collapse finished: done agents and done steps fold into one line each, running ones stay', async ($, on) => {
  const clock = base(on)
  await setup($, clock)
  await press($, 'done')
  const v = await look($)
  const rows = agentRows(v.alts)
  expect(rows).toEqual(TITLES.slice(8, 14))
  expect(v.alts.some(a => a.startsWith('+8 more agents finished'))).toBe(true)
  expect(v.workflow).toContain('8 finished steps')
  expect(v.workflow).not.toContain('1. Engineer: mecha part 1 ')
  for (let i = 9; i <= 23; i++) expect(v.workflow).toContain(`${i}. Engineer: mecha part ${i} `)
  expect(v.alts.find(a => a.startsWith(`${TITLES[8]}:`))).toEndWith('over budget')
  // Remembered: a fresh mount, and the store, keep it folded.
  expect(kept.get('paneView')).toEqual({ isCompact: false, isDoneCollapsed: true })
  await press($, 'done')
  expect(agentRows((await look($)).alts).length).toBe(14)
})

test('collapse all: the whole list folds into the compact view and back', async ($, on) => {
  const clock = base(on)
  await setup($, clock)
  await press($, 'compact')
  const v = await look($)
  expect(agentRows(v.alts).length).toBe(0)
  expect(v.labels).toContain('Expand')
  expect(kept.get('paneView')).toEqual({ isCompact: true, isDoneCollapsed: false })
  await press($, 'compact')
  expect(agentRows((await look($)).alts).length).toBe(14)
})

test('the toggles come back after a reload, from the store', async ($, on) => {
  const clock = base(on)
  kept.set('paneView', { isCompact: false, isDoneCollapsed: true })
  await setup($, clock)
  const v = await look($)
  expect(agentRows(v.alts)).toEqual(TITLES.slice(8, 14))
})

test('terminal: all 23 steps listed; collapse finished folds the done steps', async ($, on) => {
  const clock = base(on)
  await setup($, clock)
  const text = async () => {
    const ui = await mount($, 'terminal')
    const t = (await ui.findAll({ type: 'Text' })).map(x => String((x as { text?: string }).text ?? '')).join('\n')
    await ui.unmount()
    return t
  }
  const all = await text()
  for (let i = 1; i <= 23; i++) expect(all).toContain(`${i}. Engineer: mecha part ${i} `)
  expect(all).toContain('over budget')
  await press($, 'done', 'terminal')
  const folded = await text()
  expect(folded).toContain('8 finished steps')
  expect(folded).not.toContain('1. Engineer: mecha part 1 ')
  expect(folded).toContain('23. Engineer: mecha part 23 ')
})

test('a huge crew (60 running) still lists every agent on the desktop, under the size limit', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'Big job', cursor: 0 } as never)
  const many = Array.from({ length: 60 }, (_, i) => `Engineer: piece ${i + 1} of a very long and wordy job description here`)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Big', total: 60, tasks: many.map(title => ({ title, tier: 'medium', minutes: 5 })) } as never)
  for (let i = 0; i < 60; i++)
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: many[i], subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  const v = await look($)
  expect(v.size).toBeLessThan(262_144)
  expect(many.filter(t => v.alts.some(a => a.startsWith(`${t}:`))).length).toBe(60)
})

