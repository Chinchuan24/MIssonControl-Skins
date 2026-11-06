import type { EngineInterface } from 'claude-code'
import { CASTS } from './cast'

// Skin kit: the rules a custom skin file must follow (the same ones the loader,
// readSkin in register.tsx, applies), a validator for /skin check, and /skin new,
// which has Haiku draft a skin from a one-line idea. skins/skin.schema.json
// describes the same rules for editors.

// The loader's own patterns: register.tsx imports these, so there is one copy.
export const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i
export const ID_RE = /^[a-z0-9-]{1,40}$/
export const FONT_BAD_RE = /["<>&;{}]/
export const TOOL_KEY_RE = /^[A-Za-z_]{1,40}$/

export const COLOR_KEYS = ['accent', 'accent2', 'done', 'warn', 'alert', 'meter', 'text', 'subtext', 'muted', 'tile', 'track', 'line', 'grid'] as const
const TOP_KEYS = ['$schema', 'id', 'name', 'description', 'font', 'corners', 'dark', 'colors', 'boss', 'roles', 'effects', 'backdrop', 'chat', 'words', 'toolWords', 'tabs', 'cast']
const PATTERNS = ['dots', 'lines', 'stars', 'none']

export const SCHEMA_URL = 'https://raw.githubusercontent.com/Chinchuan24/MissionControl/main/skins/skin.schema.json'
export const SKIN_ID_MAX = 40

// Another brand's name or logo is not ours to hand out. Short words must be whole
// words ("laws" is fine); long ones are caught anywhere in the letters.
const DENY_WORDS = ['claude', 'aws', 'amazon']
const DENY_PARTS = ['anthropic', 'arasaka', 'cyberpunk', 'cdprojekt']
export const DENY_LIST = ['anthropic', 'claude', 'aws', 'amazon', 'cyberpunk', 'arasaka', 'cd projekt']

/** The denied name in `text`, if any. */
export function deniedBrand(text: string): string | undefined {
  const low = text.toLowerCase()
  const tokens = low.split(/[^a-z0-9]+/).filter(Boolean)
  const word = DENY_WORDS.find(w => tokens.includes(w))
  if (word) return word
  const compact = low.replace(/[^a-z0-9]/g, '')
  return DENY_PARTS.find(p => compact.includes(p))
}

export type Issues = { errors: string[]; warnings: string[] }
export type Check = Issues & { ok: boolean; skin?: Record<string, unknown> }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isColor = (v: unknown): v is string => typeof v === 'string' && COLOR_RE.test(v.trim())

// WCAG relative luminance of a #rgb / #rrggbb colour; undefined for anything else.
const luminance = (c: string): number | undefined => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim())
  if (!m) return undefined
  const h = m[1]!.length === 3 ? [...m[1]!].map(x => x + x).join('') : m[1]!
  const ch = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!
}
export const contrast = (a: string, b: string): number | undefined => {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === undefined || lb === undefined) return undefined
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

type Opts = {
  /** For a skin we draft: nothing may be missing, nothing odd allowed, no cast. */
  strict?: boolean
  /** Ids already worn by another skin (strict only): a new skin must not take one. */
  taken?: ReadonlySet<string>
}

/**
 * Checks a parsed skin file against the loader's rules. `errors` are what the
 * loader would silently replace or drop; `warnings` are things it accepts but a
 * good skin sets. In strict mode every warning is an error.
 */
export function validateSkin(raw: unknown, opts: Opts = {}): Check {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObj(raw)) return { ok: false, errors: ['The file must hold one JSON object.'], warnings }
  const r = raw
  const bad = (m: string) => errors.push(m)
  const soft = (m: string) => warnings.push(m)

  for (const k of Object.keys(r)) if (!TOP_KEYS.includes(k)) soft(`Unknown field "${k}" (the loader ignores it).`)

  // id and name
  if (r.id === undefined) soft('No "id": the file name would be used.')
  else if (typeof r.id !== 'string' || !ID_RE.test(r.id)) bad('"id" must be 1-40 lowercase letters, digits or dashes.')
  if (r.name === undefined) soft('No "name": the id would be shown.')
  else if (typeof r.name !== 'string' || !r.name.trim()) bad('"name" must be a non-empty string.')
  else if (r.name.trim().length > 40) bad('"name" is over 40 characters.')
  if (r.description === undefined) soft('No "description".')
  else if (typeof r.description !== 'string') bad('"description" must be a string.')
  else if (r.description.trim().length > 120) bad('"description" is over 120 characters.')

  // Brand names: always an error in id and name, in the rest an error only when strict.
  const brandIn = (label: string, text: unknown, hard: boolean) => {
    if (typeof text !== 'string') return
    const hit = deniedBrand(text)
    if (hit) (hard ? bad : soft)(`${label} uses "${hit}": a skin must not carry another brand's name.`)
  }
  brandIn('"id"', r.id, true)
  brandIn('"name"', r.name, true)
  brandIn('"description"', r.description, false)
  if (isObj(r.tabs)) for (const [k, v] of Object.entries(r.tabs)) brandIn(`"tabs.${k}"`, v, false)
  if (Array.isArray(r.words)) r.words.forEach(w => brandIn('A spinner word', w, false))

  // font, corners, dark, chat
  if (r.font !== undefined) {
    if (typeof r.font !== 'string' || !r.font.trim()) bad('"font" must be a non-empty string.')
    else if (FONT_BAD_RE.test(r.font)) bad('"font" must not contain " < > & ; { or }. Use single quotes around font names.')
    else if (r.font.trim().length > 200) bad('"font" is over 200 characters.')
  } else soft('No "font": Crab Classic\'s would be used.')
  if (r.corners !== undefined && r.corners !== 'round' && r.corners !== 'chamfer') bad('"corners" must be "round" or "chamfer".')
  if (r.dark !== undefined && typeof r.dark !== 'boolean') bad('"dark" must be true or false.')
  if (r.chat !== undefined && typeof r.chat !== 'boolean') bad('"chat" must be true or false.')

  // colors
  if (r.colors === undefined) soft('No "colors": all thirteen would come from Crab Classic.')
  else if (!isObj(r.colors)) bad('"colors" must be an object.')
  else {
    const c = r.colors
    for (const k of Object.keys(c)) if (!(COLOR_KEYS as readonly string[]).includes(k)) soft(`Unknown color "${k}".`)
    for (const k of COLOR_KEYS) {
      if (c[k] === undefined) soft(`colors.${k} is missing: Crab Classic's would be used.`)
      else if (!isColor(c[k])) bad(`colors.${k} must be a hex color like #FCEE0A or rgb()/rgba(), got ${JSON.stringify(c[k])}.`)
    }
    if (isColor(c.text) && isColor(c.tile)) {
      const ratio = contrast(c.text, c.tile)
      if (ratio !== undefined && ratio < 3) soft(`colors.text on colors.tile is hard to read (contrast ${ratio.toFixed(1)}, aim for 4.5 or more).`)
    }
  }

  // colour lists
  const colorList = (key: 'boss' | 'roles', max: number, want?: number) => {
    const v = r[key]
    if (v === undefined) return soft(`No "${key}": Crab Classic's would be used.`)
    if (!Array.isArray(v) || v.length < 1 || v.length > max) return bad(`"${key}" must be a list of 1-${max} colors.`)
    v.forEach((x, i) => {
      if (!isColor(x)) bad(`${key}[${i}] must be a color, got ${JSON.stringify(x)}.`)
    })
    if (want && v.length !== want) soft(`"${key}" should hold ${want} colors.`)
  }
  colorList('boss', 5, 5)
  colorList('roles', 12)

  // effects, backdrop
  if (r.effects !== undefined) {
    if (!isObj(r.effects)) bad('"effects" must be an object.')
    else for (const k of ['scanlines', 'glitch']) if (r.effects[k] !== undefined && typeof r.effects[k] !== 'boolean') bad(`effects.${k} must be true or false.`)
  }
  if (r.backdrop !== undefined) {
    if (!isObj(r.backdrop)) bad('"backdrop" must be an object.')
    else {
      const b = r.backdrop
      if (b.pattern !== undefined && !PATTERNS.includes(String(b.pattern))) bad('backdrop.pattern must be dots, lines, stars or none.')
      for (const k of ['fill', 'ink']) if (b[k] !== undefined && b[k] !== '' && !isColor(b[k])) bad(`backdrop.${k} must be a color or "".`)
    }
  }

  // words, toolWords, tabs
  if (r.words !== undefined) {
    if (!Array.isArray(r.words) || r.words.length > 20) bad('"words" must be a list of at most 20 strings.')
    else
      r.words.forEach((w, i) => {
        if (typeof w !== 'string' || !w.trim()) bad(`words[${i}] must be a non-empty string.`)
        else if (w.trim().length > 32) bad(`words[${i}] is over 32 characters.`)
      })
  } else soft('No "words": Crab Classic\'s spinner words would be used.')
  if (r.toolWords !== undefined) {
    if (!isObj(r.toolWords)) bad('"toolWords" must be an object like {"Read": "Scan"}.')
    else
      for (const [k, v] of Object.entries(r.toolWords)) {
        if (!TOOL_KEY_RE.test(k)) bad(`toolWords key "${k}" must be a tool name (letters and _ only).`)
        else if (typeof v !== 'string' || !v.trim() || v.trim().length > 20) bad(`toolWords.${k} must be a string of 1-20 characters.`)
      }
  }
  if (r.tabs !== undefined) {
    if (!isObj(r.tabs)) bad('"tabs" must be an object like {"mission": "...", "skins": "..."}.')
    else
      for (const k of ['mission', 'skins']) {
        const v = r.tabs[k]
        if (v !== undefined && (typeof v !== 'string' || !v.trim() || v.trim().length > 40)) bad(`tabs.${k} must be a string of 1-40 characters.`)
      }
  }

  // cast: the Cyberpunk add-on's characters
  if (r.cast !== undefined) {
    if (typeof r.cast !== 'string' || !Object.hasOwn(CASTS, r.cast)) bad(`"cast" must be one of ${Object.keys(CASTS).join(', ')}.`)
    else if (opts.strict) bad('"cast" belongs to the Cyberpunk Skins add-on: leave it out.')
  }

  if (opts.strict) {
    if (typeof r.id === 'string' && opts.taken?.has(r.id)) bad(`The id "${r.id}" is already used by another skin.`)
    errors.push(...warnings.splice(0))
  }
  return { ok: errors.length === 0, errors, warnings, skin: errors.length === 0 ? r : undefined }
}

/** The first JSON object in a model reply, with or without a code fence. */
export function extractJson(reply: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(reply)
  const body = (fenced ? fenced[1]! : reply).replace(/^﻿/, '')
  const a = body.indexOf('{')
  const b = body.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('the reply held no JSON object')
  return JSON.parse(body.slice(a, b + 1))
}

/** A short original skin shown to the model as the shape to follow. */
export const EXAMPLE_SKIN = {
  id: 'harbor-dusk',
  name: 'Harbor Dusk',
  description: 'Deep navy water, lantern orange, and a calm teal glow.',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  corners: 'round',
  dark: true,
  colors: {
    accent: '#FF9F5A',
    accent2: '#4FD1C5',
    done: '#6FCF97',
    warn: '#F2C94C',
    alert: '#EB5757',
    meter: '#56A3E8',
    text: '#EAF1F8',
    subtext: '#A5B7C9',
    muted: '#7C8FA3',
    tile: '#13223A',
    track: '#1B2E4A',
    line: '#27405F',
    grid: '#2C4766',
  },
  boss: ['#FF9F5A', '#F2C94C', '#4FD1C5', '#56A3E8', '#FF9F5A'],
  roles: ['#FF9F5A', '#4FD1C5', '#F2C94C', '#6FCF97', '#56A3E8', '#EB8FB5'],
  effects: { scanlines: false, glitch: false },
  backdrop: { fill: '#0B1626', pattern: 'dots', ink: '#1F3556' },
  chat: true,
  words: ['Drifting', 'Mooring', 'Tide-reading', 'Casting off'],
  toolWords: { Read: 'Chart', Bash: 'Haul' },
  tabs: { mission: 'Mission Control', skins: 'Skins' },
}

// A plain-words copy of the rules, used when the schema file cannot be read.
const RULES_FALLBACK = `Fields: id (1-40 lowercase letters/digits/dashes), name (max 40), description (max 120), font (CSS list; none of " < > & ; { }), corners ("round" or "chamfer"), dark (bool), colors (accent, accent2, done, warn, alert, meter, text, subtext, muted, tile, track, line, grid: each #hex or rgb()/rgba()), boss (5 colors), roles (up to 12 colors), effects {scanlines, glitch} (bools), backdrop {fill, pattern: dots|lines|stars|none, ink}, chat (bool), words (up to 20 spinner words, max 32 chars), toolWords ({"Read": "Scan"}, values max 20), tabs {mission, skins} (max 40 each).`

export function skinPrompt(idea: string, schema: string): string {
  return [
    'You design colour skins for a terminal-style mission dashboard. Reply with ONE JSON object for a skin and nothing else: no prose, no code fence.',
    '',
    'It must follow this JSON Schema:',
    schema,
    '',
    'Example of a good skin:',
    JSON.stringify(EXAMPLE_SKIN),
    '',
    'Rules:',
    '- Set every field shown in the example, and all 13 colors; boss has exactly 5 colors.',
    '- Make it original. Do not use any trademark, brand, product, game, film or real company name or logo, in any field. In particular never use: ' + DENY_LIST.join(', ') + '.',
    '- Do not include "cast" or "$schema".',
    '- Keep text readable: colors.text must contrast strongly with colors.tile (at least 4.5:1). Set "dark" to true for dark palettes.',
    '- id: short, lowercase with dashes, that fits the idea. Spinner words and tool verbs should match the mood.',
    '',
    `Idea: ${idea}`,
  ].join('\n')
}

export const idFromName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, SKIN_ID_MAX) || 'my-skin'

type Deps = {
  /** The folder name the loader looks for in the working folder. */
  folderName: string
  /** Ids of the skins already loaded (built-ins and files). */
  taken: () => ReadonlySet<string>
  /** Re-reads the skins folder so a new file shows up. */
  reload: () => Promise<void>
}

// The folder /skin reload reads first: the remembered one, else "Custom Claude
// Skins" in the session's folder (made on first write if it is not there yet).
async function writeFolder($: EngineInterface, name: string): Promise<string | undefined> {
  const remembered = await $.store.get('skinsFolder').catch(() => undefined)
  if (typeof remembered === 'string' && remembered && (await $.fs.exists(remembered).catch(() => false))) return remembered
  const cwd = await $.session.cwd().catch(() => '')
  return cwd ? `${cwd.replace(/[\\/]+$/, '')}/${name}` : undefined
}

/** /skin new <idea>: drafts, checks and saves a skin, then reloads. Returns the reply text. */
export async function skinNew($: EngineInterface, ideaRaw: string, deps: Deps): Promise<string> {
  const idea = ideaRaw.replace(/\s+/g, ' ').trim().slice(0, 100)
  if (!idea) return 'Usage: /skin new <idea>, for example /skin new ocean sunset'
  const hit = deniedBrand(idea)
  if (hit) return `"${hit}" is another brand's name, so a skin cannot be drafted from it. Describe the look instead: colors, mood, a place.`
  const folder = await writeFolder($, deps.folderName)
  if (!folder) return 'No working folder to save into. Open a session in a project folder first.'

  const schema = await $.fs.read(`${$.plugin.root}/skins/skin.schema.json`).then(String, () => RULES_FALLBACK)
  const r = await $.model.complete({ model: 'haiku', effort: 'low', maxTokens: 2000, timeoutMs: 60_000, prompt: skinPrompt(idea, schema) }).catch((err: unknown) => ({ isAnswered: false as const, reason: String(err).slice(0, 80) }))
  if (!r.isAnswered) return `The model did not answer (${String((r as { reason?: unknown }).reason)}). Nothing was saved. Try again.`

  let parsed: unknown
  try {
    parsed = extractJson(r.text)
  } catch (err) {
    return `The draft was not valid JSON (${String((err as Error).message).slice(0, 80)}). Nothing was saved. Try again.`
  }
  const taken = new Set(deps.taken())
  let obj = parsed
  if (isObj(obj) && typeof obj.id === 'string' && ID_RE.test(obj.id)) {
    // A taken id gets a number instead of the draft being thrown away.
    let id = obj.id
    for (let n = 2; (taken.has(id) || (await $.fs.exists(`${folder}/${id}.json`).catch(() => false))) && n < 100; n++) id = `${obj.id.slice(0, SKIN_ID_MAX - String(n).length - 1)}-${n}`
    obj = { ...obj, id }
  }
  const check = validateSkin(obj, { strict: true, taken })
  if (!check.ok) return `The draft broke the skin rules, so nothing was saved:\n${check.errors.map(e => `- ${e}`).join('\n')}\nTry again, or word the idea differently.`

  const skin = check.skin as Record<string, unknown>
  const id = String(skin.id)
  const path = `${folder}/${id}.json`
  // Never overwrite: the id loop above stops at 100, so check once more.
  if (await $.fs.exists(path).catch(() => false)) return `${path} already exists, so nothing was written. Try again.`
  const { $schema: _ignored, ...rest } = skin
  await $.fs.write(path, JSON.stringify({ $schema: SCHEMA_URL, ...rest }, null, 2) + '\n')
  await deps.reload()
  return `New skin "${String(skin.name)}" saved as ${path}\nWear it: /skin ${id}\nCheck it any time: /skin check ${id}.json`
}

/** /skin check <file>: validates a skin file and says what is wrong. */
export async function skinCheck($: EngineInterface, argRaw: string, deps: Pick<Deps, 'folderName'>): Promise<string> {
  const arg = argRaw.trim().replace(/^["']|["']$/g, '')
  if (!arg) return 'Usage: /skin check <file>, for example /skin check my-skin.json'
  const folder = await writeFolder($, deps.folderName)
  const names = [arg, /\.json$/i.test(arg) ? '' : `${arg}.json`]
  const tries = names.filter(Boolean).flatMap(n => (/^([\\/]|[a-z]:)/i.test(n) || !folder ? [n] : [n, `${folder}/${n}`]))
  let path = ''
  for (const t of tries) {
    if (await $.fs.exists(t).catch(() => false)) {
      path = t
      break
    }
  }
  if (!path) return `No file "${arg}"${folder ? ` here or in ${folder}` : ''}.`
  let parsed: unknown
  try {
    parsed = JSON.parse(String(await $.fs.read(path)).replace(/^﻿/, ''))
  } catch (err) {
    return `${path}\nNot valid JSON: ${String((err as Error).message).slice(0, 120)}`
  }
  const c = validateSkin(parsed)
  const lines = [path, c.ok ? (c.warnings.length ? 'Loads, with notes:' : 'Looks good: the loader will take every field.') : 'Problems the loader would not accept as written:']
  for (const e of c.errors) lines.push(`✗ ${e}`)
  for (const w of c.warnings) lines.push(`• ${w}`)
  if (c.ok) lines.push('Then /skin reload and /skin <id>.')
  return lines.join('\n')
}
