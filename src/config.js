export const CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,

  // Мир шире экрана — камера едет за котом.
  WORLD_WIDTH: 2560,
  // Кот шириной 120 px должен целиком помещаться между углами комнаты.
  WORLD_LEFT: 90,
  WORLD_RIGHT: 2470,
  FLOOR_Y: 430,

  CAT_SPEED: 90, // px/сек
  CAT_WIDTH: 120,
  SPOT_RADIUS: 60,
  SPOT_SNAP: 40, // клик рядом с местом → кот встаёт точно на него
  ARRIVE_EPS: 3, // порог «дошёл до цели клика»

  CAM_LERP: 0.08,
  CAM_DEADZONE_W: 280,
  CAM_LOOK_AHEAD: 90,
  CAM_LOOK_AHEAD_MS: 600,

  // Глубина имитируется только скоростью прокрутки — перспективы нет.
  PARALLAX: { WINDOW: 0.25, WALL: 0.8, MAIN: 1.0, FORE: 1.15 },
  DEPTH: { WINDOW: 0, WALL: 10, ROOM: 20, CAT: 30, FORE: 40, UI: 900, PAPER: 1000 },

  PAPER_ALPHA: 0.4,
  PAPER_TILE: 512,

  IDLE_TIMEOUT: 25, // сек без ввода до ухода в стену
  MICRO_EVENT_MIN: 4,
  MICRO_EVENT_MAX: 12,
  MICRO_EVENT_DECAY: 1.15, // во сколько раз растёт интервал за каждое событие
  MICRO_EVENT_CAP: 20, // дальше не растёт: кот визуально «застыл»

  // Моргание и мяуканье у сидящего кота идут своим темпом и не растягиваются
  // вместе с микрособытиями: живой кот моргает часто, что бы ни происходило.
  BLINK_MIN: 2.5,
  BLINK_MAX: 6,
  MEOW_MIN: 14,
  MEOW_MAX: 32,
  MEOW_VOLUME: 0.45,

  // Фоновые события у стены — награда терпеливому игроку, раз в 2-5 минут.
  AMBIENT_MIN: 120,
  AMBIENT_MAX: 300,
  FLY_SPEED: 46,

  PURR_FADE_IN: 800,
  PURR_FADE_OUT: 600,
  PURR_VOLUME_DEEP: 0.8,
  PURR_VOLUME_BREATH: 0.32,
  AMBIENT_VOLUME_HUM: 0.12,
  // Щелчок стал резче после того, как нормализация переехала за огибающую.
  AMBIENT_VOLUME_CLOCK: 0.055,

  DAY_LENGTH_MINUTES: 6, // реальных минут на 24 игровых часа
};

// Слой с scrollFactor f смещается медленнее камеры, поэтому его собственная
// ширина меньше мировой: край мира приходится на край слоя.
export function layerWidth(factor) {
  return Math.ceil(CONFIG.WIDTH + (CONFIG.WORLD_WIDTH - CONFIG.WIDTH) * factor);
}
