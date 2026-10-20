# Custom Claude Skins

Skins for the **Mission Control** mod: the band above the prompt, the Mission Control pane, its cards and the hierarchy.

Skins load from, in order: the folder you used last, a `Custom Claude Skins/` folder in your working folder (on Linux, or a case-sensitive Mac drive, the name must match exactly), then the `skins/` examples shipped with the mod. The JSON files here are copies of the built-in skins: copy one to start your own. The cyberpunk ones live in `addons/cyberpunk/skins/` (Cyberpunk Skins add-on).

> Unofficial, non-commercial fan project. Cyberpunk 2077, Cyberpunk: Edgerunners and all related names and characters belong to their respective owners (CD PROJEKT S.A., Studio Trigger, Netflix) and are used as fan homage only.

## Use

- `/skins`: open the skin picker panel
- `/skin`: list skins (▸ marks the one that's on)
- `/skin crab-classic`: switch, live
- `/skin off`: back to Default (no skin)
- `/skin reload`: re-read this folder after you edit or add a file

## Make your own

Copy a `.json` file here, give it a new `id` (lowercase, dashes), change the colors, then `/skin reload` and `/skin <your-id>`.

| Field | What it does |
|---|---|
| `font` | Font list, first installed one wins (install Rajdhani for the true Cyberpunk look) |
| `corners` | `round` or `chamfer` (cut corners, HUD style) |
| `dark` | `true` paints its own dark colors whatever the system theme |
| `colors.accent` / `accent2` | Main and second neon |
| `colors.done` / `warn` / `alert` | Green, amber and red states |
| `colors.meter` | Usage bars |
| `colors.text` / `subtext` / `muted` | Text, from bright to quiet |
| `colors.tile` / `track` / `line` / `grid` | Card fill, bar tracks, hairlines, dotted backdrop |
| `boss` | Five colors for the Manager's spinning ring |
| `roles` | Colors given to named roles ("Designer: ...") |
| `effects` | `scanlines` and `glitch` on or off |
| `backdrop` | The whole panel's background: `fill` color, `pattern` (`dots`, `lines`, `stars`, `none`), `ink` for the pattern |
| `chat` | `true` restyles the chat's tool rows and spinner; `false` leaves the app's own |
| `words` | Spinner words while Claude thinks ("Jacking in") |
| `toolWords` | A verb per tool row, e.g. `{ "Read": "Scan", "Bash": "Exec" }` |
| `tabs` | Tab titles: `{ "mission": "◢ Mission Control", "skins": "◢ Skins" }` |

Colors are hex (`#FCEE0A`) or `rgb()/rgba()`. A file with a mistake is skipped; `/skin` shows what loaded.
