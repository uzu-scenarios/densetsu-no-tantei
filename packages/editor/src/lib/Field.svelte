<script lang="ts">
/**
 * JSON Schema 1 ノード分の入力欄。 object / array は自分自身を再帰して描く。
 * 値は $state プロキシの container[key] を直接書き換える (App 側で deep reactive)。
 *
 * 汎用ルール:
 * - refTarget があれば参照候補のドロップダウン、 なければ型どおりの入力欄
 * - enum はドロップダウン、 const / id は読み取り専用
 * - optional フィールドは「追加 / 削除」で持つ・持たないを切り替える
 */
import { removeProp, setProp } from './editor-state.svelte';
import Field from './Field.svelte';
import { jaFieldLabel } from './field-labels';
import {
  emptyValue,
  isLongText,
  type JsonSchemaNode,
  refCandidates,
  refTargetOf,
  resolveNode,
  resolveVariant,
  resolveWithOwnTitle,
} from './schema-utils';

interface Props {
  container: any;
  key: string | number;
  schema: JsonSchemaNode | undefined;
  scenario: any;
  label?: string;
  depth?: number;
  removable?: boolean;
  onremove?: () => void;
}

// container は「この中の key を書き換えてよい」契約で受け取る (フォームの本質が
// 選択ノードの in-place 編集のため)。 書き換えは editor-state の setProp / removeProp
// を必ず通す (component 内で props 由来の値へ直接代入すると svelte dev の
// ownership_invalid_mutation 警告に計装されるため)。
const {
  container,
  key,
  schema,
  scenario,
  label = '',
  depth = 0,
  removable = false,
  onremove,
}: Props = $props();

const value = $derived(container?.[key]);
const resolved = $derived(resolveWithOwnTitle(schema));
const node = $derived(resolveVariant(resolved, value));
const refTarget = $derived(refTargetOf(schema));
const displayLabel = $derived(label || node?.title || jaFieldLabel(key) || String(key));
const readonlyField = $derived(key === 'id' || node?.const !== undefined);

const kind = $derived.by((): string => {
  if (!node) return 'json';
  if (refTarget) return 'ref';
  if (Array.isArray(node.enum)) return 'enum';
  if (node.const !== undefined) return 'const';
  switch (node.type) {
    case 'string':
      return isLongText(node) ? 'textarea' : 'text';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return node.properties ? 'object' : 'record';
    default:
      return 'json';
  }
});

// --- discriminated union (phase / 条件 / action の結果) の型の切り替え ---
// 判別 field は const なので素の入力欄では変えられない。 枝ごとの const を集めて選ばせる。
const variants = $derived.by(() => {
  const branches = resolved?.oneOf as JsonSchemaNode[] | undefined;
  if (!Array.isArray(branches)) return null;
  const options = branches
    .map((raw) => resolveNode(raw))
    .flatMap((branch) => {
      const entry = Object.entries<JsonSchemaNode>(branch?.properties ?? {}).find(
        ([, prop]) => resolveNode(prop)?.const !== undefined,
      );
      return entry && branch
        ? [{ field: entry[0], value: String(resolveNode(entry[1])?.const), branch }]
        : [];
    });
  return options.length === branches.length ? options : null;
});
const variantField = $derived(variants?.[0]?.field ?? null);

function switchVariant(raw: string) {
  const option = variants?.find((entry) => entry.value === raw);
  if (!option || value?.[option.field] === raw) return;
  const next = emptyValue(option.branch) as Record<string, unknown>;
  // 両方の枝にある欄 (id / title など) は持ち越す。 型を変えただけで書いた値を失わせない。
  for (const propKey of Object.keys(option.branch.properties ?? {})) {
    if (propKey !== option.field && value && propKey in value) next[propKey] = value[propKey];
  }
  setProp(container, key, next);
}

// --- object 用: 存在しない optional フィールドの追加 ---
let addFieldKey = $state('');
const objectProps = $derived(
  kind === 'object'
    ? Object.entries<JsonSchemaNode>(node?.properties ?? {}).filter(
        ([propKey]) => propKey !== variantField,
      )
    : [],
);
const requiredKeys = $derived(new Set<string>((node?.required as string[] | undefined) ?? []));
// この object に「今ある」キー集合。 Object.keys は Svelte proxy の ownKeys を読むので、
// optional フィールドを追加/削除した瞬間にこの $derived が再計算される。
// (Object.hasOwn や hasOwnProperty で「存在しないキー」を判定すると proxy が依存を張らず、
//  追加しても再描画されない不具合になる。 だからキー集合ごと購読する。)
const presentKeys = $derived(new Set<string>(Object.keys(value ?? {})));
// 現在この object に存在するプロパティだけを描画対象にする (追加した瞬間に増える)。
const presentProps = $derived(objectProps.filter(([propKey]) => presentKeys.has(propKey)));
const absentOptionalKeys = $derived(
  objectProps
    .map(([propKey]) => propKey)
    .filter((propKey) => !requiredKeys.has(propKey) && !presentKeys.has(propKey)),
);

function addOptionalField() {
  if (!addFieldKey || value == null) return;
  setProp(value, addFieldKey, emptyValue(node?.properties?.[addFieldKey]));
  addFieldKey = '';
}

function removeOptionalField(propKey: string) {
  if (value == null) return;
  removeProp(value, propKey);
}

// --- array 用 ---
function addItem() {
  if (!Array.isArray(value)) return;
  value.push(emptyValue(node?.items));
}

function removeItem(index: number) {
  if (!Array.isArray(value)) return;
  value.splice(index, 1);
}

// --- record 用 ---
let newRecordKey = $state('');
function addRecordEntry() {
  if (!newRecordKey || value == null || newRecordKey in value) return;
  setProp(value, newRecordKey, emptyValue(node?.additionalProperties));
  newRecordKey = '';
}

function setNumber(raw: string) {
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) setProp(container, key, parsed);
}

function setRef(raw: string) {
  setProp(container, key, raw);
}

// --- アセット参照フィールド用: 選択中エントリが画像ならプレビューを出す ---
// アップロードはしない (保存先は制作者が assets/ に置いた実ファイルのみ)。
const assetEntry = $derived.by(() => {
  if (refTarget !== 'assets' || !value) return null;
  return (scenario?.assets as any[] | undefined)?.find((entry) => entry?.id === value) ?? null;
});
</script>

{#if kind === 'object'}
  <fieldset class="group" style:--depth={depth}>
    <legend>{displayLabel}{#if removable}<button
          type="button"
          class="mini danger"
          onclick={onremove}>削除</button>{/if}</legend>
    {#if value == null}
      <div class="empty">未設定</div>
    {:else}
      {#if variants && variantField}
        {@const currentVariant = variants.find((entry) => value?.[entry.field] === entry.value)}
        <label class="row">
          <span class="name" title={variantField}>
            {resolveNode(node?.properties?.[variantField])?.title ??
              jaFieldLabel(variantField) ??
              variantField}
          </span>
          <select
            value={currentVariant?.value ?? ''}
            onchange={(e) => switchVariant(e.currentTarget.value)}
          >
            {#if !currentVariant}<option value="">（選択）</option>{/if}
            {#each variants as option (option.value)}
              <option value={option.value}>{option.value}</option>
            {/each}
          </select>
        </label>
      {/if}
      {#each presentProps as [propKey, propSchema] (propKey)}
        <Field
          container={value}
          key={propKey}
          schema={propSchema}
          {scenario}
          depth={depth + 1}
          removable={!requiredKeys.has(propKey)}
          onremove={() => removeOptionalField(propKey)}
        />
      {/each}
      {#if absentOptionalKeys.length > 0}
        <div class="add-row">
          <select bind:value={addFieldKey}>
            <option value="">フィールドを追加…</option>
            {#each absentOptionalKeys as propKey (propKey)}
              {@const propLabel =
                resolveNode(node?.properties?.[propKey])?.title ?? jaFieldLabel(propKey)}
              <option value={propKey}>
                {propLabel ? `${propLabel}（${propKey}）` : propKey}
              </option>
            {/each}
          </select>
          <button type="button" class="mini" onclick={addOptionalField} disabled={!addFieldKey}>
            追加
          </button>
        </div>
      {/if}
    {/if}
  </fieldset>
{:else if kind === 'array'}
  <fieldset class="group" style:--depth={depth}>
    <legend>{displayLabel} ({Array.isArray(value) ? value.length : 0})
      {#if removable}<button type="button" class="mini danger" onclick={onremove}>削除</button>{/if}
    </legend>
    {#if Array.isArray(value)}
      {#each value as _, index (index)}
        <Field
          container={value}
          key={index}
          schema={node?.items}
          {scenario}
          label={`${displayLabel} [${index}]`}
          depth={depth + 1}
          removable
          onremove={() => removeItem(index)}
        />
      {/each}
      <div class="add-row">
        <button type="button" class="mini" onclick={addItem}>+ 追加</button>
      </div>
    {:else}
      <div class="empty">未設定</div>
    {/if}
  </fieldset>
{:else if kind === 'record'}
  <fieldset class="group" style:--depth={depth}>
    <legend>{displayLabel}
      {#if removable}<button type="button" class="mini danger" onclick={onremove}>削除</button>{/if}
    </legend>
    {#if value != null}
      {#each Object.keys(value) as entryKey (entryKey)}
        <Field
          container={value}
          key={entryKey}
          schema={node?.additionalProperties}
          {scenario}
          depth={depth + 1}
          removable
          onremove={() => removeProp(value, entryKey)}
        />
      {/each}
      <div class="add-row">
        <input placeholder="新しいキー" bind:value={newRecordKey} />
        <button type="button" class="mini" onclick={addRecordEntry} disabled={!newRecordKey}>
          追加
        </button>
      </div>
    {:else}
      <div class="empty">未設定</div>
    {/if}
  </fieldset>
{:else}
  <label class="row" class:wide={kind === 'textarea'}>
    <span class="name" title={String(key)}>
      {displayLabel}
      {#if removable}<button type="button" class="mini danger" onclick={onremove}>×</button>{/if}
    </span>
    {#if kind === 'ref'}
      {@const candidates = refCandidates(scenario, refTarget ?? '')}
      {@const known = candidates.some((candidate) => candidate.id === value)}
      <span class="ref-control">
        <select value={value ?? ''} onchange={(e) => setRef(e.currentTarget.value)}>
          <option value="">（なし）</option>
          {#if !known && value}
            <option value={value}>⚠ {value} (存在しない ID)</option>
          {/if}
          {#each candidates as candidate (candidate.id)}
            <option value={candidate.id}>{candidate.label} — {candidate.id}</option>
          {/each}
        </select>
        {#if assetEntry?.kind === 'image'}
          <img
            class="asset-preview"
            src={`/api/asset?path=${encodeURIComponent(assetEntry.path)}`}
            alt={assetEntry.name}
          />
        {/if}
      </span>
    {:else if kind === 'enum'}
      <select
        value={value ?? ''}
        onchange={(e) => {
          setProp(container, key, e.currentTarget.value);
        }}
      >
        {#if value == null}<option value="">（未設定）</option>{/if}
        {#each node?.enum ?? [] as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    {:else if kind === 'boolean'}
      <input
        type="checkbox"
        checked={Boolean(value)}
        onchange={(e) => {
          setProp(container, key, e.currentTarget.checked);
        }}
      />
    {:else if kind === 'number'}
      <input
        type="number"
        step="any"
        value={value ?? ''}
        onchange={(e) => setNumber(e.currentTarget.value)}
      />
    {:else if kind === 'textarea'}
      <textarea
        rows={Math.min(12, Math.max(3, String(value ?? '').split('\n').length + 1))}
        value={value ?? ''}
        oninput={(e) => {
          setProp(container, key, e.currentTarget.value);
        }}
      ></textarea>
    {:else if kind === 'const' || readonlyField}
      <input value={value ?? ''} readonly class="readonly" />
    {:else if kind === 'text'}
      <input
        value={value ?? ''}
        readonly={readonlyField}
        class:readonly={readonlyField}
        oninput={(e) => {
          setProp(container, key, e.currentTarget.value);
        }}
      />
    {:else}
      <textarea
        rows="4"
        value={JSON.stringify(value, null, 1) ?? ''}
        onchange={(e) => {
          try {
            setProp(container, key, JSON.parse(e.currentTarget.value));
          } catch {
            /* 不正な JSON は無視 (保存時に検証で気付ける) */
          }
        }}
      ></textarea>
    {/if}
  </label>
{/if}

<style>
  .group {
    border: 1px solid #d8d4cc;
    border-radius: 6px;
    margin: 8px 0;
    padding: 8px 10px;
    background: color-mix(in srgb, #faf8f4 calc(100% - var(--depth) * 4%), #ece7de);
  }
  .group > legend {
    font-size: 12px;
    font-weight: 600;
    color: #6b6257;
    padding: 0 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 8px;
    align-items: start;
    margin: 4px 0;
  }
  .row .name {
    font-size: 12px;
    color: #4c463e;
    padding-top: 5px;
    word-break: break-all;
  }
  input,
  select,
  textarea {
    font: inherit;
    font-size: 13px;
    padding: 4px 6px;
    border: 1px solid #c9c3b8;
    border-radius: 4px;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
  }
  .ref-control {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .ref-control select {
    flex: 1;
    min-width: 0;
  }
  .asset-preview {
    height: 40px;
    width: auto;
    max-width: 80px;
    object-fit: contain;
    border: 1px solid #c9c3b8;
    border-radius: 4px;
    background: #fff;
    flex: none;
  }
  input[type='checkbox'] {
    width: auto;
    justify-self: start;
    margin-top: 6px;
  }
  textarea {
    resize: vertical;
    line-height: 1.5;
  }
  .readonly {
    background: #f0ede7;
    color: #8a8378;
  }
  .empty {
    font-size: 12px;
    color: #9a9284;
    padding: 2px 0;
  }
  .add-row {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .add-row select,
  .add-row input {
    max-width: 280px;
  }
  .mini {
    font-size: 11px;
    padding: 2px 8px;
    border: 1px solid #c9c3b8;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    margin-left: 6px;
  }
  .mini:hover {
    background: #f0ede7;
  }
  .mini.danger {
    color: #a33;
    border-color: #d9b8b8;
  }
  .mini:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
