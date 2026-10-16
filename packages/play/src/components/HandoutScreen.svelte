<!--
  手帳を読む時間。 自分の手帳だけが開き、 章をめくって読む。 読み終えたら「読み終えた」で
  表明し、 全員そろえば時間前でも次へ進む。 待っている間も読み返せる。
-->
<script lang="ts">
import type { HandoutPhase, Role } from '../lib/types';
import { cssUrl } from '../platform/asset-url';
import { send } from '../runtime/bridge';
import AckButton from './AckButton.svelte';
import Backdrop from './Backdrop.svelte';
import Button from './Button.svelte';
import HandoutBook from './HandoutBook.svelte';
import RichText from './RichText.svelte';
import { scenario, view } from './view-context.svelte';

let { phase }: { phase: HandoutPhase } = $props();

// 役を持つのはプレイヤー席だけ (進行管理席はこの画面を出さない)。
const role = $derived<Role>(view.selfRole ?? scenario.roles[0]);
const waitingNames = $derived(
  scenario.roles
    .filter((r) => !view.acks.includes(r.id) && r.id !== view.selfRoleId)
    .map((r) => r.name),
);
</script>

<Backdrop assetId={scenario.settings.roomBackgroundAssetId} veil={0.8} />

<section class="handout" data-testid="handout-screen">
  <aside class="who">
    <span class="bust" style:--portrait={cssUrl(role.portraitAssetId)}></span>
    <div class="caption">
      <span class="small">あなたの役</span>
      <strong>{role.name}</strong>
      <span class="profile">{role.profile.join('／')}</span>
    </div>
    {#if phase.guide}
      <div class="guide">
        <h3>{phase.guide.heading}</h3>
        <RichText text={phase.guide.body} />
      </div>
    {/if}
  </aside>

  <div class="main">
    <div class="sheet">
      {#key role.id}
        <HandoutBook {role} />
      {/key}
    </div>
    {#if view.selfRoleId}
      <div class="actions">
        <span class="status">
          {#if view.selfAcked && waitingNames.length > 0}
            {waitingNames.join('・')} が読んでいます
          {:else}
            読み終えた人 {view.acks.length} / {view.playerCount}
          {/if}
        </span>
        <AckButton variant="primary" testid="handout-done" label="読み終えた" ackedLabel="読み終えた（取り消す）" />
      </div>
    {/if}
  </div>
</section>

<style>
  .handout {
    position: relative;
    z-index: var(--z-scene);
    height: 100%;
    display: grid;
    grid-template-columns: minmax(10em, 0.34fr) 1fr;
    gap: 1.2em;
    padding: 0.6em 1.2em 0.8em;
    min-height: 0;
  }

  .who {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    min-height: 0;
    overflow: hidden;
  }

  .bust {
    flex: 1 1 auto;
    min-height: 6em;
    background: var(--portrait) center top / cover no-repeat;
    border-radius: var(--radius-m);
    box-shadow: inset 0 0 0 0.1em var(--self);
    mask-image: linear-gradient(to bottom, black 70%, transparent);
  }

  .caption {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
  }

  .small {
    font-size: 0.78em;
    letter-spacing: 0.2em;
    color: var(--text-on-cloth-muted);
  }

  .caption strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.6em;
    letter-spacing: 0.2em;
    color: var(--self-bright);
    line-height: 1.2;
  }

  .profile {
    font-size: 0.84em;
    color: var(--text-on-cloth-muted);
  }

  .guide {
    font-size: 0.82em;
    line-height: 1.6;
    color: var(--text-on-cloth-muted);
  }

  .guide h3 {
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--text-on-cloth);
    letter-spacing: 0.1em;
    margin-bottom: 0.2em;
  }

  .main {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.6em;
    min-height: 0;
  }

  .sheet {
    min-height: 0;
    background: var(--surface-paper);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-paper);
    overflow: hidden;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1em;
  }

  .status {
    font-size: 0.88em;
    letter-spacing: 0.1em;
    color: var(--text-on-cloth-muted);
  }
</style>
