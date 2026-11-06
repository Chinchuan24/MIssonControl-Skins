// Machine Guard, Windows probe. Pure TypeScript: no engine calls, no imports beyond types.
// The scripts below are passed to powershell.exe as ONE argument (args array, no cmd.exe).
// They contain no double quotes and no backticks, so any command-line quoting stays trivial.

export type ProbeCmd = { cmd: string; args: string[] }
export type MachineInfo = {
  os: 'mac' | 'windows' | 'linux' | 'unknown'
  totalBytes: number | null
  freeBytes: number | null
  cores: number | null
}
export type ProcRow = { pid: number; ppid: number; rssBytes: number; name: string }
/** One process with its whole command line, for the kill switch. */
export type ProcArgsRow = { pid: number; ppid: number; rssBytes: number; args: string }

const PS_FLAGS = ['-NoProfile', '-NonInteractive', '-Command']

// Prints four labelled lines: os=windows, totalKb=..., freeKb=..., cores=...
// TotalVisibleMemorySize and FreePhysicalMemory are in KB. ProcessorCount is logical cores.
const MACHINE_SCRIPT =
  "$ErrorActionPreference='SilentlyContinue';" +
  '$o=Get-CimInstance Win32_OperatingSystem;' +
  "'os=windows';" +
  "'totalKb='+$o.TotalVisibleMemorySize;" +
  "'freeKb='+$o.FreePhysicalMemory;" +
  "'cores='+[Environment]::ProcessorCount"

// One line per process: pid TAB ppid TAB workingSetBytes TAB name
const PROCS_SCRIPT =
  "$ErrorActionPreference='SilentlyContinue';" +
  'Get-CimInstance Win32_Process | ForEach-Object {' +
  '($_.ProcessId,$_.ParentProcessId,$_.WorkingSetSize,$_.Name) -join [char]9' +
  '}'

export const machineCmd: ProbeCmd = { cmd: 'powershell.exe', args: [...PS_FLAGS, MACHINE_SCRIPT] }
export const procsCmd: ProbeCmd = { cmd: 'powershell.exe', args: [...PS_FLAGS, PROCS_SCRIPT] }

function lines(out: unknown): string[] {
  if (typeof out !== 'string') return []
  return out.replace(/^﻿/, '').split(/\r\n|\n|\r/)
}

function whole(s: string | undefined): number | null {
  if (s === undefined || !/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseMachine(out: string): MachineInfo {
  const info: MachineInfo = { os: 'unknown', totalBytes: null, freeBytes: null, cores: null }
  try {
    for (const raw of lines(out)) {
      const m = /^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$/.exec(raw)
      if (!m) continue
      const key = (m[1] ?? '').toLowerCase()
      const val = m[2] ?? ''
      if (key === 'os') {
        if (val.toLowerCase() === 'windows') info.os = 'windows'
      } else if (key === 'totalkb') {
        const n = whole(val)
        if (n !== null && n > 0) info.totalBytes = n * 1024
      } else if (key === 'freekb') {
        const n = whole(val)
        if (n !== null) info.freeBytes = n * 1024
      } else if (key === 'cores') {
        const n = whole(val)
        if (n !== null && n > 0) info.cores = n
      }
    }
  } catch {
    // never throws
  }
  return info
}

export function parseProcs(out: string): ProcRow[] {
  const rows: ProcRow[] = []
  try {
    for (const raw of lines(out)) {
      const [pidRaw = '', ppidRaw = '', rssRaw = '', ...rest] = raw.split('\t')
      if (rest.length < 1) continue
      const pid = whole(pidRaw.trim())
      const ppid = whole(ppidRaw.trim())
      if (pid === null || ppid === null) continue
      const name = rest.join('\t').trim()
      if (!name) continue
      // WorkingSetSize is empty for System Idle Process and a few protected ones.
      const rss = whole(rssRaw.trim()) ?? 0
      rows.push({ pid, ppid, rssBytes: rss, name })
    }
  } catch {
    return []
  }
  return rows
}

// The kill switch's second look: pid TAB ppid TAB workingSetBytes TAB commandLine. Read only
// when Claude is over its RAM limit. CommandLine is empty for protected processes (they are skipped).
const PROCS_ARGS_SCRIPT =
  "$ErrorActionPreference='SilentlyContinue';" +
  'Get-CimInstance Win32_Process | ForEach-Object {' +
  '($_.ProcessId,$_.ParentProcessId,$_.WorkingSetSize,$_.CommandLine) -join [char]9' +
  '}'
export const procsArgsCmd: ProbeCmd = { cmd: 'powershell.exe', args: [...PS_FLAGS, PROCS_ARGS_SCRIPT] }

export function parseProcsArgs(out: string): ProcArgsRow[] {
  const rows: ProcArgsRow[] = []
  try {
    for (const raw of lines(out)) {
      const [pidRaw = '', ppidRaw = '', rssRaw = '', ...rest] = raw.split('\t')
      if (rest.length < 1) continue
      const pid = whole(pidRaw.trim())
      const ppid = whole(ppidRaw.trim())
      if (pid === null || ppid === null) continue
      const args = rest.join('\t').trim()
      if (!args) continue
      rows.push({ pid, ppid, rssBytes: whole(rssRaw.trim()) ?? 0, args })
    }
  } catch {
    return []
  }
  return rows
}

// Stopping one process by pid: its command line now (to check it is still the one chosen),
// a polite stop, then a forced one. A pid that is not a whole number above 4 (0 and 4 are
// System) gives a command that does nothing.
const NOTHING: ProbeCmd = { cmd: 'powershell.exe', args: [...PS_FLAGS, '$null'] }
const okPid = (pid: number): boolean => Number.isInteger(pid) && pid > 4
const ps = (pid: number, script: string): ProbeCmd => (okPid(pid) ? { cmd: 'powershell.exe', args: [...PS_FLAGS, script] } : NOTHING)
export const argsOfCmd = (pid: number): ProbeCmd => ps(pid, `$ErrorActionPreference='SilentlyContinue';(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`)
export const termCmd = (pid: number): ProbeCmd => ps(pid, `Stop-Process -Id ${pid}`)
export const forceCmd = (pid: number): ProbeCmd => ps(pid, `Stop-Process -Id ${pid} -Force`)
