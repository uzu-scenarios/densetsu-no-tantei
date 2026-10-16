/**
 * 進行管理席 (admin) の操作。 止まった卓を外から動かす・検証で任意の局面へ飛ぶためのもので、
 * プレイヤー席からは使えない。 フェーズの出入りはプレイヤーの操作と同じ flow.ts を通す。
 */

import { type ActionMap, minus } from '@uzuhq/code-sdk';
import { discussionEvents } from '../scenario/events';
import { getEndingPhase, getPhase, getRole, getScene } from '../scenario/lookup';
import { buildBallot } from '../scenario/outcome';
import { allAcked, canAck } from '../scenario/progress';
import {
  autoCompleteEvent,
  closeVoteIfComplete,
  createInitialState,
  enterPhase,
  exitPhase,
  finish,
  fireEvent,
  startGame,
} from './flow';
import {
  type Args,
  currentPhase,
  fail,
  type NoPayload,
  requireObserver,
  type State,
  scenario,
} from './guards';

export const adminActions = {
  /** ロビーで全員の準備完了を待たずに始める。 */
  'admin.start': ({ state, playerId, ctx }: Args<NoPayload>) => {
    requireObserver(state, playerId);
    if (state.status !== 'lobby') fail('ロビーでのみ使えます。');
    startGame(state, scenario, ctx.time);
  },

  /** いまのフェーズを終えて次へ。 投票は票がそろっていないと結末が決まらないので止める。 */
  'admin.next': ({ state, playerId, ctx }: Args<NoPayload>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    if (phase.type === 'vote') fail('投票は全員の票がそろうと進みます。代理入力を使ってください。');
    exitPhase(state, scenario, ctx.time);
  },

  /**
   * 任意のフェーズへ飛ぶ。 ロビー・感想戦からも入れる。 投票へ入ると票は配り直し、
   * 開票へ直接入ると、 いまある票から結末を決める。
   */
  'admin.jump': ({ state, payload, playerId, ctx }: Args<{ phaseId: string }>) => {
    requireObserver(state, playerId);
    const phase = getPhase(scenario, payload?.phaseId) ?? fail('フェーズが見つかりません。');
    state.status = 'in_progress';
    enterPhase(state, scenario, phase.id, ctx.time);
  },

  /** エンディングを待たずに感想戦を開く。 */
  'admin.finish': ({ state, playerId }: Args<NoPayload>) => {
    requireObserver(state, playerId);
    if (state.status !== 'in_progress') fail('進行中にだけ使えます。');
    finish(state);
  },

  /** 感想戦を閉じて、 出たところのフェーズへ入り直す。 */
  'admin.resume': ({ state, playerId, ctx }: Args<NoPayload>) => {
    requireObserver(state, playerId);
    if (state.status !== 'finished') fail('感想戦からだけ使えます。');
    const phaseId = state.game.phaseId ?? scenario.phases[0].id;
    state.status = 'in_progress';
    enterPhase(state, scenario, phaseId, ctx.time);
  },

  /** 部屋をロビーの初期状態へ戻す (配役はそのまま)。 */
  'admin.reset': ({ state, playerId }: Args<NoPayload>) => {
    requireObserver(state, playerId);
    const fresh = createInitialState(state.players.map((player) => ({ ...player, ready: false })));
    state.status = fresh.status;
    state.players = fresh.players;
    state.game = fresh.game;
  },

  /** 読み合わせの行を動かす。 担当の行送りと違い、 戻すこともできる。 */
  'admin.dialogue.seek': ({ state, payload, playerId, ctx }: Args<{ lineIndex: number }>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    if (phase.type !== 'dialogue') fail('読み合わせ中ではありません。');
    const scene = getScene(scenario, phase.sceneId) ?? fail('台本が見つかりません。');
    const index = Math.trunc(Number(payload?.lineIndex));
    if (!Number.isFinite(index) || index < 0 || index >= scene.lines.length) {
      fail('その行はありません。');
    }
    state.game.lineIndex = index;
    state.game.lineStartedAt = ctx.time;
  },

  /** 残り時間を足し引きする。 */
  'admin.timer.add': ({ state, payload, playerId, ctx }: Args<{ seconds: number }>) => {
    requireObserver(state, playerId);
    currentPhase(state);
    if (!state.game.timerEndsAt) fail('このフェーズに制限時間はありません。');
    const remaining = Math.max(0, minus(state.game.timerEndsAt, ctx.time));
    // 0 秒より前には戻さない (過去を指すと締切が即座に発火するだけなので揃えておく)。
    state.game.timerEndsAt = ctx.after(
      Math.max(0, remaining + (Number(payload?.seconds) || 0) * 1000),
    );
  },

  /** 残り時間をこの秒数にする。 0 なら満了 (次のフェーズへ)。 */
  'admin.timer.set': ({ state, payload, playerId, ctx }: Args<{ seconds: number }>) => {
    requireObserver(state, playerId);
    currentPhase(state);
    if (!state.game.timerEndsAt) fail('このフェーズに制限時間はありません。');
    state.game.timerEndsAt = ctx.after(Math.max(0, Number(payload?.seconds) || 0) * 1000);
  },

  /** 役の代わりに「済」を付け外しする (離席した人の読み終えた・同意など)。 */
  'admin.ack': ({ state, payload, playerId, ctx }: Args<{ roleId: string; acked: boolean }>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    if (!canAck(phase)) fail('このフェーズでは使えません。');
    const role = getRole(scenario, payload?.roleId) ?? fail('役が見つかりません。');
    const acks = state.game.acks.filter((id) => id !== role.id);
    if (payload?.acked) acks.push(role.id);
    state.game.acks = acks;
    if (allAcked(state)) exitPhase(state, scenario, ctx.time);
  },

  /**
   * 役の票を代理で入れる / 消す (suspectRoleId が無ければ消す)。 全員分そろえば開票へ進む。
   */
  'admin.ballot': ({
    state,
    payload,
    playerId,
    ctx,
  }: Args<{ roleId: string; suspectRoleId?: string; pointedOut?: boolean }>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    if (phase.type !== 'vote') fail('投票の時間ではありません。');
    const role = getRole(scenario, payload?.roleId) ?? fail('役が見つかりません。');
    if (!payload?.suspectRoleId) {
      delete state.game.ballots[role.id];
      return;
    }
    const suspect = getRole(scenario, payload.suspectRoleId) ?? fail('投票先が見つかりません。');
    state.game.ballots[role.id] =
      buildBallot(role, suspect.id, payload.pointedOut) ?? fail('自己申告も選んでください。');
    closeVoteIfComplete(state, scenario, ctx.time);
  },

  /** 議論中の出来事を、 時刻を待たずに今すぐ起こす。 */
  'admin.event.fire': ({ state, payload, playerId, ctx }: Args<{ eventId: string }>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    const event = discussionEvents(phase).find((e) => e.id === payload?.eventId);
    if (!event) fail('その出来事はありません。');
    fireEvent(state, event.id, ctx.time);
  },

  /** 出来事の操作 (カバン・質問) を、 残りの人の代わりにスタッフが済ませる。 */
  'admin.event.complete': ({ state, payload, playerId, ctx }: Args<{ eventId: string }>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    const event = discussionEvents(phase).find((e) => e.id === payload?.eventId);
    if (!event) fail('その出来事はありません。');
    autoCompleteEvent(state, scenario, event.id, ctx.time);
  },

  /** 開票のあとに進む結末を差し替える。 */
  'admin.ending': ({ state, payload, playerId }: Args<{ phaseId: string }>) => {
    requireObserver(state, playerId);
    const phase = currentPhase(state);
    if (phase.type !== 'reveal') fail('開票中にだけ使えます。');
    const ending =
      getEndingPhase(scenario, payload?.phaseId) ?? fail('結末のフェーズを選んでください。');
    state.game.endingPhaseId = ending.id;
  },
} satisfies ActionMap<State>;
