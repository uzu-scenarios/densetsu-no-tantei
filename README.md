# “伝説の探偵”殺人事件 — UZU Code 版

『“伝説の探偵”殺人事件』（原作：アラン校長）の UZU Code 版です。台本・分岐・得点は原作どおりで、遊びやすさのための仕組み（議論中の出来事・語りの遊び方など）を足しています。

- アラン校長は UZU Code 化や素材作成に関わっていません
- いろいろな機能を見せることを重視したため、原作とはパワーバランスやプレイ感が違います
- イラスト・背景の一部は生成 AI で作っています

3 人用・約 35 分・GM 不要（進行管理席は任意）・横持ち。

> [!WARNING]
> `docs/` と `packages/scenario-data/scenario.json` には犯人・真相・全員の手帳・全結末が入っています。遊ぶ前に読まないでください。

## 動かす

```bash
npm install
npm run harness   # 3 席 + 進行管理席を並べた dev harness → http://localhost:10001/
```

BGM の音源ファイルは配布元（DOVA-SYNDROME / zukisuzuki BGM / GARETOCO）の規約で公開できないため、このリポジトリには入っていません。無くても BGM が鳴らないだけで遊べます。手元に音源がある場合は `packages/play/public/assets/u/bgm-01.mp3`〜`bgm-05.mp3` に置きます。

| 目的 | コマンド |
|---|---|
| 単体テスト（データ検証・全結末の通しプレイ） | `npm test` |
| 型 / lint | `npm run typecheck` / `npm run lint` |
| UI 操作で最後まで通す E2E（harness 起動中に） | `npm run e2e:play -- --ending=1` |
| シナリオエディタ | `npm run editor` |

## 資料

- [CLAUDE.md](./CLAUDE.md) — パッケージ構成・層の分け方・データとコードの境界・画面の書き方
- [docs/](./docs/README.md) — 作品の意図と足した仕組み、原作の仕様書、UI の視覚語彙
