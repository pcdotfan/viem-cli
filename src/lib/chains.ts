import type { Chain } from 'viem'
import * as allChains from 'viem/chains'
import { errBadInput } from './errors.js'

const chainList: Chain[] = (Object.values(allChains) as unknown[]).filter(
  (v): v is Chain =>
    !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number'
)

const byKey = new Map<string, Chain>()
const setOnce = (key: string, ch: Chain) => {
  if (!byKey.has(key)) byKey.set(key, ch)
}
for (const ch of chainList) {
  const exportName = Object.entries(allChains).find(([, v]) => v === ch)?.[0]
  if (exportName) setOnce(exportName.toLowerCase(), ch)
  setOnce(ch.name.toLowerCase(), ch)
  setOnce(String(ch.id), ch)
}

/**
 * Resolve a chain by viem export name (mainnet, base, arbitrum, optimism, …),
 * full chain name (e.g. "OP Mainnet"), or chain id.
 */
export function resolveChain(input: string | number | undefined): Chain {
  const key = input === undefined ? 'mainnet' : String(input).toLowerCase().trim()
  const chain = byKey.get(key)
  if (chain) return chain
  throw errBadInput(
    `Unknown chain '${input}'. Use a viem export name (mainnet, base, arbitrum, optimism, sepolia, …) or a numeric id.`
  )
}

export function listChains(filter?: string): Chain[] {
  if (!filter) return chainList
  const q = filter.toLowerCase()
  return chainList.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      String(c.id) === q ||
      c.nativeCurrency.symbol.toLowerCase() === q
  )
}

export function chainExportName(chain: Chain): string | undefined {
  return Object.entries(allChains).find(([, v]) => v === chain)?.[0]
}

export function pickRpcUrl(chain: Chain, override?: string): string | undefined {
  if (override) return override
  const envPerId = process.env[`VIEM_RPC_URL_${chain.id}`]
  if (envPerId) return envPerId
  const envGeneric = process.env.VIEM_RPC_URL
  if (envGeneric) return envGeneric
  return chain.rpcUrls.default.http[0]
}
