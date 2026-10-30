/* ============================================================================
   views/uf.js — página do estado
   ---------------------------------------------------------------------------
   Mostra a bancada (uma cadeira = um ponto) e "todo mundo no cargo".
   A cor do partido identifica a cadeira; ela não avalia a pessoa.
   ========================================================================== */

import { CIDADES, ESTADOS, normalizar, PESSOAS, PROJETO, REGIOES } from '../data/fixtures.js';
import { escapeHtml, personRow, sourceNote } from '../components.js';

export function ufView({ params }) {
  const uf = (params.uf || '').toUpperCase();
  const info = ESTADOS[uf];
  const doEstado = PESSOAS.filter((p) => p.uf === uf);
  const cidades = CIDADES.filter((c) => c.uf === uf);
  const regiao = info?.regiao ? REGIOES[info.regiao] : 'Brasil';

  if (!info && !doEstado.length) {
    return {
      title: 'Estado sem dados',
      html: `<section class="view"><div class="page">
        <h1 class="title-1">Este estado ainda não entrou no protótipo</h1>
        <p class="lede">A fonte deste estado não foi ingerida nesta demonstração.</p>
        <p><a class="btn btn--primary" href="#/" data-press="scale">Voltar ao mapa</a></p>
      </div></section>`,
    };
  }

  const bancada = info?.bancada ?? doEstado.map((p) => ({
    nome: p.nome,
    cargo: p.cargo,
    partido: p.partido,
    titular: p.titular,
  }));

  const porPartido = new Map();
  for (const cadeira of bancada) {
    porPartido.set(cadeira.partido, (porPartido.get(cadeira.partido) || 0) + 1);
  }

  const html = `
    <section class="view view--uf">
      <div class="page">
        <nav class="crumbs" aria-label="Trilha">
          <a href="#/">Brasil</a>
          <span aria-hidden="true">›</span>
          <span>${escapeHtml(regiao)}</span>
          <span aria-hidden="true">›</span>
          <span aria-current="page">${escapeHtml(info?.nome || uf)}</span>
        </nav>

        <div class="hero hero--compact">
          <p class="eyebrow">Estado</p>
          <h1 class="title-1">${escapeHtml(info?.nome || uf)}</h1>
          ${info?.lema ? `<p class="lede">${escapeHtml(info.lema)}</p>` : ''}
        </div>

        <div class="statrow">
          <div class="statrow__item">
            <p class="statrow__value">${bancada.length}</p>
            <p class="statrow__label">cadeiras na bancada</p>
          </div>
          <div class="statrow__item">
            <p class="statrow__value">${cidades.length || '—'}</p>
            <p class="statrow__label">cidades com registro</p>
          </div>
          <div class="statrow__item">
            <p class="statrow__value">${doEstado.length}</p>
            <p class="statrow__label">pessoas com crachá</p>
          </div>
        </div>

        <section class="section" aria-labelledby="h-bancada">
          <div class="section__head">
            <div>
              <p class="eyebrow">As bancadas</p>
              <h2 class="title-2" id="h-bancada">Uma cadeira, um ponto</h2>
              <p class="lede">
                A sigla ao lado de cada ponto identifica o partido que ocupa a cadeira.
                Ela não diz se o mandato é bom ou ruim — o registro é que mostra.
              </p>
            </div>
          </div>

          <div class="bancada" role="list" aria-label="Bancada do estado">
            ${bancada
              .map(
                (c, i) => `
              <span class="bancada__seat" role="listitem" title="${escapeHtml(c.nome)} · ${escapeHtml(c.cargo)} · ${escapeHtml(c.partido)}">
                <i aria-hidden="true"></i>
                <span class="bancada__sigla">${escapeHtml(c.partido)}</span>
                <span class="sr-only">${escapeHtml(c.nome)}, ${escapeHtml(c.cargo)}, ${escapeHtml(c.partido)}</span>
              </span>`,
              )
              .join('')}
          </div>

          <ul class="chips chips--legend">
            ${Array.from(porPartido.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([sigla, n]) => `<li class="chip chip--static"><strong>${escapeHtml(sigla)}</strong> ${n}</li>`)
              .join('')}
          </ul>
          ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`)}
        </section>

        <section class="section" aria-labelledby="h-cargos">
          <div class="section__head">
            <div>
              <p class="eyebrow">Todo mundo no cargo</p>
              <h2 class="title-2" id="h-cargos">Quem ocupa cargo em ${escapeHtml(info?.nome || uf)}</h2>
            </div>
          </div>

          <div class="filterbar" role="group" aria-label="Filtrar por cargo">
            ${['todos', 'prefeito', 'vereador', 'deputado_estadual', 'deputado_federal', 'senador']
              .map(
                (cargo) => `
              <button type="button" class="chip ${cargo === 'todos' ? 'is-pressed' : ''}" data-cargo="${cargo}"
                      aria-pressed="${cargo === 'todos'}" data-press="highlight">
                ${cargo === 'todos' ? 'Todos' : escapeHtml(cargo.replace('_', ' '))}
              </button>`,
              )
              .join('')}
          </div>

          <div class="list" data-list="cargos">
            ${doEstado
              .map((p) => personRow(p, { href: `#/p/${p.id}` }))
              .join('')}
          </div>
          <p class="empty" data-empty hidden>Nenhum cargo com este filtro tem registro neste protótipo.</p>
        </section>

        <section class="section" aria-labelledby="h-cidades">
          <div class="section__head">
            <div>
              <p class="eyebrow">Cidades</p>
              <h2 class="title-2" id="h-cidades">Municípios com registro</h2>
            </div>
          </div>
          <div class="list">
            ${
              cidades.length
                ? cidades
                    .map((c) => {
                      const n = PESSOAS.filter((p) => p.municipio === c.nome).length;
                      return `
                  <a class="row row--static" href="#/me?cidade=${encodeURIComponent(c.nome)}" data-press="highlight">
                    <span class="row__text">
                      <span class="row__name">${escapeHtml(c.nome)}</span>
                      <span class="row__meta">${n ? `${n} pessoa${n === 1 ? '' : 's'} com registro` : 'nenhum dado publicado'}</span>
                    </span>
                    <svg class="row__chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </a>`;
                    })
                    .join('')
                : `<p class="empty">Nenhuma cidade deste estado tem registro no protótipo.</p>`
            }
          </div>
        </section>
      </div>
    </section>
  `;

  return {
    title: info?.nome || uf,
    html,
    mount(root) {
      const botoes = root.querySelectorAll('[data-cargo]');
      const lista = root.querySelector('[data-list="cargos"]');
      const vazio = root.querySelector('[data-empty]');
      botoes.forEach((btn) => {
        btn.addEventListener('click', () => {
          botoes.forEach((b) => {
            b.classList.toggle('is-pressed', b === btn);
            b.setAttribute('aria-pressed', String(b === btn));
          });
          const cargo = btn.dataset.cargo;
          const linhas = Array.from(lista.querySelectorAll('.row'));
          let visiveis = 0;
          linhas.forEach((linha) => {
            const nome = linha.querySelector('.row__name')?.textContent || '';
            const meta = linha.querySelector('.row__meta')?.textContent || '';
            const combina =
              cargo === 'todos' ||
              normalizar(meta).includes(normalizar(cargo.replace('_', ' ')));
            linha.hidden = !combina;
            if (combina) visiveis += 1;
          });
          vazio.hidden = visiveis > 0;
        });
      });
    },
  };
}
