import { defineConfig } from 'vitest/config';

// ヘッドレス（DOM 非依存）のゲームロジック / scenario テスト用。 svelte plugin は
// 読み込まず node 環境で src/server・src/scenario の純ロジックを直接検証する。
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
