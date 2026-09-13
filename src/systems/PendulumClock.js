// Маятник настенных часов.
//
// Ход маятника взят не от таймера сцены, а от позиции самой петли тиканья:
// иначе картинка и звук разъезжаются за минуты. В записи (tools/synth.cjs)
// щелчки стоят ровно на целых секундах, петля длится четыре секунды, поэтому
// косинус с периодом две секунды приводит маятник в крайнюю точку ровно
// на каждый щелчок. Без звука часы идут по времени сцены — сверять не с чем.

import { CONFIG } from '../config.js';
import { HEX } from '../palette.js';
import { bakeTexture, pencilCircle, pencilLine } from '../render/pencil.js';
import { CLOCK } from '../data/roomLiving.js';

const KEY = 'clock-pendulum';
const SWING = 0.17; // размах в радианах, примерно десять градусов

function drawPendulum(g) {
  const cx = CLOCK.penW / 2;
  const top = CLOCK.penPivot;
  const bob = top + CLOCK.penRod;
  pencilLine(g, cx, top, cx, bob, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.4, passes: 1, jitter: 0.4 });
  pencilCircle(g, cx, bob, CLOCK.penBob, {
    color: HEX.GRAPHITE_2,
    alpha: 0.9,
    width: 1.3,
    fill: HEX.GRAPHITE_4,
    fillAlpha: 0.6,
  });
}

export class PendulumClock {
  static bake(scene) {
    bakeTexture(scene, KEY, CLOCK.penW, CLOCK.penH, drawPendulum);
  }

  constructor(scene) {
    // Координаты и scrollFactor те же, что у слоя стены: маятник обязан
    // ехать вместе с корпусом, а корпус запечён в стену.
    this.img = scene.add
      .image(CLOCK.x, CLOCK.pivotY, KEY)
      .setOrigin(0.5, CLOCK.penPivot / CLOCK.penH)
      .setScrollFactor(CONFIG.PARALLAX.WALL)
      .setDepth(CONFIG.DEPTH.WALL + 1);
  }

  // phase — позиция петли тиканья в секундах или null, если звука нет.
  update(time, phase) {
    const t = phase === null ? time / 1000 : phase;
    this.img.rotation = Math.cos(Math.PI * t) * SWING;
  }
}
