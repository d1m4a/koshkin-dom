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
function withBelly(points, bellyY) {
  const out = [];
  let arcDone = false;
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (y < bellyY - 1.5) {
      out.push([x, y]);
      continue;
    }
    if (arcDone) continue;
    arcDone = true;
    // Все точки среза заменяем одной дугой от правого края к левому.
    const flat = points.filter((p) => p[1] >= bellyY - 1.5);
    const xs = flat.map((p) => p[0]);
    const x1 = Math.max(...xs);
    const x0 = Math.min(...xs);
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      out.push([x1 + (x0 - x1) * u, bellyY + Math.sin(Math.PI * u) * 3]);
    }
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
// bend: куда смотрит сустав. У задней лапы скакательный сустав уходит назад,
// у передней локоть — вперёд; одинаковый изгиб у всех четырёх сразу читается
// как насекомое.
const LEGS = [
  { x: LEG_ANCHORS[0][0] - 6, phase: 0.0, far: true, bend: 1 },
  { x: LEG_ANCHORS[1][0] - 6, phase: 0.25, far: true, bend: -1 },
  { x: LEG_ANCHORS[0][0] + 7, phase: 0.5, far: false, bend: 1 },
  { x: LEG_ANCHORS[1][0] + 7, phase: 0.75, far: false, bend: -1 },
];

// Бедро прячется внутрь корпуса, иначе между лапой и телом видна бумага.
const HIP_INSET = 10;
const HIP_Y = BELLY_Y - HIP_INSET;
const LEG_REACH = FEET_Y - HIP_Y;
// Кость чуть длиннее половины: иначе лапа выпрямляется в струну и упирается
// в предел кинематики — ровно от этого лапы выглядели палками.
const BONE = LEG_REACH * 0.58;
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

// Двухзвенная кинематика: колено там, где сходятся две окружности.
// sign задаёт, в какую сторону выгнут сустав.
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

// walking = false — кот стоит: фаза шага не при чём, все четыре стопы
// на полу. Раньше стойка брала кадр цикла ходьбы на t = 0, и в нём одна
// лапа как раз висит в верхней точке выноса, а две другие разъехались
// вперёд и назад — кот стоял враскоряку на трёх лапах.
function drawLeg(g, leg, t, dy, tuck = 0, walking = false) {
  const hx = leg.x;
  const hy = HIP_Y + dy;
  const [px0, py0] = walking ? pawTarget(leg.x, (t + leg.phase) % 1) : [leg.x, FEET_Y];
  // При укладывании стопа подтягивается к бедру — лапа складывается под кота.
  const px = px0 + (hx - px0) * tuck;
  const py = py0 + dy + (hy + 8 - (py0 + dy)) * tuck;
  const [kx, ky] = knee(hx, hy, px, py, BONE, leg.bend);

  const tone = leg.far ? SKIN_FAR : SKIN;

  // Лапа рисуется одним сужающимся полигоном по цепочке бедро → колено → стопа.
  // Два отдельных прямоугольника давали видимый стык и читались механизмом.
  const chain = [
    [hx, hy, 5.4],
    [(hx + kx) / 2, (hy + ky) / 2, 4.2],
    [kx, ky, 3.4],
    [(kx + px) / 2, (ky + py) / 2, 2.8],
    [px, py - 2, 2.3],
  ];
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
