import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  RotateCw,
  Move,
  Maximize2,
  ArrowUp,
  ShoppingCart,
  Trash2,
  Plus,
  X,
  Check,
  Sparkles,
  User,
  LogOut,
  Tag,
  Upload,
  Coins,
  Gem,
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Lock,
  ShieldAlert,
  Compass,
  Activity,
  CheckCircle2,
  Layers,
  GripVertical,
  Save,
} from 'lucide-react';
import {
  CustomizationItem,
  StoreAvatar,
  AvatarPoseConfig,
  CreatorUser,
  InventoryItem,
  StoreObjectType,
  AccessoryAttachmentPoint,
  AccessoryTransform,
  ObjectAction,
  RoomAccessSlot,
} from '../types';
import { AvatarPedestal3D } from './AvatarPedestal3D';
import { RoomAccessBar } from './RoomAccessBar';
import { persistStoreItem, fetchPublicStoreItems } from '../lib/database';
import { saveGlbFile, getGlbFile } from '../lib/storageIndexedDB';

interface UserCustomizationViewProps {
  onBackToLobby: () => void;
  user: CreatorUser | null;
  onOpenAuthModal: () => void;
  initialTab?: 'loja' | 'inventario' | 'poses';
  userInventory: InventoryItem[];
  customizationItems: CustomizationItem[];
  storeAvatars: StoreAvatar[];
  poses: AvatarPoseConfig[];
  roomAccessSlots?: RoomAccessSlot[];
  onUpdateRoomAccessSlots?: (slots: RoomAccessSlot[]) => void;
  onToggleEquipItem: (itemId: string) => void;
  onRemoveItemFromInventory: (itemId: string) => void;
  onApplyPose: (poseId: string) => void;
  onRemovePose: (poseId: string) => void;
  onAcquireStoreAvatar: (avatarId: string) => void;
  onAcquireCustomItem: (item: CustomizationItem) => void;
  onPublishCustomItem: (item: Partial<CustomizationItem>) => void;
  onSelectActiveAvatar?: (avatarId: string) => void;
  onLogout?: () => void;
  onPublishPose?: (pose: AvatarPoseConfig) => void;
  onAcquirePose?: (poseId: string) => void;
  onUpdateCustomizationItemTransform?: (itemId: string, transform: AccessoryTransform) => void;
  onSyncPublicStoreItems?: (
    items: CustomizationItem[],
    avatars: StoreAvatar[],
    poses: AvatarPoseConfig[]
  ) => void;
  onSaveToInventory?: (item: CustomizationItem | StoreAvatar | AvatarPoseConfig) => void;
  onOpenPublicationsModal?: () => void;
}

export const UserCustomizationView: React.FC<UserCustomizationViewProps> = ({
  onBackToLobby,
  user,
  onOpenAuthModal,
  initialTab = 'inventario',
  userInventory,
  customizationItems,
  storeAvatars,
  poses,
  roomAccessSlots: propRoomAccessSlots,
  onUpdateRoomAccessSlots,
  onToggleEquipItem,
  onRemoveItemFromInventory,
  onApplyPose,
  onRemovePose,
  onAcquireStoreAvatar,
  onAcquireCustomItem,
  onPublishCustomItem,
  onSelectActiveAvatar,
  onLogout,
  onPublishPose,
  onAcquirePose,
  onUpdateCustomizationItemTransform,
  onSyncPublicStoreItems,
  onOpenPublicationsModal,
  onSaveToInventory,
}: UserCustomizationViewProps) => {
  // Navigation Tabs: 'loja' | 'inventario' | 'poses'
  const [activeTab, setActiveTab] = useState<'loja' | 'inventario' | 'poses'>(initialTab);

  // Currencies state
  const [coins, setCoins] = useState<number>(2450);
  const [gems, setGems] = useState<number>(180);

  // Cart state
  const [cart, setCart] = useState<Array<StoreAvatar | CustomizationItem>>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Drag over pose target state
  const [dragOverPoseId, setDragOverPoseId] = useState<string | null>(null);

  // Room Access Inventory (hotbar) state
  const [roomAccessSlots, setRoomAccessSlots] = useState<RoomAccessSlot[]>(() => {
    if (propRoomAccessSlots && propRoomAccessSlots.length > 0) return propRoomAccessSlots;
    const saved = localStorage.getItem('3d_social_room_access_inventory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    // Seed default access slots from available avatars and poses
    const initial: RoomAccessSlot[] = [];
    const firstAvatar = storeAvatars[0];
    if (firstAvatar) {
      initial.push({
        id: `access-av-${firstAvatar.id}-init`,
        slotIndex: 0,
        type: 'avatar',
        itemId: firstAvatar.id,
        name: firstAvatar.name,
        thumbnailUrl: firstAvatar.thumb || '',
        badge: 'AVATAR',
        avatarData: firstAvatar,
      });
    }
    const samplePoses = poses.slice(0, 3);
    samplePoses.forEach((p, idx) => {
      initial.push({
        id: `access-pose-${p.id}-init`,
        slotIndex: idx + 1,
        type: 'pose',
        itemId: p.id,
        name: p.name,
        thumbnailUrl: p.thumbnailUrl || '',
        badge: 'POSE',
        poseData: p,
      });
    });
    return initial;
  });

  const handleUpdateRoomAccessSlots = (newSlots: RoomAccessSlot[]) => {
    setRoomAccessSlots(newSlots);
    localStorage.setItem('3d_social_room_access_inventory', JSON.stringify(newSlots));
    if (onUpdateRoomAccessSlots) {
      onUpdateRoomAccessSlots(newSlots);
    }
  };

  const handleAddAvatarToRoomAccess = (av: StoreAvatar) => {
    const usedIndices = new Set(roomAccessSlots.map((s) => s.slotIndex));
    let targetIndex = -1;
    for (let i = 0; i < 8; i++) {
      if (!usedIndices.has(i)) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) targetIndex = 0;

    const newSlot: RoomAccessSlot = {
      id: `access-av-${av.id}-${Date.now()}`,
      slotIndex: targetIndex,
      type: 'avatar',
      itemId: av.id,
      name: av.name,
      thumbnailUrl: av.thumb || '',
      badge: 'AVATAR',
      avatarData: av,
    };
    const updated = [...roomAccessSlots.filter((s) => s.slotIndex !== targetIndex), newSlot];
    handleUpdateRoomAccessSlots(updated);
    showToast(`✨ Avatar "${av.name}" adicionado ao Slot ${targetIndex + 1} de Acesso das Rooms!`);
  };

  const handleAddPoseToRoomAccess = (pose: AvatarPoseConfig) => {
    const usedIndices = new Set(roomAccessSlots.map((s) => s.slotIndex));
    let targetIndex = -1;
    for (let i = 0; i < 8; i++) {
      if (!usedIndices.has(i)) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) targetIndex = 1;

    const newSlot: RoomAccessSlot = {
      id: `access-pose-${pose.id}-${Date.now()}`,
      slotIndex: targetIndex,
      type: 'pose',
      itemId: pose.id,
      name: pose.name,
      thumbnailUrl: pose.thumbnailUrl || '',
      badge: 'POSE',
      poseData: pose,
    };
    const updated = [...roomAccessSlots.filter((s) => s.slotIndex !== targetIndex), newSlot];
    handleUpdateRoomAccessSlots(updated);
    showToast(`✨ Pose "${pose.name}" adicionada ao Slot ${targetIndex + 1} de Acesso das Rooms!`);
  };

  const handleLinkAvatarToPoseAndRoomAccess = (av: StoreAvatar, pose: AvatarPoseConfig) => {
    const usedIndices = new Set(roomAccessSlots.map((s) => s.slotIndex));
    const findSlot = () => {
      for (let i = 0; i < 8; i++) {
        if (!usedIndices.has(i)) {
          usedIndices.add(i);
          return i;
        }
      }
      return 0;
    };

    const avSlotIdx = findSlot();
    const poseSlotIdx = findSlot();

    const avSlot: RoomAccessSlot = {
      id: `access-av-${av.id}-${Date.now()}`,
      slotIndex: avSlotIdx,
      type: 'avatar',
      itemId: av.id,
      name: av.name,
      thumbnailUrl: av.thumb || '',
      badge: 'AVATAR',
      avatarData: av,
    };

    const poseSlot: RoomAccessSlot = {
      id: `access-pose-${pose.id}-${Date.now()}`,
      slotIndex: poseSlotIdx,
      type: 'pose',
      itemId: pose.id,
      name: pose.name,
      thumbnailUrl: pose.thumbnailUrl || '',
      badge: 'POSE',
      poseData: pose,
    };

    const filtered = roomAccessSlots.filter(
      (s) => s.slotIndex !== avSlotIdx && s.slotIndex !== poseSlotIdx
    );
    const updated = [...filtered, avSlot, poseSlot];
    handleUpdateRoomAccessSlots(updated);

    if (onSelectActiveAvatar) onSelectActiveAvatar(av.id);
    onApplyPose(pose.id);

    showToast(
      `✨ Avatar "${av.name}" e Pose "${pose.name}" vinculados e adicionados aos slots de Acesso das Rooms!`
    );
  };

  // Selected avatar & pose
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    storeAvatars.find((a) => a.applied)?.id || storeAvatars[0]?.id || 'av-1'
  );

  const ownedAvatarIds = useMemo(() => {
    return storeAvatars
      .filter((a) => a.owned || a.applied || a.id === selectedAvatarId)
      .map((a) => a.id);
  }, [storeAvatars, selectedAvatarId]);

  const activePose = poses.find((p) => p.applied)?.name || 'Em pé';

  // Fine Adjustments for the whole avatar pedestal
  const [fineAdjustments, setFineAdjustments] = useState({
    panX: 0,
    panY: 0,
    rotationY: 0,
    scale: 1.0,
    elevationY: 0,
  });

  // ACESSÓRIOS & ACTIONS & ISOLATED OBJECT INSPECTION
  const [selectedItemToInspect, setSelectedItemToInspect] = useState<CustomizationItem | null>(null);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<'mover' | 'rodar' | 'escalar'>('mover');
  const [isPositionLocked, setIsPositionLocked] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<ObjectAction | null>(null);

  // Categories in Inventário (including Acessórios!)
  const [searchQueryInventory, setSearchQueryInventory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'todos' | 'avatar' | 'acessorios' | 'salas' | 'mobilia' | 'itens' | 'poses'
  >('todos');

  // Loja state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedLojaCategory, setSelectedLojaCategory] = useState<
    'todos' | 'acessorios' | 'avatar' | 'poses' | 'itens'
  >('todos');

  // Modal de publicação
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [newPublishName, setNewPublishName] = useState('');
  const [newPublishCategory, setNewPublishCategory] = useState<
    'chapeus' | 'casacos' | 'sapatos' | 'acessorios' | 'outros'
  >('acessorios');
  const [newPublishPrice, setNewPublishPrice] = useState(0);
  const [publishMode, setPublishMode] = useState<'simples' | 'avancado'>('simples');
  const [publishObjectType, setPublishObjectType] = useState<StoreObjectType>('acessorio');
  const [publishHashtags, setPublishHashtags] = useState('#acessorio, #3d, #luzenne');
  const [publishThumbnailUrl, setPublishThumbnailUrl] = useState(
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80'
  );
  const [publishRarity, setPublishRarity] = useState<'COMUM' | 'RARO' | 'ÉLITE'>('RARO');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishAssociatedAvatarIds, setPublishAssociatedAvatarIds] = useState<string[]>([]);
  const [publishAttachment, setPublishAttachment] =
    useState<AccessoryAttachmentPoint>('companion_float');
  const [publishActions, setPublishActions] = useState<ObjectAction[]>([]);

  // 3D Model source selection for publish persistence
  const [publishModelSourceType, setPublishModelSourceType] = useState<
    'active' | 'inventory' | 'upload'
  >('active');
  const [publishSelectedInventoryId, setPublishSelectedInventoryId] = useState<string>('');
  const [publishUploadedFile, setPublishUploadedFile] = useState<File | null>(null);

  // Fetch from Supabase on mount to guarantee persistence across browser tabs and accounts!
  useEffect(() => {
    let isMounted = true;
    fetchPublicStoreItems().then((res) => {
      if (!isMounted) return;
      if (res.items.length > 0 || res.avatars.length > 0 || res.poses.length > 0) {
        if (onSyncPublicStoreItems) {
          onSyncPublicStoreItems(res.items, res.avatars, res.poses);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper to check if an item is a real published item (filters out fake mock clothing)
  const isRealPublishedItem = (item: CustomizationItem) => {
    if (!item) return false;
    if (item.id.startsWith('hat-') || item.id.startsWith('coat-') || item.id.startsWith('shoe-')) {
      return false; // Fake mock items
    }
    return Boolean(
      item.isPublishedByCreator ||
      item.isUserPublished ||
      item.fileBlobUrl ||
      item.originalItemId
    );
  };

  // Helper to check if an avatar is a real published avatar (filters out fake stock photo avatars)
  const isRealPublishedAvatar = (av: StoreAvatar) => {
    if (!av) return false;
    if (av.id.startsWith('av-') && !av.fileBlobUrl && !av.isUserPublished) {
      return false; // Fake mock stock photo avatars
    }
    return true;
  };

  // Filter items in Inventário
  const filteredInventoryItems = customizationItems.filter((item) => {
    if (!item.owned) return false;
    if (!isRealPublishedItem(item)) return false;
    const matchesSearch = (item.name || '').toLowerCase().includes(searchQueryInventory.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'todos') return true;
    if (selectedCategory === 'acessorios') return item.isAccessory || item.category === 'acessorios';
    return (item.category as string) === (selectedCategory as string);
  });

  const filteredUserInventory = userInventory.filter((item) => {
    const matchesSearch = (item.displayName || item.name || '').toLowerCase().includes(searchQueryInventory.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'todos') return true;
    const typeLower = (item.type || '').toLowerCase();
    if (selectedCategory === 'salas') return typeLower === 'sala' || typeLower === 'cenario';
    if (selectedCategory === 'mobilia') return typeLower === 'movel' || typeLower === 'item';
    if (selectedCategory === 'itens') return typeLower === 'objeto' || typeLower === 'item';
    if (selectedCategory === 'poses') return typeLower === 'pose';
    if (selectedCategory === 'avatar') return typeLower === 'avatar';
    return false;
  });

  // Filter avatars in Loja: ONLY real published avatars
  const filteredStoreAvatars = storeAvatars.filter((av) => {
    if (!isRealPublishedAvatar(av)) return false;
    if (
      selectedLojaCategory === 'acessorios' ||
      selectedLojaCategory === 'poses' ||
      selectedLojaCategory === 'itens'
    ) {
      return false;
    }
    const matchesSearch = (av.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || (av.tags && av.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  // Filter items in Loja (Store Items & Community Published): ONLY real published items
  const publishedCommunityItems = customizationItems.filter((i) => {
    if (!isRealPublishedItem(i)) return false;
    const isAccessory = i.isAccessory || i.category === 'acessorios';
    if (selectedLojaCategory === 'avatar' || selectedLojaCategory === 'poses') return false;
    if (selectedLojaCategory === 'acessorios' && !isAccessory) return false;
    if (selectedLojaCategory === 'itens' && isAccessory) return false;
    if (selectedTag === '#acessorios' && !isAccessory) return false;
    const matchesSearch = (i.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Filter poses in Loja
  const storePoses = poses.filter((p) => {
    if (
      selectedLojaCategory === 'avatar' ||
      selectedLojaCategory === 'acessorios' ||
      selectedLojaCategory === 'itens'
    ) {
      return false;
    }
    if (selectedTag === '#acessorios') return false;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Selected active accessory object if any (checked across customizationItems, published items, and inventory)
  const activeSelectedAccessory = useMemo(() => {
    if (!selectedAccessoryId) return null;
    const directMatch =
      customizationItems.find((i) => i.id === selectedAccessoryId) ||
      publishedCommunityItems.find((i) => i.id === selectedAccessoryId) ||
      (selectedItemToInspect?.id === selectedAccessoryId ? selectedItemToInspect : null);
    if (directMatch) return directMatch;

    const invMatch = userInventory.find((i) => i.id === selectedAccessoryId);
    if (invMatch) {
      return {
        id: invMatch.id,
        code: `#AC${Math.floor(100 + Math.random() * 900)}`,
        name: invMatch.displayName,
        category: 'acessorios' as const,
        thumb: invMatch.thumbUrl,
        fileBlobUrl: invMatch.fileBlobUrl,
        isAccessory: true,
        owned: true,
        equipped: true,
        price: 0,
        rarity: 'COMUM' as const,
        author: user?.displayName || 'Luzenne',
      };
    }
    return null;
  }, [selectedAccessoryId, customizationItems, publishedCommunityItems, selectedItemToInspect, userInventory, user]);

  // Active actions available for currently inspected item or accessory
  const activeItemActions: ObjectAction[] =
    selectedItemToInspect?.actions ||
    activeSelectedAccessory?.actions ||
    [];

  // Handling item click in Inventário or Loja
  const handleSelectItem = (item: CustomizationItem) => {
    const isAcc = item.isAccessory || item.category === 'acessorios';
    if (isAcc) {
      // 1. Acessório: Anexa ao avatar e abre o Gizmo
      setSelectedItemToInspect(null);
      setSelectedAccessoryId(item.id);
      setIsPositionLocked(Boolean(item.isLockedPosition));

      // Guarantee item is registered in customizationItems and equipped
      if (!customizationItems.some((i) => i.id === item.id)) {
        onPublishCustomItem?.({ ...item, equipped: true, isAccessory: true, owned: true });
      } else if (!item.equipped) {
        onToggleEquipItem(item.id);
      }

      if (item.actions && item.actions.length > 0) {
        setActiveAction(item.actions[0]);
      } else {
        setActiveAction(null);
      }
      showToast(`👑 Acessório "${item.name}" posicionado no avatar! Use o Gizmo para mover.`);
    } else if (item.isAvatar || item.category === 'avatares') {
      // 2. Avatar
      setSelectedItemToInspect(null);
      setSelectedAccessoryId(null);
      setSelectedAvatarId(item.id);
      setActiveAction(null);
    } else {
      // 3. Objeto que NÃO é acessório (ex: móveis, objetos decorativos):
      // "quando o usuario ta na loja vendo avatar ele clica no itens da loja o item mostrado no lugar do avatar se não for acessorio esse item"
      setSelectedItemToInspect(item);
      setSelectedAccessoryId(null);
      if (item.actions && item.actions.length > 0) {
        setActiveAction(item.actions[0]);
      } else {
        setActiveAction(null);
      }
      showToast(`📦 Inspecionando "${item.name}" isolado no pedestal 3D!`);
    }
  };

  const handleUpdateAccessoryTransform = (itemId: string, transform: AccessoryTransform) => {
    if (onUpdateCustomizationItemTransform) {
      onUpdateCustomizationItemTransform(itemId, transform);
    }
  };

  const handleToggleLockPosition = () => {
    const nextLocked = !isPositionLocked;
    setIsPositionLocked(nextLocked);
    if (selectedAccessoryId) {
      const acc = customizationItems.find((i) => i.id === selectedAccessoryId);
      if (acc && acc.accessoryTransform && onUpdateCustomizationItemTransform) {
        onUpdateCustomizationItemTransform(acc.id, acc.accessoryTransform);
      }
    }
    showToast(
      nextLocked
        ? 'Posição do acessório travada no avatar! 🔒'
        : 'Gizmo de ajuste liberado para mover! 🔓'
    );
  };

  const handleSaveToPrincipalAvatar = () => {
    if (!selectedAccessoryId) return;
    const acc = customizationItems.find((i) => i.id === selectedAccessoryId);
    if (!acc) return;

    // 1. Lock position
    setIsPositionLocked(true);

    // 2. Persist transform to active customization item
    if (acc.accessoryTransform && onUpdateCustomizationItemTransform) {
      onUpdateCustomizationItemTransform(acc.id, acc.accessoryTransform);
    }

    // 3. Persist to creator user inventory
    if (onSaveToInventory) {
      onSaveToInventory({
        ...acc,
        isAccessory: true,
        equipped: true,
      });
    }

    // 4. Mark as owned and equipped if not owned yet
    if (!acc.owned && onAcquireCustomItem) {
      onAcquireCustomItem({
        ...acc,
        owned: true,
        equipped: true,
      });
    }

    showToast(`✨ Definição salva no seu Avatar Principal! Acessório "${acc.name}" agora permanece fixado nesta posição.`);
  };

  // Cart operations
  const addToCart = (item: StoreAvatar | CustomizationItem) => {
    if (cart.some((c) => c.id === item.id)) {
      showToast(`"${item.name}" já está no seu carrinho!`);
      return;
    }
    setCart((prev) => [...prev, item]);
    showToast(`"${item.name}" adicionado ao carrinho!`);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price || 0), 0);
    if (coins < total) {
      showToast('Moedas insuficientes! Recarregue moedas ou escolha itens gratuitos.');
      return;
    }
    setCoins((prev) => prev - total);
    cart.forEach((item) => {
      if ('rarity' in item && 'tags' in item) {
        onAcquireStoreAvatar(item.id);
      } else {
        onAcquireCustomItem(item as CustomizationItem);
      }
    });
    setCart([]);
    setIsCartOpen(false);
    showToast('Compra finalizada com sucesso! Itens e Avatares adicionados ao seu Inventário.');
  };

  const handleDirectAcquire = (item: CustomizationItem) => {
    onAcquireCustomItem(item);
    showToast(`"${item.name}" adquirido com sucesso! Já está no seu Inventário.`);
  };

  const handleBuyPose = (pose: AvatarPoseConfig) => {
    const isRestricted = Boolean(pose.associatedAvatarIds && pose.associatedAvatarIds.length > 0);
    const userOwnsAvatar =
      !isRestricted ||
      pose.associatedAvatarIds!.some((id) => {
        const av = storeAvatars.find((a) => a.id === id);
        return av && (av.owned || av.applied);
      });

    if (!userOwnsAvatar) {
      const reqNames = pose.associatedAvatarNames?.join(' ou ') || 'Avatar exclusivo';
      showToast(
        `⚠️ Bloqueado: Para comprar a pose "${pose.name}", você precisa possuir o avatar: ${reqNames} na loja!`
      );
      return;
    }

    const price = pose.price || 0;
    if (coins < price) {
      showToast('Moedas insuficientes para adquirir esta pose!');
      return;
    }

    setCoins((prev) => prev - price);
    if (onAcquirePose) {
      onAcquirePose(pose.id);
    }
    showToast(`Pose "${pose.name}" adquirida e adicionada ao seu inventário de poses!`);
  };

  const handleCreatePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPublishName.trim()) return;

    const parsedTags = publishHashtags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const finalTags = parsedTags.length > 0 ? parsedTags : ['#comunidade', '#3d'];
    const finalPrice = publishMode === 'simples' ? 0 : Number(newPublishPrice) || 0;
    const finalThumb =
      publishThumbnailUrl.trim() ||
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80';

    if (publishObjectType === 'pose') {
      const associatedNames = storeAvatars
        .filter((a) => publishAssociatedAvatarIds.includes(a.id))
        .map((a) => a.name);

      const newPose: AvatarPoseConfig = {
        id: `pose-${Date.now()}`,
        name: newPublishName.trim(),
        applied: false,
        thumbnailUrl: finalThumb,
        description:
          publishDescription.trim() ||
          `Pose exclusiva criada por ${user?.displayName || 'Luzenne'}.`,
        price: finalPrice,
        owned: true,
        author: user?.displayName || 'Luzenne',
        isPublishedByCreator: true,
        associatedAvatarIds:
          publishAssociatedAvatarIds.length > 0 ? publishAssociatedAvatarIds : undefined,
        associatedAvatarNames:
          associatedNames.length > 0 ? associatedNames : undefined,
        rarity: publishMode === 'simples' ? 'COMUM' : publishRarity,
      };

      await persistStoreItem(
        {
          name: newPose.name,
          objectType: 'pose',
          price: finalPrice,
          hashtags: finalTags,
          thumbnailUrl: finalThumb,
          rarity: newPose.rarity,
          publishMode,
          description: newPose.description,
          author: user?.displayName || 'Luzenne',
          associatedAvatarIds: newPose.associatedAvatarIds,
          metadata: { associatedAvatarNames: associatedNames },
        },
        user
      );

      if (onPublishPose) {
        onPublishPose(newPose);
      }
      setShowPublishModal(false);
      setNewPublishName('');
      setPublishAssociatedAvatarIds([]);
      showToast(`Pose "${newPose.name}" publicada com sucesso!`);
      return;
    }

    // Determine 3D model source blob & original id for complete persistence
    let sourceBlobUrl = '';
    let sourceOriginalId: string | undefined = undefined;
    let fileBlobToStore: Blob | null = null;

    if (publishModelSourceType === 'upload' && publishUploadedFile) {
      fileBlobToStore = publishUploadedFile;
      sourceBlobUrl = URL.createObjectURL(publishUploadedFile);
    } else if (publishModelSourceType === 'inventory' && publishSelectedInventoryId) {
      sourceOriginalId = publishSelectedInventoryId;
      const invMatch = userInventory.find((i) => i.id === publishSelectedInventoryId);
      if (invMatch?.fileBlobUrl) {
        sourceBlobUrl = invMatch.fileBlobUrl;
      }
      const existingBlob = await getGlbFile(publishSelectedInventoryId);
      if (existingBlob) {
        fileBlobToStore = existingBlob;
      } else if (sourceBlobUrl) {
        try {
          const res = await fetch(sourceBlobUrl);
          fileBlobToStore = await res.blob();
        } catch (e) {}
      }
    } else if (publishModelSourceType === 'active') {
      const activeItem = activeSelectedAccessory || selectedItemToInspect;
      if (activeItem) {
        sourceOriginalId = activeItem.originalItemId || activeItem.id;
        sourceBlobUrl = activeItem.fileBlobUrl || '';
        const existingBlob =
          (await getGlbFile(activeItem.id)) ||
          (activeItem.originalItemId ? await getGlbFile(activeItem.originalItemId) : null);
        if (existingBlob) {
          fileBlobToStore = existingBlob;
        } else if (sourceBlobUrl) {
          try {
            const res = await fetch(sourceBlobUrl);
            fileBlobToStore = await res.blob();
          } catch (e) {}
        }
      }
    }

    const isAccessory = publishObjectType === 'acessorio';
    const generatedItemId = isAccessory ? `acc-pub-${Date.now()}` : `pub-${Date.now()}`;

    if (fileBlobToStore) {
      await saveGlbFile(generatedItemId, fileBlobToStore);
      if (sourceOriginalId) {
        await saveGlbFile(sourceOriginalId, fileBlobToStore);
      }
      sourceBlobUrl = URL.createObjectURL(fileBlobToStore);
    }

    const newItem: Partial<CustomizationItem> = {
      id: generatedItemId,
      code: `#${isAccessory ? 'AC' : 'P'}${Math.floor(100 + Math.random() * 900)}`,
      name: newPublishName.trim(),
      category: isAccessory ? 'acessorios' : newPublishCategory,
      thumb: finalThumb,
      owned: true,
      equipped: isAccessory,
      price: finalPrice,
      rarity: publishMode === 'simples' ? 'COMUM' : publishRarity,
      isPublishedByCreator: true,
      author: user?.displayName || 'Luzenne',
      fileBlobUrl: sourceBlobUrl || undefined,
      originalItemId: sourceOriginalId,
      description:
        publishDescription.trim() ||
        `Item 3D criado por ${user?.displayName || 'Luzenne'}.`,
      isAccessory,
      accessoryAttachment: isAccessory ? publishAttachment : undefined,
      accessoryTransform: isAccessory
        ? {
            position:
              publishAttachment === 'head'
                ? [0, 1.72, 0]
                : publishAttachment === 'left_hand'
                ? [-0.26, 0.88, 0]
                : publishAttachment === 'right_hand'
                ? [0.26, 0.88, 0]
                : publishAttachment === 'chest'
                ? [0, 1.35, 0.12]
                : publishAttachment === 'back'
                ? [0, 1.35, -0.16]
                : [0.52, 1.48, 0.25],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          }
        : undefined,
      actions: publishActions,
      activeActionId: publishActions[0]?.id || null,
    };

    await persistStoreItem(
      {
        id: newItem.id,
        name: newItem.name!,
        objectType: publishObjectType,
        price: finalPrice,
        hashtags: finalTags,
        thumbnailUrl: finalThumb,
        fileBlobUrl: newItem.fileBlobUrl,
        originalItemId: newItem.originalItemId,
        rarity: newItem.rarity,
        publishMode,
        description: newItem.description,
        author: user?.displayName || 'Luzenne',
        actions: publishActions,
        accessoryAttachment: newItem.accessoryAttachment,
        accessoryTransform: newItem.accessoryTransform,
      },
      user
    );

    onPublishCustomItem(newItem);
    if (isAccessory && newItem.id) {
      setSelectedAccessoryId(newItem.id);
      setSelectedItemToInspect(null);
      setIsPositionLocked(false);
    }
    setShowPublishModal(false);
    setNewPublishName('');
    setPublishUploadedFile(null);
    setPublishSelectedInventoryId('');
    showToast(`"${newItem.name}" publicado com persistência na Loja!`);
  };

  const equippedItems = React.useMemo(() => {
    const base = customizationItems.filter((i) => i.equipped);
    if (activeSelectedAccessory && !base.some((i) => i.id === activeSelectedAccessory.id)) {
      return [{ ...activeSelectedAccessory, equipped: true, isAccessory: true }, ...base];
    }
    return base;
  }, [customizationItems, activeSelectedAccessory]);

  const currentStoreAvatar = storeAvatars.find((a) => a.id === selectedAvatarId);
  const currentCustomAvatar = customizationItems.find((i) => i.id === selectedAvatarId);
  
  const currentAvatar: StoreAvatar = (selectedItemToInspect?.isAvatar || selectedItemToInspect?.category === 'avatares')
    ? {
        id: selectedItemToInspect.id,
        name: selectedItemToInspect.name,
        fileBlobUrl: selectedItemToInspect.fileBlobUrl,
        thumb: selectedItemToInspect.thumb,
        price: selectedItemToInspect.price || 0,
        rarity: (selectedItemToInspect.rarity || 'RARO') as 'COMUM' | 'RARO' | 'ÉLITE',
        tags: [],
        author: selectedItemToInspect.author,
        owned: selectedItemToInspect.owned,
        applied: false,
      }
    : currentStoreAvatar || (currentCustomAvatar ? {
        id: currentCustomAvatar.id,
        name: currentCustomAvatar.name,
        fileBlobUrl: currentCustomAvatar.fileBlobUrl,
        thumb: currentCustomAvatar.thumb,
        price: currentCustomAvatar.price || 0,
        rarity: (currentCustomAvatar.rarity || 'RARO') as 'COMUM' | 'RARO' | 'ÉLITE',
        tags: [],
        author: currentCustomAvatar.author,
        owned: currentCustomAvatar.owned,
        applied: false,
      } : storeAvatars[0] || {
        id: 'av-default',
        name: 'Avatar Luzenne',
        rarity: 'COMUM' as const,
        price: 0,
        thumb: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        tags: [],
        owned: true,
        applied: true,
      });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0b0e] text-[#e8d5b5] font-sans flex flex-col select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#1b1d24]/95 border border-[#ffd700] text-white text-xs font-semibold shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-[#ffd700]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="relative z-30 h-16 border-b border-[#262833]/80 bg-[#0d0e12]/95 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0">
        {/* Left: Brand & Currencies */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onBackToLobby}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-white/10"
            title="Voltar para a Vitrine / Lobby"
          >
            <ArrowLeft className="w-4 h-4 text-[#d4af37]" />
            <span className="text-xs font-bold font-serif tracking-wider">Lobby</span>
          </button>

          {/* Currencies: 2.450 Moedas | 180 Gemas | + */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16171d] border border-white/5 text-xs font-mono font-bold text-zinc-200">
              <span className="text-[#ffd700]">🪙</span>
              <span>{coins.toLocaleString('pt-BR')}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16171d] border border-white/5 text-xs font-mono font-bold text-teal-300">
              <span>💎</span>
              <span>{gems.toLocaleString('pt-BR')}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setCoins((prev) => prev + 1000);
                showToast('Recarga de +1.000 moedas adicionada!');
              }}
              className="w-6 h-6 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#ffd700] hover:bg-[#d4af37] hover:text-black transition-colors flex items-center justify-center text-xs font-bold cursor-pointer"
              title="Recarregar Moedas"
            >
              +
            </button>
          </div>
        </div>

        {/* Center: Main Navigation Tabs (Loja | Inventário | Poses) */}
        <nav className="flex items-center gap-8 text-sm font-medium tracking-wide">
          <button
            type="button"
            onClick={() => {
              setActiveTab('loja');
              setSelectedItemToInspect(null);
            }}
            className={`relative py-5 transition-colors cursor-pointer ${
              activeTab === 'loja'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Loja
            {activeTab === 'loja' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#d4af37] shadow-[0_0_8px_#d4af37]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('inventario');
              setSelectedItemToInspect(null);
            }}
            className={`relative py-5 transition-colors cursor-pointer ${
              activeTab === 'inventario'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Inventário
            {activeTab === 'inventario' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-white shadow-[0_0_8px_#ffffff]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('poses');
              setSelectedItemToInspect(null);
            }}
            className={`relative py-5 transition-colors cursor-pointer ${
              activeTab === 'poses'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Poses
            {activeTab === 'poses' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#d4af37] shadow-[0_0_8px_#d4af37]" />
            )}
          </button>
        </nav>

        {/* Right: Publications, Cart & User Account */}
        <div className="flex items-center gap-3">
          {onOpenPublicationsModal && (
            <button
              type="button"
              onClick={onOpenPublicationsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#ffd700]/70 bg-black/60 hover:bg-[#d4af37]/20 text-xs font-bold text-[#ffd700] transition-all cursor-pointer shadow-sm"
              title="Ver e gerenciar suas salas, avatares e itens publicados"
            >
              <Layers className="w-3.5 h-3.5 text-[#ffd700]" />
              <span className="hidden sm:inline">Minhas Publicações</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCartOpen(!isCartOpen)}
            className="relative w-10 h-10 rounded-full border border-white/10 hover:border-white/30 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Abrir Carrinho"
          >
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#d4af37] text-black text-[10px] font-bold flex items-center justify-center shadow-md">
                {cart.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#d4af37]/40 bg-[#16171d] hover:bg-[#1f212a] text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <User className="w-4 h-4 text-[#d4af37]" />
              <span className="text-xs font-semibold hidden md:inline">
                {user && !user.isGuest ? user.displayName : 'Login / Cadastro'}
              </span>
            </button>

            {user && !user.isGuest && onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-full border border-red-500/40 hover:border-red-400 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white transition-all cursor-pointer shadow-md"
                title="Sair da Conta (Logout)"
              >
                <LogOut className="w-4 h-4 text-red-400" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT: 3 COLUMNS */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: INVENTÁRIO OU LOJA */}
        <div className="w-full md:w-[420px] lg:w-[460px] border-r border-[#262833]/80 bg-[#0d0e12] flex flex-col overflow-hidden flex-shrink-0">
          {activeTab === 'inventario' ? (
            /* TAB: INVENTÁRIO */
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex items-center justify-between pb-4">
                <h2 className="text-sm md:text-base font-serif text-zinc-200 tracking-wide">
                  Inventário — Itens & Acessórios
                </h2>
              </div>
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQueryInventory}
                  onChange={(e) => setSearchQueryInventory(e.target.value)}
                  placeholder="Buscar itens no inventário..."
                  className="w-full bg-[#14151b] border border-[#22242d] rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#d4af37]"
                />
              </div>
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategory((prev) => (prev === 'todos' ? 'acessorios' : 'todos'))
                  }
                  className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Filtrar todos os itens"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-4 pb-4 border-b border-white/5 text-xs font-medium overflow-x-auto scrollbar-none">
                {[
                  { id: 'todos', label: 'Todos', icon: '✨' },
                  { id: 'avatar', label: 'Avatar', icon: '👤' },
                  { id: 'acessorios', label: 'Acessórios', icon: '👑' },
                  { id: 'salas', label: 'Salas', icon: '🏠' },
                  { id: 'mobilia', label: 'Mobília', icon: '🪑' },
                  { id: 'itens', label: 'Itens', icon: '📦' },
                  { id: 'poses', label: 'Poses', icon: '💃' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer pb-1 relative flex-shrink-0 ${
                      selectedCategory === cat.id
                        ? 'text-zinc-100 font-semibold text-[#ffd700]'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {selectedCategory === cat.id && (
                      <span className="absolute -bottom-1 inset-x-0 h-0.5 bg-[#ffd700]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Grid of Items or Avatars */}
              <div className="flex-1 overflow-y-auto pt-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {selectedCategory === 'avatar' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {storeAvatars
                      .filter((av) => isRealPublishedAvatar(av) && av.owned && (av.name || '').toLowerCase().includes(searchQueryInventory.toLowerCase()))
                      .map((av) => {
                        const isSelectedForPreview = selectedAvatarId === av.id;
                        return (
                          <div
                            key={av.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/json', JSON.stringify({ type: 'avatar', avatar: av }));
                              e.dataTransfer.effectAllowed = 'copyMove';
                            }}
                            onClick={() => {
                              setSelectedAvatarId(av.id);
                              setSelectedItemToInspect(null);
                            }}
                            className={`relative rounded-xl border p-2.5 flex flex-col justify-between transition-all cursor-pointer group select-none ${
                              av.applied
                                ? 'bg-[#15171e] border-[#ffd700] ring-1 ring-[#ffd700]/70 shadow-[0_0_12px_rgba(255,215,0,0.2)]'
                                : isSelectedForPreview
                                ? 'bg-[#15171e] border-[#d4af37]/80 ring-1 ring-[#d4af37]/40'
                                : 'bg-[#121317] border-[#22242d] hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="font-mono font-medium text-[#14b8a6]">
                                #{av.id.slice(0, 6)}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-mono font-bold uppercase text-[9px] ${
                                  av.rarity === 'ÉLITE'
                                    ? 'bg-[#d4af37]/20 text-[#ffd700]'
                                    : 'bg-teal-950/80 text-teal-400'
                                }`}
                              >
                                {av.rarity || 'RARO'}
                              </span>
                            </div>

                            <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0d0e11] my-1 flex items-center justify-center">
                              <img
                                src={av.thumb}
                                alt={av.name}
                                className="w-full h-full object-cover filter contrast-110 group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                              {av.applied && (
                                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#ffd700] text-black text-[9px] font-bold shadow-md flex items-center gap-1">
                                  <span>⭐</span>
                                  <span>EM USO</span>
                                </div>
                              )}
                            </div>

                            <p className="text-[11px] font-semibold text-zinc-200 truncate mt-1 text-center">
                              {av.name}
                            </p>

                            {/* Drag Indicator handle */}
                            <div
                              className="flex items-center justify-center gap-1 text-[9px] font-mono text-zinc-400 group-hover:text-[#ffd700] py-0.5 mt-1 cursor-grab active:cursor-grabbing border border-dashed border-white/10 group-hover:border-[#ffd700]/50 rounded bg-black/30"
                              title="Arraste este Avatar para o Inventário de Acesso das Rooms ou para uma Pose!"
                            >
                              <GripVertical className="w-2.5 h-2.5 text-[#ffd700]" />
                              <span>Arraste p/ Rooms</span>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 mt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAvatarId(av.id);
                                  if (onSelectActiveAvatar) {
                                    onSelectActiveAvatar(av.id);
                                  } else {
                                    onAcquireStoreAvatar(av.id);
                                  }
                                  showToast(`Avatar "${av.name}" selecionado!`);
                                }}
                                className={`py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  av.applied
                                    ? 'bg-[#ffd700] text-black'
                                    : 'bg-zinc-800 hover:bg-[#d4af37] hover:text-black text-zinc-200'
                                }`}
                              >
                                {av.applied ? '✓ Em Uso' : 'Usar'}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddAvatarToRoomAccess(av);
                                }}
                                className="py-1.5 rounded text-[10px] font-bold bg-[#ffd700]/15 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                                title="Adicionar este avatar ao Inventário de Acesso das Rooms"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Rooms</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {(selectedCategory === 'todos' || selectedCategory === 'acessorios') && filteredInventoryItems.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    <div className="col-span-full mb-2">
                      <span className="text-xs font-bold text-zinc-400">Acessórios de Avatar</span>
                    </div>
                    {filteredInventoryItems.map((item) => {
                      const isAcc = item.isAccessory || item.category === 'acessorios';
                      const isInspectingThis = selectedItemToInspect?.id === item.id;
                      const isSelectedAcc = selectedAccessoryId === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          className={`relative rounded-xl border p-2 flex flex-col justify-between transition-all cursor-pointer group ${
                            isSelectedAcc || isInspectingThis
                              ? 'bg-[#15171e] border-[#ffd700] ring-1 ring-[#ffd700]/60 shadow-[0_0_12px_rgba(255,215,0,0.25)]'
                              : item.equipped
                              ? 'bg-[#15171e] border-[#d4af37]/60'
                              : 'bg-[#121317] border-[#22242d] hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-mono font-medium text-[#14b8a6]">
                              {item.code}
                            </span>
                            {isAcc && (
                              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-[#ffd700]/20 text-[#ffd700]">
                                ACESSÓRIO
                              </span>
                            )}
                          </div>

                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0d0e11] my-1 flex items-center justify-center">
                            <img
                              src={item.thumb}
                              alt={item.name}
                              className="w-full h-full object-cover filter contrast-110 group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            {item.equipped && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#d4af37] text-black flex items-center justify-center text-[10px] font-bold shadow-md">
                                ✓
                              </div>
                            )}
                            {item.actions && item.actions.length > 0 && (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/50 text-[9px] font-bold text-cyan-300">
                                ⚡ {item.actions.length} action(s)
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] font-medium text-zinc-200 truncate mt-1 text-center">
                            {item.name}
                          </p>

                          <div className="mt-2 pt-1 border-t border-white/5 flex items-center justify-center gap-1">
                            {isAcc ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectItem(item);
                                }}
                                className="w-full py-1 rounded text-[10px] font-bold bg-[#ffd700] hover:brightness-110 text-black cursor-pointer"
                              >
                                {isSelectedAcc ? '📐 Ajustando Gizmo' : 'Colocar no Avatar'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleEquipItem(item.id);
                                }}
                                className={`w-full py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  item.equipped
                                    ? 'bg-zinc-800 text-zinc-300'
                                    : 'bg-[#d4af37] hover:brightness-110 text-black'
                                }`}
                              >
                                {item.equipped ? 'Remover' : 'Equipar'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Poses do Avatar no Inventário */}
                {(selectedCategory === 'todos' || selectedCategory === 'poses') && poses.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                      <span className="text-xs font-bold text-[#ffd700] uppercase tracking-wider flex items-center gap-1.5">
                        <span>💃</span> Poses do Avatar
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {poses.length} poses
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {poses
                        .filter((p) => (p.name || '').toLowerCase().includes(searchQueryInventory.toLowerCase()))
                        .map((pose) => {
                          const isRestricted = Boolean(pose.associatedAvatarIds && pose.associatedAvatarIds.length > 0);
                          const isAvatarCompatible = !isRestricted || pose.associatedAvatarIds!.some((id) => ownedAvatarIds.includes(id) || selectedAvatarId === id);
                          const isLocked = isRestricted && !isAvatarCompatible;

                          return (
                            <div
                              key={`inv-pose-${pose.id}`}
                              draggable={!isLocked}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'pose', pose }));
                                e.dataTransfer.effectAllowed = 'copyMove';
                              }}
                              className={`relative rounded-xl border p-2.5 flex flex-col justify-between select-none transition-all group ${
                                pose.applied
                                  ? 'bg-[#15171e] border-[#ffd700] ring-1 ring-[#ffd700]/70'
                                  : 'bg-[#121317] border-[#22242d] hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="font-mono text-[#ffd700] text-[9px] font-bold">POSE</span>
                                {pose.applied && (
                                  <span className="text-[9px] font-bold text-[#ffd700] bg-[#ffd700]/20 px-1 rounded">ATIVA</span>
                                )}
                              </div>

                              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0d0e11] my-1 flex items-center justify-center">
                                {pose.thumbnailUrl ? (
                                  <img
                                    src={pose.thumbnailUrl}
                                    alt={pose.name}
                                    className="w-full h-full object-cover filter contrast-110 group-hover:scale-105 transition-transform"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span className="text-2xl">💃</span>
                                )}
                              </div>

                              <p className="text-[11px] font-semibold text-zinc-200 truncate mt-1 text-center">
                                {pose.name}
                              </p>

                              <div
                                className="flex items-center justify-center gap-1 text-[9px] font-mono text-zinc-400 group-hover:text-[#ffd700] py-0.5 mt-1 cursor-grab active:cursor-grabbing border border-dashed border-white/10 group-hover:border-[#ffd700]/50 rounded bg-black/30"
                                title="Arraste esta pose para o Inventário de Acesso das Rooms!"
                              >
                                <GripVertical className="w-2.5 h-2.5 text-[#ffd700]" />
                                <span>Arraste p/ Rooms</span>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 mt-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onApplyPose(pose.id);
                                    showToast(`Pose "${pose.name}" aplicada ao Avatar!`);
                                  }}
                                  className={`py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    pose.applied
                                      ? 'bg-[#ffd700] text-black'
                                      : 'bg-zinc-800 hover:bg-[#d4af37] hover:text-black text-zinc-200'
                                  }`}
                                >
                                  {pose.applied ? '✓ Ativa' : 'Aplicar'}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddPoseToRoomAccess(pose);
                                  }}
                                  className="py-1 rounded text-[10px] font-bold bg-[#ffd700]/15 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/30 transition-all cursor-pointer flex items-center justify-center gap-0.5"
                                  title="Adicionar aos slots de Acesso das Rooms"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Rooms</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {(selectedCategory === 'todos' || ['salas', 'mobilia', 'itens', 'avatar'].includes(selectedCategory)) && filteredUserInventory.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    <div className="col-span-full mb-2">
                      <span className="text-xs font-bold text-zinc-400">Arquivos e Modelos do Usuário</span>
                    </div>
                    {filteredUserInventory.map((item) => {
                      return (
                        <div
                          key={item.id}
                          className="relative rounded-xl border p-2 flex flex-col justify-between transition-all bg-[#121317] border-[#22242d]"
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-mono font-medium text-[#14b8a6]">
                              {item.type.toUpperCase()}
                            </span>
                          </div>

                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0d0e11] my-1 flex items-center justify-center">
                            {item.thumbUrl ? (
                              <img
                                src={item.thumbUrl}
                                alt={item.displayName || item.name || 'item'}
                                className="w-full h-full object-cover filter contrast-110"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                <span className="text-zinc-500 text-xs">Sem Foto</span>
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] font-medium text-zinc-200 truncate mt-1 text-center">
                            {item.displayName || item.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'loja' ? (
            /* TAB: LOJA */
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex items-center justify-between pb-3">
                <h2 className="text-sm md:text-base font-serif text-zinc-200 tracking-wide">
                  Loja — Avatares & Acessórios
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#ffd700] text-black hover:brightness-110 transition-all cursor-pointer flex items-center gap-1 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publicar Item</span>
                </button>
              </div>

              {/* Loja Category Filter Tabs */}
              <div className="flex items-center gap-1.5 pb-2.5 overflow-x-auto scrollbar-none">
                {[
                  { id: 'todos', label: 'Todos', icon: '🌟' },
                  { id: 'acessorios', label: 'Acessórios', icon: '👑' },
                  { id: 'avatar', label: 'Avatares', icon: '👤' },
                  { id: 'poses', label: 'Poses', icon: '💃' },
                  { id: 'itens', label: 'Itens 3D', icon: '📦' },
                ].map((cat) => {
                  const isSelected = selectedLojaCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedLojaCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black shadow-md'
                          : 'bg-[#14151b] border border-[#22242d] text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar avatares, acessórios, poses, drones..."
                  className="w-full bg-[#14151b] border border-[#22242d] rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Filter Chips: #todos, #acessorios, #formal, #noite, #luxo */}
              <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-none">
                {['#todos', '#acessorios', '#formal', '#noite', '#luxo', '#streetwear'].map(
                  (tag) => {
                    const isSelected = selectedTag === tag || (!selectedTag && tag === '#todos');
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(tag === '#todos' ? null : tag)}
                        className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border flex-shrink-0 ${
                          isSelected
                            ? 'bg-[#14b8a6]/20 border-[#14b8a6] text-[#14b8a6]'
                            : 'bg-[#14151b] border-[#22242d] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Loja Content Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
                {/* 1. Avatares da Loja */}
                {selectedTag !== '#acessorios' && (
                  <div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5 mb-2">
                      <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                        AVATARES
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {filteredStoreAvatars.length} disponíveis
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {filteredStoreAvatars.map((av) => {
                        const isSelected = selectedAvatarId === av.id;
                        const inCart = cart.some((c) => c.id === av.id);

                        return (
                          <div
                            key={av.id}
                            onClick={() => {
                              setSelectedAvatarId(av.id);
                              setSelectedItemToInspect(null);
                            }}
                            className={`rounded-xl border p-2.5 transition-all cursor-pointer flex flex-col justify-between group ${
                              isSelected
                                ? 'bg-[#171922] border-[#d4af37] ring-1 ring-[#d4af37]/60'
                                : 'bg-[#121317] border-[#22242d] hover:border-zinc-600'
                            }`}
                          >
                            <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0d0e11] mb-2">
                              <img
                                src={av.thumb}
                                alt={av.name}
                                className="w-full h-full object-cover filter contrast-105 group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 text-[#ffd700]">
                                  <Check className="w-4 h-4 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            <h3 className="text-xs font-serif font-bold text-zinc-100 truncate mb-1">
                              {av.name}
                            </h3>

                            <div className="flex items-center justify-between text-[10px] mb-2">
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono font-bold uppercase text-[9px] ${
                                  av.rarity === 'ÉLITE'
                                    ? 'bg-[#d4af37]/20 text-[#ffd700]'
                                    : 'bg-teal-950/80 text-teal-400'
                                }`}
                              >
                                {av.rarity}
                              </span>
                              <span className="font-semibold text-zinc-300 flex items-center gap-1 font-mono">
                                <span className="text-[#ffd700]">🪙</span>{' '}
                                {av.price.toLocaleString('pt-BR')}
                              </span>
                            </div>

                            {av.owned ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAcquireStoreAvatar(av.id);
                                  showToast(`Avatar "${av.name}" aplicado!`);
                                }}
                                className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  av.applied
                                    ? 'bg-[#d4af37] text-black font-bold'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                                }`}
                              >
                                {av.applied ? 'Aplicado' : 'Aplicar'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(av);
                                }}
                                className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                  inCart
                                    ? 'bg-zinc-800 text-zinc-400'
                                    : 'bg-[#1e2029] hover:bg-[#2b2d39] border border-white/10 text-zinc-200'
                                }`}
                              >
                                <span>{inCart ? 'No Carrinho' : 'Carrinho'}</span>
                                <ShoppingCart className="w-3 h-3 text-[#d4af37]" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Itens Publicados e Acessórios com Actions */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
                      <span className="text-[11px] font-bold tracking-wider text-[#ffd700] uppercase">
                        ACESSÓRIOS & ITENS PUBLICADOS
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {publishedCommunityItems.length} itens
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-500 my-2">
                    Clique em qualquer acessório para posicionar no avatar com Gizmo e testar suas
                    Actions de animação em tempo real!
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {publishedCommunityItems.map((item) => {
                      const isAcc = item.isAccessory || item.category === 'acessorios';
                      const isInspecting = selectedItemToInspect?.id === item.id;
                      const isSelectedAcc = selectedAccessoryId === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          className={`rounded-xl border p-2.5 flex flex-col justify-between transition-all cursor-pointer ${
                            isSelectedAcc || isInspecting
                              ? 'bg-[#181a24] border-[#ffd700] ring-1 ring-[#ffd700]/70'
                              : 'bg-[#14151b] border-[#d4af37]/40 hover:border-[#ffd700]'
                          }`}
                        >
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0a0b0d] mb-2">
                            <img
                              src={item.thumb}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 border border-[#d4af37]/60 text-[9px] font-bold text-[#ffd700]">
                              {isAcc ? '👑 ACESSÓRIO' : 'CRIADOR'}
                            </span>
                            {item.actions && item.actions.length > 0 && (
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/60 text-[9px] font-bold text-cyan-300">
                                ⚡ {item.actions.length} action(s)
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-zinc-100 truncate">{item.name}</h4>
                          <p className="text-[10px] text-zinc-500 truncate mb-1">
                            Por {item.author || 'Luzenne'}
                          </p>

                          <div className="flex items-center justify-between text-[11px] font-semibold text-[#ffd700] mb-1.5">
                            <span>
                              {item.price && item.price > 0 ? `🪙 ${item.price}` : 'Grátis'}
                            </span>
                            <span className="text-[9px] text-zinc-400 uppercase font-mono">
                              {item.category}
                            </span>
                          </div>

                          {/* Interactive Actions Execution Buttons if item has actions */}
                          {item.actions && item.actions.length > 0 && (
                            <div className="mb-2 p-1.5 rounded-lg bg-cyan-950/50 border border-cyan-400/40 space-y-1">
                              <span className="text-[10px] text-cyan-300 font-bold block">
                                ⚡ Actions ({item.actions.length}) - Clique para Executar:
                              </span>
                              <div className="flex flex-col gap-1">
                                {item.actions.map((act) => {
                                  const isRunning =
                                    activeAction?.id === act.id &&
                                    (selectedItemToInspect?.id === item.id || selectedAccessoryId === item.id);
                                  return (
                                    <button
                                      key={act.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectItem(item);
                                        setActiveAction(act);
                                        showToast(`⚡ Executando Action "${act.name}" no modelo 3D!`);
                                      }}
                                      className={`w-full py-1 px-2 rounded text-[10px] font-bold flex items-center justify-between transition-all cursor-pointer shadow-sm ${
                                        isRunning
                                          ? 'bg-cyan-400 text-black font-extrabold ring-1 ring-cyan-200 animate-pulse'
                                          : 'bg-black/60 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/30'
                                      }`}
                                      title={`Executar action ${act.name}`}
                                    >
                                      <span className="truncate">▶ {act.name}</span>
                                      <span className="text-[8px] font-mono px-1 rounded bg-black/40 text-cyan-300">
                                        {act.motion.curveTrajectory || 'Lin'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Action Button: Colocar no Avatar ou Adquirir */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectAcquire(item);
                              handleSelectItem(item);
                            }}
                            className="w-full py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:brightness-110 text-black text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-black" />
                            <span>{isAcc ? 'Pegar & Equipar' : 'Pegar Item'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Poses da Loja */}
                {(selectedLojaCategory === 'todos' || selectedLojaCategory === 'poses') && storePoses.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">💃</span>
                        <span className="text-[11px] font-bold tracking-wider text-[#ffd700] uppercase">
                          POSES DO AVATAR NA LOJA
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {storePoses.length} poses
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 mb-2.5">
                      Clique em qualquer pose para visualizar no amostrador (pedestal 3D) ou adicione ao seu Inventário para usar nas salas!
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {storePoses.map((pose) => {
                        const isInspectingPose = activePose === pose.name;
                        const isOwned = pose.owned;

                        return (
                          <div
                            key={pose.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'application/json',
                                JSON.stringify({ type: 'pose', pose })
                              );
                              e.dataTransfer.effectAllowed = 'copyMove';
                            }}
                            onClick={() => {
                              onApplyPose(pose.id);
                              setSelectedItemToInspect(null);
                              setSelectedAccessoryId(null);
                              showToast(`💃 Amostrando pose "${pose.name}" no pedestal 3D!`);
                            }}
                            className={`rounded-xl border p-2.5 flex flex-col justify-between transition-all cursor-pointer ${
                              isInspectingPose
                                ? 'bg-[#181a24] border-[#ffd700] ring-1 ring-[#ffd700]/70'
                                : 'bg-[#121317] border-[#22242d] hover:border-zinc-500'
                            }`}
                          >
                            <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#0a0b0d] mb-2 flex items-center justify-center">
                              {pose.thumbnailUrl ? (
                                <img
                                  src={pose.thumbnailUrl}
                                  alt={pose.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/80 text-zinc-400">
                                  <span className="text-3xl mb-1">💃</span>
                                  <span className="text-[10px] font-mono text-zinc-500">Pose 3D</span>
                                </div>
                              )}
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 border border-[#d4af37]/60 text-[9px] font-bold text-[#ffd700]">
                                💃 POSE
                              </span>
                              {isInspectingPose && (
                                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-[#ffd700] text-black text-[9px] font-bold">
                                  Visualizando
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-zinc-100 truncate">{pose.name}</h4>
                            <p className="text-[10px] text-zinc-400 truncate mb-1">
                              {pose.description || (pose.associatedAvatarNames?.length ? `Vinculada a ${pose.associatedAvatarNames.join(', ')}` : 'Universal')}
                            </p>

                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#ffd700] mb-2">
                              <span>
                                {pose.price && pose.price > 0 ? `🪙 ${pose.price}` : 'Grátis'}
                              </span>
                              <span className="text-[9px] text-zinc-400 uppercase font-mono">
                                {pose.rarity || 'RARO'}
                              </span>
                            </div>

                            {/* Drag handle */}
                            <div
                              className="flex items-center justify-center gap-1 text-[9px] font-mono text-zinc-400 hover:text-[#ffd700] py-0.5 mb-2 cursor-grab active:cursor-grabbing border border-dashed border-white/10 hover:border-[#ffd700]/50 rounded bg-black/30"
                              title="Arraste esta Pose para os slots do Inventário de Acesso das Rooms!"
                            >
                              <GripVertical className="w-2.5 h-2.5 text-[#ffd700]" />
                              <span>Arraste p/ Rooms</span>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApplyPose(pose.id);
                                  showToast(`Pose "${pose.name}" aplicada no mostrador 3D!`);
                                }}
                                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  isInspectingPose
                                    ? 'bg-[#ffd700] text-black font-bold'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                                }`}
                              >
                                {isInspectingPose ? '✓ No Pedestal' : 'Visualizar'}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAcquirePose) onAcquirePose(pose.id);
                                  if (onSaveToInventory) onSaveToInventory(pose);
                                  showToast(`Pose "${pose.name}" colocada no seu Inventário!`);
                                }}
                                className="py-1.5 rounded-lg bg-[#ffd700]/20 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/50 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <span>{isOwned ? 'Inventário ✓' : 'Comprar'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB: POSES */
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-base">💃</span>
                  <h2 className="text-sm md:text-base font-serif text-zinc-200 tracking-wide">
                    Poses do Avatar
                  </h2>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {poses.length} poses disponíveis
                </span>
              </div>

              <p className="text-[11px] text-zinc-400 my-2">
                Arraste qualquer pose para os slots da barra inferior ou clique em <strong>Rooms</strong> para adicionar ao Acesso Rápido das salas 3D!
              </p>

              <div className="flex-1 overflow-y-auto pt-2 space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {poses.map((pose) => {
                  const isDragOver = dragOverPoseId === pose.id;
                  const isRestricted = Boolean(
                    pose.associatedAvatarIds && pose.associatedAvatarIds.length > 0
                  );
                  const isAvatarCompatible =
                    !isRestricted ||
                    pose.associatedAvatarIds!.some(
                      (id) => ownedAvatarIds.includes(id) || selectedAvatarId === id
                    );
                  const isLocked = isRestricted && !isAvatarCompatible;
                  const isFreeOrOwned = pose.owned || !pose.price || pose.price === 0;

                  return (
                    <div
                      key={pose.id}
                      draggable={!isLocked}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({ type: 'pose', pose })
                        );
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        if (dragOverPoseId !== pose.id) {
                          setDragOverPoseId(pose.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverPoseId === pose.id) {
                          setDragOverPoseId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverPoseId(null);
                        try {
                          const rawData = e.dataTransfer.getData('application/json');
                          if (rawData) {
                            const payload = JSON.parse(rawData);
                            if (payload.type === 'avatar' && payload.avatar) {
                              handleLinkAvatarToPoseAndRoomAccess(payload.avatar, pose);
                            }
                          }
                        } catch (err) {
                          console.warn('Drop on pose card error:', err);
                        }
                      }}
                      className={`rounded-xl border p-3 transition-all flex flex-col justify-between select-none ${
                        isDragOver
                          ? 'bg-[#1a1c26] border-[#ffd700] ring-2 ring-[#ffd700] scale-[1.01] shadow-[0_0_16px_rgba(255,215,0,0.35)]'
                          : isLocked
                          ? 'bg-[#0f1013] border-white/5 opacity-70'
                          : pose.applied
                          ? 'bg-[#15171e] border-[#d4af37] ring-1 ring-[#d4af37]/50 shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                          : 'bg-[#121317] border-[#22242d] hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Pose Thumbnail */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/50 flex-shrink-0 border border-white/10 relative">
                          {pose.thumbnailUrl ? (
                            <img
                              src={pose.thumbnailUrl}
                              alt={pose.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                              💃
                            </div>
                          )}
                          {pose.applied && (
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#ffd700] text-black flex items-center justify-center text-[9px] font-bold">
                              ✓
                            </div>
                          )}
                        </div>

                        {/* Pose Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-xs font-serif font-bold text-white truncate">
                              {pose.name}
                            </h4>
                            {pose.applied ? (
                              <span className="text-[10px] font-mono text-[#ffd700] flex items-center gap-0.5 font-bold">
                                Ativa
                              </span>
                            ) : isLocked ? (
                              <span className="text-[10px] font-mono text-red-400 flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Bloqueada
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate">
                            {pose.description || (isRestricted ? `Vinculada a ${pose.associatedAvatarNames?.join(', ')}` : 'Universal para todas as salas')}
                          </p>
                        </div>
                      </div>

                      {/* Drop hint when an avatar is dragged over */}
                      {isDragOver && (
                        <div className="my-1.5 py-1 px-2 rounded-lg bg-[#ffd700]/20 border border-[#ffd700] text-[#ffd700] text-[10px] font-bold flex items-center justify-center gap-1 animate-pulse">
                          <span>✨</span>
                          <span>Solte o Avatar aqui para vincular & adicionar às Rooms!</span>
                        </div>
                      )}

                      {/* Drag handle */}
                      <div
                        className="flex items-center justify-center gap-1 text-[9px] font-mono text-zinc-400 hover:text-[#ffd700] py-0.5 mt-2 cursor-grab active:cursor-grabbing border border-dashed border-white/10 hover:border-[#ffd700]/50 rounded bg-black/30"
                        title="Arraste esta Pose para os slots do Inventário de Acesso das Rooms!"
                      >
                        <GripVertical className="w-2.5 h-2.5 text-[#ffd700]" />
                        <span>Arraste p/ Rooms</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyPose(pose.id);
                            showToast(`Pose "${pose.name}" aplicada ao Avatar!`);
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            pose.applied
                              ? 'bg-[#d4af37] text-black font-bold'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                          }`}
                        >
                          <span>{pose.applied ? '✓ Ativa' : 'Aplicar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddPoseToRoomAccess(pose)}
                          className="px-3 py-1.5 rounded-lg bg-[#ffd700]/15 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                          title="Adicionar esta pose ao Inventário de Acesso das Rooms"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Rooms</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            CENTER COLUMN: 3D INTERACTIVE PEDESTAL & ACCESSORY GIZMO
            ======================================================== */}
        <div className="flex-1 relative flex flex-col justify-between bg-gradient-to-b from-[#0b0c10] via-[#090a0d] to-[#050608] overflow-hidden">
          {/* Top Floating Controls on Pedestal Viewport */}
          {selectedItemToInspect ? (
            /* Banner when inspecting non-accessory item isolated */
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-black/85 border border-[#ffd700] backdrop-blur-md flex items-center gap-3 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-1.5 text-xs text-[#ffd700] font-bold">
                <span>📦</span>
                <span>Inspecionando Objeto 3D no Pedestal:</span>
                <span className="text-white">{selectedItemToInspect.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItemToInspect(null);
                  setActiveAction(null);
                }}
                className="px-3 py-1 rounded-lg bg-[#d4af37] text-black text-[11px] font-bold hover:brightness-110 cursor-pointer shadow-md"
              >
                Voltar ao Avatar 👤
              </button>
            </div>
          ) : (activeSelectedAccessory || selectedAccessoryId) ? (
            /* Banner & Gizmo Mode Controls when adjusting Accessory on Avatar */
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-black/90 border border-[#ffd700] backdrop-blur-md flex flex-col items-center gap-2 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-[#ffd700] font-bold">
                  <span>👑</span>
                  <span>Ajustando Acessório:</span>
                  <span className="text-white">{activeSelectedAccessory?.name || 'Acessório Selecionado'}</span>
                </div>

                {/* Gizmo Mode Switcher */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#14151b] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setGizmoMode('mover')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      gizmoMode === 'mover'
                        ? 'bg-[#ffd700] text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Mover
                  </button>
                  <button
                    type="button"
                    onClick={() => setGizmoMode('rodar')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      gizmoMode === 'rodar'
                        ? 'bg-[#ffd700] text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Rodar
                  </button>
                  <button
                    type="button"
                    onClick={() => setGizmoMode('escalar')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      gizmoMode === 'escalar'
                        ? 'bg-[#ffd700] text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Escalar
                  </button>
                </div>

                {/* Lock Position Button */}
                <button
                  type="button"
                  onClick={handleToggleLockPosition}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-all ${
                    isPositionLocked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                      : 'bg-[#ffd700] hover:brightness-110 text-black shadow-md'
                  }`}
                  title="Trava o acessório exatamente na posição atual do seu avatar"
                >
                  <span>{isPositionLocked ? '🔒 Posição Travada' : '🔓 Travar no Avatar'}</span>
                </button>

                {/* Save to Principal Avatar Definition */}
                <button
                  type="button"
                  onClick={handleSaveToPrincipalAvatar}
                  className="px-3.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1.5 transition-all bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-black shadow-lg"
                  title="Salva esta posição e definição do acessório no avatar principal"
                >
                  <Save className="w-3.5 h-3.5 text-black" />
                  <span>Salvar no Avatar Principal</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Action Execution Bar for Accessory or Inspected Object */}
          {activeItemActions.length > 0 && (
            <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#121319]/90 border border-cyan-400/60 backdrop-blur-md flex items-center gap-2 shadow-2xl animate-fade-in">
              <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Actions:</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setActiveAction(null);
                  showToast('Animação pausada.');
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  !activeAction
                    ? 'bg-cyan-400 text-black'
                    : 'bg-black/50 text-zinc-400 hover:text-white'
                }`}
              >
                ⏹ Parar
              </button>

              {activeItemActions.map((act) => {
                const isRunning = activeAction?.id === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setActiveAction(act);
                      showToast(`Executando Action "${act.name}" em tempo real!`);
                    }}
                    className={`px-3 py-1 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      isRunning
                        ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-black shadow-md'
                        : 'bg-black/50 hover:bg-cyan-950/60 text-cyan-200 border border-cyan-500/30'
                    }`}
                  >
                    <span>⚡</span>
                    <span>{act.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Interactive 3D Avatar or Isolated Object on Dark Obsidian Pedestal */}
          <div className="flex-1 relative w-full h-full">
            <AvatarPedestal3D
              currentPose={activePose}
              equippedItems={equippedItems}
              avatarName={currentAvatar.name}
              avatarModelUrl={currentAvatar.fileBlobUrl}
              fineAdjustments={fineAdjustments}
              onUpdateRotation={(rotY) =>
                setFineAdjustments((prev) => ({ ...prev, rotationY: rotY }))
              }
              selectedItemToInspect={selectedItemToInspect}
              selectedAccessoryId={selectedAccessoryId}
              selectedAccessoryItem={activeSelectedAccessory}
              onSelectAccessory={(id) => setSelectedAccessoryId(id)}
              onUpdateAccessoryTransform={handleUpdateAccessoryTransform}
              gizmoMode={gizmoMode}
              activeAction={activeAction}
              isPositionLocked={isPositionLocked}
            />
          </div>

          {/* BOTTOM CONTROLS: Fine Adjustments */}
          <div className="relative z-20 px-8 pb-6 pt-2 flex flex-col items-center">
            <div className="flex flex-col items-center mb-3">
              <span className="text-[11px] font-medium text-zinc-400 mb-2">
                Ajustes Finos do Pedestal
              </span>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#121318]/90 border border-white/10 backdrop-blur-md shadow-2xl">
                <button
                  type="button"
                  onClick={() =>
                    setFineAdjustments((prev) => ({
                      ...prev,
                      panX: (prev.panX + 0.1) % 0.4,
                    }))
                  }
                  className="flex flex-col items-center justify-center w-16 h-14 rounded-lg bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
                >
                  <Move className="w-4 h-4 mb-1 text-zinc-400 group-hover:text-[#d4af37]" />
                  <span className="text-[10px] font-medium">Mover</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFineAdjustments((prev) => ({
                      ...prev,
                      rotationY: prev.rotationY + Math.PI / 4,
                    }))
                  }
                  className="flex flex-col items-center justify-center w-16 h-14 rounded-lg bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
                >
                  <RotateCw className="w-4 h-4 mb-1 text-zinc-400 group-hover:text-[#d4af37]" />
                  <span className="text-[10px] font-medium">Rodar</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFineAdjustments((prev) => ({
                      ...prev,
                      scale: prev.scale === 1.0 ? 1.15 : prev.scale === 1.15 ? 0.9 : 1.0,
                    }))
                  }
                  className="flex flex-col items-center justify-center w-16 h-14 rounded-lg bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
                >
                  <Maximize2 className="w-4 h-4 mb-1 text-zinc-400 group-hover:text-[#d4af37]" />
                  <span className="text-[10px] font-medium">Escalar</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFineAdjustments((prev) => ({
                      ...prev,
                      elevationY: (prev.elevationY + 0.08) % 0.32,
                    }))
                  }
                  className="flex flex-col items-center justify-center w-16 h-14 rounded-lg bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
                >
                  <ArrowUp className="w-4 h-4 mb-1 text-zinc-400 group-hover:text-[#d4af37]" />
                  <span className="text-[10px] font-medium">Elevar</span>
                </button>
              </div>
            </div>

            {/* In Loja view: Action & Add to Cart CTAs */}
            {activeTab === 'loja' && (
              <div className="w-full max-w-md flex flex-col gap-2">
                {activeSelectedAccessory && (
                  <button
                    type="button"
                    onClick={handleSaveToPrincipalAvatar}
                    className="w-full py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-black font-extrabold text-xs tracking-wide shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4 text-black" />
                    <span>Salvar Ajuste de "{activeSelectedAccessory.name}" no Avatar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (selectedItemToInspect) {
                      addToCart(selectedItemToInspect);
                    } else if (activeSelectedAccessory) {
                      addToCart(activeSelectedAccessory);
                    } else {
                      addToCart(currentAvatar);
                    }
                  }}
                  className="w-full py-3 px-8 rounded-xl bg-gradient-to-r from-[#9e763b] via-[#b58c54] to-[#9e763b] text-black font-semibold text-sm tracking-wide shadow-[0_8px_25px_rgba(181,140,84,0.35)] hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4 text-black" />
                  <span>
                    Adicionar ao Carrinho (
                    {selectedItemToInspect
                      ? selectedItemToInspect.name
                      : activeSelectedAccessory
                      ? activeSelectedAccessory.name
                      : currentAvatar.name}
                    )
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: POSES DO AVATAR */}
        <div className="w-72 lg:w-80 border-l border-[#262833]/80 bg-[#0d0e12] p-6 flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <h2 className="text-sm md:text-base font-serif text-zinc-200 tracking-wide">
                Poses do Avatar
              </h2>
              <span className="text-[10px] text-zinc-500 font-mono">{poses.length} poses</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setPublishObjectType('pose');
                setNewPublishName('');
                setPublishAssociatedAvatarIds([]);
                setNewPublishPrice(0);
                setPublishMode('avancado');
                setShowPublishModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#ffd700]/15 hover:bg-[#ffd700] hover:text-black border border-[#ffd700]/40 text-[#ffd700] text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              title="Publicar Nova Pose para Avatares"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Pose</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-4 pr-1 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
            {poses.map((pose) => {
              const isRestricted = Boolean(
                pose.associatedAvatarIds && pose.associatedAvatarIds.length > 0
              );
              const userOwnsAvatar =
                !isRestricted ||
                pose.associatedAvatarIds!.some((id) => {
                  const av = storeAvatars.find((a) => a.id === id);
                  return av && (av.owned || av.applied);
                });
              const isLocked = isRestricted && !userOwnsAvatar;
              const isFreeOrOwned =
                pose.price === undefined || pose.price === 0 || pose.owned;
              const isDragOver = dragOverPoseId === pose.id;

              return (
                <div
                  key={pose.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({ type: 'pose', pose })
                    );
                    e.dataTransfer.effectAllowed = 'copyMove';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dragOverPoseId !== pose.id) {
                      setDragOverPoseId(pose.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverPoseId === pose.id) {
                      setDragOverPoseId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverPoseId(null);
                    try {
                      const rawData = e.dataTransfer.getData('application/json');
                      if (rawData) {
                        const payload = JSON.parse(rawData);
                        if (payload.type === 'avatar' && payload.avatar) {
                          handleLinkAvatarToPoseAndRoomAccess(payload.avatar, pose);
                        }
                      }
                    } catch (err) {
                      console.warn('Drop on pose card error:', err);
                    }
                  }}
                  className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between select-none ${
                    isDragOver
                      ? 'bg-[#1a1c26] border-[#ffd700] ring-2 ring-[#ffd700] scale-[1.02] shadow-[0_0_20px_rgba(255,215,0,0.4)]'
                      : isLocked
                      ? 'bg-[#0f1013] border-white/5 opacity-75 hover:opacity-100'
                      : pose.applied
                      ? 'bg-[#15171e] border-[#d4af37]/80 ring-1 ring-[#d4af37]/40'
                      : 'bg-[#121317] border-[#22242d] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {pose.name}
                    </span>
                    {pose.applied ? (
                      <span className="text-[10px] font-mono text-[#d4af37] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ativa
                      </span>
                    ) : isLocked ? (
                      <span className="text-[10px] font-mono text-red-400 flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Bloqueada
                      </span>
                    ) : null}
                  </div>

                  {/* Drop hint when an avatar is dragged over */}
                  {isDragOver && (
                    <div className="my-1.5 py-1 px-2 rounded-lg bg-[#ffd700]/20 border border-[#ffd700] text-[#ffd700] text-[10px] font-bold flex items-center justify-center gap-1 animate-pulse">
                      <span>✨</span>
                      <span>Solte o Avatar aqui para vincular & adicionar ao Acesso das Rooms!</span>
                    </div>
                  )}

                  <div className="mb-2">
                    {isRestricted ? (
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 max-w-full truncate ${
                          isLocked
                            ? 'bg-red-950/40 border-red-500/40 text-red-300'
                            : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                        }`}
                        title={pose.associatedAvatarNames?.join(', ')}
                      >
                        {isLocked ? (
                          <Lock className="w-2.5 h-2.5 flex-shrink-0" />
                        ) : (
                          <Check className="w-2.5 h-2.5 flex-shrink-0 text-emerald-400" />
                        )}
                        <span className="truncate">
                          Requer: {pose.associatedAvatarNames?.join(' ou ') || 'Avatar da Loja'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1">
                        <span>🌐</span>
                        <span>Universal (Todas as rooms)</span>
                      </span>
                    )}
                  </div>

                  {/* Drag indicator handle */}
                  <div
                    className="flex items-center justify-center gap-1 text-[9px] font-mono text-zinc-400 hover:text-[#ffd700] py-0.5 mb-2 cursor-grab active:cursor-grabbing border border-dashed border-white/10 hover:border-[#ffd700]/50 rounded bg-black/30"
                    title="Arraste esta Pose para o Inventário de Acesso das Rooms!"
                  >
                    <GripVertical className="w-2.5 h-2.5 text-[#ffd700]" />
                    <span>Arraste p/ Rooms</span>
                  </div>

                  {isLocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        const reqNames =
                          pose.associatedAvatarNames?.join(' ou ') || 'Avatar exclusivo';
                        showToast(
                          `⚠️ Pose "${pose.name}" bloqueada! Adquira o avatar "${reqNames}" na loja para usar.`
                        );
                      }}
                      className="w-full py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5 text-red-400" />
                      <span>Requer Avatar</span>
                    </button>
                  ) : !isFreeOrOwned ? (
                    <button
                      type="button"
                      onClick={() => handleBuyPose(pose)}
                      className="w-full py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#ffd700] hover:brightness-110 text-black text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Coins className="w-3.5 h-3.5 text-black" />
                      <span>Comprar ({pose.price} 🪙)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyPose(pose.id);
                          showToast(`Pose "${pose.name}" aplicada ao Avatar!`);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          pose.applied
                            ? 'bg-[#d4af37] text-black font-bold'
                            : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{pose.applied ? 'Ativa' : 'Aplicar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddPoseToRoomAccess(pose)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#ffd700]/15 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="Adicionar esta pose ao Inventário de Acesso das Rooms"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Rooms</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRemovePose(pose.id);
                          showToast(`Pose "${pose.name}" desativada.`);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/20 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center"
                        title="Remover pose ativa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* INVENTÁRIO DE ACESSO DAS ROOMS (BARRA INFERIOR DE SLOTS / ATALHOS) */}
      <RoomAccessBar
        slots={roomAccessSlots}
        onUpdateSlots={handleUpdateRoomAccessSlots}
        onSlotClick={(slot) => {
          if (slot.type === 'avatar') {
            setSelectedAvatarId(slot.itemId);
            if (onSelectActiveAvatar) onSelectActiveAvatar(slot.itemId);
            showToast(`Avatar "${slot.name}" selecionado.`);
          } else {
            onApplyPose(slot.itemId);
            showToast(`Pose "${slot.name}" aplicada ao Avatar.`);
          }
        }}
        activeAvatarId={selectedAvatarId}
        activePoseId={poses.find((p) => p.applied)?.id}
        onShowToast={showToast}
      />

      {/* CART DRAWER / MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md h-full bg-[#121317] border-l border-[#d4af37]/40 p-6 flex flex-col justify-between shadow-2xl text-zinc-100">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#ffd700]" />
                  <h3 className="text-base font-serif font-bold text-white">Seu Carrinho</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#181920] border border-white/5 flex items-center justify-between gap-3"
                  >
                    <img
                      src={item.thumb}
                      alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-100 truncate">{item.name}</p>
                      <p className="text-[11px] font-mono text-[#ffd700]">
                        🪙 {item.price ? item.price.toLocaleString('pt-BR') : 'Grátis'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="py-16 text-center text-zinc-500 text-xs">
                    Seu carrinho está vazio. Adicione avatares e itens da loja.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Total:</span>
                <span className="text-base font-bold text-[#ffd700] font-mono">
                  🪙{' '}
                  {cart
                    .reduce((sum, item) => sum + (item.price || 0), 0)
                    .toLocaleString('pt-BR')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black font-bold text-sm tracking-wide shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer"
              >
                Finalizar Aquisição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLICAR ITEM MODAL */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in font-sans overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#14151b] border border-[#d4af37]/60 rounded-2xl p-6 shadow-2xl text-zinc-100 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#ffd700]">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Publicar na Loja (Persistência)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePublish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nome do Item <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPublishName}
                  onChange={(e) => setNewPublishName(e.target.value)}
                  placeholder="Ex: Drone Companheiro, Chapéu Fedora, Relógio Gold"
                  className="w-full bg-[#1b1c24] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Tipo de Objeto
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 text-[11px]">
                  {[
                    { type: 'acessorio' as const, label: 'Acessório', icon: '👑' },
                    { type: 'avatar' as const, label: 'Avatar', icon: '👤' },
                    { type: 'item' as const, label: 'Item / Roupa', icon: '👔' },
                    { type: 'pose' as const, label: 'Pose', icon: '🧘' },
                    { type: 'sala' as const, label: 'Sala', icon: '🏛️' },
                    { type: 'moveis' as const, label: 'Móveis', icon: '🛋️' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setPublishObjectType(item.type)}
                      className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        publishObjectType === item.type
                          ? 'bg-[#d4af37]/25 border-[#ffd700] text-[#ffd700] font-bold shadow-sm'
                          : 'bg-[#1b1c24] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs">{item.icon}</span>
                      <span className="truncate w-full">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {publishObjectType === 'acessorio' && (
                <div className="p-3 rounded-xl bg-black/60 border border-[#ffd700]/40 space-y-2">
                  <label className="text-xs font-semibold text-[#ffd700] flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Ponto de Fixação Inicial no Avatar</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'companion_float', label: '🛸 Drone / Ao Lado' },
                      { id: 'head', label: '👒 Cabeça / Chapéu' },
                      { id: 'left_hand', label: '⌚ Pulso Esquerdo' },
                      { id: 'right_hand', label: '🖐️ Mão Direita' },
                      { id: 'chest', label: '👔 Peito / Colar' },
                      { id: 'back', label: '🎒 Costas / Asas' },
                    ].map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => setPublishAttachment(att.id as AccessoryAttachmentPoint)}
                        className={`p-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                          publishAttachment === att.id
                            ? 'bg-[#ffd700]/25 border-[#ffd700] text-[#ffd700]'
                            : 'bg-[#16171f] border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {att.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fonte do Modelo 3D para Persistência Total */}
              {publishObjectType !== 'pose' && (
                <div className="p-3 rounded-xl bg-black/60 border border-[#d4af37]/40 space-y-2.5">
                  <label className="text-xs font-semibold text-[#ffd700] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Modelo 3D Original (Persistência ao Recarregar Página)</span>
                  </label>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPublishModelSourceType('active')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        publishModelSourceType === 'active'
                          ? 'bg-[#ffd700]/25 border-[#ffd700] text-[#ffd700] font-bold'
                          : 'bg-[#16171f] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      🎯 Em Foco / Pedestal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPublishModelSourceType('inventory')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        publishModelSourceType === 'inventory'
                          ? 'bg-[#ffd700]/25 border-[#ffd700] text-[#ffd700] font-bold'
                          : 'bg-[#16171f] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      🎒 Do Inventário ({userInventory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPublishModelSourceType('upload')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        publishModelSourceType === 'upload'
                          ? 'bg-[#ffd700]/25 border-[#ffd700] text-[#ffd700] font-bold'
                          : 'bg-[#16171f] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      📁 Upload .GLB
                    </button>
                  </div>

                  {publishModelSourceType === 'active' && (
                    <div className="text-[11px] text-zinc-300 bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>
                        Usando modelo em foco:{' '}
                        <strong className="text-white">
                          {activeSelectedAccessory?.name || selectedItemToInspect?.name || currentAvatar?.name || 'Objeto do Pedestal'}
                        </strong>
                      </span>
                    </div>
                  )}

                  {publishModelSourceType === 'inventory' && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Escolha o item do seu inventário 3D:</label>
                      <select
                        value={publishSelectedInventoryId}
                        onChange={(e) => {
                          setPublishSelectedInventoryId(e.target.value);
                          const chosen = userInventory.find((i) => i.id === e.target.value);
                          if (chosen) {
                            if (!newPublishName) setNewPublishName(chosen.displayName);
                            if (chosen.thumbUrl) setPublishThumbnailUrl(chosen.thumbUrl);
                          }
                        }}
                        className="w-full bg-[#1b1c24] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-[#d4af37]"
                      >
                        <option value="">Selecione um item 3D...</option>
                        {userInventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.displayName} ({item.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {publishModelSourceType === 'upload' && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Arquivo .glb ou .gltf do seu computador:</label>
                      <input
                        type="file"
                        accept=".glb,.gltf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPublishUploadedFile(file);
                            if (!newPublishName) {
                              setNewPublishName(file.name.replace(/\.[^/.]+$/, ''));
                            }
                          }
                        }}
                        className="w-full text-xs text-zinc-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#d4af37] file:text-black hover:file:brightness-110 cursor-pointer"
                      />
                      {publishUploadedFile && (
                        <p className="text-[10px] text-emerald-400">
                          Arquivo pronto: {publishUploadedFile.name} ({(publishUploadedFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Preço em Moedas (🪙)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={newPublishPrice}
                  onChange={(e) => setNewPublishPrice(Number(e.target.value))}
                  placeholder="0 para Grátis"
                  className="w-full bg-[#1b1c24] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  URL da Imagem de Capa
                </label>
                <input
                  type="text"
                  value={publishThumbnailUrl}
                  onChange={(e) => setPublishThumbnailUrl(e.target.value)}
                  className="w-full bg-[#1b1c24] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black font-extrabold text-xs shadow-lg hover:brightness-110 cursor-pointer"
                >
                  Publicar Agora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
