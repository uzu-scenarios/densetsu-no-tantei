import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { scenarioApiPlugin } from './scenario-api-plugin.ts';

export default defineConfig({
  plugins: [svelte(), scenarioApiPlugin()],
  server: {
    // 実ファイル (scenario.json) を書く API を持つので localhost 以外に公開しない。
    host: '127.0.0.1',
    // プレイ画面の harness (10001〜) と番台ごと住み分けた editor の定位置 (20001〜)。
    // 埋まっていれば繰り上がる。
    port: Number(process.env.UZU_EDITOR_PORT) || 20001,
  },
});
