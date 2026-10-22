import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

// One skin file in the person's folder, with a value that must not reach a drawing.
const FILES: Record<string, string> = {
  'sunset.json': JSON.stringify({ id: 'sunset', name: 'Sunset', colors: { accent: '#FF7A59', tile: '"/><script>' }, corners: 'chamfer' }),
  'broken.json': '{ not json',
}

const base = (on: On) => {
  mock.clock(on, { now: Date.parse('2026-10-19T10:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 100_000 }, rateLimits: [] } }) as never)
  on('session.cwd', async () => ({ value: '/repo' }) as never)
  on('fs.exists', async (_$, e) => ({ value: /Custom Claude Skins$|addons[\\/]cyberpunk[\\/]addon\.json$/.test(String((e as { path: string }).path)) }) as never)
  on('fs.list', async () => ({ value: Object.keys(FILES).map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0 })) }) as never)
  on('fs.read', async (_$, e) => {
    const path = JSON.stringify(e)
    return { value: Object.entries(FILES).find(([name]) => path.includes(name))?.[1] ?? '' } as never
  })
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}

const drawn = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('\n')
  await ui.unmount()
  return all
}

const run = async ($: Engine, args: string) => String(((await $.command.run({ command: 'skin', args } as never)) as { text?: string }).text)

test('/skin cyberpunk-2077 repaints Mission Control: neon, cut corners, scanlines', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  expect(await drawn($)).not.toContain('#FCEE0A')
  expect(await run($, 'cyberpunk-2077')).toContain('Skin: Cyberpunk 2077')
  const after = await drawn($)
  expect(after).toContain('#FCEE0A')
  expect(after).toContain('url(#scan)')
  expect(after).toMatch(/<path d="M[\d.]+ [\d.]+H[\d.]+V[\d.]+L/)
  expect(await run($, 'off')).toContain('Skin: Default')
  expect(await drawn($)).not.toContain('url(#scan)')
})

test('skins load from the folder; a bad value falls back and a broken file is skipped', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  const list = await run($, 'reload')
  expect(list).toContain('sunset')
  expect(list).toContain('Skipped: broken.json')
  await run($, 'sunset')
  const after = await drawn($)
  expect(after).toContain('#FF7A59')
  expect(after).not.toContain('<script>')
})

test('/skins opens a picker with every skin; Use puts one on', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.command.run({ command: 'skins', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-skins', props: pane })
  const alts = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt))
  for (const name of ['Default', 'Crab Classic', 'Cyberpunk 2077', 'Arasaka', 'Lucy · Edgerunners']) expect(alts.some(a => a.startsWith(name))).toBe(true)
  await ui.press((await ui.find({ key: 'wear-arasaka' })) as never)
  await ui.unmount()
  expect(await drawn($)).toContain('#E3001B')
})

test('chat: a skin draws tool rows with its verb and status; Default leaves them to the app', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await run($, 'cyberpunk-2077')
  const row = { tool_use_id: 't1', tool: 'Read', input: { file_path: '/repo/hooks/register.tsx' }, isRunning: false, isErrored: false, isInterrupted: false }
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'ToolUse', props: row as never })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String((t as { text?: string }).text ?? '')).join(' ')
  await ui.unmount()
  expect(texts).toContain('Scan')
  expect(texts).toContain('register.tsx')
  expect(texts).toContain('✓')
  await run($, 'off')
  // Default draws nothing of its own: the app's row stands.
  const passed = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'ToolUse', props: row as never }).then(
    () => 'drew',
    (err: unknown) => String(err),
  )
  expect(passed).toMatch(/engine drew its own|no implementation for ui.render/)
})

test('backdrop: a dark skin paints the whole pane behind the cards', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await run($, 'cyberpunk-2077')
  // The cards stack in plain flow (the desktop pane draws nothing under an absolute
  // overlay), so the backdrop is the column's own background.
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'Pane', requestId: 'crab-agents', props: pane })
  const boxes = await ui.findAll({ type: 'Box' })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  // The desktop drops an Svg whose alt is blank, which once collapsed the whole pane.
  expect(svgs.length).toBeGreaterThan(0)
  expect(svgs.filter(el => !String((el.props as { alt?: string }).alt ?? '').trim()).length).toBe(0)
  expect(boxes.some(b => (b.props as { backgroundColor?: string }).backgroundColor === '#050608')).toBe(true)
  expect(boxes.some(b => (b.props as { position?: string }).position === 'absolute')).toBe(false)
})
