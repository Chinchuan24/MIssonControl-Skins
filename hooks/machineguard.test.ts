import { expect, test } from 'claude-code/testing'

import { calibrate, claudeBytes, cleanMaxAgents, cleanRamLimit, effectiveMax, guardVerdict, hudText, machineLine, machineOf, maxAgentsOptions, noteTrip, ramLimitBytes, ramLimitOptions, ruleText, tightKind, typedRamLimit } from './machineguard'
import type { GuardInput, Machine, Proc } from './machineguard'

const GB = 1024 ** 3
const mac48: Machine = { os: 'mac', totalBytes: 48 * GB, freeBytes: 20 * GB, cores: 12, known: true }
const input = (over: Partial<GuardInput> = {}): GuardInput => ({ machine: mac48, running: 0, maxAgents: 6, limitBytes: 24 * GB, claudeBytes: 4 * GB, freeBytes: 20 * GB, ...over })

// Machine Guard: crew size from the machine, a RAM limit, the deny decision and its re-arm.

test('calibrate: one agent per 8 GB, 1 to 8, capped by half the cores', () => {
  const m = (gb: number, cores: number): Machine => ({ os: 'mac', totalBytes: gb * GB, freeBytes: gb * GB, cores, known: true })
  expect(calibrate(m(8, 8))).toBe(1)
  expect(calibrate(m(16, 8))).toBe(2)
  expect(calibrate(m(48, 12))).toBe(6)
  expect(calibrate(m(48, 4))).toBe(2)
  expect(calibrate(m(256, 64))).toBe(8)
  expect(calibrate(m(4, 2))).toBe(1)
  expect(calibrate(m(32, 1))).toBe(1)
})

test('an unknown machine gets safe defaults and says so', () => {
  const m = machineOf({ os: 'unknown', totalBytes: null, freeBytes: null, cores: null })
  expect(m.known).toBe(false)
  expect(machineLine(m)).toBe('unknown machine')
  expect(calibrate(m)).toBe(4)
  expect(machineOf(null).known).toBe(false)
  // Without RAM numbers nothing is ever refused for RAM.
  expect(tightKind(input({ machine: m, freeBytes: 0, claudeBytes: 99 * GB }))).toBe(null)
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

test('max agents: Auto is 0 and follows the calibration; the pick is always an option', () => {
  expect(cleanMaxAgents(undefined)).toBe(0)
  expect(cleanMaxAgents(3)).toBe(3)
  expect(cleanMaxAgents(99)).toBe(8)
  expect(cleanMaxAgents(-1)).toBe(0)
  expect(effectiveMax(0, 6)).toBe(6)
  expect(effectiveMax(2, 6)).toBe(2)
  const opts = maxAgentsOptions(6)
  expect(opts[0]).toEqual({ value: '0', label: 'Auto (6)' })
  expect(opts.map(o => o.value)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8'])
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
  expect(full?.reason).toBe('Machine Guard: 6 of 6 agents running on this 48 GB Mac. Wait for one to finish, or raise the limit in Settings.')
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

test('the prompt rule always carries the one-at-a-time line and the number; tight adds the stop line', () => {
  const calm = ruleText(6, false)
  expect(calm).toMatch(/heavy commands \(test suites, type checks, builds\) one at a time, never in parallel across agents/)
  expect(calm).toMatch(/at most 6 sub-agents/)
  expect(calm).not.toMatch(/RAM is tight/)
  expect(ruleText(1, true)).toMatch(/at most 1 sub-agent at once/)
  expect(ruleText(1, true)).toMatch(/RAM is tight: run no new agents and no heavy commands until it frees up/)
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

test('hudText: RAM 62% · 3/6 agents', () => {
  expect(hudText(input({ running: 3, freeBytes: 18.24 * GB }))).toBe('RAM 62% · 3/6 agents')
  expect(hudText(input({ freeBytes: null }))).toBe('RAM ? · 0/6 agents')
})
