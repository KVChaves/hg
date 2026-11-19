import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawButton, drawHeading, inside, panelBox, pointerOnStage } from './panelKit.js';

// Pausa da corrida (ESC): continuar, reiniciar a corrida (só offline, tecla R), voltar ao menu principal ou sair do jogo. Offline a corrida congela;
// online ela segue para os outros, então o aviso diz que o carro continua na pista.

const PANEL = { x: 150, y: 82, width: 340, height: 196 };
const BUTTON = { x: 230, width: 180, height: 28, firstY: 126, gap: 38 };
const ROW_HEIGHT = BUTTON.gap;
const entriesFor = offline => [
  { id: 'resume', label: 'CONTINUAR' },
  ...(offline ? [{ id: 'restart', label: 'REINICIAR (R)' }] : []),
  { id: 'menu', label: 'MENU PRINCIPAL' },
  { id: 'quit', label: 'SAIR DO JOGO' },
].map((entry, i) => ({ ...entry, x: BUTTON.x, y: BUTTON.firstY + i * BUTTON.gap, width: BUTTON.width, height: BUTTON.height }));

const ENTRY_STYLE = { resume: 'primary', quit: 'danger' };
const centered = (ctx, text, y, color, scale = 1) => ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, scale) / 2), y, color, scale);

export function createPauseMenu({ stage, isOnline, onResume, onRestart, onMainMenu, onQuit }) {
  const screen = { isOpen: false };
  let pointer = { x: -1, y: -1 }, quitting = false;
  const entries = () => entriesFor(!isOnline());
  const panel = () => ({ ...PANEL, height: PANEL.height + (isOnline() ? 0 : ROW_HEIGHT) });

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
    const entry = entries().find(candidate => inside(candidate, x, y));
    if (entry?.id === 'resume') screen.resume();
    if (entry?.id === 'restart') restart();
    if (entry?.id === 'menu') onMainMenu();
    if (entry?.id === 'quit') { quitting = true; onQuit(); }
  });

  // Offline a corrida recomeça do zero com a mesma largada; online ela não pode ser refeita sozinho.
  function restart() {
    if (isOnline()) return;
    screen.isOpen = false;
    onRestart();
    onResume();
  }
  addEventListener('keydown', e => { if (screen.isOpen && !quitting && e.code === 'KeyR' && !e.repeat) restart(); });

  screen.draw = ctx => {
    ctx.fillStyle = 'rgba(24, 10, 5, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const box = panel();
    panelBox(ctx, box);
    drawHeading(ctx, quitting ? 'ATE MAIS!' : 'PAUSA', VIEW.width / 2, PANEL.y + 16);
    if (quitting) {
      centered(ctx, 'PODE FECHAR A ABA DO NAVEGADOR.', PANEL.y + 60, COLOR.text);
      return;
    }
    for (const entry of entries()) drawButton(ctx, entry, entry.label, inside(entry, pointer.x, pointer.y), ENTRY_STYLE[entry.id]);
    const note = isOnline() ? 'ONLINE A CORRIDA NAO PARA: SEU CARRO FICA SEM PILOTO.' : 'SAIR ABANDONA A CORRIDA. ESC CONTINUA.';
    centered(ctx, note, box.y + box.height - 16, COLOR.muted);
  };
  return screen;
}
