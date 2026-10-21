// ============================================================
//  HEROES OF MAGIC: чистая боевая логика (без DOM).
//  Работает и в браузере (window.HCore), и в Node (баланс-симуляция).
//  Бой пошаговый: очередь по скорости, каждый юнит действует сам:
//    attack / special (перезарядка cd) / defend (половина урона до следующего хода).
//  Все функции возвращают список событий для анимации UI.
// ============================================================
(function (root) {
  "use strict";
  var Core = {};
  var rng = Math.random;
  Core.setRng = function (f) { rng = f || Math.random; };

  function R(a, b) { return a + rng() * (b - a); }

  // ---------- Юниты ----------
  // d: { id, name, side:'A'|'E', hp, atk, def, spd, sp:{name,kind,mult,cd,...}, sprite, ... }
  Core.unit = function (d) {
    var u = {};
    for (var k in d) u[k] = d[k];
    u.maxhp = u.hp; u.cd = 0; u.guard = false; u.stun = 0; u.dead = false;
    u.crit = d.crit == null ? 0.08 : d.crit;
    u.extra = d.extra || 0;          // дополнительные ходы в 1-м раунде
    u.sp = d.sp ? { name: d.sp.name, kind: d.sp.kind, mult: d.sp.mult || 1, cd: d.sp.cd || 3, hits: d.sp.hits || 1, stun: d.sp.stun || 0, heal: d.sp.heal || 0 } : null;
    u.cd = u.sp ? Math.min(1, u.sp.cd) : 0;   // первый спец доступен со 2-го хода
    return u;
  };

  Core.newBattle = function (allies, enemies, opts) {
    var b = { A: allies, E: enemies, round: 0, queue: [], cur: null, over: false, winner: null,
              opts: opts || {}, turns: 0 };
    return b;
  };

  function living(list) { return list.filter(function (u) { return !u.dead; }); }
  Core.living = living;

  function sideOf(b, u) { return u.side === "A" ? b.A : b.E; }
  function foesOf(b, u) { return u.side === "A" ? b.E : b.A; }

  function buildQueue(b) {
    b.round++;
    var all = living(b.A).concat(living(b.E));
    all.forEach(function (u) { u._k = u.spd + rng() * 0.9; });
    all.sort(function (x, y) { return y._k - x._k; });
    b.queue = all.slice();
    if (b.round === 1) {
      all.forEach(function (u) { for (var i = 0; i < u.extra; i++) b.queue.push(u); });
    }
  }

  function check(b) {
    if (!living(b.E).length) { b.over = true; b.winner = "A"; }
    else if (!living(b.A).length) { b.over = true; b.winner = "E"; }
    return b.over;
  }

  // Следующий ходящий. Возвращает { unit, events } (unit=null, если бой окончен)
  Core.next = function (b) {
    var ev = [];
    if (check(b)) return { unit: null, events: ev };
    for (var guard = 0; guard < 200; guard++) {
      if (!b.queue.length) { buildQueue(b); ev.push({ t: "round", n: b.round }); }
      var u = b.queue.shift();
      if (u.dead) continue;
      if (u.stun > 0) { u.stun--; ev.push({ t: "stunned", id: u.id }); continue; }
      u.guard = false;
      b.cur = u; b.turns++;
      return { unit: u, events: ev };
    }
    return { unit: null, events: ev };
  };

  // ---------- Урон ----------
  function calcDmg(b, att, def, mult, evs, flags) {
    var raw = att.atk * mult * R(0.9, 1.1);
    var crit = rng() < att.crit;
    if (crit) raw *= 1.6;
    var dmg = raw * 14 / (14 + def.def);
    if (def.guard) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    var e = { t: "hit", from: att.id, to: def.id, dmg: dmg, crit: crit, aoe: !!(flags && flags.aoe) };
    evs.push(e);
    if (def.hp <= 0) { def.dead = true; evs.push({ t: "dead", id: def.id }); }
    // Зеркало: часть урона по союзникам отражается
    if (def.side === "A" && b.opts.mirror && !att.dead && att.side === "E") {
      var back = Math.max(1, Math.round(dmg * b.opts.mirror));
      att.hp = Math.max(0, att.hp - back);
      evs.push({ t: "reflect", from: def.id, to: att.id, dmg: back });
      if (att.hp <= 0) { att.dead = true; evs.push({ t: "dead", id: att.id }); }
    }
    return dmg;
  }

  Core.targetsFor = function (b, u, type) {
    if (type === "special" && u.sp && u.sp.kind === "heal") return living(sideOf(b, u));
    return living(foesOf(b, u));
  };

  // action: { type:'attack'|'special'|'defend', target:unit }
  Core.act = function (b, u, a) {
    var evs = [], foes = living(foesOf(b, u)), t;
    if (u.dead || !foes.length) return evs;
    if (a.type === "defend") {
      u.guard = true;
      if (u.cd > 0) u.cd--;
      evs.push({ t: "guard", id: u.id });
    } else if (a.type === "special" && u.sp && u.cd <= 0) {
      var sp = u.sp;
      evs.push({ t: "special", id: u.id, name: sp.name, kind: sp.kind });
      if (sp.kind === "aoe") {
        foes.forEach(function (f) { if (!f.dead) calcDmg(b, u, f, sp.mult, evs, { aoe: true }); });
      } else if (sp.kind === "single") {
        t = (a.target && !a.target.dead) ? a.target : foes[0];
        calcDmg(b, u, t, sp.mult, evs);
        if (sp.stun && !t.dead) { t.stun = Math.max(t.stun, sp.stun); evs.push({ t: "stun", id: t.id }); }
      } else if (sp.kind === "multi") {
        for (var i = 0; i < sp.hits; i++) {
          var fl = living(foesOf(b, u));
          if (!fl.length) break;
          calcDmg(b, u, fl[Math.floor(rng() * fl.length)], sp.mult, evs);
        }
      } else if (sp.kind === "heal") {
        var allies = living(sideOf(b, u));
        var w = allies.reduce(function (m, x) { return (x.hp / x.maxhp < m.hp / m.maxhp) ? x : m; }, allies[0]);
        var amt = Math.round(w.maxhp * sp.heal + u.atk * 0.5);
        var real = Math.min(amt, w.maxhp - w.hp);
        w.hp += real;
        evs.push({ t: "heal", from: u.id, to: w.id, amount: real });
      }
      u.cd = sp.cd;
    } else {
      t = (a.target && !a.target.dead) ? a.target : foes[0];
      calcDmg(b, u, t, 1, evs);
      if (u.cd > 0) u.cd--;
    }
    check(b);
    return evs;
  };

  // Простой ИИ для врагов (и для политики симуляции)
  Core.aiAction = function (b, u) {
    var foes = living(foesOf(b, u));
    var weak = foes.slice().sort(function (x, y) { return x.hp - y.hp; });
    var pick = rng() < 0.55 ? foes[Math.floor(rng() * foes.length)] : weak[0];
    if (u.sp && u.cd <= 0) {
      if (u.sp.kind === "heal") {
        var al = living(sideOf(b, u));
        if (al.some(function (x) { return x.hp / x.maxhp < 0.6; })) return { type: "special" };
      } else if (rng() < 0.75) return { type: "special", target: pick };
    }
    return { type: "attack", target: pick };
  };

  // Политика «разумного игрока» для проверки баланса
  Core.playerPolicy = function (b, u) {
    var foes = living(b.E);
    var focus = foes.slice().sort(function (x, y) { return x.hp - y.hp; })[0];
    var strong = foes.slice().sort(function (x, y) { return y.atk - x.atk; })[0];
    if (u.sp && u.cd <= 0) {
      if (u.sp.kind === "heal") {
        var al = living(b.A);
        if (al.some(function (x) { return x.hp / x.maxhp < 0.65; })) return { type: "special" };
      } else if (u.sp.kind === "single") return { type: "special", target: u.sp.stun ? strong : focus };
      else return { type: "special" };
    }
    if (u.hp / u.maxhp < 0.25 && rng() < 0.35) return { type: "defend" };
    return { type: "attack", target: focus };
  };

  // Полный автобой (для симуляции)
  Core.simulate = function (b, maxTurns) {
    maxTurns = maxTurns || 400;
    var n = 0;
    while (!b.over && n++ < maxTurns) {
      var r = Core.next(b);
      if (!r.unit) break;
      var u = r.unit;
      var a = u.side === "A" ? Core.playerPolicy(b, u) : Core.aiAction(b, u);
      Core.act(b, u, a);
    }
    return b.winner;
  };

  root.HCore = Core;
  if (typeof module !== "undefined" && module.exports) module.exports = Core;
})(typeof window !== "undefined" ? window : globalThis);
