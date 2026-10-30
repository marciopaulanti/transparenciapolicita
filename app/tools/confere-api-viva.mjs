#!/usr/bin/env node
/* ============================================================================
   confere-api-viva.mjs — a tela mostra o que está no banco?
   ---------------------------------------------------------------------------
   Uso:  node app/tools/confere-api-viva.mjs

   O smoke confere que a página abre sem erro. Este confere outra coisa: que
   o número que aparece na tela veio do banco, e não do dataset embutido.

   O truque é simples e direto: semeia um banco temporário, muda o nome de
   uma pessoa direto no SQLite, abre a página no navegador e procura o nome
   novo. Se aparecer, a tela está lendo o banco.

   Se a tela mostrasse o dataset embutido, o nome antigo apareceria e o teste
   falharia — que é exatamente o que este teste existe para pegar.
   ========================================================================== */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { navegarComChrome, subirServidor, temChrome } from './navegador-cdp.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const NOME_NOVO = 'Zuleica Vasques de Teste';
const ALVO = 'marina-caldeira';

function executar(comando, argumentos, opcoes = {}) {
  return new Promise((resolva, rejeite) => {
    const processo = spawn(comando, argumentos, {
      cwd: RAIZ,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opcoes,
    });
    let erro = '';
    processo.stderr.on('data', (trecho) => {
      erro += trecho;
    });
    processo.on('close', (codigo) => {
      if (codigo === 0) resolva();
      else rejeite(new Error(`${comando} saiu com ${codigo}\n${erro}`));
    });
  });
}

if (!temChrome()) {
  console.error('Chrome não encontrado: não dá para conferir a API viva.');
  process.exit(2);
}

const temporario = mkdtempSync(join(tmpdir(), 'tp-api-viva-'));
const caminhoBanco = join(temporario, 'teste.sqlite');

let codigoSaida = 0;

try {
  // 1. Banco temporário populado.
  await executar('python3', ['-m', 'server.seed', '--reconstruir'], {
    env: { ...process.env, TP_DB_PATH: caminhoBanco },
  });

  // 2. Mudança direto no banco, por fora do servidor: o que a tela mostra
  //    só pode vir daqui.
  await executar(
    'python3',
    [
      '-c',
      `import sqlite3
con = sqlite3.connect(${JSON.stringify(caminhoBanco)})
con.execute("UPDATE pessoas SET nome = ? WHERE id = ?", (${JSON.stringify(NOME_NOVO)}, ${JSON.stringify(ALVO)}))
con.commit()
con.close()
print("nome trocado no banco")`,
    ],
    {},
  );

  // 3. Servidor no ar com esse banco.
  const porta = 8950 + Math.floor(Math.random() * 300);
  const servidor = spawn('python3', ['-m', 'server.app'], {
    cwd: RAIZ,
    env: {
      ...process.env,
      TP_PORT: String(porta),
      TP_DB_PATH: caminhoBanco,
      TP_AUDITORIA: '0',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let logServidor = '';
  servidor.stderr.on('data', (trecho) => {
    logServidor += trecho;
  });

  const base = `http://127.0.0.1:${porta}`;
  // Espera o servidor responder.
  let noAr = false;
  for (let i = 0; i < 60 && !noAr; i += 1) {
    try {
      const resposta = await fetch(`${base}/api/health`);
      noAr = resposta.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!noAr) throw new Error(`servidor não subiu:\n${logServidor}`);

  // 4. A API devolve o nome novo?
  const api = await (await fetch(`${base}/api/pessoas/${ALVO}`)).json();
  if (api.nome !== NOME_NOVO) {
    throw new Error(`a API não devolveu o nome novo (devolveu "${api.nome}")`);
  }

  // 5. A tela devolve o nome novo?
  const resultado = await navegarComChrome({
    base,
    rotas: [`/p/${ALVO}`],
    largurasExtras: [],
    rotasEstreitas: [],
  });

  servidor.kill('SIGTERM');

  const registro = resultado.registros.find((r) => r.rota === `/p/${ALVO}`);
  const texto = registro?.estado?.texto || '';
  const achouNovo = texto.includes(NOME_NOVO);
  const achouVelho = texto.includes('Marina Caldeira');

  if (!achouNovo) {
    console.error(
      `A tela NÃO mostrou o nome do banco.\n` +
        `  esperado conter: ${NOME_NOVO}\n` +
        `  texto na tela:   ${texto}\n` +
        `  (o nome embutido apareceu: ${achouVelho ? 'sim' : 'não'})\n` +
        '  A tela está lendo o dataset embutido em vez do banco.',
    );
    codigoSaida = 1;
  } else {
    console.log(
      `API viva confirmada: a tela do crachá mostrou o nome que está no banco ` +
        `("${NOME_NOVO}"), e não o do dataset embutido.`,
    );
  }
} catch (erro) {
  console.error(`Falha na conferência: ${erro.message}`);
  codigoSaida = 1;
} finally {
  rmSync(temporario, { recursive: true, force: true });
}

process.exit(codigoSaida);
