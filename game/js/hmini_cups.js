// ============================================================
//  МИНИ-ИГРА «Угадай, где пиво»: пять стаканов, три предмета, пять раундов.
//  Контракт: window.HMini.cups.play(container, opts) -> cleanup().
//  Состояние: { round, pool:{lump,crystal,bottle}, got:{lump,crystal,bottle}, power, extra, picks:[] }
// ============================================================
(function () {
  "use strict";

  window.HMini = window.HMini || {};

  var ROUNDS = 5;
  var START_POOL = { lump: 1, crystal: 2, bottle: 3 };
  var MEMO_MS = 2200;        // сколько стаканы подняты на запоминание
  var REVEAL_ALL_MS = 1200;  // показ всей раскладки после выбора
  var SPRITE_IDLE = "assets/heroes/units/denchik_idle.webp";
  var SPRITE_ATK = "assets/heroes/units/denchik_atk.webp";

  var NAMES = { lump: "комок", crystal: "кристалл", bottle: "бутылка" };

  // ---------- SVG-иконки (рисуем сами, без эмодзи) ----------
  function icon(type, size) {
    var s = size || 26;
    var h = '<svg class="hc-ico" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" aria-hidden="true">';
    if (type === "lump") {
      h += '<defs><radialGradient id="hcg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#b9f0b0"/><stop offset="1" stop-color="#3f9a5a"/></radialGradient></defs>' +
        '<path d="M5 22c-1-6 3-8 4-11 1-4 6-6 10-4 4 1 5 4 6 6 3 1 5 4 3 8-2 4-8 4-12 4S6 26 5 22z" fill="url(#hcg)" stroke="#E2ECF5" stroke-opacity=".55" stroke-width="1"/>' +
        '<ellipse cx="12" cy="12" rx="3" ry="1.8" fill="#E2ECF5" opacity=".6" transform="rotate(-25 12 12)"/>' +
        '<circle cx="14" cy="19" r="1.6" fill="#1d5a38"/><circle cx="21" cy="18" r="1.6" fill="#1d5a38"/><path d="M15 23c1.5 1 3.5 1 5 0" stroke="#1d5a38" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    } else if (type === "crystal") {
      h += '<path d="M16 3l9 7-3 16H10L7 10z" fill="#bfe3ff" fill-opacity=".85" stroke="#E2ECF5" stroke-width="1.1" stroke-linejoin="round"/>' +
        '<path d="M7 10h18M16 3l-3 7 3 16 3-16z" fill="none" stroke="#6aa7e8" stroke-width="1" stroke-linejoin="round"/>' +
        '<path d="M13 10l3-7 3 7-3 16z" fill="#E2ECF5" opacity=".45"/>';
    } else if (type === "bottle") {
      h += '<rect x="13" y="2.5" width="6" height="3" rx="1" fill="#E2ECF5"/>' +
        '<path d="M13.6 5.5h4.8v6.2c0 1.6 3.2 3 3.2 6.6V27a2 2 0 0 1-2 2h-7.2a2 2 0 0 1-2-2v-8.7c0-3.6 3.2-5 3.2-6.6z" fill="#3b8f6a" stroke="#E2ECF5" stroke-opacity=".6" stroke-width="1"/>' +
        '<rect x="10.6" y="18" width="10.8" height="6.5" fill="#E2ECF5" opacity=".9"/>' +
        '<circle cx="16" cy="21.2" r="1.7" fill="#6A4DD4"/>' +
        '<path d="M13.2 13.5v3" stroke="#E2ECF5" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>';
    } else { // empty cup
      h += '<path d="M8 28L10.5 8Q16 5 21.5 8L24 28z" fill="none" stroke="#A4A7E3" stroke-width="1.6" stroke-dasharray="3 2.6" stroke-linejoin="round"/>' +
        '<ellipse cx="16" cy="28" rx="8" ry="1.8" fill="none" stroke="#A4A7E3" stroke-width="1.4" stroke-dasharray="3 2.6"/>';
    }
    return h + "</svg>";
  }

  var CUP_SVG = '<svg viewBox="0 0 60 72" width="100%" height="100%" aria-hidden="true">' +
    '<defs><linearGradient id="hcCup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4d34a8"/><stop offset=".45" stop-color="#6A4DD4"/><stop offset="1" stop-color="#6E3377"/></linearGradient></defs>' +
    '<path d="M9 66L15 15Q30 7 45 15L51 66Q30 73 9 66z" fill="url(#hcCup)" stroke="#A4A7E3" stroke-opacity=".6" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<ellipse cx="30" cy="15" rx="15" ry="4.5" fill="#A4A7E3" fill-opacity=".35"/>' +
    '<path d="M18 22L15 58" stroke="#E2ECF5" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M12 50Q30 56 48 50" stroke="#E2ECF5" stroke-opacity=".25" stroke-width="2" fill="none"/>' +
    '</svg>';

  // ---------- CSS ----------
  var CSS = [
    ".hc-root{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:2px 2px 0;overflow-x:hidden;overflow-y:auto;font-family:var(--sans);color:var(--alice);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}",
    ".hc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}",
    ".hc-title{font-family:var(--serif);font-weight:600;font-size:19px;letter-spacing:-.01em}",
    ".hc-exit{width:auto!important;margin:0!important;padding:8px 16px!important;font-size:13px!important;flex:none}",
    ".hc-hud{flex:none;border-radius:18px;background:var(--glass);border:1px solid var(--line);padding:8px 10px;display:grid;gap:6px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}",
    ".hc-hud-row{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12.5px;color:var(--wisteria)}",
    ".hc-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 4px;border-radius:999px;background:rgba(0,2,41,.45);border:1px solid var(--line);color:var(--alice);font-weight:700;font-variant-numeric:tabular-nums;transition:opacity .3s,transform .3s}",
    ".hc-chip .hc-ico{width:20px;height:20px}",
    ".hc-chip.out{opacity:.38}",
    ".hc-chip.bump{animation:hcbump .5s ease}",
    "@keyframes hcbump{40%{transform:scale(1.25)}}",
    ".hc-hud b{color:var(--alice);font-variant-numeric:tabular-nums}",
    ".hc-pos{color:var(--alice)}",
    ".hc-stage{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;justify-content:flex-end}",
    ".hc-host{display:flex;align-items:flex-end;gap:10px;flex:none;min-height:0}",
    ".hc-spr{position:relative;flex:none;width:124px;height:124px;display:grid;place-items:end center}",
    ".hc-spr::before{content:'';position:absolute;inset:10% 0 0;border-radius:50%;background:radial-gradient(closest-side,rgba(106,77,212,.6),transparent)}",
    ".hc-spr img{position:relative;max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,2,41,.6))}",
    ".hc-spr.hurt img{animation:hcshake .5s ease;filter:drop-shadow(0 6px 10px rgba(0,2,41,.6)) saturate(.55) brightness(.85)}",
    ".hc-spr.joy img{animation:hchop .6s ease}",
    "@keyframes hcshake{20%{transform:translateX(-6px) rotate(-4deg)}40%{transform:translateX(6px) rotate(4deg)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}",
    "@keyframes hchop{40%{transform:translateY(-12px) scale(1.06)}}",
    ".hc-say{position:relative;flex:1;border-radius:18px 18px 18px 6px;background:var(--glass-strong);border:1px solid var(--line);padding:10px 12px;font-size:14px;line-height:1.3;min-height:52px;display:flex;align-items:center}",
    ".hc-say.good{border-color:rgba(164,167,227,.7)}",
    ".hc-say.bad{border-color:rgba(110,51,119,1);background:rgba(110,51,119,.35)}",
    ".hc-label{flex:none;text-align:center;font-family:var(--serif);font-size:22px;font-weight:600;letter-spacing:.01em;min-height:30px}",
    ".hc-label.go{color:var(--wisteria);animation:hcpulse 1s ease infinite}",
    "@keyframes hcpulse{50%{opacity:.6}}",
    ".hc-table{position:relative;flex:none;height:172px;border-radius:26px;background:linear-gradient(180deg,rgba(106,77,212,.28),rgba(110,51,119,.22) 70%,rgba(0,2,41,.5));border:1px solid var(--line);box-shadow:inset 0 1px 0 rgba(226,236,245,.2),0 14px 30px rgba(0,2,41,.5);overflow:hidden}",
    ".hc-table::after{content:'';position:absolute;left:0;right:0;bottom:0;height:34%;background:linear-gradient(180deg,transparent,rgba(0,2,41,.35))}",
    ".hc-cups{position:absolute;left:8px;right:8px;top:0;bottom:0}",
    ".hc-cw{position:absolute;left:0;bottom:18px;width:20%;height:80px;will-change:transform;transform:translate3d(0,0,0)}",
    ".hc-cw.pick{cursor:pointer}",
    ".hc-sh{position:absolute;left:12%;right:12%;bottom:-4px;height:9px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,2,41,.75),transparent)}",
    ".hc-item{position:absolute;left:50%;bottom:9px;width:60%;max-width:34px;aspect-ratio:1;transform:translateX(-50%);display:grid;place-items:center;z-index:1}",
    ".hc-item .hc-ico{width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,2,41,.7))}",
    ".hc-cup{position:absolute;left:6%;right:6%;bottom:0;top:0;z-index:2;transition:transform .34s cubic-bezier(.3,1.3,.5,1);transform:translateY(0)}",
    ".hc-cw.up .hc-cup{transform:translateY(-66px)}",
    ".hc-cw.dim .hc-cup,.hc-cw.dim .hc-item{opacity:.8}",
    ".hc-cw.chosen .hc-cup{filter:drop-shadow(0 0 8px rgba(164,167,227,.9))}",
    ".hc-star{position:absolute;left:50%;top:0;width:34px;height:34px;margin-left:-17px;z-index:3;pointer-events:none;animation:hcstar .8s ease-out forwards}",
    "@keyframes hcstar{0%{transform:scale(.2) rotate(0);opacity:1}100%{transform:scale(1.5) rotate(70deg) translateY(-26px);opacity:0}}",
    ".hc-act{flex:none;min-height:56px;display:flex;flex-direction:column;justify-content:flex-end}",
    ".hc-act .btn{margin-top:0}",
    ".hc-card{margin:auto 0;border-radius:24px;background:var(--glass);border:1px solid var(--line);padding:18px 16px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}",
    ".hc-card h2{font-family:var(--serif);font-size:25px;font-weight:600;line-height:1.1;margin:0 0 6px}",
    ".hc-card p{margin:0 0 10px;font-size:14px;line-height:1.35;color:var(--wisteria)}",
    ".hc-rules{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:7px}",
    ".hc-rules li{display:flex;align-items:center;gap:10px;font-size:14px;line-height:1.25;padding:7px 10px;border-radius:14px;background:rgba(0,2,41,.4);border:1px solid var(--line)}",
    ".hc-rules .hc-ico{width:32px;height:32px;flex:none}",
    ".hc-rules b{color:var(--alice)}",
    ".hc-rules span{color:var(--wisteria)}",
    ".hc-pool{margin:0 0 4px;font-size:13px;color:var(--wisteria);text-align:center}",
    ".hc-pool b{color:var(--alice)}",
    ".hc-sum{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 8px}",
    ".hc-sum div{border-radius:16px;background:rgba(0,2,41,.4);border:1px solid var(--line);padding:10px;text-align:center}",
    ".hc-sum big{display:block;font-family:var(--serif);font-size:30px;font-weight:600;font-variant-numeric:tabular-nums}",
    ".hc-sum small{font-size:12px;color:var(--wisteria)}",
    ".hc-got{display:flex;justify-content:center;gap:10px;margin:0 0 8px}",
    ".hc-in{animation:hcin .4s ease}",
    "@keyframes hcin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"
  ].join("\n");

  function ensureCss() {
    if (document.getElementById("hmini-cups-css")) return;
    var st = document.createElement("style");
    st.id = "hmini-cups-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function num(v, d, lo, hi) { v = Number(v); if (!isFinite(v)) v = d; return Math.max(lo, Math.min(hi, Math.floor(v))); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtSigned(n) { return (n > 0 ? "+" : "") + n; }

  function normState(st) {
    var s = { round: 0, pool: clone(START_POOL), got: { lump: 0, crystal: 0, bottle: 0 }, power: 0, extra: 0, picks: [] };
    if (!st || typeof st !== "object") return s;
    s.round = num(st.round, 0, 0, ROUNDS);
    ["lump", "crystal", "bottle"].forEach(function (k) {
      s.got[k] = num(st.got && st.got[k], 0, 0, START_POOL[k]);
      var left = START_POOL[k] - s.got[k];
      s.pool[k] = num(st.pool && st.pool[k], left, 0, left);
    });
    s.power = s.got.bottle - 2 * s.got.crystal;
    s.extra = s.got.lump;
    if (Object.prototype.toString.call(st.picks) === "[object Array]") s.picks = st.picks.slice(0, ROUNDS);
    return s;
  }

  function play(container, opts) {
    opts = opts || {};
    var api = opts.api || {};
    function sfx(n) { try { api.sfx && api.sfx(n); } catch (e) {} }
    function haptic(k) { try { api.haptic && api.haptic(k); } catch (e) {} }

    ensureCss();
    var alive = true;
    var timers = [];
    var S = normState(opts.state);

    function later(fn, ms) {
      var id = setTimeout(function () { if (alive) fn(); }, ms);
      timers.push(id);
      return id;
    }
    function emit() { try { opts.onChange && opts.onChange(clone(S)); } catch (e) {} }

    container.innerHTML = "";
    var root = document.createElement("div");
    root.className = "hc-root";
    container.appendChild(root);

    // состояние раунда
    var phase = "idle";
    var cups = [];     // { id, item, el, slot }
    var els = {};      // ссылки на DOM текущего экрана
    var curRound = null;

    // ---------- общий верх ----------
    function topBar() {
      return '<div class="hc-top"><div class="hc-title">Угадай, где пиво</div>' +
        '<button type="button" class="btn ghost hc-exit" data-act="exit">Выйти</button></div>';
    }
    function bindExit() {
      var b = root.querySelector('[data-act="exit"]');
      if (b) b.addEventListener("click", function () {
        sfx("tap");
        if (!alive) return;
        try { opts.onExit && opts.onExit(clone(S)); } catch (e) {}
      });
    }
    function poolChips(bump) {
      var h = "";
      ["lump", "crystal", "bottle"].forEach(function (k) {
        h += '<span class="hc-chip' + (S.pool[k] <= 0 ? " out" : "") + (bump === k ? " bump" : "") + '" title="' + NAMES[k] + '">' + icon(k, 20) + "&times;" + S.pool[k] + "</span>";
      });
      return h;
    }
    function totalsHtml() {
      return 'Сила <b class="hc-pos">' + fmtSigned(S.power) + "</b> &middot; доп. ход <b>&times;" + S.extra + "</b>";
    }
    function updateHud(bump) {
      if (!els.hudPool) return;
      els.hudPool.innerHTML = poolChips(bump);
      els.hudTot.innerHTML = totalsHtml();
      els.hudRound.textContent = "Раунд " + Math.min(ROUNDS, S.round + (phase === "done" ? 0 : 1)) + "/" + ROUNDS;
    }

    // ---------- интро ----------
    function showIntro() {
      phase = "intro";
      root.innerHTML = topBar() +
        '<div class="hc-card hc-in">' +
        "<h2>Угадай, где пиво</h2>" +
        "<p>Пять стаканов, в трёх что-то лежит. Запомни, смотри за руками и найди бутылку. Но Денчик получит то, что ты откроешь.</p>" +
        '<ul class="hc-rules">' +
        "<li>" + icon("bottle", 32) + "<div><b>Бутылка пива</b> <span>+1 к силе Денчика</span></div></li>" +
        "<li>" + icon("lump", 32) + "<div><b>Зелёный комок</b> <span>+1 доп. ход в следующем бою (на один бой)</span></div></li>" +
        "<li>" + icon("crystal", 32) + "<div><b>Кристалл (соль)</b> <span>-2 к силе. Ну ты понял</span></div></li>" +
        "<li>" + icon("empty", 32) + "<div><b>Пустой стакан</b> <span>ничего не происходит</span></div></li>" +
        "</ul>" +
        '<p class="hc-pool">Запас на все 5 раундов: комок <b>&times;1</b>, кристалл <b>&times;2</b>, бутылка <b>&times;3</b>. Что уже достали, под стаканами больше не появится. Невыбранное запас не тратит.</p>' +
        '<button type="button" class="btn" data-act="go">Поехали</button>' +
        "</div>";
      bindExit();
      root.querySelector('[data-act="go"]').addEventListener("click", function () {
        sfx("tap"); haptic("light");
        startRound();
      });
    }

    // ---------- каркас раунда ----------
    function buildBoard() {
      root.innerHTML = topBar() +
        '<div class="hc-hud">' +
        '<div class="hc-hud-row"><span>осталось:</span><span class="hc-pool-chips" data-r="pool"></span></div>' +
        '<div class="hc-hud-row"><span data-r="round"></span><span data-r="tot"></span></div>' +
        "</div>" +
        '<div class="hc-stage">' +
        '<div class="hc-host"><div class="hc-spr" data-r="spr"><img alt="" src="' + SPRITE_IDLE + '"></div>' +
        '<div class="hc-say" data-r="say"></div></div>' +
        '<div class="hc-label" data-r="label"></div>' +
        '<div class="hc-table"><div class="hc-cups" data-r="cups"></div></div>' +
        '<div class="hc-act" data-r="act"></div>' +
        "</div>";
      bindExit();
      var q = function (n) { return root.querySelector('[data-r="' + n + '"]'); };
      els = { hudPool: q("pool"), hudTot: q("tot"), hudRound: q("round"), spr: q("spr"), say: q("say"), label: q("label"), cups: q("cups"), act: q("act") };
      els.img = els.spr.querySelector("img");
      updateHud();
    }
    function say(text, cls) {
      els.say.className = "hc-say" + (cls ? " " + cls : "");
      els.say.textContent = text;
    }
    function label(text, go) {
      els.label.className = "hc-label" + (go ? " go" : "");
      els.label.textContent = text;
    }
    function setSprite(kind) {
      els.img.src = kind === "atk" ? SPRITE_ATK : SPRITE_IDLE;
      els.spr.className = "hc-spr" + (kind === "atk" ? " joy" : kind === "hurt" ? " hurt" : "");
    }

    // ---------- раскладка ----------
    function layout() {
      var types = [];
      ["lump", "crystal", "bottle"].forEach(function (k) { if (S.pool[k] > 0) types.push(k); });
      var ids = [0, 1, 2, 3, 4];
      var items = [null, null, null, null, null];
      // перемешать позиции
      for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
      types.forEach(function (k, n) { items[ids[n]] = k; });
      return items;
    }
    function slotTransform(slot, dy, sc) {
      return "translate3d(" + (slot * 100) + "%," + (dy || 0) + "px,0)" + (sc ? " scale(" + sc + ")" : "");
    }
    function buildCups(items) {
      els.cups.innerHTML = "";
      cups = [];
      for (var i = 0; i < 5; i++) {
        var w = document.createElement("div");
        w.className = "hc-cw";
        var inner = '<div class="hc-sh"></div>';
        if (items[i]) inner += '<div class="hc-item">' + icon(items[i], 40) + "</div>";
        else inner += '<div class="hc-item" style="opacity:.0"></div>';
        inner += '<div class="hc-cup">' + CUP_SVG + "</div>";
        w.innerHTML = inner;
        w.style.transform = slotTransform(i);
        w.style.zIndex = 1;
        els.cups.appendChild(w);
        var c = { id: i, item: items[i], el: w, slot: i };
        cups.push(c);
        (function (cup) {
          w.addEventListener("click", function () { onCupTap(cup); });
        })(c);
      }
    }
    function liftAll(on) {
      cups.forEach(function (c) {
        if (on) c.el.classList.add("up"); else c.el.classList.remove("up");
      });
    }
    function itemsBySlot() {
      var a = [null, null, null, null, null];
      cups.forEach(function (c) { a[c.slot] = c.item; });
      return a;
    }

    // ---------- перемешивание ----------
    function swapAnim(a, b, dur) {
      var sa = a.slot, sb = b.slot;
      a.slot = sb; b.slot = sa;
      a.el.style.transform = slotTransform(a.slot);
      b.el.style.transform = slotTransform(b.slot);
      a.el.style.zIndex = 3; b.el.style.zIndex = 2;
      if (a.el.animate) {
        var arc = 12 + Math.abs(sa - sb) * 3;
        a.el.animate([{ transform: slotTransform(sa, 0, 1) }, { transform: slotTransform((sa + sb) / 2, arc, 1.07), offset: .5 }, { transform: slotTransform(sb, 0, 1) }], { duration: dur, easing: "ease-in-out" });
        b.el.animate([{ transform: slotTransform(sb, 0, 1) }, { transform: slotTransform((sa + sb) / 2, -arc * .7, .93), offset: .5 }, { transform: slotTransform(sa, 0, 1) }], { duration: dur, easing: "ease-in-out" });
      }
      later(function () { a.el.style.zIndex = 1; b.el.style.zIndex = 1; }, dur);
    }
    function shuffle(done) {
      var n = ri(6, 9);
      var r = S.round; // 0..4
      var dur = Math.round(Math.max(230, 470 - r * 48));
      var gap = 40;
      var k = 0, lastA = -1, lastB = -1;
      (function step() {
        if (k >= n) { later(done, dur * 0.3); return; }
        var a, b, tries = 0;
        do {
          a = ri(0, 4); b = ri(0, 4);
          tries++;
        } while ((a === b || (a === lastA && b === lastB) || (a === lastB && b === lastA)) && tries < 20);
        lastA = a; lastB = b;
        var ca = null, cb = null;
        cups.forEach(function (c) { if (c.slot === a) ca = c; if (c.slot === b) cb = c; });
        swapAnim(ca, cb, dur);
        if (k % 3 === 0) sfx("blip");
        k++;
        later(step, dur + gap);
      })();
    }

    // ---------- раунд ----------
    function startRound() {
      if (S.round >= ROUNDS) { showSummary(); return; }
      buildBoard();
      var items = layout();
      curRound = { items: items };
      buildCups(items);
      phase = "memo";
      setSprite("idle");
      say(S.round === 0 ? "Смотри внимательно. Я тут просто стою и ничего не ворую." : pick(["Опять эти стаканы. Запоминай давай.", "Ну что, ещё разок. Не моргай.", "Смотри в оба, я своё уже забыл."]));
      label("Запоминай", true);
      later(function () { liftAll(true); sfx("pop"); }, 350);
      later(function () {
        liftAll(false); sfx("pop");
        label("Смотри за руками", false);
        say(pick(["Мешаю, мешаю...", "Следи, не отвлекайся.", "Ну-ну, где там пиво?"]));
        phase = "shuffle";
      }, 350 + MEMO_MS);
      later(function () {
        shuffle(function () {
          phase = "pick";
          label("Выбирай", true);
          say("Ну? Тыкай в стакан. Только не в соль.");
          cups.forEach(function (c) { c.el.classList.add("pick"); });
          sfx("blip");
        });
      }, 350 + MEMO_MS + 600);
    }

    function onCupTap(c) {
      if (phase !== "pick") return;
      phase = "reveal";
      sfx("tap"); haptic("light");
      cups.forEach(function (x) { x.el.classList.remove("pick"); });
      var item = c.item;
      var key = item || "empty";
      var round = S.round;
      // применяем эффект
      if (item) {
        S.pool[item] = Math.max(0, S.pool[item] - 1);
        S.got[item] += 1;
      }
      S.power = S.got.bottle - 2 * S.got.crystal;
      S.extra = S.got.lump;
      S.picks.push(key);
      S.round = round + 1;
      c.el.classList.add("chosen");
      c.el.classList.add("up");
      updateHud(item);
      emit();

      var txt, cls = "", spr = "idle";
      if (key === "bottle") {
        txt = pick(["Бутылка! Вот это нюх. Денчик +1 к силе.", "Есть пиво! Денчик вошёл в угар, +1 к силе."]);
        cls = "good"; spr = "atk"; sfx("success"); haptic("success");
      } else if (key === "lump") {
        txt = "Зелёный комок. Денчик не спрашивает, что это. +1 доп. ход в следующем бою.";
        cls = "good"; spr = "atk"; sfx("pickup"); haptic("medium");
      } else if (key === "crystal") {
        txt = pick(["Денчик, ты чё, соль взял? -2 к силе.", "Соль, блин. Денчик скорёжило, -2 к силе."]);
        cls = "bad"; spr = "hurt"; sfx("error"); haptic("error");
      } else {
        txt = pick(["Пусто. Денчик пялится в стакан, как в свою жизнь.", "Ничего. Ни пива, ни соли, ни смысла."]);
        sfx("pop"); haptic("light");
      }
      label(key === "empty" ? "Пусто" : key === "bottle" ? "Бутылка" : key === "lump" ? "Комок" : "Кристалл", false);
      say(txt, cls);
      setSprite(spr);
      if (key !== "empty") {
        var star = document.createElement("div");
        star.className = "hc-star";
        star.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="' + (key === "crystal" ? "#6E3377" : "#E2ECF5") + '"/></svg>';
        c.el.appendChild(star);
        if (key !== "crystal") sfx("sparkle");
      }
      later(function () {
        // показать всю раскладку
        cups.forEach(function (x) { if (x !== c) { x.el.classList.add("up", "dim"); } });
        sfx("pop");
        label("Вот где всё было", false);
      }, 750);
      later(function () {
        phase = "after";
        var last = S.round >= ROUNDS;
        els.act.innerHTML = '<button type="button" class="btn hc-in" data-act="next">' + (last ? "Итоги" : "Дальше") + "</button>";
        els.act.querySelector("button").addEventListener("click", function () {
          if (phase !== "after") return;
          phase = "leaving";
          sfx("tap");
          if (last) showSummary(); else startRound();
        });
      }, 750 + REVEAL_ALL_MS);
    }

    // ---------- итог ----------
    function showSummary() {
      phase = "done";
      var p = S.power;
      var verdict = p >= 3 ? "Денчик в шоколаде. Точнее, в пиве."
        : p > 0 ? "Неплохо. Денчик слегка воодушевлён."
        : p === 0 ? "Ровно ноль. Денчик пожал плечами."
        : "Соль победила. Денчик обижен и слаб.";
      root.innerHTML = topBar() +
        '<div class="hc-card hc-in">' +
        "<h2>Итоги</h2>" +
        "<p>" + verdict + "</p>" +
        '<div class="hc-sum"><div><big>' + fmtSigned(S.power) + "</big><small>сила Денчика</small></div>" +
        "<div><big>&times;" + S.extra + "</big><small>доп. ход на один бой</small></div></div>" +
        '<div class="hc-got">' +
        '<span class="hc-chip">' + icon("bottle", 20) + "&times;" + S.got.bottle + "</span>" +
        '<span class="hc-chip">' + icon("lump", 20) + "&times;" + S.got.lump + "</span>" +
        '<span class="hc-chip">' + icon("crystal", 20) + "&times;" + S.got.crystal + "</span>" +
        '<span class="hc-chip">' + icon("empty", 20) + "&times;" + Math.max(0, S.picks.filter(function (x) { return x === "empty"; }).length) + "</span>" +
        "</div>" +
        '<button type="button" class="btn" data-act="done">Готово</button>' +
        "</div>";
      bindExit();
      root.querySelector('[data-act="done"]').addEventListener("click", function () {
        sfx("success"); haptic("success");
        if (!alive) return;
        try { opts.onDone && opts.onDone(clone(S)); } catch (e) {}
      });
    }

    // отладка для тестов
    window.HMini.cups._dbg = {
      items: itemsBySlot,
      phase: function () { return phase; },
      state: function () { return clone(S); }
    };

    if (S.round >= ROUNDS) showSummary();
    else if (S.round === 0) showIntro();
    else startRound();

    return function cleanup() {
      alive = false;
      timers.forEach(clearTimeout);
      timers = [];
      try { root.parentNode && root.parentNode.removeChild(root); } catch (e) {}
      if (window.HMini.cups._dbg) delete window.HMini.cups._dbg;
    };
  }

  window.HMini.cups = { play: play };
})();
