// Генерация всех текстур-заглушек. Файлов с ассетами пока нет — рисуем кодом,
// поэтому «загрузка» здесь синхронная работа, разбитая на шаги: по одному
// шагу за кадр, чтобы полоса прогресса успевала перерисоваться.
//
// Шаги гоняются из update(), а не цепочкой delayedCall: таймеры внутри
// таймеров при блокирующих задачах ведут себя непредсказуемо.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { PALETTE, HEX } from '../palette.js';
import { LAYERS, resetRoomSeed } from '../data/roomLiving.js';
import { PaperOverlay } from '../systems/PaperOverlay.js';
import { AUDIO_FILES } from '../systems/AudioManager.js';
import { makeCatTextures } from '../render/catArt.js';
import { makePropTextures } from '../render/props.js';
import { registerAnimations } from '../data/animations.js';
import { bakeTexture } from '../render/pencil.js';
import { PendulumClock } from '../systems/PendulumClock.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // Звук — единственное, что грузится файлами: OGG и MP3, Phaser берёт
  // поддерживаемый. Вся графика по-прежнему считается кодом.
  preload() {
    for (const { key, urls } of AUDIO_FILES) this.load.audio(key, urls);
  }

  create() {
    const { WIDTH, HEIGHT } = CONFIG;

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 40, 'рисуем комнату…', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: PALETTE.GRAPHITE_2,
      })
      .setOrigin(0.5);

    this.barW = 320;
    this.barX = (WIDTH - this.barW) / 2;
    this.barY = HEIGHT / 2;
    this.add.graphics().lineStyle(1, HEX.GRAPHITE_3, 0.9).strokeRect(this.barX, this.barY, this.barW, 8);
    this.fill = this.add.graphics();

    resetRoomSeed();

    this.tasks = [
      () => PaperOverlay.prepare(this),
      () => {
        makeCatTextures(this);
        registerAnimations(this);
      },
      () => makePropTextures(this),
      () => PendulumClock.bake(this),
      ...LAYERS.map((spec) => () => bakeTexture(this, spec.key, spec.size[0], spec.size[1], spec.draw)),
    ];
    this.done = 0;
    this.warmup = 2; // дать первому кадру отрисоваться до блокирующей работы
    this.started = false;
    this.t0 = performance.now();
  }

  update() {
    if (this.started) return;

    if (this.warmup > 0) {
      this.warmup -= 1;
      return;
    }

    if (this.done < this.tasks.length) {
      // Бюджет по времени, а не «одна задача за кадр»: в фоновой вкладке
      // кадры приходят раз в секунду, и загрузка растянулась бы на минуты.
      const frameStart = performance.now();
      while (this.done < this.tasks.length && performance.now() - frameStart < 12) {
        this.tasks[this.done]();
        this.done += 1;
      }
      this.fill
        .clear()
        .fillStyle(HEX.GRAPHITE_2, 0.85)
        .fillRect(this.barX, this.barY, (this.barW * this.done) / this.tasks.length, 8);
      return;
    }

    this.started = true;
    if (import.meta.env.DEV) {
      console.log('[boot] текстуры готовы за', Math.round(performance.now() - this.t0), 'мс');
    }
    this.scene.start('Title');
  }
}
