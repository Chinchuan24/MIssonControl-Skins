import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro: Esc / API error / refusal on the main turn is cheered as "Done".

const toasts: string[] = []
const notes: string[] = []
const sounds: string[] = []
const st: Record<string, unknown> = {}

const base = (on: On) => {
  toasts.length = 0
  notes.length = 0
  sounds.length = 0
  const clock = mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  for (const k of Object.keys(st)) delete st[k]; mock.store(on, st)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => { toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e))); return { value: undefined } as never })
  on('ui.notify', async (_$, e) => { notes.push(String((e as { text?: string }).text ?? JSON.stringify(e))); return { value: { isSent: true } } as never })
  on('audio.play', async (_$, e) => { sounds.push(JSON.stringify(e)); return { value: undefined } as never })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.start', async (_$, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return clock
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = async ($: Engine, text: string) => {
  await $.prompt.submit({ text, cursor: 0 } as never)
  await $.turn.start({ text, turnId: 'main-1' } as never)
}
const spawn = ($: Engine, description: string) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
const end = ($: Engine, reason: 'answer' | 'aborted' | 'error' | 'refusal', agentId?: string, turnId = 'main-1') =>
  $.turn.complete({ reason, isAborted: reason === 'aborted', answer: '', durationMs: 1, turnId, ...(reason === 'refusal' ? { refusal: { category: null, explanation: null } } : {}), ...(agentId ? { agentId } : {}) } as never)

const bandText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 140, maxRows: 4, isWorking: false, hasSurvey: false } as never })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join(' ')
}

for (const reason of ['aborted', 'error', 'refusal'] as const) {
  test(`VERIFY solo ${reason}: 40 s job ended by ${reason} is not cheered`, async ($, on) => {
    const clock = base(on)
    await start($)
    await ask($, 'refactor the parser and add tests')
    await $.tool.call({ tool: 'Read', input: { file_path: '/repo/parser.ts' }, toolUseId: 'r1' } as never).catch(() => undefined)
    await clock.advance(40_000)
    await end($, reason)
    await clock.settle()
    const band = await bandText($)
    expect(toasts.filter(t => t.startsWith('🎉 Done'))).toEqual([])
    expect(notes.filter(t => t.includes('Claude finished'))).toEqual([])
  })
}

test('a long aborted job is no Done and no legend', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'refactor the whole billing module')
  await clock.advance(200_000)
  await end($, 'aborted')
  await clock.settle()
  expect(toasts.filter(t => t.startsWith('🎉 Done'))).toEqual([])
})

test('crew Esc after 5 s: agents aborted, then the main turn, cheers nothing', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'audit the repo')
  await spawn($, 'Engineer: piece 1')
  await spawn($, 'Engineer: piece 2')
  await $.turn.start({ text: 'p', turnId: 'ta1', agentId: 'a1' } as never)
  await $.turn.start({ text: 'p', turnId: 'ta2', agentId: 'a2' } as never)
  await clock.advance(5_000)
  await end($, 'aborted', 'a1', 'ta1')
  await end($, 'aborted', 'a2', 'ta2')
  await end($, 'aborted')
  await clock.settle()
  expect(toasts.filter(t => t.startsWith('🎉 Done'))).toEqual([])
})

test('CONTROL: 40 s answered job IS cheered (sanity)', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'refactor the parser and add tests')
  await clock.advance(40_000)
  await end($, 'answer')
  await clock.settle()
  expect(toasts.filter(t => t.startsWith('🎉 Done'))).toEqual(['🎉 Done: refactor the parser and add tests'])
})

test('a background agent of an Esc-ed job finishing later cheers nothing', async ($, on) => {
  const clock = base(on)
  await start($)
  await ask($, 'write the release notes')
  await $.agent.spawn({ tool_use_id: 't-bg', prompt: 'p', description: 'Researcher: gather changes', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: true, fork: false } as never)
  await $.turn.start({ text: 'p', turnId: 'tb', agentId: 'a1' } as never)
  await clock.advance(3_000)
  await end($, 'aborted') // Esc on the main turn; the background agent keeps going
  await clock.settle()
  const atEsc = [...toasts]
  await clock.advance(60_000)
  await end($, 'answer', 'a1', 'tb')
  await clock.settle()
  expect(toasts.filter(t => t.startsWith('🎉 Done'))).toEqual([])
})
