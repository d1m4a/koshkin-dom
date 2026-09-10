import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
    // Звук из-под слежения выведен намеренно: когда в папку копируют файл,
    // Vite пытается взять его на слежение ещё в момент записи, ловит EBUSY
    // и падает целиком. Перезагружать страницу из-за звука всё равно нечего —
    // он читается один раз при загрузке.
    watch: { ignored: ['**/public/assets/audio/**'] },
  },
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
