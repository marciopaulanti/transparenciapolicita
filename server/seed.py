"""Popula o banco SQLite a partir do dataset exportado.

Uso:
    python3 -m server.seed              cria o banco se não existir
    python3 -m server.seed --reconstruir apaga e recria do zero
    python3 -m server.seed --verificar   confere o banco sem escrever

O seed é idempotente: rodar de novo não duplica nada, ele recria as tabelas
com os mesmos valores. É a garantia de que o que está no banco é exatamente
o que `fixtures.js` descreve — nem mais, nem menos.
"""

import argparse
import json
import sys
from pathlib import Path

from . import config, db

# Rótulo genérico de cada cargo canônico, e a esfera a que pertence.
CARGOS = {
    'prefeito': ('Prefeito', 'municipal', 1),
    'vereador': ('Vereador', 'municipal', 2),
    'deputado_estadual': ('Deputado estadual', 'estadual', 3),
    'deputado_federal': ('Deputado federal', 'federal', 4),
    'senador': ('Senador', 'federal', 5),
}

# Blocos que podem faltar, e o campo onde o motivo é guardado no `fixtures.js`.
BLOCOS_LACUNA = {
    'presenca': 'presencaMotivo',
    'patrimonio': 'patrimonioMotivo',
    'cota': 'cotaMotivo',
}


def _carregar_dataset() -> dict:
    caminho = Path(config.CAMINHO_DATASET)
    if not caminho.exists():
        raise SystemExit(
            f'Dataset não encontrado em {caminho}.\n'
            'Gere com: node app/tools/export-dataset.mjs'
        )
    return json.loads(caminho.read_text(encoding='utf-8'))


def _contar(conexao, tabela) -> int:
    return conexao.execute(f'SELECT COUNT(*) FROM {tabela}').fetchone()[0]


def semear(conexao, dataset: dict) -> dict:
    """Escreve o dataset inteiro no banco. Assume esquema já aplicado."""
    # ---------------------------------------------------------- metadados --
    projeto = dataset['projeto']
    conexao.execute(
        """
        INSERT OR REPLACE INTO projeto (id, nome, tagline, fonte_padrao, atualizado_em, aviso)
        VALUES (1, ?, ?, ?, ?, ?)
        """,
        (
            projeto.get('nome'),
            projeto.get('tagline'),
            projeto.get('fontePadrao'),
            projeto.get('atualizadoEm'),
            dataset.get('aviso'),
        ),
    )

    for identificador, nome in sorted(dataset['regioes'].items(), key=lambda par: int(par[0])):
        conexao.execute('INSERT OR REPLACE INTO regioes (id, nome) VALUES (?, ?)', (int(identificador), nome))

    for ordem, partido in enumerate(dataset['partidos'], start=1):
        conexao.execute(
            'INSERT OR REPLACE INTO partidos (sigla, nome, ordem) VALUES (?, ?, ?)',
            (partido['sigla'], partido['nome'], ordem),
        )

    for ordem, camada in enumerate(dataset['camadas'], start=1):
        conexao.execute(
            """
            INSERT OR REPLACE INTO camadas (id, nome, unidade, descricao, ordem)
            VALUES (?, ?, ?, ?, ?)
            """,
            (camada['id'], camada['nome'], camada['unidade'], camada['descricao'], ordem),
        )

    # ------------------------------------------------------------ estados --
    for sigla, estado in dataset['estados'].items():
        conexao.execute(
            'INSERT OR REPLACE INTO estados (sigla, nome, regiao_id, lema) VALUES (?, ?, ?, ?)',
            (sigla, estado['nome'], estado.get('regiao'), estado.get('lema')),
        )
        for ordem, membro in enumerate(estado.get('bancada', []), start=1):
            conexao.execute(
                """
                INSERT INTO bancadas (estado_sigla, nome, cargo, partido_sigla, titular, ordem)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    sigla,
                    membro['nome'],
                    membro.get('cargo'),
                    membro.get('partido'),
                    1 if membro.get('titular') else 0,
                    ordem,
                ),
            )

    # ---------------------------------------------------------- municipios --
    for ordem, cidade in enumerate(dataset['cidades'], start=1):
        conexao.execute(
            'INSERT OR REPLACE INTO municipios (ibge, nome, uf, ordem) VALUES (?, ?, ?, ?)',
            (cidade['ibge'], cidade['nome'], cidade['uf'], ordem),
        )

    # -------------------------------------------------------------- cargos --
    usados = {pessoa['cargoTipo'] for pessoa in dataset['pessoas']}
    for tipo, (nome, esfera, ordem) in CARGOS.items():
        if tipo in usados:
            conexao.execute(
                'INSERT OR REPLACE INTO cargos (id, nome_generico, esfera, ordem) VALUES (?, ?, ?, ?)',
                (tipo, nome, esfera, ordem),
            )

    # --------------------------------------------------------------- fontes --
    fontes = {}
    for pessoa in dataset['pessoas']:
        for proposta in pessoa.get('propostas', []):
            nome = proposta.get('fonte')
            if nome and nome not in fontes:
                conexao.execute('INSERT INTO fontes (nome) VALUES (?)', (nome,))
                fontes[nome] = conexao.execute('SELECT last_insert_rowid()').fetchone()[0]

    # ------------------------------------------------------------ comissões --
    comissoes = {}
    for pessoa in dataset['pessoas']:
        for comissao in pessoa.get('comissoes', []):
            if comissao not in comissoes:
                conexao.execute('INSERT OR IGNORE INTO comissoes (nome) VALUES (?)', (comissao,))
                comissoes[comissao] = conexao.execute(
                    'SELECT id FROM comissoes WHERE nome = ?', (comissao,)
                ).fetchone()[0]

    # -------------------------------------------------------------- pessoas --
    for pessoa in dataset['pessoas']:
        mandato = pessoa.get('mandato') or {}
        ibge = None
        for cidade in dataset['cidades']:
            if cidade['nome'] == pessoa.get('municipio') and cidade['uf'] == pessoa['uf']:
                ibge = cidade['ibge']
                break

        conexao.execute(
            """
            INSERT OR REPLACE INTO pessoas
                (id, nome, cargo_id, cargo_rotulo, esfera, uf, municipio_ibge,
                 partido_sigla, situacao, titular, mandato_inicio, mandato_fim)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pessoa['id'],
                pessoa['nome'],
                pessoa['cargoTipo'],
                pessoa['cargo'],
                pessoa['esfera'],
                pessoa['uf'],
                ibge,
                pessoa.get('partido'),
                pessoa.get('situacao'),
                1 if pessoa.get('titular') else 0,
                mandato.get('inicio'),
                mandato.get('fim'),
            ),
        )

        if mandato.get('inicio'):
            conexao.execute(
                'INSERT OR REPLACE INTO termos_mandato (pessoa_id, inicio, fim) VALUES (?, ?, ?)',
                (pessoa['id'], mandato['inicio'], mandato.get('fim')),
            )

        # Lacunas: valor ausente com o motivo, guardado no banco.
        for bloco, campo in BLOCOS_LACUNA.items():
            if pessoa.get(bloco) is None and pessoa.get(campo):
                conexao.execute(
                    'INSERT INTO lacunas (pessoa_id, bloco, motivo) VALUES (?, ?, ?)',
                    (pessoa['id'], bloco, pessoa[campo]),
                )

    # ------------------------------------------------------ blocos por pessoa --
    for pessoa in dataset['pessoas']:
        identidade = pessoa['id']

        pleito = pessoa.get('ultimoPleito')
        if pleito:
            conexao.execute(
                """
                INSERT INTO pleitos (pessoa_id, ano, cargo, turno, votos, percentual)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    identidade,
                    pleito.get('ano'),
                    pleito.get('cargo'),
                    pleito.get('turno'),
                    pleito.get('votos'),
                    pleito.get('percentual'),
                ),
            )

        votacao = pessoa.get('votacao')
        if votacao:
            conexao.execute(
                """
                INSERT OR REPLACE INTO votacoes (pessoa_id, sim, nao, abstencao, ausente, licenca)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    identidade,
                    votacao.get('sim'),
                    votacao.get('nao'),
                    votacao.get('abstencao'),
                    votacao.get('ausente'),
                    votacao.get('licenca'),
                ),
            )

        for linha in dataset['historico'].get(identidade, []):
            conexao.execute(
                """
                INSERT OR REPLACE INTO votacoes_historicas
                    (pessoa_id, ano, sim, nao, abstencao, ausente, licenca)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    identidade,
                    linha.get('ano'),
                    linha.get('sim'),
                    linha.get('nao'),
                    linha.get('abstencao'),
                    linha.get('ausente'),
                    linha.get('licenca'),
                ),
            )

        presenca = pessoa.get('presenca')
        if presenca:
            conexao.execute(
                """
                INSERT OR REPLACE INTO presencas (pessoa_id, sessoes, compareceu, justificadas)
                VALUES (?, ?, ?, ?)
                """,
                (identidade, presenca.get('sessoes'), presenca.get('compareceu'), presenca.get('justificadas')),
            )

        patrimonio = pessoa.get('patrimonio')
        if patrimonio:
            conexao.execute(
                """
                INSERT OR REPLACE INTO patrimonios (pessoa_id, valor, ano, anterior)
                VALUES (?, ?, ?, ?)
                """,
                (identidade, patrimonio.get('valor'), patrimonio.get('ano'), patrimonio.get('anterior')),
            )

        cota = pessoa.get('cota')
        if cota:
            conexao.execute(
                'INSERT OR REPLACE INTO cotas (pessoa_id, valor, ano) VALUES (?, ?, ?)',
                (identidade, cota.get('valor'), cota.get('ano')),
            )
            for ordem, item in enumerate(cota.get('itens', []), start=1):
                conexao.execute(
                    """
                    INSERT INTO cota_itens (pessoa_id, descricao, valor, nota, fornecedor, ordem)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        identidade,
                        item.get('descricao'),
                        item.get('valor'),
                        item.get('nota'),
                        item.get('fornecedor'),
                        ordem,
                    ),
                )

        for proposta in pessoa.get('propostas', []):
            conexao.execute(
                """
                INSERT INTO propostas (pessoa_id, titulo, tipo, ano, status, fonte_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    identidade,
                    proposta.get('titulo'),
                    proposta.get('tipo'),
                    proposta.get('ano'),
                    proposta.get('status'),
                    fontes.get(proposta.get('fonte')),
                ),
            )

        for emenda in pessoa.get('emendas', []):
            conexao.execute(
                """
                INSERT INTO emendas (pessoa_id, ano, valor, destino, area, descricao)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    identidade,
                    emenda.get('ano'),
                    emenda.get('valor'),
                    emenda.get('destino'),
                    emenda.get('area'),
                    emenda.get('descricao'),
                ),
            )

        for ordem, comissao in enumerate(pessoa.get('comissoes', []), start=1):
            conexao.execute(
                """
                INSERT OR IGNORE INTO pessoa_comissao (pessoa_id, comissao_id, ordem)
                VALUES (?, ?, ?)
                """,
                (identidade, comissoes[comissao], ordem),
            )

        campanha = pessoa.get('campanha')
        if campanha:
            cursor = conexao.execute(
                """
                INSERT INTO campanhas (pessoa_id, ano, arrecadado, gasto)
                VALUES (?, ?, ?, ?)
                """,
                (identidade, campanha.get('ano'), campanha.get('arrecadado'), campanha.get('gasto')),
            )
            campanha_id = cursor.lastrowid
            for doador in campanha.get('doadores', []):
                conexao.execute(
                    'INSERT INTO doadores (campanha_id, nome, valor) VALUES (?, ?, ?)',
                    (campanha_id, doador.get('nome'), doador.get('valor')),
                )

    # ------------------------------------------------- valores por camada --
    for camada_id, valores in dataset['camadaValores'].items():
        for sigla, entrada in valores.items():
            conexao.execute(
                """
                INSERT OR REPLACE INTO estado_camada (estado_sigla, camada_id, valor, sem_dado)
                VALUES (?, ?, ?, ?)
                """,
                (sigla, camada_id, entrada.get('valor'), 1 if entrada.get('semDado') else 0),
            )

    conexao.commit()


def reconstruir(destino: Path) -> None:
    """Apaga o banco e recria do zero."""
    for sufixo in ('', '-wal', '-shm', '-journal'):
        arquivo = Path(str(destino) + sufixo)
        if arquivo.exists():
            arquivo.unlink()


def garantir_banco(caminho: Path | None = None) -> bool:
    """Cria e popula o banco se ele ainda não existir.

    É o que permite rodar o contêiner com um comando só: na primeira
    partida o banco é criado a partir do dataset e, a partir daí, ele já
    existe. Devolve True se o banco está pronto ao final.
    """
    destino = Path(caminho or config.CAMINHO_BANCO)
    if db.banco_pronto(destino):
        return True

    try:
        dataset = _carregar_dataset()
    except SystemExit:
        # Sem dataset não dá para semear; o servidor sobe assim mesmo e
        # responde 503 nas rotas que dependem do banco.
        return False

    destino.parent.mkdir(parents=True, exist_ok=True)
    with db.sessao(destino) as conexao:
        db.aplicar_esquema(conexao)
        semear(conexao, dataset)
    return db.banco_pronto(destino)


def main() -> None:
    analisador = argparse.ArgumentParser(description='Popula o banco do Transparência Política')
    analisador.add_argument('--reconstruir', action='store_true', help='apaga o banco antes de semear')
    analisador.add_argument('--verificar', action='store_true', help='apenas confere o banco existente')
    argumentos = analisador.parse_args()

    destino = Path(config.CAMINHO_BANCO)

    if argumentos.verificar:
        if not db.banco_pronto(destino):
            raise SystemExit(f'Banco ausente ou incompleto em {destino}')
        with db.sessao(destino) as conexao:
            print(f'Banco em {destino}')
            for tabela in (
                'pessoas', 'partidos', 'estados', 'municipios', 'cargos',
                'propostas', 'emendas', 'comissoes', 'fontes', 'lacunas',
                'votacoes', 'votacoes_historicas', 'presencas', 'patrimonios',
                'bancadas', 'estado_camada',
            ):
                print(f'  {tabela:22} {_contar(conexao, tabela)}')
        return

    dataset = _carregar_dataset()

    if argumentos.reconstruir:
        reconstruir(destino)

    destino.parent.mkdir(parents=True, exist_ok=True)

    with db.sessao(destino) as conexao:
        db.aplicar_esquema(conexao)
        semear(conexao, dataset)

    with db.sessao(destino) as conexao:
        print(f'Banco pronto em {destino}')
        print(f'  pessoas {conexao.execute("SELECT COUNT(*) FROM pessoas").fetchone()[0]}')
        print(f'  partidos {conexao.execute("SELECT COUNT(*) FROM partidos").fetchone()[0]}')
        print(f'  estados  {conexao.execute("SELECT COUNT(*) FROM estados").fetchone()[0]}')
        print(f'  lacunas  {conexao.execute("SELECT COUNT(*) FROM lacunas").fetchone()[0]}')
        print(f'  camadas  {conexao.execute("SELECT COUNT(*) FROM estado_camada").fetchone()[0]}')


if __name__ == '__main__':
    main()
