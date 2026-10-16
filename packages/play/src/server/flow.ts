/**
 * 部屋の組み立てとフェーズの出入り。 action / deadline のどちらから抜けても同じ出口を通す。
 */

import { type GameTime, minus, plus, type Seat } from '@uzuhq/code-sdk';
import type { EventRecord, RoomPlayer, RoomState, Scenario } from '../lib/types';
import {
  bagClueOf,
  discussionEvents,
  EVENT_AUTO_COMPLETE_MS,
  emptyEventsState,
  eventFireAt,
  isEventComplete,
} from '../scenario/events';
import { getPhase, getVotePhase, isEndingPhase } from '../scenario/lookup';
import { resolveEnding } from '../scenario/outcome';

/**
 * 席に役を配る。 UZU の開始前のキャラ選択 (Seat.characterId) を優先し、 選ばれていない席
 * (dev harness など) には台本順の空き役を入れる。 同じ役が 2 席に付かないよう希望を
 * 先に取り切ってから埋める。
 */
export function assignRoles(scenario: Scenario, seats: readonly Seat[]): RoomPlayer[] {
  if (seats.length > scenario.roles.length) {
    throw new Error(
      `参加者 ${seats.length} 人に対して役が ${scenario.roles.length} しかありません。`,
    );
  }
  const requested = seats.map((seat) =>
    seat.characterId && scenario.roles.some((role) => role.id === seat.characterId)
      ? seat.characterId
      : null,
  );
  const taken = new Set(requested.filter((id): id is string => Boolean(id)));
  // 同じ役を 2 席が希望していたら、 2 席目は空き役へ回す。
  const claimed = new Set<string>();
  return seats.map((seat, index) => {
    let roleId = requested[index];
    if (roleId && claimed.has(roleId)) roleId = null;
    if (!roleId) {
      const free = scenario.roles.find((role) => !taken.has(role.id) && !claimed.has(role.id));
      if (!free) throw new Error('配れる役が足りません。');
      roleId = free.id;
    }
    claimed.add(roleId);
    taken.add(roleId);
    return {
      playerId: seat.id,
      nickname: seat.nickname || `Player ${index + 1}`,
      roleId,
      ready: false,
    };
  });
}

export function createInitialState(players: RoomPlayer[]): RoomState {
  return {
    status: 'lobby',
    players,
    game: {
      phaseId: null,
      phaseStartedAt: null,
      timerEndsAt: null,
      lineIndex: 0,
      lineStartedAt: null,
      acks: [],
      events: emptyEventsState(),
      ballots: {},
      endingPhaseId: null,
      reachedEndingPhaseId: null,
    },
  };
}

export function enterPhase(
  state: RoomState,
  scenario: Scenario,
  phaseId: string,
  now: GameTime,
): void {
  const phase = getPhase(scenario, phaseId);
  if (!phase) throw new Error(`フェーズ ${phaseId} が見つかりません。`);
  state.game.phaseId = phase.id;
  state.game.phaseStartedAt = now;
  state.game.lineIndex = 0;
  state.game.lineStartedAt = now;
  state.game.acks = [];
  state.game.timerEndsAt = null;
  if (phase.type === 'handout' || phase.type === 'discussion') {
    state.game.timerEndsAt = plus(now, phase.timerSeconds * 1000);
  }
  if (phase.type === 'discussion') state.game.events = emptyEventsState();
  if (phase.type === 'vote') {
    // 進行管理席が投票へ戻したときは投票をやり直す (前の票で開票しない)。
    state.game.ballots = {};
    state.game.endingPhaseId = null;
  }
  if (isEndingPhase(phase)) state.game.reachedEndingPhaseId = phase.id;
}

export function startGame(state: RoomState, scenario: Scenario, now: GameTime): void {
  state.status = 'in_progress';
  enterPhase(state, scenario, scenario.phases[0].id, now);
}

/** 全員の票がそろっていたら結末を決めて開票へ進む。 */
export function closeVoteIfComplete(state: RoomState, scenario: Scenario, now: GameTime): void {
  const phase = getVotePhase(scenario, state.game.phaseId);
  if (!phase) return;
  if (!state.players.every((player) => state.game.ballots[player.roleId])) return;
  state.game.endingPhaseId = resolveEnding(phase.endings, state.game.ballots);
  exitPhase(state, scenario, now);
}

export function finish(state: RoomState): void {
  state.status = 'finished';
  state.game.timerEndsAt = null;
  state.game.acks = [];
}

/** いまのフェーズを抜ける。 行き先はフェーズの種類で決まる。 */
export function exitPhase(state: RoomState, scenario: Scenario, now: GameTime): void {
  const phase = getPhase(scenario, state.game.phaseId);
  if (!phase) return;
  if (isEndingPhase(phase)) {
    finish(state);
    return;
  }
  if (phase.type === 'reveal') {
    // 進行管理席が投票を飛ばして開票へ入ったときは、 いまある票から結末を決める。
    const vote = getVotePhase(scenario, phase.votePhaseId);
    const endingId =
      state.game.endingPhaseId ?? (vote ? resolveEnding(vote.endings, state.game.ballots) : null);
    if (endingId) {
      enterPhase(state, scenario, endingId, now);
      return;
    }
  }
  const index = scenario.phases.findIndex((entry) => entry.id === phase.id);
  const next = scenario.phases[index + 1];
  if (!next) {
    finish(state);
    return;
  }
  enterPhase(state, scenario, next.id, now);
}

/** 出来事ごとの記録 (開けたカバン / 聞いた質問) を、 無ければ作って返す。 */
export function eventRecords(
  byEvent: Record<string, Record<string, EventRecord>>,
  eventId: string,
): Record<string, EventRecord> {
  if (!byEvent[eventId]) byEvent[eventId] = {};
  return byEvent[eventId];
}

/** 出来事を起こす。 すでに起きていれば何もしない。 */
export function fireEvent(state: RoomState, eventId: string, now: GameTime): void {
  if (!(eventId in state.game.events.fired)) state.game.events.fired[eventId] = now;
}

/** 誰も操作しなかった分を、 スタッフが自分から済ませる。 */
export function autoCompleteEvent(
  state: RoomState,
  scenario: Scenario,
  eventId: string,
  now: GameTime,
): void {
  const phase = getPhase(scenario, state.game.phaseId);
  const event = discussionEvents(phase).find((e) => e.id === eventId);
  if (!event) return;
  fireEvent(state, event.id, now);
  if (event.kind === 'bags') {
    const opened = eventRecords(state.game.events.bags, event.id);
    for (const player of state.players) {
      if (bagClueOf(scenario, event, player.roleId) && !opened[player.roleId]) {
        opened[player.roleId] = { at: now, byRoleId: null };
      }
    }
  }
  if (event.kind === 'questions') {
    const answered = eventRecords(state.game.events.answers, event.id);
    for (const question of event.questions) {
      if (!answered[question.id]) answered[question.id] = { at: now, byRoleId: null };
    }
  }
}

/** 時刻の来た出来事を起こし、 期限の来た出来事を済ませる (deadline から呼ぶ)。 */
export function processEventDeadlines(state: RoomState, scenario: Scenario, now: GameTime): void {
  const phase = getPhase(scenario, state.game.phaseId);
  const started = state.game.phaseStartedAt;
  if (started == null) return;
  for (const event of discussionEvents(phase)) {
    const fired = state.game.events.fired[event.id];
    if (!fired) {
      if (minus(eventFireAt(started, event), now) <= 0) fireEvent(state, event.id, now);
      continue;
    }
    if (
      !isEventComplete(scenario, event, state) &&
      minus(plus(fired, EVENT_AUTO_COMPLETE_MS), now) <= 0
    ) {
      autoCompleteEvent(state, scenario, event.id, now);
    }
  }
}
