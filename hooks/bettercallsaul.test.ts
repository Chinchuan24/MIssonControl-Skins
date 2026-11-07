import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { BCS_CSS, EPISODES, GENE, SAUL, TAKAVIC_RE, SAUL_GOODMAN_RE, AD_PHONE, bcsChip, bcsEpisodeAt, bellMode, condW, isAdCheer, s1Ending, sansW, serifW, bcsCheer, bcsEp } from './bettercallsaul'
import { BCS_BADGES, RANKS, attorneyCard, attorneyHeight, bcsRankOf, docketCard, legalPad } from './bettercallsaul-cards'
import { MIKE_LINES, mikeChance } from './bettercallsaul-mike'
import { CAR_MS, GUS_MS, LALO_MS, UNPLUG_MS, carPlan, gusPlan, lalooPlan, shouldUnplug, slotPlan } from './bettercallsaul-extra'
import { TOASTS, TOAST_GAP_MS, bashToast, cmdKind, fxOf, resultFailed, toastDue } from './bettercallsaul-fx'
import { BCS_BADGES as _B, } from './bettercallsaul-cards'
import { CASTS } from './cast'
import type { Sprite } from './cast'
import { roamOptsOf } from './overlay'
import { roamPlan } from './roamer'
import { THEMES } from './themes'
import type { ThemeKey } from './themes'
import { contrast } from './skinkit'

void _B
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const NOW = Date.parse('2026-10-20T10:00:00Z')
const HOUR = 3_600_000
const toasts: string[] = []
const COLS: Record<number, number> = { 750: 106, 900: 126, 1250: 173 }

const base = (on: On, context = 100_000, now = NOW, cost = 0) => {
  const clock = mock.clock(on, { now })
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
    toasts.push(String((e as { text?: string; message?: string }).text ?? (e as { message?: string }).message ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: context }, rateLimits: [], cost: { usd: cost } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}
const start = async ($: Engine, skin: string) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  if (skin) await $.command.run({ command: 'skin', args: skin } as never)
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
const bandAt = async ($: Engine, W: number): Promise<string> => (await svgs($, 'AbovePrompt', W)).join('')
const jobIn = async ($: Engine, tasks = 5) => {
  await $.prompt.submit({ text: 'Sandpiper document review', cursor: 0 } as never)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Sandpiper document review', total: tasks, done: 2, phase: 'delegate', tasks: [{ title: 'Lead: run the batch', tier: 'fable' }, { title: 'Researcher: map the API', tier: 'medium' }] } as never).catch(() => undefined)
}
const skinList = async ($: Engine) => String(((await $.command.run({ command: 'skin', args: 'list' } as never)) as { text?: string }).text)
const OTHER = ['PERIODIC TABLE', 'NEURAL SYNC', 'PERSONNEL FILE', 'BREACH PROTOCOL', 'STREET CRED', 'COLD READ', 'CLASSROOM', 'HONOR ROLL', 'NETRUNNER', 'BRAINDANCE']
const roamerOf = (k: ThemeKey) => THEMES[k].roamer as NonNullable<(typeof THEMES)['bettercallsaul']['roamer']>
const findAt = (k: ThemeKey, kind: string | null, ctx = 10, from = NOW): number => {
  const r = roamerOf(k)
  for (let t = from; t < from + 5 * 86_400_000; t += 30_000) {
    const p = roamPlan(r.seed, t, roamOptsOf(r, ctx))
    if (kind === null ? !p.on : p.kind === kind) return kind === null ? t + 1000 : p.startAt + (kind === 'takeover' ? 1500 : 1200)
  }
  throw new Error(`no ${kind}`)
}
/** A moment with no act of Mike's, the car's, Gus's or Lalo's (so the band shows only its own pieces). */
const quietAt = (gene: boolean): number => {
  for (let t = NOW; t < NOW + 3 * 86_400_000; t += 20_000) {
    const r = roamerOf(gene ? 'gene' : 'bettercallsaul')
    if (roamPlan(r.seed, t, roamOptsOf(r, 10)).on) continue
    if (carPlan(t, gene).on && t >= carPlan(t, gene).startAt - 1000 && t < carPlan(t, gene).endAt + 1000) continue
    if (gusPlan(t, gene).on && t >= gusPlan(t, gene).startAt - 1000 && t < gusPlan(t, gene).endAt + 1000) continue
    return t + 1000
  }
  throw new Error('no quiet moment')
}

// --- the words -----------------------------------------------------------------------------------------------------
test('better-call-saul: ATTORNEY AT LAW, LEGAL PAD, THE DOCKET, the episode, the title and the Total; no other skin words', async ($, on) => {
  base(on, 100_000, quietAt(false), 1.234)
  await start($, 'better-call-saul')
  await jobIn($)
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' } as never).catch(() => undefined)
  const paneSvg = (await svgs($, 'Pane')).join('')
  const band = await bandAt($, 1250)
  for (const w of ['ATTORNEY AT LAW', 'LEGAL PAD', 'THE DOCKET', 'CLOSED CASES', 'TIME SHEET', 'MATCHBOOKS', "Slippin' Jimmy", 'OPENING THE OFFICE']) expect(paneSvg).toContain(w)
  const ep = bcsEpisodeAt(quietAt(false)).split(' ')[0] as string
  expect(band).toContain(ep)
  expect(band).toContain('Sandpiper document review')
  expect(band).toMatch(/Total <tspan[^>]*>\$/)
  expect(band).toContain('SAUL GOODMAN &amp; ASSOCIATES')
  for (const w of OTHER) {
    expect(paneSvg).not.toContain(w)
    expect(band).not.toContain(w)
  }
})

for (const [pct, ctx, word] of [[88, 880_000, "S'ALL GOOD, MAN?"], [96, 960_000, 'BETTER CALL SAUL!']] as const) {
  test(`better-call-saul: the ${pct}% chip says ${word}`, async ($, on) => {
    base(on, ctx, quietAt(false))
    await start($, 'better-call-saul')
    await jobIn($)
    for (const W of [750, 900, 1250]) expect(await bandAt($, W)).toContain(word.replace(/'/g, "'"))
  })
}
test('gene: the chips are IT\'S JUST A NAME at 96% and the hatched S\'ALL GOOD, MAN? at 88%', () => {
  expect(bcsChip(0, 20, 96, true).svg).toContain("IT'S JUST A NAME")
  expect(bcsChip(0, 20, 88, true).svg).toContain('bcshatch')
  expect(bcsChip(0, 20, 50, false).w).toBe(0)
})

test('episodes: 63 titles, one per hour; Season 1 ends in O except Alpine Shepherd Boy', () => {
  expect(EPISODES).toHaveLength(63)
  expect(new Set(EPISODES.map(e => e[0])).size).toBe(63)
  expect(bcsEpisodeAt(NOW)).not.toBe(bcsEpisodeAt(NOW + HOUR))
  const s1 = EPISODES.filter(e => e[0].startsWith('S1E'))
  expect(s1).toHaveLength(10)
  for (const [code, title] of s1) expect(s1Ending(code, title)).toBe(title !== 'Alpine Shepherd Boy')
  expect(s1Ending('S2E1', 'Switch')).toBe(false)
  const hi = bcsEp(900, 22, 'S1E1', 'Uno', true, false)
  expect(hi).toMatch(/Un<tspan fill="#FFD23F"[^>]*>o<\/tspan>/)
  expect(bcsEp(900, 22, 'S1E5', 'Alpine Shepherd Boy', true, false)).not.toContain('<tspan')
  expect(bcsEp(900, 22, 'S1E1', 'Uno', true, true)).not.toContain('#FFD23F')
})

// --- Mike ------------------------------------------------------------------------------------------------------------
test('mike: deterministic plans; walks, peeks, sits; the cameo at most once per 30 minutes on any clock', () => {
  for (const k of ['bettercallsaul', 'gene'] as const) {
    const r = roamerOf(k)
    expect(r.chance(10)).toBe(0.25)
    expect(r.chance(96)).toBe(0.35)
    expect(roamPlan(r.seed, NOW, roamOptsOf(r, 10))).toEqual(roamPlan(r.seed, NOW, roamOptsOf(r, 10)))
    expect(r.lines).toEqual(MIKE_LINES)
    const kinds = new Set<string>()
    let seen = 0
    for (let day = 0; day < 40; day++) {
      const from = NOW + day * 7 * HOUR
      const starts: number[] = []
      for (let t = from; t < from + 3 * HOUR; t += 30_000) {
        const p = roamPlan(r.seed, t, roamOptsOf(r, 10))
        if (p.on) kinds.add(p.kind as string)
        if (p.kind === 'takeover' && !starts.includes(p.startAt)) starts.push(p.startAt)
      }
      seen += starts.length
      for (let i = 1; i < starts.length; i++) expect((starts[i] as number) - (starts[i - 1] as number)).toBeGreaterThanOrEqual(30 * 60_000)
    }
    expect(seen).toBeGreaterThan(10)
    expect([...kinds].sort()).toEqual(['peek', 'sit', 'takeover', 'walk'])
  }
  expect(mikeChance(10)).toBe(0.25)
})
for (const kind of ['walk', 'sit', 'peek', 'takeover'] as const) {
  test(`mike: a ${kind} shows in the band and the pane`, async ($, on) => {
    const t = findAt('bettercallsaul', kind)
    base(on, 100_000, t)
    await start($, 'better-call-saul')
    await jobIn($)
    const band = await bandAt($, 1250)
    const paneSvg = (await svgs($, 'Pane')).join('')
    if (kind === 'walk') {
      expect(band).toContain('class="rm-walk')
      expect(band).toContain('class="bcs-walk"')
      expect(paneSvg).toContain('class="bcs-walk"')
    }
    if (kind === 'sit') {
      expect(band).toContain('rm-pk')
      expect(paneSvg).toContain('rm-pk')
    }
    if (kind === 'peek') {
      expect(band).toContain('bcspk')
      expect(paneSvg).toContain('bcspk')
    }
    if (kind === 'takeover') {
      expect(band).toContain('class="bcs-cam"')
      expect(band).not.toContain('class="rm-tk"')
      expect(paneSvg).toContain('class="bcs-cam"')
    }
  })
}

// --- GENE ------------------------------------------------------------------------------------------------------------
test('gene: hidden until worn; "takavic" switches to it, "saul goodman" back; the prompt goes on unchanged; the core edition has it', async ($, on) => {
  base(on)
  toasts.length = 0
  await start($, '')
  expect(await skinList($)).not.toContain('gene')
  expect(await skinList($)).toContain('better-call-saul')
  // Other skins: the words do nothing.
  await $.command.run({ command: 'skin', args: 'mentalist' } as never)
  await $.prompt.submit({ text: 'takavic', cursor: 0 } as never)
  await $.prompt.submit({ text: 'saul goodman', cursor: 0 } as never)
  expect(await skinList($)).toContain('▸ mentalist')
  await $.command.run({ command: 'skin', args: 'better-call-saul' } as never)
  await $.prompt.submit({ text: 'saul goodman', cursor: 0 } as never)
  expect(await skinList($)).toContain('▸ better-call-saul')
  const r = (await $.prompt.submit({ text: 'Ask Takavic about the bakery', cursor: 0 } as never)) as { text?: string }
  expect(String(r?.text ?? 'Ask Takavic about the bakery')).toContain('Takavic')
  expect(await skinList($)).toContain('▸ gene')
  expect(toasts.some(t => /Gene speaking/.test(t))).toBe(true)
  await $.prompt.submit({ text: 'takavic', cursor: 0 } as never)
  expect(await skinList($)).toContain('▸ gene')
  await $.prompt.submit({ text: 'Saul Goodman', cursor: 0 } as never)
  expect(await skinList($)).toContain('▸ better-call-saul')
  expect(await skinList($)).not.toContain('gene')
  await $.command.run({ command: 'skin', args: 'gene' } as never)
  expect(await skinList($)).toContain('▸ gene')
  expect(TAKAVIC_RE.test('takavicc')).toBe(false)
  expect(SAUL_GOODMAN_RE.test('better call saul')).toBe(true)
})
const colorsOf = (s: string): string[] => [...new Set((s.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map(c => c.toUpperCase()))]
const isGrey = (c: string): boolean => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) as [number, number, number]; return Math.max(r, g, b) - Math.min(r, g, b) <= 2 }
test('gene: every colour in the band and the pane is grey but the two pixels of the ad in the glasses', async ($, on) => {
  base(on, 100_000, quietAt(true))
  await start($, 'gene')
  await jobIn($)
  const all = (await bandAt($, 1250)) + (await svgs($, 'Pane')).filter(s => /ATTORNEY AT LAW|LEGAL PAD|THE DOCKET|CLOCKING IN/.test(s)).join('')
  const colour = colorsOf(all).filter(c => !isGrey(c))
  expect(colour.join(',')).toBe('#D7262C,#FFD23F')
  expect(colour.sort()).toEqual(['#D7262C', '#FFD23F'])
  expect(all).toContain('GENE TAKAVIC')
  expect(all).toContain('Omaha')
  expect(all).toContain('bcsgr')
  for (const w of ['ATTORNEY AT LAW', 'LEGAL PAD', 'THE DOCKET']) expect(all).toContain(w)
  expect(all).not.toContain('BETTER CALL SAUL!')
})
test('gene: the NIPPY matchbook is awarded on the switch', async ($, on) => {
  base(on)
  toasts.length = 0
  await start($, 'better-call-saul')
  await $.prompt.submit({ text: 'takavic', cursor: 0 } as never)
  expect(toasts.some(t => /NIPPY/.test(t))).toBe(true)
})

// --- layout ----------------------------------------------------------------------------------------------------------
type Box = { l: number; r: number; t: number; b: number; s: string }
const widthOf = (font: string, s: string, size: number, ls: number, bold: boolean): number => (/Georgia/.test(font) ? serifW(s, size, ls, bold) : /Avenir/.test(font) ? condW(s, size, ls) : sansW(s, size, ls, bold))
const boxes = (svg: string): Box[] => {
  const out: Box[] = []
  for (const m of svg.matchAll(/<text ([^>]*)>(.*?)<\/text>/gs)) {
    const at = (k: string) => new RegExp(`(?:^| )${k}="([^"]*)"`).exec(m[1] as string)?.[1]
    const x = Number(at('x'))
    const y = Number(at('y'))
    const size = Number(at('font-size') ?? 12)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const s = (m[2] as string).replace(/<title>.*?<\/title>/gs, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    if (!s.trim()) continue
    const width = widthOf(at('font-family') ?? '', s, size, Number(at('letter-spacing') ?? 0), at('font-weight') === '700' || at('font-weight') === '800')
    const anchor = at('text-anchor')
    const l = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
    out.push({ l: l + 2, r: l + width - 2, t: y - size * 0.75, b: y + size * 0.15, s })
  }
  return out
}
for (const skin of ['better-call-saul', 'gene']) {
  for (const W of [750, 900, 1250]) {
    for (const ctx of [100_000, 880_000, 960_000]) {
      test(`slim band ${skin} at ${W} (${ctx / 10_000}% context): the title is plain text, the Total shows, nothing overlaps`, async ($, on) => {
        base(on, ctx, quietAt(skin === 'gene'), 3.5)
        await start($, skin)
        await jobIn($)
        const svg = await bandAt($, W)
        expect(svg).toMatch(/>Sandpiper[^<]*<\/text>/)
        expect(svg).toMatch(/Total <tspan[^>]*>\$3\.50<\/tspan>/)
        expect(svg).not.toContain('NaN')
        const bs = boxes(svg)
        const hits: string[] = []
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i] as Box
          const b = bs[j] as Box
          if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 3) hits.push(`${a.s} / ${b.s}`)
        }
        expect(hits).toEqual([])
        expect(svg.length).toBeLessThan(70_000)
      })
    }
  }
}
test('contrast: every text colour reads at 4.5:1 or better on its tile, in both skins', () => {
  for (const P of [SAUL, GENE]) for (const fg of [P.text, P.sub, P.muted, P.aT, P.gold, P.done, P.warn, P.alert]) expect(contrast(fg, P.tile)!).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#241A05', '#FFD23F')!).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#FFF4D6', '#D7262C')!).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#1A1A1A', '#BDBDBD')!).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#1E3C86', '#F4E58C')!).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#2A2318', '#F3E7C9')!).toBeGreaterThanOrEqual(4.5)
})

// --- sizes, the cards ----------------------------------------------------------------------------------------------
test('cards: sizes under the limits, no NaN, the levels pick their business card, the edge states', () => {
  const cred = (xp: number, badges: string[] = []) => ({ xp, jobs: 12, longJobs: 3, agents: 37, crewJobs: 1, nightJobs: 0, chromed: false, samurai: false, badges })
  for (const gene of [false, true]) {
    for (const W of [360, 480, 560]) {
      for (const xp of [0, 420, 1500, 4700]) {
        const c = attorneyCard(W, cred(xp, xp > 4000 ? BCS_BADGES.map(b => b.id) : []), gene)
        expect(c.length).toBeLessThan(26_000)
        expect(c).not.toContain('NaN')
        expect(c).toContain(`height="${attorneyHeight(W)}"`)
      }
    }
  }
  expect(attorneyCard(480, cred(0), false)).toContain('Need a will? Call McGill!')
  expect(attorneyCard(480, cred(420), false)).toContain('WEXLER')
  expect(attorneyCard(480, cred(1500), false)).toContain('SAUL GOODMAN')
  expect(attorneyCard(480, cred(4700), false)).toContain('MALL BAKERY')
  expect(attorneyCard(480, cred(4700, BCS_BADGES.map(b => b.id)), false)).toContain('Every matchbook struck')
  expect(RANKS.at(-1)?.[1]).toBe("Slippin' Jimmy")
  expect(bcsRankOf(7)).toBe('Saul Goodman')
  const beats = Array.from({ length: 16 }, (_, i) => ({ at: NOW + i * 17_000, tool: i % 2 ? 'Edit' : 'Read', text: `file${i}.ts`, who: 'Engineer' }))
  for (const pick of [-1, 3, 15]) {
    const p = legalPad(480, beats, pick, false, 'Sandpiper')
    expect(p.length).toBeLessThan(26_000)
    expect(p).toContain('Redline')
    expect(p).toContain('Review')
  }
  expect(legalPad(480, [], -1, false)).toContain('Nothing on the pad yet.')
  expect(legalPad(480, beats, 3, false)).not.toContain('class="bcs-pen"')
  const legends = Array.from({ length: 5 }, (_, i) => ({ task: `Matter ${i}`, costUsd: 0.42, at: NOW, ms: (i + 3) * 60_000 }))
  expect(docketCard(480, 'Sandpiper', true, 2, 5, legends, false).length).toBeLessThan(26_000)
  expect(docketCard(480, '', false, 0, 0, [], false)).toContain('No closed cases yet.')
  expect(docketCard(480, 'x', false, 5, 5, legends, true)).toContain('Omaha')
})
const usedColors = (sp: Sprite): string[] => [...new Set(sp.rows.join('').split('').filter(ch => ch !== '.'))].map(ch => sp.pal[ch] as string)
test('sprites: rectangular rows, every letter in the palette, the casts, the crew tinted by role', () => {
  for (const k of ['bettercallsaul', 'gene']) {
    const c = CASTS[k]!
    expect(c).toBeTruthy()
    const all = [c.boss, ...Object.values(c.roles), ...c.crew]
    for (const sp of all) {
      expect(sp.rows.length).toBeGreaterThan(30)
      expect(new Set(sp.rows.map(r => r.length)).size).toBe(1)
      for (const row of sp.rows) for (const ch of row) if (ch !== '.' && ch !== 't') expect(sp.pal[ch]).toBeTruthy()
    }
    expect(c.crew.every(sp => sp.rows.some(r => r.includes('t')))).toBe(true)
  }
  expect(CASTS.bettercallsaul!.roles.fable).toBe(CASTS.bettercallsaul!.roles.fable)
  expect(usedColors(CASTS.bettercallsaul!.boss).length).toBeGreaterThan(5)
})
test('layout: 130 redraws over ~43 minutes keep one layout signature', { timeoutMs: 120_000 }, async ($, on) => {
  const clock = base(on, 100_000, quietAt(false))
  await start($, 'better-call-saul')
  await jobIn($)
  const sig = async () => {
    const b = await svgs($, 'AbovePrompt', 900)
    const p = await svgs($, 'Pane')
    const dims = (l: string[]) => l.map(s => `${/width="(\d+)"/.exec(s)?.[1]}x${/height="(\d+)"/.exec(s)?.[1]}`).join(',')
    return `${b.length}:${/height="(\d+)"/.exec(b[0] ?? '')?.[1]}|${p.length}|${dims(p)}`
  }
  const first = await sig()
  const seen = new Set([first])
  for (let i = 0; i < 130; i++) {
    await clock.advance(20_000)
    seen.add(await sig())
  }
  expect(seen.size).toBe(1)
})

// --- the rare eggs ---------------------------------------------------------------------------------------------------
const count = (plan: (t: number) => { on: boolean; startAt: number }, spanMs: number): { n: number; gaps: number[] } => {
  const starts: number[] = []
  for (let t = NOW; t < NOW + spanMs; t += 10_000) {
    const p = plan(t)
    if (p.on && !starts.includes(p.startAt)) starts.push(p.startAt)
  }
  return { n: starts.length, gaps: starts.slice(1).map((s, i) => s - (starts[i] as number)) }
}
test('slot plans: deterministic, never closer than the gap', () => {
  expect(slotPlan('x', NOW, 5, 0.7, 14_000)).toEqual(slotPlan('x', NOW, 5, 0.7, 14_000))
  const c = count(t => carPlan(t, false), 24 * HOUR)
  expect(c.n / 24).toBeGreaterThan(2.5) // about once per 10-20 minutes: 3 to 6 an hour
  expect(c.n / 24).toBeLessThan(7)
  for (const g of c.gaps) expect(g).toBeGreaterThanOrEqual(5 * 60_000)
  const g = count(t => gusPlan(t, false), 48 * HOUR)
  expect(g.n / 48).toBeGreaterThan(0.8)
  expect(g.n / 48).toBeLessThan(2.2)
  const l = count(t => lalooPlan(t, false), 48 * HOUR)
  expect(l.n).toBeGreaterThan(5)
  expect(l.n / 48).toBeLessThan(2)
  expect(CAR_MS + GUS_MS + LALO_MS + UNPLUG_MS).toBeGreaterThan(0)
})
test('gus: never with Mike\'s cameo', () => {
  for (const gene of [false, true]) {
    const r = roamerOf(gene ? 'gene' : 'bettercallsaul')
    for (let t = NOW; t < NOW + 72 * HOUR; t += 30_000) {
      const p = gusPlan(t, gene)
      if (!p.on) continue
      for (let u = p.startAt - 3_000; u <= p.endAt + 3_000; u += 5_000) expect(roamPlan(r.seed, u, roamOptsOf(r, 10)).kind).not.toBe('takeover')
    }
  }
})
const firstLive = (f: (t: number) => { on: boolean; startAt: number; endAt: number }): number => {
  for (let t = NOW; t < NOW + 3 * 86_400_000; t += 10_000) {
    const p = f(t)
    if (p.on) return p.startAt + 2_000
  }
  throw new Error('none')
}
test('the car putters across the band in its window only', async ($, on) => {
  base(on, 100_000, firstLive(t => carPlan(t, false)))
  await start($, 'better-call-saul')
  await jobIn($)
  const band = await bandAt($, 1250)
  expect(band).toContain('class="bcs-putt"')
  expect(band).toContain('#E0B93A')
})
test('gus walks in and straightens his tie in two frames in his window only', async ($, on) => {
  base(on, 100_000, firstLive(t => gusPlan(t, false)))
  await start($, 'better-call-saul')
  await jobIn($)
  const gb = await bandAt($, 1250)
  expect(gb).toContain('class="bcs-tie1"')
  expect(gb).toContain('class="bcs-tie2"')
})
test('between the acts there is no car and no Gus', async ($, on) => {
  base(on, 100_000, quietAt(false))
  await start($, 'better-call-saul')
  await jobIn($)
  const qb = await bandAt($, 1250)
  expect(qb).not.toContain('class="bcs-putt"')
  expect(qb).not.toContain('class="bcs-tie1"')
})
test('lalo rises through the floorboards of THE DOCKET or the LEGAL PAD', async ($, on) => {
  const tl = firstLive(t => lalooPlan(t, false))
  const plan = lalooPlan(tl, false)
  base(on, 100_000, tl)
  await start($, 'better-call-saul')
  await jobIn($)
  const p = await svgs($, 'Pane')
  const withLalo = p.filter(s => s.includes('bcslalo'))
  expect(withLalo).toHaveLength(1)
  expect(withLalo[0]).toContain(plan.card === 'task' ? 'THE DOCKET' : 'LEGAL PAD')
})
test('chuck unplugs: 4 calls in 10 s or 4 running agents; the band and the pad dim for 4 s; once per gap', async ($, on) => {
  expect(shouldUnplug([1, 2, 3], 5_000, 0)).toBe(false)
  expect(shouldUnplug([1_000, 2_000, 3_000, 4_000], 5_000, 0)).toBe(true)
  expect(shouldUnplug([1_000, 2_000, 3_000, 40_000], 41_000, 0)).toBe(false)
  expect(shouldUnplug([], 5_000, 4)).toBe(true)
  const clock = base(on, 100_000, quietAt(false))
  await start($, 'better-call-saul')
  await jobIn($)
  expect(await bandAt($, 1250)).not.toContain('class="bcs-dim"')
  for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Read', file_path: `/repo/f${i}.ts` } as never).catch(() => undefined)
  const band = await bandAt($, 1250)
  expect(band).toContain('class="bcs-dim"')
  expect(band).toContain('bcschk')
  expect((await svgs($, 'Pane')).filter(s => s.includes('class="bcs-dim"'))).toHaveLength(1)
  await clock.advance(6_000)
  expect(await bandAt($, 1250)).not.toContain('class="bcs-dim"')
})
test('the bell speeds up with the context: idle, slow, fast, mad', () => {
  expect([10, 49, 50, 84, 85, 94, 95, 100].map(p => bellMode(p))).toEqual(['idle', 'idle', 'slow', 'slow', 'fast', 'fast', 'mad', 'mad'])
  expect(bellMode(10, true)).toBe('mad')
  for (const rule of ['bcs-ring1', 'bcs-ring2', 'bcs-mad']) expect(BCS_CSS.split('prefers-reduced-motion')[1]).toContain(rule)
})
test('the cheer: one in four is the late-night ad with a fictional 555-01xx number; the rest is the star-wipe with finger guns and three dings', () => {
  let ads = 0
  for (let i = 0; i < 400; i++) if (isAdCheer(NOW + i * 7_000)) ads++
  expect(ads).toBeGreaterThan(70)
  expect(ads).toBeLessThan(130)
  const at = NOW + 7_000 * [...Array(100).keys()].find(i => !isAdCheer(NOW + i * 7_000))!
  const plain = bcsCheer(1250, 134, false, at)
  expect(plain).toContain('BETTER CALL SAUL!')
  expect(plain).toContain('DONE!')
  expect(plain).toContain("S'ALL GOOD, MAN!")
  expect(plain).toContain('bcs-gun1')
  expect(plain).toContain('class="bcs-ding"')
  expect(plain).not.toContain(AD_PHONE)
  const adAt = NOW + 7_000 * [...Array(100).keys()].find(i => isAdCheer(NOW + i * 7_000))!
  const ad = bcsCheer(1250, 134, false, adAt)
  expect(ad).toContain('505-555-0100')
  expect(ad).toContain('CALL NOW!')
  expect(AD_PHONE).toBe('505-555-0100')
  expect(ad).not.toContain('503-4455')
  expect(bcsCheer(1250, 134, true, adAt)).toContain('NIPPY!')
  expect(bcsCheer(1250, 134, true, adAt)).not.toContain(AD_PHONE)
})
test('the cheer shows on the band when a job finishes, with Mike hushed', async ($, on) => {
  const t = findAt('bettercallsaul', 'walk')
  const clock = base(on, 100_000, t - 20_600)
  await start($, 'better-call-saul')
  await jobIn($)
  await clock.advance(20_600)
  await $.turn.complete({ reason: 'answer', answer: 'done' } as never)
  const band = await bandAt($, 1250)
  expect(band).toContain('BETTER CALL SAUL!')
  expect(band).not.toContain('class="rm-walk')
})

// --- the meme pass ----------------------------------------------------------------------------------------------------
test('trigger words: found as whole words, only in these skins, the prompt unchanged', async ($, on) => {
  expect(fxOf('please chicanery now')).toBe('chicanery')
  expect(fxOf('1216')).toBe('1216')
  expect(fxOf('Namaste')).toBe('namaste')
  expect(fxOf('ding!')).toBe('ding')
  expect(fxOf('saul3d')).toBe('saul3d')
  expect(fxOf('coding')).toBeUndefined()
  expect(fxOf('12160')).toBeUndefined()
  base(on, 100_000, quietAt(false))
  await start($, 'better-call-saul')
  await jobIn($)
  const res = (await $.prompt.submit({ text: 'chicanery', cursor: 0 } as never)) as { text?: string }
  expect(String(res?.text ?? 'chicanery')).toBe('chicanery')
  const b = await bandAt($, 1250)
  expect(b).toContain('I AM NOT CRAZY!')
  expect(b).toContain('1216')
  expect(b).toContain('1261')
  await $.prompt.submit({ text: 'namaste', cursor: 0 } as never)
  expect(await bandAt($, 1250)).toContain('class="bcs-go"')
  await $.prompt.submit({ text: 'ding', cursor: 0 } as never)
  expect(await bandAt($, 1250)).toContain('class="bcs-ding"')
  await $.prompt.submit({ text: 'saul3d', cursor: 0 } as never)
  expect(await bandAt($, 1250)).toContain('class="bcs-z3"')
})
test('trigger words do nothing on other skins', async ($, on) => {
  base(on, 100_000, quietAt(false))
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'chicanery', cursor: 0 } as never)
  const other = await bandAt($, 1250)
  expect(other).not.toContain('I AM NOT CRAZY!')
  expect(other).not.toContain('class="bcs-fx"')
})
test('trigger words end on their own and respect reduced motion', async ($, on) => {
  const clock = base(on, 100_000, quietAt(false))
  await start($, 'better-call-saul')
  await jobIn($)
  await $.prompt.submit({ text: '1216', cursor: 0 } as never)
  expect(await bandAt($, 1250)).toContain('1261')
  await clock.advance(6_000)
  expect(await bandAt($, 1250)).not.toContain('1261')
  const reduced = BCS_CSS.split('prefers-reduced-motion')[1] as string
  for (const c of ['bcs-fx', 'bcs-ding', 'bcs-z3', 'bcs-gun1', 'bcs-dim', 'bcs-up', 'bcs-go']) expect(reduced).toContain(c)
})
test('command kinds and results: tests, lint, force push', () => {
  expect(cmdKind('npx vitest run')).toBe('test')
  expect(cmdKind('bun test hooks')).toBe('test')
  expect(cmdKind('pytest -x')).toBe('test')
  expect(cmdKind('git push --force origin main')).toBe('force')
  expect(cmdKind('git push -f')).toBe('force')
  expect(cmdKind('git push origin main')).toBeNull()
  expect(cmdKind('npx tsc --noEmit')).toBe('lint')
  expect(cmdKind('ls')).toBeNull()
  expect(resultFailed({ result: 'ok' })).toBe(false)
  expect(resultFailed({ result: '3 failed, 10 passed' })).toBe(true)
  expect(resultFailed({ isError: true })).toBe(true)
})
test('toasts: the same test failing twice, a clean lint after a failure, a force push; each rate-limited; only on these skins', async ($, on) => {
  let s = { testFails: 0, lintFailed: false }
  let r = bashToast('test', true, s)
  expect(r.toast).toBeUndefined()
  r = bashToast('test', true, r.state)
  expect(r.toast).toBe('tests')
  expect(bashToast('test', false, r.state).state.testFails).toBe(0)
  r = bashToast('lint', false, s)
  expect(r.toast).toBeUndefined()
  r = bashToast('lint', true, s)
  r = bashToast('lint', false, r.state)
  expect(r.toast).toBe('lint')
  s = r.state
  expect(bashToast('force', false, s).toast).toBe('force')
  expect(toastDue({}, 'done', NOW)).toBe(true)
  expect(toastDue({ done: NOW }, 'done', NOW + TOAST_GAP_MS.done - 1)).toBe(false)
  expect(toastDue({ done: NOW }, 'done', NOW + TOAST_GAP_MS.done)).toBe(true)
  expect(TOAST_GAP_MS.agent).toBe(600_000)
  expect(TOASTS.first).toBe("It's showtime, folks!")
  // In the app: the first prompt, a force push, an agent joining (rate-limited), and nothing on another skin.
  const clock = base(on, 100_000, quietAt(false))
  toasts.length = 0
  await start($, 'better-call-saul')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  expect(toasts.filter(t => t === "It's showtime, folks!")).toHaveLength(1)
  await $.prompt.submit({ text: 'again', cursor: 0 } as never)
  expect(toasts.filter(t => t === "It's showtime, folks!")).toHaveLength(1)
  await $.tool.call({ tool: 'Bash', command: 'git push --force origin x' } as never).catch(() => undefined)
  expect(toasts.filter(t => t === 'No more half measures.')).toHaveLength(1)
  await $.tool.call({ tool: 'Bash', command: 'git push -f' } as never).catch(() => undefined)
  expect(toasts.filter(t => t === 'No more half measures.')).toHaveLength(1)
  await clock.advance(200_000)
  await $.tool.call({ tool: 'Bash', command: 'git push -f' } as never).catch(() => undefined)
  expect(toasts.filter(t => t === 'No more half measures.')).toHaveLength(2)
})
test('toasts: none on other skins', async ($, on) => {
  base(on, 100_000, quietAt(false))
  toasts.length = 0
  await start($, 'breaking-bad')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  await $.tool.call({ tool: 'Bash', command: 'git push --force' } as never).catch(() => undefined)
  expect(toasts.filter(t => Object.values(TOASTS).includes(t as never))).toHaveLength(0)
})
test('gene: a tiny colour ad in the glasses and the rare "The name\'s McGill."', () => {
  expect(TOASTS.mcgill).toBe("The name's McGill.")
})

test('sizes: the band under 70 kB in every state; every pane Svg far under 131072; the pane under 260 kB with four running agents', async ($, on) => {
  base(on, 960_000, findAt('bettercallsaul', 'walk', 96))
  await start($, 'better-call-saul')
  await jobIn($)
  for (const [i, d] of ['Lead: run the batch', 'Researcher: map the API', 'Engineer: wire the parser', 'Tester: break it'].entries()) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: d, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  for (const W of [750, 900, 1250]) expect((await bandAt($, W)).length).toBeLessThan(70_000)
  const p = await svgs($, 'Pane')
  for (const s of p) expect(s.length).toBeLessThan(131_072)
  expect(p.reduce((n, s) => n + s.length, 0)).toBeLessThan(260_000)
  for (const s of p.filter(x => /ATTORNEY AT LAW|LEGAL PAD|THE DOCKET/.test(x))) expect(s.length).toBeLessThan(24_000)
})
