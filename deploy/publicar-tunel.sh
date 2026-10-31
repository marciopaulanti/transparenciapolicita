#!/usr/bin/env bash
# Publica o Transparência Política na VPS com um túnel de saída (Cloudflare Tunnel).
#
# O app, a API e o banco ficam 100% na VPS: o cloudflared apenas sai para a
# internet e a borda da Cloudflare entrega o tráfego de volta. Nenhuma porta do
# app é aberta no firewall da VPS e o TLS fica por conta da Cloudflare.
#
# O que este script precisa:
#   CLOUDFLARE_API_TOKEN   token da SUA conta, com as permissões:
#                            - Account > Cloudflare Tunnel > Edit
#                            - Zone > DNS > Edit
#                            - Zone > Zone > Read
#   TP_HOSTNAME            nome completo, ex.: transparenciapolicita.seudominio.com.br
#   TP_ZONE                zona onde o nome mora (opcional: deduz do hostname)
#   TP_SSH                 alias SSH da VPS (padrão: hostinger)
#
# O que ele faz:
#   1. cria um túnel nomeado na conta e grava a credencial
#   2. publica a configuração de entrada (hostname -> http://transparenciapolicita:8080)
#   3. cria o registro CNAME do hostname apontando para o túnel
#   4. sobe o contêiner do cloudflared na VPS, na rede do próprio projeto
#   5. confere a resposta pública
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

USUARIO_SSH="${TP_SSH:-hostinger}"
DESTINO="${TP_DESTINO:-/docker/transparenciapolicita}"
HOSTNAME_ALVO="${TP_HOSTNAME:-}"
ZONE_NOME="${TP_ZONE:-}"
NOME_TUNEL="${TP_TUNNEL_NAME:-transparenciapolicita}"

erro() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
aviso() { printf '\033[33m%s\033[0m\n' "$*"; }
passo() { printf '\n==> %s\n' "$*"; }

[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || erro "CLOUDFLARE_API_TOKEN nao definido (token da sua conta Cloudflare)."
[ -n "$HOSTNAME_ALVO" ] || erro "TP_HOSTNAME nao definido (ex.: transparenciapolicita.seudominio.com.br)."

CF="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

chamada() { # metodo caminho [corpo]
  local metodo="$1" caminho="$2" corpo="${3:-}"
  if [ -n "$corpo" ]; then
    curl -sS -m 45 -X "$metodo" "${AUTH[@]}" --data "$corpo" "$CF$caminho"
  else
    curl -sS -m 45 -X "$metodo" "${AUTH[@]}" "$CF$caminho"
  fi
}

erro_de() { # resposta
  python3 - "$1" <<'PY'
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('resposta nao-json'); raise SystemExit
if not d.get('success'):
    for e in d.get('errors', []):
        print(f"  {e.get('code')}: {e.get('message')}")
PY
}

# ---------------------------------------------------------------- conta e zona
passo "Descobrindo a conta"
CONTA_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
if [ -z "$CONTA_ID" ]; then
  CONTAS=$(chamada GET /accounts)
  CONTA_ID=$(printf '%s' "$CONTAS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('result') or []
print(r[0]['id'] if len(r)==1 else '')
")
  [ -n "$CONTA_ID" ] || CONTA_ID=$(printf '%s' "$CONTAS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('result') or []
print(r[0]['id'] if r else '')
")
fi
[ -n "$CONTA_ID" ] || erro "Nao foi possivel descobrir a conta. Defina CLOUDFLARE_ACCOUNT_ID."
NOME_CONTA=$(chamada GET "/accounts/$CONTA_ID" | python3 -c "import json,sys; print((json.load(sys.stdin).get('result') or {}).get('name',''))")
echo "    conta: $NOME_CONTA ($CONTA_ID)"

passo "Descobrindo a zona"
if [ -z "$ZONE_NOME" ]; then
  ZONE_NOME=$(printf '%s' "$HOSTNAME_ALVO" | python3 -c "
import sys
h=sys.stdin.read().strip()
print('.'.join(h.split('.')[1:]))
")
fi
ZONA=$(chamada GET "/zones?name=$ZONE_NOME")
ZONE_ID=$(printf '%s' "$ZONA" | python3 -c "import json,sys; r=json.load(sys.stdin).get('result') or []; print(r[0]['id'] if r else '')")
[ -n "$ZONE_ID" ] || erro "Zona '$ZONE_NOME' nao encontrada nesta conta. O token precisa enxergar a zona."
echo "    zona: $ZONE_NOME ($ZONE_ID)"

# ------------------------------------------------------------------- o tunel
passo "Criando o tunel de saida"
SEGredo=$(python3 -c "import base64,os; print(base64.b64encode(os.urandom(32)).decode())")
TUNEL=$(chamada POST "/accounts/$CONTA_ID/cfd_tunnel" "{\"name\":\"$NOME_TUNEL\",\"tunnel_secret\":\"$SEGredo\",\"config_src\":\"cloudflare\"}")
TUNEL_ID=$(printf '%s' "$TUNEL" | python3 -c "import json,sys; print((json.load(sys.stdin).get('result') or {}).get('id',''))")
if [ -z "$TUNEL_ID" ]; then
  erro "Nao foi possivel criar o tunel:"; erro_de "$TUNEL"; exit 1
fi
echo "    tunel: $NOME_TUNEL ($TUNEL_ID)"

passo "Publicando a configuracao de entrada"
CONFIG='{"config":{"ingress":[{"hostname":"'"$HOSTNAME_ALVO"'","service":"http://transparenciapolicita:8080"},{"service":"http_status:404"}],"warp-routing":{"enabled":false}}}'
CONFIG_RESPOSTA=$(chamada PUT "/accounts/$CONTA_ID/cfd_tunnel/$TUNEL_ID/configurations" "$CONFIG")
printf '%s' "$CONFIG_RESPOSTA" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('    ok' if d.get('success') else '    falhou')
" || true

passo "Criando o registro DNS do hostname"
DNS_RESPOSTA=$(chamada POST "/zones/$ZONE_ID/dns_records" "{\"type\":\"CNAME\",\"name\":\"$HOSTNAME_ALVO\",\"content\":\"$TUNEL_ID.cfargotunnel.com\",\"proxied\":true,\"comment\":\"Transparencia Politica - tunel de saida\"}")
if printf '%s' "$DNS_RESPOSTA" | python3 -c "import json,sys; sys.exit(0 if json.load(sys.stdin).get('success') else 1)"; then
  echo "    CNAME $HOSTNAME_ALVO -> $TUNEL_ID.cfargotunnel.com (proxiado)"
else
  aviso "    O token nao conseguiu criar o registro DNS. Crie manualmente:"
  echo "      tipo   CNAME"
  echo "      nome   ${HOSTNAME_ALVO%%.*}"
  echo "      alvo   $TUNEL_ID.cfargotunnel.com"
  echo "      proxy  ligado"
fi

# ------------------------------------------------------------------- a VPS
passo "Enviando a configuracao para a VPS"
mkdir -p "$RAIZ/tunnel"
cat > "$RAIZ/tunnel/credentials.json" <<JSON
{"AccountTag":"$CONTA_ID","TunnelID":"$TUNEL_ID","TunnelName":"$NOME_TUNEL","TunnelSecret":"$SEGredo"}
JSON
chmod 600 "$RAIZ/tunnel/credentials.json"
cat > "$RAIZ/tunnel/config.yml" <<YAML
# Túnel de saída do Transparência Política.
# Gerado por deploy/publicar-tunel.sh — o hostname e a conta sao os da sua conta.
tunnel: $TUNEL_ID
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: $HOSTNAME_ALVO
    service: http://transparenciapolicita:8080
  - service: http_status:404
YAML

ssh "$USUARIO_SSH" "mkdir -p $DESTINO/tunnel"
scp -q "$RAIZ/tunnel/config.yml" "$USUARIO_SSH:$DESTINO/tunnel/config.yml"
scp -q "$RAIZ/tunnel/credentials.json" "$USUARIO_SSH:$DESTINO/tunnel/credentials.json"
ssh "$USUARIO_SSH" "chmod 600 $DESTINO/tunnel/credentials.json && chmod 644 $DESTINO/tunnel/config.yml"
echo "    arquivos em $DESTINO/tunnel"

passo "Subindo o tunel na VPS"
ssh "$USUARIO_SSH" "cd $DESTINO && docker compose --profile tunnel up -d"
sleep 6
ssh "$USUARIO_SSH" "docker ps --filter name=tunnel --format '{{.Names}} {{.Status}}'"

passo "Conferindo a resposta publica"
for tentativa in 1 2 3 4 5; do
  CODIGO=$(curl -sS -m 25 -o /dev/null -w '%{http_code}' "https://$HOSTNAME_ALVO/api/health" 2>/dev/null || echo 000)
  if [ "$CODIGO" = "200" ]; then break; fi
  sleep 5
done
echo "    https://$HOSTNAME_ALVO/api/health -> $CODIGO"
if [ "$CODIGO" = "200" ]; then
  curl -sS -m 25 "https://$HOSTNAME_ALVO/api/health"; echo
  echo
  echo "==> Publicado: https://$HOSTNAME_ALVO"
else
  aviso "    Ainda nao respondeu 200. Common: o registro DNS ainda propagou, ou o proxy da"
  aviso "    zona esta ligado e injecting scripts (o projeto bloqueia por CSP)."
fi
