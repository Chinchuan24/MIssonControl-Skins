import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import {
  BLANK_SPEND,
  HELPER_NAME,
  KEYCHAIN_SERVICE,
  SPEND_KEY,
  addCommand,
  addSpend,
  checkKey,
  classifyHelper,
  cleanSaved,
  cleanSpend,
  draft,
  guideText,
  KEY_DOT,
  maskKey,
  unmaskKey,
  helperPath,
  isApiCredits,
  keyStatus,
  looksLikeKey,
  modeChip,
  noteApiSpend,
  readMode,
  redact,
  removeKey,
  saveKey,
  settingsSnippet,
  shellQuote,
  spendLine,
  unquote,
} from './billing'

// Billing: a Claude API key goes into the macOS Keychain and nowhere else; Claude Code
// reads it through apiKeyHelper. Only fake keys appear in these tests.

const FAKE = 'sk-ant-TEST-not-a-real-key'
const ROOT = '/Users/chin/.claude/plugins/mission-control'
const HELPER = `${ROOT}/scripts/${HELPER_NAME}`

// --- the key -------------------------------------------------------------------------

test('billing: a key shaped like a Claude API key is accepted, with its last 4', () => {
  const ok = checkKey(`  ${FAKE}\n`)
  expect(ok).toEqual({ ok: true, key: FAKE, last4: '-key' })
})

test('billing: anything else is refused, and the reason never repeats the text', () => {
  for (const bad of ['', '   ', 'hello', 'sk-ant-short', 'sk-ant-has space in it', 'sk-ant-abc12345"; rm -rf', 'sk-ant-abc12345\nadd-generic-password', 'sk-ant-oat01-aaaaaaaaaaaa', 'sk-ant-admin01-aaaaaaaaaaaa', 'sk-ant-éééééééé']) {
    const r = checkKey(bad)
    expect(r.ok).toBe(false)
    if (!r.ok && bad.trim()) expect(r.why).not.toContain(bad.trim())
  }
  expect(checkKey(undefined).ok).toBe(false)
  expect(checkKey(42).ok).toBe(false)
})

test('billing: a key pasted after a slash command is spotted, and redact takes it out of any text', () => {
  expect(looksLikeKey(`billing ${FAKE}`)).toBe(true)
  expect(looksLikeKey('billing')).toBe(false)
  expect(redact(`oops ${FAKE} oops ${FAKE}`, FAKE)).toBe('oops •••• oops ••••')
  expect(redact('nothing here', '')).toBe('nothing here')
})

test('billing: the only status line is "Key saved ••••last4"', () => {
  expect(keyStatus({ saved: { last4: 'wxyz', savedAt: 1 }, inKeychain: true })).toBe('Key saved ••••wxyz')
  expect(keyStatus({ saved: null, inKeychain: false })).toBe('No key saved')
  expect(keyStatus({ saved: null, inKeychain: true })).toContain('outside Mission Control')
  expect(keyStatus({ saved: { last4: 'wxyz', savedAt: 1 }, inKeychain: false })).toContain('No key in the Keychain')
  expect(keyStatus({ saved: { last4: 'wxyz', savedAt: 1 }, inKeychain: false })).not.toContain('wxyz')
})

test('billing: the store entry is cleaned: 4 safe characters and a time, or nothing', () => {
  expect(cleanSaved({ last4: 'ab-_', savedAt: 5.9 })).toEqual({ last4: 'ab-_', savedAt: 5 })
  for (const bad of [null, undefined, 'x', {}, { last4: 'abcde', savedAt: 1 }, { last4: 'ab c', savedAt: 1 }, { last4: 'abcd', savedAt: 0 }, { last4: 'abcd', savedAt: 'now' }]) expect(cleanSaved(bad)).toBeNull()
})

test('billing: the key being typed is kept in memory only, and dropped after ten minutes or on clear', () => {
  draft.set(FAKE, 1_000)
  expect(draft.get(1_000 + 60_000)).toBe(FAKE)
  expect(draft.get(1_000 + 10 * 60_000 + 1)).toBe('')
  // Once expired it is gone from memory, not only hidden: an earlier time does not bring it back.
  expect(draft.get(1_000 + 60_000)).toBe('')
  draft.set(FAKE, 1_000)
  draft.clear()
  expect(draft.get(1_001)).toBe('')
})

test('billing: the key box shows only dots, and an edit anywhere (typed or pasted) turns back into the real text', () => {
  const box = (real: string, edit: (shown: string) => string) => unmaskKey(edit(maskKey(real)), real)
  expect(maskKey(FAKE)).toBe(KEY_DOT.repeat(FAKE.length))
  expect(maskKey(FAKE)).not.toMatch(/[A-Za-z0-9]/)
  let typed = ''
  for (const ch of FAKE) typed = box(typed, s => s + ch)
  expect(typed).toBe(FAKE) // one key at a time
  expect(box('', () => FAKE)).toBe(FAKE) // a paste into the empty box
  expect(box('sk-ant-OLD-text', () => FAKE)).toBe(FAKE) // select all, paste over
  expect(box('sk-ant-', s => s + 'TEST-not-a-real-key')).toBe(FAKE) // a paste at the end
  expect(box('sk-ant-not-a-real-key', s => s.slice(0, 7) + 'TEST-' + s.slice(7))).toBe(FAKE) // in the middle
  expect(box('ant-TEST-not-a-real-key', s => 'sk-' + s)).toBe(FAKE) // at the start
  expect(box(FAKE, s => s.slice(0, -1))).toBe(FAKE.slice(0, -1)) // backspace
  expect(box(FAKE, () => '')).toBe('')
  // An expired draft has no real text behind the dots: they are not turned into anything.
  expect(unmaskKey(maskKey(FAKE), '')).toBe('')
})

// --- the Keychain command: the key rides stdin, never argv ------------------------------

test('billing: the Keychain command carries the key and refuses anything that could break out of its quotes', () => {
  const line = addCommand('chin', FAKE)
  expect(line).toBe(`add-generic-password -U -a "chin" -s "${KEYCHAIN_SERVICE}" -w "${FAKE}"\n`)
  expect(line.split('\n').length).toBe(2) // one command, one trailing newline
  expect(() => addCommand('chin', 'sk-ant-abc12345" -A')).toThrow()
  expect(() => addCommand('chin', 'sk-ant-abc12345\nquit')).toThrow()
  expect(() => addCommand('ch"in', FAKE)).toThrow()
})

// --- apiKeyHelper: reading the mode, showing the line to add ----------------------------

test('billing: apiKeyHelper decides the mode: none is the plan, our script is API credits', () => {
  expect(classifyHelper(undefined, HELPER)).toBe('plan')
  expect(classifyHelper('', HELPER)).toBe('plan')
  expect(classifyHelper(123, HELPER)).toBe('plan')
  expect(classifyHelper(HELPER, HELPER)).toBe('keychain')
  expect(classifyHelper(`'${HELPER}'`, HELPER)).toBe('keychain')
  expect(classifyHelper(`/old/place/${HELPER_NAME}`, HELPER)).toBe('moved')
  expect(classifyHelper('/usr/local/bin/my-own-helper', HELPER)).toBe('other')
  expect(isApiCredits('keychain')).toBe(true)
  expect(isApiCredits('moved')).toBe(true)
  expect(isApiCredits('plan')).toBe(false)
  expect(isApiCredits('other')).toBe(false)
  expect(modeChip('plan')).toBe('Billing: Plan')
  expect(modeChip('keychain')).toBe('Billing: API credits (Keychain)')
})

test('billing: a path with spaces or a quote is shell-quoted for apiKeyHelper, and reads back the same', () => {
  expect(shellQuote(HELPER)).toBe(HELPER)
  for (const p of ["/Users/chin/Personal Projects/claude mod/scripts/x.sh", "/Users/o'brien/scripts/x.sh", '/a b/c$d/e.sh']) {
    expect(unquote(shellQuote(p))).toBe(p)
    expect(classifyHelper(shellQuote(p), p)).toBe('keychain')
  }
  expect(unquote('/Users/chin/Personal\\ Projects/x.sh')).toBe('/Users/chin/Personal Projects/x.sh')
})

test('billing: the exact JSON to add has the real path, and the guide is four steps that edit nothing', () => {
  expect(helperPath(`${ROOT}/`)).toBe(HELPER)
  const json = settingsSnippet(ROOT)
  expect(JSON.parse(json)).toEqual({ apiKeyHelper: HELPER })
  const spaced = settingsSnippet('/Users/chin/Personal Projects/claude mod')
  expect(JSON.parse(spaced).apiKeyHelper).toBe("'/Users/chin/Personal Projects/claude mod/scripts/anthropic-key-helper.sh'")
  const guide = guideText(ROOT, 'plan')
  for (const n of ['1.', '2.', '3.', '4.']) expect(guide).toContain(`\n${n} `)
  expect(guide).toContain(`"apiKeyHelper": "${HELPER}"`)
  expect(guide).toContain('claude --resume')
  expect(guide).toContain('delete that line')
  expect(guide).toContain('never edits that file')
  expect(guide.startsWith('Billing: Plan')).toBe(true)
  expect(guideText(ROOT, 'moved')).toContain('not this install')
})

// --- spend through the key, kept apart ---------------------------------------------------

test('billing: API-credit spend adds up today and in total, and a new day starts today over', () => {
  let s = addSpend(BLANK_SPEND, 0.5, '2026-11-06')
  s = addSpend(s, 0.25, '2026-11-06')
  expect(s).toEqual({ since: '2026-11-06', date: '2026-11-06', todayUsd: 0.75, totalUsd: 0.75 })
  s = addSpend(s, 1, '2026-11-07')
  expect(s).toEqual({ since: '2026-11-06', date: '2026-11-07', todayUsd: 1, totalUsd: 1.75 })
  expect(addSpend(s, -3, '2026-11-07')).toEqual(s)
  expect(addSpend(s, Number.NaN, '2026-11-07')).toEqual(s)
  expect(cleanSpend({ since: 5, todayUsd: -1, totalUsd: 'x' })).toEqual(BLANK_SPEND)
  const fmt = (usd: number) => `$${usd.toFixed(2)}`
  expect(spendLine(s, '2026-11-07', fmt)).toBe('API credits (real money): ≈$1.00 today · ≈$1.75 since 2026-11-06')
  expect(spendLine(s, '2026-11-09', fmt)).toContain('≈$0.00 today')
})

// --- the Keychain and the store, with a stand-in for `security` ------------------------------
// The functions that take the engine's `$` are run on a small stand-in for it, so what the
// key touches can be listed: every argument list, every store write.

type Call = { argv: string[]; stdin?: string }
type World = { os: string; hasItem: boolean; addExit: number; deleteExit: number; helper: string | undefined }
const NOW = Date.parse('2026-11-06T10:00:00Z')
const result = (exitCode: number, stdout = '') => ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

// What the stand-in `security`, `id` and `uname` answer. `calls` lists everything run.
const host = (w: World, calls: Call[]) => (argv: readonly string[], init?: { stdin?: string }) => {
  calls.push({ argv: [...argv], stdin: init?.stdin })
  if (argv[0] === '/usr/bin/uname') return result(0, `${w.os}\n`)
  if (argv[0] === '/usr/bin/id') return result(0, 'chin\n')
  if (argv[0] === '/usr/bin/security' && argv[1] === '-i') {
    if (w.addExit === 0) w.hasItem = true
    return result(w.addExit)
  }
  if (argv[0] === '/usr/bin/security' && argv[1] === 'find-generic-password') return result(w.hasItem ? 0 : 44)
  if (argv[0] === '/usr/bin/security' && argv[1] === 'delete-generic-password') {
    const was = w.hasItem
    if (w.deleteExit === 0) w.hasItem = false
    return result(w.deleteExit !== 0 ? w.deleteExit : was ? 0 : 44)
  }
  return result(1)
}
const blank = (): World => ({ os: 'Darwin', hasItem: false, addExit: 0, deleteExit: 0, helper: undefined })

const fake = () => {
  const w = blank()
  const calls: Call[] = []
  const kv = new Map<string, unknown>()
  const run = host(w, calls)
  const $ = {
    process: { run: async (argv: readonly string[], init?: { stdin?: string }) => run(argv, init) },
    store: {
      get: async (k: string) => kv.get(k),
      set: async (k: string, v: unknown) => void kv.set(k, JSON.parse(JSON.stringify(v))),
      delete: async (k: string) => void kv.delete(k),
    },
    settings: { read: async () => w.helper },
    plugin: { name: 'crab-progress', root: ROOT },
    clock: { now: async () => NOW },
  }
  return { $: $ as never, w, calls, kv }
}

test('billing: saving hands the key to `security -i` on stdin; no argument list, store or message holds it', async () => {
  const { $, calls, kv } = fake()
  const saved = await saveKey($, FAKE)
  expect(saved.ok).toBe(true)
  expect(saved.message).toBe('Key saved ••••-key. It is in your macOS Keychain only.')
  const add = calls.find(c => c.argv[1] === '-i')
  expect(add?.argv).toEqual(['/usr/bin/security', '-i'])
  expect(add?.stdin).toBe(addCommand('chin', FAKE))
  expect(JSON.stringify(calls.map(c => c.argv))).not.toContain(FAKE) // not in any argv, anywhere
  expect(kv.get('billing')).toEqual({ last4: '-key', savedAt: NOW })
  expect(JSON.stringify([...kv.entries()])).not.toContain(FAKE)
  expect(saved.message).not.toContain(FAKE)
})

test('billing: a refused key never reaches the Keychain, and the reason holds none of it', async () => {
  const { $, calls, kv } = fake()
  const bad = await saveKey($, 'my-password-123')
  expect(bad.ok).toBe(false)
  expect(bad.message).not.toContain('my-password')
  expect(calls.some(c => c.argv[1] === '-i')).toBe(false)
  expect(kv.has('billing')).toBe(false)
})

test('billing: a Keychain that says no saves nothing and says so without the key', async () => {
  const { $, w, kv } = fake()
  w.addExit = 2
  const r = await saveKey($, FAKE)
  expect(r.ok).toBe(false)
  expect(r.message).toContain('exit 2')
  expect(r.message).not.toContain(FAKE)
  expect(kv.has('billing')).toBe(false)
})

test('billing: off macOS it says so and touches nothing', async () => {
  const { $, w, calls } = fake()
  w.os = 'Linux'
  const r = await saveKey($, FAKE)
  expect(r.ok).toBe(false)
  expect(r.message).toContain('macOS-only')
  expect(calls.every(c => c.argv[0] === '/usr/bin/uname')).toBe(true)
  expect((await removeKey($)).ok).toBe(false)
})

test('billing: remove deletes the item and the last 4; "not found" counts as removed; a real failure keeps both', async () => {
  const { $, w, calls, kv } = fake()
  await saveKey($, FAKE)
  w.deleteExit = 1
  expect((await removeKey($)).ok).toBe(false)
  expect(kv.has('billing')).toBe(true)
  w.deleteExit = 0
  expect(await removeKey($)).toEqual({ ok: true, message: 'Key removed from the Keychain.' })
  expect(kv.has('billing')).toBe(false)
  expect(await removeKey($)).toEqual({ ok: true, message: 'There was no key to remove.' })
  const del = calls.filter(c => c.argv[1] === 'delete-generic-password').pop()
  expect(del?.argv).toEqual(['/usr/bin/security', 'delete-generic-password', '-a', 'chin', '-s', KEYCHAIN_SERVICE])
})

test('billing: the mode is read from the merged apiKeyHelper setting (read only)', async () => {
  const { $, w } = fake()
  expect(await readMode($)).toBe('plan')
  w.helper = HELPER
  expect(await readMode($)).toBe('keychain')
  w.helper = '/somewhere/else/anthropic-key-helper.sh'
  expect(await readMode($)).toBe('moved')
  w.helper = '/bin/true'
  expect(await readMode($)).toBe('other')
})

test('billing: API-credit spend is kept in the store, one add at a time', async () => {
  const { $, kv } = fake()
  await Promise.all([noteApiSpend($, 0.5, '2026-11-06'), noteApiSpend($, 0.25, '2026-11-06')])
  expect(kv.get(SPEND_KEY)).toEqual({ since: '2026-11-06', date: '2026-11-06', todayUsd: 0.75, totalUsd: 0.75 })
})

// --- the pane and the commands, in the real plugin ---------------------------------------------

const world = blank()
const hostCalls: Call[] = []
const toasts: string[] = []
const kv = new Map<string, unknown>()

const base = (on: On) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  // The store in memory, written out here (not mock.store) so a test can look inside it.
  kv.clear()
  on('store.get', async (_$, e) => ({ value: kv.get((e as { key: string }).key) }) as never)
  on('store.set', async (_$, e) => {
    kv.set((e as { key: string }).key, JSON.parse(JSON.stringify((e as { value: unknown }).value)))
    return { value: undefined } as never
  })
  on('store.delete', async (_$, e) => {
    kv.delete((e as { key: string }).key)
    return { value: undefined } as never
  })
  on('store.keys', async () => ({ value: [...kv.keys()] }) as never)
  Object.assign(world, blank())
  hostCalls.length = 0
  toasts.length = 0
  const run = host(world, hostCalls)
  on('process.run', async (_$, e) => {
    const { argv, init } = e as { argv: string[]; init?: { stdin?: string } }
    return { value: run(argv, init) } as never
  })
  on('settings.read', async () => ({ value: world.helper ? { apiKeyHelper: world.helper } : {} }) as never)
  on('fs.exists', async (_$, e) => ({ value: /addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string; message?: string }).text ?? (e as { message?: string }).message ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const mountPane = ($: Engine) => $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
// Billing lives in the settings pane, apart from the busy main pane.
const mountSettings = ($: Engine) => $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-settings', props: pane })
const everyText = async (ui: Awaited<ReturnType<typeof mountPane>>) => (await ui.findAll({ type: 'Text' })).map(t => String(t.text ?? '')).join('\n')
const svgs = async (ui: Awaited<ReturnType<typeof mountPane>>) => (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
// The line `/missioncontrol billing` tells the person to add, as settings.json would hold it.
const helperLine = async ($: Engine): Promise<string> => {
  const text = String(((await $.command.run({ command: 'missioncontrol', args: 'billing' } as never)) as { text?: string }).text)
  const line = text.split('\n').find(l => l.includes('"apiKeyHelper"')) ?? ''
  return (JSON.parse(`{${line}}`) as { apiKeyHelper: string }).apiKeyHelper
}

test('billing pane: typing a key and pressing Save puts it in the Keychain, shows only ••••last4, and empties the box', async ($, on) => {
  base(on)
  await start($)
  const ui = await mountSettings($)
  expect(await everyText(ui)).toContain('Billing: Plan')
  expect(await everyText(ui)).toContain('No key saved')
  await ui.input({ key: 'bill-key-0', text: FAKE, kind: 'change' })
  // Drawn again as dots, one a character: the box never holds the key.
  const typing = (await ui.findAll({ type: 'Input' })).find(f => String(f.props.key).startsWith('bill-key-'))
  expect(String(typing?.props.value ?? '')).toBe(KEY_DOT.repeat(FAKE.length))
  expect(JSON.stringify((await ui.findAll({})).map(el => el.props))).not.toContain(FAKE)
  await ui.press({ key: 'bill-save' })
  const after = await everyText(ui)
  expect(after).toContain('Key saved ••••-key')
  expect(after).not.toContain(FAKE)
  // The key box, wherever it sits among the settings' own fields.
  const field = (await ui.findAll({ type: 'Input' })).find(f => String(f.props.key).startsWith('bill-key-'))
  expect(field?.props.key).toBe('bill-key-1') // a new, empty box
  expect(String(field?.props.value ?? '')).toBe('')
  expect(JSON.stringify(hostCalls.map(c => c.argv))).not.toContain(FAKE)
  expect(hostCalls.find(c => c.argv[1] === '-i')?.stdin).toContain(FAKE)
  expect(toasts.join('\n')).not.toContain(FAKE)
  expect(kv.get('billing')).toEqual({ last4: '-key', savedAt: NOW })
  expect(JSON.stringify([...kv.entries()])).not.toContain(FAKE)
  await ui.unmount()
})

test('billing pane: Enter in the box saves too, and a wrong paste is refused with nothing echoed', async ($, on) => {
  base(on)
  await start($)
  const ui = await mountSettings($)
  await ui.input({ key: 'bill-key-0', text: 'hunter2-not-a-key' })
  expect(hostCalls.some(c => c.argv[1] === '-i')).toBe(false)
  expect(await everyText(ui)).not.toContain('hunter2')
  expect(toasts.join('\n')).not.toContain('hunter2')
  await ui.input({ key: 'bill-key-1', text: FAKE })
  expect(await everyText(ui)).toContain('Key saved ••••-key')
  await ui.unmount()
})

test('billing pane: Remove takes the key out and the status goes back to "No key saved"', async ($, on) => {
  base(on)
  await start($)
  const ui = await mountSettings($)
  await ui.input({ key: 'bill-key-0', text: FAKE })
  expect(await ui.find({ key: 'bill-remove' })).toBeDefined()
  await ui.press({ key: 'bill-remove' })
  expect(await everyText(ui)).toContain('No key saved')
  expect(world.hasItem).toBe(false)
  expect(kv.has('billing')).toBe(false)
  await ui.unmount()
})

test('billing pane: the box shows dots, says a paste can flash, and offers the hidden terminal way', async ($, on) => {
  base(on)
  await start($)
  const ui = await mountSettings($)
  const text = await everyText(ui)
  expect(text).toContain('a dot for each character')
  expect(text).toContain('for a moment')
  expect(text).toContain(`security add-generic-password -U -a "$(id -un)" -s ${KEYCHAIN_SERVICE} -w`)
  await ui.unmount()
})

test('billing pane: off macOS there is no box, only the macOS-only line', async ($, on) => {
  base(on)
  world.os = 'Linux'
  await start($)
  const ui = await mountSettings($)
  expect(await everyText(ui)).toContain('macOS-only')
  // No key box (the settings' own number fields stay).
  expect((await ui.findAll({ type: 'Input' })).filter(f => String(f.props.key).startsWith('bill-key-'))).toEqual([])
  await ui.unmount()
})

test('billing pane: apiKeyHelper pointing at our script shows the API-credits chip and labels the Token Manager', async ($, on) => {
  base(on)
  await start($)
  world.helper = await helperLine($) // what the person would add to settings.json
  const ui = await mountPane($) // open before the change: it must follow it without a remount
  const settingsUi = await mountSettings($)
  await settingsUi.press({ key: 'bill-guide' }) // looks again
  expect(await everyText(settingsUi)).toContain('Billing: API credits (Keychain)')
  await settingsUi.unmount()
  await ui.drawn()
  const drawn = await svgs(ui)
  expect(drawn).toContain('API credits')
  expect(drawn).toContain('real money')
  await ui.unmount()
})

test('billing pane: with no apiKeyHelper the Token Manager keeps its plan estimates', async ($, on) => {
  base(on)
  await start($)
  const ui = await mountPane($)
  const drawn = await svgs(ui)
  expect(drawn).not.toContain('API credits')
  expect(drawn).toContain('watching every token')
  await ui.unmount()
})

test('/missioncontrol billing: four steps with the real path, the status, and nothing edited', async ($, on) => {
  base(on)
  await start($)
  const text = String(((await $.command.run({ command: 'missioncontrol', args: 'billing' } as never)) as { text?: string }).text)
  expect(text).toContain(`scripts/${HELPER_NAME}`)
  expect(text).toContain('claude --resume')
  expect(text).toContain('No key saved')
  expect(text).toContain('Billing: Plan')
  expect(typeof (await helperLine($))).toBe('string')
})

test('/missioncontrol <key>: refused, not saved, not echoed, and not made a job name', async ($, on) => {
  base(on)
  await start($)
  for (const args of [FAKE, `billing ${FAKE}`, `currency ${FAKE}`]) {
    const r = (await $.command.run({ command: 'missioncontrol', args } as never)) as { text?: string }
    expect(String(r.text)).toContain('NOT saved')
    expect(String(r.text)).not.toContain(FAKE)
  }
  expect(hostCalls.some(c => c.argv[1] === '-i')).toBe(false)
  expect(kv.has('billing')).toBe(false)
  expect(JSON.stringify([...kv.entries()])).not.toContain(FAKE)
})
