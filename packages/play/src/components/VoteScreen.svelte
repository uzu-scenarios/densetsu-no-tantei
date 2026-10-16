<!--
  犯人投票と秘密の自己申告。 候補は顔と名前で並べ、 選択と確定を分ける (確定は取り消せない)。
  誰が出したかは出し、 誰に入れたかは開票まで出さない。
-->
<script lang="ts">
import type { VotePhase } from '../lib/types';
import { cssUrl } from '../platform/asset-url';
import { send } from '../runtime/bridge';
import { roleName } from '../scenario/lookup';
import { buildBallot } from '../scenario/outcome';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import Face from './Face.svelte';
import RichText from './RichText.svelte';
import { scenario, view } from './view-context.svelte';

let { phase }: { phase: VotePhase } = $props();

let suspect = $state<string | null>(null);
let pointedOut = $state<boolean | null>(null);

const ballots = $derived(view.state?.game.ballots ?? {});
const mine = $derived(view.selfRoleId ? ballots[view.selfRoleId] : undefined);
const declaration = $derived(view.selfRole?.declaration ?? null);
const ballot = $derived(
  view.selfRole && suspect ? buildBallot(view.selfRole, suspect, pointedOut) : null,
);
const submittedCount = $derived(Object.keys(ballots).length);

function submit() {
  if (ballot) send('vote.submit', ballot);
}
</script>

<Backdrop assetId={scenario.settings.roomBackgroundAssetId} veil={0.84} />

<section class="vote" data-testid="vote-screen">
  <header class="head">
    <h2>{phase.question}</h2>
    {#if phase.guide}<div class="sub"><RichText text={phase.guide.body} /></div>{/if}
  </header>

  {#if view.selfRoleId && !mine}
    <div class="candidates" role="radiogroup" aria-label={phase.question}>
      {#each scenario.roles as role (role.id)}
        <button
          type="button"
          class="candidate"
          role="radio"
          aria-checked={suspect === role.id}
          data-selected={suspect === role.id ? 'selected' : null}
          data-dim={suspect && suspect !== role.id ? 'dim' : null}
          data-testid={`suspect-${role.id}`}
          onclick={() => (suspect = role.id)}
          style:--portrait={cssUrl(role.portraitAssetId)}
        >
          <span class="bust"></span>
          <span class="name">{role.name}{#if role.id === view.selfRoleId}<small>（あなた）</small>{/if}</span>
        </button>
      {/each}
    </div>

    {#if declaration}
      <div class="declare">
        <p class="q">
          {phase.declarationQuestion}
          <span class="secret">あなたの秘密：{declaration.secret}</span>
        </p>
        <div class="answers" role="radiogroup" aria-label={phase.declarationQuestion}>
          <button type="button" class="answer" role="radio" aria-checked={pointedOut === true} data-selected={pointedOut === true ? 'selected' : null} data-testid="declare-yes" onclick={() => (pointedOut = true)}>指摘された</button>
          <button type="button" class="answer" role="radio" aria-checked={pointedOut === false} data-selected={pointedOut === false ? 'selected' : null} data-testid="declare-no" onclick={() => (pointedOut = false)}>指摘されていない</button>
        </div>
      </div>
    {/if}

    <footer class="confirm">
      <span class="note">
        {#if !suspect}犯人だと思う人を選んでください{:else if declaration && pointedOut === null}自己申告を選んでください{:else}確定した票は取り消せません{/if}
      </span>
      <Button variant="primary" disabled={!ballot} testid="vote-submit" onclick={submit}>この内容で投票する</Button>
    </footer>
  {:else}
    <div class="done">
      {#if mine}
        <p class="mine">あなたは <strong>{roleName(scenario, mine.suspectRoleId)}</strong> に投票しました</p>
      {/if}
      <p class="wait">全員の投票がそろうと開票します</p>
    </div>
  {/if}

  <div class="status" data-testid="vote-status">
    {#each scenario.roles as role (role.id)}
      {@const submitted = Boolean(ballots[role.id])}
      <span class="who" data-submitted={submitted ? 'submitted' : null}>
        <Face speakerId={role.id} self={role.id === view.selfRoleId} dim={!submitted} />
        <span>{role.name}<br /><small>{submitted ? '投票済み' : '考え中'}</small></span>
      </span>
    {/each}
    <span class="count">{submittedCount} / {view.state?.players.length ?? 0}</span>
  </div>
</section>

<style>
  .vote {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    padding: 0.2em 1.4em 0.6em;
    min-height: 0;
  }

  .head {
    text-align: center;
  }

  h2 {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.5em;
    letter-spacing: 0.18em;
  }

  .sub {
    font-size: 0.84em;
    color: var(--text-on-cloth-muted);
    letter-spacing: 0.06em;
  }

  .candidates {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    justify-content: center;
    gap: 1.2em;
  }

  .candidate {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    min-height: 6em;
    aspect-ratio: 0.62;
    max-width: 30%;
    border-radius: var(--radius-m);
    background: var(--surface-cloth);
    box-shadow: inset 0 0 0 0.08em var(--rule-on-cloth-strong);
    overflow: hidden;
    transition:
      transform var(--dur-base) var(--ease-out),
      filter var(--dur-base) ease;
  }

  .bust {
    flex: 1;
    width: 100%;
    background: var(--portrait) center top / cover no-repeat;
  }

  .name {
    width: 100%;
    padding: 0.35em 0;
    background: var(--bg-cloth);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.1em;
    letter-spacing: 0.2em;
  }

  .name small {
    font-size: 0.66em;
    letter-spacing: 0.05em;
  }

  .candidate[data-selected] {
    transform: translateY(-0.3em);
    box-shadow:
      inset 0 0 0 0.18em var(--surface-paper-bright),
      0 0.6em 1.4em rgba(var(--shade-rgb), 0.5);
  }

  .candidate[data-selected] .name {
    background: var(--surface-paper);
    color: var(--text-on-paper);
  }

  .candidate[data-dim] {
    filter: brightness(0.55) saturate(0.6);
  }

  .declare {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5em 1.2em;
    padding: 0.5em 1em;
    border-radius: var(--radius-m);
    background: rgba(var(--cloth-rgb), 0.8);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
  }

  .q {
    display: flex;
    flex-direction: column;
    font-family: var(--font-read);
    font-weight: 700;
  }

  .secret {
    font-size: 0.84em;
    font-weight: 500;
    color: var(--self-bright);
  }

  .answers {
    display: flex;
    gap: 0.4em;
  }

  .answer {
    padding: 0.5em 1em;
    border-radius: 2em;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-on-cloth-muted);
    box-shadow: inset 0 0 0 0.08em var(--rule-on-cloth-strong);
  }

  .answer[data-selected] {
    background: var(--surface-paper);
    color: var(--text-on-paper);
  }

  .confirm {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1em;
  }

  .note {
    font-size: 0.86em;
    color: var(--text-on-cloth-muted);
  }

  .done {
    flex: 1;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 0.6em;
  }

  .mine {
    font-family: var(--font-read);
    font-size: 1.2em;
  }

  .mine strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3em;
  }

  .wait {
    color: var(--text-on-cloth-muted);
    letter-spacing: 0.1em;
  }

  .status {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.2em;
    --face-size: 1.9em;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 0.4em;
    font-size: 0.86em;
    line-height: 1.2;
    color: var(--text-on-cloth-faint);
  }

  .who[data-submitted] {
    color: var(--text-on-cloth);
  }

  .count {
    font-family: var(--font-figure);
    font-size: 1.3em;
  }
</style>
