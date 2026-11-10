import { VIEW } from '../config.js';
import { bayer, smooth } from '../art/shade.js';

// Luneta da sniper: segurando o botão direito com a sniper na mão, a câmera fecha o campo de visão e a tela
// vira a luneta. A mira balança com a respiração e muito mais com o carro andando, e o mouse fica mais lento.
// Tinta no para-brisa impede de mirar (não dá para ver através dela).

const SCOPE_FOV = 20, ZOOM_SPEED = 14, SHOWN_FROM = 0.55;
const SWAY_STILL = 0.0035, SWAY_MOVING = 0.012, SWAY_FULL_SPEED = 40;     // radianos; m/s em que o balanço é máximo
const RADIUS = 168, EDGE = 10;                                            // pixels da tela
const CX = VIEW.width / 2, CY = VIEW.height / 2;

// Máscara preta com o círculo da lente, a borda pontilhada e a retícula com marcas.
function paintScope() {
  const canvas = document.createElement('canvas');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#050506';
  for (let y = 0; y < VIEW.height; y++) {
    for (let x = 0; x < VIEW.width; x++) {
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
      if (d > RADIUS || (d > RADIUS - EDGE && bayer(x, y) < (d - (RADIUS - EDGE)) / EDGE)) ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = '#0a0a0c';
  // fios grossos que afinam perto do centro
  ctx.fillRect(CX - RADIUS, CY - 1, RADIUS - 40, 3);
  ctx.fillRect(CX + 40, CY - 1, RADIUS - 40, 3);
  ctx.fillRect(CX - 1, CY + 40, 3, RADIUS - 40);
  ctx.fillRect(CX - 1, CY - RADIUS, 3, RADIUS - 40);
  ctx.fillRect(CX - 40, CY, 34, 1);
  ctx.fillRect(CX + 7, CY, 34, 1);
  ctx.fillRect(CX, CY + 7, 1, 34);
  ctx.fillRect(CX, CY - 40, 1, 34);
  for (let k = 1; k <= 4; k++) {
    ctx.fillRect(CX - 1 - k * 9, CY - 2, 2, 5);
    ctx.fillRect(CX + k * 9, CY - 2, 2, 5);
    ctx.fillRect(CX - 2, CY + k * 9, 5, 2);
  }
  ctx.fillStyle = '#e02818';
  ctx.fillRect(CX - 1, CY - 1, 2, 2);
  return canvas;
}

export function createScope({ camera, weapon, hands, car, isAiming, canAim }) {
  const overlay = paintScope();
  let amount = 0, clock = 0, lastFov = VIEW.fov;

  const scope = {
    get active() { return amount >= SHOWN_FROM; },
    // fator da sensibilidade do mouse: com zoom, o mesmo movimento gira menos
    sensitivity: () => 1 + (SCOPE_FOV / VIEW.fov - 1) * smooth(amount),
    update(dt) {
      const wants = weapon.type.id === 'sniper' && isAiming() && hands.isHoldingGun() && !weapon.isReloading && car.effects.paint <= 0 && canAim();
      amount += ((wants ? 1 : 0) - amount) * (1 - Math.exp(-ZOOM_SPEED * dt));
      if (!wants && amount < 0.01) amount = 0;
      const fov = VIEW.fov + (SCOPE_FOV - VIEW.fov) * smooth(amount);
      if (Math.abs(fov - lastFov) > 0.01) {
        camera.fov = lastFov = fov;
        camera.updateProjectionMatrix();
      }
      clock += dt;
      const moving = Math.min(1, Math.abs(car.speed) / SWAY_FULL_SPEED), sway = (SWAY_STILL + SWAY_MOVING * moving) * amount;
      camera.rotation.set(
        Math.sin(clock * 1.3) * sway + Math.sin(clock * 7.3) * sway * 0.35 * moving,
        Math.sin(clock * 0.9 + 1) * sway * 1.2 + Math.sin(clock * 5.9) * sway * 0.3 * moving,
        0,
      );
    },
    draw(ctx) {
      if (scope.active) ctx.drawImage(overlay, 0, 0);
    },
  };
  return scope;
}
