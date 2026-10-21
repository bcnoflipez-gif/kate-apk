// ============================================================
//  МИР «TANKS 1988»: аркада в духе «Танчиков» с Dendy.
//  Кася (игрок) против танков Вана. База внизу, кирпичные стены, стальные блоки,
//  кусты-кристаллы, бонусы. 5 уровней, на последнем босс.
//  Управление: джойстик слева, кнопка огня справа (на ПК: стрелки/WASD и пробел).
//  Арт: assets/tanks (спрайты Каси и Вана, тайлы из каталога).
// ============================================================
(function () {
  "use strict";

  var COLS = 11, ROWS = 15, SC = COLS * 2, SR = ROWS * 2;
  var DIRS = {
    up:    { x: 0,  y: -1, a: 0 },
    right: { x: 1,  y: 0,  a: Math.PI / 2 },
    down:  { x: 0,  y: 1,  a: Math.PI },
    left:  { x: -1, y: 0,  a: -Math.PI / 2 }
  };
  var DIRNAMES = ["up", "right", "down", "left"];
  var BASE_C = 5, BASE_R = 14;
  var PLAYER_START = { x: 3, y: 14 };
  var SPAWNS = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];

  // Карты 11x15. . пусто, B кирпич, D тёмный кирпич, S сталь, Z сталь с бантиком, F кусты-кристаллы,
  // u/d/l/r верхняя/нижняя/левая/правая половина кирпича
  var LEVELS = [
    { name: "Разминка", note: "Иван ещё спит. Хуй до базы доберётся, наваляй-ка ему.",
      max: 3, queue: "bbbfbbbf", flash: [3, 7],
      map: [
        "...........",
        ".B.B...B.B.",
        ".B.B.D.B.B.",
        ".B.B...B.B.",
        "....uuu....",
        "BB.......BB",
        "..S.B.B.S..",
        "....B.B....",
        "B.........B",
        "B.BB...BB.B",
        "..BB.F.BB..",
        "....FFF....",
        ".B.......B.",
        ".B..BBB..B.",
        "....B.B...."
      ] },
    { name: "Кирпичный кирпич", note: "Стены можно прострелить. Сталь пока нет.",
      max: 4, queue: "bbfbpbfbbp", flash: [3, 8],
      map: [
        "...........",
        ".DD.SDS.DD.",
        ".DD..D..DD.",
        "....B.B....",
        "BB.S...S.BB",
        "...BB.BB...",
        ".S.......S.",
        ".B.DD.DD.B.",
        ".B.......B.",
        "...S.D.S...",
        "DD...D...DD",
        "...B.....B.",
        ".B...F...B.",
        ".B..DDD..B.",
        "....D.D...."
      ] },
    { name: "Кристальная силикатка", note: "В кустах не видно, кто едет. Слушай и стреляй.",
      max: 4, queue: "bbfpbabfpbab", flash: [3, 9],
      map: [
        "...........",
        ".FF.B.B.FF.",
        ".FF.B.B.FF.",
        "....S.S....",
        "BB.FFFFF.BB",
        "...FFSFF...",
        ".B.FFFFF.B.",
        ".B.......B.",
        "..SS.B.SS..",
        "FF...B...FF",
        "FF.B.....FF",
        "...B.S.B...",
        ".S.......S.",
        ".B..BBB..B.",
        "....B.B...."
      ] },
    { name: "Железный зановес", note: "Иван подахуел мальца. Ищи звёзды, они пробивают сталь.",
      max: 5, queue: "bfpabfpabfpbab", flash: [3, 8, 12],
      map: [
        "...........",
        ".S.B...B.S.",
        ".S.B.S.B.S.",
        "...B.S.B...",
        "BB...Z...BB",
        "..S.D.D.S..",
        ".B.......B.",
        ".B.S.B.S.B.",
        "...S.B.S...",
        "DD..ZZZ..DD",
        "...B...B...",
        ".S.B.F.B.S.",
        ".S.......S.",
        ".B..BBB..B.",
        "....B.B...."
      ] },
    { name: "Битва с Иван", note: "Вы посмотрите, кто выехал, сам ИВАН!",
      max: 4, queue: "Vbfpabfpa", flash: [4, 8], boss: true,
      map: [
        "...........",
        "...........",
        ".B.......B.",
        ".B..SSS..B.",
        "....S.S....",
        "BB.......BB",
        "...F...F...",
        "..FFF.FFF..",
        "...F...F...",
        "BB.......BB",
        "....D.D....",
        ".B.......B.",
        ".B.......B.",
        ".B..BBB..B.",
        "....B.B...."
      ] }
  ];

  var ENEMY = {
    b: { speed: 2.0, bspeed: 5.0, hp: 1, fire: [1.3, 2.8], tint: null },
    f: { speed: 3.3, bspeed: 5.0, hp: 1, fire: [1.1, 2.4], tint: ["#E2ECF5", 0.4] },
    p: { speed: 2.3, bspeed: 8.5, hp: 1, fire: [1.1, 2.4], tint: ["#6E3377", 0.55] },
    a: { speed: 2.0, bspeed: 5.5, hp: 4, fire: [1.2, 2.6], tint: ["#6A4DD4", 0.6] },
    V: { speed: 1.7, bspeed: 6.5, hp: 10, fire: [0.7, 1.4], tint: ["#6E3377", 0.3], size: 1.5, boss: true }
  };

  var FILES = ["kasi_state", "kasi_move", "kasi_fire", "van_state", "van_move", "van_fire",
               "brick", "brick2", "steel", "bow", "forest", "base"];
  var imgs = null, imgsLoading = null;
  function loadImages() {
    if (imgs) return Promise.resolve();
    if (imgsLoading) return imgsLoading;
    var out = {};
    imgsLoading = Promise.all(FILES.map(function (n) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { out[n] = im; res(); };
        im.onerror = function () { out[n] = im; res(); };
        im.src = "assets/tanks/" + n + ".webp";
      });
    })).then(function () { imgs = out; });
    return imgsLoading;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ------------------------------------------------------------
  function play(container, api) {
    var AUD = window.AUDIO || { sfx: function () {}, setTheme: function () {} };
    var lvlIdx = 0;
    try { lvlIdx = Math.min(LEVELS.length - 1, parseInt(localStorage.getItem("kate_tanks_lvl") || "0", 10) || 0); } catch (e) {}

    container.innerHTML = '<div class="center muted">Загрузка…</div>';
    var alive = true;
    // Свои звуки: выстрел и саундтрек. Громкость специально тихая, чтобы не мешать.
    var SHOT_VOL = 0.5, TRACK_VOL = 0.32; // +4 дБ и +2.5 дБ к прошлым значениям
    if (AUD.preload) AUD.preload("tk_shot", "assets/audio/tanks_shot.mp3");
    var trackOn = false;
    function startTrack() {
      if (trackOn) return; trackOn = true;
      if (AUD.trackStart) AUD.trackStart("tk_track", "assets/audio/tanks_soundtrack.mp3", TRACK_VOL);
      else AUD.setTheme("chip");
    }

    // Выход из мира (кнопка назад очищает контейнер): гасим игру и саундтрек
    var token = {}, stopFn = null, shown = false;
    container.__tk = token;
    var watcher = setInterval(function () {
      if (container.__tk !== token || (shown && !container.children.length)) {
        clearInterval(watcher);
        if (alive) { alive = false; if (stopFn) stopFn(false); }
        if (container.__tk === token) stopTrack();
      }
    }, 300);

    loadImages().then(function () {
      if (!alive || container.__tk !== token) return;
      shown = true;
      preDialog();
    });

    function stopTrack() { if (!trackOn) return; trackOn = false; if (AUD.trackStop) AUD.trackStop(); else AUD.setTheme("cute"); }

    // ---------- Диалог перед стартом ----------
    function preDialog() {
      container.innerHTML =
        '<div class="dialog-stage tk-dialog">' +
        '<div class="avatar big" id="tk-av"></div>' +
        '<div class="dialog-box"><div class="speaker" id="tk-sp"></div><div class="text" id="tk-tx"></div>' +
        '<button class="btn" id="tk-nx">Далее</button></div></div>';
      var lines = [
        { who: "Ван", avatar: "van:happy", text: "Зацени, чё? Это же танчики с денди!" },
        { who: "Кася", avatar: "kasi:surprise", text: "Опа, нихуя се! Это же одна из первых игр наших." },
        { who: "Ван", avatar: "van:laugh", text: "Агаа.. А помнишь минибук? Его вечно прятали, блять." },
        { who: "Кася", avatar: "kasi:laugh", text: "Ну мы-то ебать его постоянно находили!" },
        { who: "Ван", avatar: "van:sad", text: "Ага.. А потом его никто больше и не нашёл..." },
        { who: "Кася", avatar: "kasi:happy", text: "Значит, пора вспомнить!" },
        { who: "Ван", avatar: "van:laugh", text: "Только я буду с другой стороны, пахпахпха!" }
      ];
      window.APP.runDialog(lines, {
        speaker: container.querySelector("#tk-sp"), text: container.querySelector("#tk-tx"),
        avatar: container.querySelector("#tk-av"), next: container.querySelector("#tk-nx"), onLast: startTrack
      }, function () { buildGame(); });
    }

    function endDialog() {
      container.innerHTML =
        '<div class="dialog-stage tk-dialog">' +
        '<div class="avatar big" id="tk-av"></div>' +
        '<div class="dialog-box"><div class="speaker" id="tk-sp"></div><div class="text" id="tk-tx"></div>' +
        '<button class="btn" id="tk-nx">Далее</button></div></div>';
      var lines = [
        { who: "Ван", avatar: "van:surprise", text: "Нихуя себе заявки. Ладно, сдаюсь!" },
        { who: "Кася", avatar: "kasi:laugh", text: "Отдыхать нахуй, пхаха!" },
        { who: "Ван", avatar: "van:laugh", text: "Пхаха, ес ес ес.." }
      ];
      window.APP.runDialog(lines, {
        speaker: container.querySelector("#tk-sp"), text: container.querySelector("#tk-tx"),
        avatar: container.querySelector("#tk-av"), next: container.querySelector("#tk-nx")
      }, function () {
        try { localStorage.setItem("kate_tanks_lvl", "0"); } catch (e) {}
        stopTrack();
        api.complete();
      });
    }

    // ---------- Игра ----------
    function buildGame() {
      container.innerHTML =
        '<div class="tk">' +
        '<div class="tk-hud">' +
        '<div class="tk-pill"><img src="assets/tanks/kasi_state.webp" alt=""><b id="tk-lives">3</b></div>' +
        '<div class="tk-pill tk-lvl"><span id="tk-lvl"></span></div>' +
        '<div class="tk-pill"><img src="assets/tanks/van_state.webp" alt=""><b id="tk-left">0</b></div>' +
        '</div>' +
        '<div class="tk-field" id="tk-field"><canvas id="tk-cv"></canvas><div class="tk-boss" id="tk-boss"><i></i></div><div class="tk-ov" id="tk-ov"></div></div>' +
        '<div class="tk-controls">' +
        '<div class="tk-zl" id="tk-zl"><div class="tk-stick" id="tk-stick"><i id="tk-knob"></i></div></div>' +
        '<div class="tk-zr" id="tk-zr"><button class="tk-fire" id="tk-fire" aria-label="Огонь" tabindex="-1"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="3" fill="currentColor"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8"/></svg></button></div>' +
        '</div></div>';
      var $ = function (id) { return container.querySelector("#" + id); };
      var wrap = container.querySelector(".tk");
      var field = $("tk-field"), cv = $("tk-cv"), ctx = cv.getContext("2d");
      var ov = $("tk-ov"), bossBar = $("tk-boss");

      // размеры
      var cell = 32, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      function layout() {
        var w = wrap.clientWidth, h = wrap.clientHeight - 46 - 175;
        cell = Math.floor(Math.max(22, Math.min(w / COLS, h / ROWS, 46)));
        cv.style.width = COLS * cell + "px"; cv.style.height = ROWS * cell + "px";
        cv.width = Math.round(COLS * cell * dpr); cv.height = Math.round(ROWS * cell * dpr);
        field.style.width = COLS * cell + "px"; field.style.height = ROWS * cell + "px";
        buildStatic();
      }

      var terrain, forest, g, bgCanvas, tCanvas, tctx, tintCache = {};
      var baseAlive = true;

      function buildStatic() {
        var W = cv.width, H = cv.height, s = cell * dpr;
        bgCanvas = document.createElement("canvas"); bgCanvas.width = W; bgCanvas.height = H;
        var b = bgCanvas.getContext("2d");
        var gr = b.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, "#04051f"); gr.addColorStop(1, "#0a0630");
        b.fillStyle = gr; b.fillRect(0, 0, W, H);
        b.fillStyle = "rgba(164,167,227,.07)";
        for (var i = 0; i < 34; i++) {
          var x = ((i * 73) % 97) / 97 * W, y = ((i * 41) % 89) / 89 * H;
          sparkle(b, x, y, s * (0.12 + (i % 4) * 0.05));
        }
        tCanvas = document.createElement("canvas"); tCanvas.width = W; tCanvas.height = H;
        tctx = tCanvas.getContext("2d");
        if (terrain) for (var r = 0; r < SR; r++) for (var c = 0; c < SC; c++) drawSub(r, c);
      }

      function sparkle(c, x, y, r) {
        c.beginPath();
        c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y);
        c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y);
        c.quadraticCurveTo(x, y, x, y - r); c.fill();
      }

      function drawSub(r, c) {
        var t = terrain[r * SC + c], s = cell * dpr / 2;
        tctx.clearRect(c * s, r * s, s, s);
        if (!t) return;
        var name = t === 1 ? "brick" : t === 4 ? "brick2" : t === 2 ? "steel" : "bow";
        var im = imgs[name], hw = im.naturalWidth / 2, hh = im.naturalHeight / 2;
        tctx.drawImage(im, (c % 2) * hw, (r % 2) * hh, hw, hh, c * s, r * s, s + 0.5, s + 0.5);
      }

      // ---- состояние уровня
      var ctl = { dir: null, fire: false, keys: [] };
      var phase = "splash";
      var lastTs = 0, raf = 0;

      function parse(map) {
        terrain = new Uint8Array(SC * SR);
        forest = new Uint8Array(COLS * ROWS);
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          var ch = map[r].charAt(c);
          var sub = [[0, 0], [0, 1], [1, 0], [1, 1]], v = 0;
          if (ch === "B") v = 1; else if (ch === "D") v = 4; else if (ch === "S") v = 2; else if (ch === "Z") v = 5;
          else if (ch === "F") forest[r * COLS + c] = 1;
          else if (ch === "u" || ch === "d" || ch === "l" || ch === "r") {
            v = 1;
            sub = sub.filter(function (p) {
              return ch === "u" ? p[0] === 0 : ch === "d" ? p[0] === 1 : ch === "l" ? p[1] === 0 : p[1] === 1;
            });
          }
          if (v) sub.forEach(function (p) { terrain[(r * 2 + p[0]) * SC + c * 2 + p[1]] = v; });
        }
        baseAlive = true;
        if (tctx) { tctx.clearRect(0, 0, tCanvas.width, tCanvas.height); for (var rr = 0; rr < SR; rr++) for (var cc = 0; cc < SC; cc++) drawSub(rr, cc); }
      }

      function isSolidSub(r, c) {
        if (r < 0 || c < 0 || r >= SR || c >= SC) return true;
        if (terrain[r * SC + c]) return true;
        if (r >= BASE_R * 2 && r < BASE_R * 2 + 2 && c >= BASE_C * 2 && c < BASE_C * 2 + 2) return true;
        return false;
      }

      function newTank(kind, x, y, type) {
        var def = kind === "player" ? { speed: 3.4, hp: 1 } : ENEMY[type];
        var sz = def.size || 1;
        return { kind: kind, type: type, x: x, y: y, sz: sz, dir: kind === "player" ? "up" : "down",
          speed: def.speed, hp: def.hp, maxHp: def.hp, moving: false, anim: Math.random(), fireT: 0, hitT: 0,
          shootT: rnd(0.6, 1.4), turnT: rnd(0.4, 1.5), spawnT: 0, shield: 0, carrier: false, bullets: 0, star: 0 };
      }

      function startLevel(i) {
        lvlIdx = i;
        try { localStorage.setItem("kate_tanks_lvl", String(i)); } catch (e) {}
        var L = LEVELS[i];
        parse(L.map);
        g = {
          L: L, tanks: [], bullets: [], pus: [], fx: [], parts: [],
          queue: L.queue.split(""), total: L.queue.length, spawned: 0, spawnT: 0.8, spawnIdx: 0,
          lvl: i, lives: 4, player: null, freezeT: 0, shovelT: 0, time: 0, killed: 0, respawnT: 0, endT: 0
        };
        spawnPlayer();
        phase = "splash";
        updateHud();
        $("tk-lvl").textContent = "Уровень " + (i + 1) + " / " + LEVELS.length;
        bossBar.style.display = "none";
        showOverlay('<div class="tk-card"><div class="tk-kicker">Уровень ' + (i + 1) + '</div><h2>' + L.name + '</h2><p>' + L.note + '</p></div>', 1900, function () { phase = "play"; });
      }

      function spawnPlayer() {
        var p = newTank("player", PLAYER_START.x, PLAYER_START.y, "k");
        p.spawnT = 0.01; p.shield = 3;
        p.star = g.player ? Math.max(0, g.player.star) : 0;
        g.player = p; g.tanks.push(p);
      }

      function updateHud() {
        $("tk-lives").textContent = Math.max(0, g.lives);
        var left = g.queue.length + g.tanks.filter(function (t) { return t.kind === "enemy"; }).length;
        $("tk-left").textContent = left;
      }

      function showOverlay(html, autoMs, cb) {
        ov.innerHTML = html; ov.classList.add("on");
        if (autoMs) setTimeout(function () { if (!alive) return; ov.classList.remove("on"); if (cb) cb(); }, autoMs);
      }
      function hideOverlay() { ov.classList.remove("on"); }

      // ---- коллизии
      function canOccupy(t, nx, ny) {
        var e = 0.001, sz = t.sz;
        if (nx < -e || ny < -e || nx + sz > COLS + e || ny + sz > ROWS + e) return false;
        var c0 = Math.floor(nx * 2 + e), c1 = Math.floor((nx + sz) * 2 - e);
        var r0 = Math.floor(ny * 2 + e), r1 = Math.floor((ny + sz) * 2 - e);
        for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (isSolidSub(r, c)) return false;
        for (var i = 0; i < g.tanks.length; i++) {
          var o = g.tanks[i];
          if (o === t || o.spawnT > 0) continue;
          if (nx < o.x + o.sz - 0.04 && nx + sz > o.x + 0.04 && ny < o.y + o.sz - 0.04 && ny + sz > o.y + 0.04) return false;
        }
        return true;
      }

      function moveTank(t, dir, dist) {
        var d = DIRS[dir], moved = 0, left = dist;
        if (t.dir !== dir) {
          var horizNow = (t.dir === "left" || t.dir === "right"), horizNew = (dir === "left" || dir === "right");
          if (horizNow !== horizNew) { // повернули по другой оси: выравниваем по сетке в половину клетки
            var sx = horizNew ? t.x : Math.round(t.x * 2) / 2, sy = horizNew ? Math.round(t.y * 2) / 2 : t.y;
            if (canOccupy(t, sx, sy)) { t.x = sx; t.y = sy; }
          }
          t.dir = dir;
        }
        while (left > 1e-6) {
          var st = Math.min(left, 0.08);
          var nx = t.x + d.x * st, ny = t.y + d.y * st;
          if (canOccupy(t, nx, ny)) { t.x = nx; t.y = ny; moved += st; }
          else {
            // помощь на поворотах: подруливаем к ближайшей половине клетки
            var perp = d.x !== 0 ? "y" : "x", target = Math.round(t[perp] * 2) / 2, diff = target - t[perp];
            if (Math.abs(diff) > 0.001 && Math.abs(diff) <= 0.32) {
              var step = Math.sign(diff) * Math.min(Math.abs(diff), st);
              var px = perp === "x" ? t.x + step : t.x, py = perp === "y" ? t.y + step : t.y;
              if (canOccupy(t, px, py)) { t.x = px; t.y = py; moved += st * 0.3; }
            }
            break;
          }
          left -= st;
        }
        return moved;
      }

      // ---- стрельба
      function maxBullets(t) { return t.kind === "player" && t.star >= 2 ? 2 : 1; }
      function shoot(t) {
        if (t.bullets >= maxBullets(t)) return false;
        var d = DIRS[t.dir], c = t.sz / 2;
        var sp = t.kind === "player" ? (t.star >= 1 ? 10 : 7.5) : ENEMY[t.type].bspeed;
        g.bullets.push({ x: t.x + c + d.x * c, y: t.y + c + d.y * c, dir: t.dir, speed: sp, owner: t, side: t.kind,
          pw: t.kind === "player" ? t.star : 0 });
        t.bullets++; t.fireT = 0.14;
        if (!(AUD.playSample && AUD.playSample("tk_shot", t.kind === "player" ? SHOT_VOL : SHOT_VOL * 0.45, 0.96 + Math.random() * 0.1))) AUD.sfx("shot");
        return true;
      }

      function boom(x, y, big) {
        g.fx.push({ x: x, y: y, t: 0, dur: big ? 0.8 : 0.45, r: big ? 1.6 : 0.8 });
        var n = big ? 18 : 8;
        for (var i = 0; i < n; i++) {
          var a = Math.random() * 6.28, sp = rnd(1.2, big ? 5 : 3.2);
          g.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rnd(0.3, 0.7),
            c: pick(["#E2ECF5", "#A4A7E3", "#6A4DD4", "#6E3377"]) });
        }
        AUD.sfx(big ? "boom" : "brick");
      }

      function destroyBase() {
        if (!baseAlive) return;
        baseAlive = false;
        boom(BASE_C + 0.5, BASE_R + 0.5, true);
        api.haptic && api.haptic("error");
        endLose("База уебали", "Попробуем ещё раз?");
      }

      function hitTank(t, b) {
        if (t.kind === "player") {
          if (t.shield > 0 || t.spawnT > 0) return;
          boom(t.x + 0.5, t.y + 0.5, true);
          g.tanks.splice(g.tanks.indexOf(t), 1);
          t.dead = true; t.star = 0; g.player.star = 0;
          g.lives--; updateHud();
          api.haptic && api.haptic("error");
          if (g.lives > 0) g.respawnT = 1.0;
          else endLose("Экипаж проёбан", "Иван нормальный тип походу. Давай-как ещё разок.");
          return;
        }
        if (t.spawnT > 0) return;
        t.hp--; t.hitT = 0.14;
        if (t.carrier) { t.carrier = false; spawnPowerup(); }
        if (t.hp <= 0) killEnemy(t);
        else { AUD.sfx("steel"); if (t.type === "V") updateBoss(t); }
      }

      function killEnemy(t) {
        boom(t.x + t.sz / 2, t.y + t.sz / 2, t.type === "V");
        var i = g.tanks.indexOf(t); if (i >= 0) g.tanks.splice(i, 1);
        g.killed++; updateHud();
        if (t.type === "V") bossBar.style.display = "none";
        api.haptic && api.haptic("light");
      }

      function updateBoss(t) {
        bossBar.style.display = "block";
        bossBar.firstChild.style.width = Math.max(0, t.hp / t.maxHp * 100) + "%";
      }

      function spawnPowerup() {
        var kinds = ["star", "helmet", "grenade", "clock", "shovel", "life"];
        var kind = pick(kinds), x, y, tries = 0;
        do {
          x = Math.floor(rnd(0, COLS)) + 0; y = Math.floor(rnd(1, ROWS - 1)); tries++;
        } while (tries < 40 && (isSolidSub(y * 2, x * 2) || isSolidSub(y * 2 + 1, x * 2 + 1) || forest[y * COLS + x]));
        g.pus.push({ x: x, y: y, kind: kind, t: 0 });
        AUD.sfx("sparkle");
      }

      function applyPowerup(p) {
        var pl = g.player;
        AUD.sfx("pickup");
        api.haptic && api.haptic("success");
        if (p.kind === "star") pl.star = Math.min(3, pl.star + 1);
        else if (p.kind === "helmet") pl.shield = 9;
        else if (p.kind === "clock") g.freezeT = 7;
        else if (p.kind === "life") { g.lives++; updateHud(); }
        else if (p.kind === "grenade") {
          g.tanks.slice().forEach(function (t) {
            if (t.kind !== "enemy" || t.spawnT > 0) return;
            if (t.type === "V") { t.hp -= 3; t.hitT = 0.2; updateBoss(t); if (t.hp <= 0) killEnemy(t); }
            else killEnemy(t);
          });
        } else if (p.kind === "shovel") {
          g.shovelT = 14; setBaseWalls(2);
        }
      }

      var BASE_RING = [];
      (function () {
        for (var r = 26; r < 30; r++) for (var c = 8; c < 14; c++) {
          var inBase = r >= 28 && c >= 10 && c < 12;
          if (!inBase && r <= 29) BASE_RING.push([r, c]);
        }
      })();
      function setBaseWalls(v) {
        BASE_RING.forEach(function (p) {
          // кольцо вокруг базы: только клетки, где были кирпичи (ряд 13 и боковые в ряду 14)
          var r = p[0], c = p[1];
          if (r >= 28 && (c === 9 || c === 8 || c === 12 || c === 13)) { terrain[r * SC + c] = v; drawSub(r, c); }
          else if (r === 27 || r === 26) { if (c >= 8 && c < 14) { terrain[r * SC + c] = v; drawSub(r, c); } }
        });
      }

      // ---- ИИ врагов
      function aiChoose(t) {
        var baseX = BASE_C, opts = [];
        var toBase = (baseX - t.x) > 0.3 ? "right" : (baseX - t.x) < -0.3 ? "left" : "down";
        var r = Math.random();
        if (r < 0.4) return "down";
        if (r < 0.65) return toBase;
        return pick(DIRNAMES);
      }

      function updateEnemy(t, dt) {
        if (t.spawnT > 0) { t.spawnT -= dt; return; }
        t.hitT = Math.max(0, t.hitT - dt); t.fireT = Math.max(0, t.fireT - dt);
        if (g.freezeT > 0) { t.moving = false; return; }
        t.turnT -= dt;
        var dist = t.speed * dt;
        var mv = moveTank(t, t.dir, dist);
        t.moving = mv > 0;
        if (mv < dist * 0.4 || t.turnT <= 0) {
          t.dir = aiChoose(t);
          t.turnT = rnd(0.5, 2.0);
        }
        if (t.moving) t.anim += dt;
        t.shootT -= dt;
        if (t.shootT <= 0) {
          var def = ENEMY[t.type], k = 1.15 - g.lvl * 0.06;
          t.shootT = rnd(def.fire[0], def.fire[1]) * k;
          shoot(t);
          // увидел базу или Касю: стреляет чаще
          var pl = g.player, aligned = (t.dir === "down" && Math.abs(t.x - BASE_C) < 0.6);
          if (pl && !pl.dead) {
            if ((t.dir === "left" || t.dir === "right") && Math.abs(t.y - pl.y) < 0.6) aligned = true;
            if ((t.dir === "up" || t.dir === "down") && Math.abs(t.x - pl.x) < 0.6) aligned = true;
          }
          if (aligned) t.shootT *= 0.45;
        }
      }

      function updatePlayer(t, dt) {
        t.hitT = Math.max(0, t.hitT - dt); t.fireT = Math.max(0, t.fireT - dt);
        t.shield = Math.max(0, t.shield - dt);
        if (t.spawnT > 0) t.spawnT = 0;
        var dir = ctl.dir;
        t.moving = false;
        if (dir) {
          var mv = moveTank(t, dir, t.speed * dt);
          t.moving = true;
          t.anim += dt;
        }
        if (ctl.fire) { if (!t.shootCd || t.shootCd <= 0) { if (shoot(t)) t.shootCd = 0.2; } }
        if (t.shootCd > 0) t.shootCd -= dt;
        // бонусы
        for (var i = g.pus.length - 1; i >= 0; i--) {
          var p = g.pus[i];
          if (Math.abs(p.x - t.x) < 0.85 && Math.abs(p.y - t.y) < 0.85) { g.pus.splice(i, 1); applyPowerup(p); }
        }
      }

      function updateBullets(dt) {
        for (var i = g.bullets.length - 1; i >= 0; i--) {
          var b = g.bullets[i], d = DIRS[b.dir], dist = b.speed * dt, gone = false;
          while (dist > 1e-6 && !gone) {
            var st = Math.min(dist, 0.12); dist -= st;
            b.x += d.x * st; b.y += d.y * st;
            if (b.x < 0 || b.y < 0 || b.x > COLS || b.y > ROWS) { gone = true; boom(Math.max(0, Math.min(COLS, b.x)), Math.max(0, Math.min(ROWS, b.y)), false); break; }
            // стены: две точки по ширине снаряда
            var px = -d.y * 0.2, py = d.x * 0.2, hit = false;
            var pts = [[b.x + px, b.y + py], [b.x - px, b.y - py]];
            var done = {};
            for (var k = 0; k < 2; k++) {
              var sc = Math.floor(pts[k][0] * 2), sr = Math.floor(pts[k][1] * 2);
              var key = sr * 100 + sc; if (done[key]) continue; done[key] = 1;
              if (sr < 0 || sc < 0 || sr >= SR || sc >= SC) continue;
              var tv = terrain[sr * SC + sc];
              if (tv) {
                hit = true;
                if (tv === 1 || tv === 4) { terrain[sr * SC + sc] = 0; drawSub(sr, sc); AUD.sfx("brick"); }
                else if (b.pw >= 3 && tv === 2) { terrain[sr * SC + sc] = 0; drawSub(sr, sc); AUD.sfx("brick"); }
                else AUD.sfx("steel");
              } else if (sr >= BASE_R * 2 && sr < BASE_R * 2 + 2 && sc >= BASE_C * 2 && sc < BASE_C * 2 + 2) {
                hit = true; if (b.side === "enemy") destroyBase();
              }
            }
            if (hit) { gone = true; g.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, t: 0, life: 0.2, c: "#E2ECF5" }); break; }
            // танки
            for (var j = 0; j < g.tanks.length; j++) {
              var t = g.tanks[j];
              if (t.kind === b.side || t.spawnT > 0) continue;
              if (b.x > t.x + 0.02 && b.x < t.x + t.sz - 0.02 && b.y > t.y + 0.02 && b.y < t.y + t.sz - 0.02) {
                hitTank(t, b); gone = true; break;
              }
            }
            if (gone) break;
            // пуля о пулю
            for (var m = 0; m < g.bullets.length; m++) {
              var o = g.bullets[m];
              if (o === b || o.side === b.side) continue;
              if (Math.abs(o.x - b.x) < 0.22 && Math.abs(o.y - b.y) < 0.22) { o.dead = true; gone = true; AUD.sfx("steel"); break; }
            }
          }
          if (gone || b.dead) {
            if (b.owner) b.owner.bullets = Math.max(0, b.owner.bullets - 1);
            g.bullets.splice(i, 1);
          }
        }
      }

      function update(dt) {
        g.time += dt;
        var i;
        for (i = 0; i < g.tanks.length; i++) {
          var t = g.tanks[i];
          if (t.kind === "player") updatePlayer(t, dt); else updateEnemy(t, dt);
        }
        updateBullets(dt);
        // спавн врагов
        g.spawnT -= dt;
        var aliveEn = g.tanks.filter(function (t) { return t.kind === "enemy"; }).length;
        if (g.queue.length && aliveEn < g.L.max && g.spawnT <= 0) {
          var sp = g.L.boss && g.queue[0] === "V" ? { x: 4.25, y: 0 } : SPAWNS[g.spawnIdx % 3];
          var probe = newTank("enemy", sp.x, sp.y, g.queue[0]);
          if (canOccupy(probe, sp.x, sp.y)) {
            probe.spawnT = 0.9;
            g.spawned++;
            if (g.L.flash.indexOf(g.spawned) >= 0 && !ENEMY[probe.type].boss) probe.carrier = true;
            g.queue.shift(); g.spawnIdx++; g.spawnT = 2.2;
            g.tanks.push(probe); AUD.sfx("spawn"); updateHud();
            if (probe.type === "V") updateBoss(probe);
          } else g.spawnT = 0.5;
        }
        if (g.respawnT > 0) { g.respawnT -= dt; if (g.respawnT <= 0) spawnPlayer(); }
        if (g.freezeT > 0) g.freezeT -= dt;
        if (g.shovelT > 0) { g.shovelT -= dt; if (g.shovelT <= 0) setBaseWalls(1); }
        // бонусы живут 14 сек
        for (i = g.pus.length - 1; i >= 0; i--) { g.pus[i].t += dt; if (g.pus[i].t > 14) g.pus.splice(i, 1); }
        for (i = g.fx.length - 1; i >= 0; i--) { g.fx[i].t += dt; if (g.fx[i].t > g.fx[i].dur) g.fx.splice(i, 1); }
        for (i = g.parts.length - 1; i >= 0; i--) {
          var p = g.parts[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.t > p.life) g.parts.splice(i, 1);
        }
        // победа
        if (phase === "play" && !g.queue.length && !g.tanks.some(function (t) { return t.kind === "enemy"; })) {
          g.endT += dt;
          if (g.endT > 1.2) endWin();
        }
      }

      function endWin() {
        phase = "won";
        api.haptic && api.haptic("success"); AUD.sfx("success");
        var last = lvlIdx >= LEVELS.length - 1;
        showOverlay('<div class="tk-card"><div class="tk-kicker">Уровень ' + (lvlIdx + 1) + '</div><h2>' + (last ? "Иван в лошках!" : "Кайфик!") + '</h2>' +
          '<p>' + (last ? "Все пять уровней пройдены." : "База цела.") + '</p>' +
          '<button class="btn" id="tk-go">' + (last ? "Дальше" : "Следующий уровень") + '</button></div>');
        $("tk-go").onclick = function () {
          AUD.sfx("tap");
          if (last) { stop(); endDialog(); }
          else { hideOverlay(); startLevel(lvlIdx + 1); }
        };
      }

      function endLose(title, text) {
        if (phase === "lost" || phase === "won") return;
        phase = "lost";
        setTimeout(function () {
          if (!alive) return;
          showOverlay('<div class="tk-card"><div class="tk-kicker">Уровень ' + (lvlIdx + 1) + '</div><h2>' + title + '</h2><p>' + text + '</p>' +
            '<button class="btn" id="tk-retry">Ещё раз</button></div>');
          $("tk-retry").onclick = function () { AUD.sfx("tap"); hideOverlay(); startLevel(lvlIdx); };
        }, 900);
      }

      // ---- отрисовка
      function tinted(img, color, alpha) {
        var key = img.src + color + alpha;
        if (tintCache[key]) return tintCache[key];
        var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext("2d"); x.drawImage(img, 0, 0);
        x.globalCompositeOperation = "source-atop"; x.globalAlpha = alpha; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
        tintCache[key] = c; return c;
      }

      function tankSprite(t) {
        var who = t.kind === "player" ? "kasi" : "van";
        var f = t.fireT > 0 ? "fire" : (t.moving && Math.floor(t.anim * 8) % 2 ? "move" : "state");
        var img = imgs[who + "_" + f], s = img;
        if (t.kind === "enemy") {
          var def = ENEMY[t.type];
          if (t.hitT > 0) s = tinted(img, "#E2ECF5", 0.75);
          else if (t.carrier && Math.floor(g.time * 5) % 2) s = tinted(img, "#E2ECF5", 0.65);
          else if (t.type === "a") s = tinted(img, "#6A4DD4", 0.18 + (t.hp - 1) * 0.16);
          else if (def.tint) s = tinted(img, def.tint[0], def.tint[1]);
        }
        return s;
      }

      function drawTank(c, t, S) {
        var x = (t.x + t.sz / 2) * S, y = (t.y + t.sz / 2) * S, size = t.sz * S * 1.02;
        if (t.spawnT > 0) {
          var k = 1 - t.spawnT / 0.9, r = S * 0.5 * (0.4 + Math.abs(Math.sin(k * 12)) * 0.6);
          c.fillStyle = Math.floor(k * 14) % 2 ? "#E2ECF5" : "#A4A7E3"; sparkle(c, x, y, r * 1.3); return;
        }
        c.save(); c.translate(x, y); c.rotate(DIRS[t.dir].a);
        c.drawImage(tankSprite(t), -size / 2, -size / 2, size, size);
        c.restore();
        if (t.kind === "player" && t.shield > 0 && (t.shield > 1 || Math.floor(g.time * 10) % 2)) {
          c.strokeStyle = "rgba(226,236,245,.9)"; c.lineWidth = 2 * dpr;
          c.shadowColor = "#A4A7E3"; c.shadowBlur = 10 * dpr;
          c.beginPath(); c.arc(x, y, S * 0.62 + Math.sin(g.time * 8) * 1.5, 0, 6.283); c.stroke();
          c.shadowBlur = 0;
        }
      }

      function drawPowerup(c, p, S) {
        if (p.t > 10 && Math.floor(p.t * 6) % 2) return;
        var x = (p.x + 0.5) * S, y = (p.y + 0.5 + Math.sin(g.time * 4 + p.x) * 0.05) * S, r = S * 0.42;
        c.save(); c.translate(x, y);
        c.shadowColor = "#A4A7E3"; c.shadowBlur = 12 * dpr;
        var gr = c.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, "#E2ECF5"); gr.addColorStop(1, "#A4A7E3");
        c.fillStyle = gr; c.beginPath();
        c.moveTo(-r + r * .3, -r); c.arcTo(r, -r, r, r, r * .3); c.arcTo(r, r, -r, r, r * .3); c.arcTo(-r, r, -r, -r, r * .3); c.arcTo(-r, -r, r, -r, r * .3); c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = "#6A4DD4"; c.lineWidth = 1.5 * dpr; c.stroke();
        c.fillStyle = "#000229"; c.strokeStyle = "#000229"; c.lineWidth = 2 * dpr; c.lineCap = "round";
        var q = r * 0.6;
        if (p.kind === "star") { c.fillStyle = "#6A4DD4"; sparkle(c, 0, 0, q * 1.15); }
        else if (p.kind === "helmet") { c.beginPath(); c.arc(0, q * 0.25, q, Math.PI, 0); c.lineTo(q, q * .55); c.lineTo(-q, q * .55); c.closePath(); c.fill(); }
        else if (p.kind === "grenade") { c.beginPath(); c.arc(0, 0, q * 0.55, 0, 6.283); c.fill();
          for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * q * .7, Math.sin(a) * q * .7); c.lineTo(Math.cos(a) * q * 1.1, Math.sin(a) * q * 1.1); c.stroke(); } }
        else if (p.kind === "clock") { c.beginPath(); c.arc(0, 0, q, 0, 6.283); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -q * .65); c.moveTo(0, 0); c.lineTo(q * .5, q * .2); c.stroke(); }
        else if (p.kind === "shovel") { c.fillStyle = "#6E3377"; c.fillRect(-q, -q * .8, q * .9, q * .7); c.fillRect(q * .1, -q * .8, q * .9, q * .7); c.fillRect(-q * .45, q * .05, q * .9, q * .7); }
        else if (p.kind === "life") { c.fillStyle = "#6E3377"; c.beginPath(); c.moveTo(0, q * .8); c.bezierCurveTo(-q * 1.6, -q * .2, -q * .7, -q * 1.1, 0, -q * .3); c.bezierCurveTo(q * .7, -q * 1.1, q * 1.6, -q * .2, 0, q * .8); c.fill(); }
        c.restore();
      }

      function draw() {
        var S = cell * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(bgCanvas, 0, 0);
        ctx.drawImage(tCanvas, 0, 0);
        // база
        var bx = BASE_C * S, by = BASE_R * S;
        if (baseAlive) ctx.drawImage(imgs.base, bx - S * 0.1, by, S * 1.2, S);
        else { ctx.globalAlpha = 0.5; ctx.drawImage(imgs.base, bx - S * 0.1, by, S * 1.2, S); ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,2,41,.7)"; ctx.fillRect(bx, by, S, S); }
        g.pus.forEach(function (p) { drawPowerup(ctx, p, S); });
        g.tanks.forEach(function (t) { drawTank(ctx, t, S); });
        // снаряды
        g.bullets.forEach(function (b) {
          ctx.save(); ctx.shadowColor = b.side === "player" ? "#A4A7E3" : "#6E3377"; ctx.shadowBlur = 8 * dpr;
          ctx.fillStyle = "#E2ECF5"; ctx.beginPath(); ctx.arc(b.x * S, b.y * S, S * 0.11, 0, 6.283); ctx.fill();
          ctx.fillStyle = b.side === "player" ? "#A4A7E3" : "#6E3377"; ctx.beginPath(); ctx.arc(b.x * S, b.y * S, S * 0.06, 0, 6.283); ctx.fill();
          ctx.restore();
        });
        // кусты поверх танков
        ctx.globalAlpha = 0.93;
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (forest[r * COLS + c]) {
          var fi = imgs.forest, fh = S * fi.naturalHeight / fi.naturalWidth;
          ctx.drawImage(fi, c * S - S * 0.04, r * S - (fh - S) * 0.5, S * 1.08, fh);
        }
        ctx.globalAlpha = 1;
        // взрывы и искры
        g.fx.forEach(function (e) {
          var p = e.t / e.dur, rr = e.r * S * (1 - Math.pow(1 - p, 3)), a = 1 - p;
          var gr = ctx.createRadialGradient(e.x * S, e.y * S, 0, e.x * S, e.y * S, Math.max(1, rr));
          gr.addColorStop(0, "rgba(226,236,245," + a + ")"); gr.addColorStop(0.45, "rgba(164,167,227," + a * 0.8 + ")"); gr.addColorStop(1, "rgba(110,51,119,0)");
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e.x * S, e.y * S, rr, 0, 6.283); ctx.fill();
          ctx.fillStyle = "rgba(226,236,245," + a + ")"; sparkle(ctx, e.x * S, e.y * S, rr * (1 - p) * 0.9);
        });
        g.parts.forEach(function (p) {
          ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c;
          ctx.fillRect(p.x * S - 2 * dpr, p.y * S - 2 * dpr, 4 * dpr, 4 * dpr);
        });
        ctx.globalAlpha = 1;
        // заморозка: лёгкий холодный оттенок
        if (g.freezeT > 0) { ctx.fillStyle = "rgba(164,167,227,.12)"; ctx.fillRect(0, 0, cv.width, cv.height); }
      }

      function loop(ts) {
        if (!alive) return;
        if (!wrap.isConnected) return stop(false);
        var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
        if (phase === "play") update(dt); else if (phase !== "splash") { g.time += dt; for (var i = g.fx.length - 1; i >= 0; i--) { g.fx[i].t += dt; if (g.fx[i].t > g.fx[i].dur) g.fx.splice(i, 1); } g.parts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }); }
        else g.time += dt;
        draw();
        raf = requestAnimationFrame(loop);
      }

      function stop(restoreTheme) {
        alive = false; cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
        if (restoreTheme) stopTrack();
      }

      // ---- управление
      var zl = $("tk-zl"), zr = $("tk-zr"), stick = $("tk-stick"), knob = $("tk-knob"), fireBtn = $("tk-fire");
      var stickId = null, ox = 0, oy = 0, fireId = null;
      // Плавающий джойстик: появляется там, где коснулся пальцем в левой половине, и не требует точного попадания.
      function placeStick(x, y) {
        var r = zl.getBoundingClientRect(), R = 66;
        ox = Math.max(r.left + R, Math.min(r.right - R, x)); oy = Math.max(r.top + R, Math.min(r.bottom - R, y));
        stick.style.left = (ox - r.left - R) + "px"; stick.style.top = (oy - r.top - R) + "px";
      }
      function stickMove(e) {
        var dx = e.clientX - ox, dy = e.clientY - oy, len = Math.hypot(dx, dy), max = 46;
        if (len > max * 1.6) { // палец ушёл далеко: стик догоняет, чтобы не терять управление
          var k2 = (len - max * 1.6) / len; placeStick(ox + dx * k2, oy + dy * k2); dx = e.clientX - ox; dy = e.clientY - oy; len = Math.hypot(dx, dy);
        }
        var k = len > max ? max / len : 1;
        knob.style.transform = "translate(" + dx * k + "px," + dy * k + "px)";
        if (len < 9) { ctl.dir = null; return; }
        var cur = ctl.dir, horiz = Math.abs(dx) > Math.abs(dy);
        // гистерезис: текущее направление держится, пока другая ось не станет заметно сильнее
        if (cur === "left" || cur === "right") { if (Math.abs(dy) < Math.abs(dx) * 1.25) horiz = true; }
        else if (cur === "up" || cur === "down") { if (Math.abs(dx) < Math.abs(dy) * 1.25) horiz = false; }
        ctl.dir = horiz ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      }
      zl.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (stickId !== null) return; stickId = e.pointerId;
        try { zl.setPointerCapture(e.pointerId); } catch (x) {}
        placeStick(e.clientX, e.clientY); stick.classList.add("on"); stickMove(e);
      });
      zl.addEventListener("pointermove", function (e) { if (e.pointerId === stickId) { e.preventDefault(); stickMove(e); } });
      function stickEnd(e) {
        if (e.pointerId !== stickId) return; stickId = null; ctl.dir = null;
        knob.style.transform = ""; stick.classList.remove("on"); stick.style.left = ""; stick.style.top = "";
      }
      zl.addEventListener("pointerup", stickEnd); zl.addEventListener("pointercancel", stickEnd);
      // Огонь: вся правая половина панели, кнопка лишь подсказка; можно держать
      zr.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (fireId !== null) return; fireId = e.pointerId; ctl.fire = true; fireBtn.classList.add("on");
        try { zr.setPointerCapture(e.pointerId); } catch (x) {}
      });
      function fireEnd(e) { if (e && e.pointerId !== fireId) return; fireId = null; ctl.fire = false; fireBtn.classList.remove("on"); }
      zr.addEventListener("pointerup", fireEnd); zr.addEventListener("pointercancel", fireEnd);
      // Блокируем прокрутку и зум только на панели управления, чтобы кнопки в оверлее оставались кликабельными
      container.querySelector(".tk-controls").addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
      wrap.addEventListener("contextmenu", function (e) { e.preventDefault(); });

      var KEYDIR = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
      function onKey(e) {
        if (KEYDIR[e.key]) { e.preventDefault(); var d = KEYDIR[e.key]; ctl.keys = ctl.keys.filter(function (k) { return k !== d; }); ctl.keys.push(d); ctl.dir = d; }
        else if (e.key === " ") { e.preventDefault(); ctl.fire = true; }
      }
      function onKeyUp(e) {
        if (KEYDIR[e.key]) { var d = KEYDIR[e.key]; ctl.keys = ctl.keys.filter(function (k) { return k !== d; }); ctl.dir = ctl.keys.length ? ctl.keys[ctl.keys.length - 1] : null; }
        else if (e.key === " ") ctl.fire = false;
      }
      window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);

      stopFn = stop;
      layout();
      startLevel(lvlIdx);
      raf = requestAnimationFrame(loop);
      window.TanksGame._dbg = { lose: function () { endLose("t", "t"); }, get g() { return g; }, startLevel: startLevel, ctl: ctl, killAll: function () { g.queue = []; g.tanks.slice().forEach(function (t) { if (t.kind === "enemy") killEnemy(t); }); } };
    }
  }

  window.TanksGame = { play: play };
})();
