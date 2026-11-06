// Machine Guard: size Claude's crew to the machine and let the person cap Claude's RAM.
//
// Pure functions only. The OS commands and their parsers live in probeunix.ts and
// probewin.ts; register.tsx runs them, keeps the atoms, and does the toasting and the
// denying. Nothing here reads `$`, the clock or the store.

const GIB = 1024 ** 3

/** What was found on the machine, whole numbers of GB where it matters. `known` is false when detection failed. */
export type Machine = { os: 'mac' | 'windows' | 'linux' | 'unknown'; totalBytes: number; freeBytes: number; cores: number; known: boolean }
/** The probe's raw answer: nulls where a number could not be read. */
export type RawMachine = { os: Machine['os']; totalBytes: number | null; freeBytes: number | null; cores: number | null }
/** One process of the machine, as the probes list them. */
export type Proc = { pid: number; ppid: number; rssBytes: number; name: string }

/** Agents the crew may run at once when the machine is unknown: modest, never a trap. */
export const UNKNOWN_MAX_AGENTS = 4
export const MAX_AGENTS_CAP = 8
/** A new agent is refused when less than this share of RAM is free. */
export const MIN_FREE_PCT = 10
/** Windows' "free physical" leaves out the standby cache, so it reads low: a lower bar there. */
export const MIN_FREE_PCT_WINDOWS = 5
export const minFreePct = (os: Machine['os']): number => (os === 'windows' ? MIN_FREE_PCT_WINDOWS : MIN_FREE_PCT)
/** The default RAM limit: half of the machine. */
export const AUTO_RAM_PCT = 50
/** How often the guard looks at free RAM while work runs. */
export const SAMPLE_EVERY_MS = 15_000

export const gbOf = (bytes: number): number => bytes / GIB
export const roundGb = (bytes: number): number => Math.max(0, Math.round(gbOf(bytes) * 10) / 10)
const osName = (os: Machine['os']): string => (os === 'mac' ? 'Mac' : os === 'windows' ? 'Windows PC' : os === 'linux' ? 'Linux machine' : 'machine')

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** The machine from a probe's answer; anything unreadable makes it unknown (and nothing is refused on a guess). */
export function machineOf(raw: RawMachine | null | undefined): Machine {
  const total = num(raw?.totalBytes)
  const cores = num(raw?.cores)
  if (!raw || total === null) return UNKNOWN_MACHINE
  const free = num(raw.freeBytes)
  return { os: raw.os, totalBytes: total, freeBytes: free === null ? 0 : Math.min(free, total), cores: cores === null ? 0 : Math.round(cores), known: free !== null && cores !== null }
}
export const UNKNOWN_MACHINE: Machine = { os: 'unknown', totalBytes: 0, freeBytes: 0, cores: 0, known: false }

/** The one line for the Settings pane: "48 GB RAM · 12 cores · Mac", or "unknown machine". */
export function machineLine(m: Machine): string {
  if (!m.totalBytes) return 'unknown machine'
  const parts = [`${Math.round(gbOf(m.totalBytes))} GB RAM`]
  if (m.cores) parts.push(`${m.cores} cores`)
  parts.push(osName(m.os))
  return parts.join(' · ')
}

/**
 * The default crew size: one agent per 8 GB of RAM, 1 to 8, and no more than half the
 * cores. 8 GB gives 1, 16 GB 2, 48 GB 6. An unknown machine gets UNKNOWN_MAX_AGENTS.
 */
export function calibrate(m: Machine): number {
  if (!m.totalBytes) return UNKNOWN_MAX_AGENTS
  const byRam = Math.floor(gbOf(m.totalBytes) / 8 + 1e-9)
  const byCpu = m.cores ? Math.floor(m.cores / 2) : MAX_AGENTS_CAP
  return Math.max(1, Math.min(MAX_AGENTS_CAP, byRam, byCpu))
}

// ---- the settings: "RAM Claude may use" and "Max agents at once" -----------------

/** 'auto', 'pct:25' or 'gb:12': a string, so a Pick can hold it as one of its options. */
export type RamLimit = string
export const RAM_PCTS = [25, 50, 75] as const

/** A stored or typed value cleaned to a RamLimit; anything else is 'auto'. */
export function cleanRamLimit(v: unknown): RamLimit {
  if (typeof v !== 'string') return 'auto'
  const m = /^(pct|gb):(\d+(?:\.\d+)?)$/.exec(v.trim())
  if (!m) return 'auto'
  const n = Number(m[2])
  if (!(n > 0)) return 'auto'
  if (m[1] === 'pct') return n <= 100 ? `pct:${Math.round(n)}` : 'auto'
  return `gb:${Math.round(n * 10) / 10}`
}

/** A typed amount ("12", "12 GB", "12gb") as a RamLimit, or null when it is not a positive number. */
export function typedRamLimit(typed: string): RamLimit | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:gb|g|gib)?\s*$/i.exec(typed)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 ? cleanRamLimit(`gb:${n}`) : null
}

/** What the limit comes to in bytes on this machine; null when the machine is unknown. */
export function ramLimitBytes(limit: unknown, totalBytes: number): number | null {
  if (!totalBytes) return null
  const v = cleanRamLimit(limit)
  if (v === 'auto') return totalBytes * (AUTO_RAM_PCT / 100)
  const [kind, n] = v.split(':') as [string, string]
  const bytes = kind === 'pct' ? totalBytes * (Number(n) / 100) : Number(n) * GIB
  return Math.min(bytes, totalBytes)
}

/** The Pick's options; a typed GB value joins them so the Pick's value is always one of its options. */
export function ramLimitOptions(current: unknown): { value: string; label: string }[] {
  const now = cleanRamLimit(current)
  const base = [
    { value: 'auto', label: `Auto (${AUTO_RAM_PCT}%)` },
    ...RAM_PCTS.map(p => ({ value: `pct:${p}`, label: `${p}%` })),
  ]
  if (now.startsWith('gb:') || (now.startsWith('pct:') && !base.some(o => o.value === now))) base.push({ value: now, label: now.startsWith('gb:') ? `${now.slice(3)} GB` : `${now.slice(4)}%` })
  return base
}

/** The max-agents setting: 0 is Auto, otherwise 1 to 8. */
export function cleanMaxAgents(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(MAX_AGENTS_CAP, n) : 0
}
export const maxAgentsOptions = (calibrated: number): { value: string; label: string }[] => [
  { value: '0', label: `Auto (${calibrated})` },
  ...Array.from({ length: MAX_AGENTS_CAP }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
]
/** The crew size in force: the person's number, else the calibrated one. */
export const effectiveMax = (setting: unknown, calibrated: number): number => cleanMaxAgents(setting) || calibrated

// ---- Claude's own use of RAM -----------------------------------------------------

const baseName = (name: string): string => (name.split(/[\\/]/).pop() ?? '').replace(/\.exe$/i, '').trim().toLowerCase()

/**
 * Bytes held by Claude's process trees: every process called `claude` whose parent is
 * not one, and all of its descendants (tsc, test runners, shells). Null when no Claude
 * process is in the list, so the caller falls back to the system-wide used RAM.
 */
export function claudeBytes(procs: readonly Proc[]): number | null {
  if (!procs.length) return null
  const isClaude = (p: Proc) => baseName(p.name) === 'claude'
  const byPid = new Map(procs.map(p => [p.pid, p]))
  const kids = new Map<number, Proc[]>()
  for (const p of procs) kids.set(p.ppid, [...(kids.get(p.ppid) ?? []), p])
  const roots = procs.filter(p => isClaude(p) && !(byPid.get(p.ppid) && isClaude(byPid.get(p.ppid) as Proc)))
  if (!roots.length) return null
  const seen = new Set<number>()
  let sum = 0
  const walk = (p: Proc) => {
    if (seen.has(p.pid)) return
    seen.add(p.pid)
    sum += Math.max(0, p.rssBytes)
    for (const c of kids.get(p.pid) ?? []) walk(c)
  }
  for (const r of roots) walk(r)
  return sum
}

// ---- the verdict -----------------------------------------------------------------

export type Kind = 'agents' | 'ram' | 'free'
export type GuardInput = {
  machine: Machine
  running: number
  maxAgents: number
  /** The RAM limit in bytes; null when unknown. */
  limitBytes: number | null
  /** Claude's own use, or null when it could not be measured. */
  claudeBytes: number | null
  /** Free RAM as of the last sample; null before the first one. */
  freeBytes: number | null
}

export const usedBytes = (g: GuardInput): number | null => (g.machine.totalBytes && g.freeBytes !== null ? Math.max(0, g.machine.totalBytes - g.freeBytes) : null)
export const freePct = (g: GuardInput): number | null => (g.machine.totalBytes && g.freeBytes !== null ? Math.round((g.freeBytes / g.machine.totalBytes) * 100) : null)
/** Claude's use if measured, else the whole system's. */
const measured = (g: GuardInput): number | null => g.claudeBytes ?? usedBytes(g)

/** Whether RAM is tight: over the limit, or less than MIN_FREE_PCT free. Never on an unknown machine. */
export function tightKind(g: GuardInput): 'ram' | 'free' | null {
  if (!g.machine.known) return null
  const free = freePct(g)
  if (free !== null && free < minFreePct(g.machine.os)) return 'free'
  const use = measured(g)
  if (g.limitBytes !== null && use !== null && use > g.limitBytes) return 'ram'
  return null
}

/** Why a new agent is refused, or null to let it start. The reason is short; Claude reads it. */
export function guardVerdict(g: GuardInput): { kind: Kind; reason: string } | null {
  const here = g.machine.totalBytes ? `on this ${Math.round(gbOf(g.machine.totalBytes))} GB ${osName(g.machine.os)}` : 'on this machine'
  if (g.running >= g.maxAgents) {
    return { kind: 'agents', reason: `Machine Guard: ${g.running} of ${g.maxAgents} agents running ${here}. Wait for one to finish, or raise the limit in Settings.` }
  }
  const tight = tightKind(g)
  if (tight === 'free') {
    return { kind: 'free', reason: `Machine Guard: only ${freePct(g)}% of RAM is free ${here}. Wait for running work to finish before starting another agent.` }
  }
  if (tight === 'ram') {
    return { kind: 'ram', reason: `Machine Guard: Claude is using ${roundGb(measured(g) ?? 0)} GB, over its ${roundGb(g.limitBytes ?? 0)} GB RAM limit ${here}. Wait for running work to finish, or raise the limit in Settings.` }
  }
  return null
}

/** The Machine Guard rule in the system prompt: always the first two lines, a stronger one when RAM is tight. */
export function ruleText(maxAgents: number, isTight: boolean): string {
  const lines = [
    'Machine Guard: run heavy commands (test suites, type checks, builds) one at a time, never in parallel across agents.',
    `Run at most ${maxAgents} sub-agent${maxAgents === 1 ? '' : 's'} at once on this machine.`,
  ]
  if (isTight) lines.push('RAM is tight: run no new agents and no heavy commands until it frees up.')
  return lines.join(' ')
}

// ---- warn once, re-arm on recovery -------------------------------------------------

export type Warned = readonly Kind[]
/**
 * The warned kinds after one look, and whether to toast now. A kind that trips while
 * armed toasts once and disarms; it arms again only after a look at which it did not
 * trip, so a guard that stays tripped never repeats itself.
 */
export function noteTrip(warned: Warned, kind: Kind, isTripped: boolean): { warned: Warned; toast: boolean } {
  const has = warned.includes(kind)
  if (!isTripped) return has ? { warned: warned.filter(k => k !== kind), toast: false } : { warned, toast: false }
  return has ? { warned, toast: false } : { warned: [...warned, kind], toast: true }
}

/** System RAM in use, whole percent; null before the first sample. */
export function usedPct(g: GuardInput): number | null {
  const used = usedBytes(g)
  return used === null || !g.machine.totalBytes ? null : Math.round((used / g.machine.totalBytes) * 100)
}
/** The small line for the band: "RAM 62% · 3/6 agents". `pct` null (no sample yet) shows a "?". */
export const hudLine = (pct: number | null, running: number, max: number): string => `${pct === null ? 'RAM ?' : `RAM ${pct}%`} · ${running}/${max} agents`
export const hudText = (g: GuardInput): string => hudLine(usedPct(g), g.running, g.maxAgents)
