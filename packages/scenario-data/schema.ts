/**
 * シナリオデータ (scenario.json) の zod スキーマ。 単一の source of truth。
 *
 * ここから 3 つが派生する:
 * - TS の型:      `z.infer<typeof ScenarioSchema>` (play は型だけを import する)
 * - 実行時検証:   `ScenarioSchema.safeParse(data)` (editor の保存時と test)
 * - JSON Schema:  `z.toJSONSchema(ScenarioSchema)` (editor のフォーム生成)
 *
 * 取り決め:
 * - ID 参照のフィールドには `.meta({ refTarget: '<コレクション名>' })` を付ける。
 *   editor は refTarget があればそのコレクションの一覧から選ばせる。
 * - 「無い」は欠落だけで表す。 `null` / 空文字を「無い」の意味で書かない。
 * - strictObject で未知キーを弾く (typo したキーが黙って素通りしないため)。
 * - 型・欄はこの作品が使う分だけ持つ。 使わない欄は足さない。
 * - スキーマの実行時 import は editor / test に限る。 play は `import type` のみ。
 */

import { z } from 'zod';
import { clueLines } from './clue-lines.ts';

type RefTarget =
  | 'roles'
  | 'npcs'
  | 'phases'
  | 'dialogueScenes'
  | 'clues'
  | 'assets'
  | 'audioTracks'
  | 'places'
  // roles + npcs の和集合。 台詞の話者と証言者の候補。
  | 'speakers';

// 空文字は「未設定」ではなく壊れた参照。 未設定は欄ごと書かない。
const refId = (refTarget: RefTarget, title: string) => z.string().min(1).meta({ refTarget, title });

/** 本文。 `**強調**` と `漢字(かな)` のルビ、 改行をそのまま持つ。 */
const richText = (title: string) => z.string().meta({ title, format: 'textarea' });

// ---------------------------------------------------------------- 判定条件

/**
 * 投票結果に対する条件。 エンディングの分岐と得点の判定だけが読む。
 * 型を増やして「JSON で書かれたプログラム」へ育てない。
 */
const TopConditionSchema = z.strictObject({
  type: z.literal('top').meta({ title: '条件タイプ' }),
  /** 犯人投票でこの役が単独最多。 */
  roleId: refId('roles', '役'),
});
const NotTopConditionSchema = z.strictObject({
  type: z.literal('not_top').meta({ title: '条件タイプ' }),
  /** 犯人投票でこの役が単独最多ではない (同票を含む)。 */
  roleId: refId('roles', '役'),
});
const VotedConditionSchema = z.strictObject({
  type: z.literal('voted').meta({ title: '条件タイプ' }),
  voterRoleId: refId('roles', '投票した役'),
  targetRoleId: refId('roles', '投票先の役'),
});
const DeclaredConditionSchema = z.strictObject({
  type: z.literal('declared').meta({ title: '条件タイプ' }),
  roleId: refId('roles', '申告した役'),
  /** 秘密を指摘されたと申告したか。 */
  pointedOut: z.boolean().meta({ title: '指摘されたと申告' }),
});

export const OutcomeConditionSchema = z.discriminatedUnion('type', [
  TopConditionSchema,
  NotTopConditionSchema,
  VotedConditionSchema,
  DeclaredConditionSchema,
]);
export type OutcomeCondition = z.infer<typeof OutcomeConditionSchema>;

// ---------------------------------------------------------------- 役

export const MissionSchema = z.strictObject({
  id: z.string(),
  title: z.string().meta({ title: '目標' }),
  points: z.number().int().meta({ title: '点' }),
  /** 手帳に出す、 その目標を持つ理由。 */
  body: richText('本文'),
  /** 全部満たしたら達成。 */
  when: z.array(OutcomeConditionSchema).min(1).meta({ title: '達成条件' }),
  /** 感想戦に出す達成条件の説明。 */
  rule: z.string().meta({ title: '達成条件の説明' }),
});
export type Mission = z.infer<typeof MissionSchema>;

export const HandoutBeatSchema = z.strictObject({
  time: z.string().meta({ title: '時刻' }),
  body: richText('行動'),
});
export type HandoutBeat = z.infer<typeof HandoutBeatSchema>;

export const HandoutItemSchema = z.strictObject({
  name: z.string().meta({ title: '持ち物' }),
  body: richText('中身'),
});

export const HandoutAcquaintanceSchema = z.strictObject({
  roleId: refId('roles', '相手'),
  /** 本人から見た呼び方 (「赤毛の男性」)。 */
  label: z.string().meta({ title: '見え方' }),
  body: richText('印象'),
});

/** 各自が読む手帳 (個別情報)。 本人にだけ配る。 */
export const HandoutSchema = z.strictObject({
  /** 手帳の最初に大きく出す一文 (犯人である、 など)。 */
  headline: z.string().meta({ title: '見出しの一文' }).optional(),
  background: richText('背景'),
  beats: z.array(HandoutBeatSchema).meta({ title: '行動' }),
  items: z.array(HandoutItemSchema).meta({ title: '持ち物' }),
  acquaintances: z.array(HandoutAcquaintanceSchema).meta({ title: '他の人物について' }),
});
export type Handout = z.infer<typeof HandoutSchema>;

/**
 * 投票のあとに本人だけが答える自己申告。 持つ役だけが答える。
 */
export const SecretDeclarationSchema = z.strictObject({
  /** 自己申告の画面に出す、 守っていた秘密の一言。 */
  secret: z.string().meta({ title: '秘密' }),
});

export const RoleSchema = z.strictObject({
  id: z.string(),
  name: z.string().meta({ title: '名前' }),
  kana: z.string().meta({ title: 'よみ' }),
  /** 公開プロフィール (「30代男性」「一人称：俺」…)。 */
  profile: z.array(z.string()).meta({ title: '公開プロフィール' }),
  portraitAssetId: refId('assets', '立ち絵'),
  handout: HandoutSchema.meta({ title: '手帳' }),
  missions: z.array(MissionSchema).meta({ title: '目標' }),
  declaration: SecretDeclarationSchema.meta({ title: '秘密の自己申告' }).optional(),
  /** 感想戦で明かす正体の一言。 */
  truth: z.string().meta({ title: '正体' }),
});
export type Role = z.infer<typeof RoleSchema>;

export const NpcSchema = z.strictObject({
  id: z.string(),
  name: z.string().meta({ title: '名前' }),
  portraitAssetId: refId('assets', '立ち絵').optional(),
});
export type Npc = z.infer<typeof NpcSchema>;

// ---------------------------------------------------------------- 読み合わせ

/** 行で広げる新聞の紙面。 タイトル回収の見出しを読ませる。 */
export const NewspaperSchema = z.strictObject({
  /** 紙面の上に添える札 (「翌日の朝刊」)。 */
  label: z.string().meta({ title: '札' }),
  headline: z.string().meta({ title: '見出し' }),
});

/**
 * 録音した語り。 seconds は音声の長さで、 サーバーはこれだけ待って次の行へ送る
 * (サーバーは音を聞けないので、 長さをデータに持つ)。
 */
export const LineVoiceSchema = z.strictObject({
  assetId: refId('assets', '音声'),
  seconds: z.number().positive().meta({ title: '長さ (秒)' }),
});

/**
 * 台詞行。 `speakerId` が無ければ地の文。 担当 (誰が送るか) は話者から決まる:
 * 役の台詞はその役、 NPC の台詞は scene の npcReaderRoleId、 地の文は narratorRoleId。
 * 語りの場面 (narrated) では誰も送らず、 voice の長さで進む。
 */
export const DialogueLineSchema = z.strictObject({
  speakerId: refId('speakers', '話者').optional(),
  text: richText('本文'),
  /** この行から背景を差し替える。 */
  backgroundAssetId: refId('assets', '背景').optional(),
  /** この行で新聞の紙面を広げる。 */
  newspaper: NewspaperSchema.meta({ title: '新聞' }).optional(),
  voice: LineVoiceSchema.meta({ title: '語りの音声' }).optional(),
});
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const DialogueSceneSchema = z
  .strictObject({
    id: z.string(),
    title: z.string().meta({ title: '場面名' }),
    /** 録音した語りを流して自動で進める。 プレイヤーは読まない。 */
    narrated: z.boolean().meta({ title: '語りを流す' }).optional(),
    /** 読み合わせの場面だけに要る。 */
    narratorRoleId: refId('roles', '地の文を読む役').optional(),
    /** NPC の台詞を読む役。 無ければ地の文の担当が読む。 */
    npcReaderRoleId: refId('roles', 'NPC の台詞を読む役').optional(),
    backgroundAssetId: refId('assets', '背景'),
    lines: z.array(DialogueLineSchema).min(1),
  })
  .superRefine((scene, ctx) => {
    if (!scene.narrated) {
      if (!scene.narratorRoleId) {
        ctx.addIssue({ code: 'custom', path: ['narratorRoleId'], message: '地の文を読む役を選ぶ' });
      }
      return;
    }
    scene.lines.forEach((line, i) => {
      if (!line.voice) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'voice'],
          message: '語りの場面は全行に音声が要る',
        });
      }
      if (line.speakerId) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'speakerId'],
          message: '語りの場面に話者は置けない',
        });
      }
    });
  });
export type DialogueScene = z.infer<typeof DialogueSceneSchema>;

// ---------------------------------------------------------------- フェーズ

const phaseBaseShape = {
  id: z.string(),
  /** フェーズの名前。 章の札と並べてプレイヤーにも出す (「第三章　推理」)。 */
  title: z.string().meta({ title: '表示名' }),
  /** 章の札 (「第一章」)。 幕と HUD の札に出す。 */
  chapter: z.string().meta({ title: '章' }),
  bgmTrackId: refId('audioTracks', 'BGM').optional(),
  /**
   * フェーズに入ったときにマイクを切る。 muted は本人が戻せ、 locked はフェーズの間は戻せない。
   * 書かなければ本人の自由。 切れたマイクはフェーズを抜けても自動では戻らない (SDK の仕様)。
   */
  mic: z.enum(['muted', 'locked']).meta({ title: 'マイク' }).optional(),
};

/** フェーズに入ったとき、 いま何をする時間かを伝える一言。 */
const guide = z
  .strictObject({
    heading: z.string().meta({ title: '見出し' }),
    body: richText('本文'),
  })
  .meta({ title: '案内' })
  .optional();

const timerSeconds = z.number().int().positive().meta({ title: '制限時間 (秒)' });
/** 残りがこの秒数を切ったら計器を熱くする。 */
const warnAtSeconds = z.number().int().positive().meta({ title: '終盤の秒数' });

export const DialoguePhaseSchema = z.strictObject({
  ...phaseBaseShape,
  type: z.literal('dialogue').meta({ title: 'フェーズ種別' }),
  sceneId: refId('dialogueScenes', '読み合わせ'),
  /** 全員が同意したら読み飛ばせる。 経験者だけの卓で遊び方を省く。 */
  skippable: z.boolean().meta({ title: '全員の同意で飛ばせる' }).optional(),
  /** 結末の読み合わせにだけ書く。 読み終えたら本編を終えて感想戦へ入る。 */
  ending: z
    .strictObject({
      /** 感想戦の「ほかの結末」に出す名前。 */
      label: z.string().meta({ title: '結末の名前' }),
      /** 感想戦の「ほかの結末」に出す分岐条件の説明。 */
      rule: z.string().meta({ title: '結末の条件' }),
    })
    .meta({ title: '結末' })
    .optional(),
});
export type DialoguePhase = z.infer<typeof DialoguePhaseSchema>;

/** 各自が自分の手帳を黙読する時間。 */
export const HandoutPhaseSchema = z.strictObject({
  ...phaseBaseShape,
  type: z.literal('handout').meta({ title: 'フェーズ種別' }),
  timerSeconds,
  warnAtSeconds,
  guide,
});
export type HandoutPhase = z.infer<typeof HandoutPhaseSchema>;

/** スタッフへの質問。 答えは証言の札の本文の何行目か (同じ文をデータに二重に持たない)。 */
export const EventQuestionSchema = z.strictObject({
  id: z.string(),
  question: z.string().meta({ title: '質問' }),
  line: z.number().int().min(0).meta({ title: '答える行 (証言の本文の行番号、 0 始まり)' }),
});
export type EventQuestion = z.infer<typeof EventQuestionSchema>;

const eventBase = {
  id: z.string(),
  atSeconds: z.number().int().min(0).meta({ title: '議論開始からの秒' }),
  title: z.string().meta({ title: '見出し' }),
  /** 話しかけてくる人。 無ければ地の文として出す。 */
  speakerId: refId('npcs', '話しかけてくる人').optional(),
  says: z.array(richText('台詞')).min(1).meta({ title: '台詞' }),
};

/**
 * 議論の途中で起きる出来事。 起きるとカットインとダイアログが出て、 共通情報が卓に出る。
 * どの出来事にも載っていない共通情報は、 議論の開始時から出ている。
 */
export const DiscussionEventSchema = z
  .discriminatedUnion('kind', [
    /** 共通情報がそのまま出る (凶器が見つかった、 など)。 */
    z.strictObject({
      ...eventBase,
      kind: z.literal('reveal').meta({ title: '種類' }),
      clueIds: z.array(refId('clues', '出る共通情報')).min(1).meta({ title: '出る共通情報' }),
    }),
    /** 手荷物検査。 各自がカバンを開けると、 その人が持ち主の共通情報が出る。 */
    z.strictObject({
      ...eventBase,
      kind: z.literal('bags').meta({ title: '種類' }),
      clueIds: z.array(refId('clues', '持ち物')).min(1).meta({ title: '持ち物' }),
    }),
    /** スタッフへの質問。 誰かが質問を選ぶと、 その答え (証言の 1 行) が出る。 */
    z.strictObject({
      ...eventBase,
      kind: z.literal('questions').meta({ title: '種類' }),
      clueId: refId('clues', '証言'),
      questions: z.array(EventQuestionSchema).min(1).meta({ title: '質問' }),
    }),
    /** 知らせだけで、 情報は出ない (サイレン)。 */
    z.strictObject({
      ...eventBase,
      kind: z.literal('notice').meta({ title: '種類' }),
    }),
  ])
  .meta({ title: '出来事' });
export type DiscussionEvent = z.infer<typeof DiscussionEventSchema>;

/** 全体議論。 共通情報と見取り図が開き、 途中で出来事が起きる。 */
export const DiscussionPhaseSchema = z.strictObject({
  ...phaseBaseShape,
  type: z.literal('discussion').meta({ title: 'フェーズ種別' }),
  timerSeconds,
  warnAtSeconds,
  guide,
  /** 起きる順に並べる。 */
  events: z.array(DiscussionEventSchema).meta({ title: '議論中の出来事' }).optional(),
});
export type DiscussionPhase = z.infer<typeof DiscussionPhaseSchema>;

export const EndingRuleSchema = z.strictObject({
  /** 全部満たしたらこの結末。 空なら無条件 (最後に置く)。 */
  when: z.array(OutcomeConditionSchema).meta({ title: '条件' }),
  phaseId: refId('phases', '結末'),
});
export type EndingRule = z.infer<typeof EndingRuleSchema>;

/** 犯人投票と秘密の自己申告。 全員が出したら開票へ進む。 */
export const VotePhaseSchema = z.strictObject({
  ...phaseBaseShape,
  type: z.literal('vote').meta({ title: 'フェーズ種別' }),
  question: z.string().meta({ title: '問い' }),
  declarationQuestion: z.string().meta({ title: '自己申告の問い' }),
  guide,
  /** 上から順に判定し、 最初に一致した結末へ進む。 */
  endings: z.array(EndingRuleSchema).min(1).meta({ title: '結末の分岐' }),
});
export type VotePhase = z.infer<typeof VotePhaseSchema>;

/** 開票。 全員が確認したら投票で決まった結末へ進む。 */
export const RevealPhaseSchema = z.strictObject({
  ...phaseBaseShape,
  type: z.literal('reveal').meta({ title: 'フェーズ種別' }),
  votePhaseId: refId('phases', '開票する投票'),
});
export type RevealPhase = z.infer<typeof RevealPhaseSchema>;

export const PhaseSchema = z.discriminatedUnion('type', [
  DialoguePhaseSchema,
  HandoutPhaseSchema,
  DiscussionPhaseSchema,
  VotePhaseSchema,
  RevealPhaseSchema,
]);
export type Phase = z.infer<typeof PhaseSchema>;
export type PhaseType = Phase['type'];

// ---------------------------------------------------------------- 共通情報

export const CLUE_CATEGORIES = ['scene', 'belongings', 'testimony'] as const;
export type ClueCategory = (typeof CLUE_CATEGORIES)[number];

/** 議論で全員へ公開する共通情報の 1 枚。 出来事 (DiscussionEvent) に載っていなければ議論の開始時から出ている。 */
export const ClueSchema = z.strictObject({
  id: z.string(),
  category: z.enum(CLUE_CATEGORIES).meta({ title: '分類' }),
  title: z.string().meta({ title: '見出し' }),
  body: richText('本文'),
  imageAssetId: refId('assets', '画像').optional(),
  /** 証言者・持ち主の顔を出すとき。 */
  speakerId: refId('speakers', '人物').optional(),
  /** 見取り図で光らせる場所。 */
  placeIds: z.array(refId('places', '場所')).optional(),
});
export type Clue = z.infer<typeof ClueSchema>;

/** 見取り図の 1 区画。 座標は図全体 (settings.floorMap の width x height) の中の位置。 */
export const PlaceSchema = z.strictObject({
  id: z.string(),
  label: z.string().meta({ title: '名前' }),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  /** 縦書きで名前を出す (細長い区画)。 */
  vertical: z.boolean().optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

// ---------------------------------------------------------------- 感想戦

export const TruthStepSchema = z.strictObject({
  id: z.string(),
  title: z.string().meta({ title: '見出し' }),
  body: richText('本文'),
});
export type TruthStep = z.infer<typeof TruthStepSchema>;

export const TimelineRowSchema = z.strictObject({
  time: z.string().meta({ title: '時刻' }),
  /** 列 (debrief.timelineColumns) の順に並べる。 */
  cells: z.array(z.string()).meta({ title: '出来事' }),
});

export const DebriefSchema = z.strictObject({
  truthSteps: z.array(TruthStepSchema).meta({ title: '真相解説' }),
  timelineColumns: z.array(z.string()).meta({ title: '年表の列' }),
  timeline: z.array(TimelineRowSchema).meta({ title: '真相の年表' }),
  afterword: richText('あとがき'),
  afterwordImageAssetIds: z.array(refId('assets', 'あとがきの画像')).optional(),
  spoilerGuide: richText('ネタバレの注意'),
  talkGuide: richText('感想戦の進め方'),
});
export type Debrief = z.infer<typeof DebriefSchema>;

// ---------------------------------------------------------------- 設定

export const LobbySchema = z.strictObject({
  synopsis: richText('あらすじ'),
  /** 原作との関係の断り書き。 ロビーと感想戦のあとがきに出す。 */
  notice: richText('このシナリオについて'),
  /** はじめて遊ぶ人への短い案内 (マダミスとは)。 */
  primer: z
    .array(
      z.strictObject({
        heading: z.string().meta({ title: '見出し' }),
        body: richText('本文'),
      }),
    )
    .meta({ title: 'はじめての人へ' }),
  coverAssetId: refId('assets', 'カバー'),
  backgroundAssetId: refId('assets', '背景'),
  /** 表紙の下に添える遊び方の目安 (「3人用・約35分・GM不要」)。 */
  playInfo: z.string().meta({ title: '人数・時間など' }),
});

/** 共通情報の分類ごとの見出しと、 まだ出ていない札に出す一言 (どうすれば出るか)。 */
const clueCategoryLabel = z.strictObject({
  label: z.string().meta({ title: '見出し' }),
  pending: z.string().meta({ title: 'まだ出ていない札' }),
});

export const ScenarioSettingsSchema = z.strictObject({
  title: z.string().meta({ title: 'タイトル' }),
  author: z.string().meta({ title: '作者' }),
  lobby: LobbySchema.meta({ title: 'ロビー' }),
  /** 感想戦の背景と BGM。 */
  debriefBackgroundAssetId: refId('assets', '感想戦の背景'),
  debriefBgmTrackId: refId('audioTracks', '感想戦の BGM'),
  /** 手帳・議論・投票など読み合わせ以外の画面の背景。 */
  roomBackgroundAssetId: refId('assets', '議論の背景'),
  clueCategories: z
    .strictObject({
      scene: clueCategoryLabel,
      belongings: clueCategoryLabel,
      testimony: clueCategoryLabel,
    })
    .meta({ title: '共通情報の分類' }),
  floorMap: z
    .strictObject({
      title: z.string().meta({ title: '見取り図の名前' }),
      width: z.number().positive().meta({ title: '幅' }),
      height: z.number().positive().meta({ title: '高さ' }),
    })
    .meta({ title: '見取り図' }),
});

/**
 * アセットの参照先。 play の public/ 起点の相対パスだけを許す (data URI を混ぜない)。
 */
export const AssetEntrySchema = z.strictObject({
  id: z.string(),
  name: z.string().meta({ title: 'アセット名' }),
  kind: z.enum(['image', 'audio']),
  path: z
    .string()
    .regex(/^\.\/assets\/u\/[a-z0-9_.-]+$/, './assets/u/<英数字とハイフン> で指定する'),
});
export type AssetEntry = z.infer<typeof AssetEntrySchema>;

export const AudioTrackSchema = z.strictObject({
  id: z.string(),
  name: z.string().meta({ title: 'トラック名' }),
  assetId: refId('assets', '音源'),
});
export type AudioTrack = z.infer<typeof AudioTrackSchema>;

export const ScenarioSchema = z
  .strictObject({
    settings: ScenarioSettingsSchema,
    roles: z.array(RoleSchema).min(1).meta({ title: '役' }),
    npcs: z.array(NpcSchema).meta({ title: 'NPC' }),
    phases: z.array(PhaseSchema).min(1).meta({ title: 'フェーズ' }),
    dialogueScenes: z.array(DialogueSceneSchema).meta({ title: '読み合わせ' }),
    clues: z.array(ClueSchema).meta({ title: '共通情報' }),
    places: z.array(PlaceSchema).meta({ title: '見取り図' }),
    debrief: DebriefSchema.meta({ title: '感想戦' }),
    audioTracks: z.array(AudioTrackSchema).meta({ title: 'BGM' }),
    assets: z.array(AssetEntrySchema).meta({ title: 'アセット' }),
  })
  .superRefine((scenario, ctx) => {
    const clue = (id: string) => scenario.clues.find((c) => c.id === id);
    const roleIds = new Set(scenario.roles.map((r) => r.id));
    scenario.phases.forEach((phase, p) => {
      if (phase.type !== 'discussion') return;
      const seen = new Set<string>();
      (phase.events ?? []).forEach((event, e) => {
        const path = ['phases', p, 'events', e];
        const ids =
          event.kind === 'questions'
            ? [event.clueId]
            : event.kind === 'notice'
              ? []
              : event.clueIds;
        for (const id of ids) {
          if (seen.has(id)) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `共通情報 ${id} が 2 つの出来事に載っている`,
            });
          }
          seen.add(id);
        }
        if (event.kind === 'bags') {
          for (const id of event.clueIds) {
            if (!roleIds.has(clue(id)?.speakerId ?? '')) {
              ctx.addIssue({
                code: 'custom',
                path,
                message: `持ち物 ${id} の持ち主 (speakerId) が役でない`,
              });
            }
          }
        }
        if (event.kind === 'questions') {
          // 本文を書き換えて行がずれたら、 ここで気づけるようにする。
          const count = clueLines(clue(event.clueId)?.body ?? '').length;
          const lines = event.questions.map((q) => q.line).sort((a, b) => a - b);
          if (lines.join() !== [...Array(count).keys()].join()) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `質問の答えは証言 ${event.clueId} の ${count} 行を 1 行ずつ全部指す`,
            });
          }
        }
      });
    });
  });
export type Scenario = z.infer<typeof ScenarioSchema>;
