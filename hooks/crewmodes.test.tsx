import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Crew modes end to end: Smart staffing, crew mode for every job, One-shot, and
// per-agent Ultra, which reads inside the effort ("high + Ultra"), never as a group.

type Spawned = { model?: string; prompt: string }
const base = (on: On, store: Record<string, unknown> = {}) => {
  const seen = { spawns: [] as Spawned[], efforts: [] as unknown[] }
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
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
