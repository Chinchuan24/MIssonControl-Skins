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
/** A sanity ceiling on the crew: the only upper bound, far above any real machine. */
export const MAX_AGENTS_SANITY = 200
/** What one agent is assumed to cost until this machine has taught us otherwise. */
export const DEFAULT_AGENT_GB = 0.5
export const MIN_AGENT_GB = 0.2
export const MAX_AGENT_GB = 4
/** The weight of a new per-agent sample in the learned figure. */
export const AGENT_EMA = 0.2
const DEFAULT_AGENT_BYTES = DEFAULT_AGENT_GB * GIB
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

/** GB as people say it: 15, 0.5, 7.5 (one decimal at most). */
export const fmtGb = (gb: number): string => {
  const r = Math.round(gb * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
export const fmtGbBytes = (bytes: number): string => fmtGb(gbOf(bytes))

// ---- RAM per agent: a default, then learned from this machine ---------------------

const clampAgentBytes = (b: number): number => Math.min(MAX_AGENT_GB * GIB, Math.max(MIN_AGENT_GB * GIB, b))

/** What one agent costs, in bytes: the learned figure if there is one, else the default. */
export const perAgentBytes = (learned: number | null | undefined): number => (typeof learned === 'number' && Number.isFinite(learned) && learned > 0 ? clampAgentBytes(learned) : DEFAULT_AGENT_BYTES)

/**
 * One sample of the cost of an agent: what Claude's process tree holds beyond its
 * baseline (measured with 0 agents), shared by the N agents running. Null when the
 * process read failed, there is no baseline, no agent runs, or the tree is no bigger
 * than the baseline.
 */
export function agentSample(claude: number | null, baseline: number | null, agents: number): number | null {
  if (claude === null || baseline === null || !(agents >= 1)) return null
  const extra = claude - baseline
  return extra > 0 ? extra / agents : null
}

/** The learned figure after one more sample: an EMA seeded from the default, clamped to 0.2-4 GB. A null sample changes nothing. */
export function learnAgentBytes(learned: number | null, sample: number | null): number | null {
  if (sample === null || !Number.isFinite(sample)) return learned
  const prev = perAgentBytes(learned)
  return clampAgentBytes(prev * (1 - AGENT_EMA) + clampAgentBytes(sample) * AGENT_EMA)
}

/** The Settings line: "≈0.5 GB per agent (learned)" or "(default)". */
export const perAgentLine = (bytes: number, isLearned: boolean): string => `≈${fmtGbBytes(bytes)} GB per agent (${isLearned ? 'learned' : 'default'})`

/**
 * Max agents at once from the RAM limit alone: floor(limit / RAM per agent), 1 to 200.
 * Nothing else counts: not what is in use now, not the cores. No limit (an unknown
 * machine under a % limit) gives UNKNOWN_MAX_AGENTS.
 */
export function calibrate(limitBytes: number | null, perAgent: number = DEFAULT_AGENT_BYTES): number {
  if (limitBytes === null || !(limitBytes > 0) || !(perAgent > 0)) return UNKNOWN_MAX_AGENTS
  return Math.max(1, Math.min(MAX_AGENTS_SANITY, Math.floor(limitBytes / perAgent + 1e-9)))
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
  // Rounded first: a value that rounds to 0 (pct:0.4, gb:0.01) would refuse every agent.
  const n = m[1] === 'pct' ? Math.round(Number(m[2])) : Math.round(Number(m[2]) * 10) / 10
  if (!(n > 0)) return 'auto'
  if (m[1] === 'pct') return n <= 100 ? `pct:${n}` : 'auto'
  return `gb:${n}`
}

/** A typed amount ("12", "12 GB", "12gb") as a RamLimit, or null when it is not a positive number. */
export function typedRamLimit(typed: string): RamLimit | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:gb|g|gib)?\s*$/i.exec(typed)
  if (!m) return null
  const v = cleanRamLimit(`gb:${Number(m[1])}`)
  return v === 'auto' ? null : v
}

/**
 * What the limit comes to in bytes. A percentage (and Auto) needs the machine's size, so
 * it is null when the machine is unknown; a typed GB amount stands on its own.
 */
export function ramLimitBytes(limit: unknown, totalBytes: number): number | null {
  const v = cleanRamLimit(limit)
  const [kind, n] = v.split(':') as [string, string | undefined]
  if (kind === 'gb') {
    const bytes = Number(n) * GIB
    return totalBytes ? Math.min(bytes, totalBytes) : bytes
  }
  if (!totalBytes) return null
  return totalBytes * ((kind === 'pct' ? Number(n) : AUTO_RAM_PCT) / 100)
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

/** The max-agents setting: 0 is Auto, otherwise a whole number up to the sanity ceiling. */
export function cleanMaxAgents(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(MAX_AGENTS_SANITY, n) : 0
}
/** A typed crew size ("12"), or null when it is not a positive whole number. */
export function typedMaxAgents(typed: string): number | null {
  const m = /^\s*(\d+)\s*$/.exec(typed)
  const n = m ? cleanMaxAgents(Number(m[1])) : 0
  return n || null
}
export const MAX_AGENTS_STEPS = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64] as const
/** Auto's label: "Auto · 30 (15 GB ÷ 0.5 GB)", or why there is no sum. */
export const autoMaxLabel = (calibrated: number, limitBytes: number | null, perAgent: number): string =>
  limitBytes === null ? `Auto · ${calibrated} (machine unknown)` : `Auto · ${calibrated} (${fmtGbBytes(limitBytes)} GB ÷ ${fmtGbBytes(perAgent)} GB)`
/** The Pick's options; a typed number joins them so the Pick's value is always one of its options. */
export function maxAgentsOptions(autoLabel: string, current: unknown): { value: string; label: string }[] {
  const now = cleanMaxAgents(current)
  const steps: number[] = [...new Set<number>([...MAX_AGENTS_STEPS, ...(now ? [now] : [])])].sort((a, b) => a - b)
  return [{ value: '0', label: autoLabel }, ...steps.map(n => ({ value: String(n), label: String(n) }))]
}
/** The crew size in force: the person's number, else the calibrated one. */
export const effectiveMax = (setting: unknown, calibrated: number): number => cleanMaxAgents(setting) || calibrated
/** The toast after a change: "RAM limit 15 GB → up to 30 agents at once". */
export const limitToast = (limitBytes: number | null, max: number): string =>
  `${limitBytes === null ? 'RAM limit unknown' : `RAM limit ${fmtGbBytes(limitBytes)} GB`} → up to ${max} agent${max === 1 ? '' : 's'} at once`

// ---- Claude's own use of RAM -----------------------------------------------------

const baseName = (name: string): string => (name.split(/[\\/]/).pop() ?? '').replace(/\.exe$/i, '').trim().toLowerCase()

/**
 * Bytes held by Claude's process trees: every process called `claude` whose parent is
 * not one, and all of its descendants (tsc, test runners, shells). Null when no Claude
 * process is in the list, so the caller falls back to the system-wide used RAM.
 * `skipHeavy` leaves out the subtrees of heavy tools (tsc, jest, make...), by process name.
 */
export function claudeBytes(procs: readonly Proc[], skipHeavy = false): number | null {
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
    // For learning what an agent costs: a type check or test run (and what it spawned) is not the agent's.
    if (skipHeavy && HEAVY_TOOLS.has(baseName(p.name))) return
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
  /** What one agent costs (learned or the default), for the reasons Claude reads. */
  perAgentBytes?: number
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

/** "RAM limit 15 GB at ≈0.5 GB each" or "this machine", for the reasons. */
const basisOf = (g: GuardInput): string =>
  g.limitBytes === null ? 'on this machine' : `(RAM limit ${fmtGbBytes(g.limitBytes)} GB, ≈${fmtGbBytes(g.perAgentBytes ?? DEFAULT_AGENT_BYTES)} GB per agent)`

/** Why a new agent is refused, or null to let it start. The reason is short; Claude reads it. */
export function guardVerdict(g: GuardInput): { kind: Kind; reason: string } | null {
  const here = g.machine.totalBytes ? `on this ${Math.round(gbOf(g.machine.totalBytes))} GB ${osName(g.machine.os)}` : 'on this machine'
  if (g.running >= g.maxAgents) {
    return { kind: 'agents', reason: `Machine Guard: ${g.running} of ${g.maxAgents} agents running ${basisOf(g)}. Wait for one to finish, or raise the limit in Settings.` }
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

/**
 * The Machine Guard rule in the system prompt: the limit and what it allows, in one line
 * Claude cannot misread; a stronger line when RAM is tight.
 */
export function ruleText(limitBytes: number | null, perAgent: number, max: number, calibrated: number, isTight: boolean): string {
  const crew = `${max} agent${max === 1 ? '' : 's'}`
  const head =
    limitBytes === null
      ? `Machine Guard: this machine could not be measured, so run at most ${crew} at once.`
      : max === calibrated
        ? `Machine Guard: Claude may use ${fmtGbBytes(limitBytes)} GB of RAM \u2192 at most ${crew} at once (\u2248${fmtGbBytes(perAgent)} GB each).`
        : `Machine Guard: Claude may use ${fmtGbBytes(limitBytes)} GB of RAM, and the person set the crew to at most ${crew} at once.`
  const lines = [head, 'Run heavy commands (test suites, type checks, builds) one at a time; the guard makes a second one wait.']
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
/** What Claude uses, in GB, or null when nothing has been measured. */
export const useGb = (g: GuardInput): number | null => {
  const m = measured(g)
  return m === null ? null : gbOf(m)
}
/** The band's line: "RAM 9.1/15 GB · 3/30 agents". A null `usedGb` (no sample yet) shows "?"; a null limit is left out. */
export const hudLine = (usedGb: number | null, limitGb: number | null, running: number, max: number): string =>
  `RAM ${usedGb === null ? '?' : fmtGb(usedGb)}${limitGb === null ? ' GB' : `/${fmtGb(limitGb)} GB`} \u00b7 ${running}/${max} agents`
export const hudText = (g: GuardInput): string => hudLine(useGb(g), g.limitBytes === null ? null : gbOf(g.limitBytes), g.running, g.maxAgents)
/** The machine in two words: "48 GB Mac"; '' when unknown. */
export const shortMachine = (m: Machine): string => (m.totalBytes ? `${Math.round(gbOf(m.totalBytes))} GB ${osName(m.os)}` : '')
/**
 * The one Machine Guard line of the desktop pane and the band: "RAM 9.1/15 GB · 3/30 agents"
 * while work runs, else "15 GB limit · up to 30 agents". Negative numbers mean unknown.
 */
export function paneLine(limitGb: number, usedGb: number, running: number, max: number, isWorking: boolean): string {
  if (isWorking) return `\u{1F6E1}\uFE0E ${hudLine(usedGb >= 0 ? usedGb : null, limitGb > 0 ? limitGb : null, running, max)}`
  return `\u{1F6E1}\uFE0E ${limitGb > 0 ? `${fmtGb(limitGb)} GB limit \u00b7 ` : ''}up to ${max} agent${max === 1 ? '' : 's'}`
}
/** An agent the crew counts: started or about to, and not ended or idle between turns. */
export const isLiveAgent = (status: string): boolean => status === 'running' || status === 'pending' || status === 'waiting'

// ---- the heavy-command lock ------------------------------------------------------
// Only one heavy command (a type check, a test run, a build) runs at a time across the main
// loop and every sub-agent: 39 of them at once is what brought a machine down.

/** How long a second heavy command waits for the first before it is refused. */
export const LOCK_WAIT_MS = 5 * 60_000
/** A lock whose release was lost frees itself after this long. */
export const LOCK_STALE_MS = 15 * 60_000

const HEAVY_TOOLS = new Set(['tsc', 'jest', 'vitest', 'mocha', 'pytest', 'py.test', 'make', 'gmake', 'gradle', 'gradlew', 'xcodebuild'])
const LAUNCHERS = new Set(['npx', 'bunx', 'pnpx'])
const WRAPPERS = new Set(['time', 'nice', 'sudo', 'env', 'command', 'exec', 'nohup', 'caffeinate', 'builtin'])
const PKG_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun'])
const SCRIPT = /^(test|build)(:\S*)?$/

const tail = (tok: string): string => (tok.split('/').pop() ?? '').toLowerCase()

/** The name of the heavy command a segment starts, or null. Tokens are already split and unquoted. */
function heavyTokens(toks: string[]): string | null {
  let t = toks
  while (t.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0] as string) || WRAPPERS.has(tail(t[0] as string)) || /^-/.test(t[0] as string))) t = t.slice(1)
  const first = tail(t[0] ?? '')
  if (!first) return null
  if (HEAVY_TOOLS.has(first)) return first === 'gradlew' ? 'gradle' : first
  if (LAUNCHERS.has(first) || (['pnpm', 'yarn'].includes(first) && ['dlx', 'exec'].includes(t[1] ?? '')) || (first === 'npm' && t[1] === 'exec') || (first === 'bun' && t[1] === 'x')) {
    const hit = t.slice(1).map(tail).find(x => HEAVY_TOOLS.has(x))
    if (hit) return hit
  }
  if (PKG_MANAGERS.has(first)) {
    const rest = t.slice(1).filter(x => !x.startsWith('-'))
    const script = rest[0] === 'run' ? rest[1] : rest[0]
    if (script && SCRIPT.test(script)) return `${first} ${rest[0] === 'run' ? 'run ' : ''}${script}`
  }
  if (first === 'claude' && t[1] === 'plugin' && t[2] === 'test') return 'plugin test'
  if (first === 'cargo' && (t[1] === 'build' || t[1] === 'test')) return `cargo ${t[1]}`
  if (first === 'go' && (t[1] === 'build' || t[1] === 'test')) return `go ${t[1]}`
  if (first === 'docker' && t[1] === 'build') return 'docker build'
  if (/^python[0-9.]*$/.test(first) && t[1] === '-m' && (t[2] === 'pytest' || t[2] === 'unittest')) return `python -m ${t[2]}`
  return null
}

/**
 * Which heavy command a Bash command line runs, or null for anything else: type checks
 * (tsc), test runners (jest, vitest, mocha, pytest, `plugin test`, `npm test`) and builds
 * (`npm run build`, cargo, go, make, gradle, xcodebuild, docker build). Each part of a
 * pipeline or `&&` chain counts; text inside quotes does not, except in `sh -c "..."`.
 */
export function heavyCommand(command: unknown, depth = 0): string | null {
  if (typeof command !== 'string' || !command.trim() || depth > 2) return null
  const inner: string[] = []
  // Quoted text is set aside: `git commit -m "fix tsc"` runs no tsc.
  const bare = command.replace(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g, (_m, d: string | undefined, sq: string | undefined, at: number) => {
    const text = d ?? sq ?? ''
    inner.push(text)
    // A quoted program path ("/Applications/Claude.app/.../claude" plugin test) is the command itself.
    return /(^|[;&|(\n])\s*$/.test(command.slice(0, at)) ? text.replace(/\s+/g, '_') : '""'
  })
  const segments = bare.split(/&&|\|\||[;|&\n()]/)
  for (const seg of segments) {
    const toks = seg.trim().split(/\s+/).filter(Boolean)
    const hit = heavyTokens(toks)
    if (hit) return hit
    const sh = toks.findIndex(x => ['sh', 'bash', 'zsh'].includes(tail(x)))
    if (sh >= 0 && toks.some(x => /^-[a-z]*c$/.test(x))) for (const q of inner) {
      const nested = heavyCommand(q, depth + 1)
      if (nested) return nested
    }
  }
  return null
}

/** Who holds the one heavy-command lock, and since when (the clock's ms). */
export type HeavyLock = { owner: string; label: string; since: number }

/** The holder, or null when nobody holds it or the hold is older than LOCK_STALE_MS (a lost release). */
export const lockHolder = (lock: HeavyLock | null, now: number): HeavyLock | null => (lock && now - lock.since < LOCK_STALE_MS ? lock : null)

/** One try at the lock: the new state, and whether `owner` now holds it. */
export function lockTry(lock: HeavyLock | null, owner: string, label: string, now: number): { lock: HeavyLock | null; got: boolean } {
  const holder = lockHolder(lock, now)
  if (holder && holder.owner !== owner) return { lock, got: false }
  return { lock: { owner, label, since: holder ? holder.since : now }, got: true }
}

/** The lock after `owner` lets go: untouched when someone else holds it now. */
export const lockRelease = (lock: HeavyLock | null, owner: string): HeavyLock | null => (lock && lock.owner === owner ? null : lock)

/** Why a heavy command waits no longer. */
export const lockDenyReason = (label: string): string => `Machine Guard: another heavy command (${label}) is running; retry when it finishes.`

/** Why a NEW heavy command is refused while Claude is over its RAM limit, or null. */
export function heavyRamVerdict(g: GuardInput, label: string): string | null {
  if (tightKind(g) !== 'ram') return null
  return `Machine Guard: Claude is using ${roundGb(measured(g) ?? 0)} GB, over its ${roundGb(g.limitBytes ?? 0)} GB RAM limit; not starting a heavy command (${label}). Wait for running work to finish, or raise the limit in Settings.`
}

/**
 * Whether a process read may teach the cost of an agent: no heavy command holds the lock now,
 * and none started or ended since the read began (`seqBefore` / `seqNow` count lock changes).
 */
export const canLearn = (isLockHeld: boolean, seqBefore: number, seqNow: number): boolean => !isLockHeld && seqBefore === seqNow
/** A process read older than this is not trusted to refuse anything. */
export const FRESH_MS = 5_000
