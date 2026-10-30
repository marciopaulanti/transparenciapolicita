#!/usr/bin/env bash
# ============================================================================
# deploy.sh — publica o Transparência Política na VPS
# ---------------------------------------------------------------------------
# Uso (a partir da sua máquina):
#     ./deploy/deploy.sh /caminho/do/codigo            # sincroniza e sobe
#     ./deploy/deploy.sh /caminho/do/codigo --so-codigo  # só sincroniza
#
# O script é idempotente: rodar de novo reinicia o contêiner com o código
# novo, sem perder o banco (que está em volume nomeado).
#
# O projeto é independente: rede Docker, volume e contêiner próprios, e
# nenhuma dependência de outro projeto da VPS.
# ============================================================================

set -euo pipefail

# ------------------------------------------------------------- parâmetros --

ORIGEM="${1:?informe o caminho local do código}"
SO_CODIGO="${2:-}"

DESTINO="${TP_DESTINO:-/docker/transparenciapolicita}"
USUARIO_SSH="${TP_SSH:-root@179.197.228.218}"
PORTA_INTERNA="${TP_PORTA:-8080}"
COMPOSE="${DESTINO}/docker-compose.yml"
ARQUIVO_ENV="${DESTINO}/.env"

echo "==> Publicando em ${USUARIO_SSH}:${DESTINO}"

# ----------------------------------------------------------- sincronização --

echo "==> Enviando arquivos"
ssh "${USUARIO_SSH}" "mkdir -p ${DESTINO}"
rsync -az --delete \
  --exclude '.git' \
  --exclude '.node_modules' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.playwright-mcp' \
  --exclude 'replica/screens' \
  --exclude '.env' \
  --exclude '/data/' \
  --exclude '/db/data/' \
  --exclude '/app/tools/.cache/' \
  "${ORIGEM}/" "${USUARIO_SSH}:${DESTINO}/"

if [ "${SO_CODIGO}" = "--so-codigo" ]; then
  echo "==> Só os arquivos foram enviados. Reconstrói na VPS quando quiser."
  exit 0
fi

# ------------------------------------------------------------- configuração --

echo "==> Conferindo a configuração"
ssh "${USUARIO_SSH}" <<REMOTO
set -euo pipefail
cd ${DESTINO}

if [ ! -f .env ]; then
  cat > .env <<'ENV'
# Publicação: "/" na raiz do domínio próprio, "/transparenciapolicita/" em subdiretório.
TP_BASE_PATH=/
TP_AUDITORIA=1
TZ=America/Sao_Paulo
ENV
  echo "    .env criado com o padrão (TP_BASE_PATH=/)"
else
  echo "    .env já existe, mantido como está"
fi
REMOTO

# ------------------------------------------------------------------- build --

echo "==> Construindo a imagem"
ssh "${USUARIO_SSH}" "cd ${DESTINO} && docker compose build --pull"

echo "==> Subindo o serviço"
ssh "${USUARIO_SSH}" "cd ${DESTINO} && docker compose up -d --remove-orphans"

# ------------------------------------------------------------------ saúde --

echo "==> Conferindo a saúde"
sleep 3
ssh "${USUARIO_SSH}" "curl -fsS http://127.0.0.1:${PORTA_INTERNA}/api/health" || {
  echo "ERRO: o serviço não respondeu. Veja os logs:"
  ssh "${USUARIO_SSH}" "cd ${DESTINO} && docker compose logs --tail=40"
  exit 1
}

echo ""
echo "==> No ar."
echo "    Health:  http://127.0.0.1:${PORTA_INTERNA}/api/health"
echo "    Logs:    ssh ${USUARIO_SSH} 'cd ${DESTINO} && docker compose logs -f'"
echo "    Caddy:   bloco pronto em deploy/Caddyfile.transparenciapolicita"
