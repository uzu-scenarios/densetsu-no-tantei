import { svelte } from '@sveltejs/vite-plugin-svelte';

export default {
  base: './',
  plugins: [svelte()],
  server: {
    host: true,
    cors: true,
    // harness (10001〜) / editor (20001〜) と番台を分けた play の定位置。 埋まっていれば
    // 繰り上がり、 uzu dev は vite が出力した URL を読むので追従する。
    port: Number(process.env.UZU_VITE_PORT) || 6001,
    watch: { ignored: ['**/tmp/**', '**/e2e/**'] },
  },
};
