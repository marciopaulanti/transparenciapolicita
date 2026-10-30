/* ============================================================================
   navegador-cdp.mjs — validação no navegador sem nenhuma dependência
   ---------------------------------------------------------------------------
   O smoke.mjs historicamente dependia do Playwright instalado. Em máquina sem
   Playwright, a parte de navegador era pulada. Este módulo resolve isso: fala
   com o Chrome do sistema pelo DevTools Protocol (CDP), usando só a
   biblioteca padrão do Node (o WebSocket global existe a partir do Node 22).

   O que ele faz:
     • sobe o servidor estático (se nenhum estiver respondendo na base);
     • abre o Chrome headless com uma porta de depuração efêmera;
     • carrega cada rota em um documento novo (query ?cb=N força recarregar,
       evitando o cache de módulos ES entre rotas);
     • coleta erro de console, exceção de página, requisição falha e resposta
       4xx/5xx;
     • mede, por rota: elementos h1, tela vazia, rolagem horizontal, overlay
       residual (sheet/dialog) e referências ARIA quebradas.

   Se não houver Chrome no sistema, devolve null e o smoke.mjs avisa.
   ========================================================================== */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CANDIDATOS_CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

export function temChrome() {
  return CANDIDATOS_CHROME.some((caminho) => existsSync(caminho));
}

/* ------------------------------------------------------------- servidor */

function portaLivre() {
  return new Promise((resolver) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolver(port));
    });
  });
}

async function responder(url, tentativas = 40) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/**
 * Devolve uma base URL com servidor no ar. Se já houver algo respondendo na
 * base pedida, reaproveita; senão sobe o servidor do próprio projeto numa
 * porta livre.
 *
 * `comApi = true` sobe o servidor de verdade (estáticos + API JSON), que é a
 * topologia de produção. Sem esse modo, o smoke levanta o servidor estático
 * puro e a chamada /api/bootstrap responde 404 — o que faria toda validação
 * de API parecer quebrada.
 */
export async function subirServidor(base, { comApi = false, basePath = '/' } = {}) {
  if (await responder(base, 3)) return { base, encerrar: () => {} };

  const porta = await portaLivre();
  const proc = comApi
    ? spawn('python3', ['-m', 'server.app'], {
        cwd: RAIZ,
        env: { ...process.env, TP_PORT: String(porta), TP_BASE_PATH: basePath },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    : spawn('python3', [join(RAIZ, 'app', 'tools', 'serve.py'), String(porta)], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
  const nova = `http://127.0.0.1:${porta}`;
  const ok = await responder(nova);
  if (!ok) {
    proc.kill();
    throw new Error('não foi possível subir o servidor');
  }
  return {
    base: nova,
    encerrar: () => {
      proc.kill();
    },
  };
}

/* --------------------------------------------------------- cliente CDP */

class Cliente {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pendentes = new Map();
    this.ouvintes = new Map();

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined) {
        const p = this.pendentes.get(msg.id);
        if (!p) return;
        this.pendentes.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.rejeitar(new Error(msg.error.message));
        else p.resolver(msg.result);
        return;
      }
      for (const fn of this.ouvintes.get(msg.method) || []) fn(msg.params, msg.sessionId);
    });
  }

  enviar(method, params = {}, sessionId) {
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolver, rejeitar) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        rejeitar(new Error(`tempo esgotado em ${method}`));
      }, 25000);
      this.pendentes.set(id, { resolver, rejeitar, timer });
      this.ws.send(JSON.stringify(payload));
    });
  }

  on(method, fn) {
    if (!this.ouvintes.has(method)) this.ouvintes.set(method, []);
    this.ouvintes.get(method).push(fn);
  }

  off(method, fn) {
    const lista = this.ouvintes.get(method) || [];
    const i = lista.indexOf(fn);
    if (i >= 0) lista.splice(i, 1);
  }
}

function esperarEvento(cliente, method, timeout = 25000) {
  return new Promise((resolver, rejeitar) => {
    const fn = (params) => {
      clearTimeout(timer);
      cliente.off(method, fn);
      resolver(params);
    };
    const timer = setTimeout(() => {
      cliente.off(method, fn);
      rejeitar(new Error(`tempo esgotado esperando ${method}`));
    }, timeout);
    cliente.on(method, fn);
  });
}

/* -------------------------------------------------------------- inspeção */

const EXPRESSAO_INSPECAO = `(() => {
  const saida = document.querySelector('#view');
  const h1 = document.querySelectorAll('h1');
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => a.getAttribute('href'))
    .filter(h => h && h.startsWith('#'));
  const quebrados = [];
  document.querySelectorAll('[aria-labelledby],[aria-controls],[aria-describedby],[aria-activedescendant]')
    .forEach(el => {
      ['aria-labelledby','aria-controls','aria-describedby','aria-activedescendant'].forEach(attr => {
        const valor = el.getAttribute(attr);
        if (!valor) return;
        valor.split(/\\s+/).filter(Boolean).forEach(id => {
          if (!document.getElementById(id)) quebrados.push(attr + ' -> #' + id);
        });
      });
    });
  const sheet = document.getElementById('sheet-root');
  const dialog = document.getElementById('dialog-root');
  return {
    vazio: !saida || saida.innerHTML.trim().length < 50,
    h1: h1.length,
    texto: (saida && saida.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    links: links,
    quebrados: quebrados,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    overlay: (sheet && !sheet.hasAttribute('hidden')) || (dialog && !dialog.hasAttribute('hidden')),
    sheetAberto: !!(sheet && !sheet.hasAttribute('hidden')),
    dialogAberto: !!(dialog && !dialog.hasAttribute('hidden')),
  };
})()`;

/* ------------------------------------------------------------- navegador */

/**
 * Roda as rotas no Chrome do sistema. Devolve { modo, registros } com um
 * registro por rota, ou null se não houver Chrome disponível.
 *
 * `largurasExtras` repete a varredura em outras larguras de viewport: é o
 * que pega rolagem horizontal em celular, que só aparece no layout estreito.
 */
/**
 * Junta a base e o prefixo sem barra duplicada no meio.
 * 'https://exemplo.com/transparenciapolicita/' + '/' -> 'https://exemplo.com/transparenciapolicita/'
 */
export function montarUrl(base, prefixo = '/') {
  const semBarra = base.replace(/\/+$/, '');
  const cauda = prefixo.startsWith('/') ? prefixo : `/${prefixo}`;
  return `${semBarra}${cauda}`;
}

export async function navegarComChrome({
  base,
  rotas,
  prefixo = '/',
  largura = 1280,
  altura = 900,
  largurasExtras = [],
  rotasEstreitas = [],
}) {
  const binario = CANDIDATOS_CHROME.find((c) => existsSync(c));
  if (!binario) return null;

  const perfil = mkdtempSync(join(tmpdir(), 'tp-smoke-'));
  const proc = spawn(
    binario,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${perfil}`,
      `--window-size=${largura},${altura}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let cliente;
  try {
    const wsUrl = await new Promise((resolver, rejeitar) => {
      let buffer = '';
      const timer = setTimeout(
        () => rejeitar(new Error('o Chrome não abriu a porta de depuração')),
        25000,
      );
      proc.stderr.on('data', (dado) => {
        buffer += dado.toString();
        const m = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) {
          clearTimeout(timer);
          resolver(m[1]);
        }
      });
      proc.on('exit', (codigo) => {
        clearTimeout(timer);
        rejeitar(new Error(`o Chrome saiu com código ${codigo}`));
      });
    });

    const ws = new WebSocket(wsUrl);
    await new Promise((resolver, rejeitar) => {
      ws.addEventListener('open', resolver, { once: true });
      ws.addEventListener('error', () => rejeitar(new Error('conexão CDP recusada')), { once: true });
    });
    cliente = new Cliente(ws);

    const { targetId } = await cliente.enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cliente.enviar('Target.attachToTarget', { targetId, flatten: true });

    await cliente.enviar('Page.enable', {}, sessionId);
    await cliente.enviar('Runtime.enable', {}, sessionId);
    await cliente.enviar('Log.enable', {}, sessionId);
    await cliente.enviar('Network.enable', {}, sessionId);
    await cliente.enviar(
      'Emulation.setDeviceMetricsOverride',
      { width: largura, height: altura, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );

    const erros = [];
    const requisicoes = new Map();

    cliente.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails || {};
      erros.push(`exceção: ${(d.exception && d.exception.description) || d.text || 'erro desconhecido'}`);
    });
    cliente.on('Runtime.consoleAPICalled', (p) => {
      if (p.type !== 'error' && p.type !== 'assert') return;
      const texto = (p.args || [])
        .map((a) => (a.value !== undefined ? a.value : a.description || a.type))
        .join(' ');
      erros.push(`console: ${texto}`);
    });
    cliente.on('Log.entryAdded', (p) => {
      const e = p.entry || {};
      if (e.level !== 'error') return;
      if (e.source === 'network') return; // tratado pela camada de rede
      erros.push(`log: ${e.text}`);
    });
    cliente.on('Network.requestWillBeSent', (p) => {
      requisicoes.set(p.requestId, p.request.url);
    });
    cliente.on('Network.loadingFailed', (p) => {
      const url = requisicoes.get(p.requestId) || '';
      if (url.includes('favicon')) return;
      erros.push(`requisição falhou: ${url} (${p.errorText})`);
    });
    cliente.on('Network.responseReceived', (p) => {
      const url = p.response.url || '';
      if (p.response.status >= 400 && !url.includes('favicon')) {
        erros.push(`resposta ${p.response.status}: ${url}`);
      }
    });

    const registros = [];
    const inspecionar = async () => {
      const resposta = await cliente.enviar(
        'Runtime.evaluate',
        { expression: EXPRESSAO_INSPECAO, returnByValue: true },
        sessionId,
      );
      if (resposta.exceptionDetails) {
        return {
          estado: {
            vazio: true,
            h1: 0,
            links: [],
            quebrados: [],
            overflow: false,
            overlay: false,
            sheetAberto: false,
            dialogAberto: false,
          },
          erro: `falha ao inspecionar: ${JSON.stringify(resposta.exceptionDetails).slice(0, 200)}`,
        };
      }
      return { estado: resposta.result.value, erro: null };
    };

    const visitar = async (url) => {
      const carregou = esperarEvento(cliente, 'Page.loadEventFired');
      await cliente.enviar('Page.navigate', { url }, sessionId);
      await carregou;
      await new Promise((r) => setTimeout(r, 260));
    };

    for (let i = 0; i < rotas.length; i += 1) {
      const rota = rotas[i];
      erros.length = 0;
      // ?cb= força documento novo a cada rota: sem isso o navegador reaproveita
      // a mesma página e o cache de módulos ES mascara erro de import.
      await visitar(`${montarUrl(base, prefixo)}?cb=${i}#${rota}`);

      const { estado, erro } = await inspecionar();
      const errosDaRota = erro ? [erro] : [...erros];
      registros.push({ rota, estado, erros: errosDaRota });
    }

    // as telas principais, agora em larguras estreitas: é onde aparece
    // rolagem horizontal, que no desktop não existe
    for (const estreita of largurasExtras) {
      await cliente.enviar(
        'Emulation.setDeviceMetricsOverride',
        { width: estreita, height: altura, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      for (const rota of rotasEstreitas) {
        erros.length = 0;
        await visitar(
          `${montarUrl(base, prefixo)}?cb=${estreita}-${rotasEstreitas.indexOf(rota)}#${rota}`,
        );
        const medida = await inspecionar();
        registros.push({
          rota: `${rota} @${estreita}px`,
          estado: medida.estado,
          erros: medida.erro ? [medida.erro] : [...erros],
        });
      }
    }

    await cliente.enviar(
      'Emulation.setDeviceMetricsOverride',
      { width: largura, height: altura, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );

    try {
      ws.close();
    } catch {
      /* encerrando */
    }
    return { modo: 'chrome-cdp', registros };
  } finally {
    try {
      proc.kill();
    } catch {
      /* encerrando */
    }
    try {
      rmSync(perfil, { recursive: true, force: true });
    } catch {
      /* limpando */
    }
  }
}
