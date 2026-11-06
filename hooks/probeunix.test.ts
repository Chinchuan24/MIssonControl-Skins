import { expect, test } from 'claude-code/testing'

import { machineCmd, parseMachine, parseProcs, procsCmd } from './probeunix'

// Machine Guard unix probe: the two commands and their parsers, on real macOS output
// (captured on a 48 GB, 14-core Mac), a hand-written Linux fixture, and garbage.

const MAC_OUT = `os=mac
total=51539607552
cores=14
free=32821018624
`

const LINUX_OUT = `os=linux
total=16314916864
free=9876543210
cores=8
`

const MAC_PS = `    1     0  22544 /sbin/launchd
   94     1  31488 /usr/libexec/logd
  273     1   4608 Core Audio Driver (MSTeamsAudioDevice.driver)
  292     1    512 Core Audio Driver (ParrotAudioPlugin.driver)
 5001    94 1048576 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
`

const LINUX_PS = `    1     0 11520 systemd
  812     1 204800 node
  900   812   2048 sh
`

test('machineCmd is one sh -c that branches on uname', () => {
  expect(machineCmd.cmd).toBe('sh')
  expect(machineCmd.args[0]).toBe('-c')
  expect(machineCmd.args).toHaveLength(2)
  const script = machineCmd.args[1]
  for (const word of ['uname', 'hw.memsize', 'hw.ncpu', 'vm_stat', '/proc/meminfo', 'nproc']) {
    expect(script).toContain(word)
  }
})

test('procsCmd lists pid, ppid, rss and name', () => {
  expect(procsCmd.cmd).toBe('ps')
  expect(procsCmd.args).toEqual(['-Ao', 'pid=,ppid=,rss=,comm='])
})

test('parseMachine reads real Mac output', () => {
  expect(parseMachine(MAC_OUT)).toEqual({
    os: 'mac',
    totalBytes: 51539607552,
    freeBytes: 32821018624,
    cores: 14,
  })
})

test('parseMachine reads Linux output', () => {
  expect(parseMachine(LINUX_OUT)).toEqual({
    os: 'linux',
    totalBytes: 16314916864,
    freeBytes: 9876543210,
    cores: 8,
  })
})

test('parseMachine tolerates CRLF, spaces and unknown lines', () => {
  const out = 'noise\r\nos=linux\r\ntotal= 2048 \r\nwhat=ever\r\ncores=4\r\n'
  expect(parseMachine(out)).toEqual({ os: 'linux', totalBytes: 2048, freeBytes: null, cores: 4 })
})

test('parseMachine gives nulls for blank, garbage and partial output', () => {
  const blank = { os: 'unknown', totalBytes: null, freeBytes: null, cores: null }
  expect(parseMachine('')).toEqual(blank)
  expect(parseMachine('\n\n')).toEqual(blank)
  expect(parseMachine('sh: sysctl: command not found')).toEqual(blank)
  expect(parseMachine('os=beos\ntotal=abc\nfree=-5\ncores=0')).toEqual(blank)
  expect(parseMachine('os=mac\ntotal=\nfree=1e9')).toEqual({ ...blank, os: 'mac' })
  expect(parseMachine('os=mac\ncores=14')).toEqual({ ...blank, os: 'mac', cores: 14 })
})

test('parseMachine never throws on odd input', () => {
  expect(() => parseMachine(undefined as unknown as string)).not.toThrow()
  expect(() => parseMachine(null as unknown as string)).not.toThrow()
  expect(parseMachine(undefined as unknown as string).os).toBe('unknown')
})

test('parseProcs converts KB to bytes and keeps names with spaces', () => {
  const rows = parseProcs(MAC_PS)
  expect(rows).toHaveLength(5)
  expect(rows[0]).toEqual({ pid: 1, ppid: 0, rssBytes: 22544 * 1024, name: '/sbin/launchd' })
  expect(rows[2].name).toBe('Core Audio Driver (MSTeamsAudioDevice.driver)')
  expect(rows[4]).toEqual({
    pid: 5001,
    ppid: 94,
    rssBytes: 1048576 * 1024,
    name: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  })
})

test('parseProcs reads Linux output', () => {
  expect(parseProcs(LINUX_PS).map((r) => [r.pid, r.ppid, r.rssBytes, r.name])).toEqual([
    [1, 0, 11520 * 1024, 'systemd'],
    [812, 1, 204800 * 1024, 'node'],
    [900, 812, 2048 * 1024, 'sh'],
  ])
})

test('parseProcs skips partial and garbage lines and survives blanks', () => {
  expect(parseProcs('')).toEqual([])
  expect(parseProcs('\n  \n')).toEqual([])
  expect(parseProcs('PID PPID RSS COMM\nnot a process line\n12 3\n12 3 400\n')).toEqual([])
  const rows = parseProcs('garbage\r\n  7  1  100 bash\r\n42 x 5 nope\r\n')
  expect(rows).toEqual([{ pid: 7, ppid: 1, rssBytes: 102400, name: 'bash' }])
  expect(() => parseProcs(undefined as unknown as string)).not.toThrow()
  expect(parseProcs(undefined as unknown as string)).toEqual([])
})
