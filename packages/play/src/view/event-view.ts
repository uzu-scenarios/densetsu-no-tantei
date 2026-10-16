/**
 * 議論中の出来事の見せ方の導出。 いまどの出来事のダイアログを出すか、 カットインの最中か、
 * 台詞を何行まで出すか、 操作を受け付けるか。 時刻は描画用のゲーム内時刻 (gameTime) で見る。
 */

import { type GameTime, minus } from '@uzuhq/code-sdk';
import type { DiscussionEvent, Phase, RoomState, Scenario } from '../lib/types';
import { discussionEvents, isEventComplete } from '../scenario/events';

/** カットインが走る長さ。 台詞はこの後から出る。 */
export const CUTIN_MS = 1600;
/** 台詞 1 行を出してから次の行までの間。 */
export const SAY_MS = 3500;
/** 片付いてからダイアログを自動で閉じるまでの間。 */
export const LINGER_MS = 4000;
/** 起きてからこれより後にその出来事を初めて見た画面 (再接続など) には、 カットインと台詞送りを省く。 */
export const LATE_AFTER_MS = 3000;

export interface EventView {
  event: DiscussionEvent;
  /** カットインの最中 (ダイアログはまだ出ない)。 */
  cutin: boolean;
  /** 出す台詞の行数。 */
  saysShown: number;
  /** 台詞を出し終え、 カバンを開ける・質問するなどの操作を受け付ける。 */
  open: boolean;
  complete: boolean;
}

const latest = (times: GameTime[]): GameTime | null =>
  times.reduce<GameTime | null>((max, t) => (max === null || minus(t, max) > 0 ? t : max), null);

/** 最後の操作 (カバン・質問) の時刻。 これから少し置いてダイアログを閉じる。 */
function completedAt(event: DiscussionEvent, state: RoomState): GameTime | null {
  const events = state.game.events;
  if (event.kind === 'bags')
    return latest(Object.values(events.bags[event.id] ?? {}).map((r) => r.at));
  if (event.kind === 'questions') {
    return latest(Object.values(events.answers[event.id] ?? {}).map((r) => r.at));
  }
  return events.fired[event.id] ?? null;
}

/** 台詞を出し終えるまでの長さ。 */
const readingMs = (event: DiscussionEvent) => CUTIN_MS + event.says.length * SAY_MS;

export function buildEventView(
  scenario: Scenario,
  phase: Phase | null,
  state: RoomState,
  now: GameTime,
  dismissed: ReadonlySet<string>,
  /** この画面が起きてから LATE_AFTER_MS 以上たって初めて見た出来事。 */
  late: ReadonlySet<string>,
): EventView | null {
  const fired = discussionEvents(phase)
    .filter((e) => e.id in state.game.events.fired && !dismissed.has(e.id))
    .sort((a, b) => minus(state.game.events.fired[a.id], state.game.events.fired[b.id]));
  for (let i = fired.length - 1; i >= 0; i -= 1) {
    const event = fired[i];
    const firedAt = state.game.events.fired[event.id];
    const elapsed = minus(now, firedAt);
    const complete = isEventComplete(scenario, event, state);
    // 情報の出るだけの出来事 (と知らせ) は、 台詞を読み終えてから閉じる。
    const doneAt = event.kind === 'reveal' || event.kind === 'notice' ? readingMs(event) : null;
    if (complete) {
      const finished = completedAt(event, state);
      const since = doneAt !== null ? elapsed - doneAt : finished ? minus(now, finished) : 0;
      if (since > LINGER_MS) continue;
    }
    const fresh = !late.has(event.id);
    return {
      event,
      cutin: fresh && elapsed < CUTIN_MS,
      saysShown: fresh
        ? Math.max(1, Math.min(event.says.length, Math.floor((elapsed - CUTIN_MS) / SAY_MS) + 1))
        : event.says.length,
      open: elapsed >= readingMs(event) || !fresh,
      complete,
    };
  }
  return null;
}
