/**
 * 画面の書き方の決まりを lint で止める (CLAUDE.md「画面の書き方」)。
 * - 色はトークンから引く。 component は semantic 層だけ (primitive の --navy-* などを直接引かない)
 * - :global() は使わない (画面の部品の外へ CSS が漏れる)
 * - 寸法は em。 px は var() / env() の 0px の既定値だけ (例外はその場で理由を書いて止める)
 * tokens.css は primitive を定義する唯一の場所なので色の決まりから外す。
 * 進行管理席は運営者向けの道具で、 文字を画面の縮尺に連動させない (px で組む)。
 */
const PRIMITIVE = '/var\\(--(navy|paper|ink|foil|vermilion|brass|black)-/';

const screenRules = {
  'color-no-hex': true,
  'declaration-property-value-disallowed-list': { '/.*/': [PRIMITIVE] },
  'selector-pseudo-class-disallowed-list': ['global'],
  'unit-disallowed-list': [['px'], { ignoreFunctions: ['var', 'env'] }],
};

export default {
  rules: {},
  overrides: [
    {
      files: ['packages/play/src/**/*.css'],
      rules: screenRules,
    },
    {
      files: ['packages/play/src/**/*.svelte'],
      customSyntax: 'postcss-html',
      rules: screenRules,
    },
    {
      files: ['packages/play/src/styles/tokens.css'],
      rules: { 'color-no-hex': null, 'declaration-property-value-disallowed-list': null },
    },
    {
      files: ['packages/play/src/components/AdminConsole.svelte'],
      rules: { 'unit-disallowed-list': null },
    },
  ],
};
