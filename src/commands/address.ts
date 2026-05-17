import { Command } from 'commander'
import { getAddress, isAddress } from 'viem'
import { emit, isJson, printJson } from '../lib/output.js'

export function register(program: Command) {
  program
    .command('address:checksum')
    .argument('<address>', '20-byte hex address')
    .summary('return EIP-55 checksummed address')
    .action((address: string) => {
      emit(getAddress(address))
    })

  program
    .command('address:is-valid')
    .argument('<address>', '20-byte hex address')
    .option('--strict', 'require EIP-55 checksum match')
    .summary('check whether a string is a valid address')
    .action((address: string, opts: { strict?: boolean }) => {
      const ok = isAddress(address, { strict: !!opts.strict })
      if (isJson()) printJson({ valid: ok, address })
      else {
        emit(ok ? 'true' : 'false')
        if (!ok) process.exitCode = 1
      }
    })
}
