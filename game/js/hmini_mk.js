// ============================================================
//  Мини-игра «Компы»: Ван в компьютерном клубе рубится с ботами (кулак, нога, блок).
//  Спрайты и приёмы из js/mk.js (assets/mk), но короче и проще: 3 матча, раунд 40 секунд.
//  window.HMini.kompy.play(container, { startWins, api, onWin, onExit, onDone }) -> cleanup()
// ============================================================
(function () {
  "use strict";
  window.HMini = window.HMini || {};

  var ROUND_TIME = 40;
  var VAN_HP = 100;
  // три матча: слабый, средний, злой-но-честный бот
  var LV = [
    { name: "БОТ_228", hue: 160, sat: 1.2, hp: 90, aggr: 0.38, block: 0.10, dmg: 0.75, think: 0.46, kickP: 0.25,
      say: "ez ez ez. Нубяра за моим компом.",
      win: "БОТ_228 вылетел из клуба. Админ доволен.", lose: "БОТ_228 написал gg ez. Обидно, да." },
    { name: "ТРАЙХАРД", hue: 250, sat: 1.2, hp: 110, aggr: 0.62, block: 0.30, dmg: 1.0, think: 0.30, kickP: 0.38,
      say: "Я тут с 2009 сижу, малой.",
      win: "Трайхард потерял свой стрик. Плачет в кулер.", lose: "Трайхард даже не вспотел. Тренируйся." },
    { name: "ЧИТЕР", hue: 95, sat: 1.4, hp: 112, aggr: 0.66, block: 0.26, dmg: 1.0, think: 0.28, kickP: 0.42,
      say: "У меня аимбот. Шучу. Или нет.",
      win: "Читера забанили прямо в матче. Ван красавчик.", lose: "Читер читерит. Но ты всё равно слил." }
  ];
  var ATK = {
    punch: { su: 0.07, ac: 0.09, rc: 0.17, dmg: 5, reach: 0.64, kb: 24, stop: 0.05, fx: "small" },
    kick: { su: 0.15, ac: 0.10, rc: 0.26, dmg: 8, reach: 0.82, kb: 48, stop: 0.09, fx: "big" }
  };
  var NAMES = ["kasi_idle", "kasi_punch", "kasi_kick", "kasi_block", "kasi_hit", "kasi_ko", "kasi_win",
    "van_idle", "van_punch", "van_kickL", "van_kickR", "van_block", "van_hit", "van_ko", "van_win",
    "text_fight", "text_ko", "text_win", "hit_small", "hit_big", "block_spark", "ko_burst", "arena_1"];
  var BOT_POSES = ["idle", "punch", "kick", "block", "hit", "ko", "win"];

  var SPR = null, SPR_META = null, loading = null;
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
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // перекрашенные копии спрайтов Каси для бота (поворот оттенка + насыщенность)
  function tintSet(hue, sat) {
    var out = {}, a = hue * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var m = [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
    BOT_POSES.forEach(function (p) {
      var im = SPR["kasi_" + p];
      if (!im || !im.naturalWidth) return;
      var k = 0.8, w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, w, h);
      try {
        var d = cx.getImageData(0, 0, w, h), px = d.data, i, r, g, b, l, nr, ng, nb;
        for (i = 0; i < px.length; i += 4) {
          if (!px[i + 3]) continue;
          r = px[i]; g = px[i + 1]; b = px[i + 2];
          nr = m[0] * r + m[1] * g + m[2] * b; ng = m[3] * r + m[4] * g + m[5] * b; nb = m[6] * r + m[7] * g + m[8] * b;
          l = 0.3 * nr + 0.59 * ng + 0.11 * nb;
          px[i] = clamp(l + (nr - l) * sat, 0, 255); px[i + 1] = clamp(l + (ng - l) * sat, 0, 255); px[i + 2] = clamp(l + (nb - l) * sat, 0, 255);
        }
        cx.putImageData(d, 0, 0);
      } catch (e) {
        cx.globalCompositeOperation = "source-atop"; cx.fillStyle = "rgba(106,77,212,.5)"; cx.fillRect(0, 0, w, h);
      }
      out[p] = cv;
    });
    return out;
  }

  function css() {
    if (document.getElementById("hmini-mk-css")) return;
    var s = document.createElement("style");
    s.id = "hmini-mk-css";
    s.textContent = [
      ".hk{position:relative;flex:1;min-height:0;width:100%;display:flex;flex-direction:column;gap:8px;padding:6px 12px 10px;box-sizing:border-box;overflow:hidden;color:var(--alice);font-family:var(--sans);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;-webkit-tap-highlight-color:transparent}",
      ".hk *{box-sizing:border-box;-webkit-user-select:none;user-select:none}",
      ".hk-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}",
      ".hk-brand{font-family:var(--serif);font-weight:600;font-size:17px;line-height:1.1}",
      ".hk-brand small{display:block;font:600 10px var(--sans);letter-spacing:.16em;color:var(--wisteria);margin-top:2px}",
      ".hk-pips{display:flex;gap:6px;align-items:center}",
      ".hk-pip{width:22px;height:6px;border-radius:4px;background:rgba(226,236,245,.18)}",
      ".hk-pip.on{background:linear-gradient(90deg,var(--wisteria),var(--alice));box-shadow:0 0 10px rgba(164,167,227,.8)}",
      ".hk-pip.cur{background:rgba(164,167,227,.5)}",
      ".hk-quit{flex:none;border:1px solid var(--line);background:var(--glass-strong);color:var(--alice);border-radius:999px;padding:7px 15px;font:600 13px var(--sans);touch-action:manipulation}",
      ".hk-mon{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}",
      ".hk-bezel{position:relative;padding:9px 9px 0;border-radius:22px 22px 14px 14px;background:linear-gradient(160deg,rgba(164,167,227,.38),rgba(106,77,212,.28) 35%,rgba(110,51,119,.45));border:1px solid rgba(164,167,227,.5);box-shadow:0 14px 40px rgba(0,2,41,.65),0 0 46px rgba(106,77,212,.32),inset 0 1px 0 rgba(226,236,245,.4)}",
      ".hk-scr{position:relative;border-radius:12px;overflow:hidden;background:var(--prussian);box-shadow:0 0 0 2px rgba(0,2,41,.85),inset 0 0 30px rgba(0,2,41,.8);animation:hkFlick 5s steps(1) infinite}",
      "@keyframes hkFlick{0%,92%,96%,100%{filter:none}94%{filter:brightness(1.12)}}",
      ".hk-scr canvas{display:block}",
      ".hk-crt{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(0,2,41,0) 0,rgba(0,2,41,0) 2px,rgba(0,2,41,.22) 3px),radial-gradient(ellipse at 50% 45%,rgba(0,2,41,0) 55%,rgba(0,2,41,.55) 100%)}",
      ".hk-roll{position:absolute;left:0;right:0;height:46px;top:-46px;pointer-events:none;background:linear-gradient(180deg,rgba(226,236,245,0),rgba(226,236,245,.06),rgba(226,236,245,0));animation:hkRoll 6.5s linear infinite}",
      "@keyframes hkRoll{to{top:105%}}",
      ".hk-chin{height:24px;display:flex;align-items:center;justify-content:space-between;padding:0 8px}",
      ".hk-led{width:7px;height:7px;border-radius:50%;background:var(--wisteria);box-shadow:0 0 8px var(--wisteria)}",
      ".hk-plate{font:700 9px var(--sans);letter-spacing:.3em;color:rgba(226,236,245,.7)}",
      ".hk-vent{width:26px;height:7px;background:repeating-linear-gradient(90deg,rgba(0,2,41,.55) 0,rgba(0,2,41,.55) 2px,transparent 2px,transparent 5px);border-radius:2px}",
      ".hk-hud{position:absolute;left:7px;right:7px;top:6px;display:flex;align-items:flex-start;gap:6px;pointer-events:none}",
      ".hk-side{flex:1;min-width:0}",
      ".hk-side.r{text-align:right}",
      ".hk-nm{display:flex;align-items:center;gap:5px;font-family:var(--serif);font-size:12px;font-weight:600;text-shadow:0 1px 4px rgba(0,2,41,.95);white-space:nowrap}",
      ".hk-side.r .hk-nm{justify-content:flex-end}",
      ".hk-nm img{width:20px;height:20px;object-fit:contain;flex:none;filter:drop-shadow(0 1px 3px rgba(0,2,41,.8))}",
      ".hk-bar{height:10px;margin-top:2px;border-radius:6px;background:rgba(0,2,41,.75);border:1px solid rgba(226,236,245,.5);overflow:hidden}",
      ".hk-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--wisteria),var(--majorelle));transition:width .14s}",
      ".hk-side.r .hk-bar i{margin-left:auto;background:linear-gradient(270deg,var(--wisteria),var(--orchid))}",
      ".hk-tm{flex:none;min-width:44px;text-align:center;padding:1px 6px 2px;margin-top:1px;border-radius:9px;background:rgba(0,2,41,.78);border:1px solid rgba(164,167,227,.6);font:700 20px/1.1 var(--serif);color:var(--alice);text-shadow:0 0 10px var(--majorelle);font-variant-numeric:tabular-nums}",
      ".hk-tm.low{color:var(--alice);background:var(--orchid);animation:hkBlink .5s steps(2) infinite}",
      "@keyframes hkBlink{50%{opacity:.55}}",
      ".hk-net{position:absolute;left:8px;bottom:5px;font:600 9px var(--sans);letter-spacing:.12em;color:rgba(226,236,245,.75);text-shadow:0 1px 3px rgba(0,2,41,.95);pointer-events:none}",
      ".hk-net b{color:var(--wisteria)}",
      ".hk-ov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:10px;background:rgba(0,2,41,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);overflow:auto}",
      ".hk-ov.on{display:flex;animation:hkPop .3s ease-out}",
      "@keyframes hkPop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}",
      ".hk-card{text-align:center;width:100%;margin:auto}",
      ".hk-card h2{font-family:var(--serif);font-size:25px;font-weight:600;line-height:1.1;margin:4px 0 6px}",
      ".hk-card p{color:var(--wisteria);font-size:14px;line-height:1.35;margin:0 2px 4px}",
      ".hk-card .btn{margin-top:12px;padding:13px 18px;font-size:16px;max-width:300px;margin-left:auto;margin-right:auto}",
      ".hk-k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--wisteria)}",
      ".hk-rows{display:flex;flex-direction:column;gap:6px;margin:10px 0 0;text-align:left}",
      ".hk-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;background:var(--glass);border:1px solid var(--line)}",
      ".hk-row .n{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font:700 13px var(--serif);background:rgba(226,236,245,.12)}",
      ".hk-row .t{flex:1;min-width:0;font:700 14px var(--sans);letter-spacing:.04em}",
      ".hk-row .t small{display:block;font:500 11px var(--sans);letter-spacing:0;color:var(--wisteria);margin-top:1px}",
      ".hk-row .st{flex:none;font:700 11px var(--sans);letter-spacing:.06em;color:var(--wisteria);display:flex;gap:2px;align-items:center}",
      ".hk-row .st svg{width:12px;height:12px}",
      ".hk-row.cur{background:linear-gradient(135deg,rgba(106,77,212,.55),rgba(110,51,119,.55));border-color:rgba(226,236,245,.5);box-shadow:0 0 18px rgba(106,77,212,.5)}",
      ".hk-row.cur .n{background:var(--alice);color:var(--prussian)}",
      ".hk-row.done{opacity:.75}.hk-row.done .n{background:var(--wisteria);color:var(--prussian)}",
      ".hk-row.lock{opacity:.4}",
      ".hk-wt{display:block;width:80%;max-width:260px;margin:0 auto 4px;filter:drop-shadow(0 0 14px rgba(106,77,212,.8))}",
      ".hk-vimg{display:block;height:min(36%,150px);max-height:150px;width:auto;margin:0 auto 4px;filter:drop-shadow(0 6px 14px rgba(0,2,41,.7))}",
      ".hk-vs{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0}",
      ".hk-vs i{font:700 22px var(--serif);font-style:normal;color:var(--wisteria)}",
      ".hk-vs img{height:96px;width:auto;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,2,41,.8))}",
      ".hk-ctl{flex:none;width:100%;max-width:440px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;height:128px;touch-action:none}",
      ".hk-move{position:relative;flex:0 0 46%;height:116px;border-radius:58px;display:flex;align-items:center;justify-content:space-around;touch-action:none;background:radial-gradient(circle,rgba(106,77,212,.28),rgba(226,236,245,.06) 75%);border:1px solid var(--line);box-shadow:inset 0 0 24px rgba(164,167,227,.18)}",
      ".hk-arrow{width:50px;height:50px;display:grid;place-items:center;border-radius:50%;color:var(--wisteria);pointer-events:none;transition:transform .06s,background .1s,color .1s}",
      ".hk-arrow svg{width:28px;height:28px}",
      ".hk-arrow.on{background:linear-gradient(135deg,var(--majorelle),var(--orchid));color:var(--alice);transform:scale(1.1);box-shadow:0 0 20px rgba(106,77,212,.7)}",
      ".hk-acts{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;height:116px;max-width:210px}",
      ".hk-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:20px;border:1px solid rgba(226,236,245,.3);color:var(--alice);font:700 11px var(--sans);letter-spacing:.04em;touch-action:none;padding:0;background:linear-gradient(135deg,var(--majorelle),var(--orchid));box-shadow:0 8px 20px rgba(0,2,41,.5);transition:transform .06s,box-shadow .1s}",
      ".hk-btn svg{width:24px;height:24px}",
      ".hk-btn.blk{grid-column:1 / 3;flex-direction:row;gap:8px;background:linear-gradient(135deg,rgba(164,167,227,.5),var(--majorelle));font-size:13px}",
      ".hk-btn.on{transform:scale(.93);box-shadow:0 3px 10px rgba(0,2,41,.5),0 0 26px rgba(164,167,227,.7)}",
      ".hk.hk-s .hk-card h2{font-size:21px}.hk.hk-s .hk-card p{font-size:13px}.hk.hk-s .hk-row{padding:5px 10px}.hk.hk-s .hk-rows{margin-top:6px;gap:4px}.hk.hk-s .hk-card .btn{margin-top:8px;padding:11px 16px}.hk.hk-s .hk-vs img{height:70px}.hk.hk-s .hk-wt{width:62%}"
    ].join("\n");
    document.head.appendChild(s);
  }

  var ICO = {
    fist: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M12 22v-6a3 3 0 0 1 6 0v-3a3 3 0 0 1 6 0v-1a3 3 0 0 1 6 0v2a3 3 0 0 1 6 0v14c0 7-5 11-11 11-7 0-13-4-13-11z"/></svg>',
    boot: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M16 8h10v14l12 5c3 1 4 3 4 6v3H12V8z"/><path d="M12 34h30"/></svg>',
    shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M24 6l14 5v11c0 9-6 16-14 20C16 38 10 31 10 22V11z"/></svg>',
    star: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4c1 10 4 17 20 20-16 3-19 10-20 20-1-10-4-17-20-20 16-3 19-10 20-20z"/></svg>',
    left: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M30 10L16 24l14 14"/></svg>',
    right: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10l14 14-14 14"/></svg>'
  };

  function play(container, opts) {
    opts = opts || {};
    var api = opts.api || {};
    var AUD = window.AUDIO || {};
    function sfx(n) { try { if (api.sfx) api.sfx(n); } catch (e) {} }
    function haptic(k) { try { if (api.haptic) api.haptic(k); } catch (e) {} }
    function voice(name, vol, rate) { try { if (AUD.playSample) AUD.playSample(name, vol, rate || 1); } catch (e) {} }
    try {
      if (AUD.preload) {
        AUD.preload("mk_van_hit", "assets/audio/mk_van_hit.mp3");
        AUD.preload("mk_kasi_hit", "assets/audio/mk_kasi_hit.mp3");
        AUD.preload("mk_kasi_ko", "assets/audio/mk_kasi_ko.mp3");
      }
    } catch (e) {}

    var alive = true, raf = 0, timers = [], listeners = [], doneFired = false, ro = null;
    var wins = clamp(parseInt(opts.startWins, 10) || 0, 0, 3);

    function later(fn, ms) {
      var id = setTimeout(function () {
        var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
        if (alive) fn();
      }, ms);
      timers.push(id); return id;
    }
    function on(target, type, fn, o) { target.addEventListener(type, fn, o); listeners.push([target, type, fn, o]); }

    css();
    container.innerHTML = '<div class="hk"><div class="hk-mon"><div class="hk-card"><p>Загрузка…</p></div></div></div>';

    var wrap, scr, cv, ctx, ov, hud = {}, mvEl, al, ar, topEl, ctlEl, netEl;
    var W = 340, H = 380, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var g = null, ctl = { mv: 0, block: false, buf: null }, phase = "lobby", lastTs = 0;
    var Hf = 150, floorY = 300, sc = 0.27, arenaOff = 0, arenaH = 600;
    var matchIdx = 0, botSet = null, botFor = -1, fast = false;

    loadAll().then(function () {
      if (!alive) return;
      build();
      if (wins >= 3) { matchIdx = 2; prepare(2); phase = "victory"; showVictory(); }
      else { matchIdx = wins; prepare(matchIdx); phase = "lobby"; showLobby(); }
      raf = requestAnimationFrame(loop);
    });

    // ---------- Каркас ----------
    function build() {
      container.innerHTML =
        '<div class="hk" id="hk-root">' +
        '<div class="hk-top"><div class="hk-brand">Компы<small>CLUB // ПК-07</small></div><div class="hk-pips" id="hk-pips"></div><button class="hk-quit" id="hk-quit" type="button">Выйти</button></div>' +
        '<div class="hk-mon"><div class="hk-bezel"><div class="hk-scr" id="hk-scr"><canvas id="hk-cv"></canvas>' +
        '<div class="hk-hud">' +
        '<div class="hk-side"><div class="hk-nm"><img src="assets/avatars/emo/van_laugh.webp" alt=""><span>ВАН</span></div><div class="hk-bar"><i id="hk-hv"></i></div></div>' +
        '<div class="hk-tm" id="hk-tm">40</div>' +
        '<div class="hk-side r"><div class="hk-nm"><span id="hk-bn">БОТ</span><img id="hk-bi" src="assets/avatars/emo/kasi_happy.webp" alt=""></div><div class="hk-bar"><i id="hk-hb"></i></div></div>' +
        '</div><div class="hk-net" id="hk-net"></div><div class="hk-crt"></div><div class="hk-roll"></div><div class="hk-ov" id="hk-ov"></div></div>' +
        '<div class="hk-chin"><i class="hk-led"></i><span class="hk-plate">CLUB</span><i class="hk-vent"></i></div></div></div>' +
        '<div class="hk-ctl" id="hk-ctl"><div class="hk-move" id="hk-move"><div class="hk-arrow" id="hk-al">' + ICO.left + '</div><div class="hk-arrow" id="hk-ar">' + ICO.right + '</div></div>' +
        '<div class="hk-acts"><button class="hk-btn" id="hk-p" type="button" tabindex="-1">' + ICO.fist + '<span>Рука</span></button>' +
        '<button class="hk-btn" id="hk-k" type="button" tabindex="-1">' + ICO.boot + '<span>Нога</span></button>' +
        '<button class="hk-btn blk" id="hk-b" type="button" tabindex="-1">' + ICO.shield + '<span>Блок</span></button></div></div></div>';
      var $ = function (id) { return container.querySelector("#" + id); };
      wrap = $("hk-root"); scr = $("hk-scr"); cv = $("hk-cv"); ctx = cv.getContext("2d"); ov = $("hk-ov");
      hud.hv = $("hk-hv"); hud.hb = $("hk-hb"); hud.tm = $("hk-tm"); hud.bn = $("hk-bn"); hud.bi = $("hk-bi");
      netEl = $("hk-net"); topEl = container.querySelector(".hk-top"); ctlEl = $("hk-ctl");
      mvEl = $("hk-move"); al = $("hk-al"); ar = $("hk-ar");
      pips();

      on($("hk-quit"), "click", function () { sfx("tap"); var w = wins; cleanup(); if (opts.onExit) opts.onExit(w); });

      // управление пальцами
      var mvId = null;
      function moveFrom(e) {
        var r = mvEl.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2);
        ctl.mv = Math.abs(x) < r.width * 0.06 ? 0 : (x < 0 ? -1 : 1);
        al.classList.toggle("on", ctl.mv < 0); ar.classList.toggle("on", ctl.mv > 0);
      }
      on(mvEl, "pointerdown", function (e) { e.preventDefault(); mvId = e.pointerId; try { mvEl.setPointerCapture(e.pointerId); } catch (x) {} moveFrom(e); });
      on(mvEl, "pointermove", function (e) { if (e.pointerId === mvId) moveFrom(e); });
      function mvEnd(e) { if (e.pointerId !== mvId) return; mvId = null; ctl.mv = 0; al.classList.remove("on"); ar.classList.remove("on"); }
      on(mvEl, "pointerup", mvEnd); on(mvEl, "pointercancel", mvEnd);
      function bindBtn(id, down, up) {
        var b = $(id), pid = null;
        on(b, "pointerdown", function (e) { e.preventDefault(); if (pid !== null) return; pid = e.pointerId; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (x) {} down(); });
        function end(e) { if (e.pointerId !== pid) return; pid = null; b.classList.remove("on"); if (up) up(); }
        on(b, "pointerup", end); on(b, "pointercancel", end);
      }
      bindBtn("hk-p", function () { press("punch"); });
      bindBtn("hk-k", function () { press("kick"); });
      bindBtn("hk-b", function () { ctl.block = true; }, function () { ctl.block = false; });
      on(ctlEl, "touchmove", function (e) { e.preventDefault(); }, { passive: false });
      on(wrap, "contextmenu", function (e) { e.preventDefault(); });

      // клавиатура (по коду клавиши, чтобы работало и в русской раскладке)
      var keys = {};
      function sync() {
        ctl.mv = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
        ctl.block = !!(keys.KeyL || keys.KeyS || keys.ArrowDown);
      }
      on(window, "keydown", function (e) {
        var c = e.code;
        if (/^Arrow/.test(c) || c === "Space") e.preventDefault();
        if (e.repeat) return;
        keys[c] = true; sync();
        if (c === "KeyJ") press("punch"); else if (c === "KeyK") press("kick");
      });
      on(window, "keyup", function (e) { keys[e.code] = false; sync(); });
      on(window, "blur", function () { keys = {}; sync(); });

      on(window, "resize", layout);
      if (window.ResizeObserver) { ro = new ResizeObserver(function () { layout(); }); ro.observe(container); }
      layout();
    }

    function pips() {
      var p = container.querySelector("#hk-pips"); if (!p) return;
      var h = "";
      for (var i = 0; i < 3; i++) h += '<i class="hk-pip' + (i < wins ? " on" : (i === wins ? " cur" : "")) + '"></i>';
      p.innerHTML = h;
    }

    function layout() {
      if (!wrap) return;
      var cw = wrap.clientWidth || container.clientWidth || 360, chh = wrap.clientHeight || container.clientHeight || 640;
      if (chh < 300) chh = 620;
      var oldW = W;
      var avail = chh - topEl.offsetHeight - ctlEl.offsetHeight - 16 - 9 - 24 - 4;
      W = Math.round(clamp(cw - 24 - 18, 240, 400));
      H = Math.round(clamp(avail, 250, W * 1.45));
      cv.style.width = W + "px"; cv.style.height = H + "px";
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      scr.style.width = W + "px"; scr.style.height = H + "px";
      wrap.classList.toggle("hk-s", H < 340);
      if (g) { metrics(); if (oldW && oldW !== W) { g.v.x *= W / oldW; g.b.x *= W / oldW; } }
    }

    function metrics() {
      var sh = W * (1376 / 768), fl = 0.79 * sh, want = 0.8 * H;
      arenaOff = clamp(fl - want, 0, Math.max(0, sh - H)); arenaH = sh;
      floorY = fl - arenaOff;
      Hf = Math.min(H * 0.4, W * 0.5); sc = Hf / 560;
    }

    // ---------- Матч ----------
    function newF(who, x, face, hp) {
      return { who: who, x: x, face: face, hp: hp, max: hp, state: "idle", t: 0, vx: 0, mv: 0, block: false, atk: null,
        hitDone: false, alt: 0, bt: 0, think: 0.7, cd: 0, boost: 1, wob: Math.random() * 6 };
    }
    function prepare(i) {
      matchIdx = i;
      var L = LV[i];
      if (botFor !== i) { botSet = tintSet(L.hue, L.sat); botFor = i; }
      g = { v: null, b: null, fx: [], parts: [], stop: 0, ts: 1, shake: 0, flash: 0, time: 0, textT: 0, text: null, koT: 0, won: null,
        left: ROUND_TIME, glitch: 0, why: "", over: 0 };
      metrics();
      g.v = newF("van", W * 0.3, 1, VAN_HP);
      g.b = newF("kasi", W * 0.7, -1, L.hp);
      for (var n = 0; n < 16; n++) g.parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.2, 3), s: rnd(6, 16), ph: rnd(0, 6) });
      hud.bn.textContent = L.name;
      hud.bi.style.filter = "hue-rotate(" + L.hue + "deg) saturate(" + L.sat + ")";
      updateHud();
      pips();
    }
    function updateHud() {
      hud.hv.style.width = Math.max(0, g.v.hp / g.v.max * 100) + "%";
      hud.hb.style.width = Math.max(0, g.b.hp / g.b.max * 100) + "%";
      var t = Math.max(0, Math.ceil(g.left));
      if (hud.tm.textContent !== String(t)) hud.tm.textContent = t;
      hud.tm.classList.toggle("low", g.left <= 10 && g.left > 0 && phase === "play");
    }
    function showOv(html) { ov.innerHTML = html; ov.classList.add("on"); ov.scrollTop = 0; }
    function hideOv() { ov.classList.remove("on"); }
    function starSvg(n) {
      var s = "";
      for (var i = 0; i < n; i++) s += ICO.star;
      return s;
    }

    function showLobby() {
      phase = "lobby"; ctl.mv = 0; ctl.block = false;
      var rows = "";
      for (var i = 0; i < 3; i++) {
        var cls = i < wins ? "done" : (i === wins ? "cur" : "lock");
        rows += '<div class="hk-row ' + cls + '"><span class="n">' + (i + 1) + '</span><span class="t">' + LV[i].name + '<small>' +
          (i < wins ? "слит" : (i === wins ? LV[i].say : "ждёт своей очереди")) + '</small></span><span class="st">' + starSvg(i + 1) + '</span></div>';
      }
      showOv('<div class="hk-card"><div class="hk-k">Компьютерный клуб</div><h2>Матч ' + (wins + 1) + ' из 3</h2>' +
        '<p>Ван сел за свободный комп. Осталось слить ботов.</p><div class="hk-rows">' + rows + '</div>' +
        '<button class="btn" id="hk-go" type="button">В бой</button></div>');
      var go = ov.querySelector("#hk-go");
      go.onclick = function () { sfx("tap"); startIntro(); };
    }

    function startIntro() {
      prepare(wins);
      phase = "intro";
      var L = LV[wins];
      showOv('<div class="hk-card"><div class="hk-k">Матч ' + (wins + 1) + ' из 3</div><div class="hk-vs"><img src="assets/mk/van_idle.webp" alt=""><i>VS</i><img id="hk-vsb" alt=""></div>' +
        '<h2>' + L.name + '</h2><p>' + L.say + '</p></div>');
      var vb = ov.querySelector("#hk-vsb");
      try { vb.src = botSet.idle.toDataURL(); } catch (e) { vb.src = "assets/mk/kasi_idle.webp"; }
      sfx("pickup");
      later(function () { hideOv(); phase = "fight"; g.textT = 0; g.text = "fight"; sfx("blip"); }, fast ? 0 : 1500);
    }

    // ---------- Бой ----------
    function reachOf(f, kind) {
      var r = ATK[kind].reach * Hf;
      if (f.who === "kasi" && kind === "kick") r *= 1.12; // у бота ноги Каси
      return r;
    }
    function other(f) { return f === g.v ? g.b : g.v; }
    function busy(f) { return f.state !== "idle" && f.state !== "block"; }

    function startAttack(f, kind) {
      f.state = kind; f.t = 0; f.hitDone = false; f.atk = ATK[kind]; f.mv = 0; f.cd = 0;
      if (f.who === "van" && kind === "kick") f.alt ^= 1;
      sfx(kind === "kick" ? "kick" : "punch");
    }
    function hurt(att, def, dmg, o) {
      var blocked = def.state === "block" && def.face === -att.face;
      var hx = def.x - att.face * Hf * 0.12, hy = floorY - Hf * 0.55;
      if (blocked) {
        dmg = Math.max(0.8, dmg * 0.15);
        def.x += att.face * 10;
        g.fx.push({ img: "block_spark", x: hx, y: hy, t: 0, dur: 0.28, s: Hf * 0.5 });
        g.stop = 0.04; g.shake = 2; sfx("block");
      } else {
        def.state = "hit"; def.t = 0; def.atk = null; def.vx = att.face * o.kb * 7;
        g.fx.push({ img: o.fx === "big" ? "hit_big" : "hit_small", x: hx, y: hy, t: 0, dur: 0.3, s: Hf * (o.fx === "big" ? 0.8 : 0.55) });
        g.stop = o.stop; g.shake = o.fx === "big" ? 6 : 3; g.flash = o.fx === "big" ? 0.14 : 0.06;
        for (var i = 0; i < 6; i++) g.parts.push({ burst: true, x: hx, y: hy, vx: rnd(-150, 150), vy: rnd(-170, 60), t: 0, life: rnd(0.3, 0.55) });
        sfx(o.fx === "big" ? "hit" : "punch");
        voice(def.who === "kasi" ? "mk_kasi_hit" : "mk_van_hit", 0.45, def.who === "kasi" ? rnd(0.75, 0.85) : rnd(0.95, 1.08));
        haptic(def.who === "van" ? "medium" : "light");
        if (def.who === "kasi") g.glitch = 0.35;
      }
      def.hp = Math.max(0, def.hp - dmg);
      updateHud();
      if (def.hp <= 0) koFighter(def);
    }
    function koFighter(def) {
      if (phase === "ko" || phase === "done") return;
      var win = other(def);
      def.state = "ko"; def.t = 0; def.vx = -def.face * 140; def.block = false; def.mv = 0;
      win.state = "win"; win.t = 0; win.mv = 0; win.block = false; win.vx = 0;
      phase = "ko"; g.koT = 0; g.ts = 0.35; g.text = "ko"; g.textT = 0; g.won = win.who; g.why = "ko";
      g.fx.push({ img: "ko_burst", x: def.x, y: floorY - Hf * 0.45, t: 0, dur: 0.9, s: Hf * 1.5 });
      g.flash = 0.3; g.shake = 9;
      sfx("special");
      if (def.who === "kasi") voice("mk_kasi_ko", 0.5, 0.8);
      haptic(def.who === "kasi" ? "success" : "error");
    }
    function timeUp() {
      var pv = g.v.hp / g.v.max, pb = g.b.hp / g.b.max;
      phase = "ko"; g.koT = 0; g.why = "time"; g.text = "time"; g.textT = 0;
      g.v.mv = g.b.mv = 0; g.v.block = g.b.block = false;
      ctl.buf = null;
      if (Math.abs(pv - pb) < 0.0005) { g.won = "draw"; g.v.state = g.b.state = "idle"; sfx("error"); return; }
      var w = pv > pb ? g.v : g.b, l = other(w);
      g.won = w.who;
      w.state = "win"; w.t = 0; l.state = "lose"; l.t = 0;
      sfx("special"); haptic(w === g.v ? "success" : "error");
    }

    function updateFighter(f, dt) {
      var o = other(f);
      f.t += dt;
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
            if (dx > 0 && dx < reachOf(f, kind) && o.state !== "ko" && phase !== "ko" && phase !== "done") {
              f.hitDone = true;
              hurt(f, o, a.dmg * (f.who === "kasi" ? LV[matchIdx].dmg : 1), { kb: a.kb, stop: a.stop, fx: a.fx });
            }
          }
          if (tt >= a.su + a.ac + a.rc) { f.cd = (a === ATK.kick ? 0.36 : 0.24) + (f.hitDone ? 0 : 0.2); f.state = "idle"; f.atk = null; }
          break;
        case "hit":
          f.x += f.vx * dt; f.vx *= Math.pow(0.0006, dt);
          if (f.t > 0.34) { f.state = "idle"; f.vx = 0; }
          break;
        case "ko": f.x += f.vx * dt; f.vx *= Math.pow(0.002, dt); break;
      }
      var m = Hf * 0.3;
      f.x = clamp(f.x, m, W - m);
      if (f.state !== "ko") {
        var minD = Hf * 0.52, d = o.x - f.x;
        if (Math.abs(d) < minD && o.state !== "ko") {
          var push = (minD - Math.abs(d)) / 2, dirp = d >= 0 ? -1 : 1;
          f.x += dirp * push; o.x -= dirp * push;
          f.x = clamp(f.x, m, W - m); o.x = clamp(o.x, m, W - m);
        }
      }
    }

    function aiUpdate(dt) {
      var b = g.b, v = g.v, L = LV[matchIdx];
      if (b.state !== "idle" && b.state !== "block") return;
      b.bt -= dt; b.think -= dt;
      if (b.bt <= 0 && b.block) b.block = false;
      if (b.think > 0) return;
      b.think = L.think * rnd(0.7, 1.3);
      var d = Math.abs(v.x - b.x), toward = v.x > b.x ? 1 : -1;
      var vAtt = (v.state === "punch" || v.state === "kick");
      b.mv = 0; b.boost = 1;
      if (vAtt && d < Hf * 1.0 && Math.random() < L.block) { b.block = true; b.bt = rnd(0.3, 0.6); return; }
      if (b.block && b.bt > 0) return;
      if (d > Hf * 0.62) { b.mv = toward; b.boost = d < Hf * 1.1 ? 1.4 : 1; }
      else {
        var r = Math.random();
        if (r < L.aggr) startAttack(b, Math.random() < L.kickP ? "kick" : "punch");
        else if (r < L.aggr + 0.15) b.mv = -toward;
      }
    }

    function press(a) { ctl.buf = { a: a, t: 0.12 }; }
    function playerUpdate(dt) {
      var v = g.v;
      v.block = ctl.block && !busy(v);
      if (!busy(v)) v.mv = ctl.block ? 0 : ctl.mv; else v.mv = 0;
      if (ctl.buf) {
        ctl.buf.t -= dt;
        if (ctl.buf.t <= 0) ctl.buf = null;
        else if (!busy(v) && !(v.cd > 0)) { var a = ctl.buf.a; ctl.buf = null; startAttack(v, a); }
      }
    }

    function update(dt) {
      g.time += dt;
      if (phase === "play") {
        playerUpdate(dt); aiUpdate(dt);
        g.left -= dt;
        if (g.left <= 0) { g.left = 0; updateFighter(g.v, dt); updateFighter(g.b, dt); updateHud(); timeUp(); return; }
      }
      updateFighter(g.v, dt); updateFighter(g.b, dt);
      updateHud();
    }

    // ---------- Отрисовка ----------
    function poseOf(f) {
      var s = f.state, w = f.who;
      if (s === "punch") return "punch";
      if (s === "kick") return w === "van" ? (f.alt ? "kickR" : "kickL") : "kick";
      if (s === "block") return "block";
      if (s === "hit" || s === "lose") return "hit";
      if (s === "ko") return "ko";
      if (s === "win") return "win";
      return "idle";
    }
    function drawFighter(f) {
      var pose = poseOf(f), who = f.who, meta = (SPR_META[who] || {})[pose];
      var im = who === "kasi" ? (botSet && botSet[pose]) : SPR["van_" + pose];
      if (!im || !meta) return;
      var wpx = meta.w * sc, hpx = meta.h * sc, ax = meta.ax * sc;
      ctx.fillStyle = "rgba(0,2,41,.38)";
      ctx.beginPath(); ctx.ellipse(f.x, floorY + 3, Hf * (f.state === "ko" ? 0.36 : 0.26), Hf * 0.04, 0, 0, 6.283); ctx.fill();
      var bob = 0, sy = 1;
      if (f.state === "idle" || f.state === "block") { sy = 1 + Math.sin(g.time * 4 + f.wob) * 0.012; if (f.mv) bob = -Math.abs(Math.sin(g.time * 12)) * 3; }
      if (f.state === "win") bob = -Math.abs(Math.sin(g.time * 7)) * 5;
      var passes = (who === "kasi" && g.glitch > 0) ? 3 : 1;
      for (var p = 0; p < passes; p++) {
        ctx.save();
        var gx = 0;
        if (p > 0) { ctx.globalAlpha = 0.45; gx = (p === 1 ? -1 : 1) * rnd(3, 7); }
        ctx.translate(f.x + gx, floorY + bob);
        ctx.scale(f.face, sy);
        if (f.state === "hit") ctx.rotate(-0.04);
        ctx.drawImage(im, -ax, -hpx, wpx, hpx);
        ctx.restore();
      }
      if (who === "kasi" && g.glitch > 0 && Math.random() < 0.6) {
        // «пиксельный сбой»: срез спрайта со сдвигом
        var sy0 = floorY - hpx * rnd(0.2, 0.9), sh2 = rnd(4, 10);
        ctx.save(); ctx.beginPath(); ctx.rect(0, sy0, W, sh2); ctx.clip();
        ctx.translate(f.x + rnd(-8, 8), floorY + bob); ctx.scale(f.face, 1); ctx.drawImage(im, -ax, -hpx, wpx, hpx); ctx.restore();
      }
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
      var ar = SPR.arena_1;
      if (ar && ar.naturalWidth) ctx.drawImage(ar, 0, -arenaOff, W, arenaH);
      ctx.fillStyle = "rgba(226,236,245,.55)";
      g.parts.forEach(function (p) {
        if (p.burst) return;
        var yy = (p.y - g.time * p.s) % H; if (yy < 0) yy += H;
        ctx.globalAlpha = 0.2 + 0.3 * Math.abs(Math.sin(g.time * 1.5 + p.ph));
        sparkle(ctx, p.x + Math.sin(g.time + p.ph) * 8, yy, p.r);
      });
      ctx.globalAlpha = 1;
      var order = (g.v.state === "punch" || g.v.state === "kick" || g.v.state === "win") ? [g.b, g.v] : [g.v, g.b];
      order.forEach(drawFighter);
      ctx.globalCompositeOperation = "lighter";
      g.fx.forEach(function (e) {
        var p = e.t / e.dur, s = e.s * (0.55 + 0.6 * Math.min(1, p * 1.4));
        ctx.globalAlpha = Math.max(0, 1 - p * p);
        ctx.drawImage(SPR[e.img], e.x - s / 2, e.y - s / 2, s, s);
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      g.parts.forEach(function (p) {
        if (!p.burst) return;
        ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = "#E2ECF5"; sparkle(ctx, p.x, p.y, 3.2);
      });
      ctx.globalAlpha = 1;
      if (g.flash > 0) { ctx.fillStyle = "rgba(226,236,245," + Math.min(0.5, g.flash) + ")"; ctx.fillRect(0, 0, W, H); }
      if (g.text === "fight" || g.text === "ko") {
        var key = g.text === "fight" ? "text_fight" : "text_ko", im2 = SPR[key], tm = SPR_META[key];
        var dur = g.text === "fight" ? 1.1 : 99, tt = g.textT;
        if (im2 && tm && tt < dur) {
          var pop = easeOutBack(Math.min(1, tt / 0.35)), tw = W * 0.8 * pop, th = tw * tm.h / tm.w;
          ctx.globalAlpha = g.text === "fight" ? clamp((dur - tt) / 0.3, 0, 1) : 1;
          ctx.drawImage(im2, W / 2 - tw / 2, H * 0.3 - th / 2, tw, th); ctx.globalAlpha = 1;
        }
      } else if (g.text === "time") {
        var pp = easeOutBack(Math.min(1, g.textT / 0.35));
        ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.scale(pp, pp);
        ctx.font = "700 " + Math.round(W * 0.15) + "px ui-serif, Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 6; ctx.strokeStyle = "#6A4DD4"; ctx.lineJoin = "round"; ctx.strokeText(g.won === "draw" ? "НИЧЬЯ" : "ВРЕМЯ", 0, 0);
        ctx.fillStyle = "#E2ECF5"; ctx.fillText(g.won === "draw" ? "НИЧЬЯ" : "ВРЕМЯ", 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    var pingT = 0;
    function loop(ts) {
      if (!alive) return;
      var rdt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
      step(rdt);
      raf = requestAnimationFrame(loop);
    }
    function step(rdt, noDraw) {
      g.textT += rdt;
      if (g.stop > 0) g.stop -= rdt;
      else if (phase === "play" || phase === "ko" || phase === "fight") {
        var dt = rdt * g.ts;
        if (phase === "fight") { updateFighter(g.v, dt); updateFighter(g.b, dt); g.time += dt; if (g.textT > 0.9) phase = "play"; }
        else update(dt);
      } else g.time += rdt;
      for (var i = g.fx.length - 1; i >= 0; i--) { g.fx[i].t += rdt; if (g.fx[i].t > g.fx[i].dur) g.fx.splice(i, 1); }
      for (var j = g.parts.length - 1; j >= 0; j--) { var p = g.parts[j]; if (p.burst) { p.t += rdt; p.x += p.vx * rdt; p.y += p.vy * rdt; p.vy += 400 * rdt; if (p.t > p.life) g.parts.splice(j, 1); } }
      g.shake = Math.max(0, g.shake - rdt * 30); g.flash = Math.max(0, g.flash - rdt * 1.6); g.glitch = Math.max(0, g.glitch - rdt);
      pingT -= rdt;
      if (pingT <= 0 && netEl) { pingT = 0.8; netEl.innerHTML = 'PING <b>' + Math.round(rnd(9, 34)) + '</b> ms &nbsp; МАТЧ <b>' + (matchIdx + 1) + '/3</b>'; }
      if (phase === "ko") {
        g.koT += rdt;
        if (g.why === "ko" && g.koT > 1.6 && g.ts < 1) g.ts = Math.min(1, g.ts + rdt);
        if (g.koT > (g.why === "ko" ? 2.1 : 1.7)) endRound();
      }
      if (!noDraw && !fast) draw();
    }

    // ---------- Итоги ----------
    function endRound() {
      if (phase === "done") return;
      phase = "done"; ctl.mv = 0; ctl.block = false; ctl.buf = null;
      var L = LV[matchIdx], tail = g.why === "time" ? " По времени, но кого это волнует." : "";
      if (g.won === "van") {
        wins = Math.max(wins, matchIdx + 1);
        sfx("success"); pips();
        showOv('<div class="hk-card"><img class="hk-wt" src="assets/mk/text_win.webp" alt=""><div class="hk-k">Матч ' + wins + ' из 3 пройден</div><p>' + L.win + tail + '</p>' +
          '<button class="btn" id="hk-nx" type="button">' + (wins >= 3 ? "Дальше" : "Следующий комп") + '</button></div>');
        ov.querySelector("#hk-nx").onclick = function () {
          sfx("tap");
          if (wins >= 3) { phase = "victory"; showVictory(); } else { prepare(wins); showLobby(); }
        };
        try { if (opts.onWin) opts.onWin(wins); } catch (e) { try { console.error(e); } catch (x) {} }
      } else {
        sfx("error");
        var head = g.won === "draw" ? "Ничья. Бот лагает" : "Ван подахуел";
        var txt = g.won === "draw" ? "Никто никого не победил, а таймер идёт. Давай ещё раз." : L.lose + (g.why === "time" ? " Бот просто оказался бодрее." : "");
        showOv('<div class="hk-card"><div class="hk-k">Матч ' + (matchIdx + 1) + ' из 3</div><h2>' + head + '</h2><p>' + txt + '</p>' +
          '<button class="btn" id="hk-rt" type="button">Ещё раз</button></div>');
        ov.querySelector("#hk-rt").onclick = function () { sfx("tap"); startIntroQuick(); };
      }
    }
    function startIntroQuick() {
      // повтор без экрана выбора: сразу в бой
      prepare(wins); hideOv(); phase = "fight"; g.textT = 0; g.text = "fight"; sfx("blip");
    }
    function showVictory() {
      if (wins < 3) wins = 3;
      pips();
      showOv('<div class="hk-card"><img class="hk-vimg" src="assets/mk/van_win.webp" alt=""><div class="hk-k">Клуб зачищен</div><h2>Все боты слиты</h2>' +
        '<p>Ван стал сильнее: +' + wins + '</p><button class="btn" id="hk-fin" type="button">Забрать</button></div>');
      sfx("sparkle"); haptic("success");
      ov.querySelector("#hk-fin").onclick = function () {
        if (doneFired) return; doneFired = true; sfx("tap");
        var w = wins; cleanup();
        if (opts.onDone) opts.onDone(w);
      };
    }

    // ---------- Очистка ----------
    function cleanup() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); timers.length = 0;
      listeners.forEach(function (l) { try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e) {} });
      listeners.length = 0;
      if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
      ctl.mv = 0; ctl.block = false; ctl.buf = null;
      if (window.HMini.kompy && window.HMini.kompy._dbg && window.HMini.kompy._dbg.owner === cleanup) window.HMini.kompy._dbg = null;
    }

    // отладка/тесты
    window.HMini.kompy._dbg = {
      owner: cleanup,
      get g() { return g; }, get phase() { return phase; }, get wins() { return wins; }, ctl: ctl, press: press,
      get Hf() { return Hf; }, get W() { return W; }, get alive() { return alive; },
      setFast: function (v) { fast = v; },
      step: function (dt) { step(dt, true); },
      begin: function () { if (phase === "lobby") { ov.querySelector("#hk-go").click(); } },
      LV: LV
    };
    return cleanup;
  }

  window.HMini.kompy = window.HMini.kompy || {};
  window.HMini.kompy.play = play;
})();
