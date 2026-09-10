// Сборка слоёв параллакса по описанию из data/*. Про конкретную комнату
// эта система ничего не знает: получает список слоёв и расставляет их
// по depth и scrollFactor.

import { bakeTexture } from '../render/pencil.js';

export class ParallaxLayers {
  constructor(scene, specs) {
    this.scene = scene;
    this.specs = specs;
    this.objects = new Map();
    this.tiles = []; // слои с внутренней прокруткой (вид в окно)
  }

  // Печём один раз при загрузке: слой из сотен штрихов не должен
  // пересобираться каждый кадр.
  static bakeAll(scene, specs) {
    for (const s of specs) {
      const [w, h] = s.size;
      bakeTexture(scene, s.key, w, h, s.draw);
    }
  }

  build() {
    for (const s of this.specs) {
      const obj =
        s.kind === 'tile'
          ? this.scene.add.tileSprite(s.at.x, s.at.y, s.at.w, s.at.h, s.key).setOrigin(0, 0)
          : this.scene.add.image(0, 0, s.key).setOrigin(0, 0);

      obj.setScrollFactor(s.factor).setDepth(s.depth);
      this.objects.set(s.key, obj);
      if (s.kind === 'tile') this.tiles.push({ obj, spec: s });
    }
    return this;
  }

  // Вид за окном — TileSprite в самом проёме, а не отдельный слой под маской:
  // маска и маскируемый объект жили бы в разных scrollFactor и разъехались бы
  // при первой же прокрутке. Здесь проём обрезает картинку сам собой.
  update(camera) {
    for (const { obj, spec } of this.tiles) {
      obj.tilePositionX = camera.scrollX * (spec.viewFactor - spec.factor);
    }
  }

  get(key) {
    return this.objects.get(key);
  }
}
