<!--
  議論中の出来事。 起きた瞬間にカットイン (見出しと話しかけてきた人) が画面を横切り、
  続けてダイアログが開く。 台詞のあと、 手荷物検査ならカバンを開け、 スタッフが来たなら
  質問を選ぶ。 片付いたら少し置いて閉じ、 卓に NEW の札が並ぶ。

  ダイアログはこの画面だけで閉じられる (ほかの人の画面は閉じない)。 情報は卓の札にも
  出ているので、 閉じても読み直せる。
-->
<script lang="ts">
import { minus } from '@uzuhq/code-sdk';
import { cssUrl } from '../platform/asset-url';
import { send } from '../runtime/bridge';
import { answerLine, answerRecord, autoCompleteAt, bagClueOf, bagRecord } from '../scenario/events';
import { getClue, getSpeaker, roleName } from '../scenario/lookup';
import { buildEventView, CUTIN_MS, LATE_AFTER_MS } from '../view/event-view';
import Face from './Face.svelte';
import { clock, useGameClock } from './game-clock.svelte';
import { localUi } from './local-ui.svelte';
import RichText from './RichText.svelte';
import { scenario, view } from './view-context.svelte';

$effect(() => useGameClock());

// この画面が初めて見た時点で、 起きてから時間がたっていた出来事 (途中から開いた・再接続)。
let late = $state<string[]>([]);
const seen = new Set<string>();
$effect(() => {
  const fired = view.state?.game.events.fired ?? {};
  for (const [id, at] of Object.entries(fired)) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (minus(clock.now, at) > LATE_AFTER_MS) late = [...late, id];
  }
});

const ev = $derived(
  view.state
    ? buildEventView(
        scenario,
        view.phase,
        view.state,
        clock.now,
        localUi.dismissedEvents,
        new Set(late),
      )
    : null,
);
const speaker = $derived(getSpeaker(scenario, ev?.event.speakerId));
const photo = $derived(
  ev?.event.kind === 'reveal' ? getClue(scenario, ev.event.clueIds[0])?.imageAssetId : undefined,
);
const secondsLeft = $derived(
  ev && view.state
    ? Math.max(
        0,
        Math.ceil(
          minus(autoCompleteAt(view.state.game.events.fired[ev.event.id]), clock.now) / 1000,
        ),
      )
    : 0,
);
const game = $derived(view.state?.game);
const nameOf = (roleId: string | null) =>
  roleId === view.selfRoleId ? 'あなた' : roleName(scenario, roleId);
</script>

{#if ev}
  {#key ev.event.id}
    <div class="layer" data-testid="event-layer" data-event={ev.event.id}>
      <div class="dim" data-cutin={ev.cutin ? '' : null}></div>
      {#if ev.cutin}
        <div class="cutin" aria-hidden="true" style:--cutin-ms={`${CUTIN_MS}ms`}>
          {#if speaker?.portraitAssetId}<span class="cutin-who" style:--portrait={cssUrl(speaker.portraitAssetId)}></span>{/if}
          <span class="cutin-words">
            <span class="kicker">出来事</span>
            <span class="cutin-title">{ev.event.title}</span>
          </span>
        </div>
      {:else}
        <div class="dialog" role="dialog" aria-label={ev.event.title} data-foot={ev.open && (ev.event.kind === 'bags' || ev.event.kind === 'questions') ? '' : null}>
          <header class="head">
            <span class="kicker">出来事</span><h3>{ev.event.title}</h3>
            {#if ev.complete && (ev.open || ev.event.kind === 'reveal' || ev.event.kind === 'notice')}
              <button type="button" class="closer" data-testid="event-close" onclick={() => localUi.dismissEvent(ev.event.id)}>閉じる</button>
            {/if}
          </header>
          <div class="body">
            {#if speaker?.portraitAssetId}<span class="portrait" style:--portrait={cssUrl(speaker.portraitAssetId)}></span>{/if}
            <div class="talk">
              {#if speaker}<span class="who">{speaker.name}</span>{/if}
              {#each ev.event.says.slice(0, ev.saysShown) as line}
                <p class="say"><RichText text={line} /></p>
              {/each}
            </div>
            {#if photo && ev.open}<span class="photo" style:--image={cssUrl(photo)}></span>{/if}
          </div>

          {#if ev.open && ev.event.kind === 'bags' && game}
            <footer class="foot">
              <span class="hint">
                {ev.complete ? '手荷物検査の結果' : `自分のカバンを開けてください。${secondsLeft}秒たつとスタッフが開けます`}
              </span>
              <div class="bags">
                {#each view.state?.players ?? [] as player (player.playerId)}
                  {@const opened = bagRecord(game, ev.event.id, player.roleId)}
                  {@const self = player.roleId === view.selfRoleId}
                  {#if bagClueOf(scenario, ev.event, player.roleId)}
                    <div class="bag" data-open={opened ? 'open' : null}>
                      <Face speakerId={player.roleId} {self} />
                      <span>{nameOf(player.roleId)}</span>
                      {#if opened}
                        <small>{opened.byRoleId === null ? 'スタッフが確認した' : '開けた'}</small>
                      {:else if self}
                        <button type="button" class="act" data-testid="event-bag-open" onclick={() => send('discussion.bag.open', { eventId: ev.event.id })}>カバンを開ける</button>
                      {:else}
                        <small>まだ</small>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </footer>
          {/if}

          {#if ev.open && ev.event.kind === 'questions' && game}
            <footer class="foot">
              <span class="hint">
                {ev.complete ? '聞いたこと' : `聞きたいことを選んでください。${secondsLeft}秒たつとスタッフが自分から話します`}
              </span>
              <div class="questions">
                {#each ev.event.questions as q (q.id)}
                  {@const answer = answerRecord(game, ev.event.id, q.id)}
                  {#if answer}
                    <div class="qa">
                      <span class="asked">{nameOf(answer.byRoleId)}「{q.question}」</span>
                      <p class="answer"><RichText text={answerLine(scenario, ev.event, q.id)} /></p>
                    </div>
                  {:else if view.selfRoleId}
                    <button type="button" class="act" data-testid={`event-ask-${q.id}`} onclick={() => send('discussion.ask', { eventId: ev.event.id, questionId: q.id })}>{q.question}</button>
                  {/if}
                {/each}
              </div>
            </footer>
          {/if}

        </div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  /* ダイアログは下に寄せ、 上の卓 (新しく並ぶ札) は見えて触れるままにする。 */
  .layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-dialog);
    pointer-events: none;
  }

  .dim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(var(--cloth-rgb), 0.7) 30%, transparent 62%);
    animation: fade var(--dur-base) ease both;
  }

  .dim[data-cutin] {
    background: rgba(var(--cloth-rgb), 0.66);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  /* カットイン: 紺の帯が斜めに画面を横切る。 */
  .cutin {
    position: absolute;
    left: -4%;
    right: -4%;
    top: 36%;
    height: 26%;
    display: flex;
    align-items: center;
    gap: 1.6em;
    padding-left: 12%;
    background: var(--surface-cloth);
    box-shadow:
      inset 0 0.18em 0 var(--accent-paper),
      inset 0 -0.18em 0 var(--accent-paper),
      var(--shadow-lift);
    animation: cutin var(--cutin-ms) cubic-bezier(0.3, 0.8, 0.3, 1) both;
    pointer-events: none;
  }

  @keyframes cutin {
    0% {
      transform: skewY(-3deg) translateX(-100%);
    }
    22%,
    78% {
      transform: skewY(-3deg) translateX(0);
      opacity: 1;
    }
    100% {
      transform: skewY(-3deg) translateX(8%);
      opacity: 0;
    }
  }

  .cutin-who {
    height: 150%;
    aspect-ratio: 0.72;
    align-self: flex-end;
    background: var(--portrait) 50% 0 / cover no-repeat;
    transform: skewY(3deg);
  }

  .cutin-words {
    display: grid;
    gap: 0.2em;
    transform: skewY(3deg);
  }

  .kicker {
    font-size: 0.8em;
    font-weight: 700;
    letter-spacing: 0.5em;
    color: var(--accent-paper);
  }

  .cutin-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 2.6em;
    letter-spacing: 0.14em;
    color: var(--surface-paper-bright);
  }

  /* 下の帯: 左に台詞、 右に操作 (カバン・質問)。 */
  .dialog {
    position: absolute;
    left: 50%;
    bottom: calc(var(--uzu-content-inset-bottom, env(safe-area-inset-bottom, 0px)) + 0.6em);
    transform: translateX(-50%);
    width: min(
      64em,
      calc(
        100% - 2em - var(--uzu-content-inset-left, env(safe-area-inset-left, 0px)) -
          var(--uzu-content-inset-right, env(safe-area-inset-right, 0px))
      )
    );
    max-height: 50%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    pointer-events: auto;
    border-radius: var(--radius-m);
    background: var(--surface-paper);
    color: var(--text-on-paper);
    box-shadow:
      0 0 0 0.16em var(--surface-paper-bright),
      var(--shadow-lift);
    animation: rise var(--dur-base) var(--ease-out) both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 12%);
    }
  }

  .dialog[data-foot] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  }

  .head {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.7em;
    padding: 0.45em 0.6em 0.45em 1em;
    background: var(--surface-cloth);
    color: var(--text-on-cloth);
  }

  .head h3 {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.08em;
    letter-spacing: 0.1em;
  }

  .body {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.9em;
    padding: 0.8em 1.4em 0.8em 1em;
    min-height: 0;
    overflow-y: auto;
  }

  .portrait {
    width: 5.4em;
    aspect-ratio: 0.8;
    border-radius: var(--radius-s);
    background: var(--surface-cloth) var(--portrait) 50% 0 / cover no-repeat;
  }

  .talk {
    display: grid;
    gap: 0.45em;
    align-content: start;
  }

  .who {
    font-size: 0.8em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-on-paper-muted);
  }

  .say {
    font-family: var(--font-read);
    line-height: 1.75;
    animation: ink 500ms ease both;
  }

  @keyframes ink {
    from {
      opacity: 0;
      filter: blur(0.1em);
    }
  }

  .photo {
    align-self: center;
    width: 7em;
    aspect-ratio: 1;
    background: var(--image) center / cover no-repeat;
    border: 0.4em solid var(--surface-paper-bright);
    border-bottom-width: 1.2em;
    box-shadow: var(--shadow-paper);
    transform: rotate(-3deg);
    animation: drop 700ms var(--ease-out) both;
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: rotate(-12deg) translateY(-8%) scale(1.1);
    }
  }

  .foot {
    display: grid;
    gap: 0.45em;
    align-content: start;
    padding: 0.7em 1em 0.8em;
    border-left: 0.08em solid var(--rule-on-paper);
    min-height: 0;
    overflow-y: auto;
  }

  .hint {
    font-size: 0.8em;
    color: var(--text-on-paper-muted);
  }

  .bags {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4em;
  }

  .bag {
    display: grid;
    justify-items: center;
    gap: 0.25em;
    padding: 0.45em 0.3em;
    border-radius: var(--radius-s);
    background: var(--surface-paper-bright);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-paper);
    font-size: 0.86em;
    font-weight: 700;
    --face-size: 2.2em;
  }

  .bag[data-open] {
    background: var(--surface-paper-sunk);
    box-shadow: none;
  }

  .bag small {
    font-weight: 500;
    color: var(--text-on-paper-muted);
  }

  .act {
    justify-self: start;
    padding: 0.4em 0.8em;
    border-radius: var(--radius-s);
    background: var(--text-on-paper);
    color: var(--surface-paper);
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .act::before {
    content: '☞ ';
    color: var(--heat-bright);
  }

  .questions {
    display: grid;
    gap: 0.4em;
  }

  .qa {
    display: grid;
    gap: 0.2em;
  }

  .asked {
    font-size: 0.8em;
    color: var(--text-on-paper-muted);
  }

  .answer {
    padding-left: 0.7em;
    border-left: 0.2em solid var(--text-on-paper-soft);
    font-family: var(--font-read);
    line-height: 1.7;
    animation: ink 500ms ease both;
  }

  .closer {
    margin-left: auto;
    padding: 0.3em 1em;
    border-radius: var(--radius-s);
    background: var(--surface-paper);
    color: var(--text-on-paper);
    font-weight: 700;
    letter-spacing: 0.1em;
  }
</style>
