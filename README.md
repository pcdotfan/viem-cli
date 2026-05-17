# viem-cli

Command-line interface for [viem](https://viem.sh) — every viem action, from your terminal.

Read chain state, encode/decode ABI, sign messages and typed data, send transactions,
call contracts, resolve ENS, and build SIWE flows.

## Install

```bash
pnpm install
pnpm build           # → dist/index.mjs
node dist/index.mjs --help
```

Link globally:

```bash
pnpm link --global
viem --help
```

## Quickstart

```bash
# RPC reads (default chain: mainnet)
viem balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
viem --chain base block latest
viem chain-id
viem gas-price

# Units / hashes / hex
viem units:parse-ether 1.5
viem hash:keccak256 hello
viem hex:from hello

# Address
viem address:checksum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
viem address:is-valid 0x...

# ABI
viem abi:parse "function balanceOf(address) view returns (uint256)"
viem abi:encode-function --abi "function balanceOf(address)" --function balanceOf --args 0xd8dA...

# Contracts
viem contract:read --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
                   --abi "function totalSupply() view returns (uint256)" \
                   --function totalSupply

# Signing (needs VIEM_PRIVATE_KEY)
viem sign:message "hello"
viem verify:message --address 0x... --message hello --signature 0x...

# ENS
viem ens:resolve vitalik.eth
viem ens:lookup 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# SIWE
viem siwe:create --domain example.com --uri https://example.com \
                  --address 0x... --nonce abcdef
```

## Command index (55)

| Group     | Commands |
|-----------|----------|
| RPC reads | `balance` `block` `block-number` `chain-id` `gas-price` `tx` `receipt` `code` `storage` `nonce` `call` `estimate-gas` `logs` |
| Chains    | `chains` |
| Accounts  | `account:generate` `account:from-private-key` `account:from-mnemonic` `account:address` |
| Units     | `units:parse-ether` `units:format-ether` `units:parse-gwei` `units:format-gwei` `units:parse` `units:format` |
| Hash      | `hash:keccak256` `hash:message` `hash:typed-data` |
| Hex/Bytes | `hex:from` `hex:to` `bytes:from` `bytes:to` |
| Address   | `address:checksum` `address:is-valid` |
| ABI       | `abi:parse` `abi:encode-function` `abi:decode-function` `abi:encode` `abi:decode` |
| Contract  | `contract:read` `contract:write` `contract:simulate` `contract:multicall` `contract:events` |
| Sign      | `sign:message` `sign:typed-data` `sign:transaction` `verify:message` `verify:typed-data` `recover:address` `recover:typed-data` |
| Tx        | `send` `tx:parse` `tx:serialize` `tx:wait` |
| ENS       | `ens:resolve` `ens:lookup` `ens:avatar` `ens:text` `ens:resolver` |
| SIWE      | `siwe:create` `siwe:verify` |

Run `viem <command> --help` for flags.

## Chain selection

`--chain <name>` accepts any [`viem/chains`](https://github.com/wevm/viem/tree/main/src/chains/definitions)
export name (`mainnet`, `base`, `arbitrum`, `optimism`, `sepolia`, …), the chain's
display name (`OP Mainnet`), or a numeric chain id. Default is `mainnet`.

`--rpc-url <url>` overrides the RPC endpoint for the selected chain.

## Environment variables

| Var | Used for |
|---|---|
| `VIEM_PRIVATE_KEY` | 32-byte hex private key (signing commands) |
| `VIEM_RPC_URL` | fallback RPC URL for all chains |
| `VIEM_RPC_URL_<chainId>` | per-chain RPC URL override (e.g. `VIEM_RPC_URL_8453`) |
| `VIEM_DEBUG` | set to print stack traces on error |

## Global flags

- `--json` — JSON to stdout (machine-readable)
- `--quiet` — suppress informational lines
- `-c, --chain <name>` — chain selector (default `mainnet`)
- `--rpc-url <url>` — RPC override

## Exit codes

- `0` success
- `1` runtime / RPC error
- `2` bad input or missing env var

## Development

```bash
pnpm dev             # tsdown --watch
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest run (unit)
pnpm smoke           # bash tests/smoke.sh (end-to-end)
```

The smoke script runs every command against mainnet and a test wallet. Set
`VIEM_PRIVATE_KEY` and `VIEM_RPC_URL_1` in the env before running, or edit
defaults at the top of `tests/smoke.sh`.
