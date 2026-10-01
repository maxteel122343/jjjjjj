import { Pool } from 'pg';
import { randomUUID } from 'crypto';

interface MockAsset {
  id: string;
  owner_user_id: string;
  storage_bucket: string;
  storage_key: string;
  mime_type: string;
  byte_size: number | string;
  sha256_checksum: string;
  status: string;
  category: string;
  format: string;
  visibility?: string;
  etag?: string;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

interface MockSession {
  id: string;
  asset_id: string;
  owner_user_id: string;
  idempotency_key: string;
  upload_type: string;
  expected_byte_size: number | string;
  expected_sha256: string;
  presigned_put_url: string;
  expires_at: Date | string;
  is_completed: boolean;
}

interface MockInventoryItem {
  id: string;
  user_id: string;
  asset_id: string;
  custom_label: string;
  acquired_at: string;
  is_archived: boolean;
}

const mockAssets = new Map<string, MockAsset>();
const mockSessions = new Map<string, MockSession>();
const mockInventoryItems = new Map<string, MockInventoryItem>();

function createMockPool(): Pool {
  const queryHandler = async (text: string, params: any[] = []) => {
    const cleanText = text.trim();
    const upperText = cleanText.toUpperCase();

    if (upperText === 'BEGIN' || upperText === 'COMMIT' || upperText === 'ROLLBACK') {
      return { rows: [] };
    }

    // 1. INSERT INTO public.assets
    if (upperText.startsWith('INSERT INTO PUBLIC.ASSETS')) {
      const id = randomUUID();
      const asset: MockAsset = {
        id,
        owner_user_id: params[0] || 'user-default',
        storage_bucket: params[1] || 'in-memory-bucket',
        storage_key: 'pending_allocation',
        mime_type: 'model/gltf-binary',
        byte_size: params[2] || 0,
        sha256_checksum: params[3] || '',
        status: 'uploading',
        category: params[4] || 'item',
        format: 'glb',
        visibility: 'private',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockAssets.set(id, asset);
      return { rows: [{ id }] };
    }

    // 2. UPDATE public.assets SET storage_key = $1 WHERE id = $2
    if (upperText.includes('UPDATE PUBLIC.ASSETS SET STORAGE_KEY')) {
      const storageKey = params[0];
      const assetId = params[1];
      const asset = mockAssets.get(assetId);
      if (asset) {
        asset.storage_key = storageKey;
        asset.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    // 3. INSERT INTO public.asset_upload_sessions
    if (upperText.startsWith('INSERT INTO PUBLIC.ASSET_UPLOAD_SESSIONS')) {
      const sessionId = randomUUID();
      const session: MockSession = {
        id: sessionId,
        asset_id: params[0],
        owner_user_id: params[1],
        idempotency_key: params[2] || sessionId,
        upload_type: 'single_put',
        expected_byte_size: params[3],
        expected_sha256: params[4],
        presigned_put_url: params[5],
        expires_at: params[6] || new Date(Date.now() + 15 * 60 * 1000),
        is_completed: false,
      };
      mockSessions.set(sessionId, session);
      return { rows: [{ id: sessionId }] };
    }

    // 4. SELECT FROM public.asset_upload_sessions (idempotency check)
    if (upperText.includes('FROM PUBLIC.ASSET_UPLOAD_SESSIONS')) {
      const userId = params[0];
      const idempotencyKey = params[1];
      const matches = Array.from(mockSessions.values()).filter(
        (s) => s.owner_user_id === userId && s.idempotency_key === idempotencyKey
      );
      return {
        rows: matches.map((s) => ({
          upload_id: s.id,
          asset_id: s.asset_id,
          presigned_put_url: s.presigned_put_url,
          expires_at: s.expires_at,
          is_completed: s.is_completed,
        })),
      };
    }

    // 5. UPDATE public.asset_upload_sessions SET is_completed = TRUE
    if (upperText.includes('UPDATE PUBLIC.ASSET_UPLOAD_SESSIONS SET IS_COMPLETED = TRUE')) {
      const assetId = params[0];
      for (const s of mockSessions.values()) {
        if (s.asset_id === assetId) {
          s.is_completed = true;
        }
      }
      return { rows: [] };
    }

    // 6. UPDATE public.assets SET status = 'ready' (completion)
    if (upperText.includes("UPDATE PUBLIC.ASSETS") && upperText.includes("STATUS = 'READY'")) {
      const etag = params[0];
      const assetId = params[1];
      const asset = mockAssets.get(assetId);
      if (asset) {
        asset.status = 'ready';
        asset.etag = etag;
        asset.failure_reason = null;
        asset.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    // 7. UPDATE public.assets SET status = 'failed'
    if (upperText.includes("UPDATE PUBLIC.ASSETS") && upperText.includes("STATUS = 'FAILED'")) {
      const assetId = params[0];
      const asset = mockAssets.get(assetId);
      if (asset) {
        asset.status = 'failed';
        asset.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    // 8. INSERT INTO public.inventory_items
    if (upperText.startsWith('INSERT INTO PUBLIC.INVENTORY_ITEMS')) {
      const userId = params[0];
      const assetId = params[1];
      const label = params[2] || 'Modelo 3D';
      const key = `${userId}:${assetId}`;
      if (!mockInventoryItems.has(key)) {
        mockInventoryItems.set(key, {
          id: randomUUID(),
          user_id: userId,
          asset_id: assetId,
          custom_label: label,
          acquired_at: new Date().toISOString(),
          is_archived: false,
        });
      }
      return { rows: [] };
    }

    // 9. SELECT FROM public.inventory_items JOIN public.assets (GET /inventory)
    if (upperText.includes('FROM PUBLIC.INVENTORY_ITEMS II') && upperText.includes('JOIN PUBLIC.ASSETS A')) {
      const userId = params[0];
      const items = Array.from(mockInventoryItems.values())
        .filter((ii) => ii.user_id === userId && !ii.is_archived)
        .map((ii) => {
          const a = mockAssets.get(ii.asset_id);
          if (!a || a.status !== 'ready') return null;
          return {
            inventory_item_id: ii.id,
            custom_label: ii.custom_label,
            acquired_at: ii.acquired_at,
            asset_id: a.id,
            storage_key: a.storage_key,
            mime_type: a.mime_type,
            byte_size: a.byte_size,
            sha256_checksum: a.sha256_checksum,
            category: a.category,
          };
        })
        .filter(Boolean);
      return { rows: items };
    }

    // 10. SELECT FROM public.inventory_items WHERE user_id = $1 AND asset_id = $2
    if (upperText.includes('FROM PUBLIC.INVENTORY_ITEMS WHERE USER_ID')) {
      const userId = params[0];
      const assetId = params[1];
      const key = `${userId}:${assetId}`;
      const item = mockInventoryItems.get(key);
      return { rows: item ? [item] : [] };
    }

    // 11. SELECT FROM public.assets WHERE id = $1
    if (upperText.includes('FROM PUBLIC.ASSETS WHERE ID = $1')) {
      const assetId = params[0];
      const asset = mockAssets.get(assetId);
      if (!asset) return { rows: [] };
      // If user check is also in query
      if (upperText.includes('OWNER_USER_ID = $2')) {
        const userId = params[1];
        if (asset.owner_user_id !== userId) return { rows: [] };
      }
      return { rows: [asset] };
    }

    // Fallback for any other query
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

export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[AI Studio] DATABASE_URL não configurada — mock em memória ativo');
      pool = createMockPool();
      return pool;
    }

    try {
      const isSsl = connectionString.includes('sslmode=require') || connectionString.includes('supabase.co');
      pool = new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
        max: 5,
      });
    } catch {
      console.warn('[AI Studio] Falha ao inicializar pool do PostgreSQL — mock ativo');
      pool = createMockPool();
    }
  }

  return pool;
}

export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getDatabasePool() as any)[prop];
  },
});

