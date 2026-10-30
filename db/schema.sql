-- ============================================================================
-- schema.sql — esquema do banco do Transparência Política
-- ---------------------------------------------------------------------------
-- SQLite: um arquivo, sem serviço para administer, backup trivial. É o que
-- cabe em uma VPS de 1 GB e o que roda em qualquer máquina sem instalação.
--
-- Duas regras do produto valem aqui, não só na interface:
--
--   1. Dado ausente é NULL *com motivo*. Nunca 0. A tabela `lacunas` guarda
--      o motivo de cada bloco que a fonte não publica; a API nunca inventa
--      número para preencher.
--
--   2. Nada aqui qualifica politicamente. Partido é identidade textual, em
--      tabela própria, sem cor e sem ordem de mérito. Não existe nota,
--      pontuação ou ranking em nenhuma tabela — e não deve ser criada.
--
-- Tudo neste banco é FICTÍCIO, exceto a geometria dos estados (que vive no
-- front-end, em br-map.js) e os nomes de estados, regiões e municípios.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------ metadados --

CREATE TABLE IF NOT EXISTS projeto (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  nome           TEXT NOT NULL,
  tagline        TEXT,
  fonte_padrao   TEXT,
  atualizado_em  TEXT,
  aviso          TEXT
);

CREATE TABLE IF NOT EXISTS regioes (
  id    INTEGER PRIMARY KEY,
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS partidos (
  sigla  TEXT PRIMARY KEY,
  nome   TEXT NOT NULL,
  ordem  INTEGER
);

CREATE TABLE IF NOT EXISTS camadas (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  unidade     TEXT,
  descricao   TEXT,
  ordem       INTEGER
);

CREATE TABLE IF NOT EXISTS estados (
  sigla      TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  regiao_id  INTEGER REFERENCES regioes(id),
  lema       TEXT
);

CREATE TABLE IF NOT EXISTS municipios (
  ibge  TEXT PRIMARY KEY,
  nome  TEXT NOT NULL,
  uf    TEXT NOT NULL REFERENCES estados(sigla),
  -- Ordem de exibição: a mesma que o front-end usa, para as duas vias
  -- mostrarem a mesma lista.
  ordem INTEGER NOT NULL DEFAULT 0
);

-- Cargo é uma entidade, não um texto livre: `id` é o tipo canônico
-- (prefeito, senador, deputado_federal...) e `nome_generico` é o rótulo sem
-- gênero. O rótulo exato que aparece na tela ("Prefeita", "Senador") fica em
-- `pessoas.cargo_rotulo`.
CREATE TABLE IF NOT EXISTS cargos (
  id             TEXT PRIMARY KEY,
  nome_generico  TEXT NOT NULL,
  esfera         TEXT NOT NULL,
  ordem          INTEGER
);

CREATE TABLE IF NOT EXISTS comissoes (
  id    INTEGER PRIMARY KEY,
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS fontes (
  id     INTEGER PRIMARY KEY,
  nome   TEXT NOT NULL,
  orgao  TEXT,
  url    TEXT
);

-- ------------------------------------------------------------- pessoas --

CREATE TABLE IF NOT EXISTS pessoas (
  id               TEXT PRIMARY KEY,
  nome             TEXT NOT NULL,
  cargo_id         TEXT NOT NULL REFERENCES cargos(id),
  cargo_rotulo     TEXT NOT NULL,
  esfera           TEXT NOT NULL,
  uf               TEXT NOT NULL REFERENCES estados(sigla),
  municipio_ibge   TEXT REFERENCES municipios(ibge),
  partido_sigla    TEXT REFERENCES partidos(sigla),
  situacao         TEXT,
  titular          INTEGER NOT NULL DEFAULT 0,
  mandato_inicio   TEXT,
  mandato_fim      TEXT
);

CREATE INDEX IF NOT EXISTS idx_pessoas_uf      ON pessoas(uf);
CREATE INDEX IF NOT EXISTS idx_pessoas_cargo   ON pessoas(cargo_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_partido ON pessoas(partido_sigla);
CREATE INDEX IF NOT EXISTS idx_pessoas_municipio ON pessoas(municipio_ibge);

CREATE TABLE IF NOT EXISTS termos_mandato (
  pessoa_id  TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  inicio     TEXT NOT NULL,
  fim        TEXT,
  PRIMARY KEY (pessoa_id, inicio)
);

CREATE TABLE IF NOT EXISTS pleitos (
  id          INTEGER PRIMARY KEY,
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  ano         INTEGER NOT NULL,
  cargo       TEXT,
  turno       INTEGER,
  votos       INTEGER,
  percentual  REAL
);

CREATE INDEX IF NOT EXISTS idx_pleitos_pessoa ON pleitos(pessoa_id);

-- Votação nominal do mandato corrente.
CREATE TABLE IF NOT EXISTS votacoes (
  pessoa_id  TEXT PRIMARY KEY REFERENCES pessoas(id) ON DELETE CASCADE,
  sim        INTEGER,
  nao        INTEGER,
  abstencao  INTEGER,
  ausente    INTEGER,
  licenca    INTEGER
);

-- Série histórica por ano (mesma forma do voto, repartida por ano).
CREATE TABLE IF NOT EXISTS votacoes_historicas (
  pessoa_id  TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  ano        INTEGER NOT NULL,
  sim        INTEGER,
  nao        INTEGER,
  abstencao  INTEGER,
  ausente    INTEGER,
  licenca    INTEGER,
  PRIMARY KEY (pessoa_id, ano)
);

CREATE TABLE IF NOT EXISTS presencas (
  pessoa_id     TEXT PRIMARY KEY REFERENCES pessoas(id) ON DELETE CASCADE,
  sessoes       INTEGER,
  compareceu    INTEGER,
  justificadas  INTEGER
);

CREATE TABLE IF NOT EXISTS patrimonios (
  pessoa_id  TEXT PRIMARY KEY REFERENCES pessoas(id) ON DELETE CASCADE,
  valor      REAL,
  ano        INTEGER,
  anterior   REAL
);

CREATE TABLE IF NOT EXISTS cotas (
  pessoa_id  TEXT PRIMARY KEY REFERENCES pessoas(id) ON DELETE CASCADE,
  valor      REAL,
  ano        INTEGER
);

-- Gastos que compõem a cota. `nota` é NULL quando a fonte não publica a
-- nota fiscal: a interface mostra travessão e o motivo, nunca 0.
CREATE TABLE IF NOT EXISTS cota_itens (
  id           INTEGER PRIMARY KEY,
  pessoa_id    TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  descricao    TEXT,
  valor        REAL,
  nota         TEXT,
  fornecedor   TEXT,
  ordem        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cota_itens_pessoa ON cota_itens(pessoa_id);

CREATE TABLE IF NOT EXISTS propostas (
  id         INTEGER PRIMARY KEY,
  pessoa_id  TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  tipo       TEXT,
  ano        INTEGER,
  status     TEXT,
  fonte_id   INTEGER REFERENCES fontes(id)
);

CREATE INDEX IF NOT EXISTS idx_propostas_pessoa ON propostas(pessoa_id);

CREATE TABLE IF NOT EXISTS emendas (
  id          INTEGER PRIMARY KEY,
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  ano         INTEGER,
  valor       REAL,
  destino     TEXT,
  area        TEXT,
  descricao   TEXT
);

CREATE INDEX IF NOT EXISTS idx_emendas_pessoa ON emendas(pessoa_id);

CREATE TABLE IF NOT EXISTS pessoa_comissao (
  pessoa_id    TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  comissao_id  INTEGER NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE,
  ordem        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pessoa_id, comissao_id)
);

CREATE TABLE IF NOT EXISTS campanhas (
  id           INTEGER PRIMARY KEY,
  pessoa_id    TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  ano          INTEGER,
  arrecadado   REAL,
  gasto        REAL
);

CREATE INDEX IF NOT EXISTS idx_campanhas_pessoa ON campanhas(pessoa_id);

CREATE TABLE IF NOT EXISTS doadores (
  id           INTEGER PRIMARY KEY,
  campanha_id  INTEGER NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  nome         TEXT,
  valor        REAL
);

CREATE INDEX IF NOT EXISTS idx_doadores_campanha ON doadores(campanha_id);

-- ------------------------------------------------------- dados por estado --

-- Bancada do estado: nomes e partido de cada mandato, sem ordenação de
-- mérito. `ordem` é a ordem de exibição, não uma hierarquia.
CREATE TABLE IF NOT EXISTS bancadas (
  id             INTEGER PRIMARY KEY,
  estado_sigla   TEXT NOT NULL REFERENCES estados(sigla) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  cargo          TEXT,
  partido_sigla  TEXT REFERENCES partidos(sigla),
  titular        INTEGER NOT NULL DEFAULT 0,
  ordem          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bancadas_estado ON bancadas(estado_sigla);

-- Valor de uma camada temática por estado. `sem_dado = 1` significa que a
-- fonte não publica esse número: a interface mostra travessão e o motivo,
-- nunca zero.
CREATE TABLE IF NOT EXISTS estado_camada (
  estado_sigla  TEXT NOT NULL REFERENCES estados(sigla) ON DELETE CASCADE,
  camada_id     TEXT NOT NULL REFERENCES camadas(id) ON DELETE CASCADE,
  valor         REAL,
  sem_dado      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (estado_sigla, camada_id)
);

-- --------------------------------------------------- lacunas e ausências --

-- Cada bloco ausente tem um motivo. É a forma de garantir, no dado e não
-- só na tela, que "não publicado" nunca vire 0.
CREATE TABLE IF NOT EXISTS lacunas (
  id          INTEGER PRIMARY KEY,
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  bloco       TEXT NOT NULL,
  motivo      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lacunas_pessoa ON lacunas(pessoa_id);

-- -------------------------------------------------------- escritas do site --

-- Pedidos de monitoramento. Sem senha, sem login: o protótipo registra o
-- pedido para a pessoavladora confirmar o recebimento.
CREATE TABLE IF NOT EXISTS monitoramentos (
  id          INTEGER PRIMARY KEY,
  pessoa_id   TEXT,
  nome        TEXT,
  email       TEXT,
  telefone    TEXT,
  canal       TEXT,
  mensagem    TEXT,
  criado_em   TEXT NOT NULL
);

-- Sugestões e relatos de erro.
CREATE TABLE IF NOT EXISTS sugestoes (
  id          INTEGER PRIMARY KEY,
  contexto    TEXT,
  tipo        TEXT,
  mensagem    TEXT NOT NULL,
  email       TEXT,
  criado_em   TEXT NOT NULL
);

-- Trilha de auditoria: o que a API serviu, quando. Útil para provar que a
-- versão em produção é a mesma que foi validada.
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY,
  rota        TEXT NOT NULL,
  metodo      TEXT NOT NULL,
  status      INTEGER,
  criado_em   TEXT NOT NULL
);
