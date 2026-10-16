<!--
  ステージ。 SafeArea と UZU の HUD を避けた枠の中に、 画面 1 つと常設の HUD を置く。
  画面はフェーズごとに排他に mount する ({#key} で作り直すので前の画面の部品が残らない)。
  文字と余白は枠の高さに比例して縮む (em 基準)。
-->
<script lang="ts">
import { setBgm } from '../platform/bgm';
import { getScene } from '../scenario/lookup';
import AdminConsole from './AdminConsole.svelte';
import CastDialog from './CastDialog.svelte';
import ClueDialog from './ClueDialog.svelte';
import DebriefScreen from './DebriefScreen.svelte';
import DialogueScreen from './DialogueScreen.svelte';
import DiscussionScreen from './DiscussionScreen.svelte';
import HandoutScreen from './HandoutScreen.svelte';
import LobbyScreen from './LobbyScreen.svelte';
import { localUi } from './local-ui.svelte';
import NarrationScreen from './NarrationScreen.svelte';
import NotebookDialog from './NotebookDialog.svelte';
import PhaseOpener from './PhaseOpener.svelte';
import RevealScreen from './RevealScreen.svelte';
import Toast from './Toast.svelte';
import TopBar from './TopBar.svelte';
import VoteScreen from './VoteScreen.svelte';
import { scenario, view } from './view-context.svelte';

const status = $derived(view.state?.status ?? null);
const phase = $derived(view.phase);
const screenKey = $derived(status === 'finished' ? 'finished' : (phase?.id ?? status ?? 'boot'));

$effect(() => {
  const trackId =
    status === 'finished'
      ? scenario.settings.debriefBgmTrackId
      : status === 'in_progress'
        ? (phase?.bgmTrackId ?? null)
        : null;
  setBgm(trackId);
});

// 画面が替わったら、 前の画面で開いていた札は閉じる。
$effect(() => {
  void screenKey;
  localUi.close();
});
</script>

<div class="stage">
  {#if view.isAdmin}
    <!-- 進行管理席はゲーム画面を出さず、 コンソールだけを全面に出す。 -->
    <div class="frame" data-screen="admin">
      <AdminConsole />
      <Toast />
    </div>
  {:else}
  <div class="frame" data-screen={status === 'in_progress' ? phase?.type : status}>
    {#if !view.state}
      <p class="boot">読み込み中…</p>
    {:else if status === 'lobby'}
      <LobbyScreen />
    {:else}
      <TopBar />
      <div class="screen">
        {#key screenKey}
          {#if status === 'finished'}
            <DebriefScreen />
            <PhaseOpener chapter="解説" title="感想戦" />
          {:else if phase}
            {#if phase.type === 'dialogue' && getScene(scenario, phase.sceneId)?.narrated}
              <NarrationScreen {phase} />
            {:else if phase.type === 'dialogue'}
              <DialogueScreen {phase} />
            {:else if phase.type === 'handout'}
              <HandoutScreen {phase} />
            {:else if phase.type === 'discussion'}
              <DiscussionScreen {phase} />
            {:else if phase.type === 'vote'}
              <VoteScreen {phase} />
            {:else if phase.type === 'reveal'}
              <RevealScreen />
            {/if}
            <PhaseOpener chapter={phase.chapter} title={phase.title} />
          {/if}
        {/key}
      </div>
    {/if}

    {#if localUi.overlay?.kind === 'cast'}
      <CastDialog />
    {:else if localUi.overlay?.kind === 'notebook'}
      <NotebookDialog />
    {:else if localUi.overlay?.kind === 'clue'}
      <ClueDialog clueId={localUi.overlay.clueId} />
    {/if}
    <Toast />
  </div>
  {/if}
</div>

<style>
  /* 上端は safe area だけを避け、 UZU の HUD (左上のメニュー) の右隣の帯も使う。
     HUD の行に置く部品 (TopBar など) は --hud-x / --hud-y で HUD を避ける。 content inset
     で丸ごと下げると、 HUD の右側に高さ 1 行ぶんの空きができる。 */
  .stage {
    --hud-x: var(--uzu-hud-inset-x, 0px);
    --hud-y: var(--uzu-hud-inset-y, 0px);
    position: fixed;
    inset: 0;
    container-type: size;
    padding:
      var(--uzu-safe-area-inset-top, env(safe-area-inset-top, 0px))
      var(--uzu-content-inset-right, env(safe-area-inset-right, 0px))
      var(--uzu-content-inset-bottom, env(safe-area-inset-bottom, 0px))
      var(--uzu-content-inset-left, env(safe-area-inset-left, 0px));
    background:
      radial-gradient(ellipse at 20% 10%, var(--surface-cloth-high), transparent 60%),
      var(--bg-cloth);
  }

  /* 文字と余白の基準。 枠の高さを主に、 幅を少し混ぜて決める (横長の端末で間延びしない)。
     下限 10.5px は基準サイズの最小 (780x360) で収まることを確かめた値。 */
  .frame {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    /* stylelint-disable-next-line unit-disallowed-list -- em の基準そのものなので px で決める */
    font-size: clamp(10.5px, calc(1.25cqh + 0.72cqw), 21px);
  }

  .screen {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .boot {
    margin: auto;
    font-family: var(--font-display);
    letter-spacing: 0.3em;
    color: var(--text-on-cloth-muted);
  }
</style>
