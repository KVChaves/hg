// Balanço do enfeite do retrovisor: um pêndulo empurrado pelas curvas e pela trepidação da pista.

const STIFFNESS = 36, DAMPING = 1.5, TURN_FORCE = 0.9, ROAD_SHAKE = 0.05;
const IDLE_SWAY = 0.5, IDLE_SPEED = 1.7, MAX_ANGLE = 0.9, NUDGE = 3;

export function createCharmPendulum() {
  let angle = 0, velocity = 0, clock = 0;

  return {
    // Dá um empurrão, para o enfeite balançar ao ser escolhido na garagem.
    nudge() { velocity = NUDGE; },

    step(dt, { speed, yawRate, bob }) {
      clock += dt;
      const turn = speed * yawRate * TURN_FORCE;
      const road = Math.sin(bob * 5) * Math.abs(speed) * ROAD_SHAKE;
      const idle = Math.sin(clock * IDLE_SPEED) * IDLE_SWAY;

      velocity += (turn + road + idle - STIFFNESS * Math.sin(angle) - DAMPING * velocity) * dt;
      angle += velocity * dt;
      if (Math.abs(angle) > MAX_ANGLE) {
        angle = Math.sign(angle) * MAX_ANGLE;
        velocity *= -0.3;
      }
      return angle;
    },
  };
}
