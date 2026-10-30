/* ============================================================================
   forms.js — formulários em dialog (monitorar, sugerir)
   ---------------------------------------------------------------------------
   · Monitorar: e-mail → código. Sem senha: o código chega por e-mail e vale
     por um tempo curto.
   · Sugerir: tipo (ideia / falta / erro / outro), texto, nome, e-mail, cidade.
     Erro de dado de terceiro é conferido na fonte oficial antes de entrar.
   ========================================================================== */

import { CIDADES } from './data/fixtures.js';
import { escapeHtml } from './components.js';
import { openDialog } from './dialog.js';

/* ------------------------------------------------------------- monitorar */

export function abrirMonitor(pessoa, anchor) {
  const { element, close } = openDialog({
    title: `Monitorar ${pessoa.nome}`,
    subtitle: 'A gente avisa quando o registro mudar. Sem senha: o código chega por e-mail.',
    content: `
      <form class="form" novalidate>
        <div data-step="1">
          <label class="field">
            <span class="field__label">Seu e-mail</span>
            <input class="input" type="email" name="email" required placeholder="voce@exemplo.com" />
          </label>
          <p class="form__error" data-error hidden>Escreva um e-mail válido para continuar.</p>
          <p class="form__action">
            <button type="submit" class="btn btn--primary" data-press="scale">Mandar código</button>
          </p>
        </div>
        <div data-step="2" hidden>
          <p class="form__lead">Enviamos um código de 6 dígitos para <strong data-email></strong>.</p>
          <label class="field">
            <span class="field__label">Código</span>
            <input class="input input--code" type="text" inputmode="numeric" maxlength="6" name="codigo" placeholder="000000" />
          </p>
          <p class="form__error" data-error hidden>Código inválido ou expirado. Peça outro.</p>
          <p class="form__action">
            <button type="submit" class="btn btn--primary" data-press="scale">Confirmar</button>
            <button type="button" class="btn btn--ghost" data-resend data-press="scale">Reenviar código</button>
          </p>
        </div>
      </form>
    `,
    anchor,
  });

  const form = element.querySelector('form');
  const passos = element.querySelectorAll('[data-step]');
  let email = '';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const etapa = passos[0].hidden ? 2 : 1;
    if (etapa === 1) {
      const valor = form.email.value.trim();
      const erro = element.querySelector('[data-error]');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
        erro.hidden = false;
        form.email.focus();
        return;
      }
      erro.hidden = true;
      email = valor;
      passos[0].hidden = true;
      passos[1].hidden = false;
      element.querySelector('[data-email]').textContent = valor;
      form.codigo.focus();
      return;
    }
    const codigo = form.codigo.value.trim();
    const erro = passos[1].querySelector('[data-error]');
    if (!/^\d{6}$/.test(codigo)) {
      erro.hidden = false;
      form.codigo.focus();
      return;
    }
    close();
    import('./components.js').then(({ toast }) =>
      toast(`Agora você monitora ${pessoa.nome}. Avisamos quando o registro mudar.`),
    );
  });

  element.querySelector('[data-resend]')?.addEventListener('click', () => {
    import('./components.js').then(({ toast }) => toast('Código reenviado.'));
  });
}

/* --------------------------------------------------------------- sugerir */

export function abrirSugestao({ contexto = '', anchor } = {}) {
  const { element, close } = openDialog({
    title: 'Sugerir ou reportar',
    subtitle: contexto
      ? `Contexto: ${contexto}`
      : 'Mandar um dado que falta, avisar um erro ou propor uma melhora.',
    content: `
      <form class="form" novalidate>
        <fieldset class="form__radios">
          <legend class="field__label">O que é</legend>
          ${['Falta um dado', 'Está errado', 'Tenho uma ideia', 'Outro'].map(
            (tipo, i) => `
            <label class="radio">
              <input type="radio" name="tipo" value="${escapeHtml(tipo)}" ${i === 0 ? 'checked' : ''} />
              <span>${escapeHtml(tipo)}</span>
            </label>`,
          ).join('')}
        </fieldset>

        <label class="field">
          <span class="field__label">Conta</span>
          <textarea class="input input--area" name="texto" rows="4" required
                    placeholder="O que está faltando ou o que está errado?"></textarea>
        </label>

        <div class="form__grid">
          <label class="field">
            <span class="field__label">Seu nome</span>
            <input class="input" type="text" name="nome" autocomplete="name" />
          </label>
          <label class="field">
            <span class="field__label">Seu e-mail</span>
            <input class="input" type="email" name="email" autocomplete="email" placeholder="opcional" />
          </label>
          <label class="field">
            <span class="field__label">Cidade</span>
            <input class="input" type="text" name="cidade" list="cidades-lista" autocomplete="off" />
            <datalist id="cidades-lista">
              ${CIDADES.map((c) => `<option value="${escapeHtml(c.nome)} — ${escapeHtml(c.uf)}"></option>`).join('')}
            </datalist>
          </label>
        </div>

        <p class="form__error" data-error hidden>Escreva o que você quer reportar antes de enviar.</p>
        <p class="form__action">
          <button type="submit" class="btn btn--primary" data-press="scale">Enviar</button>
          <button type="button" class="btn btn--ghost" data-cancel data-press="scale">Cancelar</button>
        </p>
      </form>
    `,
    anchor,
  });

  const form = element.querySelector('form');
  element.querySelector('[data-cancel]')?.addEventListener('click', close);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const erro = element.querySelector('[data-error]');
    if (!form.texto.value.trim()) {
      erro.hidden = false;
      form.texto.focus();
      return;
    }
    erro.hidden = true;
    close();
    import('./components.js').then(({ toast }) =>
      toast('Recebido. Toda correção é conferida na fonte oficial antes de entrar.'),
    );
  });
}
