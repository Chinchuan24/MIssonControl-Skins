import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const pane = { title: '', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const band = { hasSurvey: false, isWorking: true, maxRows: 14, bodyColumns: 120 } as never

const base = (on: On, context = 100_000) => {
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: context }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}

const svgs = async ($: Engine, component: 'Pane' | 'AbovePrompt') => {
  const ui =
    component === 'Pane'
      ? await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
      : await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: band })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await ui.unmount()
  return all
}

test('easter eggs: a cyberpunk skin brings Breach Protocol, the Afterlife, eddies and the Relic glitch', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: 'cyberpunk-2077' } as never)
  await $.prompt.submit({ text: 'Build it', cursor: 0 } as never)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Engineer: build', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  const paneSvgs = (await svgs($, 'Pane')).join('')
  expect(paneSvgs).toContain('BREACH PROTOCOL')
  expect(paneSvgs).toContain('AFTERLIFE')
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  expect(bandSvg).toContain('class="rg"')
  expect(bandSvg).toContain('HEAT')
  expect(bandSvg).toContain('€$')
  for (const src of [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))]) expect(src.length).toBeLessThan(131072)
})

test('currency: /missioncontrol currency MYR 4 shows costs in ringgit, AUTO goes back to eddies', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: 'cyberpunk-2077' } as never)
  const set = await $.command.run({ command: 'missioncontrol', args: 'currency MYR 4' } as never)
  expect(String((set as { text?: string }).text)).toContain('MYR RM')
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('RM0.00')
  await $.command.run({ command: 'missioncontrol', args: 'currency auto' } as never)
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('€$0.00')
})

test('easter eggs: the Arasaka skin files engrams in Mikoshi; the crab skin has no eggs', async ($, on) => {
  base(on, 960_000)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: 'arasaka' } as never)
  await $.prompt.submit({ text: 'Audit it', cursor: 0 } as never)
  expect((await svgs($, 'Pane')).join('')).toContain('MIKOSHI')
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('MAXTAC INBOUND')
  await $.command.run({ command: 'skin', args: 'crab-classic' } as never)
  const plain = [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))].join('')
  expect(plain).not.toContain('BREACH PROTOCOL')
  expect(plain).not.toContain('€$')
})
