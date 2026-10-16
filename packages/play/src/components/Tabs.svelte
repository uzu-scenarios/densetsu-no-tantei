<!--
  見出しの切り替え。 選択中は明度で立てる (主アクションの装飾は使わない)。
  新しいものがあるタブには小さな点 (滞留する印) が付く。
-->
<script lang="ts" generics="T extends string">
let {
  items,
  value,
  onchange,
}: {
  items: { id: T; label: string; fresh?: boolean }[];
  value: T;
  onchange: (id: T) => void;
} = $props();
</script>

<div class="tabs" role="tablist">
  {#each items as item (item.id)}
    <button
      class="tab"
      type="button"
      role="tab"
      aria-selected={item.id === value}
      data-selected={item.id === value ? 'selected' : null}
      data-testid={`tab-${item.id}`}
      onclick={() => onchange(item.id)}
    >
      {item.label}
      {#if item.fresh}<span class="fresh" aria-label="新しい情報"></span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.25em;
    flex-wrap: wrap;
  }

  .tab {
    position: relative;
    padding: 0.45em 0.95em;
    border-radius: var(--radius-s) var(--radius-s) 0 0;
    font-family: var(--font-hud);
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--text-on-cloth-faint);
    border-bottom: 0.14em solid transparent;
    transition: color var(--dur-quick) ease;
  }

  .tab[data-selected] {
    color: var(--text-on-cloth);
    border-bottom-color: var(--text-on-cloth);
  }

  .fresh {
    position: absolute;
    top: 0.35em;
    right: 0.3em;
    width: 0.45em;
    height: 0.45em;
    border-radius: 50%;
    background: var(--surface-paper-bright);
    box-shadow: 0 0 0.4em rgba(var(--sheet-rgb), 0.9);
  }
</style>
