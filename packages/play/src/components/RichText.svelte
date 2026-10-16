<!--
  本文の記法 (**強調** / 漢字(かな) / 〈場所〉 / 改行) を描く。 {@html} は使わない。
-->
<script lang="ts">
import { parseRichText } from '../view/rich-text';

let { text }: { text: string } = $props();
const paragraphs = $derived(parseRichText(text));
</script>

{#each paragraphs as paragraph}
  <span class="paragraph">
    {#each paragraph as line}
      <span class="line">
        {#each line as part}
          {#if part.kind === 'ruby'}
            <ruby data-strong={part.strong ? 'strong' : null}>{part.base}<rt>{part.reading}</rt></ruby>
          {:else if part.kind === 'place'}
            <span class="place" data-strong={part.strong ? 'strong' : null}>{part.text}</span>
          {:else}
            <span data-strong={part.strong ? 'strong' : null}>{part.text}</span>
          {/if}
        {/each}
      </span>
    {/each}
  </span>
{/each}

<style>
  .paragraph {
    display: block;
  }

  .paragraph + .paragraph {
    margin-top: 0.9em;
  }

  .line {
    display: block;
    min-height: 1em;
  }

  [data-strong] {
    font-weight: 800;
  }

  .place {
    display: inline-block;
    padding: 0 0.35em;
    margin: 0 0.1em;
    border: 0.06em solid currentColor;
    border-radius: 0.2em;
    font-family: var(--font-hud);
    font-size: 0.86em;
    line-height: 1.35;
    vertical-align: 0.06em;
  }
</style>
