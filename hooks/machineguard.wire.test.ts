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
let sleeps = 0
let gate: Promise<void> | null = null
let openGate = () => {}
const ran: string[] = []

const base = (on: On, store: Record<string, unknown> = {}) => {
  toasts.length = 0
  idleOnes = 0
  finishedOnes = 0
  spawnDelay = 0
  sleeps = 0
  gate = null
  ran.length = 0
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
    if (argv[0] === 'sleep') {
      sleeps++
      await new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, 5))
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    }
    if (machineOut === null || argv[0] !== 'sh') throw new Error('no such command')
    return { value: { exitCode: 0, stdout: machineOut, stderr: '' } } as never
  })
  on('tool.call', async (_$, e) => {
    const command = String((e as { command?: string }).command)
    ran.push(command)
    // Only the first type check is held open; a light command is never in its way.
    if (gate && command.startsWith('tsc')) await gate
    return { result: 'ok' } as never
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
  expect(first).toMatchObject({ deny: 'Machine Guard: 2 of 2 agents running (RAM limit 24 GB, ≈0.5 GB per agent). Wait for one to finish, or raise the limit in Settings.' })
  await spawn($, 2)
  expect(toasts.filter(t => t.startsWith('Machine Guard:'))).toHaveLength(1)
  running = 1
  expect(await spawn($, 3)).toMatchObject({ agentId: 'a1' })
  running = 2
  await spawn($, 4)
  expect(toasts.filter(t => t.startsWith('Machine Guard:'))).toHaveLength(2)
})

test('Auto follows the RAM limit alone: 48 GB at Auto (24 GB) and 0.5 GB per agent is 48 agents', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=2\nfree=${30 * GB}\n`
  running = 47
  base(on)
  await start($)
  expect(await spawn($, 1)).toMatchObject({ agentId: 'a1' })
  running = 48
  expect(await spawn($, 2)).toMatchObject({ deny: expect.stringContaining('48 of 48 agents') })
})

test('a typed 15 GB limit gives 30 agents, even on a machine that could not be measured', async ($, on) => {
  machineOut = null
  running = 29
  base(on, { ramLimit: 'gb:15' })
  await start($)
  expect(await spawn($, 1)).toMatchObject({ agentId: 'a1' })
  running = 30
  expect(await spawn($, 2)).toMatchObject({ deny: expect.stringContaining('30 of 30 agents running (RAM limit 15 GB, ≈0.5 GB per agent)') })
})

test('Claude is told the limit and the max in its prompt', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  base(on, { ramLimit: 'gb:15' })
  on('prompt.compose', async () => ({ sections: [] }) as never)
  await start($)
  const r = (await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: ['Agent'], outputStyle: null, traits: [] } as never)) as unknown as { sections: { id: string; text: string }[] }
  const text = r.sections.find(sc => sc.id === 'crab-progress:machineguard')?.text ?? ''
  expect(text).toContain('Machine Guard: Claude may use 15 GB of RAM \u2192 at most 30 agents at once (\u22480.5 GB each).')
})

// The engine's tool result type is huge: narrowed here so expect() never has to compare against it.
const bash = async ($: Engine, command: string, id: string): Promise<{ result?: string; deny?: string }> => (await $.tool.call({ tool: 'Bash', command, tool_use_id: id, agentId: id } as never)) as unknown as { result?: string; deny?: string }

test('heavy lock: a second tsc waits for the first and then runs; light commands never wait', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  base(on)
  await start($)
  gate = new Promise<void>(r => (openGate = r))
  const first = bash($, 'tsc --noEmit -p .', 'h1')
  await new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, 20))
  const second = bash($, 'npm test', 'h2')
  const light = await bash($, 'ls -la', 'l1')
  expect(light).toMatchObject({ result: 'ok' })
  await new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, 40))
  // The second has not started: only the first heavy one and the light one ran.
  expect(ran).toEqual(['tsc --noEmit -p .', 'ls -la'])
  expect(sleeps).toBeGreaterThan(0)
  openGate()
  gate = null
  expect(await first).toMatchObject({ result: 'ok' })
  expect(await second).toMatchObject({ result: 'ok' })
  expect(ran).toEqual(['tsc --noEmit -p .', 'ls -la', 'npm test'])
})

test('heavy lock: after the wait is up the second is refused with the holder named', async ($, on) => {
  machineOut = `os=mac\ntotal=${48 * GB}\ncores=12\nfree=${30 * GB}\n`
  base(on)
  await start($)
  gate = new Promise<void>(r => (openGate = r))
  const first = bash($, 'tsc --noEmit -p .', 'h1')
  await new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, 20))
  const second = await bash($, 'npx vitest run', 'h2')
  expect(second).toMatchObject({ deny: 'Machine Guard: another heavy command (tsc) is running; retry when it finishes.' })
  openGate()
  await first
  // The lock is free again.
  gate = null
  expect(await bash($, 'cargo test', 'h3')).toMatchObject({ result: 'ok' })
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
