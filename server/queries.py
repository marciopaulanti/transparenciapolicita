"""Camada de leitura: transforma linhas do banco nas formas que a interface usa.

A API devolve objetos aninhados (a mesma forma do `fixtures.js`), mesmo
com o banco normalizado. Assim o front-end não sabe se os dados vieram do
SQLite ou do arquivo embutido — a troca é invisível para as telas.
"""

import sqlite3

from . import config

# Ordem canônica dos cargos, para os filtros aparecerem sempre na mesma
# sequência. Não é hierarquia de mérito: é ordem de exibição.
ORDEM_CARGOS = {
    'prefeito': 1,
    'vereador': 2,
    'deputado_estadual': 3,
    'deputado_federal': 4,
    'senador': 5,
}

# Rótulo genérico de cada cargo, sem gênero. O rótulo exato ("Prefeita",
# "Senador") fica em `pessoas.cargo_rotulo`.
NOME_GENERICO = {
    'prefeito': 'Prefeito',
    'vereador': 'Vereador',
    'deputado_estadual': 'Deputado estadual',
    'deputado_federal': 'Deputado federal',
    'senador': 'Senador',
}


# --------------------------------------------------------------- utilidades --

def _lista(linhas):
    return [dict(linha) for linha in linhas]


def _por_chave(linhas, chave='pessoa_id'):
    saida = {}
    for linha in linhas:
        saida.setdefault(linha[chave], []).append(dict(linha))
    return saida


def _sem_acento(texto: str) -> str:
    """Normaliza para busca tolerante a acento, como o front-end faz."""
    import unicodedata

    return ''.join(
        caractere
        for caractere in unicodedata.normalize('NFD', (texto or '').lower())
        if unicodedata.category(caractere) != 'Mn'
    )


# ------------------------------------------------------------- montagem base --

def _carregar_contexto(conexao: sqlite3.Connection) -> dict:
    """Carrega tudo o que a montagem de uma pessoa precisa, em poucas consultas."""
    ctx = {
        'municipios': {
            linha['ibge']: linha['nome']
            for linha in conexao.execute('SELECT ibge, nome FROM municipios')
        },
        'pleitos': _por_chave(conexao.execute('SELECT * FROM pleitos ORDER BY ano, turno')),
        'votacoes': {
            linha['pessoa_id']: dict(linha)
            for linha in conexao.execute('SELECT * FROM votacoes')
        },
        'historico': _por_chave(
            conexao.execute('SELECT * FROM votacoes_historicas ORDER BY ano DESC')
        ),
        'presencas': {
            linha['pessoa_id']: dict(linha)
            for linha in conexao.execute('SELECT * FROM presencas')
        },
        'patrimonios': {
            linha['pessoa_id']: dict(linha)
            for linha in conexao.execute('SELECT * FROM patrimonios')
        },
        'cotas': {
            linha['pessoa_id']: dict(linha)
            for linha in conexao.execute('SELECT * FROM cotas')
        },
        'propostas': _por_chave(
            conexao.execute(
                """
                SELECT pr.*, f.nome AS fonte_nome
                FROM propostas pr
                LEFT JOIN fontes f ON f.id = pr.fonte_id
                ORDER BY pr.ano DESC
                """
            )
        ),
        'emendas': _por_chave(conexao.execute('SELECT * FROM emendas ORDER BY ano DESC')),
        'comissoes': _por_chave(
            conexao.execute(
                """
                SELECT pc.pessoa_id, c.nome, pc.ordem
                FROM pessoa_comissao pc
                JOIN comissoes c ON c.id = pc.comissao_id
                ORDER BY pc.pessoa_id, pc.ordem
                """
            )
        ),
        'cota_itens': _por_chave(
            conexao.execute('SELECT * FROM cota_itens ORDER BY pessoa_id, ordem')
        ),
        'campanhas': _por_chave(conexao.execute('SELECT * FROM campanhas ORDER BY ano DESC')),
        'doadores': _por_chave(conexao.execute('SELECT * FROM doadores'), chave='campanha_id'),
        'lacunas': {},
    }

    for linha in conexao.execute('SELECT pessoa_id, bloco, motivo FROM lacunas'):
        ctx['lacunas'].setdefault(linha['pessoa_id'], {})[linha['bloco']] = linha['motivo']

    return ctx


def _montar_pessoa(row: sqlite3.Row, ctx: dict) -> dict:
    """Reassembla a pessoa no formato aninhado que as telas esperam."""
    pessoa_id = row['id']
    lacunas = ctx['lacunas'].get(pessoa_id, {})

    mandato = {'inicio': row['mandato_inicio'], 'fim': row['mandato_fim']}

    pleitos = ctx['pleitos'].get(pessoa_id, [])
    ultimo_pleito = None
    if pleitos:
        ultimo = pleitos[-1]
        ultimo_pleito = {
            'ano': ultimo['ano'],
            'votos': ultimo['votos'],
            'percentual': ultimo['percentual'],
            'cargo': ultimo['cargo'],
            'turno': ultimo['turno'],
        }

    votacao = ctx['votacoes'].get(pessoa_id)
    votacao_forma = None
    if votacao:
        votacao_forma = {
            'sim': votacao['sim'],
            'nao': votacao['nao'],
            'abstencao': votacao['abstencao'],
            'ausente': votacao['ausente'],
            'licenca': votacao['licenca'],
        }

    presenca = ctx['presencas'].get(pessoa_id)
    presenca_forma = None
    if presenca:
        presenca_forma = {
            'sessoes': presenca['sessoes'],
            'compareceu': presenca['compareceu'],
            'justificadas': presenca['justificadas'],
        }

    patrimonio = ctx['patrimonios'].get(pessoa_id)
    patrimonio_forma = None
    if patrimonio:
        patrimonio_forma = {
            'valor': patrimonio['valor'],
            'ano': patrimonio['ano'],
            'anterior': patrimonio['anterior'],
        }

    cota = ctx['cotas'].get(pessoa_id)
    cota_forma = None
    if cota:
        cota_forma = {
            'valor': cota['valor'],
            'ano': cota['ano'],
            'itens': [
                {
                    'descricao': item['descricao'],
                    'valor': item['valor'],
                    'nota': item['nota'],
                    'fornecedor': item['fornecedor'],
                }
                for item in ctx['cota_itens'].get(pessoa_id, [])
            ],
        }

    propostas = [
        {
            'titulo': proposta['titulo'],
            'tipo': proposta['tipo'],
            'ano': proposta['ano'],
            'status': proposta['status'],
            'fonte': proposta['fonte_nome'],
        }
        for proposta in ctx['propostas'].get(pessoa_id, [])
    ]

    emendas = [
        {
            'ano': emenda['ano'],
            'valor': emenda['valor'],
            'destino': emenda['destino'],
            'area': emenda['area'],
            'descricao': emenda['descricao'],
        }
        for emenda in ctx['emendas'].get(pessoa_id, [])
    ]

    comissoes = [item['nome'] for item in ctx['comissoes'].get(pessoa_id, [])]

    campanhas = ctx['campanhas'].get(pessoa_id, [])
    campanha = None
    if campanhas:
        atual = campanhas[0]
        campanha = {
            'ano': atual['ano'],
            'arrecadado': atual['arrecadado'],
            'gasto': atual['gasto'],
            'doadores': [
                {'nome': doador['nome'], 'valor': doador['valor']}
                for doador in ctx['doadores'].get(atual['id'], [])
            ],
        }

    pessoa = {
        'id': pessoa_id,
        'nome': row['nome'],
        'cargo': row['cargo_rotulo'],
        'cargoTipo': row['cargo_id'],
        'esfera': row['esfera'],
        'uf': row['uf'],
        'municipio': ctx['municipios'].get(row['municipio_ibge']),
        'partido': row['partido_sigla'],
        'situacao': row['situacao'],
        'titular': bool(row['titular']),
        'mandato': mandato,
        'ultimoPleito': ultimo_pleito,
        'votacao': votacao_forma,
        'presenca': presenca_forma,
        'patrimonio': patrimonio_forma,
        'cota': cota_forma,
        'propostas': propostas,
        'emendas': emendas,
        'comissoes': comissoes,
        'campanha': campanha,
    }

    # O motivo da lacuna viaja junto do bloco ausente. Sem ele, a interface
    # mostraria um travessão sem explicação.
    for bloco, campo in (('presenca', 'presencaMotivo'), ('patrimonio', 'patrimonioMotivo'), ('cota', 'cotaMotivo')):
        if pessoa[bloco] is None and bloco in lacunas:
            pessoa[campo] = lacunas[bloco]

    return pessoa


# ------------------------------------------------------------------ leitura --

def listar_pessoas(conexao: sqlite3.Connection, filtros: dict | None = None) -> list:
    """Lista pessoas com os filtros do diretório: cargo, uf, partido, município, letra."""
    filtros = filtros or {}
    onde = []
    parametros = []

    if filtros.get('cargo'):
        onde.append('p.cargo_id = ?')
        parametros.append(filtros['cargo'])
    if filtros.get('uf'):
        onde.append('p.uf = ?')
        parametros.append(filtros['uf'].upper())
    if filtros.get('partido'):
        onde.append('p.partido_sigla = ?')
        parametros.append(filtros['partido'].upper())
    if filtros.get('municipio'):
        onde.append('m.nome = ?')
        parametros.append(filtros['municipio'])
    if filtros.get('letra'):
        onde.append('UPPER(SUBSTR(p.nome, 1, 1)) = ?')
        parametros.append(filtros['letra'].upper())

    clausula = f"WHERE {' AND '.join(onde)}" if onde else ''

    linhas = conexao.execute(
        f"""
        SELECT p.*, m.nome AS municipio_nome
        FROM pessoas p
        LEFT JOIN municipios m ON m.ibge = p.municipio_ibge
        {clausula}
        ORDER BY p.nome
        """,
        parametros,
    ).fetchall()

    ctx = _carregar_contexto(conexao)
    pessoas = [_montar_pessoa(linha, ctx) for linha in linhas]

    if filtros.get('q'):
        termo = _sem_acento(filtros['q'])
        pessoas = [
            pessoa
            for pessoa in pessoas
            if termo in _sem_acento(pessoa['nome'])
            or termo in _sem_acento(pessoa['cargo'])
            or termo in _sem_acento(pessoa.get('municipio') or '')
        ]

    return pessoas


def obter_pessoa(conexao: sqlite3.Connection, pessoa_id: str) -> dict | None:
    linha = conexao.execute(
        """
        SELECT p.*, m.nome AS municipio_nome
        FROM pessoas p
        LEFT JOIN municipios m ON m.ibge = p.municipio_ibge
        WHERE p.id = ?
        """,
        (pessoa_id,),
    ).fetchone()
    if linha is None:
        return None
    ctx = _carregar_contexto(conexao)
    return _montar_pessoa(linha, ctx)


def bootstrap(conexao: sqlite3.Connection) -> dict:
    """Pacote completo que o front-end pede no boot.

    O dataset é pequeno (dezenas de registros), então o ganho de paginar é
    nulo e o custo de uma requisição é melhor que o de dez.
    """
    projeto = conexao.execute('SELECT * FROM projeto WHERE id = 1').fetchone()
    regioes = {
        linha['id']: linha['nome'] for linha in conexao.execute('SELECT * FROM regioes')
    }
    partidos = _lista(conexao.execute('SELECT sigla, nome FROM partidos ORDER BY ordem, sigla'))
    camadas = _lista(
        conexao.execute('SELECT id, nome, unidade, descricao FROM camadas ORDER BY ordem, id')
    )
    cidades = _lista(conexao.execute('SELECT nome, uf, ibge FROM municipios ORDER BY ordem, nome'))

    estados = {}
    for linha in conexao.execute('SELECT * FROM estados ORDER BY sigla'):
        estados[linha['sigla']] = {
            'nome': linha['nome'],
            'regiao': linha['regiao_id'],
            'lema': linha['lema'],
            'bancada': [],
        }
    for linha in conexao.execute('SELECT * FROM bancadas ORDER BY estado_sigla, ordem, id'):
        if linha['estado_sigla'] in estados:
            estados[linha['estado_sigla']]['bancada'].append(
                {
                    'nome': linha['nome'],
                    'cargo': linha['cargo'],
                    'partido': linha['partido_sigla'],
                    'titular': bool(linha['titular']),
                }
            )

    ctx = _carregar_contexto(conexao)
    pessoas = []
    for linha in conexao.execute(
        """
        SELECT p.*, m.nome AS municipio_nome
        FROM pessoas p
        LEFT JOIN municipios m ON m.ibge = p.municipio_ibge
        ORDER BY p.nome
        """
    ):
        pessoas.append(_montar_pessoa(linha, ctx))

    # Valores das camadas temáticas: um estado sem dado continua sem dado.
    valores = {}
    for linha in conexao.execute('SELECT * FROM estado_camada'):
        valores.setdefault(linha['camada_id'], {})[linha['estado_sigla']] = {
            'valor': linha['valor'],
            'semDado': bool(linha['sem_dado']),
        }

    # Série histórica de votação.
    historico = {}
    for pessoa_id, linhas in ctx['historico'].items():
        historico[pessoa_id] = [
            {
                'ano': linha['ano'],
                'sim': linha['sim'],
                'nao': linha['nao'],
                'abstencao': linha['abstencao'],
                'ausente': linha['ausente'],
                'licenca': linha['licenca'],
            }
            for linha in linhas
        ]

    return {
        'projeto': {
            'nome': projeto['nome'],
            'tagline': projeto['tagline'],
            'fontePadrao': projeto['fonte_padrao'],
            'atualizadoEm': projeto['atualizado_em'],
            'aviso': projeto['aviso'],
        },
        'regioes': regioes,
        'partidos': partidos,
        'camadas': camadas,
        'cidades': cidades,
        'estados': estados,
        'pessoas': pessoas,
        'camadaValores': valores,
        'historico': historico,
    }


def comparar(conexao: sqlite3.Connection, identificadores: list[str]) -> list:
    """Duas a cinco pessoas, na ordem pedida. Sem nota, sem ranking, sem ordem."""
    if not identificadores:
        return []
    marcadores = ','.join('?' for _ in identificadores)
    linhas = conexao.execute(
        f"""
        SELECT p.*, m.nome AS municipio_nome
        FROM pessoas p
        LEFT JOIN municipios m ON m.ibge = p.municipio_ibge
        WHERE p.id IN ({marcadores})
        """,
        identificadores,
    ).fetchall()
    ctx = _carregar_contexto(conexao)
    por_id = {linha['id']: _montar_pessoa(linha, ctx) for linha in linhas}
    return [por_id[identificador] for identificador in identificadores if identificador in por_id]


def buscar(conexao: sqlite3.Connection, termo: str) -> dict:
    """Busca tolerante a acento, agrupada por tipo."""
    limpo = _sem_acento(termo)
    if not limpo:
        return {'pessoas': [], 'cidades': [], 'estados': []}

    pessoas = [
        pessoa
        for pessoa in listar_pessoas(conexao, {'q': termo})
    ][:6]

    cidades = [
        dict(linha)
        for linha in conexao.execute('SELECT nome, uf, ibge FROM municipios ORDER BY nome')
        if limpo in _sem_acento(linha['nome'])
    ][:5]

    estados = [
        dict(linha)
        for linha in conexao.execute('SELECT sigla, nome FROM estados ORDER BY nome')
        if limpo in _sem_acento(linha['nome']) or _sem_acento(linha['sigla']) == limpo
    ][:5]

    return {'pessoas': pessoas, 'cidades': cidades, 'estados': estados}


def estatisticas(conexao: sqlite3.Connection) -> dict:
    """Números agregados do acervo — contagens, nunca juízo."""
    def contagem(sql, parametros=()):
        return conexao.execute(sql, parametros).fetchone()[0]

    return {
        'pessoas': contagem('SELECT COUNT(*) FROM pessoas'),
        'partidos': contagem('SELECT COUNT(*) FROM partidos'),
        'estados': contagem('SELECT COUNT(*) FROM estados'),
        'municipios': contagem('SELECT COUNT(*) FROM municipios'),
        'propostas': contagem('SELECT COUNT(*) FROM propostas'),
        'emendas': contagem('SELECT COUNT(*) FROM emendas'),
        'comissoes': contagem('SELECT COUNT(*) FROM comissoes'),
        'por_cargo': _lista(
            conexao.execute(
                """
                SELECT c.id AS cargo, c.nome_generico AS nome, COUNT(p.id) AS total
                FROM cargos c
                LEFT JOIN pessoas p ON p.cargo_id = c.id
                GROUP BY c.id
                ORDER BY c.ordem
                """
            )
        ),
    }
