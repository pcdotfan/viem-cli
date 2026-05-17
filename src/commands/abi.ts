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
    .description(
      [
        'Convert one or more human-readable Solidity signatures into a JSON ABI using viem\'s',
        'parseAbi(). Accepts function, event, error, constructor, and struct declarations.',
        'Useful for generating an ABI fragment to pipe into other tools or save to a file,',
        'without authoring JSON by hand. Quote each signature so the shell does not split on parens.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem abi:parse "function balanceOf(address) view returns (uint256)"',
        '',
        '  $ viem abi:parse \\',
        '      "function transfer(address to, uint256 amount) returns (bool)" \\',
        '      "event Transfer(address indexed from, address indexed to, uint256 value)"',
        '',
        '  $ viem --json abi:parse "function totalSupply() view returns (uint256)" > erc20.json',
        'Docs: https://viem.sh/docs/abi/parseAbi',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Build calldata (4-byte selector + ABI-encoded args) for a contract function using',
        'viem\'s encodeFunctionData(). --abi accepts a human-readable signature, JSON ABI,',
        'or file path; pass --args once per argument (in order). Handy for crafting tx.data,',
        'building inner calls for multicall/forwarders, or pairing with eth_call by hand.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem abi:encode-function \\',
        '      --abi "function balanceOf(address) view returns (uint256)" \\',
        '      --function balanceOf \\',
        '      --args 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '',
        '  $ viem abi:encode-function \\',
        '      --abi "function transfer(address,uint256) returns (bool)" \\',
        '      --function transfer \\',
        '      --args 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --args 1000000',
        'Docs: https://viem.sh/docs/contract/encodeFunctionData',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Decode the hex return-data from an eth_call (or any raw function return) into typed',
        'values using viem\'s decodeFunctionResult(). Provide the same ABI and function name',
        'used to encode the call. --abi accepts a human-readable signature, JSON ABI, or file path.',
        'Useful when you have raw RPC output and want JS-side values without re-calling readContract.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem abi:decode-function \\',
        '      --abi "function totalSupply() view returns (uint256)" \\',
        '      --function totalSupply \\',
        '      --data 0x00000000000000000000000000000000000000000000000000000000000f4240',
        '',
        '  $ viem --json abi:decode-function \\',
        '      --abi ./erc20.json --function balanceOf \\',
        '      --data 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
        'Docs: https://viem.sh/docs/contract/decodeFunctionResult',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'ABI-encode a tuple of typed values into hex using viem\'s encodeAbiParameters().',
        'No function selector is prepended — this is raw parameter encoding, ideal for abi.encode()',
        'parity, signed payloads, or building Merkle leaves. Pass --types as a CSV like',
        '"uint256,address" or a JSON array like \'["uint256","address"]\'. Repeat --values once per',
        'type in order. The count of --values must match the number of types.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem abi:encode --types "uint256,address" \\',
        '      --values 1000000 --values 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '',
        '  $ viem abi:encode --types \'["bool","bytes32"]\' \\',
        '      --values true --values 0x0000000000000000000000000000000000000000000000000000000000000001',
        'Docs: https://viem.sh/docs/abi/encodeAbiParameters',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Decode raw ABI-encoded hex into typed values using viem\'s decodeAbiParameters().',
        'This is the inverse of abi:encode — no function selector is expected, just the encoded',
        'parameter tuple. Pass --types as a CSV like "uint256,address" or a JSON array like',
        '\'["uint256","address"]\'. Useful for decoding signed payloads, event data fields, or',
        'the inner bytes returned from low-level calls.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem abi:decode --types "uint256,address" \\',
        '      --data 0x00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045',
        '',
        '  $ viem --json abi:decode --types \'["bool"]\' \\',
        '      --data 0x0000000000000000000000000000000000000000000000000000000000000001',
        'Docs: https://viem.sh/docs/abi/decodeAbiParameters',
        ''
      ].join('\n')
    )
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
