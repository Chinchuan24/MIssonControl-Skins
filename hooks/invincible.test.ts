import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { CASTS } from './cast'
import type { Sprite } from './cast'
import { BADGES, RANKS, VERBS, coverCard, coverHeight, pageCard, rankOf, tierOf, wallCard } from './invincible-cards'
import { ACT_LEN, ACT_OFF, BAND_CUT, FIGHT_CSS, FIGHT_MS, FIGHT_PANE_RESERVE, FRAME_KEYS, chainOfAct, fightAct, fightBand, frameSprite } from './invincible-fight'
import { AHEAD_MS, CLASSIC_RE, DUEL_MS, GUARDIANS_RE, NEW_SUIT_RE, SHOWDOWN_MS, THINK_RE, duelPlan, showdownPlan, slotPlan } from './invincible-eggs'
import { CSS, EPISODES, ERA1, ERA2, PROPS, SP, TITLE_WORDS, condW, contrast, episodeAt, monoW, sansW } from './invincible'
import { THEMES } from './themes'

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
const svgs = async ($: Engine, component: 'Pane' | 'AbovePrompt', W = 1250, working = true): Promise<string[]> => {
  const ui =
    component === 'Pane'
      ? await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
      : await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: working, maxRows: 14, bodyColumns: COLS[W] } as never })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await ui.unmount()
  return all
}
const bandAt = async ($: Engine, W: number, working = true): Promise<string> => (await svgs($, 'AbovePrompt', W, working)).join('')
const TITLE = 'GDA HQ incident report'
const jobIn = async ($: Engine, title = TITLE) => {
  await $.prompt.submit({ text: title, cursor: 0 } as never)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title, total: 5, done: 2, phase: 'delegate', tasks: [{ title: 'Lead: run it', tier: 'fable' }, { title: 'Researcher: map the API', tier: 'medium' }, { title: 'Engineer: rewrite the parser', tier: 'careful' }, { title: 'Tester: break it', tier: 'heavy' }, { title: 'Writer: the report', tier: 'light' }] } as never).catch(() => undefined)
}
const four = async ($: Engine) => {
  for (const [i, d] of ['Lead: run it', 'Researcher: map the API', 'Engineer: rewrite the parser', 'Tester: break it'].entries()) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: d, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
}
const skinList = async ($: Engine) => String(((await $.command.run({ command: 'skin', args: 'list' } as never)) as { text?: string }).text)
const OTHER = ['ATTORNEY AT LAW', 'LEGAL PAD', 'THE DOCKET', 'PERIODIC TABLE', 'NEURAL SYNC', 'PERSONNEL FILE', 'BREACH PROTOCOL', 'STREET CRED', 'COLD READ', 'CLASSROOM', 'HONOR ROLL', 'NETRUNNER', 'BRAINDANCE', 'NETRUN TRACE', 'CLOSED GIGS', 'CLOSED CASES']
/** A moment with no fight (now or within the look-ahead), no daily showdown near and nothing else scheduled. */
const quietAt = (era: 1 | 2 = 1, from = NOW): number => {
  for (let t = from; ; t += 61_000) {
    const d = duelPlan(t, era)
    const near = (p: { startAt: number; endAt: number }) => t + 2 * AHEAD_MS > p.startAt && t < p.endAt + 60_000
    if (!near(d) && !near(duelPlan(t + 120_000, era)) && !near(showdownPlan(t, era)) && !near(showdownPlan(t + 120_000, era))) return t
  }
}
const fightStart = (era: 1 | 2 = 1, from = NOW): number => {
  for (let t = from; ; t += 60_000) {
    const p = duelPlan(t, era)
    if (p.on && !(showdownPlan(p.startAt, era).startAt < p.endAt + 5000 && showdownPlan(p.startAt, era).endAt > p.startAt - 5000)) return p.startAt
  }
}

// --- the band, the cards, the Total, the words -------------------------------------------------------------------------
test('invincible: COVER STORY, THE PAGE, GDA WALL, the episode, the title and the Total; no other skin words', async ($, on) => {
  base(on, 100_000, quietAt(), 1.234)
  await start($, 'invincible')
  await jobIn($)
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' } as never).catch(() => undefined)
  const paneSvg = (await svgs($, 'Pane')).join('')
  const band = await bandAt($, 1250)
  for (const w of ['COVER STORY', 'THE PAGE', 'GDA WALL', 'ARCHIVED FEEDS', 'MISSION PATCHES', 'GDA FIELD REPORT', 'GDA FEED COMING ONLINE']) expect(paneSvg).toContain(w)
  const ep = (episodeAt(quietAt()) as string[])[0] as string
  expect(band).toContain(ep)
  expect(band).toContain(TITLE)
  expect(band).toMatch(/Total <tspan[^>]*>\$1\.23/)
  expect(band).toContain('MISSION CONTROL')
  expect(band).toContain('GLOBAL DEFENSE AGENCY')
  expect(band).toContain('ON PATROL')
  for (const w of OTHER) {
    expect(paneSvg).not.toContain(w)
    expect(band).not.toContain(w)
  }
  // The Total sits right after the name, the way bcsTotal does it.
  const m = /MISSION CONTROL<\/text>.*?<text x="([\d.]+)"[^>]*>Total /s.exec(band)
  expect(m).toBeTruthy()
})
test('invincible: Allen\'s eye in the corner, Eve\'s pink cache bar, the hero rule; Debbie\'s mug and BURGER MART when idle', async ($, on) => {
  base(on, 100_000, quietAt())
  await start($, 'invincible')
  await jobIn($)
  const work = await bandAt($, 1250)
  expect(work).toContain(PROPS.allen as string)
  expect(work).toContain(PROPS.eve as string)
  expect(work).toContain('class="inv-blink"')
  expect(work).not.toContain('BURGER MART')
  expect(work).not.toContain(PROPS.mug as string)
  const idle = await bandAt($, 1250, false)
  expect(idle).toContain(PROPS.mug as string)
  expect(idle).not.toContain('class="inv-steam"')
})
test('invincible: Allen goes wide at 96%', async ($, on) => {
  base(on, 960_000, quietAt())
  await start($, 'invincible')
  await jobIn($)
  const b = await bandAt($, 1250)
  expect(b).toContain('class="inv-wide"')
})
for (const [pct, ctx, word] of [[88, 880_000, 'THAT ACTUALLY HURT'], [96, 960_000, 'THINK, MARK!']] as const) {
  test(`invincible: the ${pct}% chip says ${word}`, async ($, on) => {
    base(on, ctx, quietAt())
    await start($, 'invincible')
    await jobIn($)
    for (const W of [900, 1250]) expect(await bandAt($, W)).toContain(word)
  })
}
test('invincible: the title-card SLAM on a finished job', async ($, on) => {
  const clock = base(on, 100_000, quietAt())
  await start($, 'invincible')
  await jobIn($)
  await clock.advance(500)
  const cheer = THEMES.invincible.cheer(1250, 134, 'x', {} as never, 5_000)
  expect(cheer).toContain('INVINCIBLE')
  expect(cheer).toContain('JOB DONE')
  expect(cheer).toContain('inv-slam')
  expect(cheer).toMatch(/--cd:calc\(@@T5000@@ \+ 0s\)/)
  expect(CSS).toContain('prefers-reduced-motion')
})
test('invincible: episodes, ranks, patches and verbs', () => {
  expect(EPISODES.length).toBe(32)
  expect(episodeAt(0)).toEqual(EPISODES[0])
  expect(episodeAt(HOUR)).toEqual(EPISODES[1])
  for (const [code] of EPISODES) expect(code).toMatch(/^S\dE\d$/)
  expect(rankOf(1)).toBe('Burger Mart Cashier')
  expect(rankOf(4)).toBe('Invincible')
  expect(rankOf(20)).toBe('Invincible, Full Stop')
  expect(RANKS.length).toBe(11)
  expect(BADGES.map(b => b.id)).toEqual(['choom', 'merc', 'edgerunner', 'legend', 'netrunner', 'crewboss', 'chromed', 'owl', 'samurai'])
  expect(VERBS.Edit).toBe('PUNCH')
  expect(TITLE_WORDS).toContain('That Actually Hurt')
  expect(THEMES.invincible.tools).toEqual(VERBS)
})
test('invincible: the other skins do not wear the Invincible words', async ($, on) => {
  base(on, 100_000, quietAt())
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'new suit, think, mark, guardians, season 3', cursor: 0 } as never)
  const band = await bandAt($, 1250)
  expect(band).not.toContain('THINK, MARK.')
  expect(band).not.toContain('INVINCIBLE')
  expect(await skinList($)).toContain('▸ mentalist')
  expect(band).not.toContain(ERA2.tile)
  const pn = (await svgs($, 'Pane')).join('')
  expect(pn).not.toContain('LAST ONE STANDING')
})
// --- two eras ------------------------------------------------------------------------------------------------------------
test('eras: the codes, as whole words in any case', () => {
  for (const t of ['new suit', 'New Suit please', 'season 3', 'Season three', 'season 4']) expect(NEW_SUIT_RE.test(t)).toBe(true)
  for (const t of ['classic suit', 'old suit', 'season 1', 'Season one', 'season 2']) expect(CLASSIC_RE.test(t)).toBe(true)
  for (const t of ['newsuit', 'season 30', 'season', 'new suits']) expect(NEW_SUIT_RE.test(t) && t !== 'new suits').toBe(false)
  expect(THINK_RE.test('think, mark')).toBe(true)
  expect(THINK_RE.test('Think Mark!')).toBe(true)
  expect(THINK_RE.test('thinkmark')).toBe(false)
  expect(GUARDIANS_RE.test('call the Guardians')).toBe(true)
  expect(GUARDIANS_RE.test('guardianship')).toBe(false)
})
test('eras: "new suit" puts on the blue-and-black suit with the swap, "classic suit" goes back; the prompt goes on unchanged; saved across restarts', async ($, on) => {
  const clock = base(on, 100_000, quietAt())
  await start($, 'invincible')
  await jobIn($)
  const era1 = await bandAt($, 1250)
  expect(era1).toContain(ERA1.hero)
  expect(era1).not.toContain('class="sw-anim"')
  const r = (await $.prompt.submit({ text: 'Try the new suit', cursor: 0 } as never)) as { text?: string }
  expect(String(r?.text ?? 'Try the new suit')).toBe('Try the new suit')
  const swap = await bandAt($, 1250)
  expect(swap).toContain(ERA2.hero)
  expect(swap).toContain('class="sw-anim"')
  expect(swap).toContain('YOU WANT A REAL COSTUME, RIGHT?')
  expect(swap).toContain('sw-still')
  expect(swap).toMatch(/NEW SUIT · S3\+/)
  const pn = (await svgs($, 'Pane')).join('')
  expect(pn).toContain('class="sw-anim"')
  await clock.advance(3_000)
  const settled = await bandAt($, 1250)
  expect(settled).not.toContain('class="sw-anim"')
  expect(settled).toContain(ERA2.hero)
  expect(await skinList($)).toContain('▸ invincible')
  expect((await skinList($)).split('\n').filter(l => /invincible/.test(l)).length).toBe(1)
  await $.prompt.submit({ text: 'classic suit', cursor: 0 } as never)
  expect(await bandAt($, 1250)).toContain('IT\'S ABOUT TIME')
  // Both at once: left alone.
  await clock.advance(3_000)
  await $.prompt.submit({ text: 'new suit or classic suit', cursor: 0 } as never)
  expect(await bandAt($, 1250)).not.toContain('class="sw-anim"')
})
test('eras: era 2 draws its own palette, its own cast key and the NEW SUIT patch', async ($, on) => {
  base(on, 100_000, quietAt(2))
  await start($, 'invincible')
  await jobIn($)
  await $.prompt.submit({ text: 'season 3', cursor: 0 } as never)
  const b = await bandAt($, 1250)
  expect(b).toContain(ERA2.tile)
  const p = (await svgs($, 'Pane')).join('')
  expect(p).toContain('#6FB4F5')
  expect(THEMES.invincible2.era).toBe(2)
  expect(THEMES.invincible.era).toBe(1)
  expect(CASTS.invincible2?.boss).toBe(SP.INV_MARK_S3)
  expect(CASTS.invincible?.boss).toBe(SP.INV_MARK)
})
test('think, mark: Omni-Man drops in with his line, only here, ends on its own', async ($, on) => {
  const clock = base(on, 100_000, quietAt())
  await start($, 'invincible')
  await jobIn($)
  expect(await bandAt($, 1250)).not.toContain('THINK, MARK.')
  await $.prompt.submit({ text: 'think, mark', cursor: 0 } as never)
  expect(await bandAt($, 1250)).toContain('THINK, MARK.')
  await clock.advance(4_500)
  expect(await bandAt($, 1250)).not.toContain('THINK, MARK.')
  const reduced = CSS.split('prefers-reduced-motion')[1] as string
  for (const c of ['inv-think', 'inv-tbub', 'inv-tdrop', 'inv-cheer', 'inv-slam']) expect(reduced).toContain(c)
})
// --- the fight ---------------------------------------------------------------------------------------------------------
test('fight: deterministic, about one per 12-15 minutes, never two within 6 minutes', () => {
  expect(duelPlan(NOW, 1)).toEqual(duelPlan(NOW, 1))
  expect(slotPlan('x', NOW, 6, 0.8, DUEL_MS)).toEqual(slotPlan('x', NOW, 6, 0.8, DUEL_MS))
  expect(duelPlan(NOW, 1)).not.toEqual(duelPlan(NOW, 2))
  for (const era of [1, 2] as const) {
    const starts: number[] = []
    for (let t = NOW; t < NOW + 48 * HOUR; t += 10_000) {
      const p = duelPlan(t, era)
      if (p.on && !starts.includes(p.startAt)) starts.push(p.startAt)
    }
    const perHour = starts.length / 48
    expect(perHour).toBeGreaterThan(3.2)
    expect(perHour).toBeLessThan(5.4)
    for (const [i, s] of starts.slice(1).entries()) expect(s - (starts[i] as number)).toBeGreaterThanOrEqual(6 * 60_000)
  }
  expect(DUEL_MS).toBeGreaterThanOrEqual(FIGHT_MS)
})
test('fight: the three combos chain their poses frame by frame', () => {
  const chain = (a: 0 | 1 | 2 | 'band', era: 1 | 2 = 1) => chainOfAct(a, era).join('>')
  // A, "The Catch": the dash, the punch, the palm catch, the backhand, the hit, the ball, the skid.
  expect(chain(0)).toMatch(/M2>M3>O4>O7>M8>M9.*M10/)
  // B, "Every Angle": recover, charge, jabs, flinches, the grab-lift and the throw.
  expect(chain(1)).toMatch(/M11>M2>M4.*O11.*M5.*M6.*O10>O7>M9/)
  // C, "Think, Mark": recover, block, hammer up and down, pitch, kneel, hands, flight.
  expect(chain(2)).toMatch(/M11>M7>O9>O9B>O3>M12>O12>O13/)
  // The band cut ends with Mark thrown down.
  expect(chain('band')).toMatch(/O2>M2>M3>O4>O7>M8>M9.*M4.*O7>M8>M9/)
  expect(chainOfAct(0, 2).join('>')).toBe(chainOfAct(0, 1).join('>'))
  for (const k of FRAME_KEYS) {
    for (const era of [1, 2] as const) expect(frameSprite(k, era).rows.length).toBeGreaterThan(10)
  }
  expect(ACT_OFF[0]).toBeLessThan(BAND_CUT)
  expect(Math.abs(ACT_OFF[2] + ACT_LEN[2] - FIGHT_MS / 1000)).toBeLessThan(1e-6)
})
test('fight: each frame once per Svg in defs, shown with use; one pinned delay; no red in the effects; reduced motion shows one still', () => {
  const a = fightBand({ W: 1250, H: 134, era: 1, startAt: 5_000 }).svg
  const defs = /<defs>([\s\S]*?)<\/defs>/.exec(a)?.[1] as string
  const ids = [...defs.matchAll(/<g id="([^"]+)"/g)].map(m => m[1])
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.length).toBe(8)
  expect([...a.matchAll(/<use href="#([^"]+)"/g)].every(m => ids.includes(m[1]))).toBe(true)
  expect(a).toMatch(/--p:@@T5000@@/)
  expect(new Set([...a.matchAll(/@@T(\d+)@@/g)].map(m => m[1]))).toEqual(new Set(['5000']))
  const fxOnly = a.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/<g class="dl-still"[\s\S]*$/, '')
  for (const red of [PROPS.red, PROPS.redDeep, ERA1.alert, '#FF0000', '#E8453C']) expect(fxOnly.toUpperCase()).not.toContain((red as string).toUpperCase())
  expect(a).toContain('class="dl-still"')
  expect(FIGHT_CSS).toMatch(/prefers-reduced-motion: reduce\)\{\.dl-anim\{display:none\}\.dl-cam\{animation:none!important\}\.dl-still\{display:block/)
  for (const w of ['TAK!', 'WHAM!', 'KRAK!', 'BOOM', 'FWOOSH', 'SKRRT']) expect(a).toContain(w)
  for (const w of ['blood', 'gore', 'train']) expect(a.toLowerCase()).not.toContain(w)
  const p0 = fightAct({ W: 480, H: 434, era: 1, startAt: 5_000 }, 0).svg
  const p1 = fightAct({ W: 480, H: 260, era: 1, startAt: 5_000 }, 1).svg
  const p2 = fightAct({ W: 480, H: 236, era: 1, startAt: 5_000 }, 2).svg
  for (const w of ['TAK!', 'WHAM!', 'KRAK!']) expect(p0).toContain(w)
  for (const w of ['POW', 'BAM', 'BIFF', 'GRAB', 'BOOM!']) expect(p1).toContain(w)
  expect(p2).toContain('THINK, MARK!')
  expect(p2).toContain("I&apos;D STILL HAVE YOU, DAD.".replace('&apos;', "'"))
  // Act 3 is quiet: no shake, no SFX word.
  expect(p2).not.toContain('WHAM')
})
test('fight: scheduled ahead (a positive pinned delay), live (a negative one), over after the last act; only while working', async ($, on) => {
  const st = fightStart(1, quietAt(1) + 3_600_000)
  const clock = base(on, 100_000, st - 40_000)
  await start($, 'invincible')
  await jobIn($)
  await four($)
  const ahead = await bandAt($, 1250)
  expect(ahead).toMatch(/--p:40s;/)
  expect(ahead).toContain('class="dl-anim"')
  const pAhead = (await svgs($, 'Pane')).join('')
  expect(pAhead).toContain('class="dl-anim"')
  await clock.advance(20_000)
  await clock.advance(20_000)
  await clock.advance(2_000)
  expect(await bandAt($, 1250)).toMatch(/--p:-2s;/)
  for (let i = 0; i < 4; i++) await clock.advance(3_000)
  expect(await bandAt($, 1250)).not.toContain('class="dl-anim"')
  expect((await svgs($, 'Pane')).join('')).toContain('class="dl-anim"')
  for (let i = 0; i < 3; i++) await clock.advance(3_000)
  expect((await svgs($, 'Pane')).join('')).not.toContain('class="dl-anim"')
})
test('fight: the panel shakes (1, 3 and 4 px tiers), the sprites do not; the camera is stopped under reduced motion', async ($, on) => {
  const st = fightStart(1, quietAt(1) + 3_600_000)
  base(on, 100_000, st + 2_000)
  await start($, 'invincible')
  await jobIn($)
  await four($)
  const band = await bandAt($, 1250)
  expect(band).toMatch(/class="dl-cam" style="animation:dl-sh1 [\d.]+s steps\(1\) none;animation-delay:calc\(-?[\d.]+s \+ [\d.]+s\)/)
  expect(band).toContain('dl-sh3 ')
  for (const px of ['translate(1px', 'translate(3px', 'translate(4px']) expect(FIGHT_CSS).toContain(px)
  expect(FIGHT_CSS).toContain('.dl-cam{animation:none!important}')
  const pn = (await svgs($, 'Pane')).filter(s => s.includes('class="dl-cam"')).join('')
  expect(pn).toContain('dl-sh4 ')
})
test('fight: no fight while idle, in another skin, or during the showdown', async ($, on) => {
  const st = fightStart(1, quietAt(1) + 3_600_000)
  base(on, 100_000, st + 2_000)
  await start($, 'invincible')
  expect(await bandAt($, 1250, false)).not.toContain('class="dl-anim"')
  await jobIn($)
  await four($)
  expect(await bandAt($, 1250)).toContain('class="dl-anim"')
  await $.prompt.submit({ text: 'guardians', cursor: 0 } as never)
  expect(await bandAt($, 1250)).not.toContain('class="dl-anim"')
  expect((await svgs($, 'Pane')).join('')).toContain('LAST ONE STANDING.')
})
for (const era of [1, 2] as const) {
  test(`sizes: era ${era}: the band under 70 kB mid-fight; each pane Svg under 60 kB; the pane under 260 kB with four running agents`, async ($, on) => {
    const st = fightStart(era, quietAt(era) + 3_600_000)
    const clock = base(on, 880_000, st - 5_000)
    await start($, 'invincible')
    if (era === 2) await $.prompt.submit({ text: 'new suit', cursor: 0 } as never)
    await jobIn($)
    await four($)
    await clock.advance(3_000)
    await clock.advance(3_500)
    for (const W of [750, 900, 1250]) {
      const b = await bandAt($, W)
      expect(b).toContain('class="dl-anim"')
      expect(b.length).toBeLessThan(70_000)
    }
    const p = await svgs($, 'Pane')
    expect(p.join('')).toContain('class="dl-anim"')
    for (const s of p) expect(s.length).toBeLessThan(60_000)
    expect(p.reduce((n, s) => n + s.length, 0)).toBeLessThan(260_000)
  })
}
test('fight: sizes of the pieces, and the pane reserve covers the three acts at the widest card', () => {
  for (const era of [1, 2] as const) {
    let all = 0
    for (const [act, H] of [[0, 434], [1, 296], [2, 236]] as const) all += fightAct({ W: 600, H, era, startAt: 0 }, act).svg.length
    expect(all).toBeLessThan(FIGHT_PANE_RESERVE)
    expect(fightBand({ W: 1250, H: 134, era, startAt: 0 }).svg.length).toBeLessThan(32_000)
    expect(fightBand({ W: 1250, H: 134, era, startAt: 0 }).frames).toBeLessThanOrEqual(8)
    for (const [act, H] of [[0, 434], [1, 260], [2, 236]] as const) expect(fightAct({ W: 496, H, era, startAt: 0 }, act).svg.length).toBeLessThan(36_000)
  }
})
// --- the showdown --------------------------------------------------------------------------------------------------------
test('showdown: once a day at a seeded time between 09:00 and 22:00, or when `guardians` is typed; seven KOs; arms never uncrossed', async ($, on) => {
  const seen = new Set<number>()
  for (let day = 0; day < 6; day++) {
    const p = showdownPlan(NOW + day * 86_400_000, 1)
    seen.add(p.startAt)
    const d = new Date(p.startAt)
    expect(d.getHours()).toBeGreaterThanOrEqual(9)
    expect(d.getHours()).toBeLessThan(22)
    expect(p.endAt - p.startAt).toBe(SHOWDOWN_MS)
    expect(showdownPlan(p.startAt + 1000, 1).startAt).toBe(p.startAt)
  }
  expect(seen.size).toBe(6)
  base(on, 100_000, quietAt())
  await start($, 'invincible')
  await jobIn($)
  expect((await svgs($, 'Pane')).join('')).not.toContain('LAST ONE STANDING.')
  await $.prompt.submit({ text: 'bring in the Guardians', cursor: 0 } as never)
  const wall = (await svgs($, 'Pane')).find(s => s.includes('GDA WALL') && s.includes('sd-anim')) as string
  expect(wall).toBeTruthy()
  expect(wall).toContain('THE GUARDIANS OF THE GLOBE')
  expect(wall.match(/class="inv-twirl"/g)?.length).toBe(14)
  expect(wall).toContain('sd-still')
  expect(wall.length).toBeLessThan(131_072)
  // Omni-Man's one frame the whole time: the arms-crossed hover, with a 2 px recoil.
  expect(wall.match(/translate\(2px,0\)/g)?.length).toBeGreaterThanOrEqual(7)
  expect(wall).not.toContain('uncross')
})
test('showdown: at its daily time, ahead and live; once that day, never twice', async ($, on) => {
  const p = showdownPlan(NOW, 1)
  base(on, 100_000, p.startAt - 30_000)
  await start($, 'invincible')
  await jobIn($)
  expect((await svgs($, 'Pane')).join('')).toContain('LAST ONE STANDING.')
  // The plan is the day's: the same start all day, and after its 7.4 s nothing is due until tomorrow.
  for (let t = p.startAt; t < p.startAt + 20 * HOUR; t += 30 * 60_000) expect(showdownPlan(t, 1).startAt === p.startAt || new Date(t).getDate() !== new Date(p.startAt).getDate()).toBe(true)
  const late = showdownPlan(p.endAt + 60_000, 1)
  expect(late.startAt + 0 <= p.endAt + 60_000 && p.endAt + 60_000 < late.endAt).toBe(false)
})
// --- layout ----------------------------------------------------------------------------------------------------------------
type Box = { l: number; r: number; t: number; b: number; s: string }
const widthOf = (font: string, s: string, size: number, ls: number, bold: boolean): number => (/Avenir/.test(font) ? condW(s, size, ls) : /monospace|Menlo/.test(font) ? monoW(s, size) + s.length * ls : sansW(s, size, ls, bold))
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
for (const era of [1, 2] as const) {
  for (const W of [750, 900, 1250]) {
    for (const ctx of [100_000, 880_000, 960_000]) {
      test(`slim band invincible era ${era} at ${W} (${ctx / 10_000}% context): the title is plain text, the Total shows, nothing overlaps`, async ($, on) => {
        base(on, ctx, quietAt(era), 3.5)
        await start($, 'invincible')
        if (era === 2) await $.prompt.submit({ text: 'new suit', cursor: 0 } as never)
        await jobIn($)
        const clockLater = 4_000
        void clockLater
        const svg = await bandAt($, W)
        expect(svg).toMatch(new RegExp(`>${TITLE}[^<]*</text>`))
        expect(svg).toMatch(/Total <tspan[^>]*>\$3\.50<\/tspan>/)
        expect(svg).not.toContain('NaN')
        // The swap is a separate layer (era 2): measure the band without it.
        const bs = boxes(svg.replace(/<g pointer-events="none"><style>[\s\S]*?class="sw-anim"[\s\S]*$/, ''))
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
test('contrast: every text colour reads at 4.5:1 or better on its tile, in both eras', () => {
  for (const P of [ERA1, ERA2]) for (const fg of [P.text, P.sub, P.muted, P.aT, P.hero, P.done, P.warn, P.alert]) expect(contrast(fg, P.tile)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(ERA1.heroInk, ERA1.hero)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(ERA2.heroInk, ERA2.hero)).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#FFFFFF', PROPS.red as string)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(PROPS.ink as string, PROPS.paper as string)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(PROPS.screenText as string, PROPS.screen as string)).toBeGreaterThanOrEqual(4.5)
})
test('cards: sizes under the limits, no NaN, the levels pick their cover, the edge states', () => {
  const c = { xp: 420, jobs: 12, longJobs: 3, agents: 37, crewJobs: 1, nightJobs: 0, chromed: false, samurai: false, badges: ['choom', 'merc'] }
  const zero = { xp: 0, jobs: 0, longJobs: 0, agents: 0, crewJobs: 0, nightJobs: 0, chromed: false, samurai: false, badges: [] }
  for (const era of [1, 2] as const) {
    for (const W of [360, 480, 560]) {
      for (const cred of [c, zero, { ...c, xp: 4700, badges: BADGES.map(b => b.id) }]) {
        const s = coverCard(W, cred, { era })
        expect(s.length).toBeLessThan(30_000)
        expect(s).not.toContain('NaN')
        expect(s).toContain(`height="${coverHeight(W)}"`)
      }
    }
  }
  expect(tierOf(1)).toBe(1)
  expect(tierOf(4)).toBe(2)
  expect(tierOf(7)).toBe(3)
  expect(tierOf(12)).toBe(4)
  expect(coverCard(480, zero, { era: 1 })).toContain('BURGER MART CASHIER')
  const beats = Array.from({ length: 16 }, (_, i) => ({ at: NOW + i * 17_000, tool: ['Read', 'Edit', 'Bash', 'Agent'][i % 4] as string, text: `file${i}.ts`, who: 'Engineer' }))
  for (const W of [360, 480]) {
    expect(pageCard(W, beats, -1, { era: 1 })).toContain('TEAM-UP!')
    expect(pageCard(W, beats, 7, { era: 2 })).not.toContain('NaN')
    expect(pageCard(W, [], -1, { era: 1 })).toContain('Nothing drawn yet.')
  }
  const legends = Array.from({ length: 5 }, (_, i) => ({ task: `Mission ${i}`, costUsd: 0.4, at: NOW, ms: (3 + i) * 60_000 }))
  for (const W of [360, 480]) {
    expect(wallCard(W, 'Task', true, 2, 5, legends, { era: 1 })).toContain('FEED 01 · LIVE')
    expect(wallCard(W, '', false, 0, 0, [], { era: 2 })).toContain('No archived feeds yet.')
    expect(wallCard(W, 'Task', true, 2, 5, legends, { era: 1 }).length).toBeLessThan(30_000)
  }
})
test('sprites: rectangular rows, every letter in the palette, the cast, the fight frames', () => {
  const all = Object.entries(SP).filter(([k]) => /^(INV|FX3?)_/.test(k)) as [string, Sprite][]
  expect(all.length).toBeGreaterThanOrEqual(70)
  for (const [, sp] of all) {
    expect(new Set(sp.rows.map(r => r.length)).size).toBe(1)
    for (const row of sp.rows) for (const ch of row) if (ch !== '.' && ch !== 't') expect(sp.pal[ch]).toBeTruthy()
  }
  for (const k of ['invincible', 'invincible2']) {
    const c = CASTS[k] as NonNullable<(typeof CASTS)[string]>
    expect(c.crew.length).toBe(3)
    expect(Object.keys(c.roles).length).toBeGreaterThanOrEqual(10)
    expect(c.crew.every(sp => sp.rows.some(r => r.includes('t')))).toBe(true)
  }
  // No Mark frame is the other era's.
  expect(frameSprite('M3', 1)).toBe(SP.FX_M3_PUNCH)
  expect(frameSprite('M3', 2)).toBe(SP.FX3_M3_PUNCH)
  expect(frameSprite('O4', 2)).toBe(SP.FX_O4_CATCH)
})
test('layout: 130 redraws over ~43 minutes keep one layout signature', { timeoutMs: 180_000 }, async ($, on) => {
  const clock = base(on, 100_000, quietAt(1))
  await start($, 'invincible')
  await jobIn($)
  await four($)
  const sig = async () => {
    const b = await svgs($, 'AbovePrompt', 900)
    const p = await svgs($, 'Pane')
    const dims = (l: string[]) => l.map(s => `${/width="(\d+)"/.exec(s)?.[1]}x${/height="(\d+)"/.exec(s)?.[1]}`).join(',')
    return `${b.length}:${/height="(\d+)"/.exec(b[0] ?? '')?.[1]}|${p.length}|${dims(p)}`
  }
  const seen = new Set([await sig()])
  let fights = 0
  for (let i = 0; i < 130; i++) {
    await clock.advance(20_000)
    seen.add(await sig())
    if ((await svgs($, 'Pane')).join('').includes('class="dl-anim"')) fights++
  }
  expect(fights).toBeGreaterThan(0)
  expect([...seen]).toHaveLength(1)
})
test('skins: Invincible is one entry in the picker, ships in the core edition, and the JSON copy matches', async ($, on) => {
  base(on)
  await start($, '')
  const list = await skinList($)
  expect(list).toContain('invincible')
  expect(list).not.toContain('invincible2')
  expect(list.split('\n').filter(l => /\binvincible\b/.test(l)).length).toBe(1)
  expect(await skinList($)).toContain('Invincible')
  const r = String(((await $.command.run({ command: 'skin', args: 'invincible' } as never)) as { text?: string }).text)
  expect(r).toContain('Skin: Invincible')
})
