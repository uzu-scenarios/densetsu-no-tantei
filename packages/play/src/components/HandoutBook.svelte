<!--
  手帳 (個別情報)。 紙の上に置く中身だけを持ち、 台紙は呼ぶ側が持つ。
  章ごとにめくる (背景 → 行動 → 目標 → 持ち物と人物)。 残量が見えるよう章の札に番号を振る。
-->
<script lang="ts">
import type { Role } from '../lib/types';
import { getRole } from '../scenario/lookup';
import Face from './Face.svelte';
import RichText from './RichText.svelte';
import { scenario } from './view-context.svelte';

let { role, onpage }: { role: Role; onpage?: (index: number, total: number) => void } = $props();

const pages = [
  { id: 'background', label: '背景' },
  { id: 'beats', label: '行動' },
  { id: 'missions', label: '目標' },
  { id: 'items', label: '持ち物と人物' },
] as const;

let pageIndex = $state(0);
let scroller = $state<HTMLElement | null>(null);

function go(index: number) {
  pageIndex = Math.max(0, Math.min(pages.length - 1, index));
  scroller?.scrollTo({ top: 0 });
  onpage?.(pageIndex, pages.length);
}

const page = $derived(pages[pageIndex].id);
const total = $derived(role.missions.reduce((sum, m) => sum + m.points, 0));
</script>

<div class="book" data-testid="handout-book">
  <nav class="index" aria-label="手帳の章">
    {#each pages as entry, i (entry.id)}
      <button
        type="button"
        class="index-tab"
        data-selected={i === pageIndex ? 'selected' : null}
        data-done={i < pageIndex ? 'done' : null}
        onclick={() => go(i)}
      >
        <span class="num">{i + 1}</span>{entry.label}
      </button>
    {/each}
  </nav>

  <div class="page" bind:this={scroller}>
    {#if page === 'background'}
      {#if role.handout.headline}
        <p class="headline">{role.handout.headline}</p>
      {/if}
      <div class="prose"><RichText text={role.handout.background} /></div>
    {:else if page === 'beats'}
      <ol class="beats">
        {#each role.handout.beats as beat}
          <li>
            <span class="time">{beat.time}</span>
            <div class="prose"><RichText text={beat.body} /></div>
          </li>
        {/each}
      </ol>
    {:else if page === 'missions'}
      <p class="missions-total">満点 {total} 点</p>
      <ul class="missions">
        {#each role.missions as mission}
          <li>
            <h4><span class="pts">{mission.points}点</span>{mission.title}</h4>
            <div class="prose"><RichText text={mission.body} /></div>
          </li>
        {/each}
      </ul>
    {:else}
      <h4 class="sub">持ち物</h4>
      {#each role.handout.items as item}
        <div class="item">
          <strong>{item.name}</strong>
          <div class="prose"><RichText text={item.body} /></div>
        </div>
      {/each}
      <h4 class="sub">ほかの二人について</h4>
      {#each role.handout.acquaintances as person}
        <div class="person">
          <Face speakerId={person.roleId} />
          <div>
            <strong>{person.label}（{getRole(scenario, person.roleId)?.name}）</strong>
            <div class="prose"><RichText text={person.body} /></div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <footer class="turn">
    <button type="button" class="turn-btn" disabled={pageIndex === 0} onclick={() => go(pageIndex - 1)}>‹ 前の章</button>
    <span class="folio">{pageIndex + 1} / {pages.length}</span>
    <button type="button" class="turn-btn" disabled={pageIndex === pages.length - 1} onclick={() => go(pageIndex + 1)}>次の章 ›</button>
  </footer>
</div>

<style>
  .book {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    min-height: 0;
    color: var(--text-on-paper);
  }

  .index {
    display: flex;
    gap: 0.2em;
    border-bottom: 0.08em solid var(--rule-on-paper);
    padding: 0 0.6em;
  }

  .index-tab {
    padding: 0.55em 0.8em 0.45em;
    font-family: var(--font-hud);
    font-weight: 700;
    font-size: 0.92em;
    letter-spacing: 0.1em;
    color: var(--text-on-paper-muted);
    border-bottom: 0.16em solid transparent;
    margin-bottom: -0.08em;
  }

  .index-tab[data-selected] {
    color: var(--text-on-paper);
    border-bottom-color: var(--text-on-paper);
  }

  .num {
    font-family: var(--font-figure);
    font-size: 1.1em;
    margin-right: 0.3em;
  }

  .index-tab[data-done] .num::after {
    content: '✓';
    font-size: 0.7em;
    margin-left: 0.1em;
  }

  .page {
    overflow-y: auto;
    padding: 1em 1.4em 1.2em;
    font-family: var(--font-read);
    font-weight: 500;
    font-size: 1.06em;
    line-height: 1.85;
    letter-spacing: 0.04em;
    user-select: text;
    -webkit-user-select: text;
  }

  .headline {
    margin-bottom: 0.9em;
    padding: 0.5em 0.9em;
    border-left: 0.25em solid var(--heat);
    background: var(--surface-paper-sunk);
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .beats {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .beats li {
    display: grid;
    grid-template-columns: 3.6em 1fr;
    gap: 0.9em;
    padding: 0.6em 0;
    border-bottom: 0.06em dashed var(--rule-on-paper);
  }

  .time {
    font-family: var(--font-figure);
    font-weight: 700;
    font-size: 1.25em;
    line-height: 1.5;
    font-variant-numeric: lining-nums tabular-nums;
  }

  .missions-total {
    font-family: var(--font-hud);
    font-size: 0.86em;
    letter-spacing: 0.14em;
    color: var(--text-on-paper-muted);
  }

  .missions {
    list-style: none;
    margin: 0.4em 0 0;
    padding: 0;
    display: grid;
    gap: 0.9em;
  }

  .missions h4 {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .pts {
    display: inline-block;
    margin-right: 0.6em;
    padding: 0 0.5em;
    border-radius: var(--radius-s);
    background: var(--text-on-paper);
    color: var(--surface-paper);
    font-family: var(--font-hud);
    font-size: 0.82em;
  }

  .sub {
    margin: 0.4em 0 0.3em;
    font-family: var(--font-hud);
    font-weight: 700;
    font-size: 0.82em;
    letter-spacing: 0.2em;
    color: var(--text-on-paper-muted);
  }

  .item,
  .person {
    margin-bottom: 0.8em;
  }

  .person {
    display: flex;
    gap: 0.8em;
    align-items: flex-start;
    --face-size: 2.6em;
  }

  .turn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4em 0.8em;
    border-top: 0.08em solid var(--rule-on-paper);
    font-family: var(--font-hud);
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .turn-btn {
    padding: 0.35em 0.7em;
    color: var(--text-on-paper);
  }

  .turn-btn:disabled {
    color: var(--rule-on-paper-strong);
  }

  .folio {
    font-family: var(--font-figure);
    font-size: 1.1em;
    color: var(--text-on-paper-muted);
  }
</style>
