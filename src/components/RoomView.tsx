import React, { useState, useEffect } from 'react';
import { Box, ChevronDown, LogOut, ArrowDown, Sparkles, X, Plus, GripVertical, Check, Heart } from 'lucide-react';
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
import { GlassChat } from './GlassChat';
import { SpeechBubbleOverlay } from './SpeechBubbleOverlay';
import { UnifiedRoomInventory } from './UnifiedRoomInventory';
import { RoomAudioPlayer } from './RoomAudioPlayer';
import { safeLocalStorageSet } from '../lib/storageUtils';
import { supabase } from '../lib/supabase';
import { toggleRoomLike } from '../lib/database';

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
  const [activeAvatarActionId, setActiveAvatarActionId] = useState<string | null>(null);

  const handleToggleAvatarAction = (actionId: string) => {
    const nextActionId = activeAvatarActionId === actionId ? null : actionId;
    setActiveAvatarActionId(nextActionId);
  };

  useEffect(() => {
    if (activeUserAvatar) {
      setLiveAvatar(activeUserAvatar);
    }
  }, [activeUserAvatar]);

  useEffect(() => {
    setActiveAvatarActionId(null);
  }, [liveAvatar?.id]);

  useEffect(() => {
    if (!activeAvatarActionId) return;
    const actionStillExists = liveAvatar?.actions?.some((action) => action.id === activeAvatarActionId);
    if (!actionStillExists) {
      setActiveAvatarActionId(null);
    }
  }, [liveAvatar, activeAvatarActionId]);

  const [remotePlayers, setRemotePlayers] = useState<any[]>([]);
  const roomChannelRef = React.useRef<any>(null);

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

  // Room Likes State & Handler
  const [likesCount, setLikesCount] = useState<number>(() => room.likesCount || 0);
  const [isLiked, setIsLiked] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const likedIds = JSON.parse(localStorage.getItem('3d_social_liked_rooms') || '[]');
        return likedIds.includes(room.id) || Boolean(room.isLiked);
      } catch {}
    }
    return Boolean(room.isLiked);
  });

  const handleToggleLike = async () => {
    const res = await toggleRoomLike(room.id, user?.id || 'guest');
    setLikesCount(res.likesCount);
    setIsLiked(res.isLiked);
    showHudToast(res.isLiked ? '❤️ Você curtiu esta sala!' : '💔 Curtida desfeita.');
  };

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
          senderSessionId: tabSessionId,
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

  // Generate a unique session ID for this browser tab instance
  const tabSessionId = React.useMemo(() => {
    let existing = sessionStorage.getItem('3d_social_session_id');
    if (!existing) {
      existing = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('3d_social_session_id', existing);
    }
    return existing;
  }, []);

  // Normalize channel name across all room ID variants
  const effectiveRoomId = (room.editorRoomId || room.editorRoom?.id || room.id)
    .replace(/^(editor|playtest)-/, '');

  // Supabase Realtime Multiplayer Presence & Chat Synchronization
  useEffect(() => {
    if (!effectiveRoomId) return;

    const myDisplayName = user?.displayName || 'Visitante';
    const presenceKey = `${tabSessionId}`;

    const channel = supabase.channel(`room-presence:${effectiveRoomId}`, {
      config: {
        presence: { key: presenceKey },
      },
    });

    roomChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const playersList: any[] = [];

        Object.keys(state).forEach((key) => {
          if (key !== presenceKey) {
            const list = state[key] as any[];
            if (list && list.length > 0) {
              const latest = list[list.length - 1];
              playersList.push({
                userId: key,
                displayName: latest.displayName || 'Usuário',
                spotId: latest.spotId || 1,
                avatar: latest.avatar || null,
                pose: latest.pose || null,
              });
            }
          }
        });

        setRemotePlayers(playersList);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload && payload.senderSessionId !== tabSessionId) {
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
            sessionId: tabSessionId,
            displayName: myDisplayName,
            spotId: currentSpotId,
            avatar: liveAvatar,
            pose: selectedPose,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      roomChannelRef.current = null;
    };
  }, [effectiveRoomId, tabSessionId]);

  // Auto-detect custom avatar object from editor room if not explicitly passed
  const effectiveCustomAvatarObject =
    customAvatarObject ||
    room.editorRoom?.placedObjects.find(
      (o) => o.isAvatar || o.type === 'avatar' || o.name.toLowerCase().includes('avatar')
    ) ||
    null;

  useEffect(() => {
    if (roomChannelRef.current) {
      const myDisplayName = user?.displayName || 'Visitante';
      const customUrl =
        effectiveCustomAvatarObject?.fileBlobUrl ||
        (effectiveCustomAvatarObject as any)?.asset_url ||
        (effectiveCustomAvatarObject as any)?.url;

      roomChannelRef.current.track({
        sessionId: tabSessionId,
        displayName: myDisplayName,
        spotId: currentSpotId,
        avatar: liveAvatar,
        pose: selectedPose,
        customAvatarUrl: customUrl,
      });
    }
  }, [currentSpotId, liveAvatar, selectedPose, tabSessionId, effectiveCustomAvatarObject]);

  // Clean up speech bubbles after 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setSpeechBubbles((prev) => prev.filter((b) => now - b.createdAt < 7000));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

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
          activeAvatarAction={
            liveAvatar?.actions?.find((action) => action.id === activeAvatarActionId) || null
          }
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
        remotePlayers={remotePlayers}
        avatarActions={liveAvatar?.actions}
        activeAvatarActionId={activeAvatarActionId}
        onToggleAvatarAction={handleToggleAvatarAction}
      />

      {/* Instant HUD Toast Feedback */}
      {hudToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-[#121319]/95 border border-[#ffd700]/70 text-[#ffd700] text-xs font-bold shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#ffd700]" />
          <span>{hudToast}</span>
        </div>
      )}

      {/* TOP BAR: Cube Icon | Lounge 3/8 | Heart Like | Orbit camera dropdown | Exit */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-2 sm:px-6 py-2 sm:py-3.5 pointer-events-none gap-2 max-w-full overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-3 pointer-events-auto min-w-0 flex-shrink">
          {/* Room Name & Cube Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-white drop-shadow-md min-w-0">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#ffd700]/15 border border-[#ffd700]/40 flex items-center justify-center text-[#ffd700] flex-shrink-0">
              <Box className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <h1 className="text-xs sm:text-base md:text-xl font-bold tracking-tight flex items-baseline gap-1 text-white min-w-0">
              <span className="truncate max-w-[70px] xs:max-w-[110px] sm:max-w-[180px] md:max-w-none">{room.name || 'Lounge'}</span>
              <span className="text-[9px] sm:text-xs font-normal text-zinc-400 flex-shrink-0">
                {room.occupation || '3/8'}
              </span>
            </h1>
          </div>

          {/* Curtir / Like Button (ao lado do nome da room) */}
          <button
            id="room-header-like-btn"
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer flex-shrink-0 backdrop-blur-md ${
              isLiked
                ? 'bg-rose-500/25 border-rose-500/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-black/40 hover:bg-rose-500/15 border-white/10 hover:border-rose-400/50 text-zinc-300 hover:text-rose-300'
            }`}
            title={isLiked ? 'Você curtiu esta sala! Clique para descurtir' : 'Curtir esta sala'}
          >
            <Heart className={`w-3.5 h-3.5 transition-transform active:scale-125 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-zinc-400'}`} />
            <span className="font-mono text-[11px]">{likesCount}</span>
          </button>

          {/* Playtest Mode Badge */}
          {room.isPlaytest && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[10px] sm:text-xs font-semibold backdrop-blur-md shadow-[0_0_12px_rgba(16,185,129,0.3)] flex-shrink-0">
              <span>🧪 TESTE</span>
            </div>
          )}

          {/* Toggle for Blinking Down-Arrow above Spot Circles */}
          <button
            type="button"
            onClick={() => setShowSpotArrows((prev) => !prev)}
            title={showSpotArrows ? 'Ocultar setas piscando dos spots' : 'Exibir setas piscando dos spots'}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all cursor-pointer border ${
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
          <div className="hidden sm:block h-5 w-[1px] bg-white/20 flex-shrink-0" />

          {/* Orbit camera dropdown */}
          <div className="relative flex-shrink-0">
            <button
              id="camera-mode-dropdown-btn"
              type="button"
              onClick={() => setShowCameraMenu(!showCameraMenu)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-[11px] sm:text-xs font-medium text-zinc-300 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400" />
              <span className="capitalize">{cameraMode}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
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
          <div className="hidden lg:flex items-center gap-1.5 bg-black/30 border border-white/10 px-2 py-1 rounded-lg backdrop-blur-md text-[11px] text-zinc-300 flex-shrink-0">
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

        {/* Exit Button to return to Hall/Lobby or Editor (High z-index, never cut off!) */}
        <div className="pointer-events-auto flex-shrink-0 z-40">
          <button
            id="exit-room-btn"
            type="button"
            onClick={onExitToLobby}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border backdrop-blur-md transition-colors cursor-pointer text-xs font-semibold shadow-lg ${
              room.isPlaytest
                ? 'bg-emerald-950/70 hover:bg-emerald-900 border-emerald-500/60 text-emerald-300 hover:text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-black/60 hover:bg-red-500/25 border-white/20 hover:border-red-500/50 text-zinc-200 hover:text-red-300'
            }`}
            title={room.isPlaytest ? 'Voltar para o Modo Criador' : 'Sair da sala e voltar ao Hall de Portais'}
          >
            <LogOut className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${room.isPlaytest ? 'rotate-180' : ''}`} />
            <span className="whitespace-nowrap">{room.isPlaytest ? 'Voltar' : 'Sair da Room'}</span>
          </button>
        </div>
      </header>

      {/* FLOATING ROOM AUDIO PLAYER (Web Radio & Playlist MP3) */}
      <RoomAudioPlayer
        radioUrl={room.radioUrl || room.editorRoom?.radioUrl}
        playlist={room.playlist || room.editorRoom?.playlist}
        roomName={room.name || 'Lounge'}
      />

      {/* TOP-LEFT HUD: 2D/3D Gizmo Widget with Setas & Spot Radius Clamping */}
      <div className="absolute top-20 left-3 sm:left-6 z-30 flex flex-col gap-2 pointer-events-auto">
        <GizmoWidget
          mode={gizmoMode}
          onCycleMode={handleCycleGizmoMode}
          transform={transform}
          onChangeTransform={setTransform}
          onSetMode={setGizmoMode}
          spotRadius={
            (spots.find((s) => s.id === currentSpotId) as any)?.relativeRadius ||
            (spots.find((s) => s.id === currentSpotId) as any)?.radius ||
            spotVisualConfig?.relativeSpotRadius ||
            0.45
          }
        />
      </div>

      {/* DRAGGABLE & MINIMIZABLE GLASS CHAT (Can be moved anywhere or minimized to keep screen clean) */}
      <GlassChat
        roomName={room.name || 'Lounge'}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
      />

      {/* SINGLE UNIFIED INVENTORY: Orientation toggleable (Horizontal at bottom / Vertical on left dock) */}
      <UnifiedRoomInventory
        slots={roomAccessSlots}
        onUpdateSlots={handleUpdateRoomAccessSlots}
        onSlotClick={handleTriggerAccessSlot}
        poses={poses}
        selectedPoseId={selectedPose.id}
        onSelectPose={setSelectedPose}
        storeAvatars={storeAvatars}
        activeUserAvatar={liveAvatar}
        onSelectAvatar={(av) => {
          setLiveAvatar(av);
          showHudToast(`👤 Avatar alterado para "${av.name}"!`);
        }}
        activeAvatarId={liveAvatar?.id}
        activePoseId={selectedPose.id}
        onShowToast={showHudToast}
      />

    </div>
  );
};
