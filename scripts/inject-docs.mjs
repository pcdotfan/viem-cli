#!/usr/bin/env node
// One-shot tool: append `Docs: <viem URL>` to each command's addHelpText('after', ...) block.
// Deletes itself is not handled here — remove after running.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const URLS = {
  // rpc
  balance: 'https://viem.sh/docs/actions/public/getBalance',
  block: 'https://viem.sh/docs/actions/public/getBlock',
  'block-number': 'https://viem.sh/docs/actions/public/getBlockNumber',
  'chain-id': 'https://viem.sh/docs/actions/public/getChainId',
  'gas-price': 'https://viem.sh/docs/actions/public/getGasPrice',
  tx: 'https://viem.sh/docs/actions/public/getTransaction',
  receipt: 'https://viem.sh/docs/actions/public/getTransactionReceipt',
  code: 'https://viem.sh/docs/contract/getCode',
  storage: 'https://viem.sh/docs/contract/getStorageAt',
  nonce: 'https://viem.sh/docs/actions/public/getTransactionCount',
  call: 'https://viem.sh/docs/actions/public/call',
  'estimate-gas': 'https://viem.sh/docs/actions/public/estimateGas',
  logs: 'https://viem.sh/docs/actions/public/getLogs',
  // chains
  chains: 'https://viem.sh/docs/chains/introduction',
  // account
  'account:generate': 'https://viem.sh/docs/accounts/local/privateKeyToAccount',
  'account:from-private-key': 'https://viem.sh/docs/accounts/local/privateKeyToAccount',
  'account:from-mnemonic': 'https://viem.sh/docs/accounts/local/mnemonicToAccount',
  'account:address': 'https://viem.sh/docs/accounts/local/privateKeyToAccount',
  // units
  'units:parse-ether': 'https://viem.sh/docs/utilities/parseEther',
  'units:format-ether': 'https://viem.sh/docs/utilities/formatEther',
  'units:parse-gwei': 'https://viem.sh/docs/utilities/parseGwei',
  'units:format-gwei': 'https://viem.sh/docs/utilities/formatGwei',
  'units:parse': 'https://viem.sh/docs/utilities/parseUnits',
  'units:format': 'https://viem.sh/docs/utilities/formatUnits',
  // hash
  'hash:keccak256': 'https://viem.sh/docs/utilities/keccak256',
  'hash:message': 'https://viem.sh/docs/utilities/hashMessage',
  'hash:typed-data': 'https://viem.sh/docs/utilities/hashTypedData',
  // hex / bytes
  'hex:from': 'https://viem.sh/docs/utilities/toHex',
  'hex:to': 'https://viem.sh/docs/utilities/fromHex',
  'bytes:from': 'https://viem.sh/docs/utilities/toBytes',
  'bytes:to': 'https://viem.sh/docs/utilities/fromHex',
  // address
  'address:checksum': 'https://viem.sh/docs/utilities/getAddress',
  'address:is-valid': 'https://viem.sh/docs/utilities/isAddress',
  // abi
  'abi:parse': 'https://viem.sh/docs/abi/parseAbi',
  'abi:encode-function': 'https://viem.sh/docs/contract/encodeFunctionData',
  'abi:decode-function': 'https://viem.sh/docs/contract/decodeFunctionResult',
  'abi:encode': 'https://viem.sh/docs/abi/encodeAbiParameters',
  'abi:decode': 'https://viem.sh/docs/abi/decodeAbiParameters',
  // contract
  'contract:read': 'https://viem.sh/docs/contract/readContract',
  'contract:write': 'https://viem.sh/docs/contract/writeContract',
  'contract:simulate': 'https://viem.sh/docs/contract/simulateContract',
  'contract:multicall': 'https://viem.sh/docs/contract/multicall',
  'contract:events': 'https://viem.sh/docs/contract/getContractEvents',
  // sign / verify / recover
  'sign:message': 'https://viem.sh/docs/accounts/local/signMessage',
  'sign:typed-data': 'https://viem.sh/docs/accounts/local/signTypedData',
  'sign:transaction': 'https://viem.sh/docs/accounts/local/signTransaction',
  'verify:message': 'https://viem.sh/docs/utilities/verifyMessage',
  'verify:typed-data': 'https://viem.sh/docs/utilities/verifyTypedData',
  'recover:address': 'https://viem.sh/docs/utilities/recoverMessageAddress',
  'recover:typed-data': 'https://viem.sh/docs/utilities/recoverTypedDataAddress',
  // tx
  send: 'https://viem.sh/docs/actions/wallet/sendTransaction',
  'tx:parse': 'https://viem.sh/docs/utilities/parseTransaction',
  'tx:serialize': 'https://viem.sh/docs/utilities/serializeTransaction',
  'tx:wait': 'https://viem.sh/docs/actions/public/waitForTransactionReceipt',
  // ens
  'ens:resolve': 'https://viem.sh/docs/ens/actions/getEnsAddress',
  'ens:lookup': 'https://viem.sh/docs/ens/actions/getEnsName',
  'ens:avatar': 'https://viem.sh/docs/ens/actions/getEnsAvatar',
  'ens:text': 'https://viem.sh/docs/ens/actions/getEnsText',
  'ens:resolver': 'https://viem.sh/docs/ens/actions/getEnsResolver',
  // siwe
  'siwe:create': 'https://viem.sh/docs/siwe/utilities/createSiweMessage',
  'siwe:verify': 'https://viem.sh/docs/siwe/actions/verifySiweMessage'
}

const DIR = new URL('../src/commands/', import.meta.url).pathname
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'))

let patched = 0
let skipped = 0

for (const file of files) {
  const path = join(DIR, file)
  const lines = readFileSync(path, 'utf8').split('\n')
  let currentCmd = null
  let inAfter = false
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const cmdMatch = line.match(/\.command\('([^']+)'\)/)
    if (cmdMatch) currentCmd = cmdMatch[1]
    if (/\.addHelpText\(\s*$/.test(line)) {
      inAfter = true
    }
    // Detect the footer pattern:  `        ''`  followed next line by `      ].join('\n')`
    if (
      inAfter &&
      currentCmd &&
      /^\s+''\s*$/.test(line) &&
      /^\s*\]\.join\(/.test(lines[i + 1] ?? '')
    ) {
      const url = URLS[currentCmd]
      if (!url) {
        console.warn(`! no URL for command ${currentCmd} in ${file}`)
        out.push(line)
        skipped++
        inAfter = false
        continue
      }
      // Avoid double-inject if Docs line already exists immediately above
      const prev = (out[out.length - 1] ?? '').trim()
      if (prev.startsWith("'Docs:")) {
        out.push(line)
        inAfter = false
        continue
      }
      const indent = line.match(/^(\s+)/)[1]
      out.push(`${indent}'Docs: ${url}',`)
      out.push(line)
      patched++
      inAfter = false
      continue
    }
    if (/^\s*\]\.join\(/.test(line)) inAfter = false
    out.push(line)
  }
  writeFileSync(path, out.join('\n'))
}

console.log(`patched: ${patched}, skipped: ${skipped}`)
