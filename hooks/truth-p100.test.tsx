import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const toasts: string[] = []
const base = (on: On) => {
  toasts.length = 0
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => { toasts.push(String((e as { text?: string }).text ?? '')); return { value: undefined } as never })
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('classic.Stop', async () => ({}) as never)
  on('classic.SubagentStop', async () => ({}) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'ag0001' }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}
const AGENT = { id: 'ag0001', type: 'subagent', status: 'running', description: 'Engineer: build it', agent_type: 'general-purpose' }

// Realistic: prompt, plan 1 of 4 done, a background agent, the main turn ends with
// the Stop hook listing that agent as still running in the background.
const scene = async ($: Engine, clock: { advance: (ms: number) => Promise<unknown> }, withPlan: boolean) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'build the feature', cursor: 0, origin: { kind: 'composer' } } as never)
  if (withPlan) await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [
    { content: 'Scout', status: 'completed' }, { content: 'Build', status: 'in_progress' }, { content: 'Test', status: 'pending' }, { content: 'Ship', status: 'pending' }] } as never)
  await $.tool.call({ tool: 'Agent', subagent_type: 'general-purpose', description: 'Engineer: build it', prompt: 'p', run_in_background: true } as never)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Engineer: build it', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: true, fork: false } as never)
  await clock.advance(20_000)
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [AGENT], session_crons: [] } as never)
  await $.turn.complete({ reason: 'answer', answer: 'Started a background agent; it will report back.' } as never)
  await clock.advance(30_000)
}
const bandAlt = async ($: Engine, isWorking: boolean) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 100 } as never })
  const a = String((await ui.findAll({ type: 'Svg' }))[0]?.props.alt ?? '')
  await ui.unmount()
  return a
}
const managerCard = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  const svgs = (await ui.findAll({ type: 'Svg' })).map(s => ({ alt: String(s.props.alt ?? ''), source: String(s.props.source ?? '') }))
  await ui.unmount()
  const m = svgs.find(s => s.alt.startsWith('Manager:'))!
  const wf = svgs.find(s => s.alt.startsWith('Workflow:'))
  const pct = /Overall progress<\/text>[\s\S]*?text-anchor="end"[^>]*>([^<]*)<\/text>/.exec(m.source)?.[1]
  const pill = /<text[^>]*text-anchor="middle"[^>]*font-size="11" font-weight="600"[^>]*>([^<]*)<\/text>/.exec(m.source)?.[1]
  return { alt: m.alt, pct, pill, wf: wf?.alt ?? '', wfHas14: (wf?.source ?? '').includes('1/4 done') }
}
const terminalGlyph = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane } as never)
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return texts[texts.findIndex(t => t === 'Manager ') - 1]
}

test('realistic plan 1/4 + background agent listed by Stop: band, card, terminal', async ($, on) => {
  const clock = base(on)
  await scene($, clock, true)
  const obs = { bandIdleProp: await bandAlt($, false), bandBusyProp: await bandAlt($, true), card: await managerCard($), glyph: await terminalGlyph($), toasts: [...toasts] }
  expect(obs.bandIdleProp).toContain('38%')
})

test('realistic no plan + background agent listed by Stop: band, card, terminal', async ($, on) => {
  const clock = base(on)
  await scene($, clock, false)
  const obs = { bandIdleProp: await bandAlt($, false), bandBusyProp: await bandAlt($, true), card: await managerCard($), glyph: await terminalGlyph($), toasts: [...toasts] }
  expect(obs.bandIdleProp).not.toContain('100%')
})
