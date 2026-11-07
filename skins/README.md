# Custom Claude Skins

Skins for the **Mission Control** mod: the band above the prompt, the Mission Control pane, its cards and the hierarchy.

Skins load from, in order: the folder you used last, a `Custom Claude Skins/` folder in your working folder (on Linux, or a case-sensitive Mac drive, the name must match exactly), then the `skins/` examples shipped with the mod. The JSON files here are copies of the built-in skins: copy one to start your own. `mentalist.json` is The Mentalist, a fan-homage skin with Jane and the CBI team as its pixel cast. `breaking-bad.json` is the Breaking Bad fan-homage skin (Mr. White, Jesse and the lab). `better-call-saul.json` is the Better Call Saul fan-homage skin (Saul's strip-mall law office). The cyberpunk ones live in `addons/cyberpunk/skins/` (Cyberpunk Skins add-on).

> Unofficial, non-commercial fan project. Cyberpunk 2077, Cyberpunk: Edgerunners and all related names and characters belong to their respective owners (CD PROJEKT S.A., Studio Trigger, Netflix) and are used as fan homage only. The Mentalist and its characters belong to CBS and Warner Bros. Television, likewise used as fan homage only. Breaking Bad and its characters belong to Sony Pictures Television and AMC, used as fan homage only. Invincible and its characters belong to Robert Kirkman, Cory Walker, Ryan Ottley, Image Comics, Skybound and Amazon MGM Studios, used as fan homage only. Better Call Saul and its characters belong to Sony Pictures Television and AMC, used as fan homage only.

## Use

- `/skins`: open the skin picker panel
- `/skin`: list skins (▸ marks the one that's on)
- `/skin crab-classic`: switch, live
- `/skin mentalist`: Jane and the CBI team (dark, its own pixel cast)
- `/skin breaking-bad`: Mr. White, Jesse and the lab (dark, crystal blue, its own pixel cast)
- `/skin better-call-saul`: Saul's strip-mall law office (dark walnut, powder blue and gold, Mike roams). A hidden black-and-white skin hides inside it
- `/skin invincible`: the comic page that became the show (ink navy and suit yellow). Mark and Omni-Man fight across the band and the pane now and then, the Guardians take on Omni-Man once a day (or type `guardians`), and a second era hides behind `new suit` (`classic suit` goes back).
- `/skin off`: back to Default (no skin)
- `/skin reload`: re-read this folder after you edit or add a file
- `/skin new <idea>`: Claude drafts a skin from a one-line idea and saves it
- `/skin check <file>`: check a skin file; `skin.schema.json` lets your editor do it too

Guide: [`docs/SKINS.md`](../docs/SKINS.md).

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
