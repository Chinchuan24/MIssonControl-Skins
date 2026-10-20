# Mission Control Skins

A mod for [Claude Code](https://claude.com/claude-code) (desktop app and CLI) that turns Claude's work into a live **Mission Control**: a HUD band above the prompt, a dashboard pane, and swappable themed **skins** with pixel-art crews.

> **Unofficial, non-commercial fan project.** Not affiliated with, endorsed by or sponsored by CD PROJEKT S.A., CD PROJEKT RED, Studio Trigger or Netflix. Cyberpunk 2077, Cyberpunk: Edgerunners and all related names, characters and terms belong to their respective owners and are used as fan homage only. The MIT license covers this project's code, not those properties. Removal requests: open an issue.

---

## What is Mission Control?

Claude works in steps, calls tools and spins up sub-agents. Mission Control shows all of it at a glance: who is working, on what, how far along, and what it costs.

![Mission Control](docs/mission-control.png)

### What it has

**The HUD band** (above the prompt, always on)
- The boss (the manager), the task, what it's doing right now, and a progress gauge
- Context, 5-hour limit and burn-rate readouts
- **Crew**: every sub-agent at work, plus a count per role
- **Steps**: the plan as pips, with the current step named
- **Tokens**: the Token Manager's top tip and today's totals
- **Session**: turn, speed (tok/s), turn cost, total cost, prompt-cache countdown
- Fits the space the app gives it, so it never scrolls

**The Mission Control pane** (`/missioncontrol`)
- **Usage**: your limits, plus tokens per model for this session and all time
- **Today**: tasks, agents, tokens and cost
- **Workflow**: the plan's steps live
- **Manager**: the boss card with model, effort, sub-agents, cost and time
- **Token Manager**: burn rate, cost per task, cache hits, budget warnings, and an optional autopilot that sends read-only explorers to the cheaper Haiku model
- **Crew**: every agent by role (finished ones fold away), and a **hierarchy** from the manager down to roles and agents
- **Memory**: answer rules Claude follows in every session (`/prefs`)
- **Settings**:
  - ☑ open Mission Control when Claude starts
  - ☑ crew mode
  - currency
  - ☑ sounds
  - change skin

**Smart extras**
- **Crew mode**: big jobs are split across sub-agents automatically. A job counts as big when it has a long brief, 4+ asks, 6+ files, a codebase sweep, a 6-step plan, or context past a set %. Faster, and it keeps the main context lean.
- **Stuck alarm**: an agent that goes quiet for 2 minutes is flagged.
- **Done chime**: a toast, a notification and a sound when the job finishes. Each cyberpunk skin has its own sound pack (job done, step done, level up, and a MaxTac siren). Turn sounds off in Settings.
- **Boot-up**: the pane types out a short boot line when it opens (on Arasaka: "IDENTITY VERIFIED").
- **Rich replies**: diffs, code, tables, math and mermaid charts drawn as cards.
- **Currency**: see costs in USD, EUR, GBP, JPY, MYR, SGD or Night City eddies (€$).
- **Languages**: English, Russian or Hebrew (right to left).

### Street Cred and Braindance

![Street Cred and Braindance](docs/street-cred.png)

- **Street Cred**: every job you finish earns XP. Long jobs and big crews earn more. Level up from NOBODY to LEGEND OF THE AFTERLIFE.
- **9 badges** to unlock: First Gig, Fixer's Favorite, Iconic, The Big Leagues, Netrunner, Fixer, Cyberpsycho, Graveyard Shift… and one more that stays **CLASSIFIED** until you find it.
- **Braindance**: a replay of the session. Every tool call is a mark on the timeline, colored by layer (visual, audio, thermal). Step back and forth with ◀ ▶ to see who did what, and when.
- On non-cyberpunk skins they show up as **Level & Badges** and **Replay**.

---

## Skins

Pick one with `/skins` (a live picker) or `/skin <id>`. Each skin restyles the band, the pane, the chat's tool rows and the spinner. The cyberpunk skins also swap the crabs for a pixel-art cast and add easter eggs.

### Cyberpunk 2077 · `cyberpunk-2077`
Night City HUD: neon yellow, cyan and hot red, cut corners and scanlines. **David** leads. **Lucy, Rebecca, Maine, Dorio, Kiwi, Pilar, Falco and Johnny** take the roles, and chooms and NPCs do the work.

![Cyberpunk 2077 band](docs/band-cyberpunk-2077.png)
![Cyberpunk 2077 crew](docs/crew-cyberpunk-2077.png)

### Lucy · Edgerunners · `lucy-edgerunners`
Moonlit netrunner: rose-pink and cyan on deep violet, with the moon in the skyline. **Lucy** leads, and **David** rides with the crew.

![Lucy band](docs/band-lucy-edgerunners.png)
![Lucy crew](docs/crew-lucy-edgerunners.png)

### Arasaka · `arasaka`
Corporate red and black. **Saburo** at the top. **Adam Smasher**, handlers, agents, netrunners, guards, a cyborg and a captive **Johnny** under him. Troopers, salarymen and drones on the floor. The tower stands in the skyline.

![Arasaka band](docs/band-arasaka.png)
![Arasaka crew](docs/crew-arasaka.png)

### Crab Classic · `crab-classic` (and `default`)
The original: a working crab in costume per role, clean and light. `default` leaves the app's own look.

![Crab Classic band](docs/band-crab-classic.png)
![Crab Classic crew](docs/crew-crab-classic.png)

### Easter eggs (cyberpunk skins)
- The boss's name tears like a **Relic malfunction**; the boss leaves **Sandevistan** afterimages while working.
- **Breach Protocol**: a hex ticker in the band, plus a code-matrix card whose buffer fills as the job's steps finish.
- **NCPD heat** stars for the burn rate. **CYBERPSYCHOSIS RISK** shows past 85% context and **MAXTAC INBOUND** past 95%, with a toast telling you to take your immunosuppressants (`/compact`).
- **Eddies** (€$), a **radio** station of the hour, katakana, and `SYS.2077` code tags.
- A **Night City skyline** with blinking windows and a passing AV.
- **The Afterlife** names a drink after every long job (on Arasaka, the engram is filed in **Mikoshi**).
- Job-done cheers: "PREEM. JOB DONE, CHOOM", the moon rising, or 任務完了.
- Slang in the spinner and tool rows: jacking in, quickhack, ping, datamine, visit Vik, call a Delamain…
- There's a hidden skin. It isn't in the picker. Wake up, and you might find it. 🎸

### Make your own
Skins are small `.json` files; see [`skins/README.md`](skins/README.md) for every field. They load from, in order:
1. the folder you used last
2. a `Custom Claude Skins/` folder in your working folder
3. this repo's `skins/` examples

To make one, copy an example, give it a new `id`, edit it, then run `/skin reload` and `/skin <id>`.

---

## Install

1. Clone it anywhere:
   ```
   git clone https://github.com/Chinchuan24/MIssonControl-Skins.git
   ```
2. Point Claude Code at it in `~/.claude/settings.json` (Windows: `C:\Users\<you>\.claude\settings.json`):
   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/MIssonControl-Skins",
       "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
     }
   }
   ```
   - Several mod folders: separate them with `;` on **Windows**, `:` on **macOS / Linux**.
   - `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` reloads the mod when its files change.
3. Restart Claude Code, then run `/missioncontrol` and `/skins`.

Optional: install the free **Rajdhani** font for the true HUD look. Without it each OS uses its own sans (SF Pro, Segoe UI, Ubuntu or Noto).

Works on Windows, macOS and Linux.

## Commands

| Command | What it does |
|---|---|
| `/missioncontrol` | Open Mission Control (Settings at the bottom) |
| `/missioncontrol currency <code> [rate]` | Costs in `USD`, `EDDIES`, `EUR`, `GBP`, `JPY`, `MYR` or `SGD`; optional rate per US dollar |
| `/skins` | The skin picker, every skin as a live preview |
| `/skin` | `/skin` to list, `/skin <id>` to switch, `/skin off`, `/skin reload` |
| `/autocrew` | Crew mode: state, `on`, `off`, or `<context %>` to call the crew |
| `/tokens` | Token Manager report, `budget <dollars\|off>`, `autopilot <on\|off>` |
| `/prefs` | How Claude should answer you, in every session: `add <rule>`, `remove <n>`, `clear` |

## Development

- `hooks/register.tsx`: hooks, UI and commands
- `hooks/cast.ts`: the pixel casts
- `hooks/eggs.ts`: the easter eggs
- `hooks/richtext.ts`: diffs, tables, math and mermaid in replies
- Tests: `claude plugin test /path/to/MIssonControl-Skins` (and `claude plugin validate …`)
- `.claude-plugin/types/` is generated on each machine by the CLI and is git-ignored.

## Credits and license

- Based on **savvy-progress** from [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT).
- Pixel art: generated for this project in a fan-art style, then converted to sprite grids. The done chime (`assets/done.wav`) was synthesised for this project.
- **Open source under the [MIT License](LICENSE)**: use it, fork it, remix it. Game and show names, characters and terms are not covered.
