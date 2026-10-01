/**
 * Safe LocalStorage helpers with automatic QuotaExceededError protection
 * and serialization sanitization for 3D model metadata.
 * 
 * REGRA ESTRITA:
 * O arquivo 3D (.glb, binário, base64 ou blob:) NUNCA fica no localStorage.
 * O arquivo fica exclusivamente no Supabase Storage S3 (bucket 'models', key 'users/<userId>/assets/<assetId>/model.glb').
 * A chave '3d_social_creator_customization_items' armazena APENAS metadados leves (poucos KB):
 * id, nome, slot, category, assetId, equipped, etc.
 */

export function sanitizeCustomizationItemForStorage(item: any): any {
  if (!item || typeof item !== 'object') return item;

  // Garante que thumb não contenha base64 (data:...) nem blob:
  let safeThumb = typeof item.thumb === 'string' ? item.thumb.trim() : '';
  if (safeThumb.startsWith('data:') || safeThumb.startsWith('blob:') || safeThumb.length > 500) {
    safeThumb = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80';
  }

  const sanitized: Record<string, any> = {
    id: String(item.id || ''),
    name: String(item.name || ''),
    slot: String(item.slot || item.accessoryAttachment || item.category || 'outros'),
    category: String(item.category || 'outros'),
    equipped: Boolean(item.equipped),
    owned: item.owned !== undefined ? Boolean(item.owned) : true,
  };

  // Referência ao asset_id do Supabase Storage S3
  if (item.assetId && typeof item.assetId === 'string') {
    sanitized.assetId = item.assetId;
  } else if (item.asset_id && typeof item.asset_id === 'string') {
    sanitized.assetId = item.asset_id;
  } else if (item.originalItemId && !item.originalItemId.startsWith('inv-') && !item.originalItemId.startsWith('acc-')) {
    sanitized.assetId = item.originalItemId;
  }

  if (item.originalItemId) sanitized.originalItemId = item.originalItemId;
  if (item.code) sanitized.code = item.code;
  if (typeof item.price === 'number') sanitized.price = item.price;
  if (item.rarity) sanitized.rarity = item.rarity;
  if (item.isAccessory !== undefined) sanitized.isAccessory = Boolean(item.isAccessory);
  if (item.accessoryAttachment) sanitized.accessoryAttachment = item.accessoryAttachment;
  if (item.activeActionId) sanitized.activeActionId = item.activeActionId;
  if (item.author) sanitized.author = item.author;
  if (safeThumb) sanitized.thumb = safeThumb;

  if (item.accessoryTransform) {
    sanitized.accessoryTransform = {
      position: Array.isArray(item.accessoryTransform.position) ? item.accessoryTransform.position : [0, 0, 0],
      rotation: Array.isArray(item.accessoryTransform.rotation) ? item.accessoryTransform.rotation : [0, 0, 0],
      scale: Array.isArray(item.accessoryTransform.scale) ? item.accessoryTransform.scale : [1, 1, 1],
    };
  }

  if (Array.isArray(item.actions) && item.actions.length > 0) {
    sanitized.actions = item.actions.map((act: any) => ({
      id: act.id,
      name: act.name,
      trigger: act.trigger,
      type: act.type,
      parameters: act.parameters,
    }));
  }

  // NUNCA incluir fileBlobUrl, glb, base64 ou dados binários
  delete sanitized.fileBlobUrl;
  delete sanitized.glb;
  delete sanitized.data;
  delete sanitized.base64;

  return sanitized;
}

export function sanitizeCustomizationItemsForStorage(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map(sanitizeCustomizationItemForStorage);
}

export function sanitizeItemForStorage<T extends Record<string, any>>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const clone = { ...item };
  delete clone.fileBlobUrl;
  delete (clone as any).glb;
  delete (clone as any).base64;
  delete (clone as any).data;
  if (typeof clone.thumb === 'string' && (clone.thumb.startsWith('data:') || clone.thumb.startsWith('blob:'))) {
    delete clone.thumb;
  }
  if (typeof clone.thumbUrl === 'string' && (clone.thumbUrl.startsWith('data:') || clone.thumbUrl.startsWith('blob:'))) {
    delete clone.thumbUrl;
  }
  return clone;
}

export function sanitizeItemsForStorage<T extends Record<string, any>>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  return items.map(sanitizeItemForStorage);
}

/**
 * Limpa proativamente qualquer entrada sobrecarregada existente no localStorage
 * para restaurar a cota e impedir QuotaExceededError.
 */
export function purgeOversizedStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const targetKeys = [
    '3d_social_creator_customization_items',
    '3d_social_creator_store_avatars',
    '3d_social_creator_inventory',
  ];

  for (const key of targetKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        // Se a string for maior que 300KB, com certeza tem base64 ou dados indevidos
        if (raw.length > 300 * 1024 || raw.includes('data:image') || raw.includes('blob:')) {
          console.warn(`[StoragePurge] Higienizando chave sobrecarregada "${key}" (${Math.round(raw.length / 1024)} KB)...`);
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = key === '3d_social_creator_customization_items'
              ? sanitizeCustomizationItemsForStorage(parsed)
              : sanitizeItemsForStorage(parsed);
            localStorage.setItem(key, JSON.stringify(cleaned));
            console.log(`[StoragePurge] Chave "${key}" reduzida com sucesso para ${Math.round(JSON.stringify(cleaned).length / 1024)} KB.`);
          }
        }
      }
    } catch (e) {
      console.warn(`[StoragePurge] Falha ao analisar chave "${key}", redefinindo para vazio:`, e);
      try {
        localStorage.setItem(key, '[]');
      } catch {}
    }
  }
}

// Executa higienização imediatamente ao carregar o módulo
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    purgeOversizedStorage();
  } catch {}
}

/**
 * Grava com segurança no localStorage, prevenindo que QuotaExceededError quebre o app.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    if (key === '3d_social_creator_customization_items') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          value = JSON.stringify(sanitizeCustomizationItemsForStorage(parsed));
        }
      } catch {}
    }

    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      err?.number === -2147024882;

    if (isQuotaError) {
      console.warn(`[LocalStorage QuotaExceeded] Cota excedida ao gravar "${key}". Purgando itens antigos...`);
      try {
        purgeOversizedStorage();
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn(`[LocalStorage QuotaExceeded] Limite atingido. Dados seguros no Supabase S3.`);
        return false;
      }
    }

    console.warn(`[LocalStorage Error] Falha ao gravar "${key}":`, err);
    return false;
  }
}
