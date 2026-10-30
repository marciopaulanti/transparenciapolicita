#!/usr/bin/env node
/* ============================================================================
   export-dataset.mjs — materializa o dataset do protótipo em JSON
   ---------------------------------------------------------------------------
   Uso:  node app/tools/export-dataset.mjs [--saida db/data/dataset.json]

   O `fixtures.js` é a fonte de verdade do dataset de demonstração: é ele que
   o front-end usa quando a API não responde. Este script exporta esse mesmo
   conteúdo para JSON, incluindo os valores derivados (camadas do mapa e série
   histórica de votos), para que o banco receba exatamente os mesmos números
   — sem divergência entre o que roda no navegador e o que está no SQLite.

   Como os valores derivados são calculados pelos mesmos funções do
   `fixtures.js`, o resultado é determinístico: rodar duas vezes dá o mesmo
   arquivo byte a byte.
   ========================================================================== */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as FX from '../js/data/fixtures.js';
import { MAP_STATES } from '../js/data/br-map.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const argSaida = process.argv.indexOf('--saida');
const destino = resolve(
  RAIZ,
  argSaida > -1 ? process.argv[argSaida + 1] : 'db/data/dataset.json',
);

/* ------------------------------------------- valores derivados por camada */

const siglas = MAP_STATES.map((estado) => estado.sigla);

const camadaValores = {};
for (const camada of FX.CAMADAS) {
  camadaValores[camada.id] = FX.valoresDaCamada(camada.id, siglas);
}

/* ----------------------------------------------- série histórica por pessoa */

const historico = {};
for (const pessoa of FX.PESSOAS) {
  historico[pessoa.id] = FX.historicoDe(pessoa);
}

/* --------------------------------------------------------------- montagem */

const dataset = {
  geradoEm: new Date().toISOString(),
  aviso:
    'DATOS FICTÍCIOS. Pessoas, partidos, votos, orçamentos, emendas e ' +
    'cargos foram inventados para demonstração. A geometria dos estados é ' +
    'real; os números não são.',
  projeto: FX.PROJETO,
  regioes: FX.REGIOES,
  partidos: FX.PARTIDOS,
  camadas: FX.CAMADAS,
  estados: FX.ESTADOS,
  cidades: FX.CIDADES,
  pessoas: FX.PESSOAS,
  camadaValores,
  historico,
};

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

const tamanho = (new TextEncoder().encode(JSON.stringify(dataset)).length / 1024).toFixed(1);
console.log(`Dataset exportado: ${destino}`);
console.log(
  `  ${dataset.pessoas.length} pessoas · ${dataset.partidos.length} partidos · ` +
    `${Object.keys(dataset.estados).length} estados · ${dataset.cidades.length} cidades · ` +
    `${dataset.camadas.length} camadas · ${tamanho} KB`,
);
