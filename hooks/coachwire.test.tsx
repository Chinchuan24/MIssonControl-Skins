import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// The cost coach in the session: price tags and the receipt, Tab-to-Save, /tokens whatif
// and pr, calm mode and spoken status.
const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never

const toasts: string[] = []
const spoken: string[] = []
const copied: string[] = []
const suggested: string[] = []
const statuses: (string | undefined)[] = []
// Each agent's usage per step, by its id: a1 the priciest.
const USAGE: Record<string, number> = { a1: 80_000, a2: 20_000 }

const base = (on: On, kept: Record<string, unknown> = {}) => {
  for (const l of [toasts, spoken, copied, suggested, statuses]) l.length = 0
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, kept)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: { isSent: true } }) as never)
  on('ui.status', async (_$, e) => {
    statuses.push((e as { text?: string }).text)
    return { value: undefined } as never
  })
  on('ui.copy', async (_$, e) => {
    copied.push(String((e as { text?: string }).text ?? ''))
    return { value: { isCopied: true } } as never
  })
  on('prompt.suggest', async (_$, e) => {
    suggested.push(String((e as { text?: string }).text ?? ''))
    return { isShown: true } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('audio.speak', async (_$, e) => {
    spoken.push(String((e as { text?: string }).text ?? ''))
    return { value: { via: 'system' } } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.repo', async () => ({ value: { name: 'me/app', remote: null, root: '/repo' } }) as never)
  on('process.run', async () => ({ value: { exitCode: 0, stdout: 'feat/x\n', stderr: '' } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.start', async (_$, e) => ({ turnId: String((e as { turnId?: string }).turnId ?? 't') }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.step', async function* (_$, e) {
    const id = (e as { agentId?: string }).agentId
    const n = id ? (USAGE[id] ?? 1000) : 20_000
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: n, output_tokens: n / 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return clock
}

const start = ($: Engine, surface = 'terminal') => $.session.start({ source: 'startup', cwd: '/repo', surface, isInteractive: true } as never)
const tokens = async ($: Engine, args = ''): Promise<string> => String(((await $.command.run({ command: 'tokens', args } as never)) as { text?: string }).text)
const step = async ($: Engine, agentId?: string) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) void _
}
const finish = ($: Engine, agentId?: string) =>
  $.turn.complete({ ...(agentId ? { agentId } : {}), reason: 'answer', answer: 'ok', isAborted: false, durationMs: 1, turnId: 'x' } as never)
// A job with two agents, a1 costing about four times a2; finished when `isDone`.
const crewJob = async ($: Engine, clock: { advance: (ms: number) => Promise<unknown>; settle: () => Promise<unknown> }, isDone = true) => {
  await $.prompt.submit({ text: 'audit the repo', cursor: 0, origin: { kind: 'composer' } } as never)
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ text: 'audit the repo', turnId: 'main' })
  await step($)
  for (const d of ['Researcher: map the API', 'Engineer: wire the parser'])
    await $.agent.spawn({ tool_use_id: `t-${d}`, prompt: 'p', description: d, subagentType: d.startsWith('Researcher') ? 'Explore' : 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  await step($, 'a1')
  await step($, 'a2')
  await clock.advance(30_000)
  if (!isDone) return
  await finish($, 'a1')
  await finish($, 'a2')
  await finish($)
  await clock.settle()
}
const money = (s: string): string[] => [...s.matchAll(/≈(\$[\d.,]+)/g)].map(m => m[1] as string)

test('price tags and receipt: each agent shows its cost, the priciest is drawn bigger, the receipt has the same numbers', async ($, on) => {
  const clock = base(on)
  await start($, 'desktop')
  await crewJob($, clock, false)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const svgs = ((await ui.findAll({ type: 'Svg' })) as { props: { source?: string } }[]).map(s => String(s.props.source ?? '')).join('\n')
  const press = (await ui.findAll({ type: 'Button' })).find(b => (b as { props?: { label?: string } }).props?.label === '🧾 Copy receipt')
  expect(Boolean(press)).toBe(true)
  await ui.press(press as never)
  await clock.settle()
  await ui.unmount()
  // The hierarchy's tags: the priciest in bold and the warn colour, the other plain.
  const bold = [...svgs.matchAll(/font-weight="800" font-variant-numeric="tabular-nums" fill="[^"]+">≈(\$[\d.]+)</g)].map(m => m[1])
  const plain = [...svgs.matchAll(/font-weight="600" font-variant-numeric="tabular-nums" class="m">≈(\$[\d.]+)</g)].map(m => m[1])
  expect(bold.length).toBe(1)
  expect(plain.length).toBe(1)
  expect(toasts.some(t => t.startsWith('🧾 Receipt copied'))).toBe(true)
  const receipt = copied[copied.length - 1] ?? ''
  const rows = receipt.split('\n').filter(l => /^\| (Researcher|Engineer)/.test(l))
  expect(rows.length).toBe(2)
  // The receipt lists the priciest first, with the price its tag shows.
  expect(money(rows[0] ?? '')).toEqual([bold[0]])
  expect(money(rows[1] ?? '')).toEqual([plain[0]])
  // /tokens receipt is the same receipt.
  expect((await tokens($, 'receipt')).startsWith(receipt.split('\n')[0] ?? '-')).toBe(true)
})

test('/tokens pr: ready to paste, with the task\'s tokens (main loop and crew) next to its cost', async ($, on) => {
  const clock = base(on)
  await start($)
  await crewJob($, clock)
  const text = await tokens($, 'pr')
  const badge = copied[copied.length - 1] ?? ''
  expect(text.startsWith(badge)).toBe(true)
  expect(badge).toMatch(/^🦀 This PR cost ≈\$[\d.]+ \(2 agents, [\d.]+[kM]? tokens\)/)
  expect(badge).toMatch(/\| me\/app @ feat\/x \|/)
  // The crew alone burned 84k + 21k; the main loop's 21k is in the task too.
  expect(badge).toMatch(/2 agents, 126k tokens/)
})

test('/tokens whatif: the best scenario, and its command waits in the prompt box (one tap)', async ($, on) => {
  // Keep-Warm on and the savers already offered: no warning's command goes before the coach's.
  const clock = base(on, { keepWarm: true, saversOffered: true })
  await start($)
  await crewJob($, clock)
  // Tab-to-Save: after the main turn, the what-if tip's command is the prompt box's suggestion.
  expect(suggested).toEqual([expect.stringMatching(/^\/tokens (staffing|autopilot) on$/)])
  const text = await tokens($, 'whatif')
  expect(text).toMatch(/\| Scenario \| Would cost \| Saves \|/)
  expect(text).toMatch(/Turn it on: \/tokens (staffing|autopilot) on/)
  expect(suggested[suggested.length - 1]).toMatch(/^\/tokens (staffing|autopilot) on$/)
  expect(text).toMatch(/Tab puts it in the prompt box/)
})

test('calm mode: one status line and no band', async ($, on) => {
  const clock = base(on, { calm: true })
  await start($)
  await crewJob($, clock, false)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const buttons = await ui.findAll({ type: 'Button' })
  await ui.unmount()
  expect(buttons.length).toBe(0)
  const line = statuses.filter(Boolean).pop() ?? ''
  expect(line).toMatch(/^🦀 .* · 2 working · ≈\$[\d.]+ · ctx \d+%$/)
})

test('spoken status: silent while the setting is off', async ($, on) => {
  const clock = base(on)
  await start($)
  await crewJob($, clock)
  expect(toasts.some(t => t.startsWith('🎉 Done'))).toBe(true)
  expect(spoken).toEqual([])
})

test('spoken status: on, a finished crew job says its agents and cost', async ($, on) => {
  const clock = base(on, { voice: true })
  await start($)
  await crewJob($, clock)
  expect(spoken.length).toBe(1)
  expect(spoken[0]).toMatch(/^Job done\. 2 agents, about \$[\d.]+\.$/)
})
