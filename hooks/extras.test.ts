import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

const base = (on: On) => {
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
  on('audio.play', async (_$, e) => {
    sounds.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}
const toasts: string[] = []
const sounds: string[] = []

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const paneSvgs = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await ui.unmount()
  return all.join('')
}

test('street cred: a finished job earns XP and the CHOOM badge, with a toast', async ($, on) => {
  const clock = base(on)
  toasts.length = 0
  await start($)
  await $.prompt.submit({ text: 'Do a job', cursor: 0 } as never)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Engineer: build', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok', text: 'ok' } as never)
  await clock.advance(30_000)
  await $.turn.complete({ reason: 'answer', answer: 'done', text: 'done' } as never)
  const svg = await paneSvgs($)
  expect(svg).toContain('LEVEL &amp; BADGES')
  expect(svg).toMatch(/>12<\/tspan> XP/)
  expect(svg).toContain('FIRST GIG')
  expect(toasts.join('\n')).toContain('Badge unlocked: FIRST GIG')
})

test('braindance: tool calls land on the replay; Back steps to an earlier one', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'Look around', cursor: 0 } as never)
  await $.tool.call({ tool: 'Read', file_path: '/r/a.ts' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/r/b.ts', old_string: 'a', new_string: 'b' } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const bd = async () => (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).find(x => x.includes('REPLAY')) ?? ''
  expect(await bd()).toContain('2/2')
  await ui.press((await ui.find({ key: 'bd-prev' })) as never)
  expect(await bd()).toContain('1/2')
  await ui.unmount()
})

test('samurai: hidden from the list until worn, then a badge and its own chime', async ($, on) => {
  base(on)
  toasts.length = 0
  sounds.length = 0
  await start($)
  const list = await $.command.run({ command: 'skin', args: '' } as never)
  expect(String((list as { text?: string }).text)).not.toContain('samurai')
  await $.command.run({ command: 'skin', args: 'samurai' } as never)
  expect(toasts.join('\n')).toContain('SAMURAI reunited')
  expect(toasts.join('\n')).toContain('Badge unlocked: SAMURAI')
  expect(sounds.join(' ')).toContain('done-samurai')
  expect(await paneSvgs($)).toContain('ROCKERBOY CRED')
})

// --- Regressions found in review ---

import { BADGES, BD_H, BEATS_KEPT, BLANK_CRED, bootStrip, braindanceCard, credCard, credHeight, shiftPick, stepPick, textW } from './extras'
import type { Beat } from './extras'

const theme = { accent: '#f00', accent2: '#ff0', done: '#0f0', text: '#fff', subtext: '#aaa', muted: '#666', tile: '#000', track: '#111', line: '#222' }
const box = (x: number, y: number, w: number, h: number, attrs: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`
const strip = (s: string) => s.replace(/<title>.*?<\/title>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
// Every start- or middle-anchored text line stays inside 0..W by the module's own measure.
const overflows = (svg: string, W: number): string[] =>
  [...svg.matchAll(/<text ([^>]*)>(.*?)<\/text>/g)].flatMap(([, attrs = '', body = '']) => {
    const x = Number(/\bx="([\d.-]+)"/.exec(attrs)?.[1] ?? 0)
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 12)
    const ls = Number(/letter-spacing="([\d.]+)"/.exec(attrs)?.[1] ?? 0)
    // A tspan with its own size (the kana) is measured at that size, with its dx.
    let rest = body
    let w = 0
    for (const [all, tattrs = '', tbody = ''] of body.matchAll(/<tspan ([^>]*font-size[^>]*)>(.*?)<\/tspan>/g)) {
      const tsize = Number(/font-size="([\d.]+)"/.exec(tattrs)?.[1] ?? size)
      const tls = Number(/letter-spacing="([\d.]+)"/.exec(tattrs)?.[1] ?? ls)
      w += textW(strip(tbody), tsize, tls) + Number(/dx="([\d.-]+)"/.exec(tattrs)?.[1] ?? 0)
      rest = rest.replace(all, '')
    }
    w += textW(strip(rest), size, ls)
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const [lo, hi] = anchor === 'middle' ? [x - w / 2, x + w / 2] : anchor === 'end' ? [x - w, x] : [x, x + w]
    return lo < -1 || hi > W + 1 ? [`${strip(body)} @${lo.toFixed(0)}..${hi.toFixed(0)}`] : []
  })

test('street cred: five agents spawned at once count five (bumps are serialized)', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'Big job', cursor: 0 } as never)
  await Promise.all(
    [1, 2, 3, 4, 5].map(i =>
      $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: part ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: true, fork: false } as never),
    ),
  )
  expect(await paneSvgs($)).toMatch(/AGENTS<\/text><text[^>]*>5</)
})

test('street cred: a quick solo job still earns its XP', async ($, on) => {
  base(on)
  await start($)
  await $.prompt.submit({ text: 'Quick one', cursor: 0 } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done', text: 'done' } as never)
  expect(await paneSvgs($)).toMatch(/>10<\/tspan> XP/)
})

test('braindance: First on an empty timeline stays live; the selection follows its beat when old ones drop', async ($, on) => {
  base(on)
  await start($)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  await ui.press((await ui.find({ key: 'bd-first' })) as never)
  await ui.press((await ui.find({ key: 'bd-prev' })) as never)
  await ui.unmount()
  await $.tool.call({ tool: 'Read', file_path: '/r/a.ts' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/r/b.ts' } as never)
  expect(await paneSvgs($)).toContain('2/2')
  expect(shiftPick(10, 1)).toBe(9)
  expect(shiftPick(0, 3)).toBe(0)
  expect(shiftPick(-1, 3)).toBe(-1)
  expect(stepPick(-1, 0, -1)).toBe(-1)
  expect(stepPick(-1, 0, 1)).toBe(-1)
  expect(stepPick(-1, 5, -1)).toBe(3)
  expect(stepPick(9, 5, -1)).toBe(3)
  expect(stepPick(3, 5, 1)).toBe(4)
  expect(stepPick(4, 5, 1)).toBe(-1)
})

test('braindance: the highlight lands on the picked beat even when other lanes are hidden', () => {
  const who = ['A', 'B', 'C', 'D', 'E', 'F', 'Manager']
  const beats: Beat[] = who.map((w, i) => ({ at: 1000 + i * 1000, tool: 'Read', text: '', who: w }))
  const svg = braindanceCard(600, beats, 6, theme, 'sans-serif', box, 'REPLAY', () => '#0ff')
  const hit = [...svg.matchAll(/<rect x="([\d.]+)"[^>]*stroke-width="1"\/>/g)]
  expect(hit.length).toBe(1)
  expect(Number(hit[0]?.[1])).toBeGreaterThan(560)
})

test('extras: no text overflows at narrow widths; user strings are escaped; sizes stay in bounds', () => {
  const full = { ...BLANK_CRED, xp: 123_456, jobs: 99_999, longJobs: 9_999, agents: 99_999, crewJobs: 3, badges: BADGES.map(b => b.id) }
  for (const W of [240, 320, 359, 360, 480, 900, 1600]) {
    const card = credCard(W, full, theme, 'sans-serif', box, 'LEVEL & BADGES', 'ストリートクレッド')
    expect(overflows(card, W)).toEqual([])
    expect(card.length).toBeLessThan(131072)
    expect(credHeight(W)).toBeLessThan(4096)
    const boot = bootStrip(W, theme, 'sans-serif', 'JACKING IN…', 'CONNECTION ESTABLISHED · DIVING THE NET')
    expect(overflows(boot, W)).toEqual([])
  }
  const evil = '<script>&"x'
  const beats: Beat[] = Array.from({ length: BEATS_KEPT }, (_, i) => ({ at: 1000 + i * 997, tool: `mcp: ${evil}${'t'.repeat(60)}`, text: `/very/long/path/${evil}/${'x'.repeat(400)}`, who: `${evil} Role ${i % 7}` }))
  for (const W of [240, 320, 520, 900, 1600]) {
    const bd = braindanceCard(W, beats, 40, theme, 'sans-serif', box, 'BRAINDANCE', () => '#0ff')
    expect(bd).not.toContain('<script>')
    expect(bd.length).toBeLessThan(131072)
    expect(BD_H).toBeLessThan(4096)
    expect(overflows(bd, W)).toEqual([])
    expect(overflows(braindanceCard(W, [], -1, theme, 'sans-serif', box, 'REPLAY', () => '#0ff'), W)).toEqual([])
  }
})

test('/missioncontrol currency with a bad rate answers with an error, not "opened"', async ($, on) => {
  base(on)
  await start($)
  for (const args of ['currency eur abc', 'currency eur 0', 'currency eur -2']) {
    const r = String(((await $.command.run({ command: 'missioncontrol', args } as never)) as { text?: string }).text)
    expect(r).toContain('not a rate')
  }
  const ok = String(((await $.command.run({ command: 'missioncontrol', args: 'currency eur 0.92' } as never)) as { text?: string }).text)
  expect(ok).toContain('EUR')
})
