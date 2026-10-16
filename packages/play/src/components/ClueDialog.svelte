<!--
  共通情報 1 枚の詳細。 画像・本文と、 関わる場所を光らせた小さな見取り図。
-->
<script lang="ts">
import { cssUrl } from '../platform/asset-url';
import { getClue } from '../scenario/lookup';
import Dialog from './Dialog.svelte';
import Face from './Face.svelte';
import FloorMap from './FloorMap.svelte';
import { localUi } from './local-ui.svelte';
import RichText from './RichText.svelte';
import { scenario, view } from './view-context.svelte';

let { clueId }: { clueId: string } = $props();
const clue = $derived(getClue(scenario, clueId));
</script>

{#if clue}
  <Dialog title={clue.title} onclose={() => localUi.close()} wide={Boolean(clue.placeIds?.length)}>
    <div class="detail" data-has-map={clue.placeIds?.length ? 'map' : null}>
      <div class="body">
        {#if clue.imageAssetId}
          <span class="image" style:--image={cssUrl(clue.imageAssetId)}></span>
        {:else if clue.speakerId}
          <span class="speaker"><Face speakerId={clue.speakerId} /></span>
        {/if}
        <div class="prose"><RichText text={view.clueBody(clue)} /></div>
      </div>
      {#if clue.placeIds?.length}
        <div class="mini-map">
          <FloorMap highlight={clue.placeIds} compact />
        </div>
      {/if}
    </div>
  </Dialog>
{/if}

<style>
  .detail {
    display: grid;
    gap: 1em;
  }

  .detail[data-has-map] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  }

  .body {
    display: grid;
    gap: 0.8em;
    align-content: start;
  }

  .image {
    width: 100%;
    max-width: 16em;
    aspect-ratio: 1;
    border-radius: var(--radius-m);
    background: var(--image) center / cover no-repeat;
    justify-self: center;
  }

  .speaker {
    --face-size: 4em;
  }

  .prose {
    font-family: var(--font-read);
    font-weight: 500;
    font-size: 1.08em;
    line-height: 1.9;
    letter-spacing: 0.04em;
  }

  .mini-map {
    min-height: 16em;
    padding: 0.6em;
    border-radius: var(--radius-m);
    background: var(--surface-cloth);
    color: var(--text-on-cloth);
  }
</style>
