#!/usr/bin/env bash
# Run this AFTER families.im nameservers are pointing to Cloudflare.
# Requires: CF_API_TOKEN env var with Zone.DNS.Write + Zone.Settings.Write + Workers.Routes.Write

set -euo pipefail

ZONE_ID="fa8aee2c4852470e3003cfc7efa0f589"
ACCOUNT_ID="6ad3e0395d22563a4d525da63ed4b38a"
WORKER_NAME="efi-webhook-proxy"
WEBHOOK_HOSTNAME="pix.families.im"
CA_CERT_URL="https://certificados.efipay.com.br/webhooks/certificate-chain-prod.crt"

if [ -z "${CF_API_TOKEN:-}" ]; then
  echo "❌ Set CF_API_TOKEN first:"
  echo "   Create at https://dash.cloudflare.com/profile/api-tokens"
  echo "   Permissions: Zone.DNS.Edit + Zone.Settings.Read + Workers Routes.Edit + SSL.Edit"
  exit 1
fi

AUTH=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

echo "=== 1. Adding DNS records for families.im → Vercel ==="
# A record for root domain
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  "${AUTH[@]}" \
  -d '{"type":"A","name":"families.im","content":"76.76.21.21","proxied":true,"ttl":1}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('A record:', 'OK' if d.get('success') else d.get('errors'))"

# CNAME for www
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  "${AUTH[@]}" \
  -d '{"type":"CNAME","name":"www","content":"cname.vercel-dns.com","proxied":true,"ttl":1}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('CNAME www:', 'OK' if d.get('success') else d.get('errors'))"

# CNAME for pix subdomain (Worker route)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  "${AUTH[@]}" \
  -d "{\"type\":\"CNAME\",\"name\":\"pix\",\"content\":\"${WORKER_NAME}.familiesim.workers.dev\",\"proxied\":true,\"ttl\":1}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('CNAME pix:', 'OK' if d.get('success') else d.get('errors'))"

echo ""
echo "=== 2. Uploading Efí CA cert for mTLS ==="
CA_CERT=$(curl -s "$CA_CERT_URL")

MTLS_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/mtls_certificates" \
  "${AUTH[@]}" \
  -d "{\"name\":\"Efi Pay Root CA\",\"certificates\":$(echo "$CA_CERT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"),\"ca\":true}")

echo "$MTLS_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('CA upload:', 'OK id=' + d['result']['id'] if d.get('success') else d.get('errors'))"
MTLS_CA_ID=$(echo "$MTLS_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'])" 2>/dev/null || echo "")

echo ""
echo "=== 3. Configuring mTLS for ${WEBHOOK_HOSTNAME} ==="
if [ -n "$MTLS_CA_ID" ]; then
  curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/mtls_certificates/associations" \
    "${AUTH[@]}" \
    -d "{\"mtls_certificate_id\":\"${MTLS_CA_ID}\",\"associated_hostnames\":[\"${WEBHOOK_HOSTNAME}\"]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('mTLS binding:', 'OK' if d.get('success') else d.get('errors'))"
else
  echo "⚠ Skipping mTLS binding (CA ID not captured)"
fi

echo ""
echo "=== 4. Adding Worker route for ${WEBHOOK_HOSTNAME} ==="
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/workers/routes" \
  "${AUTH[@]}" \
  -d "{\"pattern\":\"${WEBHOOK_HOSTNAME}/*\",\"script\":\"${WORKER_NAME}\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Route:', 'OK' if d.get('success') else d.get('errors'))"

echo ""
echo "=== 5. Registering Efí webhook → https://${WEBHOOK_HOSTNAME} ==="
cd "$(dirname "$0")/../.."
npx tsx scripts/register-efi-webhook.ts "https://${WEBHOOK_HOSTNAME}"

echo ""
echo "✅ Done! Efí webhook registered at https://${WEBHOOK_HOSTNAME}"
echo "   Monitor via: wrangler tail ${WORKER_NAME}"
