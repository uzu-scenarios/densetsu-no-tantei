<!--
  全体議論。 入った瞬間に「何をする時間か」の案内を出し、 共通情報と見取り図を切り替えて
  使う。 共通情報は議論の途中で出来事 (EventLayer) として少しずつ出る。 議論は時間いっぱい
  続く (出来事が最後まで起きるように、 プレイヤーからは切り上げない)。
-->
<script lang="ts">
import type { DiscussionPhase } from '../lib/types';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import CluesPanel from './CluesPanel.svelte';
import EventLayer from './EventLayer.svelte';
import FloorMap from './FloorMap.svelte';
import { localUi } from './local-ui.svelte';
import RichText from './RichText.svelte';
import Tabs from './Tabs.svelte';
import { scenario, view } from './view-context.svelte';

let { phase }: { phase: DiscussionPhase } = $props();

type Tab = 'clues' | 'map';
let tab = $state<Tab>('clues');

const unseen = $derived(
  scenario.clues.some((clue) => view.revealedClues.has(clue.id) && !localUi.hasSeenClue(clue.id)),
);
const showGuide = $derived(Boolean(phase.guide) && !localUi.isGuideDismissed(phase.id));
</script>

<Backdrop assetId={scenario.settings.roomBackgroundAssetId} veil={0.72} />

<section class="discussion" data-testid="discussion-screen">
  <div class="toolbar">
    <Tabs
      items={[
        { id: 'clues', label: '共通情報', fresh: unseen },
        { id: 'map', label: '見取り図' },
      ]}
      value={tab}
      onchange={(id) => (tab = id)}
    />
  </div>

  <div class="pane">
    {#if tab === 'clues'}
      <CluesPanel />
    {:else}
      <FloorMap />
    {/if}
  </div>


  <EventLayer />

  {#if showGuide && phase.guide}
    <div class="guide" role="dialog" aria-label={phase.guide.heading} data-testid="phase-guide">
      <h3>{phase.guide.heading}</h3>
      <div class="guide-body"><RichText text={phase.guide.body} /></div>
      <div class="guide-actions">
        <Button variant="primary" testid="guide-close" onclick={() => localUi.dismissGuide(phase.id)}>はじめる</Button>
      </div>
    </div>
  {/if}
</section>

<style>
  .discussion {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.4em;
    padding: 0.2em 1em 0.6em;
    min-height: 0;
  }

  .pane {
    min-height: 0;
  }

  .guide {
    position: absolute;
    z-index: var(--z-dialog);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(32em, 92%);
    display: grid;
    gap: 0.8em;
    justify-items: start;
    padding: 1.2em 1.5em;
    border-radius: var(--radius-m);
    background: var(--surface-paper);
    color: var(--text-on-paper);
    box-shadow:
      0 0 0 100vmax var(--scrim),
      var(--shadow-lift);
    animation: rise var(--dur-base) var(--ease-out) 1.6s both;
  }

  .guide h3 {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.25em;
    letter-spacing: 0.14em;
  }

  .guide-body {
    font-family: var(--font-read);
    line-height: 1.85;
  }

  .guide-actions {
    justify-self: end;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, -46%);
    }
  }
</style>
