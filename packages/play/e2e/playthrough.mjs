/**
 * 3 人の席を実際の UI 操作 (クリック) で最初から感想戦まで通す。
 * 各フェーズで席のスクショを撮り、 console のエラーと先読みの警告が無いことを確かめる。
 *
 *   npm run harness                     # 別端末で起動しておく
 *   node packages/play/e2e/playthrough.mjs [--ending=1..5] [--out=tmp/shots/play]
 *
 * 結末は投票の組み合わせで選ぶ (既定は真エンドの 1)。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  bootHarness,
  getRawState,
  seatFrame,
  sendAs,
  shootSeat,
  sleep,
  waitFor,
} from './harness.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true]),
);
const ending = Number(args.ending ?? 1);
const out = args.out ?? 'tmp/shots/play';
const viewport = { width: Number(args.width ?? 1600), height: Number(args.height ?? 1000) };
mkdirSync(out, { recursive: true });

const SEATS = ['dev_0', 'dev_1', 'dev_2'];
// 投票の組み合わせ (役 → 投票先と自己申告)。
const VOTES = {
  1: { haru: ['natsu'], natsu: ['haru', true], aki: ['haru', false] },
  2: { haru: ['aki'], natsu: ['haru', false], aki: ['haru', true] },
  3: { haru: ['natsu'], natsu: ['haru', false], aki: ['natsu', false] },
  4: { haru: ['aki'], natsu: ['aki', true], aki: ['haru', true] },
  5: { haru: ['aki'], natsu: ['haru', false], aki: ['natsu', false] },
}[ending];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

let shot = 0;
async function snap(name, seat = 'dev_0') {
  shot += 1;
  const file = `${out}/${String(shot).padStart(2, '0')}-${name}.png`;
  await sleep(400);
  await shootSeat(page, seat, file);
  // 同じ局面を別の画面寸法で撮り直せるよう、 state も残す (e2e/viewports.mjs が読む)。
  writeFileSync(file.replace(/\.png$/, '.state.json'), JSON.stringify(await getRawState(page)));
  console.log('shot', file);
}

const frame = (seat) => seatFrame(page, seat);
const phaseId = async () => (await getRawState(page))?.game?.phaseId ?? null;
const statusOf = async () => (await getRawState(page))?.status ?? null;
async function click(seat, testid) {
  const f = frame(seat);
  await f.click(`[data-testid="${testid}"]`, { timeout: 10_000 });
}
async function waitPhase(id) {
  await waitFor(`phase ${id}`, async () => (await phaseId()) === id, 30_000);
  await sleep(300);
}
async function roleOf(seat) {
  const state = await getRawState(page);
  return state.players.find((p) => p.playerId === seat).roleId;
}

/** 担当の席の台詞札を押して、 フェーズが変わるまで読み合わせを送る。 */
async function readThrough(id, { snapAt = [] } = {}) {
  for (let guard = 0; guard < 80; guard += 1) {
    const state = await getRawState(page);
    if (state.game.phaseId !== id || state.status !== 'in_progress') return;
    const line = state.game.lineIndex;
    if (snapAt.includes(line)) await snap(`${id}-line${line}`);
    let clicked = false;
    for (const seat of SEATS) {
      const plate = await frame(seat).$('[data-testid="dialogue-plate"][data-mine]');
      if (plate) {
        await plate.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error(`${id} ${line} 行目を送れる席がない`);
    await waitFor(
      `${id} line ${line} → next`,
      async () => {
        const s = await getRawState(page);
        return s.game.phaseId !== id || s.game.lineIndex !== line || s.status !== 'in_progress';
      },
      10_000,
    );
  }
  throw new Error(`${id} が終わらない`);
}

await bootHarness(page);
await snap('lobby');
await frame('dev_0').click('[data-testid="tab-cast"]');
await snap('lobby-cast');

for (const seat of SEATS) await click(seat, 'lobby-ready');
await waitPhase('howto');
await snap('howto');
for (const seat of SEATS) await click(seat, 'skip-agree');

await waitPhase('opening');
await readThrough('opening', { snapAt: [0, 2, 5, 8] });

await waitPhase('handout');
await snap('handout-haru', 'dev_0');
await frame('dev_1').click('text=次の章 ›');
await snap('handout-natsu-beats', 'dev_1');
for (const seat of SEATS) await click(seat, 'handout-done');

await waitPhase('discussion');
await sleep(1800);
await snap('discussion-guide');
for (const seat of SEATS) await click(seat, 'guide-close');
await snap('discussion-start');

// 議論中の出来事は時刻どおりだと 2〜19 分かかるので、 進行管理席から今すぐ起こし、
// カットインとダイアログの中の操作 (カバンを開ける / 質問する) は各席の UI で押す。
const fireEvent = (id) => sendAs(page, 'admin_0', 'admin.event.fire', { eventId: id });
async function waitDialog(seat, eventId) {
  const f = frame(seat);
  await f.waitForSelector(`[data-event="${eventId}"] [role="dialog"]`, { timeout: 15_000 });
}

await fireEvent('ev_bags');
await sleep(800);
await snap('event-cutin');
await waitDialog('dev_0', 'ev_bags');
await sleep(3800);
await click('dev_0', 'event-bag-open');
await snap('event-bags-dialog', 'dev_1');
await click('dev_1', 'event-bag-open');
await click('dev_2', 'event-bag-open');
await waitFor(
  'bags opened',
  async () => Object.keys((await getRawState(page)).game.events.bags.ev_bags ?? {}).length === 3,
);

await fireEvent('ev_cleaner');
await waitDialog('dev_1', 'ev_cleaner');
await sleep(3800);
await click('dev_1', 'event-ask-q_smoking');
await sleep(500);
await snap('event-questions', 'dev_2');
await click('dev_2', 'event-ask-q_seen');

await fireEvent('ev_weapon');
await waitDialog('dev_0', 'ev_weapon');
await sleep(7600);
await snap('event-weapon');

for (const [id, asks] of [
  ['ev_inspector', ['q_rooms', 'q_seen']],
  ['ev_bug', []],
  ['ev_guide', ['q_seen']],
  ['ev_siren', []],
]) {
  await fireEvent(id);
  await waitDialog('dev_0', id);
  await sleep(asks.length ? 3800 : 500);
  for (const q of asks) await click('dev_0', `event-ask-${q}`);
}
await waitFor('events complete', async () => {
  const s = await getRawState(page);
  return Object.keys(s.game.events.fired).length === 7;
});
// 残っているダイアログを閉じてから卓を見る
for (const seat of SEATS) {
  const closer = await frame(seat).$('[data-testid="event-close"]');
  if (closer) await closer.click();
}
await sleep(4500);
await snap('discussion-clues');
await click('dev_0', 'clue-testimony_inspector');
await snap('clue-detail');
await frame('dev_0').click('button[aria-label="閉じる"]');
await click('dev_0', 'tab-map');
await snap('map');
await click('dev_0', 'open-notebook');
await snap('notebook-dialog');
await frame('dev_0').click('button[aria-label="閉じる"]');
await click('dev_0', 'cast-rail');
await snap('cast-dialog');
await frame('dev_0').click('button[aria-label="閉じる"]');
// 議論は時間いっぱい続くので、 進行管理席から切り上げる。
await sendAs(page, 'admin_0', 'admin.next');

await waitPhase('vote');
await sleep(1600);
await snap('vote-empty', 'dev_1');
for (const seat of SEATS) {
  const role = await roleOf(seat);
  const [suspect, pointed] = VOTES[role];
  await click(seat, `suspect-${suspect}`);
  if (pointed !== undefined) await click(seat, pointed ? 'declare-yes' : 'declare-no');
  if (seat === 'dev_1') await snap('vote-filled', 'dev_1');
  await click(seat, 'vote-submit');
  if (seat === 'dev_0') await snap('vote-submitted', 'dev_0');
}

await waitPhase('reveal');
await sleep(1800);
await snap('reveal');
for (const seat of SEATS) await click(seat, 'reveal-confirm');

const endingId = `ending${ending}`;
await waitPhase(endingId);
await readThrough(endingId, { snapAt: [0, 3, 5, 6, 9] });

await waitFor('finished', async () => (await statusOf()) === 'finished', 15_000);
await sleep(2400);
await snap('debrief-result');
for (const tab of ['truth', 'timeline', 'notebooks', 'endings', 'afterword']) {
  await click('dev_0', `tab-${tab}`);
  await snap(`debrief-${tab}`);
}

const warnings = await page.evaluate(() => window.__uzu_dev.getPredictionWarnings?.() ?? []);
for (const seat of SEATS) {
  const f = frame(seat);
  const seatWarnings = await f.evaluate(() => window.__uzu_dev?.getPredictionWarnings?.() ?? []);
  if (seatWarnings.length) errors.push(`[${seat}] prediction: ${JSON.stringify(seatWarnings)}`);
}
if (warnings.length) errors.push(`prediction: ${JSON.stringify(warnings)}`);
const final = await getRawState(page);
console.log('reached', final.game.reachedEndingPhaseId, 'status', final.status);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
