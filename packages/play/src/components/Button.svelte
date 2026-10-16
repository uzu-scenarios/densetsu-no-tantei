<!--
  押せる操作。 押せるものにだけ ☞ (活版の指差し) が付く。
  - primary:   画面の主。 1 画面に 1 つ。 本文紙の板
  - secondary: 副。 罫だけの板
  - pressed:   自分が表明中 (読み終えた・同意した)。 箔で縁取る。 もう一度押すと取り消せる
  - disabled:  色を落とす (透かさない)。 理由は呼ぶ側が隣に書く
-->
<script lang="ts">
import type { Snippet } from 'svelte';

let {
  variant = 'secondary',
  pressed = false,
  disabled = false,
  mark = true,
  testid = undefined,
  onclick,
  children,
}: {
  variant?: 'primary' | 'secondary';
  pressed?: boolean;
  disabled?: boolean;
  mark?: boolean;
  testid?: string;
  onclick?: () => void;
  children: Snippet;
} = $props();
</script>

<button
  class="button"
  type="button"
  data-variant={variant}
  data-pressed={pressed ? 'pressed' : null}
  data-testid={testid}
  aria-pressed={pressed}
  {disabled}
  {onclick}
>
  {#if mark && !disabled}<span class="manicule" aria-hidden="true">☞</span>{/if}
  <span class="label">{@render children()}</span>
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45em;
    min-height: 2.5em;
    padding: 0.4em 1.1em;
    border-radius: var(--radius-s);
    font-family: var(--font-hud);
    font-weight: 700;
    letter-spacing: 0.12em;
    line-height: 1.2;
    transition:
      transform var(--dur-quick) var(--ease-out),
      background-color var(--dur-quick) ease,
      box-shadow var(--dur-quick) ease;
  }

  .button[data-variant='primary'] {
    background: var(--surface-paper);
    color: var(--text-on-paper);
    box-shadow:
      inset 0 0 0 0.08em var(--rule-on-paper-strong),
      var(--shadow-paper);
  }

  .button[data-variant='secondary'] {
    background: rgba(var(--cloth-rgb), 0.72);
    color: var(--text-on-cloth);
    box-shadow: inset 0 0 0 0.08em var(--rule-on-cloth-strong);
  }

  .button:not(:disabled):active {
    transform: translateY(0.08em) scale(0.98);
  }

  .button[data-pressed] {
    box-shadow:
      inset 0 0 0 0.14em var(--self),
      0 0 0.8em rgba(var(--self-rgb), 0.35);
  }

  .button[data-variant='secondary'][data-pressed] {
    color: var(--self-bright);
  }

  .button:disabled {
    background: rgba(var(--cloth-rgb), 0.5);
    color: var(--text-on-cloth-faint);
    box-shadow: inset 0 0 0 0.08em rgba(var(--rule-rgb), 0.16);
  }

  .manicule {
    font-family: var(--font-read);
    font-size: 1.15em;
    line-height: 1;
    font-weight: 500;
  }

  .button[data-variant='primary'] .manicule {
    color: var(--heat);
  }
</style>
