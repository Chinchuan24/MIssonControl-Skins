# Make your own skin / Skin jam

A skin is one small `.json` file. You can write it by hand or let Claude draft it.

## 👉 Fastest way

```
/skin new ocean sunset
```

Claude (Haiku, low effort) drafts a skin from your one-line idea, checks it, saves it, and tells you the id:

```
New skin "Ocean Sunset" saved as .../Custom Claude Skins/ocean-sunset.json
Wear it: /skin ocean-sunset
```

Then wear it with `/skin ocean-sunset`.

- It saves to the same folder `/skin reload` reads (the folder you used last, else `Custom Claude Skins/` in your working folder).
- It never overwrites a file. If the id is taken, it adds `-2`, `-3`, and so on.
- If the draft breaks a rule, nothing is saved and you are told what was wrong. Run it again.

## Commands

| Command | What it does |
|---|---|
| `/skin new <idea>` | Draft, check and save a new skin |
| `/skin check <file>` | Check a skin file and list what is wrong (a bare name looks in your skins folder) |
| `/skin reload` | Re-read the folder after you edit a file |
| `/skin <id>` | Wear a skin |

## The schema

[`skins/skin.schema.json`](../skins/skin.schema.json) is a JSON Schema (draft 2020-12) of every field. Add this to the top of your file and your editor will check it as you type:

```json
"$schema": "./skin.schema.json"
```

(The loader ignores that key. From a folder other than `skins/`, use the full URL inside the schema's `$id`.)

Short version:

| Field | Rule |
|---|---|
| `id` | 1-40 lowercase letters, digits, dashes |
| `name` | up to 40 characters |
| `description` | up to 120 characters |
| `font` | CSS font list; no `"` `<` `>` `&` `;` `{` `}` |
| `corners` | `round` or `chamfer` |
| `colors` | 13 colors: `accent accent2 done warn alert meter text subtext muted tile track line grid` |
| `boss` | 5 colors |
| `roles` | up to 12 colors |
| `words` | up to 20 spinner words, 32 characters each |
| `toolWords` | `{ "Read": "Scan" }`, verbs up to 20 characters |

Colors are hex (`#FCEE0A`) or `rgb()` / `rgba()`. Anything else is replaced by a default, which `/skin check` reports.

## Names and logos

Make it your own. A skin must not use another brand's name or logo: no company, product, game or film names. `/skin new` tells the model so, and both `/skin new` and `/skin check` refuse ids and names containing `anthropic`, `claude`, `aws`, `amazon`, `cyberpunk`, `arasaka` or `cd projekt`. The `cast` field (characters in place of the crabs) belongs to the Cyberpunk Skins add-on, so leave it out.

## Skin jam: share yours

1. Make a skin and run `/skin check my-skin.json` until it says "Looks good".
2. Fork this repo and add your file as `skins/community/<id>.json` (create the folder if it is not there).
3. Open a pull request. Say what the skin looks like in one line, and attach a screenshot if you can.
4. Keep to one skin per pull request. Original names only (see above).

Good jam skins have all 13 colors, text that is easy to read on the card color (contrast 4.5 or more), and spinner words that fit the mood.
