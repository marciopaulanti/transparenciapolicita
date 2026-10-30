/* ============================================================================
   sheet.js — bottom sheet (celular) / painel lateral (desktop)
   ---------------------------------------------------------------------------
   Comportamento de referência (WWDC 2018, Designing Fluid Interfaces):

   · segue o dedo 1:1, respeitando o ponto onde o dedo agarrou a peça;
   · continua o movimento se o ponteiro sair da peça (pointer capture);
   · no limite, resiste progressivamente em vez de travar (rubber-banding);
   · na soltura, projeta o momento e escolhe o destino pela projeção — não pela
     posição de largada;
   · a mola seguinte herda a velocidade do gesto: não existe costura;
   · se o usuário agarrar a sheet no meio do voo, a animação para e o gesto
     continua de onde a peça está na tela, herdando a velocidade;
   · entrada e saída pelo mesmo caminho (a sheet desce para fechar);
   · no desktop vira painel lateral: sem scrim, translúcido, o fluxo não para.
   ========================================================================== */

import {
  animateValue,
  haptic,
  prefersReducedMotion,
  project,
  rubberband,
} from './motion.js';

const DESKTOP_QUERY = '(min-width: 900px)';

let activeSheet = null;

export function isSheetOpen() {
  return Boolean(activeSheet);
}

/**
 * Abre a sheet.
 * @param {object} opts
 * @param {string} opts.title        título acessível
 * @param {string|Node} opts.content  conteúdo (string = HTML)
 * @param {string} [opts.subtitle]
 * @param {boolean} [opts.dismissible]
 * @param {Function} [opts.onClose]
 */
export function openSheet({ title, content, subtitle = '', dismissible = true, onClose } = {}) {
  closeSheet({ immediate: true });

  const root = document.getElementById('sheet-root');

  root.innerHTML = `
    <div class="sheet-scrim" data-sheet-scrim></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <div class="sheet__grabber" data-sheet-grab aria-hidden="true"><span></span></div>
      <header class="sheet__head">
        <div class="sheet__heading">
          <h2 class="sheet__title" id="sheet-title">${title}</h2>
          ${subtitle ? `<p class="sheet__subtitle">${subtitle}</p>` : ''}
        </div>
        <button type="button" class="iconbtn iconbtn--close" data-sheet-close aria-label="Fechar" data-press="scale">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="iconbtn__glyph">
            <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="sheet__body" data-sheet-body>${content}</div>
    </section>
  `;

  root.hidden = false;
  const sheet = root.querySelector('.sheet');
  const scrim = root.querySelector('.sheet-scrim');
  const body = root.querySelector('[data-sheet-body]');

  const previousFocus = document.activeElement;
  const desktopPanel = matchMedia(DESKTOP_QUERY).matches;

  // --- estado do gesto ---------------------------------------------------
  const state = {
    open: false,
    axis: desktopPanel ? 'x' : 'y',
    size: desktopPanel ? sheet.offsetWidth : sheet.offsetHeight,
    position: 0, // 0 = aberta (encostada na borda), size = fechada
    animation: null,
    dragging: false,
    pending: false, // toque que ainda pode ser um arrasto
    suppressClick: false, // um arrasto não pode virar clique
    grabOffset: 0,
    startPointer: 0,
    startPosition: 0,
    history: [],
  };

  const isOpenPosition = () => (state.axis === 'y' ? 0 : 0);

  const applyPosition = (value) => {
    state.position = value;
    if (state.axis === 'y') {
      sheet.style.transform = `translate3d(0, ${value}px, 0)`;
    } else {
      sheet.style.transform = `translate3d(${value}px, 0, 0)`;
    }
  };

  const setOpen = (open, velocity = 0) => {
    state.animation?.stop();
    const from = state.position;
    const to = open ? isOpenPosition() : state.size;
    state.open = open;

    const reduced = prefersReducedMotion();
    if (reduced) {
      applyPosition(open ? isOpenPosition() : state.size);
      scrim.style.opacity = open ? '1' : '0';
      sheet.classList.toggle('is-open', open);
      if (open) {
        state.animation = null;
      } else {
        // sem mola não existe onComplete: o fechamento é imediato
        finalizeClose();
      }
      return;
    }

    const handle = animateValue({
      from,
      to,
      velocity,
      response: open ? 0.32 : 0.3,
      // amortecimento < 1 só aqui: o gesto carregou inércia
      dampingRatio: open ? 0.8 : 0.9,
      onUpdate: (value) => applyPosition(value),
      onComplete: () => {
        if (!open) finalizeClose();
      },
    });
    state.animation = handle;
  };

  const close = (velocity = 0) => {
    if (!state.open) return;
    setOpen(false, velocity);
    scrim.style.opacity = '0';
    document.body.classList.remove('is-sheet-open');
    onClose?.();
  };

  /**
   * Devolve o foco a quem abriu a sheet. Roda uma vez só: o mesmo fechamento
   * pode passar por gesto, botão, Escape ou troca de rota.
   */
  let focusRestored = false;
  const restoreFocus = () => {
    if (focusRestored) return;
    focusRestored = true;
    const alvo = previousFocus;
    if (!alvo || !alvo.isConnected) return;
    alvo.focus?.({ preventScroll: true });
  };

  const destroy = () => {
    window.removeEventListener('resize', onResize);
    restoreFocus();
  };

  /** Fechamento concluído: a sheet sai do documento e devolve o foco. */
  const finalizeClose = () => {
    const root = document.getElementById('sheet-root');
    root.hidden = true;
    root.innerHTML = '';
    destroy();
  };

  activeSheet = { state, close, destroy, onClose };

  // --- entrada ------------------------------------------------------------
  requestAnimationFrame(() => {
    const size = desktopPanel ? sheet.offsetWidth : sheet.offsetHeight;
    state.size = size;
    applyPosition(size);
    sheet.classList.add('is-mounted');
    setOpen(true);
    scrim.style.opacity = desktopPanel ? '0' : '1';
    document.body.classList.add('is-sheet-open');
    // foco no diálogo: leitor de tela entra no contexto novo
    const focusable = sheet.querySelector(
      'input, button:not([data-sheet-close]), [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable || sheet).focus({ preventScroll: true });
  });

  // --- arrastar -----------------------------------------------------------
  // O limiar evita o erro clássico: roubar o clique de quem só queria tocar
  // em um link dentro da sheet. O toque vira arrasto só depois de alguns px.
  const DRAG_THRESHOLD = 8;

  const pointerValue = (event) => (state.axis === 'y' ? event.clientY : event.clientX);

  /**
   * Velocidade de soltura.
   *
   * Três cuidados que a conta ingênua erra:
   * · a janela de medição é o movimento RECENTE (até 90ms), não a distância total;
   * · se o dedo ficou parado antes de soltar, não houve flick — quem decide é a
   *   posição final, não a inércia de um movimento que já acabou;
   * · a janela tem um piso de 20ms, senão um gesto de 3ms mediria uma
   *   velocidade três vezes maior do que a real.
   */
  const VELOCITY_WINDOW_MS = 90;
  const MIN_SAMPLE_MS = 20;
  const REST_MS = 80;
  const FLICK_VELOCITY = 520;
  const MIN_FLICK_TRAVEL = 24;

  const releaseVelocity = (now) => {
    const last = state.history[state.history.length - 1] || { t: now, p: 0, v: 0 };
    if (last.v) return last.v; // herdada da animação interrompida
    if (now - last.t > REST_MS) return 0; // o dedo parou antes de soltar
    let first = last;
    for (const sample of state.history) {
      if (last.t - sample.t > VELOCITY_WINDOW_MS) break;
      // o histórico vem do mais antigo para o mais novo: a primeira amostra
      // dentro da janela é a mais antiga que ainda conta
      first = sample;
      break;
    }
    const dt = Math.max(MIN_SAMPLE_MS / 1000, (last.t - first.t) / 1000);
    return (last.p - first.p) / dt;
  };

  const releaseCapture = (event) => {
    try {
      sheet.releasePointerCapture?.(event.pointerId);
    } catch {
      /* a captura já tinha sido liberada */
    }
  };

  /**
   * Interrompe a animação em voo: a sheet para exatamente onde está na tela e
   * o gesto continua de lá, herdando a velocidade do voo.
   */
  const interruptAnimation = (event) => {
    if (!state.animation) return;
    const live = state.animation.value;
    const liveVelocity = state.animation.velocity;
    state.animation.stop();
    state.animation = null;
    applyPosition(live);
    state.grabOffset = state.startPointer - live;
    // O histórico guarda coordenadas do PONTEIRO, nunca da sheet: misturar as
    // duas escalas faria a velocidade de soltura sair absurda (a distância
    // pareceria a distância do dedo até o topo da tela, não o arrasto).
    state.history = [{ t: performance.now(), p: pointerValue(event), v: liveVelocity }];
  };

  const startDrag = (event) => {
    state.dragging = true;
    state.pending = false;
    // setPointerCapture pode falhar se o ponteiro já não estiver ativo
    try {
      sheet.setPointerCapture?.(event.pointerId);
    } catch {
      /* sem captura: o rastreamento continua por listener normal */
    }
    sheet.classList.add('is-dragging');
    // o gesto virou arrasto: o clique que vem depois não pode disparar
    state.suppressClick = true;
  };

  const pointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const fromBody = event.target.closest('[data-sheet-body]');
    const fromGrab = event.target.closest('[data-sheet-grab]');
    // No desktop o painel lateral não tem alça: ele é agarrado pelo
    // cabeçalho e arrastado para a direita. O fluxo não para por causa do
    // painel, mas o painel também responde ao gesto.
    const fromHead =
      state.axis === 'x' && !fromGrab ? event.target.closest('.sheet__head') : null;

    // os controles do cabeçalho continuam clicáveis
    if (fromHead && event.target.closest('button, a[href], input, textarea, select')) return;
    if (!dismissible && !fromGrab && !fromHead) return;

    if (fromBody) {
      // o corpo rola; a sheet só é arrastada quando o corpo está no topo
      if (body.scrollTop > 0) return;
      if (state.axis === 'x') return;
      if (event.clientY < sheet.getBoundingClientRect().top + 24) return;
    }
    if (!fromGrab && !fromHead && !fromBody) return;

    state.suppressClick = false;
    state.pending = true;
    state.startPointer = pointerValue(event);
    state.startPosition = state.position;
    state.grabOffset = state.startPointer - state.position;
    state.history = [{ t: performance.now(), p: state.startPointer, v: 0 }];

    if (!fromGrab && !fromHead) return; // no corpo, ainda é só um toque: espera o limiar

    // a alça (ou o cabeçalho, no desktop) é o alvo explícito: o arrasto
    // começa na hora
    interruptAnimation(event);
    startDrag(event);
    event.preventDefault();
  };

  const pointerMove = (event) => {
    if (!state.dragging) {
      if (!state.pending) return;
      if (Math.abs(pointerValue(event) - state.startPointer) < DRAG_THRESHOLD) return;
      // passou do limiar: o gesto é arrasto — a animação em voo é interrompida
      interruptAnimation(event);
      startDrag(event);
    }
    const pointer = pointerValue(event);
    let next = pointer - state.grabOffset;

    // limite superior: a sheet não passa da borda, mas resiste
    if (next < 0) {
      next = -rubberband(-next, state.size, 0.55);
    }
    // limite inferior: além da posição fechada, também resiste
    if (next > state.size) {
      next = state.size + rubberband(next - state.size, state.size, 0.55);
    }

    applyPosition(next);

    const now = performance.now();
    state.history.push({ t: now, p: pointer, v: 0 });
    // janela curta: a velocidade de soltura é a dos últimos ~90ms
    while (state.history.length > 2 && now - state.history[0].t > 90) state.history.shift();
    event.preventDefault();
  };

  const pointerUp = (event) => {
    if (!state.dragging) {
      state.pending = false; // foi só um toque: o clique acontece normalmente
      return;
    }
    state.dragging = false;
    state.pending = false;
    sheet.classList.remove('is-dragging');
    releaseCapture(event);

    const now = performance.now();
    const velocity = releaseVelocity(now);

    // projeta o momento: o destino vem de onde o gesto VAI, não de onde parou
    const projected = state.position + project(velocity);
    // Um flick precisa de velocidade E de deslocamento: um tremor de 5px não
    // pode fechar a sheet, mesmo que saia rápido.
    const travel = Math.abs(state.position - state.startPosition);
    const flick = Math.abs(velocity) > FLICK_VELOCITY && travel >= MIN_FLICK_TRAVEL;
    const shouldClose = flick ? velocity > 0 : projected > state.size * 0.5;

    if (shouldClose) {
      haptic(6);
      close(velocity);
    } else {
      setOpen(true, velocity);
    }
  };

  /** O sistema interrompeu o gesto (scroll do navegador, interrupção do SO). */
  const pointerCancel = (event) => {
    if (!state.dragging) {
      state.pending = false;
      return;
    }
    state.dragging = false;
    state.pending = false;
    sheet.classList.remove('is-dragging');
    releaseCapture(event);
    setOpen(true, 0); // volta a abrir sem salto
  };

  sheet.addEventListener('pointerdown', pointerDown);
  sheet.addEventListener('pointermove', pointerMove);
  sheet.addEventListener('pointerup', pointerUp);
  sheet.addEventListener('pointercancel', pointerCancel);

  // um arrasto não pode virar clique no link que estava sob o dedo
  sheet.addEventListener(
    'click',
    (event) => {
      if (!state.suppressClick) return;
      state.suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );

  // enquanto a sheet está sendo arrastada, o corpo não rola sozinho
  sheet.addEventListener(
    'touchmove',
    (event) => {
      if (!state.dragging) return;
      if (event.touches.length > 1) return;
      event.preventDefault();
    },
    { passive: false },
  );

  root.querySelector('[data-sheet-close]')?.addEventListener('click', () => close());
  scrim.addEventListener('click', () => {
    if (dismissible) close();
  });

  // --- teclado ------------------------------------------------------------
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      sheet.querySelectorAll(
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
  };

  sheet.addEventListener('keydown', onKeyDown);

  const onResize = () => {
    const isDesktop = matchMedia(DESKTOP_QUERY).matches;
    state.axis = isDesktop ? 'x' : 'y';
    state.size = isDesktop ? sheet.offsetWidth : sheet.offsetHeight;
    if (state.open) applyPosition(isOpenPosition());
  };
  window.addEventListener('resize', onResize);

  // devolve o foco a quem abriu
  return {
    close,
    element: sheet,
    destroy,
  };
}

export function closeSheet({ immediate = false } = {}) {
  if (!activeSheet) return;
  const { state, close, destroy, onClose } = activeSheet;
  activeSheet = null;
  if (immediate) {
    // fechamento sem animação: usado na troca de rota, para não deixar uma
    // camada pela metade sobre a tela nova
    state.animation?.stop();
    state.animation = null;
    state.open = false;
    const root = document.getElementById('sheet-root');
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('is-sheet-open');
    destroy();
    onClose?.();
    return;
  }
  close();
}
