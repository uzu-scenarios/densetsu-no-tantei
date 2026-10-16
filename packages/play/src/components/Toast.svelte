<script lang="ts">
import { toastStore } from './toast-store.svelte';
</script>

<div class="toasts" aria-live="polite">
  {#each toastStore.items as item (item.id)}
    <p class="toast" data-tone={item.tone}>{item.text}</p>
  {/each}
</div>

<style>
  .toasts {
    position: absolute;
    z-index: var(--z-toast);
    left: 50%;
    top: 4.2em;
    transform: translateX(-50%);
    display: grid;
    gap: 0.4em;
    justify-items: center;
    pointer-events: none;
    width: min(30em, 90%);
  }

  .toast {
    padding: 0.55em 1.2em;
    border-radius: 2em;
    background: var(--surface-paper);
    color: var(--text-on-paper);
    font-weight: 700;
    letter-spacing: 0.06em;
    box-shadow: var(--shadow-lift);
    animation: pop var(--dur-base) var(--ease-out) both;
  }

  .toast[data-tone='deny'] {
    box-shadow:
      inset 0 0 0 0.12em var(--heat),
      var(--shadow-lift);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-0.5em);
    }
  }
</style>
