import { Command } from 'commander'
import { getAddress, isAddress } from 'viem'
import { emit, isJson, printJson } from '../lib/output.js'

export function register(program: Command) {
  program
    .command('address:checksum')
    .argument('<address>', '20-byte hex address (any case)')
    .summary('return the EIP-55 checksummed address')
    .description(
      [
        'Convert a hex address to its EIP-55 mixed-case checksum form using viem\'s',
        'getAddress(). Throws on invalid inputs (wrong length, non-hex), so this',
        'doubles as strict validation. The result is suitable as a canonical form',
        'to display, store, or compare with .toLowerCase().'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem address:checksum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        '  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '',
        '  $ viem --json address:checksum 0xd8da…',
        '',
        'Docs: https://viem.sh/docs/utilities/getAddress',
        ''
      ].join('\n')
    )
    .action((address: string) => {
      emit(getAddress(address))
    })

  program
    .command('address:is-valid')
    .argument('<address>', '20-byte hex address')
    .option('--strict', 'require EIP-55 checksum to match exactly')
    .summary('check whether a string is a valid EVM address')
    .description(
      [
        'Test whether a string is a syntactically valid 20-byte hex address using',
        'viem\'s isAddress(). With --strict, the checksum casing must also match',
        'EIP-55. Without --strict, both all-lower and all-upper variants pass.',
        '',
        'Prints `true` or `false`. Exits with status 1 when invalid, so the result',
        'is shell-scriptable: `if viem address:is-valid 0x… ; then ... ; fi`.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem address:is-valid 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '  true',
        '',
        '  $ viem address:is-valid --strict 0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        '  false   # all-lowercase fails strict EIP-55',
        '',
        '  $ viem --json address:is-valid 0xnotreal',
        '',
        'Docs: https://viem.sh/docs/utilities/isAddress',
        ''
      ].join('\n')
    )
    .action((address: string, opts: { strict?: boolean }) => {
      const ok = isAddress(address, { strict: !!opts.strict })
      if (isJson()) printJson({ valid: ok, address })
      else {
        emit(ok ? 'true' : 'false')
        if (!ok) process.exitCode = 1
      }
    })
}
