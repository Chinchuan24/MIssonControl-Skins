// Invincible (fan homage): the theme entry. One skin, two eras: `invTheme(1)` the classic suit (S1-S2) and `invTheme(2)` the new
// suit (S3+); the worn era picks the cast key `invincible` or `invincible2` (the way Edgerunners 2 picks D or CAPRI). The band is
// the slim band in the theme's own hand; COVER STORY is the level card, THE PAGE the log, GDA WALL the task card and the closed jobs.
import { BADGES, GREETING, VERBS, WORDS, bootLine, coverCard, coverToast, pageAlt, pageCard, rankOf, wallAlt, wallCard } from './invincible-cards'
import { BAND_H, CSS, TITLE_WORDS, WARNING, cheer, chip, corner, crew, ep, epW, episodeAt, figure, flightBar, foot, gauge, mug, name, pal, pip, sansW, PROPS } from './invincible'
import type { Era } from './invincible'
import { invExtras, invShake } from './invincible-eggs'
import { FIGHT_PANE_RESERVE } from './invincible-fight'
import type { ThemeEggs } from './themes'

export const BOOT: [string, string] = ['GDA FEED COMING ONLINE…', 'THINK, MARK']

export const invTheme = (era: Era): ThemeEggs => {
  const P = pal(era)
  return {
    era,
    ticker: at => (episodeAt(at) ?? []).join(' '),
    css: CSS,
    readout: { w: 0, draw: () => '' },
    chip: (x, y, ctxPct) => chip(x, y, ctxPct, era),
    slimBand: true,
    slim: {
      h: BAND_H,
      sw: (s, size, ls = 0, bold = false) => sansW(s, size, ls, bold),
      head: () => ({ svg: '', w: 0 }),
      name: (x, y, W, _t, _f, ctx) => name(x, y, W, era, ctx?.totalUsd ?? 0),
      ep: { w: epW, draw: (xr, y, code, title, full) => ep(xr, y, code, title, full, era) },
      tear: (x, y, w, pct, _t, ctx) => flightBar(x, y, w, pct, era, { near: (ctx?.ctxPct ?? 0) >= 95, working: ctx?.isWorking }),
      pill: (x, y, w, h, fill, opacity) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" fill-opacity="${opacity}" stroke="#0B0D14" stroke-width="1.5"/>`,
      cache: { fill: PROPS.eve as string, core: PROPS.evePale as string },
      figure: () => figure(era),
      crew: (x, y, color) => crew(x, y, color, era),
      pip: (st, cx, cy) => pip(st, cx, cy, era),
      gauge: (xr, y, isWorking, done, total) => gauge(xr, y, isWorking, done, total, era),
      foot: (W, H, _t, ctx) => `${foot(W, H, ctx, era)}${corner(W, H, ctx, era)}`,
    },
    idle: (x, y) => mug(x, y, false),
    warning: WARNING,
    cheer: (W, H, _font, _t, startAt) => cheer(W, H, era, startAt === undefined ? {} : { delay: `calc(@@T${Math.round(startAt)}@@ + 0s)` }),
    cred: { title: 'COVER STORY', ranks: rankOf, words: { ...WORDS, badges: BADGES }, badges: BADGES, toast: coverToast, card: (W, c) => coverCard(W, c, { era }) },
    card: {
      draw: (W, task, isWorking, done, total, _t, _font, _frame, legends) => wallCard(W, task, isWorking, done, total, legends, { era }),
      alt: (isWorking, done, total) => `GDA wall: ${isWorking ? 'live' : 'standby'}, ${done} of ${total} objectives`,
    },
    legends: { title: 'ARCHIVED FEEDS', empty: 'No archived feeds yet. A mission that runs 3+ minutes is archived here.', icon: '', alt: 'Archived feeds', toast: task => `Archived: ${task}`, hidden: true },
    log: { draw: (W, beats, pick) => pageCard(W, beats, pick, { era }), hasControls: true, alt: pageAlt },
    boot: BOOT,
    bootDraw: W => bootLine(W, era),
    greeting: GREETING,
    words: TITLE_WORDS,
    tools: VERBS,
    extras: invExtras(era, P.tile as string),
    shake: invShake(era),
    paneReserve: FIGHT_PANE_RESERVE,
  }
}
