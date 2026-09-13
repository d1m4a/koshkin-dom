// Кот, обведённый с присланного силуэта.
//
// Корпус с головой — контур из tools/trace-cat.cjs, он и несёт узнаваемость.
// Хвост гнётся по осевой линии, лапы считаются двухзвенной кинематикой:
// в исходнике они перекрывают друг друга и вырезать их из растра нельзя,
// а процедурные слушаются любой походки.
//
// Фазы шага взяты с присланной раскадровки: диагональная последовательность,
// задняя лапа идёт на четверть цикла раньше передней той же стороны.

import { HEX } from '../palette.js';
import { CAT_SHAPE } from '../data/catShape.js';
import { POSE_ART } from './catPoseArt.js';
import { pencilShape, pencilPath, strokePolylines, smoothClosed } from './pencil.js';

const PAD_X = 3;
const PAD_Y = 4;
export const CAT_W = Math.ceil(CAT_SHAPE.width) + PAD_X * 2;
export const CAT_H = Math.ceil(CAT_SHAPE.anchors.feetY) + PAD_Y * 2;
export const CAT_FOOT_OFFSET = CAT_H - Math.round(CAT_SHAPE.anchors.feetY) - PAD_Y;

const part = (name) => CAT_SHAPE.parts.find((p) => p.name === name);

// Разрез под лапы оставил в контуре прямую линию живота. Вшиваем вместо неё
// пологую дугу прямо в полигон: наложенная сверху заплатка давала видимый шов.
//
// Дуга строится сплайном Эрмита по касательным соседних участков контура,
// а не синусом между краями среза. Синус приходил на бедро почти
// горизонтально, сплайн силуэта держал такой излом за угол — и на стыке
// вырастала шишка. По касательной стык получается гладким с обеих сторон.
const BELLY_SAG = 3;

function withBelly(points, bellyY) {
  const n = points.length;
  const cut = points.map(([, y]) => y >= bellyY - 1.5);
  const first = cut.indexOf(true);
  if (first < 0) return points;
  let last = first;
  while (cut[(last + 1) % n]) last++;

  const at = (i) => points[((i % n) + n) % n];
  const a = at(first - 1);
  const b = at(last + 1);
  const unit = (p, q) => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  };
  const ta = unit(at(first - 2), a); // куда контур шёл, приходя к животу
  const tb = unit(b, at(last + 2)); // куда пойдёт, уходя от живота

  // Длина касательных подбирается так, чтобы низ живота остался на прежнем
  // месте: в середине сплайн Эрмита даёт (ta.y - tb.y) / 8 от этой длины.
  const drop = 0.125 * (ta[1] - tb[1]);
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const len = drop > 0.05 ? (bellyY + BELLY_SAG - (a[1] + b[1]) / 2) / drop : span * 0.35;

  const out = [];
  for (let i = 0; i < n; i++) {
    if (i === first) {
      for (let k = 1; k < 14; k++) {
        const u = k / 14;
        const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
        const h10 = u ** 3 - 2 * u ** 2 + u;
        const h01 = -2 * u ** 3 + 3 * u ** 2;
        const h11 = u ** 3 - u ** 2;
        out.push([
          h00 * a[0] + h10 * ta[0] * len + h01 * b[0] + h11 * tb[0] * len,
          h00 * a[1] + h10 * ta[1] * len + h01 * b[1] + h11 * tb[1] * len,
        ]);
      }
    }
    if (!cut[i]) out.push(points[i]);
  }
  return out;
}
const BODY = withBelly(part('body').points, CAT_SHAPE.anchors.bellyY);

// Осевую хвоста продлеваем вниз в корпус: иначе у его основания видна
// зарубка от линии разреза.
const TAIL_SPINE = (() => {
  const sp = CAT_SHAPE.tailSpine.map((p) => p.slice());
  const last = sp[sp.length - 1];
  const prev = sp[sp.length - 2];
  for (let i = 1; i <= 2; i++) {
    sp.push([last[0] + (last[0] - prev[0]) * i * 0.6, last[1] + (last[1] - prev[1]) * i * 0.6, last[2]]);
  }
  return sp;
})();
const { legs: LEG_ANCHORS, feetY: FEET_Y, bellyY: BELLY_Y } = CAT_SHAPE.anchors;

// Тёмный, но не чёрный — это самый тёмный тон палитры, #3a3a38.
// Заливка непрозрачная: части кота перекрывают друг друга, и на любой
// полупрозрачности стыки складывались бы в тёмные пятна.
const SKIN = { color: HEX.GRAPHITE_1, alpha: 1, width: 1.2, jitter: 0.35, step: 30, fill: HEX.GRAPHITE_1, fillAlpha: 1 };
// Дальняя пара лап светлее — это и есть вся «глубина» в ортогональной картинке.
const SKIN_FAR = { ...SKIN, color: HEX.GRAPHITE_2, fill: HEX.GRAPHITE_2 };

// Четыре лапы: дальняя и ближняя пара с небольшим разносом по X.
// Порядок фаз — как в раскадровке: задняя, потом передняя той же стороны.
// hind — задняя пара: у неё своя, трёхзвенная кинематика (см. hindChain).
// bend — куда выгнут единственный сустав передней лапы: локоть уходит назад.
const LEGS = [
  { x: LEG_ANCHORS[0][0] - 4, phase: 0.0, far: true, bend: -1, hind: true },
  { x: LEG_ANCHORS[1][0] - 6, phase: 0.25, far: true, bend: -1, hind: false },
  { x: LEG_ANCHORS[0][0] + 9, phase: 0.5, far: false, bend: -1, hind: true },
  { x: LEG_ANCHORS[1][0] + 7, phase: 0.75, far: false, bend: -1, hind: false },
];

// Полуширины звеньев по цепочке из пяти точек.
// Задняя лапа у кота мощнее передней: бедро — крупная мышца, к скакательному
// суставу она резко сходит на нет. Спереди почти одна кость, там прибавлять
// нечего. Одинаковая толщина всех четырёх и читалась как ходули.
const LEG_WIDTH = {
  hind: [7.6, 6.9, 3.4, 2.8, 2.3],
  fore: [5.4, 4.2, 3.4, 2.8, 2.3],
};

// Бедро прячется внутрь корпуса, иначе между лапой и телом видна бумага.
// Заднее утоплено глубже переднего: оно толще, и на общей высоте его край
// вылезал наружу через задний контур светлой шишкой.
const HIP_INSET = 10;
const HIP_INSET_HIND = 15;
const HIP_Y = BELLY_Y - HIP_INSET;
const HIP_Y_HIND = BELLY_Y - HIP_INSET_HIND;
// Кость чуть длиннее половины: иначе лапа выпрямляется в струну и упирается
// в предел кинематики — ровно от этого лапы выглядели палками.
const BONE = (FEET_Y - HIP_Y) * 0.58;
const STRIDE = 12;
const LIFT = 7;

// Куда лапа ставит стопу в данной фазе цикла.
//
// Ключевое: пока лапа на полу, она едет НАЗАД — корпус проходит над ней.
// Вперёд лапа выносится только поднятой. Если перепутать, кот идёт вперёд,
// а лапы гребут назад — «лунная походка», ровно это и было.
function pawTarget(baseX, t) {
  const a = t * Math.PI * 2;
  // a = 0 — лапа сзади и отрывается, π/2 — высшая точка выноса,
  // π — касание впереди, дальше опора и движение назад.
  const forward = -Math.cos(a);
  const lifted = Math.max(0, Math.sin(a));
  return [baseX + forward * STRIDE, FEET_Y - lifted * LIFT];
}

// Двухзвенная кинематика: сустав там, где сходятся две окружности.
// sign задаёт, в какую сторону он выгнут: +1 — вперёд, к морде.
function knee(hx, hy, px, py, bone, sign) {
  const dx = px - hx;
  const dy = py - hy;
  const d = Math.min(Math.hypot(dx, dy), bone * 2 - 0.01) || 0.01;
  const a = d / 2;
  const hgt = Math.sqrt(Math.max(0, bone * bone - a * a));
  const mx = hx + (dx * a) / d;
  const my = hy + (dy * a) / d;
  return [mx + sign * (dy / d) * hgt, my - sign * (dx / d) * hgt];
}

// Задняя лапа кота — не двухзвенная. От таза бедро идёт ВПЕРЁД к колену,
// голень оттуда НАЗАД к скакательному суставу, и только от него плюсна
// опускается к стопе. Наружу торчит назад именно скакательный сустав, пятка;
// колено спрятано в паху, его почти не видно. Именно эту пятку и принимают
// за «колено, гнущееся в обратную сторону».
//
// Двухзвенной лапой такой зигзаг не изобразить: она давала один сустав, и он
// смотрел вперёд — задние лапы выглядели человеческими ногами.
//
// Считается с конца: сначала от стопы отмеряется плюсна, наклонённая назад,
// это и есть скакательный сустав. Дальше обычная двухзвенная задача
// таз → пятка, и её сустав — колено — сам уходит вперёд.
const HOCK_LEN = 13; // длина плюсны, от стопы до пятки
const HOCK_TILT = -0.42; // наклон плюсны назад от направления на таз, радианы
const STIFLE_BULGE = 1.8; // запас длины костей: он и выносит колено вперёд

function hindChain(hx, hy, px, py) {
  const dx = px - hx;
  const dy = py - hy;
  const reach = Math.hypot(dx, dy) || 0.01;
  // Плюсна укорачивается вместе с поджатой лапой, иначе при укладывании
  // пятка уезжает выше таза и колено выворачивает наружу.
  const m = Math.min(HOCK_LEN, reach * 0.42);
  const ux = -dx / reach;
  const uy = -dy / reach;
  const ca = Math.cos(HOCK_TILT);
  const sa = Math.sin(HOCK_TILT);
  const ox = px + (ux * ca - uy * sa) * m;
  const oy = py + (ux * sa + uy * ca) * m;
  // Длина костей задаётся от расстояния, а не константой: так вынос колена
  // держится почти одинаковым и в стойке, и на выносе лапы.
  const d = Math.hypot(ox - hx, oy - hy);
  const [sx, sy] = knee(hx, hy, ox, oy, d / 2 + STIFLE_BULGE, 1);
  return [
    [hx, hy],
    [sx, sy],
    [ox, oy],
    [(ox + px) / 2, (oy + py) / 2],
    [px, py - 2],
  ];
}

// walking = false — кот стоит: фаза шага не при чём, все четыре стопы
// на полу. Раньше стойка брала кадр цикла ходьбы на t = 0, и в нём одна
// лапа как раз висит в верхней точке выноса, а две другие разъехались
// вперёд и назад — кот стоял враскоряку на трёх лапах.
function drawLeg(g, leg, t, dy, tuck = 0, walking = false) {
  const hx = leg.x;
  const hy = (leg.hind ? HIP_Y_HIND : HIP_Y) + dy;
  const [px0, py0] = walking ? pawTarget(leg.x, (t + leg.phase) % 1) : [leg.x, FEET_Y];
  // При укладывании стопа подтягивается к бедру — лапа складывается под кота.
  const px = px0 + (hx - px0) * tuck;
  const py = py0 + dy + (hy + 8 - (py0 + dy)) * tuck;

  const tone = leg.far ? SKIN_FAR : SKIN;

  // Лапа рисуется одним сужающимся полигоном по всей цепочке суставов.
  // Отдельные прямоугольники давали видимый стык и читались механизмом.
  const w = leg.hind ? LEG_WIDTH.hind : LEG_WIDTH.fore;
  const joints = leg.hind
    ? hindChain(hx, hy, px, py)
    : (() => {
        const [kx, ky] = knee(hx, hy, px, py, BONE, leg.bend);
        return [
          [hx, hy],
          [(hx + kx) / 2, (hy + ky) / 2],
          [kx, ky],
          [(kx + px) / 2, (ky + py) / 2],
          [px, py - 2],
        ];
      })();
  const chain = joints.map(([x, y], i) => [x, y, w[i]]);

  const left = [];
  const right = [];
  for (let i = 0; i < chain.length; i++) {
    const [x, y, wdt] = chain[i];
    const prev = chain[Math.max(0, i - 1)];
    const next = chain[Math.min(chain.length - 1, i + 1)];
    const ang = Math.atan2(next[1] - prev[1], next[0] - prev[0]) + Math.PI / 2;
    left.push([x + Math.cos(ang) * wdt, y + Math.sin(ang) * wdt]);
    right.push([x - Math.cos(ang) * wdt, y - Math.sin(ang) * wdt]);
  }
  pencilShape(g, smoothClosed([...left, ...right.reverse()], 5), { ...tone });

  // Стопа: короткая и скруглённая, а не коробка.
  const paw = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    paw.push([px + 1 + Math.cos(a) * 4, py - 1.8 + Math.sin(a) * 2.2]);
  }
  paw.push([px + 5, py], [px - 3, py]);
  pencilShape(g, smoothClosed(paw, 4), { ...tone });
}

// Хвост рисуется по осевой линии: у стоячего кота она поднята, у лежащего —
// своя для каждой позы. Гнётся волной, у основания почти неподвижен.
function drawTailFrom(g, spine, t, dy, sway) {
  const left = [];
  const right = [];
  for (let i = 0; i < spine.length; i++) {
    const [x, y, r] = spine[i];
    const k = 1 - i / (spine.length - 1); // 1 у кончика, 0 у основания
    const bend = Math.sin(t * Math.PI * 2 + i * 0.35) * sway * k * k;
    const nx = x + bend;
    const ny = y + dy * (1 - k * 0.5);
    left.push([nx - r, ny]);
    right.push([nx + r, ny]);
  }
  pencilShape(g, smoothClosed([...left, ...right.reverse()], 4), { ...SKIN });
}

// t: 0..1 — фаза шага, breath: 0..1 — вдох, sway — размах хвоста
export function drawCatBody(g, { t = 0, breath = 0, sway = 2.2, walking = false } = {}) {
  const dy = -breath * 1.5;
  // При ходьбе корпус чуть качается вверх-вниз дважды за цикл.
  const bob = walking ? Math.sin(t * Math.PI * 4) * 1.2 : 0;
  const off = PAD_Y + dy + bob;

  // Дальние лапы уходят под корпус.
  for (const leg of LEGS) if (leg.far) drawLeg(g, leg, t, off, 0, walking);

  drawTailFrom(g, TAIL_SPINE.map(([x, y, r]) => [x + PAD_X, y, r]), t, off, walking ? sway : sway * 0.4);
  pencilShape(g, smoothClosed(BODY, 6).map(([x, y]) => [x + PAD_X, y + off]), { ...SKIN });

  for (const leg of LEGS) if (!leg.far) drawLeg(g, leg, t, off, 0, walking);
}

// --- переход между стойкой и позой ------------------------------------------
//
// Контуры стойки и позы состоят из разного числа точек, поэтому обе выборки
// приводятся к одному числу по длине контура и смешиваются. Отсчёт у обеих
// начинается от носа — иначе при переходе кот выворачивается наизнанку.

function resampleClosed(points, n) {
  let start = 0;
  for (let i = 1; i < points.length; i++) if (points[i][0] > points[start][0]) start = i;
  const ring = [];
  for (let i = 0; i <= points.length; i++) ring.push(points[(start + i) % points.length]);

  const seg = [];
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]);
    seg.push(d);
    total += d;
  }

  const out = [];
  let idx = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n;
    while (idx < seg.length - 1 && acc + seg[idx] < target) {
      acc += seg[idx];
      idx += 1;
    }
    const t = seg[idx] ? (target - acc) / seg[idx] : 0;
    out.push([
      ring[idx][0] + (ring[idx + 1][0] - ring[idx][0]) * t,
      ring[idx][1] + (ring[idx + 1][1] - ring[idx][1]) * t,
    ]);
  }
  return out;
}

const MORPH_POINTS = 72;
const STAND_RESAMPLED = resampleClosed(smoothClosed(BODY, 6), MORPH_POINTS);
const POSE_CACHE = {};

function poseOutline(poseKey) {
  if (!POSE_CACHE[poseKey]) {
    const art = POSE_ART[poseKey];
    POSE_CACHE[poseKey] = art ? resampleClosed(smoothClosed(art.body, 6), MORPH_POINTS) : STAND_RESAMPLED;
  }
  return POSE_CACHE[poseKey];
}

function blendSpines(a, b, k) {
  const n = Math.max(a.length, b.length);
  const at = (arr, i) => arr[Math.min(arr.length - 1, Math.round((i / (n - 1)) * (arr.length - 1)))];
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = at(a, i);
    const q = at(b, i);
    out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k]);
  }
  return out;
}

// k: 0 — стоит, 1 — лежит в позе. Промежуточные значения дают укладывание
// и пробуждение.
export function drawCatPose(g, poseKey, k = 1, breath = 0) {
  const art = POSE_ART[poseKey];
  const target = poseOutline(poseKey);
  const dy = -breath * 1.2 * k;

  const body = STAND_RESAMPLED.map(([x, y], i) => [
    x + (target[i][0] - x) * k,
    y + (target[i][1] - y) * k + dy,
  ]);

  const tail = art ? blendSpines(TAIL_SPINE, art.tail, k) : TAIL_SPINE;
  drawTailFrom(g, tail.map(([x, y, r]) => [x + PAD_X, y + dy, r]), 0, PAD_Y, 0);

  // Пока кот только опускается, лапы ещё видны и поджимаются под корпус.
  if (k < 0.6) {
    const tuck = k / 0.6;
    for (const leg of LEGS) if (leg.far) drawLeg(g, leg, 0, PAD_Y + dy, tuck);
  }

  pencilShape(g, body.map(([x, y]) => [x + PAD_X, y + PAD_Y]), { ...SKIN });

  if (k < 0.6) {
    const tuck = k / 0.6;
    for (const leg of LEGS) if (!leg.far) drawLeg(g, leg, 0, PAD_Y + dy, tuck);
  }
}
