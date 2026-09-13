// Сердечки над местами для сна и таймер ожидания под ними.
//
// Только для разработки: CONFIG.SHOW_SPOT_MARKERS выключает их в собранной
// игре. Выключение сделано здесь, а не в GameScene, чтобы сцене не пришлось
// проверять на пустоту каждый вызов — при выключенных метках список просто
// пуст, и update с setOccupied ничего не делают.
//
// Метки живут в мировых координатах и едут вместе с полом, а не висят
// на экране: они принадлежат комнате.
//
// Место с окном по времени не исчезает, а гаснет до призрака, и под ним
// появляется обратный отсчёт. Считается он в РЕАЛЬНЫХ минутах, а не в
// игровых часах: часов в комнате нет, и «с 12:00» игроку ничего не скажет.

import { CONFIG } from '../config.js';
import { PALETTE } from '../palette.js';
import { HEART_KEY } from '../render/props.js';

const ALPHA_OPEN = 0.6;
const ALPHA_CLOSED = 0.2;

// Сколько реальных секунд длится один игровой час.
const HOUR_SECONDS = (CONFIG.DAY_LENGTH_MINUTES * 60) / 24;

const always = (spot) => spot.availableFrom === 0 && spot.availableTo === 24;

function waitLabel(spot, hour) {
  // Часов до открытия с учётом окна, которое может пересекать полночь.
  let hours = spot.availableFrom - hour;
  if (hours < 0) hours += 24;
  const seconds = Math.ceil(hours * HOUR_SECONDS);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return 'через ' + m + ':' + String(s).padStart(2, '0');
}

export class SpotMarkers {
  constructor(scene, spots) {
    this.scene = scene;
    this.spots = spots;
    this.hiddenFor = null; // место, на котором кот прямо сейчас лежит

    this.marks = (CONFIG.SHOW_SPOT_MARKERS ? spots.spots : []).map((spot) => {
      const baseY = CONFIG.FLOOR_Y - (spot.surface || 0) - 34;
      const img = scene.add
        .image(spot.x, baseY, HEART_KEY)
        .setScrollFactor(CONFIG.PARALLAX.MAIN)
        .setDepth(CONFIG.DEPTH.ROOM + 1)
        .setAlpha(0);

      // Круглосуточным местам таймер не нужен вовсе.
      const label = always(spot)
        ? null
        : scene.add
            .text(spot.x, baseY + 16, '', {
              fontFamily: 'Georgia, serif',
              fontSize: '11px',
              color: PALETTE.GRAPHITE_2,
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(CONFIG.PARALLAX.MAIN)
            .setDepth(CONFIG.DEPTH.ROOM + 1)
            .setAlpha(0);

      return { spot, img, label, baseY, open: null, phase: Math.random() * Math.PI * 2, text: '' };
    });
  }

  // Пока кот лежит на месте, метка над ним не нужна.
  setOccupied(spot) {
    this.hiddenFor = spot;
  }

  update(time) {
    const hour = this.spots.hour === null ? 12 : this.spots.hour;

    for (const mark of this.marks) {
      const open = this.spots.isAvailable(mark.spot);
      const occupied = mark.spot === this.hiddenFor;
      const target = occupied ? 0 : open ? ALPHA_OPEN : ALPHA_CLOSED;

      if (mark.open !== target) {
        mark.open = target;
        this.scene.tweens.add({
          targets: mark.img,
          alpha: target,
          duration: 500,
          ease: 'Sine.easeInOut',
        });
        if (mark.label) {
          this.scene.tweens.add({
            targets: mark.label,
            alpha: occupied || open ? 0 : 0.85,
            duration: 500,
            ease: 'Sine.easeInOut',
          });
        }
      }

      // Еле заметное покачивание: метка живая, но не мигает.
      const bob = Math.sin(time / 900 + mark.phase) * 2.5;
      mark.img.y = mark.baseY + bob;

      if (mark.label) {
        mark.label.y = mark.baseY + 16 + bob;
        if (!open && !occupied) {
          const next = waitLabel(mark.spot, hour);
          if (next !== mark.text) {
            mark.text = next;
            mark.label.setText(next);
          }
        }
      }
    }
  }
}
