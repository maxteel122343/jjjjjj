/**
 * Safe LocalStorage helpers with automatic QuotaExceededError protection
 * and serialization sanitization for 3D model metadata.
 */

/**
 * Remove ephemeral blob: and data: URLs before saving metadata to localStorage.
 * Binary models belong in IndexedDB and Supabase Storage S3, never in localStorage!
 */
export function sanitizeItemForStorage<T extends Record<string, any>>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const clone = { ...item };
  if (typeof clone.fileBlobUrl === 'string' && (clone.fileBlobUrl.startsWith('blob:') || clone.fileBlobUrl.startsWith('data:'))) {
    delete clone.fileBlobUrl;
  }
  return clone;
}

export function sanitizeItemsForStorage<T extends Record<string, any>>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  return items.map(sanitizeItemForStorage);
}

/**
 * Safely writes to localStorage, gracefully preventing QuotaExceededError from crashing the app.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      err?.number === -2147024882;

    if (isQuotaError) {
      console.warn(`[LocalStorage QuotaExceeded] Cota excedida ao gravar "${key}". Tentando higienizar chaves transitórias...`);
      try {
        // Remove known keys that may hold stale bloated base64 or temporary cache
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.includes('cache') || k.includes('temp') || k.includes('blob'))) {
            localStorage.removeItem(k);
          }
        }
        // Retry once after pruning transient keys
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn(`[LocalStorage QuotaExceeded] Não foi possível salvar "${key}". Os dados persistem no IndexedDB e Supabase.`);
        return false;
      }
    }

    console.warn(`[LocalStorage Error] Falha ao gravar "${key}":`, err);
    return false;
  }
}
