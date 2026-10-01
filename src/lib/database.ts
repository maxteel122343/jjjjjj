import { supabase } from './supabase';
import {
  CreatorUser,
  CustomizationItem,
  PublishItemPayload,
  RoomEditorState,
  StoreAvatar,
  AvatarPoseConfig,
} from '../types';
import { safeLocalStorageSet, sanitizeItemsForStorage } from './storageUtils';

const STORE_ITEMS_LOCAL_KEY = '3d_social_creator_customization_items';
const STORE_AVATARS_LOCAL_KEY = '3d_social_creator_store_avatars';
const STORE_POSES_LOCAL_KEY = '3d_social_creator_poses';
const SHOWCASE_ROOMS_LOCAL_KEY = '3d_social_creator_lobby_rooms';

/**
 * Persists a published store item to Supabase and localStorage fallback.
 * Works seamlessly whether online with Supabase or offline.
 */
export async function persistStoreItem(
  payload: PublishItemPayload,
  user: CreatorUser | null
): Promise<{ success: boolean; id: string; error?: string }> {
  const generatedId = payload.id || `pub-${Date.now()}`;

  // 1. ALWAYS persist to LocalStorage FIRST (Guarantees local & offline persistence)
  try {
    if (payload.objectType === 'avatar') {
      const savedAvatarsRaw = localStorage.getItem(STORE_AVATARS_LOCAL_KEY);
      const avatars: StoreAvatar[] = savedAvatarsRaw ? JSON.parse(savedAvatarsRaw) : [];
      const newAvatar: StoreAvatar = {
        id: generatedId,
        name: payload.name,
        price: payload.price,
        rarity: payload.rarity || 'RARO',
        tags: payload.hashtags || ['#avatar', '#3d'],
        thumb: payload.thumbnailUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        author: user?.displayName || payload.author || 'Luzenne',
        isUserPublished: true,
        owned: true,
        applied: false,
        description: payload.description,
        assetId: payload.originalItemId || generatedId,
        originalItemId: payload.originalItemId,
      };
      const filtered = avatars.filter((a) => a.id !== generatedId && a.name !== payload.name);
      const updated = sanitizeItemsForStorage([newAvatar, ...filtered]);
      safeLocalStorageSet(STORE_AVATARS_LOCAL_KEY, JSON.stringify(updated));
    } else if (payload.objectType === 'pose') {
      const savedPosesRaw = localStorage.getItem(STORE_POSES_LOCAL_KEY);
      const poses: AvatarPoseConfig[] = savedPosesRaw ? JSON.parse(savedPosesRaw) : [];
      const newPose: AvatarPoseConfig = {
        id: generatedId,
        name: payload.name,
        applied: false,
        thumbnailUrl: payload.thumbnailUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        description: payload.description || '',
        price: payload.price,
        owned: true,
        author: user?.displayName || payload.author || 'Luzenne',
        isPublishedByCreator: true,
        associatedAvatarIds: payload.associatedAvatarIds || [],
        associatedAvatarNames: payload.metadata?.associatedAvatarNames || [],
        rarity: payload.rarity || 'RARO',
      };
      const filtered = poses.filter((p) => p.id !== generatedId && p.name !== payload.name);
      const updated = [newPose, ...filtered];
      safeLocalStorageSet(STORE_POSES_LOCAL_KEY, JSON.stringify(updated));
    } else if (payload.objectType === 'acessorio') {
      const savedItemsRaw = localStorage.getItem(STORE_ITEMS_LOCAL_KEY);
      const items: CustomizationItem[] = savedItemsRaw ? JSON.parse(savedItemsRaw) : [];
      const newAccessory: CustomizationItem = {
        id: generatedId,
        code: `#AC${Math.floor(100 + Math.random() * 900)}`,
        name: payload.name,
        category: 'acessorios',
        slot: payload.accessoryAttachment || 'companion_float',
        thumb: payload.thumbnailUrl || 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80',
        owned: true,
        equipped: true,
        price: payload.price,
        rarity: payload.rarity || 'RARO',
        isPublishedByCreator: true,
        author: user?.displayName || payload.author || 'Luzenne',
        description: payload.description || `Acessório 3D criado por ${user?.displayName || 'Luzenne'}.`,
        isAccessory: true,
        accessoryAttachment: payload.accessoryAttachment || 'companion_float',
        accessoryTransform: payload.accessoryTransform || {
          position: [0.45, 1.45, 0.3],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        actions: payload.actions || [],
        activeActionId: payload.actions?.[0]?.id || null,
        assetId: payload.originalItemId || generatedId,
        originalItemId: payload.originalItemId,
      };
      const filtered = items.filter((i) => i.id !== generatedId && i.name !== payload.name);
      const updated = sanitizeItemsForStorage([newAccessory, ...filtered]);
      safeLocalStorageSet(STORE_ITEMS_LOCAL_KEY, JSON.stringify(updated));
    } else {
      const savedItemsRaw = localStorage.getItem(STORE_ITEMS_LOCAL_KEY);
      const items: CustomizationItem[] = savedItemsRaw ? JSON.parse(savedItemsRaw) : [];
      const newItem: CustomizationItem = {
        id: generatedId,
        code: `#P${Math.floor(100 + Math.random() * 900)}`,
        name: payload.name,
        category: payload.objectType === 'moveis' ? 'outros' : 'publicados',
        slot: payload.objectType || 'publicados',
        thumb: payload.thumbnailUrl || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80',
        owned: true,
        equipped: false,
        price: payload.price,
        rarity: payload.rarity || 'RARO',
        isPublishedByCreator: true,
        author: user?.displayName || payload.author || 'Luzenne',
        description: payload.description || `Item 3D criado por ${user?.displayName || 'Luzenne'}.`,
        actions: payload.actions || [],
        activeActionId: payload.actions?.[0]?.id || null,
        assetId: payload.originalItemId || generatedId,
        originalItemId: payload.originalItemId,
      };
      const filtered = items.filter((i) => i.id !== generatedId && i.name !== payload.name);
      const updated = sanitizeItemsForStorage([newItem, ...filtered]);
      safeLocalStorageSet(STORE_ITEMS_LOCAL_KEY, JSON.stringify(updated));
    }
  } catch (storageErr) {
    console.warn('LocalStorage save error:', storageErr);
  }

  // 2. Try to sync to Supabase (works for logged-in or guest users)
  try {
    const safeUserId = user && !user.isGuest && user.id && user.id.includes('-') && user.id.length === 36 ? user.id : null;
    const itemData = {
      user_id: safeUserId,
      name: payload.name,
      object_type: payload.objectType,
      price: payload.price,
      hashtags: payload.hashtags,
      thumbnail_url: payload.thumbnailUrl,
      asset_url: payload.fileBlobUrl || null,
      rarity: payload.rarity || 'COMUM',
      description: payload.description || '',
      publish_mode: payload.publishMode,
      metadata: {
        ...(payload.metadata || {}),
        author: user?.displayName || payload.author || 'Luzenne',
        isAccessory: payload.objectType === 'acessorio',
        accessoryTransform: payload.accessoryTransform,
        actions: payload.actions || [],
        originalItemId: payload.originalItemId,
        associatedAvatarIds: payload.associatedAvatarIds || [],
        associatedAvatarNames: payload.metadata?.associatedAvatarNames || [],
      },
      is_active: true,
    };

    if (payload.id && !payload.id.startsWith('pub-')) {
      // It has a database UUID or id: update directly
      await supabase.from('store_items').update(itemData).eq('id', payload.id);
    } else {
      await supabase.from('store_items').insert([itemData]);
    }
  } catch (err: any) {
    console.warn('Supabase store_items query fallback:', err?.message);
  }

  return { success: true, id: generatedId };
}

/**
 * Persists a showcase room to Supabase and localStorage fallback.
 */
export async function persistShowcaseRoom(
  room: RoomEditorState,
  user: CreatorUser | null,
  options?: {
    publishMode?: 'simples' | 'avancado';
    price?: number;
    hashtags?: string[];
    thumbnailUrl?: string;
  }
): Promise<{ success: boolean; id: string; error?: string }> {
  const roomId = room.id || `room-${Date.now()}`;
  const finalThumb =
    options?.thumbnailUrl ||
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

  // 1. ALWAYS persist to LocalStorage FIRST (Guarantees local & offline persistence)
  try {
    const savedRoomsRaw = localStorage.getItem(SHOWCASE_ROOMS_LOCAL_KEY);
    const roomsList = savedRoomsRaw ? JSON.parse(savedRoomsRaw) : [];
    const showcaseRoomEntry = {
      id: roomId,
      name: room.name,
      description: `Sala criada por ${user?.displayName || 'Luzenne'}`,
      occupancy: '1/8',
      currentUsers: 1,
      maxUsers: 8,
      theme: options?.hashtags?.[0] || '#vitrine3d',
      thumb: finalThumb,
      badge: 'CRIADOR',
      editorRoom: { ...room, isPublished: true },
      price: options?.price || 0,
      publishMode: options?.publishMode || 'simples',
    };
    const updated = [showcaseRoomEntry, ...roomsList.filter((r: any) => r.id !== roomId)];
    safeLocalStorageSet(SHOWCASE_ROOMS_LOCAL_KEY, JSON.stringify(updated));

    // Also update editor rooms
    const editorRoomsRaw = localStorage.getItem('3d_social_creator_rooms');
    if (editorRoomsRaw) {
      const editorRooms: RoomEditorState[] = JSON.parse(editorRoomsRaw);
      const updatedEditorRooms = editorRooms.map((r) =>
        r.id === room.id ? { ...r, name: room.name, isPublished: true, publishedAt: new Date().toISOString() } : r
      );
      safeLocalStorageSet('3d_social_creator_rooms', JSON.stringify(updatedEditorRooms));
    }
  } catch (err) {
    console.warn('Failed to update showcase rooms in localStorage:', err);
  }

  // 2. Try to sync to Supabase (works for logged-in or guest users)
  try {
    const safeUserId =
      user && !user.isGuest && user.id && user.id.includes('-') && user.id.length === 36
        ? user.id
        : null;

    const payload = {
      user_id: safeUserId,
      name: room.name,
      description: `Sala criada por ${user?.displayName || 'Luzenne'}`,
      boundary: room.boundary,
      spots: room.spots,
      placed_objects: room.placedObjects,
      hashtags: options?.hashtags || ['#sala', '#vitrine3d'],
      price: options?.price || 0,
      publish_mode: options?.publishMode || 'simples',
      thumbnail_url: finalThumb,
      is_published: true,
    };

    if (roomId && roomId.includes('-') && roomId.length === 36) {
      await supabase.from('showcase_rooms').upsert([{ id: roomId, ...payload }]);
    } else {
      await supabase.from('showcase_rooms').insert([payload]);
    }
  } catch (err: any) {
    console.warn('Supabase showcase_rooms insert fallback:', err?.message);
  }

  return { success: true, id: roomId };
}

/**
 * Fetch all published showcase rooms created by the user or stored locally.
 */
export async function fetchMyPublishedRooms(user: CreatorUser | null): Promise<any[]> {
  const localRaw = localStorage.getItem(SHOWCASE_ROOMS_LOCAL_KEY);
  const localList = localRaw ? JSON.parse(localRaw) : [];

  if (user && !user.isGuest && user.id) {
    try {
      const { data, error } = await supabase
        .from('showcase_rooms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Merge Supabase with local
        const merged = [...data];
        for (const item of localList) {
          if (!merged.some((m) => m.id === item.id)) {
            merged.push(item);
          }
        }
        return merged;
      }
    } catch (err: any) {
      console.warn('Supabase fetchMyPublishedRooms failed, using local list:', err.message);
    }
  }

  return localList;
}

/**
 * Fetch all published store items (avatars, accessories, clothes, poses) from Supabase across all accounts and tabs.
 */
export async function fetchPublicStoreItems(): Promise<{
  items: CustomizationItem[];
  avatars: StoreAvatar[];
  poses: AvatarPoseConfig[];
}> {
  try {
    const { data, error } = await supabase
      .from('store_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const items: CustomizationItem[] = [];
      const avatars: StoreAvatar[] = [];
      const poses: AvatarPoseConfig[] = [];

      for (const row of data) {
        if (row.object_type === 'avatar') {
          avatars.push({
            id: row.id,
            name: row.name,
            price: row.price || 0,
            rarity: row.rarity || 'RARO',
            tags: row.hashtags || ['#avatar', '#3d'],
            thumb: row.thumbnail_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            author: row.metadata?.author || 'Criador',
            isUserPublished: true,
            owned: true,
            applied: false,
            description: row.description,
            fileBlobUrl: row.asset_url,
            originalItemId: row.metadata?.originalItemId || row.id,
          });
        } else if (row.object_type === 'pose') {
          poses.push({
            id: row.id,
            name: row.name,
            applied: false,
            thumbnailUrl: row.thumbnail_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            description: row.description,
            price: row.price || 0,
            owned: true,
            author: row.metadata?.author || 'Criador',
            isPublishedByCreator: true,
            associatedAvatarIds: row.metadata?.associatedAvatarIds || [],
            associatedAvatarNames: row.metadata?.associatedAvatarNames || [],
            rarity: row.rarity || 'COMUM',
          });
        } else {
          const isAcessorio = row.object_type === 'acessorio' || Boolean(row.metadata?.isAccessory);
          items.push({
            id: row.id,
            code: `#${isAcessorio ? 'AC' : 'IT'}${row.id.slice(0, 3).toUpperCase()}`,
            name: row.name,
            category: isAcessorio ? 'acessorios' : row.object_type === 'moveis' ? 'outros' : 'publicados',
            thumb: row.thumbnail_url || 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80',
            owned: true,
            equipped: isAcessorio,
            price: row.price || 0,
            rarity: row.rarity || 'RARO',
            isPublishedByCreator: true,
            author: row.metadata?.author || 'Criador',
            fileBlobUrl: row.asset_url,
            description: row.description,
            isAccessory: isAcessorio,
            accessoryAttachment: row.metadata?.accessoryAttachment || (isAcessorio ? 'companion_float' : undefined),
            accessoryTransform: row.metadata?.accessoryTransform,
            actions: row.metadata?.actions || [],
            activeActionId: row.metadata?.actions?.[0]?.id || null,
            originalItemId: row.metadata?.originalItemId || row.id,
          });
        }
      }
      return { items, avatars, poses };
    }
  } catch (err: any) {
    console.warn('Supabase fetchPublicStoreItems error:', err?.message);
  }
  return { items: [], avatars: [], poses: [] };
}

/**
 * Record an item acquisition to the user's Supabase inventory table.
 */
export async function recordUserInventoryItem(
  user: CreatorUser | null,
  item: {
    storeItemId?: string;
    itemCode?: string;
    itemName: string;
    itemType: string;
    thumbnailUrl?: string;
  }
): Promise<void> {
  if (!user || user.isGuest || !user.id || !user.id.includes('-')) return;

  try {
    await supabase.from('user_inventory').upsert(
      {
        user_id: user.id,
        store_item_id: item.storeItemId && item.storeItemId.includes('-') && item.storeItemId.length === 36 ? item.storeItemId : null,
        item_code: item.itemCode || `#IT${Math.floor(100 + Math.random() * 900)}`,
        item_name: item.itemName,
        item_type: item.itemType,
        thumbnail_url: item.thumbnailUrl,
        is_equipped: false,
        acquired_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, store_item_id' }
    );
  } catch (err: any) {
    console.warn('Supabase user_inventory upsert fallback:', err?.message);
  }
}

/**
 * Fetch all inventory items recorded for the user in Supabase.
 */
export async function fetchUserInventoryFromDatabase(
  user: CreatorUser | null
): Promise<any[]> {
  if (!user || user.isGuest || !user.id || !user.id.includes('-')) return [];

  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', user.id)
      .order('acquired_at', { ascending: false });

    if (!error && data) {
      return data;
    }
  } catch (err: any) {
    console.warn('Supabase fetchUserInventoryFromDatabase fallback:', err?.message);
  }
  return [];
}

/**
 * Fetch all published showcase rooms from Supabase across all accounts and tabs.
 */
export async function fetchPublicShowcaseRooms(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('showcase_rooms')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const localRaw = localStorage.getItem(SHOWCASE_ROOMS_LOCAL_KEY);
      const localList = localRaw ? JSON.parse(localRaw) : [];

      const supabaseRooms = data.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || `Sala criada por criador 3D`,
        occupancy: '1/8',
        currentUsers: 1,
        maxUsers: 8,
        theme: row.hashtags?.[0] || '#vitrine3d',
        thumb: row.thumbnail_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        badge: 'CRIADOR',
        price: row.price || 0,
        publishMode: row.publish_mode || 'simples',
        editorRoom: {
          id: row.id,
          name: row.name,
          sceneAssetId: 'inv-scene-2',
          placedObjects: row.placed_objects || [],
          spots: row.spots || [],
          boundary: row.boundary || { x: 8, y: 3, z: 8, isConfirmed: true },
          isPublished: true,
        },
      }));

      const merged = [...supabaseRooms];
      for (const item of localList) {
        if (!merged.some((m) => m.id === item.id || m.name === item.name)) {
          merged.push(item);
        }
      }
      return merged;
    }
  } catch (err: any) {
    console.warn('Supabase fetchPublicShowcaseRooms error:', err?.message);
  }
  const localRaw = localStorage.getItem(SHOWCASE_ROOMS_LOCAL_KEY);
  return localRaw ? JSON.parse(localRaw) : [];
}

/**
 * Delete a published room from Supabase and local storage.
 */
export async function deletePublishedRoom(
  roomId: string,
  user: CreatorUser | null
): Promise<{ success: boolean; error?: string }> {
  if (user && !user.isGuest && user.id) {
    try {
      await supabase.from('showcase_rooms').delete().eq('id', roomId);
    } catch (err: any) {
      console.warn('Supabase delete room error:', err.message);
    }
  }

  try {
    const saved = localStorage.getItem(SHOWCASE_ROOMS_LOCAL_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const filtered = list.filter((r: any) => r.id !== roomId);
      safeLocalStorageSet(SHOWCASE_ROOMS_LOCAL_KEY, JSON.stringify(filtered));
    }
    // Also mark in editor rooms if needed
    const editorRoomsRaw = localStorage.getItem('3d_social_creator_rooms');
    if (editorRoomsRaw) {
      const editorRooms: RoomEditorState[] = JSON.parse(editorRoomsRaw);
      const updated = editorRooms.map((r) =>
        r.id === roomId ? { ...r, isPublished: false, publishedAt: undefined } : r
      );
      safeLocalStorageSet('3d_social_creator_rooms', JSON.stringify(updated));
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a published item (avatar, pose, or customization item).
 */
export async function deletePublishedItem(
  itemId: string,
  itemType: 'avatar' | 'pose' | 'item' | 'moveis' | 'sala',
  user: CreatorUser | null
): Promise<{ success: boolean; error?: string }> {
  if (user && !user.isGuest && user.id) {
    try {
      await supabase.from('store_items').delete().eq('id', itemId);
    } catch (err: any) {
      console.warn('Supabase delete store_item error:', err.message);
    }
  }

  try {
    if (itemType === 'avatar') {
      const raw = localStorage.getItem(STORE_AVATARS_LOCAL_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        safeLocalStorageSet(
          STORE_AVATARS_LOCAL_KEY,
          JSON.stringify(list.filter((a: any) => a.id !== itemId))
        );
      }
    } else if (itemType === 'pose') {
      const raw = localStorage.getItem(STORE_POSES_LOCAL_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        safeLocalStorageSet(
          STORE_POSES_LOCAL_KEY,
          JSON.stringify(list.filter((p: any) => p.id !== itemId))
        );
      }
    } else {
      const raw = localStorage.getItem(STORE_ITEMS_LOCAL_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        safeLocalStorageSet(
          STORE_ITEMS_LOCAL_KEY,
          JSON.stringify(list.filter((i: any) => i.id !== itemId))
        );
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Generate standard PostgreSQL / Supabase INSERT scripts for published rooms and items,
 * allowing the creator to easily copy & paste into their Supabase SQL editor!
 */
export function generateSqlPersistenceScript(
  publishedRooms: any[] = [],
  publishedItems: {
    avatars?: any[];
    customizationItems?: any[];
    poses?: any[];
  } = {}
): string {
  const timestamp = new Date().toISOString();
  let sql = `-- ==============================================================================
-- SCRIPT DE PERSISTÊNCIA SQL — 3D SOCIAL CREATOR (SUPABASE / POSTGRESQL)
-- Gerado em: ${timestamp}
-- Cole este script no "SQL Editor" do Supabase para persistir suas salas e itens!
-- ==============================================================================

-- 0. GARANTIR SUPORTE AO TIPO 'acessorio' E PERMISSÕES PÚBLICAS
DO $$
BEGIN
    ALTER TABLE public.store_items DROP CONSTRAINT IF EXISTS store_items_object_type_check;
    ALTER TABLE public.store_items ADD CONSTRAINT store_items_object_type_check CHECK (object_type IN ('avatar', 'acessorio', 'item', 'pose', 'sala', 'moveis'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

DROP POLICY IF EXISTS "Itens ativos da loja são visíveis por todos" ON public.store_items;
CREATE POLICY "Itens ativos da loja são visíveis por todos" ON public.store_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Criadores podem publicar itens na loja" ON public.store_items;
CREATE POLICY "Criadores podem publicar itens na loja" ON public.store_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Salas da vitrine são visíveis por todos" ON public.showcase_rooms;
CREATE POLICY "Salas da vitrine são visíveis por todos" ON public.showcase_rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Criadores podem publicar salas na vitrine" ON public.showcase_rooms;
CREATE POLICY "Criadores podem publicar salas na vitrine" ON public.showcase_rooms FOR INSERT WITH CHECK (true);

`;

  if (publishedRooms.length > 0) {
    sql += `-- 1. PERSISTÊNCIA DAS SALAS PUBLICADAS (SHOWCASE ROOMS)\n`;
    for (const r of publishedRooms) {
      const safeId = r.id?.includes('-') && r.id.length === 36 ? `'${r.id}'` : `gen_random_uuid()`;
      const name = (r.name || 'Sala 3D').replace(/'/g, "''");
      const desc = (r.description || `Sala publicada no 3D Social Studio`).replace(/'/g, "''");
      const boundaryJson = JSON.stringify(r.boundary || r.editorRoom?.boundary || { x: 10, y: 4, z: 10 }).replace(/'/g, "''");
      const spotsJson = JSON.stringify(r.spots || r.editorRoom?.spots || []).replace(/'/g, "''");
      const objectsJson = JSON.stringify(r.placed_objects || r.editorRoom?.placedObjects || []).replace(/'/g, "''");
      const price = Number(r.price) || 0;
      const hashtags = (r.hashtags || ['#vitrine3d', '#sala']).map((h: string) => `'${h.replace(/'/g, "''")}'`).join(', ');

      sql += `INSERT INTO public.showcase_rooms (
    id, name, description, boundary, spots, placed_objects, hashtags, price, is_published, created_at
) VALUES (
    ${safeId},
    '${name}',
    '${desc}',
    '${boundaryJson}'::jsonb,
    '${spotsJson}'::jsonb,
    '${objectsJson}'::jsonb,
    ARRAY[${hashtags}],
    ${price},
    true,
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    boundary = EXCLUDED.boundary,
    spots = EXCLUDED.spots,
    placed_objects = EXCLUDED.placed_objects,
    price = EXCLUDED.price,
    updated_at = NOW();\n\n`;
    }
  }

  const avatars = (publishedItems.avatars || []).filter((a) => a.isUserPublished);
  const items = (publishedItems.customizationItems || []).filter((i) => i.isPublishedByCreator);
  const poses = (publishedItems.poses || []).filter((p) => p.isPublishedByCreator);

  if (avatars.length > 0 || items.length > 0 || poses.length > 0) {
    sql += `-- 2. PERSISTÊNCIA DOS ITENS DA LOJA (STORE ITEMS)\n`;

    for (const a of avatars) {
      const name = (a.name || 'Avatar 3D').replace(/'/g, "''");
      const price = Number(a.price) || 0;
      const rarity = a.rarity || 'RARO';
      const thumb = a.thumb?.replace(/'/g, "''") || '';
      const tags = (a.tags || ['#avatar', '#3d']).map((t: string) => `'${t.replace(/'/g, "''")}'`).join(', ');

      sql += `INSERT INTO public.store_items (
    name, object_type, price, hashtags, thumbnail_url, rarity, description, is_active, created_at
) VALUES (
    '${name}',
    'avatar',
    ${price},
    ARRAY[${tags}],
    '${thumb}',
    '${rarity}',
    'Avatar criado e publicado pelo usuário.',
    true,
    NOW()
);\n`;
    }

    for (const item of items) {
      const name = (item.name || 'Item 3D').replace(/'/g, "''");
      const price = Number(item.price) || 0;
      const rarity = item.rarity || 'COMUM';
      const thumb = item.thumb?.replace(/'/g, "''") || '';
      const isAcessorio = item.isAccessory || item.category === 'acessorios';
      const objType = isAcessorio ? 'acessorio' : item.category === 'outros' ? 'moveis' : 'item';
      const metaJson = JSON.stringify({
        isAccessory: isAcessorio,
        accessoryAttachment: item.accessoryAttachment,
        accessoryTransform: item.accessoryTransform,
        actions: item.actions || [],
      }).replace(/'/g, "''");

      sql += `INSERT INTO public.store_items (
    name, object_type, price, hashtags, thumbnail_url, rarity, description, metadata, is_active, created_at
) VALUES (
    '${name}',
    '${objType}',
    ${price},
    ARRAY['#${objType}', '#3d'],
    '${thumb}',
    '${rarity}',
    '${(item.description || '').replace(/'/g, "''")}',
    '${metaJson}'::jsonb,
    true,
    NOW()
);\n`;
    }

    for (const p of poses) {
      const name = (p.name || 'Pose 3D').replace(/'/g, "''");
      const price = Number(p.price) || 0;
      const rarity = p.rarity || 'COMUM';
      const thumb = p.thumbnailUrl?.replace(/'/g, "''") || '';

      sql += `INSERT INTO public.store_items (
    name, object_type, price, hashtags, thumbnail_url, rarity, description, is_active, created_at
) VALUES (
    '${name}',
    'pose',
    ${price},
    ARRAY['#pose', '#avatar'],
    '${thumb}',
    '${rarity}',
    'Pose personalizada para avatares.',
    true,
    NOW()
);\n`;
    }
  }

  sql += `\n-- Fim do script de persistência. Suas salas e itens agora estarão salvos no Supabase!`;
  return sql;
}

