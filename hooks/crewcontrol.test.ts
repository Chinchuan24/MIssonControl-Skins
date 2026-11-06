import { expect, test } from 'claude-code/testing'

import { ULTRA_BRIEF, cleanOneShot, cleanUltraRules, isUltraAgent, matchUltra, nextOneShot, oneShotText, parseOneShot, resolveEffort, ruleMatches, ultraCommand, withUltraBrief } from './crewcontrol'

// Per-agent Ultra (max effort + a deep-check brief for chosen roles) and One-shot
// (what the main session does once a plan is approved).

test('ultra: a rule matches the role in the type or description, any case, plural too', () => {
  expect(ruleMatches('tester', 'general-purpose', 'Tester: check widths')).toBe(true)
  expect(ruleMatches('tester', 'general-purpose', 'run the testers')).toBe(true)
  expect(ruleMatches('tester', 'general-purpose', 'Engineer: build band')).toBe(false)
  expect(ruleMatches('test', 'general-purpose', 'Tester: widths')).toBe(false)
  expect(matchUltra(['writer', 'tester'], 'general-purpose', 'Tester: x')).toBe('tester')
  expect(matchUltra([], 'general-purpose', 'Tester: x')).toBe(null)
})

test('ultra: /tokens ultra add, remove, list, off', () => {
  let r = ultraCommand([], 'add Tester')
  expect(r.rules).toEqual(['tester'])
  r = ultraCommand(r.rules, 'add tester')
  expect(r.rules).toEqual(['tester'])
  expect(r.text).toMatch(/already/)
  r = ultraCommand(r.rules, 'add Code Reviewer')
  expect(r.rules).toEqual(['tester', 'code reviewer'])
  expect(ultraCommand(r.rules, 'remove TESTER').rules).toEqual(['code reviewer'])
  expect(ultraCommand(r.rules, 'list', 2).text).toMatch(/2 agents running Ultra/)
  expect(ultraCommand(r.rules, 'off').rules).toEqual([])
  expect(ultraCommand(r.rules, 'add').text).toMatch(/Usage/)
  expect(ultraCommand(r.rules, 'bogus').rules).toEqual(r.rules)
})

test('ultra: a saved list of anything is cleaned', () => {
  expect(cleanUltraRules(['  Tester ', 'tester', 3, '', null])).toEqual(['tester'])
  expect(cleanUltraRules('x')).toEqual([])
})

test('effort order: the card choice beats an Ultra rule, which beats staffing, which beats the engine', () => {
  expect(isUltraAgent(undefined, true)).toBe(true)
  expect(isUltraAgent(false, true)).toBe(false)
  expect(isUltraAgent(true, false)).toBe(true)
  expect(resolveEffort('high', 'medium', true)).toBe('max')
  expect(resolveEffort('high', 'medium', false)).toBe('medium')
  expect(resolveEffort('high', undefined, false)).toBe('high')
  // a model that takes no effort is sent none
  expect(resolveEffort(undefined, 'medium', true)).toBe(undefined)
})

test('ultra: the brief is added once', () => {
  const once = withUltraBrief('do it')
  expect(once).toBe(`do it${ULTRA_BRIEF}`)
  expect(withUltraBrief(once)).toBe(once)
  expect(ULTRA_BRIEF).toMatch(/could not verify/)
})

test('one-shot: modes, parsing, cycling and the prompt text', () => {
  expect(cleanOneShot('junk')).toBe('ask')
  expect(cleanOneShot('on')).toBe('on')
  expect(parseOneShot(' OFF ')).toBe('off')
  expect(parseOneShot('maybe')).toBe(null)
  expect(nextOneShot('ask')).toBe('on')
  expect(nextOneShot('on')).toBe('off')
  expect(nextOneShot('off')).toBe('ask')
  expect(oneShotText('ask')).toContain('Part by part, or one-shot?')
  expect(oneShotText('on')).toMatch(/report back once/)
  expect(oneShotText('on')).toMatch(/destructive/)
  expect(oneShotText('off')).toMatch(/one part at a time/)
})
