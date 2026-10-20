import { expect, mock, test } from 'claude-code/testing'

// The core edition: no addons/cyberpunk folder, so only default and Crab Classic.
test('core edition: without the add-on the cyberpunk skins are locked and pitched', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, { skin: 'cyberpunk-2077' })
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  const run = async (args: string) => String(((await $.command.run({ command: 'skin', args } as never)) as { text?: string }).text)
  // The cyberpunk skin saved while the add-on was installed fell back to the classic.
  const list = await run('')
  expect(list).toContain('▸ crab-classic')
  expect(list).toContain('crab-classic')
  expect(list).not.toContain('lucy-edgerunners')
  expect(list).toContain('Cyberpunk Skins add-on')
  expect(await run('cyberpunk-2077')).toContain('comes with the Cyberpunk Skins add-on')
  expect(await run('samurai')).toContain('No skin "samurai"')
  expect(await run('crab-classic')).toContain('Skin: Crab Classic')
})
