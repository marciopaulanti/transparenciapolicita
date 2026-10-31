#!/usr/bin/env bash
# ============================================================================
# publicar-edge.sh — publica a borda do Transparência Política
# ---------------------------------------------------------------------------
# Uso (a partir da sua máquina):
#     ./deploy/publicar-edge.sh --worker     # sobe o proxy de borda
#     ./deploy/publicar-edge.sh --firewall   # restringe a porta da VPS
#     ./deploy/publicar-edge.sh              # faz os dois
#
# --worker: publica o script deploy/worker/worker.js como Worker do Cloudflare.
#           Ele repassa tudo para a VPS, sem tocar em conteúdo. É o caminho
#           que funciona sem depender de registro DNS na zona.
#
# --firewall: na VPS, deixa a porta do app (8090) acessível só a partir das
#             faixas públicas da Cloudflare. O Docker publica a porta por
#             DNAT e por isso escapa do UFW; o filtro fica na cadeia
#             DOCKER-USER, que é onde a publicação de porta é decidida.
#
# Variáveis de ambiente:
#     CLOUDFLARE_API_TOKEN   token de API da Cloudflare (permissão de escrita
#                            em Workers). Alternativa: CLOUDFLARE_OAUTH_TOKEN.
#     CLOUDFLARE_ACCOUNT_ID  conta da Cloudflare (padrão: a conta do projeto)
#     TP_SSH                 alias ssh da VPS            (padrão hostinger)
#     TP_PORTA               porta do app na VPS          (padrão 8090)
#     TP_WORKER_NOME         nome do Worker               (padrão transparenciapolicita-edge)
#     TP_ORIGEM              origem do proxy             (padrão o host sslip.io da VPS)
# ============================================================================

set -euo pipefail

ACAO="${1:-tudo}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

USUARIO_SSH="${TP_SSH:-hostinger}"
PORTA_HOST="${TP_PORTA:-8090}"
WORKER_NOME="${TP_WORKER_NOME:-transparenciapolicita-edge}"
CONTA="${CLOUDFLARE_ACCOUNT_ID:-28115feb123bceabd06a5dfb701e8589}"
ORIGEM="${TP_ORIGEM:-http://179-197-228-218.sslip.io:8090}"
ARQUIVO_WORKER="${RAIZ}/deploy/worker/worker.js"

# ------------------------------------------------------------------ credencial

token_cloudflare() {
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "${CLOUDFLARE_API_TOKEN}"; return
  fi
  if [ -n "${CLOUDFLARE_OAUTH_TOKEN:-}" ]; then
    echo "${CLOUDFLARE_OAUTH_TOKEN}"; return
  fi
  local arquivo="${TP_WRANGLER_CONFIG:-$HOME/Library/Preferences/.wrangler/config/default.toml}"
  if [ -f "${arquivo}" ]; then
    sed -n 's/^oauth_token = "\(.*\)"/\1/p' "${arquivo}" | head -1
  fi
}

# --------------------------------------------------------------------- worker

publicar_worker() {
  local token
  token="$(token_cloudflare)"
  if [ -z "${token}" ]; then
    echo "ERRO: sem credencial da Cloudflare." >&2
    echo "      Use CLOUDFLARE_API_TOKEN ou CLOUDFLARE_OAUTH_TOKEN." >&2
    return 1
  fi

  echo "==> Publicando o proxy de borda (${WORKER_NOME})"
  local metadados
  metadados="$(printf '{"main_module":"worker.js","compatibility_date":"2026-10-30","bindings":[{"type":"plain_text","name":"ORIGEM","text":"%s"}]}' "${ORIGEM}")"

  curl -sS -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/${CONTA}/workers/scripts/${WORKER_NOME}" \
    -H "Authorization: Bearer ${token}" \
    -F "metadata=${metadados};type=application/json" \
    -F "worker.js=@${ARQUIVO_WORKER};type=application/javascript+module" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("    ", "ok" if d.get("success") else d.get("errors"))'
}

# ------------------------------------------------------------------- firewall

publicar_firewall() {
  echo "==> Restringindo a porta ${PORTA_HOST} da VPS às faixas da Cloudflare"
  local faixas_v4 faixas_v6
  faixas_v4="$(mktemp)"; faixas_v6="$(mktemp)"
  curl -sS https://www.cloudflare.com/ips-v4 | grep -v '^$' > "${faixas_v4}"
  curl -sS https://www.cloudflare.com/ips-v6 | grep -v '^$' > "${faixas_v6}"

  scp -q "${faixas_v4}" "${USUARIO_SSH}:/tmp/cfips4.txt"
  scp -q "${faixas_v6}" "${USUARIO_SSH}:/tmp/cfips6.txt"

  ssh "${USUARIO_SSH}" bash -s -- "${PORTA_HOST}" <<'REMOTO'
set -euo pipefail
PORTA="$1"

aplicar() {
  local bin="$1" arquivo="$2" chain="$3"
  "$bin" -N "$chain" 2>/dev/null || true
  "$bin" -F "$chain"
  while read -r c; do
    [ -z "$c" ] && continue
    "$bin" -A "$chain" -s "$c" -j RETURN
  done < "$arquivo"
  "$bin" -A "$chain" -j DROP
  "$bin" -C DOCKER-USER -p tcp --dport "$PORTA" -j "$chain" 2>/dev/null || \
    "$bin" -I DOCKER-USER -p tcp --dport "$PORTA" -j "$chain"
}

aplicar iptables /tmp/cfips4.txt DOCKER-TP4
aplicar ip6tables /tmp/cfips6.txt DOCKER-TP6
rm -f /tmp/cfips4.txt /tmp/cfips6.txt
echo "     cadeia DOCKER-USER atualizada"
REMOTO

  rm -f "${faixas_v4}" "${faixas_v6}"
}

# ------------------------------------------------------------------------ main

case "${ACAO}" in
  --worker) publicar_worker ;;
  --firewall) publicar_firewall ;;
  tudo)
    publicar_worker
    publicar_firewall
    ;;
  *)
    echo "uso: $0 [--worker|--firewall]" >&2
    exit 2
    ;;
esac

echo "==> Pronto. A borda responde em:"
echo "    https://transparenciapolicita.luzempresarial.com.br"
