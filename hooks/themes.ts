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
  BATCH_TOAST, BB_CSS, BB_GREETING, BB_BOOT, BB_TITLE_WORDS, BB_TOOLS, EMPIRE_BADGES, EMPIRE_WORDS, HEIS_BOOT, HEIS_GREETING,
  BB_WARNING, crystalGlints, empireRankOf, bbEpisodeAt, yeahScience,
} from './breakingbad'
import { jesseRoamer, jesseCameo } from './breakingbad-jesse'
import { BAND_H, bbChip, bbFoot, bbHead, bbPip, classroomCard, crewPx, empireToast, onAirAlt, onAirCard, periodicCard, purityGauge, sansW, walt } from './breakingbad-cards'
import {
  CBI_BADGES, CBI_WORDS, CLOSED_FILES_TOAST, COLD_W, MENT_CSS, MENTALIST_BOOT, MENTALIST_GREETING, MENTALIST_TOOLS, MENTALIST_WORDS, REDJOHN_BOOT, REDJOHN_GREETING, TEA_WARNING,
  caseClosed, cbiRankOf, cbiToast, coldReadCard, coldReads, coldTicker, episodeAt, hiddenSmiley, smiley,
} from './mentalist'
import { MENT_EXTRA_CSS, cardGlyphs, hypnosis, mentSkyline, redJohnHeat, smileGlitch, teaSteam } from './mentalist-extra'
import { caseBoard, caseBoardAlt, ctxChip, personnelFile } from './mentalist-cards'
import { CAPRICORN_BOOT, CAPRICORN_GREETING, ER2_BAND_H, ER2_BOOT, ER2_CSS, ER2_GREETING, ER2_TITLE_WORDS, ER2_TOOLS, ER2_WARNING, TK_CSS, er2Cheer, er2Chip, er2Crew, er2EpW, er2Ep, er2EpisodeAt, er2Figure, er2Foot, er2Gauge, er2Halo, er2Name, er2PaneCreep, er2PaneSpots, er2Peek, er2Pill, er2Pip, er2Takeover, er2Tear, er2W, isNear } from './edgerunners2'
import { ER2_BADGES, ER2_WORDS as ER2_CRED_WORDS, bootLine, er2RankOf, er2Toast, gigsAlt, gigsCard, syncCard, traceAlt, traceCard } from './edgerunners2-cards'
import { er2Hack } from './edgerunners2-hack'
import { DUET_SEED, duetAt, duetPlan } from './edgerunners2-duet'
import { BAND_H as BCS_BAND_H, BCS_BOOT, BCS_CSS, BCS_GREETING, BCS_TITLE_WORDS, BCS_TOOLS, GENE_BOOT, GENE_GREETING, bcsCheer, bcsChip, bcsCrew, bcsEp, bcsEpW, bcsEpisodeAt, bcsFigure, bcsFoot, bcsGauge, bcsName, bcsTear, bcsWarning, pip as bcsPip } from './bettercallsaul'
import { BCS_BADGES, BCS_CRED_WORDS, attorneyCard, bcsBootLine, bcsRankOf, bcsToast, docketAlt, docketCard, legalPad, legalPadAlt } from './bettercallsaul-cards'
import { mikeCameo, mikeRoamer } from './bettercallsaul-mike'
import { bcsExtras } from './bettercallsaul-extra'
import { zoomWrap } from './bettercallsaul-fx'
import type { Fx } from './bettercallsaul-fx'
import { invTheme } from './invincible-theme'
import { roamPlan } from './roamer'
import type { HackArgs } from './edgerunners2-hack'
import { ER_CAPRI } from './cast'
import type { Sprite } from './cast'
import type { RoamColors, RoamPlan, RoamTiming } from './roamer'
import type { Badge, Beat, Cred, CredWords, Frame } from './extras'
import type { Legend } from './eggs'

/** What the band's figure slot knows: the clock, the context, and whether the job-done celebration is drawing. */
export type FigureCtx = { at: number; ctxPct: number; party?: boolean; fx?: { kind: string; at: number } }
export type ThemeKey = 'mentalist' | 'redjohn' | 'breakingbad' | 'heisenberg' | 'edgerunners2' | 'capricorn' | 'bettercallsaul' | 'gene' | 'invincible' | 'invincible2'
/** The pane cards a roaming act can belong to: the level card, the task card, the log. */
export type PaneCard = 'cred' | 'task' | 'log'
/** What a theme's rare scheduled eggs know (all from the clock, so an idle draw still shows them). */
export type ExtraArgs = { W: number; H: number; surface: 'band' | 'pane'; at: number; ctxPct: number; party?: boolean; card?: PaneCard; unplugAt?: number; fx?: { kind: string; at: number }; /** A job is running (a theme's fights only play then). */ working?: boolean; /** When the last era swap started (Invincible's title-card slam transition). */ swapAt?: number }
/** The skin colours a theme's drawers read. */
export type ThemeColors = { accent: string; accent2: string; done: string; warn: string; alert: string; text: string; subtext: string; muted: string; tile: string; track: string; line: string }
/** What the band knows when it asks for its corner egg. */
export type ThemeCtx = { ctxPct: number; overBudget: boolean; /** The session total cost in dollars (a band's "Total $1.23"). */ totalUsd?: number; /** The clock. */ at?: number; /** Is a job running (the Edgerunners 2 frame runs a beam while it works). */ isWorking?: boolean; /** Is a roaming character out on the band (the Edgerunners 2 HUD turns hers). */ capri?: boolean }

/** A character who wanders through both panels now and then (roamer.ts): her sprite, rim colours, lines and chance. */
export type ThemeRoamer = {
  /** Walks and sits. */
  sprite: Sprite
  colors: RoamColors
  /** Makes her plan her own: the same seed gives the same plan for the same clock. */
  seed: string
  /** What a takeover says, one picked per takeover. */
  lines: string[]
  /** The chance of a walk, peek or sit per 30 s window, higher as the context climbs. */
  chance: (ctxPct: number) => number
  /** Her peek at a band spot (the edge she leans out of); without it the engine's own peek stands at `peekAt`. */
  peek?: (x: number, y: number, plan: RoamPlan, tm: RoamTiming) => string
  /** The pane's spots: where a peek stands and where a sit sits, for a card W by H. */
  spots?: (W: number, H: number) => { peek?: { x: number; y: number }; sit?: { x: number; y: number } }
  /** Always drawn over a card past 95% context (shards creeping in along the edge); `card` is which pane card it is drawn on. */
  creep?: (W: number, H: number, ctxPct: number, card?: PaneCard) => string
  /** The theme's own walk and sit (see roamer.ts RoamTiming): a plain character without the engine's glitch ghosts. */
  walk?: (s: number, dir: 1 | -1) => string
  sit?: (x: number, floorY: number, s: number, dir: 1 | -1) => string
  /** Which pane card an act belongs to (the cameo and a walk on the cred card, a peek on the log, a sit on the task card); without it, the cred card only. */
  cardOf?: (kind: 'walk' | 'peek' | 'sit' | 'takeover') => PaneCard
  /** The framing drawn behind her walk and sit (feet at the origin; `s` her scale). */
  halo?: (s: number, dir: 1 | -1) => string
  /** Keyframes for her own pieces (the takeover's), with a reduced-motion rule. */
  css?: string
  /** The band's spots in place of the engine's (a peek ledge), for a band W by H; the sit on the step bar comes from `sitBar`. */
  bandSpots?: (W: number, H: number) => { peek?: { x: number; y: number } }
  /** She perches on the band's step bar (a theme without a `slim.tear` gauge). */
  sitBar?: boolean
  /** Nothing is drawn while a celebration is (the cheer is the band's own moment). */
  hushParty?: boolean
  /** She never walks, peeks, sits or takes over (CAPRI mode: she is the HUD); only the hack lines and the creep draw. */
  still?: boolean
  /** Lines that flash across a panel now and then (Capri's red hack lines): drawn last, over everything, from the seed and the clock. */
  hack?: (a: HackArgs) => string
}

export type ThemeEggs = {
  // --- the slots every theme fills ---
  /** The band's right edge: the hour's episode. */
  ticker: (at: number) => string
  /** Keyframes for everything the theme draws (with its reduced-motion rule). */
  css: string
  /** The band's middle readout (the cold read, the purity), and the width it needs. */
  readout: { w: number; draw: (x: number, y: number, isWorking: boolean, done: number, total: number, t: ThemeColors, font: string) => string }
  /** The context chip past 85%. */
  /** `W` is the band's width (a chip may wait for room). */
  chip: (x: number, y: number, ctxPct: number, t: ThemeColors, font: string, W?: number) => { svg: string; w: number }
  warning: (ctxPct: number) => string
  /** The cheer when a job is done. */
  cheer: (W: number, H: number, font: string, t: ThemeColors, startAt?: number) => string
  /** `card` is the theme's own cred card; without it the shared medal card is drawn with `title`, `ranks` and `words`. */
  cred: { title: string; ranks: (level: number) => string; words: CredWords; badges: Badge[]; toast: (level: number) => string; card?: (W: number, c: Cred, t: ThemeColors, font: string, frame: Frame) => string }
  /** The pane's card about the task (cold read, lab notes). */
  card: { draw: (W: number, task: string, isWorking: boolean, done: number, total: number, t: ThemeColors, font: string, frame: Frame, legends: Legend[]) => string; alt: (isWorking: boolean, done: number, total: number) => string }
  /** `hidden`: the theme's `card` already draws the closed jobs (the Classroom's honor roll), so the shared legends card is skipped. */
  legends: { title: string; empty: string; icon: string; alt: string; toast: string | ((task: string) => string); hidden?: boolean }
  /** The pane's log of tool calls. `hasControls`: it has the First/Back/Next/Live buttons (a replay timeline). */
  log: { draw: (W: number, beats: Beat[], pick: number, t: ThemeColors, font: string, frame: Frame) => string; hasControls: boolean; alt?: (beats: Beat[], pick: number) => string }
  boot: [string, string]
  /** The pane's boot strip in the theme's own hand, in place of the shared one (W by 30). */
  bootDraw?: (W: number) => string
  greeting: string
  words: string[]
  tools: Record<string, string>
  // --- optional slots: leave out and nothing is drawn ---
  /** Invincible only: which of the skin's two eras this entry draws (1 the classic suit, 2 the new suit). */
  era?: 1 | 2
  /** Characters the pane keeps free for this theme's big eggs while a job works (the layers between `<!--dl-->` markers are not counted, this is instead): the pane never changes layout as they come and go. */
  paneReserve?: number
  /** The panel's camera shake while a fight plays: a CSS animation list for a wrapper group, or '' (see overlay.ts shakeInto). */
  shake?: (o: { W: number; H: number; surface: 'band' | 'pane'; at: number; card?: PaneCard; working?: boolean; fx?: { kind: string; at: number }; swapAt?: number }) => string
  /** Edgerunners 2 only: which of the skin's two modes this entry draws. CAPRI mode has glitches in place of the roamer and the duets. */
  mode?: 'd' | 'capri'
  /** The slim band (two info rows, one quiet cold-read line, no skin chip, beam or brackets) in place of the full HUD band. */
  slimBand?: boolean
  /** What a slim band draws in the theme's own hand (the Breaking Bad band): the name, figure, crew, pips, gauge and foot. A theme without it gets the Mentalist's. */
  slim?: {
    /** The band's height. */
    h: number
    /** The widths its sans really has (the shared guess is too narrow for it). */
    sw: (s: string, size: number, ls?: number, bold?: boolean) => number
    /** The header's start (a logo, then the name's tiles). */
    head: (x: number, y: number, t: ThemeColors, font: string) => { svg: string; w: number }
    /** The figure in the task row (a 34 by 40 box at x 20, y 36); `ctx` is the clock and the context, for a figure that acts now and then (the duets). */
    figure: (ctx?: FigureCtx) => string
    /** One crew member at the top-left, 7 by 10 pixels at 1.4x. */
    crew: (x: number, y: number, color: string) => string
    /** A step pip, centred at (cx, cy). */
    pip: (state: string, cx: number, cy: number, t: ThemeColors) => string
    /** A right-aligned gauge before the episode; dropped first when there is no room. */
    gauge: (xr: number, y: number, isWorking: boolean, done: number, total: number, t: ThemeColors, font: string, ctx?: ThemeCtx) => { svg: string; w: number }
    /** The strip along the foot, with the hidden corner egg. */
    foot: (W: number, H: number, t: ThemeColors, ctx: ThemeCtx) => string
    /** The header's name in the theme's own hand (a paper label, a patch, a line of identity), in place of the plain label; `w` is what it takes. */
    name?: (x: number, y: number, W: number, t: ThemeColors, font: string, ctx?: ThemeCtx) => { svg: string; w: number }
    /** The episode in place of the plain text: its width, and it drawn right-aligned at `xr`; `full` shows the title, else only the code. */
    ep?: { w: (code: string, title: string, full: boolean) => number; draw: (xr: number, y: number, code: string, title: string, full: boolean, t: ThemeColors) => string }
    /** The task row's gauge (x, y, width, percent) in place of the segment bar. */
    tear?: (x: number, y: number, w: number, pct: number, t: ThemeColors, ctx?: ThemeCtx) => string
    /** A chamfered (or other) pill for the status and the role chips, in place of the round rect. */
    pill?: (x: number, y: number, w: number, h: number, fill: string, opacity: number, stroke?: string) => string
    /** The cache bar's own colours (Invincible: Atom Eve's pink energy with a pale core), in place of the state's tone. */
    cache?: { fill: string; core?: string }
    /** The foot draws the band's left edge itself: the engine's thin status edge is left out. */
    ownEdge?: boolean
  }
  /** A character who roams the band and the pane (a walk, a peek, a sit, now and then a takeover). */
  roamer?: ThemeRoamer
  /** Rare scheduled eggs drawn over a panel (a car on the band, a face rising through the floor of a card, a dim): pure functions of the clock. */
  extras?: (o: ExtraArgs) => string
  /** The takeover's look in place of roamer.ts's (a dark scrim, her big, a bubble): a cover over the panel W by H, timed by `tm` (pinned start, or now and start). */
  takeover?: (W: number, H: number, line: string, tm: RoamTiming) => string
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
  glitch: (x, y, text, attrs, titleW) => smileGlitch(x, y, text, attrs, MENT_COLORS, titleW),
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
  readout: { w: 148, draw: (x, y, isWorking, done, total, t, font) => purityGauge(x + 148, y, isWorking, done, total, t, font).svg },
  chip: bbChip,
  slimBand: true,
  slim: {
    h: BAND_H,
    sw: sansW,
    head: (x, y, t, font) => bbHead(x, y, t, font, heis),
    figure: () => walt(20, 36, 34, 40, heis),
    crew: (x, y, color) => crewPx(x, y, 1.4, color),
    pip: bbPip,
    gauge: purityGauge,
    foot: (W, H, t, ctx) => bbFoot(W, H, t, heis, ctx),
  },
  warning: BB_WARNING,
  cheer: yeahScience,
  // The band keeps to its strongest eggs: the episode, Br and Ba, purity, the chip, the desert, the hat.
  afterimages: crystalGlints,
  cred: { title: 'PERIODIC TABLE', ranks: empireRankOf, words: EMPIRE_WORDS, badges: EMPIRE_BADGES, toast: empireToast, card: (W, c, t, font, frame) => periodicCard(W, c, t, font, frame, heis) },
  card: {
    draw: (W, task, isWorking, done, total, t, font, frame, legends) => classroomCard(W, task, isWorking, done, total, legends, t, font, frame, heis),
    alt: (isWorking, done, total) => `Classroom: ${isWorking ? 'in the lab' : 'waiting'}, ${done} of ${total} steps`,
  },
  legends: { title: 'HONOR ROLL', empty: 'Nobody yet. A batch that runs 3+ minutes goes up here.', icon: '', alt: 'Honor roll', toast: BATCH_TOAST, hidden: true },
  log: { draw: (W, beats, pick, t, font, frame) => onAirCard(W, beats, pick, t, font, frame, heis), hasControls: true, alt: onAirAlt },
  boot: (heis ? HEIS_BOOT : BB_BOOT) as [string, string],
  greeting: heis ? HEIS_GREETING : BB_GREETING,
  words: BB_TITLE_WORDS,
  tools: BB_TOOLS,
  // Jesse roams both panels now and then, and a small cameo takes the place of the takeover.
  roamer: jesseRoamer(heis),
  takeover: (W, H, line, tm) => jesseCameo(W, H, line, tm),
})


// Edgerunners 2 v2 "D's optics" (and its secret CAPRICORN skin): a glass HUD in cobalt and ice, Capri's pink and green
// only when she is near. The band is the slim band in the theme's own hand; NEURAL SYNC is the level card, NETRUN TRACE
// the log, CLOSED GIGS the closed jobs.
// The roamer's chances, shared by the roamer and by the duets (which never double her): fewer appearances at 95%+ than before,
// so that the pair has the free windows the duets need (a duet every ~1.5 min there).
const er2Chance = (sec: boolean) => (ctxPct: number): number => (sec ? 0.6 : ctxPct >= 95 ? 0.55 : ctxPct >= 85 ? 0.45 : 0.3)
const ER2_LINES = ['hi, choom.', 'hi.', 'just me, choom.', 'bye-bye, choomba!']
const er2RoamFor = (ctxPct: number) => (windowStart: number) => roamPlan('er2', windowStart, { chance: er2Chance(false)(ctxPct), takeoverEveryMin: 30, lines: ER2_LINES })
const er2Theme = (sec: boolean): ThemeEggs => ({
  mode: sec ? 'capri' : 'd',
  ticker: er2EpisodeAt,
  css: ER2_CSS,
  readout: { w: 0, draw: () => '' },
  chip: (x, y, ctxPct, _t, _f, W) => er2Chip(x, y, ctxPct, sec, W),
  slimBand: true,
  slim: {
    h: ER2_BAND_H,
    sw: (s, size, ls = 0, bold = false) => er2W(s, size, ls, bold ? 700 : 500),
    head: () => ({ svg: '', w: 0 }),
    name: (x, y, W, _t, _f, ctx) => er2Name(x, y, W, sec, isNear(ctx, sec)),
    ep: { w: er2EpW, draw: (xr, y, code, title, full) => er2Ep(xr, y, code, title, full, sec) },
    tear: (x, y, w, pct, _t, ctx) => er2Tear(x, y, w, pct, sec, isNear(ctx, sec)),
    pill: er2Pill,
    ownEdge: true,
    figure: ctx => {
      if (sec || !ctx || ctx.party) return er2Figure(sec)
      return duetAt(duetPlan(DUET_SEED, ctx.at, ctx.ctxPct, er2RoamFor(ctx.ctxPct)), ctx.at) || er2Figure(false)
    },
    crew: (x, y, color) => er2Crew(x, y, color),
    pip: (st, cx, cy) => er2Pip(st, cx, cy, sec),
    gauge: (xr, y, isWorking, _d, _t, _c, _f, ctx) => er2Gauge(xr, y, isWorking, isNear(ctx, sec), sec),
    foot: (W, H, _t, ctx) => er2Foot(W, H, sec, ctx),
  },
  warning: ER2_WARNING,
  cheer: (W, H) => er2Cheer(W, H, sec),
  cred: { title: 'NEURAL SYNC', ranks: er2RankOf, words: ER2_CRED_WORDS, badges: ER2_BADGES, toast: er2Toast, card: (W, c) => syncCard(W, c, sec) },
  card: {
    draw: (W, _task, _isWorking, _done, _total, _t, _font, _frame, legends) => gigsCard(W, legends, sec),
    alt: () => 'Closed gigs',
  },
  legends: { title: 'CLOSED GIGS', empty: 'No gigs closed yet. Finish one and it posts here.', icon: '◢', alt: 'Closed gigs', toast: 'Gig posted to the net log.', hidden: true },
  log: { draw: (W, beats, pick) => traceCard(W, beats, pick, sec), hasControls: true, alt: traceAlt },
  boot: sec ? CAPRICORN_BOOT : ER2_BOOT,
  bootDraw: W => bootLine(W, sec, sec ? CAPRICORN_BOOT : ER2_BOOT),
  greeting: sec ? CAPRICORN_GREETING : ER2_GREETING,
  words: ER2_TITLE_WORDS,
  tools: ER2_TOOLS,
  roamer: {
    sprite: ER_CAPRI,
    // Her pink rim keeps a dark sprite visible on glass; the data trail she sheds is acid green.
    colors: { accent: '#FF2E7E', accent2: '#3DF27A', text: '#F7F4EA' },
    seed: sec ? 'capricorn' : 'er2',
    lines: sec ? ["we're one now."] : ER2_LINES,
    // She comes more often as the context climbs: a little at the start, much more near 95%.
    chance: er2Chance(sec),
    still: sec,
    peek: (x, y, plan, tm) => er2Peek(x, y, plan, tm),
    spots: er2PaneSpots,
    creep: er2PaneCreep,
    halo: er2Halo,
    css: TK_CSS,
    hack: a => er2Hack(sec ? 'capricorn' : 'er2', a, sec),
  },
  takeover: (W, H, line, tm) => er2Takeover(W, H, line, tm, sec),
})

// Better Call Saul (and its hidden GENE skin): the strip-mall law office. The band is the slim band in the theme's own hand;
// ATTORNEY AT LAW is the level card, LEGAL PAD the log, THE DOCKET the task card and the closed jobs. Mike roams.
const saulTheme = (gene: boolean): ThemeEggs => ({
  ticker: bcsEpisodeAt,
  css: BCS_CSS,
  readout: { w: 0, draw: () => '' },
  chip: (x, y, ctxPct) => bcsChip(x, y, ctxPct, gene),
  slimBand: true,
  slim: {
    h: BCS_BAND_H,
    sw: sansW,
    head: () => ({ svg: '', w: 0 }),
    name: (x, y, W, _t, _f, ctx) => bcsName(x, y, W, gene, ctx?.totalUsd ?? 0),
    ep: { w: bcsEpW, draw: (xr, y, code, title, full) => bcsEp(xr, y, code, title, full, gene) },
    tear: (x, y, w, pct, _t, ctx) => bcsTear(x, y, w, pct, ctx?.ctxPct ?? 0, gene),
    figure: ctx => zoomWrap(bcsFigure(gene), ctx?.fx as Fx | undefined, ctx?.at ?? 0),
    crew: (x, y, color) => bcsCrew(x, y, color, gene),
    pip: (st, cx, cy) => bcsPip(st, cx, cy, gene),
    gauge: (xr, y, isWorking, done, total) => bcsGauge(xr, y, isWorking, done, total, gene),
    foot: (W, H, _t, ctx) => bcsFoot(W, H, ctx, gene),
  },
  warning: bcsWarning(gene),
  cheer: (W, H, _font, _t, startAt) => bcsCheer(W, H, gene, startAt),
  cred: { title: 'ATTORNEY AT LAW', ranks: bcsRankOf, words: BCS_CRED_WORDS, badges: BCS_BADGES, toast: bcsToast, card: (W, c) => attorneyCard(W, c, gene) },
  card: {
    draw: (W, task, isWorking, done, total, _t, _font, _frame, legends) => docketCard(W, task, isWorking, done, total, legends, gene),
    alt: docketAlt,
  },
  legends: { title: 'CLOSED CASES', empty: 'No closed cases yet. A matter that runs 3+ minutes gets filed here.', icon: '', alt: 'Closed cases', toast: task => `Filed: ${task}`, hidden: true },
  log: { draw: (W, beats, pick) => legalPad(W, beats, pick, gene), hasControls: true, alt: legalPadAlt },
  boot: (gene ? GENE_BOOT : BCS_BOOT) as [string, string],
  bootDraw: W => bcsBootLine(W, gene),
  greeting: gene ? GENE_GREETING : BCS_GREETING,
  words: BCS_TITLE_WORDS,
  tools: BCS_TOOLS,
  roamer: mikeRoamer(gene),
  takeover: (W, H, line, tm) => mikeCameo(W, H, line, tm, gene),
  extras: bcsExtras(gene),
})

export const THEMES: Record<ThemeKey, ThemeEggs> = {
  invincible: invTheme(1),
  invincible2: invTheme(2),
  bettercallsaul: saulTheme(false),
  gene: saulTheme(true),
  mentalist: caseTheme(false),
  redjohn: caseTheme(true),
  breakingbad: bbTheme(false),
  heisenberg: bbTheme(true),
  edgerunners2: er2Theme(false),
  capricorn: er2Theme(true),
}
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]
export const themeKeyOf = (cast: string | undefined): ThemeKey | undefined => (cast && Object.hasOwn(THEMES, cast) ? (cast as ThemeKey) : undefined)
