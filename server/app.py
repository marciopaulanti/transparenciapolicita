"""Ponto de entrada do servidor.

Roda a casca do aplicativo (arquivos estáticos) e a API JSON na mesma porta.
Uma porta só é mais simples de operar atrás do Caddy e evita CORS — a mesma
origem serve o HTML e os dados.
"""

import json
import socket
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import api, config, db, queries, static

INICIO = None


class Manipulador(BaseHTTPRequestHandler):
    server_version = 'TransparenciaPolitica/1.0'
    sys_version = ''

    # ------------------------------------------------------------- saída --

    def _enviar_json(self, status: int, dados) -> None:
        corpo = json.dumps(dados, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        for nome, valor in config.CABECALHOS_SEGURANCA.items():
            self.send_header(nome, valor)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(corpo)

    def _enviar_arquivo(self, caminho: Path) -> None:
        # O index recebe o placeholder da base de publicação resolvido: o
        # front-end descobre assim onde está a API.
        if caminho.name == 'index.html':
            dados = static.ler_index()
        else:
            dados = caminho.read_bytes()

        cabecalhos = static.cabecalhos_arquivo(caminho)
        etag = static.etag_de(dados)

        # Requisição condicional: se o navegador já tem esta versão, a
        # resposta é 304 e nenhum byte de conteúdo volta pela rede.
        if self._mesma_versao(caminho, etag):
            self.send_response(304)
            self.send_header('ETag', etag)
            self.send_header('Cache-Control', cabecalhos['Cache-Control'])
            self.send_header('Last-Modified', cabecalhos['Last-Modified'])
            self.end_headers()
            return

        self.send_response(200)
        for nome, valor in cabecalhos.items():
            self.send_header(nome, str(valor))
        self.send_header('ETag', etag)
        for nome, valor in config.CABECALHOS_SEGURANCA.items():
            self.send_header(nome, valor)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(dados)

    def _mesma_versao(self, caminho: Path, etag: str) -> bool:
        """Diz se o cliente já tem esta versão do arquivo."""
        if_none_match = self.headers.get('If-None-Match')
        if if_none_match:
            candidatos = [p.strip() for p in if_none_match.split(',')]
            return etag in candidatos or '*' in candidatos

        if_modified_since = self.headers.get('If-Modified-Since')
        if if_modified_since:
            from email.utils import parsedate_to_datetime

            try:
                desde = parsedate_to_datetime(if_modified_since)
                return desde.timestamp() >= int(caminho.stat().st_mtime)
            except (TypeError, ValueError):
                return False
        return False

    def _erro(self, mensagem: str, detalhe: str | None = None, status: int = 400) -> None:
        """Erro em JSON. Mesma convenção da API: mensagem, detalhe, status."""
        corpo = {'erro': mensagem}
        if detalhe:
            corpo['detalhe'] = detalhe
        self._enviar_json(status, corpo)

    # -------------------------------------------------------------- verbs --

    def do_GET(self):
        self._atender('GET')

    def do_HEAD(self):
        self._atender('HEAD')

    def do_POST(self):
        self._atender('POST')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Allow', 'GET, HEAD, POST, OPTIONS')
        self.end_headers()

    # ---------------------------------------------------------- despacho --

    def _atender(self, metodo: str) -> None:
        partes = urllib.parse.urlsplit(self.path)
        caminho = partes.path
        consulta = {
            chave: valores[0]
            for chave, valores in urllib.parse.parse_qs(partes.query).items()
        }

        # Sob o prefixo de publicação, o próprio servidor tira o prefixo: a
        # API e os arquivos são servidos como se estivessem na raiz. Assim o
        # app funciona igual na raiz do domínio e em um subdiretório, sem
        # depender de configuração do proxy na frente.
        caminho = self._tirar_prefixo(caminho)

        # A API responde JSON; o resto é arquivo estático.
        if caminho.startswith('/api'):
            self._atender_api(metodo, caminho, consulta)
            return

        if metodo not in ('GET', 'HEAD'):
            self._erro('Método não permitido', status=405)
            return

        destino = static.resolver(caminho)
        if destino is None:
            self._erro('Não encontrado', status=404)
            return
        self._enviar_arquivo(destino)

    def _tirar_prefixo(self, caminho: str) -> str:
        """Remove o prefixo de publicação do caminho."""
        base = config.BASE_PATH
        if base == '/':
            return caminho
        if caminho == base.rstrip('/'):
            return '/'
        if caminho.startswith(base):
            return '/' + caminho[len(base):]
        return caminho

    def _atender_api(self, metodo: str, caminho: str, consulta: dict) -> None:
        handler, params = api.resolver(metodo, caminho)
        if handler is None:
            # Uma rota de API que existe com outro método merece 405, não 404.
            outro, _ = api.resolver('GET' if metodo == 'POST' else 'POST', caminho)
            if outro is not None:
                self._erro('Método não permitido', status=405)
            else:
                self._erro('Rota de API inexistente', status=404)
            return

        corpo = None
        if metodo == 'POST':
            corpo = self._ler_corpo()
            if corpo is None:
                return

        try:
            with db.sessao() as conexao:
                status, dados = handler(conexao, consulta, corpo, params)
                db.registrar_auditoria(conexao, caminho, metodo, status)
        except Exception as erro:  # noqa: BLE001 — a API não derruba o servidor
            self._erro('Erro interno', str(erro), 500)
            return

        self._enviar_json(status, dados)

    def _ler_corpo(self):
        """Lê o corpo JSON com limite de tamanho. Devolve None se já respondeu."""
        try:
            tamanho = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            self._erro('Content-Length inválido', status=400)
            return None

        if tamanho > config.TAMANHO_MAXIMO_CORPO:
            self._erro('Corpo grande demais', f'máximo {config.TAMANHO_MAXIMO_CORPO} bytes', 413)
            return None

        if tamanho == 0:
            self._erro('Corpo vazio', status=400)
            return None

        bruto = self.rfile.read(tamanho)
        try:
            return json.loads(bruto.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._erro('JSON inválido', status=400)
            return None

    # -------------------------------------------------------------- log --

    def log_message(self, formato, *args):
        # Uma linha por requisição, no formato do systemd (journald).
        sys.stderr.write(
            '%s - %s\n' % (self.address_string(), formato % args)
        )


def main() -> None:
    global INICIO
    import time

    INICIO = time.time()

    if not db.banco_pronto():
        print(
            '[aviso] Banco ausente ou incompleto. Populando a partir do dataset...',
            file=sys.stderr,
        )
        from .seed import garantir_banco

        if garantir_banco():
            print('Banco criado e populado.', file=sys.stderr)
        else:
            print(
                '[aviso] Nao foi possivel popular o banco. As rotas de dados '
                'vao responder 503 ate rodar: python3 -m server.seed',
                file=sys.stderr,
            )

    ThreadingHTTPServer.allow_reuse_address = True
    servidor = ThreadingHTTPServer((config.HOST, config.PORTA), Manipulador)
    servidor.daemon_threads = True

    resumo = config.resumo()
    print(
        f'Transparência Política em http://{config.HOST}:{config.PORTA} '
        f'(banco: {resumo["banco"]})',
        file=sys.stderr,
        flush=True,
    )

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('Encerrando.', file=sys.stderr)
    finally:
        servidor.server_close()


if __name__ == '__main__':
    main()
