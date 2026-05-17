import { Command } from 'commander'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { emit, isJson, kv, printJson, header } from '../lib/output.js'
import { loadAccount, normalizeHexKey } from '../lib/wallet.js'

export function register(program: Command) {
  program
    .command('account:generate')
    .summary('generate a random EVM private key + address')
    .action(() => {
      const pk = generatePrivateKey()
      const account = privateKeyToAccount(pk)
      if (isJson()) {
        printJson({ privateKey: pk, address: account.address })
        return
      }
      header('Generated account')
      kv('Address', account.address)
      kv('Private key', pk)
    })

  program
    .command('account:from-private-key')
    .argument('<privateKey>', '32-byte hex private key (with or without 0x prefix)')
    .summary('derive address from a private key')
    .action((privateKey: string) => {
      const account = privateKeyToAccount(normalizeHexKey(privateKey))
      emit(account.address)
    })

  program
    .command('account:from-mnemonic')
    .argument('<mnemonic>', 'BIP-39 mnemonic phrase (quote it if it has spaces)')
    .option('--index <n>', 'HD account index (default 0)', '0')
    .option('--path <path>', "derivation path template, default \"m/44'/60'/0'/0/{index}\"")
    .summary('derive address from a BIP-39 mnemonic')
    .action((mnemonic: string, opts: { index?: string; path?: string }) => {
      const account = opts.path
        ? mnemonicToAccount(mnemonic, { path: opts.path as `m/44'/60'/${string}` })
        : mnemonicToAccount(mnemonic, { accountIndex: Number(opts.index ?? '0') })
      emit(account.address)
    })

  program
    .command('account:address')
    .summary('print the address derived from $VIEM_PRIVATE_KEY')
    .action(() => {
      const account = loadAccount()
      emit(account.address)
    })
}
