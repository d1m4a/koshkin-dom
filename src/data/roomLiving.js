// Описание первой комнаты ДАННЫМИ: список слоёв со скоростью прокрутки,
// порядком отрисовки и функцией отрисовки. Система ParallaxLayers про эту
// комнату ничего не знает — она умеет только собирать слои по такому описанию.

import { CONFIG, layerWidth } from '../config.js';
import { HEX } from '../palette.js';
import {
  pencilLine,
  pencilRect,
  pencilShape,
  pencilCircle,
  pencilLeaf,
  hatch,
  tuft,
  resetSeed,
} from '../render/pencil.js';

const { PARALLAX: P, DEPTH: D, FLOOR_Y, HEIGHT } = CONFIG;

// Проём окна — в координатах слоя стены (он едет со скоростью 0.8).
// Центр 1120 подобран так, чтобы окно оказалось ровно над мировой точкой 1280
// (там место для сна «подоконник»), когда кот стоит на ней в центре кадра.
export const WINDOW = { x: 890, y: 88, w: 460, h: 212 };

// ---------------------------------------------------------------- вид в окно
// Самый дальний план: светлее всех и почти без деталей. Тайл: горизонт идёт
// через всю ширину, деревья не подходят к краям — стык не виден.
function drawWindowView(g, W, H) {
  const horizon = H - 46;
  pencilLine(g, 0, horizon, W, horizon, { color: HEX.GRAPHITE_3, alpha: 0.7, width: 1, passes: 1, jitter: 0.8 });

  const conifer = (x, h, w) => {
    const pts = [[x, horizon]];
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const y = horizon - h * t;
      const half = (w / 2) * (1 - t);
      pts.push([x - half, y]);
      pts.push([x - half * 0.6, y - h / steps / 2]);
    }
    pts.push([x, horizon - h]);
    for (let i = steps - 1; i >= 0; i--) {
      const t = i / steps;
      const y = horizon - h * t;
      const half = (w / 2) * (1 - t);
      pts.push([x + half * 0.6, y - h / steps / 2]);
      pts.push([x + half, y]);
    }
    pencilShape(g, pts, {
      color: HEX.GRAPHITE_3,
      alpha: 0.55,
      width: 0.9,
      jitter: 0.7,
      step: 9,
      passes: 1,
      fill: HEX.GRAPHITE_4,
      fillAlpha: 0.35,
    });
  };

  // Дальний дом — как на референсе: скат крыши и пара столбов.
  pencilShape(
    g,
    [
      [250, horizon],
      [250, horizon - 54],
      [318, horizon - 82],
      [386, horizon - 54],
      [386, horizon],
    ],
    { color: HEX.GRAPHITE_3, alpha: 0.5, width: 1, jitter: 0.6, passes: 1, fill: HEX.GRAPHITE_4, fillAlpha: 0.3 }
  );
  hatch(g, 252, horizon - 78, 132, 30, { spacing: 7, alpha: 0.25, angle: 20, color: HEX.GRAPHITE_3 });

  conifer(110, 118, 62);
  conifer(168, 84, 46);
  conifer(430, 132, 70);
  conifer(486, 96, 52);
  conifer(548, 70, 40);

  // Столб с проводом — вертикаль, которая ловит взгляд при прокрутке.
  pencilLine(g, 600, horizon, 600, horizon - 104, { color: HEX.GRAPHITE_3, alpha: 0.5, width: 1, passes: 1 });
  pencilLine(g, 588, horizon - 96, 612, horizon - 96, { color: HEX.GRAPHITE_3, alpha: 0.45, width: 0.8, passes: 1 });

  // Земля за окном — редкие пучки, чтобы низ не был пустым.
  for (let x = 24; x < W; x += 46) tuft(g, x, horizon + 8, 7, { alpha: 0.35 });
}

// ------------------------------------------------------------------- стена
function drawWall(g, W) {
  const rail = 104;

  // Обои: очень светлые вертикальные полосы. Тон, а не рисунок.
  for (let x = 40; x < W; x += 72) {
    pencilLine(g, x, rail + 6, x, FLOOR_Y - 16, {
      color: HEX.GRAPHITE_4,
      alpha: 0.5,
      width: 0.8,
      jitter: 0.9,
      step: 40,
      passes: 1,
    });
  }

  // Карниз под потолком.
  pencilLine(g, 0, rail, W, rail, { color: HEX.GRAPHITE_2, alpha: 0.75, width: 1.1, passes: 1, jitter: 0.9 });
  pencilLine(g, 0, rail + 5, W, rail + 5, { color: HEX.GRAPHITE_3, alpha: 0.5, width: 0.8, passes: 1, jitter: 0.7 });

  // Плинтус. Горизонталь на высоте пола — при прокрутке слои всё равно
  // выглядят сомкнутыми, потому что горизонтальная линия не зависит от x.
  pencilLine(g, 0, FLOOR_Y - 16, W, FLOOR_Y - 16, { color: HEX.GRAPHITE_2, alpha: 0.8, width: 1.1, passes: 1 });
  pencilLine(g, 0, FLOOR_Y - 1, W, FLOOR_Y - 1, { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.2, passes: 1 });
  hatch(g, 0, FLOOR_Y - 15, W, 13, { spacing: 11, angle: 72, alpha: 0.3, color: HEX.GRAPHITE_3 });

  // Окно: рама, переплёт, подоконная доска. Внутрь проёма не штрихуем —
  // там лежит TileSprite с видом на улицу.
  const w = WINDOW;
  pencilRect(g, w.x - 14, w.y - 14, w.w + 28, w.h + 28, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });
  pencilRect(g, w.x, w.y, w.w, w.h, { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.1 });
  hatch(g, w.x - 14, w.y - 14, w.w + 28, 14, { spacing: 6, angle: 65, alpha: 0.3 });
  hatch(g, w.x - 14, w.y - 14, 14, w.h + 28, { spacing: 6, angle: 65, alpha: 0.3 });
  hatch(g, w.x + w.w, w.y - 14, 14, w.h + 28, { spacing: 6, angle: 65, alpha: 0.3 });
  // Переплёт.
  pencilLine(g, w.x + w.w / 2, w.y, w.x + w.w / 2, w.y + w.h, { color: HEX.GRAPHITE_2, alpha: 0.8, width: 1.2 });
  pencilLine(g, w.x, w.y + w.h * 0.38, w.x + w.w, w.y + w.h * 0.38, { color: HEX.GRAPHITE_2, alpha: 0.7, width: 1 });
  // Подоконная доска.
  pencilRect(g, w.x - 26, w.y + w.h + 14, w.w + 52, 12, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.2 });
  hatch(g, w.x - 26, w.y + w.h + 15, w.w + 52, 11, { spacing: 7, angle: 24, alpha: 0.28 });

  // Картины в рамах.
  const picture = (x, y, pw, ph) => {
    pencilRect(g, x, y, pw, ph, { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.2 });
    pencilRect(g, x + 7, y + 7, pw - 14, ph - 14, { color: HEX.GRAPHITE_3, alpha: 0.7, width: 0.9 });
    hatch(g, x + 8, y + 8, pw - 16, ph - 16, { spacing: 8, angle: 48, alpha: 0.35, color: HEX.GRAPHITE_3 });
  };
  picture(330, 150, 96, 118);
  picture(1640, 138, 132, 96);
  picture(1790, 168, 74, 66);

  // Настенная лампа.
  pencilLine(g, 2020, rail + 6, 2020, 196, { color: HEX.GRAPHITE_2, alpha: 0.8, width: 1.1, passes: 1 });
  pencilShape(
    g,
    [
      [1988, 196],
      [2052, 196],
      [2040, 232],
      [2000, 232],
    ],
    { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.1, fill: HEX.GRAPHITE_4, fillAlpha: 0.5 }
  );

  // Углы комнаты. На краях слоя стены они точно совпадают с краями мира:
  // при scrollX = 0 и при максимальном scrollX слой и мир выровнены,
  // а именно туда кот и уходит утыкаться.
  for (const cx of [20, W - 20]) {
    pencilLine(g, cx, rail - 26, cx, FLOOR_Y - 1, { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1.4 });
    pencilLine(g, cx - (cx < 100 ? 20 : -20), rail - 26, cx - (cx < 100 ? 20 : -20), FLOOR_Y - 1, {
      color: HEX.GRAPHITE_3,
      alpha: 0.5,
      width: 1,
      passes: 1,
    });
  }
  hatch(g, 0, rail - 26, 20, FLOOR_Y - rail + 25, { spacing: 7, angle: 74, alpha: 0.22, color: HEX.GRAPHITE_3 });
  hatch(g, W - 20, rail - 26, 20, FLOOR_Y - rail + 25, { spacing: 7, angle: 74, alpha: 0.22, color: HEX.GRAPHITE_3 });

  // Тон стены: пара мягких пятен штриховки, а не сплошная заливка.
  hatch(g, 60, rail + 20, 220, 190, { spacing: 16, angle: 62, alpha: 0.12, color: HEX.GRAPHITE_4 });
  hatch(g, 1180, rail + 24, 300, 160, { spacing: 16, angle: 62, alpha: 0.1, color: HEX.GRAPHITE_4 });
  hatch(g, 1960, rail + 40, 260, 200, { spacing: 16, angle: 62, alpha: 0.12, color: HEX.GRAPHITE_4 });
}

// -------------------------------------------------- пол, мебель, план кота
function drawRoom(g, W) {
  // Пол — одна горизонтальная линия, как требует ортогональное построение.
  pencilLine(g, 0, FLOOR_Y, W, FLOOR_Y, { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1.4 });
  pencilLine(g, 0, FLOOR_Y + 4, W, FLOOR_Y + 4, { color: HEX.GRAPHITE_3, alpha: 0.45, width: 0.9, passes: 1 });
  hatch(g, 0, FLOOR_Y + 6, W, HEIGHT - FLOOR_Y - 6, {
    spacing: 19,
    angle: 8,
    alpha: 0.17,
    color: HEX.GRAPHITE_4,
    gap: 0.3,
  });

  // Батарея.
  const radX = 260;
  const radW = 180;
  const radH = 92;
  pencilRect(g, radX, FLOOR_Y - radH, radW, radH, { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.2 });
  for (let i = 1; i < 9; i++) {
    const x = radX + (radW / 9) * i;
    pencilLine(g, x, FLOOR_Y - radH + 6, x, FLOOR_Y - 6, { color: HEX.GRAPHITE_2, alpha: 0.6, width: 1, passes: 1 });
  }
  pencilLine(g, radX - 6, FLOOR_Y - radH + 8, radX + radW + 6, FLOOR_Y - radH + 8, {
    color: HEX.GRAPHITE_2,
    alpha: 0.7,
    width: 1,
    passes: 1,
  });

  // Коврик — место «просто лечь» (мировая координата 640).
  pencilShape(
    g,
    [
      [540, FLOOR_Y],
      [760, FLOOR_Y],
      [744, FLOOR_Y + 12],
      [556, FLOOR_Y + 12],
    ],
    { color: HEX.GRAPHITE_2, alpha: 0.75, width: 1.1, fill: HEX.GRAPHITE_4, fillAlpha: 0.4 }
  );
  hatch(g, 556, FLOOR_Y + 1, 188, 11, { spacing: 9, angle: 30, alpha: 0.3 });

  // Лежанка — место «кругляш» (мировая координата 1030).
  //
  // Бортики разнесены заметно шире кота: он рисуется поверх слоя комнаты,
  // и на узкой лежанке закрыл бы их собой — читалось бы, что он не в ней,
  // а стоит перед ней. Профиль считается формулой, а не набором точек:
  // pencilShape ломаную не сглаживает, а у круглой лежанки огранка видна.
  const bedX = 1030;
  const bedR = 84; // половина ширины по внешнему краю
  const bedRim = 44; // высота бортика
  const bedSeat = 14; // высота подстилки: на ней и лежит кот
  // Верхушка бортика плоская, от RIM_A до RIM_B по ширине: без неё бортики
  // выходили острыми и читались двумя холмами, а не валиком лежанки.
  const RIM_A = 0.07;
  const RIM_B = 0.19;
  const ease = (t) => t * t * (3 - 2 * t);
  const bed = [];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    let h;
    if (u < RIM_A) h = bedRim * ease(u / RIM_A);
    else if (u < RIM_B) h = bedRim;
    else if (u < 0.5) h = bedRim + (bedSeat - bedRim) * ease((u - RIM_B) / (0.5 - RIM_B));
    else if (u < 1 - RIM_B) h = bedSeat + (bedRim - bedSeat) * ease((u - 0.5) / (0.5 - RIM_B));
    else if (u < 1 - RIM_A) h = bedRim;
    else h = bedRim * ease((1 - u) / RIM_A);
    bed.push([bedX - bedR + 2 * bedR * u, FLOOR_Y - h]);
  }
  pencilShape(g, bed, { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.2, step: 26, fill: HEX.GRAPHITE_4, fillAlpha: 0.45 });
  hatch(g, bedX - bedR + 8, FLOOR_Y - bedRim + 6, bedR * 2 - 16, bedRim - 6, { spacing: 9, angle: 34, alpha: 0.26 });

  // Низкий комод под окном — «подоконник» (мировая координата 1280).
  const chestX = 1150;
  const chestW = 280;
  const chestH = 118;
  pencilRect(g, chestX, FLOOR_Y - chestH, chestW, chestH, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });
  pencilLine(g, chestX + 4, FLOOR_Y - chestH + 44, chestX + chestW - 4, FLOOR_Y - chestH + 44, {
    color: HEX.GRAPHITE_2,
    alpha: 0.6,
    width: 1,
    passes: 1,
  });
  pencilCircle(g, chestX + chestW / 2, FLOOR_Y - chestH + 22, 5, { color: HEX.GRAPHITE_2, alpha: 0.7, width: 1, passes: 1 });
  pencilCircle(g, chestX + chestW / 2, FLOOR_Y - chestH + 74, 5, { color: HEX.GRAPHITE_2, alpha: 0.7, width: 1, passes: 1 });
  hatch(g, chestX + 2, FLOOR_Y - chestH + 2, chestW - 4, chestH - 4, { spacing: 13, angle: 66, alpha: 0.16 });
  // Подушка сверху.
  pencilShape(
    g,
    [
      [chestX + 40, FLOOR_Y - chestH],
      [chestX + 190, FLOOR_Y - chestH],
      [chestX + 180, FLOOR_Y - chestH - 22],
      [chestX + 50, FLOOR_Y - chestH - 22],
    ],
    { color: HEX.GRAPHITE_2, alpha: 0.8, width: 1.1, fill: HEX.GRAPHITE_4, fillAlpha: 0.45 }
  );

  // Диван (мировая координата 1980).
  const sofaX = 1800;
  const sofaW = 400;
  pencilRect(g, sofaX, FLOOR_Y - 96, sofaW, 96, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });
  pencilRect(g, sofaX - 6, FLOOR_Y - 168, 54, 168, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });
  pencilRect(g, sofaX + sofaW - 48, FLOOR_Y - 168, 54, 168, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });
  pencilRect(g, sofaX + 48, FLOOR_Y - 150, sofaW - 96, 60, { color: HEX.GRAPHITE_2, alpha: 0.8, width: 1.1 });
  hatch(g, sofaX + 50, FLOOR_Y - 148, sofaW - 100, 56, { spacing: 10, angle: 54, alpha: 0.22 });
  hatch(g, sofaX + 2, FLOOR_Y - 94, sofaW - 4, 92, { spacing: 12, angle: 54, alpha: 0.18 });

  // Стеллаж.
  const shX = 2270;
  const shW = 220;
  const shH = 286;
  pencilRect(g, shX, FLOOR_Y - shH, shW, shH, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });
  for (let i = 1; i < 4; i++) {
    const y = FLOOR_Y - shH + (shH / 4) * i;
    pencilLine(g, shX, y, shX + shW, y, { color: HEX.GRAPHITE_2, alpha: 0.75, width: 1.1, passes: 1 });
  }
  // Книги — вертикальные штрихи разной высоты.
  for (let i = 0; i < 4; i++) {
    const shelfY = FLOOR_Y - shH + (shH / 4) * i;
    let x = shX + 10;
    while (x < shX + shW - 26) {
      const bw = 7 + Math.round((i * 13 + x) % 9);
      const bh = 40 + ((x + i * 7) % 18);
      pencilRect(g, x, shelfY + shH / 4 - bh - 2, bw, bh, {
        color: HEX.GRAPHITE_3,
        alpha: 0.7,
        width: 0.9,
        passes: 1,
        over: 0,
      });
      x += bw + 3;
    }
  }

  // Мелочи на полу: миска и мячик.
  pencilShape(
    g,
    [
      [836, FLOOR_Y],
      [882, FLOOR_Y],
      [874, FLOOR_Y - 18],
      [844, FLOOR_Y - 18],
    ],
    { color: HEX.GRAPHITE_2, alpha: 0.85, width: 1.1, fill: HEX.GRAPHITE_4, fillAlpha: 0.4 }
  );
  pencilCircle(g, 1600, FLOOR_Y - 9, 9, { color: HEX.GRAPHITE_2, alpha: 0.8, width: 1 });

  // Пыль вдоль пола — глазу нужно за что-то цепляться при прокрутке.
  for (let x = 90; x < W; x += 150) tuft(g, x + ((x * 7) % 40), FLOOR_Y + 2, 6, { alpha: 0.3 });
}

// ------------------------------------------------------------ передний план
// Обгоняет камеру (1.15) и режет кадр снизу. Самый тёмный тон — это второй
// признак глубины помимо скорости.
function drawForeground(g, W, H) {
  // Растение в кадке.
  const px = 470;
  pencilShape(
    g,
    [
      [px - 46, H],
      [px + 46, H],
      [px + 34, H - 96],
      [px - 34, H - 96],
    ],
    { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1.5, fill: HEX.GRAPHITE_4, fillAlpha: 0.65 }
  );
  hatch(g, px - 34, H - 94, 68, 92, { spacing: 8, angle: 70, alpha: 0.4, color: HEX.GRAPHITE_2 });
  for (let i = 0; i < 9; i++) {
    const spread = (i - 4) * 0.29;
    pencilLeaf(g, px + (i - 4) * 3, H - 98, {
      angle: -Math.PI / 2 + spread,
      len: 112 + ((i * 37) % 58),
      wid: 12 + (i % 3) * 3,
      bend: spread * 0.42,
      color: HEX.GRAPHITE_1,
      alpha: 0.78,
      width: 1.2,
      fill: HEX.GRAPHITE_4,
      fillAlpha: 0.5,
    });
  }

  // Край стола со свисающей скатертью.
  const tx = 1560;
  pencilRect(g, tx, H - 150, 520, 26, { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1.5 });
  hatch(g, tx + 2, H - 148, 516, 22, { spacing: 7, angle: 22, alpha: 0.35, color: HEX.GRAPHITE_2 });
  pencilPathCloth(g, tx + 40, H - 124, 440, H);
  pencilLine(g, tx + 60, H - 124, tx + 60, H, { color: HEX.GRAPHITE_1, alpha: 0.85, width: 1.4, passes: 1 });
  pencilLine(g, tx + 470, H - 124, tx + 470, H, { color: HEX.GRAPHITE_1, alpha: 0.85, width: 1.4, passes: 1 });

  // Ветка листьев в правом углу.
  const lx = 2660;
  for (let i = 0; i < 6; i++) {
    const spread = (i - 3) * 0.24;
    pencilLeaf(g, lx + (i - 3) * 4, 2, {
      angle: Math.PI / 2 + spread,
      len: 84 + (i % 2) * 44,
      wid: 11 + (i % 2) * 3,
      bend: -spread * 0.5,
      color: HEX.GRAPHITE_1,
      alpha: 0.72,
      width: 1.2,
      fill: HEX.GRAPHITE_4,
      fillAlpha: 0.45,
    });
  }
}

// Скатерть: волнистый нижний край, обрезанный низом кадра.
function pencilPathCloth(g, x, y, w, H) {
  const pts = [[x, y]];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x + w * t, H - (i % 2 === 0 ? 0 : 14)]);
  }
  pts.push([x + w, y]);
  pencilShape(g, pts, { color: HEX.GRAPHITE_1, alpha: 0.85, width: 1.3, step: 20, fill: HEX.GRAPHITE_4, fillAlpha: 0.55 });
}

// Слои перечислены от дальнего к ближнему. Порядок в массиве не важен —
// важны depth и factor.
export const LAYERS = [
  {
    key: 'view-window',
    kind: 'tile',
    at: WINDOW, // положение проёма в координатах слоя стены
    textureW: 640,
    factor: P.WALL, // сам проём едет вместе со стеной…
    viewFactor: P.WINDOW, // …а картинка внутри — заметно медленнее
    depth: D.WINDOW,
    draw: (g) => drawWindowView(g, 640, WINDOW.h),
    size: [640, WINDOW.h],
  },
  {
    key: 'layer-wall',
    kind: 'image',
    factor: P.WALL,
    depth: D.WALL,
    size: [layerWidth(P.WALL), HEIGHT],
    draw: (g) => drawWall(g, layerWidth(P.WALL)),
  },
  {
    key: 'layer-room',
    kind: 'image',
    factor: P.MAIN,
    depth: D.ROOM,
    size: [layerWidth(P.MAIN), HEIGHT],
    draw: (g) => drawRoom(g, layerWidth(P.MAIN)),
  },
  {
    key: 'layer-fore',
    kind: 'image',
    factor: P.FORE,
    depth: D.FORE,
    size: [layerWidth(P.FORE), HEIGHT],
    draw: (g) => drawForeground(g, layerWidth(P.FORE), HEIGHT),
  },
];

export function resetRoomSeed() {
  resetSeed(20260908);
}
