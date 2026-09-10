// Таймер бездействия: если игрок долго ничего не нажимал, кот сам уходит
// к ближайшей стене и залипает. Никакого проигрыша в этом нет — это
// награда за то, что игру оставили в покое.

import { CONFIG } from '../config.js';

export class IdleSystem {
  constructor(input, onIdle) {
    this.input = input;
    this.onIdle = onIdle;
    this.armed = true;
  }

  // states — те, из которых уход в стену допустим. Спящего кота будить
  // незачем, а идущего перебивать нельзя.
  update(catState, allowedStates) {
    if (!allowedStates.includes(catState)) {
      this.armed = true;
      return;
    }
    if (!this.armed) return;
    if (this.input.idleSeconds() < CONFIG.IDLE_TIMEOUT) return;

    this.armed = false;
    this.onIdle();
  }
}
