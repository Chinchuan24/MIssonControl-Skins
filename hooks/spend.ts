// Spend over a period: today, this calendar week, one calendar month, or a custom
// range of local days; and the same spend as a CSV. This is the pure part (dates,
// labels, the transcript extractor's lines, the per-day ledger, the CSV), so it can
// be tested without the engine. The engine part (reading the transcripts into the
// store's ledger, the picks, the export) is at the end; register.tsx only wires it.
import type { EngineInterface } from 'claude-code'

/** One local day's spend: estimated US dollars, and tokens (input, output, cache reads and writes). */
export type SpendDay = [cost: number, tokens: number]
/** Spend per local day, keyed `YYYY-MM-DD`. */
export type SpendDays = Record<string, SpendDay>

export type SpendKind = 'today' | 'week' | 'month' | 'custom'
/**
 * The period the card shows. `month` is `YYYY-MM`, or '' for the current month;
 * `from` and `to` are a custom range's first and last day, `YYYY-MM-DD`.
 */
export type SpendPeriod = { kind: SpendKind; month: string; from: string; to: string }

export const SPEND_KINDS: readonly SpendKind[] = ['today', 'week', 'month', 'custom']
export const TODAY_PERIOD: SpendPeriod = { kind: 'today', month: '', from: '', to: '' }

// --- local days ---------------------------------------------------------------

const pad = (n: number): string => String(n).padStart(2, '0')
const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The local calendar day of a time, `YYYY-MM-DD`. */
export const dayKey = (at: number): string => ymd(new Date(at))

/** A `YYYY-MM-DD` that names a real day, as a local date at noon (clear of DST edges); null otherwise. */
export const parseDay = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d, 12)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}
export const isDay = (s: string): boolean => parseDay(s) !== null
export const isMonth = (s: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(s.trim())

/** The day `n` days after `day` (before, for a negative n). */
export const shiftDay = (day: string, n: number): string => {
  const d = parseDay(day)
  return d ? ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)) : day
}

/** The month of a time, `YYYY-MM`. */
export const monthOf = (at: number): string => dayKey(at).slice(0, 7)
/** The month `n` months after `month`. */
export const shiftMonth = (month: string, n: number): string => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(y, m - 1 + n, 1, 12)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** The calendar week holding a time: Monday to Sunday, local days. */
export const weekOf = (at: number): { from: string; to: string } => {
  const d = new Date(at)
  const back = (d.getDay() + 6) % 7
  const monday = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 12))
  return { from: monday, to: shiftDay(monday, 6) }
}

/** One calendar month, its first day to its last. */
export const monthRange = (month: string): { from: string; to: string } => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const last = new Date(y, m, 0, 12).getDate()
  return { from: `${month}-01`, to: `${month}-${pad(last)}` }
}

/** The first and last local day of a period, inclusive. */
export const rangeOf = (p: SpendPeriod, at: number): { from: string; to: string } => {
  if (p.kind === 'week') return weekOf(at)
  if (p.kind === 'month') return monthRange(isMonth(p.month) ? p.month : monthOf(at))
  if (p.kind === 'custom' && isDay(p.from) && isDay(p.to)) return p.from <= p.to ? { from: p.from, to: p.to } : { from: p.to, to: p.from }
  const today = dayKey(at)
  return { from: today, to: today }
}

/** How many days a range spans. */
export const daysIn = (from: string, to: string): number => {
  const a = parseDay(from)
  const b = parseDay(to)
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1 : 0
}

/** The ledger's days, per day the larger of each source: the history read from the transcripts, the log kept as the sessions ran. */
export const combineDays = (...sources: SpendDays[]): SpendDays => {
  const out: SpendDays = {}
  for (const src of sources) {
    for (const [day, v] of Object.entries(src)) {
      const was = out[day]
      out[day] = was ? [Math.max(was[0], v[0]), Math.max(was[1], v[1])] : [v[0], v[1]]
    }
  }
  return out
}

/**
 * The spend from `from` to `to`, inclusive. `live` is this machine's own count for
 * one day (the session's): it stands for that day where it is larger than the ledger,
 * so the ledger catching up later never shows less, nor counts the day twice.
 */
export const sumRange = (days: SpendDays, from: string, to: string, live?: { date: string; cost: number; tokens: number }): { cost: number; tokens: number } => {
  let cost = 0
  let tokens = 0
  for (const [day, v] of Object.entries(days)) {
    if (day < from || day > to || (live && day === live.date)) continue
    cost += v[0]
    tokens += v[1]
  }
  if (live && live.date >= from && live.date <= to) {
    const kept = days[live.date]
    cost += Math.max(live.cost, kept?.[0] ?? 0)
    tokens += Math.max(live.tokens, kept?.[1] ?? 0)
  }
  return { cost, tokens }
}

// --- labels -------------------------------------------------------------------

/** The words a period is named with, in the panel's language. */
export type SpendWords = {
  today: string
  week: string
  month: string
  custom: string
  months: readonly string[]
  short: readonly string[]
}

const dm = (day: string, w: SpendWords, withYear: boolean): string => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return `${d} ${w.short[m - 1] ?? m}${withYear ? ` ${y}` : ''}`
}

/** "3–9 Nov", "27 Oct – 2 Nov", "29 Dec 2025 – 4 Jan 2026"; one day alone, "6 Nov". */
export const spanLabel = (from: string, to: string, at: number, w: SpendWords): string => {
  const year = dayKey(at).slice(0, 4)
  const withYear = from.slice(0, 4) !== to.slice(0, 4) || from.slice(0, 4) !== year
  if (from === to) return dm(from, w, withYear)
  if (from.slice(0, 7) === to.slice(0, 7) && !withYear) return `${Number(from.slice(8))}–${dm(to, w, false)}`
  return `${dm(from, w, withYear)} – ${dm(to, w, withYear)}`
}

/** "June 2026". */
export const monthLabel = (month: string, w: SpendWords): string => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return `${w.months[m - 1] ?? month} ${y}`
}

/** "Today · 6 Nov", "This week · 3–9 Nov", "June 2026", "1–15 Oct". */
export const periodLabel = (p: SpendPeriod, at: number, w: SpendWords): string => {
  const r = rangeOf(p, at)
  if (p.kind === 'today') return `${w.today} · ${spanLabel(r.from, r.to, at, w)}`
  if (p.kind === 'week') return `${w.week} · ${spanLabel(r.from, r.to, at, w)}`
  if (p.kind === 'month') return monthLabel(r.from.slice(0, 7), w)
  return spanLabel(r.from, r.to, at, w)
}

// --- what is kept ---------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A stored period, checked: anything unreadable is Today. */
export const cleanPeriod = (v: unknown): SpendPeriod => {
  if (!v || typeof v !== 'object') return TODAY_PERIOD
  const o = v as Record<string, unknown>
  const kind = SPEND_KINDS.includes(o.kind as SpendKind) ? (o.kind as SpendKind) : 'today'
  const month = typeof o.month === 'string' && isMonth(o.month) ? o.month : ''
  const from = typeof o.from === 'string' && isDay(o.from) ? o.from : ''
  const to = typeof o.to === 'string' && isDay(o.to) ? o.to : ''
  if (kind === 'custom' && (!from || !to)) return TODAY_PERIOD
  return { kind, month: kind === 'month' ? month : '', from: kind === 'custom' ? from : '', to: kind === 'custom' ? to : '' }
}

/** A stored ledger, checked: only real days with two non-negative numbers. */
export const cleanDays = (v: unknown): SpendDays => {
  const out: SpendDays = {}
  if (!v || typeof v !== 'object') return out
  for (const [day, x] of Object.entries(v as Record<string, unknown>)) {
    if (!isDay(day) || !Array.isArray(x) || !isNum(x[0]) || !isNum(x[1])) continue
    out[day] = [Math.max(0, x[0]), Math.max(0, x[1])]
  }
  return out
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4

/** The ledger with `before` taken off and `after` put on, day by day; never below zero. */
export const applyDelta = (ledger: SpendDays, before: SpendDays, after: SpendDays): SpendDays => {
  const out: SpendDays = { ...ledger }
  for (const day of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = out[day] ?? [0, 0]
    const cost = round6(Math.max(0, was[0] - (before[day]?.[0] ?? 0) + (after[day]?.[0] ?? 0)))
    const tokens = Math.max(0, Math.round(was[1] - (before[day]?.[1] ?? 0) + (after[day]?.[1] ?? 0)))
    if (cost || tokens) out[day] = [cost, tokens]
    else delete out[day]
  }
  return out
}

/** The first day kept: the first of the month `months` months before the one holding `at`. */
export const keepFrom = (at: number, months = 13): string => `${shiftMonth(monthOf(at), -months)}-01`

/** The ledger without the days before the first of the month `months` months back. */
export const pruneDays = (ledger: SpendDays, at: number, months = 13): SpendDays => {
  const first = keepFrom(at, months)
  return Object.fromEntries(Object.entries(ledger).filter(([day]) => day >= first))
}

/** The months to pick from: every month the ledger has spend in, and the current one, newest first. */
export const monthsWithData = (ledger: SpendDays, at: number): string[] =>
  [...new Set([monthOf(at), ...Object.keys(ledger).map(d => d.slice(0, 7))])].filter(isMonth).sort().reverse()

// --- the slash command ----------------------------------------------------------

const USAGE = 'Use today, week, month [YYYY-MM], or <from YYYY-MM-DD> <to YYYY-MM-DD>.'

/**
 * The words after `/tokens spend` (or `/tokens export`): today, week, month
 * [YYYY-MM], or two days. No words keeps the period (`period` absent); a bad
 * one says why, plainly.
 */
export const parseSpendArgs = (words: readonly string[]): { period?: SpendPeriod; error?: string } => {
  const [a = '', b = '', c = ''] = words.map(x => x.trim()).filter(Boolean)
  if (!a) return {}
  if (c) return { error: `Too many words. ${USAGE}` }
  const w = a.toLowerCase()
  if (w === 'today' || w === 'day') return b ? { error: `"today" takes nothing after it. ${USAGE}` } : { period: TODAY_PERIOD }
  if (w === 'week') return b ? { error: `"week" is always this week (Monday to Sunday). ${USAGE}` } : { period: { ...TODAY_PERIOD, kind: 'week' } }
  if (w === 'month') {
    if (!b) return { period: { ...TODAY_PERIOD, kind: 'month' } }
    return isMonth(b) ? { period: { ...TODAY_PERIOD, kind: 'month', month: b } } : { error: `"${b}" is not a month. Write it as YYYY-MM, e.g. 2026-06.` }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(a) || /^\d{4}-\d{2}-\d{2}$/.test(b)) {
    if (!isDay(a)) return { error: `"${a}" is not a date. Write it as YYYY-MM-DD, e.g. 2026-10-01.` }
    if (!b) return { error: `Give a last day too: <from> <to>, both YYYY-MM-DD.` }
    if (!isDay(b)) return { error: `"${b}" is not a date. Write it as YYYY-MM-DD, e.g. 2026-10-15.` }
    return { period: { ...TODAY_PERIOD, kind: 'custom', from: a <= b ? a : b, to: a <= b ? b : a } }
  }
  if (isMonth(a) && !b) return { period: { ...TODAY_PERIOD, kind: 'month', month: a } }
  return { error: `Unknown period "${a}". ${USAGE}` }
}

// --- reading the transcripts -----------------------------------------------------

/**
 * Pulls one tab-separated record per assistant message out of Claude Code's
 * transcripts: file, message id, model, the time of its first line, input, output,
 * cache writes, cache reads. A message is written once per content block it holds,
 * each line with the usage so far (the output count grows), so a message is one
 * record per file, with the largest count of each kind. POSIX awk, so it runs on
 * macOS's, gawk, mawk and BusyBox. The usage read is the line's last `"usage":{`
 * (the message's own, after any content).
 */
export const EXTRACT_AWK = String.raw`function num(s, k,   i) {
  i = index(s, "\"" k "\":")
  return i ? substr(s, i + length(k) + 3, 20) + 0 : 0
}
function str(s, k,   i, t, j) {
  i = index(s, "\"" k "\":\"")
  if (!i) return ""
  t = substr(s, i + length(k) + 4, 200)
  j = index(t, "\"")
  return j ? substr(t, 1, j - 1) : ""
}
function max(a, b) { return a > b ? a : b }
function flush(   i, id) {
  for (i = 1; i <= n; i++) {
    id = ord[i]
    printf "%s\t%s\t%s\t%s\t%d\t%d\t%d\t%d\n", cur, id, mdl[id], ts[id], inp[id], out[id], cw[id], cr[id]
  }
  split("", ord); split("", mdl); split("", ts); split("", inp); split("", out); split("", cw); split("", cr)
  n = 0
}
FNR == 1 { flush(); cur = FILENAME }
index($0, "\"type\":\"assistant\"") && index($0, "\"usage\":{") {
  m = index($0, "\"message\":{")
  if (!m) next
  head = substr($0, m, 400)
  id = str(head, "id")
  if (id == "") next
  t = $0; p = 0
  while ((i = index(t, "\"usage\":{")) > 0) { p += i + 8; t = substr(t, i + 9) }
  us = substr($0, p, 2000)
  if (!(id in mdl)) {
    ord[++n] = id
    mdl[id] = str(head, "model")
    t = $0; q = 0
    while ((i = index(t, "\"timestamp\":\"")) > 0) { q += i + 12; t = substr(t, i + 13) }
    ts[id] = q ? substr($0, q + 1, 40) : ""
    j = index(ts[id], "\"")
    if (j) ts[id] = substr(ts[id], 1, j - 1)
  }
  inp[id] = max(inp[id], num(us, "input_tokens"))
  out[id] = max(out[id], num(us, "output_tokens"))
  cw[id] = max(cw[id], num(us, "cache_creation_input_tokens"))
  cr[id] = max(cr[id], num(us, "cache_read_input_tokens"))
}
END { flush() }`

/** One assistant message as the extractor printed it; `file` is its transcript's path under the projects folder. */
export type SpendRecord = {
  file: string
  id: string
  model: string
  at: number
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

/** One extractor line, or null for anything else (a cut line, a message with no time). */
export const parseRecord = (line: string): SpendRecord | null => {
  const f = line.replace(/\r$/, '').split('\t')
  if (f.length !== 8) return null
  const at = Date.parse(f[3] ?? '')
  const n = f.slice(4).map(Number)
  if (!f[0] || !f[1] || !Number.isFinite(at) || n.some(x => !Number.isFinite(x) || x < 0)) return null
  const [input, output, cacheWrite, cacheRead] = n as [number, number, number, number]
  return { file: f[0], id: f[1], model: f[2] ?? '', at, input, output, cacheWrite, cacheRead }
}

/** Splits streamed text into whole lines: a line cut between two pieces waits for the rest. */
export const lineSplitter = (): ((piece: string, isEnd?: boolean) => string[]) => {
  let rest = ''
  return (piece, isEnd = false) => {
    const lines = (rest + piece).split('\n')
    rest = isEnd ? '' : (lines.pop() ?? '')
    return lines.filter(Boolean)
  }
}

/** Every token a message used: input, output, cache reads and writes. */
export const recordTokens = (r: SpendRecord): number => r.input + r.output + r.cacheRead + r.cacheWrite

/** The transcript's project folder: the first part of its path under the projects folder. */
export const projectOf = (file: string): string => file.replace(/^\.\//, '').split('/')[0] ?? ''

/**
 * A message copied into a second transcript (a forked sub-agent starts with its
 * parent's turns) counts once. `dupes` is the table of messages known to be in more
 * than one transcript, id to a short hash of the one that owns them, so reading a
 * changed copy alone later still leaves them out. A copy first met in a later read
 * than its original counts again: the table only learns of it when both are read together.
 */
export type Dupes = Record<string, string>

const hash = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}
const DUPES_MAX = 1500
/** The table cut to its newest entries. */
export const capDupes = (d: Dupes): Dupes => {
  const keys = Object.keys(d)
  return keys.length <= DUPES_MAX ? d : Object.fromEntries(keys.slice(-DUPES_MAX).map(k => [k, d[k] as string]))
}
/** A stored table, checked. */
export const cleanDupes = (v: unknown): Dupes => {
  const out: Dupes = {}
  if (v && typeof v === 'object') for (const [k, o] of Object.entries(v as Record<string, unknown>)) if (typeof o === 'string') out[k] = o
  return out
}

/** The records that count, each message once, and the table with the duplicates this read found. */
export const dedupe = (records: Iterable<SpendRecord>, known: Dupes = {}): { kept: SpendRecord[]; dupes: Dupes } => {
  const dupes: Dupes = { ...known }
  const seen = new Map<string, string>()
  const kept: SpendRecord[] = []
  for (const r of records) {
    const owner = dupes[r.id]
    const me = hash(r.file)
    if (owner !== undefined) {
      if (owner === me) kept.push(r)
      continue
    }
    const first = seen.get(r.id)
    if (first !== undefined) {
      if (first !== r.file) dupes[r.id] = hash(first)
      continue
    }
    seen.set(r.id, r.file)
    kept.push(r)
  }
  return { kept, dupes: capDupes(dupes) }
}

/** Records into spend per file per local day. `price` is a message's cost in US dollars. */
export const bucketRecords = (records: Iterable<SpendRecord>, price: (r: SpendRecord) => number): Map<string, SpendDays> => {
  const out = new Map<string, SpendDays>()
  for (const r of records) {
    const tokens = recordTokens(r)
    if (!tokens) continue
    const days = out.get(r.file) ?? {}
    const day = dayKey(r.at)
    const was = days[day] ?? [0, 0]
    days[day] = [round4(was[0] + price(r)), was[1] + tokens]
    out.set(r.file, days)
  }
  return out
}

// --- the CSV ---------------------------------------------------------------------

/** One line of the export: a day's spend on one model in one project. */
export type SpendRow = { day: string; model: string; project: string; cost: number; tokens: number }

/** Records into export rows for the days from `from` to `to`, by day, model and project. */
export const detailRows = (records: Iterable<SpendRecord>, price: (r: SpendRecord) => number, from: string, to: string): SpendRow[] => {
  const out = new Map<string, SpendRow>()
  for (const r of records) {
    const day = dayKey(r.at)
    const tokens = recordTokens(r)
    if (day < from || day > to || !tokens) continue
    const project = projectOf(r.file)
    const key = `${day}\t${r.model}\t${project}`
    const was = out.get(key) ?? { day, model: r.model, project, cost: 0, tokens: 0 }
    out.set(key, { ...was, cost: was.cost + price(r), tokens: was.tokens + tokens })
  }
  return [...out.values()]
}

/**
 * What the ledger holds for the days beyond the rows (transcripts Claude Code has
 * since deleted, or a day's log): one row a day, so the file adds up to the card.
 */
export const gapRows = (rows: readonly SpendRow[], ledger: SpendDays, from: string, to: string): SpendRow[] => {
  const have = new Map<string, [number, number]>()
  for (const r of rows) {
    const was = have.get(r.day) ?? [0, 0]
    have.set(r.day, [was[0] + r.cost, was[1] + r.tokens])
  }
  const out: SpendRow[] = []
  for (const [day, v] of Object.entries(ledger)) {
    if (day < from || day > to) continue
    const [cost, tokens] = [v[0] - (have.get(day)?.[0] ?? 0), v[1] - (have.get(day)?.[1] ?? 0)]
    if (cost > 0.01 || tokens > 1000) out.push({ day, model: 'unattributed', project: '', cost: Math.max(0, cost), tokens: Math.max(0, Math.round(tokens)) })
  }
  return out
}

export const CSV_HEADER = ['ChargePeriodStart', 'ChargePeriodEnd', 'BilledCost', 'PricingCurrency', 'ResourceName', 'ConsumedQuantity', 'ConsumedUnit', 'x_Project'] as const

/** A local midnight as ISO 8601 with its UTC offset ("2026-11-06T00:00:00+08:00"). */
export const isoLocal = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const t = new Date(y, m - 1, d, 0, 0, 0)
  const off = -t.getTimezoneOffset()
  const a = Math.abs(off)
  return `${ymd(t)}T${pad(t.getHours())}:${pad(t.getMinutes())}:00${off === 0 ? 'Z' : `${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`}`
}

/** A cell, quoted when it holds a comma, a quote or a line break. */
export const csvCell = (v: string | number): string => {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const money = (n: number): string => (Math.round(n * 1e6) / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')

/** The FinOps FOCUS-style CSV: one line per day, model and project; a day runs from its midnight to the next. */
export const spendCsv = (rows: readonly SpendRow[]): string => {
  const sorted = [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.model < b.model ? -1 : a.model > b.model ? 1 : a.project < b.project ? -1 : a.project > b.project ? 1 : 0))
  const lines = sorted.map(r =>
    [isoLocal(r.day), isoLocal(shiftDay(r.day, 1)), money(r.cost), 'USD', r.model, r.tokens, 'tokens', r.project].map(csvCell).join(','),
  )
  return `${[CSV_HEADER.join(','), ...lines].join('\n')}\n`
}

/** The export's file name: the first and last day it holds. */
export const csvName = (from: string, to: string): string => `mission-control-spend-${from}-${to}.csv`

// ---------------------------------------------------------------------------
// The engine part. The store holds, under these keys:
//   spendDays   the ledger read from the transcripts, per local day (13 months)
//   spendLog    the per-day count the sessions kept as they ran, merged like `today`
//   spendFiles  per transcript: size, time and its share of the ledger, so a later read
//               redoes only what changed (about 200 KB for a thousand transcripts)
//   spendDupes  messages known to sit in two transcripts
//   spendPeriod the pick; spendLock the session reading right now

/** What the spend card draws from. */
export type SpendState = {
  period: SpendPeriod
  /** The ledger and the log together, a day's larger of the two. */
  days: SpendDays
  /** 'reading' while the history is being read, 'off' where it cannot be read (the ledger alone). */
  status: 'idle' | 'reading' | 'done' | 'off'
  /** The custom range's days as typed. */
  draft: { from: string; to: string }
  /** The last date typed that was not one. */
  error: string
}

/** What register.tsx lends: the atom, the price of a message, the words. */
export type SpendIo = {
  get: ($: EngineInterface) => Promise<SpendState>
  patch: ($: EngineInterface, change: (prev: SpendState) => SpendState) => Promise<void>
  price: (r: SpendRecord) => number
  badDay: (v: string) => string
}

/** Claude Code's configuration folder, and the person's home. */
export type SpendDirs = { config: string; home: string }

const VERSION = 1
const KEEP_MONTHS = 13
const BATCH = 60
const PARALLEL = 3
const DEPTH = 8
const MAX_FILES = 20_000
// Another session reading the transcripts holds this lock; one this old is let go.
const LOCK_MS = 3 * 60_000
// After a turn, the transcripts are read again, at most once a minute.
const RESCAN_MS = 60_000
const ME = Math.random().toString(36).slice(2, 10)
let busy = false
let lastAt = 0

type SpendFile = [size: number, mtimeMs: number, days: SpendDays]
type SpendFiles = { v: number; root: string; files: Record<string, SpendFile> }
type Transcript = { rel: string; size: number; mtimeMs: number }

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const cleanFiles = (v: unknown, root: string, from: string): SpendFiles => {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<SpendFiles>
  if (o.v !== VERSION || o.root !== root || !o.files || typeof o.files !== 'object') return { v: VERSION, root, files: {} }
  const files: Record<string, SpendFile> = {}
  for (const [rel, f] of Object.entries(o.files)) {
    if (Array.isArray(f) && typeof f[0] === 'number' && typeof f[1] === 'number') {
      files[rel] = [f[0], f[1], Object.fromEntries(Object.entries(cleanDays(f[2])).filter(([day]) => day >= from))]
    }
  }
  return { v: VERSION, root, files }
}

/** Every transcript under the folder, by its path from there; null when the listing failed. */
async function listTranscripts($: EngineInterface, root: string): Promise<Transcript[] | null> {
  const out: Transcript[] = []
  const dirs = ['']
  let isListed = false
  while (dirs.length && out.length < MAX_FILES) {
    const rel = dirs.shift() as string
    const entries = await $.fs.list(rel ? `${root}/${rel}` : root).catch(() => null)
    if (!entries) {
      if (!rel) return null
      continue
    }
    isListed = true
    for (const f of entries) {
      const path = rel ? `${rel}/${f.name}` : f.name
      if (f.kind === 'dir' && path.split('/').length <= DEPTH) dirs.push(path)
      else if (f.kind === 'file' && f.name.endsWith('.jsonl') && f.size > 0) out.push({ rel: path, size: f.size, mtimeMs: f.mtimeMs })
    }
  }
  return isListed ? out : null
}

/**
 * One awk over some transcripts, streamed (a transcript can be tens of MB, and the
 * folder GBs, far past what a read or a run returns): their records, and which files
 * it read whole. 'missing' when awk cannot start at all (Windows): the ledger is all there is.
 */
async function extractFiles($: EngineInterface, root: string, rels: string[]): Promise<{ records: SpendRecord[]; read: string[] } | 'missing'> {
  const records: SpendRecord[] = []
  const split = lineSplitter()
  const take = (lines: string[]) => {
    for (const line of lines) {
      const r = parseRecord(line)
      // "./" keeps a name like "-Users-me-project" from reading as an awk option.
      if (r) records.push({ ...r, file: r.file.replace(/^\.\//, '') })
    }
  }
  let code: number | null = null
  let isStarted = false
  try {
    const stream = $.process.spawn({ argv: ['awk', EXTRACT_AWK, ...rels.map(r => `./${r}`)], cwd: root, env: { LC_ALL: 'C' } })
    let step = await stream.next()
    isStarted = true
    while (!step.done) {
      if (step.value.stream === 'stdout') take(split(step.value.text))
      step = await stream.next()
    }
    take(split('', true))
    code = step.value.code
  } catch {
    if (!isStarted) return 'missing'
  }
  if (code === 0) return { records, read: rels }
  // A file gone or unreadable can stop the batch: the rest one by one, the bad one left for later.
  if (rels.length === 1) return { records: [], read: [] }
  const out: { records: SpendRecord[]; read: string[] } = { records: [], read: [] }
  for (const rel of rels) {
    const one = await extractFiles($, root, [rel])
    if (one === 'missing') return 'missing'
    out.records.push(...one.records)
    out.read.push(...one.read)
  }
  return out
}

/** Many transcripts, a few awks at a time: records per batch, the files read whole, and whether awk was missing. */
async function extractMany($: EngineInterface, root: string, rels: string[], onBatch?: () => Promise<void>): Promise<{ records: SpendRecord[]; read: Set<string>; isMissing: boolean }> {
  const batches: string[][] = []
  for (let i = 0; i < rels.length; i += BATCH) batches.push(rels.slice(i, i + BATCH))
  const got: SpendRecord[][] = batches.map(() => [])
  const read = new Set<string>()
  let isMissing = false
  let next = 0
  const worker = async () => {
    while (next < batches.length && !isMissing) {
      const i = next++
      const r = await extractFiles($, root, batches[i] as string[])
      if (r === 'missing') {
        isMissing = true
        return
      }
      got[i] = r.records
      for (const rel of r.read) read.add(rel)
      if (onBatch) await onBatch()
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker))
  return { records: got.flat(), read, isMissing }
}

const setStatus = async ($: EngineInterface, io: SpendIo, status: SpendState['status']): Promise<void> => {
  if ((await io.get($)).status !== status) await io.patch($, prev => ({ ...prev, status }))
}

/** The ledger and the log, read from the store and put together. */
export async function refreshSpendDays($: EngineInterface, io: SpendIo): Promise<void> {
  const days = combineDays(cleanDays(await $.store.get('spendDays').catch(() => undefined)), cleanDays(await $.store.get('spendLog').catch(() => undefined)))
  if (!same(days, (await io.get($)).days)) await io.patch($, prev => ({ ...prev, days }))
}

/**
 * The ongoing log: the day's count the sessions have kept so far (`today`, merged across
 * sessions by the caller) set as that day's entry, never lowered. Returns whether it changed.
 */
export async function logSpendDay($: EngineInterface, io: SpendIo, date: string, cost: number, tokens: number, at: number): Promise<void> {
  if (!isDay(date)) return
  const log = cleanDays(await $.store.get('spendLog').catch(() => undefined))
  const was = log[date]
  if (was && was[0] >= cost && was[1] >= tokens) return
  log[date] = [Math.max(was?.[0] ?? 0, round6(cost)), Math.max(was?.[1] ?? 0, Math.round(tokens))]
  await $.store.set('spendLog', pruneDays(log, at, KEEP_MONTHS))
  await refreshSpendDays($, io)
}

/**
 * Reads the transcripts that changed since the last read into the ledger. `show` puts
 * "Reading history…" on the card while a first read (or a big one) runs. Never throws.
 */
export async function readSpend($: EngineInterface, io: SpendIo, dirs: SpendDirs, show: boolean): Promise<void> {
  if (busy) return
  busy = true
  let isLocked = false
  try {
    lastAt = await $.clock.now()
    const root = dirs.config ? `${dirs.config}/projects` : ''
    if (!root || !(await $.fs.exists(root).catch(() => false))) return await setStatus($, io, 'off')
    // Another session reading now: wait for its ledger rather than read every file twice.
    for (let i = 0; i < 60; i++) {
      const lock = (await $.store.get('spendLock').catch(() => undefined)) as { by?: string; at?: number } | undefined
      if (!lock || lock.by === ME || typeof lock.at !== 'number' || (await $.clock.now()) - lock.at > LOCK_MS) break
      if (show) await setStatus($, io, 'reading')
      await $.clock.sleep(5000)
    }
    const hold = async () => $.store.set('spendLock', { by: ME, at: await $.clock.now() }).catch(() => undefined)
    await hold()
    isLocked = true
    const files = await listTranscripts($, root)
    if (!files) return await setStatus($, io, 'off')
    const from = keepFrom(lastAt, KEEP_MONTHS)
    const kept = cleanFiles(await $.store.get('spendFiles').catch(() => undefined), root, from)
    const changed = files.filter(f => {
      const k = kept.files[f.rel]
      return !k || k[0] !== f.size || k[1] !== f.mtimeMs
    })
    if (show && changed.length && (!Object.keys(kept.files).length || changed.length > 20)) await setStatus($, io, 'reading')
    // Oldest first: a message copied into a later transcript is counted in the first.
    changed.sort((a, b) => a.mtimeMs - b.mtimeMs)
    const got = await extractMany($, root, changed.map(f => f.rel), hold)
    const known = cleanDupes(await $.store.get('spendDupes').catch(() => undefined))
    const { kept: counted, dupes } = dedupe(got.records, known)
    const byFile = bucketRecords(counted, io.price)
    const fresh = new Map<string, SpendFile>(
      changed.filter(f => got.read.has(f.rel)).map(f => [f.rel, [f.size, f.mtimeMs, Object.fromEntries(Object.entries(byFile.get(f.rel) ?? {}).filter(([day]) => day >= from))]]),
    )
    // Files no longer listed: their entries go, their days stay in the ledger.
    const listed = new Set(files.map(f => f.rel))
    const gone: string[] = []
    for (const rel of Object.keys(kept.files).filter(r => !listed.has(r)).slice(0, 2000)) {
      if (!(await $.fs.exists(`${root}/${rel}`).catch(() => true))) gone.push(rel)
    }
    await saveSpend($, io, root, fresh, gone, dupes, lastAt)
    await setStatus($, io, got.isMissing ? 'off' : 'done')
  } catch {
    await setStatus($, io, 'off').catch(() => undefined)
  } finally {
    if (isLocked) {
      const lock = (await $.store.get('spendLock').catch(() => undefined)) as { by?: string } | undefined
      if (lock?.by === ME) await $.store.delete('spendLock').catch(() => undefined)
    }
    busy = false
  }
}

/** Whether a turn's end should read the transcripts again (once a minute at most). */
export const isRescanDue = (at: number): boolean => !busy && at - lastAt >= RESCAN_MS

// Puts what was read into the store's ledger. The store is read again first: another
// session may have read the same file meanwhile, and its share is then already in.
async function saveSpend($: EngineInterface, io: SpendIo, root: string, fresh: Map<string, SpendFile>, gone: string[], dupes: Dupes, at: number): Promise<void> {
  const from = keepFrom(at, KEEP_MONTHS)
  const kept = cleanFiles(await $.store.get('spendFiles').catch(() => undefined), root, from)
  const stored = cleanDays(await $.store.get('spendDays').catch(() => undefined))
  let ledger = stored
  let isChanged = gone.some(rel => rel in kept.files)
  for (const [rel, f] of fresh) {
    const was = kept.files[rel]
    if (was && was[0] === f[0] && was[1] === f[1]) continue
    ledger = applyDelta(ledger, was?.[2] ?? {}, f[2])
    kept.files[rel] = f
    isChanged = true
  }
  for (const rel of gone) delete kept.files[rel]
  ledger = pruneDays(ledger, at, KEEP_MONTHS)
  // Nothing new: the store is not written again (the file list is a few hundred KB).
  if (isChanged) await $.store.set('spendFiles', kept)
  if (isChanged || !same(ledger, stored)) await $.store.set('spendDays', ledger)
  const was = cleanDupes(await $.store.get('spendDupes').catch(() => undefined))
  const all = capDupes({ ...was, ...dupes })
  if (!same(all, was)) await $.store.set('spendDupes', all)
  await refreshSpendDays($, io)
}

// --- the picks ---------------------------------------------------------------------

/** The kept pick and ledger now, at the session start; the transcripts are read later. */
export async function loadSpend($: EngineInterface, io: SpendIo): Promise<void> {
  const period = cleanPeriod(await $.store.get('spendPeriod').catch(() => undefined))
  await io.patch($, prev => ({ ...prev, period, draft: period.kind === 'custom' ? { from: period.from, to: period.to } : prev.draft }))
  await refreshSpendDays($, io)
}

export async function setSpendPeriod($: EngineInterface, io: SpendIo, period: SpendPeriod): Promise<void> {
  await $.store.set('spendPeriod', period).catch(() => undefined)
  await io.patch($, prev => ({ ...prev, period, error: '', draft: period.kind === 'custom' ? { from: period.from, to: period.to } : prev.draft }))
}

/** A month picked: the month itself, or the next/previous one from the buttons. */
export const pickSpendMonth = ($: EngineInterface, io: SpendIo, month: string): Promise<void> =>
  setSpendPeriod($, io, { ...TODAY_PERIOD, kind: 'month', month: isMonth(month) ? month : '' })

/** A pick from the period list or its buttons. Custom starts from the days last typed, else the first of this month to today. */
export async function pickSpendKind($: EngineInterface, io: SpendIo, kind: SpendKind): Promise<void> {
  const at = await $.clock.now()
  const sp = await io.get($)
  if (kind === sp.period.kind && kind !== 'month') return
  if (kind !== 'custom') return setSpendPeriod($, io, { ...TODAY_PERIOD, kind })
  const from = isDay(sp.draft.from) ? sp.draft.from : `${monthOf(at)}-01`
  const to = isDay(sp.draft.to) ? sp.draft.to : dayKey(at)
  return setSpendPeriod($, io, { ...TODAY_PERIOD, kind: 'custom', from: from <= to ? from : to, to: from <= to ? to : from })
}

/** A day typed into the custom range's From or To field. */
export async function typeSpendDay($: EngineInterface, io: SpendIo, which: 'from' | 'to', value: string): Promise<void> {
  const v = value.trim()
  if (!isDay(v)) {
    await io.patch($, prev => ({ ...prev, error: io.badDay(v) }))
    return
  }
  const sp = await io.get($)
  const draft = { ...sp.draft, [which]: v }
  const other = which === 'from' ? draft.to : draft.from
  if (!isDay(other)) {
    await io.patch($, prev => ({ ...prev, draft, error: '' }))
    return
  }
  const [from, to] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from]
  await setSpendPeriod($, io, { ...TODAY_PERIOD, kind: 'custom', from, to })
}

/**
 * What the card shows for the period: the ledger's days, with this session's live
 * count for today where it is larger.
 */
export const spendCard = (sp: SpendState, live: { date: string; cost: number; tokens: number } | undefined, at: number, w: SpendWords): { label: string; cost: number; tokens: number; days: number; isToday: boolean; from: string; to: string } => {
  const r = rangeOf(sp.period, at)
  const sum = sumRange(sp.days, r.from, r.to, live?.date ? live : undefined)
  return { label: periodLabel(sp.period, at, w), cost: sum.cost, tokens: sum.tokens, days: daysIn(r.from, r.to), isToday: sp.period.kind === 'today', from: r.from, to: r.to }
}

// --- the export ----------------------------------------------------------------------

/** What an export wrote: where, how many lines, the sums; or `error`. `note` says where it fell back to the ledger alone. */
export type SpendExport = { error?: string; path: string; lines: number; cost: number; tokens: number; from: string; to: string; note: string }

/**
 * Writes the period as a FOCUS-style CSV into the home folder's Downloads: the rows come
 * from the transcripts still on disk (by model and project), and a row "unattributed"
 * stands for what the ledger holds beyond them (transcripts Claude Code has deleted), so
 * the file adds up to the card. Never throws.
 */
export async function exportSpend($: EngineInterface, io: SpendIo, dirs: SpendDirs, period: SpendPeriod, at: number): Promise<SpendExport> {
  const { from, to } = rangeOf(period, at)
  const out: SpendExport = { path: '', lines: 0, cost: 0, tokens: 0, from, to, note: '' }
  if (!dirs.home) return { ...out, error: 'Cannot export: no home folder found for Downloads.' }
  let rows: SpendRow[] = []
  const root = dirs.config ? `${dirs.config}/projects` : ''
  const files = root ? await listTranscripts($, root).catch(() => null) : null
  if (!files) out.note = 'no transcripts to read, so only the ledger'
  else {
    // A transcript last written before the first day cannot hold a message from it.
    const start = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10))).getTime()
    const got = await extractMany($, root, files.filter(f => f.mtimeMs >= start).map(f => f.rel))
    if (got.isMissing) out.note = 'awk not found, so only the ledger'
    const { kept } = dedupe(got.records, cleanDupes(await $.store.get('spendDupes').catch(() => undefined)))
    rows = detailRows(kept, io.price, from, to)
  }
  const ledger = combineDays(cleanDays(await $.store.get('spendDays').catch(() => undefined)), cleanDays(await $.store.get('spendLog').catch(() => undefined)))
  rows = [...rows, ...gapRows(rows, ledger, from, to)]
  const path = `${dirs.home}/Downloads/${csvName(from, to)}`
  try {
    await $.fs.write(path, spendCsv(rows))
  } catch {
    return { ...out, error: `Could not write ${path}.` }
  }
  return { ...out, path, lines: rows.length, cost: rows.reduce((n, r) => n + r.cost, 0), tokens: rows.reduce((n, r) => n + r.tokens, 0) }
}
