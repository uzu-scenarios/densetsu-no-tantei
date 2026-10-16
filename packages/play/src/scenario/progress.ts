/**
 * 「済」(ack) で抜けるフェーズの判定。 server が進めるかを決め、 画面が押せるかと
 * 「あと何人」を出すのに同じ判定を通す。
 */

import { type GameTime, minus } from '@uzuhq/code-sdk';
import type { Phase, RoomState } from '../lib/types';

/**
 * ack を受け付けるフェーズ。 読み合わせは読み飛ばしを許すものだけ (台本の送りは担当の
 * 行送りで進むので、 全員の ack では抜けない)。 議論は時間いっぱい続け、 早く切り上げる
 * のは進行管理席だけ。 投票は提出そのものが済の表明。
 */
export function canAck(phase: Phase): boolean {
  switch (phase.type) {
    case 'dialogue':
      return Boolean(phase.skippable);
    case 'handout':
    case 'reveal':
      return true;
    case 'discussion':
    case 'vote':
      return false;
  }
}

export const allAcked = (state: RoomState): boolean =>
  state.players.length > 0 &&
  state.players.every((player) => state.game.acks.includes(player.roleId));

/**
 * 同じ行でこれだけ止まったら、 担当以外も「代わりに送る」を押せる。 進行管理席の無い卓で
 * 担当が離席すると誰も送れず止まるための救済。 画面は少し遅れて (+5 秒) ボタンを出し、
 * 先読みとサーバーの時刻差 (数十 ms) で境界の判定が割れないようにする。
 */
export const PROXY_ADVANCE_AFTER_MS = 25_000;
export const PROXY_ADVANCE_BUTTON_AFTER_MS = 30_000;

export function canProxyAdvance(lineStartedAt: GameTime | null, now: GameTime): boolean {
  return lineStartedAt !== null && minus(now, lineStartedAt) >= PROXY_ADVANCE_AFTER_MS;
}
