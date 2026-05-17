import { Command } from 'commander'
import { publicClientFor, type GlobalCtx } from '../lib/client.js'
import { emit, isJson, printJson } from '../lib/output.js'
import { asAddress } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('ens:resolve')
    .argument('<name>', 'ENS name, e.g. vitalik.eth')
    .summary('resolve ENS name → address (getEnsAddress)')
    .description(
      [
        'Forward-resolve an ENS name to its primary Ethereum address by calling the',
        'ENS Universal Resolver via viem\'s getEnsAddress(). The name is normalized',
        '(UTS-46) and CCIP-Read off-chain lookups are followed automatically.',
        '',
        'Requires an L1-aware chain — the default is mainnet, which has ENS deployed;',
        'other chains may not. Prints the address (EIP-55 checksummed) or exits with',
        'status 1 when the name has no address record set.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem ens:resolve vitalik.eth',
        '  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '',
        '  $ viem --json ens:resolve vitalik.eth',
        'Docs: https://viem.sh/docs/ens/actions/getEnsAddress',
        ''
      ].join('\n')
    )
    .action(async (name: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const address = await client.getEnsAddress({ name })
      if (isJson()) printJson({ name, address })
      else emit(address ?? '')
      if (!address) process.exitCode = 1
    })

  program
    .command('ens:lookup')
    .argument('<address>', 'address to reverse-resolve')
    .summary('reverse-resolve address → primary ENS name (getEnsName)')
    .description(
      [
        'Reverse-resolve an address to its primary ENS name via viem\'s getEnsName().',
        'Reverse records are user-set: an address must explicitly point a reverse',
        'record at a name (and that name must forward-resolve back) for a result.',
        '',
        'Owning an ENS name does NOT automatically make it your primary — many',
        'addresses will return nothing. Requires an L1 chain with ENS deployed',
        '(mainnet by default). Exits with status 1 when no primary name is found.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem ens:lookup 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        '  vitalik.eth',
        '',
        '  $ viem --json ens:lookup 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'Docs: https://viem.sh/docs/ens/actions/getEnsName',
        ''
      ].join('\n')
    )
    .action(async (address: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const name = await client.getEnsName({ address: asAddress(address) })
      if (isJson()) printJson({ address, name })
      else emit(name ?? '')
      if (!name) process.exitCode = 1
    })

  program
    .command('ens:avatar')
    .argument('<name>', 'ENS name')
    .summary('get ENS avatar URL (getEnsAvatar)')
    .description(
      [
        'Resolve the avatar associated with an ENS name via viem\'s getEnsAvatar().',
        'Reads the `avatar` text record and follows the various pointer formats —',
        'plain https URLs, ipfs://, and eip155 NFT references (ERC-721/1155) — and',
        'returns a final URL you can drop into an <img src>.',
        '',
        'Requires an L1 chain with ENS (mainnet by default). Exits with status 1',
        'when no avatar is set or the pointer cannot be resolved.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem ens:avatar vitalik.eth',
        '  https://ipfs.io/ipfs/QmSP4nq9fnN9dAiCj42ug9Wa79rqmQerZXZch82VqpiH7U/image.gif',
        '',
        '  $ viem --json ens:avatar nick.eth',
        'Docs: https://viem.sh/docs/ens/actions/getEnsAvatar',
        ''
      ].join('\n')
    )
    .action(async (name: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const avatar = await client.getEnsAvatar({ name })
      if (isJson()) printJson({ name, avatar })
      else emit(avatar ?? '')
      if (!avatar) process.exitCode = 1
    })

  program
    .command('ens:text')
    .argument('<name>', 'ENS name')
    .argument('<key>', 'text record key, e.g. com.twitter, url, description')
    .summary('get ENS text record (getEnsText)')
    .description(
      [
        'Read a single ENS text record for `<name>` under the given `<key>` via',
        'viem\'s getEnsText(). Common keys: `url`, `email`, `description`, `avatar`,',
        'and namespaced socials like `com.twitter`, `com.github`, `org.telegram`.',
        '',
        'Requires an L1 chain with ENS (mainnet by default). Exits with status 1',
        'when the record is not set.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem ens:text vitalik.eth com.twitter',
        '  VitalikButerin',
        '',
        '  $ viem ens:text vitalik.eth url',
        '',
        '  $ viem --json ens:text nick.eth description',
        'Docs: https://viem.sh/docs/ens/actions/getEnsText',
        ''
      ].join('\n')
    )
    .action(async (name: string, key: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const value = await client.getEnsText({ name, key })
      if (isJson()) printJson({ name, key, value })
      else emit(value ?? '')
      if (!value) process.exitCode = 1
    })

  program
    .command('ens:resolver')
    .argument('<name>', 'ENS name')
    .summary('get resolver contract for an ENS name (getEnsResolver)')
    .description(
      [
        'Return the resolver contract address responsible for `<name>` by calling',
        'findResolver on the ENS Universal Resolver via viem\'s getEnsResolver().',
        'This is the contract that holds the address, avatar, and text records for',
        'the name.',
        '',
        'Mostly an advanced/debugging tool — useful when ens:resolve or ens:text',
        'misbehave and you want to confirm which resolver implementation is in use.',
        'Requires an L1 chain with ENS (mainnet by default).'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem ens:resolver vitalik.eth',
        '  0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41',
        '',
        '  $ viem --json ens:resolver vitalik.eth',
        'Docs: https://viem.sh/docs/ens/actions/getEnsResolver',
        ''
      ].join('\n')
    )
    .action(async (name: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const resolver = await client.getEnsResolver({ name })
      if (isJson()) printJson({ name, resolver })
      else emit(resolver)
    })
}
