import { Command } from 'commander'
import { parseEther, formatEther, parseGwei, formatGwei, parseUnits, formatUnits } from 'viem'
import { emit } from '../lib/output.js'
import { errBadInput } from '../lib/errors.js'

export function register(program: Command) {
  program
    .command('units:parse-ether')
    .argument('<value>', 'decimal ether amount, e.g. 1.5')
    .summary('parse ether → wei (bigint string)')
    .description(
      [
        'Convert a decimal ether amount to wei using viem\'s parseEther(). Ether has',
        '18 decimals, so the result is multiplied by 10^18 and printed as a bigint',
        'string suitable for piping into other tools. Fractional input beyond 18',
        'decimals is rejected — use units:parse with a larger exponent if you need',
        'finer granularity.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem units:parse-ether 1.5',
        '  1500000000000000000',
        '',
        '  $ viem units:parse-ether 0.0001',
        '  100000000000000',
        'Docs: https://viem.sh/docs/utilities/parseEther',
        ''
      ].join('\n')
    )
    .action((value: string) => {
      emit(parseEther(value).toString())
    })

  program
    .command('units:format-ether')
    .argument('<wei>', 'wei amount, decimal or hex 0x…')
    .summary('format wei → ether')
    .description(
      [
        'Convert a wei amount to a human-readable decimal ether string using viem\'s',
        'formatEther(). The input is parsed as a bigint and may be supplied in',
        'decimal or 0x-prefixed hex form. Trailing zeros are trimmed; values smaller',
        'than 1 wei are not representable.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem units:format-ether 1500000000000000000',
        '  1.5',
        '',
        '  $ viem units:format-ether 0xde0b6b3a7640000',
        '  1',
        'Docs: https://viem.sh/docs/utilities/formatEther',
        ''
      ].join('\n')
    )
    .action((wei: string) => {
      emit(formatEther(parseBig(wei)))
    })

  program
    .command('units:parse-gwei')
    .argument('<value>', 'decimal gwei amount, e.g. 30')
    .summary('parse gwei → wei')
    .description(
      [
        'Convert a decimal gwei amount to wei using viem\'s parseGwei(). 1 gwei is',
        '10^9 wei, so the input is multiplied by 1e9 and returned as a bigint string.',
        'Handy when you have a gas price in gwei and need raw wei for a transaction.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem units:parse-gwei 30',
        '  30000000000',
        '',
        '  $ viem units:parse-gwei 1.5',
        '  1500000000',
        'Docs: https://viem.sh/docs/utilities/parseGwei',
        ''
      ].join('\n')
    )
    .action((value: string) => {
      emit(parseGwei(value).toString())
    })

  program
    .command('units:format-gwei')
    .argument('<wei>', 'wei amount, decimal or hex 0x…')
    .summary('format wei → gwei')
    .description(
      [
        'Convert a wei amount to a decimal gwei string using viem\'s formatGwei().',
        'Useful for displaying gas prices and base fees from RPC responses, which',
        'are returned in wei. Accepts decimal or 0x-prefixed hex input.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem units:format-gwei 30000000000',
        '  30',
        '',
        '  $ viem units:format-gwei 0x3b9aca00',
        '  1',
        'Docs: https://viem.sh/docs/utilities/formatGwei',
        ''
      ].join('\n')
    )
    .action((wei: string) => {
      emit(formatGwei(parseBig(wei)))
    })

  program
    .command('units:parse')
    .argument('<value>', 'decimal amount, e.g. 12.34')
    .argument('<decimals>', 'token decimals, e.g. 6 for USDC')
    .summary('parse decimal → base units (parseUnits)')
    .description(
      [
        'Generic decimal-to-base-units conversion via viem\'s parseUnits(). Multiplies',
        '<value> by 10^<decimals> and prints the result as a bigint string. Use this',
        'for ERC-20 tokens where decimals vary — e.g. 6 for USDC, 8 for WBTC, 18 for',
        'most others. Fractional digits beyond <decimals> are rejected.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem units:parse 12.34 6',
        '  12340000',
        '',
        '  $ viem units:parse 1 8',
        '  100000000',
        'Docs: https://viem.sh/docs/utilities/parseUnits',
        ''
      ].join('\n')
    )
    .action((value: string, decimals: string) => {
      emit(parseUnits(value, Number(decimals)).toString())
    })

  program
    .command('units:format')
    .argument('<value>', 'base-unit amount, decimal or hex 0x…')
    .argument('<decimals>', 'token decimals, e.g. 6 for USDC')
    .summary('format base units → decimal (formatUnits)')
    .description(
      [
        'Generic base-units-to-decimal conversion via viem\'s formatUnits(). Divides',
        '<value> by 10^<decimals> and prints a trimmed decimal string. Mirror of',
        'units:parse — handy for displaying ERC-20 balances pulled directly from a',
        'contract.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem units:format 12340000 6',
        '  12.34',
        '',
        '  $ viem units:format 100000000 8',
        '  1',
        'Docs: https://viem.sh/docs/utilities/formatUnits',
        ''
      ].join('\n')
    )
    .action((value: string, decimals: string) => {
      emit(formatUnits(parseBig(value), Number(decimals)))
    })
}

function parseBig(s: string): bigint {
  const trimmed = s.trim()
  try {
    return BigInt(trimmed)
  } catch (e) {
    throw errBadInput(`Not an integer: '${s}'`, e)
  }
}
