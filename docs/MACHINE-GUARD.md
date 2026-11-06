# 🛡️ Machine Guard

**Short version:** Mission Control checks your computer, picks a safe number of agents, and refuses to start new ones when RAM gets tight. It never kills a running agent.

## Why it exists

A real incident:

| What happened | Number |
|---|---|
| Agents running in parallel | 8 |
| Processes (each ran tests + type check) | ~39 |
| Biggest single type check | 5.6 GB |
| Load average | 101 |

Result: Claude Code dropped the mod. Machine Guard stops this from happening again.

## What it detects

Runs once at each session start, then only while work runs.

| OS | Total RAM | Free RAM | CPU cores | Process list |
|---|---|---|---|---|
| macOS | `sysctl hw.memsize` | `vm_stat` (free + inactive + speculative pages) | `sysctl hw.ncpu` | `ps` |
| Windows | `Get-CimInstance Win32_OperatingSystem` | same (`FreePhysicalMemory`) | `[Environment]::ProcessorCount` | `Get-CimInstance Win32_Process` |
| Linux | `/proc/meminfo` (`MemTotal`) | `/proc/meminfo` (`MemAvailable`) | `nproc` | `ps` |

If detection fails:

- It shows **"unknown machine"**.
- Max agents = **4**.
- Nothing is ever refused for RAM.

RAM refusals need total RAM, free RAM and cores all read. If any is missing, only the agent cap applies.

Until this session's check is in, last session's machine sets the agent cap (no RAM refusals yet).

## Calibrated crew size

Default max agents at once = about **1 per 8 GB RAM**, clamped to **1 to 8**, and also capped at **cores ÷ 2**.

| RAM | Default max agents |
|---|---|
| 8 GB | 1 |
| 16 GB | 2 |
| 32 GB | 4 |
| 48 GB | 6 |
| 64 GB+ | 8 |
| Unknown | 4 |

Few cores? The cores ÷ 2 cap can lower the number further (64 GB needs 16+ cores for 8).

## Settings

In the ⚙ Settings tab:

| Setting | Options |
|---|---|
| RAM Claude may use | Auto (50%), 25%, 50%, 75%, or a typed amount in GB |
| Max agents at once | Auto (the calibrated number), or 1 to 8 |
| Machine line (read-only) | e.g. "48 GB RAM · 12 cores · Mac" |

Typed GB:

- Rounded to 0.1 GB. More than the machine has = the whole machine.
- `0`, blank or not a number: refused with a toast. The setting stays as it was.

Where you see it:

| Place | While working | Idle |
|---|---|---|
| Desktop pane | 🛡 RAM 62% · 3/6 agents | 🛡 48 GB Mac · up to 6 agents |
| Terminal band | RAM 62% · 3/6 agents | (hidden) |

The line turns red when RAM is tight.

## What happens when it trips

Checks run **only while work runs**. Nothing is sampled while idle (except the one check at session start).

| Check | How often | Timeout |
|---|---|---|
| Free RAM | every 15 s (also when an agent starts, if 15 s passed) | 10 s |
| Process list (Claude's RAM) | every 30 s, **45 s on Windows** | 10 s |

A new check never starts before the last one finishes.

### Claude's RAM

It adds up **every process named `claude`** (`claude.exe` on Windows) and all its child processes (`tsc`, test runners, shells).

⚠️ That means **all Claude on this computer counts**:

- other Claude Code sessions
- the Claude desktop app and its helper processes

No `claude` process found? It compares **system-wide used RAM** to the limit instead. A process list that fails or times out keeps the last number.

### When it refuses

It **refuses to start a new sub-agent** when any of these is true:

- ⛔ The max agents are already running
- ⛔ Claude is over its RAM limit
- ⛔ Free system RAM is under **10%** (**5% on Windows**, which reads free RAM low)

What counts as running:

- ✅ Agents that are running, about to start, or waiting on their own background work
- ✅ Workflow-tool agents (they are also refused at the cap)
- ✅ Several agents started at once: each one sees the others
- ❌ Finished agents, and teammates idle between turns
- ❌ A resumed agent (woken by a message) is not new, so it is never refused

| Who | What they see |
|---|---|
| Claude | The refusal reason, e.g. "Machine Guard: 6 of 6 agents running on this 48 GB Mac. Wait for one to finish, or raise the limit in Settings." |
| You | One toast per kind (agents, RAM limit, free RAM) when it first trips. It warns again only after that kind recovers and then trips again |
| Running agents | Untouched. Never killed |

### The rule Claude gets

Every prompt carries a short rule:

- Run heavy commands (test suites, type checks, builds) **one at a time**, never in parallel across agents.
- Run at most **N** sub-agents at once (N = the max agents in force).

When RAM is tight, a stronger rule is added:

- Start **no new agents** and **no heavy commands** until RAM frees up.

## Privacy

- 🔒 No network calls.
- Only runs local system commands that read memory numbers and the process list.
- Nothing leaves your machine.

Note for maintainers: [PRIVACY.md](PRIVACY.md) should list these local commands (`sysctl`, `vm_stat`, PowerShell `Get-CimInstance`, `/proc/meminfo`, and the process list) in its "What it reads on your machine" table. It does not yet.

## Windows notes

| Topic | Note |
|---|---|
| PowerShell | Version 5.1 is built into Windows. Nothing to install |
| First check | Can be slow if antivirus scans PowerShell. Later checks are quicker. Each check gives up after 10 s |
| Admin rights | Not needed |
| If it fails | Shows "unknown machine" and carries on |
