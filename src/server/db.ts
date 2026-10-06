import { Pool } from 'pg';
import { randomUUID } from 'crypto';

interface MockAsset {
  id: string;
  owner_user_id: string;
  storage_bucket: string;
  storage_key: string;
  mime_type: string;
  byte_size: number;
  sha256_checksum: string;
  status: string;
  category: string;
  format: string;
  visibility: string;
  etag?: string;
  failure_reason?: string | null;
  updated_at?: Date;
  created_at: Date;
}

interface MockSession {
  id: string;
  asset_id: string;
  owner_user_id: string;
  idempotency_key: string;
  upload_type: string;
  expected_byte_size: number;
  expected_sha256: string;
  presigned_put_url: string;
  expires_at: Date;
  is_completed: boolean;
}

interface MockInventoryItem {
  id: string;
  user_id: string;
  asset_id: string;
  custom_label: string;
  is_archived: boolean;
  acquired_at: Date;
}

const mockAssets = new Map<string, MockAsset>();
const mockSessions = new Map<string, MockSession>();
const mockInventoryItems = new Map<string, MockInventoryItem>();

function createMockPool() {
  const queryHandler = async (text: string, params: any[] = []) => {
    const cleanText = text.trim();
    const upperText = cleanText.toUpperCase();

    if (upperText === 'BEGIN' || upperText === 'COMMIT' || upperText === 'ROLLBACK') {
      return { rows: [] };
    }

    // 1. INSERT INTO public.assets
    if (upperText.includes('INSERT INTO PUBLIC.ASSETS')) {
      const assetId = randomUUID();
      const [owner_user_id, storage_bucket, byte_size, sha256_checksum, category] = params;
      const asset: MockAsset = {
        id: assetId,
        owner_user_id: owner_user_id || 'user-default',
        storage_bucket: storage_bucket || 'mock-bucket',
        storage_key: 'pending_allocation',
        mime_type: 'model/gltf-binary',
        byte_size: Number(byte_size) || 0,
        sha256_checksum: sha256_checksum || '',
        status: 'uploading',
        category: category || 'item',
        format: 'glb',
        visibility: 'private',
        created_at: new Date(),
      };
      mockAssets.set(assetId, asset);
      return { rows: [{ id: assetId }] };
    }

    // 2. UPDATE public.assets SET storage_key = $1 WHERE id = $2
    if (upperText.includes('UPDATE PUBLIC.ASSETS SET STORAGE_KEY')) {
      const [storageKey, assetId] = params;
      const asset = mockAssets.get(assetId);
      if (asset) {
        asset.storage_key = storageKey;
      }
      return { rows: [] };
    }

    // 3. INSERT INTO public.asset_upload_sessions
    if (upperText.includes('INSERT INTO PUBLIC.ASSET_UPLOAD_SESSIONS')) {
      const sessionId = randomUUID();
      const [assetId, owner_user_id, idempotencyKey, byte_size, sha256, presignedPutUrl, expiresAt] = params;
      const session: MockSession = {
        id: sessionId,
        asset_id: assetId,
        owner_user_id: owner_user_id || 'user-default',
        idempotency_key: idempotencyKey || assetId,
        upload_type: 'single_put',
        expected_byte_size: Number(byte_size) || 0,
        expected_sha256: sha256 || '',
        presigned_put_url: presignedPutUrl || '',
        expires_at: expiresAt || new Date(Date.now() + 15 * 60 * 1000),
        is_completed: false,
      };
      mockSessions.set(sessionId, session);
      return { rows: [{ id: sessionId }] };
    }

    // 4. SELECT from asset_upload_sessions (idempotency check)
    if (upperText.includes('FROM PUBLIC.ASSET_UPLOAD_SESSIONS')) {
      const [owner_user_id, idempotency_key] = params;
      const found = Array.from(mockSessions.values()).find(
        (s) => s.owner_user_id === owner_user_id && s.idempotency_key === idempotency_key
      );
      if (found) {
        return {
          rows: [
            {
              upload_id: found.id,
              asset_id: found.asset_id,
              presigned_put_url: found.presigned_put_url,
              expires_at: found.expires_at,
              is_completed: found.is_completed,
            },
          ],
        };
      }
      return { rows: [] };
    }

    // 5. SELECT from assets WHERE id = $1
    if (upperText.includes('FROM PUBLIC.ASSETS') && upperText.includes('WHERE ID = $1')) {
      const [assetId] = params;
      const asset = mockAssets.get(assetId);
      if (asset) {
        return {
          rows: [
            {
              id: asset.id,
              owner_user_id: asset.owner_user_id,
              storage_key: asset.storage_key,
              mime_type: asset.mime_type,
              byte_size: asset.byte_size,
              sha256_checksum: asset.sha256_checksum,
              status: asset.status,
              visibility: asset.visibility,
            },
          ],
        };
      }
      return { rows: [] };
    }

    // 6. UPDATE public.assets SET status = 'ready'
    if (upperText.includes('UPDATE PUBLIC.ASSETS') && upperText.includes("STATUS = 'READY'")) {
      const [etag, assetId] = params;
      const asset = mockAssets.get(assetId);
      if (asset) {
        asset.status = 'ready';
        asset.etag = etag;
        asset.failure_reason = null;
        asset.updated_at = new Date();
      }
      return { rows: [] };
    }

    // 7. INSERT INTO public.inventory_items
    if (upperText.includes('INSERT INTO PUBLIC.INVENTORY_ITEMS')) {
      const [userId, assetId, customLabel] = params;
      const invId = randomUUID();
      const existing = Array.from(mockInventoryItems.values()).find(
        (i) => i.user_id === userId && i.asset_id === assetId
      );
      if (!existing) {
        mockInventoryItems.set(invId, {
          id: invId,
          user_id: userId,
          asset_id: assetId,
          custom_label: customLabel || 'Modelo 3D',
          is_archived: false,
          acquired_at: new Date(),
        });
      }
      return { rows: [] };
    }

    // 8. UPDATE public.asset_upload_sessions SET is_completed = TRUE
    if (upperText.includes('UPDATE PUBLIC.ASSET_UPLOAD_SESSIONS')) {
      const [assetId] = params;
      for (const session of mockSessions.values()) {
        if (session.asset_id === assetId) {
          session.is_completed = true;
        }
      }
      return { rows: [] };
    }

    // 9. SELECT inventory items joined with assets
    if (upperText.includes('FROM PUBLIC.INVENTORY_ITEMS II') && upperText.includes('INNER JOIN PUBLIC.ASSETS A')) {
      const [userId] = params;
      const items: any[] = [];
      for (const inv of mockInventoryItems.values()) {
        if (inv.user_id === userId && !inv.is_archived) {
          const asset = mockAssets.get(inv.asset_id);
          if (asset && asset.status === 'ready') {
            items.push({
              inventory_item_id: inv.id,
              custom_label: inv.custom_label,
              acquired_at: inv.acquired_at,
              asset_id: asset.id,
              storage_key: asset.storage_key,
              mime_type: asset.mime_type,
              byte_size: asset.byte_size,
              sha256_checksum: asset.sha256_checksum,
              category: asset.category,
            });
          }
        }
      }
      return { rows: items };
    }

    // 10. SELECT id FROM public.inventory_items WHERE user_id = $1 AND asset_id = $2
    if (upperText.includes('FROM PUBLIC.INVENTORY_ITEMS') && upperText.includes('WHERE USER_ID = $1')) {
      const [userId, assetId] = params;
      const found = Array.from(mockInventoryItems.values()).find(
        (i) => i.user_id === userId && i.asset_id === assetId
      );
      return { rows: found ? [{ id: found.id }] : [] };
    }

    return { rows: [] };
  };

  return {
    query: queryHandler,
    connect: async () => ({
      query: queryHandler,
      release: () => {},
    }),
  } as unknown as Pool;
}

let pool: Pool | null = null;
let mockPoolInstance: Pool | null = null;
let forceMock = false;

function getMockPool(): Pool {
  if (!mockPoolInstance) {
    mockPoolInstance = createMockPool();
  }
  return mockPoolInstance;
}

export function getDatabasePool(): Pool {
  if (forceMock || !process.env.DATABASE_URL) {
    return getMockPool();
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    try {
      const isSsl = connectionString.includes('sslmode=require') || connectionString.includes('supabase.co');
      const realPool = new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 3000,
        max: 5,
      });

      pool = new Proxy(realPool, {
        get(target, prop) {
          if (forceMock) {
            return (getMockPool() as any)[prop];
          }
          if (prop === 'connect') {
            return async () => {
              try {
                return await target.connect();
              } catch (connectErr) {
                console.warn('[AI Studio] PostgreSQL connect failed, falling back to mock:', connectErr);
                forceMock = true;
                return getMockPool().connect();
              }
            };
          }
          if (prop === 'query') {
            return async (...args: any[]) => {
              try {
                return await (target as any).query(...args);
              } catch (queryErr) {
                console.warn('[AI Studio] PostgreSQL query failed, falling back to mock:', queryErr);
                forceMock = true;
                return (getMockPool() as any).query(...args);
              }
            };
          }
          return (target as any)[prop];
        },
      });
    } catch {
      console.warn('[AI Studio] Falha ao inicializar pool do PostgreSQL — mock ativo');
      forceMock = true;
      return getMockPool();
    }
  }

  return pool;
}

export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getDatabasePool() as any)[prop];
  },
});


