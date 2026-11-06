import { expect, test } from 'claude-code/testing'

import { machineCmd, parseMachine, parseProcs, procsCmd } from './probewin'

// Machine Guard, Windows probe: the two PowerShell commands and the parsers for what they print.
// Fixtures are hand-made copies of real PowerShell 5.1 output, with \r\n line endings.

const GB = 1024 * 1024 * 1024

const BOX16 = 'os=windows\r\ntotalKb=16655360\r\nfreeKb=6291456\r\ncores=8\r\n'
const BOX64 = 'os=windows\r\ntotalKb=67108864\r\nfreeKb=40265318\r\ncores=24\r\n'

const PROCS =
  '0\t0\t8192\tSystem Idle Process\r\n' +
  '4\t0\t139264\tSystem\r\n' +
  '1204\t4\t52428800\tclaude.exe\r\n' +
  '3320\t1204\t104857600\tnode.exe\r\n' +
  '5512\t1204\t73400320\tMicrosoft Edge WebView2.exe\r\n' +
  '6000\t5512\t2147483648\tGoogle Chrome Helper (Renderer).exe\r\n'

test('probewin: both commands run powershell.exe with the safe flags and one script argument', () => {
  for (const c of [machineCmd, procsCmd]) {
    expect(c.cmd).toBe('powershell.exe')
    expect(c.args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command'])
    expect(c.args.length).toBe(4)
    const script = c.args[3] ?? ''
    expect(script.includes('"')).toBe(false)
    expect(script.includes('`')).toBe(false)
    expect(script.toLowerCase().includes('wmic')).toBe(false)
  }
})

test('probewin: the scripts ask CIM for the right classes', () => {
  const machine = machineCmd.args[3] ?? ''
  const procs = procsCmd.args[3] ?? ''
  expect(machine.includes('Get-CimInstance Win32_OperatingSystem')).toBe(true)
  expect(machine.includes('TotalVisibleMemorySize')).toBe(true)
  expect(machine.includes('FreePhysicalMemory')).toBe(true)
  expect(machine.includes('ProcessorCount')).toBe(true)
  expect(procs.includes('Get-CimInstance Win32_Process')).toBe(true)
  for (const f of ['ProcessId', 'ParentProcessId', 'WorkingSetSize', 'Name']) {
    expect(procs.includes(f)).toBe(true)
  }
})

test('probewin: a 16 GB machine reads as bytes, with its free RAM and cores', () => {
  const m = parseMachine(BOX16)
  expect(m.os).toBe('windows')
  expect(m.totalBytes).toBe(16655360 * 1024)
  expect(m.freeBytes).toBe(6 * GB)
  expect(m.cores).toBe(8)
})

test('probewin: a 64 GB machine reads as bytes', () => {
  const m = parseMachine(BOX64)
  expect(m.os).toBe('windows')
  expect(m.totalBytes).toBe(64 * GB)
  expect(m.freeBytes).toBe(40265318 * 1024)
  expect(m.cores).toBe(24)
})

test('probewin: machine output survives a BOM, bare \\n, stray spaces and blank lines', () => {
  const m = parseMachine('﻿\n os=windows \n\n totalKb = 8388608 \nfreeKb=1048576\n\ncores=4')
  expect(m).toEqual({ os: 'windows', totalBytes: 8 * GB, freeBytes: 1 * GB, cores: 4 })
})

test('probewin: machine fields it cannot read are null, the rest still count', () => {
  const m = parseMachine('os=windows\r\ntotalKb=\r\nfreeKb=abc\r\ncores=12\r\n')
  expect(m).toEqual({ os: 'windows', totalBytes: null, freeBytes: null, cores: 12 })
  expect(parseMachine('totalKb=0\r\ncores=0\r\n')).toEqual({ os: 'unknown', totalBytes: null, freeBytes: null, cores: null })
})

test('probewin: machine error text, empty and garbage give all nulls and never throw', () => {
  const blank = { os: 'unknown', totalBytes: null, freeBytes: null, cores: null }
  const err =
    "Get-CimInstance : Access denied \r\nAt line:1 char:4\r\n+ CategoryInfo : PermissionDenied: (:) [Get-CimInstance]\r\n"
  expect(parseMachine(err)).toEqual(blank)
  expect(parseMachine('')).toEqual(blank)
  expect(parseMachine('\r\n\r\n')).toEqual(blank)
  expect(parseMachine('\u0000\u0001 ====\t= \n=5\nfoo=bar')).toEqual(blank)
  expect(parseMachine(undefined as unknown as string)).toEqual(blank)
  expect(parseMachine(null as unknown as string)).toEqual(blank)
})

test('probewin: error text next to good lines does not break them', () => {
  const m = parseMachine('WARNING: something odd\r\nos=windows\r\ntotalKb=16655360\r\nfreeKb=\r\ncores=8\r\n')
  expect(m.totalBytes).toBe(16655360 * 1024)
  expect(m.freeBytes).toBeNull()
  expect(m.cores).toBe(8)
})

test('probewin: huge numbers stay exact numbers', () => {
  const m = parseMachine('os=windows\r\ntotalKb=4194304000\r\nfreeKb=1\r\ncores=256\r\n')
  expect(m.totalBytes).toBe(4194304000 * 1024)
  expect(Number.isSafeInteger(m.totalBytes as number)).toBe(true)
})

test('probewin: the process list reads pid, parent, bytes and names with spaces', () => {
  const rows = parseProcs(PROCS)
  expect(rows.length).toBe(6)
  expect(rows[0]).toEqual({ pid: 0, ppid: 0, rssBytes: 8192, name: 'System Idle Process' })
  expect(rows[2]).toEqual({ pid: 1204, ppid: 4, rssBytes: 52428800, name: 'claude.exe' })
  expect(rows[4]?.name).toBe('Microsoft Edge WebView2.exe')
  expect(rows[5]).toEqual({ pid: 6000, ppid: 5512, rssBytes: 2 * GB, name: 'Google Chrome Helper (Renderer).exe' })
})

test('probewin: a blank memory column is 0, not a dropped row', () => {
  const rows = parseProcs('4\t0\t\tSystem\r\n')
  expect(rows).toEqual([{ pid: 4, ppid: 0, rssBytes: 0, name: 'System' }])
})

test('probewin: processes tolerate a BOM, bare \\n and a missing final newline', () => {
  const rows = parseProcs('﻿10\t1\t2048\ta.exe\n11\t10\t4096\tb c.exe')
  expect(rows).toEqual([
    { pid: 10, ppid: 1, rssBytes: 2048, name: 'a.exe' },
    { pid: 11, ppid: 10, rssBytes: 4096, name: 'b c.exe' },
  ])
})

test('probewin: processes skip error text, headers and partial lines but keep good rows', () => {
  const out =
    'Get-CimInstance : Access denied\r\n' +
    'ProcessId\tParentProcessId\tWorkingSetSize\tName\r\n' +
    '100\t4\t1000\tgood.exe\r\n' +
    '200\t4\t\r\n' +
    '300\r\n' +
    'x\ty\tz\tbad.exe\r\n' +
    '400\t100\t3000\tlast.exe\r\n'
  expect(parseProcs(out).map((r) => r.pid)).toEqual([100, 400])
})

test('probewin: processes give [] for empty, error-only and garbage input and never throw', () => {
  expect(parseProcs('')).toEqual([])
  expect(parseProcs('\r\n\r\n')).toEqual([])
  expect(parseProcs('powershell.exe : The term is not recognized\r\n')).toEqual([])
  expect(parseProcs('\u0000\u0001\t\t\t')).toEqual([])
  expect(parseProcs(undefined as unknown as string)).toEqual([])
  expect(parseProcs(null as unknown as string)).toEqual([])
})
