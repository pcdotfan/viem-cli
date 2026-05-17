import { describe, it, expect } from 'vitest'
import { jsonReplacer } from '../../src/lib/output.js'

describe('output', () => {
  it('jsonReplacer serializes bigints', () => {
    const out = JSON.stringify({ n: 1n, s: 'hi' }, jsonReplacer)
    expect(out).toBe('{"n":"1","s":"hi"}')
  })
})
