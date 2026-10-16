/**
 * playthrough.mjs が残した state を単体表示 (?player=N) に流し込み、 基準サイズで撮る。
 * 収まり (下端のボタンが画面の外に出ていないか) を見る用。
 *
 *   node packages/play/e2e/viewports.mjs [--in=tmp/shots/play] [--out=tmp/shots/vp] [--player=0]
 */

import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { HARNESS_URL, sleep } from './harness.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true]),
);
const input = args.in ?? 'tmp/shots/play';
const out = args.out ?? 'tmp/shots/vp';
const player = Number(args.player ?? 0);
const only = args.only ? String(args.only).split(',') : null;
mkdirSync(out, { recursive: true });

// 認証要件の基準サイズ。 inset は iPhone 横持ち相当 (HUD 52 + ホームインジケータ 21、 左右ノッチ 47)。
const SIZES = [
  { name: 'min', width: 780, height: 360, inset: { top: 52, bottom: 21, left: 47, right: 47 } },
  { name: 'iphone', width: 844, height: 390, inset: { top: 52, bottom: 21, left: 47, right: 47 } },
  { name: 'ipad', width: 1194, height: 834, inset: { top: 52, bottom: 20, left: 0, right: 0 } },
];

const states = readdirSync(input)
  .filter((f) => f.endsWith('.state.json'))
  .filter((f) => !only || only.some((o) => f.includes(o)));

const browser = await chromium.launch();
// 操作はグリッド (親に __uzu_dev がある)、 撮影は席の URL を直接開いた別タブで行う。
// ホストが配る inset は URL パラメータで渡せるので、 基準サイズごとに付け替える。
const control = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await control.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
await control.waitForFunction(
  () => window.__uzu_dev && document.querySelectorAll('iframe').length >= 3,
  null,
  {
    timeout: 30_000,
  },
);
const seatUrl = new URL(
  control
    .frames()
    .find((f) => f.url().includes(`seatId=dev_${player}&`))
    .url(),
);

for (const size of SIZES) {
  const url = new URL(seatUrl);
  url.searchParams.set('uzuSafeAreaInsetTop', '0');
  url.searchParams.set('uzuSafeAreaInsetBottom', String(size.inset.bottom));
  url.searchParams.set('uzuSafeAreaInsetLeft', String(size.inset.left));
  url.searchParams.set('uzuSafeAreaInsetRight', String(size.inset.right));
  url.searchParams.set('uzuHudInsetY', String(size.inset.top));
  const host = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  // 親を持たないページでは SDK が isHosted=false で起動しないので、 iframe で包む。
  await host.setContent(
    `<style>html,body{margin:0;height:100%;overflow:hidden}</style><iframe src="${url.href}" style="border:0;width:100vw;height:100vh"></iframe>`,
  );
  await sleep(3000);
  const page = host.frames().find((f) => f.url().startsWith(seatUrl.origin));
  for (const file of states) {
    const state = JSON.parse(readFileSync(`${input}/${file}`, 'utf8'));
    await control.evaluate((s) => window.__uzu_dev.setRawState(s), state);
    await sleep(2600);
    const name = file.replace('.state.json', '');
    await host.screenshot({ path: `${out}/${size.name}-${name}.png` });
    // 下端の主ボタンが見えているか (枠の外に出ていないか) を数値でも見る。
    const clipped = await page.evaluate(() => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      return [...document.querySelectorAll('button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({
          r: b.getBoundingClientRect(),
          t: (b.textContent || '').trim().slice(0, 14),
        }))
        .filter(({ r }) => r.width > 0 && (r.bottom > h + 1 || r.right > w + 1))
        .map(({ t, r }) => `${t}@${Math.round(r.bottom)}/${h}`);
    });
    if (clipped.length) console.log(`CLIP ${size.name} ${name}: ${clipped.join(', ')}`);
  }
  await host.close();
}
await browser.close();
console.log('done');
