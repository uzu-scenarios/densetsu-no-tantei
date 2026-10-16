/**
 * action handler が共通で使う判定。 弾くときは Error を投げる (state は巻き戻り、
 * 送信元に __action_error が返る)。
 */

import { scenarioData } from '@scenario/data';
import type { ActionArgs } from '@uzuhq/code-sdk';
import type { Phase, RoomState } from '../lib/types';
import { getPhase } from '../scenario/lookup';

export type State = RoomState;
export type Args<P> = ActionArgs<State, P>;
/** payload を読まない action。 */
export type NoPayload = Record<string, never> | undefined;

export const scenario = scenarioData;

export function fail(message: string): never {
  throw new Error(message);
}

/** 送信者の役。 roster に居ない送信者は観測席 (admin) なので null。 */
export function actorRoleId(state: State, playerId: string): string | null {
  return state.players.find((player) => player.playerId === playerId)?.roleId ?? null;
}

export function requirePlayerRole(state: State, playerId: string): string {
  return actorRoleId(state, playerId) ?? fail('プレイヤー席からのみ操作できます。');
}

export function requireObserver(state: State, playerId: string): void {
  if (actorRoleId(state, playerId)) fail('進行管理席からのみ操作できます。');
}

export function currentPhase(state: State): Phase {
  if (state.status !== 'in_progress') fail('ゲームは進行中ではありません。');
  return getPhase(scenario, state.game.phaseId) ?? fail('フェーズが見つかりません。');
}
