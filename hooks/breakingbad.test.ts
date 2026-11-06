import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { BB_EPISODES, HEIS_GREETING, SAY_MY_NAME_RE, bbEpisodeAt, empireRankOf, labNotes } from './breakingbad'
import { BAND_H, bbChip, classroomCard, empireToast, onAirAlt, onAirCard, periodicCard, purityOf, sansW } from './breakingbad-cards'
import { CASTS } from './cast'
import { contrast } from './skinkit'

const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const band = { hasSurvey: false, isWorking: true, maxRows: 14, bodyColumns: 120 } as never
const NOW = Date.parse('2026-10-20T10:00:00Z')
const toasts: string[] = []
const sounds: string[] = []

// The core edition: no Cyberpunk Skins add-on.
const base = (on: On, context = 100_000) => {
  const clock = mock.clock(on, { now: NOW })
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
const MENT = ['COLD READ', 'CBI CRED', 'CASE BOARD', 'CLOSED FILES', 'NEEDS TEA']
const frame = (x: number, y: number, w: number, h: number, a: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`
const TH = { accent: '#5EC8F0', accent2: '#4FB37A', done: '#7FD48F', warn: '#F2C318', alert: '#E0605A', text: '#F2F5F0', subtext: '#B9C7BC', muted: '#94A598', tile: '#0F1A14', track: '#18261D', line: '#22352A' }

test('breaking-bad: periodic table, on air, classroom and the slim band; no cyber or Mentalist words', async ($, on) => {
  base(on)
  await start($, 'breaking-bad')
  await $.prompt.submit({ text: 'Fix the login bug', cursor: 0 } as never)
  const paneSvg = (await svgs($, 'Pane')).join('')
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  for (const word of ['PERIODIC TABLE', 'A1A CAR WASH', 'HAVE AN A1A DAY!', 'Hydrogen', 'ON AIR', 'CLASSROOM', 'HONOR ROLL', 'OPENING THE LAB', 'Chemistry Teacher']) expect(paneSvg).toContain(word)
  for (const word of ['LAB NOTES', 'LAB LOG', 'EMPIRE CRED', 'THE EMPIRE', 'ELEMENTS DISCOVERED']) expect(paneSvg).not.toContain(word)
  expect(bandSvg).toContain('MISSION CONTROL')
  expect(bandSvg).toContain('PURITY')
  expect(bandSvg).toContain('96.2%')
  expect(bandSvg).toContain('<title>99.1%</title>')
  expect(bandSvg).toContain(bbEpisodeAt(NOW).split(' ').slice(1).join(' '))
  expect(bandSvg).toContain('>Br<')
  expect(bandSvg).toContain('>Ba<')
  expect(bandSvg).toMatch(new RegExp(`viewBox="0 0 \\d+ ${BAND_H}"`))
  expect(bandSvg).toContain('class="bbwin"') // the desert's RV window
  // The slim band has no gutter of CREW / STEPS / TOKENS / SESSION, no chicken sign, no glyph markers.
  for (const word of ['CREW', 'STEPS', 'TOKENS', 'SESSION', '▮', '◆', '▶︎', '⚗']) expect(bandSvg).not.toContain(word)
  for (const word of [...CYBER, ...MENT]) {
    expect(paneSvg).not.toContain(word)
    expect(bandSvg).not.toContain(word)
  }
  expect(bandSvg).not.toContain('class="rg"')
  expect(bandSvg).not.toContain('ミッション')
  expect(sounds.join('')).not.toContain('addons/cyberpunk')
  for (const src of [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))]) expect(src.length).toBeLessThan(131072)
})

test('other skins keep their own bands: crab-classic and cyberpunk-2077 stay full bands, no Br Ba', async ($, on) => {
  base(on)
  for (const skin of ['crab-classic', 'cyberpunk-2077']) {
    await start($, skin)
    await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
    const b = (await svgs($, 'AbovePrompt')).join('')
    expect(b).not.toContain('>Br<')
    expect(b).not.toContain('PURITY')
    expect(b).not.toMatch(new RegExp(`viewBox="0 0 \\d+ ${BAND_H}"`))
  }
})

test('breaking-bad: the context chip and the hidden hat come with a full context; costs stay in dollars', async ($, on) => {
  base(on, 870_000)
  await start($, 'breaking-bad')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  let bandSvg = (await svgs($, 'AbovePrompt')).join('')
  expect(bandSvg).toContain('NO HALF MEASURES')
  expect(bandSvg).not.toContain('class="bbhat"')
  expect(bandSvg).toContain('$0.00')
  expect(bandSvg).not.toContain('€$')
})

test('breaking-bad: past 95% context it says SAY MY NAME in the alert colour, with a faint hat', async ($, on) => {
  base(on, 960_000)
  await start($, 'breaking-bad')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  expect(bandSvg).toContain('SAY MY NAME')
  expect(bandSvg).toContain('#E0605A')
  expect(bandSvg).toContain('class="bbhat"')
  expect(bandSvg).not.toContain('MAXTAC')
})

test('heisenberg: hidden until worn; /skin heisenberg works in core and shows the hat', async ($, on) => {
  base(on)
  toasts.length = 0
  await start($, '')
  expect(await skinList($)).not.toContain('heisenberg')
  expect(await skinList($)).toContain('breaking-bad')
  const said = (await $.command.run({ command: 'skin', args: 'heisenberg' } as never)) as { text?: string }
  expect(String(said.text)).toContain('Skin: Heisenberg')
  expect(toasts.join('\n')).toContain(HEIS_GREETING)
  expect(sounds.join('')).not.toContain('addons/cyberpunk')
  expect(await skinList($)).toContain('▸ heisenberg')
  await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
  const bandSvg = (await svgs($, 'AbovePrompt')).join('')
  // The hat is the logo (no corner hat while he already wears it), before crystal-blue Br Ba.
  expect(bandSvg).not.toContain('class="bbhat"')
  expect(bandSvg).toContain('fill="#5EC8F0"><title>Br 35</title>')
  expect(bandSvg).toContain('PURITY')
  const paneSvg = (await svgs($, 'Pane')).join('')
  expect(paneSvg).toContain('SAY MY NAME…')
  expect(paneSvg).toContain('PERIODIC TABLE')
  for (const word of [...CYBER, ...MENT]) expect(bandSvg + paneSvg).not.toContain(word)
  await $.command.run({ command: 'skin', args: 'breaking-bad' } as never)
  expect(await skinList($)).not.toContain('heisenberg')
})

test('heisenberg: "say my name" on Breaking Bad switches skin and leaves the prompt as typed; nothing on other skins', async ($, on) => {
  base(on)
  await start($, 'breaking-bad')
  const out = (await $.prompt.submit({ text: 'Say  MY name and fix the build', cursor: 0 } as never)) as { text?: string }
  expect(String(out?.text ?? 'Say  MY name and fix the build')).toContain('Say  MY name')
  expect(await skinList($)).toContain('▸ heisenberg')
  await $.command.run({ command: 'skin', args: 'crab-classic' } as never)
  await $.prompt.submit({ text: 'say my name', cursor: 0 } as never)
  expect(await skinList($)).not.toContain('heisenberg')
})

test('default and crab-classic stay clean of the Breaking Bad eggs', async ($, on) => {
  base(on, 960_000)
  for (const skin of ['crab-classic', 'default']) {
    await start($, skin)
    await $.prompt.submit({ text: 'Fix it', cursor: 0 } as never)
    const all = [...(await svgs($, 'Pane')), ...(await svgs($, 'AbovePrompt'))].join('')
    for (const word of ['LAB NOTES', 'PERIODIC TABLE', 'ON AIR', 'CLASSROOM', 'PURITY', 'NO HALF MEASURES', 'SAY MY NAME', 'bbhat']) expect(all).not.toContain(word)
    expect(BB_EPISODES.some(e => all.includes(e.split(' ')[0] as string))).toBe(false)
  }
})

test('breaking bad tables: 35 verified titles, purity, notes, the ladder and the cards', () => {
  expect(BB_EPISODES.length).toBe(35)
  expect(new Set(BB_EPISODES).size).toBe(35)
  expect(BB_EPISODES).toContain('S5E7 Say My Name')
  expect(bbEpisodeAt(0)).toBe('S1E1 Pilot')
  expect(purityOf(0, 0)).toBe(96.2)
  expect(purityOf(3, 3)).toBe(99.1)
  expect(purityOf(1, 2)).toBeGreaterThan(97)
  const a = labNotes('Fix the login bug')
  expect(a).toEqual(labNotes('Fix the login bug'))
  expect(new Set(a).size).toBe(3)
  expect(empireRankOf(1)).toBe('Chemistry Teacher')
  expect(empireRankOf(4)).toBe('Cook')
  expect(empireRankOf(99)).toBe('Blue Sky')
  expect(empireToast(5)).toBe('LEVEL 5 · BORON · The Professor')
  expect(bbChip(0, 10, 80, TH, 'sans-serif').w).toBe(0)
  expect(bbChip(0, 10, 90, TH, 'sans-serif').svg).toContain('NO HALF MEASURES')
  expect(bbChip(0, 10, 96, TH, 'sans-serif').svg).toContain('SAY MY NAME')
  expect(sansW('MISSION CONTROL', 9.5, 1.6, true)).toBeGreaterThan(90)
  expect(SAY_MY_NAME_RE.test('Say my name')).toBe(true)
  expect(SAY_MY_NAME_RE.test('say your name')).toBe(false)
})

test('periodic table card: the level is an element, the receipt counts, the badges sit where they live', () => {
  const cred = { xp: 120, jobs: 4, longJobs: 1, agents: 7, crewJobs: 0, nightJobs: 0, chromed: false, samurai: false, badges: ['choom'] }
  const card = periodicCard(480, cred, TH, 'sans-serif', frame)
  for (const w of ['PERIODIC TABLE', 'A1A CAR WASH', 'ALBUQUERQUE, NM', 'BATCHES', 'LONG BATCHES', 'CREW CALLED', '>Helium<', '>He<', '>Br<', '1 of 9', 'NEXT ELEMENT', 'Car Wash Cashier', 'Partner at level 3', '>Ba<']) expect(card).toContain(w)
  expect(card).toContain('ELEMENTS FOUND')
  expect(card).toContain('FIRST BATCH')
  expect(card).not.toContain('NaN')
  expect(periodicCard(480, { ...cred, xp: 0, jobs: 0, longJobs: 0, agents: 0, badges: [] }, TH, 'sans-serif', frame)).toContain('>Hydrogen<')
  const full = periodicCard(480, { ...cred, xp: 99999, badges: ['choom', 'merc', 'edgerunner', 'legend', 'netrunner', 'crewboss', 'chromed', 'owl', 'samurai'] }, TH, 'sans-serif', frame)
  expect(full).toContain('Every element found. Yeah, science!')
  // Narrow and tiny widths still draw.
  for (const w of [360, 280]) {
    const n = periodicCard(w, cred, TH, 'sans-serif', frame, true)
    expect(n).toContain('A1A CAR WASH')
    expect(n).not.toContain('NaN')
  }
  expect(periodicCard(480, cred, TH, 'sans-serif', frame, true)).toContain('fill="#5EC8F0"')
})

test('on air: the TV shows the picked spot, the listings are one row per call; live, replaying, one, many and empty', () => {
  const beat = (i: number) => ({ at: NOW + i * 60_000, tool: i % 2 ? 'Read' : 'Bash', text: `step ${i} of the job`, who: 'Mr. White' })
  const many = Array.from({ length: 16 }, (_, i) => beat(i))
  const live = onAirCard(600, many, -1, TH, 'sans-serif', frame)
  for (const w of ['ON AIR', '16 spots · last 12 listed · live', 'CH 16', 'No. 16 of 16', 'Study!', 'class="onair"']) expect(live).toContain(w)
  const back = onAirCard(600, many, 2, TH, 'sans-serif', frame)
  expect(back).toContain('replaying no. 3')
  expect(back).toContain('No. 3 of 16')
  expect(back).not.toContain('class="onair"')
  expect(onAirCard(600, [beat(0)], -1, TH, 'sans-serif', frame)).toContain('1 spot · live')
  const off = onAirCard(600, [], -1, TH, 'sans-serif', frame)
  for (const w of ['off air', 'OFF AIR', 'No calls yet.', 'Nothing scheduled.']) expect(off).toContain(w)
  expect(onAirAlt(many, 6)).toContain('spot 7 of 16')
  expect(onAirAlt([], -1)).toContain('off air')
  for (const w of [360, 520, 900]) expect(onAirCard(w, many, -1, TH, 'sans-serif', frame)).not.toContain('NaN')
})

test('classroom: the lesson, the steps and the honor roll', () => {
  const roll = [{ task: 'Refactor the parser', costUsd: 0.42, at: NOW, ms: 14 * 60_000 }, { task: 'Ship it', costUsd: 0.001, at: NOW, ms: 3_720_000 }]
  const c = classroomCard(480, 'Fix the login bug', true, 2, 5, roll, TH, 'sans-serif', frame)
  for (const w of ['CLASSROOM', 'In the lab…', 'Today:', 'Fix the login bug', '2 of 5', 'steps', 'HONOR ROLL', 'Refactor the parser', '14 min · $0.42', '1 h 2 min · $0']) expect(c).toContain(w)
  const e = classroomCard(480, '', false, 0, 0, [], TH, 'sans-serif', frame, true)
  for (const w of ['no lesson yet', 'No steps on the board yet.', 'Nobody yet.', 'Class is in session.']) expect(e).toContain(w)
  expect(c).not.toContain('NaN')
})

test('breaking bad: svg sizes, contrast and sprite sanity', () => {
  for (const fg of ['#F2F5F0', '#B9C7BC', '#94A598']) expect(contrast(fg, '#0F1A14')!).toBeGreaterThan(4.5)
  for (const fg of ['#F4F4F4', '#BDBDC2', '#9A9AA0']) expect(contrast(fg, '#0A0A0B')!).toBeGreaterThan(4.5)
  for (const k of ['breakingbad', 'heisenberg']) {
    const cb = CASTS[k]
    expect(cb).toBeTruthy()
    const all = [cb!.boss, ...Object.values(cb!.roles), ...cb!.crew]
    for (const sp of all) {
      expect(sp.rows.length).toBeGreaterThan(40)
      expect(sp.rows.length).toBeLessThan(50)
      for (const row of sp.rows) for (const ch of row) if (ch !== '.' && ch !== 't') expect(sp.pal[ch]).toBeTruthy()
    }
    expect(cb!.crew.every(sp => sp.rows.some(r => r.includes('t')))).toBe(true)
  }
})
