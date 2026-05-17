import { Command } from 'commander'
import { publicClientFor, type GlobalCtx } from '../lib/client.js'
import { emit, isJson, printJson } from '../lib/output.js'
import { asAddress } from '../lib/parse.js'

export function register(program: Command) {
  program
    .command('ens:resolve')
    .argument('<name>', 'ENS name, e.g. vitalik.eth')
    .summary('resolve ENS name → address (getEnsAddress)')
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
    .action(async (name: string, _opts, cmd) => {
      const g = cmd.optsWithGlobals() as GlobalCtx
      const client = publicClientFor(g)
      const resolver = await client.getEnsResolver({ name })
      if (isJson()) printJson({ name, resolver })
      else emit(resolver)
    })
}
