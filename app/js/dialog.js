/* ============================================================================
   dialog.js — modal genérico (busca, sugestão, monitorar)
   ---------------------------------------------------------------------------
   Regras aplicadas:
   · origem ancorada no gatilho (transform-origin no ponto do botão que
     abriu), então a relação espacial entre causa e efeito fica óbvia;
   · o modal cresce a partir dessa origem (não do centro);
   · scrim para empurrar o fundo para trás; nada de bloquear a rolagem sem
     devolver o foco;
   · foco preso dentro do modal, Escape fecha, foco volta ao gatilho;
   · movimento reduzido vira cross-fade puro, sem escala nem deslocamento.
   ========================================================================== */

import { animateValue, haptic, prefersReducedMotion } from './motion.js';

let current = null;

export function openDialog({
  title,
  content,
  subtitle = '',
  anchor = null,
  size = 'md',
  onClose,
  onMount,
} = {}) {
  closeDialog({ immediate: true });

  const root = document.getElementById('dialog-root');
  const previousFocus = document.activeElement;

  root.innerHTML = `
    <div class="dialog-scrim" data-dialog-scrim></div>
    <div class="dialog dialog--${size}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">
      <header class="dialog__head">
        <div>
          <h2 class="dialog__title" id="dialog-title">${title}</h2>
          ${subtitle ? `<p class="dialog__subtitle">${subtitle}</p>` : ''}
        </div>
        <button type="button" class="iconbtn" data-dialog-close aria-label="Fechar" data-press="scale">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="iconbtn__glyph">
            <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="dialog__body">${content}</div>
    </div>
  `;

  root.hidden = false;
  const dialog = root.querySelector('.dialog');
  const scrim = root.querySelector('.dialog-scrim');

  // origem ancorada no gatilho
  if (anchor) {
    const box = anchor.getBoundingClientRect();
    const dbox = dialog.getBoundingClientRect();
    const ox = ((box.left + box.width / 2 - dbox.left) / dbox.width) * 100;
    const oy = ((box.top + box.height / 2 - dbox.top) / dbox.height) * 100;
    dialog.style.transformOrigin = `${ox.toFixed(1)}% ${oy.toFixed(1)}%`;
  }

  const reduced = prefersReducedMotion();
  dialog.style.opacity = '0';

  if (reduced) {
    // movimento reduzido: cross-fade puro, sem escala e sem deslocamento
    animateValue({
      from: 0,
      to: 1,
      velocity: 0,
      response: 0.16,
      dampingRatio: 1,
      onUpdate: (value) => {
        dialog.style.opacity = String(Math.min(1, Math.max(0, value)));
      },
    });
  } else {
    dialog.style.opacity = '1';
    animateValue({
      from: 0.94,
      to: 1,
      velocity: 0,
      response: 0.3,
      dampingRatio: 1,
      onUpdate: (value) => {
        dialog.style.transform = `scale(${value.toFixed(4)})`;
      },
    });
  }
  scrim.style.opacity = '0';
  requestAnimationFrame(() => {
    scrim.style.opacity = '1';
  });

  const close = () => {
    if (current?.closing) return;
    current = { closing: true };
    const finish = () => {
      root.hidden = true;
      root.innerHTML = '';
      current = null;
      previousFocus?.focus?.({ preventScroll: true });
      onClose?.();
    };
    if (reduced) {
      scrim.style.opacity = '0';
      dialog.style.opacity = '0';
      setTimeout(finish, 140);
      return;
    }
    animateValue({
      from: 1,
      to: 0.96,
      response: 0.22,
      dampingRatio: 1,
      onUpdate: (value) => {
        dialog.style.transform = `scale(${value.toFixed(4)})`;
        dialog.style.opacity = String(Math.max(0, (value - 0.96) / 0.04));
      },
      onComplete: finish,
    });
    scrim.style.opacity = '0';
  };

  /** Devolve o foco a quem abriu o modal. */
  const restoreFocus = () => {
    if (!previousFocus?.isConnected) return;
    previousFocus.focus?.({ preventScroll: true });
  };

  current = { close, element: dialog, restoreFocus, onClose };

  root.querySelector('[data-dialog-close]')?.addEventListener('click', close);
  scrim.addEventListener('click', close);

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  requestAnimationFrame(() => {
    const focusable = dialog.querySelector(
      'input:not([type="hidden"]), textarea, select, button:not([data-dialog-close])',
    );
    (focusable || dialog).focus({ preventScroll: true });
    onMount?.({ dialog, close });
  });

  return { close, element: dialog };
}

export function closeDialog({ immediate = false } = {}) {
  if (!current) return;
  if (immediate) {
    const { restoreFocus, onClose } = current;
    const root = document.getElementById('dialog-root');
    root.hidden = true;
    root.innerHTML = '';
    current = null;
    restoreFocus?.();
    onClose?.();
    return;
  }
  current.close();
}

export function hapticTap() {
  haptic(8);
}
