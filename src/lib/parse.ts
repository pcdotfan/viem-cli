import {
  parseAbi,
  parseAbiItem,
  type Abi,
  type AbiFunction,
  type AbiEvent
} from 'viem'
import { errBadInput } from './errors.js'
import { readFileSync } from 'node:fs'

/**
 * Resolve an ABI from a CLI flag.
 *   - "/path/to/abi.json" → reads the file
 *   - "function foo(uint256)" or "[\"function foo(uint256)\"]" → parsed as human-readable
 *   - "[{...}]" → parsed as JSON
 */
export function loadAbi(input: string): Abi {
  if (!input) throw errBadInput('--abi is required')
  const trimmed = input.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? (parsed as Abi) : ([parsed] as Abi)
    } catch (e) {
      throw errBadInput('Failed to parse --abi as JSON', e)
    }
  }
  if (
    trimmed.startsWith('function ') ||
    trimmed.startsWith('event ') ||
    trimmed.startsWith('error ') ||
    trimmed.startsWith('constructor') ||
    trimmed.startsWith('struct ')
  ) {
    try {
      return parseAbi([trimmed])
    } catch (e) {
      throw errBadInput('Failed to parse --abi as human-readable signature', e)
    }
  }
  try {
    const raw = readFileSync(trimmed, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as Abi
    if (parsed && Array.isArray(parsed.abi)) return parsed.abi as Abi
    throw errBadInput(`File ${trimmed} did not contain an ABI array or { abi: [...] }`)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw errBadInput(
        `--abi: '${trimmed}' is not JSON, not a human-readable signature, and not a readable file.`
      )
    }
    throw e
  }
}

export function parseSignature(input: string): AbiFunction | AbiEvent {
  try {
    const item = parseAbiItem(input)
    if (item.type === 'function' || item.type === 'event') return item as AbiFunction | AbiEvent
    throw errBadInput(`Signature must be 'function …' or 'event …', got '${item.type}'`)
  } catch (e) {
    if (e instanceof Error && e.message.includes('Signature must be')) throw e
    throw errBadInput(`Invalid signature: '${input}'`, e)
  }
}

/**
 * Parse a list of CLI args (repeated --arg flag). JSON-decodes anything that
 * starts with [ { " (so users can pass arrays/objects/bigint-as-string), otherwise
 * leaves the value as a string.
 */
export function parseArgs(raw: string[] | undefined): unknown[] {
  if (!raw || raw.length === 0) return []
  return raw.map((s) => coerceArg(s))
}

export function coerceArg(s: string): unknown {
  const trimmed = s.trim()
  if (
    trimmed.startsWith('[') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('"')
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // fall through
    }
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+$/.test(trimmed)) {
    // keep big numbers as bigint to be safe
    const n = BigInt(trimmed)
    if (n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= -BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(n)
    }
    return n
  }
  return trimmed
}

export function parseTypes(input: string): string[] {
  const trimmed = input.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
        return parsed
      }
    } catch {
      // fall through
    }
  }
  return trimmed.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
}

export function parseJson<T = unknown>(input: string, flag: string): T {
  const trimmed = input.trim()
  const source = trimmed.startsWith('@')
    ? readFileSync(trimmed.slice(1), 'utf8')
    : trimmed
  try {
    return JSON.parse(source) as T
  } catch (e) {
    throw errBadInput(`${flag}: invalid JSON`, e)
  }
}

export function asHex(input: string, label = 'value'): `0x${string}` {
  const trimmed = input.trim()
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]*$/.test(withPrefix)) {
    throw errBadInput(`${label}: not a valid hex string`)
  }
  return withPrefix as `0x${string}`
}

export function asAddress(input: string, label = 'address'): `0x${string}` {
  const trimmed = input.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw errBadInput(`${label}: must be a 20-byte hex address`)
  }
  return trimmed as `0x${string}`
}

export function asBigInt(input: string, label = 'value'): bigint {
  try {
    return BigInt(input)
  } catch (e) {
    throw errBadInput(`${label}: must be an integer`, e)
  }
}
