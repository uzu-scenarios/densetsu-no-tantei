<script lang="ts">
/**
 * シナリオエディタの外枠。 3 ペイン構成:
 *   左   … コレクション一覧 (zod スキーマの COLLECTIONS 定義から)
 *   中央 … 選択中コレクションのエントリ一覧 (検索付き)
 *   右   … 選択中エントリのフォーム (Field が JSON Schema から自動生成)
 */

import { editorState, isDirty, loadScenario, saveScenario } from './lib/editor-state.svelte';
import Field from './lib/Field.svelte';
import {
  COLLECTIONS,
  type CollectionDef,
  dataAtPath,
  entryLabel,
  resolveNode,
  schemaAtPath,
} from './lib/schema-utils';

// 実体は editor-state.svelte.ts のモジュール $state (Field からの深い書き換えを正当にするため)
const scenario = $derived(editorState.scenario);
const loadError = $derived(editorState.loadError);
const saving = $derived(editorState.saving);
const saveMessage = $derived(editorState.saveMessage);
let selectedCollection = $state<CollectionDef>(COLLECTIONS[0]);
let selectedKey = $state<string | number | null>(null);
let filter = $state('');

function reload() {
  if (dirty && !window.confirm('未保存の変更を破棄して再読込しますか？')) return;
  void loadScenario();
}

const dirty = $derived(isDirty());

const collectionData = $derived(scenario ? dataAtPath(scenario, selectedCollection.path) : null);
const collectionSchema = $derived(schemaAtPath(selectedCollection.path));

const entries = $derived.by((): Array<{ key: string | number; label: string; id: string }> => {
  if (!scenario || collectionData == null) return [];
  if (selectedCollection.kind === 'array') {
    return (collectionData as any[]).map((entry, index) => ({
      key: index,
      id: String(entry?.id ?? index),
      label: entryLabel(entry) || String(index),
    }));
  }
  return [];
});

const filteredEntries = $derived(
  entries.filter(
    (entry) =>
      !filter ||
      entry.label.toLowerCase().includes(filter.toLowerCase()) ||
      entry.id.toLowerCase().includes(filter.toLowerCase()),
  ),
);

const entrySchema = $derived.by(() => {
  const node = resolveNode(collectionSchema);
  if (selectedCollection.kind === 'array') return node?.items;
  return collectionSchema;
});

function selectCollection(collection: CollectionDef) {
  selectedCollection = collection;
  selectedKey = collection.kind === 'object' ? '__self__' : null;
  filter = '';
}
</script>

<svelte:window
  onbeforeunload={(event) => {
    if (dirty) event.preventDefault();
  }}
/>

<div class="app">
  <header>
    <h1>{scenario?.settings?.title ?? 'シナリオエディタ'}</h1>
    <span class="sub">scenario.json{dirty ? ' — 未保存の変更あり' : ''}</span>
    <span class="spacer"></span>
    <button type="button" class="ghost" onclick={reload} disabled={saving}> 再読込 </button>
    <button
      type="button"
      class="primary"
      onclick={() => saveScenario()}
      disabled={!dirty || saving}
    >
      {saving ? '保存中…' : '保存'}
    </button>
  </header>

  {#if saveMessage}
    <div class="banner {saveMessage.kind}">
      {#each saveMessage.lines as line (line)}<div>{line}</div>{/each}
    </div>
  {/if}

  {#if loadError}
    <div class="banner error">{loadError}</div>
  {:else if !scenario}
    <div class="loading">読み込み中…</div>
  {:else}
    <div class="panes">
      <nav class="collections">
        {#each COLLECTIONS as collection (collection.key)}
          {@const data = dataAtPath(scenario, collection.path)}
          <button
            type="button"
            class:active={selectedCollection.key === collection.key}
            onclick={() => selectCollection(collection)}
          >
            {collection.label}
            <span class="count">
              {collection.kind === 'array' ? (data?.length ?? 0) : ''}
            </span>
          </button>
        {/each}
      </nav>

      {#if selectedCollection.kind !== 'object'}
        <nav class="entries">
          <input class="filter" placeholder="絞り込み…" bind:value={filter} />
          {#each filteredEntries as entry (entry.key)}
            <button
              type="button"
              class:active={selectedKey === entry.key}
              onclick={() => (selectedKey = entry.key)}
            >
              <span class="entry-label">{entry.label}</span>
              <span class="entry-id">{entry.id}</span>
            </button>
          {/each}
        </nav>
      {/if}

      <main class="detail">
        {#if selectedCollection.kind === 'object'}
          <Field
            container={dataAtPath(scenario, selectedCollection.path.slice(0, -1))}
            key={selectedCollection.path[selectedCollection.path.length - 1]}
            schema={collectionSchema}
            {scenario}
            label={selectedCollection.label}
          />
        {:else if selectedKey != null && collectionData?.[selectedKey] != null}
          <Field
            container={collectionData}
            key={selectedKey}
            schema={entrySchema}
            {scenario}
            label={`${selectedCollection.label}: ${
              entries.find((entry) => entry.key === selectedKey)?.label ?? selectedKey
            }`}
          />
        {:else}
          <div class="placeholder">左の一覧からエントリを選択してください</div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Hiragino Sans', 'Noto Sans JP', system-ui, sans-serif;
    background: #f3f0ea;
    color: #2e2a24;
  }
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: #26221c;
    color: #f3f0ea;
  }
  header h1 {
    font-size: 15px;
    margin: 0;
  }
  header .sub {
    font-size: 12px;
    opacity: 0.7;
  }
  .spacer {
    flex: 1;
  }
  button.primary,
  button.ghost {
    font: inherit;
    font-size: 13px;
    padding: 6px 16px;
    border-radius: 5px;
    cursor: pointer;
  }
  button.primary {
    background: #c8a24a;
    border: 1px solid #c8a24a;
    color: #26221c;
    font-weight: 600;
  }
  button.primary:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.ghost {
    background: transparent;
    border: 1px solid #6b6257;
    color: #f3f0ea;
  }
  .banner {
    padding: 8px 16px;
    font-size: 12px;
    white-space: pre-wrap;
  }
  .banner.ok {
    background: #e2efdd;
    color: #2c5424;
  }
  .banner.warn {
    background: #f6ecd4;
    color: #7a5c17;
  }
  .banner.error {
    background: #f4dcdc;
    color: #8c2626;
  }
  .loading,
  .placeholder {
    padding: 40px;
    color: #9a9284;
  }
  .panes {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  nav.collections {
    width: 180px;
    overflow-y: auto;
    border-right: 1px solid #ddd8cf;
    background: #eceade;
    padding: 8px 0;
    flex-shrink: 0;
  }
  nav.collections button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    font: inherit;
    font-size: 13px;
    padding: 7px 14px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #4c463e;
  }
  nav.collections button:hover {
    background: #e2dfd2;
  }
  nav.collections button.active {
    background: #26221c;
    color: #f3f0ea;
  }
  nav.collections .count {
    opacity: 0.55;
    font-size: 11px;
  }
  nav.entries {
    width: 260px;
    overflow-y: auto;
    border-right: 1px solid #ddd8cf;
    background: #f7f5ee;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }
  nav.entries .filter {
    margin: 8px;
    padding: 5px 8px;
    font: inherit;
    font-size: 13px;
    border: 1px solid #c9c3b8;
    border-radius: 4px;
  }
  nav.entries button {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    text-align: left;
    font: inherit;
    padding: 6px 12px;
    border: none;
    background: transparent;
    cursor: pointer;
  }
  nav.entries button:hover {
    background: #edeadf;
  }
  nav.entries button.active {
    background: #e0dccc;
  }
  .entry-label {
    font-size: 13px;
    color: #2e2a24;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry-id {
    font-size: 10px;
    color: #9a9284;
  }
  main.detail {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px 60px;
    min-width: 0;
  }
</style>
