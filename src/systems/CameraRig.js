// Камера: границы мира, мёртвая зона, плавное следование и опережение взгляда.

import { CONFIG } from '../config.js';

export class CameraRig {
  constructor(scene, target) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.facing = 1;
    this.offsetTween = null;

    this.cam.setBounds(0, 0, CONFIG.WORLD_WIDTH, CONFIG.HEIGHT);
    // lerpY = 1: по вертикали камера не ездит вовсе.
    this.cam.startFollow(target, true, CONFIG.CAM_LERP, 1);
    // Без мёртвой зоны кадр «дышит» на каждый шаг и укачивает.
    this.cam.setDeadzone(CONFIG.CAM_DEADZONE_W, CONFIG.HEIGHT);
    this.cam.setFollowOffset(-CONFIG.CAM_LOOK_AHEAD, 0);
  }

  // followOffset вычитается из позиции цели, поэтому взгляд вперёд —
  // это отрицательное смещение по направлению движения.
  setFacing(dir) {
    if (dir === 0 || dir === this.facing) return;
    this.facing = dir;
    if (this.offsetTween) this.offsetTween.remove();
    this.offsetTween = this.scene.tweens.add({
      targets: this.cam.followOffset,
      x: -dir * CONFIG.CAM_LOOK_AHEAD,
      duration: CONFIG.CAM_LOOK_AHEAD_MS,
      ease: 'Sine.easeInOut',
    });
  }
}
