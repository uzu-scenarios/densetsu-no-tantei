<!--
  翌日の朝刊。 タイトル回収の見出しを紙面ごと広げる。 見出しに鉤括弧の題名が
  含まれていれば、 その部分を題字と同じ組みで強調する (『“伝説の探偵”殺人事件』)。
-->
<script lang="ts">
import { scenario } from './view-context.svelte';

let { label, headline }: { label: string; headline: string } = $props();

const title = scenario.settings.title;
const parts = $derived.by(() => {
  const at = headline.indexOf(title);
  if (at < 0) return { before: headline, title: '', after: '' };
  return {
    before: headline.slice(0, at),
    title,
    after: headline.slice(at + title.length),
  };
});
</script>

<div class="paper" data-testid="newspaper" aria-label={`${label}：${headline}`}>
  <div class="masthead">
    <span class="label">{label}</span>
    <span class="rule"></span>
  </div>
  <h2 class="headline">
    {parts.before}<span class="title">{parts.title}</span>{parts.after}
  </h2>
  <div class="columns" aria-hidden="true">
    {#each Array(12) as _, i}
      <span style:width={`${62 + ((i * 37) % 36)}%`}></span>
    {/each}
  </div>
</div>

<style>
  .paper {
    grid-row: 2;
    align-self: center;
    justify-self: center;
    z-index: var(--z-plate);
    width: min(40em, 88%);
    padding: 1em 1.6em 1.2em;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(var(--sheet-rgb), 1), rgba(var(--sheet-rgb), 0.9)),
      var(--surface-paper-sunk);
    color: var(--text-on-paper);
    box-shadow: var(--shadow-lift);
    transform: rotate(-2.2deg);
    animation: unfold 900ms var(--ease-out) both;
  }

  @keyframes unfold {
    0% {
      opacity: 0;
      transform: rotate(-14deg) scale(0.4);
    }
    70% {
      transform: rotate(-1.4deg) scale(1.03);
    }
  }

  .masthead {
    display: flex;
    align-items: center;
    gap: 0.8em;
    border-bottom: 0.2em double var(--text-on-paper);
    padding-bottom: 0.3em;
  }

  .label {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.3em;
  }

  .rule {
    flex: 1;
    height: 0.06em;
    background: var(--rule-on-paper-strong);
  }

  .headline {
    margin: 0.5em 0 0.6em;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.8em;
    line-height: 1.35;
    letter-spacing: 0.02em;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .title {
    display: inline;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    padding: 0 0.15em;
    background: var(--text-on-paper);
    color: var(--surface-paper);
  }

  .columns {
    columns: 3;
    column-gap: 1em;
  }

  .columns span {
    display: block;
    height: 0.34em;
    margin-bottom: 0.45em;
    background: var(--rule-on-paper);
    border-radius: 0.1em;
  }
</style>
