import React from 'react';
import { Activity } from 'lucide-react';
import { ObjectAction, SpeechBubbleItem, Spot, StoreAvatar, CreatorUser } from '../types';

interface SpeechBubbleOverlayProps {
  bubbles: SpeechBubbleItem[];
  screenPositions: Record<number, { x: number; y: number }>;
  spots?: Spot[];
  currentSpotId?: number;
  activeUserAvatar?: StoreAvatar | null;
  user?: CreatorUser | null;
  remotePlayers?: any[];
  avatarActions?: ObjectAction[];
  activeAvatarActionId?: string | null;
  onToggleAvatarAction?: (actionId: string) => void;
}

export const SpeechBubbleOverlay: React.FC<SpeechBubbleOverlayProps> = ({
  bubbles,
  screenPositions,
  spots = [],
  currentSpotId = 2,
  activeUserAvatar,
  user,
  remotePlayers = [],
  avatarActions = [],
  activeAvatarActionId = null,
  onToggleAvatarAction,
}) => {
  const [isActionsOpen, setIsActionsOpen] = React.useState(false);
  // Pre-configured avatars for known participants
  const defaultUserPhoto =
    activeUserAvatar?.thumb ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

  const mayaPhoto =
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80';

  const lucasPhoto =
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80';

  const getSpotInfo = (spotId: number) => {
    const isPlayer = String(spotId) === String(currentSpotId);
    if (isPlayer) {
      return {
        name: user?.displayName ? `Você (${user.displayName})` : 'Você (Luzenne)',
        photo: defaultUserPhoto,
        isPlayer: true,
      };
    }

    // Check if there is a remote player occupying this spotId
    const remoteUser = remotePlayers.find(
      (p) => String(p.spotId) === String(spotId)
    );

    if (remoteUser) {
      const userPhoto =
        remoteUser.avatar?.thumb ||
        remoteUser.avatar?.asset_url ||
        (typeof remoteUser.avatar?.fileBlobUrl === 'string' && !remoteUser.avatar.fileBlobUrl.startsWith('blob:')
          ? remoteUser.avatar.fileBlobUrl
          : null) ||
        defaultUserPhoto;

      return {
        name: remoteUser.displayName || `Usuário ${spotId}`,
        photo: userPhoto,
        isPlayer: false,
        isRemoteUser: true,
      };
    }

    if (spotId === 1) {
      return {
        name: 'Maya',
        photo: mayaPhoto,
        isPlayer: false,
      };
    }
    if (spotId === 3) {
      return {
        name: 'Lucas',
        photo: lucasPhoto,
        isPlayer: false,
      };
    }

    const foundSpot = spots.find((s) => s.id === spotId || String(s.id) === String(spotId));
    return {
      name: foundSpot?.occupiedByName || foundSpot?.label || `Visitante ${spotId}`,
      photo: defaultUserPhoto,
      isPlayer: false,
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {Object.entries(screenPositions).map(([spotKey, pos]) => {
        const spotId = Number(spotKey);
        if (!pos) return null;

        const info = getSpotInfo(spotId);
        const bubble = bubbles.find((b) => b.spotId === spotId);

        return (
          <div
            key={`avatar-overlay-${spotId}`}
            className="absolute transform -translate-x-1/2 -translate-y-full transition-all duration-150 ease-out select-none flex flex-col items-center pointer-events-none"
            style={{
              left: `${pos.x}px`,
              top: `${pos.y - 10}px`,
            }}
          >
            {/* Speech Bubble (if any) placed above the name tag */}
            {bubble && (
              <div className="relative mb-2.5 bg-white text-zinc-950 font-bold px-4 py-2 rounded-[20px] shadow-[0_8px_25px_rgba(0,0,0,0.5)] text-base md:text-lg tracking-tight animate-bounce-short">
                <span>{bubble.text}</span>
                {/* Pointy Speech Bubble Tail pointing down */}
                <div
                  className="absolute left-1/2 -bottom-2 w-3.5 h-3.5 bg-white transform -translate-x-1/2 rotate-45"
                  style={{
                    clipPath: 'polygon(100% 100%, 0% 100%, 100% 0%)',
                  }}
                />
              </div>
            )}

            {/* Floating Name Tag with User Photo above 3D Avatar (matching User Request & Image 4) */}
            <div className="flex flex-col items-center gap-1 pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  if (info.isPlayer && avatarActions.length > 0) {
                    setIsActionsOpen((open) => !open);
                  }
                }}
                aria-expanded={info.isPlayer && avatarActions.length > 0 ? isActionsOpen : undefined}
                aria-label={
                  info.isPlayer && avatarActions.length > 0
                    ? `${info.name}, ${avatarActions.length} actions`
                    : info.name
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.85)] border transition-all ${
                  info.isPlayer
                    ? `bg-gradient-to-r from-black/90 via-[#1a1710]/90 to-black/90 border-[#ffd700]/80 shadow-[0_0_14px_rgba(255,215,0,0.25)] ${avatarActions.length ? 'cursor-pointer hover:border-cyan-300' : 'cursor-default'}`
                    : 'bg-black/80 border-white/20 cursor-default'
                }`}
              >
                <img
                  src={info.photo}
                  alt=""
                  className={`w-5 h-5 rounded-full object-cover border flex-shrink-0 ${
                    info.isPlayer ? 'border-[#ffd700]' : 'border-zinc-400'
                  }`}
                  referrerPolicy="no-referrer"
                />
                <span
                  className={`text-[11px] font-bold tracking-wide truncate max-w-[120px] ${
                    info.isPlayer ? 'text-[#ffd700]' : 'text-zinc-200'
                  }`}
                >
                  {info.name}
                </span>
                {info.isPlayer && (
                  <>
                    {avatarActions.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-cyan-200">
                        <Activity className="h-3 w-3" />
                        {avatarActions.length}
                      </span>
                    )}
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  </>
                )}
              </button>
              {info.isPlayer && isActionsOpen && avatarActions.length > 0 && (
                <div className="min-w-36 overflow-hidden rounded-lg border border-cyan-400/60 bg-[#090b10]/95 shadow-xl backdrop-blur-md">
                  {avatarActions.map((action, index) => {
                    const isActive = activeAvatarActionId === action.id;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => onToggleAvatarAction?.(action.id)}
                        aria-pressed={isActive}
                        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[10px] transition-colors ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-100'
                            : 'text-zinc-200 hover:bg-white/10'
                        }`}
                        title={isActive ? 'Clique novamente para parar' : `Ativar ${action.name}`}
                      >
                        <span className="w-4 text-right font-mono text-cyan-300">
                          {index + 1}.
                        </span>
                        <span className="max-w-32 truncate">{action.name}</span>
                        {isActive && (
                          <span className="ml-auto text-[8px] uppercase tracking-wide text-cyan-300">
                            Ativa
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
