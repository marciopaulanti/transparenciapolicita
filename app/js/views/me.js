/* ============================================================================
   views/me.js — "Me representa"
   ---------------------------------------------------------------------------
   O resultado abre numa sheet (celular) ou num painel lateral (desktop).
   No desktop o painel não tem scrim: o fluxo de leitura não é interrompido.
   ========================================================================== */

import { CIDADES, ESTADOS, normalizar, PROJETO, porMunicipio, porUf } from '../data/dados.js';
import { MAP_STATES } from '../data/br-map.js';
import { escapeHtml, personRow, sourceNote, montarComboboxCidade } from '../components.js';
import { openSheet } from '../sheet.js';

export function meView({ query, navigate }) {
  const cidade = query.cidade ? decodeURIComponent(query.cidade) : null;
  const uf = query.uf ? query.uf.toUpperCase() : null;

  const html = `
    <section class="view view--me">
      <div class="page">
        <div class="hero hero--compact">
          <p class="eyebrow">Me representa</p>
          <h1 class="title-1">Quem representa o seu lugar</h1>
          <p class="lede">
            Três entradas — cidade, estado ou Brasília. Você sai daqui com a lista de quem te
            representa, separada por esfera, e o caminho para o crachá de cada pessoa.
          </p>
        </div>

        <section class="card card--search" aria-labelledby="h-buscar-cidade">
          <h2 class="title-3" id="h-buscar-cidade">Sua cidade</h2>
          <div class="combobox" data-city-search>
            <label class="sr-only" for="me-city">Nome da cidade</label>
            <input class="input input--search" id="me-city" type="text" role="combobox"
                   autocomplete="off" aria-expanded="false" aria-controls="me-city-list"
                   aria-autocomplete="list" placeholder="Ex.: Recife" />
            <ul class="combobox__list" id="me-city-list" role="listbox" hidden></ul>
          </div>
          <p class="combobox__hint">
            Cidades com o mesmo nome em estados diferentes aparecem como “Cidade · UF”.
          </p>
        </section>

        <section class="section" aria-labelledby="h-tres-vias">
          <div class="section__head">
            <div>
              <p class="eyebrow">Três caminhos</p>
              <h2 class="title-2" id="h-tres-vias">Escolha por onde começar</h2>
            </div>
          </div>
          <div class="grid grid--3">
            <button type="button" class="tile" data-open="cidades" data-press="scale">
              <span class="tile__icon" aria-hidden="true">◎</span>
              <span class="tile__title">Uma cidade</span>
              <span class="tile__text">Prefeito, vereadores e a representação do seu estado e do país.</span>
            </button>
            <button type="button" class="tile" data-open="estados" data-press="scale">
              <span class="tile__icon" aria-hidden="true">▤</span>
              <span class="tile__title">Um estado</span>
              <span class="tile__text">A bancada do seu estado e todos os que ocupam cargo nele.</span>
            </button>
            <button type="button" class="tile" data-open="brasilia" data-press="scale">
              <span class="tile__icon" aria-hidden="true">◇</span>
              <span class="tile__title">Brasília</span>
              <span class="tile__text">Senadores, deputados federais e o deputado distrital.</span>
            </button>
          </div>
        </section>

        <section class="section" aria-labelledby="h-exemplos">
          <div class="section__head">
            <div>
              <p class="eyebrow">Exemplos</p>
              <h2 class="title-2" id="h-exemplos">Cidades com registro neste protótipo</h2>
            </div>
          </div>
          <div class="list">
            ${CIDADES.slice(0, 6)
              .map((c) => {
                const n = porMunicipio(c.nome).length;
                return `
                <a class="row row--static" href="#/me?cidade=${encodeURIComponent(c.nome)}" data-press="highlight">
                  <span class="row__text">
                    <span class="row__name">${escapeHtml(c.nome)} <span class="row__uf">${escapeHtml(c.uf)}</span></span>
                    <span class="row__meta">${n} pessoa${n === 1 ? '' : 's'} com registro${n ? '' : ' — nenhum dado publicado'}</span>
                  </span>
                  <svg class="row__chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>`;
              })
              .join('')}
          </div>
          ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`)}
        </section>
      </div>
    </section>
  `;

  return {
    title: 'Quem me representa',
    html,
    mount(root) {
      montarBusca(root, navigate);
      root.querySelectorAll('[data-open]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tipo = btn.dataset.open;
          if (tipo === 'cidades') root.querySelector('#me-city')?.focus();
          if (tipo === 'estados') abrirEstados(navigate);
          if (tipo === 'brasilia') navigate('/me?uf=DF');
        });
      });

      if (cidade) abrirResultadosCidade(cidade, navigate);
      else if (uf) abrirResultadosEstado(uf, navigate);
    },
  };
}

/* ------------------------------------------------------------------ sheet */

function abrirEstados(navigate) {
  const itens = MAP_STATES.map(
    (s) => `
      <li class="picker__item">
        <button type="button" data-uf="${escapeHtml(s.sigla)}">
          <span>${escapeHtml(s.nome)}</span>
          <span class="picker__uf">${escapeHtml(s.sigla)}</span>
        </button>
      </li>`,
  ).join('');

  openSheet({
    title: 'Escolha um estado',
    subtitle: 'A bancada do estado e quem ocupa cargo nele.',
    content: `<ul class="picker">${itens}</ul>`,
  }).element.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-uf]');
    if (!btn) return;
    document.querySelector('[data-sheet-close]')?.click();
    navigate(`/me?uf=${btn.dataset.uf}`);
  });
}

function abrirResultadosCidade(cidade, navigate) {
  const municipal = porMunicipio(cidade);
  const uf = CIDADES.find((c) => normalizar(c.nome) === normalizar(cidade))?.uf;
  const estadual = uf ? porUf(uf).filter((p) => p.esfera === 'estadual') : [];
  const federal = uf ? porUf(uf).filter((p) => p.esfera === 'federal') : [];

  const conteudo = `
    <div class="sheet__intro">
      <p class="sheet__lead">Quem representa <strong>${escapeHtml(cidade)}</strong>${
        uf ? ` · ${escapeHtml(uf)}` : ''
      }</p>
    </div>
    ${municipal.length || estadual.length || federal.length ? '' : emptyCidade(cidade)}
    ${grupo('Município', municipal)}
    ${grupo('Estado', estadual)}
    ${grupo('País', federal)}
    ${
      municipal.length
        ? `<p class="sheet__action"><button type="button" class="btn btn--primary" data-compare-city="${escapeHtml(
            cidade,
          )}" data-press="scale">Comparar lado a lado</button></p>`
        : ''
    }
    ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`)}
  `;

  const sheet = openSheet({
    title: `${cidade}`,
    subtitle: 'Resultado agrupado por esfera',
    content: conteudo,
  });

  sheet.element.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-compare-city]');
    if (!btn) return;
    const ids = municipal.map((p) => p.id);
    navigate(`/comparar?p=${ids.join(',')}`);
    document.querySelector('[data-sheet-close]')?.click();
  });
}

function abrirResultadosEstado(uf, navigate) {
  const info = ESTADOS[uf];
  const pessoas = porUf(uf);
  const federal = pessoas.filter((p) => p.esfera === 'federal');
  const estadual = pessoas.filter((p) => p.esfera === 'estadual');
  const municipal = pessoas.filter((p) => p.esfera === 'municipal');

  const conteudo = `
    <div class="sheet__intro">
      <p class="sheet__lead">Quem representa <strong>${escapeHtml(info?.nome || uf)}</strong></p>
      ${info?.lema ? `<p class="sheet__note">${escapeHtml(info.lema)}</p>` : ''}
    </div>
    ${pessoas.length ? '' : '<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p><p class="empty__reason">A fonte deste estado ainda não foi ingerida neste protótipo.</p></div>'}
    ${grupo('Município', municipal)}
    ${grupo('Estado', estadual)}
    ${grupo('País', federal)}
    ${
      pessoas.length
        ? `<p class="sheet__action"><button type="button" class="btn btn--primary" data-compare-city="${escapeHtml(
            uf,
          )}" data-press="scale">Comparar lado a lado</button></p>`
        : ''
    }
    ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`)}
  `;

  const sheet = openSheet({
    title: info?.nome || uf,
    subtitle: 'Resultado agrupado por esfera',
    content: conteudo,
  });

  sheet.element.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-compare-city]');
    if (!btn) return;
    const ids = pessoas.map((p) => p.id);
    navigate(`/comparar?p=${ids.join(',')}`);
    document.querySelector('[data-sheet-close]')?.click();
  });
}

function grupo(titulo, pessoas) {
  if (!pessoas.length) return '';
  return `
    <section class="group">
      <h3 class="group__title">${escapeHtml(titulo)}</h3>
      <div class="list list--inset">
        ${pessoas
          .map((p) => personRow(p, { href: `#/p/${p.id}`, compative: true }))
          .join('')}
      </div>
    </section>
  `;
}

function emptyCidade(cidade) {
  return `
    <div class="empty">
      <p class="empty__title">Nenhum destes dados está no site</p>
      <p class="empty__reason">
        Não encontramos registro publicado para <strong>${escapeHtml(cidade)}</strong>.
        Isso não significa que não exista mandato — significa que a fonte ainda não foi ingerida.
      </p>
    </div>
  `;
}

/* --------------------------------------------------------------- busca */

function montarBusca(root, navigate) {
  const box = root.querySelector('[data-city-search]');
  if (!box) return;
  montarComboboxCidade(box, {
    onPick: (nome) => navigate(`/me?cidade=${encodeURIComponent(nome)}`),
  });
}
