import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'crab-progress'
const SECTION = 'crab-progress:memory'

async function session($: Engine, on: On) {
  mock.clock(on, { now: Date.parse('2026-10-19T02:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never) // the Cyberpunk Skins add-on is installed
  on('settings.read', async () => ({ value: {} }) as never)
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
}

const compose = ($: Engine) =>
  $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as never)

const memorySection = async ($: Engine) =>
  ((await compose($)) as { sections: { id: string; text: string; scope: string }[] }).sections.find(s => s.id === SECTION)

test('first run seeds the short-answers rule and sends it in the system prompt', async ($, on) => {
  await session($, on)
  const s = await memorySection($)
  expect(s?.scope).toBe('session')
  expect(s?.text).toContain('short')
})

test('/prefs add, remove and clear change what the prompt carries', async ($, on) => {
  await session($, on)
  await $.command.run({ command: 'prefs', args: 'add Use bullet points' } as never)
  expect((await memorySection($))?.text).toContain('Use bullet points')

  await $.command.run({ command: 'prefs', args: 'remove 2' } as never)
  expect((await memorySection($))?.text).not.toContain('Use bullet points')

  await $.command.run({ command: 'prefs', args: 'clear' } as never)
  expect(await memorySection($)).toBeUndefined()
})

test('the Memory pane lists the rules', async ($, on) => {
  await session($, on)
  await $.command.run({ command: 'prefs', args: '' } as never)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-memory', props: {} as never })
  expect((await ui.findAll({ type: 'Text', text: /^1\. Keep every answer short/ })).length).toBe(1)
  await ui.unmount()
})
