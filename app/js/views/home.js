/* ============================================================================
   views/home.js — Home / mapa do Brasil
   ---------------------------------------------------------------------------
   O mapa é a entrada do loop central: mapa → estado → crachá.
   A camada temática mora na URL (?assunto=), então o recorte é compartilhável.
   ========================================================================== */

import { CAMADAS, CIDADES, ESTADOS, PESSOAS, PROJETO, valoresDaCamada } from '../data/dados.js';
import { MAP_STATES, MAP_VIEWBOX } from '../data/br-map.js';
import { escapeHtml, sourceNote, montarComboboxCidade } from '../components.js';

function layerFromQuery(query) {
  const id = query.assunto || 'contas';
  return CAMADAS.find((c) => c.id === id) || CAMADAS[0];
}

export function homeView({ query, navigate }) {
  const camada = layerFromQuery(query);
  const siglas = MAP_STATES.map((s) => s.sigla);
  const valores = valoresDaCamada(camada.id, siglas);
  const numeros = siglas.map((s) => valores[s]).filter((v) => !v.semDado).map((v) => v.valor);
  const min = Math.min(...numeros);
  const max = Math.max(...numeros);

  const semDado = siglas.filter((s) => valores[s].semDado);

  const caminhos = MAP_STATES.map((estado) => {
    const v = valores[estado.sigla];
    const info = ESTADOS[estado.sigla];
    const rotulo = info
      ? `${estado.nome}: ${v.semDado ? 'sem dado na fonte' : `${v.valor} ${camada.unidade}`}`
      : `${estado.nome}: ${v.semDado ? 'sem dado na fonte' : `${v.valor} ${camada.unidade}`}`;
    return `<a href="#/uf/${estado.sigla}" class="map__state" data-sigla="${estado.sigla}"
              aria-label="${escapeHtml(rotulo)}">
              <path d="${estado.d}" fill="${fillOf(v, min, max)}"></path>
              <title>${escapeHtml(rotulo)}</title>
            </a>`;
  }).join('');

  const pills = CAMADAS.map(
    (c) => `
      <a class="chip ${c.id === camada.id ? 'is-pressed' : ''}" href="#/?assunto=${c.id}"
         aria-pressed="${c.id === camada.id}" data-focus-key="camada-${escapeHtml(c.id)}"
         data-press="highlight">${escapeHtml(c.nome)}</a>`,
  ).join('');

  const html = `
    <section class="view view--home">
      <div class="hero">
        <p class="eyebrow">Transparência política com dados oficiais</p>
        <h1 class="title-1">Quem me representa, e o que essa pessoa fez no mandato</h1>
        <p class="lede">
          Mapa, estado e crachá: em no máximo três cliques você chega ao registro do mandato —
          votos, propostas, emendas, cota e patrimônio, cada número com a fonte oficial que o publicou.
        </p>

        <div class="hero__stats">
          <div class="hero__stat">
            <p class="hero__value">${PESSOAS.length}</p>
            <p class="hero__label">pessoas com registro no protótipo</p>
          </div>
          <div class="hero__stat">
            <p class="hero__value">${CIDADES.length}</p>
            <p class="hero__label">municípios com registro</p>
          </div>
          <div class="hero__stat">
            <p class="hero__value">${MAP_STATES.length}</p>
            <p class="hero__label">estados e o Distrito Federal</p>
          </div>
        </div>
        ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Números de demonstração')}
      </div>

      <div class="page">
        <section class="card card--search" aria-labelledby="h-cidade">
          <h2 class="title-3" id="h-cidade">Sua cidade</h2>
          <p class="lede">Digite o nome da cidade para ver quem te representa.</p>
          <div class="combobox" data-city-search>
            <label class="sr-only" for="city-input">Nome da cidade</label>
            <input
              class="input input--search"
              id="city-input"
              type="text"
              role="combobox"
              autocomplete="off"
              aria-expanded="false"
              aria-controls="city-list"
              aria-autocomplete="list"
              placeholder="Ex.: Recife"
            />
            <ul class="combobox__list" id="city-list" role="listbox" hidden></ul>
          </div>
          <p class="combobox__hint">Ou escolha um exemplo: ${['Recife', 'Salvador', 'São Paulo', 'Rio de Janeiro']
            .map((c) => `<a href="#/me?cidade=${encodeURIComponent(c)}" class="linkbtn">${c}</a>`)
            .join(' · ')}</p>
        </section>

        <section class="section" aria-labelledby="h-mapa">
          <div class="section__head">
            <div>
              <p class="eyebrow">Mapa</p>
              <h2 class="title-2" id="h-mapa">${escapeHtml(camada.nome)} por estado</h2>
              <p class="lede">${escapeHtml(camada.descricao)}</p>
            </div>
          </div>

          <div class="chiprow" role="group" aria-label="Camada do mapa">${pills}</div>

          <figure class="map">
            <svg class="map__svg" viewBox="${MAP_VIEWBOX}" role="img"
                 aria-label="Mapa do Brasil por ${escapeHtml(camada.nome)}">
              <g class="map__states">${caminhos}</g>
            </svg>
            <figcaption class="map__caption">
              <div class="legend">
                <span class="legend__title">${escapeHtml(camada.unidade)}</span>
                <span class="legend__scale" aria-hidden="true">
                  ${['--ramp-0', '--ramp-2', '--ramp-4', '--ramp-6']
                    .map((r) => `<i style="background: var(${r})"></i>`)
                    .join('')}
                </span>
                <span class="legend__ends">
                  <span>${min}</span>
                  <span>${max}</span>
                </span>
                <span class="legend__note"><i class="legend__nodata"></i> ${semDado.length} estado${
                  semDado.length === 1 ? '' : 's'
                } sem dado na fonte</span>
              </div>
            </figcaption>
          </figure>

          <p class="note">
            A cor não classifica ninguém. Ela mostra quanto de um mesmo indicador cada estado tem —
            o mesmo critério vale para todos, sem exceção. A rampa é monocromática de propósito:
            nenhuma cor pode sugerir que um mandato é melhor ou pior que outro.
          </p>
        </section>

        <section class="section" aria-labelledby="h-como">
          <div class="section__head">
            <div>
              <p class="eyebrow">Como usar</p>
              <h2 class="title-2" id="h-como">Três cliques até o registro do mandato</h2>
            </div>
          </div>
          <ol class="steps">
            <li class="step">
              <p class="step__num">1</p>
              <h3 class="step__title">Escolha o lugar</h3>
              <p class="step__text">Cidade, estado ou Brasília. A busca sugere enquanto você digita.</p>
            </li>
            <li class="step">
              <p class="step__num">2</p>
              <h3 class="step__title">Veja quem representa</h3>
              <p class="step__text">A lista vem separada por esfera: município, estado e país.</p>
            </li>
            <li class="step">
              <p class="step__num">3</p>
              <h3 class="step__title">Abra o crachá</h3>
              <p class="step__text">Votos, propostas, emendas, cota, patrimônio e campanha, com a fonte de cada bloco.</p>
            </li>
          </ol>
          <p><a class="btn btn--primary" href="#/me" data-press="scale">Começar por mim</a></p>
        </section>
      </div>
    </section>
  `;

  return {
    title: 'Mapa do Brasil por estado',
    html,
    mount(root) {
      montarBuscaCidade(root, navigate);
    },
  };
}

function fillOf(v, min, max) {
  if (v.semDado) return 'var(--data-neutro)';
  if (max === min) return 'var(--ramp-3)';
  const t = (v.valor - min) / (max - min);
  const idx = Math.min(6, Math.max(0, Math.round(t * 6)));
  return `var(--ramp-${idx})`;
}

/**
 * Combobox de cidades na home. O controle em si vive em components.js, para
 * que a home e "Me representa" se comportem exatamente igual.
 */
function montarBuscaCidade(root, navigate) {
  const box = root.querySelector('[data-city-search]');
  if (!box) return;
  montarComboboxCidade(box, {
    onPick: (nome) => navigate(`/me?cidade=${encodeURIComponent(nome)}`),
  });
}
