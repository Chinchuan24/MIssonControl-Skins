import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'crab-progress'
const props = (isWorking: boolean) => ({ hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 100 }) as never

async function session($: Engine, on: On) {
  mock.clock(on, { now: Date.parse('2026-10-19T02:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
}

async function texts($: Engine, surface: 'terminal' | 'desktop', isWorking: boolean) {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: props(isWorking) })
  const idle = await ui.findAll({ type: 'Text', text: /^Idle$/ })
  const working = await ui.findAll({ type: 'Text', text: /^Working…$/ })
  const svg = await ui.findAll({ type: 'Svg' })
  const dismiss = await ui.find({ key: 'crab-dismiss' })
  await ui.unmount()
  return { idle: idle.length, working: working.length, svg: svg.length, hasDismiss: Boolean(dismiss) }
}

test('with no flow reported the terminal band still draws an idle row', async ($, on) => {
  await session($, on)
  expect(await texts($, 'terminal', false)).toEqual({ idle: 1, working: 0, svg: 0, hasDismiss: false })
})

test('while a turn runs the idle row says Working', async ($, on) => {
  await session($, on)
  expect(await texts($, 'terminal', true)).toEqual({ idle: 0, working: 1, svg: 0, hasDismiss: false })
})

test('desktop draws the idle row as one Svg', async ($, on) => {
  await session($, on)
  expect((await texts($, 'desktop', true)).svg).toBe(1)
})

test('dismissing a reported flow goes back to idle instead of hiding the band', async ($, on) => {
  await session($, on)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Ship it', total: 2, done: 1, phase: 'review' } as never)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: props(false) })
  const dismiss = await ui.find({ key: 'crab-dismiss' })
  expect(Boolean(dismiss)).toBe(true)
  await ui.press(dismiss as never)
  expect((await ui.findAll({ type: 'Text', text: /^Idle$/ })).length).toBe(1)
  await ui.unmount()
})
