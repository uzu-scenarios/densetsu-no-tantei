/**
 * lint では止められない書き方の決まり (CLAUDE.md「play の層」「画面の書き方」)。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = new URL('../src/', import.meta.url).pathname;
const filesIn = (dir: string) =>
  readdirSync(join(src, dir)).map((name) => ({
    name,
    text: readFileSync(join(src, dir, name), 'utf8'),
  }));

describe('書き方の決まり', () => {
  it('状態は data-* 属性で表し、 class: ディレクティブを使わない', () => {
    const offenders = filesIn('components')
      .filter((f) => f.name.endsWith('.svelte') && /\sclass:[\w-]+/.test(f.text))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it('server は画面の層を import せず、 実時刻と乱数を読まない', () => {
    const offenders = filesIn('server')
      .filter(
        (f) =>
          /from '\.\.\/(components|view|platform|runtime)\//.test(f.text) ||
          /Date\.now|Math\.random/.test(f.text),
      )
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });
});
