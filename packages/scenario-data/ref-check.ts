/**
 * ID 参照の整合性チェック。
 *
 * 型と zod スキーマで守れるのは構造だけで、 `sceneId: '存在しない_id'` のような
 * 壊れた参照は通ってしまう (実行時に静かに無反応になるだけで気づきにくい)。
 * スキーマの `.meta({ refTarget })` を歩いて、 参照先コレクションに存在しない ID を
 * 列挙する。 editor の保存時警告と test が使う。 zod を import するので play からは
 * 使わないこと。
 */

import { z } from 'zod';
import { ScenarioSchema } from './schema.ts';

export interface RefViolation {
  /** 壊れた参照のデータ上の位置 (例: `$.phases[3].sceneId`)。 */
  path: string;
  refTarget: string;
  value: string;
}

/** refTarget 名 → シナリオデータ内の ID 集合。 */
function collectIds(data: any): Record<string, Set<string>> {
  const idsOf = (list: unknown): Set<string> =>
    new Set(
      (Array.isArray(list) ? list : [])
        .map((entry: any) => entry?.id)
        .filter((id: unknown): id is string => typeof id === 'string'),
    );
  return {
    roles: idsOf(data?.roles),
    npcs: idsOf(data?.npcs),
    phases: idsOf(data?.phases),
    dialogueScenes: idsOf(data?.dialogueScenes),
    clues: idsOf(data?.clues),
    assets: idsOf(data?.assets),
    audioTracks: idsOf(data?.audioTracks),
    places: idsOf(data?.places),
    // 話者は roles と npcs の和集合を指す。 実体のあるコレクションではないので、
    // ここでだけ 2 つを束ねる。
    speakers: new Set([...idsOf(data?.roles), ...idsOf(data?.npcs)]),
  };
}

/**
 * discriminated union のノードを、 データ側の値に合う枝へ畳む。 union は `oneOf` +
 * 各枝の判別 field の `const` として出るので、 畳まずに歩くとその配下 (phase の
 * sceneId 等) が丸ごと検査から漏れる。
 */
function pickUnionBranch(node: any, dataNode: any, resolve: (node: any) => any): any {
  if (!Array.isArray(node?.oneOf) || !dataNode || typeof dataNode !== 'object') return node;
  for (const branchRaw of node.oneOf) {
    const branch = resolve(branchRaw);
    if (!branch?.properties) continue;
    const matched = Object.entries<any>(branch.properties).every(([key, prop]) => {
      const literal = resolve(prop)?.const;
      return literal === undefined || dataNode[key] === literal;
    });
    if (matched) return branch;
  }
  return node;
}

function findRefTarget(node: any): string | null {
  return typeof node?.refTarget === 'string' ? node.refTarget : null;
}

/**
 * スキーマ由来の JSON Schema とデータを並走して、 存在しない ID への参照を列挙する。
 * 未設定の参照は欄ごと書かないので、 空文字も壊れた参照として数える。
 */
export function collectRefViolations(data: unknown): RefViolation[] {
  const jsonSchema = z.toJSONSchema(ScenarioSchema, { io: 'input', reused: 'ref' }) as any;
  const defs = jsonSchema.$defs ?? {};
  const ids = collectIds(data);
  const violations: RefViolation[] = [];

  const resolve = (node: any): any =>
    node?.$ref ? (defs[String(node.$ref).replace('#/$defs/', '')] ?? node) : node;

  const check = (target: string, value: unknown, path: string) => {
    if (typeof value !== 'string') return;
    if (!ids[target]?.has(value)) violations.push({ path, refTarget: target, value });
  };

  const walk = (schemaNodeRaw: any, dataNode: any, path: string) => {
    const schemaNode = pickUnionBranch(resolve(schemaNodeRaw), dataNode, resolve);
    if (!schemaNode || dataNode == null) return;
    if (schemaNode.properties) {
      for (const [key, propRaw] of Object.entries<any>(schemaNode.properties)) {
        if (!(key in dataNode)) continue;
        const value = dataNode[key];
        const prop = resolve(propRaw);
        const target = findRefTarget(propRaw) ?? findRefTarget(prop);
        if (target) check(target, value, `${path}.${key}`);
        const itemTarget = findRefTarget(prop?.items) ?? findRefTarget(resolve(prop?.items));
        if (itemTarget && Array.isArray(value)) {
          value.forEach((v, i) => {
            check(itemTarget, v, `${path}.${key}[${i}]`);
          });
        }
        walk(prop, value, `${path}.${key}`);
      }
      return;
    }
    if (schemaNode.items && Array.isArray(dataNode)) {
      dataNode.forEach((v, i) => {
        walk(schemaNode.items, v, `${path}[${i}]`);
      });
      return;
    }
    if (schemaNode.additionalProperties && typeof dataNode === 'object') {
      for (const [k, v] of Object.entries(dataNode)) {
        walk(schemaNode.additionalProperties, v, `${path}.${k}`);
      }
    }
  };

  walk(jsonSchema, data, '$');
  return violations;
}
