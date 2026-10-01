/**
 * Cliente de persistência 3D para upload direto em S3/R2 e resgate cross-device com cache ETag.
 * Binários nunca passam pelo servidor Express nem são convertidos em base64.
 */

export interface UploadProgressCallback {
  (percentage: number): void;
}

export interface StorageConfigHealth {
  storage_configured: boolean;
  missing_storage_env: string[];
  database_configured: boolean;
  bucket: string | null;
  region: string | null;
}

export interface InventoryAssetItem {
  inventory_item_id: string;
  asset_id: string;
  custom_label: string;
  category: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  filename: string;
  download_url: string;
  acquired_at: string;
}

export async function checkStorageHealth(): Promise<StorageConfigHealth> {
  try {
    const res = await fetch('/api/v1/assets/health/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      storage_configured: false,
      missing_storage_env: ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION'],
      database_configured: false,
      bucket: null,
      region: null,
    };
  }
}

// 1. Calcula SHA-256 no browser
export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 2. Upload direto ao Object Storage com confirmação em duas etapas
export async function uploadGlbDirect(
  file: File,
  category: 'avatar' | 'accessory' | 'furniture' | 'room_mesh' | 'prop',
  userId: string,
  authToken?: string,
  onProgress?: UploadProgressCallback,
  abortSignal?: AbortSignal
): Promise<{ asset_id: string; upload_id: string }> {
  const sha256Hex = await computeFileSha256(file);
  const idempotencyKey = crypto.randomUUID();

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
    'x-user-id': userId,
  };
  if (authToken) {
    authHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  // Etapa 1: POST /api/v1/assets/upload/init
  const initRes = await fetch('/api/v1/assets/upload/init', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      filename: file.name,
      byte_size: file.size,
      sha256: sha256Hex,
      category,
      format: 'glb',
    }),
    signal: abortSignal,
  });

  if (!initRes.ok) {
    const errBody = await initRes.json().catch(() => ({}));
    throw new Error(errBody.message || `INIT_FAILED_HTTP_${initRes.status}`);
  }

  const { asset_id, upload_id, upload_url, required_headers } = await initRes.json();

  // Etapa 2: PUT direto no Object Storage S3/R2
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload_url, true);

    for (const [key, value] of Object.entries(required_headers || {})) {
      xhr.setRequestHeader(key, value as string);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`STORAGE_PUT_FAILED: HTTP ${xhr.status} - ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('NETWORK_ERROR_DURING_STORAGE_PUT'));

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('UPLOAD_ABORTED'));
      });
    }

    xhr.send(file);
  });

  // Etapa 3: POST /assets/{assetId}/complete
  const completeRes = await fetch(`/api/v1/assets/${asset_id}/complete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
    signal: abortSignal,
  });

  if (!completeRes.ok) {
    const errBody = await completeRes.json().catch(() => ({}));
    throw new Error(errBody.message || `COMPLETE_FAILED_HTTP_${completeRes.status}`);
  }

  return { asset_id, upload_id };
}

// 3. Resgate Cross-Device com CacheStorage e ETag
const CACHE_NAME = '3d-social-gltf-cache-v1';

export async function fetchGlbWithCache(
  assetId: string,
  userId: string,
  authToken?: string,
  roomId?: string
): Promise<{ buffer: ArrayBuffer; filename: string; mimeType: string }> {
  const authHeaders: Record<string, string> = {
    'x-user-id': userId,
  };
  if (authToken) {
    authHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const endpoint = roomId
    ? `/api/v1/assets/${assetId}/resolve?room_id=${encodeURIComponent(roomId)}`
    : `/api/v1/assets/${assetId}/resolve`;

  const resolveRes = await fetch(endpoint, {
    headers: authHeaders,
  });

  if (!resolveRes.ok) {
    throw new Error(`RESOLVE_FAILED_HTTP_${resolveRes.status}`);
  }

  const { download_url, filename, mime_type, sha256 } = await resolveRes.json();

  // Consulta CacheStorage local
  const cacheKey = `https://asset-cache.local/models/${assetId}?sha256=${sha256}`;
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const matched = await cache.match(cacheKey);
    if (matched) {
      const buffer = await matched.arrayBuffer();
      return { buffer, filename, mimeType: mime_type };
    }
  } catch {
    // CacheStorage indisponível em alguns contextos isolados
  }

  // Download direto do storage via URL assinada
  const downloadRes = await fetch(download_url);
  if (!downloadRes.ok) {
    throw new Error(`DOWNLOAD_FAILED_HTTP_${downloadRes.status}`);
  }

  if (cache) {
    try {
      await cache.put(cacheKey, downloadRes.clone());
    } catch {
      // Falha ao gravar em cache não impede retorno do buffer
    }
  }

  const buffer = await downloadRes.arrayBuffer();
  return { buffer, filename, mimeType: mime_type };
}

// 4. Listagem de inventário
export async function fetchRemoteInventory(
  userId: string,
  authToken?: string
): Promise<InventoryAssetItem[]> {
  const authHeaders: Record<string, string> = {
    'x-user-id': userId,
  };
  if (authToken) {
    authHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch('/api/v1/inventory', {
    headers: authHeaders,
  });

  if (!res.ok) {
    throw new Error(`INVENTORY_FETCH_FAILED_HTTP_${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
}
