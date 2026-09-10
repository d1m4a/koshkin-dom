// Игровое время суток: 24 часа за DAY_LENGTH_MINUTES реальных минут.
//
// Ночь НЕ делается затемнением — бумага от этого превращается в грязь
// (раздел 5.6 дизайн-документа). Вместо этого тон листа уезжает от тёплого
// к холодному серому, а контраст падает: тёмные тона подтягиваются вверх.
// Экран остаётся светлым в любое время суток.

import { CONFIG } from '../config.js';

// Ключевые кадры: час → тон бумаги (MULTIPLY), его плотность и подъём теней.
const KEYS = [
  { h: 0, color: 0xd8dade, alpha: 0.72, lift: 0.16 },
  { h: 5, color: 0xd8dade, alpha: 0.66, lift: 0.14 },
  { h: 7, color: 0xe4e6ea, alpha: 0.3, lift: 0.07 },
  { h: 10, color: 0xffffff, alpha: 0, lift: 0 },
  { h: 16, color: 0xffffff, alpha: 0, lift: 0 },
  { h: 18, color: 0xf3e7d6, alpha: 0.18, lift: 0 },
  { h: 20, color: 0xe4ddd6, alpha: 0.42, lift: 0.06 },
  { h: 22, color: 0xd8dade, alpha: 0.65, lift: 0.14 },
  { h: 24, color: 0xd8dade, alpha: 0.72, lift: 0.16 },
];

const mix = (a, b, t) => a + (b - a) * t;

function mixColor(c1, c2, t) {
  const r = mix((c1 >> 16) & 0xff, (c2 >> 16) & 0xff, t);
  const g = mix((c1 >> 8) & 0xff, (c2 >> 8) & 0xff, t);
  const b = mix(c1 & 0xff, c2 & 0xff, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export class DayCycle {
  constructor(startHour = 9) {
    this.hour = startHour;
    this.speed = 24 / (CONFIG.DAY_LENGTH_MINUTES * 60); // игровых часов в секунду
  }

  update(dt) {
    this.hour = (this.hour + dt * this.speed) % 24;
  }

  get label() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  tone() {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= this.hour) i += 1;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = (this.hour - a.h) / (b.h - a.h);
    return {
      color: mixColor(a.color, b.color, t),
      alpha: mix(a.alpha, b.alpha, t),
      lift: mix(a.lift, b.lift, t),
    };
  }
}
