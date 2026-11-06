import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Machine Guard wired into the mod: detection at session start, the agent.spawn refusal,
// the one toast, and the prompt rule.

const GB = 1024 ** 3
const toasts: string[] = []
let running = 0
let machineOut: string | null = null
let idleOnes = 0
let finishedOnes = 0
let spawnDelay = 0

const base = (on: On, store: Record<string, unknown> = {}) => {
  toasts.length = 0
  idleOnes = 0
  finishedOnes = 0
  spawnDelay = 0
  mock.clock(on, { now: Date.parse('2026-10-20T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, store)
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text))
    return { value: undefined } as never
  })
  on('process.run', async (_$, e) => {
    const { argv } = e as { argv: string[] }
    if (machineOut === null || argv[0] !== 'sh') throw new Error('no such command')
    return { value: { exitCode: 0, stdout: machineOut, stderr: '' } } as never
  })
  on('agent.list', async () => ({
    value: [
      ...Array.from({ length: running }, (_, i) => ({ id: `r${i}`, description: 'x', type: 'general-purpose', status: i % 2 ? 'waiting' : 'running' })),
      ...Array.from({ length: idleOnes }, (_, i) => ({ id: `i${i}`, description: 'x', type: 'teammate', status: 'idle' })),
      ...Array.from({ length: finishedOnes }, (_, i) => ({ id: `f${i}`, description: 'x', type: 'general-purpose', status: 'completed' })),
    ],
  }) as never)
  on('agent.spawn', async () => {
    if (spawnDelay) await new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, spawnDelay))
    return { model: 'claude-opus-5-5', agentId: 'a1' } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 1 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const start = async ($: Engine) => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, 50))
}
const spawn = ($: Engine, i: number) =>
  $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Engineer: piece ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)

test('a full crew refuses a new agent with a reason, toasts once, and lets one in after room frees', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  running = 2
  base(on, { maxAgents: 2 })
  await start($)
  const first = await spawn($, 1)
  expect(first).toMatchObject({ deny: 'Machine Guard: 2 of 2 agents running on this 48 GB Mac. Wait for one to finish, or raise the limit in Settings.' })
  await spawn($, 2)
  expect(toasts.filter(t => t.startsWith('Machine Guard:'))).toHaveLength(1)
  running = 1
  expect(await spawn($, 3)).toMatchObject({ agentId: 'a1' })
  running = 2
  await spawn($, 4)
  expect(toasts.filter(t => t.startsWith('Machine Guard:'))).toHaveLength(2)
})

test('Auto follows the calibration: 48 GB and 12 cores is 6 agents', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  running = 5
  base(on)
  await start($)
  expect(await spawn($, 1)).toMatchObject({ agentId: 'a1' })
  running = 6
  expect(await spawn($, 2)).toMatchObject({ deny: expect.stringContaining('6 of 6 agents') })
})

test('free RAM under 10% refuses a new agent', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${3 * GB}\n`
  running = 0
  base(on)
  await start($)
  expect(await spawn($, 1)).toMatchObject({ deny: expect.stringContaining('only 6% of RAM is free') })
})

test('an unknown machine never crashes and is capped at the safe default of 4', async ($, on) => {
  machineOut = null
  running = 3
  base(on)
  await start($)
  expect(await spawn($, 1)).toMatchObject({ agentId: 'a1' })
  running = 4
  expect(await spawn($, 2)).toMatchObject({ deny: expect.stringContaining('4 of 4 agents') })
})

test('finished and idle agents leave room; waiting ones count', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  running = 1
  base(on, { maxAgents: 2 })
  idleOnes = 3
  finishedOnes = 5
  await start($)
  expect(await spawn($, 1)).toMatchObject({ agentId: 'a1' })
  running = 2 // one running, one waiting on its own background work
  expect(await spawn($, 2)).toMatchObject({ deny: expect.stringContaining('2 of 2 agents') })
})

test('parallel Agent calls cannot all slip past a full crew', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  running = 0
  base(on, { maxAgents: 2 })
  await start($)
  spawnDelay = 30
  const got = await Promise.all([1, 2, 3, 4].map(i => spawn($, i)))
  expect(got.filter(r => (r as { agentId?: string }).agentId === 'a1')).toHaveLength(2)
  expect(got.filter(r => (r as { deny?: string }).deny)).toHaveLength(2)
  // Once started they are the engine's to list; nothing stays held.
  spawnDelay = 0
  expect(await spawn($, 5)).toMatchObject({ agentId: 'a1' })
})

test('a resumed agent is no new one: the guard lets it wake', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  running = 2
  base(on, { maxAgents: 2 })
  await start($)
  const woken = await $.agent.spawn({ tool_use_id: 't9', prompt: '', description: 'Engineer: piece 9', subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false, resume: { agentId: 'a1' } } as never)
  expect(woken).toMatchObject({ agentId: 'a1' })
})
