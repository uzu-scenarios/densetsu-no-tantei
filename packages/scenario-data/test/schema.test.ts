import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectRefViolations } from '../ref-check.ts';
import { DialogueSceneSchema, ScenarioSchema } from '../schema.ts';
import { stableJsonStringify } from '../stable-json.ts';

const raw = readFileSync(new URL('../scenario.json', import.meta.url), 'utf8');
const data = JSON.parse(raw);

describe('scenario.json', () => {
  it('スキーマに合う', () => {
    const result = ScenarioSchema.safeParse(data);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it('壊れた ID 参照が無い', () => {
    expect(collectRefViolations(data)).toEqual([]);
  });

  it('安定化フォーマットで書かれている', () => {
    expect(raw).toBe(stableJsonStringify(data));
  });

  it('ID がコレクションをまたいで一意', () => {
    const ids = [
      ...data.roles,
      ...data.npcs,
      ...data.phases,
      ...data.dialogueScenes,
      ...data.clues,
      ...data.places,
      ...data.assets,
      ...data.audioTracks,
    ].map((entry: { id: string }) => entry.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('結末の分岐は最後が無条件で、 どの結末も読み合わせの終点', () => {
    for (const phase of data.phases.filter((p: { type: string }) => p.type === 'vote')) {
      expect(phase.endings.at(-1).when).toEqual([]);
      for (const rule of phase.endings) {
        const target = data.phases.find((p: { id: string }) => p.id === rule.phaseId);
        expect(target?.type).toBe('dialogue');
        expect(target?.ending).toBeDefined();
      }
    }
  });

  describe('議論中の出来事', () => {
    const discussions = data.phases.filter((p: { type: string }) => p.type === 'discussion');

    it('起きる順に並び、 議論の制限時間の中に収まる', () => {
      for (const phase of discussions) {
        const times = (phase.events ?? []).map((e: { atSeconds: number }) => e.atSeconds);
        expect(times).toEqual([...times].sort((a, b) => a - b));
        for (const t of times) expect(t).toBeLessThan(phase.timerSeconds);
      }
    });
  });

  describe('スキーマの横断検査で壊れたデータを弾く', () => {
    const issuesOf = (mutate: (d: any) => void): string[] => {
      const copy = structuredClone(data);
      mutate(copy);
      const result = ScenarioSchema.safeParse(copy);
      return result.success ? [] : result.error.issues.map((i) => i.message);
    };
    const events = (d: any) =>
      d.phases.find((p: { type: string }) => p.type === 'discussion').events;
    const byId = (d: any, id: string) => events(d).find((e: { id: string }) => e.id === id);

    it('同じ共通情報を 2 つの出来事に載せたら弾く', () => {
      const issues = issuesOf((d) =>
        byId(d, 'ev_bug').clueIds.push(byId(d, 'ev_weapon').clueIds[0]),
      );
      expect(issues.some((m) => m.includes('2 つの出来事'))).toBe(true);
    });

    it('質問の答えが証言の行からずれたら弾く', () => {
      const issues = issuesOf((d) => {
        byId(d, 'ev_cleaner').questions[1].line = 5;
      });
      expect(issues.some((m) => m.includes('1 行ずつ全部指す'))).toBe(true);
    });

    it('持ち主が役でない持ち物を手荷物検査に載せたら弾く', () => {
      const issues = issuesOf((d) => byId(d, 'ev_bags').clueIds.push('clue_staff'));
      expect(issues.some((m) => m.includes('持ち主'))).toBe(true);
    });

    it('出来事の種類に合わない欄は弾く (質問に clueIds を書くなど)', () => {
      expect(
        issuesOf((d) => (byId(d, 'ev_cleaner').clueIds = ['clue_staff'])).length,
      ).toBeGreaterThan(0);
    });

    it('出来事の中の壊れた ID 参照を拾う', () => {
      const copy = structuredClone(data);
      byId(copy, 'ev_cleaner').clueId = 'no_such_clue';
      expect(collectRefViolations(copy).map((v) => v.value)).toEqual(['no_such_clue']);
    });
  });
});

describe('語りの場面', () => {
  const base = { id: 's', title: 't', backgroundAssetId: 'bg', narrated: true };
  const voice = { assetId: 'v', seconds: 2 };

  it('全行に音声があれば通り、 地の文の担当は要らない', () => {
    expect(DialogueSceneSchema.safeParse({ ...base, lines: [{ text: 'a', voice }] }).success).toBe(
      true,
    );
  });

  it('音声の無い行と話者のある行は弾く', () => {
    const result = DialogueSceneSchema.safeParse({
      ...base,
      lines: [{ text: 'a' }, { text: 'b', voice, speakerId: 'haru' }],
    });
    expect(result.success ? [] : result.error.issues.map((i) => i.path.join('.'))).toEqual([
      'lines.0.voice',
      'lines.1.speakerId',
    ]);
  });

  it('読み合わせの場面は地の文の担当が要る', () => {
    const { narrated: _, ...reading } = base;
    expect(DialogueSceneSchema.safeParse({ ...reading, lines: [{ text: 'a' }] }).success).toBe(
      false,
    );
  });
});

describe('アセット', () => {
  it('参照しているファイルが play の public に全部ある', () => {
    // BGM は配布元の規約でリポジトリに置けず、 手元にだけある (CLAUDE.md「アセット」)。
    const missing = data.assets
      .map((a: { path: string }) => a.path)
      .filter((path: string) => !/\/bgm-[^/]+\.mp3$/.test(path))
      .filter(
        (path: string) =>
          !existsSync(new URL(`../../play/public/${path.slice(2)}`, import.meta.url)),
      );
    expect(missing).toEqual([]);
  });
});
