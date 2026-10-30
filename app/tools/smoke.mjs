/* ============================================================================
   smoke.mjs — varredura automatizada de todas as telas
   ---------------------------------------------------------------------------
   Uso:  node app/tools/smoke.mjs [base]

   Abre cada rota no navegador e falha se houver qualquer erro de console,
   exceção de página, requisição falha ou link quebrado. É a rede de
   segurança que pegaria o tipo de bug que existe apenas num caminho não
   listado à mão.

   O navegador pode ser o Playwright (se estiver instalado) ou o Chrome do
   próprio sistema, falado pelo DevTools Protocol — sem nenhuma dependência.
   Se nenhum dos dois existir, o script valida o que dá para validar sem
   navegador (sintaxe dos módulos e links internos do HTML).
   ========================================================================== */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { navegarComChrome, subirServidor, temChrome } from './navegador-cdp.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// `--subpath` confere a mesma coisa com o app publicado em um subdiretório
// (/transparencia/ em vez de /). A publicação em subpasta é um caminho
// diferente de fato: os endereços dos arquivos mudam de lugar, e é aí que
// um link relativo quebrado apareceria.
const ARGUMENTOS = process.argv.slice(2);
const EM_SUBPATH = ARGUMENTOS.includes('--subpath');
const BASE = ARGUMENTOS.find((arg) => arg.startsWith('http')) || 'http://localhost:8765';
const PREFIXO = EM_SUBPATH ? '/transparencia/' : '/';

const ROTAS = [
  '/',
  '/?assunto=escolas',
  '/me',
  '/me?cidade=Recife',
  '/me?cidade=Salvador',
  '/me?uf=SP',
  '/uf/SP',
  '/uf/MG',
  '/uf/PE',
  '/uf/AM',
  '/p/marina-caldeira',
  '/p/otavio-bezerra',
  '/p/cleo-antunes',
  '/p/celso-braganca',
  '/comparar',
  '/comparar?p=marina-caldeira,otavio-bezerra',
  '/comparar?p=marina-caldeira,otavio-bezerra,cleo-antunes',
  '/quem',
  '/quem?cargo=vereador',
  '/quem?uf=SP&letra=M',
  '/sobre',
  '/ajuda',
  '/rota-que-nao-existe',
];

/** Telas principais: as que valem a medida em telas estreitas. */
const ROTAS_PRINCIPAIS = [
  '/',
  '/me',
  '/me?cidade=Recife',
  '/uf/SP',
  '/p/marina-caldeira',
  '/comparar',
  '/quem',
  '/sobre',
];

function modulos(dir) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...modulos(caminho));
    else if (nome.endsWith('.js')) achados.push(caminho);
  }
  return achados;
}

/* ---------------------------------------------- 1. sem navegador: estático */

/**
 * Nomes declarados em qualquer módulo do projeto: exports, imports e
 * declarações locais. Serve para detectar a classe de bug "identificador
 * não definido", que só aparece em runtime e só num caminho específico.
 */
function nomesDeclarados() {
  const declarados = new Set();
  for (const caminho of modulos(join(RAIZ, 'app', 'js'))) {
    const fonte = readFileSync(caminho, 'utf8');
    for (const m of fonte.matchAll(/export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
      declarados.add(m[1]);
    }
    for (const m of fonte.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const nome of m[1].split(',')) {
        const limpo = nome.split(/\s+as\s+/).pop().trim();
        if (limpo) declarados.add(limpo);
      }
    }
    for (const m of fonte.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      for (const nome of m[1].split(',')) {
        const limpo = nome.split(/\s+as\s+/).pop().trim();
        if (limpo) declarados.add(limpo);
      }
    }
    for (const m of fonte.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
      declarados.add(m[1]);
    }
  }
  return declarados;
}

/**
 * Remove literais de texto do código, para que a varredura de
 * identificadores olhe só nomes de código (e não "PSD", "BRL" ou os
 * comandos de caminho do SVG).
 */
function semLiterais(fonte) {
  return fonte
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Globais do JavaScript, em caixa alta. Não são do projeto — são da
 * linguagem — mas a varredura de identificadores não sabe a diferença.
 */
const GLOBAIS_NATIVOS = new Set([
  'JSON',
  'URL',
  'URLSearchParams',
  'Math',
  'Date',
  'Number',
  'String',
  'Object',
  'Array',
  'Promise',
  'Error',
  'TypeError',
  'SyntaxError',
  'RangeError',
  'Infinity',
  'NaN',
  'undefined',
  'null',
  'true',
  'false',
]);

function checarEstatico() {
  const problemas = [];
  const declarados = nomesDeclarados();

  for (const caminho of modulos(join(RAIZ, 'app', 'js'))) {
    const fonte = readFileSync(caminho, 'utf8');
    // imports relativos precisam existir
    for (const m of fonte.matchAll(/from\s+'(\.[^']+)'/g)) {
      const alvo = resolve(dirname(caminho), m[1]);
      try {
        statSync(alvo);
      } catch {
        problemas.push(`import quebrado em ${caminho.replace(RAIZ + '/', '')}: ${m[1]}`);
      }
    }
    // caracteres fora do repertório latino não pertencem a este projeto
    if (/[　-鿿가-힯]/.test(fonte)) {
      problemas.push(`caractere não latino em ${caminho.replace(RAIZ + '/', '')}`);
    }
    // marcadores esquecidos
    for (const marca of ['TODO', 'FIXME', 'XXX', 'PLACEHOLDER', 'Lorem ipsum']) {
      if (fonte.includes(marca)) {
        problemas.push(`marcador "${marca}" em ${caminho.replace(RAIZ + '/', '')}`);
      }
    }

    // constantes maiúsculas usadas mas nunca declaradas no projeto
    const codigo = semLiterais(fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
    for (const m of codigo.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      const nome = m[1];
      if (!declarados.has(nome) && !GLOBAIS_NATIVOS.has(nome)) {
        problemas.push(`identificador não definido "${nome}" em ${caminho.replace(RAIZ + '/', '')}`);
      }
    }
  }

  // ids do index.html referenciados por aria-controls / for
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/aria-controls="([^"]+)"/g)) {
    if (!ids.has(m[1])) problemas.push(`aria-controls aponta para id inexistente: ${m[1]}`);
  }
  for (const m of html.matchAll(/\sfor="([^"]+)"/g)) {
    if (!ids.has(m[1])) problemas.push(`label for aponta para id inexistente: ${m[1]}`);
  }

  return problemas;
}

/* ------------------------------------------------- 2. com navegador: rotas */

/** Rotas conhecidas: um link interno precisa apontar para uma delas. */
const ROTAS_CONHECIDAS = ['/', '/me', '/uf', '/p', '/comparar', '/quem', '/sobre', '/ajuda'];

/**
 * Rotas que abrem um overlay de propósito ao carregar (a busca de cidade ou
 * estado mostra os resultados numa sheet). Fora destas, nenhuma tela pode
 * deixar sheet ou dialog por cima: seria resíduo da tela anterior.
 */
const OVERLAYS_ESPERADOS = new Set(['/me?cidade=Recife', '/me?cidade=Salvador', '/me?uf=SP']);

/**
 * Regras aplicadas a cada rota, idênticas para qualquer navegador.
 * Recebe o registro { rota, estado, erros } e devolve os problemas.
 */
function avaliar(registros) {
  const problemas = [];
  for (const { rota, estado, erros } of registros) {
    // "@320px" é a mesma rota medida numa tela estreita
    const base = rota.split(' @')[0];
    if (estado.vazio) problemas.push(`${rota}: tela vazia`);
    if (estado.h1 !== 1) problemas.push(`${rota}: ${estado.h1} elementos h1 (esperado 1)`);
    if (estado.overflow) problemas.push(`${rota}: rolagem horizontal`);
    if (OVERLAYS_ESPERADOS.has(base)) {
      if (!estado.sheetAberto) problemas.push(`${rota}: a sheet de resultados não abriu`);
    } else if (estado.overlay) {
      problemas.push(`${rota}: overlay residual (sheet ou dialog)`);
    }
    for (const quebrado of estado.quebrados || []) {
      problemas.push(`${rota}: referência ARIA quebrada (${quebrado})`);
    }
    for (const e of erros) problemas.push(`${rota}: ${e}`);

    // links internos precisam apontar para uma rota existente
    for (const href of new Set(estado.links || [])) {
      const destino = href.replace(/^#/, '').split('#')[0].split('?')[0];
      if (!destino) continue;
      // âncora dentro da própria página ("#view" do link pular para o
      // conteúdo) não é rota: o roteador nunca deve interpretá-la.
      if (!destino.startsWith('/')) continue;
      const segmentos = destino.split('/').filter(Boolean);
      const cabem = segmentos.length === 0 || ROTAS_CONHECIDAS.includes('/' + segmentos[0]);
      if (!cabem) problemas.push(`${rota}: link aponta para rota inexistente ${href}`);
    }
  }
  return problemas;
}

/* -------------------------------------------------------- 2a. Playwright */

async function checarComPlaywright() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return null; // Playwright não está disponível neste ambiente
  }

  // Com API: é a topologia de produção (estáticos + JSON na mesma porta).
  const servidor = await subirServidor(BASE, { comApi: true, basePath: PREFIXO });

  const browser = await chromium.launch();
  const pagina = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const erros = [];
  pagina.on('pageerror', (e) => erros.push(`exceção: ${e.message}`));
  pagina.on('console', (m) => {
    if (m.type() === 'error') erros.push(`console: ${m.text()}`);
  });
  pagina.on('requestfailed', (r) => {
    const url = r.url();
    if (url.includes('favicon')) return;
    erros.push(`requisição falhou: ${url}`);
  });

  const registros = [];
  for (const rota of ROTAS) {
    erros.length = 0;
    await pagina.goto(`${servidor.base}${PREFIXO}?cb=${registros.length}#${rota}`, {
      waitUntil: 'load',
    });
    await pagina.waitForTimeout(700);

    const estado = await pagina.evaluate(() => {
      const saida = document.querySelector('#view');
      const h1 = document.querySelectorAll('h1');
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && h.startsWith('#'));
      const quebrados = [];
      document
        .querySelectorAll('[aria-labelledby],[aria-controls],[aria-describedby],[aria-activedescendant]')
        .forEach((el) => {
          ['aria-labelledby', 'aria-controls', 'aria-describedby', 'aria-activedescendant'].forEach(
            (attr) => {
              const valor = el.getAttribute(attr);
              if (!valor) return;
              valor.split(/\s+/).filter(Boolean).forEach((id) => {
                if (!document.getElementById(id)) quebrados.push(`${attr} -> #${id}`);
              });
            },
          );
        });
      const sheet = document.getElementById('sheet-root');
      const dialog = document.getElementById('dialog-root');
      return {
        vazio: !saida || saida.innerHTML.trim().length < 50,
        h1: h1.length,
        texto: (saida?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        links,
        quebrados,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        overlay:
          (sheet && !sheet.hasAttribute('hidden')) || (dialog && !dialog.hasAttribute('hidden')),
        sheetAberto: !!(sheet && !sheet.hasAttribute('hidden')),
        dialogAberto: !!(dialog && !dialog.hasAttribute('hidden')),
      };
    });

    registros.push({ rota, estado, erros: [...erros] });
  }

  await browser.close();
  servidor.encerrar();
  return { modo: 'playwright', registros };
}

/* --------------------------------------- 2b. Chrome do sistema via CDP */

async function checarComChrome() {
  if (!temChrome()) return null;
  // Com API: é a topologia de produção (estáticos + JSON na mesma porta).
  const servidor = await subirServidor(BASE, { comApi: true, basePath: PREFIXO });
  try {
    const resultado = await navegarComChrome({
      base: servidor.base,
      prefixo: PREFIXO,
      rotas: ROTAS,
      largurasExtras: [320, 390, 768],
      rotasEstreitas: ROTAS_PRINCIPAIS,
    });
    return resultado;
  } finally {
    servidor.encerrar();
  }
}

async function checarNavegador() {
  const viaPlaywright = await checarComPlaywright();
  if (viaPlaywright) return viaPlaywright;
  return checarComChrome();
}

/* ------------------------------------------------------------------- run */

const estaticos = checarEstatico();
const navegador = await checarNavegador();

let problemas = [...estaticos];
if (navegador === null) {
  console.log('Nenhum navegador disponível (Playwright ou Chrome): só a checagem estática rodou.');
} else {
  console.log(
    `Telas verificadas: ${navegador.registros.length} em ${ROTAS.length} rotas (navegador: ${navegador.modo})`,
  );
  problemas = problemas.concat(avaliar(navegador.registros));
}

if (problemas.length) {
  console.error(`\n${problemas.length} problema(s):`);
  for (const p of problemas) console.error('  · ' + p);
  process.exit(1);
}
console.log('Tudo certo: nenhuma falha de estática, rota ou console.');
