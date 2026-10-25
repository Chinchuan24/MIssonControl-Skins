import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Interruptions and failures: what Mission Control says when the person presses Esc,
// an API error ends a turn, an agent fails, or a tool call runs long.

const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const

const toasts: string[] = []
const notes: string[] = []
let release: (() => void) | null = null

const base = (on: On, opts: { slowTool?: boolean } = {}) => {
  toasts.length = 0
  notes.length = 0
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
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.notify', async (_$, e) => {
    notes.push(String((e as { text?: string; message?: string }).text ?? (e as { message?: string }).message ?? JSON.stringify(e)))
    return { value: { isSent: true } } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('tool.call', async () => {
    if (opts.slowTool) await new Promise<void>(r => (release = r))
    return { result: 'ok' } as never
  })
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string) => $.prompt.submit({ text, cursor: 0 } as never)
const spawn = ($: Engine, description: string, background = false) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background, fork: false } as never)
const end = ($: Engine, reason: 'answer' | 'aborted' | 'error' | 'refusal', agentId?: string) =>
  $.turn.complete({ reason, isAborted: reason === 'aborted', answer: '', durationMs: 1, turnId: 'turn', ...(agentId ? { agentId } : {}) } as never)

const paneText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const deskAlts = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Svg' })).map(t => String(((t as { props?: { alt?: string } }).props ?? {}).alt ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const bandText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 140, maxRows: 4, isWorking: false, hasSurvey: false } as never })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join(' ')
}


test('esc-as-error: Esc with two foreground agents out shows both stopped, never error, on every surface', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'audit the repo')
  await spawn($, 'Engineer: piece 1')
  await spawn($, 'Engineer: piece 2')
  await clock.advance(8_000)
  // Esc: the engine ends each running agent's turn as aborted (isAborted true), then the main turn.
  await end($, 'aborted', 'a1')
  await end($, 'aborted', 'a2')
  await end($, 'aborted')
  await clock.advance(1_000)
  const alts = (await deskAlts($)).split('\n').filter(l => l.startsWith('Engineer: piece'))
  const term = (await paneText($)).split('\n').filter(l => /[✓✗●]/.test(l))
  expect(alts.some(l => l.includes(': error,'))).toBe(false)
  expect(term.some(l => l.includes('✗'))).toBe(false)
})

test('CONTROL: a real API error on an agent is shown as error (expected)', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'audit the repo')
  await spawn($, 'Engineer: piece 1')
  await clock.advance(3_000)
  await end($, 'error', 'a1')
  const alts = (await deskAlts($)).split('\n').filter(l => l.startsWith('Engineer: piece'))
  expect(alts.some(l => l.includes(': error,'))).toBe(true)
})
