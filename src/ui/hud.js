import { SLIPSTREAM_KMH, VIEW } from '../config.js';
import { drawCrosshair } from './crosshair.js';
import { ctxText, textWidth } from '../art/font.js';
import { bayer, hash } from '../art/shade.js';
import { clearClickable } from './panelKit.js';
import { codeLabel } from '../game/settings.js';
import { loadPng, pngNow } from '../cabin/pngPixels.js';
import { drawRacerNames } from './racerNames.js';

// Elementos de tela: mãos e arma (ver hands.js), mira e avisos.

const CENTER_X = VIEW.width / 2, CENTER_Y = VIEW.height / 2;

const SLIPSTREAM_MIN_SHOWN = 0.08, SLIPSTREAM_STREAKS = 26, SLIPSTREAM_CENTER_Y = 145, SLIPSTREAM_TOP = 62, SLIPSTREAM_BOTTOM = 228;
const TOP_MESSAGE_X = 275, TOP_MESSAGE_Y = 32;       // abaixo do título dos feitos, ainda no teto da cabine
const SUPPLY_BIG_TEXT = 26;                          // mensagens maiores usam a letra pequena para não cobrir o placar
const WRONG_WAY_BLINK = 5;                           // meias-piscadas por segundo do aviso de contramão
const BURN_FLAMES = 34, BURN_FLAME_HEIGHT = 46, BURN_FRAMES = 12;   // chamas no pé da tela com o carro pegando fogo
const BURN_COLORS = ['#7a1808', '#d83a10', '#ff8a20', '#ffd060'];
const FIRE_SPRITE = 'assets/fx/fire.png', SPEED_LINE_SPRITE = 'assets/fx/speed-line.png';
loadPng(FIRE_SPRITE).catch(() => {});
loadPng(SPEED_LINE_SPRITE).catch(() => {});

function centered(ctx, text, y, color, scale = 1) {
  const x = Math.round(CENTER_X - textWidth(text, scale) / 2);
  ctxText(ctx, text, x + 1, y + 1, '#000000', scale);
  ctxText(ctx, text, x, y, color, scale);
}

// As teclas vêm das configurações (o jogador pode remapear); só a roda do mouse e o olhar são fixos.
const controlsFor = settings => {
  const key = action => codeLabel(settings.bindings[action].find(Boolean));   // só a primeira tecla: a coluna é estreita
  return [
    [key('accelerate'), 'ACELERA'], [key('brake'), 'FREIA E RE'], [`${key('left')} / ${key('right')}`, 'DIRECAO'], [key('nitro'), 'NITRO'],
    [key('handbrake'), 'DRIFT NAS CURVAS'], [key('trap'), 'USA ITEM DO BAGAGEIRO'], ['RODA DO MOUSE', 'TROCA ITEM'], ['MOUSE P/ ESQUERDA', 'OLHA PELA JANELA'],
    [key('horn'), 'BUZINA'], ['MOUSE', 'OLHA'], [key('fire'), 'ATIRA'], [key('aim'), 'SEGURA A ARMA'], [key('reload'), 'RECARREGA'], [key('recenter'), 'CENTRALIZA A CAMERA'],
  ];
};
const NPC_HELP = ['SE VOCE ESTIVER MUITO ATRAS, UM NPC ACENA', 'NA BEIRA DA PISTA COM UM ITEM ACIMA DA CABECA:', 'MUNICAO, NITRO, EXTINTOR OU ARMADILHA.', 'PASSE PERTO DELE PARA PEGAR O ITEM.'];

// Pop-up antes da contagem: botões do jogo e o que querem dizer os NPCs da beira da pista.
// `challenge`: linhas do desafio próprio da pista (campo `challenge` do bioma), quando ela tem um.
function drawIntroPopup(ctx, timeLeft, challenge = [], settings) {
  const CONTROLS = controlsFor(settings);
  const w = 440, lineH = 11, rows = Math.ceil(CONTROLS.length / 2);
  const h = 62 + rows * lineH + 14 + NPC_HELP.length * lineH + 16 + (challenge.length ? 14 + challenge.length * lineH : 0);
  const x = Math.round(CENTER_X - w / 2), y = Math.round(VIEW.height / 2 - h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f0d060'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
  centered(ctx, 'COMO JOGAR', y + 8, '#f0d060', 2);
  const colW = (w - 24) / 2;
  CONTROLS.forEach(([key, text], i) => {
    const cx = x + 12 + (i % 2) * colW, cy = y + 32 + Math.floor(i / 2) * lineH;
    ctxText(ctx, key, cx, cy, '#ffe9a0');
    ctxText(ctx, text, cx + 86, cy, '#e8d8c0');
  });
  let ny = y + 32 + rows * lineH + 8;
  centered(ctx, 'NPCS NA BEIRA DA PISTA', ny, '#6fe070'); ny += lineH + 3;
  for (const line of NPC_HELP) { centered(ctx, line, ny, '#e8d8c0'); ny += lineH; }
  if (challenge.length) {
    ny += 3;
    centered(ctx, 'DESAFIO DA PISTA', ny, '#ff9a40'); ny += lineH + 3;
    for (const line of challenge) { centered(ctx, line, ny, '#ffe9a0'); ny += lineH; }
  }
  centered(ctx, `A CORRIDA COMECA EM ${Math.ceil(timeLeft)}`, y + h - 14, '#a89878');
}

const DAMAGE_BAND = 22;                           // largura em pixels da borda vermelha ao levar dano
const DAMAGE_COLOR = '#d01810';
const SECTOR = Math.PI / 4;

// Borda quadriculada, mais densa junto à beirada da tela. `edgeAt(x, y)` é a distância até a beirada.
function paintDamageBand(width, height, edgeAt) {
  const band = document.createElement('canvas');
  band.width = width;
  band.height = height;
  const ctx = band.getContext('2d');
  ctx.fillStyle = DAMAGE_COLOR;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) if (bayer(x, y) < 1 - edgeAt(x, y) / DAMAGE_BAND) ctx.fillRect(x, y, 1, 1);
  }
  return band;
}

export function createHud(canvas, { chat, matchTable, isTableHeld, killFeed, pause, scope, featFeed, mainMenu, multiplayer, podium, matchSetup, results, voteScreen, draftScreen, matchLabel, biomeName, biomeChallenge = () => [], race, weapon, hands, garage, workshop, windowView, spectator, spectatorExit, isLocked, combat, car, activeCamera, opponents, isBehindCabin, isInSmoke, roadsideHelp, traps, powerStatus = () => [], settings }) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;


  const bands = {
    front: paintDamageBand(VIEW.width, DAMAGE_BAND, (x, y) => y),
    back: paintDamageBand(VIEW.width, DAMAGE_BAND, (x, y) => DAMAGE_BAND - 1 - y),
    left: paintDamageBand(DAMAGE_BAND, VIEW.height, x => x),
    right: paintDamageBand(DAMAGE_BAND, VIEW.height, x => DAMAGE_BAND - 1 - x),
  };
  const drawBand = {
    front: () => ctx.drawImage(bands.front, 0, 0),
    back: () => ctx.drawImage(bands.back, 0, VIEW.height - DAMAGE_BAND),
    left: () => ctx.drawImage(bands.left, 0, 0),
    right: () => ctx.drawImage(bands.right, VIEW.width - DAMAGE_BAND, 0),
  };

  // Mostra de que lado veio o tiro; o carro destruído fica com a tela toda cercada.
  function drawDamage() {
    if (car.wrecked > 0) {
      Object.values(drawBand).forEach(draw => draw());
      return;
    }
    if (combat.hitFlash <= 0) return;
    const angle = combat.hitAngle;
    if (Math.abs(angle) < SECTOR) drawBand.front();
    else if (Math.abs(angle) > Math.PI - SECTOR) drawBand.back();
    else if (angle > 0) drawBand.left();
    else drawBand.right();
  }

  // Escudo, EMP e mina grudada: uma linha de estado para cada, logo abaixo do topo.
  function drawPowerStatus() {
    powerStatus().forEach(({ text, color }, i) => centered(ctx, text, 40 + i * 14, color, 1));
  }

  // Carro em chamas: línguas de fogo em pixel subindo do pé da tela, mais altas quanto mais fogo resta.
  function drawBurning() {
    const left = car.effects.burning;
    if (left <= 0 || car.wrecked > 0) return;
    const frame = Math.floor(performance.now() / 1000 * BURN_FRAMES), strength = Math.min(1, left / 1.5);
    const fireArt = pngNow(FIRE_SPRITE);
    if (fireArt) {
      const count = 16, step = VIEW.width / count;
      for (let i = 0; i < count; i++) {
        const edge = Math.abs(i / (count - 1) - 0.5) * 2;
        const h = Math.round(80 * strength * (0.4 + 0.6 * edge) * (0.65 + 0.35 * hash(i, frame))), w = Math.round(h * 0.9);
        if (h < 4) continue;
        ctx.save();
        if ((frame + i) & 1) { ctx.translate(Math.round(i * step + step / 2 + w / 2), 0); ctx.scale(-1, 1); } else ctx.translate(Math.round(i * step + step / 2 - w / 2), 0);
        ctx.drawImage(fireArt, 0, VIEW.height - h, w, h);
        ctx.restore();
      }
      if (Math.floor(performance.now() / 250) % 2 === 0) centered(ctx, 'PEGANDO FOGO', 290, '#ffb040', 2);
      return;
    }
    const width = VIEW.width / BURN_FLAMES;
    for (let i = 0; i < BURN_FLAMES; i++) {
      const edge = Math.abs(i / (BURN_FLAMES - 1) - 0.5) * 2;           // mais alto nos cantos, para não tapar a pista
      const h = Math.round(BURN_FLAME_HEIGHT * strength * (0.35 + 0.65 * edge) * (0.55 + 0.45 * hash(i, frame)));
      const x = Math.round(i * width + (hash(i + 50, frame) - 0.5) * 4);
      // cada língua afina até a ponta e entorta um pouco; as camadas de dentro são mais claras e baixas
      BURN_COLORS.forEach((color, layer) => {
        const lh = Math.round(h * (1 - layer * 0.24)), lw = width * 1.6 * (1 - layer * 0.22);
        ctx.fillStyle = color;
        for (let row = 0; row < lh; row += 2) {
          const t = row / Math.max(1, lh), w = Math.max(1, Math.round(lw * (1 - t) ** 0.8));
          const bend = Math.round(Math.sin(t * 3 + i + frame * 0.7) * t * 3);
          ctx.fillRect(Math.round(x + width / 2 - w / 2) + bend, VIEW.height - row - 2, w, 2);
        }
      });
    }
    if (Math.floor(performance.now() / 250) % 2 === 0) centered(ctx, 'PEGANDO FOGO', 290, '#ffb040', 2);
  }

  // Mira escolhida na oficina (ui/crosshair.js): pisca em vermelho no acerto e abre com a rajada.
  const drawGunCrosshair = () => drawCrosshair(ctx, CENTER_X, CENTER_Y, settings.crosshair, { hit: weapon.hitMarker > 0, spread: weapon.spread });

  // Mira de arremesso (arpão, mina e rede): anel com cantos, bem diferente da mira da arma.
  // Fecha os cantos e fica verde quando há um carro na área de mira; sem ninguém, avisa e o clique não gasta a carga.
  function drawThrowReticle() {
    const kind = traps.current?.type.id, locked = Boolean(traps.aimLock);
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / (locked ? 70 : 120)), color = locked ? '#a0ff9c' : ({ mine: '#ff6a50', net: '#b890ff' }[kind] ?? '#ffd060');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    const r = locked ? 10 : 14;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillRect(CENTER_X + sx * r - (sx > 0 ? 6 : 0), CENTER_Y + sy * r - (sy > 0 ? 2 : 0), 6, 2);
      ctx.fillRect(CENTER_X + sx * r - (sx > 0 ? 2 : 0), CENTER_Y + sy * r - (sy > 0 ? 6 : 0), 2, 6);
    }
    ctx.fillRect(CENTER_X - 1, CENTER_Y - 1, 2, 2);
    ctx.globalAlpha = 1;
    centered(ctx, locked ? `CLIQUE: ${kind === 'net' ? 'LANCAR REDE' : 'ARREMESSAR'}  E: CANCELAR` : 'SEM ALVO NA MIRA  E: CANCELAR', CENTER_Y + 34, color);
  }

  // Riscos de vento na direção do centro e o ganho atual; a força acompanha o vácuo.
  function drawSlipstream() {
    const strength = car.slipstream;
    if (strength < SLIPSTREAM_MIN_SHOWN || !race.started || race.finished) return;
    const time = performance.now() / 1000;
    const lineArt = pngNow(SPEED_LINE_SPRITE);
    if (lineArt) {
      ctx.globalAlpha = Math.min(0.85, strength * 0.85);
      for (let i = 0; i < SLIPSTREAM_STREAKS / 2; i++) {
        const angle = i * 2.399 * 2, phase = (time * 2.4 + i * 0.37) % 1, dx = Math.cos(angle), dy = Math.sin(angle) * 0.55;
        const reach = 60 + phase * 190, y = SLIPSTREAM_CENTER_Y + dy * reach;
        if (y < SLIPSTREAM_TOP || y > SLIPSTREAM_BOTTOM) continue;
        ctx.save();
        ctx.translate(Math.round(CENTER_X + dx * reach), Math.round(y));
        ctx.rotate(Math.atan2(dy, dx));
        ctx.drawImage(lineArt, 0, -2, Math.round(24 + phase * 60), 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      centered(ctx, `VACUO +${Math.ceil(strength * SLIPSTREAM_KMH)} KM/H`, 63, '#80e0ff');
      return;
    }
    ctx.fillStyle = '#d8f0ff';
    ctx.globalAlpha = Math.min(0.75, strength * 0.75);
    for (let i = 0; i < SLIPSTREAM_STREAKS; i++) {
      const angle = i * 2.399, phase = (time * 2.4 + i * 0.37) % 1, dx = Math.cos(angle), dy = Math.sin(angle) * 0.55;
      for (let step = 0; step < 9; step++) {
        const reach = 60 + phase * 190 + step * (2 + phase * 3), y = Math.round(SLIPSTREAM_CENTER_Y + dy * reach);
        if (y > SLIPSTREAM_TOP && y < SLIPSTREAM_BOTTOM) ctx.fillRect(Math.round(CENTER_X + dx * reach), y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    centered(ctx, `VACUO +${Math.ceil(strength * SLIPSTREAM_KMH)} KM/H`, 63, '#80e0ff');
  }

  function drawMessages() {
    featFeed.draw(ctx, activeCamera());
    drawSlipstream();
    if (weapon.isReloading) centered(ctx, 'RECARREGANDO', 214, '#e8d8c0');
    if (traps.notice.time > 0) centered(ctx, traps.notice.text, 228, traps.notice.good ? '#6fe070' : '#f06050');
    if (roadsideHelp.messageTime > 0) {
      const scale = roadsideHelp.message.length > SUPPLY_BIG_TEXT ? 1 : 2, x = Math.round(TOP_MESSAGE_X - textWidth(roadsideHelp.message, scale) / 2);
      ctxText(ctx, roadsideHelp.message, x + 1, TOP_MESSAGE_Y + 1, '#000000', scale);
      ctxText(ctx, roadsideHelp.message, x, TOP_MESSAGE_Y, '#6fe070', scale);
    }
    if (weapon.hitPartTime > 0 && weapon.hitPart) centered(ctx, `${weapon.hitPart}!`, 198, '#ff8040');
    if (weapon.outOfAmmo > 0) centered(ctx, 'SEM MUNICAO', 214, '#f06050');
    if (!isLocked() && !spectator.active && !pause.isOpen) centered(ctx, 'CLIQUE PARA CAPTURAR O MOUSE', 150, '#e8d8c0');
    if (race.wrongWay && race.goTimer <= 0) {
      if (Math.floor(race.time * WRONG_WAY_BLINK) % 2 === 0) centered(ctx, 'CONTRAMAO', 112, '#ff3a2a', 3);
      centered(ctx, 'VIRE O CARRO', 142, '#ffe9a0');
    }

    if (!race.started) {
      centered(ctx, matchLabel(), 80, '#e8d8c0', 2);
      centered(ctx, biomeName(), 100, '#ffe9a0');
    }
    if (!race.started && race.intro <= 0) centered(ctx, String(Math.min(3, Math.ceil(race.countdown))), 118, '#ffe9a0', 4);
    if (!race.started && race.intro > 0) drawIntroPopup(ctx, race.intro, biomeChallenge(), settings);
    else if (race.goTimer > 0) centered(ctx, 'GO!', 118, '#6fe070', 4);
    if (race.started) killFeed.draw(ctx);
    if (car.wrecked > 0) {
      centered(ctx, 'CARRO DESTRUIDO', 118, '#f06050', 2);
      const by = car.destroyedBy ? 12 : 0;
      if (by) centered(ctx, `POR ${String(car.destroyedBy).toUpperCase()}`, 140, '#ffe9a0');
      centered(ctx, `VOLTA EM ${Math.ceil(car.wrecked)}`, 142 + by, '#e8d8c0');
    } else if (car.sunk > 0) {
      centered(ctx, car.jump?.fallLabel ?? 'CAIU', 118, '#5ac8f0', 2);
      centered(ctx, `VOLTA EM ${Math.ceil(car.sunk)}`, 142, '#e8d8c0');
    } else if (car.overturned) {
      centered(ctx, 'CAPOTOU', 118, '#f06050', 2);
    }
    if (race.crossed && !race.finished) {
      centered(ctx, 'VOCE CHEGOU!', 118, '#ffe9a0', 2);
      centered(ctx, 'AGUARDANDO OS OUTROS PILOTOS', 142, '#e8d8c0');
    }
    if (spectator.active) {
      centered(ctx, `ESPECTANDO ${spectator.targetName}`, 20, '#ffe9a0', 2);
      centered(ctx, `< > TROCA DE PILOTO    ${spectatorExit()}`, 336, '#e8d8c0');
    }
    if (race.finished) {
      centered(ctx, `CHEGOU EM ${race.finalRank} DE ${race.field.length}`, 118, '#ffe9a0', 2);
    }
  }

  function drawScreen() {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    clearClickable();
    if (mainMenu.isOpen) { mainMenu.draw(ctx); return; }
    if (multiplayer.isOpen) { multiplayer.draw(ctx); return; }
    if (podium.isOpen) { podium.draw(ctx); return; }
    if (matchSetup.isOpen) { matchSetup.draw(ctx); return; }
    if (voteScreen.isOpen) { voteScreen.draw(ctx); return; }
    if (draftScreen.isOpen) { draftScreen.draw(ctx); return; }
    if (results.isOpen) { results.draw(ctx); return; }
    if (garage.isOpen) {
      if (garage.view === 'cabin') hands.draw(ctx);
      garage.draw(ctx);
      return;
    }
    if (workshop.isOpen) { workshop.draw(ctx); return; }
    const scoped = scope.active && !spectator.active;
    if (!spectator.active && !scoped) {
      hands.draw(ctx, { outside: windowView.active });
      if (traps.aiming) drawThrowReticle();
      else if (hands.isHoldingGun()) drawGunCrosshair();
    }
    if (race.started) drawRacerNames(ctx, activeCamera(), opponents, (x, y, z) => isInSmoke(x, z) || (!windowView.active && !scoped && isBehindCabin(x, y, z)));
    if (scoped) scope.draw(ctx);
    if (!windowView.active && !spectator.active) drawBurning();
    drawPowerStatus();
    drawDamage();
    drawMessages();
    if (pause.isOpen) pause.draw(ctx);
  }

  // A tabela da partida (TAB) vai por cima de qualquer tela.
  return () => {
    drawScreen();
    if (isTableHeld()) matchTable.draw(ctx);
    chat.draw(ctx);
  };
}
