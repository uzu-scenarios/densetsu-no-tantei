/**
 * 議論中の出来事の判定。 どの共通情報が卓に出ているか、 出来事が片付いたか、 次にサーバーが
 * 起きる時刻。 server (進める) と画面 (見せる・押せるか) が同じ判定を通る。
 */

import { clueLines } from '@scenario/data';
import { type GameTime, minus, plus } from '@uzuhq/code-sdk';
import type {
  Clue,
  DiscussionEvent,
  DiscussionEventsState,
  EventRecord,
  GameState,
  Phase,
  RoomState,
  Scenario,
} from '../lib/types';
import { getPhase } from './lookup';

/**
 * 手荷物検査・質問で、 誰も操作しないまま出来事が止まらないよう、 起きてからこの時間で
 * スタッフが自分から済ませる (カバンの中を確認する / 自分から話す)。
 */
export const EVENT_AUTO_COMPLETE_MS = 45_000;

export const emptyEventsState = (): DiscussionEventsState => ({ fired: {}, bags: {}, answers: {} });

/** スタッフが自分から済ませる時刻。 */
export const autoCompleteAt = (firedAt: GameTime): GameTime =>
  plus(firedAt, EVENT_AUTO_COMPLETE_MS);

export const discussionEvents = (phase: Phase | null | undefined): DiscussionEvent[] =>
  phase?.type === 'discussion' ? (phase.events ?? []) : [];

export const eventFireAt = (phaseStartedAt: GameTime, event: DiscussionEvent): GameTime =>
  plus(phaseStartedAt, event.atSeconds * 1000);

/** 出来事で卓に出る共通情報。 */
export function eventClueIds(event: DiscussionEvent): string[] {
  if (event.kind === 'questions') return [event.clueId];
  if (event.kind === 'notice') return [];
  return event.clueIds;
}

export const bagRecord = (
  game: GameState,
  eventId: string,
  roleId: string,
): EventRecord | undefined => game.events.bags[eventId]?.[roleId];

export const answerRecord = (
  game: GameState,
  eventId: string,
  questionId: string,
): EventRecord | undefined => game.events.answers[eventId]?.[questionId];

const clueById = (scenario: Scenario, id: string): Clue | undefined =>
  scenario.clues.find((clue) => clue.id === id);

/** 手荷物検査で、 その役が開けると出る持ち物。 */
export function bagClueOf(scenario: Scenario, event: DiscussionEvent, roleId: string): Clue | null {
  if (event.kind !== 'bags') return null;
  const id = event.clueIds.find((clueId) => clueById(scenario, clueId)?.speakerId === roleId);
  return id ? (clueById(scenario, id) ?? null) : null;
}

/** 手荷物検査で開けるべき役 (卓に居て、 持ち物の札を持つ役)。 */
function bagRoles(scenario: Scenario, event: DiscussionEvent, state: RoomState): string[] {
  return state.players.map((p) => p.roleId).filter((roleId) => bagClueOf(scenario, event, roleId));
}

export function isEventComplete(
  scenario: Scenario,
  event: DiscussionEvent,
  state: RoomState,
): boolean {
  const game = state.game;
  if (!(event.id in game.events.fired)) return false;
  if (event.kind === 'bags') {
    return bagRoles(scenario, event, state).every((r) => bagRecord(game, event.id, r));
  }
  if (event.kind === 'questions') {
    return event.questions.every((q) => answerRecord(game, event.id, q.id));
  }
  return true;
}

/** 出来事に載っていない共通情報 (議論の開始時から出ているもの)。 */
function startingClueIds(scenario: Scenario, phase: Phase | null): string[] {
  const inEvents = new Set(discussionEvents(phase).flatMap(eventClueIds));
  return scenario.clues.map((c) => c.id).filter((id) => !inEvents.has(id));
}

/** いま卓に出ている共通情報。 証言は 1 行でも聞けば出る (本文は聞いた行だけ)。 */
export function revealedClueIds(
  scenario: Scenario,
  phase: Phase | null,
  game: GameState,
): Set<string> {
  const revealed = new Set(startingClueIds(scenario, phase));
  for (const event of discussionEvents(phase)) {
    if (!(event.id in game.events.fired)) continue;
    if (event.kind === 'reveal') for (const id of event.clueIds) revealed.add(id);
    if (event.kind === 'bags') {
      for (const roleId of Object.keys(game.events.bags[event.id] ?? {})) {
        const clue = bagClueOf(scenario, event, roleId);
        if (clue) revealed.add(clue.id);
      }
    }
    if (event.kind === 'questions') {
      if (event.questions.some((q) => answerRecord(game, event.id, q.id)))
        revealed.add(event.clueId);
    }
  }
  return revealed;
}

/** 質問の答え (証言の本文の 1 行)。 */
export function answerLine(scenario: Scenario, event: DiscussionEvent, questionId: string): string {
  if (event.kind !== 'questions') return '';
  const question = event.questions.find((q) => q.id === questionId);
  const body = clueById(scenario, event.clueId)?.body ?? '';
  return question ? (clueLines(body)[question.line] ?? '') : '';
}

/** 卓に出ている本文。 質問で出す証言は、 聞いた行だけを本文の順に並べる。 */
export function visibleClueBody(phase: Phase | null, game: GameState, clue: Clue): string {
  const event = discussionEvents(phase).find((e) => e.kind === 'questions' && e.clueId === clue.id);
  if (event?.kind !== 'questions') return clue.body;
  const asked = new Set(
    event.questions.filter((q) => answerRecord(game, event.id, q.id)).map((q) => q.line),
  );
  return clueLines(clue.body)
    .filter((_, i) => asked.has(i))
    .join('\n');
}

/** 次にサーバーが起きる時刻: まだ起きていない出来事と、 スタッフが自分から済ませる時刻。 */
export function nextEventDeadline(scenario: Scenario, state: RoomState): GameTime | null {
  const phase = getPhase(scenario, state.game.phaseId);
  const started = state.game.phaseStartedAt;
  if (state.status !== 'in_progress' || started == null) return null;
  let next: GameTime | null = null;
  const consider = (t: GameTime) => {
    if (next === null || minus(t, next) < 0) next = t;
  };
  for (const event of discussionEvents(phase)) {
    const fired = state.game.events.fired[event.id];
    if (!fired) consider(eventFireAt(started, event));
    else if (!isEventComplete(scenario, event, state)) consider(autoCompleteAt(fired));
  }
  return next;
}
