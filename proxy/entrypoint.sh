#!/usr/bin/env sh
set -eu

mkdir -p /config

if [ -z "${FLEET_KEY_PEM:-}" ]; then
  echo "Missing required env var: FLEET_KEY_PEM" >&2
  exit 1
fi

printf "%s\n" "$FLEET_KEY_PEM" > /config/fleet-key.pem
export TESLA_KEY_FILE=/config/fleet-key.pem

exec railway-http-proxy
