/**
 * この端末だけの操作状態 (開いている札・選んでいるタブ・見た手がかり)。
 * 共有 state には書かない。
 */

export type Overlay =
  | { kind: 'cast' }
  | { kind: 'notebook' }
  | { kind: 'clue'; clueId: string }
  | { kind: 'log' }
  | null;

let overlay = $state<Overlay>(null);
let seenClueIds = $state<string[]>([]);
let dismissedGuidePhaseIds = $state<string[]>([]);
let dismissedEventIds = $state<string[]>([]);

export const localUi = {
  get overlay(): Overlay {
    return overlay;
  },
  open(next: Overlay): void {
    overlay = next;
    if (next?.kind === 'clue' && !seenClueIds.includes(next.clueId)) {
      seenClueIds = [...seenClueIds, next.clueId];
    }
  },
  close(): void {
    overlay = null;
  },
  hasSeenClue(clueId: string): boolean {
    return seenClueIds.includes(clueId);
  },
  isGuideDismissed(phaseId: string): boolean {
    return dismissedGuidePhaseIds.includes(phaseId);
  },
  /** 出来事のダイアログを閉じた (この端末だけ)。 */
  get dismissedEvents(): ReadonlySet<string> {
    return new Set(dismissedEventIds);
  },
  dismissEvent(eventId: string): void {
    if (!dismissedEventIds.includes(eventId)) dismissedEventIds = [...dismissedEventIds, eventId];
  },
  dismissGuide(phaseId: string): void {
    if (!dismissedGuidePhaseIds.includes(phaseId)) {
      dismissedGuidePhaseIds = [...dismissedGuidePhaseIds, phaseId];
    }
  },
};
