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
    .description(
      [
        'Call a read-only (view/pure) function on a contract using viem\'s readContract().',
        'No gas is spent and no transaction is sent — this is just an eth_call under the hood.',
        'Pass --abi as a human-readable signature like "function balanceOf(address) view returns (uint256)",',
        'a JSON ABI string, or a path to an ABI file. Use --block to read historical state at a block',
        'number, tag (latest/safe/finalized/pending/earliest), or 32-byte block hash.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem contract:read \\',
        '      --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --abi "function totalSupply() view returns (uint256)" \\',
        '      --function totalSupply',
        '',
        '  $ viem -c mainnet contract:read \\',
        '      --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --abi "function balanceOf(address) view returns (uint256)" \\',
        '      --function balanceOf \\',
        '      --args 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '',
        '  $ viem --json contract:read --to 0x… --abi ./erc20.json --function decimals --block 18000000',
        'Docs: https://viem.sh/docs/contract/readContract',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Dry-run a state-changing function via viem\'s simulateContract(). Returns both the',
        'function\'s return value and a prepared request you can pass to writeContract.',
        'Use this to preview reverts (with decoded error reasons) and inspect return data',
        'before broadcasting. If --from is omitted, the VIEM_PRIVATE_KEY account is used',
        'when available; otherwise viem picks a default caller. State overrides are not exposed here.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem contract:simulate \\',
        '      --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --abi "function transfer(address,uint256) returns (bool)" \\',
        '      --function transfer \\',
        '      --args 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --args 1000000 \\',
        '      --from 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '',
        '  $ viem --json contract:simulate --to 0x… --abi ./erc20.json --function approve \\',
        '      --args 0xspender --args 1000000000000000000',
        'Docs: https://viem.sh/docs/contract/simulateContract',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Send a state-changing transaction to a contract via viem\'s writeContract().',
        'Always runs simulateContract() first to validate; on success the prepared request',
        'is signed with VIEM_PRIVATE_KEY and broadcast, returning the tx hash. Pass --dry-run',
        'to stop after simulation and print the request without sending. Note: writeContract',
        'returns only the hash — use contract:simulate if you need the function\'s return value.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ export VIEM_PRIVATE_KEY=0x…',
        '  $ viem contract:write \\',
        '      --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --abi "function transfer(address,uint256) returns (bool)" \\',
        '      --function transfer \\',
        '      --args 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --args 1000000',
        '',
        '  $ viem contract:write --dry-run --to 0x… --abi ./erc20.json --function approve \\',
        '      --args 0xspender --args 1000000000000000000',
        'Docs: https://viem.sh/docs/contract/writeContract',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Batch many read calls into a single RPC round-trip using the Multicall3 contract',
        'via viem\'s multicall(). Pass --calls as inline JSON or @path/to/file.json — an array',
        'of {address, abi, functionName, args?} entries. With --allow-failure (default true)',
        'each result is {status, result|error}; otherwise the whole batch reverts on any failure.',
        'Requires Multicall3 to be deployed on the target chain.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem -c mainnet contract:multicall --calls @./calls.json',
        '',
        '  $ viem contract:multicall --calls \'[',
        '      {"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",',
        '       "abi":"function totalSupply() view returns (uint256)",',
        '       "functionName":"totalSupply"},',
        '      {"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",',
        '       "abi":"function balanceOf(address) view returns (uint256)",',
        '       "functionName":"balanceOf",',
        '       "args":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]}',
        '    ]\'',
        'Docs: https://viem.sh/docs/contract/multicall',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Fetch and decode contract event logs via viem\'s getContractEvents(). Pass --abi',
        'as a human-readable event signature, JSON ABI, or file path. Omit --event to return',
        'logs for every event defined on the ABI; pass --event to filter to one. --from-block',
        'and --to-block accept block numbers or tags (latest/safe/finalized/pending/earliest).',
        'Beware: most public RPCs cap the block range (often 1k–10k blocks) and will error on wider scans.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem contract:events \\',
        '      --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --abi "event Transfer(address indexed from, address indexed to, uint256 value)" \\',
        '      --event Transfer \\',
        '      --from-block 19000000 --to-block 19000100',
        '',
        '  $ viem --json contract:events --to 0x… --abi ./erc20.json --from-block latest',
        'Docs: https://viem.sh/docs/contract/getContractEvents',
        ''
      ].join('\n')
    )
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
