import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { sansW } from './breakingbad-cards'
import { serifW } from './mentalist-cards'

// The slim band at the width of a real, narrow window: the title and the readouts stay, and no two texts overlap.
const NOW = Date.parse('2026-10-20T10:00:00Z')
const BAND = { hasSurvey: false, isWorking: true, maxRows: 14 } as const
const COLS: Record<number, number> = { 750: 106, 900: 126, 1250: 173 }

const base = (on: On, skin: string) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  mock.store(on, { skin })
  on('fs.exists', async () => ({ value: false }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('command.run', async () => ({ text: '' }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('audio.play', async () => ({ value: undefined }) as never)
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('prompt.submit', async (_$, e) => ({ text: (e as { text: string }).text }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 300_000 }, rateLimits: [] } }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
}
const band = async ($: Engine, skin: string, W: number): Promise<string> => {
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  if (skin === 'heisenberg') await $.command.run({ command: 'skin', args: 'heisenberg' } as never)
  await $.prompt.submit({ text: 'crack the case', cursor: 0 } as never)
  await $.tool.call({ tool: 'mcp__crab-progress__progress', title: 'Red-herring audit', total: 5, done: 1, phase: 'delegate', tasks: [{ title: 'Lead: run the case', tier: 'fable' }, { title: 'Researcher: map the API', tier: 'medium' }, { title: 'Engineer: wire the parser', tier: 'careful' }] } as never)
  for (const [i, d] of ['Lead: run the case', 'Researcher: map the API', 'Engineer: wire the parser'].entries()) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: d, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: false, fork: false } as never)
  const ui = await $.ui.mount({ plugin: 'crab-progress', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, bodyColumns: COLS[W] } as never })
  const all = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
  await ui.unmount()
  return all
}

type Box = { l: number; r: number; t: number; b: number; s: string }
/** Every drawn text as a box, from its x, anchor, size and letter-spacing and the theme's width model (2 px of tolerance each side). */
const boxes = (svg: string, w: (s: string, size: number, ls: number, bold: boolean) => number): Box[] => {
  const out: Box[] = []
  for (const m of svg.matchAll(/<text ([^>]*)>(.*?)<\/text>/gs)) {
    const at = (k: string) => new RegExp(`(?:^| )${k}="([^"]*)"`).exec(m[1] as string)?.[1]
    const x = Number(at('x'))
    const y = Number(at('y'))
    const size = Number(at('font-size') ?? 12)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const s = (m[2] as string).replace(/<title>.*?<\/title>/gs, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    if (!s.trim()) continue
    const width = w(s, size, Number(at('letter-spacing') ?? 0), at('font-weight') === '700')
    const anchor = at('text-anchor')
    const l = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
    out.push({ l: l + 2, r: l + width - 2, t: y - size * 0.75, b: y + size * 0.15, s })
  }
  return out
}

for (const [skin, serif] of [['mentalist', true], ['red-john', true], ['breaking-bad', false], ['heisenberg', false]] as const) {
  for (const W of [750, 900, 1250]) {
    test(`slim band ${skin} at ${W}: the title, the Tasks pill and the readouts stay; no two texts overlap`, async ($, on) => {
      base(on, skin === 'heisenberg' ? 'breaking-bad' : skin)
      const svg = await band($, skin, W)
      expect(svg).toContain('Red-herring audit')
      expect(svg).toContain('Tasks 1/5')
      expect(svg).toContain('>30%<') // the context readout (its short label at a narrow width)
      expect(svg).toMatch(/>\d\/\d</)
      expect(svg).toMatch(/>(CTX|CONTEXT)</)
      const bs = boxes(svg, (s, size, ls, bold) => (serif ? serifW(s, size, ls, bold) : sansW(s, size, ls, bold)))
      const hits: string[] = []
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i] as Box
        const b = bs[j] as Box
        if (a.s === b.s && a.l === b.l && a.t === b.t) continue // the glitch's ghost copy sits exactly on the title
        if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 3) hits.push(`${a.s} / ${b.s}`)
      }
      expect(hits).toEqual([])
    })
  }
}

test('slim band: the title is never animated away (the Mentalist glitch only flicks beside it)', async ($, on) => {
  base(on, 'mentalist')
  const svg = await band($, 'mentalist', 750)
  expect(svg).not.toContain('class="mx-ttl"')
  expect(svg).toContain('>Red-herring audit</text>')
})
