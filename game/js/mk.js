// ============================================================
//  МИР «MORTAL KOMBAT»: дуэль Каси против Вана на 5 аренах.
//  Управление: слева стрелки (двигаться), справа: Рука, Нога, Блок (держать), Супер (когда шкала полна).
//  Ноги Каси бьют дальше, а у Вана руки быстрее. Арт: assets/mk, звук: assets/audio/mk_*.
// ============================================================
(function () {
  "use strict";

  var ARENAS = [
    { name: "Огород", note: "Разогрев. Ван разминается.", floor: 0.79 },
    { name: "Гуща ебанная", note: "Деревья смотрят. Не опозорься.", floor: 0.79 },
    { name: "Мост над бездной", note: "Один неверный шаг, и ты неверный шаг.", floor: 0.575 },
    { name: "Пацаны и розы", note: "Иван выучил спецприём. Поберегись!", floor: 0.8 },
    { name: "Тронный зал", note: "Последний бой. Просто так Иван не сдастся.", floor: 0.8 }
  ];
  // сложность Вана по уровням
  var LV = [
    { hp: 100, aggr: 0.50, block: 0.15, dmg: 0.80, think: 0.40, sp: false },
    { hp: 120, aggr: 0.60, block: 0.25, dmg: 0.90, think: 0.33, sp: false },
    { hp: 140, aggr: 0.70, block: 0.35, dmg: 1.00, think: 0.27, sp: true },
    { hp: 170, aggr: 0.80, block: 0.45, dmg: 1.15, think: 0.21, sp: true },
    { hp: 200, aggr: 0.90, block: 0.55, dmg: 1.30, think: 0.17, sp: true }
  ];
  // атаки (дальность в долях роста бойца)
  var ATK = {
    punch: { su: 0.07, ac: 0.09, rc: 0.17, dmg: 5,  reach: 0.64, meter: 10, kb: 24, stop: 0.05, fx: "small" },
    kick:  { su: 0.15, ac: 0.10, rc: 0.26, dmg: 8,  reach: 0.80, meter: 14, kb: 48, stop: 0.09, fx: "big" }
  };

  var SPR = null, SPR_META = null, loading = null;
  var NAMES = ["kasi_idle", "kasi_punch", "kasi_kick", "kasi_block", "kasi_hit", "kasi_ko", "kasi_win",
    "van_idle", "van_punch", "van_kickL", "van_kickR", "van_block", "van_hit", "van_ko", "van_win",
    "text_fight", "text_ko", "text_win", "hit_small", "hit_big", "block_spark", "ko_burst", "special_ball",
    "kasi_special", "van_special", "arena_1", "arena_2", "arena_3", "arena_4", "arena_5"];
  function loadAll() {
    if (SPR) return Promise.resolve();
    if (loading) return loading;
    var out = {};
    var imgsP = Promise.all(NAMES.map(function (n) {
      return new Promise(function (res) {
        var im = new Image(); im.onload = im.onerror = function () { out[n] = im; res(); };
        im.src = "assets/mk/" + n + ".webp";
      });
    }));
    var metaP = fetch("assets/mk/sprites.json").then(function (r) { return r.json(); }).catch(function () { return {}; });
    loading = Promise.all([imgsP, metaP]).then(function (r) { SPR = out; SPR_META = r[1]; });
    return loading;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOutBack(t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

  function play(container, api) {
    var AUD = window.AUDIO || { sfx: function () {}, setTheme: function () {} };
    var lvlIdx = 0;
    try { lvlIdx = clamp(parseInt(localStorage.getItem("kate_mk_lvl") || "0", 10) || 0, 0, ARENAS.length - 1); } catch (e) {}
    var SHOT_VOL = 0.5, VOICE_VOL = 0.55, TRACK_VOL = 0.30;
    var alive = true, trackOn = false;

    container.innerHTML = '<div class="center muted">Загрузка…</div>';
    if (AUD.preload) {
      AUD.preload("mk_kasi_hit", "assets/audio/mk_kasi_hit.mp3");
      AUD.preload("mk_van_hit", "assets/audio/mk_van_hit.mp3");
      AUD.preload("mk_kasi_ko", "assets/audio/mk_kasi_ko.mp3");
      AUD.preload("mk_kasi_win", "assets/audio/mk_kasi_win.mp3");
      AUD.preload("mk_van_ko", "assets/audio/mk_van_final-ko.mp3");
    }
    function startTrack() {
      if (trackOn) return; trackOn = true;
      if (AUD.trackStart) AUD.trackStart("mk_track", "assets/audio/mk_soundtrack.mp3", TRACK_VOL);
    }
    function stopTrack() { if (!trackOn) return; trackOn = false; if (AUD.trackStop) AUD.trackStop(); }
    function voice(name, vol, rate) { if (AUD.playSample) AUD.playSample(name, vol == null ? VOICE_VOL : vol, rate || 1); }

    var token = {}, stopFn = null, shown = false;
    container.__mk = token;
    var watcher = setInterval(function () {
      if (container.__mk !== token || (shown && !container.children.length)) {
        clearInterval(watcher);
        if (alive) { alive = false; if (stopFn) stopFn(); }
        if (container.__mk === token) stopTrack();
      }
    }, 300);

    loadAll().then(function () {
      if (!alive || container.__mk !== token) return;
      shown = true;
      preDialog();
    });

    // ---------- Диалоги ----------
    function dialog(lines, onLast, done) {
      container.innerHTML =
        '<div class="dialog-stage tk-dialog">' +
        '<div class="avatar big" id="mk-av"></div>' +
        '<div class="dialog-box"><div class="speaker" id="mk-sp"></div><div class="text" id="mk-tx"></div>' +
        '<button class="btn" id="mk-nx">Далее</button></div></div>';
      window.APP.runDialog(lines, {
        speaker: container.querySelector("#mk-sp"), text: container.querySelector("#mk-tx"),
        avatar: container.querySelector("#mk-av"), next: container.querySelector("#mk-nx"), onLast: onLast
      }, done);
    }
    function preDialog() {
      dialog([
        { who: "Ван", avatar: "van:sad", text: "А помнишь, как мы дрались? Ты всегда побеждала из-за длинных ног, и в итоге я без компа был." },
        { who: "Кася", avatar: "kasi:laugh", text: "Пхаха, помню!" },
        { who: "Ван", avatar: "van:laugh", text: "Зато в Mortal Kombat я всегда выигрывал. Щас проверим!" },
        { who: "Кася", avatar: "kasi:happy", text: "Да не пизди. Только не плачь, когда проиграешь!" }
      ], startTrack, buildGame);
    }
    function endDialog() {
      dialog([
        { who: "Ван", avatar: "van:surprise", text: "Ну ебать, так нечестно." },
        { who: "Кася", avatar: "kasi:laugh", text: "Я же говорила. Малютка ты." },
        { who: "Ван", avatar: "van:happy", text: "Ладно ладно.. Погнали отсюда!" }
      ], null, function () {
        try { localStorage.setItem("kate_mk_lvl", "0"); } catch (e) {}
        stopTrack(); api.complete();
      });
    }

    // ---------- Игра ----------
    function buildGame() {
      var ICO = {
        fist: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M12 22v-6a3 3 0 0 1 6 0v-3a3 3 0 0 1 6 0v-1a3 3 0 0 1 6 0v2a3 3 0 0 1 6 0v14c0 7-5 11-11 11-7 0-13-4-13-11z"/></svg>',
        boot: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M16 8h10v14l12 5c3 1 4 3 4 6v3H12V8z"/><path d="M12 34h30"/></svg>',
        shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M24 6l14 5v11c0 9-6 16-14 20C16 38 10 31 10 22V11z"/></svg>',
        star: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4c1 10 4 17 20 20-16 3-19 10-20 20-1-10-4-17-20-20 16-3 19-10 20-20z"/></svg>',
        left: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M30 10L16 24l14 14"/></svg>',
        right: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10l14 14-14 14"/></svg>'
      };
      container.innerHTML =
        '<div class="mk">' +
        '<div class="mk-field" id="mk-field"><canvas id="mk-cv"></canvas>' +
        '<div class="mk-hud">' +
        '<div class="mk-side"><img src="assets/avatars/emo/kasi_happy.webp" alt=""><div class="mk-bars"><div class="mk-name">Кася</div><div class="mk-bar"><i id="mk-hp-k"></i></div><div class="mk-meter"><i id="mk-mt-k"></i></div></div></div>' +
        '<div class="mk-lv" id="mk-lv"></div>' +
        '<div class="mk-side r"><div class="mk-bars"><div class="mk-name">Ван</div><div class="mk-bar"><i id="mk-hp-v"></i></div></div><img src="assets/avatars/emo/van_laugh.webp" alt=""></div>' +
        '</div><div class="tk-ov" id="mk-ov"></div></div>' +
        '<div class="mk-controls">' +
        '<div class="mk-move" id="mk-move"><div class="mk-arrow" id="mk-al">' + ICO.left + '</div><div class="mk-arrow" id="mk-ar">' + ICO.right + '</div></div>' +
        '<div class="mk-acts">' +
        '<button class="mk-btn sp" id="mk-sp-b" tabindex="-1">' + ICO.star + '<span>Супер</span></button>' +
        '<button class="mk-btn" id="mk-p-b" tabindex="-1">' + ICO.fist + '<span>Рука</span></button>' +
        '<button class="mk-btn" id="mk-k-b" tabindex="-1">' + ICO.boot + '<span>Нога</span></button>' +
        '<button class="mk-btn" id="mk-b-b" tabindex="-1">' + ICO.shield + '<span>Блок</span></button>' +
        '</div></div></div>';
      var $ = function (id) { return container.querySelector("#" + id); };
      var wrap = container.querySelector(".mk"), field = $("mk-field"), cv = $("mk-cv"), ctx = cv.getContext("2d");
      var ov = $("mk-ov");
      var W = 360, H = 560, dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      function layout() {
        W = Math.min(wrap.clientWidth, 440);
        H = Math.max(340, Math.min(wrap.clientHeight - 196, W * 1.5));
        cv.style.width = W + "px"; cv.style.height = H + "px";
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        field.style.width = W + "px"; field.style.height = H + "px";
      }

      var g = null, ctl = { mv: 0, block: false, buf: null }, phase = "splash", lastTs = 0, raf = 0;
      var Hf = 200, floorY = 400, sc = 0.36;

      function metrics() {
        var A = ARENAS[lvlIdx], sh = W * (1376 / 768);
        var want = 0.8 * H, fl = A.floor * sh;
        var off = clamp(fl - want, 0, Math.max(0, sh - H));
        g.arenaOff = off; g.arenaH = sh;
        floorY = fl - off;
        Hf = H * 0.36; sc = Hf / 560;
      }

      function newF(who, x, face, hp) {
        return { who: who, x: x, face: face, hp: hp, max: hp, state: "idle", t: 0, vx: 0, meter: who === "kasi" ? 30 : 0,
          mv: 0, block: false, atk: null, hitDone: false, alt: 0, bt: 0, think: 0.6, casted: false, wob: Math.random() * 6 };
      }

      function startLevel(i) {
        lvlIdx = i;
        try { localStorage.setItem("kate_mk_lvl", String(i)); } catch (e) {}
        var L = LV[i];
        g = { k: null, v: null, proj: [], fx: [], parts: [], stop: 0, ts: 1, shake: 0, flash: 0, cut: null, time: 0, textT: 0, text: null, koT: 0, won: null };
        metrics();
        var cx = W / 2;
        g.k = newF("kasi", cx - W * 0.2, 1, 100);
        g.v = newF("van", cx + W * 0.2, -1, L.hp);
        for (var n = 0; n < 22; n++) g.parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.5, 4), s: rnd(8, 22), ph: rnd(0, 6) });
        updateHud();
        $("mk-lv").textContent = (i + 1) + " / " + ARENAS.length;
        phase = "splash";
        var A = ARENAS[i];
        showOverlay('<div class="tk-card"><div class="tk-kicker">Бой ' + (i + 1) + '</div><h2>' + A.name + '</h2><p>' + A.note + '</p></div>', 1800, function () {
          phase = "fight"; g.textT = 0; g.text = "fight"; AUD.sfx("portal");
        });
      }

      function showOverlay(html, autoMs, cb) {
        ov.innerHTML = html; ov.classList.add("on");
        if (autoMs) setTimeout(function () { if (!alive) return; ov.classList.remove("on"); if (cb) cb(); }, autoMs);
      }
      function hideOverlay() { ov.classList.remove("on"); }

      function updateHud() {
        $("mk-hp-k").style.width = Math.max(0, g.k.hp / g.k.max * 100) + "%";
        $("mk-hp-v").style.width = Math.max(0, g.v.hp / g.v.max * 100) + "%";
        $("mk-mt-k").style.width = clamp(g.k.meter, 0, 100) + "%";
        $("mk-sp-b").classList.toggle("ready", g.k.meter >= 100);
      }

      // ---------- Бой ----------
      function reachOf(f, kind) {
        var r = ATK[kind].reach * Hf;
        if (f.who === "kasi" && kind === "kick") r *= 1.2; // длинные ноги Каси
        return r;
      }
      function other(f) { return f === g.k ? g.v : g.k; }
      function busy(f) { return f.state !== "idle" && f.state !== "block"; }

      function startAttack(f, kind) {
        f.state = kind; f.t = 0; f.hitDone = false; f.atk = ATK[kind]; f.mv = 0; f.cd = 0;
        if (f.who === "van" && kind === "kick") f.alt ^= 1;
        AUD.sfx(kind === "kick" ? "kick" : "punch");
      }
      function startSpecial(f) {
        f.meter = 0; f.state = "cut"; f.t = 0; f.casted = false; f.mv = 0;
        g.cut = { who: f.who, t: 0, dur: 0.85 };
        AUD.sfx("special");
        updateHud();
      }

      function gainMeter(f, v) { f.meter = clamp(f.meter + v, 0, 100); }

      function hurt(att, def, dmg, o) {
        // o: {kind, kb, stop, fx, pt}
        var blocked = def.state === "block" && def.face === -att.face;
        var hx = def.x - att.face * Hf * 0.12, hy = floorY - Hf * 0.55;
        if (blocked) {
          dmg = Math.max(1, Math.round(dmg * 0.15));
          def.x += att.face * 10; // отдача
          g.fx.push({ img: "block_spark", x: hx, y: hy, t: 0, dur: 0.28, s: Hf * 0.5 });
          g.stop = 0.04; g.shake = 2; AUD.sfx("block");
        } else {
          def.state = "hit"; def.t = 0; def.atk = null; def.vx = att.face * o.kb * 7;
          g.fx.push({ img: o.fx === "big" ? "hit_big" : "hit_small", x: hx, y: hy, t: 0, dur: 0.3, s: Hf * (o.fx === "big" ? 0.8 : 0.55) });
          g.stop = o.stop; g.shake = o.fx === "big" ? 7 : 3.5; g.flash = o.fx === "big" ? 0.18 : 0.08;
          for (var i = 0; i < 7; i++) g.parts.push({ burst: true, x: hx, y: hy, vx: rnd(-160, 160), vy: rnd(-180, 60), t: 0, life: rnd(0.3, 0.6) });
          AUD.sfx(o.fx === "big" ? "hit" : "punch");
          voice(def.who === "kasi" ? "mk_kasi_hit" : "mk_van_hit", 0.5, rnd(0.95, 1.08));
          if (api.haptic) api.haptic(def.who === "kasi" ? "medium" : "light");
          gainMeter(att, o.meter || 8); gainMeter(def, 6);
        }
        def.hp = Math.max(0, def.hp - dmg);
        updateHud();
        if (def.hp <= 0) koFighter(def);
      }

      function koFighter(def) {
        var win = other(def);
        def.state = "ko"; def.t = 0; def.vx = -def.face * 140; def.block = false;
        win.state = "win"; win.t = 0; win.mv = 0; win.block = false; win.vx = 0;
        phase = "ko"; g.koT = 0; g.ts = 0.35; g.text = "ko"; g.textT = 0; g.won = win.who;
        g.fx.push({ img: "ko_burst", x: def.x, y: floorY - Hf * 0.45, t: 0, dur: 0.9, s: Hf * 1.5 });
        g.proj.length = 0; g.cut = null; g.flash = 0.35; g.shake = 10;
        AUD.sfx("boom");
        if (def.who === "van") voice(lvlIdx === ARENAS.length - 1 ? "mk_van_ko" : "mk_van_hit", 0.7);
        else voice("mk_kasi_ko", 0.7);
        if (def.who === "van") setTimeout(function () { if (alive) voice("mk_kasi_win", 0.6); }, 900);
        if (api.haptic) api.haptic(def.who === "van" ? "success" : "error");
      }

      function updateFighter(f, dt) {
        var o = other(f);
        f.t += dt;
        // лицом к сопернику
        if (f.state === "idle" || f.state === "block" || ((f.state === "punch" || f.state === "kick") && f.t < 0.05)) f.face = o.x >= f.x ? 1 : -1;
        var spd = Hf * 0.85 * (f.boost || 1);
        switch (f.state) {
          case "idle": case "block":
            if (f.cd > 0) f.cd -= dt;
            if (f.block) f.state = "block"; else if (f.state === "block") f.state = "idle";
            f.x += (f.state === "block" ? 0 : f.mv * spd * dt);
            break;
          case "punch": case "kick":
            var a = f.atk, tt = f.t;
            if (tt >= a.su && tt < a.su + a.ac && !f.hitDone) {
              var dx = (o.x - f.x) * f.face, kind = f.state;
              if (dx > 0 && dx < reachOf(f, kind) && o.state !== "ko") {
                f.hitDone = true;
                hurt(f, o, Math.round(a.dmg * (f.who === "van" ? LV[lvlIdx].dmg : 1)), { kb: a.kb, stop: a.stop, fx: a.fx, meter: a.meter });
              }
            }
            if (tt >= a.su + a.ac + a.rc) { f.state = "idle"; f.atk = null; f.cd = (f.state === "idle" && a === ATK.kick ? 0.38 : 0.26) + (f.hitDone ? 0 : 0.22); }
            break;
          case "hit":
            f.x += f.vx * dt; f.vx *= Math.pow(0.0006, dt);
            if (f.t > 0.34) { f.state = "idle"; f.vx = 0; }
            break;
          case "cut":
            if (!g.cut) { f.state = f.who === "kasi" ? "cast" : "dash"; f.t = 0; f.casted = false; f.hitDone = false; }
            break;
          case "cast": // Кася: выпускает шар
            if (f.t > 0.14 && !f.casted) {
              f.casted = true;
              g.proj.push({ x: f.x + f.face * Hf * 0.35, y: floorY - Hf * 0.5, vx: f.face * W * 1.15, owner: f, dmg: 26, t: 0 });
            }
            if (f.t > 0.5) f.state = "idle";
            break;
          case "dash": // Ван: рывок с ударом ногой
            f.x += f.face * W * 1.6 * dt;
            if (!f.hitDone && Math.abs(o.x - f.x) < Hf * 0.5 && o.state !== "ko") {
              f.hitDone = true; f.state = "dashend"; f.t = 0;
              hurt(f, o, Math.round(22 * LV[lvlIdx].dmg), { kb: 70, stop: 0.12, fx: "big", meter: 0 });
            } else if (f.t > 0.5) { f.state = "dashend"; f.t = 0; }
            break;
          case "dashend": if (f.t > 0.45) { f.state = "idle"; f.hitDone = false; } break;
          case "ko": f.x += f.vx * dt; f.vx *= Math.pow(0.002, dt); break;
        }
        // границы и столкновение корпусов
        var m = Hf * 0.3;
        f.x = clamp(f.x, m, W - m);
        if (f.state !== "ko") {
          var minD = Hf * 0.52, d = o.x - f.x;
          if (Math.abs(d) < minD && o.state !== "ko" && f.state !== "dash") {
            var push = (minD - Math.abs(d)) / 2, dirp = d >= 0 ? -1 : 1;
            f.x += dirp * push; o.x -= dirp * push;
            f.x = clamp(f.x, m, W - m); o.x = clamp(o.x, m, W - m);
          }
        }
      }

      function aiUpdate(dt) {
        var v = g.v, k = g.k, L = LV[lvlIdx];
        if (v.state !== "idle" && v.state !== "block") return;
        v.bt -= dt; v.think -= dt;
        if (v.bt <= 0 && v.block) { v.block = false; }
        if (v.think > 0) return;
        v.think = L.think * rnd(0.7, 1.3);
        var d = Math.abs(k.x - v.x), toward = k.x > v.x ? 1 : -1;
        var kAtt = (k.state === "punch" || k.state === "kick" || k.state === "cast");
        v.mv = 0; v.boost = 1;
        if (kAtt && d < Hf * 1.0 && Math.random() < L.block) { v.block = true; v.bt = rnd(0.3, 0.6); return; }
        if (v.block && v.bt > 0) return;
        if (d > Hf * 0.62) {
          if (L.sp && v.meter >= 100 && d > Hf * 1.0 && Math.random() < 0.6) { startSpecial(v); return; }
          v.mv = toward; v.boost = d < Hf * 1.1 ? 1.5 : 1;
        } else {
          var r = Math.random();
          if (r < L.aggr) startAttack(v, Math.random() < 0.4 ? "kick" : "punch");
          else if (r < L.aggr + 0.18) v.mv = -toward;
        }
      }

      function playerUpdate(dt) {
        var k = g.k;
        k.block = ctl.block && !busy(k);
        if (!busy(k)) k.mv = ctl.block ? 0 : ctl.mv; else k.mv = 0;
        if (ctl.buf) {
          ctl.buf.t -= dt;
          if (ctl.buf.t <= 0) ctl.buf = null;
          else if (!busy(k) && !(k.cd > 0 && ctl.buf.a !== "special")) {
            var a = ctl.buf.a; ctl.buf = null;
            if (a === "special") { if (k.meter >= 100) startSpecial(k); }
            else startAttack(k, a);
          }
        }
      }

      function update(dt) {
        g.time += dt;
        var live = (phase === "play" || phase === "ko");
        if (g.cut) { g.cut.t += dt; if (g.cut.t > g.cut.dur) g.cut = null; }
        // шары
        for (var i = g.proj.length - 1; i >= 0; i--) {
          var p = g.proj[i], t = other(p.owner);
          p.x += p.vx * dt; p.t += dt;
          if (Math.abs(p.x - t.x) < Hf * 0.3 && t.state !== "ko") {
            hurt(p.owner, t, Math.round(p.dmg * (p.owner.who === "van" ? LV[lvlIdx].dmg : 1)), { kb: 80, stop: 0.12, fx: "big", meter: 0 });
            g.proj.splice(i, 1);
          } else if (p.x < -60 || p.x > W + 60) g.proj.splice(i, 1);
        }
        if (g.cut) return;
        if (phase === "play") { playerUpdate(dt); aiUpdate(dt); }
        updateFighter(g.k, dt); updateFighter(g.v, dt);
        if (phase === "play" && g.k.hp > 0 && g.v.hp > 0) gainMeter(g.v, dt * (LV[lvlIdx].sp ? 4.5 : 0));
        updateHud();
      }

      // ---------- Отрисовка ----------
      function poseOf(f) {
        var w = f.who, s = f.state;
        if (s === "punch" || s === "cast") return w + "_punch";
        if (s === "kick") return w === "van" ? (f.alt ? "van_kickR" : "van_kickL") : "kasi_kick";
        if (s === "dash" || s === "dashend") return "van_kickR";
        if (s === "cut") return w + "_idle";
        if (s === "block") return w + "_block";
        if (s === "hit") return w + "_hit";
        if (s === "ko") return w + "_ko";
        if (s === "win") return w + "_win";
        return w + "_idle";
      }

      function drawFighter(f) {
        var key = poseOf(f), who = f.who, name = key.replace(/^(kasi|van)_/, ""), meta = (SPR_META[who] || {})[name === "kickL" || name === "kickR" ? name : name];
        var im = SPR[key]; if (!im || !meta) return;
        var wpx = meta.w * sc, hpx = meta.h * sc, ax = meta.ax * sc;
        // тень
        ctx.fillStyle = "rgba(0,2,41,.38)";
        ctx.beginPath(); ctx.ellipse(f.x, floorY + 3, Hf * (f.state === "ko" ? 0.36 : 0.26), Hf * 0.04, 0, 0, 6.283); ctx.fill();
        ctx.save();
        var bob = 0, sy = 1;
        if (f.state === "idle" || f.state === "block") { sy = 1 + Math.sin(g.time * 4 + f.wob) * 0.012; if (f.mv) bob = -Math.abs(Math.sin(g.time * 12)) * 3; }
        if (f.state === "win") bob = -Math.abs(Math.sin(g.time * 7)) * 6;
        ctx.translate(f.x, floorY + bob);
        ctx.scale(f.face, sy);
        if (f.state === "hit") ctx.rotate(-0.04);
        ctx.drawImage(im, -ax, -hpx, wpx, hpx);
        ctx.restore();
      }

      function sparkle(c, x, y, r) {
        c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
        c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
      }

      function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (g.shake > 0.3) ctx.translate(rnd(-g.shake, g.shake), rnd(-g.shake, g.shake));
        // арена
        var ar = SPR["arena_" + (lvlIdx + 1)];
        ctx.drawImage(ar, 0, -g.arenaOff, W, g.arenaH);
        // фоновые искорки
        ctx.fillStyle = "rgba(226,236,245,.55)";
        g.parts.forEach(function (p) {
          if (p.burst) return;
          var yy = (p.y - g.time * p.s) % H; if (yy < 0) yy += H;
          ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(g.time * 1.5 + p.ph));
          sparkle(ctx, p.x + Math.sin(g.time + p.ph) * 8, yy, p.r);
        });
        ctx.globalAlpha = 1;
        // бойцы: тот, кто бьёт, рисуется поверх
        var order = (g.k.state === "punch" || g.k.state === "kick" || g.k.state === "cast" || g.k.state === "win") ? [g.v, g.k] : [g.k, g.v];
        order.forEach(drawFighter);
        // шары
        g.proj.forEach(function (p) {
          var im = SPR.special_ball, s = Hf * 0.7;
          ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(p.x, p.y); ctx.scale(p.vx < 0 ? -1 : 1, 1);
          ctx.drawImage(im, -s * 0.7, -s / 2, s * 1.4, s); ctx.restore();
        });
        // эффекты ударов
        ctx.globalCompositeOperation = "lighter";
        g.fx.forEach(function (e) {
          var p = e.t / e.dur, s = e.s * (0.55 + 0.6 * Math.min(1, p * 1.4));
          ctx.globalAlpha = Math.max(0, 1 - p * p);
          ctx.drawImage(SPR[e.img], e.x - s / 2, e.y - s / 2, s, s);
        });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        g.parts.forEach(function (p) {
          if (!p.burst) return;
          ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = "#E2ECF5"; sparkle(ctx, p.x, p.y, 3.5);
        });
        ctx.globalAlpha = 1;
        // вспышка
        if (g.flash > 0) { ctx.fillStyle = "rgba(226,236,245," + Math.min(0.6, g.flash) + ")"; ctx.fillRect(0, 0, W, H); }
        // надпись
        if (g.text) {
          var key = g.text === "fight" ? "text_fight" : g.text === "ko" ? "text_ko" : "text_win", im2 = SPR[key], tm = SPR_META[key];
          var dur = g.text === "fight" ? 1.2 : 99, tt = g.textT;
          if (tt < dur) {
            var pop = easeOutBack(Math.min(1, tt / 0.35)), tw = W * 0.82 * pop, th = tw * tm.h / tm.w;
            ctx.globalAlpha = g.text === "fight" ? clamp((dur - tt) / 0.3, 0, 1) : 1;
            ctx.drawImage(im2, W / 2 - tw / 2, H * 0.3 - th / 2, tw, th); ctx.globalAlpha = 1;
          }
        }
        // кат-ин спецприёма
        if (g.cut) {
          var c = g.cut, p2 = c.t / c.dur, im3 = SPR[c.who + "_special"];
          ctx.fillStyle = "rgba(0,2,41," + (0.55 * Math.min(1, p2 * 6)) + ")"; ctx.fillRect(0, 0, W, H);
          var bandY = H * 0.2, bandH = H * 0.4, z = 1.18 - 0.18 * Math.min(1, p2 * 3);
          ctx.save(); ctx.beginPath(); ctx.rect(0, bandY, W, bandH); ctx.clip();
          var s2 = W * 1.25 * z; ctx.globalAlpha = Math.min(1, p2 * 8) * (p2 > 0.85 ? (1 - p2) / 0.15 : 1);
          var sx = c.who === "van" ? -1 : 1; ctx.translate(W / 2, bandY + bandH / 2); ctx.scale(sx, 1);
          ctx.drawImage(im3, -s2 / 2, -s2 / 2, s2, s2); ctx.restore();
          ctx.strokeStyle = "rgba(226,236,245,.8)"; ctx.lineWidth = 2; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.moveTo(0, bandY); ctx.lineTo(W, bandY); ctx.moveTo(0, bandY + bandH); ctx.lineTo(W, bandY + bandH); ctx.stroke();
        }
        ctx.restore();
      }

      function loop(ts) {
        if (!alive) return;
        if (!wrap.isConnected) return stop();
        var rdt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
        g.textT += rdt;
        if (g.stop > 0) { g.stop -= rdt; }
        else if (phase === "play" || phase === "ko" || phase === "fight") {
          var dt = rdt * g.ts;
          if (phase === "fight") { updateFighter(g.k, dt); updateFighter(g.v, dt); g.time += dt; if (g.textT > 1.0) { phase = "play"; } }
          else update(dt);
        } else g.time += rdt;
        for (var i = g.fx.length - 1; i >= 0; i--) { g.fx[i].t += rdt; if (g.fx[i].t > g.fx[i].dur) g.fx.splice(i, 1); }
        for (var j = g.parts.length - 1; j >= 0; j--) { var p = g.parts[j]; if (p.burst) { p.t += rdt; p.x += p.vx * rdt; p.y += p.vy * rdt; p.vy += 400 * rdt; if (p.t > p.life) g.parts.splice(j, 1); } }
        g.shake = Math.max(0, g.shake - rdt * 30); g.flash = Math.max(0, g.flash - rdt * 1.6);
        if (phase === "ko") {
          g.koT += rdt;
          if (g.koT > 1.6 && g.ts < 1) g.ts = Math.min(1, g.ts + rdt);
          if (g.koT > 2.2) endRound();
        }
        draw();
        raf = requestAnimationFrame(loop);
      }

      function endRound() {
        if (phase === "done") return;
        phase = "done";
        var last = lvlIdx >= ARENAS.length - 1;
        if (g.won === "kasi") {
          AUD.sfx("success");
          showOverlay('<div class="tk-card"><img class="mk-wintxt" src="assets/mk/text_win.webp" alt=""><p>' + (last ? "Тотальный вмяс." : "Ур777 Побед@@@.") + '</p><button class="btn" id="mk-go">' + (last ? "Дальше" : "Следующий бой") + '</button></div>');
          $("mk-go").onclick = function () {
            AUD.sfx("tap");
            if (last) { stop(); endDialog(); } else { hideOverlay(); startLevel(lvlIdx + 1); }
          };
        } else {
          showOverlay('<div class="tk-card"><div class="tk-kicker">Бой ' + (lvlIdx + 1) + '</div><h2>Ван подахуел</h2><p>Попробуем ещё раз? Нога кст +20% урона.</p><button class="btn" id="mk-retry">Ещё раз</button></div>');
          $("mk-retry").onclick = function () { AUD.sfx("tap"); hideOverlay(); startLevel(lvlIdx); };
        }
      }

      function stop() {
        alive = false; cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
      }

      // ---------- Управление ----------
      var mv = $("mk-move"), al = $("mk-al"), ar = $("mk-ar"), mvId = null;
      function moveFrom(e) {
        var r = mv.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2);
        ctl.mv = Math.abs(x) < r.width * 0.06 ? 0 : (x < 0 ? -1 : 1);
        al.classList.toggle("on", ctl.mv < 0); ar.classList.toggle("on", ctl.mv > 0);
      }
      mv.addEventListener("pointerdown", function (e) { e.preventDefault(); mvId = e.pointerId; try { mv.setPointerCapture(e.pointerId); } catch (x) {} moveFrom(e); });
      mv.addEventListener("pointermove", function (e) { if (e.pointerId === mvId) moveFrom(e); });
      function mvEnd(e) { if (e.pointerId !== mvId) return; mvId = null; ctl.mv = 0; al.classList.remove("on"); ar.classList.remove("on"); }
      mv.addEventListener("pointerup", mvEnd); mv.addEventListener("pointercancel", mvEnd);

      function bindBtn(id, onDown, onUp) {
        var b = $(id), pid = null;
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); if (pid !== null) return; pid = e.pointerId; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (x) {} onDown(); });
        function up(e) { if (e.pointerId !== pid) return; pid = null; b.classList.remove("on"); if (onUp) onUp(); }
        b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
      }
      function press(a) { ctl.buf = { a: a, t: 0.12 }; }
      bindBtn("mk-p-b", function () { press("punch"); });
      bindBtn("mk-k-b", function () { press("kick"); });
      bindBtn("mk-sp-b", function () { press("special"); });
      bindBtn("mk-b-b", function () { ctl.block = true; }, function () { ctl.block = false; });
      container.querySelector(".mk-controls").addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
      wrap.addEventListener("contextmenu", function (e) { e.preventDefault(); });

      var keys = {};
      function syncKeys() {
        ctl.mv = (keys.ArrowRight || keys.d || keys.D ? 1 : 0) - (keys.ArrowLeft || keys.a || keys.A ? 1 : 0);
        ctl.block = !!(keys.l || keys.L || keys.c || keys.C);
      }
      function onKey(e) {
        if (e.repeat) return;
        keys[e.key] = true; syncKeys();
        if (e.key === "j" || e.key === "z") press("punch");
        else if (e.key === "k" || e.key === "x") press("kick");
        else if (e.key === " " || e.key === "Enter") { e.preventDefault(); press("special"); }
      }
      function onKeyUp(e) { keys[e.key] = false; syncKeys(); }
      window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);

      stopFn = stop;
      layout();
      startLevel(lvlIdx);
      raf = requestAnimationFrame(loop);
      window.MKGame._dbg = { get g() { return g; }, ctl: ctl, startLevel: startLevel, press: press, ko: function (who) { koFighter(who === "van" ? g.v : g.k); }, get phase() { return phase; } };
    }
  }

  window.MKGame = { play: play };
})();
