/**
 * BGM。 フェーズが決めたトラックを 1 本だけ鳴らす (再生と停止をフェーズで対にする)。
 *
 * - UZU アプリ / エミュレータ: SDK の playBgm に委ねる (通話中の音量調整をホストが持つ)
 * - dev harness の席: 鳴らさない
 * - vite 直開き: <audio> でループ再生
 */

import { scenarioData } from '@scenario/data';
import { isHosted, playBgm, stopBgm } from '@uzuhq/code-sdk';
import { getAsset } from '../scenario/lookup';
import { isHarnessSeat } from './harness';

let currentTrackId: string | null = null;
let audio: HTMLAudioElement | null = null;
let ducked = false;

const FULL = 1;
/** 語りの下で BGM を下げる倍率。 */
const DUCKED = 0.3;
/** 直開きの <audio> は SDK の音量設定を通らないので、 ここで控えめに鳴らす。 */
const DIRECT_VOLUME = 0.5;

function trackPath(trackId: string): string | null {
  const track = scenarioData.audioTracks.find((entry) => entry.id === trackId);
  return getAsset(scenarioData, track?.assetId)?.path ?? null;
}

export function setBgm(trackId: string | null): void {
  if (trackId === currentTrackId) return;
  currentTrackId = trackId;
  if (isHarnessSeat) return;
  const path = trackId ? trackPath(trackId) : null;
  if (isHosted) {
    if (path) playBgm(path.replace(/^\.\//, ''), { volume: ducked ? DUCKED : FULL });
    else stopBgm();
    return;
  }
  audio?.pause();
  audio = null;
  if (!path) return;
  audio = new Audio(path);
  audio.loop = true;
  audio.volume = DIRECT_VOLUME * (ducked ? DUCKED : FULL);
  // 最初のユーザー操作 (準備完了) の前は自動再生を拒まれることがある。 次の配信で鳴らし直さない
  // ので、 拒まれたら操作を待って 1 回だけ再開する。
  audio.play().catch(() => {
    const resume = () => audio?.play().catch(() => {});
    window.addEventListener('pointerdown', resume, { once: true });
  });
}

/**
 * 語りの間だけ BGM を下げる。 同じ曲の playBgm は頭に戻らず音量だけを寄せる (SDK の仕様)。
 */
export function duckBgm(on: boolean): void {
  if (on === ducked) return;
  ducked = on;
  if (isHarnessSeat) return;
  const path = currentTrackId ? trackPath(currentTrackId) : null;
  if (isHosted) {
    if (path) playBgm(path.replace(/^\.\//, ''), { volume: on ? DUCKED : FULL, fadeMs: 800 });
    return;
  }
  if (audio) audio.volume = DIRECT_VOLUME * (on ? DUCKED : FULL);
}
