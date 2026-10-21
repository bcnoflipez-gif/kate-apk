// ============================================================
//  HEROES OF MAGIC: боевой экран (UI поверх HCore) и поток «подготовка → бой → итог».
// ============================================================
(function () {
  "use strict";
  var HG = window.HG, DT = window.HData, Core = window.HCore, el = HG.el;
  var FAST = /[?&]hfast=1/.test(location.search);
  function W(fn, ms) { return setTimeout(fn, FAST ? ms / 10 : ms); }

  var ENC_MUSIC = { nightmare: "undead", swamp: "swamp", garb: "garvordurs", krug: "krugpug", dymka: "smoker", barinov: "barinov" };
  function theme(name) { try { if (window.AUDIO && window.AUDIO.setTheme) window.AUDIO.setTheme(name); } catch (e) {} }

  // ---------- Подготовка к бою: облегчение за монеты ----------
  function prep(encId, cb) {
    var S = HG.S, enc = DT.ENC[encId];
    var ov = el("div", "hm-pop");
    ov.innerHTML = '<div class="hm-pop-card hm-prep"></div>';
    HG.root.appendChild(ov);
    var card = ov.firstChild;
    function render() {
      var ease = (S.eased[encId] || 0) + (S.assist[encId] || 0);
      var lvlBought = S.eased[encId] || 0, cost = enc.ease[lvlBought];
      var can = lvlBought < 3 && S.coins >= cost;
      var foes = enc.foes.map(function (f) {
        var d = DT.FOE[f];
        return '<div class="hm-prep-u"><img alt="" src="' + HG.sprite(d.idle) + '"><span>' + d.name + '</span></div>';
      }).join("");
      card.innerHTML = '<div class="hm-kicker">Бой</div><h2>' + enc.name + '</h2><div class="hm-prep-foes">' + foes + '</div>' +
        '<p class="hm-prep-ease">' + (ease > 0 ? "Враги ослаблены на " + ease + " " + (ease === 1 ? "шаг" : "шага") + "." : "Враги в полной силе.") + '</p>' +
        (lvlBought < 3 ? '<button class="btn ghost hm-ease"' + (can ? "" : " disabled") + '>Облегчить врагов: ' + cost + ' мон. (у тебя ' + S.coins + ')</button>' :
          '<p class="hm-prep-ease">Облегчение куплено до предела.</p>') +
        '<button class="btn hm-go">В бой</button><button class="btn ghost hm-flee">Отступить</button>';
      var eb = card.querySelector(".hm-ease");
      if (eb) eb.addEventListener("click", function () {
        if (!can) return;
        S.coins -= cost; S.eased[encId] = lvlBought + 1; HG.save(); HG.hud(); HG.sfx("coin"); HG.haptic("medium"); render();
      });
      card.querySelector(".hm-go").addEventListener("click", function () { HG.sfx("tap"); close(function () { cb(true); }); });
      card.querySelector(".hm-flee").addEventListener("click", function () { HG.sfx("tap"); close(function () { cb(false); }); });
    }
    function close(fn) {
      ov.classList.remove("on");
      HG.wait(180, function () { if (ov.parentNode) ov.parentNode.removeChild(ov); fn(); });
    }
    render();
    requestAnimationFrame(function () { ov.classList.add("on"); });
  }

  // ---------- Сам бой ----------
  function battle(encId, done) {
    var S = HG.S, enc = DT.ENC[encId];
    var ease = (S.eased[encId] || 0) + (S.assist[encId] || 0);
    var order = S.party.slice();
    var spec = DT.buildBattle(encId, order, S, ease, HG.curRematch);
    var b = Core.newBattle(spec.A, spec.E, spec.opts);
    S.extraMoves = 0; HG.save();
    HG.music(ENC_MUSIC[encId] || "loc4");

    var loc = window.HStory.LOCS[S.loc];
    var root = el("div", "hm-battle");
    root.style.setProperty("--bg", "url(" + new URL(loc.bg, document.baseURI).href + ")");
    root.innerHTML = '<div class="hb-top"><div class="hb-round">Бой</div><div class="hb-order"></div></div>' +
      '<div class="hb-field"><div class="hb-foes"></div><div class="hb-allies"></div><div class="hb-banner"></div></div>' +
      '<div class="hb-bar"></div>';
    HG.root.appendChild(root);
    var foesBox = root.querySelector(".hb-foes"), alliesBox = root.querySelector(".hb-allies"),
        bar = root.querySelector(".hb-bar"), banner = root.querySelector(".hb-banner"),
        orderBox = root.querySelector(".hb-order"), roundEl = root.querySelector(".hb-round");
    var els = {}, shown = {}, selected = null, cur = null, over = false;

    function mk(u, box) {
      var d = el("div", "hb-u " + (u.side === "A" ? "ally" : "foe"));
      d.style.setProperty("--sz", u.size || 1);
      d.innerHTML = '<div class="hb-name">' + u.name + '</div><div class="hb-hp"><i></i><b></b></div>' +
        '<div class="hb-stage"><img class="hb-img" alt="" src="' + HG.sprite(u.idle) + '"></div><div class="hb-badge"></div>';
      box.appendChild(d);
      els[u.id] = d; shown[u.id] = u.hp;
      d.addEventListener("click", function () {
        if (u.side === "E" && !u.dead && cur && cur.side === "A") { selected = u; markSel(); HG.sfx("tap"); }
      });
      upd(u);
    }
    function upd(u) {
      var d = els[u.id], h = Math.max(0, shown[u.id]);
      d.querySelector(".hb-hp i").style.width = (100 * h / u.maxhp) + "%";
      d.querySelector(".hb-hp b").textContent = h;
      var bd = [];
      if (u.stun > 0) bd.push("оглушён");
      if (u.guard) bd.push("защита");
      if (u.sp && u.cd > 0 && u.side === "A") bd.push("спец " + u.cd);
      d.querySelector(".hb-badge").textContent = bd.join(" · ");
    }
    b.E.forEach(function (u) { mk(u, foesBox); });
    b.A.forEach(function (u) { mk(u, alliesBox); });
    selected = b.E[0];

    function markSel() {
      b.E.forEach(function (u) { els[u.id].classList.toggle("sel", u === selected && !u.dead); });
    }
    markSel();
    function frame(u, kind) {
      var img = els[u.id].querySelector(".hb-img"), f = u.idle;
      if (kind === "atk") f = u.atkf[Math.floor(Math.random() * u.atkf.length)];
      if (kind === "sp") f = u.spf;
      img.src = HG.sprite(f);
    }
    function floatText(u, text, cls) {
      var f = el("div", "hb-float " + (cls || ""), text);
      els[u.id].querySelector(".hb-stage").appendChild(f);
      W(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1000);
    }
    function showBanner(text, ms) {
      banner.textContent = text; banner.classList.add("on");
      W(function () { banner.classList.remove("on"); }, ms || 700);
    }
    function find(id) { return b.A.concat(b.E).filter(function (u) { return u.id === id; })[0]; }

    function lunge(att, tgt) {
      var a = els[att.id], t = els[tgt.id];
      var ar = a.getBoundingClientRect(), tr = t.getBoundingClientRect();
      var dx = (tr.left + tr.width / 2 - ar.left - ar.width / 2) * 0.55, dy = (tr.top + tr.height / 2 - ar.top - ar.height / 2) * 0.55;
      var stage = a.querySelector(".hb-stage");
      stage.style.transition = "transform .16s ease-out";
      stage.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.08)";
      W(function () { stage.style.transition = "transform .25s ease-in"; stage.style.transform = ""; }, 260);
    }

    // Проигрываем события одного действия
    function play(evs, cb) {
      var i = 0, lastAtt = null;
      (function nx() {
        if (i >= evs.length) return W(cb, 300);
        var e = evs[i++], u, t, att;
        if (e.t === "round") { roundEl.textContent = "Раунд " + e.n; showBanner("Раунд " + e.n, 600); return W(nx, 650); }
        if (e.t === "special") { u = find(e.id); frame(u, "sp"); showBanner(e.name, 800); HG.sfx("special"); lastAtt = u; return W(nx, 650); }
        if (e.t === "guard") { u = find(e.id); upd(u); HG.sfx("block"); floatText(u, "защита", "gd"); return W(nx, 450); }
        if (e.t === "stunned") { u = find(e.id); floatText(u, "пропуск", "gd"); upd(u); return W(nx, 450); }
        if (e.t === "stun") { u = find(e.id); upd(u); floatText(u, "оглушён", "gd"); return W(nx, 250); }
        if (e.t === "heal") {
          u = find(e.to); shown[u.id] = Math.min(u.maxhp, shown[u.id] + e.amount); upd(u);
          floatText(u, "+" + e.amount, "heal"); HG.sfx("pickup"); return W(nx, 520);
        }
        if (e.t === "hit" || e.t === "reflect") {
          att = find(e.from); t = find(e.to);
          if (e.t === "hit" && !e.aoe && lastAtt !== att || (e.t === "hit" && !lastAtt)) { frame(att, "atk"); lunge(att, t); lastAtt = att; }
          else if (e.t === "hit" && e.aoe && lastAtt !== att) { lastAtt = att; }
          var delay = e.aoe ? 120 : 220;
          return W(function () {
            shown[t.id] = Math.max(0, shown[t.id] - e.dmg); upd(t);
            var te = els[t.id]; te.classList.add("hit"); W(function () { te.classList.remove("hit"); }, 260);
            floatText(t, (e.t === "reflect" ? "отразил " : "") + "-" + e.dmg + (e.crit ? "!" : ""), e.crit ? "crit" : (t.side === "A" ? "dmg-a" : "dmg"));
            HG.sfx(e.crit ? "kick" : "punch"); HG.haptic(t.side === "A" ? "medium" : "light");
            W(nx, e.aoe ? 120 : 380);
          }, delay);
        }
        if (e.t === "dead") {
          u = find(e.id); els[u.id].classList.add("dead"); HG.sfx("boom"); markSel();
          if (selected && selected.dead) selected = b.E.filter(function (x) { return !x.dead; })[0] || selected;
          markSel(); return W(nx, 420);
        }
        nx();
      })();
    }

    function resetFrames() { b.A.concat(b.E).forEach(function (u) { if (!u.dead) frame(u, "idle"); }); }

    function renderOrder() {
      var list = [cur].concat(b.queue.filter(function (u) { return !u.dead; })).slice(0, 8);
      orderBox.innerHTML = list.map(function (u, k) {
        return '<span class="ho ' + u.side + (k === 0 ? " now" : "") + '"><img alt="" src="' + HG.sprite(u.idle) + '"></span>';
      }).join("");
    }

    function finish(win) {
      over = true; HG.music(S.loc);
      bar.innerHTML = "";
      W(function () {
        root.classList.add("off");
        W(function () { if (root.parentNode) root.parentNode.removeChild(root); done(win ? "win" : "lose"); }, 260);
      }, 500);
    }

    function loop() {
      if (!HG.alive || over) return;
      var r = Core.next(b);
      if (!r.unit) return finish(b.winner === "A");
      cur = r.unit;
      play(r.events, function () {
        if (!HG.alive) return;
        if (b.over) return finish(b.winner === "A");
        b.A.concat(b.E).forEach(function (u) { if (!u.dead) upd(u); });
        Object.keys(els).forEach(function (id) { els[id].classList.toggle("act", id === cur.id); });
        renderOrder();
        if (cur.side === "E") {
          bar.innerHTML = '<div class="hb-wait">Ходит ' + cur.name + '…</div>';
          return W(function () { act(Core.aiAction(b, cur)); }, 550);
        }
        playerTurn();
      });
    }

    function act(a) {
      bar.innerHTML = "";
      var u = cur, evs = Core.act(b, u, a);
      play(evs, function () {
        resetFrames();
        if (b.over) return finish(b.winner === "A");
        loop();
      });
    }

    function playerTurn() {
      var u = cur, canSp = u.sp && u.cd <= 0;
      if (!selected || selected.dead) selected = b.E.filter(function (x) { return !x.dead; })[0];
      markSel();
      var spTxt = u.sp ? u.sp.name + (canSp ? "" : " (через " + u.cd + ")") : "";
      bar.innerHTML = '<div class="hb-who"><b>' + u.name + '</b><span>HP ' + u.hp + '/' + u.maxhp + (selected ? " · цель: " + selected.name : "") + '</span></div>' +
        '<div class="hb-btns"><button class="btn hb-atk">Атака</button>' +
        '<button class="btn hb-sp' + (canSp ? "" : " off") + '">' + spTxt + '</button>' +
        '<button class="btn ghost hb-def">Защита</button></div>';
      bar.querySelector(".hb-atk").onclick = function () { HG.haptic("light"); act({ type: "attack", target: selected }); };
      bar.querySelector(".hb-def").onclick = function () { HG.haptic("light"); act({ type: "defend" }); };
      bar.querySelector(".hb-sp").onclick = function () {
        if (!canSp) { HG.api.toast("Умение ещё не готово"); HG.sfx("error"); return; }
        HG.haptic("medium"); act({ type: "special", target: selected });
      };
    }

    requestAnimationFrame(function () { root.classList.add("on"); });
    showBanner(enc.name, 900);
    W(loop, 700);
  }

  // ---------- Поток: подготовка → бой → итог (победные шаги выполняет вызывающий) ----------
  HG.fightFlow = function (encId, winSteps, cb) {
    var S = HG.S, mob = HG.curMob;
    function attempt() {
      prep(encId, function (go) {
        if (!go) return cb(false);
        battle(encId, function (res) {
          if (res === "win") {
            if (mob) { S.defeated[mob.id] = S.day; }
            S.fails[encId] = 0; HG.save(); HG.hud();
            HG.sfx("success"); HG.haptic("success");
            if (HG.refreshMap) HG.refreshMap();
            HG.popup({ kicker: "Победа", title: DT.ENC[encId].name + " разбит", text: "Команда цела и бодра." }, function () {
              HG.run(winSteps, function () { cb(true); });
            });
          } else {
            S.fails[encId] = (S.fails[encId] || 0) + 1;
            var note = "Команда отдышится и попробует снова.";
            if (S.fails[encId] % 3 === 0 && (S.assist[encId] || 0) < 2) {
              S.assist[encId] = (S.assist[encId] || 0) + 1;
              note = "Враги заметно приуныли: бой стал чуть легче.";
            }
            HG.save(); HG.sfx("error"); HG.haptic("error");
            HG.popup({ kicker: "Поражение", title: "Не вышло", text: note, btn: "Ещё раз" }, attempt);
          }
        });
      });
    }
    attempt();
  };
})();
