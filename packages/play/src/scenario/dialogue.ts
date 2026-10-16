/**
 * 読み合わせの行まわりの導出。 誰が送る番か・いまの背景はどれか。
 */

import { type GameTime, plus } from '@uzuhq/code-sdk';
import type { DialogueLine, DialogueScene, Scenario } from '../lib/types';
import { getRole } from './lookup';

/**
 * その行を送る役。 役の台詞はその役、 NPC の台詞は npcReaderRoleId (無ければ地の文の担当)、
 * 地の文は narratorRoleId。 担当を 1 人に固定するのは、 誰でも押せると最初に押した人だけが
 * 進んで残りが空振りするため。 語りの場面は誰も送らない (null)。
 */
export function lineReaderRoleId(
  scenario: Scenario,
  scene: DialogueScene,
  line: DialogueLine,
): string | null {
  if (scene.narrated) return null;
  if (line.speakerId && getRole(scenario, line.speakerId)) return line.speakerId;
  if (line.speakerId) return scene.npcReaderRoleId ?? scene.narratorRoleId ?? null;
  return scene.narratorRoleId ?? null;
}

/**
 * 章扉 (PhaseOpener) が出ている長さ。 画面のアニメと、 語りの 1 行目を章扉が引くまで
 * 待たせるサーバーの両方がこの値を使う。
 */
export const PHASE_OPENER_MS = 2200;

/**
 * 語りの行が鳴り始めるまでの間。 1 行目は章扉が引いてから。
 * 行の間は、 前の行の余韻と次の行の頭がくっつかない長さ。
 */
const NARRATION_FIRST_LEAD_MS = PHASE_OPENER_MS + 400;
const NARRATION_LEAD_MS = 700;

/** 語りの index 行目が鳴り始める時刻。 lineStartedAt はその行になった時刻。 */
export function narrationStartsAt(index: number, lineStartedAt: GameTime): GameTime {
  return plus(lineStartedAt, index === 0 ? NARRATION_FIRST_LEAD_MS : NARRATION_LEAD_MS);
}

/** 語りの行を鳴らし終える時刻。 サーバーはここで次の行へ送る。 */
export function narrationEndsAt(
  scene: DialogueScene,
  index: number,
  lineStartedAt: GameTime,
): GameTime | null {
  const voice = scene.lines[index]?.voice;
  if (!voice) return null;
  return plus(narrationStartsAt(index, lineStartedAt), Math.round(voice.seconds * 1000));
}

/** index 行目の時点の背景。 行の差し替えは以降の行に効き続ける。 */
export function lineBackgroundAssetId(scene: DialogueScene, index: number): string {
  let current = scene.backgroundAssetId;
  for (let i = 0; i <= index && i < scene.lines.length; i += 1) {
    current = scene.lines[i].backgroundAssetId ?? current;
  }
  return current;
}
