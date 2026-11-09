import { LOOK } from '../config.js';

// Teclado e mouse. `keys` guarda as teclas pressionadas; `look` a direção da cabeça do piloto.

export const keys = {};
export const look = { yaw: 0, pitch: 0 };

const LOOK_SPEED = 0.0024, WHEEL_MIN_INTERVAL = 90;
let stageEl = null;

export const isLocked = () => stageEl !== null && document.pointerLockElement === stageEl;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function setupInput(stage, { onFire, onReload, onDropTrap, onCycleTrap, canLockPointer, sensitivity, isTyping }) {
  stageEl = stage;

  addEventListener('keydown', e => {
    if (isTyping()) return;                          // digitando o nome, as teclas não comandam o carro
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyC') { look.yaw = 0; look.pitch = 0; }
    if (e.code === 'KeyR') onReload();
    if (e.code === 'KeyE' && !e.repeat) onDropTrap();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  stage.addEventListener('click', () => { if (!isLocked() && canLockPointer()) stage.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    if (!isLocked()) { keys.AimButton = false; keys.FireButton = false; }
  });

  addEventListener('mousemove', e => {
    if (!isLocked()) return;
    const speed = LOOK_SPEED * sensitivity();
    look.yaw = clamp(look.yaw - e.movementX * speed, -LOOK.maxYaw, LOOK.maxYaw);
    look.pitch = clamp(look.pitch - e.movementY * speed, -LOOK.maxPitchDown, LOOK.maxPitchUp);
  });
  addEventListener('mousedown', e => {
    if (!isLocked()) return;
    if (e.button === 0) { keys.FireButton = true; onFire(); }
    if (e.button === 2) keys.AimButton = true;
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) keys.FireButton = false;
    if (e.button === 2) keys.AimButton = false;
  });
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
