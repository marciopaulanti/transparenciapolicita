/* ============================================================================
   views/about.js — método
   ---------------------------------------------------------------------------
   A página mais importante do produto não é uma tela de dados: é a que diz
   o que este site se recusa a fazer. Sem ela, o resto é só uma planilha.
   ========================================================================== */

import { PROJETO } from '../data/dados.js';

export function aboutView() {
  const html = `
    <section class="view view--about">
      <div class="page page--narrow">
        <div class="hero hero--compact">
          <p class="eyebrow">Método</p>
          <h1 class="title-1">O que este site faz — e o que ele se recusa a fazer</h1>
          <p class="lede">
            Transparência só vale alguma coisa se as regras forem públicas. Estas são as nossas.
          </p>
        </div>

        <section class="section" aria-labelledby="h-regra-1">
          <h2 class="title-2" id="h-regra-1">Regra 1 — Não existe nota, ranking nem cor de bom ou ruim</h2>
          <p class="lede">
            Não publicamos nota de político, não ordenamos pessoas da melhor para a pior e não
            pintamos um mandato como “verde” ou “vermelho”. A cor, quando existe, só identifica
            um estado do dado: um voto favorável, uma ausência, uma licença, um valor em um mapa.
          </p>
          <p class="lede">
            Isso vale inclusive na comparação: o comparador alinha o mesmo campo entre cargos
            diferentes e mostra a lacuna quando um dos lados não tem o dado. Um painel honesto
            pode incomodar — é para isso que ele serve.
          </p>
        </section>

        <section class="section" id="faltando" aria-labelledby="h-regra-2">
          <h2 class="title-2" id="h-regra-2">Regra 2 — Dado ausente é “—”, nunca zero</h2>
          <p class="lede">
            Se a fonte oficial não publica um número, o número não existe para nós também.
            Mostramos “—” e, quando dá, o motivo: a Câmara não publica lista de presença, o
            Senado não publica lista de presença nominal, a prefeitura não detalha a nota fiscal.
          </p>
          <p class="lede">
            Trocar ausência por zero é o jeito mais rápido de mentir com um gráfico: faria um
            mandato sem registro parecer um mandato sem atividade.
          </p>
          <blockquote class="quote">
            <p>Zero é uma afirmação. Travessão é uma admissão.</p>
          </blockquote>
        </section>

        <section class="section" aria-labelledby="h-regra-3">
          <h2 class="title-2" id="h-regra-3">Regra 3 — Todo número vem de fonte oficial</h2>
          <p class="lede">
            Votação vem do placar nominal, cota vem da nota fiscal, patrimônio vem da declaração
            de bens, campanha vem da prestação de contas ao TSE, presença vem da ata de sessão.
            Cada bloco carrega a fonte e a data da última atualização.
          </p>
          <p class="lede">
            Quando duas fontes divergem, a divergência aparece. Não resolvemos no escuro.
          </p>
        </section>

        <section class="section" id="fontes" aria-labelledby="h-fontes">
          <h2 class="title-2" id="h-fontes">De onde vêm os dados</h2>
          <div class="list list--inset">
            <div class="row row--static">
              <span class="row__text">
                <span class="row__name">Câmara dos Deputados e Senado Federal</span>
                <span class="row__meta">Placar nominal de votação, presença em sessão, proposições e autoria</span>
              </span>
              <span class="tag">diário</span>
            </div>
            <div class="row row--static">
              <span class="row__text">
                <span class="row__name">Assembleias estaduais e câmaras municipais</span>
                <span class="row__meta">Votações locais, moções e atas de sessão</span>
              </span>
              <span class="tag">diário</span>
            </div>
            <div class="row row--static">
              <span class="row__text">
                <span class="row__name">TSE</span>
                <span class="row__meta">Prestação de contas de campanha, candidatos e resultados de eleição</span>
              </span>
              <span class="tag">por eleição</span>
            </div>
            <div class="row row--static">
              <span class="row__text">
                <span class="row__name">Receita Federal</span>
                <span class="row__meta">Arrecadação por tributo, estado e mês</span>
              </span>
              <span class="tag">mensal</span>
            </div>
            <div class="row row--static">
              <span class="row__text">
                <span class="row__name">IBGE</span>
                <span class="row__meta">Municípios, estados e regiões</span>
              </span>
              <span class="tag">anual</span>
            </div>
            <div class="row row--static">
              <span class="row__text">
                <span class="row__name">Portais de dados abertos</span>
                <span class="row__meta">Cobertura de publicação de salários, atas e gastos</span>
              </span>
              <span class="tag">varia</span>
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="h-correcoes">
          <h2 class="title-2" id="h-correcoes">Como uma correção entra</h2>
          <p class="lede">
            Ninguém publica direto. Um aviso chega, a gente confere na fonte oficial e só então
            o dado muda. Correção de terceiro não é publishada antes de conferida — inclusive
            quando é sobre alguém que o site não acompanha.
          </p>
        </section>

        <section class="section" aria-labelledby="h-nao-fazemos">
          <h2 class="title-2" id="h-nao-fazemos">O que não fazemos</h2>
          <ul class="notes notes--list">
            <li>Não damos nota, nota 10, ranking de político ou “melhor mandato do ano”.</li>
            <li>Não sugerimos em quem votar.</li>
            <li>Não pintamos mandato com cor de valor.</li>
            <li>Não transformamos ausência de dado em zero.</li>
            <li>Não vendemos nem exibimos dado de terceiros sem a fonte original ao lado.</li>
          </ul>
        </section>

        <p class="note">
          Esta página e o protótipo inteiro são uma demonstração de interface. A geometria do mapa
          e a lista de estados vêm de dados públicos; as pessoas, os partidos usados nos registros
          (siglas e nomes inventados) e todos os números são fictícios. Fonte do protótipo:
          ${PROJETO.fontePadrao} · ${PROJETO.atualizadoEm}.
        </p>
      </div>
    </section>
  `;

  return { title: 'Método e neutralidade', html };
}
