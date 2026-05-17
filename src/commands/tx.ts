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
    .description(
      [
        'Build, sign with VIEM_PRIVATE_KEY, and broadcast a transaction via viem\'s',
        'sendTransaction. Missing fields (nonce, gas, EIP-1559 fees) are filled in',
        'by prepareTransactionRequest against the configured chain/RPC, so the',
        'minimum required flag is --to. On success, prints the transaction hash.',
        '',
        'IMPORTANT: this spends real funds on whatever chain you point it at. Use',
        '--dry-run first to prepare and locally sign without broadcasting — output',
        'is the serialized signed tx (the same hex eth_sendRawTransaction expects),',
        'useful for inspection or relaying from elsewhere.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  # dry-run first to see exactly what would be sent:',
        '  $ viem -c sepolia send --to 0xd8dA…6045 --value 1000000000000000 --dry-run',
        '',
        '  # actually broadcast (prints tx hash on stdout):',
        '  $ viem -c sepolia send --to 0xd8dA…6045 --value 1000000000000000',
        '  0x…txhash',
        '',
        '  # send + wait for confirmation in one pipeline:',
        '  $ viem tx:wait $(viem -c sepolia send --to 0xd8dA…6045 --value 0 --data 0xdeadbeef)',
        'Docs: https://viem.sh/docs/actions/wallet/sendTransaction',
        ''
      ].join('\n')
    )
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

      if (opts.dryRun) {
        // Local-only prep: fetch only the fields we need so we never trip the
        // balance check in prepareTransactionRequest. Defaults to a 21000 gas
        // simple-transfer budget; pass --gas to override for contract calls.
        const needsFees = !(opts.maxFeePerGas && opts.maxPriorityFeePerGas)
        const [nonce, fees, chainId] = await Promise.all([
          opts.nonce
            ? Promise.resolve(Number(opts.nonce))
            : pubClient.getTransactionCount({ address: account.address }),
          needsFees
            ? pubClient.estimateFeesPerGas()
            : Promise.resolve({
                maxFeePerGas: asBigInt(opts.maxFeePerGas!),
                maxPriorityFeePerGas: asBigInt(opts.maxPriorityFeePerGas!)
              }),
          pubClient.getChainId()
        ])
        const tx = {
          type: 'eip1559' as const,
          chainId,
          to: asAddress(opts.to),
          value: asBigInt(opts.value ?? '0'),
          ...(opts.data ? { data: asHex(opts.data) } : {}),
          nonce: nonce as number,
          gas: opts.gas ? asBigInt(opts.gas) : 21000n,
          maxFeePerGas: (fees as any).maxFeePerGas,
          maxPriorityFeePerGas: (fees as any).maxPriorityFeePerGas
        }
        const signed = await account.signTransaction(tx as any)
        if (isJson()) printJson({ dryRun: true, signed, request: tx })
        else emit(JSON.stringify({ dryRun: true, signed, request: tx }, jsonReplacer, 2))
        return
      }

      const wallet = walletClientFor(g, account)
      const hash = await wallet.sendTransaction({
        to: asAddress(opts.to),
        value: asBigInt(opts.value ?? '0'),
        ...(opts.data ? { data: asHex(opts.data) } : {}),
        ...(opts.nonce ? { nonce: Number(opts.nonce) } : {}),
        ...(opts.gas ? { gas: asBigInt(opts.gas) } : {}),
        ...(opts.maxFeePerGas ? { maxFeePerGas: asBigInt(opts.maxFeePerGas) } : {}),
        ...(opts.maxPriorityFeePerGas
          ? { maxPriorityFeePerGas: asBigInt(opts.maxPriorityFeePerGas) }
          : {}),
        account,
        chain: null
      } as any)
      emit(hash)
    })

  program
    .command('tx:parse')
    .argument('<serialized>', 'serialized transaction hex (0x02…)')
    .summary('parse a serialized transaction (parseTransaction)')
    .description(
      [
        'Decode an EIP-2718-typed serialized transaction back into its structured',
        'fields using viem\'s parseTransaction. Accepts legacy, EIP-2930 (0x01…),',
        'EIP-1559 (0x02…), and other typed envelopes viem supports. Works on both',
        'signed and unsigned payloads. Output is JSON (bigints rendered as decimal',
        'strings); use --json for machine-readable single-line output.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem tx:parse 0x02f8500182031180808252088080…',
        '',
        '  # round-trip a sign:transaction result:',
        '  $ viem tx:parse $(viem sign:transaction @tx.json)',
        'Docs: https://viem.sh/docs/utilities/parseTransaction',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Encode a TransactionSerializable JSON object into the RLP/typed-envelope',
        'hex form using viem\'s serializeTransaction (legacy, EIP-2930, EIP-1559).',
        'Numeric fields may be supplied as decimal strings — they\'re revived to',
        'bigint before encoding. Without --signature the output is the unsigned',
        'pre-image you can hash and sign offline; pass an existing 65-byte hex',
        'signature via --signature to produce the broadcastable signed form.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  # unsigned serialized tx (useful for hashing / hardware wallets):',
        '  $ viem tx:serialize \'{"chainId":"1","nonce":"7","to":"0xd8dA…6045","value":"0","gas":"21000","maxFeePerGas":"30000000000","maxPriorityFeePerGas":"1000000000"}\'',
        '',
        '  # attach a pre-computed signature to produce the signed serialized form:',
        '  $ viem tx:serialize @tx.json --signature 0x…65bytes',
        'Docs: https://viem.sh/docs/utilities/serializeTransaction',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Poll the configured RPC with viem\'s waitForTransactionReceipt until <hash>',
        'has been mined and reached --confirmations blocks (default: 1). Useful for',
        'gating shell scripts on a pending tx — chain it directly on the output of',
        '`viem send`, e.g. `viem tx:wait $(viem send --to 0x… --value 0 …)`. Prints',
        'the full receipt as JSON (bigints as decimal strings). Honors --timeout in',
        'milliseconds; without it, viem\'s default (~180s) applies.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem tx:wait 0xabc…txhash',
        '',
        '  # wait for 3 confirmations with a 5-minute cap:',
        '  $ viem tx:wait 0xabc…txhash --confirmations 3 --timeout 300000',
        '',
        '  # send + wait in one shot:',
        '  $ viem tx:wait $(viem -c sepolia send --to 0xd8dA…6045 --value 0)',
        'Docs: https://viem.sh/docs/actions/public/waitForTransactionReceipt',
        ''
      ].join('\n')
    )
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
