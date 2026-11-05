// The cost coach: three small helpers for the Token Manager.
//   1. Stuck-agent rescue: retry a quiet agent on Haiku, or nudge it.
//   2. "What if": re-price this session as if a cheaper setup had been on.
//   3. PR cost badge: one line for a pull request, from the job receipt.
// Pure arithmetic and text here (tested on their own); the engine calls take `$`.

import type { EngineInterface } from 'claude-code'

import type { AgentRun } from '../types'

export type Price = readonly [input: number, output: number, cacheRead: number, cacheWrite: number]
type Staff = { model?: string; effort: 'low' | 'medium' | 'high'; why: string }

// ---------------------------------------------------------------- rescue

/** What an agent was asked to do, kept so a quiet one can be started again. */
export type TaskNote = { prompt: string; description: string; subagentType: string }
const tasks = new Map<string, TaskNote>()
const TASKS_KEPT = 200

/** Remembers the task of a started agent (by its id). Memory only. */
export const rememberTask = (agentId: string | undefined, note: TaskNote): void => {
  if (!agentId || !note.prompt) return
  tasks.delete(agentId)
  tasks.set(agentId, note)
  while (tasks.size > TASKS_KEPT) tasks.delete(tasks.keys().next().value as string)
}
export const taskOf = (a: AgentRun): TaskNote | undefined => tasks.get(a.agentId ?? a.id) ?? tasks.get(a.id)

export const NUDGE_TEXT = 'status? Reply in one line: what you are doing and whether you are blocked.'

/** Running but silent. Same test as the panel's own quiet flag. */
export const quietOf = (list: readonly AgentRun[]): AgentRun[] => list.filter(a => a.status === 'running' && Boolean(a.isStuck))

/** The agent can be nudged only when the engine can address it. */
export const canNudge = (a: AgentRun): boolean => Boolean(a.agentId)

/** The ready-to-send prompt for the fallback: the task again, on Haiku. */
export const retryPrompt = (a: AgentRun): string => {
  const note = taskOf(a)
  const what = a.description || a.type
  return note
    ? `Start the "${what}" task again with the ${note.subagentType || 'general-purpose'} agent on model haiku. Same prompt:\n\n${note.prompt}`
    : `The agent "${what}" went quiet. Start that task again with a subagent on model haiku.`
}

export type RescueResult = { how: 'spawned' | 'suggested'; text: string }

/** Retry on Haiku: spawn the same task through the engine; if that is refused, propose it in the prompt box. */
export async function retryOnHaiku($: EngineInterface, a: AgentRun): Promise<RescueResult> {
  const note = taskOf(a)
  const label = a.description || a.type
  if (note) {
    const subagentType = note.subagentType && note.subagentType !== 'teammate' ? note.subagentType : undefined
    const out = await $.agent
      .spawn({ prompt: note.prompt, description: note.description || label, model: 'haiku', ...(subagentType ? { subagentType } : {}) })
      .catch(() => undefined)
    if (out && out.deny === undefined) return { how: 'spawned', text: `↻ "${label}" started again on Haiku. The quiet one is still running: stop it if you do not need it.` }
  }
  await $.prompt.suggest({ text: retryPrompt(a) }).catch(() => undefined)
  return { how: 'suggested', text: `↻ Press Tab to send the retry of "${label}" on Haiku.` }
}

/** Nudge: a short "status?" to the agent. */
export async function nudge($: EngineInterface, a: AgentRun): Promise<string> {
  const label = a.description || a.type
  if (!a.agentId) return `✋ "${label}" cannot be reached.`
  const sent = await $.session.send({ to: { agentId: a.agentId }, text: NUDGE_TEXT }).catch(() => undefined)
  return sent?.isDelivered ? `✋ Nudged "${label}": asked for a status.` : `✋ Could not nudge "${label}"${sent?.reason ? `: ${sent.reason}` : ''}.`
}

/** `/tokens rescue`: the quiet agents with their actions as text. */
export const rescueText = (quiet: readonly AgentRun[], at: number, fmtTime: (ms: number) => string): string => {
  if (!quiet.length) return '✓ No quiet agents. Nothing to rescue.'
  const rows = quiet.map((a, i) => {
    const mins = fmtTime(Math.max(0, at - (a.lastProgressAt ?? a.startedAt)))
    return `${i + 1}. ⚠ ${(a.description || a.type).slice(0, 48)} · quiet ${mins}${canNudge(a) ? '' : ' · cannot nudge'}`
  })
  return [
    `👉 ${quiet.length} quiet ${quiet.length === 1 ? 'agent' : 'agents'}`,
    ...rows,
    '',
    '↻ /tokens rescue retry <n>   start it again on Haiku',
    '✋ /tokens rescue nudge <n>   ask it for a status',
    '(<n> is the number above, or "all")',
  ].join('\n')
}

/** Picks the agents an `<n>` or `all` argument names. */
export const pickQuiet = (quiet: readonly AgentRun[], arg: string): AgentRun[] => {
  if (arg === 'all') return [...quiet]
  const n = Number(arg)
  const one = Number.isInteger(n) ? quiet[n - 1] : undefined
  return one ? [one] : []
}

// ---------------------------------------------------------------- what if

// Usage mix of a typical agent run, per token. The engine reports one token total per
// agent, not the split, so a cost is moved between models by the ratio of blended prices.
const MIX: Price = [0.04, 0.02, 0.84, 0.1]
const blend = (p: Price): number => p[0] * MIX[0] + p[1] * MIX[1] + p[2] * MIX[2] + p[3] * MIX[3]
export const HAIKU = 'claude-haiku-5-5'
const SONNET = 'claude-sonnet-5-5'

export type ScenarioId = 'haiku' | 'staffing' | 'warm'
export type Scenario = {
  id: ScenarioId
  label: string
  wouldCost: number
  saves: number
  /** saves as a share of the session's cost, 0..100 */
  pct: number
  /** The command that turns it on. */
  cmd: string
  /** Already on: its saving is in the cost already. */
  isOn: boolean
}
export type WhatIfInput = {
  agents: readonly AgentRun[]
  /** The session's cost so far, the main loop's included. */
  totalUsd: number
  todayUsd?: number
  priceOf: (model: string, prompt: number) => Price
  staffFor: (type: string, description: string) => Staff | null
  flags: { autopilot: boolean; staffing: boolean; warm: boolean }
  /** The main session's cache, for Keep-Warm; left out, that scenario is skipped. */
  warm?: { promptTokens: number; model: string; contextPct: number; call: (price: Price, tokens: number, pct: number) => { isWarm: boolean; missUsd: number; warmUsd: number } }
}
export type WhatIf = { baseUsd: number; scenarios: Scenario[]; best: Scenario | null; todaySaves: number }

/** What this agent's cost would be on another model, by the blended-price ratio. */
export const repriced = (a: AgentRun, model: string, priceOf: WhatIfInput['priceOf']): number => {
  const from = blend(priceOf(a.model, 0))
  const to = blend(priceOf(model, 0))
  if (!(from > 0)) return a.costUsd
  return Math.min(a.costUsd, a.costUsd * (to / from))
}

export const whatIf = (i: WhatIfInput): WhatIf => {
  const agentUsd = i.agents.reduce((s, a) => s + a.costUsd, 0)
  const baseUsd = Math.max(i.totalUsd, agentUsd)
  const make = (id: ScenarioId, label: string, saves: number, cmd: string, isOn: boolean): Scenario => {
    const s = isOn ? 0 : Math.max(0, Math.min(baseUsd, saves))
    return { id, label, wouldCost: baseUsd - s, saves: s, pct: baseUsd > 0 ? (s / baseUsd) * 100 : 0, cmd, isOn }
  }
  const saveBy = (pick: (a: AgentRun) => string | null): number =>
    i.agents.reduce((s, a) => {
      const m = pick(a)
      return m ? s + (a.costUsd - repriced(a, m, i.priceOf)) : s
    }, 0)
  const scenarios: Scenario[] = [
    make('haiku', 'Read-only agents on Haiku', saveBy(a => (i.staffFor(a.type, a.description)?.why === 'reading' ? HAIKU : null)), '/tokens autopilot on', i.flags.autopilot),
    make(
      'staffing',
      'Smart staffing',
      saveBy(a => {
        const m = i.staffFor(a.type, a.description)?.model
        return m === 'haiku' ? HAIKU : m === 'sonnet' ? SONNET : null
      }),
      '/tokens staffing on',
      i.flags.staffing,
    ),
  ]
  if (i.warm && i.warm.promptTokens > 0) {
    const c = i.warm.call(i.priceOf(i.warm.model, i.warm.promptTokens), i.warm.promptTokens, i.warm.contextPct)
    scenarios.push(make('warm', 'Keep-Warm (per cache lapse)', c.isWarm ? c.missUsd - c.warmUsd : 0, '/tokens warm on', i.flags.warm))
  }
  const best = scenarios.filter(s => !s.isOn && s.saves > 0.005).sort((a, b) => b.saves - a.saves)[0] ?? null
  return { baseUsd, scenarios, best, todaySaves: best && baseUsd > 0 && i.todayUsd ? i.todayUsd * (best.pct / 100) : 0 }
}

/** `/tokens whatif` as a small table. */
export const whatIfText = (w: WhatIf, fmt: (usd: number) => string): string => {
  const head = [`👉 ${w.best ? `Best: ${w.best.label}, saves ≈${fmt(w.best.saves)} (${Math.round(w.best.pct)}%)` : 'Already lean: no scenario saves much'}`, '']
  const rows = [
    '| Scenario | Would cost | Saves |',
    '|---|---|---|',
    `| Now | ≈${fmt(w.baseUsd)} | - |`,
    ...w.scenarios.map(s => `| ${s.label} | ${s.isOn ? 'already on' : `≈${fmt(s.wouldCost)}`} | ${s.isOn ? '-' : s.saves > 0.005 ? `≈${fmt(s.saves)} (${Math.round(s.pct)}%)` : 'nothing'} |`),
  ]
  const tail = ['', w.best ? `${w.todaySaves > 0.005 ? `Same mix across today: ≈${fmt(w.todaySaves)} saved.\n` : ''}Turn it on: ${w.best.cmd}` : '', '_Estimates from token counts and a typical usage mix._']
  return [...head, ...rows, ...tail].filter((l, n, all) => !(l === '' && all[n - 1] === '')).join('\n')
}

/** The Token Manager tip, when the best scenario saves more than 20%. */
export const whatIfTip = (w: WhatIf, fmt: (usd: number) => string): { level: 0; text: string; cmd: string } | null =>
  w.best && w.best.pct > 20 ? { level: 0, text: `What if: ${w.best.label} would save ≈${fmt(w.best.saves)} (${Math.round(w.best.pct)}%)`, cmd: w.best.cmd } : null

// ---------------------------------------------------------------- PR badge

export type PrInput = { costUsd: number; agents: number; tokens: number; repo: string; branch: string }

const nameOfRemote = (remote: string | null | undefined): string => {
  const m = /[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(remote ?? '')
  return m?.[1] ?? ''
}
export const repoLabel = (repo: { name: string | null; remote: string | null; root: string } | null): string =>
  repo ? repo.name || nameOfRemote(repo.remote) || repo.root.split('/').filter(Boolean).pop() || '' : ''

/** The one-line badge plus a short table, in markdown. */
export const prBadge = (p: PrInput, fmtCost: (usd: number) => string, fmtTokens: (n: number) => string): { line: string; text: string } => {
  const line = `🦀 This PR cost ≈${fmtCost(p.costUsd)} (${p.agents} ${p.agents === 1 ? 'agent' : 'agents'}, ${fmtTokens(p.tokens)} tokens)`
  const where = [p.repo, p.branch].filter(Boolean).join(' @ ')
  return {
    line,
    text: [
      line,
      '',
      '| Repo | Cost | Agents | Tokens |',
      '|---|---|---|---|',
      `| ${(where || 'this session').replace(/\|/g, '/')} | ≈${fmtCost(p.costUsd)} | ${p.agents} | ${fmtTokens(p.tokens)} |`,
      '',
      '_Estimated by Mission Control from token counts._',
    ].join('\n'),
  }
}

/** Repo and branch for the current directory: the engine's repo, then git for the branch. */
export async function repoAndBranch($: EngineInterface): Promise<{ repo: string; branch: string }> {
  const info = await $.session.repo().catch(() => null)
  const run = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], info ? { cwd: info.root } : undefined).catch(() => undefined)
  const branch = run && run.exitCode === 0 ? run.stdout.trim() : ''
  return { repo: repoLabel(info), branch: branch === 'HEAD' ? 'detached HEAD' : branch }
}
