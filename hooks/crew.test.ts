import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const base = (on: On, context = 100_000) => {
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never) // the Cyberpunk Skins add-on is installed
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: context }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('prompt.compose', async () => ({ sections: [] }) as never)
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)

const compose = async ($: Engine, tools = ['Agent', 'Read']) => {
  const r = (await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools, outputStyle: null, traits: [] } as never)) as {
    sections: { id: string; text: string }[]
  }
  return r.sections.find(sc => sc.id === 'crab-progress:crew')?.text ?? ''
}

const BIG = ['Please do all of this:', '- redo the parser', '- add tests for it', '- update the docs', '- wire it into the CLI', '- bump the version'].join('\n')

test('crew mode: a request with many asks gets the split instruction', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: BIG, cursor: 0 } as never)
  const text = await compose($)
  expect(text).toContain('Crew mode')
  expect(text).toContain('5 asks in one request')
})

test('crew mode: a small request stays in the session, and a worker is never told', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'fix the typo in the readme', cursor: 0 } as never)
  expect(await compose($)).toBe('')
  await $.prompt.submit({ text: BIG, cursor: 0 } as never)
  expect(await compose($, ['Read', 'Edit'])).toBe('')
})

test('crew mode: a full context calls the crew; /autocrew off stops it', async ($, on) => {
  base(on, 700_000)
  await start($)
  await $.prompt.submit({ text: 'keep going', cursor: 0 } as never)
  expect(await compose($)).toContain('context at 70%')
  const off = await $.command.run({ command: 'autocrew', args: 'off' } as never)
  expect(String((off as { text?: string }).text)).toContain('Crew mode off')
  expect(await compose($)).toBe('')
})
