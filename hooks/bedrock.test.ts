// Bedrock and gateway ids: `us.`/`global.` ids and inference-profile ARNs carry the model's
// name and price as it; an application inference profile ARN has none and prices as the
// model `/tokens model` (or ANTHROPIC_DEFAULT_*_MODEL) maps it to, else Opus 5.5.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'crab-progress'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
const TURN: Usage = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 2e6, cache_creation_input_tokens: 1e6 }
const setup = (on: On, model: string, env: Record<string, string> = {}) => {
  mock.clock(on)
  mock.env(on, env)
  const kv = new Map<string, unknown>()
  on('store.get', async (_$, e) => ({ value: kv.get((e as { key: string }).key) }) as never)
  on('store.set', async (_$, e) => { kv.set((e as { key: string }).key, (e as { value: unknown }).value); return { value: undefined } as never })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model, agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('process.run', async () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }) as never)
}
const run = async ($: Engine, model: string) => {
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Priced work', subagentType: 'general-purpose', provider: 'engine', parentModel: model, background: false, fork: false } as never)
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: 'a1', reason: 'answer', answer: 'ok', usage: { model, ...TURN } })
}
const costs = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'crab-agents', props: pane })
  return (await ui.findAll({ type: 'Text' })).map(t => String(t.text ?? '')).filter(t => /≈\$/.test(t)).join(' | ')
}
const APP = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/a1b2c3d4e5f6'
const CASES: [string, string][] = [
  ['us.anthropic.claude-sonnet-5-5-20261001-v1:0', '$16.4'],
  ['global.anthropic.claude-opus-5-5-v1:0', '$32.4'],
  ['us.anthropic.claude-haiku-5-5-v1:0', '$0.82'],
  ['arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-sonnet-5-5-v1:0', '$16.4'],
  ['arn:aws:bedrock:eu-west-1:123456789012:inference-profile/eu.anthropic.claude-sonnet-4-6-v1:0', '$24.6'],
  [APP, '$32.4'], // unmapped: Opus 5.5 default
]
for (const [model, want] of CASES) {
  test(`bedrock: ${model} -> ${want}`, async ($, on) => {
    setup(on, model)
    await run($, model)
    const got = await costs($)
    expect(got).toContain(`≈${want} `)
  })
}
test('bedrock: /tokens model <APP ARN> sonnet then priced as Sonnet 5.5', async ($, on) => {
  setup(on, APP)
  const r = (await $.command.run({ command: 'tokens', args: `model ${APP} sonnet` } as never)) as { text?: string }
  expect(String(r.text)).toContain('Sonnet 5.5')
  await run($, APP)
  expect(await costs($)).toContain('≈$16.4 ')
  const list = (await $.command.run({ command: 'tokens', args: 'model' } as never)) as { text?: string }
  expect(String(list.text)).toContain('Sonnet 5.5')
})
test('bedrock: /tokens model <APP ARN uppercase-ish> haiku works case-insensitively', async ($, on) => {
  setup(on, APP)
  await $.command.run({ command: 'tokens', args: `model ${APP.toUpperCase()} haiku` } as never)
  await run($, APP)
  expect(await costs($)).toContain('≈$0.82 ')
})
test('bedrock: env ANTHROPIC_DEFAULT_SONNET_MODEL=<APP ARN> prices it as Sonnet', async ($, on) => {
  setup(on, APP, { ANTHROPIC_DEFAULT_SONNET_MODEL: APP })
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await run($, APP)
  expect(await costs($)).toContain('≈$16.4 ')
})
