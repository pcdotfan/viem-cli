import { Command } from 'commander'
import { parseEther, formatEther, parseGwei, formatGwei, parseUnits, formatUnits } from 'viem'
import { emit } from '../lib/output.js'
import { errBadInput } from '../lib/errors.js'

export function register(program: Command) {
  program
    .command('units:parse-ether')
    .argument('<value>', 'decimal ether amount, e.g. 1.5')
    .summary('parse ether → wei (bigint string)')
    .action((value: string) => {
      emit(parseEther(value).toString())
    })

  program
    .command('units:format-ether')
    .argument('<wei>', 'wei amount, decimal or hex 0x…')
    .summary('format wei → ether')
    .action((wei: string) => {
      emit(formatEther(parseBig(wei)))
    })

  program
    .command('units:parse-gwei')
    .argument('<value>', 'decimal gwei amount, e.g. 30')
    .summary('parse gwei → wei')
    .action((value: string) => {
      emit(parseGwei(value).toString())
    })

  program
    .command('units:format-gwei')
    .argument('<wei>', 'wei amount, decimal or hex 0x…')
    .summary('format wei → gwei')
    .action((wei: string) => {
      emit(formatGwei(parseBig(wei)))
    })

  program
    .command('units:parse')
    .argument('<value>', 'decimal amount, e.g. 12.34')
    .argument('<decimals>', 'token decimals, e.g. 6 for USDC')
    .summary('parse decimal → base units (parseUnits)')
    .action((value: string, decimals: string) => {
      emit(parseUnits(value, Number(decimals)).toString())
    })

  program
    .command('units:format')
    .argument('<value>', 'base-unit amount, decimal or hex 0x…')
    .argument('<decimals>', 'token decimals, e.g. 6 for USDC')
    .summary('format base units → decimal (formatUnits)')
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
