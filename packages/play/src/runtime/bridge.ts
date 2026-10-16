/**
 * SDK と画面の継ぎ目。 onState で届いた state を自席の snapshot にして store へ入れ、
 * 画面からの操作を sendAction へ流す。
 */

import { setSnapshot } from '../components/snapshot-store.svelte';
import { showToast } from '../components/toast-store.svelte';
import type { RoomState, SeatKind, Snapshot } from '../lib/types';

type SendAction = (type: string, payload?: unknown) => void;

let sendActionImpl: SendAction | null = null;
let lastJson = '';

export function bindSendAction(send: SendAction): void {
  sendActionImpl = send;
}

export function deriveSnapshot(state: RoomState, playerId: string, seatKind: SeatKind): Snapshot {
  const player = state.players.find((entry) => entry.playerId === playerId);
  return {
    state,
    self: {
      playerId,
      // roster に居ない席は観測席。 URL の欠落で 'player' を名乗ってきても観戦扱いに倒す。
      seatKind: player ? 'player' : seatKind === 'admin' ? 'admin' : 'spectator',
      roleId: player?.roleId ?? null,
    },
  };
}

/**
 * 配信のたびに呼ばれる。 中身が同じ配信は捨てる。 state は SDK と共有の参照なので
 * 複製してから store へ入れる (先読みの書き換えが過去の snapshot へ遡らないように)。
 */
export function applyState(state: RoomState, playerId: string, seatKind: SeatKind): void {
  const snapshot = deriveSnapshot(state, playerId, seatKind);
  const json = JSON.stringify(snapshot);
  if (json === lastJson) return;
  lastJson = json;
  setSnapshot(structuredClone(snapshot));
}

/** 操作を送る。 送れない環境 (SDK 未接続) では理由を出して黙らない。 */
export function send(type: string, payload?: unknown): void {
  if (!sendActionImpl) {
    showToast('まだ接続していません。', 'deny');
    return;
  }
  try {
    sendActionImpl(type, payload ?? {});
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作できませんでした。', 'deny');
  }
}
