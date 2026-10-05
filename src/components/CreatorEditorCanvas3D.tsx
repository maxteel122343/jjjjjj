import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  SpotItem,
  GizmoEditMode,
  PlayableBoundary,
  PlacedObject,
  InventoryItem,
  SpotVisualConfig,
  StoreAvatar,
  SpotMotionConfig,
} from '../types';
import { TrajectoryTimelineModal } from './TrajectoryTimelineModal';
import {
  ArrowUp,
  ArrowDown,
  Move,
  RotateCw,
  Maximize2,
  X,
  MapPin,
  ZoomIn,
  ZoomOut,
  Trash2,
  Sliders,
  ChevronDown,
  ChevronUp,
  Box,
  Loader2,
  RotateCcw,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Ruler,
  User,
  Grid,
  Layers,
  Crosshair,
  Tag,
  Sparkles,
  LogOut,
  Play,
  Pause,
} from 'lucide-react';
import { MetricSizeSelectorModal } from './MetricSizeSelectorModal';
import {
  METRIC_PRESETS,
  MetricPresetItem,
  calculatePresetScale,
} from '../types/metricPresets';

interface CreatorEditorCanvas3DProps {
  sceneAssetBlobUrl?: string | null;
  sceneAssetId?: string | null;
  placedObjects: PlacedObject[];
  spots: SpotItem[];
  boundary: PlayableBoundary;
  selectedSpotId: string | null;
  selectedObjectId: string | null;
  onSelectSpot: (id: string | null) => void;
  onSelectObject: (id: string | null) => void;
  onUpdateSpotPosition: (id: string, position: [number, number, number]) => void;
  onUpdateSpotRotation: (id: string, rotation: number) => void;
  onRemoveSpot: (id: string) => void;
  onClearAllSpots?: () => void;
  onRemoveOverlappingSpots?: () => void;
  onUpdateObjectTransform: (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }
  ) => void;
  onRemoveObject: (id: string) => void;
  onUpdateBoundary?: (boundary: PlayableBoundary) => void;
  onSceneClickInsertionPoint: (point: [number, number, number] | null) => void;
  insertionCursorPoint: [number, number, number] | null;
  isAvatarMode: boolean; // Toggle MODO AVATAR (ON = visitor teleport; OFF = edit)
  showBoundaryGhost: boolean; // Eye toggle (ON = show ghost wireframe, OFF = hidden)
  showSpots?: boolean; // Toggle to hide all spots so user can focus purely on 3D objects
  lockSpots?: boolean; // Toggle to disable spot controls so clicks target only 3D objects
  onToggleShowSpots?: () => void;
  onToggleLockSpots?: () => void;
  activeGizmoMode: GizmoEditMode;
  onChangeGizmoMode: (mode: GizmoEditMode) => void;
  avatarCurrentSpotId: string | null;
  onAvatarTeleport: (spotId: string) => void;
  customAvatarObjectId?: string | null;
  onSetCustomAvatarObjectId?: (id: string | null) => void;
  onUpdateObjectType?: (id: string, type: 'cenario' | 'movel' | 'objeto' | 'avatar' | 'acessorio') => void;
  onDropItemOnScene?: (item: InventoryItem, coords: [number, number, number]) => void;
  onAddSpotAtObject?: (objectId: string) => void;
  surfaceSnapTargetObjectId?: string | null;
  onCancelSurfaceSnap?: () => void;
  onAddRelativeSpot?: (
    parentId: string,
    relativePos: [number, number, number],
    normal: [number, number, number],
    worldPos: [number, number, number],
    relativeRadius?: number
  ) => void;
  testingMotionSpotId?: string | null;
  onToggleTestSpotMotion?: (spotId: string) => void;
  activeUserAvatar?: StoreAvatar | null;
  spotVisualConfig?: SpotVisualConfig;
  onUpdateSpotMotion?: (spotId: string, motion: SpotMotionConfig | undefined) => void;
  onOpenTrajectoryTimeline?: (spotId: string) => void;
  onUpdateSpotTags?: (spotId: string, attachmentTag?: string, connectsToTags?: string[]) => void;
  onUpdateSpotRelativeRadius?: (spotId: string, radius: number) => void;
  onConnectSpotsByTag?: (sourceSpotId: string, targetSpotId: string) => void;
  testingObjectAction?: { objectId: string; actionId: string } | null;
  onExitEditor?: () => void;
}

// Reusable safe numeric input that preserves intermediate typing and strictly prevents NaN/zero-scale
interface NumericInputProps {
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  className?: string;
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  step = 0.05,
  min,
  max,
  precision = 2,
  className = '',
}) => {
  const safeVal = Number.isFinite(value) ? Number(value.toFixed(precision)) : 0;
  const [localStr, setLocalStr] = useState<string>(safeVal.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused && Number.isFinite(value)) {
      setLocalStr(Number(value.toFixed(precision)).toString());
    }
  }, [value, isFocused, precision]);

  const commit = (str: string) => {
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && isFinite(parsed)) {
      let clamped = parsed;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      const finalVal = parseFloat(clamped.toFixed(precision));
      onChange(finalVal);
      setLocalStr(finalVal.toString());
    } else {
      setLocalStr(Number(value.toFixed(precision)).toString());
    }
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={isFocused ? localStr : safeVal.toString()}
      onFocus={() => {
        setIsFocused(true);
        setLocalStr(safeVal.toString());
      }}
      onChange={(e) => {
        setLocalStr(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed) && isFinite(parsed)) {
          let clamped = parsed;
          if (min !== undefined) clamped = Math.max(min, clamped);
          if (max !== undefined) clamped = Math.min(max, clamped);
          onChange(parseFloat(clamped.toFixed(precision)));
        }
      }}
      onBlur={() => {
        setIsFocused(false);
        commit(localStr);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          commit(localStr);
          (e.target as HTMLInputElement).blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={className}
    />
  );
};

export const CreatorEditorCanvas3D: React.FC<CreatorEditorCanvas3DProps> = ({
  sceneAssetBlobUrl,
  sceneAssetId,
  placedObjects,
  spots,
  boundary,
  selectedSpotId,
  selectedObjectId,
  onSelectSpot,
  onSelectObject,
  onUpdateSpotPosition,
  onUpdateSpotRotation,
  onRemoveSpot,
  onClearAllSpots,
  onRemoveOverlappingSpots,
  onUpdateObjectTransform,
  onRemoveObject,
  onUpdateBoundary,
  onSceneClickInsertionPoint,
  insertionCursorPoint,
  isAvatarMode,
  showBoundaryGhost,
  showSpots = true,
  lockSpots = false,
  onToggleShowSpots,
  onToggleLockSpots,
  activeGizmoMode,
  onChangeGizmoMode,
  avatarCurrentSpotId,
  onAvatarTeleport,
  customAvatarObjectId = null,
  onSetCustomAvatarObjectId,
  onUpdateObjectType,
  onDropItemOnScene,
  onAddSpotAtObject,
  surfaceSnapTargetObjectId = null,
  onCancelSurfaceSnap,
  onAddRelativeSpot,
  testingMotionSpotId = null,
  onToggleTestSpotMotion,
  activeUserAvatar = null,
  spotVisualConfig,
  onUpdateSpotMotion,
  onOpenTrajectoryTimeline,
  onUpdateSpotTags,
  onUpdateSpotRelativeRadius,
  onConnectSpotsByTag,
  testingObjectAction = null,
  onExitEditor,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const defaultRoomGroupRef = useRef<THREE.Group | null>(null);
  const customScenarioGroupRef = useRef<THREE.Group | null>(null);
  const placedObjectsGroupRef = useRef<THREE.Group | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const activeAvatarHaloRef = useRef<THREE.Group | null>(null);
  const boundaryWireframeRef = useRef<THREE.LineSegments | null>(null);
  const insertionMarkerRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number>(0);
  const transformControlsRef = useRef<TransformControls | null>(null);

  const testingObjectActionRef = useRef(testingObjectAction);
  testingObjectActionRef.current = testingObjectAction;

  // Surface Snap Radius (ajuste de tamanho que percorre a região do objeto)
  const [surfaceSnapRadius, setSurfaceSnapRadius] = useState<number>(
    () => spotVisualConfig?.relativeSpotRadius || 0.10
  );
  const surfaceSnapRadiusRef = useRef<number>(surfaceSnapRadius);
  useEffect(() => {
    surfaceSnapRadiusRef.current = surfaceSnapRadius;
  }, [surfaceSnapRadius]);

  // Surface ring mesh and snapping refs
  const surfaceRingMeshRef = useRef<THREE.Mesh | null>(null);
  const currentSurfaceHitRef = useRef<{
    point: THREE.Vector3;
    normal: THREE.Vector3;
    localPoint: THREE.Vector3;
    targetObjectId?: string | null;
  } | null>(null);
  const surfaceSnapTargetObjectIdRef = useRef<string | null>(surfaceSnapTargetObjectId || null);
  useEffect(() => {
    surfaceSnapTargetObjectIdRef.current = surfaceSnapTargetObjectId || null;
  }, [surfaceSnapTargetObjectId]);

  // Live component props refs ensuring Three.js animation loop never uses stale closures
  const spotsRef = useRef<SpotItem[]>(spots);
  spotsRef.current = spots;
  const testingMotionSpotIdRef = useRef<string | null>(testingMotionSpotId);
  testingMotionSpotIdRef.current = testingMotionSpotId;
  const selectedSpotIdRef = useRef<string | null>(selectedSpotId);
  selectedSpotIdRef.current = selectedSpotId;
  const placedObjectsRef = useRef<PlacedObject[]>(placedObjects);
  placedObjectsRef.current = placedObjects;
  const isAvatarModeRef = useRef<boolean>(isAvatarMode);
  isAvatarModeRef.current = isAvatarMode;
  const avatarCurrentSpotIdRef = useRef<string | null>(avatarCurrentSpotId);
  avatarCurrentSpotIdRef.current = avatarCurrentSpotId;
  const showSpotsRef = useRef<boolean>(!!showSpots);
  showSpotsRef.current = !!showSpots;
  const customAvatarObjectIdRef = useRef<string | null>(customAvatarObjectId || null);
  customAvatarObjectIdRef.current = customAvatarObjectId || null;

  // Dedicated Motion Simulation Test Refs (Spot Fantasma & 3D trajectory path)
  const motionSimPointGroupRef = useRef<THREE.Group | null>(null);
  const motionSimTrajectoryLineRef = useRef<THREE.Line | null>(null);
  const baseSpotAnchorRef = useRef<THREE.Group | null>(null);
  const activeGhostMotionInfoRef = useRef<{
    spotId: string;
    spotName: string;
    factor: number;
    offset: [number, number, number];
    basePos: [number, number, number];
  } | null>(null);

  // Video-editing style timeline state & refs for trajectory preview & scrubbing
  const [isTimelinePlaying, setIsTimelinePlaying] = useState<boolean>(true);
  const [timelineProgress, setTimelineProgress] = useState<number>(0);
  const timelineProgressRef = useRef<number>(0);
  const isTimelinePlayingRef = useRef<boolean>(true);
  const spotVisualConfigRef = useRef<SpotVisualConfig | undefined>(spotVisualConfig);
  spotVisualConfigRef.current = spotVisualConfig;

  useEffect(() => {
    timelineProgressRef.current = timelineProgress;
  }, [timelineProgress]);

  useEffect(() => {
    isTimelinePlayingRef.current = isTimelinePlaying;
  }, [isTimelinePlaying]);

  useEffect(() => {
    if (testingMotionSpotId) {
      setIsTimelinePlaying(true);
      isTimelinePlayingRef.current = true;
      setTimelineProgress(0);
      timelineProgressRef.current = 0;
    }
    // Note: Do not pause playback or hide ghost spot when testingMotionSpotId is null,
    // so any spot with spot.motion.enabled continues animating continuously as a Spot Fantasma!
  }, [testingMotionSpotId]);

  // Center click cycle mode: Mover -> Escalar -> Rodar -> Mover
  // "se o usuairo clica no centro gismo muda p scala se clica de novo mud ap mover se lcia de novo muda p rotação"
  const handleCycleGizmoMode = () => {
    if (activeGizmoMode === 'mover') onChangeGizmoMode('escalar');
    else if (activeGizmoMode === 'escalar') onChangeGizmoMode('rodar');
    else onChangeGizmoMode('mover');
  };

  // Metric Reference System Groups & State (Avatar 1.70m, Grid 1m x 1m, Room 6x8x2.8m, Vertical Spatial Grid)
  const metricGridGroupRef = useRef<THREE.Group | null>(null);
  const floorMeterLabelsGroupRef = useRef<THREE.Group | null>(null);
  const spatialVerticalGridGroupRef = useRef<THREE.Group | null>(null);
  const referenceAvatarGroupRef = useRef<THREE.Group | null>(null);
  const roomBoundaryGroupRef = useRef<THREE.Group | null>(null);
  const heightIndicatorGroupRef = useRef<THREE.Group | null>(null);
  const spotsFloorGroupRef = useRef<THREE.Group | null>(null);
  const [showReferenceAvatar, setShowReferenceAvatar] = useState<boolean>(true);
  const [isReferenceAvatarSelected, setIsReferenceAvatarSelected] = useState<boolean>(false);
  const [showMetricGrid, setShowMetricGrid] = useState<boolean>(true);
  const [showFloorMeterLabels, setShowFloorMeterLabels] = useState<boolean>(false); // Ocultar marcadores de metros no chão por padrão
  const [showSpatialVerticalGrid, setShowSpatialVerticalGrid] = useState<boolean>(true);
  const [spatialGridOrigin, setSpatialGridOrigin] = useState<[number, number, number] | null>(null);
  const [isSizeSelectorModalOpen, setIsSizeSelectorModalOpen] = useState<boolean>(false);

  // Camera Orbit & Pan Navigation (Right click / Middle click drag to pan camera)
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0.3, 0.7, -0.6));
  const isPanningRef = useRef<boolean>(false);
  const hasMovedMouseDuringDownRef = useRef<boolean>(false);

  // Measured raw model bounding boxes for accurate real-world scaling & Encaixar no Metro
  const rawDimensionsMapRef = useRef<
    Map<
      string,
      {
        width: number;
        height: number;
        depth: number;
        targetHeight: number;
        label: string;
        isRoom: boolean;
      }
    >
  >(new Map());
  const [rawDimensionsState, setRawDimensionsState] = useState<{
    [id: string]: {
      width: number;
      height: number;
      depth: number;
      targetHeight: number;
      label: string;
      isRoom: boolean;
    };
  }>({});

  // High-performance object mesh and GLTF model caches (prevents destruction & reloads)
  const meshMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const gltfCacheRef = useRef<Map<string, THREE.Group>>(new Map());

  // Throttled transform sync to React state during dragging
  const pendingTransformUpdateRef = useRef<{
    id: string;
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    };
  } | null>(null);
  const dragRafIdRef = useRef<number | null>(null);

  const scheduleReactTransformUpdate = (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }
  ) => {
    pendingTransformUpdateRef.current = { id, transform };
    if (!dragRafIdRef.current) {
      dragRafIdRef.current = requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        if (pendingTransformUpdateRef.current) {
          onUpdateObjectTransformRef.current(
            pendingTransformUpdateRef.current.id,
            pendingTransformUpdateRef.current.transform
          );
          pendingTransformUpdateRef.current = null;
        }
      });
    }
  };

  const flushReactTransformUpdate = () => {
    if (dragRafIdRef.current) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    if (pendingTransformUpdateRef.current) {
      onUpdateObjectTransformRef.current(
        pendingTransformUpdateRef.current.id,
        pendingTransformUpdateRef.current.transform
      );
      pendingTransformUpdateRef.current = null;
    }
  };

  // Keep refs for event listeners
  const selectedObjectIdRef = useRef<string | null>(selectedObjectId);
  selectedObjectIdRef.current = selectedObjectId;
  const onUpdateObjectTransformRef = useRef(onUpdateObjectTransform);
  onUpdateObjectTransformRef.current = onUpdateObjectTransform;
  const onUpdateSpotPositionRef = useRef(onUpdateSpotPosition);
  onUpdateSpotPositionRef.current = onUpdateSpotPosition;
  const onUpdateSpotRotationRef = useRef(onUpdateSpotRotation);
  onUpdateSpotRotationRef.current = onUpdateSpotRotation;
  const spotGizmoAnchorRef = useRef<THREE.Group | null>(null);
  const activeGizmoModeRef = useRef(activeGizmoMode);
  activeGizmoModeRef.current = activeGizmoMode;

  // Loading indicator state for 3D GLB scenarios
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);
  const [scenarioLoadingMsg, setScenarioLoadingMsg] = useState('Carregando cenário 3D...');

  // Precision Inspector minimize toggle
  const [isInspectorMinimized, setIsInspectorMinimized] = useState(false);

  // Screen positions for 2D UI overlays
  const [spotGizmoScreenPos, setSpotGizmoScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [objectGizmoScreenPos, setObjectGizmoScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Camera angles with wide limitless zoom
  const cameraAngleRef = useRef({ theta: 0.02, phi: 0.22, distance: 5.6 });
  const isOrbitingRef = useRef(false);
  const isTransformDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Direct object drag on floor (Blender style)
  const isDirectDraggingObjectRef = useRef(false);
  const directDragStartPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const directDragStartMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const directDragStartRotYRef = useRef<number>(0);
  const directDragStartScaleRef = useRef<number>(1);

  // Spot dragging in screen space
  const isDraggingSpotRef = useRef(false);

  // 1. Initial Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101115');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.005,
      6000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Architectural Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const ceilingKeyLight = new THREE.DirectionalLight(0xfff7ed, 1.3);
    ceilingKeyLight.position.set(2.5, 6, 3);
    ceilingKeyLight.castShadow = true;
    ceilingKeyLight.shadow.mapSize.width = 1024;
    ceilingKeyLight.shadow.mapSize.height = 1024;
    ceilingKeyLight.shadow.camera.near = 0.5;
    ceilingKeyLight.shadow.camera.far = 25;
    scene.add(ceilingKeyLight);

    const fillLight = new THREE.DirectionalLight(0x8c96a5, 0.45);
    fillLight.position.set(-4, 4, 1);
    scene.add(fillLight);

    const scenarioSunLight = new THREE.DirectionalLight(0xfffae6, 0.7);
    scenarioSunLight.position.set(0, 7, -3);
    scene.add(scenarioSunLight);

    // Default Architecture Room Group
    const defaultRoomGroup = new THREE.Group();
    scene.add(defaultRoomGroup);
    defaultRoomGroupRef.current = defaultRoomGroup;

    // Floor (Dark charcoal tiles, fine grout)
    const floorTexture = createFloorTileTexture();
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(12, 12);

    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d22,
      map: floorTexture,
      roughness: 0.88,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    defaultRoomGroup.add(floor);
    floorMeshRef.current = floor;

    // Dark grey textured walls
    const wallTexture = createWallTileTexture();
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(10, 4);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x18191d,
      map: wallTexture,
      roughness: 0.95,
      metalness: 0.05,
    });

    const backWallGeo = new THREE.PlaneGeometry(36, 12);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 6, -6.5);
    backWall.receiveShadow = true;
    backWall.name = 'backWall';
    defaultRoomGroup.add(backWall);

    const leftWallGeo = new THREE.PlaneGeometry(36, 12);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-10, 6, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    leftWall.name = 'leftWall';
    defaultRoomGroup.add(leftWall);

    const rightWallGeo = new THREE.PlaneGeometry(36, 12);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.position.set(10, 6, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    rightWall.name = 'rightWall';
    defaultRoomGroup.add(rightWall);

    // Group for Custom GLB Scenario or procedural room architecture
    const customScenarioGroup = new THREE.Group();
    scene.add(customScenarioGroup);
    customScenarioGroupRef.current = customScenarioGroup;

    // Group for Placed 3D Objects
    const placedObjectsGroup = new THREE.Group();
    scene.add(placedObjectsGroup);
    placedObjectsGroupRef.current = placedObjectsGroup;

    // Surface Cursor / Ring group for relative surface spot snapping with adjustable size & precision crosshair
    const surfaceRingGroup = new THREE.Group();
    const surfaceRingGeo = new THREE.RingGeometry(0.02, 0.12, 32);
    const surfaceRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const surfaceRingMesh = new THREE.Mesh(surfaceRingGeo, surfaceRingMat);
    surfaceRingMesh.renderOrder = 999;
    surfaceRingGroup.add(surfaceRingMesh);

    // Laser Center Dot (Micro-ponto central para ver exatamente onde fixa)
    const centerPinGeo = new THREE.SphereGeometry(0.012, 16, 16);
    const centerPinMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false });
    const centerPin = new THREE.Mesh(centerPinGeo, centerPinMat);
    centerPin.renderOrder = 1000;
    surfaceRingGroup.add(centerPin);

    // Precision Crosshairs
    const surfaceCrossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.12, 0, 0),
      new THREE.Vector3(0.12, 0, 0),
      new THREE.Vector3(0, -0.12, 0),
      new THREE.Vector3(0, 0.12, 0),
    ]);
    const surfaceCrossMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, depthTest: false });
    const surfaceCross = new THREE.LineSegments(surfaceCrossGeo, surfaceCrossMat);
    surfaceCross.renderOrder = 1000;
    surfaceRingGroup.add(surfaceCross);

    surfaceRingGroup.visible = false;
    scene.add(surfaceRingGroup);
    surfaceRingMeshRef.current = surfaceRingGroup as any;

    // 3D TransformControls (Blender-like 3D visual handles)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    transformControls.setTranslationSnap(0.05); // Clean 5cm grid snap
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(5)); // Clean 5 deg snap
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    let tcRafId: number | null = null;
    transformControls.addEventListener('dragging-changed', (event: any) => {
      isTransformDraggingRef.current = event.value;
      isOrbitingRef.current = false;
      if (!event.value) {
        if (tcRafId) {
          cancelAnimationFrame(tcRafId);
          tcRafId = null;
        }
        const attached = transformControls.object;
        if (attached && selectedObjectIdRef.current) {
          const px = Number.isFinite(attached.position.x) ? parseFloat(attached.position.x.toFixed(2)) : 0;
          const py = Number.isFinite(attached.position.y) ? parseFloat(attached.position.y.toFixed(2)) : 0;
          const pz = Number.isFinite(attached.position.z) ? parseFloat(attached.position.z.toFixed(2)) : 0;
          const rx = Number.isFinite(attached.rotation.x) ? parseFloat(attached.rotation.x.toFixed(2)) : 0;
          const ry = Number.isFinite(attached.rotation.y) ? parseFloat(attached.rotation.y.toFixed(2)) : 0;
          const rz = Number.isFinite(attached.rotation.z) ? parseFloat(attached.rotation.z.toFixed(2)) : 0;
          const sx = Number.isFinite(attached.scale.x) && attached.scale.x >= 0.05 ? parseFloat(attached.scale.x.toFixed(2)) : 1;
          const sy = Number.isFinite(attached.scale.y) && attached.scale.y >= 0.05 ? parseFloat(attached.scale.y.toFixed(2)) : 1;
          const sz = Number.isFinite(attached.scale.z) && attached.scale.z >= 0.05 ? parseFloat(attached.scale.z.toFixed(2)) : 1;
          onUpdateObjectTransformRef.current(selectedObjectIdRef.current, {
            position: [px, py, pz],
            rotation: [rx, ry, rz],
            scale: [sx, sy, sz],
          });
        } else if (attached && selectedSpotIdRef.current) {
          const px = Number.isFinite(attached.position.x) ? parseFloat(attached.position.x.toFixed(2)) : 0;
          const py = Number.isFinite(attached.position.y) ? parseFloat(attached.position.y.toFixed(2)) : 0;
          const pz = Number.isFinite(attached.position.z) ? parseFloat(attached.position.z.toFixed(2)) : 0;
          const deg = Math.round(((THREE.MathUtils.radToDeg(attached.rotation.y) % 360) + 360) % 360);
          onUpdateSpotPositionRef.current(selectedSpotIdRef.current, [px, py, pz]);
          onUpdateSpotRotationRef.current(selectedSpotIdRef.current, deg);
        }
      }
    });

    transformControls.addEventListener('objectChange', () => {
      const attached = transformControls.object;
      if (!attached) return;

      // Real-time spatial height & 3D coordinate guidelines sync during dragging
      if (heightIndicatorGroupRef.current) {
        const grp = heightIndicatorGroupRef.current;
        updateSpatialIndicatorGroup(grp, attached.position.x, attached.position.y, attached.position.z);
      }

      if (tcRafId) cancelAnimationFrame(tcRafId);
      tcRafId = requestAnimationFrame(() => {
        tcRafId = null;
        if (selectedObjectIdRef.current) {
          const px = Number.isFinite(attached.position.x) ? parseFloat(attached.position.x.toFixed(2)) : 0;
          const py = Number.isFinite(attached.position.y) ? parseFloat(attached.position.y.toFixed(2)) : 0;
          const pz = Number.isFinite(attached.position.z) ? parseFloat(attached.position.z.toFixed(2)) : 0;
          const rx = Number.isFinite(attached.rotation.x) ? parseFloat(attached.rotation.x.toFixed(2)) : 0;
          const ry = Number.isFinite(attached.rotation.y) ? parseFloat(attached.rotation.y.toFixed(2)) : 0;
          const rz = Number.isFinite(attached.rotation.z) ? parseFloat(attached.rotation.z.toFixed(2)) : 0;
          const sx = Number.isFinite(attached.scale.x) && attached.scale.x >= 0.05 ? parseFloat(attached.scale.x.toFixed(2)) : 1;
          const sy = Number.isFinite(attached.scale.y) && attached.scale.y >= 0.05 ? parseFloat(attached.scale.y.toFixed(2)) : 1;
          const sz = Number.isFinite(attached.scale.z) && attached.scale.z >= 0.05 ? parseFloat(attached.scale.z.toFixed(2)) : 1;
          onUpdateObjectTransformRef.current(selectedObjectIdRef.current, {
            position: [px, py, pz],
            rotation: [rx, ry, rz],
            scale: [sx, sy, sz],
          });
        } else if (selectedSpotIdRef.current) {
          const px = Number.isFinite(attached.position.x) ? parseFloat(attached.position.x.toFixed(2)) : 0;
          const py = Number.isFinite(attached.position.y) ? parseFloat(attached.position.y.toFixed(2)) : 0;
          const pz = Number.isFinite(attached.position.z) ? parseFloat(attached.position.z.toFixed(2)) : 0;
          const deg = Math.round(((THREE.MathUtils.radToDeg(attached.rotation.y) % 360) + 360) % 360);
          onUpdateSpotPositionRef.current(selectedSpotIdRef.current, [px, py, pz]);
          onUpdateSpotRotationRef.current(selectedSpotIdRef.current, deg);
        }
      });
    });

    // 3D Anchor for Spot Gizmo (allows full 3D manipulation of spots in the scene)
    const spotGizmoAnchor = new THREE.Group();
    spotGizmoAnchor.name = 'spotGizmoAnchor';
    const spotDiscGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32);
    const spotDiscMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      transparent: true,
      opacity: 0.65,
    });
    const spotDisc = new THREE.Mesh(spotDiscGeo, spotDiscMat);
    spotDisc.position.y = 0.02;
    spotGizmoAnchor.add(spotDisc);

    // Exact luminous center point (Bullseye) at (0, 0.03, 0)
    const centerPointGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const centerPointMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerPoint = new THREE.Mesh(centerPointGeo, centerPointMat);
    centerPoint.position.set(0, 0.03, 0);
    spotGizmoAnchor.add(centerPoint);

    // Exact direction arrow originating from center and staying strictly within the 0.3m disc
    const arrowDir = new THREE.Vector3(0, 0, -1);
    const arrowOrigin = new THREE.Vector3(0, 0.035, 0);
    const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowOrigin, 0.28, 0xffd700, 0.10, 0.07);
    spotGizmoAnchor.add(arrowHelper);

    // Precision crosshairs on the spot disc
    const spotCrossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.28, 0.025, 0),
      new THREE.Vector3(0.28, 0.025, 0),
      new THREE.Vector3(0, 0.025, -0.28),
      new THREE.Vector3(0, 0.025, 0.28),
    ]);
    const spotCrossMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8 });
    const spotCross = new THREE.LineSegments(spotCrossGeo, spotCrossMat);
    spotGizmoAnchor.add(spotCross);

    spotGizmoAnchor.visible = false;
    scene.add(spotGizmoAnchor);
    spotGizmoAnchorRef.current = spotGizmoAnchor;

    // 3D Visual floor target discs for ALL spots in the scene
    const spotsFloorGroup = new THREE.Group();
    spotsFloorGroup.name = 'spotsFloorGroup';
    scene.add(spotsFloorGroup);
    spotsFloorGroupRef.current = spotsFloorGroup;

    // Avatar mesh for visitor mode
    const avatarGroup = createSimpleAvatarMesh();
    avatarGroup.position.set(0.8, 0.02, 1.1);
    avatarGroup.visible = false;
    scene.add(avatarGroup);
    avatarGroupRef.current = avatarGroup;

    // Active Avatar Halo Ground Indicator
    const avatarHaloGroup = new THREE.Group();
    const haloRingGeo = new THREE.RingGeometry(0.38, 0.48, 32);
    const haloRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const haloRing = new THREE.Mesh(haloRingGeo, haloRingMat);
    haloRing.rotation.x = -Math.PI / 2;
    avatarHaloGroup.add(haloRing);

    const innerDiscGeo = new THREE.CircleGeometry(0.36, 32);
    const innerDiscMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    });
    const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    innerDisc.rotation.x = -Math.PI / 2;
    avatarHaloGroup.add(innerDisc);

    avatarHaloGroup.visible = false;
    scene.add(avatarHaloGroup);
    activeAvatarHaloRef.current = avatarHaloGroup;

    // Insertion Point 3D Marker
    const markerGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.18, 0.24, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const markerRing = new THREE.Mesh(ringGeo, ringMat);
    markerRing.rotation.x = -Math.PI / 2;
    markerGroup.add(markerRing);

    const pinGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.y = 0.2;
    markerGroup.add(pin);

    markerGroup.visible = false;
    scene.add(markerGroup);
    insertionMarkerRef.current = markerGroup;

    // 3D Anchor for the Defined Base Spot (Shows stationary anchor origin when motion is active)
    const baseSpotAnchor = new THREE.Group();
    baseSpotAnchor.name = 'baseSpotAnchor';
    baseSpotAnchor.renderOrder = 9995;

    // Base stationary gold disc & ring on floor
    const baseRingGeo = new THREE.RingGeometry(0.30, 0.44, 32);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.025;
    baseSpotAnchor.add(baseRing);

    // Crosshairs on base anchor
    const baseCrossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.35, 0.03, 0),
      new THREE.Vector3(0.35, 0.03, 0),
      new THREE.Vector3(0, 0.03, -0.35),
      new THREE.Vector3(0, 0.03, 0.35),
    ]);
    const baseCrossMat = new THREE.LineBasicMaterial({ color: 0xffd700, depthTest: false });
    const baseCross = new THREE.LineSegments(baseCrossGeo, baseCrossMat);
    baseSpotAnchor.add(baseCross);

    // Floating text label sprite on base anchor: "⚓ SPOT BASE (DEFINIDO)"
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = 380;
    baseCanvas.height = 70;
    const bCtx = baseCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = 'rgba(15, 12, 5, 0.94)';
      bCtx.roundRect(4, 4, 372, 62, 14);
      bCtx.fill();
      bCtx.lineWidth = 2.5;
      bCtx.strokeStyle = '#ffd700';
      bCtx.stroke();
      bCtx.fillStyle = '#ffd700';
      bCtx.font = 'bold 22px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText('⚓ SPOT BASE (DEFINIDO)', 190, 35);
    }
    const baseTex = new THREE.CanvasTexture(baseCanvas);
    const baseSpriteMat = new THREE.SpriteMaterial({ map: baseTex, depthTest: false, transparent: true });
    const baseSprite = new THREE.Sprite(baseSpriteMat);
    baseSprite.position.set(0, 0.55, 0);
    baseSprite.scale.set(1.4, 0.28, 1.0);
    baseSprite.renderOrder = 9996;
    baseSpotAnchor.add(baseSprite);

    baseSpotAnchor.visible = false;
    scene.add(baseSpotAnchor);
    baseSpotAnchorRef.current = baseSpotAnchor;

    // Dedicated Motion Simulation Group: SPOT FANTASMA (Holographic moving replica)
    const motionSimGroup = new THREE.Group();
    motionSimGroup.name = 'motionSimGroup';
    motionSimGroup.renderOrder = 9999;

    // Glowing ethereal cyan sphere (Ponto simulado de alta visibilidade)
    const simOrbGeo = new THREE.SphereGeometry(0.24, 32, 32);
    const simOrbMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const simOrb = new THREE.Mesh(simOrbGeo, simOrbMat);
    simOrb.position.y = 0.24;
    simOrb.renderOrder = 9999;
    motionSimGroup.add(simOrb);

    // Bright inner core
    const simCoreGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const simCoreMat = new THREE.MeshBasicMaterial({ color: 0xffea00, depthTest: false });
    const simCore = new THREE.Mesh(simCoreGeo, simCoreMat);
    simCore.position.y = 0.24;
    simCore.renderOrder = 10000;
    motionSimGroup.add(simCore);

    // Ethereal Ghost Avatar Hologram silhouette (Translucent humanoid mannequin 1.70m)
    const ghostAvatarGroup = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.60,
      depthTest: false,
    });
    // Ghost Head
    const gHeadGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const gHead = new THREE.Mesh(gHeadGeo, ghostMat);
    gHead.position.y = 1.55;
    ghostAvatarGroup.add(gHead);
    // Glowing ghost eyes
    const gEyeGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const gEyeMat = new THREE.MeshBasicMaterial({ color: 0xffea00, depthTest: false });
    const gEyeL = new THREE.Mesh(gEyeGeo, gEyeMat);
    gEyeL.position.set(-0.04, 1.57, -0.10);
    const gEyeR = new THREE.Mesh(gEyeGeo, gEyeMat);
    gEyeR.position.set(0.04, 1.57, -0.10);
    ghostAvatarGroup.add(gEyeL);
    ghostAvatarGroup.add(gEyeR);
    // Ghost Torso
    const gTorsoGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.55, 16);
    const gTorso = new THREE.Mesh(gTorsoGeo, ghostMat);
    gTorso.position.y = 1.15;
    ghostAvatarGroup.add(gTorso);
    // Ghost Legs
    const gLegGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.75, 12);
    const gLegL = new THREE.Mesh(gLegGeo, ghostMat);
    gLegL.position.set(-0.08, 0.45, 0);
    const gLegR = new THREE.Mesh(gLegGeo, ghostMat);
    gLegR.position.set(0.08, 0.45, 0);
    ghostAvatarGroup.add(gLegL);
    ghostAvatarGroup.add(gLegR);
    ghostAvatarGroup.renderOrder = 9998;
    motionSimGroup.add(ghostAvatarGroup);

    // Direction arrow (indicates orientation / heading)
    const simArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.24, 0),
      0.65,
      0xffd700,
      0.20,
      0.14
    );
    simArrow.renderOrder = 10000;
    motionSimGroup.add(simArrow);

    // Ground Halo ring
    const simHaloGeo = new THREE.RingGeometry(0.35, 0.60, 32);
    const simHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.90,
      depthTest: false,
    });
    const simHalo = new THREE.Mesh(simHaloGeo, simHaloMat);
    simHalo.rotation.x = -Math.PI / 2;
    simHalo.position.y = 0.035;
    simHalo.renderOrder = 9998;
    motionSimGroup.add(simHalo);

    // Floating text label sprite: "👻 SPOT FANTASMA (EM MOVIMENTO)"
    const simCanvas = document.createElement('canvas');
    simCanvas.width = 420;
    simCanvas.height = 80;
    const sCtx = simCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = 'rgba(6, 18, 30, 0.94)';
      sCtx.roundRect(4, 4, 412, 72, 16);
      sCtx.fill();
      sCtx.lineWidth = 3;
      sCtx.strokeStyle = '#00f5ff';
      sCtx.stroke();
      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.textBaseline = 'middle';
      sCtx.fillText('👻 SPOT FANTASMA (EM MOVIMENTO)', 210, 40);
    }
    const simTex = new THREE.CanvasTexture(simCanvas);
    const simSpriteMat = new THREE.SpriteMaterial({ map: simTex, depthTest: false, transparent: true });
    const simSprite = new THREE.Sprite(simSpriteMat);
    simSprite.position.set(0, 1.85, 0);
    simSprite.scale.set(1.6, 0.32, 1.0);
    simSprite.renderOrder = 10002;
    motionSimGroup.add(simSprite);

    motionSimGroup.visible = false;
    scene.add(motionSimGroup);
    motionSimPointGroupRef.current = motionSimGroup;

    // 3D Motion Trajectory Curve Line (Path in 3D scene)
    const trajLineGeo = new THREE.BufferGeometry();
    const trajLineMat = new THREE.LineBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const trajLine = new THREE.Line(trajLineGeo, trajLineMat);
    trajLine.renderOrder = 9997;
    trajLine.visible = false;
    scene.add(trajLine);
    motionSimTrajectoryLineRef.current = trajLine;

    // Metric Grid (1m x 1m) and Axes with 1m markers
    const { group: metricGrid, labelsGroup: floorMeterLabelsGroup } = createMetricGridAndAxes();
    metricGrid.visible = showMetricGrid;
    floorMeterLabelsGroup.visible = showFloorMeterLabels;
    scene.add(metricGrid);
    metricGridGroupRef.current = metricGrid;
    floorMeterLabelsGroupRef.current = floorMeterLabelsGroup;

    // Persistent Ghost Reference Avatar (1.70m) in corner with Measuring Tape
    const refAvatar = createReferenceGhostAvatar();
    refAvatar.visible = showReferenceAvatar && !isAvatarMode;
    scene.add(refAvatar);
    referenceAvatarGroupRef.current = refAvatar;

    // Room Boundary Box (6m x 8m x 2.8m, Ceiling at Y = 2.80m)
    const roomBoundary = createRoomBoundaryBox(boundary);
    roomBoundary.visible = showBoundaryGhost;
    scene.add(roomBoundary);
    roomBoundaryGroupRef.current = roomBoundary;

    // Spatial Vertical Grid along boundary walls or custom anchor
    const spatialVerticalGrid = createSpatialVerticalGrid(boundary, spatialGridOrigin);
    spatialVerticalGrid.visible = showSpatialVerticalGrid;
    scene.add(spatialVerticalGrid);
    spatialVerticalGridGroupRef.current = spatialVerticalGrid;

    // 3D Spatial Height & Axis Guideline Indicator
    const heightIndicatorGroup = new THREE.Group();
    heightIndicatorGroup.name = 'heightIndicatorHelper';

    const guideLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    const guideLineMat = new THREE.LineDashedMaterial({
      color: 0x4ade80,
      dashSize: 0.1,
      gapSize: 0.06,
    });
    const guideLine = new THREE.Line(guideLineGeo, guideLineMat);
    guideLine.computeLineDistances();
    heightIndicatorGroup.add(guideLine); // Index 0: Y line

    const floorRingGeo = new THREE.RingGeometry(0.18, 0.24, 24);
    const floorRingMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const floorRing = new THREE.Mesh(floorRingGeo, floorRingMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.005;
    heightIndicatorGroup.add(floorRing); // Index 1: Ring

    const crossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.35, 0.006, 0),
      new THREE.Vector3(0.35, 0.006, 0),
      new THREE.Vector3(0, 0.006, -0.35),
      new THREE.Vector3(0, 0.006, 0.35),
    ]);
    const crossMat = new THREE.LineBasicMaterial({ color: 0x4ade80 });
    const crosshair = new THREE.LineSegments(crossGeo, crossMat);
    heightIndicatorGroup.add(crosshair); // Index 2: Crosshair

    const heightBadgeSprite = createMetricTextSprite('Pos: X:0.00m | Y:0.00m | Z:0.00m', '#0f172a', '#4ade80');
    heightBadgeSprite.position.set(0, 0.35, 0);
    heightIndicatorGroup.add(heightBadgeSprite); // Index 3: Sprite

    // Axis X Guideline (Red Dashed Line)
    const axisXGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    ]);
    const axisXMat = new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.1, gapSize: 0.06 });
    const axisXLine = new THREE.Line(axisXGeo, axisXMat);
    axisXLine.computeLineDistances();
    heightIndicatorGroup.add(axisXLine); // Index 4: X Line

    // Axis Z Guideline (Blue Dashed Line)
    const axisZGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ]);
    const axisZMat = new THREE.LineDashedMaterial({ color: 0x3b82f6, dashSize: 0.1, gapSize: 0.06 });
    const axisZLine = new THREE.Line(axisZGeo, axisZMat);
    axisZLine.computeLineDistances();
    heightIndicatorGroup.add(axisZLine); // Index 5: Z Line

    heightIndicatorGroup.visible = false;
    scene.add(heightIndicatorGroup);
    heightIndicatorGroupRef.current = heightIndicatorGroup;

    // Render loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Camera Orbit position with broad limitless zoom range & pan target
      if (cameraRef.current) {
        const { theta, phi, distance } = cameraAngleRef.current;
        const cam = cameraRef.current;
        const target = cameraTargetRef.current;
        cam.position.x = target.x + distance * Math.sin(theta) * Math.cos(phi);
        cam.position.y = target.y + distance * Math.sin(phi);
        cam.position.z = target.z + distance * Math.cos(theta) * Math.cos(phi);
        cam.lookAt(target.x, target.y, target.z);

        // Project selected spot position to 2D screen
        if (selectedSpotId && showSpots) {
          const currentSpot = spots.find((s) => s.id === selectedSpotId);
          if (currentSpot && container) {
            const worldPos = new THREE.Vector3(...currentSpot.position);
            worldPos.y += 1.35;

            const proj = worldPos.clone().project(cam);
            const rect = container.getBoundingClientRect();
            const sx = ((proj.x + 1) / 2) * rect.width;
            const sy = ((-proj.y + 1) / 2) * rect.height;

            if (proj.z < 1) {
              setSpotGizmoScreenPos({ x: sx, y: sy });
            } else {
              setSpotGizmoScreenPos(null);
            }
          }
        } else {
          setSpotGizmoScreenPos(null);
        }

        // Project selected object position to 2D screen
        if (selectedObjectId) {
          const currentObj = placedObjects.find((o) => o.id === selectedObjectId);
          if (currentObj && container) {
            const worldPos = new THREE.Vector3(...currentObj.position);
            worldPos.y += 0.95;

            const proj = worldPos.clone().project(cam);
            const rect = container.getBoundingClientRect();
            const sx = ((proj.x + 1) / 2) * rect.width;
            const sy = ((-proj.y + 1) / 2) * rect.height;

            if (proj.z < 1) {
              setObjectGizmoScreenPos({ x: sx, y: sy });
            } else {
              setObjectGizmoScreenPos(null);
            }
          }
        } else {
          setObjectGizmoScreenPos(null);
        }

        // Live Spatial Height & Floor Projection Tracking helper
        if (heightIndicatorGroupRef.current) {
          let targetPos: { x: number; y: number; z: number } | null = null;
          if (selectedObjectIdRef.current && meshMapRef.current.has(selectedObjectIdRef.current)) {
            const m = meshMapRef.current.get(selectedObjectIdRef.current)!;
            targetPos = { x: m.position.x, y: m.position.y, z: m.position.z };
          } else if (selectedSpotIdRef.current && spotGizmoAnchorRef.current && spotGizmoAnchorRef.current.visible) {
            const a = spotGizmoAnchorRef.current;
            targetPos = { x: a.position.x, y: a.position.y, z: a.position.z };
          }

          if (targetPos && !isAvatarMode) {
            const grp = heightIndicatorGroupRef.current;
            updateSpatialIndicatorGroup(grp, targetPos.x, targetPos.y, targetPos.z);
          } else {
            heightIndicatorGroupRef.current.visible = false;
          }
        }

        // Live Motion Spot Simulation Engine: SPOT FANTASMA & Dynamic Anchor Tracking
        const nowSec = performance.now() * 0.001;
        let isAnyTestingMotion = false;

        const movedObjectIds = new Set<string>();

        // Live refs to prevent stale closure data in Three.js render loop
        const currentSpots = spotsRef.current || spots;
        const currentPlacedObjects = placedObjectsRef.current || placedObjects;
        const activeTestingId = testingMotionSpotIdRef.current;
        const activeSelectedSpotId = selectedSpotIdRef.current;
        const activeAvatarMode = isAvatarModeRef.current;
        const activeAvatarSpotId = avatarCurrentSpotIdRef.current;

        // Resolve custom avatar object (uploaded GLB or designated object)
        const effectiveCustomAvatarId =
          customAvatarObjectIdRef.current ||
          currentPlacedObjects.find((o) => o.isAvatar || o.type === 'avatar')?.id ||
          null;
        const effectiveCustomAvatarObj = effectiveCustomAvatarId
          ? currentPlacedObjects.find((o) => o.id === effectiveCustomAvatarId)
          : null;
        const customAvatarMesh = effectiveCustomAvatarId
          ? meshMapRef.current.get(effectiveCustomAvatarId)
          : null;

        // Identify the featured spot for the 3D Spot Fantasma & Trajectory line:
        let featuredMotionSpot: SpotItem | null = null;
        if (activeTestingId) {
          featuredMotionSpot = currentSpots.find((s) => s.id === activeTestingId) || null;
        }
        if (!featuredMotionSpot && activeSelectedSpotId) {
          const s = currentSpots.find((sp) => sp.id === activeSelectedSpotId);
          if (s?.motion?.enabled) featuredMotionSpot = s;
        }

        // Resolve which spot the avatar is assigned to:
        // Priority 1: activeAvatarSpotId (explicitly selected/clicked/teleported spot)
        // Priority 2: If activeAvatarSpotId is null, strictly snap only to the single closest spot within 0.25m
        let resolvedAvatarSpotId: string | null = activeAvatarSpotId;
        if (!resolvedAvatarSpotId && effectiveCustomAvatarObj && currentSpots.length > 0) {
          let closestDist = Infinity;
          let closestId: string | null = null;
          for (const s of currentSpots) {
            const d = Math.hypot(
              effectiveCustomAvatarObj.position[0] - s.position[0],
              effectiveCustomAvatarObj.position[2] - s.position[2]
            );
            if (d < closestDist) {
              closestDist = d;
              closestId = s.id;
            }
          }
          // Only snap if strictly within 0.25m and uniquely closest to avoid capturing adjacent spots
          if (closestId && closestDist <= 0.25) {
            resolvedAvatarSpotId = closestId;
          }
        }

        currentSpots.forEach((spot) => {
          const isFeatured = featuredMotionSpot?.id === spot.id;
          const hasMotion = !!spot.motion?.enabled;

          // Check if the avatar is on THIS specific spot:
          // 1) resolvedAvatarSpotId === spot.id (avatar was assigned or clicked on this spot)
          // 2) Spot is parented to or attached to avatar object
          const isAvatarAssignedToSpot = !!resolvedAvatarSpotId && resolvedAvatarSpotId === spot.id;
          const isSpotParentOfAvatar =
            !!(spot.parentObjectId && effectiveCustomAvatarId && spot.parentObjectId === effectiveCustomAvatarId);

          const isAvatarOnSpot = isAvatarAssignedToSpot || isSpotParentOfAvatar;

          // Simulate if explicitly testing this spot, or if it's the featured selected spot with motion enabled, or if avatar is on it
          const shouldSimulate = hasMotion && (isFeatured || (activeTestingId === spot.id) || isAvatarOnSpot);

          if (shouldSimulate && spot.motion) {
            isAnyTestingMotion = true;
            const cfg: SpotMotionConfig = spot.motion;
            const targetId = spot.parentObjectId;
            const tGroup = targetId ? meshMapRef.current.get(targetId) : null;
            const baseObj = currentPlacedObjects.find((o) => o.id === targetId);

            const spd = cfg.speed || 1.0;
            let factor = 0;
            if (isTimelinePlayingRef.current) {
              const phase = (nowSec * spd * 2.0) % (Math.PI * 2);
              factor = cfg.loop ? (1 - Math.cos(phase)) / 2 : ((nowSec * spd) % 1.0);
              if (isFeatured) {
                timelineProgressRef.current = factor;
              }
            } else {
              factor = timelineProgressRef.current;
            }

            // Base world anchor position of the spot at rest
            let baseWorldPos = new THREE.Vector3(...spot.position);
            if (tGroup && spot.relativePosition && baseObj) {
              const tempObj = new THREE.Object3D();
              tempObj.position.set(...baseObj.position);
              tempObj.rotation.set(...baseObj.rotation);
              tempObj.scale.set(...baseObj.scale);
              tempObj.updateMatrixWorld();
              baseWorldPos = tempObj.localToWorld(new THREE.Vector3(...spot.relativePosition));
            }

            // Evaluate parametric trajectory function at progress t in [0, 1]
            const evalTrajectoryAt = (t: number) => {
              const baseDx = (cfg.deltaPosition?.[0] || 0) * t;
              let baseDy = (cfg.deltaPosition?.[1] || 0) * t;
              let baseDz = (cfg.deltaPosition?.[2] || 0) * t;
              let posX = baseDx;
              let posY = baseDy;
              let posZ = baseDz;

              // 1. Trajectory Curves
              const traj = cfg.curveTrajectory || 'linear';
              if (traj === 'arc') {
                // Parabolic curve: 4 * h * t * (1 - t)
                const h = cfg.curveHeight !== undefined ? cfg.curveHeight : 2.0;
                posY += 4 * h * t * (1 - t);
              } else if (traj === 'circle_turn') {
                // Circle turn / Fazer volta circular
                const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
                const rad = THREE.MathUtils.degToRad(turnDeg * t);
                const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 2.0;
                posX = radius * Math.sin(rad) + baseDx;
                posZ = radius * (1 - Math.cos(rad)) + baseDz;
              } else if (traj === 'spiral') {
                // Spiral / Subir em curva com rotação para cima contínua
                const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
                const rad = THREE.MathUtils.degToRad(turnDeg * t);
                const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 1.5;
                posX = radius * Math.cos(rad) - radius + baseDx;
                posZ = radius * Math.sin(rad) + baseDz;
              } else if (traj === 'wave') {
                // Undulating wave
                posY += Math.sin(t * Math.PI * 4) * 0.35;
              }

              // Transform (posX, posZ) relative to spot's orientation angle
              const spotRotRad = THREE.MathUtils.degToRad(spot.rotation || 0);
              const worldOffset = new THREE.Vector3(
                posX * Math.cos(spotRotRad) + posZ * Math.sin(spotRotRad),
                posY,
                -posX * Math.sin(spotRotRad) + posZ * Math.cos(spotRotRad)
              );

              // 2. Rotations (Degrees -> Radian)
              const rxDeg = (cfg.deltaRotation?.[0] || 0) * t;
              const ryDeg = cfg.turnAngle !== undefined && traj === 'circle_turn'
                ? cfg.turnAngle * t
                : (cfg.deltaRotation?.[1] || 0) * t;
              const rzDeg = (cfg.deltaRotation?.[2] || 0) * t;

              // 3. Scale Factor (Motion de Escala)
              let scaleVal = 1.0;
              if (cfg.scaleFactor !== undefined) {
                scaleVal = 1.0 + t * (cfg.scaleFactor - 1.0);
              } else if (cfg.deltaScale) {
                scaleVal = 1.0 + t * (cfg.deltaScale[0] - 1.0);
              }

              return {
                offset: worldOffset,
                rotX: THREE.MathUtils.degToRad(rxDeg),
                rotY: THREE.MathUtils.degToRad(ryDeg),
                rotZ: THREE.MathUtils.degToRad(rzDeg),
                scale: scaleVal,
              };
            };

            const currentMotion = evalTrajectoryAt(factor);

            // 1. Move parent 3D object if target includes parent_object
            if (tGroup && baseObj && (cfg.target === 'parent_object' || cfg.target === 'both')) {
              movedObjectIds.add(baseObj.id);
              tGroup.position.set(
                baseObj.position[0] + currentMotion.offset.x,
                baseObj.position[1] + currentMotion.offset.y,
                baseObj.position[2] + currentMotion.offset.z
              );
              tGroup.rotation.set(
                baseObj.rotation[0] + currentMotion.rotX,
                baseObj.rotation[1] + currentMotion.rotY,
                baseObj.rotation[2] + currentMotion.rotZ
              );
              tGroup.scale.set(
                baseObj.scale[0] * currentMotion.scale,
                baseObj.scale[1] * currentMotion.scale,
                baseObj.scale[2] * currentMotion.scale
              );
            }

            // 2. Stationary Base Anchor Marker on Defined Spot
            if (isFeatured && baseSpotAnchorRef.current) {
              baseSpotAnchorRef.current.position.copy(baseWorldPos);
              baseSpotAnchorRef.current.rotation.y = spot.rotation * (Math.PI / 180);
              baseSpotAnchorRef.current.visible = cfg.showGhostSpot !== false;
            }

            // 3. Visual Spot Fantasma in 3D scene (Ponto se movimentando a partir do spot definido)
            if (isFeatured && motionSimPointGroupRef.current) {
              const simGrp = motionSimPointGroupRef.current;
              let currentSimPos = baseWorldPos.clone().add(currentMotion.offset);
              if (tGroup && spot.relativePosition && (cfg.target === 'parent_object' || cfg.target === 'both')) {
                currentSimPos = tGroup.localToWorld(new THREE.Vector3(...spot.relativePosition));
              }
              simGrp.position.copy(currentSimPos);
              simGrp.rotation.set(
                currentMotion.rotX,
                spot.rotation * (Math.PI / 180) + currentMotion.rotY,
                currentMotion.rotZ
              );
              simGrp.scale.set(currentMotion.scale, currentMotion.scale, currentMotion.scale);
              simGrp.visible = cfg.showGhostSpot !== false;

              // Store live motion info for HUD
              activeGhostMotionInfoRef.current = {
                spotId: spot.id,
                spotName: spot.name || 'Spot',
                factor,
                offset: [currentMotion.offset.x, currentMotion.offset.y, currentMotion.offset.z],
                basePos: [baseWorldPos.x, baseWorldPos.y, baseWorldPos.z],
              };
            }

            // 4. Render 3D Trajectory Curve Line starting strictly from the spot's anchor position
            if (isFeatured && motionSimTrajectoryLineRef.current) {
              const trajLine = motionSimTrajectoryLineRef.current;
              const pathPoints: THREE.Vector3[] = [];
              const steps = 50;
              for (let i = 0; i <= steps; i++) {
                const sampleT = i / steps;
                const sampleMotion = evalTrajectoryAt(sampleT);
                pathPoints.push(baseWorldPos.clone().add(sampleMotion.offset));
              }
              if (cfg.loop && (!cfg.curveTrajectory || cfg.curveTrajectory === 'linear')) {
                pathPoints.push(baseWorldPos.clone());
              }
              trajLine.geometry.dispose();
              trajLine.geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
              trajLine.visible = cfg.showGhostSpot !== false;
            }

            // 5. Move Avatar (uploaded custom avatar object OR default humanoid avatar) along trajectory
            const shouldMoveAvatar =
              isAvatarOnSpot &&
              (cfg.target === 'avatar' || cfg.target === 'both' || !cfg.target);

            if (shouldMoveAvatar) {
              let targetX = baseWorldPos.x + currentMotion.offset.x;
              let targetY = baseWorldPos.y + currentMotion.offset.y;
              let targetZ = baseWorldPos.z + currentMotion.offset.z;

              if (tGroup && spot.relativePosition) {
                const worldPos = tGroup.localToWorld(new THREE.Vector3(...spot.relativePosition));
                targetX = worldPos.x + currentMotion.offset.x;
                targetY = worldPos.y + currentMotion.offset.y;
                targetZ = worldPos.z + currentMotion.offset.z;
              }

              // A) Move custom uploaded avatar 3D object
              if (customAvatarMesh && effectiveCustomAvatarId && effectiveCustomAvatarObj) {
                movedObjectIds.add(effectiveCustomAvatarId);
                customAvatarMesh.position.set(targetX, targetY, targetZ);
                const spotRotRad = THREE.MathUtils.degToRad(spot.rotation);
                customAvatarMesh.rotation.set(
                  effectiveCustomAvatarObj.rotation[0] + currentMotion.rotX,
                  spotRotRad + currentMotion.rotY,
                  effectiveCustomAvatarObj.rotation[2] + currentMotion.rotZ
                );
                customAvatarMesh.scale.set(
                  effectiveCustomAvatarObj.scale[0] * currentMotion.scale,
                  effectiveCustomAvatarObj.scale[1] * currentMotion.scale,
                  effectiveCustomAvatarObj.scale[2] * currentMotion.scale
                );

                // Update active avatar halo position to follow the moving custom avatar
                if (activeAvatarHaloRef.current) {
                  activeAvatarHaloRef.current.position.set(targetX, 0.025, targetZ);
                  activeAvatarHaloRef.current.visible = true;
                }
              }

              // B) Move default humanoid avatar mesh (when no custom avatar object is active)
              if (avatarGroupRef.current && !effectiveCustomAvatarId) {
                avatarGroupRef.current.position.set(targetX, targetY, targetZ);
                avatarGroupRef.current.rotation.y = THREE.MathUtils.degToRad(spot.rotation) + currentMotion.rotY;
                avatarGroupRef.current.scale.set(currentMotion.scale, currentMotion.scale, currentMotion.scale);
              }
            }
          } else if (isAvatarOnSpot && spot.parentObjectId && spot.relativePosition) {
            // Keep avatar glued to parent object's surface if on a relative spot without motion
            const tGroup = meshMapRef.current.get(spot.parentObjectId);
            if (tGroup) {
              const worldPos = tGroup.localToWorld(new THREE.Vector3(...spot.relativePosition));
              if (customAvatarMesh && effectiveCustomAvatarId) {
                movedObjectIds.add(effectiveCustomAvatarId);
                customAvatarMesh.position.copy(worldPos);
              } else if (avatarGroupRef.current) {
                avatarGroupRef.current.position.copy(worldPos);
              }
            }
          }
        });

        if (!isAnyTestingMotion || !featuredMotionSpot) {
          if (motionSimPointGroupRef.current) motionSimPointGroupRef.current.visible = false;
          if (baseSpotAnchorRef.current) baseSpotAnchorRef.current.visible = false;
          if (motionSimTrajectoryLineRef.current) motionSimTrajectoryLineRef.current.visible = false;
          activeGhostMotionInfoRef.current = null;
        }

        // Animate any PlacedObject that has a running test action or activeActionId
        const currentTestingAction = testingObjectActionRef.current;
        currentPlacedObjects.forEach((obj) => {
          const actToRun =
            (currentTestingAction && currentTestingAction.objectId === obj.id
              ? obj.actions?.find((a) => a.id === currentTestingAction.actionId)
              : null) ||
            (obj.activeActionId ? obj.actions?.find((a) => a.id === obj.activeActionId) : null);

          if (actToRun && actToRun.motion) {
            const mGroup = meshMapRef.current.get(obj.id);
            if (mGroup && !isTransformDraggingRef.current) {
              const cfg = actToRun.motion;
              const spd = cfg.speed || 1.0;
              const phase = (nowSec * spd * 2.0) % (Math.PI * 2);
              const factor = cfg.loop ? (1 - Math.cos(phase)) / 2 : ((nowSec * spd) % 1.0);

              let baseDx = (cfg.deltaPosition?.[0] || 0) * factor;
              let baseDy = (cfg.deltaPosition?.[1] || 0) * factor;
              let baseDz = (cfg.deltaPosition?.[2] || 0) * factor;

              const traj = cfg.curveTrajectory || 'linear';
              if (traj === 'arc') {
                const h = cfg.curveHeight !== undefined ? cfg.curveHeight : 2.0;
                baseDy += 4 * h * factor * (1 - factor);
              } else if (traj === 'circle_turn') {
                const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
                const rad = THREE.MathUtils.degToRad(turnDeg * factor);
                const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 2.0;
                baseDx = radius * Math.sin(rad) + baseDx;
                baseDz = radius * (1 - Math.cos(rad)) + baseDz;
              } else if (traj === 'spiral') {
                const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
                const rad = THREE.MathUtils.degToRad(turnDeg * factor);
                const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 1.5;
                baseDx = radius * Math.cos(rad) - radius + baseDx;
                baseDz = radius * Math.sin(rad) + baseDz;
              } else if (traj === 'wave') {
                baseDy += Math.sin(factor * Math.PI * 4) * 0.35;
              }

              const rxDeg = (cfg.deltaRotation?.[0] || 0) * factor;
              const ryDeg = (cfg.deltaRotation?.[1] || 0) * factor;
              const rzDeg = (cfg.deltaRotation?.[2] || 0) * factor;

              movedObjectIds.add(obj.id);
              mGroup.position.set(
                obj.position[0] + baseDx,
                obj.position[1] + baseDy,
                obj.position[2] + baseDz
              );
              mGroup.rotation.set(
                obj.rotation[0] + THREE.MathUtils.degToRad(rxDeg),
                obj.rotation[1] + THREE.MathUtils.degToRad(ryDeg),
                obj.rotation[2] + THREE.MathUtils.degToRad(rzDeg)
              );
            }
          }
        });

        // Restore any object not currently being moved by active motion simulation
        currentPlacedObjects.forEach((obj) => {
          if (!movedObjectIds.has(obj.id)) {
            const m = meshMapRef.current.get(obj.id);
            if (m && !isTransformDraggingRef.current && selectedObjectIdRef.current !== obj.id) {
              if (
                Math.abs(m.position.x - obj.position[0]) > 0.0001 ||
                Math.abs(m.position.y - obj.position[1]) > 0.0001 ||
                Math.abs(m.position.z - obj.position[2]) > 0.0001
              ) {
                m.position.set(...obj.position);
              }
              if (
                Math.abs(m.rotation.x - obj.rotation[0]) > 0.0001 ||
                Math.abs(m.rotation.y - obj.rotation[1]) > 0.0001 ||
                Math.abs(m.rotation.z - obj.rotation[2]) > 0.0001
              ) {
                m.rotation.set(...obj.rotation);
              }
              if (
                Math.abs(m.scale.x - obj.scale[0]) > 0.0001 ||
                Math.abs(m.scale.y - obj.scale[1]) > 0.0001 ||
                Math.abs(m.scale.z - obj.scale[2]) > 0.0001
              ) {
                m.scale.set(...obj.scale);
              }
            }
          }
        });

        // Ensure active avatar halo is at the avatar's actual resting position when not moved by motion
        if (activeAvatarHaloRef.current && effectiveCustomAvatarId && !movedObjectIds.has(effectiveCustomAvatarId)) {
          const avObj = currentPlacedObjects.find((o) => o.id === effectiveCustomAvatarId);
          if (avObj) {
            activeAvatarHaloRef.current.position.set(avObj.position[0], 0.025, avObj.position[2]);
          }
        }

        // Ensure humanoid avatar mesh stays firmly on its assigned still spot when not moved by motion
        if (avatarGroupRef.current && !effectiveCustomAvatarId && resolvedAvatarSpotId) {
          const curSpot = currentSpots.find((s) => s.id === resolvedAvatarSpotId);
          if (curSpot && !curSpot.motion?.enabled) {
            avatarGroupRef.current.position.set(...curSpot.position);
            avatarGroupRef.current.rotation.y = THREE.MathUtils.degToRad(curSpot.rotation);
            avatarGroupRef.current.scale.set(1, 1, 1);
          }
        }

        // Hide simulated point and trajectory line when not testing any motion
        if (!isAnyTestingMotion) {
          if (motionSimPointGroupRef.current && motionSimPointGroupRef.current.visible) {
            motionSimPointGroupRef.current.visible = false;
          }
          if (motionSimTrajectoryLineRef.current && motionSimTrajectoryLineRef.current.visible) {
            motionSimTrajectoryLineRef.current.visible = false;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Mouse handlers for natural orbit, right-click camera pan, and direct object interaction
    const handleMouseDown = (e: MouseEvent) => {
      hasMovedMouseDuringDownRef.current = false;
      if (isTransformDraggingRef.current) return;
      if (e.target !== renderer.domElement && !container.contains(e.target as Node)) return;

      // RIGHT CLICK (button === 2) OR MIDDLE CLICK (button === 1): PAN CAMERA
      if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        isPanningRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Check if clicking on an object in the scene to select immediately & allow direct dragging or avatar control
      if (placedObjectsGroupRef.current) {
        const objHits = raycaster.intersectObjects(
          placedObjectsGroupRef.current.children,
          true
        );
        if (objHits.length > 0) {
          let hitObj: THREE.Object3D | null = objHits[0].object;
          while (hitObj && !(hitObj as any).userData?.placedObjectId && hitObj.parent) {
            hitObj = hitObj.parent;
          }
          if (hitObj && (hitObj as any).userData?.placedObjectId) {
            const foundId = (hitObj as any).userData.placedObjectId;
            const targetObj = placedObjects.find((o) => o.id === foundId);

            if (isAvatarMode) {
              // In Avatar Mode: clicking an avatar object controls it!
              onSelectObject(foundId);
              onSelectSpot(null);
              if (
                targetObj &&
                (targetObj.type === 'avatar' ||
                  targetObj.isAvatar ||
                  targetObj.name.toLowerCase().includes('avatar') ||
                  customAvatarObjectId === foundId)
              ) {
                onSetCustomAvatarObjectId?.(foundId);
              }
              return;
            }

            // If the clicked object is the 3D scenario (the room itself):
            // The scenario is the environment/room architecture.
            // Clicking and dragging on the scenario mesh MUST rotate/orbit the camera around the room freely!
            if (targetObj && targetObj.type === 'cenario') {
              isOrbitingRef.current = true;
              lastMousePosRef.current = { x: e.clientX, y: e.clientY };
              return;
            }

            // For other scene objects: allow left-click drag anywhere to orbit the camera naturally!
            // If the user releases without dragging (>3px), handleClick selects the object and shows the TransformControls Gizmo.
            isOrbitingRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
        }
      }

      // If not clicking an object, orbit camera
      isOrbitingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedMouseDuringDownRef.current = true;
      }

      // 0. Surface Snapping Preview for Relative Spot Placement on 3D Object
      if (surfaceSnapTargetObjectIdRef.current) {
        const isAny = surfaceSnapTargetObjectIdRef.current === 'any';
        let targetMeshes: THREE.Object3D[] = [];
        if (!isAny && meshMapRef.current.has(surfaceSnapTargetObjectIdRef.current)) {
          targetMeshes = meshMapRef.current.get(surfaceSnapTargetObjectIdRef.current)!.children;
        } else if (placedObjectsGroupRef.current) {
          targetMeshes = placedObjectsGroupRef.current.children;
        }

        if (targetMeshes.length > 0) {
          const rect = container.getBoundingClientRect();
          const mouseVec = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouseVec, camera);
          const hits = raycaster.intersectObjects(targetMeshes, true);
          if (hits.length > 0) {
            const hit = hits[0];
            let hitObj: THREE.Object3D | null = hit.object;
            while (hitObj && !(hitObj as any).userData?.placedObjectId && hitObj.parent) {
              hitObj = hitObj.parent;
            }
            const foundId = (hitObj as any)?.userData?.placedObjectId || (!isAny ? surfaceSnapTargetObjectIdRef.current : null);
            const targetObjGroup = foundId ? meshMapRef.current.get(foundId) : null;
            if (targetObjGroup) {
              const normal = hit.face
                ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
                : new THREE.Vector3(0, 1, 0);
              if (surfaceRingMeshRef.current) {
                surfaceRingMeshRef.current.visible = true;
                surfaceRingMeshRef.current.position.copy(hit.point).addScaledVector(normal, 0.015);
                surfaceRingMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
                const activeRad =
                  selectedSpot?.relativeRadius || spotVisualConfigRef.current?.relativeSpotRadius || 0.12;
                const scaleFactor = Math.max(0.15, Math.min(4.0, activeRad / 0.12));
                surfaceRingMeshRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor);
              }
              currentSurfaceHitRef.current = {
                point: hit.point.clone(),
                normal: normal.clone(),
                localPoint: targetObjGroup.worldToLocal(hit.point.clone()),
                targetObjectId: foundId,
              };
              container.style.cursor = 'crosshair';
            }
          } else {
            if (surfaceRingMeshRef.current) surfaceRingMeshRef.current.visible = false;
            currentSurfaceHitRef.current = null;
            container.style.cursor = 'default';
          }
        }
      } else {
        if (surfaceRingMeshRef.current && surfaceRingMeshRef.current.visible) {
          surfaceRingMeshRef.current.visible = false;
        }
      }

      // 0. Camera Pan Navigation (Right-click or Middle-click drag)
      if (isPanningRef.current && cameraRef.current) {
        if (e.buttons === 0) {
          isPanningRef.current = false;
          container.style.cursor = 'default';
        } else {
          const cam = cameraRef.current;
          // Dynamically compute exact 1:1 screen-to-world factor at camera distance
          const vFovRad = (cam.fov * Math.PI) / 180;
          const visibleHeightAtDist = 2 * Math.tan(vFovRad / 2) * Math.max(0.2, cameraAngleRef.current.distance);
          const factor = visibleHeightAtDist / Math.max(100, container.clientHeight);

          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

          // Dragging right moves camera target left, dragging up moves target up (following cursor naturally)
          cameraTargetRef.current.addScaledVector(right, -dx * factor);
          cameraTargetRef.current.addScaledVector(up, dy * factor);
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
      }

      // 1. Direct object manipulation (Blender style) with 60 FPS in-place transform
      if (isDirectDraggingObjectRef.current && selectedObjectIdRef.current && directDragStartPosRef.current) {
        const mode = activeGizmoModeRef.current;
        const targetGroup = meshMapRef.current.get(selectedObjectIdRef.current);

        if (mode === 'mover') {
          // Raycast to floor to get precise target coordinates
          const rect = container.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, camera);
          const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
          const targetPt = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(floorPlane, targetPt)) {
            const newX = parseFloat(targetPt.x.toFixed(2));
            const newY = directDragStartPosRef.current.y;
            const newZ = parseFloat(targetPt.z.toFixed(2));
            if (targetGroup) {
              targetGroup.position.set(newX, newY, newZ);
            }
            scheduleReactTransformUpdate(selectedObjectIdRef.current, {
              position: [newX, newY, newZ],
              rotation: [0, directDragStartRotYRef.current, 0],
              scale: [directDragStartScaleRef.current, directDragStartScaleRef.current, directDragStartScaleRef.current],
            });
          }
        } else if (mode === 'rodar') {
          const deltaAngle = (dx * 0.02);
          const newRotY = directDragStartRotYRef.current + deltaAngle;
          if (targetGroup) {
            targetGroup.rotation.set(0, newRotY, 0);
          }
          scheduleReactTransformUpdate(selectedObjectIdRef.current, {
            position: [directDragStartPosRef.current.x, directDragStartPosRef.current.y, directDragStartPosRef.current.z],
            rotation: [0, newRotY, 0],
            scale: [directDragStartScaleRef.current, directDragStartScaleRef.current, directDragStartScaleRef.current],
          });
        } else if (mode === 'escalar') {
          const scaleDelta = (dx * 0.008);
          const newScale = Math.max(0.1, Math.min(5.0, directDragStartScaleRef.current + scaleDelta));
          const s = parseFloat(newScale.toFixed(2));
          if (targetGroup) {
            targetGroup.scale.set(s, s, s);
          }
          scheduleReactTransformUpdate(selectedObjectIdRef.current, {
            position: [directDragStartPosRef.current.x, directDragStartPosRef.current.y, directDragStartPosRef.current.z],
            rotation: [0, directDragStartRotYRef.current, 0],
            scale: [s, s, s],
          });
        } else if (mode === 'elevar') {
          const elevDelta = -(dy * 0.008);
          const newY = Math.max(0, Math.min(3.0, directDragStartPosRef.current.y + elevDelta));
          const yVal = parseFloat(newY.toFixed(2));
          if (targetGroup) {
            targetGroup.position.y = yVal;
          }
          scheduleReactTransformUpdate(selectedObjectIdRef.current, {
            position: [directDragStartPosRef.current.x, yVal, directDragStartPosRef.current.z],
            rotation: [0, directDragStartRotYRef.current, 0],
            scale: [directDragStartScaleRef.current, directDragStartScaleRef.current, directDragStartScaleRef.current],
          });
        }
        return;
      }

      // 2. Camera orbiting
      if (!isOrbitingRef.current || isTransformDraggingRef.current) return;

      cameraAngleRef.current.theta -= dx * 0.004;
      cameraAngleRef.current.phi = Math.max(
        -0.35,
        Math.min(1.50, cameraAngleRef.current.phi + dy * 0.003)
      );

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1 || e.buttons === 0) {
        isPanningRef.current = false;
        container.style.cursor = 'default';
      }
      isOrbitingRef.current = false;
      isDraggingSpotRef.current = false;
      if (isDirectDraggingObjectRef.current) {
        isDirectDraggingObjectRef.current = false;
        flushReactTransformUpdate();
      }
    };

    // Canvas click: Direct click to select objects or mark insertion point on floor
    const handleClick = (e: MouseEvent) => {
      if (hasMovedMouseDuringDownRef.current) return;
      if (isTransformDraggingRef.current) return;
      if (!container || !cameraRef.current || !floorMeshRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      // Check if clicking in Surface Snap Mode to attach a relative spot to 3D object
      if (surfaceSnapTargetObjectIdRef.current && currentSurfaceHitRef.current) {
        const hit = currentSurfaceHitRef.current;
        const parentId = hit.targetObjectId || (surfaceSnapTargetObjectIdRef.current !== 'any' ? surfaceSnapTargetObjectIdRef.current : null);
        if (parentId) {
          onAddRelativeSpot?.(
            parentId,
            [parseFloat(hit.localPoint.x.toFixed(3)), parseFloat(hit.localPoint.y.toFixed(3)), parseFloat(hit.localPoint.z.toFixed(3))],
            [parseFloat(hit.normal.x.toFixed(3)), parseFloat(hit.normal.y.toFixed(3)), parseFloat(hit.normal.z.toFixed(3))],
            [parseFloat(hit.point.x.toFixed(2)), parseFloat(hit.point.y.toFixed(2)), parseFloat(hit.point.z.toFixed(2))]
          );
        }
        currentSurfaceHitRef.current = null;
        if (surfaceRingMeshRef.current) surfaceRingMeshRef.current.visible = false;
        container.style.cursor = 'default';
        return;
      }

      // Check if clicking directly on an object in the 3D scene
      if (placedObjectsGroupRef.current) {
        const objHits = raycaster.intersectObjects(
          placedObjectsGroupRef.current.children,
          true
        );
        if (objHits.length > 0) {
          let hitObj: THREE.Object3D | null = objHits[0].object;
          while (hitObj && !(hitObj as any).userData?.placedObjectId && hitObj.parent) {
            hitObj = hitObj.parent;
          }
          if (hitObj && (hitObj as any).userData?.placedObjectId) {
            const foundId = (hitObj as any).userData.placedObjectId;
            const targetObj = placedObjects.find((o) => o.id === foundId);
            onSelectObject(foundId);
            onSelectSpot(null);
            if (
              isAvatarMode &&
              targetObj &&
              (targetObj.type === 'avatar' ||
                targetObj.isAvatar ||
                targetObj.name.toLowerCase().includes('avatar') ||
                customAvatarObjectId === foundId)
            ) {
              onSetCustomAvatarObjectId?.(foundId);
            }
            return;
          }
        }
      }

      // Check hit on floor
      const floorHits = raycaster.intersectObject(floorMeshRef.current);
      if (floorHits.length > 0) {
        const pt = floorHits[0].point;
        const coords: [number, number, number] = [
          parseFloat(pt.x.toFixed(2)),
          0.02,
          parseFloat(pt.z.toFixed(2)),
        ];

        if (!isAvatarMode) {
          onSceneClickInsertionPoint(coords);
        }
      }
    };

    // Limitless smooth mouse wheel zoom with massive range (0.005m to 3000m)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Smooth exponential zoom proportional to distance
      const delta = Math.max(-150, Math.min(150, e.deltaY));
      const zoomFactor = Math.exp(delta * 0.0018);
      cameraAngleRef.current.distance = Math.max(
        0.005,
        Math.min(3000.0, cameraAngleRef.current.distance * zoomFactor)
      );
    };

    // Keyboard shortcuts for Blender-style tools: G (move), R (rotate), S (scale), E (elevate), Delete
    // and Keyboard Arrow Navigation (setas do teclado: frente, trás, lados, cima/baixo)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Keyboard arrow keys & WASD to move/pan scenario
      const step = e.shiftKey ? 1.2 : 0.45;
      const { theta } = cameraAngleRef.current;
      const forwardVec = new THREE.Vector3(-Math.sin(theta), 0, -Math.cos(theta)).normalize();
      const rightVec = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)).normalize();

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        cameraTargetRef.current.addScaledVector(forwardVec, step);
        return;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        cameraTargetRef.current.addScaledVector(forwardVec, -step);
        return;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cameraTargetRef.current.addScaledVector(rightVec, -step);
        return;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cameraTargetRef.current.addScaledVector(rightVec, step);
        return;
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        cameraTargetRef.current.y = Math.min(25, cameraTargetRef.current.y + step);
        return;
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        cameraTargetRef.current.y = Math.max(-5, cameraTargetRef.current.y - step);
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        onChangeGizmoMode('mover');
      } else if (e.key === 'r' || e.key === 'R') {
        onChangeGizmoMode('rodar');
      } else if (e.key === 's' || e.key === 'S') {
        onChangeGizmoMode('escalar');
      } else if (e.key === 'e' || e.key === 'E') {
        onChangeGizmoMode('elevar');
      } else if (e.key === 'Delete') {
        // Explicit Delete key ONLY (never Backspace, so text editing never deletes scene objects)
        if (selectedObjectIdRef.current) {
          onRemoveObject(selectedObjectIdRef.current);
        }
      } else if (e.key === 'Escape') {
        onSelectObject(null);
        onSelectSpot(null);
      }
    };

    const domEl = renderer.domElement;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    domEl.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('contextmenu', handleContextMenu);
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('click', handleClick);
    domEl.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      domEl.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('contextmenu', handleContextMenu);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('click', handleClick);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      transformControls.dispose();
      if (container.contains(domEl)) {
        container.removeChild(domEl);
      }
      renderer.dispose();
    };
  }, []);

  // 2. Load Real 3D GLB Scenario OR Procedural Architectural Room
  useEffect(() => {
    const group = customScenarioGroupRef.current;
    if (!group) return;

    // Clear previous custom scenario
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    if (!sceneAssetBlobUrl) {
      // If no custom blob URL, render architectural theme for current sceneAssetId
      if (defaultRoomGroupRef.current) {
        defaultRoomGroupRef.current.children.forEach((c) => {
          c.visible = true;
        });
      }

      if (sceneAssetId === 'inv-scene-1') {
        // Build Crimson Salon architectural decor
        const scarletRoom = createScarletSalonArchitecture();
        group.add(scarletRoom);
        if (defaultRoomGroupRef.current) {
          defaultRoomGroupRef.current.children.forEach((c) => {
            if (c.name !== 'floor') c.visible = false;
          });
        }
      } else if (sceneAssetId === 'inv-scene-2') {
        // Build Industrial Loft architectural decor
        const loftRoom = createLoftArchitecture();
        group.add(loftRoom);
        if (defaultRoomGroupRef.current) {
          defaultRoomGroupRef.current.children.forEach((c) => {
            if (c.name !== 'floor') c.visible = false;
          });
        }
      }
      setIsLoadingScenario(false);
      return;
    }

    // Check if this scenario is already managed as an editable placedObject with full Gizmo support!
    const isManagedInPlacedObjects = placedObjects.some(
      (o) => o.type === 'cenario' || (o.fileBlobUrl && o.fileBlobUrl === sceneAssetBlobUrl)
    );

    if (isManagedInPlacedObjects) {
      // Clear customScenarioGroup so it doesn't double-render
      while (group.children.length > 0) {
        const c = group.children[0];
        group.remove(c);
      }
      setIsLoadingScenario(false);
      if (defaultRoomGroupRef.current) {
        defaultRoomGroupRef.current.children.forEach((c) => {
          if (c.name !== 'floor') c.visible = false;
        });
      }
      return;
    }

    // Load actual GLB using GLTFLoader!
    setIsLoadingScenario(true);
    setScenarioLoadingMsg('Carregando modelo 3D do cenário...');

    // Hide default walls so the uploaded scenario model is not occluded
    if (defaultRoomGroupRef.current) {
      defaultRoomGroupRef.current.children.forEach((c) => {
        if (c.name !== 'floor') c.visible = false;
      });
    }

    const loader = new GLTFLoader();
    loader.load(
      sceneAssetBlobUrl,
      (gltf) => {
        const model = gltf.scene;

        // Metric Auto-scale: "se for CASA / ROOM: escala = 2.8 / altura_arquivo // teto ~2.8 m"
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const rawHeight = Math.max(0.01, size.y);
        const targetCeiling = 2.80;
        const scale = targetCeiling / rawHeight;
        model.scale.set(scale, scale, scale);

        // Record scene room raw dimensions for presets & scaling
        const sceneDims = {
          width: Math.max(0.01, size.x),
          height: rawHeight,
          depth: Math.max(0.01, size.z),
          targetHeight: 2.80,
          label: 'Cenário da Sala (Teto 2,80 m)',
          isRoom: true,
        };
        rawDimensionsMapRef.current.set('__scene_room__', sceneDims);
        setRawDimensionsState((prev) => ({ ...prev, ['__scene_room__']: sceneDims }));

        // Center on X and Z
        const scaledBox = new THREE.Box3().setFromObject(model);
        const center = scaledBox.getCenter(new THREE.Vector3());
        model.position.x = -center.x;
        model.position.z = -center.z;

        // Align floor strictly at Y = 0
        scaledBox.setFromObject(model);
        model.position.y = -scaledBox.min.y;

        // Enable shadows, prevent frustum culling disappearance & set double-sided materials
        model.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            if (mesh.geometry) {
              mesh.geometry.computeBoundingBox();
              mesh.geometry.computeBoundingSphere();
            }
            const mat = mesh.material;
            if (mat) {
              if (Array.isArray(mat)) {
                mat.forEach((item) => (item.side = THREE.DoubleSide));
              } else {
                mat.side = THREE.DoubleSide;
              }
            }
          }
        });

        group.add(model);
        setIsLoadingScenario(false);
      },
      (progress) => {
        if (progress.total > 0) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          setScenarioLoadingMsg(`Carregando cenário: ${pct}%...`);
        }
      },
      (err) => {
        console.warn('GLTFLoader error on scenario:', err);
        setIsLoadingScenario(false);
        if (defaultRoomGroupRef.current) {
          defaultRoomGroupRef.current.children.forEach((c) => {
            c.visible = true;
          });
        }
      }
    );
  }, [sceneAssetBlobUrl, sceneAssetId]);

  // 3. High-Performance Render and In-Place Transform Synchronization (Never destroy existing meshes!)
  useEffect(() => {
    const group = placedObjectsGroupRef.current;
    if (!group) return;

    const currentIds = new Set(placedObjects.map((o) => o.id));

    // 1. Clean up only objects that were explicitly deleted
    meshMapRef.current.forEach((meshGroup, id) => {
      if (!currentIds.has(id)) {
        group.remove(meshGroup);
        meshGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            if (m.material) {
              if (Array.isArray(m.material)) {
                m.material.forEach((mat) => mat.dispose());
              } else {
                m.material.dispose();
              }
            }
          }
        });
        meshMapRef.current.delete(id);
      }
    });

    // 2. Synchronize existing objects in-place (0ms, 0 allocations, 60fps) or instantiate new
    placedObjects.forEach((obj) => {
      const existing = meshMapRef.current.get(obj.id);
      if (existing) {
        // Fast in-place transform sync - object NEVER disappears when adjusting numbers or dragging!
        const px = Number.isFinite(obj.position[0]) ? obj.position[0] : existing.position.x;
        const py = Number.isFinite(obj.position[1]) ? obj.position[1] : existing.position.y;
        const pz = Number.isFinite(obj.position[2]) ? obj.position[2] : existing.position.z;
        existing.position.set(px, py, pz);

        const rx = Number.isFinite(obj.rotation[0]) ? obj.rotation[0] : existing.rotation.x;
        const ry = Number.isFinite(obj.rotation[1]) ? obj.rotation[1] : existing.rotation.y;
        const rz = Number.isFinite(obj.rotation[2]) ? obj.rotation[2] : existing.rotation.z;
        existing.rotation.set(rx, ry, rz);

        const sx = Number.isFinite(obj.scale[0]) && obj.scale[0] >= 0.05 ? obj.scale[0] : existing.scale.x;
        const sy = Number.isFinite(obj.scale[1]) && obj.scale[1] >= 0.05 ? obj.scale[1] : existing.scale.y;
        const sz = Number.isFinite(obj.scale[2]) && obj.scale[2] >= 0.05 ? obj.scale[2] : existing.scale.z;
        existing.scale.set(sx, sy, sz);
        return;
      }

      // New object: create once and store in meshMapRef!
      const objGroup = new THREE.Group();
      objGroup.position.set(...obj.position);
      objGroup.rotation.set(...obj.rotation);
      objGroup.scale.set(...obj.scale);
      (objGroup as any).userData = { placedObjectId: obj.id };

      meshMapRef.current.set(obj.id, objGroup);
      group.add(objGroup);

      if (obj.fileBlobUrl) {
        // Check if model was already parsed and cached
        const cachedModel = gltfCacheRef.current.get(obj.fileBlobUrl);
        if (cachedModel) {
          const cloned = cachedModel.clone(true);
          cloned.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = false;
              if (mesh.geometry) {
                mesh.geometry.computeBoundingBox();
                mesh.geometry.computeBoundingSphere();
              }
            }
          });
          objGroup.add(cloned);
          const existingDims = rawDimensionsMapRef.current.get(obj.id);
          if (existingDims) {
            setRawDimensionsState((prev) => ({ ...prev, [obj.id]: existingDims }));
          }
          if (selectedObjectId === obj.id && transformControlsRef.current) {
            transformControlsRef.current.attach(objGroup);
          }
        } else {
          // Load custom uploaded GLB file once
          const loader = new GLTFLoader();
          loader.load(
            obj.fileBlobUrl,
            (gltf) => {
              const m = gltf.scene;

              // Unscaled raw bounding box
              const rawBox = new THREE.Box3().setFromObject(m);
              const rawSize = rawBox.getSize(new THREE.Vector3());
              const rawW = Math.max(0.01, rawSize.x);
              const rawH = Math.max(0.01, rawSize.y);
              const rawD = Math.max(0.01, rawSize.z);

              // Align base strictly to local Y = 0 (ground level)
              m.position.y = -rawBox.min.y;
              // Center horizontally
              m.position.x = -(rawBox.min.x + rawBox.max.x) / 2;
              m.position.z = -(rawBox.min.z + rawBox.max.z) / 2;

              m.traverse((node) => {
                if ((node as THREE.Mesh).isMesh) {
                  const mesh = node as THREE.Mesh;
                  mesh.castShadow = true;
                  mesh.receiveShadow = true;
                  mesh.frustumCulled = false;
                  if (mesh.geometry) {
                    mesh.geometry.computeBoundingBox();
                    mesh.geometry.computeBoundingSphere();
                  }
                  const mat = mesh.material;
                  if (mat) {
                    if (Array.isArray(mat)) {
                      mat.forEach((item) => (item.side = THREE.DoubleSide));
                    } else {
                      mat.side = THREE.DoubleSide;
                    }
                  }
                }
              });

              // Metric scaling rules
              const metric = calculateMetricScale(rawSize, obj.type, obj.name);
              const dimsRecord = {
                width: rawW,
                height: rawH,
                depth: rawD,
                targetHeight: metric.targetHeight,
                label: metric.label,
                isRoom: metric.isRoom,
              };
              rawDimensionsMapRef.current.set(obj.id, dimsRecord);
              setRawDimensionsState((prev) => ({ ...prev, [obj.id]: dimsRecord }));

              gltfCacheRef.current.set(obj.fileBlobUrl!, m);
              if (meshMapRef.current.has(obj.id)) {
                const instance = m.clone(true);
                instance.traverse((node) => {
                  if ((node as THREE.Mesh).isMesh) {
                    node.frustumCulled = false;
                  }
                });
                objGroup.add(instance);
              }

              // Auto-scale on insert: if scale is virgin [1, 1, 1], scale immediately to match metric!
              if (
                obj.scale[0] === 1 &&
                obj.scale[1] === 1 &&
                obj.scale[2] === 1 &&
                Math.abs(metric.scale - 1) > 0.05
              ) {
                objGroup.scale.set(metric.scale, metric.scale, metric.scale);
                onUpdateObjectTransformRef.current(obj.id, {
                  position: [obj.position[0], 0.0, obj.position[2]],
                  rotation: obj.rotation,
                  scale: [metric.scale, metric.scale, metric.scale],
                });
              }

              // Auto-attach Gizmo immediately upon model completion if this object is selected!
              if (selectedObjectId === obj.id && transformControlsRef.current) {
                transformControlsRef.current.attach(objGroup);
              }
            },
            undefined,
            () => {
              // Fallback mesh if file corrupted
              const fallbackMesh = createDecorativeMesh(obj.name);
              if (meshMapRef.current.has(obj.id)) {
                objGroup.add(fallbackMesh);
              }
            }
          );
        }
      } else if (
        obj.type === 'avatar' ||
        obj.isAvatar ||
        obj.modelType === 'avatar' ||
        obj.name.toLowerCase().includes('avatar')
      ) {
        const avatarMesh = createSimpleAvatarMesh();
        objGroup.add(avatarMesh);
        const dimsRecord = {
          width: 0.6,
          height: 1.7,
          depth: 0.4,
          targetHeight: 1.7,
          label: 'Avatar Interativo (~1,70 m)',
          isRoom: false,
        };
        rawDimensionsMapRef.current.set(obj.id, dimsRecord);
        setRawDimensionsState((prev) => ({ ...prev, [obj.id]: dimsRecord }));
        if (selectedObjectId === obj.id && transformControlsRef.current) {
          transformControlsRef.current.attach(objGroup);
        }
      } else if (obj.modelType === 'sofa' || obj.name.toLowerCase().includes('sofa')) {
        const sofa = createSectionalLSofa();
        objGroup.add(sofa);
        const dimsRecord = {
          width: 3.3,
          height: 0.85,
          depth: 1.7,
          targetHeight: 0.85,
          label: 'Sofá Minimalista (~0,85 m)',
          isRoom: false,
        };
        rawDimensionsMapRef.current.set(obj.id, dimsRecord);
        setRawDimensionsState((prev) => ({ ...prev, [obj.id]: dimsRecord }));
        if (selectedObjectId === obj.id && transformControlsRef.current) {
          transformControlsRef.current.attach(objGroup);
        }
      } else {
        const decorative = createDecorativeMesh(obj.name);
        objGroup.add(decorative);
        const dimsRecord = {
          width: 1.2,
          height: 0.65,
          depth: 1.2,
          targetHeight: 0.65,
          label: 'Móvel Decorativo (~0,65 m)',
          isRoom: false,
        };
        rawDimensionsMapRef.current.set(obj.id, dimsRecord);
        setRawDimensionsState((prev) => ({ ...prev, [obj.id]: dimsRecord }));
        if (selectedObjectId === obj.id && transformControlsRef.current) {
          transformControlsRef.current.attach(objGroup);
        }
      }

      // Hide default room walls if this object is a custom 3D scenario (cenario)
      if (obj.type === 'cenario' && defaultRoomGroupRef.current) {
        defaultRoomGroupRef.current.children.forEach((c) => {
          if (c.name !== 'floor') c.visible = false;
        });
      }
    });

    // Reattach TransformControls if selected object exists
    if (transformControlsRef.current) {
      if (selectedObjectId) {
        const target = meshMapRef.current.get(selectedObjectId);
        if (target) {
          if (transformControlsRef.current.object !== target) {
            transformControlsRef.current.attach(target);
          }
        } else {
          transformControlsRef.current.detach();
        }
      } else if (selectedSpotId && !lockSpots && showSpots && !isAvatarMode) {
        const spot = spots.find((s) => s.id === selectedSpotId);
        if (spot && spotGizmoAnchorRef.current) {
          if (!isTransformDraggingRef.current) {
            let worldPos = new THREE.Vector3(...spot.position);
            if (spot.parentObjectId && spot.relativePosition && meshMapRef.current.has(spot.parentObjectId)) {
              const pGroup = meshMapRef.current.get(spot.parentObjectId)!;
              worldPos = pGroup.localToWorld(new THREE.Vector3(...spot.relativePosition));
            }
            spotGizmoAnchorRef.current.position.copy(worldPos);
            spotGizmoAnchorRef.current.rotation.set(0, THREE.MathUtils.degToRad(spot.rotation), 0);
          }
          spotGizmoAnchorRef.current.visible = true;
          if (transformControlsRef.current.object !== spotGizmoAnchorRef.current) {
            transformControlsRef.current.attach(spotGizmoAnchorRef.current);
          }
        } else {
          transformControlsRef.current.detach();
        }
      } else {
        transformControlsRef.current.detach();
      }
    }
  }, [placedObjects, selectedObjectId, selectedSpotId, spots, lockSpots, showSpots, isAvatarMode]);

  // 4. Update TransformControls visual mode (Mover, Rodar, Escalar, Elevar)
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;

    // Detach only if neither an object nor an editable spot is selected
    if (!selectedObjectId && (!selectedSpotId || lockSpots || !showSpots || isAvatarMode)) {
      tc.detach();
      if (spotGizmoAnchorRef.current) spotGizmoAnchorRef.current.visible = false;
      return;
    }

    // Ensure TransformControls is attached to the selected object (Sala, Avatar, or Item)
    if (selectedObjectId) {
      const target = meshMapRef.current.get(selectedObjectId);
      if (target && tc.object !== target) {
        tc.attach(target);
      }
    }

    if (selectedSpotId && !selectedObjectId) {
      if (spotGizmoAnchorRef.current) spotGizmoAnchorRef.current.visible = true;
      if (activeGizmoMode === 'rodar') {
        tc.setMode('rotate');
        tc.showX = false;
        tc.showY = true;
        tc.showZ = false;
      } else if (activeGizmoMode === 'elevar') {
        tc.setMode('translate');
        tc.showX = false;
        tc.showY = true;
        tc.showZ = false;
      } else {
        tc.setMode('translate');
        tc.showX = true;
        tc.showY = true; // Seta para cima e para baixo (eixo vertical Y)
        tc.showZ = true;
      }
      return;
    }

    if (spotGizmoAnchorRef.current) spotGizmoAnchorRef.current.visible = false;
    if (activeGizmoMode === 'mover') {
      tc.setMode('translate');
      tc.showX = true;
      tc.showY = true; // Seta para cima e para baixo (eixo vertical Y)
      tc.showZ = true;
    } else if (activeGizmoMode === 'elevar') {
      tc.setMode('translate');
      tc.showX = false;
      tc.showY = true;
      tc.showZ = false;
    } else if (activeGizmoMode === 'rodar') {
      tc.setMode('rotate');
      tc.showX = false;
      tc.showY = true;
      tc.showZ = false;
    } else if (activeGizmoMode === 'escalar') {
      tc.setMode('scale');
      tc.showX = true;
      tc.showY = true;
      tc.showZ = true;
    }
  }, [activeGizmoMode, selectedObjectId, selectedSpotId, lockSpots, showSpots, isAvatarMode]);

  // 4b. Synchronize spotGizmoAnchor with active spot
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;

    if (selectedSpotId && !selectedObjectId && !lockSpots && showSpots && !isAvatarMode) {
      const spot = spots.find((s) => s.id === selectedSpotId);
      if (spot && spotGizmoAnchorRef.current) {
        if (!isTransformDraggingRef.current) {
          let worldPos = new THREE.Vector3(...spot.position);
          if (spot.parentObjectId && spot.relativePosition && meshMapRef.current.has(spot.parentObjectId)) {
            const pGroup = meshMapRef.current.get(spot.parentObjectId)!;
            worldPos = pGroup.localToWorld(new THREE.Vector3(...spot.relativePosition));
          }
          spotGizmoAnchorRef.current.position.copy(worldPos);
          spotGizmoAnchorRef.current.rotation.set(0, THREE.MathUtils.degToRad(spot.rotation), 0);
        }
        spotGizmoAnchorRef.current.visible = true;
        if (tc.object !== spotGizmoAnchorRef.current) {
          tc.attach(spotGizmoAnchorRef.current);
        }
      }
    } else if (!selectedObjectId) {
      if (tc.object === spotGizmoAnchorRef.current) {
        tc.detach();
      }
      if (spotGizmoAnchorRef.current) {
        spotGizmoAnchorRef.current.visible = false;
      }
    }
  }, [selectedSpotId, selectedObjectId, spots, lockSpots, showSpots, isAvatarMode]);

  // 5. Update Boundary Box and Metric Reference visibility
  useEffect(() => {
    if (roomBoundaryGroupRef.current) {
      roomBoundaryGroupRef.current.visible = showBoundaryGhost;
    }
  }, [showBoundaryGhost]);

  useEffect(() => {
    if (referenceAvatarGroupRef.current) {
      referenceAvatarGroupRef.current.visible = showReferenceAvatar && !isAvatarMode;
    }
  }, [showReferenceAvatar, isAvatarMode]);

  useEffect(() => {
    if (metricGridGroupRef.current) {
      metricGridGroupRef.current.visible = showMetricGrid;
    }
  }, [showMetricGrid]);

  useEffect(() => {
    if (spatialVerticalGridGroupRef.current) {
      spatialVerticalGridGroupRef.current.visible = showSpatialVerticalGrid;
    }
  }, [showSpatialVerticalGrid]);

  // Re-create boundary box and spatial vertical grid when room boundary dimensions or position change
  useEffect(() => {
    if (!sceneRef.current) return;
    if (roomBoundaryGroupRef.current) {
      sceneRef.current.remove(roomBoundaryGroupRef.current);
    }
    const newBoundaryBox = createRoomBoundaryBox(boundary);
    newBoundaryBox.visible = showBoundaryGhost;
    sceneRef.current.add(newBoundaryBox);
    roomBoundaryGroupRef.current = newBoundaryBox;

    if (spatialVerticalGridGroupRef.current) {
      sceneRef.current.remove(spatialVerticalGridGroupRef.current);
    }
    const newVerticalGrid = createSpatialVerticalGrid(boundary);
    newVerticalGrid.visible = showSpatialVerticalGrid;
    sceneRef.current.add(newVerticalGrid);
    spatialVerticalGridGroupRef.current = newVerticalGrid;
  }, [
    boundary.x,
    boundary.y,
    boundary.z,
    boundary.position?.[0],
    boundary.position?.[1],
    boundary.position?.[2],
    showBoundaryGhost,
    showSpatialVerticalGrid,
  ]);

  // 6. Update Insertion Marker
  useEffect(() => {
    if (!insertionMarkerRef.current) return;
    if (insertionCursorPoint) {
      insertionMarkerRef.current.position.set(...insertionCursorPoint);
      insertionMarkerRef.current.visible = true;
    } else {
      insertionMarkerRef.current.visible = false;
    }
  }, [insertionCursorPoint]);

  // Synchronize creator's defined avatar (custom GLB or styled avatar) for visitor avatar mode
  // "no modo teste da room o avatar que o criador usa e que ele definiu modo criador quando clica em modo avatar"
  useEffect(() => {
    if (!avatarGroupRef.current) return;
    const group = avatarGroupRef.current;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (activeUserAvatar?.fileBlobUrl) {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(activeUserAvatar.fileBlobUrl, (gltf) => {
        const m = gltf.scene;
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        const targetH = 1.70;
        const s = targetH / Math.max(0.1, size.y);
        m.scale.set(s, s, s);
        const scaledBox = new THREE.Box3().setFromObject(m);
        const center = scaledBox.getCenter(new THREE.Vector3());
        m.position.x = -center.x;
        m.position.z = -center.z;
        m.position.y = -scaledBox.min.y;
        m.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        group.add(m);
      });
    } else {
      const avatarMesh = createSimpleAvatarMesh(activeUserAvatar);
      group.add(avatarMesh);
    }
  }, [activeUserAvatar]);

  // 7. Update Avatar visibility and position
  useEffect(() => {
    if (!avatarGroupRef.current) return;
    if (isAvatarMode && avatarCurrentSpotId) {
      if (customAvatarObjectId) {
        // A scene object is designated as the avatar; hide the default humanoid avatar
        avatarGroupRef.current.visible = false;
      } else {
        const activeSpot = spots.find((s) => s.id === avatarCurrentSpotId);
        if (activeSpot) {
          avatarGroupRef.current.position.set(...activeSpot.position);
          avatarGroupRef.current.rotation.y = THREE.MathUtils.degToRad(activeSpot.rotation);
          avatarGroupRef.current.visible = true;
        }
      }
    } else {
      avatarGroupRef.current.visible = false;
    }
  }, [isAvatarMode, avatarCurrentSpotId, spots, customAvatarObjectId]);

  // Update Active Avatar Halo position and visibility
  useEffect(() => {
    if (!activeAvatarHaloRef.current) return;
    if (customAvatarObjectId && isAvatarMode) {
      const activeObj = placedObjects.find((o) => o.id === customAvatarObjectId);
      if (activeObj) {
        activeAvatarHaloRef.current.position.set(
          activeObj.position[0],
          0.025,
          activeObj.position[2]
        );
        activeAvatarHaloRef.current.visible = true;
        return;
      }
    }
    activeAvatarHaloRef.current.visible = false;
  }, [customAvatarObjectId, isAvatarMode, placedObjects]);

  // Spot dragging logic (only active when lockSpots is false)
  const handleSpotDragMouseDown = (spotId: string, e: React.MouseEvent) => {
    if (lockSpots) return;
    e.stopPropagation();
    if (isAvatarMode) {
      onAvatarTeleport(spotId);
      return;
    }

    onSelectSpot(spotId);
    onSelectObject(null);
    isDraggingSpotRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const spot = spots.find((s) => s.id === spotId);
    if (!spot) return;
    const initialPos = [...spot.position] as [number, number, number];

    const floor = floorMeshRef.current;
    const cam = cameraRef.current;
    const container = mountRef.current;

    const onMove = (moveEvt: MouseEvent) => {
      if (!isDraggingSpotRef.current) return;
      if (floor && cam && container) {
        const rect = container.getBoundingClientRect();
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
          ((moveEvt.clientX - rect.left) / rect.width) * 2 - 1,
          -((moveEvt.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, cam);
        const hits = raycaster.intersectObject(floor, false);
        if (hits.length > 0) {
          const pt = hits[0].point;
          onUpdateSpotPositionRef.current(spotId, [
            parseFloat(pt.x.toFixed(2)),
            initialPos[1],
            parseFloat(pt.z.toFixed(2)),
          ]);
          return;
        }
      }

      // Fallback relative drag
      const dx = (moveEvt.clientX - startX) * 0.008;
      const dz = (moveEvt.clientY - startY) * 0.008;
      onUpdateSpotPositionRef.current(spotId, [
        parseFloat((initialPos[0] + dx).toFixed(2)),
        initialPos[1],
        parseFloat((initialPos[2] + dz).toFixed(2)),
      ]);
    };

    const onUp = () => {
      isDraggingSpotRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const selectedSpot = spots.find((s) => s.id === selectedSpotId);
  const selectedObj = placedObjects.find((o) => o.id === selectedObjectId);

  // Precision object transform actions (guarded against NaN and vanishing)
  const handleUpdateObjPos = (axis: 0 | 1 | 2, val: number) => {
    if (!selectedObj) return;
    if (isNaN(val) || !isFinite(val)) return;
    const newPos = [...selectedObj.position] as [number, number, number];
    newPos[axis] = parseFloat(val.toFixed(2));
    onUpdateObjectTransform(selectedObj.id, {
      position: newPos,
      rotation: selectedObj.rotation,
      scale: selectedObj.scale,
    });
  };

  const handleStepObjPos = (axis: 0 | 1 | 2, delta: number) => {
    if (!selectedObj) return;
    const currentVal = selectedObj.position[axis];
    if (isNaN(currentVal) || !isFinite(currentVal)) return;
    handleUpdateObjPos(axis, currentVal + delta);
  };

  const handleUpdateObjRotY = (deg: number) => {
    if (!selectedObj) return;
    if (isNaN(deg) || !isFinite(deg)) return;
    const rad = THREE.MathUtils.degToRad(deg % 360);
    onUpdateObjectTransform(selectedObj.id, {
      position: selectedObj.position,
      rotation: [selectedObj.rotation[0], rad, selectedObj.rotation[2]],
      scale: selectedObj.scale,
    });
  };

  const handleStepObjRotY = (deltaDeg: number) => {
    if (!selectedObj) return;
    const currentDeg = Math.round(THREE.MathUtils.radToDeg(selectedObj.rotation[1]));
    handleUpdateObjRotY(currentDeg + deltaDeg);
  };

  const handleUpdateObjScale = (scaleFactor: number) => {
    if (!selectedObj) return;
    if (isNaN(scaleFactor) || !isFinite(scaleFactor) || scaleFactor <= 0) return;
    const safeScale = Math.max(0.005, Math.min(100.0, parseFloat(scaleFactor.toFixed(3))));
    onUpdateObjectTransform(selectedObj.id, {
      position: selectedObj.position,
      rotation: selectedObj.rotation,
      scale: [safeScale, safeScale, safeScale],
    });
  };

  const handleStepObjScale = (delta: number) => {
    if (!selectedObj) return;
    const currentScale = selectedObj.scale[0] || 1;
    handleUpdateObjScale(currentScale + delta);
  };

  // One-click "Encaixar no Metro" button: matches object height to real-world target metric
  // Formula: escala = alvo / altura_atual_da_bbox (ex: 2.8 / 0.93 = x3.01)
  const handleFitToMetric = (targetHeightOverride?: number) => {
    if (selectedObj) {
      const dims = rawDimensionsState[selectedObj.id] || rawDimensionsMapRef.current.get(selectedObj.id);
      const rawH = Math.max(0.001, dims?.height || (selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.6));
      const targetH = targetHeightOverride !== undefined ? targetHeightOverride : (dims?.targetHeight || 2.80);
      const calculatedScale = Math.max(0.005, calculatePresetScale(rawH, targetH));

      onUpdateObjectTransform(selectedObj.id, {
        position: [selectedObj.position[0], 0.0, selectedObj.position[2]],
        rotation: selectedObj.rotation,
        scale: [calculatedScale, calculatedScale, calculatedScale],
      });
    } else if (customScenarioGroupRef.current) {
      const sceneDims = rawDimensionsState['__scene_room__'] || rawDimensionsMapRef.current.get('__scene_room__');
      const rawH = Math.max(0.001, sceneDims?.height || boundary.y || 2.80);
      const targetH = targetHeightOverride !== undefined ? targetHeightOverride : 2.80;
      const calculatedScale = Math.max(0.005, calculatePresetScale(rawH, targetH));
      customScenarioGroupRef.current.scale.set(calculatedScale, calculatedScale, calculatedScale);
    }
  };

  const handleApplyScaleFromModal = (newScale: number, preset?: MetricPresetItem) => {
    if (selectedObj) {
      onUpdateObjectTransform(selectedObj.id, {
        position: [selectedObj.position[0], 0.0, selectedObj.position[2]],
        rotation: selectedObj.rotation,
        scale: [newScale, newScale, newScale],
      });
    } else if (customScenarioGroupRef.current) {
      customScenarioGroupRef.current.scale.set(newScale, newScale, newScale);
    }
  };

  const handleApplyBoundaryFromModal = (newBoundary: PlayableBoundary) => {
    if (onUpdateBoundary) {
      onUpdateBoundary(newBoundary);
    }
  };

  // Precision spot transform actions
  const handleUpdateSpotPos = (axis: 0 | 1 | 2, val: number) => {
    if (!selectedSpot) return;
    if (isNaN(val) || !isFinite(val)) return;
    const newPos = [...selectedSpot.position] as [number, number, number];
    newPos[axis] = parseFloat(val.toFixed(2));
    onUpdateSpotPosition(selectedSpot.id, newPos);
  };

  const handleStepSpotPos = (axis: 0 | 1 | 2, delta: number) => {
    if (!selectedSpot) return;
    const currentVal = selectedSpot.position[axis];
    if (isNaN(currentVal) || !isFinite(currentVal)) return;
    handleUpdateSpotPos(axis, currentVal + delta);
  };

  const handleUpdateSpotRot = (deg: number) => {
    if (!selectedSpot) return;
    if (isNaN(deg) || !isFinite(deg)) return;
    const safeDeg = Math.round(((deg % 360) + 360) % 360);
    onUpdateSpotRotation(selectedSpot.id, safeDeg);
  };

  const handleStepSpotRot = (deltaDeg: number) => {
    if (!selectedSpot) return;
    handleUpdateSpotRot(selectedSpot.rotation + deltaDeg);
  };

  // Unlimited smooth zoom controls
  const handleZoom = (factor: number) => {
    cameraAngleRef.current.distance = Math.max(
      0.005,
      Math.min(3000.0, cameraAngleRef.current.distance * factor)
    );
  };

  const handleResetCamera = () => {
    cameraAngleRef.current = { theta: 0.02, phi: 0.22, distance: 5.6 };
    cameraTargetRef.current.set(0.3, 0.7, -0.6);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#101115] font-sans">
      {/* 3D WebGL Canvas with Direct Drag-and-Drop Item Placement Support */}
      <div
        ref={mountRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const rawData = e.dataTransfer.getData('application/json');
          if (!rawData) return;
          try {
            const item: InventoryItem = JSON.parse(rawData);
            if (!item || !item.id) return;
            const container = mountRef.current;
            if (container && cameraRef.current && floorMeshRef.current) {
              const rect = container.getBoundingClientRect();
              const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
              );
              const raycaster = new THREE.Raycaster();
              raycaster.setFromCamera(mouse, cameraRef.current);
              const hits = raycaster.intersectObject(floorMeshRef.current, false);
              const coords: [number, number, number] = hits.length > 0
                ? [parseFloat(hits[0].point.x.toFixed(2)), 0.02, parseFloat(hits[0].point.z.toFixed(2))]
                : [0, 0.02, 0];
              onDropItemOnScene?.(item, coords);
            }
          } catch (err) {
            console.error('Failed to parse dropped item', err);
          }
        }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* PERSISTENT EXIT EDITOR BUTTON (Always visible on canvas so user never gets lost or pushed off screen!) */}
      {onExitEditor && (
        <button
          type="button"
          onClick={onExitEditor}
          className="absolute top-3 right-16 z-30 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-[0_4px_20px_rgba(245,158,11,0.5)] border border-white/40 cursor-pointer transition-all active:scale-95 pointer-events-auto"
          title="Sair do modo de edição e voltar para o Lobby das salas"
        >
          <LogOut className="w-4 h-4 text-black stroke-[2.5]" />
          <span>SAIR DO EDITOR</span>
        </button>
      )}

      {/* TOP FLOATING BLENDER TOOLBAR (Mover, Rodar, Escalar, Elevar) */}
      {!isAvatarMode && (
        <div className="absolute top-3 left-4 z-20 flex items-center gap-1.5 bg-[#121317]/95 border border-[#d4af37]/60 rounded-xl px-2 py-1.5 shadow-[0_4px_25px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <span className="text-[10px] font-semibold tracking-wider text-[#d4af37]/75 uppercase px-1 hidden sm:inline">
            Ferramenta:
          </span>

          <button
            type="button"
            onClick={() => onChangeGizmoMode('mover')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGizmoMode === 'mover'
                ? 'bg-[#d4af37] text-black shadow-md font-bold'
                : 'text-[#e8d5b5]/80 hover:text-[#ffd700] hover:bg-[#d4af37]/15'
            }`}
            title="Mover objeto no plano do chão (Atalho: G)"
          >
            <Move className="w-3.5 h-3.5" />
            <span>Mover (G)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGizmoMode('rodar')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGizmoMode === 'rodar'
                ? 'bg-[#d4af37] text-black shadow-md font-bold'
                : 'text-[#e8d5b5]/80 hover:text-[#ffd700] hover:bg-[#d4af37]/15'
            }`}
            title="Rotacionar em graus no eixo Y (Atalho: R)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rodar (R)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGizmoMode('escalar')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGizmoMode === 'escalar'
                ? 'bg-[#d4af37] text-black shadow-md font-bold'
                : 'text-[#e8d5b5]/80 hover:text-[#ffd700] hover:bg-[#d4af37]/15'
            }`}
            title="Escalar objeto proporcionalmente (Atalho: S)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Escalar (S)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGizmoMode('elevar')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGizmoMode === 'elevar'
                ? 'bg-[#d4af37] text-black shadow-md font-bold'
                : 'text-[#e8d5b5]/80 hover:text-[#ffd700] hover:bg-[#d4af37]/15'
            }`}
            title="Elevar objeto no eixo vertical (Atalho: E)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Elevar (E)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#d4af37]/30 mx-1 hidden sm:block" />

          {/* Quick Metric Reference Toggles in Toolbar */}
          <button
            type="button"
            onClick={() => setShowReferenceAvatar((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
              showReferenceAvatar
                ? 'text-[#38bdf8] bg-[#38bdf8]/15 border border-[#38bdf8]/30'
                : 'text-[#e8d5b5]/40 hover:text-[#38bdf8]'
            }`}
            title={showReferenceAvatar ? 'Ocultar Avatar Fantasma 1,70m' : 'Exibir Avatar Fantasma 1,70m'}
          >
            <User className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden xl:inline">Avatar 1,70m</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMetricGrid((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
              showMetricGrid
                ? 'text-[#ffd700] bg-[#d4af37]/15 border border-[#d4af37]/30'
                : 'text-[#e8d5b5]/40 hover:text-[#ffd700]'
            }`}
            title={showMetricGrid ? 'Ocultar Grade no Chão (1m)' : 'Exibir Grade no Chão (1m)'}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden xl:inline">Grade Chão</span>
          </button>

          {/* Toggle Grade Espaço na Vertical (Paredes de fundo e lateral) */}
          <button
            type="button"
            onClick={() => setShowSpatialVerticalGrid((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
              showSpatialVerticalGrid
                ? 'text-sky-400 bg-sky-500/15 border border-sky-400/30'
                : 'text-[#e8d5b5]/40 hover:text-sky-400'
            }`}
            title={showSpatialVerticalGrid ? 'Ocultar Grades no Espaço na Vertical' : 'Exibir Grades no Espaço na Vertical'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden xl:inline">Grade Vertical</span>
          </button>

          {/* Reset Camera button */}
          <button
            type="button"
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 text-[#e8d5b5]/70 hover:text-[#ffd700] hover:bg-[#d4af37]/15"
            title="Recentrar Câmera (Reset de órbita e deslocamento)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden 2xl:inline">Reset Câm</span>
          </button>

          {/* Quick Spots Toggles in Toolbar */}
          {onToggleShowSpots && (
            <button
              type="button"
              onClick={onToggleShowSpots}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                showSpots ? 'text-[#ffd700] hover:bg-[#d4af37]/15' : 'text-red-400 bg-red-950/30'
              }`}
              title={showSpots ? 'Ocultar spots da cena' : 'Mostrar spots na cena'}
            >
              {showSpots ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {onToggleLockSpots && (
            <button
              type="button"
              onClick={onToggleLockSpots}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                lockSpots ? 'text-[#ffd700] bg-[#d4af37]/25' : 'text-[#d4af37]/60 hover:text-[#d4af37]'
              }`}
              title={lockSpots ? 'Spots travados (cliques afetam só objetos 3D)' : 'Travar spots'}
            >
              {lockSpots ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Open Size Selector Modal in Toolbar */}
          <button
            type="button"
            onClick={() => setIsSizeSelectorModalOpen(true)}
            className="p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 text-[#ffd700] bg-[#d4af37]/15 border border-[#d4af37]/30 hover:bg-[#d4af37]/30 shadow-sm"
            title="Abrir Seletor de Tamanho & Presets de Escala 1:1"
          >
            <Ruler className="w-3.5 h-3.5 text-[#ffd700]" />
            <span className="text-[10px] hidden xl:inline font-bold">Presets Métrica</span>
          </button>

          {/* Quick Remove Overlapping Spots button */}
          {onRemoveOverlappingSpots && (
            <button
              type="button"
              onClick={onRemoveOverlappingSpots}
              className="p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 text-[#ffd700] bg-[#1a1b22] border border-[#d4af37]/40 hover:bg-[#d4af37] hover:text-black shadow-sm"
              title="Remover spots sobrepostos na cena"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] hidden xl:inline font-semibold">Limpar Sobrepostos</span>
            </button>
          )}

          {/* Quick Insert Spot at Object Coordinates in Top Toolbar */}
          {selectedObj && onAddSpotAtObject && (
            <button
              type="button"
              onClick={() => onAddSpotAtObject(selectedObj.id)}
              className="p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-black bg-gradient-to-r from-[#d4af37] via-[#ffd700] to-[#e2bd44] hover:brightness-110 shadow-md active:scale-95 animate-pulse"
              title={`Criar spot fixo exatamente nas coordenadas de "${selectedObj.name}". O spot permanecerá mesmo se você remover o objeto depois!`}
            >
              <MapPin className="w-3.5 h-3.5 fill-black" />
              <span className="text-[11px]">📍 Criar Spot no Objeto</span>
            </button>
          )}
        </div>
      )}

      {/* Visual Metric System Reference Badge (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-2.5 bg-[#121317]/90 border border-[#d4af37]/40 rounded-xl px-3 py-1.5 shadow-lg backdrop-blur-md text-[11px] text-[#e8d5b5]">
        <button
          type="button"
          onClick={() => setIsSizeSelectorModalOpen(true)}
          className="flex items-center gap-1.5 text-[#ffd700] hover:text-white font-bold cursor-pointer transition-colors bg-[#d4af37]/20 hover:bg-[#d4af37]/35 px-2 py-0.5 rounded-lg border border-[#d4af37]/50 pointer-events-auto"
          title="Clique para abrir o Seletor de Tamanho & Presets Métrica 1:1"
        >
          <Ruler className="w-3.5 h-3.5 text-[#ffd700]" />
          <span>📐 Seletor de Tamanho</span>
        </button>
        <div className="flex items-center gap-2 text-[11px] font-mono pointer-events-none">
          <span className="text-emerald-400">Chão Y=0</span>
          <span className="text-[#d4af37]/40">·</span>
          <span className="text-sky-300">Avatar = 1,70 m</span>
          <span className="text-[#d4af37]/40">·</span>
          <span className="text-amber-300">Grid = 1m × 1m</span>
          <span className="text-[#d4af37]/40">·</span>
          <span className="text-[#e8d5b5]/80">Room: {boundary.x}×{boundary.z}×{boundary.y}m</span>
          <span className="text-[#d4af37]/40">·</span>
          <span className="text-[#ffd700] font-sans font-medium">🖱️ Botão Dir: Pan</span>
          <span className="text-[#d4af37]/40">·</span>
          <span className="text-[#ffd700] font-sans font-medium">⌨️ Setas: Mover Cenário (↑ Frente · ↓ Trás · ← Lados · PgUp/PgDn Altura)</span>
        </div>
      </div>

      {/* Surface Snap Floating Notification Banner */}
      {surfaceSnapTargetObjectId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#121317]/95 border-2 border-amber-400 rounded-xl px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.95)] backdrop-blur-md flex items-center gap-3 text-xs text-amber-200 animate-fade-in ring-2 ring-amber-400/50">
          <Crosshair className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
          <div>
            <span className="font-bold text-amber-300 block">Modo Spot Relativo na Superfície</span>
            <span className="text-[11px] text-[#e8d5b5]/80">
              Passe o mouse sobre a geometria do objeto 3D e clique para fixar o spot na superfície!
            </span>
          </div>
          {onCancelSurfaceSnap && (
            <button
              type="button"
              onClick={onCancelSurfaceSnap}
              className="ml-2 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer border border-zinc-600 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {/* Motion Test / Spot Fantasma Floating Status Pill */}
      {(testingMotionSpotId || (selectedSpot?.motion?.enabled && !isAvatarMode)) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#0c1a24]/95 border-2 border-cyan-400 rounded-2xl px-5 py-2.5 shadow-[0_12px_40px_rgba(0,240,255,0.4)] backdrop-blur-md flex items-center gap-3.5 text-xs text-cyan-200 animate-fade-in ring-2 ring-cyan-400/40">
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
          <div className="flex flex-col">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5 text-xs">
              <span>👻 Spot Fantasma em Movimento</span>
              <span className="text-[10px] bg-cyan-900/80 text-cyan-200 px-1.5 py-0.5 rounded border border-cyan-400/40 font-mono">
                Base: {selectedSpot?.name || spots.find((s) => s.id === testingMotionSpotId)?.name || 'Spot'}
              </span>
            </div>
            <span className="text-[11px] text-zinc-300">
              O spot original fica <strong>fixo na base</strong> e o <strong>Spot Fantasma</strong> percorre o trajeto em tempo real!
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            {/* Play / Pause Toggle Button */}
            <button
              type="button"
              onClick={() => setIsTimelinePlaying((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-200 text-xs font-bold cursor-pointer border border-cyan-400/60 transition-colors flex items-center gap-1 shadow-sm"
              title={isTimelinePlaying ? 'Pausar simulação do Spot Fantasma' : 'Continuar simulação do Spot Fantasma'}
            >
              {isTimelinePlaying ? (
                <>
                  <Pause className="w-3 h-3 text-cyan-300" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-cyan-300 fill-cyan-300" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Restart Cycle Button */}
            <button
              type="button"
              onClick={() => {
                setTimelineProgress(0);
                timelineProgressRef.current = 0;
                setIsTimelinePlaying(true);
              }}
              className="px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-xs font-semibold cursor-pointer border border-cyan-500/40 transition-colors flex items-center gap-1"
              title="Reiniciar percurso a partir da base"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="text-[10px]">Início</span>
            </button>

            {testingMotionSpotId && onToggleTestSpotMotion && (
              <button
                type="button"
                onClick={() => onToggleTestSpotMotion(testingMotionSpotId)}
                className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-bold cursor-pointer border border-red-500/50 transition-colors"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating HUD: Surface Snap Precision Cursor Adjustment */}
      {surfaceSnapTargetObjectId && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-[#121318]/95 border-2 border-amber-400 rounded-2xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.95)] backdrop-blur-md flex flex-col items-center gap-2 text-[#e8d5b5] pointer-events-auto ring-2 ring-amber-500/30">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-bold text-amber-300">
                Fixando Ponto na Superfície do Objeto
              </span>
            </div>
            {onCancelSurfaceSnap && (
              <button
                type="button"
                onClick={onCancelSurfaceSnap}
                className="px-2.5 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
              >
                Cancelar (ESC)
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11px] text-zinc-300 font-semibold whitespace-nowrap">
              🎯 Tamanho do Ponto Fixo (Raio):
            </span>
            <input
              type="range"
              min="0.02"
              max="0.45"
              step="0.01"
              value={spotVisualConfig?.relativeSpotRadius || 0.12}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (spotVisualConfigRef.current) {
                  spotVisualConfigRef.current.relativeSpotRadius = val;
                }
                if (surfaceRingMeshRef.current) {
                  const sFactor = Math.max(0.15, Math.min(4.0, val / 0.12));
                  surfaceRingMeshRef.current.scale.set(sFactor, sFactor, sFactor);
                }
              }}
              className="w-44 h-2 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <span className="font-mono text-xs font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-400/40">
              {(spotVisualConfig?.relativeSpotRadius || 0.12).toFixed(2)}m
            </span>
          </div>
          <div className="flex items-center justify-between w-full text-[9px] text-zinc-400 border-t border-amber-400/20 pt-1">
            <span>Fino (0.04m: Rosto/Mão)</span>
            <span>Padrão (0.12m)</span>
            <span>Amplo (0.35m: Assento/Superfície)</span>
          </div>
        </div>
      )}

      {/* Scenario Loading Indicator Overlay */}
      {isLoadingScenario && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#121317]/95 border border-[#d4af37] rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-md flex items-center gap-3 text-xs text-[#ffd700] animate-fade-in">
          <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
          <span className="font-semibold">{scenarioLoadingMsg}</span>
        </div>
      )}

      {/* Floating 2D SPOTS Overlaid in Scene (Only rendered when showSpots === true) */}
      {showSpots && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {spots.map((spot) => {
            if (!cameraRef.current || !mountRef.current) return null;
            let posVec = new THREE.Vector3(...spot.position);
            if (spot.parentObjectId && spot.relativePosition && meshMapRef.current.has(spot.parentObjectId)) {
              const pGroup = meshMapRef.current.get(spot.parentObjectId)!;
              posVec = pGroup.localToWorld(new THREE.Vector3(...spot.relativePosition));
            }
            const proj = posVec.project(cameraRef.current);
            if (proj.z > 1) return null;

            const rect = mountRef.current.getBoundingClientRect();
            const screenX = ((proj.x + 1) / 2) * rect.width;
            const screenY = ((-proj.y + 1) / 2) * rect.height;

            const isSelected = selectedSpotId === spot.id;
            const isAvatarHere = isAvatarMode && avatarCurrentSpotId === spot.id;

            const indicatorStyle = spotVisualConfig?.indicatorStyle || 'full';
            const arrowScale = spotVisualConfig?.arrowScale ?? 1.0;
            const signalScale = spotVisualConfig?.signalScale ?? 1.0;

            const isArrowOnly = indicatorStyle === 'arrow_only';
            const isWhitePulse = indicatorStyle === 'white_pulse';
            const isYellow = indicatorStyle === 'yellow_gold';
            const showArrow = isArrowOnly || indicatorStyle === 'full';
            const showSignal = !isArrowOnly;

            const depthZIndex = Math.max(10, Math.min(30, Math.round(30 - proj.z * 5)));
            const effectiveZIndex = isAvatarHere ? 50 : isSelected ? 40 : depthZIndex;

            return (
              <div
                key={spot.id}
                style={{ left: `${screenX}px`, top: `${screenY}px`, zIndex: effectiveZIndex }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group ${
                  lockSpots ? 'pointer-events-none opacity-60' : 'pointer-events-auto cursor-pointer'
                }`}
                onClick={(e) => {
                  if (lockSpots) return;
                  e.stopPropagation();
                  if (isAvatarMode) {
                    onAvatarTeleport(spot.id);
                  } else {
                    onSelectSpot(spot.id);
                    onSelectObject(null);
                  }
                }}
                onMouseDown={(e) => handleSpotDragMouseDown(spot.id, e)}
              >
                {/* 1. Downward Indicative Arrow (Seta indicadora) */}
                {showArrow && (
                  <div
                    style={{ transform: `scale(${arrowScale})` }}
                    className={`mb-0.5 flex items-center justify-center transition-all ${
                      isWhitePulse
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.95)] animate-bounce'
                        : 'text-[#ffd700] drop-shadow-[0_0_8px_rgba(255,215,0,0.85)] animate-bounce'
                    }`}
                    title="Seta indicadora do Spot"
                  >
                    <ArrowDown className="w-5 h-5 stroke-[2.5]" />
                  </div>
                )}

                {/* 2. Spot Label & Status Badges */}
                <div className="flex items-center gap-1 mb-1 flex-wrap justify-center pointer-events-none">
                  <span className={`text-[10px] font-medium tracking-wider select-none px-1 rounded backdrop-blur-sm ${
                    isWhitePulse
                      ? 'text-white bg-black/80 border border-white/40'
                      : 'text-[#ffd700] bg-black/80 border border-[#d4af37]/40'
                  }`}>
                    {spot.name || `SPOT ${spot.type}`}
                  </span>
                  {spot.parentObjectId && (
                    <span className="text-[8px] bg-amber-400 text-black font-extrabold px-1 rounded shadow-sm">
                      🔗 Relativo
                    </span>
                  )}
                  {spot.motion?.enabled && (
                    <span className="text-[8px] bg-cyan-400 text-black font-extrabold px-1 rounded shadow-sm flex items-center gap-0.5 animate-pulse">
                      <span>👻</span>
                      <span>Fantasma Ativo</span>
                    </span>
                  )}
                  {spot.motion?.enabled && (
                    <span className="text-[8px] bg-amber-400 text-black font-extrabold px-1 rounded shadow-sm">
                      ⚓ Base
                    </span>
                  )}
                  {testingMotionSpotId === spot.id && (
                    <span className="text-[8px] bg-cyan-300 text-black font-extrabold px-1 rounded shadow-sm">
                      ▶ Focado
                    </span>
                  )}
                </div>

                {/* 3. Spot Ground Signal Marker */}
                {isArrowOnly ? (
                  /* Minimal anchor point when creator chooses arrow_only */
                  <div
                    style={{ transform: `scale(${signalScale})` }}
                    className="w-3.5 h-3.5 rounded-full border border-dashed border-white/70 bg-white/20 flex items-center justify-center shadow-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                ) : spot.type === 'sentar' ? (
                  /* Sitting Spot Signal */
                  <div
                    style={{ transform: `scale(${signalScale})` }}
                    className={`rounded-full flex items-center justify-center transition-all ${
                      isWhitePulse
                        ? `w-8 h-8 border-2 border-white bg-white/20 animate-pulse shadow-[0_0_16px_rgba(255,255,255,0.85)] ${
                            isSelected || isAvatarHere ? 'ring-2 ring-white scale-110' : ''
                          }`
                        : `w-8 h-8 border-2 border-[#d4af37] bg-[#d4af37]/20 shadow-[0_0_14px_rgba(212,175,55,0.5)] ${
                            isSelected || isAvatarHere ? 'ring-2 ring-[#ffd700] scale-110' : ''
                          }`
                    }`}
                  >
                    {isWhitePulse ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
                    ) : (
                      <MapPin className="w-4 h-4 fill-[#d4af37] stroke-black" />
                    )}
                  </div>
                ) : (
                  /* Standing / Lying Spot Signal (Oval floor marking) */
                  <div
                    style={{ transform: `scale(${signalScale})` }}
                    className={`w-28 h-12 rounded-[50%] flex items-center justify-center transition-all ${
                      isWhitePulse
                        ? `border-2 border-white bg-white/15 animate-pulse shadow-[0_0_18px_rgba(255,255,255,0.8)] ${
                            isSelected || isAvatarHere ? 'ring-2 ring-white bg-white/25' : ''
                          }`
                        : `border-2 border-[#d4af37] bg-[#d4af37]/10 shadow-[0_0_15px_rgba(212,175,55,0.4)] ${
                            isSelected || isAvatarHere ? 'border-[#ffd700] ring-2 ring-[#ffd700]/70 bg-[#d4af37]/25' : ''
                          }`
                    }`}
                  >
                    {/* Center Point */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isWhitePulse
                          ? 'bg-white shadow-[0_0_8px_#ffffff] animate-ping'
                          : 'bg-[#ffd700] shadow-[0_0_6px_#ffd700]'
                      }`}
                    />
                    {isAvatarHere && (
                      <span className={`ml-1 text-[10px] font-bold ${isWhitePulse ? 'text-white' : 'text-[#ffd700]'}`}>
                        Avatar
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FLOATING GIZMO & ADJUSTER OVER SELECTED SPOT */}
      {showSpots && !lockSpots && selectedSpot && spotGizmoScreenPos && !isAvatarMode && (
        <div
          style={{
            left: `${spotGizmoScreenPos.x}px`,
            top: `${spotGizmoScreenPos.y}px`,
          }}
          className="absolute transform -translate-x-1/2 -translate-y-full z-20 flex flex-col items-center pointer-events-auto animate-fade-in"
        >
          {/* Main Floating Spot Controller Box */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121317]/95 border border-[#d4af37] rounded-xl p-2.5 shadow-[0_6px_30px_rgba(0,0,0,0.9)] backdrop-blur-md flex flex-col gap-2 min-w-[280px] text-[#e8d5b5]"
          >
            {/* Header: Spot Name and Delete */}
            <div className="flex items-center justify-between border-b border-[#d4af37]/25 pb-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="font-bold text-[#ffd700] truncate max-w-[150px]">
                  {selectedSpot.name || `Spot (${selectedSpot.type})`}
                </span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded border border-[#d4af37]/40 text-[#d4af37]">
                  {selectedSpot.type}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedSpot.motion?.enabled && onOpenTrajectoryTimeline && (
                  <button
                    type="button"
                    onClick={() => onOpenTrajectoryTimeline(selectedSpot.id)}
                    className="px-2 py-0.5 rounded bg-purple-900/80 hover:bg-purple-800 text-[10px] text-purple-200 font-semibold border border-purple-500/50 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    title="Ajustar trajetória em timeline estilo edição de vídeo"
                  >
                    <Sliders className="w-3 h-3 text-purple-300" />
                    <span>Trajetória</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveSpot(selectedSpot.id)}
                  className="p-1 rounded text-red-400 hover:text-white hover:bg-red-900/80 transition-colors cursor-pointer"
                  title="Excluir spot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Live Spatial Height Indicator (Perto da seta Y do Gizmo) */}
            <div className="flex items-center justify-between bg-emerald-950/70 border border-emerald-500/50 rounded-lg px-2.5 py-1 text-[11px] font-mono text-emerald-300">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">↕️</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">Altura do Solo:</span>
                <span className="text-[#ffd700] font-black text-xs">+{selectedSpot.position[1].toFixed(2)} m</span>
              </div>
              <span className="text-[10px] text-emerald-400/80">Solo = 0.00m</span>
            </div>

            {/* Spot Fantasma Quick Controller in Floating Box */}
            {selectedSpot.motion?.enabled && (
              <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-400/60 space-y-1.5 text-xs text-cyan-200 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
                    <span className="text-sm">👻</span>
                    <span>Spot Fantasma</span>
                    <span className="text-[9px] bg-cyan-400/20 text-cyan-200 px-1 rounded">Em Movimento</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsTimelinePlaying((prev) => !prev)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-900 hover:bg-cyan-800 text-cyan-200 border border-cyan-400/50 cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      {isTimelinePlaying ? (
                        <>
                          <Pause className="w-2.5 h-2.5" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-2.5 h-2.5 fill-cyan-300" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimelineProgress(0);
                        timelineProgressRef.current = 0;
                        setIsTimelinePlaying(true);
                      }}
                      className="p-1 rounded text-[10px] bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 cursor-pointer"
                      title="Reiniciar percurso a partir da base"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-cyan-100/90 font-mono bg-black/60 px-2 py-1 rounded border border-cyan-400/20">
                  <span>Deslocamento da Base:</span>
                  <span className="font-bold text-cyan-300">
                    ΔX: {selectedSpot.motion.deltaPosition[0]}m · ΔZ: {selectedSpot.motion.deltaPosition[2]}m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAvatarTeleport(selectedSpot.id);
                  }}
                  className="w-full mt-1 py-1 px-2 rounded text-[10px] font-bold bg-[#ffd700]/20 hover:bg-[#ffd700]/30 text-[#ffd700] border border-[#ffd700]/50 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  title="Posicionar avatar neste spot para acompanhar a animação em tempo real"
                >
                  <span>🚶</span>
                  <span>{avatarCurrentSpotId === selectedSpot.id ? '✓ Avatar no Spot (Acompanhando Trajetória)' : 'Posicionar Avatar neste Spot'}</span>
                </button>
              </div>
            )}

            {/* Quick Avatar Placement Button for Still Spot (without motion) */}
            {!selectedSpot.motion?.enabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAvatarTeleport(selectedSpot.id);
                }}
                className={`w-full py-1.5 px-2 rounded text-[10px] font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                  avatarCurrentSpotId === selectedSpot.id
                    ? 'bg-emerald-900/70 border-emerald-400 text-emerald-200'
                    : 'bg-black/60 border-[#ffd700]/50 hover:bg-[#ffd700]/20 text-[#ffd700]'
                }`}
                title="Posicionar avatar fixo e parado neste spot"
              >
                <span>🚶</span>
                <span>{avatarCurrentSpotId === selectedSpot.id ? '✓ Avatar Fixo neste Spot' : 'Posicionar Avatar neste Spot'}</span>
              </button>
            )}

            {/* Mode Selector Buttons (Mover, Rodar, Elevar) */}
            <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-[#d4af37]/20">
              <button
                type="button"
                onClick={() => onChangeGizmoMode('mover')}
                className={`py-1 rounded text-center text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeGizmoMode === 'mover'
                    ? 'bg-[#d4af37] text-black font-bold shadow'
                    : 'text-[#e8d5b5]/80 hover:text-white hover:bg-[#d4af37]/15'
                }`}
                title="Mover spot no chão X/Z"
              >
                <Move className="w-3 h-3" />
                <span>Mover</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeGizmoMode('rodar')}
                className={`py-1 rounded text-center text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeGizmoMode === 'rodar'
                    ? 'bg-[#d4af37] text-black font-bold shadow'
                    : 'text-[#e8d5b5]/80 hover:text-white hover:bg-[#d4af37]/15'
                }`}
                title="Rotacionar spot (eixo Y)"
              >
                <RotateCw className="w-3 h-3" />
                <span>Rodar</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeGizmoMode('elevar')}
                className={`py-1 rounded text-center text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeGizmoMode === 'elevar'
                    ? 'bg-[#d4af37] text-black font-bold shadow'
                    : 'text-[#e8d5b5]/80 hover:text-white hover:bg-[#d4af37]/15'
                }`}
                title="Elevar spot (eixo Y)"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Elevar</span>
              </button>
            </div>

            {/* Sub-Panel: Coordinates & Fine Adjuster */}
            {activeGizmoMode === 'mover' && (
              <div className="space-y-1.5 pt-0.5">
                <div className="text-[10px] text-[#d4af37] font-semibold flex justify-between">
                  <span>Posição no Chão:</span>
                  <span className="font-mono text-white text-[10px]">
                    X: {selectedSpot.position[0].toFixed(2)}m · Z: {selectedSpot.position[2].toFixed(2)}m
                  </span>
                </div>
                {/* Steppers for X and Z */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-[#d4af37]/20">
                    <span className="text-[9px] font-mono text-[#d4af37] font-bold">X</span>
                    <button
                      type="button"
                      onClick={() => handleStepSpotPos(0, -0.1)}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs font-bold text-[#ffd700] cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-mono text-[10px] text-[#ffd700]">
                      {selectedSpot.position[0].toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStepSpotPos(0, 0.1)}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs font-bold text-[#ffd700] cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-[#d4af37]/20">
                    <span className="text-[9px] font-mono text-[#d4af37] font-bold">Z</span>
                    <button
                      type="button"
                      onClick={() => handleStepSpotPos(2, -0.1)}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs font-bold text-[#ffd700] cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-mono text-[10px] text-[#ffd700]">
                      {selectedSpot.position[2].toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStepSpotPos(2, 0.1)}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs font-bold text-[#ffd700] cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-[#e8d5b5]/60 text-center">
                  Use o Gizmo 3D vermelho/azul ou arraste o spot diretamente no cenário!
                </p>
              </div>
            )}

            {activeGizmoMode === 'elevar' && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-[#d4af37]">Altura do Spot (Y):</span>
                  <span className="font-mono text-[#ffd700] text-xs font-bold bg-black/40 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                    {selectedSpot.position[1].toFixed(2)}m
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepSpotPos(1, -0.05)}
                    className="w-6 h-6 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs font-bold text-[#ffd700] cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="2.5"
                    step="0.05"
                    value={selectedSpot.position[1]}
                    onChange={(e) => handleUpdateSpotPos(1, parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-[#ffd700]"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepSpotPos(1, 0.05)}
                    className="w-6 h-6 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs font-bold text-[#ffd700] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {activeGizmoMode === 'rodar' && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-[#d4af37]">Direção do Avatar:</span>
                  <span className="font-mono text-[#ffd700] text-xs font-bold bg-black/40 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                    {Math.round(((selectedSpot.rotation % 360) + 360) % 360)}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepSpotRot(-15)}
                    className="px-1.5 py-0.5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700] cursor-pointer"
                  >
                    -15°
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={Math.round(((selectedSpot.rotation % 360) + 360) % 360)}
                    onChange={(e) => handleUpdateSpotRot(parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-[#ffd700]"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepSpotRot(15)}
                    className="px-1.5 py-0.5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700] cursor-pointer"
                  >
                    +15°
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {[0, 45, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => handleUpdateSpotRot(deg)}
                      className="py-0.5 rounded bg-[#181a20] hover:bg-[#d4af37] hover:text-black text-[9px] font-mono text-[#e8d5b5]/80 cursor-pointer"
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Relative Spot Surface Controls: Radius and Tags */}
            {selectedSpot.parentObjectId && (
              <div className="p-2 rounded bg-black/60 border border-amber-400/40 space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    🎯 Raio do Ponto Fixo:
                  </span>
                  <span className="font-mono text-amber-200 font-bold bg-black px-1.5 py-0.5 rounded border border-amber-400/30">
                    {(selectedSpot.relativeRadius || 0.12).toFixed(2)}m
                  </span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.45"
                  step="0.01"
                  value={selectedSpot.relativeRadius || 0.12}
                  onChange={(e) => onUpdateSpotRelativeRadius?.(selectedSpot.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between gap-1 text-[9px]">
                  <button
                    type="button"
                    onClick={() => onUpdateSpotRelativeRadius?.(selectedSpot.id, 0.04)}
                    className="flex-1 py-0.5 rounded bg-black/50 hover:bg-amber-400 hover:text-black text-amber-200 border border-amber-400/30 text-center cursor-pointer"
                  >
                    Fino (0.04m)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSpotRelativeRadius?.(selectedSpot.id, 0.12)}
                    className="flex-1 py-0.5 rounded bg-black/50 hover:bg-amber-400 hover:text-black text-amber-200 border border-amber-400/30 text-center cursor-pointer"
                  >
                    Padrão (0.12m)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSpotRelativeRadius?.(selectedSpot.id, 0.30)}
                    className="flex-1 py-0.5 rounded bg-black/50 hover:bg-amber-400 hover:text-black text-amber-200 border border-amber-400/30 text-center cursor-pointer"
                  >
                    Amplo (0.30m)
                  </button>
                </div>

                {/* Tag info & Snap */}
                <div className="pt-1 border-t border-amber-400/20 text-[10px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Tag Fixa:</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      #{selectedSpot.attachmentTag || 'sem-tag'}
                    </span>
                  </div>
                  {/* Matching connect targets */}
                  {(() => {
                    const match = spots.find(
                      (s) =>
                        s.id !== selectedSpot.id &&
                        ((selectedSpot.attachmentTag && s.connectsToTags?.includes(selectedSpot.attachmentTag)) ||
                         (s.attachmentTag && selectedSpot.connectsToTags?.includes(s.attachmentTag)))
                    );
                    if (!match) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => onConnectSpotsByTag?.(selectedSpot.id, match.id)}
                        className="w-full py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-200" />
                        <span>Grudar em #{match.attachmentTag || match.name}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Quick Actions Row */}
            <div className="flex items-center justify-between pt-1 border-t border-[#d4af37]/20 text-[10px]">
              {onRemoveOverlappingSpots && (
                <button
                  type="button"
                  onClick={onRemoveOverlappingSpots}
                  className="px-2 py-1 rounded bg-[#1a1b22] hover:bg-[#d4af37] hover:text-black text-[#d4af37] font-semibold border border-[#d4af37]/30 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3 text-amber-400" />
                  <span>Limpar sobrepostos</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveSpot(selectedSpot.id)}
                className="ml-auto px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white font-semibold border border-red-500/60 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
                <span>Excluir spot</span>
              </button>
            </div>
          </div>

          <div className="w-[1px] h-3 border-l border-dashed border-[#d4af37]/70 my-0.5" />
        </div>
      )}

      {/* FLOATING DIRECT INTERACTIVE SLIDER BAR HUD OVER SELECTED PLACED OBJECT */}
      {selectedObj && objectGizmoScreenPos && (
        <div
          style={{
            left: `${objectGizmoScreenPos.x}px`,
            top: `${objectGizmoScreenPos.y}px`,
          }}
          className="absolute transform -translate-x-1/2 -translate-y-full z-20 flex flex-col items-center pointer-events-auto animate-fade-in"
        >
          {/* Main Floating Controller Box */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121317]/95 border border-[#d4af37] rounded-xl p-2.5 shadow-[0_6px_30px_rgba(0,0,0,0.9)] backdrop-blur-md flex flex-col gap-2 min-w-[260px] text-[#e8d5b5]"
          >
            {/* Top mode indicator & Object name */}
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-1.5 text-xs">
              <span className="font-bold text-[#ffd700] truncate max-w-[130px]">
                {selectedObj.name}
              </span>
              <div className="flex items-center gap-1.5">
                {onSetCustomAvatarObjectId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (customAvatarObjectId === selectedObj.id) {
                        onSetCustomAvatarObjectId(null);
                      } else {
                        onSetCustomAvatarObjectId(selectedObj.id);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      customAvatarObjectId === selectedObj.id
                        ? 'bg-[#d4af37] text-black font-bold ring-1 ring-[#ffd700]'
                        : 'text-[#d4af37]/80 hover:text-white hover:bg-[#d4af37]/20 border border-[#d4af37]/40'
                    }`}
                    title={
                      customAvatarObjectId === selectedObj.id
                        ? 'Remover como avatar ativo'
                        : 'Definir este item como avatar do visitante'
                    }
                  >
                    <User className="w-3 h-3" />
                    <span>{customAvatarObjectId === selectedObj.id ? 'Avatar Ativo' : 'Tornar Avatar'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveObject(selectedObj.id)}
                  className="p-1 rounded text-red-400 hover:text-white hover:bg-red-900/80 transition-colors cursor-pointer"
                  title="Excluir objeto (Lixeira)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Live Spatial Height Indicator (Perto da seta Y do Gizmo) */}
            <div className="flex items-center justify-between bg-emerald-950/70 border border-emerald-500/50 rounded-lg px-2.5 py-1 text-[11px] font-mono text-emerald-300">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">↕️</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">Altura do Solo:</span>
                <span className="text-[#ffd700] font-black text-xs">+{selectedObj.position[1].toFixed(2)} m</span>
              </div>
              <span className="text-[10px] text-emerald-400/80">Solo = 0.00m</span>
            </div>

            {/* Object Type Selector: Movel | Objeto | Avatar */}
            {onUpdateObjectType && (
              <div className="flex items-center justify-between border-t border-[#d4af37]/20 pt-1.5 text-[10px]">
                <span className="text-[9px] uppercase font-bold text-[#d4af37]/70">Tipo:</span>
                <div className="flex items-center gap-1">
                  {(['cenario', 'movel', 'objeto', 'avatar'] as const).map((t) => {
                    const isActive =
                      (t === 'cenario' && selectedObj.type === 'cenario') ||
                      (t === 'avatar' && (selectedObj.type === 'avatar' || selectedObj.isAvatar)) ||
                      (t !== 'avatar' && t !== 'cenario' && selectedObj.type === t && !selectedObj.isAvatar);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          onUpdateObjectType(selectedObj.id, t);
                          if (t === 'avatar') {
                            onSetCustomAvatarObjectId?.(selectedObj.id);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                          isActive
                            ? t === 'cenario' || t === 'avatar'
                              ? 'bg-[#ffd700] text-black font-bold shadow-sm ring-1 ring-[#ffd700]'
                              : 'bg-[#d4af37] text-black font-bold'
                            : 'bg-black/40 text-[#e8d5b5]/70 hover:text-white border border-[#d4af37]/30'
                        }`}
                      >
                        {t === 'cenario' ? '🏛️ Sala' : t === 'avatar' ? '👤 Avatar' : t === 'movel' ? '🛋️ Móvel' : '📦 Item'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DYNAMIC INTERACTIVE SLIDER BAR: Drag to increase/decrease smoothly! */}
            {activeGizmoMode === 'escalar' && (() => {
              const objDims = rawDimensionsState[selectedObj.id] ||
                rawDimensionsMapRef.current.get(selectedObj.id) || {
                  width: 1.4,
                  height: selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.60,
                  depth: 1.2,
                  targetHeight: selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.60,
                  label: selectedObj.name,
                  isRoom: selectedObj.name.toLowerCase().includes('cenario') ||
                          selectedObj.name.toLowerCase().includes('dormitorio') ||
                          selectedObj.name.toLowerCase().includes('quarto') ||
                          selectedObj.name.toLowerCase().includes('sala') ||
                          selectedObj.name.toLowerCase().includes('room'),
                };

              const currentRealH = objDims.height * selectedObj.scale[0];
              const currentRealW = objDims.width * selectedObj.scale[0];
              const isRoom = objDims.isRoom;
              const isCeilingMatched = Math.abs(currentRealH - 2.80) <= 0.15;

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-[#d4af37]">Escala no Mundo:</span>
                    <span className="font-mono text-[#ffd700] text-xs font-bold bg-black/40 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                      {selectedObj.scale[0].toFixed(2)}x
                    </span>
                  </div>

                  {/* Visual Live Feedback during scaling */}
                  <div className="text-center">
                    {isRoom ? (
                      isCeilingMatched ? (
                        <div className="text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-500/60 px-2 py-1 rounded text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                          <span>✓ teto = {currentRealH.toFixed(2)} m</span>
                          <span className="text-[9px] text-emerald-300 font-normal">(Escala Real 2,80 m)</span>
                        </div>
                      ) : (
                        <div className="text-red-400 font-bold bg-red-950/80 border border-red-500/60 px-2 py-1 rounded text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                          <span>teto agora = {currentRealH.toFixed(2)} m</span>
                          <span className="text-[#ffd700]">→ teto = 2.8 m</span>
                        </div>
                      )
                    ) : (
                      <div className="text-[#ffd700] font-semibold bg-black/50 border border-[#d4af37]/40 px-2 py-1 rounded text-[11px] flex items-center justify-between">
                        <span>Altura Real: {currentRealH.toFixed(2)} m</span>
                        <span className="text-[10px] text-[#e8d5b5]/70">L: {currentRealW.toFixed(2)}m (Avatar: 1,70m)</span>
                      </div>
                    )}
                  </div>

                  {/* Range Slider for Scale (Limitless range) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStepObjScale(-0.05)}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.01"
                      max={Math.max(12, Math.ceil(selectedObj.scale[0] * 2))}
                      step="0.01"
                      value={selectedObj.scale[0]}
                      onChange={(e) => handleUpdateObjScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-[#ffd700]"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepObjScale(0.05)}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      +
                    </button>
                  </div>

                  {/* One-Click "Encaixar no Metro" & "Seletor de Tamanho" Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFitToMetric(objDims.targetHeight)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e6ca65] hover:from-[#e5c158] hover:to-[#ffd700] text-black font-extrabold text-[10px] flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
                      title={`Ajusta a escala para bater exatamente no metro real (${objDims.targetHeight.toFixed(2)}m)`}
                    >
                      <Ruler className="w-3 h-3" />
                      <span>Encaixar no Metro ({objDims.targetHeight.toFixed(2)}m)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSizeSelectorModalOpen(true)}
                      className="py-1.5 px-2.5 rounded-lg bg-[#1e2028] hover:bg-[#d4af37] text-[#ffd700] hover:text-black font-bold text-[10px] border border-[#d4af37]/50 flex items-center justify-center gap-1 shadow cursor-pointer transition-all whitespace-nowrap"
                      title="Abrir Seletor Completo com Todas as Categorias (Rooms, Mobília, Carros, Prédios, Estádios)"
                    >
                      <span>📐 Presets</span>
                    </button>
                  </div>

                  {/* Quick metric presets covering requested categories */}
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { label: '🏠 2.8m', h: 2.8, t: 'Teto / Sala 2,80m' },
                      { label: '🚗 1.5m', h: 1.5, t: 'Carro 1,50m' },
                      { label: '🏢 20m', h: 20.0, t: 'Prédio 20m' },
                      { label: '⚽ 25m', h: 25.0, t: 'Estádio futebol 25m' },
                      { label: '🏭 7.0m', h: 7.0, t: 'Armazém 7m' },
                      { label: '🛋️ 0.85m', h: 0.85, t: 'Sofá 0,85m' },
                      { label: '💡 0.45m', h: 0.45, t: 'Abajur 0,45m' },
                      { label: '👤 1.7m', h: 1.7, t: 'Avatar 1,70m' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handleFitToMetric(p.h)}
                        title={p.t}
                        className="py-0.5 px-1 rounded bg-[#181a20] hover:bg-[#d4af37] hover:text-black text-[9px] font-mono text-[#e8d5b5]/90 border border-[#d4af37]/20 truncate"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {activeGizmoMode === 'rodar' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-[#d4af37]">Barra de Rotação:</span>
                  <span className="font-mono text-[#ffd700] text-xs font-bold bg-black/40 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                    {Math.round(((THREE.MathUtils.radToDeg(selectedObj.rotation[1]) % 360) + 360) % 360)}°
                  </span>
                </div>

                {/* Range Slider for Rotation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepObjRotY(-15)}
                    className="px-1.5 py-0.5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700]"
                  >
                    -15°
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={Math.round(((THREE.MathUtils.radToDeg(selectedObj.rotation[1]) % 360) + 360) % 360)}
                    onChange={(e) => handleUpdateObjRotY(parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-[#ffd700]"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepObjRotY(15)}
                    className="px-1.5 py-0.5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700]"
                  >
                    +15°
                  </button>
                </div>

                {/* Quick angle pills */}
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {[0, 45, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => handleUpdateObjRotY(deg)}
                      className="py-0.5 rounded bg-[#181a20] hover:bg-[#d4af37] hover:text-black text-[9px] font-mono text-[#e8d5b5]/80"
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeGizmoMode === 'elevar' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-[#d4af37]">Barra de Altura (Y):</span>
                  <span className="font-mono text-[#ffd700] text-xs font-bold bg-black/40 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                    {selectedObj.position[1].toFixed(2)}m
                  </span>
                </div>

                {/* Range Slider for Elevation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepObjPos(1, -0.05)}
                    className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="2.5"
                    step="0.02"
                    value={selectedObj.position[1]}
                    onChange={(e) => handleUpdateObjPos(1, parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#20222a] rounded-lg appearance-none cursor-pointer accent-[#ffd700]"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepObjPos(1, 0.05)}
                    className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {activeGizmoMode === 'mover' && (
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px] text-[#ffd700]">
                  <span>Mover no Chão:</span>
                  <span className="font-mono text-[10px] text-[#e8d5b5]/80">
                    X: {selectedObj.position[0].toFixed(2)}m · Z: {selectedObj.position[2].toFixed(2)}m
                  </span>
                </div>
                <p className="text-[10px] text-[#e8d5b5]/60 leading-tight">
                  Arraste diretamente o objeto na cena ou use as setas 3D vermelha e azul!
                </p>
              </div>
            )}

            {/* Inserir Spot no Objeto action button */}
            {onAddSpotAtObject && (
              <button
                type="button"
                onClick={() => onAddSpotAtObject(selectedObj.id)}
                className="w-full py-2 px-2.5 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#ffd700] to-[#e2bd44] hover:brightness-110 text-black text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                title={`Cria automaticamente um spot exatamente nas coordenadas de "${selectedObj.name}". Mesmo se você remover o objeto depois, o spot continuará lá!`}
              >
                <MapPin className="w-3.5 h-3.5 fill-black" />
                <span>📍 Inserir Spot no Objeto</span>
              </button>
            )}
          </div>

          <div className="w-[1px] h-3 border-l border-dashed border-[#d4af37]/70 my-0.5" />
        </div>
      )}

      {/* FLOATING HUD IN AVATAR MODE: Shows active controlled avatar */}
      {selectedObj && objectGizmoScreenPos && isAvatarMode && (
        <div
          style={{
            left: `${objectGizmoScreenPos.x}px`,
            top: `${objectGizmoScreenPos.y}px`,
          }}
          className="absolute transform -translate-x-1/2 -translate-y-full z-20 flex flex-col items-center pointer-events-auto animate-fade-in"
        >
          <div className="bg-[#121317]/95 border-2 border-[#ffd700] rounded-xl px-3.5 py-1.5 shadow-[0_0_20px_rgba(255,215,0,0.45)] backdrop-blur-md flex items-center gap-2.5 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd700] animate-ping" />
            <span className="text-xs font-bold text-[#ffd700]">
              {customAvatarObjectId === selectedObj.id
                ? `⭐ Controlando: ${selectedObj.name}`
                : `Item: ${selectedObj.name}`}
            </span>
            {customAvatarObjectId !== selectedObj.id && (
              <button
                type="button"
                onClick={() => onSetCustomAvatarObjectId?.(selectedObj.id)}
                className="px-2 py-0.5 rounded bg-[#ffd700] text-black text-[10px] font-extrabold uppercase cursor-pointer hover:bg-amber-300 transition-colors"
              >
                Controlar
              </button>
            )}
            <span className="text-[10px] text-[#e8d5b5]/80 hidden sm:inline">
              · Clique nos spots para mover
            </span>
          </div>
          <div className="w-[1px] h-3 border-l border-dashed border-[#ffd700] my-0.5" />
        </div>
      )}

      {/* Floating Insertion Marker Banner */}
      {insertionCursorPoint && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-[#121317]/95 border border-[#d4af37] rounded-lg px-4 py-2 shadow-[0_4px_25px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center gap-3 text-xs text-[#e8d5b5]">
          <span className="text-[#d4af37] font-semibold">
            Ponto marcado em [{insertionCursorPoint[0]}, {insertionCursorPoint[2]}].
          </span>
          <span className="text-[#e8d5b5]/80">
            Clique em um item do inventário à esquerda para nascer aqui!
          </span>
          <button
            type="button"
            onClick={() => onSceneClickInsertionPoint(null)}
            className="p-0.5 rounded text-[#d4af37]/60 hover:text-[#d4af37] cursor-pointer"
            title="Cancelar ponto de inserção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* DOCKED PRECISION NUMERIC INSPECTOR */}
      {(selectedObj || selectedSpot) && !isAvatarMode && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-2xl bg-[#121317]/95 border border-[#d4af37]/70 rounded-xl p-3 shadow-[0_10px_35px_rgba(0,0,0,0.9)] backdrop-blur-md text-[#e8d5b5] animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#d4af37]/25">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#d4af37]/15 border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37]">
                {selectedObj ? <Box className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#ffd700]">
                    {selectedObj ? selectedObj.name : selectedSpot?.name}
                  </span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded border border-[#d4af37]/40 text-[#d4af37]">
                    {selectedObj ? 'Móvel / Objeto' : `Spot ${selectedSpot?.type}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedObj && onAddSpotAtObject && (
                <button
                  type="button"
                  onClick={() => onAddSpotAtObject(selectedObj.id)}
                  className="px-2.5 py-1 rounded bg-gradient-to-r from-[#d4af37] via-[#ffd700] to-[#e2bd44] hover:brightness-110 text-black text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                  title={`Cria um spot automático exatamente nas coordenadas e rotação de "${selectedObj.name}". O spot permanecerá fixo mesmo se o objeto for removido!`}
                >
                  <MapPin className="w-3.5 h-3.5 fill-black" />
                  <span>+ Inserir Spot no Objeto</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (selectedObj) {
                    onRemoveObject(selectedObj.id);
                  } else if (selectedSpot) {
                    onRemoveSpot(selectedSpot.id);
                  }
                }}
                className="px-2.5 py-1 rounded bg-red-950/70 border border-red-500/70 text-red-300 hover:text-white hover:bg-red-800 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Excluir da sala"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Excluir</span>
              </button>

              <button
                type="button"
                onClick={() => setIsInspectorMinimized(!isInspectorMinimized)}
                className="p-1 text-[#d4af37]/70 hover:text-[#d4af37] cursor-pointer"
                title={isInspectorMinimized ? 'Expandir painel' : 'Minimizar painel'}
              >
                {isInspectorMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectObject(null);
                  onSelectSpot(null);
                }}
                className="p-1 text-[#d4af37]/70 hover:text-[#d4af37] cursor-pointer ml-1"
                title="Fechar seleção"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: Direct Numeric Inputs & Steppers */}
          {!isInspectorMinimized && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              {/* Column 1: Posição X, Y, Z */}
              <div className="p-2 rounded-lg bg-black/40 border border-[#d4af37]/20 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-[#d4af37] tracking-wider block">
                  Posição (Metros)
                </span>

                {/* X */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-[#e8d5b5]/70 w-3">X</span>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjPos(0, -0.05) : handleStepSpotPos(0, -0.05))}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      -
                    </button>
                    <NumericInput
                      step={0.05}
                      precision={2}
                      value={selectedObj ? selectedObj.position[0] : selectedSpot?.position[0] ?? 0}
                      onChange={(val) =>
                        selectedObj
                          ? handleUpdateObjPos(0, val)
                          : handleUpdateSpotPos(0, val)
                      }
                      className="w-full bg-[#14151a] border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-[#ffd700] outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjPos(0, 0.05) : handleStepSpotPos(0, 0.05))}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Y (Elevação) */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-[#e8d5b5]/70 w-3">Y</span>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjPos(1, -0.05) : handleStepSpotPos(1, -0.05))}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      -
                    </button>
                    <NumericInput
                      step={0.05}
                      min={0}
                      max={5}
                      precision={2}
                      value={selectedObj ? selectedObj.position[1] : selectedSpot?.position[1] ?? 0}
                      onChange={(val) =>
                        selectedObj
                          ? handleUpdateObjPos(1, val)
                          : handleUpdateSpotPos(1, val)
                      }
                      className="w-full bg-[#14151a] border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-[#ffd700] outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjPos(1, 0.05) : handleStepSpotPos(1, 0.05))}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Z */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-[#e8d5b5]/70 w-3">Z</span>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjPos(2, -0.05) : handleStepSpotPos(2, -0.05))}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      -
                    </button>
                    <NumericInput
                      step={0.05}
                      precision={2}
                      value={selectedObj ? selectedObj.position[2] : selectedSpot?.position[2] ?? 0}
                      onChange={(val) =>
                        selectedObj
                          ? handleUpdateObjPos(2, val)
                          : handleUpdateSpotPos(2, val)
                      }
                      className="w-full bg-[#14151a] border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-[#ffd700] outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjPos(2, 0.05) : handleStepSpotPos(2, 0.05))}
                      className="w-5 h-5 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black flex items-center justify-center text-xs text-[#ffd700]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Column 2: Rotação Y (Graus °) */}
              <div className="p-2 rounded-lg bg-black/40 border border-[#d4af37]/20 space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#d4af37] tracking-wider block">
                    Rotação (Graus °)
                  </span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjRotY(-15) : handleStepSpotRot(-15))}
                      className="px-2 py-1 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700]"
                    >
                      -15°
                    </button>
                    <NumericInput
                      step={5}
                      min={0}
                      max={360}
                      precision={0}
                      value={
                        selectedObj
                          ? Math.round(((THREE.MathUtils.radToDeg(selectedObj.rotation[1]) % 360) + 360) % 360)
                          : selectedSpot?.rotation || 0
                      }
                      onChange={(deg) =>
                        selectedObj
                          ? handleUpdateObjRotY(deg)
                          : handleUpdateSpotRot(deg)
                      }
                      className="w-full bg-[#14151a] border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-[#ffd700] outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => (selectedObj ? handleStepObjRotY(15) : handleStepSpotRot(15))}
                      className="px-2 py-1 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700]"
                    >
                      +15°
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => (selectedObj ? handleUpdateObjRotY(deg) : handleUpdateSpotRot(deg))}
                      className="py-0.5 rounded bg-[#16181f] hover:bg-[#d4af37] hover:text-black text-[9px] font-mono text-[#e8d5b5]/80"
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 3: Escala no Mundo Real (Metros & Encaixar no Metro) */}
              <div className="p-2 rounded-lg bg-black/40 border border-[#d4af37]/20 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#d4af37] tracking-wider block">
                      Escala (Multiplicador)
                    </span>
                    {selectedObj && (() => {
                      const dims = rawDimensionsState[selectedObj.id] ||
                        rawDimensionsMapRef.current.get(selectedObj.id) || {
                          width: 1.4,
                          height: selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.6,
                          depth: 1.2,
                          targetHeight: selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.6,
                          label: selectedObj.name,
                          isRoom: false,
                        };
                      const curH = dims.height * selectedObj.scale[0];
                      return (
                        <span className="text-[10px] font-mono font-bold text-[#ffd700]">
                          Alt: {curH.toFixed(2)}m
                        </span>
                      );
                    })()}
                  </div>

                  {selectedObj ? (
                    <div className="flex items-center gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() => handleStepObjScale(-0.1)}
                        className="px-2 py-1 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700]"
                      >
                        -0.1
                      </button>
                      <NumericInput
                        step={0.05}
                        min={0.01}
                        max={100}
                        precision={2}
                        value={selectedObj.scale[0]}
                        onChange={(val) => handleUpdateObjScale(val)}
                        className="w-full bg-[#14151a] border border-[#d4af37]/40 rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-[#ffd700] outline-none focus:border-[#d4af37]"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepObjScale(0.1)}
                        className="px-2 py-1 rounded bg-[#1e2026] hover:bg-[#d4af37] hover:text-black text-[10px] font-semibold text-[#ffd700]"
                      >
                        +0.1
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#e8d5b5]/50 mt-2">
                      Spot de teletransporte não possui escala variável.
                    </p>
                  )}
                </div>

                {selectedObj && (() => {
                  const dims = rawDimensionsState[selectedObj.id] ||
                    rawDimensionsMapRef.current.get(selectedObj.id) || {
                      width: 1.4,
                      height: selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.6,
                      depth: 1.2,
                      targetHeight: selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.6,
                      label: selectedObj.name,
                      isRoom: selectedObj.name.toLowerCase().includes('cenario') ||
                              selectedObj.name.toLowerCase().includes('dormitorio') ||
                              selectedObj.name.toLowerCase().includes('quarto') ||
                              selectedObj.name.toLowerCase().includes('sala'),
                    };
                  const curH = dims.height * selectedObj.scale[0];
                  const curW = dims.width * selectedObj.scale[0];
                  const curD = dims.depth * selectedObj.scale[0];
                  const isCeilingOk = Math.abs(curH - 2.80) <= 0.15;

                  return (
                    <div className="space-y-1.5 pt-1">
                      {/* Metric Dimensions Real-World Readout */}
                      <div className="p-1 rounded bg-[#14151a] border border-[#d4af37]/30 text-[9px] font-mono flex items-center justify-between text-[#e8d5b5]">
                        <span className="text-[#ffd700] font-semibold">Real:</span>
                        <span>{curW.toFixed(2)}m (L) × {curH.toFixed(2)}m (A) × {curD.toFixed(2)}m (P)</span>
                      </div>

                      {/* Status feedback */}
                      {dims.isRoom ? (
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold text-center ${
                            isCeilingOk
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                              : 'bg-red-950/80 text-red-300 border border-red-500/50'
                          }`}
                        >
                          {isCeilingOk ? `✓ Teto Room = ${curH.toFixed(2)}m (2,80m)` : `Teto agora = ${curH.toFixed(2)}m → ideal 2,80m`}
                        </div>
                      ) : (
                        <div className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-center bg-[#181a20] text-[#e8d5b5]/80 border border-[#d4af37]/20">
                          Comparado com Avatar: 1,70 m
                        </div>
                      )}

                      {/* "Encaixar no Metro" & "Seletor de Tamanho" Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleFitToMetric(dims.targetHeight)}
                          className="flex-1 py-1 px-2 rounded bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black font-bold text-[10px] flex items-center justify-center gap-1 hover:brightness-110 cursor-pointer shadow"
                        >
                          <Ruler className="w-3 h-3" />
                          <span>Encaixar ({dims.targetHeight.toFixed(2)}m)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsSizeSelectorModalOpen(true)}
                          className="py-1 px-2 rounded bg-[#1c1e26] hover:bg-[#d4af37] text-[#ffd700] hover:text-black font-bold text-[10px] border border-[#d4af37]/40 flex items-center justify-center gap-1 shadow cursor-pointer transition-all whitespace-nowrap"
                          title="Abrir Seletor Completo com Todas as Categorias"
                        >
                          <span>📐 Seletor Completo</span>
                        </button>
                      </div>

                      {/* Expanded Target presets (Rooms, Veículos, Macro, Mobília, Avatar) */}
                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {[
                          { l: 'Teto 2.8', h: 2.8, t: 'Teto / Sala 2,80m' },
                          { l: 'Mansão 5m', h: 5.0, t: 'Mansão / Hall 5,00m' },
                          { l: 'Carro 1.5', h: 1.5, t: 'Carro 1,50m' },
                          { l: 'Prédio 20', h: 20.0, t: 'Prédio 20,00m' },
                          { l: 'Armazém 7', h: 7.0, t: 'Armazém 7,00m' },
                          { l: 'Estádio 25', h: 25.0, t: 'Estádio futebol 25m' },
                          { l: 'Sofá 0.85', h: 0.85, t: 'Sofá 0,85m' },
                          { l: 'Avatar 1.7', h: 1.7, t: 'Avatar adulto 1,70m' },
                        ].map((btn) => (
                          <button
                            key={btn.l}
                            type="button"
                            onClick={() => handleFitToMetric(btn.h)}
                            title={btn.t}
                            className="py-0.5 px-1 rounded bg-[#16181f] hover:bg-[#d4af37] hover:text-black text-[9px] font-mono text-[#e8d5b5]/90 border border-[#d4af37]/20 truncate"
                          >
                            {btn.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Zoom & Reset Controls with expanded zoom range */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => handleZoom(0.65)}
          className="w-8 h-8 rounded-lg bg-[#141519]/90 border border-[#d4af37]/50 hover:border-[#d4af37] text-[#ffd700] hover:bg-[#d4af37]/25 flex items-center justify-center cursor-pointer shadow-md transition-all active:scale-95"
          title="Aproximar Zoom (Super Detalhes - Sem Limites)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => handleZoom(1.50)}
          className="w-8 h-8 rounded-lg bg-[#141519]/90 border border-[#d4af37]/50 hover:border-[#d4af37] text-[#ffd700] hover:bg-[#d4af37]/25 flex items-center justify-center cursor-pointer shadow-md transition-all active:scale-95"
          title="Afastar Zoom (Visão Geral Ampla)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleResetCamera}
          className="w-8 h-8 rounded-lg bg-[#141519]/90 border border-[#d4af37]/50 hover:border-[#d4af37] text-[#d4af37] hover:text-[#ffd700] hover:bg-[#d4af37]/25 flex items-center justify-center cursor-pointer shadow-md transition-all active:scale-95"
          title="Resetar Visão da Câmera (Centro do Cenário)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Metric Size Selector Modal (Interactive 1:1 Size & Category Preset Chooser) */}
      {isSizeSelectorModalOpen && (
        <MetricSizeSelectorModal
          isOpen={isSizeSelectorModalOpen}
          onClose={() => setIsSizeSelectorModalOpen(false)}
          targetName={
            selectedObj
              ? selectedObj.name
              : sceneAssetBlobUrl
              ? 'Cenário da Sala (Room)'
              : 'Sala / Limite Jogável'
          }
          rawHeight={
            selectedObj
              ? (rawDimensionsState[selectedObj.id]?.height ||
                 rawDimensionsMapRef.current.get(selectedObj.id)?.height ||
                 (selectedObj.name.toLowerCase().includes('sofa') ? 0.85 : 0.60))
              : (rawDimensionsState['__scene_room__']?.height || boundary.y || 2.80)
          }
          rawWidth={
            selectedObj
              ? (rawDimensionsState[selectedObj.id]?.width ||
                 rawDimensionsMapRef.current.get(selectedObj.id)?.width || 1.0)
              : (rawDimensionsState['__scene_room__']?.width || boundary.x || 6.0)
          }
          rawDepth={
            selectedObj
              ? (rawDimensionsState[selectedObj.id]?.depth ||
                 rawDimensionsMapRef.current.get(selectedObj.id)?.depth || 1.0)
              : (rawDimensionsState['__scene_room__']?.depth || boundary.z || 8.0)
          }
          currentScale={selectedObj ? selectedObj.scale[0] : 1.0}
          onApplyScale={handleApplyScaleFromModal}
          onApplyBoundary={handleApplyBoundaryFromModal}
          currentBoundary={boundary}
        />
      )}
    </div>
  );
};

// Procedural 3D Modern Bed Model
function create3DBedMesh(): THREE.Group {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x22242b,
    roughness: 0.8,
    metalness: 0.1,
  });

  const mattressMat = new THREE.MeshStandardMaterial({
    color: 0xe8e6e2,
    roughness: 0.95,
  });

  const duvetMat = new THREE.MeshStandardMaterial({
    color: 0x363842,
    roughness: 0.9,
  });

  const pillowMat = new THREE.MeshStandardMaterial({
    color: 0xf5f3ee,
    roughness: 0.85,
  });

  // Base platform
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 1.7), woodMat);
  base.position.set(0, 0.14, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Headboard
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 1.7), woodMat);
  headboard.position.set(-1.0, 0.55, 0);
  headboard.castShadow = true;
  group.add(headboard);

  // Mattress
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.24, 1.55), mattressMat);
  mattress.position.set(0.04, 0.38, 0);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  group.add(mattress);

  // Duvet folded
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.56), duvetMat);
  duvet.position.set(0.32, 0.47, 0);
  duvet.castShadow = true;
  duvet.receiveShadow = true;
  group.add(duvet);

  // Pillows
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.55), pillowMat);
  p1.position.set(-0.65, 0.54, -0.38);
  p1.rotation.z = 0.12;
  p1.castShadow = true;
  group.add(p1);

  const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.55), pillowMat);
  p2.position.set(-0.65, 0.54, 0.38);
  p2.rotation.z = 0.12;
  p2.castShadow = true;
  group.add(p2);

  return group;
}

// Procedural Scarlet Salon Architecture
function createScarletSalonArchitecture(): THREE.Group {
  const group = new THREE.Group();

  const scarletMat = new THREE.MeshStandardMaterial({
    color: 0x3d0f17,
    roughness: 0.85,
    metalness: 0.15,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.35,
    metalness: 0.75,
  });

  // Back Wall in rich scarlet
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), scarletMat);
  backWall.position.set(0, 6, -6.48);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Side walls
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), scarletMat);
  leftWall.position.set(-9.98, 6, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), scarletMat);
  rightWall.position.set(9.98, 6, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  // Classical architectural molding frames on back wall
  for (let i = -3; i <= 3; i++) {
    const molding = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.6, 0.04), goldMat);
    molding.position.set(i * 2.8, 5.0, -6.44);
    molding.castShadow = true;
    group.add(molding);
  }

  // Classical Columns
  for (const x of [-6.5, 6.5]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 11.5, 24), goldMat);
    column.position.set(x, 5.75, -6.2);
    column.castShadow = true;
    group.add(column);
  }

  return group;
}

// Procedural Concrete Loft Architecture
function createLoftArchitecture(): THREE.Group {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x27292e,
    roughness: 0.95,
    metalness: 0.1,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x121316,
    roughness: 0.5,
    metalness: 0.6,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x3d4b60,
    roughness: 0.1,
    metalness: 0.4,
  });

  // Back Wall with huge industrial grid window
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), concreteMat);
  backWall.position.set(0, 6, -6.48);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Industrial Window
  const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 6.5), glassMat);
  windowGlass.position.set(0, 6.0, -6.44);
  group.add(windowGlass);

  // Black Iron Window Grid
  for (let i = -3; i <= 3; i++) {
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.5, 0.08), steelMat);
    vBar.position.set(i * 1.5, 6.0, -6.42);
    group.add(vBar);
  }
  for (let j = -2; j <= 2; j++) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.06, 0.08), steelMat);
    hBar.position.set(0, 6.0 + j * 1.2, -6.42);
    group.add(hBar);
  }

  // Steel Pillars
  for (const x of [-7.5, 7.5]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 11.5, 0.45), steelMat);
    pillar.position.set(x, 5.75, -6.2);
    pillar.castShadow = true;
    group.add(pillar);
  }

  return group;
}

// Builder for Sectional L-Sofa with Chaise Longue
function createSectionalLSofa(): THREE.Group {
  const group = new THREE.Group();

  const fabricMat = new THREE.MeshStandardMaterial({
    color: 0x3e4046,
    roughness: 0.9,
    metalness: 0.05,
  });

  const darkBaseMat = new THREE.MeshStandardMaterial({
    color: 0x1f2125,
    roughness: 0.95,
  });

  const legMat = new THREE.MeshStandardMaterial({
    color: 0x0f1013,
    roughness: 0.4,
  });

  // Base
  const mainBase = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 0.95), darkBaseMat);
  mainBase.position.set(0.65, 0.16, 0);
  mainBase.castShadow = true;
  group.add(mainBase);

  const chaiseBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 1.7), darkBaseMat);
  chaiseBase.position.set(-0.95, 0.16, 0.38);
  chaiseBase.castShadow = true;
  group.add(chaiseBase);

  // Cushions
  for (let i = 0; i < 2; i++) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.88), fabricMat);
    cushion.position.set(0.3 + i * 0.9, 0.35, 0.02);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    group.add(cushion);
  }

  const chaiseCushion = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.2, 1.62), fabricMat);
  chaiseCushion.position.set(-0.95, 0.35, 0.38);
  chaiseCushion.castShadow = true;
  chaiseCushion.receiveShadow = true;
  group.add(chaiseCushion);

  // Backrest
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.55, 0.22), fabricMat);
  backrest.position.set(0.2, 0.62, -0.42);
  backrest.castShadow = true;
  group.add(backrest);

  // Back pillows
  for (let i = -1; i <= 2; i++) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.14), fabricMat);
    pillow.position.set(-0.7 + i * 0.76, 0.65, -0.28);
    pillow.rotation.x = -0.06;
    pillow.castShadow = true;
    group.add(pillow);
  }

  // Accent throw pillows
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.95 });
  const throwPillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.12), accentMat);
  throwPillow1.position.set(-1.25, 0.52, 0.2);
  throwPillow1.rotation.set(0.1, 0.4, 0.2);
  group.add(throwPillow1);

  const throwPillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.1), accentMat);
  throwPillow2.position.set(1.45, 0.52, -0.15);
  throwPillow2.rotation.set(0.1, -0.3, -0.1);
  group.add(throwPillow2);

  // Armrest
  const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.98), fabricMat);
  armrest.position.set(1.75, 0.44, 0.02);
  armrest.castShadow = true;
  group.add(armrest);

  // Legs
  const legPositions = [
    [-1.35, 0.04, 1.15],
    [-0.55, 0.04, 1.15],
    [-1.35, 0.04, -0.4],
    [1.7, 0.04, 0.4],
    [1.7, 0.04, -0.4],
    [0.2, 0.04, -0.4],
  ];

  legPositions.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), legMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  });

  return group;
}

// Procedural decorative object mesh
function createDecorativeMesh(name: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2b2d34,
    roughness: 0.7,
    metalness: 0.2,
  });

  if (name.toLowerCase().includes('cama') || name.toLowerCase().includes('bed')) {
    const bed = create3DBedMesh();
    g.add(bed);
  } else if (name.toLowerCase().includes('mesa')) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32), mat);
    top.position.y = 0.45;
    top.castShadow = true;
    g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.45, 16), mat);
    leg.position.y = 0.225;
    leg.castShadow = true;
    g.add(leg);
  } else if (name.toLowerCase().includes('estátua') || name.toLowerCase().includes('dourad')) {
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), mat);
    pedestal.position.y = 0.25;
    pedestal.castShadow = true;
    g.add(pedestal);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.8,
    });
    const statue = new THREE.Mesh(new THREE.TorusKnotGeometry(0.14, 0.04, 64, 16), goldMat);
    statue.position.y = 0.65;
    statue.castShadow = true;
    g.add(statue);
  } else {
    // Default elegant cube / coffee block
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), mat);
    box.position.y = 0.225;
    box.castShadow = true;
    g.add(box);
  }

  return g;
}

// Floor tiles texture
function createFloorTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#222328';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(40,42,48,0.2)' : 'rgba(24,25,29,0.2)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = '#141518';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);

  return new THREE.CanvasTexture(canvas);
}

// Wall texture
function createWallTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c1d22';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#141519';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

// Helper to create sharp canvas text sprites for 3D metrics
function createMetricTextSprite(text: string, bgColor = '#121317', textColor = '#ffd700'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Background pill
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, 248, 56, 12);
  } else {
    ctx.rect(4, 4, 248, 56);
  }
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.65, 0.16, 1);
  return sprite;
}

function updateMetricTextSprite(sprite: THREE.Sprite, text: string, bgColor = '#121317', textColor = '#ffd700'): void {
  if (!sprite || !sprite.material) return;
  const mat = sprite.material as THREE.SpriteMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, 376, 56, 12);
  } else {
    ctx.rect(4, 4, 376, 56);
  }
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 192, 32);

  if (mat.map) mat.map.dispose();
  const texture = new THREE.CanvasTexture(canvas);
  mat.map = texture;
  mat.needsUpdate = true;
  sprite.scale.set(0.95, 0.16, 1);
}

function updateSpatialIndicatorGroup(grp: THREE.Group, x: number, y: number, z: number): void {
  if (!grp) return;
  grp.visible = true;
  grp.position.set(0, 0, 0);

  // 0: Vertical Y Line (from (x, 0, z) to (x, y, z))
  const yLine = grp.children[0] as THREE.Line;
  if (yLine) {
    const yClamped = Math.max(0.001, y);
    yLine.position.set(x, 0, z);
    yLine.scale.set(1, yClamped, 1);
    yLine.computeLineDistances();
  }

  // 1: Floor Ring (at (x, 0.005, z))
  const ring = grp.children[1] as THREE.Mesh;
  if (ring) {
    ring.position.set(x, 0.005, z);
  }

  // 2: Crosshair (at (x, 0.006, z))
  const cross = grp.children[2] as THREE.LineSegments;
  if (cross) {
    cross.position.set(x, 0.006, z);
  }

  // 3: Floating Metric Badge Sprite
  const sprite = grp.children[3] as THREE.Sprite;
  if (sprite) {
    const label = `Pos: X:${x.toFixed(2)}m | Y:${y.toFixed(2)}m | Z:${z.toFixed(2)}m`;
    updateMetricTextSprite(sprite, label, '#0f172a', '#4ade80');
    sprite.position.set(x, Math.max(0.35, y + 0.35), z);
  }

  // 4: Axis X Guideline (Red line along floor X axis from (0, 0.005, z) to (x, 0.005, z))
  const xLine = grp.children[4] as THREE.Line;
  if (xLine) {
    xLine.position.set(0, 0.005, z);
    xLine.scale.set(Math.abs(x) < 0.001 ? 0.001 : x, 1, 1);
    xLine.computeLineDistances();
  }

  // 5: Axis Z Guideline (Blue line along floor Z axis from (x, 0.005, 0) to (x, 0.005, z))
  const zLine = grp.children[5] as THREE.Line;
  if (zLine) {
    zLine.position.set(x, 0.005, 0);
    zLine.scale.set(1, 1, Math.abs(z) < 0.001 ? 0.001 : z);
    zLine.computeLineDistances();
  }
}

// 1. Metric Grid (1m x 1m cells) and Marked Coordinate Axes with 1m increments
function createMetricGridAndAxes(): { group: THREE.Group; labelsGroup: THREE.Group } {
  const group = new THREE.Group();
  const labelsGroup = new THREE.Group();
  labelsGroup.name = 'floorMeterLabelsGroup';

  // 1m x 1m Grid
  const gridHelper = new THREE.GridHelper(30, 30, 0xd4af37, 0x2e323b);
  gridHelper.position.y = 0.002; // Floor is strictly at Y = 0
  group.add(gridHelper);

  // Marked X-axis (Red, with tick markers every 1 meter)
  const xLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-14, 0.004, 0),
    new THREE.Vector3(14, 0.004, 0),
  ]);
  const xLineMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 });
  const xLine = new THREE.Line(xLineGeo, xLineMat);
  group.add(xLine);

  // Marked Z-axis (Blue, with tick markers every 1 meter)
  const zLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.004, -14),
    new THREE.Vector3(0, 0.004, 14),
  ]);
  const zLineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
  const zLine = new THREE.Line(zLineGeo, zLineMat);
  group.add(zLine);

  // Tick marks and numeric labels at every 1m along X and Z
  const tickMat = new THREE.LineBasicMaterial({ color: 0xd4af37 });
  for (let m = -8; m <= 8; m++) {
    if (m === 0) continue;

    // Tick across X
    const xTickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(m, 0.005, -0.12),
      new THREE.Vector3(m, 0.005, 0.12),
    ]);
    group.add(new THREE.Line(xTickGeo, tickMat));

    // Tick across Z
    const zTickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.12, 0.005, m),
      new THREE.Vector3(0.12, 0.005, m),
    ]);
    group.add(new THREE.Line(zTickGeo, tickMat));

    // Numeric badge every 2 meters for readability (put in labelsGroup so user can hide)
    if (Math.abs(m) % 2 === 0) {
      const xBadge = createMetricTextSprite(`${m}m`, 'rgba(18,19,23,0.85)', '#ffd700');
      xBadge.position.set(m, 0.06, 0.28);
      labelsGroup.add(xBadge);

      const zBadge = createMetricTextSprite(`${m}m`, 'rgba(18,19,23,0.85)', '#93c5fd');
      zBadge.position.set(0.28, 0.06, m);
      labelsGroup.add(zBadge);
    }
  }

  // Origin indicator (0, 0)
  const originBadge = createMetricTextSprite('0,0 (Chão Y=0)', '#101115', '#4ade80');
  originBadge.position.set(0, 0.1, 0);
  labelsGroup.add(originBadge);

  group.add(labelsGroup);

  return { group, labelsGroup };
}

// 2. Room Limit Box: 6m x 8m x 2.8m (Height 2.8m, Ground at Y = 0)
function createRoomBoundaryBox(boundary: PlayableBoundary): THREE.Group {
  const group = new THREE.Group();
  const bx = boundary.x || 6.0;
  const by = boundary.y || 2.8; // Ceiling 2.80m
  const bz = boundary.z || 8.0;

  // Position offset (user can move boundary box anywhere in 3D scene)
  const px = boundary.position?.[0] || 0;
  const py = boundary.position?.[1] || 0;
  const pz = boundary.position?.[2] || 0;
  group.position.set(px, py, pz);

  const halfX = bx / 2;
  const halfZ = bz / 2;

  const frameMat = new THREE.LineBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0.75,
  });

  // Ground perimeter loop (Y = 0.005)
  const floorLoopGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfX, 0.005, -halfZ),
    new THREE.Vector3(halfX, 0.005, -halfZ),
    new THREE.Vector3(halfX, 0.005, halfZ),
    new THREE.Vector3(-halfX, 0.005, halfZ),
    new THREE.Vector3(-halfX, 0.005, -halfZ),
  ]);
  group.add(new THREE.Line(floorLoopGeo, frameMat));

  // Ceiling perimeter loop (Y = by = 2.80m)
  const ceilLoopGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfX, by, -halfZ),
    new THREE.Vector3(halfX, by, -halfZ),
    new THREE.Vector3(halfX, by, halfZ),
    new THREE.Vector3(-halfX, by, halfZ),
    new THREE.Vector3(-halfX, by, -halfZ),
  ]);
  group.add(new THREE.Line(ceilLoopGeo, frameMat));

  // 4 Corner Vertical Pillars (Y: 0 -> by)
  const corners = [
    [-halfX, -halfZ],
    [halfX, -halfZ],
    [halfX, halfZ],
    [-halfX, halfZ],
  ];

  corners.forEach(([cx, cz]) => {
    const colGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx, 0, cz),
      new THREE.Vector3(cx, by, cz),
    ]);
    group.add(new THREE.Line(colGeo, frameMat));

    // Corner ceiling cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xd4af37 })
    );
    cap.position.set(cx, by, cz);
    group.add(cap);
  });

  // Ceiling Height Label
  const ceilBadge = createMetricTextSprite(
    `Limite Room: ${bx.toFixed(1)}×${bz.toFixed(1)}×${by.toFixed(2)}m`,
    '#121317',
    '#ffd700'
  );
  ceilBadge.position.set(0, by + 0.12, -halfZ);
  group.add(ceilBadge);

  return group;
}

// 2b. Spatial Vertical Grid (Grades no espaço na vertical - paredes de fundo e lateral ou ponto fixado)
function createSpatialVerticalGrid(
  boundary: PlayableBoundary,
  originPoint?: [number, number, number] | null
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'spatialVerticalGrid';

  if (originPoint) {
    group.position.set(originPoint[0], originPoint[1], originPoint[2]);
  } else {
    const px = boundary.position?.[0] || 0;
    const py = boundary.position?.[1] || 0;
    const pz = boundary.position?.[2] || 0;
    group.position.set(px, py, pz);
  }

  const bx = boundary.x || 6.0;
  const by = boundary.y || 2.8;
  const bz = boundary.z || 8.0;
  const halfX = bx / 2;
  const halfZ = bz / 2;

  const subtleGridMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.22,
  });

  const meterGridMat = new THREE.LineBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0.55,
  });

  // 1. Back Wall Vertical Grid (at Z = -halfZ)
  for (let y = 0.5; y <= by + 0.05; y += 0.5) {
    const isMeter = Math.abs(Math.round(y) - y) < 0.05;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfX, y, -halfZ),
      new THREE.Vector3(halfX, y, -halfZ),
    ]);
    group.add(new THREE.Line(geo, isMeter ? meterGridMat : subtleGridMat));

    if (isMeter && y <= by) {
      const sprite = createMetricTextSprite(`+${y.toFixed(1)}m`, 'rgba(15,23,42,0.85)', '#38bdf8');
      sprite.position.set(-halfX + 0.35, y, -halfZ + 0.02);
      group.add(sprite);
    }
  }

  for (let x = -Math.floor(halfX); x <= Math.floor(halfX); x += 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.005, -halfZ),
      new THREE.Vector3(x, by, -halfZ),
    ]);
    group.add(new THREE.Line(geo, x === 0 ? meterGridMat : subtleGridMat));
  }

  // 2. Left Wall Vertical Grid (at X = -halfX)
  for (let y = 0.5; y <= by + 0.05; y += 0.5) {
    const isMeter = Math.abs(Math.round(y) - y) < 0.05;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfX, y, -halfZ),
      new THREE.Vector3(-halfX, y, halfZ),
    ]);
    group.add(new THREE.Line(geo, isMeter ? meterGridMat : subtleGridMat));
  }

  for (let z = -Math.floor(halfZ); z <= Math.floor(halfZ); z += 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfX, 0.005, z),
      new THREE.Vector3(-halfX, by, z),
    ]);
    group.add(new THREE.Line(geo, z === 0 ? meterGridMat : subtleGridMat));
  }

  return group;
}

// 3. Ghost Reference Avatar (1.70m) standing in the corner with Measuring Tape (Fita Métrica)
function createReferenceGhostAvatar(): THREE.Group {
  const group = new THREE.Group();
  (group as any).userData = { isReferenceAvatar: true };

  // Corner placement inside the 6x8m boundary: [-2.6, 0, -3.5]
  group.position.set(-2.6, 0, -3.5);

  // Frosted architectural glass shader/material
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.9,
  });

  // Anatomically proportioned 1.70m humanoid:
  // Feet: Y = 0 to 0.08
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), ghostMat);
  leftFoot.position.set(-0.12, 0.04, 0.02);
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), ghostMat);
  rightFoot.position.set(0.12, 0.04, 0.02);
  group.add(rightFoot);

  // Legs: Y = 0.08 to 0.86 (height = 0.78m)
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 16), ghostMat);
  leftLeg.position.set(-0.12, 0.47, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 16), ghostMat);
  rightLeg.position.set(0.12, 0.47, 0);
  group.add(rightLeg);

  // Pelvis / Waist: Y = 0.86 to 0.96
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.2), ghostMat);
  waist.position.set(0, 0.91, 0);
  group.add(waist);

  // Torso: Y = 0.96 to 1.48 (height = 0.52m)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.52, 16), ghostMat);
  torso.position.set(0, 1.22, 0);
  group.add(torso);

  // Arms: shoulder at 1.44m down to hand at 0.88m
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.56, 12), ghostMat);
  leftArm.position.set(-0.25, 1.16, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.56, 12), ghostMat);
  rightArm.position.set(0.25, 1.16, 0);
  group.add(rightArm);

  // Neck: Y = 1.48 to 1.52
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 12), ghostMat);
  neck.position.set(0, 1.51, 0);
  group.add(neck);

  // Head: Y = 1.52 to 1.70 (center at 1.61, radius 0.09 -> top is EXACTLY at 1.70m!)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), ghostMat);
  head.position.set(0, 1.61, 0);
  group.add(head);

  // Golden halo / reference cap at 1.70m
  const crownRing = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.11, 24), accentMat);
  crownRing.position.set(0, 1.702, 0);
  crownRing.rotation.x = -Math.PI / 2;
  group.add(crownRing);

  // MEASURING TAPE POLE (Fita Métrica) standing immediately beside the avatar (at x = 0.38)
  const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.95, 16);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0.38, 0.975, 0);
  group.add(pole);

  // Metric tick bars and labels
  const metricTicks = [
    { y: 0.50, label: '0,50m (Cama)' },
    { y: 0.85, label: '0,85m (Sofá/Mesa)' },
    { y: 1.00, label: '1,00m' },
    { y: 1.50, label: '1,50m' },
    { y: 1.70, label: '1,70m (Avatar)' },
  ];

  metricTicks.forEach(({ y, label }) => {
    // Horizontal tick arm pointing towards avatar
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.24, y, 0),
      new THREE.Vector3(0.48, y, 0),
    ]);
    const tickLine = new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0xffd700, linewidth: 2 }));
    group.add(tickLine);

    // Label sprite
    const tickSprite = createMetricTextSprite(label, 'rgba(15,16,20,0.9)', y === 1.70 ? '#ffd700' : '#e2e8f0');
    tickSprite.position.set(0.74, y, 0);
    group.add(tickSprite);
  });

  // Top Avatar Billboard Badge
  const avatarBanner = createMetricTextSprite('👤 Avatar Padrão: 1,70 m', '#121317', '#38bdf8');
  avatarBanner.position.set(0, 1.88, 0);
  group.add(avatarBanner);

  return group;
}

// 4. Visitor avatar mesh (Human proportion: 1.70 m from feet to top of head)
function createSimpleAvatarMesh(avatar?: StoreAvatar | null): THREE.Group {
  const group = new THREE.Group();
  const isCyber =
    avatar?.name?.toLowerCase().includes('cyber') || avatar?.tags?.includes('#streetwear');
  const isGala =
    avatar?.name?.toLowerCase().includes('gala') || avatar?.tags?.includes('#formal');
  const isMinimal = avatar?.name?.toLowerCase().includes('minimal');

  const clothingColor = isCyber ? 0x14b8a6 : isGala ? 0x121316 : isMinimal ? 0xe2ded5 : 0x27272a;
  const pantsColor = isCyber ? 0x1b1f24 : 0x1e293b;
  const skinColor = 0xc89d7c;

  const clothingMat = new THREE.MeshStandardMaterial({ color: clothingColor, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.7 });

  // Shoes: Y: 0 to 0.08
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.26), shoeMat);
  lShoe.position.set(-0.13, 0.04, 0.02);
  group.add(lShoe);
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.26), shoeMat);
  rShoe.position.set(0.13, 0.04, 0.02);
  group.add(rShoe);

  // Legs: Y: 0.08 to 0.86 (height 0.78)
  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.78, 16), pantsMat);
  lLeg.position.set(-0.13, 0.47, 0);
  lLeg.castShadow = true;
  group.add(lLeg);
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.78, 16), pantsMat);
  rLeg.position.set(0.13, 0.47, 0);
  rLeg.castShadow = true;
  group.add(rLeg);

  // Torso / Hoodie: Y: 0.86 to 1.48 (height 0.62)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.17, 0.62, 16), clothingMat);
  torso.position.set(0, 1.17, 0);
  torso.castShadow = true;
  group.add(torso);

  // Arms: Y: 0.90 to 1.44
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.54, 12), clothingMat);
  lArm.position.set(-0.28, 1.17, 0);
  group.add(lArm);
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.54, 12), clothingMat);
  rArm.position.set(0.28, 1.17, 0);
  group.add(rArm);

  // Head: Y: 1.50 to 1.70 (center at 1.60, radius 0.10 -> top at 1.70m!)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), skinMat);
  head.position.set(0, 1.60, 0);
  head.castShadow = true;
  group.add(head);

  group.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.frustumCulled = false;
      if ((n as THREE.Mesh).geometry) {
        (n as THREE.Mesh).geometry.computeBoundingBox();
        (n as THREE.Mesh).geometry.computeBoundingSphere();
      }
    }
  });

  return group;
}

// 5. Metric Auto-Scaling Rules on Import & Encaixar no Metro
function calculateMetricScale(
  rawSize: THREE.Vector3,
  type?: string,
  name?: string
): { scale: number; targetHeight: number; label: string; isRoom: boolean } {
  const rawHeight = Math.max(0.001, rawSize.y);
  const rawWidth = Math.max(0.001, rawSize.x);
  const rawDepth = Math.max(0.001, rawSize.z);
  const lowerName = (name || '').toLowerCase();

  // 1. Veículos & Macro Estruturas
  if (lowerName.includes('estadio') || lowerName.includes('stadium') || lowerName.includes('futebol')) {
    const targetHeight = 25.00;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Estádio de Futebol (25,00 m)',
      isRoom: true,
    };
  }
  if (lowerName.includes('predio') || lowerName.includes('edificio') || lowerName.includes('building') || lowerName.includes('torre') || lowerName.includes('skyscraper')) {
    const targetHeight = 20.00;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Prédio / Edifício (20,00 m)',
      isRoom: true,
    };
  }
  if (lowerName.includes('armazem') || lowerName.includes('galpao') || lowerName.includes('warehouse') || lowerName.includes('deposito')) {
    const targetHeight = 7.00;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Armazém / Galpão (7,00 m)',
      isRoom: true,
    };
  }
  if (lowerName.includes('carro') || lowerName.includes('car') || lowerName.includes('automovel') || lowerName.includes('veiculo') || lowerName.includes('auto')) {
    const targetHeight = 1.50;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Carro (1,50 m)',
      isRoom: false,
    };
  }

  // 2. Casas & Rooms (Encaixe pelo Teto)
  if (lowerName.includes('sobrado')) {
    const targetHeight = 5.60;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Casa Sobrado 2 Pisos (5,60 m)',
      isRoom: true,
    };
  }
  if (lowerName.includes('mansao') || lowerName.includes('hall') || lowerName.includes('castelo') || lowerName.includes('palacio')) {
    const targetHeight = 5.00;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Mansão / Hall (5,00 m)',
      isRoom: true,
    };
  }
  if (lowerName.includes('corredor')) {
    const targetHeight = 2.50;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Corredor (2,50 m)',
      isRoom: true,
    };
  }
  if (
    type === 'Sala' ||
    lowerName.includes('cenario') ||
    lowerName.includes('sala') ||
    lowerName.includes('dormitorio') ||
    lowerName.includes('quarto') ||
    lowerName.includes('loft') ||
    lowerName.includes('room') ||
    lowerName.includes('house') ||
    lowerName.includes('casa') ||
    lowerName.includes('apartamento') ||
    (rawWidth > 2.8 && rawDepth > 2.8)
  ) {
    const targetHeight = 2.80; // teto ~2.80 m
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Teto Room / Casa (2,80 m)',
      isRoom: true,
    };
  }

  // 3. Avatar e Roupas / Acessórios
  if (
    type === 'Avatar' ||
    lowerName.includes('avatar') ||
    lowerName.includes('elfa') ||
    lowerName.includes('personagem') ||
    lowerName.includes('boneco') ||
    lowerName.includes('humano')
  ) {
    const targetHeight = 1.70; // avatar padrão = 1.70 m
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Avatar Humano (1,70 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('chapeu') || lowerName.includes('bone') || lowerName.includes('hat') || lowerName.includes('coroa')) {
    const targetHeight = 0.15;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Chapéu / Boné (0,15 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('oculos') || lowerName.includes('glasses')) {
    const targetHeight = 0.04;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Óculos (0,04 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('camisa') || lowerName.includes('jaqueta') || lowerName.includes('shirt') || lowerName.includes('blusa')) {
    const targetHeight = 0.70;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Camisa / Jaqueta (~0,70 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('calca') || lowerName.includes('pants')) {
    const targetHeight = 1.00;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Calça (~1,00 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('sapato') || lowerName.includes('tenis') || lowerName.includes('shoe')) {
    const targetHeight = 0.12;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Sapato (0,12 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('colar') || lowerName.includes('necklace')) {
    const targetHeight = 0.40;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Colar (0,40 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('anel') || lowerName.includes('ring')) {
    const targetHeight = 0.02;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Anel (0,02 m)',
      isRoom: false,
    };
  }

  // 4. Luz / Decoração
  if (lowerName.includes('abajur') || lowerName.includes('lamp')) {
    const isChao = lowerName.includes('chao') || lowerName.includes('floor');
    const targetHeight = isChao ? 1.50 : 0.45;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: isChao ? 'Abajur de Chão (1,50 m)' : 'Abajur de Mesa (0,45 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('pendente') || lowerName.includes('lustre') || lowerName.includes('chandelier')) {
    const targetHeight = 0.40;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Luminária Pendente (0,40 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('vela') || lowerName.includes('copo') || lowerName.includes('candle')) {
    const targetHeight = 0.12;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Vela / Copo (0,12 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('quadro') || lowerName.includes('pintura') || lowerName.includes('painting')) {
    const targetHeight = 0.70;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Quadro (0,70 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('tapete') || lowerName.includes('rug') || lowerName.includes('carpet')) {
    const targetHeight = 0.02;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Tapete (0,02 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('planta') || lowerName.includes('vaso') || lowerName.includes('plant')) {
    const targetHeight = 1.20;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Planta em Vaso (1,20 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('tv') || lowerName.includes('televisao') || lowerName.includes('monitor')) {
    const targetHeight = 0.70;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'TV 55" (0,70 m)',
      isRoom: false,
    };
  }

  // 5. Mobília
  if (lowerName.includes('puff') || lowerName.includes('pufe')) {
    const targetHeight = 0.35;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Puff (0,35 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('sofa') || lowerName.includes('couch') || lowerName.includes('poltrona')) {
    const targetHeight = 0.85; // sofá encosto ~0.85m, assento ~0.43m
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Sofá (~0,85 m / assento ~0.43 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('cama') || lowerName.includes('bed') || lowerName.includes('colchao') || lowerName.includes('beliche')) {
    const targetHeight = 0.60; // cama ~0.50-0.60 m
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Cama / Colchão (~0,60 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('guarda-roupa') || lowerName.includes('armario') || lowerName.includes('wardrobe')) {
    const targetHeight = 2.10;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Guarda-Roupa (2,10 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('estante') || lowerName.includes('prateleira') || lowerName.includes('bookshelf')) {
    const targetHeight = 1.80;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Estante (1,80 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('porta') || lowerName.includes('door')) {
    const targetHeight = 2.10;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Porta (2,10 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('janela') || lowerName.includes('window')) {
    const targetHeight = 1.00;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Janela Peitoril (1,00 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('bancada') || lowerName.includes('balcao') || lowerName.includes('counter')) {
    const targetHeight = 0.90;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Bancada / Balcão (0,90 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('mesa de centro') || lowerName.includes('coffee table')) {
    const targetHeight = 0.40;
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Mesa de Centro (0,40 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('mesa') || lowerName.includes('table') || lowerName.includes('desk')) {
    const targetHeight = 0.75; // mesa ~0.75 m
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Mesa (~0,75 m)',
      isRoom: false,
    };
  }
  if (lowerName.includes('cadeira') || lowerName.includes('chair') || lowerName.includes('banqueta') || lowerName.includes('stool')) {
    const targetHeight = 0.85; // cadeira ~0.85 m
    return {
      scale: calculatePresetScale(rawHeight, targetHeight),
      targetHeight,
      label: 'Cadeira (~0,85 m)',
      isRoom: false,
    };
  }

  // 6. Móvel / Objeto Padrão
  const targetHeight = 0.85;
  return {
    scale: calculatePresetScale(rawHeight, targetHeight),
    targetHeight,
    label: 'Móvel Padrão (~0,85 m)',
    isRoom: false,
  };
}
