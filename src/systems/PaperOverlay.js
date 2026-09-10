// Зерно бумаги — один статичный слой поверх всей сцены, scrollFactor = 0.
// Лист не двигается никогда: движется рисунок под ним. Именно это даёт
// ощущение, что игра нарисована на листе, который лежит перед игроком.
//
// Текстуру бумаги нельзя запекать в спрайты: зерно поехало бы вместе с котом.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { makePaperTexture } from '../render/pencil.js';

export const PAPER_KEY = 'paper-grain';

export class PaperOverlay {
  static prepare(scene) {
    makePaperTexture(scene, PAPER_KEY, CONFIG.PAPER_TILE);
  }

  constructor(scene) {
    this.scene = scene;

    this.grain = scene.add
      .tileSprite(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, PAPER_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CONFIG.DEPTH.PAPER)
      .setAlpha(CONFIG.PAPER_ALPHA);
    this.grain.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Время суток: не затемнение, а сдвиг тона бумаги от тёплого к холодному.
    this.tone = scene.add
      .rectangle(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, 0xffffff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CONFIG.DEPTH.PAPER - 1);
    this.tone.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Падение контраста: холодная плёнка в режиме SCREEN подтягивает
    // тёмные тона вверх. Именно это создаёт ощущение сумерек на листе,
    // тогда как затемнение сделало бы из бумаги грязь.
    this.lift = scene.add
      .rectangle(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, 0xc9d2dc, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CONFIG.DEPTH.PAPER - 2);
    this.lift.setBlendMode(Phaser.BlendModes.SCREEN);
  }

  setDayTone({ color, alpha, lift }) {
    this.tone.fillColor = color;
    this.tone.fillAlpha = alpha;
    this.lift.fillAlpha = lift;
  }
}
