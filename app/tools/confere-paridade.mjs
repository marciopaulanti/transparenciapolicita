#!/usr/bin/env node
/* ============================================================================
   confere-paridade.mjs — o banco e o front-end dizem a mesma coisa?
   ---------------------------------------------------------------------------
   Uso:  node app/tools/confere-paridade.mjs

   O protótipo tem duas fontes de verdade para os mesmos dados: o arquivo
   embutido (`fixtures.js`), que o navegador usa quando a API não responde, e
   o SQLite, que a API serve. Se as duas divergirem, a pessoa vê números
   diferentes dependendo de onde a página foi aberta — e ninguém descobre
   qual dos dois está certo.

   Este script compara os dois lado a lado e falha na primeira diferença.
   ========================================================================== */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as FX from '../js/data/fixtures.js';
import { MAP_STATES } from '../js/data/br-map.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* --------------------------------------------- sobe a API em porta solta -- */

function executar(comando, argumentos, opcoes = {}) {
  return new Promise((resolva, rejeite) => {
    const processo = spawn(comando, argumentos, {
      cwd: RAIZ,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opcoes,
    });
    let saida = '';
    let erro = '';
    processo.stdout.on('data', (trecho) => {
      saida += trecho;
    });
    processo.stderr.on('data', (trecho) => {
      erro += trecho;
    });
    processo.on('close', (codigo) => {
      if (codigo === 0) resolva({ saida, erro });
      else rejeite(new Error(`${comando} saiu com ${codigo}\n${erro}`));
    });
  });
}

const porta = 8900 + Math.floor(Math.random() * 400);
const temporario = mkdtempSync(join(tmpdir(), 'tp-paridade-'));
const caminhoBanco = join(temporario, 'teste.sqlite');

const servidor = spawn('python3', ['-m', 'server.app'], {
  cwd: RAIZ,
  env: {
    ...process.env,
    TP_PORT: String(porta),
    TP_DB_PATH: caminhoBanco,
    TP_AUDITORIA: '0',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});

let logServidor = '';
servidor.stderr.on('data', (trecho) => {
  logServidor += trecho;
});

async function esperarServidor(tentativas = 60) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (resposta.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu.\n${logServidor}`);
}

/* ---------------------------------------------------------- comparação -- */

const problemas = [];

function comparar(caminho, esperado, obtido) {
  const esperadoTexto = JSON.stringify(esperado);
  const obtidoTexto = JSON.stringify(obtido);
  if (esperadoTexto !== obtidoTexto) {
    // Mostra onde diverge, não só que diverge.
    let indice = 0;
    while (
      indice < esperadoTexto.length &&
      indice < obtidoTexto.length &&
      esperadoTexto[indice] === obtidoTexto[indice]
    ) {
      indice += 1;
    }
    const janela = (texto) => texto.slice(Math.max(0, indice - 60), indice + 90);
    problemas.push(
      `${caminho}\n    esperado: ...${janela(esperadoTexto)}\n    obtido:   ...${janela(obtidoTexto)}`,
    );
  }
}

function ordenarPorNome(lista) {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/* -------------------------------------------------------------- execução -- */

let codigoSaida = 0;

try {
  await executar('python3', ['-m', 'server.seed', '--reconstruir'], {
    env: { ...process.env, TP_DB_PATH: caminhoBanco },
  });

  await esperarServidor();

  const resposta = await fetch(`http://127.0.0.1:${porta}/api/bootstrap`);
  const dados = await resposta.json();

  if (dados.erro) throw new Error(`API respondeu com erro: ${dados.erro}`);

  // --- projeto ---
  comparar('projeto.nome', FX.PROJETO.nome, dados.projeto.nome);
  comparar('projeto.tagline', FX.PROJETO.tagline, dados.projeto.tagline);
  comparar('projeto.fontePadrao', FX.PROJETO.fontePadrao, dados.projeto.fontePadrao);
  comparar('projeto.atualizadoEm', FX.PROJETO.atualizadoEm, dados.projeto.atualizadoEm);

  // --- entidades de lista ---
  comparar('partidos', FX.PARTIDOS, dados.partidos);
  comparar('camadas', FX.CAMADAS, dados.camadas);
  comparar('cidades', FX.CIDADES, dados.cidades);
  comparar('regioes', FX.REGIOES, dados.regioes);

  // --- estados ---
  for (const [sigla, esperado] of Object.entries(FX.ESTADOS)) {
    const obtido = dados.estados[sigla];
    if (!obtido) {
      problemas.push(`estados.${sigla}: ausente na API`);
      continue;
    }
    comparar(`estados.${sigla}.nome`, esperado.nome, obtido.nome);
    comparar(`estados.${sigla}.regiao`, esperado.regiao, obtido.regiao);
    comparar(`estados.${sigla}.lema`, esperado.lema, obtido.lema);
    comparar(`estados.${sigla}.bancada`, esperado.bancada, obtido.bancada);
  }
  const siglasApi = Object.keys(dados.estados).sort();
  const siglasMapa = MAP_STATES.map((e) => e.sigla).sort();
  comparar('estados: conjunto de siglas do mapa', siglasMapa, siglasApi);

  // --- pessoas ---
  const porNomeFixture = new Map(FX.PESSOAS.map((p) => [p.id, p]));
  const porNomeApi = new Map(dados.pessoas.map((p) => [p.id, p]));
  comparar('pessoas: conjunto de ids', [...porNomeFixture.keys()].sort(), [...porNomeApi.keys()].sort());

  for (const [id, esperado] of porNomeFixture) {
    const obtido = porNomeApi.get(id);
    if (!obtido) {
      problemas.push(`pessoas.${id}: ausente na API`);
      continue;
    }
    for (const campo of [
      'nome', 'cargo', 'cargoTipo', 'esfera', 'uf', 'municipio', 'partido',
      'situacao', 'titular', 'mandato', 'ultimoPleito', 'votacao', 'presenca',
      'patrimonio', 'cota', 'comissoes',
    ]) {
      comparar(`pessoas.${id}.${campo}`, esperado[campo], obtido[campo]);
    }
    // A ordem das listas aninhadas é a ordem de exibição: precisa bater.
    comparar(`pessoas.${id}.propostas`, esperado.propostas, obtido.propostas);
    comparar(`pessoas.${id}.emendas`, esperado.emendas, obtido.emendas);
    comparar(`pessoas.${id}.campanha`, esperado.campanha, obtido.campanha);

    // O motivo da lacuna é a regra central do projeto.
    for (const campo of ['presencaMotivo', 'patrimonioMotivo', 'cotaMotivo']) {
      comparar(`pessoas.${id}.${campo}`, esperado[campo], obtido[campo]);
    }
  }

  // --- valores de camada e série histórica ---
  const siglas = MAP_STATES.map((estado) => estado.sigla);
  for (const camada of FX.CAMADAS) {
    const esperado = FX.valoresDaCamada(camada.id, siglas);
    const obtido = dados.camadaValores[camada.id] ?? {};
    for (const sigla of siglas) {
      comparar(`camadaValores.${camada.id}.${sigla}.valor`, esperado[sigla].valor, obtido[sigla]?.valor);
      comparar(
        `camadaValores.${camada.id}.${sigla}.semDado`,
        esperado[sigla].semDado,
        obtido[sigla]?.semDado,
      );
    }
  }

  for (const pessoa of FX.PESSOAS) {
    comparar(`historico.${pessoa.id}`, FX.historicoDe(pessoa), dados.historico[pessoa.id]);
  }

  // --- rotas de leitura ---
  const comparacao = await (
    await fetch(`http://127.0.0.1:${porta}/api/comparar?p=marina-caldeira,otavio-bezerra`)
  ).json();
  comparar(
    'api/comparar: ordem preservada',
    ['marina-caldeira', 'otavio-bezerra'],
    comparacao.pessoas.map((p) => p.id),
  );

  const busca = await (await fetch(`http://127.0.0.1:${porta}/api/busca?q=recife`)).json();
  if (!busca.cidades.some((c) => c.nome === 'Recife')) {
    problemas.push('api/busca: "recife" (sem acento) não encontrou Recife');
  }

  const estatisticas = await (await fetch(`http://127.0.0.1:${porta}/api/estatisticas`)).json();
  if (estatisticas.pessoas !== FX.PESSOAS.length) {
    problemas.push(
      `api/estatisticas: ${estatisticas.pessoas} pessoas, esperado ${FX.PESSOAS.length}`,
    );
  }
} catch (erro) {
  problemas.push(`falha na execução: ${erro.message}`);
} finally {
  servidor.kill('SIGTERM');
  rmSync(temporario, { recursive: true, force: true });
}

/* ---------------------------------------------------------------- saída -- */

if (problemas.length) {
  console.error(`Paridade falhou: ${problemas.length} diferença(s) entre o banco e o front-end.\n`);
  for (const problema of problemas) {
    console.error(`  - ${problema}\n`);
  }
  codigoSaida = 1;
} else {
  console.log(
    `Paridade confirmada: banco e front-end dizem a mesma coisa ` +
      `(${FX.PESSOAS.length} pessoas, ${Object.keys(FX.ESTADOS).length} estados, ` +
      `${FX.CAMADAS.length} camadas).`,
  );
}

process.exit(codigoSaida);
