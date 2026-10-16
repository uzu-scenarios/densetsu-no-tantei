/**
 * 語りの声。 1 本だけ鳴らす (次の行を頼んだら前の行は止める)。
 *
 * - UZU アプリ / エミュレータ: SDK の playSound に slot を付けて委ねる。 止める API が無いので、
 *   短い無音を同じ slot で鳴らして前の声を切る
 * - dev harness の席: 鳴らさない
 * - vite 直開き: <audio> で鳴らす
 */

import { isHosted, playSound } from '@uzuhq/code-sdk';
import { isHarnessSeat } from './harness';

const SLOT = 'narration';
const SILENCE = 'assets/u/sfx-silence.mp3';

let audio: HTMLAudioElement | null = null;

const strip = (path: string) => path.replace(/^\.\//, '');

export function playVoice(path: string): void {
  if (isHarnessSeat) return;
  if (isHosted) {
    playSound(strip(path), { slot: SLOT });
    return;
  }
  audio?.pause();
  audio = new Audio(path);
  audio.play().catch(() => {});
}

export function stopVoice(): void {
  if (isHarnessSeat) return;
  if (isHosted) {
    playSound(SILENCE, { slot: SLOT });
    return;
  }
  audio?.pause();
  audio = null;
}
