import { Command } from 'commander'
import { toHex, fromHex, toBytes, bytesToHex, type Hex } from 'viem'
import { emit, isJson, printJson } from '../lib/output.js'
import { asHex } from '../lib/parse.js'
import { errBadInput } from '../lib/errors.js'

type ToType = 'string' | 'number' | 'bigint' | 'boolean' | 'hex'

export function register(program: Command) {
  program
    .command('hex:from')
    .argument('<value>', 'value to encode')
    .option('--type <type>', 'source type: string|number|bigint|boolean', 'string')
    .option('--size <n>', 'pad result to <n> bytes')
    .summary('encode value to hex (toHex)')
    .description(
      [
        'Encode a string, number, bigint, or boolean to a 0x-prefixed hex string via',
        'viem\'s toHex(). Use --type to control how <value> is interpreted (default is',
        'utf-8 string). --size left-pads the output with zero bytes to the requested',
        'byte length, useful for ABI-style fixed-width encoding (e.g. --size 32).'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem hex:from hello',
        '  0x68656c6c6f',
        '',
        '  $ viem hex:from 420 --type number --size 32',
        '  0x00000000000000000000000000000000000000000000000000000000000001a4',
        '',
        '  $ viem hex:from true --type boolean',
        '  0x01',
        'Docs: https://viem.sh/docs/utilities/toHex',
        ''
      ].join('\n')
    )
    .action((value: string, opts: { type?: string; size?: string }) => {
      const size = opts.size ? Number(opts.size) : undefined
      const type = (opts.type ?? 'string') as ToType
      let input: any = value
      if (type === 'number') input = Number(value)
      else if (type === 'bigint') input = BigInt(value)
      else if (type === 'boolean') input = value === 'true'
      emit(toHex(input, size ? { size } : undefined))
    })

  program
    .command('hex:to')
    .argument('<hex>', 'hex string, e.g. 0x68656c6c6f')
    .option('--type <type>', 'target type: string|number|bigint|boolean', 'string')
    .summary('decode hex to value (fromHex)')
    .description(
      [
        'Decode a 0x-prefixed hex string back into a typed value via viem\'s fromHex().',
        'Pick the target shape with --type: string (utf-8), number, bigint, or boolean.',
        'Inverse of hex:from — round-trips for matching --type. Numbers larger than',
        'Number.MAX_SAFE_INTEGER should use --type bigint to avoid precision loss.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem hex:to 0x68656c6c6f',
        '  hello',
        '',
        '  $ viem hex:to 0x1a4 --type number',
        '  420',
        '',
        '  $ viem hex:to 0x01 --type boolean',
        '  true',
        'Docs: https://viem.sh/docs/utilities/fromHex',
        ''
      ].join('\n')
    )
    .action((hex: string, opts: { type?: string }) => {
      const h = asHex(hex)
      const type = (opts.type ?? 'string') as ToType
      if (type === 'string') emit(fromHex(h, 'string'))
      else if (type === 'number') emit(fromHex(h, 'number'))
      else if (type === 'bigint') emit(fromHex(h, 'bigint').toString())
      else if (type === 'boolean') emit(fromHex(h, 'boolean'))
      else throw errBadInput(`Unknown --type '${opts.type}'`)
    })

  program
    .command('bytes:from')
    .argument('<value>', 'value to convert to bytes (utf-8 string by default)')
    .option('--type <type>', 'source type: string|number|bigint|boolean|hex', 'string')
    .option('--size <n>', 'pad result to <n> bytes')
    .summary('convert value to byte array (toBytes) and print as hex')
    .description(
      [
        'Convert a value to a Uint8Array via viem\'s toBytes() and print the result',
        'as a 0x-hex string (with --json, also reports byte length). For most inputs',
        'the printed output matches hex:from — the difference is conceptual: reach',
        'for bytes:from when you\'re reasoning about a byte buffer (e.g. before',
        'feeding into a hash or fixed-size field). --size left-pads to <n> bytes.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem bytes:from hello',
        '  0x68656c6c6f',
        '',
        '  $ viem bytes:from 420 --type number --size 4',
        '  0x000001a4',
        '',
        '  $ viem --json bytes:from hello',
        '  {"hex":"0x68656c6c6f","length":5}',
        'Docs: https://viem.sh/docs/utilities/toBytes',
        ''
      ].join('\n')
    )
    .action((value: string, opts: { type?: string; size?: string }) => {
      const size = opts.size ? Number(opts.size) : undefined
      const type = (opts.type ?? 'string') as ToType
      let input: any = value
      if (type === 'number') input = Number(value)
      else if (type === 'bigint') input = BigInt(value)
      else if (type === 'boolean') input = value === 'true'
      else if (type === 'hex') input = asHex(value)
      const bytes = toBytes(input, size ? { size } : undefined)
      if (isJson()) {
        printJson({ hex: bytesToHex(bytes), length: bytes.length })
      } else {
        emit(bytesToHex(bytes))
      }
    })

  program
    .command('bytes:to')
    .argument('<hex>', 'hex bytes to convert')
    .option('--type <type>', 'target type: string|number|bigint|boolean', 'string')
    .summary('decode hex bytes (alias of hex:to)')
    .description(
      [
        'Decode a 0x-hex byte string into a typed value. Behavior is identical to',
        'hex:to and exists for naming symmetry with bytes:from — pick whichever',
        'reads more naturally in your script. Pass --type to choose string (utf-8),',
        'number, bigint, or boolean.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem bytes:to 0x68656c6c6f',
        '  hello',
        '',
        '  $ viem bytes:to 0x000001a4 --type number',
        '  420',
        'Docs: https://viem.sh/docs/utilities/fromHex',
        ''
      ].join('\n')
    )
    .action((hex: string, opts: { type?: string }) => {
      const h: Hex = asHex(hex)
      const type = (opts.type ?? 'string') as ToType
      if (type === 'string') emit(fromHex(h, 'string'))
      else if (type === 'number') emit(fromHex(h, 'number'))
      else if (type === 'bigint') emit(fromHex(h, 'bigint').toString())
      else if (type === 'boolean') emit(fromHex(h, 'boolean'))
      else throw errBadInput(`Unknown --type '${opts.type}'`)
    })
}
