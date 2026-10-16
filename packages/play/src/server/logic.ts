/**
 * GameLogic 本体。 setup() が roster から部屋を組み、 各 action handler は live な
 * `state` を直接書き換える。 配信は SDK が行う。
 *
 * action handler はクライアントの先読みとサーバーで 2 回走り、 先読みの結果は後から届く
 * snapshot で上書きされる。 同じ state と payload から同じ結果になる形に保つ
 * (乱数や実時刻から作った値を state に書かない。 時刻は ctx.time / ctx.after だけ)。
 *
 * 弾く操作は Error を投げる (state は巻き戻り、 送信元に __action_error が返る)。
 * 画面は押す前に同じ判定 (scenario/ の純関数) を通して、 押せない印を出しておく。
 */

import { type ActionMap, type GameLogic, type GameTime, minus } from '@uzuhq/code-sdk';
import type { DialogueScene } from '../lib/types';
import { lineReaderRoleId, narrationEndsAt } from '../scenario/dialogue';
import { bagClueOf, discussionEvents, nextEventDeadline } from '../scenario/events';
import { getPhase, getRole, getScene } from '../scenario/lookup';
import { buildBallot } from '../scenario/outcome';
import { allAcked, canAck, canProxyAdvance } from '../scenario/progress';
import { adminActions } from './admin';
import {
  assignRoles,
  closeVoteIfComplete,
  createInitialState,
  eventRecords,
  exitPhase,
  processEventDeadlines,
  startGame,
} from './flow';
import {
  type Args,
  actorRoleId,
  currentPhase,
  fail,
  requirePlayerRole,
  type State,
  scenario,
} from './guards';

export type { State };

/** 次の行へ。 最後の行ならフェーズを抜ける。 */
function advanceLine(state: State, lineCount: number, now: GameTime): void {
  if (state.game.lineIndex + 1 < lineCount) {
    state.game.lineIndex += 1;
    state.game.lineStartedAt = now;
    return;
  }
  exitPhase(state, scenario, now);
}

/** いまが語りの場面なら、 その台本。 */
function narratedScene(state: State): DialogueScene | null {
  if (state.status !== 'in_progress' || !state.game.phaseId) return null;
  const phase = getPhase(scenario, state.game.phaseId);
  if (phase?.type !== 'dialogue') return null;
  const scene = getScene(scenario, phase.sceneId);
  return scene?.narrated ? scene : null;
}

const actions = {
  /** ロビーの「準備完了」。 全員そろったら最初のフェーズへ。 */
  'lobby.ready': ({ state, payload, playerId, ctx }: Args<{ ready: boolean }>) => {
    if (state.status !== 'lobby') fail('ロビーでのみ変更できます。');
    const player = state.players.find((entry) => entry.playerId === playerId);
    if (!player) fail('プレイヤー席からのみ操作できます。');
    player.ready = Boolean(payload?.ready);
    if (state.players.every((entry) => entry.ready)) startGame(state, scenario, ctx.time);
  },

  /**
   * 読み合わせの行送り。 送れるのはその行の担当だけ。 担当が離席して同じ行で止まった
   * ときだけ、 ほかの人が「代わりに送る」(proxy) で送れる。
   */
  'dialogue.advance': ({
    state,
    payload,
    playerId,
    ctx,
  }: Args<{ lineIndex: number; proxy?: boolean }>) => {
    const phase = currentPhase(state);
    if (phase.type !== 'dialogue') fail('読み合わせ中ではありません。');
    const scene = getScene(scenario, phase.sceneId) ?? fail('台本が見つかりません。');
    // 先読みと二重押しで 2 行進まないよう、 押した時点の行を添えさせる。
    if (payload?.lineIndex !== state.game.lineIndex) return;
    const line = scene.lines[state.game.lineIndex];
    const roleId = actorRoleId(state, playerId);
    if (roleId && scene.narrated) fail('語りは自動で進みます。');
    if (roleId && roleId !== lineReaderRoleId(scenario, scene, line)) {
      if (!payload?.proxy || !canProxyAdvance(state.game.lineStartedAt, ctx.time)) {
        fail('この行はほかの人が読む番です。');
      }
    }
    advanceLine(state, scene.lines.length, ctx.time);
  },

  /**
   * 「済」の表明 (読み終えた / 読み飛ばしに同意 / 開票を確認)。
   * もう一度押すと取り消せる。 全員そろったら次へ。
   */
  'phase.ack': ({ state, payload, playerId, ctx }: Args<{ acked: boolean }>) => {
    const phase = currentPhase(state);
    const roleId = requirePlayerRole(state, playerId);
    if (!canAck(phase)) fail('このフェーズでは使えません。');
    const acks = state.game.acks.filter((id) => id !== roleId);
    if (payload?.acked) acks.push(roleId);
    state.game.acks = acks;
    if (allAcked(state)) exitPhase(state, scenario, ctx.time);
  },

  /** 手荷物検査で、 自分のカバンを開けて見せる。 */
  'discussion.bag.open': ({ state, payload, playerId, ctx }: Args<{ eventId: string }>) => {
    const phase = currentPhase(state);
    const roleId = requirePlayerRole(state, playerId);
    const event = discussionEvents(phase).find((e) => e.id === payload?.eventId);
    if (!event || !(event.id in state.game.events.fired) || !bagClueOf(scenario, event, roleId)) {
      fail('いまは手荷物検査の時間ではありません。');
    }
    const opened = eventRecords(state.game.events.bags, event.id);
    if (opened[roleId]) return;
    opened[roleId] = { at: ctx.time, byRoleId: roleId };
  },

  /** スタッフに質問する。 答えは全員に出る。 早い者勝ちで、 同じ質問は 1 度だけ。 */
  'discussion.ask': ({
    state,
    payload,
    playerId,
    ctx,
  }: Args<{ eventId: string; questionId: string }>) => {
    const phase = currentPhase(state);
    const roleId = requirePlayerRole(state, playerId);
    const event = discussionEvents(phase).find((e) => e.id === payload?.eventId);
    if (event?.kind !== 'questions' || !(event.id in state.game.events.fired)) {
      fail('いまは聞けません。');
    }
    const question = event.questions.find((q) => q.id === payload?.questionId);
    if (!question) fail('その質問はありません。');
    const answered = eventRecords(state.game.events.answers, event.id);
    if (answered[question.id]) return;
    answered[question.id] = { at: ctx.time, byRoleId: roleId };
  },

  /** 犯人投票 (と秘密の自己申告)。 一度出したら取り消せない。 */
  'vote.submit': ({
    state,
    payload,
    playerId,
    ctx,
  }: Args<{ suspectRoleId: string; pointedOut?: boolean }>) => {
    const phase = currentPhase(state);
    if (phase.type !== 'vote') fail('投票の時間ではありません。');
    const roleId = requirePlayerRole(state, playerId);
    if (state.game.ballots[roleId]) fail('すでに投票しています。');
    const suspect = getRole(scenario, payload?.suspectRoleId) ?? fail('投票先を選んでください。');
    const role = getRole(scenario, roleId) ?? fail('役が見つかりません。');
    state.game.ballots[roleId] =
      buildBallot(role, suspect.id, payload?.pointedOut) ??
      fail('秘密の自己申告を選んでください。');
    closeVoteIfComplete(state, scenario, ctx.time);
  },

  ...adminActions,
} satisfies ActionMap<State>;

const logic: GameLogic<State, typeof actions> = {
  setup({ players }): State {
    return createInitialState(assignRoles(scenario, players));
  },

  actions,

  deadlines: {
    /** フェーズの制限時間。 サーバーが timerEndsAt に自分で起きて次へ進める。 */
    phaseTimer: {
      at: ({ state }) => (state.status === 'in_progress' ? state.game.timerEndsAt : null),
      handler: ({ state, ctx }) => {
        // 進行管理席がフェーズを移すと締切も張り替わる。 前のフェーズの締切で起こされても
        // 新しいフェーズを抜けないよう、 期限を過ぎているかをここでも確かめる。
        if (!state.game.timerEndsAt || minus(state.game.timerEndsAt, ctx.time) > 0) return;
        exitPhase(state, scenario, ctx.time);
      },
    },
    /** 語りの場面で、 行の音声を鳴らし終えたら次の行へ送る。 */
    narration: {
      at: ({ state }) => {
        const scene = narratedScene(state);
        if (!scene || state.game.lineStartedAt === null) return null;
        return narrationEndsAt(scene, state.game.lineIndex, state.game.lineStartedAt);
      },
      handler: ({ state, ctx }) => {
        const scene = narratedScene(state);
        if (!scene || state.game.lineStartedAt === null) return;
        const end = narrationEndsAt(scene, state.game.lineIndex, state.game.lineStartedAt);
        // 進行管理席が行を動かすと締切も張り替わる。 古い締切で起こされても進めない。
        if (!end || minus(end, ctx.time) > 0) return;
        advanceLine(state, scene.lines.length, ctx.time);
      },
    },
    /** 議論中の出来事を時刻どおりに起こし、 誰も操作しなかった分をスタッフが済ませる。 */
    discussionEvents: {
      at: ({ state }) => nextEventDeadline(scenario, state),
      handler: ({ state, ctx }) => processEventDeadlines(state, scenario, ctx.time),
    },
  },

  voicePlan: ({ state }) => {
    const phase = state.status === 'in_progress' ? getPhase(scenario, state.game.phaseId) : null;
    return { room: null, mic: phase?.mic ?? 'free' };
  },

  update() {
    // 時間で起きることは deadlines が持つので tick は要らない (hibernate させる)。
  },
};

export default logic;
