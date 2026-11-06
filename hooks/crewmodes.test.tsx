import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Crew modes end to end: Smart staffing, crew mode for every job, One-shot, and
// per-agent Ultra, which reads inside the effort ("high + Ultra"), never as a group.

type Spawned = { model?: string; prompt: string }
const base = (on: On, store: Record<string, unknown> = {}) => {
  const seen = { spawns: [] as Spawned[], efforts: [] as unknown[], toasts: [] as string[] }
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    seen.toasts.push(String((e as { text?: string }).text ?? (e as { message?: string }).message ?? ''))
    return { value: undefined } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('prompt.compose', async () => ({ sections: [] }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', async (_$, e) => {
    const ev = e as Spawned
    seen.spawns.push({ model: ev.model, prompt: ev.prompt })
    return { model: 'claude-opus-5-5', agentId: `a${++n}` } as never
  })
  on('turn.step', async function* (_$, e) {
    seen.efforts.push((e as { effort?: unknown }).effort)
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return seen
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const run = async ($: Engine, command: string, args: string) => String(((await $.command.run({ command, args } as never)) as { text?: string }).text ?? '')
const spawn = ($: Engine, description: string, subagentType = 'general-purpose') =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType, provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
const step = async ($: Engine, agentId: string, effort = 'high') => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId, effort })
  for await (const _ of stream) void _
}
const sections = async ($: Engine) =>
  ((await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: ['Agent', 'Read'], outputStyle: null, traits: [] } as never)) as { sections: { id: string; text: string }[] }).sections
const section = async ($: Engine, id: string) => (await sections($)).find(sc => sc.id === id)?.text ?? ''
const pane = ($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 60) =>
  $.ui.mount({ plugin: 'crab-progress', surface, component: 'Pane', requestId: 'crab-agents', props: { title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 45 }, view: {} } } as never)
const svgs = async (ui: Awaited<ReturnType<typeof pane>>) => (await ui.findAll({ type: 'Svg' })).map(el => ({ alt: String(el.props.alt ?? ''), src: String(el.props.source ?? '') }))
// One agent's card on the desktop pane at `columns`, mounted and let go.
const cardAt = async ($: Engine, columns: number, alt: string) => {
  const ui = await pane($, 'desktop', columns)
  const src = (await svgs(ui)).find(r => r.alt.startsWith(alt))?.src ?? ''
  await ui.unmount()
  return src
}

test('smart staffing: a reader goes to Haiku at low effort, the card says so, /tokens names it', async ($, on) => {
  const seen = base(on)
  await start($)
  expect(await run($, 'tokens', 'staffing on')).toContain('Smart staffing on')
  await spawn($, 'Researcher: read the docs')
  expect(seen.spawns.at(-1)?.model).toBe('haiku')
  await step($, 'a1', 'high')
  expect(seen.efforts.at(-1)).toBe('low')
  const ui = await pane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /effort low/ })).toBeDefined()
  expect(await run($, 'tokens', '')).toContain('Smart staffing on')
  expect(await run($, 'tokens', 'staffing off')).toBe('Smart staffing off.')
  await spawn($, 'Researcher: read more docs')
  expect(seen.spawns.at(-1)?.model).toBeUndefined()
})

test('crew mode for every job: the rule is composed; set back to big jobs mid-job it leaves the prompt and the band', async ($, on) => {
  // The full band (not the simple one) draws crew mode's chip.
  base(on, { simpleBand: false })
  await start($)
  expect(await run($, 'autocrew', 'always')).toContain('every job')
  await $.prompt.submit({ text: 'fix the typo in the readme', cursor: 0 } as never)
  expect(await section($, 'crab-progress:crew')).toContain('every job')
  const band = async () => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 140 } } as never)
    const src = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source ?? '')).join('')
    await ui.unmount()
    return src
  }
  expect(await band()).toContain('CREW MODE')
  await run($, 'autocrew', 'on')
  expect(await section($, 'crab-progress:crew')).toBe('')
  // The band's chip goes with it, now, not at the next prompt.
  expect(await band()).not.toContain('CREW MODE')
  // Picked again mid-job: it holds from the next request.
  await run($, 'autocrew', 'always')
  expect(await section($, 'crab-progress:crew')).toContain('every job')
  expect(await run($, 'autocrew', '150')).toContain('Usage')
  expect(await run($, 'autocrew', 'off')).toContain('Crew mode off')
  expect(await section($, 'crab-progress:crew')).toBe('')
})

test('one-shot: /missioncontrol oneshot on|off|ask sets what the main session is told', async ($, on) => {
  base(on)
  await start($)
  expect(await section($, 'crab-progress:oneshot')).toContain('Part by part, or one-shot?')
  expect(await run($, 'missioncontrol', 'oneshot on')).toContain('One-shot on')
  expect(await section($, 'crab-progress:oneshot')).toContain('One-shot mode is on')
  expect(await run($, 'missioncontrol', 'oneshot off')).toContain('Part by part')
  expect(await section($, 'crab-progress:oneshot')).toContain('Part-by-part mode is on')
  expect(await run($, 'missioncontrol', 'oneshot sideways')).toContain('One-shot is Part by part')
  expect(await run($, 'missioncontrol', 'oneshot ask')).toContain('asks')
})

test('ultra: a rule sends max effort and the brief; the ⚡ button turns it off; the role group stays', async ($, on) => {
  const seen = base(on)
  await start($)
  expect(await run($, 'tokens', 'ultra add Tester')).toContain('Ultra on for "tester"')
  await spawn($, 'Tester: check widths')
  expect(seen.spawns.at(-1)?.prompt).toContain('[Ultra: deep check]')
  await step($, 'a1', 'high')
  expect(seen.efforts.at(-1)).toBe('max')
  const term = await pane($, 'terminal')
  expect(await term.find({ type: 'Text', text: /effort max \+ Ultra/ })).toBeDefined()
  const desk = await pane($, 'desktop')
  const rows = await svgs(desk)
  // Filed under its role, as any agent: no group of its own.
  expect(rows.some(r => /^Testers: 1 agents/.test(r.alt))).toBe(true)
  expect(rows.some(r => /^⚡|Ultra:/.test(r.alt))).toBe(false)
  await desk.press({ key: 'ultra-a1' })
  await step($, 'a1', 'high')
  expect(seen.efforts.at(-1)).toBe('high')
  expect(await run($, 'tokens', 'ultra list')).toContain('Ultra rules: tester')
})

test('ultra on a card reads inside the effort: "high + Ultra" with its bars, plain "high" when off', async ($, on) => {
  base(on)
  await start($)
  await spawn($, 'Engineer: wire the parser')
  await step($, 'a1', 'high')
  for (const columns of [40, 60, 120]) {
    const plain = await cardAt($, columns, 'Engineer: wire the parser')
    expect(plain).toMatch(/>high<\/text>/)
    expect(plain).not.toContain('Ultra')
  }
  const ui = await pane($, 'desktop')
  await ui.press({ key: 'ultra-a1' })
  await ui.unmount()
  // Before its next request the agent still works at high: that, plus Ultra.
  for (const columns of [40, 60, 120]) {
    const card = await cardAt($, columns, 'Engineer: wire the parser')
    expect(card).toMatch(/>high \+ Ultra<\/text>/)
    expect(card).not.toContain('⚡')
  }
  // Wide enough, the bars stay beside it: three of five lit for high.
  expect(await cardAt($, 120, 'Engineer: wire the parser')).toContain('fill="#B58BE5" fill-opacity="1"')
  await step($, 'a1', 'high')
  const term = await pane($, 'terminal')
  expect(await term.find({ type: 'Text', text: /effort max \+ Ultra/ })).toBeDefined()
})

// ---- Ultra decided by: the person (default) or the Manager, per task -------------------

const PROGRESS = 'mcp__crab-progress__progress'
const plan = ($: Engine, tasks: { title: string; ultra?: boolean }[], title = 'Ship it') =>
  $.tool.call({ tool: PROGRESS, title, phase: 'delegate', total: tasks.length, tasks: tasks.map(t => ({ tier: 'medium', ...t })) } as never)
test('ultra by Manager: the progress tool takes ultra per task, and the Manager is told in its prompt (main session only)', async ($, on) => {
  base(on)
  await start($)
  // Me (default): nothing is said about Ultra to the Manager.
  expect(await section($, 'crab-progress:ultraby')).toBe('')
  expect(await run($, 'tokens', 'ultra manager')).toContain('Manager')
  expect(await section($, 'crab-progress:ultraby')).toContain('set `ultra: true` only on tasks that truly need it')
  // A worker's request (no Agent tool) is not told.
  const worker = ((await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: ['Read'], outputStyle: null, traits: [] } as never)) as { sections: { id: string }[] }).sections
  expect(worker.some(sc => sc.id === 'crab-progress:ultraby')).toBe(false)
  const out = await plan($, [{ title: 'Auditor: check the login', ultra: true }, { title: 'Writer: fix the readme' }])
  expect(out).toMatchObject({ result: expect.stringContaining('ok') })
  expect(await run($, 'tokens', 'ultra me')).toContain('you')
  expect(await section($, 'crab-progress:ultraby')).toBe('')
})

test('ultra by Manager: a flagged task gets Ultra (brief, max effort, "max + Ultra", Manager\'s call); an unflagged one stays normal; one toast per job', async ($, on) => {
  const seen = base(on)
  await start($)
  await run($, 'tokens', 'ultra manager')
  await plan($, [{ title: 'Auditor: check the login', ultra: true }, { title: 'Writer: fix the readme' }, { title: 'Migrator: move the table', ultra: true }])
  await spawn($, 'Auditor: check the login')
  expect(seen.spawns.at(-1)?.prompt).toContain('[Ultra: deep check]')
  await step($, 'a1', 'high')
  expect(seen.efforts.at(-1)).toBe('max')
  await spawn($, 'Writer: fix the readme')
  expect(seen.spawns.at(-1)?.prompt).not.toContain('[Ultra: deep check]')
  await step($, 'a2', 'high')
  expect(seen.efforts.at(-1)).toBe('high')
  // The description matches loosely, as the panel matches runs to tasks (case, punctuation).
  await spawn($, 'migrator   move the TABLE!')
  expect(seen.spawns.at(-1)?.prompt).toContain('[Ultra: deep check]')
  expect(seen.toasts.filter(t => t.includes('Manager put'))).toEqual(['⚡ Manager put 2 of 3 tasks on Ultra'])
  const term = await pane($, 'terminal')
  expect(await term.find({ type: 'Text', text: /effort max \+ Ultra \(Manager's call\)/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /effort high(?! \+)/ })).toBeDefined()
  const desk = await pane($, 'desktop')
  expect(await desk.find({ type: 'Text', text: /Manager's call/ })).toBeDefined()
  expect((await desk.findAll({ type: 'Text', text: /Manager's call/ })).length).toBe(2)
  await desk.unmount()
  expect(await cardAt($, 60, 'Auditor: check the login')).toMatch(/>max \+ Ultra<\/text>/)
})

test('ultra by "Me": the Manager\'s flags are ignored', async ($, on) => {
  const seen = base(on)
  await start($)
  await plan($, [{ title: 'Auditor: check the login', ultra: true }])
  await spawn($, 'Auditor: check the login')
  expect(seen.spawns.at(-1)?.prompt).not.toContain('[Ultra: deep check]')
  await step($, 'a1', 'high')
  expect(seen.efforts.at(-1)).toBe('high')
  expect(seen.toasts.some(t => t.includes('Manager put'))).toBe(false)
  const term = await pane($, 'terminal')
  expect(await term.find({ type: 'Text', text: /Ultra/ })).toBeUndefined()
})

test('ultra by Manager: the person\'s ⚡ button beats the Manager, both ways; role rules still work', async ($, on) => {
  const seen = base(on)
  await start($)
  await run($, 'tokens', 'ultra manager')
  await run($, 'tokens', 'ultra add Tester')
  await plan($, [{ title: 'Auditor: check the login', ultra: true }, { title: 'Writer: fix the readme' }])
  await spawn($, 'Auditor: check the login')
  await spawn($, 'Writer: fix the readme')
  // A role rule works in Manager mode, though the plan does not flag it.
  await spawn($, 'Tester: check widths')
  expect(seen.spawns.at(-1)?.prompt).toContain('[Ultra: deep check]')
  const ui = await pane($, 'desktop')
  // Off for the flagged one; on for the unflagged one.
  await ui.press({ key: 'ultra-a1' })
  await ui.press({ key: 'ultra-a2' })
  await ui.unmount()
  await step($, 'a1', 'high')
  expect(seen.efforts.at(-1)).toBe('high')
  await step($, 'a2', 'high')
  expect(seen.efforts.at(-1)).toBe('max')
  await step($, 'a3', 'high')
  expect(seen.efforts.at(-1)).toBe('max')
  // The ⚡ the person pressed is the person's: no "Manager's call" on it.
  const term = await pane($, 'terminal')
  expect(await term.find({ type: 'Text', text: /Manager's call/ })).toBeUndefined()
})

test('ultra decided by: the setting round-trips through the command, the store and the Settings pick', async ($, on) => {
  base(on, { ultraBy: 'manager' })
  await start($)
  const settings = () => $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-settings', props: { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as never)
  // A saved "manager" is read back; the pick shows it, and its value is among its options.
  let ui = await settings()
  const pick = await ui.find({ key: 'set-ultraby-pick' })
  if (pick) {
    expect(pick.props.value).toBe('manager')
    expect((pick.props.options as { value: string; label: string }[]).map(o => o.value)).toContain(pick.props.value)
    for (const o of pick.props.options as { value: unknown; label: unknown }[]) expect([typeof o.value, typeof o.label]).toEqual(['string', 'string'])
    await ui.select({ key: 'set-ultraby-pick', value: 'me' })
  } else await ui.press({ key: 'set-ultraby' })
  await ui.unmount()
  expect(await section($, 'crab-progress:ultraby')).toBe('')
  expect(await run($, 'tokens', '')).toContain('decided by you')
  // The command sets it back, and the pane follows.
  expect(await run($, 'tokens', 'ultra manager')).toContain('Manager')
  ui = await settings()
  const again = await ui.find({ key: 'set-ultraby-pick' })
  if (again) expect(again.props.value).toBe('manager')
  await ui.unmount()
  // Junk is not a mode.
  expect(await run($, 'tokens', 'ultra sideways')).toContain('Usage')
  expect(await section($, 'crab-progress:ultraby')).toContain('ultra: true')
})
