<!--
  ロビー。 表紙とあらすじを見せ、 自分の役を知らせ、 全員の「準備完了」で幕を開ける。
  この押下は iOS の自動再生制限を外すユーザー操作も兼ねる。
-->
<script lang="ts">
import { cssUrl } from '../platform/asset-url';
import { send } from '../runtime/bridge';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import CastRail from './CastRail.svelte';
import Face from './Face.svelte';
import RichText from './RichText.svelte';
import Tabs from './Tabs.svelte';
import { scenario, view } from './view-context.svelte';

type Tab = 'synopsis' | 'cast' | 'primer';
let tab = $state<Tab>('synopsis');

const lobby = scenario.settings.lobby;
const players = $derived(view.state?.players ?? []);
const self = $derived(players.find((p) => p.roleId === view.selfRoleId) ?? null);
const readyCount = $derived(players.filter((p) => p.ready).length);
</script>

<Backdrop assetId={scenario.settings.lobby.backgroundAssetId} veil={0.78} />

<section class="lobby" data-testid="lobby">
  <div class="cover" style:--cover={cssUrl(lobby.coverAssetId)} role="img" aria-label={scenario.settings.title}></div>

  <div class="panel">
    <div class="sheet">
      <Tabs
        items={[
          { id: 'synopsis', label: 'あらすじ' },
          { id: 'cast', label: '登場人物' },
          { id: 'primer', label: 'はじめての方へ' },
        ]}
        value={tab}
        onchange={(id) => (tab = id)}
      />
      <div class="sheet-body">
        {#if tab === 'synopsis'}
          <div class="prose"><RichText text={lobby.synopsis} /></div>
          <p class="meta">{scenario.settings.lobby.playInfo}　原作：{scenario.settings.author}</p>
          <aside class="notice" data-testid="lobby-notice">
            <h3>このシナリオについて</h3>
            <RichText text={lobby.notice} />
          </aside>
        {:else if tab === 'cast'}
          <ul class="cast">
            {#each scenario.roles as role (role.id)}
              <li data-self={role.id === view.selfRoleId ? 'self' : null}>
                <Face speakerId={role.id} self={role.id === view.selfRoleId} />
                <div>
                  <strong>{role.name}<small>（{role.kana}）</small></strong>
                  <span>{role.profile.join('／')}</span>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <dl class="primer">
            {#each lobby.primer as entry}
              <dt>{entry.heading}</dt>
              <dd><RichText text={entry.body} /></dd>
            {/each}
          </dl>
        {/if}
      </div>
    </div>

    <div class="ready-row">
      {#if view.selfRole}
        <p class="you">あなたは <strong>{view.selfRole.name}</strong> を演じます</p>
        <Button
          variant="primary"
          pressed={self?.ready}
          testid="lobby-ready"
          onclick={() => send('lobby.ready', { ready: !self?.ready })}
        >
          {self?.ready ? '準備完了（取り消す）' : '準備完了'}
        </Button>
      {/if}
      <p class="count" data-testid="ready-count">準備完了 {readyCount} / {players.length}</p>
    </div>
  </div>

  <div class="rail"><CastRail /></div>
</section>

<style>
  .lobby {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 1.4em;
    align-items: center;
    padding: max(var(--hud-y), 2.8em) 1.4em 1em;
  }

  .cover {
    aspect-ratio: 16 / 9;
    width: 100%;
    max-height: 100%;
    background: var(--cover) center / cover no-repeat;
    border-radius: 0.2em 0.6em 0.6em 0.2em;
    box-shadow:
      -0.5em 0 0 -0.2em var(--surface-cloth-high),
      var(--shadow-lift);
  }

  .panel {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.8em;
    height: 100%;
    min-height: 0;
  }

  .sheet {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
  }

  .sheet-body {
    overflow-y: auto;
    padding: 0.9em 1.2em;
    background: var(--surface-paper);
    color: var(--text-on-paper);
    border-radius: 0 var(--radius-m) var(--radius-m) var(--radius-m);
    font-family: var(--font-read);
    font-weight: 500;
    line-height: 1.85;
    letter-spacing: 0.04em;
    box-shadow: var(--shadow-paper);
  }

  .meta {
    margin-top: 0.8em;
    font-family: var(--font-hud);
    font-size: 0.8em;
    letter-spacing: 0.1em;
    color: var(--text-on-paper-muted);
  }

  .notice {
    margin-top: 0.8em;
    padding: 0.6em 0.9em;
    border-radius: var(--radius-s);
    background: var(--surface-paper-sunk);
    font-family: var(--font-hud);
    font-size: 0.8em;
    line-height: 1.7;
    color: var(--text-on-paper-muted);
  }

  .notice h3 {
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--text-on-paper);
  }

  .cast {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.7em;
    --face-size: 3em;
  }

  .cast li {
    display: flex;
    gap: 0.9em;
    align-items: center;
  }

  .cast strong {
    display: block;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.12em;
    letter-spacing: 0.1em;
  }

  .cast li[data-self] strong {
    color: var(--self-ink);
  }

  .cast small {
    font-weight: 500;
    font-size: 0.7em;
  }

  .primer {
    margin: 0;
  }

  .primer dt {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .primer dd {
    margin: 0 0 0.7em;
  }

  .ready-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em 0.9em;
  }

  .you {
    flex-basis: 100%;
    font-family: var(--font-read);
    letter-spacing: 0.08em;
  }

  .you strong {
    color: var(--self-bright);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.2em;
  }

  .count {
    font-size: 0.88em;
    letter-spacing: 0.12em;
    color: var(--text-on-cloth-muted);
  }

  /* 配役の列は HUD と同じ行の右端に置く (ほかの画面の TopBar と同じ位置)。 */
  .rail {
    position: absolute;
    right: 0.7em;
    top: 0;
    height: max(var(--hud-y), 2.8em);
    display: flex;
    align-items: center;
  }
</style>
