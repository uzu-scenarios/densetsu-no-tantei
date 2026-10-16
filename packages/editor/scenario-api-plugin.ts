/**
 * scenario.json の読み書き API (vite dev middleware)。
 *
 * - GET /api/scenario  … scenario.json をそのまま返す (毎回ディスクから読む)
 * - PUT /api/scenario  … zod スキーマで検証し、通れば安定化フォーマットで書き戻す。
 *                        ID 参照の違反は保存をブロックせず warning として返す
 *                        (編集の途中は参照先を後から作ることがあるため)
 * - GET /api/asset     … play/public/assets/u 配下のファイルをそのまま返す
 *                        (読み取り専用。 フォームでアセット参照を選んだときのプレビュー用)
 *
 * 安全性: 書き込み先はこのファイルが固定で解決する scenario.json の 1 パスのみで、
 * クライアントからパスは受け取らない。 プレビュー配信もファイル名を正規表現で
 * 絞り込み、 assets ディレクトリの外を読めないようにする。 server.host も
 * 127.0.0.1 に留める。 zod を含む検証系モジュールは ssrLoadModule で読む (node は
 * node_modules 内の TS を直接 import できないが、 vite の変換パイプラインを通せば動く)。
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

// Resolve from Vite's root, so multiple editor instances keep their own scenario and assets.
function filePaths(server: ViteDevServer) {
  return {
    scenario: resolve(server.config.root, '../scenario-data/scenario.json'),
    assets: resolve(server.config.root, '../play/public/assets/u'),
  };
}
const MAX_BODY_BYTES = 64 * 1024 * 1024;

// scenario.json の AssetEntrySchema.path (`./assets/u/<...>`) と同じファイル名だけを許す。
const ASSET_FILE_NAME_RE = /^[a-z0-9_.-]+$/;
const ASSET_MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

export function scenarioApiPlugin(): Plugin {
  return {
    name: 'scenario-api',
    configureServer(server) {
      server.middlewares.use('/api/scenario', (req, res) => {
        handle(server, req, res).catch((error) => {
          sendJson(res, 500, { ok: false, message: String(error) });
        });
      });
      server.middlewares.use('/api/asset', (req, res) => {
        handleAsset(server, req, res).catch((error) => {
          sendJson(res, 500, { ok: false, message: String(error) });
        });
      });
    },
  };
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') {
    const raw = await readFile(filePaths(server).scenario, 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(raw);
    return;
  }

  if (req.method === 'PUT') {
    const body = await readBody(req);
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      sendJson(res, 400, { ok: false, message: 'JSON として解釈できません' });
      return;
    }

    const [{ ScenarioSchema }, { stableJsonStringify }, { collectRefViolations }] =
      await Promise.all([
        server.ssrLoadModule('@scenario/data/schema'),
        server.ssrLoadModule('@scenario/data/stable-json'),
        server.ssrLoadModule('@scenario/data/ref-check'),
      ]);

    const result = ScenarioSchema.safeParse(data);
    if (!result.success) {
      sendJson(res, 400, {
        ok: false,
        message: 'スキーマ検証に失敗しました',
        issues: result.error.issues.map((issue: { path: unknown[]; message: string }) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const refViolations = collectRefViolations(data);
    // 書き込み中に落ちても壊れた JSON を残さないよう、一時ファイル → rename で置き換える。
    const temporaryPath = `${filePaths(server).scenario}.save-${process.pid}.tmp`;
    await writeFile(temporaryPath, stableJsonStringify(data), 'utf8');
    await rename(temporaryPath, filePaths(server).scenario);
    sendJson(res, 200, { ok: true, refViolations });
    return;
  }

  sendJson(res, 405, { ok: false, message: `未対応のメソッドです: ${req.method}` });
}

/** GET /api/asset?path=./assets/u/<file> … アセット参照フィールドのプレビュー用の読み取り専用配信。 */
async function handleAsset(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, message: `未対応のメソッドです: ${req.method}` });
    return;
  }
  const path = new URL(req.url || '/', 'http://localhost').searchParams.get('path') || '';
  const prefix = './assets/u/';
  const fileName = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  const ext = extname(fileName).toLowerCase();
  if (!fileName || !ASSET_FILE_NAME_RE.test(fileName) || !ASSET_MIME[ext]) {
    sendJson(res, 400, { ok: false, message: 'プレビュー対象のパスが不正です' });
    return;
  }
  let buffer: Buffer;
  try {
    buffer = await readFile(resolve(filePaths(server).assets, fileName));
  } catch {
    sendJson(res, 404, { ok: false, message: 'アセットファイルが見つかりません' });
    return;
  }
  res.setHeader('Content-Type', ASSET_MIME[ext]);
  res.setHeader('Cache-Control', 'no-store');
  res.end(req.method === 'HEAD' ? undefined : buffer);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new Error('リクエストが大きすぎます'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectPromise);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
