/**
 * scenario.json の安定化シリアライザ。
 *
 * キー順をソートし 2 スペース indent + 末尾改行で固定する。 editor が丸ごと
 * 書き戻してもキー順序とフォーマットが変わらず、 git diff が実際の変更行だけに
 * 収まるようにするための取り決め。 scenario.json を書くコードは必ずこれを通すこと。
 */

export function stableJsonStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }
  return value;
}
