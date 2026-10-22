import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro: a lead agent blocked in its own foreground Agent call while
// the child it spawned works steadily is flagged "gone quiet ... may be stuck".
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
const toasts: string[] = []
let gate: Promise<void> | null = null

const base = (on: On) => {
  toasts.length = 0
  gate = null
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string; message?: string }).text ?? (e as { message?: string }).message ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  // Only the lead's Agent call blocks (a foreground sub-agent): it returns when the child ends.
  on('tool.call', async (_$, e) => {
    if ((e as { tool?: string }).tool === 'Agent' && gate) await gate
    return { result: 'ok' } as never
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'tool_use', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  return clock
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0, origin: { kind: 'composer' } } as never)
const spawn = ($: Engine, description: string, extra: Record<string, unknown> = {}) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false, ...extra } as never)
const step = async ($: Engine, agentId?: string) => {
  const s = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of s) void _
}
const paneText = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}

test('lead blocked on its busy foreground child is not called stuck', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'audit the repo with a crew')
  await spawn($, 'Lead: coordinate') // a1, spawned from main
  await step($, 'a1') // the lead thinks, then delegates
  let release = () => {}
  gate = new Promise<void>(r => (release = r))
  const call = $.tool.call({ tool: 'Agent', subagent_type: 'general-purpose', description: 'Checker: scan files', prompt: 'p', agentId: 'a1' } as never)
  await spawn($, 'Checker: scan files', { parentAgentId: 'a1' }) // a2, nested under a1
  // The child is busy throughout: a model step and a Read every 30 s, for 3 minutes.
  for (let i = 0; i < 6; i++) {
    await clock.advance(30_000)
    await step($, 'a2')
    await $.tool.call({ tool: 'Read', file_path: `/repo/f${i}.ts`, agentId: 'a2' } as never)
  }
  await clock.settle()
  const quiet = toasts.filter(t => t.includes('gone quiet'))
  const text = await paneText($)
  release()
  await call
  expect({ quiet, paneQuiet: /⚠︎? quiet/.test(text) }).toEqual({ quiet: [], paneQuiet: false })
})

// Control: same timeline but the lead has no child and no events: the alarm is right here.
test('CONTROL a lead silent for 3 minutes with no child is called stuck', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'audit the repo with a crew')
  await spawn($, 'Lead: coordinate')
  await step($, 'a1')
  for (let i = 0; i < 6; i++) await clock.advance(30_000)
  await clock.settle()
  expect(toasts.filter(t => t.includes('gone quiet')).length).toBe(1)
})
