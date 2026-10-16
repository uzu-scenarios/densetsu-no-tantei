<!--
  感想戦。 ゲームが終わったことを告げ、 答え合わせの資料を全部開く。
  - 結果: 通った結末・自己申告・得点 (目標ごとの達成)
  - 真相 / 年表: 解説と完全な時間割
  - 手帳: 全員の個別情報
  - 結末: 通らなかった結末も読める
  「ゲームを終える」で自分の画面だけを閉じる (ほかの人は感想戦を続けられる)。
-->
<script lang="ts">
import { finishGame } from '@uzuhq/code-sdk';
import { cssUrl } from '../platform/asset-url';
import {
  endingPhases,
  getEndingPhase,
  getPhase,
  getRole,
  getScene,
  getSpeaker,
  roleName,
} from '../scenario/lookup';
import { maxScore, scoreRole } from '../scenario/outcome';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import HandoutBook from './HandoutBook.svelte';
import RichText from './RichText.svelte';
import Tabs from './Tabs.svelte';
import { scenario, view } from './view-context.svelte';

type Tab = 'result' | 'truth' | 'timeline' | 'notebooks' | 'endings' | 'talk' | 'afterword';
let tab = $state<Tab>('result');
let notebookRoleId = $state(scenario.roles[0].id);

const debrief = scenario.debrief;
const ballots = $derived(view.state?.game.ballots ?? {});
const reached = $derived(getEndingPhase(scenario, view.state?.game.reachedEndingPhaseId));
const endings = endingPhases(scenario);
// 結末の欄は、 選ぶまでは自分たちの通った結末を開いておく。
let picked = $state<string | null>(null);
const endingId = $derived(picked ?? reached?.id ?? null);
const endingPhase = $derived(getPhase(scenario, endingId));
const endingScene = $derived(
  endingPhase?.type === 'dialogue' ? getScene(scenario, endingPhase.sceneId) : null,
);
const notebookRole = $derived(getRole(scenario, notebookRoleId)!);
</script>

<Backdrop assetId={scenario.settings.debriefBackgroundAssetId} veil={0.55} />

<section class="debrief" data-testid="debrief-screen">
  <header class="head">
    <p class="the-end">― 完 ―</p>
    <Tabs
      items={[
        { id: 'result', label: '結果' },
        { id: 'truth', label: '真相' },
        { id: 'timeline', label: '年表' },
        { id: 'notebooks', label: '全員の手帳' },
        { id: 'endings', label: '結末' },
        { id: 'talk', label: '感想戦' },
        { id: 'afterword', label: 'あとがき' },
      ]}
      value={tab}
      onchange={(id) => (tab = id)}
    />
  </header>

  <div class="page">
    {#if tab === 'result'}
      {#if reached}
        <p class="reached">あなたたちの結末　<strong>{reached.ending.label}</strong></p>
      {/if}
      <div class="scores">
        {#each scenario.roles as role (role.id)}
          {@const score = scoreRole(role, ballots)}
          <article class="score" data-self={role.id === view.selfRoleId ? 'self' : null} data-testid={`score-${role.id}`}>
            <span class="bust" style:--portrait={cssUrl(role.portraitAssetId)}></span>
            <div class="score-body">
              <h3>{role.name}<span class="total"><strong>{score.total}</strong> / {maxScore(role)}点</span></h3>
              <p class="truth">{role.truth}</p>
              <p class="ballot">
                投票：{roleName(scenario, ballots[role.id]?.suspectRoleId, '―')}
                {#if role.declaration}
                  ／ 自己申告：{ballots[role.id]?.pointedOut === undefined ? '―' : ballots[role.id]?.pointedOut ? '指摘された' : '指摘されていない'}
                {/if}
              </p>
              <ul class="missions">
                {#each score.results as r (r.mission.id)}
                  <li data-achieved={r.achieved ? 'achieved' : null}>
                    <span class="mark">{r.achieved ? '✓' : '✗'}</span>
                    <span>{r.mission.title}<small>{r.mission.rule}</small></span>
                    <span class="pts">{r.mission.points}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </article>
        {/each}
      </div>
    {:else if tab === 'truth'}
      <div class="paper prose">
        {#each debrief.truthSteps as step (step.id)}
          <h3>{step.title}</h3>
          <RichText text={step.body} />
        {/each}
      </div>
    {:else if tab === 'timeline'}
      <div class="paper table-wrap">
        <table class="timeline">
          <thead>
            <tr>
              <th></th>
              {#each debrief.timelineColumns as col}<th>{col}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each debrief.timeline as row}
              <tr>
                <th>{row.time}</th>
                {#each row.cells as cell}<td><RichText text={cell} /></td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if tab === 'notebooks'}
      <div class="notebooks">
        <Tabs items={scenario.roles.map((r) => ({ id: r.id, label: r.name }))} value={notebookRoleId} onchange={(id) => (notebookRoleId = id)} />
        <div class="paper book">
          {#key notebookRoleId}
            <HandoutBook role={notebookRole} />
          {/key}
        </div>
      </div>
    {:else if tab === 'endings'}
      <div class="endings">
        <ul class="ending-list">
          {#each endings as phase (phase.id)}
            {#if phase.type === 'dialogue'}
              <li>
                <button type="button" data-selected={endingId === phase.id ? 'selected' : null} onclick={() => (picked = phase.id)}>
                  <strong>{phase.ending.label}{#if reached?.id === phase.id}<em>あなたたちの結末</em>{/if}</strong>
                  <small>{phase.ending.rule}</small>
                </button>
              </li>
            {/if}
          {/each}
        </ul>
        <div class="paper ending-text">
          {#if endingScene}
            {#each endingScene.lines as line}
              {@const speaker = getSpeaker(scenario, line.speakerId)}
              <p class="ending-line" data-narration={speaker ? null : 'narration'}>
                {#if speaker}<strong>{speaker.name}</strong>{/if}
                <RichText text={line.text} />
              </p>
            {/each}
          {/if}
        </div>
      </div>
    {:else if tab === 'talk'}
      <div class="paper prose">
        <RichText text={debrief.talkGuide} />
        <h3>ネタバレに注意</h3>
        <RichText text={debrief.spoilerGuide} />
      </div>
    {:else}
      <div class="paper prose">
        <h3>このシナリオについて</h3>
        <RichText text={scenario.settings.lobby.notice} />
        <h3>原作のあとがき</h3>
        <RichText text={debrief.afterword} />
        <div class="banners">
          {#each debrief.afterwordImageAssetIds ?? [] as id}
            <span class="banner" style:--image={cssUrl(id)}></span>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <footer class="foot">
    <span class="foot-note">終えるときは各自で閉じてください</span>
    <Button testid="finish-game" onclick={() => finishGame()}>ゲームを終える</Button>
  </footer>
</section>

<style>
  .debrief {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 0.4em;
    padding: 0.2em 1.2em 0.6em;
    min-height: 0;
  }

  .head {
    display: flex;
    align-items: flex-end;
    gap: 1.2em;
  }

  .the-end {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.4em;
    color: var(--text-on-cloth-muted);
    padding-bottom: 0.4em;
  }

  .page {
    min-height: 0;
    overflow-y: auto;
  }

  .paper {
    background: var(--surface-paper);
    color: var(--text-on-paper);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-paper);
  }

  .prose {
    padding: 1em 1.5em;
    font-family: var(--font-read);
    font-weight: 500;
    line-height: 1.9;
    letter-spacing: 0.04em;
    user-select: text;
    -webkit-user-select: text;
  }

  .prose h3 {
    margin: 1em 0 0.3em;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.12em;
    letter-spacing: 0.1em;
    border-bottom: 0.08em solid var(--rule-on-paper-strong);
  }

  .prose h3:first-child {
    margin-top: 0;
  }

  .reached {
    margin-bottom: 0.6em;
    font-family: var(--font-read);
    letter-spacing: 0.1em;
  }

  .reached strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.25em;
  }

  .scores {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.7em;
  }

  .score {
    display: grid;
    grid-template-columns: 4.2em 1fr;
    gap: 0.7em;
    padding: 0.7em;
    border-radius: var(--radius-m);
    background: var(--surface-paper);
    color: var(--text-on-paper);
    box-shadow: var(--shadow-paper);
  }

  .score[data-self] {
    box-shadow:
      inset 0 0 0 0.16em var(--self),
      var(--shadow-paper);
  }

  .bust {
    aspect-ratio: 0.7;
    border-radius: var(--radius-s);
    background: var(--portrait) center top / cover no-repeat;
  }

  .score-body {
    min-width: 0;
  }

  .score h3 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15em;
    letter-spacing: 0.14em;
  }

  .total {
    font-family: var(--font-hud);
    font-size: 0.72em;
    letter-spacing: 0.04em;
  }

  .total strong {
    font-family: var(--font-figure);
    font-size: 2em;
  }

  .truth {
    font-family: var(--font-read);
    font-size: 0.82em;
    line-height: 1.6;
  }

  .ballot {
    margin: 0.3em 0;
    font-size: 0.76em;
    color: var(--text-on-paper-muted);
  }

  .missions {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.8em;
  }

  .missions li {
    display: grid;
    grid-template-columns: 1.2em 1fr auto;
    gap: 0.3em;
    padding: 0.25em 0;
    border-top: 0.06em dashed var(--rule-on-paper);
    color: var(--text-on-paper-muted);
  }

  .missions li[data-achieved] {
    color: var(--text-on-paper);
    font-weight: 700;
  }

  .missions small {
    display: block;
    font-weight: 500;
    font-size: 0.86em;
    color: var(--text-on-paper-muted);
  }

  .pts {
    font-family: var(--font-figure);
    font-size: 1.2em;
  }

  .table-wrap {
    overflow-x: auto;
    padding: 0.6em;
  }

  .timeline {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-read);
    font-size: 0.8em;
    line-height: 1.55;
  }

  .timeline th,
  .timeline td {
    padding: 0.4em 0.5em;
    border-bottom: 0.06em solid var(--rule-on-paper);
    vertical-align: top;
    text-align: left;
  }

  .timeline thead th {
    font-family: var(--font-hud);
    font-weight: 700;
    border-bottom-width: 0.12em;
  }

  .timeline tbody th {
    font-family: var(--font-figure);
    font-size: 1.2em;
    white-space: nowrap;
  }

  .notebooks {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }

  .book {
    min-height: 0;
    overflow: hidden;
  }

  .endings {
    display: grid;
    grid-template-columns: minmax(12em, 0.4fr) 1fr;
    gap: 0.8em;
    height: 100%;
    min-height: 0;
  }

  .ending-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35em;
    align-content: start;
    overflow-y: auto;
  }

  .ending-list button {
    width: 100%;
    text-align: left;
    padding: 0.5em 0.8em;
    border-radius: var(--radius-s);
    box-shadow: inset 0 0 0 0.07em var(--rule-on-cloth);
    color: var(--text-on-cloth-muted);
  }

  .ending-list button[data-selected] {
    background: var(--surface-paper);
    color: var(--text-on-paper);
  }

  .ending-list strong {
    display: block;
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .ending-list em {
    font-style: normal;
    margin-left: 0.5em;
    font-size: 0.72em;
    padding: 0 0.4em;
    border-radius: var(--radius-s);
    background: var(--surface-cloth);
    color: var(--text-on-cloth);
  }

  .ending-list small {
    font-size: 0.78em;
  }

  .ending-text {
    overflow-y: auto;
    padding: 1em 1.4em;
    font-family: var(--font-read);
    line-height: 1.85;
  }

  .ending-line {
    margin-bottom: 0.6em;
  }

  .ending-line[data-narration] {
    color: var(--text-on-paper-soft);
  }

  .ending-line strong {
    display: block;
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.1em;
    font-size: 0.9em;
  }

  .banners {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8em;
    margin-top: 1em;
  }

  .banner {
    aspect-ratio: 1080 / 590;
    border-radius: var(--radius-s);
    background: var(--image) center / cover no-repeat;
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1em;
  }

  .foot-note {
    font-size: 0.84em;
    color: var(--text-on-cloth-muted);
  }
</style>
