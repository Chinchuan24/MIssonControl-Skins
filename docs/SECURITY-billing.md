# Billing with an API key: security notes

For the security team. Plain words, no marketing.

**What the feature does.** You paste a Claude API key into Mission Control's pane once. The key is stored in the macOS Keychain. Claude Code can then be told (by you, in your own settings file) to use that key instead of your Claude plan. Costs the Token Manager shows are then labelled "API credits".

**Files:** `hooks/billing.ts` (all the logic), `scripts/anthropic-key-helper.sh` (the 3-line reader), a Billing section in `hooks/register.tsx`.

## Where the key lives

| Place | Holds the key? |
|---|---|
| macOS Keychain, item `mission-control-anthropic-key`, account = your Mac user | **Yes. The only place.** |
| `$.store` (the mod's saved settings) | No. Only the last 4 characters and a timestamp, to draw "Key saved ••••abcd". |
| Files, logs, toasts, the transcript, the pane after a Save | No. |
| The mod's memory | Yes, briefly, while it is typed or saved. It is held in a plain variable (not shared state), dropped on Save, on "Clear box", or after 10 minutes. |
| Claude Code's process memory | Yes, while it runs: it asks the helper for the key and sends it to Anthropic's API as the request's key. |

## How the key travels (and the `ps` decision)

**Saving.** The mod runs `/usr/bin/security -i` and writes one command to its **standard input**: `add-generic-password -U -a <user> -s mission-control-anthropic-key -w <key>`.

**Why not `security add-generic-password ... -w <key>`?** That puts the key in the process's argument list. On macOS any user can read every process's arguments with `ps`. Checked on this machine: a stand-in process started with a fake `sk-ant-TEST-...` argument showed it in full in `ps -A -o user=,args=`, and 173 root-owned processes' arguments were readable by a normal user. Apple's own `security` usage text says `-w` with a value is insecure. The window is short (milliseconds), but a short window is still a window, and stdin has none. Other options were ruled out: `-w` as the last option prompts through the terminal, which the mod does not have; `-X <hex>` is still an argument.

The `security -i` route was tested with the real Keychain (fake key only): add, update (`-U`), read back through the helper, delete, delete-when-absent. A failing command in `-i` mode still returns a non-zero exit code (checked), so a failed save is reported as failed.

The key is accepted only if it matches `sk-ant-` followed by letters, digits, `-` or `_`. That also keeps a quote or line break out of the command line sent on stdin.

**Reading.** `scripts/anthropic-key-helper.sh` runs `/usr/bin/security find-generic-password -a <you> -s mission-control-anthropic-key -w`. Claude Code runs it as `apiKeyHelper` and reads standard output. Fixed service name, fixed account (`id -un`), fixed path to `security`: no environment variable can point it at another Keychain item. No key means empty output and a non-zero exit.

**The mod never reads the key back.** To show "Key saved" it asks the Keychain whether the item exists (`find-generic-password` without `-w` or `-g`), which returns attributes only. You can check this yourself:

```sh
grep -n "find-generic-password" hooks/billing.ts scripts/anthropic-key-helper.sh
```

Only the helper script reads the secret.

## Who can read the key

- **You, and any program running as you.** An item created by `security` lets `/usr/bin/security` read it without a prompt while your login Keychain is unlocked. We confirmed this: a normal shell command read it back with no dialog. So the Keychain protects the key **at rest** (encrypted with your login, locked when you log out; use FileVault) but **not from malware or any tool running as your user**.
- **Claude Code's Bash tool, if Claude is told to.** A prompt-injected instruction could make Claude run the `security` command above and print the key. Recommended hardening, in your own `~/.claude/settings.json`: `"permissions": { "deny": ["Bash(security *)"] }`. The mod cannot add this for you (it never edits settings). We did not test that exact rule string; check it against your Claude Code version.
- **Other plugins/mods you have installed.** Plugins are full-trust code in the same process. A plugin can hook `ui.input` (it sees what is typed in the box, before ours does), `process.run` (it sees the argument list and the stdin text of every command, including the Keychain write), and `ui.render`. Install only plugins you trust before using this feature.
- **Your screen.** The pane's Input has **no mask option** (`InputProps` has `key`, `label`, `placeholder`, `value`, `submitLabel`, `rows`, `autoFocus`, `onInput`, `onSubmit`; nothing for passwords). The key is **visible while typed**. The pane says so, and gives a hidden alternative to run in your own terminal:
  `security add-generic-password -U -a "$(id -un)" -s mission-control-anthropic-key -w` (macOS prompts for the key and hides it). Do not screen-share while pasting.
- **Chat history.** The mod refuses `/missioncontrol ...` with a key in the arguments, does not echo it, and keeps it out of any job name. But slash-command text is already in the transcript by then. If that ever happens, revoke the key (below). That is why the key is entered in the pane (not with a slash command).

## What the mod can and cannot do

| Can | Cannot / does not |
|---|---|
| Run `security` to add, check for, and delete its one item | Read the key back |
| Read `apiKeyHelper` from the merged settings (read only) | Edit any settings file |
| Show "Billing: Plan" or "Billing: API credits (Keychain)" | Switch the mode: you add or remove the line |
| Count spend while the mode is API credits (store key `apiCredits`: dates and dollar totals, no key) | Know your real invoice: the numbers are estimates from a price table; the Anthropic Console is the source of truth |
| Be trusted code with full user rights (like any plugin) | Be sandboxed from the Keychain. Review the code (about 270 lines) rather than trusting this page |

macOS only. On other systems the pane says "macOS-only for now" and does nothing.

## Turning it on and off

On: pane > Billing > paste > Save; add `"apiKeyHelper": "<path to scripts/anthropic-key-helper.sh>"` to `~/.claude/settings.json` (`/missioncontrol billing` prints the exact line with the real path); restart Claude Code, or `claude --resume` to keep the same conversation. The path changes if the plugin folder moves or updates: the pane shows when the configured path is not this install. If the script lost its executable bit, run `chmod +x` on it.

Precedence (from Claude Code's documentation, not tested here): `ANTHROPIC_API_KEY` in the environment wins over `apiKeyHelper`, and `apiKeyHelper` wins over a logged-in plan. Claude Code caches the helper's output for a few minutes.

Off: delete the `apiKeyHelper` line and restart or resume. The pane then reads "Billing: Plan".

## How to revoke

1. Pane > Billing > **Remove key** (deletes the Keychain item and the stored last 4). Or Keychain Access, search `mission-control-anthropic-key`, delete. Or `security delete-generic-password -a "$(id -un)" -s mission-control-anthropic-key`.
2. Delete the `apiKeyHelper` line. A running Claude Code may keep the cached key for a few minutes; restart it.
3. **Revoke the key itself** in the Anthropic Console (API keys). Do this whenever the key may have been seen: screen-shared, typed after a slash command, a machine you no longer trust. Removing it from the Keychain does not cancel it.

Use a dedicated key with a spend limit for this, not a shared or admin one. The mod refuses `sk-ant-oat...` and `sk-ant-admin...` tokens, which are not API keys for Claude.

## Not verified

- The Input and pane behaviour in a real Claude Code window (the plugin test runner was not available when this was written).
- Claude Code actually authenticating with the helper, and its precedence rules, end to end.
- Whether Claude Code writes the helper's output to its debug logs.
- The exact `permissions.deny` rule spelling above.
