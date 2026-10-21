// ============================================================
//  HEROES OF MAGIC: данные мира (юниты, враги, бои, карты, сюжет).
//  Всё, что можно захотеть поправить (тексты, цифры баланса, расклад карт), лежит здесь.
//  Работает в браузере (window.HData) и в Node (симуляция баланса).
// ============================================================
(function (root) {
  "use strict";
  var D = {};
  var U = "assets/heroes/units/";

  // ---------- Союзники (базовые характеристики, уровень 0) ----------
  // idle/atk/sp: имена файлов спрайтов в assets/heroes/units (без .webp)
  D.ALLY = {
    kasi:   { id: "kasi",   name: "Кася",     hp: 100, atk: 15, def: 2, spd: 10, idle: "kasi_idle", atkf: ["kasi_atk1", "kasi_atk3"], spf: "kasi_atk2",
              sp: { name: "Лучевой удар", kind: "aoe", mult: 0.75, cd: 3 }, desc: "Бьёт всех врагов лучом" },
    van:    { id: "van",    name: "Ван",      hp: 90,  atk: 16, def: 1, spd: 11, idle: "van_idle", atkf: ["van_atk1", "van_atk3"], spf: "van_atk2",
              sp: { name: "Рывок", kind: "single", mult: 1.8, cd: 3, stun: 1 }, desc: "Мощный удар и оглушение" },
    saler:  { id: "saler",  name: "Торговец", hp: 85,  atk: 9,  def: 1, spd: 8,  idle: "saler_idle", atkf: ["saler_atk"], spf: "saler_atk",
              sp: { name: "Скидочка", kind: "heal", heal: 0.35, cd: 2 }, desc: "Лечит самого побитого" },
    miha:   { id: "miha",   name: "Миха",     hp: 140, atk: 17, def: 3, spd: 6,  idle: "miha_idle", atkf: ["miha_atk"], spf: "miha_atk",
              sp: { name: "Медвежий удар", kind: "single", mult: 2.3, cd: 3 }, desc: "Страшный удар по одному" },
    denchik:{ id: "denchik",name: "Денчик",   hp: 85,  atk: 14, def: 1, spd: 9,  idle: "denchik_idle", atkf: ["denchik_atk"], spf: "denchik_atk",
              sp: { name: "Червячный залп", kind: "multi", hits: 3, mult: 0.8, cd: 3 }, desc: "Три выстрела по случайным" }
  };

  // Уровень прокачки: Миха и Ван: 0..3 побед в мини-играх. Денчик: очки силы (-3..+3). Кася: баффы с карты.
  D.levels = function (st) {
    st = st || {};
    var mini = st.mini || {}, cups = (mini.cups && mini.cups.got) || {};
    var p = (cups.bottle || 0) - 2 * (cups.crystal || 0);
    return {
      miha: Math.max(0, Math.min(3, (mini.arm && mini.arm.wins) || 0)),
      van: Math.max(0, Math.min(3, (mini.kompy && mini.kompy.wins) || 0)),
      denchik: Math.max(-3, Math.min(3, p)),
      buffs: st.buffs || { atk: 0, def: 0, hp: 0, luck: 0, spd: 0 }
    };
  };

  // Готовый юнит-определение с учётом прокачки
  D.allyDef = function (id, st) {
    var b = D.ALLY[id], L = D.levels(st), hpM = 1, atkM = 1, def = b.def, spd = b.spd, crit = 0.08, extra = 0;
    if (id === "miha" || id === "van") { var l = L[id]; atkM = 1 + 0.20 * l; hpM = 1 + 0.25 * l; }
    if (id === "denchik") { atkM = hpM = 1 + 0.15 * L.denchik; extra = (st && st.extraMoves) || 0; }
    if (id === "kasi") {
      var bf = L.buffs;
      atkM = 1 + 0.06 * bf.atk; hpM = 1 + 0.07 * bf.hp; def += bf.def; spd += bf.spd; crit += 0.04 * bf.luck;
    }
    return { id: id, name: b.name, side: "A", hp: Math.round(b.hp * hpM), atk: b.atk * atkM, def: def, spd: spd, crit: crit,
             sp: b.sp, extra: extra, idle: b.idle, atkf: b.atkf, spf: b.spf };
  };

  // ---------- Враги ----------
  D.FOE = {
    nightmare: { name: "Кошмар",           hp: 540, atk: 26.0, def: 1, spd: 9,  idle: "nightmare_idle", atkf: ["nightmare_atk"], spf: "nightmare_atk", size: 1.35,
                 sp: { name: "Проклятие", kind: "aoe", mult: 0.5, cd: 4 } },
    swamp:     { name: "Болотный сквозняк", hp: 590, atk: 25.0, def: 2, spd: 8,  idle: "swamp_idle", atkf: ["swamp_atk"], spf: "swamp_atk", size: 1.4,
                 sp: { name: "Сквозняк", kind: "aoe", mult: 0.55, cd: 3 } },
    gar1:      { name: "Гарбодюры",        hp: 200, atk: 16.5, def: 1, spd: 10, idle: "gar1_idle", atkf: ["gar1_atk"], spf: "gar1_atk", size: 1.1,
                 sp: { name: "Тройной пинок", kind: "single", mult: 1.6, cd: 4 } },
    gar2:      { name: "Гарбодюры",        hp: 200, atk: 18.0, def: 1, spd: 11, idle: "gar2_idle", atkf: ["gar2_atk"], spf: "gar2_atk", size: 1.1,
                 sp: { name: "Тройной пинок", kind: "single", mult: 1.6, cd: 4 } },
    bodyguard: { name: "Охранник",         hp: 235, atk: 20.5, def: 3, spd: 8,  idle: "bodyguard_idle", atkf: ["bodyguard_atk"], spf: "bodyguard_atk", size: 1.05,
                 sp: { name: "Прямой", kind: "single", mult: 1.7, cd: 4 } },
    krugpug:   { name: "Михаил Круг-Пук",  hp: 505, atk: 27.5, def: 3, spd: 8,  idle: "krugpug_idle", atkf: ["krugpug_atk"], spf: "krugpug_atk", size: 1.35,
                 sp: { name: "Гитарное соло", kind: "aoe", mult: 0.6, cd: 3 } },
    smoker:    { name: "Гусеница Дымка",   hp: 755, atk: 32.0, def: 2, spd: 8,  idle: "smoker_idle", atkf: ["smoker_atk"], spf: "smoker_atk", size: 1.35,
                 sp: { name: "Дымовая завеса", kind: "aoe", mult: 0.6, cd: 3 } },
    smokerkid: { name: "Дымкина братва",   hp: 450, atk: 27.0, def: 1, spd: 12, idle: "smokerkid_idle", atkf: ["smokerkid_atk"], spf: "smokerkid_atk", size: 1.1,
                 sp: { name: "Самокатный наезд", kind: "single", mult: 1.7, cd: 4 } },
    barinov:   { name: "Крип Баринов",     hp: 660, atk: 28.5, def: 4, spd: 10, idle: "barinov_idle", atkf: ["barinov_atk"], spf: "barinov_atk", size: 1.4,
                 sp: { name: "Скейт-вертушка", kind: "aoe", mult: 0.75, cd: 3 } },
    alk1:      { name: "Алконавт Толян",   hp: 330, atk: 19.0, def: 1, spd: 7,  idle: "alk1_idle", atkf: ["alk1_atk"], spf: "alk1_atk", size: 1.1,
                 sp: { name: "Бутылкой по башке", kind: "single", mult: 1.8, cd: 4 } },
    alk2:      { name: "Алконавт Серёга",  hp: 330, atk: 20.0, def: 1, spd: 8,  idle: "alk2_idle", atkf: ["alk2_atk"], spf: "alk2_atk", size: 1.1,
                 sp: { name: "Бутылкой по башке", kind: "single", mult: 1.8, cd: 4 } }
  };

  // ---------- Бои ----------
  // party: кто участвует (союзники берутся из состава партии); ease: цена облегчения (монеты) за уровни 1..3
  D.ENC = {
    nightmare: { name: "Кошмар",           foes: ["nightmare"],                      ease: [4, 7, 11],  video: "undead" },
    swamp:     { name: "Болотный сквозняк", foes: ["swamp"],                          ease: [5, 8, 12] },
    garb:      { name: "Гарбодюры",        foes: ["gar1", "gar2"],                    ease: [6, 10, 14] },
    krug:      { name: "Круг-Пук с охраной",foes: ["bodyguard", "krugpug", "bodyguard"], ease: [8, 12, 16], optional: true },
    dymka:     { name: "Гусеница Дымка",   foes: ["smokerkid", "smoker"],             ease: [8, 12, 17] },
    barinov:   { name: "Баринов с алконавтами", foes: ["alk1", "barinov", "alk2"],    ease: [10, 15, 20], mirror: 0.25 }
  };

  // Собрать бой: возвращает { A:[units], E:[units] } с учётом облегчения и состояния
  D.buildBattle = function (encId, partyIds, st, easeLvl, weak) {
    var enc = D.ENC[encId];
    var ease = Math.max(0, Math.min(5, easeLvl || 0));
    var A = partyIds.map(function (id) { return root.HCore.unit(D.allyDef(id, st)); });
    var E = enc.foes.map(function (fid, i) {
      var f = D.FOE[fid];
      return root.HCore.unit({
        id: fid + "_" + i, fid: fid, name: f.name, side: "E",
        hp: Math.round(f.hp * (1 - 0.10 * ease) * (weak ? 0.85 : 1)), atk: f.atk * (1 - 0.07 * ease) * (weak ? 0.92 : 1), def: f.def, spd: f.spd,
        sp: f.sp, idle: f.idle, atkf: f.atkf, spf: f.spf, size: f.size
      });
    });
    return { A: A, E: E, opts: { mirror: (enc.mirror && st && st.mirror) ? enc.mirror : 0 } };
  };

  root.HData = D;
  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof window !== "undefined" ? window : globalThis);
