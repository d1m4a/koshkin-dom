// Поиск ближайшего доступного места для сна. Про конкретные места система
// ничего не знает — только перебирает переданную таблицу.

import { CONFIG } from '../config.js';

export class SpotManager {
  constructor(spots) {
    this.spots = spots;
    // Игровой час суток. null — времени ещё нет (Фаза 4), окна доступности
    // не проверяются.
    this.hour = null;
  }

  isAvailable(spot) {
    if (this.hour === null) return true;
    const { availableFrom: from, availableTo: to } = spot;
    // Окно может пересекать полночь: 22 → 6.
    return from <= to ? this.hour >= from && this.hour < to : this.hour >= from || this.hour < to;
  }

  nearest(x, radius = CONFIG.SPOT_RADIUS) {
    let best = null;
    let bestDist = radius;
    for (const spot of this.spots) {
      if (!this.isAvailable(spot)) continue;
      const d = Math.abs(spot.x - x);
      if (d <= bestDist) {
        best = spot;
        bestDist = d;
      }
    }
    return best;
  }

  // Клик рядом с местом подтягивается к нему, чтобы кот не останавливался
  // в полушаге от подушки.
  snap(x, radius = CONFIG.SPOT_SNAP) {
    const spot = this.nearest(x, radius);
    return spot ? spot.x : x;
  }
}
