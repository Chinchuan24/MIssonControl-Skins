import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

// Agents spawn in order; each answers with the next id from `ids`.
const crew = async ($: Engine, on: On, spawns: { type: string; description: string; parent?: string }[]) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }))
  for (const [i, s] of spawns.entries()) {
    await $.agent.spawn({
      tool_use_id: `t${i}`,
      prompt: 'p',
      description: s.description,
      subagentType: s.type,
      provider: 'engine',
      parentModel: 'claude-opus-5-5',
      parentAgentId: s.parent,
      background: false,
      fork: false,
    } as never)
  }
}

const lines = async ($: Engine): Promise<string[]> => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return texts.map(t => String((t as { text?: string }).text ?? ''))
}

test('sub-agents sit under their role, under the manager', async ($, on) => {
  await crew($, on, [
    { type: 'Explore', description: 'Map the repo' },
    { type: 'savvy-heavy', description: 'Find the bug' },
    { type: 'Explore', description: 'Read the tests' },
  ])
  const all = (await lines($)).join('\n')
  expect(all).toContain('Manager')
  expect(all).toMatch(/Explorers[\s\S]*Map the repo|Explorers[\s\S]*Read the tests/)
  expect(all).toContain('Heavy')
})

test('an agent started by a sub-agent nests under that sub-agent', async ($, on) => {
  await crew($, on, [
    { type: 'savvy-heavy', description: 'Lead the fix' },
    { type: 'Explore', description: 'Helper search', parent: 'a1' },
  ])
  const all = (await lines($)).join('\n')
  // The helper is not a role of its own: only the Heavy role heads the tree.
  expect(all).toContain('Heavy')
  expect(all).not.toContain('Explorers')
  expect(all).toContain('Helper search')
})

test('the manager card shows the session and weekly limits', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-19T02:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.usage', async () =>
    ({
      value: {
        startedAt: 0,
        context: { window: 1_000_000, tokens: 100_000 },
        rateLimits: [
          { kind: 'seven_day', percentUsed: 33, resetsAt: '2026-10-21T02:00:00Z' },
          { kind: 'five_hour', percentUsed: 6, resetsAt: '2026-10-19T06:01:00Z' },
        ],
      },
    }) as never,
  )
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  const all = (await lines($)).join('\n')
  expect(all).toMatch(/Session limit .* 6% Resets in 4 hr 1 min/)
  expect(all).toMatch(/Weekly · all models .* 33%/)
  expect(all.indexOf('Session limit')).toBeLessThan(all.indexOf('Manager'))
})

test('each agent row names its model, effort and tokens used', async ($, on) => {
  await crew($, on, [{ type: 'savvy-careful', description: 'Refactor the parser' }])
  const all = (await lines($)).join('\n')
  expect(all).toMatch(/Opus 5\.5 · effort high · 0 tokens used/)
})

test('usage lists each model used and the tokens it burned', async ($, on) => {
  on('turn.step', async function* () {
    return {
      turnId: 'turn',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-haiku-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as never
  })
  await crew($, on, [{ type: 'Explore', description: 'Scan' }])
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-haiku-5-5', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
  const all = (await lines($)).join('\n')
  expect(all).toMatch(/Usage\n  Haiku 5\.5 2k tokens/)
})

test('a task that opens with a role files under that role, sub-roles nested', async ($, on) => {
  await crew($, on, [
    { type: 'general-purpose', description: 'Designer: palette ideas' },
    { type: 'general-purpose', description: 'Sub-designer: icon sketch', parent: 'a1' },
  ])
  const all = (await lines($)).join('\n')
  expect(all).toContain('Designers')
  expect(all).not.toContain('Sub-designers')
  expect(all).toContain('Sub-designer: icon sketch')
})

test('the manager bar counts the plan: done steps whole, the one in progress half', async ($, on) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', async () => ({ result: 'ok' }) as never)
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'A', status: 'completed' }, { content: 'B', status: 'in_progress' }, { content: 'C', status: 'pending' }, { content: 'D', status: 'pending' }] } as never)
  const all = (await lines($)).join('\n')
  expect(all).toContain('1. A')
  expect(all).toContain('2. B')
})

test('the hierarchy draws the manager, its roles and their agents as a pyramid', async ($, on) => {
  await crew($, on, [
    { type: 'general-purpose', description: 'Designer: palette ideas' },
    { type: 'general-purpose', description: 'Sub-designer: icon sketch', parent: 'a1' },
    { type: 'Explore', description: 'Map the repo' },
  ])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  const org = svgs.find(el => String(el.props.alt).startsWith('Hierarchy:'))
  expect(String(org?.props.alt)).toContain('Designers (1)')
  expect(String(org?.props.alt)).toContain('Explorers (1)')
  expect(String(org?.props.source)).toContain('icon sketch')
  expect(String(org?.props.source)).not.toMatch(/class="[^"]*"[^>]*class=/)
})
