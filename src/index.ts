#!/usr/bin/env node
import { Command, Option } from 'commander'
import {
  setOutputMode,
  setQuiet,
  printError,
  c,
  printHuman
} from './lib/output.js'
import { describeError, ViemCliError } from './lib/errors.js'

import { register as registerRpc } from './commands/rpc.js'
import { register as registerChains } from './commands/chains.js'
import { register as registerAccount } from './commands/account.js'
import { register as registerUnits } from './commands/units.js'
import { register as registerHash } from './commands/hash.js'
import { register as registerHex } from './commands/hex.js'
import { register as registerAddress } from './commands/address.js'
import { register as registerAbi } from './commands/abi.js'
import { register as registerContract } from './commands/contract.js'
import { register as registerSign } from './commands/sign.js'
import { register as registerTx } from './commands/tx.js'
import { register as registerEns } from './commands/ens.js'
import { register as registerSiwe } from './commands/siwe.js'

const VERSION = '0.1.0'

const program = new Command()
program
  .name('viem')
  .summary('every viem action, from your terminal')
  .description(
    [
      'Command-line interface for viem.',
      '',
      'Read chain state, encode/decode ABI, sign messages and typed data,',
      'send transactions, call contracts, resolve ENS, and build SIWE flows —',
      'all backed by viem.',
      '',
      'Default chain is `mainnet`. Override with --chain <viem-export-name> or',
      '--rpc-url <url>. Signing reads VIEM_PRIVATE_KEY from env. Read-only',
      "commands don't need a key."
    ].join('\n')
  )
  .version(VERSION, '-V, --version', 'print version and exit')
  .addOption(new Option('--json', 'emit JSON to stdout (machine-readable)'))
  .addOption(new Option('--quiet', 'suppress informational stdout/stderr lines'))
  .addOption(
    new Option(
      '-c, --chain <name>',
      'chain by viem export name (mainnet, base, arbitrum, optimism, sepolia, …) or numeric id'
    ).default('mainnet')
  )
  .addOption(new Option('--rpc-url <url>', 'RPC HTTP URL (overrides --chain default)'))
  .addHelpText(
    'after',
    [
      '',
      'Environment variables:',
      '  VIEM_PRIVATE_KEY            32-byte hex private key (signing commands)',
      '  VIEM_RPC_URL                fallback RPC URL for all chains',
      '  VIEM_RPC_URL_<chainId>      per-chain RPC URL override',
      '  VIEM_DEBUG                  set to print stack traces on error',
      '',
      'Examples:',
      '  $ viem balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '  $ viem --chain base block latest',
      '  $ viem ens:resolve vitalik.eth',
      '  $ viem units:parse-ether 1.5',
      '  $ viem sign:message "hello"   # needs VIEM_PRIVATE_KEY',
      '  $ viem --json chains -s usd',
      '',
      'Exit codes: 0 ok · 1 runtime/RPC error · 2 bad input or missing env · 130 user aborted',
      ''
    ].join('\n')
  )
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals()
    if (opts.json) setOutputMode('json')
    if (opts.quiet) setQuiet(true)
  })

registerRpc(program)
registerChains(program)
registerAccount(program)
registerUnits(program)
registerHash(program)
registerHex(program)
registerAddress(program)
registerAbi(program)
registerContract(program)
registerSign(program)
registerTx(program)
registerEns(program)
registerSiwe(program)

program.parseAsync(process.argv).catch((err) => {
  printError(err instanceof Error ? err : new Error(describeError(err)))
  if (process.env.VIEM_DEBUG) {
    printHuman(c.dim(String((err as Error)?.stack ?? err)))
  }
  const exitCode = err instanceof ViemCliError ? err.exitCode : 1
  process.exit(exitCode)
})
