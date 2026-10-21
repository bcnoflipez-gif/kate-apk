// ============================================================
//  ЗВУК: эффекты и музыка, синтезируются кодом (WebAudio).
//  Плюсы: ноль файлов, нет проблем с авторскими правами, мгновенная загрузка.
//  Свои файлы (mp3/ogg) добавим позже через AUDIO.playFile().
//
//  ВАЖНО для iPhone: звук разрешается только после тапа пользователя,
//  поэтому AUDIO.unlock() вызывается на кнопке «Старт».
//  WebAudio на iOS глушится переключателем беззвучного режима, об этом предупреждаем на старте.
// ============================================================
(function () {
  "use strict";

  var ctx = null, master = null, sfxBus = null, musicBus = null;
  var KEY = "kate_bday_muted";
  var muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) {}

  var musicOn = false, musicTimer = null, nextTime = 0, step = 0, theme = "cute";

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    } catch (e) { ctx = null; }
    return ctx;
  }

  // Вызывать из обработчика тапа
  function unlock() {
    var c = ensure();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
      // Тихий буфер: окончательно «будит» аудио на iOS
      var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
  }

  function tone(freq, t, dur, type, vol, bus, glideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, vol, cutoff) {
    var n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = "lowpass"; f.frequency.value = cutoff || 1500; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
  }

  // Нотные частоты (До-мажорная пентатоника и немного сверху)
  var N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33,
            E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5 };

  var SFX = {
    tap:     function (t) { tone(N.E5, t, 0.07, "triangle", 0.35, sfxBus); },
    blip:    function (t) { tone(900 + Math.random() * 200, t, 0.03, "square", 0.08, sfxBus); },
    pop:     function (t) { tone(400, t, 0.12, "sine", 0.5, sfxBus, 900); },
    sparkle: function (t) { [N.E6, N.C6, N.G5].forEach(function (f, i) { tone(f, t + i * 0.05, 0.12, "sine", 0.22, sfxBus); }); },
    portal:  function (t) { tone(220, t, 0.55, "sawtooth", 0.14, sfxBus, 1200); tone(330, t, 0.55, "triangle", 0.2, sfxBus, 1760); },
    success: function (t) { [N.C5, N.E5, N.G5, N.C6].forEach(function (f, i) { tone(f, t + i * 0.09, 0.22, "triangle", 0.4, sfxBus); }); },
    error:   function (t) { tone(280, t, 0.14, "square", 0.22, sfxBus); tone(200, t + 0.12, 0.2, "square", 0.22, sfxBus); },
    hit:     function (t) { tone(160, t, 0.12, "square", 0.4, sfxBus, 60); },
    punch:   function (t) { noise(t, 0.07, 0.3, 2200); tone(220, t, 0.08, "square", 0.14, sfxBus, 90); },
    kick:    function (t) { noise(t, 0.1, 0.38, 1400); tone(180, t, 0.12, "sawtooth", 0.16, sfxBus, 60); },
    block:   function (t) { tone(900, t, 0.05, "square", 0.14, sfxBus); tone(1350, t + 0.03, 0.06, "triangle", 0.14, sfxBus); },
    special: function (t) { tone(180, t, 0.7, "sawtooth", 0.14, sfxBus, 1400); tone(360, t, 0.7, "triangle", 0.2, sfxBus, 2200); [N.C5, N.E5, N.G5, N.C6, N.E6].forEach(function (f, i) { tone(f, t + 0.45 + i * 0.05, 0.18, "sine", 0.18, sfxBus); }); },
    shot:    function (t) { tone(520, t, 0.07, "square", 0.16, sfxBus, 180); },
    brick:   function (t) { noise(t, 0.06, 0.22, 1800); },
    steel:   function (t) { tone(1100, t, 0.05, "square", 0.12, sfxBus); tone(780, t + 0.04, 0.05, "square", 0.1, sfxBus); },
    boom:    function (t) { noise(t, 0.34, 0.5, 700); tone(120, t, 0.3, "sawtooth", 0.3, sfxBus, 40); },
    pickup:  function (t) { [N.C5, N.E5, N.G5, N.E6].forEach(function (f, i) { tone(f, t + i * 0.06, 0.1, "square", 0.2, sfxBus); }); },
    spawn:   function (t) { tone(300, t, 0.18, "triangle", 0.18, sfxBus, 700); },
    coin:    function (t) { tone(N.G5, t, 0.07, "square", 0.25, sfxBus); tone(N.C6, t + 0.07, 0.2, "square", 0.25, sfxBus); }
  };

  function sfx(name) {
    if (muted) return;
    var c = ensure();
    if (!c || c.state !== "running") return;
    var f = SFX[name];
    if (f) try { f(c.currentTime + 0.005); } catch (e) {}
  }

  // ---------- Музыка: мягкая «музыкальная шкатулка», по темам ----------
  // Для каждого мира позже добавим свою тему (8-бит, бой, ретро и т.д.)
  var THEMES = {
    cute: {
      tempo: 0.30, leadType: "triangle", bassType: "sine",
      melody: [N.C5, N.E5, N.G5, N.A5, N.G5, N.E5, N.D5, N.E5,
               N.C5, N.E5, N.G5, N.C6, N.A5, N.G5, N.E5, N.D5],
      bass:   [N.C4, 0, N.C4, 0, N.A4 / 2, 0, N.A4 / 2, 0,
               N.G4 / 2, 0, N.G4 / 2, 0, N.C4, 0, N.G4 / 2, 0]
    },
    chip: { // 8-битный вариант для Tanks/Dendy
      tempo: 0.18, leadType: "square", bassType: "triangle",
      melody: [N.E5, 0, N.E5, N.G5, 0, N.E5, N.D5, 0, N.C5, 0, N.D5, N.E5, N.D5, 0, N.C5, 0],
      bass:   [N.C4, 0, N.C4, 0, N.G4 / 2, 0, N.G4 / 2, 0, N.A4 / 2, 0, N.A4 / 2, 0, N.G4 / 2, 0, N.G4 / 2, 0]
    }
  };

  function scheduler() {
    if (!ctx || !musicOn) return;
    var th = THEMES[theme] || THEMES.cute;
    while (nextTime < ctx.currentTime + 0.6) {
      var i = step % th.melody.length;
      if (th.melody[i]) tone(th.melody[i], nextTime, th.tempo * 1.6, th.leadType, 0.5, musicBus);
      if (th.bass[i]) tone(th.bass[i], nextTime, th.tempo * 1.8, th.bassType, 0.6, musicBus);
      nextTime += th.tempo;
      step++;
    }
  }

  // Базовый трек (меню, локации мира): musicStart() возвращает именно его, а не шкатулку
  var base = null, wanted = false, tok = 0;
  function setBase(name, url, vol, now) {
    base = name ? { name: name, url: url, vol: vol } : null;
    if (base) preload(base.name, base.url);
    if (now && wanted) musicStart();
  }
  function musicStart(name) {
    wanted = true;
    if (base && (!name || name === "cute")) {
      if (track && track.name === base.name) return;
      if (!ensure()) return;
      return trackStart(base.name, base.url, base.vol);
    }
    synthStart(name);
  }
  function musicStop() { wanted = false; tok++; trackStop(true); synthStop(); }
  function synthStart(name) {
    var c = ensure();
    if (!c) return;
    if (name && THEMES[name]) theme = name;
    if (musicOn) return;
    musicOn = true; step = 0; nextTime = c.currentTime + 0.1;
    scheduler();
    musicTimer = setInterval(scheduler, 150);
  }
  function synthStop() {
    musicOn = false;
    clearInterval(musicTimer);
  }
  function setTheme(name) {
    if (!THEMES[name] || theme === name) return;
    theme = name; step = 0;
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 1;
  }
  function toggleMute() { setMuted(!muted); return muted; }

  // Аудиофайлы (для позже добавленных озвучек и треков): AUDIO.playFile("assets/audio/x.mp3")
  function playFile(src, loop) {
    var a = new Audio(src);
    a.loop = !!loop; a.volume = muted ? 0 : 0.8;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    return a;
  }

  // Сворачиваем Telegram или блокируем экран: приостанавливаем звук
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    try {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    } catch (e) {}
  });

  // ---------- Свои файлы через WebAudio (громкость регулируется и на iPhone) ----------
  var bufs = {}, track = null;
  function loadBuffer(name, url) {
    if (bufs[name]) return bufs[name];
    var c = ensure();
    if (!c) return Promise.resolve(null);
    bufs[name] = fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); });
    }).catch(function () { bufs[name] = null; return null; });
    return bufs[name];
  }
  // Короткий звук (выстрел и т.п): vol 0..1 относительно эффектов, rate: небольшая вариация высоты
  var ready = {};
  function playSample(name, vol, rate) {
    if (muted || !ctx || ctx.state !== "running" || !ready[name]) return false;
    try {
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = ready[name]; s.playbackRate.value = rate || 1; g.gain.value = vol == null ? 0.5 : vol;
      s.connect(g); g.connect(sfxBus); s.start();
      return true;
    } catch (e) { return false; }
  }
  function preload(name, url) {
    return Promise.resolve(loadBuffer(name, url)).then(function (b) { if (b) ready[name] = b; return b; });
  }
  // Фоновый трек с плавным входом; заменяет синтезированную музыку, пока играет
  function trackStart(name, url, vol) {
    trackStop(true);
    synthStop();
    var my = ++tok;
    return preload(name, url).then(function (b) {
      if (my !== tok) return;
      if (!b || !ctx) { synthStart(); return; }
      var s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
      s.buffer = b; s.loop = true;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol == null ? 0.35 : vol, t + 1.5);
      s.connect(g); g.connect(master); s.start();
      track = { s: s, g: g, name: name };
    });
  }
  function trackStop(silent) {
    if (!track) { if (!silent) musicStart(); return; }
    var t = track; track = null;
    try {
      var now = ctx.currentTime;
      t.g.gain.cancelScheduledValues(now); t.g.gain.setValueAtTime(t.g.gain.value, now); t.g.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      t.s.stop(now + 0.6);
    } catch (e) {}
    if (!silent) musicStart();
  }

  window.AUDIO = {
    preload: preload, playSample: playSample, trackStart: trackStart, trackStop: trackStop,
    unlock: unlock, sfx: sfx, musicStart: musicStart, musicStop: musicStop, setBase: setBase, setTheme: setTheme,
    toggleMute: toggleMute, setMuted: setMuted, playFile: playFile,
    isMuted: function () { return muted; }
  };
})();
