import express, { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { Pool } from 'pg';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Sanitiza mensagens de erro removendo senhas e secrets
export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'Erro interno do servidor';
  let msg = typeof err === 'string' ? err : (err as any).message || String(err);

  // Remove senhas de URLs de conexão (ex: postgresql://user:PASSWORD@host...)
  msg = msg.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1***$3');

  // Remove secrets de chaves S3
  const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACC;
  if (secretKey && secretKey.length > 3) {
    msg = msg.split(secretKey).join('***');
  }
  const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
  if (accessKey && accessKey.length > 3) {
    msg = msg.split(accessKey).join('***');
  }

  // Remove assinaturas AWS
  msg = msg.replace(/(X-Amz-Signature=|Signature=)[a-zA-Z0-9_-]+/gi, '$1***');

  return msg;
}

function getAccessKeyId(): string | undefined {
  return process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
}

function getSecretAccessKey(): string | undefined {
  return process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACC;
}

function getMissingStorageEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.S3_ENDPOINT || !process.env.S3_ENDPOINT.trim()) missing.push('S3_ENDPOINT');
  if (!process.env.S3_BUCKET || !process.env.S3_BUCKET.trim()) missing.push('S3_BUCKET');
  if (!getAccessKeyId()) missing.push('S3_ACCESS_KEY_ID');
  if (!getSecretAccessKey()) missing.push('S3_SECRET_ACCESS_KEY');
  if (!process.env.S3_REGION || !process.env.S3_REGION.trim()) missing.push('S3_REGION');
  return missing;
}

export function checkServerConfig(): { error: 'DATABASE_CONFIG_MISSING' | 'STORAGE_CONFIG_MISSING'; message: string } | null {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    return {
      error: 'DATABASE_CONFIG_MISSING',
      message: 'Variável ausente: DATABASE_URL',
    };
  }

  const missingS3 = getMissingStorageEnv();
  if (missingS3.length > 0) {
    return {
      error: 'STORAGE_CONFIG_MISSING',
      message: `Variável ausente: ${missingS3.join(', ')}`,
    };
  }

  return null;
}

// Inicialização Lazy do Pool PostgreSQL
let poolInstance: Pool | null = null;

function getDatabasePool(): Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_CONFIG_MISSING: Variável ausente: DATABASE_URL');
    }

    const isSsl = connectionString.includes('sslmode=require') || connectionString.includes('supabase.co');
    poolInstance = new Pool({
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000,
      max: 5,
    });
  }
  return poolInstance;
}

// Inicialização Lazy do Cliente S3
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  const missing = getMissingStorageEnv();
  if (missing.length > 0) {
    throw new Error(`STORAGE_CONFIG_MISSING: Variável ausente: ${missing.join(', ')}`);
  }

  let endpoint = process.env.S3_ENDPOINT!.trim();
  if (endpoint.includes('supabase.co') && !endpoint.includes('/storage/v1/s3')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/storage/v1/s3';
  }

  const accessKey = getAccessKeyId()!;
  const secretKey = getSecretAccessKey()!;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint,
      region: process.env.S3_REGION?.trim() || 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey.trim(),
        secretAccessKey: secretKey.trim(),
      },
    });
  }

  return s3ClientInstance;
}

const storageService = {
  getBucket(): string {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('STORAGE_CONFIG_MISSING: Variável ausente: S3_BUCKET');
    return bucket.trim();
  },

  async generatePresignedPutUrl(params: {
    storageKey: string;
    byteSize: number;
    sha256Hex: string;
  }): Promise<string> {
    const client = getS3Client();
    const bucket = this.getBucket();
    const sha256Base64 = Buffer.from(params.sha256Hex, 'hex').toString('base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.storageKey,
      ContentType: 'model/gltf-binary',
      ContentLength: params.byteSize,
      ChecksumSHA256: sha256Base64,
    });

    return getSignedUrl(client, command, {
      expiresIn: 900,
      signableHeaders: new Set(['content-type', 'content-length', 'x-amz-checksum-sha256']),
    });
  },

  async headObject(storageKey: string): Promise<{ contentLength: number; etag: string; checksumSha256?: string }> {
    const client = getS3Client();
    const bucket = this.getBucket();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ChecksumMode: 'ENABLED',
    });

    const res = await client.send(command);
    if (res.ContentLength === undefined || !res.ETag) {
      throw new Error('STORAGE_EMPTY_OR_UNAVAILABLE');
    }

    return {
      contentLength: res.ContentLength,
      etag: res.ETag.replace(/"/g, ''),
      checksumSha256: res.ChecksumSHA256,
    };
  },

  async generatePresignedGetUrl(params: {
    storageKey: string;
    filename: string;
  }): Promise<string> {
    const client = getS3Client();
    const bucket = this.getBucket();

    const sanitized = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const baseName = sanitized.replace(/(\.glb)+$/i, '');
    const safeFilename = `${baseName}.glb`;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: params.storageKey,
      ResponseContentType: 'model/gltf-binary',
      ResponseContentDisposition: `inline; filename="${safeFilename}"`,
    });

    return getSignedUrl(client, command, {
      expiresIn: 600,
    });
  },
};

function ensureValidUUID(id: string | null | undefined): string {
  if (!id || typeof id !== 'string') {
    id = 'user-default';
  }
  const clean = id.trim().toLowerCase();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (uuidRegex.test(clean)) {
    return clean;
  }
  const hash = createHash('md5').update(clean).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

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
    } catch {}
    return ensureValidUUID(token);
  }

  return ensureValidUUID('user-default');
}

function buildRouter(): express.Router {
  const router = express.Router();

  // POST /assets/upload/init
  router.post(['/assets/upload/init', '/assets/uploads'], async (req: Request, res: Response): Promise<void> => {
    try {
      const configError = checkServerConfig();
      if (configError) {
        res.status(500).json(configError);
        return;
      }

      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de autenticação ou cabeçalho x-user-id obrigatório.' });
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

      let db: Pool;
      try {
        db = getDatabasePool();
      } catch (poolErr: any) {
        res.status(500).json({ error: 'DATABASE_CONFIG_MISSING', message: sanitizeErrorMessage(poolErr) });
        return;
      }

      let client: any = null;
      try {
        client = await db.connect();
      } catch (connectErr: any) {
        res.status(500).json({
          error: 'DATABASE_CONNECTION_ERROR',
          message: `Falha na conexão com PostgreSQL: ${sanitizeErrorMessage(connectErr)}`,
        });
        return;
      }

      try {
        await client.query('BEGIN');

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
          try { await client.query('ROLLBACK'); } catch {}
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

  // POST /assets/:assetId/complete
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

        if (head.contentLength !== Number(asset.byte_size)) {
          await client.query(
            `UPDATE public.assets SET status = 'failed', failure_reason = 'BYTE_SIZE_MISMATCH' WHERE id = $1`,
            [assetId]
          );
          await client.query('COMMIT');
          res.status(422).json({
            error: 'BYTE_SIZE_MISMATCH',
            message: `Tamanho divergente. Esperado: ${asset.byte_size}, Recebido: ${head.contentLength}`,
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
          try { await client.query('ROLLBACK'); } catch {}
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

  // GET /assets/:assetId/resolve
  router.get(['/assets/:assetId/resolve', '/assets/:assetId', '/assets/:id/resolve', '/assets/:id'], async (req: Request, res: Response): Promise<void> => {
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
        res.status(409).json({ error: 'ASSET_NOT_READY', message: 'Asset não está pronto para download.', current_status: asset.status });
        return;
      }

      // Validação de privacidade: se for de outra conta e privado, bloqueia
      const isOwner = asset.owner_user_id === userId;
      const isPublic = asset.visibility === 'public_marketplace';
      if (!isOwner && !isPublic) {
        const invCheck = await db.query(
          `SELECT id FROM public.inventory_items WHERE user_id = $1 AND asset_id = $2`,
          [userId, assetId]
        );
        if (invCheck.rows.length === 0) {
          res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Sem permissão para acessar este item privado de outra conta.',
          });
          return;
        }
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

  // GET /inventory
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

      let db: Pool;
      try {
        db = getDatabasePool();
      } catch (poolErr: any) {
        res.status(500).json({
          error: 'DATABASE_CONFIG_MISSING',
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

let cachedApp: express.Express | null = null;

function getExpressApp(): express.Express {
  if (!cachedApp) {
    const app = express();
    app.use(express.json({ limit: '50mb' }));

    app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigin = process.env.APP_ORIGIN || origin || '*';
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, x-user-id');
      res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length');

      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });

    const router = buildRouter();
    app.use('/api/v1', router);
    app.use('/v1', router);
    app.use('/api', router);
    app.use('/', router);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[API Express Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err?.code || 'INTERNAL_SERVER_ERROR',
          message: sanitizeErrorMessage(err?.message || 'Erro interno do servidor'),
        });
      }
    });

    cachedApp = app;
  }
  return cachedApp;
}

/**
 * Handler Serverless invocado pela plataforma Vercel no runtime Node.js.
 * Todas as validações de process.env ocorrem dentro do handler no momento da requisição.
 */
export default async function handler(req: any, res: any) {
  // CORS Preflight
  const origin = req.headers?.origin;
  const allowedOrigin = process.env.APP_ORIGIN || origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, x-user-id');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Validação de process.env LIDA DENTRO DO HANDLER no momento da invocação
  const configError = checkServerConfig();
  if (configError) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify(configError));
    return;
  }

  // 2. Execução protegida por try/catch garantindo resposta JSON
  try {
    const app = getExpressApp();
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler Exception]:', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: err?.code || 'HANDLER_EXECUTION_ERROR',
          message: sanitizeErrorMessage(err),
        })
      );
    }
  }
}
