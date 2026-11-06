// The Money settings: typed amounts (in the shown currency, back to dollars), and
// `/tokens budget` with no amount leaving the budget be.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const toasts: string[] = []
// The store in memory, written out here (not mock.store) so a test can look inside it.
const kv = new Map<string, unknown>()
const base = (on: On, store: Record<string, unknown>) => {
  toasts.length = 0
  mock.clock(on, { now: new Date(2026, 9, 20, 12).getTime() })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  kv.clear()
  for (const [k, v] of Object.entries(store)) kv.set(k, v)
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
  on('settings.read', async () => ({ value: {} }) as never)
  on('fs.exists', async () => ({ value: false }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 1000 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
const pane = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const mountSettings = ($: Engine) => $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-settings', props: pane })
const cmd = async ($: Engine, args: string) => String(((await $.command.run({ command: 'tokens', args } as never)) as { text?: string }).text)

test('typed daily cap: garbage is refused and keeps the cap; a decimal comma and "off" are read', async ($, on) => {
  base(on, { dailyUsd: 2 })
  await start($)
  const ui = await mountSettings($)
  for (const bad of ['abc', '-5', '1e3', '3abc']) {
    await ui.input({ key: 'set-daily-type', text: bad })
    expect(kv.get('dailyUsd')).toBe(2)
  }
  expect(toasts.filter(t => t.includes('Type an amount')).length).toBe(4)
  await ui.input({ key: 'set-daily-type', text: '2,50' })
  expect(kv.get('dailyUsd')).toBe(2.5)
  await ui.input({ key: 'set-daily-type', text: 'off' })
  expect(kv.get('dailyUsd')).toBe(0)
})

test('typed budget in ringgit: kept in dollars, and the dropdown shows it back as typed', async ($, on) => {
  base(on, { currency: { code: 'MYR', rate: 4.4 } })
  await start($)
  const ui = await mountSettings($)
  await ui.input({ key: 'set-budget-type', text: 'RM3' })
  expect(kv.get('budgetUsd')).toBe(0.6818)
  const pick = await ui.find({ key: 'set-budget-pick' })
  const options = (pick?.props.options ?? []) as { value: string; label: string }[]
  expect(pick?.props.value).toBe('0.6818')
  expect(options.find(o => o.value === '0.6818')?.label).toBe('RM3.00')
})

test('/tokens budget with no amount says it and leaves it be', async ($, on) => {
  base(on, {})
  await start($)
  await cmd($, 'budget 2')
  expect(await cmd($, 'budget')).toContain('Now: $2.00 per task')
  expect(kv.get('budgetUsd')).toBe(2)
})
