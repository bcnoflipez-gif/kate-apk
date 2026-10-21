// ============================================================
//  HEROES OF MAGIC: интерфейсный слой (состояние, диалоги, видео, окна, раннер сцен).
//  Карта: heroes_map.js, бой: heroes_battle.js, запуск: heroes.js
// ============================================================
(function () {
  "use strict";
  var HG = window.HG = {};
  var ST = window.HStory, DT = window.HData;
  var KEY = "kate_heroes_v1";
  var IMG = "assets/heroes/";

  // ---------- Состояние ----------
  function fresh() {
    return {
      v: 1, loc: "loc1", x: 3, y: 4, day: 1,
      party: ["kasi", "van"],
      flags: {}, seen: {}, artifacts: {}, defeated: {}, taken: {}, coinDay: {},
      coins: 0, buffs: { atk: 0, def: 0, hp: 0, luck: 0, spd: 0 }, mirror: false, extraMoves: 0,
      mini: { arm: { wins: 0 }, cups: null, kompy: { wins: 0 } },
      eased: {}, assist: {}, fails: {}, visited: { loc1: 1 }, done: false
    };
  }
  HG.fresh = fresh;
  HG.load = function () {
    var s = fresh();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); for (var k in o) s[k] = o[k]; }
    } catch (e) {}
    // Самолечение: союзник, с которым уже встретились, всегда в составе
    ["miha", "denchik", "saler"].forEach(function (id) {
      if (s.flags["j_" + id] && s.party.indexOf(id) < 0 && DT.ALLY[id]) s.party.push(id);
    });
    // Прерванная встреча (триггер сгорел, а друзья не присоединились): вернуть
    if (s.flags.tr_t_meet && !(s.flags.j_miha && s.flags.j_denchik)) delete s.flags.tr_t_meet;
    HG.S = s; return s;
  };
  HG.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(HG.S)); } catch (e) {}
  };
  HG.reset = function () { try { localStorage.removeItem(KEY); } catch (e) {} HG.S = fresh(); };

  HG.flag = function (name) {
    if (!name) return true;
    var S = HG.S;
    if (name.indexOf("d_") === 0) return !!S.defeated[name.slice(2)];
    return !!S.flags[name];
  };

  // ---------- Утилиты ----------
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  HG.el = el;
  HG.sfx = function (n) { try { HG.api.sfx ? HG.api.sfx(n) : window.AUDIO && window.AUDIO.sfx(n); } catch (e) {} };
  HG.haptic = function (k) { try { HG.api.haptic(k); } catch (e) {} };
  HG.wait = function (ms, cb) { var t = setTimeout(cb, ms); HG.timers.push(t); return t; };
  HG.sprite = function (name) { return IMG + "units/" + name + ".webp"; };
  HG.img = function (path) { return IMG + path + ".webp"; };

  HG.init = function (container, api) {
    HG.api = api; HG.timers = []; HG.alive = true; HG.busy = false;
    container.innerHTML = "";
    HG.root = el("div", "hm");
    container.appendChild(HG.root);
    HG.container = container;
    HG.api2 = {
      sfx: function (n) { try { window.AUDIO && window.AUDIO.sfx(n); } catch (e) {} },
      haptic: api.haptic, toast: api.toast
    };
    HG.api.sfx = HG.api2.sfx;
  };
  // Музыка мира: базовый трек (локация или бой); видео и озвучка глушат и возвращают именно его
  HG.music = function (name) {
    try { if (window.AUDIO && window.AUDIO.setBase) window.AUDIO.setBase("h_" + name, "assets/heroes/music/" + name + ".mp3", 0.38, true); } catch (e) {}
  };
  HG.destroy = function () {
    HG.alive = false;
    (HG.timers || []).forEach(clearTimeout);
    if (HG.stopVideo) HG.stopVideo();
    try { if (window.AUDIO && window.AUDIO.setBase) { window.AUDIO.setBase("menu", "assets/audio/menu.mp3", 0.38); window.AUDIO.musicStart(); } else if (window.AUDIO) window.AUDIO.musicStart(); } catch (e) {}
    if (HG.container) HG.container.innerHTML = "";
  };

  function avatar(av) {
    av = av || "";
    var m = /^u:(.+)$/.exec(av);
    if (m) return '<img class="hm-av-sprite" alt="" src="' + HG.sprite(m[1]) + '">';
    if (window.APP && window.APP.avatarHTML) return window.APP.avatarHTML(av);
    return "";
  }

  // ---------- Фото-фон сцены ----------
  HG.photo = function (id) {
    var old = HG.root.querySelector(".hm-photo");
    if (old) old.parentNode.removeChild(old);
    if (!id) return;
    var p = el("div", "hm-photo", '<img alt="" src="' + HG.img("photos/" + id) + '">');
    HG.root.appendChild(p);
    requestAnimationFrame(function () { p.classList.add("on"); });
  };

  // ---------- Диалог ----------
  // lines: [{who, av, text}]
  HG.say = function (lines, done) {
    if (!HG.alive) return;
    var i = 0, typing = null, full = "", box = el("div", "hm-dlg");
    box.innerHTML = '<div class="hm-dlg-av"></div><div class="hm-dlg-body"><div class="hm-dlg-who"></div>' +
      '<div class="hm-dlg-text"></div><button class="btn hm-dlg-next">Далее</button></div>';
    HG.root.appendChild(box);
    var av = box.querySelector(".hm-dlg-av"), who = box.querySelector(".hm-dlg-who"),
        tx = box.querySelector(".hm-dlg-text"), nx = box.querySelector(".hm-dlg-next");
    requestAnimationFrame(function () { box.classList.add("on"); });

    function show() {
      var l = lines[i];
      who.textContent = l.who || "";
      av.innerHTML = avatar(l.av);
      av.classList.toggle("empty", !av.innerHTML);
      full = l.text; tx.textContent = "";
      nx.textContent = i === lines.length - 1 ? "Дальше" : "Далее";
      var n = 0; clearInterval(typing);
      typing = setInterval(function () {
        n++; tx.textContent = full.slice(0, n);
        if (n % 3 === 0) { HG.haptic("light"); HG.sfx("blip"); }
        if (n >= full.length) clearInterval(typing);
      }, 24);
      HG.timers.push(typing);
    }
    function step() {
      if (tx.textContent.length < full.length) { clearInterval(typing); tx.textContent = full; return; }
      i++;
      if (i >= lines.length) {
        clearInterval(typing); box.classList.remove("on");
        HG.wait(180, function () { if (box.parentNode) box.parentNode.removeChild(box); if (done) done(); });
        return;
      }
      show();
    }
    box.addEventListener("click", step);
    show();
  };

  // ---------- Выбор ----------
  HG.choose = function (options, done) {
    var box = el("div", "hm-choice");
    options.forEach(function (o, k) {
      var b = el("button", "btn hm-choice-btn" + (k ? " ghost" : ""), o.label);
      b.addEventListener("click", function () {
        HG.sfx("tap"); HG.haptic("medium");
        if (box.parentNode) box.parentNode.removeChild(box);
        done(o);
      });
      box.appendChild(b);
    });
    HG.root.appendChild(box);
    requestAnimationFrame(function () { box.classList.add("on"); });
  };

  // ---------- Видео (смотрим, один раз) ----------
  // opts: { circle, force }
  HG.video = function (id, opts, done) {
    opts = opts || {};
    var S = HG.S;
    if (S.seen[id] && !opts.force) return done && done();
    S.seen[id] = 1; HG.save();
    try { if (window.AUDIO && window.AUDIO.musicStop) window.AUDIO.musicStop(); } catch (e) {}

    var wrap = el("div", "hm-vid" + (opts.circle ? " circle" : ""));
    wrap.innerHTML = '<div class="hm-vid-frame"><video playsinline webkit-playsinline preload="auto"></video></div>' +
      '<button class="hm-vid-skip">Пропустить</button><button class="hm-vid-snd">Включить звук</button>';
    HG.root.appendChild(wrap);
    var v = wrap.querySelector("video"), skip = wrap.querySelector(".hm-vid-skip"), snd = wrap.querySelector(".hm-vid-snd");
    var finished = false;
    function end() {
      if (finished) return; finished = true;
      try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {}
      wrap.classList.remove("on");
      HG.stopVideo = null;
      HG.wait(220, function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        try { if (window.AUDIO && window.AUDIO.musicStart) window.AUDIO.musicStart(); } catch (e) {}
        if (done) done();
      });
    }
    HG.stopVideo = end;
    v.addEventListener("ended", end);
    v.addEventListener("error", function () { HG.api.toast("Видео не загрузилось"); end(); });
    skip.addEventListener("click", function () { HG.sfx("tap"); end(); });
    v.src = IMG + "video/" + id + ".mp4";
    requestAnimationFrame(function () { wrap.classList.add("on"); });
    var p = v.play();
    if (p && p.catch) p.catch(function () {
      v.muted = true;
      var q = v.play();
      if (q && q.catch) q.catch(function () { /* ждём тапа */ });
      snd.classList.add("show");
    });
    snd.addEventListener("click", function () { v.muted = false; v.currentTime = Math.max(0, v.currentTime); v.play(); snd.classList.remove("show"); });
    v.addEventListener("click", function () { if (v.paused) v.play(); });
    HG.wait(1500, function () { skip.classList.add("show"); });
  };

  // ---------- Реплика с озвучкой ----------
  HG.audioLine = function (spec, done) {
    var box = el("div", "hm-dlg");
    box.innerHTML = '<div class="hm-dlg-av"></div><div class="hm-dlg-body"><div class="hm-dlg-who"></div>' +
      '<div class="hm-dlg-text"></div><button class="btn hm-dlg-next hm-hide">Дальше</button></div>';
    HG.root.appendChild(box);
    var av = box.querySelector(".hm-dlg-av"), nx = box.querySelector(".hm-dlg-next");
    box.querySelector(".hm-dlg-who").textContent = spec.who || "";
    box.querySelector(".hm-dlg-text").textContent = spec.text || "";
    av.innerHTML = avatar(spec.av);
    requestAnimationFrame(function () { box.classList.add("on"); });
    var ready = false, a = null;
    function enable() { if (ready) return; ready = true; nx.classList.remove("hm-hide"); }
    try { if (window.AUDIO && window.AUDIO.musicStop) window.AUDIO.musicStop(); } catch (e) {}
    try {
      a = new Audio(IMG + "audio/" + spec.audio + ".mp3");
      a.addEventListener("ended", enable);
      a.addEventListener("error", function () { HG.wait(1500, enable); });
      var p = a.play(); if (p && p.catch) p.catch(function () { HG.wait(1200, enable); });
    } catch (e) { HG.wait(1500, enable); }
    HG.wait(9000, enable);
    box.addEventListener("click", function () {
      if (!ready) return;
      try { if (a) a.pause(); } catch (e) {}
      box.classList.remove("on");
      try { if (window.AUDIO && window.AUDIO.musicStart) window.AUDIO.musicStart(); } catch (e) {}
      HG.wait(180, function () { if (box.parentNode) box.parentNode.removeChild(box); if (done) done(); });
    });
  };

  // ---------- Карточка-окно ----------
  // spec: { title, text, img (путь без .webp), sprite, btn, html }
  HG.popup = function (spec, done) {
    var ov = el("div", "hm-pop");
    var media = spec.img ? '<img class="hm-pop-img" alt="" src="' + HG.img(spec.img) + '">' :
                spec.sprite ? '<img class="hm-pop-sprite" alt="" src="' + HG.sprite(spec.sprite) + '">' : "";
    ov.innerHTML = '<div class="hm-pop-card">' + (spec.kicker ? '<div class="hm-kicker">' + spec.kicker + '</div>' : "") + media +
      '<h2>' + spec.title + '</h2>' + (spec.text ? '<p>' + spec.text + '</p>' : "") + (spec.html || "") +
      '<button class="btn hm-pop-ok">' + (spec.btn || "Дальше") + '</button></div>';
    HG.root.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });
    ov.querySelector(".hm-pop-ok").addEventListener("click", function () {
      HG.sfx("tap");
      ov.classList.remove("on");
      HG.wait(180, function () { if (ov.parentNode) ov.parentNode.removeChild(ov); if (done) done(); });
    });
    return ov;
  };

  // ---------- Артефакты, команда ----------
  HG.give = function (artId, done) {
    var a = ST.ARTS[artId], S = HG.S;
    S.artifacts[artId] = 1;
    if (artId === "mirror") S.mirror = true;
    HG.save(); HG.sfx("success"); HG.haptic("success");
    if (HG.hud) HG.hud();
    HG.popup({ kicker: a.optional ? "Необязательный артефакт" : "Артефакт найден", img: a.icon, title: a.name, text: a.line, btn: "Ура" }, function () {
      HG.video(a.video, {}, done);
    });
  };

  HG.join = function (id, done) {
    var S = HG.S, b = DT.ALLY[id];
    if (S.party.indexOf(id) < 0) S.party.push(id);
    S.flags["j_" + id] = 1; HG.save();
    HG.sfx("sparkle"); HG.haptic("success");
    if (HG.hud) HG.hud();
    if (HG.refreshMap) HG.refreshMap();
    HG.popup({ kicker: "В команде", sprite: b.idle, title: b.name, text: b.desc + ". Особое умение: " + b.sp.name + "." }, done);
  };

  HG.artModal = function (done) {
    var S = HG.S, html = '<div class="hm-arts">';
    ST.MAIN.concat(["mirror"]).forEach(function (id) {
      var a = ST.ARTS[id], got = S.artifacts[id];
      html += '<div class="hm-art' + (got ? " got replay" : "") + '" data-art="' + id + '"><img alt="" src="' + HG.img(a.icon) + '"><span>' + a.name +
        (a.optional ? " (по желанию)" : "") + '</span></div>';
    });
    html += "</div>";
    var ov = HG.popup({ title: "Что нужно для Вана", text: "Собери пять шмоток, и Ван встанет на ноги. Зеркало необязательно, но пригодится в бою. Нажми на найденный артефакт, чтобы пересмотреть ролик.", html: html, btn: "Понятно" }, done);
    ov.addEventListener("click", function (ev) {
      var t = ev.target.closest && ev.target.closest(".hm-art.got");
      if (t && ST.ARTS[t.dataset.art]) { HG.sfx("tap"); HG.video(ST.ARTS[t.dataset.art].video, { force: true }); }
    });
  };

  HG.statsOf = function (id) { return DT.allyDef(id, HG.S); };

  HG.partyModal = function (done) {
    var S = HG.S, L = DT.levels(S), html = '<div class="hm-party">';
    S.party.forEach(function (id) {
      var d = DT.allyDef(id, S), b = DT.ALLY[id], lvl = "";
      if (id === "miha") lvl = "Армрестлинг: " + L.miha + "/3";
      else if (id === "van") lvl = "Компы: " + L.van + "/3";
      else if (id === "denchik") lvl = "Сила: " + (L.denchik > 0 ? "+" : "") + L.denchik + (S.extraMoves ? ", доп. ход" : "");
      else if (id === "kasi") {
        var bf = S.buffs; lvl = "Баффы: сила " + bf.atk + ", броня " + bf.def + ", здоровье " + bf.hp + ", удача " + bf.luck + ", скорость " + bf.spd;
      }
      html += '<div class="hm-pc"><img alt="" src="' + HG.sprite(b.idle) + '"><div><b>' + b.name + '</b>' +
        '<span>HP ' + d.hp + " · Атака " + Math.round(d.atk) + " · Броня " + d.def + " · Скор. " + d.spd + '</span>' +
        '<span class="sp">' + b.sp.name + ': ' + b.desc + '</span>' + (lvl ? '<span class="lv">' + lvl + '</span>' : "") + '</div></div>';
    });
    html += "</div>";
    HG.popup({ title: "Команда", html: html, btn: "Закрыть" }, done);
  };

  // ---------- Раннер сцен ----------
  // steps: массив шагов; done(ok) вызывается по окончанию (ok=false: сцена прервана поражением)
  HG.run = function (steps, done) {
    var i = 0;
    function exec(s, next) {
      if (!HG.alive) return;
      if (s.say) return HG.say(s.say, next);
      if (s.choose) return HG.choose(s.choose, function (o) { HG.run(o.then || [], function () { next(); }); });
      if (s.video) return HG.video(s.video, { circle: s.circle }, next);
      if (s.give) return HG.give(s.give, next);
      if (s.join) return HG.join(s.join, next);
      if (s.audio) return HG.audioLine(s, next);
      if (s.artlist) return HG.artModal(next);
      if (s.fight) return HG.fightFlow(s.fight, s.win || [], function (ok) { if (ok) next(); else if (done) done(false); });
      if ("photo" in s) { HG.photo(s.photo); return HG.wait(s.photo ? 350 : 120, next); }
      if (s.flag) { HG.S.flags[s.flag] = 1; HG.save(); return next(); }
      if (s.goto) { return HG.loadLoc(s.goto.loc, s.goto.x, s.goto.y, next); }
      if (s.finale) { return HG.finish(); }
      next();
    }
    function nxt() {
      if (i >= steps.length) { if (done) done(true); return; }
      exec(steps[i++], nxt);
    }
    nxt();
  };

  HG.runScene = function (name, done) {
    var sc = ST.SCENES[name];
    if (!sc) return done && done(true);
    HG.run(sc, done);
  };
})();
