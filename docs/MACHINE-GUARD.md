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

Runs on first load and at each session start.

| OS | Total RAM | Free RAM | CPU cores |
|---|---|---|---|
| macOS | `sysctl` | `vm_stat` | `sysctl` |
| Windows | PowerShell `Get-CimInstance` | PowerShell `Get-CimInstance` | PowerShell `Get-CimInstance` |
| Linux | `/proc/meminfo` | `/proc/meminfo` | `/proc/cpuinfo` |

If detection fails, it uses safe defaults and shows **"unknown machine"**. A failed check never blocks anything.

## Calibrated crew size

Default max agents at once = about **1 per 8 GB RAM**, clamped to **1 to 8**, and also capped at **cores ÷ 2**.

| RAM | Default max agents |
|---|---|
| 8 GB | 1 |
| 16 GB | 2 |
| 32 GB | 4 |
| 48 GB | 6 |
| 64 GB+ | 8 |

Few cores? The cores ÷ 2 cap can lower the number further.

## Settings

In the ⚙ Settings tab:

| Setting | Options |
|---|---|
| RAM Claude may use | Auto (50%), 25%, 50%, 75%, or a typed amount in GB |
| Max agents at once | Auto (the calibrated number), or 1 to 8 |
| Machine line (read-only) | e.g. "48 GB RAM · 12 cores · Mac" |

The panel shows live status like **"RAM 62% · 3/6 agents"**.

## What happens when it trips

While work runs, it samples RAM about every 15 s. It uses one cheap local command, and a new sample never starts before the last one finishes.

Claude's own RAM is estimated from its process tree: Claude Code plus child processes (`tsc`, test runners, shells). If that can't be read, it falls back to system-wide use.

It **refuses to start a new sub-agent** when any of these is true:

- ⛔ The max agents are already running
- ⛔ Claude is over its RAM limit
- ⛔ Free system RAM is under ~10%

| Who | What they see |
|---|---|
| Claude | A refusal reason: wait, or ask the user to raise the limit |
| You | One toast when the guard first trips. It warns again only after RAM recovers and then trips again |
| Running agents | Untouched. Never killed |

### The rule Claude gets

Every prompt carries a short rule:

- Run heavy commands (test suites, type checks, builds) **one at a time**, never in parallel across agents.

When RAM is tight, a stronger rule is added:

- Start **no new agents** and **no heavy commands** until RAM frees up.

## Privacy

- 🔒 No network calls.
- Only runs local system commands that read memory numbers and the process list.
- Nothing leaves your machine.

Note for maintainers: [PRIVACY.md](PRIVACY.md) should list these local commands (`sysctl`, `vm_stat`, `ps`, PowerShell `Get-CimInstance`, `/proc/meminfo`) in its "What it reads on your machine" table. It does not yet.

## Windows notes

| Topic | Note |
|---|---|
| PowerShell | Version 5.1 is built into Windows. Nothing to install |
| First check | Can be slow if antivirus scans PowerShell. Later checks are quicker |
| Admin rights | Not needed |
| If it fails | Shows "unknown machine" and carries on |
