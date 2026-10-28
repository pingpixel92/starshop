#!/bin/bash
# Task 49 — scrape Iranicard gift-card pages (missing brands)
# For each new gift card: page text (plans/amounts) + order-form fields after clicking ثبت درخواست
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

SC="$1"   # slug e.g. application-giftcard/hulu
N="$2"    # output name
URL="$BASE/$SC/"

if open_retry "$URL"; then
  agent-browser eval "document.body.innerText.slice(0,5000)" > "$OUT/$N.txt" 2>&1
  # click ثبت درخواست (first button/link with this text)
  agent-browser eval "(()=>{const els=[...document.querySelectorAll('button,a,input[type=submit]')];const b=els.find(e=>e.textContent&&e.textContent.includes('ثبت درخواست'));if(b){b.click();return 'clicked:'+b.tagName}else return 'not-found'})()" >> "$OUT/$N.txt" 2>&1
  sleep 3
  echo "===FORM===" >> "$OUT/$N.txt"
  agent-browser eval "(()=>{const txt=[];document.querySelectorAll('input,select,textarea').forEach(i=>{if(i.offsetParent!==null)txt.push(i.tagName+'['+(i.type||'')+'] ph='+(i.placeholder||'')+' label='+(i.labels&&i.labels[0]?i.labels[0].innerText.trim():''))});return txt.join('\n')})()" >> "$OUT/$N.txt" 2>&1
  echo "===MODALTEXT===" >> "$OUT/$N.txt"
  agent-browser eval "(()=>{const m=document.querySelector('.modal,.popup,[class*=modal],[class*=popup]');return m?m.innerText.slice(0,2500):'no-modal'})()" >> "$OUT/$N.txt" 2>&1
  echo "OK $N"
else
  echo "FAIL $N" 
fi
