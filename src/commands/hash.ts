import { Command } from 'commander'
import { keccak256, hashMessage, hashTypedData, toBytes, type TypedData } from 'viem'
import { emit } from '../lib/output.js'
import { parseJson, asHex } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('hash:keccak256')
    .argument('<value>', 'input. Hex if it starts with 0x, otherwise treated as utf-8 string')
    .summary('keccak256 hash')
    .description(
      [
        'Compute the keccak256 hash of the input using viem\'s keccak256(). Inputs',
        'starting with 0x are decoded as raw hex bytes; anything else is hashed as',
        'its UTF-8 byte representation. Output is a 32-byte (0x-prefixed, 66-char)',
        'hex string — the same primitive Solidity exposes as keccak256().'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem hash:keccak256 hello',
        '  0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8',
        '',
        '  $ viem hash:keccak256 0xdeadbeef',
        '  0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1',
        'Docs: https://viem.sh/docs/utilities/keccak256',
        ''
      ].join('\n')
    )
    .action((value: string) => {
      const bytes = value.startsWith('0x') ? asHex(value) : toBytes(value)
      emit(keccak256(bytes))
    })

  program
    .command('hash:message')
    .argument('<message>', 'message text; pass --hex to treat as hex bytes')
    .option('--hex', 'treat <message> as a hex byte string instead of utf-8')
    .summary('EIP-191 personal-sign message hash')
    .description(
      [
        'Compute the EIP-191 personal_sign digest via viem\'s hashMessage(). This is',
        'keccak256("\\x19Ethereum Signed Message:\\n" + len(msg) + msg), and it is',
        'the value that actually gets signed when a wallet executes personal_sign /',
        'eth_sign. Use --hex when the message is raw bytes (e.g. an existing 32-byte',
        'digest) rather than user-readable text.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem hash:message "hello world"',
        '  0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68',
        '',
        '  $ viem hash:message --hex 0xdeadbeef',
        'Docs: https://viem.sh/docs/utilities/hashMessage',
        ''
      ].join('\n')
    )
    .action((message: string, opts: { hex?: boolean }) => {
      const m = opts.hex ? { raw: asHex(message) } : message
      emit(hashMessage(m))
    })

  program
    .command('hash:typed-data')
    .argument('<json>', 'EIP-712 typed data as JSON, or @path/to/typed.json')
    .summary('EIP-712 typed-data hash')
    .description(
      [
        'Compute the EIP-712 typed-data digest via viem\'s hashTypedData(). The input',
        'is a JSON object with `domain`, `types`, `primaryType`, and `message` —',
        'pass it inline or as @path/to/file.json to read from disk. Output is',
        'keccak256("\\x19\\x01" ‖ domainSeparator ‖ hashStruct(message)), i.e. the',
        'digest a wallet signs for eth_signTypedData_v4.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem hash:typed-data @./permit.json',
        '',
        '  $ viem hash:typed-data \'{"domain":{...},"types":{...},"primaryType":"Mail","message":{...}}\'',
        'Docs: https://viem.sh/docs/utilities/hashTypedData',
        ''
      ].join('\n')
    )
    .action((json: string) => {
      const td = parseJson<{
        domain: object
        types: TypedData
        primaryType: string
        message: object
      }>(json, '<json>')
      emit(hashTypedData(td as any))
    })
}
