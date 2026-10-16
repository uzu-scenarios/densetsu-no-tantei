<!--
  顔の丸窓。 立ち絵の上端中央を切り抜いて出す (立ち絵は顔が上端中央に来るよう揃えてある)。
  自分の顔にだけ箔の輪が付く (帰属の色相は自分だけが持つ)。 発話中は輪が脈打ち、
  ミュートと通信不安定は右下の小さな札で分け、 通話にいない人は顔ごと沈める。
-->
<script lang="ts">
import { cssUrl } from '../platform/asset-url';
import { getSpeaker } from '../scenario/lookup';
import { scenario } from './view-context.svelte';
import type { AudioStatus } from './voice-store.svelte';

let {
  speakerId,
  self = false,
  dim = false,
  voice = undefined,
}: {
  speakerId: string | null | undefined;
  self?: boolean;
  dim?: boolean;
  voice?: AudioStatus | undefined;
} = $props();

const speaker = $derived(getSpeaker(scenario, speakerId));
const voiceMark = $derived(voice === 'muted' ? 'muted' : voice === 'unstable' ? 'unstable' : null);
</script>

<span
  class="face"
  data-self={self ? 'self' : null}
  data-dim={dim || voice === null ? 'dim' : null}
  data-voice={voice === null ? 'away' : (voice ?? null)}
  aria-label={speaker?.name ?? ''}
  style:--portrait={cssUrl(speaker?.portraitAssetId)}
>
  {#if voiceMark}
    <span class="voice-mark" data-mark={voiceMark} aria-hidden="true">
      {#if voiceMark === 'muted'}
        <svg viewBox="0 0 16 16"><path d="M8 2a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2ZM4 7.5a4 4 0 0 0 8 0M8 11.5V14M2.5 2.5l11 11" /></svg>
      {:else}!{/if}
    </span>
  {/if}
</span>

<style>
  .face {
    position: relative;
    display: inline-block;
    width: var(--face-size, 2.4em);
    aspect-ratio: 1;
    border-radius: 50%;
    background-color: var(--surface-cloth-raised);
    background-image: var(--portrait);
    background-size: 210% auto;
    background-position: 50% 3%;
    background-repeat: no-repeat;
    box-shadow: 0 0 0 0.08em var(--rule-on-cloth-strong);
    flex: none;
  }

  .face[data-self] {
    box-shadow:
      0 0 0 0.1em var(--self),
      0 0 0.5em rgba(var(--self-rgb), 0.45);
  }

  .face[data-dim] {
    filter: grayscale(0.7) brightness(0.62);
  }

  /* 自分の箔の輪に埋もれないよう、 外側に離して太めに引く。 */
  .face[data-voice='speaking']::after {
    content: '';
    position: absolute;
    inset: -0.3em;
    border-radius: 50%;
    border: 0.16em solid var(--surface-paper-bright);
    box-shadow: 0 0 0.4em rgba(var(--sheet-rgb), 0.6);
    animation: speak 0.9s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes speak {
    50% {
      transform: scale(1.1);
      opacity: 0.45;
    }
  }

  .voice-mark {
    position: absolute;
    right: -0.15em;
    bottom: -0.15em;
    width: 1.3em;
    height: 1.3em;
    /* 顔は小さな枠でも出すので、 札の記号が潰れない下限を px で置く。 */
    /* stylelint-disable-next-line unit-disallowed-list */
    font-size: max(0.5em, 10px);
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--bg-cloth-deep);
    color: var(--text-on-cloth-muted);
    box-shadow: 0 0 0 0.12em var(--rule-on-cloth-strong);
    font-weight: 700;
    line-height: 1;
  }

  .voice-mark[data-mark='unstable'] {
    color: var(--heat-bright);
  }

  .voice-mark svg {
    width: 80%;
    fill: none;
    stroke: var(--heat-bright);
    stroke-width: 1.6;
    stroke-linecap: round;
  }
</style>
