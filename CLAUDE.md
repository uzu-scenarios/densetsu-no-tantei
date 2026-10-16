# CLAUDE.md

「“伝説の探偵”殺人事件」— uzu code (`@uzuhq/code-sdk` の `run()`) のマーダーミステリーシナリオ。3 人固定 / landscape / GM 不要 (進行管理席は任意)。

作品の意図と追加したギミックは `docs/story-book/`、それ以外の資料は `docs/README.md` から辿る。
フェーズ構成・台本・分岐・得点は scenario.json が正で、docs には書き写さない。

## パッケージ構成 (npm workspaces)

| パッケージ | 役割 |
|---|---|
| `packages/scenario-data` | シナリオデータの SSOT。`schema.ts` (zod) が構造の正、`scenario.json` がデータ本体。型は `z.infer` で導出し、play は `@scenario/data` から型と `scenarioData` を import する |
| `packages/play` | プレイ画面と server reducer。zod には依存しない (型 import のみ) |
| `packages/editor` | シナリオ編集画面。vite dev (port 20001〜) が SPA + 読み書き API を兼ねる。保存時に zod 検証 + ID 参照チェック |

`scenario.json` は `stable-json.ts` の安定化フォーマット (キー順ソート + 2 スペース) で書く。手で編集したら同じ形へ戻す (`npm test` が落とす)。

## コマンド (リポジトリ root から)

| 目的 | コマンド |
|---|---|
| 単体テスト (データ検証 + 全結末の通しプレイ) | `npm test` |
| 型 | `npm run typecheck` |
| lint | `npm run lint` |
| dev harness (3 席 + 進行管理席の iframe) | `npm run harness` → http://localhost:10001/ |
| UI 操作で最後まで通す E2E | `npm run e2e:play -- --ending=1` (harness 起動中に。 スクショと state を `tmp/shots/play` に残す) |
| 進行管理席のコンソールを UI 操作で一通り使う E2E | `node packages/play/e2e/admin.mjs` |
| 基準サイズ (780x360 / 844x390 / 1194x834) で撮り直す | `node packages/play/e2e/viewports.mjs` |
| シナリオエディタ | `npm run editor` |

harness のポートは埋まっていれば繰り上がる。起動ログの URL を `UZU_HARNESS_URL` で E2E に渡す。
harness の server reducer は起動時のコードのまま (画面は HMR で新しくなる)。`src/server/` を変えたら harness を再起動する。E2E は部屋 (devroom) を共有するので、手で触っている harness に流すと画面が勝手に進む。

## play の層

| 層 | 置くもの |
|---|---|
| `src/server/` | reducer (`logic.ts`) とフェーズの出入り (`flow.ts`)。決定的に書く (乱数・実時刻を state に書かない。時刻は `ctx.time` / `plus` / `minus`) |
| `src/scenario/` | シナリオデータの純関数 (引き当て・台詞の担当・投票判定・議論中の出来事)。server と画面の両方が通る |
| `src/view/` | snapshot → 画面の導出 (純関数) |
| `src/components/` | Svelte。`*.svelte.ts` は store |
| `src/runtime/bridge.ts` | SDK と画面の継ぎ目 (onState → store、操作 → sendAction) |
| `src/platform/` | アセット URL・BGM |

「押せるか」の判定は server と画面で同じ `scenario/` の関数を通す。server は弾くときに Error を投げる (state は巻き戻る)。

## データとコードの境界

作家が調整したいもの (文言・尺・BGM・マイクの制限・分岐先・得点条件・見取り図・共通情報の分類名・議論中の出来事の時刻と中身・語りの音声) は scenario.json。遷移の仕組み・意匠・操作エラーの文言は code。
- 型・欄はこの作品が使う分だけ持つ。使わない欄は消す
- 同じ事実を data と code の両方に持たない
- 条件の型 (`top` / `not_top` / `voted` / `declared`) を増やして JSON をプログラムにしない

## 画面の書き方

- 見た目の語彙は `docs/impl/visual-vocabulary.md`。色は `packages/play/src/styles/tokens.css` の semantic トークンだけ (生 hex と primitive の `--navy-*` 等の直参照は stylelint が止める)。透かしは `rgba(var(--cloth-rgb), 0.8)` のようにチャンネルを通す
- 状態は `data-*` 属性で表す (`class:` を使わない。テストが止める)。`:global()` は使わない (stylelint が止める)
- 寸法は em。基準は `App.svelte` の `.frame` の font-size (枠の高さに比例)。px は stylelint が止める。例外 (em の基準・SVG の座標・進行管理席) はその場で理由を書いて外す
- 画面はフェーズごとに `{#key}` で排他に mount する。背景は画面ごとに `Backdrop` を 1 つ持つ
- 導出は `view-context.svelte.ts` の `view` (tracked) を通す
- この端末だけの状態 (開いている札・見た手がかり・タブ) は `local-ui.svelte.ts` / component の local state。共有 state に書かない
- 発話状態は `voice-store` (ローカル)。共有 state に書き戻さない

## アセット

`packages/play/public/assets/u/<用途>-<対象>.<ext>` (用途: `chara` / `bg` / `clue` / `icon` / `bgm` / `voice` / `sfx` / `cover` / `afterword`)。ファイル名は英小文字・数字・ハイフンのみ (認証要件)。`icon-*` は manifest.json のキャラ選択用で scenario からは参照しない。
追加した絵は higgsfield (nano_banana_pro) でカバー絵を画風参照にして生成し、立ち絵は背景除去して WebP にしている。
BGM (`bgm-01`〜`05.mp3`) は配布元 (DOVA-SYNDROME / zukisuzuki BGM / GARETOCO) の規約で音源ファイルを公開できないので git に入れていない (`.gitignore`)。手元の `packages/play/public/assets/u/` に置いて harness と publish を動かす。無くても BGM が鳴らないだけで遊べる。
遊び方の語り (`voice-howto-*`) は ElevenLabs (eleven_v4、声は Voice Library の Koji `YtLXDp1ffXOa1EhXx19q`) で 1 行ずつ生成し、各行の長さ (秒) を scenario.json の `voice.seconds` に書く。録り直したら長さも測り直す。

## Git

ユーザーが明示的に許可しない限り、ユーザーが行った変更を revert しない。
