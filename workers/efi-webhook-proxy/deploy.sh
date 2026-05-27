#!/usr/bin/env bash
set -e

echo "=== Deploy Efí Webhook Proxy ==="

# 1. Deploy worker
wrangler deploy

# 2. Get worker URL (workers.dev subdomain)
WORKER_URL=$(wrangler deployments list --json 2>/dev/null | grep -o '"url":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""
echo "Worker URL: $WORKER_URL"
echo ""

# 3. Set PROXY_SECRET if not set yet
echo "Setting PROXY_SECRET secret..."
PROXY_SECRET=$(openssl rand -hex 32)
echo "$PROXY_SECRET" | wrangler secret put PROXY_SECRET

echo ""
echo "=== PROXY_SECRET gerado ==="
echo "Adicione esta variável no Vercel:"
echo "  EFI_PROXY_SECRET=$PROXY_SECRET"
echo ""
echo "Próximo passo: registrar webhook na Efí apontando para:"
echo "  $WORKER_URL"
