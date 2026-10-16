import { OutcomeConditionSchema, PhaseSchema } from '@scenario/data/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  emptyValue,
  type JsonSchemaNode,
  pruneAbsentOptionals,
  refCandidates,
  resolveVariant,
  scenarioJsonSchema,
} from '../src/lib/schema-utils';

const jsonSchemaOf = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input' }) as unknown as JsonSchemaNode;

describe('discriminated union の「+ 追加」', () => {
  it('判定条件は先頭の型で、 参照先を選べば schema を満たす形で作る', () => {
    // 参照は選ぶまで空で、 空のままでは保存できない (未設定は欄ごと書かない取り決め)。
    const value = emptyValue(jsonSchemaOf(OutcomeConditionSchema)) as Record<string, unknown>;
    expect(value).toMatchObject({ type: 'top', roleId: '' });
    expect(OutcomeConditionSchema.safeParse(value).success).toBe(false);
    expect(OutcomeConditionSchema.safeParse({ ...value, roleId: 'role_x' }).success).toBe(true);
  });

  it('フェーズも先頭の型で作り、 その型の欄へ畳める', () => {
    const node = jsonSchemaOf(PhaseSchema);
    const value = emptyValue(node) as Record<string, unknown>;
    expect(value.type).toBe('dialogue');
    expect(Object.keys(resolveVariant(node, value)?.properties ?? {})).toContain('sceneId');
  });
});

describe('refTarget の解決', () => {
  const scenario = {
    roles: [{ id: 'role_a', name: 'アキ' }],
    npcs: [{ id: 'npc_a', name: '刑事' }],
  };

  it('speakers は roles と npcs の和集合 (実体を持たない virtual target)', () => {
    expect(refCandidates(scenario, 'speakers')).toEqual([
      { id: 'role_a', label: 'アキ' },
      { id: 'npc_a', label: '刑事' },
    ]);
  });

  it('roles はそのまま COLLECTIONS のコレクションから拾う', () => {
    expect(refCandidates(scenario, 'roles')).toEqual([{ id: 'role_a', label: 'アキ' }]);
  });
});

describe('保存前に「無い」を欠落へ畳む', () => {
  it('optional な欄の空文字を落とし、 必須の欄は残す', () => {
    const scenario = {
      places: [{ id: 'p', label: 'ロビー', x: 0, y: 0, w: 1, h: 1 }],
      npcs: [{ id: 'n', name: 'NPC', portraitAssetId: '' }],
    };
    expect(pruneAbsentOptionals(scenario, scenarioJsonSchema())).toEqual({
      places: [{ id: 'p', label: 'ロビー', x: 0, y: 0, w: 1, h: 1 }],
      npcs: [{ id: 'n', name: 'NPC' }],
    });
  });
});
