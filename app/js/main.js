/* ============================================================================
   main.js — ponto de entrada
   ========================================================================== */

import { attachPress } from './motion.js';
import { defineRoutes, onBeforeNavigate, startRouter } from './router.js';
import { closeDialog, openDialog } from './dialog.js';
import { closeSheet } from './sheet.js';
import { abrirSugestao } from './forms.js';
import { escapeHtml } from './components.js';
import { CIDADES, normalizar, PESSOAS } from './data/fixtures.js';
import { MAP_STATES } from './data/br-map.js';
import { homeView } from './views/home.js';
import { meView } from './views/me.js';
import { ufView } from './views/uf.js';
import { badgeView } from './views/badge.js';
import { compareView } from './views/compare.js';
import { directoryView } from './views/directory.js';
import { aboutView } from './views/about.js';
import { helpView } from './views/help.js';

/* ------------------------------------------------------------------ rotas */

defineRoutes([
  { path: '/', view: homeView, nav: 'home' },
  { path: '/me', view: meView, nav: 'me' },
  { path: '/uf/:uf', view: ufView, nav: 'home' },
  { path: '/p/:id', view: badgeView, nav: 'home' },
  { path: '/comparar', view: compareView, nav: 'comparar' },
  { path: '/quem', view: directoryView, nav: 'quem' },
  { path: '/sobre', view: aboutView, nav: 'sobre' },
  { path: '/ajuda', view: helpView, nav: 'sobre' },
]);

startRouter({
  outlet: document.getElementById('view'),
  announcer: document.getElementById('route-announcer'),
});

/* ------------------------------------------------ camadas sobre a página */

// Trocar de tela dispensa o que estiver por cima: uma sheet ou um modal
// abertos não podem ficar cobrindo a tela nova.
onBeforeNavigate(() => {
  closeSheet({ immediate: true });
  closeDialog({ immediate: true });
});

/* ----------------------------------------------------- pular para o conteúdo */

// O link "pular para o conteúdo" fica no topo do documento. Sem JavaScript
// ele continua funcionando como uma âncora comum; aqui ele apenas leva o
// foco ao conteúdo — e, o mais importante, não mexe no hash: trocar o hash
// para "#view" seria lido pelo roteador como uma tela inexistente.
const pular = document.querySelector('.skip-link');
pular?.addEventListener('click', (event) => {
  event.preventDefault();
  const conteudo = document.getElementById('view');
  if (!conteudo) return;
  conteudo.focus({ preventScroll: true });
  conteudo.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
});

/* --------------------------------------------------------- pressão no toque */

attachPress(document);

/* ------------------------------------------------------- borda de rolagem */

const chrome = document.getElementById('chrome');
const onScroll = () => {
  chrome.classList.toggle('is-scrolled', window.scrollY > 4);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ------------------------------------------------------------------ busca */

const botaoBusca = document.getElementById('search-open');
botaoBusca?.addEventListener('click', () => abrirBusca(botaoBusca));

function abrirBusca(anchor) {
  const { element, close } = openDialog({
    title: 'Buscar no site',
    subtitle: 'Político, cidade ou estado.',
    size: 'lg',
    anchor,
    content: `
      <label class="sr-only" for="q">Buscar</label>
      <input class="input input--search input--lg" id="q" type="search" autocomplete="off"
             placeholder="Ex.: Recife, Marina Caldeira, SP" />
      <div class="search__results" id="q-results" aria-live="polite"></div>
    `,
  });

  const input = element.querySelector('#q');
  const resultados = element.querySelector('#q-results');

  const render = (termo) => {
    const t = normalizar(termo);
    if (!t) {
      resultados.innerHTML = `
        <p class="search__hint">Digite para começar. Os resultados vêm agrupados por tipo.</p>
        <ul class="search__examples">
          <li><button type="button" data-ex="Recife">Recife</button></li>
          <li><button type="button" data-ex="Salvador">Salvador</button></li>
          <li><button type="button" data-ex="SP">SP</button></li>
        </ul>`;
      return;
    }

    // A busca tolera acento: "sao paulo" e "são paulo" levam ao mesmo lugar.
    // É o comportamento do original e evita que a pessoa desista por causa de
    // um acento que o teclado do celular omiteu.
    const pessoas = PESSOAS.filter((p) => normalizar(p.nome).includes(t)).slice(0, 6);
    const cidades = CIDADES.filter((c) => normalizar(c.nome).includes(t)).slice(0, 5);
    const estados = MAP_STATES.filter(
      (e) => normalizar(e.nome).includes(t) || normalizar(e.sigla) === t,
    ).slice(0, 5);

    const grupos = [];
    if (pessoas.length) {
      grupos.push(`
        <section class="search__group">
          <h3 class="search__grouptitle">Pessoas</h3>
          <ul class="list list--inset">
            ${pessoas
              .map(
                (p) => `
              <li><a class="row" href="#/p/${p.id}" data-press="highlight">
                <span class="row__text">
                  <span class="row__name">${escapeHtml(p.nome)}</span>
                  <span class="row__meta">${escapeHtml(p.cargo)} · ${escapeHtml(p.uf)}</span>
                </span>
              </a></li>`,
              )
              .join('')}
          </ul>
        </section>`);
    }
    if (cidades.length) {
      grupos.push(`
        <section class="search__group">
          <h3 class="search__grouptitle">Cidades</h3>
          <ul class="list list--inset">
            ${cidades
              .map(
                (c) => `
              <li><a class="row" href="#/me?cidade=${encodeURIComponent(c.nome)}" data-press="highlight">
                <span class="row__text">
                  <span class="row__name">${escapeHtml(c.nome)}</span>
                  <span class="row__meta">Cidade · ${escapeHtml(c.uf)} · ver quem representa</span>
                </span>
              </a></li>`,
              )
              .join('')}
          </ul>
        </section>`);
    }
    if (estados.length) {
      grupos.push(`
        <section class="search__group">
          <h3 class="search__grouptitle">Estados</h3>
          <ul class="list list--inset">
            ${estados
              .map(
                (e) => `
              <li><a class="row" href="#/uf/${e.sigla}" data-press="highlight">
                <span class="row__text">
                  <span class="row__name">${escapeHtml(e.nome)}</span>
                  <span class="row__meta">Estado · ${escapeHtml(e.sigla)}</span>
                </span>
              </a></li>`,
              )
              .join('')}
          </ul>
        </section>`);
    }

    resultados.innerHTML = grupos.length
      ? grupos.join('')
      : `<div class="empty"><p class="empty__title">Nada encontrado</p>
           <p class="empty__reason">Tente o nome com menos palavras. Acento não importa: "sao paulo" funciona.</p></div>`;
  };

  render('');
  input.addEventListener('input', () => render(input.value));

  element.addEventListener('click', (event) => {
    const exemplo = event.target.closest('[data-ex]');
    if (exemplo) {
      input.value = exemplo.dataset.ex;
      render(input.value);
      return;
    }
    const link = event.target.closest('a[href^="#/"]');
    if (link) close();
  });
}

/* -------------------------------------------------------------- sugestões */

document.querySelectorAll('[data-action="suggest"]').forEach((btn) => {
  btn.addEventListener('click', () => abrirSugestao({ anchor: btn }));
});
