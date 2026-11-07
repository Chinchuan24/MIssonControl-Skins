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
export type Proc = { pid: number; ppid: number; rssBytes: number; name: string; /** The whole command line, when the kill switch looked for it. */ args?: string }

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
  /** More than one live session shares the budget: `running` counts them all; `here` is this session's own. `others` says where the rest are. */
  sessions?: { count: number; here: number; others: string }
  /** The last process read failed: Claude's use is unknown, so nothing is refused for it (and system-wide RAM does not stand in). */
  isClaudeUnread?: boolean
}

export const usedBytes = (g: GuardInput): number | null => (g.machine.totalBytes && g.freeBytes !== null ? Math.max(0, g.machine.totalBytes - g.freeBytes) : null)
export const freePct = (g: GuardInput): number | null => (g.machine.totalBytes && g.freeBytes !== null ? Math.round((g.freeBytes / g.machine.totalBytes) * 100) : null)
/** Claude's use if measured, else the whole system's. */
const measured = (g: GuardInput): number | null => (g.isClaudeUnread ? null : g.claudeBytes ?? usedBytes(g))

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
    const shared = g.sessions && g.sessions.count > 1 ? ` across ${g.sessions.count} sessions (${g.sessions.here} here${g.sessions.others ? `, ${g.sessions.others}` : ''})` : ''
    return { kind: 'agents', reason: `Machine Guard: ${g.running} of ${g.maxAgents} agents running${shared} ${basisOf(g)}. Wait for one to finish, or raise the limit in Settings.` }
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
export function ruleText(limitBytes: number | null, perAgent: number, max: number, calibrated: number, isTight: boolean, shared: RuleExtras = {}): string {
  const crew = `${max} agent${max === 1 ? '' : 's'}`
  const head =
    limitBytes === null
      ? `Machine Guard: this machine could not be measured, so run at most ${crew} at once.`
      : max === calibrated
        ? `Machine Guard: Claude may use ${fmtGbBytes(limitBytes)} GB of RAM \u2192 at most ${crew} at once (\u2248${fmtGbBytes(perAgent)} GB each).`
        : `Machine Guard: Claude may use ${fmtGbBytes(limitBytes)} GB of RAM, and the person set the crew to at most ${crew} at once.`
  const lines = [head, 'Run heavy commands (test suites, type checks, builds) one at a time; the guard makes a second one wait.']
  if (isTight) lines.push('RAM is tight: run no new agents and no heavy commands until it frees up.')
  if (shared.sessions && shared.sessions > 1) lines.push(`${shared.sessions} Claude sessions are running and share that budget: the agent count and the one heavy command at a time are across all of them.`)
  if (shared.killOn) lines.push('If Claude goes over its RAM limit the guard stops the biggest heavy command it finds (tsc, a test run, a build); prefer smaller scopes so it never has to.')
  if (shared.stopped) lines.push(shared.stopped)
  return lines.join(' ')
}
/** Extra lines for ruleText: how many live sessions share the budget, whether the kill switch is on, and the note about a command it stopped. */
export type RuleExtras = { sessions?: number; killOn?: boolean; stopped?: string | null }

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
export const hudLine = (usedGb: number | null, limitGb: number | null, running: number, max: number, sessions = 1): string =>
  `RAM ${usedGb === null ? '?' : fmtGb(usedGb)}${limitGb === null ? ' GB' : `/${fmtGb(limitGb)} GB`} \u00b7 ${running}/${max} agents${sessions > 1 ? ` \u00b7 ${sessions} sessions` : ''}`
export const hudText = (g: GuardInput): string => hudLine(useGb(g), g.limitBytes === null ? null : gbOf(g.limitBytes), g.running, g.maxAgents, g.sessions?.count ?? 1)
/** The machine in two words: "48 GB Mac"; '' when unknown. */
export const shortMachine = (m: Machine): string => (m.totalBytes ? `${Math.round(gbOf(m.totalBytes))} GB ${osName(m.os)}` : '')
/**
 * The one Machine Guard line of the desktop pane and the band: "RAM 9.1/15 GB · 3/30 agents"
 * while work runs, else "15 GB limit · up to 30 agents". Negative numbers mean unknown.
 */
export function paneLine(limitGb: number, usedGb: number, running: number, max: number, isWorking: boolean, sessions = 1): string {
  if (isWorking) return `\u{1F6E1}\uFE0E ${hudLine(usedGb >= 0 ? usedGb : null, limitGb > 0 ? limitGb : null, running, max, sessions)}`
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
const SCRIPT_RUNNERS = new Set(['node', 'nodejs'])

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
  // A script run by node (`node node_modules/typescript/lib/tsc.js`): the first word that is not a flag.
  if (SCRIPT_RUNNERS.has(first)) {
    const script = base(t.slice(1).find(x => !x.startsWith('-')) ?? '')
    if (HEAVY_TOOLS.has(script)) return script === 'gradlew' ? 'gradle' : script
  }
  if (PKG_MANAGERS.has(first)) {
    const rest = t.slice(1).filter(x => !x.startsWith('-'))
    const script = rest[0] === 'run' ? rest[1] : rest[0]
    if (script && SCRIPT.test(script)) return `${first} ${rest[0] === 'run' ? 'run ' : ''}${script}`
    // yarn, pnpm and bun run a package's own binary by name: `yarn tsc`, `pnpm vitest`.
    if (script && first !== 'npm' && HEAVY_TOOLS.has(script)) return script
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
export const lockDenyReason = (label: string, where = ''): string => `Machine Guard: another heavy command (${label}) is running${where ? ` ${where}` : ''}; retry when it finishes.`

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

// ---- one budget across every live session ------------------------------------------
// Each session of the mod writes ONE key of its own in the plugin's store (`mg.s.<sessionId>`), so
// writes never race: `$.store` is a JSON file every session reads fresh. Peers are read only while
// work runs, at spawn time and at heavy-command time. A record older than PEER_FRESH_MS is a
// session that ended or crashed and is ignored; a heavy hold older than LOCK_STALE_MS is broken.

export const SESSION_PREFIX = 'mg.s.'
/** A session's record counts for this long after its last write. */
export const PEER_FRESH_MS = 60_000
/** A working session rewrites its record this often. */
export const HEARTBEAT_MS = 15_000
/** A record this old is deleted when a session reads the store. */
export const PEER_DROP_MS = 10 * 60_000

/** The heavy command a session runs: what it is, and when (the clock's ms) it got the hold. */
export type Hold = { cmd: string; since: number }
/** What a session writes about itself. */
export type SessionRec = { agents: number; busy: boolean; heavy: Hold | null; at: number; name: string }
export type Peer = SessionRec & { id: string }

const wholeNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)

/** A stored record cleaned, or null when it is not one. */
export function cleanSessionRec(v: unknown): SessionRec | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const at = wholeNum(r.at)
  const agents = wholeNum(r.agents)
  if (at === null || agents === null) return null
  const h = r.heavy as Record<string, unknown> | null | undefined
  const since = h && typeof h === 'object' ? wholeNum(h.since) : null
  const heavy: Hold | null = h && typeof h === 'object' && since !== null && typeof h.cmd === 'string' ? { cmd: h.cmd.slice(0, 60), since } : null
  return { agents, busy: r.busy === true, heavy, at, name: typeof r.name === 'string' ? r.name.slice(0, 40) : '' }
}

/**
 * The other live sessions in the store's `mg.s.*` entries (id → raw value), and the ids whose
 * record is old enough to delete. A peer counts when it is fresh and has something going on:
 * agents, a heavy hold, or work in the main loop. `self` is left out.
 */
export function peersOf(entries: Readonly<Record<string, unknown>>, self: string, now: number): { peers: Peer[]; drop: string[] } {
  const peers: Peer[] = []
  const drop: string[] = []
  for (const [id, raw] of Object.entries(entries)) {
    if (id === self) continue
    const rec = cleanSessionRec(raw)
    if (!rec || now - rec.at >= PEER_DROP_MS) {
      drop.push(id)
      continue
    }
    // A clock far ahead of ours is not trusted either.
    if (now - rec.at >= PEER_FRESH_MS || rec.at - now >= PEER_FRESH_MS) continue
    if (rec.agents > 0 || rec.busy || rec.heavy) peers.push({ ...rec, id })
  }
  return { peers: peers.sort((a, b) => a.id.localeCompare(b.id)), drop }
}

export const peerAgents = (peers: readonly Peer[]): number => peers.reduce((n, p) => n + p.agents, 0)
export const sessionCount = (peers: readonly Peer[]): number => peers.length + 1
/** Where the other agents are: "11 in claude mod, 3 in notes"; '' when the others run none. */
export function othersSummary(peers: readonly Peer[]): string {
  const parts = peers.filter(p => p.agents > 0).map(p => `${p.agents} in ${p.name || 'another session'}`)
  return parts.join(', ')
}

/** The peer holding the heavy-command lock: the earliest hold that is not stale (ties go to the lower id). */
export function peerHeavy(peers: readonly Peer[], now: number): Peer | null {
  let best: Peer | null = null
  for (const p of peers) {
    if (!p.heavy || now - p.heavy.since >= LOCK_STALE_MS) continue
    if (!best || !best.heavy || p.heavy.since < best.heavy.since || (p.heavy.since === best.heavy.since && p.id < best.id)) best = p
  }
  return best
}
/** After writing its own hold, whether this session still wins: no other session's hold is older (ties go to the lower id). */
export function holdWins(self: string, since: number, peers: readonly Peer[], now: number): boolean {
  const other = peerHeavy(peers, now)
  if (!other || !other.heavy) return true
  return since < other.heavy.since || (since === other.heavy.since && self < other.id)
}
/** Where a refused heavy command's holder is: "in claude mod" or "in another session". */
export const holderWhere = (p: Peer | null): string => (p ? `in ${p.name ? `"${p.name}"` : 'another session'}` : '')

// ---- the kill switch ---------------------------------------------------------------
// When a FRESH look shows Claude over its RAM limit, stop the biggest heavy process that runs
// under a Claude process, one at a time. Never a Claude process, an app, an MCP server, a
// shell, or anything outside a Claude tree.

export type KillSwitch = 'on' | 'off'
/** The kill switch setting: on unless it was set to 'off'. */
export const cleanKillSwitch = (v: unknown): KillSwitch => (v === 'off' || v === false ? 'off' : 'on')
export const killOptions = (): { value: string; label: string }[] => [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]
/** One process is stopped at a time, then this long passes before the next look may stop another. */
export const KILL_COOLDOWN_MS = 20_000
/** A heavy process under this size is left alone: stopping it would not bring Claude under the limit. */
export const KILL_MIN_BYTES = 256 * 1024 * 1024
/** After a polite stop, how long before a forced one. */
export const KILL_TERM_WAIT_MS = 5_000
/** How long Claude is told about a command that was stopped. */
export const KILL_NOTE_MS = 15 * 60_000
/** Claude at this share of its limit (or more) is looked at every HOT_EVERY_MS, not every SAMPLE_EVERY_MS. */
export const HOT_SHARE = 0.7
export const HOT_EVERY_MS = 5_000
/** Whether Claude is close enough to its limit to look often. */
export const isHot = (claude: number | null, limitBytes: number | null, enabled: boolean): boolean => enabled && claude !== null && limitBytes !== null && limitBytes > 0 && claude >= limitBytes * HOT_SHARE

export type KillTarget = { pid: number; name: string; args: string; label: string; rssBytes: number }

const base = (s: string): string => (s.split(/[\\/]/).pop() ?? '').replace(/\.(exe|js|mjs|cjs|ts)$/i, '').trim().toLowerCase()
const INTERPRETERS = /^(node|nodejs|bun|deno|tsx|ts-node|python[0-9.]*|ruby|java)$/
const SHELLS = new Set(['sh', 'bash', 'zsh', 'fish', 'dash', 'ksh', 'tcsh', 'csh', 'login', 'sudo', 'su', 'tmux', 'screen', 'powershell', 'pwsh', 'cmd', 'conhost'])
// Programs a person runs themselves and expects to stay: never stopped even if a pattern matched.
const PROTECTED = /(^|[\\/ ])(code|cursor|windsurf|zed|idea|webstorm|pycharm|xcode|docker|dockerd|ollama|postgres|mysqld|redis-server|mongod|ss[h]|sshd|nginx|launchd|windowserver|finder|dock|explorer|svchost)(\s|$)/i
const MCP = /mcp|modelcontextprotocol/i

/** The heavy tool a whole command line (as `ps` shows it) runs: `tsc`, `jest`... Also when a script runs it: `node .../bin/tsc`. */
export function heavyArgs(args: unknown): string | null {
  if (typeof args !== 'string' || !args.trim()) return null
  const direct = heavyCommand(args)
  if (direct) return direct
  // Windows quotes paths with spaces ("C:\Program Files\nodejs\node.exe" "C:\My app\...\tsc"): the program
  // path is kept as one word and the quotes dropped, so it reads like a `ps` line.
  const toks = args
    .trim()
    .replace(/^"([^"]*)"/, (_m, exe: string) => exe.replace(/\s+/g, '_'))
    .replace(/"/g, '')
    .split(/\s+/)
  const exe = base(toks[0] ?? '')
  if (HEAVY_TOOLS.has(exe)) return exe === 'gradlew' ? 'gradle' : exe
  if (!INTERPRETERS.test(exe)) return null
  const rest = toks.slice(1)
  const mIdx = rest.indexOf('-m')
  if (mIdx >= 0) {
    const mod = base(rest[mIdx + 1] ?? '')
    return HEAVY_TOOLS.has(mod) ? mod : null
  }
  // The script is the first thing that is not a flag. A path with spaces in it ("/Users/me/My Projects/x/node_modules/.bin/tsc")
  // arrives as several words, so a later word that is itself a path counts too, up to the first flag after the script.
  let seenScript = false
  for (const t of rest) {
    if (t.startsWith('-')) {
      if (seenScript) break
      continue
    }
    const name = base(t)
    if (HEAVY_TOOLS.has(name) && (!seenScript || /[\\/]/.test(t))) return name
    seenScript = true
  }
  return null
}

/**
 * The processes under Claude Code: every descendant of a `claude` root (a process called claude
 * whose parent is not one). Only Claude Code itself (`claude`, `claude.exe`), not the desktop app
 * (`Claude`, `Claude.exe`): the app's own Terminal tabs run the person's commands, not Claude's.
 */
function claudeTree(procs: readonly Proc[]): Proc[] {
  const isClaude = (p: Proc) => /^claude(\.exe)?$/.test((p.name.split(/[\\/]/).pop() ?? '').trim())
  const byPid = new Map(procs.map(p => [p.pid, p]))
  const kids = new Map<number, Proc[]>()
  for (const p of procs) kids.set(p.ppid, [...(kids.get(p.ppid) ?? []), p])
  const out: Proc[] = []
  const seen = new Set<number>()
  const walk = (p: Proc) => {
    if (seen.has(p.pid)) return
    seen.add(p.pid)
    out.push(p)
    for (const c of kids.get(p.pid) ?? []) walk(c)
  }
  for (const r of procs) if (isClaude(r) && !(byPid.has(r.ppid) && isClaude(byPid.get(r.ppid) as Proc))) walk(r)
  return out
}

/** Whether a process must never be stopped, whatever it runs. */
export function neverKill(p: Proc): boolean {
  const name = p.name || ''
  const args = p.args ?? ''
  const exe = base(name) || base(args.split(/\s+/)[0] ?? '')
  if (!Number.isInteger(p.pid) || p.pid <= 4) return true
  // Claude itself, its desktop app and helpers: "claude", "Claude", "Claude Helper (Renderer)"...
  const lastSeg = (x: string): string => x.split(/[\\/]/).pop() ?? ''
  if (/claude/i.test(lastSeg(name)) || /claude/i.test(lastSeg(args.split(/\s+/)[0] ?? ''))) return true
  // Apps (macOS bundles), shells, MCP servers, the user's own tools.
  if (/\.app[\\/]/i.test(name) || /\.app[\\/]/i.test(args.split(/\s+/)[0] ?? '')) return true
  if (SHELLS.has(exe) || /^-/.test(name)) return true
  if (MCP.test(args) || MCP.test(name)) return true
  if (PROTECTED.test(name) || PROTECTED.test(args.split(/\s+/)[0] ?? '')) return true
  return false
}

/**
 * The one process to stop: the biggest heavy process under a Claude process. A heavy process
 * with a heavy process of its own below it is a wrapper (npm test around jest): only the one
 * at the bottom is picked, never the parent. Under `minBytes` is left alone.
 */
export function killPick(procs: readonly Proc[], minBytes = KILL_MIN_BYTES): KillTarget | null {
  const tree = claudeTree(procs)
  const heavy = new Map<number, string>()
  for (const p of tree) {
    const label = p.args ? heavyArgs(p.args) : null
    if (label && !neverKill(p)) heavy.set(p.pid, label)
  }
  if (!heavy.size) return null
  const byPid = new Map(tree.map(p => [p.pid, p]))
  const hasHeavyBelow = new Set<number>()
  for (const pid of heavy.keys()) {
    const seen = new Set<number>([pid])
    let up = byPid.get(byPid.get(pid)?.ppid ?? -1)
    while (up && !seen.has(up.pid)) {
      seen.add(up.pid)
      hasHeavyBelow.add(up.pid)
      up = byPid.get(up.ppid)
    }
  }
  let best: KillTarget | null = null
  for (const [pid, label] of heavy) {
    const p = byPid.get(pid) as Proc
    if (hasHeavyBelow.has(pid) || p.rssBytes < minBytes) continue
    if (!best || p.rssBytes > best.rssBytes || (p.rssBytes === best.rssBytes && p.pid < best.pid)) best = { pid: p.pid, name: p.name, args: p.args ?? '', label, rssBytes: p.rssBytes }
  }
  return best
}

export type KillSkip = 'off' | 'unknown' | 'under' | 'stale' | 'cooldown' | 'none'
export type KillInput = {
  enabled: boolean
  limitBytes: number | null
  /** The process table as read just now, with command lines. */
  procs: readonly Proc[]
  /** How old that read is, in ms. */
  readAgeMs: number
  /** Time since the last process was stopped; null when none was. */
  sinceKillMs: number | null
  minBytes?: number
}
/** Whether to stop a process now, and which. Only on a fresh read that shows Claude over its limit, once per cooldown. */
export function killDecision(i: KillInput): { kill: KillTarget; claudeBytes: number } | { skip: KillSkip } {
  if (!i.enabled) return { skip: 'off' }
  const used = claudeBytes(i.procs)
  if (i.limitBytes === null || !(i.limitBytes > 0) || used === null) return { skip: 'unknown' }
  if (!(used > i.limitBytes)) return { skip: 'under' }
  if (!(i.readAgeMs >= 0 && i.readAgeMs <= FRESH_MS)) return { skip: 'stale' }
  if (i.sinceKillMs !== null && i.sinceKillMs < KILL_COOLDOWN_MS) return { skip: 'cooldown' }
  const kill = killPick(i.procs, i.minBytes)
  return kill ? { kill, claudeBytes: used } : { skip: 'none' }
}

/**
 * Process rows from the name list with their command lines from the second list, matched by pid
 * (and by parent, when the row has one: a pid reused between the two reads has another parent).
 * A row with no command line stays as it was.
 */
export function withArgs(procs: readonly Proc[], argRows: readonly { pid: number; ppid?: number; args: string }[]): Proc[] {
  const byPid = new Map(argRows.map(r => [r.pid, r]))
  return procs.map(p => {
    const r = byPid.get(p.pid)
    return r && (r.ppid === undefined || r.ppid === p.ppid) ? { ...p, args: r.args } : p
  })
}

const gbText = (bytes: number): string => fmtGb(roundGb(bytes))
/** The toast: "🔪 Machine Guard stopped `tsc` (19.7 GB): Claude was at 24/20 GB". */
export const killToast = (t: KillTarget, claude: number, limitBytes: number): string => `\u{1F52A} Machine Guard stopped \`${t.label}\` (${gbText(t.rssBytes)} GB): Claude was at ${gbText(claude)}/${gbText(limitBytes)} GB`
/** The line Claude reads in its next prompt, so it does not just run the command again. */
export const killNote = (t: KillTarget, claude: number, limitBytes: number): string =>
  `Machine Guard stopped \`${t.label}\` (${gbText(t.rssBytes)} GB) because Claude was using ${gbText(claude)} GB, over its ${gbText(limitBytes)} GB RAM limit. Do not just re-run it: re-run only when RAM is under the limit, and prefer smaller scopes (one folder, one test file).`
/** What the stopped command's own tool result is followed by. */
export const killContext = (label: string): string =>
  `Machine Guard stopped \`${label}\` because Claude's RAM use went over its limit. Re-run only when RAM is under the limit; prefer smaller scopes (one folder, one test file).`
/** The note while it is fresh, else null. */
export const killNoteLive = (note: { text: string; at: number } | null, now: number): string | null => (note && now - note.at < KILL_NOTE_MS ? note.text : null)
