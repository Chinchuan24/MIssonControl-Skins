import type { EngineInterface } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { CASTS } from './cast'
import { EXAMPLE_SKIN, contrast, deniedBrand, extractJson, skinCheck, skinNew, validateSkin } from './skinkit'

const good = () => JSON.parse(JSON.stringify(EXAMPLE_SKIN)) as Record<string, any>

// A stand-in for the engine: a virtual disk, the store, and a model that answers with `reply`.
const fake = (reply: string, disk: Record<string, string> = {}, answered = true) => {
  const written: Record<string, string> = {}
  let reloads = 0
  let prompt = ''
  const $ = {
    plugin: { root: '/plugin' },
    store: { get: async () => undefined },
    session: { cwd: async () => '/repo' },
    fs: {
      exists: async (p: string) => p in disk || p in written,
      read: async (p: string) => {
        if (p in disk) return disk[p]
        throw new Error('ENOENT')
      },
      write: async (p: string, t: string) => void (written[p] = t),
    },
    model: {
      complete: async (req: { prompt: string; model: string; effort?: string }) => {
        prompt = req.prompt
        expect(req.model).toBe('haiku')
        expect(req.effort).toBe('low')
        return answered ? { isAnswered: true, text: reply, usage: {} } : { isAnswered: false, reason: 'api-error' }
      },
    },
  } as unknown as EngineInterface
  const deps = { folderName: 'Custom Claude Skins', taken: () => new Set(['crab-classic', 'default']), reload: async () => void (reloads += 1) }
  return { $, deps, written, reloads: () => reloads, prompt: () => prompt }
}

test('validator: the example skin and the shipped crab-classic shape pass strict', () => {
  const c = validateSkin(good(), { strict: true })
  expect(c.errors).toEqual([])
  expect(c.ok).toBe(true)
})

test('validator: a bad color, id, corners, font and boss are each named', () => {
  const s = good()
  s.colors.accent = 'orange'
  s.id = 'Bad Id'
  s.corners = 'square'
  s.font = 'Arial; }'
  s.boss = ['#fff']
  const c = validateSkin(s)
  const all = c.errors.join('\n')
  expect(c.ok).toBe(false)
  expect(all).toContain('colors.accent')
  expect(all).toContain('"id"')
  expect(all).toContain('"corners"')
  expect(all).toContain('"font"')
  expect(c.warnings.join('\n')).toContain('"boss" should hold 5')
})

test('validator: limits match the loader (name 40, description 120, words 32 x 20, toolWords 20)', () => {
  const s = good()
  s.name = 'x'.repeat(41)
  s.description = 'x'.repeat(121)
  s.words = ['y'.repeat(33)]
  s.toolWords = { Read: 'z'.repeat(21), 'bad key': 'ok' }
  const all = validateSkin(s).errors.join('\n')
  for (const part of ['"name"', '"description"', 'words[0]', 'toolWords.Read', 'toolWords key']) expect(all).toContain(part)
  expect(validateSkin({ ...good(), words: Array(21).fill('a') }).errors.join()).toContain('"words"')
})

test('validator: loose mode lets a bare skin load with notes; strict wants it all', () => {
  const bare = { id: 'bare', name: 'Bare' }
  expect(validateSkin(bare).ok).toBe(true)
  expect(validateSkin(bare).warnings.length).toBeGreaterThan(3)
  expect(validateSkin(bare, { strict: true }).ok).toBe(false)
  expect(validateSkin('nope').ok).toBe(false)
  expect(validateSkin([]).ok).toBe(false)
})

test('validator: unreadable text on tile is flagged; cast is refused in strict', () => {
  const s = good()
  s.colors.text = '#222222'
  expect(validateSkin(s).warnings.join()).toContain('hard to read')
  expect(validateSkin(s, { strict: true }).ok).toBe(false)
  const c = { ...good(), cast: 'corpo' }
  expect(validateSkin(c).ok).toBe(true)
  expect(validateSkin(c, { strict: true }).errors.join()).toContain('add-on')
  expect(validateSkin({ ...good(), cast: 'nobody' }).ok).toBe(false)
})

test('brands: the deny list rejects ids and names, but not words that merely contain them', () => {
  for (const bad of ['anthropic', 'Claude Code', 'claude-dark', 'AWS Orange', 'amazon-prime', 'cyberpunk-neon', 'Arasaka Red', 'CD Projekt', 'cdprojekt-red']) expect(deniedBrand(bad)).toBeTruthy()
  for (const fine of ['ocean-sunset', 'Laws of Draws', 'Claudette', 'matrix-green', 'cyber']) expect(deniedBrand(fine)).toBeUndefined()
  expect(validateSkin({ ...good(), id: 'aws-orange' }).ok).toBe(false)
  expect(validateSkin({ ...good(), name: 'Claude Dusk' }).errors.join()).toContain('claude')
  // elsewhere it is a note when loose and a failure when strict
  const d = { ...good(), description: 'Looks like Amazon' }
  expect(validateSkin(d).ok).toBe(true)
  expect(validateSkin(d, { strict: true }).ok).toBe(false)
})

test('json: a reply in a code fence, or with chatter around it, still parses', () => {
  expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  expect(extractJson('Here you go: {"a":{"b":2}} enjoy')).toEqual({ a: { b: 2 } })
  expect(() => extractJson('no object here')).toThrow()
})

test('/skin new: a good draft is written once, reloaded, and the id is reported', async () => {
  const f = fake('```json\n' + JSON.stringify({ ...good(), id: 'ocean-sunset', name: 'Ocean Sunset' }) + '\n```')
  const text = await skinNew(f.$, 'ocean sunset', f.deps)
  const path = '/repo/Custom Claude Skins/ocean-sunset.json'
  expect(Object.keys(f.written)).toEqual([path])
  expect(JSON.parse(f.written[path]!).name).toBe('Ocean Sunset')
  expect(f.reloads()).toBe(1)
  expect(text).toContain('/skin ocean-sunset')
  expect(f.prompt()).toContain('Idea: ocean sunset')
  expect(f.prompt()).toContain('trademark')
  expect(f.prompt()).toContain('"$schema"')
})

test('/skin new: never overwrites; a taken id or an existing file gets a number', async () => {
  const taken = fake(JSON.stringify({ ...good(), id: 'crab-classic' }), {})
  const t1 = await skinNew(taken.$, 'crabs', taken.deps)
  expect(Object.keys(taken.written)).toEqual(['/repo/Custom Claude Skins/crab-classic-2.json'])
  expect(t1).toContain('/skin crab-classic-2')
  const disk = { '/repo/Custom Claude Skins/harbor-dusk.json': '{"keep":true}' }
  const clash = fake(JSON.stringify(good()), disk)
  await skinNew(clash.$, 'harbor', clash.deps)
  expect(disk['/repo/Custom Claude Skins/harbor-dusk.json']).toBe('{"keep":true}')
  expect(Object.keys(clash.written)).toEqual(['/repo/Custom Claude Skins/harbor-dusk-2.json'])
})

test('/skin new: bad drafts save nothing and say why', async () => {
  const brand = fake(JSON.stringify({ ...good(), id: 'claude-night', name: 'Claude Night' }))
  expect(await skinNew(brand.$, 'night', brand.deps)).toContain('claude')
  expect(brand.written).toEqual({})
  const junk = fake('sorry, I cannot')
  expect(await skinNew(junk.$, 'night', junk.deps)).toContain('not valid JSON')
  const badColor = fake(JSON.stringify({ ...good(), colors: { ...good().colors, accent: 'teal' } }))
  expect(await skinNew(badColor.$, 'teal', badColor.deps)).toContain('colors.accent')
  const down = fake('', {}, false)
  expect(await skinNew(down.$, 'x', down.deps)).toContain('did not answer')
  for (const f of [badColor, junk, down]) expect(f.written).toEqual({})
  expect(await skinNew(brand.$, '  ', brand.deps)).toContain('Usage')
})

test('/skin new: an idea that names a brand is turned away before any model call', async () => {
  const f = fake('{}')
  const text = await skinNew(f.$, 'Cyberpunk 2077 but pink', f.deps)
  expect(text).toContain('cyberpunk')
  expect(f.prompt()).toBe('')
})

test('/skin check: finds the file in the skins folder and reports problems', async () => {
  const disk = {
    '/repo/Custom Claude Skins/ok.json': JSON.stringify(good()),
    '/repo/Custom Claude Skins/broken.json': '{ nope',
    '/repo/Custom Claude Skins/wrong.json': JSON.stringify({ ...good(), colors: { ...good().colors, tile: 'blue' } }),
  }
  const f = fake('', disk)
  expect(await skinCheck(f.$, 'ok', f.deps)).toContain('Looks good')
  expect(await skinCheck(f.$, 'broken.json', f.deps)).toContain('Not valid JSON')
  const wrong = await skinCheck(f.$, 'wrong.json', f.deps)
  expect(wrong).toContain('colors.tile')
  expect(wrong).toContain('✗')
  expect(await skinCheck(f.$, 'missing.json', f.deps)).toContain('No file')
  expect(await skinCheck(f.$, '', f.deps)).toContain('Usage')
})

// The Mentalist's cast: every pixel letter has a colour (or is the tint), and every
// figure stands about as tall as the rest of the mod's characters.
test('mentalist cast: sprites are whole and about 46 pixels tall', () => {
  const cb = CASTS.mentalist
  expect(cb).toBeTruthy()
  const all = [cb!.boss, ...Object.values(cb!.roles), ...cb!.crew]
  for (const sp of all) {
    expect(sp.rows.length).toBeGreaterThan(40)
    expect(sp.rows.length).toBeLessThan(50)
    for (const row of sp.rows) for (const ch of row) if (ch !== '.' && ch !== 't') expect(sp.pal[ch]).toBeTruthy()
  }
  // The CBI agents' vests take their role's colour.
  expect(cb!.crew.every(sp => sp.rows.some(r => r.includes('t')))).toBe(true)
})

test('mentalist colours: white text reads on the navy card (4.5 or more)', () => {
  expect(contrast('#F2F5FA', '#0E1524')!).toBeGreaterThan(4.5)
  expect(contrast('#B4C0D3', '#0E1524')!).toBeGreaterThan(4.5)
  expect(contrast('#93A0B5', '#0E1524')!).toBeGreaterThan(4.5)
})
