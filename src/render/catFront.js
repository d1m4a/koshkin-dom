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

// Хвост лежит на полу и уходит вправо: сидящему коту им и метут.
// Первая точка — основание у правой лапы, дальше по длине.
// Координаты — в той же системе, что и BODY: сдвиг PAD_Y добавляется при
// отрисовке. Без этого хвост висел на четыре пикселя выше пола, чем корпус.
const TAIL = [
  [92, 123, 4.4], [102, 123, 3.8], [111, 122, 3.1], [119, 121, 2.4], [127, 119, 1.7],
];
const TAIL_BASE = TAIL[0];
// Насколько кончик опускается, идя к зрителю, и приподнимается, уходя назад.
// Ниже линии пола значит ближе — вся глубина, какая есть в ортогональной
// проекции. Через силуэт хвост не проводится вовсе: тёмное по тёмному не
// читается ни при каком порядке отрисовки, и на дальней фазе он честно
// прячется за лапой, как и у настоящего кота.
const TAIL_DIP = 6;

const rot = (p, cx, cy, a) => {
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

// sit:      0 — кот ещё разворачивается (силуэт узкий), 1 — сидит
// blink:    0..1 — веки
// earR:     0..1 — дёрнулось правое ухо, резко
// earL:     0..1 — повело левым ухом, медленнее правого
// tailSwing:-1..1 — хвост метёт по полу, минус влево, плюс вправо
// breath:   0..1 — дыхание
// meow:     0..1 — раскрытие рта
export function drawCatFront(g, { sit = 1, blink = 0, earR = 0, earL = 0, tailSwing = 0, breath = 0, meow = 0 } = {}) {
  // Разворот к игроку изображается сжатием по горизонтали: кот как бы
  // поворачивается боком к нам. Отдельная анимация поворота не нужна.
  const sx = 0.35 + 0.65 * sit;
  const sy = 0.9 + 0.1 * sit;
  const lift = -breath * 1.2;
  const HEAD_Y = 62;

  // ear: 'L' или 'R' — только для точек соответствующего уха. Раньше сюда
  // по индексам попадали и точки глаза, и глаз уезжал вместе с ухом.
  const place = ([x, y], ear = null) => {
    let p = [x, y];
    if (ear === 'R' && earR) p = rot(p, 74, 46, -earR * 0.3);
    if (ear === 'L' && earL) p = rot(p, 58, 46, earL * 0.26);
    return [CX + (p[0] - CX) * sx, FLOOR - (FLOOR - p[1]) * sy + lift];
  };

  // Хвост метёт по полу. Смотрим на кота спереди, поэтому мах — это поворот
  // в плоскости пола: хвост не поднимается, а укорачивается, уходя от зрителя
  // или к нему, и снова вытягивается вбок. Отсюда косинус на длину и синус
  // на подъём кончика.
  const angle = tailSwing * 1.15;
  const shorten = Math.cos(angle);
  const left = [];
  const right = [];
  TAIL.forEach(([x, y, r], i) => {
    const along = x - TAIL_BASE[0]; // сколько прошли от основания
    const k = i / (TAIL.length - 1);
    const fx = TAIL_BASE[0] + along * shorten;
    // k в степени: хвост гнётся дугой, а не наклоняется палкой.
    const fy = y + Math.sin(angle) * Math.pow(k, 1.5) * TAIL_DIP;
    const [px, py] = place([fx, fy]);
    left.push([px, py - r * sy]);
    right.push([px, py + r * sy]);
  });
  const tailShape = smoothClosed([...left, ...right.reverse()], 4).map(([x, y]) => [x, y + PAD_Y]);
  pencilShape(g, tailShape, { ...SKIN });

  // Точки 0..2 — левое ухо, 4..6 — правое.
  const bodyPts = BODY.map((p, i) => place(p, i <= 2 ? 'L' : i >= 4 && i <= 6 ? 'R' : null));
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
