import React, { useState, useEffect } from 'react';
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
} from '../types';
import { AvatarPedestal3D } from './AvatarPedestal3D';
import { persistStoreItem, fetchPublicStoreItems } from '../lib/database';

interface UserCustomizationViewProps {
  onBackToLobby: () => void;
  user: CreatorUser | null;
  onOpenAuthModal: () => void;
  initialTab?: 'loja' | 'inventario' | 'poses';
  userInventory: InventoryItem[];
  customizationItems: CustomizationItem[];
  storeAvatars: StoreAvatar[];
  poses: AvatarPoseConfig[];
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

  // Selected avatar & pose
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    storeAvatars.find((a) => a.applied)?.id || storeAvatars[0]?.id || 'av-1'
  );

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

  // Filter items in Inventário
  const filteredInventoryItems = customizationItems.filter((item) => {
    if (!item.owned) return false;
    const matchesSearch = item.name.toLowerCase().includes(searchQueryInventory.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'todos') return true;
    if (selectedCategory === 'acessorios') return item.isAccessory || item.category === 'acessorios';
    return item.category === selectedCategory;
  });

  const filteredUserInventory = userInventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQueryInventory.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'todos') return true;
    if (selectedCategory === 'salas') return item.type === 'sala' || item.type === 'cenario';
    if (selectedCategory === 'mobilia') return item.type === 'movel';
    if (selectedCategory === 'itens') return item.type === 'objeto';
    if (selectedCategory === 'poses') return item.type === 'pose';
    if (selectedCategory === 'avatar') return item.type === 'avatar';
    return false;
  });

  // Filter avatars in Loja
  const filteredStoreAvatars = storeAvatars.filter((av) => {
    const matchesSearch = av.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || av.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // Filter items in Loja (Store Items & Community Published)
  const publishedCommunityItems = customizationItems.filter((i) => {
    const isAccessory = i.isAccessory || i.category === 'acessorios';
    if (selectedTag === '#acessorios') return isAccessory;
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Selected active accessory object if any
  const activeSelectedAccessory = customizationItems.find((i) => i.id === selectedAccessoryId);

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
      if (!item.equipped) {
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

    const isAccessory = publishObjectType === 'acessorio';
    const newItem: Partial<CustomizationItem> = {
      id: `pub-${Date.now()}`,
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
        name: newItem.name!,
        objectType: publishObjectType,
        price: finalPrice,
        hashtags: finalTags,
        thumbnailUrl: finalThumb,
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
    setShowPublishModal(false);
    setNewPublishName('');
    showToast(`"${newItem.name}" publicado com persistência na Loja!`);
  };

  const equippedItems = React.useMemo(() => customizationItems.filter((i) => i.equipped), [customizationItems]);

  const currentStoreAvatar = storeAvatars.find((a) => a.id === selectedAvatarId);
  const currentCustomAvatar = customizationItems.find((i) => i.id === selectedAvatarId);
  
  const currentAvatar = (selectedItemToInspect?.isAvatar || selectedItemToInspect?.category === 'avatares')
    ? {
        id: selectedItemToInspect.id,
        name: selectedItemToInspect.name,
        fileBlobUrl: selectedItemToInspect.fileBlobUrl,
        thumb: selectedItemToInspect.thumb,
        price: selectedItemToInspect.price,
        rarity: selectedItemToInspect.rarity,
        tags: [],
        author: selectedItemToInspect.author,
        owned: selectedItemToInspect.owned,
        applied: false
      }
    : currentStoreAvatar || (currentCustomAvatar ? {
    id: currentCustomAvatar.id,
    name: currentCustomAvatar.name,
    fileBlobUrl: currentCustomAvatar.fileBlobUrl,
    thumb: currentCustomAvatar.thumb,
    price: currentCustomAvatar.price,
    rarity: currentCustomAvatar.rarity,
    tags: [],
    author: currentCustomAvatar.author,
    owned: currentCustomAvatar.owned,
    applied: false
  } : storeAvatars[0]);

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
                      .filter((av) => av.owned && av.name.toLowerCase().includes(searchQueryInventory.toLowerCase()))
                      .map((av) => {
                        const isSelectedForPreview = selectedAvatarId === av.id;
                        return (
                          <div
                            key={av.id}
                            onClick={() => {
                              setSelectedAvatarId(av.id);
                              setSelectedItemToInspect(null);
                            }}
                            className={`relative rounded-xl border p-2.5 flex flex-col justify-between transition-all cursor-pointer group ${
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
                              className={`w-full mt-2 py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                av.applied
                                  ? 'bg-[#ffd700] text-black'
                                  : 'bg-zinc-800 hover:bg-[#d4af37] hover:text-black text-zinc-200'
                              }`}
                            >
                              {av.applied ? '✓ Avatar em Uso' : 'Usar para Jogar'}
                            </button>
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

                {(selectedCategory === 'todos' || ['salas', 'mobilia', 'itens', 'poses', 'avatar'].includes(selectedCategory)) && filteredUserInventory.length > 0 && (
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
                                alt={item.name}
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
                )}}
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

              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar avatares, acessórios, drones..."
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
              </div>
            </div>
          ) : (
            /* TAB: POSES */
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <h2 className="text-sm md:text-base font-serif text-zinc-200 tracking-wide pb-4 border-b border-white/5">
                Poses do Avatar
              </h2>
              <div className="flex-1 overflow-y-auto pt-4 space-y-3">
                {poses.map((pose) => (
                  <div
                    key={pose.id}
                    className="p-3 rounded-xl bg-[#14151b] border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{pose.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {pose.applied ? 'Ativa no avatar' : 'Disponível'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPose(pose.id);
                        showToast(`Pose "${pose.name}" aplicada!`);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pose.applied ? 'bg-[#ffd700] text-black' : 'bg-zinc-800 text-zinc-200'
                      }`}
                    >
                      {pose.applied ? 'Ativa' : 'Aplicar'}
                    </button>
                  </div>
                ))}
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
          ) : activeSelectedAccessory ? (
            /* Banner & Gizmo Mode Controls when adjusting Accessory on Avatar */
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-black/90 border border-[#ffd700] backdrop-blur-md flex flex-col items-center gap-2 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-[#ffd700] font-bold">
                  <span>👑</span>
                  <span>Ajustando Acessório:</span>
                  <span className="text-white">{activeSelectedAccessory.name}</span>
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

            {/* In Loja view: Add to Cart CTA */}
            {activeTab === 'loja' && (
              <button
                type="button"
                onClick={() => {
                  if (selectedItemToInspect) {
                    addToCart(selectedItemToInspect);
                  } else {
                    addToCart(currentAvatar);
                  }
                }}
                className="w-full max-w-md py-3.5 px-8 rounded-xl bg-gradient-to-r from-[#9e763b] via-[#b58c54] to-[#9e763b] text-black font-semibold text-sm tracking-wide shadow-[0_8px_25px_rgba(181,140,84,0.35)] hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4 text-black" />
                <span>
                  Adicionar ao Carrinho (
                  {selectedItemToInspect ? selectedItemToInspect.name : currentAvatar.name})
                </span>
              </button>
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

              return (
                <div
                  key={pose.id}
                  className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                    isLocked
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

                  <div className="mb-3">
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
                    <div className="flex items-center gap-2">
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
                        onClick={() => {
                          onRemovePose(pose.id);
                          showToast(`Pose "${pose.name}" desativada.`);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/20 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
