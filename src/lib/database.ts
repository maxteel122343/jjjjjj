import { supabase } from './supabase';
import {
  CreatorUser,
  CustomizationItem,
  PublishItemPayload,
  RoomEditorState,
  StoreAvatar,
  AvatarPoseConfig,
  RoomData,
} from '../types';

/**
 * Publicar item na loja (e na vitrine se for sala).
 * Publicar item category=room grava store_items e, no mesmo ato, showcase_rooms
 * com is_published=true, room_id UUID do banco, owner_user_id, title, cover,
 * asset_id do GLB ready. Sem id room-<timestamp>.
 * Item 3D que não é room continua só na loja.
 */
export async function persistStoreItem(
  payload: PublishItemPayload,
  user: CreatorUser | null
): Promise<{ success: boolean; id: string; roomId?: string; error?: string }> {
  try {
    const rawAssetId = payload.assetId || payload.originalItemId;
    const isRoom = payload.objectType === 'sala' || (payload as any).category === 'room';

    const res = await fetch('/api/store/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || 'user-default',
      },
      body: JSON.stringify({
        name: payload.name,
        title: payload.name,
        object_type: payload.objectType,
        category: isRoom ? 'room' : payload.objectType,
        price: payload.price || 0,
        hashtags: payload.hashtags || ['#comunidade', '#3d'],
        thumbnail_url: payload.thumbnailUrl,
        cover_url: payload.thumbnailUrl,
        asset_id: rawAssetId && rawAssetId.length === 36 && rawAssetId.includes('-') ? rawAssetId : null,
        description: payload.description,
        publish_mode: payload.publishMode || 'simples',
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
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        id: data.item_id || data.room_id || `item-${Date.now()}`,
        roomId: data.room_id,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('API /api/store/publish error:', errData);
      return { success: false, id: '', error: errData.message || 'Falha ao publicar na API' };
    }
  } catch (err: any) {
    console.error('persistStoreItem error:', err);
    return { success: false, id: '', error: err.message || 'Erro ao publicar item' };
  }
}

/**
 * Publicar sala da vitrine (Showcase Room).
 * Grava no banco com UUID real do PostgreSQL e vincula à loja.
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
  try {
    const finalThumb =
      options?.thumbnailUrl ||
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

    const rawAssetId = room.sceneAssetId;
    const validAssetId =
      rawAssetId && rawAssetId.length === 36 && rawAssetId.includes('-') ? rawAssetId : null;

    const res = await fetch('/api/store/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || 'user-default',
      },
      body: JSON.stringify({
        name: room.name,
        title: room.name,
        object_type: 'sala',
        category: 'room',
        price: options?.price || 0,
        hashtags: options?.hashtags || ['#sala', '#vitrine3d'],
        thumbnail_url: finalThumb,
        cover_url: finalThumb,
        asset_id: validAssetId,
        description: `Sala 3D criada por ${user?.displayName || 'Luzenne'}`,
        publish_mode: options?.publishMode || 'simples',
        boundary: room.boundary,
        spots: room.spots,
        placed_objects: room.placedObjects,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        id: data.room_id || data.item_id,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      return { success: false, id: '', error: errData.message || 'Falha ao persistir sala' };
    }
  } catch (err: any) {
    console.error('persistShowcaseRoom error:', err);
    return { success: false, id: '', error: err.message };
  }
}

/**
 * Comprar sala de outro usuário.
 * Cria linha nova: owner=comprador, source_room_id=original, visibility=private,
 * asset e capa por ponteiro, não cópia do binário. Card só na vitrine dele, filete vermelho.
 * Compra repetida devolve a privada já criada.
 */
export async function buyRoom(
  roomId?: string,
  storeItemId?: string,
  user?: CreatorUser | null
): Promise<{ success: boolean; isExisting?: boolean; room?: any; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/store/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || 'user-default',
      },
      body: JSON.stringify({
        room_id: roomId,
        store_item_id: storeItemId,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      return {
        success: true,
        isExisting: data.is_existing,
        room: data.room,
        message: data.message,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Erro ao comprar sala.',
      };
    }
  } catch (err: any) {
    console.error('buyRoom error:', err);
    return {
      success: false,
      error: err?.message || 'Erro de conexão ao comprar sala.',
    };
  }
}

/**
 * Consulta vitrine de salas direto da API do banco de dados PostgreSQL.
 * Retorna as salas publicadas (qualquer conta entra) mais as private do usuário logado.
 */
export async function fetchPublicShowcaseRooms(user?: CreatorUser | null): Promise<RoomData[]> {
  try {
    const res = await fetch('/api/rooms/showcase', {
      headers: {
        'x-user-id': user?.id || 'user-default',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rooms)) {
        return data.rooms.map((r: any) => ({
          id: r.id,
          name: r.name || r.title || 'Sala Vitrine 3D',
          title: r.title || r.name,
          badge: r.visibility === 'private' ? '🔒' : '👑',
          occupation: '1/8',
          currentUsers: 1,
          maxUsers: 8,
          thumb: r.cover_url || r.thumbnail_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
          coverUrl: r.cover_url || r.thumbnail_url,
          description: r.description || 'Sala publicada na vitrine de rooms.',
          isFromEditor: true,
          assetId: r.asset_id,
          visibility: r.visibility || 'public',
          sourceRoomId: r.source_room_id,
          isPrivate: r.visibility === 'private',
          isOwner: r.isOwner,
          ownerUserId: r.owner_user_id || r.user_id,
          price: r.price || 0,
          editorRoom: {
            id: r.id,
            name: r.name || r.title || 'Sala Vitrine',
            sceneAssetId: r.asset_id,
            placedObjects: Array.isArray(r.placed_objects) ? r.placed_objects : [],
            spots: Array.isArray(r.spots) ? r.spots : [],
            boundary: r.boundary || { x: 10, y: 3.2, z: 10, centerX: 0, centerZ: 0, isConfirmed: true },
            isPublished: r.is_published,
          },
          ambientColor: r.visibility === 'private' ? '#ef4444' : '#ffd700',
        }));
      }
    }
  } catch (err: any) {
    console.error('fetchPublicShowcaseRooms error:', err);
  }
  return [];
}

/**
 * Consulta itens da loja direto da API (incluindo salas, avatares, acessórios e poses).
 * A loja continua listando item publicado de qualquer tipo, inclusive room.
 */
export async function fetchPublicStoreItems(): Promise<{
  items: CustomizationItem[];
  avatars: StoreAvatar[];
  poses: AvatarPoseConfig[];
}> {
  try {
    const res = await fetch('/api/store/items');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        const items: CustomizationItem[] = [];
        const avatars: StoreAvatar[] = [];
        const poses: AvatarPoseConfig[] = [];

        for (const row of data.items) {
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
              owned: false,
              applied: false,
              description: row.description,
              fileBlobUrl: row.asset_url,
              assetId: row.asset_id || row.metadata?.assetId || row.metadata?.originalItemId,
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
              owned: false,
              author: row.metadata?.author || 'Criador',
              isPublishedByCreator: true,
              associatedAvatarIds: row.metadata?.associatedAvatarIds || [],
              associatedAvatarNames: row.metadata?.associatedAvatarNames || [],
              rarity: row.rarity || 'COMUM',
            });
          } else if (row.object_type === 'sala' || row.object_type === 'room') {
            // SALA NA LOJA: "A loja continua listando item publicado de qualquer tipo, inclusive room. Não tire a sala da loja."
            items.push({
              id: row.id,
              code: `#ROOM-${row.id.slice(0, 4).toUpperCase()}`,
              name: row.name,
              category: 'salas',
              thumb: row.thumbnail_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
              owned: false,
              equipped: false,
              price: row.price || 0,
              rarity: 'RARO',
              isPublishedByCreator: true,
              author: row.metadata?.author || 'Criador',
              description: row.description || 'Sala 3D completa com arquitetura e spots.',
              roomId: row.room_id || row.id,
              assetId: row.asset_id || row.metadata?.assetId || row.metadata?.originalItemId,
              isRoom: true,
            });
          } else {
            const isAcessorio = row.object_type === 'acessorio' || Boolean(row.metadata?.isAccessory);
            items.push({
              id: row.id,
              code: `#${isAcessorio ? 'AC' : 'IT'}${row.id.slice(0, 3).toUpperCase()}`,
              name: row.name,
              category: isAcessorio ? 'acessorios' : row.object_type === 'moveis' ? 'outros' : 'publicados',
              thumb: row.thumbnail_url || 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80',
              owned: false,
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
              assetId: row.asset_id || row.metadata?.assetId || row.metadata?.originalItemId,
            });
          }
        }
        return { items, avatars, poses };
      }
    }
  } catch (err: any) {
    console.error('fetchPublicStoreItems error:', err);
  }
  return { items: [], avatars: [], poses: [] };
}

/**
 * Consulta salas publicadas do usuário.
 */
export async function fetchMyPublishedRooms(user: CreatorUser | null): Promise<any[]> {
  if (!user || user.isGuest || !user.id) return [];
  try {
    const { data, error } = await supabase
      .from('showcase_rooms')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) return data;
  } catch (err: any) {
    console.warn('fetchMyPublishedRooms fallback:', err?.message);
  }
  return [];
}

/**
 * Registra item no inventário do usuário via Supabase.
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
 * Exclui uma sala da vitrine.
 */
export async function deleteShowcaseRoom(roomId: string, user: CreatorUser | null): Promise<boolean> {
  if (!roomId) return false;
  try {
    await supabase.from('showcase_rooms').delete().eq('id', roomId);
    return true;
  } catch (err: any) {
    console.warn('deleteShowcaseRoom error:', err?.message);
    return false;
  }
}
