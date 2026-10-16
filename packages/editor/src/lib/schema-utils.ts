/**
 * zod スキーマ (SSOT) から出した JSON Schema を、フォーム描画に使いやすい形へ
 * 解釈するヘルパ群。「refTarget があればその一覧から選ばせる、なければ型どおりの
 * 入力欄」という汎用ルールでフォームを組み立てるため、フィールド個別の UI 定義は
 * 持たない。
 */

import { ScenarioSchema } from '@scenario/data/schema';
import { z } from 'zod';

export type JsonSchemaNode = Record<string, any>;

let cached: JsonSchemaNode | null = null;

/** Scenario 全体の JSON Schema ($defs + $ref 形式)。 */
export function scenarioJsonSchema(): JsonSchemaNode {
  cached ??= z.toJSONSchema(ScenarioSchema, { io: 'input', reused: 'ref' }) as JsonSchemaNode;
  return cached;
}

/**
 * $ref を実体まで解決する。 $defs 同士が多段に参照する (別の $def を指す $def がある)
 * ので、 1 段だけ剥がすと enum や type に届かず入力欄の種類を誤る。 循環参照は
 * 辿り直した時点で打ち切る。
 */
export function resolveNode(node: JsonSchemaNode | undefined): JsonSchemaNode | undefined {
  const defs = scenarioJsonSchema().$defs ?? {};
  const seen = new Set<string>();
  let current = node;
  while (typeof current?.$ref === 'string') {
    const name = current.$ref.replace('#/$defs/', '');
    if (seen.has(name)) return current;
    seen.add(name);
    const next = defs[name] as JsonSchemaNode | undefined;
    if (!next) return current;
    current = next;
  }
  return current;
}

/**
 * discriminated union のノードを、 編集中の値に合う枝へ畳む。 union は `oneOf` +
 * 各枝の判別 field の `const` として出るので、 phase のように種別ごとに持てる
 * フィールドが違うものは値を見ないとフォームが組めない。 union でない、 または
 * 一致する枝が無いときは受け取ったノードをそのまま返す。
 */
export function resolveVariant(
  node: JsonSchemaNode | undefined,
  value: unknown,
): JsonSchemaNode | undefined {
  const branches = node?.oneOf as JsonSchemaNode[] | undefined;
  if (!Array.isArray(branches) || !value || typeof value !== 'object') return node;
  for (const branchRaw of branches) {
    const branch = resolveNode(branchRaw);
    const properties = branch?.properties as Record<string, JsonSchemaNode> | undefined;
    if (!properties) continue;
    const matched = Object.entries(properties).every(([key, prop]) => {
      const literal = resolveNode(prop)?.const;
      return literal === undefined || (value as Record<string, unknown>)[key] === literal;
    });
    if (matched) return branch;
  }
  return node;
}

/**
 * $ref を解決した中身を返す。
 *
 * $ref で共有した型を指すプロパティは `{ title, $ref }` の形で出ることがあるので、
 * $ref を解決するとプロパティ側に付けた title が落ちる場合がある。 ラベルは
 * プロパティ側のほうが具体的なので、 解決後の中身へ引き継ぐ。
 */
export function resolveWithOwnTitle(
  nodeRaw: JsonSchemaNode | undefined,
): JsonSchemaNode | undefined {
  const node = resolveNode(nodeRaw);
  const ownTitle = typeof nodeRaw?.title === 'string' ? nodeRaw.title : null;
  return ownTitle && node ? { ...node, title: ownTitle } : node;
}

/** node に付いた refTarget を拾う。 */
export function refTargetOf(nodeRaw: JsonSchemaNode | undefined): string | null {
  const refTarget = resolveNode(nodeRaw)?.refTarget;
  return typeof refTarget === 'string' ? refTarget : null;
}

/** 長文フィールドか (textarea にするか)。 schema.ts の richText() が付ける format 印だけを見る。 */
export function isLongText(node: JsonSchemaNode | undefined): boolean {
  return node?.format === 'textarea';
}

/** スキーマに沿った「空の値」。配列アイテム追加や optional フィールド追加の初期値。 */
export function emptyValue(nodeRaw: JsonSchemaNode | undefined): unknown {
  const inner = resolveNode(nodeRaw);
  if (!inner) return null;
  // discriminated union は型が決まらないと欄が組めないので、 先頭の枝で作る
  // (型は Field の「種別」から切り替える)。
  const branches = inner.oneOf as JsonSchemaNode[] | undefined;
  if (Array.isArray(branches) && branches.length > 0) return emptyValue(resolveNode(branches[0]));
  if (inner.const !== undefined) return inner.const;
  if (inner.default !== undefined) return inner.default;
  if (Array.isArray(inner.enum) && inner.enum.length > 0) return inner.enum[0];
  switch (inner.type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object': {
      const result: Record<string, unknown> = {};
      const required = new Set<string>((inner.required as string[] | undefined) ?? []);
      for (const [key, prop] of Object.entries<JsonSchemaNode>(inner.properties ?? {})) {
        if (required.has(key)) result[key] = emptyValue(prop);
      }
      return result;
    }
    default:
      return null;
  }
}

const isAbsentValue = (value: unknown) =>
  value === '' ||
  value == null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

/**
 * optional な欄に残った空文字・空配列・空の object を欄ごと落とした写しを返す。
 * scenario.json では「無い」を欠落だけで表すので、 フォームで値を消した欄を保存前に
 * 畳む (入力中に欄が消えないよう、 編集中ではなく保存の直前にやる)。 必須の欄は
 * 残し、 空のままならスキーマ検証に任せる。
 */
export function pruneAbsentOptionals(value: unknown, nodeRaw: JsonSchemaNode | undefined): unknown {
  const node = resolveVariant(resolveNode(nodeRaw), value);
  if (Array.isArray(value)) {
    return value.map((entry) => pruneAbsentOptionals(entry, node?.items));
  }
  if (!value || typeof value !== 'object') return value;
  const properties = node?.properties as Record<string, JsonSchemaNode> | undefined;
  const required = new Set<string>((node?.required as string[] | undefined) ?? []);
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const child = properties?.[key] ?? node?.additionalProperties;
    const pruned = pruneAbsentOptionals(entry, child);
    if (properties && !required.has(key) && isAbsentValue(pruned)) continue;
    result[key] = pruned;
  }
  return result;
}

/** データのパス (['settings','lobby'] 等) に沿って JSON Schema を掘る。 */
export function schemaAtPath(path: readonly string[]): JsonSchemaNode | undefined {
  let node: JsonSchemaNode | undefined = scenarioJsonSchema();
  for (const segment of path) {
    node = resolveNode(node);
    node = resolveNode(node?.properties?.[segment]);
    if (!node) return undefined;
  }
  return node;
}

/** コレクション定義。エディタの左ナビと参照候補の両方がこれを使う。 */
export interface CollectionDef {
  key: string;
  label: string;
  path: readonly string[];
  /** `object` は単一の設定オブジェクト、 `array` は ID を持つコレクション。 */
  kind: 'array' | 'object';
}

// ScenarioSchema のトップレベルはほぼ全て .meta({ title }) を持つが、 settings だけは
// 持たない (中身の各フィールドが個別に日本語 title を持つため)。 ここだけ補う。
const TOP_LEVEL_FALLBACK_LABELS: Readonly<Record<string, string>> = {
  settings: '設定',
};

/**
 * COLLECTIONS は ScenarioSchema のトップレベルプロパティから機械的に組み立てる。
 * 左ナビの項目を増やすたびに手で書き足さずに済むよう、 スキーマを SSOT のまま保つ。
 */
function buildCollections(): readonly CollectionDef[] {
  const root = resolveNode(scenarioJsonSchema());
  const properties = (root?.properties as Record<string, JsonSchemaNode> | undefined) ?? {};
  return Object.entries(properties).map(([key, raw]) => {
    const node = resolveNode(raw);
    return {
      key,
      label:
        (typeof raw.title === 'string' ? raw.title : undefined) ??
        TOP_LEVEL_FALLBACK_LABELS[key] ??
        key,
      path: [key] as const,
      kind: node?.type === 'array' ? 'array' : 'object',
    };
  });
}

export const COLLECTIONS: readonly CollectionDef[] = buildCollections();

/** パスに沿ってデータを掘る。 */
export function dataAtPath(scenario: any, path: readonly string[]): any {
  let node = scenario;
  for (const segment of path) node = node?.[segment];
  return node;
}

/** 一覧・参照候補に出すエントリ名。 */
export function entryLabel(entry: any): string {
  if (entry == null || typeof entry !== 'object') return String(entry ?? '');
  return String(entry.title || entry.name || entry.label || entry.id || '');
}

/**
 * 実体のあるコレクションではない refTarget の中身。
 * - speakers … 台詞の話者と証言者の候補。 roles と npcs の和集合。
 */
const VIRTUAL_REF_TARGETS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  speakers: [['roles'], ['npcs']],
};

function toCandidates(data: unknown): Array<{ id: string; label: string }> {
  return (Array.isArray(data) ? data : [])
    .filter((entry: any) => typeof entry?.id === 'string')
    .map((entry: any) => ({ id: entry.id, label: entryLabel(entry) }));
}

/** refTarget → 参照候補 ({id, label}) 一覧。 */
export function refCandidates(scenario: any, target: string): Array<{ id: string; label: string }> {
  const virtualPaths = VIRTUAL_REF_TARGETS[target];
  if (virtualPaths) {
    return virtualPaths.flatMap((path) => toCandidates(dataAtPath(scenario, path)));
  }
  const def = COLLECTIONS.find((collection) => collection.key === target);
  if (!def) return [];
  return toCandidates(dataAtPath(scenario, def.path));
}
