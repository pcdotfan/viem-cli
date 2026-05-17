#!/usr/bin/env bash
# End-to-end smoke test. Exercises every command against real RPCs.
#
# Usage:  bash tests/smoke.sh
# Env:
#   VIEM_BIN          override the CLI invocation (default: node dist/index.mjs)
#   VIEM_PRIVATE_KEY  signing key (test key set below by default)
#   VIEM_RPC_URL_1    Ethereum mainnet RPC override

set -u

VIEM=${VIEM_BIN:-"node $(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist/index.mjs"}
export VIEM_PRIVATE_KEY="${VIEM_PRIVATE_KEY:-0x2edab24d43bf39a069cf81a73b1ef25273859d2ecda4b5f06d3bd50adaec8458}"
export VIEM_RPC_URL_1="${VIEM_RPC_URL_1:-https://ethereum-rpc.publicnode.com}"

VITALIK="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
USDC="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
PASS=0
FAIL=0
FAILED=()

run() {
  local desc="$1"; shift
  local raw
  raw="$("$@" 2>&1)"
  local code=$?
  if [[ $code -eq 0 && -n "$raw" ]]; then
    printf "  \033[32m✓\033[0m %s\n" "$desc" >&2
    PASS=$((PASS+1))
    printf '%s' "$raw"
  else
    printf "  \033[31m✗\033[0m %s (exit=%d)\n" "$desc" "$code" >&2
    printf "      \033[2mout:\033[0m %s\n" "$(printf '%s' "$raw" | head -1)" >&2
    FAIL=$((FAIL+1))
    FAILED+=("$desc")
    return $code
  fi
}

run_quiet() { run "$@" >/dev/null; }

match() {
  local desc="$1"; shift
  local expected="$1"; shift
  local actual
  actual="$("$@" 2>&1)"
  local code=$?
  if [[ $code -eq 0 && "$actual" == *"$expected"* ]]; then
    printf "  \033[32m✓\033[0m %s\n" "$desc"
    PASS=$((PASS+1))
  else
    printf "  \033[31m✗\033[0m %s (exit=%d)\n" "$desc" "$code"
    printf "      \033[2mwant:\033[0m %s\n" "$expected"
    printf "      \033[2mgot :\033[0m %s\n" "$(printf '%s' "$actual" | head -1)"
    FAIL=$((FAIL+1))
    FAILED+=("$desc")
  fi
}

# Like match, but exit code is allowed to be anything (used for commands that
# intentionally exit nonzero alongside a meaningful stdout, e.g. address:is-valid false).
match_out() {
  local desc="$1"; shift
  local expected="$1"; shift
  local actual
  actual="$("$@" 2>&1 || true)"
  if [[ "$actual" == *"$expected"* ]]; then
    printf "  \033[32m✓\033[0m %s\n" "$desc"
    PASS=$((PASS+1))
  else
    printf "  \033[31m✗\033[0m %s\n" "$desc"
    printf "      \033[2mwant:\033[0m %s\n" "$expected"
    printf "      \033[2mgot :\033[0m %s\n" "$(printf '%s' "$actual" | head -1)"
    FAIL=$((FAIL+1))
    FAILED+=("$desc")
  fi
}

section() {
  printf "\n\033[1m%s\033[0m\n" "$1"
}

#---------------------------------------------------------------
section "account / units / hash / hex / address (pure local)"

run_quiet "account:generate"                $VIEM account:generate
match "account:from-private-key"  "0x"     $VIEM account:from-private-key "$VIEM_PRIVATE_KEY"
match "account:from-mnemonic"     "0x"     $VIEM account:from-mnemonic "test test test test test test test test test test test junk"
match "account:address"           "0x"     $VIEM account:address

match "units:parse-ether"   "1500000000000000000" $VIEM units:parse-ether 1.5
match "units:format-ether"  "1.5"                  $VIEM units:format-ether 1500000000000000000
match "units:parse-gwei"    "30000000000"          $VIEM units:parse-gwei 30
match "units:format-gwei"   "1"                    $VIEM units:format-gwei 1000000000
match "units:parse"         "12340000"             $VIEM units:parse 12.34 6
match "units:format"        "12.34"                $VIEM units:format 12340000 6

match "hash:keccak256 (utf8)" "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8" $VIEM hash:keccak256 hello
match "hash:keccak256 (hex)"  "0x" $VIEM hash:keccak256 "0xdeadbeef"
match "hash:message"          "0x" $VIEM hash:message "hello"
match "hash:typed-data"       "0x" $VIEM hash:typed-data '{"domain":{"name":"x"},"types":{"EIP712Domain":[{"name":"name","type":"string"}],"Person":[{"name":"name","type":"string"}]},"primaryType":"Person","message":{"name":"Alice"}}'

match "hex:from string"  "0x68656c6c6f" $VIEM hex:from hello
match "hex:to string"    "hello"        $VIEM hex:to 0x68656c6c6f
match "bytes:from"       "0x68656c6c6f" $VIEM bytes:from hello
match "bytes:to"         "hello"        $VIEM bytes:to 0x68656c6c6f

match "address:checksum" "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" $VIEM address:checksum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
match     "address:is-valid (true)"  "true"  $VIEM address:is-valid "$VITALIK"
match_out "address:is-valid (false)" "false" $VIEM address:is-valid "0xnotreal"

#---------------------------------------------------------------
section "abi"

match "abi:parse"           '"name": "balanceOf"' $VIEM abi:parse "function balanceOf(address) view returns (uint256)"
match "abi:encode-function" "0x70a08231"          $VIEM abi:encode-function --abi "function balanceOf(address)" --function balanceOf --args "$VITALIK"
match "abi:decode-function" "1"                   $VIEM abi:decode-function --abi "function balanceOf(address) view returns (uint256)" --function balanceOf --data "0x0000000000000000000000000000000000000000000000000000000000000001"
match "abi:encode (single)" "0x"                  $VIEM abi:encode --types "uint256" --values 42
match "abi:decode (single)" "42"                  $VIEM abi:decode --types "uint256" --data "0x000000000000000000000000000000000000000000000000000000000000002a"

#---------------------------------------------------------------
section "chains (catalog)"

run_quiet "chains list"      $VIEM chains --limit 5
match    "chains --search"  "Ethereum" $VIEM chains -s ethereum

#---------------------------------------------------------------
section "rpc reads (mainnet)"

run_quiet "balance"        $VIEM balance "$VITALIK"
run_quiet "block latest"   $VIEM --json block latest
run_quiet "block-number"   $VIEM block-number
match    "chain-id"  "1"   $VIEM chain-id
run_quiet "gas-price"      $VIEM gas-price
run_quiet "code (USDC)"    $VIEM code "$USDC"
run_quiet "storage (USDC)" $VIEM storage "$USDC" 0
run_quiet "nonce"          $VIEM nonce "$VITALIK"
match    "call (USDC totalSupply)" "0x" $VIEM call --to "$USDC" --data 0x18160ddd
run_quiet "estimate-gas"   $VIEM estimate-gas --to "$VITALIK"

# Use a stable mined tx hash — fetch from latest block first.
# Block JSON has its own top-level "hash" field, so parse with Node to grab transactions[0].hash.
LATEST_TX="$($VIEM --json block latest --full 2>/dev/null | node -e '
let d = ""
process.stdin.on("data", (c) => (d += c))
process.stdin.on("end", () => {
  try {
    const b = JSON.parse(d)
    const tx = (b.transactions ?? []).find((t) => t && t.hash)
    console.log(tx?.hash ?? "")
  } catch { console.log("") }
})
')"
if [[ -n "$LATEST_TX" ]]; then
  run_quiet "tx (latest block tx)"    $VIEM tx "$LATEST_TX"
  run_quiet "receipt (latest)"        $VIEM receipt "$LATEST_TX"
  run_quiet "tx:wait (already mined)" $VIEM tx:wait "$LATEST_TX" --confirmations 0 --timeout 15000
else
  printf "  \033[33m~\033[0m tx/receipt/tx:wait skipped (could not fetch a tx hash from latest block)\n"
fi

run_quiet "logs (USDC, latest)" $VIEM logs --address "$USDC" --from-block latest --to-block latest

#---------------------------------------------------------------
section "contract"

match "contract:read USDC.totalSupply" "0" $VIEM contract:read --to "$USDC" --abi "function totalSupply() view returns (uint256)" --function totalSupply
run_quiet "contract:simulate USDC.approve" $VIEM contract:simulate --to "$USDC" --abi "function approve(address,uint256) returns (bool)" --function approve --args "$VITALIK" --args 1
run_quiet "contract:write --dry-run"        $VIEM contract:write --to "$USDC" --abi "function approve(address,uint256) returns (bool)" --function approve --args "$VITALIK" --args 1 --dry-run
run_quiet "contract:multicall"              $VIEM contract:multicall --calls "[{\"address\":\"$USDC\",\"abi\":\"function totalSupply() view returns (uint256)\",\"functionName\":\"totalSupply\"}]"
run_quiet "contract:events (USDC, 1 block)" $VIEM contract:events --to "$USDC" --abi "event Transfer(address indexed from, address indexed to, uint256 value)" --event Transfer --from-block latest --to-block latest

#---------------------------------------------------------------
section "sign / verify / recover"

ADDR="$($VIEM account:address)"
SIG_MSG="$($VIEM sign:message hello)"
match "sign:message returns 0x"   "0x" printf '%s' "$SIG_MSG"
match "verify:message true"       "true"  $VIEM verify:message --address "$ADDR" --message hello --signature "$SIG_MSG"
match "recover:address"           "$ADDR" $VIEM recover:address --message hello --signature "$SIG_MSG"

TYPED='{"domain":{"name":"x","chainId":1},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"chainId","type":"uint256"}],"Person":[{"name":"name","type":"string"}]},"primaryType":"Person","message":{"name":"Alice"}}'
SIG_TYPED="$($VIEM sign:typed-data "$TYPED")"
match "sign:typed-data returns 0x" "0x" printf '%s' "$SIG_TYPED"
match "verify:typed-data true"     "true"  $VIEM verify:typed-data --address "$ADDR" --data "$TYPED" --signature "$SIG_TYPED"
match "recover:typed-data"         "$ADDR" $VIEM recover:typed-data --data "$TYPED" --signature "$SIG_TYPED"

TX_JSON='{"to":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","value":"0","gas":"21000","maxFeePerGas":"100000000000","maxPriorityFeePerGas":"1000000000","nonce":"0","chainId":"1","type":"eip1559"}'
match "sign:transaction" "0x" $VIEM sign:transaction "$TX_JSON"

#---------------------------------------------------------------
section "tx / send"

run_quiet "send --dry-run" $VIEM send --to "$VITALIK" --value 0 --dry-run
run_quiet "tx:serialize"   $VIEM tx:serialize "$TX_JSON"
SERIALIZED="$($VIEM tx:serialize "$TX_JSON" 2>/dev/null || true)"
if [[ -n "$SERIALIZED" ]]; then
  run_quiet "tx:parse"     $VIEM tx:parse "$SERIALIZED"
else
  printf "  \033[33m~\033[0m tx:parse skipped (no serialized input)\n"
fi

#---------------------------------------------------------------
section "ens (mainnet)"

match "ens:resolve vitalik.eth"  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" $VIEM ens:resolve vitalik.eth
match "ens:lookup vitalik"       ".eth" $VIEM ens:lookup "$VITALIK"
run_quiet "ens:resolver vitalik" $VIEM ens:resolver vitalik.eth
# Avatar and text records can be empty depending on records — treat as soft pass when output exists
$VIEM ens:avatar vitalik.eth >/dev/null 2>&1 && printf "  \033[32m✓\033[0m ens:avatar\n" && PASS=$((PASS+1)) || { printf "  \033[33m~\033[0m ens:avatar (no record — soft skip)\n"; }
$VIEM ens:text vitalik.eth url >/dev/null 2>&1 && printf "  \033[32m✓\033[0m ens:text url\n"  && PASS=$((PASS+1)) || { printf "  \033[33m~\033[0m ens:text (no record — soft skip)\n"; }

#---------------------------------------------------------------
section "siwe"

NONCE="abcdef1234567890"
SIWE_MSG="$($VIEM siwe:create --domain example.com --uri https://example.com --address "$ADDR" --nonce "$NONCE")"
match "siwe:create" "example.com" printf '%s' "$SIWE_MSG"
SIWE_SIG="$($VIEM sign:message "$SIWE_MSG")"
match "siwe:verify true" "true" $VIEM siwe:verify --message "$SIWE_MSG" --signature "$SIWE_SIG"

#---------------------------------------------------------------
printf "\n\033[1mResult:\033[0m %d passed, %d failed\n" "$PASS" "$FAIL"
if [[ $FAIL -gt 0 ]]; then
  printf "\nFailed tests:\n"
  for t in "${FAILED[@]}"; do printf "  - %s\n" "$t"; done
  exit 1
fi
exit 0
