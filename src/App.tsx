import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { CreatorHeader } from './components/CreatorHeader';
import { CreatorSidebar } from './components/CreatorSidebar';
import { CreatorEditorCanvas3D } from './components/CreatorEditorCanvas3D';
import { UploadGLBModal } from './components/UploadGLBModal';
import { BoundaryModal } from './components/BoundaryModal';
import { AuthModal } from './components/AuthModal';
import { PublishModal } from './components/PublishModal';
import { PublishItemModal } from './components/PublishItemModal';
import { MyPublicationsModal } from './components/MyPublicationsModal';
import { SpotVisualConfigModal } from './components/SpotVisualConfigModal';
import { TrajectoryTimelineModal } from './components/TrajectoryTimelineModal';
import { ProjectSaveRestoreModal } from './components/ProjectSaveRestoreModal';
import { LobbyView } from './components/LobbyView';
import { RoomView } from './components/RoomView';
import { UserCustomizationView } from './components/UserCustomizationView';
import { INITIAL_INVENTORY, INITIAL_ROOMS } from './data/creatorData';
import { INITIAL_ROOMS as INITIAL_LOBBY_ROOMS } from './data/initialData';
import {
  INITIAL_CUSTOMIZATION_ITEMS,
  INITIAL_STORE_AVATARS,
  INITIAL_POSES as INITIAL_CUSTOMIZATION_POSES,
} from './data/initialCustomizationData';
import {
  RoomEditorState,
  PlacedObject,
  InventoryItem,
  GizmoEditMode,
  SpotItem,
  SpotType,
  PlayableBoundary,
  CreatorUser,
  RoomData,
  CustomizationItem,
  StoreAvatar,
  AvatarPoseConfig,
  StoreObjectType,
  SpotMotionConfig,
  SpotVisualConfig,
  ObjectAction,
  AccessoryAttachmentPoint,
  AccessoryTransform,
} from './types';
import { supabase } from './lib/supabase';
import { persistStoreItem, persistShowcaseRoom, fetchPublicStoreItems } from './lib/database';
import { getGlbFile, deleteGlbFile } from './lib/storageIndexedDB';
import { Lightbulb, Sparkles, Maximize2, Minimize2 } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation State between Editor, Rooms Lobby, Social Room, and User Customization/Loja
  const [currentScreen, setCurrentScreen] = useState<'editor' | 'lobby' | 'room' | 'customization'>('lobby');
  const [customizationInitialTab, setCustomizationInitialTab] = useState<'loja' | 'inventario' | 'poses'>('inventario');
  const [lobbyRoomIndex, setLobbyRoomIndex] = useState<number>(1);
  const [selectedLobbyRoom, setSelectedLobbyRoom] = useState<RoomData | null>(null);

  // Customization & Shop State (Matching User Images 2 & 3)
  const [customizationItems, setCustomizationItems] = useState<CustomizationItem[]>(() => {
    const saved = localStorage.getItem('3d_social_creator_customization_items');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_CUSTOMIZATION_ITEMS;
      }
    }
    return INITIAL_CUSTOMIZATION_ITEMS;
  });

  const [storeAvatars, setStoreAvatars] = useState<StoreAvatar[]>(() => {
    const saved = localStorage.getItem('3d_social_creator_store_avatars');
    if (saved) {
      try {
        const parsed: StoreAvatar[] = JSON.parse(saved);
        const merged = [...parsed];
        for (const initAv of INITIAL_STORE_AVATARS) {
          if (!merged.some((a) => a.id === initAv.id)) {
            merged.push(initAv);
          }
        }
        return merged;
      } catch (e) {
        return INITIAL_STORE_AVATARS;
      }
    }
    return INITIAL_STORE_AVATARS;
  });

  const [activeAvatarId, setActiveAvatarId] = useState<string>(() => {
    const saved = localStorage.getItem('3d_social_creator_active_avatar_id');
    if (saved) return saved;
    return 'av-1';
  });

  const activeUserAvatar =
    storeAvatars.find((a) => a.id === activeAvatarId || a.applied) || storeAvatars[0];

  const [avatarPoses, setAvatarPoses] = useState<AvatarPoseConfig[]>(() => {
    const saved = localStorage.getItem('3d_social_creator_poses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_CUSTOMIZATION_POSES;
      }
    }
    return INITIAL_CUSTOMIZATION_POSES;
  });

  // Rooms State (Room A | Room B | + Nova room)
  const [rooms, setRooms] = useState<RoomEditorState[]>(() => {
    const saved = localStorage.getItem('3d_social_creator_rooms');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_ROOMS;
      }
    }
    return INITIAL_ROOMS;
  });

  const [activeRoomId, setActiveRoomId] = useState<string>('room-a');

  // Inventory State (GLB files uploaded)
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('3d_social_creator_inventory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_INVENTORY;
      }
    }
    return INITIAL_INVENTORY;
  });

  // User Auth State
  const [user, setUser] = useState<CreatorUser | null>(() => {
    const saved = localStorage.getItem('3d_social_creator_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {
          id: 'user-default',
          email: 'exman9001@gmail.com',
          displayName: 'Luzenne',
          isGuest: false,
        };
      }
    }
    return {
      id: 'user-default',
      email: 'exman9001@gmail.com',
      displayName: 'Luzenne',
      isGuest: false,
    };
  });

  // Required Top Controls:
  // 1. Toggle MODO AVATAR: ligado = clicar nos spots como visitante (teleporta). desligado = edição completa com Gizmo.
  const [isAvatarMode, setIsAvatarMode] = useState<boolean>(false);

  // 2. Ícone OLHO: liga/desliga o ghost do LIMITE jogável. Padrão OFF.
  const [showBoundaryGhost, setShowBoundaryGhost] = useState<boolean>(false);

  // Selection & 3D Editing State
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>('spot-2');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [customAvatarObjectId, setCustomAvatarObjectId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeGizmoMode, setActiveGizmoMode] = useState<GizmoEditMode>('mover');
  const [insertionCursorPoint, setInsertionCursorPoint] = useState<[number, number, number] | null>(null);
  const [avatarCurrentSpotId, setAvatarCurrentSpotId] = useState<string | null>('spot-2');
  const [is16x9MockupMode, setIs16x9MockupMode] = useState<boolean>(true);
  const [showSpots, setShowSpots] = useState<boolean>(true);
  const [lockSpots, setLockSpots] = useState<boolean>(false);

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBoundaryModalOpen, setIsBoundaryModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPublishItemModalOpen, setIsPublishItemModalOpen] = useState(false);
  const [isMyPublicationsModalOpen, setIsMyPublicationsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [publishingItem, setPublishingItem] = useState<InventoryItem | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Spot Visualization Config State (white pulse, yellow, arrow only, sizes)
  const [spotVisualConfig, setSpotVisualConfig] = useState<SpotVisualConfig>(() => {
    const saved = localStorage.getItem('3d_social_spot_visual_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      indicatorStyle: 'full',
      arrowScale: 1.0,
      signalScale: 1.0,
    };
  });

  useEffect(() => {
    localStorage.setItem('3d_social_spot_visual_config', JSON.stringify(spotVisualConfig));
  }, [spotVisualConfig]);

  const [isSpotVisualConfigModalOpen, setIsSpotVisualConfigModalOpen] = useState(false);
  const [isTrajectoryTimelineModalOpen, setIsTrajectoryTimelineModalOpen] = useState(false);
  const [timelineSpotId, setTimelineSpotId] = useState<string | null>(null);

  // Surface Snap Mode & Motion Spot Testing State
  const [isSurfaceSnapMode, setIsSurfaceSnapMode] = useState(false);
  const [surfaceSnapTargetObjectId, setSurfaceSnapTargetObjectId] = useState<string | null>(null);
  const [testingMotionSpotId, setTestingMotionSpotId] = useState<string | null>(null);

  // Restore GLB Blob URLs from IndexedDB on page load/refresh (ensuring full persistence)
  useEffect(() => {
    const restoreBlobs = async () => {
      let hasUpdated = false;
      const updatedInventory = await Promise.all(
        inventory.map(async (item) => {
          if (!item.fileBlobUrl || item.fileBlobUrl.startsWith('blob:')) {
            const blob = await getGlbFile(item.id);
            if (blob) {
              hasUpdated = true;
              return { ...item, fileBlobUrl: URL.createObjectURL(blob) };
            }
          }
          return item;
        })
      );

      if (hasUpdated) {
        setInventory(updatedInventory);

        setCustomizationItems((prev) => 
          prev.map((cItem) => {
            const guessedId = cItem.originalItemId || (cItem.id.startsWith('item-pub-') ? cItem.id.split('-').slice(2, -1).join('-') : undefined);
            if (cItem.isPublishedByCreator && guessedId && (!cItem.fileBlobUrl || cItem.fileBlobUrl.startsWith('blob:'))) {
              const matchingInvItem = updatedInventory.find(inv => inv.id === guessedId);
              if (matchingInvItem?.fileBlobUrl) {
                return { ...cItem, fileBlobUrl: matchingInvItem.fileBlobUrl, originalItemId: guessedId };
              }
            }
            return cItem;
          })
        );

        setStoreAvatars((prev) => 
          prev.map((av) => {
            const guessedId = av.originalItemId || (av.id.startsWith('av-pub-') ? av.id.split('-').slice(2, -1).join('-') : undefined);
            if (av.isUserPublished && guessedId && (!av.fileBlobUrl || av.fileBlobUrl.startsWith('blob:'))) {
              const matchingInvItem = updatedInventory.find(inv => inv.id === guessedId);
              if (matchingInvItem?.fileBlobUrl) {
                return { ...av, fileBlobUrl: matchingInvItem.fileBlobUrl, originalItemId: guessedId };
              }
            }
            return av;
          })
        );

        setRooms((prev) =>
          prev.map((room) => {
            const matchingScenario = updatedInventory.find(
              (i) => i.id === room.sceneAssetId
            );
            return {
              ...room,
              sceneAssetBlobUrl: matchingScenario?.fileBlobUrl || room.sceneAssetBlobUrl,
              placedObjects: room.placedObjects.map((obj) => {
                const matchingItem = updatedInventory.find((i) => i.id === obj.assetId);
                return matchingItem?.fileBlobUrl
                  ? { ...obj, fileBlobUrl: matchingItem.fileBlobUrl }
                  : obj;
              }),
            };
          })
        );
      }
    };

    restoreBlobs();
  }, []);

  // Active room helper
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];

  // Save state
  useEffect(() => {
    localStorage.setItem('3d_social_creator_rooms', JSON.stringify(rooms));
  }, [rooms]);

  // Auto-sync: If a room has sceneAssetBlobUrl but no corresponding 'cenario' in placedObjects,
  // register it as an editable placedObject so that the user can select and adjust it with the Gizmo!
  useEffect(() => {
    setRooms((prev) =>
      prev.map((r) => {
        if (
          r.sceneAssetBlobUrl &&
          !r.placedObjects.some(
            (o) => o.type === 'cenario' || (o.fileBlobUrl && o.fileBlobUrl === r.sceneAssetBlobUrl)
          )
        ) {
          const cenarioObj: PlacedObject = {
            id: `obj-cenario-${r.id}`,
            assetId: r.sceneAssetId || 'cenario',
            name:
              inventory.find(
                (i) => i.fileBlobUrl === r.sceneAssetBlobUrl || i.id === r.sceneAssetId
              )?.displayName || 'Cenário 3D da Sala',
            type: 'cenario',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            modelType: 'custom_glb',
            fileBlobUrl: r.sceneAssetBlobUrl,
          };
          return {
            ...r,
            placedObjects: [cenarioObj, ...r.placedObjects],
          };
        }
        return r;
      })
    );
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('3d_social_creator_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('3d_social_creator_customization_items', JSON.stringify(customizationItems));
  }, [customizationItems]);

  useEffect(() => {
    localStorage.setItem('3d_social_creator_store_avatars', JSON.stringify(storeAvatars));
  }, [storeAvatars]);

  useEffect(() => {
    localStorage.setItem('3d_social_creator_poses', JSON.stringify(avatarPoses));
  }, [avatarPoses]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('3d_social_creator_user', JSON.stringify(user));
    }
  }, [user]);

  // Logout Handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    const guestUser: CreatorUser = {
      id: `guest-${Date.now()}`,
      email: '',
      displayName: 'Visitante (Luzenne)',
      isGuest: true,
    };
    setUser(guestUser);
    localStorage.setItem('3d_social_creator_user', JSON.stringify(guestUser));
    showToast('Você saiu da sua conta.');
  };

  const handlePublishPose = (newPose: AvatarPoseConfig) => {
    setAvatarPoses((prev) => [newPose, ...prev.filter((p) => p.id !== newPose.id)]);
    showToast(`Pose "${newPose.name}" salva com sucesso!`);
  };

  const handleAcquirePose = (poseId: string) => {
    setAvatarPoses((prev) =>
      prev.map((p) => (p.id === poseId ? { ...p, owned: true } : p))
    );
  };

  // Check Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || 'criador@supabase.io',
          displayName: data.session.user.email?.split('@')[0] || 'Luzenne',
          isGuest: false,
        });
      }
    });

    // Sync public store items from Supabase (accessible across all accounts and tabs)
    fetchPublicStoreItems().then((res) => {
      if (res.items.length > 0) {
        setCustomizationItems((prev) => {
          const merged = [...prev];
          for (const it of res.items) {
            const idx = merged.findIndex((m) => m.id === it.id);
            if (idx >= 0) merged[idx] = it;
            else merged.unshift(it);
          }
          return merged;
        });
      }
      if (res.avatars.length > 0) {
        setStoreAvatars((prev) => {
          const merged = [...prev];
          for (const av of res.avatars) {
            const idx = merged.findIndex((m) => m.id === av.id);
            if (idx >= 0) merged[idx] = av;
            else merged.unshift(av);
          }
          return merged;
        });
      }
      if (res.poses.length > 0) {
        setAvatarPoses((prev) => {
          const merged = [...prev];
          for (const p of res.poses) {
            const idx = merged.findIndex((m) => m.id === p.id);
            if (idx >= 0) merged[idx] = p;
            else merged.unshift(p);
          }
          return merged;
        });
      }
    }).catch((err) => {
      console.warn('Initial fetchPublicStoreItems failed:', err);
    });
  }, []);

  const showToast = (message: string) => {
    setStatusToast(message);
    setTimeout(() => {
      setStatusToast(null);
    }, 3200);
  };

  // Customization & Shop Handlers (matching user request)
  const handleToggleEquipItem = (itemId: string) => {
    setCustomizationItems((prev) => {
      const target = prev.find((i) => i.id === itemId);
      if (!target) return prev;
      const willEquip = !target.equipped;

      return prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, equipped: willEquip };
        }
        // If equipping, unequip others in the same category
        if (willEquip && item.category === target.category) {
          return { ...item, equipped: false };
        }
        return item;
      });
    });
    showToast('Aparência atualizada no pedestal!');
  };

  const handleRemoveItemFromInventory = (itemId: string) => {
    setCustomizationItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, owned: false, equipped: false } : item
      )
    );
    showToast('Item removido do inventário de comprados.');
  };

  const handleApplyPose = (poseId: string) => {
    setAvatarPoses((prev) =>
      prev.map((p) => ({
        ...p,
        applied: p.id === poseId,
      }))
    );
  };

  const handleRemovePose = (poseId: string) => {
    setAvatarPoses((prev) =>
      prev.map((p) =>
        p.id === poseId ? { ...p, applied: false } : p
      )
    );
  };

  const handleSelectActiveAvatar = (avatarId: string) => {
    setActiveAvatarId(avatarId);
    localStorage.setItem('3d_social_creator_active_avatar_id', avatarId);
    setStoreAvatars((prev) =>
      prev.map((a) => ({
        ...a,
        applied: a.id === avatarId,
      }))
    );
  };

  const handleAcquireStoreAvatar = (avatarId: string) => {
    setActiveAvatarId(avatarId);
    localStorage.setItem('3d_social_creator_active_avatar_id', avatarId);
    const targetAvatar = storeAvatars.find((a) => a.id === avatarId);
    setStoreAvatars((prev) =>
      prev.map((a) => {
        if (a.id === avatarId) {
          return { ...a, owned: true, applied: true };
        }
        return { ...a, applied: false };
      })
    );

    // "se o item da loja for avatar ou tipo pose voce pode adiconar no inventario do usuario"
    if (targetAvatar) {
      setInventory((prev) => {
        if (prev.some((item) => item.id === targetAvatar.id || item.displayName === targetAvatar.name)) {
          return prev;
        }
        const newInvAvatar: InventoryItem = {
          id: targetAvatar.id,
          fileName: `${targetAvatar.name}.glb`,
          displayName: targetAvatar.name,
          thumbUrl: targetAvatar.thumb,
          type: 'Avatar',
          createdAt: new Date().toLocaleDateString(),
          fileBlobUrl: targetAvatar.fileBlobUrl,
          modelType: 'avatar',
        };
        return [newInvAvatar, ...prev];
      });
      showToast(`Avatar "${targetAvatar.name}" adquirido e adicionado ao seu Inventário!`);
    }
  };

  const handleAcquireCustomItem = (item: CustomizationItem) => {
    setCustomizationItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.map((i) => (i.id === item.id ? { ...i, owned: true } : i));
      }
      return [...prev, { ...item, owned: true, equipped: false }];
    });

    // Also add to creator inventory if not already present
    setInventory((prev) => {
      if (prev.some((inv) => inv.id === item.id || inv.displayName === item.name)) return prev;
      const newInv: InventoryItem = {
        id: item.id,
        fileName: `${item.name}.glb`,
        displayName: item.name,
        thumbUrl: item.thumb,
        type: item.isAccessory ? 'Acessorio' : 'Item',
        isAccessory: item.isAccessory,
        actions: item.actions,
        accessoryAttachment: item.accessoryAttachment,
        accessoryTransform: item.accessoryTransform,
        createdAt: new Date().toLocaleDateString(),
        fileBlobUrl: item.fileBlobUrl,
      };
      return [newInv, ...prev];
    });
  };

  const handlePublishCustomItem = (itemData: Partial<CustomizationItem>) => {
    const newItem: CustomizationItem = {
      id: itemData.id || `pub-${Date.now()}`,
      code: itemData.code || `#P00${customizationItems.length + 1}`,
      name: itemData.name || 'Novo Item',
      category: itemData.category || 'chapeus',
      thumb: itemData.thumb || 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80',
      owned: true,
      equipped: false,
      price: itemData.price || 0,
      rarity: itemData.rarity || 'RARO',
      isPublishedByCreator: true,
      author: user?.displayName || 'Luzenne',
      description: itemData.description,
      isAccessory: itemData.isAccessory,
      actions: itemData.actions,
      accessoryAttachment: itemData.accessoryAttachment,
      accessoryTransform: itemData.accessoryTransform,
    };

    setCustomizationItems((prev) => [newItem, ...prev]);
    showToast(`"${newItem.name}" publicado com sucesso! Agora disponível para qualquer usuário na Loja.`);
  };

  const handlePublishInventoryItemToStore = (invItem: InventoryItem) => {
    setPublishingItem(invItem);
    setIsPublishItemModalOpen(true);
  };

  const handleConfirmPublishItem = async (payload: {
    item: InventoryItem;
    name: string;
    objectType: StoreObjectType;
    price: number;
    hashtags: string[];
    thumbnailUrl: string;
    rarity: 'COMUM' | 'RARO' | 'ÉLITE';
    description: string;
    publishMode: 'simples' | 'avancado';
    associatedAvatarIds?: string[];
    associatedAvatarNames?: string[];
    actions?: ObjectAction[];
    accessoryAttachment?: AccessoryAttachmentPoint;
    accessoryTransform?: AccessoryTransform;
  }) => {
    // 1. Persist to Supabase and guarantee localStorage persistence
    await persistStoreItem(
      {
        name: payload.name,
        objectType: payload.objectType,
        price: payload.price,
        hashtags: payload.hashtags,
        thumbnailUrl: payload.thumbnailUrl,
        rarity: payload.rarity,
        description: payload.description,
        publishMode: payload.publishMode,
        fileBlobUrl: payload.item.fileBlobUrl,
        originalItemId: payload.item.id,
        author: user?.displayName || 'Luzenne',
        associatedAvatarIds: payload.associatedAvatarIds,
        actions: payload.actions,
        accessoryAttachment: payload.accessoryAttachment,
        accessoryTransform: payload.accessoryTransform,
        metadata: {
          associatedAvatarNames: payload.associatedAvatarNames,
          actions: payload.actions,
          accessoryAttachment: payload.accessoryAttachment,
          accessoryTransform: payload.accessoryTransform,
          isAccessory: payload.objectType === 'acessorio',
        },
      },
      user
    );

    // 2. React state integration for accessories, poses, avatars or store customization items
    if (payload.objectType === 'acessorio') {
      const newAccessoryItem: CustomizationItem = {
        id: `acc-pub-${payload.item.id}-${Date.now()}`,
        code: `#AC${Math.floor(100 + Math.random() * 900)}`,
        name: payload.name,
        category: 'acessorios',
        thumb: payload.thumbnailUrl || payload.item.thumbUrl,
        owned: true,
        equipped: true,
        price: payload.price,
        rarity: payload.rarity,
        isPublishedByCreator: true,
        author: user?.displayName || 'Luzenne',
        fileBlobUrl: payload.item.fileBlobUrl,
        description: payload.description,
        isAccessory: true,
        accessoryAttachment: payload.accessoryAttachment || 'companion_float',
        accessoryTransform: payload.accessoryTransform || {
          position: [0, 1.4, 0.4],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        actions: payload.actions || [],
      };
      setCustomizationItems((prev) => [newAccessoryItem, ...prev.filter((i) => i.id !== newAccessoryItem.id)]);
      showToast(`Acessório "${newAccessoryItem.name}" publicado com sucesso com ${newAccessoryItem.actions?.length || 0} ações configuradas!`);
    } else if (payload.objectType === 'pose') {
      const newPose: AvatarPoseConfig = {
        id: `pose-pub-${payload.item.id}-${Date.now()}`,
        name: payload.name,
        applied: false,
        thumbnailUrl: payload.thumbnailUrl || payload.item.thumbUrl,
        description: payload.description,
        price: payload.price,
        owned: true,
        author: user?.displayName || 'Luzenne',
        isPublishedByCreator: true,
        associatedAvatarIds: payload.associatedAvatarIds,
        associatedAvatarNames: payload.associatedAvatarNames,
        rarity: payload.rarity,
      };
      setAvatarPoses((prev) => [newPose, ...prev.filter((p) => p.id !== newPose.id)]);
      showToast(
        `Pose "${newPose.name}" publicada com sucesso! ${
          newPose.associatedAvatarIds && newPose.associatedAvatarIds.length > 0
            ? `(Vinculada a ${newPose.associatedAvatarNames?.join(', ')})`
            : '(Pose Universal)'
        }`
      );
    } else if (payload.objectType === 'avatar') {
      const newAvatar: StoreAvatar = {
        id: `av-pub-${payload.item.id}-${Date.now()}`,
        name: payload.name,
        price: payload.price,
        rarity: payload.rarity,
        tags: payload.hashtags,
        thumb: payload.thumbnailUrl || payload.item.thumbUrl,
        author: user?.displayName || 'Luzenne',
        isUserPublished: true,
        owned: true,
        applied: false,
        fileBlobUrl: payload.item.fileBlobUrl,
        originalItemId: payload.item.id,
        description: payload.description,
      };
      setStoreAvatars((prev) => [newAvatar, ...prev.filter((a) => a.name !== payload.name)]);
    } else if (payload.objectType === 'sala') {
      const roomMatch = rooms.find(
        (r) => r.sceneAssetId === payload.item.id || r.sceneAssetBlobUrl === payload.item.fileBlobUrl
      );
      if (roomMatch) {
        await persistShowcaseRoom(
          { ...roomMatch, name: payload.name },
          user,
          { price: payload.price, hashtags: payload.hashtags, publishMode: payload.publishMode }
        );
      }
    } else {
      const newCustomItem: CustomizationItem = {
        id: `item-pub-${payload.item.id}-${Date.now()}`,
        code: `#P${Math.floor(100 + Math.random() * 900)}`,
        name: payload.name,
        category: payload.objectType === 'moveis' ? 'outros' : 'publicados',
        thumb: payload.thumbnailUrl || payload.item.thumbUrl,
        owned: true,
        equipped: false,
        price: payload.price,
        rarity: payload.rarity,
        isPublishedByCreator: true,
        author: user?.displayName || 'Luzenne',
        fileBlobUrl: payload.item.fileBlobUrl,
        originalItemId: payload.item.id,
        description: payload.description,
        actions: payload.actions || [],
        isAvatar: payload.objectType === 'avatar',
        isAccessory: payload.objectType === 'acessorio',
      };
      setCustomizationItems((prev) => [newCustomItem, ...prev.filter((i) => i.id !== newCustomItem.id)]);
    }

    // 3. Update inventory item
    setInventory((prev) =>
      prev.map((i) =>
        i.id === payload.item.id
          ? {
              ...i,
              displayName: payload.name,
              thumbUrl: payload.thumbnailUrl || i.thumbUrl,
              type: payload.objectType === 'acessorio' ? 'Acessorio' : i.type,
              isAccessory: payload.objectType === 'acessorio' || i.isAccessory,
              actions: payload.actions || i.actions,
              accessoryAttachment: payload.accessoryAttachment || i.accessoryAttachment,
              accessoryTransform: payload.accessoryTransform || i.accessoryTransform,
            }
          : i
      )
    );

    showToast(`"${payload.name}" publicado na Loja e Vitrine com sucesso!`);
  };

  const handleRenameInventoryItem = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setInventory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, displayName: trimmed } : item))
    );
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        name: room.sceneAssetId === id ? trimmed : room.name,
        placedObjects: room.placedObjects.map((obj) =>
          obj.assetId === id ? { ...obj, name: trimmed } : obj
        ),
      }))
    );
    showToast(`Nome alterado para "${trimmed}"`);
  };

  const handleRenamePlacedObject = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        placedObjects: room.placedObjects.map((obj) =>
          obj.id === id ? { ...obj, name: trimmed } : obj
        ),
      }))
    );
    showToast(`Objeto renomeado para "${trimmed}"`);
  };

  // Delete inventory item (including binary GLB from IndexedDB)
  const handleDeleteInventoryItem = async (itemId: string) => {
    const itemToRemove = inventory.find((i) => i.id === itemId);
    // 1. Delete binary from IndexedDB
    await deleteGlbFile(itemId);
    // 2. Remove from inventory
    setInventory((prev) => prev.filter((i) => i.id !== itemId));
    // 3. Clear from rooms if currently used as scenario or placed object
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        sceneAssetId: room.sceneAssetId === itemId ? null : room.sceneAssetId,
        sceneAssetBlobUrl: room.sceneAssetId === itemId ? undefined : room.sceneAssetBlobUrl,
        placedObjects: room.placedObjects.filter((o) => o.assetId !== itemId),
      }))
    );
    showToast(`Arquivo "${itemToRemove?.displayName || 'Item'}" excluído do inventário com sucesso.`);
  };

  // Restore project from imported .json / .3dproj package
  const handleRestoreProject = (restored: {
    rooms: RoomEditorState[];
    inventory: InventoryItem[];
    activeRoomId: string;
    customizationItems?: CustomizationItem[];
    storeAvatars?: StoreAvatar[];
    avatarPoses?: AvatarPoseConfig[];
    spotVisualConfig?: SpotVisualConfig;
  }) => {
    setRooms(restored.rooms);
    setInventory(restored.inventory);
    setActiveRoomId(restored.activeRoomId);

    if (restored.customizationItems) setCustomizationItems(restored.customizationItems);
    if (restored.storeAvatars) setStoreAvatars(restored.storeAvatars);
    if (restored.avatarPoses) setAvatarPoses(restored.avatarPoses);
    if (restored.spotVisualConfig) setSpotVisualConfig(restored.spotVisualConfig);

    localStorage.setItem('3d_social_creator_rooms', JSON.stringify(restored.rooms));
    localStorage.setItem('3d_social_creator_inventory', JSON.stringify(restored.inventory));
    if (restored.customizationItems) {
      localStorage.setItem('3d_social_creator_customization_items', JSON.stringify(restored.customizationItems));
    }
    if (restored.storeAvatars) {
      localStorage.setItem('3d_social_creator_store_avatars', JSON.stringify(restored.storeAvatars));
    }
    if (restored.avatarPoses) {
      localStorage.setItem('3d_social_creator_poses', JSON.stringify(restored.avatarPoses));
    }

    setCurrentScreen('editor');
    showToast('Projeto restaurado com sucesso! Você está exatamente de onde parou.');
  };

  // Load room for editing from MyPublicationsModal
  const handleLoadRoomForEdit = (roomState: RoomEditorState) => {
    setRooms((prev) => {
      const exists = prev.some((r) => r.id === roomState.id);
      if (exists) {
        return prev.map((r) => (r.id === roomState.id ? roomState : r));
      }
      return [roomState, ...prev];
    });
    setActiveRoomId(roomState.id);
    setCurrentScreen('editor');
    showToast(`Sala "${roomState.name}" carregada no editor para edição!`);
  };

  // Surface Snap Relative Spot Handlers
  const handleStartSurfaceSnap = (objectId?: string | null) => {
    setIsSurfaceSnapMode(true);
    if (objectId && objectId !== 'any') {
      const obj = activeRoom.placedObjects.find((o) => o.id === objectId);
      setSurfaceSnapTargetObjectId(objectId);
      showToast(`Passe o mouse sobre "${obj?.name || 'Objeto'}" e clique para fixar o spot na superfície!`);
    } else {
      setSurfaceSnapTargetObjectId('any');
      showToast('Passe o mouse sobre qualquer objeto 3D (esfera, sofá, carro, etc.) e clique para fixar o spot na superfície!');
    }
  };

  const handleCancelSurfaceSnap = () => {
    setIsSurfaceSnapMode(false);
    setSurfaceSnapTargetObjectId(null);
  };

  const handleAddRelativeSpot = (
    parentId: string,
    relativePos: [number, number, number],
    normal: [number, number, number],
    worldPos: [number, number, number]
  ) => {
    const parentObj = activeRoom.placedObjects.find((o) => o.id === parentId);
    const newSpotId = `spot-rel-${Date.now()}`;
    const newSpot: SpotItem = {
      id: newSpotId,
      name: `Spot ${parentObj?.name || 'Objeto'} #${activeRoom.spots.length + 1}`,
      type: 'sentar',
      position: worldPos,
      rotation: 0,
      parentObjectId: parentId,
      relativePosition: relativePos,
      surfaceNormal: normal,
    };

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, spots: [...r.spots, newSpot] } : r
      )
    );
    setSelectedSpotId(newSpotId);
    setIsSurfaceSnapMode(false);
    setSurfaceSnapTargetObjectId(null);
    showToast(`Spot relativo fixado com sucesso na superfície de "${parentObj?.name || 'Objeto'}"!`);
  };

  const handleDetachSpotFromObject = (spotId: string) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoomId) {
          return {
            ...r,
            spots: r.spots.map((s) =>
              s.id === spotId
                ? {
                    ...s,
                    parentObjectId: undefined,
                    relativePosition: undefined,
                    surfaceNormal: undefined,
                  }
                : s
            ),
          };
        }
        return r;
      })
    );
    showToast('Spot desvinculado do objeto. Agora é um spot livre.');
  };

  // Motion Spot Handlers
  const handleUpdateSpotMotion = (spotId: string, motion: SpotMotionConfig | undefined) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoomId) {
          return {
            ...r,
            spots: r.spots.map((s) => (s.id === spotId ? { ...s, motion } : s)),
          };
        }
        return r;
      })
    );
    if (motion?.enabled) {
      setTestingMotionSpotId(spotId);
      showToast('⚡ Simulação de movimento ativada para o ponto!');
    } else {
      setTestingMotionSpotId((prev) => (prev === spotId ? null : prev));
      showToast('Motion desativado no spot.');
    }
  };

  const handleToggleTestSpotMotion = (spotId: string) => {
    setTestingMotionSpotId((prev) => (prev === spotId ? null : spotId));
  };

  // Add new Room tab
  const handleAddNewRoom = () => {
    const nextLetter = String.fromCharCode(65 + rooms.length);
    const newRoom: RoomEditorState = {
      id: `room-${Date.now()}`,
      name: `Room ${nextLetter} · Novo Salão`,
      sceneAssetId: 'cenario-padrao',
      placedObjects: [],
      spots: [
        {
          id: `spot-${Date.now()}-1`,
          name: 'Pé Entrada',
          type: 'pe',
          position: [0, 0.02, 1.0],
          rotation: 0,
        },
      ],
      boundary: {
        x: 6.0,
        y: 2.8,
        z: 8.0,
        isConfirmed: false,
      },
      isPublished: false,
    };

    setRooms((prev) => [...prev, newRoom]);
    setActiveRoomId(newRoom.id);
    setSelectedSpotId(newRoom.spots[0].id);
    setSelectedObjectId(null);
    showToast(`Nova Room ${nextLetter} criada com sucesso!`);
  };

  // Upload handler (supports real GLB blob URLs and direct placement with Gizmo)
  const handleUploadSuccess = (
    item: InventoryItem,
    autoInsertPoint?: [number, number, number] | null
  ) => {
    setInventory((prev) => [item, ...prev]);

    // 1. If user uploads a 'Sala' (architectural 3D scenario)
    if (item.type === 'Sala') {
      const targetPoint = autoInsertPoint || (insertionCursorPoint ? [insertionCursorPoint[0], 0.0, insertionCursorPoint[2]] : [0, 0, 0]);
      const newObjId = `obj-cenario-${Date.now()}`;
      const newPlacedObject: PlacedObject = {
        id: newObjId,
        assetId: item.id,
        name: item.displayName,
        type: 'cenario',
        position: [targetPoint[0], 0.0, targetPoint[2]] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        modelType: 'custom_glb',
        fileBlobUrl: item.fileBlobUrl,
      };

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== activeRoomId) return r;
          const cleanPlaced = r.placedObjects.filter((o) => o.type !== 'cenario');
          return {
            ...r,
            sceneAssetId: item.id,
            sceneAssetBlobUrl: item.fileBlobUrl,
            placedObjects: [newPlacedObject, ...cleanPlaced],
          };
        })
      );
      setSelectedObjectId(newObjId);
      setSelectedSpotId(null);
      setInsertionCursorPoint(null);
      setIsAvatarMode(false); // Mode edit on so gizmo is visible
      showToast(`Cenário 3D "${item.displayName}" inserido! Ajuste com o Gizmo (Mover, Rodar, Escalar, Elevar).`);
      return;
    }

    // 2. If user uploads an 'Avatar' or 'Item'
    if (autoInsertPoint && (item.type === 'Item' || item.type === 'Avatar')) {
      const targetPoint = autoInsertPoint;
      const isAvatarType = item.type === 'Avatar';
      const newObjId = `obj-${isAvatarType ? 'avatar' : 'item'}-${Date.now()}`;
      const newPlacedObject: PlacedObject = {
        id: newObjId,
        assetId: item.id,
        name: item.displayName,
        type: isAvatarType ? 'avatar' : 'movel',
        isAvatar: isAvatarType,
        position: [targetPoint[0], 0.0, targetPoint[2]] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        modelType: (item.modelType || (isAvatarType ? 'avatar' : 'custom_glb')) as any,
        fileBlobUrl: item.fileBlobUrl,
      };

      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? { ...r, placedObjects: [...r.placedObjects, newPlacedObject] }
            : r
        )
      );
      setSelectedObjectId(newObjId);
      setSelectedSpotId(null);
      setInsertionCursorPoint(null);
      setIsAvatarMode(false); // Mode edit on so gizmo is visible
      if (isAvatarType) {
        setCustomAvatarObjectId(newObjId);
      }
      showToast(`"${item.displayName}" inserido na cena 3D! Ajuste com o Gizmo.`);
    } else {
      showToast(`"${item.displayName}" salvo no inventário! Clique em "Inserir na Cena" quando desejar colocá-lo.`);
    }
  };

  // Insert GLB or asset into the scene (supporting Sala, Avatar, and Item with Gizmo)
  const handleInsertAssetToScene = (asset: InventoryItem) => {
    const spawnPoint: [number, number, number] = insertionCursorPoint
      ? [insertionCursorPoint[0], 0.0, insertionCursorPoint[2]]
      : [0, 0.0, 0];

    // If it's a scene file (Sala), load as scenario and enable full Gizmo
    if (asset.type === 'Sala') {
      const newObjId = `obj-cenario-${Date.now()}`;
      const newPlacedObject: PlacedObject = {
        id: newObjId,
        assetId: asset.id,
        name: asset.displayName,
        type: 'cenario',
        position: spawnPoint,
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        modelType: 'custom_glb',
        fileBlobUrl: asset.fileBlobUrl,
      };

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== activeRoomId) return r;
          const cleanPlaced = r.placedObjects.filter((o) => o.type !== 'cenario');
          return {
            ...r,
            sceneAssetId: asset.id,
            sceneAssetBlobUrl: asset.fileBlobUrl,
            placedObjects: [newPlacedObject, ...cleanPlaced],
          };
        })
      );
      setSelectedObjectId(newObjId);
      setSelectedSpotId(null);
      setInsertionCursorPoint(null);
      setIsAvatarMode(false);
      showToast(`Cenário 3D "${asset.displayName}" inserido na room! Ajuste com o Gizmo.`);
      return;
    }

    const isAvatarType = asset.type === 'Avatar';
    const newObjId = `obj-${isAvatarType ? 'avatar' : 'item'}-${Date.now()}`;
    const newPlacedObject: PlacedObject = {
      id: newObjId,
      assetId: asset.id,
      name: asset.displayName,
      type: isAvatarType ? 'avatar' : 'movel',
      isAvatar: isAvatarType,
      position: spawnPoint,
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      modelType: (asset.modelType || (isAvatarType ? 'avatar' : 'custom_glb')) as any,
      fileBlobUrl: asset.fileBlobUrl,
    };

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? { ...r, placedObjects: [...r.placedObjects, newPlacedObject] }
          : r
      )
    );

    setSelectedObjectId(newObjId);
    setSelectedSpotId(null);
    setInsertionCursorPoint(null);
    setIsAvatarMode(false);
    if (isAvatarType) {
      setCustomAvatarObjectId(newObjId);
    }
    showToast(`"${asset.displayName}" inserido na cena! Ajuste com o Gizmo.`);
  };

  // Update object transform via Gizmo (with strict numeric sanitization)
  const handleUpdateObjectTransform = (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }
  ) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== activeRoomId) return r;
        const updatedPlacedObjects = r.placedObjects.map((obj) => {
          if (obj.id !== id) return obj;
          const safePos: [number, number, number] = [
            Number.isFinite(transform.position[0]) ? transform.position[0] : obj.position[0],
            Number.isFinite(transform.position[1]) ? transform.position[1] : obj.position[1],
            Number.isFinite(transform.position[2]) ? transform.position[2] : obj.position[2],
          ];
          const safeRot: [number, number, number] = [
            Number.isFinite(transform.rotation[0]) ? transform.rotation[0] : obj.rotation[0],
            Number.isFinite(transform.rotation[1]) ? transform.rotation[1] : obj.rotation[1],
            Number.isFinite(transform.rotation[2]) ? transform.rotation[2] : obj.rotation[2],
          ];
          const safeScale: [number, number, number] = [
            Number.isFinite(transform.scale[0]) && transform.scale[0] >= 0.05 ? transform.scale[0] : obj.scale[0],
            Number.isFinite(transform.scale[1]) && transform.scale[1] >= 0.05 ? transform.scale[1] : obj.scale[1],
            Number.isFinite(transform.scale[2]) && transform.scale[2] >= 0.05 ? transform.scale[2] : obj.scale[2],
          ];
          return {
            ...obj,
            position: safePos,
            rotation: safeRot,
            scale: safeScale,
          };
        });

        // Also update world position coordinates of any relative spots attached to this object
        const targetObj = updatedPlacedObjects.find((o) => o.id === id);
        let updatedSpots = r.spots;
        if (targetObj) {
          const tempObj = new THREE.Object3D();
          tempObj.position.set(...targetObj.position);
          tempObj.rotation.set(...targetObj.rotation);
          tempObj.scale.set(...targetObj.scale);
          tempObj.updateMatrixWorld();

          updatedSpots = r.spots.map((spot) => {
            if (spot.parentObjectId === id && spot.relativePosition) {
              const worldPos = tempObj.localToWorld(new THREE.Vector3(...spot.relativePosition));
              return {
                ...spot,
                position: [
                  parseFloat(worldPos.x.toFixed(2)),
                  parseFloat(worldPos.y.toFixed(2)),
                  parseFloat(worldPos.z.toFixed(2)),
                ],
              };
            }
            return spot;
          });
        }

        return {
          ...r,
          placedObjects: updatedPlacedObjects,
          spots: updatedSpots,
        };
      })
    );
  };

  // Remove object from scene (keeps file in inventory)
  const handleRemoveObject = (id: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? {
              ...r,
              placedObjects: r.placedObjects.filter((obj) => obj.id !== id),
            }
          : r
      )
    );
    setSelectedObjectId(null);
    showToast('Objeto removido da cena. O arquivo continua no inventário.');
  };

  // Spot management
  const handleAddSpot = (type: SpotType, name: string) => {
    const newSpot: SpotItem = {
      id: `spot-${Date.now()}`,
      name,
      type,
      position: [
        parseFloat(((Math.random() - 0.5) * 2.2).toFixed(2)),
        type === 'sentar' ? 0.52 : 0.02,
        parseFloat(((Math.random() - 0.5) * 1.6 + 0.4).toFixed(2)),
      ],
      rotation: 0,
    };

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, spots: [...r.spots, newSpot] } : r
      )
    );
    setSelectedSpotId(newSpot.id);
    setSelectedObjectId(null);
    showToast(`Spot "${name}" (${type}) adicionado!`);
  };

  const handleRemoveSpot = (spotId: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? { ...r, spots: r.spots.filter((s) => s.id !== spotId) }
          : r
      )
    );
    if (selectedSpotId === spotId) setSelectedSpotId(null);
    showToast('Spot removido da cena.');
  };

  const handleAddSpotAtObject = (objectId: string) => {
    const currentRoom = rooms.find((r) => r.id === activeRoomId);
    if (!currentRoom) return;

    const targetObj = currentRoom.placedObjects.find((o) => o.id === objectId);
    if (!targetObj) return;

    // Detect spot type based on object name/type
    const isSitting =
      targetObj.name.toLowerCase().includes('sofa') ||
      targetObj.name.toLowerCase().includes('cadeira') ||
      targetObj.name.toLowerCase().includes('chair') ||
      targetObj.name.toLowerCase().includes('seat') ||
      targetObj.name.toLowerCase().includes('banco') ||
      targetObj.name.toLowerCase().includes('poltrona') ||
      targetObj.modelType === 'sofa' ||
      targetObj.modelType === 'chair';

    const isLying =
      targetObj.name.toLowerCase().includes('cama') ||
      targetObj.name.toLowerCase().includes('bed') ||
      targetObj.name.toLowerCase().includes('deitar');

    const spotType: SpotType = isLying ? 'deitar' : isSitting ? 'sentar' : 'pe';

    // Match object's orientation in degrees
    const rotDeg = Math.round(
      (((targetObj.rotation[1] * (180 / Math.PI)) % 360) + 360) % 360
    );

    // Exact coordinate of the object
    const newSpot: SpotItem = {
      id: `spot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `Spot (${targetObj.name})`,
      type: spotType,
      position: [
        parseFloat(targetObj.position[0].toFixed(2)),
        parseFloat(targetObj.position[1].toFixed(2)),
        parseFloat(targetObj.position[2].toFixed(2)),
      ],
      rotation: rotDeg,
    };

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, spots: [...r.spots, newSpot] } : r
      )
    );
    setSelectedSpotId(newSpot.id);
    setSelectedObjectId(null);
    showToast(
      `📍 Spot criado na coordenada de "${targetObj.name}"! O spot permanece mesmo se você remover o objeto.`
    );
  };

  const handleClearAllSpots = () => {
    setRooms((prev) =>
      prev.map((r) => (r.id === activeRoomId ? { ...r, spots: [] } : r))
    );
    setSelectedSpotId(null);
    showToast('Todos os spots foram removidos da cena.');
  };

  const handleRemoveOverlappingSpots = () => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== activeRoomId) return r;
        const keptSpots: SpotItem[] = [];
        const threshold = 0.45; // meters distance to consider overlapping
        for (const spot of r.spots) {
          const isOverlapping = keptSpots.some((k) => {
            const dx = k.position[0] - spot.position[0];
            const dz = k.position[2] - spot.position[2];
            return Math.sqrt(dx * dx + dz * dz) < threshold;
          });
          if (!isOverlapping) {
            keptSpots.push(spot);
          }
        }
        const removedCount = r.spots.length - keptSpots.length;
        if (removedCount > 0) {
          showToast(`${removedCount} spot(s) sobreposto(s) removido(s)!`);
        } else {
          showToast('Nenhum spot sobreposto encontrado.');
        }
        return { ...r, spots: keptSpots };
      })
    );
  };

  const handleUpdateSpotPosition = (id: string, position: [number, number, number]) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== activeRoomId) return r;
        return {
          ...r,
          spots: r.spots.map((s) => {
            if (s.id !== id) return s;
            let updatedRelativePos = s.relativePosition;
            if (s.parentObjectId) {
              const parentObj = r.placedObjects.find((o) => o.id === s.parentObjectId);
              if (parentObj) {
                const tempParent = new THREE.Object3D();
                tempParent.position.set(...parentObj.position);
                tempParent.rotation.set(...parentObj.rotation);
                tempParent.scale.set(...parentObj.scale);
                tempParent.updateMatrixWorld();
                const newLocal = tempParent.worldToLocal(new THREE.Vector3(...position));
                updatedRelativePos = [
                  parseFloat(newLocal.x.toFixed(3)),
                  parseFloat(newLocal.y.toFixed(3)),
                  parseFloat(newLocal.z.toFixed(3)),
                ];
              }
            }
            return {
              ...s,
              position,
              relativePosition: updatedRelativePos,
            };
          }),
        };
      })
    );
  };

  const handleUpdateSpotRotation = (id: string, rotation: number) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? {
              ...r,
              spots: r.spots.map((s) => (s.id === id ? { ...s, rotation } : s)),
            }
          : r
      )
    );
  };

  const handleAvatarTeleport = (spotId: string) => {
    setAvatarCurrentSpotId(spotId);
    const spot = activeRoom.spots.find((s) => s.id === spotId);
    if (!spot) return;

    // Detect target avatar object (customAvatarObjectId or any object marked as avatar)
    const targetAvatarObj =
      activeRoom.placedObjects.find((o) => o.id === customAvatarObjectId) ||
      activeRoom.placedObjects.find((o) => o.isAvatar || o.type === 'avatar');

    if (targetAvatarObj) {
      if (customAvatarObjectId !== targetAvatarObj.id) {
        setCustomAvatarObjectId(targetAvatarObj.id);
      }
      // Reposition the custom avatar object onto the clicked spot
      const spotAngleRad = (spot.rotation * Math.PI) / 180;
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? {
                ...r,
                placedObjects: r.placedObjects.map((obj) =>
                  obj.id === targetAvatarObj.id
                    ? {
                        ...obj,
                        position: [spot.position[0], spot.position[1], spot.position[2]],
                        rotation: [obj.rotation[0], spotAngleRad, obj.rotation[2]],
                      }
                    : obj
                ),
              }
            : r
        )
      );
      showToast(`Avatar "${targetAvatarObj.name}" posicionado no spot "${spot.name || 'Spot'}"!`);
    } else {
      showToast(`Avatar posicionado no spot "${spot.name || 'Spot'}"!`);
    }
  };

  // Drag and drop asset from inventory directly into 3D scene floor
  const handleDropItemOnScene = (item: InventoryItem, coords: [number, number, number]) => {
    if (item.type === 'Sala') {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? {
                ...r,
                sceneAssetBlobUrl: item.fileBlobUrl || undefined,
                sceneAssetId: item.id,
              }
            : r
        )
      );
      showToast(`Cenário 3D "${item.displayName}" carregado na cena!`);
      return;
    }

    const newObjId = `obj-${Date.now()}`;
    const newPlacedObject = {
      id: newObjId,
      assetId: item.id,
      name: item.displayName,
      type: 'movel' as const,
      position: coords,
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      modelType: (item.modelType || 'custom_glb') as any,
      fileBlobUrl: item.fileBlobUrl,
    };

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? { ...r, placedObjects: [...r.placedObjects, newPlacedObject] }
          : r
      )
    );

    setSelectedObjectId(newObjId);
    setSelectedSpotId(null);
    showToast(`"${item.displayName}" inserido diretamente na posição [${coords[0]}, ${coords[2]}]!`);
  };

  // Boundary save
  const handleSaveBoundary = (boundary: PlayableBoundary) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === activeRoomId ? { ...r, boundary } : r))
    );
    showToast(`Limite jogável salvo: ${boundary.x}m × ${boundary.y}m × ${boundary.z}m!`);
  };

  // Publish room
  const handlePublishRoom = () => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, isPublished: true, publishedAt: 'Agora' } : r
      )
    );
    setIsPublishModalOpen(true);
    showToast(`"${activeRoom.name}" publicada com sucesso! Ela agora aparece na Vitrine.`);
  };

  // Change placed object type (Móvel | Objeto | Avatar | Acessório)
  const handleUpdateObjectType = (
    id: string,
    type: 'cenario' | 'movel' | 'objeto' | 'avatar' | 'acessorio'
  ) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId
          ? {
              ...r,
              placedObjects: r.placedObjects.map((obj) =>
                obj.id === id
                  ? {
                      ...obj,
                      type,
                      isAvatar: type === 'avatar',
                      isAccessory: type === 'acessorio',
                    }
                  : obj
              ),
            }
          : r
      )
    );

    if (type === 'avatar') {
      setCustomAvatarObjectId(id);
      showToast(`Objeto definido como Avatar! Ative o Modo Avatar para controlá-lo nos spots.`);
    } else if (type === 'acessorio') {
      if (customAvatarObjectId === id) {
        setCustomAvatarObjectId(null);
      }
      showToast(`Objeto definido como Acessório! Agora você pode equipar no avatar ou publicar na loja.`);
    } else {
      if (customAvatarObjectId === id) {
        setCustomAvatarObjectId(null);
      }
      showToast(`Tipo de objeto alterado para "${type}".`);
    }
  };

  // Dynamic lobby showcase rooms (combining default rooms + published editor rooms + persisted showcase rooms)
  const lobbyRooms: RoomData[] = React.useMemo(() => {
    let localShowcaseRooms: RoomData[] = [];
    try {
      const raw = localStorage.getItem('3d_social_creator_lobby_rooms');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localShowcaseRooms = parsed.map((item: any) => ({
            id: item.id || `showcase-${Date.now()}`,
            name: item.name || 'Sala Vitrine 3D',
            badge: item.badge || '👑',
            occupation: item.occupancy || '1/8',
            currentUsers: item.currentUsers || 1,
            maxUsers: item.maxUsers || 8,
            thumb: item.thumb || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
            description: item.description || 'Sala publicada na vitrine de rooms.',
            isFromEditor: true,
            editorRoomId: item.editorRoom?.id,
            editorRoom: item.editorRoom,
            ambientColor: '#ffd700',
          }));
        }
      }
    } catch (e) {
      console.warn('Error parsing local showcase rooms:', e);
    }

    const publishedEditorRooms: RoomData[] = rooms
      .filter((r) => r.isPublished)
      .map((r) => ({
        id: `editor-${r.id}`,
        name: r.name,
        badge: '👑',
        occupation: '0/8',
        currentUsers: 0,
        maxUsers: 8,
        thumb:
          r.sceneAssetId === 'inv-scene-1'
            ? 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
            : r.sceneAssetId === 'inv-scene-2'
            ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
            : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        description: `Room criada no Modo Criador · Limite ${r.boundary.x}m × ${r.boundary.y}m × ${r.boundary.z}m com ${r.spots.length} spots ativos.`,
        isFromEditor: true,
        editorRoomId: r.id,
        editorRoom: r,
        ambientColor: '#ffd700',
      }));

    const combined = [...INITIAL_LOBBY_ROOMS, ...publishedEditorRooms];
    for (const sRoom of localShowcaseRooms) {
      if (!combined.some((c) => c.id === sRoom.id || c.name === sRoom.name)) {
        combined.push(sRoom);
      }
    }

    return combined;
  }, [rooms]);

  // Handle Playtest room without publishing or appearing in vitrine
  const handlePlaytestActiveRoom = () => {
    setIsPublishModalOpen(false);
    const playtestRoomData: RoomData = {
      id: `playtest-${activeRoom.id}`,
      name: `[TESTE] ${activeRoom.name}`,
      badge: '🧪',
      occupation: '1/8 (Você)',
      currentUsers: 1,
      maxUsers: 8,
      thumb:
        activeRoom.sceneAssetId === 'inv-scene-1'
          ? 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
          : activeRoom.sceneAssetId === 'inv-scene-2'
          ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
          : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      description: `Modo teste interativo da room. Interaja com os spots e avatar sem publicar na vitrine.`,
      isFromEditor: true,
      editorRoomId: activeRoom.id,
      editorRoom: activeRoom,
      isPlaytest: true,
      ambientColor: '#ffd700',
    };
    setSelectedLobbyRoom(playtestRoomData);
    setCurrentScreen('room');
    showToast(`Iniciando Modo Teste Interativo de "${activeRoom.name}"!`);
  };

  // Go to showcase after publishing
  const handleGoToVitrine = () => {
    setIsPublishModalOpen(false);
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, isPublished: true, publishedAt: 'Agora' } : r
      )
    );
    const targetRoomId = `editor-${activeRoom.id}`;
    const foundIndex = lobbyRooms.findIndex((r) => r.id === targetRoomId);
    if (foundIndex >= 0) {
      setLobbyRoomIndex(foundIndex);
    } else {
      setLobbyRoomIndex(lobbyRooms.length);
    }
    setCurrentScreen('lobby');
    showToast(`Exibindo "${activeRoom.name}" na Vitrine de Rooms!`);
  };

  const timelineSpot = activeRoom.spots.find((s) => s.id === timelineSpotId) || activeRoom.spots[0] || null;

  return (
    <>
      {/* Screen 1: Lobby View (Portals & Social Hall) */}
      {currentScreen === 'lobby' && (
        <LobbyView
          rooms={lobbyRooms}
          selectedRoomIndex={lobbyRoomIndex}
          onSelectRoomIndex={setLobbyRoomIndex}
          onEnterRoom={(room) => {
            setSelectedLobbyRoom(room);
            setCurrentScreen('room');
          }}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenShop={() => {
            setCustomizationInitialTab('loja');
            setCurrentScreen('customization');
          }}
          onOpenCustomization={() => {
            setCustomizationInitialTab('inventario');
            setCurrentScreen('customization');
          }}
          onOpenFriends={() => {
            showToast('Lista de amigos conectada.');
          }}
          onOpenEditor={() => setCurrentScreen('editor')}
          user={user}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {/* Screen 2: User Customization & Loja View (Matching Images 2 & 3) */}
      {currentScreen === 'customization' && (
        <UserCustomizationView
          onBackToLobby={() => setCurrentScreen('lobby')}
          user={user}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          initialTab={customizationInitialTab}
          userInventory={inventory}
          customizationItems={customizationItems}
          storeAvatars={storeAvatars}
          poses={avatarPoses}
          onToggleEquipItem={handleToggleEquipItem}
          onRemoveItemFromInventory={handleRemoveItemFromInventory}
          onApplyPose={handleApplyPose}
          onRemovePose={handleRemovePose}
          onAcquireStoreAvatar={handleAcquireStoreAvatar}
          onAcquireCustomItem={handleAcquireCustomItem}
          onPublishCustomItem={handlePublishCustomItem}
          onSelectActiveAvatar={handleSelectActiveAvatar}
          onPublishPose={handlePublishPose}
          onAcquirePose={handleAcquirePose}
          onUpdateCustomizationItemTransform={(itemId, transform) => {
            setCustomizationItems((prev) =>
              prev.map((it) =>
                it.id === itemId ? { ...it, accessoryTransform: transform } : it
              )
            );
          }}
          onSaveToInventory={(item) => {
            const newItem: InventoryItem = {
              id: `inv-${Date.now()}`,
              name: item.name || 'Item',
              type: ('isAvatar' in item && item.isAvatar) || ('category' in item && item.category === 'avatar') ? 'avatar' : ('category' in item && item.category === 'poses') ? 'pose' : 'objeto',
              thumbnailUrl: item.thumbnailUrl || '',
              fileBlobUrl: item.fileBlobUrl,
            };
            setInventory((prev) => [newItem, ...prev]);
            showToast(`${item.name || 'Item'} salvo no seu Inventário (Modo Criação)!`);
          }}
          onSyncPublicStoreItems={(items, avatars, posesList) => {
            if (items.length > 0) setCustomizationItems(items);
            if (avatars.length > 0) setStoreAvatars(avatars);
            if (posesList.length > 0) setAvatarPoses(posesList);
          }}
        />
      )}

      {/* Screen 3: Social Room View (Avatar Lounge with Poses, Chat & Gizmo) */}
      {currentScreen === 'room' && selectedLobbyRoom && (
        <RoomView
          room={selectedLobbyRoom}
          activeUserAvatar={activeUserAvatar}
          user={user}
          poses={avatarPoses}
          storeAvatars={storeAvatars}
          onExitToLobby={() => {
            if (selectedLobbyRoom.isPlaytest) {
              setCurrentScreen('editor');
            } else {
              setCurrentScreen('lobby');
            }
          }}
          equippedAccessories={[]}
          spotVisualConfig={spotVisualConfig}
        />
      )}

      {/* Screen 4: Creator Editor 3D Mode */}
      <div className={currentScreen === 'editor' ? 'block' : 'hidden'}>
        <div className="w-screen h-screen bg-[#0a0b0d] text-[#e0cfb3] font-sans flex items-center justify-center p-0 md:p-3 overflow-hidden select-none">
      {/* 16:9 Mockup Frame with Fine Gold Border matching the new visual identity */}
      <div
        className={`relative w-full h-full bg-[#101115] border border-[#d4af37]/30 rounded-none md:rounded-xl overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.85)] flex flex-col ${
          is16x9MockupMode ? 'max-w-[1440px] aspect-video max-h-[96vh]' : 'max-w-none'
        }`}
      >
        {/* TOP BAR / HEADER with required controls */}
        <CreatorHeader
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={(id) => {
            setActiveRoomId(id);
            setSelectedSpotId(null);
            setSelectedObjectId(null);
          }}
          onAddNewRoom={handleAddNewRoom}
          onOpenBoundaryModal={() => setIsBoundaryModalOpen(true)}
          onPublishRoom={handlePublishRoom}
          onOpenPublicationsModal={() => setIsMyPublicationsModalOpen(true)}
          onOpenProjectModal={() => setIsProjectModalOpen(true)}
          onPlaytestRoom={handlePlaytestActiveRoom}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          user={user}
          onLogout={handleLogout}
          isAvatarMode={isAvatarMode}
          onToggleAvatarMode={() => setIsAvatarMode(!isAvatarMode)}
          showBoundaryGhost={showBoundaryGhost}
          onToggleBoundaryGhost={() => setShowBoundaryGhost(!showBoundaryGhost)}
          showSpots={showSpots}
          onToggleShowSpots={() => setShowSpots(!showSpots)}
          lockSpots={lockSpots}
          onToggleLockSpots={() => setLockSpots(!lockSpots)}
          onExitEditor={() => setCurrentScreen('lobby')}
        />

        {/* MAIN STUDIO WORKSPACE: Left Sidebar (Spots / Inventário) + 3D Center Editor Canvas */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar matching user screenshot with Spots, Objetos (com lixeira) e Itens */}
          <CreatorSidebar
            inventory={inventory}
            spots={activeRoom.spots}
            placedObjects={activeRoom.placedObjects}
            selectedObjectId={selectedObjectId}
            onSelectObjectId={(id) => {
              setSelectedObjectId(id);
              if (id) setSelectedSpotId(null);
            }}
            onRemoveObject={handleRemoveObject}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onInsertAssetToScene={handleInsertAssetToScene}
            onAddSpot={handleAddSpot}
            onRemoveSpot={handleRemoveSpot}
            onClearAllSpots={handleClearAllSpots}
            onRemoveOverlappingSpots={handleRemoveOverlappingSpots}
            onSelectSpot={(spot) => {
              setSelectedSpotId(spot.id);
              setSelectedObjectId(null);
              if (isAvatarMode) {
                handleAvatarTeleport(spot.id);
              }
            }}
            activeSpotId={selectedSpotId}
            insertionCursorPoint={insertionCursorPoint}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            customAvatarObjectId={customAvatarObjectId}
            onSetCustomAvatarObjectId={setCustomAvatarObjectId}
            onUpdateObjectType={handleUpdateObjectType}
            sceneAssetBlobUrl={activeRoom.sceneAssetBlobUrl}
            sceneAssetName={
              activeRoom.sceneAssetBlobUrl
                ? inventory.find(
                    (i) =>
                      i.fileBlobUrl === activeRoom.sceneAssetBlobUrl ||
                      i.id === activeRoom.sceneAssetId
                  )?.displayName || 'Cenário 3D da Sala'
                : undefined
            }
            onRemoveScenario={() => {
              setRooms((prev) =>
                prev.map((r) =>
                  r.id === activeRoomId
                    ? { ...r, sceneAssetBlobUrl: undefined, sceneAssetId: null }
                    : r
                )
              );
              showToast('Cenário 3D removido da sala.');
            }}
            onPublishInventoryItem={handlePublishInventoryItemToStore}
            onRenameInventoryItem={handleRenameInventoryItem}
            onRenamePlacedObject={handleRenamePlacedObject}
            onDeleteInventoryItem={handleDeleteInventoryItem}
            onOpenProjectModal={() => setIsProjectModalOpen(true)}
            onAddSpotAtObject={handleAddSpotAtObject}
            onStartSurfaceSnap={handleStartSurfaceSnap}
            onCancelSurfaceSnap={handleCancelSurfaceSnap}
            isSurfaceSnapMode={isSurfaceSnapMode}
            surfaceSnapTargetObjectId={surfaceSnapTargetObjectId}
            onUpdateSpotMotion={handleUpdateSpotMotion}
            onToggleTestSpotMotion={handleToggleTestSpotMotion}
            testingMotionSpotId={testingMotionSpotId}
            onDetachSpotFromObject={handleDetachSpotFromObject}
            onOpenSpotVisualConfig={() => setIsSpotVisualConfigModalOpen(true)}
            onOpenTrajectoryTimeline={(spotId) => {
              setTimelineSpotId(spotId);
              setIsTrajectoryTimelineModalOpen(true);
            }}
            onAvatarTeleport={handleAvatarTeleport}
            avatarCurrentSpotId={avatarCurrentSpotId}
          />

          {/* 3D Scene Viewport */}
          <main className="flex-1 relative h-full overflow-hidden bg-[#101115]">
            <CreatorEditorCanvas3D
              sceneAssetBlobUrl={activeRoom.sceneAssetBlobUrl}
              sceneAssetId={activeRoom.sceneAssetId}
              placedObjects={activeRoom.placedObjects}
              spots={activeRoom.spots}
              boundary={activeRoom.boundary}
              selectedSpotId={selectedSpotId}
              selectedObjectId={selectedObjectId}
              onSelectSpot={(id) => {
                setSelectedSpotId(id);
                if (id) setSelectedObjectId(null);
              }}
              onSelectObject={(id) => {
                setSelectedObjectId(id);
                if (id) setSelectedSpotId(null);
              }}
              onUpdateSpotPosition={handleUpdateSpotPosition}
              onUpdateSpotRotation={handleUpdateSpotRotation}
              onRemoveSpot={handleRemoveSpot}
              onClearAllSpots={handleClearAllSpots}
              onRemoveOverlappingSpots={handleRemoveOverlappingSpots}
              onUpdateObjectTransform={handleUpdateObjectTransform}
              onRemoveObject={handleRemoveObject}
              onUpdateBoundary={handleSaveBoundary}
              onSceneClickInsertionPoint={(point) => {
                setInsertionCursorPoint(point);
              }}
              insertionCursorPoint={insertionCursorPoint}
              isAvatarMode={isAvatarMode}
              showBoundaryGhost={showBoundaryGhost}
              showSpots={showSpots}
              lockSpots={lockSpots}
              onToggleShowSpots={() => setShowSpots(!showSpots)}
              onToggleLockSpots={() => setLockSpots(!lockSpots)}
              activeGizmoMode={activeGizmoMode}
              onChangeGizmoMode={setActiveGizmoMode}
              avatarCurrentSpotId={avatarCurrentSpotId}
              onAvatarTeleport={handleAvatarTeleport}
              customAvatarObjectId={customAvatarObjectId}
              onSetCustomAvatarObjectId={setCustomAvatarObjectId}
              onUpdateObjectType={handleUpdateObjectType}
              onDropItemOnScene={handleDropItemOnScene}
              onAddSpotAtObject={handleAddSpotAtObject}
              surfaceSnapTargetObjectId={surfaceSnapTargetObjectId}
              onCancelSurfaceSnap={handleCancelSurfaceSnap}
              onAddRelativeSpot={handleAddRelativeSpot}
              testingMotionSpotId={testingMotionSpotId}
              onToggleTestSpotMotion={handleToggleTestSpotMotion}
              activeUserAvatar={activeUserAvatar}
              spotVisualConfig={spotVisualConfig}
              onUpdateSpotMotion={handleUpdateSpotMotion}
              onOpenTrajectoryTimeline={(spotId) => {
                setTimelineSpotId(spotId);
                setIsTrajectoryTimelineModalOpen(true);
              }}
              onExitEditor={() => setCurrentScreen('lobby')}
            />

            {/* Top-Right Aspect Ratio Toggle */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIs16x9MockupMode(!is16x9MockupMode)}
                className="px-2 py-1 rounded bg-[#121317]/90 hover:bg-[#d4af37] hover:text-black border border-[#d4af37]/50 text-[10px] font-semibold text-[#d4af37] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-md"
                title={is16x9MockupMode ? 'Alternar para tela cheia fluida' : 'Ajustar para Mockup 16:9'}
              >
                {is16x9MockupMode ? (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span className="hidden sm:inline">16:9</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Fluido</span>
                  </>
                )}
              </button>
            </div>
          </main>
        </div>

        {/* BOTTOM BAR matching Reference Image */}
        <footer className="w-full bg-[#121317]/95 border-t border-[#d4af37]/30 px-6 py-2.5 flex items-center justify-between text-xs text-[#d4af37]/90 z-30">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="w-4 h-4 text-[#d4af37] flex-shrink-0" />
            <p className="font-normal tracking-wide">
              Toggle Avatar = testar clique. Olho = mostrar/ocultar limite.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] text-[#e8d5b5]/70">
            <span>Clique no sofá = avatar vai para este spot.</span>
          </div>
        </footer>
      </div>
    </div>
  </div>

  {/* Global Toast Notification (Accessible on all screens) */}
  {statusToast && (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-[#121317] border border-[#ffd700] px-5 py-2.5 rounded-xl text-xs font-bold text-[#ffd700] shadow-[0_4px_30px_rgba(0,0,0,0.9)] animate-fade-in flex items-center gap-2 pointer-events-none">
      <Sparkles className="w-4 h-4 text-[#ffd700]" />
      <span>{statusToast}</span>
    </div>
  )}

  {/* GLOBAL MODALS (Always mounted and accessible across all screens: Lobby, Loja, Room, Editor) */}
  <AuthModal
    isOpen={isAuthModalOpen}
    onClose={() => setIsAuthModalOpen(false)}
    currentUser={user}
    onAuthSuccess={(u) => {
      setUser(u);
      showToast(`Conectado como ${u.displayName}`);
    }}
    onLogout={handleLogout}
  />

  <UploadGLBModal
    isOpen={isUploadModalOpen}
    onClose={() => setIsUploadModalOpen(false)}
    onUploadSuccess={handleUploadSuccess}
    userDisplayName={user?.displayName || 'Luzenne'}
    onPublishToStore={handlePublishInventoryItemToStore}
  />

  <BoundaryModal
    isOpen={isBoundaryModalOpen}
    onClose={() => setIsBoundaryModalOpen(false)}
    boundary={activeRoom.boundary}
    onSaveBoundary={handleSaveBoundary}
    roomName={activeRoom.name}
  />

  <PublishModal
    isOpen={isPublishModalOpen}
    onClose={() => setIsPublishModalOpen(false)}
    room={activeRoom}
    user={user}
    onGoToVitrine={handleGoToVitrine}
    onPlaytest={handlePlaytestActiveRoom}
  />

  <PublishItemModal
    isOpen={isPublishItemModalOpen}
    onClose={() => setIsPublishItemModalOpen(false)}
    item={publishingItem}
    user={user}
    availableAvatars={storeAvatars}
    onConfirmPublish={handleConfirmPublishItem}
    onGoToStore={() => {
      setIsPublishItemModalOpen(false);
      setCustomizationInitialTab('loja');
      setCurrentScreen('customization');
    }}
  />

  <MyPublicationsModal
    isOpen={isMyPublicationsModalOpen}
    onClose={() => setIsMyPublicationsModalOpen(false)}
    user={user}
    onLoadRoomForEdit={handleLoadRoomForEdit}
    currentEditingRoomId={activeRoomId}
    storeAvatars={storeAvatars}
    customizationItems={customizationItems}
    avatarPoses={avatarPoses}
    onShowToast={showToast}
  />

  {/* Modal de Sinalização e Visual dos Spots */}
  {isSpotVisualConfigModalOpen && (
    <SpotVisualConfigModal
      isOpen={isSpotVisualConfigModalOpen}
      config={spotVisualConfig}
      onChangeConfig={setSpotVisualConfig}
      onClose={() => setIsSpotVisualConfigModalOpen(false)}
    />
  )}

  {/* Modal de Trajetória e Timeline Estilo Edição de Vídeo */}
  {isTrajectoryTimelineModalOpen && timelineSpot && (
    <TrajectoryTimelineModal
      spot={timelineSpot}
      onClose={() => {
        setIsTrajectoryTimelineModalOpen(false);
        if (testingMotionSpotId === timelineSpot.id) {
          handleToggleTestSpotMotion(timelineSpot.id);
        }
      }}
      onUpdateMotion={(motion) => handleUpdateSpotMotion(timelineSpot.id, motion)}
      isTesting={testingMotionSpotId === timelineSpot.id}
      onToggleTest={() => handleToggleTestSpotMotion(timelineSpot.id)}
    />
  )}

  {/* Modal de Salvar, Exportar e Restaurar Projeto */}
  <ProjectSaveRestoreModal
    isOpen={isProjectModalOpen}
    onClose={() => setIsProjectModalOpen(false)}
    rooms={rooms}
    inventory={inventory}
    activeRoomId={activeRoomId}
    customizationItems={customizationItems}
    storeAvatars={storeAvatars}
    avatarPoses={avatarPoses}
    spotVisualConfig={spotVisualConfig}
    user={user}
    onRestoreProject={handleRestoreProject}
  />
</>
);
};

export default App;
