// Smart Keep-Warm: the Token Manager refreshes the prompt cache shortly before it
// lapses, when the refresh is expected to save more than it costs.
//
// The approach follows paulbkim-dev/claude-code-cache-warmer (MIT, after Pi's cache
// warmer): a side request over the session's own transcript ($.model.fork), which
// never enters the conversation; an expected-value rule; and a cap on idle refreshes.
// Mission Control's own additions: work still running in the background counts as a
// sure return; a context about to be compacted is not warmed; and the outcome shows
// in the Token Manager instead of a pane of its own.
//
// Pure arithmetic here, so it is tested on its own.

export const WARM_TAG = '[mission-control keep-warm]'
export const WARM_PROMPT = `${WARM_TAG} Automated prompt cache refresh by Mission Control, not a message from the user. Reply with the single word ok.`

/** A refresh goes out only when it is expected to save at least this much. */
export const MIN_SAVINGS_USD = 0.05
/** The chance a prompt comes before an idle cache lapses (Pi's measured figure). */
export const IDLE_CHANCE = 0.15
/** A refresh's reply is a word, but a thinking model spends a little before it. */
export const WARM_OUTPUT_TOKENS = 200
/** Idle refreshes per prompt: with the hour-long cache, close to three more warm hours. */
export const IDLE_LIMIT = 3
/** Refreshes per prompt while agents or background tasks still run. */
export const BUSY_LIMIT = 12
/** The refresh goes this long before the cache lapses, and not in its last seconds. */
export const LEAD_MS = 6 * 60_000
export const LATE_MS = 15_000
/** A context this full is about to be compacted, which rewrites the cache anyway. */
export const COMPACT_PCT = 85

/** USD per million tokens: input, output, cache read, cache write (the hour-long write). */
export type WarmPrice = readonly [input: number, output: number, cacheRead: number, cacheWrite: number]

export type WarmCall = {
  isWarm: boolean
  /** What the refresh costs: reading the prefix, and its short reply. */
  warmUsd: number
  /** What a lapsed cache adds to the next prompt: writing the prefix instead of reading it. */
  missUsd: number
  /** The chance a prompt comes while the refresh still holds. */
  chance: number
  expectedUsd: number
  /** Why not, when a refresh does not pay. */
  reason?: string
}

export const warmCall = (price: WarmPrice, promptTokens: number, isLikely: boolean, contextPct: number, outputTokens = WARM_OUTPUT_TOKENS): WarmCall => {
  const [, output, cacheRead, cacheWrite] = price
  const warmUsd = (promptTokens * cacheRead + outputTokens * output) / 1e6
  const missUsd = Math.max(0, (promptTokens * (cacheWrite - cacheRead)) / 1e6)
  const chance = isLikely ? 1 : IDLE_CHANCE
  const expectedUsd = chance * missUsd - warmUsd
  if (contextPct >= COMPACT_PCT) return { isWarm: false, warmUsd, missUsd, chance, expectedUsd, reason: `context ${contextPct}%: a /compact rewrites the cache anyway` }
  if (promptTokens <= 0) return { isWarm: false, warmUsd, missUsd, chance, expectedUsd, reason: 'nothing cached yet' }
  if (expectedUsd < MIN_SAVINGS_USD) return { isWarm: false, warmUsd, missUsd, chance, expectedUsd, reason: `too small to pay (saves under $${MIN_SAVINGS_USD.toFixed(2)})` }
  return { isWarm: true, warmUsd, missUsd, chance, expectedUsd }
}

/** Whether a refresh is due: inside the lead before the cache lapses, not too late. */
export const isWarmDue = (cacheUntil: number | null, at: number): boolean =>
  cacheUntil !== null && at >= cacheUntil - LEAD_MS && at < cacheUntil - LATE_MS

/** A refresh that read under half the prefix found the cache gone and wrote it again. */
export const isWarmed = (cacheRead: number, promptTokens: number): boolean => promptTokens > 0 && cacheRead >= promptTokens / 2

/** The refreshes left before the cap: a busy session gets more than an idle one. */
export const warmLimitHit = (isLikely: boolean, idle: number, busy: number): boolean => (isLikely ? busy >= BUSY_LIMIT : idle >= IDLE_LIMIT)
