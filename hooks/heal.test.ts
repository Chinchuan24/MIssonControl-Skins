import { expect, mock, test } from 'claude-code/testing'

// Self-heal (25 Oct): /missioncontrol and both tools vanished mid-session. The next prompt
// registers every command and tool again; while /missioncontrol is listed, nothing is redone.
test('a prompt puts /missioncontrol and the tools back after they go missing', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-25T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, {})
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  const commands = new Set<string>()
  const tools = new Set<string>()
  let registrations = 0
  on('tool.register', async (_$, e) => {
    registrations++
    tools.add((e as { name: string }).name)
    return { value: undefined } as never
  })
  on('command.register', async (_$, e) => {
    registrations++
    commands.add((e as { name: string }).name)
    return { value: undefined } as never
  })
  on('command.list', async () => ({ value: [...commands].map(name => ({ name, description: '', source: 'plugin' })) }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  expect(commands.has('missioncontrol')).toBe(true)
  expect(tools.has('progress')).toBe(true)

  // Listed: a prompt registers nothing again.
  const afterStart = registrations
  await $.prompt.submit({ text: 'keep going', cursor: 0 } as never)
  expect(registrations).toBe(afterStart)

  // Gone (the engine dropped them): the next prompt puts all of them back.
  commands.clear()
  tools.clear()
  await $.prompt.submit({ text: 'where is mission control', cursor: 0 } as never)
  for (const name of ['missioncontrol', 'prefs', 'skins', 'skin', 'autocrew', 'tokens', 'timekeeper']) {
    expect(commands.has(name)).toBe(true)
  }
  expect(tools.has('progress')).toBe(true)
  expect(tools.has('step')).toBe(true)
})
