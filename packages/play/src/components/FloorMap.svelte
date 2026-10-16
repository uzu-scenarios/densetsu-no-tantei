<!--
  見取り図。 原図の区画を SVG で引き直したもの。 座標の単位は settings.floorMap の幅と高さ。
  - 共通情報に出てくる場所は明るく塗る (押すと、 その場所に関わる共通情報が並ぶ)
  - highlight に渡した場所は縁取る (手がかりの詳細から開いたとき)
-->
<script lang="ts">
import { localUi } from './local-ui.svelte';
import { scenario, view } from './view-context.svelte';

let { highlight = [], compact = false }: { highlight?: string[]; compact?: boolean } = $props();

const { title: mapTitle, width: W, height: H } = scenario.settings.floorMap;
let focusPlaceId = $state<string | null>(null);

// 出ている共通情報に出てくる場所だけを明るく塗る。
const revealed = $derived(scenario.clues.filter((clue) => view.revealedClues.has(clue.id)));
const cluePlaceIds = $derived(new Set(revealed.flatMap((clue) => clue.placeIds ?? [])));
const focusPlace = $derived(scenario.places.find((p) => p.id === focusPlaceId) ?? null);
const focusClues = $derived(
  focusPlaceId ? revealed.filter((clue) => clue.placeIds?.includes(focusPlaceId as string)) : [],
);
</script>

<div class="map" data-compact={compact ? 'compact' : null} data-testid="floor-map">
  <div class="figure">
    <svg viewBox={`-1 -1 ${W + 2} ${H + 2}`} role="img" aria-label={`${mapTitle}の見取り図`}>
      <rect class="outline" x="0" y="0" width={W} height={H} />
      {#each scenario.places as place (place.id)}
        {@const lit = highlight.includes(place.id) || focusPlaceId === place.id}
        <g
          class="place"
          data-clue={cluePlaceIds.has(place.id) ? 'clue' : null}
          data-lit={lit ? 'lit' : null}
          role="button"
          tabindex="0"
          aria-label={place.label}
          onclick={() => (focusPlaceId = focusPlaceId === place.id ? null : place.id)}
          onkeydown={(e) => e.key === 'Enter' && (focusPlaceId = place.id)}
        >
          <rect x={place.x} y={place.y} width={place.w} height={place.h} />
          {#if place.vertical}
            <text x={place.x + place.w / 2} y={place.y + place.h * 0.38} class="label vertical">{place.label}</text>
          {:else}
            <text
              x={place.x + place.w / 2}
              y={place.y + place.h / 2}
              class="label"
              data-long={place.label.length > 4 ? 'long' : null}
            >{place.label}</text>
          {/if}
        </g>
      {/each}
    </svg>
  </div>

  {#if !compact}
    <div class="side">
      {#if focusPlace}
        <span class="side-label">{focusPlace.label}</span>
        {#if focusClues.length === 0}
          <p class="none">関わる情報はありません。</p>
        {/if}
        {#each focusClues as clue (clue.id)}
          <button type="button" class="clue-link" onclick={() => localUi.open({ kind: 'clue', clueId: clue.id })}>
            ☞ {clue.title}
          </button>
        {/each}
      {:else}
        <p class="none">明るい場所を押すと、関わる情報が出ます。</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .map {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(9em, 0.42fr);
    gap: 0.8em;
    height: 100%;
    min-height: 0;
  }

  .map[data-compact] {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr);
  }

  .figure {
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 0.5em;
    background: var(--surface-paper);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-paper);
  }

  svg {
    width: 100%;
    height: 100%;
    max-height: 100%;
  }

  .outline {
    fill: none;
    stroke: var(--text-on-paper);
    stroke-width: 0.6;
  }

  .place rect {
    fill: var(--surface-paper-bright);
    stroke: var(--text-on-paper);
    stroke-width: 0.35;
    transition: fill var(--dur-quick) ease;
  }

  .place:not([data-clue]) rect {
    fill: var(--surface-paper-sunk);
  }

  .place[data-lit] > rect:first-child {
    fill: var(--accent-paper);
    stroke-width: 0.8;
  }


  .place {
    cursor: pointer;
    outline: none;
  }

  /* SVG の中の px は画面の px ではなく viewBox の単位 (見取り図の座標) なので、 図と一緒に伸び縮みする。 */
  /* stylelint-disable unit-disallowed-list */
  .label {
    font-family: var(--font-hud);
    font-weight: 700;
    font-size: 3.4px;
    fill: var(--text-on-paper);
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }

  .label[data-long] {
    font-size: 2.7px;
  }

  .label.vertical {
    writing-mode: vertical-rl;
    letter-spacing: 1px;
    fill: var(--text-on-paper-muted);
  }
  /* stylelint-enable unit-disallowed-list */



  .side {
    display: flex;
    flex-direction: column;
    gap: 0.8em;
    min-height: 0;
    overflow-y: auto;
  }


  .side-label {
    display: block;
    margin-bottom: 0.3em;
    font-size: 0.78em;
    letter-spacing: 0.14em;
    color: var(--text-on-cloth-muted);
  }




  .none {
    font-size: 0.84em;
    color: var(--text-on-cloth-faint);
    line-height: 1.6;
  }

  .clue-link {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.45em 0.7em;
    margin-bottom: 0.3em;
    border-radius: var(--radius-s);
    background: rgba(var(--cloth-rgb), 0.8);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth-strong);
    font-weight: 700;
    letter-spacing: 0.06em;
  }
</style>
