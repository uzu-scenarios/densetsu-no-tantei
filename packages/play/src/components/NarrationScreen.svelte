<!--
  語り。 録音した声を 1 行ずつ流し、 サーバーが声の長さで次の行へ送る (誰も押さない)。
  字は声に合わせて少しずつ濃くなり、 ひとつ前の行は上に薄く残す。 語り手の名札は出さない
  (物語の外の声で、 誰かを名乗らせると物語の人物と取り違える)。
  読み返しと、 全員の同意での読み飛ばしは読み合わせと同じ。
-->
<script lang="ts">
import { gameTime, minus, onPauseChange } from '@uzuhq/code-sdk';
import { onDestroy } from 'svelte';
import type { DialoguePhase } from '../lib/types';
import { duckBgm } from '../platform/bgm';
import { playVoice, stopVoice } from '../platform/voice';
import { send } from '../runtime/bridge';
import { narrationStartsAt } from '../scenario/dialogue';
import { getAsset, getScene } from '../scenario/lookup';
import { canAck } from '../scenario/progress';
import { buildDialogueView } from '../view/dialogue-view';
import { plainText } from '../view/rich-text';
import AckButton from './AckButton.svelte';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import DialogueLog from './DialogueLog.svelte';
import { localUi } from './local-ui.svelte';
import { scenario, view } from './view-context.svelte';

let { phase }: { phase: DialoguePhase } = $props();

/** これより遅れて行を受け取った画面 (途中から開いた・再接続) は、 その行の声を鳴らさない。 */
const LATE_VOICE_MS = 1000;

const scene = $derived(getScene(scenario, phase.sceneId));
const dialogue = $derived(view.state ? buildDialogueView(scenario, phase, view.state) : null);
const index = $derived(dialogue?.current.index ?? 0);
const line = $derived(scene?.lines[index] ?? null);
const lineStartedAt = $derived(view.state?.game.lineStartedAt ?? null);
const startsAt = $derived(lineStartedAt === null ? null : narrationStartsAt(index, lineStartedAt));

// 字を声に合わせて出すため、 描画用の時計 (4 回/秒) より細かく刻む。
let now = $state(gameTime());
const tick = setInterval(() => {
  now = gameTime();
}, 60);

const chars = $derived([...plainText(line?.text ?? '')]);
const shown = $derived.by(() => {
  if (!line?.voice || startsAt === null) return chars.length;
  const progress = minus(now, startsAt) / (line.voice.seconds * 1000);
  return Math.max(0, Math.min(chars.length, Math.ceil(progress * chars.length)));
});
const previous = $derived(index > 0 && scene ? plainText(scene.lines[index - 1].text) : '');

// 同じ行の声を 2 度鳴らさない (state の配信のたびに effect が走り直すため)。
let playedCue: string | null = null;
$effect(() => {
  const voice = line?.voice;
  if (!voice || startsAt === null) return;
  const cue = `${index}@${startsAt}`;
  if (cue === playedCue) return;
  const delay = minus(startsAt, gameTime());
  if (delay < -LATE_VOICE_MS) return;
  const path = getAsset(scenario, voice.assetId)?.path;
  if (!path) return;
  const timer = setTimeout(
    () => {
      playedCue = cue;
      playVoice(path);
    },
    Math.max(0, delay),
  );
  return () => clearTimeout(timer);
});

// 緊急一時停止の間はゲーム内時刻も行の締切も止まるが、 鳴り始めた声は流れ切ってしまう。
// 止まったら声を切る。 再開後は字だけが続き、 声は次の行から戻る (行の途中から鳴らす API が無い)。
const offPause = onPauseChange((pause) => {
  if (pause) stopVoice();
});

duckBgm(true);
onDestroy(() => {
  offPause();
  clearInterval(tick);
  stopVoice();
  duckBgm(false);
});
</script>

{#if dialogue && scene}
  <Backdrop assetId={dialogue.backgroundAssetId} veil={0.68} />

  <section class="narration" data-testid="narration-screen">
    <div class="tale">
      <p class="previous" aria-hidden="true">{previous}</p>
      {#key index}
        <p class="line" data-testid="narration-line" aria-label={chars.join('')}>
          {#each chars as ch, i}<span class="ch" data-on={i < shown ? 'on' : null}>{ch}</span>{/each}
        </p>
      {/key}
      <div class="dots" aria-label={`${index + 1} / ${dialogue.total}`}>
        {#each scene.lines as _, i}
          <i data-state={i < index ? 'done' : i === index ? 'now' : null}></i>
        {/each}
      </div>
    </div>

    <footer class="foot">
      <button type="button" class="tool-btn" data-testid="open-log" onclick={() => localUi.open({ kind: 'log' })}>読み返す</button>
      {#if canAck(phase) && view.selfRoleId}
        <span class="skip">
          <span>経験者だけの卓なら飛ばせます</span>
          <span class="skip-count">{view.acks.length} / {view.playerCount}</span>
          <AckButton testid="skip-agree" label="飛ばすに同意" ackedLabel="同意を取り消す" />
        </span>
      {/if}
    </footer>
  </section>

  {#if localUi.overlay?.kind === 'log'}
    <DialogueLog title={dialogue.sceneTitle} history={dialogue.history} />
  {/if}
{/if}

<style>
  .narration {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    padding: 0 1em 0.6em;
  }

  /* 背景の絵は残しつつ、 字の後ろだけを深く沈めて読ませる。 */
  .narration::before {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(
      ellipse 46% 34% at 50% 47%,
      rgba(var(--cloth-rgb), 0.82),
      rgba(var(--cloth-rgb), 0.5) 70%,
      rgba(var(--cloth-rgb), 0.35)
    );
    pointer-events: none;
  }

  .tale {
    position: relative;
    align-self: center;
    justify-self: center;
    width: min(36em, 86%);
    display: grid;
    gap: 0.9em;
  }

  .previous {
    min-height: 1.8em;
    font-family: var(--font-read);
    font-size: 0.92em;
    line-height: 1.8;
    text-align: center;
    text-wrap: pretty;
    color: var(--text-on-cloth-faint);
  }

  .line {
    min-height: 3.8em;
    font-family: var(--font-read);
    font-weight: 500;
    font-size: 1.32em;
    line-height: 1.9;
    letter-spacing: 0.06em;
    text-align: center;
    text-wrap: pretty;
    color: var(--text-on-cloth);
    text-shadow: 0 0 1em rgba(var(--cloth-rgb), 0.9);
  }

  .ch {
    opacity: 0.16;
    transition: opacity 160ms linear;
  }

  .ch[data-on] {
    opacity: 1;
  }

  .dots {
    display: flex;
    justify-content: center;
    gap: 0.45em;
  }

  .dots i {
    width: 0.36em;
    height: 0.36em;
    border-radius: 50%;
    background: rgba(var(--sheet-rgb), 0.22);
  }

  .dots i[data-state='done'] {
    background: rgba(var(--sheet-rgb), 0.55);
  }

  .dots i[data-state='now'] {
    background: var(--self-bright);
    box-shadow: 0 0 0.5em rgba(var(--self-rgb), 0.8);
  }

  .foot {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7em;
    font-size: 0.9em;
  }

  .tool-btn {
    padding: 0.25em 0.8em;
    border-radius: 2em;
    font-size: 0.9em;
    letter-spacing: 0.12em;
    background: rgba(var(--cloth-rgb), 0.85);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth-strong);
  }

  .skip {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.7em;
    color: var(--text-on-cloth-muted);
  }

  .skip-count {
    font-family: var(--font-figure);
    font-size: 1.2em;
  }

  @media (prefers-reduced-motion: reduce) {
    .ch {
      transition: none;
    }
  }
</style>
