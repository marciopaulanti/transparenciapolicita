"""Configuração do servidor — tudo por variável de ambiente.

Nenhuma configuração é fixa no código: o mesmo pacote roda em desenvolvimento
(com o servidor de arquivos estáticos) e na VPS (atrás do Caddy) sem mudar
uma linha.
"""

import os
from pathlib import Path

# Raiz do repositório: server/config.py -> server/ -> raiz
RAIZ = Path(__file__).resolve().parent.parent


def _normalizar_base(valor: str) -> str:
    """Normaliza o prefixo de publicação: sempre começa e termina com '/'.

    '/' significa "na raiz do domínio". '/transparencia/' significa que o
    app é servido em um subdiretório.
    """
    limpio = (valor or '/').strip()
    if not limpio or limpio == '/':
        return '/'
    if not limpio.startswith('/'):
        limpio = '/' + limpio
    if not limpio.endswith('/'):
        limpio += '/'
    return limpio


# --- rede -------------------------------------------------------------------
HOST = os.environ.get('TP_HOST', '0.0.0.0')
PORTA = int(os.environ.get('TP_PORT', '8080'))

# --- publicação -------------------------------------------------------------
# Onde o app está publicado. Na raiz do domínio próprio é '/'. Em um
# subdiretório (exemplo.com/transparenciapolicita/) é o caminho com barra
# nas duas pontas.
#
# O servidor usa isso para servir o index com o prefixo certo, para reconhecer
# as próprias rotas de API sob o prefixo, e para o front-end saber onde
# procurar a API. Não há etapa de build: o index é escrito na hora.
BASE_PATH = _normalizar_base(os.environ.get('TP_BASE_PATH', '/'))

# --- dados ------------------------------------------------------------------
DIRETORIO_DADOS = Path(os.environ.get('TP_DATA_DIR', RAIZ / 'data'))
CAMINHO_BANCO = Path(os.environ.get('TP_DB_PATH', DIRETORIO_DADOS / 'transparenciapolicita.sqlite'))
CAMINHO_ESQUEMA = Path(os.environ.get('TP_SCHEMA', RAIZ / 'db' / 'schema.sql'))
CAMINHO_DATASET = Path(os.environ.get('TP_DATASET', RAIZ / 'db' / 'data' / 'dataset.json'))

# --- estático ---------------------------------------------------------------
# Só o que a aplicação precisa em produção. O resto do repositório (db/,
# server/, deploy/, replica/) não é servido: nada de expor o esquema do banco
# ou os prints do site de referência por acidente.
PASTAS_PUBLICAS = ('app',)
ARQUIVOS_PUBLICOS = ('index.html', 'favicon.ico')

# --- comportamento ----------------------------------------------------------
# Limite de corpo aceito nas escritas (monitoramento e sugestão). 32 KB é
# generoso para texto e pequeno o bastante para não ser um vetor.
TAMANHO_MAXIMO_CORPO = int(os.environ.get('TP_MAX_BODY', '32768'))

# Liga/desliga a trilha de auditoria (uma linha por requisição servida).
AUDITORIA = os.environ.get('TP_AUDITORIA', '1') not in ('0', 'false', 'nao', 'não')

# Cabeçalhos de segurança aplicados a toda resposta.
CABECALHOS_SEGURANCA = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': (
        "default-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self'; "
        "base-uri 'none'; "
        "form-action 'self'; "
        "frame-ancestors 'none'"
    ),
}


def resumo() -> dict:
    """Resumo não sensível, para /api/health e para o log de partida."""
    return {
        'host': HOST,
        'porta': PORTA,
        'banco': str(CAMINHO_BANCO),
        'schema': str(CAMINHO_ESQUEMA),
        'dataset': str(CAMINHO_DATASET),
        'pausas_publicas': list(PASTAS_PUBLICAS),
    }
