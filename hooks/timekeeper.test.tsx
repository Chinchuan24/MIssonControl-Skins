import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const SECTION = 'crab-progress:timekeeper'
const MIN = 60_000
// Crab Classic, the skin a fresh session wears.
const WARN = '#E9B44C'
const ALERT = '#E5675E'

const toasts: string[] = []
const sounds: unknown[] = []
const saved: Record<string, unknown> = {}

// The store in memory, its writes kept in `saved` so a test sees what persisted.
type Base = { store?: Record<string, unknown>; registered?: Record<string, unknown>[]; isCyber?: boolean }
const base = (on: On, { store = {}, registered, isCyber = false }: Base = {}) => {
  toasts.length = 0
  sounds.length = 0
  for (const k of Object.keys(saved)) delete saved[k]
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  const kept = new Map(Object.entries(store))
  on('store.get', async (_$, e) => ({ value: kept.get(String((e as { key?: string }).key)) }) as never)
  on('store.set', async (_$, e) => {
    const { key, value } = e as { key: string; value: unknown }
    kept.set(key, value)
    saved[key] = value
    return { value: undefined } as never
  })
  on('store.delete', async (_$, e) => {
    kept.delete(String((e as { key?: string }).key))
    return { value: undefined } as never
  })
  on('store.keys', async () => ({ value: [...kept.keys()] }) as never)
  // With the Cyberpunk Skins add-on or without it: the core edition by default.
  on('fs.exists', async (_$, e) => ({ value: isCyber && /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async (_$, e) => {
    registered?.push(e as Record<string, unknown>)
    return { value: undefined } as never
  })
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('audio.play', async (_$, e) => {
    sounds.push(e)
    return { value: undefined } as never
  })
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text = 'Build the parser') => $.prompt.submit({ text, cursor: 0 } as never)
const plan = ($: Engine, input: Record<string, unknown>) => $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Parser', ...input } as never)
const spawn = ($: Engine, description: string, i = 1) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
const run = async ($: Engine, args: string) => String(((await $.command.run({ command: 'timekeeper', args } as never)) as { text?: string }).text ?? '')

const pane = (bodyColumns = 100) => ({ title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} })
const BAND = { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 140 }

const paneTexts = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane() as never })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}

const desktopPane = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane(120) as never })
  const svgs = (await ui.findAll({ type: 'Svg' })).map(el => el.props as { source?: string; alt?: string })
  const drawn = await ui.drawn()
  return { ui, svgs, drawn }
}

// The band's budget clock: its text, and the colour it is drawn in ('' when calm).
const bandClock = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND as never })
  if (surface === 'terminal') {
    const t = (await ui.findAll({ type: 'Text', text: /^⏱ / }))[0] as { text?: string; props?: { color?: string } } | undefined
    await ui.unmount()
    return { text: t ? String(t.text ?? '') : '', tone: t?.props?.color ?? '' }
  }
  const source = String(((await ui.findAll({ type: 'Svg' }))[0]?.props as { source?: string }).source ?? '')
  await ui.unmount()
  const m = /<tspan font-weight="700"(?: fill="([^"]+)")?>⏱︎ ([^<]+)<\/tspan>/.exec(source)
  return { text: m ? `⏱ ${m[2]}` : '', tone: m?.[1] ?? '' }
}

test('budgets: the plan minutes win, the tasks sum up, the defaults fill in', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($)
  await clock.advance(1000)
  expect(await run($, '')).toContain('This job: 0/60m')
  await plan($, { tasks: [{ title: 'Engineer: parser', tier: 'medium', minutes: 10 }, { title: 'Engineer: tests', tier: 'light', minutes: 5 }] })
  expect(await run($, '')).toContain('This job: 0/15m (from its plan)')
  await plan($, { minutes: 45 })
  expect(await run($, '')).toContain('This job: 0/45m (from its plan)')
  // A task the plan names takes its minutes; any other run the default.
  await spawn($, 'Engineer: parser', 1)
  await spawn($, 'Researcher: look around', 2)
  await clock.advance(1000)
  const text = await paneTexts($)
  expect(text).toContain('⏱ 0/10m')
  expect(text).toContain('⏱ 0/20m')
  // A new request starts with the default again, as the owner set it.
  await run($, 'job 30')
  await ask($, 'Something else')
  await clock.advance(1000)
  expect(await run($, '')).toContain('This job: 0/30m')
})

for (const surface of ['terminal', 'desktop'] as const)
  test(`band (${surface}): elapsed of budget, warn past 80%, alert past 100%`, async ($, on) => {
    const clock = base(on)
    await start($)
    await ask($)
    await plan($, { minutes: 5 })
    await clock.advance(3 * MIN)
    expect(await bandClock($, surface)).toEqual({ text: '⏱ 3/5m', tone: '' })
    await clock.advance(MIN + 10_000)
    expect(await bandClock($, surface)).toEqual({ text: '⏱ 4/5m', tone: WARN })
    await clock.advance(MIN)
    expect(await bandClock($, surface)).toEqual({ text: '⏱ 5/5m', tone: ALERT })
  })

test('alerts: 80% and 100% fire once each, and a hot reload does not repeat them', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($)
  await plan($, { minutes: 5 })
  await clock.advance(4 * MIN + 10_000)
  expect(toasts.filter(t => t.includes('80%')).length).toBe(1)
  expect(toasts.filter(t => t.startsWith('⏱ Over budget')).length).toBe(0)
  await clock.advance(MIN)
  expect(toasts.filter(t => t.startsWith('⏱ Over budget')).length).toBe(1)
  // The core skin's alert: the beeps, made in code.
  expect(sounds.length).toBe(1)
  const clip = (sounds[0] as { clip: { mime?: string; base64?: string } }).clip
  expect(clip.mime).toBe('audio/wav')
  expect(clip.base64?.startsWith('UklGR')).toBe(true) // "RIFF"

  await clock.advance(3 * MIN)
  await start($) // what a hot reload does: $.state survives
  await clock.advance(2 * MIN)
  expect(toasts.filter(t => t.includes('80%')).length).toBe(1)
  expect(toasts.filter(t => t.startsWith('⏱ Over budget')).length).toBe(1)
  expect(sounds.length).toBe(1)
})

test('alerts: sounds off keeps the toast and drops the sound', async ($, on) => {
  const clock = base(on, { store: { sounds: false } })
  await start($)
  await ask($)
  await plan($, { minutes: 1 })
  await clock.advance(70_000)
  expect(toasts.filter(t => t.startsWith('⏱ Over budget')).length).toBe(1)
  expect(sounds.length).toBe(0)
})

test('alerts: a cyberpunk skin sounds MaxTac\'s siren', async ($, on) => {
  const clock = base(on, { isCyber: true })
  await start($)
  await $.command.run({ command: 'skin', args: 'cyberpunk-2077' } as never)
  await ask($)
  await plan($, { minutes: 1 })
  await clock.advance(70_000)
  expect(sounds.map(x => (x as { clip: { asset?: string } }).clip.asset)).toContain('addons/cyberpunk/assets/maxtac.wav')
})

test('agents: one past its task budget is flagged and alerted once, on both surfaces', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($)
  await plan($, { minutes: 60, tasks: [{ title: 'Engineer: parser', tier: 'medium', minutes: 2 }] })
  await spawn($, 'Engineer: parser')
  await clock.advance(MIN)
  expect(await paneTexts($)).not.toContain('over budget')
  await clock.advance(MIN + 10_000)
  expect(toasts.filter(t => t === '⏱ "Engineer: parser" is over its 2 min budget').length).toBe(1)
  expect(sounds.length).toBe(1)
  await clock.advance(2 * MIN)
  expect(toasts.filter(t => t.includes('is over its')).length).toBe(1)
  expect(await paneTexts($)).toMatch(/⏱ 4\/2m over budget/)
  const { ui, svgs } = await desktopPane($)
  await ui.unmount()
  expect(svgs.some(s => /^Engineer: parser: .*, over budget$/.test(String(s.alt)))).toBe(true)
  // Flagged as a stuck one is: the card's edge in the alarm red, the budget in the time stat.
  const card = svgs.find(s => String(s.alt).startsWith('Engineer: parser'))
  expect(String(card?.source)).toContain('stroke="#E5675E"')
  expect(String(card?.source)).toContain('⏱︎ over budget')
  expect(String(card?.source)).toMatch(/4:\d\d \/ 2m/)
})

test('manager card: the time stat reads against the budget', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($)
  await plan($, { minutes: 10 })
  await clock.advance(9 * MIN)
  expect(await paneTexts($)).toContain('⏱ 9/10m')
  const { ui, svgs } = await desktopPane($)
  await ui.unmount()
  const card = svgs.find(s => String(s.alt).startsWith('Manager:'))
  expect(String(card?.source)).toContain('Time · budget')
  expect(String(card?.source)).toMatch(new RegExp(`fill="${WARN}"[^>]*>9:\\d\\d / 10m`))
})

test('commands: settings persist; bad input gets the usage line', async ($, on) => {
  base(on)
  await start($)
  expect(await run($, '')).toContain('Timekeeper on: 60 min per job, 20 min per sub-agent')
  expect(await run($, 'job 45')).toContain('Job budget: 45 min')
  expect(await run($, 'agent 15')).toContain('Sub-agent budget: 15 min')
  expect(saved.timekeeper).toEqual({ on: true, jobMin: 45, agentMin: 15 })
  expect(await run($, 'off')).toContain('Timekeeper off')
  expect(saved.timekeeper).toEqual({ on: false, jobMin: 45, agentMin: 15 })
  for (const bad of ['job', 'job abc', 'job 0', 'job 2000', 'job 4.5', 'agent -3', 'job 10 20', 'on now', 'faster'])
    expect(await run($, bad)).toMatch(/^Usage: \/timekeeper/)
  expect(saved.timekeeper).toEqual({ on: false, jobMin: 45, agentMin: 15 })
})

test('commands: a new session reads the saved settings', async ($, on) => {
  base(on, { store: { timekeeper: { on: true, jobMin: 90, agentMin: 25 } } })
  await start($)
  expect(await run($, 'status')).toContain('Timekeeper on: 90 min per job, 25 min per sub-agent')
})

const compose = ($: Engine) =>
  $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as never)
const rule = async ($: Engine) => ((await compose($)) as { sections: { id: string; text: string; scope: string }[] }).sections.find(s => s.id === SECTION)

test('standing rule: sent while on, gone when off, with the progress tool and minutes', async ($, on) => {
  base(on)
  await start($)
  const s = await rule($)
  expect(s?.scope).toBe('session')
  expect(s?.text).toContain('mcp__crab-progress__progress')
  expect(s?.text).toContain('`minutes`')
  expect(s?.text).toContain('Never extend a budget silently')
  expect(s?.text).toContain('tracker')
  await run($, 'off')
  expect(await rule($)).toBeUndefined()
  await run($, 'on')
  expect(await rule($)).toBeDefined()
})

test('settings: the pane toggle turns it off and on, and off hides every budget', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($)
  await plan($, { minutes: 5 })
  await clock.advance(MIN)
  const { ui } = await desktopPane($)
  const label = async () => String(((await ui.find({ key: 'set-timekeeper' })) as { props?: { label?: string } } | undefined)?.props?.label ?? '')
  expect(await label()).toMatch(/^☑︎ Timekeeper: 60 min per job, 20 min per sub-agent$/)
  await ui.press({ key: 'set-timekeeper' })
  expect(await label()).toMatch(/^☐ Timekeeper/)
  await ui.unmount()
  expect(await rule($)).toBeUndefined()
  expect(await paneTexts($)).not.toContain('⏱')
  expect(await bandClock($, 'desktop')).toEqual({ text: '', tone: '' })
  // Off: no alerts either, however long it runs.
  await clock.advance(6 * MIN)
  expect(toasts.filter(t => t.startsWith('⏱')).length).toBe(0)
})

test('the progress tool takes minutes for the plan and each task', async ($, on) => {
  const schemas: Record<string, unknown>[] = []
  base(on, { registered: schemas })
  await start($)
  const tool = schemas.find(t => t.name === 'progress') as { inputSchema: { properties: Record<string, { type?: string; items?: { properties: Record<string, { type?: string }> } }> } }
  expect(tool.inputSchema.properties.minutes?.type).toBe('integer')
  expect(tool.inputSchema.properties.tasks?.items?.properties.minutes?.type).toBe('integer')
})

// What the app counts against its limit: texts, an Svg's source and alt, other string props.
const chars = (x: unknown): number => {
  if (typeof x === 'string') return x.length
  if (Array.isArray(x)) return x.reduce((n: number, c) => n + chars(c), 0)
  if (!x || typeof x !== 'object') return 0
  const n = x as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  const p = n.props ?? {}
  const own = n.type === 'Svg' ? String(p.source ?? '').length + String(p.alt ?? '').length : Object.entries(p).reduce((s, [k, v]) => s + k.length + (typeof v === 'string' ? v.length : 0), 0)
  return own + chars(n.children ?? [])
}

test('size guard and alts: a big crew over budget still draws, every Svg named', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($)
  await plan($, { minutes: 2, tasks: Array.from({ length: 12 }, (_, i) => ({ title: `Engineer: piece ${i} of a fairly long job description`, tier: 'medium', minutes: 1 })) })
  for (let i = 0; i < 12; i++) await spawn($, `Engineer: piece ${i} of a fairly long job description`, i + 1)
  await clock.advance(3 * MIN)
  // Twelve agents over at once: one toast and one sound for them, beside the job's.
  expect(toasts.filter(t => t.startsWith('⏱ 12 sub-agents are over budget: Engineer: piece 0')).length).toBe(1)
  expect(toasts.filter(t => t.includes('is over its')).length).toBe(0)
  expect(sounds.length).toBeLessThanOrEqual(2)
  const { ui, svgs, drawn } = await desktopPane($)
  await ui.unmount()
  expect(chars(drawn)).toBeLessThan(262_144)
  expect(svgs.length).toBeGreaterThan(0)
  expect(svgs.filter(s => !String(s.alt ?? '').trim()).length).toBe(0)
  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND as never })
  const bandSvgs = (await band.findAll({ type: 'Svg' })).map(el => el.props as { alt?: string })
  await band.unmount()
  expect(bandSvgs.filter(s => !String(s.alt ?? '').trim()).length).toBe(0)
})
