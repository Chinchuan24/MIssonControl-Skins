#!/bin/sh
# Fails if the mod's source gains network code of its own: fetch, HTTP or socket
# modules, or a download tool run as a process. See docs/PRIVACY.md.
cd "$(dirname "$0")/.." || exit 2

pattern='\bfetch\(|XMLHttpRequest|WebSocket|EventSource|node:(http|https|net|tls|dgram)|from .(http|https|net|tls|dgram|axios|node-fetch|undici).|require\(.(http|https|net|tls|axios|node-fetch|undici).\)|\b(curl|wget|nc|ncat|ssh|scp|rsync|ftp)\b'

hits=$(grep -rnE "$pattern" hooks scripts --include='*.ts' --include='*.tsx' --include='*.sh' \
  | grep -v '\.test\.ts:' \
  | grep -v '^scripts/check-privacy\.sh:' \
  | grep -vE ':[0-9]+:\s*(//|\*|#)')

if [ -n "$hits" ]; then
  echo "✗ Network code found. Check it, then update docs/PRIVACY.md:"
  echo "$hits"
  exit 1
fi
echo "✓ No network code in hooks/ or scripts/."
