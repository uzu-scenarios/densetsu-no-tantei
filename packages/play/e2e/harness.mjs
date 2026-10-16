/**
 * dev harness (`npm run harness`) を Playwright から叩く共通部品。
 * `window.__uzu_dev` は親 frame にだけ生えているので page.evaluate からそのまま使える。
 * port は埋まっていれば繰り上がるので、 起動ログの URL を UZU_HARNESS_URL で渡す。
 */

export const HARNESS_URL = process.env.UZU_HARNESS_URL || 'http://localhost:10001/';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const getRawState = (page) => page.evaluate(() => window.__uzu_dev.getRawState());

export const sendAs = (page, as, type, payload = {}) =>
  page.evaluate(({ as, type, payload }) => window.__uzu_dev.send({ as, type, payload }), {
    as,
    type,
    payload,
  });

/** async 述語を node 側でポーリングする (waitForFunction は Promise を truthy と誤判定する)。 */
export async function waitFor(label, predicate, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() > deadline) throw new Error(`timeout: ${label}`);
    await sleep(200);
  }
}

export const seatFrame = (page, seat) =>
  page.frames().find((f) => f.url().includes(`seatId=${seat}&`));

/** harness を開いて部屋をロビーの初期状態に戻す。 */
export async function bootHarness(page, { seats = 4 } = {}) {
  await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    (n) => window.__uzu_dev && document.querySelectorAll('iframe').length >= n,
    seats,
    {
      timeout: 30_000,
    },
  );
  await page.evaluate(() => window.__uzu_dev.reset({ seed: 1 }));
  await page.waitForFunction((n) => document.querySelectorAll('iframe').length >= n, seats);
  // 席の client がロビーを描き終えるまで待つ (親の getRawState は最初の action まで null のことがある)。
  await waitFor(
    'lobby',
    async () => {
      const frame = seatFrame(page, 'dev_0');
      return Boolean(frame && (await frame.$('[data-testid="lobby"]')));
    },
    30_000,
  );
}

/** 席の iframe 1 枚を撮る。 */
export async function shootSeat(page, seat, path) {
  const el = await page.$(`iframe[src*="seatId=${seat}&"]`);
  if (el) await el.screenshot({ path });
}
