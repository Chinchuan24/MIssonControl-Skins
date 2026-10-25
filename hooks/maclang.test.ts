import { expect, mock, test } from 'claude-code/testing'

test('a Dock-launched Mac with no LANG follows AppleLanguages', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0' })
  mock.store(on, {})
  let asked: readonly string[] = []
  on("process.run", async (_x: unknown, e: unknown) => { 
    asked = ((e as { argv?: string[]; args?: { argv?: string[] } }).argv ?? (e as { args?: string[][] }).args?.[0] ?? []) as string[]
    return { value: { exitCode: 0, stdout: '(\n    "ru-SG",\n    "en-SG"\n)\n', stderr: '' } } as never
  })
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  expect(asked[0]).toBe('/usr/bin/defaults')
  const text = String(((await $.command.run({ command: 'missioncontrol', args: '' } as never)) as { text?: string }).text)
})
