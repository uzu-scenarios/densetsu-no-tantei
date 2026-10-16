/**
 * component の導出が読む tracked な入口。 snapshot から「いま」を 1 か所で配る。
 *
 * scenario は起動時に固定されるので store にしない (module の定数を読む)。
 * 導出の中では必ずここを通す。
 */

import { scenarioData } from '@scenario/data';
import type { Clue, Phase, Role, RoomState, Scenario, SeatKind } from '../lib/types';
import { revealedClueIds, visibleClueBody } from '../scenario/events';
import { getPhase, getRole } from '../scenario/lookup';
import { snapshotStore } from './snapshot-store.svelte';

export const scenario: Scenario = scenarioData;

const state = $derived<RoomState | null>(snapshotStore.snapshot?.state ?? null);
const phase = $derived<Phase | null>(getPhase(scenario, state?.game.phaseId));
const selfRoleId = $derived<string | null>(snapshotStore.snapshot?.self.roleId ?? null);
const selfRole = $derived<Role | null>(getRole(scenario, selfRoleId));
const acks = $derived<string[]>(state?.game.acks ?? []);
const seatKind = $derived<SeatKind>(snapshotStore.snapshot?.self.seatKind ?? 'player');
// 議論中は出来事で出た共通情報だけが卓に出ている。 議論の外では全部を出す。
const revealed = $derived<ReadonlySet<string>>(
  state && phase?.type === 'discussion'
    ? revealedClueIds(scenario, phase, state.game)
    : new Set(scenario.clues.map((clue) => clue.id)),
);

export const view = {
  get state(): RoomState | null {
    return state;
  },
  get phase(): Phase | null {
    return phase;
  },
  get selfRoleId(): string | null {
    return selfRoleId;
  },
  get selfRole(): Role | null {
    return selfRole;
  },
  /** いまのフェーズで「済」を押した役。 */
  get acks(): string[] {
    return acks;
  },
  get selfAcked(): boolean {
    return Boolean(selfRoleId && acks.includes(selfRoleId));
  },
  /** 卓に着いている人数 (「済」の分母)。 */
  get playerCount(): number {
    return state?.players.length ?? 0;
  },
  /** 卓に出ている共通情報。 */
  get revealedClues(): ReadonlySet<string> {
    return revealed;
  },
  /** 卓に出ている本文 (証言は聞いた行だけ)。 */
  clueBody(clue: Clue): string {
    return state && phase?.type === 'discussion'
      ? visibleClueBody(phase, state.game, clue)
      : clue.body;
  },
  /** 進行管理席。 役を持たず、 全員の情報を見られる。 */
  get isAdmin(): boolean {
    return seatKind === 'admin';
  },
};
