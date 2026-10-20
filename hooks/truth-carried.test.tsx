import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Independent repro: a background agent carried into a follow-up prompt, finishing during it.
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const

const base = (on: On) => {
  const rec = { toasts: [] as string[], notes: [] as string[], sounds: [] as string[] }
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
  on('ui.toast', async (_$, e) => { rec.toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e))); return { value: undefined } as never })
  on('ui.notify', async (_$, e) => { rec.notes.push(String((e as { text?: string }).text ?? JSON.stringify(e))); return { value: { isSent: true } } as never })
  on('audio.play', async (_$, e) => { rec.sounds.push(JSON.stringify(e)); return { value: undefined } as never })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.start', async () => ({}) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  return { clock, rec }
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const ask = ($: Engine, text: string, kind = 'composer') => $.prompt.submit({ text, cursor: 0, origin: { kind } } as never)
const spawn = ($: Engine, description: string, background: boolean) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background, fork: false } as never)
const end = ($: Engine, reason: string, agentId?: string) =>
  $.turn.complete({ reason, isAborted: reason === 'aborted', answer: 'ok', durationMs: 1, turnId: agentId ? `t-${agentId}` : 'main', ...(agentId ? { agentId } : {}) } as never)
const paneText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join('\n')
}
const bandText = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 140, maxRows: 4, isWorking: false, hasSurvey: false } as never })
  const all = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? ''))
  await ui.unmount()
  return all.join(' ')
}

const flow = async ($: Engine, clock: { advance: (ms: number) => Promise<void>; settle: () => Promise<void> }, followMs: number, reason: string) => {
  await start($)
  await ask($, 'build the video')
  await spawn($, 'Researcher: launch videos', true)
  await end($, 'answer') // main turn answers: "started a researcher in the background"
  await clock.advance(60_000)
  await ask($, 'are you working?')
  await clock.advance(3_000)
  await end($, 'answer') // "yes, the researcher is still running"
  await clock.advance(followMs)
  await clock.settle()
  const before = { band: await bandText($), pane: await paneText($) }
  await end($, reason, 'a1') // the background agent reports back
  // What the engine really does next: deliver the task notification as a turn of its own.
  await ask($, '<task-notification>agent a1 finished</task-notification>', 'task-notification')
  await end($, 'answer')
  await clock.advance(1_000)
  await clock.settle()
  const after = { band: await bandText($), pane: await paneText($) }
  return { before, after }
}

test('short follow-up: carried bg agent finishing gives a Done for "build the video" and stays visible', async ($, on) => {
  const { clock, rec } = base(on)
  const r = await flow($, clock, 5_000, 'answer')
  expect({ shown: r.after.pane.includes('Researcher: launch videos'), done: rec.toasts.filter(t => t.includes('🎉 Done')) })
    .toEqual({ shown: true, done: ['🎉 Done: build the video'] })
})

test('long follow-up: the cheer names the carried job, not the follow-up question', async ($, on) => {
  const { clock, rec } = base(on)
  const r = await flow($, clock, 120_000, 'answer')
  expect({ shown: r.after.pane.includes('Researcher: launch videos'), done: rec.toasts.filter(t => t.includes('🎉 Done')) })
    .toEqual({ shown: true, done: ['🎉 Done: build the video'] })
})

test('failure: a carried agent that fails stays in view and nothing is cheered', async ($, on) => {
  const { clock, rec } = base(on)
  const r = await flow($, clock, 120_000, 'error')
  expect({ shown: r.after.pane.includes('Researcher: launch videos'), done: rec.toasts.filter(t => t.includes('🎉 Done')) })
    .toEqual({ shown: true, done: [] })
})
