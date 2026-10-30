# Recon map: Politicômetro (web, responsivo / PWA)

Scope: o loop central de transparência — **descobrir quem me representa e ver o que essa pessoa fez no mandato** — mais as áreas que o sustained (Impostômetro, Congresso, Eleições, Partidos, Governos, STF, Cargos, Quem publica) e a camada de conta/sugestão. Ver "Limites do recorte" no fim.
Para: o próprio projeto do usuário (repo `trasnparencia-política`) — um portal de transparência política próprio, em português do Brasil, com dados oficiais abertos.
Date: 2026-10-30

> **Nota de método.** O site tem proteção anti-bot; leitura direta por HTTP devolve página de desafio. Tudo abaixo foi lido no navegador real, página por página, sem conta e sem login. Nada foi lido de bundle JS, rede interna ou código-fonte. Nenhuma conta de terceiro foi acessada.

## Scope assumido

| pergunta | resposta assumida | como ajustar |
| --- | --- | --- |
| app e plataforma | Politicômetro, web responsivo + instalável (PWA) | idem |
| fatia | loop central (mapa → estado → crachá) + "Me representa" + comparador, com as áreas de apoio como should | se o recorte for menor, cortar S19–S42 do inventário e marcar as linhas `could` |
| para quem | projeto próprio de transparência política do usuário, dados oficiais abertos, público geral | — |

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Home / mapa | https://www.politicometro.org/ | contagem por cargo, mapa do Brasil com 6 camadas, A–Z |
| 2 | Camadas do mapa | `/?assunto=contas`, `?assunto=escolas`, `?assunto=obras` | estado é URL: a camada é shareable |
| 3 | Busca (dialog) | disparada pelo botão "Buscar no site" | busca política + cidade + UF, resultados agrupados |
| 4 | Quem é quem | /quem | diretório de 71.649 nomes, filtro por cargo/UF/partido/letra |
| 5 | Crachá — senador | /p/alan-rick | o "crachá" do site: cabeçalho + grade de métricas + abas por ano |
| 6 | Crachá — prefeito | /p/eduardo-cavaliere | mesmo template com dados de cidade (verba, comissões, campanhas) |
| 7 | Me representa | /representantes, `/representantes?cidade=3304557` | lista por esfera: cidade / estado / Brasília / país |
| 8 | Estado | /uf/sp | bancadas + "todo mundo no cargo hoje em SP" |
| 9 | Cidade dentro do estado | `/uf/rj?esfera=cidades&municipio=Rio de Janeiro` | formato real de rota municipal |
| 10 | Comparar | /comparar, `/comparar?p=lula-br,geraldo-alckmin` | 2 a 5 pessoas, sem nota nem ranking |
| 11 | Impostômetro | /impostos | arrecadação federal por ano/estado/imposto, Receita |
| 12 | Congresso | /congresso | agenda, votações do dia, bancadas, sessões |
| 13 | O que virou lei | /congresso/leis | 8.561 normas desde 1985, filtro por tema/autor/tipo/ano |
| 14 | Eleições | /eleicoes, /eleicoes/sp | hub, estado e resultado por cargo/turno |
| 15 | Partidos | /partidos, /partidos/pl | ideologia (pesquisa 2018), filiados, direção, emendas, similaridade de votação |
| 16 | Governos | /governos, `/governos?aba=estados`, /governos/sp, /governos/marcos, /governos/cartao | mandatos lado a lado + séries anuais |
| 17 | STF | /stf, /stf/decisoes | pauta do plégio, decisões com voto por ministro |
| 18 | Cargos | /cargos | o que cada cargo pode/não pode, por CF |
| 19 | Quem publica | /dados-abertos | mapa de cobertura de dados abertos por cidade |
| 20 | Mais vistos | /mais-vistos | contadores próprios, 24h vs desde o lançamento |
| 21 | Entrar | /entrar | login sem senha, código por e-mail |
| 22 | Sugerir (modal) | disparada pelo botão "Sugerir" | formulário com tipo, texto, nome, e-mail, cidade |
| 23 | Acessibilidade (modal) | disparada pelo rodapé | guia de leitor de tela |
| 24 | Sobre e metodologia | /sobre | neutralidade, regra de presença, fontes, correções |
| 25 | Como atualizamos | /atualizacoes | 7 grupos de fontes, frequência e última atualização |
| 26 | Como ajudar | /ajudar | 4 caminhos: mandar dado, avisar erro, espalhar, doar |
| 27 | Planos de governo | /propostas | 22.118 propostas de governo lidas do TSE |
| 28 | MCP | /mcp | 10 tools futuras — reveals o modelo de dados do time |

## Core loop

> "Ver quem me representa e o que ela fez no mandato, em no máximo três cliques: **mapa → estado → crachá**." (parafrase do /sobre)

A promessa é de transparência, não de persuasão: **todo número vem de fonte oficial, com rodapé "Fonte: X · atualizado em Y"; nunca há nota, ranking, cor de bom/ruim nem recomendação de voto.** Essa é a regra de produto mais importante do clone — ela aparece nas telas, não só no código.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Home / mapa | `/` | entrada: total de eleitos, mapa navegável, A–Z | número grande, alternador de camadas, mapa SVG, lista A–Z, nota de fonte | preenchido, contadores ao vivo, carregando |
| S02 | Mapa — camada temática | `/?assunto=contas|escolas|obras|dinheiro|votacoes` | mesmo mapa com outra métrica | legenda coroplética, pílulas de camada (pressionada) | preenchido, vazio (sem dado no lugar) |
| S03 | Busca | botão "Buscar no site" (dialog) | achar político, cidade ou UF | diálogo de busca, resultados agrupados | preenchido, sem resultado, linha de exemplos |
| S04 | Quem é quem | `/quem` | diretório completo de nomes | barra de filtros, paginação, navegação A–Z, linhas de pessoa | preenchido, vazio (filtro sem correspondência) |
| S05 | Quem é quem — filtrado | `/quem?c cargo|uf|partido|letra` | mesmo diretório com filtros | chips de cargo, seletor de UF, seletor de partido, letra inicial | preenchido, vazio |
| S06 | Crachá — topo | `/p/<slug>` | identidade + números-chave do mandato | foto, etiquetas, grade de métricas (8–10 cards), chevron de detalhe | preenchido, "Faltam N dados neste crachá", sem foto |
| S07 | Crachá — aba de um ano | `/p/<slug>` + ano | propostas, votos, presença, cota, emendas | abas de ano, painéis, listas, gráficos | preenchido, "sem registro", "senado não publica presença" |
| S08 | Crachá — monitorar | botão "Monitorar" | pedir código e acompanhar a pessoa | modal e-mail → código | vazio (e-mail), código enviado, erro |
| S09 | Me representa — escolher lugar | `/representantes` | 3 vias: cidade, estado, Brasília | busca grande, 3 linhas de exemplo, "Comparar lado a lado" | vazio, preenchido |
| S10 | Me representa — cidade | `/representantes?cidade=<ibge>` | quem representa a cidade | listas agrupadas por esfera, "+ Comparar", bloco de dado vazio | preenchido, "Nenhum destes dados está no site" |
| S11 | Me representa — estado | `/representantes?uf=SP` | quem representa o estado | listas agrupadas | preenchido, vazio |
| S12 | Me representa — Brasília | link "Em Brasília" | 3 senadores + deputados federais + presidente e vice | listas agrupadas | preenchido |
| S13 | Estado | `/uf/<uf>` | visão do estado | trilha Brasil›Região›UF, linha de números, bancadas, A–Z do estado | preenchido, vazio |
| S14 | Estado — bancada | `/uf/<uf>` seção "As bancadas" | assentos coloridos por partido | hemiciclo de pontos, filtro por partido, filtro por estado | preenchido, filtrado, vazio |
| S15 | Estado — todos no cargo | `/uf/<uf>` seção "Todo mundo no cargo" | lista filtrável do estado | barra de filtros, A–Z, linhas de pessoa | preenchido, vazio |
| S16 | Estado — cidade | `/uf/<uf>?esfera=cidades&municipio=<nome>` | Drill de município | lista de cidades, link para o crachá | preenchido, vazio |
| S17 | Comparar — seletor | `/comparar` | escolher 2 a 5 pessoas | busca por nome, duelos de exemplo | vazio, 1 selecionada, preenchido |
| S18 | Comparar — tabela | `/comparar?p=a,b[,c…]` | lado a lado sem nota | tabela de comparação, "—" para dado ausente | preenchido, valores ausentes |
| S19 | Impostômetro — federal | `/impostos` | quanto o governo federal arrecadou | abas de ano, coropleta de estados, barras do top 5, série mensal, quebra por imposto | preenchido, meses vazios ("out","nov","dez" sem dado) |
| S20 | Impostômetro — estado | clique no estado no mapa | detail do estado | totais do estado, mês a mês, por imposto | preenchido, vazio |
| S21 | Impostômetro — tributo | clique no tributo | detail do imposto | linhas de imposto | preenchido |
| S22 | Congresso — visão geral | `/congresso` | como está o Congresso | status da sessão, calendário de pauta, lista de votações, bancadas | preenchido, "sem sessão agora" |
| S23 | Congresso — votações | item da agenda | placar + como cada partido votou | card de votação, placar por partido | preenchido, "votação secreta" |
| S24 | Congresso — o que virou lei | `/congresso/leis` | 8.561 normas com filtros | busca, seletor de tema, filtro por autor, filtro por tipo, lista de anos | preenchido, filtrado, "carregar mais" |
| S25 | Congresso — detalhe de norma | item da lista | texto oficial + autor + data | painel de detalhe, link da fonte | preenchido |
| S26 | STF — visão geral | `/stf` | ministros + pauta | grade de ministros, calendário, cards de processo | preenchido, "Pedido de vista", "Suspenso" |
| S27 | STF — decisões | `/stf/decisoes` | 465 processos com voto por ministro | lista de decisões, filtro por categoria, "carregar mais" | preenchido, paginado |
| S28 | Eleições — hub | `/eleicoes` | escolher lugar + cargo | seletor de lugar, carrossel de cargos, carrossel de anos | vazio, preenchido |
| S29 | Eleições — estado | `/eleicoes/<uf>` | resultado por cargo no estado | abas de ano, abas de cargo, tabela de candidatos | preenchido |
| S30 | Eleições — resultado de cargo | `/eleicoes/<uf>?ano=2026&cargo=governador&turno=2` | placar oficial | barra de vencedor, tabela de candidatos com % de votos, "não eleito" | preenchido, "decidida no 1º turno" |
| S31 | Eleições — apurações | `/eleicoes/apuracao` | arquivo da apuração ao vivo | lista de arquivos | preenchido |
| S32 | Partidos — hub | `/partidos` | 30 partidos, esquerda→direita | escala de ideologia, gráfico de pontos, lista A–Z | preenchido |
| S33 | Partido — detalhe | `/partidos/<sigla>` | história, direção, filiados, emendas, bancadas | linha de números, história, gráficos de filiação, similitude | preenchido, vazio (sem bloco) |
| S34 | Governos — hub | `/governos` (+`?aba=estados|cidades`) | mandatos lado a lado | carrossel de mandatos, gráficos de métricas, abas Brasil/Estados/Cidades | preenchido, "mandato interrompido" |
| S35 | Governos — mandato | `/governos/<uf>` | série anual de um governo | série anual com faixas de mandato, comparação "+" (até 4) | preenchido, vazio (prefeitura sem dado) |
| S36 | Governos — marcos | `/governos/marcos` | o que marcou cada governo | seções-âncora por presidente | preenchido |
| S37 | Governos — cartão | `/governos/cartao` | cartão corporativo da Presidência | seções-âncora | preenchido |
| S38 | Planos de governo | `/propostas` | comparar propostas de até 4 candidatos | seletor de disputa, seções por tema, comparação de trechos | preenchido, vazio |
| S39 | Cargos | `/cargos` | o que cada cargo pode/não pode | grafo de relação, chips de poder, tabela de custos | preenchido |
| S40 | Quem publica | `/dados-abertos` | cobertura de dados abertos por cidade | coropleta de estados, busca de cidade, tabela por estado, "32% publicam" | preenchido, vazio |
| S41 | Mais vistos | `/mais-vistos` | o que as pessoas abrem agora | contadores ao vivo, série por hora, listas de topo, abas de origem do acesso | preenchido, ao vivo |
| S42 | Entrar | `/entrar` | login sem senha | campo de e-mail, "Mandar código" | vazio, enviado, erro |
| S43 | Sugerir | modal "Sugerir" | enviar sugestão/erro | botões de tipo, área de texto, nome, e-mail, cidade | vazio, enviado, erro |
| S44 | Sobre e metodologia | /sobre | regras do jogo (neutralidade, presença, fontes) | texto + blocos de definição | preenchido |
| S45 | Como atualizamos | /atualizacoes | 7 grupos de fontes e frequência | tabela de fontes, descrição da rotina | preenchido |
| S46 | Como ajudar | /ajudar | 4 caminhos de participação | 4 cards, código Pix | preenchido |
| S47 | MCP (em breve) | /mcp | roadmap de 10 tools de IA | lista de ferramentas | preenchido (anúncio) |
| S48 | Acessibilidade | modal do rodapé | guia de leitor de tela | guia em texto | preenchido |
| S49 | Instalar o app | CTA do rodapé | PWA | aviso de instalação | preenchido |
| S50 | Compartilhar card | botão no crachá | card de rede social | modal de card de imagem | preenchido |

## Flows

```
F01 Mapa → estado → crachá (o loop central)
    S01 → S13 → S06
    caminho feliz, cliques: 2 (clica no estado no mapa, clica no nome)
    caso limite: estado sem dado de uma camada; município sem dado aberto; estado com 645 cidades (SP) e lista gigante

F02 Digitar a cidade e ver quem me representa
    S01 (combobox "Sua cidade") → S10 → S06
    caminho feliz, cliques: 3 (digita, escolhe, clica no nome)
    caso limite: cidade homônima em outro estado (o resultado mostra "Cidade · UF"); cidade sem nenhum dado publicado

F03 Buscar um político pelo nome (de qualquer página)
    qualquer → S03 → S06
    caminho feliz, cliques: 3 (abrir busca, digitar, clicar resultado)
    caso limite: nome duplicado ("Silas Ferreira" × 3); busca sem acento; cidade digitada vira "Cidade: ver quem representa"

F04 Comparar 2 a 5 pessoas
    S17 → S18  (ou: S10 → "+ Comparar" ×N → S18)
    caminho feliz, cliques: 4 (digitar, escolher, escolher, abrir)
    caso limite: mais de 5 → bloquear; um dos lados sem o dado → "—" (nunca 0); comparar pessoas de cargos diferentes

F05 Ver como um deputado votou
    S06 → S07 (aba do ano) → S23
    caminho feliz, cliques: 2
    caso limite: votação secreta (só placar); Senado não publica lista de presença; ausência por licença = cinza, não falta

F06 Impostômetro: do Brasil ao seu estado
    S19 → S20 → S21
    caminho feliz, cliques: 2
    caso limite: mês ainda não publicado (out/nov/dez vazios); DF concentra imposto de empresas grandes (nota explicativa)

F07 Criar conta e monitorar um político
    S06 → S08 → (e-mail) → (código) → S06 com "Monitorar" ativo
    caminho feliz, cliques: 3
    caso limite: e-mail inválido; código expirado; "Agora não" adia

F08 Acompanhar a agenda do Congresso
    S22 → S23
    caminho feliz, cliques: 1
    caso limite: "sem sessão agora · próxima: qua 04/11 09:00"; item "encerrada" no mesmo dia

F09 Ver o que virou lei
    S24 → (filtros) → S25
    caminho feliz, cliques: 1–3
    caso limite: 8.561 itens → paginação ("carregar mais"); norma de outro tipo (EC, LC)

F10 Resultado de uma eleição
    S28 → S29 → S30
    caminho feliz, cliques: 3 (lugar, cargo, ano)
    caso limite: turno que não existiu ("decidida no 1º turno"); 2º turno só com os 2 mais votados; votação anulada

F11 Mandar dado faltante ou avisar erro
    S43 (rodapé) ou "Reportar erro" no fim do crachá → S43 → enviado
    caminho feliz, cliques: 2
    caso limite: erro em dado de terceiro (a correção é conferida na fonte); erro de foto

F12 Entrar na conta
    S42 → (e-mail) → (código)
    caminho feliz, cliques: 2
    caso limite: sem senha → o usuário pode perder o acesso; código reenviado

F13 Caçar quem é o mais acessado agora
    S41 → (crachá / cidade / duel)
    caminho feliz, cliques: 1
    caso limite: contagem muda a cada 30s; número abaixo de 3 pessoas não aparece

F14 Ler o orçamento do mandato (cota / verba)
    S06 → S07 → painel "Dinheiro da cota parlamentar" → lista por item/fornecedor
    caminho feliz, cliques: 2
    caso limite: item sem nota fiscal pública; gabinete sem dados (prefeitura);Séries com ano sem publicação
```

## Components

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Cabeçalho | fixo; com pílula de navegação ativa; com barra de "dados atualizados" | normal, rolado | todas |
| Pílula de navegação | ativa (preenchida), inativa | sob o ponteiro, pressionado | cabeçalho |
| Botão de ação | primário (preto), contorno, discreto, ícone-circular | padrão, sob o ponteiro, em foco, desabilitado | todas |
| Número grande | número gigante + rótulo + subtexto | preenchido, ao vivo (pulso), com nota de fonte | S01, S13, S19, S33, S41 |
| Pílula de camada | selecionado (`aria-pressed=true`) | pressionado, não pressionado | S01, S02 |
| Mapa SVG do Brasil | região → estado → município; cor = valor da camada | preenchido, vazio, carregando | S01, S02, S19, S40 |
| Legenda de cor | gradiente + extremos | — | S02, S19, S40 |
| Barra de filtro | chips de cargo (com rolagem), seletor de UF, seletor de partido, navegação A–Z, paginação | filtrado, vazio, com dica de contagem | S04, S05, S13, S15 |
| Linha de pessoa | nome + cargo · UF + partido + foto/avatar | com foto, sem foto, + Comparar | S04, S10, S11, S15, S18 |
| Crachá (card de perfil) | retrato, etiquetas (em exercício / mandato interrompido / titular / suplente), botão Monitorar, botão Compartilhar card | preenchido, "Faltam N dados", sem foto | S06, S07 |
| Card de métrica | valor + rótulo + período + chevron de detalhe | padrão, expandido, "—" (sem dado), link | S06, S07, S33 |
| Aba de ano | horizontal, com "Todos" | selecionada, não selecionada | S07, S19, S24, S29 |
| Tabela de comparação | 2–5 colunas + linha de rótulos | preenchido, "—" ausente, incompleto | S18 |
| Bloco de estado vazio | "Nenhum destes dados está no site" com motivo por dado | — | S10, S16, S40 |
| Tabela de candidatos | nome + número + partido + votos + % + resultado | eleito, não eleito | S30 |
| Diagrama de bancada | uma bolinha por cadeira, cor do partido | normal, filtrado por partido/estado | S14, S22, S23, S32 |
| Calendário de agenda | grade do mês, dia com nº de itens e contorno (sessão marcada) | com sessão, sem sessão | S22, S26 |
| Card de votação | casa, horário, tipo, status, placar, tema | encerrada, em curso, secreta | S23, S27 |
| Série temporal | linha/barra com faixa do mandato ao fundo | — | S35, S41, S07 |
| Rosca / barras | divisão por imposto, filiação por idade, bancada | — | S19, S33, S39 |
| Diálogo de busca | campo + resultados agrupados | aberto, vazio, com exemplos | S03 |
| Modal genérico | vídeo "como funciona", sugestão, acessibilidade, acesso por código | aberto, enviado, erro | S08, S43, S48 |
| Aviso / status | "link copiado" | visível | todas |
| Rodapé | 4 colunas + newsletter + Pix + canais | — | todas |
| Rodapé de fonte | "Fonte: X · atualizado em DD/MM/AAAA · [ver bases]" | — | todo bloco de dados |
| Seletor de tema | claro/escuro | alternado | cabeçalho |
| "Ouvir esta página" | leitura em voz alta da página | ligado/desligado | cabeçalho (todas as áreas) |
| Card social | imagem gerada do crachá | gerado | S06 |

## Inferred data model

```
Politician        id, slug, name, party_id, office_id, uf, municipality_id, photo_url,
                  status (em_exercicio | mandato_interrompido | suplente | nao_eleito),
                  birth_year, birth_city, mandate_start, mandate_end, is_titular
                  evidence: S06 (nome, partido, cargo, faixa de mandato, "em exercício"),
                           S05 (linha "Nome · cargo · UF · partido"), S14 (bancada por cor)
                  confidence: high

Office            id, type (presidente|senador|deputado_federal|governador|deputado_estadual|
                  prefeito|vereador|ministro_stf), sphere (federal|estadual|municipal|judiciario),
                  scope (brasil|uf|city), description, powers[], costs
                  evidence: S39 ("Quem faz o quê com quem"), S05 (filtro de cargos),
                           /cargos ("Ver tudo sobre ...")
                  confidence: high

Party             id, sigla, name, number, founded_at, ideology_score (0–10, pesquisa 2018),
                  leader, headquarters, members_count, regions[]
                  evidence: S33 (PL: nº 22, NA URNA, 21/12/2006, 955.186 filiados, presidente),
                           S32 (eixo esquerda→direita com nota por partido)
                  confidence: high

Uf                id, sigla, name, region, ibge_code
                  evidence: S13 (breadcrumb Brasil›Sudeste›São Paulo), S01 (lista de 27+UF)
                  confidence: high

Municipality      id, ibge_code, name, uf_id
                  evidence: /representantes?cidade=3304557 (Rio de Janeiro), S40 (5.569 cidades),
                           /atualizacoes (IBGE anual)
                  confidence: high

Election          id, politician_id, year, office_id, scope, round (1|2), party_id,
                  votes, percentage, result (eleito|nao_eleito), is_vice, took_office_date
                  evidence: S30 (tabela candidato + %), S06 ("139.108 votos na última eleição
                  2026 · Governador · 2º turno"), S11 ("Eleito 2 vezes (2022, 2024)")
                  confidence: high

VoteSession       id, date, house (camara|senado), kind (nominal|secreta|simbolica),
                  status (agendada|em_andamento|encerrada|adiada), agenda[], theme
                  evidence: S22 ("1.458 votações"), S23 (card com casa, hora, status),
                           S23 ("CÂMARA · 16:52 ✓ Aprovado")
                  confidence: high

VoteRecord        id, session_id, politician_id, vote (sim|nao|abstencao|ausente|licenca|
                  missao|nao_compareceu), party_guidance
                  evidence: S07 ("20 sim · 1 não · 27"), S05/S07 (listas por ano)
                  confidence: high

Bill              id, type (lei|lei_complementar|emenda_constituicao), number, year, theme,
                  author_id, co_authors[], status, published_at, official_url, text
                  evidence: S24 (filtros tipo/autor/ano/tema, 8.561 normas desde 1985),
                           S07 ("Projetos que propôs e viraram lei · 4 viraram lei")
                  confidence: high

Speech            id, politician_id, date, theme, summary, official_url
                  evidence: S07 ("11 falas em 2026", "23 itens falam de outros assuntos")
                  confidence: high

Amendment (emenda) id, author_id, year, amount, type, area, destination,
                  municipality_id, description, official_url
                  evidence: S07 ("Emendas que mandou · de 2023 para cá", "As 22 cidades que receberam")
                  confidence: high

GabExpense        id, politician_id, year, amount, category, supplier, doc_number, official_url
                  evidence: S07 ("R$ 240.512 gastos", "Contratação de consultorias…"), S06
                  confidence: high

AssetDeclaration  id, politician_id, year, total_value, items[], declared_at
                  evidence: S06 ("R$ 5.244.568 patrimônio declarado em 2026 · era R$ 355.000 em 2014")
                  confidence: high

Campaign          id, politician_id, year, office_id, raised_amount, spent_amount,
                  top_donors[]
                  evidence: S06 ("R$ 8.340.326 arrecadou em campanhas · 3 campanhas desde 2018"),
                           S07 ("De onde veio", "Maiores doadores com nome")
                  confidence: high

Presence          id, politician_id, year, session_id, status, counted (bool)
                  evidence: S07 ("presença em sessões de votação", "o Senado não publica a lista"),
                           /sobre ("Como contamos a presença")
                  confidence: high

TaxCollection     id, uf_id, year, month, tax (imposto_de_renda|cofins_pis_csll|inss|outros|
                  comercio_exterior|operacoes_financeiras|ipi|cide), amount
                  evidence: S19 (8 blocos com nome, valor e %, série mês a mês)
                  confidence: high

GovernmentMandate id, scope (presidente|governador|prefeito), uf_id, municipality_id,
                  person_name, party_id, start, end, interrupted
                  evidence: S34 (carrossel de mandatos com partido e período),
                           S06 ("assumiu a prefeitura em 20/03/2026")
                  confidence: high

GovernmentMetric  id, mandate_id, year, metric (pib|pib_per_capita|inflacao|folha|saude|
                  educacao|investimento), value, source
                  evidence: S35 ("Crescimento da economia (PIB) 2,3%", "PIB por pessoa R$ 51.694")
                  confidence: high

ElectionResult    id, scope, uf_id/municipality_id, year, office_id, round,
                  candidates[{name, number, party_id, votes, pct, result}]
                  evidence: S30, S31
                  confidence: high

StfProcess        id, number, type, relator, theme, situation (julgado|suspenso|vista|
                  adiado), judged_at, session_kind, result_summary, official_url
                  evidence: S26 ("ADI 6336 · relator: Edson Fachin"), S27 (465 processos)
                  confidence: high

StfVote           id, process_id, minister_id, vote (procontra|medida|...)
                  evidence: S27 ("10 com o relator 0 contra")
                  confidence: high

Agenda            id, house (camara|senado|stf), date, kind, status, items[]
                  evidence: S22, S26 (grade do mês com nº de processos)
                  confidence: high

PartySimilarity   id, party_a_id, party_b_id, score (0–1), direction (parecido|diferente)
                  evidence: S33 ("Vota mais parecido com", "Vota mais diferente de")
                  confidence: medium

OfficeBudget      id, office_id, office_type, cost (subsídio/remuneração)
                  evidence: S39 ("Quanto custa cada cargo")
                  confidence: medium

GovernmentPlan    id, candidate_id, dispute_id, theme, excerpt, source (TSE)
                  evidence: S38 ("Os trechos são do próprio documento: o site não resume nem reescreve")
                  confidence: high

OpenDataCoverage  id, municipality_id, publishes_salary_vereador, publishes_salary_prefeito,
                  publishes_camara_activity, source_checked_at
                  evidence: S40 (3.788 de 5.569 sem dado; 32% publicam)
                  confidence: high

User              id, email, created_at, monitored_politician_ids[]
                  evidence: S42 ("Mandamos um código para o seu e-mail; não tem senha"), S08
                  confidence: high

Suggestion        id, type (ideia|falta|erro|outro), body, name, email, city_id, status, created_at
                  evidence: S43 (campos do formulário), S46 ("Toda correção é conferida na fonte oficial")
                  confidence: high

PageStat          id, scope (page|city|uf|party|office), bucket (hour|day|since_launch),
                  period, counter (pessoas|visitas), source (site|share)
                  evidence: S41 (45.057 pessoas em 24h, 364.891 visitas, "sem cookie e sem IP gravado",
                   "atualizado a cada 30 segundos", "só aparece o que pelo menos 3 pessoas abriram")
                  confidence: high

SourceCatalog     id, name, url, kind (daily|weekly|monthly|annual), last_updated, entity_count
                  evidence: /atualizacoes (7 grupos: Câmara 12 fontes, Senado 10, TSE 16,
                   Receita 1, Assembleias 29, Câmaras SAPL 936, IBGE)
                  confidence: high
```

Relationships: `Municipality 1-n Politician` · `Uf 1-n Politician` · `Politician 1-n Election` · `Politician 1-n VoteRecord` · `VoteSession 1-n VoteRecord` · `Politician 1-n Bill` · `Politician 1-n Amendment` · `Politician 1-n GabExpense` · `Politician 1-n Campaign` · `Party 1-n Politician` · `GovernmentMandate 1-n GovernmentMetric` · `Politician n-n Municipality` (via `Office.scope`) · `GovernmentPlan 1-n GovernmentPlan` (candidate↔theme) · `User n-n Politician` (monitorar) · `SourceCatalog 1-n` toda entidade medida.

**Modelo mínimo para a fatia "must":** Politician, Office, Party, Uf, Municipality, Election, GabExpense, VoteRecord, VoteSession, Bill, User, Suggestion, TaxCollection. As demais entram quando a área correspondente entrar no build.

## Feature matrix

Ver `features.csv`. Must: 24, should: 22, could: 14, skip: 6.

## Out of scope (o que não pode ou não deve ser clonado)

- **A base de 70.804+/71.649 pessoas já ingerida.** O clone tem que construir o próprio pipeline contra as fontes oficiais (TSE, Câmara, Senado, SAPL das câmaras, Receita, IBGE). É o maior item de trabalho, não um asset a copiar — e é o que torna o projeto viável (dados abertos, como o original).
- **Fotos dos candidatos.** São do TSE/API pública e exigem ingestão massiva; v1 usa avatar com iniciais.
- **O contador próprio de visitas e o ranking "mais vistos".** O original diz explicitamente "contagem do próprio Politicômetro, sem cookie e sem IP gravado" — é infraestrutura de produto deles, não uma feature a replicar.
- **Canal do WhatsApp e perfil do Instagram.** Integrações de terceiros; o clone entrega os links de compartilhamento, não a audiência.
- **A marca, o nome e o logo.** O clone precisa de identidade própria ("transparência política" é o repositório do usuário). O layout, a tipografia e a paleta não são assets copiáveis.
- **O MCP do Politicômetro.** Anunciado como "em breve, ainda não está aberto". O clone pode expor o seu próprio servidor MCP — e o /mcp original é uma ótima especificação das 10 tools.
- **Conteúdo editorial** (marcos de governo, cartão corporativo, "como funciona" em vídeo) é produção do time deles, não dado.

## Size

Telas 50, fluxos 14, entidades ~30. Partes difíceis:

1. **Pipeline de ingestão heterogêneo** — 1.000+ fontes com formatos diferentes (XML/HTML da Câmara, páginas do Senado, API do TSE, SAPL por câmara, CSV da Receita, IBGE). É o que o original chama de "1 rotina" e é o item que domina o cronograma.
2. **Mapa do Brasil** — SVG com 5 estados (região → UF → município → esfera), cor por valor, 5.569 municípios, com legenda e drill sem recarregar.
3. **O crachá monolítico** — 8–10 métricas de naturezas diferentes (salário, cota, patrimônio, votos, propostas, emendas, comissões, campanhas) com semântica de dado ausente ("—" e "Faltam N dados"), abas por ano e gráficos.
4. **Comparação sem nota** — alinhar o mesmo campo entre cargos diferentes (senador × vereador) e preservar "fonte não publica ≠ zero".
5. **Escala e performance** — diretório com 71k+ nomes, A–Z, paginação, busca instantânea e contadores ao vivo.

**Tamanho: L** (um trimestre) para must + should, com um backend de dados oficial já em produção e uma ou duas áreas rodando. **XL** se a intenção for cobrir tudo — STF, Planos de governo, Governos e o pipeline completo das 936 câmaras em paralelo é mais de um trimestre.

---

## Limites do recorte (o que assumi, e o que ajustar)

Assumi que a fatia é o loop central + áreas de apoio, porque "clone o Politicômetro inteiro" não é um projeto (são 50 telas, ~30 entidades e um pipeline de dados oficial). Ajustes fáceis sem refazer o recon:

- **Só o loop central (must):** manter S01–S18 e as linhas `must` do CSV. O resto vira `could`.
- **Incluir a votação nominal do Congresso (S22–S25):** é a parte mais pesada depois do pipeline (dados do Plenário, votação nominal palavra por palavra e como cada partido orientou o voto), entra depois do must.
- **Trocar áreas:** /congresso e /eleicoes são os mais pesados (votações nomeadas e resultados por município); /impostos e /cargos são os mais baratos (uma fonte cada).

---

*Recon gerado em 2026-10-30, leitura pública via navegador. Referência visual em `replica/screens/` (14 PNGs) — nunca entram no clone.*
