import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { CASTS } from './cast'
import * as cast from './cast'
import { CAPRICORN_RE, ER2_CSS, ER2_EPISODES, HI_CAPRI_RE, TK_CSS, er2EpisodeAt, er2Takeover, er2W, mw } from './edgerunners2'
import { CARD_BUDGET, CARD_CSS, ER2_BADGES, er2RankOf, gigsCard, syncCard, syncPct, traceCard } from './edgerunners2-cards'
import { BLANK_CRED, levelOf } from './extras'
import type { Beat } from './extras'
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
const TORN_PAPER = ['BIOCHIP', "ROMAN'S TAPE", 'WATSON WALL']
const OTHERS = ['COLD READ', 'CBI CRED', 'CASE BOARD', 'PERIODIC TABLE', 'ON AIR', 'CLASSROOM', 'PURITY', 'HONOR ROLL']

test('edgerunners-2: NEURAL SYNC, NETRUN TRACE, CLOSED GIGS, the LINKED boot, the episode; no season-1, torn-paper or other-skin words', async ($, on) => {
  const now = findAt(null, 10)
  base(on, now)
  await start($, 'edgerunners-2')
  await job($)
  const paneSvg = (await svgs($, 'Pane')).join('')
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  for (const w of ['NEURAL SYNC', 'NETRUN TRACE', 'CLOSED GIGS', 'NO SIGNAL', 'ENGRAM FRAGMENTS', 'LINKING · handshake with D', 'LINKED · No signal, no survival.', 'SYNC 0%', 'NO ENGRAM']) expect(paneSvg).toContain(w)
  for (const w of ['MISSION CONTROL', 'SNAKE NATION', er2EpisodeAt(now).split(' ').slice(2).join(' ')]) expect(bandSvg).toContain(w)
  expect(bandSvg).toContain(er2EpisodeAt(now).slice(0, 5))
  for (const w of [...SEASON1, ...TORN_PAPER, ...OTHERS]) {
    expect(paneSvg).not.toContain(w)
    expect(bandSvg).not.toContain(w)
  }
  expect(bandSvg).not.toContain('CHIP HOT')
  expect(bandSvg).toContain('LINK') // the hex stream
  expect(ER2_EPISODES).toHaveLength(10)
  expect(er2EpisodeAt(2 * 3_600_000)).toBe('EP 03 0+2=1')
})

for (const [ctx, word, other] of [[88, 'CHIP HOT', "CAPRI'S AWAKE"], [96, "CAPRI'S AWAKE", 'CHIP HOT']] as const) {
  test(`edgerunners-2 at ${ctx}%: ${word}${ctx >= 95 ? ' and the possessed HUD' : ''}`, async ($, on) => {
    base(on, findAt(null, ctx), { ctx })
    await start($, 'edgerunners-2')
    await job($)
    const bandSvg = (await svgs($, 'AbovePrompt')).join('')
    expect(bandSvg).toContain(word)
    expect(bandSvg).not.toContain(other)
    if (ctx >= 95) {
      expect(bandSvg).toContain('class="v2-streak"') // pixel-sort streaks in the margins
      expect(bandSvg).toContain('class="v2-chrom"') // the chromatic split on the name chip
      expect(bandSvg).toContain('class="v2-psy"') // the chip jitters
      expect(bandSvg).toContain('#FF2E7E') // her colours
    } else {
      expect(bandSvg).not.toContain('class="v2-streak"')
      expect(bandSvg).not.toContain('class="v2-chrom"')
    }
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
    if (kind === 'walk') expect(bandSvg).toContain('class="v2-streak"') // her holo framing: the possessed HUD and her slices
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

test('takeover: both panels, the reticle, the typed dialogue; "hi, choom." among her lines, at most once per 30 min', async ($, on) => {
  const t0 = findAt('takeover', 10)
  base(on, t0)
  await start($, 'edgerunners-2')
  await job($)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  const paneSvg = (await svgs($, 'Pane')).join('')
  const line = roamPlan(roamer.seed, t0, roamOptsOf(roamer, 10)).line
  for (const s of [bandSvg, paneSvg]) {
    for (const c of ['tk-anim', 'tk-field', 'tk-ret', 'tk-bar', 'tk-ty', 'tk-off', 'tk-still']) expect(s).toContain(c)
    expect(s).toContain(`>${line}</text>`) // the dialogue
  }
  expect(paneSvg).toContain('CAPRI · PERSONALITY CONSTRUCT')
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
  for (const css of [ER2_CSS, TK_CSS, CARD_CSS]) {
    const [main, ...rest] = css.split('@media (prefers-reduced-motion: reduce)')
    expect(rest.length).toBe(1)
    const reduced = rest.join('')
    for (const m of (main as string).matchAll(/\.([\w-]+)\{animation:/g)) expect(reduced).toContain(`.${m[1]}`)
  }
  expect(TK_CSS).toContain('.tk-anim{display:none}')
  expect(TK_CSS).toContain('.tk-still{display:block')
})

test('capri is only ever her pixel sprites: the bust and the big one are crisp pixel paths in her palette', () => {
  const cred = { ...BLANK_CRED, xp: 10500, jobs: 60, badges: ['choom', 'merc', 'edgerunner'] }
  const card = syncCard(480, cred, false)
  expect(card).toContain('shape-rendering="crispEdges"')
  for (const col of ['#FB1667', '#0CF878', '#F1F1F1']) expect(card).toContain(col) // ER_CAPRI_BUST's pink, green and white
  const tk = er2Takeover(480, 560, 'hi, choom.', { delay: '0s' }, false)
  expect(tk).toContain('shape-rendering="crispEdges"')
  for (const col of new Set(Object.values(cast.ER_CAPRI_BIG.pal))) if (cast.ER_CAPRI_BIG.rows.join('').includes([...Object.entries(cast.ER_CAPRI_BIG.pal)].find(([, v]) => v === col)?.[0] as string)) expect(tk.toUpperCase()).toContain(col.toUpperCase())
  expect(cast.ER_CAPRI_BIG.rim).toBe(false)
  // No vector figure: the only <circle>/<ellipse> are rings, brackets and her eye icon, never filled with her palette.
  for (const m of tk.matchAll(/<(circle|ellipse)[^>]*>/g)) expect(m[0]).not.toMatch(/fill="#(FB1667|EF1867|DA195F)"/i)
})

test('NEURAL SYNC: SYNC % is the share of the next level (levels 1, 4 and 21), and the capsule resolves eyes-first', () => {
  const at = (xp: number) => syncCard(480, { ...BLANK_CRED, xp }, false)
  expect(syncPct(0)).toBe(0)
  expect(at(0)).toContain('SYNC 0%')
  expect(levelOf(420)).toBe(4)
  expect(syncPct(420)).toBe(84)
  expect(at(420)).toContain('SYNC 84%')
  expect(at(420)).toContain('420 / 500 XP')
  expect(levelOf(10500)).toBe(21)
  expect(syncPct(10500)).toBe(91)
  expect(at(10500)).toContain('SYNC 91%')
  expect(at(10500)).toContain('10500 / 11550 XP')
  expect(at(10500)).toContain('v.21')
  const some = syncCard(480, { ...BLANK_CRED, xp: 420, badges: ['choom', 'merc', 'edgerunner', 'legend', 'netrunner'] }, false)
  expect(some).toContain('5 of 9')
  expect(some).toContain('56%')
  expect(some).not.toContain('NO ENGRAM')
  expect(syncCard(480, { ...BLANK_CRED, badges: ER2_BADGES.map(b => b.id) }, false)).toContain('Every fragment recovered')
})

const beatsOf = (n: number): Beat[] => Array.from({ length: n }, (_, i) => ({ at: 1_000_000 + i * 4000, tool: ['Read', 'Edit', 'Bash', 'Agent', 'Grep'][i % 5] as string, text: `parser.test.ts step ${i}`, who: 'Engineer' }))
test('NETRUN TRACE: four lanes, the REC viewfinder, and the pick controls state', () => {
  const live = traceCard(560, beatsOf(12), -1, false)
  for (const w of ['PROBE', 'WRITE', 'LINK', 'SYS', 'REC', 'NODE 12/12', 'first', '12 nodes · live']) expect(live).toContain(w)
  const replay = traceCard(560, beatsOf(16), 7, false)
  for (const w of ['PLAY', 'NODE 08/16', 'last 12 shown', 'node 08']) expect(replay).toContain(w)
  expect(traceCard(560, [], -1, false)).toContain('standing by')
  expect(THEMES.edgerunners2.log.hasControls).toBe(true)
})

test('card sizes: each ER2 card is lean (25 kB), and the whole pane with a takeover stays far under the pane budget', async ($, on) => {
  const full = { ...BLANK_CRED, xp: 10500, jobs: 60, longJobs: 12, agents: 120, badges: ER2_BADGES.slice(0, 6).map(b => b.id) }
  for (const sec of [false, true]) {
    for (const W of [360, 480, 560]) {
      for (const c of [BLANK_CRED, full]) expect(syncCard(W, c, sec).length).toBeLessThan(CARD_BUDGET)
      expect(traceCard(W, beatsOf(40), -1, sec).length).toBeLessThan(CARD_BUDGET)
      expect(traceCard(W, beatsOf(12), 3, sec).length).toBeLessThan(CARD_BUDGET)
      expect(gigsCard(W, Array.from({ length: 5 }, (_, i) => ({ task: `Gig number ${i}`, costUsd: i, at: 0, ms: i * 400_000 })), sec).length).toBeLessThan(CARD_BUDGET)
    }
  }
  base(on, findAt('takeover', 96), { ctx: 96 })
  await start($, 'edgerunners-2')
  await job($)
  const all = await svgs($, 'Pane')
  for (const s of all) expect(s.length).toBeLessThan(131_072)
  const total = all.join('').length
  expect(total).toBeLessThan(200_000)
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
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('PROJECT CAPRICORN')
  expect(toasts.join(' ').toLowerCase()).toContain("we're one now")
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
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('PROJECT CAPRICORN')
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
    if (/v2-chrom/.test(m[1] as string) || /fill-opacity="\.35"/.test(m[1] as string)) continue // the chromatic split sits on the name by design
    const ls = Number(at('letter-spacing') ?? 0)
    const width = /SF Mono/.test(m[1] as string) ? mw(s, size, ls) : er2W(s, size, ls, Number(at('font-weight') ?? 400))
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
