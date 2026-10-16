/**
 * アセット ID → URL。 scenario の path は play の public/ 起点の相対パスなので、
 * document の base で絶対 URL にして返す (CSS 変数の url() は消費側の base で解決されるため)。
 */

import { scenarioData } from '@scenario/data';
import { getAsset } from '../scenario/lookup';

export function assetUrl(assetId: string | null | undefined): string | null {
  const path = getAsset(scenarioData, assetId)?.path;
  if (!path) return null;
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
}

export const cssUrl = (assetId: string | null | undefined): string => {
  const url = assetUrl(assetId);
  return url ? `url("${url}")` : 'none';
};
