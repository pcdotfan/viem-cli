import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { errBadInput, errMissingEnv } from './errors.js'

const ENV = 'VIEM_PRIVATE_KEY'

export function loadAccount(override?: string): PrivateKeyAccount {
  const raw = override ?? process.env[ENV]
  if (!raw) throw errMissingEnv(ENV, 'Set a 32-byte hex private key.')
  return privateKeyToAccount(normalizeHexKey(raw))
}

export function tryLoadAccount(override?: string): PrivateKeyAccount | undefined {
  const raw = override ?? process.env[ENV]
  if (!raw) return undefined
  return privateKeyToAccount(normalizeHexKey(raw))
}

export function normalizeHexKey(raw: string): `0x${string}` {
  const trimmed = raw.trim()
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw errBadInput(
      'Private key must be a 32-byte hex string (with or without 0x prefix).'
    )
  }
  return withPrefix as `0x${string}`
}
