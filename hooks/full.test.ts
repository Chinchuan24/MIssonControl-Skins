import { expect, mock, test } from 'claude-code/testing'

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

// The pane as the demo left it: a finished plan, eight agents in four roles with
// sub-agents, usage limits and per-model tokens. It must draw, on both surfaces.
test('a full crew, plan and usage still draw Mission Control', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never) // the Cyberpunk Skins add-on is installed
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.usage', async () =>
    ({
      value: {
        startedAt: 0,
        context: { window: 1_000_000, tokens: 500_000 },
        rateLimits: [
          { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-19T14:12:00Z' },
          { kind: 'seven_day', percentUsed: 33, resetsAt: '2026-10-24T19:00:00Z' },
          { kind: 'seven_day_fable', percentUsed: 6, resetsAt: '2026-10-24T19:00:00Z' },
        ],
        cost: { usd: 1.2 },
      },
    }) as never,
  )
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: `a${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: ['Brief', 'Design', 'Review', 'Write', 'Research', 'Wrap'].map(c => ({ content: c, status: 'completed' })),
  } as never)
  const spawns: [string, string, string?][] = [
    ['general-purpose', 'Designer: band look ideas'],
    ['general-purpose', 'Sub-designer: icon ideas', 'a1'],
    ['general-purpose', 'Sub-designer: color ideas', 'a1'],
    ['general-purpose', 'Engineer: review the band code'],
    ['Explore', 'Tester: count the tests', 'a4'],
    ['general-purpose', 'Writer: band status lines'],
    ['Explore', 'Researcher: measure the mod'],
  ]
  for (const [i, [t, d, p]] of spawns.entries())
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: d, subagentType: t, provider: 'engine', parentModel: 'x', parentAgentId: p, background: false, fork: false } as never)
  for (let i = 1; i <= 7; i++) await $.turn.complete({ agentId: `a${i}`, reason: 'answer' } as never)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface, component: 'Pane', requestId: 'crab-agents', props: pane })
    const svgs = await ui.findAll({ type: 'Svg' })
    const texts = await ui.findAll({ type: 'Text' })
    await ui.unmount()
    expect(svgs.length + texts.length).toBeGreaterThan(3)
  }
})

test('a live crew, mid-plan, still draws Mission Control', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never) // the Cyberpunk Skins add-on is installed
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.usage', async () =>
    ({
      value: {
        startedAt: 0,
        context: { window: 1_000_000, tokens: 500_000 },
        rateLimits: [
          { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-19T14:12:00Z' },
          { kind: 'seven_day', percentUsed: 33, resetsAt: '2026-10-24T19:00:00Z' },
          { kind: 'seven_day_fable', percentUsed: 6, resetsAt: '2026-10-24T19:00:00Z' },
        ],
        cost: { usd: 1.2 },
      },
    }) as never,
  )
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: `a${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: ['Brief', 'Design', 'Review', 'Write', 'Research', 'Wrap'].map((c, i) => ({ content: c, status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'pending' })),
  } as never)
  const spawns: [string, string, string?][] = [
    ['general-purpose', 'Designer: band look ideas'],
    ['general-purpose', 'Sub-designer: icon ideas', 'a1'],
    ['general-purpose', 'Sub-designer: color ideas', 'a1'],
    ['general-purpose', 'Engineer: review the band code'],
    ['Explore', 'Tester: count the tests', 'a4'],
    ['general-purpose', 'Writer: band status lines'],
    ['Explore', 'Researcher: measure the mod'],
  ]
  for (const [i, [t, d, p]] of spawns.entries())
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: d, subagentType: t, provider: 'engine', parentModel: 'x', parentAgentId: p, background: false, fork: false } as never)
  await $.tool.call({ tool: 'mcp__crab-progress__step', agentId: 'a2', done: 1, total: 3, note: 'sketching' } as never)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface, component: 'Pane', requestId: 'crab-agents', props: pane })
    const svgs = await ui.findAll({ type: 'Svg' })
    const texts = await ui.findAll({ type: 'Text' })
    await ui.unmount()
    expect(svgs.length + texts.length).toBeGreaterThan(3)
    if (surface === 'desktop') expect(svgs.map(el => String(el.props.alt)).join(' | ')).toContain('Hierarchy')
  }
})

// The engine refuses any Svg source over 131072 characters and then draws nothing
// of the pane at all; a session's worth of crews must stay under it.
test('thirty agents keep every drawing under the engine size limit', async ($, on) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: `a${++n}` }))
  const roles = ['Designer', 'Engineer', 'Writer', 'Researcher', 'Tester']
  for (let i = 0; i < 30; i++)
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `${roles[i % 5]}: job ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', parentAgentId: i > 5 && i % 3 === 0 ? `a${i - 2}` : undefined, background: false, fork: false } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  expect(svgs.some(el => String(el.props.alt).startsWith('Hierarchy:'))).toBe(true)
  expect(Math.max(...svgs.map(el => String(el.props.source).length))).toBeLessThanOrEqual(131072)
})
