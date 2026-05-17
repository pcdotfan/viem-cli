import { Command } from 'commander'
import {
  recoverAddress,
  recoverMessageAddress,
  recoverTypedDataAddress,
  verifyMessage,
  verifyTypedData,
  serializeTransaction,
  type TransactionSerializable
} from 'viem'
import { emit, isJson, printJson } from '../lib/output.js'
import { loadAccount } from '../lib/wallet.js'
import { asAddress, asHex, parseJson } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('sign:message')
    .argument('<message>', 'message text; use --hex for hex bytes')
    .option('--hex', 'treat <message> as a hex byte string')
    .summary('sign a message (EIP-191) with VIEM_PRIVATE_KEY')
    .action(async (message: string, opts: { hex?: boolean }) => {
      const account = loadAccount()
      const sig = await account.signMessage({
        message: opts.hex ? { raw: asHex(message) } : message
      })
      emit(sig)
    })

  program
    .command('sign:typed-data')
    .argument('<json>', 'EIP-712 typed data JSON, or @path/to/typed.json')
    .summary('sign EIP-712 typed data with VIEM_PRIVATE_KEY')
    .action(async (json: string) => {
      const account = loadAccount()
      const td = parseJson<any>(json, '<json>')
      const sig = await account.signTypedData(td)
      emit(sig)
    })

  program
    .command('sign:transaction')
    .argument('<json>', 'transaction JSON, or @path/to/tx.json')
    .summary('sign a transaction with VIEM_PRIVATE_KEY')
    .action(async (json: string) => {
      const account = loadAccount()
      const tx = parseJson<TransactionSerializable>(json, '<json>')
      const sig = await account.signTransaction(reviveBigInts(tx) as any)
      emit(sig)
    })

  program
    .command('verify:message')
    .requiredOption('--address <address>', 'expected signer address')
    .requiredOption('--message <message>', 'message text; use --hex for hex bytes')
    .requiredOption('--signature <hex>', 'signature hex')
    .option('--hex', 'treat --message as hex bytes')
    .summary('verify an EIP-191 message signature')
    .action(async (opts: { address: string; message: string; signature: string; hex?: boolean }) => {
      const ok = await verifyMessage({
        address: asAddress(opts.address),
        message: opts.hex ? { raw: asHex(opts.message) } : opts.message,
        signature: asHex(opts.signature)
      })
      if (isJson()) printJson({ valid: ok })
      else {
        emit(ok ? 'true' : 'false')
        if (!ok) process.exitCode = 1
      }
    })

  program
    .command('verify:typed-data')
    .requiredOption('--address <address>', 'expected signer address')
    .requiredOption('--data <json>', 'EIP-712 typed data JSON, or @path/to/typed.json')
    .requiredOption('--signature <hex>', 'signature hex')
    .summary('verify an EIP-712 typed-data signature')
    .action(async (opts: { address: string; data: string; signature: string }) => {
      const td = parseJson<any>(opts.data, '--data')
      const ok = await verifyTypedData({
        address: asAddress(opts.address),
        ...td,
        signature: asHex(opts.signature)
      })
      if (isJson()) printJson({ valid: ok })
      else {
        emit(ok ? 'true' : 'false')
        if (!ok) process.exitCode = 1
      }
    })

  program
    .command('recover:address')
    .requiredOption('--message <message>', 'original message; use --hex for hex bytes')
    .requiredOption('--signature <hex>', 'signature hex')
    .option('--hex', 'treat --message as hex bytes')
    .option('--hash <hex>', 'recover from a raw hash instead of a message')
    .summary('recover signer from a message + signature (recoverMessageAddress / recoverAddress)')
    .action(async (opts: { message?: string; signature: string; hex?: boolean; hash?: string }) => {
      if (opts.hash) {
        const addr = await recoverAddress({
          hash: asHex(opts.hash),
          signature: asHex(opts.signature)
        })
        emit(addr)
        return
      }
      const addr = await recoverMessageAddress({
        message: opts.hex ? { raw: asHex(opts.message!) } : opts.message!,
        signature: asHex(opts.signature)
      })
      emit(addr)
    })

  program
    .command('recover:typed-data')
    .requiredOption('--data <json>', 'EIP-712 typed data JSON, or @path/to/typed.json')
    .requiredOption('--signature <hex>', 'signature hex')
    .summary('recover signer from EIP-712 typed data + signature')
    .action(async (opts: { data: string; signature: string }) => {
      const td = parseJson<any>(opts.data, '--data')
      const addr = await recoverTypedDataAddress({
        ...td,
        signature: asHex(opts.signature)
      })
      emit(addr)
    })
}

/**
 * Recursively turn numeric strings tagged as bigints into BigInt. We accept
 * decimal-number strings for value/gas/etc so JSON files don't need quoting tricks.
 */
function reviveBigInts(input: any): any {
  if (input === null || input === undefined) return input
  if (typeof input !== 'object') return input
  const out: any = Array.isArray(input) ? [] : {}
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string' && /^\d+n$/.test(v)) {
      out[k] = BigInt(v.slice(0, -1))
    } else if (
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

// Kept for callers that might import; not used directly.
export const _serializeTransaction = serializeTransaction
