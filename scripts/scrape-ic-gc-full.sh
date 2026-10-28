#!/bin/bash
# Task 49 — scrape Iranicard gift-card pages: full text (amounts + regions + field hints)
OUT=/home/z/my-project/starshop/scripts/ic-gc
mkdir -p "$OUT"
BASE="https://www.iranicard.ir/card/giftcard"

open_retry() {
  local url="$1" tries=0
  while [ $tries -lt 4 ]; do
    agent-browser open "$url" >/dev/null 2>&1
    sleep 2
    T=$(agent-browser get title 2>/dev/null)
    case "$T" in
      429*) tries=$((tries+1)); sleep 15 ;;
      *) return 0 ;;
    esac
  done
  return 1
}

for entry in "$@"; do
  N="${entry##*/}"
  URL="$BASE/$entry/"
  if open_retry "$URL"; then
    agent-browser eval "document.body.innerText.slice(0,9000)" > "$OUT/$N.txt" 2>&1
    echo "OK $N"
    sleep 3
  else
    echo "FAIL $N"
  fi
done
