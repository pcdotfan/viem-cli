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
