import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const
// What the engine refuses past, and the line the hierarchy keeps under.
const SVG_MAX = 120_000

const base = (on: On, store: Record<string, unknown> = {}, cost = 0) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never) // the Cyberpunk Skins add-on is installed
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: cost } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)

// A request with a crew of `roles`, `perRole` agents each and a few started by
// agents; every other one has finished.
const bigCrew = async ($: Engine, roles: string[], perRole: number) => {
  await $.prompt.submit({ text: 'do the big job', cursor: 0 } as never)
  const spawns: [string, string, string?][] = []
  for (const r of roles) for (let k = 0; k < perRole; k++) spawns.push([k % 2 ? 'Explore' : 'general-purpose', `${r}: piece ${k} of the work`])
  for (let k = 1; k <= 6; k++) spawns.push([k % 2 ? 'Explore' : 'general-purpose', `Helper: sub ${k}`, `a${k * 3}`])
  for (const [i, [t, d, p]] of spawns.entries())
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: d, subagentType: t, provider: 'engine', parentModel: 'x', parentAgentId: p, background: false, fork: false } as never)
  for (let i = 1; i <= spawns.length; i += 2) await $.turn.complete({ agentId: `a${i}`, reason: 'answer' } as never)
}

const hierarchy = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return String(svgs.find(el => String(el.props.alt).startsWith('Hierarchy:'))?.props.source)
}

const ROLES = ['Designer', 'Engineer', 'Tester', 'Writer', 'Researcher', 'Planner', 'Runner']

for (const skin of ['cyberpunk-2077', 'lucy-edgerunners']) {
  test(`${skin}: a seven-role crew keeps its figures, under the size limit`, async ($, on) => {
    base(on)
    await start($)
    await $.command.run({ command: 'skin', args: skin } as never)
    await bigCrew($, ROLES, 4)
    const src = await hierarchy($)
    expect(src.length).toBeLessThan(SVG_MAX)
    // The full drawing: each figure defined once and placed, the shared done badge.
    expect(src).toContain('id="bok"')
    expect((src.match(/<use href="#fg\d+"\/>/g) ?? []).length).toBeGreaterThan(30)
    expect(src).toContain('class="ch run"')
    for (const role of ['Designers', 'Engineers', 'Testers']) expect(src).toContain(role.slice(0, 3))
    expect(src).not.toMatch(/class="[^"]*"[^>]*class=/)
  })
}

test('a crowd of 24 roles, six agents each, still draws every figure under the limit', async ($, on) => {
  base(on)
  await start($)
  await $.command.run({ command: 'skin', args: 'cyberpunk-2077' } as never)
  await bigCrew($, Array.from({ length: 24 }, (_, i) => `Crew${String.fromCharCode(65 + i)}`), 6)
  const src = await hierarchy($)
  expect(src.length).toBeLessThan(SVG_MAX)
  expect(src).toContain('id="bok"')
  // A banner for each role and the token manager.
  expect((src.match(/<rect [^>]*height="20" rx="10"/g) ?? []).length).toBe(25)
})

test('a stored currency that is not a string falls back to Auto instead of breaking the session', async ($, on) => {
  base(on, { currency: { code: 42, rate: 'lots' } })
  await start($)
  const r = (await $.command.run({ command: 'missioncontrol', args: 'currency' } as never)) as { text?: string }
  expect(String(r.text)).toContain('Currency: Auto')
})

test('a session picked up mid-conversation counts its turns and starts the turn cost at zero', async ($, on) => {
  base(on, {}, 3.4)
  on('session.messages', async () =>
    ({
      value: [
        { role: 'user', text: 'first ask', toolUses: [] },
        { role: 'assistant', text: 'ok', toolUses: [] },
        { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't', text: 'r', isError: false }] },
        { role: 'user', text: 'second ask', toolUses: [] },
      ],
    }) as never,
  )
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 200 } as never })
  const band = String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)
  await ui.unmount()
  expect(band).toMatch(/>TURN<\/text>\s*<text[^>]*>2<\/text>/)
  expect(band).toMatch(/>\$ TURN<\/text>\s*<text[^>]*>\$0\.00<\/text>/)
})
