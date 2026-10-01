import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { getDatabasePool } from './db';
import {
  storageService,
  getMissingStorageEnv,
  isStorageConfigured,
  getMissingRequiredEnv,
  checkServerConfig,
  sanitizeErrorMessage,
} from './storage';

export { sanitizeErrorMessage, checkServerConfig };

/**
 * Garante que qualquer identificador de usuário (mesmo strings como 'user-default' ou IDs de sessão)
 * seja convertido de forma determinística em um UUID válido para o tipo UUID do PostgreSQL.
 */
export function ensureValidUUID(id: string | null | undefined): string {
  if (!id || typeof id !== 'string') {
    id = 'user-default';
  }
  const clean = id.trim().toLowerCase();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (uuidRegex.test(clean)) {
    return clean;
  }
  // Gera UUID RFC 4122 v4-like determinístico a partir do hash
  const hash = createHash('md5').update(clean).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Helper de autenticação: extrai user_id de token JWT ou cabeçalho x-user-id garantindo formato UUID válido
function getUserIdFromRequest(req: Request): string {
  const customUserId = req.headers['x-user-id'];
  if (typeof customUserId === 'string' && customUserId.trim()) {
    return ensureValidUUID(customUserId.trim());
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload.sub) return ensureValidUUID(payload.sub);
      }
    } catch {
      // Ignora falha de parse
    }
    return ensureValidUUID(token);
  }

  return ensureValidUUID('user-default');
}

export function createAssetRouter(): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // 0. Status de configuração das variáveis
  // --------------------------------------------------------------------------
  router.get('/assets/health/config', (_req: Request, res: Response) => {
    const missing = getMissingRequiredEnv();
    const hasDatabase = Boolean(process.env.DATABASE_URL);

    res.status(200).json({
      storage_configured: isStorageConfigured(),
      missing_storage_env: getMissingStorageEnv(),
      missing_required_env: missing,
      database_configured: hasDatabase,
      bucket: process.env.S3_BUCKET || null,
      region: process.env.S3_REGION || null,
    });
  });

  // --------------------------------------------------------------------------
  // 1. POST /assets/upload/init e POST /assets/uploads
  // --------------------------------------------------------------------------
  router.post(['/assets/upload/init', '/assets/uploads'], async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Token de autenticação ou cabeçalho x-user-id obrigatório.',
        });
        return;
      }

      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotency_key;
      const { filename, byte_size, sha256, category, format } = req.body;

      if (!filename || !byte_size || !sha256 || !category || format !== 'glb') {
        res.status(400).json({
          error: 'INVALID_PAYLOAD',
          message: 'Campos obrigatórios: filename, byte_size, sha256, category e format="glb".',
        });
        return;
      }

      let db;
      try {
        db = getDatabasePool();
      } catch (poolErr: any) {
        res.status(500).json({
          error: 'DATABASE_POOL_ERROR',
          message: sanitizeErrorMessage(poolErr),
        });
        return;
      }

      let client: any = null;
      try {
        client = await db.connect();
      } catch (connectErr: any) {
        res.status(500).json({
          error: 'DATABASE_CONNECTION_ERROR',
          message: sanitizeErrorMessage(connectErr),
        });
        return;
      }

      try {
        await client.query('BEGIN');

        // Idempotência por idempotency_key
        if (idempotencyKey) {
          const existing = await client.query(
            `SELECT s.id AS upload_id, s.asset_id, s.presigned_put_url, s.expires_at, s.is_completed 
             FROM public.asset_upload_sessions s
             WHERE s.owner_user_id = $1 AND s.idempotency_key = $2`,
            [userId, idempotencyKey]
          );

          if (existing.rows.length > 0) {
            const session = existing.rows[0];
            if (!session.is_completed && new Date(session.expires_at) > new Date()) {
              await client.query('COMMIT');
              res.status(200).json({
                asset_id: session.asset_id,
                upload_id: session.upload_id,
                upload_url: session.presigned_put_url,
                is_resumed: true,
              });
              return;
            }
          }
        }

        // 1. Criação do registro em assets com status 'uploading'
        const assetInsert = await client.query(
          `INSERT INTO public.assets (
            owner_user_id, storage_bucket, storage_key, mime_type, 
            byte_size, sha256_checksum, status, category, format
          ) VALUES ($1, $2, 'pending_allocation', 'model/gltf-binary', $3, $4, 'uploading', $5, 'glb')
          RETURNING id`,
          [userId, storageService.getBucket(), byte_size, sha256, category]
        );

        const assetId = assetInsert.rows[0].id;
        const storageKey = `users/${userId}/assets/${assetId}/model.glb`;

        await client.query(
          `UPDATE public.assets SET storage_key = $1 WHERE id = $2`,
          [storageKey, assetId]
        );

        // 2. Emissão da URL de PUT assinada (direto no storage S3)
        let presignedPutUrl: string;
        try {
          presignedPutUrl = await storageService.generatePresignedPutUrl({
            storageKey,
            byteSize: Number(byte_size),
            sha256Hex: sha256,
          });
        } catch (s3Err: any) {
          throw new Error(`Erro no S3 ao gerar URL pré-assinada: ${sanitizeErrorMessage(s3Err)}`);
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // 3. Registro da sessão
        const sessionInsert = await client.query(
          `INSERT INTO public.asset_upload_sessions (
            id, asset_id, owner_user_id, idempotency_key, upload_type, 
            expected_byte_size, expected_sha256, presigned_put_url, expires_at
          ) VALUES (gen_random_uuid(), $1, $2, $3, 'single_put', $4, $5, $6, $7)
          RETURNING id`,
          [assetId, userId, idempotencyKey || assetId, byte_size, sha256, presignedPutUrl, expiresAt]
        );

        const uploadId = sessionInsert.rows[0].id;
        await client.query('COMMIT');

        res.status(201).json({
          asset_id: assetId,
          upload_id: uploadId,
          upload_url: presignedPutUrl,
          expires_in_seconds: 900,
          required_headers: {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': String(byte_size),
            'x-amz-checksum-sha256': Buffer.from(sha256, 'hex').toString('base64'),
          },
        });
      } catch (txErr: any) {
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch {}
        }
        throw txErr;
      } finally {
        if (client && typeof client.release === 'function') {
          client.release();
        }
      }
    } catch (err: any) {
      console.error('[POST /assets/upload/init error]:', err);
      res.status(500).json({
        error: err?.code || 'INIT_UPLOAD_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 2. POST /assets/:assetId/complete e /assets/:id/complete
  // --------------------------------------------------------------------------
  router.post(['/assets/:assetId/complete', '/assets/:id/complete'], async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const userId = getUserIdFromRequest(req);
      const assetId = req.params.assetId || req.params.id;

      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const db = getDatabasePool();
      let client: any = null;
      try {
        client = await db.connect();
      } catch (connectErr: any) {
        res.status(500).json({
          error: 'DATABASE_CONNECTION_ERROR',
          message: sanitizeErrorMessage(connectErr),
        });
        return;
      }

      try {
        await client.query('BEGIN');

        const assetQuery = await client.query(
          `SELECT id, owner_user_id, storage_key, byte_size, sha256_checksum, status 
           FROM public.assets 
           WHERE id = $1 AND owner_user_id = $2 FOR UPDATE`,
          [assetId, userId]
        );

        if (assetQuery.rows.length === 0) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'ASSET_NOT_FOUND', message: 'Asset não encontrado para este usuário.' });
          return;
        }

        const asset = assetQuery.rows[0];

        if (asset.status === 'ready') {
          await client.query('COMMIT');
          res.status(200).json({ asset_id: assetId, status: 'ready', message: 'ALREADY_COMPLETED' });
          return;
        }

        // Executa HEAD diretamente no Storage S3
        let head;
        try {
          head = await storageService.headObject(asset.storage_key);
        } catch (storageErr: any) {
          await client.query(
            `UPDATE public.assets SET status = 'failed', failure_reason = 'OBJECT_NOT_FOUND_IN_STORAGE' WHERE id = $1`,
            [assetId]
          );
          await client.query('COMMIT');
          res.status(422).json({
            error: 'OBJECT_NOT_FOUND_IN_STORAGE',
            message: `Objeto não encontrado no storage: ${sanitizeErrorMessage(storageErr)}`,
          });
          return;
        }

        // Validação estrita do tamanho do objeto
        if (head.contentLength !== Number(asset.byte_size)) {
          await client.query(
            `UPDATE public.assets SET status = 'failed', failure_reason = 'BYTE_SIZE_MISMATCH' WHERE id = $1`,
            [assetId]
          );
          await client.query('COMMIT');
          res.status(422).json({
            error: 'BYTE_SIZE_MISMATCH',
            message: `Tamanho do arquivo divergente. Esperado: ${asset.byte_size}, Recebido: ${head.contentLength}`,
            expected: Number(asset.byte_size),
            actual: head.contentLength,
          });
          return;
        }

        await client.query(
          `UPDATE public.assets 
           SET status = 'ready', etag = $1, failure_reason = NULL, updated_at = NOW() 
           WHERE id = $2`,
          [head.etag, assetId]
        );

        await client.query(
          `INSERT INTO public.inventory_items (user_id, asset_id, custom_label)
           VALUES ($1, $2, 'Modelo 3D')
           ON CONFLICT (user_id, asset_id) DO NOTHING`,
          [userId, assetId]
        );

        await client.query(
          `UPDATE public.asset_upload_sessions 
           SET is_completed = TRUE 
           WHERE asset_id = $1`,
          [assetId]
        );

        await client.query('COMMIT');

        res.status(200).json({
          asset_id: assetId,
          status: 'ready',
          etag: head.etag,
        });
      } catch (txErr: any) {
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch {}
        }
        throw txErr;
      } finally {
        if (client && typeof client.release === 'function') {
          client.release();
        }
      }
    } catch (err: any) {
      console.error('[POST /assets/:assetId/complete error]:', err);
      res.status(500).json({
        error: err?.code || 'COMPLETE_VERIFICATION_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. GET /assets/:assetId/resolve e /assets/:assetId
  // --------------------------------------------------------------------------
  router.get(['/assets/:assetId/resolve', '/assets/:assetId', '/assets/:id/resolve', '/assets/:id'], async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const userId = getUserIdFromRequest(req);
      const assetId = req.params.assetId || req.params.id;
      const roomId = req.query.room_id as string | undefined;

      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(assetId)) {
        res.status(404).json({
          error: 'ASSET_NOT_FOUND',
          message: 'Asset ID deve ser um UUID válido de public.assets.',
        });
        return;
      }

      const db = getDatabasePool();
      const result = await db.query(
        `SELECT id, owner_user_id, storage_key, mime_type, byte_size, 
                sha256_checksum, status, visibility
         FROM public.assets 
         WHERE id = $1`,
        [assetId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'ASSET_NOT_FOUND', message: 'Asset não encontrado no banco.' });
        return;
      }

      const asset = result.rows[0];

      if (asset.status !== 'ready') {
        res.status(409).json({ error: 'ASSET_NOT_READY', message: 'Asset ainda não está pronto para download.', current_status: asset.status });
        return;
      }

      let isAuthorized = asset.owner_user_id === userId || asset.visibility === 'public_marketplace' || asset.status === 'ready';

      if (!isAuthorized) {
        const invCheck = await db.query(
          `SELECT id FROM public.inventory_items WHERE user_id = $1 AND asset_id = $2`,
          [userId, assetId]
        );
        if (invCheck.rows.length > 0) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized && roomId) {
        const roomCheck = await db.query(
          `SELECT id FROM public.room_placements 
           WHERE room_id = $1 AND asset_id = $2 AND is_active = TRUE`,
          [roomId, assetId]
        );
        if (roomCheck.rows.length > 0) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão para acessar este asset.' });
        return;
      }

      const filename = `model_${asset.id.slice(0, 8)}.glb`;
      const downloadUrl = await storageService.generatePresignedGetUrl({
        storageKey: asset.storage_key,
        filename,
      });

      res.status(200).json({
        asset_id: asset.id,
        filename,
        mime_type: asset.mime_type,
        byte_size: Number(asset.byte_size),
        sha256: asset.sha256_checksum,
        download_url: downloadUrl,
      });
    } catch (err: any) {
      console.error('[GET /assets/:assetId/resolve error]:', err);
      res.status(500).json({
        error: err?.code || 'RESOLVE_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4. GET /inventory
  // --------------------------------------------------------------------------
  router.get('/inventory', async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      let db;
      try {
        db = getDatabasePool();
      } catch (poolErr: any) {
        res.status(500).json({
          error: 'DATABASE_POOL_ERROR',
          message: sanitizeErrorMessage(poolErr),
        });
        return;
      }

      const query = `
        SELECT 
          ii.id AS inventory_item_id,
          ii.custom_label,
          ii.acquired_at,
          a.id AS asset_id,
          a.storage_key,
          a.mime_type,
          a.byte_size,
          a.sha256_checksum,
          a.category
        FROM public.inventory_items ii
        INNER JOIN public.assets a ON ii.asset_id = a.id
        WHERE ii.user_id = $1 AND a.status = 'ready' AND ii.is_archived = FALSE
        ORDER BY ii.acquired_at DESC
      `;

      let result;
      try {
        result = await db.query(query, [userId]);
      } catch (dbErr: any) {
        res.status(500).json({
          error: 'DATABASE_QUERY_ERROR',
          message: `Erro ao consultar inventário no PostgreSQL: ${sanitizeErrorMessage(dbErr)}`,
        });
        return;
      }

      const items = await Promise.all(
        (result.rows || []).map(async (row: any) => {
          try {
            const filename = `${(row.custom_label || 'model').replace(/\s+/g, '_')}_${row.asset_id.slice(0, 6)}.glb`;
            const downloadUrl = await storageService.generatePresignedGetUrl({
              storageKey: row.storage_key,
              filename,
            });

            return {
              inventory_item_id: row.inventory_item_id,
              asset_id: row.asset_id,
              custom_label: row.custom_label,
              category: row.category,
              mime_type: row.mime_type,
              byte_size: Number(row.byte_size),
              sha256: row.sha256_checksum,
              filename,
              download_url: downloadUrl,
              acquired_at: row.acquired_at,
            };
          } catch (itemErr: any) {
            console.warn(`[Inventory item presigned url failed]:`, itemErr);
            return null;
          }
        })
      );

      res.status(200).json({ items: items.filter(Boolean) });
    } catch (err: any) {
      console.error('[GET /inventory error]:', err);
      res.status(500).json({
        error: err?.code || 'INVENTORY_FETCH_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  return router;
}
