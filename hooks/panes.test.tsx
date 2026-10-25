import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

// Every pane reads as open but behind another tab; `calls` records closes and opens in order.
const base = (on: On, calls: string[] = []) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('ui.panes', async () =>
    ({
      value: ['crab-agents', 'crab-skins', 'crab-memory'].map(id => ({ id, title: id, isShown: false, isFocused: false, isPlaced: true })),
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
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  calls.length = 0
  await ui.press({ key: 'set-skin' })
  await ui.drawn()
  await ui.unmount()
  expect(calls.join(', ')).toContain('close crab-skins, open crab-skins')
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
