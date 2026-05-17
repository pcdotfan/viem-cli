import { Command } from 'commander'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { emit, isJson, kv, printJson, header } from '../lib/output.js'
import { loadAccount, normalizeHexKey } from '../lib/wallet.js'

export function register(program: Command) {
  program
    .command('account:generate')
    .summary('generate a random EVM private key + address')
    .description(
      [
        'Generate a fresh secp256k1 private key with generatePrivateKey() and derive',
        'its address via privateKeyToAccount(). Prints BOTH the new private key and',
        'the matching address so you can fund and use the account.',
        '',
        'WARNING: the printed private key grants full control of any funds sent to',
        'the address. Store it in a secret manager, never commit it to source,',
        'never paste it into chat, and never let it leave a secure environment.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem account:generate',
        '  $ viem --json account:generate > wallet.json',
        'Docs: https://viem.sh/docs/accounts/local/privateKeyToAccount',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Derive the EVM address that corresponds to a 32-byte secp256k1 private',
        'key using viem\'s privateKeyToAccount(). The key may be supplied with or',
        'without the 0x prefix; it is normalized internally before signing.',
        '',
        'See https://viem.sh/docs/accounts/local/privateKeyToAccount. Treat the',
        'input as a secret — anyone with the key controls the address.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem account:from-private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '  $ viem account:from-private-key ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        'Docs: https://viem.sh/docs/accounts/local/privateKeyToAccount',
        ''
      ].join('\n')
    )
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
    .description(
      [
        'Derive an EVM address from a BIP-39 mnemonic phrase using viem\'s',
        'mnemonicToAccount(). Defaults to the standard BIP-44 path',
        "m/44'/60'/0'/0/{index} where --index selects which child key to use.",
        '',
        'Pass --path to override the full template (e.g. for Ledger Live\'s legacy',
        'paths). See https://viem.sh/docs/accounts/local/mnemonicToAccount. Always',
        'quote the mnemonic so the shell does not split it on spaces.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem account:from-mnemonic "test test test test test test test test test test test junk"',
        '  $ viem account:from-mnemonic "test test test test test test test test test test test junk" --index 3',
        '  $ viem account:from-mnemonic "..." --path "m/44\'/60\'/0\'/0/0"',
        'Docs: https://viem.sh/docs/accounts/local/mnemonicToAccount',
        ''
      ].join('\n')
    )
    .action((mnemonic: string, opts: { index?: string; path?: string }) => {
      const account = opts.path
        ? mnemonicToAccount(mnemonic, { path: opts.path as `m/44'/60'/${string}` })
        : mnemonicToAccount(mnemonic, { accountIndex: Number(opts.index ?? '0') })
      emit(account.address)
    })

  program
    .command('account:address')
    .summary('print the address derived from $VIEM_PRIVATE_KEY')
    .description(
      [
        'Load the private key from the VIEM_PRIVATE_KEY environment variable and',
        'print the corresponding address. Handy for confirming which account will',
        'sign before you run a write command like a transfer or contract call.',
        '',
        'Exits with an error if VIEM_PRIVATE_KEY is unset or malformed. The key',
        'itself is never printed.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ export VIEM_PRIVATE_KEY=0xac0974…',
        '  $ viem account:address',
        '',
        '  $ VIEM_PRIVATE_KEY=0xac0974… viem account:address',
        'Docs: https://viem.sh/docs/accounts/local/privateKeyToAccount',
        ''
      ].join('\n')
    )
    .action(() => {
      const account = loadAccount()
      emit(account.address)
    })
}
