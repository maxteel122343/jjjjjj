import React, { useState, useEffect } from 'react';
import { Box, ChevronDown, LogOut, ArrowDown, Sparkles, X, Plus, GripVertical, Check } from 'lucide-react';
import {
  RoomData,
  AvatarPose,
  AvatarTransform,
  GizmoMode,
  Spot,
  ChatMessage,
  SpeechBubbleItem,
  StoreAvatar,
  CreatorUser,
  AvatarPoseConfig,
  SpotVisualConfig,
  PlacedObject,
  RoomAccessSlot,
} from '../types';
import { INITIAL_POSES, INITIAL_SPOTS, INITIAL_CHAT } from '../data/initialData';
import { LoungeCanvas3D } from './LoungeCanvas3D';
import { GizmoWidget } from './GizmoWidget';
import { PoseGrid } from './PoseGrid';
import { GlassChat } from './GlassChat';
import { SpeechBubbleOverlay } from './SpeechBubbleOverlay';
import { RoomAccessBar } from './RoomAccessBar';
import { safeLocalStorageSet } from '../lib/storageUtils';
import { supabase } from '../lib/supabase';

interface RoomViewProps {
  room: RoomData;
  onExitToLobby: () => void;
  equippedAccessories?: any[];
  activeUserAvatar?: StoreAvatar | null;
  user?: CreatorUser | null;
  poses?: AvatarPoseConfig[];
  storeAvatars?: StoreAvatar[];
  roomAccessSlots?: RoomAccessSlot[];
  onUpdateRoomAccessSlots?: (slots: RoomAccessSlot[]) => void;
  spotVisualConfig?: SpotVisualConfig;
  customAvatarObject?: PlacedObject | null;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  onExitToLobby,
  equippedAccessories,
  activeUserAvatar,
  user,
  poses: propPoses,
  storeAvatars = [],
  roomAccessSlots: propRoomAccessSlots,
  onUpdateRoomAccessSlots,
  spotVisualConfig,
  customAvatarObject,
}: RoomViewProps) => {
  // Live Avatar state (can switch dynamically inside room via Room Access Bar!)
  const [liveAvatar, setLiveAvatar] = useState<StoreAvatar | null>(() => {
    return activeUserAvatar || storeAvatars[0] || null;
  });

  const [remotePlayers, setRemotePlayers] = useState<any[]>([]);
  const roomChannelRef = React.useRef<any>(null);

  useEffect(() => {
    if (activeUserAvatar) {
      setLiveAvatar(activeUserAvatar);
    }
  }, [activeUserAvatar]);

  // Gizmo & Transform State (Mover -> Escala -> Rotação)
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('mover');
  const [transform, setTransform] = useState<AvatarTransform>({
    scale: 1.0,
    sizeY: 1.0,
    angle: 0,
    positionOffset: [0, 0, 0],
  });

  // Calculate live poses matching either user created/customized poses or default poses
  const poses: AvatarPose[] = React.useMemo(() => {
    if (propPoses && propPoses.length > 0) {
      return propPoses.map((p) => ({
        id: p.id,
        name: p.name,
        label: p.name,
        thumbnailUrl: p.thumbnailUrl,
        description: p.description,
        price: p.price,
        owned: p.owned,
        author: p.author,
        isPublishedByCreator: p.isPublishedByCreator,
        associatedAvatarIds: p.associatedAvatarIds,
        associatedAvatarNames: p.associatedAvatarNames,
      }));
    }
    return INITIAL_POSES;
  }, [propPoses]);

  const ownedAvatarIds = React.useMemo(() => {
    return storeAvatars
      .filter((a) => a.owned || a.applied || a.id === liveAvatar?.id)
      .map((a) => a.id);
  }, [storeAvatars, liveAvatar]);

  const [selectedPose, setSelectedPose] = useState<AvatarPose>(() => poses[1] || poses[0] || INITIAL_POSES[0]);

  // Room Access Slots state
  const [roomAccessSlots, setRoomAccessSlots] = useState<RoomAccessSlot[]>(() => {
    if (propRoomAccessSlots && propRoomAccessSlots.length > 0) return propRoomAccessSlots;
    const saved = localStorage.getItem('3d_social_room_access_inventory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    // Default seed
    const initial: RoomAccessSlot[] = [];
    const firstAvatar = liveAvatar || storeAvatars[0];
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
      });
    });
    return initial;
  });

  const handleUpdateRoomAccessSlots = (newSlots: RoomAccessSlot[]) => {
    setRoomAccessSlots(newSlots);
    safeLocalStorageSet('3d_social_room_access_inventory', JSON.stringify(newSlots));
    if (onUpdateRoomAccessSlots) {
      onUpdateRoomAccessSlots(newSlots);
    }
  };

  // Manage drawer state inside room
  const [isManageDrawerOpen, setIsManageDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'avatars' | 'poses'>('avatars');
  const [hudToast, setHudToast] = useState<string | null>(null);

  const showHudToast = (msg: string) => {
    setHudToast(msg);
    setTimeout(() => setHudToast(null), 3500);
  };

  // Triggering a room access slot
  const handleTriggerAccessSlot = (slot: RoomAccessSlot) => {
    if (slot.type === 'avatar') {
      const targetAvatar = storeAvatars.find((a) => a.id === slot.itemId) || slot.avatarData;
      if (targetAvatar) {
        setLiveAvatar(targetAvatar);
        showHudToast(`👤 Avatar alterado para "${targetAvatar.name}"!`);
      }
    } else {
      const targetPose = poses.find((p) => p.id === slot.itemId);
      if (targetPose) {
        setSelectedPose(targetPose);
        showHudToast(`💃 Pose alterada para "${targetPose.name}"!`);
      }
    }
  };

  // Keyboard shortcut listener for slots 1-8
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const keyNum = parseInt(e.key, 10);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 8) {
        const slot = roomAccessSlots.find((s) => s.slotIndex === keyNum - 1);
        if (slot) {
          handleTriggerAccessSlot(slot);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roomAccessSlots, storeAvatars, poses]);

  // Spots State (puff ouro spots)
  const [spots] = useState<Spot[]>(() => {
    if (room.editorRoom?.spots && room.editorRoom.spots.length > 0) {
      return room.editorRoom.spots.map((s, idx) => ({
        id: idx + 1,
        name: s.name,
        label: s.name,
        position: [s.position[0], s.position[1], s.position[2]],
        rotation: s.rotation,
      }));
    }
    return INITIAL_SPOTS;
  });
  const [currentSpotId, setCurrentSpotId] = useState<number>(() => {
    if (room.editorRoom?.spots && room.editorRoom.spots.length > 0) {
      return 1;
    }
    return 2;
  }); // Center puff is Player

  // Toggle for discreet blinking down-arrows above spots
  const [showSpotArrows, setShowSpotArrows] = useState<boolean>(true);

  // Camera dropdown state
  const [cameraMode, setCameraMode] = useState<'orbit' | 'frontal' | 'closeup' | 'topdown'>('orbit');
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  // Chat & Speech Bubbles State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubbleItem[]>([
    {
      id: 'initial-bubble',
      text: 'oi',
      spotId: 1, // Maya says "oi" matching Reference 1
      userName: 'Maya',
      createdAt: Date.now(),
    },
  ]);
  const [screenHeadPositions, setScreenHeadPositions] = useState<
    Record<number, { x: number; y: number }>
  >({});

  // Cycle Gizmo Mode: Mover -> Escalar -> Rotação -> Mover...
  // "se o usuairo clica no centro gismo muda p scala se clica de novo mud ap mover se lcia de novo muda p rotação"
  const handleCycleGizmoMode = () => {
    setGizmoMode((prev) => {
      if (prev === 'mover') return 'escalar';
      if (prev === 'escalar') return 'rodar';
      return 'mover';
    });
  };

  // Supabase Realtime Multiplayer Presence & Chat Synchronization
  useEffect(() => {
    if (!room?.id) return;

    const myUserId = user && !user.isGuest && user.id ? user.id : `guest-${Math.random().toString(36).substring(2, 9)}`;
    const myDisplayName = user?.displayName || 'Visitante';

    const channel = supabase.channel(`room-presence:${room.id}`, {
      config: {
        presence: { key: myUserId },
      },
    });

    roomChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const playersList: any[] = [];

        Object.keys(state).forEach((key) => {
          if (key !== myUserId) {
            const list = state[key] as any[];
            if (list && list.length > 0) {
              const latest = list[list.length - 1];
              playersList.push({
                userId: key,
                displayName: latest.displayName || 'Usuário',
                spotId: latest.spotId || 1,
                avatar: latest.avatar || null,
              });
            }
          }
        });

        setRemotePlayers(playersList);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload) {
          setChatMessages((prev) => [...prev, payload]);
          if (payload.text) {
            setSpeechBubbles((prev) => [
              ...prev,
              {
                id: `bubble-remote-${Date.now()}`,
                text: payload.text,
                spotId: payload.spotId || 1,
                userName: payload.user || 'Usuário',
                createdAt: Date.now(),
              },
            ]);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: myUserId,
            displayName: myDisplayName,
            spotId: currentSpotId,
            avatar: liveAvatar,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      roomChannelRef.current = null;
    };
  }, [room?.id]);

  useEffect(() => {
    if (roomChannelRef.current) {
      const myUserId = user && !user.isGuest && user.id ? user.id : `guest-user`;
      const myDisplayName = user?.displayName || 'Visitante';
      roomChannelRef.current.track({
        userId: myUserId,
        displayName: myDisplayName,
        spotId: currentSpotId,
        avatar: liveAvatar,
      });
    }
  }, [currentSpotId, liveAvatar]);

  // Send message from chat
  const handleSendMessage = (text: string) => {
    const senderName = user?.displayName || 'Você';
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      user: `${senderName}`,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      text,
      time: 'agora',
      spotId: currentSpotId,
      isPlayer: true,
    };

    setChatMessages((prev) => [...prev, newMsg]);

    if (roomChannelRef.current) {
      roomChannelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: {
          id: `msg-${Date.now()}`,
          user: senderName,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          text,
          time: 'agora',
          spotId: currentSpotId,
          isPlayer: false,
        },
      });
    }

    // Spawn 3D speech bubble above player's head
    const newBubble: SpeechBubbleItem = {
      id: `bubble-${Date.now()}`,
      text,
      spotId: currentSpotId,
      userName: senderName,
      createdAt: Date.now(),
    };
    setSpeechBubbles((prev) => [...prev, newBubble]);
  };

  // Clean up speech bubbles after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setSpeechBubbles((prev) => prev.filter((b) => now - b.createdAt < 7000));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Auto-detect custom avatar object from editor room if not explicitly passed
  const effectiveCustomAvatarObject =
    customAvatarObject ||
    room.editorRoom?.placedObjects.find(
      (o) => o.isAvatar || o.type === 'avatar' || o.name.toLowerCase().includes('avatar')
    ) ||
    null;

  return (
    <div id="room-view-container" className="relative w-screen h-screen overflow-hidden bg-[#141416] select-none">
      {/* 3D WebGL Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <LoungeCanvas3D
          currentPose={selectedPose}
          transform={transform}
          spots={spots}
          currentSpotId={currentSpotId}
          onSelectSpot={setCurrentSpotId}
          cameraMode={cameraMode}
          equippedAccessories={equippedAccessories}
          onUpdateAvatarHeadScreenPos={setScreenHeadPositions}
          editorRoom={room.editorRoom}
          showSpotArrows={showSpotArrows}
          activeUserAvatar={liveAvatar}
          customAvatarObject={effectiveCustomAvatarObject}
          gizmoMode={gizmoMode}
          onChangeTransform={setTransform}
          spotVisualConfig={spotVisualConfig}
          remotePlayers={remotePlayers}
        />
      </div>

      {/* Speech Bubbles and Floating Avatar Name Tag with Photo Anchored over 3D Avatars */}
      <SpeechBubbleOverlay
        bubbles={speechBubbles}
        screenPositions={screenHeadPositions}
        spots={spots}
        currentSpotId={currentSpotId}
        activeUserAvatar={liveAvatar}
        user={user}
      />

      {/* Instant HUD Toast Feedback */}
      {hudToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-[#121319]/95 border border-[#ffd700]/70 text-[#ffd700] text-xs font-bold shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#ffd700]" />
          <span>{hudToast}</span>
        </div>
      )}

      {/* TOP BAR matching Reference 1:
          Cube Icon | Lounge 3/8 | Orbit camera dropdown | Exit */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Room Name & Cube Icon */}
          <div className="flex items-center gap-2.5 text-white drop-shadow-md">
            <div className="w-8 h-8 rounded-lg bg-[#ffd700]/15 border border-[#ffd700]/40 flex items-center justify-center text-[#ffd700]">
              <Box className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight flex items-baseline gap-2 text-white">
              <span>{room.name || 'Lounge'}</span>
              <span className="text-sm font-normal text-zinc-400">
                {room.occupation || '3/8'}
              </span>
            </h1>
          </div>

          {/* Playtest Mode Badge */}
          {room.isPlaytest && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <span>🧪 MODO TESTE INTERATIVO</span>
              <span className="text-[10px] text-emerald-200/80 font-normal hidden sm:inline">
                (Não publicado na vitrine)
              </span>
            </div>
          )}

          {/* Toggle for Blinking Down-Arrow above Spot Circles */}
          <button
            type="button"
            onClick={() => setShowSpotArrows((prev) => !prev)}
            title={showSpotArrows ? 'Ocultar setas piscando dos spots' : 'Exibir setas piscando dos spots'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all cursor-pointer border ${
              showSpotArrows
                ? 'bg-[#ffd700]/20 border-[#ffd700]/60 text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.25)]'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowDown className={`w-3.5 h-3.5 ${showSpotArrows ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Setas nos Spots:</span>
            <span>{showSpotArrows ? 'ON' : 'OFF'}</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-[1px] bg-white/20" />

          {/* Orbit camera dropdown */}
          <div className="relative">
            <button
              id="camera-mode-dropdown-btn"
              type="button"
              onClick={() => setShowCameraMenu(!showCameraMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="capitalize">{cameraMode} camera</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {showCameraMenu && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-[#16171d]/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl py-1 z-40">
                {(['orbit', 'frontal', 'closeup', 'topdown'] as const).map((mode) => (
                  <button
                    key={mode}
                    id={`cam-option-${mode}`}
                    type="button"
                    onClick={() => {
                      setCameraMode(mode);
                      setShowCameraMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      cameraMode === mode
                        ? 'text-[#ffd700] bg-white/5 font-semibold'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="capitalize">{mode}</span>
                    {cameraMode === mode && <span className="text-[10px]">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spot Switcher Pills */}
          <div className="hidden lg:flex items-center gap-1.5 bg-black/30 border border-white/10 px-2 py-1 rounded-lg backdrop-blur-md text-[11px] text-zinc-300">
            <span className="text-zinc-500 mr-1">Spot:</span>
            {spots.map((spot) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => setCurrentSpotId(spot.id)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  currentSpotId === spot.id
                    ? 'bg-[#ffd700] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Puff {spot.id}
              </button>
            ))}
          </div>
        </div>

        {/* Exit Button to return to Hall/Lobby or Editor */}
        <div className="pointer-events-auto">
          <button
            id="exit-room-btn"
            type="button"
            onClick={onExitToLobby}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border backdrop-blur-md transition-colors cursor-pointer text-xs font-semibold ${
              room.isPlaytest
                ? 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/50 text-emerald-300 hover:text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-black/40 hover:bg-red-500/20 border-white/10 hover:border-red-500/40 text-zinc-300 hover:text-red-300'
            }`}
            title={room.isPlaytest ? 'Voltar para o Modo Criador' : 'Sair da sala e voltar ao Hall de Portais'}
          >
            <LogOut className={`w-4 h-4 ${room.isPlaytest ? 'rotate-180' : ''}`} />
            <span>{room.isPlaytest ? 'Voltar ao Editor' : 'Voltar à Vitrine'}</span>
          </button>
        </div>
      </header>

      {/* TOP-LEFT HUD matching Reference 1:
          1) 3D Gizmo with center click cycling mode and color
          2) 3x3 Pose Grid with miniature previews and GLB switch */}
      <div className="absolute top-20 left-6 z-30 flex flex-col gap-4 pointer-events-auto">
        <GizmoWidget
          mode={gizmoMode}
          onCycleMode={handleCycleGizmoMode}
          transform={transform}
          onChangeTransform={setTransform}
          onSetMode={setGizmoMode}
        />

        <PoseGrid
          poses={poses}
          selectedPoseId={selectedPose.id}
          onSelectPose={setSelectedPose}
          activeUserAvatar={liveAvatar}
          ownedAvatarIds={ownedAvatarIds}
        />
      </div>

      {/* RIGHT HUD matching Reference 1:
          Dark Glass Chat Panel with messages and input */}
      <div className="absolute top-20 right-6 z-30 pointer-events-auto">
        <GlassChat
          roomName={room.name || 'Lounge'}
          messages={chatMessages}
          onSendMessage={handleSendMessage}
        />
      </div>

      {/* BOTTOM CENTER: INVENTÁRIO DE ACESSO DAS ROOMS (HOTBAR SLOTS 1-8) */}
      <RoomAccessBar
        slots={roomAccessSlots}
        onUpdateSlots={handleUpdateRoomAccessSlots}
        onSlotClick={handleTriggerAccessSlot}
        activeAvatarId={liveAvatar?.id}
        activePoseId={selectedPose.id}
        isInsideRoom={true}
        onOpenManageDrawer={() => setIsManageDrawerOpen(true)}
        onShowToast={showHudToast}
      />

      {/* DRAWER / MODAL: GERENCIAR SLOTS DE ACESSO DAS ROOMS */}
      {isManageDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-fade-in select-none">
          <div className="relative w-full max-w-md h-full bg-[#121319] border-l border-[#ffd700]/40 p-6 flex flex-col justify-between shadow-2xl text-zinc-100">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#ffd700]" />
                  <h3 className="text-base font-serif font-bold text-white">
                    Acesso Rápido das Rooms
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManageDrawerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-zinc-400 mt-2">
                Arraste um Avatar ou Pose da sua coleção para os slots da barra de acesso abaixo (ou use as teclas de 1 a 8).
              </p>

              {/* Tabs: Avatares | Poses */}
              <div className="flex items-center gap-2 mt-4 border-b border-white/10 pb-2">
                <button
                  type="button"
                  onClick={() => setDrawerTab('avatars')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    drawerTab === 'avatars'
                      ? 'bg-[#ffd700] text-black shadow-md'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Avatares ({storeAvatars.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('poses')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    drawerTab === 'poses'
                      ? 'bg-[#ffd700] text-black shadow-md'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Poses ({poses.length})
                </button>
              </div>

              {/* Items List */}
              <div className="mt-4 space-y-2.5 max-h-[58vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                {drawerTab === 'avatars' ? (
                  storeAvatars.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                      Nenhum avatar encontrado. Crie ou publique avatares no Modo Customização.
                    </div>
                  ) : (
                    storeAvatars.map((av) => {
                      const isEquippedInRoom = liveAvatar?.id === av.id;
                      return (
                        <div
                          key={av.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/json',
                              JSON.stringify({ type: 'avatar', avatar: av })
                            );
                            e.dataTransfer.effectAllowed = 'copyMove';
                          }}
                          className="p-2.5 rounded-xl bg-[#171922] border border-white/10 flex items-center justify-between gap-3 group hover:border-[#ffd700]/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-black flex-shrink-0">
                              <img
                                src={av.thumb}
                                alt={av.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{av.name}</p>
                              <span className="text-[10px] font-mono text-cyan-400">AVATAR</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div
                              className="p-1.5 text-zinc-500 group-hover:text-[#ffd700] cursor-grab active:cursor-grabbing"
                              title="Arraste para os slots de acesso"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setLiveAvatar(av);
                                showHudToast(`Avatar "${av.name}" equipado na sala!`);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                                isEquippedInRoom
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-zinc-800 hover:bg-[#ffd700] hover:text-black text-zinc-200'
                              }`}
                            >
                              {isEquippedInRoom ? '✓ Em Uso' : 'Equipar'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  poses.map((pose) => {
                    const isActivePose = selectedPose.id === pose.id;
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
                        className="p-2.5 rounded-xl bg-[#171922] border border-white/10 flex items-center justify-between gap-3 group hover:border-[#ffd700]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
                            {pose.thumbnailUrl ? (
                              <img
                                src={pose.thumbnailUrl}
                                alt={pose.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Sparkles className="w-5 h-5 text-[#ffd700]" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-200">{pose.name}</p>
                            <span className="text-[10px] font-mono text-[#ffd700]">POSE</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div
                            className="p-1.5 text-zinc-500 group-hover:text-[#ffd700] cursor-grab active:cursor-grabbing"
                            title="Arraste para os slots de acesso"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPose(pose);
                              showHudToast(`Pose "${pose.name}" ativada!`);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                              isActivePose
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-zinc-800 hover:bg-[#ffd700] hover:text-black text-zinc-200'
                            }`}
                          >
                            {isActivePose ? '✓ Ativa' : 'Aplicar'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsManageDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
