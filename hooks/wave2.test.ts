// Final check for the wave-2 skins: the replay buttons on each themed log card, the
// hidden skins' unlocks surviving a reload and the picker, and Capri resuming (not
// replaying) on a redraw.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { roamOptsOf, roamOverlay } from './overlay'
import { roamPlan } from './roamer'
import { phased } from './smooth'
import { THEMES } from './themes'

const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const NOW = Date.parse('2026-10-20T10:00:00Z')

let addonGone = false
const base = (on: On, o: { addon?: boolean; now?: number } = {}) => {
  addonGone = false
  mock.clock(on, { now: o.now ?? NOW })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: !addonGone && (o.addon ?? true) && /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const start = async ($: Engine, skin: string) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  if (skin) await $.command.run({ command: 'skin', args: skin } as never)
}
const skinList = async ($: Engine) => String(((await $.command.run({ command: 'skin', args: 'list' } as never)) as { text?: string }).text)
const bandSvg = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 14, bodyColumns: 120 } as never })
  const s = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
  await ui.unmount()
  return s
}

// The log card's alt names the picked beat: "<n> of <total>", and ", live" while following the newest.
for (const [skin, word, addon] of [
  ['breaking-bad', 'On air: spot', false],
  ['heisenberg', 'On air: spot', false],
  ['mentalist', 'Case board: lead', false],
  ['edgerunners-2', "Netrun trace: node", true],
] as const) {
  test(`${skin}: First, Back, Next and Live move the log card's pick`, { timeoutMs: 20_000 }, async ($, on) => {
    base(on, { addon })
    await start($, skin)
    await $.prompt.submit({ text: 'Fix the parser', cursor: 0 } as never)
    for (const f of ['a', 'b', 'c']) await $.tool.call({ tool: 'Read', file_path: `/repo/${f}.ts` } as never)
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
    const alt = async () => (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt)).find(a => a.startsWith(word)) ?? ''
    for (const k of ['bd-first', 'bd-prev', 'bd-next', 'bd-live']) expect(await ui.find({ key: k })).toBeDefined()
    expect(await alt()).toContain(`${word} 3 of 3`)
    await ui.press({ key: 'bd-first' })
    expect(await alt()).toContain(`${word} 1 of 3`)
    expect(await alt()).not.toContain(', live')
    await ui.press({ key: 'bd-next' })
    expect(await alt()).toContain(`${word} 2 of 3`)
    await ui.press({ key: 'bd-prev' })
    expect(await alt()).toContain(`${word} 1 of 3`)
    await ui.press({ key: 'bd-prev' }) // holds at the first
    expect(await alt()).toContain(`${word} 1 of 3`)
    await ui.press({ key: 'bd-live' })
    expect(await alt()).toContain(`${word} 3 of 3`)
    // Live follows the newest beat as calls come in.
    await $.tool.call({ tool: 'Read', file_path: '/repo/d.ts' } as never)
    expect(await alt()).toContain(`${word} 4 of 4`)
    await ui.unmount()
  })
}

test('capricorn: an alias of Edgerunners 2 CAPRI mode: never its own picker entry, and a reload still wears the mode', { timeoutMs: 20_000 }, async ($, on) => {
  base(on)
  await start($, 'edgerunners-2')
  const pickerHas = async (id: string) => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-skins', props: pane })
    const has = Boolean(await ui.find({ key: `wear-${id}` })) || (await ui.findAll({ type: 'Svg' })).some(el => String(el.props.alt).startsWith('CAPRICORN'))
    await ui.unmount()
    return has
  }
  expect(await pickerHas('capricorn')).toBe(false)
  expect(await skinList($)).not.toContain('capricorn')
  const back = (await $.prompt.submit({ text: 'is it 0+2=1?', cursor: 0 } as never)) as { text?: string }
  expect(back.text).toBe('is it 0+2=1?')
  expect(await skinList($)).toContain('▸ edgerunners-2')
  expect(await skinList($)).not.toContain('capricorn')
  expect(await pickerHas('capricorn')).toBe(false)
  await start($, '') // a reload: session.start again, the store kept
  expect(await skinList($)).toContain('▸ edgerunners-2')
  expect(await bandSvg($)).toContain('PROJECT CAPRICORN')
})

test('capricorn: a saved Edgerunners 2 (CAPRI mode) falls back to the classic when the add-on is gone', { timeoutMs: 20_000 }, async ($, on) => {
  base(on)
  await start($, 'edgerunners-2')
  await $.prompt.submit({ text: '0+2=1', cursor: 0 } as never)
  expect(await skinList($)).toContain('▸ edgerunners-2')
  addonGone = true
  await start($, '')
  const list = await skinList($)
  expect(list).not.toContain('capricorn')
  expect(list).not.toContain('edgerunners-2')
})

test('heisenberg: the unlock is saved, so a reload still wears it', { timeoutMs: 20_000 }, async ($, on) => {
  base(on, { addon: false })
  await start($, 'breaking-bad')
  const back = (await $.prompt.submit({ text: 'say my name', cursor: 0 } as never)) as { text?: string }
  expect(back.text).toBe('say my name')
  expect(await skinList($)).toContain('▸ heisenberg')
  await start($, '')
  expect(await skinList($)).toContain('▸ heisenberg')
})

test("capri resumes on a redraw: the act's delay is pinned to its start, so a later drawing is further along, not restarted", () => {
  const th = THEMES.edgerunners2
  const r = th.roamer as NonNullable<typeof th.roamer>
  for (const kind of ['walk', 'takeover'] as const) {
    let at = 0
    for (let t = NOW; t < NOW + 86_400_000 * 5; t += 30_000) {
      const p = roamPlan(r.seed, t, roamOptsOf(r, 96))
      if (p.kind === kind) {
        at = p.startAt
        break
      }
    }
    expect(at).toBeGreaterThan(0)
    const plan = roamPlan(r.seed, at, roamOptsOf(r, 96))
    const draw = (now: number) => phased(roamOverlay(th, { W: 1200, H: 132, surface: 'band', at: now, ctxPct: 96 }), now)
    const later = Math.min(4, Math.floor((plan.endAt - plan.startAt) / 1000) - 1)
    const a = draw(at + 1000)
    const b = draw(at + later * 1000)
    expect(a).not.toMatch(/@@[TG]/)
    expect(a.length).toBeGreaterThan(0)
    // The pinned start reads -1s at +1 s and -Ns at +N s into the act: the same act, further on.
    expect(later).toBeGreaterThan(1)
    expect(a).toContain('animation-delay:calc(-1s + 0s)')
    expect(b).toContain(`animation-delay:calc(-${later}s + 0s)`)
    // Once the act is over she is gone (a takeover never replays in the same window).
    expect(draw(plan.endAt + 1000)).not.toContain(`calc(`)
    expect(plan.endAt - plan.startAt).toBeLessThanOrEqual(18_000)
  }
})
