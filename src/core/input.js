import { LOOK } from '../config.js';

// Teclado e mouse. `keys` guarda as teclas pressionadas; `look` a direção da cabeça do piloto.

export const keys = {};
export const look = { yaw: 0, pitch: 0 };

// Volta a cabeça para dentro dos limites normais (ao sair da janela).
export function clampLook() {
  look.yaw = clamp(look.yaw, -LOOK.maxYaw, LOOK.maxYaw);
  look.pitch = clamp(look.pitch, -LOOK.maxPitchDown, LOOK.maxPitchUp);
}

const LOOK_SPEED = 0.0024, WHEEL_MIN_INTERVAL = 90;
let stageEl = null;

export const isLocked = () => stageEl !== null && document.pointerLockElement === stageEl;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const NORMAL_LIMITS = { minYaw: -LOOK.maxYaw, maxYaw: LOOK.maxYaw, maxPitchUp: LOOK.maxPitchUp, maxPitchDown: LOOK.maxPitchDown };

// Até onde a cabeça vira. `limits()` pode trocar os limites (na janela o piloto olha para trás).
export function setupInput(stage, { bindings, isRebinding = () => false, onFire, onReload, onDropTrap, onCycleTrap, canLockPointer, sensitivity, isTyping, limits = () => NORMAL_LIMITS }) {
  stageEl = stage;

  // `keys` guarda os códigos físicos (KeyW, Mouse0...) e também cada ação (accelerate, fire...) com as teclas que o jogador escolheu.
  const actionsFor = code => Object.keys(bindings()).filter(action => bindings()[action].includes(code));
  const refresh = () => { for (const action in bindings()) keys[action] = bindings()[action].some(code => code && keys[code]); };
  const press = (code, repeat) => {
    keys[code] = true;
    refresh();
    if (repeat) return;
    const actions = actionsFor(code);
    if (actions.includes('fire')) onFire();
    if (actions.includes('trap')) onDropTrap();
  };
  const release = code => { keys[code] = false; refresh(); };

  addEventListener('keydown', e => {
    if (isTyping() || isRebinding()) return;         // digitando o nome, as teclas não comandam o carro
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();   // TAB abre a tabela da partida, não muda o foco
    const actions = actionsFor(e.code);
    if (actions.includes('recenter')) { look.yaw = 0; look.pitch = 0; }
    if (actions.includes('reload')) onReload();
    if (actions.includes('fire') && !isLocked()) { keys[e.code] = true; refresh(); return; }   // sem mouse preso o tiro por tecla não dispara
    press(e.code, e.repeat);
  });
  addEventListener('keyup', e => release(e.code));
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  stage.addEventListener('click', () => { if (!isLocked() && canLockPointer()) stage.requestPointerLock()?.catch?.(() => {}); });
  document.addEventListener('pointerlockchange', () => {
    if (!isLocked()) { keys.Mouse0 = keys.Mouse1 = keys.Mouse2 = false; refresh(); }
  });

  addEventListener('mousemove', e => {
    if (!isLocked()) return;
    const speed = LOOK_SPEED * sensitivity();
    const { minYaw, maxYaw, maxPitchUp, maxPitchDown } = limits();
    look.yaw = clamp(look.yaw - e.movementX * speed, minYaw, maxYaw);
    look.pitch = clamp(look.pitch - e.movementY * speed, -maxPitchDown, maxPitchUp);
  });
  addEventListener('mousedown', e => {
    if (!isLocked()) return;
    press(`Mouse${e.button}`, false);
  });
  addEventListener('mouseup', e => release(`Mouse${e.button}`));
  let lastWheelTime = 0;
  addEventListener('wheel', e => {
    if (!isLocked()) return;
    e.preventDefault();
    if (e.timeStamp - lastWheelTime < WHEEL_MIN_INTERVAL || e.deltaY === 0) return;
    lastWheelTime = e.timeStamp;
    onCycleTrap(Math.sign(e.deltaY));
  }, { passive: false });
  addEventListener('contextmenu', e => e.preventDefault());
}
