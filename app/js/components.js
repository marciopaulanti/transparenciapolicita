/* ============================================================================
   components.js — peças compartilhadas
   ---------------------------------------------------------------------------
   Regras de conteúdo aplicadas em todas as peças:
   · dado ausente é "—" (com o motivo quando existe), nunca 0;
   · cor semântica só para estado do dado (voto, ausência, licença), nunca
     para julgar a pessoa;
   · todo bloco de dado carrega a fonte e a data da última atualização.
   ========================================================================== */

import { CIDADES, normalizar } from './data/fixtures.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------- formatação */

export function numero(value, { decimals = 0 } = {}) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function moeda(value, { compacto = false } = {}) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: compacto ? 'compact' : 'standard',
    maximumFractionDigits: compacto ? 1 : 0,
  });
}

export function percentual(value, { decimals = 1 } = {}) {
  if (value === null || value === undefined) return '—';
  return `${numero(value, { decimals })}%`;
}

export function dataBR(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  if (!ano) return iso;
  return `${dia}/${mes}/${ano}`;
}

/** "—" com motivo acessível. */
export function dash(reason = 'Dado não publicado pela fonte') {
  const title = reason ? ` title="${escapeHtml(reason)}"` : '';
  return `<span class="dash"${title} aria-label="dado não disponível">—</span>`;
}

/* ---------------------------------------------------------------- pessoas */

export function iniciais(nome) {
  const partes = String(nome).trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function avatar(pessoa, { tamanho = 'md' } = {}) {
  if (pessoa.foto) {
    return `<img class="avatar avatar--${tamanho}" src="${escapeHtml(pessoa.foto)}" alt="" />`;
  }
  return `<span class="avatar avatar--${tamanho} avatar--initials" aria-hidden="true">${escapeHtml(
    iniciais(pessoa.nome),
  )}</span>`;
}

export function situacaoPill(pessoa) {
  const mapa = {
    em_exercicio: { texto: 'Em exercício', tom: 'ok' },
    mandato_interrompido: { texto: 'Mandato interrompido', tom: 'alerta' },
    suplente: { texto: 'Suplente', tom: 'neutro' },
    nao_eleito: { texto: 'Não eleito', tom: 'neutro' },
  };
  const s = mapa[pessoa.situacao] || mapa.em_exercicio;
  return `<span class="pill pill--${s.tom}">${s.texto}</span>`;
}

/**
 * Linha de pessoa: nome, cargo, UF, partido.
 * O partido aparece como identidade da cadeira, com sigla em texto.
 */
export function personRow(pessoa, { href, compative = false, suffix = '' } = {}) {
  const tag = href ? 'a' : 'div';
  const attrs = href ? `href="${escapeHtml(href)}"` : '';
  return `
    <${tag} class="row" ${attrs} data-press="highlight">
      ${avatar(pessoa)}
      <span class="row__text">
        <span class="row__name">${escapeHtml(pessoa.nome)}</span>
        <span class="row__meta">${escapeHtml(pessoa.cargo)} · ${escapeHtml(pessoa.uf)}${
          pessoa.municipio ? ` · ${escapeHtml(pessoa.municipio)}` : ''
        } <span class="row__party">${escapeHtml(pessoa.partido)}</span></span>
      </span>
      ${compative ? `<span class="row__action row__action--add">Comparar</span>` : ''}
      ${suffix}
      <svg class="row__chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </${tag}>
  `;
}

/* ------------------------------------------------------------- indicadores */

export function bigStat({ valor, rotulo, sub = '', fonte = '', live = false }) {
  return `
    <div class="bigstat">
      <p class="bigstat__value">${valor}${live ? '<span class="live-dot" aria-hidden="true"></span>' : ''}</p>
      <p class="bigstat__label">${rotulo}</p>
      ${sub ? `<p class="bigstat__sub">${sub}</p>` : ''}
      ${fonte ? `<p class="source source--inline">${fonte}</p>` : ''}
    </div>
  `;
}

/**
 * Card de métrica. `missing: true` mostra "—" e o motivo.
 */
export function metricCard({ label, value, unit = '', period = '', missing = false, reason = '', note = '' }) {
  return `
    <div class="metric ${missing ? 'metric--missing' : ''}">
      <p class="metric__label">${escapeHtml(label)}</p>
      <p class="metric__value">${missing ? dash(reason) : value}${
        unit && !missing ? `<span class="metric__unit">${escapeHtml(unit)}</span>` : ''
      }</p>
      ${period ? `<p class="metric__period">${escapeHtml(period)}</p>` : ''}
      ${note ? `<p class="metric__note">${note}</p>` : ''}
    </div>
  `;
}

export function sourceNote(text, extra = '') {
  return `
    <p class="source">
      <span class="source__label">Fonte</span>
      <span class="source__value">${escapeHtml(text)}</span>
      ${extra ? `<span class="source__extra">${extra}</span>` : ''}
    </p>
  `;
}

export function emptyState({ title, reason, action = '' }) {
  return `
    <div class="empty">
      <p class="empty__title">${escapeHtml(title)}</p>
      ${reason ? `<p class="empty__reason">${reason}</p>` : ''}
      ${action}
    </div>
  `;
}

export function pill(text, { pressed = false, href = '', tag = 'button', type = 'button' } = {}) {
  const tagName = href ? 'a' : tag;
  const attrs = href
    ? `href="${escapeHtml(href)}"`
    : `${tagName === 'button' ? `type="${type}"` : ''}`;
  return `
    <${tagName} class="chip ${pressed ? 'is-pressed' : ''}" ${attrs}
      ${pressed ? 'aria-pressed="true"' : ''} data-press="highlight">
      ${escapeHtml(text)}
    </${tagName}>
  `;
}

export function sectionHead({ eyebrow = '', title, sub = '', action = '' }) {
  return `
    <div class="section__head">
      <div>
        ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
        <h2 class="title-2">${title}</h2>
        ${sub ? `<p class="lede">${sub}</p>` : ''}
      </div>
      ${action}
    </div>
  `;
}

/** Barra de votos: cor só para o estado do voto (nunca bom/ruim). */
export function voteBar(votacao) {
  if (!votacao) return dash('Sem registro de votação');
  const total = Object.values(votacao).reduce((a, b) => a + b, 0) || 1;
  const chaves = [
    ['sim', 'Sim', 'var(--data-sim)'],
    ['nao', 'Não', 'var(--data-nao)'],
    ['abstencao', 'Abstenção', 'var(--data-licenca)'],
    ['licenca', 'Licença', 'var(--data-licenca)'],
    ['ausente', 'Não compareceu', 'var(--data-ausente)'],
  ];
  const segmentos = chaves
    .filter(([chave]) => votacao[chave])
    .map(
      ([chave, rotulo, cor]) => `
        <span class="votebar__seg" style="flex: ${votacao[chave]}; background: ${cor}"
              title="${rotulo}: ${votacao[chave]}"></span>`,
    )
    .join('');
  const legenda = chaves
    .filter(([chave]) => votacao[chave])
    .map(
      ([chave, rotulo, cor]) =>
        `<span class="votebar__key"><i style="background:${cor}"></i>${rotulo} ${votacao[chave]}</span>`,
    )
    .join('');
  return `
    <div class="votebar" role="img" aria-label="Distribuição dos votos em ${total} votações">
      <div class="votebar__track">${segmentos}</div>
      <div class="votebar__legend">${legenda}</div>
    </div>
  `;
}

/* ------------------------------------------------------------------ toast */

export function toast(message, { acao = '' } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${escapeHtml(message)}</span>${acao}`;
  region.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 240);
  }, 2600);
}

/* -------------------------------------------------------------- combobox */

/**
 * Combobox de cidades, compartilhado pela home e por "Me representa".
 *
 * Padrão ARIA 1.2 (combobox com `aria-activedescendant`): o foco fica no
 * campo e o item em destaque é apontado por id. Setas movem a seleção,
 * Home/End vão aos extremos, Enter escolhe o item destacado e Escape fecha.
 * O mesmo comportamento nas duas telas — não há duas versões do controle.
 */
export function montarComboboxCidade(box, { onPick, max = 6 } = {}) {
  const input = box.querySelector('input');
  const list = box.querySelector('ul');
  if (!input || !list) return null;

  const prefix = (list.id || 'city').replace(/[^a-z0-9]/gi, '') || 'city';
  const itens = () => Array.from(list.querySelectorAll('[role="option"]'));
  const indiceRealcado = () => itens().findIndex((o) => o.getAttribute('aria-selected') === 'true');

  const fechar = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    list.innerHTML = '';
    input.removeAttribute('aria-activedescendant');
  };

  const realcar = (indice) => {
    const lista = itens();
    if (!lista.length) return;
    const i = Math.max(0, Math.min(lista.length - 1, indice));
    lista.forEach((o, k) => o.setAttribute('aria-selected', k === i ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', lista[i].id);
    lista[i].scrollIntoView({ block: 'nearest' });
  };

  const abrir = (cidades) => {
    if (!cidades.length) return fechar();
    list.innerHTML = cidades
      .map(
        (c, i) => `
        <li class="combobox__item" role="option" id="${prefix}-opt-${i}"
            aria-selected="false" aria-label="${escapeHtml(c.nome)}, ${escapeHtml(c.uf)}"
            data-cidade="${escapeHtml(c.nome)}" data-uf="${escapeHtml(c.uf)}" data-press="scale">
          <span class="combobox__city">${escapeHtml(c.nome)}</span>
          <span class="combobox__uf">${escapeHtml(c.uf)}</span>
        </li>`,
      )
      .join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const escolher = (nome) => {
    if (onPick) onPick(nome);
  };

  input.addEventListener('input', () => {
    const termo = normalizar(input.value);
    if (!termo) return fechar();
    abrir(CIDADES.filter((c) => normalizar(c.nome).startsWith(termo)).slice(0, max));
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      fechar();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!itens().length) return;
      event.preventDefault();
      const atual = indiceRealcado();
      realcar(event.key === 'ArrowDown' ? atual + 1 : atual - 1);
      return;
    }
    if ((event.key === 'Home' || event.key === 'End') && itens().length) {
      event.preventDefault();
      realcar(event.key === 'Home' ? 0 : itens().length - 1);
      return;
    }
    if (event.key === 'Enter') {
      const escolhido = itens()[indiceRealcado()];
      if (escolhido) {
        event.preventDefault();
        escolher(escolhido.dataset.cidade);
        return;
      }
      const termo = normalizar(input.value);
      const achado =
        CIDADES.find((c) => normalizar(c.nome) === termo) ||
        CIDADES.find((c) => normalizar(c.nome).startsWith(termo));
      if (achado) {
        event.preventDefault();
        escolher(achado.nome);
      }
    }
  });

  list.addEventListener('click', (event) => {
    const item = event.target.closest('[role="option"]');
    if (!item) return;
    escolher(item.dataset.cidade);
  });

  input.addEventListener('blur', () => setTimeout(fechar, 120));

  return { abrir, fechar };
}
