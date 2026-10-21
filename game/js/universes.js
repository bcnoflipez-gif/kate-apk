// ============================================================
//  ВСЕЛЕННЫЕ. Каждая — отдельный мир-пародия со своей мини-игрой.
//  Сейчас это ЗАГЛУШКИ: сюжет, механики и арт добавим на следующих шагах.
//
//  Поля мира: id, title, tag, icon (ключ из ICONS), c1/c2 (цвета бейджа из палитры), ic (цвет иконки)
//  Контракт мини-игры: play(container, api)
//    container — DOM-элемент, куда рисуем игру
//    api.complete()  — вызвать, когда мир пройден
//    api.toast(txt)  — показать подсказку
//    api.haptic(kind) — 'light' | 'medium' | 'success' | 'error'
// ============================================================
window.UNIVERSES = [
  {
    id: "mk",
    title: "Пизделка",
    tag: "Файтинг",
    banner: "assets/hub/banner_mk.webp",
    icon: "fist", c1: "#6E3377", c2: "#6A4DD4", ic: "#E2ECF5",
    intro: [
      { who: "Голос арены", text: "FIGHT!" }
    ],
    play: function (c, api) { window.MKGame.play(c, api); }
  },
  {
    id: "heroes",
    title: "Тусич",
    tag: "Пошаговая стратегия",
    banner: "assets/hub/banner_heroes.webp",
    icon: "castle", c1: "#6A4DD4", c2: "#A4A7E3", ic: "#E2ECF5",
    intro: [
      { who: "Хранитель", text: "Королевство ждёт своего героя. Или героиню." }
    ],
    play: function (c, api) { window.HG.start(c, api); }
  },
  {
    id: "tanks",
    title: "SVO",
    tag: "Аркада",
    banner: "assets/hub/banner_tanks.webp",
    icon: "tank", c1: "#A4A7E3", c2: "#E2ECF5", ic: "#000229",
    intro: [
      { who: "Штаб", text: "Защити базу. Орёл не должен пасть." }
    ],
    play: function (c, api) { window.TanksGame.play(c, api); }
  }
];

// Финал: диалог + слайдшоу с субтитрами + салют (логика в app.js, здесь только данные).
window.FINALE = {
  music: "assets/audio/finish.mp3",
  kasi: "Как хорошо, что мы столько всего прошли, целых 3 игры",
  // Реплики Вана становятся субтитрами поверх фото
  van: [
    "Даа Кать, и не только 3 игры но и целую нашу жизнь.",
    "Я очень рад что у меня есть такая сестра как ты!",
    "Мы разъебывали постоянно, что в играх, что в жизни.",
    "И только сильнее будем всех разъёбывать!",
    "Не грусти и не отчаивайся - с Днём рождения!",
    "24 года разъёба и больше впереди - Люблю тебя!"
  ],
  photos: ["first-saint-p", "skin-mask", "van_sleep", "china", "concert", "koreliya", "queen-prince-2", "queen-prince"],
  lastPhoto: "sweet-cake"
};

// Универсальная заглушка мира: показывает карточку и кнопку «пройти».
function stubGame(iconKey, name, description) {
  return function (container, api) {
    container.innerHTML =
      '<div class="world-card">' +
      '<div class="world-icon">' + window.ICONS[iconKey] + '</div>' +
      '<h1>' + name + '</h1>' +
      '<p class="muted">' + description + '</p>' +
      '<button class="btn" id="stub-complete">Пройти (заглушка)</button>' +
      '</div>';
    container.querySelector("#stub-complete").addEventListener("click", function () {
      api.haptic("success");
      api.complete();
    });
  };
}
