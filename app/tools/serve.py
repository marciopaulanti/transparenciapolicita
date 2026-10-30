#!/usr/bin/env python3
"""Servidor estático local para o protótipo.

Uso:
    python3 app/tools/serve.py [porta]

Sonda a porta antes de subir, para não derrubar um servidor que já está
rodando, e envia `Cache-Control: no-store` para que o navegador sempre
carregue a versão mais recente dos módulos ES durante o desenvolvimento.
"""

from __future__ import annotations

import functools
import http.server
import os
import socket
import socketserver
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORTA_PADRAO = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    """Envia os arquivos do repositório sem cache."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # noqa: A002
        if "404" in (fmt % args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def porta_livre(porta: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", porta))
        except OSError:
            return False
    return True


def main() -> None:
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else PORTA_PADRAO
    if not porta_livre(porta):
        print(f"Já existe um servidor na porta {porta}. Use outra porta.")
        sys.exit(1)

    handler = functools.partial(Handler, directory=RAIZ)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", porta), handler) as httpd:
        print(f"Protótipo em http://localhost:{porta}  (raiz: {RAIZ})")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
