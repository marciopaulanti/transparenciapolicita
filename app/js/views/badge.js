/* ============================================================================
   views/badge.js — o crachá
   ---------------------------------------------------------------------------
   É a tela que reúne o mandato inteiro. Três regras estruturam o layout:

   1. dado ausente vira "—" com o motivo — nunca 0, nunca cor de alerta;
   2. o bloco que falta é contado e declarado ("Faltam N dados neste crachá"),
      porque esconder a lacuna é pior que mostrá-la;
   3. todo bloco traz a fonte oficial e a data da última atualização.
   ========================================================================== */

import { historicoDe, nomeDoPartido, PESSOAS, PROJETO } from '../data/fixtures.js';
import {
  escapeHtml,
  metricCard,
  moeda,
  numero,
  percentual,
  situacaoPill,
  sourceNote,
  voteBar,
} from '../components.js';
import { abrirMonitor, abrirSugestao } from '../forms.js';

const REMUNERACAO = {
  senador: 41350,
  deputado_federal: 41350,
  deputado_estadual: 32800,
  prefeito: 24500,
  vereador: 11200,
};

const ANOS = [2026, 2025, 2024];

export function badgeView({ params, query }) {
  const pessoa = pessoaPorId(params.id);
  if (!pessoa) {
    return {
      title: 'Pessoa não encontrada',
      html: `<section class="view"><div class="page">
        <h1 class="title-1">Não encontramos esse crachá</h1>
        <p class="lede">O endereço pode ter mudado ou a pessoa pode não estar na base.</p>
        <p><a class="btn btn--primary" href="#/me" data-press="scale">Voltar para Me representa</a></p>
      </div></section>`,
    };
  }

  const anoAtivo = Number(query.ano) || 0;
  const historico = historicoDe(pessoa);
  const votosAno = anoAtivo ? historico.find((h) => h.ano === anoAtivo) : null;
  const patrimonioAno = anoAtivo
    ? anoAtivo === 2026
      ? pessoa.patrimonio
      : anoAtivo === 2025
        ? { valor: pessoa.patrimonio?.anterior, ano: 2025, anterior: null }
        : null
    : pessoa.patrimonio;

  const faltando = contarFaltantes(pessoa);

  const html = `
    <section class="view view--badge">
      <div class="page page--narrow">
        <nav class="crumbs" aria-label="Trilha">
          <a href="#/">Brasil</a>
          <span aria-hidden="true">›</span>
          <a href="#/uf/${pessoa.uf}">${escapeHtml(pessoa.uf)}</a>
          ${pessoa.municipio ? `<span aria-hidden="true">›</span><span>${escapeHtml(pessoa.municipio)}</span>` : ''}
          <span aria-hidden="true">›</span>
          <span aria-current="page">${escapeHtml(pessoa.nome)}</span>
        </nav>

        <article class="badge">
          <header class="badge__head">
            <div class="badge__identity">
              <span class="avatar avatar--xl avatar--initials" aria-hidden="true">${iniciaisDe(pessoa.nome)}</span>
              <div class="badge__idtext">
                <h1 class="badge__name">${escapeHtml(pessoa.nome)}</h1>
                <p class="badge__role">${escapeHtml(pessoa.cargo)} · ${escapeHtml(pessoa.uf)}${
                  pessoa.municipio ? ` · ${escapeHtml(pessoa.municipio)}` : ''
                }</p>
                <p class="badge__tags">
                  <span class="pill pill--party" title="${escapeHtml(
                    `${pessoa.partido} · ${nomeDoPartido(pessoa.partido)}`,
                  )}">${escapeHtml(pessoa.partido)}</span>
                  ${situacaoPill(pessoa)}
                  ${pessoa.titular ? '<span class="pill">Titular</span>' : '<span class="pill pill--neutro">Suplente</span>'}
                </p>
                <p class="badge__mandate">
                  Mandato de ${escapeHtml(pessoa.mandato.inicio.slice(0, 4))} a ${escapeHtml(pessoa.mandato.fim.slice(0, 4))}
                </p>
              </div>
            </div>
            <div class="badge__actions">
              <button type="button" class="btn btn--primary" data-monitor="${escapeHtml(pessoa.id)}" data-press="scale">
                Monitorar
              </button>
              <button type="button" class="btn btn--ghost" data-share="${escapeHtml(pessoa.id)}" data-press="scale">
                Compartilhar
              </button>
            </div>
          </header>

          ${
            faltando > 0
              ? `<div class="disclosure" role="note">
                  <p class="disclosure__title">${
                    faltando === 1 ? 'Falta 1 dado neste crachá' : `Faltam ${faltando} dados neste crachá`
                  }</p>
                  <p class="disclosure__text">
                    ${faltando === 1 ? 'Um bloco' : `${faltando} blocos`} não ${
                      faltando === 1 ? 'foi publicado' : 'foram publicados'
                    } pela fonte até ${escapeHtml(PROJETO.atualizadoEm)}.
                    ${faltando === 1 ? 'Ele aparece' : 'Eles aparecem'} como “—” abaixo.
                  </p>
                  <ul class="disclosure__list">
                    ${lacunas(pessoa)
                      .map(
                        (l) => `<li><span class="disclosure__label">${escapeHtml(l.nome)}</span>
                          <span class="disclosure__why">${escapeHtml(l.motivo)}</span></li>`,
                      )
                      .join('')}
                  </ul>
                </div>`
              : `<div class="disclosure disclosure--ok" role="note">
                  <p class="disclosure__title">Todos os blocos deste crachá têm dado publicado</p>
                </div>`
          }
        </article>

        <section class="section" aria-labelledby="h-metricas">
          <div class="section__head">
            <div>
              <p class="eyebrow">Panorama</p>
              <h2 class="title-2" id="h-metricas">O que o registro mostra</h2>
            </div>
          </div>
          <div class="metricgrid">
            ${metricCard({
              label: 'Remuneração mensal',
              value: moeda(REMUNERACAO[pessoa.cargoTipo] ?? null),
              period: 'vigência do mandato',
              note: 'Valor legal do cargo, não gasto.',
            })}
            ${metricCard({
              label: 'Cota parlamentar',
              value: pessoa.cota ? moeda(pessoa.cota.valor) : '',
              missing: !pessoa.cota,
              reason: pessoa.cotaMotivo || 'A fonte não publica cota para este cargo.',
              period: pessoa.cota ? String(pessoa.cota.ano) : '',
            })}
            ${metricCard({
              label: 'Patrimônio declarado',
              value: patrimonioAno ? moeda(patrimonioAno.valor) : '',
              missing: !patrimonioAno || patrimonioAno.valor === null,
              reason: pessoa.patrimonioMotivo || 'Não há declaração para este ano.',
              period: patrimonioAno ? `declarado em ${patrimonioAno.ano}` : '',
            })}
            ${metricCard({
              label: 'Votos favoráveis',
              value: votosAno ? numero(votosAno.sim) : numero(pessoa.votacao?.sim ?? null),
              missing: !pessoa.votacao && !votosAno,
              reason: pessoa.votacaoMotivo || 'Sem registro de votação.',
              period: anoAtivo ? `em ${anoAtivo}` : 'no mandato',
            })}
            ${metricCard({
              label: 'Presença em sessões',
              value: pessoa.presenca ? `${numero(pessoa.presenca.compareceu)} de ${numero(pessoa.presenca.sessoes)}` : '',
              missing: !pessoa.presenca,
              reason: pessoa.presencaMotivo || 'A fonte não publica presença.',
              period: pessoa.presenca ? percentual((pessoa.presenca.compareceu / pessoa.presenca.sessoes) * 100) : '',
            })}
            ${metricCard({
              label: 'Propostas',
              value: numero(pessoa.propostas.length),
              period: `${pessoa.propostas.filter((p) => p.status === 'viram lei').length} viraram lei`,
            })}
            ${metricCard({
              label: 'Emendas',
              value: numero(pessoa.emendas.length),
              period: pessoa.emendas.length
                ? moeda(pessoa.emendas.reduce((s, e) => s + e.valor, 0))
                : 'nenhuma registrada',
            })}
            ${metricCard({
              label: 'Campanhas',
              value: pessoa.campanha ? moeda(pessoa.campanha.arrecadado) : '',
              missing: !pessoa.campanha,
              reason: pessoa.campanhaMotivo || 'A fonte não publica dados de campanha para este registro.',
              period: pessoa.campanha ? `em ${pessoa.campanha.ano}` : '',
            })}
            ${metricCard({
              label: 'Última eleição',
              value: pessoa.ultimoPleito ? percentual(pessoa.ultimoPleito.percentual) : '',
              period: pessoa.ultimoPleito
                ? `${numero(pessoa.ultimoPleito.votos)} votos · ${pessoa.ultimoPleito.turno}º turno`
                : '',
            })}
          </div>
          ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Blocos sem dado aparecem como —')}
        </section>

        <section class="section" aria-labelledby="h-anos">
          <div class="section__head">
            <div>
              <p class="eyebrow">Período</p>
              <h2 class="title-2" id="h-anos">Registro por ano</h2>
            </div>
          </div>
          <div class="tabs" role="tablist" aria-label="Ano do registro">
            <a id="aba-ano-todos" class="tab ${!anoAtivo ? 'is-selected' : ''}" role="tab" aria-selected="${!anoAtivo}"
               aria-controls="painel-ano" tabindex="${anoAtivo ? '-1' : '0'}" data-focus-key="aba-ano-todos"
               href="#/p/${pessoa.id}" data-press="highlight">Todos</a>
            ${ANOS.map(
              (ano) => `
              <a id="aba-ano-${ano}" class="tab ${anoAtivo === ano ? 'is-selected' : ''}" role="tab"
                 aria-selected="${anoAtivo === ano}" aria-controls="painel-ano"
                 tabindex="${anoAtivo === ano ? '0' : '-1'}" data-focus-key="aba-ano-${ano}"
                 href="#/p/${pessoa.id}?ano=${ano}" data-press="highlight">${ano}</a>`,
            ).join('')}
          </div>
        </section>

        <div id="painel-ano" role="tabpanel" tabindex="-1" aria-labelledby="aba-ano-${anoAtivo || 'todos'}">
        ${painelVotos(pessoa, votosAno, anoAtivo)}
        ${painelPropostas(pessoa, anoAtivo)}
        ${painelEmendas(pessoa, anoAtivo)}
        ${painelCota(pessoa, anoAtivo)}
        ${painelPatrimonio(pessoa, patrimonioAno)}
        </div>
        ${painelCampanha(pessoa)}

        <section class="section" aria-labelledby="h-erros">
          <h2 class="title-2" id="h-erros">Algum dado aqui está errado?</h2>
          <p class="lede">
            Toda correção é conferida na fonte oficial antes de entrar. Avisar leva menos de um minuto.
          </p>
          <p>
            <button type="button" class="btn btn--ghost" data-suggest="${escapeHtml(pessoa.id)}" data-press="scale">
              Reportar erro neste crachá
            </button>
          </p>
        </section>
      </div>
    </section>
  `;

  return {
    title: `${pessoa.nome} — ${pessoa.cargo}`,
    html,
    mount(root) {
      root.querySelector('[data-monitor]')?.addEventListener('click', (event) => {
        abrirMonitor(pessoa, event.currentTarget);
      });
      root.querySelector('[data-share]')?.addEventListener('click', async () => {
        const url = `${location.origin}${location.pathname}#/p/${pessoa.id}`;
        try {
          await navigator.clipboard.writeText(url);
          import('../components.js').then(({ toast }) => toast('Link do crachá copiado'));
        } catch {
          import('../components.js').then(({ toast }) => toast('Link do crachá: ' + url));
        }
      });
      root.querySelector('[data-suggest]')?.addEventListener('click', () => {
        abrirSugestao({ contexto: `Crachá de ${pessoa.nome}` });
      });
      montarAbasAno(root);
    },
  };
}

/**
 * Abas de ano: o tablist usa tabindex móvel (roving tabindex), então só a aba
 * selecionada entra na ordem de tabulação. As setas é que percorrem as demais.
 */
function montarAbasAno(root) {
  const list = root.querySelector('[role="tablist"]');
  if (!list) return;
  const abas = Array.from(list.querySelectorAll('[role="tab"]'));
  if (!abas.length) return;

  list.addEventListener('keydown', (event) => {
    const atual = abas.findIndex((a) => a === document.activeElement);
    if (atual < 0) return;

    // Âncora não reage ao espaço: sem isto, o espaço só rolaria a página e a
    // aba jamais mudaria.
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      abas[atual].click();
      return;
    }

    let proximo = -1;
    if (event.key === 'ArrowRight') proximo = (atual + 1) % abas.length;
    else if (event.key === 'ArrowLeft') proximo = (atual - 1 + abas.length) % abas.length;
    else if (event.key === 'Home') proximo = 0;
    else if (event.key === 'End') proximo = abas.length - 1;
    if (proximo < 0) return;
    event.preventDefault();
    const alvo = abas[proximo];
    // foco imediato: a navegação acontece no Enter/espaço, como manda o padrão
    alvo.focus({ preventScroll: true });
  });
}

/* ---------------------------------------------------------------- painéis */

function painelVotos(pessoa, votosAno, anoAtivo) {
  const votacao = votosAno || pessoa.votacao;
  const titulo = anoAtivo ? `Votações em ${anoAtivo}` : 'Votações no mandato';
  if (!votacao) {
    return `
      <section class="section panel" aria-labelledby="h-votos">
        <h2 class="title-3" id="h-votos">${titulo}</h2>
        ${`<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
          <p class="empty__reason">A fonte não publica o registro de votação desta pessoa.</p></div>`}
      </section>`;
  }
  return `
    <section class="section panel" aria-labelledby="h-votos">
      <h2 class="title-3" id="h-votos">${titulo}</h2>
      ${voteBar(votacao)}
      <ul class="notes">
        <li>Licença e missão oficial são estados do mandato, não ausência: por isso são contados à parte.</li>
        <li>${pessoa.cargoTipo === 'senador' ? 'O Senado não publica lista nominal de presença em votação.' : 'Presença é a contagem de sessões de votação nominal em que a pessoa esteve presente.'}</li>
        ${
          pessoa.votacao && anoAtivo
            ? `<li>Este ano responde por ${numero(votosAno.sim)} votos favoráveis de ${numero(pessoa.votacao.sim)} do mandato inteiro.</li>`
            : ''
        }
      </ul>
      ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Placar nominal oficial')}
    </section>
  `;
}

function painelPropostas(pessoa, anoAtivo) {
  const lista = anoAtivo ? pessoa.propostas.filter((p) => p.ano === anoAtivo) : pessoa.propostas;
  return `
    <section class="section panel" aria-labelledby="h-propostas">
      <h2 class="title-3" id="h-propostas">Propostas e o que virou lei</h2>
      ${
        lista.length
          ? `<div class="list list--inset">
              ${lista
                .map(
                  (p) => `
                <div class="row row--static">
                  <span class="row__text">
                    <span class="row__name">${escapeHtml(p.titulo)}</span>
                    <span class="row__meta">${escapeHtml(p.tipo)} · ${p.ano} · ${escapeHtml(p.status)}</span>
                  </span>
                  <span class="tag tag--${statusTone(p.status)}">${escapeHtml(p.status)}</span>
                </div>`,
                )
                .join('')}
            </div>`
          : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
              <p class="empty__reason">${anoAtivo ? `Nenhuma proposta de ${anoAtivo} aparece na fonte.` : 'Nenhuma proposição registrada na fonte para este mandato.'}</p></div>`
      }
      ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Texto oficial na fonte')}
    </section>
  `;
}

function painelEmendas(pessoa, anoAtivo) {
  const lista = anoAtivo ? pessoa.emendas.filter((e) => e.ano === anoAtivo) : pessoa.emendas;
  const total = lista.reduce((s, e) => s + e.valor, 0);
  return `
    <section class="section panel" aria-labelledby="h-emendas">
      <h2 class="title-3" id="h-emendas">Emendas que mandou</h2>
      ${
        lista.length
          ? `<div class="list list--inset">
              ${lista
                .map(
                  (e) => `
                <div class="row row--static">
                  <span class="row__text">
                    <span class="row__name">${escapeHtml(e.descricao)}</span>
                    <span class="row__meta">${escapeHtml(e.area)} · ${escapeHtml(e.destino)} · ${e.ano}</span>
                  </span>
                  <span class="row__amount">${moeda(e.valor)}</span>
                </div>`,
                )
                .join('')}
            </div>
            <p class="panel__total">Total no período: <strong>${moeda(total)}</strong></p>`
          : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
              <p class="empty__reason">${anoAtivo ? `Nenhuma emenda de ${anoAtivo} consta na fonte.` : 'Nenhuma emenda registrada na fonte para este mandato.'}</p></div>`
      }
      ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Emendasções oficiais')}
    </section>
  `;
}

function painelCota(pessoa, anoAtivo) {
  const cota = pessoa.cota;
  const ano = anoAtivo && cota ? anoAtivo : cota?.ano;
  const itens = cota?.itens ?? [];
  return `
    <section class="section panel" aria-labelledby="h-cota">
      <h2 class="title-3" id="h-cota">Dinheiro da cota parlamentar</h2>
      ${
        cota
          ? `<p class="panel__lead">Total de <strong>${moeda(cota.valor)}</strong> em ${ano}.</p>
             ${
               itens.length
                 ? `<div class="list list--inset">
                    ${itens
                      .map(
                        (i) => `
                      <div class="row row--static">
                        <span class="row__text">
                          <span class="row__name">${escapeHtml(i.descricao)}</span>
                          <span class="row__meta">${i.nota ? `Nota ${escapeHtml(i.nota)} · ${escapeHtml(i.fornecedor)}` : 'Sem nota fiscal publicada'}</span>
                        </span>
                        <span class="row__amount">${moeda(i.valor)}</span>
                      </div>`,
                      )
                      .join('')}
                    </div>
                    <p class="panel__note">Item sem nota fiscal aparece com o fornecedor como “—”: a fonte não o publica.</p>`
                 : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
                    <p class="empty__reason">A fonte ainda não detalhou os itens desta cota.</p></div>`
             }`
          : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
              <p class="empty__reason">${escapeHtml(pessoa.cotaMotivo || 'A fonte não publica cota para este cargo.')}</p></div>`
      }
      ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`)}
    </section>
  `;
}

function painelPatrimonio(pessoa, patrimonio) {
  return `
    <section class="section panel" aria-labelledby="h-patrimonio">
      <h2 class="title-3" id="h-patrimonio">Patrimônio declarado</h2>
      ${
        patrimonio && patrimonio.valor !== null
          ? `<p class="panel__lead">${moeda(patrimonio.valor)} declarados em ${patrimonio.ano}.${
              patrimonio.anterior
                ? ` Era ${moeda(patrimonio.anterior)} em ${patrimonio.ano - 1}.`
                : ''
            }</p>`
          : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
              <p class="empty__reason">${escapeHtml(pessoa.patrimonioMotivo || 'A fonte não publica declaração para este registro.')}</p></div>`
      }
      ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Declaração de bens')}
    </section>
  `;
}

function painelCampanha(pessoa) {
  const c = pessoa.campanha;
  return `
    <section class="section panel" aria-labelledby="h-campanha">
      <h2 class="title-3" id="h-campanha">Campanhas</h2>
      ${
        c
          ? `<p class="panel__lead">Arrecadou ${moeda(c.arrecadado)} e gastou ${moeda(c.gasto)} em ${c.ano}.</p>
             ${
               c.doadores.length
                 ? `<div class="list list--inset">
                    ${c.doadores
                      .map(
                        (d) => `
                      <div class="row row--static">
                        <span class="row__text"><span class="row__name">${escapeHtml(d.nome)}</span></span>
                        <span class="row__amount">${moeda(d.valor)}</span>
                      </div>`,
                      )
                      .join('')}
                    </div>`
                 : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
                    <p class="empty__reason">A fonte não detalha doadores para esta campanha neste protótipo.</p></div>`
             }`
          : `<div class="empty"><p class="empty__title">Nenhum destes dados está no site</p>
              <p class="empty__reason">A fonte não publica dados de campanha para este registro.</p></div>`
      }
      ${sourceNote(`${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}`, 'Prestação de contas ao TSE')}
    </section>
  `;
}

/* --------------------------------------------------------------- utilidade */

function contarFaltantes(pessoa) {
  return lacunas(pessoa).length;
}

/**
 * Blocos sem dado e o motivo de cada um. A lacuna é declarada: o site diz
 * o que falta e por quê, em vez de esconder o bloco ou transformá-lo em 0.
 */
function lacunas(pessoa) {
  const blocos = [
    ['Cota parlamentar', pessoa.cota, pessoa.cotaMotivo],
    ['Patrimônio declarado', pessoa.patrimonio, pessoa.patrimonioMotivo],
    ['Presença em sessões', pessoa.presenca, pessoa.presencaMotivo],
    ['Votações no mandato', pessoa.votacao, pessoa.votacaoMotivo],
    ['Campanhas', pessoa.campanha, pessoa.campanhaMotivo],
  ];
  return blocos
    .filter(([, valor]) => valor === null || valor === undefined)
    .map(([nome, , motivo]) => ({
      nome,
      motivo: motivo || 'A fonte oficial não publica este dado para este registro.',
    }));
}

function statusTone(status) {
  if (status === 'viram lei') return 'ok';
  if (status === 'arquivado') return 'neutro';
  return 'ativo';
}

function iniciaisDe(nome) {
  const partes = String(nome).trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function pessoaPorId(id) {
  return PESSOAS.find((p) => p.id === id) || null;
}

/** Motivos, na ordem em que aparecem no crachá. */
function motivosDaLacuna(pessoa) {
  const motivos = [];
  if (!pessoa.presenca && pessoa.presencaMotivo) motivos.push(pessoa.presencaMotivo);
  if (!pessoa.patrimonio && pessoa.patrimonioMotivo) motivos.push(pessoa.patrimonioMotivo);
  if (!pessoa.cota && pessoa.cotaMotivo) motivos.push(pessoa.cotaMotivo);
  return motivos;
}
