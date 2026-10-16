<!--
  進行管理席の画面。 ゲーム画面は出さず、 卓の状態と操作だけを全面に並べる。
  止まった卓を外から動かし、 検証で任意の局面へ飛ぶためのもの。

  左に「どこへ飛ぶか」(フェーズの一覧)、 中央に「いま何が起きていて何ができるか」、
  右に参加者と状態 JSON。 このフェーズで意味の無い操作は出さない (押しても弾かれるボタンを
  並べない)。 運営者向けの道具なので、 文字は画面の縮尺に連動させず固定の大きさで組む。
-->
<script lang="ts">
import { minus } from '@uzuhq/code-sdk';
import { send } from '../runtime/bridge';
import { lineReaderRoleId } from '../scenario/dialogue';
import { isEventComplete } from '../scenario/events';
import {
  endingPhases,
  getEndingPhase,
  getPhase,
  getRole,
  getScene,
  getSpeaker,
  isEndingPhase,
  phaseLabel,
  roleName,
} from '../scenario/lookup';
import { scoreRole } from '../scenario/outcome';
import { canAck } from '../scenario/progress';
import { buildTimerView, formatClock, warnAtSecondsOf } from '../view/timer-view';
import { clock, useGameClock } from './game-clock.svelte';
import RichText from './RichText.svelte';
import { scenario, view } from './view-context.svelte';
import { voiceStore } from './voice-store.svelte';

let timerInput = $state(60);
let confirmReset = $state(false);
let copied = $state(false);
// 代理入力の下書き。 全役ぶんを最初に用意する (描画中に $state を生やすと Svelte が弾く)。
const draftBallots = $state<Record<string, { suspect: string; pointed: string }>>(
  Object.fromEntries(scenario.roles.map((role) => [role.id, { suspect: '', pointed: '' }])),
);

$effect(() => useGameClock());

const room = $derived(view.state);
const status = $derived(room?.status ?? 'lobby');
const phase = $derived(status === 'in_progress' ? view.phase : null);
const statusLabel = $derived(
  status === 'lobby' ? 'ロビー' : status === 'finished' ? '感想戦' : phase ? phaseLabel(phase) : '',
);
const timer = $derived(
  buildTimerView(room?.game.timerEndsAt ?? null, clock.now, warnAtSecondsOf(phase)),
);
const scene = $derived(phase?.type === 'dialogue' ? getScene(scenario, phase.sceneId) : null);
const lineIndex = $derived(room?.game.lineIndex ?? 0);
const reader = $derived(
  scene?.lines[lineIndex]
    ? getRole(scenario, lineReaderRoleId(scenario, scene, scene.lines[lineIndex]))
    : null,
);
const endings = endingPhases(scenario);
const json = $derived(room ? JSON.stringify(room, null, 2) : '');

const line = $derived(scene?.lines[lineIndex] ?? null);
const speaker = $derived(getSpeaker(scenario, line?.speakerId));
const players = $derived(room?.players ?? []);
const reached = $derived(getEndingPhase(scenario, room?.game.reachedEndingPhaseId));

function submitBallot(roleId: string) {
  const draft = draftBallots[roleId];
  if (!draft.suspect) {
    send('admin.ballot', { roleId });
    return;
  }
  send('admin.ballot', {
    roleId,
    suspectRoleId: draft.suspect,
    ...(draft.pointed ? { pointedOut: draft.pointed === 'yes' } : {}),
  });
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(json);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  } catch {
    copied = false;
  }
}
</script>

<main class="console" data-testid="admin-console" aria-label="進行管理">
  <header class="bar">
    <strong class="title">進行管理</strong>
    <span class="now" data-testid="admin-status">{statusLabel}</span>
    {#if timer}<span class="timer" data-warn={timer.warn ? 'warn' : null}>残り {timer.label}</span>{/if}
    <span class="seats">
      {#each players as player (player.playerId)}
        {@const voice = voiceStore.statusOf(player.playerId)}
        <span class="seat" data-ack={room?.game.acks.includes(player.roleId) ? 'ack' : null}>
          {roleName(scenario, player.roleId, '―')}<small>{voice === undefined ? '' : voice === null ? '未接続' : voice === 'muted' ? 'ミュート' : voice === 'speaking' ? '発話中' : ''}</small>
        </span>
      {/each}
    </span>
  </header>

  <div class="columns">
    <section class="col phases" aria-label="フェーズ">
      <h2>フェーズ<small>押すと全員が移動</small></h2>
      <ol class="phase-list">
        <li>
          <button type="button" class="phase" data-current={status === 'lobby' ? 'current' : null} disabled>ロビー</button>
        </li>
        {#each scenario.phases as p, i (p.id)}
          <li>
            <button
              type="button"
              class="phase"
              data-current={phase?.id === p.id ? 'current' : null}
              data-reached={status === 'finished' && room?.game.phaseId === p.id ? 'reached' : null}
              data-testid={`admin-phase-${p.id}`}
              onclick={() => send('admin.jump', { phaseId: p.id })}
            >
              <span class="num">{i + 1}</span>
              <span>{phaseLabel(p)}{#if isEndingPhase(p)}<small>{p.ending.label}</small>{/if}</span>
            </button>
          </li>
        {/each}
        <li>
          <button type="button" class="phase" data-current={status === 'finished' ? 'current' : null} data-testid="admin-finish" disabled={status !== 'in_progress'} onclick={() => send('admin.finish')}>
            感想戦
          </button>
        </li>
      </ol>
      <div class="actions">
        {#if status === 'lobby'}
          <button type="button" class="primary" data-testid="admin-start" onclick={() => send('admin.start')}>全員を待たずに開始</button>
        {:else if status === 'in_progress'}
          <button type="button" class="primary" data-testid="admin-next" disabled={phase?.type === 'vote'} onclick={() => send('admin.next')}>次のフェーズへ ▶</button>
        {:else}
          <button type="button" data-testid="admin-resume" onclick={() => send('admin.resume')}>◀ 本編へ戻す</button>
        {/if}
        {#if confirmReset}
          <button type="button" class="danger" data-testid="admin-reset-confirm" onclick={() => { send('admin.reset'); confirmReset = false; }}>本当にロビーへ戻す</button>
          <button type="button" onclick={() => (confirmReset = false)}>やめる</button>
        {:else}
          <button type="button" data-testid="admin-reset" disabled={status === 'lobby'} onclick={() => (confirmReset = true)}>ロビーへ戻す…</button>
        {/if}
      </div>
    </section>

    <section class="col current" aria-label="このフェーズ">
      <h2>{statusLabel}</h2>

      {#if status === 'lobby'}
        <div class="block">
          <span class="label">準備完了 {players.filter((p) => p.ready).length} / {players.length}</span>
          <ul class="plain">
            {#each players as player (player.playerId)}
              <li>{player.ready ? '✓' : '・'} {roleName(scenario, player.roleId, '―')}（{player.nickname}）</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if status === 'finished'}
        <div class="block">
          {#if reached}<span class="label">通った結末：{reached.ending.label}</span>{/if}
          <table>
            <tbody>
              {#each scenario.roles as role (role.id)}
                {@const ballot = room?.game.ballots[role.id]}
                <tr>
                  <th>{role.name}</th>
                  <td>→ {roleName(scenario, ballot?.suspectRoleId, '―')}{#if role.declaration && ballot}／{ballot.pointedOut ? '指摘された' : '指摘されていない'}{/if}</td>
                  <td>{scoreRole(role, room?.game.ballots ?? {}).total} 点</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if phase}
        {#if scene && line}
          <div class="block">
            <span class="label">台詞 {lineIndex + 1} / {scene.lines.length}　担当：{reader?.name ?? '―'}</span>
            <div class="line" data-testid="admin-line">
              <strong>{speaker?.name ?? '地の文'}</strong>
              <RichText text={line.text} />
            </div>
            <div class="actions">
              <button type="button" disabled={lineIndex === 0} onclick={() => send('admin.dialogue.seek', { lineIndex: 0 })}>⏮ 先頭</button>
              <button type="button" disabled={lineIndex === 0} onclick={() => send('admin.dialogue.seek', { lineIndex: lineIndex - 1 })}>◀ 戻す</button>
              <button type="button" class="primary" data-testid="admin-line-next" onclick={() => send('dialogue.advance', { lineIndex })}>送る ▶</button>
              <button type="button" disabled={lineIndex >= scene.lines.length - 1} onclick={() => send('admin.dialogue.seek', { lineIndex: scene.lines.length - 1 })}>末尾 ⏭</button>
            </div>
          </div>
        {/if}

        {#if timer}
          <div class="block">
            <span class="label">タイマー　残り {timer.label}</span>
            <div class="actions">
              <button type="button" onclick={() => send('admin.timer.add', { seconds: -60 })}>−1分</button>
              <button type="button" onclick={() => send('admin.timer.add', { seconds: 60 })}>+1分</button>
              <button type="button" onclick={() => send('admin.timer.add', { seconds: 300 })}>+5分</button>
              <button type="button" onclick={() => send('admin.timer.set', { seconds: 0 })}>今すぐ満了</button>
            </div>
            <label class="row">
              <span class="label">残りを</span>
              <input type="number" min="0" step="10" bind:value={timerInput} data-testid="admin-timer-input" />
              <span>秒に</span>
              <button type="button" data-testid="admin-timer-set" onclick={() => send('admin.timer.set', { seconds: timerInput })}>設定</button>
            </label>
          </div>
        {/if}

        {#if canAck(phase)}
          <div class="block">
            <span class="label">
              {phase.type === 'dialogue' ? '読み飛ばしの同意' : phase.type === 'handout' ? '読み終えた' : '開票の確認'}（押すと代わりに付け外し。全員そろうと進む）
            </span>
            <div class="actions">
              {#each scenario.roles as role (role.id)}
                {@const acked = room?.game.acks.includes(role.id) ?? false}
                <button type="button" data-on={acked ? 'on' : null} data-testid={`admin-ack-${role.id}`} onclick={() => send('admin.ack', { roleId: role.id, acked: !acked })}>
                  {acked ? '✓' : '・'} {role.name}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if phase.type === 'discussion' && (phase.events ?? []).length}
          <div class="block">
            <span class="label">議論中の出来事</span>
            <table class="events">
              <tbody>
                {#each phase.events ?? [] as event (event.id)}
                  {@const firedAt = room?.game.events.fired[event.id]}
                  {@const done = room ? isEventComplete(scenario, event, room) : false}
                  <tr>
                    <th>{formatClock(event.atSeconds)}</th>
                    <td>{event.title}</td>
                    <td>{firedAt === undefined ? '未' : done ? '済' : '進行中'}</td>
                    <td>
                      {#if firedAt === undefined}
                        <button type="button" data-testid={`admin-event-fire-${event.id}`} onclick={() => send('admin.event.fire', { eventId: event.id })}>今すぐ起こす</button>
                      {:else if !done}
                        <button type="button" data-testid={`admin-event-complete-${event.id}`} onclick={() => send('admin.event.complete', { eventId: event.id })}>残りを済ませる</button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if phase.type === 'vote'}
          <div class="block">
            <span class="label">票</span>
            <table class="ballots">
              <tbody>
                {#each scenario.roles as role (role.id)}
                  {@const ballot = room?.game.ballots[role.id]}
                  {@const draft = draftBallots[role.id]}
                  <tr>
                    <th>{role.name}</th>
                    <td>
                      {#if ballot}
                        → {roleName(scenario, ballot.suspectRoleId)}{#if role.declaration}／{ballot.pointedOut ? '指摘された' : '指摘されていない'}{/if}
                      {:else}
                        未提出
                      {/if}
                    </td>
                    <td class="edit">
                      <select bind:value={draft.suspect} aria-label={`${role.name}の投票先`}>
                        <option value="">（消す）</option>
                        {#each scenario.roles as target (target.id)}
                          <option value={target.id}>{target.name}</option>
                        {/each}
                      </select>
                      {#if role.declaration}
                        <select bind:value={draft.pointed} aria-label={`${role.name}の自己申告`}>
                          <option value="">申告</option>
                          <option value="yes">指摘された</option>
                          <option value="no">指摘されていない</option>
                        </select>
                      {/if}
                      <button type="button" data-testid={`admin-ballot-${role.id}`} onclick={() => submitBallot(role.id)}>反映</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if phase.type === 'reveal'}
          <label class="row">
            <span class="label">進む結末</span>
            <select data-testid="admin-ending-select" value={room?.game.endingPhaseId ?? ''} onchange={(e) => send('admin.ending', { phaseId: (e.currentTarget as HTMLSelectElement).value })}>
              {#each endings as ending (ending.id)}
                <option value={ending.id}>{ending.ending.label}（{ending.ending.rule}）</option>
              {/each}
            </select>
          </label>
        {/if}
      {/if}
    </section>

    <section class="col side" aria-label="参加者と状態">
      <h2>参加者</h2>
      <table class="players">
        <thead>
          <tr><th>役</th><th>プレイヤー</th><th>準備</th><th>通話</th><th>済</th></tr>
        </thead>
        <tbody>
          {#each players as player (player.playerId)}
            {@const voice = voiceStore.statusOf(player.playerId)}
            <tr>
              <th>{roleName(scenario, player.roleId, '―')}</th>
              <td>{player.nickname}</td>
              <td>{player.ready ? '✓' : '―'}</td>
              <td>{voice === undefined ? '不明' : voice === null ? '未接続' : voice}</td>
              <td>{room?.game.acks.includes(player.roleId) ? '✓' : '―'}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <details>
        <summary>状態 JSON</summary>
        <div class="actions">
          <button type="button" onclick={copyJson}>{copied ? 'コピーしました' : 'JSON をコピー'}</button>
        </div>
        <pre class="json">{json}</pre>
      </details>
    </section>
  </div>
</main>

<style>
  .console {
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    font-family: var(--font-hud);
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-on-cloth);
  }

  .bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 14px;
    min-height: var(--hud-y);
    padding: 6px 12px 6px calc(var(--hud-x) + 12px);
    border-bottom: 1px solid var(--rule-on-cloth-strong);
    background: var(--bg-cloth-deep);
  }

  .title {
    letter-spacing: 0.12em;
  }

  .now {
    color: var(--self-bright);
    font-weight: 700;
  }

  .timer {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .timer[data-warn] {
    color: var(--heat-bright);
  }

  .seats {
    display: flex;
    gap: 10px;
    margin-left: auto;
    color: var(--text-on-cloth-muted);
  }

  .seat[data-ack] {
    color: var(--text-on-cloth);
  }

  .seat[data-ack]::before {
    content: '✓';
    margin-right: 2px;
  }

  .seat small {
    margin-left: 3px;
    font-size: 11px;
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(200px, 0.9fr) minmax(260px, 1.4fr) minmax(220px, 1fr);
    min-height: 0;
    overflow: auto;
  }

  .col {
    min-height: 0;
    overflow-y: auto;
    padding: 10px 12px;
    border-right: 1px solid var(--rule-on-cloth);
  }

  .col:last-child {
    border-right: 0;
  }

  /* 狭い席では参加者と JSON を下へ回し、 列ごとではなくページ全体をスクロールする
     (列ごとに高さを割ると、 フェーズ一覧と操作欄が数行ぶんに潰れる)。 */
  @media (max-width: 900px) {
    .columns {
      grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.4fr);
      grid-auto-rows: max-content;
      align-content: start;
    }

    .col {
      overflow: visible;
    }

    .side {
      grid-column: 1 / -1;
      border-top: 1px solid var(--rule-on-cloth);
    }
  }

  h2 {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-on-cloth-muted);
  }

  h2 small {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--text-on-cloth-faint);
  }

  .phase-list {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: grid;
    gap: 3px;
  }

  .phase {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 5px 8px;
  }

  .phase small {
    display: block;
    font-size: 11px;
    color: var(--text-on-cloth-faint);
  }

  .phase[data-current] {
    background: var(--surface-paper);
    color: var(--text-on-paper);
    box-shadow: inset 0 0 0 2px var(--self);
  }

  .phase[data-current] small {
    color: var(--text-on-paper-muted);
  }

  .phase:disabled:not([data-current]) {
    color: var(--text-on-cloth-faint);
  }

  .num {
    min-width: 1.4em;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--text-on-cloth-faint);
  }

  .phase[data-current] .num {
    color: var(--text-on-paper-muted);
  }

  .block {
    display: grid;
    gap: 6px;
    padding: 4px 0 12px;
  }

  .label {
    color: var(--text-on-cloth-muted);
  }

  .line {
    padding: 8px 10px;
    border-radius: 4px;
    background: var(--surface-paper);
    color: var(--text-on-paper);
    font-family: var(--font-read);
    line-height: 1.7;
  }

  .line strong {
    display: block;
    font-family: var(--font-hud);
    font-size: 12px;
    color: var(--text-on-paper-muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .plain {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  button {
    padding: 4px 9px;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px var(--rule-on-cloth-strong);
  }

  button:disabled {
    color: var(--text-on-cloth-faint);
    box-shadow: inset 0 0 0 1px var(--rule-on-cloth);
  }

  button.primary {
    background: var(--surface-paper);
    color: var(--text-on-paper);
  }

  button.primary:disabled {
    background: transparent;
    color: var(--text-on-cloth-faint);
  }

  button.danger {
    box-shadow: inset 0 0 0 1px var(--heat-bright);
    color: var(--heat-bright);
  }

  button[data-on] {
    background: var(--surface-paper);
    color: var(--text-on-paper);
  }

  select,
  input {
    font: inherit;
    color: var(--text-on-paper);
    background: var(--surface-paper);
    border: 0;
    border-radius: 4px;
    padding: 2px 4px;
    min-width: 0;
  }

  /* 選択肢の文言が長いと select の既定幅が列を押し広げるので、 幅を親に従わせる。 */
  .row select {
    flex: 1;
    width: 0;
  }

  .edit select {
    max-width: 100%;
  }

  input {
    width: 5em;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    white-space: nowrap;
  }

  th,
  td {
    text-align: left;
    padding: 4px;
    border-bottom: 1px solid var(--rule-on-cloth);
    vertical-align: middle;
  }

  .edit {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  details {
    margin-top: 12px;
  }

  summary {
    cursor: pointer;
    font-weight: 700;
    color: var(--text-on-cloth-muted);
    padding-bottom: 4px;
  }

  .json {
    max-height: 320px;
    overflow: auto;
    margin: 4px 0 0;
    padding: 6px;
    border-radius: 4px;
    background: var(--bg-cloth-deep);
    font-size: 11px;
    white-space: pre;
    user-select: text;
    -webkit-user-select: text;
  }
</style>
