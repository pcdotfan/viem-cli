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
    .description(
      [
        'Read the native-token balance of an account via eth_getBalance. The result',
        'is printed in wei as a base-10 integer (use a formatter for ether). Works',
        'for both EOAs and contract accounts. Pass --block to query historical state',
        'at a specific tag, block number, or block hash; defaults to latest.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '  $ viem balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --block finalized',
        '  $ viem -c base balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'Docs: https://viem.sh/docs/actions/public/getBalance',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Fetch a single block via eth_getBlockByNumber or eth_getBlockByHash. The id',
        'argument can be a tag (latest, pending, safe, finalized, earliest), a',
        'decimal block number, or a 0x-prefixed 32-byte block hash. By default the',
        'transactions field contains only hashes; use --full to expand each entry',
        'into a full transaction object (heavier RPC payload).'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem block',
        '  $ viem block 19000000 --full',
        '  $ viem --json block finalized',
        'Docs: https://viem.sh/docs/actions/public/getBlock',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Print the number of the most recent block seen by the connected RPC, via',
        'eth_blockNumber. Output is a base-10 integer. Handy as a quick liveness',
        'check for a chain or RPC URL, and useful as the upper bound when scripting',
        'historical queries.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem block-number',
        '  $ viem -c optimism block-number',
        '  $ viem --rpc-url https://eth.llamarpc.com block-number',
        'Docs: https://viem.sh/docs/actions/public/getBlockNumber',
        ''
      ].join('\n')
    )
    .action(async (_opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      emit((await client.getBlockNumber()).toString())
    })

  program
    .command('chain-id')
    .summary('get the chain id (getChainId)')
    .description(
      [
        'Return the EIP-155 chain id reported by the connected RPC, via eth_chainId.',
        'Output is a decimal integer (1 for Ethereum mainnet, 10 for Optimism, 8453',
        'for Base, etc.). Useful to confirm that --rpc-url or --chain actually point',
        'at the network you expect before signing or broadcasting anything.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem chain-id',
        '  $ viem -c base chain-id',
        '  $ viem --rpc-url $VIEM_RPC_URL chain-id',
        'Docs: https://viem.sh/docs/actions/public/getChainId',
        ''
      ].join('\n')
    )
    .action(async (_opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      emit(await client.getChainId())
    })

  program
    .command('gas-price')
    .summary('get the current gas price in wei (getGasPrice)')
    .description(
      [
        'Return the node\'s current legacy gas price in wei via eth_gasPrice. This is',
        'a single scalar and does not account for EIP-1559 base fee + priority tip;',
        'on 1559 chains prefer fee estimation actions when building real transactions.',
        'Still useful as a coarse signal of network congestion.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem gas-price',
        '  $ viem -c arbitrum gas-price',
        'Docs: https://viem.sh/docs/actions/public/getGasPrice',
        ''
      ].join('\n')
    )
    .action(async (_opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      emit((await client.getGasPrice()).toString())
    })

  program
    .command('tx')
    .argument('<hash>', 'transaction hash')
    .summary('get a transaction by hash (getTransaction)')
    .description(
      [
        'Look up a transaction by its 32-byte hash via eth_getTransactionByHash, and',
        'print the full transaction object (from, to, value, input, gas, nonce, type,',
        'fee fields, blockNumber/blockHash if mined, etc.). Pending transactions are',
        'returned with null block fields; unknown hashes cause the call to fail.',
        'For execution status and emitted logs use `receipt` instead.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem tx 0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060',
        '  $ viem --json tx 0x5c504ed4…',
        'Docs: https://viem.sh/docs/actions/public/getTransaction',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Fetch the receipt for a mined transaction via eth_getTransactionReceipt:',
        'status ("success"/"reverted"), gasUsed, effectiveGasPrice, contractAddress',
        '(for deploys), and the emitted logs array. Returns null / errors for',
        'unknown or still-pending hashes — use `tx` to check inclusion first if you',
        'are polling for mining.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem receipt 0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060',
        '  $ viem --json receipt 0x5c504ed4…',
        'Docs: https://viem.sh/docs/actions/public/getTransactionReceipt',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Read the runtime bytecode stored at an address via eth_getCode. Contract',
        'addresses return their deployed bytecode as a hex string; EOAs (and',
        'addresses with no code at the queried block) return 0x. Pair with --block',
        'to inspect bytecode at a historical block, e.g. to confirm when a contract',
        'was deployed or self-destructed.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem code 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48   # USDC',
        '  $ viem code 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045   # EOA -> 0x',
        '  $ viem code 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 --block 10000000',
        'Docs: https://viem.sh/docs/contract/getCode',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Read a single 32-byte storage word at a given slot via eth_getStorageAt.',
        'The slot accepts either a decimal index or a 0x-hex value, and the result',
        'is the raw 32-byte hex word — you are responsible for decoding it (e.g.,',
        'mapping slots are keccak256(key, baseSlot)). Useful for poking at proxy',
        'admin slots, EIP-1967 implementation pointers, or packed storage layouts.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem storage 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 0',
        '  $ viem storage 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc   # EIP-1967 impl slot',
        'Docs: https://viem.sh/docs/contract/getStorageAt',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Return the number of transactions sent from an address via',
        'eth_getTransactionCount — i.e., the next nonce that address should use.',
        'Defaults to the latest mined state; pass --block pending to include',
        'transactions sitting in the mempool, which is what you usually want when',
        'building a new transaction back-to-back with a previous one.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem nonce 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '  $ viem nonce 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --block pending',
        'Docs: https://viem.sh/docs/actions/public/getTransactionCount',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Execute a read-only message call against the chain via eth_call without',
        'broadcasting a transaction. Prints the returned bytes as a hex string (0x',
        'if the call returns nothing). Use --from to spoof msg.sender (handy for',
        'access-controlled view functions), --value to simulate sending ether, and',
        '--block to query historical state. Pre-encode --data with an ABI tool.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  # USDC.balanceOf(vitalik)',
        '  $ viem call --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --data 0x70a08231000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045',
        '',
        '  $ viem call --to 0xa0b86991… --data 0x06fdde03 --block finalized   # name()',
        'Docs: https://viem.sh/docs/actions/public/call',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Estimate how much gas a transaction would consume via eth_estimateGas,',
        'without actually broadcasting it. Returns a base-10 gas amount. If the',
        'underlying call would revert, this command surfaces the revert reason',
        'instead of a number — making it a cheap way to dry-run a tx before signing.',
        'Use --from for sender-dependent paths and --value for payable functions.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem estimate-gas --to 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --value 1000000000000000',
        '  $ viem estimate-gas --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --from 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \\',
        '      --data 0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000000000000000001',
        'Docs: https://viem.sh/docs/actions/public/estimateGas',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Query historical event logs via eth_getLogs. Repeat --address to OR across',
        'multiple contracts, and repeat --topic up to four times to pin topics[0..3]',
        '(topic[0] is the event signature hash). --from-block / --to-block accept',
        'tags, numbers, or 0x-hex. Public RPCs often cap the block range (e.g. 10k',
        'blocks); narrow the window or switch --rpc-url if you hit a provider limit.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  # USDC Transfer events in the last few blocks',
        '  $ viem logs --address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \\',
        '      --topic 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef \\',
        '      --from-block latest --to-block latest',
        '',
        '  $ viem --json logs --address 0xa0b86991… --from-block 19000000 --to-block 19000100',
        'Docs: https://viem.sh/docs/actions/public/getLogs',
        ''
      ].join('\n')
    )
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
