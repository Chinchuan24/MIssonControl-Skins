import { expect, test } from 'claude-code/testing'

import { agentSample, canLearn, autoMaxLabel, calibrate, claudeBytes, cleanMaxAgents, cleanRamLimit, effectiveMax, guardVerdict, heavyCommand, heavyRamVerdict, hudText, isLiveAgent, learnAgentBytes, limitToast, lockDenyReason, lockHolder, lockRelease, lockTry, machineLine, machineOf, maxAgentsOptions, noteTrip, paneLine, perAgentBytes, perAgentLine, LOCK_STALE_MS, ramLimitBytes, ramLimitOptions, ruleText, shortMachine, tightKind, typedMaxAgents, typedRamLimit } from './machineguard'
import type { GuardInput, Machine, Proc } from './machineguard'

const GB = 1024 ** 3
const mac48: Machine = { os: 'mac', totalBytes: 48 * GB, freeBytes: 20 * GB, cores: 12, known: true }
const input = (over: Partial<GuardInput> = {}): GuardInput => ({ machine: mac48, running: 0, maxAgents: 6, perAgentBytes: 4 * GB, limitBytes: 24 * GB, claudeBytes: 4 * GB, freeBytes: 20 * GB, ...over })

// Machine Guard: crew size from the machine, a RAM limit, the deny decision and its re-arm.

test('calibrate: floor(RAM limit / RAM per agent), from the limit alone, no 8 and no cores', () => {
  const half = GB / 2
  expect(calibrate(15 * GB, half)).toBe(30)
  expect(calibrate(24 * GB, half)).toBe(48)
  expect(calibrate(100 * GB, half)).toBe(200)
  expect(calibrate(1000 * GB, half)).toBe(200)
  expect(calibrate(0.3 * GB, half)).toBe(1)
  expect(calibrate(7.9 * GB, half)).toBe(15)
  expect(calibrate(15 * GB, 2 * GB)).toBe(7)
  expect(calibrate(null, half)).toBe(4)
})

test('an unknown machine gets safe defaults and says so; a typed GB limit still works there', () => {
  const m = machineOf({ os: 'unknown', totalBytes: null, freeBytes: null, cores: null })
  expect(m.known).toBe(false)
  expect(machineLine(m)).toBe('unknown machine')
  expect(calibrate(ramLimitBytes('auto', 0), perAgentBytes(null))).toBe(4)
  expect(calibrate(ramLimitBytes('pct:75', 0), perAgentBytes(null))).toBe(4)
  expect(calibrate(ramLimitBytes('gb:15', 0), perAgentBytes(null))).toBe(30)
  expect(machineOf(null).known).toBe(false)
  // Without RAM numbers nothing is ever refused for RAM.
  expect(tightKind(input({ machine: m, freeBytes: 0, claudeBytes: 99 * GB }))).toBe(null)
})

test('RAM per agent: the default, then an EMA of (Claude - baseline) / N, clamped to 0.2-4 GB', () => {
  expect(perAgentBytes(null)).toBe(0.5 * GB)
  expect(perAgentBytes(10 * GB)).toBe(4 * GB)
  expect(perAgentBytes(0.01 * GB)).toBe(0.2 * GB)
  expect(agentSample(5 * GB, 3 * GB, 4)).toBe(0.5 * GB)
  expect(agentSample(null, 3 * GB, 4)).toBe(null)
  expect(agentSample(5 * GB, null, 4)).toBe(null)
  expect(agentSample(5 * GB, 3 * GB, 0)).toBe(null)
  expect(agentSample(3 * GB, 5 * GB, 2)).toBe(null)
  // Seeded from the default, alpha 0.2: 0.5 -> 0.5*0.8 + 1.5*0.2 = 0.7 GB.
  expect(Math.abs((learnAgentBytes(null, 1.5 * GB) ?? 0) - 0.7 * GB)).toBeLessThan(1000)
  expect(learnAgentBytes(0.7 * GB, null)).toBe(0.7 * GB)
  expect(learnAgentBytes(null, null)).toBe(null)
  expect(learnAgentBytes(4 * GB, 40 * GB)).toBe(4 * GB)
  expect(Math.round(learnAgentBytes(0.2 * GB, 0.0001 * GB) ?? 0)).toBe(Math.round(0.2 * GB))
  expect(perAgentLine(0.5 * GB, false)).toBe('\u22480.5 GB per agent (default)')
  expect(perAgentLine(0.75 * GB, true)).toBe('\u22480.8 GB per agent (learned)')
})

test('the labels: Auto shows the sum; the toast states limit and crew', () => {
  expect(autoMaxLabel(30, 15 * GB, 0.5 * GB)).toBe('Auto \u00b7 30 (15 GB \u00f7 0.5 GB)')
  expect(autoMaxLabel(4, null, 0.5 * GB)).toBe('Auto \u00b7 4 (machine unknown)')
  expect(limitToast(15 * GB, 30)).toBe('RAM limit 15 GB \u2192 up to 30 agents at once')
  expect(limitToast(0.5 * GB, 1)).toBe('RAM limit 0.5 GB \u2192 up to 1 agent at once')
})

test('machineLine: 48 GB RAM · 12 cores · Mac', () => {
  expect(machineLine(mac48)).toBe('48 GB RAM · 12 cores · Mac')
  expect(machineLine(machineOf({ os: 'windows', totalBytes: 16 * GB, freeBytes: 6 * GB, cores: 8 }))).toBe('16 GB RAM · 8 cores · Windows PC')
})

test('the RAM limit round-trips: stored string, bytes, and a Pick option', () => {
  expect(cleanRamLimit('pct:75')).toBe('pct:75')
  expect(cleanRamLimit('gb:12.5')).toBe('gb:12.5')
  for (const bad of [undefined, 7, '', 'gb:0', 'pct:150', 'junk', 'gb:-3']) expect(cleanRamLimit(bad)).toBe('auto')
  expect(ramLimitBytes('auto', 48 * GB)).toBe(24 * GB)
  expect(ramLimitBytes('pct:25', 48 * GB)).toBe(12 * GB)
  expect(ramLimitBytes('gb:12', 48 * GB)).toBe(12 * GB)
  expect(ramLimitBytes('gb:999', 48 * GB)).toBe(48 * GB)
  expect(ramLimitBytes('auto', 0)).toBe(null)
  expect(ramLimitBytes('pct:25', 0)).toBe(null)
  expect(ramLimitBytes('gb:12', 0)).toBe(12 * GB)
  for (const stored of ['auto', 'pct:25', 'pct:50', 'pct:75', 'gb:12', 'gb:8.5']) {
    expect(ramLimitOptions(stored).map(o => o.value)).toContain(cleanRamLimit(stored))
  }
  expect(ramLimitOptions('gb:12').find(o => o.value === 'gb:12')?.label).toBe('12 GB')
  expect(ramLimitOptions('auto').map(o => o.value)).toEqual(['auto', 'pct:25', 'pct:50', 'pct:75'])
})

test('a typed amount is GB; nonsense is refused', () => {
  expect(typedRamLimit('12')).toBe('gb:12')
  expect(typedRamLimit(' 12 GB ')).toBe('gb:12')
  expect(typedRamLimit('6.5gb')).toBe('gb:6.5')
  for (const bad of ['', '0', '-4', 'lots', '12 apples']) expect(typedRamLimit(bad)).toBe(null)
})

test('a limit that rounds to 0 is Auto, never a limit that refuses every agent', () => {
  expect(typedRamLimit('0.01')).toBe(null)
  expect(cleanRamLimit('gb:0.04')).toBe('auto')
  expect(cleanRamLimit('pct:0.4')).toBe('auto')
  expect(cleanRamLimit('pct:100.4')).toBe('pct:100')
  expect(ramLimitOptions('gb:0.04').map(o => o.value)).toEqual(['auto', 'pct:25', 'pct:50', 'pct:75'])
})

test('max agents: Auto is 0, no cap of 8, a sanity ceiling of 200; the pick is always an option', () => {
  expect(cleanMaxAgents(undefined)).toBe(0)
  expect(cleanMaxAgents(3)).toBe(3)
  expect(cleanMaxAgents(50)).toBe(50)
  expect(cleanMaxAgents(999)).toBe(200)
  expect(cleanMaxAgents(-1)).toBe(0)
  expect(typedMaxAgents(' 40 ')).toBe(40)
  expect(typedMaxAgents('0')).toBe(null)
  expect(typedMaxAgents('2.5')).toBe(null)
  expect(typedMaxAgents('abc')).toBe(null)
  expect(effectiveMax(0, 30)).toBe(30)
  expect(effectiveMax(2, 30)).toBe(2)
  const auto = autoMaxLabel(30, 15 * GB, 0.5 * GB)
  const opts = maxAgentsOptions(auto, 0)
  expect(opts[0]).toEqual({ value: '0', label: auto })
  expect(opts.map(o => o.value)).toEqual(['0', '1', '2', '4', '8', '12', '16', '24', '32', '48', '64'])
  // A typed 40 joins the options, in order; a typed 16 does not repeat.
  expect(maxAgentsOptions(auto, 40).map(o => o.value)).toEqual(['0', '1', '2', '4', '8', '12', '16', '24', '32', '40', '48', '64'])
  expect(maxAgentsOptions(auto, 16).map(o => o.value)).toEqual(['0', '1', '2', '4', '8', '12', '16', '24', '32', '48', '64'])
})

test('claudeBytes: Claude and its children, tsc and shells included, not the rest', () => {
  const p = (pid: number, ppid: number, mb: number, name: string): Proc => ({ pid, ppid, rssBytes: mb * 1024 ** 2, name })
  const procs = [
    p(1, 0, 10, '/sbin/launchd'),
    p(100, 1, 500, '/Applications/Claude.app/Contents/MacOS/claude'),
    p(101, 100, 20, '/bin/zsh'),
    p(102, 101, 5600, 'node'),
    p(103, 100, 300, 'node'),
    p(200, 1, 900, '/Applications/Safari.app/Safari'),
  ]
  expect(claudeBytes(procs)).toBe((500 + 20 + 5600 + 300) * 1024 ** 2)
  // Two sessions are two roots; a claude under a claude is not counted twice.
  expect(claudeBytes([...procs, p(300, 1, 400, 'claude.exe'), p(301, 100, 50, 'claude')])).toBe((500 + 20 + 5600 + 300 + 50 + 400) * 1024 ** 2)
  expect(claudeBytes([p(1, 0, 10, 'launchd')])).toBe(null)
  expect(claudeBytes([])).toBe(null)
})

test('Windows reads free RAM low, so it trips at 5% instead of 10%', () => {
  const win: Machine = { ...mac48, os: 'windows' }
  expect(tightKind(input({ machine: win, freeBytes: 4 * GB }))).toBe(null)
  expect(tightKind(input({ machine: win, freeBytes: 2 * GB }))).toBe('free')
  expect(tightKind(input({ freeBytes: 4 * GB }))).toBe('free')
})

test('the verdict: agents at max, over the limit, under 10% free; else let it start', () => {
  expect(guardVerdict(input())).toBe(null)
  expect(guardVerdict(input({ running: 5 }))).toBe(null)
  const full = guardVerdict(input({ running: 6 }))
  expect(full?.kind).toBe('agents')
  expect(full?.reason).toBe('Machine Guard: 6 of 6 agents running (RAM limit 24 GB, \u22484 GB per agent). Wait for one to finish, or raise the limit in Settings.')
  const over = guardVerdict(input({ claudeBytes: 30 * GB }))
  expect(over?.kind).toBe('ram')
  expect(over?.reason).toMatch(/using 30 GB, over its 24 GB RAM limit on this 48 GB Mac/)
  const low = guardVerdict(input({ freeBytes: 3 * GB }))
  expect(low?.kind).toBe('free')
  expect(low?.reason).toMatch(/only 6% of RAM is free/)
  // 10% free exactly is fine.
  expect(guardVerdict(input({ freeBytes: 4.8 * GB }))).toBe(null)
})

test('with Claude\'s own use unmeasured, system-wide used RAM is compared to the limit', () => {
  expect(guardVerdict(input({ claudeBytes: null, freeBytes: 30 * GB }))).toBe(null)
  expect(guardVerdict(input({ claudeBytes: null, freeBytes: 20 * GB, limitBytes: 12 * GB }))?.kind).toBe('ram')
})

test('before the first sample nothing is refused for RAM, only for the crew size', () => {
  expect(guardVerdict(input({ freeBytes: null, claudeBytes: null }))).toBe(null)
  expect(guardVerdict(input({ freeBytes: null, claudeBytes: null, running: 6 }))?.kind).toBe('agents')
})

test('the prompt rule states the limit and the max; one at a time; tight adds the stop line', () => {
  const calm = ruleText(15 * GB, 0.5 * GB, 30, 30, false)
  expect(calm).toMatch(/^Machine Guard: Claude may use 15 GB of RAM \u2192 at most 30 agents at once \(\u22480\.5 GB each\)\./)
  expect(calm).toMatch(/heavy commands \(test suites, type checks, builds\) one at a time/)
  expect(calm).not.toMatch(/RAM is tight/)
  expect(ruleText(0.5 * GB, 0.5 * GB, 1, 1, true)).toMatch(/at most 1 agent at once/)
  expect(ruleText(0.5 * GB, 0.5 * GB, 1, 1, true)).toMatch(/RAM is tight: run no new agents and no heavy commands until it frees up/)
  expect(ruleText(15 * GB, 0.5 * GB, 12, 30, false)).toMatch(/person set the crew to at most 12 agents at once/)
  expect(ruleText(null, 0.5 * GB, 4, 4, false)).toMatch(/could not be measured, so run at most 4 agents at once/)
})

test('warn once when a guard trips; warn again only after it recovered and tripped again', () => {
  let w: readonly ('agents' | 'ram' | 'free')[] = []
  let r = noteTrip(w, 'ram', true)
  expect(r.toast).toBe(true)
  w = r.warned
  r = noteTrip(w, 'ram', true)
  expect(r.toast).toBe(false)
  w = r.warned
  // Another kind is its own guard.
  expect(noteTrip(w, 'agents', true).toast).toBe(true)
  w = noteTrip(w, 'ram', false).warned
  expect(w).toEqual([])
  expect(noteTrip(w, 'ram', true).toast).toBe(true)
  expect(noteTrip(w, 'ram', false).toast).toBe(false)
})

test('hudText: RAM 9.1/15 GB · 3/30 agents', () => {
  const g = input({ running: 3, maxAgents: 30, limitBytes: 15 * GB, claudeBytes: 9.1 * GB })
  expect(hudText(g)).toBe('RAM 9.1/15 GB \u00b7 3/30 agents')
  expect(hudText(input({ claudeBytes: null, freeBytes: null }))).toBe('RAM ?/24 GB \u00b7 0/6 agents')
  expect(hudText(input({ limitBytes: null, claudeBytes: 2 * GB }))).toBe('RAM 2 GB \u00b7 0/6 agents')
})

test('the pane line: RAM and the crew while working, else the limit and what it allows', () => {
  expect(shortMachine(mac48)).toBe('48 GB Mac')
  expect(paneLine(15, 9.1, 3, 30, true)).toBe('\u{1F6E1}\uFE0E RAM 9.1/15 GB \u00b7 3/30 agents')
  expect(paneLine(15, -1, 1, 30, true)).toBe('\u{1F6E1}\uFE0E RAM ?/15 GB \u00b7 1/30 agents')
  expect(paneLine(15, 0, 0, 30, false)).toBe('\u{1F6E1}\uFE0E 15 GB limit \u00b7 up to 30 agents')
  expect(paneLine(0, -1, 0, 4, false)).toBe('\u{1F6E1}\uFE0E up to 4 agents')
  expect(paneLine(0.5, -1, 0, 1, false)).toBe('\u{1F6E1}\uFE0E 0.5 GB limit \u00b7 up to 1 agent')
})

test('the crew counts running, pending and waiting agents, not ended or idle ones', () => {
  for (const s of ['running', 'pending', 'waiting']) expect(isLiveAgent(s)).toBe(true)
  for (const s of ['idle', 'completed', 'failed', 'killed']) expect(isLiveAgent(s)).toBe(false)
})

test('heavyCommand: type checks, test runners and builds are heavy; nothing else is', () => {
  const heavy: [string, string][] = [
    ['tsc --noEmit -p .', 'tsc'],
    ['bunx -p typescript tsc --noEmit -p . | grep -c "error TS"', 'tsc'],
    ['npx tsc', 'tsc'],
    ['cd app && ./node_modules/.bin/tsc -b', 'tsc'],
    ['"/Users/me/claude.app/Contents/MacOS/claude" plugin test --file "/a b/c.ts" .', 'plugin test'],
    ['claude plugin test .', 'plugin test'],
    ['npx jest --runInBand', 'jest'],
    ['vitest run', 'vitest'],
    ['mocha test/', 'mocha'],
    ['pytest -x', 'pytest'],
    ['python3 -m pytest', 'python -m pytest'],
    ['npm test', 'npm test'],
    ['npm run test:unit', 'npm run test:unit'],
    ['pnpm run build', 'pnpm run build'],
    ['yarn build', 'yarn build'],
    ['bun test', 'bun test'],
    ['CI=1 npm run build', 'npm run build'],
    ['time cargo build --release', 'cargo build'],
    ['cargo test', 'cargo test'],
    ['go build ./...', 'go build'],
    ['go test ./...', 'go test'],
    ['make -j4', 'make'],
    ['./gradlew assemble', 'gradle'],
    ['xcodebuild -scheme App', 'xcodebuild'],
    ['docker build -t x .', 'docker build'],
    ['echo hi; npm test', 'npm test'],
    ['bash -c "npm run build"', 'npm run build'],
    // A type check run by node itself, or a package binary run by yarn / pnpm / bun.
    ['node node_modules/typescript/lib/tsc.js --noEmit', 'tsc'],
    ['node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc -p .', 'tsc'],
    ['yarn tsc --noEmit', 'tsc'],
    ['pnpm vitest run', 'vitest'],
    ['bun run tsc', 'tsc'],
  ]
  for (const [cmd, label] of heavy) expect([cmd, heavyCommand(cmd)]).toEqual([cmd, label])
  const light = [
    'ls -la',
    'git commit -m "fix tsc and npm test"',
    'grep -rn tsc hooks/',
    'echo "npm test"',
    'cat package.json',
    'npm install',
    'npm run lint',
    'npm run dev',
    'git status && git log --oneline',
    'bunx prettier --write hooks/a.ts',
    'claude plugin validate .',
    'docker ps',
    'cargo fmt',
    'go fmt ./...',
    'node scripts/build-skins.js',
    'node --version',
    'yarn install',
    'pnpm add -D typescript',
    '',
  ]
  for (const cmd of light) expect([cmd, heavyCommand(cmd)]).toEqual([cmd, null])
  expect(heavyCommand(undefined)).toBe(null)
  expect(heavyCommand(42)).toBe(null)
})

test('the heavy lock: one holder, others wait, a release frees it, a lost release frees itself', () => {
  let lock = null as ReturnType<typeof lockTry>['lock']
  let r = lockTry(lock, 'a', 'tsc', 1000)
  expect(r.got).toBe(true)
  lock = r.lock
  // Another owner is refused and the lock stays as it was.
  r = lockTry(lock, 'b', 'jest', 2000)
  expect(r.got).toBe(false)
  expect(r.lock).toEqual({ owner: 'a', label: 'tsc', since: 1000 })
  // Someone else's release changes nothing; the holder's does.
  expect(lockRelease(lock, 'b')).toEqual(lock)
  expect(lockRelease(lock, 'a')).toBe(null)
  // A lock nobody released frees itself after 15 minutes.
  expect(lockHolder(lock, 1000 + LOCK_STALE_MS - 1)?.owner).toBe('a')
  expect(lockHolder(lock, 1000 + LOCK_STALE_MS)).toBe(null)
  expect(lockTry(lock, 'b', 'jest', 1000 + LOCK_STALE_MS).got).toBe(true)
  expect(lockDenyReason('tsc')).toBe('Machine Guard: another heavy command (tsc) is running; retry when it finishes.')
})

test('a new heavy command is refused only while Claude is over its RAM limit', () => {
  expect(heavyRamVerdict(input(), 'tsc')).toBe(null)
  expect(heavyRamVerdict(input({ claudeBytes: 30 * GB }), 'tsc')).toMatch(/using 30 GB, over its 24 GB RAM limit; not starting a heavy command \(tsc\)/)
  // Low free RAM alone, or an unknown machine, never blocks a command.
  expect(heavyRamVerdict(input({ freeBytes: 1 * GB }), 'tsc')).toBe(null)
  expect(heavyRamVerdict(input({ machine: machineOf(null), claudeBytes: 99 * GB }), 'tsc')).toBe(null)
})

test('a heavy command cannot poison the per-agent cost', () => {
  const p = (pid: number, ppid: number, mb: number, name: string): Proc => ({ pid, ppid, rssBytes: mb * 1024 ** 2, name })
  const baseline = [p(100, 1, 500, 'claude'), p(101, 100, 300, 'node')]
  // Two agents (small), then a 19 GB tsc under one of them.
  const withAgents = [...baseline, p(102, 100, 400, 'node'), p(103, 100, 400, 'node')]
  const withTsc = [...withAgents, p(104, 102, 19_000, 'tsc'), p(105, 104, 200, 'node')]
  const bytes = (procs: Proc[], lean: boolean) => claudeBytes(procs, lean)
  // The total sees the tsc, the lean measure does not: it learns 0.4 GB-ish, not 9.5 GB.
  expect(bytes(withTsc, false)).toBeGreaterThan(19_000 * 1024 ** 2)
  expect(bytes(withTsc, true)).toBe(bytes(withAgents, true))
  const sample = agentSample(bytes(withTsc, true), bytes(baseline, true), 2)
  expect(sample).toBe(400 * 1024 ** 2)
  expect(learnAgentBytes(null, sample) ?? 0).toBeLessThan(0.5 * GB)
  // And whatever the process names, a read that overlaps the lock teaches nothing.
  expect(canLearn(false, 3, 3)).toBe(true)
  expect(canLearn(true, 3, 3)).toBe(false)
  expect(canLearn(false, 3, 4)).toBe(false)
})
