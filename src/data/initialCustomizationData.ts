import { CustomizationItem, StoreAvatar, AvatarPoseConfig } from '../types';

// Apenas itens reais publicados pela comunidade/criador (sem objetos mock/fakes)
export const INITIAL_CUSTOMIZATION_ITEMS: CustomizationItem[] = [];

// Apenas avatares reais publicados e com modelos válidos
export const INITIAL_STORE_AVATARS: StoreAvatar[] = [];

// Poses reais publicadas e acessíveis nas salas
export const INITIAL_POSES: AvatarPoseConfig[] = [
  {
    id: 'pose-pe',
    name: 'Em pé',
    applied: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    description: 'Postura formal altiva com as mãos nos bolsos.',
    owned: true,
    isPublishedByCreator: true,
    rarity: 'COMUM',
  },
  {
    id: 'pose-sentar',
    name: 'Sentar',
    applied: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    description: 'Pose relaxada para assentos, poltronas e puffs.',
    owned: true,
    isPublishedByCreator: true,
    rarity: 'COMUM',
  },
  {
    id: 'pose-deitar',
    name: 'Deitar',
    applied: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    description: 'Postura reclinada para lounges e puffs do ambiente.',
    owned: true,
    isPublishedByCreator: true,
    rarity: 'COMUM',
  },
  {
    id: 'pose-rindo',
    name: 'Rindo',
    applied: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    description: 'Gesto expressivo e alegre com leve inclinação.',
    owned: true,
    isPublishedByCreator: true,
    rarity: 'COMUM',
  },
  {
    id: 'pose-acenar',
    name: 'Acenar',
    applied: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    description: 'Cumprimento cordial com uma das mãos erguida sutilmente.',
    owned: true,
    isPublishedByCreator: true,
    rarity: 'COMUM',
  },
  {
    id: 'pose-modelo',
    name: 'Modelo Noir',
    applied: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    description: 'Pose de passarela com rotação e angulação dramática.',
    owned: true,
    isPublishedByCreator: true,
    rarity: 'COMUM',
  },
];
