import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { CASTS } from './cast'
import * as cast from './cast'
import { CAPRICORN_RE, CAPRI_WORD_RE, ER2_CSS, ER2_EPISODES, TK_CSS, er2EpisodeAt, er2Takeover, er2W, mw } from './edgerunners2'
import { CARD_BUDGET, CARD_CSS, ER2_BADGES, er2RankOf, gigsCard, syncCard, syncPct, traceCard } from './edgerunners2-cards'
import { BLANK_CRED, levelOf } from './extras'
import type { Beat } from './extras'
import { HACK_AHEAD_MS, HACK_CSS, HACK_MIN_GAP_S, LINE_MAX_S, er2Hack, hackChance, hackLive, hackPlan } from './edgerunners2-hack'
import type { HackCard, HackSurface } from './edgerunners2-hack'
import { roamOptsOf, roamOverlay } from './overlay'
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

let clockRef: ReturnType<typeof mock.clock> | undefined
const base = (on: On, now: number, o: { ctx?: number; addon?: boolean } = {}) => {
  clockRef = mock.clock(on, { now })
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
    // From 95% she lets herself in (CAPRI mode); sent back to D at 96% the possessed D HUD (CAPRI'S AWAKE) shows.
    if (ctx >= 95) await $.prompt.submit({ text: 'bye capri', cursor: 0 } as never)
    await job($)
    await clockRef?.advance(3000)
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
test('modes: the whole word "capri" (any case) in a prompt lets her in; "capricorn" or a longer word does not; the prompt is unchanged', async ($, on) => {
  base(on, findAt(null, 10))
  await start($, 'edgerunners-2')
  for (const word of ['please capricorn the module', 'capriccio in C', 'scapring along']) {
    const back = (await $.prompt.submit({ text: word, cursor: 0 } as never)) as { text?: string }
    expect(back.text).toBe(word)
    expect((await svgs($, 'AbovePrompt')).join('')).not.toContain('CAPRI IN CONTROL')
  }
  expect(CAPRI_WORD_RE.test('Hi, Capri!')).toBe(true)
  expect(CAPRI_WORD_RE.test('capricorn')).toBe(false)
  const back = (await $.prompt.submit({ text: 'Say HI to CAPRI!', cursor: 0 } as never)) as { text?: string }
  expect(back.text).toBe('Say HI to CAPRI!')
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('CAPRI IN CONTROL')
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
      await clockRef?.advance(3000) // past the possession transition (its reduced-motion note covers the readouts for 2.5 s)
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

// --- Capri's red hack lines ----------------------------------------------------------------------------------
const roamerOf = (sec: boolean) => (sec ? THEMES.capricorn : th).roamer as NonNullable<typeof th.roamer>
const hackPlanAt = (t: number, ctx: number, sec = false) => {
  const r = roamerOf(sec)
  return hackPlan(`${r.seed}|hack`, t, ctx, sec, roamPlan(r.seed, t, roamOptsOf(r, ctx)))
}
/** A moment when the first line for `surface` (on `card`, for a pane) is mid-draw; with `none`, a moment with no event and no roamer. */
const hackAt = (ctx: number, o: { surface?: HackSurface; card?: HackCard; sec?: boolean; none?: boolean; from?: number } = {}): number => {
  const from = o.from ?? BASE
  for (let t = from; t < from + 86_400_000 * 3; t += 30_000) {
    const p = hackPlanAt(t, ctx, o.sec)
    if (o.none) {
      // quiet: no roamer now, and no event under way or starting within the look-ahead
      let quiet = !roamPlan(roamerOf(Boolean(o.sec)).seed, t, roamOptsOf(roamerOf(Boolean(o.sec)), ctx)).on
      for (let k = 0; k <= Math.ceil(HACK_AHEAD_MS / 30_000) + 1; k++) if (hackPlanAt(t + k * 30_000, ctx, o.sec).on) quiet = false
      if (quiet && !p.on) return t + 1000
      continue
    }
    if (!p.on || (o.surface === 'pane' && p.paneCard !== (o.card ?? 'cred'))) continue
    const l = p.lines.find(x => x.on === (o.surface ?? 'band'))
    if (l) return p.startAt + Math.round(l.t * 1000) + 500
  }
  throw new Error('no hack event')
}
const hackArgs = (at: number, W: number, H: number, surface: HackSurface, card: HackCard, ctx = 96, sec = false) => ({ W, H, surface, card, at, ctxPct: ctx, roam: roamPlan(roamerOf(sec).seed, at, roamOptsOf(roamerOf(sec), ctx)) })
const spawnAgent = ($: Engine, i: number) => $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)

test('hack lines: the plan is a pure function of the seed and the clock, and a redraw resumes the same lines', () => {
  const p = hackPlanAt(BASE, 96)
  expect(hackPlanAt(BASE + 7000, 96)).toEqual(p) // anywhere in the 30 s window
  expect(hackPlanAt(BASE, 96)).toEqual(p)
  expect(p.on).toBe(true)
  expect(p.startAt).toBe(1792490406936)
  expect(p.lines.map(l => `${l.on}@${l.t}`)).toEqual(['band@0', 'pane@0.38', 'band@0.76', 'band@1.14', 'band@1.51'])
  expect(p.burst).toBe(true)
  expect(p.paneCard).toBe('log')
  const a = er2Hack(roamerOf(false).seed, hackArgs(p.startAt + 600, 750, 132, 'band', 'cred'), false)
  const b = er2Hack(roamerOf(false).seed, hackArgs(p.startAt + 1100, 750, 132, 'band', 'cred'), false)
  expect(a).toContain('class="hk-d"')
  expect(a).toContain('class="hk-h"')
  expect(a).toContain('class="hk-g"')
  expect(a).toContain('@@T') // pinned to the wall clock
  expect(b).toBe(a) // later in the event: the same picture, further along (the pins resolve it)
  expect(er2Hack(roamerOf(false).seed, hackArgs(p.startAt - 1, 750, 132, 'band', 'cred'), false)).toContain('hk-d') // scheduled ahead
  expect(er2Hack(roamerOf(false).seed, hackArgs(p.startAt - HACK_AHEAD_MS - 1, 750, 132, 'band', 'cred'), false)).not.toContain(`@@T${p.startAt}@@`) // too far ahead for this draw
  expect(hackLive(p, p.startAt + 1)).toBe(true)
  expect(hackLive(p, p.endAt)).toBe(false)
  // The pane card: only the one the event names, and none for a celebration.
  expect(er2Hack(roamerOf(false).seed, hackArgs(p.startAt + 900, 480, 210, 'pane', 'cred'), false)).not.toContain(`@@T${p.startAt + Math.round((p.lines.find(l => l.on === 'pane') as { t: number }).t * 1000)}@@`)
  expect(er2Hack(roamerOf(false).seed, hackArgs(p.startAt + 900, 480, 210, 'pane', 'log'), false)).toContain('hk-d')
  expect(er2Hack(roamerOf(false).seed, { ...hackArgs(p.startAt + 900, 480, 210, 'pane', 'log'), party: true }, false)).toBe('')
  expect(er2Hack(roamerOf(false).seed, { ...hackArgs(p.startAt + 600, 750, 132, 'band', 'cred'), party: true }, false)).toBe('')
})


/** The pins in a fragment, as seconds from a draw made at `at` (what `phased` resolves them to). */
const delaysOf = (frag: string, at: number): number[] => [...frag.matchAll(/@@T(-?\d+)@@/g)].map(m => (Number(m[1]) - at) / 1000)
const bandFrag = (seed: string, at: number, ctx = 30, sec = false) => er2Hack(seed, hackArgs(at, 900, 132, 'band', 'cred', ctx, sec), sec)
/** The first event (from BASE) that has at least one band line, with the idle draw time T that is `lead` ms before its start. */
const eventAhead = (ctx: number, lead: number, from = BASE) => {
  for (let t = from; t < from + 86_400_000; t += 30_000) {
    const p = hackPlanAt(t, ctx)
    if (p.on && p.lines.some(l => l.on === 'band') && !roamPlan(roamerOf(false).seed, p.startAt - lead, roamOptsOf(roamerOf(false), ctx)).on) return { p, T: p.startAt - lead }
  }
  throw new Error('no event')
}
test('hack lines: an idle draw schedules the lines of an event that starts 40 s later, with a positive delay at its start', () => {
  const { p, T } = eventAhead(30, 40_000)
  const frag = bandFrag(roamerOf(false).seed, T)
  expect(frag).toContain('class="hk-d"')
  const first = p.lines.find(l => l.on === 'band') as { t: number }
  const want = (p.startAt + Math.round(first.t * 1000) - T) / 1000
  expect(want).toBeGreaterThan(30)
  expect(delaysOf(frag, T)).toContain(want)
  for (const d of delaysOf(frag, T).filter(x => x > 0)) expect(d).toBeLessThanOrEqual(HACK_AHEAD_MS / 1000 + 6)
  // pane: the card the event names carries it, the other none of this event
  const pane = (card: HackCard) => er2Hack(roamerOf(false).seed, hackArgs(T, 480, 210, 'pane', card, 30), false)
  expect(pane(p.paneCard).length).toBeGreaterThan(0)
})
test('hack lines: a finished event draws nothing; one under way resumes with a negative delay', () => {
  const { p } = eventAhead(30, 0)
  const seed = roamerOf(false).seed
  const lines = p.lines.filter(l => l.on === 'band')
  const quiet = hackAt(30, { none: true, from: p.endAt + 120_000 })
  expect(er2Hack(seed, hackArgs(quiet, 900, 132, 'band', 'cred', 30), false)).toBe('')
  // just after the last line has faded (and before the next window's event, if any, is within reach): this event is gone
  const done = p.startAt + Math.round((lines[lines.length - 1] as { t: number }).t * 1000) + LINE_MAX_S * 1000 + 1
  const f = bandFrag(seed, done)
  for (const l of lines) expect(delaysOf(f, done)).not.toContain((p.startAt + Math.round(l.t * 1000) - done) / 1000)
  // under way: the second band line has begun, the first is part-way: its pin is behind the draw
  const mid = p.startAt + Math.round((lines[0] as { t: number }).t * 1000) + 700
  const g = bandFrag(seed, mid)
  expect(delaysOf(g, mid).some(d => d < 0)).toBe(true)
  expect(delaysOf(g, mid).every(d => d > -LINE_MAX_S)).toBe(true)
})
test('hack lines: a draw carries at most three events that have not begun, and stays under the size budget', () => {
  const seed = roamerOf(true).seed
  let most = 0
  for (let t = BASE; t < BASE + 6 * 3_600_000; t += 30_000) {
    const f = er2Hack(seed, hackArgs(t, 1250, 132, 'band', 'cred', 96, true), true)
    const buckets = new Set(delaysOf(f, t).filter(d => d > 0).map(d => Math.floor((t + d * 1000) / 30_000)))
    most = Math.max(most, buckets.size)
    expect(buckets.size).toBeLessThanOrEqual(3)
    expect(f.length).toBeLessThan(16_000)
  }
  expect(most).toBe(3)
})

test('hack lines: drawn on both panels while wearing edgerunners-2, on one pane card only, and none at a quiet moment', async ($, on) => {
  const t = hackAt(96, { surface: 'pane', card: 'cred' })
  base(on, t, { ctx: 96 })
  await start($, 'edgerunners-2')
  await job($)
  const band = (await svgs($, 'AbovePrompt')).join('')
  const pane = await svgs($, 'Pane')
  expect(band).toContain('class="hk-d"')
  expect(band).toContain('prefers-reduced-motion')
  expect(pane.some(s => s.includes('class="hk-d"') && s.includes('NEURAL SYNC'))).toBe(true) // the card the live event names carries the lines
})
test('hack lines: the other pane card gets them when the event names it', async ($, on) => {
  const t = hackAt(96, { surface: 'pane', card: 'log' })
  base(on, t, { ctx: 96 })
  await start($, 'edgerunners-2')
  await job($)
  const pane = await svgs($, 'Pane')
  expect(pane.some(s => s.includes('class="hk-d"') && s.includes('NETRUN TRACE'))).toBe(true)
})
test('hack lines: CAPRICORN has them too', async ($, on) => {
  const t = hackAt(10, { sec: true })
  base(on, t, { ctx: 10 })
  await start($, 'capricorn')
  await job($)
  expect((await svgs($, 'AbovePrompt')).join('')).toContain('class="hk-d"')
})
test('hack lines: none at a moment with no event', async ($, on) => {
  base(on, hackAt(10, { none: true }), { ctx: 10 })
  await start($, 'edgerunners-2')
  await job($)
  expect((await svgs($, 'AbovePrompt')).join('')).not.toContain('hk-')
  expect((await svgs($, 'Pane')).join('')).not.toContain('hk-')
})
for (const skin of ['breaking-bad', 'heisenberg']) {
  test(`hack lines: none on ${skin}, even at an edgerunners-2 event`, async ($, on) => {
    base(on, hackAt(96, { surface: 'pane', card: 'cred' }), { ctx: 96 })
    await start($, skin)
    await job($)
    expect((await svgs($, 'AbovePrompt')).join('')).not.toContain('hk-d')
    expect((await svgs($, 'Pane')).join('')).not.toContain('hk-d')
  })
}
test('hack lines: only the edgerunners-2 skins have them', () => {
  for (const [k, theme] of Object.entries(THEMES)) expect([k, Boolean(theme.roamer?.hack)]).toEqual([k, k === 'edgerunners2' || k === 'capricorn'])
})
test('hack lines: never while the celebration draws', () => {
  const t = hackAt(96)
  const r = roamerOf(false)
  const args = { W: 750, H: 132, surface: 'band' as const, at: t, ctxPct: 96 }
  expect(roamOverlay(th, args)).toContain('hk-d')
  expect(roamOverlay(th, { ...args, party: true })).not.toContain('hk-')
  expect(r.hack?.({ ...hackArgs(t, 750, 132, 'band', 'cred'), party: true })).toBe('')
})

test('hack lines: rare at a normal context, more often from 85%, most at 95%, in both skins', () => {
  const hour = (ctx: number, sec: boolean) => {
    let events = 0
    let lines = 0
    for (let t = BASE; t < BASE + 3_600_000; t += 30_000) {
      const p = hackPlanAt(t, ctx, sec)
      if (p.on) {
        events++
        lines += p.lines.length
      }
    }
    return { events, lines }
  }
  const n30 = hour(30, false)
  const n88 = hour(88, false)
  const n96 = hour(96, false)
  expect(n96.events).toBeGreaterThan(n30.events)
  expect(n96.events).toBeGreaterThan(n88.events)
  expect(n88.events).toBeGreaterThan(n30.events)
  expect(n30.events).toBeGreaterThanOrEqual(40) // about one a minute at a normal context
  expect(n30.events).toBeLessThanOrEqual(75)
  expect(n88.events).toBeGreaterThanOrEqual(70)
  expect(n96.events).toBeGreaterThanOrEqual(95) // nearly every window
  expect(hour(96, true).events).toBeGreaterThan(hour(30, true).events)
  expect(hour(30, true).events).toBeGreaterThan(hour(30, false).events) // she owns the secret skin
  // 2 to 5 lines; a burst of five from 95%.
  for (let t = BASE; t < BASE + 86_400_000; t += 30_000) {
    for (const ctx of [30, 88, 96]) {
      const p = hackPlanAt(t, ctx)
      if (p.on) {
        expect(p.lines.length).toBeGreaterThanOrEqual(2)
        expect(p.lines.length).toBeLessThanOrEqual(5)
        expect(p.lines.some(l => l.on === 'band')).toBe(true)
        expect(p.lines.some(l => l.on === 'pane')).toBe(true)
        if (ctx >= 95) expect(p.lines.length).toBe(5)
      }
    }
  }
  expect(hackChance(10, false, 'takeover')).toBe(1)
  expect(hackChance(10, false, 'walk')).toBeGreaterThan(hackChance(10, false, null))
})
test('hack lines: more often while she walks, peeks or sits, and always in a takeover', () => {
  const r = roamerOf(false)
  let out = 0
  let outHack = 0
  let inRoam = 0
  let inHack = 0
  let tk = 0
  let tkHack = 0
  for (let t = BASE; t < BASE + 86_400_000 * 2; t += 30_000) {
    const roam = roamPlan(r.seed, t, roamOptsOf(r, 30))
    const p = hackPlanAt(t, 30)
    if (roam.kind === 'takeover') {
      tk++
      if (p.on) tkHack++
    } else if (roam.on) {
      inRoam++
      if (p.on) inHack++
    } else {
      out++
      if (p.on) outHack++
    }
  }
  expect(tk).toBeGreaterThan(0)
  expect(tkHack).toBe(tk)
  expect(inHack / inRoam).toBeGreaterThan((outHack / out) * 1.4)
})
test('hack lines: never more than 3 lines start in any second, nor at once in two events', () => {
  const starts: number[] = []
  for (const sec of [false, true])
    for (const ctx of [10, 88, 96])
      for (let t = BASE; t < BASE + 8 * 3_600_000; t += 30_000) {
        const p = hackPlanAt(t, ctx, sec)
        if (!p.on) continue
        for (const l of p.lines) starts.push(p.startAt + Math.round(l.t * 1000))
        expect(p.startAt).toBeGreaterThanOrEqual(Math.floor(t / 30_000) * 30_000)
        expect(p.startAt + (p.lines[p.lines.length - 1] as { t: number }).t * 1000).toBeLessThan(Math.floor(t / 30_000) * 30_000 + 30_000) // the whole volley starts inside its window
        for (let i = 1; i < p.lines.length; i++) expect((p.lines[i] as { t: number }).t - (p.lines[i - 1] as { t: number }).t).toBeGreaterThanOrEqual(HACK_MIN_GAP_S)
      }
  for (const [name, ctx, sec] of [['normal', 10, false], ['hot', 88, false], ['awake', 96, false], ['capricorn', 10, true]] as const) {
    const one: number[] = []
    for (let t = BASE; t < BASE + 12 * 3_600_000; t += 30_000) {
      const p = hackPlanAt(t, ctx, sec)
      if (p.on) for (const l of p.lines) one.push(p.startAt + Math.round(l.t * 1000))
    }
    one.sort((a, b) => a - b)
    for (let i = 3; i < one.length; i++) expect([name, (one[i] as number) - (one[i - 3] as number) >= 1000]).toEqual([name, true])
  }
  expect(starts.length).toBeGreaterThan(1000)
})

test('hack lines: reduced motion hides every line and covers every new class', () => {
  const [main, ...rest] = HACK_CSS.split('@media (prefers-reduced-motion: reduce)')
  expect(rest.length).toBe(1)
  const reduced = rest.join('')
  const animated = [...(main as string).matchAll(/\.([\w-]+)\{[^}]*animation:/g)].map(m => m[1] as string)
  expect(animated.sort()).toEqual(['hk-d', 'hk-g', 'hk-h'])
  for (const c of animated) expect(reduced).toContain(`.${c}`)
  expect(reduced).toContain('.hk{display:none}') // the lines' group: nothing shows
  const t = hackAt(96)
  const frag = er2Hack(roamerOf(false).seed, hackArgs(t, 750, 132, 'band', 'cred'), false)
  expect(frag).toContain('class="hk"')
  for (const m of frag.matchAll(/class="(hk[\w-]*)"/g)) expect(['hk', ...animated]).toContain(m[1])
  expect(frag).toContain(HACK_CSS)
})

test('hack lines: a draw (the live event and up to three ahead) is under 16 kB on every panel, at every width', () => {
  let max = 0
  for (const sec of [false, true])
    for (let t = BASE; t < BASE + 3 * 3_600_000; t += 30_000) {
      const p = hackPlanAt(t, 96, sec)
      if (!p.on) continue
      for (const [W, H, surface] of [[750, 132, 'band'], [900, 132, 'band'], [1250, 132, 'band'], [360, 140, 'pane'], [480, 210, 'pane'], [560, 300, 'pane'], [992, 388, 'pane'], [992, 214, 'pane']] as const)
        for (const card of ['cred', 'log'] as const) {
          const frag = er2Hack(roamerOf(sec).seed, hackArgs(p.startAt + 100, W, H, surface, card, 96, sec), sec)
          max = Math.max(max, frag.length)
          expect(frag.length).toBeLessThan(16_384)
        }
    }
  expect(max).toBeGreaterThan(1500) // the sweep really drew fragments
})

for (const ctx of [30, 96]) {
  test(`hack lines: add little at ${ctx}%: the band and every pane Svg stay well under the limit, the pane total under the budget (4 agents)`, async ($, on) => {
    const t = hackAt(ctx, { surface: 'pane', card: 'cred' })
    base(on, t, { ctx })
    await start($, 'edgerunners-2')
    await job($)
    for (let i = 1; i <= 4; i++) await spawnAgent($, i)
    const panes = await svgs($, 'Pane')
    const band = (await svgs($, 'AbovePrompt', 1250)).join('')
    expect(band).toContain('hk-d')
    const hk = /<style>\.hk-d[\s\S]*?<\/g>/g
    const added = panes.filter(s => s.includes('hk-d')).map(s => s.length - s.replace(hk, '').length)
    expect(added.length).toBeGreaterThanOrEqual(1)
    const bandAdded = band.length - band.replace(hk, '').length
    const total = panes.join('').length
    expect(bandAdded).toBeGreaterThan(0)
    expect(bandAdded).toBeLessThan(16_384)
    for (const a of added) expect(a).toBeLessThan(16_384)
    expect(band.length).toBeLessThan(70_000)
    for (const s of panes) expect(s.length).toBeLessThan(60_000)
    expect(total).toBeLessThan(260_000)
  })
}
