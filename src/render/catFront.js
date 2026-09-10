// Кот, сидящий анфас: смотрит на игрока.
//
// Раньше здесь был вид со спины — кот утыкался в стену. Анфас читается живее
// и, главное, даёт микрособытиям чем работать: моргание, наклон головы
// и дёрганье ухом со спины были не видны вовсе.
//
// Силуэт тёмный, поэтому морда решена глазами цвета бумаги: два светлых
// пятна на тёмном — единственные внутренние детали, как и требует правило
// «минимум внутренних линий».

import { HEX } from '../palette.js';
import { pencilShape, smoothClosed } from './pencil.js';
import { CAT_W, CAT_H } from './catBody.js';

const FLOOR = 128;
const PAD_Y = 4;
const CX = 66; // центр сидящего кота в кадре

const SKIN = { color: HEX.GRAPHITE_1, alpha: 1, width: 1.2, jitter: 0.35, step: 30, fill: HEX.GRAPHITE_1, fillAlpha: 1 };
const EYE = { color: HEX.PAPER, alpha: 1, width: 0.8, jitter: 0.2, step: 20, fill: HEX.PAPER, fillAlpha: 1 };

// Контур сидящего кота анфас. Вырез снизу по центру — просвет между
// передними лапами, без него силуэт читается мешком.
const BODY = [
  [52, 46], [46, 24], [60, 39],
  [66, 37],
  [72, 39], [86, 24], [80, 46],
  [86, 57], [88, 70], [83, 82],
  [92, 96], [100, 114], [103, 126],
  [86, 128], [70, 128], [66, 121], [62, 128], [46, 128],
  [30, 126], [33, 113], [41, 95],
  [49, 82], [44, 70], [46, 57],
];

// Хвост обёрнут вокруг правой лапы и лежит кончиком на полу.
const TAIL = [
  [98, 126, 5], [110, 124, 4.4], [119, 118, 3.6], [122, 108, 2.8], [119, 99, 2],
];

const rot = (p, cx, cy, a) => {
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

// sit:      0 — кот ещё разворачивается (силуэт узкий), 1 — сидит
// blink:    0..1 — веки
// earTilt:  0..1 — дёрнулось правое ухо
// headTilt: -1..1 — наклон головы
// tailFlick:0..1 — взмах хвостом
// breath:   0..1 — дыхание
// meow:     0..1 — раскрытие рта
export function drawCatFront(g, { sit = 1, blink = 0, earTilt = 0, headTilt = 0, tailFlick = 0, breath = 0, meow = 0 } = {}) {
  // Разворот к игроку изображается сжатием по горизонтали: кот как бы
  // поворачивается боком к нам. Отдельная анимация поворота не нужна.
  const sx = 0.35 + 0.65 * sit;
  const sy = 0.9 + 0.1 * sit;
  const lift = -breath * 1.2;
  const HEAD_Y = 62;

  // isEar задаётся только для точек уха в контуре корпуса: раньше сюда
  // попадали и точки глаза с теми же индексами, и глаз уезжал вместе с ухом.
  const place = ([x, y], isEar = false) => {
    let p = [x, y];
    // Голова и уши наклоняются целиком, корпус стоит.
    if (y < 84) p = rot(p, CX, HEAD_Y + 14, headTilt * 0.16);
    if (isEar && earTilt) p = rot(p, 74, 46, -earTilt * 0.3);
    return [CX + (p[0] - CX) * sx, FLOOR - (FLOOR - p[1]) * sy + lift];
  };

  // Хвост.
  const left = [];
  const right = [];
  TAIL.forEach(([x, y, r], i) => {
    const k = i / (TAIL.length - 1);
    const fx = x + tailFlick * k * k * 9;
    const fy = y - tailFlick * k * k * 6;
    const [px, py] = place([fx, fy]);
    left.push([px, py - r * sy]);
    right.push([px, py + r * sy]);
  });
  pencilShape(g, smoothClosed([...left, ...right.reverse()], 4), { ...SKIN });

  // Точки 4..6 — правое ухо.
  const bodyPts = BODY.map((p, i) => place(p, i >= 4 && i <= 6));
  pencilShape(g, smoothClosed(bodyPts, 6).map(([x, y]) => [x, y + PAD_Y]), { ...SKIN });

  // Глаза — узкие миндалины, а не круглые пятна: круг читается совой.
  // Верхнее веко выше нижнего, углы острые, сплайн их сохраняет.
  const rx = 6.6;
  const up = 2.5 * (1 - blink * 0.92);
  const down = 1.7 * (1 - blink * 0.92);
  for (const ex of [CX - 10, CX + 10]) {
    const pts = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      pts.push([ex - rx + 2 * rx * u, HEAD_Y - Math.sin(Math.PI * u) * up]);
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      pts.push([ex - rx + 2 * rx * u, HEAD_Y + Math.sin(Math.PI * u) * down]);
    }
    const eye = pts.map((p) => place(p));
    pencilShape(g, smoothClosed(eye, 3).map(([x, y]) => [x, y + PAD_Y]), { ...EYE });
  }

  // Рот открывается только когда кот мяукает: в остальное время морда — глаза.
  if (meow > 0.05) {
    const mw = 2.6 + 1.4 * meow;
    const mh = 1.2 + 3.2 * meow;
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([CX + Math.cos(a) * mw, HEAD_Y + 12 + Math.sin(a) * mh]);
    }
    pencilShape(g, smoothClosed(pts.map((p) => place(p)), 3).map(([x, y]) => [x, y + PAD_Y]), { ...EYE });
  }
}

export { CAT_W, CAT_H };
