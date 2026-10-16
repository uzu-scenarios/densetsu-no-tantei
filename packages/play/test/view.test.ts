/**
 * 画面の導出 (view/) の純関数。 出来事のダイアログをいつ出していつ閉じるか、 本文の記法、
 * 残り時間の表示。
 */

import { scenarioData } from '@scenario/data';
import { GAME_START, type GameTime, plus } from '@uzuhq/code-sdk';
import { describe, expect, it } from 'vitest';
import type { RoomState } from '../src/lib/types';
import { getPhase } from '../src/scenario/lookup';
import logic from '../src/server/logic';
import { buildEventView, CUTIN_MS, LATE_AFTER_MS, LINGER_MS, SAY_MS } from '../src/view/event-view';
import { parseRichText, plainText } from '../src/view/rich-text';
import { buildTimerView, formatClock, warnAtSecondsOf } from '../src/view/timer-view';

const ADMIN = 'admin_0';
const seats = ['p0', 'p1', 'p2'].map((id) => ({ id, nickname: id, iconUrl: '' }));

function discussionAt(time: GameTime): RoomState {
  const ctx = { time, after: (d: number) => plus(time, d), emit: () => {} };
  const state = logic.setup({ players: seats, ctx } as never);
  const send = (playerId: string, type: keyof typeof logic.actions, payload?: unknown) =>
    (logic.actions[type] as (args: unknown) => void)({ state, payload, playerId, ctx });
  for (const seat of seats) send(seat.id, 'lobby.ready', { ready: true });
  send(ADMIN, 'admin.jump', { phaseId: 'discussion' });
  return state;
}

describe('出来事のダイアログ', () => {
  const phase = getPhase(scenarioData, 'discussion');
  const firedAt = plus(GAME_START, 60_000);
  const none = new Set<string>();

  function fired(eventId: string) {
    const state = discussionAt(GAME_START);
    state.game.events.fired[eventId] = firedAt;
    return state;
  }
  const at = (ms: number) => plus(firedAt, ms);

  it('起きた直後はカットイン、 そのあと台詞を 1 行ずつ出し、 読み終えたら操作を受け付ける', () => {
    const state = fired('ev_weapon');
    const view = (ms: number) => buildEventView(scenarioData, phase, state, at(ms), none, none);
    expect(view(0)).toMatchObject({ cutin: true, open: false });
    expect(view(CUTIN_MS)).toMatchObject({ cutin: false, saysShown: 1, open: false });
    expect(view(CUTIN_MS + SAY_MS)).toMatchObject({ saysShown: 2 });
    expect(view(CUTIN_MS + 2 * SAY_MS)).toMatchObject({ open: true, complete: true });
  });

  it('情報が出るだけの出来事は、 読み終えて少し置いたら閉じる', () => {
    const state = fired('ev_weapon');
    const readMs = CUTIN_MS + 2 * SAY_MS;
    expect(
      buildEventView(scenarioData, phase, state, at(readMs + LINGER_MS), none, none),
    ).not.toBeNull();
    expect(
      buildEventView(scenarioData, phase, state, at(readMs + LINGER_MS + 1), none, none),
    ).toBeNull();
  });

  it('遅れて開いた画面は、 カットインと台詞送りを省いてすぐ操作できる', () => {
    const state = fired('ev_bags');
    const view = buildEventView(
      scenarioData,
      phase,
      state,
      at(LATE_AFTER_MS + 1),
      none,
      new Set(['ev_bags']),
    );
    expect(view).toMatchObject({ cutin: false, open: true, complete: false });
  });

  it('自分で閉じた出来事は出さない', () => {
    const state = fired('ev_bags');
    expect(
      buildEventView(scenarioData, phase, state, at(0), new Set(['ev_bags']), none),
    ).toBeNull();
  });

  it('手荷物検査は全員が開けるまで閉じない', () => {
    const state = fired('ev_bags');
    expect(buildEventView(scenarioData, phase, state, at(10 * 60_000), none, none)).toMatchObject({
      complete: false,
    });
  });
});

describe('本文の記法', () => {
  it('ルビ・場所の札・強調を分け、 強調は行をまたいで続く', () => {
    expect(parseRichText('斜六(しゃろく)は〈喫煙室〉に**居た\nはず**だ')).toEqual([
      [
        [
          { kind: 'ruby', base: '斜六', reading: 'しゃろく', strong: false },
          { kind: 'text', text: 'は', strong: false },
          { kind: 'place', text: '喫煙室', strong: false },
          { kind: 'text', text: 'に', strong: false },
          { kind: 'text', text: '居た', strong: true },
        ],
        [
          { kind: 'text', text: 'はず', strong: true },
          { kind: 'text', text: 'だ', strong: false },
        ],
      ],
    ]);
  });

  it('記法を落とした文字列にする', () => {
    expect(plainText('斜六(しゃろく)は〈喫煙室〉に**居た**')).toBe('斜六は喫煙室に居た');
  });
});

describe('残り時間', () => {
  it('m:ss で出し、 終盤の秒数を切ったら熱くする', () => {
    const endsAt = plus(GAME_START, 90_500);
    expect(buildTimerView(endsAt, GAME_START, 60)).toEqual({
      seconds: 91,
      label: '1:31',
      warn: false,
    });
    expect(buildTimerView(endsAt, plus(GAME_START, 31_000), 60)).toMatchObject({ warn: true });
    expect(buildTimerView(null, GAME_START, 60)).toBeNull();
    expect(formatClock(605)).toBe('10:05');
  });

  it('終盤の秒数はフェーズのデータから引き、 時間を持たないフェーズは熱くならない', () => {
    expect(warnAtSecondsOf(getPhase(scenarioData, 'discussion'))).toBeGreaterThan(0);
    expect(warnAtSecondsOf(getPhase(scenarioData, 'vote'))).toBeNull();
  });
});
