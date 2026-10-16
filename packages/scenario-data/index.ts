/**
 * シナリオデータ本体の型付きエントリポイント。 play はここだけを import する。
 *
 * schema.ts は型としてだけ再 export し (export type *)、 zod が play のバンドルに
 * 入らないようにしている。 JSON の構造検証は test / editor 保存時に zod が担う。
 */

import scenarioJson from './scenario.json';
import type { Scenario } from './schema.ts';

export { clueLines } from './clue-lines.ts';
export type * from './schema.ts';

export const scenarioData = scenarioJson as unknown as Scenario;
