/**
 * 瞬間の通知 (操作の結果・弾かれた理由)。 1 か所に積み、 数秒で消える。
 * 消えて困る情報はここに載せない (新規の印など滞留させるものは画面側で持つ)。
 */

export interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'deny';
}

let items = $state<ToastItem[]>([]);
let seq = 0;

export function showToast(text: string, tone: ToastItem['tone'] = 'info'): void {
  seq += 1;
  const id = seq;
  items = [...items.slice(-2), { id, text, tone }];
  setTimeout(() => {
    items = items.filter((item) => item.id !== id);
  }, 3200);
}

export const toastStore = {
  get items(): ToastItem[] {
    return items;
  },
};
