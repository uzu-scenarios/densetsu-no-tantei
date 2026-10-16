/**
 * 編集画面のフィールド名を日本語で表示するための辞書。
 *
 * schema.ts はほとんどのフィールドに `.meta({ title })` で日本語ラベルを直接
 * 持たせており、 Field.svelte のラベル解決 (明示 label → スキーマの title →
 * この辞書 → 生のフィールド名) は title を最優先する。 ここに載せるのは
 * スキーマ側に title が無い項目 (id・座標・種別など、 どのエンティティでも
 * 同じ意味になる共通フィールド) だけ。
 */
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  kind: '種別',
  path: 'パス',
  lines: 'セリフ',
  placeIds: '場所',
  afterwordImageAssetIds: 'あとがきの画像',
  x: 'X座標',
  y: 'Y座標',
  w: '幅',
  h: '高さ',
  vertical: '縦書き',
};

/** フィールド名に対応する日本語ラベル。未登録・数値キー(配列添字)は undefined。 */
export function jaFieldLabel(key: string | number): string | undefined {
  return typeof key === 'string' ? FIELD_LABELS[key] : undefined;
}
