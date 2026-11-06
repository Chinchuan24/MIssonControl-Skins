// Machine Guard probe for macOS and Linux: one cheap shell command for RAM and cores, one
// for the process table, and tolerant parsers for both. Pure TypeScript, no engine calls.

export type ProbeCmd = { cmd: string; args: string[] }
export type MachineInfo = {
  os: 'mac' | 'windows' | 'linux' | 'unknown'
  totalBytes: number | null
  freeBytes: number | null
  cores: number | null
}
export type ProcRow = { pid: number; ppid: number; rssBytes: number; name: string }

// Prints labelled lines: os=, total=, free=, cores= (bytes for total and free).
// Mac: hw.memsize and hw.ncpu from sysctl; free = (free + inactive + speculative) pages
// times the page size from the vm_stat header. Linux: /proc/meminfo (kB) and nproc.
const MACHINE_SCRIPT = [
  'case "$(uname -s)" in',
  'Darwin) echo os=mac;',
  'echo total=$(sysctl -n hw.memsize);',
  'echo cores=$(sysctl -n hw.ncpu);',
  `vm_stat | awk '/page size of/{for(i=1;i<=NF;i++)if($i=="of")p=$(i+1)} /^Pages free/{f=$3} /^Pages inactive/{n=$3} /^Pages speculative/{s=$3} END{if(p>0)printf "free=%.0f\\n",(f+n+s)*p}';;`,
  'Linux) echo os=linux;',
  `awk '/^MemTotal:/{printf "total=%.0f\\n",$2*1024} /^MemAvailable:/{printf "free=%.0f\\n",$2*1024}' /proc/meminfo;`,
  'echo cores=$(nproc);;',
  '*) echo os=unknown;;',
  'esac',
].join(' ')

export const machineCmd: ProbeCmd = { cmd: 'sh', args: ['-c', MACHINE_SCRIPT] }

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*$/.exec(raw)
  if (!m) return null
  const n = Math.floor(Number(m[1]))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function parseMachine(out: string): MachineInfo {
  const info: MachineInfo = { os: 'unknown', totalBytes: null, freeBytes: null, cores: null }
  try {
    for (const line of String(out ?? '').split(/\r?\n/)) {
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim().toLowerCase()
      const val = line.slice(eq + 1)
      if (key === 'os') {
        const v = val.trim().toLowerCase()
        if (v === 'mac' || v === 'linux' || v === 'windows') info.os = v
      } else if (key === 'total') info.totalBytes = num(val)
      else if (key === 'free') info.freeBytes = num(val)
      else if (key === 'cores') {
        const c = num(val)
        info.cores = c !== null && c > 0 ? c : null
      }
    }
  } catch {
    // never throws
  }
  return info
}

// RSS is in KB on both macOS and Linux. comm= comes last so a name with spaces survives.
export const procsCmd: ProbeCmd = { cmd: 'ps', args: ['-Ao', 'pid=,ppid=,rss=,comm='] }

export function parseProcs(out: string): ProcRow[] {
  const rows: ProcRow[] = []
  try {
    for (const line of String(out ?? '').split(/\r?\n/)) {
      const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S.*?)\s*$/.exec(line)
      const name = m?.[4]
      if (!m || !name) continue
      rows.push({ pid: Number(m[1]), ppid: Number(m[2]), rssBytes: Number(m[3]) * 1024, name })
    }
  } catch {
    return []
  }
  return rows
}
