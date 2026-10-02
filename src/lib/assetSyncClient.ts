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

  // Garante que o nome do arquivo termine estritamente em .glb sem duplicar (.glb.glb)
  const cleanFilename = file.name.replace(/(\.glb)+$/i, '') + '.glb';

  // Etapa 1: POST /api/v1/assets/upload/init
  const initRes = await fetch('/api/v1/assets/upload/init', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      filename: cleanFilename,
      byte_size: file.size,
      sha256: sha256Hex,
      category,
      format: 'glb',
    }),
    signal: abortSignal,
  });

  if (!initRes.ok) {
    let errMsg = `INIT_FAILED_HTTP_${initRes.status}`;
    try {
      const errBody = await initRes.json();
      errMsg = errBody.message || errBody.error || errMsg;
    } catch {
      const rawText = await initRes.text().catch(() => '');
      if (rawText) {
        errMsg = `Servidor (${initRes.status}): ${rawText.slice(0, 300)}`;
      }
    }
    throw new Error(errMsg);
  }

  const { asset_id, upload_id, upload_url, required_headers } = await initRes.json();

  // Etapa 2: PUT direto no Supabase Storage via URL assinada
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
        const bodyContent = xhr.responseText ? xhr.responseText.slice(0, 1000) : '(corpo vazio)';
        reject(new Error(`STORAGE_PUT_FAILED: HTTP ${xhr.status} - ${bodyContent}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('NETWORK_ERROR_DURING_STORAGE_PUT: Falha de conexão ou CORS ao enviar para upload_url'));
    };

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
    let errMsg = `COMPLETE_FAILED_HTTP_${completeRes.status}`;
    try {
      const errBody = await completeRes.json();
      errMsg = errBody.message || errBody.error || errMsg;
    } catch {
      const rawText = await completeRes.text().catch(() => '');
      if (rawText) {
        errMsg = `Servidor (${completeRes.status}): ${rawText.slice(0, 300)}`;
      }
    }
    throw new Error(errMsg);
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
    let errMsg = `INVENTORY_FETCH_FAILED_HTTP_${res.status}`;
    try {
      const errBody = await res.json();
      errMsg = errBody.message || errBody.error || errMsg;
    } catch {
      const rawText = await res.text().catch(() => '');
      if (rawText) {
        errMsg = `Servidor (${res.status}): ${rawText.slice(0, 300)}`;
      }
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.items || [];
}

/**
 * Extrai um UUID válido v4 de strings, objetos, chaves do bucket ou URLs antigas.
 * Identifica chaves de bucket como:
 * - models/users/<userId>/assets/<UUID>/model.glb
 * - /assets/<UUID>/...
 * - models/<UUID>/... ou models/<UUID>.glb
 * - URL assinada antiga: https://.../assets/<UUID>/model.glb?X-Amz-... ou ?token=...
 * Ignora URLs de blob: de browser (que não existem no storage permanente).
 */
export function extractAssetUuid(source: any): string | null {
  if (!source) return null;

  // 1. Se for string simples
  if (typeof source === 'string') {
    const trimmed = source.trim();

    // URLs de blob: de browser nunca são UUIDs de storage válidos
    if (trimmed.startsWith('blob:')) {
      return null;
    }

    // Se for exatamente um UUID v4
    const exactMatch = trimmed.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    if (exactMatch) {
      return exactMatch[0].toLowerCase();
    }

    // Isola o path removendo query parameters (?token=... ou ?X-Amz-...)
    const pathOnly = trimmed.split('?')[0];

    // Procura padrão explícito /assets/<UUID>/ ou /assets/<UUID>
    const assetPathMatch = pathOnly.match(/\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (assetPathMatch && assetPathMatch[1]) {
      return assetPathMatch[1].toLowerCase();
    }

    // Procura chave do bucket models (ex: models/users/<userId>/.../<UUID> ou models/<UUID>)
    const allUuids = Array.from(
      pathOnly.matchAll(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)
    ).map((m) => m[1].toLowerCase());

    if (allUuids.length > 0) {
      // Se houver mais de um UUID (ex: users/<userUuid>/.../<assetUuid>/model.glb),
      // o assetId é sempre o último UUID no path (mais próximo ao arquivo .glb)
      return allUuids[allUuids.length - 1];
    }

    return null;
  }

  // 2. Se for objeto com propriedades (ex: row do Supabase ou CustomizationItem)
  if (typeof source === 'object') {
    // Ordem de prioridade estrita: campo direto asset_id / assetId primeiro
    const directCandidates = [
      source.asset_id,
      source.assetId,
      source.metadata?.asset_id,
      source.metadata?.assetId,
    ];

    for (const c of directCandidates) {
      if (c && typeof c === 'string') {
        const extracted = extractAssetUuid(c);
        if (extracted) return extracted;
      }
    }

    // Candidatos secundários (URLs antigas ou chaves de bucket)
    const secondaryCandidates = [
      source.metadata?.originalItemId,
      source.originalItemId,
      source.model_url,
      source.asset_url,
      source.fileBlobUrl,
    ];

    for (const c of secondaryCandidates) {
      if (c && typeof c === 'string') {
        // Ignora blob:
        if (c.startsWith('blob:')) continue;
        const extracted = extractAssetUuid(c);
        if (extracted) return extracted;
      }
    }
  }

  return null;
}

// In-memory cache de URLs resolvidas com TTL (evita chamadas repetidas enquanto a assinatura é válida)
const resolvedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolve sob demanda uma URL pré-assinada fresca para download do GLB diretamente do S3/Storage.
 * Chamado dinamicamente ao equipar, inspecionar, carregar pedestal ou entrar em sala.
 */
export async function resolveAssetDownloadUrl(
  assetIdOrSource: any,
  roomId?: string
): Promise<string | null> {
  const uuid = extractAssetUuid(assetIdOrSource);
  if (!uuid) return null;

  const cacheKey = roomId ? `${uuid}_${roomId}` : uuid;
  const cached = resolvedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const endpoint = roomId
      ? `/api/v1/assets/${uuid}/resolve?room_id=${encodeURIComponent(roomId)}`
      : `/api/v1/assets/${uuid}/resolve`;

    const authHeaders: Record<string, string> = {
      'x-user-id': 'user-default',
    };

    // Resgata sessão salva se houver
    try {
      const savedUser = localStorage.getItem('3d_social_creator_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.id) authHeaders['x-user-id'] = parsed.id;
      }
    } catch {}

    const res = await fetch(endpoint, {
      headers: authHeaders,
    });

    if (!res.ok) {
      console.warn(`[resolveAssetDownloadUrl] Falha ao resolver asset ${uuid}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.download_url) {
      // Guarda em cache por 8 minutos (a assinatura expira em 10-15 minutos)
      resolvedUrlCache.set(cacheKey, {
        url: data.download_url,
        expiresAt: Date.now() + 8 * 60 * 1000,
      });
      return data.download_url;
    }
  } catch (err) {
    console.warn(`[resolveAssetDownloadUrl] Erro de rede ao resolver ${uuid}:`, err);
  }

  return null;
}
