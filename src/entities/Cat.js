// Кот: спрайт плюс конечный автомат. Каждое состояние — объект с
// enter/update/exit, никакого if/else в главном цикле.
// Физики нет: движение — это x += speed * dt.
//
// Про сцену кот не знает: всё наружу уходит через колбэки в deps.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { CAT_FOOT_OFFSET } from '../render/catBody.js';
import { MICRO_EVENTS, poseAnims } from '../data/animations.js';

export const STATE = {
  IDLE_STAND: 'IDLE_STAND',
  WALK: 'WALK',
  PROMPT: 'PROMPT',
  ENTERING: 'ENTERING',
  SLEEPING: 'SLEEPING',
  WAKING: 'WAKING',
  GOING_TO_WALL: 'GOING_TO_WALL',
  WALL_STARE: 'WALL_STARE',
  WALL_RISE: 'WALL_RISE',
};

const STATES = {
  [STATE.IDLE_STAND]: {
    enter(cat) {
      cat.sprite.play('cat-idle');
    },
    update(cat, dt, intent) {
      if (cat.desiredDir(intent) !== 0) {
        cat.setState(STATE.WALK);
        return;
      }
      // Стоим у места для сна — предлагаем лечь.
      const spot = cat.deps.spots.nearest(cat.x);
      if (spot) {
        cat.spot = spot;
        cat.setState(STATE.PROMPT);
      }
    },
  },

  [STATE.WALK]: {
    enter(cat) {
      cat.sprite.play('cat-walk');
    },
    update(cat, dt, intent) {
      const dir = cat.desiredDir(intent);
      if (dir === 0) {
        cat.setState(STATE.IDLE_STAND);
        return;
      }
      cat.face(dir);

      const next = cat.x + dir * CONFIG.CAT_SPEED * dt;
      cat.x = Phaser.Math.Clamp(next, CONFIG.WORLD_LEFT, CONFIG.WORLD_RIGHT);
      cat.sprite.x = cat.x;

      // Дошли до цели клика или упёрлись в край мира — цель снимается.
      if (intent.target !== null) {
        const arrived = Math.abs(intent.target - cat.x) <= CONFIG.ARRIVE_EPS;
        const stuck = cat.x <= CONFIG.WORLD_LEFT || cat.x >= CONFIG.WORLD_RIGHT;
        if (arrived || stuck) {
          intent.clearTarget();
          cat.setState(STATE.IDLE_STAND);
        }
      }
    },
  },

  [STATE.PROMPT]: {
    enter(cat) {
      cat.sprite.play('cat-idle');
      cat.deps.onPrompt(cat.spot);
    },
    update(cat, dt, intent) {
      if (cat.desiredDir(intent) !== 0) {
        cat.setState(STATE.WALK);
        return;
      }
      if (intent.consumeAction()) {
        cat.setState(STATE.ENTERING);
        return;
      }
      // Место могло стать недоступным по времени суток (Фаза 4).
      if (cat.deps.spots.nearest(cat.x) !== cat.spot) cat.setState(STATE.IDLE_STAND);
    },
    exit(cat) {
      cat.deps.onPromptHide();
    },
  },

  [STATE.ENTERING]: {
    enter(cat) {
      cat.x = cat.spot.x;
      cat.sprite.x = cat.x;
      cat.face(cat.spot.facing === 'left' ? -1 : 1);
      const sit = () => cat.playOnce(poseAnims(cat.spot.pose).sit, () => cat.setState(STATE.SLEEPING));
      // Место может быть выше пола (комод, диван) — сначала запрыгнуть.
      if (cat.spot.surface) cat.hopTo(cat.surfaceY(cat.spot), sit);
      else sit();
    },
    update() {},
  },

  [STATE.SLEEPING]: {
    enter(cat, intent) {
      cat.sprite.play(poseAnims(cat.spot.pose).sleep);
      // Запоминаем счётчик ввода: разбудит ЛЮБОЕ следующее нажатие,
      // но не то, которым кота уложили.
      cat.wakeSeq = intent.seq;
      cat.deps.onSleepStart(cat.spot);
    },
    update(cat, dt, intent) {
      if (intent.seq !== cat.wakeSeq) {
        intent.clearTarget();
        intent.consumeAction();
        cat.setState(STATE.WAKING);
      }
    },
    exit(cat) {
      cat.deps.onSleepEnd(cat.spot);
    },
  },

  [STATE.WAKING]: {
    enter(cat) {
      cat.playOnce(poseAnims(cat.spot.pose).wake, () => {
        if (cat.spot.surface) cat.hopTo(cat.floorY(), () => cat.setState(STATE.IDLE_STAND));
        else cat.setState(STATE.IDLE_STAND);
      });
    },
    update() {},
  },

  // Игрок долго ничего не нажимал — кот сам идёт к ближайшему краю комнаты.
  [STATE.GOING_TO_WALL]: {
    enter(cat, intent) {
      cat.wakeSeq = intent.seq;
      const toLeft = cat.x - CONFIG.WORLD_LEFT < CONFIG.WORLD_RIGHT - cat.x;
      cat.wallX = toLeft ? CONFIG.WORLD_LEFT : CONFIG.WORLD_RIGHT;
      cat.face(toLeft ? -1 : 1);
      cat.sprite.play('cat-walk');
    },
    update(cat, dt, intent) {
      // Любой ввод возвращает управление игроку.
      if (intent.seq !== cat.wakeSeq) {
        cat.setState(STATE.IDLE_STAND);
        return;
      }
      const dir = Math.sign(cat.wallX - cat.x);
      const next = cat.x + dir * CONFIG.CAT_SPEED * dt;
      const done = dir > 0 ? next >= cat.wallX : next <= cat.wallX;
      cat.x = done ? cat.wallX : next;
      cat.sprite.x = cat.x;
      if (done) cat.setState(STATE.WALL_STARE);
    },
  },

  // Сидит анфас и залипает, глядя на игрока. Чем дольше сидит, тем реже
  // микрособытия — визуально кот застывает.
  [STATE.WALL_STARE]: {
    enter(cat, intent) {
      cat.wakeSeq = intent.seq;
      cat.microCount = 0;
      cat.microTimer = cat.nextMicroDelay();
      cat.blinkTimer = cat.nextBlinkDelay();
      cat.meowTimer = cat.nextMeowDelay();
      cat.backReady = false;
      cat.playOnce('cat-front-sit', () => {
        cat.backReady = true;
        cat.sprite.play('cat-front');
      });
      cat.deps.onWallStare(true);
    },
    update(cat, dt, intent) {
      if (intent.seq !== cat.wakeSeq) {
        intent.clearTarget();
        intent.consumeAction();
        cat.setState(STATE.WALL_RISE);
        return;
      }
      if (!cat.backReady) return;

      cat.blinkTimer -= dt;
      cat.meowTimer -= dt;
      cat.microTimer -= dt;

      // Одноразовые анимации не перебивают друг друга: если сейчас играет
      // моргание или мяуканье, событие подождёт до возвращения в цикл.
      const busy = cat.sprite.anims.currentAnim && cat.sprite.anims.currentAnim.key !== 'cat-front';

      if (cat.meowTimer <= 0 && !busy) {
        cat.meowTimer = cat.nextMeowDelay();
        cat.deps.onMeow();
        cat.playOnce('cat-front-meow', () => cat.sprite.play('cat-front'));
        return;
      }

      if (cat.blinkTimer <= 0 && !busy) {
        cat.blinkTimer = cat.nextBlinkDelay();
        cat.playOnce('cat-front-blink', () => cat.sprite.play('cat-front'));
        return;
      }

      if (cat.microTimer > 0 || busy) return;

      cat.microCount += 1;
      cat.microTimer = cat.nextMicroDelay();
      const key = MICRO_EVENTS[Math.floor(Math.random() * MICRO_EVENTS.length)];
      cat.playOnce(key, () => cat.sprite.play('cat-front'));
    },
    exit(cat) {
      cat.deps.onWallStare(false);
    },
  },

  [STATE.WALL_RISE]: {
    enter(cat) {
      cat.playOnce('cat-front-rise', () => cat.setState(STATE.IDLE_STAND));
    },
    update() {},
  },
};

export class Cat {
  constructor(scene, x, deps) {
    this.scene = scene;
    this.x = x;
    this.facing = 1;
    this.onFacingChange = null;
    this.spot = null;
    this.wakeSeq = 0;
    this.wallX = 0;
    this.microCount = 0;
    this.microTimer = 0;
    this.blinkTimer = 0;
    this.meowTimer = 0;
    this.backReady = false;
    this.deps = deps;

    this.sprite = scene.add
      .sprite(x, CONFIG.FLOOR_Y + CAT_FOOT_OFFSET, 'cat_idle_0')
      .setOrigin(0.5, 1)
      .setDepth(CONFIG.DEPTH.CAT);

    this.state = null;
    this.setState(STATE.IDLE_STAND, { seq: 0 });
  }

  setState(name, intent) {
    if (this.state === name) return;
    const prev = STATES[this.state];
    if (prev && prev.exit) prev.exit(this);
    this.state = name;
    STATES[name].enter(this, intent || this.lastIntent || { seq: 0 });
  }

  floorY() {
    return CONFIG.FLOOR_Y + CAT_FOOT_OFFSET;
  }

  surfaceY(spot) {
    return CONFIG.FLOOR_Y - (spot.surface || 0) + CAT_FOOT_OFFSET;
  }

  // Запрыгивание и спрыгивание. Заглушка: движение по вертикали без
  // отдельной анимации прыжка — она появится вместе с настоящими рисунками.
  hopTo(y, onDone) {
    this.scene.tweens.add({
      targets: this.sprite,
      y,
      duration: 260,
      ease: 'Sine.easeOut',
      onComplete: onDone,
    });
  }

  playOnce(key, onDone) {
    this.sprite.off('animationcomplete');
    this.sprite.play(key);
    this.sprite.once('animationcomplete', onDone);
  }

  // Куда кот хочет идти: клавиши сильнее цели клика.
  desiredDir(intent) {
    if (intent.keyDir !== 0) return intent.keyDir;
    if (intent.target === null) return 0;
    const dx = intent.target - this.x;
    return Math.abs(dx) <= CONFIG.ARRIVE_EPS ? 0 : Math.sign(dx);
  }

  // Моргание и мяуканье со временем не редеют: живой кот моргает часто,
  // сколько бы он ни сидел.
  nextBlinkDelay() {
    return CONFIG.BLINK_MIN + Math.random() * (CONFIG.BLINK_MAX - CONFIG.BLINK_MIN);
  }

  nextMeowDelay() {
    return CONFIG.MEOW_MIN + Math.random() * (CONFIG.MEOW_MAX - CONFIG.MEOW_MIN);
  }

  // Интервал микрособытия растёт с каждым разом, но не бесконечно.
  nextMicroDelay() {
    const base = CONFIG.MICRO_EVENT_MIN + Math.random() * (CONFIG.MICRO_EVENT_MAX - CONFIG.MICRO_EVENT_MIN);
    return Math.min(CONFIG.MICRO_EVENT_CAP, base * Math.pow(CONFIG.MICRO_EVENT_DECAY, this.microCount));
  }

  face(dir) {
    if (dir === 0 || dir === this.facing) return;
    this.facing = dir;
    // Текстура нарисована мордой вправо.
    this.sprite.setFlipX(dir < 0);
    if (this.onFacingChange) this.onFacingChange(dir);
  }

  update(dt, intent) {
    this.lastIntent = intent;
    STATES[this.state].update(this, dt, intent);
  }
}
