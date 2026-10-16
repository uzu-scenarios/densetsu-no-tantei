<!--
  登場人物の一覧。 顔・名前・公開プロフィールと、 誰がどの役を演じているか。
-->
<script lang="ts">
import Dialog from './Dialog.svelte';
import Face from './Face.svelte';
import { localUi } from './local-ui.svelte';
import { scenario, view } from './view-context.svelte';
import { voiceStore } from './voice-store.svelte';

const voiceLabel = {
  speaking: '話しています',
  listening: '通話中',
  muted: 'ミュート中',
  unstable: '通信が不安定',
  null: '通話に未接続',
} as const;
</script>

<Dialog title="登場人物" onclose={() => localUi.close()}>
  <ul class="cast">
    {#each scenario.roles as role (role.id)}
      {@const player = view.state?.players.find((p) => p.roleId === role.id)}
      {@const voice = player ? voiceStore.statusOf(player.playerId) : undefined}
      <li data-self={role.id === view.selfRoleId ? 'self' : null}>
        <Face speakerId={role.id} self={role.id === view.selfRoleId} {voice} />
        <div>
          <strong>{role.name}<small>（{role.kana}）</small>{#if role.id === view.selfRoleId}<em>あなた</em>{/if}</strong>
          <span>{role.profile.join('／')}</span>
          {#if player}
            <span class="player">演じる人：{player.nickname}{#if voice !== undefined}　{voiceLabel[String(voice) as keyof typeof voiceLabel]}{/if}</span>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</Dialog>

<style>
  .cast {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.9em;
    --face-size: 3.4em;
  }

  li {
    display: flex;
    gap: 1em;
    align-items: center;
  }

  li div {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
  }

  strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15em;
    letter-spacing: 0.1em;
  }

  small {
    font-weight: 500;
    font-size: 0.7em;
  }

  em {
    font-style: normal;
    margin-left: 0.5em;
    padding: 0 0.5em;
    font-family: var(--font-hud);
    font-size: 0.68em;
    border-radius: var(--radius-s);
    background: var(--self);
    color: var(--text-on-paper);
  }

  .player {
    font-size: 0.84em;
    color: var(--text-on-paper-muted);
  }
</style>
