// O que o jogador faz de bonito vira mensagem na pilha (featFeed): drift e tempo no ar ao vivo, ultrapassagens
// e abates, que ganham uma segunda linha quando acontecem numa situação especial (às cegas, no ar, por um fio...).

const COLOR = { kill: '#ff5a3a', special: '#ffb030', air: '#c890ff', pass: '#6fe070', blind: '#f0e890', trap: '#ffd070' };
const DRIFT_GRADES = [[3, 'DRIFT INSANO', '#ff7040'], [1.6, 'GRANDE DRIFT', '#ffe060'], [0, 'DRIFT', '#80e0ff']];
const DRIFT_SHOWN_FROM = 0.4, AIR_SHOWN_FROM = 0.25, AIR_COUNTS_FROM = 0.4, HOP_STREAK_GAP = 2;   // segundos
const KILL_TEXT = { ram: 'NA PANCADA!', fire: 'ASSADO!', splash: 'PELOS ARES!' };
const MULTI_KILL = ['', '', 'ABATE DUPLO!', 'ABATE TRIPLO!', 'MASSACRE!'], MULTI_WINDOW = 4;
const LONG_SHOT = 110, LOW_HEALTH = 0.15;

const driftGrade = seconds => DRIFT_GRADES.find(([minimum]) => seconds >= minimum);

export function createFeats({ featFeed, race, car, driftTracker }) {
  let airTime = 0, hopStreak = 0, sinceLanding = Infinity, lastRank = null, lastKiller = null, clock = 0;
  const recentKills = [];

  const isBlinded = () => car.effects.paint > 0 || car.effects.smoke > 0;
  // No ar de verdade (rampa, lombada, beirada): o tempo todo sem tocar o chão, não só o trecho sobre o vão.
  const isAirborne = () => race.started && car.wrecked <= 0 && car.airborne && car.sunk <= 0;
  const special = text => featFeed.announce(text, { color: COLOR.special, big: true });

  function land(seconds) {
    hopStreak = sinceLanding < HOP_STREAK_GAP ? hopStreak + 1 : 1;
    sinceLanding = 0;
    const title = seconds >= 1.4 ? 'VOO LONGO' : 'AIR TIME';
    featFeed.finish('air', `${title} ${seconds.toFixed(1)}s${hopStreak > 1 ? ` x${hopStreak}` : ''}`, { color: COLOR.air, big: seconds >= 1.4 || hopStreak > 1 });
  }

  // Chamar depois de featFeed.update, a cada quadro.
  function update(dt) {
    clock += dt;
    sinceLanding += dt;
    const drift = driftTracker.current;
    if (drift >= DRIFT_SHOWN_FROM) featFeed.live('drift', `DRIFT ${drift.toFixed(1)}s`, driftGrade(drift)[2]);

    if (isAirborne()) {
      airTime += dt;
      if (airTime >= AIR_SHOWN_FROM) featFeed.live('air', `NO AR ${airTime.toFixed(1)}s`, COLOR.air);
    } else if (airTime > 0) {
      if (airTime >= AIR_COUNTS_FROM && car.wrecked <= 0 && car.sunk <= 0) land(airTime);   // quem caiu não pousou
      airTime = 0;
    }

    const racing = race.started && !race.finished && car.wrecked <= 0;
    if (racing && lastRank !== null && race.rank < lastRank) featFeed.announce('ULTRAPASSOU', { key: 'pass', color: COLOR.pass });
    lastRank = racing ? race.rank : null;
  }

  return {
    update,
    drift(seconds) {
      const [, title, color] = driftGrade(seconds);
      featFeed.finish('drift', `${title} ${seconds.toFixed(1)}s`, { color, big: seconds >= 3 });
    },
    // `cause`: 'shot', 'splash' (granada), 'ram' (pancada de carro), 'fire' (queimado); vazio quando veio pela rede.
    kill(victim, cause) {
      const text = KILL_TEXT[cause] ?? 'DESTRUIDO';
      featFeed.announce(text, { key: `kill:${text}`, color: COLOR.kill, big: true });
      while (recentKills.length && clock - recentKills[0] > MULTI_WINDOW) recentKills.shift();
      recentKills.push(clock);
      if (recentKills.length >= 2) featFeed.announce(MULTI_KILL[Math.min(recentKills.length, MULTI_KILL.length - 1)], { key: 'multi', color: COLOR.special, big: true });
      if (isBlinded()) special('ABATE AS CEGAS');
      if (isAirborne()) special('ABATE NO AR');
      if (car.wrecked > 0) special('DO ALEM');
      else if (car.health < LOW_HEALTH) special('POR UM FIO');
      if (victim && victim === lastKiller) { special('VINGANCA!'); lastKiller = null; }
      if (cause === 'shot' && victim) {
        const distance = Math.hypot(victim.x - car.x, victim.z - car.z);
        if (distance >= LONG_SHOT) special(`DE LONGE ${Math.round(distance)}M`);
      }
    },
    hit() {
      if (isBlinded()) featFeed.announce('TIRO AS CEGAS', { key: 'blindhit', color: COLOR.blind });
      else if (isAirborne()) featFeed.announce('TIRO NO AR', { key: 'airhit', color: COLOR.air });
    },
    trapCaught(text) { featFeed.announce(text, { color: COLOR.trap }); },
    playerDestroyed(killer) { lastKiller = killer ?? null; },
    reset() {
      airTime = hopStreak = 0;
      sinceLanding = Infinity;
      lastRank = lastKiller = null;
      recentKills.length = 0;
    },
  };
}
