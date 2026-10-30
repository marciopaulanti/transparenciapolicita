"""Serviço de arquivos estáticos com lista de permissões.

O servidor publica apenas o que a aplicação precisa. O resto do repositório
(esquema do banco, código do servidor, artefatos de deploy, prints do site
de referência) fica fora: uma lista de permissões é mais segura do que uma
lista de bloqueio, porque um arquivo novo nasce bloqueado.
"""

import mimetypes
import posixpath
from pathlib import Path

from . import config

# Extensões servidas com o tipo correto. O resto cai em application/octet-stream.
TIPOS = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
}


def _tipo(caminho: Path) -> str:
    sufixo = caminho.suffix.lower()
    if sufixo in TIPOS:
        return TIPOS[sufixo]
    adivinhado, _ = mimetypes.guess_type(str(caminho))
    return adivinhado or 'application/octet-stream'


def resolver(caminho_url: str) -> Path | None:
    """Traduz uma URL em um caminho real, ou None se não for servido.

    Devolve None (e não um erro) para qualquer coisa fora da lista de
    permissões: o chamador responde 404.
    """
    # Remove query string e fragmento.
    limpo = caminho_url.split('?', 1)[0].split('#', 1)[0]

    if limpo in ('', '/'):
        limpo = '/index.html'

    # Normaliza e bloqueia travessia de diretório (".." em qualquer forma).
    normalizado = posixpath.normpath(limpo)
    if not normalizado.startswith('/'):
        normalizado = '/' + normalizado
    if '..' in normalizado.split('/'):
        return None

    partes = [parte for parte in normalizado.split('/') if parte]
    if not partes:
        return None

    topo = partes[0]
    if topo in config.PASTAS_PUBLICAS:
        relativo = Path(*partes)
    elif len(partes) == 1 and topo in config.ARQUIVOS_PUBLICOS:
        relativo = Path(topo)
    else:
        return None

    destino = (config.RAIZ / relativo).resolve()

    # Confere que o resultado continua dentro da raiz: resolve() já normaliza
    # "..", mas a checagem final fecha a porta com chave.
    try:
        destino.relative_to(config.RAIZ)
    except ValueError:
        return None

    if destino.is_dir():
        destino = destino / 'index.html'
    if not destino.is_file():
        return None

    return destino


def cabecalhos_arquivo(caminho: Path) -> dict:
    """Cabeçalhos de resposta para um arquivo estático.

    O aplicativo não tem etapa de build: não existe hash no nome do
    arquivo, então o nome é sempre o mesmo e o navegador não tem como
    saber que o conteúdo mudou.

    Sem hash no nome, `max-age` seria mentira — o navegador guardaria o
    arquivo por minutos e continuaria servindo a versão antiga depois de
    um deploy, sem nem perguntar ao servidor. `no-store` é a resposta
    honesta para módulos ES e folhas de estilo: o navegador não guarda
    nada, e cada visita traz o código que está no servidor agora.

    O HTML é a exceção: ele é pequeno e o servidor responde 304 quando o
    conteúdo não mudou, então `no-cache` (revalidar sempre) continua
    barato e correto.
    """
    if caminho.suffix == '.html':
        cache = 'no-cache'
    else:
        cache = 'no-store'
    return {
        'Content-Type': _tipo(caminho),
        'Cache-Control': cache,
        'Last-Modified': caminho.stat().st_mtime,
    }


def etag_de(conteudo: bytes) -> str:
    """Identificador de versão de um arquivo, derivado do conteúdo.

    Mais forte que a data de modificação: dois deploys no mesmo segundo não
    colidem, e o que importa é o conteúdo — exatamente o que vai pela
    rede, já com o prefixo de publicação resolvido no index.
    """
    import hashlib

    resumo = hashlib.sha256(conteudo).hexdigest()[:16]
    return f'"{resumo}"'


def ler_index() -> bytes:
    """Lê o index.html substituindo o placeholder da base de publicação.

    É o que permite publicar o mesmo código na raiz de um domínio ou em um
    subdiretório sem etapa de build: o servidor escreve o prefixo certo no
    index na hora de servir.
    """
    caminho = config.RAIZ / 'index.html'
    bruto = caminho.read_bytes()
    if b'{{BASE}}' not in bruto:
        return bruto
    return bruto.replace(b'{{BASE}}', config.BASE_PATH.encode('utf-8'))
