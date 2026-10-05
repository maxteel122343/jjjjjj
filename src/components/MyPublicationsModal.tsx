import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  ShoppingBag,
  Database,
  Trash2,
  Edit3,
  Copy,
  Check,
  Calendar,
  Box,
  MapPin,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import {
  RoomEditorState,
  CreatorUser,
  StoreAvatar,
  CustomizationItem,
  AvatarPoseConfig,
  ObjectAction,
  AccessoryAttachmentPoint,
} from '../types';
import {
  fetchMyPublishedRooms,
  deletePublishedRoom,
  deletePublishedItem,
  persistStoreItem,
  generateSqlPersistenceScript,
} from '../lib/database';

interface MyPublicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: CreatorUser | null;
  onLoadRoomForEdit: (room: RoomEditorState) => void;
  onLoadItemForEdit?: (item: any, type: 'avatar' | 'item' | 'pose') => void;
  onRefreshData?: () => void;
  currentEditingRoomId?: string;
  storeAvatars: StoreAvatar[];
  customizationItems: CustomizationItem[];
  avatarPoses: AvatarPoseConfig[];
  onShowToast: (msg: string) => void;
  onDeleteRoom?: (roomId: string) => void;
  onDeleteItem?: (itemId: string, type: 'avatar' | 'pose' | 'item') => void;
}

export const MyPublicationsModal: React.FC<MyPublicationsModalProps> = ({
  isOpen,
  onClose,
  user,
  onLoadRoomForEdit,
  onLoadItemForEdit,
  onRefreshData,
  currentEditingRoomId,
  storeAvatars,
  customizationItems,
  avatarPoses,
  onShowToast,
  onDeleteRoom,
  onDeleteItem,
}) => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'items'>('rooms');
  const [publishedRooms, setPublishedRooms] = useState<any[]>([]);
  const [publishedAvatars, setPublishedAvatars] = useState<StoreAvatar[]>([]);
  const [publishedStoreItems, setPublishedStoreItems] = useState<CustomizationItem[]>([]);
  const [publishedPoses, setPublishedPoses] = useState<AvatarPoseConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: any } | null>(null);

  // Synchronize local published items with incoming props
  useEffect(() => {
    setPublishedAvatars(
      storeAvatars.filter((a) => a.isUserPublished || a.id.startsWith('pub-') || a.id.startsWith('av-pub'))
    );
    setPublishedStoreItems(
      customizationItems.filter((i) => i.isPublishedByCreator || i.id.startsWith('pub-') || i.id.startsWith('acc-pub'))
    );
    setPublishedPoses(
      avatarPoses.filter((p) => p.isPublishedByCreator || p.id.startsWith('pose-pub'))
    );
  }, [storeAvatars, customizationItems, avatarPoses]);

  // Editing published item state
  const [editingItemData, setEditingItemData] = useState<{
    item: any;
    type: 'avatar' | 'item' | 'pose';
  } | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editRarity, setEditRarity] = useState<'COMUM' | 'RARO' | 'ÉLITE'>('RARO');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<string>('acessorios');
  const [editAttachment, setEditAttachment] = useState<AccessoryAttachmentPoint>('companion_float');
  const [editActions, setEditActions] = useState<ObjectAction[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (editingItemData) {
      const it = editingItemData.item;
      setEditName(it.name || '');
      setEditPrice(it.price || 0);
      setEditRarity(it.rarity || 'RARO');
      setEditDesc(it.description || '');
      setEditCategory(it.category || (editingItemData.type === 'avatar' ? 'avatar' : 'acessorios'));
      setEditAttachment(it.accessoryAttachment || 'companion_float');
      setEditActions(it.actions || []);
    }
  }, [editingItemData]);

  const handleSaveEditedItem = async () => {
    if (!editingItemData) return;
    setIsSavingEdit(true);
    try {
      const it = editingItemData.item;
      const isAcc = editCategory === 'acessorios' || it.isAccessory;
      const payload = {
        id: it.id,
        name: editName.trim() || it.name,
        objectType: (editingItemData.type === 'avatar' ? 'avatar' : editingItemData.type === 'pose' ? 'pose' : isAcc ? 'acessorio' : 'item') as any,
        price: editPrice,
        rarity: editRarity,
        description: editDesc,
        publishMode: 'avancado' as const,
        hashtags: it.tags || ['#comunidade', '#3d'],
        thumbnailUrl: it.thumb || it.thumbnailUrl,
        fileBlobUrl: it.fileBlobUrl,
        author: it.author || user?.displayName || 'Luzenne',
        accessoryAttachment: isAcc ? editAttachment : undefined,
        accessoryTransform: it.accessoryTransform,
        actions: editActions,
      };
      await persistStoreItem(payload, user);
      onShowToast(`Item "${editName}" atualizado com sucesso na Vitrine!`);
      setEditingItemData(null);
      onRefreshData?.();
    } catch (err: any) {
      onShowToast(`Erro ao salvar: ${err?.message || 'Tente novamente'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddPresetActionToEdit = (type: string) => {
    let act: ObjectAction;
    const now = Date.now();
    if (type === 'girar_360') {
      act = {
        id: `act-${now}`,
        name: `Girar 360° ${editActions.length + 1}`,
        motion: {
          enabled: true,
          deltaPosition: [0, 0, 0],
          turnAngle: 360,
          curveTrajectory: 'circle_turn',
          curveRadius: 0.01,
          speed: 1.0,
          loop: true,
          target: 'parent_object',
        },
      };
    } else if (type === 'frente_tras') {
      act = {
        id: `act-${now}`,
        name: `Frente e Trás ${editActions.length + 1}`,
        motion: {
          enabled: true,
          deltaPosition: [0, 0, 2.0],
          curveTrajectory: 'linear',
          speed: 1.0,
          loop: true,
          target: 'parent_object',
        },
      };
    } else if (type === 'elevador') {
      act = {
        id: `act-${now}`,
        name: `Elevador ${editActions.length + 1}`,
        motion: {
          enabled: true,
          deltaPosition: [0, 2.5, 0],
          curveTrajectory: 'linear',
          speed: 1.0,
          loop: true,
          target: 'parent_object',
        },
      };
    } else {
      act = {
        id: `act-${now}`,
        name: `Flutuação ${editActions.length + 1}`,
        motion: {
          enabled: true,
          deltaPosition: [0, 0.4, 0],
          curveTrajectory: 'wave',
          speed: 0.8,
          loop: true,
          target: 'parent_object',
        },
      };
    }
    setEditActions((prev) => [...prev, act]);
  };

  const totalItemsCount = publishedAvatars.length + publishedStoreItems.length + publishedPoses.length;

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const rooms = await fetchMyPublishedRooms(user);
      setPublishedRooms(rooms);
    } catch (e) {
      console.warn('Error loading published rooms:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleDeleteRoom = async (roomId: string) => {
    const res = await deletePublishedRoom(roomId, user);
    if (res.success) {
      setPublishedRooms((prev) => prev.filter((r) => r.id !== roomId));
      onShowToast('Sala removida das publicações.');
      setRoomToDelete(null);
      onRefreshData?.();
    } else {
      onShowToast('Erro ao remover sala.');
    }
  };

  const handleDeleteItem = async (itemId: string, type: 'avatar' | 'pose' | 'item') => {
    const res = await deletePublishedItem(itemId, type, user);
    if (res.success) {
      onShowToast('Item removido com sucesso.');
      setItemToDelete(null);
      onRefreshData?.();
    } else {
      onShowToast('Erro ao remover item.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#121317] border border-[#d4af37]/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] text-[#e8d5b5] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/30 bg-[#171922]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-[#ffd700]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#ffd700] tracking-wide flex items-center gap-2">
                MINHAS PUBLICAÇÕES & PERSISTÊNCIA
              </h2>
              <p className="text-xs text-[#e8d5b5]/70">
                Gerencie suas salas e itens publicados, edite novamente ou copie o SQL para o banco de dados.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#d4af37]/60 hover:text-[#ffd700] hover:bg-[#d4af37]/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#d4af37]/20 bg-[#14161f]">
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'rooms'
                ? 'border-[#ffd700] text-[#ffd700] bg-[#1c1f2b]'
                : 'border-transparent text-[#e8d5b5]/60 hover:text-[#e8d5b5] hover:bg-white/5'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Salas Publicadas</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#d4af37]/20 text-[#ffd700]">
              {publishedRooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'items'
                ? 'border-[#ffd700] text-[#ffd700] bg-[#1c1f2b]'
                : 'border-transparent text-[#e8d5b5]/60 hover:text-[#e8d5b5] hover:bg-white/5'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Itens, Avatares & Poses</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#d4af37]/20 text-[#ffd700]">
              {totalItemsCount}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#101217]">
          {/* TAB 1: SALAS PUBLICADAS */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs text-[#d4af37]">
                  {publishedRooms.length} {publishedRooms.length === 1 ? 'sala publicada' : 'salas publicadas'} na vitrine
                </span>
                <button
                  type="button"
                  onClick={loadRooms}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-xs rounded border border-[#d4af37]/40 text-[#ffd700] hover:bg-[#d4af37]/15 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {publishedRooms.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#d4af37]/30 bg-black/40 text-center">
                  <Box className="w-10 h-10 text-[#d4af37]/40 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-[#ffd700]">Nenhuma sala publicada ainda</h3>
                  <p className="text-xs text-[#e8d5b5]/70 max-w-md mx-auto mt-1">
                    Crie sua sala com objetos, spots e limite no editor e clique no botão dourado{' '}
                    <strong>"Publicar na Vitrine"</strong> no cabeçalho.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {publishedRooms.map((room) => {
                    const isCurrentlyActive = room.id === currentEditingRoomId;
                    const dateStr = room.created_at || room.editorRoom?.publishedAt || 'Recente';
                    const spotsCount = room.spots?.length || room.editorRoom?.spots?.length || 0;
                    const objectsCount = room.placed_objects?.length || room.editorRoom?.placedObjects?.length || 0;

                    return (
                      <div
                        key={room.id}
                        className={`p-4 rounded-xl border transition-all bg-[#161822] flex flex-col justify-between gap-3 ${
                          isCurrentlyActive
                            ? 'border-[#ffd700] ring-1 ring-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                            : 'border-[#d4af37]/40 hover:border-[#d4af37]'
                        }`}
                      >
                        <div className="flex gap-3">
                          <img
                            src={room.thumb || room.thumbnail_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80'}
                            alt={room.name}
                            className="w-20 h-20 rounded-lg object-cover border border-[#d4af37]/40 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-bold text-[#ffd700] truncate">{room.name}</h4>
                              {isCurrentlyActive && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold">
                                  No Editor
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#e8d5b5]/70 line-clamp-2 mt-0.5">
                              {room.description || 'Sala 3D customizada no Modo Criador.'}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-[#d4af37]/80 font-mono">
                              <span className="flex items-center gap-0.5">
                                <Box className="w-3 h-3" /> {objectsCount} objs
                              </span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" /> {spotsCount} spots
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-3 h-3" /> {new Date(dateStr).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#d4af37]/20">
                          <button
                            type="button"
                            onClick={() => {
                              // Reconstruct room state to load directly into the editor
                              const roomState: RoomEditorState = {
                                id: room.id,
                                name: room.name,
                                sceneAssetId: room.editorRoom?.sceneAssetId || room.sceneAssetId || null,
                                sceneAssetBlobUrl: room.editorRoom?.sceneAssetBlobUrl || room.sceneAssetBlobUrl,
                                placedObjects: room.placed_objects || room.editorRoom?.placedObjects || [],
                                spots: room.spots || room.editorRoom?.spots || [],
                                boundary: room.boundary || room.editorRoom?.boundary || {
                                  x: 10,
                                  y: 4,
                                  z: 10,
                                  isConfirmed: true,
                                },
                                isPublished: true,
                                publishedAt: room.created_at || room.editorRoom?.publishedAt,
                              };
                              onLoadRoomForEdit(roomState);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#d4af37] text-black text-xs font-bold hover:bg-[#ffd700] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Carregar esta sala no editor 3D para continuar editando"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Editar Novamente</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRoomToDelete(room)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-950/60 border border-transparent hover:border-red-500/40 transition-colors cursor-pointer"
                            title="Remover sala publicada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ITENS DA LOJA */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              <span className="text-xs text-[#d4af37] block pb-1">
                {totalItemsCount} {totalItemsCount === 1 ? 'item publicado' : 'itens publicados'} por você
              </span>

              {totalItemsCount === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#d4af37]/30 bg-black/40 text-center">
                  <ShoppingBag className="w-10 h-10 text-[#d4af37]/40 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-[#ffd700]">Nenhum item publicado ainda</h3>
                  <p className="text-xs text-[#e8d5b5]/70 max-w-md mx-auto mt-1">
                    Você pode publicar modelos GLB, acessórios ou poses personalizadas clicando com o botão direito
                    ou no ícone de Loja na aba "Itens".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {publishedAvatars.map((av) => (
                    <div
                      key={av.id}
                      className="p-3 rounded-xl border border-[#d4af37]/40 bg-[#161822] flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={av.thumb}
                          alt={av.name}
                          className="w-12 h-12 rounded-lg object-cover border border-[#d4af37]/40"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#ffd700] truncate block">{av.name}</span>
                          <span className="text-[10px] text-amber-300 font-mono">Avatar • {av.price} Moedas</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#d4af37]/20 text-[#ffd700] font-semibold block w-fit mt-0.5">
                            {av.rarity}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#d4af37]/20 text-xs">
                        <span className="text-[10px] text-[#e8d5b5]/60">Por {av.author || 'Luzenne'}</span>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ id: av.id, name: av.name, type: 'avatar' })}
                          className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/60 transition-colors"
                          title="Remover avatar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {publishedStoreItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-[#d4af37]/40 bg-[#161822] flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.thumb}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover border border-[#d4af37]/40"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#ffd700] truncate block">{item.name}</span>
                          <span className="text-[10px] text-amber-300 font-mono">
                            {item.category.toUpperCase()} • {item.price || 0} Moedas
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#d4af37]/20 text-[#ffd700] font-semibold block w-fit mt-0.5">
                            {item.rarity || 'COMUM'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#d4af37]/20 text-xs">
                        <span className="text-[10px] text-[#e8d5b5]/60">Código: {item.code}</span>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ id: item.id, name: item.name, type: 'item' })}
                          className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/60 transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {publishedPoses.map((pose) => (
                    <div
                      key={pose.id}
                      className="p-3 rounded-xl border border-[#d4af37]/40 bg-[#161822] flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-12 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-lg">
                          🎭
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#ffd700] truncate block">{pose.name}</span>
                          <span className="text-[10px] text-amber-300 font-mono">Pose • {pose.price || 0} Moedas</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#d4af37]/20 text-[#ffd700] font-semibold block w-fit mt-0.5">
                            {pose.rarity || 'RARO'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#d4af37]/20 text-xs">
                        <span className="text-[10px] text-[#e8d5b5]/60">Pose de Avatar</span>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ id: pose.id, name: pose.name, type: 'pose' })}
                          className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/60 transition-colors"
                          title="Remover pose"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Modal for Room Deletion */}
        {roomToDelete && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#171924] border border-red-500/50 rounded-xl p-5 max-w-sm w-full text-center space-y-3 shadow-2xl">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Remover Sala Publicada?</h3>
              <p className="text-xs text-zinc-300">
                Tem certeza que deseja remover <strong>"{roomToDelete.name}"</strong>? Ela será excluída da vitrine e
                do banco de dados.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoomToDelete(null)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-600 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRoom(roomToDelete.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md"
                >
                  Sim, Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Item Deletion */}
        {itemToDelete && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#171924] border border-red-500/50 rounded-xl p-5 max-w-sm w-full text-center space-y-3 shadow-2xl">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Remover Item Publicado?</h3>
              <p className="text-xs text-zinc-300">
                Tem certeza que deseja remover <strong>"{itemToDelete.name}"</strong>?
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-600 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(itemToDelete.id, itemToDelete.type)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md"
                >
                  Sim, Remover
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
