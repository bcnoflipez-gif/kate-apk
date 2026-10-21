// ============================================================
//  HEROES OF MAGIC: карта (плитки, объекты, отряд, ходьба по тапу, сущности, HUD, мини-игры, финал)
// ============================================================
(function () {
  "use strict";
  var HG = window.HG, ST = window.HStory, DT = window.HData, el = HG.el;
  var IMG = "assets/heroes/";
  var view, mapEl, entLayer, partyLayer, T = 52, L = null, grid = [], moveTok = 0, trail = [], hudEl;

  // ---------- Клетки ----------
  function cellDef(x, y) {
    if (y < 0 || y >= grid.length || x < 0 || x >= L.cols) return null;
    return L.legend[grid[y].charAt(x)] || { g: L.legend[Object.keys(L.legend)[0]].g };
  }
  function visible(e) {
    var S = HG.S;
    if (e.type === "coin") return S.coinDay[e.id] !== S.day;
    if (e.type === "buff") return !S.taken[e.id];
    if (e.type === "item") return !S.taken[e.id] && HG.flag(e.req);
    if (e.type === "mob") return !S.defeated[e.id] || S.day >= S.defeated[e.id] + 2;
    // Триггер с until остаётся, пока не выполнено условие (иначе при прерванной сцене друзья терялись навсегда)
    if (e.type === "trigger" && !e.until && S.flags["tr_" + e.id]) return false;
    if (e.type === "trigger" && e.until && HG.flag(e.until)) return false;
    if (e.hideIf && HG.flag(e.hideIf)) return false;
    if (e.req && !HG.flag(e.req)) return false;
    return true;
  }
  function entAt(x, y) {
    var r = L.entities;
    for (var i = 0; i < r.length; i++) if (r[i].x === x && r[i].y === y && visible(r[i])) return r[i];
    return null;
  }
  function isBlocking(e) { return e && (e.type === "mob" || e.type === "npc" || e.type === "castle" || e.type === "station"); }
  function walkable(x, y) {
    var c = cellDef(x, y); if (!c) return false;
    if (c.blk) return false;
    if (c.o && !c.walk) return false;
    return !isBlocking(entAt(x, y));
  }

  // ---------- Поиск пути (BFS) ----------
  function findPath(sx, sy, goals) {
    var key = function (x, y) { return x + "," + y; }, gset = {};
    goals.forEach(function (g) { gset[key(g.x, g.y)] = 1; });
    if (gset[key(sx, sy)]) return [];
    var q = [{ x: sx, y: sy }], prev = {}; prev[key(sx, sy)] = null;
    var D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (q.length) {
      var c = q.shift();
      for (var i = 0; i < 4; i++) {
        var nx = c.x + D4[i][0], ny = c.y + D4[i][1], k = key(nx, ny);
        if (k in prev) continue;
        if (!walkable(nx, ny)) continue;
        prev[k] = c;
        if (gset[k]) {
          var path = [], cur = { x: nx, y: ny };
          while (cur && !(cur.x === sx && cur.y === sy)) { path.unshift(cur); cur = prev[key(cur.x, cur.y)]; }
          return path;
        }
        q.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  // ---------- HUD ----------
  HG.hud = function () {
    if (!hudEl) return;
    var S = HG.S, a = "";
    ST.MAIN.forEach(function (id) {
      a += '<img class="' + (S.artifacts[id] ? "got" : "") + '" alt="" src="' + HG.img(ST.ARTS[id].icon) + '">';
    });
    hudEl.querySelector(".hm-arts-mini").innerHTML = a;
    hudEl.querySelector(".hm-coins b").textContent = S.coins;
    hudEl.querySelector(".hm-home").style.display = S.loc === "loc1" ? "none" : "";
  };
  function buildHud() {
    hudEl = el("div", "hm-hud");
    hudEl.innerHTML = '<div class="hm-hud-top"><div class="hm-hud-l"><b class="hm-loc"></b><span class="hm-zone"></span></div>' +
      '<div class="hm-coins"><i></i><b>0</b></div></div>' +
      '<div class="hm-hud-row"><div class="hm-arts-mini"></div>' +
      '<button class="hm-hbtn hm-b-arts">Список</button><button class="hm-hbtn hm-b-party">Команда</button>' +
      '<button class="hm-hbtn hm-home">Замок</button></div>';
    HG.root.appendChild(hudEl);
    hudEl.querySelector(".hm-b-arts").addEventListener("click", function () { if (!HG.busy) { HG.busy = true; HG.artModal(function () { HG.busy = false; }); } });
    hudEl.querySelector(".hm-b-party").addEventListener("click", function () { if (!HG.busy) { HG.busy = true; HG.partyModal(function () { HG.busy = false; }); } });
    hudEl.querySelector(".hm-home").addEventListener("click", function () {
      if (HG.busy) return;
      HG.busy = true;
      menu("Вернуться в замок?", "Переночуем, и монеты на карте появятся снова. Враги возвращаются через 2 дня, слабее и без наград-артефактов.", [
        { label: "В замок", fn: function () { HG.loadLoc("loc1", 3, 2, function () { HG.busy = false; castleMenu(); }); } },
        { label: "Остаться", ghost: 1, fn: function () { HG.busy = false; } }
      ]);
    });
  }

  // Простое меню-карточка с кнопками
  function menu(title, text, items) {
    var ov = el("div", "hm-pop"), h = '<div class="hm-pop-card"><h2>' + title + '</h2>' + (text ? "<p>" + text + "</p>" : "");
    ov.innerHTML = h + "</div>";
    var card = ov.firstChild;
    items.forEach(function (it) {
      var b = el("button", "btn" + (it.ghost ? " ghost" : ""), it.label);
      b.addEventListener("click", function () {
        HG.sfx("tap");
        ov.classList.remove("on");
        HG.wait(160, function () { if (ov.parentNode) ov.parentNode.removeChild(ov); if (it.fn) it.fn(); });
      });
      card.appendChild(b);
    });
    HG.root.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });
  }
  HG.menu = menu;

  // ---------- Построение карты ----------
  function build(locId) {
    L = ST.LOCS[locId]; grid = L.grid;
    if (view && view.parentNode) view.parentNode.removeChild(view);
    view = el("div", "hm-view");
    view.style.setProperty("--bg", "url(" + new URL(L.bg, document.baseURI).href + ")");
    view.style.setProperty("--tint", L.tint || "#000229");
    var w = HG.root.clientWidth || 360;
    T = Math.max(40, Math.min(64, Math.floor(w / L.cols)));
    var rows = grid.length, MW = L.cols * T, MH = rows * T;
    mapEl = el("div", "hm-map"); mapEl.style.width = MW + "px"; mapEl.style.height = MH + "px"; mapEl.style.setProperty("--T", T + "px");

    var html = "", i, x, y, c;
    // земля
    for (y = 0; y < rows; y++) for (x = 0; x < L.cols; x++) {
      c = cellDef(x, y);
      html += '<img class="hm-tile" alt="" draggable="false" src="' + HG.img("tiles/" + locId + "_" + c.g) + '" style="left:' + x * T + "px;top:" + y * T + "px;width:" + T + "px;height:" + T + 'px">';
    }
    // объекты
    for (y = 0; y < rows; y++) for (x = 0; x < L.cols; x++) {
      c = cellDef(x, y); if (!c.o) continue;
      var od = ST.OBJ[c.o] || { w: 1 }, wpx = od.w * T;
      var st = od.full
        ? "left:" + x * T + "px;top:" + y * T + "px;width:" + T + "px;height:" + T + "px;"
        : "left:" + (x * T + T / 2 - wpx / 2) + "px;bottom:" + (MH - (y + 1) * T) + "px;width:" + wpx + "px;";
      html += '<img class="hm-obj" alt="" draggable="false" src="' + HG.img("objs/" + c.o) + '" style="' + st + "z-index:" + (y * 10 + 4) + '">';
    }
    // крупный декор
    (L.decor || []).forEach(function (d) {
      var wpx = d.w * T;
      html += '<img class="hm-obj hm-decor" alt="" draggable="false" src="' + HG.img("objs/" + d.obj) + '" style="left:' + d.x * T + "px;bottom:" + (MH - (d.bottomRow + 1) * T) + "px;width:" + wpx + "px;z-index:" + (d.bottomRow * 10 + 3) + '">';
    });
    mapEl.innerHTML = html;
    entLayer = el("div", "hm-ents"); mapEl.appendChild(entLayer);
    partyLayer = el("div", "hm-partylayer"); mapEl.appendChild(partyLayer);
    view.appendChild(mapEl);
    HG.root.insertBefore(view, HG.root.firstChild);
    mapEl.addEventListener("pointerup", onTap);
    renderEntities();
  }

  function renderEntities() {
    var html = "";
    L.entities.forEach(function (e) {
      if (!visible(e)) return;
      var st = "left:" + e.x * T + "px;top:" + e.y * T + "px;width:" + T + "px;height:" + T + "px;z-index:" + (e.y * 10 + 6) + ";";
      var inner = "", cls = "hm-ent " + e.type;
      if (e.type === "coin") inner = '<i class="hm-coin"></i>';
      else if (e.type === "buff") inner = '<img class="hm-chest" alt="" src="' + HG.img("objs/chest") + '"><img class="hm-bico" alt="" src="' + HG.img(ST.BUFFS[e.buff].icon) + '">';
      else if (e.type === "item") inner = '<img class="hm-itm" alt="" src="' + HG.img(ST.ARTS[e.art].icon) + '">';
      else if (e.type === "exit") inner = '<span class="hm-exitm"></span><span class="hm-tag">' + (e.label || "") + '</span>';
      else if (e.type === "mob") inner = '<img class="hm-sp mob" alt="" src="' + HG.sprite(e.sprite) + '"><span class="hm-tag">' + (e.optional ? "по желанию" : "враг") + '</span>';
      else if (e.type === "npc") inner = '<img class="hm-sp npc" alt="" src="' + HG.sprite(e.sprite) + '"><span class="hm-tag">' + e.name + '</span>';
      else if (e.type === "station" || e.type === "castle") inner = '<span class="hm-tag st">' + e.label + '</span>';
      else if (e.type === "trigger") return;
      html += '<div class="' + cls + '" data-id="' + e.id + '" style="' + st + '">' + inner + "</div>";
    });
    entLayer.innerHTML = html;
  }
  HG.refreshMap = function () { if (entLayer) renderEntities(); };

  // ---------- Отряд на карте ----------
  var members = [];
  function renderParty() {
    partyLayer.innerHTML = ""; members = [];
    HG.S.party.forEach(function (id, i) {
      var d = el("div", "hm-pm"), im = el("img", "", ""); im.alt = ""; im.src = HG.sprite(DT.ALLY[id].idle);
      d.appendChild(im); d.style.width = T + "px"; d.style.height = T + "px"; d.dataset.id = id;
      partyLayer.appendChild(d); members.push({ el: d, img: im });
    });
    placeParty();
  }
  function placeParty(faceLeft) {
    var S = HG.S;
    members.forEach(function (m, i) {
      var p = i === 0 ? { x: S.x, y: S.y } : (trail[trail.length - 1 - i] || trail[0] || { x: S.x, y: S.y });
      var off = i === 0 ? 0 : (i % 2 ? -5 : 5);
      m.el.style.transform = "translate(" + (p.x * T + off) + "px," + (p.y * T) + "px)";
      m.el.style.zIndex = p.y * 10 + 7 - i;
      var sc = i === 0 ? 1.05 : 0.9 - Math.min(i, 4) * 0.02;
      m.img.style.transform = "scale(" + sc + ")" + (faceLeft ? " scaleX(-1)" : "");
    });
    camera();
  }
  function camera() {
    var vh = view.clientHeight || 400, MH = grid.length * T, y, hudH = hudEl ? hudEl.offsetHeight + 6 : 104, avail = vh - hudH;
    if (MH <= avail) y = hudH + (avail - MH) / 2;
    else y = Math.max(vh - MH, Math.min(hudH, hudH + avail / 2 - (HG.S.y + 0.5) * T));
    mapEl.style.transform = "translateY(" + y + "px)";
    var vw = view.clientWidth || HG.root.clientWidth;
    mapEl.style.left = Math.max(0, (vw - L.cols * T) / 2) + "px";
  }
  function zoneCheck() {
    var zs = L.zones; if (!zs) return;
    var y = HG.S.y, name = "";
    for (var i = 0; i < zs.length; i++) if (y >= zs[i].from && y <= zs[i].to) name = zs[i].name;
    var cur = hudEl.querySelector(".hm-zone");
    if (name && cur.textContent !== name) {
      var first = !cur.textContent; cur.textContent = name;
      if (!first) banner(name);
    }
  }
  function banner(text) {
    var b = el("div", "hm-zbanner", text); HG.root.appendChild(b);
    requestAnimationFrame(function () { b.classList.add("on"); });
    HG.wait(1700, function () { b.classList.remove("on"); HG.wait(300, function () { if (b.parentNode) b.parentNode.removeChild(b); }); });
  }

  // ---------- Тап и ходьба ----------
  function onTap(ev) {
    if (HG.busy || !HG.alive) return;
    var r = mapEl.getBoundingClientRect();
    var x = Math.floor((ev.clientX - r.left) / T), y = Math.floor((ev.clientY - r.top) / T);
    var c = cellDef(x, y); if (!c) return;
    var e = entAt(x, y), S = HG.S, path;
    if (isBlocking(e)) {
      var goals = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(function (d) { return { x: x + d[0], y: y + d[1] }; }).filter(function (g) { return walkable(g.x, g.y); });
      if (Math.abs(S.x - x) + Math.abs(S.y - y) === 1) return interact(e);
      path = findPath(S.x, S.y, goals);
      if (!path) return HG.api.toast("Туда не пройти");
      return walk(path, e);
    }
    if (!walkable(x, y)) return;
    path = findPath(S.x, S.y, [{ x: x, y: y }]);
    if (!path) return HG.api.toast("Туда не пройти");
    walk(path, null);
  }

  // Наступили на клетку с сущностью
  function stepOn(e) {
    var S = HG.S;
    if (e.type === "coin") {
      S.coins++; S.coinDay[e.id] = S.day; HG.save(); HG.sfx("coin"); HG.haptic("light"); HG.hud(); renderEntities();
      return resume();
    }
    HG.busy = true;
    if (e.type === "buff") {
      var b = ST.BUFFS[e.buff]; S.taken[e.id] = 1; S.buffs[e.buff]++; HG.save(); renderEntities(); HG.hud();
      HG.sfx("pickup"); HG.haptic("success");
      return HG.popup({ kicker: "Сундук", img: b.icon, title: b.name + " +1", text: b.text + "." }, function () { HG.busy = false; });
    }
    if (e.type === "item") {
      S.taken[e.id] = 1; HG.save(); renderEntities();
      return HG.give(e.art, function () {
        HG.busy = false;
        if (e.art === "skate") { HG.busy = true; HG.runScene("finale", function () { HG.busy = false; }); }
      });
    }
    if (e.type === "exit") return doExit(e);
    if (e.type === "trigger") {
      if (!e.until) { S.flags["tr_" + e.id] = 1; HG.save(); }
      return HG.runScene(e.scene, function () { HG.busy = false; HG.refreshMap(); HG.hud(); HG.save(); });
    }
  }
  function resume() {}

  function walk(path, target) {
    var tok = ++moveTok, i = 0, S = HG.S;
    HG.sfx("tap");
    (function step() {
      if (tok !== moveTok || !HG.alive) return;
      if (i >= path.length) { if (target) interact(target); return; }
      var p = path[i++], dx = p.x - S.x;
      trail.push({ x: S.x, y: S.y }); if (trail.length > 12) trail.shift();
      S.x = p.x; S.y = p.y;
      placeParty(dx < 0 ? true : dx > 0 ? false : undefined);
      zoneCheck();
      var e = entAt(p.x, p.y);
      if (e && e.type === "coin") { stepOn(e); return setTimeout(step, 165); }
      if (e && (e.type === "buff" || e.type === "item" || e.type === "exit" || e.type === "trigger")) { HG.save(); return stepOn(e); }
      setTimeout(step, 165);
    })();
  }

  // ---------- Взаимодействие ----------
  function interact(e) {
    if (HG.busy) return;
    var S = HG.S;
    HG.save();
    if (e.type === "castle") { HG.busy = true; return castleMenu(); }
    if (e.type === "station") { HG.busy = true; return openGame(e); }
    if (e.type === "mob" && S.defeated[e.id]) {
      HG.busy = true; HG.curMob = e; HG.curRematch = true;
      var enc = DT.ENC[e.enc], reward = (enc.ease && enc.ease[0]) || 4;
      return HG.fightFlow(e.enc, [], function (won) {
        HG.curRematch = false; HG.curMob = null; HG.busy = false;
        if (won) { S.coins += reward; HG.api.toast("Трофеи: " + reward + " монет"); HG.sfx("coin"); }
        HG.refreshMap(); HG.hud(); HG.save();
      });
    }
    if (e.type === "mob" || e.type === "npc") {
      HG.busy = true; HG.curMob = e;
      HG.runScene(e.scene, function () { HG.busy = false; HG.curMob = null; HG.refreshMap(); HG.hud(); HG.save(); });
    }
  }

  // ---------- Выходы и перемещение ----------
  function doExit(e) {
    var S = HG.S;
    if (e.id === "loc1_down" && S.visited.loc2) {
      var opts = [];
      ["loc2", "loc3", "loc4"].forEach(function (id) {
        if (S.visited[id]) opts.push({ label: ST.LOCS[id].name, fn: function () { go(id); } });
      });
      opts.push({ label: "Остаться в замке", ghost: 1, fn: function () { HG.busy = false; S.y = 7; HG.save(); placeParty(); } });
      return menu("Куда идём?", "", opts);
    }
    function go(id) { var L2 = ST.LOCS[id]; HG.loadLoc(id, L2.spawn.x, L2.spawn.y, function () { HG.busy = false; }); }
    HG.loadLoc(e.to.loc, e.to.x, e.to.y, function () { HG.busy = false; });
  }

  HG.loadLoc = function (id, x, y, cb) {
    var S = HG.S, fade = el("div", "hm-fade");
    HG.root.appendChild(fade);
    requestAnimationFrame(function () { fade.classList.add("on"); });
    HG.wait(300, function () {
      S.loc = id; S.x = x; S.y = y; S.visited[id] = 1; trail = []; HG.save();
      build(id);
      renderParty();
      var t = document.getElementById("world-title"); if (t) t.textContent = ST.LOCS[id].name;
      hudEl.querySelector(".hm-loc").textContent = ST.LOCS[id].name;
      hudEl.querySelector(".hm-zone").textContent = "";
      zoneCheck(); HG.hud(); HG.music(id);
      fade.classList.remove("on");
      HG.wait(320, function () { if (fade.parentNode) fade.parentNode.removeChild(fade); });
      var l = ST.LOCS[id];
      if (l.onEnterOnce && !S.flags["enter_" + id]) {
        S.flags["enter_" + id] = 1; HG.save(); HG.busy = true;
        HG.wait(350, function () { HG.run(l.onEnterOnce, function () { HG.busy = false; if (cb) cb(); }); });
      } else if (cb) cb();
    });
  };

  // ---------- Замок: ночёвка ----------
  function castleMenu() {
    HG.busy = true;
    menu("Замок", "Здесь можно отдохнуть: наступит новый день, и монеты на карте появятся снова. Враги возвращаются через 2 дня, слабее и без наград-артефактов.", [
      { label: "Переночевать", fn: sleep },
      { label: "Список артефактов", ghost: 1, fn: function () { HG.artModal(castleMenu); } },
      { label: "Команда", ghost: 1, fn: function () { HG.partyModal(castleMenu); } },
      { label: "Закрыть", ghost: 1, fn: function () { HG.busy = false; } }
    ]);
  }
  function sleep() {
    var S = HG.S, o = el("div", "hm-night", "<span>Ночь в замке…</span>");
    HG.root.appendChild(o);
    requestAnimationFrame(function () { o.classList.add("on"); });
    HG.sfx("sparkle");
    HG.wait(1700, function () {
      S.day++; HG.save(); renderEntities(); HG.hud();
      o.classList.remove("on");
      HG.wait(500, function () {
        if (o.parentNode) o.parentNode.removeChild(o);
        HG.busy = false; HG.api.toast("Новый день: монеты вернулись, через 2 дня вернутся и враги");
      });
    });
  }

  // ---------- Мини-игры ----------
  function openGame(e) {
    var S = HG.S, kind = e.game, mod = window.HMini && window.HMini[kind];
    S.miniDay = S.miniDay || {};
    var last = S.miniDay[kind], left = last ? last + 2 - S.day : 0;
    if (left > 0) { HG.busy = false; return HG.api.toast("Снова можно сыграть через " + left + (left === 1 ? " день" : " дня") + " (ночуй в замке)"); }
    if ((kind === "arm" || kind === "kompy") && S.mini[kind].wins >= 3) { HG.busy = false; return HG.api.toast("Здесь уже максимум, прокачивать больше нечего"); }
    if (kind === "cups" && S.mini.cups && S.mini.cups.round >= 5) S.mini.cups = null;
    var played = false;
    function stamp() { S.miniDay[kind] = S.day; HG.save(); }
    var ov = el("div", "hm-game", '<div class="hm-game-body"></div>');
    HG.root.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });
    var body = ov.querySelector(".hm-game-body"), cleanup = null;
    function close() {
      try { if (cleanup) cleanup(); } catch (er) {}
      ov.classList.remove("on");
      HG.wait(220, function () { if (ov.parentNode) ov.parentNode.removeChild(ov); HG.busy = false; HG.save(); HG.hud(); renderEntities(); });
    }
    if (!mod) { HG.api.toast("Мини-игра не загрузилась"); return close(); }
    var api = { sfx: HG.sfx, haptic: HG.haptic, toast: HG.api.toast };
    if (kind === "cups") {
      var prev = (S.mini.cups && S.mini.cups.got && S.mini.cups.got.lump) || 0;
      cleanup = mod.play(body, {
        state: S.mini.cups, api: api,
        onChange: function (st) {
          var n = (st.got && st.got.lump) || 0;
          if (n > prev) { S.extraMoves += n - prev; prev = n; }
          S.mini.cups = st; HG.save();
        },
        onExit: function (st) { S.mini.cups = st; if (st && st.round >= 5) stamp(); close(); },
        onDone: function (st) { S.mini.cups = st; stamp(); close(); }
      });
    } else {
      var key = kind === "arm" ? "arm" : "kompy";
      cleanup = mod.play(body, {
        startWins: S.mini[key].wins, api: api,
        onWin: function (w) { played = true; S.mini[key].wins = Math.max(S.mini[key].wins, w); HG.save(); },
        onExit: function (w) { S.mini[key].wins = Math.max(S.mini[key].wins, w); if (played) stamp(); close(); },
        onDone: function (w) { S.mini[key].wins = Math.max(S.mini[key].wins, w); stamp(); close(); }
      });
    }
  }

  // ---------- Финал ----------
  HG.finish = function () {
    var S = HG.S; S.done = true; HG.save();
    HG.photo(null);
    HG.sfx("success"); HG.haptic("success");
    HG.popup({ kicker: "Конец мира", title: "Ван исцелён", text: "Все шмотки собраны, команда довольна.", btn: "Готово" }, function () {
      HG.api.complete();
    });
  };

  // ---------- Запуск ----------
  HG.start = function (container, api) {
    HG.init(container, api);
    HG.load();
    var S = HG.S;
    if (new URLSearchParams(location.search).has("reset")) { HG.reset(); S = HG.S; }
    buildHud();
    HG.busy = true;
    var wd = setInterval(function () { if (!HG.root || !HG.root.isConnected) { clearInterval(wd); HG.destroy(); } }, 800);
    window.addEventListener("resize", function () { if (HG.alive && L && view) { var s = HG.S; build(s.loc); renderParty(); } });
    var start = S.flags.prologue ? [S.loc, S.x, S.y] : ["loc1", 3, 4];
    HG.loadLoc(start[0], start[1], start[2], function () {
      if (!S.flags.prologue) {
        HG.busy = true;
        HG.runScene("prologue", function () { HG.photo(null); HG.busy = false; });
      } else HG.busy = false;
    });
  };
})();
