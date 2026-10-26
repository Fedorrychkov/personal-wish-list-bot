#!/usr/bin/env bash
set -euo pipefail
: "${GITHUB_ENV:?GITHUB_ENV must point to the runner environment file}"
umask 077
tar -czf deployment.tgz -C .deploy .
payload=$(base64 < deployment.tgz | tr -d '\n')
# shortcut: cap config transport at 60 KiB; use a streamed SSH upload if it grows.
if [ "${#payload}" -gt 61440 ]; then
    echo 'Deployment config exceeds the single-session transport limit.' >&2
    exit 1
fi
# Encoded secrets need their own mask before any later action can print its environment.
printf '::add-mask::%s\n' "$payload"
printf 'DEPLOYMENT_ARCHIVE=%s\n' "$payload" >> "$GITHUB_ENV"
