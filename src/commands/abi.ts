import { Command } from 'commander'
import {
  decodeAbiParameters,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi
} from 'viem'
import { emit, isJson, printJson, jsonReplacer } from '../lib/output.js'
import { coerceArg, loadAbi, parseTypes, asHex } from '../lib/parse.js'
import { errBadInput } from '../lib/errors.js'

export function register(program: Command) {
  program
    .command('abi:parse')
    .argument('<signatures...>', 'human-readable signatures, e.g. "function balanceOf(address) view returns (uint256)"')
    .summary('parse human-readable ABI signatures to JSON ABI')
    .action((signatures: string[]) => {
      const abi = parseAbi(signatures as any)
      if (isJson()) printJson(abi)
      else process.stdout.write(JSON.stringify(abi, jsonReplacer, 2) + '\n')
    })

  program
    .command('abi:encode-function')
    .requiredOption('--abi <abi>', 'JSON ABI, human-readable signature, or path to abi file')
    .requiredOption('--function <name>', 'function name to encode')
    .option('--args <arg>', 'argument value (repeat for multiple)', collect, [] as string[])
    .summary('encode a function call (encodeFunctionData)')
    .action((opts: { abi: string; function: string; args: string[] }) => {
      const abi = loadAbi(opts.abi)
      const args = (opts.args ?? []).map(coerceArg)
      const data = encodeFunctionData({
        abi,
        functionName: opts.function,
        args
      })
      emit(data)
    })

  program
    .command('abi:decode-function')
    .requiredOption('--abi <abi>', 'JSON ABI, human-readable signature, or path to abi file')
    .requiredOption('--function <name>', 'function name whose return value to decode')
    .requiredOption('--data <hex>', 'return-data hex from eth_call')
    .summary('decode function return data (decodeFunctionResult)')
    .action((opts: { abi: string; function: string; data: string }) => {
      const abi = loadAbi(opts.abi)
      const decoded = decodeFunctionResult({
        abi,
        functionName: opts.function,
        data: asHex(opts.data)
      })
      if (isJson()) printJson({ decoded })
      else emit(JSON.stringify(decoded, jsonReplacer, 2))
    })

  program
    .command('abi:encode')
    .requiredOption('--types <types>', 'comma-separated types or JSON array, e.g. "uint256,address"')
    .option('--values <value>', 'value (repeat for each type)', collect, [] as string[])
    .summary('encode ABI parameters (encodeAbiParameters)')
    .action((opts: { types: string; values: string[] }) => {
      const types = parseTypes(opts.types).map((t) => ({ type: t }))
      const values = (opts.values ?? []).map(coerceArg)
      if (types.length !== values.length) {
        throw errBadInput(
          `--types has ${types.length} entries but --values has ${values.length}`
        )
      }
      emit(encodeAbiParameters(types as any, values as any))
    })

  program
    .command('abi:decode')
    .requiredOption('--types <types>', 'comma-separated types or JSON array, e.g. "uint256,address"')
    .requiredOption('--data <hex>', 'encoded hex data')
    .summary('decode ABI parameters (decodeAbiParameters)')
    .action((opts: { types: string; data: string }) => {
      const types = parseTypes(opts.types).map((t) => ({ type: t }))
      const decoded = decodeAbiParameters(types as any, asHex(opts.data))
      if (isJson()) printJson({ decoded })
      else emit(JSON.stringify(decoded, jsonReplacer, 2))
    })
}

function collect(value: string, prev: string[]): string[] {
  return [...prev, value]
}
