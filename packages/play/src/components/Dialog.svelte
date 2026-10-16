<!--
  画面の上に開く紙の札 (手がかりの詳細・読み返し・人物一覧)。 背景を押すか × で閉じる。
-->
<script lang="ts">
import type { Snippet } from 'svelte';

let {
  title,
  onclose,
  wide = false,
  children,
}: { title: string; onclose: () => void; wide?: boolean; children: Snippet } = $props();
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-label={title} data-wide={wide ? 'wide' : null}>
  <header class="head">
    <h2 class="title">{title}</h2>
    <button class="close" type="button" aria-label="閉じる" onclick={onclose}>×</button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: var(--z-dialog);
    background: var(--scrim);
    animation: fade var(--dur-base) ease both;
  }

  .dialog {
    position: absolute;
    z-index: var(--z-dialog);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(38em, 92%);
    max-height: 92%;
    display: flex;
    flex-direction: column;
    background: var(--surface-paper);
    color: var(--text-on-paper);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-lift);
    animation: rise var(--dur-base) var(--ease-out) both;
  }

  .dialog[data-wide] {
    width: min(58em, 94%);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 1em;
    padding: 0.7em 0.9em 0.55em 1.3em;
    border-bottom: 0.08em solid var(--rule-on-paper);
  }

  .title {
    flex: 1;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.12em;
    letter-spacing: 0.14em;
  }

  .close {
    width: 2.2em;
    height: 2.2em;
    border-radius: 50%;
    font-size: 1.1em;
    color: var(--text-on-paper-muted);
    box-shadow: inset 0 0 0 0.06em var(--rule-on-paper-strong);
  }

  .body {
    overflow-y: auto;
    padding: 1em 1.3em 1.3em;
    user-select: text;
    -webkit-user-select: text;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, -46%);
    }
  }
</style>
