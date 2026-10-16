<!--
  残り時間。 時間を持つフェーズにだけ出る (持たないフェーズでは札ごと出さない)。
  終盤は朱に変わり、 計器を沈めない。
-->
<script lang="ts">
import type { GameTime } from '@uzuhq/code-sdk';
import { buildTimerView } from '../view/timer-view';
import { clock, useGameClock } from './game-clock.svelte';

let { endsAt, warnAt }: { endsAt: GameTime | null; warnAt: number | null } = $props();

$effect(() => useGameClock());
const timer = $derived(buildTimerView(endsAt, clock.now, warnAt));
</script>

{#if timer}
  <span class="timer" data-warn={timer.warn ? 'warn' : null} data-testid="timer" aria-label={`残り ${timer.label}`}>
    <span class="label">残り</span>
    <span class="figure">{timer.label}</span>
  </span>
{/if}

<style>
  .timer {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4em;
    padding: 0.15em 0.8em;
    border-radius: 2em;
    background: rgba(var(--cloth-rgb), 0.78);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
  }

  .label {
    font-size: 0.78em;
    letter-spacing: 0.2em;
    color: var(--text-on-cloth-muted);
  }

  .figure {
    font-family: var(--font-figure);
    font-weight: 700;
    font-size: 1.5em;
    line-height: 1.1;
    font-variant-numeric: lining-nums tabular-nums;
    letter-spacing: 0.04em;
  }

  .timer[data-warn] {
    background: var(--heat-deep);
    box-shadow: inset 0 0 0 0.09em var(--heat-bright);
  }

  .timer[data-warn] .label {
    color: var(--text-on-cloth);
  }
</style>
