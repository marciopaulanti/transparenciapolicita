/* ============================================================================
   views/help.js — como ajudar
   ========================================================================== */

import { escapeHtml } from '../components.js';

export function helpView() {
  const cards = [
    {
      icone: '+',
      titulo: 'Mandar um dado',
      texto: 'Achou um registro que não está no site? Mande a fonte junto — a gente ingere e confere.',
      acao: 'Sugerir um dado',
    },
    {
      icone: '!',
      titulo: 'Avisar um erro',
      texto: 'Número errado, nome trocado, cargo confuso. Toda correção é conferida na fonte oficial.',
      acao: 'Reportar um erro',
    },
    {
      icone: '↗',
      titulo: 'Espalhar',
      texto: 'Compartilhe o crachá de quem te representa. Sem rastreio, sem cookie: só o link.',
      acao: 'Abrir o comparador',
    },
    {
      icone: '♡',
      titulo: 'Apoiar',
      texto: 'O projeto é aberto e roda com dados abertos. Ajudar mantém a ingestão viva.',
      acao: 'Ver o método',
    },
  ];

  const html = `
    <section class="view view--help">
      <div class="page page--narrow">
        <div class="hero hero--compact">
          <p class="eyebrow">Como ajudar</p>
          <h1 class="title-1">Quatro caminhos</h1>
          <p class="lede">
            O que faz este projeto existir é a corre&#xE7;&#xE3;o constante. Toda contribution
            verificada vira dado público.
          </p>
        </div>

        <div class="grid grid--2">
          ${cards
            .map(
              (c) => `
            <article class="card card--help">
              <span class="tile__icon" aria-hidden="true">${escapeHtml(c.icone)}</span>
              <h2 class="title-3">${escapeHtml(c.titulo)}</h2>
              <p class="lede">${escapeHtml(c.texto)}</p>
              <button type="button" class="btn btn--ghost" data-suggest data-press="scale">${escapeHtml(c.acao)}</button>
            </article>`,
            )
            .join('')}
        </div>
      </div>
    </section>
  `;

  return {
    title: 'Como ajudar',
    html,
    mount(root) {
      root.querySelectorAll('[data-suggest]').forEach((btn) => {
        btn.addEventListener('click', () => {
          import('../forms.js').then(({ abrirSugestao }) => abrirSugestao({ anchor: btn }));
        });
      });
    },
  };
}
