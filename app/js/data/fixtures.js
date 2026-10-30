/* ============================================================================
   fixtures.js — dados de DEMONSTRAÇÃO
   ---------------------------------------------------------------------------
   ATENÇÃO: tudo neste arquivo é fictício. As pessoas, os partidos usados nos
   registros, os números, as emendas e as votações foram inventados para
   exercitar a interface. Não descrevem nenhuma pessoa real, nem nenhum
   partido real.

   O que é real: a geometria dos estados (app/js/data/br-map.js), a lista de
   estados e regiões do IBGE, e a forma dos campos, que segue o modelo de dados
   inferido no recon.

   As lacunas são propositais: existem blocos com valor ausente (null) para
   provar a regra do projeto — dado que a fonte não publica vira "—", com o
   motivo, e nunca 0.
   ========================================================================== */

export const PROJETO = {
  nome: 'Transparência Política',
  tagline: 'dados oficiais, sem nota e sem ranking',
  fontePadrao: 'Dados fictícios de demonstração',
  atualizadoEm: '30/10/2026',
};

export const REGIOES = {
  1: 'Norte',
  2: 'Nordeste',
  3: 'Centro-Oeste',
  4: 'Sudeste',
  5: 'Sul',
};

/**
 * Partidos de demonstração: sigla e nome inventados. Nenhum partido real
 * aparece no protótipo. A identidade do partido é sempre texto — nunca um
 * juízo sobre a pessoa, nunca uma cor que avalie.
 */
export const PARTIDOS = [
  { sigla: 'ADB', nome: 'Aliança dos Bairros' },
  { sigla: 'CDV', nome: 'Coalição do Vale' },
  { sigla: 'CPL', nome: 'Coletivo Popular' },
  { sigla: 'FEX', nome: 'Fórum Executivo' },
  { sigla: 'MDV', nome: 'Movimento Democrático' },
  { sigla: 'PDP', nome: 'Partido do Povo' },
  { sigla: 'RDV', nome: 'Rede de Vizinhança' },
  { sigla: 'UDP', nome: 'União das Praias' },
];

/** Nome por extenso de um partido fictício; devolve a sigla se não achar. */
export function nomeDoPartido(sigla) {
  const achado = PARTIDOS.find((p) => p.sigla === sigla);
  return achado ? achado.nome : sigla;
}
/* --------------------------------------------------------------- camadas */

export const CAMADAS = [
  {
    id: 'contas',
    nome: 'Contas de campanha',
    unidade: 'R$ em milhares',
    descricao: 'Total declarado pelas campanhas no estado na última eleição.',
  },
  {
    id: 'escolas',
    nome: 'Escolas',
    unidade: 'escolas por 10 mil habitantes',
    descricao: 'Rede de ensino basic municipal e estadual.',
  },
  {
    id: 'obras',
    nome: 'Obras',
    unidade: 'obras por 100 mil habitantes',
    descricao: 'Contratos de obra pública em andamento.',
  },
  {
    id: 'dinheiro',
    nome: 'Dinheiro público',
    unidade: 'R$ por habitante',
    descricao: 'Arrecadação por habitante no último ano fechado.',
  },
  {
    id: 'votacoes',
    nome: 'Votações',
    unidade: '% de presença em votação',
    descricao: 'Participação em sessões de votação nominal.',
  },
];

/* --------------------------------------------------------------- estados */

/** Estados que o protótipo abre com detalhe. Others return to the generic state. */
export const ESTADOS = {
  SP: {
    nome: 'São Paulo',
    regiao: 4,
    lema: 'Maior estado em número de municípios: 645 cidades.',
    bancada: [
      { nome: 'Cléo Antunes', cargo: 'Deputada federal', partido: 'PDP', titular: true },
      { nome: 'Téo Bragança', cargo: 'Deputado federal', partido: 'ADB', titular: true },
      { nome: 'Débora Nunes', cargo: 'Deputada estadual', partido: 'CDV', titular: true },
      { nome: 'Otávio Peixoto', cargo: 'Deputado estadual', partido: 'FEX', titular: false },
      { nome: 'Sara Quintela', cargo: 'Deputada estadual', partido: 'UDP', titular: true },
      { nome: 'Ivo Sarti', cargo: 'Senador', partido: 'MDV', titular: true },
    ],
  },
  RJ: {
    nome: 'Rio de Janeiro',
    regiao: 4,
    lema: 'Capital com obras em revisão no orçamento municipal.',
    bancada: [
      { nome: 'Ruan Ferraz', cargo: 'Deputado federal', partido: 'ADB', titular: true },
      { nome: 'Aline Fontes', cargo: 'Prefeita', partido: 'CDV', titular: true },
      { nome: 'Bruno Caldas', cargo: 'Vereador', partido: 'MDV', titular: true },
      { nome: 'Nara Vasconcelos', cargo: 'Deputada federal', partido: 'CPL', titular: true },
    ],
  },
  PE: {
    nome: 'Pernambuco',
    regiao: 2,
    lema: 'Recife, Olinda e Caruaru concentram a maior parte dos registros.',
    bancada: [
      { nome: 'Marina Caldeira', cargo: 'Prefeita', partido: 'CPL', titular: true },
      { nome: 'Otávio Bezerra', cargo: 'Vereador', partido: 'FEX', titular: true },
      { nome: 'Celso Bragança', cargo: 'Deputado estadual', partido: 'ADB', titular: true },
    ],
  },
  BA: {
    nome: 'Bahia',
    regiao: 2,
    lema: '49 municipios com dados abertos publicados.',
    bancada: [
      { nome: 'Celso Bragança', cargo: 'Prefeito', partido: 'ADB', titular: true },
      { nome: 'Luana Seixas', cargo: 'Vereadora', partido: 'RDV', titular: true },
      { nome: 'Otávio Peixoto', cargo: 'Deputado federal', partido: 'FEX', titular: true },
    ],
  },
  MG: {
    nome: 'Minas Gerais',
    regiao: 4,
    lema: '853 municipios; os dados por cidade são esparsos.',
    bancada: [
      { nome: 'Nara Vasconcelos', cargo: 'Deputada federal', partido: 'CPL', titular: true },
      { nome: 'Fábio Lemos', cargo: 'Prefeito', partido: 'FEX', titular: true },
      { nome: 'Débora Nunes', cargo: 'Deputada estadual', partido: 'CDV', titular: true },
    ],
  },
  DF: {
    nome: 'Distrito Federal',
    regiao: 3,
    lema: 'Esfera federal: senadores, deputados federais e deputado distrital.',
    bancada: [
      { nome: 'Helena Braga', cargo: 'Senadora', partido: 'CDV', titular: true },
      { nome: 'Marcelo Aguiar', cargo: 'Deputado distrital', partido: 'UDP', titular: true },
      { nome: 'Nara Vasconcelos', cargo: 'Deputada federal', partido: 'CPL', titular: false },
    ],
  },
};

/* -------------------------------------------------------------- pessoas */

/**
 * Campos de uma pessoa. `null` significa "a fonte não publica" — nunca 0.
 */
export const PESSOAS = [
  {
    id: 'marina-caldeira',
    nome: 'Marina Caldeira',
    cargo: 'Prefeita',
    cargoTipo: 'prefeito',
    esfera: 'municipal',
    uf: 'PE',
    municipio: 'Recife',
    partido: 'CPL',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-01-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 128940, percentual: 41.2, cargo: 'Prefeita', turno: 1 },
    votacao: { sim: 34, nao: 21, abstencao: 3, ausente: 4, licenca: 6 },
    presenca: { sessoes: 68, compareceu: 58, justificadas: 4 },
    patrimonio: { valor: 418000, ano: 2026, anterior: 332000 },
    cota: null,
    cotaMotivo: 'Prefeituras não publicam nota fiscal do gabinete neste portal.',
    propostas: [
      { titulo: 'Plano de creches em 12 bairros', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Câmara Municipal de Recife' },
      { titulo: 'Programa de transporte adaptado', tipo: 'Projeto de lei', ano: 2025, status: 'viram lei', fonte: 'Câmara Municipal de Recife' },
    ],
    emendas: [
      { ano: 2026, valor: 2400000, destino: 'Recife', area: 'Saúde', descricao: 'Equipamento para hospital municipal' },
      { ano: 2025, valor: 860000, destino: 'Olinda', area: 'Educação', descricao: 'Reforma de duas escolas municipais' },
    ],
    comissoes: ['Comissão de Saúde', 'Comissão de Orçamento'],
    campanha: { ano: 2024, arrecadado: 3400000, gasto: 3180000, doadores: [{ nome: 'Cooperativa de Saúde Norte', valor: 120000 }] },
  },
  {
    id: 'otavio-bezerra',
    nome: 'Otávio Bezerra',
    cargo: 'Vereador',
    cargoTipo: 'vereador',
    esfera: 'municipal',
    uf: 'PE',
    municipio: 'Recife',
    partido: 'FEX',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-01-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 8420, percentual: 2.8, cargo: 'Vereador', turno: 1 },
    votacao: { sim: 41, nao: 17, abstencao: 6, ausente: 9, licenca: 2 },
    presenca: null,
    presencaMotivo: 'A Câmara Municipal não publica lista de presença nominada.',
    patrimonio: null,
    patrimonioMotivo: 'Sem declaração de patrimônio nos dados disponíveis.',
    cota: null,
    cotaMotivo: 'Vereadores não têm cota parlamentar neste portal.',
    propostas: [],
    emendas: [],
    comissoes: ['Comissão de Educação'],
    campanha: { ano: 2024, arrecadado: 210000, gasto: 205000, doadores: [] },
  },
  {
    id: 'celso-braganca',
    nome: 'Celso Bragança',
    cargo: 'Prefeito',
    cargoTipo: 'prefeito',
    esfera: 'municipal',
    uf: 'BA',
    municipio: 'Salvador',
    partido: 'ADB',
    situacao: 'mandato_interrompido',
    titular: true,
    mandato: { inicio: '2025-01-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 214300, percentual: 38.9, cargo: 'Prefeito', turno: 2 },
    votacao: { sim: 12, nao: 9, abstencao: 2, ausente: 3, licenca: 11 },
    presenca: { sessoes: 37, compareceu: 26, justificadas: 11 },
    patrimonio: { valor: 1250000, ano: 2026, anterior: 980000 },
    cota: null,
    cotaMotivo: 'Prefeituras não publicam nota fiscal do gabinete neste portal.',
    propostas: [
      { titulo: 'Plano de mobilidade do centro', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Câmara Municipal de Salvador' },
    ],
    emendas: [{ ano: 2026, valor: 5200000, destino: 'Salvador', area: 'Mobilidade', descricao: 'Recapeamento de vias principais' }],
    comissoes: ['Comissão de Transporte'],
    campanha: { ano: 2024, arrecadado: 9800000, gasto: 9400000, doadores: [{ nome: 'Sindicato dos Metroviaros', valor: 340000 }] },
  },
  {
    id: 'luana-seixas',
    nome: 'Luana Seixas',
    cargo: 'Vereadora',
    cargoTipo: 'vereador',
    esfera: 'municipal',
    uf: 'BA',
    municipio: 'Salvador',
    partido: 'RDV',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-01-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 15200, percentual: 4.6, cargo: 'Vereadora', turno: 1 },
    votacao: { sim: 29, nao: 24, abstencao: 5, ausente: 6, licenca: 1 },
    presenca: null,
    presencaMotivo: 'A Câmara Municipal não publica lista de presença nominada.',
    patrimonio: { valor: 96000, ano: 2026, anterior: 71000 },
    cota: null,
    cotaMotivo: 'Vereadores não têm cota parlamentar neste portal.',
    propostas: [{ titulo: 'Programa de hortas comunitárias', tipo: 'Projeto de lei', ano: 2026, status: 'viram lei', fonte: 'Câmara Municipal de Salvador' }],
    emendas: [],
    comissoes: ['Comissão de Meio Ambiente'],
    campanha: { ano: 2024, arrecadado: 96000, gasto: 91000, doadores: [] },
  },
  {
    id: 'aline-fontes',
    nome: 'Aline Fontes',
    cargo: 'Prefeita',
    cargoTipo: 'prefeito',
    esfera: 'municipal',
    uf: 'RJ',
    municipio: 'Rio de Janeiro',
    partido: 'CDV',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-01-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 512300, percentual: 44.3, cargo: 'Prefeita', turno: 2 },
    votacao: { sim: 22, nao: 18, abstencao: 4, ausente: 5, licenca: 3 },
    presenca: { sessoes: 52, compareceu: 44, justificadas: 3 },
    patrimonio: { valor: 2240000, ano: 2026, anterior: 1980000 },
    cota: null,
    cotaMotivo: 'Prefeituras não publicam nota fiscal do gabinete neste portal.',
    propostas: [
      { titulo: 'Plano de saneamento em 12 bairros', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Câmara Municipal do Rio de Janeiro' },
      { titulo: 'Reforma de parques públicos', tipo: 'Projeto de lei', ano: 2025, status: 'viram lei', fonte: 'Câmara Municipal do Rio de Janeiro' },
    ],
    emendas: [{ ano: 2026, valor: 12400000, destino: 'Rio de Janeiro', area: 'Saneamento', descricao: 'Rede decollector de esgoto em 4 comunidades' }],
    comissoes: ['Comissão de Saneamento', 'Comissão de Educação'],
    campanha: { ano: 2024, arrecadado: 14200000, gasto: 13800000, doadores: [{ nome: 'Rede de Saúde Metropolitanana', valor: 520000 }] },
  },
  {
    id: 'bruno-caldas',
    nome: 'Bruno Caldas',
    cargo: 'Vereador',
    cargoTipo: 'vereador',
    esfera: 'municipal',
    uf: 'RJ',
    municipio: 'Rio de Janeiro',
    partido: 'MDV',
    situacao: 'suplente',
    titular: false,
    mandato: { inicio: '2026-07-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 24300, percentual: 6.1, cargo: 'Vereador', turno: 1 },
    votacao: { sim: 8, nao: 6, abstencao: 1, ausente: 2, licenca: 0 },
    presenca: null,
    presencaMotivo: 'A Câmara Municipal não publica lista de presença nominada.',
    patrimonio: { valor: 145000, ano: 2026, anterior: 120000 },
    cota: null,
    cotaMotivo: 'Vereadores não têm cota parlamentar neste portal.',
    propostas: [],
    emendas: [],
    comissoes: [],
    campanha: { ano: 2024, arrecadado: 320000, gasto: 310000, doadores: [] },
  },
  {
    id: 'cleo-antunes',
    nome: 'Cléo Antunes',
    cargo: 'Deputada federal',
    cargoTipo: 'deputado_federal',
    esfera: 'federal',
    uf: 'SP',
    municipio: null,
    partido: 'PDP',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-02-01', fim: '2029-01-31' },
    ultimoPleito: { ano: 2022, votos: 312400, percentual: 7.4, cargo: 'Deputada federal', turno: 1 },
    votacao: { sim: 96, nao: 58, abstencao: 12, ausente: 21, licenca: 9 },
    presenca: { sessoes: 196, compareceu: 178, justificadas: 9 },
    patrimonio: { valor: 5244568, ano: 2026, anterior: 355000 },
    cota: { valor: 240512, ano: 2026, itens: [
      { descricao: 'Contratação de consultoria em comunicação', valor: 96000, nota: null, fornecedor: '—' },
      { descricao: 'Passagens e hospedagem', valor: 48200, nota: 'NF 2026-44812', fornecedor: 'Agência Viajeiro' },
      { descricao: 'Material de expediente', valor: 12400, nota: null, fornecedor: '—' },
    ] },
    propostas: [
      { titulo: 'Plano nacional de creches', tipo: 'Projeto de lei', ano: 2026, status: 'viram lei', fonte: 'Câmara dos Deputados' },
      { titulo: 'Licenciamento ambiental simplificado', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Câmara dos Deputados' },
      { titulo: 'Programa municipal de leitura', tipo: 'Projeto de lei', ano: 2025, status: 'arquivado', fonte: 'Câmara dos Deputados' },
    ],
    emendas: [
      { ano: 2026, valor: 1800000, destino: 'São Paulo', area: 'Educação', descricao: 'Reforma de escolas municipais' },
      { ano: 2026, valor: 950000, destino: 'Campinas', area: 'Saúde', descricao: 'Equipamento de UTI' },
      { ano: 2025, valor: 640000, destino: 'Santos', area: 'Mobilidade', descricao: 'Pavimentação de vias' },
    ],
    comissoes: ['Comissão de Educação', 'Comissão de Meio Ambiente'],
    campanha: { ano: 2022, arrecadado: 8340326, gasto: 7910000, doadores: [{ nome: 'Instituto Brasil Digital', valor: 480000 }] },
  },
  {
    id: 'ruan-ferraz',
    nome: 'Ruan Ferraz',
    cargo: 'Deputado federal',
    cargoTipo: 'deputado_federal',
    esfera: 'federal',
    uf: 'RJ',
    municipio: null,
    partido: 'ADB',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-02-01', fim: '2029-01-31' },
    ultimoPleito: { ano: 2022, votos: 487000, percentual: 11.8, cargo: 'Deputado federal', turno: 1 },
    votacao: { sim: 118, nao: 41, abstencao: 6, ausente: 14, licenca: 4 },
    presenca: { sessoes: 196, compareceu: 191, justificadas: 4 },
    patrimonio: { valor: 780000, ano: 2026, anterior: 640000 },
    cota: { valor: 198300, ano: 2026, itens: [
      { descricao: 'Divulgação institucional', valor: 120000, nota: 'NF 2026-10932', fornecedor: 'Agência Ponto Norte' },
      { descricao: 'Consultoria jurídica', valor: 42000, nota: null, fornecedor: '—' },
    ] },
    propostas: [
      { titulo: 'Fundo permanente de saneamento', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Câmara dos Deputados' },
      { titulo: 'Reforma do Código Penal', tipo: 'Projeto de lei', ano: 2025, status: 'viram lei', fonte: 'Câmara dos Deputados' },
    ],
    emendas: [{ ano: 2026, valor: 2200000, destino: 'Rio de Janeiro', area: 'Saneamento', descricao: 'Rede de esgoto em comunidade' }],
    comissoes: ['Comissão de Saneamento'],
    campanha: { ano: 2022, arrecadado: 6120000, gasto: 5980000, doadores: [{ nome: 'Cooperativa de Saúde Leste', valor: 210000 }] },
  },
  {
    id: 'nara-vasconcelos',
    nome: 'Nara Vasconcelos',
    cargo: 'Deputada federal',
    cargoTipo: 'deputado_federal',
    esfera: 'federal',
    uf: 'MG',
    municipio: null,
    partido: 'CPL',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-02-01', fim: '2029-01-31' },
    ultimoPleito: { ano: 2022, votos: 268000, percentual: 6.2, cargo: 'Deputada federal', turno: 1 },
    votacao: { sim: 88, nao: 52, abstencao: 15, ausente: 19, licenca: 11 },
    presenca: { sessoes: 196, compareceu: 176, justificadas: 11 },
    patrimonio: { valor: 1120000, ano: 2026, anterior: 1030000 },
    cota: { valor: 210400, ano: 2026, itens: [
      { descricao: 'Assessoria técnica', valor: 88000, nota: 'NF 2026-77120', fornecedor: 'Consultoria Aurora' },
      { descricao: 'Material de expediente', valor: 9600, nota: null, fornecedor: '—' },
    ] },
    propostas: [{ titulo: 'Programa de creches no campo', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Câmara dos Deputados' }],
    emendas: [],
    comissoes: ['Comissão de Agricultura'],
    campanha: { ano: 2022, arrecadado: 4120000, gasto: 4050000, doadores: [] },
  },
  {
    id: 'helena-braga',
    nome: 'Helena Braga',
    cargo: 'Senadora',
    cargoTipo: 'senador',
    esfera: 'federal',
    uf: 'AM',
    municipio: null,
    partido: 'CDV',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2023-02-01', fim: '2031-01-31' },
    ultimoPleito: { ano: 2022, votos: 921000, percentual: 18.4, cargo: 'Senadora', turno: 1 },
    votacao: { sim: 74, nao: 39, abstencao: 8, ausente: 12, licenca: 14 },
    // O Senado não publica lista de presença nominada: o bloco vira "—".
    presenca: null,
    presencaMotivo: 'O Senado não publica lista nominal de presença em votação.',
    patrimonio: { valor: 890000, ano: 2026, anterior: 760000 },
    cota: { valor: 312800, ano: 2026, itens: [
      { descricao: 'Divulgação institucional', valor: 150000, nota: 'NF 2026-22091', fornecedor: 'Agência Farol' },
      { descricao: 'Viagens institucionais', valor: 88400, nota: null, fornecedor: '—' },
    ] },
    propostas: [{ titulo: 'Programa de navegação amazônica', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Senado Federal' }],
    emendas: [{ ano: 2026, valor: 3100000, destino: 'Manaus', area: 'Infraestrutura', descricao: 'Recuperação de vias urbanas' }],
    comissoes: ['Comissão de infraestrutura', 'Comissão de Ambiente'],
    campanha: { ano: 2022, arrecadado: 11200000, gasto: 10900000, doadores: [] },
  },
  {
    id: 'ivo-sarti',
    nome: 'Ivo Sarti',
    cargo: 'Senador',
    cargoTipo: 'senador',
    esfera: 'federal',
    uf: 'RS',
    municipio: null,
    partido: 'MDV',
    situacao: 'nao_eleito',
    titular: true,
    mandato: { inicio: '2019-02-01', fim: '2027-01-31' },
    ultimoPleito: { ano: 2022, votos: 2410000, percentual: 44.7, cargo: 'Senador', turno: 1 },
    votacao: { sim: 132, nao: 61, abstencao: 9, ausente: 22, licenca: 7 },
    presenca: null,
    presencaMotivo: 'O Senado não publica lista nominal de presença em votação.',
    patrimonio: { valor: 3400000, ano: 2026, anterior: 3100000 },
    cota: { valor: 288500, ano: 2026, itens: [
      { descricao: 'Assessoria jurídica', valor: 96000, nota: 'NF 2026-31007', fornecedor: 'Advocacia Serra' },
    ] },
    propostas: [],
    emendas: [],
    comissoes: ['Comissão de Agricultura'],
    campanha: { ano: 2022, arrecadado: 22400000, gasto: 21900000, doadores: [{ nome: 'Cooperativa do Sul', valor: 990000 }] },
  },
  {
    id: 'teo-braganca',
    nome: 'Téo Bragança',
    cargo: 'Deputado federal',
    cargoTipo: 'deputado_federal',
    esfera: 'federal',
    uf: 'SP',
    municipio: null,
    partido: 'ADB',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-02-01', fim: '2029-01-31' },
    ultimoPleito: { ano: 2022, votos: 521000, percentual: 12.9, cargo: 'Deputado federal', turno: 1 },
    votacao: { sim: 104, nao: 46, abstencao: 10, ausente: 17, licenca: 6 },
    presenca: { sessoes: 196, compareceu: 184, justificadas: 6 },
    patrimonio: { valor: 620000, ano: 2026, anterior: 540000 },
    cota: { valor: 226100, ano: 2026, itens: [] },
    propostas: [{ titulo: 'Audiência pública sobre licenciamento', tipo: 'Requerimento', ano: 2026, status: 'atendido', fonte: 'Câmara dos Deputados' }],
    emendas: [{ ano: 2026, valor: 1400000, destino: 'Santos', area: 'Porto', descricao: 'Dragagem do canal' }],
    comissoes: ['Comissão de Portos e Navegação'], // corrigido abaixo
    campanha: { ano: 2022, arrecadado: 5400000, gasto: 5300000, doadores: [] },
  },
  {
    id: 'debora-nunes',
    nome: 'Débora Nunes',
    cargo: 'Deputada estadual',
    cargoTipo: 'deputado_estadual',
    esfera: 'estadual',
    uf: 'SP',
    municipio: null,
    partido: 'CDV',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-02-01', fim: '2029-01-31' },
    ultimoPleito: { ano: 2022, votos: 178000, percentual: 4.2, cargo: 'Deputada estadual', turno: 1 },
    votacao: { sim: 51, nao: 33, abstencao: 7, ausente: 11, licenca: 5 },
    presenca: { sessoes: 107, compareceu: 98, justificadas: 5 },
    patrimonio: { valor: 540000, ano: 2026, anterior: 470000 },
    cota: null,
    cotaMotivo: 'A cota parlamentar deste cargo não é publicada nesta demonstração.',
    propostas: [{ titulo: 'Programa estadual de leitura', tipo: 'Projeto de lei', ano: 2026, status: 'em tramitação', fonte: 'Assembleia Legislativa de São Paulo' }],
    emendas: [{ ano: 2026, valor: 780000, destino: 'Sorocaba', area: 'Educação', descricao: 'Biblioteca municipal' }],
    comissoes: ['Comissão de Educação'],
    campanha: { ano: 2022, arrecadado: 2100000, gasto: 2050000, doadores: [] },
  },
  {
    id: 'fabio-lemos',
    nome: 'Fábio Lemos',
    cargo: 'Prefeito',
    cargoTipo: 'prefeito',
    esfera: 'municipal',
    uf: 'MG',
    municipio: 'Belo Horizonte',
    partido: 'FEX',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-01-01', fim: '2028-12-31' },
    ultimoPleito: { ano: 2024, votos: 402100, percentual: 55.3, cargo: 'Prefeito', turno: 1 },
    votacao: { sim: 19, nao: 14, abstencao: 3, ausente: 6, licenca: 4 },
    presenca: { sessoes: 46, compareceu: 39, justificadas: 4 },
    patrimonio: { valor: 1580000, ano: 2026, anterior: 1490000 },
    cota: null,
    cotaMotivo: 'Prefeituras não publicam nota fiscal do gabinete neste portal.',
    propostas: [],
    emendas: [],
    comissoes: [],
    campanha: { ano: 2024, arrecadado: 7400000, gasto: 7200000, doadores: [] },
  },
  {
    id: 'marcelo-aguiar',
    nome: 'Marcelo Aguiar',
    cargo: 'Deputado distrital',
    cargoTipo: 'deputado_estadual',
    esfera: 'estadual',
    uf: 'DF',
    municipio: 'Brasília',
    partido: 'UDP',
    situacao: 'em_exercicio',
    titular: true,
    mandato: { inicio: '2025-02-01', fim: '2029-01-31' },
    ultimoPleito: { ano: 2022, votos: 62000, percentual: 2.1, cargo: 'Deputado distrital', turno: 1 },
    votacao: { sim: 38, nao: 26, abstencao: 4, ausente: 8, licenca: 3 },
    presenca: { sessoes: 79, compareceu: 71, justificadas: 3 },
    patrimonio: { valor: 210000, ano: 2026, anterior: 198000 },
    cota: null,
    cotaMotivo: 'Cota parlamentar de mandato distrital não é publicada nesta demonstração.',
    propostas: [],
    emendas: [{ ano: 2026, valor: 420000, destino: 'Brasília', area: 'Mobilidade', descricao: 'Ciclovia na Asa Norte' }],
    comissoes: ['Comissão de Mobilidade'],
    campanha: { ano: 2022, arrecadado: 380000, gasto: 370000, doadores: [] },
  },
];

/* --------------------------------------------------------------- cidades */

export const CIDADES = [
  { nome: 'Recife', uf: 'PE', ibge: '2614106' },
  { nome: 'Salvador', uf: 'BA', ibge: '2927408' },
  { nome: 'São Paulo', uf: 'SP', ibge: '3550308' },
  { nome: 'Rio de Janeiro', uf: 'RJ', ibge: '3304557' },
  { nome: 'Belo Horizonte', uf: 'MG', ibge: '3106200' },
  { nome: 'Curitiba', uf: 'PR', ibge: '4106902' },
  { nome: 'Porto Alegre', uf: 'RS', ibge: '4314902' },
  { nome: 'Brasília', uf: 'DF', ibge: '5300108' },
  { nome: 'Manaus', uf: 'AM', ibge: '1302603' },
  { nome: 'Fortaleza', uf: 'CE', ibge: '2304400' },
  { nome: 'Goiânia', uf: 'GO', ibge: '5208707' },
  { nome: 'Belém', uf: 'PA', ibge: '1501402' },
];

/* --------------------------------------------------------------- consultas */

export const porId = (id) => PESSOAS.find((p) => p.id === id) || null;

export const porUf = (uf) => PESSOAS.filter((p) => p.uf === uf);

export const porMunicipio = (nome) =>
  PESSOAS.filter((p) => p.municipio && normalizar(p.municipio) === normalizar(nome));

export const comPartidos = (lista) => {
  const out = new Map();
  for (const p of lista) out.set(p.partido, (out.get(p.partido) || 0) + 1);
  return out;
};

/** Remove acentos e normaliza para busca tolerante. */
export function normalizar(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Remove acentos mantendo caixa — para exibir a busca. */
export function semAcento(texto) {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Gera valores determinísticos (sempre iguais entre recargas) para o mapa. */
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function valoresDaCamada(camadaId, siglas) {
  const out = {};
  for (let i = 0; i < siglas.length; i += 1) {
    const r = pseudoRandom(i * 7.13 + camadaId.length * 3.7);
    const base = { contas: 2400, escolas: 62, obras: 18, dinheiro: 8900, votacoes: 88 }[camadaId];
    const spread = { contas: 4200, escolas: 22, obras: 14, dinheiro: 5200, votacoes: 9 }[camadaId];
    const valor = base + r * spread;
    out[siglas[i]] = {
      valor: valor > 1000 ? Math.round(valor) : Math.round(valor * 10) / 10,
      // um estado em cada dez não tem dado na fonte: precisa aparecer como "—"
      semDado: pseudoRandom(i * 3.31 + 7) > 0.9,
    };
  }
  return out;
}

/** Escalas de rampa do mapa: 7 degraus da rampa monocromática. */
export const RAMPS = [
  'var(--ramp-0)',
  'var(--ramp-1)',
  'var(--ramp-2)',
  'var(--ramp-3)',
  'var(--ramp-4)',
  'var(--ramp-5)',
  'var(--ramp-6)',
];

export function corDoValor(valor, min, max) {
  if (valor === null || valor === undefined) return 'var(--data-neutro)';
  if (max === min) return RAMPS[3];
  const t = (valor - min) / (max - min);
  const idx = Math.min(RAMPS.length - 1, Math.max(0, Math.round(t * (RAMPS.length - 1))));
  return RAMPS[idx];
}

/* --------------------------------------------------- série histórica (demo) */

/** Hash estável de string → [0,1). Mantém a demo idêntica entre recargas. */
function hash01(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Reparte o total de votos do mandato entre 2026, 2025 e 2024.
 * Fica em um único lugar porque é o único lugar onde existe invenção:
 * o resto do crachá mostra o que a fonte "publicou".
 */
export function historicoDe(pessoa) {
  if (!pessoa.votacao) return [];
  const anos = [2026, 2025, 2024];
  const pesos = [0.46, 0.33, 0.21];
  const chaves = ['sim', 'nao', 'abstencao', 'ausente', 'licenca'];
  const jitter = hash01(pessoa.id);
  const usados = {};
  const out = [];

  anos.forEach((ano, i) => {
    const linha = { ano };
    chaves.forEach((chave, j) => {
      const total = pessoa.votacao[chave] || 0;
      const variacao = 0.85 + ((jitter * (i + 1) * (j + 3)) % 0.3);
      const q = Math.round(total * pesos[i] * variacao);
      linha[chave] = q;
      usados[chave] = (usados[chave] || 0) + q;
    });
    out.push(linha);
  });

  const ultimo = out[out.length - 1];
  chaves.forEach((chave) => {
    const diff = (pessoa.votacao[chave] || 0) - (usados[chave] || 0);
    ultimo[chave] = Math.max(0, ultimo[chave] + diff);
  });

  return out;
}
