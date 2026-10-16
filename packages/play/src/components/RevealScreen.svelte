<!--
  開票。 結果を止めて見せる (そのまま結末へ流さない)。 誰が誰に入れたかをここで明かす。
  自己申告は結末と感想戦で分かるので、 ここでは出さない。 全員が確認したら結末へ。
-->
<script lang="ts">
import { cssUrl } from '../platform/asset-url';
import { send } from '../runtime/bridge';
import { roleName } from '../scenario/lookup';
import { soleTopRoleId, tallyVotes } from '../scenario/outcome';
import AckButton from './AckButton.svelte';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import Face from './Face.svelte';
import { scenario, view } from './view-context.svelte';

const ballots = $derived(view.state?.game.ballots ?? {});
const counts = $derived(tallyVotes(ballots));
const top = $derived(soleTopRoleId(ballots));
const topName = $derived(roleName(scenario, top));
</script>

<Backdrop assetId={scenario.settings.roomBackgroundAssetId} veil={0.86} />

<section class="reveal" data-testid="reveal-screen">
  <div class="columns">
    {#each scenario.roles as role, i (role.id)}
      {@const voters = scenario.roles.filter((r) => ballots[r.id]?.suspectRoleId === role.id)}
      <div class="column" data-top={top === role.id ? 'top' : null} style:--delay={`${i * 260}ms`}>
        <span class="bust" style:--portrait={cssUrl(role.portraitAssetId)}></span>
        <span class="name">{role.name}</span>
        <span class="votes"><strong>{counts[role.id] ?? 0}</strong>票</span>
        <span class="voters">
          {#each voters as voter (voter.id)}
            <Face speakerId={voter.id} self={voter.id === view.selfRoleId} />
          {/each}
        </span>
      </div>
    {/each}
  </div>

  <div class="verdict" data-testid="reveal-verdict">
    {#if top}
      最も多くの票を集めたのは <strong>{topName}</strong>
    {:else}
      票は割れ、 誰にも決まらなかった
    {/if}
  </div>

  {#if view.selfRoleId}
    <footer class="go">
      <span class="count">確認 {view.acks.length} / {view.playerCount}</span>
      <AckButton variant="primary" testid="reveal-confirm" label="結末へ進む" ackedLabel="確認した（取り消す）" />
    </footer>
  {/if}
</section>

<style>
  .reveal {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    gap: 0.6em;
    padding: 0.3em 1.4em 0.6em;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 9.5em));
    justify-content: center;
    gap: 1.6em;
    min-height: 0;
  }

  .column {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto auto;
    justify-items: center;
    gap: 0.25em;
    min-height: 0;
    animation: rise 600ms var(--ease-out) var(--delay) both;
  }

  .bust {
    width: 100%;
    height: 100%;
    min-height: 4em;
    border-radius: var(--radius-m);
    background: var(--portrait) center top / cover no-repeat;
    filter: brightness(0.62) saturate(0.7);
    box-shadow: inset 0 0 0 0.08em var(--rule-on-cloth);
  }

  .column[data-top] .bust {
    filter: none;
    box-shadow:
      inset 0 0 0 0.16em var(--surface-paper-bright),
      0 0 1.4em rgba(var(--sheet-rgb), 0.3);
  }

  .name {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.2em;
  }

  .votes {
    font-size: 0.9em;
  }

  .votes strong {
    font-family: var(--font-figure);
    font-size: 2em;
    line-height: 1;
    margin-right: 0.1em;
  }

  .voters {
    display: flex;
    gap: 0.25em;
    min-height: 1.8em;
    --face-size: 1.7em;
  }

  .verdict {
    text-align: center;
    font-family: var(--font-read);
    font-size: 1.2em;
    letter-spacing: 0.1em;
    animation: rise 600ms var(--ease-out) 900ms both;
  }

  .verdict strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3em;
  }

  .go {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1em;
  }

  .count {
    font-size: 0.88em;
    color: var(--text-on-cloth-muted);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(0.8em);
    }
  }
</style>
