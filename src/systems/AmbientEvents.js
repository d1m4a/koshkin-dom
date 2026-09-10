// Редкие фоновые события, пока кот сидит у стены: раз в 2-5 минут по стене
// проползает муха. Это награда терпеливому игроку — не резать, даже если
// кажется мелочью (раздел 3.3 дизайн-документа).
//
// Муха живёт на слое стены, значит едет с его скоростью 0.8 и остаётся
// «приклеенной» к обоям при прокрутке.

import { CONFIG } from '../config.js';
import { FLY_KEY } from '../render/props.js';

const range = (min, max) => min + Math.random() * (max - min);

export class AmbientEvents {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.countdown = 0;

    this.fly = scene.add
      .image(0, 0, FLY_KEY)
      .setScrollFactor(CONFIG.PARALLAX.WALL)
      .setDepth(CONFIG.DEPTH.WALL + 1)
      .setVisible(false);

    this.state = null;
  }

  arm() {
    this.enabled = true;
    this.countdown = range(CONFIG.AMBIENT_MIN, CONFIG.AMBIENT_MAX);
  }

  disarm() {
    this.enabled = false;
    this.state = null;
    this.fly.setVisible(false);
  }

  // Муха появляется в видимой части стены, ползёт короткими перебежками
  // с паузами, потом улетает вверх за край кадра.
  trigger() {
    const wallScroll = this.scene.cameras.main.scrollX * CONFIG.PARALLAX.WALL;
    const x = wallScroll + range(140, CONFIG.WIDTH - 140);
    const y = range(150, CONFIG.FLOOR_Y - 80);
    this.fly.setPosition(x, y).setVisible(true);
    this.state = { legs: 3 + Math.floor(range(0, 5)), pause: 0.4, target: null, leaving: false };
  }

  update(dt) {
    if (this.enabled && !this.state) {
      this.countdown -= dt;
      if (this.countdown <= 0) this.trigger();
    }
    if (!this.state) return;

    const s = this.state;
    if (s.pause > 0) {
      s.pause -= dt;
      return;
    }

    if (!s.target) {
      if (s.legs <= 0 && !s.leaving) {
        s.leaving = true;
        s.target = { x: this.fly.x + range(-60, 60), y: -40 };
      } else {
        s.legs -= 1;
        s.target = {
          x: this.fly.x + range(-130, 130),
          y: Math.min(CONFIG.FLOOR_Y - 60, Math.max(120, this.fly.y + range(-45, 45))),
        };
      }
    }

    const dx = s.target.x - this.fly.x;
    const dy = s.target.y - this.fly.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = s.leaving ? CONFIG.FLY_SPEED * 4 : CONFIG.FLY_SPEED;
    const step = speed * dt;

    if (dist <= step) {
      this.fly.setPosition(s.target.x, s.target.y);
      s.target = null;
      s.pause = s.leaving ? 0 : range(0.6, 2.2);
      if (s.leaving) {
        this.fly.setVisible(false);
        this.state = null;
        if (this.enabled) this.countdown = range(CONFIG.AMBIENT_MIN, CONFIG.AMBIENT_MAX);
      }
      return;
    }

    this.fly.x += (dx / dist) * step;
    this.fly.y += (dy / dist) * step;
    // Мелкое дрожание: муха не ездит по линейке.
    this.fly.y += Math.sin(this.scene.time.now / 60) * 0.35;
  }
}
