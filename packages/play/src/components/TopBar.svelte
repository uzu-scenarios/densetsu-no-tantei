<!--
  常設の HUD。 全フェーズで同じ座標に置く: 左に「いま何の時間か」(章の札) と残り時間、
  右に手帳の入口と卓の 3 人。 投票で切れたマイクは自動では戻らないので、 マイクの制限が
  無いフェーズで切れたままなら知らせる。
-->
<script lang="ts">
import { phaseLabel } from '../scenario/lookup';
import { warnAtSecondsOf } from '../view/timer-view';
import CastRail from './CastRail.svelte';
import { localUi } from './local-ui.svelte';
import TimerCard from './TimerCard.svelte';
import { scenario, view } from './view-context.svelte';
import { voiceStore } from './voice-store.svelte';

const handoutIndex = scenario.phases.findIndex((phase) => phase.type === 'handout');
const phaseIndex = $derived(scenario.phases.findIndex((phase) => phase.id === view.phase?.id));
const finished = $derived(view.state?.status === 'finished');
/** 手帳は配られてから (読み込みのフェーズ以降) ずっと開ける。 */
const notebookOpen = $derived(
  Boolean(view.selfRole) &&
    !finished &&
    phaseIndex >= handoutIndex &&
    view.phase?.type !== 'handout',
);
const micLeftOff = $derived(voiceStore.mutedByScenario && (finished || !view.phase?.mic));
const label = $derived(finished ? '解説　感想戦' : view.phase ? phaseLabel(view.phase) : '');
const warnAt = $derived(warnAtSecondsOf(view.phase));
</script>

<header class="topbar">
  <div class="left">
    <span class="plate" data-testid="phase-plate">{label}</span>
    <TimerCard endsAt={view.state?.game.timerEndsAt ?? null} {warnAt} />
    {#if micLeftOff}<span class="mic-note" data-testid="mic-left-off">マイクがオフのままです</span>{/if}
  </div>
  <div class="right">
    {#if notebookOpen}
      <button type="button" class="tool" data-testid="open-notebook" onclick={() => localUi.open({ kind: 'notebook' })}>
        <span aria-hidden="true">☞</span> 手帳
      </button>
    {/if}
    <CastRail />
  </div>
</header>

<style>
  .topbar {
    position: relative;
    z-index: var(--z-hud);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8em;
    /* HUD と同じ行に置く。 HUD が無い (ブラウザ直開き) ときも札が上端に貼り付かない高さを残す。 */
    min-height: max(var(--hud-y), 2.8em);
    padding: 0 0.7em 0 calc(var(--hud-x) + 0.6em);
    pointer-events: none;
  }

  .mic-note {
    padding: 0.3em 0.8em;
    border-radius: 2em;
    font-size: 0.8em;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--heat-bright);
    background: rgba(var(--cloth-rgb), 0.85);
    box-shadow: inset 0 0 0 0.07em var(--heat);
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 0.5em;
    pointer-events: auto;
  }

  .plate {
    padding: 0.35em 1em;
    border-radius: 2em;
    background: rgba(var(--cloth-rgb), 0.78);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.16em;
    white-space: nowrap;
  }

  .tool {
    padding: 0.45em 0.95em;
    border-radius: 2em;
    background: rgba(var(--cloth-rgb), 0.78);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth-strong);
    font-weight: 700;
    letter-spacing: 0.14em;
    white-space: nowrap;
  }
</style>
