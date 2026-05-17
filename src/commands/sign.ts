import { Command } from 'commander'
import {
  recoverAddress,
  recoverMessageAddress,
  recoverTypedDataAddress,
  serializeTransaction,
  type TransactionSerializable
} from 'viem'
import { publicClientFor, type GlobalCtx } from '../lib/client.js'
import { emit, isJson, printJson } from '../lib/output.js'
import { loadAccount } from '../lib/wallet.js'
import { asAddress, asHex, parseJson } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('sign:message')
    .argument('<message>', 'message text; use --hex for hex bytes')
    .option('--hex', 'treat <message> as a hex byte string')
    .summary('sign a message (EIP-191) with VIEM_PRIVATE_KEY')
    .description(
      [
        'Produce an EIP-191 personal_sign signature over <message> using the local',
        'account loaded from VIEM_PRIVATE_KEY. By default the input is treated as',
        'a UTF-8 string and prefixed with "\\x19Ethereum Signed Message:\\n<len>"',
        'before hashing; with --hex the argument is signed as raw bytes instead.',
        'Outputs the 65-byte signature as hex; pair with verify:message or',
        'recover:address to confirm the signer.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem sign:message "hello world"',
        '  0x… (65-byte signature)',
        '',
        '  # sign then verify in one shell flow:',
        '  $ SIG=$(viem sign:message "hello world")',
        '  $ viem verify:message --address 0xYourAddr --message "hello world" --signature $SIG',
        '  true',
        '',
        '  $ viem sign:message --hex 0xdeadbeef',
        'Docs: https://viem.sh/docs/accounts/local/signMessage',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Sign EIP-712 structured data with VIEM_PRIVATE_KEY. The JSON payload must',
        'contain `domain`, `types`, `primaryType`, and `message` — the same shape',
        'accepted by viem\'s signTypedData. Pass the JSON inline or via @path.json',
        'for anything non-trivial (quoting nested objects in a shell is painful).',
        'Outputs a hex signature suitable for verify:typed-data and on-chain',
        'consumers that check `\\x19\\x01 || domainSeparator || hashStruct(message)`.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem sign:typed-data \'{"domain":{"name":"x","chainId":1},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"chainId","type":"uint256"}],"Person":[{"name":"name","type":"string"}]},"primaryType":"Person","message":{"name":"Alice"}}\'',
        '',
        '  $ viem sign:typed-data @typed.json',
        'Docs: https://viem.sh/docs/accounts/local/signTypedData',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Sign a serializable transaction object locally with VIEM_PRIVATE_KEY and',
        'print the RLP-serialized signed tx hex (the same shape `eth_sendRawTransaction`',
        'expects). Use this when you want to broadcast from a different machine, an',
        'offline signer, or a custom relayer. Numeric fields like value/gas/nonce/',
        'chainId may be supplied as decimal strings — they\'re revived to bigint',
        'before signing. Supports legacy, EIP-2930, and EIP-1559 transaction types.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem sign:transaction \'{"to":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","value":"1000000000000000","chainId":"1","nonce":"7","maxFeePerGas":"30000000000","maxPriorityFeePerGas":"1000000000","gas":"21000"}\'',
        '  0x02f8…',
        '',
        '  $ viem sign:transaction @tx.json',
        'Docs: https://viem.sh/docs/accounts/local/signTransaction',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Check whether --signature over --message was produced by the private key',
        'controlling --address. Mirrors viem\'s verifyMessage: it works for EOAs',
        'and also for ERC-1271 smart-account signatures, since the configured',
        'chain client is used to call isValidSignature on contract accounts.',
        'Prints `true`/`false` (or {valid} under --json) and exits 1 on mismatch.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ SIG=$(viem sign:message "gm")',
        '  $ viem verify:message --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --message "gm" --signature $SIG',
        '  true',
        '',
        '  $ viem -c sepolia verify:message --address 0xSmartAccount --message "login" --signature 0x…',
        'Docs: https://viem.sh/docs/utilities/verifyMessage',
        ''
      ].join('\n')
    )
    .action(async (opts: { address: string; message: string; signature: string; hex?: boolean }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const ok = await client.verifyMessage({
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
    .description(
      [
        'Check whether --signature over the EIP-712 typed data in --data was',
        'produced by --address. Note that typed data is passed via --data (NOT',
        '--json — that is the global output-format flag). Supports ERC-1271',
        'smart-account signatures via the configured chain client. Prints',
        '`true`/`false` (or {valid} under --json) and exits 1 on mismatch.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem verify:typed-data --address 0xd8dA…6045 --data @typed.json --signature 0x…',
        '  true',
        '',
        '  $ viem --json verify:typed-data --address 0xSmartAccount --data @typed.json --signature 0x…',
        'Docs: https://viem.sh/docs/utilities/verifyTypedData',
        ''
      ].join('\n')
    )
    .action(async (opts: { address: string; data: string; signature: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const td = parseJson<any>(opts.data, '--data')
      const ok = await client.verifyTypedData({
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
    .description(
      [
        'Recover the EOA that produced --signature. By default this calls viem\'s',
        'recoverMessageAddress, applying the EIP-191 prefix to --message before',
        'hashing. With --hash, the value is treated as a pre-computed 32-byte',
        'digest and viem\'s recoverAddress is used directly (no prefix). Useful',
        'for sanity-checking sign:message output without knowing the address up',
        'front — recovery returning the expected signer is a positive proof.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ SIG=$(viem sign:message "gm")',
        '  $ viem recover:address --message "gm" --signature $SIG',
        '  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045   # same address that signed',
        '',
        '  $ viem recover:address --hash 0xabc…32-byte-digest --signature 0x…',
        'Docs: https://viem.sh/docs/utilities/recoverMessageAddress',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Recover the EOA that signed an EIP-712 payload. Mirrors viem\'s',
        'recoverTypedDataAddress: --data takes the full {domain, types,',
        'primaryType, message} JSON (or @path.json) and --signature is the hex',
        'output from sign:typed-data. Handy for verifying off-chain orders,',
        'permits, and similar structured payloads without a known signer.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ SIG=$(viem sign:typed-data @typed.json)',
        '  $ viem recover:typed-data --data @typed.json --signature $SIG',
        '  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'Docs: https://viem.sh/docs/utilities/recoverTypedDataAddress',
        ''
      ].join('\n')
    )
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
