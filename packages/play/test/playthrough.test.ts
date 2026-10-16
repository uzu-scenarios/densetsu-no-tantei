import { scenarioData } from '@scenario/data';
import { GAME_START, type GameTime, plus } from '@uzuhq/code-sdk';
import { describe, expect, it } from 'vitest';
import type { RoomState } from '../src/lib/types';
import { lineReaderRoleId } from '../src/scenario/dialogue';
import { revealedClueIds, visibleClueBody } from '../src/scenario/events';
import { getPhase, getScene } from '../src/scenario/lookup';
import { maxScore, scoreRole } from '../src/scenario/outcome';
import logic from '../src/server/logic';

const seats = [
  { id: 'p0', nickname: 'A', iconUrl: '' },
  { id: 'p1', nickname: 'B', iconUrl: '' },
  { id: 'p2', nickname: 'C', iconUrl: '' },
];
const ADMIN = 'admin_0';

let now: GameTime = GAME_START;
const ctx = () => ({ time: now, after: (d: number) => plus(now, d), emit: () => {} });

function send(
  state: RoomState,
  playerId: string,
  type: keyof typeof logic.actions,
  payload?: unknown,
) {
  (logic.actions[type] as (args: unknown) => void)({ state, payload, playerId, ctx: ctx() });
}

const seatOf = (state: RoomState, roleId: string) =>
  state.players.find((p) => p.roleId === roleId)!.playerId;

function boot(): RoomState {
  now = GAME_START;
  const state = logic.setup({ players: seats, ctx: { time: now } as never });
  for (const seat of seats) send(state, seat.id, 'lobby.ready', { ready: true });
  return state;
}

/** 読み合わせを担当の行送りで最後まで送る。 */
function readThrough(state: RoomState) {
  const phase = getPhase(scenarioData, state.game.phaseId)!;
  if (phase.type !== 'dialogue') throw new Error(`not dialogue: ${phase.id}`);
  const scene = getScene(scenarioData, phase.sceneId)!;
  for (let i = 0; i < scene.lines.length; i += 1) {
    const reader = lineReaderRoleId(scenarioData, scene, scene.lines[i]);
    if (!reader) throw new Error(`語りの場面は送れない: ${scene.id}`);
    send(state, seatOf(state, reader), 'dialogue.advance', { lineIndex: i });
  }
}

const ackAll = (state: RoomState) => {
  for (const seat of seats) send(state, seat.id, 'phase.ack', { acked: true });
};

/** 投票の手前 (開票前) まで進める。 遊び方は全員の同意で飛ばす。 */
function toVote(state: RoomState) {
  expect(state.game.phaseId).toBe('howto');
  ackAll(state);
  expect(state.game.phaseId).toBe('opening');
  readThrough(state);
  expect(state.game.phaseId).toBe('handout');
  ackAll(state);
  expect(state.game.phaseId).toBe('discussion');
  finishDiscussionEvents(state);
  expireTimer(state);
  expect(state.game.phaseId).toBe('vote');
}

/** フェーズの制限時間まで進めて、 締切を起こす。 */
function expireTimer(state: RoomState) {
  now = state.game.timerEndsAt!;
  logic.deadlines!.phaseTimer.handler({
    state,
    ctx: { time: now, after: (d: number) => plus(now, d) } as never,
  });
}

/** 議論中の出来事を締切の時刻まで進めて、 全部起こして済ませる。 */
function finishDiscussionEvents(state: RoomState) {
  const deadline = logic.deadlines!.discussionEvents;
  for (let i = 0; i < 40; i += 1) {
    const at = deadline.at({ state } as never);
    if (at == null) return;
    now = at as GameTime;
    deadline.handler({ state, ctx: { time: now, after: (d: number) => plus(now, d) } as never });
  }
  throw new Error('出来事が片付かない');
}

function toDiscussion(state: RoomState) {
  ackAll(state);
  readThrough(state);
  ackAll(state);
  expect(state.game.phaseId).toBe('discussion');
}

type Vote = { suspect: string; pointedOut?: boolean };
function vote(state: RoomState, votes: Record<string, Vote>) {
  for (const [roleId, v] of Object.entries(votes)) {
    send(state, seatOf(state, roleId), 'vote.submit', {
      suspectRoleId: v.suspect,
      pointedOut: v.pointedOut,
    });
  }
}

describe('通しプレイ', () => {
  it('全員の準備完了で遊び方から始まる', () => {
    const state = boot();
    expect(state.status).toBe('in_progress');
    expect(state.game.phaseId).toBe('howto');
    expect(state.players.map((p) => p.roleId)).toEqual(['haru', 'natsu', 'aki']);
  });

  it('遊び方は語りの声の長さで自動で進み、 プレイヤーは送れない', () => {
    const state = boot();
    const deadline = logic.deadlines!.narration;
    const scene = getScene(scenarioData, 'scene_howto')!;
    expect(() => send(state, 'p0', 'dialogue.advance', { lineIndex: 0 })).toThrow();
    for (let i = 0; i < scene.lines.length; i += 1) {
      expect([state.game.phaseId, state.game.lineIndex]).toEqual(['howto', i]);
      const at = deadline.at({ state } as never) as GameTime;
      // 鳴らし終える前に起こされても進まない
      deadline.handler({
        state,
        ctx: { time: plus(at, -1), after: (d: number) => plus(at, d) } as never,
      });
      expect(state.game.lineIndex).toBe(i);
      now = at;
      deadline.handler({ state, ctx: ctx() as never });
    }
    expect(state.game.phaseId).toBe('opening');
    expect(deadline.at({ state } as never)).toBeNull();
  });

  it.each([
    [
      'ending1',
      {
        haru: { suspect: 'natsu' },
        natsu: { suspect: 'haru', pointedOut: true },
        aki: { suspect: 'haru', pointedOut: false },
      },
      { haru: 2, natsu: 8, aki: 10 },
    ],
    [
      'ending2',
      {
        haru: { suspect: 'aki' },
        natsu: { suspect: 'haru', pointedOut: false },
        aki: { suspect: 'haru', pointedOut: true },
      },
      { haru: 2, natsu: 10, aki: 8 },
    ],
    [
      'ending3',
      {
        haru: { suspect: 'natsu' },
        natsu: { suspect: 'haru', pointedOut: false },
        aki: { suspect: 'natsu', pointedOut: false },
      },
      { haru: 6, natsu: 6, aki: 6 },
    ],
    [
      'ending4',
      {
        haru: { suspect: 'aki' },
        natsu: { suspect: 'aki', pointedOut: true },
        aki: { suspect: 'haru', pointedOut: true },
      },
      { haru: 10, natsu: 4, aki: 4 },
    ],
    [
      'ending5',
      {
        haru: { suspect: 'aki' },
        natsu: { suspect: 'haru', pointedOut: false },
        aki: { suspect: 'natsu', pointedOut: false },
      },
      { haru: 6, natsu: 10, aki: 6 },
    ],
  ])('%s へ分岐し、 得点が原作の得点表どおりになる', (ending, votes, scores) => {
    const state = boot();
    toVote(state);
    vote(state, votes);
    expect(state.game.phaseId).toBe('reveal');
    expect(state.game.endingPhaseId).toBe(ending);
    ackAll(state);
    expect(state.game.phaseId).toBe(ending);
    readThrough(state);
    expect(state.status).toBe('finished');
    expect(state.game.reachedEndingPhaseId).toBe(ending);
    for (const role of scenarioData.roles) {
      expect([role.id, scoreRole(role, state.game.ballots).total]).toEqual([
        role.id,
        scores[role.id as keyof typeof scores],
      ]);
    }
  });

  it('各役の満点は 10 点', () => {
    for (const role of scenarioData.roles) expect(maxScore(role)).toBe(10);
  });
});

describe('操作の制約', () => {
  it('行送りは担当しかできず、 古い行番号は無視される', () => {
    const state = boot();
    ackAll(state);
    // オープニング 1 行目は地の文 = 春見
    expect(() =>
      send(state, seatOf(state, 'natsu'), 'dialogue.advance', { lineIndex: 0 }),
    ).toThrow();
    send(state, seatOf(state, 'haru'), 'dialogue.advance', { lineIndex: 0 });
    send(state, seatOf(state, 'haru'), 'dialogue.advance', { lineIndex: 0 });
    expect(state.game.lineIndex).toBe(1);
  });

  it('担当が 25 秒止まった行だけ、 ほかの人が代わりに送れる', () => {
    const state = boot();
    ackAll(state);
    const natsu = seatOf(state, 'natsu');
    expect(() => send(state, natsu, 'dialogue.advance', { lineIndex: 0, proxy: true })).toThrow();
    now = plus(now, 25_000);
    send(state, natsu, 'dialogue.advance', { lineIndex: 0, proxy: true });
    expect(state.game.lineIndex).toBe(1);
    // 行が変わったら数え直す
    expect(() => send(state, natsu, 'dialogue.advance', { lineIndex: 1, proxy: true })).toThrow();
  });

  it('ack は取り消せ、 全員そろうまで進まない', () => {
    const state = boot();
    send(state, 'p0', 'phase.ack', { acked: true });
    send(state, 'p1', 'phase.ack', { acked: true });
    send(state, 'p1', 'phase.ack', { acked: false });
    send(state, 'p2', 'phase.ack', { acked: true });
    expect(state.game.phaseId).toBe('howto');
    expect(state.game.acks.sort()).toEqual(['aki', 'haru']);
  });

  it('自己申告を持つ役は申告なしで投票できず、 二重投票もできない', () => {
    const state = boot();
    toVote(state);
    expect(() =>
      send(state, seatOf(state, 'natsu'), 'vote.submit', { suspectRoleId: 'haru' }),
    ).toThrow();
    send(state, seatOf(state, 'haru'), 'vote.submit', { suspectRoleId: 'aki' });
    expect(() =>
      send(state, seatOf(state, 'haru'), 'vote.submit', { suspectRoleId: 'natsu' }),
    ).toThrow();
  });

  it('制限時間の満了で手帳から議論へ進む', () => {
    const state = boot();
    ackAll(state);
    readThrough(state);
    expect(state.game.phaseId).toBe('handout');
    const deadline = logic.deadlines!.phaseTimer;
    now = state.game.timerEndsAt!;
    deadline.handler({ state, ctx: { time: now, after: (d: number) => plus(now, d) } as never });
    expect(state.game.phaseId).toBe('discussion');
  });

  it('進行管理席はフェーズを送れるが、 プレイヤーは送れない', () => {
    const state = boot();
    expect(() => send(state, 'p0', 'admin.next')).toThrow();
    send(state, ADMIN, 'admin.next');
    expect(state.game.phaseId).toBe('opening');
  });

  it('キャラ選択の希望を優先して配役する', () => {
    const state = logic.setup({
      players: [
        { ...seats[0], characterId: 'aki' },
        { ...seats[1] },
        { ...seats[2], characterId: 'haru' },
      ],
      ctx: { time: GAME_START } as never,
    });
    expect(state.players.map((p) => p.roleId)).toEqual(['aki', 'natsu', 'haru']);
  });
});

describe('進行管理席', () => {
  it('ロビーからでも任意のフェーズへ飛べ、 プレイヤーは使えない', () => {
    now = GAME_START;
    const state = logic.setup({ players: seats, ctx: { time: now } as never });
    expect(() => send(state, 'p0', 'admin.jump', { phaseId: 'discussion' })).toThrow();
    send(state, ADMIN, 'admin.jump', { phaseId: 'discussion' });
    expect(state.status).toBe('in_progress');
    expect(state.game.phaseId).toBe('discussion');
    expect(state.game.timerEndsAt).not.toBeNull();
  });

  it('感想戦へ送り、 出たところへ戻せる', () => {
    const state = boot();
    send(state, ADMIN, 'admin.jump', { phaseId: 'handout' });
    send(state, ADMIN, 'admin.finish');
    expect(state.status).toBe('finished');
    send(state, ADMIN, 'admin.resume');
    expect(state.status).toBe('in_progress');
    expect(state.game.phaseId).toBe('handout');
  });

  it('台詞を戻せる', () => {
    const state = boot();
    send(state, ADMIN, 'admin.jump', { phaseId: 'opening' });
    send(state, ADMIN, 'admin.dialogue.seek', { lineIndex: 5 });
    expect(state.game.lineIndex).toBe(5);
    send(state, ADMIN, 'admin.dialogue.seek', { lineIndex: 2 });
    expect(state.game.lineIndex).toBe(2);
    expect(() => send(state, ADMIN, 'admin.dialogue.seek', { lineIndex: 99 })).toThrow();
  });

  it('タイマーを足し引き・満了できる', () => {
    const state = boot();
    send(state, ADMIN, 'admin.jump', { phaseId: 'discussion' });
    send(state, ADMIN, 'admin.timer.set', { seconds: 30 });
    expect(state.game.timerEndsAt).toBe(plus(now, 30_000));
    send(state, ADMIN, 'admin.timer.add', { seconds: -60 });
    expect(state.game.timerEndsAt).toBe(now);
  });

  it('離席した人の「済」を代わりに付けられる', () => {
    const state = boot();
    send(state, 'p0', 'phase.ack', { acked: true });
    send(state, 'p1', 'phase.ack', { acked: true });
    send(state, ADMIN, 'admin.ack', { roleId: 'aki', acked: true });
    expect(state.game.phaseId).toBe('opening');
  });

  it('票を代理で入れて開票へ進め、 結末を差し替えられる', () => {
    const state = boot();
    send(state, ADMIN, 'admin.jump', { phaseId: 'vote' });
    send(state, seatOf(state, 'haru'), 'vote.submit', { suspectRoleId: 'aki' });
    send(state, seatOf(state, 'natsu'), 'vote.submit', {
      suspectRoleId: 'haru',
      pointedOut: false,
    });
    expect(() =>
      send(state, ADMIN, 'admin.ballot', { roleId: 'aki', suspectRoleId: 'haru' }),
    ).toThrow();
    send(state, ADMIN, 'admin.ballot', { roleId: 'aki', suspectRoleId: 'haru', pointedOut: false });
    expect(state.game.phaseId).toBe('reveal');
    expect(state.game.endingPhaseId).toBe('ending2');
    send(state, ADMIN, 'admin.ending', { phaseId: 'ending1' });
    send(state, ADMIN, 'admin.next');
    expect(state.game.phaseId).toBe('ending1');
  });

  it('投票へ戻ると票は配り直し、 投票を飛ばして開票へ入ると今の票で結末を決める', () => {
    const state = boot();
    send(state, ADMIN, 'admin.jump', { phaseId: 'vote' });
    send(state, seatOf(state, 'haru'), 'vote.submit', { suspectRoleId: 'aki' });
    send(state, ADMIN, 'admin.jump', { phaseId: 'vote' });
    expect(state.game.ballots).toEqual({});
    send(state, ADMIN, 'admin.jump', { phaseId: 'reveal' });
    send(state, ADMIN, 'admin.next');
    expect(state.game.phaseId).toBe('ending5');
  });

  it('ロビーへ戻せる', () => {
    const state = boot();
    send(state, ADMIN, 'admin.jump', { phaseId: 'vote' });
    send(state, seatOf(state, 'haru'), 'vote.submit', { suspectRoleId: 'aki' });
    send(state, ADMIN, 'admin.reset');
    expect(state.status).toBe('lobby');
    expect(state.game.ballots).toEqual({});
    expect(state.game.phaseId).toBeNull();
    expect(state.players.every((p) => !p.ready)).toBe(true);
  });
});

describe('議論中の出来事', () => {
  const phase = scenarioData.phases.find((p) => p.id === 'discussion')!;
  const events = phase.type === 'discussion' ? phase.events! : [];
  const revealed = (state: RoomState) =>
    [
      ...revealedClueIds(scenarioData, getPhase(scenarioData, state.game.phaseId), state.game),
    ].sort();
  const tickTo = (state: RoomState, seconds: number) => {
    const deadline = logic.deadlines!.discussionEvents;
    const target = plus(state.game.phaseStartedAt!, seconds * 1000);
    for (;;) {
      const at = deadline.at({ state } as never) as GameTime | null;
      if (at == null || (at as number) > (target as number)) break;
      now = at;
      deadline.handler({ state, ctx: { time: now, after: (d: number) => plus(now, d) } as never });
    }
    now = target;
  };

  it('議論の開始時は、 出来事に載っていない共通情報だけが出ている', () => {
    const state = boot();
    toDiscussion(state);
    expect(revealed(state)).toEqual(['clue_victim']);
  });

  it('時刻どおりに出来事が起き、 手荷物は自分で開けるか、 45 秒でスタッフが確認する', () => {
    const state = boot();
    toDiscussion(state);
    expect(() =>
      send(state, seatOf(state, 'haru'), 'discussion.bag.open', { eventId: 'ev_bags' }),
    ).toThrow();
    tickTo(state, events[0].atSeconds);
    expect(state.game.events.fired.ev_bags).toBeDefined();
    send(state, seatOf(state, 'haru'), 'discussion.bag.open', { eventId: 'ev_bags' });
    expect(revealed(state)).toContain('bag_haru');
    expect(revealed(state)).not.toContain('bag_natsu');
    tickTo(state, events[0].atSeconds + 45);
    expect(revealed(state)).toEqual(expect.arrayContaining(['bag_haru', 'bag_natsu', 'bag_aki']));
    expect(state.game.events.bags.ev_bags.natsu.byRoleId).toBeNull();
    expect(state.game.events.bags.ev_bags.haru.byRoleId).toBe('haru');
  });

  it('質問した行だけが証言として出る', () => {
    const state = boot();
    toDiscussion(state);
    tickTo(state, 300);
    send(state, seatOf(state, 'aki'), 'discussion.ask', {
      eventId: 'ev_cleaner',
      questionId: 'q_seen',
    });
    const clue = scenarioData.clues.find((c) => c.id === 'testimony_cleaner')!;
    expect(visibleClueBody(getPhase(scenarioData, 'discussion'), state.game, clue)).toBe(
      '11:20頃、〈トイレ〉に入っていく**秋永さん**を見かけましたよ。',
    );
    expect(state.game.events.answers.ev_cleaner.q_seen.byRoleId).toBe('aki');
    expect(() =>
      send(state, seatOf(state, 'aki'), 'discussion.ask', {
        eventId: 'ev_inspector',
        questionId: 'q_rooms',
      }),
    ).toThrow();
  });

  it('議論はプレイヤーからは切り上げられず、 時間いっぱいで投票へ進む', () => {
    const state = boot();
    toDiscussion(state);
    expect(() => send(state, 'p0', 'phase.ack', { acked: true })).toThrow();
    finishDiscussionEvents(state);
    expect(state.game.phaseId).toBe('discussion');
    expireTimer(state);
    expect(state.game.phaseId).toBe('vote');
  });

  it('進行管理席は出来事を今すぐ起こし、 済ませられる', () => {
    const state = boot();
    toDiscussion(state);
    send(state, ADMIN, 'admin.event.fire', { eventId: 'ev_inspector' });
    send(state, ADMIN, 'admin.event.complete', { eventId: 'ev_inspector' });
    expect(revealed(state)).toContain('testimony_inspector');
    expect(() => send(state, 'p0', 'admin.event.fire', { eventId: 'ev_bug' })).toThrow();
  });
});
