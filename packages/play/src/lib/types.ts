/**
 * play 全体が使う型。 シナリオデータの型は @scenario/data (schema.ts) が正で、
 * ここでは再 export と、 部屋の state・snapshot の型だけを持つ。
 */

import type { GameTime, SeatKind } from '@uzuhq/code-sdk';

export type * from '@scenario/data';

export type RoomStatus = 'lobby' | 'in_progress' | 'finished';
export type { SeatKind };

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  roleId: string;
  ready: boolean;
}

export interface Ballot {
  suspectRoleId: string;
  /** 秘密の自己申告。 申告を持つ役だけが答える。 */
  pointedOut?: boolean;
}

/** 議論中の出来事で、 誰が・いつ操作したか。 by が null ならスタッフが自分から済ませた。 */
export interface EventRecord {
  at: GameTime;
  byRoleId: string | null;
}

export interface DiscussionEventsState {
  /** 起きた出来事と、 起きた時刻。 */
  fired: Record<string, GameTime>;
  /** 手荷物検査で開けたカバン (出来事 → 役)。 */
  bags: Record<string, Record<string, EventRecord>>;
  /** スタッフへの質問 (出来事 → 質問)。 */
  answers: Record<string, Record<string, EventRecord>>;
}

export interface GameState {
  phaseId: string | null;
  phaseStartedAt: GameTime | null;
  timerEndsAt: GameTime | null;
  /** 読み合わせの現在行。 */
  lineIndex: number;
  /** 現在行になった時刻。 担当の離席で止まった行の「代わりに送る」判定に使う。 */
  lineStartedAt: GameTime | null;
  /**
   * いまのフェーズで「済」を押した役 (読み終えた / 飛ばす / 確認した)。
   * 全員そろえば次へ進む。 フェーズに入るたびに空になる。
   */
  acks: string[];
  events: DiscussionEventsState;
  ballots: Record<string, Ballot>;
  /** 投票が決めた結末。 開票を確認したらここへ進む。 */
  endingPhaseId: string | null;
  /** 通った結末 (感想戦で「あなたたちの結末」として出す)。 */
  reachedEndingPhaseId: string | null;
}

export interface RoomState {
  status: RoomStatus;
  players: RoomPlayer[];
  game: GameState;
}

/** 自席から見た state。 state は全席に同じものが配られるので、 席の同定だけを足す。 */
export interface Snapshot {
  state: RoomState;
  self: {
    playerId: string;
    seatKind: SeatKind;
    /** 観測席 (admin) は役を持たない。 */
    roleId: string | null;
  };
}
