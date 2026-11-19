// Mira dos itens de arremesso do jogador (arpão, mina e rede): o carro só conta se está na linha de visada, a
// AIM_RADIUS metros da reta que sai do nariz para onde o jogador olha (e à frente, até o alcance do item).
// Os bots não usam isto: eles miram reto à frente com os cones de cada item.

export const AIM_RADIUS = 3;

// Distância ao longo da mira (`forward`) e para o lado dela (`lateral`, positivo à direita) de um ponto (x, z).
export function aimOffset(fromX, fromZ, yaw, x, z) {
  const dx = x - fromX, dz = z - fromZ;
  return { forward: -Math.sin(yaw) * dx - Math.cos(yaw) * dz, lateral: Math.cos(yaw) * dx - Math.sin(yaw) * dz };
}

export function inAim(fromX, fromZ, yaw, x, z, range) {
  const { forward, lateral } = aimOffset(fromX, fromZ, yaw, x, z);
  return forward > 3 && forward <= range && Math.abs(lateral) <= AIM_RADIUS;
}
