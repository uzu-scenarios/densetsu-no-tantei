/**
 * 証言の本文を行に分ける。 質問の答えは本文の何行目かで指すので、 行の数え方を
 * スキーマの検査と画面で 1 つにしておく (空行は数えない)。
 */
export const clueLines = (body: string): string[] => body.split('\n').filter((line) => line.trim());
