/**
 * 投票結果の判定。 エンディングの分岐と得点が同じ判定を通る。
 */

import type { Ballot, EndingRule, Mission, OutcomeCondition, Role } from '../lib/types';

export type Ballots = Record<string, Ballot>;

/**
 * 票を組む。 自己申告を持つ役だけ申告を添え、 申告が無ければ組めない (null)。
 * 投票画面・サーバー・進行管理席の代理入力が同じ形を作るよう、 ここだけで組む。
 */
export function buildBallot(
  role: Role,
  suspectRoleId: string,
  pointedOut: boolean | null | undefined,
): Ballot | null {
  if (!role.declaration) return { suspectRoleId };
  return typeof pointedOut === 'boolean' ? { suspectRoleId, pointedOut } : null;
}

/** 役ごとの得票数。 */
export function tallyVotes(ballots: Ballots): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ballot of Object.values(ballots)) {
    counts[ballot.suspectRoleId] = (counts[ballot.suspectRoleId] ?? 0) + 1;
  }
  return counts;
}

/** 単独最多の役。 同票で並んだら null。 */
export function soleTopRoleId(ballots: Ballots): string | null {
  const entries = Object.entries(tallyVotes(ballots)).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

export function meetsCondition(condition: OutcomeCondition, ballots: Ballots): boolean {
  switch (condition.type) {
    case 'top':
      return soleTopRoleId(ballots) === condition.roleId;
    case 'not_top':
      return soleTopRoleId(ballots) !== condition.roleId;
    case 'voted':
      return ballots[condition.voterRoleId]?.suspectRoleId === condition.targetRoleId;
    case 'declared':
      return ballots[condition.roleId]?.pointedOut === condition.pointedOut;
  }
}

export const meetsAll = (conditions: readonly OutcomeCondition[], ballots: Ballots): boolean =>
  conditions.every((condition) => meetsCondition(condition, ballots));

/** 上から順に判定し、 最初に一致した結末。 */
export function resolveEnding(rules: readonly EndingRule[], ballots: Ballots): string | null {
  return rules.find((rule) => meetsAll(rule.when, ballots))?.phaseId ?? null;
}

export interface MissionResult {
  mission: Mission;
  achieved: boolean;
}

export function scoreRole(
  role: Role,
  ballots: Ballots,
): { total: number; results: MissionResult[] } {
  // 進行管理席が投票の前に感想戦へ送ると票が無い。 そのとき「最多にならない」系が
  // 達成扱いにならないよう、 票が 1 つも無ければ何も達成していないことにする。
  const voted = Object.keys(ballots).length > 0;
  const results = role.missions.map((mission) => ({
    mission,
    achieved: voted && meetsAll(mission.when, ballots),
  }));
  const total = results.reduce((sum, r) => sum + (r.achieved ? r.mission.points : 0), 0);
  return { total, results };
}

export const maxScore = (role: Role): number =>
  role.missions.reduce((sum, mission) => sum + mission.points, 0);
