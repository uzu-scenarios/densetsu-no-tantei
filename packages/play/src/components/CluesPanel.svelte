<!--
  共通情報の一覧。 現場・持ち物・証言に分けて札を並べる。 まだ出ていない情報は空き札で
  枚数だけを見せる。 出たばかりの札は浮き出て、 まだ開いていない札には小さな点
  (滞留する印) が付き、 開くと消える。
-->
<script lang="ts">
import type { ClueCategory } from '../lib/types';
import { cssUrl } from '../platform/asset-url';
import { getSpeaker } from '../scenario/lookup';
import { plainText } from '../view/rich-text';
import Face from './Face.svelte';
import { localUi } from './local-ui.svelte';
import { scenario, view } from './view-context.svelte';

const order: ClueCategory[] = ['scene', 'belongings', 'testimony'];
const groups = order.map((id) => ({ id, ...scenario.settings.clueCategories[id] }));
</script>

<div class="clues" data-testid="clues-panel">
  {#each groups as group (group.id)}
    <section class="group">
      <h3>{group.label}</h3>
      <div class="cards">
        {#each scenario.clues.filter((c) => c.category === group.id) as clue (clue.id)}
          {#if !view.revealedClues.has(clue.id)}
            <div class="slot"><i>？</i>{group.pending}</div>
          {:else}
          <button
            type="button"
            class="card"
            data-testid={`clue-${clue.id}`}
            onclick={() => localUi.open({ kind: 'clue', clueId: clue.id })}
          >
            {#if clue.imageAssetId}
              <span class="thumb" style:--image={cssUrl(clue.imageAssetId)}></span>
            {:else if clue.speakerId}
              <span class="thumb face"><Face speakerId={clue.speakerId} /></span>
            {/if}
            <span class="text">
              <strong>{clue.title}</strong>
              <span class="lead">{plainText(view.clueBody(clue)).split('\n')[0]}</span>
            </span>
            {#if clue.category === 'belongings' && clue.speakerId}
              <span class="owner"><Face speakerId={clue.speakerId} /></span>
            {/if}
            {#if !localUi.hasSeenClue(clue.id)}<span class="fresh" aria-label="まだ開いていない"></span>{/if}
          </button>
          {/if}
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  /* 現場・持ち物・証言を横に 3 列並べ、 10 枚を 1 画面に収める (縦に積むと証言が画面外へ落ちる)。 */
  .clues {
    height: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8em;
    align-content: start;
  }

  .group {
    min-height: 0;
  }

  h3 {
    margin-bottom: 0.35em;
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.24em;
    font-size: 0.92em;
    color: var(--text-on-cloth-muted);
  }

  .cards {
    display: grid;
    gap: 0.4em;
  }

  .slot {
    display: flex;
    align-items: center;
    gap: 0.55em;
    padding: 0.35em;
    border-radius: var(--radius-m);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
    font-size: 0.82em;
    color: var(--text-on-cloth-faint);
  }

  .slot i {
    display: grid;
    place-items: center;
    width: 3.5em;
    aspect-ratio: 1;
    border-radius: var(--radius-s);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
    font-style: normal;
    font-size: 0.83em;
  }

  .card {
    position: relative;
    animation: arrive 900ms var(--ease-out) both;
    display: flex;
    align-items: center;
    gap: 0.55em;
    padding: 0.35em 1em 0.35em 0.35em;
    text-align: left;
    border-radius: var(--radius-m);
    background: var(--surface-paper);
    color: var(--text-on-paper);
    box-shadow: var(--shadow-paper);
    transition: transform var(--dur-quick) var(--ease-out);
  }

  .card:active {
    transform: scale(0.98);
  }

  .thumb {
    flex: none;
    width: 2.9em;
    aspect-ratio: 1;
    border-radius: var(--radius-s);
    background: var(--image) center / cover no-repeat;
  }

  .thumb.face {
    display: grid;
    place-items: center;
    background: var(--surface-cloth);
    --face-size: 2.4em;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.1em;
  }

  strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.94em;
    letter-spacing: 0.04em;
    line-height: 1.3;
  }

  .lead {
    font-family: var(--font-read);
    font-size: 0.76em;
    line-height: 1.45;
    color: var(--text-on-paper-muted);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .owner {
    margin-left: auto;
    --face-size: 1.5em;
  }

  .fresh {
    position: absolute;
    top: 0.4em;
    right: 0.4em;
    width: 0.55em;
    height: 0.55em;
    border-radius: 50%;
    background: var(--accent-cloth);
    box-shadow: 0 0 0 0.15em var(--surface-paper-bright);
  }

  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(-0.5em) scale(1.04);
    }
  }
</style>
