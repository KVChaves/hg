import { ctxText, textWidth } from '../art/font.js';

// Lista de abates no canto da tela: "ZECA DESTRUIU EMA". Vale para qualquer carro destruído que este navegador
// fica sabendo (os simulados aqui e os avisos que chegam pela rede). O jogador aparece como VOCE.

const SHOWN_FOR = 5, MAX_LINES = 4, SAME_VICTIM_GAP = 1.5;   // segundos; o mesmo abate pode chegar por dois caminhos
const X = 8, Y = 62, LINE = 11;
const COLOR = { name: '#ffe9a0', you: '#6fe070', verb: '#e8d8c0' };

const nameOf = racer => (racer.isPlayer ? 'VOCE' : String(racer.name).toUpperCase());

export function createKillFeed() {
  const lines = [];
  let clock = 0;

  return {
    // `killer` nulo: destruído sem autor (batida no muro, por exemplo); não entra na lista.
    add(victim, killer) {
      if (!victim || !killer || victim === killer) return;
      if (lines.some(line => line.victim === victim && clock - line.at < SAME_VICTIM_GAP)) return;
      lines.push({ victim, killer, at: clock });
      if (lines.length > MAX_LINES) lines.shift();
    },
    update(dt) {
      clock += dt;
      while (lines.length && clock - lines[0].at > SHOWN_FOR) lines.shift();
    },
    reset() { lines.length = 0; },
    draw(ctx) {
      lines.forEach(({ victim, killer }, i) => {
        const y = Y + i * LINE, parts = [[nameOf(killer), killer.isPlayer ? COLOR.you : COLOR.name], [' DESTRUIU ', COLOR.verb], [nameOf(victim), victim.isPlayer ? COLOR.you : COLOR.name]];
        let x = X;
        for (const [text, color] of parts) {
          ctxText(ctx, text, x + 1, y + 1, '#000000');
          ctxText(ctx, text, x, y, color);
          x += textWidth(text);
        }
      });
    },
  };
}
