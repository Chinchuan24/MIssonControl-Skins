import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { CASTS, CAST_CSS, hashOf, spriteMarkup } from './cast'
import { BREACH_H, BREACH_W, CJK_FONT, EGG_CSS, EGG_TOOLS, EGG_WORDS, GREETING, KATAKANA, breachCard, breachTicker, celebration, heatStars, legendsCard, legendsHeight, psychoChip, radio, relicText, sandevistan, skyline, sysTag } from './eggs'
import type { Egg, Legend } from './eggs'
import { BEATS_KEPT, BLANK_CRED, BOOT_H, award, rockerRankOf, bdHeight, bootStrip, braindanceCard, cleanCred, credCard, credHeight, levelOf, rankOf, shiftPick, stepPick } from './extras'
import type { Beat, Cred } from './extras'
import { hasInlineMath, inlineMath, mermaidChart, splitBlocks, texToUnicode, unifiedDiff } from './richtext'
import { LIVE_N, glide, isNewReading, isSame, liveText, liveWidth, pin, steady, steadyTree, wallMinute } from './smooth'
import type { AgentRun, AgentStatus, AllTime, Background, BgCron, BgTask, Env, Flow, Manager, Panel, Phase, PlanStep, PlannedTask, SessionStats, Today, Watch } from '../types'
import type { On } from 'claude-code'
import type { Timekeeper } from '../types'

// Note: `update` writes, and redraws every reader, even when its change hands back
// the same value: guard no-op writes with a read first.
const flow = atom({ plugin: 'crab-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'crab-progress', key: 'agents' } as const, [])
const panel = atom({ plugin: 'crab-progress', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
})
const now = atom({ plugin: 'crab-progress', key: 'now' } as const, 0)
// The desktop's ticks: written only when what the band, or the pane, draws from the
// time has changed (a minute, a threshold, a label), never just because a second passed.
const bandTick = atom({ plugin: 'crab-progress', key: 'bandTick' } as const, 0)
const paneTick = atom({ plugin: 'crab-progress', key: 'paneTick' } as const, 0)
const memory = atom({ plugin: 'crab-progress', key: 'memory' } as const, [])
const BLANK_ENV: Env = { cwd: '', model: '', surface: '', contextPct: 0, contextTokens: 0, contextWindow: 0, costUsd: 0, connectors: [], limits: [] }
const env = atom({ plugin: 'crab-progress', key: 'env' } as const, BLANK_ENV)
const BLANK_MANAGER: Manager = { task: '', isWorking: false, startedAt: 0 }
const manager = atom({ plugin: 'crab-progress', key: 'manager' } as const, BLANK_MANAGER)
const BLANK_WATCH: Watch = { burn: [], cacheRead: 0, promptAll: 0, autopilot: false, budgetUsd: 0 }
const watch = atom({ plugin: 'crab-progress', key: 'watch' } as const, BLANK_WATCH)
const BLANK_TODAY: Today = { date: '', tasks: 0, agents: 0, tokens: 0, costUsd: 0 }
const today = atom({ plugin: 'crab-progress', key: 'today' } as const, BLANK_TODAY)
const allTime = atom({ plugin: 'crab-progress', key: 'allTime' } as const, { since: '', models: {} } as AllTime)
const BLANK_SESSION: SessionStats = { turn: 0, speed: null, costAtStart: 0, cacheUntil: null, cacheLeft: null, isBusy: false, warned: 0 }
const session = atom({ plugin: 'crab-progress', key: 'session' } as const, BLANK_SESSION)
// Claude's background work. The engine lists it only on Stop and SubagentStop, so
// `at` keeps when that was: the pane says how fresh the list is.
const BLANK_BG: Background = { tasks: [], crons: [], at: 0 }
const background = atom({ plugin: 'crab-progress', key: 'background' } as const, BLANK_BG)
// Today and All-time as this session last read or wrote them in the store.
const saved = atom({ plugin: 'crab-progress', key: 'saved' } as const, { today: BLANK_TODAY, allTime: { since: '', models: {} } as AllTime })
// Crew mode: a big job is split across sub-agents. On by default; `/autocrew` turns
// it off or moves the context line. Kept in the store, so it holds across sessions.
type AutoCrew = { on: boolean; ctxPct: number }
const AUTO_CREW: AutoCrew = { on: true, ctxPct: 60 }
const readAutoCrew = async ($: EngineInterface): Promise<AutoCrew> => {
  const v = (await $.store.get('autoCrew').catch(() => null)) as Partial<AutoCrew> | null
  return { on: v?.on !== false, ctxPct: typeof v?.ctxPct === 'number' && v.ctxPct >= 10 && v.ctxPct <= 95 ? v.ctxPct : AUTO_CREW.ctxPct }
}

// Why a request is a big job, or '' when it is not: a long brief, a list of asks,
// many files named, a sweep over a whole codebase, a long plan, or a full context.
const bigJobReason = (text: string, ctxPct: number, planSteps: number, ctxLine: number): string => {
  const asks = text.split('\n').filter(l => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length
  const files = new Set(text.match(/[\w./-]+\.(?:tsx?|jsx?|py|go|rs|java|kt|swift|rb|php|cs|cpp|c|h|css|html|json|md|ya?ml|sql)\b/g) ?? []).size
  if (text.length >= 1500) return 'a long brief'
  if (asks >= 4) return `${asks} asks in one request`
  if (files >= 6) return `${files} files named`
  if (text.length >= 300 && /\b(?:whole|entire|every|all (?:the )?(?:files|pages|modules|components|tests))\b|\b(?:refactor|migrate|port|rewrite|audit)\b/i.test(text)) return 'a sweep over the codebase'
  if (planSteps >= 6) return `a ${planSteps}-step plan`
  if (ctxPct >= ctxLine) return `context at ${ctxPct}%`
  return ''
}

const crewText = (reason: string): string => `# Crew mode (Mission Control)
This task is a big job (${reason}). Split it instead of carrying it all in this context; it is faster, and it keeps this context, and its cost, small.
- Break the work into independent pieces. Give each to its own sub-agent with the Agent tool, and start the independent ones together, in one message, so they run in parallel.
- Brief each one fully: the files, the goal, what done looks like. Name it "<Role>: <piece>" (e.g. "Engineer: wire the parser", "Researcher: map the API") so Mission Control files it under its role.
- Pick the worker by the job: mc-* agents when they are listed, else general-purpose for building and editing; Explore for read-only searching and summing up.
- Ask workers for conclusions, not file dumps; do not read big files here that a worker can read.
- Pieces that edit the same files go to one worker, or run one after another.
- Keep small things here: a few tool calls are not worth a sub-agent.
- Then review and merge what comes back, and verify it.`

// The prompt cache lives an hour after an answer; warn at ten and five minutes left.
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_WARN_MIN = [10, 5] as const
// Responses this short, or this fast, are tool stubs and bursts: their timing is noise.
const SPEED_MIN_TOKENS = 20
const SPEED_MIN_SECONDS = 0.5

// Every session's tokens per model. The first run seeds it from assets/history.json,
// counted from the session history files; each model request adds to it after.
async function loadAllTime($: EngineInterface): Promise<void> {
  const kept = (await $.store.get('allTime').catch(() => undefined)) as AllTime | undefined
  if (kept && typeof kept === 'object' && kept.models) {
    await update($, allTime, () => kept)
    await update($, saved, prev => ({ ...prev, allTime: kept }))
    return
  }
  try {
    const seed = parseJson(await $.fs.read(`${$.plugin.root}/assets/history.json`)) as { since?: string; models?: Record<string, number> }
    const models = Object.fromEntries(Object.entries(seed.models ?? {}).filter(([, n]) => typeof n === 'number' && n > 0))
    const value: AllTime = { since: typeof seed.since === 'string' ? seed.since : '', models }
    await update($, allTime, () => value)
    await $.store.set('allTime', value)
    await update($, saved, prev => ({ ...prev, allTime: value }))
  } catch {
    // No seed: the totals start from this session.
  }
}

// A day by the local calendar, for the daily scoreboard.
const dayOf = (at: number): string => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Today's totals, rolled over at midnight; persisted at each turn's end.
async function bumpToday($: EngineInterface, change: Partial<Omit<Today, 'date'>>): Promise<void> {
  const at = await $.clock.now()
  const date = dayOf(at)
  await update($, today, prev => {
    const base = prev.date === date ? prev : { ...BLANK_TODAY, date }
    return {
      ...base,
      tasks: base.tasks + (change.tasks ?? 0),
      agents: base.agents + (change.agents ?? 0),
      tokens: base.tokens + (change.tokens ?? 0),
      costUsd: base.costUsd + Math.max(0, change.costUsd ?? 0),
    }
  })
}

// What the day's card shows: past midnight with nothing new yet, the new day's empty count.
const todayOn = (d: Today, at: number): Today => (at && d.date && d.date !== dayOf(at) ? { ...BLANK_TODAY, date: dayOf(at) } : d)

// Two sessions open at once share the store: a save adds this session's own share since
// it last read or wrote the store onto what is there now, never its whole snapshot.
let saveQueue: Promise<unknown> = Promise.resolve()
function saveTotals($: EngineInterface): Promise<void> {
  const run = saveQueue.then(() => saveTotalsNow($))
  saveQueue = run.catch(() => undefined)
  return run.catch(() => undefined)
}
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
async function saveTotalsNow($: EngineInterface): Promise<void> {
  const [day, every, base] = await Promise.all([read($, today), read($, allTime), read($, saved)])
  if (day.date) {
    const was = base.today.date === day.date ? base.today : { ...BLANK_TODAY, date: day.date }
    const kept = (await $.store.get('today').catch(() => undefined)) as Today | undefined
    const on = kept && typeof kept === 'object' && kept.date === day.date ? kept : { ...BLANK_TODAY, date: day.date }
    const keys = ['tasks', 'agents', 'tokens', 'costUsd'] as const
    const merged = { ...BLANK_TODAY, date: day.date }
    // No base yet (a hot reload into this version): the store already holds this
    // session's earlier saves, so the larger count stands rather than both added.
    for (const k of keys) merged[k] = base.today.date ? num(on[k]) + Math.max(0, day[k] - was[k]) : Math.max(num(on[k]), day[k])
    await $.store.set('today', merged)
    // What came in meanwhile stays on top of the merged count.
    await update($, today, prev => (prev.date !== day.date ? prev : { ...prev, ...Object.fromEntries(keys.map(k => [k, merged[k] + prev[k] - day[k]])) }))
    await update($, saved, prev => ({ ...prev, today: merged }))
  }
  const keptAll = (await $.store.get('allTime').catch(() => undefined)) as AllTime | undefined
  const onAll = keptAll && typeof keptAll === 'object' && keptAll.models ? keptAll : { since: '', models: {} }
  const models: Record<string, number> = { ...onAll.models }
  const hasBase = Boolean(base.allTime.since) || Object.keys(base.allTime.models).length > 0
  for (const [m, n] of Object.entries(every.models)) models[m] = hasBase ? num(models[m]) + Math.max(0, n - num(base.allTime.models[m])) : Math.max(num(models[m]), n)
  const mergedAll: AllTime = { since: onAll.since || every.since, models }
  await $.store.set('allTime', mergedAll)
  await update($, allTime, prev => ({
    since: mergedAll.since,
    models: Object.fromEntries([...new Set([...Object.keys(mergedAll.models), ...Object.keys(prev.models)])].map(m => [m, num(mergedAll.models[m]) + num(prev.models[m]) - num(every.models[m])])),
  }))
  await update($, saved, prev => ({ ...prev, allTime: mergedAll }))
}

// A running agent with no model request or tool call for this long is flagged.
const STUCK_MS = 120_000
// A background agent's end queues its report for the main loop: the job waits this
// long for the turn that answers it before it may finish without one.
const REPORT_WAIT_MS = 30_000
const CELEBRATE_MS = 6_000

// ---------------------------------------------------------------------------
// Timekeeper: every job and every sub-agent runs on a time budget. The plan's
// `minutes` set it, else the person's defaults; the 1 s tick flags overruns and
// alerts once each. The alert marks live in `$.state`, so a hot reload never re-alerts.

const TK_KEY = 'timekeeper'
const TK_MAX_MIN = 1440
const TK_WARN = 0.8
const BLANK_TK: Timekeeper = { on: true, jobMin: 60, agentMin: 20, warnedFor: 0, overFor: 0 }
const timekeeper = atom({ plugin: 'crab-progress', key: 'timekeeper' } as const, BLANK_TK)
const TK_USAGE = 'Usage: /timekeeper for its state, /timekeeper on|off, /timekeeper job <minutes>, /timekeeper agent <minutes> (whole minutes, 1–1440)'

const TK_STRINGS = {
  en: {
    warn: (task: string, min: number) => `⏱ ${task} has used 80% of its ${min} min budget`,
    over: (task: string, min: number) => `⏱ Over budget: ${task} has run past its ${min} min. Ask Claude for a new estimate.`,
    agentOver: (task: string, min: number) => `⏱ "${task}" is over its ${min} min budget`,
    agentsOver: (n: number, tasks: string) => `⏱ ${n} sub-agents are over budget: ${tasks}`,
    overWord: 'over budget',
    setting: (job: number, agent: number) => `Timekeeper: ${job} min per job, ${agent} min per sub-agent`,
  },
  ru: {
    warn: (task: string, min: number) => `⏱ ${task}: израсходовано 80% бюджета в ${min} мин`,
    over: (task: string, min: number) => `⏱ Бюджет превышен: ${task} идёт дольше ${min} мин. Попросите у Claude новую оценку.`,
    agentOver: (task: string, min: number) => `⏱ «${task}» превысил бюджет в ${min} мин`,
    agentsOver: (n: number, tasks: string) => `⏱ Субагентов сверх бюджета: ${n} — ${tasks}`,
    overWord: 'бюджет превышен',
    setting: (job: number, agent: number) => `Хронометраж: ${job} мин на задачу, ${agent} мин на субагента`,
  },
  he: {
    warn: (task: string, min: number) => `⏱ ${task} ניצל 80% מתקציב של ${min} דק׳`,
    over: (task: string, min: number) => `⏱ חריגה מהתקציב: ${task} עבר את ${min} הדקות. בקשו מ-Claude הערכה חדשה.`,
    agentOver: (task: string, min: number) => `⏱ "${task}" חרג מתקציב של ${min} דק׳`,
    agentsOver: (n: number, tasks: string) => `⏱ ${n} סוכנים חרגו מהתקציב: ${tasks}`,
    overWord: 'חריגה מהתקציב',
    setting: (job: number, agent: number) => `שומר זמן: ${job} דק׳ למשימה, ${agent} דק׳ לסוכן`,
  },
}
const tkStr = () => TK_STRINGS[lang]

// A budget is whole minutes, one to a day; anything else is no budget.
const cleanMin = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.min(TK_MAX_MIN, Math.round(v)) : undefined

// The plan's own budget: its `minutes`, else the sum of its tasks'.
const planBudget = (f: Flow | null): number | undefined => {
  if (!f) return undefined
  if (f.minutes) return f.minutes
  const sum = f.tasks.reduce((n, t) => n + (t.minutes ?? 0), 0)
  return sum > 0 ? Math.min(TK_MAX_MIN, sum) : undefined
}

// A run's budget: its task's when the plan names it (matched as the panel matches runs), else the default.
const agentBudget = (a: AgentRun, f: Flow | null, tk: Timekeeper): number =>
  f?.tasks.find(t => norm(t.title) === norm(a.description))?.minutes ?? tk.agentMin

// "12/45m": whole minutes used of the budget. Drawn calm, warn past 80%, alert past 100%.
const budgetLabel = (usedMs: number, min: number): string => `${Math.floor(Math.max(0, usedMs) / 60_000)}/${min}m`
const budgetTone = (usedMs: number, min: number, calm = ''): string => {
  const share = usedMs / (min * 60_000)
  return share > 1 ? SKIN.colors.alert : share >= TK_WARN ? SKIN.colors.warn : calm
}
// Flagged only while the timekeeper is on: turning it off hides the flag, the alert mark stays.
const isOver = (a: AgentRun): boolean => Boolean(a.isOverBudget && a.budgetMin)
// The band's reading while a job runs; none before a request, after it is done, or when off.
const bandBudget = (boss: Manager, at: number): { usedMs: number; min: number } | undefined =>
  boss.budgetMin && boss.task && boss.startedAt && !boss.doneAt ? { usedMs: Math.max(0, at - boss.startedAt), min: boss.budgetMin } : undefined
// The band's clock, the last of its header's right-hand parts, in the budget's tone.
const budgetClock = (parts: string[], clock: string, b: { usedMs: number; min: number }): string => {
  const tone = budgetTone(b.usedMs, b.min)
  const head = parts.slice(0, -1).join('   ')
  return `${xml(head ? `${head}   ` : '')}<tspan font-weight="700"${tone ? ` fill="${tone}"` : ''}>${xml(clock)}</tspan>`
}

const readTimekeeper = async ($: EngineInterface): Promise<Pick<Timekeeper, 'on' | 'jobMin' | 'agentMin'>> => {
  const v = (await $.store.get(TK_KEY).catch(() => null)) as Partial<Timekeeper> | null
  return { on: v?.on !== false, jobMin: cleanMin(v?.jobMin) ?? BLANK_TK.jobMin, agentMin: cleanMin(v?.agentMin) ?? BLANK_TK.agentMin }
}

async function setTimekeeper($: EngineInterface, change: Partial<Pick<Timekeeper, 'on' | 'jobMin' | 'agentMin'>>): Promise<Timekeeper> {
  const saved = { ...(await readTimekeeper($)), ...change }
  await $.store.set(TK_KEY, saved).catch(() => undefined)
  const tk = await update($, timekeeper, prev => ({ ...prev, ...saved }))
  if (saved.on) await keepTime($, await $.clock.now().catch(() => 0))
  else await clearBudgets($)
  return tk
}

// Off: the drawings lose every budget; the next tick after turning it on puts them back.
async function clearBudgets($: EngineInterface): Promise<void> {
  if ((await read($, manager)).budgetMin !== undefined) await update($, manager, prev => ({ ...prev, budgetMin: undefined }))
  if ((await read($, agents)).some(a => a.budgetMin !== undefined)) await update($, agents, list => list.map(a => (a.budgetMin === undefined ? a : { ...a, budgetMin: undefined })))
}

// Claimed in one atomic step, as finishIfIdle claims the cheer: two ticks never alert twice.
async function claimAlert($: EngineInterface, mark: 'warnedFor' | 'overFor', job: number): Promise<boolean> {
  let isMine = false
  await update($, timekeeper, prev => {
    isMine = prev[mark] !== job
    // Past 100% the 80% warning is spent too: a job that jumps the line gets one alert.
    return isMine ? { ...prev, [mark]: job, ...(mark === 'overFor' ? { warnedFor: job } : {}) } : prev
  })
  return isMine
}

// Two short beeps, made here: the core skins ship no alert sound of their own.
let BEEP = ''
const beepWav = (): string => {
  if (BEEP) return BEEP
  const rate = 8000
  const n = Math.round(rate * 0.34)
  const bytes = new Uint8Array(44 + n)
  const v = new DataView(bytes.buffer)
  const ascii = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)))
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  ascii(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  ascii(36, 'data')
  v.setUint32(40, n, true)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    bytes[44 + i] = t < 0.12 || (t >= 0.2 && t < 0.32) ? 128 + Math.round(56 * Math.sin(2 * Math.PI * 880 * t)) : 128
  }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const w = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += `${B64[(w >> 18) & 63]}${B64[(w >> 12) & 63]}${i + 1 < bytes.length ? B64[(w >> 6) & 63] : '='}${i + 2 < bytes.length ? B64[w & 63] : '='}`
  }
  return (BEEP = out)
}

// The skin's alert: MaxTac's siren on the cyberpunk skins, the beeps elsewhere.
async function playAlert($: EngineInterface): Promise<void> {
  if (!(await read($, settings)).sounds) return
  await $.audio.play(eggOf() ? { asset: `${ADDON}/assets/maxtac.wav` } : { base64: beepWav(), mime: 'audio/wav' }).catch(() => undefined)
}

// Each tick: keep every budget current, then alert once per job at 80% and 100%, and
// once per agent past its own. Writes only when something changed.
async function keepTime($: EngineInterface, at: number): Promise<void> {
  try {
    const tk = await read($, timekeeper)
    if (!tk.on) return
    const [boss, list, f] = await Promise.all([read($, manager), read($, agents), read($, flow)])
    const jobMin = boss.task ? (boss.planMin ?? tk.jobMin) : undefined
    if (boss.budgetMin !== jobMin) await update($, manager, prev => (prev.startedAt === boss.startedAt ? { ...prev, budgetMin: jobMin } : prev))
    if (jobMin && boss.startedAt && !boss.doneAt) {
      const job = boss.startedAt
      const share = (at - job) / (jobMin * 60_000)
      const task = `"${clip(boss.task.replace(/\s+/g, ' '), 40)}"`
      if (share > 1 && tk.overFor !== job) {
        if (await claimAlert($, 'overFor', job)) {
          $.ui.toast(tkStr().over(task, jobMin), { timeoutMs: 30000 })
          void playAlert($)
        }
      } else if (share >= TK_WARN && tk.warnedFor !== job && tk.overFor !== job) {
        if (await claimAlert($, 'warnedFor', job)) $.ui.toast(tkStr().warn(task, jobMin), { timeoutMs: 30000 })
      }
    }
    const isDue = (a: AgentRun) => {
      const min = agentBudget(a, f, tk)
      return a.status === 'running' && (a.budgetMin !== min || (!a.isOverBudget && elapsed(a, at) > min * 60_000))
    }
    if (!list.some(isDue)) return
    const fresh: AgentRun[] = []
    await update($, agents, l => {
      fresh.length = 0
      return l.map(a => {
        if (!isDue(a)) return a
        const min = agentBudget(a, f, tk)
        const isOverNow = elapsed(a, at) > min * 60_000
        if (isOverNow && !a.isOverBudget) fresh.push({ ...a, budgetMin: min })
        return { ...a, budgetMin: min, ...(isOverNow ? { isOverBudget: true } : {}) }
      })
    })
    if (!fresh.length) return
    // Several over in one tick share one toast and one sound: a big crew never makes a din.
    const [one] = fresh
    if (one && fresh.length === 1) $.ui.toast(tkStr().agentOver(clip(one.description || one.type, 40), one.budgetMin ?? tk.agentMin), { timeoutMs: 30000 })
    else $.ui.toast(tkStr().agentsOver(fresh.length, clip(fresh.map(a => a.description || a.type).join(', '), 120)), { timeoutMs: 30000 })
    void playAlert($)
  } catch {
    // A nudge: never in the way of the tick.
  }
}

// The plan's `minutes` become the job's budget; a plan without them leaves the default.
// Never in the way of the progress call itself.
async function notePlanBudget($: EngineInterface, f: Flow | null): Promise<void> {
  try {
    const min = planBudget(f)
    if ((await read($, manager)).planMin !== min) await update($, manager, prev => ({ ...prev, planMin: min }))
    await keepTime($, await $.clock.now())
  } catch {
    // The next tick catches up.
  }
}

// The standing rule, sent while the timekeeper is on. Short and imperative: it rides every request.
const timekeeperText = (tk: Timekeeper): string => `# Timekeeper (Mission Control)
Every job runs on a time budget. Follow these strictly:
- Any job longer than a few minutes, or one that uses sub-agents: before the work starts, report the plan with \`${TOOL}\`, giving \`minutes\` for each task and for the whole job.
- Keep to the budgets. As each task finishes, check the time spent against its budget.
- The moment a task overruns, stalls or needs more time, tell the user plainly, with a new estimate. Never extend a budget silently.
- For multi-step work keep a short written tracker: task, owner, budget, status.
Without a plan the budgets are ${tk.jobMin} min per job and ${tk.agentMin} min per sub-agent.`

const timekeeperStatus = async ($: EngineInterface, tk: Timekeeper): Promise<string> => {
  if (!tk.on) return `Timekeeper off: no budgets, alerts or standing rule.\n${TK_USAGE}`
  const boss = await read($, manager)
  const at = await $.clock.now()
  const job = boss.task && boss.budgetMin ? `\nThis job: ${budgetLabel((boss.doneAt ?? at) - boss.startedAt, boss.budgetMin)}${boss.planMin ? ' (from its plan)' : ''}` : ''
  return `Timekeeper on: ${tk.jobMin} min per job, ${tk.agentMin} min per sub-agent, unless the plan gives \`minutes\`.${job}\n${TK_USAGE}`
}

// At session start: the command, and the settings. A reload keeps the alert marks
// $.state holds; only the settings come from the store.
async function startTimekeeper($: EngineInterface): Promise<void> {
  await $.command.register({
    name: 'timekeeper',
    description: 'Timekeeper: time budgets for every job and sub-agent. /timekeeper, /timekeeper on|off, /timekeeper job <minutes>, /timekeeper agent <minutes>',
  }).catch(() => undefined)
  const saved = await readTimekeeper($)
  await update($, timekeeper, prev => ({ ...prev, ...saved }))
  if (!saved.on) await clearBudgets($)
}

// The standing rule rides at the end of the system prompt, as the memory rules do, while it is on.
const timekeeperSections = async ($: EngineInterface) => {
  const tk = await read($, timekeeper)
  return tk.on ? [{ id: 'crab-progress:timekeeper', text: timekeeperText(tk), scope: 'session' as const }] : []
}

// Its command, beside the rest.
function timekeeperHooks(on: On): void {
  on('command.run', { command: 'timekeeper' }, async ($, e) => {
    const [verb = '', arg, ...extra] = (e.args ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!verb || verb === 'status') return { text: await timekeeperStatus($, await read($, timekeeper)) }
    if ((verb === 'on' || verb === 'off') && arg === undefined) {
      const tk = await setTimekeeper($, { on: verb === 'on' })
      return { text: await timekeeperStatus($, tk) }
    }
    // A bad number is answered, not clamped: a typo must not set a day-long budget.
    const n = arg !== undefined && /^\d+$/.test(arg) ? Number(arg) : NaN
    if ((verb === 'job' || verb === 'agent') && !extra.length && n >= 1 && n <= TK_MAX_MIN) {
      const tk = await setTimekeeper($, verb === 'job' ? { jobMin: n } : { agentMin: n })
      return { text: verb === 'job' ? `Job budget: ${tk.jobMin} min, unless the plan gives \`minutes\`.` : `Sub-agent budget: ${tk.agentMin} min, unless its task gives \`minutes\`.` }
    }
    return { text: TK_USAGE }
  })
}

// ---------------------------------------------------------------------------
// The manager's own task list: the desktop app's plan tool, read as it is called.
// `items` replaces the list; `advance` closes the step in progress and opens the
// next; `done` / `start` name steps by number, from 1.

const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'
const MAX_PLAN = 30

type PlanInput = { items?: { content?: string; status?: string }[]; advance?: boolean; done?: number[]; start?: number }

const applyPlan = (prev: PlanStep[], input: PlanInput): PlanStep[] => {
  let steps = prev
  if (Array.isArray(input.items)) {
    steps = input.items
      .filter(i => typeof i?.content === 'string' && i.content.trim())
      .slice(0, MAX_PLAN)
      .map(i => ({
        content: clip((i.content ?? '').trim(), 120),
        status: i.status === 'completed' || i.status === 'in_progress' ? i.status : 'pending',
      }))
  }
  if (input.advance) {
    const at = steps.findIndex(st => st.status === 'in_progress')
    steps = steps.map((st, i) => (i === at ? { ...st, status: 'completed' } : st))
    const next = steps.findIndex((st, i) => i > at && st.status === 'pending')
    if (next >= 0) steps = steps.map((st, i) => (i === next ? { ...st, status: 'in_progress' } : st))
  }
  if (Array.isArray(input.done)) {
    const done = new Set(input.done.filter(n => Number.isInteger(n)).map(n => n - 1))
    steps = steps.map((st, i) => (done.has(i) ? { ...st, status: 'completed' } : st))
  }
  if (Number.isInteger(input.start)) {
    const at = (input.start as number) - 1
    steps = steps.map((st, i) => (i === at ? { ...st, status: 'in_progress' } : st))
  }
  return steps
}

// Finished steps count whole, the one in progress half: a bar that moves as work does.
const planProgress = (plan: PlanStep[] | undefined): number | null => {
  if (!plan?.length) return null
  const done = plan.filter(st => st.status === 'completed').length
  const half = plan.some(st => st.status === 'in_progress') ? 0.5 : 0
  return Math.min(1, (done + half) / plan.length)
}

// ---------------------------------------------------------------------------
// Session card: where Claude runs, how full the context is, what it is connected to.

// `mcp__<server>__<tool>`: the server is the middle part. A plugin's server reads
// `plugin_<plugin>_<name>`; claude.ai connectors are bare UUIDs and count apart.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
const serverOf = (tool: string): string | null => {
  const m = /^mcp__(.+?)__/.exec(tool)
  return m ? (m[1] ?? null) : null
}
const prettyServer = (s: string): string => {
  const plugin = /^plugin_([^_]+(?:-[^_]+)*)_(.+)$/.exec(s)
  return (plugin ? plugin[2] ?? s : s).replace(/[_-]+/g, ' ')
}
const connectorsOf = (tools: readonly string[]): string[] => {
  const servers = [...new Set(tools.map(serverOf).filter((s): s is string => Boolean(s)))]
  const named = servers.filter(s => !UUID.test(s)).map(prettyServer)
  const linked = servers.length - named.length
  return [...new Set(named)].sort().concat(linked ? [`${linked} claude.ai`] : [])
}

// One at a time, in order: two readings racing could count the same spend twice.
let envQueue: Promise<unknown> = Promise.resolve()
function refreshEnv($: EngineInterface, isBaseline = false): Promise<void> {
  const run = envQueue.then(() => refreshEnvNow($, isBaseline))
  envQueue = run.catch(() => undefined)
  return run.catch(() => undefined)
}
// The session start's reading is the baseline (a resumed session's spend is not
// today's again); every later rise is new spend, from $0 too.
async function refreshEnvNow($: EngineInterface, isBaseline: boolean): Promise<void> {
  const before = (await read($, env)).costUsd
  const [cwd, model, surface, usage] = await Promise.all([
    $.session.cwd().catch(() => ''),
    $.session.model().catch(() => ''),
    $.session.surface().catch(() => null),
    $.session.usage().catch(() => null),
  ])
  const ctx = usage?.context
  const window = ctx?.window ?? 0
  const tokens = ctx?.tokens ?? 0
  const pct = ctx?.percent ?? (window ? (tokens / window) * 100 : 0)
  // Each model request asks again, mostly for the same readings: an equal one is not written.
  const fresh = (prev: Env): Env => ({
    ...prev,
    cwd,
    model,
    surface: surface ?? '',
    contextPct: Math.max(0, Math.min(100, Math.round(pct))),
    contextTokens: tokens,
    contextWindow: window,
    costUsd: usage?.cost?.usd ?? prev.costUsd,
    // A response without readings keeps the last ones rather than blanking the bars.
    limits: usage?.rateLimits?.length ? usage.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })) : prev.limits ?? [],
  })
  const was = await read($, env)
  if (!isSame(fresh(was), was)) await update($, env, fresh)
  const cost = usage?.cost?.usd
  if (isBaseline || typeof cost !== 'number') return
  // The ledger starts over at /clear: after a drop, the whole new total is new spend.
  const spent = cost >= before ? cost - before : cost
  if (spent > 0) await bumpToday($, { costUsd: spent })
}

// A window whose reset time has passed reads empty until the next reply says otherwise.
const liveEnv = (info: Env, at: number): Env => {
  const isPast = (l: Env['limits'][number]) => Boolean(at && l.resetsAt && Date.parse(l.resetsAt) <= at)
  const limits = info.limits ?? []
  return limits.some(isPast) ? { ...info, limits: limits.map(l => (isPast(l) ? { ...l, percentUsed: 0, resetsAt: undefined } : l)) } : info
}

// ---------------------------------------------------------------------------
// Memory: answer-style rules kept in `$.store` across sessions and added to every
// system prompt, so no session has to remember to look them up.

const MEMORY_PANE = 'crab-memory'
const MEMORY_KEY = 'prefs'
const MAX_RULES = 30
const MAX_RULE = 500
const DEFAULT_RULES = [
  'Keep every answer short and skimmable: lead with the answer, then at most about 5 bullets or a few short lines. No long explanations, background or recaps unless asked. The user has ADHD.',
]

const cleanRules = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((r): r is string => typeof r === 'string' && r.trim() !== '').map(r => clip(r.trim(), MAX_RULE)).slice(0, MAX_RULES) : []

// Never set before means first run: seed the default rule. An empty list stays empty.
async function loadRules($: EngineInterface): Promise<string[]> {
  const stored = await $.store.get(MEMORY_KEY).catch(() => DEFAULT_RULES)
  if (stored === undefined) {
    await $.store.set(MEMORY_KEY, DEFAULT_RULES)
    return [...DEFAULT_RULES]
  }
  return cleanRules(stored)
}

async function saveRules($: EngineInterface, rules: string[]): Promise<string[]> {
  const clean = cleanRules(rules)
  await $.store.set(MEMORY_KEY, clean)
  await update($, memory, () => clean)
  return clean
}

const memoryText = (rules: string[]): string =>
  ['# How this user wants answers', 'Follow these in every reply, over any default style:', ...rules.map(r => `- ${r}`)].join('\n')

const listRules = (rules: string[]): string =>
  rules.length ? rules.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'No rules saved. Add one with /prefs add <rule>.'

const TOOL = 'mcp__crab-progress__progress'
const STEP_TOOL = 'mcp__crab-progress__step'
// Added to the end of each Mission Control worker's brief. Their system prompt words step
// reporting as a condition ("if the step tool appears among your tools") and they
// skip it even with the tool listed; the same request in the brief is followed.
const STEP_BRIEF = `

Progress reporting: before any other work, call \`${STEP_TOOL}\` with \`total\` (your plan in 3-8 steps) and \`done: 0\`; call it again with \`done\` and a few-word \`note\` as each step finishes. It only draws a progress bar.`
const PANE = 'crab-agents'
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
const TIERS: readonly string[] = ['fable', 'heavy', 'careful', 'medium', 'light']
// The tools' schemas are advice to the model, not a check: what a call may ask
// the band and the panel to draw is bounded here.
const MAX_TASKS = 200
const MAX_AFTER = 20
const MAX_TITLE = 120
let ACCENT = '#8f8cf4'
let DONE = '#5fbf8f'

type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  finished?: boolean
  tasks?: { title?: string; tier?: string; after?: number[]; minutes?: number }[]
  minutes?: number
}

// ---------------------------------------------------------------------------
// Skins: every colour, the font, the card shape and the overlay effects come from
// the active skin. Built-ins live here; more are JSON files in the person's
// "Custom Claude Skins" folder, read at session start and by /skin reload.

type SkinColors = {
  accent: string
  accent2: string
  done: string
  warn: string
  alert: string
  meter: string
  text: string
  subtext: string
  muted: string
  tile: string
  track: string
  line: string
  grid: string
}
type Skin = {
  id: string
  name: string
  description: string
  font: string
  corners: 'round' | 'chamfer'
  /** A dark-only skin draws its own colours whatever the system scheme. */
  dark: boolean
  colors: SkinColors
  /** The boss frame's ring, five stops around the card. */
  boss: string[]
  /** Colours handed to roles named in a task ("Designer: ..."). */
  roles: string[]
  /** The whole pane's background: a fill (empty: see-through) and its pattern. */
  backdrop: { fill: string; pattern: 'dots' | 'lines' | 'stars' | 'none'; ink: string }
  effects: { scanlines: boolean; glitch: boolean }
  /** Restyle the chat's tool rows and spinner; off leaves the app's own drawing. */
  chat: boolean
  /** Spinner words while a turn thinks or waits ("Jacking in"). */
  words: string[]
  /** A themed verb per tool row ("Read" becomes "Scan"). */
  toolWords: Record<string, string>
  /** The panes' tab titles: the app draws the tab, the skin names it. */
  tabs: { mission: string; skins: string }
  /** Characters in place of the crabs: a key of CASTS ("runners", "corpo", "netrun"). */
  cast?: string
  /** Left out of the picker and the list until it is worn: an easter egg. */
  hidden?: boolean
}

const CRAB_SKIN: Skin = {
  id: 'crab-classic',
  name: 'Crab Classic',
  description: 'The original: soft violet, gold boss, rounded cards.',
  font: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif",
  corners: 'round',
  dark: false,
  colors: {
    accent: '#8f8cf4',
    accent2: '#5EC8D8',
    done: '#5fbf8f',
    warn: '#E9B44C',
    alert: '#E5675E',
    meter: '#3B82F6',
    text: '#ececec',
    subtext: '#a8a8a4',
    muted: '#9A9A96',
    tile: '#262625',
    track: '#2c2c2b',
    line: '#333331',
    grid: '#3a3a38',
  },
  boss: ['#F5C542', '#E76F51', '#B58BE5', '#5EC8D8', '#F5C542'],
  roles: ['#E58FB5', '#5EC8D8', '#E9B44C', '#9CCB6B', '#B58BE5', '#E5875E'],
  effects: { scanlines: false, glitch: false },
  chat: true,
  words: ['Scuttling', 'Pinching through', 'Clawing along', 'Sidestepping'],
  toolWords: {},
  backdrop: { fill: '', pattern: 'dots', ink: '' },
  tabs: { mission: '🦀 Mission Control', skins: 'Skins' },
}

// Night City HUD: neon yellow, hot red, electric cyan on near-black, cut corners,
// scanlines and a glitch. Rajdhani is the game's HUD face; Bahnschrift stands in on Windows.
const CYBER_SKIN: Skin = {
  id: 'cyberpunk-2077',
  cast: 'runners',
  name: 'Cyberpunk 2077',
  description: 'Night City HUD: neon yellow, hot red, electric cyan, cut corners, scanlines.',
  font: "Rajdhani,Orbitron,-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Bahnschrift,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif",
  corners: 'chamfer',
  dark: true,
  colors: {
    accent: '#FCEE0A',
    accent2: '#00F0FF',
    done: '#00FF9F',
    warn: '#FF8A00',
    alert: '#FF003C',
    meter: '#00F0FF',
    text: '#F3EFE0',
    subtext: '#9FB4BA',
    muted: '#74808A',
    tile: '#0B0C10',
    track: '#1A1D24',
    line: '#2B2F38',
    grid: '#1C2129',
  },
  boss: ['#FCEE0A', '#FF003C', '#B000FF', '#00F0FF', '#FCEE0A'],
  roles: ['#FCEE0A', '#00F0FF', '#FF003C', '#FF5CF0', '#00FF9F', '#FF8A00'],
  effects: { scanlines: true, glitch: true },
  chat: true,
  words: ['Jacking in', 'Breaching ICE', 'Netrunning', 'Overclocking', 'Uploading quickhack', 'Scanning Night City'],
  toolWords: { Read: 'Scan', Edit: 'Patch', MultiEdit: 'Patch', Write: 'Burn', Bash: 'Exec', PowerShell: 'Exec', Grep: 'Trace', Glob: 'Index', Agent: 'Deploy', WebFetch: 'Jack in', WebSearch: 'Netsearch', ToolSearch: 'Load chrome' },
  backdrop: { fill: '#050608', pattern: 'lines', ink: 'rgba(0,240,255,.07)' },
  tabs: { mission: '◢ Mission Control', skins: '◢ Skins' },
}

// Arasaka: the corporation's own look. Blood red on black, steel grey, hard edges, no noise.
const ARASAKA_SKIN: Skin = {
  id: 'arasaka',
  cast: 'corpo',
  name: 'Arasaka',
  description: 'Corporate steel: blood red on black, hard edges, no noise.',
  font: "Rajdhani,-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Bahnschrift,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif",
  corners: 'chamfer',
  dark: true,
  colors: {
    accent: '#E3001B',
    accent2: '#C9CED6',
    done: '#3DDC97',
    warn: '#FFB000',
    alert: '#FF1E3C',
    meter: '#E3001B',
    text: '#F2F2F2',
    subtext: '#9A9EA6',
    muted: '#7A7E86',
    tile: '#0A0A0B',
    track: '#1B1C1F',
    line: '#2A2C31',
    grid: '#18191C',
  },
  boss: ['#E3001B', '#FFFFFF', '#7A0010', '#C9CED6', '#E3001B'],
  roles: ['#E3001B', '#C9CED6', '#FFFFFF', '#FF5A6E', '#8A9099', '#B3001A'],
  effects: { scanlines: false, glitch: false },
  chat: true,
  words: ['Processing', 'Securing assets', 'Auditing', 'Executing protocol', 'Consulting the board'],
  toolWords: { Read: 'Audit', Edit: 'Amend', MultiEdit: 'Amend', Write: 'File', Bash: 'Execute', PowerShell: 'Execute', Grep: 'Investigate', Glob: 'Catalogue', Agent: 'Dispatch', WebFetch: 'Retrieve', WebSearch: 'Surveil' },
  backdrop: { fill: '#060607', pattern: 'lines', ink: 'rgba(227,0,27,.07)' },
  tabs: { mission: 'Arasaka · Mission Control', skins: 'Arasaka · Skins' },
}

// Lucy (Edgerunners): the moonlit netrunner. Rose-pink and cyan on deep violet, soft panels.
const LUCY_SKIN: Skin = {
  id: 'lucy-edgerunners',
  cast: 'netrun',
  name: 'Lucy · Edgerunners',
  description: 'Moonlit netrunner: rose-pink and cyan on deep violet, soft glow.',
  font: "Rajdhani,-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Bahnschrift,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif",
  corners: 'round',
  dark: true,
  colors: {
    accent: '#FF5CF0',
    accent2: '#5CE1FF',
    done: '#7DFFCF',
    warn: '#FFD166',
    alert: '#FF3D7F',
    meter: '#B79CFF',
    text: '#F4ECFF',
    subtext: '#B9A9D9',
    muted: '#8A7DB0',
    tile: '#100B1A',
    track: '#1E1530',
    line: '#2C2244',
    grid: '#1A1428',
  },
  boss: ['#FF5CF0', '#5CE1FF', '#B79CFF', '#FFFFFF', '#FF5CF0'],
  roles: ['#FF5CF0', '#5CE1FF', '#B79CFF', '#7DFFCF', '#FFD166', '#FF8AD8'],
  effects: { scanlines: true, glitch: true },
  chat: true,
  words: ['Diving', 'Drifting through the Net', 'Moonwalking', 'Netrunning', 'Chasing the moon'],
  toolWords: { Read: 'Dive', Edit: 'Rewrite', MultiEdit: 'Rewrite', Write: 'Leave a trace', Bash: 'Run', PowerShell: 'Run', Grep: 'Search', Glob: 'Map', Agent: 'Call in', WebFetch: 'Pull', WebSearch: 'Search the Net' },
  backdrop: { fill: '#0A0712', pattern: 'stars', ink: 'rgba(244,236,255,.35)' },
  tabs: { mission: '☾ Mission Control', skins: '☾ Skins' },
}

// Default: no skin at all. Neutral greys, the system font, rounded cards, no effects,
// following the system's light or dark scheme.
const DEFAULT_SKIN: Skin = {
  id: 'default',
  name: 'Default',
  description: 'No skin: plain greys, system font, no effects.',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif",
  corners: 'round',
  dark: false,
  colors: {
    accent: '#9A9A96',
    accent2: '#B4B4B0',
    done: '#6FA287',
    warn: '#C9A35A',
    alert: '#C46A62',
    meter: '#8C8C88',
    text: '#ececec',
    subtext: '#a8a8a4',
    muted: '#9A9A96',
    tile: '#262625',
    track: '#2c2c2b',
    line: '#333331',
    grid: '#3a3a38',
  },
  boss: ['#B4B4B0', '#8C8C88', '#6E6E6A', '#B4B4B0', '#B4B4B0'],
  roles: ['#A7A7A3', '#8E9AA6', '#A69A8E', '#8EA696', '#9A8EA6', '#A6A08E'],
  effects: { scanlines: false, glitch: false },
  chat: false,
  words: [],
  toolWords: {},
  backdrop: { fill: '', pattern: 'dots', ink: '' },
  tabs: { mission: 'Mission Control', skins: 'Skins' },
}

// SAMURAI: the secret skin. Johnny's band, red on black, a stage in the skyline.
// Not in the picker or the list: `/skin samurai` finds it.
const SAMURAI_SKIN: Skin = {
  id: 'samurai',
  cast: 'samurai',
  hidden: true,
  name: 'SAMURAI',
  description: "Johnny's band: red on black, stage lights, never fade away.",
  font: "Rajdhani,Orbitron,-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Bahnschrift,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif",
  corners: 'chamfer',
  dark: true,
  colors: {
    accent: '#E10600',
    accent2: '#FFD400',
    done: '#FFD400',
    warn: '#FF8A00',
    alert: '#FF2E3E',
    meter: '#D9D9D9',
    text: '#F4F4F4',
    subtext: '#B3A5A5',
    muted: '#8A7878',
    tile: '#0E0909',
    track: '#241515',
    line: '#3A2020',
    grid: '#1C1010',
  },
  boss: ['#E10600', '#FFD400', '#D9D9D9', '#E10600', '#FFD400'],
  roles: ['#E10600', '#FFD400', '#D9D9D9', '#FF8A00', '#FF5C5C', '#B3A5A5'],
  effects: { scanlines: true, glitch: true },
  chat: true,
  words: ['Never fading away', 'Shredding', 'Riffing'],
  toolWords: {},
  backdrop: { fill: '#080505', pattern: 'lines', ink: 'rgba(225,6,0,.25)' },
  tabs: { mission: '♪ Mission Control', skins: '♪ Skins' },
}

const BUILT_IN_SKINS: Skin[] = [DEFAULT_SKIN, CRAB_SKIN, CYBER_SKIN, ARASAKA_SKIN, LUCY_SKIN, SAMURAI_SKIN]

// Only plain colour and font values reach the drawings: a skin file cannot
// smuggle markup into an Svg.
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i
const cleanColor = (v: unknown, fallback: string): string => (typeof v === 'string' && COLOR_RE.test(v.trim()) ? v.trim() : fallback)
// A JSON file's text, without the byte-order mark Windows editors may write.
const parseJson = (text: unknown): unknown => JSON.parse(String(text).replace(/^\uFEFF/, ''))

const cleanFont = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.trim() && !/["<>&;{}]/.test(v) ? v.trim().slice(0, 200) : fallback

const readSkin = (raw: unknown, fallbackId: string): Skin | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const base = CRAB_SKIN
  const colors = (r.colors ?? {}) as Record<string, unknown>
  const effects = (r.effects ?? {}) as Record<string, unknown>
  const id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : fallbackId
  const list = (v: unknown, fb: string[], n: number) =>
    Array.isArray(v) && v.length ? v.slice(0, n).map((c, i) => cleanColor(c, fb[i % fb.length] ?? '#888888')) : fb
  return {
    id,
    name: typeof r.name === 'string' ? clip(r.name.trim(), 40) : id,
    description: typeof r.description === 'string' ? clip(r.description.trim(), 120) : '',
    font: cleanFont(r.font, base.font),
    corners: r.corners === 'chamfer' ? 'chamfer' : 'round',
    dark: r.dark === true,
    colors: Object.fromEntries(Object.entries(base.colors).map(([k, v]) => [k, cleanColor(colors[k], v)])) as SkinColors,
    boss: list(r.boss, base.boss, 5),
    roles: list(r.roles, base.roles, 12),
    effects: { scanlines: effects.scanlines === true, glitch: effects.glitch === true },
    backdrop: (() => {
      const bd = (r.backdrop ?? {}) as Record<string, unknown>
      const pattern = bd.pattern === 'lines' || bd.pattern === 'stars' || bd.pattern === 'none' ? bd.pattern : 'dots'
      return { fill: bd.fill ? cleanColor(bd.fill, '') : '', pattern, ink: bd.ink ? cleanColor(bd.ink, '') : '' } as Skin['backdrop']
    })(),
    tabs: (() => {
      const tb = (r.tabs ?? {}) as Record<string, unknown>
      const name = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? clip(v.trim(), 40) : fb)
      return { mission: name(tb.mission, 'Mission Control'), skins: name(tb.skins, 'Skins') }
    })(),
    cast: typeof r.cast === 'string' && Object.hasOwn(CASTS, r.cast) ? r.cast : undefined,
    chat: r.chat !== false,
    words: Array.isArray(r.words) ? r.words.filter((w): w is string => typeof w === 'string' && w.trim() !== '').map(w => clip(w.trim(), 32)).slice(0, 20) : base.words,
    toolWords: Object.fromEntries(
      Object.entries((r.toolWords ?? {}) as Record<string, unknown>)
        .filter(([k, v]) => /^[A-Za-z_]{1,40}$/.test(k) && typeof v === 'string' && v.trim())
        .map(([k, v]) => [k, clip(String(v).trim(), 20)]),
    ),
  }
}

const skin = atom({ plugin: 'crab-progress', key: 'skin' } as const, CRAB_SKIN.id)
// Settings the pane's checkboxes change: kept in the store, mirrored here to redraw.
const settings = atom({ plugin: 'crab-progress', key: 'settings' } as const, { openOnStart: true, crewMode: true, currency: 'AUTO', sounds: true })
const cred = atom({ plugin: 'crab-progress', key: 'cred' } as const, BLANK_CRED)
const timeline = atom({ plugin: 'crab-progress', key: 'timeline' } as const, [] as Beat[])
const bdPick = atom({ plugin: 'crab-progress', key: 'bdPick' } as const, -1)
const readSettings = async ($: EngineInterface) => {
  const saved = (await $.store.get('currency').catch(() => undefined)) as { code?: string; rate?: number } | undefined
  // A store written by hand or by an older build may hold anything: a bad code is Auto.
  CURRENCY = currencyOf(typeof saved?.code === 'string' ? saved.code : 'AUTO', typeof saved?.rate === 'number' ? saved.rate : undefined)
  return {
    openOnStart: (await $.store.get('openOnStart').catch(() => undefined)) !== false,
    crewMode: (await readAutoCrew($)).on,
    currency: CURRENCY.code,
    sounds: (await $.store.get('sounds').catch(() => undefined)) !== false,
  }
}

// A sound, when the person has sounds on. Never in the way: a failure is silent.
async function play($: EngineInterface, asset: string): Promise<void> {
  if (!(await read($, settings)).sounds) return
  await $.audio.play({ asset }).catch(() => undefined)
}

// Street Cred: change the counts, award what they earn, cheer a level or a badge.
// The store's read-modify-write is not atomic, so the bumps run one at a time: five
// agents spawned at once count five. `quiet` leaves the chime to the caller's own.
// Resolves true when the bump earned a level or a badge.
let credQueue: Promise<unknown> = Promise.resolve()
function bumpCred($: EngineInterface, change: (c: Cred) => Cred, quiet = false): Promise<boolean> {
  const run = credQueue.then(() => bumpCredNow($, change, quiet))
  credQueue = run.catch(() => false)
  return run
}
async function bumpCredNow($: EngineInterface, change: (c: Cred) => Cred, quiet: boolean): Promise<boolean> {
  let saved: unknown
  try {
    saved = await $.store.get('cred')
  } catch {
    return false // An unreadable store is left alone rather than overwritten with a blank.
  }
  const before = cleanCred(saved)
  const { cred: next, fresh } = award(change(before))
  if (next === before) return false
  await $.store.set('cred', next).catch(() => undefined)
  await update($, cred, () => next)
  const was = levelOf(before.xp)
  const now = levelOf(next.xp)
  // Street Cred is a cyberpunk add-on: other skins keep counting quietly, with no cheer.
  if (!eggOf()) return false
  if (now > was) $.ui.toast(`${eggOf() === 'samurai' ? 'ROCKERBOY CRED' : 'STREET CRED'} ↑ ${now} · ${eggOf() === 'samurai' ? rockerRankOf(now) : rankOf(now)}`)
  for (const b of fresh) $.ui.toast(`${b.icon} Badge unlocked: ${b.name}`)
  const isCheer = now > was || fresh.length > 0
  if (!quiet && isCheer) void play($, `${ADDON}/assets/levelup.wav`)
  return isCheer
}
// The next currency in the list; a custom rate is kept only for the one it was set on.
const setCurrency = async ($: EngineInterface, c: Currency) => {
  CURRENCY = c
  await $.store.set('currency', { code: c.code, rate: c.rate }).catch(() => undefined)
  await update($, settings, prev => ({ ...prev, currency: c.code }))
}
const SKINS = new Map<string, Skin>(BUILT_IN_SKINS.map(k => [k.id, k]))
// The Cyberpunk Skins add-on: its skins (and their sounds) ship in addons/cyberpunk/.
// Without that folder Mission Control is the core edition: default and Crab Classic.
const ADDON = 'addons/cyberpunk'
const ADDON_URL = 'https://github.com/Chinchuan24/MIssonControl-Skins#-choose-your-edition'
const ADDON_CASTS = new Set(['runners', 'netrun', 'corpo', 'samurai'])
let HAS_CYBER = false
const checkAddon = async ($: EngineInterface): Promise<boolean> => {
  HAS_CYBER = await $.fs.exists(`${$.plugin.root}/${ADDON}/addon.json`).catch(() => false)
  return HAS_CYBER
}
const isAddonSkin = (k: Skin): boolean => ADDON_CASTS.has(String(k.cast ?? ''))
const canWear = (k: Skin): boolean => HAS_CYBER || !isAddonSkin(k)
const ADDON_PITCH = `Cyberpunk Skins add-on: Cyberpunk 2077, Lucy · Edgerunners and Arasaka. Get it: ${ADDON_URL}`
let SKIN: Skin = CRAB_SKIN
const SKINS_FOLDER = 'Custom Claude Skins'

// The folder: remembered once found, else "Custom Claude Skins" in this session's
// folder, else the example skins shipped with the mod (never remembered, so a
// folder of your own found later still wins).
async function loadSkins($: EngineInterface): Promise<{ folder: string; loaded: number; skipped: string[] }> {
  const remembered = await $.store.get('skinsFolder').catch(() => undefined)
  const cwd = await $.session.cwd().catch(() => '')
  const bundled = `${$.plugin.root}/skins`
  const candidates = [typeof remembered === 'string' ? remembered : '', cwd ? `${cwd.replace(/[\\/]+$/, '')}/${SKINS_FOLDER}` : '', bundled].filter(Boolean)
  for (const folder of candidates) {
    if (!(await $.fs.exists(folder).catch(() => false))) continue
    if (folder !== remembered && folder !== bundled) await $.store.set('skinsFolder', folder).catch(() => undefined)
    let loaded = 0
    const skipped: string[] = []
    const files = await $.fs.list(folder).catch((err: unknown) => {
      skipped.push(`folder: ${String(err).slice(0, 80)}`)
      return []
    })
    for (const f of files) {
      // Dotfiles are skipped: macOS leaves `._name.json` beside files copied from other disks.
      if (f.kind !== 'file' || f.name.startsWith('.') || !f.name.toLowerCase().endsWith('.json')) continue
      try {
        const k = readSkin(parseJson(await $.fs.read(`${folder}/${f.name}`)), f.name.replace(/\.json$/i, '').toLowerCase())
        if (k) {
          SKINS.set(k.id, k)
          loaded += 1
        }
      } catch (err) {
        // A broken file is skipped, and /skin reload says why.
        skipped.push(`${f.name}: ${String(err).slice(0, 80)}`)
      }
    }
    return { folder, loaded, skipped }
  }
  return { folder: '', loaded: 0, skipped: [] }
}

function applySkin(k: Skin): void {
  SKIN = k
  ACCENT = k.colors.accent
  DONE = k.colors.done
  FONT = k.font
  TIDE = k.colors.accent2
  KELP = k.colors.done
  ROLE_PALETTE = k.roles
  MOOD_COLOR = [k.colors.done, k.colors.warn, k.colors.alert]
  PANE_CSS = paneCss(k)
}

// An open pane behind another tab is not raised by a second ui.open: close it, then open it.
async function showPane($: EngineInterface, id: string, title: string): ReturnType<EngineInterface['ui']['open']> {
  const all = await $.ui.panes().catch(() => [])
  const row = all.find(p => p.id === id)
  if (row && !row.isShown) await $.ui.close({ id }).catch(() => undefined)
  return $.ui.open({ id, title })
}

// What the desktop app counts against its 262,144-character limit for one drawing:
// every text, an Svg's source and alt, each other element's prop names and string
// values. Past the limit it draws a blank pane; DRAW_MAX leaves room for its own count.
const DRAW_MAX = 220_000
const drawnChars = (n: unknown): number => {
  if (typeof n === 'string') return n.length
  if (Array.isArray(n)) return n.reduce((sum: number, c) => sum + drawnChars(c), 0)
  if (!n || typeof n !== 'object') return 0
  const el = n as { type?: unknown; props?: Record<string, unknown>; children?: unknown }
  const props = el.props ?? {}
  const own =
    el.type === 'Svg'
      ? String(props.source ?? '').length + String(props.alt ?? '').length
      : Object.entries(props).reduce((sum, [k, v]) => (k === 'children' ? sum : sum + k.length + (typeof v === 'string' ? v.length : 0)), 0)
  return own + drawnChars(el.children ?? props.children)
}

// After a switch, the open panes take the new skin's tab titles.
async function retitle($: EngineInterface): Promise<void> {
  const open = await $.ui.panes().catch(() => [])
  for (const p of open) {
    if (p.id === PANE) await $.ui.open({ id: PANE, title: SKIN.tabs.mission }).catch(() => undefined)
    if (p.id === SKINS_PANE) await $.ui.open({ id: SKINS_PANE, title: SKIN.tabs.skins }).catch(() => undefined)
  }
}

// Every drawing calls this first: it follows the skin atom, so a switch redraws all.
async function useSkin($: EngineInterface): Promise<Skin> {
  const id = await read($, skin)
  if (id !== SKIN.id) applySkin(SKINS.get(id) ?? CRAB_SKIN)
  return SKIN
}

// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Hebrew or Russian.

type Lang = 'en' | 'ru' | 'he'

const STRINGS = {
  en: {
    pane: 'Mission Control',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    planned: 'Planned',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    stopped: 'stopped',
    after: 'after',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    isPlanned: 'planned',
    opened: 'Mission Control opened.',
    closed: 'Mission Control closed.',
    done: 'Done',
    plan: 'Plan',
    design: 'Design',
    tasks: 'Tasks',
    review: 'Review',
    busy: 'running',
    idle: 'Idle',
    working: 'Working…',
    ctx: 'ctx',
    bgTitle: 'Background',
    bgKind: { shell: 'Shell', subagent: 'Agent', monitor: 'Monitor', workflow: 'Workflow', scheduled: 'Scheduled' },
    bgStatus: { running: 'running', pending: 'pending', repeats: 'repeats', once: 'once', released: 'released' },
    bgMore: 'more',
    bgBand: 'in the background',
    bgWait: 'Waiting',
    bgWaiting: (n: number): string => `Waiting on ${n} background ${n === 1 ? 'task' : 'tasks'}`,
    bgAgo: (min: number): string => (min < 1 ? 'updated just now' : min < 60 ? `updated ${min} min ago` : `updated ${Math.floor(min / 60)} h ago`),
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  ru: {
    pane: 'Центр управления',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    planned: 'Запланированы',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    stopped: 'остановлен',
    after: 'после',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    isPlanned: 'запланирована',
    opened: 'Центр управления открыт.',
    closed: 'Центр управления закрыт.',
    done: 'Готово',
    plan: 'План',
    design: 'Дизайн',
    tasks: 'Задачи',
    review: 'Ревью',
    busy: 'в работе',
    idle: 'Ожидание',
    working: 'Работает…',
    ctx: 'ctx',
    bgTitle: 'Фоновые задачи',
    bgKind: { shell: 'Шелл', subagent: 'Агент', monitor: 'Монитор', workflow: 'Процесс', scheduled: 'По расписанию' },
    bgStatus: { running: 'работает', pending: 'ожидает', repeats: 'повторяется', once: 'однажды', released: 'отпущена' },
    bgMore: 'ещё',
    bgBand: 'в фоне',
    bgWait: 'Ожидание',
    bgWaiting: (n: number): string => `Ждём фоновые задачи: ${n}`,
    bgAgo: (min: number): string => (min < 1 ? 'обновлено только что' : min < 60 ? `обновлено ${min} мин назад` : `обновлено ${Math.floor(min / 60)} ч назад`),
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  he: {
    pane: 'מרכז בקרה',
    cost: 'עלות',
    tokens: 'טוקנים',
    time: 'זמן',
    collapse: 'כיווץ',
    expand: 'הרחבה',
    running: 'פועלים',
    finished: 'הסתיימו',
    planned: 'מתוכננים',
    empty: 'עדיין אין סוכנים.',
    round: 'סבב',
    failed: 'שגיאה',
    stopped: 'נעצר',
    after: 'אחרי',
    tokensWord: 'טוקנים',
    agentsCount: 'סוכנים',
    isRunning: 'פועל',
    isFinished: 'הסתיים',
    isPlanned: 'מתוכנן',
    opened: 'מרכז הבקרה נפתח.',
    closed: 'מרכז הבקרה נסגר.',
    done: 'הושלם',
    plan: 'תכנון',
    design: 'עיצוב',
    tasks: 'משימות',
    review: 'בדיקה',
    busy: 'בעבודה',
    idle: 'ממתין',
    working: 'עובד…',
    ctx: 'הקשר',
    bgTitle: 'ברקע',
    bgKind: { shell: 'מעטפת', subagent: 'סוכן', monitor: 'ניטור', workflow: 'תהליך', scheduled: 'מתוזמן' },
    bgStatus: { running: 'פועל', pending: 'ממתין', repeats: 'חוזר', once: 'פעם אחת', released: 'שוחרר' },
    bgMore: 'נוספים',
    bgBand: 'ברקע',
    bgWait: 'ממתין',
    bgWaiting: (n: number): string => `ממתין ל־${n} משימות רקע`,
    bgAgo: (min: number): string => (min < 1 ? 'עודכן עכשיו' : min < 60 ? `עודכן לפני ${min} דק׳` : `עודכן לפני ${Math.floor(min / 60)} שע׳`),
    tier: { light: 'קל', medium: 'בינוני', careful: 'זהיר', heavy: 'כבד', fable: 'פייבל', other: 'אחר' },
    effort: { low: 'נמוך', medium: 'בינוני', high: 'גבוה', xhigh: 'גבוה מאוד', max: 'מקסימלי' },
  },
} as const

// Module scope is fine here: session.start sets it again on every (re)load.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]

// Hebrew draws every row mirrored: crab and title on the right, numbers on the left.
const isRtl = () => lang === 'he'

// Tier and effort words as shown; anything unknown shows as it came.
const tierWord = (tier: string): string => (tr().tier as Record<string, string>)[tier] ?? tier
const effortWord = (effort: string): string => (tr().effort as Record<string, string>)[effort] ?? effort

const isRussian = (v: unknown): boolean => typeof v === 'string' && /^(ru|russian|рус)/i.test(v.trim())
const isHebrew = (v: unknown): boolean => typeof v === 'string' && /^(he|iw|hebrew|עברית)/i.test(v.trim())
const langOf = (v: unknown): Lang => (isHebrew(v) ? 'he' : isRussian(v) ? 'ru' : 'en')

async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'ru' || option === 'he') return option
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) return langOf(settings.language)
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  if (locale) return langOf(locale)
  // An app opened from the macOS Dock sets no LANG, and the hooks runtime's Intl
  // always says en-US there: ask macOS for the first preferred language instead.
  if (await $.env.get('__CF_USER_TEXT_ENCODING')) {
    try {
      const { exitCode, stdout } = await $.process.run(['/usr/bin/defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 })
      const first = exitCode === 0 ? /[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*/.exec(stdout.replace(/^\s*\(/, ''))?.[0] : undefined
      if (first) return langOf(first)
    } catch {
      // No `defaults` (or not the CLI): fall through.
    }
  }
  // Windows and apps opened from the macOS Dock set no LANG: the runtime still knows.
  let system = ''
  try {
    system = Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    // No Intl: English.
  }
  return langOf(system)
}

const blank = (): Flow => ({
  title: 'mission-control',
  total: 0,
  done: 0,
  running: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && clip(input.title.trim(), MAX_TITLE) !== prev.title)

// Only a known tier is kept: the name is later a key into the tier tables.
const tierName = (v: string): string => {
  const t = v.replace(/^mc-/, '').trim().toLowerCase()
  return TIERS.includes(t) ? t : ''
}

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => t.title?.trim())
    .slice(0, MAX_TASKS)
    .map(t => ({
      title: (t.title ?? '').trim(),
      tier: tierName(t.tier ?? ''),
      after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0).slice(0, MAX_AFTER),
      ...(cleanMin(t.minutes) ? { minutes: cleanMin(t.minutes) } : {}),
    }))

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.min(MAX_TASKS, Math.max(0, Math.round(input.total ?? (input.tasks ? tasks.length : base.total))))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: clip(input.title?.trim() || base.title, MAX_TITLE),
    total,
    done,
    phase: input.finished ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
    // Left out, the plan's budget keeps its last value, as every other field does.
    ...(cleanMin(input.minutes) ? { minutes: cleanMin(input.minutes) } : {}),
  }
}

const label = (f: Flow): string => {
  const s = tr()
  if (f.isFinished) return s.done
  if (f.phase === 'plan') return s.plan
  if (f.phase === 'design') return s.design
  const count = f.total ? `${f.done}/${f.total}` : `${f.running} ${s.busy}`
  return `${f.phase === 'review' ? s.review : s.tasks} ${count}`
}

const ratio = (f: Flow): number => (f.isFinished ? 1 : f.total ? f.done / f.total : 0)

// Deterministic noise so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// The whole row is one SVG: the desktop wraps sibling elements onto new lines,
// so title, bar, percent and the crab live in one drawing; only the count and
// the dismiss are Buttons beside it.
const H = 22
const BAR_H = 16
const CRAB_W = 26
// The crab's drawing grid is 30 units wide, props included.
const CRAB_BOX = 30
const CELL = 3
let FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Ubuntu,Cantarell,'Noto Sans','Liberation Sans',sans-serif"

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)

// A coordinate to two decimals: 7.348837209302325 is 7.35 in the markup.
const r2 = (n: number): number => Math.round(n * 100) / 100

// Text drawn on a coloured fill: near-black on a light fill, white on a dark one,
// by the fill's relative luminance (WCAG). A colour it cannot read gets white.
const inkOn = (color: string): string => {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color.trim())?.[1] ?? ''
  const full = hex.length === 3 || hex.length === 4 ? [...hex.slice(0, 3)].map(ch => ch + ch).join('') : hex.slice(0, 6)
  if (full.length !== 6) return '#FFFFFF'
  const lin = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4) > 0.18 ? '#111111' : '#FFFFFF'
}

// CJK, fullwidth forms and emoji advance about 1em; at 0.56em a Chinese title was sized at half its width and the bar drew over it.
// 中日韩文字、全角标点和 emoji 约占 1em；按 0.56em 算时中文标题宽度被低估近一半，进度条会压到标题上。
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u

// Rough advance of system UI text, in em; good enough to size the title's slot.
const charEm = (ch: string): number =>
  WIDE.test(ch) ? 1 : /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

// U+FE0E (text presentation, after a glyph macOS would draw as an emoji) has no width.
const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => (ch === '\uFE0E' ? w : w + charEm(ch) * size), 0)

// Cuts `s` to fit `maxW` pixels, with an ellipsis when it had to cut.
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

// With no flow reported the band still draws: an idle row whose pill says what Claude is doing.
const IDLE_TITLE = 'Claude'
const idleFlow = (): Flow => ({ ...blank(), title: IDLE_TITLE })

// `idleText` marks the idle row: the pill shows it, and there is no percent.
const RING = 26

// The crab leads the row; the ring at the end is the session's context fill.
const rowSvg = (f: Flow, W: number, isWorking: boolean, idleText?: string, ctxPct = 0): string => {
  // The title takes what it needs, up to 40% of the row; the bar takes the rest.
  const title = fitText(f.title, 13, Math.max(60, W * 0.4))
  const BAR_X = Math.round(CRAB_W + 8 + textWidth(title, 13) + 12)
  const BAR_W = Math.max(60, W - BAR_X - (idleText ? 12 : 46) - RING)
  const color = f.isFinished ? DONE : ACCENT
  const y0 = (H - BAR_H) / 2
  const fillW = Math.round(BAR_W * ratio(f))
  const runW = f.total ? Math.round((BAR_W * Math.min(f.total, f.done + f.running)) / f.total) : 0
  const dots: string[] = []
  // Positions are worked out left to right; right to left mirrors each box
  // inside the bar (`bx`) and across the row (`rx`). Text is never mirrored.
  const rtl = isRtl()
  const bx = (x: number, w: number): number => (rtl ? BAR_W - x - w : x)
  const rx = (x: number, w: number): number => (rtl ? W - x - w : x)

  // Dithered fill: sparse at the start, dense toward the head.
  const cols = Math.floor(fillW / CELL)
  const rows = Math.floor(BAR_H / CELL)
  for (let c = 0; c < cols; c++) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r++) {
      if (noise(c, r) < density) dots.push(`<rect class="t${Math.floor(noise(r, c) * 4)}" x="${bx(c * CELL + 1, 2)}" y="${r * CELL + 1}" width="2" height="2"/>`)
    }
  }
  // Handed to workers, not yet accepted: a faint second layer.
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / CELL); c++) {
    for (let r = 0; r < rows; r++) {
      if (noise(c + 7, r + 3) < 0.2) faint.push(`<rect class="t${Math.floor(noise(r + 5, c) * 4)}" x="${bx(c * CELL + 1, 1.7)}" y="${r * CELL + 1}" width="1.7" height="1.7"/>`)
    }
  }

  const ticks: string[] = []
  for (let i = 1; i < f.total; i++) {
    const x = Math.round((BAR_W * i) / f.total)
    if (x > fillW + 4) ticks.push(`<rect x="${bx(x, 1.5)}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx="0.75"/>`)
  }

  const text = idleText ?? label(f)
  const pillW = Math.round(18 + text.length * 6.6)
  const pillX = bx(Math.max(0, Math.min(BAR_W - pillW, fillW - pillW)), pillW)
  const percent = idleText ? '' : `${Math.round(ratio(f) * 100)}%`
  // `direction="rtl"` puts Hebrew words and numbers in reading order; `start` is then the right edge.
  const titleAt = rtl ? `x="${W - CRAB_W - 8}" direction="rtl" text-anchor="start"` : `x="${CRAB_W + 8}"`
  const percentAt = rtl ? `x="${RING + 6}" y="${H / 2 + 4.5}"` : `x="${W - RING - 6}" y="${H / 2 + 4.5}" text-anchor="end"`
  const ringX = rx(W - RING / 2, 0)
  const ringR = 9
  const arc = 2 * Math.PI * ringR
  const ringColor = gaugeColor(ctxPct)
  const crabW = CRAB_BOX * 0.8

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
${SKIN.dark ? `.t{fill:${SKIN.colors.text}}.m{fill:${SKIN.colors.subtext}}.k{fill:${SKIN.colors.track}}.tk{fill:${SKIN.colors.line}}` : `.t{fill:#1f1f1f}.m{fill:#6e6e6a}.k{fill:#e4e4e2}.tk{fill:#b4b4b0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.m{fill:#9a9a9a}.k{fill:#2c2c2c}.tk{fill:#5a5a5a}}`}
/* Pixels twinkle in four out-of-phase groups; a finished bar settles to a slow glow. */
.t0,.t1,.t2,.t3{animation:tw ${f.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:${f.isFinished ? 3.8 : 2.8}s;animation-delay:-.7s}.t2{animation-duration:${f.isFinished ? 4.4 : 1.9}s;animation-delay:-1.3s}.t3{animation-duration:${f.isFinished ? 3.5 : 3.3}s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${f.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>
<defs><clipPath id="c"><rect x="0" y="0" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<text class="t" ${titleAt} y="${H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
<g transform="translate(${rx(BAR_X, BAR_W)},${y0})">
<rect class="k" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#c)">
<g fill="${color}">${dots.join('')}</g>
<g fill="${color}" opacity="0.45">${faint.join('')}</g>
<g class="tk">${ticks.join('')}</g>
</g>
<rect x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle"${rtl ? ' direction="rtl"' : ''} font-family="${FONT}" font-size="11" font-weight="600" fill="${inkOn(color)}">${xml(text)}</text>
</g>
<text class="m" ${percentAt} font-family="${FONT}" font-size="12.5" font-variant-numeric="tabular-nums">${percent}</text>
${CRAB_CSS}${crab(rx(0, crabW), 0, 'boss', false, isWorking, 0.8, rtl)}
<circle cx="${ringX}" cy="${H / 2}" r="${ringR}" fill="none" stroke="#8a8a86" stroke-opacity=".28" stroke-width="2.6"/>
<circle cx="${ringX}" cy="${H / 2}" r="${ringR}" fill="none" stroke="${ringColor}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${((arc * ctxPct) / 100).toFixed(1)} ${arc.toFixed(1)}" transform="rotate(-90 ${ringX} ${H / 2})"/>
<text x="${ringX}" y="${H / 2 + 2.8}" text-anchor="middle" fill="${ringColor}" font-family="${FONT}" font-size="7.5" font-weight="700">${ctxPct}</text>
</svg>`
}

const barText = (f: Flow, width: number): string => {
  const filled = Math.round(width * ratio(f))
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session, plus the tasks the flow planned.

const TIER_COLOR: Record<string, string> = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  other: '#888780',
}

// What each worker tier runs on, for planned tasks that have no run yet.
const colorOf = (tier: string): string => TIER_COLOR[tier] ?? '#888780'

const TIER_MODEL: Record<string, [model: string, effort: string]> = {
  fable: ['Fable', 'high'],
  heavy: ['Opus', 'xhigh'],
  careful: ['Opus', 'high'],
  medium: ['Opus', 'medium'],
  light: ['Opus', 'low'],
}

// "Opus · xhigh", with the effort word in the panel's language; '' for an unknown tier.
const tierModel = (tier: string): string => {
  const m = TIER_MODEL[tier]
  return m ? `${m[0]} · ${effortWord(m[1])}` : ''
}

// The effort a run works at: what its requests carried, else its tier's, else the default.
const runEffort = (a: AgentRun): string => a.effort ?? TIER_MODEL[tierOf(a.type)]?.[1] ?? 'default'

// "Opus 5.5 · effort low" for a run.
const runModel = (a: AgentRun): string => `${modelName(a.model)} · effort ${effortWord(runEffort(a))}`

// USD per million tokens: input, output, cache read, cache write. The first row that
// matches a model id wins, so a release sits above its family.
// The engine reports tokens, not money, so the panel's cost is an estimate. It reports
// one cache-write count with no split by lifetime; writes are priced at the 1-hour
// rate (2x input), which is what Claude Code writes on a subscription.
type Price = [input: number, output: number, cacheRead: number, cacheWrite: number]

const PRICES: [RegExp, Price][] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 20]],
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5-5/, [2, 10, 0.1, 4]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]

// Haiku 5.5 is priced by prompt length: a request whose prompt (input, cache reads and
// cache writes together) is over 100,000 tokens pays these prices instead.
const HAIKU_LONG_PROMPT = 100_000
const HAIKU_LONG: Price = [0.5, 2.5, 0.05, 1]

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string, prompt: number): Price => {
  const id = model.toLowerCase()
  if (prompt > HAIKU_LONG_PROMPT && /haiku-5-5/.test(id)) return HAIKU_LONG
  return PRICES.find(([re]) => re.test(id))?.[1] ?? [4, 20, 0.2, 8]
}

// `isRequest` says the usage is one model request, which is what a prompt-length price
// is set by; a turn's sum is priced at the model's ordinary prices.
const costOf = (model: string, u: Usage, isRequest: boolean): number => {
  const prompt = isRequest ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0
  const [i, o, r, w] = priceOf(model, prompt)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

// Haiku 4.5 and the Claude 3 models have a 200K window; the rest, Haiku 5.5 included, 1M.
const windowOf = (model: string): number => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)

// `mc-careful`, or `<plugin>:mc-careful` when the agents ship in a plugin.
// A Mission Control worker: one of the four tiers, bare or under a plugin's name.
const isWorker = (type: string): boolean => /^(?:[^:]+:)?mc-(?:fable|light|medium|careful|heavy)$/.test(type)

const tierOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  const t = bare.replace(/^mc-/, '').toLowerCase()
  return Object.hasOwn(TIER_COLOR, t) && bare.startsWith('mc-') ? t : 'other'
}

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fmtTokens = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

// The easter eggs' flavour: the cyberpunk skins' casts have them, the rest none.
const eggOf = (): Egg | undefined => (SKIN.cast === 'runners' || SKIN.cast === 'netrun' || SKIN.cast === 'corpo' || SKIN.cast === 'samurai' ? SKIN.cast : undefined)

// The money a cost is shown in. Costs are counted in US dollars and converted at an
// approximate rate (each one can be set with `/missioncontrol currency <code> <rate>`);
// Auto shows dollars, or Night City's eddies (€$, one to the dollar) on the cyberpunk skins.
type Currency = { code: string; symbol: string; rate: number; decimals: number }
const CURRENCIES: Currency[] = [
  { code: 'AUTO', symbol: '', rate: 1, decimals: 2 },
  { code: 'USD', symbol: '$', rate: 1, decimals: 2 },
  { code: 'EDDIES', symbol: '€$', rate: 1, decimals: 2 },
  { code: 'EUR', symbol: '€', rate: 0.92, decimals: 2 },
  { code: 'GBP', symbol: '£', rate: 0.79, decimals: 2 },
  { code: 'JPY', symbol: '¥', rate: 150, decimals: 0 },
  { code: 'MYR', symbol: 'RM', rate: 4.4, decimals: 2 },
  { code: 'SGD', symbol: 'S$', rate: 1.34, decimals: 2 },
]
let CURRENCY: Currency = CURRENCIES[0] as Currency
const currencyOf = (code: string, rate?: number): Currency => {
  const base = CURRENCIES.find(c => c.code === code.toUpperCase()) ?? (CURRENCIES[0] as Currency)
  return rate && rate > 0 && base.code !== 'AUTO' ? { ...base, rate } : base
}
const currencyLabel = (c: Currency): string => (c.code === 'AUTO' ? 'Auto ($, or €$ on cyberpunk skins)' : `${c.code} ${c.symbol}${c.rate !== 1 ? ` (≈${c.rate} per $)` : ''}`)

const fmtCost = (usd: number): string => {
  const c = CURRENCY.code === 'AUTO' ? (eggOf() ? (CURRENCIES[2] as Currency) : (CURRENCIES[1] as Currency)) : CURRENCY
  const v = usd * c.rate
  return `${c.symbol}${c.decimals === 0 ? Math.round(v).toLocaleString('en-US') : v < 10 ? v.toFixed(2) : v < 10_000 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US')}`
}

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

type Planned = PlannedTask & { n: number }

const plannedOf = (f: Flow | null, list: AgentRun[]): Planned[] => {
  if (!f || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return (f.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

const totals = (list: AgentRun[], at: number) => {
  const cost = list.reduce((s, a) => s + a.costUsd, 0)
  const tokens = list.reduce((s, a) => s + a.tokens, 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return { cost, tokens, time: list.length ? end - start : 0 }
}

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

// The pane's text and surface classes: a dark-only skin paints its own colours;
// the classic follows the system scheme.
const paneCss = (k: Skin): string => {
  const c = k.colors
  const dark = `.t{fill:${c.text}}.s{fill:${c.subtext}}.m{fill:${c.muted}}.k{fill:${c.track}}.ln{stroke:${c.line}}.tile{fill:${c.tile}}.tr{stroke:${c.text}}.ac{fill:${c.accent}}`
  // On a light background the classic violet (and Default's grey) is too faint to
  // read as text: light mode writes it darker.
  const lightAccent = k.id === CRAB_SKIN.id ? '#5B57D6' : k.id === DEFAULT_SKIN.id ? '#6e6e6a' : c.accent
  const scheme = k.dark
    ? dark
    : `.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#6e6e6a}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}.tr{stroke:#1f1f1f}.ac{fill:${lightAccent}}
@media (prefers-color-scheme: dark){${dark}}`
  const glitch = k.effects.glitch
    ? `.gl{animation:gl 3.6s steps(1) infinite}@keyframes gl{0%,90%,100%{transform:none}91%{transform:translate(2px,-1px)}93%{transform:translate(-2px,1px)}95%{transform:translate(1px,0)}}`
    : ''
  return `<style>
${scheme}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
${glitch}
@media (prefers-reduced-motion: reduce){.live,.gl{animation:none}}
</style>`
}
let PANE_CSS = paneCss(CRAB_SKIN)

// Pixel Clawd from DockCrab (Clawdy): a 24×18 crab on a 30×28 grid, one costume per tier.
// The body keeps the brand clay; the tier's color lives in the costume's accent.
const CLAY = '#D97757'
const INK = '#1F1E1D'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// costume, `la`/`lb` the leg pairs, anything else a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// `armCls` lets a raised claw travel with the prop it holds.
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every crab walks;
// each costume adds its prop's own motion on top.
const CRAB_CSS = `<style>
${CAST_CSS}.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-fable.run{animation:float 1s ease-in-out infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}
.c-fable.run .ant{animation:blink 1s steps(1) infinite}
.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-heavy.run .it{animation:scan 1s steps(1) infinite}
.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-medium.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
.c-artist.run .it{transform-origin:100% 100%;animation:paint .6s ease-in-out infinite}
@keyframes paint{50%{transform:rotate(-22deg) translateY(1px)}}
.c-writer.run .it{animation:scribble .4s steps(2) infinite}
.c-banker.run .it{animation:flipcoin .8s steps(2) infinite}
@keyframes flipcoin{50%{transform:translateY(-3px) scaleX(.4)}}
.dance{transform-box:fill-box;transform-origin:50% 100%;animation:hop .45s ease-in-out infinite}
@keyframes hop{25%{transform:translateY(-5px) rotate(-8deg)}75%{transform:translateY(-5px) rotate(8deg)}}
@keyframes scribble{50%{transform:translate(-1px,1px)}}
@media (prefers-reduced-motion: reduce){.run,.run g,.dance{animation:none!important}}
</style>`

const COSTUMES: Record<string, (f: Fill, t: string) => void> = {
  // Fable: astronaut in a glass dome; floats instead of walking, the antenna and the star blink.
  fable: (f, t) => {
    crabBody(f)
    f(6, 7, 18, 1, '#E6E8EE'); f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 8, 18, 14, 'rgba(169,214,245,.32)'); f(8, 9, 2, 1, '#fff'); f(8, 10, 1, 2, '#fff')
    f(14, 4, 2, 3, '#C9CCD2'); f(14, 2, 2, 2, t, 'ant'); f(13, 18, 4, 2, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  // Heavy: detective with a deerstalker; the magnifier sweeps and glints.
  heavy: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' })
    f(6, 9, 18, 1, t)
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  // Careful: engineer in a hard hat; the wrench turns a bolt.
  careful: (f, t) => {
    crabBody(f)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  // Medium: chef, the toque traced from DockCrab's Sprites.chefHat; tosses the omelette.
  medium: (f, t) => {
    crabBody(f, -4, 'pan')
    stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: t, d: '#B45F43' })
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
  },
  // Light: racer in a helmet; runs at double pace, the checkered flag flutters.
  light: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 5, ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'], { r: t, w: '#F8F6F1', k: INK })
    f(25, 1, 1, 9, '#8E929A')
    stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  // Explore: pirate scouting the code; the cutlass fences.
  explore: f => {
    crabBody(f)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  // Artist: a tilted beret; the brush in the raised claw paints.
  artist: f => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 5, ['....rrrrrrr.....', '..rrrrrrrrrrr...', '.rrrrrrrrrrrrr..', 'rrrrrrrrrrrrrrr.', '.......k........'], { r: '#C2415A', k: '#7A2236' })
    f(25, 3, 1, 8, '#8B5A2B', 'it'); f(24, 1, 3, 3, '#F5C542', 'it'); f(24, 0, 3, 1, '#5EC8D8', 'it')
  },
  // Writer: round glasses; the quill scribbles.
  writer: f => {
    crabBody(f, -4, 'it')
    f(8, 11, 4, 3, '#2B2B2B'); f(18, 11, 4, 3, '#2B2B2B'); f(12, 12, 6, 1, '#2B2B2B'); f(9, 12, 2, 1, '#9fd3ff'); f(19, 12, 2, 1, '#9fd3ff')
    stamp(f, 24, 0, ['..w', '.ww', 'www', 'ww.', 'w..'], { w: '#F4F3EE' }, 'it')
    f(24, 5, 1, 5, '#3A3A3C', 'it')
  },
  // Banker: the token manager's green visor; the coin in its claw flips.
  banker: f => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 6, ['...gggggggggggg...', '..gggggggggggggg..', 'GGGGGGGGGGGGGGGGGG'], { g: 'rgba(47,158,91,.85)', G: '#1F7A44' })
    f(24, 2, 4, 4, '#F5C542', 'it'); f(25, 3, 2, 2, '#C99A1E', 'it')
  },
  other: f => crabBody(f),
}

const costumeOf = (type: string): string => (type === 'Explore' ? 'explore' : tierOf(type))

// A named role dresses its crab: "Designer: ..." wears the beret, "Tester: ..." the magnifier.
const ROLE_COSTUMES: Record<string, string> = {
  designer: 'artist',
  'sub-designer': 'artist',
  artist: 'artist',
  writer: 'writer',
  editor: 'writer',
  engineer: 'careful',
  developer: 'careful',
  builder: 'careful',
  tester: 'heavy',
  reviewer: 'heavy',
  detective: 'heavy',
  researcher: 'explore',
  explorer: 'explore',
  scout: 'explore',
  planner: 'fable',
  architect: 'fable',
  runner: 'light',
  chef: 'medium',
  accountant: 'banker',
  banker: 'banker',
}
const costumeFor = (a: { type: string; description?: string }): string => {
  const m = /^([A-Za-z][A-Za-z -]{1,23}):\s+\S/.exec(a.description ?? '')
  const word = m?.[1]?.trim().toLowerCase().replace(/s$/, '')
  return (word && ROLE_COSTUMES[word]) || costumeOf(a.type)
}

const CRAB_SCALE = 1.1
// How much larger a cast's character is drawn than the crab it stands in for:
// only in the hierarchy, which has room above each figure. In a card or the band
// it stays inside the crab's box, so it never sticks out of its frame.
const CAST_GROW = 1.3
let castGrow = 1

// While the hierarchy draws, each distinct figure (sprite and motion) is defined
// once and every copy is a <use>: a big crew stays under the size limit. A figure's
// class wrappers stay inside its definition, so its CSS still matches; its pixels
// are shared again one level down, so a walking and a standing copy cost one set.
let figureDefs: Map<string, string> | null = null
const placeFigure = (markup: string): string => {
  if (!figureDefs) return markup
  let id = figureDefs.get(markup)
  if (!id) {
    id = `fg${figureDefs.size}`
    figureDefs.set(markup, id)
  }
  return `<use href="#${id}"/>`
}

// A sprite path is one `M x y h w v1 h-w z` per run of pixels: runs that touch
// merge into larger boxes, written with relative moves. The same pixels, shorter.
const PIXEL_RUN = /M(-?\d+) (-?\d+)h(\d+)v1h-\d+z/g
const mergeRuns = (d: string): string => {
  if (d.replace(PIXEL_RUN, '') !== '') return d
  const rows = new Map<number, [number, number][]>()
  for (const m of d.matchAll(PIXEL_RUN)) {
    const y = Number(m[2])
    rows.set(y, [...(rows.get(y) ?? []), [Number(m[1]), Number(m[3])]])
  }
  const flat: [number, number, number][] = []
  for (const [y, runs] of rows) {
    let cur: [number, number, number] | null = null
    for (const [x, w] of runs.sort((a, b) => a[0] - b[0])) {
      if (cur && cur[0] + cur[2] === x) cur[2] += w
      else {
        if (cur) flat.push(cur)
        cur = [x, y, w]
      }
    }
    if (cur) flat.push(cur)
  }
  flat.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1])
  const boxes: [number, number, number, number][] = []
  for (const [x, y, w] of flat) {
    const last = boxes.at(-1)
    if (last && last[0] === x && last[2] === w && last[1] + last[3] === y) last[3] += 1
    else boxes.push([x, y, w, 1])
  }
  boxes.sort((a, b) => a[1] - b[1] || a[0] - b[0])
  let px = 0
  let py = 0
  return boxes
    .map(([x, y, w, h], i) => {
      const move = i ? `m${x - px} ${y - py}` : `M${x} ${y}`
      px = x
      py = y
      return `${move}h${w}v${h}h${-w}z`
    })
    .join('')
}

const SHAPE_RUN = /(?:<(?:path|rect) [^>]*\/>)+/g
const figureDefsMarkup = (figures: Map<string, string>): string => {
  const shapes = new Map<string, string>()
  const shapeOf = (run: string): string => {
    let id = shapes.get(run)
    if (!id) {
      id = `sh${shapes.size}`
      shapes.set(run, id)
    }
    return `<use href="#${id}"/>`
  }
  const drawn = [...figures].map(([markup, id]) => markup.replace(SHAPE_RUN, shapeOf).replace(/^<g /, `<g id="${id}" `)).join('')
  const pixels = [...shapes].map(([run, id]) => `<g id="${id}">${run.replace(/ d="([^"]*)"/g, (_, d: string) => ` d="${mergeRuns(d)}"`)}</g>`).join('')
  return pixels + drawn
}

// Body and props nest inside `bd` so a prop rides the bob and adds its own motion;
// legs stay outside it and step on their own. `mirror` flips the crab inside its
// own box (x .. x + CRAB_BOX * scale) so it faces left.
const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE, mirror = false): string => {
  const place = mirror ? `translate(${r2(x + CRAB_BOX * scale)},${r2(y)}) scale(${-scale},${scale})` : `translate(${r2(x)},${r2(y)}) scale(${scale})`
  const cast = SKIN.cast ? CASTS[SKIN.cast] : undefined
  if (cast) {
    // The boss leads; a role is one of the main crew; any other agent is a worker,
    // the same one (and the same tint) for every agent of its role.
    const role = costume.startsWith('role:') ? costume.slice(5) : ''
    const pick = hashOf(costume)
    const sprite =
      costume === 'boss' ? cast.boss : role ? (cast.roles[role] ?? cast.roles.other ?? cast.boss) : (cast.crew[pick % cast.crew.length] ?? cast.boss)
    const tint = SKIN.roles[pick % SKIN.roles.length] ?? SKIN.colors.accent
    // A character is slimmer than a crab: drawn larger, growing up from the crab's floor.
    const k = r2(scale * castGrow)
    const gx = r2(x - (CRAB_BOX * (k - scale)) / 2)
    const gy = r2(y - 27 * (k - scale))
    const grown = mirror ? `translate(${r2(gx + CRAB_BOX * k)},${gy}) scale(${-k},${k})` : `translate(${gx},${gy}) scale(${k})`
    // The tint rides in as the inherited `color`: one drawing serves every tint.
    return `<g transform="${grown}" color="${tint}"${dim ? ' opacity="0.45"' : ''} shape-rendering="crispEdges">${placeFigure(`<g class="ch${isWalking ? ' run' : ''}${sprite.float ? ' fl' : ''}">${spriteMarkup(sprite, 'currentColor', CRAB_BOX)}</g>`)}</g>`
  }
  if (costume === 'boss') costume = 'other'
  else if (costume.startsWith('role:')) costume = costume.slice(5)
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? ((g: Fill) => crabBody(g))
  draw(f, colorOf(costume))
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g transform="${place}"${dim ? ' opacity="0.45"' : ''} shape-rendering="crispEdges">${placeFigure(`<g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g>`)}</g>`
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  // Stopped on purpose (Esc, a release): a neutral square, never the error's cross.
  if (status === 'stopped') return `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1.5" fill="#9a9a96"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

// Panel rows are laid out left to right; in Hebrew each box mirrors across the
// row (`mx`) and text hugs the mirrored side. `words` text may hold Hebrew and
// takes `direction="rtl"` (whose `start` is the right edge); numbers stay
// left to right so "≈$0.25" keeps its order.
const mx = (W: number, x: number, w = 0): number => (isRtl() ? W - x - w : x)

// Text that starts at x: left-aligned, or right-aligned at the mirrored x.
const startText = (W: number, x: number, y: number, words = true): string =>
  !isRtl()
    ? `x="${x}" y="${y}"`
    : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="start"' : ' text-anchor="end"'}`

// Text that ends at x: right-aligned, or left-aligned at the mirrored x.
const endText = (W: number, x: number, y: number, words = false): string =>
  !isRtl() ? `x="${x}" y="${y}" text-anchor="end"` : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="end"' : ''}`

const crabWidth = (scale: number): number => Math.round(CRAB_BOX * scale * 100) / 100

// A panel crab at x in a row of width W: on the mirrored side and facing left in Hebrew.
const rowCrab = (W: number, x: number, y: number, costume: string, dim = false, isWalking = false): string =>
  crab(mx(W, x, crabWidth(CRAB_SCALE)), y, costume, dim, isWalking, CRAB_SCALE, isRtl())

// A card's outline in the skin's shape: rounded, or cut at two corners like a HUD panel.
const cardShape = (x: number, y: number, w: number, h: number, attrs: string, radius = 14): string => {
  if (SKIN.corners !== 'chamfer') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ${attrs}/>`
  const c = Math.min(radius, h / 3)
  const r = (n: number) => +n.toFixed(1)
  return `<path d="M${r(x + c)} ${r(y)}H${r(x + w)}V${r(y + h - c)}L${r(x + w - c)} ${r(y + h)}H${r(x)}V${r(y + c)}Z" ${attrs}/>`
}

// Scanlines over a whole drawing, for the skins that want them.
const scanlines = (W: number, H: number): string =>
  `<defs><pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" fill-opacity=".045"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#scan)" pointer-events="none"/>`

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}${SKIN.effects.scanlines ? scanlines(W, H) : ''}</svg>`
// A drawing whose crabs stand still: the walking CSS (~3K) is left out. Rows that
// repeat once per agent use it, so a big crew stays under the app's size limit.
const stillSvg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${body}${SKIN.effects.scanlines ? scanlines(W, H) : ''}</svg>`

// The pane's own title already says "Agents": the header names the flow, if any.
const headerSvg = (W: number, title: string, t: ReturnType<typeof totals>): string => {
  const s = tr()
  const gap = 6
  const tw = (W - gap * 2) / 3
  const top = title ? 28 : 0
  const tile = (i: number, k: string, v: string) =>
    `<rect class="tile" x="${mx(W, i * (tw + gap), tw)}" y="${top}" width="${tw}" height="40" rx="8"/>
<text class="s" ${startText(W, i * (tw + gap) + 9, top + 16)} font-family="${FONT}" font-size="11">${k}</text>
<text class="t" ${startText(W, i * (tw + gap) + 9, top + 33, false)} font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${v}</text>`
  return svg(
    W,
    headerHeight(title),
    `${title ? `<text class="t" ${startText(W, 0, 15)} font-family="${FONT}" font-size="14" font-weight="600">${xml(fitText(title, 14, W))}</text>` : ''}
${tile(0, s.cost, '≈' + fmtCost(t.cost))}${tile(1, s.tokens, fmtTokens(t.tokens))}${tile(2, s.time, fmtTime(t.time))}`,
  )
}

const headerHeight = (title: string): number => (title ? 72 : 44)

// How long a sub-agent usually runs: the median of this session's finished ones.
let typicalRunMs = 120_000
const noteTypicalRun = (list: readonly AgentRun[]): void => {
  const runs = list.filter(a => a.status === 'done' && a.endedAt).map(a => (a.endedAt as number) - a.startedAt).sort((x, y) => x - y)
  typicalRunMs = runs.length ? Math.max(30_000, runs[Math.floor(runs.length / 2)] as number) : 120_000
}

// A running agent that reports no steps: a guess from its time against the typical
// run, about 70% at the typical length, never past 95% until it finishes.
const isEstimated = (a: AgentRun): boolean => a.status === 'running' && !a.stepTotal
const estimateOf = (a: AgentRun, at: number): number =>
  Math.min(0.95, 1 - Math.exp((-1.2 * Math.max(0, (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt)) / typicalRunMs))

// The task's own progress when the worker reports steps; a finished run is full;
// a running one without steps is estimated when the time is known.
const progressOf = (a: AgentRun, at?: number): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  if (a.status === 'running' && at) return estimateOf(a, at)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

// --- stat tiles and progress bars shared by the manager and agent cards.

type Stat = {
  k: string
  v: string
  color?: string
  /** A small picture beside the value: effort as pips, a fill as a ring. */
  viz?: { kind: 'pips'; n: number } | { kind: 'ring'; pct: number }
  /** A value that moves each second (a clock): drawn as a strip that steps itself. */
  live?: { at: number; read: (t: number) => string }
}
const STAT_COLS = 3
const STAT_H = 40
const STAT_GAP = 8
const statRows = (n: number): number => Math.ceil(n / STAT_COLS)
const statGridHeight = (n: number): number => statRows(n) * (STAT_H + STAT_GAP)

// Model families read by colour wherever a model is named.
// The classic skins keep their own four; every other skin names them in its colours.
const modelColor = (name: string): string => {
  const c = SKIN.colors
  const isClassic = SKIN.id === CRAB_SKIN.id || SKIN.id === DEFAULT_SKIN.id
  if (/fable/i.test(name)) return isClassic ? '#F5C542' : c.accent
  if (/opus/i.test(name)) return isClassic ? '#B58BE5' : c.accent2
  if (/sonnet/i.test(name)) return isClassic ? '#6FD39A' : c.done
  if (/haiku/i.test(name)) return isClassic ? '#5EC8D8' : c.meter
  return isClassic ? '#E6E6E3' : c.text
}

const EFFORT_LEVEL: Record<string, number> = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 }
const PIP_COLORS = ['#5EC8D8', '#7FB6F0', '#B58BE5', '#E9B44C', '#E5675E']
const effortStat = (effort: string): Stat => ({ k: 'Effort', v: effortWord(effort), viz: { kind: 'pips', n: EFFORT_LEVEL[effort] ?? 0 } })

const statViz = (st: Stat, x: number, y: number): string => {
  if (st.viz?.kind === 'pips') {
    return Array.from({ length: 5 }, (_, i) => {
      const on = i < (st.viz as { n: number }).n
      return `<rect x="${x + i * 7}" y="${y}" width="5" height="10" rx="1.5" fill="${on ? PIP_COLORS[i] : '#8a8a86'}" fill-opacity="${on ? 1 : 0.22}"/>`
    }).join('')
  }
  if (st.viz?.kind === 'ring') {
    const r = 7
    const arc = 2 * Math.PI * r
    const pct = Math.max(0, Math.min(100, st.viz.pct))
    const c = gaugeColor(pct)
    return `<circle cx="${x + r}" cy="${y + 5}" r="${r}" fill="none" stroke="#8a8a86" stroke-opacity=".25" stroke-width="2.6"/>
<circle cx="${x + r}" cy="${y + 5}" r="${r}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${((arc * pct) / 100).toFixed(1)} ${arc.toFixed(1)}" transform="rotate(-90 ${x + r} ${y + 5})"/>`
  }
  return ''
}

// Readouts three a row, split by hairlines: a readable label, a bright value,
// and a small picture where one says more than the number.
const statGrid = (x: number, y: number, w: number, stats: Stat[]): string => {
  const cw = w / STAT_COLS
  const out: string[] = []
  stats.forEach((st, i) => {
    const col = i % STAT_COLS
    const cx = x + col * cw
    const cy = y + Math.floor(i / STAT_COLS) * (STAT_H + STAT_GAP)
    const pad = col === 0 ? 0 : 12
    if (col > 0) out.push(`<line x1="${cx.toFixed(1)}" y1="${cy + 4}" x2="${cx.toFixed(1)}" y2="${cy + STAT_H - 4}" stroke="#8a8a86" stroke-opacity=".3"/>`)
    const vx = cx + pad
    const vizW = st.viz ? (st.viz.kind === 'pips' ? 36 : 18) : 0
    const valueW = cw - pad - 10 - (vizW ? vizW + 8 : 0)
    const value = fitText(st.v, 15.5, valueW)
    const head = `<text class="s" x="${vx.toFixed(1)}" y="${cy + 13}" font-family="${FONT}" font-size="11" letter-spacing=".2">${xml(st.k)}</text>`
    // A clock ticks inside the image: the card is drawn again once a minute, not each second.
    out.push(st.live
      ? `${head}\n${liveText(vx, cy + 33, st.live.at, 15.5, `font-family="${FONT}" font-size="15.5" font-weight="700" font-variant-numeric="tabular-nums"${st.color ? '' : ' class="t"'}`, st.live.read, st.color)}`
      : `${head}
<text x="${vx.toFixed(1)}" y="${cy + 33}" font-family="${FONT}" font-size="15.5" font-weight="700" font-variant-numeric="tabular-nums"${st.color ? ` fill="${st.color}"` : ' class="t"'}>${xml(value)}</text>`)
    if (st.viz) out.push(statViz(st, vx + textWidth(value, 15.5) + 9, cy + 23))
  })
  return out.join('\n')
}

// A progress bar with its percent; `null` while running draws a sweeping segment.
const PROGRESS_H = 26
// `estimate`, for a guess that grows with the time: the bar glides and its percent
// steps inside the image for the minute, so the card is not drawn again each second.
// A reported value glides from the one drawn before.
const progressBar = (x: number, y: number, w: number, pct: number | null, color: string, isRunning: boolean, label = 'Progress', isEstimate = false, estimate?: { at: number; read: (t: number) => number }): string => {
  const barW = w - 52
  const shown = pct === null ? (isRunning ? 'working' : '—') : `${isEstimate ? '~' : ''}${Math.round(pct * 100)}%`
  const widthOf = (p: number) => Math.max(p > 0 ? 4 : 0, barW * Math.min(1, p))
  const live = estimate && liveWidth(estimate.at, t => widthOf(estimate.read(t)))
  const fill =
    pct === null
      ? isRunning
        ? `<rect x="${x}" y="${y + 12}" width="${Math.round(barW * 0.28)}" height="6" rx="3" fill="${color}"><animate attributeName="x" values="${x};${x + barW * 0.72};${x}" dur="1.8s" repeatCount="indefinite"/></rect>`
        : ''
      : live
        ? `<rect x="${x}" y="${y + 12}" width="${live.start}" height="6" rx="3" fill="${color}">${live.animate}</rect>`
        : `<rect x="${x}" y="${y + 12}" width="${widthOf(pct).toFixed(1)}" height="6" rx="3" fill="${pct >= 1 ? DONE : color}">${glide(`pb${Math.round(x)}-${Math.round(y)}`, widthOf(pct))}</rect>`
  const attrs = `class="t" text-anchor="end" font-family="${FONT}" font-size="12" font-weight="600" font-variant-numeric="tabular-nums"`
  return `<text class="s" x="${x}" y="${y + 8}" font-family="${FONT}" font-size="11">${xml(label)}</text>
<rect class="k" x="${x}" y="${y + 12}" width="${barW}" height="6" rx="3"/>${fill}
${estimate && pct !== null ? liveText(x + w, y + 19, estimate.at, 12, attrs, t => `${isEstimate ? '~' : ''}${Math.round(estimate.read(t) * 100)}%`) : `<text x="${x + w}" y="${y + 19}" ${attrs}>${shown}</text>`}`
}

const agentStats = (a: AgentRun, at: number): Stat[] => [
  { k: 'Model', v: modelName(a.model), color: modelColor(modelName(a.model)) },
  effortStat(runEffort(a)),
  { k: 'Tokens used', v: fmtTokens(a.tokens) },
  { k: 'Context', v: `${ctxOf(a)}%`, viz: { kind: 'ring', pct: ctxOf(a) } },
  { k: 'Cost', v: `≈${fmtCost(a.costUsd)}` },
  a.budgetMin
    ? { k: 'Time · budget', v: `${fmtTime(elapsed(a, at))} / ${a.budgetMin}m`, color: budgetTone(elapsed(a, at), a.budgetMin) || undefined, ...runClock(a, at, ` / ${a.budgetMin}m`) }
    : { k: 'Time', v: fmtTime(elapsed(a, at)), ...runClock(a, at) },
]
// A running agent's clock ticks inside its card; a finished one's time stands still.
const runClock = (a: AgentRun, at: number, tail = ''): Pick<Stat, 'live'> =>
  a.status === 'running' && !a.endedAt ? { live: { at, read: t => `${fmtTime(elapsed(a, t))}${tail}` } } : {}
const AGENT_INNER_H = 50 + statGridHeight(6) + PROGRESS_H + 8

// What share of its own work an agent has done: its reported steps, or whole once finished.
const agentProgress = (a: AgentRun, at: number): number | null => {
  const p = progressOf(a, at)
  if (p !== null) return p
  return a.status === 'running' ? null : 1
}

const agentSvg = (W: number, a: AgentRun, at: number, hasRule = true): string => {
  const s = tr()
  const tier = tierOf(a.type)
  const color = colorOf(tier)
  const textW = W - 42 - 22
  const H = AGENT_INNER_H
  const sub = [tier === 'other' ? a.type : tierWord(tier)]
  // Over budget is flagged first, so a long activity line never cuts it off.
  if (isOver(a)) sub.push(`⏱\uFE0E ${tkStr().overWord}`)
  // Whole minutes: a reading that changed each second would draw the card again each second.
  if (isQuiet(a)) sub.push(`⚠\uFE0E quiet ${Math.floor((at - (a.lastProgressAt ?? a.startedAt)) / 60_000)} min`)
  else if (a.status === 'running' && a.activity) sub.push(`▸ ${a.activity}`)
  if (a.round > 1) sub.push(`${s.round} ${a.round}`)
  if (a.status === 'failed') sub.push(s.failed)
  if (a.status === 'stopped') sub.push(s.stopped)
  if (a.stepTotal) sub.push(`step ${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ` · ${a.stepNote}` : ''}`)
  return svg(
    W,
    H,
    `${rowCrab(W, 0, 10, costumeFor(a), false, a.status === 'running')}
<text class="t" x="42" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text x="42" y="35" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(sub[0] ?? '')}</tspan><tspan class="s">${xml(fitText(sub.slice(1).map(x => `  ·  ${x}`).join(''), 11, textW - 60))}</tspan></text>
${statGrid(42, 46, W - 42 - 6, agentStats(a, at))}
${progressBar(42, 46 + statGridHeight(6), W - 42 - 6, agentProgress(a, at), color, a.status === 'running', 'Progress', isEstimated(a), isEstimated(a) ? { at, read: t => estimateOf(a, t) } : undefined)}
${statusMark(W - 8, 16, a.status, color)}
${hasRule ? `<line class="ln" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>` : ''}`,
  )
}

const plannedSvg = (W: number, p: Planned): string => {
  const tier = p.tier in TIER_COLOR ? p.tier : 'other'
  const color = colorOf(tier)
  const textW = W - 42 - 22
  const meta = [tierModel(tier)]
  if (p.after.length) meta.push(`${tr().after} ${p.after.join(', ')}`)
  return svg(
    W,
    46,
    `${rowCrab(W, 0, 6, tier, true)}
<text class="s" ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(`${p.n}. ${p.title}`, 13, textW))}</text>
<text ${startText(W, 42, 34)} font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tierWord(tier))}</tspan><tspan class="m">  ${xml(meta.filter(Boolean).join('  ·  '))}</tspan></text>
${statusMark(mx(W, W - 8), 16, 'planned', color)}
<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`,
  )
}

const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: ReturnType<typeof totals>, at = 0): string => {
  const icons = [
    ...list.filter(a => a.status === 'running').map(a => ({ k: costumeOf(a.type), c: colorOf(tierOf(a.type)), s: isQuiet(a) ? 'quiet' : 'running', dim: false })),
    ...list.filter(a => a.status !== 'running').map(a => ({ k: costumeOf(a.type), c: colorOf(tierOf(a.type)), s: a.status, dim: false })),
    ...planned.map(p => ({ k: p.tier in TIER_COLOR ? p.tier : 'other', c: colorOf(p.tier), s: 'planned', dim: true })),
  ]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const body = shown
    .map(
      (ic, i) =>
        rowCrab(W, i * 36, 0, ic.k, ic.dim, ic.s === 'running') +
        (ic.s === 'running'
          ? `<circle class="live" cx="${mx(W, i * 36 + 32)}" cy="4" r="3" fill="${ic.c}"/>`
          : ic.s === 'quiet'
            ? `<circle cx="${mx(W, i * 36 + 15)}" cy="16" r="15" fill="none" stroke="#E5675E" stroke-width="2"/><text x="${mx(W, i * 36 + 32)}" y="8" text-anchor="middle" font-size="9" fill="#E5675E">⚠\uFE0E</text>`
            : ''),
    )
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" ${startText(W, x, 21, false)} font-family="${FONT}" font-size="12">+${more}</text>` : ''}
${at && list.some(a => a.status === 'running') && !isRtl()
  ? liveText(W, 21, at, 12, `class="s" text-anchor="end" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums"`, tt => `≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(totals(list, tt).time)}`)
  : `<text class="s" ${endText(W, W, 21)} font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`}`,
  )
}

// --- the session card: environment, context, connectors and memory in one tile
// under the crew, so the pane reads as one place.

let TIDE = '#5EC8D8'
let KELP = '#5fbf8f'
const gaugeColor = (pct: number): string => (pct >= 90 ? SKIN.colors.alert : pct >= 70 ? SKIN.colors.warn : TIDE)

// `C:\Users\me\Code\my-app` → name `my-app`, parent `~\Code`; `/opt/src/app` keeps
// its leading `/`: parent `/opt/src`.
const splitCwd = (cwd: string): { name: string; parent: string } => {
  const home = cwd
    .replace(/^[a-z]:[\\/]users[\\/][^\\/]+/i, '~')
    .replace(/^\/(?:home|Users)\/[^/]+/, '~')
    .replace(/^\/root(?=\/|$)/, '~')
  const parts = home.split(/[\\/]/).filter(Boolean)
  const sep = home.includes('\\') ? '\\' : '/'
  const lead = home.startsWith('/') ? '/' : ''
  return { name: parts.at(-1) ?? cwd, parent: lead + parts.slice(0, -1).join(sep) }
}

const CARD_PAD = 14
const ENV_H = 46
const CTX_H = 54
const SECTION_HEAD = 26
const CHIP_H = 22
const RULE_H = 19

type ChipRow = { x: number; label: string; w: number }[]
const chipRows = (labels: string[], W: number): ChipRow[] => {
  const rows: ChipRow[] = [[]]
  let x = 0
  for (const label of labels) {
    const w = Math.round(22 + textWidth(label, 11.5))
    if (x + w > W && x > 0) {
      rows.push([])
      x = 0
    }
    rows.at(-1)?.push({ x, label, w })
    x += w + 6
  }
  return rows.filter(r => r.length)
}

const sessionHeight = (_W: number, _e: Env, rules: string[]): number =>
  CARD_PAD + SECTION_HEAD + Math.max(1, rules.length) * RULE_H + CARD_PAD

const sessionSvg = (W: number, e: Env, rules: string[], isWorking: boolean): string => {
  const H = sessionHeight(W, e, rules)
  const inner = W - CARD_PAD * 2
  const x0 = CARD_PAD
  const out: string[] = [`${cardShape(0.5, 0.5, W - 1, H - 1, `class="tile"`, 14)}`]
  const text = (x: number, y: number, s: string, cls: string, size: number, weight = 400, end = false) =>
    `<text class="${cls}" ${end ? endText(W, x, y) : startText(W, x, y)} font-family="${FONT}" font-size="${size}" font-weight="${weight}" font-variant-numeric="tabular-nums">${xml(s)}</text>`
  const rule = (y: number) => out.push(`<line class="ln" x1="${x0}" y1="${y + 0.5}" x2="${W - x0}" y2="${y + 0.5}"/>`)
  let y = CARD_PAD

  // Memory: the rules every session is sent.
  out.push(text(x0, y + 12, 'How Claude answers you', 's', 11.5))
  out.push(text(W - x0, y + 12, '/prefs to edit', 'm', 11, 400, true))
  y += SECTION_HEAD
  if (!rules.length) out.push(text(x0, y + 12, 'No rules yet', 'm', 12))
  rules.forEach((r, i) => {
    out.push(`<rect x="${mx(W, x0, 3)}" y="${y + i * RULE_H + 2}" width="3" height="12" rx="1.5" fill="${KELP}"/>`)
    out.push(text(x0 + 11, y + i * RULE_H + 12, fitText(r, 12, inner - 11), 't', 12))
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}
<style>.lnf{stroke:#6b6b68}.mf{fill:#6b6b68}@media (prefers-color-scheme: dark){.lnf{stroke:#a8a8a4}.mf{fill:#a8a8a4}}
.t0,.t1,.t2,.t3{animation:tw 2.4s ease-in-out infinite}.t1{animation-delay:-.6s}.t2{animation-delay:-1.2s}.t3{animation-delay:-1.8s}
@keyframes tw{50%{opacity:.45}}@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}</style>
${out.join('\n')}</svg>`
}

// --- the crew tree: the manager (main session) on top, its sub-agents grouped by
// role beneath it, and any agent a sub-agent started nested under that agent.

const ROLE_NAMES: Record<string, string> = {
  fable: 'Fable',
  heavy: 'Heavy',
  careful: 'Careful',
  medium: 'Medium',
  light: 'Light',
  Explore: 'Explorers',
  Plan: 'Planners',
  'general-purpose': 'Generalists',
}
const roleOf = (type: string): string => {
  const tier = tierOf(type)
  if (tier !== 'other') return ROLE_NAMES[tier] ?? tier
  const bare = type.includes(':') ? (type.split(':').at(-1) ?? type) : type
  return ROLE_NAMES[bare] ?? bare.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase())
}
// A task that opens with a role ("Designer: palette ideas") files under that role,
// pluralised ("Designers"); otherwise the agent's type names it.
const NAMED_ROLE = /^([A-Za-z][A-Za-z -]{1,23}):\s+\S/
const NAMED_ROLE_PREFIX = /^[A-Za-z][A-Za-z -]{1,23}:\s+(?=\S)/
const namedRole = (a: AgentRun): string | null => {
  const m = NAMED_ROLE.exec(a.description ?? '')
  const word = m?.[1]?.trim()
  if (!word) return null
  const cap = word.replace(/^./, c => c.toUpperCase())
  return /s$/i.test(cap) ? cap : `${cap}s`
}
let ROLE_PALETTE = ['#E58FB5', '#5EC8D8', '#E9B44C', '#9CCB6B', '#B58BE5', '#E5875E']
const hashColor = (s: string): string => ROLE_PALETTE[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ROLE_PALETTE.length] ?? ACCENT
const runRole = (a: AgentRun): string => namedRole(a) ?? roleOf(a.type)
const runRoleColor = (a: AgentRun): string => {
  const named = namedRole(a)
  return named ? hashColor(named) : roleColor(a.type)
}

const roleColor = (type: string): string => {
  const tier = tierOf(type)
  return tier !== 'other' ? colorOf(tier) : type === 'Explore' ? '#C9A227' : '#8a8a86'
}

type TreeRow =
  | { kind: 'role'; key: string; role: string; color: string; count: number; running: number; depth: number; isLast: boolean; lines: boolean[] }
  | { kind: 'agent'; key: string; a: AgentRun; depth: number; isLast: boolean; lines: boolean[]; color: string; folded?: boolean }

// Running first, then the newest finished; finished rows drop out while collapsed.
const crewOrder = (list: AgentRun[], hideDone: boolean): AgentRun[] => {
  const running = list.filter(a => a.status === 'running').reverse()
  const finished = hideDone ? [] : list.filter(a => a.status !== 'running').reverse()
  return [...running, ...finished]
}

const buildTree = (list: AgentRun[], hideDone: boolean): TreeRow[] => {
  const shown = crewOrder(list, hideDone)
  // Parents among the rows shown: a running agent whose finished parent is hidden
  // stands at the top, never out of sight.
  const ids = new Set(shown.map(a => a.agentId).filter(Boolean))
  const childrenOf = (id: string | undefined) => (id ? shown.filter(a => a.parentAgentId === id) : [])
  const top = shown.filter(a => !a.parentAgentId || !ids.has(a.parentAgentId))
  const roles = [...new Set(top.map(runRole))]
  const rows: TreeRow[] = []
  const addAgent = (a: AgentRun, depth: number, isLast: boolean, lines: boolean[]) => {
    rows.push({ kind: 'agent', key: a.id, a, depth, isLast, lines, color: runRoleColor(a) })
    const kids = childrenOf(a.agentId)
    kids.forEach((k, i) => addAgent(k, depth + 1, i === kids.length - 1, [...lines, !isLast]))
  }
  roles.forEach((role, i) => {
    const members = top.filter(a => runRole(a) === role)
    const isLastRole = i === roles.length - 1
    rows.push({
      kind: 'role',
      key: `role-${role}`,
      role,
      color: members[0] ? runRoleColor(members[0]) : ACCENT,
      count: members.length,
      running: members.filter(a => a.status === 'running').length,
      depth: 1,
      isLast: isLastRole,
      lines: [],
    })
    members.forEach((a, j) => addAgent(a, 2, j === members.length - 1, [!isLastRole]))
  })
  return rows
}

// The tree less some agents (and whatever they started), each row's connectors
// worked out again from the rows left. A role left with no rows goes too.
const withoutRows = (rows: TreeRow[], drop: Set<string>): TreeRow[] => {
  const kept: TreeRow[] = []
  let cut = 0
  for (const r of rows) {
    if (cut && r.depth > cut) continue
    cut = r.kind === 'agent' && drop.has(r.a.id) ? r.depth : 0
    if (!cut) kept.push(r)
  }
  const left = kept.filter((r, i) => r.kind !== 'role' || (kept[i + 1]?.depth ?? 0) > 1)
  const notLast: boolean[] = []
  return left.map((r, i) => {
    const next = left.slice(i + 1).find(n => n.depth <= r.depth)
    const isLast = !next || next.depth < r.depth
    const lines = notLast.slice(0, r.depth - 1)
    notLast[r.depth - 1] = !isLast
    return { ...r, isLast, lines }
  })
}

const UNIT = 18
const ROLE_H = 34
const AGENT_H = AGENT_INNER_H + 8
const BOX_PAD = 10
const isBoxed = (r: TreeRow): boolean => r.kind === 'agent' && r.depth === 2
// Where a row's own drawing starts and how wide it is, inside its card if it has one.
const rowInnerX = (r: TreeRow): number => r.depth * UNIT + (isBoxed(r) ? BOX_PAD : 0)
const rowInnerW = (W: number, r: TreeRow): number => W - rowInnerX(r) - (isBoxed(r) ? BOX_PAD : 0)
// A finished agent folds to a slim row until the person opens it again.
const FOLD_H = 36
const OPEN_W = 64
const rowHeight = (r: TreeRow): number => (r.kind === 'role' ? ROLE_H : r.folded ? FOLD_H : AGENT_H)
// The desktop app refuses a drawing past 262,144 characters and leaves the pane
// blank; a running agent's card costs ~15K of them. Past this many, the rest share one row.
const MAX_CARDS = 4
// When the finished rows must fold into one, this many stay to be opened.
const KEEP_DONE = 3

// The slim row of a finished agent: its crab, the outcome, what it was, what it cost.
const foldedSvg = (W: number, a: AgentRun, at: number): string => {
  const H = FOLD_H - 8
  const ok = a.status !== 'failed'
  const isStopped = a.status === 'stopped'
  const meta = `${fmtTokens(a.tokens)} tokens · ${fmtTime(elapsed(a, at))}${a.budgetMin ? ` / ${a.budgetMin}m` : ''}`
  const metaW = textWidth(meta, 11) + 6
  return stillSvg(
    W,
    H,
    `${crab(4, 2, costumeFor(a), true, false, 0.82)}
<circle cx="40" cy="${H / 2}" r="7" fill="${isStopped ? '#9a9a96' : ok ? DONE : '#D0453F'}"/>
${isStopped ? `<rect x="37.5" y="${H / 2 - 2.5}" width="5" height="5" rx="1" fill="#fff"/>` : ok ? `<path d="M36.5 ${H / 2}l2.5 2.5 4.5-5" fill="none" stroke="${inkOn(DONE)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M37 ${H / 2 - 3}l6 6M43 ${H / 2 - 3}l-6 6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`}
<text class="s" x="54" y="${H / 2 + 4.5}" font-family="${FONT}" font-size="12.5" font-weight="600">${xml(fitText(a.description || a.type, 12.5, W - 54 - metaW - 8))}</text>
<text class="m" x="${W - 4}" y="${H / 2 + 4}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(meta)}</text>`,
  )
}

// Agents past what the pane can draw, in one slim row: how many, by role. The
// running ones pulse; finished ones get the done badge.
const moreByRole = (some: AgentRun[]): string =>
  [...some.reduce((m, a) => m.set(runRole(a), (m.get(runRole(a)) ?? 0) + 1), new Map<string, number>())].map(([role, n]) => `${role} ${n}`).join(' · ')
const moreAlt = (some: AgentRun[], isLive: boolean): string => `+${some.length} more agents ${isLive ? 'working' : 'finished'}: ${moreByRole(some)}`
const moreSvg = (W: number, some: AgentRun[], isLive: boolean): string => {
  const H = FOLD_H - 8
  const y = 4 + H / 2
  const head = `+${some.length} more ${isLive ? 'working' : 'finished'}`
  const headW = textWidth(head, 12.5) + 12
  return stillSvg(
    W,
    FOLD_H,
    `${isLive ? `<circle class="live" cx="${UNIT + 9}" cy="${y}" r="5" fill="${ACCENT}"/>` : `<circle cx="${UNIT + 9}" cy="${y}" r="7" fill="${DONE}"/><path d="M${UNIT + 5.5} ${y}l2.5 2.5 4.5-5" fill="none" stroke="${inkOn(DONE)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`}
<text class="t" x="${UNIT + 22}" y="${y + 4.5}" font-family="${FONT}" font-size="12.5" font-weight="600">${xml(head)}</text>
<text class="m" x="${UNIT + 22 + headW}" y="${y + 4}" font-family="${FONT}" font-size="11">${xml(fitText(moreByRole(some), 11, W - UNIT - 22 - headW - 4))}</text>`,
  )
}

// The connectors of one row, then its own drawing nested at its depth.
const treeRowSvg = (W: number, r: TreeRow, inner: string): string => {
  const H = rowHeight(r)
  const mid = r.kind === 'role' ? ROLE_H / 2 : r.folded ? FOLD_H / 2 : 31
  const segs: string[] = []
  for (let l = 0; l < r.depth - 1; l++) if (r.lines[l]) segs.push(`M${l * UNIT + 9} 0V${H}`)
  const x = (r.depth - 1) * UNIT + 9
  segs.push(`M${x} 0V${r.isLast ? mid : H}M${x} ${mid}H${x + 7}`)
  const nested = inner.replace('<svg ', `<svg x="${rowInnerX(r)}" y="${isBoxed(r) ? 4 : 0}" `)
  const color = r.kind === 'agent' && (isQuiet(r.a) || isOver(r.a)) ? '#E5675E' : r.color
  const x0 = r.depth * UNIT
  const cw = W - x0 - 1
  const isLive = r.kind === 'agent' && r.a.status === 'running'
  const isFolded = r.kind === 'agent' && Boolean(r.folded)
  // The card: a role's own agent on a gradient of the role's colour, its edge
  // pulsing and a sheen sweeping across while it works.
  const box = isBoxed(r)
    ? `<defs>
<linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset=".55" stop-color="${color}" stop-opacity=".07"/><stop offset="1" stop-color="${color}" stop-opacity=".03"/></linearGradient>
<linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="cc">${cardShape(x0 + 0.5, 2.5, cw, H - 5, ``, 12)}</clipPath>
</defs>
${isLive ? `<style>.edge{animation:edge 1.6s ease-in-out infinite}@keyframes edge{50%{stroke-opacity:.9}}.sweep{animation:sweep 2.4s linear infinite}@keyframes sweep{from{transform:translateX(-160px)}to{transform:translateX(${W}px)}}@media (prefers-reduced-motion: reduce){.edge,.sweep{animation:none}}</style>` : ''}
${cardShape(x0 + 0.5, 2.5, cw, H - 5, `fill="url(#bg)"${isFolded ? ' opacity=".5"' : ''}`, 12)}
${isLive ? `<g clip-path="url(#cc)"><rect class="sweep" x="0" y="0" width="140" height="${H}" fill="url(#sh)"/></g>` : ''}
${cardShape(x0 + 0.5, 2.5, cw, H - 5, `class="${isLive ? 'edge' : ''}" fill="none" stroke="${color}" stroke-opacity="${isLive ? 0.45 : 0.28}" stroke-width="${isLive ? 1.4 : 1}"`, 12)}
${isFolded ? '' : `<rect x="${x0 + 0.5}" y="14" width="3" height="${H - 28}" rx="1.5" fill="${color}"/>`}`
    : r.kind === 'role'
      ? `<defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="${color}" stop-opacity=".30"/><stop offset="1" stop-color="${color}" stop-opacity=".04"/></linearGradient></defs>
<rect x="${x0 - 2}" y="5" width="${W - x0 + 2}" height="${H - 10}" rx="${(H - 10) / 2}" fill="url(#rg)"/>`
      : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${segs.join('')}" fill="none" stroke="#8a8a86" stroke-opacity=".45" stroke-width="1.3" stroke-linecap="round"/>${box}${nested}</svg>`
}

const roleSvg = (W: number, r: Extract<TreeRow, { kind: 'role' }>): string => {
  const meta = `${r.count} ${r.count === 1 ? 'agent' : 'agents'}${r.running ? `  ·  ${r.running} working` : ''}`
  return stillSvg(
    W,
    ROLE_H,
    `<circle cx="10" cy="${ROLE_H / 2}" r="4" fill="${r.color}"/>
<text class="t" x="21" y="${ROLE_H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="600">${xml(r.role)}<tspan class="s" font-weight="400" font-size="11.5">   ${xml(meta)}</tspan></text>`,
  )
}

// Confetti over the manager card while the crew celebrates.
const CONFETTI = ['#F5C542', '#E58FB5', '#5EC8D8', '#9CCB6B', '#B58BE5', '#E5875E']
const confetti = (W: number, H: number): string =>
  `<style>.cf{animation:cf 1.6s linear infinite}@keyframes cf{from{transform:translateY(-20px) rotate(0)}to{transform:translateY(${H + 20}px) rotate(540deg)}}@media (prefers-reduced-motion: reduce){.cf{animation:none;opacity:0}}</style>` +
  Array.from({ length: 22 }, (_, i) => {
    const x = Math.round(((i * 97) % 100) / 100 * (W - 20)) + 10
    return `<rect class="cf" style="animation-delay:-${((i * 0.37) % 1.6).toFixed(2)}s;transform-box:fill-box" x="${x}" y="0" width="5" height="8" rx="1" fill="${CONFETTI[i % CONFETTI.length]}"/>`
  }).join('')

const MANAGER_BASE_H = 66 + 2 * (40 + 8) + 26 + 14

// The boss's frame: a gold-to-violet ring that turns around the card, a soft
// glow under it, faster while the manager works.
const bossFrame = (W: number, H: number, isWorking: boolean): string => {
  const cx = W / 2
  const cy = H / 2
  const dur = isWorking ? 3 : 7
  return `<defs>
<linearGradient id="boss" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">
${[0, 0.3, 0.55, 0.8, 1].map((o, i) => `<stop offset="${o}" stop-color="${SKIN.boss[i] ?? SKIN.colors.accent}"/>`).join('')}
<animateTransform attributeName="gradientTransform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>
</linearGradient>
<linearGradient id="bossbg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${SKIN.boss[0]}" stop-opacity=".16"/><stop offset=".5" stop-color="${SKIN.boss[2]}" stop-opacity=".06"/><stop offset="1" stop-color="${SKIN.boss[3]}" stop-opacity=".10"/></linearGradient>
<filter id="glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
</defs>
<style>.bossglow{animation:bg ${isWorking ? 1.6 : 3.2}s ease-in-out infinite}@keyframes bg{50%{opacity:.25}}@media (prefers-reduced-motion: reduce){.bossglow{animation:none}}</style>
${cardShape(4, 4, W - 8, H - 8, `class="bossglow" fill="none" stroke="url(#boss)" stroke-width="5" opacity=".55" filter="url(#glow)"`, 14)}
${cardShape(4, 4, W - 8, H - 8, `class="tile"`, 14)}
${cardShape(4, 4, W - 8, H - 8, `fill="url(#bossbg)"`, 14)}
${cardShape(4, 4, W - 8, H - 8, `fill="none" stroke="url(#boss)" stroke-width="1.8"`, 14)}`
}

// A pixel crown on the manager crab's head, in the crab's own 30×28 grid.
const crown = (x: number, y: number, scale: number): string => {
  if (SKIN.cast && CASTS[SKIN.cast]) return ''
  const px: string[] = []
  const f = (cx: number, cy: number, w: number, h: number, c: string) => px.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  f(9, 7, 12, 3, '#F5C542')
  f(9, 4, 2, 3, '#F5C542')
  f(14, 2, 2, 5, '#F5C542')
  f(19, 4, 2, 3, '#F5C542')
  f(9, 9, 12, 1, '#C99A1E')
  f(14, 7, 2, 2, '#E5675E')
  f(10, 8, 1, 1, '#5EC8D8')
  f(19, 8, 1, 1, '#5EC8D8')
  f(14, 1, 2, 1, '#FFF3C4')
  return `<g transform="translate(${x},${y}) scale(${scale})" shape-rendering="crispEdges"><g class="crownbob">${px.join('')}</g></g>`
}
const LIMITS_H = 30
const managerHeight = (_info: Env): number => MANAGER_BASE_H

// The usage card sits above the manager: the account's limits row by row, then
// the models this session has used and the tokens each has burned.
const LIMIT_ROW_H = 34
const MODEL_ROW_H = 22
const hasLimits = (info: Env): boolean => (info.limits ?? []).length > 0 || Object.keys(info.modelTokens ?? {}).length > 0

// `seven_day_fable` → "Weekly · Fable"; the plain windows read as the app names them.
const limitName = (kind: string): string => {
  if (kind === 'five_hour') return 'Session limit'
  if (kind === 'seven_day') return 'Weekly · all models'
  if (kind === 'spend_limit') return 'Spend limit'
  const m = /^seven_day_(.+)$/.exec(kind)
  const tail = (m ? m[1] : kind) ?? kind
  const word = tail.replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase())
  return m ? `Weekly · ${word}` : word
}
const limitRank = (kind: string): number => (kind === 'five_hour' ? 0 : kind === 'seven_day' ? 1 : kind.startsWith('seven_day') ? 2 : 3)

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Under a day away: "Resets in 4 hr 12 min"; further: "Resets Sat 7:00 PM".
const resetLabel = (iso: string | undefined, at: number): string => {
  const when = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(when) || when <= at) return ''
  const mins = Math.round((when - at) / 60000)
  if (mins < 1440) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `Resets in ${h ? `${h} hr ` : ''}${m} min`
  }
  const d = new Date(when)
  const hour = d.getHours() % 12 || 12
  return `Resets ${DAYS[d.getDay()]} ${hour}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

const sortedLimits = (info: Env) => [...(info.limits ?? [])].sort((x, y) => limitRank(x.kind) - limitRank(y.kind))
const sortedModels = (info: Env): [string, number][] =>
  Object.entries(info.modelTokens ?? {})
    .filter(([, n]) => n > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)

const sortedAll = (all: AllTime): [string, number][] =>
  Object.entries(all.models)
    .filter(([, n]) => n > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 6)

// The usage card read aloud; before any limit or token is known it says so, not "Usage: . ".
const usageAlt = (info: Env): string => {
  const limits = sortedLimits(info).map(l => `${limitName(l.kind)} ${Math.round(l.percentUsed)}%`)
  const models = sortedModels(info).map(([m, n]) => `${modelName(m)} ${fmtTokens(n)} tokens`)
  return limits.length || models.length ? `Usage: ${[limits.join(', '), models.join(', ')].filter(Boolean).join('. ')}` : 'Usage: no data yet'
}

const usageHeight = (info: Env, all: AllTime = { since: '', models: {} }): number => {
  const limits = sortedLimits(info).length
  const models = sortedModels(info).length
  const every = sortedAll(all).length
  // Before the first reply there is nothing to show yet: one line says so.
  return 34 + (limits ? limits * LIMIT_ROW_H : 22) + (models ? 30 + models * MODEL_ROW_H : 0) + (every ? 30 + every * MODEL_ROW_H : 0) + 8
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string): string => {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : ''
}

// A limit as a HUD gauge: segments that fill toward a glowing tip, ticks at the
// quarters, the share in the gauge's own colour.
const segmentBar = (x: number, y: number, w: number, pct: number, tone: string): string => {
  const gap = 2
  const n = Math.max(12, Math.floor(w / 9))
  const sw = (w - gap * (n - 1)) / n
  const lit = Math.round((n * Math.max(0, Math.min(100, pct))) / 100)
  const segs = Array.from({ length: n }, (_, i) => {
    const sx = (x + i * (sw + gap)).toFixed(1)
    if (i >= lit) return `<rect x="${sx}" y="${y}" width="${sw.toFixed(1)}" height="8" rx="1" class="k"/>`
    const isTip = i === lit - 1
    const alpha = (0.45 + 0.55 * ((i + 1) / Math.max(1, lit))).toFixed(2)
    return `<rect x="${sx}" y="${y}" width="${sw.toFixed(1)}" height="8" rx="1" fill="${tone}" fill-opacity="${isTip ? 1 : alpha}"${isTip ? ' class="live"' : ''}/>`
  }).join('')
  const ticks = [25, 50, 75].map(q => `<rect x="${(x + (w * q) / 100).toFixed(1)}" y="${y + 10}" width="1" height="3" fill="${tone}" fill-opacity=".35"/>`).join('')
  return segs + ticks
}

// The band's gauge while its share is a guess that climbs with the time: drawn at the
// minute's start, and each segment that lights within the minute switches on inside
// the image at its own second, so the gauge fills without a redraw.
const liveSegmentBar = (x: number, y: number, w: number, at: number, pctAt: (t: number) => number, tone: string): string => {
  const t0 = at - (at % 60_000)
  const gap = 2
  const n = Math.max(12, Math.floor(w / 9))
  const sw = (w - gap * (n - 1)) / n
  const litOf = (pct: number) => Math.round((n * Math.max(0, Math.min(100, pct))) / 100)
  let lit = litOf(pctAt(t0))
  const later: string[] = []
  for (let i = 1; i < LIVE_N; i++) {
    const t = t0 + i * 1000
    const next = litOf(pctAt(t))
    for (; lit < next; lit++) later.push(`<rect x="${(x + lit * (sw + gap)).toFixed(1)}" y="${y}" width="${sw.toFixed(1)}" height="7" rx="1" fill="${tone}" opacity="0"><set attributeName="opacity" to="1" begin="${pin(t)}s" fill="freeze"/></rect>`)
  }
  return `${segmentBar(x, y, w, pctAt(t0), tone).replace(/height="8"/g, 'height="7"')}${later.join('')}`
}

// A section's heading: a short rail in the accent, the title, a note at the right.
const usageHead = (x: number, y: number, w: number, title: string, note: string): string =>
  `<line class="ln" x1="${x}" y1="${y + 4.5}" x2="${x + w}" y2="${y + 4.5}"/>
<rect x="${x}" y="${y + 13}" width="3" height="12" rx="1" fill="${SKIN.colors.accent}"/>
<text class="s" x="${x + 9}" y="${y + 23}" font-family="${FONT}" font-size="11.5" font-weight="600">${xml(title)}</text>
<text class="m" x="${x + w}" y="${y + 23}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(note)}</text>`

// Model rows: the family's colour, a gradient that brightens to a glowing cap,
// the model's share of the list and its tokens.
const modelRows = (x: number, y: number, w: number, rows: [string, number][], id: string): { body: string; defs: string; height: number } => {
  const most = rows[0]?.[1] ?? 1
  const total = rows.reduce((a, r) => a + r[1], 0) || 1
  const nameW = Math.min(140, Math.round(w * 0.32))
  const barX = x + nameW + 8
  const barW = Math.max(40, w - nameW - 8 - 108)
  const defs: string[] = []
  const body = rows
    .map(([model, n], i) => {
      const name = modelName(model)
      const col = modelColor(name)
      const ry = y + i * MODEL_ROW_H
      const fill = Math.max(6, (barW * n) / most)
      const share = Math.round((n / total) * 100)
      defs.push(`<linearGradient id="${id}${i}" x1="0" x2="1"><stop offset="0" stop-color="${col}" stop-opacity=".18"/><stop offset="1" stop-color="${col}"/></linearGradient>`)
      return `<circle cx="${x + 3}" cy="${ry + 10}" r="3" fill="${col}"/>
<text class="t" x="${x + 11}" y="${ry + 14}" font-family="${FONT}" font-size="12" font-weight="600">${xml(fitText(name, 12, nameW - 11))}</text>
<rect class="k" x="${barX}" y="${ry + 7}" width="${barW}" height="6" rx="3"/>
<rect x="${barX}" y="${ry + 7}" width="${fill.toFixed(1)}" height="6" rx="3" fill="url(#${id}${i})"/>
<circle cx="${(barX + fill - 3).toFixed(1)}" cy="${ry + 10}" r="3.5" fill="${col}"/>
<text class="m" x="${x + w - 64}" y="${ry + 14}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${share}%</text>
<text class="t" x="${x + w}" y="${ry + 14}" text-anchor="end" font-family="${FONT}" font-size="12.5" font-weight="700" font-variant-numeric="tabular-nums">${fmtTokens(n)}</text>`
    })
    .join('\n')
  return { body, defs: defs.join(''), height: rows.length * MODEL_ROW_H }
}

const usageSvg = (W: number, info: Env, at: number, all: AllTime = { since: '', models: {} }): string => {
  const H = usageHeight(info, all)
  const x0 = 14
  const w = W - 28
  const out: string[] = []
  const defs: string[] = []
  let y = 34
  for (const l of sortedLimits(info)) {
    const pct = Math.max(0, Math.min(100, l.percentUsed))
    const tone = pct >= 90 ? SKIN.colors.alert : pct >= 70 ? SKIN.colors.warn : SKIN.colors.meter
    const reset = resetLabel(l.resetsAt, at)
    out.push(`<text class="t" x="${x0}" y="${y + 11}" font-family="${FONT}" font-size="12.5" font-weight="600">${xml(limitName(l.kind))}</text>
<text class="m" x="${x0 + w - 46}" y="${y + 11}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(reset)}</text>
<text x="${x0 + w}" y="${y + 12}" text-anchor="end" font-family="${FONT}" font-size="15" font-weight="800" fill="${tone}" font-variant-numeric="tabular-nums">${Math.round(l.percentUsed)}%</text>
${segmentBar(x0, y + 17, w, pct, tone)}`)
    y += LIMIT_ROW_H
  }
  const models = sortedModels(info)
  if (models.length) {
    out.push(usageHead(x0, y, w, 'Models used this session', `${fmtTokens(models.reduce((a, r) => a + r[1], 0))} tokens`))
    y += 30
    const rows = modelRows(x0, y, w, models, 'ms')
    out.push(rows.body)
    defs.push(rows.defs)
    y += rows.height
  }
  // Every session, the history counted in: the same rows, the totals since the first.
  const every = sortedAll(all)
  if (every.length) {
    const total = Object.values(all.models).reduce((x, y) => x + y, 0)
    const since = all.since ? shortDate(all.since) : ''
    out.push(usageHead(x0, y, w, `All sessions${since ? ` since ${since}` : ''}`, `${fmtTokens(total)} in all`))
    y += 30
    const rows = modelRows(x0, y, w, every, 'ma')
    out.push(rows.body)
    defs.push(rows.defs)
    y += rows.height
  }
  return svg(
    W,
    H,
    `<defs>${defs.join('')}</defs>
${cardShape(0.5, 0.5, W - 1, H - 1, `class="tile"`, 14)}
<rect x="${x0}" y="11" width="3" height="14" rx="1" fill="${SKIN.colors.accent}"/>
<text class="t gl" x="${x0 + 9}" y="23" font-family="${FONT}" font-size="14" font-weight="800" letter-spacing=".4">Usage</text>
${sortedLimits(info).length ? '' : `<text class="m" x="${x0}" y="48" font-family="${FONT}" font-size="12">Your limits show up after Claude's first reply.</text>`}
${out.join('\n')}`,
  )
}

const LIMIT_NAMES: Record<string, string> = { five_hour: 'Session', seven_day: 'Weekly', spend_limit: 'Spend' }
const LIMIT_ORDER = ['five_hour', 'seven_day', 'spend_limit']

// "resets in 4h 1m", "resets in 2d 5h"; nothing once the time has passed.
const resetsIn = (iso: string | undefined, at: number): string => {
  const when = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(when) || when <= at) return ''
  const mins = Math.round((when - at) / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return `resets in ${d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`}`
}

const limitsSvg = (x: number, y: number, w: number, info: Env, at: number): string => {
  const shown = [...(info.limits ?? [])].sort((a, b) => LIMIT_ORDER.indexOf(a.kind) - LIMIT_ORDER.indexOf(b.kind)).slice(0, 2)
  const gap = 14
  const colW = (w - gap * (shown.length - 1)) / Math.max(1, shown.length)
  return shown
    .map((l, i) => {
      const cx = x + i * (colW + gap)
      const pct = Math.max(0, Math.min(100, l.percentUsed))
      const color = gaugeColor(pct)
      const reset = resetsIn(l.resetsAt, at)
      return `<text class="t" x="${cx}" y="${y + 10}" font-family="${FONT}" font-size="11.5" font-weight="600">${xml(LIMIT_NAMES[l.kind] ?? l.kind)}<tspan fill="${color}" font-variant-numeric="tabular-nums">  ${Math.round(l.percentUsed)}%</tspan></text>
${reset ? `<text class="m" x="${cx + colW}" y="${y + 10}" text-anchor="end" font-family="${FONT}" font-size="10.5" font-variant-numeric="tabular-nums">${xml(fitText(reset, 10.5, colW / 2))}</text>` : ''}
<rect class="k" x="${cx}" y="${y + 16}" width="${colW}" height="5" rx="2.5"/>
<rect x="${cx}" y="${y + 16}" width="${Math.max(pct ? 3 : 0, (colW * pct) / 100).toFixed(1)}" height="5" rx="2.5" fill="${color}"/>`
    })
    .join('')
}

const managerStats = (info: Env, t: ReturnType<typeof totals>, crew: number, m: Manager, at: number): Stat[] => [
  { k: 'Model', v: info.model ? modelName(info.model) : '—', color: info.model ? modelColor(modelName(info.model)) : undefined },
  effortStat(info.effort ?? 'default'),
  { k: 'Context', v: info.contextWindow ? `${info.contextPct}%` : '—', viz: info.contextWindow ? { kind: 'ring', pct: info.contextPct } : undefined },
  { k: 'Sub-agents', v: String(crew) },
  { k: 'Agent cost', v: `≈${fmtCost(t.cost)}` },
  m.budgetMin && m.task && m.startedAt
    ? { k: 'Time · budget', v: `${fmtTime(Math.max(0, (m.doneAt ?? at) - m.startedAt))} / ${m.budgetMin}m`, color: budgetTone((m.doneAt ?? at) - m.startedAt, m.budgetMin) || undefined, ...(m.doneAt ? {} : { live: { at, read: tt => `${fmtTime(Math.max(0, tt - m.startedAt))} / ${m.budgetMin}m` } }) }
    : { k: 'Time', v: m.isWorking && m.startedAt ? fmtTime(Math.max(0, at - m.startedAt)) : '—', ...(m.isWorking && m.startedAt ? { live: { at, read: tt => fmtTime(Math.max(0, tt - m.startedAt)) } } : {}) },
]

const managerSvg = (
  W: number,
  m: Manager,
  info: Env,
  flowTitle: string,
  t: ReturnType<typeof totals>,
  crew: number,
  at: number,
  progress: number | null,
  waitingOn = 0,
  estimate?: (t: number) => number,
): string => {
  const textW = W - 68 - 18
  const isParty = (m.celebrateUntil ?? 0) > at
  const status = isParty ? 'Done!' : m.isWorking ? 'Working' : waitingOn ? tr().bgWait : 'Idle'
  // Held open by background work: the bar stops short of whole.
  if (waitingOn && progress !== null) progress = Math.min(0.95, progress)
  const pillW = Math.round(20 + textWidth(status, 11))
  const H = managerHeight(info)
  return svg(
    W,
    H,
    `${bossFrame(W, H, m.isWorking)}
${dancing(`${crab(14, 26, 'boss', false, m.isWorking, 1.45)}${crown(14, 26, 1.45)}`, isParty)}
${isParty ? confetti(W, H) : ''}
<text x="68" y="24" font-family="${FONT}" font-size="11.5" font-weight="700" fill="${SKIN.boss[0]}" class="gl">Manager<tspan class="s" font-weight="400">${m.isWorking && m.activity ? `  ▸ ${xml(fitText(m.activity, 11.5, textW - pillW - 80))}` : waitingOn ? `  ⧗\uFE0E ${xml(fitText(tr().bgWaiting(waitingOn), 11.5, textW - pillW - 80))}` : flowTitle ? `  ·  ${xml(fitText(flowTitle, 11.5, textW - pillW - 80))}` : ''}</tspan></text>
<rect x="${W - 18 - pillW}" y="13" width="${pillW}" height="18" rx="9" fill="${m.isWorking ? ACCENT : '#8a8a86'}" fill-opacity="${m.isWorking ? 1 : 0.25}"/>
<text${m.isWorking ? '' : ' class="t"'} x="${W - 18 - pillW / 2}" y="25.5" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600"${m.isWorking ? ` fill="${inkOn(ACCENT)}"` : ''}>${status}</text>
<text class="${m.task ? 't' : 'm'}" x="68" y="50" font-family="${FONT}" font-size="14" font-weight="600">${xml(fitText(m.task || 'Waiting for your next request', 14, textW))}</text>
${statGrid(68, 66, W - 68 - 18, managerStats(info, t, crew, m, at))}
${progressBar(68, 66 + statGridHeight(6), W - 68 - 18, progress, '#F5C542', m.isWorking, 'Overall progress', false, estimate && !waitingOn ? { at, read: estimate } : undefined)}`,
  )
}

// The manager's whole job: the plan's accepted share, else its sub-agents' share
// (each running one at its own estimate), else whole once its work is over. A
// background agent still running keeps the job short of whole after the turn ends.
const managerProgress = (f: Flow | null, list: AgentRun[], m: Manager, at = 0): number | null => {
  if (f && !f.isFinished && f.total) return ratio(f)
  const isBusy = m.isWorking || list.some(a => a.status === 'running')
  const fromPlan = planProgress(m.plan)
  if (fromPlan !== null) return isBusy ? fromPlan : 1
  const top = list.filter(a => !a.parentAgentId)
  if (top.some(a => a.status === 'running')) return top.reduce((sum, a) => sum + (a.status === 'running' ? Math.min(0.95, progressOf(a, at) ?? 0) : 1), 0) / top.length
  // No list to count: climb toward 90% over a couple of minutes, never stalling at 0.
  if (m.isWorking) return m.startedAt && at > m.startedAt ? Math.min(0.9, 1 - Math.exp(-(at - m.startedAt) / 90_000)) : 0
  return m.task ? 1 : 0
}
// The same reading as a function of the time, when it is a guess that climbs with it
// (the manager's own clock, or its crew's estimates); undefined when only news moves it.
const managerEstimate = (f: Flow | null, list: AgentRun[], m: Manager, at = 0): ((t: number) => number) | undefined => {
  const read = (t: number) => managerProgress(f, list, m, t) ?? 0
  return at && read(at) !== read(at + 60_000) ? read : undefined
}

// Terminal: the tree as text, `├─` and `└─` like a file listing.
const treePrefix = (r: TreeRow): string =>
  r.lines.slice(0, r.depth - 1).map(on => (on ? '│ ' : '  ')).join('') + (r.isLast ? '└─ ' : '├─ ')

// --- the workflow card: each step of the work in hand, with its own bar. The
// plan's tasks when a flow is reported, else the sub-agents at work, else the
// manager's own request.

type StepState = 'done' | 'running' | 'failed' | 'stopped' | 'waiting'
type WorkStep = { key: string; title: string; color: string; state: StepState; progress: number | null; note: string; est?: (t: number) => number }

const stepOfRun = (a: AgentRun, at?: number): Pick<WorkStep, 'state' | 'progress' | 'note' | 'est'> => ({
  state: a.status === 'running' ? 'running' : a.status === 'failed' ? 'failed' : a.status === 'stopped' ? 'stopped' : 'done',
  progress: progressOf(a, at),
  note: a.stepNote ?? '',
  ...(at && isEstimated(a) ? { est: (t: number) => estimateOf(a, t) } : {}),
})

const workSteps = (f: Flow | null, list: AgentRun[], boss: Manager, at?: number): WorkStep[] => {
  if (f && !f.isFinished && f.tasks.length) {
    return f.tasks.map((t, i) => {
      const run = [...list].reverse().find(a => norm(a.description) === norm(t.title))
      const tier = t.tier in TIER_COLOR ? t.tier : 'other'
      const base = { key: `task-${i}`, title: `${i + 1}. ${t.title}`, color: colorOf(tier) }
      return run ? { ...base, ...stepOfRun(run, at) } : { ...base, state: 'waiting' as const, progress: null, note: '' }
    })
  }
  if (boss.plan?.length) {
    return boss.plan.map((st, i) => ({
      key: `plan-${i}`,
      title: `${i + 1}. ${st.content}`,
      color: ACCENT,
      state: st.status === 'completed' ? ('done' as const) : st.status === 'in_progress' ? ('running' as const) : ('waiting' as const),
      progress: st.status === 'completed' ? 1 : null,
      note: '',
    }))
  }
  const top = crewOrder(list, false)
    .filter(a => !a.parentAgentId)
    .slice(0, 8)
  if (top.length) return top.map(a => ({ key: a.id, title: a.description || a.type, color: runRoleColor(a), ...stepOfRun(a, at) }))
  if (boss.task) {
    return [{ key: 'main', title: boss.task, color: ACCENT, state: boss.isWorking ? 'running' : 'done', progress: boss.isWorking ? null : 1, note: '' }]
  }
  return []
}

const STEP_H = 26
const WORK_HEAD = 46
// Long plans show a window of rows and a count: an Svg is at most 4096px tall.
const MAX_STEPS = 12
const shownSteps = (steps: WorkStep[]): WorkStep[] => {
  if (steps.length <= MAX_STEPS) return steps
  const firstOpen = Math.max(0, steps.findIndex(st => st.state !== 'done'))
  const start = Math.min(firstOpen, steps.length - MAX_STEPS)
  return steps.slice(start, start + MAX_STEPS)
}
const workflowHeight = (steps: WorkStep[]): number =>
  WORK_HEAD + Math.max(1, shownSteps(steps).length) * STEP_H + (steps.length > MAX_STEPS ? 18 : 0) + 10

const stepMark = (st: WorkStep, y: number): string => {
  if (st.state === 'done')
    return `<path d="M19 ${y + 13}l3.5 3.5 6.5-7" fill="none" stroke="${DONE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (st.state === 'failed') return `<path d="M20 ${y + 9}l8 8M28 ${y + 9}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  if (st.state === 'stopped') return `<rect x="20.5" y="${y + 9.5}" width="7" height="7" rx="1.5" fill="#8a8a86"/>`
  if (st.state === 'running') return `<circle class="live" cx="24" cy="${y + 13}" r="4" fill="${st.color}"/>`
  return `<circle cx="24" cy="${y + 13}" r="4.5" fill="none" stroke="#8a8a86" stroke-width="1.4"/>`
}

const workflowSvg = (W: number, f: Flow | null, steps: WorkStep[], at = 0): string => {
  const H = workflowHeight(steps)
  const isPlan = Boolean(f && !f.isFinished && f.tasks.length)
  const doneCount = steps.filter(st => st.state === 'done').length
  const overall = isPlan && f ? ratio(f) : steps.length ? doneCount / steps.length : 0
  const head = isPlan && f ? f.title : steps.length ? 'Current work' : 'Nothing running'
  const right = steps.length ? `${doneCount}/${steps.length} done` : ''
  const barW = W - 28
  const rowBarW = Math.min(140, Math.round(W * 0.28))
  const bx = W - 14 - rowBarW
  const visible = shownSteps(steps)
  const hidden = steps.length - visible.length
  const rows = visible.map((st, i) => {
    const y = WORK_HEAD + i * STEP_H
    const textW = W - 36 - rowBarW - 56
    const label = st.note ? `${st.title} — ${st.note}` : st.title
    const pct = st.progress === null ? null : Math.round(st.progress * 100)
    // A running step that reports no progress gets a sweeping segment instead of a number.
    let fill = ''
    const widthOf = (p: number) => Math.max(p ? 3 : 0, (rowBarW * p) / 100)
    // An estimate glides and counts inside the image; a reported share glides from the last one.
    const est = st.est && at ? st.est : undefined
    if (st.state !== 'waiting' && pct === null) {
      fill = `<rect x="${bx}" y="${y + 10}" width="${Math.round(rowBarW * 0.3)}" height="6" rx="3" fill="${st.color}"><animate attributeName="x" values="${bx};${bx + rowBarW * 0.7};${bx}" dur="1.8s" repeatCount="indefinite"/></rect>`
    } else if (pct !== null && est) {
      const live = liveWidth(at, t => widthOf(Math.round(est(t) * 100)))
      fill = `<rect x="${bx}" y="${y + 10}" width="${live.start}" height="6" rx="3" fill="${st.color}">${live.animate}</rect>`
    } else if (pct !== null) {
      fill = `<rect x="${bx}" y="${y + 10}" width="${widthOf(pct).toFixed(1)}" height="6" rx="3" fill="${st.state === 'done' ? DONE : st.color}">${glide(`wf-${st.key}`, widthOf(pct))}</rect>`
    }
    const side = pct === null ? (st.state === 'waiting' ? 'waiting' : '') : `${pct}%`
    const sideAttrs = `class="m" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums"`
    return `${stepMark(st, y)}
<text class="${st.state === 'waiting' ? 's' : 't'}" x="36" y="${y + 17}" font-family="${FONT}" font-size="12.5"${st.state === 'running' ? ' font-weight="600"' : ''}>${xml(fitText(label, 12.5, textW))}</text>
<rect class="k" x="${bx}" y="${y + 10}" width="${rowBarW}" height="6" rx="3"/>${fill}
${pct !== null && est ? liveText(bx - 8, y + 17, at, 11, sideAttrs, t => `${Math.round(est(t) * 100)}%`) : `<text x="${bx - 8}" y="${y + 17}" ${sideAttrs}>${side}</text>`}`
  })
  const empty = `<text class="m" x="14" y="${WORK_HEAD + 16}" font-family="${FONT}" font-size="12">Steps show up here when Claude starts working.</text>`
  return svg(
    W,
    H,
    `${cardShape(0.5, 0.5, W - 1, H - 1, `class="tile"`, 14)}
<text class="t" x="14" y="22" font-family="${FONT}" font-size="13" font-weight="600">Workflow<tspan class="s" font-weight="400" font-size="12">   ${xml(fitText(head, 12, W - 200))}</tspan></text>
<text class="m" x="${W - 14}" y="22" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${right}</text>
<rect class="k" x="14" y="30" width="${barW}" height="4" rx="2"/>
<rect x="14" y="30" width="${(barW * overall).toFixed(1)}" height="4" rx="2" fill="${overall >= 1 ? DONE : ACCENT}">${glide('wf-all', barW * overall)}</rect>
${steps.length ? rows.join('\n') : empty}
${hidden ? `<text class="m" x="36" y="${WORK_HEAD + visible.length * STEP_H + 12}" font-family="${FONT}" font-size="11">+${hidden} more steps</text>` : ''}`,
  )
}

const STEP_GLYPH: Record<StepState, string> = { done: '✓', running: '●', failed: '✗', stopped: '■', waiting: '○' }

// --- the hierarchy: the whole crew as a pyramid, the manager on top, its roles
// fanned out beneath, each role's agents under it and anything they started below.

type OrgNode = {
  isStuck?: boolean
  party?: boolean
  id: string
  label: string
  color: string
  costume?: string
  kind: 'manager' | 'role' | 'agent' | 'more' | 'tokens'
  status?: AgentStatus
  children: OrgNode[]
  x?: number
  depth?: number
}

const ORG_MAX_PER_ROLE = 6
const ORG_MAX_DEPTH = 5

// The crew of the request in hand, as the crew rows count it (background agents
// carried in from an earlier prompt too); before any request, the most recent dozen.
// A whole session's crews would not fit one drawing.
const currentCrew = (list: AgentRun[], boss: Manager): AgentRun[] => (boss.startedAt ? crewOf(list, boss) : list.slice(-12))

// The agents of the request in hand: started since its task began; before any
// request, every agent there is.
// Background agents and workflow runs outlive the prompt that started them: one
// still running belongs to the job in hand too, so a new prompt neither hides it
// nor calls the job done under it.
// An earlier job carried here keeps its agents in the crew after they finish, with
// their cost: the carried job ends only once they are all in.
const crewOf = (all: AgentRun[], boss: Manager): AgentRun[] => {
  if (!boss.startedAt) return all
  const carried = new Set(boss.carried?.ids ?? [])
  return all.filter(a => a.startedAt >= boss.startedAt - 1000 || a.status === 'running' || carried.has(a.id))
}
// The safety net never lets go on its own: a running agent holds the job open until
// it reports back or the person releases it (/missioncontrol release). After an hour
// of silence it checks in with the person instead, then once more each quiet hour.
const CHECKIN_MS = 60 * 60_000
const lastSeen = (a: AgentRun): number => a.lastProgressAt ?? a.startedAt
const isHolding = (a: AgentRun): boolean => a.status === 'running'
// When it was last heard from: a tool call still in flight (a long build, a
// permission prompt) is a sign of life now, and so is a busy sub-agent it waits on.
const heardAt = (a: AgentRun, list: readonly AgentRun[], at: number, depth = 0): number => {
  if (a.toolsInFlight) return at
  const kids = a.agentId && depth < 5 ? list.filter(k => k.parentAgentId === a.agentId && k.status === 'running') : []
  return Math.max(lastSeen(a), ...kids.map(k => heardAt(k, list, at, depth + 1)))
}
// How old a streaming agent's sign of life may get before it is stamped again.
const STAMP_STALE_MS = 30_000
const isDueCheckIn = (a: AgentRun, list: readonly AgentRun[], at: number): boolean => isHolding(a) && at - Math.max(heardAt(a, list, at), a.checkedInAt ?? 0) >= CHECKIN_MS
// Flagged quiet and still running: a finished agent is never drawn as stuck.
const isQuiet = (a: AgentRun): boolean => a.status === 'running' && Boolean(a.isStuck)

// A finished job shows through its celebration, then the panel starts clean:
// no old crew, plan or pyramid until the next request.
// Work Claude starts after that (a follow-up agent, a schedule's) is never hidden.
const isCleared = (boss: Manager, at: number): boolean => Boolean(boss.doneAt) && !boss.isWorking && at > (boss.doneAt ?? 0) + CELEBRATE_MS
const visibleCrew = (all: AgentRun[], boss: Manager, at: number): AgentRun[] =>
  isCleared(boss, at) ? all.filter(a => a.status === 'running' || a.startedAt > (boss.doneAt ?? 0)) : crewOf(all, boss)
const managerView = (boss: Manager, at: number): Manager => (isCleared(boss, at) ? { ...boss, task: '', plan: [], activity: '' } : boss)
// How a job that ended short reads in place of "Idle" until the next request.
const outcomeWord = (boss: Manager): string => (boss.outcome === 'error' ? 'Error' : boss.outcome === 'stopped' ? 'Stopped' : '')

const orgTree = (all: AgentRun[], boss: Manager, at = 0, mood: 0 | 1 | 2 = 0): OrgNode => {
  const list = currentCrew(all, boss)
  const ids = new Set(list.map(a => a.agentId).filter(Boolean))
  const ordered = crewOrder(list, false)
  const agentNode = (a: AgentRun, depth: number): OrgNode => ({
    id: a.id,
    // The role is drawn above it: "Designer: palette ideas" reads "palette ideas".
    label: (a.description || a.type).replace(NAMED_ROLE_PREFIX, ''),
    color: runRoleColor(a),
    costume: costumeFor(a),
    isStuck: isQuiet(a) || isOver(a),
    kind: 'agent',
    status: a.status,
    children: depth >= ORG_MAX_DEPTH ? [] : ordered.filter(k => a.agentId && k.parentAgentId === a.agentId).map(k => agentNode(k, depth + 1)),
  })
  const top = ordered.filter(a => !a.parentAgentId || !ids.has(a.parentAgentId))
  const roles = [...new Set(top.map(runRole))]
  return {
    id: 'manager',
    label: 'Manager',
    color: '#F5C542',
    kind: 'manager',
    status: boss.isWorking ? 'running' : 'done',
    party: (boss.celebrateUntil ?? 0) > at,
    children: [
      // The token manager always stands right under the boss.
      { id: 'org-tokens', label: 'Token Manager', color: MOOD_COLOR[mood], costume: 'banker', kind: 'tokens' as const, status: boss.isWorking ? ('running' as const) : ('done' as const), children: [] },
      ...roles.map(role => {
      const members = top.filter(a => runRole(a) === role)
      const shown = members.slice(0, ORG_MAX_PER_ROLE).map(a => agentNode(a, 3))
      const more = members.length - shown.length
      return {
        id: `org-role-${role}`,
        label: role,
        color: members[0] ? runRoleColor(members[0]) : ACCENT,
        costume: members[0] ? costumeFor(members[0]) : 'other',
        kind: 'role' as const,
        status: members.some(a => a.status === 'running') ? ('running' as const) : ('done' as const),
        children: more ? [...shown, { id: `org-more-${role}`, label: `+${more} more`, color: '#8a8a86', kind: 'more' as const, children: [] }] : shown,
      }
    }),
    ],
  }
}

const orgLeaves = (n: OrgNode): number => (n.children.length ? n.children.reduce((sum, c) => sum + orgLeaves(c), 0) : 1)
const orgDepth = (n: OrgNode): number => 1 + Math.max(0, ...n.children.map(orgDepth))

const ORG_LEVEL_H = 104
// The boss is drawn larger: the levels under it start this much lower.
const BOSS_EXTRA = 40
const ORG_TOP = 18
const BOSS_SCALE = 1.7
const CREW_SCALE = 1.15
// The engine refuses an Svg source over 131072 characters, and then draws
// nothing of the pane: past this, the pyramid falls back to its light drawing.
const SVG_MAX = 120_000
const orgSource = (W: number, root: OrgNode): string => {
  const full = orgSvg(W, root)
  return full.length <= SVG_MAX ? full : orgSvg(W, root, true)
}

const orgHeight = (root: OrgNode): number => ORG_TOP + (orgDepth(root) > 1 ? BOSS_EXTRA : 0) + (orgDepth(root) - 1) * ORG_LEVEL_H + 76 + 14

// Leaves get equal slots left to right; a parent sits centred over its children.
const orgLayout = (root: OrgNode, W: number): number => {
  const slot = W / Math.max(1, orgLeaves(root))
  let cursor = 0
  const place = (n: OrgNode, depth: number) => {
    n.depth = depth
    if (!n.children.length) {
      n.x = Math.round((cursor + 0.5) * slot * 10) / 10
      cursor += 1
      return
    }
    n.children.forEach(c => place(c, depth + 1))
    n.x = Math.round(((n.children[0]?.x ?? 0) + (n.children.at(-1)?.x ?? 0)) * 5) / 10
  }
  place(root, 0)
  return slot
}

// Sparks thrown off a working crab: three pixels that rise and fade, out of step.
// Drawn once in the hierarchy's defs (ORG_MARKS) and placed, in the crab's colour.
const sparks = (x: number, y: number, color: string): string => `<use href="#spk" x="${r2(x)}" y="${r2(y)}" color="${color}"/>`
// The marks every crab of the hierarchy shares: its sparks and its done or failed badge.
const orgMarks = (): string =>
  `<g id="spk">${[0, 1, 2].map(i => `<rect class="spark s${i}" x="${i * 6 - 6}" width="3" height="3" fill="${i === 1 ? '#F5C542' : 'currentColor'}"/>`).join('')}</g>
<g id="bok"><circle r="6" fill="${DONE}"/><path d="M-3 0l2 2 4-4.5" fill="none" stroke="${inkOn(DONE)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
<g id="bno"><circle r="6" fill="#D0453F"/><path d="M-2.5 -2.5l5 5M2.5 -2.5l-5 5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>`

const orgSvg = (W: number, root: OrgNode, isLight = false): string => {
  const isParty = Boolean(root.party)
  const slot = orgLayout(root, W)
  const H = orgHeight(root)
  const yOf = (n: OrgNode) => ORG_TOP + (n.depth ? BOSS_EXTRA : 0) + (n.depth ?? 0) * ORG_LEVEL_H
  // The crab's box per kind: the boss is drawn larger.
  const crabSize = (n: OrgNode) => {
    const sc = n.kind === 'manager' ? BOSS_SCALE : slot < 46 ? 0.8 : CREW_SCALE
    return { sc, w: r2(CRAB_BOX * sc), h: r2(28 * sc) }
  }
  const bottomOf = (n: OrgNode) => yOf(n) + crabSize(n).h + (n.kind === 'role' || n.kind === 'manager' || n.kind === 'tokens' ? 30 : 22)
  const edges: string[] = []
  const nodes: string[] = []
  let packet = 0
  const walk = (n: OrgNode) => {
    const x = n.x ?? 0
    const y0 = bottomOf(n)
    for (const c of n.children) {
      const cx = c.x ?? 0
      const cy = yOf(c) - 4
      const midY = (y0 + cy) / 2
      const path = `M${x.toFixed(1)} ${y0}C${x.toFixed(1)} ${midY.toFixed(1)} ${cx.toFixed(1)} ${midY.toFixed(1)} ${cx.toFixed(1)} ${cy}`
      const isLive = c.status === 'running'
      edges.push(`<path class="${isLive ? 'oe flow' : 'oe'}" d="${path}" stroke="${c.color}"/>`)
      // Work travels down the line: a glowing packet from boss to worker.
      if (isLive && !isLight) {
        const delay = ((packet++ % 4) * 0.3).toFixed(1)
        edges.push(`<circle r="3.2" fill="${c.color}" filter="url(#pglow)"><animateMotion dur="1.4s" begin="-${delay}s" repeatCount="indefinite" path="${path}"/></circle>`)
      }
      walk(c)
    }
    const { sc, w, h } = crabSize(n)
    const y = yOf(n)
    const left = r2(x - w / 2)
    const isWorking = n.status === 'running'

    if (n.kind === 'manager') {
      // The boss: a pulsing gold aura, a big crab, the crown.
      nodes.push(`<circle class="aura" cx="${x}" cy="${y + h / 2 + 2}" r="${w * 0.78}" fill="url(#aura)"/>
<circle cx="${x}" cy="${y + h / 2 + 2}" r="${w * 0.62}" fill="none" stroke="url(#ring)" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y + h / 2 + 2}" to="360 ${x} ${y + h / 2 + 2}" dur="${isWorking ? 3 : 8}s" repeatCount="indefinite"/></circle>
${(() => {
  const figure = `${crab(left, y, 'boss', false, isWorking, sc)}${crown(left, y, sc)}`
  const egg = eggOf()
  if (!egg || !isWorking) return dancing(figure, isParty)
  // David's Sandevistan: the boss leaves afterimages while the job runs.
  const sv = sandevistan(figure, egg)
  return `<defs>${sv.defs}</defs>${sv.svg}${dancing(figure, isParty)}`
})()}
<text x="${x}" y="${y + h + 20}" text-anchor="middle" font-size="13" font-weight="800" fill="${SKIN.boss[0]}" letter-spacing=".3" class="gl">Manager</text>`)
      return
    }
    if (n.kind === 'more') {
      nodes.push(`<text class="m" x="${x}" y="${y + 20}" text-anchor="middle" font-size="11" font-weight="600">${xml(n.label)}</text>`)
      return
    }
    // A role stands on a lit plinth in its colour, its name on a banner. Drawn
    // light, a dot stands in for the figure; the banner stays.
    if (n.kind === 'role' || n.kind === 'tokens') {
      const label = fitText(n.label, 12, Math.max(30, slot * Math.max(1, n.children.length) - 30))
      const bw = Math.round(textWidth(label, 12) + 22)
      // The banner is centred on its role but never past the drawing's edges.
      const bx = Math.max(bw / 2 + 2, Math.min(W - bw / 2 - 2, x))
      const figure = isLight
        ? `<circle cx="${x}" cy="${y + h / 2}" r="10" fill="${n.color}" fill-opacity="${isWorking ? 1 : 0.45}"${isWorking ? ' class="live"' : ''}/>`
        : `<ellipse cx="${x}" cy="${y + h + 1}" rx="${r2(w * 0.7)}" ry="4" fill="${n.color}" fill-opacity="${isWorking ? 0.55 : 0.25}"${isWorking ? ' class="live"' : ''}/>
${dancing(crab(left, y, `role:${n.costume ?? 'other'}`, !isWorking && n.status !== 'done', isWorking, sc), isParty)}`
      nodes.push(`${figure}
<rect x="${(bx - bw / 2).toFixed(1)}" y="${y + h + 7}" width="${bw}" height="20" rx="10" fill="${n.color}"/>
<text x="${bx}" y="${y + h + 21}" text-anchor="middle" font-size="12" font-weight="800" fill="${inkOn(n.color)}">${xml(label)}</text>`)
      return
    }
    // A worker drawn light: its dot and its task.
    if (isLight) {
      nodes.push(`<circle cx="${x}" cy="${y + h / 2}" r="7" fill="${n.color}" fill-opacity="${isWorking ? 1 : 0.45}"${isWorking ? ' class="live"' : ''}/>
${slot >= 46 ? `<text${isWorking ? ' class="t"' : ' class="s"'} x="${x}" y="${y + h + 15}" text-anchor="middle" font-size="11" font-weight="${isWorking ? 700 : 500}">${xml(fitText(n.label, 11, Math.max(30, slot - 8)))}</text>` : ''}`)
      return
    }
    // A worker (or the token manager): its crab, sparks while it works, a badge once
    // it is done, its task under it.
    const label = fitText(n.label, 11, Math.max(30, slot - 8))
    const badge = n.status === 'done' || n.status === 'failed' ? `<use href="#${n.status === 'done' ? 'bok' : 'bno'}" x="${r2(left + w - 2)}" y="${y + 4}"/>` : ''
    nodes.push(`<ellipse cx="${x}" cy="${y + h + 1}" rx="${r2(w * 0.45)}" ry="2.5" fill="#000" fill-opacity=".25"/>
${dancing(crab(left, y, n.costume ?? 'other', n.status === 'done' && n.kind !== 'tokens', isWorking, sc), isParty)}${n.isStuck ? `<circle class="live" cx="${x}" cy="${y + h / 2}" r="${(w * 0.62).toFixed(1)}" fill="none" stroke="#E5675E" stroke-width="2"/><path d="M${left + 4} ${y + 6}q-2 4 0 5q2 -1 0 -5z" fill="#5EC8D8"/>` : ''}
${isWorking ? sparks(x + w * 0.25, y + 2, n.color) : ''}${badge}
${slot >= 46 ? `<text${isWorking ? ' class="t"' : ' class="s"'} x="${x}" y="${y + h + 15}" text-anchor="middle" font-size="11" font-weight="${isWorking ? 700 : 500}">${xml(label)}</text>` : ''}`)
  }
  castGrow = CAST_GROW
  const figures = new Map<string, string>()
  figureDefs = figures
  try {
    walk(root)
  } finally {
    castGrow = 1
    figureDefs = null
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${PANE_CSS}${CRAB_CSS}${eggOf() ? `<style>${EGG_CSS}</style>` : ''}
<defs>${figureDefsMarkup(figures)}${isLight ? '' : orgMarks()}
<radialGradient id="aura"><stop offset="0" stop-color="${SKIN.boss[0]}" stop-opacity=".45"/><stop offset=".6" stop-color="${SKIN.boss[0]}" stop-opacity=".12"/><stop offset="1" stop-color="${SKIN.boss[0]}" stop-opacity="0"/></radialGradient>
<linearGradient id="ring" x1="0" x2="1"><stop offset="0" stop-color="${SKIN.boss[0]}"/><stop offset=".5" stop-color="${SKIN.boss[2]}" stop-opacity=".2"/><stop offset="1" stop-color="${SKIN.boss[3]}"/></linearGradient>
<filter id="pglow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<style>.oe{fill:none;stroke-opacity:.28;stroke-width:1.3}.oe.flow{stroke-opacity:.7;stroke-width:2;stroke-dasharray:6 5}
.flow{animation:flow .9s linear infinite}@keyframes flow{to{stroke-dashoffset:-22}}
.aura{animation:aura 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes aura{50%{opacity:.55;transform:scale(1.08)}}
.spark{animation:spark 1.1s ease-out infinite;opacity:0}.s1{animation-delay:-.37s}.s2{animation-delay:-.74s}
@keyframes spark{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-12px)}}
@media (prefers-reduced-motion: reduce){.flow,.aura,.spark{animation:none}.spark{opacity:0}}</style>
${edges.join('\n')}
${nodes.join('\n')}${SKIN.effects.scanlines && !isLight ? scanlines(W, H) : ''}</svg>`
}

// --- the token manager: watches the spend and says how to spend less. Pure
// arithmetic in this module: it costs no tokens of its own.

type Tip = { level: 0 | 1 | 2; text: string }
type TokenReport = { mood: 0 | 1 | 2; tips: Tip[]; burnPerMin: number; taskTokens: number; taskCost: number; cachedPct: number | null; budget: number }

const BURN_WINDOW = 600_000
const sumTokens = (info: Env): number => Object.values(info.modelTokens ?? {}).reduce((a, b) => a + b, 0)

const tokenReport = (info: Env, list: AgentRun[], boss: Manager, w: Watch, at: number): TokenReport => {
  const tips: Tip[] = []
  const burnPerMin = w.burn.filter(b => b.at > at - 60_000).reduce((sum, b) => sum + b.n, 0)
  const taskTokens = Math.max(0, sumTokens(info) - (boss.tokensAtStart ?? 0))
  const taskCost = Math.max(0, info.costUsd - (boss.costAtStart ?? info.costUsd))
  const cachedPct = w.promptAll > 50_000 ? Math.round((w.cacheRead / w.promptAll) * 100) : null

  if (w.budgetUsd > 0) {
    const pct = (taskCost / w.budgetUsd) * 100
    if (pct >= 100) tips.push({ level: 2, text: `Over budget: ≈${fmtCost(taskCost)} of ${fmtCost(w.budgetUsd)} on this task` })
    else if (pct >= 80) tips.push({ level: 1, text: `${Math.round(pct)}% of the ${fmtCost(w.budgetUsd)} budget used on this task` })
  }
  if (info.contextPct >= 85) tips.push({ level: 2, text: `Context ${info.contextPct}%: /compact now, every request re-reads it` })
  else if (info.contextPct >= 70) tips.push({ level: 1, text: `Context ${info.contextPct}%: /compact soon to cut each request's cost` })
  for (const l of info.limits ?? []) {
    const name = limitName(l.kind)
    if (l.percentUsed >= 90) tips.push({ level: 2, text: `${name} at ${Math.round(l.percentUsed)}%` })
    else if (l.percentUsed >= 75) tips.push({ level: 1, text: `${name} at ${Math.round(l.percentUsed)}%: lighter models stretch it` })
  }
  const running = list.filter(a => a.status === 'running')
  const pricey = running.find(a => (a.type === 'Explore' || /researcher|explorer|tester/i.test(namedRole(a) ?? '')) && /opus|fable/i.test(a.model))
  if (pricey) {
    tips.push({
      level: 1,
      text: `"${clip(pricey.description || pricey.type, 26)}" reads on ${modelName(pricey.model)}: Haiku does read-only work ~5× cheaper${w.autopilot ? '' : ' (/tokens autopilot on)'}`,
    })
  }
  const heavy = [...list].sort((x, y) => y.tokens - x.tokens)[0]
  if (heavy && heavy.tokens > 400_000) tips.push({ level: 1, text: `"${clip(heavy.description || heavy.type, 28)}" burned ${fmtTokens(heavy.tokens)} tokens` })
  if (burnPerMin > 150_000) tips.push({ level: 1, text: `Burning ${fmtTokens(burnPerMin)} tokens a minute` })
  if (cachedPct !== null && cachedPct < 50) tips.push({ level: 1, text: `Only ${cachedPct}% cached: long pauses and early edits break the cache` })
  if (running.length > 6) tips.push({ level: 0, text: `${running.length} agents at once: each re-reads its own context` })
  if (w.autopilot) tips.push({ level: 0, text: 'Autopilot on: explorers run on Haiku' })
  const mood = tips.reduce<0 | 1 | 2>((m, tp) => (tp.level > m ? tp.level : m), 0)
  if (!tips.some(tp => tp.level > 0)) tips.unshift({ level: 0, text: 'Lean and on budget ✓' })
  return { mood, tips: tips.sort((a, b) => b.level - a.level).slice(0, 3), burnPerMin, taskTokens, taskCost, cachedPct, budget: w.budgetUsd }
}

let MOOD_COLOR: readonly [string, string, string] = ['#5fbf8f', '#E9B44C', '#E5675E']
const MOOD_WORD = ['Healthy', 'Watch it', 'Act now'] as const
// The band's HEAT stars and its burn readout both read the burn rate: none while
// nothing burns, five past 150k tokens a minute, the token manager's own line.
const burnStars = (perMin: number): number => (perMin <= 0 ? 0 : perMin < 20_000 ? 1 : perMin < 50_000 ? 2 : perMin < 100_000 ? 3 : perMin <= 150_000 ? 4 : 5)
const burnMood = (perMin: number): 0 | 1 | 2 => (perMin > 300_000 ? 2 : perMin > 150_000 ? 1 : 0)

// What the replay card shows, for a reader: the beat picked, or the live tail.
const braindanceAlt = (beats: Beat[], pick: number): string => {
  const b = pick >= 0 ? beats[pick] : undefined
  if (!b) return `Replay: live, ${beats.length} tool calls`
  const sec = Math.max(0, Math.round((b.at - (beats[0]?.at ?? b.at)) / 1000))
  const time = [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map(n => String(n).padStart(2, '0')).join(':')
  return `Replay: beat ${pick + 1} of ${beats.length}, ${time}, ${b.who}, ${b.tool}${b.text ? `: ${b.text}` : ''}`
}

// A Mermaid chart, for a reader: its kind and its title or first nodes.
const mermaidAlt = (src: string): string => {
  const lines = src.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const first = lines[0] ?? ''
  if (/^pie\b/i.test(first)) {
    const title = /^pie\s+(?:showData\s+)?title\s+(.+)$/i.exec(first)?.[1] ?? lines.find(l => /^title\s/i.test(l))?.replace(/^title\s+/i, '')
    const slices = lines.filter(l => /^"[^"]+"\s*:/.test(l)).map(l => l.replace(/^"([^"]+)"\s*:\s*/, '$1 '))
    return clip(`Pie chart${title ? `: ${title}` : ''}${slices.length ? `. ${slices.join(', ')}` : ''}`, 300)
  }
  const names = [...new Set([...src.matchAll(/[[({]+"?([^\])}"]+)"?[\])}]+/g)].map(m => (m[1] ?? '').trim()).filter(Boolean))]
  return clip(`Flowchart${names.length ? ` of ${names.length} steps: ${names.join(', ')}` : ''}`, 300)
}
const TIP_H = 21
// The tips' room only grows: a tip that comes and goes would move every card under it.
let tipRowsSeen = 1
const tipRows = (r: TokenReport): number => (tipRowsSeen = Math.max(tipRowsSeen, Math.min(3, r.tips.length)))
const tokenHeight = (r: TokenReport): number => 46 + statGridHeight(3) + tipRows(r) * TIP_H + 10

const tokenSvg = (W: number, r: TokenReport, isWatching: boolean): string => {
  const H = tokenHeight(r)
  const color = MOOD_COLOR[r.mood]
  const word = MOOD_WORD[r.mood]
  const pillW = Math.round(22 + textWidth(word, 11))
  const stats: Stat[] = [
    { k: 'Burn rate', v: `${fmtTokens(r.burnPerMin)}/min`, color: r.burnPerMin > 150_000 ? '#E9B44C' : undefined },
    { k: r.budget ? `This task · of ${fmtCost(r.budget)}` : 'This task', v: `${fmtTokens(r.taskTokens)} · ≈${fmtCost(r.taskCost)}`, color: r.budget && r.taskCost >= r.budget ? '#E5675E' : undefined },
    { k: 'Cached', v: r.cachedPct === null ? '—' : `${r.cachedPct}%`, viz: r.cachedPct === null ? undefined : { kind: 'ring', pct: 100 - r.cachedPct } },
  ]
  const tips = r.tips
    .map((tp, i) => {
      const y = 46 + statGridHeight(3) + i * TIP_H
      return `<circle cx="20" cy="${y + 7}" r="3.5" fill="${MOOD_COLOR[tp.level]}"${tp.level === 2 ? ' class="live"' : ''}/>
<text class="${tp.level ? 't' : 's'}" x="30" y="${y + 11}" font-family="${FONT}" font-size="12"${tp.level ? ' font-weight="600"' : ''}>${xml(fitText(tp.text, 12, W - 44))}</text>`
    })
    .join('\n')
  return svg(
    W,
    H,
    `${cardShape(0.5, 0.5, W - 1, H - 1, `class="tile"`, 14)}
${cardShape(0.5, 0.5, W - 1, H - 1, `fill="none" stroke="${color}" stroke-opacity=".55"`, 14)}
<rect x="0.5" y="14" width="3" height="${H - 28}" rx="1.5" fill="${color}"/>
${crab(10, 4, 'role:banker', false, isWatching, 1.05)}
<text x="50" y="22" font-family="${FONT}" font-size="13" font-weight="800" fill="${color}" class="gl">Token Manager<tspan class="s" font-weight="400" font-size="11.5">${(() => {
  const room = W - 14 - pillW - 8 - 50 - textWidth('Token Manager', 13) - 12
  return room >= 60 ? `   ${xml(fitText('watching every token, at no cost', 11.5, room))}` : ''
})()}</tspan></text>
<rect x="${W - 14 - pillW}" y="10" width="${pillW}" height="18" rx="9" fill="${color}"/>
<text x="${W - 14 - pillW / 2}" y="22.5" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="${inkOn(color)}">${word}</text>
${statGrid(50, 38, W - 50 - 14, stats)}
${tips}`,
  )
}

// --- the daily scoreboard: what the crew did for you today --------------------

const TODAY_H = 30 + 48
const todaySvg = (W: number, d: Today): string =>
  svg(
    W,
    TODAY_H,
    `${cardShape(0.5, 0.5, W - 1, TODAY_H - 1, `class="tile"`, 14)}
<text class="t" x="14" y="22" font-family="${FONT}" font-size="13" font-weight="600">Today</text>
<text class="m" x="${W - 14}" y="22" text-anchor="end" font-family="${FONT}" font-size="11">≈${fmtCost(d.costUsd)} spent</text>
${statGrid(14, 30, W - 28, [
  { k: 'Tasks', v: String(d.tasks) },
  { k: 'Agents run', v: String(d.agents) },
  { k: 'Tokens', v: fmtTokens(d.tokens) },
])}`,
  )

// --- background work: shells, subagents, monitors and workflows left running, and
// the wake-ups scheduled for later, as the engine last listed them.

// The engine caps each text at 1,000 characters; a row never shows that much.
const BG_KEPT = 50
const BG_TEXT = 300
const bgText = (v: unknown, max = BG_TEXT): string => (typeof v === 'string' ? clip(v.replace(/\s+/g, ' ').trim(), max) : '')

// The engine's list, cleaned: only strings kept, and a field left out when empty
// (state carries no `undefined`). `skip` is a subagent that is stopping right now.
const cleanBgTasks = (v: unknown, skip?: string): BgTask[] =>
  (Array.isArray(v) ? v : [])
    .flatMap((raw): BgTask[] => {
      if (!raw || typeof raw !== 'object') return []
      const o = raw as Record<string, unknown>
      const id = bgText(o.id, 120)
      const type = bgText(o.type, 40) || 'task'
      if (!id || (type === 'subagent' && id === skip)) return []
      const extra = { command: bgText(o.command), agentType: bgText(o.agent_type, 80), server: bgText(o.server, 80), tool: bgText(o.tool, 80), name: bgText(o.name, 120) }
      return [{ id, type, status: bgText(o.status, 40), description: bgText(o.description), ...Object.fromEntries(Object.entries(extra).filter(([, x]) => x)) }]
    })
    .slice(0, BG_KEPT)

const cleanBgCrons = (v: unknown): BgCron[] =>
  (Array.isArray(v) ? v : [])
    .flatMap((raw): BgCron[] => {
      if (!raw || typeof raw !== 'object') return []
      const o = raw as Record<string, unknown>
      const id = bgText(o.id, 120)
      return id ? [{ id, schedule: bgText(o.schedule, 80), recurring: o.recurring === true, prompt: bgText(o.prompt) }] : []
    })
    .slice(0, BG_KEPT)

// What a Stop or SubagentStop hook says is in the background. A list the engine
// left out keeps its last value; an unchanged empty list is not written again.
// A task listed before keeps what Mission Control knows of it: since when its status
// stood, the last check-in, a release. A new status counts as a sign of progress.
async function noteBackground($: EngineInterface, e: { background_tasks?: unknown; session_crons?: unknown }, stopping?: string): Promise<void> {
  if (e.background_tasks === undefined && e.session_crons === undefined) return
  const prev = await read($, background)
  const at = await $.clock.now()
  const known = new Map(prev.tasks.map(t => [t.id, t]))
  const tasks =
    e.background_tasks === undefined
      ? prev.tasks
      : cleanBgTasks(e.background_tasks, stopping).map((t): BgTask => {
          const was = known.get(t.id)
          if (!was || was.status !== t.status) return { ...t, seenAt: at, ...(was?.released ? { released: true } : {}) }
          return { ...t, seenAt: was.seenAt ?? at, ...(was.checkedInAt ? { checkedInAt: was.checkedInAt } : {}), ...(was.released ? { released: true } : {}) }
        })
  const crons = e.session_crons === undefined ? prev.crons : cleanBgCrons(e.session_crons)
  if (!tasks.length && !crons.length && !prev.tasks.length && !prev.crons.length) return
  await update($, background, () => ({ tasks, crons, at }))
}

// A finished task's notification names it by id: drop it now, not at the next stop.
// Whole ids only, so a short one never matches inside another word.
async function dropNotified($: EngineInterface, text: string): Promise<void> {
  const isNamed = (id: string) => id.length >= 4 && new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text)
  const prev = await read($, background)
  if (!prev.tasks.some(t => isNamed(t.id))) return
  await update($, background, b => ({ ...b, tasks: b.tasks.filter(t => !isNamed(t.id)) }))
}

type BgRow = { key: string; kind: string; label: string; text: string; detail: string; status: string; isLive: boolean; isCode: boolean }
const BG_KINDS = new Set(['shell', 'subagent', 'monitor', 'workflow', 'scheduled'])
const BG_GLYPH: Record<string, string> = { shell: '❯', subagent: '◈', monitor: '◉', workflow: '⇶', scheduled: '◷', other: '•' }
const bgWord = (map: Record<string, string>, k: string): string => map[k] ?? k

// One row per task, then one per wake-up: what it is, what it does, how it stands.
const bgRows = (b: Background): BgRow[] => {
  const s = tr()
  const tasks = b.tasks.map((t): BgRow => {
    const kind = BG_KINDS.has(t.type) ? t.type : 'other'
    const detail =
      kind === 'shell' ? (t.command ?? '') : kind === 'workflow' ? (t.name ?? '') : kind === 'subagent' ? (t.agentType ?? '') : [t.server, t.tool].filter(Boolean).join(' · ')
    return {
      key: `t-${t.id}`,
      kind,
      label: kind === 'other' ? t.type : bgWord(s.bgKind, kind),
      // A task with no description is named by its detail instead, never twice.
      text: t.description || detail || t.type,
      detail: t.description ? detail : '',
      // A task the person released no longer holds the job; its row says so.
      status: t.released ? s.bgStatus.released : bgWord(s.bgStatus, t.status),
      isLive: t.status === 'running' && !t.released,
      isCode: kind === 'shell' && Boolean(t.description),
    }
  })
  const crons = b.crons.map((c): BgRow => ({
    key: `c-${c.id}`,
    kind: 'scheduled',
    label: s.bgKind.scheduled,
    text: c.prompt || c.schedule,
    detail: c.prompt ? c.schedule : '',
    status: c.recurring ? s.bgStatus.repeats : s.bgStatus.once,
    isLive: false,
    isCode: true,
  }))
  return [...tasks, ...crons]
}

const bgAgo = (at: number, clockNow: number): string => tr().bgAgo(Math.max(0, Math.floor((clockNow - at) / 60_000)))

// A row each for the first few; the rest is one "+N more" line, so a long list keeps the card short.
const BG_MAX = 6
const BG_HEAD = 34
const BG_ROW_H = 38
const BG_MORE_H = 18
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const bgHeight = (n: number): number => BG_HEAD + Math.min(n, BG_MAX) * BG_ROW_H + (n > BG_MAX ? BG_MORE_H : 0) + 6

const bgAlt = (rows: BgRow[], ago: string): string => {
  const s = tr()
  const shown = rows.slice(0, BG_MAX).map(r => `${r.label} ${clip(r.text, 40)} (${r.status})`)
  const more = rows.length > BG_MAX ? `, +${rows.length - BG_MAX} ${s.bgMore}` : ''
  return clip(`${s.bgTitle}: ${rows.length}. ${shown.join(', ')}${more}. ${ago}`, 600)
}

const bgSvg = (W: number, rows: BgRow[], ago: string): string => {
  const s = tr()
  const H = bgHeight(rows.length)
  const shown = rows.slice(0, BG_MAX)
  const more = rows.length - shown.length
  const statusW = Math.min(110, Math.round(W * 0.22))
  const textW = W - 36 - statusW - 22
  const live = rows.filter(r => r.isLive).length
  const body = shown.map((r, i) => {
    const y = BG_HEAD + i * BG_ROW_H
    const tone = r.isLive ? ACCENT : SKIN.colors.muted
    const kind = r.label.toUpperCase()
    const kindW = textWidth(kind, 10) * 1.06 + 10
    return `<text ${startText(W, 14, y + 15, false)} font-family="${FONT}" font-size="13" font-weight="700" fill="${tone}">${BG_GLYPH[r.kind] ?? BG_GLYPH.other}</text>
<text class="m" ${startText(W, 36, y + 15)} font-family="${FONT}" font-size="10" font-weight="700" letter-spacing=".4">${xml(fitText(kind, 10, 110))}</text>
<text class="t" ${startText(W, 36 + Math.min(120, kindW), y + 15)} font-family="${FONT}" font-size="12.5" font-weight="600">${xml(fitText(r.text, 12.5, Math.max(40, textW - Math.min(120, kindW))))}</text>
${r.detail ? `<text class="s" ${startText(W, 36, y + 31, !r.isCode)} font-family="${r.isCode ? MONO : FONT}" font-size="11">${xml(fitText(r.detail, r.isCode ? 12 : 11, textW))}</text>` : ''}
${r.isLive ? `<circle class="live" cx="${mx(W, W - 18)}" cy="${y + 11}" r="3.5" fill="${ACCENT}"/>` : ''}
<text class="m" ${endText(W, W - 14 - (r.isLive ? 12 : 0), y + 15, true)} font-family="${FONT}" font-size="11">${xml(fitText(r.status, 11, statusW))}</text>
${i < shown.length - 1 ? `<line class="ln" x1="14" y1="${y + BG_ROW_H - 2.5}" x2="${W - 14}" y2="${y + BG_ROW_H - 2.5}" stroke-opacity=".5"/>` : ''}`
  })
  const head = `${s.bgTitle} · ${rows.length}${live ? ` · ${live} ${bgWord(s.bgStatus, 'running')}` : ''}`
  return svg(
    W,
    H,
    `${cardShape(0.5, 0.5, W - 1, H - 1, `class="tile"`, 14)}
<rect x="0.5" y="12" width="3" height="${H - 24}" rx="1.5" fill="${live ? ACCENT : SKIN.colors.line}"/>
<text class="t" ${startText(W, 14, 22)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(head, 13, W - 28 - Math.min(200, textWidth(ago, 11) + 12)))}</text>
<text class="m" ${endText(W, W - 14, 22, true)} font-family="${FONT}" font-size="11">${xml(fitText(ago, 11, 200))}</text>
${body.join('\n')}
${more ? `<text class="m" ${startText(W, 36, BG_HEAD + shown.length * BG_ROW_H + 10)} font-family="${FONT}" font-size="11">+${more} ${s.bgMore}</text>` : ''}`,
  )
}

// Background work keeps the job open: a listed task that has not finished blocks
// "done" (a scheduled wake-up does not; it is no work in hand). Never let go on its
// own: it holds until a stop no longer lists it or the person releases it.
const BG_FINISHED = new Set(['completed', 'failed', 'killed', 'stopped', 'done', 'cancelled'])
const bgBlocking = (b: Background): BgTask[] => b.tasks.filter(t => !t.released && !BG_FINISHED.has(t.status))
// Quiet: no new status since it was listed, or since the last check-in. Each quiet
// hour (CHECKIN_MS, as for agents) asks the person once.
const bgQuietSince = (b: Background, t: BgTask): number => Math.max(t.seenAt ?? b.at, t.checkedInAt ?? 0)
const bgDueCheckIn = (b: Background, at: number): BgTask[] => bgBlocking(b).filter(t => at - bgQuietSince(b, t) >= CHECKIN_MS)
const bgName = (t: BgTask): string => clip(t.description || t.command || t.name || t.type, 40)

// What a tool call is doing, in a few words: the live activity line.
const baseName = (p: unknown): string => String(p ?? '').split(/[\\/]/).filter(Boolean).at(-1) ?? ''
const activityOf = (e: Record<string, unknown>): string => {
  const tool = String(e.tool ?? '')
  if (tool === 'Read') return `reading ${baseName(e.file_path)}`
  if (tool === 'Edit' || tool === 'MultiEdit') return `editing ${baseName(e.file_path)}`
  if (tool === 'Write') return `writing ${baseName(e.file_path)}`
  if (tool === 'Grep') return `searching "${clip(String(e.pattern ?? ''), 22)}"`
  if (tool === 'Glob') return `finding ${clip(String(e.pattern ?? ''), 22)}`
  if (tool === 'Bash' || tool === 'PowerShell') return `running ${clip(String(e.command ?? '').trim().split(/\s+/).slice(0, 2).join(' '), 26)}`
  if (tool === 'Agent') return `briefing ${clip(String(e.description ?? 'an agent'), 26)}`
  if (tool === 'WebFetch') return 'fetching a page'
  if (tool === 'WebSearch') return 'searching the web'
  if (tool === 'ToolSearch') return 'loading tools'
  if (tool.startsWith('mcp__')) {
    const [, server = '', name = ''] = tool.split('__')
    return `${prettyServer(server)}: ${name.replace(/[_-]+/g, ' ')}`
  }
  return tool ? `using ${tool}` : ''
}

// The panel's own wrapper for a crab that dances while the crew celebrates.
const dancing = (drawn: string, isOn: boolean): string => (isOn ? `<g class="dance">${drawn}</g>` : drawn)

// --- the skin picker: every skin as a small card in its own colours and shape,
// with a button to put it on.

const SKINS_PANE = 'crab-skins'
const PREVIEW_H = 84

const previewSvg = (W: number, k: Skin, isOn: boolean): string => {
  const c = k.colors
  const H = PREVIEW_H
  const r = (n: number) => +n.toFixed(1)
  const shape = (x: number, y: number, w: number, h: number, attrs: string, radius = 12): string => {
    if (k.corners !== 'chamfer') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ${attrs}/>`
    const cut = Math.min(radius, h / 3)
    return `<path d="M${r(x + cut)} ${r(y)}H${r(x + w)}V${r(y + h - cut)}L${r(x + w - cut)} ${r(y + h)}H${r(x)}V${r(y + cut)}Z" ${attrs}/>`
  }
  const swatches = [c.accent, c.accent2, k.boss[1] ?? c.alert, c.done, c.warn, c.alert]
    .map((col, i) => `<rect x="${W - 14 - (6 - i) * 16}" y="14" width="12" height="12" rx="${k.corners === 'chamfer' ? 1 : 6}" fill="${col}"/>`)
    .join('')
  const barW = W - 28 - 60
  const scan = k.effects.scanlines
    ? `<defs><pattern id="pscan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" fill-opacity=".05"/></pattern></defs>${shape(1, 1, W - 2, H - 2, 'fill="url(#pscan)"')}`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${shape(1, 1, W - 2, H - 2, `fill="${c.tile}" stroke="${isOn ? c.accent : c.line}" stroke-width="${isOn ? 2 : 1}"`)}
<text x="14" y="26" font-family="${k.font}" font-size="15" font-weight="700" fill="${c.accent}">${xml(k.name)}${isOn ? `<tspan fill="${c.subtext}" font-size="11" font-weight="500">   on now</tspan>` : ''}</text>
${swatches}
<text x="14" y="46" font-family="${k.font}" font-size="11.5" fill="${c.subtext}">${xml(fitText(k.description || ' ', 11.5, W - 28))}</text>
${shape(14, 58, barW, 8, `fill="${c.track}"`, 4)}
${shape(14, 58, barW * 0.62, 8, `fill="${c.meter}"`, 4)}
<text x="${W - 14}" y="66" text-anchor="end" font-family="${k.font}" font-size="12" font-weight="700" fill="${c.text}">62%</text>
${scan}
</svg>`
}

// --- the chat, in the skin: tool rows as small cards with a status rail, an
// icon, the skin's verb and what the call is about; spinner words in the skin's
// voice. The Default skin leaves both as the app draws them.

const TOOL_ICONS: Record<string, string> = {
  Read: '▤',
  Edit: '✎',
  MultiEdit: '✎',
  Write: '✚',
  NotebookEdit: '✎',
  Bash: '❯',
  PowerShell: '❯',
  Grep: '⌕',
  Glob: '⌕',
  Agent: '◆',
  WebFetch: '⇣',
  WebSearch: '⌕',
  ToolSearch: '⚙',
  Skill: '✦',
}

// What a call is about, in a few words: the file, the command, the pattern.
const callTarget = (tool: string, input: unknown): string => {
  const e = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  if (pick('file_path')) return baseName(pick('file_path'))
  if (pick('notebook_path')) return baseName(pick('notebook_path'))
  if (pick('command')) return clip(pick('command').replace(/\s+/g, ' ').trim(), 80)
  if (pick('pattern')) return clip(pick('pattern'), 60)
  if (pick('description')) return clip(pick('description'), 70)
  if (pick('url')) return clip(pick('url').replace(/^https?:\/\//, ''), 60)
  if (pick('query')) return clip(pick('query'), 60)
  if (pick('skill')) return pick('skill')
  return ''
}

const toolLabel = (tool: string): { verb: string; real: string } => {
  const real = tool.startsWith('mcp__') ? (() => {
    const [, server = '', name = ''] = tool.split('__')
    return `${prettyServer(server)}: ${name.replace(/[_-]+/g, ' ')}`
  })() : tool
  const egg = eggOf()
  return { verb: (egg ? EGG_TOOLS[egg][tool] : undefined) ?? SKIN.toolWords[tool] ?? real, real }
}

// What an edit changed, as one hunk: Edit's old and new text, MultiEdit's edits one
// after another, a Write's first lines. Capped so a row never floods the chat.
const DIFF_LINES = 40
const editDiff = (
  tool: string,
  input: unknown,
): { source: string; added: number; removed: number; path: string; isNew: boolean; more: number } | null => {
  const e = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const path = typeof e.file_path === 'string' ? e.file_path : ''
  const cap = (src: string) => {
    const lines = src.split('\n')
    return { source: lines.slice(0, DIFF_LINES).join('\n'), more: Math.max(0, lines.length - DIFF_LINES) }
  }
  if (tool === 'Edit' && typeof e.old_string === 'string' && typeof e.new_string === 'string') {
    const d = unifiedDiff(e.old_string, e.new_string)
    const { more } = cap(d.source)
    return { ...d, path, isNew: false, more, source: more ? cap(d.source).source : d.source }
  }
  if (tool === 'MultiEdit' && Array.isArray(e.edits)) {
    const parts = (e.edits as Record<string, unknown>[])
      .filter(x => typeof x.old_string === 'string' && typeof x.new_string === 'string')
      .map(x => unifiedDiff(String(x.old_string), String(x.new_string)))
    if (!parts.length) return null
    const source = parts.map(d => d.source).join('\n')
    const capped = cap(source)
    return { source: capped.source, added: parts.reduce((a, d) => a + d.added, 0), removed: parts.reduce((a, d) => a + d.removed, 0), path, isNew: false, more: capped.more }
  }
  if (tool === 'Write' && typeof e.content === 'string') {
    const capped = cap(e.content)
    return { source: capped.source, added: e.content.split('\n').length, removed: 0, path, isNew: true, more: capped.more }
  }
  return null
}

// The spinner's word for this turn: the skin's, picked steadily from the engine's own.
const skinWord = (engineWord: string): string => {
  const egg = eggOf()
  const words = egg ? [...SKIN.words, ...EGG_WORDS[egg]] : SKIN.words
  if (!words.length) return engineWord
  const h = [...engineWord].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7)
  return words[h % words.length] ?? engineWord
}

// --- the band, as a HUD strip: the boss crab, the task and what it is doing on
// top; the progress gauge, a heartbeat while it works, and three readouts below.

// A header line on top; then the crab, the task, the gauge and the readouts;
// then crew, steps and tokens; then two lines kept spare for what comes next.
const HUD_HEAD = 24
const HUD_TOP = 48
const HUD_SPARE = 0
// The band is drawn this much larger than its layout, so its text reads at a glance.
const HUD_SCALE = 1.28
// The body under the header: two top lines, then crew, steps, tokens and session.
const HUD_BODY = 148
const HUD_H = HUD_HEAD + HUD_BODY + HUD_SPARE * 26 + 8
// Room between the frame and its content, so text clears the corner brackets.
const HUD_PAD = 12
const HUD_OUT_H = HUD_H + HUD_PAD * 2

type HudData = {
  title: string
  status: string
  activity: string
  progress: number | null
  /** The progress as a function of the time, when it is a guess that climbs with it. */
  progressAt?: (t: number) => number
  isWorking: boolean
  isParty: boolean
  ctxPct: number
  limitPct: number | null
  burnPerMin: number
  mood: 0 | 1 | 2
  /** Line 3: the crew at work, one small crab each, and a count per role. */
  crew: { costume: string; color: string; status: AgentStatus }[]
  roles: { role: string; color: string; count: number }[]
  /** Line 4: the manager's steps as pips, and the one in hand. */
  steps: StepState[]
  stepText: string
  /** Line 5: the token manager's top tip, and today's totals. */
  tip: Tip
  today: Today
  /** The header: crew mode's reason, the model, its effort, the folder, how long the task has run. */
  crewMode: string
  /** Now, for the radio's station of the hour. */
  at: number
  /** Drawn light: crew as dots, no trails or skyline, for a band that grew too big. */
  lite?: boolean
  model: string
  effort: string
  folder: string
  taskMs: number
  /** When the task's clock started: the band's clock ticks inside the image from it. */
  taskFrom?: number
  /** The timekeeper's reading for the job: time used and its budget. */
  budget?: { usedMs: number; min: number }
  /** How many background tasks and wake-ups the engine last listed: a chip in the header. */
  bg: number
  /** Line 6: the turn, the speed, what the turn and the session cost, the cache's hour. */
  session: { turn: number; speed: number | null; turnCost: number; total: number; cacheLeft: number | null; isBusy: boolean; cacheUntil?: number | null }
}

// A pulse line that runs left to right while work goes on: a heartbeat.
const heartbeat = (x: number, y: number, w: number, color: string): string => {
  const pts: string[] = []
  for (let i = 0; i <= w; i += 4) {
    const k = (i / w) * 6
    const beat = Math.abs((k % 1) - 0.5) < 0.08 ? (Math.floor(k) % 2 ? -7 : 6) : Math.sin(i / 5) * 1.2
    pts.push(`${(x + i).toFixed(1)},${(y + beat).toFixed(1)}`)
  }
  const d = `M${pts.join('L')}`
  return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="1"/>
<path class="ekg" d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="40 ${w * 2}"/>`
}

const hudBandSvg = (OW: number, d: HudData): string => {
  const c = SKIN.colors
  const egg = eggOf()
  // The frame takes the whole box; the content sits inside it, padded.
  const OH = HUD_OUT_H
  const W = OW - HUD_PAD * 2
  const edge = d.isParty ? c.done : d.isWorking ? c.accent : c.line
  const statusTone = d.isParty ? c.done : d.isWorking ? c.accent : c.muted
  const left = 52
  const pillW = Math.round(20 + textWidth(d.status, 10.5))
  const titleW = Math.min(220, textWidth(d.title, 13) + 4)
  // The three readouts need 256px beside the title and its pill; a narrow band drops them.
  const hasReadouts = W >= left + titleW + pillW + 80 + 256
  const right = hasReadouts ? 256 : 14
  const barW = Math.max(40, W - left - right - 74)
  const pct = d.progress === null ? null : Math.round(d.progress * 100)
  // Readouts at the right: context as a ring, the five-hour limit as a small gauge, the burn.
  const rx = W - right + 14
  const ring = (cx: number, cy: number, value: number, tone: string) => {
    const r = 9
    const arc = 2 * Math.PI * r
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.track}" stroke-width="3"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${tone}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${((arc * value) / 100).toFixed(1)} ${arc.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`
  }
  const limitTone = (d.limitPct ?? 0) >= 90 ? c.alert : (d.limitPct ?? 0) >= 70 ? c.warn : c.meter
  const readouts = `${ring(rx + 10, 24, d.ctxPct, gaugeColor(d.ctxPct))}
<text class="m" x="${rx + 26}" y="20" font-family="${FONT}" font-size="9.5" letter-spacing=".4">CTX</text>
<text class="t" x="${rx + 26}" y="33" font-family="${FONT}" font-size="12" font-weight="800" font-variant-numeric="tabular-nums">${d.ctxPct}%</text>
<line x1="${rx + 64}" y1="14" x2="${rx + 64}" y2="34" stroke="${c.line}" stroke-opacity=".6"/>
<text class="m" x="${rx + 74}" y="20" font-family="${FONT}" font-size="9.5" letter-spacing=".4">5H LIMIT</text>
${d.limitPct === null ? `<text class="m" x="${rx + 74}" y="33" font-family="${FONT}" font-size="11">—</text>` : `${segmentBar(rx + 74, 27, 54, d.limitPct, limitTone).replace(/height="8"/g, 'height="5"').replace(/height="3"/g, 'height="0"')}<text x="${rx + 134}" y="33" font-family="${FONT}" font-size="12" font-weight="800" fill="${limitTone}" font-variant-numeric="tabular-nums">${Math.round(d.limitPct)}%</text>`}
<line x1="${rx + 168}" y1="14" x2="${rx + 168}" y2="34" stroke="${c.line}" stroke-opacity=".6"/>
<text class="m" x="${rx + 178}" y="20" font-family="${FONT}" font-size="9.5" letter-spacing=".4">${egg ? 'HEAT' : 'BURN/MIN'}</text>
${egg ? heatStars(rx + 178, 43, burnStars(d.burnPerMin), egg) : ''}
<path d="M${rx + 183} 24l-4 6h3l-1.5 5l5-7h-3l1.5-4z" fill="${MOOD_COLOR[burnMood(d.burnPerMin)]}"/>
<text x="${rx + 188}" y="33" font-family="${FONT}" font-size="12" font-weight="800" fill="${MOOD_COLOR[burnMood(d.burnPerMin)]}" font-variant-numeric="tabular-nums">${fmtTokens(d.burnPerMin)}</text>`
  // The gauge: the real share when there is one, else a scanner sweeping while it works.
  const gaugeY = 31
  const climb = d.progressAt
  const gauge =
    pct !== null && climb
      ? liveSegmentBar(left, gaugeY, barW, d.at, t => Math.round(climb(t) * 100), c.accent)
      : pct !== null
      ? `${segmentBar(left, gaugeY, barW, pct, d.isParty ? c.done : c.accent).replace(/height="8"/g, 'height="7"')}`
      : `<rect x="${left}" y="${gaugeY}" width="${barW}" height="7" rx="1" class="k"/>${d.isWorking ? `<rect class="scan" x="${left}" y="${gaugeY}" width="${Math.round(barW * 0.22)}" height="7" rx="1" fill="${c.accent}"/>` : ''}`
  const css = `<style>
.ekg{animation:ekg 1.8s linear infinite}@keyframes ekg{from{stroke-dashoffset:${barW * 2}}to{stroke-dashoffset:0}}
.scan{animation:scan 1.6s ease-in-out infinite alternate}@keyframes scan{to{transform:translateX(${Math.round(barW * 0.78)}px)}}
.hedge{animation:hedge 1.8s ease-in-out infinite}@keyframes hedge{50%{stroke-opacity:.95}}
.beam{animation:beam ${d.isWorking ? 3.2 : 9}s linear infinite}@keyframes beam{from{transform:translateX(-180px)}to{transform:translateX(${OW + 180}px)}}
.brk{animation:brk 2.4s ease-in-out infinite}@keyframes brk{50%{opacity:.35}}
.shine{animation:shine 2.2s ease-in-out infinite}@keyframes shine{from{transform:translateX(-30px);opacity:0}30%{opacity:1}to{transform:translateX(${Math.max(40, Math.round((barW * (pct ?? 0)) / 100))}px);opacity:0}}
.cur{animation:cur 1.1s steps(1) infinite}@keyframes cur{50%{opacity:0}}
@media (prefers-reduced-motion: reduce){.ekg,.scan,.hedge,.beam,.brk,.shine,.cur{animation:none}}
${egg ? EGG_CSS : ''}
</style>`
  // A beam of light that crosses the card, clipped to its shape.
  const beam = `<defs><clipPath id="hudclip">${cardShape(0.5, 0.5, OW - 1, OH - 1, '', 10)}</clipPath>
<linearGradient id="hudbeam" x1="0" x2="1"><stop offset="0" stop-color="${c.accent2}" stop-opacity="0"/><stop offset=".5" stop-color="${c.accent2}" stop-opacity="${d.isWorking ? 0.14 : 0.07}"/><stop offset="1" stop-color="${c.accent2}" stop-opacity="0"/></linearGradient></defs>
<g clip-path="url(#hudclip)"><g transform="skewX(-18)"><rect class="beam" x="0" y="0" width="160" height="${OH}" fill="url(#hudbeam)"/></g></g>`
  // Corner brackets, a HUD's viewfinder.
  const L = 10
  const brackets = [
    [5, 5, 1, 1],
    [OW - 5, 5, -1, 1],
    [5, OH - 5, 1, -1],
    [OW - 5, OH - 5, -1, -1],
  ]
    .map(([x, y, sx, sy], i) => `<path class="brk" style="animation-delay:${i * 0.3}s" d="M${x} ${y + sy * L}V${y}H${x + sx * L}" fill="none" stroke="${c.accent2}" stroke-width="1.6" stroke-linecap="square"/>`)
    .join('')
  // A shine that runs along the filled part of the gauge while it works.
  const shine = d.isWorking && pct !== null && pct > 0
    ? `<rect class="shine" x="${left}" y="${gaugeY - 1}" width="26" height="9" rx="1" fill="#ffffff" fill-opacity=".55"/>`
    : ''
  return svg(
    OW,
    OH,
    `${css}
${cardShape(0.5, 0.5, OW - 1, OH - 1, `class="tile"`, 10)}
${cardShape(0.5, 0.5, OW - 1, OH - 1, `fill="none" stroke="${edge}" stroke-opacity="${d.isWorking ? 0.45 : 0.6}" stroke-width="1.2"${d.isWorking ? ' class="hedge"' : ''}`, 10)}
${egg && !d.lite ? `<g clip-path="url(#hudclip)">${skyline(OW, OH - 16, 14, egg).replace('<g opacity=".5">', '<g opacity=".25">')}</g>` : ''}
${beam}
${brackets}
<rect x="0.5" y="12" width="3" height="${OH - 24}" rx="1.5" fill="${edge}"/>
<g transform="translate(${HUD_PAD} ${HUD_PAD})">
${hudHead(W, d)}
<g transform="translate(0 ${HUD_HEAD - 2})">
<line x1="12" y1="${HUD_TOP + 0.5}" x2="${W - 12}" y2="${HUD_TOP + 0.5}" stroke="${c.line}"/>
${(() => {
  const figure = `${crab(10, 9, 'boss', false, d.isWorking, 1.05)}${crown(10, 9, 1.05)}`
  if (!egg || !d.isWorking || d.lite) return dancing(figure, d.isParty)
  const sv = sandevistan(figure, egg)
  return `<defs>${sv.defs}</defs>${sv.svg}${dancing(figure, d.isParty)}`
})()}
${egg ? relicText(left, 20, fitText(d.title, 13, titleW), `font-family="${FONT}" font-size="13" font-weight="800" fill="${c.accent}"`, egg) : `<text x="${left}" y="20" font-family="${FONT}" font-size="13" font-weight="800" class="ac gl">${xml(fitText(d.title, 13, titleW))}</text>`}
<rect x="${left + titleW + 8}" y="9" width="${pillW}" height="15" rx="7.5" fill="${statusTone}" fill-opacity="${d.isWorking || d.isParty ? 0.95 : 0.25}"/>
<text x="${left + titleW + 8 + pillW / 2}" y="20" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="800" fill="${d.isWorking || d.isParty ? inkOn(statusTone) : c.text}">${xml(d.status)}</text>
<text class="s" x="${left + titleW + pillW + 18}" y="20" font-family="${FONT}" font-size="11.5">${xml(fitText(d.activity ? `▸ ${d.activity}` : '', 11.5, Math.max(0, W - right - (left + titleW + pillW + 18) - 8)))}</text>
${gauge}
${shine}
${pct !== null && climb
  ? liveText(left + barW + 8, gaugeY + 7, d.at, 12, `class="t" font-family="${FONT}" font-size="12" font-weight="800" font-variant-numeric="tabular-nums"`, t => `${Math.round(climb(t) * 100)}%`)
  : `<text class="t" x="${left + barW + 8}" y="${gaugeY + 7}" font-family="${FONT}" font-size="12" font-weight="800" font-variant-numeric="tabular-nums">${pct === null ? (d.isWorking ? '···' : '') : `${pct}%`}</text>`}
${d.isWorking ? heartbeat(left + barW + 44, gaugeY + 3, 22, c.accent2) : ''}
${hasReadouts ? `<line x1="${W - right}" y1="9" x2="${W - right}" y2="${HUD_TOP - 7}" stroke="${c.line}"/>
${readouts}` : ''}
${hudLines(W, d)}
</g>
${hudSpare(W)}
</g>
${egg && d.isParty ? celebration(OW, OH, egg, FONT) : ''}`,
  )
}

// The header: the dashboard's name and skin, the model and effort, the folder, the task's clock.
const hudHead = (W: number, d: HudData): string => {
  const c = SKIN.colors
  const y = 16
  const name = 'MISSION CONTROL'
  const nameW = textWidth(name, 10.5) * 1.08 + 4
  const skin = SKIN.name.toUpperCase()
  const skinW = Math.round(textWidth(skin, 9.5) + 14)
  const sx = 24 + nameW + 8
  const crewLabel = d.crewMode ? '⚑ CREW MODE' : ''
  const crewW = crewLabel ? Math.round(textWidth(crewLabel, 9.5) + 16) : 0
  // The skin's chip only when it fits the band.
  const hasSkinChip = sx + skinW <= W - 14
  const cx = hasSkinChip ? sx + skinW + 8 : sx
  // The background count sits in the band's own drawing, so it never moves the buttons beside it.
  const bgLabel = d.bg ? `⧗\uFE0E ${d.bg}` : ''
  const bgW = bgLabel ? Math.round(textWidth(bgLabel, 9.5) + 14) : 0
  const bx = cx + (crewW ? crewW + 8 : 0)
  const mx = bgW ? bx + bgW + 12 : cx + (crewW ? crewW + 12 : 4)
  const egg = eggOf()
  const psy = egg ? psychoChip(mx, y, d.ctxPct, FONT) : { svg: '', w: 0 }
  const mx2 = mx + (psy.w ? psy.w + 10 : 0)
  const model = [d.model, d.effort].filter(Boolean).join(' · ')
  const clock = d.budget ? `⏱\uFE0E ${budgetLabel(d.budget.usedMs, d.budget.min)}` : d.taskMs > 0 ? `⏱\uFE0E ${fmtTime(d.taskMs)}` : ''
  const parts = [egg ? `♪ ${radio(d.at)}` : '', d.folder ? `▤ ${d.folder}` : '', clock].filter(Boolean)
  const widthOf = (xs: string[]) => (xs.length ? textWidth(xs.join('   '), 11) + 8 : 0)
  while (parts.length > (clock ? 1 : 0) && W - 14 - widthOf(parts) < mx2 + 60) parts.shift()
  const right = parts.join('   ')
  const rightW = widthOf(parts)
  const done = d.steps.filter(st => st === 'done').length
  // The breach ticker takes the middle when there is room for it.
  const breachX = W - 14 - rightW - BREACH_W - 24
  const hasBreach = Boolean(egg) && breachX > mx2 + 120
  return `<rect x="14" y="${y - 7}" width="5" height="5" fill="${c.accent2}" transform="rotate(45 16.5 ${y - 4.5})"/>
<text x="24" y="${y}" font-family="${FONT}" font-size="10.5" font-weight="800" letter-spacing=".9" fill="${c.accent2}">${name}<tspan class="cur">▮</tspan></text>
${egg ? `<text x="24" y="${y + 7}" font-family="${FONT.replace(/,?sans-serif$/, '')},${CJK_FONT}" font-size="7" letter-spacing="1.2" fill="${c.accent2}" fill-opacity=".5">${KATAKANA[egg]}</text>` : ''}
${hasBreach && egg ? breachTicker(breachX, y, d.isWorking, done, d.steps.length, egg, FONT) : ''}
${psy.svg}
${hasSkinChip ? `<rect x="${sx}" y="${y - 10}" width="${skinW}" height="13" rx="2" fill="none" stroke="${c.accent2}" stroke-opacity=".55"/>
<text x="${sx + skinW / 2}" y="${y - 0.5}" text-anchor="middle" font-family="${FONT}" font-size="9.5" font-weight="700" letter-spacing=".4" fill="${c.accent2}">${xml(skin)}</text>` : ''}
${crewW ? `<rect class="live" x="${cx}" y="${y - 10}" width="${crewW}" height="13" rx="2" fill="${c.accent}"/><text x="${cx + crewW / 2}" y="${y - 0.5}" text-anchor="middle" font-family="${FONT}" font-size="9.5" font-weight="800" letter-spacing=".4" fill="${inkOn(c.accent)}"><title>${xml(d.crewMode)}</title>${crewLabel}</text>` : ''}
${bgW ? `<rect x="${bx}" y="${y - 10}" width="${bgW}" height="13" rx="2" fill="none" stroke="${c.accent}" stroke-opacity=".8"/><text x="${bx + bgW / 2}" y="${y - 0.5}" text-anchor="middle" font-family="${FONT}" font-size="9.5" font-weight="800" letter-spacing=".4" fill="${c.accent}"><title>${d.bg} ${xml(tr().bgBand)}</title>${bgLabel}</text>` : ''}
<text class="s" x="${mx2}" y="${y}" font-family="${FONT}" font-size="11">${xml(fitText(model, 11, Math.max(0, (hasBreach ? breachX : W - rightW - 14) - mx2 - 16)))}</text>
${!d.budget && clock && d.taskFrom
  ? // The seconds tick inside the image: the band is not drawn again for them.
    liveText(W - 14, y, d.at, 11, `class="m" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums"`, t => [...parts.slice(0, -1), `⏱\uFE0E ${fmtTime(Math.max(0, t - (d.taskFrom ?? t)))}`].join('   '))
  : `<text class="m" x="${W - 14}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${d.budget && clock ? budgetClock(parts, clock, d.budget) : xml(right)}</text>`}
<line x1="12" y1="${HUD_HEAD + 0.5}" x2="${W - 12}" y2="${HUD_HEAD + 0.5}" stroke="${c.line}"/>`
}

// Two lines kept free for what comes next: faint guides, so the space reads as on purpose.
const hudSpare = (W: number): string =>
  Array.from({ length: HUD_SPARE }, (_, i) => {
    const y = HUD_HEAD - 2 + HUD_BODY + 8 + i * 26
    return `<line x1="14" y1="${y + 0.5}" x2="${W - 14}" y2="${y + 0.5}" stroke="${SKIN.colors.line}" stroke-opacity=".5" stroke-dasharray="2 5"/>`
  }).join('\n')

// Lines three to five: the crew, the steps, the tip and today.
const hudLines = (W: number, d: HudData): string => {
  const c = SKIN.colors
  const x0 = 14
  const label = (y: number, text: string) => `<text class="m" x="${x0}" y="${y}" font-family="${FONT}" font-size="10" font-weight="700" letter-spacing=".6">${text}</text>`
  const out: string[] = []
  // Crew: small crabs in costume, then a count per role.
  const y3 = HUD_TOP + 8
  out.push(label(y3 + 14, 'CREW'))
  const crabX = x0 + 64
  if (!d.crew.length) {
    out.push(`<text class="s" x="${crabX}" y="${y3 + 14}" font-family="${FONT}" font-size="11.5">No crew on this job yet</text>`)
  } else {
    let rx = W - 14
    const pills: string[] = []
    for (const r of [...d.roles].reverse().slice(0, 4)) {
      const t = `${r.role} ${r.count}`
      const w = Math.round(textWidth(t, 10.5) + 16)
      if (rx - w < crabX + 24 + 28) break
      rx -= w
      pills.push(`<rect x="${rx}" y="${y3 + 3}" width="${w}" height="16" rx="8" fill="${r.color}" fill-opacity=".18" stroke="${r.color}" stroke-opacity=".6"/>
<text x="${rx + w / 2}" y="${y3 + 14.5}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="700" fill="${r.color}">${xml(t)}</text>`)
      rx -= 6
    }
    out.push(...pills)
    // The figures stop short of the pills, leaving room for a "+N".
    const room = Math.max(1, Math.floor((rx - 8 - 24 - crabX) / 24))
    d.crew.slice(0, room).forEach((m, i) => {
      if (d.lite) {
        out.push(`<circle cx="${crabX + i * 24 + 10}" cy="${y3 + 10}" r="5" fill="${m.color}" fill-opacity="${m.status === 'running' ? 1 : 0.4}"/>`)
        return
      }
      out.push(crab(crabX + i * 24, y3, m.costume, m.status !== 'running', m.status === 'running', 0.72))
      if (m.status === 'running') out.push(`<circle class="live" cx="${crabX + i * 24 + 21}" cy="${y3 + 2}" r="2.2" fill="${m.color}"/>`)
    })
    if (d.crew.length > room) out.push(`<text class="m" x="${crabX + room * 24 + 2}" y="${y3 + 14}" font-family="${FONT}" font-size="11">+${d.crew.length - room}</text>`)
  }
  // Steps: one pip each, the current step named.
  const y4 = HUD_TOP + 34
  out.push(label(y4 + 14, 'STEPS'))
  if (!d.steps.length) {
    out.push(`<text class="s" x="${crabX}" y="${y4 + 14}" font-family="${FONT}" font-size="11.5">No steps yet</text>`)
  } else {
    // As many pips as fit beside the count.
    const pips = Math.max(0, Math.min(16, Math.floor((W - crabX - 50) / 13)))
    d.steps.slice(0, pips).forEach((st, i) => {
      const cx = crabX + 5 + i * 13
      const cy = y4 + 10
      // Shape tells them apart, not colour alone: done filled, running a ring with a
      // live dot, failed a cross, waiting an empty ring.
      out.push(
        st === 'done'
          ? `<circle cx="${cx}" cy="${cy}" r="4.2" fill="${c.done}"/>`
          : st === 'running'
            ? `<circle class="tr" cx="${cx}" cy="${cy}" r="3.9" fill="none" stroke-width="1.3"/><circle class="live" cx="${cx}" cy="${cy}" r="1.9" fill="${c.accent}"/>`
            : st === 'failed'
              ? `<path d="M${cx - 3.2} ${cy - 3.2}l6.4 6.4M${cx + 3.2} ${cy - 3.2}l-6.4 6.4" stroke="${c.alert}" stroke-width="1.8" stroke-linecap="round"/>`
              : st === 'stopped'
                ? `<rect x="${cx - 3.2}" y="${cy - 3.2}" width="6.4" height="6.4" rx="1.2" fill="${c.muted}"/>`
                : `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${c.muted}" stroke-width="1.3"/>`,
      )
    })
    const done = d.steps.filter(st => st === 'done').length
    const tx = crabX + Math.min(pips, d.steps.length) * 13 + 10
    out.push(`<text class="t" x="${tx}" y="${y4 + 14}" font-family="${FONT}" font-size="12" font-weight="700" font-variant-numeric="tabular-nums">${done}/${d.steps.length}<tspan class="s" font-weight="400">  ${xml(fitText(d.stepText, 11.5, W - tx - 60))}</tspan></text>`)
  }
  // The tip on the left, today's totals on the right.
  const y5 = HUD_TOP + 60
  out.push(label(y5 + 14, 'TOKENS'))
  const fullToday = `today ${d.today.tasks} ${d.today.tasks === 1 ? 'task' : 'tasks'} · ${fmtTokens(d.today.tokens)} · ≈${fmtCost(d.today.costUsd)}`
  const todayText = W - crabX - 14 - (textWidth(fullToday, 11) + 8) - 20 >= 120 ? fullToday : ''
  const todayW = todayText ? textWidth(todayText, 11) + 8 : 0
  out.push(`<circle cx="${crabX + 4}" cy="${y5 + 10}" r="3.5" fill="${MOOD_COLOR[d.tip.level]}"${d.tip.level === 2 ? ' class="live"' : ''}/>
<text class="${d.tip.level === 2 ? 't' : 's'}" x="${crabX + 14}" y="${y5 + 14}" font-family="${FONT}" font-size="11.5" font-weight="${d.tip.level === 2 ? 600 : 500}">${xml(fitText(d.tip.text, 11.5, W - crabX - 14 - todayW - 20))}</text>
<text class="m" x="${W - 14}" y="${y5 + 14}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(todayText)}</text>`)
  // Session: turn, speed and cost on the left; the cache draining on the right.
  const y6 = HUD_TOP + 86
  const ss = d.session
  out.push(label(y6 + 14, 'SESSION'))
  const cells: [string, string, string][] = [
    ['TURN', `${ss.turn}`, c.text],
    ['SPEED', ss.speed === null ? '—' : `${ss.speed} tok/s`, c.accent2],
    ['$ TURN', fmtCost(ss.turnCost), c.done],
    ['$ TOTAL', fmtCost(ss.total), c.text],
  ]
  const left = ss.cacheLeft
  const cacheText0 = ss.isBusy ? 'warm' : left === null ? '—' : left === 0 ? 'expired' : left > 600 ? '60 min' : '00:00'
  const cacheStart = W - 14 - 64 - 8 - textWidth(cacheText0, 12) - 10 - textWidth('⧗ CACHE', 9.5) - 14
  const cellW = ([k, v]: [string, string, string]) => textWidth(k, 9.5) + 6 + textWidth(v, 12) + 22
  // Drop the least needed first: the turn's cost, then the speed, then the total.
  const keep = [...cells]
  const fits = () => crabX + keep.reduce((n, cell) => n + cellW(cell), 0) - 22 <= cacheStart
  for (const drop of ['$ TURN', 'SPEED', '$ TOTAL']) {
    if (fits()) break
    keep.splice(keep.findIndex(cell => cell[0] === drop), 1)
  }
  const hasCache = fits()
  let cx = crabX
  for (const [k, v, tone] of keep) {
    if (!hasCache && cx + cellW([k, v, tone]) - 22 > W - 14) break
    out.push(`<text class="m" x="${cx}" y="${y6 + 14}" font-family="${FONT}" font-size="9.5" letter-spacing=".4">${xml(k)}</text>
<text x="${cx + textWidth(k, 9.5) + 6}" y="${y6 + 14}" font-family="${FONT}" font-size="12" font-weight="800" ${tone === c.text ? 'class="t"' : `fill="${tone}"`} font-variant-numeric="tabular-nums">${xml(v)}</text>`)
    cx += cellW([k, v, tone])
  }
  if (!hasCache) return out.join('\n')
  const cacheTone = ss.isBusy || left === null ? c.accent2 : left <= 600 ? c.alert : left <= 1200 ? c.warn : c.accent2
  const cacheText = cacheTextOf(ss.isBusy, left)
  const share = ss.isBusy ? 1 : left === null ? 0 : left / (CACHE_TTL_MS / 1000)
  const barW = 64
  const bx = W - 14 - barW
  const tw = textWidth(cacheText, 12)
  // Draining, the countdown and the bar move inside the image: no redraw each second.
  const until = !ss.isBusy && left ? ss.cacheUntil : null
  const leftAt = (t: number) => Math.max(0, Math.floor(((until ?? t) - t) / 1000))
  const valueAttrs = `text-anchor="end" font-family="${FONT}" font-size="12" font-weight="800" font-variant-numeric="tabular-nums"`
  const live = until ? liveWidth(d.at, t => barW * Math.min(1, leftAt(t) / (CACHE_TTL_MS / 1000))) : null
  out.push(`<text class="m" x="${bx - 8 - tw - 10}" y="${y6 + 14}" text-anchor="end" font-family="${FONT}" font-size="9.5" letter-spacing=".4">⧗ CACHE</text>
${until ? liveText(bx - 8, y6 + 14, d.at, 12, valueAttrs, t => cacheTextOf(false, leftAt(t)), cacheTone) : `<text x="${bx - 8}" y="${y6 + 14}" ${valueAttrs} fill="${cacheTone}">${cacheText}</text>`}
<rect class="k" x="${bx}" y="${y6 + 8}" width="${barW}" height="5" rx="1"/>
<rect x="${bx}" y="${y6 + 8}" width="${live ? live.start : (barW * Math.max(0, Math.min(1, share))).toFixed(1)}" height="5" rx="1" fill="${cacheTone}"${left !== null && left <= 600 && !ss.isBusy ? ' class="live"' : ''}>${live ? live.animate : ''}</rect>`)
  return out.join('\n')
}

// The cache's reading: "warm" while a turn runs, its minutes, then its last ten as mm:ss.
const cacheTextOf = (isBusy: boolean, left: number | null): string =>
  isBusy ? 'warm' : left === null ? '—' : left === 0 ? 'expired' : left > 600 ? `${Math.ceil(left / 60)} min` : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

const sessionAlt = (e: Env, rules: string[]): string =>
  `${splitCwd(e.cwd).name}, ${e.model ? modelName(e.model) + ', ' : ''}context ${e.contextPct}%, ${e.connectors.length} connectors, ${rules.length} answer rules`

// --- terminal drawing: the same rows in text.

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', stopped: '■', planned: '◷' }
// The terminal's colour for an agent's mark: an Esc-ed one is grey, never the error's red.
const statusColor = (a: AgentRun, fallback: string): string | undefined =>
  a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : a.status === 'stopped' ? 'gray' : isQuiet(a) ? '#E5675E' : fallback

// Closes the agents pane when it is in front; otherwise brings it up, from behind
// another tab or undrawn too. True when it ends up shown.
async function togglePane($: EngineInterface): Promise<boolean> {
  const row = (await $.ui.panes()).find(p => p.id === PANE) as { isShown?: boolean; isPlaced?: boolean } | undefined
  if (row && row.isShown !== false && row.isPlaced !== false) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await showPane($, PANE, SKIN.tabs.mission)
  return true
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: SKIN.tabs.mission })
}

// The whole job is done once the manager's turn is over and none of its crew still
// runs: background agents can outlive the turn. Then, once: the cheer, the chime,
// the notification, and the clock for clearing the panel.
// The last jobs done, newest first: the Afterlife's drinks, Mikoshi's engrams.
const LEGENDS_KEPT = 5
const cleanLegends = (v: unknown): Legend[] =>
  (Array.isArray(v) ? v : [])
    .filter((l): l is Legend => Boolean(l) && typeof (l as Legend).task === 'string' && typeof (l as Legend).at === 'number')
    .map(l => ({ task: clip(l.task, 60), costUsd: Number(l.costUsd) || 0, at: l.at, ms: Number(l.ms) || 0 }))
    .slice(0, LEGENDS_KEPT)
// Cyberpsychosis is warned of once per climb past 85% context.
let psyWarned = false
// MaxTac's siren sounds once per climb past 95%.
let sirenPlayed = false
// A full context or a long plan calls the crew once per climb, not on every prompt.
let crewCalled = false
// The most tools any request has offered: the main loop's list is the longest.
let mostTools = 0

// A plan with steps not yet completed: Claude stopped half-way to ask, not done.
const hasOpenPlan = (plan: PlanStep[] | undefined): boolean => Boolean(plan?.length) && (plan ?? []).some(st => st.status !== 'completed')
// An agent that failed and was not tried again with success in the same job.
const isUnresolved = (a: AgentRun, crew: AgentRun[]): boolean =>
  a.status === 'failed' && !crew.some(b => b !== a && b.status === 'done' && b.startedAt >= a.startedAt && norm(b.description) === norm(a.description))

async function finishIfIdle($: EngineInterface): Promise<void> {
  const boss = await read($, manager)
  if (boss.isWorking || !boss.task || boss.doneAt) return
  const crew = crewOf(await read($, agents), boss)
  if (crew.some(isHolding)) return
  // A shell, monitor or workflow still in the background: not done yet. The stop
  // that lists none, or a release, calls this again.
  if (bgBlocking(await read($, background)).length) return
  const at = await $.clock.now()
  // A background agent's report is not answered yet: the main turn that reads it
  // ends the job (the clock lets it go when no such turn comes).
  if (boss.reportDue && at - boss.reportDue < REPORT_WAIT_MS) return
  // The job that finishes: an earlier one its background work carried here names it.
  const job = boss.carried ?? boss
  // Esc, an API error or a refusal, or an agent that failed for good: shown as such, never cheered.
  const outcome = boss.outcome ?? (crew.some(a => isUnresolved(a, crew)) ? 'error' : undefined)
  const isAsking = !outcome && hasOpenPlan(boss.plan)
  const isQuietEnd = Boolean(outcome) || isAsking || Boolean(boss.isFollowUp)
  const isWorthACheer = !isQuietEnd && (crew.length > 0 || at - job.startedAt > 20_000)
  // Claimed in one atomic step: two agents finishing together run this twice, and
  // only the first may cheer and pay out.
  let isMine = false
  await update($, manager, prev => {
    isMine = false
    if (prev.doneAt || prev.isWorking || prev.task !== boss.task) return prev
    isMine = true
    return { ...prev, doneAt: at, activity: '', reportDue: undefined, ...(isQuietEnd ? { outcome } : { celebrateUntil: at + CELEBRATE_MS }) }
  })
  if (!isMine) return
  // A follow-up Claude started after the job was done ends as quietly as it began.
  if (boss.isFollowUp || outcome === 'stopped') return
  if (outcome === 'error') {
    $.ui.toast(`⚠ Ended with an error: ${clip(job.task, 60)}`)
    void $.ui.notify(`Claude hit an error: ${clip(job.task, 80)}`).catch(() => undefined)
    return
  }
  if (isAsking) {
    $.ui.toast(`⏸ Claude needs you: ${clip(job.task, 60)}`)
    void $.ui.notify(`Claude needs you: ${clip(job.task, 80)}`).catch(() => undefined)
    return
  }
  const isLong = at - job.startedAt >= 180_000
  const isCrew = crew.length >= 5
  // Every finished job pays, a quick solo one too; only the cheer is kept for the bigger ones.
  const paid = bumpCred($, c => ({
    ...c,
    jobs: c.jobs + 1,
    longJobs: c.longJobs + (isLong ? 1 : 0),
    crewJobs: c.crewJobs + (isCrew ? 1 : 0),
    nightJobs: c.nightJobs + (new Date(at).getHours() < 5 ? 1 : 0),
    xp: c.xp + 10 + (isLong ? 15 : 0) + (isCrew ? 10 : 0),
  }), isWorthACheer)
  if (!isWorthACheer) {
    await paid
    return
  }
  const info = await read($, env)
  const legend: Legend = { task: clip(job.task.replace(/\s+/g, ' '), 60), costUsd: Math.max(0, info.costUsd - (job.costAtStart ?? info.costUsd)), at, ms: Math.max(0, at - job.startedAt) }
  const kept = cleanLegends(await $.store.get('legends').catch(() => []))
  await $.store.set('legends', [legend, ...kept].slice(0, LEGENDS_KEPT)).catch(() => undefined)
  const egg = eggOf()
  // A long job makes a legend: the Afterlife names a drink after it.
  if (egg && legend.ms >= 180_000) $.ui.toast(egg === 'corpo' ? `▣ Engram filed in Mikoshi: ${clip(legend.task, 40)}` : `🍸 The Afterlife named a drink after you: The ${clip(legend.task, 40)}`)
  $.ui.toast(`🎉 Done: ${clip(job.task, 60)}`)
  void $.ui.notify(`Claude finished: ${clip(job.task, 80)}`).catch(() => undefined)
  // One chime, not two cut short: the level-up's when the job earned one, else the skin's.
  const isCheer = await paid.catch(() => false)
  void play($, !egg ? 'assets/done.wav' : isCheer ? `${ADDON}/assets/levelup.wav` : `${ADDON}/assets/done-${egg}.wav`)
}

// What everyone is doing right now, from each tool call: the live activity line,
// the heartbeat the stuck alarm reads, and the replay. Runs beside the call.
async function trackTool($: EngineInterface, e: { tool: unknown; agentId?: string }): Promise<void> {
  try {
    const text = activityOf(e as unknown as Record<string, unknown>)
    const at = await $.clock.now()
    if (e.agentId) {
      const id = e.agentId
      // One more call in flight: while it runs (a long build, a permission prompt) the agent is not quiet.
      if ((await read($, agents)).some(a => a.agentId === id))
        await update($, agents, list => list.map(a => (a.agentId === id ? { ...a, activity: text || a.activity, lastProgressAt: at, isStuck: false, toolsInFlight: (a.toolsInFlight ?? 0) + 1 } : a)))
    } else if (text && !String(e.tool).startsWith('mcp__ccd_')) {
      if ((await read($, manager)).activity !== text) await update($, manager, prev => ({ ...prev, activity: text }))
    }
    // Every tool call lands on the replay, but the app's own bookkeeping.
    const tool = String(e.tool)
    if (!tool.startsWith('mcp__ccd_')) {
      const a = e.agentId ? (await read($, agents)).find(x => x.agentId === e.agentId) : undefined
      const who = e.agentId ? (a ? runRole(a) : 'Agent') : 'Manager'
      const name = tool.startsWith('mcp__') ? tool.split('__').slice(1).join(': ') : tool
      let dropped = 0
      await update($, timeline, prev => {
        const all = [...prev, { at, tool: clip(name, 80), text: clip(text || '', 300), who }]
        dropped = Math.max(0, all.length - BEATS_KEPT)
        return all.slice(-BEATS_KEPT)
      })
      if (dropped) await update($, bdPick, i => shiftPick(i, dropped))
    }
  } catch {
    // A drawing aid only.
  }
}

// The call is over: one fewer in flight, and its end is a sign of life too.
async function endTool($: EngineInterface, agentId: string): Promise<void> {
  try {
    const at = await $.clock.now()
    if (!(await read($, agents)).some(a => a.agentId === agentId && a.toolsInFlight)) return
    await update($, agents, list => list.map(a => (a.agentId === agentId ? { ...a, toolsInFlight: Math.max(0, (a.toolsInFlight ?? 0) - 1), lastProgressAt: at, isStuck: false } : a)))
  } catch {
    // A drawing aid only.
  }
}

// A typed slash command (a skill, /code-review) runs a model turn: its first main
// turn takes it as the job. Any other prompt in between cancels the wait.
let pendingCommand = ''

// The main loop at work on a turn no person typed (a report to answer, a schedule,
// a peer): Working, not idle. A job already done reopens to follow it, quietly.
async function mainAtWork($: EngineInterface): Promise<void> {
  const prev = await read($, manager)
  if (prev.isWorking && !prev.reportDue && !prev.doneAt) return
  await update($, manager, p => ({
    ...p,
    isWorking: true,
    reportDue: undefined,
    ...(p.doneAt ? { doneAt: undefined, celebrateUntil: undefined, isFollowUp: true } : {}),
  }))
}

// A typed request, or a slash command's turn, becomes the manager's job.
async function startJob($: EngineInterface, asked: string): Promise<void> {
  const at = await $.clock.now()
  const [info, prev, all, bg] = await Promise.all([read($, env), read($, manager), read($, agents), read($, background)])
  // The job before still held open by background work (an agent, a shell, a report
  // to answer) is carried: it is the one that finishes, under its own name. One the
  // person stopped (or that failed) is over: it is never carried to a cheer.
  const isOpen = Boolean(prev.task) && !prev.doneAt && !prev.outcome
  const before = isOpen ? crewOf(all, prev) : []
  const isHeld = isOpen && (before.some(isHolding) || bgBlocking(bg).length > 0 || Boolean(prev.reportDue))
  const carried: Manager['carried'] = isHeld
    ? {
        task: prev.carried?.task ?? prev.task,
        startedAt: prev.carried?.startedAt ?? prev.startedAt,
        costAtStart: prev.carried ? prev.carried.costAtStart : prev.costAtStart,
        ids: [...new Set([...(prev.carried?.ids ?? []), ...before.map(a => a.id)])].slice(-50),
      }
    : undefined
  await update($, manager, () => ({
    task: clip(asked.replace(/\s+/g, ' '), 300),
    isWorking: true,
    startedAt: at,
    plan: [],
    costAtStart: info.costUsd,
    tokensAtStart: sumTokens(info),
    ...(carried ? { carried, reportDue: prev.reportDue } : {}),
  }))
  // A reported flow belongs to the job it was reported for: an unrelated request
  // starts clean, not under an old title (finished, half done or stopped).
  if (!carried && (await read($, flow))) await update($, flow, () => null)
  await bumpToday($, { tasks: 1 })
  const auto = await readAutoCrew($)
  const reason = auto.on ? bigJobReason(asked, 0, 0, 101) : ''
  await update($, session, p => ({ ...p, crewMode: reason }))
  if (reason) $.ui.toast(`🦀 Big job (${reason}): summoning the crew`)
}

// What the band draws, from the state: one reading for its drawing and for the tick,
// so the tick moves exactly when the drawing would change. `isFull` reads what only
// the desktop's picture shows.
type BandInput = {
  reported: Flow | null
  boss: Manager
  all: AgentRun[]
  info: Env
  bg: Background
  watch?: Watch
  sess?: SessionStats
  day?: Today
}
const bandInput = async ($: EngineInterface, isFull: boolean): Promise<BandInput> => ({
  reported: await read($, flow),
  boss: await read($, manager),
  all: await read($, agents),
  info: await read($, env),
  bg: await read($, background),
  ...(isFull ? { watch: await read($, watch), sess: await read($, session), day: await read($, today) } : {}),
})

const bandView = (i: BandInput, bandAt: number, isWorkingProp: boolean) => {
  const { reported } = i
  const info = liveEnv(i.info, bandAt)
  const bandBoss = i.boss
  const f = reported ?? idleFlow()
  const tkBand = bandBudget(bandBoss, bandAt)
  const list = visibleCrew(i.all, bandBoss, bandAt)
  const crew = list.length + plannedOf(f, list).length
  const isWorking = isWorkingProp || list.some(a => a.status === 'running')
  const bgCount = i.bg.tasks.length + i.bg.crons.length
  // A job over but held open by background work reads "Waiting on N", never idle or done.
  const waitingOn = !isWorking && bandBoss.task && !bandBoss.doneAt ? bgBlocking(i.bg).length : 0
  const idleText = reported ? undefined : isWorking ? tr().working : waitingOn ? tr().bgWaiting(waitingOn) : tr().idle
  const base = { list, info, crew, isWorking, bgCount, waitingOn, idleText, tkBand }
  if (!i.watch || !i.sess || !i.day) return { ...base, hud: undefined }
  const sess = i.sess
  const boss = managerView(bandBoss, bandAt)
  const isParty = (bandBoss.celebrateUntil ?? 0) > bandAt
  const report = tokenReport(info, list, bandBoss, i.watch, bandAt)
  noteTypicalRun(list)
  const bandSteps = workSteps(reported, list, boss, bandAt)
  const five = (info.limits ?? []).find(l => l.kind === 'five_hour')
  const hud: HudData = {
    // A cast's boss goes by their own name.
    title: reported ? f.title : (SKIN.cast ? CASTS[SKIN.cast]?.bossName : undefined) ?? 'Claude',
    status: isParty ? 'Done!' : reported ? label(f) : isWorking ? 'Working' : waitingOn ? tr().bgWait : outcomeWord(bandBoss) || 'Idle',
    // The manager's own tool while its turn runs, else what a running agent does.
    activity: isWorking ? boss.activity || (list.find(a => a.status === 'running' && a.activity)?.activity ?? '') : waitingOn ? tr().bgWaiting(waitingOn) : boss.task ? '' : 'Waiting for your next request',
    progress: reported ? ratio(f) : isWorking ? managerProgress(null, list, boss, bandAt) : isParty ? 1 : null,
    progressAt: !reported && isWorking && !isParty ? managerEstimate(null, list, boss, bandAt) : undefined,
    isWorking,
    isParty,
    ctxPct: info.contextPct,
    limitPct: five ? five.percentUsed : null,
    burnPerMin: report.burnPerMin,
    mood: report.mood,
    crew: list
      .slice(-24)
      .map(a => ({ costume: costumeFor(a), color: runRoleColor(a), status: a.status })),
    roles: [...new Set(list.map(runRole))].map(role => {
      const members = list.filter(a => runRole(a) === role)
      return { role, color: members[0] ? runRoleColor(members[0]) : SKIN.colors.accent, count: members.length }
    }),
    steps: bandSteps.map(st => st.state),
    stepText: (bandSteps.find(st => st.state === 'running') ?? bandSteps.find(st => st.state === 'waiting') ?? bandSteps.at(-1))?.title.replace(/^\d+\.\s*/, '') ?? '',
    tip: report.tips[0] ?? { level: 0, text: 'Lean and on budget ✓' },
    today: todayOn(i.day, bandAt),
    crewMode: sess.crewMode ?? '',
    at: bandAt,
    model: info.model ? modelName(info.model) : '',
    effort: info.effort ? effortWord(info.effort) : '',
    folder: (info.cwd ?? '').split(/[\\/]/).filter(Boolean).at(-1) ?? '',
    taskMs: isWorking && boss.startedAt ? Math.max(0, bandAt - boss.startedAt) : 0,
    taskFrom: isWorking && boss.startedAt ? boss.startedAt : undefined,
    budget: tkBand,
    bg: bgCount,
    session: {
      turn: sess.turn,
      speed: sess.speed,
      turnCost: Math.max(0, info.costUsd - sess.costAtStart),
      total: info.costUsd,
      cacheLeft: sess.cacheUntil === null ? null : Math.max(0, Math.floor((sess.cacheUntil - bandAt) / 1000)),
      // The main conversation's cache: a background agent's requests do not keep it warm.
      isBusy: isWorkingProp || sess.isBusy,
      cacheUntil: sess.cacheUntil,
    },
  }
  return { ...base, hud }
}

// The band's reading of the time, as drawn: what self-ticking strips show is left out
// (they hold for their minute), what a second can change is kept as the band words it.
const bandReading = (v: ReturnType<typeof bandView>, at: number): string => {
  const hud = v.hud
  if (!hud) return JSON.stringify([v.crew, v.isWorking, v.idleText, v.tkBand && [budgetLabel(v.tkBand.usedMs, v.tkBand.min), budgetTone(v.tkBand.usedMs, v.tkBand.min)]])
  const ss = hud.session
  const left = ss.cacheLeft
  const cache = ss.isBusy || left === null || left === 0 ? cacheTextOf(ss.isBusy, left) : [left > 600, left > 1200]
  // A strip covers its wall minute: while one is drawn, each minute is a new drawing.
  const hasStrip = Boolean((!hud.budget && hud.taskMs > 0) || (!ss.isBusy && left) || hud.progressAt)
  return JSON.stringify([
    hasStrip || eggOf() ? wallMinute(at) : 0,
    dayOf(at),
    {
      ...hud,
      at: 0,
      taskMs: hud.taskMs > 0,
      taskFrom: 0,
      budget: hud.budget && [budgetLabel(hud.budget.usedMs, hud.budget.min), budgetTone(hud.budget.usedMs, hud.budget.min)],
      session: { ...ss, cacheLeft: cache },
      // A climbing guess steps inside the image: only news moves the reading.
      progress: hud.progressAt ? 'live' : hud.progress === null ? null : Math.round(hud.progress * 100),
      progressAt: 0,
    },
  ])
}

// The pane's reading of the time, as its pictures word it: the minute while a strip
// runs, and every label or threshold a second can move (a reset's minutes, a budget's
// tone, the burn, the clearing after the cheer).
const paneReading = (all: AgentRun[], rawBoss: Manager, info: Env, w: Watch, bg: Background, at: number, isLive: boolean): string => {
  const list = visibleCrew(all, rawBoss, at)
  const boss = managerView(rawBoss, at)
  info = liveEnv(info, at)
  const report = tokenReport(info, list, boss, w, at)
  const usedOf = (a: AgentRun) => elapsed(a, at)
  return JSON.stringify([
    isLive ? wallMinute(at) : 0,
    dayOf(at),
    isCleared(rawBoss, at),
    (rawBoss.celebrateUntil ?? 0) > at,
    (info.limits ?? []).map(l => [resetLabel(l.resetsAt, at), resetsIn(l.resetsAt, at)]),
    report.mood,
    report.tips.map(tp => tp.text),
    fmtTokens(report.burnPerMin),
    report.burnPerMin > 150_000,
    bg.at ? bgAgo(bg.at, at) : '',
    list.map(a => [a.isStuck ? Math.floor((at - (a.lastProgressAt ?? a.startedAt)) / 60_000) : 0, a.budgetMin ? budgetTone(usedOf(a), a.budgetMin) : '']),
    boss.budgetMin && boss.task && boss.startedAt ? budgetTone((boss.doneAt ?? at) - boss.startedAt, boss.budgetMin) : '',
  ])
}

// Moves the band's and the pane's ticks when, and only when, what they draw from the
// time reads differently: a second passing alone draws nothing on the desktop.
// Handed what the tick already read. The rest is read every few seconds: a write
// redraws its readers by itself, so the tick only has to catch what the time moves.
const TICK_READ_EVERY = 5
let restTicks = 0
let tickRead: { reported: Flow | null; info: Env; w: Watch; n: number } | null = null
async function retick($: EngineInterface, at: number, isLive: boolean, got: Pick<BandInput, 'boss' | 'all' | 'bg' | 'sess'>): Promise<void> {
  if (!tickRead || ++tickRead.n >= TICK_READ_EVERY) {
    const [reported, info, w] = await Promise.all([read($, flow), read($, env), read($, watch)])
    tickRead = { reported, info, w, n: 0 }
  }
  const { reported, info, w } = tickRead
  // Today's counts are data, never the time's: left out of the reading.
  const band = bandView({ ...got, reported, info, watch: w, day: BLANK_TODAY }, at, isLive)
  if (isNewReading('band', bandReading(band, at))) await update($, bandTick, () => at)
  if (isNewReading('pane', paneReading(got.all, got.boss, info, w, got.bg, at, isLive))) await update($, paneTick, () => at)
}

export const register: Register = (on, options) => {
  timekeeperHooks(on)
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    lang = await detectLang($, options.language)
    // One ticker for every drawing. `now` moves each second only while something on
    // screen moves (work, a crew, the party, the cache's last ten minutes), else once a
    // minute; the cache's minutes and the stuck alarm ride on the same tick.
    $.clock.every(1000, () => {
      void (async () => {
        const at = await $.clock.now()
        const [st, list, boss, last, bg] = await Promise.all([read($, session), read($, agents), read($, manager), read($, now), read($, background)])
        const left = st.cacheUntil === null ? null : Math.max(0, Math.floor((st.cacheUntil - at) / 1000))
        const isRunning = list.some(a => a.status === 'running')
        const isParty = (boss.celebrateUntil ?? 0) > at - 2000 || (Boolean(boss.doneAt) && at < (boss.doneAt ?? 0) + CELEBRATE_MS + 2000)
        // Past expiry it ticks once more, so the band reaches "expired" rather than stopping at 00:01.
        const isCacheClose = st.cacheUntil !== null && left !== null && left <= 600 && !st.isBusy && last < st.cacheUntil
        const isLive = boss.isWorking || st.isBusy || isRunning || isParty || isCacheClose
        if (isLive || at - last >= 60_000) await update($, now, () => at)
        await keepTime($, at)
        // At rest only minute labels move: a look every few seconds is soon enough.
        if (isLive || ++restTicks % TICK_READ_EVERY === 0) await retick($, at, isLive, { boss, all: list, bg, sess: st }).catch(() => undefined)
        const due = CACHE_WARN_MIN.filter(m => left !== null && left > 0 && left <= m * 60)
        if (due.length && !st.isBusy) {
          const minutes = Math.min(...due)
          if (st.warned === 0 || st.warned > minutes) {
            await update($, session, prev => ({ ...prev, warned: minutes }))
            $.ui.toast(`⧗ Prompt cache expires in ${Math.ceil((left ?? 0) / 60)} min`, { timeoutMs: 30000 })
          }
        }
        // Check in about agents that have been silent an hour: the job stays open, the
        // person decides. Once per quiet hour per agent.
        // A report no main turn came to answer lets the job finish after all.
        if (boss.reportDue && !boss.isWorking && !boss.doneAt && at - boss.reportDue >= REPORT_WAIT_MS) await finishIfIdle($).catch(() => undefined)
        const quietDue = list.filter(a => isDueCheckIn(a, list, at))
        if (quietDue.length) {
          const dueIds = new Set(quietDue.map(a => a.id))
          await update($, agents, l => l.map(a => (dueIds.has(a.id) ? { ...a, checkedInAt: at } : a)))
          const what = quietDue.length === 1 ? `"${clip(quietDue[0]?.description || quietDue[0]?.type || 'An agent', 40)}" has` : `${quietDue.length} agents have`
          $.ui.toast(`⧗ ${what} been quiet for ${fmtTime(at - lastSeen(quietDue[0] as AgentRun))}. Still holding the job open. /missioncontrol release lets it go.`, { timeoutMs: 60000 })
          void $.ui.notify(`Mission Control: ${what} been quiet for an hour. Is it still working?`).catch(() => undefined)
        }
        // The same for background work holding a job open: no new status for an hour
        // asks the person, once per quiet hour; it is never let go on its own.
        const bgDue = boss.task && !boss.doneAt ? bgDueCheckIn(bg, at) : []
        if (bgDue.length) {
          const dueIds = new Set(bgDue.map(t => t.id))
          await update($, background, b => ({ ...b, tasks: b.tasks.map(t => (dueIds.has(t.id) ? { ...t, checkedInAt: at } : t)) }))
          const first = bgDue[0] as BgTask
          const what = bgDue.length === 1 ? `Background ${first.type} "${bgName(first)}" has` : `${bgDue.length} background tasks have`
          $.ui.toast(`⧗ ${what} been quiet for ${fmtTime(at - (first.seenAt ?? bg.at))}. Still holding the job open. /missioncontrol release lets it go.`, { timeoutMs: 60000 })
          void $.ui.notify(`Mission Control: ${what} been quiet for an hour. Is it still working?`).catch(() => undefined)
        }
        const stuck = list.filter(a => a.status === 'running' && !a.isStuck && at - heardAt(a, list, at) > STUCK_MS)
        if (!stuck.length) return
        const ids = new Set(stuck.map(a => a.id))
        await update($, agents, l => l.map(a => (ids.has(a.id) ? { ...a, isStuck: true } : a)))
        for (const a of stuck) $.ui.toast(`🦀 "${clip(a.description || a.type, 40)}" has gone quiet for 2 min: it may be stuck`)
      })()
    })
    await $.tool.register({
      name: 'progress',
      description:
        'Optional: show a multi-agent plan in Mission Control (the band above the prompt and the pane). ' +
        'Send the plan once it is set (title, total, tasks), then update done as tasks finish, tasks when the plan changes, ' +
        'and finished: true at the end. Any field you leave out keeps its last value. ' +
        'Main session only; subagents report their own progress with `step`.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name of the overall task, a few words.' },
          total: { type: 'integer', minimum: 0, description: 'Number of planned worker tasks.' },
          done: { type: 'integer', minimum: 0, description: 'How many tasks are finished.' },
          phase: { type: 'string', enum: [...PHASES] },
          finished: { type: 'boolean', description: 'True once the plan is done.' },
          minutes: { type: 'integer', minimum: 1, description: 'Time budget for the whole job, in minutes. Mission Control alerts at 80% and when it is passed.' },
          tasks: {
            type: 'array',
            description:
              'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
                tier: { type: 'string', enum: [...TIERS], description: 'Worker size: fable, heavy, careful, medium or light.' },
                after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
                minutes: { type: 'integer', minimum: 1, description: "Time budget for this task, in minutes; its sub-agent is flagged once it runs past it. Without the plan's own `minutes`, the tasks' sum is the job's budget." },
              },
              required: ['title', 'tier'],
            },
          },
        },
      },
    }).catch(() => undefined)
    await $.tool.register({
      name: 'step',
      description:
        'For subagents: show progress on your own task in Mission Control. ' +
        'Once you know your plan, send `total` (3 to 8 steps) with `done: 0`, ' +
        'then send `done` again after each step. It only moves a progress bar; nothing else happens.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
      // In every agent's tool list, not behind ToolSearch: workers do not go looking for it.
      isDeferred: false,
    }).catch(() => undefined)
    await $.command.register({
      name: 'missioncontrol',
      description: 'Open Mission Control: usage, workflow, the manager and its sub-agents, your answer rules and settings',
    }).catch(() => undefined)
    await $.command.register({
      name: 'prefs',
      description: 'Memory: how Claude should answer you, in every session. /prefs, /prefs add <rule>, /prefs remove <n>, /prefs clear',
    }).catch(() => undefined)
    const rules = await loadRules($)
    await update($, memory, () => rules)
    await refreshEnv($, true)
    // A reload, or a resumed session, starts counting mid-conversation: the turn count
    // picks up from the prompts already sent, and the turn's cost from what is already
    // spent. Left at zero, the band read "TURN 0" beside the whole session's cost.
    const spentAtLoad = (await read($, env)).costUsd
    const isReload = (await read($, session)).turn > 0 || (await read($, today)).date !== ''
    const promptsSoFar = isReload ? 0 : await $.session
      .messages()
      .then(ms => (Array.isArray(ms) ? ms.filter(m => m.role === 'user' && !m.toolResults?.length && m.text.trim() !== '').length : 0))
      .catch(() => 0)
    await update($, session, prev => (prev.turn ? prev : { ...prev, turn: promptsSoFar, costAtStart: spentAtLoad }))
    await $.command.register({
      name: 'skins',
      description: 'Open the skin picker: every skin as a live preview, one click to put it on',
    }).catch(() => undefined)
    await $.command.register({
      name: 'skin',
      description: 'Skins: /skin to list, /skin <name> to switch, /skin reload after editing a file in Custom Claude Skins',
    }).catch(() => undefined)
    await loadSkins($)
    await checkAddon($)
    const chosen = await $.store.get('skin').catch(() => undefined)
    const worn = typeof chosen === 'string' ? SKINS.get(chosen) : undefined
    // A cyberpunk skin saved before the add-on was removed falls back to the classic.
    if (worn && canWear(worn)) {
      applySkin(worn)
      await update($, skin, () => worn.id)
    } else if (worn) {
      applySkin(CRAB_SKIN)
      await update($, skin, () => CRAB_SKIN.id)
    }
    const greet = eggOf()
    if (greet && !isReload) $.ui.toast(GREETING[greet])
    await $.command.register({
      name: 'autocrew',
      description: 'Crew mode for big jobs: /autocrew for its state, /autocrew on|off, /autocrew <context %> to call the crew',
    }).catch(() => undefined)
    await $.command.register({
      name: 'tokens',
      description: 'Token Manager: /tokens for a report, /tokens budget <dollars|off>, /tokens autopilot <on|off>',
    }).catch(() => undefined)
    await startTimekeeper($).catch(() => undefined)
    const autopilot = (await $.store.get('autopilot').catch(() => false)) === true
    const budget = Number(await $.store.get('budgetUsd').catch(() => 0)) || 0
    await update($, watch, prev => ({ ...prev, autopilot, budgetUsd: budget }))
    if (!isReload) await loadAllTime($)
    const savedDay = (await $.store.get('today').catch(() => undefined)) as Today | undefined
    const startedAt = await $.clock.now()
    // A reload keeps the counts $.state still holds: the store is only written at a turn's end.
    if (!isReload || (await read($, today)).date !== dayOf(startedAt)) {
      const day = savedDay && savedDay.date === dayOf(startedAt) ? savedDay : { ...BLANK_TODAY, date: dayOf(startedAt) }
      await update($, today, () => day)
      // What the store held: this session's later saves add only their own share to it.
      await update($, saved, prev => ({ ...prev, today: day }))
    }
    // The pane opens with the session unless the person turned that off in Settings.
    const prefs = await readSettings($)
    await update($, settings, () => prefs)
    const savedCred = cleanCred(await $.store.get('cred').catch(() => undefined))
    await update($, cred, () => savedCred)
    if (prefs.openOnStart && !isReload) void $.ui.open({ id: PANE, title: SKIN.tabs.mission }).catch(() => undefined)

    return started
  })

  on('command.run', { command: 'missioncontrol' }, async ($, e) => {
    // Anything starting with "currency" is a currency request: a bad one gets an error, never "opened".
    const money = /^currency(?:\s+(\S+))?(?:\s+(\S+))?(\s.*)?$/i.exec((e.args ?? '').trim())
    if (money) {
      if (!money[1]) return { text: `Currency: ${currencyLabel(CURRENCY)}\nPick one: ${CURRENCIES.map(c => c.code).join(', ')} — /missioncontrol currency <code> [rate per US dollar]` }
      const found = CURRENCIES.find(c => c.code === money[1]?.toUpperCase() || c.symbol === money[1])
      if (!found) return { text: `Unknown currency "${money[1]}". Pick one: ${CURRENCIES.map(c => c.code).join(', ')}` }
      if (money[3]) return { text: `Too many words. Use /missioncontrol currency <code> [rate per US dollar].` }
      const rate = money[2] ? Number(money[2]) : undefined
      if (money[2] && !(/^\d+(\.\d+)?$|^\.\d+$/.test(money[2]) && Number.isFinite(rate) && (rate as number) > 0)) {
        return { text: `"${money[2]}" is not a rate: give a positive number of ${found.code} per US dollar, e.g. /missioncontrol currency ${found.code.toLowerCase()} 0.92` }
      }
      await setCurrency($, currencyOf(found.code, rate))
      return { text: `Costs now show in ${currencyLabel(CURRENCY)}.` }
    }
    // `/missioncontrol` and `/missioncontrol open` open the panel, or bring it forward
    // from behind another tab, without toggling it. Anything else gets the usage line.
    const verb = (e.args ?? '').trim()
    // Release: the person lets go of running agents that went silent, so the job can finish.
    if (verb.toLowerCase() === 'release') {
      const at = await $.clock.now()
      const all = await read($, agents)
      const quiet = all.filter(a => a.status === 'running' && at - heardAt(a, all, at) >= STUCK_MS)
      // Background tasks too: one with no new status for as long is let go (still
      // listed, marked released) so it stops holding the job.
      const bgNow = await read($, background)
      const quietBg = bgBlocking(bgNow).filter(t => at - (t.seenAt ?? bgNow.at) >= STUCK_MS)
      if (!quiet.length && !quietBg.length) return { text: 'No quiet agents to release: everything still running has reported in the last 2 minutes.' }
      const ids = new Set(quiet.map(a => a.id))
      // Let go by the person: stopped, not failed, so the job is not marked an error.
      if (ids.size) await update($, agents, l => l.map(a => (ids.has(a.id) ? { ...a, status: 'stopped', endedAt: at, isStuck: false, activity: 'released: no word back' } : a)))
      const bgIds = new Set(quietBg.map(t => t.id))
      if (bgIds.size) await update($, background, b => ({ ...b, tasks: b.tasks.map(t => (bgIds.has(t.id) ? { ...t, released: true } : t)) }))
      await finishIfIdle($).catch(() => undefined)
      const said = [
        quiet.length ? `Released ${quiet.length} quiet agent${quiet.length === 1 ? '' : 's'}: ${quiet.map(a => clip(a.description || a.type, 30)).join(', ')}.` : '',
        quietBg.length ? `Released ${quietBg.length} background task${quietBg.length === 1 ? '' : 's'}: ${quietBg.map(bgName).join(', ')}.` : '',
      ]
      return { text: said.filter(Boolean).join(' ') }
    }
    if (verb !== '' && verb.toLowerCase() !== 'open') return { text: `Unknown option "${verb}". Use /missioncontrol, /missioncontrol open, /missioncontrol release or /missioncontrol currency <code> [rate per US dollar].` }
    const at = await $.clock.now()
    await update($, now, () => at)
    const shown = await showPane($, PANE, SKIN.tabs.mission)
    return { text: shown.isPlaced ? tr().opened : `Mission Control is open but not shown: ${shown.reason}` }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    // The flow is the main session's: a call from a worker's loop carries its agentId
    // and changes nothing, or any subagent could rename, finish or reset the flow.
    if (e.agentId) return { result: 'ignored: only the main session reports the flow' }
    const input = e as unknown as ProgressInput
    // A new title keeps the request's agents: a scout that finished before the plan
    // was reported is still part of this job, its tokens and cost too.
    const next = await update($, flow, p => merge(p, input))
    await notePlanBudget($, next)
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank())}` }
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    let matched = false
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        matched = true
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: matched ? 'ok' : `ignored: no panel row for agent ${agentId}` }
  })

  // What everyone is doing right now, from each tool call: the live activity line,
  // and the heartbeat the stuck alarm reads. Never in the way of the call itself.
  on('tool.call', async ($, e, next) => {
    const tracking = trackTool($, e)
    try {
      const [result] = await Promise.all([next(e), tracking])
      return result
    } finally {
      if (e.agentId) await tracking.then(() => endTool($, e.agentId as string))
    }
  })

  // The manager's task list, followed as the plan tool is called; wrap-up closes it.
  on('tool.call', { tool: PLAN_TOOL }, async ($, e, next) => {
    // Never in the way: a failure here must not block the plan tool itself.
    if (!e.agentId) {
      const completed = (plan: PlanStep[] | undefined) => (plan ?? []).filter(st => st.status === 'completed').length
      let isStep = false
      await update($, manager, prev => {
        const plan = applyPlan(prev.plan ?? [], e as unknown as PlanInput)
        isStep = completed(plan) > completed(prev.plan)
        return { ...prev, plan }
      }).catch(() => undefined)
      if (isStep && eggOf()) void play($, `${ADDON}/assets/step.wav`)
    }
    return next(e)
  })
  on('tool.call', { tool: WRAP_TOOL }, async ($, e, next) => {
    if (!e.agentId) await update($, manager, prev => ({ ...prev, plan: (prev.plan ?? []).map(st => ({ ...st, status: 'completed' as const })) })).catch(() => undefined)
    return next(e)
  })

  // Safety net: mc-* launches move the faint layer even if the main session forgets to report.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!isWorker(type)) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, running: base.running + 1, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    try {
      return await next(e)
    } finally {
      await update($, flow, prev => (prev ? { ...prev, running: Math.max(0, prev.running - 1) } : prev))
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const isUnbriefed = isWorker(e.subagentType) && !e.prompt.includes(STEP_TOOL)
    const briefed = isUnbriefed ? { ...e, prompt: e.prompt + STEP_BRIEF } : e
    // Autopilot: read-only explorers go to Haiku, unless a model was chosen for them.
    const w = await read($, watch)
    const isReadOnly = e.subagentType === 'Explore'
    const routed = w.autopilot && isReadOnly && !e.model ? { ...briefed, model: 'haiku' } : briefed
    if (routed !== briefed) $.ui.toast(`Token Manager: "${clip(e.description, 30)}" runs on Haiku`)
    const started = await next(routed)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    const boss = await read($, manager)
    let isNew = false
    let isRetry = false
    // A resumed agent (SendMessage, a teammate woken) is the same row going back to
    // work: its tokens, cost, clock and round kept, and no new agent counted.
    const resumed = e.resume?.agentId
    await update($, agents, list => {
      const was = resumed ? list.find(a => a.agentId === resumed || a.id === resumed) : undefined
      if (was) {
        isNew = false
        return list.map(a => (a === was ? { ...a, status: 'running' as const, endedAt: undefined, isStuck: false, toolsInFlight: 0, lastProgressAt: at } : a))
      }
      // A retry is the same task tried again in this job after an earlier try ended:
      // a workflow's parallel workers and repeats from other prompts are none.
      const since = boss.startedAt ? boss.startedAt - 1000 : 0
      const tries = e.workflow || !e.description ? [] : list.filter(a => a.startedAt >= since && a.status !== 'running' && norm(a.description) === norm(e.description))
      const round = 1 + tries.length
      isNew = !list.some(a => a.id === (started.agentId ?? e.tool_use_id))
      isRetry = round > 1
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
        parentAgentId: e.parentAgentId,
        // Its end queues a report the main loop answers in a turn of its own (one an
        // agent started reports to that agent, a workflow's to its script).
        ...(e.background && !e.workflow && !e.parentAgentId ? { isBackground: true } : {}),
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    // Street Cred counts each agent that really started once; a retry of the same job earns no XP.
    if (isNew) await bumpCred($, c => ({ ...c, agents: c.agents + 1, xp: c.xp + (isRetry ? 0 : 2) })).catch(() => false)
    await update($, now, () => at)
    if (isNew) await bumpToday($, { agents: 1 })
    if (isWorker(e.subagentType)) {
      const f = await read($, flow)
      await autoOpen($, f && !f.isFinished ? f.title : 'mission-control')
    } else if (options.autoOpen === 'any') {
      await autoOpen($, 'any-agent')
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      const total = (await $.session.usage().catch(() => null))?.cost?.usd ?? (await read($, env)).costUsd
      await update($, session, prev => ({ ...prev, turn: prev.turn + 1, costAtStart: total, isBusy: true }))
      // A slash command's turn is its job; any other main turn is the manager at work.
      if (pendingCommand) {
        const task = pendingCommand
        pendingCommand = ''
        await startJob($, task).catch(() => undefined)
      } else await mainAtWork($).catch(() => undefined)
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    // Timed from the response's first chunk, so the wait for the first token is left out.
    const stream = next(e)
    let firstAt: number | null = null
    let stampedAt = 0
    let step = await stream.next()
    while (!step.done) {
      const chunkAt = await $.clock.now()
      if (firstAt === null) firstAt = chunkAt
      // An agent streaming one long response is at work: a sign of life every 10 s.
      if (e.agentId && chunkAt - stampedAt >= 10_000) {
        stampedAt = chunkAt
        const id = e.agentId
        // Each stamp redraws the crew, and a fresh one is not drawn: stamp only once the
        // last sign of life is half a minute old, well inside the alarm's two minutes.
        const run = (await read($, agents).catch(() => [] as AgentRun[])).find(a => a.agentId === id)
        if (run && (run.isStuck || chunkAt - lastSeen(run) >= STAMP_STALE_MS))
          await update($, agents, list => (list.some(a => a.agentId === id) ? list.map(a => (a.agentId === id ? { ...a, lastProgressAt: chunkAt, isStuck: false } : a)) : list)).catch(() => undefined)
      }
      yield step.value
      step = await stream.next()
    }
    const result = step.value
    const agentId = e.agentId
    if (!agentId && firstAt !== null && result.usage) {
      const out = result.usage.output_tokens || 0
      const seconds = ((await $.clock.now()) - firstAt) / 1000
      const speed = out / seconds
      if (out >= SPEED_MIN_TOKENS && seconds >= SPEED_MIN_SECONDS && speed <= 1000) await update($, session, prev => ({ ...prev, speed: Math.round(speed) }))
    }
    const usage = result.usage
    if (usage) {
      const burned =
        (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
      const stepAt = await $.clock.now()
      const prompt = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
      await update($, watch, prev => ({
        ...prev,
        burn: [...prev.burn.filter(b => b.at > stepAt - BURN_WINDOW), { at: stepAt, n: burned }].slice(-400),
        cacheRead: prev.cacheRead + (usage.cache_read_input_tokens || 0),
        promptAll: prev.promptAll + prompt,
      }))
      await bumpToday($, { tokens: burned })
      const model = usage.model || e.model
      if (burned && model) {
        await update($, env, prev => ({ ...prev, modelTokens: { ...(prev.modelTokens ?? {}), [model]: ((prev.modelTokens ?? {})[model] ?? 0) + burned } }))
        await update($, allTime, prev => ({ since: prev.since || new Date(stepAt).toISOString(), models: { ...prev.models, [model]: (prev.models[model] ?? 0) + burned } }))
      }
    }
    if (!agentId) {
      await refreshEnv($)
      const egg = eggOf()
      const ctx = (await read($, env)).contextPct
      if (ctx >= 90 && !(await read($, cred)).chromed) await bumpCred($, c => (c.chromed ? c : { ...c, chromed: true, xp: c.xp + 20 })).catch(() => false)
      if (ctx < 90) sirenPlayed = false
      else if (egg && ctx >= 95 && !sirenPlayed) {
        sirenPlayed = true
        void play($, `${ADDON}/assets/maxtac.wav`)
      }
      if (ctx < 80) psyWarned = false
      else if (egg && ctx >= 85 && !psyWarned) {
        psyWarned = true
        $.ui.toast(`⚠ Cyberpsychosis risk: context ${ctx}%. Take your immunosuppressants: /compact`)
      }
      if (typeof e.effort === 'string') {
        const effort = e.effort
        if ((await read($, env)).effort !== effort) await update($, env, prev => ({ ...prev, effort }))
      }
      return result
    }
    // A sub-agent's spend moves the session's cost, budget and limits too.
    await refreshEnv($)
    if (!usage) return result

    const model = usage.model || e.model
    const seenAt = await $.clock.now()
    await update($, agents, list =>
      list.map((a): AgentRun =>
        a.agentId !== agentId
          ? a
          : {
              ...a,
              model,
              effort: typeof e.effort === 'string' ? e.effort : a.effort,
              status: 'running',
              endedAt: undefined,
              contextTokens:
                (usage.input_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.output_tokens || 0),
              contextMax: windowOf(model),
              tokens:
                a.tokens +
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0),
              costUsd: a.costUsd + costOf(model, usage, true),
              steps: a.steps + 1,
              lastProgressAt: seenAt,
              isStuck: false,
            },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (!agentId) {
      const doneAt = await $.clock.now()
      await update($, session, prev => ({ ...prev, cacheUntil: doneAt + CACHE_TTL_MS, cacheLeft: CACHE_TTL_MS / 1000, isBusy: false, warned: 0 }))
    }
    if (agentId) {
      const at = await $.clock.now()
      let reported = false
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          if (a.isBackground && a.status === 'running') reported = true
          return {
            ...a,
            // Esc ends it stopped (neutral); an API error or a refusal, failed.
            status: e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed',
            endedAt: at,
            isStuck: false,
            toolsInFlight: 0,
            ...(fallback && e.usage
              ? {
                  model: e.usage.model || a.model,
                  tokens:
                    e.usage.input_tokens +
                    e.usage.output_tokens +
                    e.usage.cache_read_input_tokens +
                    e.usage.cache_creation_input_tokens,
                  costUsd: costOf(e.usage.model || a.model, e.usage, false),
                }
              : {}),
          }
        }),
      )
      // A background agent's report now waits on the main loop: not done until answered.
      if (reported && (await read($, manager)).task) await update($, manager, prev => (prev.doneAt ? prev : { ...prev, reportDue: at }))
      await update($, now, () => at)
    }
    const done = await next(e)
    if (!agentId) {
      await refreshEnv($)
      // Esc ends the job stopped; an API error or a refusal, in error. Never cheered.
      const outcome = e.reason === 'aborted' ? 'stopped' : e.reason === 'error' || e.reason === 'refusal' ? 'error' : undefined
      await update($, manager, prev => ({ ...prev, isWorking: false, activity: '', ...(outcome && prev.task && !prev.doneAt ? { outcome: prev.outcome ?? outcome } : {}) }))
    }
    // Saved at every end, a sub-agent's too: its tokens are no less spent.
    await saveTotals($)
    await finishIfIdle($).catch(() => undefined)
    return done
  })

  // The session ends (an exit, a /clear, a signal): today's share is saved first. A
  // /clear (or an in-process resume) goes on as another conversation: start clean.
  on('session.end', async ($, e, next) => {
    await saveTotals($)
    if (e.reason === 'clear' || e.reason === 'resume') {
      pendingCommand = ''
      await update($, session, () => ({ ...BLANK_SESSION, costAtStart: 0 }))
      await update($, manager, () => BLANK_MANAGER)
      await update($, agents, () => [])
      await update($, flow, () => null)
      await update($, timeline, () => [])
      await update($, bdPick, () => -1)
    }
    return next(e)
  })

  // The engine says the usage moved (a sub-agent's spend, a limit window): read it now.
  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    await refreshEnv($)
    return measured
  })

  // Only these two hooks list the background work. Observers: they note the lists,
  // finish a job the last task held open, and hand the event on untouched. A hook
  // that throws or overruns anyway is caught and the stop passed on as it came.
  on('classic.Stop', async ($, e, next) => {
    await noteBackground($, e).catch(() => undefined)
    await finishIfIdle($).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.SubagentStop', async ($, e, next) => {
    // The subagent that is stopping may still be listed as running: leave it out.
    await noteBackground($, e, e.agent_id).catch(() => undefined)
    await finishIfIdle($).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await useSkin($)
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const allAgents = await read($, agents)
    const rawBoss = await read($, manager)
    // The real time, for the reset countdowns and the clearing: `now` only moves while agents run.
    const clockNow = await $.clock.now().catch(() => Math.max(0, ...allAgents.map(a => a.startedAt)))
    const list = visibleCrew(allAgents, rawBoss, clockNow)
    const boss = managerView(rawBoss, clockNow)
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    // The desktop's tick moves only when what the pane draws from the time changes;
    // its clocks tick inside the images. The terminal's text clocks read each second.
    const isPicture = e.surface === 'desktop' && 'Svg' in ui
    const at = isPicture ? ((await read($, paneTick)), clockNow) : Math.max(await read($, now), ...list.map(a => a.startedAt), 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at)
    const info = liveEnv(await read($, env), clockNow)
    const rules = await read($, memory)
    const opened = new Set(p.expanded ?? [])
    const rows = buildTree(list, p.isDoneCollapsed)
    // On a desktop only the first few running agents get a card; the rest fold into
    // one row, so a big crew stays under the app's size limit. A card that ends
    // hands its place to the next.
    const spare = e.surface === 'desktop' ? rows.flatMap(r => (r.kind === 'agent' && r.a.status === 'running' ? [r.a] : [])).slice(MAX_CARDS) : []
    const tree = (spare.length ? withoutRows(rows, new Set(spare.map(a => a.id))) : rows).map(r =>
      r.kind === 'agent' ? { ...r, folded: r.a.status !== 'running' && !opened.has(r.a.id) } : r,
    )
    const toggleOpen = (id: string) =>
      update($, panel, prev => {
        const set = new Set(prev.expanded ?? [])
        if (set.has(id)) set.delete(id)
        else set.add(id)
        return { ...prev, expanded: [...set].slice(-50) }
      })
    noteTypicalRun(allAgents)
    const steps = workSteps(f, list, boss, clockNow)
    const tw = await read($, watch)
    const every = await read($, allTime)
    const day = todayOn(await read($, today), clockNow)
    const legends = cleanLegends(await $.store.get('legends').catch(() => []))
    const prefs = await read($, settings)
    const tkNow = await read($, timekeeper)
    // Only the cyberpunk skins draw these: elsewhere each tool call's replay beat
    // would draw the pane again for nothing.
    const hasEggs = Boolean(eggOf())
    const streetCred = hasEggs ? await read($, cred) : BLANK_CRED
    const beats = hasEggs ? await read($, timeline) : []
    const pick = hasEggs ? await read($, bdPick) : -1
    const report = tokenReport(info, list, boss, tw, clockNow)
    const org = orgTree(list, boss, clockNow, report.mood)
    const bgList = await read($, background)
    const bg = bgRows(bgList)
    const ago = bgAgo(bgList.at, clockNow)
    // The job in hand is over but background work holds it open: say so, not "Idle".
    const waitingOn = boss.task && !boss.isWorking && !boss.doneAt ? bgBlocking(bgList).length : 0
    const isWorking = running.length > 0 || Boolean((e.props as { isWorking?: boolean }).isWorking)
    // The manager's card says Working while its crew still works, a background agent
    // after the turn too: the same as the band.
    const bossCard: Manager = !boss.isWorking && running.length ? { ...boss, isWorking: true } : boss
    const quietCount = running.filter(isQuiet).length
    // The pane's title says "Agents"; inside, only the flow's own name.
    const title = f && !f.isFinished ? f.title : ''

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? s.expand : s.collapse}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? (isRtl() ? '◂' : '▸') : '▾'} ${s.finished} · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const isEmpty = list.length === 0 && planned.length === 0
    const summary = `≈${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} ${s.tokensWord}, ${fmtTime(t.time)}`

    if (isPicture && 'Svg' in ui) {
      const { Svg } = ui
      // Each card keeps its source while it reads the same: no new image, no restart.
      const keep = <T,>(tree: T): T => steadyTree(tree, `pane:${e.surface}`, clockNow)
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      // Section labels in the skin's colours; the classic skins keep the app's dim grey.
      const section = (key: string, text: string) =>
        SKIN.dark ? (
          <Box key={key} marginTop={1} marginBottom={1}>
            <Text color={SKIN.colors.accent} bold>
              {`▍${text}`}
            </Text>
          </Box>
        ) : (
          <Box key={key} marginTop={1} marginBottom={1}>
            <Text dimColor>{text}</Text>
          </Box>
        )

      // In Hebrew the column hugs the right edge: section heads and buttons right-aligned.
      const align = isRtl() ? 'flex-end' : undefined
      const orgPicture = (source: string) => (
        <Svg
          key="org"
          source={source}
          alt={`Hierarchy: Manager, then ${org.children.map(r => `${r.label} (${r.children.length})`).join(', ') || 'no roles yet'}`}
          width={W}
          height={orgHeight(org)}
        />
      )
      // The short view. Forced when the full one is too big for the app to draw: it
      // keeps the crew's picture and offers the ways back to the full view.
      const compactView = (picture?: string) => (
        <Box flexDirection="column" gap={1} alignItems={align} {...(SKIN.backdrop.fill ? { backgroundColor: SKIN.backdrop.fill } : {})}>
          <Svg source={compactSvg(W, list, planned, t, clockNow)} alt={`${list.length} ${s.agentsCount}${quietCount ? `, ⚠ ${quietCount} quiet` : ''}, ${summary}`} width={W} height={32} />
          {picture === undefined ? (
            toggleCompact
          ) : (
            <Box flexDirection="column">
              <Text dimColor>Too many agents to draw in full: this is the short view.</Text>
              <Box flexDirection="row" gap={2}>
                {opened.size > 0 && <Button key="fold-all" label="Fold the opened agents" plain onPress={() => update($, panel, prev => ({ ...prev, expanded: [] }))} />}
                {finished.length > 0 && !p.isDoneCollapsed && toggleDone}
              </Box>
            </Box>
          )}
          {picture ? orgPicture(picture) : null}
          <Svg source={sessionSvg(W, info, rules, isWorking)} alt={sessionAlt(info, rules)} width={W} height={sessionHeight(W, info, rules)} />
        </Box>
      )
      if (p.isCompact) return keep(compactView())
      const egg = eggOf()
      // A skin with a backdrop paints the pane body behind the cards.
      const fill = SKIN.backdrop.fill
      // A row's own drawing does not change when the rows around it go: drawn once.
      const drawings = new Map<string, string>()
      const drawn = (key: string, draw: () => string): string => drawings.get(key) ?? drawings.set(key, draw()).get(key) ?? ''
      const moreRow = (some: AgentRun[], isLive: boolean) =>
        some.length > 0 && <Svg key={isLive ? 'more-working' : 'more-done'} source={moreSvg(W, some, isLive)} alt={moreAlt(some, isLive)} width={W} height={FOLD_H} />
      // The cards stack in plain flow: the desktop pane draws nothing for a tree that
      // lays them over a full-height grid with an absolute Box.
      const full = (picture: string, shown: TreeRow[], done: AgentRun[]) => (
        <Box flexDirection="column" {...(fill ? { backgroundColor: fill } : {})}>
          <Box flexDirection="column" alignItems={align}>
            {egg ? (
              <Box key="boot" marginBottom={1}>
                <Svg
                  source={bootStrip(W, SKIN.colors, FONT, 'JACKING IN…', egg === 'corpo' ? 'ARASAKA NETWORK › IDENTITY VERIFIED › ACCESS GRANTED' : egg === 'samurai' ? 'WAKE UP, SAMURAI › AMPS ON › LIVE AT THE ATLANTIS' : egg === 'netrun' ? 'JACKED IN › DIVING THE NET › ICE BYPASSED' : 'LINK ESTABLISHED › NEURAL HANDSHAKE OK › ICE BYPASSED')}
                  alt="Mission Control online"
                  width={W}
                  height={BOOT_H}
                />
              </Box>
            ) : null}
            <Box key="usage" marginBottom={1}>
              <Svg
                source={usageSvg(W, info, clockNow, every)}
                alt={usageAlt(info)}
                width={W}
                height={usageHeight(info, every)}
              />
            </Box>
            <Box key="today" marginBottom={1}>
              <Svg source={todaySvg(W, day)} alt={`Today: ${day.tasks} tasks, ${day.agents} agents, ${fmtTokens(day.tokens)} tokens, ≈${fmtCost(day.costUsd)}`} width={W} height={TODAY_H} />
            </Box>
            {egg ? (
              <Box key="cred" marginBottom={1}>
                <Svg
                  source={credCard(W, streetCred, SKIN.colors, FONT, cardShape, egg === 'samurai' ? 'ROCKERBOY CRED' : 'STREET CRED', 'ストリートクレッド', egg === 'samurai' ? rockerRankOf : rankOf)}
                  alt={`Level ${levelOf(streetCred.xp)} ${(egg === 'samurai' ? rockerRankOf : rankOf)(levelOf(streetCred.xp))}, ${streetCred.xp} XP, ${streetCred.badges.length} badges`}
                  width={W}
                  height={credHeight(W)}
                />
              </Box>
            ) : null}
            <Box key="workflow" marginBottom={1}>
              <Svg
                source={workflowSvg(W, f, steps, clockNow)}
                alt={`Workflow: ${steps.map(st => `${st.title} ${st.state}`).join(', ') || 'nothing running'}`}
                width={W}
                height={workflowHeight(steps)}
              />
            </Box>
            {bg.length > 0 && (
              <Box key="background" marginBottom={1}>
                <Svg source={bgSvg(W, bg, ago)} alt={bgAlt(bg, ago)} width={W} height={bgHeight(bg.length)} />
              </Box>
            )}
            {egg ? (
              <Box key="breach" marginBottom={1}>
                <Svg
                  source={breachCard(W, steps.filter(st => st.state === 'done').length, steps.length, boss.isWorking, egg, FONT, cardShape)}
                  alt={`Breach Protocol: ${steps.filter(st => st.state === 'done').length} of ${steps.length} steps`}
                  width={W}
                  height={BREACH_H}
                />
              </Box>
            ) : null}
            {egg ? (
              <Box key="legends" marginBottom={1}>
                <Svg
                  source={legendsCard(W, legends, egg, FONT, fmtCost, cardShape)}
                  alt={`${egg === 'corpo' ? 'Mikoshi engrams' : 'Afterlife drinks'}: ${legends.map(l => l.task).join(', ') || 'none yet'}`}
                  width={W}
                  height={legendsHeight(legends.length)}
                />
              </Box>
            ) : null}
            {egg ? (
              <Box key="bd" flexDirection="column" marginBottom={1}>
                <Svg
                  source={braindanceCard(W, beats, pick, SKIN.colors, FONT, cardShape, egg === 'samurai' ? 'SETLIST' : 'BRAINDANCE')}
                  alt={braindanceAlt(beats, pick)}
                  width={W}
                  height={bdHeight(beats)}
                />
                <Box flexDirection="row" gap={2}>
                  <Button key="bd-first" label={'⏮\uFE0E First'} plain onPress={async () => { const n = (await read($, timeline)).length; await update($, bdPick, () => (n ? 0 : -1)) }} />
                  <Button key="bd-prev" label={'◀\uFE0E Back'} plain onPress={async () => { const n = (await read($, timeline)).length; await update($, bdPick, i => stepPick(i, n, -1)) }} />
                  <Button key="bd-next" label={'Next ▶\uFE0E'} plain onPress={async () => { const n = (await read($, timeline)).length; await update($, bdPick, i => stepPick(i, n, 1)) }} />
                  <Button key="bd-live" label="● Live" plain onPress={() => update($, bdPick, () => -1)} />
                </Box>
              </Box>
            ) : null}
            <Svg
              key="manager"
              source={managerSvg(W, bossCard, info, title, t, list.length, clockNow, managerProgress(f, list, boss, clockNow), waitingOn, managerEstimate(f, list, boss, clockNow))}
              alt={`Manager: ${boss.task || 'idle'}${bossCard.isWorking ? ', working' : waitingOn ? `, ${s.bgWaiting(waitingOn)}` : outcomeWord(boss) ? `, ${outcomeWord(boss).toLowerCase()}` : ''}. ${summary}`}
              width={W}
              height={managerHeight(info)}
            />
            <Box key="tokens" marginTop={1} marginBottom={1}>
              <Svg
                source={tokenSvg(W, report, boss.isWorking)}
                alt={`Token Manager: ${MOOD_WORD[report.mood]}. ${report.tips.map(tp => tp.text).join('. ')}`}
                width={W}
                height={tokenHeight(report)}
              />
            </Box>
            {shown.map(r =>
              r.kind === 'role' ? (
                <Svg key={r.key} source={treeRowSvg(W, r, drawn(r.key, () => roleSvg(rowInnerW(W, r), r)))} alt={`${r.role}: ${r.count} agents, ${r.running} working`} width={W} height={ROLE_H} />
              ) : r.folded ? (
                <Box key={r.key} flexDirection="row" alignItems="center">
                  <Svg
                    source={treeRowSvg(W - OPEN_W, r, drawn(r.key, () => foldedSvg(rowInnerW(W - OPEN_W, r), r.a, at)))}
                    alt={`${r.a.description}: ${r.a.status === 'failed' ? s.failed : r.a.status === 'stopped' ? s.stopped : s.isFinished}, ${fmtTokens(r.a.tokens)} tokens`}
                    width={W - OPEN_W}
                    height={FOLD_H}
                  />
                  <Button key={`open-${r.key}`} label="Open ▸" plain onPress={() => toggleOpen(r.a.id)} />
                </Box>
              ) : (
                <Box key={r.key} flexDirection="column">
                  <Svg
                    source={treeRowSvg(W, r, drawn(r.key, () => agentSvg(rowInnerW(W, r), r.a, at, !isBoxed(r))))}
                    alt={`${r.a.description}: ${modelName(r.a.model)}, ${r.a.status === 'running' ? s.isRunning : r.a.status === 'failed' ? s.failed : r.a.status === 'stopped' ? s.stopped : s.isFinished}${isOver(r.a) ? `, ${tkStr().overWord}` : ''}`}
                    width={W}
                    height={AGENT_H}
                  />
                  {r.a.status !== 'running' && <Button key={`close-${r.key}`} label="▴ Collapse" plain onPress={() => toggleOpen(r.a.id)} />}
                </Box>
              ),
            )}
            {moreRow(spare, true)}
            {moreRow(done, false)}
            {isEmpty && (SKIN.dark ? <Text color={SKIN.colors.subtext}>No sub-agents yet. They show up here, under the manager, by role.</Text> : <Text dimColor>No sub-agents yet. They show up here, under the manager, by role.</Text>)}
            {section('h-org', 'Hierarchy')}
            {orgPicture(picture)}
            <Box key="toggles" flexDirection="row" gap={2} marginTop={1}>
              {finished.length > 0 && toggleDone}
              {toggleCompact}
            </Box>
            {section('h-session', 'Memory')}
            <Svg key="session" source={sessionSvg(W, info, rules, isWorking)} alt={sessionAlt(info, rules)} width={W} height={sessionHeight(W, info, rules)} />
            {section('h-settings', 'Settings')}
            <Box key="settings" flexDirection="column">
              <Button
                key="set-open"
                label={`${prefs.openOnStart ? '☑\uFE0E' : '☐'} Open Mission Control when Claude starts`}
                plain
                onPress={async () => {
                  const isOn = !(await read($, settings)).openOnStart
                  await $.store.set('openOnStart', isOn).catch(() => undefined)
                  await update($, settings, prev => ({ ...prev, openOnStart: isOn }))
                }}
              />
              <Button
                key="set-crew"
                label={`${prefs.crewMode ? '☑\uFE0E' : '☐'} Crew mode: split big jobs across sub-agents`}
                plain
                onPress={async () => {
                  const auto = await readAutoCrew($)
                  const isOn = !auto.on
                  await $.store.set('autoCrew', { ...auto, on: isOn }).catch(() => undefined)
                  if (!isOn) await update($, session, prev => ({ ...prev, crewMode: '' }))
                  await update($, settings, prev => ({ ...prev, crewMode: isOn }))
                }}
              />
              <Button
                key="set-currency"
                label={`¤ Currency: ${currencyLabel(currencyOf(prefs.currency, CURRENCY.code === prefs.currency ? CURRENCY.rate : undefined))} ▸`}
                plain
                onPress={async () => {
                  const i = CURRENCIES.findIndex(c => c.code === CURRENCY.code)
                  await setCurrency($, CURRENCIES[(i + 1) % CURRENCIES.length] as Currency)
                }}
              />
              <Button
                key="set-sounds"
                label={`${prefs.sounds ? '☑\uFE0E' : '☐'} ${eggOf() ? 'Sounds: chimes, blips and the MaxTac siren' : 'Sounds: job-done chime'}`}
                plain
                onPress={async () => {
                  const isOn = !(await read($, settings)).sounds
                  await $.store.set('sounds', isOn).catch(() => undefined)
                  await update($, settings, prev => ({ ...prev, sounds: isOn }))
                }}
              />
              <Button
                key="set-timekeeper"
                label={`${tkNow.on ? '☑\uFE0E' : '☐'} ${tkStr().setting(tkNow.jobMin, tkNow.agentMin)}`}
                plain
                onPress={async () => {
                  await setTimekeeper($, { on: !(await read($, timekeeper)).on })
                }}
              />
              <Button key="set-skin" label="Change skin ▸" plain onPress={() => void showPane($, SKINS_PANE, SKIN.tabs.skins)} />
            </Box>
          </Box>
        </Box>
      )
      // The app draws a blank pane for a tree past its size limit: the first that fits
      // wins. Everything; then the finished rows folded into one (all but the first
      // few, the opened ones and any with a card under them); then either with the
      // hierarchy's light drawing; at last the short view.
      const rich = orgSource(W, org)
      const view = full(rich, tree, [])
      const size = drawnChars(view)
      if (size <= DRAW_MAX) return keep(view)
      const fold = new Set(
        tree.flatMap((r, i) => {
          if (r.kind !== 'agent' || !r.folded) return []
          const end = tree.findIndex((n, j) => j > i && n.depth <= r.depth)
          const under = tree.slice(i + 1, end < 0 ? undefined : end)
          return under.every(n => n.kind === 'agent' && n.folded) ? [r.a.id] : []
        }).slice(KEEP_DONE),
      )
      const shown = fold.size ? withoutRows(tree, fold) : tree
      const kept = new Set(shown.flatMap(r => (r.kind === 'agent' ? [r.a.id] : [])))
      const done = tree.flatMap(r => (r.kind === 'agent' && !kept.has(r.a.id) ? [r.a] : []))
      const slim = fold.size ? full(rich, shown, done) : view
      const slimSize = fold.size ? drawnChars(slim) : size
      if (slimSize <= DRAW_MAX) return keep(slim)
      const light = orgSvg(W, org, true)
      if (size - rich.length + light.length <= DRAW_MAX) return keep(full(light, tree, []))
      if (slimSize - rich.length + light.length <= DRAW_MAX) return keep(full(light, shown, done))
      const short = compactView(rich)
      if (drawnChars(short) <= DRAW_MAX) return keep(short)
      const shorter = compactView(light)
      return keep(drawnChars(shorter) <= DRAW_MAX ? shorter : compactView(''))
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const tier = tierOf(a.type)
      const color = colorOf(tier)
      const ctx = ctxOf(a)
      const progress = progressOf(a, at)
      const model = runModel(a)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={color}>▣</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={statusColor(a, color)}>{isQuiet(a) ? '⚠' : STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {tier === 'other' ? a.type : tierWord(tier)} · {model} · {fmtTokens(a.tokens)} tokens used
            {isQuiet(a) ? ` · ⚠ quiet ${fmtTime(at - (a.lastProgressAt ?? a.startedAt))}` : a.status === 'running' && a.activity ? ` · ▸ ${a.activity}` : ''}
            {a.budgetMin ? ` · ⏱ ${budgetLabel(elapsed(a, at), a.budgetMin)}${isOver(a) ? ` ${tkStr().overWord}` : ''}` : ''}
            {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}{s.ctx} {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {title}
          </Text>
          {toggleCompact}
        </Box>
        <Text dimColor>
          ≈{fmtCost(t.cost)} · {fmtTokens(t.tokens)} {s.tokensWord} · {fmtTime(t.time)}
        </Text>
        {p.isCompact ? (
          <Text wrap="truncate-end">
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={isQuiet(a) ? '#E5675E' : colorOf(tierOf(a.type))}>
                {isQuiet(a) ? '⚠' : STATUS_GLYPH[a.status]}{' '}
              </Text>
            ))}
            {quietCount ? <Text color="#E5675E">{quietCount} quiet </Text> : null}
            {planned.map(pl => (
              <Text key={`plan-${pl.n}`} dimColor>
                ◷{' '}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Usage</Text>
            {sortedLimits(info).map(l => (
              <Text key={`lim-${l.kind}`} wrap="truncate-end">
                {'  '}
                {limitName(l.kind)} <Text color={gaugeColor(l.percentUsed)}>{ctxBar(Math.min(100, l.percentUsed), 12)}</Text> {Math.round(l.percentUsed)}%
                <Text dimColor> {resetLabel(l.resetsAt, clockNow)}</Text>
              </Text>
            ))}
            {sortedModels(info).map(([m, n]) => (
              <Text key={`mod-${m}`} wrap="truncate-end" dimColor>
                {'  '}
                {modelName(m)} {fmtTokens(n)} tokens
              </Text>
            ))}
            <Text dimColor>
              Today {day.tasks} tasks · {day.agents} agents · {fmtTokens(day.tokens)} tokens · ≈{fmtCost(day.costUsd)}
            </Text>
            <Text bold>Workflow{f && !f.isFinished ? ` ${f.title}` : ''}</Text>
            {steps.length === 0 && <Text dimColor>  nothing running</Text>}
            {steps.map(st => (
              <Text key={`wf-${st.key}`} wrap="truncate-end">
                <Text color={st.state === 'done' ? DONE : st.state === 'failed' ? 'red' : st.state === 'stopped' ? 'gray' : st.color}>  {STEP_GLYPH[st.state]} </Text>
                <Text dimColor={st.state === 'waiting'}>{st.title}</Text>
                <Text dimColor>{st.progress === null ? (st.state === 'waiting' ? '  waiting' : '') : `  ${Math.round(st.progress * 100)}%`}</Text>
              </Text>
            ))}
            {bg.length > 0 && (
              <Text wrap="truncate-end">
                <Text bold>{s.bgTitle} · {bg.length}</Text>
                <Text dimColor> {ago}</Text>
              </Text>
            )}
            {bg.slice(0, BG_MAX).map(r => (
              <Text key={`bg-${r.key}`} wrap="truncate-end">
                <Text color={r.isLive ? ACCENT : undefined} dimColor={!r.isLive}>
                  {'  '}
                  {BG_GLYPH[r.kind] ?? BG_GLYPH.other}{' '}
                </Text>
                <Text dimColor>{r.label} </Text>
                {clip(r.text, 160)}
                {r.detail ? <Text dimColor> · {clip(r.detail, 160)}</Text> : null}
                <Text dimColor> · {r.status}</Text>
              </Text>
            ))}
            {bg.length > BG_MAX && (
              <Text dimColor>
                {'  '}+{bg.length - BG_MAX} {s.bgMore}
              </Text>
            )}
            <Text wrap="truncate-end">
              <Text color={bossCard.isWorking ? ACCENT : undefined}>{bossCard.isWorking ? '●' : '○'} </Text>
              <Text bold>Manager </Text>
              <Text>{boss.task || 'waiting for your next request'}</Text>
              {boss.budgetMin && boss.task ? <Text color={budgetTone((boss.doneAt ?? clockNow) - boss.startedAt, boss.budgetMin) || undefined}> ⏱ {budgetLabel((boss.doneAt ?? clockNow) - boss.startedAt, boss.budgetMin)}</Text> : null}
              {waitingOn ? <Text color={ACCENT}> · ⧗ {s.bgWaiting(waitingOn)}</Text> : null}
              {!bossCard.isWorking && !waitingOn && outcomeWord(boss) ? <Text dimColor> · {outcomeWord(boss)}</Text> : null}
            </Text>
            <Text wrap="truncate-end">
              <Text color={MOOD_COLOR[report.mood]} bold>
                {'  '}Token Manager {MOOD_WORD[report.mood]}
              </Text>
              <Text dimColor> {fmtTokens(report.burnPerMin)}/min</Text>
            </Text>
            {report.tips.map((tp, i) => (
              <Text key={`tip-${i}`} wrap="truncate-end">
                <Text color={MOOD_COLOR[tp.level]}>    ● </Text>
                {tp.text}
              </Text>
            ))}
            {isEmpty && <Text dimColor>  no sub-agents yet</Text>}
            {tree.map(r =>
              r.kind === 'role' ? (
                <Text key={r.key} wrap="truncate-end">
                  <Text dimColor>{treePrefix(r)}</Text>
                  <Text color={r.color} bold>
                    {r.role}
                  </Text>
                  <Text dimColor>
                    {' '}
                    {r.count} · {r.running} working
                  </Text>
                </Text>
              ) : (
                <Box key={r.key} flexDirection="row">
                  <Text dimColor>{treePrefix(r)}</Text>
                  {r.folded ? (
                    <Box flexDirection="row" gap={1}>
                      <Text color={statusColor(r.a, 'green')}>{STATUS_GLYPH[r.a.status]}</Text>
                      <Text dimColor wrap="truncate-end">
                        {r.a.description || r.a.type} · {fmtTokens(r.a.tokens)} tokens
                      </Text>
                      <Button key={`open-${r.key}`} label="open" plain onPress={() => toggleOpen(r.a.id)} />
                    </Box>
                  ) : (
                    <Box flexDirection="column">
                      {row(r.a)}
                      {r.a.status !== 'running' && <Button key={`close-${r.key}`} label="▴ collapse" plain onPress={() => toggleOpen(r.a.id)} />}
                    </Box>
                  )}
                </Box>
              ),
            )}
            {finished.length > 0 && toggleDone}
            {planned.length > 0 && <Text dimColor>{s.planned} · {planned.length}</Text>}
            {planned.map(pl => {
              const tier = pl.tier in TIER_COLOR ? pl.tier : 'other'
              return (
                <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
                  <Text dimColor wrap="truncate-end">
                    <Text color={colorOf(tier)}>▢</Text> {pl.n}. {pl.title} ◷
                  </Text>
                  <Text dimColor wrap="truncate-end">
                    {'  '}
                    {tierWord(tier)} · {tierModel(tier)}
                    {pl.after.length ? ` · ${s.after} ${pl.after.join(', ')}` : ''}
                  </Text>
                </Box>
              )
            })}
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Memory</Text>
          {rules.map((r, i) => (
            <Text key={`rule-${i}`} wrap="truncate-end">
              <Text color={KELP}>▍</Text>
              {r}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })

  // Kept open: each prompt puts the pane back if it was closed.
  const PERSON_ORIGINS = new Set(['composer', 'bridge', 'sdk'])
  on('prompt.submit', async ($, e, next) => {
    // A typed request (not a slash command or a system note) is the manager's task.
    // Only the person's own words count: a task notification, a peer or a plugin's
    // prompt is no task of theirs.
    const isPersons = !e.origin || PERSON_ORIGINS.has(e.origin.kind)
    const isNote = e.origin?.kind === 'task-notification'
    if (isNote) await dropNotified($, e.text ?? '').catch(() => undefined)
    const asked = e.isMeta || e.command || !isPersons ? '' : e.text.trim()
    if (!e.isMeta) pendingCommand = isPersons && e.command ? `/${e.command.name}${e.command.args ? ` ${e.command.args}` : ''}` : ''
    if (asked) await startJob($, asked)
    // A turn Claude starts on its own (a report to answer, a schedule, a peer) is work
    // in hand; a report read inside the running turn is answered there.
    else if (!e.turnId && (isNote || (!isPersons && !e.isMeta))) await mainAtWork($).catch(() => undefined)
    else if (isNote && (await read($, manager)).reportDue) await update($, manager, prev => ({ ...prev, reportDue: undefined }))
    // Reopening is a courtesy: it must never cost the request itself. A pane opened
    // unasked in a narrow window waits undrawn; opened here, the prompt behind it
    // counts as asking, and the app places it at any width.
    const isOpen = await $.ui
      .panes()
      .then(list => list.some(p => p.id === PANE && (p as { isPlaced?: boolean }).isPlaced !== false))
      .catch(() => true)
    if (!isOpen && (await read($, settings)).openOnStart) void $.ui.open({ id: PANE, title: SKIN.tabs.mission }).catch(() => undefined)
    return next(e)
  })

  // A window that connects after the session started gets the pane too.
  on('session.attach', async ($, e, next) => {
    const attached = await next(e)
    if ((await read($, settings)).openOnStart) void $.ui.open({ id: PANE, title: SKIN.tabs.mission }).catch(() => undefined)
    return attached
  })

  // The rules ride at the end of every system prompt, the main session's and each subagent's.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    // A subagent's request offers fewer tools than the session's: keep the union.
    const found = connectorsOf(e.tools)
    if (found.some(c => !c.endsWith('claude.ai'))) {
      await update($, env, prev => ({ ...prev, connectors: [...new Set([...prev.connectors.filter(c => !c.endsWith('claude.ai')), ...found])].sort((a, b) => Number(a.endsWith('claude.ai')) - Number(b.endsWith('claude.ai')) || a.localeCompare(b)) }))
    }
    const rules = cleanRules(await $.store.get(MEMORY_KEY))
    const sections = [...composed.sections]
    if (rules.length) sections.push({ id: 'crab-progress:memory', text: memoryText(rules), scope: 'session' as const })
    sections.push(...(await timekeeperSections($)))
    // Only the session that can spawn agents is told to: a worker never gets it.
    // Only the main loop is told: it can spawn agents and offers the most tools; a
    // worker, even one with the Agent tool, offers fewer.
    mostTools = Math.max(mostTools, e.tools.length)
    if (e.tools.includes('Agent') && e.tools.length >= mostTools * 0.9) {
      const auto = await readAutoCrew($)
      let reason = auto.on ? (await read($, session)).crewMode ?? '' : ''
      if (auto.on && !reason) {
        // A plan that grew long, or a context that filled, calls the crew mid-task.
        const boss = await read($, manager)
        const info = await read($, env)
        if (info.contextPct < auto.ctxPct - 10) crewCalled = false
        if (boss.isWorking && !crewCalled) reason = bigJobReason('', info.contextPct, (boss.plan ?? []).length, auto.ctxPct)
        if (reason) {
          crewCalled = true
          await update($, session, prev => ({ ...prev, crewMode: reason }))
          $.ui.toast(`🦀 Big job (${reason}): summoning the crew`)
        }
      }
      if (reason) sections.push({ id: 'crab-progress:crew', text: crewText(reason), scope: 'session' as const })
    }
    return sections.length === composed.sections.length ? composed : { ...composed, sections }
  })

  on('command.run', { command: 'skins' }, async $ => {
    await showPane($, SKINS_PANE, SKIN.tabs.skins)
    return { text: 'Skin picker opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: SKINS_PANE }, async ($, e) => {
    const active = await useSkin($)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const wear = async (k: Skin) => {
      applySkin(k)
      await $.store.set('skin', k.id).catch(() => undefined)
      await update($, skin, () => k.id)
      await retitle($)
    }
    const skins = [...SKINS.values()].filter(k => canWear(k) && (!k.hidden || k.id === active.id))
    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>Pick a look for Mission Control and the band. Your own skins go in the Custom Claude Skins folder.</Text>
          {HAS_CYBER ? null : <Text dimColor>{ADDON_PITCH}</Text>}
          {skins.map(k => (
            <Box key={`skin-${k.id}`} flexDirection="column">
              <Svg source={previewSvg(W, k, k.id === active.id)} alt={`${k.name}: ${k.description}`} width={W} height={PREVIEW_H} />
              {k.id === active.id ? (
                <Text dimColor>✓ On now</Text>
              ) : (
                <Button key={`wear-${k.id}`} label={`Use ${k.name} ▸`} plain onPress={() => wear(k)} />
              )}
            </Box>
          ))}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {HAS_CYBER ? null : <Text dimColor>{ADDON_PITCH}</Text>}
        {skins.map(k => (
          <Box key={`skin-${k.id}`} flexDirection="row" gap={1}>
            <Text color={k.colors.accent} bold>
              {k.id === active.id ? '▸' : ' '} {k.name}
            </Text>
            <Text dimColor wrap="truncate-end">
              {k.description}
            </Text>
            {k.id !== active.id && <Button key={`wear-${k.id}`} label="use" plain onPress={() => wear(k)} />}
          </Box>
        ))}
      </Box>
    )
  })

  on('command.run', { command: 'skin' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    const listing = () =>
      [...SKINS.values()].filter(k => canWear(k) && (!k.hidden || k.id === SKIN.id)).map(k => `${k.id === SKIN.id ? '▸' : ' '} ${k.id}  ${k.name}${k.description ? ` · ${k.description}` : ''}`).join('\n')
    if (arg === 'reload') {
      const { folder, loaded, skipped } = await loadSkins($)
      await checkAddon($)
      // A skin from an add-on that is gone falls back to the crab.
      const found = SKINS.get(SKIN.id)
      const current = found && canWear(found) ? found : CRAB_SKIN
      applySkin(current)
      await update($, skin, () => `${current.id}`)
      return { text: folder ? `Reloaded ${loaded} skin file(s) from ${folder}.${skipped.length ? `\nSkipped: ${skipped.join('; ')}` : ''}\n${listing()}` : `No "${SKINS_FOLDER}" folder found.\n${listing()}` }
    }
    if (arg === 'folder') {
      const folder = await $.store.get('skinsFolder').catch(() => undefined)
      return { text: typeof folder === 'string' ? `Skins folder: ${folder}` : `No "${SKINS_FOLDER}" folder found yet.` }
    }
    if (!arg || arg === 'list') return { text: `Skins (▸ is on):\n${listing()}\nSwitch with /skin <id>.${HAS_CYBER ? '' : `\n\n${ADDON_PITCH}`}` }
    const k = SKINS.get(arg === 'off' || arg === 'none' ? DEFAULT_SKIN.id : arg)
    if (!k) return { text: `No skin "${arg}".\n${listing()}` }
    if (!canWear(k)) return { text: `${k.hidden ? `No skin "${arg}".` : `${k.name} comes with the Cyberpunk Skins add-on.`}\n${ADDON_PITCH}` }
    applySkin(k)
    await $.store.set('skin', k.id)
    await update($, skin, () => k.id)
    await retitle($)
    if (k.hidden) {
      // Found the secret: a badge for the finder.
      $.ui.toast(GREETING.samurai)
      void play($, `${ADDON}/assets/done-samurai.wav`)
      // Quiet: the badge's chime would cut the band's own.
      await bumpCred($, c => (c.samurai ? c : { ...c, samurai: true, xp: c.xp + 50 }), true).catch(() => false)
    }
    return { text: `Skin: ${k.name}.` }
  })

  on('command.run', { command: 'autocrew' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    // A context line outside 10–95%, or any other word, is answered, not quietly
    // clamped or read as a request for the state.
    const pct = /^\d+%?$/.test(arg) ? parseInt(arg, 10) : NaN
    if (arg && arg !== 'on' && arg !== 'off' && !(pct >= 10 && pct <= 95)) {
      return { text: 'Usage: /autocrew for its state, /autocrew on|off, or /autocrew <10–95> to call the crew past that context %' }
    }
    const auto = await readAutoCrew($)
    const next: AutoCrew =
      arg === 'on' ? { ...auto, on: true }
      : arg === 'off' ? { ...auto, on: false }
      : arg ? { on: true, ctxPct: pct }
      : auto
    if (next !== auto) await $.store.set('autoCrew', next).catch(() => undefined)
    await update($, settings, prev => ({ ...prev, crewMode: next.on }))
    if (!next.on) await update($, session, prev => ({ ...prev, crewMode: '' }))
    return {
      text: next.on
        ? `Crew mode on: a big job (a long brief, 4+ asks, 6+ files, a codebase sweep, a 6-step plan, or context past ${next.ctxPct}%) is split across sub-agents.`
        : 'Crew mode off: big jobs stay in this session.',
    }
  })

  on('command.run', { command: 'tokens' }, async ($, e) => {
    const [verb = '', arg = ''] = (e.args ?? '').trim().split(/\s+/)
    // Anything but a report, a budget or autopilot on|off gets the usage line.
    if ((verb && verb !== 'autopilot' && verb !== 'budget') || (verb === 'autopilot' && arg && arg !== 'on' && arg !== 'off')) {
      return { text: 'Usage: /tokens for a report, /tokens budget <dollars|off>, /tokens autopilot <on|off>' }
    }
    if (verb === 'autopilot') {
      const isOn = arg !== 'off'
      await $.store.set('autopilot', isOn)
      await update($, watch, prev => ({ ...prev, autopilot: isOn }))
      return { text: isOn ? 'Autopilot on: read-only explorers run on Haiku unless you pick a model.' : 'Autopilot off.' }
    }
    if (verb === 'budget') {
      const dollars = arg === 'off' ? 0 : Number(arg.replace(/^\$/, ''))
      if (!Number.isFinite(dollars) || dollars < 0) return { text: 'Usage: /tokens budget 2  (dollars per task), or /tokens budget off' }
      await $.store.set('budgetUsd', dollars)
      await update($, watch, prev => ({ ...prev, budgetUsd: dollars }))
      return { text: dollars ? `Budget set: ${fmtCost(dollars)} per task. The Token Manager warns at 80% and 100%.` : 'Budget off.' }
    }
    const at = await $.clock.now()
    const r = tokenReport(liveEnv(await read($, env), at), await read($, agents), await read($, manager), await read($, watch), at)
    return {
      text: [
        `Token Manager: ${MOOD_WORD[r.mood]}`,
        `Burn ${fmtTokens(r.burnPerMin)}/min · this task ${fmtTokens(r.taskTokens)} (≈${fmtCost(r.taskCost)})${r.cachedPct === null ? '' : ` · ${r.cachedPct}% cached`}`,
        ...r.tips.map(tp => `${['✓', '!', '‼'][tp.level]} ${tp.text}`),
      ].join('\n'),
    }
  })

  on('command.run', { command: 'prefs' }, async ($, e) => {
    const args = (e.args ?? '').trim()
    const [verb = '', ...rest] = args.split(/\s+/)
    const text = args.slice(verb.length).trim()
    const rules = cleanRules(await $.store.get(MEMORY_KEY))
    const note = '\n(New rules apply from the next session.)'

    if (verb === 'add' && text) {
      const saved = await saveRules($, [...rules, text])
      return { text: `Saved rule ${saved.length}.${note}` }
    }
    if (verb === 'remove') {
      const n = Number(rest[0])
      if (!Number.isInteger(n) || n < 1 || n > rules.length) return { text: `No rule ${rest[0] ?? ''}. ${listRules(rules)}` }
      await saveRules($, rules.filter((_, i) => i !== n - 1))
      return { text: `Removed rule ${n}.${note}` }
    }
    if (verb === 'clear') {
      await saveRules($, [])
      return { text: `All rules cleared.${note}` }
    }
    await update($, memory, () => rules)
    await showPane($, MEMORY_PANE, 'Memory')
    return { text: listRules(rules) }
  })

  on('ui.render', { component: 'Pane', requestId: MEMORY_PANE }, async ($, e) => {
    await useSkin($)
    const { Box, Text, Button } = $.ui.resolve(e)
    const rules = await read($, memory)
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>How Claude answers you</Text>
        {rules.length === 0 && <Text dimColor>No rules yet. Add one: /prefs add keep answers short</Text>}
        {rules.map((r, i) => (
          <Box key={`rule-${i}`} flexDirection="row" gap={1}>
            <Text wrap="wrap">{`${i + 1}. ${r}`}</Text>
            <Button key={`forget-${i}`} label={`Forget rule ${i + 1}`} plain onPress={() => saveRules($, rules.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </Box>
        ))}
        <Text dimColor>Sent to Claude at the start of every session. Changes apply next session.</Text>
      </Box>
    )
  })

  // Tool rows in the skin: a status rail, icon, verb, target and outcome.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const k = await useSkin($)
    // A light skin's chat colours are dark ones: it leaves the rows to the app.
    if (!k.chat || !k.dark) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const c = k.colors
    const { tool, input, isRunning, isErrored, isInterrupted } = e.props
    const { verb, real } = toolLabel(tool)
    const target = callTarget(tool, input)
    const tone = isErrored ? c.alert : isInterrupted ? c.warn : isRunning ? c.accent : c.done
    const status = isErrored ? '✗ failed' : isInterrupted ? '■ stopped' : isRunning ? '▸ running' : '✓'
    const diff = editDiff(tool, input)
    const row = (
      <Box flexDirection="row" alignItems="center" gap={1} paddingX={1} backgroundColor={c.tile} borderStyle="single" borderColor={c.line}>
        <Text color={tone} bold>
          ▍
        </Text>
        <Text color={c.accent}>{TOOL_ICONS[tool] ?? (tool.startsWith('mcp__') ? '◈' : '◆')}</Text>
        <Text color={c.text} bold>
          {verb}
        </Text>
        {verb !== real && <Text color={c.muted}>{real}</Text>}
        <Text color={c.subtext} wrap="truncate-end">
          {target}
        </Text>
        <Box flexGrow={1} />
        {diff && (
          <Text color={c.done} bold>
            +{diff.added}
          </Text>
        )}
        {diff && diff.removed > 0 && (
          <Text color={c.alert} bold>
            −{diff.removed}
          </Text>
        )}
        <Text color={tone} bold={isRunning || isErrored}>
          {status}
        </Text>
      </Box>
    )
    if (!diff || isErrored) return row
    // An edit shows what it changed: the engine's own diff colours, in the skin's frame.
    const { Code } = ui as unknown as { Code: (props: Record<string, unknown>) => unknown }
    return (
      <Box flexDirection="column">
        {row}
        <Box flexDirection="column" paddingX={1} backgroundColor={c.tile} borderStyle="single" borderColor={c.line}>
          <Code source={diff.source} format={diff.isNew ? 'source' : 'diff'} path={diff.path} startLine={diff.isNew ? 1 : undefined} />
          {diff.more > 0 && <Text color={c.muted}>… {diff.more} more lines</Text>}
        </Box>
      </Box>
    )
  })

  // Replies in the skin: code fences as cards with their language and numbered
  // lines, tables framed, Mermaid flowcharts and pies drawn, LaTeX as symbols.
  // A reply with none of these stays the app's own drawing.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const k = await useSkin($)
    if (!k.chat || !k.dark || e.props.isSummary) return next(e)
    const blocks = splitBlocks(e.props.text)
    if (blocks.every(b => b.kind === 'md' && !hasInlineMath(b.text))) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const { Code, Markdown } = ui as unknown as { Code: (props: Record<string, unknown>) => unknown; Markdown: (props: Record<string, unknown>) => unknown }
    const c = k.colors
    const W = Math.max(280, Math.min(760, ((e.viewport?.columns ?? 100) - 6) * 8))
    const frame = (key: string, label: string, meta: string, body: unknown) => (
      <Box key={key} flexDirection="column" backgroundColor={c.tile} borderStyle="single" borderColor={c.line} paddingX={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={c.accent} bold>
            ▍{label}
          </Text>
          <Text color={c.muted}>{meta}</Text>
        </Box>
        {body as never}
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        {blocks.map((b, i) => {
          if (b.kind === 'md') return <Markdown key={`md-${i}`} text={inlineMath(b.text)} />
          if (b.kind === 'code') {
            const n = b.text.split('\n').length
            return frame(`code-${i}`, b.lang || 'code', `${n} ${n === 1 ? 'line' : 'lines'}`, <Code source={b.text.slice(0, 60_000)} language={b.lang || undefined} startLine={1} />)
          }
          if (b.kind === 'table') {
            const rows = b.text.split('\n').length - 2
            return frame(`table-${i}`, 'table', `${rows} ${rows === 1 ? 'row' : 'rows'}`, <Markdown text={inlineMath(b.text)} />)
          }
          if (b.kind === 'math')
            return frame(
              `math-${i}`,
              'math',
              '',
              <Text color={c.text} bold>
                {texToUnicode(b.text)}
              </Text>,
            )
          const chart =
            e.surface === 'desktop' && 'Svg' in ui
              ? mermaidChart(b.text, W, {
                  font: k.font,
                  tile: c.tile,
                  text: c.text,
                  subtext: c.subtext,
                  line: c.line,
                  accent: c.accent,
                  colors: k.roles,
                  chamfer: k.corners === 'chamfer',
                })
              : null
          if (chart) {
            const { Svg } = ui as unknown as { Svg: (props: Record<string, unknown>) => unknown }
            return frame(`chart-${i}`, 'chart', 'mermaid', <Svg source={chart.svg} alt={mermaidAlt(b.text)} width={W} height={chart.height} />)
          }
          return frame(`chart-${i}`, 'mermaid', 'shown as code', <Code source={b.text} language="mermaid" />)
        })}
      </Box>
    )
  })

  // The spinner speaks the skin's words while the turn thinks or waits; a real
  // step ("Creating notes.md") keeps its own text.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const k = await useSkin($)
    if (!k.chat || !k.words.length || e.props.message) return next(e)
    const isPlain = e.surface !== 'desktop' || e.props.word === 'Working' || e.props.mode === 'thinking' || e.props.mode === 'requesting'
    if (!isPlain) return next(e)
    return next({ ...e, props: { ...e.props, word: skinWord(e.props.word) } })
  })

  // Always drawn (a survey aside): the flow when one is reported, else an idle row
  // whose crab walks while Claude or any subagent works.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    await useSkin($)
    const reported = await read($, flow)
    const f = reported ?? idleFlow()
    // Draw this row with the other mods' bands beneath it. Claude Code's own placeholder ({ type: 'engine' }) is
    // never nested: the desktop drops a band that nests it.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    // The tick: it moves only when something drawn from the time changes, so a
    // second passing alone draws nothing.
    await read($, bandTick)
    const bandAt = await $.clock.now().catch(() => 0)
    const isDesktop = e.surface !== 'terminal' && 'Svg' in ui
    const band = bandView(await bandInput($, isDesktop), bandAt, e.props.isWorking)
    const { list, info, crew, isWorking, bgCount, waitingOn, idleText, tkBand } = band
    const text = idleText ?? label(f)
    // The desktop draws a Button's label, not its children, in a slot about 96px wide
    // beside the band: a long label spilled out of it. Keep both labels short.
    const crewButton = (
      <Button key="crab-agents" label={`◈ ${crew}`} plain onPress={() => void togglePane($)}>
        {`◈ ${crew}`}
      </Button>
    )
    const percent = idleText ? '' : `${Math.round(ratio(f) * 100)}%`
    // ✕ clears the reported flow; the row goes back to idle rather than away.
    const dismiss = reported ? (
      <Button key="crab-dismiss" label="✕" plain onPress={() => update($, flow, () => null)}>
        ✕
      </Button>
    ) : null

    // The terminal's element table is completed with an `Svg` that draws nothing: test the surface too.
    if (isDesktop && 'Svg' in ui && band.hud) {
      const { Svg } = ui
      const hud = band.hud
      // About 8 CSS px per reported column; the rest is the count, the dismiss
      // and their gaps. No floor above the slot: a row wider than it would wrap.
      const width = Math.max(180, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 96))
      // Drawn larger to read at a glance, but never taller than the slot the app
      // gives the band (about 18 px a row): past that it would scroll.
      const room = e.props.maxRows > 0 ? e.props.maxRows * 18 - 6 : Infinity
      const bandScale = Math.max(0.8, Math.min(HUD_SCALE, room / HUD_OUT_H))
      const bandH = Math.round(HUD_OUT_H * bandScale)
      return (
        <Box flexDirection="column">
          <Box flexDirection={isRtl() ? 'row-reverse' : 'row'} alignItems="center" gap={1}>
            <Svg source={steady(`band:${e.surface}`, (() => {
              const full = hudBandSvg(Math.round(width / bandScale), hud)
              return full.length < 120_000 ? full : hudBandSvg(Math.round(width / bandScale), { ...hud, lite: true })
            })().replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${width}" height="${bandH}"`), bandAt)} alt={`${hud.title}: ${hud.status}${hud.activity ? `, ${hud.activity}` : ''}${hud.progress === null ? '' : `, ${Math.round(hud.progress * 100)}%`}, context ${info.contextPct}%${bgCount ? `, ${bgCount} ${tr().bgBand}` : ''}`} width={width} height={bandH} />
            <Box flexDirection="column" gap={1} alignItems="center">
              {/* The app draws a Button's children as-is: keep them to a glyph and the count. */}
              {crewButton}
              {dismiss}
            </Box>
          </Box>
          {below}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const titleW = Math.max(8, Math.min(30, f.title.length + 2, Math.floor(cols / 3)))
    // The background count takes its own columns out of the bar's, so the buttons stay put.
    const bgLabel = bgCount ? `⧗ ${bgCount}` : ''
    const width = Math.max(6, Math.min(40, cols - titleW - 32 - (bgLabel ? bgLabel.length + 2 : 0)))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Box width={titleW} flexShrink={0}>
            <Text color={f.isFinished ? DONE : ACCENT}>● </Text>
            <Text wrap="truncate-end">{f.title}</Text>
          </Box>
          <Text color={f.isFinished ? DONE : ACCENT}>{barText(f, width)}</Text>
          <Text bold>{text}</Text>
          {percent ? <Text dimColor>{percent}</Text> : null}
          <Text color={CLAY}>{isWorking ? '▣' : '□'}</Text>
          <Text color={gaugeColor(info.contextPct)}>◔ {info.contextPct}%</Text>
          {tkBand ? <Text color={budgetTone(tkBand.usedMs, tkBand.min) || undefined}>⏱ {budgetLabel(tkBand.usedMs, tkBand.min)}</Text> : null}
          {bgLabel ? <Text color={ACCENT}>{bgLabel}</Text> : null}
          {crewButton}
          {dismiss}
        </Box>
        {below}
      </Box>
    )
  })
}
