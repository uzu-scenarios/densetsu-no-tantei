/**
 * 描画用のゲーム内時刻。 4 回/秒だけ進める (残り時間の秒表示に足りる)。
 * 使う component が居る間だけ動く。
 */

import { type GameTime, gameTime } from '@uzuhq/code-sdk';

let now = $state.raw<GameTime>(gameTime());
let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;

export function useGameClock(): () => void {
  users += 1;
  if (!timer) {
    now = gameTime();
    timer = setInterval(() => {
      now = gameTime();
    }, 250);
  }
  return () => {
    users -= 1;
    if (users === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export const clock = {
  get now(): GameTime {
    return now;
  },
};
