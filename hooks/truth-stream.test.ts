import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Truth audit: alarms, toasts, the done cheer and Street Cred.
// Every test here states what a real session does, and what Mission Control should then say.

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

const toasts: string[] = []
const notes: string[] = []
const sounds: string[] = []
type Cred = { xp: number; jobs: number; agents: number }
let credNow: Cred | undefined
const reset = () => {
  credNow = undefined
  toasts.length = 0
  notes.length = 0
  sounds.length = 0
}

// A tool call the test holds open: a 10-minute build, or one waiting at a permission dialog.
let gate: Promise<void> | null = null
let openGate = () => {}
const holdTools = () => {
  gate = new Promise<void>(r => (openGate = r))
}

const base = (on: On, store: Record<string, unknown> = {}) => {
  reset()
  gate = null
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async (_$, e) => {
    notes.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: { isSent: true } } as never
  })
  on('audio.play', async (_$, e) => {
    sounds.push(String((e as { asset?: string }).asset))
    return { value: undefined } as never
  })
  on('tool.call', async () => {
    if (gate) await gate
    return { result: 'ok' } as never
  })
  on('turn.start', async (_$, e) => ({ turnId: (e as { turnId?: string }).turnId ?? 'm' }) as never)
  on('state.set', async (_$, e, next) => {
    if ((e as { key?: string }).key === 'cred') credNow = (e as { value?: unknown }).value as Cred
    return next(e)
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0 } as never)
const spawn = ($: Engine, description: string, background = false, type = 'general-purpose') =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: type, provider: 'engine', parentModel: 'x', background, fork: false } as never)
const paneText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const dones = () => toasts.filter(t => t.startsWith('🎉 Done'))
const quiets = () => toasts.filter(t => t.includes('has gone quiet'))

const usage = (out: number) => ({ model: 'claude-opus-5-5', input_tokens: 10, output_tokens: out, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })

// Realistic: the agent reads a file (quick step + tool call), then one model request
// streams a Write tool call whose input arrives in 'input' chunks every 15 s for ms.
const hookStream = (on: On, clock: ReturnType<typeof base>, ms: number) => {
  let stepNo = 0
  on('turn.step', async function* () {
    stepNo++
    if (stepNo === 1) {
      yield { kind: 'text', index: 0, text: 'Let me look first.' } as never
      return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'tool_use', usage: usage(50) } as never
    }
    yield { kind: 'tool', index: 0, id: 'tu1', name: 'Write' } as never
    for (let t = 0; t < ms; t += 15000) {
      await clock.advance(15000)
      yield { kind: 'input', index: 0, json: '"lorem ipsum ' + t + '"' } as never
    }
    return { turnId: 't', index: 1, answer: '', toolUses: [], stopReason: 'tool_use', usage: usage(9000) } as never
  })
}
const drive = async ($: Engine) => {
  const step = (i: number) => ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 't', index: i, model: 'claude-opus-5-5', messageCount: 1, agentId: 'a1' })
  for await (const _ of step(0)) void _
  await $.tool.call({ tool: 'Read', file_path: '/repo/README.md', agentId: 'a1' } as never)
  for await (const _ of step(1)) void _
}

test('Write input streaming in chunks for 3 min raises no "has gone quiet"', async ($, on) => {
  const clock = base(on)
  hookStream(on, clock, 180_000)
  await start($)
  await ask($, 'write the docs')
  await spawn($, 'Writer: the whole manual')
  await drive($)
  await clock.settle()
  const shown = await paneText($)
  expect({ quiets: quiets(), paneQuiet: /quiet \d/.test(shown) }).toEqual({ quiets: [], paneQuiet: false })
})

test('control: same stream for 100 s raises no alarm', async ($, on) => {
  const clock = base(on)
  hookStream(on, clock, 100_000)
  await start($)
  await ask($, 'write the docs')
  await spawn($, 'Writer: the whole manual')
  await drive($)
  await clock.settle()
  expect(quiets()).toEqual([])
})
