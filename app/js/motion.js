/* ============================================================================
   motion.js — runtime de mola e gestos (base do apple-design)
   ---------------------------------------------------------------------------
   Regras implementadas aqui, na ordem em que o skill as define:

   1. RESPOSTA        — o feedback de pressão nasce no pointerdown, não no click.
   2. MANIPULAÇÃO     — acompanha 1:1 o ponteiro, respeitando o ponto de pega.
   3. INTERRUPTIBILIDADE — toda animação pode ser agarrada e invertida; a nova
      animação parte do valor DE TELA (apresentação), nunca do alvo, e herda a
      velocidade atual para não existir degrau ("brick wall").
   4. MOLAS           — parâmetros no vocabulário da Apple: damping ratio e
      response (em segundos). response não é duração: o tempo de acomodação
      emerge dos parâmetros.
   5. HANDOFF         — a mola seguinte recebe a velocidade de soltura.
   6. MOMENTO        — projeção exponencial (não v²/2a) para decidir o destino.
   7. BORDA MACIA     — rubber-banding no limite, com resistência progressiva.
   8. SIMETRIA        — entrada e saída pelo mesmo caminho.

   Nenhuma animação de gesto usa transition/CSS: só a mola sabe ser
   interrompida no meio do voo.
   ========================================================================== */

/* ------------------------------------------------------------------ ticker */

const running = new Set();
let rafId = null;

function tick(now) {
  rafId = null;
  for (const task of Array.from(running)) {
    task(now);
  }
  if (running.size) rafId = requestAnimationFrame(tick);
}

function schedule(task) {
  running.add(task);
  if (rafId === null) rafId = requestAnimationFrame(tick);
}

function unschedule(task) {
  running.delete(task);
}

/* --------------------------------------------------------------- ambiente */

const motionQuery =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export const prefersReducedMotion = () => Boolean(motionQuery && motionQuery.matches);

const transparencyQuery =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-transparency: reduce)') : null;

export const prefersReducedTransparency = () =>
  Boolean(transparencyQuery && transparencyQuery.matches);

export const prefersMoreContrast = () => {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-contrast: more)').matches;
};

/* ------------------------------------------------------------------ molas */

/**
 * Converte os parâmetros da Apple (response + damping ratio) em rigidez e
 * amortecimento. Mesma convenção do SwiftUI/Framer: mass = 1.
 */
export function springConfig(response = 0.3, dampingRatio = 1) {
  const omega = (2 * Math.PI) / response;
  return {
    stiffness: omega * omega,
    damping: 2 * dampingRatio * omega,
    mass: 1,
    omega,
    zeta: dampingRatio,
  };
}

/**
 * Animação de um número por mola. Analítica (closed-form), então o valor e a
 * velocidade são exatos em qualquer instante — é isso que permite reabrir uma
 * animação no meio do voo sem degrau.
 */
export function animateValue({
  from,
  to,
  velocity = 0,
  response = 0.3,
  dampingRatio = 1,
  onUpdate,
  onComplete,
  onStop,
}) {
  const { omega, zeta } = springConfig(response, dampingRatio);
  const travel = Math.abs(to - from) || 1;
  const epsPos = Math.max(0.0005, travel * 0.0005);
  const epsVel = Math.max(0.005, travel * 0.005);

  let x = from;
  let v = velocity;
  let startTime = null;
  let stopped = false;
  let done = false;

  const solve = (t) => {
    const dt = Math.max(0, t);
    const A = x - to;
    if (zeta < 1) {
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      const e = Math.exp(-zeta * omega * dt);
      const cos = Math.cos(wd * dt);
      const sin = Math.sin(wd * dt);
      const B = (v + zeta * omega * A) / wd;
      const pos = to + e * (A * cos + B * sin);
      const vel = e * ((-zeta * omega) * (A * cos + B * sin) + wd * (-A * sin + B * cos));
      return [pos, vel];
    }
    if (zeta === 1) {
      const e = Math.exp(-omega * dt);
      const B = v + omega * A;
      const pos = to + (A + B * dt) * e;
      const vel = e * (B - omega * (A + B * dt));
      return [pos, vel];
    }
    const r = omega * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega + r;
    const r2 = -zeta * omega - r;
    const c1 = (v - r2 * A) / (r1 - r2);
    const c2 = A - c1;
    const e1 = Math.exp(r1 * dt);
    const e2 = Math.exp(r2 * dt);
    const pos = to + c1 * e1 + c2 * e2;
    const vel = c1 * r1 * e1 + c2 * r2 * e2;
    return [pos, vel];
  };

  const task = (now) => {
    if (stopped || done) return;
    if (startTime === null) startTime = now;
    const [pos, vel] = solve((now - startTime) / 1000);
    x = pos;
    v = vel;
    onUpdate?.(x, v);
    if (Math.abs(x - to) < epsPos && Math.abs(v) < epsVel) {
      x = to;
      v = 0;
      onUpdate?.(x, v);
      done = true;
      unschedule(task);
      onComplete?.();
    }
  };

  schedule(task);

  return {
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
    get done() {
      return done;
    },
    /** Interrompe sem completar: o valor de tela fica onde está. */
    stop() {
      if (done || stopped) return;
      stopped = true;
      unschedule(task);
      onStop?.(x, v);
    },
    /** Interrompe e assenta no alvo. */
    finish() {
      if (done) return;
      stopped = true;
      unschedule(task);
      x = to;
      v = 0;
      onUpdate?.(x, v);
      onComplete?.();
    },
  };
}

/* --------------------------------------------------------- física do gesto */

/**
 * Projeção de momento — a forma exponencial que a Apple usa no
 * "Designing Fluid Interfaces". Não é v²/(2·decel): é (v/1000)·d/(1−d).
 */
export function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/** Rubber-banding: resistência progressiva no limite. */
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Normaliza velocidade para a distância restante (handoff relativo). */
export function relativeVelocity(velocity, current, target) {
  const remaining = target - current;
  if (Math.abs(remaining) < 0.0001) return 0;
  return velocity / remaining;
}

/* ------------------------------------------------------------------ haptics */

export function haptic(pattern = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* sem haptics: seguir sem feedback tátil */
  }
}

/* ------------------------------------------------------- pressão no toque */

/**
 * Feedback de pressão no pointerdown (resposta instantânea).
 *
 * `data-press="scale"`     → mola contínua de escala (botões, ações).
 * `data-press="highlight"` → classe instantânea (linhas de lista), sem
 *                            re-render por frame.
 */
export function attachPress(root = document) {
  const scaleTargets = new WeakMap();

  const setScale = (el, scale) => {
    let handle = scaleTargets.get(el);
    if (!handle) {
      handle = animateValue({
        from: Number(el.dataset.pressScale ?? 1),
        to: scale,
        response: 0.18,
        dampingRatio: 1,
        onUpdate: (value) => {
          el.dataset.pressScale = value.toFixed(4);
          el.style.setProperty('--press-scale', value.toFixed(4));
        },
      });
      scaleTargets.set(el, handle);
    } else {
      handle.stop();
      const next = animateValue({
        from: handle.value,
        to: scale,
        response: 0.22,
        dampingRatio: scale === 1 ? 0.85 : 1,
        onUpdate: (value) => {
          el.dataset.pressScale = value.toFixed(4);
          el.style.setProperty('--press-scale', value.toFixed(4));
        },
        onComplete: () => scaleTargets.delete(el),
      });
      scaleTargets.set(el, next);
    }
  };

  root.addEventListener(
    'pointerdown',
    (event) => {
      const el = event.target.closest?.('[data-press]');
      if (!el || el.hasAttribute('disabled')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      el.classList.add('is-pressed');
      if (el.dataset.press === 'scale') setScale(el, 0.965);
    },
    { passive: true },
  );

  const release = (event) => {
    const el = event.target.closest?.('[data-press]');
    if (!el) return;
    el.classList.remove('is-pressed');
    if (el.dataset.press === 'scale') setScale(el, 1);
  };

  root.addEventListener('pointerup', release, { passive: true });
  root.addEventListener('pointercancel', release, { passive: true });
  root.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') release(event);
  });

  // Teclado: o foco também precisa de resposta, mas sem escala (não há dedo).
  root.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    const el = event.target.closest?.('[data-press]');
    if (!el) return;
    el.classList.add('is-pressed');
  });
  root.addEventListener('keyup', (event) => {
    const el = event.target.closest?.('[data-press]');
    if (el) el.classList.remove('is-pressed');
  });
}

/* ------------------------------------------------------- trechos de CSS */

/** Curvas espelhadas: a volta é o inverso exato da ida. */
export const EASE_STANDARD = 'cubic-bezier(0.32, 0, 0, 1)';
export const EASE_REVERSE = 'cubic-bezier(0.68, 0, 1)';
