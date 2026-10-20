// Easter eggs for the cyberpunk skins: small references a Cyberpunk 2077 or
// Edgerunners fan will catch. Pure SVG strings and CSS, no state: the hooks module
// decides when each shows. Only short words and names are used, never lyrics.
//
// Three flavours, one per cast: `runners` (Night City yellow), `netrun` (Lucy's
// pink and the moon), `corpo` (Arasaka red).

export type Egg = 'runners' | 'netrun' | 'corpo'

export type EggColors = { a: string; b: string; c: string; text: string; dim: string }

const COLORS: Record<Egg, EggColors> = {
  runners: { a: '#FCEE0A', b: '#00F0FF', c: '#FF003C', text: '#F4F4F4', dim: '#5A6270' },
  netrun: { a: '#FF5CF0', b: '#5CE1FF', c: '#B8F2E0', text: '#F4F0FF', dim: '#6A5E80' },
  corpo: { a: '#E3001B', b: '#F2F2F2', c: '#8A0A24', text: '#F2F2F2', dim: '#55565C' },
}
export const eggColors = (egg: Egg): EggColors => COLORS[egg]

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
let uid = 0
const id = (p: string) => `${p}${(uid = (uid + 1) % 100000)}`

// --- motion: the glitch bursts, the breach band, the heat flash, the trails ---
export const EGG_CSS = `.rg{animation:rgx 4.2s steps(1) infinite}.rg2{animation:rgx 4.2s steps(1) infinite -.06s}
@keyframes rgx{0%,90%,100%{transform:translate(0,0);opacity:0}91%{transform:translate(-2px,0);opacity:.9}92%{transform:translate(2px,1px);opacity:.8}94%{transform:translate(-1px,-1px);opacity:.9}95%{transform:translate(0,0);opacity:0}}
.rgs{animation:rgs 4.2s steps(1) infinite}@keyframes rgs{0%,90%,96%,100%{transform:translateX(0)}91%{transform:translateX(3px)}93%{transform:translateX(-2px)}}
.bx{animation:bx 3s steps(6) infinite}@keyframes bx{to{transform:translateX(var(--bw))}}
.bslot{animation:cur 1s steps(1) infinite}
.heat{animation:heat .5s steps(1) infinite}@keyframes heat{50%{fill:#2F6BFF}}
.psy{animation:psy 1.3s steps(1) infinite}@keyframes psy{0%,100%{opacity:1;transform:translateX(0)}20%{opacity:.4;transform:translateX(1px)}24%{opacity:1;transform:translateX(-1px)}60%{opacity:.85}}
.sandy{animation:sandy 1.2s ease-in-out infinite}@keyframes sandy{50%{opacity:.08}}
.win{animation:win 3.4s steps(1) infinite}@keyframes win{50%{opacity:.25}}
.av{animation:av 14s linear infinite}@keyframes av{from{transform:translateX(-60px)}to{transform:translateX(var(--sw))}}
.beacon{animation:led 1.4s steps(1) infinite}@keyframes led{50%{opacity:.2}}
.moon{animation:moon 6s ease-in-out infinite}@keyframes moon{50%{transform:translateY(-2px)}}
.rise{animation:rise 2.4s cubic-bezier(.2,.8,.2,1) both}@keyframes rise{from{transform:translateY(40px);opacity:0}}
.flash{animation:flash .9s steps(1) 3}@keyframes flash{33%{opacity:.15}66%{opacity:.9}}
.tick{animation:tick 1.6s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.rg,.rg2,.rgs,.bx,.bslot,.heat,.psy,.sandy,.win,.av,.beacon,.moon,.rise,.flash{animation:none}}`

// The Relic's malfunction on a line of text: a red and a cyan copy that tear
// sideways for a moment every few seconds, over a white core that jumps a slice.
export const relicText = (x: number, y: number, text: string, attrs: string, egg: Egg): string => {
  const c = COLORS[egg]
  const t = esc(text)
  return `<g class="rgs"><text x="${x}" y="${y}" ${attrs}>${t}</text></g>
<text class="rg" opacity="0" x="${x}" y="${y}" ${attrs.replace(/fill="[^"]*"/, '')} fill="${c.c}" style="mix-blend-mode:screen">${t}</text>
<text class="rg2" opacity="0" x="${x}" y="${y}" ${attrs.replace(/fill="[^"]*"/, '')} fill="${c.b}" style="mix-blend-mode:screen">${t}</text>`
}

// Breach Protocol: a row of hex codes with the lit band snapping cell to cell while
// the job runs, and a buffer of slots filled as steps are done.
const CODES = ['1C', 'BD', '55', 'E9', '7A', 'FF']
export const breachTicker = (x: number, y: number, isWorking: boolean, done: number, total: number, egg: Egg, font: string): string => {
  const c = COLORS[egg]
  const cell = 17
  const cells = CODES.map((code, i) => `<text x="${x + 40 + i * cell + cell / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="700" fill="${isWorking ? c.a : c.dim}" fill-opacity="${isWorking ? 0.9 : 0.6}">${code}</text>`).join('')
  const band = isWorking
    ? `<rect class="bx" style="--bw:${cell * 6}px" x="${x + 40}" y="${y - 9}" width="${cell}" height="12" fill="${c.a}" fill-opacity=".18" stroke="${c.a}" stroke-opacity=".7" stroke-width=".8"/>`
    : ''
  const slots = Math.max(1, Math.min(6, total || 6))
  const filled = total ? Math.min(slots, Math.round((done / total) * slots)) : 0
  const buf = Array.from({ length: slots }, (_, i) => {
    const bx = x + 40 + cell * 6 + 10 + i * 7
    return i < filled
      ? `<rect x="${bx}" y="${y - 7}" width="5" height="8" fill="${c.a}"/>`
      : `<rect${i === filled && isWorking ? ' class="bslot"' : ''} x="${bx + 0.5}" y="${y - 6.5}" width="4" height="7" fill="none" stroke="${c.a}" stroke-opacity=".6"/>`
  }).join('')
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="9" font-weight="800" letter-spacing=".6" fill="${c.dim}">BREACH</text>${band}${cells}${buf}`
}
export const BREACH_W = 40 + 17 * 6 + 10 + 6 * 7

// NCPD heat: up to five stars, lit by how hot the run is; five flash red and blue.
export const heatStars = (x: number, y: number, level: number, egg: Egg): string => {
  const c = COLORS[egg]
  const lit = Math.max(0, Math.min(5, Math.round(level)))
  return Array.from({ length: 5 }, (_, i) => {
    const on = i < lit
    return `<text${on && lit === 5 ? ' class="heat"' : ''} x="${x + i * 9}" y="${y}" font-size="9" fill="${on ? c.c : c.dim}" fill-opacity="${on ? 1 : 0.5}">★</text>`
  }).join('')
}

// Cyberpsychosis: past 85% context the chrome starts to bite; past 95% MaxTac rolls.
export const psychoChip = (x: number, y: number, ctxPct: number, font: string): { svg: string; w: number } => {
  if (ctxPct < 85) return { svg: '', w: 0 }
  const label = ctxPct >= 95 ? 'MAXTAC INBOUND' : 'CYBERPSYCHOSIS RISK'
  const w = label.length * 6.1 + 14
  return {
    w,
    svg: `<g class="psy"><rect x="${x}" y="${y - 10}" width="${w}" height="13" rx="1" fill="#FF003C"/><text x="${x + w / 2}" y="${y - 0.5}" text-anchor="middle" font-family="${font}" font-size="9.5" font-weight="800" letter-spacing=".5" fill="#0B0B0E">${label}</text></g>`,
  }
}

// Sandevistan: three fading afterimages trailing the figure while it works, tinted
// like David's time-slow trails.
export const sandevistan = (figure: string, egg: Egg): { defs: string; svg: string } => {
  const f = id('sv')
  const tint = egg === 'corpo' ? '0.9 0 0 0 0.25  0 0.1 0 0 0  0 0.1 0 0 0' : egg === 'netrun' ? '0.6 0 0 0 0.3  0 0.2 0 0 0.2  0 0 0.8 0 0.4' : '0 0 0 0 0  0 0.9 0 0 0.35  0 0 0.6 0 0.45'
  return {
    defs: `<filter id="${f}"><feColorMatrix type="matrix" values="${tint}  0 0 0 1 0"/></filter>`,
    svg: [9, 6, 3]
      .map((dx, i) => `<g class="sandy" style="animation-delay:${-i * 0.2}s" opacity="${(0.12 + i * 0.1).toFixed(2)}" filter="url(#${f})" transform="translate(${-dx} 0)">${figure}</g>`)
      .join(''),
  }
}

// Night City along the bottom of a card: towers with blinking windows and an AV
// crossing; Arasaka's tower over the corpo skin, Lucy's moon over hers.
export const skyline = (W: number, y0: number, h: number, egg: Egg): string => {
  const c = COLORS[egg]
  let seed = 7
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const towers: string[] = []
  const windows: string[] = []
  let x = 0
  while (x < W) {
    const w = 10 + Math.floor(rnd() * 22)
    const th = 8 + Math.floor(rnd() * (h - 10))
    towers.push(`<rect x="${x}" y="${y0 + h - th}" width="${w - 2}" height="${th}"/>`)
    for (let k = 0; k < 2; k++) {
      if (rnd() < 0.6) windows.push(`<rect class="win" style="animation-delay:${(rnd() * -3).toFixed(1)}s" x="${x + 2 + Math.floor(rnd() * (w - 6))}" y="${y0 + h - th + 3 + Math.floor(rnd() * Math.max(1, th - 6))}" width="2" height="2" fill="${rnd() < 0.5 ? c.a : c.b}"/>`)
    }
    x += w
  }
  let extra = ''
  if (egg === 'corpo') {
    // The tower: tall, stepped, a red beacon on top.
    const tx = Math.round(W * 0.72)
    extra = `<path d="M${tx} ${y0 + h}V${y0 + 6}l6 -6l6 6V${y0 + h}Z"/><rect class="beacon" x="${tx + 5}" y="${y0 - 2}" width="2" height="2" fill="#FF1E3C"/>`
  } else if (egg === 'netrun') {
    const mx = Math.round(W * 0.82)
    extra = `<g class="moon"><circle cx="${mx}" cy="${y0 + 4}" r="${h * 0.42}" fill="#FFD6F2" fill-opacity=".55"/><circle cx="${mx - 3}" cy="${y0 + 2}" r="${h * 0.12}" fill="#E6A8D8" fill-opacity=".5"/></g>`
  }
  const av = `<g class="av" style="--sw:${W + 60}px"><rect x="0" y="${y0 + 3}" width="9" height="2" rx="1" fill="${c.dim}"/><rect x="8" y="${y0 + 3}" width="2" height="2" fill="${c.c}"/></g>`
  return `<g opacity=".22" fill="${egg === 'corpo' ? '#2A0A0F' : egg === 'netrun' ? '#2A1A3A' : '#1A2230'}">${extra}${towers.join('')}</g><g opacity=".5">${windows.join('')}</g>${av}`
}

// The cheer when a job is done: Night City's "preem", the moon, the corporation's stamp.
export const celebration = (W: number, H: number, egg: Egg, font: string): string => {
  const c = COLORS[egg]
  if (egg === 'netrun') {
    return `<g class="rise"><circle cx="${W - 70}" cy="${H / 2}" r="${H * 0.36}" fill="#FFD6F2"/><circle cx="${W - 78}" cy="${H / 2 - 6}" r="${H * 0.08}" fill="#E6A8D8"/></g>
<text class="rise" x="${W - 130}" y="${H / 2 + 5}" text-anchor="end" font-family="${font}" font-size="15" font-weight="800" letter-spacing="1.5" fill="${c.a}">TO THE MOON ☾</text>`
  }
  const label = egg === 'corpo' ? 'PROTOCOL COMPLETE · 任務完了' : 'PREEM. JOB DONE, CHOOM'
  // CJK glyphs are about twice as wide as Latin ones.
  const w = [...label].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 16 : 9), 0) + 30
  if (egg === 'corpo') font = `${font.replace(/,?sans-serif$/, '')},${CJK_FONT}`
  return `<g class="flash"><rect x="${(W - w) / 2}" y="${H / 2 - 13}" width="${w}" height="24" fill="${c.a}" transform="rotate(-2 ${W / 2} ${H / 2})"/>
<text x="${W / 2}" y="${H / 2 + 5}" text-anchor="middle" font-family="${font}" font-size="15" font-weight="900" letter-spacing="1.5" fill="#0B0B0E" transform="rotate(-2 ${W / 2} ${H / 2})">${esc(label)}</text></g>`
}

// A tiny code tag for a corner: SYS.2077 // 0x3F, and a katakana line.
export const sysTag = (x: number, y: number, egg: Egg, font: string, anchor = 'end'): string => {
  const c = COLORS[egg]
  const code = egg === 'corpo' ? 'ARS.2077 // 0x0A' : egg === 'netrun' ? 'NET.2076 // 0x4C' : 'SYS.2077 // 0x3F'
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="7" letter-spacing=".8" fill="${c.dim}" fill-opacity=".8">${code}</text>`
}
// Japanese text needs a Japanese face: macOS, Windows, then Linux's Noto.
export const CJK_FONT = "'Hiragino Sans','Yu Gothic UI','Meiryo','Noto Sans CJK JP',sans-serif"
export const KATAKANA: Record<Egg, string> = { runners: 'ミッション・コントロール', netrun: 'ネットランナー', corpo: 'アラサカ' }

// Night City radio, one station an hour (names only).
const STATIONS = ['89.7 GROWL FM', '88.9 PACIFIC DREAMS', '91.9 ROYAL BLUE', '92.9 NIGHT FM', '95.2 SAMIZDAT', '96.1 RITUAL FM', '98.7 BODY HEAT', '99.9 IMPULSE', '101.9 THE DIRGE', '103.5 RADIO PEBKAC', '106.9 30 PRINCIPALES', '107.3 MORRO ROCK', '107.5 DARK STAR', '89.3 RADIO VEXELSTROM']
export const radio = (at: number): string => STATIONS[Math.floor(at / 3_600_000) % STATIONS.length] as string

// Breach Protocol card for Mission Control: a 5×5 code matrix with the valid row lit,
// a buffer of the job's steps and the daemons it uploads.
const MATRIX = [
  ['1C', 'BD', '55', 'E9', '7A'],
  ['55', '7A', '1C', 'FF', 'BD'],
  ['E9', '1C', 'BD', '55', 'FF'],
  ['FF', '55', '7A', '1C', 'E9'],
  ['BD', 'E9', 'FF', '7A', '1C'],
]
export const BREACH_H = 132
export const breachCard = (W: number, done: number, total: number, isWorking: boolean, egg: Egg, font: string, frame: (x: number, y: number, w: number, h: number, attrs: string, r?: number) => string): string => {
  const c = COLORS[egg]
  const x0 = 18
  const y0 = 36
  const cell = 32
  const rh = 17
  const row = total ? Math.min(4, done % 5) : 0
  const grid = MATRIX.map((r, j) =>
    r.map((code, i) => {
      const lit = j === row
      return `<text x="${x0 + i * cell + cell / 2}" y="${y0 + j * rh + 12.5}" text-anchor="middle" font-family="${font}" font-size="13" font-weight="700" fill="${lit ? c.a : c.dim}" fill-opacity="${lit ? 1 : 0.55}">${code}</text>`
    }).join(''),
  ).join('')
  const band = `<rect x="${x0 - 2}" y="${y0 + row * rh}" width="${cell * 5 + 4}" height="${rh}" fill="${c.a}" fill-opacity=".12" stroke="${c.a}" stroke-opacity=".6"/>`
  const sweep = isWorking ? `<rect class="bx" style="--bw:${cell * 5}px" x="${x0}" y="${y0 + row * rh}" width="${cell}" height="${rh}" fill="${c.a}" fill-opacity=".25"/>` : ''
  const bx = x0 + cell * 5 + 36
  const slots = Math.max(1, Math.min(8, total || 6, Math.floor((W - bx - 14) / 26)))
  const fill = total ? Math.min(slots, Math.round((done / total) * slots)) : 0
  const hasDaemons = W - bx >= 130
  const buf = Array.from({ length: slots }, (_, i) =>
    i < fill
      ? `<rect x="${bx + i * 26}" y="${y0}" width="22" height="16" fill="${c.a}" fill-opacity=".9"/><text x="${bx + i * 26 + 11}" y="${y0 + 12}" text-anchor="middle" font-family="${font}" font-size="10" font-weight="800" fill="#0B0B0E">${(MATRIX[i % 5] as string[])[i % 5]}</text>`
      : `<rect${i === fill && isWorking ? ' class="bslot"' : ''} x="${bx + i * 26 + 0.5}" y="${y0 + 0.5}" width="21" height="15" fill="none" stroke="${c.a}" stroke-opacity=".6" stroke-dasharray="3 2"/>`,
  ).join('')
  const daemons = (hasDaemons ? ['DATAMINE_V1', 'DATAMINE_V2', 'DATAMINE_V3'] : [])
    .map((d, i) => {
      const ok = total > 0 && done >= Math.ceil(((i + 1) * total) / 3)
      return `<text x="${bx}" y="${y0 + 42 + i * 18}" font-family="${font}" font-size="11.5" font-weight="700" letter-spacing=".6" fill="${ok ? c.a : c.dim}">${ok ? '✓ ' : '▫ '}${d}</text>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BREACH_H}" viewBox="0 0 ${W} ${BREACH_H}"><style>${EGG_CSS}.cur{}@keyframes cur{50%{opacity:0}}.bslot{animation:cur 1s steps(1) infinite}</style>
${frame(0.5, 0.5, W - 1, BREACH_H - 1, `fill="#0B0D12" fill-opacity=".85" stroke="${c.a}" stroke-opacity=".35"`, 10)}
<rect x="16" y="11" width="3" height="14" fill="${c.a}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${c.text}">BREACH PROTOCOL</text>
${sysTag(W - 14, 22, egg, font)}
${band}${sweep}${grid}
<text x="${bx}" y="${y0 - 6}" font-family="${font}" font-size="9" font-weight="800" letter-spacing=".8" fill="${c.dim}">BUFFER ${fill}/${slots}</text>
${buf}${daemons}
<text x="${W - 14}" y="${BREACH_H - 10}" text-anchor="end" font-family="${font}" font-size="9" letter-spacing=".6" fill="${c.dim}">${isWorking ? 'UPLOADING DAEMONS…' : total && done >= total ? 'BREACH SUCCESSFUL' : 'AWAITING JACK-IN'}</text>
</svg>`
}

// The Afterlife names a drink after every legend; Arasaka files the engram in Mikoshi.
export type Legend = { task: string; costUsd: number; at: number; ms: number }
export const LEGENDS_ROW = 18
export const legendsHeight = (n: number): number => 46 + Math.max(1, n) * LEGENDS_ROW + 8
export const legendsCard = (W: number, list: Legend[], egg: Egg, font: string, money: (usd: number) => string, frame: (x: number, y: number, w: number, h: number, attrs: string, r?: number) => string): string => {
  const c = COLORS[egg]
  const H = legendsHeight(list.length)
  // 7. a narrow card keeps just the place's name
  const title = W < 460 ? (egg === 'corpo' ? 'MIKOSHI' : 'AFTERLIFE') : egg === 'corpo' ? 'MIKOSHI · ENGRAMS ON FILE' : 'AFTERLIFE · DRINKS NAMED AFTER LEGENDS'
  const rows = list.length
    ? list
        .map((l, i) => {
          const y = 52 + i * LEGENDS_ROW
          const name = egg === 'corpo' ? `ENGRAM ${String(i + 1).padStart(3, '0')} — ${l.task}` : `The ${l.task}`
          const room = Math.max(10, Math.floor((W - 160) / 6.6))
          const chars = [...name]
          const clipped = chars.length > room ? `${chars.slice(0, room - 1).join('')}…` : name
          return `<text x="18" y="${y}" font-family="${font}" font-size="12" font-weight="600" fill="${c.text}">${egg === 'corpo' ? '▣' : '🍸'} ${esc(clipped)}</text>
<line x1="18" y1="${y + 5}" x2="${W - 18}" y2="${y + 5}" stroke="${c.dim}" stroke-opacity=".35" stroke-dasharray="1 3"/>
<text x="${W - 18}" y="${y}" text-anchor="end" font-family="${font}" font-size="12" font-weight="800" fill="${c.a}">${money(l.costUsd)}</text>`
        })
        .join('')
    : `<text x="18" y="52" font-family="${font}" font-size="12" fill="${c.dim}">${egg === 'corpo' ? 'No engrams yet. Finish a job.' : 'No legends yet. Finish a job, choom.'}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${frame(0.5, 0.5, W - 1, H - 1, `fill="#0B0D12" fill-opacity=".85" stroke="${c.a}" stroke-opacity=".3"`, 10)}
<rect x="16" y="11" width="3" height="14" fill="${c.a}"/>
<text x="25" y="23" font-family="${font}" font-size="14" font-weight="800" letter-spacing=".8" fill="${c.text}">${title}</text>
${sysTag(W - 14, 22, egg, font)}
${rows}
</svg>`
}

// Words: the spinner talks like Night City, and the cheer on a long job.
export const EGG_WORDS: Record<Egg, string[]> = {
  runners: ['Jacking in', 'Breaching ICE', 'Uploading daemon', 'Pinging the subnet', 'Chipping in', 'Calling a Delamain', 'Asking the fixer', 'Overclocking', 'Dodging NetWatch', 'Hitting the Afterlife', 'Checking the chrome', 'Scanning with Kiroshis'],
  netrun: ['Diving into the Net', 'Chasing the moon', 'Slipping past ICE', 'Deep diving', 'Drifting through the Net', 'Riding the subway', 'Jacking in, choom', 'Cutting the cables', 'Breaching the Blackwall… not today'],
  corpo: ['Processing', 'Executing protocol', 'Consulting the board', 'Filing the engram', 'Securing assets', 'Dispatching Smasher', 'Reporting to Saburo', 'Running Soulkiller… diagnostics', 'Auditing the floor'],
}
export const EGG_TOOLS: Record<Egg, Record<string, string>> = {
  runners: { Read: 'Scan', Edit: 'Rewire', MultiEdit: 'Rewire', Write: 'Burn chip', Bash: 'Quickhack', PowerShell: 'Quickhack', Grep: 'Ping', Glob: 'Datamine', Agent: 'Call a fixer', WebFetch: 'Jack in', WebSearch: 'Netsearch', ToolSearch: 'Visit Vik' },
  netrun: { Read: 'Dive', Edit: 'Rewrite', MultiEdit: 'Rewrite', Write: 'Leave a trace', Bash: 'Breach', PowerShell: 'Breach', Grep: 'Ping', Glob: 'Map the Net', Agent: 'Call the crew', WebFetch: 'Pull', WebSearch: 'Search the Net', ToolSearch: 'Swap chrome' },
  corpo: { Read: 'Audit', Edit: 'Amend', MultiEdit: 'Amend', Write: 'File', Bash: 'Execute', PowerShell: 'Execute', Grep: 'Surveil', Glob: 'Catalogue', Agent: 'Dispatch', WebFetch: 'Retrieve', WebSearch: 'Surveil the Net', ToolSearch: 'Requisition' },
}
export const GREETING: Record<Egg, string> = {
  runners: 'Wake up, Samurai. We have a city to burn.',
  netrun: 'Wake up, choom. The moon is waiting.',
  corpo: 'Arasaka welcomes you, employee. Loyalty is rewarded.',
}
