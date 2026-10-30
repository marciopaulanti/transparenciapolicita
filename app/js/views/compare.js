/* ============================================================================
   views/compare.js — comparador
   ---------------------------------------------------------------------------
   Regra central: o comparador alinha o mesmo campo entre cargos diferentes
   sem transformar isso em nota. Não existe pontuação, ordem de qualidade nem
   cor de bom/ruim. Dado que uma das pessoas não tem é "—", do lado dela.
   ========================================================================== */

import { PESSOAS, PROJETO } from '../data/dados.js';
import { dash, escapeHtml, moeda, numero, percentual, sourceNote } from '../components.js';
import { openDialog } from '../dialog.js';

const LIMITE = 5;

export function compareView({ query, navigate }) {
  const ids = (query.p || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, LIMITE);
  const pessoas = ids.map((id) => PESSOAS.find((p) => p.id === id)).filter(Boolean);

  const html = `
    <section class="view view--compare">
      <div class="page">
        <div class="hero hero--compact">
          <p class="eyebrow">Comparar</p>
          <h1 class="title-1">Duas a cinco pessoas, lado a lado</h1>
          <p class="lede">
            O comparador põe o mesmo campo frente a frente — inclusive entre cargos diferentes.
            Não existe nota, ranking ou cor de bom e ruim: se a fonte não publica um dado,
            a célula fica vazia de propósito.
          </p>
        </div>

        <div class="compare__bar">
          <div class="compare__chips">
            ${
              pessoas.length
                ? pessoas
                    .map(
                      (p) => `
              <span class="chip chip--static chip--person">
                <span>${escapeHtml(p.nome)}</span>
                <button type="button" data-remove="${escapeHtml(p.id)}" aria-label="Remover ${escapeHtml(
                  p.nome,
                )}">×</button>
              </span>`,
                    )
                    .join('')
                : '<span class="compare__empty">Ninguém selecionado ainda.</span>'
            }
          </div>
          <button type="button" class="btn btn--ghost" data-add ${pessoas.length >= LIMITE ? 'disabled' : ''} data-press="scale">
            ${pessoas.length >= LIMITE ? `Limite de ${LIMITE}` : '+ Adicionar pessoa'}
          </button>
        </div>

        ${
          pessoas.length < 2
            ? `<div class="empty">
                <p class="empty__title">Escolha pelo menos duas pessoas</p>
                <p class="empty__reason">
                  Você pode comparar cargos diferentes — senador e vereador, por exemplo.
                  Sem nota: a comparação mostra o registro, não o julgamento.
                </p>
                <p><a class="btn btn--primary" href="#/me" data-press="scale">Começar por mim</a></p>
              </div>`
            : tabela(pessoas)
        }

        ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Comparação sem pontuação')}
      </div>
    </section>
  `;

  return {
    title: 'Comparar pessoas',
    html,
    mount(root) {
      root.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const restantes = ids.filter((id) => id !== btn.dataset.remove);
          navigate(restantes.length ? `/comparar?p=${restantes.join(',')}` : '/comparar');
        });
      });

      root.querySelector('[data-add]')?.addEventListener('click', (event) => {
        if (pessoas.length >= LIMITE) return;
        abrirEscolha(ids, navigate, event.currentTarget);
      });
    },
  };
}

/* ------------------------------------------------------------------ tabela */

function tabela(pessoas) {
  const linhas = [
    ['Cargo', (p) => escapeHtml(p.cargo)],
    ['Situação', (p) => (p.situacao === 'em_exercicio' ? 'Em exercício' : p.situacao === 'suplente' ? 'Suplente' : p.situacao === 'mandato_interrompido' ? 'Mandato interrompido' : 'Não eleito')],
    ['Mandato', (p) => `${p.mandato.inicio.slice(0, 4)}–${p.mandato.fim.slice(0, 4)}`],
    ['Partido', (p) => escapeHtml(p.partido)],
    ['Última eleição', (p) => (p.ultimoPleito ? `${percentual(p.ultimoPleito.percentual)} · ${numero(p.ultimoPleito.votos)} votos` : dash())],
    ['Votos favoráveis', (p) => (p.votacao ? numero(p.votacao.sim) : dash('Sem registro de votação'))],
    ['Presença em sessões', (p) => (p.presenca ? `${numero(p.presenca.compareceu)} de ${numero(p.presenca.sessoes)}` : dash(p.presencaMotivo))],
    ['Patrimônio declarado', (p) => (p.patrimonio ? moeda(p.patrimonio.valor) : dash(p.patrimonioMotivo))],
    ['Cota parlamentar', (p) => (p.cota ? moeda(p.cota.valor) : dash(p.cotaMotivo))],
    ['Propostas', (p) => numero(p.propostas.length)],
    ['Emendas', (p) => (p.emendas.length ? `${numero(p.emendas.length)} · ${moeda(p.emendas.reduce((s, e) => s + e.valor, 0))}` : '0')],
    ['Campanhas', (p) => (p.campanha ? moeda(p.campanha.arrecadado) : dash())],
  ];

  return `
    <div class="tablewrap">
      <table class="table">
        <caption class="sr-only">Comparação de registros de mandato, sem nota nem ranking</caption>
        <thead>
          <tr>
            <th scope="col" class="table__corner">Dado</th>
            ${pessoas
              .map(
                (p) => `
              <th scope="col">
                <a class="table__person" href="#/p/${p.id}">
                  <span class="avatar avatar--sm avatar--initials" aria-hidden="true">${iniciais(p.nome)}</span>
                  <span class="table__pname">${escapeHtml(p.nome)}</span>
                  <span class="table__pcargo">${escapeHtml(p.cargo)} · ${escapeHtml(p.uf)}</span>
                </a>
              </th>`,
              )
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${linhas
            .map(
              ([rotulo, valor]) => `
            <tr>
              <th scope="row">${escapeHtml(rotulo)}</th>
              ${pessoas.map((p) => `<td>${valor(p)}</td>`).join('')}
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="note">
      Célula vazia com travessão significa que a fonte não publica aquele dado para aquela pessoa —
      não que o valor seja zero. Nenhuma linha soma pontos: comparar é olhar registros, não dar nota.
    </p>
  `;
}

/* --------------------------------------------------------------- escolher */

function abrirEscolha(selecionados, navigate, anchor) {
  const restantes = PESSOAS.filter((p) => !selecionados.includes(p.id));
  const conteudo = `
    <label class="sr-only" for="cmp-input">Buscar pessoa</label>
    <input class="input" id="cmp-input" type="text" placeholder="Buscar por nome" autocomplete="off" />
    <ul class="list list--inset" id="cmp-list">
      ${restantes
        .map(
          (p) => `
        <li class="cmp__item" data-nome="${escapeHtml(p.nome.toLowerCase())}">
          <button type="button" data-pick="${escapeHtml(p.id)}">
            <span class="row__text">
              <span class="row__name">${escapeHtml(p.nome)}</span>
              <span class="row__meta">${escapeHtml(p.cargo)} · ${escapeHtml(p.uf)}</span>
            </span>
          </button>
        </li>`,
        )
        .join('')}
    </ul>
  `;

  const { element } = openDialog({
    title: 'Adicionar ao comparador',
    subtitle: 'Até cinco pessoas, inclusive de cargos diferentes.',
    content: conteudo,
    anchor,
  });

  const input = element.querySelector('#cmp-input');
  input?.addEventListener('input', () => {
    const termo = input.value.trim().toLowerCase();
    element.querySelectorAll('.cmp__item').forEach((item) => {
      item.hidden = !item.dataset.nome.includes(termo);
    });
  });

  element.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-pick]');
    if (!btn) return;
    navigate(`/comparar?p=${[...selecionados, btn.dataset.pick].join(',')}`);
    document.querySelector('[data-dialog-close]')?.click();
  });
}

function iniciais(nome) {
  const partes = String(nome).trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
