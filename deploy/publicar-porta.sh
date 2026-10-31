#!/usr/bin/env bash
# Publica o Transparência Política na VPS por porta direta, sem Cloudflare.
#
# A borda da Hostinger só encaminha as portas que têm regra no firewall da VPS
# (é por isso que a 8088, de outro projeto, passa e a 8090 não). Este script
# cria essa regra, aplica a mesma liberação dentro da VPS e confere o
# endereço público.
#
# O que precisa:
#   HOSTINGER_API_TOKEN   token da API da Hostinger (hPanel → API → token)
#   TP_PORTA              porta do app (padrão 8090)
#   TP_VM_ID              id da VPS na Hostinger (padrão 2031251)
#   TP_SSH                alias SSH da VPS (padrão: hostinger)
#
# O que acontece:
#   1. abre a porta no UFW e na cadeia DOCKER-USER da VPS (o Docker publica
#      por DNAT e escapa do UFW, então o filtro fica no DOCKER-USER)
#   2. cria a regra da mesma porta no firewall da VPS no painel da Hostinger
#   3. sincroniza o firewall e confere a resposta de fora
#
# Sem TLS: o endereço fica http://<ip>:<porta>. Para HTTPS com hostname, use
# o túnel (deploy/publicar-tunel.sh), que resolve o TLS na borda da Cloudflare.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

PORTA="${TP_PORTA:-8090}"
VM_ID="${TP_VM_ID:-2031251}"
USUARIO_SSH="${TP_SSH:-hostinger}"
API="https://developers.hostinger.com"

erro() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
passo() { printf '\n==> %s\n' "$*"; }

[ -n "${HOSTINGER_API_TOKEN:-}" ] || erro "HOSTINGER_API_TOKEN nao definido (hPanel -> API -> token)."

chamada() { # metodo caminho [corpo]
  local metodo="$1" caminho="$2" corpo="${3:-}"
  if [ -n "$corpo" ]; then
    curl -sS -m 45 -X "$metodo" -H "Authorization: Bearer ${HOSTINGER_API_TOKEN}" \
      -H "Content-Type: application/json" --data "$corpo" "$API$caminho"
  else
    curl -sS -m 45 -X "$metodo" -H "Authorization: Bearer ${HOSTINGER_API_TOKEN}" \
      -H "Content-Type: application/json" "$API$caminho"
  fi
}

# ------------------------------------------------------------------- a VPS
passo "Abrindo a porta $PORTA dentro da VPS"
ssh "$USUARIO_SSH" "sudo ufw allow $PORTA/tcp comment 'transparenciapolicita: app publico do projeto' >/dev/null && \
  sudo iptables -D DOCKER-USER -p tcp -m tcp --dport $PORTA -j DOCKER-TP4 2>/dev/null; \
  sudo ip6tables -D DOCKER-USER -p tcp -m tcp --dport $PORTA -j DOCKER-TP6 2>/dev/null; \
  sudo ufw status | grep $PORTA"

# ------------------------------------------------------- firewall da Hostinger
passo "Criando a regra no firewall da VPS (Hostinger)"
FIREWALL_ID="${TP_FIREWALL_ID:-}"
if [ -z "$FIREWALL_ID" ]; then
  FIREWALL_ID=$(chamada GET /api/vps/v1/firewall | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',d)
lista=r.get('firewalls',r.get('rules',[])) if isinstance(r,dict) else []
print(lista[0].get('id') if lista else '')
")
fi
[ -n "$FIREWALL_ID" ] || erro "Nao foi possivel descobrir o firewall da VPS."
echo "    firewall: $FIREWALL_ID"

JA_TEM=$(chamada GET "/api/vps/v1/firewall/$FIREWALL_ID/rules" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',d)
lista=r.get('firewall_rules',r.get('rules',[])) if isinstance(r,dict) else []
alvo='$PORTA'
print(sum(1 for x in lista if str(x.get('port'))==alvo and x.get('protocol','').upper() in ('TCP','ANY')))
")
if [ "$JA_TEM" = "0" ]; then
  REGRA=$(chamada POST "/api/vps/v1/firewall/$FIREWALL_ID/rules" \
    "{\"protocol\":\"TCP\",\"port\":\"$PORTA\",\"source\":\"any\",\"source_detail\":\"0.0.0.0/0\"}")
  printf '%s' "$REGRA" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('    regra criada' if d.get('success') else '    falhou')
if not d.get('success'):
    for e in d.get('errors', []): print('   ', e.get('code'), e.get('message'))
"
else
  echo "    ja existe regra para a porta $PORTA"
fi

passo "Sincronizando o firewall com a VPS"
chamada POST "/api/vps/v1/firewall/$FIREWALL_ID/sync/$VM_ID" >/dev/null || true
sleep 6

# ------------------------------------------------------------- conferencia
passo "Conferindo de fora"
IP=$(ssh "$USUARIO_SSH" "curl -sS -m 8 https://api.ipify.org || hostname -I | awk '{print \$1}'" | tr -d '\r\n ')
CODIGO=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "http://$IP:$PORTA/api/health" 2>/dev/null || echo 000)
echo "    http://$IP:$PORTA/api/health -> $CODIGO"
if [ "$CODIGO" = "200" ]; then
  curl -sS -m 20 "http://$IP:$PORTA/api/health"; echo
  echo
  echo "==> No ar: http://$IP:$PORTA"
else
  echo "    A regra pode levar alguns segundos para valer no edge. Se continuar 000,"
  echo "    confira a regra em hPanel -> VPS -> Security -> Firewall."
fi
