<!--
  読み返し。 現在行までの台本を並べる (先の行は見せない)。
-->
<script lang="ts">
import type { DialogueLineView } from '../view/dialogue-view';
import Dialog from './Dialog.svelte';
import { localUi } from './local-ui.svelte';
import RichText from './RichText.svelte';

let { title, history }: { title: string; history: DialogueLineView[] } = $props();
</script>

<Dialog title={`読み返す　${title}`} onclose={() => localUi.close()}>
  <ol class="log">
    {#each history as entry (entry.index)}
      <li data-narration={entry.speaker ? null : 'narration'}>
        {#if entry.speaker}<strong>{entry.speaker.name}</strong>{/if}
        <div><RichText text={entry.line.text} /></div>
      </li>
    {/each}
  </ol>
</Dialog>

<style>
  .log {
    list-style: none;
    margin: 0;
    padding: 0;
    font-family: var(--font-read);
    line-height: 1.8;
  }

  .log li {
    padding: 0.5em 0;
    border-bottom: 0.06em dashed var(--rule-on-paper);
  }

  .log li[data-narration] {
    color: var(--text-on-paper-soft);
  }

  .log strong {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.1em;
  }
</style>
