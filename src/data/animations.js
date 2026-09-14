// Анимации данными. 4-10 fps: для рисованного от руки это живее, чем 24,
// и вдвое дешевле по кадрам.

import { POSE_ART } from '../render/catPoseArt.js';

const range = (prefix, count) => Array.from({ length: count }, (_, i) => prefix + i);

export const SLEEP_POSE_KEYS = Object.keys(POSE_ART);

// Кадры взгляда вбок. Это не анимация: кадр выбирается прямо по положению
// маятника часов, иначе кот следил бы за своим ритмом, а не за часами.
export const LOOK_FRAMES = 11;

// Наклон головы набок. Кадры печём в обе стороны от нуля, нулевой —
// посередине, и обе анимации берут их с общего набора.
export const TILT_FRAMES = 9;
const tiltSeq = (dir) => {
  const mid = (TILT_FRAMES - 1) / 2;
  const f = (k) => 'cat_fronttilt_' + (mid + dir * k);
  // Наклонился, подержал и вернулся: без задержки в крайней точке жест
  // читается нервным подёргиванием, а не разглядыванием.
  return [f(0), f(1), f(2), f(3), f(4), f(4), f(4), f(4), f(4), f(3), f(2), f(1), f(0)];
};
export const lookFrame = (v) =>
  'cat_frontlook_' + Math.round(((Math.max(-1, Math.min(1, v)) + 1) / 2) * (LOOK_FRAMES - 1));

// Ключи анимаций для позы сна. Место для сна хранит только имя позы,
// а три её анимации выводятся отсюда.
export const poseAnims = (pose) => ({
  sit: `cat-sit-${pose}`,
  sleep: `cat-sleep-${pose}`,
  wake: `cat-wake-${pose}`,
});

export const ANIMS = [
  { key: 'cat-idle', frames: ['cat_idle_0', 'cat_idle_1', 'cat_idle_2', 'cat_idle_1'], frameRate: 4, repeat: -1 },
  { key: 'cat-walk', frames: range('cat_walk_', 8), frameRate: 10, repeat: -1 },
  ...SLEEP_POSE_KEYS.flatMap((pose) => [
    { key: `cat-sit-${pose}`, frames: range(`cat_sit_${pose}_`, 5), frameRate: 10, repeat: 0 },
    { key: `cat-sleep-${pose}`, frames: range(`cat_sleep_${pose}_`, 6), frameRate: 4, repeat: -1 },
    { key: `cat-wake-${pose}`, frames: range(`cat_wake_${pose}_`, 7), frameRate: 10, repeat: 0 },
  ]),

  // Кот сидит анфас: разворот, дыхание и микрособытия.
  { key: 'cat-front-sit', frames: range('cat_frontsit_', 4), frameRate: 8, repeat: 0 },
  { key: 'cat-front-rise', frames: range('cat_frontsit_', 4).reverse(), frameRate: 10, repeat: 0 },
  { key: 'cat-front', frames: ['cat_front_0', 'cat_front_1', 'cat_front_2', 'cat_front_1'], frameRate: 3, repeat: -1 },
  { key: 'cat-front-blink', frames: range('cat_frontblink_', 6), frameRate: 7, repeat: 0 },
  { key: 'cat-front-meow', frames: range('cat_frontmeow_', 7), frameRate: 8, repeat: 0 },
  { key: 'cat-front-ear', frames: range('cat_frontear_', 3), frameRate: 12, repeat: 0 },
  // Второе ухо ведёт медленнее первого: и кадров больше, и частота ниже.
  { key: 'cat-front-ear2', frames: range('cat_frontear2_', 7), frameRate: 6, repeat: 0 },
  { key: 'cat-front-tail', frames: range('cat_fronttail_', 28), frameRate: 12, repeat: 0 },
  { key: 'cat-front-tilt', frames: tiltSeq(1), frameRate: 9, repeat: 0 },
  { key: 'cat-front-tilt2', frames: tiltSeq(-1), frameRate: 9, repeat: 0 },
];

// Микрособытия у стены: раз в несколько секунд проигрывается одно из них.
// Моргание и мяуканье вынесены из микрособытий: у них свой темп, чаще
// и независимо от растущего интервала залипания.
export const MICRO_EVENTS = ['cat-front-ear', 'cat-front-ear2', 'cat-front-tail', 'cat-front-tilt', 'cat-front-tilt2'];

export function registerAnimations(scene) {
  for (const a of ANIMS) {
    if (scene.anims.exists(a.key)) continue;
    scene.anims.create({
      key: a.key,
      frames: a.frames.map((key) => ({ key })),
      frameRate: a.frameRate,
      repeat: a.repeat,
    });
  }
}
