/**
 * 各席の発話状態。 プラットフォームからこの端末へ直接届くローカルな値で、 ゲームの
 * 共有 state には書き戻さない (発話のたびに全員へ配信されるため)。
 */

import type { Me, Other, Presence } from '@uzuhq/code-sdk';

/** 画面で描き分ける状態。 null は「通話に未接続」。 */
export type AudioStatus = 'speaking' | 'listening' | 'muted' | 'unstable' | null;

let statuses = $state.raw<Record<string, AudioStatus>>({});
let mutedByScenario = $state(false);

type Here = Extract<Me['voice'] | Other['voice'], { status: 'here' }>;

const fromHere = (voice: Here): AudioStatus =>
  voice.mic.status !== 'open'
    ? 'muted'
    : voice.speaking
      ? 'speaking'
      : voice.quality === 'poor'
        ? 'unstable'
        : 'listening';

// off (卓が通話を使わない) は undefined にして、 状態の札ごと出さない。
function fromMe(voice: Me['voice']): AudioStatus | undefined {
  switch (voice.status) {
    case 'off':
      return undefined;
    case 'here':
      return fromHere(voice);
    case 'connecting':
    case 'reconnecting':
      return 'unstable';
    default:
      return null;
  }
}

function fromOther(voice: Other['voice']): AudioStatus | undefined {
  switch (voice.status) {
    case 'off':
      return undefined;
    case 'here':
      return fromHere(voice);
    case 'elsewhere':
      return 'listening';
    case 'lost':
      return 'unstable';
    case 'unknown':
      // 自分が通話にいないと、 ほかの人がいるかどうかも分からない。 不在とは出さない。
      return voice.reason === 'me-not-connected' ? undefined : null;
    default:
      return null;
  }
}

/** presence の自分には席 ID が無いので、 onState で受けた自分の席 ID と合わせて引く。 */
export function setPresence(presence: Presence, mySeatId: string | null): void {
  const next: Record<string, AudioStatus> = {};
  for (const [seatId, other] of Object.entries(presence.others)) {
    const status = fromOther(other.voice);
    if (status !== undefined) next[seatId] = status;
  }
  const mine = fromMe(presence.me.voice);
  if (mySeatId && mine !== undefined) next[mySeatId] = mine;
  statuses = next;
  const me = presence.me.voice;
  mutedByScenario = me.status === 'here' && me.mic.status === 'muted' && me.mic.by === 'scenario';
}

export const voiceStore = {
  /** 未受信 (dev harness など) と通話を使わない卓は undefined。 null は「通話に未接続」。 */
  statusOf(playerId: string): AudioStatus | undefined {
    return playerId in statuses ? statuses[playerId] : undefined;
  },
  /** 場面の頭で切られたマイクが、 本人が戻すまで切れたままになっている。 */
  get mutedByScenario(): boolean {
    return mutedByScenario;
  },
};
