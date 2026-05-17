import { describe, it, expect } from 'vitest'
import {
  loadAbi,
  parseSignature,
  parseArgs,
  coerceArg,
  parseTypes,
  parseJson,
  asHex,
  asAddress,
  asBigInt
} from '../../src/lib/parse.js'

describe('parse', () => {
  it('loadAbi parses human-readable signature', () => {
    const abi = loadAbi('function balanceOf(address) view returns (uint256)')
    expect(abi[0]).toMatchObject({ type: 'function', name: 'balanceOf' })
  })

  it('loadAbi parses JSON array', () => {
    const abi = loadAbi(
      JSON.stringify([{ type: 'function', name: 'foo', inputs: [], outputs: [], stateMutability: 'view' }])
    )
    expect(abi[0]).toMatchObject({ name: 'foo' })
  })

  it('loadAbi throws when input is neither file nor signature nor JSON', () => {
    expect(() => loadAbi('not-a-thing-at-all')).toThrow()
  })

  it('parseSignature works for function', () => {
    const item = parseSignature('function foo(uint256)')
    expect(item.type).toBe('function')
  })

  it('parseSignature works for event', () => {
    const item = parseSignature('event Transfer(address indexed from, address indexed to, uint256 value)')
    expect(item.type).toBe('event')
  })

  it('coerceArg handles JSON, primitives, hex addresses', () => {
    expect(coerceArg('123')).toBe(123)
    expect(coerceArg('true')).toBe(true)
    expect(coerceArg('false')).toBe(false)
    expect(coerceArg('[1,2,3]')).toEqual([1, 2, 3])
    expect(coerceArg('hello')).toBe('hello')
    expect(coerceArg('"quoted"')).toBe('quoted')
    expect(coerceArg('99999999999999999999')).toBe(99999999999999999999n)
  })

  it('parseArgs maps over coerce', () => {
    expect(parseArgs(['1', 'true', 'hi'])).toEqual([1, true, 'hi'])
  })

  it('parseTypes accepts CSV and JSON array', () => {
    expect(parseTypes('uint256,address')).toEqual(['uint256', 'address'])
    expect(parseTypes('["uint256","address"]')).toEqual(['uint256', 'address'])
  })

  it('parseJson parses inline JSON', () => {
    expect(parseJson('{"a":1}', '--x')).toEqual({ a: 1 })
  })

  it('parseJson errors on bad JSON', () => {
    expect(() => parseJson('{nope', '--x')).toThrow()
  })

  it('asHex normalizes and prefixes', () => {
    expect(asHex('deadbeef')).toBe('0xdeadbeef')
    expect(asHex('0x1234')).toBe('0x1234')
    expect(() => asHex('not-hex')).toThrow()
  })

  it('asAddress validates length', () => {
    expect(asAddress('0x' + '1'.repeat(40))).toMatch(/^0x/)
    expect(() => asAddress('0x123')).toThrow()
  })

  it('asBigInt converts', () => {
    expect(asBigInt('42')).toBe(42n)
    expect(asBigInt('0xff')).toBe(255n)
    expect(() => asBigInt('nope')).toThrow()
  })
})
