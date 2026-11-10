import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawButton, inside, panelBox, pointerOnStage } from './panelKit.js';

// Pausa da corrida (ESC): continuar, voltar ao menu principal ou sair do jogo. Offline a corrida congela;
// online ela segue para os outros, então o aviso diz que o carro continua na pista.

const PANEL = { x: 150, y: 82, width: 340, height: 196 };
const BUTTON = { x: 230, width: 180, height: 28, firstY: 126, gap: 38 };
const ENTRIES = [
  { id: 'resume', label: 'CONTINUAR' },
  { id: 'menu', label: 'MENU PRINCIPAL' },
  { id: 'quit', label: 'SAIR DO JOGO' },
].map((entry, i) => ({ ...entry, x: BUTTON.x, y: BUTTON.firstY + i * BUTTON.gap, width: BUTTON.width, height: BUTTON.height }));

const centered = (ctx, text, y, color, scale = 1) => ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, scale) / 2), y, color, scale);

export function createPauseMenu({ stage, isOnline, onResume, onMainMenu, onQuit }) {
  const screen = { isOpen: false };
  let pointer = { x: -1, y: -1 }, quitting = false;

  screen.open = () => { screen.isOpen = true; quitting = false; };
  // Voltar à corrida precisa recapturar o mouse dentro do próprio clique (ou tecla): o navegador exige um gesto.
  screen.resume = () => {
    screen.isOpen = false;
    onResume();
  };

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    const entry = ENTRIES.find(candidate => inside(candidate, x, y));
    if (entry?.id === 'resume') screen.resume();
    if (entry?.id === 'menu') onMainMenu();
    if (entry?.id === 'quit') { quitting = true; onQuit(); }
  });

  screen.draw = ctx => {
    ctx.fillStyle = 'rgba(8, 8, 12, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panelBox(ctx, PANEL);
    centered(ctx, quitting ? 'ATE MAIS!' : 'PAUSA', PANEL.y + 16, COLOR.selected, 2);
    if (quitting) {
      centered(ctx, 'PODE FECHAR A ABA DO NAVEGADOR.', PANEL.y + 60, COLOR.text);
      return;
    }
    for (const entry of ENTRIES) drawButton(ctx, entry, entry.label, inside(entry, pointer.x, pointer.y));
    const note = isOnline() ? 'ONLINE A CORRIDA NAO PARA: SEU CARRO FICA SEM PILOTO.' : 'SAIR ABANDONA A CORRIDA. ESC CONTINUA.';
    centered(ctx, note, PANEL.y + PANEL.height - 16, COLOR.muted);
  };
  return screen;
}
