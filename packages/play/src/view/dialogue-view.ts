/**
 * 読み合わせ画面の導出。 いまの行・次の行・誰が送るか・背景・話者の立ち絵。
 */

import type { DialogueLine, DialoguePhase, RoomState, Scenario } from '../lib/types';
import { lineBackgroundAssetId, lineReaderRoleId } from '../scenario/dialogue';
import { getRole, getScene, getSpeaker, type SpeakerView } from '../scenario/lookup';

export interface DialogueLineView {
  index: number;
  line: DialogueLine;
  speaker: SpeakerView | null;
  /** 語りの場面では null (誰も送らない)。 */
  readerRoleId: string | null;
  readerName: string;
}

export interface DialogueView {
  sceneTitle: string;
  total: number;
  current: DialogueLineView;
  next: DialogueLineView | null;
  /** 読み返し用。 現在行まで (先の行は見せない)。 */
  history: DialogueLineView[];
  backgroundAssetId: string;
  /** この場面に出てくる役 (立ち絵を並べる順)。 */
  cast: string[];
}

function lineView(
  scenario: Scenario,
  phase: DialoguePhase,
  index: number,
): DialogueLineView | null {
  const scene = getScene(scenario, phase.sceneId);
  const line = scene?.lines[index];
  if (!scene || !line) return null;
  const readerRoleId = lineReaderRoleId(scenario, scene, line);
  return {
    index,
    line,
    speaker: getSpeaker(scenario, line.speakerId),
    readerRoleId,
    readerName: readerRoleId ? (getRole(scenario, readerRoleId)?.name ?? '') : '',
  };
}

export function buildDialogueView(
  scenario: Scenario,
  phase: DialoguePhase,
  state: RoomState,
): DialogueView | null {
  const scene = getScene(scenario, phase.sceneId);
  if (!scene) return null;
  const index = Math.min(state.game.lineIndex, scene.lines.length - 1);
  const current = lineView(scenario, phase, index);
  if (!current) return null;
  const history: DialogueLineView[] = [];
  for (let i = 0; i <= index; i += 1) {
    const entry = lineView(scenario, phase, i);
    if (entry) history.push(entry);
  }
  const cast = scenario.roles
    .map((role) => role.id)
    .filter((id) => scene.lines.some((line) => line.speakerId === id));
  return {
    sceneTitle: scene.title,
    total: scene.lines.length,
    current,
    next: lineView(scenario, phase, index + 1),
    history,
    backgroundAssetId: lineBackgroundAssetId(scene, index),
    cast,
  };
}
