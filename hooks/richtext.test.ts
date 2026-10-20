import { expect, test } from 'claude-code/testing'
import { hasInlineMath, inlineMath, mermaidChart, splitBlocks, texToUnicode, unifiedDiff } from './richtext'

const palette = { font: 'sans-serif', tile: '#000', text: '#fff', subtext: '#aaa', line: '#333', accent: '#ff0', colors: ['#ff0', '#0ff', '#f0c'], chamfer: true }

test('diff: one hunk with the shared lines as context and the counts', () => {
  const d = unifiedDiff('a\nb\nc\nd\ne', 'a\nb\nX\nY\nd\ne')
  expect(d.added).toBe(2)
  expect(d.removed).toBe(1)
  expect(d.source).toBe('@@ -1,5 +1,6 @@\n a\n b\n-c\n+X\n+Y\n d\n e')
})

test('blocks: fences, mermaid, math and tables come apart from prose', () => {
  const md = 'Intro\n\n```ts\nconst x = 1\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n$$\\frac{1}{2}$$\n\n```mermaid\ngraph TD\nA-->B\n```\nEnd'
  expect(splitBlocks(md).map(b => b.kind)).toEqual(['md', 'code', 'table', 'math', 'mermaid', 'md'])
})

test('blocks: an open fence of a streaming reply stays prose', () => {
  expect(splitBlocks('Hi\n```ts\nconst x').map(b => b.kind)).toEqual(['md'])
})

test('math: LaTeX reads as Unicode', () => {
  expect(texToUnicode(String.raw`\alpha^2 + \beta_1 \leq \sqrt{x}`)).toBe('α² + β₁ ≤ √x')
  expect(texToUnicode(String.raw`\sum_{i=1}^{n} x_i`)).toBe('∑ᵢ₌₁ⁿ xᵢ')
  expect(texToUnicode(String.raw`\frac{a+b}{2}`)).toBe('(a+b)⁄2')
  expect(texToUnicode(String.raw`x \in \mathbb{R}`)).toBe('x ∈ ℝ')
})

test('inline math converts, money does not', () => {
  expect(inlineMath(String.raw`area is $\pi r^2$ here`)).toBe('area is π r² here')
  expect(hasInlineMath('costs $5 and $10 today')).toBe(false)
})

test('mermaid: a flowchart and a pie draw; an unknown diagram does not', () => {
  const flow = mermaidChart('graph TD\nA[Start] --> B{Ready?}\nB -->|yes| C(Ship)\nB -.-> D[Wait]', 500, palette)
  expect(flow?.svg).toContain('Start')
  expect(flow?.svg).toContain('Ready?')
  expect(flow?.svg).toContain('yes')
  const lr = mermaidChart('flowchart LR\nA --> B --> C', 500, palette)
  expect(lr?.svg.match(/marker-end/g)?.length).toBe(2)
  const p = mermaidChart('pie title Pets\n"Dogs" : 3\n"Cats" : 1', 500, palette)
  expect(p?.svg).toContain('75%')
  expect(mermaidChart('sequenceDiagram\nA->>B: hi', 500, palette)).toBeNull()
})
