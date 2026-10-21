// ============================================================
//  Плеер видео с прозрачностью для iPhone и всех браузеров.
//  Видео хранится как H.264 «цвет слева + маска справа» (премультиплицированный цвет).
//  WebGL собирает из двух половин картинку с альфа-каналом, поэтому персонажи
//  «стоят» прямо на фоне игры. Если WebGL или автозапуск недоступны, вызывается onFail.
//
//  AlphaVideo.create(container, {
//    src, width, height,       // width/height: размер ОДНОЙ половины кадра (без маски)
//    revealAt,                 // секунда, на которой вызвать onReveal (например, показать кнопку)
//    onReveal, onEnd, onFail
//  }) -> { destroy() }
// ============================================================
(function () {
  "use strict";

  var VS = "attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }";
  var FS = "precision mediump float; varying vec2 v; uniform sampler2D t;" +
    "void main(){ vec2 uv = vec2(v.x, 1. - v.y);" +
    "  float a = texture2D(t, vec2(.5 + uv.x * .5, uv.y)).r;" +
    "  vec3 c = texture2D(t, vec2(uv.x * .5, uv.y)).rgb;" +
    "  gl_FragColor = vec4(min(c, vec3(a)), a); }";

  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader");
    return s;
  }

  function create(container, o) {
    var done = false, revealed = false, raf = 0, failTimer = 0, video = null, canvas = null;

    function fail() {
      if (done) return;
      done = true; cleanup();
      if (o.onFail) o.onFail();
    }
    function cleanup() {
      cancelAnimationFrame(raf); clearTimeout(failTimer);
      if (video) { try { video.pause(); } catch (e) {} }
    }

    try {
      canvas = document.createElement("canvas");
      canvas.width = o.width; canvas.height = o.height;
      canvas.className = "alpha-canvas";
      var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) throw new Error("no webgl");

      var prog = gl.createProgram();
      gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.clearColor(0, 0, 0, 0);

      video = document.createElement("video");
      video.muted = true; video.defaultMuted = true; video.playsInline = true; video.loop = false;
      video.setAttribute("muted", ""); video.setAttribute("playsinline", ""); video.setAttribute("webkit-playsinline", "");
      video.preload = "auto"; video.crossOrigin = "anonymous";
      video.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";
      video.src = o.src;

      container.appendChild(canvas);
      container.appendChild(video);

      var started = false;
      function draw() {
        if (done) return;
        if (video.readyState >= 2 && video.currentTime !== lastT) {
          lastT = video.currentTime;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          if (!revealed && o.revealAt != null && video.currentTime >= o.revealAt) {
            revealed = true; if (o.onReveal) o.onReveal();
          }
        }
        schedule();
      }
      // рисуем только когда сменился кадр видео (24 к/с вместо 60): экономит батарею и убирает лаги
      var lastT = -1, useRVFC = typeof video.requestVideoFrameCallback === "function";
      function schedule() {
        if (done || video.ended) return;
        if (useRVFC) video.requestVideoFrameCallback(function () { draw(); });
        else raf = requestAnimationFrame(draw);
      }

      video.addEventListener("playing", function () {
        if (started) return; started = true; clearTimeout(failTimer);
        canvas.classList.add("on");
        draw();
      });
      video.addEventListener("ended", function () {
        if (done) return;
        // дорисовываем последний кадр и сообщаем об окончании
        if (video.readyState >= 2) {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        if (!revealed) { revealed = true; if (o.onReveal) o.onReveal(); }
        if (o.onEnd) o.onEnd();
      });
      video.addEventListener("error", fail);

      var p = video.play();
      if (p && p.catch) p.catch(fail);
      failTimer = setTimeout(function () { if (!started) fail(); }, 3500); // не стартовало: запасной вариант
    } catch (e) {
      fail();
    }

    return {
      destroy: function () {
        done = true; cleanup();
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (video && video.parentNode) video.parentNode.removeChild(video);
      }
    };
  }

  window.AlphaVideo = { create: create };
})();
