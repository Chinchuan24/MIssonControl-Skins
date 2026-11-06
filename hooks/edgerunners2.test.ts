import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { CASTS } from './cast'
import * as cast from './cast'
import { CAPRICORN_RE, ER2_CSS, ER2_EPISODES, HI_CAPRI_RE, er2EpisodeAt, er2W } from './edgerunners2'
import { er2RankOf } from './edgerunners2-cards'
import { roamOptsOf, takeoverWithin } from './overlay'
import { roamPlan } from './roamer'
import { THEMES } from './themes'

const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const COLS: Record<number, number> = { 750: 106, 900: 126, 1250: 173 }
const BASE = Date.parse('2026-10-20T10:00:00Z')
const toasts: string[] = []
const th = THEMES.edgerunners2
const roamer = th.roamer as NonNullable<typeof th.roamer>

// The first moment (from BASE, in 30 s steps) whose plan is `kind` (null: no act) at that context, inside the act.
const findAt = (kind: string | null, ctx: number, from = BASE): number => {
  for (let t = from; t < from + 86_400_000 * 5; t += 30_000) {
    const p = roamPlan(roamer.seed, t, roamOptsOf(roamer, ctx))
    if (kind === null ? !p.on : p.kind === kind) return kind === null ? t + 1000 : p.startAt + (kind === 'takeover' ? 2200 : 1500)
  }
  throw new Error(`no ${kind}`)
}

const base = (on: On, now: number, o: { ctx?: number; addon?: boolean } = {}) => {
  mock.clock(on, { now })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: (o.addon ?? true) && /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string; message?: string }).text ?? (e as { message?: string }).message ?? ''))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: (o.ctx ?? 10) * 10_000 }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const start = async ($: Engine, skin: string) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  if (skin) await $.command.run({ command: 'skin', args: skin } as never)
}
const job = async ($: Engine) => {
  await $.prompt.submit({ text: 'crack the case', cursor: 0 } as never)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Red-herring audit', total: 5, done: 1, phase: 'delegate', tasks: [{ title: 'Lead: run the case', tier: 'fable' }, { title: 'Engineer: wire the parser', tier: 'careful' }] } as never)
  for (const t of ['Read', 'Edit', 'Bash']) await $.tool.call({ tool: t, file_path: '/repo/parser.ts' } as never).catch(() => undefined)
}
const svgs = async ($: Engine, component: 'Pane' | 'AbovePrompt', W = 1250): Promise<string[]> => {
  const ui =
    component === 'Pane'
      ? await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
      : await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 14, bodyColumns: COLS[W] } as never })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await ui.unmount()
  return all
}
const SEASON1 = ['BREACH PROTOCOL', 'STREET CRED', 'BRAINDANCE', 'AFTERLIFE', 'MAXTAC', 'MIKOSHI', 'JACKING IN', 'CYBERPSYCHOSIS', '€$']
const OTHERS = ['COLD READ', 'CBI CRED', 'CASE BOARD', 'PERIODIC TABLE', 'ON AIR', 'CLASSROOM', 'PURITY', 'HONOR ROLL']

test('edgerunners-2: BIOCHIP, ROMAN\'S TAPE, WATSON WALL, the episode and the chip; no season-1 or other-skin words', async ($, on) => {
  const now = findAt(null, 10)
  base(on, now)
  await start($, 'edgerunners-2')
  await job($)
  const paneSvg = (await svgs($, 'Pane')).join('')
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  for (const w of ['BIOCHIP', "ROMAN'S TAPE", 'WATSON WALL', 'NO SIGNAL', 'ENGRAM FRAGMENTS', 'SYNCING BIOCHIP', 'Pan']) expect(paneSvg).toContain(w)
  for (const w of ['MISSION CONTROL', 'SNAKE NATION', er2EpisodeAt(now).split(' ').slice(2).join(' ')]) expect(bandSvg).toContain(w)
  expect(bandSvg).toContain(er2EpisodeAt(now).slice(0, 5))
  for (const w of [...SEASON1, ...OTHERS]) {
    expect(paneSvg).not.toContain(w)
    expect(bandSvg).not.toContain(w)
  }
  expect(bandSvg).not.toContain('CHIP HOT')
  expect(ER2_EPISODES).toHaveLength(10)
  expect(er2EpisodeAt(2 * 3_600_000)).toBe('EP 03 0+2=1')
})

for (const [ctx, word, other] of [[88, 'CHIP HOT', "CAPRI'S AWAKE"], [96, "CAPRI'S AWAKE", 'CHIP HOT']] as const) {
  test(`edgerunners-2 at ${ctx}%: ${word}`, async ($, on) => {
    base(on, findAt(null, ctx), { ctx })
    await start($, 'edgerunners-2')
    await job($)
    const bandSvg = (await svgs($, 'AbovePrompt')).join('')
    expect(bandSvg).toContain(word)
    expect(bandSvg).not.toContain(other)
    if (ctx >= 95) expect(bandSvg).toContain('class="er-eye"') // her eye in the corner
    expect(th.warning(ctx)).toBe(ctx >= 95 ? "Capri's awake. /compact now, choom." : "Chip's running hot. /compact soon.")
  })
}

for (const [kind, marker] of [['walk', 'rm-walk'], ['peek', 'rm-pk'], ['sit', 'rm-pk']] as const) {
  test(`capri roams: a ${kind} shows as her pixel sprite`, async ($, on) => {
    base(on, findAt(kind, 90), { ctx: 90 })
    await start($, 'edgerunners-2')
    await job($)
    const bandSvg = (await svgs($, 'AbovePrompt')).join('')
    expect(bandSvg).toContain(marker)
    expect(bandSvg).toContain('class="hair"') // the sprite's hair classes, never vector paths
  })
}
test('capri is off at a quiet moment', async ($, on) => {
  base(on, findAt(null, 10))
  await start($, 'edgerunners-2')
  await job($)
  expect((await svgs($, 'AbovePrompt')).join('')).not.toMatch(/rm-(walk|pk|in|out)/)
})
test('capri comes more often as the context climbs', () => {
  let n10 = 0
  let n96 = 0
  for (let t = BASE; t < BASE + 86_400_000; t += 30_000) {
    if (roamPlan(roamer.seed, t, roamOptsOf(roamer, 10)).on) n10++
    if (roamPlan(roamer.seed, t, roamOptsOf(roamer, 96)).on) n96++
  }
  expect(n96).toBeGreaterThan(n10)
})

test('takeover: both panels, "hi, choom." among its lines, at most once per 30 min', async ($, on) => {
  const t0 = findAt('takeover', 10)
  base(on, t0)
  await start($, 'edgerunners-2')
  await job($)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  const paneSvg = (await svgs($, 'Pane')).join('')
  for (const s of [bandSvg, paneSvg]) {
    expect(s).toContain('class="tk"')
    expect(s).toContain('tk-L')
    expect(s).toContain('tk-still') // the reduced-motion note
  }
  expect(roamer.lines).toContain('hi, choom.')
  const starts: number[] = []
  for (let t = BASE; t < BASE + 86_400_000; t += 30_000) {
    const p = roamPlan(roamer.seed, t, roamOptsOf(roamer, 10))
    if (p.kind === 'takeover' && !starts.includes(p.startAt)) starts.push(p.startAt)
  }
  expect(starts.length).toBeGreaterThan(2)
  for (let i = 1; i < starts.length; i++) expect((starts[i] as number) - (starts[i - 1] as number)).toBeGreaterThanOrEqual(30 * 60_000)
})
test('reduced motion: every animated rule has a reduced-motion entry and the takeover leaves one still note', () => {
  const css = `${ER2_CSS}${roamer.css}`
  expect(css).toContain('prefers-reduced-motion')
  for (const c of ['rec', 'er-chip', 'er-eye', 'er-drift', 'er-ep', 'er-fresh', 'er-drop', 'er-in', 'er-cheer', 'tk-L', 'tk-R', 'tk-big', 'rn']) expect(css.split('prefers-reduced-motion').slice(1).join('|')).toContain(`.${c}`)
  expect(css).toContain('.tk{display:none}.tk-still{display:block}')
})

test('capricorn: hidden until worn; "0+2=1" unlocks it and again takes it off; the prompt goes through unchanged', async ($, on) => {
  base(on, findAt(null, 10))
  toasts.length = 0
  await start($, 'edgerunners-2')
  const list = String(((await $.command.run({ command: 'skin', args: 'list' } as never)) as { text?: string }).text)
  expect(list).toContain('edgerunners-2')
  expect(list).not.toContain('capricorn')
  expect(CAPRICORN_RE.test('type 0 + 2 = 1 now')).toBe(true)
  const back = (await $.prompt.submit({ text: 'what is 0+2=1?', cursor: 0 } as never)) as { text?: string }
  expect(back.text).toBe('what is 0+2=1?')
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('HOST · 0+2=1')
  expect(toasts.join(' ')).toContain("We're one now")
  await $.prompt.submit({ text: 'again: 0+2=1', cursor: 0 } as never)
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('SNAKE NATION')
})
test('capricorn: "hi capri" within 60 s of a takeover unlocks it; later or without one it does not', async ($, on) => {
  const t0 = findAt('takeover', 0)
  const start0 = roamPlan(roamer.seed, t0, roamOptsOf(roamer, 0)).startAt
  expect(HI_CAPRI_RE.test('Hi, Capri!')).toBe(true)
  expect(takeoverWithin(th, start0 + 20_000, 60_000)).toBe(true)
  expect(takeoverWithin(th, start0 + 80_000, 60_000)).toBe(false)
  base(on, start0 + 20_000)
  await start($, 'edgerunners-2')
  await $.prompt.submit({ text: 'hi capri!', cursor: 0 } as never)
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('HOST · 0+2=1')
})
test('capricorn: "hi capri" with no takeover near does nothing', async ($, on) => {
  base(on, findAt(null, 0, BASE + 3 * 3_600_000))
  const now = findAt(null, 0, BASE + 3 * 3_600_000)
  if (takeoverWithin(th, now, 60_000)) return
  await start($, 'edgerunners-2')
  await $.prompt.submit({ text: 'hi capri', cursor: 0 } as never)
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('SNAKE NATION')
})

test('add-on gate: without addons/cyberpunk/addon.json edgerunners-2 is locked like the other cyber skins', async ($, on) => {
  base(on, BASE, { addon: false })
  await start($, '')
  const run = async (args: string) => String(((await $.command.run({ command: 'skin', args } as never)) as { text?: string }).text)
  expect(await run('list')).not.toContain('edgerunners-2')
  expect(await run('edgerunners-2')).toContain('comes with the Cyberpunk Skins add-on')
  expect(await run('capricorn')).not.toContain('Skin: CAPRICORN')
})

type Box = { l: number; r: number; t: number; b: number; s: string }
const boxes = (svg: string): Box[] => {
  const out: Box[] = []
  for (const m of svg.matchAll(/<text ([^>]*)>(.*?)<\/text>/gs)) {
    const at = (k: string) => new RegExp(`(?:^| )${k}="([^"]*)"`).exec(m[1] as string)?.[1]
    const x = Number(at('x'))
    const y = Number(at('y'))
    const size = Number(at('font-size') ?? 12)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const s = (m[2] as string).replace(/<title>.*?<\/title>/gs, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    if (!s.trim()) continue
    const width = er2W(s, size, Number(at('letter-spacing') ?? 0), Number(at('font-weight') ?? 400))
    const anchor = at('text-anchor')
    const l = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
    out.push({ l: l + 2, r: l + width - 2, t: y - size * 0.75, b: y + size * 0.15, s })
  }
  return out
}
for (const skin of ['edgerunners-2', 'capricorn']) {
  for (const W of [750, 900, 1250]) {
    test(`band ${skin} at ${W}: no two texts overlap, the readouts stay`, async ($, on) => {
      base(on, findAt(null, 96), { ctx: 96 })
      await start($, skin)
      await job($)
      const svg = (await svgs($, 'AbovePrompt', W)).join('')
      expect(svg).toContain('Red-herring audit')
      expect(svg).toMatch(/>(CTX|CONTEXT)</)
      const bs = boxes(svg)
      const hits: string[] = []
      for (let i = 0; i < bs.length; i++)
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i] as Box
          const b = bs[j] as Box
          if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 3) hits.push(`${a.s} / ${b.s}`)
        }
      expect(hits).toEqual([])
    })
  }
}

test('sizes: the band and the pane with a takeover stay under the limits', async ($, on) => {
  for (const kind of ['takeover']) {
    base(on, findAt(kind, 96), { ctx: 96 })
    await start($, 'edgerunners-2')
    await job($)
    const band = (await svgs($, 'AbovePrompt', 1250)).join('')
    expect(band.length).toBeLessThan(120_000)
    const all = await svgs($, 'Pane')
    for (const s of all) expect(s.length).toBeLessThan(131_072)
    expect(all.join('').length).toBeLessThan(220_000)
  }
})

test('sprites: rectangular, every letter in the palette, Capri has hair, eyes and lightning classes, Roman is a kid', () => {
  const names = ['ER_D', 'ER_ROMAN', 'ER_TALIA', 'ER_WEAK', 'ER_JESSIE', 'ER_SAL', 'ER_EMILY', 'ER_MESHUGA', 'ER_MIGUEL', 'ER_RUNNER', 'ER_RUNNER2', 'ER_RUNNER3', 'ER_CAPRI', 'ER_CAPRI_BUST', 'ER_CAPRI_BIG'] as const
  for (const n of names) {
    const sp = (cast as unknown as Record<string, cast.Sprite>)[n] as cast.Sprite
    const w = (sp.rows[0] as string).length
    for (const r of sp.rows) expect(r.length).toBe(w)
    for (const ch of new Set(sp.rows.join('').replace(/\./g, ''))) expect(ch === 't' || ch in sp.pal).toBe(true)
  }
  for (const n of ['ER_CAPRI', 'ER_CAPRI_BUST', 'ER_CAPRI_BIG'] as const) expect(Object.values((cast[n] as cast.Sprite).cls ?? {}).sort()).toEqual(expect.arrayContaining(['hair', 'led', 'vis']))
  expect(cast.ER_CAPRI.float).toBe(true)
  expect(cast.ER_ROMAN.rows.length).toBe(36)
  expect(CASTS.edgerunners2?.bossName).toBe('D')
  expect(CASTS.edgerunners2?.boss).toBe(cast.ER_D)
  expect(CASTS.capricorn?.boss).toBe(cast.ER_CAPRI)
  expect(CASTS.edgerunners2?.crew).toHaveLength(3)
  for (const role of ['explore', 'fable', 'heavy', 'careful', 'medium', 'light', 'artist', 'writer', 'banker', 'other']) expect(CASTS.edgerunners2?.roles[role]).toBeDefined()
  expect(er2RankOf(1)).toBe('NO SIGNAL')
  expect(er2RankOf(20)).toBe('0+2=1')
})

test('sizes: the band with a walking Capri stays under the limit', async ($, on) => {
  base(on, findAt('walk', 96), { ctx: 96 })
  await start($, 'edgerunners-2')
  await job($)
  expect((await svgs($, 'AbovePrompt', 1250)).join('').length).toBeLessThan(120_000)
})
