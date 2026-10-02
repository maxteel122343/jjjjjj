// Creator Mode Types
export type GizmoEditMode = 'elevar' | 'mover' | 'rodar' | 'escalar';

export type SpotType = 'pe' | 'sentar' | 'deitar';

export type MotionCurveTrajectory = 'linear' | 'arc' | 'circle_turn' | 'spiral' | 'wave';

export interface SpotMotionConfig {
  enabled: boolean;
  deltaPosition: [number, number, number]; // [dx, dy, dz] em metros (ex: [0, 0, 3] = frente 3m, [0, 2, 0] = sobe 2m)
  deltaRotation?: [number, number, number]; // [rotX, rotY, rotZ] em graus
  turnAngle?: number; // Ângulo para fazer volta / curva (ex: 180° ou 360°)
  deltaScale?: [number, number, number]; // [scaleX, scaleY, scaleZ]
  scaleFactor?: number; // Fator multiplicador de escala (ex: 1.0 -> 1.5x)
  curveTrajectory?: MotionCurveTrajectory; // 'linear' | 'arc' | 'circle_turn' | 'spiral' | 'wave'
  curveHeight?: number; // Altura da curva em arco em metros (ex: 1.5m)
  curveRadius?: number; // Raio para fazer a volta em metros (ex: 2.0m)
  speed: number; // velocidade numérica (0.2x a 5.0x)
  loop: boolean; // true = loop contínuo vai e vem; false = executa uma vez (one-shot)
  target: 'parent_object' | 'avatar' | 'both'; // objeto, avatar ou ambos juntos
  showGhostSpot?: boolean; // Exibir Spot Fantasma em movimento contínuo (padrão true)
  label?: string;
}

export interface SpotItem {
  id: string;
  name: string;
  type: SpotType;
  position: [number, number, number];
  rotation: number;
  parentObjectId?: string; // ID do objeto 3D ao qual o spot está fixado/relativo
  relativePosition?: [number, number, number]; // Coordenadas relativas locais [x, y, z] na superfície do objeto
  surfaceNormal?: [number, number, number]; // Vetor normal da superfície do objeto
  relativeRadius?: number;
  attachmentTag?: string;
  connectsToTags?: string[];
  motion?: SpotMotionConfig; // Configuração de movimento (Motion Spot)
}

export interface ObjectAction {
  id: string;
  name: string; // Ex: "Frente e Trás", "Girar e Crescer", "Órbita 360°"
  motion: SpotMotionConfig;
}

export type AccessoryAttachmentPoint =
  | 'head'
  | 'chest'
  | 'left_hand'
  | 'right_hand'
  | 'back'
  | 'companion_float'
  | 'custom';

export interface AccessoryTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface PlacedObject {
  id: string;
  assetId: string;
  name: string;
  type: 'cenario' | 'movel' | 'objeto' | 'avatar' | 'acessorio';
  isAvatar?: boolean;
  isAccessory?: boolean;
  accessoryAttachment?: AccessoryAttachmentPoint;
  accessoryTransform?: AccessoryTransform;
  actions?: ObjectAction[];
  activeActionId?: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  modelType?: 'sofa' | 'table' | 'chair' | 'plant' | 'house' | 'custom_glb' | 'avatar' | 'acessorio';
  fileBlobUrl?: string;
  rawDimensions?: [number, number, number];
  isMissingAsset?: boolean;
}

export interface InventoryItem {
  id: string;
  assetId?: string;
  fileName: string;
  displayName: string;
  name?: string;
  thumbUrl: string;
  thumbnailUrl?: string;
  type: 'Sala' | 'Avatar' | 'Item' | 'Acessorio' | 'sala' | 'avatar' | 'item' | 'acessorio' | 'cenario' | 'movel' | 'objeto' | 'pose';
  createdAt?: string;
  isScenario?: boolean;
  isAccessory?: boolean;
  actions?: ObjectAction[];
  accessoryAttachment?: AccessoryAttachmentPoint;
  accessoryTransform?: AccessoryTransform;
  fileBlobUrl?: string;
  modelType?: 'sofa' | 'table' | 'chair' | 'plant' | 'house' | 'custom_glb' | 'avatar' | 'acessorio';
  rawDimensions?: [number, number, number];
  isMissingAsset?: boolean;
}

export interface PlayableBoundary {
  x: number; // width in meters (e.g. 5.0)
  y: number; // height in meters (e.g. 2.8)
  z: number; // depth in meters (e.g. 6.5)
  position?: [number, number, number]; // [posX, posY, posZ] offset in meters
  isConfirmed: boolean;
}

export interface RoomEditorState {
  id: string;
  name: string;
  sceneAssetId: string | null;
  sceneAssetBlobUrl?: string;
  placedObjects: PlacedObject[];
  spots: SpotItem[];
  boundary: PlayableBoundary;
  isPublished: boolean;
  publishedAt?: string;
  isMissingAsset?: boolean;
}

export interface CreatorUser {
  id: string;
  email: string;
  displayName: string;
  isGuest: boolean;
}

export interface ProjectExportPackage {
  version: '1.0';
  exportedAt: string;
  projectName: string;
  activeRoomId: string;
  rooms: RoomEditorState[];
  inventory: InventoryItem[];
  customizationItems?: CustomizationItem[];
  storeAvatars?: StoreAvatar[];
  avatarPoses?: AvatarPoseConfig[];
  spotVisualConfig?: SpotVisualConfig;
  user?: CreatorUser | null;
  files?: Record<string, string>; // Model ID -> Base64 Data URL
}

// Spot Visualization Configurations (white pulse + point, yellow, or arrow only, with customizable sizes)
export type SpotVisualIndicatorStyle = 'white_pulse' | 'yellow_gold' | 'arrow_only' | 'full';

export interface SpotVisualConfig {
  indicatorStyle: SpotVisualIndicatorStyle;
  arrowScale: number; // 0.5 to 2.5
  signalScale: number; // 0.5 to 2.5
  relativeSpotRadius?: number;
}

// Social / Interactive Room Gizmo Modes (harmonized with Creator Mode)
export type GizmoMode = 'mover' | 'escalar' | 'rodar' | 'elevar' | 'scale' | 'sizeY' | 'angle';

export interface AvatarTransform {
  scale: number;
  sizeY: number;
  angle: number;
  positionOffset?: [number, number, number]; // [dx, dy, dz] from spot anchor
}

export interface AvatarPose {
  id: string;
  name: string;
  label?: string;
  fileName?: string;
  thumbnailUrl?: string;
  description?: string;
  badgeEmoji?: string;
  emoji?: string;
  glbKey?: string;
  heightOffset?: number;
  rotationOffset?: number;
  silhouette?: string;
  price?: number;
  owned?: boolean;
  author?: string;
  isPublishedByCreator?: boolean;
  associatedAvatarIds?: string[];
  associatedAvatarNames?: string[];
}

export interface Spot {
  id: number;
  name?: string;
  label?: string;
  position: [number, number, number];
  rotation: number;
  occupiedBy?: string;
  occupiedByName?: string;
  occupiedAvatar?: string;
  avatarColor?: string;
  isPlayer?: boolean;
}

export interface RoomData {
  id: string;
  name: string;
  previewUrl?: string;
  occupancy?: string;
  occupation?: string;
  currentUsers?: number;
  maxUsers?: number;
  theme?: string;
  description: string;
  badge?: string;
  thumb?: string;
  isFeatured?: boolean;
  ambientColor?: string;
  isCenterHighlighted?: boolean;
  editorRoomId?: string;
  isFromEditor?: boolean;
  editorRoom?: RoomEditorState;
  isPlaytest?: boolean;
  assetId?: string;
  isMissingAsset?: boolean;
}

export interface ChatMessage {
  id: string;
  user: string;
  avatarUrl: string;
  text: string;
  time: string;
  spotId: number;
  isPlayer?: boolean;
}

export interface SpeechBubbleItem {
  id: string;
  text: string;
  spotId: number;
  userName: string;
  createdAt: number;
}

export type ProductType = 'sala' | 'avatar' | 'acessorio' | 'item';

export interface UploadedProduct {
  id: string;
  fileName: string;
  displayName: string;
  thumbUrl: string;
  productType: ProductType;
  uploadedAt: string;
  author: string;
  equipped?: boolean;
  itemCategory?: 'head' | 'chest' | 'eyes';
}

export interface ShopItem {
  id: string;
  name: string;
  thumb: string;
  category: 'head' | 'chest' | 'eyes';
  equipped: boolean;
  description?: string;
  owned?: boolean;
}

export type CustomizationCategory = 'chapeus' | 'casacos' | 'sapatos' | 'acessorios' | 'avatares' | 'publicados' | 'todos';

export interface CustomizationItem {
  id: string;
  code: string; // e.g. #H001, #C001, #S001, #AC01
  name: string;
  category: 'chapeus' | 'casacos' | 'sapatos' | 'acessorios' | 'avatares' | 'publicados' | 'outros' | 'avatar' | 'itens' | 'mobilia' | 'poses' | 'salas';
  thumb: string;
  owned: boolean;
  equipped: boolean;
  slot?: string;
  assetId?: string;
  price?: number;
  rarity?: 'COMUM' | 'RARO' | 'ÉLITE';
  description?: string;
  isPublishedByCreator?: boolean;
  isUserPublished?: boolean;
  author?: string;
  fileBlobUrl?: string;
  originalItemId?: string;
  isAvatar?: boolean;
  isAccessory?: boolean;
  accessoryAttachment?: AccessoryAttachmentPoint;
  accessoryTransform?: AccessoryTransform;
  isLockedPosition?: boolean;
  actions?: ObjectAction[];
  activeActionId?: string | null;
  isMissingAsset?: boolean;
}

export interface StoreAvatar {
  id: string;
  name: string;
  rarity: 'COMUM' | 'RARO' | 'ÉLITE';
  price: number;
  thumb: string;
  tags: string[];
  owned: boolean;
  applied: boolean;
  assetId?: string;
  description?: string;
  author?: string;
  isUserPublished?: boolean;
  fileBlobUrl?: string;
  originalItemId?: string;
  isMissingAsset?: boolean;
}

export interface AvatarPoseConfig {
  id: string;
  name: string;
  applied: boolean;
  description?: string;
  thumbnailUrl?: string;
  price?: number;
  owned?: boolean;
  author?: string;
  isPublishedByCreator?: boolean;
  associatedAvatarIds?: string[];
  associatedAvatarNames?: string[];
  rarity?: 'COMUM' | 'RARO' | 'ÉLITE';
}

export interface RoomAccessSlot {
  slotIndex: number; // 0 to 7 (displayed as 1 to 8)
  id: string; // unique slot item id
  type: 'avatar' | 'pose';
  name: string;
  thumbnailUrl: string;
  itemId: string; // avatar id or pose id
  badge?: string;
  avatarData?: StoreAvatar;
  poseData?: AvatarPoseConfig;
}

export type StoreObjectType = 'avatar' | 'acessorio' | 'item' | 'pose' | 'sala' | 'moveis';

export interface PublishItemPayload {
  id?: string;
  assetId?: string;
  originalItemId?: string;
  name: string;
  objectType: StoreObjectType;
  price: number;
  hashtags: string[];
  thumbnailUrl: string;
  description?: string;
  rarity?: 'COMUM' | 'RARO' | 'ÉLITE';
  publishMode: 'simples' | 'avancado';
  fileBlobUrl?: string;
  author?: string;
  associatedAvatarIds?: string[];
  actions?: ObjectAction[];
  accessoryAttachment?: AccessoryAttachmentPoint;
  accessoryTransform?: AccessoryTransform;
  metadata?: Record<string, any>;
}
