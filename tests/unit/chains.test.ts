import { describe, it, expect } from 'vitest'
import { resolveChain, listChains, chainExportName, pickRpcUrl } from '../../src/lib/chains.js'

describe('chains', () => {
  it('resolves by export name', () => {
    const c = resolveChain('mainnet')
    expect(c.id).toBe(1)
  })

  it('resolves by chain id', () => {
    expect(resolveChain(8453).id).toBe(8453)
    expect(resolveChain('8453').id).toBe(8453)
  })

  it('resolves by full chain name', () => {
    const c = resolveChain('OP Mainnet')
    expect(c.id).toBe(10)
  })

  it('defaults to mainnet when input is undefined', () => {
    expect(resolveChain(undefined).id).toBe(1)
  })

  it('throws on unknown chain', () => {
    expect(() => resolveChain('nope-chain-xyz')).toThrow(/Unknown chain/)
  })

  it('lists all chains', () => {
    const all = listChains()
    expect(all.length).toBeGreaterThan(20)
  })

  it('filters chains by query', () => {
    const ethOnly = listChains('ethereum')
    expect(ethOnly.some((c) => c.id === 1)).toBe(true)
  })

  it('returns viem export name', () => {
    const c = resolveChain('base')
    expect(chainExportName(c)).toBe('base')
  })

  it('pickRpcUrl honors override', () => {
    const c = resolveChain('mainnet')
    expect(pickRpcUrl(c, 'https://example.com/rpc')).toBe('https://example.com/rpc')
  })

  it('pickRpcUrl falls back to env per-chain', () => {
    const c = resolveChain('mainnet')
    process.env.VIEM_RPC_URL_1 = 'https://env-rpc.example/1'
    try {
      expect(pickRpcUrl(c)).toBe('https://env-rpc.example/1')
    } finally {
      delete process.env.VIEM_RPC_URL_1
    }
  })

  it('pickRpcUrl falls back to default rpc when no override/env', () => {
    const c = resolveChain('mainnet')
    delete process.env.VIEM_RPC_URL
    delete process.env.VIEM_RPC_URL_1
    expect(typeof pickRpcUrl(c)).toBe('string')
  })
})
