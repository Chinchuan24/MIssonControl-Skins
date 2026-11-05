#!/bin/sh
# Prints the Claude API key that Mission Control saved in the macOS Keychain.
#
# Claude Code runs this as its `apiKeyHelper` (see docs/SECURITY-billing.md):
#   "apiKeyHelper": "/absolute/path/to/scripts/anthropic-key-helper.sh"
#
# The key goes to standard output and nowhere else: it is not logged, not written to
# a file and not placed in any argument list. If there is no key, this prints
# nothing to stdout and exits non-zero, so Claude Code reports a failed helper
# instead of sending an empty key.
#
# Fixed on purpose: the service name, the account (this Mac user, from `id -un`)
# and the path to `security`. No environment variable can point this at another
# Keychain item.
set -u
account=$(/usr/bin/id -un) || exit 1
exec /usr/bin/security find-generic-password -a "$account" -s mission-control-anthropic-key -w
