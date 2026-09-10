// Оверлей поверх игры: подсказки, плашка о новой позе и альбом.
// Живёт отдельной сценой, поэтому не зависит от порядка глубин в GameScene
// и не попадает под слой бумаги.

import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { PALETTE, HEX } from '../palette.js';
import { SPOTS } from '../data/spots.js';
import { pencilRect, pencilLine, pencilShape, resetSeed } from '../render/pencil.js';
import { AudioSettings } from '../systems/AudioSettings.js';

const CELL_W = 190;
const CELL_H = 168;

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.game_ = this.scene.get('Game');

    this.settings = new AudioSettings(this.game);
    this.buildHint();
    this.buildToast();
    this.buildAlbum();
    this.buildControls();
    this.buildRotateHint();

    this.game_.events.on('prompt-show', this.showHint, this);
    this.game_.events.on('prompt-move', this.moveHint, this);
    this.game_.events.on('prompt-hide', this.hideHint, this);
    this.game_.events.on('pose-unlocked', this.showToast, this);
    this.events.once('shutdown', () => {
      this.game_.events.off('prompt-show', this.showHint, this);
      this.game_.events.off('prompt-move', this.moveHint, this);
      this.game_.events.off('prompt-hide', this.hideHint, this);
      this.game_.events.off('pose-unlocked', this.showToast, this);
    });

    this.input.keyboard.on('keydown-TAB', () => this.toggleAlbum());
    this.input.keyboard.on('keydown-ESC', () => this.togglePanel(false));
    this.input.keyboard.on('keydown-M', () => {
      this.settings.toggleMute();
      this.drawControls();
    });
  }

  // ------------------------------------------------------------- подсказка
  buildHint() {
    this.hint = this.add.container(0, 0).setVisible(false);

    this.hintLabel = this.add
      .text(0, 0, '', { fontFamily: 'Georgia, serif', fontSize: '16px', color: PALETTE.GRAPHITE_1 })
      .setOrigin(0.5, 1);

    this.hintKeys = this.add
      .text(0, 4, '', { fontFamily: 'Georgia, serif', fontSize: '12px', color: PALETTE.GRAPHITE_2 })
      .setOrigin(0.5, 0);

    this.underline = this.add.graphics();
    this.hint.add([this.underline, this.hintLabel, this.hintKeys]);
  }

  showHint(spot) {
    this.hintLabel.setText(spot.hint);
    this.hintKeys.setText('пробел  ·  клик по коту');

    const w = Math.max(this.hintLabel.width, this.hintKeys.width) / 2 + 6;
    this.underline.clear().lineStyle(1, HEX.GRAPHITE_3, 0.8).lineBetween(-w, 2, w, 2);

    this.hint.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 1, duration: 180 });
  }

  // Подсказка висит над котом и едет вместе с ним.
  moveHint(screenX, screenY) {
    this.hint.setPosition(Phaser.Math.Clamp(screenX, 90, CONFIG.WIDTH - 90), screenY);
  }

  hideHint() {
    this.tweens.add({
      targets: this.hint,
      alpha: 0,
      duration: 140,
      onComplete: () => this.hint.setVisible(false),
    });
  }

  // -------------------------------------------------------- новая поза
  buildToast() {
    this.toast = this.add.container(CONFIG.WIDTH / 2, 64).setVisible(false).setDepth(10);
    const line1 = this.add
      .text(0, 0, 'новая поза', { fontFamily: 'Georgia, serif', fontSize: '12px', color: PALETTE.GRAPHITE_3 })
      .setOrigin(0.5, 1);
    this.toastName = this.add
      .text(0, 22, '', { fontFamily: 'Georgia, serif', fontSize: '20px', color: PALETTE.GRAPHITE_1 })
      .setOrigin(0.5, 1);
    this.toast.add([line1, this.toastName]);
  }

  showToast(spot) {
    this.toastName.setText(spot.poseLabel);
    this.toast.setVisible(true).setAlpha(0).setY(56);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 1, y: 64, duration: 260 });
    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: this.toast,
        alpha: 0,
        duration: 400,
        onComplete: () => this.toast.setVisible(false),
      });
    });
  }

  // ------------------------------------------------------ портрет на телефоне
  //
  // Игра горизонтальная: в портрете при FIT она ужимается в полоску, и играть
  // невозможно. Показываем подсказку вместо того, чтобы делать вид, что всё
  // в порядке.
  buildRotateHint() {
    this.rotate = this.add.container(0, 0).setDepth(40).setVisible(false);
    const bg = this.add.rectangle(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT, HEX.PAPER, 0.98).setOrigin(0, 0);
    const text = this.add
      .text(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 10, 'поверните экран', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: PALETTE.GRAPHITE_1,
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 26, 'кот живёт в широкой комнате', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: PALETTE.GRAPHITE_3,
      })
      .setOrigin(0.5);
    this.rotate.add([bg, text, sub]);

    const check = () => {
      const size = this.scale.parentSize;
      const portrait = size.height > size.width * 1.05;
      this.rotate.setVisible(portrait);
    };
    this.scale.on('resize', check);
    this.events.once('shutdown', () => this.scale.off('resize', check));
    check();
  }

  // ------------------------------------------------- кнопки и настройки звука
  //
  // Кнопки нужны не для красоты: на телефоне ни Tab, ни Esc нажать нельзя,
  // а альбом и громкость должны быть доступны.
  buildControls() {
    const x = CONFIG.WIDTH - 40;
    this.icons = this.add.graphics().setDepth(15);

    const zone = (cx, cy, w, h, fn) =>
      this.add
        .zone(cx, cy, w, h)
        .setOrigin(0.5)
        .setDepth(16)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (p, lx, ly, event) => {
          if (event) event.stopPropagation();
          fn();
        });

    zone(x, 24, 34, 34, () => this.togglePanel());
    zone(x - 38, 24, 34, 34, () => this.toggleAlbum());

    this.panel = this.add.container(0, 0).setVisible(false).setDepth(16);
    const pw = 226;
    const ph = 116;
    const px = CONFIG.WIDTH - pw - 16;
    const py = 46;

    const bg = this.add.rectangle(px, py, pw, ph, HEX.PAPER, 0.97).setOrigin(0, 0);
    const frame = this.add.graphics();
    pencilRect(frame, px, py, pw, ph, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.3 });

    const title = this.add
      .text(px + 16, py + 12, 'Звук', { fontFamily: 'Georgia, serif', fontSize: '16px', color: PALETTE.GRAPHITE_1 })
      .setOrigin(0, 0);

    this.bars = this.add.graphics();
    this.muteLabel = this.add
      .text(px + 16, py + 82, '', { fontFamily: 'Georgia, serif', fontSize: '14px', color: PALETTE.GRAPHITE_2 })
      .setOrigin(0, 0);

    const minus = this.add
      .text(px + 16, py + 42, '−', { fontFamily: 'Georgia, serif', fontSize: '22px', color: PALETTE.GRAPHITE_1 })
      .setOrigin(0, 0);
    const plus = this.add
      .text(px + pw - 30, py + 42, '+', { fontFamily: 'Georgia, serif', fontSize: '22px', color: PALETTE.GRAPHITE_1 })
      .setOrigin(0, 0);

    this.panel.add([bg, frame, title, this.bars, minus, plus, this.muteLabel]);
    this.panel.add([
      zone(px + 24, py + 54, 34, 34, () => this.changeVolume(-1)),
      zone(px + pw - 22, py + 54, 34, 34, () => this.changeVolume(1)),
      zone(px + pw / 2, py + 92, pw - 24, 28, () => {
        this.settings.toggleMute();
        this.drawControls();
      }),
    ]);

    this.drawControls();
  }

  changeVolume(delta) {
    this.settings.setLevel(this.settings.level + delta);
    this.drawControls();
  }

  drawControls() {
    const x = CONFIG.WIDTH - 40;
    const on = this.settings.on;

    this.icons.clear();
    // Значок звука: динамик и две дуги, при выключенном — перечёркнут.
    pencilShape(
      this.icons,
      [[x - 9, 20], [x - 4, 20], [x + 2, 14], [x + 2, 34], [x - 4, 28], [x - 9, 28]],
      { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1.2, fill: HEX.GRAPHITE_1, fillAlpha: on ? 0.85 : 0.25 }
    );
    if (on) {
      pencilLine(this.icons, x + 6, 18, x + 9, 24, { color: HEX.GRAPHITE_1, alpha: 0.8, width: 1.2, passes: 1 });
      pencilLine(this.icons, x + 6, 30, x + 9, 24, { color: HEX.GRAPHITE_1, alpha: 0.8, width: 1.2, passes: 1 });
    } else {
      pencilLine(this.icons, x - 10, 12, x + 10, 36, { color: HEX.GRAPHITE_1, alpha: 0.9, width: 1.4, passes: 1 });
    }
    // Значок альбома: четыре клетки.
    for (let i = 0; i < 4; i++) {
      pencilRect(this.icons, x - 46 + (i % 2) * 11, 15 + Math.floor(i / 2) * 11, 8, 8, {
        color: HEX.GRAPHITE_1,
        alpha: 0.8,
        width: 1,
        over: 1,
        passes: 1,
      });
    }

    if (!this.bars) return;
    const px = CONFIG.WIDTH - 226 - 16;
    this.bars.clear();
    for (let i = 0; i < this.settings.steps; i++) {
      const bx = px + 48 + i * 26;
      const filled = i < this.settings.level && on;
      this.bars.fillStyle(HEX.GRAPHITE_1, filled ? 0.85 : 0.15).fillRect(bx, 82, 18, 22);
      this.bars.lineStyle(1, HEX.GRAPHITE_2, 0.8).strokeRect(bx, 82, 18, 22);
    }
    this.muteLabel.setText(on ? 'Выключить звук  ·  M' : 'Включить звук  ·  M');
  }

  togglePanel(force) {
    const show = force === undefined ? !this.panel.visible : force;
    this.panel.setVisible(show);
    this.registry.set('uiOpen', show || this.album.visible);
  }

  // ----------------------------------------------------------------- альбом
  buildAlbum() {
    resetSeed(20260404);
    this.album = this.add.container(0, 0).setVisible(false).setDepth(20);

    const w = SPOTS.length * CELL_W + 60;
    const h = CELL_H + 130;
    const x = (CONFIG.WIDTH - w) / 2;
    const y = (CONFIG.HEIGHT - h) / 2;

    const paper = this.add.rectangle(x, y, w, h, HEX.PAPER, 0.97).setOrigin(0, 0);
    const frame = this.add.graphics();
    pencilRect(frame, x, y, w, h, { color: HEX.GRAPHITE_2, alpha: 0.9, width: 1.4 });
    pencilLine(frame, x + 24, y + 62, x + w - 24, y + 62, {
      color: HEX.GRAPHITE_3,
      alpha: 0.7,
      width: 1,
      passes: 1,
    });

    this.albumTitle = this.add
      .text(CONFIG.WIDTH / 2, y + 26, 'Альбом поз', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: PALETTE.GRAPHITE_1,
      })
      .setOrigin(0.5, 0);

    this.albumCount = this.add
      .text(x + w - 26, y + 32, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: PALETTE.GRAPHITE_3,
      })
      .setOrigin(1, 0);

    const hintLine = this.add
      .text(CONFIG.WIDTH / 2, y + h - 26, 'Tab — закрыть', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: PALETTE.GRAPHITE_3,
      })
      .setOrigin(0.5, 0);

    this.album.add([paper, frame, this.albumTitle, this.albumCount, hintLine]);

    // По ячейке на каждое место. Неоткрытые — сплошной силуэт.
    this.cells = SPOTS.map((spot, i) => {
      const cx = x + 30 + i * CELL_W + CELL_W / 2;
      const cy = y + 92;

      const image = this.add.image(cx, cy + CELL_H / 2 - 30, `cat_sleep_${spot.pose}_3`).setOrigin(0.5, 1);
      const pose = this.add
        .text(cx, cy + CELL_H / 2 - 22, '', {
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          color: PALETTE.GRAPHITE_1,
        })
        .setOrigin(0.5, 0);
      const place = this.add
        .text(cx, cy + CELL_H / 2 + 2, '', {
          fontFamily: 'Georgia, serif',
          fontSize: '12px',
          color: PALETTE.GRAPHITE_3,
        })
        .setOrigin(0.5, 0);

      this.album.add([image, pose, place]);
      return { spot, image, pose, place };
    });
  }

  refreshAlbum() {
    const store = this.game_.album;
    for (const cell of this.cells) {
      const known = store.has(cell.spot.id);
      // setTintFill заливает силуэт целиком — ровно то, что нужно
      // для «ещё не найдено».
      if (known) cell.image.clearTint();
      else cell.image.setTintFill(HEX.GRAPHITE_3);
      cell.image.setAlpha(known ? 1 : 0.9);
      cell.pose.setText(known ? cell.spot.poseLabel : '?');
      cell.place.setText(known ? cell.spot.label : '');
    }
    this.albumCount.setText(store.count + ' / ' + SPOTS.length);
  }

  toggleAlbum() {
    if (this.album.visible) {
      this.album.setVisible(false);
      this.registry.set('uiOpen', this.panel.visible);
      return;
    }
    this.refreshAlbum();
    this.album.setVisible(true).setAlpha(0);
    this.registry.set('uiOpen', true);
    this.tweens.add({ targets: this.album, alpha: 1, duration: 160 });
  }
}
