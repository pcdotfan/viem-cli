import { Command } from 'commander'
import { listChains, chainExportName } from '../lib/chains.js'
import { isJson, printJson, printHuman, c } from '../lib/output.js'

export function register(program: Command) {
  program
    .command('chains')
    .option('-s, --search <q>', 'filter by name, id, or native currency symbol')
    .option('--limit <n>', 'max results (0 = all)', '50')
    .summary('list chains exported by viem/chains')
    .action((opts: { search?: string; limit?: string }) => {
      const all = listChains(opts.search)
      const limit = Number(opts.limit ?? '50')
      const rows = limit > 0 ? all.slice(0, limit) : all

      if (isJson()) {
        printJson(
          rows.map((chain) => ({
            id: chain.id,
            name: chain.name,
            exportName: chainExportName(chain),
            nativeCurrency: chain.nativeCurrency.symbol,
            rpcUrl: chain.rpcUrls.default.http[0],
            testnet: chain.testnet ?? false
          }))
        )
        return
      }

      printHuman(c.dim(`Showing ${rows.length} of ${all.length} chain(s).`))
      printHuman()
      printHuman(`${c.bold('ID'.padEnd(10))}${c.bold('NAME'.padEnd(34))}${c.bold('SYMBOL'.padEnd(8))}${c.bold('EXPORT')}`)
      for (const ch of rows) {
        printHuman(
          `${String(ch.id).padEnd(10)}${truncate(ch.name, 32).padEnd(34)}${ch.nativeCurrency.symbol.padEnd(8)}${chainExportName(ch) ?? ''}`
        )
      }
    })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
