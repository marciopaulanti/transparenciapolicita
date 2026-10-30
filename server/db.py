"""Acesso ao banco SQLite.

Uma conexão por requisição, com `row_factory` para devolver dicionários. O
modo WAL deixa a leitura não bloquear a escrita — importante porque a API
lê muito (o front-end puxa o dataset inteiro no boot) e ainda assim precisa
aceitar as escritas de monitoramento e sugestão.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from . import config


def conectar(caminho: Path | None = None) -> sqlite3.Connection:
    """Abre uma conexão já configurada (WAL, chaves estrangeiras, linhas como dict)."""
    destino = Path(caminho or config.CAMINHO_BANCO)
    destino.parent.mkdir(parents=True, exist_ok=True)
    conexao = sqlite3.connect(destino, timeout=10)
    conexao.row_factory = sqlite3.Row
    conexao.execute('PRAGMA foreign_keys = ON')
    conexao.execute('PRAGMA journal_mode = WAL')
    conexao.execute('PRAGMA synchronous = NORMAL')
    return conexao


@contextmanager
def sessao(caminho: Path | None = None):
    """Conexão como contexto: fecha ao final, mesmo em caso de erro."""
    conexao = conectar(caminho)
    try:
        yield conexao
    finally:
        conexao.close()


def aplicar_esquema(conexao: sqlite3.Connection) -> None:
    """Cria as tabelas. Idempotente: pode rodar em toda partida."""
    esquema = config.CAMINHO_ESQUEMA.read_text(encoding='utf-8')
    conexao.executescript(esquema)
    conexao.commit()


def banco_pronto(caminho: Path | None = None) -> bool:
    """Diz se o arquivo de banco existe e tem as tabelas essenciais."""
    destino = Path(caminho or config.CAMINHO_BANCO)
    if not destino.exists():
        return False
    try:
        with sessao(destino) as conexao:
            linhas = conexao.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        nomes = {linha['name'] for linha in linhas}
    except sqlite3.Error:
        return False
    return {'pessoas', 'partidos', 'estados', 'projeto'} <= nomes


def registrar_auditoria(conexao: sqlite3.Connection, rota: str, metodo: str, status: int) -> None:
    """Uma linha por requisição servida. Em caso de falha, não derruba a resposta."""
    if not config.AUDITORIA:
        return
    try:
        conexao.execute(
            'INSERT INTO auditoria (rota, metodo, status, criado_em) VALUES (?, ?, ?, ?)',
            (rota[:200], metodo, status, agora()),
        )
        conexao.commit()
    except sqlite3.Error:
        pass


def agora() -> str:
    """Timestamp ISO-8601 em UTC, com precisão de segundos."""
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
