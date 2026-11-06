// Themed (non-cyberpunk) easter eggs, one table per skin family.
//
// A themed skin is a `ThemeEggs` entry in THEMES, keyed by its cast. register.tsx asks
// `themeOf()` and draws whatever the entry gives; nothing there is named after a show.
//
// HOW TO ADD A SLOT FOR A THEME (e.g. a skyline for the Mentalist):
//   1. Write a pure function that returns an SVG string (no `$`, no state) next to the
//      theme's other drawers (mentalist.ts, breakingbad.ts).
//   2. Put it in the theme's entry below under the optional field of the same name. The
//      optional slots are `skyline`, `afterimages`, `heat` (+ `heatLabel`), `glyphs`,
//      `glitch`, `tiles`, `mark` and `logo`; a theme that leaves one out simply draws
//      nothing there. Its colours come from the `ThemeColors` the caller passes in.
//   3. Add the motion it needs to the theme's `css` (and a prefers-reduced-motion rule).
//   4. A new theme (not a new slot) also needs: its key in ThemeKey, a COLORS row and a
//      sysTag code in eggs.ts, its cast key in cast.ts, and its skin in register.tsx.

import {
  BATCH_TOAST, BB_CSS, BB_GREETING, BB_BOOT, BB_TITLE_WORDS, BB_TOOLS, EMPIRE_BADGES, EMPIRE_WORDS, HEIS_BOOT, HEIS_GREETING, PURITY_W,
  BB_WARNING, crystalChip, crystalGlints, desertSkyline, elementTiles, empireCard, empireRankOf, empireToast, hatMark, hiddenHat, labLogCard, labNotesCard, bbEpisodeAt, purityTicker, yeahScience,
} from './breakingbad'
import {
  CBI_BADGES, CBI_WORDS, CLOSED_FILES_TOAST, COLD_W, MENT_CSS, MENTALIST_BOOT, MENTALIST_GREETING, MENTALIST_TOOLS, MENTALIST_WORDS, REDJOHN_BOOT, REDJOHN_GREETING, TEA_WARNING,
  caseClosed, cbiRankOf, cbiToast, coldReadCard, coldReads, coldTicker, episodeAt, hiddenSmiley, smiley,
} from './mentalist'
import { MENT_EXTRA_CSS, cardGlyphs, hypnosis, mentSkyline, redJohnHeat, smileGlitch, teaSteam } from './mentalist-extra'
import { caseBoard, caseBoardAlt, ctxChip, personnelFile } from './mentalist-cards'
import type { Badge, Beat, Cred, CredWords, Frame } from './extras'

export type ThemeKey = 'mentalist' | 'redjohn' | 'breakingbad' | 'heisenberg'
/** The skin colours a theme's drawers read. */
export type ThemeColors = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }
/** What the band knows when it asks for its corner egg. */
export type ThemeCtx = { ctxPct: number; overBudget: boolean }

export type ThemeEggs = {
  // --- the slots every theme fills ---
  /** The band's right edge: the hour's episode. */
  ticker: (at: number) => string
  /** Keyframes for everything the theme draws (with its reduced-motion rule). */
  css: string
  /** The band's middle readout (the cold read, the purity), and the width it needs. */
  readout: { w: number; draw: (x: number, y: number, isWorking: boolean, done: number, total: number, t: ThemeColors, font: string) => string }
  /** The context chip past 85%. */
  chip: (x: number, y: number, ctxPct: number, t: ThemeColors, font: string) => { svg: string; w: number }
  warning: (ctxPct: number) => string
  /** The cheer when a job is done. */
  cheer: (W: number, H: number, font: string, t: ThemeColors, startAt?: number) => string
  /** `card` is the theme's own cred card; without it the shared medal card is drawn with `title`, `ranks` and `words`. */
  cred: { title: string; ranks: (level: number) => string; words: CredWords; badges: Badge[]; toast: (level: number) => string; card?: (W: number, c: Cred, t: ThemeColors, font: string, frame: Frame) => string }
  /** The pane's card about the task (cold read, lab notes). */
  card: { draw: (W: number, task: string, isWorking: boolean, done: number, total: number, t: ThemeColors, font: string, frame: Frame) => string; alt: (isWorking: boolean, done: number, total: number) => string }
  legends: { title: string; empty: string; icon: string; alt: string; toast: string }
  /** The pane's log of tool calls. `hasControls`: it has the First/Back/Next/Live buttons (a replay timeline). */
  log: { draw: (W: number, beats: Beat[], pick: number, t: ThemeColors, font: string, frame: Frame) => string; hasControls: boolean; alt?: (beats: Beat[], pick: number) => string }
  boot: [string, string]
  greeting: string
  words: string[]
  tools: Record<string, string>
  // --- optional slots: leave out and nothing is drawn ---
  /** The slim band (two info rows, one quiet cold-read line, no skin chip, beam or brackets) in place of the full HUD band. */
  slimBand?: boolean
  /** One line of the cold read for the slim band. */
  coldLine?: (task: string) => string
  /** The slim band's idle drawing (a cup of tea): the top-left of a 12 by 16 box. */
  idle?: (x: number, y: number, t: ThemeColors) => string
  /** The pane's own eggs: a skyline on the org chart's floor, a faint drift of glyphs behind it, and heat for a high spend. */
  pane?: {
    backdrop: (W: number, H: number, at: number, t: ThemeColors) => string
    heat: (x: number, y: number, level: number, t: ThemeColors) => string
    heatW: number
  }
  /** The faint hidden egg in the band's corner. */
  corner?: (W: number, H: number, ctx: ThemeCtx) => string
  /** A mark beside the task's title (a hat). */
  mark?: (x: number, y: number) => string
  /** In place of the header's diamond. */
  logo?: (x: number, y: number) => string
  /** Small tiles beside the dashboard's name. */
  tiles?: (x: number, y: number, t: ThemeColors, font: string) => { svg: string; w: number }
  /** Drifting glyphs in the strip under the dashboard's name. */
  glyphs?: (x: number, y: number, w: number, t: ThemeColors, font: string) => string
  /** The low skyline along the band's foot. */
  skyline?: (W: number, y0: number, h: number, t: ThemeColors) => string
  /** Trails behind a working figure; `box` is where the figure stands. */
  afterimages?: (figure: string, box: { x: number; y: number; w: number; h: number }) => { defs: string; svg: string }
  /** Heat stars for a 0-5 level, the readout's label, and a second source of heat (the task's time). */
  heat?: (x: number, y: number, level: number, t: ThemeColors) => string
  heatLabel?: string
  heatFromTime?: (ms: number) => number
  /** The task title with a glitch; `titleW` is the room it has. */
  glitch?: (x: number, y: number, text: string, attrs: string, titleW: number) => string
}

const MENT_COLORS = { accent: '#8DB4EA', accent2: '#DCE6F5', done: '#7CC9A0', warn: '#E8C26A', text: '#F2F5FA', subtext: '#B4C0D3', muted: '#93A0B5', tile: '#0E1524', track: '#18223A', line: '#22304D' }
const caseTheme = (red: boolean): ThemeEggs => ({
  ticker: at => episodeAt(at, red),
  css: `${MENT_CSS}${MENT_EXTRA_CSS}`,
  readout: { w: COLD_W, draw: coldTicker },
  chip: ctxChip,
  slimBand: true,
  coldLine: task => coldReads(task, 1)[0] ?? '',
  idle: teaSteam,
  glitch: (x, y, text, attrs) => smileGlitch(x, y, text, attrs, MENT_COLORS),
  afterimages: (_figure, box) => ({ defs: '', svg: hypnosis(box.x + box.w / 2, box.y + box.h / 2, MENT_COLORS, 0) }),
  pane: {
    backdrop: (W, H, at, t) => `<g opacity=".55">${cardGlyphs(W, H, at, t)}</g><g transform="translate(0 ${H - 26})" opacity=".7">${mentSkyline(W, 24, t, red)}</g>`,
    heat: redJohnHeat,
    heatW: 52,
  },
  warning: TEA_WARNING,
  cheer: caseClosed,
  corner: red ? undefined : (W, H, x) => (x.ctxPct >= 95 || x.overBudget ? hiddenSmiley(W, H) : ''),
  logo: red ? (x, y) => smiley(x, y, 11, 1, 'rjs') : undefined,
  cred: { title: 'PERSONNEL FILE', ranks: cbiRankOf, words: CBI_WORDS, badges: CBI_BADGES, toast: cbiToast, card: (W, c, t, font, frame) => personnelFile(W, c, t, font, frame) },
  card: {
    draw: (W, task, isWorking, done, total, t, font, frame) => coldReadCard(W, task, isWorking, done, total, t, font, frame, red),
    alt: (isWorking, done, total) => `Cold read: ${isWorking ? 'reading' : 'waiting'}, ${done} of ${total} steps`,
  },
  legends: { title: 'CLOSED FILES', empty: 'No closed files yet. Close a case.', icon: '🗂', alt: 'Closed files', toast: CLOSED_FILES_TOAST },
  log: { draw: (W, beats, pick, t, font, frame) => caseBoard(W, beats, pick, t, font, frame), hasControls: true, alt: caseBoardAlt },
  boot: (red ? REDJOHN_BOOT : MENTALIST_BOOT) as [string, string],
  greeting: red ? REDJOHN_GREETING : MENTALIST_GREETING,
  words: red ? [] : MENTALIST_WORDS,
  tools: red ? {} : MENTALIST_TOOLS,
})

const bbTheme = (heis: boolean): ThemeEggs => ({
  ticker: bbEpisodeAt,
  css: BB_CSS,
  readout: { w: PURITY_W, draw: purityTicker },
  chip: crystalChip,
  warning: BB_WARNING,
  cheer: yeahScience,
  corner: heis ? undefined : (W, H, x) => (x.ctxPct >= 95 || x.overBudget ? hiddenHat(W, H) : ''),
  mark: heis ? hatMark : undefined,
  // The band keeps to its strongest eggs: the episode, Br and Ba, purity, the chip, the skyline, the hat.
  // (heat, glyphs and glitch are free slots; crystalGlints trails the figure in the pane only.)
  tiles: elementTiles,
  skyline: desertSkyline,
  afterimages: crystalGlints,
  cred: { title: 'EMPIRE CRED', ranks: empireRankOf, words: EMPIRE_WORDS, badges: EMPIRE_BADGES, toast: empireToast, card: empireCard },
  card: {
    draw: (W, task, isWorking, done, total, t, font, frame) => labNotesCard(W, task, isWorking, done, total, t, font, frame, heis),
    alt: (isWorking, done, total) => `Lab notes: ${isWorking ? 'in the lab' : 'waiting'}, ${done} of ${total} steps`,
  },
  legends: { title: 'THE EMPIRE', empty: 'No empire yet. Finish a batch.', icon: '⚗︎', alt: 'The Empire', toast: BATCH_TOAST },
  log: { draw: (W, beats, _pick, t, font, frame) => labLogCard(W, beats, t, font, frame), hasControls: false },
  boot: (heis ? HEIS_BOOT : BB_BOOT) as [string, string],
  greeting: heis ? HEIS_GREETING : BB_GREETING,
  words: BB_TITLE_WORDS,
  tools: BB_TOOLS,
})

export const THEMES: Record<ThemeKey, ThemeEggs> = {
  mentalist: caseTheme(false),
  redjohn: caseTheme(true),
  breakingbad: bbTheme(false),
  heisenberg: bbTheme(true),
}
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]
export const themeKeyOf = (cast: string | undefined): ThemeKey | undefined => (cast && Object.hasOwn(THEMES, cast) ? (cast as ThemeKey) : undefined)
