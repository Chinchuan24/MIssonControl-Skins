import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

// Every pane reads as open but behind another tab; `calls` records closes and opens in order.
const base = (on: On, calls: string[] = [], store: Record<string, unknown> = {}) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('ui.panes', async () =>
    ({
      value: ['crab-agents', 'crab-skins', 'crab-memory', 'crab-settings'].map(id => ({ id, title: id, isShown: false, isFocused: false, isPlaced: true })),
    }) as never,
  )
  on('ui.close', async (_$, e) => {
    calls.push(`close ${(e as { id: string }).id}`)
    return { value: undefined } as never
  })
  on('ui.open', async (_$, e) => {
    calls.push(`open ${(e as { id: string }).id}`)
    return { value: { isPlaced: true } } as never
  })
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  return calls
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const run = async ($: Engine, command: string, args = '') => String(((await $.command.run({ command, args } as never)) as { text?: string }).text)

test('a pane open behind another tab is brought forward: closed, then opened', async ($, on) => {
  const calls = base(on)
  await start($)
  const ids: Record<string, string> = {}
  for (const [command, args] of [['skins', ''], ['prefs', ''], ['missioncontrol', ''], ['missioncontrol', 'open']] as const) {
    calls.length = 0
    await run($, command, args)
    ids[`${command} ${args}`.trim()] = calls.join(', ')
  }
  expect(ids.skins).toBe('close crab-skins, open crab-skins')
  expect(ids.prefs).toMatch(/^close crab-memory, open crab-memory/)
  expect(ids.missioncontrol).toBe('close crab-agents, open crab-agents')
  expect(ids['missioncontrol open']).toBe('close crab-agents, open crab-agents')
})

test('"Change skin ▸" brings the skin picker forward from behind another tab', async ($, on) => {
  const calls = base(on)
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-settings', props: pane } as never)
  calls.length = 0
  await ui.press({ key: 'set-skin' })
  await ui.drawn()
  await ui.unmount()
  expect(calls.join(', ')).toContain('close crab-skins, open crab-skins')
})

test('"⚙ Settings and billing ▸" opens the settings pane from the main pane; the one-shot chip is read-only', async ($, on) => {
  const calls = base(on)
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  for (const key of ['open-settings']) {
    calls.length = 0
    await ui.press({ key })
    await ui.drawn()
    expect(calls.join(', ')).toContain('close crab-settings, open crab-settings')
  }
  expect(await ui.find({ key: 'oneshot-open' })).toBeUndefined()
  // Nothing of the settings or billing stays on the busy pane.
  for (const key of ['set-crew-pick', 'set-daily-pick', 'set-budget-pick', 'bill-guide', 'spend-period']) expect(await ui.find({ key })).toBeUndefined()
  await ui.unmount()
})

test('"🎨 Change skin ▸" sits under the settings button and opens the skin picker, in the full, short and terminal views', async ($, on) => {
  const calls = base(on)
  await start($)
  const press = async (ui: Awaited<ReturnType<Engine['ui']['mount']>>) => {
    const buttons = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.key))
    expect(buttons.indexOf('open-skins')).toBe(buttons.indexOf('open-settings') + 1)
    expect(String((await ui.find({ key: 'open-skins' }))?.props.label)).toBe('🎨 Change skin ▸')
    calls.length = 0
    await ui.press({ key: 'open-skins' })
    await ui.drawn()
    expect(calls.join(', ')).toContain('close crab-skins, open crab-skins')
  }
  const desk = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  await press(desk)
  await desk.press({ key: 'compact' })
  await desk.drawn()
  await press(desk)
  await desk.unmount()
  const term = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  await press(term)
  await term.unmount()
})

test('settings: five sections in order, every control kept, each with a hint, and dropdowns always on one of their options', async ($, on) => {
  base(on)
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-settings', props: pane } as never)
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String(t.text ?? ''))
  const heads = ['💰 Money', '🛡︎ Machine Guard', '🦀︎ Crew', '🎨 Look and feel', '💳 Billing']
  expect(heads.map(h => texts.indexOf(h))).toEqual([...heads.map(h => texts.indexOf(h))].sort((a, b) => a - b))
  for (const h of heads) expect(texts).toContain(h)
  const keys = [
    'set-autopilot', 'set-warm', 'set-daily-pick', 'set-daily-type', 'set-budget-pick', 'set-budget-type', 'spend-period',
    'set-ram-pick', 'set-ram-type', 'set-agents-pick', 'set-agents-type', 'set-agent-ram-reset',
    'set-crew-pick', 'set-oneshot-pick', 'set-staffing', 'set-timekeeper',
    'set-skin', 'set-currency-pick', 'set-simple', 'set-calm', 'set-sounds', 'set-voice', 'set-open',
    'bill-guide',
  ]
  const missing: string[] = []
  for (const key of keys) if (!(await ui.find({ key }))) missing.push(key)
  expect(missing).toEqual([])
  // One short hint line under each option, saying what it does.
  for (const hint of ['Read-only explorer agents run on Haiku', 'How much memory Claude and all its agents may use together', 'Learned by watching agents run', 'Splits work across helper agents', 'Now: ', 'Opens Mission Control each time Claude starts.'])
    expect(texts.some(t => t.startsWith(hint))).toBe(true)
  expect(texts.some(t => t.startsWith('🖥︎ '))).toBe(true)
  expect(texts.some(t => t.includes('GB per agent'))).toBe(true)
  for (const pick of await ui.findAll({ type: 'Select' })) {
    const options = (pick.props.options as { value: string }[]).map(o => o.value)
    expect(options).toContain(String(pick.props.value))
  }
  await ui.unmount()
})

test('settings: the terminal draws the same five cards, with buttons where it has no dropdowns', async ($, on) => {
  base(on)
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-settings', props: pane } as never)
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String(t.text ?? ''))
  await ui.unmount()
  expect(texts.join('\n')).not.toContain('could not draw')
  for (const h of ['💰 Money', '🛡︎ Machine Guard', '🦀︎ Crew', '🎨 Look and feel', '💳 Billing']) expect(texts).toContain(h)
})

test('settings: "Reset learned RAM per agent" forgets the learned figure, back to the 0.5 GB default', async ($, on) => {
  base(on, [], { agentRam: 2 * 1024 ** 3 })
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-settings', props: pane } as never)
  const line = async () => (await ui.findAll({ type: 'Text' })).map(t => String(t.text ?? '')).find(t => t.includes('GB per agent')) ?? ''
  expect(await line()).toContain('2 GB per agent (learned)')
  await ui.press({ key: 'set-agent-ram-reset' })
  await ui.drawn()
  expect(await line()).toContain('≈0.5 GB per agent (default)')
  await ui.unmount()
})

test("only the person's own prompts count as tasks, not a notification or a plugin's", async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'Background task finished: build ok', cursor: 0, origin: { kind: 'task-notification' } } as never)
  await $.prompt.submit({ text: 'a message from a peer', cursor: 0, origin: { kind: 'peer' } } as never)
  await $.prompt.submit({ text: 'fix the login bug', cursor: 0, origin: { kind: 'composer' } } as never)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  const alts = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt))
  await ui.unmount()
  expect(alts.find(a => a.startsWith('Today:'))).toContain('Today: 1 tasks')
  expect(alts.find(a => a.startsWith('Manager:'))).toContain('Manager: fix the login bug')
})

test('the usage card says there is no data yet instead of "Usage: . "', async ($, on) => {
  base(on)
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  const alts = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt))
  await ui.unmount()
  expect(alts).toContain('Usage: no data yet')
})

test('a bad option gets a usage line, and changes nothing', async ($, on) => {
  base(on)
  await start($)
  for (const bad of ['5', '150', '99', 'maybe']) expect(await run($, 'autocrew', bad)).toStartWith('Usage: /autocrew')
  // The context line stayed where it was.
  expect(await run($, 'autocrew', '')).toContain('context past 60%')
  expect(await run($, 'autocrew', '40%')).toContain('context past 40%')
  expect(await run($, 'missioncontrol', 'shiny')).toContain('Unknown option "shiny"')
  expect(await run($, 'missioncontrol', '')).not.toContain('Unknown option')
  expect(await run($, 'tokens', 'report')).toStartWith('Usage: /tokens')
  expect(await run($, 'tokens', 'autopilot maybe')).toStartWith('Usage: /tokens')
  expect(await run($, 'tokens', '')).toStartWith('Token Manager:')
})
