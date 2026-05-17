import { Command } from 'commander'
import {
  parseTransaction,
  serializeTransaction,
  type TransactionSerializable
} from 'viem'
import { publicClientFor, walletClientFor, type GlobalCtx } from '../lib/client.js'
import { loadAccount } from '../lib/wallet.js'
import { emit, isJson, jsonReplacer, printJson } from '../lib/output.js'
import { asAddress, asBigInt, asHex, parseJson } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('send')
    .requiredOption('--to <address>', 'recipient')
    .option('--value <wei>', 'wei to send', '0')
    .option('--data <hex>', 'calldata hex')
    .option('--nonce <n>', 'override nonce')
    .option('--gas <n>', 'override gas limit')
    .option('--max-fee-per-gas <wei>', 'EIP-1559 maxFeePerGas')
    .option('--max-priority-fee-per-gas <wei>', 'EIP-1559 maxPriorityFeePerGas')
    .option('--dry-run', 'prepare + sign locally; do not broadcast')
    .summary('send a transaction (sendTransaction). Needs VIEM_PRIVATE_KEY.')
    .action(async (opts: {
      to: string
      value?: string
      data?: string
      nonce?: string
      gas?: string
      maxFeePerGas?: string
      maxPriorityFeePerGas?: string
      dryRun?: boolean
    }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const account = loadAccount()
      const pubClient = publicClientFor(g)
      const txReq: any = {
        account,
        to: asAddress(opts.to),
        value: asBigInt(opts.value ?? '0'),
        ...(opts.data ? { data: asHex(opts.data) } : {}),
        ...(opts.nonce ? { nonce: Number(opts.nonce) } : {}),
        ...(opts.gas ? { gas: asBigInt(opts.gas) } : {}),
        ...(opts.maxFeePerGas ? { maxFeePerGas: asBigInt(opts.maxFeePerGas) } : {}),
        ...(opts.maxPriorityFeePerGas
          ? { maxPriorityFeePerGas: asBigInt(opts.maxPriorityFeePerGas) }
          : {})
      }
      const prepared = await pubClient.prepareTransactionRequest(txReq)
      if (opts.dryRun) {
        const serialized = await account.signTransaction(prepared as any)
        if (isJson()) printJson({ dryRun: true, signed: serialized, request: prepared })
        else {
          emit(JSON.stringify({ dryRun: true, signed: serialized, request: prepared }, jsonReplacer, 2))
        }
        return
      }
      const wallet = walletClientFor(g, account)
      const hash = await wallet.sendTransaction(prepared as any)
      emit(hash)
    })

  program
    .command('tx:parse')
    .argument('<serialized>', 'serialized transaction hex (0x02…)')
    .summary('parse a serialized transaction (parseTransaction)')
    .action((serialized: string) => {
      const parsed = parseTransaction(asHex(serialized))
      if (isJson()) printJson(parsed)
      else emit(JSON.stringify(parsed, jsonReplacer, 2))
    })

  program
    .command('tx:serialize')
    .argument('<json>', 'transaction JSON, or @path/to/tx.json')
    .option('--signature <hex>', 'optional signature to embed (r,s,v / serialized form)')
    .summary('serialize a transaction (serializeTransaction)')
    .action((json: string, opts: { signature?: string }) => {
      const tx = parseJson<TransactionSerializable>(json, '<json>')
      const revived = reviveBigInts(tx) as TransactionSerializable
      const serialized = opts.signature
        ? serializeTransaction(revived, parseSig(opts.signature) as any)
        : serializeTransaction(revived)
      emit(serialized)
    })

  program
    .command('tx:wait')
    .argument('<hash>', 'transaction hash')
    .option('--confirmations <n>', 'wait for N confirmations', '1')
    .option('--timeout <ms>', 'overall timeout in milliseconds')
    .summary('wait for a transaction receipt (waitForTransactionReceipt)')
    .action(async (hash: string, opts: { confirmations?: string; timeout?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const receipt = await client.waitForTransactionReceipt({
        hash: asHex(hash) as `0x${string}`,
        confirmations: Number(opts.confirmations ?? '1'),
        ...(opts.timeout ? { timeout: Number(opts.timeout) } : {})
      })
      if (isJson()) printJson(receipt)
      else emit(JSON.stringify(receipt, jsonReplacer, 2))
    })
}

function parseSig(input: string): { r: `0x${string}`; s: `0x${string}`; yParity: 0 | 1 } {
  const hex = asHex(input)
  if (hex.length !== 132) throw new Error('signature must be 65 bytes (0x + 130 hex chars)')
  return {
    r: (`0x${hex.slice(2, 66)}`) as `0x${string}`,
    s: (`0x${hex.slice(66, 130)}`) as `0x${string}`,
    yParity: (Number(`0x${hex.slice(130, 132)}`) % 2) as 0 | 1
  }
}

function reviveBigInts(input: any): any {
  if (input === null || input === undefined) return input
  if (typeof input !== 'object') return input
  const out: any = Array.isArray(input) ? [] : {}
  for (const [k, v] of Object.entries(input)) {
    if (
      typeof v === 'string' &&
      ['value', 'gas', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'nonce', 'chainId'].includes(k) &&
      /^-?\d+$/.test(v)
    ) {
      out[k] = BigInt(v)
    } else if (typeof v === 'object') {
      out[k] = reviveBigInts(v)
    } else {
      out[k] = v
    }
  }
  return out
}
