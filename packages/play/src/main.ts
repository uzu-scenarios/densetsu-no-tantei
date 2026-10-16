/**
 * クライアントの唯一の入口。 SDK を run() で起動し、 state を画面へ流す。
 */

import { scenarioData } from '@scenario/data';
import {
  firstFrameReady,
  gameEnded,
  gameReady,
  getPresence,
  onPresenceChange,
  run,
} from '@uzuhq/code-sdk';
import { mount } from 'svelte';
import App from './components/App.svelte';
import { setPresence } from './components/voice-store.svelte';
import { applyState, bindSendAction } from './runtime/bridge';
import logic from './server/logic';

// ホストは firstFrameReady を受けるまで splash で WebView を隠す。 最初の絵の paint を待って通知する。
requestAnimationFrame(() => firstFrameReady());

let gameReadySignaled = false;
let mySeatId: string | null = null;

run({
  logic,
  playerCount: scenarioData.roles.length,
  onState(state, myPlayerId, mySeatKind) {
    applyState(state, myPlayerId, mySeatKind);
    if (myPlayerId !== mySeatId) {
      mySeatId = myPlayerId;
      setPresence(getPresence(), mySeatId);
    }
    if (!gameReadySignaled) {
      gameReadySignaled = true;
      gameReady();
    }
    // 決着 (感想戦に入った) をホストに知らせて卓を終了扱いにする。 何度呼んでも同じ。
    if (state.status === 'finished') gameEnded();
  },
  inputs(sendAction) {
    bindSendAction(sendAction);
  },
});

onPresenceChange((presence) => setPresence(presence, mySeatId));

mount(App, { target: document.body });
