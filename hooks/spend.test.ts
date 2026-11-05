import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import {
  CSV_HEADER,
  EXTRACT_AWK,
  TODAY_PERIOD,
  applyDelta,
  bucketRecords,
  cleanPeriod,
  combineDays,
  csvCell,
  csvName,
  daysIn,
  dedupe,
  detailRows,
  gapRows,
  isoLocal,
  lineSplitter,
  monthRange,
  monthsWithData,
  parseRecord,
  parseSpendArgs,
  periodLabel,
  projectOf,
  pruneDays,
  rangeOf,
  shiftDay,
  spendCsv,
  sumRange,
  weekOf,
} from './spend'
import type { SpendDays, SpendPeriod } from './spend'

// Spend over a period: the range math, the transcript lines, the ledger, the CSV, and
// /tokens spend and /tokens export through the engine.

const WORDS = {
  today: 'Today',
  week: 'This week',
  month: 'Month',
  custom: 'Custom',
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
// Local times, so the days are the same in every time zone the tests run in.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const p = (kind: SpendPeriod['kind'], more: Partial<SpendPeriod> = {}): SpendPeriod => ({ ...TODAY_PERIOD, kind, ...more })

test('week: the calendar week, Monday to Sunday, not the last seven days', () => {
  // Friday 6 Nov 2026.
  expect(weekOf(at(2026, 11, 6))).toEqual({ from: '2026-11-02', to: '2026-11-08' })
  // Monday itself is the first day, and 00:00 sharp is still Monday's.
  expect(weekOf(at(2026, 11, 2, 0, 0))).toEqual({ from: '2026-11-02', to: '2026-11-08' })
  // Sunday night still belongs to the week that began on Monday.
  expect(weekOf(at(2026, 11, 8, 23, 59))).toEqual({ from: '2026-11-02', to: '2026-11-08' })
  // Monday just after midnight starts the next one.
  expect(weekOf(at(2026, 11, 9, 0, 1))).toEqual({ from: '2026-11-09', to: '2026-11-15' })
  // Across a year end, and a leap day.
  expect(weekOf(at(2026, 12, 31))).toEqual({ from: '2026-12-28', to: '2027-01-03' })
  expect(weekOf(at(2028, 3, 1))).toEqual({ from: '2028-02-28', to: '2028-03-05' })
})

test('week: every day of two years sits in a Monday-to-Sunday week of seven days, DST or not', () => {
  for (const y of [2026, 2027]) {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
        for (const h of [0, 1, 3, 12, 23]) {
          const w = weekOf(at(y, m, d, h, 30))
          expect(daysIn(w.from, w.to)).toBe(7)
          expect(new Date(`${w.from}T12:00:00`).getDay()).toBe(1)
          expect(w.from <= `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` && `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` <= w.to).toBe(true)
        }
      }
    }
  }
})

test('month: one calendar month, its first day to its last', () => {
  expect(monthRange('2026-06')).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  // No month picked: the current one.
  expect(rangeOf(p('month'), at(2026, 11, 6))).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  // June 2026 is June only, whatever today is.
  expect(rangeOf(p('month', { month: '2026-06' }), at(2026, 11, 6))).toEqual({ from: '2026-06-01', to: '2026-06-30' })
})

test('custom: inclusive local days, in order whichever way they were given', () => {
  expect(rangeOf(p('custom', { from: '2026-10-01', to: '2026-10-15' }), at(2026, 11, 6))).toEqual({ from: '2026-10-01', to: '2026-10-15' })
  expect(rangeOf(p('custom', { from: '2026-10-15', to: '2026-10-01' }), at(2026, 11, 6))).toEqual({ from: '2026-10-01', to: '2026-10-15' })
  expect(daysIn('2026-10-01', '2026-10-15')).toBe(15)
  expect(daysIn('2026-10-05', '2026-10-05')).toBe(1)
  // Across the days the clocks change.
  expect(daysIn('2026-03-01', '2026-04-01')).toBe(32)
  expect(daysIn('2026-10-01', '2026-11-30')).toBe(61)
  expect(rangeOf(TODAY_PERIOD, at(2026, 11, 6))).toEqual({ from: '2026-11-06', to: '2026-11-06' })
  expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
})

test('labels: short, and only as long as they need to be', () => {
  const now = at(2026, 11, 6)
  expect(periodLabel(TODAY_PERIOD, now, WORDS)).toBe('Today · 6 Nov')
  expect(periodLabel(p('week'), now, WORDS)).toBe('This week · 2–8 Nov')
  expect(periodLabel(p('week'), at(2026, 10, 30), WORDS)).toBe('This week · 26 Oct – 1 Nov')
  expect(periodLabel(p('month', { month: '2026-06' }), now, WORDS)).toBe('June 2026')
  expect(periodLabel(p('custom', { from: '2026-10-01', to: '2026-10-15' }), now, WORDS)).toBe('1–15 Oct')
  expect(periodLabel(p('custom', { from: '2025-12-20', to: '2026-01-05' }), now, WORDS)).toBe('20 Dec 2025 – 5 Jan 2026')
})

test('sums: only the days in the range; today counts once, the larger of the two counts', () => {
  const days: SpendDays = { '2026-10-31': [9, 900], '2026-11-02': [1, 100], '2026-11-05': [2, 200], '2026-11-06': [3, 300], '2026-11-09': [7, 700] }
  expect(sumRange(days, '2026-11-02', '2026-11-08')).toEqual({ cost: 6, tokens: 600 })
  // The session counted more today than the transcripts have yet: its count stands.
  expect(sumRange(days, '2026-11-02', '2026-11-08', { date: '2026-11-06', cost: 5, tokens: 250 })).toEqual({ cost: 8, tokens: 600 })
  // A live day outside the range is not added.
  expect(sumRange(days, '2026-10-01', '2026-10-31', { date: '2026-11-06', cost: 5, tokens: 250 })).toEqual({ cost: 9, tokens: 900 })
  // The transcripts' ledger and the sessions' log: a day takes the larger of the two.
  expect(combineDays({ a: [1, 10], b: [5, 5] } as never, { a: [3, 2], c: [1, 1] } as never)).toEqual({ a: [3, 10], b: [5, 5], c: [1, 1] })
})

test('transcript lines: one record each, a cut line kept for the next piece', () => {
  const line = 'p/a.jsonl\tmsg_1\tclaude-opus-5-5\t2026-10-20T09:00:00.000Z\t10\t20\t30\t40'
  const r = parseRecord(line)
  expect(r).toEqual({ file: 'p/a.jsonl', id: 'msg_1', model: 'claude-opus-5-5', at: Date.parse('2026-10-20T09:00:00.000Z'), input: 10, output: 20, cacheWrite: 30, cacheRead: 40 })
  expect(parseRecord('p/a.jsonl\tmsg_1\tclaude')).toBeNull()
  expect(parseRecord('p/a.jsonl\tmsg_1\tm\tnot a time\t1\t1\t1\t1')).toBeNull()
  expect(parseRecord('p/a.jsonl\tmsg_1\tm\t2026-10-20T09:00:00.000Z\t-1\t1\t1\t1')).toBeNull()
  const split = lineSplitter()
  expect(split(line.slice(0, 20))).toEqual([])
  expect(split(`${line.slice(20)}\n${line.slice(0, 5)}`)).toEqual([line])
  expect(split('', true)).toEqual([line.slice(0, 5)])
  expect(projectOf('./-Users-me-proj/abc/subagents/agent-1.jsonl')).toBe('-Users-me-proj')
  expect(EXTRACT_AWK).toContain('usage')
})

const rec = (file: string, id: string, iso: string, input = 1000) => parseRecord(`${file}\t${id}\tclaude-opus-5-5\t${iso}\t${input}\t0\t0\t0`)
const recs = (...r: ReturnType<typeof rec>[]) => r.filter(x => x !== null)

test('dedupe: each message once, even when a second transcript carries a copy', () => {
  const records = recs(rec('a', 'm1', '2026-10-20T09:00:00Z'), rec('a', 'm2', '2026-10-20T09:05:00Z'), rec('b', 'm1', '2026-10-20T09:00:00Z'))
  const first = dedupe(records)
  expect(first.kept.map(r => `${r.file}:${r.id}`)).toEqual(['a:m1', 'a:m2'])
  const byFile = bucketRecords(first.kept, () => 0.5)
  const day = Object.keys(byFile.get('a') ?? {})[0] ?? ''
  expect(byFile.get('a')?.[day]).toEqual([1, 2000])
  expect(byFile.has('b')).toBe(false)
  // The copy read alone later (it grew) is still left out; the original read alone still counts.
  expect(dedupe(recs(rec('b', 'm1', '2026-10-20T09:00:00Z'), rec('b', 'm9', '2026-10-20T09:09:00Z')), first.dupes).kept.map(r => r.id)).toEqual(['m9'])
  expect(dedupe(recs(rec('a', 'm1', '2026-10-20T09:00:00Z')), first.dupes).kept.map(r => r.id)).toEqual(['m1'])
  // A message with no tokens at all is not a line of spend.
  expect(bucketRecords(recs(rec('a', 'z', '2026-10-20T09:00:00Z', 0)), () => 1).size).toBe(0)
})

test('buckets: a message belongs to the local day it was sent on', () => {
  const local = (h: number) => new Date(2026, 9, 20, h, 30).toISOString()
  const byFile = bucketRecords(recs(rec('a', 'e', local(0)), rec('a', 'l', local(23))), () => 1)
  expect(Object.keys(byFile.get('a') ?? {})).toEqual(['2026-10-20'])
  expect(byFile.get('a')?.['2026-10-20']).toEqual([2, 2000])
})

test('ledger: a file read again swaps its old share for the new; old days are dropped after 13 months', () => {
  let ledger: SpendDays = { '2026-10-20': [5, 500] }
  ledger = applyDelta(ledger, {}, { '2026-10-20': [1, 100], '2026-10-21': [2, 200] })
  expect(ledger).toEqual({ '2026-10-20': [6, 600], '2026-10-21': [2, 200] })
  ledger = applyDelta(ledger, { '2026-10-20': [1, 100], '2026-10-21': [2, 200] }, { '2026-10-20': [1, 100], '2026-10-21': [3, 300] })
  expect(ledger).toEqual({ '2026-10-20': [6, 600], '2026-10-21': [3, 300] })
  expect(Object.keys(pruneDays({ '2025-09-30': [1, 1], '2025-10-01': [1, 1], '2026-11-06': [1, 1] }, at(2026, 11, 6)))).toEqual(['2025-10-01', '2026-11-06'])
  expect(monthsWithData({ '2026-06-03': [1, 1], '2026-09-01': [1, 1] }, at(2026, 11, 6))).toEqual(['2026-11', '2026-09', '2026-06'])
})

test('/tokens spend words: periods, and a plain reason for a bad one', () => {
  expect(parseSpendArgs([])).toEqual({})
  expect(parseSpendArgs(['week']).period?.kind).toBe('week')
  expect(parseSpendArgs(['month']).period).toEqual(p('month'))
  expect(parseSpendArgs(['month', '2026-06']).period).toEqual(p('month', { month: '2026-06' }))
  expect(parseSpendArgs(['2026-10-15', '2026-10-01']).period).toEqual(p('custom', { from: '2026-10-01', to: '2026-10-15' }))
  expect(parseSpendArgs(['month', '2026-13']).error).toContain('not a month')
  expect(parseSpendArgs(['2026-02-30', '2026-03-01']).error).toContain('not a date')
  expect(parseSpendArgs(['2026-10-01']).error).toContain('last day')
  expect(parseSpendArgs(['fortnight']).error).toContain('Unknown period')
  expect(parseSpendArgs(['week', 'x']).error).toContain('this week')
  expect(cleanPeriod({ kind: 'custom', from: 'x', to: '2026-10-01' })).toEqual(TODAY_PERIOD)
})

test('csv: FOCUS-style columns, one line a day, model and project; a day runs midnight to midnight', () => {
  const rows = detailRows(
    recs(rec('./-Users-me-api/s.jsonl', 'm1', new Date(2026, 9, 20, 9).toISOString()), rec('./-Users-me-api/s.jsonl', 'm2', new Date(2026, 9, 20, 10).toISOString(), 500), rec('./-Users-me-web/t.jsonl', 'm3', new Date(2026, 9, 21, 9).toISOString()), rec('./x/u.jsonl', 'm4', new Date(2026, 8, 1, 9).toISOString())),
    () => 0.25,
    '2026-10-01',
    '2026-10-31',
  )
  const csv = spendCsv(rows).split('\n')
  expect(csv[0]).toBe(CSV_HEADER.join(','))
  expect(csv).toHaveLength(4)
  const cells = (csv[1] ?? '').split(',')
  expect(cells[0]).toBe(isoLocal('2026-10-20'))
  expect(cells[1]).toBe(isoLocal('2026-10-21'))
  expect(cells.slice(2)).toEqual(['0.5', 'USD', 'claude-opus-5-5', '1500', 'tokens', '-Users-me-api'])
  // The day after the last one ends the last line's period; nothing outside the range is written.
  expect(csv.some(l => l.includes('2026-09-01'))).toBe(false)
  expect(csvCell('a,b "c"')).toBe('"a,b ""c"""')
  expect(csvName('2026-10-01', '2026-10-31')).toBe('mission-control-spend-2026-10-01-2026-10-31.csv')
})

test('csv: what the transcripts no longer hold is one "unattributed" line a day, so the file adds up', () => {
  const rows = [{ day: '2026-10-20', model: 'claude-opus-5-5', project: 'p', cost: 1, tokens: 1000 }]
  const ledger: SpendDays = { '2026-10-20': [1.001, 1200], '2026-10-10': [3, 30_000], '2026-09-01': [9, 9] }
  expect(gapRows(rows, ledger, '2026-10-01', '2026-10-31')).toEqual([{ day: '2026-10-10', model: 'unattributed', project: '', cost: 3, tokens: 30_000 }])
})

test('csv: each day starts at its own local midnight, so a 23- or 25-hour day is still one line', () => {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const day = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      expect(Date.parse(isoLocal(day))).toBe(new Date(2026, m - 1, d).getTime())
      const hours = (Date.parse(isoLocal(shiftDay(day, 1))) - Date.parse(isoLocal(day))) / 3_600_000
      expect(hours >= 23 && hours <= 25).toBe(true)
    }
  }
})

// --- through the engine -------------------------------------------------------------

const base = (on: On, store: Record<string, unknown> = {}, env: Record<string, string> = { LANG: 'en_US.UTF-8' }) => {
  mock.clock(on, { now: new Date(2026, 9, 20, 12).getTime() })
  mock.env(on, env)
  mock.store(on, store)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 1000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const spendCmd = async ($: Engine, command: string, args: string) => String(((await $.command.run({ command, args } as never)) as { text?: string }).text)

test('/tokens spend: a custom range sums the kept ledger and the card follows it', async ($, on) => {
  base(on, { spendDays: { '2026-10-01': [1.5, 1_000_000], '2026-10-15': [2.5, 2_000_000], '2026-10-16': [9, 9_000_000] } })
  on('fs.exists', async () => ({ value: false }) as never)
  await start($)
  expect((await spendCmd($, 'tokens', 'spend 2026-10-01 2026-10-15')).startsWith('1–15 Oct: ≈$4.00 · 3.0M tokens')).toBe(true)
  // No words: the period kept.
  expect((await spendCmd($, 'tokens', 'spend')).startsWith('1–15 Oct: ≈$4.00')).toBe(true)
  expect((await spendCmd($, 'tokens', 'spend month 2026-10')).startsWith('October 2026: ≈$13.0 · 12.0M tokens')).toBe(true)
  expect(await spendCmd($, 'tokens', 'spend month 2026-13')).toContain('not a month')
  expect(await spendCmd($, 'tokens', 'spend 2026-02-30 2026-03-01')).toContain('not a date')
  expect(await spendCmd($, 'tokens', 'nonsense')).toContain('/tokens spend today|week|month')
})

// A projects folder with one session, and awk answering with these lines.
const history = (on: On, lines: string) => {
  on('fs.exists', async (_$, e) => ({ value: String((e as { path: string }).path) === '/home/me/.claude/projects' }) as never)
  on('fs.list', async (_$, e) => {
    const path = String((e as { path?: string }).path)
    const value = path === '/home/me/.claude/projects' ? [{ name: 'proj', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] : [{ name: 's.jsonl', kind: 'file', size: 100, mtimeMs: new Date(2026, 9, 20, 9).getTime(), isLink: false }]
    return { value } as never
  })
  on('process.spawn', async function* () {
    yield { stream: 'stdout', text: lines }
    return { code: 0, signal: null }
  } as never)
}
const when = new Date(2026, 9, 20, 9).toISOString()

test('backfill: transcripts are read after the start and counted into the ledger', async ($, on) => {
  base(on, {}, { LANG: 'en_US.UTF-8', HOME: '/home/me' })
  // 1M input tokens on Opus 5.5: $4.00; the copy on the next line is the same message.
  const line = `./proj/s.jsonl\tmsg_1\tclaude-opus-5-5\t${when}\t1000000\t0\t0\t0\n`
  history(on, line + line)
  await start($)
  let text = ''
  for (let i = 0; i < 50 && !text.includes('$4.00'); i++) text = await spendCmd($, 'tokens', 'spend today')
  expect(text).toContain('≈$4.00 · 1.0M tokens')
})

test('/tokens export: the period as a CSV in Downloads, the path said', async ($, on) => {
  base(on, {}, { LANG: 'en_US.UTF-8', HOME: '/home/me' })
  history(on, `./proj/s.jsonl\tmsg_1\tclaude-opus-5-5\t${when}\t1000000\t0\t0\t0\n`)
  const written: { path: string; text: string }[] = []
  on('fs.write', async (_$, e) => {
    written.push({ path: String((e as { path: string }).path), text: String((e as { text: string }).text) })
    return { value: undefined } as never
  })
  await start($)
  const said = await spendCmd($, 'tokens', 'export 2026-10-01 2026-10-31')
  expect(said).toContain('/home/me/Downloads/mission-control-spend-2026-10-01-2026-10-31.csv')
  expect(written).toHaveLength(1)
  expect(written[0]?.text).toContain('ChargePeriodStart,ChargePeriodEnd,BilledCost,PricingCurrency,ResourceName,ConsumedQuantity,ConsumedUnit,x_Project')
  expect(written[0]?.text).toContain(',4,USD,claude-opus-5-5,1000000,tokens,proj\n')
  expect(await spendCmd($, 'tokens', 'export 2026-13-01 2026-10-31')).toContain('not a date')
})
