import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Stuck-agent rescue end to end: `/tokens rescue`, then `retry <n>` and `nudge <n>`.
const sent: string[] = []
const spawned: string[] = []
const toasts: string[] = []
const base = (on: On) => {
  sent.length = 0
  spawned.length = 0
  toasts.length = 0
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
  on('prompt.suggest', async () => ({ isShown: true }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.send', async (_$, e) => {
    sent.push(String((e as { to?: unknown }).to))
    return { isDelivered: true } as never
  })
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  let n = 0
  on('agent.spawn', (_$, e) => {
    spawned.push(String((e as { model?: string }).model ?? ''))
    return { model: 'claude-opus-5-5', agentId: `a${++n}` } as never
  })
  return clock
}
const tokens = async ($: Engine, args: string): Promise<string> => String(((await $.command.run({ command: 'tokens', args } as never)) as { text?: string }).text)

test('rescue: /tokens rescue lists the quiet agent, and retry 1 / nudge 1 act on it', async ($, on) => {
  const clock = base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await $.agent.spawn({ tool_use_id: 't-1', prompt: 'dig deep', description: 'Researcher: dig deep', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  await clock.advance(125_000)
  await clock.settle()
  expect(await tokens($, 'rescue')).toContain('1 quiet agent')
  const nudged = await tokens($, 'rescue nudge 1')
  expect(nudged).toContain('Nudged')
  expect(sent).toEqual(['a1'])
  const retried = await tokens($, 'rescue retry 1')
  expect(retried).toContain('started again on Haiku')
  expect(spawned[spawned.length - 1]).toBe('haiku')
  expect(await tokens($, 'rescue nudge all')).toContain('Nudged')
})

test('rescue: the quiet agent card (desktop) shows Retry on Haiku and Nudge, and both act', async ($, on) => {
  const clock = base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'audit the repo', cursor: 0 } as never)
  await $.agent.spawn({ tool_use_id: 't-1', prompt: 'dig deep', description: 'Researcher: dig deep', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  await clock.advance(125_000)
  await clock.settle()
  const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } as const
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const buttons = (await ui.findAll({ type: 'Button' })) as { props?: { label?: string } }[]
  const retry = buttons.find(b => b.props?.label === '↻ Retry on Haiku')
  const nudgeBtn = buttons.find(b => b.props?.label === '✋ Nudge')
  expect(Boolean(retry)).toBe(true)
  expect(Boolean(nudgeBtn)).toBe(true)
  await ui.press(nudgeBtn as never)
  await clock.settle()
  await ui.press(retry as never)
  await clock.settle()
  await ui.unmount()
  expect(sent).toEqual(['a1'])
  expect(spawned[spawned.length - 1]).toBe('haiku')
  expect(toasts.some(t => t.includes('Nudged'))).toBe(true)
  expect(toasts.some(t => t.includes('started again on Haiku'))).toBe(true)
})
