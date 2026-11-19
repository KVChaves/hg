import { LAPS, MAX_RACERS, VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { BIOMES } from '../world/biomes/index.js';
import { COLOR, drawButton, drawHeading, inside, panelBox, pointerOnStage } from './panelKit.js';

// Configuração da partida do singleplayer. Campeonato: quantos carros e quantas corridas, depois a garagem.
// Corrida rápida: quantos carros e em qual bioma; vai direto para a pista com o carro e as compras salvos.

const PANEL = { x: 110, y: 46, width: 420, height: 268 };
const ROW_Y = [100, 144, 188], ARROW = 30, VALUE_WIDTH = 176, ROW_X = 268;
const CONTINUE = { x: 330, y: 274, width: 170, height: 28 };
const BACK = { x: 140, y: 274, width: 170, height: 28 };
const SWATCH = { width: 18, height: 14 };

const MODES = [
  { id: 'championship', name: 'CAMPEONATO', note: `CADA CORRIDA TEM ${LAPS} VOLTAS. QUEM VENCER MAIS CORRIDAS GANHA.` },
  { id: 'quick', name: 'CORRIDA RAPIDA', note: 'UMA CORRIDA SO, DIRETO NA PISTA COM O CARRO DA GARAGEM.' },
];
const BIOME_CHOICES = ['random', ...BIOMES.map(biome => biome.id)];
const biomeName = id => (id === 'random' ? 'ALEATORIO' : BIOMES.find(biome => biome.id === id).name);

// Cada linha muda um campo: por lista de opções (`choices`) ou por número (`min`/`max`).
const FIELD = {
  mode: { key: 'mode', label: 'MODO', choices: MODES.map(mode => mode.id), show: id => MODES.find(mode => mode.id === id).name },
  cars: { key: 'cars', label: 'CARROS', min: 2, max: MAX_RACERS },
  races: { key: 'races', label: 'CORRIDAS', min: 1, max: 10 },
  biome: { key: 'biome', label: 'BIOMA', choices: BIOME_CHOICES, show: biomeName },
};

export function createMatchSetupScreen({ stage, onContinue, onBack }) {
  const config = { mode: 'championship', cars: MAX_RACERS, races: 3, biome: 'random' };
  const screen = { isOpen: false, config };
  let pointer = { x: -1, y: -1 }, queued = null;

  const rows = () => [FIELD.mode, FIELD.cars, config.mode === 'quick' ? FIELD.biome : FIELD.races];
  const arrows = () => rows().flatMap((field, row) => [
    { field, step: -1, label: '<', x: ROW_X, y: ROW_Y[row] - 6, width: ARROW, height: 24 },
    { field, step: 1, label: '>', x: ROW_X + ARROW + VALUE_WIDTH, y: ROW_Y[row] - 6, width: ARROW, height: 24 },
  ]);

  function change(field, step) {
    const { key, choices, min, max } = field;
    if (choices) config[key] = choices[(choices.indexOf(config[key]) + step + choices.length) % choices.length];
    else config[key] = Math.max(min, Math.min(max, config[key] + step));
  }

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    const arrow = arrows().find(candidate => inside(candidate, x, y));
    if (arrow) { change(arrow.field, arrow.step); return; }
    // Trocar de tela só no próximo quadro evita que este clique acione também a tela seguinte.
    const leave = action => { queued = () => { screen.isOpen = false; action(); }; };
    if (inside(CONTINUE, x, y)) leave(onContinue);
    if (inside(BACK, x, y)) leave(onBack);
  });

  screen.update = () => {
    if (!queued) return;
    queued();
    queued = null;
  };
  screen.open = () => { screen.isOpen = true; };
  // O que vale para a partida: a corrida rápida é sempre uma corrida só.
  screen.matchConfig = () => ({ ...config, races: config.mode === 'quick' ? 1 : config.races });

  // Amostra das cores do bioma (céu e cabine), ao lado do nome.
  function drawSwatch(ctx, id, x, y) {
    const biome = BIOMES.find(candidate => candidate.id === id);
    if (!biome) return;
    const hex = c => `#${c.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = COLOR.edge;
    ctx.fillRect(x - 1, y - 1, SWATCH.width + 2, SWATCH.height + 2);
    ctx.fillStyle = hex(biome.sky);
    ctx.fillRect(x, y, SWATCH.width, SWATCH.height / 2);
    ctx.fillStyle = hex(biome.cabinTint);
    ctx.fillRect(x, y + SWATCH.height / 2, SWATCH.width, SWATCH.height / 2);
  }

  screen.draw = ctx => {
    panelBox(ctx, PANEL);
    const title = 'NOVA PARTIDA';
    drawHeading(ctx, title, VIEW.width / 2, PANEL.y + 16);

    rows().forEach((field, row) => {
      const y = ROW_Y[row], value = field.show ? field.show(config[field.key]) : String(config[field.key]);
      ctxText(ctx, field.label, PANEL.x + 24, y, COLOR.text, 2);
      ctxText(ctx, value, ROW_X + ARROW + Math.round((VALUE_WIDTH - textWidth(value, 2)) / 2), y, COLOR.selected, 2);
      if (field === FIELD.biome) drawSwatch(ctx, config.biome, PANEL.x + 96, y - 3);
    });
    for (const arrow of arrows()) drawButton(ctx, arrow, arrow.label, inside(arrow, pointer.x, pointer.y));

    const note = MODES.find(mode => mode.id === config.mode).note;
    ctxText(ctx, note, Math.round(VIEW.width / 2 - textWidth(note) / 2), 240, COLOR.muted);

    drawButton(ctx, BACK, '< MENU', inside(BACK, pointer.x, pointer.y));
    drawButton(ctx, CONTINUE, config.mode === 'quick' ? 'CORRER >' : 'CONTINUAR >', inside(CONTINUE, pointer.x, pointer.y), 'primary');
  };
  return screen;
}
