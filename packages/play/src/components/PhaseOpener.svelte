<!--
  章扉。 フェーズが変わった瞬間に中央へ章と題を出し、 2 秒ほどで引く。 操作は止めない
  (pointer-events: none)。 見逃しても常設の章の札が同じことを言っている。
-->
<script lang="ts">
import { PHASE_OPENER_MS } from '../scenario/dialogue';

let { chapter, title }: { chapter: string; title: string } = $props();
</script>

<div class="opener" aria-hidden="true" style:--opener-ms={`${PHASE_OPENER_MS}ms`}>
  <span class="rule"></span>
  <span class="chapter">{chapter}</span>
  <span class="title">{title}</span>
  <span class="rule"></span>
</div>

<style>
  .opener {
    position: fixed;
    inset: 0;
    z-index: var(--z-opener);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(var(--cloth-rgb), 0.92) 0%, rgba(var(--cloth-rgb), 0.7) 45%, transparent 75%);
    animation: opener var(--opener-ms) var(--ease-out) both;
  }

  .chapter {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05em;
    letter-spacing: 0.6em;
    color: var(--text-on-cloth-muted);
  }

  .title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 2.6em;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
  }

  .rule {
    width: 9em;
    height: 0.07em;
    background: linear-gradient(90deg, transparent, var(--rule-on-cloth-strong), transparent);
  }

  @keyframes opener {
    0% {
      opacity: 0;
      letter-spacing: 0.1em;
    }
    18%,
    72% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      visibility: hidden;
    }
  }
</style>
