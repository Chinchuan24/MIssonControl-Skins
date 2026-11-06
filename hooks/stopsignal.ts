// Stop Signal: money keeps going out but the plan has stopped moving.
//
// The ticker samples the session's cost and the plan's progress (0 to 1) every so
// often. When the last WINDOW_MS spent at least MIN_SPEND_USD while the plan moved
// less than MIN_MOVE, the person is asked once: re-plan or stop? Pure functions only;
// register.tsx keeps the samples in memory and does the toasting.

export type ProgressSample = { at: number; costUsd: number; progress: number }
export type StopSignal = { spentUsd: number; moved: number; minutes: number }
type Step = { state: string; progress: number | null }

/** How far back the signal looks. */
export const WINDOW_MS = 15 * 60_000
/** Less history than this is too little to judge. */
export const MIN_HISTORY_MS = 10 * 60_000
/** Spend in the window that counts as real money going out. */
export const MIN_SPEND_USD = 1
/** Plan movement (0 to 1) under which the plan counts as stalled: 5 percentage points. */
export const MIN_MOVE = 0.05
/** A sample at most this often. */
export const SAMPLE_EVERY_MS = 30_000
/** Progress falling by more than this is a new plan: the history starts again. */
const NEW_PLAN_DROP = 0.2

/**
 * How far along a plan is, 0 to 1: a done step counts whole, a running step its own
 * progress. Fewer than two steps is no plan to judge, so null.
 */
export const planProgress = (steps: readonly Step[]): number | null => {
  if (steps.length < 2) return null
  const sum = steps.reduce((n, st) => n + (st.state === 'done' ? 1 : st.state === 'running' && typeof st.progress === 'number' ? Math.max(0, Math.min(1, st.progress)) : 0), 0)
  return sum / steps.length
}

/**
 * The samples with this one added, at most one per SAMPLE_EVERY_MS and none older than
 * the window needs. A cost or progress that went backwards (a new session, a new plan)
 * starts the history again.
 */
export const noteSample = (samples: readonly ProgressSample[], s: ProgressSample): ProgressSample[] => {
  const last = samples[samples.length - 1]
  if (last && (s.costUsd < last.costUsd || s.progress < last.progress - NEW_PLAN_DROP)) return [s]
  if (last && s.at - last.at < SAMPLE_EVERY_MS) return [...samples]
  // Keep one sample from before the window, so a full window can be measured.
  const kept = samples.filter(x => x.at >= s.at - WINDOW_MS - SAMPLE_EVERY_MS * 2)
  return [...kept, s]
}

/**
 * The signal, or null: the oldest sample inside the window against the newest. Needs
 * MIN_HISTORY_MS of history, MIN_SPEND_USD spent and less than MIN_MOVE of progress.
 * A finished plan (progress 1) never signals.
 */
export const stopSignal = (samples: readonly ProgressSample[], at: number): StopSignal | null => {
  const now = samples[samples.length - 1]
  if (!now || now.progress >= 1) return null
  const from = samples.find(x => x.at >= at - WINDOW_MS)
  if (!from || now.at - from.at < MIN_HISTORY_MS) return null
  const spentUsd = now.costUsd - from.costUsd
  const moved = now.progress - from.progress
  if (spentUsd < MIN_SPEND_USD || moved >= MIN_MOVE) return null
  return { spentUsd, moved: Math.max(0, moved), minutes: Math.round((now.at - from.at) / 60_000) }
}

/** The one line the Token Manager and the toast use. `money` formats dollars. */
export const stopText = (s: StopSignal, money: (usd: number) => string): string =>
  `Stop signal: ≈${money(s.spentUsd)} in ${s.minutes} min, plan moved ${Math.round(s.moved * 100)}%. Re-plan or stop?`
