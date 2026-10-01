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

        const assetResult = await client.query(
          `SELECT id, owner_user_id, storage_key, byte_size, sha256_checksum, status 
           FROM public.assets 
           WHERE id = $1 AND owner_user_id = $2`,
          [assetId, userId]
        );

        if (assetResult.rows.length === 0) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'ASSET_NOT_FOUND', message: 'Asset não encontrado ou sem permissão.' });
          return;
        }

        const asset = assetResult.rows[0];

        // Se já estiver ready, retorna sucesso imediato (idempotente)
        if (asset.status === 'ready') {
          await client.query('COMMIT');
          res.status(200).json({
            asset_id: asset.id,
            status: 'ready',
            is_resumed: true,
          });
          return;
        }

        // Consulta HEAD real no storage S3
        let head;
        try {
          head = await storageService.headObject(asset.storage_key);
        } catch (storageErr: any) {
          await client.query(
            `UPDATE public.assets SET status = 'failed', failure_reason = 'OBJECT_NOT_FOUND_IN_STORAGE' WHERE id = $1`,
            [assetId]
          );
          await client.query('COMMIT');
          res.status(404).json({
            error: 'STORAGE_OBJECT_NOT_FOUND',
            message: `Arquivo binário não encontrado no bucket. ${sanitizeErrorMessage(storageErr)}`,
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

      // Se um room_id foi informado, verifica permissões da sala específica
      if (roomId && UUID_REGEX.test(roomId)) {
        const roomRes = await db.query(
          `SELECT id, owner_user_id, user_id, visibility, asset_id 
           FROM public.showcase_rooms 
           WHERE id = $1`,
          [roomId]
        );

        if (roomRes.rows.length > 0) {
          const room = roomRes.rows[0];
          // Se a sala for PRIVADA, SOMENTE o dono pode acessar!
          if (room.visibility === 'private') {
            const isRoomOwner = room.owner_user_id === userId || room.user_id === userId;
            if (!isRoomOwner) {
              res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Acesso negado: esta sala é privada e pertence a outro usuário.',
              });
              return;
            }
          }
        }
      }

      // Verificação geral de autorização para o asset
      let isAuthorized = false;

      // 1. É o proprietário do asset
      if (asset.owner_user_id === userId) {
        isAuthorized = true;
      }

      // 2. Visibilidade do asset é public_marketplace
      if (!isAuthorized && asset.visibility === 'public_marketplace') {
        isAuthorized = true;
      }

      // 3. Usuário possui o item no inventário
      if (!isAuthorized) {
        const invCheck = await db.query(
          `SELECT id FROM public.inventory_items WHERE user_id = $1 AND asset_id = $2`,
          [userId, assetId]
        );
        if (invCheck.rows.length > 0) {
          isAuthorized = true;
        }
      }

      // 4. Asset está vinculado a uma sala pública publicada
      if (!isAuthorized) {
        const publicRoomCheck = await db.query(
          `SELECT id FROM public.showcase_rooms 
           WHERE asset_id = $1 
             AND (visibility = 'public' OR visibility = 'showcase' OR visibility IS NULL)
             AND is_published = TRUE`,
          [assetId]
        );
        if (publicRoomCheck.rows.length > 0) {
          isAuthorized = true;
        }
      }

      // 5. Asset está listado em item ativo da loja pública
      if (!isAuthorized) {
        const storeCheck = await db.query(
          `SELECT id FROM public.store_items 
           WHERE (asset_id = $1 OR metadata->>'originalItemId' = $1::text) 
             AND is_active = TRUE`,
          [assetId]
        );
        if (storeCheck.rows.length > 0) {
          isAuthorized = true;
        }
      }

      // 6. Sala privada do próprio usuário
      if (!isAuthorized) {
        const myPrivateRoomCheck = await db.query(
          `SELECT id FROM public.showcase_rooms 
           WHERE asset_id = $1 
             AND visibility = 'private'
             AND (owner_user_id = $2 OR user_id = $2)`,
          [assetId, userId]
        );
        if (myPrivateRoomCheck.rows.length > 0) {
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

  // --------------------------------------------------------------------------
  // 5. GET /rooms/showcase (Vitrine de Salas)
  // Monta a vitrine com GET das showcase_rooms publicadas (qualquer conta entra)
  // mais as private do usuário logado.
  // --------------------------------------------------------------------------
  router.get(['/rooms/showcase', '/showcase_rooms', '/api/rooms/showcase', '/api/showcase_rooms'], async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const userId = getUserIdFromRequest(req);
      const db = getDatabasePool();

      // Busca: todas as públicas publicadas + privadas onde owner_user_id = userId
      const query = `
        SELECT 
          sr.id,
          sr.name,
          COALESCE(sr.title, sr.name) AS title,
          sr.description,
          COALESCE(sr.thumbnail_url, sr.cover_url) AS thumbnail_url,
          COALESCE(sr.cover_url, sr.thumbnail_url) AS cover_url,
          sr.model_url,
          sr.asset_id,
          COALESCE(sr.visibility, 'public') AS visibility,
          sr.source_room_id,
          sr.owner_user_id,
          sr.user_id,
          sr.price,
          sr.publish_mode,
          sr.is_published,
          sr.boundary,
          sr.spots,
          sr.placed_objects,
          sr.hashtags,
          sr.created_at,
          a.status AS asset_status
        FROM public.showcase_rooms sr
        LEFT JOIN public.assets a ON sr.asset_id = a.id
        WHERE (sr.is_published = TRUE AND (sr.visibility = 'public' OR sr.visibility = 'showcase' OR sr.visibility IS NULL))
           OR (sr.visibility = 'private' AND (sr.owner_user_id = $1 OR sr.user_id = $1))
        ORDER BY 
          CASE WHEN sr.visibility = 'private' THEN 0 ELSE 1 END,
          sr.created_at DESC
      `;

      const result = await db.query(query, [userId]);

      res.status(200).json({
        rooms: result.rows.map((row: any) => ({
          ...row,
          isPrivate: row.visibility === 'private',
          isOwner: row.owner_user_id === userId || row.user_id === userId,
        })),
      });
    } catch (err: any) {
      console.error('[GET /rooms/showcase error]:', err);
      res.status(500).json({
        error: err?.code || 'SHOWCASE_FETCH_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 6. POST /store/publish
  // Publicar item category=room grava store_items e, no mesmo ato,
  // showcase_rooms com is_published=true, room_id UUID do banco, owner_user_id,
  // title, cover, asset_id do GLB ready. Sem id room-<timestamp>.
  // Item 3D que não é room continua só na loja.
  // --------------------------------------------------------------------------
  router.post(['/store/publish', '/publish', '/api/store/publish', '/api/publish'], async (req: Request, res: Response): Promise<void> => {
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

      const {
        name,
        title,
        category,
        object_type,
        objectType,
        price = 0,
        hashtags = ['#comunidade', '#3d'],
        thumbnail_url,
        thumbnailUrl,
        cover_url,
        coverUrl,
        asset_id,
        assetId,
        description,
        publish_mode = 'simples',
        publishMode,
        boundary,
        spots,
        placed_objects,
        metadata = {},
      } = req.body;

      const finalName = (name || title || 'Novo Item 3D').trim();
      const finalThumb = (cover_url || coverUrl || thumbnail_url || thumbnailUrl || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80').trim();
      const finalAssetId = asset_id || assetId || metadata?.assetId || metadata?.originalItemId || null;
      const finalPublishMode = publish_mode || publishMode || 'simples';
      const finalPrice = Math.max(0, Number(price) || 0);
      const parsedTags = Array.isArray(hashtags)
        ? hashtags
        : typeof hashtags === 'string'
        ? hashtags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : ['#comunidade', '#3d'];

      // Normaliza se é room/sala
      const rawType = (object_type || objectType || category || '').toLowerCase();
      const isRoom = rawType === 'room' || rawType === 'sala';
      const dbObjectType = isRoom
        ? 'sala'
        : ['avatar', 'acessorio', 'item', 'pose', 'moveis'].includes(rawType)
        ? rawType
        : 'item';

      const db = getDatabasePool();
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        // Se houver asset_id, verifica se o asset está ready no banco
        if (finalAssetId) {
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (UUID_REGEX.test(finalAssetId)) {
            const assetCheck = await client.query(
              `SELECT id, status, storage_key FROM public.assets WHERE id = $1`,
              [finalAssetId]
            );
            if (assetCheck.rows.length === 0) {
              await client.query('ROLLBACK');
              res.status(404).json({
                error: 'ASSET_NOT_FOUND',
                message: `O asset GLB ${finalAssetId} não foi encontrado no banco de dados.`,
              });
              return;
            }
          }
        }

        let createdRoom: any = null;
        let createdStoreItem: any = null;

        if (isRoom) {
          // 1. Grava showcase_rooms no mesmo ato com UUID gerado pelo banco
          const roomInsert = await client.query(
            `INSERT INTO public.showcase_rooms (
              id,
              user_id,
              owner_user_id,
              name,
              title,
              description,
              thumbnail_url,
              cover_url,
              asset_id,
              boundary,
              spots,
              placed_objects,
              hashtags,
              price,
              publish_mode,
              is_published,
              visibility,
              created_at,
              updated_at
            ) VALUES (
              gen_random_uuid(),
              $1,
              $1,
              $2,
              $2,
              $3,
              $4,
              $4,
              $5,
              COALESCE($6, '{"x": 10, "y": 4, "z": 10, "centerX": 0, "centerZ": 0}'::jsonb),
              COALESCE($7, '[]'::jsonb),
              COALESCE($8, '[]'::jsonb),
              $9,
              $10,
              $11,
              TRUE,
              'public',
              NOW(),
              NOW()
            ) RETURNING *`,
            [
              userId,
              finalName,
              description || `Sala 3D criada por usuário`,
              finalThumb,
              finalAssetId,
              boundary ? JSON.stringify(boundary) : null,
              spots ? JSON.stringify(spots) : null,
              placed_objects ? JSON.stringify(placed_objects) : null,
              parsedTags,
              finalPrice,
              finalPublishMode,
            ]
          );

          createdRoom = roomInsert.rows[0];

          // 2. Grava store_items vinculado ao room_id UUID do showcase_rooms
          const storeInsert = await client.query(
            `INSERT INTO public.store_items (
              id,
              user_id,
              name,
              object_type,
              price,
              hashtags,
              thumbnail_url,
              asset_id,
              room_id,
              rarity,
              description,
              publish_mode,
              metadata,
              is_active,
              sales_count,
              created_at,
              updated_at
            ) VALUES (
              gen_random_uuid(),
              $1,
              $2,
              'sala',
              $3,
              $4,
              $5,
              $6,
              $7,
              'RARO',
              $8,
              $9,
              $10,
              TRUE,
              0,
              NOW(),
              NOW()
            ) RETURNING *`,
            [
              userId,
              finalName,
              finalPrice,
              parsedTags,
              finalThumb,
              finalAssetId,
              createdRoom.id, // room_id UUID do banco, sem timestamp!
              description || `Sala 3D criada por usuário`,
              finalPublishMode,
              JSON.stringify({
                ...metadata,
                roomId: createdRoom.id,
                assetId: finalAssetId,
                cover: finalThumb,
              }),
            ]
          );

          createdStoreItem = storeInsert.rows[0];
        } else {
          // Item 3D que não é room continua SÓ na loja!
          const storeInsert = await client.query(
            `INSERT INTO public.store_items (
              id,
              user_id,
              name,
              object_type,
              price,
              hashtags,
              thumbnail_url,
              asset_id,
              rarity,
              description,
              publish_mode,
              metadata,
              is_active,
              sales_count,
              created_at,
              updated_at
            ) VALUES (
              gen_random_uuid(),
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              'COMUM',
              $8,
              $9,
              $10,
              TRUE,
              0,
              NOW(),
              NOW()
            ) RETURNING *`,
            [
              userId,
              finalName,
              dbObjectType,
              finalPrice,
              parsedTags,
              finalThumb,
              finalAssetId,
              description || `Item 3D criado por usuário`,
              finalPublishMode,
              JSON.stringify(metadata),
            ]
          );

          createdStoreItem = storeInsert.rows[0];
        }

        // Se houver asset_id, registra no inventário do criador
        if (finalAssetId) {
          await client.query(
            `INSERT INTO public.inventory_items (user_id, asset_id, custom_label)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, asset_id) DO NOTHING`,
            [userId, finalAssetId, finalName]
          );
        }

        await client.query('COMMIT');

        res.status(201).json({
          success: true,
          room: createdRoom,
          item: createdStoreItem,
          room_id: createdRoom?.id || null,
          store_item_id: createdStoreItem?.id,
          message: isRoom ? 'Sala publicada na Loja e na Vitrine com sucesso!' : 'Item publicado na Loja com sucesso!',
        });
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[POST /store/publish error]:', err);
      res.status(500).json({
        error: err?.code || 'PUBLISH_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 7. POST /store/buy
  // Comprar sala de outro usuário cria linha nova:
  // owner=comprador, source_room_id=original, visibility=private,
  // asset e capa por ponteiro, não cópia do binário.
  // Card só na vitrine dele, filete vermelho.
  // Compra repetida devolve a privada já criada.
  // --------------------------------------------------------------------------
  router.post(['/store/buy', '/api/store/buy', '/rooms/buy', '/api/rooms/buy', '/rooms/:roomId/buy', '/api/rooms/:roomId/buy'], async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const buyerUserId = getUserIdFromRequest(req);
      if (!buyerUserId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const roomId = req.params.roomId || req.body.room_id || req.body.roomId;
      const storeItemId = req.body.store_item_id || req.body.storeItemId || req.body.itemId;

      const db = getDatabasePool();
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        // Localiza a sala original ou pelo roomId ou pelo storeItemId
        let originalRoom: any = null;

        if (roomId) {
          const roomCheck = await client.query(
            `SELECT * FROM public.showcase_rooms WHERE id = $1`,
            [roomId]
          );
          if (roomCheck.rows.length > 0) {
            originalRoom = roomCheck.rows[0];
          }
        }

        if (!originalRoom && storeItemId) {
          const itemCheck = await client.query(
            `SELECT si.*, sr.id AS linked_room_id 
             FROM public.store_items si
             LEFT JOIN public.showcase_rooms sr ON si.room_id = sr.id
             WHERE si.id = $1`,
            [storeItemId]
          );
          if (itemCheck.rows.length > 0) {
            const item = itemCheck.rows[0];
            if (item.room_id) {
              const rRes = await client.query(
                `SELECT * FROM public.showcase_rooms WHERE id = $1`,
                [item.room_id]
              );
              if (rRes.rows.length > 0) originalRoom = rRes.rows[0];
            } else if (item.asset_id) {
              const rRes = await client.query(
                `SELECT * FROM public.showcase_rooms WHERE asset_id = $1 LIMIT 1`,
                [item.asset_id]
              );
              if (rRes.rows.length > 0) originalRoom = rRes.rows[0];
            }
          }
        }

        if (!originalRoom) {
          await client.query('ROLLBACK');
          res.status(404).json({
            error: 'ROOM_NOT_FOUND',
            message: 'A sala solicitada para compra não foi encontrada.',
          });
          return;
        }

        // Se a sala encontrada já for privada de outro usuário (source de outra), busca a original base
        const sourceOriginalId = originalRoom.source_room_id || originalRoom.id;

        // Idempotência: "Compra repetida devolve a privada já criada."
        const existingPrivateCheck = await client.query(
          `SELECT * FROM public.showcase_rooms 
           WHERE source_room_id = $1 
             AND (owner_user_id = $2 OR user_id = $2) 
             AND visibility = 'private'
           LIMIT 1`,
          [sourceOriginalId, buyerUserId]
        );

        if (existingPrivateCheck.rows.length > 0) {
          const existingRoom = existingPrivateCheck.rows[0];
          await client.query('COMMIT');
          res.status(200).json({
            success: true,
            is_existing: true,
            room: {
              ...existingRoom,
              isPrivate: true,
              isOwner: true,
            },
            message: 'Sala privada já adquirida anteriormente pelo usuário.',
          });
          return;
        }

        // Criação de linha nova:
        // owner=comprador, source_room_id=original, visibility=private,
        // asset e capa por ponteiro, não cópia do binário.
        const insertPrivateRoom = await client.query(
          `INSERT INTO public.showcase_rooms (
            id,
            owner_user_id,
            user_id,
            source_room_id,
            visibility,
            name,
            title,
            description,
            thumbnail_url,
            cover_url,
            model_url,
            asset_id,
            boundary,
            spots,
            placed_objects,
            hashtags,
            price,
            publish_mode,
            is_published,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            $1,
            $1,
            $2,
            'private',
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            0,
            $14,
            TRUE,
            NOW(),
            NOW()
          ) RETURNING *`,
          [
            buyerUserId,
            sourceOriginalId,
            originalRoom.name,
            originalRoom.title || originalRoom.name,
            originalRoom.description,
            originalRoom.thumbnail_url, // Ponteiro para a capa original
            originalRoom.cover_url || originalRoom.thumbnail_url,
            originalRoom.model_url,
            originalRoom.asset_id,      // Ponteiro para o asset original (sem cópia binária)
            originalRoom.boundary,
            originalRoom.spots,
            originalRoom.placed_objects,
            originalRoom.hashtags,
            originalRoom.publish_mode || 'simples',
          ]
        );

        const newPrivateRoom = insertPrivateRoom.rows[0];

        // Registra o asset no inventário do comprador (ponteiro)
        if (originalRoom.asset_id) {
          await client.query(
            `INSERT INTO public.inventory_items (user_id, asset_id, custom_label)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, asset_id) DO NOTHING`,
            [buyerUserId, originalRoom.asset_id, originalRoom.name]
          );
        }

        // Incrementa contador de vendas no store_items
        if (sourceOriginalId) {
          await client.query(
            `UPDATE public.store_items 
             SET sales_count = sales_count + 1 
             WHERE room_id = $1 OR asset_id = $2`,
            [sourceOriginalId, originalRoom.asset_id]
          );
        }

        await client.query('COMMIT');

        res.status(201).json({
          success: true,
          is_existing: false,
          room: {
            ...newPrivateRoom,
            isPrivate: true,
            isOwner: true,
          },
          message: 'Sala adquirida com sucesso! Cópia privada com filete vermelho criada na sua vitrine.',
        });
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[POST /store/buy error]:', err);
      res.status(500).json({
        error: err?.code || 'BUY_ROOM_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 8. GET /store/items (Listagem completa da loja)
  // A loja continua listando item publicado de qualquer tipo, inclusive room.
  // --------------------------------------------------------------------------
  router.get(['/store/items', '/store_items', '/api/store/items', '/api/store_items'], async (_req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const db = getDatabasePool();
      const query = `
        SELECT 
          si.id,
          si.user_id,
          si.name,
          si.object_type,
          si.price,
          si.hashtags,
          si.thumbnail_url,
          si.asset_url,
          si.asset_id,
          si.room_id,
          si.rarity,
          si.description,
          si.publish_mode,
          si.metadata,
          si.sales_count,
          si.created_at,
          sr.visibility AS room_visibility,
          COALESCE(sr.title, sr.name) AS room_title
        FROM public.store_items si
        LEFT JOIN public.showcase_rooms sr ON si.room_id = sr.id
        WHERE si.is_active = TRUE
        ORDER BY si.created_at DESC
      `;

      const result = await db.query(query);

      res.status(200).json({
        items: result.rows,
      });
    } catch (err: any) {
      console.error('[GET /store/items error]:', err);
      res.status(500).json({
        error: err?.code || 'STORE_ITEMS_FETCH_FAILED',
        message: sanitizeErrorMessage(err),
      });
    }
  });

  return router;
}
