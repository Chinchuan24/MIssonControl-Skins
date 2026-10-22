import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro of "stuck-after-end": an agent flagged quiet keeps "⚠ quiet" after it ends.
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const toasts: string[] = []
let failStep = false
const base = (on: On) => {
  toasts.length = 0
  failStep = false
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
  on('ui.notify', async () => ({ value: { isSent: true } }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.step', async function* (_$, e) {
    if (failStep) throw new Error('529 overloaded')
    const ev = e as { turnId: string; index: number }
    return { turnId: ev.turnId, index: ev.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return clock
}
const start = ($: Engine, surface = 'terminal') => $.session.start({ source: 'startup', cwd: '/repo', surface, isInteractive: true } as never)
const spawn = ($: Engine, d: string) =>
  $.agent.spawn({ tool_use_id: `t-${d}`, prompt: 'p', description: d, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
const step = async ($: Engine, agentId: string) => {
  const s = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 1, model: 'claude-opus-5-5', messageCount: 3, agentId })
  for await (const _ of s) void _
}
const end = ($: Engine, reason: string, agentId?: string) =>
  $.turn.complete({ reason, isAborted: reason === 'aborted', answer: '', durationMs: 1, turnId: 'turn', ...(agentId ? { agentId } : {}) } as never)
const rowText = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const btn = await ui.find({ key: 'open-a1' })
  if (!btn) { const t0 = (await ui.findAll({ type: 'Text' })).map(x => String((x as { text?: string }).text ?? '')).join('\n'); await ui.unmount(); return 'NO-OPEN-BUTTON\n' + t0 }
  await ui.press(btn as never)
  const t = (await ui.findAll({ type: 'Text' })).map(x => String((x as { text?: string }).text ?? '')).join('\n')
  await ui.unmount()
  return t
}
const deskSvgs = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Svg' })).map(t => { const p = (t as { props?: { alt?: string; src?: string; svg?: string } }).props ?? {}; return `${p.alt ?? ''}|${JSON.stringify(p).length}|${JSON.stringify(p).includes('#E5675E')}` })
  await ui.unmount()
  return all.join('\n')
}

// A: steps unseen (foreground agent spawned inside the Agent tool call, which this plugin's tool.call hook wraps):
// final answer composed for >2 min after its last tool call, then it reports back.
test('A: answer after a quiet final stretch, no step heard', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await spawn($, 'Researcher: dig deep')
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts', agentId: 'a1' } as never)
  await clock.advance(125_000)
  await clock.settle()
  await end($, 'answer', 'a1')
  await clock.advance(5_000)
  const t1 = await rowText($)
  await clock.advance(55_000)
  const t2 = await rowText($)
  expect(t2).not.toContain('quiet')
})

// B: a step IS heard right before the answer (the case where the plugin hears agent steps).
test('B: answer preceded by a heard final step', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await spawn($, 'Researcher: dig deep')
  await clock.advance(125_000)
  await clock.settle()
  await step($, 'a1')
  await end($, 'answer', 'a1')
  await clock.advance(60_000)
  const t = await rowText($)
  expect(t).not.toContain('quiet')
})

// C: flagged during a long model request, which then fails with an API error.
test('C: flagged, then the request fails (error end)', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await spawn($, 'Researcher: dig deep')
  await clock.advance(125_000)
  await clock.settle()
  failStep = true
  await step($, 'a1').catch(() => undefined)
  await end($, 'error', 'a1')
  await clock.advance(60_000)
  const t = await rowText($)
  expect(t).not.toContain('quiet')
})

// D: Esc while the flagged agent is still quiet.
test('D: flagged, then Esc (aborted end)', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await spawn($, 'Researcher: dig deep')
  await clock.advance(125_000)
  await clock.settle()
  await end($, 'aborted', 'a1')
  await end($, 'aborted')
  await clock.advance(60_000)
  const t = await rowText($)
  expect(t).not.toContain('quiet')
})

test('E: desktop red edge/ring on finished agent (answer, no step heard)', async ($, on) => {
  const clock = base(on)
  await start($, 'desktop')
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await spawn($, 'Researcher: dig deep')
  await spawn($, 'Engineer: other')
  await clock.advance(125_000)
  await clock.settle()
  await end($, 'answer', 'a1')
  await clock.advance(10_000)
  const s = await deskSvgs($)
  expect(s.split('\n').filter(l => l.startsWith('Researcher: dig deep') && l.endsWith('true'))).toEqual([])
})

test('CONTROL E: desktop, same agent finishing before the 2 min flag', async ($, on) => {
  const clock = base(on)
  await start($, 'desktop')
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await spawn($, 'Researcher: dig deep')
  await spawn($, 'Engineer: other')
  await clock.advance(100_000)
  await clock.settle()
  await end($, 'answer', 'a1')
  await clock.advance(35_000)
  await clock.settle()
  const s = await deskSvgs($)
  expect(s.split('\n').filter(l => l.startsWith('Researcher: dig deep') && l.endsWith('true'))).toEqual([])
})
