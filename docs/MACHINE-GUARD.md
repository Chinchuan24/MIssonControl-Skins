# 🛡️ Machine Guard

**Short version:** you say how much RAM Claude may use. Max agents = that RAM ÷ the RAM one agent costs. Claude is told both numbers, new agents and new heavy commands are refused over the limit, and only one heavy command runs at a time. **All your live sessions share that one budget**, and a **kill switch** stops the biggest heavy process if Claude still goes over. A running agent is never killed.

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
- **↺ Reset learned RAM per agent** (Settings, Machine Guard card) forgets the learned figure: back to 0.5 GB until it learns again.

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

In the ⚙ Settings tab, Machine Guard card:

| Setting | Options |
|---|---|
| RAM Claude may use | Auto (50%), 25%, 50%, 75%, or a typed amount in GB |
| Max agents at once | Auto (label shows the sum, e.g. "Auto · 30 (15 GB ÷ 0.5 GB)"), 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, or a typed number |
| Per-agent cost | "≈0.5 GB per agent (learned)" or "(default)", with a button to reset it to the default |
| 🔪 Kill switch | On (default) or Off. See below |
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

With more than one live session the count is for all of them and the session count is added: `🛡 RAM 9.1/20 GB · 5/16 agents · 2 sessions`.

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
| Running agents | Untouched. Never killed (the kill switch below stops a heavy *command*, not an agent) |

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
| Still held after 5 minutes | Refused: "Machine Guard: another heavy command (tsc) is running; retry when it finishes." (when the holder is another session: "...is running in \"project-name\"; retry...") |
| Claude is over its RAM limit | A new heavy command is refused with the numbers |
| Another **session** holds it | Same: this one waits, then is refused naming the other session |
| A release was lost | The lock frees itself after 15 minutes |

How the wait works: a short `sleep` process (PowerShell `Start-Sleep` on Windows) is polled every 3 s. If it cannot run, the second command is refused at once.

Limit: a command run in the background returns at once, so its lock is released at once. Only its start is serialised, not its whole run.

## One budget across all sessions

Run 2 or 3 sessions and they count as one. What is shared:

| Shared | How |
|---|---|
| Running agents | Total = this session's agents + every other live session's. A new agent is refused when the total is at the max. The reason names the sessions: "Machine Guard: 16 of 16 agents running across 2 sessions (5 here, 11 in notes) (RAM limit 20 GB, ≈1 GB per agent)..." |
| The heavy-command lock | One heavy command at a time on the whole computer, not per session |
| Claude's RAM | Already measured across every `claude` process tree (see above) |

How the sessions talk: the mod's own store (`~/.claude/plugins/store/crab-progress_inline-*.json`) is one JSON file that every session reads fresh. (Tested with two real sessions: a `set` in one is visible to the other on its next `get`, with no reload, and a hand edit of the file is seen too.) So there are no extra files or services.

- Each session writes **only its own key**, `mg.s.<sessionId>`: `{ agents, busy, heavy: { cmd, since } | null, at, name }`. Writes from different sessions never touch the same key.
- A session **reads the others** only at three moments, all while work runs: when an agent is about to start, when a heavy command is about to start (and while it waits), and on its heartbeat.
- **Heartbeat:** every ~15 s while working, the session rewrites its record (no extra process, one store write). A new agent and a new heavy hold are written at once. When the session stops working it writes once more (no agents, not busy, no hold), and on exit it deletes its key. Idle sessions write nothing.
- **Stale records are ignored:** a record older than 60 s is a session that crashed or ended. A record older than 10 minutes is deleted by whichever session reads it.
- **The heavy lock across sessions:** a session writes its hold (`heavy.since`), reads the others back, and the **oldest hold wins**; a loser withdraws its hold and waits. With another session about, the claim waits 0.3 s first so two simultaneous claims can see each other. A hold older than 15 minutes is a lost release and is broken.

Limits of this:

- A `set` rewrites the whole file, so two sessions writing in the same instant can lose one write. The loser's next heartbeat (≤ 15 s) restores it. In that window two agents can start at the same time and the total can pass the max by a few.
- A session reads the others only while it works. Its chip shows the other sessions as of its last read (≤ 15 s old).
- Sessions of **other** machines or other users are not seen (the store is a local file).

## The kill switch

The refusals above only stop *new* work. They did not stop one `tsc` that grew to 19.7 GB, because that command had already started. The kill switch does.

**When it acts.** All of these must hold:

| Condition | Value |
|---|---|
| Setting | 🔪 Kill switch is **On** (default) |
| Reading | A process read **no older than 5 s** shows Claude's combined RAM **over the limit** |
| Cooldown | At least **20 s** since it last stopped a process |
| A target | A heavy process, at least 256 MB, under a Claude process |

**Which process.** From that same read (plus a second `ps -Ao pid=,ppid=,rss=,args=` for full command lines; on Windows `Win32_Process.CommandLine`):

1. Take every process that is a descendant of a Claude Code process (`claude`, `claude.exe`). The desktop app (`Claude`) is not such a root: its own Terminal tabs run your commands, not Claude's.
2. Keep those whose command line is *heavy*, using the same classifier as the lock (`tsc`, jest, vitest, mocha, pytest, `npm test|build`, cargo, go, make, gradle, xcodebuild, docker build), also when run through `node .../tsc.js`.
3. Drop a heavy process that has another heavy process below it (the `npm test` around `jest`): only the one at the bottom is a target, never its parent.
4. Stop the **single biggest** one.

**Never stopped:**

- Anything named like `claude` / `Claude` / `Claude Helper`, or in a `.app` bundle
- The user's apps and tools (Slack, editors, Docker, databases, ssh...)
- MCP servers (any command line with `mcp` or `modelcontextprotocol`)
- Shells (`sh`, `bash`, `zsh`, `fish`, PowerShell...), including the shell that is the parent of the heavy process
- Processes **not** under a Claude Code process, including what you type in the desktop app's own Terminal tab
- Any process whose command line changed since the read (a reused pid): it is checked again right before stopping

**How it stops it.** `kill -TERM <pid>`, then `kill -KILL <pid>` if it is still alive 5 s later. On Windows, `Stop-Process -Id <pid>`, then `-Force`. One process at a time, then the 20 s cooldown, then it measures again.

**Looking more often.** Normally the process list is read every 30 s. When Claude is at 70% of the limit or more, it is read every 5 s (still only while work runs), so a runaway process is caught sooner.

**What you and Claude see.**

| Who | What |
|---|---|
| You | A toast: "🔪 Machine Guard stopped `tsc` (19.7 GB): Claude was at 24/20 GB" |
| Claude, in the stopped command's result | "Machine Guard stopped `tsc` because Claude's RAM use went over its limit. Re-run only when RAM is under the limit; prefer smaller scopes (one folder, one test file)." (added to a heavy Bash command that was running when it happened) |
| Claude, in the next prompt (for 15 min, or until a heavy command is allowed to start again) | "Machine Guard stopped `tsc` (19.7 GB) because Claude was using 24 GB, over its 20 GB RAM limit. Do not just re-run it: re-run only when RAM is under the limit, and prefer smaller scopes." |

**Limits:**

- A heavy command started **without the Bash tool** (for example inside a Workflow script, or by another program under Claude) is not held by the lock or counted in the shared budget. Only the kill switch can catch it.
- It looks only while work runs. A runaway process while Claude is idle is not seen.
- Between two reads a process can grow past the limit; at the 5 s pace that is a few seconds of growth.
- The "heavy" list is a list of names. A memory hog that is not on it (a dev server, a bundler with another name) is refused to start by nobody and stopped by nobody.
- If Claude is over its limit but nothing heavy runs under it (the RAM is agents, MCP servers or an app), nothing is stopped; only new work is refused.
- With the switch off, everything above is off and Machine Guard only refuses new work.

## Privacy

- 🔒 No network calls.
- Only runs local system commands that read memory numbers and the process list (with command lines when the kill switch looks), and `kill` / `Stop-Process` on the one process it stops.
- The shared budget uses only the mod's own local store file.
- Nothing leaves your machine.

The exact commands are listed in [PRIVACY.md](PRIVACY.md#local-commands-machine-guard-runs).

## Windows notes

| Topic | Note |
|---|---|
| PowerShell | Version 5.1 is built into Windows. Nothing to install |
| First check | Can be slow if antivirus scans PowerShell. Later checks are quicker. Each check gives up after 10 s |
| Admin rights | Not needed |
| If it fails | Shows "unknown machine" and carries on |
