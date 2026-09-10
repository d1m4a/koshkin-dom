// Обводка силуэта кота в векторные полигоны для игры.
//
// Один силуэт сам по себе не анимируется, поэтому он режется на части:
// корпус с головой, четыре лапы и хвост. Каждая часть получает свой контур
// и точку вращения, дальше движение считается кодом.
//
// Запуск: node tools/trace-cat.cjs <исходный.png> [--preview]
// Результат: src/data/catShape.js

const fs = require('fs');
const path = require('path');
const { readMask, writePNG } = require('./pngmask.cjs');

// Линии разреза подобраны по анализу силуэта: до y=258 слева идёт только
// хвост, ниже y=414 корпус уже кончился и остались лапы.
const CUT = { tailY: 258, tailX: 110, legsY: 414 };

// Кот в игре примерно 120 px от носа до крупа.
const TARGET_BODY_LEN = 120;

function label(mask, w, h, keep) {
  const seen = new Uint8Array(w * h);
  const parts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (seen[i] || !keep(x, y)) continue;
      const stack = [i];
      const px = [];
      seen[i] = 1;
      while (stack.length) {
        const j = stack.pop();
        const jx = j % w;
        const jy = (j / w) | 0;
        px.push(j);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = jx + dx;
          const ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (seen[n] || !keep(nx, ny)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (px.length > 200) parts.push(px);
    }
  }
  return parts;
}

// Обход границы по соседям Мура с критерием остановки Джейкоба.
// Даёт замкнутый контур по часовой стрелке (ось Y вниз).
function traceContour(inside, w, h) {
  let start = -1;
  for (let i = 0; i < w * h && start < 0; i++) if (inside(i % w, (i / w) | 0)) start = i;
  if (start < 0) return [];

  const sx = start % w;
  const sy = (start / w) | 0;
  // По часовой стрелке при Y вниз: E, SE, S, SW, W, NW, N, NE.
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pts = [[sx, sy]];
  let bx = sx;
  let by = sy;
  // Стартовый пиксель найден построчным сканом, значит слева от него фон.
  let back = 4;

  for (let guard = 0; guard < w * h * 8; guard++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = bx + dirs[d][0];
      const ny = by + dirs[d][1];
      if (!inside(nx, ny)) continue;
      bx = nx;
      by = ny;
      back = (d + 4) % 8; // направление назад, к предыдущему пикселю
      pts.push([bx, by]);
      found = true;
      break;
    }
    if (!found) break;
    if (bx === sx && by === sy) break;
  }
  return pts;
}

// Рамер–Дуглас–Пекер: контур из тысяч пикселей превращается в десятки точек.
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    let best = -1;
    let bestD = eps;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Замкнутый контур нельзя упрощать напрямую: первая и последняя точки
// совпадают, хорда вырождается в ноль и алгоритм выбрасывает весь контур.
// Поэтому петля режется на две дуги по крайним левой и правой точкам.
function simplifyClosed(pts, eps) {
  if (pts.length < 8) return pts;
  const loop = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
  let iMin = 0;
  let iMax = 0;
  for (let i = 1; i < loop.length; i++) {
    if (loop[i][0] < loop[iMin][0]) iMin = i;
    if (loop[i][0] > loop[iMax][0]) iMax = i;
  }
  const a = Math.min(iMin, iMax);
  const b = Math.max(iMin, iMax);
  const arc1 = loop.slice(a, b + 1);
  const arc2 = loop.slice(b).concat(loop.slice(0, a + 1));
  return simplify(arc1, eps).concat(simplify(arc2, eps).slice(1, -1));
}

function bbox(pts) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of pts) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  }
  return { minx, miny, maxx, maxy };
}

function main() {
  const src = process.argv[2] || 'C:/dc/cat5.png';
  const { w, h, mask } = readMask(src);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] > 128;

  const isTail = (x, y) => solid(x, y) && y < CUT.tailY && x < CUT.tailX;
  const isLeg = (x, y) => solid(x, y) && y >= CUT.legsY;
  const isBody = (x, y) => solid(x, y) && !isTail(x, y) && !isLeg(x, y);

  const bodyParts = label(mask, w, h, isBody).sort((a, b) => b.length - a.length);
  const tailParts = label(mask, w, h, isTail).sort((a, b) => b.length - a.length);
  const legParts = label(mask, w, h, isLeg).sort((a, b) => a[0] % w - (b[0] % w));

  const toSet = (px) => {
    const s = new Uint8Array(w * h);
    for (const i of px) s[i] = 1;
    return (x, y) => x >= 0 && y >= 0 && x < w && y < h && s[y * w + x] === 1;
  };

  const parts = [];
  const push = (name, px) => {
    const inside = toSet(px);
    const raw = traceContour(inside, w, h);
    const contour = simplifyClosed(raw, 2.2);
    console.log('  ' + name + ': пикселей контура ' + raw.length + ' → точек ' + contour.length);
    parts.push({ name, contour, pixels: px.length });
  };

  push('body', bodyParts[0]);
  push('tail', tailParts[0]);

  // Лапы в исходнике перекрывают друг друга и в один силуэт не режутся.
  // Это не потеря: лапы тонкие и простые, процедурно ими управлять удобнее,
  // чем вырезанными кусками растра. Из растра берём только их геометрию:
  // где крепятся и какой длины.
  const legRows = [];
  for (let y = CUT.legsY; y < h; y++) {
    const spans = [];
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const v = isLeg(x, y);
      if (v && start < 0) start = x;
      if (!v && start >= 0) {
        spans.push([start, x - 1]);
        start = -1;
      }
    }
    if (spans.length) legRows.push({ y, spans });
  }
  const attach = legRows[0].spans.map(([a, b]) => [(a + b) / 2, CUT.legsY]);
  const feetY = legRows[legRows.length - 1].y;

  // Масштаб: длина корпуса без хвоста приводится к игровым 120 px.
  const bodyBox = bbox(parts[0].contour);
  const scale = TARGET_BODY_LEN / (bodyBox.maxx - bodyBox.minx);

  // Общая система координат: X от носа кота, Y — от линии лап вверх.
  const all = parts.flatMap((p) => p.contour);
  const box = bbox(all);
  const toGame = ([x, y]) => [
    +((x - box.minx) * scale).toFixed(1),
    +((y - box.miny) * scale).toFixed(1),
  ];

  // Осевая линия хвоста: по ней его можно гнуть, полигоном — нельзя.
  const tailSpine = [];
  {
    const tailMask = toSet(tailParts[0]);
    for (let y = 0; y < CUT.tailY; y += 12) {
      let sum = 0;
      let n = 0;
      let minx = Infinity;
      let maxx = -Infinity;
      for (let x = 0; x < CUT.tailX; x++)
        if (tailMask(x, y)) {
          sum += x;
          n++;
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
        }
      if (n > 2) tailSpine.push([sum / n, y, (maxx - minx) / 2]);
    }
  }

  const out = {
    source: path.basename(src),
    width: +((box.maxx - box.minx) * scale).toFixed(1),
    height: +((box.maxy - box.miny) * scale).toFixed(1),
    parts: parts.map((p) => {
      const b = bbox(p.contour);
      return {
        name: p.name,
        // Точка вращения: верх части по центру — плечо, бедро, основание хвоста.
        pivot: toGame([(b.minx + b.maxx) / 2, b.miny]),
        points: p.contour.map(toGame),
      };
    }),
    // Хвост: осевая линия и полутолщина в каждой точке.
    tailSpine: tailSpine.map(([x, y, r]) => [...toGame([x, y]), +(r * scale).toFixed(1)]),
    // Крепления лап и линия пола — для процедурных лап.
    anchors: {
      legs: attach.map(toGame),
      feetY: toGame([0, feetY])[1],
      bellyY: toGame([0, CUT.legsY])[1],
    },
  };

  console.log('части:', out.parts.map((p) => p.name + ' (' + p.points.length + ' точек)').join(', '));
  console.log('размер в игре:', out.width, '×', out.height);

  const js =
    '// СГЕНЕРИРОВАНО tools/trace-cat.cjs из ' + out.source + ' — руками не править.\n' +
    '// Контуры частей кота в игровых координатах: X вправо от носа, Y вниз,\n' +
    '// начало — левый верхний угол общей рамки, лапы стоят на нижнем крае.\n\n' +
    'export const CAT_SHAPE = ' + JSON.stringify(out, null, 2) + ';\n';
  fs.writeFileSync('src/data/catShape.js', js);
  console.log('записано src/data/catShape.js');

  if (process.argv.includes('--preview')) {
    const tones = [[58, 58, 56], [110, 109, 105], [140, 138, 132], [160, 158, 152], [180, 178, 172], [200, 198, 192]];
    const rgb = Buffer.alloc(w * h * 3);
    const masks = [
      { test: isBody, tone: tones[0] },
      { test: isTail, tone: tones[1] },
      { test: isLeg, tone: tones[2] },
    ];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let col = [242, 239, 232];
        for (const m of masks) if (m.test(x, y)) col = m.tone;
        const q = (y * w + x) * 3;
        rgb[q] = col[0];
        rgb[q + 1] = col[1];
        rgb[q + 2] = col[2];
      }
    }
    // Контуры поверх заливок
    for (const p of parts) {
      for (const [x, y] of p.contour) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const q = ((y + dy) * w + (x + dx)) * 3;
            if (q >= 0 && q < rgb.length - 2) {
              rgb[q] = 220;
              rgb[q + 1] = 90;
              rgb[q + 2] = 70;
            }
          }
      }
    }
    writePNG(process.argv[process.argv.indexOf('--preview') + 1] || 'trace-preview.png', w, h, rgb);
    console.log('превью записано');
  }
}

main();
