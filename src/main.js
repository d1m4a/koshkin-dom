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

// Разблокировка звука — прямо на событии DOM, в фазе перехвата.
//
// Внутри обработчика Phaser это не работает: Phaser разбирает ввод не в
// момент клика, а позже, в своём цикле кадров, и браузер к тому времени
// уже не считает происходящее действием пользователя — resume() молча
// игнорируется, аудиоконтекст остаётся suspended и звука нет вообще.
// Здесь же жест ещё живой.
//
// Слушатели снимаются только когда контекст действительно заработал:
// первая попытка может не пройти, а вторая пройдёт.
function unlockAudio() {
  const sound = game.sound;
  const ctx = sound && sound.context;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (sound.locked && typeof sound.unlock === 'function') sound.unlock();
  if (ctx.state === 'running') {
    window.removeEventListener('pointerdown', unlockAudio, true);
    window.removeEventListener('keydown', unlockAudio, true);
    window.removeEventListener('touchstart', unlockAudio, true);
  }
}
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);
window.addEventListener('touchstart', unlockAudio, true);

// Дев-режим: доступ к игре из консоли браузера, в сборку не попадает.
if (import.meta.env.DEV) window.__game = game;
