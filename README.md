# Transparência Política — protótipo de interface

Protótipo navegável do laço central do **Politicômetro** — *quem me representa, o que
essa pessoa fez e de onde veio cada número* — construído com as regras de produto do
original e a direção de interação do `/apple-design`.

Projeto: **transparenciapolicita**. É um projeto autossuficiente: banco, API, imagem
Docker e publicação próprios, sem vínculo com nenhum outro sistema.

> **Aviso de dados.** A geometria do mapa e os nomes dos estados e municípios são reais.
> **Todos os números, as pessoas, os partidos e os cargos exibidos são fictícios**,
> criados só para demonstrar a interface. Nada aqui é dado político verdadeiro.
> Os partidos são fictícios por inteiro: sigla e nome inventados (ADB, CDV, CPL,
> FEX, MDV, PDP, RDV, UDP) — nenhum partido real aparece no protótipo.

## Como rodar

Não há build, dependência, framework nem passo de instalação. É HTML, CSS e ES modules
puros — o navegador faz o resto.

```bash
python3 app/tools/serve.py        # http://127.0.0.1:8000
python3 app/tools/serve.py 3000   # em outra porta
```

Abrir `http://127.0.0.1:8000`. O servidor manda `Cache-Control: no-store`: durante o
desenvolvimento, módulos ES Antigos ficam presos na memória do navegador e uma
recarregar a página com `?cb=<timestamp>` é o jeito confiável de pegar a versão nova.

Para validação automatizada:

```bash
node app/tools/smoke.mjs          # checagem estática + varredura de rotas no navegador
```

O script não depende de npm install. Ele usa o Playwright se estiver instalado;
senão fala com o **Chrome do próprio sistema pelo DevTools Protocol**
(`app/tools/navegador-cdp.mjs`), usando só a biblioteca padrão do Node. Sem
nenhum dos dois, ele avisa e roda só a parte estática.

A varredura no navegador confere, por tela: erro de console, exceção de
página, requisição falha, resposta 4xx/5xx, quantidade de `h1`, tela vazia,
rolagem horizontal, overlay residual (sheet/dialog que sobrou da tela
anterior), referência ARIA quebrada e link interno apontando para rota
inexistente. As telas principais são medidas também em 320, 390 e 768 px,
porque rolagem horizontal só aparece no layout estreito.

```
Telas verificadas: 47 em 23 rotas (navegador: chrome-cdp)
Tudo certo: nenhuma falha de estática, rota ou console.
```

## Banco, API e publicação

O protótipo não depende de um backend de terceiro: **SQLite** é a fonte de verdade,
a **API JSON** é a mesma porta que serve o HTML (mesma origem, zero CORS), e o
front-end é **API-first** com fallback determinístico para o dataset embutido.

```
db/schema.sql             esquema normalizado (27 tabelas, chaves estrangeiras, WAL)
server/seed.py            semeia o banco a partir do dataset exportado
server/queries.py         reconstrói os objetos no formato que as telas esperam
server/api.py             catálogo de rotas de leitura e escrita
server/static.py          arquivos com lista de permissões e cache sem armadilha
app/js/data/dados.js      store API-first, com redesenho silencioso ao chegar o dado
```

```bash
make instalar      # exporta o dataset, cria o banco e popula
make rodar         # sobe estáticos + API em http://127.0.0.1:8080
make paridade      # confere que banco e front-end dizem a mesma coisa
make api-viva      # muda o banco e confirma que a tela mostra o valor novo
```

**Cache sem armadilha.** O app não tem etapa de build, então não existe hash no nome
do arquivo — e `max-age` seria mentira: o navegador serviria a versão antiga depois
de um deploy. Módulos ES e CSS saem com `Cache-Control: no-store`; o HTML sai com
`no-cache` e ETag derivado do conteúdo (304 quando nada mudou). Publicar passa a
valer na hora, sem esperar expiração e sem recarregar com `?cb=`.

**Publicação.** Uma imagem, um contêiner, um volume de dados e uma rede Docker
próprios:

```bash
./deploy/deploy.sh /caminho/do/codigo   # sincroniza, constrói, sobe e confere a saúde
```

### Endereço público

O projeto responde hoje em:

```
https://transparenciapolicita-edge.juliana-da-luz-oliveira.workers.dev
```

Esse endereço é servido por um **proxy de borda** (Cloudflare Worker) que repassa
consulta e resposta para a VPS, sem tocar em texto e sem guardar estado. O hostname é
exclusivo do projeto, o TLS é da Cloudflare e a resposta é a mesma do app.

O **endereço próprio do domínio ainda não está no ar**, porque depende de um registro
DNS que só pode ser criado no painel da Cloudflare: a credencial disponível para a
automação lê e escreve Workers, mas não tem a permissão de DNS da zona. O registro é
este, e é o único passo que falta:

| Campo | Valor |
| --- | --- |
| Tipo | `CNAME` |
| Nome | `transparenciapolicita` |
| Alvo | `95fc371a-75c6-4337-a2b0-8766e4dd549c.cfargotunnel.com` |
| Proxy | ligado (nuvem laranja) |

Feito o registro, o mesmo hostname passa a responder pelo **túnel de saída**
(Cloudflare Tunnel), que é o caminho definitivo: o `cloudflared` roda em contêiner na
rede Docker do próprio projeto, conecta de dentro para fora e entrega o tráfego no
`http://transparenciapolicita:8080`. O túnel não depende de porta liberada no firewall
da VPS nem de IP dedicado.

Por que túnel e não uma porta alta? A borda do provedor filtra portas fora do conjunto
liberado (80, 443 e as liberadas no painel), então a porta 8090 respondia de dentro da
VPS e expirava na hora de chegar pela internet. O proxy de borda existe só porque o
registro DNS acima ainda não foi feito — ele resolve o mesmo problema pelo outro lado
da borda, sem depender do painel.

Arquivos:

```
deploy/tunnel/config.yml      hostname público, destino no app e regra de captura
deploy/worker/worker.js       proxy de borda (Worker) usado enquanto o DNS não existe
deploy/publicar-edge.sh       publica o proxy e restringe a porta da VPS
tunnel/credentials.json       segredo do túnel — só na VPS, nunca no git
```

A porta 8090 da VPS só aceita conexão vinda das faixas públicas da Cloudflare: o
Docker publica a porta por DNAT e por isso escapa do UFW, então o filtro fica na cadeia
`DOCKER-USER`.

```bash
./deploy/publicar-edge.sh      # publica o proxy e reaplica o filtro da VPS
```

### Proxy alternativo (Caddy)

O `deploy/Caddyfile.transparenciapolicita` traz o bloco do proxy reverso pronto
para quem preferir terminar TLS no próprio servidor. O app responde em
`127.0.0.1:8090` na VPS, o que permite ao proxy falar com ele sem compartilhar
rede Docker com nenhum outro serviço.

### Operação na VPS

```bash
ssh hostinger
cd /docker/transparenciapolicita

docker compose ps                             # estado dos contêineres
docker compose logs -f transparenciapolicita  # log do app
docker compose --profile tunnel logs -f       # log do túnel
curl -s http://127.0.0.1:8090/api/health      # health check
```

Recomposição do túnel (quando o hostname ou o destino mudam):

```bash
./deploy/deploy.sh /caminho/do/codigo
```

O `deploy.sh` sincroniza, reconstrói a imagem, sobe o app, sobe o túnel quando a
credencial está na VPS e confere a saúde em `127.0.0.1:8090/api/health`.

## O laço central

```
mapa  ->  estado ou cidade  ->  representante  ->  crachá
                                        \->  comparar lado a lado
```

Cada passo cabe em um clique a partir do anterior. O mapa abre o estado; o estado abre
a pessoa; o crachá compara com outra.

| Rota | Tela |
| --- | --- |
| `#/` | Mapa do Brasil por camada temática, com legenda monocromática |
| `#/me` | "Me representa" — busca por cidade ou estado |
| `#/uf/:uf` | Estado: bancada, cargo por cargo, municípios com registro |
| `#/p/:id` | Crachá da pessoa: identidade, mandato, votos, propostas, emendas, cota, patrimônio, campanhas |
| `#/comparar` | Comparador de 2 a 5 pessoas |
| `#/quem` | Diretório com filtros de cargo, UF, partido e letra inicial |
| `#/sobre` | Método e neutralidade |
| `#/ajuda` | Quatro caminhos de participação |

## As regras que o protótipo não pode quebrar

Estas vêm do original e valem para todo o código:

1. **Sem nota.** Não existe pontuação, índice, "score" ou classificação.
2. **Sem ranking.** Ordem é ordem de exibição, nunca qualidade.
3. **Sem recomendação.** O site mostra o registro; não diz quem é melhor.
4. **Cor não julga.** Cor codifica *estado de um dado* (presente, ausente, faixa de um
   valor), nunca posição política. Partido aparece como **sigla em texto**, nunca como
   cor de "bom" ou "ruim".
5. **Ausência não é zero.** Dado que a fonte não publica vira **—** com o motivo
   explícito ao lado. Nunca `0`, nunca cor de alerta. No `/sobre`: *"Zero é uma
   afirmação. Travessão é uma admissão."*
6. **Fonte sempre visível.** Todo bloco de dado carrega a fonte e a data da última
   atualização.

## Neutralidade do mapa

A rampa é **monocromática, de um matiz só, em sete passos**. Isso resolve dois problemas
de uma vez: a cor não carrega julgamento político e a rampa é legível por quem tem
daltonismo. Em "forced colors" a rampa é preservada (`forced-color-adjust: none`) porque
ela *é* a codificação do dado — o contorno dos estados, o foco e a seleção passam a usar
`CanvasText` e `Highlight`.

## Interação (direção `/apple-design`)

| Princípio | Onde está |
| --- | --- |
| Resposta imediata | `attachPress()` dispara no `pointerdown`, não no `click` |
| Manipulação direta | sheet segue o ponteiro 1:1, preservando o ponto de pega |
| Interrompibilidade | a mola para no valor de tela e herda a velocidade; sem degrau |
| Handoff de velocidade | a mola seguinte nasce com a velocidade de soltura |
| Projeção de momento | o destino vem da projeção exponencial, não da posição de largada |
| Borda macia | `rubberband()` resiste progressivamente no limite |
| Simetria | entrada e saída pelo mesmo caminho |
| Materiais translúcidos | header e sheet são vidro; no desktop a sheet é painel lateral sem scrim |

Nenhuma animação de gesto usa `transition`/`animation` de CSS: só a mola analítica
(`app/js/motion.js`) sabe ser interrompida no meio do voo.

### Gesto da sheet

- **Limiar de 8 px**: um toque não vira arrasto — o clique em um link dentro da sheet
  nunca é roubado pelo reconhecedor de gesto.
- **Flick** exige velocidade **e** deslocamento: um tremor de 5 px não fecha nada.
- **Janela de velocidade de 90 ms**: se o dedo parou antes de soltar, não houve flick.
- **No desktop** a sheet vira painel lateral arrastável pelo cabeçalho, e o fluxo
  embaixo continua rodando.

## Acessibilidade

- Skip link no topo; o primeiro `Tab` da página chega nele, não no meio do documento.
- Foco preso em sheet e diálogo, com devolução ao gatilho ao fechar.
- Tablist ARIA 1.2 nas abas de ano: `tabindex` móvel, `ArrowLeft`/`ArrowRight`/`Home`/`End`,
  `Enter` **e** `Espaço` ativam.
- Combobox ARIA 1.2 com `aria-activedescendant` e `aria-selected` sincronizados.
- Preferências do sistema respeitadas: `prefers-reduced-motion`,
  `prefers-reduced-transparency`, `prefers-contrast`, `prefers-color-scheme`,
  `forced-colors`.
- `app/css/a11y.css` entra **por último** de propósito: as regras de preferência do
  sistema precisam vencer as regras de layout.

## Estrutura

```
index.html                 casca: skip link, header translúcido, footer, raízes de sheet/dialog/toast
app/js/
  main.js                  rotas, busca global, pressão no toque, link de pulo
  router.js                roteador por hash: parâmetros, query, fragmento, foco, rolagem
  motion.js                runtime de mola e gesto (analítico, interrompível)
  sheet.js                 bottom sheet (celular) / painel lateral (desktop)
  dialog.js                modal genérico ancorado no gatilho
  forms.js                 monitorar (e-mail + código) e sugerir
  components.js            componentes de apresentação e o travessão com motivo
  data/fixtures.js         dados fictícios determinísticos, com nulos e motivos
  data/br-map.js           geometria real dos 27 estados e do DF
  views/                   home, me, uf, badge, compare, directory, about, help
app/css/                   base, components, screens, a11y (última camada)
replica/design/tokens.css  tokens: superfície, tipografia, rampa, movimento
replica/recon.md           reconhecimento de campo do original
replica/features.csv       matriz de features (66 linhas)
app/tools/                 serve.py, smoke.mjs, navegador-cdp.mjs, build-map.py
```

## Mapa: como o dado real e o dado fictício se misturam

O contorno dos estados é **real**: vem de GeoJSON público, passa por uma projeção
cônica tipo Albers, por simplificação Douglas-Peucker e sai num `viewBox` normalizado
de 1000 unidades. As **cores** são fictícias, calculadas por uma semente determinística
— o mesmo estado tem sempre o mesmo valor, entre recargas.

Para regerar a geometria:

```bash
python3 app/tools/build-map.py
```

## Limites conhecidos

- **Esfera federal** (Brasília) não tem entrada própria: o `/me` resolve cidade e
  estado.
- **Sem estado de carregamento nem de erro** com "tentar de novo": o protótipo serve
  tudo local, então a falha é rara e o caminho de retry não foi construído.
- **Modo escuro** segue o sistema; não há toggle manual.
- **Card social** compartilha o link do crachá, mas não gera imagem de resumo.
- **Relevância da busca**: a tolerância a acento e a caixa estão resolvidas, mas o
  ranqueamento é a ordem do conjunto de dados, não uma relevância calculada.
- **Diretório** opera sobre o conjunto de demonstração; o filtro de letra existe para
  escalar com uma base maior.
- **Partido** não tem página própria, eixo ideológico nem similaridade de votação.

## Escopo do reconhecimento

`replica/recon.md` documenta o reconhecimento de campo do original: 50 telas, 14 fluxos,
~30 entidades inferidas, as 28 fontes públicas consultadas e o que ficou de fora. É
reconhecimento limpo — só páginas públicas e navegação humana, sem inspeção de bundle
privado, API interna ou payload.

Ficam **fora** de propósito: a base ingerida de 70.804+ pessoas, as fotos do TSE, o
contador de visitas, os canais de rede social, a marca e o MCP do original.
