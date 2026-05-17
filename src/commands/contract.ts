import { Command } from 'commander'
import { publicClientFor, walletClientFor, type GlobalCtx } from '../lib/client.js'
import { loadAccount, tryLoadAccount } from '../lib/wallet.js'
import { emit, isJson, printJson, jsonReplacer } from '../lib/output.js'
import { loadAbi, coerceArg, asAddress, asBigInt, parseJson } from '../lib/parse.js'
import { errBadInput } from '../lib/errors.js'

type MulticallEntry = {
  address: string
  abi?: string
  functionName: string
  args?: unknown[]
}

export function register(program: Command) {
  program
    .command('contract:read')
    .requiredOption('--to <address>', 'contract address')
    .requiredOption('--abi <abi>', 'JSON ABI, human-readable signature, or path to abi file')
    .requiredOption('--function <name>', 'function name')
    .option('--args <arg>', 'argument value (repeat)', collect, [] as string[])
    .option('--block <id>', 'block tag or number')
    .summary('read from a contract (readContract)')
    .action(async (opts: { to: string; abi: string; function: string; args: string[]; block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const abi = loadAbi(opts.abi)
      const args = (opts.args ?? []).map(coerceArg)
      const result = await client.readContract({
        address: asAddress(opts.to),
        abi,
        functionName: opts.function,
        args,
        ...(opts.block ? blockArg(opts.block) : {})
      } as any)
      emitResult(result)
    })

  program
    .command('contract:simulate')
    .requiredOption('--to <address>', 'contract address')
    .requiredOption('--abi <abi>', 'JSON ABI, human-readable signature, or path to abi file')
    .requiredOption('--function <name>', 'function name')
    .option('--args <arg>', 'argument value (repeat)', collect, [] as string[])
    .option('--value <wei>', 'wei to send')
    .option('--from <address>', 'msg.sender (defaults to VIEM_PRIVATE_KEY account if set)')
    .summary('simulate a contract write (simulateContract)')
    .action(async (opts: { to: string; abi: string; function: string; args: string[]; value?: string; from?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const abi = loadAbi(opts.abi)
      const args = (opts.args ?? []).map(coerceArg)
      const fromAddr = opts.from ? asAddress(opts.from) : tryLoadAccount()?.address
      const { result, request } = await client.simulateContract({
        address: asAddress(opts.to),
        abi,
        functionName: opts.function,
        args,
        ...(opts.value ? { value: asBigInt(opts.value) } : {}),
        ...(fromAddr ? { account: fromAddr } : {})
      } as any)
      if (isJson()) printJson({ result, request })
      else emit(JSON.stringify({ result, request }, jsonReplacer, 2))
    })

  program
    .command('contract:write')
    .requiredOption('--to <address>', 'contract address')
    .requiredOption('--abi <abi>', 'JSON ABI, human-readable signature, or path to abi file')
    .requiredOption('--function <name>', 'function name')
    .option('--args <arg>', 'argument value (repeat)', collect, [] as string[])
    .option('--value <wei>', 'wei to send')
    .option('--dry-run', 'simulate only; do not broadcast')
    .summary('write to a contract (writeContract). Needs VIEM_PRIVATE_KEY.')
    .action(async (opts: { to: string; abi: string; function: string; args: string[]; value?: string; dryRun?: boolean }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const account = loadAccount()
      const pubClient = publicClientFor(g)
      const abi = loadAbi(opts.abi)
      const args = (opts.args ?? []).map(coerceArg)
      const { request } = await pubClient.simulateContract({
        address: asAddress(opts.to),
        abi,
        functionName: opts.function,
        args,
        ...(opts.value ? { value: asBigInt(opts.value) } : {}),
        account
      } as any)
      if (opts.dryRun) {
        if (isJson()) printJson({ request, dryRun: true })
        else emit(JSON.stringify({ request, dryRun: true }, jsonReplacer, 2))
        return
      }
      const wallet = walletClientFor(g, account)
      const hash = await wallet.writeContract(request as any)
      emit(hash)
    })

  program
    .command('contract:multicall')
    .requiredOption('--calls <json>', 'JSON array of {address, abi, functionName, args?} or @path/to/calls.json')
    .option('--allow-failure', 'allow individual calls to fail (default: true)')
    .summary('batch read calls via Multicall3 (multicall)')
    .action(async (opts: { calls: string; allowFailure?: boolean }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const calls = parseJson<MulticallEntry[]>(opts.calls, '--calls')
      if (!Array.isArray(calls)) throw errBadInput('--calls must be a JSON array')
      const contracts = calls.map((c) => ({
        address: asAddress(c.address),
        abi: loadAbi(c.abi ?? `function ${c.functionName}() view returns (uint256)`),
        functionName: c.functionName,
        args: c.args ?? []
      }))
      const results = await client.multicall({
        contracts: contracts as any,
        allowFailure: opts.allowFailure ?? true
      })
      if (isJson()) printJson(results)
      else emit(JSON.stringify(results, jsonReplacer, 2))
    })

  program
    .command('contract:events')
    .requiredOption('--to <address>', 'contract address')
    .requiredOption('--abi <abi>', 'JSON ABI, human-readable signature, or path to abi file')
    .option('--event <name>', 'event name to filter; omit for all events on the ABI')
    .option('--from-block <id>', 'block tag or number')
    .option('--to-block <id>', 'block tag or number')
    .summary('get decoded contract events (getContractEvents)')
    .action(async (opts: { to: string; abi: string; event?: string; fromBlock?: string; toBlock?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const abi = loadAbi(opts.abi)
      const events = await client.getContractEvents({
        address: asAddress(opts.to),
        abi,
        ...(opts.event ? { eventName: opts.event } : {}),
        ...(opts.fromBlock ? { fromBlock: toBlockArg(opts.fromBlock) } : {}),
        ...(opts.toBlock ? { toBlock: toBlockArg(opts.toBlock) } : {})
      } as any)
      if (isJson()) printJson(events)
      else emit(JSON.stringify(events, jsonReplacer, 2))
    })
}

function blockArg(input: string): Record<string, unknown> {
  const v = input.trim().toLowerCase()
  if (['latest', 'pending', 'safe', 'finalized', 'earliest'].includes(v))
    return { blockTag: v as any }
  if (/^\d+$/.test(v)) return { blockNumber: BigInt(v) }
  if (/^0x[0-9a-f]{64}$/.test(v)) return { blockHash: v as `0x${string}` }
  throw errBadInput(`Bad block id: '${input}'`)
}

function toBlockArg(input: string): any {
  const v = input.trim().toLowerCase()
  if (['latest', 'pending', 'safe', 'finalized', 'earliest'].includes(v)) return v
  if (/^\d+$/.test(v)) return BigInt(v)
  if (/^0x[0-9a-f]+$/.test(v)) return BigInt(v)
  throw errBadInput(`Bad block id: '${input}'`)
}

function collect(value: string, prev: string[]): string[] {
  return [...prev, value]
}

function emitResult(result: unknown) {
  if (isJson()) {
    printJson({ result })
    return
  }
  if (typeof result === 'bigint') emit(result.toString())
  else if (typeof result === 'object' && result !== null)
    emit(JSON.stringify(result, jsonReplacer, 2))
  else emit(result as any)
}
