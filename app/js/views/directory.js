/* ============================================================================
   views/directory.js — "Quem é quem"
   ---------------------------------------------------------------------------
   O diretório original tem 71 mil nomes. Aqui o protótipo mostra o recorte
   disponível; a interface é a mesma que teria com a base completa:
   filtro por cargo, estado e partido, navegação por letra e lista paginada.
   ========================================================================== */

import { PESSOAS, PROJETO } from '../data/dados.js';
import { escapeHtml, personRow, sourceNote } from '../components.js';

export function directoryView({ query }) {
  const cargo = query.cargo || 'todos';
  const uf = query.uf || 'todas';
  const partido = query.partido || 'todos';
  const letra = query.letra || '';

  const cargos = [...new Set(PESSOAS.map((p) => p.cargo))].sort();
  const ufs = [...new Set(PESSOAS.map((p) => p.uf))].sort();
  const partidos = [...new Set(PESSOAS.map((p) => p.partido))].sort();

  const filtrados = PESSOAS.filter((p) => {
    if (cargo !== 'todos' && p.cargo !== cargo) return false;
    if (uf !== 'todas' && p.uf !== uf) return false;
    if (partido !== 'todos' && p.partido !== partido) return false;
    if (letra && !p.nome.toUpperCase().startsWith(letra)) return false;
    return true;
  });

  const letras = [...new Set(PESSOAS.map((p) => p.nome[0].toUpperCase()))].sort();

  const html = `
    <section class="view view--directory">
      <div class="page">
        <div class="hero hero--compact">
          <p class="eyebrow">Quem é quem</p>
          <h1 class="title-1">O diretório de quem ocupa cargo público</h1>
          <p class="lede">
            No site original são 71.649 nomes. Este protótipo carrega ${PESSOAS.length}, mas a
            interface — filtros, letra, lista — é a mesma que vai para a base completa.
          </p>
        </div>

        <div class="filterbar filterbar--stack" role="group" aria-label="Filtros do diretório">
          <div class="filterbar__row">
            <label class="field">
              <span class="field__label">Cargo</span>
              <select class="select" data-filter="cargo" data-focus-key="filtro-cargo">
                <option value="todos" ${cargo === 'todos' ? 'selected' : ''}>Todos os cargos</option>
                ${cargos.map((c) => `<option value="${escapeHtml(c)}" ${cargo === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Estado</span>
              <select class="select" data-filter="uf" data-focus-key="filtro-uf">
                <option value="todas" ${uf === 'todas' ? 'selected' : ''}>Todos os estados</option>
                ${ufs.map((u) => `<option value="${escapeHtml(u)}" ${uf === u ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Partido</span>
              <select class="select" data-filter="partido" data-focus-key="filtro-partido">
                <option value="todos" ${partido === 'todos' ? 'selected' : ''}>Todos os partidos</option>
                ${partidos.map((x) => `<option value="${escapeHtml(x)}" ${partido === x ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('')}
              </select>
            </label>
          </div>
          <nav class="az" aria-label="Ir para a letra">
            <a class="az__link ${!letra ? 'is-active' : ''}" href="#/quem" data-focus-key="letra-todos" data-press="highlight">Todos</a>
            ${letras
              .map(
                (l) =>
                  `<a class="az__link ${letra === l ? 'is-active' : ''}" href="#/quem?letra=${encodeURIComponent(l)}" data-focus-key="letra-${escapeHtml(l)}" data-press="highlight">${escapeHtml(l)}</a>`,
              )
              .join('')}
          </nav>
        </div>

        <p class="countline" data-count>${filtrados.length} pessoa${filtrados.length === 1 ? '' : 's'}</p>

        <div class="list" data-list>
          ${
            filtrados.length
              ? filtrados.map((p) => personRow(p, { href: `#/p/${p.id}` })).join('')
              : `<div class="empty">
                  <p class="empty__title">Nenhum nome com esses filtros</p>
                  <p class="empty__reason">Tente outra combinação de cargo, estado, partido ou letra.</p>
                </div>`
          }
        </div>

        ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`)}
      </div>
    </section>
  `;

  return {
    title: 'Quem é quem',
    html,
    mount(root) {
      root.querySelectorAll('[data-filter]').forEach((select) => {
        select.addEventListener('change', () => {
          const params = new URLSearchParams();
          params.set('cargo', root.querySelector('[data-filter="cargo"]').value);
          params.set('uf', root.querySelector('[data-filter="uf"]').value);
          params.set('partido', root.querySelector('[data-filter="partido"]').value);
          const letraAtual = root.querySelector('.az__link.is-active')?.getAttribute('href') || '';
          const letraParam = new URLSearchParams(letraAtual.split('?')[1] || '').get('letra');
          if (letraParam) params.set('letra', letraParam);
          location.hash = `#/quem?${params.toString()}`;
        });
      });
    },
  };
}
