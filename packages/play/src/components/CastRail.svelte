<!--
  卓の 3 人。 全フェーズで同じ場所に居る。 顔・名前・発話状態を出し、 自分には箔の輪と
  「あなた」の札。 押すと登場人物の一覧が開く。
-->
<script lang="ts">
import Face from './Face.svelte';
import { localUi } from './local-ui.svelte';
import { scenario, view } from './view-context.svelte';
import { voiceStore } from './voice-store.svelte';

const seats = $derived(
  scenario.roles.map((role) => {
    const player = view.state?.players.find((entry) => entry.roleId === role.id);
    return { role, playerId: player?.playerId ?? null };
  }),
);
</script>

<button class="rail" type="button" data-testid="cast-rail" onclick={() => localUi.open({ kind: 'cast' })}>
  {#each seats as seat (seat.role.id)}
    {@const self = seat.role.id === view.selfRoleId}
    <span class="seat" data-self={self ? 'self' : null}>
      <Face speakerId={seat.role.id} {self} voice={seat.playerId ? voiceStore.statusOf(seat.playerId) : undefined} />
      <span class="name">{seat.role.name}{#if self}<small>あなた</small>{/if}</span>
    </span>
  {/each}
</button>

<style>
  .rail {
    display: flex;
    gap: 0.7em;
    padding: 0.3em 0.7em 0.3em 0.4em;
    border-radius: 2em;
    background: rgba(var(--cloth-rgb), 0.78);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
    --face-size: 2em;
  }

  .seat {
    display: flex;
    align-items: center;
    gap: 0.35em;
  }

  .name {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-family: var(--font-hud);
    font-weight: 700;
    font-size: 0.86em;
    letter-spacing: 0.08em;
    line-height: 1.1;
    color: var(--text-on-cloth-muted);
  }

  .seat[data-self] .name {
    color: var(--self-bright);
  }

  small {
    font-size: 0.72em;
    letter-spacing: 0.12em;
  }
</style>
