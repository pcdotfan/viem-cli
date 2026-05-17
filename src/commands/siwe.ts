import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { createSiweMessage, parseSiweMessage } from 'viem/siwe'
import { publicClientFor, type GlobalCtx } from '../lib/client.js'
import { emit, isJson, printJson } from '../lib/output.js'
import { asAddress, asHex } from '../lib/parse.js'
import { resolvedChain } from '../lib/client.js'

export function register(program: Command) {
  program
    .command('siwe:create')
    .requiredOption('--domain <domain>', 'authority domain, e.g. example.com')
    .requiredOption('--uri <uri>', 'origin URI, e.g. https://example.com')
    .requiredOption('--address <address>', 'wallet address (the user)')
    .requiredOption('--nonce <nonce>', 'random nonce (use generateSiweNonce externally)')
    .option('--statement <text>', 'optional human-readable statement')
    .option('--version <v>', 'SIWE version', '1')
    .option('--issued-at <iso>', 'ISO timestamp; defaults to now')
    .option('--expiration-time <iso>', 'ISO timestamp')
    .option('--not-before <iso>', 'ISO timestamp')
    .option('--resources <uri>', 'resource URI (repeat)', collect, [] as string[])
    .option('--request-id <id>', 'request id')
    .summary('create a SIWE (EIP-4361) message')
    .description(
      [
        'Build a Sign-In with Ethereum (EIP-4361) message ready to be signed by a',
        'wallet via viem\'s createSiweMessage(). The chainId line in the message is',
        'taken from the current `--chain` (default mainnet); everything else comes',
        'from the flags. The output is the raw message string — pipe it to a signer',
        'such as `viem sign:message`.',
        '',
        '`--nonce` must come from your auth backend and be a fresh, crypto-strong',
        'random value (e.g. `node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"`)',
        'so signatures cannot be replayed.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem siwe:create \\',
        '      --domain example.com \\',
        '      --uri https://example.com/login \\',
        '      --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \\',
        '      --nonce $(node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))") \\',
        '      --statement "Sign in to Example"',
        '',
        '  # Pipe through a signer and verify in one shot (VIEM_PRIVATE_KEY must be set):',
        '  $ MSG=$(viem siwe:create --domain example.com --uri https://example.com \\',
        '      --address $(viem account:address) --nonce abc123)',
        '  $ SIG=$(viem sign:message "$MSG")',
        '  $ viem siwe:verify --message "$MSG" --signature "$SIG"',
        '',
        'Docs: https://viem.sh/docs/siwe/utilities/createSiweMessage',
        ''
      ].join('\n')
    )
    .action((opts: any, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const chain = resolvedChain(g)
      const message = createSiweMessage({
        domain: opts.domain,
        uri: opts.uri,
        address: asAddress(opts.address),
        nonce: opts.nonce,
        chainId: chain.id,
        version: opts.version ?? '1',
        ...(opts.statement ? { statement: opts.statement } : {}),
        ...(opts.issuedAt ? { issuedAt: new Date(opts.issuedAt) } : {}),
        ...(opts.expirationTime ? { expirationTime: new Date(opts.expirationTime) } : {}),
        ...(opts.notBefore ? { notBefore: new Date(opts.notBefore) } : {}),
        ...(opts.resources?.length ? { resources: opts.resources } : {}),
        ...(opts.requestId ? { requestId: opts.requestId } : {})
      } as any)
      emit(message)
    })

  program
    .command('siwe:verify')
    .requiredOption('--message <message>', 'SIWE message text (or @path/to/message.txt)')
    .requiredOption('--signature <hex>', 'signature hex')
    .option('--address <address>', 'expected signer address (defaults to message.address)')
    .option('--domain <domain>', 'expected domain')
    .option('--nonce <nonce>', 'expected nonce')
    .summary('verify a SIWE signature (verifySiweMessage)')
    .description(
      [
        'Verify a Sign-In with Ethereum signature against its message via viem\'s',
        'verifySiweMessage(). Supports both EOA signatures and ERC-1271 smart-account',
        'verification (the latter is why a public client / `--chain` is needed).',
        'Optionally enforces an expected `--address`, `--domain`, and `--nonce`,',
        'and always checks expirationTime / notBefore from the message.',
        '',
        '`--message` accepts inline text or `@path/to/message.txt`. The chainId used',
        'for signature recovery is parsed from the message itself (not `--chain`);',
        '`--chain` only configures the public client used for ERC-1271 lookups.',
        'Prints `true`/`false` and exits 1 on failure.'
      ].join('\n')
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ viem siwe:verify --message @login.txt --signature 0xabc…',
        '  true',
        '',
        '  $ viem siwe:verify --message "$MSG" --signature "$SIG" \\',
        '      --domain example.com --nonce abc123',
        '',
        '  $ viem --json siwe:verify --message @login.txt --signature 0xabc…',
        'Docs: https://viem.sh/docs/siwe/actions/verifySiweMessage',
        ''
      ].join('\n')
    )
    .action(async (opts: any, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const message = readMaybeFile(opts.message)
      const ok = await (client as any).verifySiweMessage({
        message,
        signature: asHex(opts.signature),
        ...(opts.address ? { address: asAddress(opts.address) } : {}),
        ...(opts.domain ? { domain: opts.domain } : {}),
        ...(opts.nonce ? { nonce: opts.nonce } : {})
      })
      if (isJson()) {
        const parsed = parseSiweMessage(message)
        printJson({ valid: ok, message: parsed })
      } else {
        emit(ok ? 'true' : 'false')
        if (!ok) process.exitCode = 1
      }
    })
}

function readMaybeFile(input: string): string {
  if (input.startsWith('@')) return readFileSync(input.slice(1), 'utf8')
  return input
}

function collect(value: string, prev: string[]): string[] {
  return [...prev, value]
}
