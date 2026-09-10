// Процедурные «карандашные» заглушки: дрожащая линия, штриховка, зерно бумаги.
// Всё рисуется кодом — до Фазы 5 в репозитории нет ни одного бинарного ассета.
//
// Правило: зерно бумаги живёт ОТДЕЛЬНЫМ экранным слоем (см. PaperOverlay)
// и не запекается ни в одну из этих текстур.
//
// Производительность: Graphics.generateTexture рисует через Canvas2D, и там
// платится за каждый stroke(). Поэтому базовый примитив принимает СПИСОК
// полилиний и обводит их одним путём — иначе штриховка фона превращается
// в тысячи отдельных вызовов и слой печётся десятки секунд.

import { HEX } from '../palette.js';

// Детерминированный шум: рисунок не должен меняться при каждой перезагрузке,
// иначе невозможно заметить регрессию глазами.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(20260908);
export function resetSeed(seed = 20260908) {
  rand = mulberry32(seed);
}

const DEFAULTS = {
  color: HEX.GRAPHITE_2,
  alpha: 0.9,
  width: 1.2,
  jitter: 1.1, // амплитуда дрожания контура, px
  step: 14, // длина сегмента подразбиения, px
  passes: 2, // сколько раз обводится линия — даёт графитную неровность
};

// Базовый примитив: список полилиний одним путём, по одному stroke() на проход.
export function strokePolylines(g, lines, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  for (let p = 0; p < o.passes; p++) {
    const alpha = o.alpha * (p === 0 && o.passes > 1 ? 0.55 : 1);
    const width = o.width * (p === 0 && o.passes > 1 ? 1.7 : 1);
    g.lineStyle(width, o.color, alpha);
    g.beginPath();

    for (const points of lines) {
      if (!points || points.length < 2) continue;
      let started = false;
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const n = Math.max(1, Math.round(len / o.step));
        const nx = -(y2 - y1) / len;
        const ny = (x2 - x1) / len;
        for (let s = 0; s <= n; s++) {
          const t = s / n;
          // Концы сегмента не дрожат — иначе стыки соседних линий разъезжаются.
          const damp = Math.sin(Math.PI * t);
          const j = (rand() - 0.5) * 2 * o.jitter * damp;
          const x = x1 + (x2 - x1) * t + nx * j;
          const y = y1 + (y2 - y1) * t + ny * j;
          if (!started) {
            g.moveTo(x, y);
            started = true;
          } else {
            g.lineTo(x, y);
          }
        }
      }
    }

    g.strokePath();
  }
}

export function pencilPath(g, points, opts = {}) {
  strokePolylines(g, [points], opts);
}

export function pencilLine(g, x1, y1, x2, y2, opts = {}) {
  strokePolylines(g, [[[x1, y1], [x2, y2]]], opts);
}

// Замкнутый контур с необязательной ровной заливкой.
// Заливка именно ровная: у кота внутренних линий почти нет, иначе
// штриховка будет мельтешить от кадра к кадру (раздел 5.2 дизайн-документа).
export function pencilShape(g, points, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (o.fill !== undefined) {
    g.fillStyle(o.fill, o.fillAlpha === undefined ? 1 : o.fillAlpha);
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
    g.fillPath();
  }
  strokePolylines(g, [[...points, points[0]]], o);
}

// Сглаживание замкнутого контура сплайном Катмулла–Рома.
// Обведённый силуэт — это ломаная из нескольких десятков точек, и рисовать
// её отрезками значит получить огранку. Сплайн проходит ровно через те же
// точки, но между ними ведёт кривую.
export function smoothClosed(points, perSegment = 6, cornerDeg = 58) {
  if (points.length < 4) return points;

  // Острые углы сплайн скругляет — а у кота на них держатся уши и когти.
  // Точку с резким изломом дублируем: кривая проходит через неё углом.
  const src = [];
  const m = points.length;
  const cos = Math.cos((cornerDeg * Math.PI) / 180);
  for (let i = 0; i < m; i++) {
    const p0 = points[(i - 1 + m) % m];
    const p1 = points[i];
    const p2 = points[(i + 1) % m];
    const ax = p1[0] - p0[0];
    const ay = p1[1] - p0[1];
    const bx = p2[0] - p1[0];
    const by = p2[1] - p1[1];
    const la = Math.hypot(ax, ay) || 1;
    const lb = Math.hypot(bx, by) || 1;
    const dot = (ax * bx + ay * by) / (la * lb);
    src.push(p1);
    if (dot < cos) src.push(p1); // излом круче порога — держим угол
  }

  const n = src.length;
  const at = (i) => src[((i % n) + n) % n];
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

// Прямоугольник с перехлёстом линий на углах — как рисуют от руки.
export function pencilRect(g, x, y, w, h, opts = {}) {
  const o = { over: 3, ...opts };
  const v = o.over;
  if (o.fill !== undefined) {
    g.fillStyle(o.fill, o.fillAlpha === undefined ? 1 : o.fillAlpha);
    g.fillRect(x, y, w, h);
  }
  strokePolylines(
    g,
    [
      [[x - v, y], [x + w + v, y]],
      [[x + w, y - v], [x + w, y + h + v]],
      [[x + w + v, y + h], [x - v, y + h]],
      [[x, y + h + v], [x, y - v]],
    ],
    o
  );
}

export function pencilCircle(g, cx, cy, r, opts = {}) {
  const pts = [];
  const n = Math.max(12, Math.round(r * 0.9));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  pencilShape(g, pts, { step: 10, ...opts });
}

// Liang–Barsky: обрезка отрезка прямоугольником. Нужна штриховке.
function clipSegment(x0, y0, x1, y1, rx, ry, rw, rh) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - rx, rx + rw - x0, y0 - ry, ry + rh - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

// Штриховка внутри прямоугольника. Вся детализация уходит в фон —
// на коте штриховки не будет.
// Штрихи разложены по двум группам плотности: одним stroke() на группу,
// но тон всё равно не выглядит одинаковым.
export function hatch(g, x, y, w, h, opts = {}) {
  const o = {
    angle: 58,
    spacing: 9,
    color: HEX.GRAPHITE_3,
    alpha: 0.5,
    width: 0.9,
    jitter: 0.6,
    gap: 0.12, // доля пропущенных штрихов
    ...opts,
  };
  const a = (o.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = -dy;
  const ny = dx;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const reach = (w + h) * 0.75;

  const light = [];
  const dark = [];
  for (let t = -reach; t <= reach; t += o.spacing) {
    if (rand() < o.gap) continue;
    const px = cx + nx * t;
    const py = cy + ny * t;
    const seg = clipSegment(px - dx * reach, py - dy * reach, px + dx * reach, py + dy * reach, x, y, w, h);
    if (!seg) continue;
    // Штрих не доходит до края — рука так и делает.
    const [sx, sy, ex, ey] = seg;
    const head = 0.04 + rand() * 0.12;
    const tail = 0.04 + rand() * 0.12;
    const line = [
      [sx + (ex - sx) * head, sy + (ey - sy) * head],
      [ex - (ex - sx) * tail, ey - (ey - sy) * tail],
    ];
    (rand() < 0.45 ? light : dark).push(line);
  }

  const common = { color: o.color, width: o.width, jitter: o.jitter, step: 22, passes: 1 };
  strokePolylines(g, light, { ...common, alpha: o.alpha * 0.65 });
  strokePolylines(g, dark, { ...common, alpha: o.alpha });
}

// Лист: изогнутый «стручок». Прямые треугольники из первой версии читались
// как лопасти вентилятора — растению нужен изгиб.
export function pencilLeaf(g, x, y, opts = {}) {
  const o = { angle: -Math.PI / 2, len: 120, wid: 16, bend: 0.5, steps: 12, ...opts };
  const spine = [];
  let px = x;
  let py = y;
  for (let i = 0; i <= o.steps; i++) {
    spine.push([px, py, o.angle + o.bend * (i / o.steps)]);
    px += Math.cos(o.angle + o.bend * (i / o.steps)) * (o.len / o.steps);
    py += Math.sin(o.angle + o.bend * (i / o.steps)) * (o.len / o.steps);
  }
  const left = [];
  const right = [];
  for (let i = 0; i <= o.steps; i++) {
    const t = i / o.steps;
    const [sx, sy, a] = spine[i];
    const wid = o.wid * Math.sin(Math.PI * Math.pow(t, 0.75));
    left.push([sx + Math.cos(a + Math.PI / 2) * wid, sy + Math.sin(a + Math.PI / 2) * wid]);
    right.push([sx + Math.cos(a - Math.PI / 2) * wid, sy + Math.sin(a - Math.PI / 2) * wid]);
  }
  pencilShape(g, [...left, ...right.reverse()], { step: 16, jitter: 0.8, ...opts });
  // Центральная жилка — единственная внутренняя линия.
  pencilPath(
    g,
    spine.map(([sx, sy]) => [sx, sy]),
    {
      color: opts.color === undefined ? HEX.GRAPHITE_2 : opts.color,
      alpha: 0.45,
      width: 0.9,
      jitter: 0.5,
      step: 20,
      passes: 1,
    }
  );
}

// Пучок травы / шерсти / мелочи у пола — короткие штрихи из одной точки.
export function tuft(g, x, y, size = 10, opts = {}) {
  const n = 3 + Math.floor(rand() * 3);
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.6;
    lines.push([
      [x + (rand() - 0.5) * size, y],
      [x + Math.cos(a) * size * (0.6 + rand() * 0.8), y + Math.sin(a) * size],
    ]);
  }
  strokePolylines(g, lines, {
    color: HEX.GRAPHITE_3,
    alpha: 0.6,
    width: 0.9,
    jitter: 0.5,
    passes: 1,
    ...opts,
  });
}

// Зерно бумаги. Отдельная текстура, ни в один спрайт не запекается.
export function makePaperTexture(scene, key, size = 512) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex.getContext();
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const r = mulberry32(4242);
  for (let i = 0; i < size * size; i++) {
    // Слой лежит в MULTIPLY — база почти белая, иначе бумага превратится в грязь.
    let v = 246 + Math.floor(r() * 10);
    if (r() < 0.07) v -= 10 + Math.floor(r() * 26);
    const o = i * 4;
    d[o] = v;
    d[o + 1] = v - 1;
    d[o + 2] = v - 3; // тон чуть теплее
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Волокна: короткие светлые штрихи, чтобы шум не читался как телевизионный.
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 220; i++) {
    const x = r() * size;
    const y = r() * size;
    const len = 6 + r() * 26;
    const a = r() * Math.PI;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  ctx.strokeStyle = 'rgba(150,148,143,0.09)';
  ctx.stroke();
  tex.refresh();
}

// Нарисовать во временный Graphics и запечь в текстуру.
// Графика из сотен штрихов не должна пересобираться каждый кадр.
export function bakeTexture(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawFn(g);
  g.generateTexture(key, w, h);
  g.destroy();
}
