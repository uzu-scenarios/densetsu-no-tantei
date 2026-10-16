/**
 * シナリオデータの引き当て。 純関数で、 scenario は引数で受ける (server と client の
 * どちらからも同じ実装を通す)。
 */

import type {
  AssetEntry,
  Clue,
  DialoguePhase,
  DialogueScene,
  Npc,
  Phase,
  Role,
  Scenario,
  VotePhase,
} from '../lib/types';

export const getPhase = (scenario: Scenario, id: string | null | undefined): Phase | null =>
  scenario.phases.find((phase) => phase.id === id) ?? null;

/** 結末の読み合わせ (読み終えたら本編を終えて感想戦へ入る)。 */
export type EndingPhase = DialoguePhase & { ending: NonNullable<DialoguePhase['ending']> };

export const isEndingPhase = (phase: Phase | null | undefined): phase is EndingPhase =>
  phase?.type === 'dialogue' && Boolean(phase.ending);

export const endingPhases = (scenario: Scenario): EndingPhase[] =>
  scenario.phases.filter(isEndingPhase);

export const getEndingPhase = (
  scenario: Scenario,
  id: string | null | undefined,
): EndingPhase | null => {
  const phase = getPhase(scenario, id);
  return isEndingPhase(phase) ? phase : null;
};

export const getRole = (scenario: Scenario, id: string | null | undefined): Role | null =>
  scenario.roles.find((role) => role.id === id) ?? null;

/** 役の名前。 見つからなければ fallback (票が無い欄の「―」など)。 */
export const roleName = (
  scenario: Scenario,
  id: string | null | undefined,
  fallback = '',
): string => getRole(scenario, id)?.name ?? fallback;

export const getNpc = (scenario: Scenario, id: string | null | undefined): Npc | null =>
  scenario.npcs.find((npc) => npc.id === id) ?? null;

export const getScene = (scenario: Scenario, id: string | null | undefined): DialogueScene | null =>
  scenario.dialogueScenes.find((scene) => scene.id === id) ?? null;

export const getClue = (scenario: Scenario, id: string | null | undefined): Clue | null =>
  scenario.clues.find((clue) => clue.id === id) ?? null;

export const getAsset = (scenario: Scenario, id: string | null | undefined): AssetEntry | null =>
  scenario.assets.find((asset) => asset.id === id) ?? null;

/** 話者 (役か NPC) の名前と立ち絵。 */
export interface SpeakerView {
  id: string;
  name: string;
  portraitAssetId: string | null;
  isRole: boolean;
}

export function getSpeaker(scenario: Scenario, id: string | null | undefined): SpeakerView | null {
  const role = getRole(scenario, id);
  if (role) {
    return { id: role.id, name: role.name, portraitAssetId: role.portraitAssetId, isRole: true };
  }
  const npc = getNpc(scenario, id);
  if (npc) {
    return {
      id: npc.id,
      name: npc.name,
      portraitAssetId: npc.portraitAssetId ?? null,
      isRole: false,
    };
  }
  return null;
}

/** 開票・結末の分岐を持つ投票フェーズ。 */
export function getVotePhase(scenario: Scenario, id: string | null | undefined): VotePhase | null {
  const phase = getPhase(scenario, id);
  return phase?.type === 'vote' ? phase : null;
}

/** プレイヤーに見せるフェーズ名 (「第三章　推理」)。 */
export const phaseLabel = (phase: Phase): string => `${phase.chapter}　${phase.title}`;
