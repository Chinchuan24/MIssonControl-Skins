import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const SURFACES = ['terminal', 'desktop'] as const
// The desktop app refuses a whole drawing past this and shows a blank pane.
const MAX_CHARS = 262_144
const pane = (columns = 80) => ({ title: '', isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} }) as const
const band = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as const

const toasts: string[] = []
const base = (on: On) => {
  toasts.length = 0
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: { isSent: false, reason: 'no-surface' } }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  // No settings hook beneath: the stop goes on.
  on('classic.Stop', async () => ({}) as never)
  on('classic.SubagentStop', async () => ({}) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return clock
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)

const SHELL = { id: 'bsh001', type: 'shell', status: 'running', description: 'Dev server', command: 'npm run dev -- --port 5173' }
const FLOW = { id: 'wf0001', type: 'workflow', status: 'running', description: 'Release check', name: 'release-check' }
const AGENT = { id: 'ag0001', type: 'subagent', status: 'running', description: 'Researcher: map the API', agent_type: 'Explore' }
const WATCH = { id: 'mon001', type: 'monitor', status: 'pending', description: 'Watch the deploy', server: 'vercel', tool: 'watch' }
const WAKE = { id: 'cron01', schedule: '*/5 * * * *', recurring: true, prompt: 'check the deploy again' }

const stop = ($: Engine, tasks: unknown[], crons: unknown[] = []) =>
  $.classic.Stop({ stop_hook_active: false, background_tasks: tasks, session_crons: crons } as never)
const subagentStop = ($: Engine, agentId: string, tasks: unknown[], crons: unknown[] = []) =>
  $.classic.SubagentStop({ stop_hook_active: false, agent_id: agentId, agent_type: 'Explore', agent_transcript_path: '/t', background_tasks: tasks, session_crons: crons } as never)

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
// Counted the way the app counts: texts, an Svg's source and alt, string props.
const chars = (x: unknown): number => {
  if (Array.isArray(x)) return x.reduce((s: number, c) => s + chars(c), 0)
  if (typeof x === 'string') return x.length
  if (!x || typeof x !== 'object') return 0
  const n = x as Node
  const p = n.props ?? {}
  const own = n.type === 'Svg' ? String(p.source ?? '').length + String(p.alt ?? '').length : Object.entries(p).reduce((s, [k, v]) => s + k.length + (typeof v === 'string' ? v.length : 0), 0)
  return own + (n.children ?? []).reduce((s: number, c) => s + chars(c), 0)
}

// What a surface draws of the pane: every text and Svg alt (and Svg source), one string.
const paneOf = async ($: Engine, surface: 'terminal' | 'desktop', columns = 80) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'crab-agents', props: pane(columns) } as never)
  const svgs = await ui.findAll({ type: 'Svg' })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  const drawn = await ui.drawn()
  await ui.unmount()
  const alts = svgs.map(s => String(s.props.alt ?? ''))
  return { alts, sources: svgs.map(s => String(s.props.source ?? '')), heights: svgs.map(s => Number(s.props.height) || 0), text: [...texts, ...alts].join('\n'), chars: chars(drawn) }
}
const bandOf = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band as never })
  const svgs = await ui.findAll({ type: 'Svg' })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return { alts: svgs.map(s => String(s.props.alt ?? '')), sources: svgs.map(s => String(s.props.source ?? '')).join(''), texts }
}

for (const surface of SURFACES)
  test(`${surface}: the Background section lists each kind, with its command, name and status`, async ($, on) => {
    base(on)
    await start($)
    await stop($, [SHELL, FLOW, AGENT, WATCH], [WAKE])
    const p = await paneOf($, surface)
    // The desktop draws the rows inside the card's picture; the terminal as text.
    const drawn = surface === 'desktop' ? p.sources.join('') : p.text
    expect(drawn).toContain('npm run dev -- --port 5173')
    expect(drawn).toContain('release-check')
    expect(drawn).toContain('updated just now')
    if (surface === 'desktop') {
      const alt = p.alts.find(a => a.startsWith('Background:'))
      expect(alt).toContain('Background: 5.')
      for (const word of ['Shell Dev server (running)', 'Workflow Release check (running)', 'Agent Researcher', 'Monitor Watch the deploy (pending)', 'Scheduled check the deploy again (repeats)']) expect(alt).toContain(word)
      const card = p.sources.find(src => src.includes('release-check')) ?? ''
      expect(card).toContain('vercel · watch')
      expect(card).toContain('*/5 * * * *')
    } else {
      expect(p.text).toContain('Background · 5')
      for (const word of ['Shell ', 'Workflow ', 'Agent ', 'Monitor ', 'Scheduled ', 'vercel · watch']) expect(p.text).toContain(word)
    }
    // Never a blank picture.
    expect(p.alts.every(a => a.trim().length > 0)).toBe(true)
  })

for (const surface of SURFACES)
  test(`${surface}: the section is hidden while nothing is in the background, and goes once the list empties`, async ($, on) => {
    base(on)
    await start($)
    expect((await paneOf($, surface)).text).not.toMatch(/Background(:| ·)/)
    await stop($, [SHELL])
    expect((await paneOf($, surface)).text).toMatch(/Background(:| ·) 1/)
    await stop($, [])
    expect((await paneOf($, surface)).text).not.toMatch(/Background(:| ·)/)
  })

test('SubagentStop refreshes the list too, leaving out the subagent that is stopping', async ($, on) => {
  base(on)
  await start($)
  await subagentStop($, 'ag0001', [AGENT, SHELL])
  const alt = (await paneOf($, 'desktop')).alts.find(a => a.startsWith('Background:')) ?? ''
  expect(alt).toContain('Background: 1.')
  expect(alt).toContain('Dev server')
  expect(alt).not.toContain('Researcher')
})

test('a hook that hands the engine junk never throws and keeps the stop going', async ($, on) => {
  base(on)
  await start($)
  await stop($, [null, 7, { type: 'shell' }, { id: 'ok0001', type: 'shell', status: 'running', description: 42, command: ['x'] }], 'nope' as never)
  const alt = (await paneOf($, 'desktop')).alts.find(a => a.startsWith('Background:')) ?? ''
  expect(alt).toContain('Background: 1.')
})

test("a task's notification drops it from the list before the next stop", async ($, on) => {
  base(on)
  await start($)
  await stop($, [SHELL, FLOW])
  await $.prompt.submit({ text: '<task-notification><task-id>bsh001</task-id><status>completed</status></task-notification>', cursor: 0, origin: { kind: 'task-notification' } } as never)
  const alt = (await paneOf($, 'desktop')).alts.find(a => a.startsWith('Background:')) ?? ''
  expect(alt).toContain('Background: 1.')
  expect(alt).not.toContain('Dev server')
})

for (const surface of SURFACES)
  test(`${surface}: the band shows a small background count, and none when the list is empty`, async ($, on) => {
    base(on)
    await start($)
    const none = await bandOf($, surface)
    expect(none.texts.some(t => t.startsWith('⧗'))).toBe(false)
    // The band's own cache readout has an hourglass too: look for the count's chip.
    expect(none.sources).not.toMatch(/⧗\uFE0E \d/)
    await stop($, [SHELL, FLOW], [WAKE])
    const b = await bandOf($, surface)
    if (surface === 'terminal') expect(b.texts).toContain('⧗ 3')
    else {
      expect(b.sources).toContain('⧗︎ 3')
      expect(b.alts[0]).toContain('3 in the background')
    }
    // The crew button is still drawn beside it.
    expect(b.alts.every(a => a.trim().length > 0)).toBe(true)
  })

test('desktop: hundreds of long background tasks stay under the size limit, six rows and a "+N more"', async ($, on) => {
  base(on)
  await start($)
  for (let i = 0; i < 10; i++)
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  const many = Array.from({ length: 300 }, (_, i) => ({ id: `bsh${1000 + i}`, type: i % 2 ? 'shell' : 'workflow', status: 'running', description: `Task ${i} `.repeat(120), command: 'x'.repeat(1000), name: 'w'.repeat(1000) }))
  await stop($, many, Array.from({ length: 100 }, (_, i) => ({ id: `cron${i}`, schedule: '0 9 * * 1-5', recurring: false, prompt: 'p'.repeat(1000) })))
  for (const columns of [40, 120]) {
    const p = await paneOf($, 'desktop', columns)
    expect(p.chars).toBeLessThan(MAX_CHARS)
    expect(Math.max(...p.heights)).toBeLessThanOrEqual(4096)
    // The full view still, not the fallback: the hierarchy is drawn.
    expect(p.alts.some(a => a.startsWith('Hierarchy:'))).toBe(true)
    const alt = p.alts.find(a => a.startsWith('Background:')) ?? ''
    // The engine's list is kept to 50 tasks and 50 wake-ups.
    expect(alt).toContain('Background: 100.')
    expect(alt).toContain('+94 more')
    expect(alt.length).toBeLessThanOrEqual(600)
    expect(p.alts.every(a => a.trim().length > 0)).toBe(true)
  }
  const t = await paneOf($, 'terminal')
  expect(t.text).toContain('+94 more')
})

// --- background work keeps the job open ---------------------------------------

test('a job with a background shell or workflow still listed is never done, across a new prompt; it ends once the list empties', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'build the site', cursor: 0 } as never)
  await stop($, [SHELL])
  await $.turn.complete({ reason: 'answer', answer: 'started', text: 'started' } as never)
  await clock.advance(10_000)
  await clock.settle()
  expect(toasts.some(t => t.startsWith('🎉 Done'))).toBe(false)
  let text = (await paneOf($, 'terminal')).text
  expect(text).toContain('Waiting on 1 background task')
  expect(text).not.toContain('waiting for your next request')
  // A new prompt while it runs, and a workflow joins it: still not done.
  await $.prompt.submit({ text: 'and the docs', cursor: 0 } as never)
  await stop($, [SHELL, FLOW])
  await $.turn.complete({ reason: 'answer', answer: 'ok', text: 'ok' } as never)
  await clock.advance(10_000)
  await clock.settle()
  expect(toasts.some(t => t.startsWith('🎉 Done'))).toBe(false)
  text = (await paneOf($, 'terminal')).text
  expect(text).toContain('Waiting on 2 background tasks')
  const b = await bandOf($, 'terminal')
  expect(b.texts).toContain('Waiting on 2 background tasks')
  const d = await bandOf($, 'desktop')
  expect(d.sources).toContain('Waiting on 2 background tasks')
  expect(d.sources).not.toContain('Done!')
  const card = (await paneOf($, 'desktop')).alts.find(a => a.startsWith('Manager:')) ?? ''
  expect(card).toContain('Waiting on 2 background tasks')
  // The work reports back: a turn ends with nothing in flight, and the job is done.
  await clock.advance(15_000)
  await $.prompt.submit({ text: 'Background task finished', cursor: 0, origin: { kind: 'task-notification' } } as never)
  await stop($, [])
  await $.turn.complete({ reason: 'answer', answer: 'all done', text: 'all done' } as never)
  expect(toasts.filter(t => t.startsWith('🎉 Done')).length).toBe(1)
  await clock.advance(10_000)
  await clock.settle()
  expect((await paneOf($, 'terminal')).text).toContain('waiting for your next request')
})

test('the stop of a background subagent that lists nothing left finishes the job there and then', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'research it', cursor: 0 } as never)
  await stop($, [FLOW])
  await $.turn.complete({ reason: 'answer', answer: 'started', text: 'started' } as never)
  await clock.advance(30_000)
  await clock.settle()
  expect(toasts.some(t => t.startsWith('🎉 Done'))).toBe(false)
  await subagentStop($, 'zz', [])
  expect(toasts.some(t => t.startsWith('🎉 Done: research it'))).toBe(true)
  await clock.settle()
})

test('a scheduled wake-up alone does not hold the job open', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'set a reminder', cursor: 0 } as never)
  await clock.advance(30_000)
  await stop($, [], [WAKE])
  await $.turn.complete({ reason: 'answer', answer: 'set', text: 'set' } as never)
  expect(toasts.some(t => t.startsWith('🎉 Done: set a reminder'))).toBe(true)
})

test('a background task listed for two hours keeps the job open, checks in once per quiet hour, and /missioncontrol release lets it go', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'run the long build', cursor: 0 } as never)
  await stop($, [SHELL])
  await $.turn.complete({ reason: 'answer', answer: 'started', text: 'started' } as never)
  const checkIns = () => toasts.filter(t => t.includes('Background shell "Dev server" has been quiet')).length
  // Under an hour: no check-in yet.
  await clock.advance(50 * 60_000)
  await clock.settle()
  expect(checkIns()).toBe(0)
  // A stop that lists it again, unchanged, is no sign of progress.
  await stop($, [SHELL])
  await clock.advance(15 * 60_000)
  await clock.settle()
  expect(checkIns()).toBe(1)
  expect(toasts.find(t => t.includes('quiet for'))).toContain('/missioncontrol release lets it go')
  await clock.advance(60 * 60_000)
  await clock.settle()
  expect(checkIns()).toBe(2)
  // Two hours on: still held open, never released on its own.
  expect(toasts.some(t => t.startsWith('🎉 Done'))).toBe(false)
  expect((await paneOf($, 'terminal')).text).toContain('Waiting on 1 background task')
  const reply = (await $.command.run({ command: 'missioncontrol', args: 'release' } as never)) as { text?: string }
  expect(String(reply.text)).toContain('Released 1 background task: Dev server')
  expect(toasts.filter(t => t.startsWith('🎉 Done: run the long build')).length).toBe(1)
  // Still listed, marked released, until a stop drops it.
  const p = await paneOf($, 'desktop')
  expect(p.alts.find(a => a.startsWith('Background:'))).toContain('(released)')
  // No further check-ins once released.
  await clock.advance(60 * 60_000)
  await clock.settle()
  expect(checkIns()).toBe(2)
})

test('a new status is progress: the quiet hour starts again', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'deploy', cursor: 0 } as never)
  await stop($, [{ ...WATCH, status: 'pending' }])
  await $.turn.complete({ reason: 'answer', answer: 'ok', text: 'ok' } as never)
  await clock.advance(50 * 60_000)
  await clock.settle()
  await stop($, [{ ...WATCH, status: 'running' }])
  await clock.advance(50 * 60_000)
  await clock.settle()
  expect(toasts.filter(t => t.includes('been quiet')).length).toBe(0)
})
