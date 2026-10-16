/**
 * 進行管理席のコンソールを実際の UI 操作で一通り使う。 フェーズの強制移動・台詞の巻き戻し・
 * タイマー・「済」の代理・票の代理入力・結末の差し替え・感想戦の出入り・ロビーへ戻す。
 * 進行管理席はゲーム画面を出さずコンソールだけなので、 撮るのはコンソール。
 *
 *   node packages/play/e2e/admin.mjs [--out=tmp/shots/admin]
 */

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { bootHarness, getRawState, seatFrame, shootSeat, sleep, waitFor } from './harness.mjs';

const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'tmp/shots/admin';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

const admin = () => seatFrame(page, 'admin_0');
const raw = () => getRawState(page);
const click = (testid) => admin().click(`[data-testid="${testid}"]`, { timeout: 10_000 });
let n = 0;
const snap = async (name, seat = 'admin_0') => {
  n += 1;
  await sleep(700);
  await shootSeat(page, seat, `${out}/${String(n).padStart(2, '0')}-${name}.png`);
};
const expectState = async (label, pred) => {
  await waitFor(label, async () => pred(await raw()), 10_000);
  console.log('ok:', label);
};
const jump = async (phaseId) => {
  await click(`admin-phase-${phaseId}`);
  await expectState(
    `jump ${phaseId}`,
    (s) => s?.game?.phaseId === phaseId && s.status === 'in_progress',
  );
};

await bootHarness(page);
await snap('lobby');

await jump('opening');
await sleep(2400);
for (let i = 0; i < 3; i += 1) await click('admin-line-next');
await expectState('台詞 3 行送る', (s) => s.game.lineIndex === 3);
await admin().click('text=◀ 戻す');
await expectState('台詞 1 行戻す', (s) => s.game.lineIndex === 2);
await snap('dialogue');

await jump('discussion');
await sleep(2400);
await admin().fill('[data-testid="admin-timer-input"]', '90');
await click('admin-timer-set');
await expectState('タイマー 90 秒', (s) => s.game.timerEndsAt !== null);
await click('admin-event-fire-ev_bags');
await expectState('手荷物検査を起こす', (s) => 'ev_bags' in s.game.events.fired);
await snap('discussion');

await jump('vote');
await sleep(2400);
const cast = [
  ['haru', 'aki', ''],
  ['natsu', 'haru', 'no'],
  ['aki', 'haru', 'yes'],
];
for (const [role, suspect, pointed] of cast) {
  await admin().selectOption(
    `select[aria-label="${role === 'haru' ? '春見' : role === 'natsu' ? '夏野' : '秋永'}の投票先"]`,
    suspect,
  );
  if (pointed) {
    await admin().selectOption(
      `select[aria-label="${role === 'natsu' ? '夏野' : '秋永'}の自己申告"]`,
      pointed,
    );
  }
  if (role === 'aki') await snap('vote-before-last');
  await click(`admin-ballot-${role}`);
}
await expectState(
  '代理の票で開票へ',
  (s) => s.game.phaseId === 'reveal' && s.game.endingPhaseId === 'ending2',
);
await sleep(2400);
await admin().selectOption('[data-testid="admin-ending-select"]', 'ending1');
await expectState('結末を差し替え', (s) => s.game.endingPhaseId === 'ending1');
await snap('reveal');
await click('admin-next');
await expectState('差し替えた結末へ', (s) => s.game.phaseId === 'ending1');

await click('admin-finish');
await expectState('感想戦へ', (s) => s.status === 'finished');
await sleep(2400);
await snap('debrief');
await click('admin-resume');
await expectState('本編へ戻す', (s) => s.status === 'in_progress' && s.game.phaseId === 'ending1');

await click('admin-reset');
await click('admin-reset-confirm');
await expectState('ロビーへ戻す', (s) => s.status === 'lobby');
await snap('lobby-again');

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
