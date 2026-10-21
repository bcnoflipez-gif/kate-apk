// ============================================================
//  HEROES OF MAGIC: сюжет и карты.
//  Тексты, расклад карт, предметы, сцены. Править можно прямо здесь.
//
//  Карта: grid[] строки одинаковой длины (7 колонок). Символ = клетка по легенде LEG.
//    g: тайл земли (assets/heroes/tiles/<loc>_<g>.webp), o: объект поверх (assets/heroes/objs/<o>.webp),
//    blk: непроходимо (по умолчанию проходимы только клетки без o), walk: проходимо, несмотря на o
//  Сущности: coin / buff / exit / mob / npc / trigger / item / station / castle.
//  Сцены: массив шагов {say} {choose} {video} {give} {join} {fight} {flag} {audio} {photo} {goto} {finale} {artlist}
// ============================================================
(function (root) {
  "use strict";
  var S = {};

  // ---------- Предметы ----------
  S.ARTS = {
    ring:    { name: "Кольцо",              icon: "items/ring",    video: "ring",     line: "Оно одно, но их два." },
    leopard: { name: "Леопардовая накидка",  icon: "items/leopard", video: "leopard",  line: "Мягкая. Пахнет болотом, но вайб есть." },
    cigs:    { name: "Сигареты",             icon: "items/cigs",    video: "cigarets", line: "Пачка престижная." },
    bandana: { name: "Бандана",              icon: "items/bandana", video: "banda",    line: "Чёрная. Чтобы чужие боялись!" },
    skate:   { name: "Скейт",                icon: "items/skate",   video: "skate",    line: "Ван будет рад." },
    mirror:  { name: "Зеркало",              icon: "items/mirror",  video: "tver_all", line: "Отражает часть урона по команде.", optional: true }
  };
  S.MAIN = ["ring", "leopard", "cigs", "bandana", "skate"];

  S.BUFFS = {
    atk:  { name: "Сила",       icon: "ui/atk",   text: "Кася бьёт сильнее" },
    def:  { name: "Броня",      icon: "ui/def",   text: "Кася получает меньше урона" },
    hp:   { name: "Здоровье",   icon: "ui/hp",    text: "У Каси больше здоровья" },
    luck: { name: "Удача",      icon: "ui/luck",  text: "Кася чаще бьёт критом" },
    spd:  { name: "Скорость",   icon: "ui/speed", text: "Кася ходит раньше" }
  };

  // Размер объектов на карте (в клетках по ширине). full: тайл целиком (растягиваем на клетку)
  S.OBJ = {
    loc1_barrels: { w: 1.15 }, loc1_balcony: { w: 1.15 }, loc1_laundry: { w: 1.05 }, loc1_lamp: { w: 0.85 }, loc1_gate: { w: 1.0 },
    loc2_tree: { w: 1.0 }, loc2_pond: { w: 1.25 }, loc2_bench1: { w: 1.15 }, loc2_bench2: { w: 1.15 }, loc2_stump: { w: 1.1 }, loc2_horse: { w: 1.1 },
    loc3_bush: { w: 1, full: 1 }, loc3_chain: { w: 1, full: 1 }, loc3_bridge: { w: 1, full: 1 }, loc3_lamp: { w: 1, full: 1 },
    loc3_tree: { w: 1, full: 1 }, loc3_rostral: { w: 1, full: 1 }, loc3_isaac: { w: 1.7 },
    loc4_maple: { w: 1.4 }, loc4_bench: { w: 1.15 }, loc4_fence: { w: 1.15 }, loc4_bridge: { w: 1.2 }, loc4_kiosk: { w: 0.95 },
    loc4_lamp: { w: 0.8 }, loc4_pile: { w: 1.1 }, loc4_hedge: { w: 1.2 },
    castle: { w: 3.3 }, ferris: { w: 2.4 }, tent: { w: 1.7 }, chest: { w: 0.95 }
  };

  // ---------- Локации ----------
  var LEG = {
    loc1: {
      a: { g: "wallA" }, b: { g: "wallB" }, r: { g: "road" }, "#": { g: "wallA", blk: 1 },
      B: { g: "wallA", o: "loc1_barrels" }, F: { g: "wallA", o: "loc1_balcony" }, L: { g: "wallA", o: "loc1_laundry" },
      P: { g: "wallA", o: "loc1_lamp" }, G: { g: "wallA", o: "loc1_gate" }
    },
    loc2: {
      ",": { g: "grass" }, m: { g: "mud" }, r: { g: "road" }, "#": { g: "grass", blk: 1 },
      T: { g: "grass", o: "loc2_tree" }, p: { g: "mud", o: "loc2_pond" }, B: { g: "grass", o: "loc2_bench1" },
      C: { g: "grass", o: "loc2_bench2" }, S: { g: "grass", o: "loc2_stump" }, H: { g: "mud", o: "loc2_horse" }
    },
    loc3: {
      g: { g: "grass" }, p: { g: "pave" }, r: { g: "road" }, "#": { g: "pave", blk: 1 },
      U: { g: "grass", o: "loc3_bush" }, C: { g: "pave", o: "loc3_chain" }, W: { g: "pave", o: "loc3_bridge", walk: 1 },
      L: { g: "pave", o: "loc3_lamp" }, E: { g: "pave", o: "loc3_tree" }, R: { g: "pave", o: "loc3_rostral" },
      I: { g: "pave", o: "loc3_isaac" }, K: { g: "pave", o: "loc4_kiosk" }
    },
    loc4: {
      l: { g: "leaves" }, v: { g: "pave" }, h: { g: "path" }, "#": { g: "leaves", blk: 1 },
      M: { g: "leaves", o: "loc4_maple" }, N: { g: "leaves", o: "loc4_bench" }, F: { g: "leaves", o: "loc4_fence" },
      K: { g: "leaves", o: "loc4_kiosk" }, P: { g: "leaves", o: "loc4_lamp" }, Y: { g: "leaves", o: "loc4_pile" },
      W: { g: "path", o: "loc4_bridge", walk: 1 }
    }
  };

  function coins(loc, list) { return list.map(function (p, i) { return { type: "coin", id: loc + "_c" + i, x: p[0], y: p[1] }; }); }

  S.LOCS = {
    // ===== 1. Замок в Испании =====
    loc1: {
      name: "Замок в Испании", bg: "assets/heroes/bg/loc1.webp", cols: 7, tint: "#a8603a",
      legend: LEG.loc1,
      grid: [
        "FB###BF",
        "FL###LF",
        "Parrrab",
        "BarrrbL",
        "Fbrrrab",
        "LarrrbP",
        "BbrrraB",
        "FbrrraF",
        "GFrrrFG"
      ],
      decor: [{ obj: "castle", x: 1.85, y: 0, w: 3.3, bottomRow: 1 }],
      spawn: { x: 3, y: 4 },
      entities: [].concat(coins("loc1", [[2, 4], [4, 6], [3, 7], [2, 2]]), [
        { type: "castle", id: "castle", x: 3, y: 1, label: "Замок" },
        { type: "buff", id: "b_atk1", x: 4, y: 3, buff: "atk" },
        { type: "exit", id: "loc1_down", x: 3, y: 8, to: { loc: "loc2", x: 3, y: 1 }, label: "Дальше" }
      ])
    },

    // ===== 2. Аттракцион мёртвых =====
    loc2: {
      name: "Аттракцион мёртвых", bg: "assets/heroes/bg/loc2.webp", cols: 7, tint: "#2c6a58",
      legend: LEG.loc2,
      grid: [
        "TT,r,TT",
        "Tm,r,mT",
        "TB,r,CT",
        "T,mrm,T",
        "TSmrm#T",
        "T,,r,,T",
        "TpmrmHT",
        "T,,r,,T",
        "Tm,r,mT",
        "TS,r,ST",
        "TT,r,TT"
      ],
      decor: [
        { obj: "tent", x: 4.55, y: 3.1, w: 1.7, bottomRow: 4 },
        { obj: "ferris", x: 4.9, y: 6.4, w: 2.2, bottomRow: 9 }
      ],
      spawn: { x: 3, y: 1 },
      onEnterOnce: [{ video: "attractions" }],
      entities: [].concat(coins("loc2", [[2, 1], [4, 2], [2, 5], [4, 7], [2, 9]]), [
        { type: "exit", id: "loc2_up", x: 3, y: 0, to: { loc: "loc1", x: 3, y: 7 }, label: "Назад" },
        { type: "buff", id: "b_def1", x: 1, y: 5, buff: "def" },
        { type: "npc", id: "trader", x: 3, y: 4, sprite: "saler_idle", name: "Торговец", hideIf: "j_saler", scene: "trader" },
        { type: "mob", id: "m_nightmare", x: 3, y: 8, enc: "nightmare", sprite: "nightmare_idle", scene: "nightmare" },
        { type: "item", id: "i_ring", x: 3, y: 9, art: "ring", req: "d_m_nightmare" },
        { type: "exit", id: "loc2_down", x: 3, y: 10, to: { loc: "loc3", x: 3, y: 1 }, label: "Дальше" }
      ])
    },

    // ===== 3. Город «Болотный Сранк Тебе Врук»: окраина, мост, Питер =====
    loc3: {
      name: "Болотный Сранк Тебе Врук", bg: "assets/heroes/bg/loc3.webp", cols: 7, tint: "#7b5a9a",
      legend: LEG.loc3,
      grid: [
        "UUUrUUU",
        "UggrggU",
        "UgprpgU",
        "UgprpgU",
        "UggrggU",
        "UgggggU",
        "UUUrUUU",
        "UgggggU",
        "UgprpgU",
        "CCCWCCC",
        "LpprppL",
        "EpprppE",
        "EKppppE",
        "pRpppIp",
        "pEprpEp",
        "UUUrUUU",
        "ppprppp",
        "LpprppL",
        "UUUrUUU"
      ],
      decor: [],
      zones: [{ from: 0, to: 8, name: "Болотный Сранк" }, { from: 10, to: 18, name: "Питер" }],
      spawn: { x: 3, y: 1 },
      entities: [].concat(coins("loc3", [[2, 1], [4, 2], [2, 4], [4, 5], [4, 8], [2, 11], [4, 14], [2, 17]]), [
        { type: "exit", id: "loc3_up", x: 3, y: 0, to: { loc: "loc2", x: 3, y: 9 }, label: "Назад" },
        { type: "buff", id: "b_hp1", x: 1, y: 3, buff: "hp" },
        { type: "mob", id: "m_swamp", x: 3, y: 6, enc: "swamp", sprite: "swamp_idle", scene: "swamp" },
        { type: "trigger", id: "t_bridge", x: 3, y: 9, scene: "bridge" },
        { type: "station", id: "kompy", x: 1, y: 12, game: "kompy", label: "Компы" },
        { type: "buff", id: "b_luck1", x: 4, y: 13, buff: "luck" },
        { type: "mob", id: "m_garb", x: 3, y: 15, enc: "garb", sprite: "gar1_idle", scene: "garb" },
        { type: "exit", id: "loc3_down", x: 3, y: 18, to: { loc: "loc4", x: 3, y: 1 }, label: "Дальше" }
      ])
    },

    // ===== 4. «Верхневолжская Тварь» =====
    loc4: {
      name: "Верхневолжская Тварь", bg: "assets/heroes/bg/loc4.webp", cols: 7, tint: "#c98a2b",
      legend: LEG.loc4,
      grid: [
        "MMMhMMM",
        "MllhllM",
        "MlvhvlM",
        "MNvhvKM",
        "MllhllM",
        "MlllllM",
        "MllhllM",
        "MllhFlM",
        "MllhlFM",
        "MFFWFFM",
        "MllhllM",
        "MlvhvlM",
        "MMMhMMM",
        "MllhllM",
        "MlPhPlM",
        "MMMhMMM",
        "MllhllM",
        "MlYhYlM",
        "MMMMMMM"
      ],
      decor: [],
      zones: [{ from: 0, to: 8, name: "Аллея" }, { from: 10, to: 18, name: "За мостом" }],
      spawn: { x: 3, y: 1 },
      entities: [].concat(coins("loc4", [[2, 1], [4, 4], [2, 6], [1, 10], [5, 11], [2, 13], [4, 14], [2, 16]]), [
        { type: "exit", id: "loc4_up", x: 3, y: 0, to: { loc: "loc3", x: 3, y: 17 }, label: "Назад" },
        { type: "trigger", id: "t_meet", x: 3, y: 2, scene: "meet", until: "j_denchik" },
        { type: "npc", id: "n_miha", x: 2, y: 2, sprite: "miha_idle", name: "Миха", hideIf: "j_miha", scene: "meet" },
        { type: "npc", id: "n_denchik", x: 4, y: 2, sprite: "denchik_idle", name: "Денчик", hideIf: "j_denchik", scene: "meet" },
        { type: "station", id: "arm", x: 1, y: 3, game: "arm", label: "Арена Михи", req: "j_miha" },
        { type: "station", id: "cups", x: 5, y: 3, game: "cups", label: "Стаканы", req: "j_denchik" },
        { type: "buff", id: "b_spd1", x: 1, y: 5, buff: "spd" },
        { type: "mob", id: "m_krug", x: 5, y: 6, enc: "krug", sprite: "krugpug_idle", scene: "krug", optional: true },
        { type: "item", id: "i_mirror", x: 5, y: 7, art: "mirror", req: "d_m_krug" },
        { type: "mob", id: "m_dymka", x: 3, y: 12, enc: "dymka", sprite: "smoker_idle", scene: "dymka" },
        { type: "buff", id: "b_atk2", x: 5, y: 13, buff: "atk" },
        { type: "mob", id: "m_barinov", x: 3, y: 15, enc: "barinov", sprite: "barinov_idle", scene: "barinov" },
        { type: "item", id: "i_skate", x: 3, y: 16, art: "skate", req: "f_barinov_talked" }
      ])
    }
  };

  // ---------- Сцены ----------
  // Аватары: "kasi:happy" / "van:laugh" (эмоции happy, laugh, sad, surprise) или "u:<файл спрайта>"
  function K(t, e) { return { who: "Кася", av: "kasi:" + (e || "happy"), text: t }; }
  function V(t, e) { return { who: "Ван", av: "van:" + (e || "happy"), text: t }; }
  function X(who, av, t) { return { who: who, av: "u:" + av, text: t }; }

  S.SCENES = {
    prologue: [
      { photo: "van_sleep" },
      { say: [
        K("Ван, ты как?", "sad"),
        V("Лежу. Не встаю. Совсем хуево, Кась.", "sad"),
        K("Че это ты?", "surprise"),
        V("Без моих шмоток я ничё не хочу. Кольцо, леопардовая накидка, сигареты, бандана и скейт. Их разбросало по миру.", "sad"),
        K("Ну-ка не ной - пойдём. Вставай!"),
        V("Пойдемм пойдеммм77", "laugh"),
        K("Погнали. Список артефактов всегда в рюкзаке: кнопка вверху.")
      ] },
      { photo: null },
      { artlist: true },
      { flag: "prologue" }
    ],

    trader: [
      { say: [X("Торговец", "saler_idle", "О, здарова! Мою семью украл рататуй. Но у меня есть сигареты. Отличные, не как у всех.")] },
      { choose: [
        { label: "Отъебись", then: [
          { say: [
            X("Торговец", "saler_idle", "Вы не поняли. Рататуй семью украл. Я вас не отпущу!"),
            { who: "Голос", av: "icon:sparkle", text: "Торговцам никак не убрать. Его нужно впустить." }
          ] },
          { choose: [{ label: "Заебал", then: [] }] }
        ] },
        { label: "Впустить", then: [] }
      ] },
      { say: [
        X("Торговец", "saler_idle", "Спасибо люди добрые. Что дадите за сигареты?"),
        K("Нихуя себе 0_0", "surprise")
      ] },
      { video: "bad_exchange" },
      { join: "saler" },
      { say: [V("Он теперь с нами?", "surprise"), X("Торговец", "saler_idle", "С вами, я не цыган четсна. Первый раз в жизни.")] }
    ],

    nightmare: [
      { say: [
        X("Кошмар", "nightmare_idle", "Кольцо? Не отдаммм.."),
        V("Кась, мб не надо."),
        K("Мы её тоже сейчас напугаем.", "laugh")
      ] },
      { video: "undead", circle: true },
      { fight: "nightmare", win: [
        { say: [X("Кошмар", "nightmare_idle", "Всё... Кольцо вон там... Больше не буду...")] }
      ] }
    ],

    swamp: [
      { say: [
        X("Болотный сквозняк", "swamp_idle", "Эй... Давайте поговорим..."),
        K("О, привет! Нет, ты кто?", "surprise"),
        X("Болотный сквозняк", "swamp_idle", "Я сквозняк. Из болота. Меня все боятся. Ну я и обиделся.")
      ] },
      { fight: "swamp", win: [
        { say: [
          X("Болотный сквозняк", "swamp_idle", "Простите меня. Я погорячился. Вот, держи накидку. Только не прогоняй с болота!"),
          K("Леопардовая накидка!", "happy")
        ] },
        { give: "leopard" },
        { say: [K("Красиво? Ван, красиво?", "laugh"), V("Разъёб!", "laugh")] }
      ] }
    ],

    bridge: [
      { video: "saint_p", once: true }
    ],

    garb: [
      { say: [
        X("Гарбодюры", "gar1_idle", "Здарова чё как нах. Куда прёшь нах?"),
        K("Гарбодюры. Охуенно. Долбаёбики тут откуда.", "surprise"),
        V("Ща раскидаем.", "laugh")
      ] },
      { fight: "garb", win: [
        { say: [
          X("Гарбодюры", "gar1_idle", "Всё-всё, извините. Мы больше никогда не пойдём в КБ. Вот бандана, забирайте.")
        ] },
        { give: "bandana" }
      ] }
    ],

    meet: [
      { say: [
        X("Миха", "miha_idle", "О, здарова пацы! Мы к вам."),
        X("Денчик", "denchik_idle", "Ага. Я Денчик. А это Миха. Мы вдвоём, но можем втроём."),
        K("Сколько лет сколько зим!", "happy"),
        V("Давайте к нам.", "laugh")
      ] },
      { join: "miha" },
      { join: "denchik" },
      { say: [
        X("Миха", "miha_idle", "Только размяться бы. Давай поборемся на арене, там скамейка слева!"),
        X("Денчик", "denchik_idle", "А я в КБ справа стаканы раскладываю. Угадаешь, где пиво, — стану сильнее.")
      ] }
    ],

    krug: [
      { say: [
        X("Михаил Круг-Пук", "krugpug_idle", "ЭЙ молодёж, че вы как не родные?"),
        K("Ебать..", "surprise"),
        X("Михаил Круг-Пук", "krugpug_idle", "Охрана! Встречай тверичан!")
      ] },
      { fight: "krug", win: [
        { say: [X("Михаил Круг-Пук", "krugpug_idle", "Ладно, ладно. Погнал беса вшивый. Только гитару не трогайте.")] }
      ] }
    ],

    dymka: [
      { say: [
        X("Дымка", "smoker_idle", "Нихуя вы жмыхи. Вам чё на районе надо?"),
        V("Нам по делу.", "surprise"),
        X("Дымка", "smoker_idle", "Дела у всех. Малые, встречаем!")
      ] },
      { fight: "dymka", win: [
        { say: [X("Дымка", "smoker_idle", "Ёбать, престижно курить вам больше к лицу. Мы лучше гашика - держите!")] },
        { give: "cigs" }
      ] }
    ],

    barinov: [
      { say: [
        X("Крип Баринов", "barinov_idle", "Ебать здарова ебать мать! Чё вы ебать мать!"),
        K("Дай скейт погонять!", "surprise"),
        X("Крип Баринов", "barinov_idle", "Хуя се, Алконавты! Работаем.")
      ] },
      { fight: "barinov", win: [
        { audio: "barinov", who: "Крип Баринов", av: "u:barinov_idle", text: "Нихуя себе заявки еб вашу мать! Зацени блять!" },
        { flag: "f_barinov_talked" }
      ] }
    ],

    finale: [
      { photo: "queen_prince_2" },
      { say: [K("Ван, смотри, что мы принесли. Всё на месте.", "happy")] },
      { photo: "queen_prince" },
      { say: [
        V("Заебало болеть. Опять ниче не сделал.", "sad"),
        K("Да похуй. Зато погуляли с кайфом.", "laugh")
      ] },
      { finale: true }
    ]
  };

  root.HStory = S;
  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof window !== "undefined" ? window : globalThis);
