import { expect, test } from 'claude-code/testing'

import { NUDGE_TEXT, nudge, pickQuiet, prBadge, quietOf, rememberTask, repoLabel, rescueText, retryOnHaiku, retryPrompt, whatIf, whatIfText, whatIfTip } from './coach'
import type { Price } from './coach'
import type { AgentRun } from '../types'

// The cost coach: rescue for quiet agents, "what if" pricing, and the PR cost badge.

const PRICES: Record<string, Price> = { opus: [4, 20, 0.2, 8], sonnet: [2, 10, 0.1, 4], haiku: [0.1, 0.5, 0.01, 0.2] }
const priceOf = (model: string): Price => PRICES[/haiku/.test(model) ? 'haiku' : /sonnet/.test(model) ? 'sonnet' : 'opus'] as Price
const staffFor = (type: string, description: string) => {
  const text = `${type} ${description}`.toLowerCase()
  if (type === 'Explore' || /\b(read|research|search|find)\b/.test(text)) return { model: 'haiku', effort: 'low' as const, why: 'reading' }
  if (/\b(write|fix|implement)\b/.test(text)) return { model: 'sonnet', effort: 'medium' as const, why: 'routine work' }
  return null
}
const usd = (n: number): string => `$${n.toFixed(2)}`

const run = (o: Partial<AgentRun>): AgentRun => ({
  id: 'a1', agentId: 'ag1', type: 'general-purpose', description: 'task', model: 'claude-opus-5-5', status: 'running', startedAt: 0,
  contextTokens: 0, contextMax: 1_000_000, tokens: 1000, costUsd: 1, steps: 0, round: 1, ...o,
})
const flags = { autopilot: false, staffing: false, warm: false }

test('rescue: only running agents flagged quiet are listed, numbered, with both actions', () => {
  const list = [run({ id: 'a', isStuck: true, description: 'Explore the repo', lastProgressAt: 0 }), run({ id: 'b' }), run({ id: 'c', isStuck: true, status: 'done' })]
  const quiet = quietOf(list)
  expect(quiet.map(a => a.id)).toEqual(['a'])
  const text = rescueText(quiet, 120_000, ms => `${ms / 60_000}m`)
  expect(text).toMatch(/1 quiet agent/)
  expect(text).toMatch(/1\. .*Explore the repo.*2m/)
  expect(text).toMatch(/rescue retry/)
  expect(text).toMatch(/rescue nudge/)
  expect(rescueText([], 0, String)).toMatch(/No quiet agents/)
})

test('rescue: <n> and all pick agents; a bad number picks none', () => {
  const quiet = [run({ id: 'a' }), run({ id: 'b' })]
  expect(pickQuiet(quiet, '2').map(a => a.id)).toEqual(['b'])
  expect(pickQuiet(quiet, 'all').length).toBe(2)
  expect(pickQuiet(quiet, '9')).toEqual([])
  expect(pickQuiet(quiet, 'x')).toEqual([])
})

test('rescue: retry spawns the remembered task on Haiku', async () => {
  const spawned: unknown[] = []
  const $ = { agent: { spawn: async (i: unknown) => (spawned.push(i), { model: 'haiku', agentId: 'n1' }) }, prompt: { suggest: async () => undefined } } as never
  rememberTask('ag1', { prompt: 'Read README.md', description: 'readme', subagentType: 'Explore' })
  const r = await retryOnHaiku($, run({ agentId: 'ag1' }))
  expect(r.how).toBe('spawned')
  expect(spawned).toEqual([{ prompt: 'Read README.md', description: 'readme', model: 'haiku', subagentType: 'Explore' }])
})

test('rescue: a refused spawn, or no remembered task, falls back to a prompt suggestion', async () => {
  const suggested: { text: string }[] = []
  const $ = { agent: { spawn: async () => ({ deny: 'no' }) }, prompt: { suggest: async (i: { text: string }) => suggested.push(i) } } as never
  rememberTask('ag2', { prompt: 'Find the bug', description: 'bug', subagentType: 'general-purpose' })
  expect((await retryOnHaiku($, run({ agentId: 'ag2' }))).how).toBe('suggested')
  expect((await retryOnHaiku($, run({ agentId: 'unknown', description: 'lost' }))).how).toBe('suggested')
  expect(suggested[0]?.text).toMatch(/Find the bug/)
  expect(retryPrompt(run({ agentId: 'unknown', description: 'lost' }))).toMatch(/lost.*haiku/)
})

test('rescue: nudge sends "status?" to that agent, and says so when it cannot', async () => {
  const sent: unknown[] = []
  const ok = { session: { send: async (i: unknown) => (sent.push(i), { isDelivered: true }) } } as never
  expect(await nudge(ok, run({ agentId: 'ag9' }))).toMatch(/Nudged/)
  expect(sent).toEqual([{ to: { agentId: 'ag9' }, text: NUDGE_TEXT }])
  const no = { session: { send: async () => ({ isDelivered: false, reason: 'gone' }) } } as never
  expect(await nudge(no, run({}))).toMatch(/gone/)
  expect(await nudge(ok, run({ agentId: undefined }))).toMatch(/cannot be reached/)
})

test('what if: Haiku for readers saves most; staffing saves at least as much; the best is named with its command', () => {
  const agents = [run({ id: 'r', type: 'Explore', description: 'map code', costUsd: 2 }), run({ id: 'w', description: 'fix the bug', costUsd: 2 }), run({ id: 'p', description: 'plan', costUsd: 2 })]
  const w = whatIf({ agents, totalUsd: 8, priceOf, staffFor, flags })
  const [haiku, staffing] = w.scenarios
  expect(haiku?.saves).toBeGreaterThan(1.5)
  expect(staffing?.saves).toBeGreaterThan(haiku?.saves ?? 99)
  expect(w.best?.id).toBe('staffing')
  expect(w.best?.cmd).toBe('/tokens staffing on')
  expect(Math.abs((haiku?.wouldCost ?? 0) + (haiku?.saves ?? 0) - 8) < 1e-6).toBe(true)
  const text = whatIfText(w, usd)
  expect(text).toMatch(/\| Scenario \| Would cost \| Saves \|/)
  expect(text).toMatch(/Turn it on: \/tokens staffing on/)
})

test('what if: a scenario already on saves nothing, and a cheap model is never repriced upward', () => {
  const agents = [run({ type: 'Explore', description: 'map', costUsd: 2, model: 'claude-haiku-5-5' }), run({ id: 'x', type: 'Explore', description: 'map', costUsd: 4 })]
  const on = whatIf({ agents, totalUsd: 6, priceOf, staffFor, flags: { ...flags, autopilot: true } })
  expect(on.scenarios[0]?.isOn).toBe(true)
  expect(on.scenarios[0]?.saves).toBe(0)
  expect(whatIfText(on, usd)).toMatch(/already on/)
  const off = whatIf({ agents: [agents[0] as AgentRun], totalUsd: 2, priceOf, staffFor, flags })
  expect(off.best).toBeNull()
  expect(whatIfText(off, usd)).toMatch(/Already lean/)
})

test('what if: Keep-Warm counts one lapse when it would pay, and is skipped without a cache', () => {
  const call = (_p: Price, tokens: number) => ({ isWarm: tokens > 100_000, missUsd: tokens * 7.8e-6, warmUsd: tokens * 2e-7 })
  const agents = [run({ costUsd: 1 })]
  const big = whatIf({ agents, totalUsd: 5, priceOf, staffFor, flags, warm: { promptTokens: 500_000, model: 'opus', contextPct: 40, call } })
  expect(big.scenarios.find(s => s.id === 'warm')?.saves).toBeGreaterThan(3)
  expect(big.best?.id).toBe('warm')
  expect(whatIf({ agents, totalUsd: 5, priceOf, staffFor, flags }).scenarios.some(s => s.id === 'warm')).toBe(false)
})

test('what if: the Token Manager tip appears only above 20% and carries the command', () => {
  const agents = [run({ type: 'Explore', description: 'map', costUsd: 5 })]
  const big = whatIf({ agents, totalUsd: 5.5, priceOf, staffFor, flags })
  expect(whatIfTip(big, usd)?.cmd).toBe('/tokens autopilot on')
  const small = whatIf({ agents: [...agents, run({ id: 'z', description: 'plan', costUsd: 50 })], totalUsd: 56, priceOf, staffFor, flags })
  expect(whatIfTip(small, usd)).toBeNull()
})

test('pr badge: one line with cost, agents and tokens, then a short table', () => {
  const b = prBadge({ costUsd: 1.234, agents: 3, tokens: 1_200_000, repo: 'me/app', branch: 'feat/x' }, usd, n => `${n / 1e6}M`)
  expect(b.line).toBe('🦀 This PR cost ≈$1.23 (3 agents, 1.2M tokens)')
  expect(b.text).toMatch(/\| me\/app @ feat\/x \| ≈\$1\.23 \| 3 \| 1\.2M \|/)
  expect(prBadge({ costUsd: 0, agents: 1, tokens: 5, repo: '', branch: '' }, usd, String).line).toMatch(/1 agent,/)
})

test('pr badge: the repo is named by the engine, else by its remote, else by its folder', () => {
  expect(repoLabel({ name: 'owner/app', remote: null, root: '/x/y' })).toBe('owner/app')
  expect(repoLabel({ name: null, remote: 'git@github.com:me/thing.git', root: '/x/y' })).toBe('me/thing')
  expect(repoLabel({ name: null, remote: 'https://github.com/me/thing', root: '/x/y' })).toBe('me/thing')
  expect(repoLabel({ name: null, remote: null, root: '/x/y' })).toBe('y')
  expect(repoLabel(null)).toBe('')
})
