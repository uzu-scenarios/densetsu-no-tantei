/**
 * 残り時間の表示。 時刻はゲーム内時刻 (gameTime) 同士でだけ引く。
 */

import { type GameTime, minus } from '@uzuhq/code-sdk';
import type { Phase } from '../lib/types';

export interface TimerView {
  seconds: number;
  label: string;
  /** 終盤。 計器を熱くする。 */
  warn: boolean;
}

/** 「m:ss」。 */
export const formatClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** 時間を持つフェーズの、 計器を熱くする残り秒数。 */
export const warnAtSecondsOf = (phase: Phase | null | undefined): number | null =>
  phase && 'warnAtSeconds' in phase ? phase.warnAtSeconds : null;

export function buildTimerView(
  endsAt: GameTime | null,
  now: GameTime,
  warnAtSeconds: number | null,
): TimerView | null {
  if (!endsAt) return null;
  const seconds = Math.max(0, Math.ceil(minus(endsAt, now) / 1000));
  return {
    seconds,
    label: formatClock(seconds),
    warn: warnAtSeconds !== null && seconds <= warnAtSeconds,
  };
}
