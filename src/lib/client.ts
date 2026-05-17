import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
  type WalletClient
} from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import { resolveChain, pickRpcUrl } from './chains.js'

export type GlobalCtx = {
  chain?: string
  rpcUrl?: string
}

export function publicClientFor(ctx: GlobalCtx): PublicClient {
  const chain = resolveChain(ctx.chain)
  const url = pickRpcUrl(chain, ctx.rpcUrl)
  return createPublicClient({
    chain,
    transport: http(url)
  }) as PublicClient
}

export function walletClientFor(
  ctx: GlobalCtx,
  account: PrivateKeyAccount
): WalletClient {
  const chain = resolveChain(ctx.chain)
  const url = pickRpcUrl(chain, ctx.rpcUrl)
  return createWalletClient({
    account,
    chain,
    transport: http(url)
  }) as unknown as WalletClient
}

export function resolvedChain(ctx: GlobalCtx): Chain {
  return resolveChain(ctx.chain)
}
