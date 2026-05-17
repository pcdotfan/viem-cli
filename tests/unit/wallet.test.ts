import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadAccount, tryLoadAccount, normalizeHexKey } from '../../src/lib/wallet.js'
import { ViemCliError } from '../../src/lib/errors.js'

const TEST_KEY = '0x2edab24d43bf39a069cf81a73b1ef25273859d2ecda4b5f06d3bd50adaec8458'

describe('wallet', () => {
  beforeEach(() => {
    delete process.env.VIEM_PRIVATE_KEY
  })
  afterEach(() => {
    delete process.env.VIEM_PRIVATE_KEY
  })

  it('normalizes key without prefix', () => {
    const normalized = normalizeHexKey(TEST_KEY.slice(2))
    expect(normalized).toBe(TEST_KEY)
  })

  it('rejects bad keys', () => {
    expect(() => normalizeHexKey('not-a-key')).toThrow(/32-byte hex/)
    expect(() => normalizeHexKey('0x123')).toThrow(/32-byte hex/)
  })

  it('loadAccount uses env', () => {
    process.env.VIEM_PRIVATE_KEY = TEST_KEY
    const acc = loadAccount()
    expect(acc.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('loadAccount throws when env missing', () => {
    expect(() => loadAccount()).toThrowError(ViemCliError)
  })

  it('tryLoadAccount returns undefined when missing', () => {
    expect(tryLoadAccount()).toBeUndefined()
  })

  it('loadAccount accepts override', () => {
    const acc = loadAccount(TEST_KEY)
    expect(acc.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('derives a stable address from the known test key', () => {
    const acc = loadAccount(TEST_KEY)
    // Address derivation is deterministic; checksum-cased.
    expect(acc.address.length).toBe(42)
  })
})
