"""Rotas da API.

Contrato enxuto: JSON de entrada, JSON de saída, erro com `erro` e `detalhe`.
Sem autenticação, porque o protótipo não tem conta — as duas rotas de escrita
(monitoramento e sugestão) são públicas e deliberadamente anônimas.
"""

import re
import sqlite3

from . import db, queries


# ------------------------------------------------------------- utilitários --

def _erro(mensagem: str, detalhe: str | None = None, status: int = 400) -> tuple:
    corpo = {'erro': mensagem}
    if detalhe:
        corpo['detalhe'] = detalhe
    return status, corpo


def _int(valor, padrao, minimo=None, maximo=None):
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        return padrao
    if minimo is not None:
        numero = max(minimo, numero)
    if maximo is not None:
        numero = min(maximo, numero)
    return numero


# ------------------------------------------------------------------ rotas --

def health(conexao, consulta, corpo, params):
    pronto = db.banco_pronto()
    total = 0
    if pronto:
        with db.sessao() as leitura:
            total = leitura.execute('SELECT COUNT(*) FROM pessoas').fetchone()[0]
    return 200, {
        'status': 'ok' if pronto else 'sem-banco',
        'banco': pronto,
        'pessoas': total,
        'versao': '1.0.0',
    }


def bootstrap(conexao, consulta, corpo, params):
    if not db.banco_pronto():
        return _erro('Banco ainda não populado', 'Rode: python3 -m server.seed', 503)
    return 200, queries.bootstrap(conexao)


def estatisticas(conexao, consulta, corpo, params):
    return 200, queries.estatisticas(conexao)


def partidos(conexao, consulta, corpo, params):
    linhas = conexao.execute('SELECT sigla, nome FROM partidos ORDER BY ordem, sigla').fetchall()
    return 200, {'partidos': [dict(linha) for linha in linhas]}


def estados(conexao, consulta, corpo, params):
    linhas = conexao.execute(
        """
        SELECT e.sigla, e.nome, e.lema, r.nome AS regiao
        FROM estados e
        LEFT JOIN regioes r ON r.id = e.regiao_id
        ORDER BY e.nome
        """
    ).fetchall()
    return 200, {'estados': [dict(linha) for linha in linhas]}


def cidades(conexao, consulta, corpo, params):
    if consulta.get('uf'):
        linhas = conexao.execute(
            'SELECT nome, uf, ibge FROM municipios WHERE uf = ? ORDER BY nome',
            (consulta['uf'].upper(),),
        ).fetchall()
    else:
        linhas = conexao.execute('SELECT nome, uf, ibge FROM municipios ORDER BY nome').fetchall()
    return 200, {'cidades': [dict(linha) for linha in linhas]}


def listar_pessoas(conexao, consulta, corpo, params):
    filtros = {
        'cargo': consulta.get('cargo'),
        'uf': consulta.get('uf'),
        'partido': consulta.get('partido'),
        'municipio': consulta.get('municipio'),
        'letra': consulta.get('letra'),
        'q': consulta.get('q'),
    }
    filtros = {chave: valor for chave, valor in filtros.items() if valor}
    pessoas = queries.listar_pessoas(conexao, filtros)
    return 200, {'pessoas': pessoas, 'total': len(pessoas)}


def obter_pessoa(conexao, consulta, corpo, params):
    pessoa = queries.obter_pessoa(conexao, params['id'])
    if pessoa is None:
        return _erro('Pessoa não encontrada', f"id={params['id']}", 404)
    return 200, pessoa


def comparar(conexao, consulta, corpo, params):
    brutos = (consulta.get('p') or '').split(',')
    identificadores = [bruto.strip() for bruto in brutos if bruto.strip()][:5]
    if not identificadores:
        return _erro('Informe ao menos um identificador', 'ex.: ?p=marina-caldeira,otavio-bezerra', 400)
    return 200, {'pessoas': queries.comparar(conexao, identificadores)}


def busca(conexao, consulta, corpo, params):
    termo = (consulta.get('q') or '').strip()
    if not termo:
        return 200, {'pessoas': [], 'cidades': [], 'estados': []}
    return 200, queries.buscar(conexao, termo)


def criar_monitoramento(conexao, consulta, corpo, params):
    """Pedido de monitoramento. Sem senha e sem login, como o original."""
    if not isinstance(corpo, dict):
        return _erro('Corpo inválido', 'esperado um objeto JSON', 400)

    pessoa_id = (corpo.get('pessoaId') or '').strip() or None
    nome = (corpo.get('nome') or '').strip() or None
    email = (corpo.get('email') or '').strip() or None
    telefone = (corpo.get('telefone') or '').strip() or None
    canal = (corpo.get('canal') or '').strip() or None
    mensagem = (corpo.get('mensagem') or '').strip() or None

    if not any((nome, email, telefone)):
        return _erro('Informe ao menos um meio de contato', 'nome, email ou telefone', 400)

    if pessoa_id:
        existe = conexao.execute('SELECT 1 FROM pessoas WHERE id = ?', (pessoa_id,)).fetchone()
        if not existe:
            return _erro('Pessoa não encontrada', f"id={pessoa_id}", 404)

    conexao.execute(
        """
        INSERT INTO monitoramentos (pessoa_id, nome, email, telefone, canal, mensagem, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (pessoa_id, nome, email, telefone, canal, mensagem, db.agora()),
    )
    conexao.commit()
    return 201, {'ok': True, 'recebido': True}


def criar_sugestao(conexao, consulta, corpo, params):
    """Sugestão ou relato de erro."""
    if not isinstance(corpo, dict):
        return _erro('Corpo inválido', 'esperado um objeto JSON', 400)

    contexto = (corpo.get('contexto') or '').strip() or None
    tipo = (corpo.get('tipo') or '').strip() or None
    mensagem = (corpo.get('mensagem') or '').strip() or None
    email = (corpo.get('email') or '').strip() or None

    if not mensagem:
        return _erro('Descreva o que aconteceu', 'o campo mensagem é obrigatório', 400)

    conexao.execute(
        """
        INSERT INTO sugestoes (contexto, tipo, mensagem, email, criado_em)
        VALUES (?, ?, ?, ?, ?)
        """,
        (contexto, tipo, mensagem, email, db.agora()),
    )
    conexao.commit()
    return 201, {'ok': True, 'recebido': True}


# ------------------------------------------------------------------ tabela --

# (método, padrão de caminho, handler, exige banco)
ROTEAS = [
    ('GET', r'^/api/health$', health, False),
    ('GET', r'^/api/bootstrap$', bootstrap, True),
    ('GET', r'^/api/estatisticas$', estatisticas, True),
    ('GET', r'^/api/partidos$', partidos, True),
    ('GET', r'^/api/estados$', estados, True),
    ('GET', r'^/api/cidades$', cidades, True),
    ('GET', r'^/api/pessoas$', listar_pessoas, True),
    ('GET', r'^/api/pessoas/(?P<id>[^/]+)$', obter_pessoa, True),
    ('GET', r'^/api/comparar$', comparar, True),
    ('GET', r'^/api/busca$', busca, True),
    ('POST', r'^/api/monitoramentos$', criar_monitoramento, True),
    ('POST', r'^/api/sugestoes$', criar_sugestao, True),
]

ROTEAS_COMPIADAS = [
    (metodo, re.compile(padrao), handler, exige)
    for metodo, padrao, handler, exige in ROTEAS
]


def resolver(metodo: str, caminho: str):
    """Devolve (handler, params) ou None. O primeiro padrão que casa vence."""
    for metodo_rota, padrao, handler, _exige in ROTEAS_COMPIADAS:
        if metodo_rota != metodo:
            continue
        achado = padrao.match(caminho)
        if achado:
            return handler, achado.groupdict()
    return None, None
