// Mede cada drift do jogador e avisa quando ele termina. Soltar o Shift por um instante não quebra a sequência.

const MIN_SLIP = 0.14, MIN_SPEED = 8;                // radianos de derrapagem e m/s
const MIN_DURATION = 0.6, PAUSE_ALLOWED = 0.25;      // segundos

export function createDriftTracker(car, onDrift) {
  let duration = 0, pause = 0;

  function isSliding() {
    const speed = Math.hypot(car.vx, car.vz);
    if (!car.drifting || speed < MIN_SPEED) return false;
    const along = (-Math.sin(car.yaw) * car.vx - Math.cos(car.yaw) * car.vz) / speed;
    return Math.acos(Math.min(1, Math.abs(along))) > MIN_SLIP;
  }

  function finish() {
    if (duration >= MIN_DURATION) onDrift(duration);
    duration = pause = 0;
  }

  return {
    get current() { return duration; },               // segundos do drift em andamento (0 se não há)
    update(dt) {
      if (dt <= 0) return;
      if (car.wrecked > 0 || car.overturned) { duration = pause = 0; return; }
      if (isSliding()) {
        duration += dt;
        pause = 0;
      } else if (duration > 0 && (pause += dt) > PAUSE_ALLOWED) {
        finish();
      }
    },
    reset() { duration = pause = 0; },
  };
}
