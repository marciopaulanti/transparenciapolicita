/* ============================================================================
   router.js — roteador por hash
   ---------------------------------------------------------------------------
   · Cada tela declara título (para o anúncio do leitor de tela) e HTML.
   · A troca de tela é um cross-fade curto: sai, entra. Sem animação de
     movimento quando a pessoa pediu menos movimento.
   · O foco vai para o título da tela nova, para que teclado e leitor de tela
     continuem no contexto certo.
   ========================================================================== */

const routes = [];
let outlet = null;
let announcer = null;
let currentView = null;
let navToken = 0;

// Ganchos disparados no começo de cada troca de tela. É aqui que camadas
// por cima da página (sheet, modal) são dispensadas: mudar de tela com uma
// sheet aberta deixaria a camada cobrindo a tela nova.
const beforeRoute = [];

// Posição de rolagem por tela, para que voltar pelo histórico devolva a
// pessoa ao ponto exato onde ela estava — e para que uma tela nova sempre
// comece no topo, como no iOS.
const scrollMemory = new Map();
let lastPath = null;
let lastFragment = '';
let pendingRestore = false;
// A primeira renderização é a abertura do site. Nela o foco NÃO é levado ao
// título: o foco precisa continuar no começo do documento, senão o primeiro
// Tab já cai no meio do conteúdo e o link "pular para o conteúdo" e o menu do
// topo ficam inalcançáveis pelo Tab. A partir da segunda navegação sim.
let primeiraRenderizacao = true;

export function defineRoutes(list) {
  routes.length = 0;
  routes.push(...list);
}

/**
 * Registra uma função a ser chamada antes de cada troca de tela.
 * Usada para dispensar camadas por cima da página (sheet, modal).
 */
export function onBeforeNavigate(fn) {
  beforeRoute.push(fn);
}

export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  // A rota pode trazer um alvo dentro da tela: "#/sobre#faltando".
  // A parte depois do "#" é o fragmento, não parte do caminho.
  const [semFragmento, fragmento = ''] = raw.split('#');
  const [pathPart, queryPart = ''] = semFragmento.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  new URLSearchParams(queryPart).forEach((value, key) => {
    query[key] = value;
  });
  return { path: '/' + segments.join('/'), segments, query, fragment: fragmento };
}

function match(segments) {
  for (const route of routes) {
    const parts = route.path.split('/').filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segments[i]);
      } else if (part !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (window.location.hash === target) {
    render();
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
    render();
  } else {
    window.location.hash = target;
  }
}

async function render() {
  const token = ++navToken;

  // Um hash que não é uma rota do app (por exemplo "#view", vindo do link
  // "pular para o conteúdo" rodando sem JavaScript) não pode virar uma tela
  // de erro. Na abertura ele vira a tela inicial; depois, é ignorado.
  const hashCru = window.location.hash;
  if (hashCru && hashCru !== '#' && !hashCru.startsWith('#/')) {
    if (!primeiraRenderizacao) return;
    window.history.replaceState(null, '', '#/');
  }

  const { segments, query, fragment } = parseHash();
  const found = match(segments);
  const path = '/' + segments.join('/');
  const changed = lastPath !== path;
  // quem estava com o foco antes da troca (para devolver depois)
  const focoAntes = document.activeElement?.dataset?.focusKey || null;

  // Só mudou o alvo dentro da tela ("#/sobre" → "#/sobre#faltando"): não
  // redesenha nada, só leva a pessoa até a âncora e põe o foco nela.
  if (!changed && fragment && fragment !== lastFragment && lastPath) {
    const alvo = document.getElementById(fragment);
    if (alvo) {
      alvo.setAttribute('tabindex', '-1');
      alvo.focus({ preventScroll: true });
      alvo.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    lastFragment = fragment;
    return;
  }

  // dispensa camadas por cima da página antes de desenhar a tela nova
  for (const hook of beforeRoute) {
    try {
      hook();
    } catch {
      /* uma camada que não fecha não pode travar a navegação */
    }
  }

  // guarda onde a pessoa estava na tela que está saindo
  if (lastPath && lastPath !== path) {
    scrollMemory.set(lastPath, window.scrollY);
  }

  if (!found) {
    outlet.innerHTML = `
      <section class="view">
        <div class="page">
          <p class="eyebrow">Erro 404</p>
          <h1 class="title-1">Esta tela não existe</h1>
          <p class="lede">O endereço pode ter mudado. Volte ao mapa para continuar.</p>
          <p><a class="btn btn--primary" href="#/" data-press="scale">Ir para o mapa</a></p>
        </div>
      </section>`;
    lastPath = path;
    lastFragment = fragment;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const heading = outlet.querySelector('h1');
    if (!primeiraRenderizacao) {
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }
    announcer.textContent = 'Página não encontrada';
    primeiraRenderizacao = false;
    return;
  }

  const { route, params } = found;
  currentView?.destroy?.();
  currentView = null;

  const view = await route.view({ params, query, navigate });
  if (token !== navToken) return; // outra navegação começou: descarta esta

  outlet.innerHTML = view.html;
  outlet.classList.remove('is-entering');
  // reflow para reiniciar a animação de entrada
  void outlet.offsetWidth;
  outlet.classList.add('is-entering');

  currentView = view;
  view.mount?.(outlet);

  // foco e anúncio para leitor de tela.
  // Trocar de tela leva o foco ao título da tela nova. Mudar só um filtro
  // (mesma tela) devolve o foco ao controle que a pessoa usou — senão o foco
  // cairia no corpo da página e a pessoa perderia o lugar.
  // Na abertura do site o foco não é movido: ele fica no começo do documento
  // para que o primeiro Tab alcance o link "pular para o conteúdo".
  const heading = outlet.querySelector('h1');
  const painel = outlet.querySelector('[role="tabpanel"]');
  const devolvido = focoAntes
    ? outlet.querySelector(`[data-focus-key="${CSS.escape(focoAntes)}"]`)
    : null;
  const temFragmento = Boolean(fragment);
  if (devolvido) {
    devolvido.focus({ preventScroll: true });
  } else if (!changed && painel) {
    painel.setAttribute('tabindex', '-1');
    painel.focus({ preventScroll: true });
  } else if (heading && !primeiraRenderizacao && !temFragmento) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  announcer.textContent = view.title || document.title;

  // rolagem: tela nova começa no topo; voltar pelo histórico devolve o ponto exato;
  // mudar só o filtro (mesma tela) preserva onde a pessoa estava lendo.
  if (pendingRestore) {
    pendingRestore = false;
    // 'instant' vence o scroll-behavior: smooth do html: voltar pelo
    // histórico reposiciona sem animação, como no iOS.
    window.scrollTo({ top: scrollMemory.get(path) || 0, left: 0, behavior: 'instant' });
  } else if (changed) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  // alvo dentro da tela ("#/sobre#faltando"): rola até a âncora e põe o foco
  // nela, para teclado e leitor de tela acompanharem.
  if (temFragmento) {
    const alvo = document.getElementById(fragment);
    if (alvo) {
      alvo.setAttribute('tabindex', '-1');
      alvo.focus({ preventScroll: true });
      alvo.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  lastPath = path;
  lastFragment = fragment;
  primeiraRenderizacao = false;

  // estado da navegação ativa
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const active = link.dataset.nav === route.nav;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function startRouter({ outlet: outletEl, announcer: announcerEl }) {
  outlet = outletEl;
  announcer = announcerEl;
  window.addEventListener('hashchange', render);
  // voltar/avançar no histórico: devolve a rolagem salva daquela tela
  window.addEventListener('popstate', () => { pendingRestore = true; });
  render();
}
