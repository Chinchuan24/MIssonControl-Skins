// Rich chat blocks for the skins: edit diffs, a reply split into its fences,
// tables and math, LaTeX as Unicode, and Mermaid flowcharts and pies as SVG.
// Pure functions: no engine calls, so they are tested on their own.

// ---------------------------------------------------------------------------
// Edit diffs: one unified hunk from an edit's old and new text, the lines both
// share at the ends kept as context.

export type Diff = { source: string; added: number; removed: number }

export const unifiedDiff = (oldText: string, newText: string, context = 2): Diff => {
  const a = oldText.split(/\r?\n/)
  const b = newText.split(/\r?\n/)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const pre = a.slice(Math.max(0, head - context), head)
  const removed = a.slice(head, a.length - tail)
  const added = b.slice(head, b.length - tail)
  const post = a.slice(a.length - tail, a.length - tail + context)
  const start = head - pre.length + 1
  const lines = [...pre.map(l => ` ${l}`), ...removed.map(l => `-${l}`), ...added.map(l => `+${l}`), ...post.map(l => ` ${l}`)]
  const oldCount = pre.length + removed.length + post.length
  const newCount = pre.length + added.length + post.length
  return {
    source: `@@ -${start},${oldCount} +${start},${newCount} @@\n${lines.join('\n')}`,
    added: added.length,
    removed: removed.length,
  }
}

// ---------------------------------------------------------------------------
// A reply, split into the blocks the skins draw themselves.

export type Block =
  | { kind: 'md'; text: string }
  | { kind: 'code'; text: string; lang: string }
  | { kind: 'mermaid'; text: string }
  | { kind: 'math'; text: string }
  | { kind: 'table'; text: string }

const isTableRow = (l: string): boolean => /^\s*\|.*\|\s*$/.test(l)
const isTableRule = (l: string): boolean => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l)

export const splitBlocks = (text: string): Block[] => {
  const out: Block[] = []
  const lines = text.split(/\r?\n/)
  let md: string[] = []
  const flush = () => {
    if (md.join('').trim()) out.push({ kind: 'md', text: md.join('\n') })
    md = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const fence = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/.exec(line)
    if (fence) {
      const mark = fence[2] ?? '```'
      const lang = (fence[3] ?? '').toLowerCase()
      const body: string[] = []
      let j = i + 1
      while (j < lines.length && !(lines[j] ?? '').trim().startsWith(mark)) body.push(lines[j++] ?? '')
      if (j >= lines.length) {
        // An open fence (a reply still streaming) stays markdown.
        md.push(line)
        continue
      }
      flush()
      out.push(lang === 'mermaid' ? { kind: 'mermaid', text: body.join('\n') } : lang === 'math' || lang === 'latex' || lang === 'tex' ? { kind: 'math', text: body.join('\n') } : { kind: 'code', text: body.join('\n'), lang })
      i = j
      continue
    }
    if (line.trim().startsWith('$$')) {
      const body: string[] = []
      const first = line.trim().slice(2)
      if (first.endsWith('$$') && first.length > 2) {
        flush()
        out.push({ kind: 'math', text: first.slice(0, -2) })
        continue
      }
      if (first) body.push(first)
      let j = i + 1
      while (j < lines.length && !(lines[j] ?? '').includes('$$')) body.push(lines[j++] ?? '')
      if (j < lines.length) {
        const last = (lines[j] ?? '').replace('$$', '').trim()
        if (last) body.push(last)
        flush()
        out.push({ kind: 'math', text: body.join('\n') })
        i = j
        continue
      }
    }
    if (isTableRow(line) && isTableRule(lines[i + 1] ?? '')) {
      flush()
      const rows = [line]
      let j = i + 1
      while (j < lines.length && (isTableRow(lines[j] ?? '') || isTableRule(lines[j] ?? ''))) rows.push(lines[j++] ?? '')
      out.push({ kind: 'table', text: rows.join('\n') })
      i = j - 1
      continue
    }
    md.push(line)
  }
  flush()
  return out
}

// ---------------------------------------------------------------------------
// LaTeX as Unicode: Greek, operators, arrows, sub- and superscripts, fractions
// and roots, so a formula reads as one in plain text.

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  sum: '∑', prod: '∏', int: '∫', oint: '∮', infty: '∞', partial: '∂', nabla: '∇', sqrt: '√',
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', propto: '∝',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', iff: '⇔', implies: '⇒', mapsto: '↦',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨',
  ldots: '…', cdots: '⋯', dots: '…', circ: '∘', degree: '°', angle: '∠', perp: '⊥', parallel: '∥', hbar: 'ℏ', ell: 'ℓ',
  quad: '  ', qquad: '    ', ',': ' ', ';': ' ', '!': '', left: '', right: '', displaystyle: '', limits: '',
}
const BLACKBOARD: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ' }
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', T: 'ᵀ',
}
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
}

// The group after a script mark: `{...}` or one character.
const takeGroup = (s: string, at: number): [string, number] => {
  if (s[at] !== '{') return [s[at] ?? '', at + 1]
  let depth = 0
  for (let i = at; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) return [s.slice(at + 1, i), i + 1]
  }
  return [s.slice(at + 1), s.length]
}

const script = (text: string, table: Record<string, string>, mark: string): string => {
  const plain = texToUnicode(text)
  return [...plain].every(ch => table[ch]) ? [...plain].map(ch => table[ch]).join('') : `${mark}(${plain})`
}

export const texToUnicode = (src: string): string => {
  let s = src
  // Fractions and roots first: their groups may hold anything.
  for (let guard = 0; guard < 20 && /\\(d|t)?frac\s*\{/.test(s); guard++) {
    s = s.replace(/\\(?:d|t)?frac\s*/, '\u0000')
    const at = s.indexOf('\u0000')
    const [num, i1] = takeGroup(s, at + 1)
    const [den, i2] = takeGroup(s, i1)
    const wrap = (x: string) => (/^[\w.αβγδθλμπσφω∞]+$/.test(texToUnicode(x)) ? texToUnicode(x) : `(${texToUnicode(x)})`)
    s = s.slice(0, at) + `${wrap(num)}⁄${wrap(den)}` + s.slice(i2)
  }
  for (let guard = 0; guard < 20 && /\\sqrt\s*\{/.test(s); guard++) {
    s = s.replace(/\\sqrt\s*/, '\u0000')
    const at = s.indexOf('\u0000')
    const [body, end] = takeGroup(s, at + 1)
    const inner = texToUnicode(body)
    s = s.slice(0, at) + (inner.length === 1 ? `√${inner}` : `√(${inner})`) + s.slice(end)
  }
  s = s.replace(/\\mathbb\s*\{(\w)\}/g, (_, ch: string) => BLACKBOARD[ch] ?? ch)
  s = s.replace(/\\(?:mathrm|mathbf|mathit|text|textbf|operatorname)\s*\{([^{}]*)\}/g, '$1')
  s = s.replace(/\\([A-Za-z]+|[,;!])/g, (all, name: string) => (name in SYMBOLS ? (SYMBOLS[name] ?? '') : all))
  let out = ''
  for (let i = 0; i < s.length; ) {
    const ch = s[i]
    if (ch === '^' || ch === '_') {
      const [group, next] = takeGroup(s, i + 1)
      out += script(group, ch === '^' ? SUP : SUB, ch)
      i = next
      continue
    }
    if (ch === '{' || ch === '}') {
      i++
      continue
    }
    out += ch
    i++
  }
  return out.replace(/[ \t]+/g, ' ').trim()
}

// Inline `$...$` in prose becomes Unicode; a `$` that reads as money is left alone.
export const inlineMath = (md: string): string =>
  md.replace(/(^|[^$\\\w])\$(?!\s)([^$\n]{1,200}?)(?<!\s)\$(?!\d)/g, (all, lead: string, body: string) =>
    /[\\^_{}]|^[A-Za-z]$/.test(body) ? `${lead}${texToUnicode(body)}` : all,
  )

export const hasInlineMath = (md: string): boolean => inlineMath(md) !== md

// ---------------------------------------------------------------------------
// Mermaid, drawn: flowcharts (graph / flowchart, any direction) and pies. Any
// other diagram returns null and is shown as code.

export type ChartPalette = {
  font: string
  tile: string
  text: string
  subtext: string
  line: string
  accent: string
  colors: string[]
  chamfer: boolean
}

export type Chart = { svg: string; height: number }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const textW = (s: string, size: number): number => [...s].length * size * 0.56

type Node = { id: string; label: string; shape: 'box' | 'round' | 'diamond' | 'circle' }
type Edge = { from: string; to: string; label: string; dashed: boolean }

const NODE_RE = /^([A-Za-z0-9_\-]+)\s*(?:(\(\(|\(\[|\[\[|\[\(|\{\{|\[|\(|\{|>)(.*?)(\)\)|\]\)|\]\]|\)\]|\}\}|\]|\)|\}))?\s*$/
const ARROW_RE = /\s*(-\.->|-\.-|==>|-->|---|--\s*[^->|]+?\s*-->)\s*(?:\|([^|]*)\|)?\s*/

const parseNode = (token: string, nodes: Map<string, Node>): string | null => {
  const m = NODE_RE.exec(token.trim())
  if (!m) return null
  const id = m[1] ?? ''
  const open = m[2] ?? ''
  const label = (m[3] ?? '').replace(/^["']|["']$/g, '').trim()
  const shape: Node['shape'] = open === '{' || open === '{{' ? 'diamond' : open === '((' ? 'circle' : open === '(' || open === '([' ? 'round' : 'box'
  const known = nodes.get(id)
  if (!known || (label && known.label === known.id)) nodes.set(id, { id, label: label || known?.label || id, shape: open ? shape : known?.shape ?? 'box' })
  return id
}

const flowchart = (src: string, W: number, p: ChartPalette): Chart | null => {
  const lines = src.split(/\n|;/).map(l => l.trim()).filter(l => l && !l.startsWith('%%'))
  const head = /^(graph|flowchart)\s*(TD|TB|BT|LR|RL)?/i.exec(lines[0] ?? '')
  if (!head) return null
  const dir = (head[2] ?? 'TD').toUpperCase()
  const isAcross = dir === 'LR' || dir === 'RL'
  const nodes = new Map<string, Node>()
  const edges: Edge[] = []
  for (const line of lines.slice(1)) {
    if (/^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/.test(line)) continue
    const parts = line.split(ARROW_RE)
    // parts: node, arrow, label, node, arrow, label, node...
    let prev = parseNode(parts[0] ?? '', nodes)
    for (let i = 1; i + 2 < parts.length; i += 3) {
      const arrow = parts[i] ?? ''
      const inline = /--\s*([^->|]+?)\s*-->/.exec(arrow)?.[1] ?? ''
      const label = (parts[i + 1] ?? inline ?? '').trim()
      const next = parseNode(parts[i + 2] ?? '', nodes)
      if (prev && next) edges.push({ from: prev, to: next, label, dashed: arrow.includes('.') })
      prev = next
    }
  }
  if (!nodes.size || nodes.size > 40) return null
  // Layers: the longest path from a source, cycles cut.
  const layer = new Map<string, number>([...nodes.keys()].map(id => [id, 0]))
  for (let pass = 0; pass < nodes.size; pass++) {
    let moved = false
    for (const e of edges) {
      const want = (layer.get(e.from) ?? 0) + 1
      if (e.from !== e.to && want > (layer.get(e.to) ?? 0) && want < nodes.size) {
        layer.set(e.to, want)
        moved = true
      }
    }
    if (!moved) break
  }
  const layers: string[][] = []
  for (const id of nodes.keys()) (layers[layer.get(id) ?? 0] ??= []).push(id)
  const H_NODE = 34
  const size = (n: Node) => ({ w: Math.max(64, Math.min(200, textW(n.label, 12.5) + 28)), h: n.shape === 'diamond' ? 44 : H_NODE })
  const pos = new Map<string, { x: number; y: number; w: number; h: number }>()
  const gapMain = isAcross ? Math.max(150, Math.min(240, W / Math.max(1, layers.length))) : 86
  layers.forEach((ids, li) => {
    ids.forEach((id, k) => {
      const n = nodes.get(id) as Node
      const { w, h } = size(n)
      if (isAcross) {
        const x = 16 + li * gapMain + (gapMain - 32 - w) / 2 + w / 2
        const y = 30 + k * 62 + h / 2
        pos.set(id, { x: dir === 'RL' ? W - x : x, y, w, h })
      } else {
        const slot = W / ids.length
        const x = slot * k + slot / 2
        const y = 24 + li * gapMain + h / 2
        pos.set(id, { x, y, w, h })
      }
    })
  })
  const maxY = Math.max(...[...pos.values()].map(q => q.y + q.h / 2)) + 24
  if (dir === 'BT') for (const q of pos.values()) q.y = maxY - q.y
  const height = Math.min(4000, Math.round(isAcross ? Math.max(...[...pos.values()].map(q => q.y + q.h / 2)) + 24 : layers.length * gapMain + 30))
  const colorOf = (id: string) => p.colors[(layer.get(id) ?? 0) % p.colors.length] ?? p.accent
  const arrows = edges
    .map(e => {
      const a = pos.get(e.from)
      const b = pos.get(e.to)
      if (!a || !b) return ''
      const [x1, y1, x2, y2] = isAcross
        ? [a.x + (b.x >= a.x ? a.w / 2 : -a.w / 2), a.y, b.x - (b.x >= a.x ? b.w / 2 : -b.w / 2), b.y]
        : [a.x, a.y + (b.y >= a.y ? a.h / 2 : -a.h / 2), b.x, b.y - (b.y >= a.y ? b.h / 2 : -b.h / 2)]
      const mid = isAcross ? `C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2}` : `C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2}`
      const label = e.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" text-anchor="middle" font-family="${p.font}" font-size="11" fill="${p.subtext}" paint-order="stroke" stroke="${p.tile}" stroke-width="4">${esc(e.label)}</text>`
        : ''
      return `<path d="M${x1} ${y1}${mid} ${x2} ${y2}" fill="none" stroke="${colorOf(e.to)}" stroke-opacity=".75" stroke-width="1.6"${e.dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#ah)"/>${label}`
    })
    .join('\n')
  const boxes = [...nodes.values()]
    .map(n => {
      const q = pos.get(n.id)
      if (!q) return ''
      const c = colorOf(n.id)
      const x = q.x - q.w / 2
      const y = q.y - q.h / 2
      const fill = `fill="${p.tile}" stroke="${c}" stroke-width="1.6"`
      const shape =
        n.shape === 'diamond'
          ? `<path d="M${q.x} ${y}L${x + q.w} ${q.y}L${q.x} ${y + q.h}L${x} ${q.y}Z" ${fill}/>`
          : n.shape === 'circle'
            ? `<ellipse cx="${q.x}" cy="${q.y}" rx="${q.w / 2}" ry="${q.h / 2 + 4}" ${fill}/>`
            : p.chamfer && n.shape === 'box'
              ? `<path d="M${x + 8} ${y}H${x + q.w}V${y + q.h - 8}L${x + q.w - 8} ${y + q.h}H${x}V${y + 8}Z" ${fill}/>`
              : `<rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" rx="${n.shape === 'round' ? q.h / 2 : 6}" ${fill}/>`
      const label = n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label
      return `${shape}<text x="${q.x}" y="${q.y + 4.5}" text-anchor="middle" font-family="${p.font}" font-size="12.5" font-weight="600" fill="${p.text}">${esc(label)}</text>`
    })
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${p.subtext}"/></marker></defs>
${arrows}
${boxes}
</svg>`
  return { svg, height }
}

const pie = (src: string, W: number, p: ChartPalette): Chart | null => {
  const lines = src.split('\n').map(l => l.trim()).filter(Boolean)
  if (!/^pie\b/i.test(lines[0] ?? '')) return null
  const title = (/title\s+(.+)$/i.exec(lines[0] ?? '')?.[1] ?? lines.find(l => /^title\s+/i.test(l))?.replace(/^title\s+/i, '') ?? '').trim()
  const slices = lines
    .map(l => /^"([^"]+)"\s*:\s*([\d.]+)/.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map(m => ({ label: m[1] ?? '', value: Number(m[2]) }))
    .filter(sl => sl.value > 0)
    .slice(0, 12)
  if (!slices.length) return null
  const total = slices.reduce((a, b) => a + b.value, 0)
  const height = Math.max(180, 40 + slices.length * 24)
  const r = 70
  const cx = 24 + r
  const cy = height / 2 + (title ? 8 : 0)
  let angle = -Math.PI / 2
  const arcs = slices
    .map((sl, i) => {
      const sweep = (sl.value / total) * Math.PI * 2
      const a2 = angle + sweep
      const large = sweep > Math.PI ? 1 : 0
      const pt = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`
      const d =
        slices.length === 1
          ? `M${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`
          : `M${pt(angle, r)}A${r} ${r} 0 ${large} 1 ${pt(a2, r)}L${pt(a2, r * 0.58)}A${r * 0.58} ${r * 0.58} 0 ${large} 0 ${pt(angle, r * 0.58)}Z`
      angle = a2
      return `<path d="${d}" fill="${p.colors[i % p.colors.length] ?? p.accent}" stroke="${p.tile}" stroke-width="2"/>`
    })
    .join('')
  const legendX = cx + r + 32
  const legend = slices
    .map((sl, i) => {
      const y = cy - (slices.length * 24) / 2 + i * 24 + 16
      return `<rect x="${legendX}" y="${y - 9}" width="11" height="11" rx="${p.chamfer ? 1 : 3}" fill="${p.colors[i % p.colors.length] ?? p.accent}"/>
<text x="${legendX + 18}" y="${y}" font-family="${p.font}" font-size="12.5" fill="${p.text}">${esc(sl.label)}<tspan fill="${p.subtext}">  ${Math.round((sl.value / total) * 100)}%</tspan></text>`
    })
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
${title ? `<text x="16" y="22" font-family="${p.font}" font-size="13" font-weight="700" fill="${p.accent}">${esc(title)}</text>` : ''}
${arcs}
${legend}
</svg>`
  return { svg, height }
}

export const mermaidChart = (src: string, W: number, p: ChartPalette): Chart | null => {
  const first = src.trim().split('\n')[0]?.trim() ?? ''
  if (/^(graph|flowchart)\b/i.test(first)) return flowchart(src.trim(), W, p)
  if (/^pie\b/i.test(first)) return pie(src.trim(), W, p)
  return null
}
