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
