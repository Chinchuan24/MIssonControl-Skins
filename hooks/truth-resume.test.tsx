import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro: resume of a finished subagent (SendMessage) via agent.spawn { resume }.
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const

const base = (on: On) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.start', async () => ({}) as never)
  // The engine: a new spawn gets a fresh id, a resume continues under the resumed id.
  let n = 0
  on('agent.spawn', (_$, e) => {
    const r = (e as { resume?: { agentId: string } }).resume
    return { model: 'claude-opus-5-5', agentId: r ? r.agentId : `a${++n}` } as never
  })
  // Each subagent model request burns 25k tokens.
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 20_000, output_tokens: 5_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return clock
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'composer' } } as never)
const spawn = ($: Engine, extra: Record<string, unknown> = {}) =>
  $.agent.spawn({ tool_use_id: 'tu1', prompt: 'research pricing', description: 'Researcher: pricing', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false, ...extra } as never)
const step = async ($: Engine, agentId: string) => {
  const s = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of s) void _
}
const agentDone = ($: Engine, agentId: string) =>
  $.turn.complete({ agentId, reason: 'answer', answer: 'ok', text: 'ok', isAborted: false, durationMs: 1000, turnId: 'x' } as never)
const paneText = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const facts = (t: string) => ({
  crew: /≈\$[\d.]+ · \S+ tokens/.exec(t)?.[0],
  todayAgents: /Today [^\n]*?(\d+) agents/.exec(t)?.[1],
  round: /round \d+/.exec(t)?.[0] ?? null,
  rowTokens: /(\S+) tokens used/.exec(t)?.[1] ?? /Researcher: pricing · (\S+) tokens/.exec(t)?.[1],
})

test('resume: SendMessage to a finished agent keeps its row, tokens, timer and Today count', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'research pricing then follow up')
  await spawn($)
  await step($, 'a1')
  await step($, 'a1') // 50k tokens
  await clock.advance(90_000)
  await agentDone($, 'a1')
  const bt = await paneText($)
  const before = facts(bt)
  await clock.advance(20_000)
  // Claude calls SendMessage({ to: 'a1' }): the engine resumes it through agent.spawn with resume.
  await spawn($, { tool_use_id: 'tu2', prompt: 'also check annual plans', resume: { agentId: 'a1' } })
  const at = await paneText($)
  const after = facts(at)
  expect(before).toEqual({ crew: '≈$0.36 · 50k tokens', todayAgents: '1', round: null, rowTokens: '50k' })
  expect(after).toEqual(before)
})
