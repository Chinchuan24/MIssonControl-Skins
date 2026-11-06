import { expect, test } from 'claude-code/testing'

import {
  HOT_EVERY_MS, KILL_COOLDOWN_MS, KILL_MIN_BYTES, LOCK_STALE_MS, PEER_DROP_MS, PEER_FRESH_MS, SESSION_PREFIX,
  cleanKillSwitch, cleanSessionRec, guardVerdict, heavyArgs, holdWins, holderWhere, hudLine, hudText, isHot, killContext, killDecision, killNote,
  killNoteLive, killOptions, killPick, killToast, neverKill, othersSummary, paneLine, peerAgents, peerHeavy, peersOf, ruleText, sessionCount, withArgs,
} from './machineguard'
import type { GuardInput, Machine, Proc } from './machineguard'

// Machine Guard v3: one budget across every live session, and the kill switch.

const GB = 1024 ** 3
const MB = 1024 ** 2
const NOW = 1_800_000_000_000
const mac48: Machine = { os: 'mac', totalBytes: 48 * GB, freeBytes: 20 * GB, cores: 12, known: true }
const input = (over: Partial<GuardInput> = {}): GuardInput => ({ machine: mac48, running: 0, maxAgents: 16, perAgentBytes: GB, limitBytes: 20 * GB, claudeBytes: 4 * GB, freeBytes: 20 * GB, ...over })
const rec = (over: Record<string, unknown> = {}) => ({ agents: 3, busy: true, heavy: null, at: NOW - 5_000, name: 'notes', ...over })

// ---- the shared budget ----

test('a stored session record is cleaned; anything else is no record', () => {
  expect(cleanSessionRec(rec())).toEqual({ agents: 3, busy: true, heavy: null, at: NOW - 5_000, name: 'notes' })
  expect(cleanSessionRec(rec({ heavy: { cmd: 'tsc', since: NOW - 1000 } }))?.heavy).toEqual({ cmd: 'tsc', since: NOW - 1000 })
  expect(cleanSessionRec(rec({ heavy: { cmd: 7 } }))?.heavy).toBe(null)
  expect(cleanSessionRec(null)).toBe(null)
  expect(cleanSessionRec('x')).toBe(null)
  expect(cleanSessionRec({ agents: -1, at: NOW })).toBe(null)
  expect(cleanSessionRec({ agents: 1 })).toBe(null)
  expect(SESSION_PREFIX).toBe('mg.s.')
})

test('peers: fresh ones with something going on count; self, stale, idle and garbage do not', () => {
  const entries = {
    me: rec({ agents: 9 }),
    a: rec({ agents: 5 }),
    b: rec({ agents: 0, busy: true }),
    idle: rec({ agents: 0, busy: false }),
    old: rec({ agents: 7, at: NOW - PEER_FRESH_MS }),
    crashed: rec({ agents: 7, at: NOW - PEER_DROP_MS - 1 }),
    junk: 'nope',
    future: rec({ agents: 4, at: NOW + PEER_FRESH_MS }),
  }
  const { peers, drop } = peersOf(entries, 'me', NOW)
  expect(peers.map(p => p.id)).toEqual(['a', 'b'])
  expect(peerAgents(peers)).toBe(5)
  expect(sessionCount(peers)).toBe(3)
  // Only a record far out of date, or one that is not a record, is deleted; a quiet one is just ignored.
  expect(drop.sort()).toEqual(['crashed', 'junk'])
  expect(peersOf({}, 'me', NOW)).toEqual({ peers: [], drop: [] })
})

test('a crashed session stops counting after 60 s; a session that ends is gone at once', () => {
  const alive = peersOf({ a: rec({ agents: 6, at: NOW - 59_000 }) }, 'me', NOW).peers
  expect(peerAgents(alive)).toBe(6)
  expect(peersOf({ a: rec({ agents: 6, at: NOW - 61_000 }) }, 'me', NOW).peers).toEqual([])
  // The idle-ending write: no agents, not busy, no hold.
  expect(peersOf({ a: rec({ agents: 0, busy: false, at: NOW - 1000 }) }, 'me', NOW).peers).toEqual([])
})

test('the agent count is the sum over sessions, and the refusal names them', () => {
  const peers = peersOf({ a: rec({ agents: 11, name: 'claude mod' }) }, 'me', NOW).peers
  expect(othersSummary(peers)).toBe('11 in claude mod')
  expect(othersSummary(peersOf({ a: rec({ agents: 2, name: '' }), b: rec({ agents: 1, name: 'x' }), c: rec({ agents: 0 }) }, 'me', NOW).peers)).toBe('2 in another session, 1 in x')
  // 5 here + 11 there = 16 of 16: refused.
  const g = input({ running: 5 + peerAgents(peers), sessions: { count: sessionCount(peers), here: 5, others: othersSummary(peers) } })
  expect(guardVerdict(g)).toMatchObject({ kind: 'agents', reason: expect.stringContaining('Machine Guard: 16 of 16 agents running across 2 sessions (5 here, 11 in claude mod)') })
  // 15 of 16: still room.
  expect(guardVerdict({ ...g, running: 15 })).toBe(null)
  // One session says nothing new.
  expect(guardVerdict(input({ running: 16 }))?.reason).toBe('Machine Guard: 16 of 16 agents running (RAM limit 20 GB, ≈1 GB per agent). Wait for one to finish, or raise the limit in Settings.')
})

test('the chip shows the session count only when there is more than one', () => {
  expect(hudLine(9.1, 20, 5, 16)).toBe('RAM 9.1/20 GB · 5/16 agents')
  expect(hudLine(9.1, 20, 5, 16, 1)).toBe('RAM 9.1/20 GB · 5/16 agents')
  expect(hudLine(9.1, 20, 5, 16, 2)).toBe('RAM 9.1/20 GB · 5/16 agents · 2 sessions')
  expect(paneLine(20, 9.1, 5, 16, true, 2)).toBe('\u{1F6E1}\uFE0E RAM 9.1/20 GB · 5/16 agents · 2 sessions')
  expect(paneLine(20, 9.1, 5, 16, true)).toBe('\u{1F6E1}\uFE0E RAM 9.1/20 GB · 5/16 agents')
  // Idle: the limit line, whatever the sessions.
  expect(paneLine(20, 9.1, 5, 16, false, 3)).toBe('\u{1F6E1}\uFE0E 20 GB limit · up to 16 agents')
  expect(hudText(input({ running: 5, sessions: { count: 2, here: 3, others: '' } }))).toBe('RAM 4/20 GB · 5/16 agents · 2 sessions')
})

test('the heavy lock is global: the oldest hold wins, a stale hold is broken', () => {
  const held = (id: string, since: number, over: Record<string, unknown> = {}) => [id, rec({ agents: 0, heavy: { cmd: 'tsc', since }, ...over })] as const
  const peers = (...es: (readonly [string, unknown])[]) => peersOf(Object.fromEntries(es), 'me', NOW).peers
  expect(peerHeavy(peers(['a', rec()]), NOW)).toBe(null)
  expect(peerHeavy(peers(held('a', NOW - 2000)), NOW)?.id).toBe('a')
  expect(peerHeavy(peers(held('b', NOW - 1000), held('a', NOW - 3000)), NOW)?.id).toBe('a')
  // A hold older than 15 minutes is a lost release and frees itself.
  expect(peerHeavy(peers(held('a', NOW - LOCK_STALE_MS - 1, { at: NOW - 1000 })), NOW)).toBe(null)
  // Both claimed at once: the one who claimed first keeps it; equal times go to the lower id; a later claim backs off.
  expect(holdWins('me', NOW - 5000, peers(held('a', NOW - 2000)), NOW)).toBe(true)
  expect(holdWins('me', NOW - 1000, peers(held('a', NOW - 2000)), NOW)).toBe(false)
  expect(holdWins('me', NOW - 2000, peers(held('z', NOW - 2000)), NOW)).toBe(true)
  expect(holdWins('me', NOW - 2000, peers(held('a', NOW - 2000)), NOW)).toBe(false)
  expect(holdWins('me', NOW, [], NOW)).toBe(true)
  expect(holderWhere(peers(held('a', NOW - 1))[0] ?? null)).toBe('in "notes"')
  expect(holderWhere(null)).toBe('')
})

test('the prompt rule tells Claude about the shared budget and the kill switch', () => {
  const plain = ruleText(15 * GB, GB / 2, 30, 30, false)
  expect(plain).not.toContain('sessions')
  expect(plain).not.toContain('stops the biggest')
  const full = ruleText(15 * GB, GB / 2, 30, 30, false, { sessions: 2, killOn: true, stopped: 'Machine Guard stopped `tsc`.' })
  expect(full).toContain('2 Claude sessions are running and share that budget')
  expect(full).toContain('the guard stops the biggest heavy command')
  expect(full.endsWith('Machine Guard stopped `tsc`.')).toBe(true)
})

// ---- the kill switch: what counts as heavy ----

test('heavyArgs: the heavy tool a whole command line runs, also behind node', () => {
  expect(heavyArgs('tsc --noEmit -p .')).toBe('tsc')
  expect(heavyArgs('node /repo/node_modules/typescript/lib/tsc.js --noEmit')).toBe('tsc')
  expect(heavyArgs('node --max-old-space-size=8192 /repo/node_modules/.bin/tsc -p .')).toBe('tsc')
  expect(heavyArgs('/Users/me/.bun/bin/bun /repo/node_modules/jest/bin/jest.js --ci')).toBe('jest')
  expect(heavyArgs('node /Users/me/My Projects/app/node_modules/.bin/tsc --noEmit')).toBe('tsc')
  expect(heavyArgs('python3 -m pytest tests')).toBe('python -m pytest')
  expect(heavyArgs('cargo build --release')).toBe('cargo build')
  expect(heavyArgs('npm run build')).toBe('npm run build')
  expect(heavyArgs('xcodebuild -scheme App')).toBe('xcodebuild')
  // Not heavy.
  expect(heavyArgs('node /repo/server.js tsc')).toBe(null)
  expect(heavyArgs('node /repo/node_modules/typescript/lib/tsserver.js')).toBe(null)
  expect(heavyArgs('vim jest.config.js')).toBe(null)
  expect(heavyArgs('/Applications/Slack.app/Contents/MacOS/Slack')).toBe(null)
  expect(heavyArgs('')).toBe(null)
  expect(heavyArgs(undefined)).toBe(null)
})

test('neverKill: Claude and its helpers, apps, shells, MCP servers and the user\'s tools are safe', () => {
  const p = (name: string, args = name, pid = 500): Proc => ({ pid, ppid: 1, rssBytes: 20 * GB, name, args })
  for (const safe of [
    p('claude'), p('Claude'), p('/Applications/Claude.app/Contents/MacOS/Claude'), p('Claude Helper', '/Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper --type=renderer'),
    p('/Library/App/claude', '/Library/App/claude plugin test .'),
    p('zsh'), p('-zsh'), p('bash', 'bash -c tsc'), p('sh'), p('powershell'),
    p('node', 'node /x/mcp-server-filesystem/dist/index.js'), p('node', 'npx -y @modelcontextprotocol/server-memory'),
    p('/Applications/Xcode.app/Contents/MacOS/Xcode'), p('code'), p('/usr/bin/ssh'), p('docker'),
    p('tsc', 'tsc', 1), p('tsc', 'tsc', 0),
  ]) expect(neverKill(safe)).toBe(true)
  expect(neverKill(p('node', 'node /repo/node_modules/.bin/tsc'))).toBe(false)
  expect(neverKill(p('tsc', 'tsc --noEmit'))).toBe(false)
  expect(neverKill(p('/usr/local/bin/node', '/usr/local/bin/node /Users/me/code/app/node_modules/.bin/tsc'))).toBe(false)
})

// ---- the kill switch: which process ----

const P = (pid: number, ppid: number, mb: number, name: string, args?: string): Proc => ({ pid, ppid, rssBytes: mb * MB, name, ...(args ? { args } : {}) })
// claude 100 → zsh 101 → npm test 102 → node jest 103 (6 GB) ; claude 100 → node tsc 104 (19.7 GB);
// claude 100 → mcp 105 ; Claude Helper 106 ; a tsc 200 outside any Claude tree (30 GB); a user's app 300.
const TREE: Proc[] = [
  P(1, 0, 10, 'launchd'),
  P(100, 1, 900, 'claude', '/x/claude'),
  P(101, 100, 20, 'zsh', '-zsh'),
  P(102, 101, 80, 'npm', 'npm test'),
  P(103, 102, 6_000, 'node', 'node /repo/node_modules/jest/bin/jest.js'),
  P(104, 100, 19_700, 'node', 'node /repo/node_modules/typescript/lib/tsc.js --noEmit'),
  P(105, 100, 3_000, 'node', 'node /x/mcp-server-big/index.js'),
  P(106, 100, 2_000, 'Claude Helper', '/Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper'),
  P(200, 1, 30_000, 'node', 'node /other/node_modules/typescript/lib/tsc.js'),
  P(300, 1, 8_000, 'Slack', '/Applications/Slack.app/Contents/MacOS/Slack'),
]

test('killPick: the biggest heavy process under Claude, and nothing else', () => {
  expect(killPick(TREE)).toMatchObject({ pid: 104, label: 'tsc', rssBytes: 19_700 * MB })
  // Without the tsc: the jest worker at the bottom, never the npm wrapper above it or the shell.
  expect(killPick(TREE.filter(p => p.pid !== 104))).toMatchObject({ pid: 103, label: 'jest' })
  // Without any heavy process under Claude: nothing, even with a 30 GB tsc outside and big MCP/app processes.
  expect(killPick(TREE.filter(p => p.pid !== 104 && p.pid !== 103 && p.pid !== 102))).toBe(null)
  // The one outside Claude's tree is never a candidate.
  expect(killPick(TREE.filter(p => p.pid === 200 || p.pid === 1))).toBe(null)
})

test('killPick: leaves the wrapper, ignores small ones, and needs command lines', () => {
  // jest under npm test under a shell: only the leaf.
  expect(killPick(TREE.filter(p => p.pid !== 104))?.pid).toBe(103)
  // A heavy process under the size floor is left alone.
  const small = [P(100, 1, 900, 'claude'), P(110, 100, 100, 'node', 'node /r/node_modules/.bin/tsc')]
  expect(killPick(small)).toBe(null)
  expect(killPick(small, 0)?.pid).toBe(110)
  expect(KILL_MIN_BYTES).toBe(256 * MB)
  // No command lines (names only): no way to tell a type check from a node server.
  expect(killPick(TREE.map(({ args: _a, ...rest }) => rest))).toBe(null)
  expect(killPick([])).toBe(null)
  // Two of the same size: the lower pid, always the same one.
  const twins = [P(100, 1, 900, 'claude'), P(120, 100, 2000, 'tsc', 'tsc -p a'), P(121, 100, 2000, 'tsc', 'tsc -p b')]
  expect(killPick(twins)?.pid).toBe(120)
})

test('killPick: the Desktop app\'s Claude counts as Claude, so what it started is under Claude', () => {
  const desktop = [P(10, 1, 400, '/Applications/Claude.app/Contents/MacOS/Claude'), P(11, 10, 900, 'claude'), P(12, 11, 5000, 'node', 'node /r/node_modules/vitest/vitest.mjs run')]
  expect(killPick(desktop)).toMatchObject({ pid: 12, label: 'vitest' })
})

test('killPick: what the person runs in the desktop app\'s own Terminal tab is not Claude\'s, so it is never stopped', () => {
  const tab = [P(10, 1, 400, '/Applications/Claude.app/Contents/MacOS/Claude'), P(13, 10, 150, '/Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper'), P(14, 13, 20, '/bin/zsh', '-zsh'), P(15, 14, 9000, 'node', 'node /r/node_modules/.bin/tsc --noEmit')]
  expect(killPick(tab)).toBe(null)
  expect(killPick([...tab, P(16, 10, 900, 'Claude.exe'), P(17, 16, 5000, 'node.exe', 'node C:\\r\\node_modules\\.bin\\tsc')])).toBe(null)
  expect(killPick([...tab, P(18, 10, 900, 'claude.exe'), P(19, 18, 5000, 'node.exe', 'node C:\\r\\node_modules\\.bin\\tsc')])?.pid).toBe(19)
})

test('heavyArgs: Windows command lines, with their quoted paths', () => {
  expect(heavyArgs('"C:\\Program Files\\nodejs\\node.exe" C:\\app\\node_modules\\typescript\\bin\\tsc -p .')).toBe('tsc')
  expect(heavyArgs('"C:\\Program Files\\nodejs\\node.exe" "C:\\My app\\node_modules\\jest\\bin\\jest.js" --ci')).toBe('jest')
  expect(heavyArgs('"C:\\tools\\tsc.exe" -p .')).toBe('tsc')
  expect(heavyArgs('"C:\\Program Files\\nodejs\\node.exe" C:\\app\\server.js tsc')).toBe(null)
  expect(heavyArgs('"C:\\Program Files\\Slack\\slack.exe" --startup')).toBe(null)
})

test('killDecision: only on a fresh read over the limit, with the switch on, once per cooldown', () => {
  const base = { enabled: true, limitBytes: 20 * GB, procs: TREE, readAgeMs: 800, sinceKillMs: null as number | null }
  // Claude: 900+20+80+6000+19700+3000+2000 MB = 31.2 GB, over 20.
  const d = killDecision(base)
  expect('kill' in d && d.kill.pid).toBe(104)
  expect('kill' in d && Math.round(d.claudeBytes / GB)).toBe(31)
  expect(killDecision({ ...base, enabled: false })).toEqual({ skip: 'off' })
  expect(killDecision({ ...base, limitBytes: null })).toEqual({ skip: 'unknown' })
  expect(killDecision({ ...base, procs: [] })).toEqual({ skip: 'unknown' })
  expect(killDecision({ ...base, limitBytes: 40 * GB })).toEqual({ skip: 'under' })
  expect(killDecision({ ...base, readAgeMs: 5_001 })).toEqual({ skip: 'stale' })
  expect(killDecision({ ...base, readAgeMs: 5_000 })).toMatchObject({ kill: { pid: 104 } })
  expect(killDecision({ ...base, readAgeMs: -1 })).toEqual({ skip: 'stale' })
  expect(killDecision({ ...base, readAgeMs: Number.NaN })).toEqual({ skip: 'stale' })
  expect(killDecision({ ...base, sinceKillMs: KILL_COOLDOWN_MS - 1 })).toEqual({ skip: 'cooldown' })
  expect(killDecision({ ...base, sinceKillMs: KILL_COOLDOWN_MS })).toMatchObject({ kill: { pid: 104 } })
  // Over the limit with nothing heavy under Claude (the RAM is an agent's, an MCP server's, an app's): nothing is stopped.
  expect(killDecision({ ...base, limitBytes: 5 * GB, procs: TREE.filter(p => ![102, 103, 104].includes(p.pid)) })).toEqual({ skip: 'none' })
})

test('killDecision: one process per look; the next look, after the cooldown, takes the next', () => {
  const first = killDecision({ enabled: true, limitBytes: 20 * GB, procs: TREE, readAgeMs: 0, sinceKillMs: null })
  expect('kill' in first && first.kill.pid).toBe(104)
  const rest = TREE.filter(p => p.pid !== 104)
  // 104 is gone: Claude is at 11.5 GB, under 20, so nothing more is stopped.
  expect(killDecision({ enabled: true, limitBytes: 20 * GB, procs: rest, readAgeMs: 0, sinceKillMs: 25_000 })).toEqual({ skip: 'under' })
  // Still over a lower limit: the jest worker is next.
  const second = killDecision({ enabled: true, limitBytes: 8 * GB, procs: rest, readAgeMs: 0, sinceKillMs: 25_000 })
  expect('kill' in second && second.kill.pid).toBe(103)
})

test('withArgs matches command lines to the name list by pid; rows without one stay as they were', () => {
  const merged = withArgs([P(1, 0, 1, 'a'), P(2, 1, 1, 'b')], [{ pid: 2, args: 'b --flag' }, { pid: 9, args: 'zzz' }])
  expect(merged).toEqual([P(1, 0, 1, 'a'), P(2, 1, 1, 'b', 'b --flag')])
  // A pid reused between the two reads has another parent: its command line is not taken.
  expect(withArgs([P(2, 1, 1, 'b')], [{ pid: 2, ppid: 7, args: 'tsc -p .' }])).toEqual([P(2, 1, 1, 'b')])
  expect(withArgs([P(2, 1, 1, 'b')], [{ pid: 2, ppid: 1, args: 'tsc -p .' }])).toEqual([P(2, 1, 1, 'b', 'tsc -p .')])
})

test('the kill switch setting is on unless it says off, and the Pick holds both options', () => {
  expect(cleanKillSwitch(undefined)).toBe('on')
  expect(cleanKillSwitch('on')).toBe('on')
  expect(cleanKillSwitch('off')).toBe('off')
  expect(cleanKillSwitch(false)).toBe('off')
  expect(cleanKillSwitch('junk')).toBe('on')
  const values = killOptions().map(o => o.value)
  for (const v of ['on', 'off']) expect(values).toContain(cleanKillSwitch(v))
})

test('the messages: toast, the line Claude reads, and the tool result note', () => {
  const t = { pid: 104, name: 'node', args: 'tsc', label: 'tsc', rssBytes: 19.7 * GB }
  expect(killToast(t, 24 * GB, 20 * GB)).toBe('\u{1F52A} Machine Guard stopped `tsc` (19.7 GB): Claude was at 24/20 GB')
  expect(killNote(t, 24 * GB, 20 * GB)).toContain('Machine Guard stopped `tsc` (19.7 GB) because Claude was using 24 GB, over its 20 GB RAM limit.')
  expect(killNote(t, 24 * GB, 20 * GB)).toContain('re-run only when RAM is under the limit')
  expect(killNote(t, 24 * GB, 20 * GB)).toContain('prefer smaller scopes')
  expect(killContext('tsc')).toContain('Re-run only when RAM is under the limit; prefer smaller scopes')
  expect(killNoteLive({ text: 'x', at: NOW }, NOW + 14 * 60_000)).toBe('x')
  expect(killNoteLive({ text: 'x', at: NOW }, NOW + 16 * 60_000)).toBe(null)
  expect(killNoteLive(null, NOW)).toBe(null)
})

test('near the limit the guard looks every 5 s; far from it, at the usual pace', () => {
  expect(HOT_EVERY_MS).toBe(5_000)
  expect(isHot(14 * GB, 20 * GB, true)).toBe(true)
  expect(isHot(13.9 * GB, 20 * GB, true)).toBe(false)
  expect(isHot(30 * GB, 20 * GB, true)).toBe(true)
  expect(isHot(30 * GB, 20 * GB, false)).toBe(false)
  expect(isHot(null, 20 * GB, true)).toBe(false)
  expect(isHot(30 * GB, null, true)).toBe(false)
})
