// ============================================================
//  Мини-игра «Армрестлинг с Михой». Кася жмёт кнопку, Миха давит в ответ.
//  window.HMini.arm.play(container, { startWins, api, onWin, onExit, onDone }) -> cleanup()
// ============================================================
(function () {
  "use strict";
  window.HMini = window.HMini || {};

  var TAP = 0.04;        // сдвиг шкалы за один тап
  var TIME = 9;          // секунд на раунд
  var ROUNDS = [
    { push: 0.10, surge: 0.10, every: [2.6, 4.2], name: "Разминка" },
    { push: 0.18, surge: 0.13, every: [2.0, 3.4], name: "Миха злится" },
    { push: 0.22, surge: 0.16, every: [1.6, 2.8], name: "Миха в ярости" }
  ];
  var IMG = "assets/heroes/units/";
  var WIN_LINES = ["Миха подахуел.", "Лапа Михи легла на стол.", "Кася жмёт, Миха плачет."];
  var LOSE_LINES = ["Миха прижал тебя к столу.", "Слабовато. Миха даже не вспотел.", "Пальцы устали? Миха нет."];

  function css() {
    if (document.getElementById("hmini-arm-css")) return;
    var s = document.createElement("style");
    s.id = "hmini-arm-css";
    s.textContent = [
      ".ha{position:relative;flex:1;min-height:0;width:100%;display:flex;flex-direction:column;gap:8px;padding:6px 14px 12px;box-sizing:border-box;overflow:hidden;color:var(--alice);font-family:var(--sans);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}",
      ".ha *{box-sizing:border-box;-webkit-user-select:none;user-select:none}",
      ".ha-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none}",
      ".ha-title{font-family:var(--serif);font-weight:600;font-size:19px;line-height:1.1}",
      ".ha-sub{font-size:12px;color:var(--wisteria);margin-top:2px}",
      ".ha-quit{flex:none;border:1px solid var(--line);background:var(--glass-strong);color:var(--alice);border-radius:999px;padding:8px 16px;font:600 14px var(--sans);touch-action:manipulation}",
      ".ha-pips{display:flex;gap:6px;align-items:center}",
      ".ha-pip{width:26px;height:6px;border-radius:4px;background:rgba(226,236,245,.18)}",
      ".ha-pip.on{background:linear-gradient(90deg,var(--wisteria),var(--alice));box-shadow:0 0 10px rgba(164,167,227,.8)}",
      ".ha-pip.cur{background:rgba(164,167,227,.5)}",
      ".ha-arena{position:relative;flex:1 1 auto;min-height:190px;max-height:340px;border-radius:24px;overflow:hidden;border:1px solid var(--line);background:radial-gradient(ellipse at 50% 85%,rgba(106,77,212,.55),rgba(110,51,119,.22) 55%,rgba(0,2,41,.3) 100%),rgba(0,2,41,.5)}",
      ".ha-spr{position:absolute;bottom:15%;height:80%;width:auto;max-width:46%;object-fit:contain;pointer-events:none;transition:transform .12s ease-out;will-change:transform;filter:drop-shadow(0 6px 14px rgba(0,2,41,.6))}",
      ".ha-kasi{left:3%}",
      ".ha-miha{right:3%;transform:scaleX(-1)}",
      ".ha-table{position:absolute;left:-2%;right:-2%;bottom:0;height:24%;border-radius:50% 50% 0 0 / 22% 22% 0 0;background:linear-gradient(180deg,#3b2150 0%,var(--orchid) 18%,#2a1544 60%,var(--prussian) 100%);box-shadow:0 -4px 22px rgba(164,167,227,.45),inset 0 2px 0 rgba(226,236,245,.28)}",
      ".ha-table:after{content:'';position:absolute;left:12%;right:12%;top:30%;height:2px;border-radius:2px;background:rgba(226,236,245,.12)}",
      ".ha-hands{position:absolute;left:50%;bottom:21%;width:18%;height:9%;transform:translateX(-50%);border-radius:30px;background:radial-gradient(closest-side,rgba(226,236,245,.5),transparent);pointer-events:none;transition:left .1s linear}",
      ".ha-shake{animation:haShake .22s linear}",
      "@keyframes haShake{0%,100%{margin-left:0}25%{margin-left:-3px;margin-top:2px}75%{margin-left:3px;margin-top:-2px}}",
      ".ha-say{position:absolute;top:8px;left:0;right:0;text-align:center;font-family:var(--serif);font-weight:600;font-size:15px;color:var(--alice);text-shadow:0 2px 10px rgba(0,2,41,.9);pointer-events:none;opacity:0;transition:opacity .2s}",
      ".ha-say.on{opacity:1}",
      ".ha-bar{position:relative;flex:none;height:22px;border-radius:999px;background:var(--orchid);border:1px solid var(--line);overflow:hidden;box-shadow:0 0 18px rgba(110,51,119,.6)}",
      ".ha-fill{position:absolute;left:0;top:0;bottom:0;width:50%;background:linear-gradient(90deg,var(--majorelle),var(--wisteria));box-shadow:0 0 14px rgba(164,167,227,.7)}",
      ".ha-mark{position:absolute;top:2px;bottom:2px;width:4px;margin-left:-2px;border-radius:3px;background:var(--alice);box-shadow:0 0 8px var(--alice)}",
      ".ha-names{display:flex;justify-content:space-between;font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--wisteria);margin-top:-4px;flex:none}",
      ".ha-time{flex:none;text-align:center;font-size:13px;color:var(--wisteria);margin-top:-2px}",
      ".ha-tap{flex:none;height:clamp(96px,17vh,132px);border:0;border-radius:32px;font:800 28px var(--serif);letter-spacing:.02em;color:var(--alice);background:linear-gradient(135deg,var(--majorelle),var(--orchid));box-shadow:0 14px 34px rgba(106,77,212,.55),inset 0 1px 0 rgba(226,236,245,.4);touch-action:manipulation;transition:transform .06s ease}",
      ".ha-tap.press{transform:scale(.96)}",
      ".ha-tap[disabled]{opacity:.45;box-shadow:none}",
      ".ha-count{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--serif);font-weight:700;font-size:96px;color:var(--alice);text-shadow:0 0 30px var(--majorelle),0 0 60px var(--wisteria);pointer-events:none;animation:haPop .5s ease-out}",
      "@keyframes haPop{from{transform:scale(1.6);opacity:0}to{transform:scale(1);opacity:1}}",
      ".ha-card{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px 20px;border-radius:26px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:haPop .35s ease-out}",
      ".ha-card h2{font-family:var(--serif);font-weight:600;font-size:28px;line-height:1.12;margin:6px 0 8px}",
      ".ha-card p{margin:0 0 6px;color:var(--wisteria);font-size:15px;line-height:1.35}",
      ".ha-card .ha-big{color:var(--alice);font-size:17px;font-weight:700}",
      ".ha-card .btn{max-width:320px}",
      ".ha-faces{display:flex;gap:6px;align-items:flex-end;justify-content:center;height:clamp(110px,22vh,170px);margin-bottom:4px}",
      ".ha-faces img{height:100%;width:auto;object-fit:contain;filter:drop-shadow(0 6px 14px rgba(0,2,41,.6))}",
      ".ha-faces img.m{transform:scaleX(-1)}",
      ".ha-rw{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 2px;padding:8px 16px;border-radius:999px;background:var(--glass-strong);border:1px solid var(--line);color:var(--alice);font-weight:700;font-size:15px}",
      ".ha-rw img{width:24px;height:24px;object-fit:contain}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function play(container, opts) {
    opts = opts || {};
    css();
    var api = opts.api || {};
    function sfx(n) { try { api.sfx && api.sfx(n); } catch (e) {} }
    function hap(k) { try { api.haptic && api.haptic(k); } catch (e) {} }
    function cb(f, w) { try { f && f(w); } catch (e) { if (window.console) console.error(e); } }

    var wins = Math.max(0, Math.min(3, parseInt(opts.startWins, 10) || 0));
    var alive = true, timers = [], raf = 0, state = "idle";
    var root = el("div", "ha");
    container.innerHTML = "";
    container.appendChild(root);

    function later(fn, ms) {
      var id = setTimeout(function () {
        var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
        if (alive) fn();
      }, ms);
      timers.push(id); return id;
    }
    function clearAll() {
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers = [];
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    function pips(round) {
      var h = '<div class="ha-pips">';
      for (var i = 0; i < 3; i++) h += '<span class="ha-pip' + (i < wins ? " on" : (i === round ? " cur" : "")) + '"></span>';
      return h + "</div>";
    }
    function quit() {
      if (!alive) return;
      var w = wins;
      cleanup();
      cb(opts.onExit, w);
    }
    function topBar(round, sub) {
      var t = el("div", "ha-top");
      var l = el("div", "", '<div class="ha-title">Армрестлинг с Михой</div><div class="ha-sub">' + sub + "</div>");
      var q = el("button", "ha-quit", "Выйти");
      q.type = "button";
      q.addEventListener("click", quit);
      t.appendChild(l); t.appendChild(q);
      return t;
    }
    function rewardHtml() {
      return '<div class="ha-rw"><img src="assets/heroes/ui/atk.webp" alt=""><img src="assets/heroes/ui/hp.webp" alt="">Миха стал сильнее: +' + wins + "</div>";
    }

    // ---------- интро раунда ----------
    function showIntro() {
      clearAll(); state = "intro";
      var r = wins;
      root.innerHTML = "";
      root.appendChild(topBar(r, "Раунд " + (r + 1) + " из 3"));
      var c = el("div", "ha-card");
      c.innerHTML = '<div class="ha-faces"><img src="' + IMG + 'kasi_idle.webp" alt=""><img class="m" src="' + IMG + 'miha_idle.webp" alt=""></div>' +
        pips(r) +
        "<h2>" + ROUNDS[r].name + "</h2>" +
        "<p>Жми кнопку как ненормальная. Тяни Миху к своей стороне раньше, чем он дожмёт тебя.</p>" +
        (wins > 0 ? rewardHtml() : "");
      var b = el("button", "btn", "Миха, давай!");
      b.type = "button";
      b.addEventListener("click", function () { sfx("blip"); startRound(); });
      c.appendChild(b);
      root.appendChild(c);
    }

    // ---------- раунд ----------
    function startRound() {
      clearAll();
      var r = wins, cfg = ROUNDS[r];
      root.innerHTML = "";
      root.appendChild(topBar(r, "Раунд " + (r + 1) + " из 3"));
      var arena = el("div", "ha-arena");
      var kasi = el("img", "ha-spr ha-kasi"); kasi.src = IMG + "kasi_idle.webp"; kasi.alt = ""; kasi.draggable = false;
      var miha = el("img", "ha-spr ha-miha"); miha.src = IMG + "miha_idle.webp"; miha.alt = ""; miha.draggable = false;
      var hands = el("div", "ha-hands");
      var table = el("div", "ha-table");
      var say = el("div", "ha-say");
      arena.appendChild(kasi); arena.appendChild(miha); arena.appendChild(hands); arena.appendChild(table); arena.appendChild(say);
      root.appendChild(arena);

      var bar = el("div", "ha-bar");
      var fill = el("div", "ha-fill"), mark = el("div", "ha-mark");
      bar.appendChild(fill); bar.appendChild(mark);
      root.appendChild(bar);
      root.appendChild(el("div", "ha-names", "<span>КАСЯ</span><span>МИХА</span>"));
      var timeEl = el("div", "ha-time", "");
      root.appendChild(timeEl);
      var btn = el("button", "ha-tap", "Жми!");
      btn.type = "button"; btn.disabled = true;
      root.appendChild(btn);

      var p = 0.5, tLeft = TIME, lastT = 0, surgeUntil = 0, nextSurge = 0, fighting = false;
      var lastPunch = 0, kasiAtkUntil = 0, mihaAtkUntil = 0, lastSay = 0;
      var kasiSprite = "idle", mihaSprite = "idle", atkN = 1;

      function setSprites(now) {
        var ks = now < kasiAtkUntil ? "atk" + atkN : "idle";
        var ms = (now < mihaAtkUntil || now < surgeUntil) ? "atk" : "idle";
        if (ks !== kasiSprite) { kasiSprite = ks; kasi.src = IMG + "kasi_" + ks + ".webp"; }
        if (ms !== mihaSprite) { mihaSprite = ms; miha.src = IMG + "miha_" + ms + ".webp"; }
      }
      function shake(node) {
        node.classList.remove("ha-shake"); void node.offsetWidth; node.classList.add("ha-shake");
      }
      function speak(t, now) {
        say.textContent = t; say.classList.add("on"); lastSay = now;
      }
      function draw(now) {
        var pc = Math.max(0, Math.min(1, p)) * 100;
        fill.style.width = pc + "%"; mark.style.left = pc + "%";
        hands.style.left = (30 + pc * 0.4) + "%";
        var off = (p - 0.5) * 36;
        kasi.style.transform = "translateX(" + off + "px)";
        miha.style.transform = "scaleX(-1) translateX(" + (-off) + "px)";
        setSprites(now);
        if (lastSay && now - lastSay > 1100) { say.classList.remove("on"); lastSay = 0; }
      }

      function tap() {
        if (!fighting || !alive) return;
        var now = performance.now();
        p += TAP;
        btn.classList.add("press"); later(function () { btn.classList.remove("press"); }, 60);
        sfx("tap");
        if (now - lastPunch > 450) {
          lastPunch = now; atkN = 1 + Math.floor(Math.random() * 3);
          kasiAtkUntil = now + 220; shake(kasi); sfx("punch"); hap("light");
        }
        if (p >= 1) { p = 1; finish(true); }
      }
      function onDown(e) {
        if (e.cancelable) e.preventDefault();
        tap();
      }
      btn.addEventListener("pointerdown", onDown);
      btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      function onKey(e) {
        if (e.code === "Space" || e.code === "Enter" || e.key === " " || e.key === "Enter") {
          if (e.repeat) { e.preventDefault(); return; }
          e.preventDefault(); tap();
        }
      }
      document.addEventListener("keydown", onKey);
      stopRound = function () { document.removeEventListener("keydown", onKey); };

      function loop(ts) {
        if (!alive || !fighting) return;
        var now = performance.now();
        var dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
        tLeft -= dt;
        var rate = cfg.push;
        if (now >= nextSurge) {
          surgeUntil = now + 650; nextSurge = now + rnd(cfg.every[0], cfg.every[1]) * 1000;
          mihaAtkUntil = now + 300; shake(miha); sfx("hit"); hap("medium");
          speak(pick(["Миха давит!", "Рррр!", "Миха напрягся!"]), now);
        }
        if (now < surgeUntil) rate += cfg.surge;
        p -= rate * dt;
        timeEl.textContent = "Осталось " + Math.max(0, Math.ceil(tLeft)) + " c";
        draw(now);
        if (p <= 0) { p = 0; draw(now); return finish(false); }
        if (tLeft <= 0) return finish(p > 0.5);
        raf = requestAnimationFrame(loop);
      }

      function finish(won) {
        if (!fighting) return;
        fighting = false; btn.disabled = true;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        if (stopRound) stopRound();
        state = "result";
        draw(performance.now());
        if (won) {
          wins++; sfx("success"); hap("success");
          cb(opts.onWin, wins);
          if (!alive) return;
          later(function () { won && wins >= 3 ? showVictory() : showWin(); }, 650);
        } else {
          sfx("error"); hap("error");
          later(showLose, 650);
        }
      }

      // обратный отсчёт 3-2-1
      state = "count";
      draw(performance.now());
      var n = 3;
      function tick() {
        var old = arena.querySelector(".ha-count"); if (old) old.remove();
        if (n === 0) {
          var g = el("div", "ha-count", "Жми!"); g.style.fontSize = "60px"; arena.appendChild(g);
          sfx("pop");
          later(function () { g.remove(); }, 450);
          fighting = true; btn.disabled = false; state = "fight";
          lastT = performance.now(); nextSurge = lastT + rnd(cfg.every[0], cfg.every[1]) * 1000;
          timeEl.textContent = "Осталось " + TIME + " c";
          raf = requestAnimationFrame(loop);
          return;
        }
        arena.appendChild(el("div", "ha-count", String(n)));
        sfx("blip"); hap("light");
        n--; later(tick, 750);
      }
      tick();
    }
    var stopRound = null;

    // ---------- итоги ----------
    function resultCard(title, line, extra, btnText, handler, faceWin) {
      clearAll();
      root.innerHTML = "";
      root.appendChild(topBar(wins, "Раунд " + Math.min(wins + (faceWin ? 0 : 1), 3) + " из 3"));
      var c = el("div", "ha-card");
      c.innerHTML = '<div class="ha-faces"><img src="' + IMG + (faceWin ? "kasi_atk2" : "kasi_idle") + '.webp" alt=""><img class="m" src="' + IMG + (faceWin ? "miha_idle" : "miha_atk") + '.webp" alt=""></div>' +
        pips(wins) + "<h2>" + title + "</h2><p>" + line + "</p>" + extra;
      var b = el("button", "btn", btnText);
      b.type = "button";
      b.addEventListener("click", function () { sfx("blip"); handler(); });
      c.appendChild(b);
      root.appendChild(c);
    }
    function showWin() {
      state = "win";
      resultCard("Раунд твой!", pick(WIN_LINES), rewardHtml(), "Следующий раунд", showIntro, true);
    }
    function showLose() {
      state = "lose";
      resultCard("Миха победил", pick(LOSE_LINES), "", "Ещё раз", startRound, false);
    }
    function showVictory() {
      state = "victory";
      resultCard("Миха сломлен!", "Все три раунда за Касей. Миха подахуел и просит пощады.", rewardHtml(), "Дальше", function () {
        var w = wins; cleanup(); cb(opts.onDone, w);
      }, true);
    }

    function cleanup() {
      if (!alive) return;
      alive = false;
      clearAll();
      if (stopRound) stopRound();
      try { container.innerHTML = ""; } catch (e) {}
    }

    if (wins >= 3) showVictory(); else showIntro();
    return cleanup;
  }

  window.HMini.arm = { play: play };
})();
