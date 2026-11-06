import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { AFTER_RED, COLD_H, EPISODES, RED, TEA_WARNING, TYGER_RE, cbiRankOf, coldReadCard, coldReads, episodeAt, smiley, teaChip } from './mentalist'
import { BOARD_H, caseBoard, caseBoardAlt, ctxChip, fileHeight, personnelFile } from './mentalist-cards'
import { BLANK_CRED } from './extras'
import type { Beat } from './extras'

const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const band = { hasSurvey: false, isWorking: true, maxRows: 14, bodyColumns: 120 } as never
const NOW = Date.parse('2026-10-20T10:00:00Z')
const toasts: string[] = []
const sounds: string[] = []

// The core edition: no Cyberpunk Skins add-on.
const base = (on: On, context = 100_000, addon = false) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('fs.exists', async (_$, e) => ({ value: addon && /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
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
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: context }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  return clock
}
const start = async ($: Engine, skin: string) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  if (skin) await $.command.run({ command: 'skin', args: skin } as never)
}
const svgs = async ($: Engine, component: 'Pane' | 'AbovePrompt') => {
  const ui =
    component === 'Pane'
      ? await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
      : await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: band })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await ui.unmount()
  return all
}
const skinList = async ($: Engine) => String(((await $.command.run({ command: 'skin', args: 'list' } as never)) as { text?: string }).text)
const CYBER = ['BREACH PROTOCOL', 'STREET CRED', 'MAXTAC', '€$', 'AFTERLIFE', 'BRAINDANCE', 'MIKOSHI', 'JACKING IN', 'CYBERPSYCHOSIS']

test('mentalist: Personnel File, Case Board, Cold Read, Closed Files and an episode, with no cyberpunk words', async ($, on) => {
  base(on)
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'Fix the login bug', cursor: 0 } as never)
  const paneSvg = (await svgs($, 'Pane')).join('')
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  for (const word of ['COLD READ', 'CASE BOARD', 'PERSONNEL FILE', 'CLOSED FILES', 'CBI · Serious Crimes Unit', 'CLEARANCE', 'PATRICK JANE', 'EVIDENCE', 'SEALED', 'photo goes here']) expect(paneSvg).toContain(word)
  expect(paneSvg).not.toContain('CBI CRED')
  expect(paneSvg).toContain('Carnival Kid')
  expect(paneSvg).toContain('Next: FIRST CASE')
  // The slim band: one quiet cold-read line, no label gutter, no skin chip, no beam or brackets.
  expect(bandSvg).toContain('“')
  expect(bandSvg).not.toContain('COLD READ')
  expect(bandSvg).toContain('MISSION CONTROL')
  for (const label of ['CREW', 'STEPS', 'TOKENS', 'SESSION']) expect(bandSvg).not.toContain(`>${label}<`)
  expect(bandSvg).not.toContain('MENTALIST')
  expect(bandSvg).not.toContain('class="beam"')
  expect(bandSvg).not.toContain('class="brk"')
  expect(bandSvg).toMatch(/viewBox="0 0 \d+ 132"/)
  const ep = episodeAt(NOW)
  expect(bandSvg).toContain(ep.split(' ')[1] as string) // the episode code, e.g. S4E7
  expect(EPISODES.some(e => e.startsWith(ep.split(' ')[1] as string))).toBe(true)
  for (const word of CYBER) {
    expect(paneSvg).not.toContain(word)
    expect(bandSvg).not.toContain(word)
  }
  // Core edition: no add-on sounds, no katakana, no relic glitch.
  expect(bandSvg).not.toContain('class="rg"')
  expect(bandSvg).not.toContain('ミッション')
  for (const src of [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))]) expect(src.length).toBeLessThan(131072)
})

test('mentalist: costs stay in dollars, and the hidden smiley and the tea chip come with a full context', async ($, on) => {
  base(on, 870_000)
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  let bandSvg = (await svgs($, 'AbovePrompt')).join('')
  expect(bandSvg).toContain('NEEDS TEA')
  expect(bandSvg).not.toContain('class="rjs"') // not yet: the smiley waits for 95%
  expect(bandSvg).toContain('$0.00')
  expect(bandSvg).not.toContain('€$')
})

test('mentalist: past 95% context Red John is watching, in red, with a faint smiley', async ($, on) => {
  base(on, 960_000)
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  expect(bandSvg).toContain('RED JOHN IS WATCHING')
  expect(bandSvg).toContain(`fill="${RED}"`)
  expect(bandSvg).toContain('class="rjs"')
  expect(bandSvg).not.toContain('MAXTAC')
  expect(sounds.join('')).not.toContain('maxtac')
})

test('red-john: hidden from /skin until worn; /skin red-john works in the core edition and draws the smiley', async ($, on) => {
  base(on)
  toasts.length = 0
  await start($, '')
  expect(await skinList($)).not.toContain('red-john')
  expect(await skinList($)).toContain('mentalist')
  const said = (await $.command.run({ command: 'skin', args: 'red-john' } as never)) as { text?: string }
  expect(String(said.text)).toContain('Skin: Red John')
  expect(toasts.join('\n')).toContain('Tyger Tyger, burning bright')
  expect(sounds.join('')).not.toContain('addons/cyberpunk')
  expect(await skinList($)).toContain('▸ red-john')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  const paneSvg = (await svgs($, 'Pane')).join('')
  expect(paneSvg).toContain('COLD READ')
  expect(paneSvg).toContain(RED)
  for (const word of CYBER) expect(bandSvg + paneSvg).not.toContain(word)
  // The titles after the reveal change colour.
  expect(AFTER_RED.some(t => bandSvg.includes(t.split(' ')[0] as string))).toBe(true)
  for (const src of [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))]) expect(src.length).toBeLessThan(131072)
  // Leaving hides it again.
  await $.command.run({ command: 'skin', args: 'mentalist' } as never)
  expect(await skinList($)).not.toContain('red-john')
})

test('red-john: typing "tyger tyger" on The Mentalist switches skin and leaves the prompt as typed', async ($, on) => {
  base(on)
  toasts.length = 0
  await start($, 'mentalist')
  const out = (await $.prompt.submit({ text: 'Tyger  Tyger, burning bright: fix the build', cursor: 0 } as never)) as { text?: string }
  expect(String(out?.text ?? 'Tyger  Tyger, burning bright: fix the build')).toContain('Tyger  Tyger')
  expect(await skinList($)).toContain('▸ red-john')
  expect(toasts.join('\n')).toContain('Tyger Tyger, burning bright')
})

test('red-john: "tyger tyger" does nothing on other skins', async ($, on) => {
  base(on)
  await start($, 'crab-classic')
  await $.prompt.submit({ text: 'tyger tyger', cursor: 0 } as never)
  expect(await skinList($)).not.toContain('red-john')
  await $.command.run({ command: 'skin', args: 'default' } as never)
  await $.prompt.submit({ text: 'tyger tyger', cursor: 0 } as never)
  expect(await skinList($)).not.toContain('red-john')
})

test('default and crab-classic stay clean of the Mentalist eggs', async ($, on) => {
  base(on, 960_000)
  for (const skin of ['crab-classic', 'default']) {
    await start($, skin)
    await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
    const all = [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))].join('')
    for (const word of ['COLD READ', 'CASE BOARD', 'CBI CRED', 'PERSONNEL FILE', 'CLOSED FILES', 'NEEDS TEA', 'RED JOHN', 'class="rjs"', RED]) expect(all).not.toContain(word)
    expect(EPISODES.some(e => all.includes(e.split(' ')[0] as string))).toBe(false)
  }
})

test('mentalist tables: 39 verified titles, the smiley, the cold reads and the ladder', () => {
  expect(EPISODES.length).toBe(39)
  expect(new Set(EPISODES).size).toBe(39)
  expect(EPISODES).toContain('S2E15 Red Herring')
  expect(episodeAt(0)).toBe('▶︎ S1E3 Red Tide')
  expect(episodeAt(3_600_000)).toContain('S1E4 Ladies in Red')
  expect(episodeAt(0, true)).toBe('☺ S6E9 My Blue Heaven')
  const s = smiley(0, 0, 11)
  expect(s).toContain(RED)
  expect(s.length).toBeLessThan(1500)
  const a = coldReads('Fix the login bug')
  expect(a).toEqual(coldReads('Fix the login bug'))
  expect(new Set(a).size).toBe(3)
  expect(coldReads('').length).toBe(3)
  expect(cbiRankOf(1)).toBe('Carnival Kid')
  expect(cbiRankOf(4)).toBe('Consultant')
  expect(cbiRankOf(5)).toBe('Senior Consultant')
  expect(cbiRankOf(99)).toBe('The Mentalist')
  expect(teaChip(0, 10, 80, { accent: '#fff', warn: '#ee0' } as never, 'serif').w).toBe(0)
  expect(teaChip(0, 10, 90, { accent: '#fff', warn: '#ee0' } as never, 'serif').svg).toContain('NEEDS TEA')
  expect(TEA_WARNING(90)).toContain('/compact')
  expect(TYGER_RE.test('Tyger Tyger')).toBe(true)
  expect(TYGER_RE.test('tiger tiger')).toBe(false)
  const th = { accent: '#8DB4EA', accent2: '#DCE6F5', done: '#7CC9A0', warn: '#E8C26A', text: '#F2F5FA', subtext: '#B4C0D3', muted: '#93A0B5', tile: '#0E1524', track: '#18223A', line: '#22304D' }
  const card = coldReadCard(480, 'Fix the login bug', true, 1, 3, th, 'serif', (x, y, w, h, a) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`)
  expect(card).toContain('COLD READ')
  expect(card).toContain(`height="${COLD_H}"`)
  expect(card).toContain('Reading…')
})


test('the other skins keep the full band: crab-classic, cyberpunk-2077 and breaking-bad still have their old rows', async ($, on) => {
  base(on, 100_000, true)
  for (const skin of ['crab-classic', 'cyberpunk-2077', 'breaking-bad']) {
    await start($, skin)
    await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
    const bandSvg = (await svgs($, 'AbovePrompt')).join('')
    expect(bandSvg).not.toMatch(/viewBox="0 0 \d+ 132"/)
    for (const label of skin === 'crab-classic' ? ['CREW', 'COST'] : ['CREW', 'STEPS', 'TOKENS', 'SESSION']) expect(bandSvg).toContain(`>${label}<`)
    if (skin !== 'crab-classic') expect(bandSvg).toContain('class="cur"')
  }
})

test('mentalist: red-john wears the slim band too', async ($, on) => {
  base(on, 960_000)
  await start($, 'red-john')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  for (const label of ['CREW', 'STEPS', 'TOKENS', 'SESSION']) expect(bandSvg).not.toContain(`>${label}<`)
  expect(bandSvg).toContain('RED JOHN IS WATCHING')
  expect(bandSvg).toMatch(/viewBox="0 0 \d+ 132"/)
})

const TH = { accent: '#8DB4EA', accent2: '#DCE6F5', done: '#7CC9A0', warn: '#E8C26A', alert: '#E0605A', text: '#F2F5FA', subtext: '#B4C0D3', muted: '#93A0B5', tile: '#0E1524', track: '#18223A', line: '#22304D' }
const frame = (x: number, y: number, w: number, h: number, a: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`
const beatsOf = (n: number): Beat[] =>
  Array.from({ length: n }, (_, i) => ({ at: 1_000_000 + i * 38_000, tool: ['Read', 'Grep', 'Edit', 'Agent', 'Bash', 'Glob'][i % 6] as string, who: ['Manager', 'Tester', 'Engineer', 'Lead'][i % 4] as string, text: i % 2 ? 'amended parser.ts' : 'reading the build log' }))

test('personnel file: the badge, the folder, tally marks, the stamp and the evidence tags', () => {
  const cred = { ...BLANK_CRED, xp: 420, jobs: 12, longJobs: 3, agents: 37, badges: ['choom', 'merc'] }
  const f = personnelFile(480, cred, TH, 'serif', frame)
  for (const word of ['PERSONNEL FILE', 'CLEARANCE', 'PATRICK JANE', 'CONSULTANT', 'CASES CLOSED', 'LONG CASES', 'AGENTS BRIEFED', 'SOLVED', 'EVIDENCE', 'SEALED', 'No. 01', '420 / 500 XP', '80 to clearance 5', '2 of 9']) expect(f).toContain(word)
  expect(f).toContain(`height="${fileHeight(480)}"`)
  expect(fileHeight(480)).toBe(440)
  expect(f).toContain('stroke-dasharray="3 3"') // sealed tags are dashed
  // First day: no cases, no stamp, level 1, an all-quiet barcode.
  const first = personnelFile(480, { ...BLANK_CRED, xp: 8 }, TH, 'serif', frame)
  expect(first).not.toContain('SOLVED')
  expect(first).toContain('Carnival Kid')
  expect(first).toContain('—')
  // Every badge earned: the footer says so.
  const all = personnelFile(480, { ...BLANK_CRED, xp: 9000, badges: ['choom', 'merc', 'edgerunner', 'legend', 'netrunner', 'crewboss', 'chromed', 'owl', 'samurai'] }, TH, 'serif', frame)
  expect(all).toContain("Tea's on.")
  expect(all).not.toContain('SEALED')
  // Narrow: the folder stacks under the badge; very many cases show +N.
  expect(fileHeight(360)).toBeGreaterThan(fileHeight(480))
  expect(personnelFile(480, { ...BLANK_CRED, jobs: 40 }, TH, 'serif', frame)).toMatch(/\+\d+<\/text>/)
  expect(f.length).toBeLessThan(40_000)
})

test('case board: a corkboard of pinned cards joined by red string, with a taped Polaroid', () => {
  for (const n of [0, 1, 5, 12, 16]) {
    const b = caseBoard(600, beatsOf(n), -1, TH, 'serif', frame)
    expect(b).toContain('CASE BOARD')
    expect(b).toContain(`height="${BOARD_H}"`)
    expect(b.length).toBeLessThan(60_000)
    if (!n) {
      expect(b).toContain('No leads yet.')
      expect(b).toContain('photo goes here')
      continue
    }
    expect(b).toContain('F4F2EC') // the Polaroid
    expect(b).toContain(`No. ${n} of ${n}`)
    expect(b.includes(`stroke="${RED}" stroke-width="1.5"`)).toBe(n > 1) // the string needs two pins
  }
  expect(caseBoard(600, beatsOf(16), -1, TH, 'serif', frame)).toContain('16 leads · last 12 pinned · live')
  expect(caseBoard(600, beatsOf(5), 1, TH, 'serif', frame)).toContain('5 leads · replaying no. 2')
  expect(caseBoard(600, beatsOf(5), 1, TH, 'serif', frame)).toContain('No. 2 of 5')
  expect(caseBoardAlt(beatsOf(12), 6)).toBe('Case board: lead 7 of 12, Engineer studied reading the build log at 03:48')
  // The legend is words as well as colours.
  const wide = caseBoard(600, beatsOf(3), -1, TH, 'serif', frame)
  for (const w of ['>read<', '>ask<', '>change<']) expect(wide).toContain(w)
})

test('context chip: teacup at 85%, red smiley at 95%, nothing below', () => {
  expect(ctxChip(0, 22, 84, TH, 'serif').w).toBe(0)
  expect(ctxChip(0, 22, 88, TH, 'serif').svg).toContain('NEEDS TEA')
  const red = ctxChip(0, 22, 96, TH, 'serif')
  expect(red.svg).toContain('RED JOHN IS WATCHING')
  expect(red.svg).toContain(RED)
})

test('slim band: the task title is plain text on The Mentalist and Red John (no smile glitch hides it)', async ($, on) => {
  base(on)
  for (const skin of ['mentalist', 'red-john']) {
    await start($, skin)
    await $.prompt.submit({ text: 'Fix the login bug', cursor: 0 } as never)
    await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Ship the login fix', total: 4, done: 1, phase: 'delegate' } as never)
    const bandSvg = (await svgs($, 'AbovePrompt')).join('')
    expect(bandSvg).toMatch(/viewBox="0 0 \d+ 132"/)
    expect(bandSvg).toMatch(/<text x="64" y="54"[^>]*>Ship the login fix<\/text>/)
    for (const cls of ['mx-ttl', 'mx-ghost', 'mx-smile']) expect(bandSvg).not.toContain(`class="${cls}"`)
  }
})

test('red-john: the unlock is saved, so a reload still wears it (and lists it)', async ($, on) => {
  base(on)
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'tyger tyger', cursor: 0 } as never)
  expect(await skinList($)).toContain('▸ red-john')
  await start($, '') // a reload: session.start again, the store kept
  expect(await skinList($)).toContain('▸ red-john')
  expect((await svgs($, 'AbovePrompt')).join('')).toMatch(/viewBox="0 0 \d+ 132"/)
})

test('mentalist: the red-smiley heat on the Token Manager card shows when wide, and stays off the title when narrow', async ($, on) => {
  base(on, 900_000)
  await start($, 'mentalist')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  const at = async (bodyColumns: number) => {
    const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: { ...pane, bodyColumns } })
    const card = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).find(s => s.includes('Token Manager')) ?? ''
    await ui.unmount()
    return card
  }
  expect(await at(80)).toContain('scale(.89)')
  const narrow = await at(24)
  expect(narrow).toContain('Token Manager')
  expect(narrow).not.toContain('scale(.89)')
})
