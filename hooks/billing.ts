// Billing for Mission Control: paste a Claude API key once, keep it in the macOS
// Keychain, and let Claude Code use it through its own `apiKeyHelper` setting.
//
// The rules this module keeps (docs/SECURITY-billing.md has the long version):
// - The key lives ONLY in the Keychain. Never in $.store, a file, a log, a toast, an
//   atom or the transcript. The store keeps the last 4 characters and a time.
// - The key reaches `security` on its standard input (`security -i`), never as an
//   argv element: `ps` shows every process's arguments to every user on a Mac.
// - The mod never reads the key back. "Is a key there?" asks for the item's
//   attributes only (no `-w`, no `-g`), which carry no secret.
// - The mod never edits settings files. It reads `apiKeyHelper` (read only) and
//   tells the person the one line to add themselves.
//
// Pure functions where it can be; the few that touch the engine take `$`.

import type { EngineInterface } from 'claude-code'

import type { Billing as BillingState, BillingMode } from '../types'

export const KEYCHAIN_SERVICE = 'mission-control-anthropic-key'
export const HELPER_NAME = 'anthropic-key-helper.sh'
export const SECURITY_BIN = '/usr/bin/security'
export const STORE_KEY = 'billing'
export const SPEND_KEY = 'apiCredits'

type Engine = Pick<EngineInterface, 'process' | 'store' | 'settings' | 'plugin' | 'clock'>

// --- what the pane keeps in view (never the key) -------------------------------

/** All the store keeps about a saved key: its last 4 characters and when it was saved. */
export type SavedKey = { last4: string; savedAt: number }

export type { BillingState, BillingMode }

export const BLANK_BILLING: BillingState = { mode: 'plan', inKeychain: false, saved: null, isMac: true, note: '', nonce: 0, isGuideOpen: false }

// --- the key ---------------------------------------------------------------------

// What a Claude API key is made of: sk-ant-, then letters, digits, - and _. Nothing
// else is accepted, which also keeps a quote or a line break out of the `security`
// command line that carries it.
const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{8,256}$/

export type KeyCheck = { ok: true; key: string; last4: string } | { ok: false; why: string }

/** Whether `raw` can be a Claude API key. The reasons never repeat any of the text. */
export const checkKey = (raw: unknown): KeyCheck => {
  const key = typeof raw === 'string' ? raw.trim() : ''
  if (!key) return { ok: false, why: 'The field is empty. Paste your key first.' }
  if (/\s/.test(key)) return { ok: false, why: 'A key has no spaces or line breaks. Paste only the key.' }
  if (!key.startsWith('sk-ant-')) return { ok: false, why: 'A Claude API key starts with sk-ant-. Nothing was saved.' }
  if (/^sk-ant-(oat|admin)/.test(key)) return { ok: false, why: 'That is an OAuth or admin token, not an API key for Claude. Nothing was saved.' }
  if (!KEY_RE.test(key)) return { ok: false, why: 'That is not shaped like a Claude API key. Nothing was saved.' }
  return { ok: true, key, last4: key.slice(-4) }
}

/** Anything in `text` that looks like a key, e.g. one pasted after a slash command. */
export const looksLikeKey = (text: string): boolean => /sk-ant-[A-Za-z0-9_-]{6,}/.test(text)

/** `text` with every copy of `key` taken out, for anything that is about to be shown. */
export const redact = (text: string, key: string): string => (key ? text.split(key).join('••••') : text)

/** "Key saved ••••abcd", the only thing the pane says about a key. */
export const keyStatus = (b: Pick<BillingState, 'saved' | 'inKeychain'>): string => {
  if (b.saved && b.inKeychain) return `Key saved ••••${b.saved.last4}`
  if (b.saved && !b.inKeychain) return 'No key in the Keychain (it was saved here, then removed there). Paste it again to save.'
  if (b.inKeychain) return 'Key saved (added outside Mission Control)'
  return 'No key saved'
}

/** Cleans what the store holds under `billing`: a bad entry is no entry. */
export const cleanSaved = (v: unknown): SavedKey | null => {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<SavedKey>
  const last4 = typeof r.last4 === 'string' && /^[A-Za-z0-9_-]{4}$/.test(r.last4) ? r.last4 : ''
  const at = typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) && r.savedAt > 0 ? Math.floor(r.savedAt) : 0
  return last4 && at ? { last4, savedAt: at } : null
}

// The key being typed, held in this process's memory only. Not an atom (atoms are
// shared state that can be copied to other surfaces), not the store. It is dropped
// after a Save, a Clear, or ten minutes of sitting there.
const DRAFT_MS = 10 * 60_000
let draftText = ''
let draftAt = 0
export const draft = {
  set: (text: string, at: number): void => {
    draftText = text
    draftAt = at
  },
  get: (at: number): string => {
    if (draftText && at - draftAt > DRAFT_MS) draft.clear() // expired: dropped from memory, not just hidden
    return draftText
  },
  clear: (): void => {
    draftText = ''
    draftAt = 0
  },
}

// The key box draws a dot for each character typed, never the key itself.
export const KEY_DOT = '•'
export const maskKey = (real: string): string => KEY_DOT.repeat(real.length)
/**
 * The real text behind what the box now shows. The box held `real` as dots; the person's
 * edit kept the dots before and after the cursor and typed or pasted between them (at the
 * end, the start or in the middle). A paste over everything has no dots and is taken whole.
 * All dots is a deletion: dots look alike, so it drops from the end.
 */
export const unmaskKey = (shown: string, real: string): string => {
  let lead = 0
  while (lead < shown.length && shown[lead] === KEY_DOT) lead += 1
  if (lead === shown.length) return real.slice(0, Math.min(lead, real.length))
  let trail = 0
  while (trail < shown.length - lead && shown[shown.length - 1 - trail] === KEY_DOT) trail += 1
  const head = Math.min(lead, real.length)
  const tail = Math.min(trail, real.length - head)
  return real.slice(0, head) + shown.slice(lead, shown.length - trail).split(KEY_DOT).join('') + real.slice(real.length - tail)
}

// --- the Keychain, through `security` ----------------------------------------------

/** The name the Keychain item is filed under: this Mac user, from `id -un`, not from the environment. */
export async function accountOf($: Engine): Promise<string> {
  const out = await $.process.run(['/usr/bin/id', '-un'], { timeoutMs: 5000 }).catch(() => null)
  const name = out && out.exitCode === 0 ? out.stdout.trim() : ''
  return /^[A-Za-z0-9._-]{1,64}$/.test(name) ? name : 'mission-control'
}

export async function isMacOS($: Engine): Promise<boolean> {
  const out = await $.process.run(['/usr/bin/uname', '-s'], { timeoutMs: 5000 }).catch(() => null)
  return Boolean(out && out.exitCode === 0 && out.stdout.trim() === 'Darwin')
}

/**
 * The text `security -i` reads on its standard input to add (or update) the item.
 * The key is the only part that is not fixed, and `checkKey` has already limited it
 * to characters that need no escaping inside the quotes.
 */
export const addCommand = (account: string, key: string): string => {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(account) || !KEY_RE.test(key)) throw new Error('refused: unsafe characters')
  return `add-generic-password -U -a "${account}" -s "${KEYCHAIN_SERVICE}" -w "${key}"\n`
}

/** Whether the Keychain item exists. Attributes only: the secret is neither asked for nor returned. */
export async function keychainHas($: Engine): Promise<boolean> {
  const out = await $.process
    .run([SECURITY_BIN, 'find-generic-password', '-a', await accountOf($), '-s', KEYCHAIN_SERVICE], { timeoutMs: 10_000 })
    .catch(() => null)
  return out?.exitCode === 0
}

export type SaveResult = { ok: boolean; message: string; saved?: SavedKey }

/**
 * Checks the key, hands it to the Keychain on stdin, and records only its last 4
 * characters and the time. The result's message never holds any part of the key.
 */
export async function saveKey($: Engine, raw: unknown): Promise<SaveResult> {
  if (!(await isMacOS($))) return { ok: false, message: MAC_ONLY }
  const checked = checkKey(raw)
  if (!checked.ok) return { ok: false, message: checked.why }
  const { key, last4 } = checked
  let exitCode = -1
  try {
    // `security -i` reads its commands from stdin, so the key is in no argument list.
    const run = await $.process.run([SECURITY_BIN, '-i'], { stdin: addCommand(await accountOf($), key), timeoutMs: 15_000 })
    exitCode = run.exitCode
  } catch {
    exitCode = -1
  }
  if (exitCode !== 0) return { ok: false, message: `The Keychain did not accept it (exit ${exitCode}). Is your Keychain unlocked? Nothing was saved.` }
  // The command's own output is not shown: it is not needed, and it is the one place a key could echo.
  const saved: SavedKey = { last4, savedAt: await $.clock.now() }
  await $.store.set(STORE_KEY, saved).catch(() => undefined)
  return { ok: true, message: `Key saved ••••${last4}. It is in your macOS Keychain only.`, saved }
}

/** Takes the item out of the Keychain and forgets the last 4. Not-found counts as removed. */
export async function removeKey($: Engine): Promise<SaveResult> {
  if (!(await isMacOS($))) return { ok: false, message: MAC_ONLY }
  const out = await $.process
    .run([SECURITY_BIN, 'delete-generic-password', '-a', await accountOf($), '-s', KEYCHAIN_SERVICE], { timeoutMs: 15_000 })
    .catch(() => null)
  // 44 is "item not found": there was nothing to remove.
  if (!out || (out.exitCode !== 0 && out.exitCode !== 44)) return { ok: false, message: `The Keychain did not remove it${out ? ` (exit ${out.exitCode})` : ''}. Open Keychain Access and delete "${KEYCHAIN_SERVICE}".` }
  await $.store.delete(STORE_KEY).catch(() => undefined)
  return { ok: true, message: out.exitCode === 44 ? 'There was no key to remove.' : 'Key removed from the Keychain.' }
}

export async function readSaved($: Engine): Promise<SavedKey | null> {
  return cleanSaved(await $.store.get(STORE_KEY).catch(() => undefined))
}

export const MAC_ONLY = 'Saving a key here is macOS-only for now: it uses the macOS Keychain. Nothing was saved.'

/** The same save, typed in your own terminal: the hidden prompt keeps the key off the screen. */
export const terminalAlternative = (): string =>
  `security add-generic-password -U -a "$(id -un)" -s ${KEYCHAIN_SERVICE} -w   (macOS asks for the key, hidden)`

// --- the link to Claude Code: apiKeyHelper ---------------------------------------------

/** Absolute path of the helper script that ships with the mod. */
export const helperPath = (root: string): string => `${root.replace(/\/+$/, '')}/scripts/${HELPER_NAME}`

const SAFE_PATH = /^[A-Za-z0-9_@%+=:,./-]+$/
/** What goes inside the JSON string: the path, single-quoted when the shell would split it (apiKeyHelper runs in /bin/sh). */
export const shellQuote = (p: string): string => (SAFE_PATH.test(p) ? p : `'${p.replace(/'/g, `'\\''`)}'`)

/** The reverse of `shellQuote`, enough to read back what a person typed: quotes and `\ ` escapes. */
export const unquote = (s: string): string => {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/'\\''/g, "'")
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\(["\\$`])/g, '$1')
  return t.replace(/\\(.)/g, '$1')
}

/** Which billing mode the merged `apiKeyHelper` setting means, given where our script is. */
export const classifyHelper = (value: unknown, expected: string): BillingMode => {
  if (typeof value !== 'string' || !value.trim()) return 'plan'
  const path = unquote(value)
  if (path === expected) return 'keychain'
  return path.split('/').pop() === HELPER_NAME ? 'moved' : 'other'
}

/** Reads `apiKeyHelper` (read only) and says which mode it means. A failed read is the plan. */
export async function readMode($: Engine): Promise<BillingMode> {
  const value = await $.settings.read({ key: 'apiKeyHelper' }).catch(() => undefined)
  return classifyHelper(value, helperPath($.plugin.root))
}

export const modeChip = (mode: BillingMode): string =>
  mode === 'keychain' || mode === 'moved' ? 'Billing: API credits (Keychain)' : mode === 'other' ? 'Billing: API credits (another apiKeyHelper)' : 'Billing: Plan'

/** True when costs are real API money through our script: the Token Manager labels them so. */
export const isApiCredits = (mode: BillingMode): boolean => mode === 'keychain' || mode === 'moved'

/** The exact JSON to add to ~/.claude/settings.json, with the real path. */
export const settingsSnippet = (root: string): string => `{\n  "apiKeyHelper": ${JSON.stringify(shellQuote(helperPath(root)))}\n}`

/** `/missioncontrol billing`: four short steps. Nothing here edits a file. */
export const guideText = (root: string, mode: BillingMode): string =>
  [
    `${modeChip(mode)}${mode === 'moved' ? ' (the path in settings.json is not this install: update it, step 2)' : ''}`,
    '',
    '1. Save your key: Mission Control pane > Billing > paste > Save.',
    '   It goes to the macOS Keychain. Mission Control never keeps it.',
    '2. Add this line to ~/.claude/settings.json (you do it; the mod never edits that file):',
    ...settingsSnippet(root).split('\n').map(l => `   ${l}`),
    '3. Restart Claude Code, or run `claude --resume` to keep this same conversation.',
    '4. Back to the plan: delete that line, then restart or `claude --resume`.',
    '',
    'Safer: add "permissions": { "deny": ["Bash(security *)"] } so Claude\'s Bash tool cannot read the Keychain.',
    'If ANTHROPIC_API_KEY is set in your shell, it wins over the helper. Remove the key any time: pane > Billing > Remove.',
  ].join('\n')

/** What `/missioncontrol billing <anything with a key in it>` answers. The key is already in the chat history by then. */
export const KEY_IN_COMMAND =
  'That looks like an API key. It was NOT saved, but it is now in this chat\'s history: revoke it in the Anthropic Console and make a new one. ' +
  `Paste keys only in the pane's Billing box, or in your own terminal: ${terminalAlternative()}`

// --- spend through the key, kept apart from the plan estimates --------------------------

export type Spend = { since: string; date: string; todayUsd: number; totalUsd: number }
export const BLANK_SPEND: Spend = { since: '', date: '', todayUsd: 0, totalUsd: 0 }

export const cleanSpend = (v: unknown): Spend => {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<Spend>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)
  return { since: typeof r.since === 'string' ? r.since : '', date: typeof r.date === 'string' ? r.date : '', todayUsd: n(r.todayUsd), totalUsd: n(r.totalUsd) }
}

/** `usd` added to the total and to `date`'s count (a new day starts that count over). */
export const addSpend = (prev: Spend, usd: number, date: string): Spend => {
  const add = Number.isFinite(usd) && usd > 0 ? usd : 0
  const today = prev.date === date ? prev.todayUsd : 0
  return { since: prev.since || date, date, todayUsd: today + add, totalUsd: prev.totalUsd + add }
}

// The store's read-modify-write is not atomic: adds run one at a time.
let spendQueue: Promise<unknown> = Promise.resolve()
export function noteApiSpend($: Engine, usd: number, date: string): Promise<Spend> {
  const run = spendQueue.then(async () => {
    const next = addSpend(cleanSpend(await $.store.get(SPEND_KEY).catch(() => undefined)), usd, date)
    await $.store.set(SPEND_KEY, next).catch(() => undefined)
    return next
  })
  spendQueue = run.catch(() => undefined)
  return run
}

/** The Token Manager's line for API credits: `fmt` formats dollars in the person's currency. */
export const spendLine = (s: Spend, today: string, fmt: (usd: number) => string): string =>
  `API credits (real money): ≈${fmt(s.date === today ? s.todayUsd : 0)} today · ≈${fmt(s.totalUsd)} since ${s.since || today}`
