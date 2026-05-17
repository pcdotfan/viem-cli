import { Command } from 'commander'
import { keccak256, hashMessage, hashTypedData, toBytes, type TypedData } from 'viem'
import { emit } from '../lib/output.js'
import { parseJson, asHex } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('hash:keccak256')
    .argument('<value>', 'input. Hex if it starts with 0x, otherwise treated as utf-8 string')
    .summary('keccak256 hash')
    .action((value: string) => {
      const bytes = value.startsWith('0x') ? asHex(value) : toBytes(value)
      emit(keccak256(bytes))
    })

  program
    .command('hash:message')
    .argument('<message>', 'message text; pass --hex to treat as hex bytes')
    .option('--hex', 'treat <message> as a hex byte string instead of utf-8')
    .summary('EIP-191 personal-sign message hash')
    .action((message: string, opts: { hex?: boolean }) => {
      const m = opts.hex ? { raw: asHex(message) } : message
      emit(hashMessage(m))
    })

  program
    .command('hash:typed-data')
    .argument('<json>', 'EIP-712 typed data as JSON, or @path/to/typed.json')
    .summary('EIP-712 typed-data hash')
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
