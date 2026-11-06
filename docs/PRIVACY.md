# Privacy: what Mission Control sends, and where

**Short version:** the mod opens no network connections of its own. Everything it shows is worked out on your machine. The few features that ask a model something go through Claude Code's own connection, and each one is off until you use it.

Checked on 6 Nov 2026 against every source file in `hooks/` and `scripts/`. Re-check any time with:

```bash
scripts/check-privacy.sh
```

## No network code

The mod contains no `fetch`, no HTTP or socket module, and runs no `curl`, `wget` or similar. `scripts/check-privacy.sh` fails if any of these show up.

The one web address in the code is the skin schema's `$schema` label, written into skin files you create. The mod never downloads it.

## What it reads on your machine

| What | Why |
|---|---|
| Claude Code's transcripts in `~/.claude/projects` | The spend card's history (Today, a week, a month, custom dates) |
| Its own store (Claude Code's plugin storage) | Settings, today's totals, the spend ledger |
| Your macOS language (`defaults read -g AppleLanguages`) | Which language the panel speaks |
| The current git branch (`git rev-parse`) | The label on the PR cost badge |

## Local commands Machine Guard runs

[Machine Guard](MACHINE-GUARD.md) runs a few system commands on your machine: once at session start, then only while Claude works. Their output stays in the mod: nothing leaves the machine.

| Command | What it reads or does |
|---|---|
| `sysctl -n hw.memsize`, `sysctl -n hw.ncpu` (Mac) | Total RAM and the number of cores |
| `vm_stat` (Mac) | Free RAM (free, inactive and speculative pages) |
| `/proc/meminfo` and `nproc` (Linux) | Total and available RAM, the number of cores |
| `ps -Ao pid=,ppid=,rss=,comm=` (Mac, Linux) | The process list: ids, parents, memory and names, to add up Claude's own RAM |
| `ps -Ao pid=,ppid=,rss=,args=` (Mac, Linux) | The same list with command lines. Only when Claude is over its RAM limit and the kill switch is on |
| `ps -p <pid> -o args=` (Mac, Linux) | One process's command line, checked again just before it is stopped |
| `kill -TERM <pid>`, then `kill -KILL <pid>` (Mac, Linux) | Stops the one heavy command (a type check, test run or build) the kill switch picked |
| PowerShell `Get-CimInstance Win32_OperatingSystem` (Windows) | Total and free RAM |
| PowerShell `Get-CimInstance Win32_Process` (Windows) | The process list, and its command lines when the kill switch looks |
| PowerShell `Stop-Process -Id <pid>`, then `-Force` (Windows) | Stops the one heavy command the kill switch picked |
| `sleep` / PowerShell `Start-Sleep` | Waits a few seconds while a second heavy command queues |

Sessions share one budget through the mod's own store file (keys `mg.s.<session id>`), not through any service.

## What it writes on your machine

| What | When |
|---|---|
| A CSV in Downloads | Only when you export spend |
| A skin file | Only when you run `/skin new` |
| A key in the macOS Keychain | Only when you paste an API key in the Billing box. See [SECURITY-billing.md](SECURITY-billing.md) |

## Features that use a model (all opt-in)

These go through Claude Code's own model connection, the same one your chat uses, and count toward your plan or API spend.

| Feature | What is sent | Default |
|---|---|---|
| Keep-Warm | A tiny side request over your current conversation, to refresh the prompt cache | Off (`/tokens warm on`) |
| `/skin new <idea>` | Your idea and the skin schema, to Haiku | Only when you run it |
| Stuck-agent **Nudge** | A short "are you still working?" message to that agent | Only when you click it |
| Stuck-agent **Retry on Haiku** | Starts the agent's task again on Haiku | Only when you click it |

## Other things that leave the panel

- **Notifications and spoken status** use your Mac's own notification and speech features through Claude Code.
- **Copy receipt** and **`/tokens pr`** put text on your clipboard. Nothing is posted anywhere.
- **The API key helper** (`scripts/anthropic-key-helper.sh`) reads the key from the Keychain and prints it for Claude Code. It makes no network call itself.
