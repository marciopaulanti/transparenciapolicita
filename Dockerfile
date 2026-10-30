# ============================================================================
# Transparência Política — imagem de produção
# ---------------------------------------------------------------------------
# Python puro, sem pip install: o servidor usa só a biblioteca padrão. A
# imagem fica pequena e o deploy não depende de rede para instalar nada.
#
# Multi-stage só no necessário: a etapa final só tem o runtime, o código e
# o dataset. O `node` aparece porque o dataset é exportado a partir do
# `fixtures.js` — mas só na etapa de construção.
# ============================================================================

# --------------------------------------------------------------- frontend --

FROM node:22-alpine AS assets

WORKDIR /build

# Só o necessário para exportar o dataset. O app inteiro é copiado depois.
COPY app/js/ ./app/js/
COPY app/tools/export-dataset.mjs ./app/tools/export-dataset.mjs

RUN node app/tools/export-dataset.mjs --saida /build/dataset.json

# --------------------------------------------------------------- runtime --

FROM python:3.12-slim AS runtime

# Nenhuma dependência externa. `tini` não é preciso: o processo do Python
# é o PID 1 e recebe o SIGTERM direto do Docker.
LABEL org.opencontainers.image.title="Transparência Política" \
      org.opencontainers.image.description="Protótipo de transparência política com API e banco SQLite" \
      org.opencontainers.image.source="https://github.com/marciopaulanti/transparenciapolicita"

WORKDIR /srv

# O código do servidor, o schema e o dataset exportado.
COPY server/ ./server/
COPY db/schema.sql ./db/schema.sql
COPY --from=assets /build/dataset.json ./db/data/dataset.json

# A casca do aplicativo. Só o que o navegador precisa: as folhas de estilo,
# os módulos e o ícone. As ferramentas de desenvolvimento (app/tools) não
# entram na imagem.
COPY index.html ./index.html
COPY app/css/ ./app/css/
COPY app/js/ ./app/js/
COPY app/favicon.svg ./app/favicon.svg

# O banco fica em volume: sobrevive a quem recria o contêiner.
ENV TP_HOST=0.0.0.0 \
    TP_PORT=8080 \
    TP_DATA_DIR=/srv/data \
    TP_DB_PATH=/srv/data/transparenciapolicita.sqlite \
    TP_SCHEMA=/srv/db/schema.sql \
    TP_DATASET=/srv/db/data/dataset.json \
    TP_BASE_PATH=/ \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN mkdir -p /srv/data && \
    useradd --system --uid 1001 --home /srv transparenciapolicita && \
    chown -R transparenciapolicita:transparenciapolicita /srv
USER transparenciapolicita

EXPOSE 8080

# O healthcheck bate na rota de saúde: ela responde 200 só com o banco em
# pé, então o Docker sabe quando o contêiner está realmente pronto.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=4).status == 200 else 1)"

CMD ["python3", "-m", "server.app"]
