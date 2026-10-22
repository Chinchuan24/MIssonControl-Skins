import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140 } as never } as const
const PANE = { component: 'Pane', requestId: 'crab-agents', props: { title: 'Mission Control', isFocused: true, columns: 60, rows: 40, bodyColumns: 60, isCompact: false } as never } as const

const last: Record<string, unknown> = {}
const writes: Record<string, number> = {}
let runs: string[][] = []
let spawnedPrompts: string[] = []

const base = (on: On, opts: { now?: number; env?: Record<string, string>; store?: Record<string, unknown>; defaults?: 'ok' | 'fail' | 'throw' } = {}) => {
  const clock = mock.clock(on, { now: opts.now ?? Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, opts.env ?? { LANG: 'en_US.UTF-8' })
  mock.store(on, opts.store ?? {})
  runs = []
  spawnedPrompts = []
  for (const k of Object.keys(writes)) delete writes[k]
  on('process.run', async (_$, e) => {
    const argv = ((e as { argv?: string[] }).argv ?? []) as string[]
    runs.push(argv)
    if (opts.defaults === 'throw') throw new Error('timed out')
    if (opts.defaults === 'fail') return { value: { exitCode: 1, stdout: '', stderr: 'does not exist', isStdoutTruncated: false, isStderrTruncated: false } } as never
    return { value: { exitCode: 0, stdout: '(\n    "he-IL",\n    "en-IL"\n)\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', (_$, e) => {
    spawnedPrompts.push(String((e as { prompt?: string }).prompt))
    return { model: 'claude-opus-5-5', agentId: `a${++n}` } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as never
  })
  on('state.set', async (_$, e, next) => {
    const key = String((e as { key?: string }).key)
    writes[key] = (writes[key] ?? 0) + 1
    last[key] = (e as { value?: unknown }).value
    return next(e)
  })
  return clock
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const spawn = ($: Engine, i: number, type = 'general-purpose', description = `Engineer: piece ${i}`) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description, subagentType: type, provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
const bandSvg = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source)).join('')

// 1. The ticker stops one second short of the cache's expiry: left === 0 is not
// "close", so `now` is not written again until the minute tick, and the band
// keeps drawing 00:01 for up to a minute after the cache has expired.
test('BUG cache: the band moves on to "expired" once the cache runs out', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'hi', cursor: 0 } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
  const band = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...BAND })
  await clock.advance(60 * 60 * 1000 - 3_000) // 3 s before expiry
  expect(await bandSvg(band)).toMatch(/00:0[1-3]/)
  await clock.advance(10_000) // 7 s past expiry
  const drawn = await bandSvg(band)
  await band.unmount()
  expect(drawn).not.toMatch(/00:01/)
  expect(drawn).toMatch(/expired/)
})

// 2. A reload keeps $.state's `today`, but never checks its date: a reload after
// midnight shows yesterday's counts as today's until the next model step.
test('BUG reload after midnight: Today is still yesterday', async ($, on) => {
  const at = new Date(2026, 9, 20, 23, 58, 0).getTime() // local time, as dayOf reads it
  const clock = base(on, { now: at, store: { skin: 'cyberpunk-2077' } })
  await start($)
  await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
  await spawn($, 1)
  await spawn($, 2)
  await clock.advance(5 * 60 * 1000) // 00:03 the next day
  await start($) // hot reload: $.state survives
  const day = last.today as { date: string; agents: number }
  expect(day.date).toBe('2026-10-21')
})

// 3. The rename: any agent type that merely starts with "mc-" is treated as a
// Mission Control worker, and gets the step brief appended to its prompt.
test('BUG rename: an unrelated "mc-" agent is not briefed as a worker', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
  await spawn($, 1, 'mc-server-admin', 'Fix the Minecraft server')
  await spawn($, 2, 'mc-heavy', 'Engineer: real worker')
  expect(spawnedPrompts[1]).toContain('mcp__crab-progress__step') // the real tier is briefed
  expect(spawnedPrompts[0]).toBe('p') // the unrelated one must not be
})

// 4. The macOS fallback: only with no LANG and on a Mac; a failure falls through.
test('mac lang: LANG set never spawns defaults; no LANG on a Mac reads AppleLanguages', async ($, on) => {
  base(on)
  await start($)
  expect(runs.length).toBe(0)
})
test('mac lang: no LANG, Mac -> one defaults call per session.start (a reload spawns again)', async ($, on) => {
  base(on, { env: { __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0' } })
  await start($)
  expect(runs[0]).toEqual(['/usr/bin/defaults', 'read', '-g', 'AppleLanguages'])
  const text = String(((await $.command.run({ command: 'tokens', args: '' } as never)) as { text?: string }).text)
  await start($)
  expect(runs.length).toBe(2)
})
test('mac lang: defaults failing or throwing falls through, session still starts', async ($, on) => {
  base(on, { env: { __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0' }, defaults: 'throw' })
  await start($)
  const r = await $.command.run({ command: 'missioncontrol', args: '' } as never)
  expect(String((r as { text?: string }).text)).toBeTruthy()
})

// 5. Every Svg the desktop draws has an alt, across skins and odd crews
// (blank descriptions, a big plan, a running agent with no steps).
for (const skin of ['crab-classic', 'cyberpunk-2077', 'arasaka', 'lucy-edgerunners']) {
  test(`alt: no blank Svg alt in the pane or band (${skin})`, async ($, on) => {
    const clock = base(on, { store: { skin } })
    await start($)
    await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
    await $.tool.call({ tool: 'mcp__crab-progress__progress', title: '', total: 3, done: 0, phase: 'delegate', tasks: [{ title: '', tier: 'heavy' }] } as never)
    await spawn($, 1, 'mc-heavy', '')
    await spawn($, 2, 'Explore', '')
    await $.turn.complete({ agentId: 'a2', reason: 'answer', answer: 'ok' } as never)
    await clock.advance(3_000)
    for (const req of [PANE, BAND]) {
      const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...req })
      const svgs = await ui.findAll({ type: 'Svg' })
      await ui.unmount()
      expect(svgs.length).toBeGreaterThan(0)
      expect(svgs.filter(el => !String((el.props as { alt?: string }).alt ?? '').trim()).length).toBe(0)
      for (const el of svgs) expect(String((el.props as { source?: string }).source)).not.toMatch(/NaN|undefined/)
    }
  })
}

// 6. The estimate: a running agent with no steps shows ~N%, never NaN, never past 95%.
test('estimate: ~0% at start, below 95% after an hour, no NaN', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'do it', cursor: 0 } as never)
  await spawn($, 1)
  const pct = async () => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', ...PANE })
    const src = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source)).join('')
    await ui.unmount()
    return [...src.matchAll(/~(-?[\dNa]+)%/g)].map(m => m[1])
  }
  expect(await pct()).toContain('0')
  await clock.advance(60 * 60 * 1000)
  const later = await pct()
  expect(later.every(p => Number(p) >= 0 && Number(p) <= 95)).toBe(true)
})

// 7. Idle with the cache far from expiry: `now` moves once a minute, not each second.
test('ticker: idle, cache > 10 min: about one `now` write a minute', async ($, on) => {
  const clock = base(on)
  await start($)
  await $.prompt.submit({ text: 'hi', cursor: 0 } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
  await clock.advance(20_000)
  for (const k of Object.keys(writes)) delete writes[k]
  await clock.advance(120_000)
  expect(writes.now ?? 0).toBeLessThanOrEqual(3)
  expect(writes.session ?? 0).toBe(0)
})
