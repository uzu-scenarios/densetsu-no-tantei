/**
 * SDK snapshot (自席から見た部屋の state) の唯一の置き場所。
 *
 * 書き込みは runtime/bridge.ts の 1 経路のみ。 読み口は `snapshotStore.snapshot` で、
 * tracked なので $derived が配信ごとに追従する。
 *
 * snapshot は配信ごとに丸ごと差し替えられ、 in-place 変更が無いので $state.raw で持つ。
 */

import type { Snapshot } from '../lib/types';

let current = $state.raw<Snapshot | null>(null);

export function setSnapshot(snapshot: Snapshot | null): void {
  current = snapshot;
}

export const snapshotStore = {
  get snapshot(): Snapshot | null {
    return current;
  },
};
