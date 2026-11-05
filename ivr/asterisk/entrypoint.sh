#!/bin/sh
set -e
: "${PBXIM_USER:?set PBXIM_USER in ivr/.env}" "${PBXIM_PASSWORD:?set PBXIM_PASSWORD in ivr/.env}" "${PBXIM_HOST:?set PBXIM_HOST in ivr/.env}"
export PBXIM_PORT="${PBXIM_PORT:-5060}"
[ -n "$PUBLIC_IP" ] || PUBLIC_IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '\n')
export PUBLIC_IP
envsubst '$PBXIM_USER $PBXIM_PASSWORD $PBXIM_HOST $PBXIM_PORT $PUBLIC_IP' \
  < /etc/asterisk/pjsip.conf.tmpl > /etc/asterisk/pjsip.conf
mkdir -p /var/lib/asterisk/sounds/ivr && chmod 777 /var/lib/asterisk/sounds/ivr
echo "Registering $PBXIM_USER at $PBXIM_HOST:$PBXIM_PORT, public IP $PUBLIC_IP"
exec asterisk -f -vvv
