// Estatísticas de combate do jogador numa corrida online: cada navegador conta as do próprio piloto e manda ao
// servidor no fim (aba ESTATÍSTICAS > COMBATE). A liderança não entra aqui: quem mede é o admin (onlineMatch).

export const KILL_CAUSES = ['shot', 'ram', 'fire', 'splash'];   // o resto conta como 'other'

export function createCombatStats({ weapon, car }) {
  let stats, streak, baseShots, baseLanded, lastDestroyed, placed, scored;

  function reset() {
    stats = { killStreak: 0, kills: 0, backKills: 0, deaths: 0, victims: {}, killers: {}, causes: {}, trapsPlaced: 0, trapsScored: 0, caught: 0 };
    streak = 0;                                      // abates seguidos sem morrer
    baseShots = weapon.shots;
    baseLanded = weapon.landed;
    lastDestroyed = car.destroyed;
    placed = new Set();                              // armadilhas que o jogador soltou nesta corrida
    scored = new Set();                              // dessas, as que já pegaram alguém
  }
  reset();

  const add = (table, key) => { table[key] = (table[key] ?? 0) + 1; };

  return {
    reset,
    // Toda destruição do carro conta como morte, até as sem autor (queda, obstáculo, raio).
    update() {
      if (car.destroyed > lastDestroyed) { stats.deaths += car.destroyed - lastDestroyed; streak = 0; }
      lastDestroyed = car.destroyed;
    },
    // `behind`: a vítima estava atrás do jogador (na pista) quando foi abatida.
    kill(victim, cause, behind = false) {
      stats.kills++;
      stats.killStreak = Math.max(stats.killStreak, ++streak);
      if (behind) stats.backKills++;
      if (victim?.name) add(stats.victims, victim.name);
      add(stats.causes, KILL_CAUSES.includes(cause) ? cause : 'other');
    },
    killedBy(killer) {
      if (killer?.name && !killer.isPlayer) add(stats.killers, killer.name);
    },
    trapPlaced(id) {
      stats.trapsPlaced++;
      placed.add(id);
    },
    // Uma armadilha do jogador pegou alguém: conta uma vez por armadilha, por mais carros que ela pegue.
    trapScored(id) {
      if (!placed.has(id) || scored.has(id)) return;
      scored.add(id);
      stats.trapsScored++;
    },
    caughtInTrap() { stats.caught++; },
    snapshot: () => ({ ...stats, weapon: weapon.type.id, shots: Math.max(0, weapon.shots - baseShots), hits: Math.max(0, weapon.landed - baseLanded) }),
  };
}
