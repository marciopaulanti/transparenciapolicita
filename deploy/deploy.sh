#!/usr/bin/env bash
# ============================================================================
# deploy.sh — publica o Transparência Política na VPS
# ---------------------------------------------------------------------------
# Uso (a partir da sua máquina):
#     ./deploy/deploy.sh /caminho/do/codigo              # sincroniza e sobe
#     ./deploy/deploy.sh /caminho/do/codigo --so-codigo  # só sincroniza
#
# O script é idempotente: rodar de novo reinicia o contêiner com o código
# novo, sem perder o banco (que está em volume nomeado).
#
# O projeto é independente: rede Docker, volume e contêiner próprios, e
# nenhuma dependência de outro projeto da VPS.
#
# Variáveis de ambiente opcionais:
#     TP_SSH          alias ssh da VPS             (padrão hostinger)
#     TP_DESTINO      pasta da stack na VPS          (padrão /docker/transparenciapolicita)
#     TP_PORTA        porta do app no host           (padrão 8090)
#     TP_URL          URL público, só para imprimir (padrão o hostname do túnel)
#     TP_TUNNEL_CREDENTIALS  credencial do túnel em base64, usada só se o
#                            credentials.json ainda não existir na VPS
# ============================================================================

set -euo pipefail

# ------------------------------------------------------------- parâmetros --

ORIGEM="${1:?informe o caminho local do código}"
SO_CODIGO="${2:-}"

DESTINO="${TP_DESTINO:-/docker/transparenciapolicita}"
USUARIO_SSH="${TP_SSH:-hostinger}"
PORTA_HOST="${TP_PORTA:-8090}"
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
  --exclude '/tunnel/' \
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

# Configuração do túnel (o segredo, credentials.json, nunca vai para o git).
mkdir -p tunnel
if [ -f deploy/tunnel/config.yml ]; then
  cp deploy/tunnel/config.yml tunnel/config.yml
  echo "    tunnel/config.yml atualizado"
fi

if [ ! -f tunnel/credentials.json ] && [ -n "${TP_TUNNEL_CREDENTIALS:-}" ]; then
  printf '%s' "${TP_TUNNEL_CREDENTIALS:-}" | base64 -d > tunnel/credentials.json
  chmod 644 tunnel/credentials.json
  echo "    tunnel/credentials.json criado a partir de TP_TUNNEL_CREDENTIALS"
fi

if [ -f tunnel/credentials.json ]; then
  echo "    túnel configurado (perfil 'tunnel' será subir junto)"
else
  echo "    AVISO: sem tunnel/credentials.json — só o app sobe (use um proxy externo)"
fi
REMOTO

# ------------------------------------------------------------------- build --

echo "==> Construindo a imagem"
ssh "${USUARIO_SSH}" "cd ${DESTINO} && docker compose build --pull"

echo "==> Subindo o serviço"
ssh "${USUARIO_SSH}" "cd ${DESTINO} && docker compose up -d --remove-orphans"

# O túnel só entra se houver credencial na VPS.
ssh "${USUARIO_SSH}" "cd ${DESTINO} && if [ -f tunnel/credentials.json ]; then docker compose --profile tunnel up -d; fi"

# ------------------------------------------------------------------ saúde --

echo "==> Conferindo a saúde"
sleep 3
ssh "${USUARIO_SSH}" "curl -fsS http://127.0.0.1:${PORTA_HOST}/api/health" || {
  echo "ERRO: o serviço não respondeu. Veja os logs:"
  ssh "${USUARIO_SSH}" "cd ${DESTINO} && docker compose logs --tail=40"
  exit 1
}

echo ""
echo "==> No ar."
echo "    Health:  http://127.0.0.1:${PORTA_HOST}/api/health"
if [ -n "${TP_URL:-}" ]; then
  echo "    URL:     ${TP_URL}"
fi
echo "    Logs:    ssh ${USUARIO_SSH} 'cd ${DESTINO} && docker compose logs -f'"
echo "    Proxy:   deploy/Caddyfile.transparenciapolicita"
