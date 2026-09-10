import Phaser from 'phaser';
import { CONFIG } from './config.js';
import { PALETTE } from './palette.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  // Фон холста — бумага, а не белый: иначе поля вокруг рисунка светлее его самого.
  backgroundColor: PALETTE.PAPER,
  // Графика рисованная, а не пиксельная: сглаживание включено.
  // roundPixels обязательно false — при дробных scrollFactor округление
  // позиций заставило бы слои дёргаться относительно друг друга.
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, GameScene, UIScene],
});

// Дев-режим: доступ к игре из консоли браузера, в сборку не попадает.
if (import.meta.env.DEV) window.__game = game;
