<!--
  読み合わせ。 台本を全員で声に出す時間で、 操作は「行送り」だけ。
  - 送れるのはその行の担当だけ。 担当の画面にだけ ☞ と箔の縁が出る
  - 次に読む人を先に出す (声の準備ができる)
  - 読み返しは現在行まで (先の行は見せない)
  - 遊び方のように読み飛ばせる台本は、 全員の同意で飛ばす
-->
<script lang="ts">
import { minus } from '@uzuhq/code-sdk';
import type { DialoguePhase } from '../lib/types';
import { cssUrl } from '../platform/asset-url';
import { send } from '../runtime/bridge';
import { getRole } from '../scenario/lookup';
import { canAck, PROXY_ADVANCE_BUTTON_AFTER_MS } from '../scenario/progress';
import { buildDialogueView } from '../view/dialogue-view';
import AckButton from './AckButton.svelte';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import DialogueLog from './DialogueLog.svelte';
import { clock, useGameClock } from './game-clock.svelte';
import { localUi } from './local-ui.svelte';
import Newspaper from './Newspaper.svelte';
import RichText from './RichText.svelte';
import { scenario, view } from './view-context.svelte';

let { phase }: { phase: DialoguePhase } = $props();

const dialogue = $derived(view.state ? buildDialogueView(scenario, phase, view.state) : null);
const current = $derived(dialogue?.current ?? null);
const isMine = $derived(Boolean(current && current.readerRoleId === view.selfRoleId));

$effect(() => useGameClock());
const lineStartedAt = $derived(view.state?.game.lineStartedAt ?? null);
const stalled = $derived(
  Boolean(view.selfRoleId) &&
    !isMine &&
    lineStartedAt !== null &&
    minus(clock.now, lineStartedAt) >= PROXY_ADVANCE_BUTTON_AFTER_MS,
);

function proxyAdvance() {
  if (!current) return;
  send('dialogue.advance', { lineIndex: current.index, proxy: true });
}

function advance() {
  if (!current || !isMine) return;
  send('dialogue.advance', { lineIndex: current.index });
}

function onkey(event: KeyboardEvent) {
  if (localUi.overlay) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    advance();
  }
}
</script>

<svelte:window onkeydown={onkey} />

{#if dialogue && current}
  <Backdrop assetId={dialogue.backgroundAssetId} veil={0.18} />

  <section class="dialogue" data-testid="dialogue-screen">
    <div class="stage-cast" data-count={dialogue.cast.length}>
      {#each dialogue.cast as roleId (roleId)}
        {@const speaking = current.speaker?.id === roleId}
        <span
          class="portrait"
          data-speaking={speaking ? 'speaking' : null}
          data-self={roleId === view.selfRoleId ? 'self' : null}
          style:--portrait={cssUrl(getRole(scenario, roleId)?.portraitAssetId)}
        ></span>
      {/each}
      {#if current.speaker && !current.speaker.isRole}
        {#key current.speaker.id}
          <span class="portrait npc" data-speaking="speaking" style:--portrait={cssUrl(current.speaker.portraitAssetId)}></span>
        {/key}
      {/if}
    </div>

    {#if canAck(phase) && view.selfRoleId}
      <div class="skip">
        <span>経験者だけの卓なら飛ばせます</span>
        <AckButton testid="skip-agree" label="飛ばすに同意" ackedLabel="同意を取り消す" />
        <span class="skip-count">{view.acks.length} / {view.playerCount}</span>
      </div>
    {/if}

    {#if current.line.newspaper}
      <Newspaper label={current.line.newspaper.label} headline={current.line.newspaper.headline} />
    {/if}

    <div class="plate-wrap">
      <button
        type="button"
        class="plate"
        data-mine={isMine ? 'mine' : null}
        data-narration={current.speaker ? null : 'narration'}
        data-testid="dialogue-plate"
        disabled={!isMine}
        onclick={advance}
      >
        {#if current.speaker}
          <span class="nameplate">{current.speaker.name}</span>
        {/if}
        {#key current.index}
          <span class="text"><RichText text={current.line.text} /></span>
        {/key}
        <span class="foot">
          <span class="folio">{current.index + 1} / {dialogue.total}</span>
          <span class="turn">
            {#if isMine}
              <span class="cue">☞ 読み終えたらタップ</span>
            {:else}
              <span class="waiting">{current.readerName} が読んでいます</span>
            {/if}
            {#if dialogue.next}
              <span class="next" data-self={dialogue.next.readerRoleId === view.selfRoleId ? 'self' : null}>
                次：{dialogue.next.readerName}{dialogue.next.readerRoleId === view.selfRoleId ? '（あなた）' : ''}
              </span>
            {/if}
          </span>
        </span>
      </button>
      <span class="plate-tools">
        {#if stalled}
          <button type="button" class="tool-btn" data-testid="proxy-advance" onclick={proxyAdvance}>
            {current.readerName}の応答がなければ　☞ 代わりに送る
          </button>
        {/if}
        <button type="button" class="tool-btn" data-testid="open-log" onclick={() => localUi.open({ kind: 'log' })}>読み返す</button>
      </span>
    </div>
  </section>

  {#if localUi.overlay?.kind === 'log'}
    <DialogueLog title={dialogue.sceneTitle} history={dialogue.history} />
  {/if}
{/if}

<style>
  .dialogue {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .stage-cast {
    position: fixed;
    inset: 0;
    z-index: var(--z-portrait);
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 2%;
    padding: 0 6%;
    pointer-events: none;
  }

  .portrait {
    height: 86%;
    aspect-ratio: 0.69;
    background: var(--portrait) center bottom / contain no-repeat;
    filter: brightness(0.5) saturate(0.6);
    transform: translateY(4%) scale(0.94);
    transform-origin: bottom center;
    transition:
      filter var(--dur-base) ease,
      transform var(--dur-base) var(--ease-out);
  }

  .portrait[data-speaking] {
    filter: none;
    transform: translateY(0) scale(1);
  }

  .portrait.npc {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    animation: enter var(--dur-base) var(--ease-out) both;
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(3%);
    }
  }

  .skip {
    grid-row: 1;
    justify-self: center;
    z-index: var(--z-plate);
    display: flex;
    align-items: center;
    gap: 0.7em;
    margin-top: 0.4em;
    padding: 0.35em 0.5em 0.35em 1em;
    border-radius: 2em;
    background: rgba(var(--cloth-rgb), 0.85);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
    font-size: 0.9em;
  }

  .skip-count {
    font-family: var(--font-figure);
    font-size: 1.2em;
    padding-right: 0.5em;
  }

  .plate-wrap {
    grid-row: 3;
    position: relative;
    z-index: var(--z-plate);
    padding: 1.2em 4% 0.6em;
  }

  .turn {
    display: flex;
    align-items: center;
    gap: 1em;
  }

  .next {
    padding-left: 1em;
    border-left: 0.08em solid var(--rule-on-paper-strong);
    color: var(--text-on-paper-muted);
  }

  .next[data-self] {
    color: var(--self-ink);
    font-weight: 700;
  }

  .plate {
    position: relative;
    display: block;
    width: 100%;
    min-height: 7.4em;
    padding: 1.2em 1.6em 0.6em;
    text-align: left;
    border-radius: var(--radius-m);
    background: rgba(var(--sheet-rgb), 0.96);
    color: var(--text-on-paper);
    box-shadow:
      inset 0 0 0 0.08em var(--rule-on-paper-strong),
      var(--shadow-lift);
  }

  .plate:disabled {
    cursor: default;
  }

  .plate[data-mine] {
    box-shadow:
      inset 0 0 0 0.16em var(--self),
      0 0 1.2em rgba(var(--self-rgb), 0.4),
      var(--shadow-lift);
  }

  .plate[data-narration] .text {
    font-style: normal;
    color: var(--text-on-paper-soft);
  }

  .nameplate {
    position: absolute;
    left: 1.2em;
    top: -0.9em;
    padding: 0.2em 1em;
    border-radius: var(--radius-s);
    background: var(--surface-cloth);
    color: var(--text-on-cloth);
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.2em;
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth-strong);
  }

  .text {
    display: block;
    font-family: var(--font-read);
    font-weight: 500;
    font-size: 1.14em;
    line-height: 1.8;
    letter-spacing: 0.05em;
    animation: ink 420ms ease both;
  }

  @keyframes ink {
    from {
      opacity: 0;
      filter: blur(0.12em);
    }
  }

  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.4em;
    font-family: var(--font-hud);
    font-size: 0.82em;
    letter-spacing: 0.12em;
  }

  .folio {
    font-family: var(--font-figure);
    font-size: 1.1em;
    color: var(--text-on-paper-muted);
  }

  .cue {
    font-weight: 700;
    color: var(--self-ink);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .waiting {
    color: var(--text-on-paper-muted);
  }

  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }

  .plate-tools {
    position: absolute;
    right: calc(4% + 0.6em);
    top: 0.1em;
    display: flex;
    gap: 0.4em;
  }

  .tool-btn {
    padding: 0.25em 0.8em;
    border-radius: 2em;
    font-size: 0.82em;
    letter-spacing: 0.12em;
    background: rgba(var(--cloth-rgb), 0.85);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth-strong);
  }
</style>
