# 🛡️ Machine Guard

**Short version:** you say how much RAM Claude may use. Max agents = that RAM ÷ the RAM one agent costs. Claude is told both numbers, new agents and new heavy commands are refused over the limit, and only one heavy command runs at a time. A running agent is never killed.

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
- Under a % limit (or Auto), max agents = **4**.
- A typed GB limit still works, so max agents follows it.
- Nothing is ever refused for RAM.

RAM refusals need total RAM, free RAM and cores all read. If any is missing, only the agent cap applies.

Until this session's check is in, last session's machine sets the agent cap (no RAM refusals yet).

## Max agents: from the RAM limit alone

**Max agents = floor(RAM limit ÷ RAM per agent)**, at least 1, at most 200 (a sanity ceiling). Nothing else counts: not what is in use right now, not the CPU cores.

The RAM limit is what Settings says: Auto (50% of total), 25%, 50%, 75%, or a typed amount in GB.

RAM per agent starts at **0.5 GB** and is learned on your machine:

- With 0 agents running, the guard keeps Claude's process-tree size as a baseline.
- With N agents running, one sample = (Claude's tree - baseline) ÷ N.
- Samples are smoothed (EMA, weight 0.2), kept between 0.2 and 4 GB, and saved, so the figure carries across sessions.
- Ignored: failed process reads, reads while a heavy command ran, and the subtrees of `tsc` / test runners themselves.

At 0.5 GB per agent:

| RAM limit | Max agents |
|---|---|
| 4 GB | 8 |
| 8 GB | 16 |
| 15 GB | 30 |
| 24 GB (48 GB Mac, Auto) | 48 |
| 32 GB | 64 |
| 100 GB+ | 200 |

Unknown machine with a % limit: **4**. A typed GB limit works anywhere.

## Settings

In the ⚙ Settings tab:

| Setting | Options |
|---|---|
| RAM Claude may use | Auto (50%), 25%, 50%, 75%, or a typed amount in GB |
| Max agents at once | Auto (label shows the sum, e.g. "Auto · 30 (15 GB ÷ 0.5 GB)"), 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, or a typed number |
| Per-agent cost (read-only) | "≈0.5 GB per agent (learned)" or "(default)" |
| Machine line (read-only) | e.g. "48 GB RAM · 12 cores · Mac" |

Typed GB:

- Rounded to 0.1 GB. More than the machine has = the whole machine.
- `0`, blank or not a number: refused with a toast. The setting stays as it was.
- A typed max-agents number joins the list, so the Pick always shows it.
- Changing either setting shows a toast like "RAM limit 15 GB → up to 30 agents at once".

Where you see it:

| Place | While working | Idle |
|---|---|---|
| Desktop pane | 🛡 RAM 9.1/15 GB · 3/30 agents | 🛡 15 GB limit · up to 30 agents |
| Terminal band | RAM 9.1/15 GB · 3/30 agents | (hidden) |

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
| Claude | The refusal reason, e.g. "Machine Guard: 30 of 30 agents running (RAM limit 15 GB, ≈0.5 GB per agent). Wait for one to finish, or raise the limit in Settings." |
| You | One toast per kind (agents, RAM limit, free RAM) when it first trips. It warns again only after that kind recovers and then trips again |
| Running agents | Untouched. Never killed |

### The rule Claude gets

Every prompt carries a short rule that states the numbers, e.g. "Machine Guard: Claude may use 15 GB of RAM → at most 30 agents at once (≈0.5 GB each). Run heavy commands (test suites, type checks, builds) one at a time; the guard makes a second one wait." When RAM is tight, a stronger line is added: start no new agents and no heavy commands.

Before it refuses anything for RAM, the guard takes a fresh process read if the last one is older than 5 s, so a process that already ended cannot keep blocking.

## The heavy-command lock

Only **one** heavy Bash command runs at a time, across the main loop and every sub-agent. This is what stops 39 parallel `tsc` and test runs.

Heavy means: `tsc` (also via `npx` / `bunx`), `plugin test`, jest, vitest, mocha, pytest, `npm|pnpm|yarn|bun (run) test|build`, `cargo build|test`, `go build|test`, make, gradle, xcodebuild, `docker build`. Anything else is never blocked.

| Situation | What happens |
|---|---|
| Nobody holds the lock | The command runs and holds it until it ends (also on error or deny) |
| Another heavy command runs | The second one **waits** (up to 5 minutes), then runs |
| Still held after 5 minutes | Refused: "Machine Guard: another heavy command (tsc) is running; retry when it finishes." |
| Claude is over its RAM limit | A new heavy command is refused with the numbers |
| A release was lost | The lock frees itself after 15 minutes |

How the wait works: a short `sleep` process (PowerShell `Start-Sleep` on Windows) is polled every 3 s. If it cannot run, the second command is refused at once.

Limit: a command run in the background returns at once, so its lock is released at once. Only its start is serialised, not its whole run.

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
