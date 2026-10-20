import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const base = (on: On) => {
  mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}

const start = async ($: Engine, skin = 'cyberpunk-2077') => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skin', args: skin } as never)
}

test('an Edit row carries a diff card with its counts', async ($, on) => {
  base(on)
  await start($)
  const row = {
    tool_use_id: 't1',
    tool: 'Edit',
    input: { file_path: '/repo/a.ts', old_string: 'const a = 1\nconst b = 2', new_string: 'const a = 1\nconst b = 3\nconst c = 4' },
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
  }
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'ToolUse', props: row as never })
  const code = await ui.find({ type: 'Code' })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? '')).join(' ')
  await ui.unmount()
  expect(code?.props.format).toBe('diff')
  expect(String(code?.props.source)).toContain('+const c = 4')
  expect(texts).toContain('+2')
  expect(texts).toContain('−1')
})

test('a reply with code, a table, a chart and math draws its blocks as cards', async ($, on) => {
  base(on)
  await start($)
  const text = [
    'Here is the plan, with area $\\pi r^2$.',
    '```ts',
    'const x = 1',
    'const y = 2',
    '```',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '```mermaid',
    'graph LR',
    'A[Plan] --> B[Build]',
    '```',
    '$$\\alpha + \\beta$$',
  ].join('\n')
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AssistantMessage', props: { text, isFirstOfReply: true } as never, viewport: { columns: 90, rows: 40 } } as never)
  const code = await ui.findAll({ type: 'Code' })
  const svgs = await ui.findAll({ type: 'Svg' })
  const md = (await ui.findAll({ type: 'Markdown' })).map(m => String(m.props.text)).join('\n')
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? '')).join(' ')
  await ui.unmount()
  expect(code.length).toBe(1)
  expect(code[0]?.props.startLine).toBe(1)
  expect(svgs.length).toBe(1)
  expect(String(svgs[0]?.props.source)).toContain('Build')
  expect(md).toContain('π r²')
  expect(texts).toContain('α + β')
  expect(texts).toContain('2 lines')
})

test('a plain reply is left to the app', async ($, on) => {
  base(on)
  await start($)
  const drew = await $.ui
    .mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AssistantMessage', props: { text: 'Just words, nothing else.', isFirstOfReply: true } as never })
    .then(
      () => 'drew',
      (err: unknown) => String(err),
    )
  expect(drew).toMatch(/engine drew its own|no implementation for ui.render/)
})
