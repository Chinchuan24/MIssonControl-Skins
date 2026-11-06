// Crew control: per-agent Ultra (a deep mode for chosen roles) and One-shot (what the
// main session does once you approve a roadmap). Pure helpers; register.tsx wires them.

export const ULTRA_KEY = 'ultraRules'
export const ONESHOT_KEY = 'oneShot'
export const ULTRA_MARK = '[Ultra: deep check]'
export const ULTRA_MAX_RULES = 20

// ---- Ultra rules -------------------------------------------------------------------

// A saved list may hold anything: keep short, lower-case, unique words.
export const cleanUltraRules = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const r of raw) {
    const t = typeof r === 'string' ? r.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40) : ''
    if (t && !out.includes(t)) out.push(t)
  }
  return out.slice(0, ULTRA_MAX_RULES)
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A rule matches when its words stand in the agent's type or description ("tester"
// matches "Tester: check widths" and "testers"). Case is ignored.
export const ruleMatches = (rule: string, type: string, description: string): boolean => {
  const r = rule.trim().toLowerCase()
  if (!r) return false
  return new RegExp(`(?:^|[^a-z0-9])${escapeRe(r)}(?:s|es)?(?![a-z0-9])`, 'i').test(`${type} ${description}`)
}

export const matchUltra = (rules: readonly string[], type: string, description: string): string | null =>
  rules.find(r => ruleMatches(r, type, description)) ?? null

export type UltraCommand = { rules: string[]; text: string }

// `/tokens ultra add Tester`, `remove Tester`, `list`, `off`. Pure: the caller saves `rules`.
export const ultraCommand = (rules: readonly string[], arg: string, running = 0): UltraCommand => {
  const [verb = '', ...words] = arg.trim().split(/\s+/).filter(Boolean)
  const name = cleanUltraRules([words.join(' ')])[0] ?? ''
  const list = (rs: readonly string[]): string => (rs.length ? rs.join(', ') : 'none')
  if (verb === 'add') {
    if (!name) return { rules: [...rules], text: 'Usage: /tokens ultra add <role>, like /tokens ultra add Tester' }
    if (rules.includes(name)) return { rules: [...rules], text: `⚡ ${name} is already Ultra.` }
    if (rules.length >= ULTRA_MAX_RULES) return { rules: [...rules], text: `Too many rules (${ULTRA_MAX_RULES} max). Remove one first.` }
    return { rules: [...rules, name], text: `⚡ Ultra on for "${name}". New agents with that role run at max effort and get a deep-check brief. Rules: ${list([...rules, name])}` }
  }
  if (verb === 'remove') {
    if (!name) return { rules: [...rules], text: 'Usage: /tokens ultra remove <role>' }
    if (!rules.includes(name)) return { rules: [...rules], text: `No Ultra rule "${name}". Rules: ${list(rules)}` }
    const left = rules.filter(r => r !== name)
    return { rules: left, text: `Ultra off for "${name}". Rules: ${list(left)}` }
  }
  if (verb === 'list' || verb === '') {
    return { rules: [...rules], text: `⚡ Ultra rules: ${list(rules)}${running ? ` · ${running} agent${running === 1 ? '' : 's'} running Ultra now` : ''}\nAdd: /tokens ultra add <role> · remove: /tokens ultra remove <role> · clear all: /tokens ultra off` }
  }
  if (verb === 'off') return { rules: [], text: rules.length ? 'Ultra rules cleared. Agents already running keep their setting; use the ⚡ button on a card to change one.' : 'Ultra was already off.' }
  return { rules: [...rules], text: 'Usage: /tokens ultra add <role> | remove <role> | list | off' }
}

// ---- Effort order: the person's card choice > an Ultra rule > Smart staffing -----------

// `explicit` is the card's ⚡ button (true/false once pressed, undefined if never);
// `byRule` is whether an Ultra rule matched at spawn.
export const isUltraAgent = (explicit: boolean | undefined, byRule: boolean): boolean => explicit ?? byRule

// The effort a request goes out with. A model that takes no effort (`original`
// undefined) is sent none, whatever is asked.
export const resolveEffort = (original: string | number | undefined, staffed: string | undefined, ultra: boolean): string | number | undefined => {
  if (original === undefined) return undefined
  if (ultra) return 'max'
  return staffed ?? original
}

export const ULTRA_BRIEF = `\n\n${ULTRA_MARK} This task gets a deep check. Verify every claim you make against the code or a command's output, not memory. Run the tests (or the nearest check) and read the result. Re-read your own diff before you finish. End your report with a short list of what you could not verify.`

export const withUltraBrief = (prompt: string): string => (prompt.includes(ULTRA_MARK) ? prompt : prompt + ULTRA_BRIEF)

export const ultraLine = (running: number, rules: number): string =>
  `⚡ Ultra: ${running} agent${running === 1 ? '' : 's'} running Ultra · ${rules} rule${rules === 1 ? '' : 's'}${rules ? '' : ' (/tokens ultra add <role>)'}`

// ---- One-shot ------------------------------------------------------------------------

export type OneShot = 'ask' | 'on' | 'off'
export const cleanOneShot = (raw: unknown): OneShot => (raw === 'on' || raw === 'off' ? raw : 'ask')
export const nextOneShot = (m: OneShot): OneShot => (m === 'ask' ? 'on' : m === 'on' ? 'off' : 'ask')
export const oneShotWord = (m: OneShot): string => (m === 'on' ? 'One-shot' : m === 'off' ? 'Part by part' : 'Asks')

export const ONESHOT_ID = 'crab-progress:oneshot'
export const oneShotText = (m: OneShot): string => {
  if (m === 'on')
    return 'One-shot mode is on. When you present a roadmap or multi-step plan and the user approves it, do every item without stopping to check in (use a crew of agents where it helps), then report back once at the end. Still ask first before anything outward-facing or destructive: pushing, publishing, sending messages, spending money, deleting data.'
  if (m === 'off')
    return 'Part-by-part mode is on. When you present a roadmap or multi-step plan and the user approves it, do one part at a time: finish it, report briefly, and wait for the user before the next part.'
  return 'When you present a roadmap or multi-step plan and the user approves it, ask once before starting: "Part by part, or one-shot?" Part by part means do one item, report, and wait. One-shot means do every item without stopping to check in, then report back once at the end (still confirming anything outward-facing or destructive). Do not ask again once they have answered for that plan.'
}

export const oneShotSection = (m: OneShot) => ({ id: ONESHOT_ID, text: oneShotText(m), scope: 'session' as const })

// `on` | `off` | `ask`; anything else is not a mode.
export const parseOneShot = (arg: string): OneShot | null => {
  const a = arg.trim().toLowerCase()
  return a === 'on' || a === 'off' || a === 'ask' ? a : null
}

export const oneShotSaid = (m: OneShot): string =>
  m === 'on'
    ? 'One-shot on: when you approve a plan, Claude does every item, then reports once. It still asks before anything outward-facing or destructive.'
    : m === 'off'
      ? 'Part by part: after you approve a plan, Claude does one item, reports, and waits.'
      : 'One-shot asks: after you approve a plan, Claude asks "Part by part, or one-shot?" once.'

// A small chip for the pane: the word in a rounded pill. Colours and font come from the caller.
export const oneShotChip = (m: OneShot, color: string, font: string, text: string, width: (s: string, size: number) => number): { W: number; svg: string } => {
  const label = `⏩︎ ${oneShotWord(m)}`
  const W = Math.round(width(label, 11.5) + 22)
  const esc = label.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return {
    W,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="24" viewBox="0 0 ${W} 24"><rect x="0.5" y="2.5" width="${W - 1}" height="19" rx="9.5" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-opacity=".6"/><text x="${W / 2}" y="16" text-anchor="middle" font-family="${font}" font-size="11.5" font-weight="600" fill="${text}">${esc}</text></svg>`,
  }
}
