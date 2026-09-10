// Мелкий реквизит, который не принадлежит ни одному слою комнаты.

import { HEX } from '../palette.js';
import { pencilShape, strokePolylines, bakeTexture, smoothClosed } from './pencil.js';

export const FLY_KEY = 'prop-fly';
export const FLY_W = 14;
export const FLY_H = 12;

// Муха на стене. Размером с запятую — её и не должно быть видно сразу.
export function drawFly(g) {
  pencilShape(
    g,
    [
      [4, 6],
      [7, 4],
      [10, 6],
      [7, 9],
    ],
    { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1, jitter: 0.4, step: 6, fill: HEX.GRAPHITE_2, fillAlpha: 0.5 }
  );
  strokePolylines(
    g,
    [
      [[6, 5], [2, 2]],
      [[8, 5], [12, 2]],
      [[5, 9], [3, 11]],
      [[9, 9], [11, 11]],
    ],
    { color: HEX.GRAPHITE_2, alpha: 0.7, width: 0.8, jitter: 0.3, step: 6, passes: 1 }
  );
}

export const HEART_KEY = 'prop-heart';
export const HEART_W = 30;
export const HEART_H = 26;

// Сердечко над местом для сна: подсказка, где коту можно лечь.
// Рисуется тем же карандашом, что и комната, и намеренно бледное —
// это метка, а не иконка интерфейса.
export function drawHeart(g) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([HEART_W / 2 + x * 0.72, HEART_H / 2 + y * 0.72]);
  }
  pencilShape(g, smoothClosed(pts, 3), {
    color: HEX.GRAPHITE_2,
    alpha: 0.85,
    width: 1.2,
    jitter: 0.4,
    step: 18,
    fill: HEX.GRAPHITE_4,
    fillAlpha: 0.55,
  });
}

export function makePropTextures(scene) {
  bakeTexture(scene, FLY_KEY, FLY_W, FLY_H, drawFly);
  bakeTexture(scene, HEART_KEY, HEART_W, HEART_H, drawHeart);
}
