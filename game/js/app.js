(function () {
  "use strict";

  var CFG = window.CONFIG;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var params = new URLSearchParams(location.search);
  var DEV = params.has(CFG.DEV_PARAM);

  // ---------- Telegram ----------
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // чтобы свайп вниз не закрывал игру
      if (tg.setHeaderColor) tg.setHeaderColor("#000229");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#000229");
    } catch (e) { /* старые версии клиента */ }
  }

  function haptic(kind) {
    var h = tg && tg.HapticFeedback;
    if (!h) return;
    try {
      if (kind === "success" || kind === "error") h.notificationOccurred(kind);
      else h.impactOccurred(kind || "light");
    } catch (e) {}
  }

  // ---------- Состояние и сохранение ----------
  var state = { intro: false, done: {}, finale: false };

  function load() {
    // ?reset=1 сбрасывает весь прогресс (для проверки с начала)
    if (params.has("reset")) {
      try { ["kate_tanks_lvl", "kate_mk_lvl", "kate_heroes_v1", CFG.STORAGE_KEY].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
      if (cloudOk()) { try { tg.CloudStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
      return;
    }
    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY);
      if (raw) state = Object.assign(state, JSON.parse(raw));
    } catch (e) {}
    // Дублируем в облако Telegram (переживает смену устройства)
    // CloudStorage есть только с версии Bot API 6.9; в обычном браузере вызов бросает исключение
    if (cloudOk()) {
      try {
        tg.CloudStorage.getItem(CFG.STORAGE_KEY, function (err, val) {
          if (err || !val) return;
          try {
            var cloud = JSON.parse(val);
            var merged = mergeState(state, cloud);
            if (JSON.stringify(merged) !== JSON.stringify(state)) {
              state = merged;
              renderHub();
            }
          } catch (e) {}
        });
      } catch (e) { /* не поддерживается: работаем только с localStorage */ }
    }
  }

  function cloudOk() {
    try {
      return !!(tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9"));
    } catch (e) { return false; }
  }

  function mergeState(a, b) {
    var done = Object.assign({}, a.done, b.done);
    return { intro: a.intro || b.intro, done: done, finale: a.finale || b.finale };
  }

  function save() {
    var s = JSON.stringify(state);
    try { localStorage.setItem(CFG.STORAGE_KEY, s); } catch (e) {}
    if (cloudOk()) {
      try { tg.CloudStorage.setItem(CFG.STORAGE_KEY, s); } catch (e) {}
    }
  }

  // ---------- Утилиты ----------
  function $(id) { return document.getElementById(id); }

  var currentScreen = null;
  function show(name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
    $("screen-" + name).classList.add("active");
    currentScreen = name;
    updateBackButton();
  }

  var toastTimer;
  function toast(text) {
    var t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function updateBackButton() {
    if (!tg || !tg.BackButton) return;
    try {
      if (currentScreen === "world") tg.BackButton.show();
      else tg.BackButton.hide();
    } catch (e) { /* старый клиент: есть своя кнопка «←» на экране */ }
  }
  try {
    if (tg && tg.BackButton) tg.BackButton.onClick(function () { if (currentScreen === "world") backToHub(); });
  } catch (e) {}

  function drawStars() {
    var box = $("stars"), html = "", spark = window.ICONS ? window.ICONS.sparkle : "";
    for (var i = 0; i < 26; i++) {
      var size = 7 + Math.random() * 12;
      html += '<span class="sp" style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 100).toFixed(1) +
        '%;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;animation-delay:' +
        (Math.random() * 3.4).toFixed(2) + 's;animation-duration:' + (2.6 + Math.random() * 2.4).toFixed(2) + 's">' + spark + '</span>';
    }
    box.innerHTML = html;
  }

  // Подставляем SVG-иконки в элементы с data-icon
  function hydrateIcons() {
    var els = document.querySelectorAll("[data-icon]");
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute("data-icon");
      if (window.ICONS && window.ICONS[k]) els[i].innerHTML = window.ICONS[k];
    }
  }

  // ---------- Звук (безопасные обёртки: игра работает и без звука) ----------
  function sfx(name) { try { if (window.AUDIO) window.AUDIO.sfx(name); } catch (e) {} }

  function syncSoundBtn() {
    var muted = false;
    try { muted = window.AUDIO ? window.AUDIO.isMuted() : false; } catch (e) {}
    $("sound-btn").innerHTML = window.ICONS ? (muted ? window.ICONS.speakerOff : window.ICONS.speaker) : "";
  }
  $("sound-btn").addEventListener("click", function () {
    try { if (window.AUDIO) window.AUDIO.toggleMute(); } catch (e) {}
    syncSoundBtn();
    sfx("tap");
  });
  // Общий «тап» на кнопках (у «Старт» и порталов свои звуки)
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".btn, .icon-btn");
    if (t && t.id !== "start-btn") sfx("tap");
  });

  // ---------- Стартовый экран ----------
  // Показываем всегда: тап по «Старт» нужен, чтобы iOS разрешил звук.
  function startScreen(next) {
    show("start");
    var box = $("start-media"), cfg = CFG.INTRO || {};
    $("start-title").textContent = CFG.START_TITLE || "Привет!";
    $("start-sub").textContent = CFG.START_SUBTITLE || "";
    $("start-notice-extra").textContent =
      (tg && tg.platform === "ios") ? "" : "Похоже, это не iPhone: картинка может немного отличаться";

    var btn = $("start-btn"), notice = $("start-notice"), scene = null, shown = false;
    btn.classList.remove("visible"); notice.classList.remove("visible");

    function reveal() {
      if (shown) return; shown = true;
      btn.classList.add("visible"); notice.classList.add("visible");
    }
    function poster() {
      box.innerHTML = cfg.poster ? '<img class="poster" alt="" src="' + cfg.poster + '">' : "";
    }

    box.innerHTML = "";
    if (window.AlphaVideo && cfg.video) {
      scene = window.AlphaVideo.create(box, {
        src: cfg.video, width: cfg.width, height: cfg.height, revealAt: cfg.revealAt,
        onReveal: reveal,
        onFail: function () { poster(); setTimeout(reveal, 1200); }
      });
    } else {
      poster(); setTimeout(reveal, 1200);
    }
    setTimeout(reveal, CFG.START_BUTTON_FALLBACK_MS || 7000);

    btn.onclick = function () {
      btn.onclick = null;
      try { if (window.AUDIO) { window.AUDIO.unlock(); window.AUDIO.setBase("menu", "assets/audio/menu.mp3", 0.38); window.AUDIO.musicStart("cute"); } } catch (e) {}
      sfx("success");
      haptic("medium");
      document.body.classList.add("started");
      syncSoundBtn();
      if (scene) scene.destroy();
      next();
    };
  }

  // ---------- Ворота: обратный отсчёт (по умолчанию выключены, см. GATE_ENABLED) ----------
  var gateTimer;
  function runGate(onOpen) {
    var target = new Date(CFG.UNLOCK_AT).getTime();
    if (!CFG.GATE_ENABLED || DEV || Date.now() >= target) return onOpen();

    show("gate");
    function tick() {
      var left = target - Date.now();
      if (left <= 0) { clearInterval(gateTimer); return onOpen(); }
      var d = Math.floor(left / 864e5);
      var h = Math.floor(left % 864e5 / 36e5);
      var m = Math.floor(left % 36e5 / 6e4);
      var s = Math.floor(left % 6e4 / 1e3);
      $("countdown").innerHTML =
        cell(d, "дн") + cell(h, "ч") + cell(m, "мин") + cell(s, "сек");
    }
    function cell(v, l) { return "<div><b>" + String(v).padStart(2, "0") + "</b><span>" + l + "</span></div>"; }
    tick();
    gateTimer = setInterval(tick, 1000);
  }

  // Аватар: "kasi:happy" / "van:laugh" (портрет-эмоция), "kasi_full:welcome" (в полный рост),
  // путь к картинке или "icon:sparkle". Эмоции: happy, laugh, sad, surprise.
  // Позы: welcome, happy, sleepy, state, surprise.
  function avatarHTML(av) {
    var I = window.ICONS || {};
    av = av || "icon:sparkle";
    var m = /^(kasi|van)(_full)?:(\w+)$/.exec(av);
    if (m) {
      var dir = m[2] ? "full" : "emo";
      return '<img class="portrait ' + dir + '" alt="" src="assets/avatars/' + dir + '/' + m[1] + '_' + m[3] + '.webp">';
    }
    if (/\.(png|jpe?g|webp|gif)$/i.test(av)) return '<img class="portrait" alt="" src="' + av + '">';
    if (av.indexOf("icon:") === 0 && I[av.slice(5)]) return '<div class="av-icon">' + I[av.slice(5)] + '</div>';
    return "";
  }

  // ---------- Диалоговый движок ----------
  // lines: [{ who, text, avatar? }]; avatar — "kasi:happy", "van:laugh", путь к картинке или "icon:sparkle"
  function runDialog(lines, els, done) {
    var i = 0, typing = null, full = "";

    function showLine() {
      var line = lines[i];
      els.speaker.textContent = line.who || "";
      if (els.avatar) {
        els.avatar.innerHTML = avatarHTML(line.avatar);
      }
      full = line.text;
      els.text.textContent = "";
      els.next.textContent = i === lines.length - 1 ? (els.lastLabel || "Поехали") : "Далее";
      if (i === lines.length - 1 && els.onLast) els.onLast();
      var n = 0;
      clearInterval(typing);
      typing = setInterval(function () {
        n++;
        els.text.textContent = full.slice(0, n);
        if (n % 3 === 0) { haptic("light"); sfx("blip"); }
        if (n >= full.length) clearInterval(typing);
      }, 28);
    }

    els.next.onclick = function () {
      if (els.text.textContent.length < full.length) { // первый тап — показать всю фразу
        clearInterval(typing);
        els.text.textContent = full;
        return;
      }
      i++;
      if (i >= lines.length) { els.next.onclick = null; return done(); }
      showLine();
    };
    showLine();
  }

  window.APP = { runDialog: runDialog, avatarHTML: avatarHTML };

  // ---------- Вступление ----------
  function startIntro() {
    show("intro");
    var lines = [
      { who: "Ван", text: CFG.HER_NAME + ", привет! Ты оказалась здесь не случайно, ахуеть да?", avatar: "van:happy" },
      { who: "Кася", text: "Проспали всё нахуй!", avatar: "kasi:surprise" },
      { who: "Ван", text: "Мир разъебало на 3 игры, давай-ка чинить!", avatar: "van:laugh" },
      { who: "Кася", text: "НИХУЯ СЕБЕ, поебашили чинить тогда!", avatar: "kasi:happy" }
      // TODO: заменить на настоящий сюжет
    ];
    runDialog(lines, {
      speaker: $("intro-speaker"), text: $("intro-text"),
      avatar: $("intro-avatar"), next: $("intro-next")
    }, function () {
      state.intro = true; save();
      showHub();
    });
  }

  // ---------- Хаб ----------
  function doneCount() {
    return window.UNIVERSES.filter(function (u) { return state.done[u.id]; }).length;
  }

  function renderHub() {
    var list = window.UNIVERSES, total = list.length, n = doneCount(), I = window.ICONS || {};

    var stars = "";
    list.forEach(function (u) {
      stars += '<span class="pstar' + (state.done[u.id] ? " on" : "") + '">' + (I.sparkle || "") + '</span>';
    });
    $("hub-progress").innerHTML = stars;

    var html = "";
    list.forEach(function (u, i) {
      html += '<button class="portal' + (state.done[u.id] ? " done" : "") + '" data-id="' + u.id + '" style="--i:' + i + '">' +
        '<img class="p-img" alt="" src="' + u.banner + '">' +
        '<span class="p-shade"></span>' +
        '<span class="p-num">0' + (i + 1) + '</span>' +
        '<span class="p-done">' + (I.check || "") + '</span>' +
        '<span class="p-text"><span class="p-name">' + u.title + '</span>' +
        '<span class="p-tag">' + u.tag + '</span></span></button>';
    });
    $("portals").innerHTML = html;
  }

  function showHub() { renderHub(); show("hub"); }

  $("portals").addEventListener("click", function (e) {
    var btn = e.target.closest(".portal");
    if (!btn) return;
    haptic("medium");
    sfx("portal");
    openWorld(btn.getAttribute("data-id"));
  });

  // ---------- Мир ----------
  var activeWorld = null;
  function openWorld(id) {
    var u = window.UNIVERSES.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    activeWorld = u;
    $("world-title").textContent = u.title;
    $("world-stage").innerHTML = "";
    show("world");
    $("world-stage").style.setProperty("--c1", u.c1);
    $("world-stage").style.setProperty("--c2", u.c2);
    $("world-stage").style.setProperty("--ic", u.ic);
    u.play($("world-stage"), {
      complete: function () {
        state.done[u.id] = true; save();
        sfx("success");
        backToHub();
        if (doneCount() >= window.UNIVERSES.length) setTimeout(startFinale, 700);
        else toast("Игра пройдена: " + u.title);
      },
      toast: toast,
      haptic: haptic
    });
  }

  function backToHub() {
    activeWorld = null;
    $("world-stage").innerHTML = "";
    showHub();
  }
  $("world-back").addEventListener("click", backToHub);

  // ---------- Финал ----------
  // 1) музыка + реплика Каси в диалоге; 2) фото на фоне, реплики Вана становятся субтитрами;
  // 3) остановка на фото с тортом, салют и снова музыка меню.
  var finTimers = [], finFx = null;
  function finLater(fn, ms) { finTimers.push(setTimeout(fn, ms)); }
  function finStop() { finTimers.forEach(clearTimeout); finTimers = []; if (finFx) { finFx.stop(); finFx = null; } }

  function startFinale() {
    var F = window.FINALE;
    finStop();
    haptic("success");
    try { if (window.AUDIO) { window.AUDIO.trackStart("finish", F.music, 0.55); } } catch (e) {}
    show("intro");
    runDialog([{ who: "Кася", text: F.kasi, avatar: "kasi:happy" }], {
      speaker: $("intro-speaker"), text: $("intro-text"),
      avatar: $("intro-avatar"), next: $("intro-next"), lastLabel: "Далее"
    }, function () { runSlideshow(F); });
  }

  function runSlideshow(F) {
    show("finale");
    var box = $("fin-photos"), sub = $("fin-sub"), who = $("fin-who"), txt = $("fin-text");
    sub.classList.remove("show"); txt.textContent = ""; who.textContent = "";
    $("fin-title").classList.remove("show");
    var all = F.photos.concat([F.lastPhoto]), html = "";
    all.forEach(function (n, i) {
      var src = "assets/finale/" + n + ".webp";
      html += '<div class="fin-ph' + (i === all.length - 1 ? " last" : "") + '"><img class="bgb" alt="" src="' + src + '"><img class="main" alt="" src="' + src + '"></div>';
    });
    box.innerHTML = html;
    var slides = box.querySelectorAll(".fin-ph");
    function showPhoto(i) {
      for (var k = 0; k < slides.length; k++) slides[k].classList.toggle("on", k === i);
    }

    // Длительность каждой реплики по длине текста
    var durs = F.van.map(function (t) { return Math.max(4200, t.length * 85 + 1800); });
    var total = durs.reduce(function (a, b) { return a + b; }, 0);
    var per = total / F.photos.length;
    F.photos.forEach(function (_, i) { finLater(function () { showPhoto(i); }, i * per); });
    showPhoto(0);

    var t = 700;
    F.van.forEach(function (line, i) {
      finLater(function () {
        who.textContent = "Ван";
        txt.textContent = line;
        sub.classList.add("show");
        haptic("light");
      }, t);
      t += durs[i];
      finLater(function () { sub.classList.remove("show"); }, t - 450);
    });

    // Финальная точка: торт, салют, песня меню заново
    finLater(function () {
      showPhoto(slides.length - 1);
      haptic("success"); sfx("success");
      try { if (window.AUDIO) { window.AUDIO.setBase("menu", "assets/audio/menu.mp3", 0.38); window.AUDIO.musicStart(); } } catch (e) {}
      $("fin-title").classList.add("show");
      finFx = fireworks($("fin-fx"));
      state.finale = true; save();
    }, t + 300);
  }

  // Салют на canvas, только цвета палитры
  function fireworks(cv) {
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var COLORS = ["226,236,245", "164,167,227", "106,77,212", "170,100,180"]; // alice, wisteria, majorelle, светлый orchid
    var parts = [], run = true, last = performance.now(), nextBurst = 0;
    function size() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    window.addEventListener("resize", size);
    function burst() {
      var x = W * (0.15 + Math.random() * 0.7), y = H * (0.12 + Math.random() * 0.4);
      var c = COLORS[Math.floor(Math.random() * COLORS.length)], n = 46 + Math.floor(Math.random() * 24);
      for (var i = 0; i < n; i++) {
        var a = Math.PI * 2 * i / n + Math.random() * .2, v = 70 + Math.random() * 150;
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, dec: .45 + Math.random() * .45, c: c });
      }
      haptic("light");
    }
    function frame(now) {
      if (!run) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      nextBurst -= dt;
      if (nextBurst <= 0) { burst(); nextBurst = .45 + Math.random() * .6; }
      ctx.globalCompositeOperation = "lighter";
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.vy += 90 * dt; p.vx *= (1 - .6 * dt); p.vy *= (1 - .6 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.dec * dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = "rgba(" + p.c + "," + p.life.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * p.life + .6, 0, 6.2832); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { stop: function () { run = false; window.removeEventListener("resize", size); ctx.clearRect(0, 0, W, H); } };
  }

  // ---------- Старт ----------
  hydrateIcons();
  drawStars();
  load();
  runGate(function () {
    startScreen(function () {
      if (!state.intro) return startIntro();
      showHub();
      if (doneCount() >= window.UNIVERSES.length && !state.finale) setTimeout(startFinale, 500);
    });
  });
})();
