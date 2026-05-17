import { Command } from 'commander'
import { publicClientFor, type GlobalCtx } from '../lib/client.js'
import { emit, isJson, printJson, jsonReplacer } from '../lib/output.js'
import { asAddress, asHex, asBigInt } from '../lib/parse.js'
import { errBadInput } from '../lib/errors.js'

const BLOCK_TAGS = new Set(['latest', 'pending', 'safe', 'finalized', 'earliest'])

function parseBlockId(input: string | undefined):
  | { blockTag: any }
  | { blockNumber: bigint }
  | { blockHash: `0x${string}` }
  | undefined {
  if (!input) return undefined
  const v = input.trim().toLowerCase()
  if (BLOCK_TAGS.has(v)) return { blockTag: v as any }
  if (/^0x[0-9a-f]{64}$/.test(v)) return { blockHash: v as `0x${string}` }
  if (/^\d+$/.test(v)) return { blockNumber: BigInt(v) }
  throw errBadInput(`Bad block id: '${input}'. Expected tag, number, or 0x… 64-hex hash.`)
}

function emitJsonOrLine(value: unknown) {
  if (isJson()) {
    printJson(value)
  } else if (typeof value === 'object' && value !== null) {
    process.stdout.write(JSON.stringify(value, jsonReplacer, 2) + '\n')
  } else {
    emit(value as any)
  }
}

export function register(program: Command) {
  program
    .command('balance')
    .argument('<address>', '20-byte hex address')
    .option('--block <id>', 'block tag (latest|safe|…), number, or hash')
    .summary('get account balance in wei (getBalance)')
    .action(async (address: string, opts: { block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const block = parseBlockId(opts.block)
      const balance = await client.getBalance({
        address: asAddress(address),
        ...(block ?? {})
      } as any)
      emit(balance.toString())
    })

  program
    .command('block')
    .argument('[id]', 'block tag (latest|safe|…), number, or 0x-hash; defaults to latest')
    .option('--full', 'include full transactions, not just hashes')
    .summary('get a block (getBlock)')
    .action(async (id: string | undefined, opts: { full?: boolean }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const sel = parseBlockId(id ?? 'latest')
      const block = await client.getBlock({
        ...(sel ?? { blockTag: 'latest' }),
        includeTransactions: !!opts.full
      } as any)
      emitJsonOrLine(block)
    })

  program
    .command('block-number')
    .summary('get the latest block number (getBlockNumber)')
    .action(async (_opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      emit((await client.getBlockNumber()).toString())
    })

  program
    .command('chain-id')
    .summary('get the chain id (getChainId)')
    .action(async (_opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      emit(await client.getChainId())
    })

  program
    .command('gas-price')
    .summary('get the current gas price in wei (getGasPrice)')
    .action(async (_opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      emit((await client.getGasPrice()).toString())
    })

  program
    .command('tx')
    .argument('<hash>', 'transaction hash')
    .summary('get a transaction by hash (getTransaction)')
    .action(async (hash: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const tx = await client.getTransaction({ hash: asHex(hash) as `0x${string}` })
      emitJsonOrLine(tx)
    })

  program
    .command('receipt')
    .argument('<hash>', 'transaction hash')
    .summary('get a transaction receipt (getTransactionReceipt)')
    .action(async (hash: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const r = await client.getTransactionReceipt({ hash: asHex(hash) as `0x${string}` })
      emitJsonOrLine(r)
    })

  program
    .command('code')
    .argument('<address>', '20-byte hex address')
    .option('--block <id>', 'block tag, number, or hash')
    .summary('get deployed bytecode at an address (getCode)')
    .action(async (address: string, opts: { block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const block = parseBlockId(opts.block)
      const code = await client.getCode({
        address: asAddress(address),
        ...(block ?? {})
      } as any)
      emit(code ?? '0x')
    })

  program
    .command('storage')
    .argument('<address>', '20-byte hex address')
    .argument('<slot>', 'storage slot (number or 0x-hex)')
    .option('--block <id>', 'block tag, number, or hash')
    .summary('read storage at a slot (getStorageAt)')
    .action(async (address: string, slot: string, opts: { block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const block = parseBlockId(opts.block)
      const slotHex = slot.startsWith('0x') ? (slot as `0x${string}`) : (`0x${BigInt(slot).toString(16)}` as `0x${string}`)
      const data = await client.getStorageAt({
        address: asAddress(address),
        slot: slotHex,
        ...(block ?? {})
      } as any)
      emit(data ?? '0x')
    })

  program
    .command('nonce')
    .argument('<address>', '20-byte hex address')
    .option('--block <id>', 'block tag, number, or hash')
    .summary('get transaction count / nonce (getTransactionCount)')
    .action(async (address: string, opts: { block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const block = parseBlockId(opts.block)
      const n = await client.getTransactionCount({
        address: asAddress(address),
        ...(block ?? {})
      } as any)
      emit(n)
    })

  program
    .command('call')
    .requiredOption('--to <address>', 'target contract address')
    .requiredOption('--data <hex>', 'calldata hex')
    .option('--from <address>', 'msg.sender')
    .option('--value <wei>', 'wei to send (call simulation)')
    .option('--block <id>', 'block tag, number, or hash')
    .summary('perform an eth_call (call)')
    .action(async (opts: { to: string; data: string; from?: string; value?: string; block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const block = parseBlockId(opts.block)
      const res = await client.call({
        to: asAddress(opts.to),
        data: asHex(opts.data),
        ...(opts.from ? { account: asAddress(opts.from) as any } : {}),
        ...(opts.value ? { value: asBigInt(opts.value) } : {}),
        ...(block ?? {})
      } as any)
      emit(res.data ?? '0x')
    })

  program
    .command('estimate-gas')
    .requiredOption('--to <address>', 'target address')
    .option('--data <hex>', 'calldata hex')
    .option('--from <address>', 'msg.sender')
    .option('--value <wei>', 'wei to send')
    .option('--block <id>', 'block tag, number, or hash')
    .summary('estimate gas for a call (estimateGas)')
    .action(async (opts: { to: string; data?: string; from?: string; value?: string; block?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const block = parseBlockId(opts.block)
      const gas = await client.estimateGas({
        to: asAddress(opts.to),
        ...(opts.data ? { data: asHex(opts.data) } : {}),
        ...(opts.from ? { account: asAddress(opts.from) as any } : {}),
        ...(opts.value ? { value: asBigInt(opts.value) } : {}),
        ...(block ?? {})
      } as any)
      emit(gas.toString())
    })

  program
    .command('logs')
    .option('--address <addr>', 'filter by contract address (repeat for multiple)', collect, [] as string[])
    .option('--topic <topic>', 'filter by topic (repeat for topics[0..3])', collect, [] as string[])
    .option('--from-block <id>', 'block tag, number, or hash')
    .option('--to-block <id>', 'block tag, number, or hash')
    .summary('get event logs (getLogs)')
    .action(async (opts: { address: string[]; topic: string[]; fromBlock?: string; toBlock?: string }, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const fromBlock = opts.fromBlock ? toBlockArg(opts.fromBlock) : undefined
      const toBlock = opts.toBlock ? toBlockArg(opts.toBlock) : undefined
      const address =
        opts.address.length === 1
          ? asAddress(opts.address[0]!)
          : opts.address.length > 1
            ? opts.address.map((a) => asAddress(a))
            : undefined
      const topics =
        opts.topic.length > 0
          ? (opts.topic.map((t) => asHex(t)) as any)
          : undefined
      const logs = await client.getLogs({
        ...(address ? { address: address as any } : {}),
        ...(topics ? { topics } : {}),
        ...(fromBlock ? { fromBlock } : {}),
        ...(toBlock ? { toBlock } : {})
      } as any)
      emitJsonOrLine(logs)
    })
}

function toBlockArg(input: string): any {
  const v = input.trim().toLowerCase()
  if (BLOCK_TAGS.has(v)) return v
  if (/^\d+$/.test(v)) return BigInt(v)
  if (/^0x[0-9a-f]+$/.test(v)) return BigInt(v)
  throw errBadInput(`Bad block id: '${input}'`)
}

function collect(value: string, prev: string[]): string[] {
  return [...prev, value]
}
