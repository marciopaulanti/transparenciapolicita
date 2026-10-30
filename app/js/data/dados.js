/* ============================================================================
   data/dados.js — a origem única dos dados no navegador
   ---------------------------------------------------------------------------
   O protótipo tem duas fontes para os mesmos registros:

   · a API (SQLite no servidor), que é a fonte de verdade em produção;
   · o dataset embutido em `fixtures.js`, que é o reserva.

   A regra é simples: tenta a API; se ela não responder, usa o reserva e
   segue. A pessoa nunca fica olhando uma tela quebrada porque o servidor
   estava ocupado.

   Este módulo guarda os dados em objetos que as telas importam por
   referência. Quando a API responde, o conteúdo é trocado no lugar — sem
   recriar os objetos —, então todas as telas que já importaram enxergam a
   versão nova sem precisar recarregar.
   ========================================================================== */

import * as FX from './fixtures.js';

/* ------------------------------------------------------------ o conjunto */

/** Estado do carregamento, para o rodapé poder avisar. */
export const estado = {
  origem: 'embutido',
  carregado: false,
  erro: null,
  // true quando o dataset da API difere do embutido — a tela precisa ser
  // redesenhada para mostrar a versão nova.
  mudou: false,
};

/**
 * Coleções do dataset. São `const` de propósito: o conteúdo é trocado
 * dentro, nunca o objeto. Assim quem importou continua enxergando o
 * mesmo objeto — só com o conteúdo atualizado.
 */
export const PROJETO = { ...FX.PROJETO };
export const REGIOES = { ...FX.REGIOES };
export const PARTIDOS = [...FX.PARTIDOS];
export const CAMADAS = [...FX.CAMADAS];
export const CIDADES = [...FX.CIDADES];
export const PESSOAS = [...FX.PESSOAS];
export const ESTADOS = { ...FX.ESTADOS };

/** Rampa monocromática do mapa: sete degraus, sem juízo de valor. */
export const RAMPS = [...FX.RAMPS];

/**
 * Valores derivados, quando vêm da API. Vazio significa "ainda não veio
 * da API" — aí calculamos do jeito de sempre.
 */
const historicoRecebido = {};
const camadasRecebidas = {};

function trocarLista(lista, nova) {
  lista.length = 0;
  for (const item of nova) lista.push(item);
}

function trocarObjeto(objeto, novo) {
  for (const chave of Object.keys(objeto)) delete objeto[chave];
  Object.assign(objeto, novo);
}

/* ------------------------------------------------------------- consultas */

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
  return FX.normalizar(texto);
}

/** Remove acentos mantendo caixa — para exibir a busca. */
export function semAcento(texto) {
  return FX.semAcento(texto);
}

/** Nome por extenso de um partido; devolve a sigla se não achar. */
export function nomeDoPartido(sigla) {
  const achado = PARTIDOS.find((p) => p.sigla === sigla);
  return achado ? achado.nome : sigla;
}

/** Cor de um valor na rampa. Null é dado ausente, não o menor valor. */
export function corDoValor(valor, min, max) {
  if (valor === null || valor === undefined) return 'var(--data-neutro)';
  if (max === min) return RAMPS[3];
  const t = (valor - min) / (max - min);
  const idx = Math.min(RAMPS.length - 1, Math.max(0, Math.round(t * (RAMPS.length - 1))));
  return RAMPS[idx];
}

/**
 * Valores de uma camada temática por estado. Vem da API quando ela
 * respondeu; senão, é calculado de forma determinística, como sempre foi.
 */
export function valoresDaCamada(camadaId, siglas) {
  const recebidos = camadasRecebidas[camadaId];
  if (recebidos) {
    const saida = {};
    for (const sigla of siglas) {
      saida[sigla] = recebidos[sigla] ?? { valor: null, semDado: true };
    }
    return saida;
  }
  return FX.valoresDaCamada(camadaId, siglas);
}

/**
 * Série histórica de votação de uma pessoa. Vem da API quando ela
 * respondeu; senão, é repartida pelo mesmo cálculo de sempre.
 */
export function historicoDe(pessoa) {
  const recebida = historicoRecebido[pessoa.id];
  if (recebida) return recebida;
  return FX.historicoDe(pessoa);
}

/* ------------------------------------------------------------------- API */

/**
 * Onde a API está.
 *
 * O servidor escreve esse prefixo no index na hora de servir (`{{BASE}}`).
 * Na raiz do domínio é '/'; em um subdiretório, '/transparencia/'. Sem
 * isso, o app não saberia onde procurar os dados quando não estivesse na
 * raiz.
 */
function baseDaApi() {
  const meta = document.querySelector('meta[name="tp-base"]');
  const bruto = (meta?.content || '/').trim();
  if (!bruto || bruto === '/') return '/';
  return bruto.endsWith('/') ? bruto : `${bruto}/`;
}

const RAIZ_API = baseDaApi();

/** Junta a base da API com um caminho, sem duplicar barra. */
function juntar(base, caminho) {
  const prefixo = base.endsWith('/') ? base : `${base}/`;
  const sufixo = caminho.startsWith('/') ? caminho.slice(1) : caminho;
  return `${prefixo}${sufixo}`;
}

/**
 * Carrega o dataset da API e troca o conteúdo das coleções.
 *
 * Devolve o que aconteceu, sem lançar: quem chama decide o que fazer com a
 * falha. A queda para o dataset embutido é automática.
 */
export async function carregarDaApi({ base = RAIZ_API, timeoutMs = 6000 } = {}) {
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), timeoutMs);

  try {
    const resposta = await fetch(juntar(base, 'api/bootstrap'), {
      signal: controle.signal,
      headers: { Accept: 'application/json' },
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const dados = await resposta.json();
    if (dados.erro) throw new Error(dados.erro);

    const mudou = aplicar(dados);

    estado.origem = 'api';
    estado.carregado = true;
    estado.erro = null;
    estado.mudou = mudou;
    return estado;
  } catch (erro) {
    estado.origem = 'embutido';
    estado.carregado = false;
    estado.erro = erro instanceof Error ? erro.message : String(erro);
    return estado;
  } finally {
    clearTimeout(temporizador);
  }
}

/** Troca o conteúdo das coleções pelo que veio da API. */
function aplicar(dados) {
  // Assinatura do que está em memória agora: serve para saber se o que veio
  // da API é diferente do que já estava na tela. Se for o mesmo (que é o
  // caso normal, porque o reserva é gerado a partir do mesmo dataset), não
  // há o que redesenhar.
  const antes = assinatura();

  if (dados.projeto) Object.assign(PROJETO, dados.projeto);
  if (dados.regioes) trocarObjeto(REGIOES, dados.regioes);
  if (dados.partidos) trocarLista(PARTIDOS, dados.partidos);
  if (dados.camadas) trocarLista(CAMADAS, dados.camadas);
  if (dados.cidades) trocarLista(CIDADES, dados.cidades);
  if (dados.pessoas) trocarLista(PESSOAS, dados.pessoas);
  if (dados.estados) trocarObjeto(ESTADOS, dados.estados);

  for (const chave of Object.keys(historicoRecebido)) delete historicoRecebido[chave];
  for (const chave of Object.keys(camadasRecebidas)) delete camadasRecebidas[chave];

  if (dados.historico) {
    for (const [id, linhas] of Object.entries(dados.historico)) {
      historicoRecebido[id] = linhas;
    }
  }
  if (dados.camadaValores) {
    for (const [id, valores] of Object.entries(dados.camadaValores)) {
      camadasRecebidas[id] = valores;
    }
  }

  return assinatura() !== antes;
}

/**
 * Assinatura do dataset em memória. Precisa ser estável e barata: o
 * dataset é pequeno, então stringify resolve.
 */
function assinatura() {
  return JSON.stringify([
    PROJETO.nome,
    PROJETO.atualizadoEm,
    PARTIDOS,
    CAMADAS,
    CIDADES,
    PESSOAS,
    Object.keys(ESTADOS).sort(),
  ]);
}

/* ------------------------------------------------------------- escritas */

/**
 * Envia um pedido de monitoramento. Devolve { ok, erro }.
 *
 * A chamada nunca derruba a interface: se o servidor não responder, a
 * pessoa ainda recebe a confirmação local — o pedido fica registrado no
 * banco quando o servidor volta.
 */
export async function enviarMonitoramento(dados) {
  return enviar('/monitoramentos', dados);
}

/** Envia uma sugestão ou relato de erro. */
export async function enviarSugestao(dados) {
  return enviar('/sugestoes', dados);
}

async function enviar(caminho, dados) {
  try {
    const resposta = await fetch(juntar(RAIZ_API, `api${caminho}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(dados),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      return { ok: false, erro: corpo.erro || `HTTP ${resposta.status}` };
    }
    return { ok: true, erro: null };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}
