import { LAPS, MAX_RACERS, VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawButton, inside, panelBox, pointerOnStage } from './panelKit.js';

// Configuração da partida, antes da garagem: quantos carros e quantas corridas.

const PANEL = { x: 130, y: 54, width: 380, height: 252 };
const ROW_Y = [122, 182], ARROW = 30, VALUE_WIDTH = 70, ROW_X = 330;
const CONTINUE = { x: 330, y: 266, width: 160, height: 28 };
const BACK = { x: 150, y: 266, width: 160, height: 28 };

const FIELDS = [
  { key: 'cars', label: 'CARROS', min: 2, max: MAX_RACERS },
  { key: 'races', label: 'CORRIDAS', min: 1, max: 10 },
];

export function createMatchSetupScreen({ stage, onContinue, onBack }) {
  const config = { cars: MAX_RACERS, races: 3 };
  const screen = { isOpen: false, config };
  let pointer = { x: -1, y: -1 }, queued = null;

  const arrows = FIELDS.flatMap((field, row) => [
    { field, step: -1, label: '<', x: ROW_X, y: ROW_Y[row] - 6, width: ARROW, height: 24 },
    { field, step: 1, label: '>', x: ROW_X + ARROW + VALUE_WIDTH, y: ROW_Y[row] - 6, width: ARROW, height: 24 },
  ]);

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    const arrow = arrows.find(candidate => inside(candidate, x, y));
    if (arrow) {
      const { key, min, max } = arrow.field;
      config[key] = Math.max(min, Math.min(max, config[key] + arrow.step));
      return;
    }
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

  screen.draw = ctx => {
    panelBox(ctx, PANEL);
    const title = 'NOVA PARTIDA';
    ctxText(ctx, title, Math.round(VIEW.width / 2 - textWidth(title, 2) / 2), PANEL.y + 16, COLOR.selected, 2);

    FIELDS.forEach((field, row) => {
      const y = ROW_Y[row], value = String(config[field.key]);
      ctxText(ctx, field.label, PANEL.x + 30, y, COLOR.text, 2);
      ctxText(ctx, value, ROW_X + ARROW + Math.round((VALUE_WIDTH - textWidth(value, 2)) / 2), y, COLOR.selected, 2);
    });
    for (const arrow of arrows) drawButton(ctx, arrow, arrow.label, inside(arrow, pointer.x, pointer.y));

    const note = `CADA CORRIDA TEM ${LAPS} VOLTAS. QUEM VENCER MAIS CORRIDAS GANHA.`;
    ctxText(ctx, note, Math.round(VIEW.width / 2 - textWidth(note) / 2), 232, COLOR.muted);

    drawButton(ctx, BACK, '< MENU', inside(BACK, pointer.x, pointer.y));
    drawButton(ctx, CONTINUE, 'CONTINUAR >', inside(CONTINUE, pointer.x, pointer.y));
  };
  return screen;
}
