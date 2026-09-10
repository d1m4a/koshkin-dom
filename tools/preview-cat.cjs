// Оффлайн-превью кадров кота: то же рисование, что в игре, но без браузера.
// Рисовальному коду подсовывается заглушка Phaser.Graphics, которая копит
// полигоны, а растеризатор кладёт их в PNG.
//
// Запуск: node tools/preview-cat.cjs [выходной.png]

const { writePNG } = require('./pngmask.cjs');

// --- заглушка Graphics ------------------------------------------------------
function makeStub() {
  const ops = [];
  let fill = { color: 0, alpha: 1 };
  let line = { color: 0, alpha: 1, width: 1 };
  let path = [];
  let sub = null;
  const g = {
    fillStyle(color, alpha = 1) { fill = { color, alpha }; return g; },
    lineStyle(width, color, alpha = 1) { line = { color, alpha, width }; return g; },
    beginPath() { path = []; sub = null; return g; },
    moveTo(x, y) { sub = [[x, y]]; path.push(sub); return g; },
    lineTo(x, y) { if (!sub) { sub = []; path.push(sub); } sub.push([x, y]); return g; },
    closePath() { return g; },
    fillPath() { ops.push({ kind: 'fill', style: { ...fill }, path: path.map((s) => s.slice()) }); return g; },
    strokePath() { ops.push({ kind: 'stroke', style: { ...line }, path: path.map((s) => s.slice()) }); return g; },
    fillRect(x, y, w, h) {
      ops.push({ kind: 'fill', style: { ...fill }, path: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]] });
      return g;
    },
    clear() { ops.length = 0; return g; },
  };
  return { g, ops };
}

// --- растеризация -----------------------------------------------------------
const rgbOf = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

function blend(buf, w, h, x, y, col, a) {
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 3;
  buf[i] = buf[i] * (1 - a) + col[0] * a;
  buf[i + 1] = buf[i + 1] * (1 - a) + col[1] * a;
  buf[i + 2] = buf[i + 2] * (1 - a) + col[2] * a;
}

function fillPoly(buf, w, h, poly, col, alpha) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of poly) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(h - 1, Math.ceil(maxY)); y++) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if (y1 === y2) continue;
      const yc = y + 0.5;
      if (yc >= Math.min(y1, y2) && yc < Math.max(y1, y2)) xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.floor(xs[k]); x <= Math.ceil(xs[k + 1]); x++) blend(buf, w, h, x, y, col, alpha);
    }
  }
}

function strokeSeg(buf, w, h, x1, y1, x2, y2, col, alpha, width) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
  const r = Math.max(0.5, width / 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r + 0.5) continue;
        blend(buf, w, h, Math.round(cx) + dx, Math.round(cy) + dy, col, alpha * Math.min(1, r + 0.5 - d));
      }
    }
  }
}

function rasterize(ops, w, h, buf, offX, scale) {
  for (const op of ops) {
    const col = rgbOf(op.style.color);
    for (const sub of op.path) {
      if (sub.length < 2) continue;
      const moved = sub.map(([x, y]) => [x * scale + offX, y * scale]);
      if (op.kind === 'fill') fillPoly(buf, w, h, moved, col, op.style.alpha);
      else for (let i = 0; i + 1 < moved.length; i++)
        strokeSeg(buf, w, h, moved[i][0], moved[i][1], moved[i + 1][0], moved[i + 1][1], col, op.style.alpha, op.style.width * scale);
    }
  }
}

async function main() {
  const mod = await import('../src/render/catBody.js');
  const { drawCatBody, CAT_W, CAT_H } = mod;

  // --poses: вместо цикла ходьбы показываем позы сна (пока старой анатомии).
  const front = await import('../src/render/catFront.js');
  const frontArg = process.argv.find((a) => a.startsWith('--front'));
  const propsArg = process.argv.includes('--props');
  const props = propsArg ? await import('../src/render/props.js') : null;
  const poseArg = process.argv.find((a) => a.startsWith('--pose='));
  const frames = [];
  if (propsArg) {
    frames.push({ prop: 'heart' }, { prop: 'fly' });
  } else if (frontArg) {
    frames.push({ front: { sit: 0.35 } }, { front: { sit: 0.7 } }, { front: { sit: 1, breath: 0.4 } },
      { front: { sit: 1, blink: 1 } }, { front: { sit: 1, earTilt: 1 } }, { front: { sit: 1, headTilt: 1 } },
      { front: { sit: 1, tailFlick: 1 } });
  } else if (poseArg) {
    for (const key of poseArg.slice(7).split(',')) {
      if (key.includes(':')) {
        const [name, steps] = key.split(':');
        for (let i = 0; i <= Number(steps); i++) frames.push({ poseKey: name, k: i / Number(steps) });
      } else frames.push({ poseKey: key });
    }
  } else {
    for (let i = 0; i < 4; i++) frames.push({ t: i / 4, walking: true, breath: 0.3 });
    frames.push({ t: 0, breath: 0 }); // стойка
  }

  const SCALE = Number(process.argv[3] || 3);
  const W = Math.round(CAT_W * SCALE) * frames.length;
  const H = Math.round(CAT_H * SCALE);
  const buf = new Float64Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { buf[i * 3] = 242; buf[i * 3 + 1] = 239; buf[i * 3 + 2] = 232; }

  frames.forEach((f, i) => {
    const { g, ops } = makeStub();
    if (f.prop) props[f.prop === 'heart' ? 'drawHeart' : 'drawFly'](g);
    else if (f.front) front.drawCatFront(g, f.front);
    else if (f.poseKey) mod.drawCatPose(g, f.poseKey, f.k === undefined ? 1 : f.k, 0.4);
    else drawCatBody(g, f);
    rasterize(ops, W, H, buf, i * Math.round(CAT_W * SCALE), SCALE);
  });

  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) out[i] = Math.max(0, Math.min(255, Math.round(buf[i])));
  const file = process.argv[2] || 'cat-frames.png';
  writePNG(file, W, H, out);
  console.log('кадров:', frames.length, '→', file, W + '×' + H);
}

main();
