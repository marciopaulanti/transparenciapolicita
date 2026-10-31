// ============================================================================
// Proxy de borda do Transparência Política
// ---------------------------------------------------------------------------
// Publica a VPS Hostinger atrás do endereço workers.dev do projeto.
//
// Por que existe: a borda do provedor filtra portas fora do conjunto liberado
// (80, 443 e as liberadas no painel), então o app em 8090 respondia de dentro
// da VPS e expirava ao chegar pela internet. O túnel de saída resolve o
// hostname próprio, mas ele depende de um registro DNS proxiado na zona
// `luzempresarial.com.br` — e a credencial disponível não tem permissão de
// escrita em DNS. Enquanto esse registro não existe, este proxy entrega o
// mesmo app por um hostname exclusivo do projeto.
//
// O proxy é transparente: repassa consulta e resposta sem tocar em texto, sem
// guardar estado e sem inventar dado. Quem chama continua vendo o app e a API
// do servidor, com o mesmo endereço de base (`/`).
//
// A origem vem do binding de texto `ORIGEM`. Ela é escrita em sslip.io porque
// a plataforma recusa buscar por IP literal (erro 1003). O usuário nunca vê
// esse endereço: ele fica só entre o proxy e a VPS.
//
// Publicação:  ./deploy/publicar-edge.sh --worker
// ============================================================================

const ORIGEM_PADRAO = 'http://179-197-228-218.sslip.io:8090';

// Cabeçalhos que não fazem sentido atravessar o proxy: são do hop anterior
// (Cloudflare -> Worker) ou do transporte (Worker -> origem).
const CABECALHOS_IGNORADOS = new Set([
  'host',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-forwarded-proto',
  'forwarded',
  'content-length',
  'content-encoding',
  'accept-encoding',
]);

function semHop(cabecalhos) {
  const saida = new Headers();
  for (const [chave, valor] of cabecalhos) {
    if (!CABECALHOS_IGNORADOS.has(chave.toLowerCase())) saida.set(chave, valor);
  }
  return saida;
}

export default {
  async fetch(pedido, env) {
    const origem = (env && env.ORIGEM) || ORIGEM_PADRAO;
    const url = new URL(pedido.url);
    const destino = origem + url.pathname + url.search;

    const init = {
      method: pedido.method,
      headers: semHop(pedido.headers),
      redirect: 'manual',
    };

    if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
      init.body = await pedido.arrayBuffer();
    }

    let resposta;
    try {
      resposta = await fetch(destino, init);
    } catch (erro) {
      return new Response(
        JSON.stringify({
          erro: 'Origem indisponivel',
          detalhe: String(erro && erro.message ? erro.message : erro),
        }),
        { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } },
      );
    }

    const cabecalhos = semHop(resposta.headers);
    cabecalhos.set('x-transparenciapolicita-edge', 'worker');
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers: cabecalhos,
    });
  },
};
