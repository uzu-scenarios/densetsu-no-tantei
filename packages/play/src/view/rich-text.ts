/**
 * 本文の軽い記法を部品に分ける。 {@html} を使わずに描くための中間形。
 *
 * - `**強調**`       … strong
 * - `漢字(かな)`     … ルビ (直前の漢字の連なりにだけ掛かる)
 * - `〈場所〉`        … 場所の札
 * - 改行             … 行、 空行 … 段落の切れ目
 */

export type Inline =
  | { kind: 'text'; text: string; strong: boolean }
  | { kind: 'ruby'; base: string; reading: string; strong: boolean }
  | { kind: 'place'; text: string; strong: boolean };

export type Paragraph = Inline[][];

const TOKEN = /(\*\*|〈[^〉]+〉|[一-鿿々〆ヶ]+\([ぁ-んー]+\))/;

function parseLine(line: string, state: { strong: boolean }): Inline[] {
  const out: Inline[] = [];
  for (const part of line.split(TOKEN)) {
    if (!part) continue;
    if (part === '**') {
      state.strong = !state.strong;
      continue;
    }
    const place = part.match(/^〈([^〉]+)〉$/);
    if (place) {
      out.push({ kind: 'place', text: place[1], strong: state.strong });
      continue;
    }
    const ruby = part.match(/^([一-鿿々〆ヶ]+)\(([ぁ-んー]+)\)$/);
    if (ruby) {
      out.push({ kind: 'ruby', base: ruby[1], reading: ruby[2], strong: state.strong });
      continue;
    }
    out.push({ kind: 'text', text: part, strong: state.strong });
  }
  return out;
}

export function parseRichText(source: string): Paragraph[] {
  const state = { strong: false };
  return source
    .split(/\n{2,}/)
    .map((block) => block.split('\n').map((line) => parseLine(line, state)));
}

/** 記法を落とした素の文字列 (文字数の見積もり・読み上げ位置の計算用)。 */
export function plainText(source: string): string {
  return source
    .replace(/\*\*/g, '')
    .replace(/〈([^〉]+)〉/g, '$1')
    .replace(/([一-鿿々〆ヶ]+)\(([ぁ-んー]+)\)/g, '$1');
}
