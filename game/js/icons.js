// ============================================================
//  ИКОНКИ: собственные SVG (никаких эмодзи). Линейный стиль, цвет берётся из currentColor.
//  Использование: ICONS.castle, ICONS.sparkle и т.д.
// ============================================================
(function () {
  "use strict";

  function line(inner, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + '>' + inner + '</svg>';
  }

  // Острый «взрыв» (для боя): 10 лучей, считаем точки кодом, чтобы форма была ровной
  function burst(cx, cy, rOuter, rInner, n) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 === 0 ? rOuter : rInner;
      var a = -Math.PI / 2 + i * Math.PI / n;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2));
    }
    return "M" + pts.join("L") + "Z";
  }

  var ICONS = {
    // Миры
    castle: line(
      '<path d="M4 21V8h3v2h2V8h2v2h2V8h2v2h2V8h3v13z"/>' +
      '<path d="M10 21v-4a2 2 0 0 1 4 0v4"/>' +
      '<path d="M12 8V3.2l3.6 1.4L12 6"/>'),
    fist: line(
      '<path d="' + burst(12, 12, 10, 5.2, 8) + '"/>' +
      '<path d="M12.8 8.2l-3 4.2h2.6l-1 3.4 3.4-4.6h-2.7z"/>'),
    tank: line(
      '<rect x="2.5" y="14.5" width="19" height="5.5" rx="2.75"/>' +
      '<path d="M5.5 14.5v-2.2h13v2.2"/>' +
      '<rect x="8" y="8.3" width="7" height="4" rx="1.2"/>' +
      '<path d="M15 10.3h6.5"/>' +
      '<circle cx="7" cy="17.25" r=".6"/><circle cx="12" cy="17.25" r=".6"/><circle cx="17" cy="17.25" r=".6"/>'),
    swords: line(
      '<path d="M5 3l11 11M13 17l6-6M16 14l3 3"/><circle cx="20.2" cy="18.2" r=".9"/>' +
      '<path d="M19 3L8 14M11 17L5 11M8 14l-3 3"/><circle cx="3.8" cy="18.2" r=".9"/>'),
    rewind: line(
      '<path d="M3.2 12a8.8 8.8 0 1 0 2.9-6.5"/>' +
      '<path d="M3 4.2v4.6h4.6"/>' +
      '<path d="M12 7.5V12l3 1.8"/>'),

    // Интерфейс
    lock: line('<rect x="5" y="11" width="14" height="10" rx="2.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    check: line('<path d="M5 12.8l4.4 4.4L19 7.6"/>'),
    speaker: line('<path d="M4 9.6v4.8h3.6l4.4 4V5.6l-4.4 4z"/><path d="M15.6 9a4.4 4.4 0 0 1 0 6M18.4 6.4a8.4 8.4 0 0 1 0 11.2"/>'),
    speakerOff: line('<path d="M4 9.6v4.8h3.6l4.4 4V5.6l-4.4 4z"/><path d="M16 9.6l5 4.8M21 9.6l-5 4.8"/>'),
    phone: line('<rect x="7" y="2.8" width="10" height="18.4" rx="2.8"/><path d="M10.6 18.2h2.8"/>'),
    back: line('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),

    // Фирменная 4-лучевая звезда (залитая), как на постере палитры
    sparkle: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z"/></svg>'
  };

  window.ICONS = ICONS;
})();
