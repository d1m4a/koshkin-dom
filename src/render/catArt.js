// Кот-заглушка. Чистый контур, минимум внутренних линий, ровная заливка —
// плотная штриховка на анимированном персонаже начала бы мельтешить
// от кадра к кадру (раздел 5.2 дизайн-документа).
//
// Побочный выигрыш: каждый кадр печётся со своим дрожанием линии, поэтому
// «кипение» контура из раздела 5.4 получается бесплатно.
//
// Все позы — интерполяция между двумя наборами точек: стоя и лёжа.
// Отдельных рисунков на каждое состояние не нужно.

import { HEX } from '../palette.js';
import { pencilShape, pencilPath, pencilCircle, strokePolylines, bakeTexture } from './pencil.js';
import { drawCatBody, drawCatPose, CAT_W as BODY_W, CAT_H as BODY_H } from './catBody.js';
import { POSE_ART } from './catPoseArt.js';
import { drawCatFront } from './catFront.js';

export const CAT_TEX_W = 132;
export const CAT_TEX_H = 96;
const BASE = 92; // линия лап внутри текстуры
// На сколько опустить спрайт, чтобы лапы встали ровно на линию пола.
export const CAT_FOOT_OFFSET = CAT_TEX_H - BASE;

// Тон тот же, что у обведённого кота из catBody.js: сплошной тёмный силуэт.
// Анатомия у этих поз пока старая, заглушечная — их предстоит перевести
// на обведённый контур, но тон не должен разъезжаться уже сейчас.
// Мелкие помощники интерполяции: остались от поз сна, но нужны виду со спины.
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPts = (a, b, t) => a.map(([x, y], i) => [lerp(x, b[i][0], t), lerp(y, b[i][1], t)]);

const BODY = { fill: HEX.GRAPHITE_1, fillAlpha: 1, color: HEX.GRAPHITE_1, alpha: 1, width: 1.2, jitter: 0.9 };

export function makeCatTextures(scene) {

  // Стойка и ходьба — с обведённого силуэта (см. catBody.js).
  const bakeBody = (key, opts) => bakeTexture(scene, key, BODY_W, BODY_H, (g) => drawCatBody(g, opts));
  [0, 0.55, 1].forEach((breath, i) => bakeBody('cat_idle_' + i, { breath, t: i * 0.02 }));
  for (let i = 0; i < 8; i++) bakeBody('cat_walk_' + i, { t: i / 8, walking: true, breath: 0.3 });

  // На каждую позу сна — укладывание, сон и пробуждение. Всё это морфинг
  // между стойкой и нарисованным контуром позы, отдельных рисунков не нужно.
  for (const poseKey of Object.keys(POSE_ART)) {
    const bakePose = (key, k, breath) =>
      bakeTexture(scene, key, BODY_W, BODY_H, (g) => drawCatPose(g, poseKey, k, breath));

    for (let i = 0; i < 5; i++) bakePose(`cat_sit_${poseKey}_${i}`, i / 4, 0);

    // Сон: бока еле двигаются.
    [0, 0.4, 0.8, 1, 0.6, 0.2].forEach((breath, i) => bakePose(`cat_sleep_${poseKey}_${i}`, 1, breath));

    // Пробуждение — обратный путь.
    for (let i = 0; i < 7; i++) bakePose(`cat_wake_${poseKey}_${i}`, 1 - i / 6, 0);
  }

  // Кот, сидящий анфас: разворот, дыхание и четыре микрособытия.
  const bakeFront = (key, opts) => bakeTexture(scene, key, BODY_W, BODY_H, (g) => drawCatFront(g, opts));
  for (let i = 0; i < 4; i++) bakeFront('cat_frontsit_' + i, { sit: i / 3 });
  [0, 0.6, 1].forEach((breath, i) => bakeFront('cat_front_' + i, { breath }));
  [0, 1, 0.35].forEach((blink, i) => bakeFront('cat_frontblink_' + i, { blink }));
  [0, 1, 0.3].forEach((earTilt, i) => bakeFront('cat_frontear_' + i, { earTilt }));
  [0, 0.5, 1, 0.5].forEach((headTilt, i) => bakeFront('cat_fronthead_' + i, { headTilt }));
  [0, 1, 0.4, 0].forEach((tailFlick, i) => bakeFront('cat_fronttail_' + i, { tailFlick }));
}
