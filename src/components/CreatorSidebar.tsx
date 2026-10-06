import React, { useState } from 'react';
import {
  MapPin,
  FolderArchive,
  Plus,
  Upload,
  Armchair,
  Accessibility,
  Bed,
  Check,
  Sparkles,
  Box,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  GripHorizontal,
  ShoppingBag,
  Pencil,
  Play,
  Square,
  Activity,
  Repeat,
  Crosshair,
  Unlink,
  Link,
  Compass,
  Sliders,
  Download,
  Database,
  AlertTriangle,
  Layers,
  Edit3,
  Zap,
} from 'lucide-react';
import {
  InventoryItem,
  PlacedObject,
  SpotItem,
  SpotType,
  SpotMotionConfig,
  ObjectAction,
  MotionCurveTrajectory,
} from '../types';

interface CreatorSidebarProps {
  inventory: InventoryItem[];
  spots: SpotItem[];
  placedObjects?: PlacedObject[];
  selectedObjectId?: string | null;
  onSelectObjectId?: (id: string | null) => void;
  onRemoveObject?: (id: string) => void;
  onUpdateObjectType?: (id: string, type: 'cenario' | 'movel' | 'objeto' | 'avatar' | 'acessorio') => void;
  onUpdateObjectActions?: (objectId: string, actions: ObjectAction[]) => void;
  onToggleTestObjectAction?: (objectId: string, actionId: string | null) => void;
  onPauseTestObjectAction?: (objectId: string, actionId: string) => void;
  onResumeTestObjectAction?: (objectId: string, actionId: string) => void;
  testingObjectAction?: { objectId: string; actionId: string; isPaused?: boolean } | null;
  onOpenPublicationsModal?: () => void;
  publishedCount?: number;
  onOpenUploadModal: () => void;
  onInsertAssetToScene: (asset: InventoryItem) => void;
  onAddSpot: (type: SpotType, name: string) => void;
  onRemoveSpot: (spotId: string) => void;
  onClearAllSpots?: () => void;
  onRemoveOverlappingSpots?: () => void;
  onSelectSpot: (spot: SpotItem) => void;
  activeSpotId: string | null;
  insertionCursorPoint: [number, number, number] | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  customAvatarObjectId?: string | null;
  onSetCustomAvatarObjectId?: (id: string | null) => void;
  isAvatarMode?: boolean;
  sceneAssetBlobUrl?: string;
  sceneAssetName?: string;
  onRemoveScenario?: () => void;
  onPublishInventoryItem?: (item: InventoryItem) => void;
  onRenameInventoryItem?: (id: string, newName: string) => void;
  onRenamePlacedObject?: (id: string, newName: string) => void;
  onDeleteInventoryItem?: (itemId: string) => void;
  onDeleteMultipleInventoryItems?: (itemIds: string[]) => void;
  onClearAllInventory?: () => void;
  onOpenProjectModal?: () => void;
  onAddSpotAtObject?: (objectId: string) => void;
  onStartSurfaceSnap?: (objectId?: string | null) => void;
  onCancelSurfaceSnap?: () => void;
  isSurfaceSnapMode?: boolean;
  surfaceSnapTargetObjectId?: string | null;
  onUpdateSpotRotation?: (id: string, rotation: number) => void;
  onUpdateSpotRotationPitch?: (id: string, rotationPitch: number) => void;
  onCaptureObjectCoordinatesToSpot?: (spotId: string, objId: string) => void;
  onCaptureObjectRotationToSpot?: (spotId: string, objId: string) => void;
  onCaptureObjectScaleToSpot?: (spotId: string, objId: string) => void;
  onApplySpotCoordinatesToObject?: (spotId: string, objId: string) => void;
  onUpdateSpotMotion?: (spotId: string, motion: SpotMotionConfig | undefined) => void;
  onToggleTestSpotMotion?: (spotId: string) => void;
  testingMotionSpotId?: string | null;
  onDetachSpotFromObject?: (spotId: string) => void;
  onOpenSpotVisualConfig?: () => void;
  onOpenTrajectoryTimeline?: (spotId: string) => void;
  onAvatarTeleport?: (spotId: string) => void;
  avatarCurrentSpotId?: string | null;
  actionHistory?: ObjectAction[];
  onSaveActionToHistory?: (action: ObjectAction) => void;
  onRemoveActionFromHistory?: (historyId: string) => void;
  onApplyActionFromHistoryToObject?: (objectId: string, action: ObjectAction) => void;
}

export const CreatorSidebar: React.FC<CreatorSidebarProps> = ({
  inventory,
  spots,
  placedObjects = [],
  selectedObjectId = null,
  onSelectObjectId,
  onRemoveObject,
  onUpdateObjectType,
  onUpdateObjectActions,
  onToggleTestObjectAction,
  onPauseTestObjectAction,
  onResumeTestObjectAction,
  testingObjectAction = null,
  actionHistory = [],
  onSaveActionToHistory,
  onRemoveActionFromHistory,
  onApplyActionFromHistoryToObject,
  onOpenPublicationsModal,
  publishedCount,
  onOpenUploadModal,
  onInsertAssetToScene,
  onAddSpot,
  onRemoveSpot,
  onClearAllSpots,
  onRemoveOverlappingSpots,
  onSelectSpot,
  activeSpotId,
  insertionCursorPoint,
  isCollapsed = false,
  onToggleCollapse,
  customAvatarObjectId = null,
  onSetCustomAvatarObjectId,
  isAvatarMode = false,
  sceneAssetBlobUrl,
  sceneAssetName,
  onRemoveScenario,
  onPublishInventoryItem,
  onRenameInventoryItem,
  onRenamePlacedObject,
  onDeleteInventoryItem,
  onDeleteMultipleInventoryItems,
  onClearAllInventory,
  onOpenProjectModal,
  onAddSpotAtObject,
  onStartSurfaceSnap,
  onCancelSurfaceSnap,
  isSurfaceSnapMode = false,
  surfaceSnapTargetObjectId = null,
  onUpdateSpotRotation,
  onUpdateSpotRotationPitch,
  onCaptureObjectCoordinatesToSpot,
  onCaptureObjectRotationToSpot,
  onCaptureObjectScaleToSpot,
  onApplySpotCoordinatesToObject,
  onUpdateSpotMotion,
  onToggleTestSpotMotion,
  testingMotionSpotId = null,
  onDetachSpotFromObject,
  onOpenSpotVisualConfig,
  onOpenTrajectoryTimeline,
  onAvatarTeleport,
  avatarCurrentSpotId = null,
}) => {
  const [activeTab, setActiveTab] = useState<'spots' | 'objects' | 'actions' | 'inventory'>('spots');
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotType, setNewSpotType] = useState<SpotType>('sentar');
  const [newSpotName, setNewSpotName] = useState('');

  // Inventory Selection & Batch Deletion States
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState<boolean>(false);

  // Action creation / edit states
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionNameInput, setActionNameInput] = useState('');
  const [actionTrajInput, setActionTrajInput] = useState<MotionCurveTrajectory>('linear');
  const [actionDeltaPos, setActionDeltaPos] = useState<[number, number, number]>([0, 0, 2.0]);
  const [actionDeltaRot, setActionDeltaRot] = useState<[number, number, number]>([0, 360, 0]);
  const [actionTurnAngle, setActionTurnAngle] = useState(360);
  const [actionCurveRadius, setActionCurveRadius] = useState(2.0);
  const [actionCurveHeight, setActionCurveHeight] = useState(1.5);
  const [actionSpeed, setActionSpeed] = useState(1.0);
  const [actionLoop, setActionLoop] = useState(true);

  // Inline rename state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState<string>('');
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingObjectName, setEditingObjectName] = useState<string>('');

  // Delete inventory item confirmation state
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  const handleCreateSpot = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName =
      newSpotName.trim() ||
      (newSpotType === 'sentar'
        ? `Sofa ${spots.filter((s) => s.type === 'sentar').length + 1}`
        : newSpotType === 'pe'
        ? `Pé ${spots.filter((s) => s.type === 'pe').length + 1}`
        : `Deitar ${spots.filter((s) => s.type === 'deitar').length + 1}`);

    onAddSpot(newSpotType, finalName);
    setNewSpotName('');
    setIsAddingSpot(false);
  };

  // If sidebar is collapsed, render minimal vertical strip
  if (isCollapsed) {
    return (
      <aside className="relative w-12 bg-[#121317]/95 border-r border-[#d4af37]/30 flex flex-col items-center py-3 text-[#e8d5b5] select-none z-20 font-sans shadow-lg gap-4">
        {/* Expand Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg bg-[#d4af37]/20 border border-[#d4af37] text-[#ffd700] hover:bg-[#d4af37] hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-md"
          title="Expandir Barra Lateral"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Mini Tab Selectors that also expand sidebar */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#d4af37]/20 w-full px-1.5 items-center">
          <button
            type="button"
            onClick={() => {
              setActiveTab('spots');
              onToggleCollapse?.();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors cursor-pointer"
            title={`Spots (${spots.length})`}
          >
            <MapPin className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('objects');
              onToggleCollapse?.();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors cursor-pointer"
            title={`Objetos na sala (${placedObjects.length})`}
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('actions');
              onToggleCollapse?.();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer"
            title="Actions do Objeto"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('inventory');
              onToggleCollapse?.();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors cursor-pointer"
            title={`Inventário de Itens (${inventory.length})`}
          >
            <FolderArchive className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="relative w-64 md:w-72 bg-[#121317]/95 border-r border-[#d4af37]/30 flex flex-col h-full text-[#e8d5b5] select-none z-20 font-sans shadow-lg">
      {/* Minimize Button on edge (indicated by user arrow in Image 1) */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3.5 top-14 z-30 w-7 h-7 rounded-full bg-[#121317] border border-[#d4af37] text-[#ffd700] flex items-center justify-center hover:bg-[#d4af37] hover:text-black transition-all shadow-md cursor-pointer"
          title="Minimizar barra lateral (Expandir visualização 3D)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Top Tab Bar: [📍 SPOTS] | [🪑 OBJETOS (n)] | [⚡ ACTIONS] | [📦 ITENS (n)] */}
      <div className="grid grid-cols-4 border-b border-[#d4af37]/30 bg-[#0e0f13]">
        <button
          type="button"
          onClick={() => setActiveTab('spots')}
          className={`py-2.5 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
            activeTab === 'spots'
              ? 'border-[#d4af37] text-[#ffd700] bg-[#14151a]'
              : 'border-transparent text-[#d4af37]/60 hover:text-[#d4af37]'
          }`}
          title="Spots de avatar"
        >
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span>Spots</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('objects')}
          className={`py-2.5 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
            activeTab === 'objects'
              ? 'border-[#d4af37] text-[#ffd700] bg-[#14151a]'
              : 'border-transparent text-[#d4af37]/60 hover:text-[#d4af37]'
          }`}
          title="Objetos e móveis na sala"
        >
          <Box className="w-3 h-3 flex-shrink-0" />
          <span>Objs ({placedObjects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('actions')}
          className={`py-2.5 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
            activeTab === 'actions'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
              : 'border-transparent text-cyan-400/60 hover:text-cyan-300'
          }`}
          title="Criar, editar e testar actions de qualquer objeto"
        >
          <Activity className="w-3 h-3 flex-shrink-0 text-cyan-400" />
          <span>Actions</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`py-2.5 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
            activeTab === 'inventory'
              ? 'border-[#d4af37] text-[#ffd700] bg-[#14151a]'
              : 'border-transparent text-[#d4af37]/60 hover:text-[#d4af37]'
          }`}
          title="Arquivos e inventário 3D"
        >
          <FolderArchive className="w-3 h-3 flex-shrink-0" />
          <span>Itens</span>
        </button>
      </div>

      {/* Tab 1: SPOTS DA ROOM */}
      {activeTab === 'spots' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5">
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            <div className="flex items-center justify-between pb-1 text-xs text-[#d4af37]/80">
              <span className="font-semibold text-[#ffd700]">Spots da room ({spots.length})</span>
              <div className="flex items-center gap-1.5">
                {onOpenSpotVisualConfig && (
                  <button
                    type="button"
                    onClick={onOpenSpotVisualConfig}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-[#d4af37] hover:text-black border border-[#d4af37]/60 text-[10px] font-semibold text-[#ffd700] transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                    title="Configurar estilo das sinalizações (branca piscante, amarela, seta, tamanhos)"
                  >
                    <Sparkles className="w-3 h-3 text-[#ffd700]" />
                    <span>Sinalização</span>
                  </button>
                )}
                {spots.length > 0 && onRemoveOverlappingSpots && (
                  <button
                    type="button"
                    onClick={onRemoveOverlappingSpots}
                    className="px-2 py-0.5 rounded bg-[#1c1f28] hover:bg-[#d4af37] hover:text-black border border-[#d4af37]/40 text-[10px] font-semibold text-[#ffd700] transition-colors cursor-pointer"
                    title="Elimina spots que estão exatamente no mesmo local ou muito próximos"
                  >
                    Remover sobrepostos
                  </button>
                )}
                {spots.length > 0 && onClearAllSpots && (
                  <button
                    type="button"
                    onClick={onClearAllSpots}
                    className="px-1.5 py-0.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-[10px] text-red-300 transition-colors cursor-pointer"
                    title="Remover todos os spots da cena"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Quick Button for Surface Snap on 3D Objects */}
            {onStartSurfaceSnap && (
              <button
                type="button"
                onClick={() => {
                  if (isSurfaceSnapMode) {
                    onCancelSurfaceSnap?.();
                  } else {
                    onStartSurfaceSnap('any');
                  }
                }}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                  isSurfaceSnapMode
                    ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400/50 animate-pulse'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}
                title="Fixar spot com precisão na superfície de qualquer objeto 3D (esfera, sofá, cama, carro)"
              >
                <Crosshair className="w-4 h-4 text-amber-300" />
                <span>{isSurfaceSnapMode ? '🎯 Modo Superfície Ativo (Clique no Objeto)' : '🎯 + Spot na Superfície de Objeto'}</span>
              </button>
            )}

            {/* Surface Mode Helper Banner */}
            {isSurfaceSnapMode && (
              <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-400 text-xs text-amber-200 flex flex-col gap-1.5 shadow-md animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-amber-300 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Passe o mouse sobre o objeto 3D
                  </span>
                  {onCancelSurfaceSnap && (
                    <button
                      type="button"
                      onClick={onCancelSurfaceSnap}
                      className="px-2 py-0.5 rounded bg-black/70 hover:bg-black text-[10px] text-zinc-300 hover:text-white border border-zinc-600"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-amber-100/90 leading-tight">
                  Uma sombra circular seguirá a circunferência do objeto. Clique no ponto desejado para fixar o spot relativo!
                </p>
              </div>
            )}

            {spots.map((spot) => {
              const isSelected = activeSpotId === spot.id;
              const parentObj = spot.parentObjectId
                ? placedObjects.find((o) => o.id === spot.parentObjectId)
                : null;
              const isMotionActive = !!spot.motion?.enabled;
              const isTestingMotion = testingMotionSpotId === spot.id;

              return (
                <div
                  key={spot.id}
                  onClick={() => onSelectSpot(spot)}
                  className={`group flex flex-col gap-2 p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#ffd700] shadow-[0_0_12px_rgba(212,175,55,0.15)] ring-1 ring-[#d4af37]'
                      : 'border-[#d4af37]/25 hover:border-[#d4af37]/60 bg-black/40 text-[#e8d5b5]/85'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full border border-[#d4af37]/60 flex items-center justify-center flex-shrink-0 text-[#d4af37] bg-[#121317]">
                        {spot.type === 'sentar' ? (
                          <Armchair className="w-3.5 h-3.5" />
                        ) : spot.type === 'deitar' ? (
                          <Bed className="w-3.5 h-3.5" />
                        ) : (
                          <Accessibility className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold truncate block">{spot.name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {spot.parentObjectId && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-semibold flex items-center gap-0.5">
                              <Link className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[80px]">{parentObj?.name || 'Objeto'}</span>
                            </span>
                          )}
                          {isMotionActive && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold flex items-center gap-0.5">
                              <Activity className="w-2.5 h-2.5" />
                              <span>Motion ({spot.motion?.loop ? 'Loop' : '1x'})</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border border-[#d4af37]/30 text-[#d4af37]/80">
                        {spot.type === 'sentar' ? 'SENTAR' : spot.type === 'deitar' ? 'DEITAR' : 'PE'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSpot(spot.id);
                        }}
                        className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/80 transition-colors cursor-pointer"
                        title={`Excluir spot ${spot.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Config when Spot is Selected */}
                  {isSelected && (
                    <div
                      className="mt-2 pt-2 border-t border-[#d4af37]/30 space-y-2.5 text-xs text-[#e8d5b5]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* 1. Attachment / Relative Info */}
                      {spot.parentObjectId ? (
                        <div className="p-2 rounded bg-black/60 border border-amber-400/30 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-amber-300 font-bold block">
                              📍 Spot Relativo na Superfície
                            </span>
                            <span className="text-[10px] text-zinc-400 truncate block">
                              Fixado em: <strong className="text-white">{parentObj?.name || 'Objeto 3D'}</strong>
                            </span>
                            {spot.relativePosition && (
                              <span className="text-[9px] font-mono text-[#d4af37]/80 block">
                                Local: [{spot.relativePosition[0]}, {spot.relativePosition[1]}, {spot.relativePosition[2]}]
                              </span>
                            )}
                          </div>
                          {onDetachSpotFromObject && (
                            <button
                              type="button"
                              onClick={() => onDetachSpotFromObject(spot.id)}
                              className="px-2 py-1 rounded border border-zinc-600 hover:border-amber-400 bg-zinc-800 text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer flex-shrink-0"
                              title="Desvincular spot do objeto e torná-lo um spot fixo no chão"
                            >
                              <Unlink className="w-3 h-3" />
                              <span>Soltar</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-400 font-mono">
                          Mundo: X: {spot.position[0]}m · Y: {spot.position[1]}m · Z: {spot.position[2]}m
                        </div>
                      )}

                      {/* 1b. Orientação do Spot (Rotação Horizontal e Inclinação Vertical) */}
                      <div className="p-2.5 rounded-lg bg-black/60 border border-[#d4af37]/30 space-y-2">
                        <span className="text-[10px] text-[#ffd700] font-bold block">
                          Orientação do Spot (Rotação e Inclinação):
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex items-center justify-between text-[9px] text-zinc-300 mb-0.5">
                              <span>Horizontal (Yaw)</span>
                              <span className="font-mono text-[#ffd700]">{spot.rotation || 0}°</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="5"
                              value={spot.rotation || 0}
                              onChange={(e) => onUpdateSpotRotation?.(spot.id, parseInt(e.target.value) || 0)}
                              className="w-full accent-[#ffd700] h-1.5 bg-[#20222a] rounded cursor-pointer"
                              title="Girar para os lados (Yaw)"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[9px] text-zinc-300 mb-0.5">
                              <span>Vertical (Pitch)</span>
                              <span className="font-mono text-cyan-300">{spot.rotationPitch || 0}°</span>
                            </div>
                            <input
                              type="range"
                              min="-90"
                              max="90"
                              step="5"
                              value={spot.rotationPitch || 0}
                              onChange={(e) => onUpdateSpotRotationPitch?.(spot.id, parseInt(e.target.value) || 0)}
                              className="w-full accent-cyan-400 h-1.5 bg-[#20222a] rounded cursor-pointer"
                              title="Inclinar para cima ou para baixo (Pitch)"
                            />
                          </div>
                        </div>

                        {/* Coordenadas para Teste da Room */}
                        {(spot.targetRotation || spot.targetScale || selectedObjectId) && (
                          <div className="pt-2 border-t border-[#d4af37]/20 space-y-1.5">
                            <span className="text-[9px] text-zinc-400 block font-semibold">
                              Coordenadas de Teste da Room:
                            </span>
                            {spot.targetRotation && (
                              <div className="text-[9px] font-mono text-cyan-300 bg-black/80 px-1.5 py-0.5 rounded border border-cyan-400/30 truncate">
                                Rotação Alvo: [{spot.targetRotation.map((r) => ((r * 180) / Math.PI).toFixed(0) + '°').join(', ')}]
                              </div>
                            )}
                            {spot.targetScale && (
                              <div className="text-[9px] font-mono text-purple-300 bg-black/80 px-1.5 py-0.5 rounded border border-purple-400/30 truncate">
                                Escala Alvo: [{spot.targetScale.map((s) => s.toFixed(2)).join(', ')}]
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {selectedObjectId && onCaptureObjectCoordinatesToSpot && (
                                <button
                                  type="button"
                                  onClick={() => onCaptureObjectCoordinatesToSpot(spot.id, selectedObjectId)}
                                  className="px-2 py-1 rounded bg-[#d4af37]/20 hover:bg-[#d4af37] text-[#ffd700] hover:text-black border border-[#d4af37]/50 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                  title="Capturar rotação e escala do objeto selecionado para este spot"
                                >
                                  <span>📐 Gravar Rotação/Escala do Objeto</span>
                                </button>
                              )}
                              {selectedObjectId && onApplySpotCoordinatesToObject && (
                                <button
                                  type="button"
                                  onClick={() => onApplySpotCoordinatesToObject(spot.id, selectedObjectId)}
                                  className="px-2 py-1 rounded bg-cyan-950/70 hover:bg-cyan-700 text-cyan-300 hover:text-white border border-cyan-400/50 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                  title="Aplicar coordenadas deste spot diretamente no objeto"
                                >
                                  <span>🎯 Aplicar no Objeto</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Motion Spot Section */}
                      <div className="p-2.5 rounded-lg bg-[#14161f] border border-[#d4af37]/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-[#ffd700]" />
                            <span className="text-xs font-bold text-[#ffd700]">Motion Spot</span>
                            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-400/40 px-1.5 py-0.5 rounded font-bold">
                              👻 Fantasma
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isMotionActive) {
                                onUpdateSpotMotion?.(spot.id, undefined);
                                if (onToggleTestSpotMotion && testingMotionSpotId === spot.id) {
                                  onToggleTestSpotMotion(spot.id);
                                }
                              } else {
                                const newMotion: SpotMotionConfig = {
                                  enabled: true,
                                  deltaPosition: [0, 0, 3],
                                  deltaRotation: [0, 0, 0],
                                  speed: 1.0,
                                  loop: true,
                                  showGhostSpot: true,
                                  target: spot.parentObjectId ? 'parent_object' : 'avatar',
                                };
                                onUpdateSpotMotion?.(spot.id, newMotion);
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-black border-2 transition-all cursor-pointer shadow-md ${
                              isMotionActive
                                ? 'bg-cyan-400 text-black border-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                                : 'bg-[#20222a] text-zinc-200 border-zinc-500 hover:text-white hover:border-zinc-300'
                            }`}
                          >
                            {isMotionActive ? '✓ LIGADO (PARAR / DESATIVAR)' : 'LIGAR MOTION'}
                          </button>
                        </div>

                        {/* Spot Fantasma Concept Explanation Banner */}
                        <div className="p-2 rounded-lg bg-cyan-950/70 border border-cyan-400/40 text-cyan-200 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                            <span className="text-sm">👻</span>
                            <span>Spot Fantasma em Movimento</span>
                          </div>
                          <p className="text-[10px] text-cyan-100/90 leading-relaxed">
                            O spot original fica <strong>fixo no centro da base</strong>, enquanto o <strong>Spot Fantasma</strong> se desloca na direção configurada a partir dele em tempo real!
                          </p>
                        </div>

                        {isMotionActive && spot.motion && (
                          <div className="space-y-2.5 pt-1.5 border-t border-[#d4af37]/20">
                            {/* Quick Presets */}
                            <div>
                              <span className="text-[10px] text-[#d4af37]/80 block mb-1">Predefinições rápidas de direção:</span>
                              <div className="grid grid-cols-2 gap-1 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      deltaPosition: [0, 0, 3.0],
                                      curveTrajectory: 'linear',
                                      loop: true,
                                    })
                                  }
                                  className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left truncate cursor-pointer text-cyan-300"
                                >
                                  ⏩ Ir para Frente (+3m)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      deltaPosition: [0, 0, -3.0],
                                      curveTrajectory: 'linear',
                                      loop: true,
                                    })
                                  }
                                  className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left truncate cursor-pointer text-cyan-300"
                                >
                                  ⏪ Ir para Trás (-3m)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      deltaPosition: [2.5, 0, 0],
                                      curveTrajectory: 'linear',
                                      loop: true,
                                    })
                                  }
                                  className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left truncate cursor-pointer text-amber-200"
                                >
                                  ↔️ Lateral Vai e Vem
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      deltaPosition: [0, 2.5, 0],
                                      curveTrajectory: 'linear',
                                      loop: true,
                                    })
                                  }
                                  className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left truncate cursor-pointer text-emerald-300"
                                >
                                  🛗 Elevador (+2.5m Cima)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      deltaPosition: [0, 0, 0],
                                      deltaRotation: [0, 360, 0],
                                      turnAngle: 360,
                                      curveTrajectory: 'circle_turn',
                                      curveRadius: 2.0,
                                      scaleFactor: 1.0,
                                      loop: true,
                                      speed: 1.0,
                                    })
                                  }
                                  className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left truncate cursor-pointer text-amber-200"
                                >
                                  🔄 Fazer Volta (360° Y)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      deltaPosition: [0, 3.0, 0],
                                      deltaRotation: [25, 360, 0],
                                      turnAngle: 360,
                                      curveTrajectory: 'spiral',
                                      curveRadius: 1.5,
                                      scaleFactor: 1.0,
                                      loop: true,
                                      speed: 1.0,
                                    })
                                  }
                                  className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left truncate cursor-pointer text-cyan-200"
                                >
                                  🚀 Subir em Espiral
                                </button>
                              </div>
                            </div>

                            {/* Trajectory / Curve Type */}
                            <div className="pt-1">
                              <label className="text-[10px] text-zinc-400 block mb-1">
                                Tipo de Trajetória / Curva:
                              </label>
                              <select
                                value={spot.motion.curveTrajectory || 'linear'}
                                onChange={(e) =>
                                  onUpdateSpotMotion?.(spot.id, {
                                    ...spot.motion!,
                                    curveTrajectory: e.target.value as any,
                                  })
                                }
                                className="w-full bg-black/80 border border-[#d4af37]/40 rounded px-2 py-1 text-xs text-[#ffd700] outline-none"
                              >
                                <option value="linear">📏 Reta Direta (Linear)</option>
                                <option value="circle_turn">🔄 Fazer Volta Circular (Curva em Raio)</option>
                                <option value="spiral">🚀 Subir em Curva (Espiral / Rotação para Cima)</option>
                                <option value="arc">🎢 Curva em Arco (Salto Parabólico)</option>
                                <option value="wave">〰️ Ondulação / Senoide (Flutuação)</option>
                              </select>
                            </div>

                            {/* Turn Angle and Radius for Circle & Spiral */}
                            {(spot.motion.curveTrajectory === 'circle_turn' ||
                              spot.motion.curveTrajectory === 'spiral' ||
                              (spot.motion.turnAngle !== undefined && spot.motion.turnAngle > 0)) && (
                              <div className="grid grid-cols-2 gap-2 pt-1 p-2 rounded bg-black/50 border border-cyan-400/30">
                                <div>
                                  <label className="text-[9px] text-cyan-300 block">Ângulo da Volta (°)</label>
                                  <input
                                    type="number"
                                    step="15"
                                    value={spot.motion.turnAngle !== undefined ? spot.motion.turnAngle : 360}
                                    onChange={(e) =>
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        turnAngle: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full bg-black border border-cyan-400/40 rounded px-1.5 py-0.5 text-xs text-cyan-200"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-cyan-300 block">Raio da Volta (m)</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    value={spot.motion.curveRadius !== undefined ? spot.motion.curveRadius : 2.0}
                                    onChange={(e) =>
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        curveRadius: Math.max(0.2, parseFloat(e.target.value) || 2.0),
                                      })
                                    }
                                    className="w-full bg-black border border-cyan-400/40 rounded px-1.5 py-0.5 text-xs text-cyan-200"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Arc Height */}
                            {spot.motion.curveTrajectory === 'arc' && (
                              <div className="pt-1 p-2 rounded bg-black/50 border border-emerald-400/30">
                                <label className="text-[9px] text-emerald-300 block">Altura da Curva em Arco (m)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={spot.motion.curveHeight !== undefined ? spot.motion.curveHeight : 2.0}
                                  onChange={(e) =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      curveHeight: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full bg-black border border-emerald-400/40 rounded px-1.5 py-0.5 text-xs text-emerald-200"
                                />
                              </div>
                            )}

                            {/* Coordinate Deltas (Directional relative to spot facing) */}
                            <div>
                              <span className="text-[10px] text-cyan-300 font-bold block mb-1">
                                Direção do Deslocamento 3D (a partir do centro do Spot):
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div>
                                  <label className="text-[9px] text-zinc-300 block font-semibold" title="Deslocamento para Frente (+) ou para Trás (-)">
                                    Frente / Trás (Z)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={spot.motion.deltaPosition[2]}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        deltaPosition: [spot.motion!.deltaPosition[0], spot.motion!.deltaPosition[1], val],
                                      });
                                    }}
                                    className="w-full bg-black/60 border border-cyan-400/50 rounded px-1.5 py-0.5 text-xs text-cyan-300 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-zinc-300 block font-semibold" title="Deslocamento para Direita (+) ou Esquerda (-)">
                                    Direita / Esq (X)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={spot.motion.deltaPosition[0]}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        deltaPosition: [val, spot.motion!.deltaPosition[1], spot.motion!.deltaPosition[2]],
                                      });
                                    }}
                                    className="w-full bg-black/60 border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-xs text-[#ffd700]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-zinc-300 block font-semibold" title="Elevador / Subida Y (Cima / Baixo)">
                                    Elevador Y (m)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={spot.motion.deltaPosition[1]}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        deltaPosition: [spot.motion!.deltaPosition[0], val, spot.motion!.deltaPosition[2]],
                                      });
                                    }}
                                    className="w-full bg-black/60 border border-emerald-400/40 rounded px-1.5 py-0.5 text-xs text-emerald-300 font-bold"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Rotation Deltas [Rot X, Rot Y, Rot Z] */}
                            <div>
                              <span className="text-[10px] text-zinc-400 block mb-1">Rotação / Inclinação (Graus):</span>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div>
                                  <label className="text-[9px] text-zinc-400 block" title="Inclinação para cima ou para baixo">Rot X (°)</label>
                                  <input
                                    type="number"
                                    step="15"
                                    value={spot.motion.deltaRotation?.[0] || 0}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const cur = spot.motion!.deltaRotation || [0, 0, 0];
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        deltaRotation: [val, cur[1], cur[2]],
                                      });
                                    }}
                                    className="w-full bg-black/60 border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-xs text-[#ffd700]"
                                    title="Rotação no eixo X (inclinação para cima/baixo)"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-zinc-400 block" title="Giro no eixo lateral">Rot Y (°)</label>
                                  <input
                                    type="number"
                                    step="15"
                                    value={spot.motion.deltaRotation?.[1] || 0}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const cur = spot.motion!.deltaRotation || [0, 0, 0];
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        deltaRotation: [cur[0], val, cur[2]],
                                      });
                                    }}
                                    className="w-full bg-black/60 border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-xs text-[#ffd700]"
                                    title="Rotação no eixo Y (giro lateral)"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-zinc-400 block" title="Inclinação lateral (roll)">Rot Z (°)</label>
                                  <input
                                    type="number"
                                    step="15"
                                    value={spot.motion.deltaRotation?.[2] || 0}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const cur = spot.motion!.deltaRotation || [0, 0, 0];
                                      onUpdateSpotMotion?.(spot.id, {
                                        ...spot.motion!,
                                        deltaRotation: [cur[0], cur[1], val],
                                      });
                                    }}
                                    className="w-full bg-black/60 border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-xs text-[#ffd700]"
                                    title="Rotação no eixo Z (inclinação lateral)"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Scale Motion Factor */}
                            <div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400">Motion de Escala (Pulsar/Crescer):</span>
                                <span className="text-[#ffd700] font-mono">
                                  {(spot.motion.scaleFactor !== undefined ? spot.motion.scaleFactor : 1.0).toFixed(2)}x
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="2.5"
                                step="0.1"
                                value={spot.motion.scaleFactor !== undefined ? spot.motion.scaleFactor : 1.0}
                                onChange={(e) =>
                                  onUpdateSpotMotion?.(spot.id, {
                                    ...spot.motion!,
                                    scaleFactor: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full accent-purple-400 h-1.5 bg-black rounded-lg cursor-pointer"
                              />
                            </div>

                            {/* Speed Slider */}
                            <div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400">Velocidade:</span>
                                <span className="text-[#ffd700] font-mono">{spot.motion.speed.toFixed(1)}x</span>
                              </div>
                              <input
                                type="range"
                                min="0.2"
                                max="4.0"
                                step="0.2"
                                value={spot.motion.speed}
                                onChange={(e) => {
                                  onUpdateSpotMotion?.(spot.id, {
                                    ...spot.motion!,
                                    speed: parseFloat(e.target.value),
                                  });
                                }}
                                className="w-full accent-[#ffd700] h-1.5 bg-black rounded-lg cursor-pointer"
                              />
                            </div>

                            {/* Loop & Target */}
                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateSpotMotion?.(spot.id, {
                                    ...spot.motion!,
                                    loop: !spot.motion!.loop,
                                  })
                                }
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                                  spot.motion.loop
                                    ? 'bg-[#d4af37]/20 border-[#ffd700] text-[#ffd700]'
                                    : 'bg-black/50 border-zinc-600 text-zinc-400'
                                }`}
                              >
                                <Repeat className="w-3 h-3" />
                                <span>{spot.motion.loop ? 'Loop Contínuo' : 'Executar 1x'}</span>
                              </button>

                              {/* Ghost Spot Visibility Toggle */}
                              <div className="flex items-center justify-between p-1.5 rounded bg-black/50 border border-cyan-400/30 text-[10px]">
                                <span className="text-cyan-200 font-semibold flex items-center gap-1">
                                  <span>👻</span>
                                  <span>Spot Fantasma no Cenário:</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSpotMotion?.(spot.id, {
                                      ...spot.motion!,
                                      showGhostSpot: spot.motion?.showGhostSpot !== false ? false : true,
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded text-[9px] font-black border transition-colors cursor-pointer ${
                                    spot.motion?.showGhostSpot !== false
                                      ? 'bg-cyan-500 text-black border-cyan-300'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  }`}
                                >
                                  {spot.motion?.showGhostSpot !== false ? '✓ VISÍVEL' : 'OCULTO'}
                                </button>
                              </div>

                              {/* Position Avatar on Spot Button */}
                              {onAvatarTeleport && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAvatarTeleport(spot.id);
                                  }}
                                  className={`w-full py-1.5 px-2 rounded text-[10px] font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                                    avatarCurrentSpotId === spot.id
                                      ? 'bg-emerald-900/70 border-emerald-400 text-emerald-200'
                                      : 'bg-black/60 border-[#ffd700]/50 hover:bg-[#ffd700]/20 text-[#ffd700]'
                                  }`}
                                  title="Posicionar e animar o avatar na trajetória deste spot em tempo real"
                                >
                                  <span>🚶</span>
                                  <span>
                                    {avatarCurrentSpotId === spot.id
                                      ? '✓ Avatar no Spot (Acompanhando Trajetória)'
                                      : 'Posicionar Avatar neste Spot'}
                                  </span>
                                </button>
                              )}

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Open Trajectory Timeline Scrubber Modal */}
                                {onOpenTrajectoryTimeline && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenTrajectoryTimeline(spot.id);
                                    }}
                                    className="px-2.5 py-1.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer bg-purple-900/60 hover:bg-purple-800 border border-purple-500/50 text-purple-200 shadow-sm"
                                    title="Abrir linha do tempo estilo edição de vídeo para ajustar trajetória"
                                  >
                                    <Sliders className="w-3 h-3 text-purple-300" />
                                    <span>Trajetória 3D</span>
                                  </button>
                                )}

                                {/* Play / Test Button */}
                                {onToggleTestSpotMotion && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleTestSpotMotion(spot.id)}
                                    className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                                      isTestingMotion
                                        ? 'bg-cyan-400 text-black ring-2 ring-cyan-200 animate-pulse font-black'
                                        : 'bg-cyan-700 hover:bg-cyan-600 text-white'
                                    }`}
                                    title="Focar e destacar o Spot Fantasma no cenário 3D"
                                  >
                                    {isTestingMotion ? (
                                      <>
                                        <Square className="w-3.5 h-3.5 fill-black" />
                                        <span>Focando Fantasma (Ativo)</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3.5 h-3.5 fill-white" />
                                        <span>Focar Spot Fantasma</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Add Form or Trigger Button */}
            {isAddingSpot ? (
              <form
                onSubmit={handleCreateSpot}
                className="mt-3 p-3 rounded-lg border border-[#d4af37]/50 bg-black/60 space-y-2.5 animate-fade-in"
              >
                <div className="flex items-center justify-between text-xs text-[#d4af37]">
                  <span className="font-semibold">Novo Spot</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingSpot(false)}
                    className="text-[#d4af37]/60 hover:text-[#d4af37]"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['pe', 'sentar', 'deitar'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewSpotType(t)}
                      className={`py-1 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                        newSpotType === t
                          ? 'bg-[#d4af37] text-black border-[#d4af37]'
                          : 'border-[#d4af37]/40 text-[#e8d5b5]/80 hover:border-[#d4af37]'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Nome do spot (opcional)"
                  value={newSpotName}
                  onChange={(e) => setNewSpotName(e.target.value)}
                  className="w-full bg-[#16181e] border border-[#d4af37]/40 rounded px-2.5 py-1.5 text-xs text-[#e8d5b5] placeholder:text-[#e8d5b5]/30 outline-none"
                />

                <button
                  type="submit"
                  className="w-full py-1.5 rounded bg-[#d4af37] text-black text-xs font-semibold tracking-wide hover:bg-[#e2bd44] cursor-pointer"
                >
                  Salvar Spot
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingSpot(true)}
                className="w-full mt-3 py-2 rounded-lg border border-[#d4af37]/40 hover:border-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 text-[#d4af37] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar spot</span>
              </button>
            )}
          </div>

          {/* Footer note matching screenshot */}
          <div className="pt-3 border-t border-[#d4af37]/20 text-[10px] text-[#d4af37]/70 leading-tight">
            Clique no spot na room = avatar teleporta para esta posição.
          </div>
        </div>
      )}

      {/* Tab 2: OBJETOS NA SALA */}
      {activeTab === 'objects' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5">
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            <div className="flex items-center justify-between pb-1 text-xs text-[#d4af37]/80">
              <span className="font-semibold text-[#d4af37]">Objetos na cena</span>
              <span className="text-[11px] font-mono">
                {placedObjects.length + (sceneAssetBlobUrl ? 1 : 0)} itens
              </span>
            </div>

            {/* Surface Snap Mode Active Notification */}
            {isSurfaceSnapMode && (
              <div className="p-2.5 rounded-lg border-2 border-amber-400 bg-amber-950/50 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-md animate-pulse">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Crosshair className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="truncate text-[11px] font-semibold">
                    Clique na superfície 3D do objeto para fixar o spot!
                  </span>
                </div>
                {onCancelSurfaceSnap && (
                  <button
                    type="button"
                    onClick={onCancelSurfaceSnap}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold border border-zinc-600 cursor-pointer"
                  >
                    Sair
                  </button>
                )}
              </div>
            )}

            {/* If room has custom scenario model, show it prominently so user sees their 3D scene and can select with Gizmo! */}
            {sceneAssetBlobUrl && (() => {
              const scenarioObj = placedObjects.find(
                (o) => o.type === 'cenario' || (sceneAssetBlobUrl && o.fileBlobUrl === sceneAssetBlobUrl)
              );
              const isScenarioSelected = scenarioObj ? selectedObjectId === scenarioObj.id : false;

              return (
                <div
                  onClick={() => {
                    if (scenarioObj) {
                      onSelectObjectId?.(scenarioObj.id);
                    }
                  }}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 mb-2 ${
                    isScenarioSelected
                      ? 'border-[#ffd700] bg-[#ffd700]/15 text-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.35)] ring-1 ring-[#ffd700]'
                      : 'border-[#ffd700]/70 hover:border-[#ffd700] bg-[#161822] text-[#e8d5b5]'
                  }`}
                  title="Clique para selecionar o Cenário 3D da Sala e ativar o Gizmo de transformação"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded border border-[#ffd700] bg-[#ffd700]/20 flex items-center justify-center text-base flex-shrink-0">
                        🏛️
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#ffd700] truncate">
                            {sceneAssetName || scenarioObj?.name || 'Cenário 3D da Sala'}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#ffd700] text-black font-bold uppercase">
                            Cenário
                          </span>
                        </div>
                        <span className="text-[10px] text-[#e8d5b5]/70 block font-mono">
                          {isScenarioSelected
                            ? '✓ Selecionado (Gizmo Ativo na Sala)'
                            : 'Clique para selecionar com Gizmo (Teto ~2.8m)'}
                        </span>
                      </div>
                    </div>
                    {onRemoveScenario && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveScenario();
                        }}
                        className="p-1.5 rounded text-red-400 hover:text-red-200 hover:bg-red-950/80 border border-transparent hover:border-red-500/50 transition-colors cursor-pointer text-xs"
                        title="Remover este cenário 3D da sala"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {placedObjects.length === 0 && !sceneAssetBlobUrl ? (
              <div className="p-4 rounded-lg border border-dashed border-[#d4af37]/30 bg-black/40 text-center text-xs text-[#e8d5b5]/60 mt-4">
                <Box className="w-8 h-8 text-[#d4af37]/40 mx-auto mb-2" />
                <p>Nenhum objeto na sala.</p>
                <p className="text-[10px] text-[#d4af37]/60 mt-1">
                  Vá na aba "Itens" ou envie um arquivo GLB para inserir móveis.
                </p>
              </div>
            ) : (
              placedObjects
                .filter(
                  (obj) =>
                    !(sceneAssetBlobUrl && (obj.type === 'cenario' || obj.fileBlobUrl === sceneAssetBlobUrl))
                )
                .map((obj) => {
                const isSelected = selectedObjectId === obj.id;
                const isAvatarType = obj.type === 'avatar' || obj.isAvatar;
                const isCustomAvatar = customAvatarObjectId === obj.id;

                const handleObjectClick = () => {
                  onSelectObjectId?.(obj.id);
                  // If in Avatar mode and this object is an avatar, make it the active controlled avatar!
                  if (isAvatarMode && isAvatarType) {
                    onSetCustomAvatarObjectId?.(obj.id);
                  }
                };

                return (
                  <div
                    key={obj.id}
                    onClick={handleObjectClick}
                    className={`group flex flex-col gap-2 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#ffd700] shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                        : isCustomAvatar
                        ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                        : isAvatarType
                        ? 'border-purple-500/40 bg-purple-950/20 text-[#e8d5b5]'
                        : 'border-[#d4af37]/25 hover:border-[#d4af37]/60 bg-black/40 text-[#e8d5b5]/85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          {isAvatarType && (
                            <input
                              type="checkbox"
                              checked={isCustomAvatar}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => onSetCustomAvatarObjectId?.(isCustomAvatar ? null : obj.id)}
                              className="w-3.5 h-3.5 accent-[#ffd700] rounded cursor-pointer transition-transform hover:scale-110"
                              title={
                                isCustomAvatar
                                  ? 'Avatar selecionado para teste (clique para desmarcar)'
                                  : 'Marcar este avatar para teste (desmarcará o avatar anterior)'
                              }
                            />
                          )}
                          <div
                            className={`w-7 h-7 rounded border flex items-center justify-center flex-shrink-0 ${
                              isAvatarType
                                ? 'border-[#ffd700] text-[#ffd700] bg-amber-950/50'
                                : 'border-[#d4af37]/50 text-[#d4af37] bg-[#121317]'
                            }`}
                          >
                            {isAvatarType ? (
                              <User className="w-4 h-4 text-[#ffd700]" />
                            ) : obj.modelType === 'sofa' || obj.name.toLowerCase().includes('sofa') ? (
                              <Armchair className="w-4 h-4" />
                            ) : obj.name.toLowerCase().includes('cama') || obj.name.toLowerCase().includes('bed') ? (
                              <Bed className="w-4 h-4" />
                            ) : (
                              <Box className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          {editingObjectId === obj.id ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                autoFocus
                                value={editingObjectName}
                                onChange={(e) => setEditingObjectName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingObjectName.trim()) {
                                      onRenamePlacedObject?.(obj.id, editingObjectName.trim());
                                    }
                                    setEditingObjectId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingObjectId(null);
                                  }
                                }}
                                className="w-full bg-[#181a24] border border-[#ffd700] rounded px-1.5 py-0.5 text-xs text-[#ffd700] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingObjectName.trim()) {
                                    onRenamePlacedObject?.(obj.id, editingObjectName.trim());
                                  }
                                  setEditingObjectId(null);
                                }}
                                className="p-1 rounded bg-[#ffd700] text-black hover:bg-amber-300 cursor-pointer flex-shrink-0"
                                title="Salvar nome"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate block max-w-[140px]">
                                {obj.name}
                              </span>
                              {onRenamePlacedObject && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingObjectId(obj.id);
                                    setEditingObjectName(obj.name);
                                  }}
                                  className="p-0.5 rounded text-[#d4af37]/50 hover:text-[#ffd700] hover:bg-[#d4af37]/20 transition-colors cursor-pointer"
                                  title="Renomear este objeto na cena"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomAvatar && (
                                <span className="text-[9px] font-bold bg-[#ffd700] text-black px-1.5 py-0.2 rounded shadow-sm animate-pulse">
                                  ⭐ Ativo
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] font-mono text-[#d4af37]/75">
                            X: {obj.position[0].toFixed(2)}m · Z: {obj.position[2].toFixed(2)}m
                          </span>
                        </div>
                      </div>

                      {/* Actions: Set as Active Avatar & Trash Icon */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onStartSurfaceSnap && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSurfaceSnapMode && surfaceSnapTargetObjectId === obj.id) {
                                onCancelSurfaceSnap?.();
                              } else {
                                onStartSurfaceSnap(obj.id);
                              }
                            }}
                            className={`p-1 px-1.5 rounded transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 shadow-sm active:scale-95 border ${
                              isSurfaceSnapMode && surfaceSnapTargetObjectId === obj.id
                                ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400 animate-pulse'
                                : 'bg-[#d4af37]/20 hover:bg-[#d4af37] text-[#ffd700] hover:text-black border-[#d4af37]/60'
                            }`}
                            title={`Anexar spot relativo na superfície de "${obj.name}". Mova o mouse sobre a geometria do objeto 3D e clique para fixar o spot na superfície!`}
                          >
                            <Crosshair className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {isSurfaceSnapMode && surfaceSnapTargetObjectId === obj.id
                                ? 'Fixando...'
                                : 'Spot Superfície'}
                            </span>
                          </button>
                        )}

                        {onAddSpotAtObject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddSpotAtObject(obj.id);
                            }}
                            className="p-1 px-1.5 rounded bg-[#ffd700]/15 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/50 transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 shadow-sm active:scale-95"
                            title={`Criar spot fixo nas coordenadas de "${obj.name}". O spot permanecerá mesmo se você remover o objeto depois!`}
                          >
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span>+ Spot</span>
                          </button>
                        )}

                        {/* Avatar Test Checkbox & Button (Caixa de marcação para teste) */}
                        <div className="flex flex-col items-center justify-center gap-0.5" title="Marcar este avatar para teste na sala">
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 cursor-pointer select-none px-1 py-0.5 rounded hover:bg-black/40"
                            title={
                              isCustomAvatar
                                ? 'Avatar marcado para teste (clique para desmarcar)'
                                : 'Marcar este avatar especificamente para teste'
                            }
                          >
                            <input
                              type="checkbox"
                              checked={isCustomAvatar}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isCustomAvatar) {
                                  onSetCustomAvatarObjectId?.(null);
                                } else {
                                  if (!isAvatarType && onUpdateObjectType) {
                                    onUpdateObjectType(obj.id, 'avatar');
                                  }
                                  onSetCustomAvatarObjectId?.(obj.id);
                                }
                              }}
                              className="w-3 h-3 accent-[#ffd700] rounded cursor-pointer"
                            />
                            <span className={`text-[8px] font-bold uppercase tracking-wider ${isCustomAvatar ? 'text-[#ffd700]' : 'text-zinc-500'}`}>
                              {isCustomAvatar ? 'Teste' : 'Testar'}
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCustomAvatar) {
                                onSetCustomAvatarObjectId?.(null);
                              } else {
                                if (!isAvatarType && onUpdateObjectType) {
                                  onUpdateObjectType(obj.id, 'avatar');
                                }
                                onSetCustomAvatarObjectId?.(obj.id);
                              }
                            }}
                            className={`p-1.5 rounded transition-colors cursor-pointer text-xs ${
                              isCustomAvatar
                                ? 'bg-[#d4af37] text-black ring-1 ring-[#ffd700]'
                                : 'text-[#d4af37]/70 hover:text-[#ffd700] hover:bg-[#d4af37]/20 border border-transparent hover:border-[#d4af37]/40'
                            }`}
                            title={
                              isCustomAvatar
                                ? 'Avatar marcado para teste na cena. Clique para desmarcar.'
                                : 'Definir este item como avatar interativo (controlado pelos spots)'
                            }
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveObject?.(obj.id);
                          }}
                          className="p-1.5 rounded text-red-400 hover:text-red-200 hover:bg-red-950/80 border border-transparent hover:border-red-500/60 transition-colors cursor-pointer"
                          title={`Excluir ${obj.name} da sala`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Type Selector (Móvel | Objeto | Avatar) */}
                    {onUpdateObjectType && (
                      <div className="flex items-center gap-1 pt-1 border-t border-[#d4af37]/15">
                        <span className="text-[9px] uppercase tracking-wider text-[#d4af37]/60 mr-1">
                          Tipo:
                        </span>
                        {(['movel', 'objeto', 'avatar', 'acessorio'] as const).map((t) => {
                          const isActive =
                            (t === 'avatar' && (obj.type === 'avatar' || obj.isAvatar)) ||
                            (t === 'acessorio' && (obj.type === 'acessorio' || obj.isAccessory)) ||
                            (t !== 'avatar' && t !== 'acessorio' && obj.type === t && !obj.isAvatar && !obj.isAccessory);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateObjectType(obj.id, t);
                                if (t === 'avatar' && isAvatarMode) {
                                  onSetCustomAvatarObjectId?.(obj.id);
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                                isActive
                                  ? t === 'avatar'
                                    ? 'bg-[#ffd700] text-black font-bold shadow-sm'
                                    : t === 'acessorio'
                                    ? 'bg-amber-400 text-black font-bold shadow-sm'
                                    : 'bg-[#d4af37] text-black font-bold'
                                  : 'bg-black/40 text-[#e8d5b5]/60 hover:text-white border border-[#d4af37]/20'
                              }`}
                            >
                              {t === 'avatar' ? '👤 Avatar' : t === 'acessorio' ? '👑 Acessório' : t}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Action Button & Indicator on each placed object card */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#d4af37]/15 text-[10px]">
                      <span className="text-zinc-400 font-mono">
                        {obj.actions?.length || 0} action(s)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectObjectId?.(obj.id);
                          setActionTargetId(obj.id);
                          setActiveTab('actions');
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-400/50 font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer"
                        title="Abrir e gerenciar Actions deste objeto"
                      >
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <span>⚡ Actions ({obj.actions?.length || 0})</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-[#d4af37]/20 text-[10px] text-[#d4af37]/70 leading-tight">
            Clique no objeto para abrir o gizmo de ajuste fino, no ícone de avatar para torná-lo o avatar controlado na cena, ou na lixeira para removê-lo.
          </div>
        </div>
      )}

      {/* Tab: ACTIONS DO OBJETO */}
      {activeTab === 'actions' && (() => {
        const effectiveObjId = actionTargetId || selectedObjectId || (placedObjects[0]?.id ?? null);
        const targetObj = placedObjects.find((o) => o.id === effectiveObjId) || null;
        const targetActions: ObjectAction[] = targetObj?.actions || [];
        const isTestingThisObj = testingObjectAction?.objectId === targetObj?.id;
        const currentTestingActionId = isTestingThisObj ? testingObjectAction?.actionId : null;

        const handleApplyPresetAction = (preset: string) => {
          if (preset === 'girar_360') {
            setActionNameInput('Girar 360°');
            setActionTrajInput('circle_turn');
            setActionDeltaPos([0, 0, 0]);
            setActionDeltaRot([0, 360, 0]);
            setActionTurnAngle(360);
            setActionCurveRadius(0.01);
            setActionSpeed(1.0);
            setActionLoop(true);
          } else if (preset === 'frente_tras') {
            setActionNameInput('Frente e Trás (+2.5m)');
            setActionTrajInput('linear');
            setActionDeltaPos([0, 0, 2.5]);
            setActionDeltaRot([0, 0, 0]);
            setActionSpeed(1.0);
            setActionLoop(true);
          } else if (preset === 'lateral') {
            setActionNameInput('Balanço Lateral (+2m)');
            setActionTrajInput('linear');
            setActionDeltaPos([2.0, 0, 0]);
            setActionDeltaRot([0, 0, 0]);
            setActionSpeed(1.0);
            setActionLoop(true);
          } else if (preset === 'elevador') {
            setActionNameInput('Elevador Subir (+2.5m)');
            setActionTrajInput('linear');
            setActionDeltaPos([0, 2.5, 0]);
            setActionDeltaRot([0, 0, 0]);
            setActionSpeed(1.0);
            setActionLoop(true);
          } else if (preset === 'arco') {
            setActionNameInput('Salto em Arco');
            setActionTrajInput('arc');
            setActionDeltaPos([0, 0, 3.0]);
            setActionCurveHeight(2.0);
            setActionSpeed(1.2);
            setActionLoop(true);
          } else if (preset === 'onda') {
            setActionNameInput('Flutuação Onda');
            setActionTrajInput('wave');
            setActionDeltaPos([0, 0.4, 0]);
            setActionSpeed(0.8);
            setActionLoop(true);
          } else if (preset === 'espiral') {
            setActionNameInput('Subir em Espiral');
            setActionTrajInput('spiral');
            setActionDeltaPos([0, 3.0, 0]);
            setActionTurnAngle(360);
            setActionCurveRadius(1.5);
            setActionSpeed(1.0);
            setActionLoop(true);
          }
        };

        const handleSaveActionSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!targetObj) return;
          const finalName = actionNameInput.trim() || `Action ${targetActions.length + 1}`;
          const motionConfig: SpotMotionConfig = {
            enabled: true,
            deltaPosition: actionDeltaPos,
            deltaRotation: actionDeltaRot,
            turnAngle: actionTurnAngle,
            curveTrajectory: actionTrajInput,
            curveRadius: actionCurveRadius,
            curveHeight: actionCurveHeight,
            speed: actionSpeed,
            loop: actionLoop,
            target: 'parent_object',
          };

          let newActionsList: ObjectAction[];
          if (editingActionId) {
            newActionsList = targetActions.map((a) =>
              a.id === editingActionId ? { ...a, name: finalName, motion: motionConfig } : a
            );
          } else {
            const newAct: ObjectAction = {
              id: `act-${Date.now()}`,
              name: finalName,
              motion: motionConfig,
            };
            newActionsList = [...targetActions, newAct];
          }

          onUpdateObjectActions?.(targetObj.id, newActionsList);
          setIsCreatingAction(false);
          setEditingActionId(null);
        };

        const handleRemoveActionItem = (actId: string) => {
          if (!targetObj) return;
          const updated = targetActions.filter((a) => a.id !== actId);
          onUpdateObjectActions?.(targetObj.id, updated);
          if (currentTestingActionId === actId) {
            onToggleTestObjectAction?.(targetObj.id, null);
          }
        };

        return (
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {/* Header and Object Selector */}
              <div className="flex items-center justify-between pb-1 border-b border-[#d4af37]/20">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Actions do Objeto</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {targetActions.length} action(s)
                </span>
              </div>

              {/* Selector to pick which placed object to manage */}
              {placedObjects.length > 0 ? (
                <div>
                  <label className="text-[10px] text-[#d4af37]/80 block mb-1">
                    Selecionar Objeto da Cena:
                  </label>
                  <select
                    value={effectiveObjId || ''}
                    onChange={(e) => {
                      setActionTargetId(e.target.value);
                      onSelectObjectId?.(e.target.value);
                      setIsCreatingAction(false);
                      setEditingActionId(null);
                    }}
                    className="w-full bg-[#161822] border border-[#d4af37]/40 rounded-lg px-2 py-1.5 text-xs text-[#ffd700] font-semibold outline-none focus:border-[#ffd700]"
                  >
                    {placedObjects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-[#d4af37]/30 bg-black/40 text-center text-xs text-[#e8d5b5]/60">
                  <Box className="w-8 h-8 text-[#d4af37]/40 mx-auto mb-2" />
                  <p>Nenhum objeto na cena ainda.</p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Vá na aba "Itens" ou insira um modelo para configurar Actions.
                  </p>
                </div>
              )}

              {targetObj && (
                <>
                  {/* Selected Object Banner */}
                  <div className="p-2 rounded-lg bg-black/60 border border-[#d4af37]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded border border-cyan-400/50 bg-cyan-950/40 flex items-center justify-center text-cyan-300 flex-shrink-0">
                        ⚡
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate block">
                          {targetObj.name}
                        </span>
                        <span className="text-[9px] text-[#ffd700] uppercase font-mono">
                          {targetObj.type} • Pos: [{targetObj.position[0].toFixed(1)}, {targetObj.position[2].toFixed(1)}]
                        </span>
                      </div>
                    </div>

                    {!isCreatingAction && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActionId(null);
                          setActionNameInput(`Action ${targetActions.length + 1}`);
                          setActionTrajInput('circle_turn');
                          setActionDeltaPos([0, 0, 0]);
                          setActionDeltaRot([0, 360, 0]);
                          setActionTurnAngle(360);
                          setActionCurveRadius(0.01);
                          setActionSpeed(1.0);
                          setActionLoop(true);
                          setIsCreatingAction(true);
                        }}
                        className="px-2.5 py-1 rounded bg-[#ffd700] hover:bg-amber-300 text-black text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-sm flex-shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Nova Action</span>
                      </button>
                    )}
                  </div>

                  {/* Form: Create or Edit Action */}
                  {isCreatingAction ? (
                    <form
                      onSubmit={handleSaveActionSubmit}
                      className="p-3 rounded-lg border border-cyan-400/50 bg-cyan-950/20 space-y-2.5 animate-fade-in"
                    >
                      <div className="flex items-center justify-between text-xs text-cyan-300 font-bold border-b border-cyan-500/20 pb-1.5">
                        <span>{editingActionId ? '✏️ Editar Action' : '➕ Nova Action'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingAction(false);
                            setEditingActionId(null);
                          }}
                          className="text-zinc-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Presets */}
                      <div>
                        <span className="text-[10px] text-amber-300 font-bold block mb-1">
                          Predefinições Rápidas (1-Clique):
                        </span>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleApplyPresetAction('girar_360')}
                            className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left text-amber-200 cursor-pointer"
                          >
                            🔄 Girar 360°
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetAction('frente_tras')}
                            className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left text-cyan-300 cursor-pointer"
                          >
                            ⏩ Frente e Trás
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetAction('lateral')}
                            className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left text-emerald-300 cursor-pointer"
                          >
                            ↔️ Lateral
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetAction('elevador')}
                            className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left text-yellow-300 cursor-pointer"
                          >
                            🛗 Elevador
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetAction('arco')}
                            className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left text-purple-300 cursor-pointer"
                          >
                            🎢 Salto em Arco
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetAction('onda')}
                            className="p-1 rounded bg-black/60 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-left text-teal-300 cursor-pointer"
                          >
                            〰️ Flutuação
                          </button>
                        </div>
                      </div>

                      {/* Name input */}
                      <div>
                        <label className="text-[10px] text-zinc-300 block mb-0.5">Nome da Action:</label>
                        <input
                          type="text"
                          required
                          value={actionNameInput}
                          onChange={(e) => setActionNameInput(e.target.value)}
                          placeholder="Ex: Giro 360°, Deslizar..."
                          className="w-full bg-black/70 border border-[#d4af37]/40 rounded px-2 py-1 text-xs text-[#ffd700] outline-none"
                        />
                      </div>

                      {/* Trajectory */}
                      <div>
                        <label className="text-[10px] text-zinc-300 block mb-0.5">Trajetória / Curva:</label>
                        <select
                          value={actionTrajInput}
                          onChange={(e) => setActionTrajInput(e.target.value as any)}
                          className="w-full bg-black/70 border border-[#d4af37]/40 rounded px-2 py-1 text-xs text-[#ffd700] outline-none"
                        >
                          <option value="linear">📏 Reta Direta (Linear)</option>
                          <option value="circle_turn">🔄 Volta Circular (Curva em Raio)</option>
                          <option value="spiral">🚀 Subir em Espiral</option>
                          <option value="arc">🎢 Curva em Arco (Salto Parabólico)</option>
                          <option value="wave">〰️ Ondulação / Senoide (Flutuação)</option>
                        </select>
                      </div>

                      {/* Deltas */}
                      <div>
                        <span className="text-[10px] text-cyan-300 block mb-0.5 font-bold">
                          Deslocamento em Metros:
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          <div>
                            <span className="text-[9px] text-zinc-400 block">Z (Frente/Trás)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={actionDeltaPos[2]}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setActionDeltaPos([actionDeltaPos[0], actionDeltaPos[1], v]);
                              }}
                              className="w-full bg-black/70 border border-cyan-400/50 rounded px-1.5 py-0.5 text-xs text-cyan-300 font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 block">X (Direita/Esq)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={actionDeltaPos[0]}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setActionDeltaPos([v, actionDeltaPos[1], actionDeltaPos[2]]);
                              }}
                              className="w-full bg-black/70 border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-xs text-[#ffd700]"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 block">Y (Elevador)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={actionDeltaPos[1]}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setActionDeltaPos([actionDeltaPos[0], v, actionDeltaPos[2]]);
                              }}
                              className="w-full bg-black/70 border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-xs text-[#ffd700]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Speed & Loop */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex-1 mr-2">
                          <span className="text-[10px] text-zinc-300 block">Velocidade: {actionSpeed.toFixed(1)}x</span>
                          <input
                            type="range"
                            min="0.2"
                            max="3.0"
                            step="0.1"
                            value={actionSpeed}
                            onChange={(e) => setActionSpeed(parseFloat(e.target.value))}
                            className="w-full accent-[#ffd700]"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer pt-2">
                          <input
                            type="checkbox"
                            checked={actionLoop}
                            onChange={(e) => setActionLoop(e.target.checked)}
                            className="accent-[#ffd700]"
                          />
                          <span>Loop</span>
                        </label>
                      </div>

                      {/* Submit */}
                      <div className="flex items-center justify-end gap-1.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingAction(false);
                            setEditingActionId(null);
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-800 text-[10px] text-zinc-300"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded bg-[#ffd700] hover:bg-amber-300 text-black text-[10px] font-bold cursor-pointer"
                        >
                          Salvar Action
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {/* Actions List */}
                  {targetActions.length === 0 && !isCreatingAction ? (
                    <div className="p-3 rounded-lg border border-dashed border-[#d4af37]/30 bg-black/30 text-center space-y-1.5">
                      <p className="text-xs text-[#ffd700] font-semibold">Nenhuma action neste objeto.</p>
                      <p className="text-[10px] text-[#e8d5b5]/70">
                        Clique em "+ Nova Action" acima para fazer este objeto girar, flutuar ou se mover!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {targetActions.map((act) => {
                        const isTesting = currentTestingActionId === act.id;
                        return (
                          <div
                            key={act.id}
                            className={`p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                              isTesting
                                ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                                : 'border-[#d4af37]/30 bg-black/40'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-cyan-400 text-xs">⚡</span>
                                <span className="text-xs font-bold text-white truncate">
                                  {act.name}
                                </span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-black border border-cyan-400/40 text-cyan-300 uppercase font-mono">
                                  {act.motion.curveTrajectory || 'LINEAR'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Play / Pause / Stop Test Controls */}
                                {onToggleTestObjectAction && (() => {
                                  const isPaused = isTesting && testingObjectAction?.isPaused;
                                  return (
                                    <div className="flex items-center gap-1">
                                      {isTesting ? (
                                        <>
                                          {isPaused ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (onResumeTestObjectAction) {
                                                  onResumeTestObjectAction(targetObj.id, act.id);
                                                } else {
                                                  onToggleTestObjectAction(targetObj.id, act.id);
                                                }
                                              }}
                                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-black flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                                              title="Continuar movimento do objeto a partir de onde pausou"
                                            >
                                              <Play className="w-3 h-3 fill-black" />
                                              <span>Continuar</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => onPauseTestObjectAction?.(targetObj.id, act.id)}
                                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-black flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                                              title="Pausar o objeto no ponto atual para ajustar de acordo"
                                            >
                                              <span className="font-mono font-black text-xs leading-none">⏸</span>
                                              <span>Pausar</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => onToggleTestObjectAction(targetObj.id, null)}
                                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-800 hover:bg-red-700 text-white flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                                            title="Parar teste e retornar à posição de repouso"
                                          >
                                            <Square className="w-2.5 h-2.5 fill-white" />
                                            <span>Parar</span>
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => onToggleTestObjectAction(targetObj.id, act.id)}
                                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-700 hover:bg-cyan-600 text-white flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                                          title="Iniciar movimento deste objeto na cena 3D"
                                        >
                                          <Play className="w-3 h-3 fill-white" />
                                          <span>Iniciar</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Save to History / Library */}
                                {onSaveActionToHistory && (
                                  <button
                                    type="button"
                                    onClick={() => onSaveActionToHistory(act)}
                                    className="p-1 rounded text-amber-300 hover:text-white hover:bg-amber-400/20 transition-colors"
                                    title="Salvar esta action no Histórico/Biblioteca para reutilizar em outros objetos com 1 clique"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                )}

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingActionId(act.id);
                                    setActionNameInput(act.name);
                                    setActionTrajInput(act.motion.curveTrajectory || 'linear');
                                    setActionDeltaPos(act.motion.deltaPosition || [0, 0, 2.0]);
                                    setActionDeltaRot(act.motion.deltaRotation || [0, 0, 0]);
                                    setActionTurnAngle(act.motion.turnAngle !== undefined ? act.motion.turnAngle : 360);
                                    setActionCurveRadius(act.motion.curveRadius !== undefined ? act.motion.curveRadius : 2.0);
                                    setActionCurveHeight(act.motion.curveHeight !== undefined ? act.motion.curveHeight : 1.5);
                                    setActionSpeed(act.motion.speed || 1.0);
                                    setActionLoop(act.motion.loop !== false);
                                    setIsCreatingAction(true);
                                  }}
                                  className="p-1 rounded text-[#d4af37] hover:text-white hover:bg-[#d4af37]/20"
                                  title="Editar esta action"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveActionItem(act.id)}
                                  className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/60"
                                  title="Remover esta action do objeto"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <span className="text-[9px] font-mono text-zinc-400">
                              Z: {act.motion.deltaPosition[2]}m · Vel: {act.motion.speed || 1}x · Loop: {act.motion.loop ? 'Sim' : 'Não'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Section: HISTÓRICO E BIBLIOTECA DE ACTIONS USADAS */}
                  <div className="mt-4 pt-3 border-t border-[#d4af37]/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Histórico / Biblioteca de Actions</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {actionHistory.length} salvas
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-tight">
                      Actions salvas podem ser inseridas neste objeto com 1 clique, sem precisar refazer configurações:
                    </p>

                    {actionHistory.length === 0 ? (
                      <div className="p-2.5 rounded border border-dashed border-[#d4af37]/30 bg-black/30 text-center text-[10px] text-zinc-400">
                        Nenhuma action no histórico ainda. Ao criar uma action, clique no ícone de salvar para reutilizá-la aqui!
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                        {actionHistory.map((histAct) => (
                          <div
                            key={histAct.id}
                            className="p-2 rounded bg-black/60 border border-amber-400/30 flex items-center justify-between gap-1.5 text-xs hover:border-amber-400/60 transition-colors"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-white block truncate">
                                {histAct.name}
                              </span>
                              <span className="text-[9px] text-amber-200 uppercase font-mono block">
                                {histAct.motion.curveTrajectory || 'linear'} · Vel: {histAct.motion.speed || 1}x
                              </span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {onApplyActionFromHistoryToObject && targetObj && (
                                <button
                                  type="button"
                                  onClick={() => onApplyActionFromHistoryToObject(targetObj.id, histAct)}
                                  className="px-2 py-0.5 rounded bg-[#ffd700] hover:bg-amber-300 text-black text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-sm active:scale-95"
                                  title={`Inserir esta action em "${targetObj.name}"`}
                                >
                                  <span>+ Inserir</span>
                                </button>
                              )}
                              {onRemoveActionFromHistory && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveActionFromHistory(histAct.id)}
                                  className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/40"
                                  title="Remover da biblioteca"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-[#d4af37]/20 text-[10px] text-[#d4af37]/70 leading-tight">
              Actions funcionam em qualquer objeto (móveis, decorações, avatares e acessórios). Ao publicar ou ver na Loja, o usuário poderá executá-las clicando nelas!
            </div>
          </div>
        );
      })()}

      {/* Tab 4: INVENTÁRIO DE ARQUIVOS GLB */}
      {activeTab === 'inventory' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5">
          {/* Top Meus Itens Publicados prominent banner/button */}
          {onOpenPublicationsModal && (
            <button
              type="button"
              onClick={onOpenPublicationsModal}
              className="w-full py-2.5 px-3 rounded-lg border-2 border-[#ffd700] hover:border-amber-300 bg-gradient-to-r from-amber-600/30 via-yellow-500/30 to-[#ffd700]/30 hover:from-amber-600/40 hover:to-[#ffd700]/40 text-xs font-black text-[#ffd700] flex items-center justify-between gap-2 cursor-pointer transition-all shadow-md mb-2.5"
              title="Ver todas as salas, avatares, acessórios e itens publicados e editar novamente"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-[#ffd700] flex-shrink-0" />
                <span className="truncate">🌟 Minhas Publicações na Vitrine</span>
              </div>
              {publishedCount !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#ffd700] text-black font-extrabold flex-shrink-0">
                  {publishedCount}
                </span>
              )}
            </button>
          )}

          {/* Top project save/restore action */}
          {onOpenProjectModal && (
            <button
              type="button"
              onClick={onOpenProjectModal}
              className="w-full py-2 px-3 rounded-lg border border-[#ffd700]/70 hover:border-[#ffd700] bg-gradient-to-r from-[#d4af37]/25 to-[#ffd700]/25 hover:from-[#d4af37]/35 hover:to-[#ffd700]/35 text-xs font-extrabold text-[#ffd700] flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm mb-2.5"
              title="Exportar projeto para arquivo ou restaurar de onde parou"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Salvar / Restaurar Projeto</span>
            </button>
          )}

          {/* Top upload button */}
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="w-full py-2.5 px-3 rounded-lg border border-[#d4af37] hover:border-[#ffd700] bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-xs font-semibold text-[#ffd700] flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm mb-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Enviar arquivo (GLB)</span>
          </button>

          {/* Batch Actions: Limpar Todos & Excluir Selecionados */}
          {inventory.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => {
                  if (selectedInventoryIds.length === inventory.length) {
                    setSelectedInventoryIds([]);
                  } else {
                    setSelectedInventoryIds(inventory.map((i) => i.id));
                  }
                }}
                className="py-1 px-2 rounded-lg bg-black/60 border border-[#d4af37]/40 text-[10px] text-zinc-300 hover:text-white cursor-pointer transition-colors"
                title="Selecionar todos os arquivos"
              >
                {selectedInventoryIds.length === inventory.length ? 'Desmarcar' : 'Selecionar Todos'}
              </button>

              {selectedInventoryIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteSelectedModal(true)}
                  className="flex-1 py-1 px-2 rounded-lg bg-red-950/70 border border-red-500/60 hover:bg-red-900/80 text-red-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="Excluir apenas os arquivos selecionados"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Excluir ({selectedInventoryIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowClearAllModal(true)}
                className="py-1 px-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500/60 text-red-300 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="Limpar todos os arquivos do inventário"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpar Todos</span>
              </button>
            </div>
          )}

          {/* Drag & Drop Guidance Banner */}
          <div className="p-2 mb-2 rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 text-[10px] text-[#ffd700] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-[#ffd700]" />
            <span>Dica: Arraste qualquer item diretamente para o chão da maquete 3D!</span>
          </div>

          {/* Insertion Cursor Notification Banner */}
          {insertionCursorPoint && (
            <div className="p-2 mb-3 rounded-lg border border-[#d4af37] bg-[#d4af37]/15 text-[11px] text-[#ffd700] flex items-start gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ffd700]" />
              <div className="leading-snug">
                Ponto marcado em [{insertionCursorPoint[0]}, {insertionCursorPoint[2]}]. Clique no botão de inserção abaixo para nascer ali!
              </div>
            </div>
          )}

          {/* List of files in inventory */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {inventory.map((item) => (
              <div
                key={item.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify(item));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className={`group p-2.5 rounded-lg border transition-all flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] ${
                  selectedInventoryIds.includes(item.id)
                    ? 'border-[#ffd700] bg-[#ffd700]/10'
                    : 'border-[#d4af37]/30 hover:border-[#ffd700] bg-black/40 hover:bg-black/60'
                }`}
                title="Clique e arraste para o cenário 3D ou clique no botão abaixo"
              >
                <div className="flex items-center gap-2.5">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedInventoryIds.includes(item.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedInventoryIds((prev) => [...prev, item.id]);
                      } else {
                        setSelectedInventoryIds((prev) => prev.filter((id) => id !== item.id));
                      }
                    }}
                    className="accent-[#ffd700] w-3.5 h-3.5 rounded cursor-pointer"
                    title="Selecionar para exclusão"
                  />

                  <div className="w-12 h-10 rounded border border-[#d4af37]/40 bg-[#16181e] overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.thumbUrl ? (
                      <img
                        src={item.thumbUrl}
                        alt={item.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Box className="w-5 h-5 text-[#d4af37]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={editingItemName}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingItemName.trim()) {
                                onRenameInventoryItem?.(item.id, editingItemName.trim());
                              }
                              setEditingItemId(null);
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null);
                            }
                          }}
                          className="w-full bg-[#181a24] border border-[#ffd700] rounded px-1.5 py-0.5 text-xs text-[#ffd700] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingItemName.trim()) {
                              onRenameInventoryItem?.(item.id, editingItemName.trim());
                            }
                            setEditingItemId(null);
                          }}
                          className="p-1 rounded bg-[#ffd700] text-black hover:bg-amber-300 cursor-pointer flex-shrink-0"
                          title="Salvar nome"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          <h4 className="text-xs font-semibold text-[#e8d5b5] truncate group-hover:text-[#ffd700]" title={item.displayName}>
                            {item.displayName}
                          </h4>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {onRenameInventoryItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItemId(item.id);
                                  setEditingItemName(item.displayName);
                                }}
                                className="p-0.5 rounded text-[#d4af37]/50 hover:text-[#ffd700] hover:bg-[#d4af37]/20 transition-colors cursor-pointer"
                                title="Renomear este arquivo no inventário"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {onDeleteInventoryItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete(item);
                                }}
                                className="p-0.5 rounded text-red-400/60 hover:text-red-300 hover:bg-red-950/80 transition-colors cursor-pointer"
                                title={`Excluir "${item.displayName}" do inventário`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <GripHorizontal className="w-3.5 h-3.5 text-[#d4af37]/40 group-hover:text-[#ffd700] flex-shrink-0 ml-1" />
                      </div>
                    )}
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#d4af37]/40 text-[#d4af37] inline-block mt-0.5">
                      {item.type}
                    </span>
                  </div>
                </div>

                {/* Actions: Inserir na cena & Publicar na Loja */}
                <div className="flex items-center gap-1.5 w-full pt-1">
                  <button
                    type="button"
                    onClick={() => onInsertAssetToScene(item)}
                    className="flex-1 py-1 px-1.5 rounded border border-[#d4af37]/60 hover:border-[#d4af37] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#d4af37] tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-1"
                    title={
                      item.type === 'Sala'
                        ? 'Carregar como Maquete 3D da Sala'
                        : 'Inserir este objeto na cena 3D'
                    }
                  >
                    <Plus className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                      {item.type === 'Sala'
                        ? 'Cenário'
                        : insertionCursorPoint
                        ? 'No Ponto'
                        : 'Inserir'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onPublishInventoryItem?.(item)}
                    className="flex-1 py-1 px-1.5 rounded border border-[#ffd700]/70 bg-[#ffd700]/10 hover:bg-[#ffd700] hover:text-black text-[10px] font-bold text-[#ffd700] tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                    title="Publicar este item diretamente na loja para outros comprarem/customizarem, mesmo sem colocá-lo na cena"
                  >
                    <ShoppingBag className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">Publicar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#d4af37]/20 text-[10px] text-[#d4af37]/70">
            Arraste para soltar no chão ou clique no botão para inserir.
          </div>

          {/* Delete item confirmation modal */}
          {itemToDelete && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#15161c] border border-red-500/50 rounded-2xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/50 text-red-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Excluir arquivo do inventário?
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Tem certeza que deseja apagar <strong className="text-white">"{itemToDelete.displayName}"</strong> da sua lista de uploads e do armazenamento de dados?
                  </p>
                </div>
                <div className="flex gap-2 justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setItemToDelete(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteInventoryItem?.(itemToDelete.id);
                      setItemToDelete(null);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-lg shadow-red-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete selected items confirmation modal */}
          {showDeleteSelectedModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#15161c] border border-red-500/50 rounded-2xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/50 text-red-400 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Excluir {selectedInventoryIds.length} arquivos selecionados?
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Esta ação removerá permanentemente os itens selecionados da sua conta e do banco de dados.
                  </p>
                </div>
                <div className="flex gap-2 justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDeleteSelectedModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteMultipleInventoryItems?.(selectedInventoryIds);
                      setSelectedInventoryIds([]);
                      setShowDeleteSelectedModal(false);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-lg shadow-red-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Selecionados</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Clear all items confirmation modal */}
          {showClearAllModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#15161c] border border-red-500/70 rounded-2xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/60 text-red-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Limpar Todos os Uploads?
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Tem certeza que deseja apagar <strong className="text-red-400">TODOS os {inventory.length} modelos</strong> do inventário e do armazenamento? Essa ação não pode ser desfeita.
                  </p>
                </div>
                <div className="flex gap-2 justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearAllModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllInventory?.();
                      setSelectedInventoryIds([]);
                      setShowClearAllModal(false);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-lg shadow-red-900/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Limpar Tudo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
