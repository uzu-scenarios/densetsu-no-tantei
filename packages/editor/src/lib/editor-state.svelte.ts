import { pruneAbsentOptionals, scenarioJsonSchema } from './schema-utils';
/**
 * エディタの編集対象 (scenario) と読み書きロジックを持つモジュールスコープの $state。
 *
 * コンポーネント内で $state に代入すると所有権がそのコンポーネントに付き、 子 (Field)
 * からの深い書き換えが svelte の ownership 警告 (ownership_invalid_mutation) になる。
 * フォームは「選択中のノードをその場で書き換える」設計なので、 状態の生成・代入を
 * すべてモジュールに置いて、 どのコンポーネントから書き換えても正当にする。
 */

export interface SaveMessage {
  kind: 'ok' | 'warn' | 'error';
  lines: string[];
}

export const editorState = $state<{
  scenario: any;
  baseline: string;
  loadError: string;
  saving: boolean;
  saveMessage: SaveMessage | null;
}>({
  scenario: null,
  baseline: '',
  loadError: '',
  saving: false,
  saveMessage: null,
});

export function isDirty(): boolean {
  return (
    editorState.scenario != null &&
    JSON.stringify($state.snapshot(editorState.scenario)) !== editorState.baseline
  );
}

export async function loadScenario(): Promise<void> {
  editorState.loadError = '';
  try {
    const res = await fetch('/api/scenario');
    if (!res.ok) throw new Error(`GET /api/scenario: ${res.status}`);
    const scenario = await res.json();
    editorState.scenario = scenario;
    editorState.baseline = JSON.stringify($state.snapshot(editorState.scenario));
    editorState.saveMessage = null;
  } catch (error) {
    editorState.loadError = String(error);
  }
}

// 初回ロードはモジュール評価時に開始する。
void loadScenario();

/**
 * フォームからの書き換えはすべてこの 2 つを通す。 Field は container を props で
 * 受けて子孫ノードを in-place 編集する設計だが、 component 内で props 由来の値へ
 * 直接代入すると svelte dev が ownership_invalid_mutation を警告する (計装は
 * component 内の代入式に入る)。 モジュール関数経由にすることで「editor の状態は
 * このモジュールが書く」という契約をコードの形にも揃える。
 */
export function setProp(target: any, key: string | number, value: unknown): void {
  target[key] = value;
}

export function removeProp(target: any, key: string | number): void {
  delete target[key];
}

export async function saveScenario(): Promise<void> {
  if (!editorState.scenario || editorState.saving) return;
  const snapshot = pruneAbsentOptionals(
    $state.snapshot(editorState.scenario),
    scenarioJsonSchema(),
  );
  editorState.saving = true;
  editorState.saveMessage = null;
  try {
    const res = await fetch('/api/scenario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    const result = await res.json();
    if (!result.ok) {
      editorState.saveMessage = {
        kind: 'error',
        lines: [
          result.message ?? '保存に失敗しました',
          ...(result.issues ?? []).map(
            (issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`,
          ),
        ],
      };
      return;
    }
    editorState.scenario = snapshot;
    editorState.baseline = JSON.stringify(snapshot);
    const violations = result.refViolations ?? [];
    editorState.saveMessage =
      violations.length > 0
        ? {
            kind: 'warn',
            lines: [
              '保存しました (壊れた ID 参照があります):',
              ...violations.map(
                (violation: { path: string; refTarget: string; value: string }) =>
                  `${violation.path} → ${violation.refTarget}: "${violation.value}"`,
              ),
            ],
          }
        : { kind: 'ok', lines: ['保存しました'] };
  } catch (error) {
    editorState.saveMessage = { kind: 'error', lines: [String(error)] };
  } finally {
    editorState.saving = false;
  }
}
