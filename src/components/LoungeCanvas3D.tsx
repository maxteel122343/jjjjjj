import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  AvatarPose,
  AvatarTransform,
  Spot,
  RoomEditorState,
  StoreAvatar,
  GizmoMode,
  SpotVisualConfig,
  PlacedObject,
  AccessoryTransform,
} from '../types';
import { extractAssetId } from '../lib/database';

interface LoungeCanvas3DProps {
  currentPose: AvatarPose;
  transform: AvatarTransform;
  spots: Spot[];
  currentSpotId: number;
  onSelectSpot: (spotId: number) => void;
  cameraMode: 'orbit' | 'frontal' | 'closeup' | 'topdown';
  equippedAccessories?: any[];
  onUpdateAvatarHeadScreenPos?: (positions: Record<number, { x: number; y: number }>) => void;
  editorRoom?: RoomEditorState;
  showSpotArrows?: boolean;
  activeUserAvatar?: StoreAvatar | null;
  customAvatarObject?: PlacedObject | null;
  gizmoMode?: GizmoMode;
  onChangeTransform?: (newTransform: AvatarTransform) => void;
  spotVisualConfig?: SpotVisualConfig;
  remotePlayers?: any[];
}

export const LoungeCanvas3D: React.FC<LoungeCanvas3DProps> = ({
  currentPose,
  transform,
  spots,
  currentSpotId,
  onSelectSpot,
  cameraMode,
  equippedAccessories,
  onUpdateAvatarHeadScreenPos,
  editorRoom,
  showSpotArrows = true,
  activeUserAvatar,
  customAvatarObject,
  gizmoMode = 'mover',
  onChangeTransform,
  spotVisualConfig,
  remotePlayers,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerGroupRef = useRef<THREE.Group | null>(null);
  const remotePlayersGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const headPosRef = useRef<Record<number, THREE.Vector3>>({});
  const animationFrameRef = useRef<number>(0);
  const spotClickablesGroupRef = useRef<THREE.Group | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const isTransformDraggingRef = useRef<boolean>(false);
  const spotVisualConfigRef = useRef<SpotVisualConfig | undefined>(spotVisualConfig);
  spotVisualConfigRef.current = spotVisualConfig;

  const gizmoModeRef = useRef<GizmoMode>(gizmoMode);
  gizmoModeRef.current = gizmoMode;

  const transformRef = useRef<AvatarTransform>(transform);
  transformRef.current = transform;

  const onChangeTransformRef = useRef(onChangeTransform);
  onChangeTransformRef.current = onChangeTransform;

  const spotAnimatedMeshesRef = useRef<
    Array<{
      group: THREE.Group;
      arrowGroup: THREE.Group;
      arrowMat: THREE.MeshBasicMaterial;
      outerRingMat: THREE.MeshBasicMaterial;
      innerRingMat: THREE.MeshBasicMaterial;
      spotId: number;
      baseY: number;
    }>
  >([]);

  const currentSpotIdRef = useRef(currentSpotId);
  currentSpotIdRef.current = currentSpotId;

  const showSpotArrowsRef = useRef(showSpotArrows);
  showSpotArrowsRef.current = showSpotArrows;

  const onSelectSpotRef = useRef(onSelectSpot);
  onSelectSpotRef.current = onSelectSpot;

  const placedObjectsMapRef = useRef<Map<string, THREE.Group>>(new Map());

  // Mouse orbit & right-click pan interaction
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAnglesRef = useRef({ theta: 0, phi: 0.18, radius: 4.8 });
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0.45, 0));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141416');
    sceneRef.current = scene;

    // Camera with enhanced near/far for extreme close-up and panoramic zoom
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.01,
      500
    );
    camera.position.set(0, 1.4, 4.8);
    camera.lookAt(0, 0.45, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting matching Reference Image 1 (warm architectural cove lighting + directional key light)
    const ambientLight = new THREE.AmbientLight(0xd9d0c5, 0.65);
    scene.add(ambientLight);

    // Warm cove strip light along top back wall
    const coveLight = new THREE.DirectionalLight(0xffecd2, 1.2);
    coveLight.position.set(0, 3.2, -1.8);
    coveLight.castShadow = true;
    coveLight.shadow.mapSize.width = 1024;
    coveLight.shadow.mapSize.height = 1024;
    scene.add(coveLight);

    // Warm ceiling spot focusing on rug
    const spotLight = new THREE.SpotLight(0xffdfa8, 2.5, 12, Math.PI / 3.5, 0.4, 1);
    spotLight.position.set(0, 4.0, 1.5);
    spotLight.target.position.set(0, 0.2, 0);
    spotLight.castShadow = true;
    scene.add(spotLight);
    scene.add(spotLight.target);

    // Subtle blue fill from front
    const fillLight = new THREE.DirectionalLight(0x90a4ae, 0.35);
    fillLight.position.set(0, 2.0, 4.0);
    scene.add(fillLight);

    // Architectural Concrete Lounge Room (Default Architecture)
    const defaultArchitectureGroup = new THREE.Group();
    scene.add(defaultArchitectureGroup);

    const roomMaterial = new THREE.MeshStandardMaterial({
      color: 0x38393c,
      roughness: 0.85,
      metalness: 0.1,
    });

    // Floor (smooth dark concrete)
    const floorGeo = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x222326,
      roughness: 0.6,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Back Wall with cove ledge
    const backWallGeo = new THREE.PlaneGeometry(16, 8);
    const backWall = new THREE.Mesh(backWallGeo, roomMaterial);
    backWall.position.set(0, 4, -3.2);
    backWall.receiveShadow = true;
    defaultArchitectureGroup.add(backWall);

    // Cove ledge geometry
    const ledgeGeo = new THREE.BoxGeometry(16, 0.15, 0.4);
    const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x2d2e30, roughness: 0.7 });
    const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
    ledge.position.set(0, 3.4, -3.0);
    defaultArchitectureGroup.add(ledge);

    // Warm LED strip glowing line on ledge
    const stripGeo = new THREE.BoxGeometry(16, 0.05, 0.05);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffe2b2 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 3.48, -2.95);
    defaultArchitectureGroup.add(strip);

    // Right Wall with shelf niche (seen in Reference 1)
    const rightWallGeo = new THREE.PlaneGeometry(12, 8);
    const rightWall = new THREE.Mesh(rightWallGeo, roomMaterial);
    rightWall.position.set(4.5, 4, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    defaultArchitectureGroup.add(rightWall);

    // Shelf niche interior
    const shelfGeo = new THREE.BoxGeometry(0.35, 1.8, 2.2);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1f2022, roughness: 0.9 });
    const shelfNiche = new THREE.Mesh(shelfGeo, shelfMat);
    shelfNiche.position.set(4.35, 1.6, -1.0);
    defaultArchitectureGroup.add(shelfNiche);

    // Warm light inside shelf
    const shelfLight = new THREE.PointLight(0xffd599, 1.2, 3);
    shelfLight.position.set(4.1, 1.8, -1.0);
    defaultArchitectureGroup.add(shelfLight);

    // Decorative vase on shelf
    const vaseGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 16);
    const vaseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const vase = new THREE.Mesh(vaseGeo, vaseMat);
    vase.position.set(4.2, 1.1, -1.2);
    defaultArchitectureGroup.add(vase);

    // Golden Carpet with Fringes (Reference 1)
    const rugGeo = new THREE.PlaneGeometry(4.4, 2.6);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x9b7a3e,
      roughness: 0.75,
      metalness: 0.35,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.015, 0.1);
    rug.receiveShadow = true;
    defaultArchitectureGroup.add(rug);

    // If editorRoom has a custom 3D scenario uploaded/set, load it and hide default walls!
    if (editorRoom?.sceneAssetBlobUrl) {
      defaultArchitectureGroup.visible = false;
      const scenarioLoader = new GLTFLoader();
      scenarioLoader.load(
        editorRoom.sceneAssetBlobUrl,
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const rawHeight = Math.max(0.01, size.y);
          const targetCeiling = editorRoom.boundary?.y || 2.80;
          const scale = targetCeiling / rawHeight;
          model.scale.set(scale, scale, scale);

          const scaledBox = new THREE.Box3().setFromObject(model);
          const center = scaledBox.getCenter(new THREE.Vector3());
          model.position.x = -center.x;
          model.position.z = -center.z;
          scaledBox.setFromObject(model);
          model.position.y = -scaledBox.min.y;

          model.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              const mat = (node as THREE.Mesh).material;
              if (mat) {
                if (Array.isArray(mat)) {
                  mat.forEach((m) => (m.side = THREE.DoubleSide));
                } else {
                  mat.side = THREE.DoubleSide;
                }
              }
            }
          });

          scene.add(model);
        },
        undefined,
        (err) => {
          console.warn('Could not load custom scenario model:', err);
          defaultArchitectureGroup.visible = true;
        }
      );
    } else if (editorRoom?.sceneAssetId === 'inv-scene-1') {
      defaultArchitectureGroup.visible = false;
      const scarlet = createScarletSalonArchitecture();
      scene.add(scarlet);
    } else if (editorRoom?.sceneAssetId === 'inv-scene-2') {
      defaultArchitectureGroup.visible = false;
      const loft = createLoftArchitecture();
      scene.add(loft);
    }

    // Spot Meshes: Glowing circles (círculos brilhantes) + discreet blinking down-arrow
    const spotClickablesGroup = new THREE.Group();
    scene.add(spotClickablesGroup);
    spotClickablesGroupRef.current = spotClickablesGroup;
    spotAnimatedMeshesRef.current = [];

    const createGlowingSpotMesh = (spotId: number, posX: number, posY: number, posZ: number) => {
      const group = new THREE.Group();
      group.position.set(posX, posY, posZ);
      (group as any).userData = { spotId, isSpotInteractive: true };

      const style = spotVisualConfigRef.current?.indicatorStyle || 'full';
      const arrowScale = spotVisualConfigRef.current?.arrowScale || 1.0;
      const signalScale = spotVisualConfigRef.current?.signalScale || 1.0;

      const isWhitePulse = style === 'white_pulse';
      const isYellow = style === 'yellow_gold';
      const isArrowOnly = style === 'arrow_only';

      // 1. Ground Glowing Disc (Thin circle flat on the floor at Y = 0.015)
      const discGeo = new THREE.CircleGeometry(0.48 * signalScale, 32);
      const discMat = new THREE.MeshBasicMaterial({
        color: isWhitePulse ? 0xffffff : 0xd4af37,
        transparent: true,
        opacity: isWhitePulse ? 0.20 : 0.28,
        side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.015;
      disc.visible = !isArrowOnly;
      (disc as any).userData = { spotId, isSpotInteractive: true };
      group.add(disc);

      // 2. Outer Luminous Neon Ring
      const outerRingGeo = new THREE.RingGeometry(0.42 * signalScale, 0.50 * signalScale, 32);
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: isWhitePulse ? 0xffffff : 0xffd700,
        transparent: true,
        opacity: isWhitePulse ? 0.90 : 0.85,
        side: THREE.DoubleSide,
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.018;
      outerRing.visible = !isArrowOnly;
      (outerRing as any).userData = { spotId, isSpotInteractive: true };
      group.add(outerRing);

      // 3. Inner Pulsing Halo Ring
      const innerRingGeo = new THREE.RingGeometry(0.20 * signalScale, 0.25 * signalScale, 32);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: isWhitePulse ? 0xffffff : 0xfff0a0,
        transparent: true,
        opacity: isWhitePulse ? 0.80 : 0.65,
        side: THREE.DoubleSide,
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.rotation.x = -Math.PI / 2;
      innerRing.position.y = 0.02;
      innerRing.visible = !isArrowOnly;
      (innerRing as any).userData = { spotId, isSpotInteractive: true };
      group.add(innerRing);

      // 4. Center Beacon Dot
      const centerDotGeo = new THREE.CircleGeometry(0.07 * signalScale, 16);
      const centerDotMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      });
      const centerDot = new THREE.Mesh(centerDotGeo, centerDotMat);
      centerDot.rotation.x = -Math.PI / 2;
      centerDot.position.y = 0.022;
      centerDot.visible = !isArrowOnly;
      (centerDot as any).userData = { spotId, isSpotInteractive: true };
      group.add(centerDot);

      // 5. Floating Discreet Blinking Arrow pointing down (seta piscando p baixo)
      const arrowGroup = new THREE.Group();
      arrowGroup.name = `spotArrow-${spotId}`;
      (arrowGroup as any).userData = { spotId, isSpotArrow: true };

      // Inverted Cone (pointing down: tip at bottom)
      const coneGeo = new THREE.ConeGeometry(0.11 * arrowScale, 0.24 * arrowScale, 16);
      const arrowMat = new THREE.MeshBasicMaterial({
        color: isWhitePulse ? 0xffffff : 0xffd700,
        transparent: true,
        opacity: 0.85,
      });
      const cone = new THREE.Mesh(coneGeo, arrowMat);
      cone.rotation.x = Math.PI; // Inverted pointing downwards!
      cone.position.y = 0.82;
      (cone as any).userData = { spotId, isSpotInteractive: true };
      arrowGroup.add(cone);

      // Small round base for the arrow
      const capGeo = new THREE.CylinderGeometry(0.11 * arrowScale, 0.11 * arrowScale, 0.04 * arrowScale, 16);
      const cap = new THREE.Mesh(capGeo, arrowMat);
      cap.position.y = 0.82 + 0.12 * arrowScale;
      (cap as any).userData = { spotId, isSpotInteractive: true };
      arrowGroup.add(cap);

      // Arrow visibility based on config & showSpotArrows
      arrowGroup.visible = isArrowOnly ? true : isYellow ? false : showSpotArrowsRef.current;

      group.add(arrowGroup);
      spotClickablesGroup.add(group);

      spotAnimatedMeshesRef.current.push({
        group,
        arrowGroup,
        arrowMat,
        outerRingMat,
        innerRingMat,
        spotId,
        baseY: 0,
      });

      return group;
    };

    // Spot Meshes: either from editorRoom spots or default 3 spots
    if (editorRoom && spots.length > 0) {
      spots.forEach((spot) => {
        createGlowingSpotMesh(spot.id, spot.position[0], spot.position[1], spot.position[2]);
      });
    } else {
      // Spot 1: Left (Maya)
      createGlowingSpotMesh(1, -1.45, 0, 0);

      // Spot 2: Center (Player)
      createGlowingSpotMesh(2, 0, 0, 0.2);

      // Spot 3: Right (Zack)
      createGlowingSpotMesh(3, 1.45, 0, 0);
    }

    // If editorRoom has placedObjects, render them (excluding customAvatarObject which will be controlled as the player avatar)!
    if (editorRoom?.placedObjects && editorRoom.placedObjects.length > 0) {
      const gltfLoader = new GLTFLoader();
      editorRoom.placedObjects.forEach((obj) => {
        // If this object is designated as the player's custom avatar, skip rendering it as a static room prop!
        if (customAvatarObject && obj.id === customAvatarObject.id) {
          return;
        }

        const objGroup = new THREE.Group();
        objGroup.position.set(obj.position[0], obj.position[1], obj.position[2]);
        objGroup.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
        objGroup.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);

        const objUuid = extractAssetId(obj.assetId || (obj as any).asset_id || (obj as any).originalItemId || obj.fileBlobUrl);

        const tryLoadObjGlb = (urlToLoad: string) => {
          gltfLoader.load(urlToLoad, (gltf) => {
            const m = gltf.scene;
            const rawBox = new THREE.Box3().setFromObject(m);
            const center = rawBox.getCenter(new THREE.Vector3());
            m.position.x = -center.x;
            m.position.z = -center.z;
            m.position.y = -rawBox.min.y;
            m.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                const mat = (child as THREE.Mesh).material;
                if (mat) {
                  if (Array.isArray(mat)) {
                    mat.forEach((x) => (x.side = THREE.DoubleSide));
                  } else {
                    mat.side = THREE.DoubleSide;
                  }
                }
              }
            });
            objGroup.add(m);
          });
        };

        if (objUuid) {
          fetch(`/api/v1/assets/${objUuid}/resolve`, {
            headers: { 'x-user-id': 'user-default' },
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.download_url) {
                tryLoadObjGlb(data.download_url);
              } else if (obj.fileBlobUrl && !obj.fileBlobUrl.includes('?X-Amz-Signature=') && !obj.fileBlobUrl.startsWith('blob:')) {
                tryLoadObjGlb(obj.fileBlobUrl);
              }
            })
            .catch(() => {
              if (obj.fileBlobUrl && !obj.fileBlobUrl.includes('?X-Amz-Signature=') && !obj.fileBlobUrl.startsWith('blob:')) {
                tryLoadObjGlb(obj.fileBlobUrl);
              }
            });
        } else if (obj.fileBlobUrl && !obj.fileBlobUrl.includes('?X-Amz-Signature=') && !obj.fileBlobUrl.startsWith('blob:')) {
          tryLoadObjGlb(obj.fileBlobUrl);
        } else if (
          obj.type === 'avatar' ||
          obj.isAvatar ||
          obj.name.toLowerCase().includes('avatar')
        ) {
          const avatarMesh = createCharacterMesh({
            skinColor: 0xcca080,
            hairColor: 0x1f1b18,
            clothColor: 0xd4af37,
            pantsColor: 0x202227,
            hasGlasses: false,
            hasGoldChain: true,
            hairStyle: 'curly',
          });
          avatarMesh.position.y = 0.28;
          objGroup.add(avatarMesh);
        } else {
          // Stylish furniture mesh
          const sofaGeo = new THREE.BoxGeometry(1.8, 0.5, 0.8);
          const sofaMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.8 });
          const sofaMesh = new THREE.Mesh(sofaGeo, sofaMat);
          sofaMesh.position.y = 0.25;
          objGroup.add(sofaMesh);
        }
        scene.add(objGroup);
        placedObjectsMapRef.current.set(obj.id, objGroup);
      });
    }

    // Create Avatar Meshes matching Reference Image 1 (only when not custom editorRoom)
    if (!editorRoom) {
      // Left Avatar: Maya (smiling, beige cozy sweater, cream pants)
      const mayaGroup = createCharacterMesh({
        skinColor: 0xdfb498,
        hairColor: 0x2c1d11,
        clothColor: 0xeee7db, // cream sweater
        pantsColor: 0xd8cbba, // cream pants
        hasGlasses: false,
        hasGoldChain: false,
        hairStyle: 'female-long',
      });
      mayaGroup.position.set(-1.45, 0.28, 0);
      mayaGroup.rotation.y = THREE.MathUtils.degToRad(20);
      scene.add(mayaGroup);

      // Right Avatar: Zack (glasses, army green hoodie, gold chain)
      const zackGroup = createCharacterMesh({
        skinColor: 0x966848,
        hairColor: 0x1a1a1a,
        clothColor: 0x475338, // army green hoodie
        pantsColor: 0x222429, // dark grey pants
        hasGlasses: true,
        hasGoldChain: true,
        hairStyle: 'afro-short',
      });
      zackGroup.position.set(1.45, 0.28, 0);
      zackGroup.rotation.y = THREE.MathUtils.degToRad(-25);
      scene.add(zackGroup);
    }

    // Center Avatar: Player (customized dynamically according to customAvatarObject or activeUserAvatar)
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 0.28, 0.2);
    scene.add(playerGroup);
    playerGroupRef.current = playerGroup;

    // Group for remote players in the 3D scene
    const remotePlayersGroup = new THREE.Group();
    scene.add(remotePlayersGroup);
    remotePlayersGroupRef.current = remotePlayersGroup;

    // Real 3D TransformControls Gizmo on active player avatar (matching Creator Mode functionality)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event: any) => {
      isTransformDraggingRef.current = Boolean(event.value);
      if (event.value) {
        isDraggingRef.current = false;
        isPanningRef.current = false;
      }
    });

    transformControls.addEventListener('change', () => {
      if (playerGroupRef.current && isTransformDraggingRef.current) {
        const player = playerGroupRef.current;
        const activeSpot = spots.find((s) => s.id === currentSpotIdRef.current) || spots[1];
        if (activeSpot && onChangeTransformRef.current) {
          const mode = gizmoModeRef.current;
          if (mode === 'mover') {
            const dx = parseFloat((player.position.x - activeSpot.position[0]).toFixed(2));
            const dz = parseFloat((player.position.z - activeSpot.position[2]).toFixed(2));
            const dy = parseFloat((player.position.y - activeSpot.position[1] - (currentPose.heightOffset || 0)).toFixed(2));
            onChangeTransformRef.current({
              ...transformRef.current,
              positionOffset: [dx, dy, dz],
            });
          } else if (mode === 'escalar' || mode === 'scale') {
            const s = Math.max(0.4, Math.min(2.5, parseFloat(player.scale.x.toFixed(2))));
            onChangeTransformRef.current({
              ...transformRef.current,
              scale: s,
            });
          } else if (mode === 'rodar' || mode === 'angle') {
            const deg = Math.round(((THREE.MathUtils.radToDeg(player.rotation.y) - activeSpot.rotation - (currentPose.rotationOffset || 0)) % 360 + 360) % 360);
            onChangeTransformRef.current({
              ...transformRef.current,
              angle: deg,
            });
          }
        }
      }
    });

    transformControls.attach(playerGroup);

    // Track head positions in 3D for speech bubble placement
    headPosRef.current = {
      1: new THREE.Vector3(-1.45, 1.25, 0),
      2: new THREE.Vector3(0, 1.25, 0.2),
      3: new THREE.Vector3(1.45, 1.25, 0),
    };

    // Render loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;

      // Smooth camera orbit positioning
      if (cameraRef.current) {
        const cam = cameraRef.current;
        let targetRadius = cameraAnglesRef.current.radius;
        let targetPhi = cameraAnglesRef.current.phi;
        let targetTheta = cameraAnglesRef.current.theta;
        let targetLookAtY = 0.55;

        if (cameraMode === 'frontal') {
          targetRadius = 4.4;
          targetPhi = 0.1;
          targetTheta = 0;
          targetLookAtY = 0.5;
        } else if (cameraMode === 'closeup') {
          targetRadius = 2.4;
          targetPhi = 0.05;
          targetTheta = 0;
          targetLookAtY = 0.65;
        } else if (cameraMode === 'topdown') {
          targetRadius = 5.2;
          targetPhi = 0.75;
          targetTheta = 0;
          targetLookAtY = 0.2;
        }

        const target = cameraTargetRef.current;
        const x = target.x + targetRadius * Math.sin(targetTheta) * Math.cos(targetPhi);
        const y = target.y + targetRadius * Math.sin(targetPhi) + 0.35;
        const z = target.z + targetRadius * Math.cos(targetTheta) * Math.cos(targetPhi);

        cam.position.lerp(new THREE.Vector3(x, y, z), 0.08);
        cam.lookAt(target.x, target.y + targetLookAtY, target.z);

        // Project 3D head positions to 2D screen coordinates
        if (onUpdateAvatarHeadScreenPos && container) {
          const rect = container.getBoundingClientRect();
          const screenPosMap: Record<number, { x: number; y: number }> = {};

          // Update player head position based on actual player avatar position in 3D
          if (playerGroupRef.current) {
            const playerWorldHead = new THREE.Vector3();
            playerGroupRef.current.getWorldPosition(playerWorldHead);
            // Position bubble directly over top of avatar head
            const headHeight = 1.30 * (transform.scale || 1.0) * (transform.sizeY || 1.0);
            playerWorldHead.y += headHeight;
            headPosRef.current[currentSpotIdRef.current] = playerWorldHead;
          }

          Object.entries(headPosRef.current).forEach(([idStr, vec3]) => {
            const tempVec = vec3.clone();
            tempVec.project(cam);
            if (tempVec.z < 1) {
              const screenX = ((tempVec.x + 1) / 2) * rect.width;
              const screenY = ((-tempVec.y + 1) / 2) * rect.height;
              screenPosMap[Number(idStr)] = { x: screenX, y: screenY };
            }
          });

          onUpdateAvatarHeadScreenPos(screenPosMap);
        }
      }

      // Trajectory Motion Simulation for Player Avatar when on a spot with motion configured
      if (editorRoom?.spots && playerGroupRef.current && !isTransformDraggingRef.current) {
        const activeEditorSpot =
          editorRoom.spots[currentSpotIdRef.current - 1] ||
          editorRoom.spots.find((s, idx) => idx + 1 === currentSpotIdRef.current);
        if (activeEditorSpot?.motion?.enabled) {
          const cfg = activeEditorSpot.motion;
          const spd = cfg.speed || 1.0;
          const phase = (time * spd * 2.0) % (Math.PI * 2);
          const factor = cfg.loop ? (1 - Math.cos(phase)) / 2 : (time * spd) % 1.0;

          const baseDx = (cfg.deltaPosition?.[0] || 0) * factor;
          let baseDy = (cfg.deltaPosition?.[1] || 0) * factor;
          let baseDz = (cfg.deltaPosition?.[2] || 0) * factor;
          let posX = baseDx;
          let posY = baseDy;
          let posZ = baseDz;

          const traj = cfg.curveTrajectory || 'linear';
          if (traj === 'arc') {
            const h = cfg.curveHeight !== undefined ? cfg.curveHeight : 2.0;
            posY += 4 * h * factor * (1 - factor);
          } else if (traj === 'circle_turn') {
            const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
            const rad = THREE.MathUtils.degToRad(turnDeg * factor);
            const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 2.0;
            posX = radius * Math.sin(rad) + baseDx;
            posZ = radius * (1 - Math.cos(rad)) + baseDz;
          } else if (traj === 'spiral') {
            const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
            const rad = THREE.MathUtils.degToRad(turnDeg * factor);
            const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 1.5;
            posX = radius * Math.cos(rad) - radius + baseDx;
            posZ = radius * Math.sin(rad) + baseDz;
          } else if (traj === 'wave') {
            posY += Math.sin(factor * Math.PI * 4) * 0.35;
          }

          const ryDeg =
            cfg.turnAngle !== undefined && traj === 'circle_turn'
              ? cfg.turnAngle * factor
              : (cfg.deltaRotation?.[1] || 0) * factor;

          const activeSpot = spots.find((s) => s.id === currentSpotIdRef.current) || spots[1];
          const spotRotRad = THREE.MathUtils.degToRad(activeSpot?.rotation || 0);
          const worldX = posX * Math.cos(spotRotRad) + posZ * Math.sin(spotRotRad);
          const worldZ = -posX * Math.sin(spotRotRad) + posZ * Math.cos(spotRotRad);

          const offX = transformRef.current.positionOffset?.[0] || 0;
          const offY = transformRef.current.positionOffset?.[1] || 0;
          const offZ = transformRef.current.positionOffset?.[2] || 0;

          playerGroupRef.current.position.set(
            activeSpot.position[0] + offX + worldX,
            activeSpot.position[1] + (currentPose.heightOffset || 0) + offY + posY,
            activeSpot.position[2] + offZ + worldZ
          );

          const totalAngleDeg =
            activeSpot.rotation +
            transformRef.current.angle +
            (currentPose.rotationOffset || 0) +
            ryDeg;
          playerGroupRef.current.rotation.y = THREE.MathUtils.degToRad(totalAngleDeg);
        }
      }

      // Move any parent placedObjects in editorRoom that have motion configured
      if (editorRoom?.spots) {
        editorRoom.spots.forEach((spot) => {
          if (spot.motion?.enabled && spot.parentObjectId && (spot.motion.target === 'parent_object' || spot.motion.target === 'both')) {
            const pGroup = placedObjectsMapRef.current.get(spot.parentObjectId);
            const baseObj = editorRoom.placedObjects.find((o) => o.id === spot.parentObjectId);
            if (pGroup && baseObj) {
              const cfg = spot.motion;
              const spd = cfg.speed || 1.0;
              const phase = (time * spd * 2.0) % (Math.PI * 2);
              const factor = cfg.loop ? (1 - Math.cos(phase)) / 2 : (time * spd) % 1.0;

              const baseDx = (cfg.deltaPosition?.[0] || 0) * factor;
              let baseDy = (cfg.deltaPosition?.[1] || 0) * factor;
              let baseDz = (cfg.deltaPosition?.[2] || 0) * factor;
              let posX = baseDx;
              let posY = baseDy;
              let posZ = baseDz;

              const traj = cfg.curveTrajectory || 'linear';
              if (traj === 'arc') {
                const h = cfg.curveHeight !== undefined ? cfg.curveHeight : 2.0;
                posY += 4 * h * factor * (1 - factor);
              } else if (traj === 'circle_turn') {
                const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
                const rad = THREE.MathUtils.degToRad(turnDeg * factor);
                const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 2.0;
                posX = radius * Math.sin(rad) + baseDx;
                posZ = radius * (1 - Math.cos(rad)) + baseDz;
              } else if (traj === 'spiral') {
                const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
                const rad = THREE.MathUtils.degToRad(turnDeg * factor);
                const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 1.5;
                posX = radius * Math.cos(rad) - radius + baseDx;
                posZ = radius * Math.sin(rad) + baseDz;
              } else if (traj === 'wave') {
                posY += Math.sin(factor * Math.PI * 4) * 0.35;
              }

              const spotRotRad = THREE.MathUtils.degToRad(spot.rotation || 0);
              const worldX = posX * Math.cos(spotRotRad) + posZ * Math.sin(spotRotRad);
              const worldZ = -posX * Math.sin(spotRotRad) + posZ * Math.cos(spotRotRad);

              const rxDeg = (cfg.deltaRotation?.[0] || 0) * factor;
              const ryDeg = cfg.turnAngle !== undefined && traj === 'circle_turn'
                ? cfg.turnAngle * factor
                : (cfg.deltaRotation?.[1] || 0) * factor;
              const rzDeg = (cfg.deltaRotation?.[2] || 0) * factor;

              pGroup.position.set(
                baseObj.position[0] + worldX,
                baseObj.position[1] + posY,
                baseObj.position[2] + worldZ
              );
              pGroup.rotation.set(
                baseObj.rotation[0] + THREE.MathUtils.degToRad(rxDeg),
                baseObj.rotation[1] + THREE.MathUtils.degToRad(ryDeg),
                baseObj.rotation[2] + THREE.MathUtils.degToRad(rzDeg)
              );
            }
          }
        });
      }

      // Animate spot circles & blinking down-arrows
      spotAnimatedMeshesRef.current.forEach((item) => {
        const isCurrentSpot = item.spotId === currentSpotIdRef.current;
        // Show arrow only if not currently occupying this spot and toggle is on
        const shouldShowArrow = showSpotArrowsRef.current && !isCurrentSpot;
        item.arrowGroup.visible = shouldShowArrow;

        if (shouldShowArrow) {
          // Bobbing up and down
          item.arrowGroup.position.y = item.baseY + Math.sin(time * 3.6) * 0.07;
          // Discreet blinking/pulsing opacity
          item.arrowMat.opacity = 0.45 + 0.55 * Math.abs(Math.sin(time * 3.2));
        }

        // Soft pulse on inner glowing circle
        item.innerRingMat.opacity = 0.35 + 0.45 * Math.sin(time * 2.8);
        item.outerRingMat.opacity = isCurrentSpot ? 0.95 : 0.70;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Direct 3D Raycasting on Click: click on spot circle / arrow to move there
    let clickStartX = 0;
    let clickStartY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (isTransformDraggingRef.current) return;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

      // Right-click (button === 2) or middle-click (button === 1): PAN
      if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        isPanningRef.current = true;
        isDraggingRef.current = false;
        container.style.cursor = 'grabbing';
        return;
      }

      // Left-click (button === 0): ORBIT
      if (e.button === 0) {
        isDraggingRef.current = true;
        isPanningRef.current = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

      // Right-click Pan Navigation
      if (isPanningRef.current && cameraRef.current) {
        if (e.buttons === 0) {
          isPanningRef.current = false;
          container.style.cursor = 'default';
          return;
        }
        const cam = cameraRef.current;
        const vFovRad = (cam.fov * Math.PI) / 180;
        const visibleHeightAtDist = 2 * Math.tan(vFovRad / 2) * Math.max(0.5, cameraAnglesRef.current.radius);
        const factor = visibleHeightAtDist / Math.max(100, container.clientHeight);

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

        cameraTargetRef.current.addScaledVector(right, -deltaX * factor);
        cameraTargetRef.current.addScaledVector(up, deltaY * factor);
        return;
      }

      // Left-click Orbit
      if (isDraggingRef.current) {
        cameraAnglesRef.current.theta -= deltaX * 0.005;
        cameraAnglesRef.current.phi = Math.max(
          -0.35,
          Math.min(1.40, cameraAnglesRef.current.phi + deltaY * 0.005)
        );
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        container.style.cursor = 'default';
      }
      isDraggingRef.current = false;

      // Detect click if drag was minimal (< 5px)
      const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
      if (dist < 5 && container && cameraRef.current && spotClickablesGroupRef.current) {
        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(
          spotClickablesGroupRef.current.children,
          true
        );
        if (intersects.length > 0) {
          let hitObj: THREE.Object3D | null = intersects[0].object;
          while (hitObj && (hitObj as any).userData?.spotId === undefined && hitObj.parent) {
            hitObj = hitObj.parent;
          }
          if (hitObj && (hitObj as any).userData?.spotId !== undefined) {
            const clickedSpotId = (hitObj as any).userData.spotId;
            onSelectSpotRef.current(clickedSpotId);
          }
        }
      }
    };

    // Smooth exponential zoom with massive range (0.35m to 30m)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.max(-150, Math.min(150, e.deltaY));
      const zoomFactor = Math.exp(delta * 0.0018);
      cameraAnglesRef.current.radius = Math.max(
        0.35,
        Math.min(30.0, cameraAnglesRef.current.radius * zoomFactor)
      );
    };

    // Keyboard arrow keys navigation to move scenario / orbit room
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        cameraAnglesRef.current.theta += 0.06;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        cameraAnglesRef.current.theta -= 0.06;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (e.shiftKey) {
          cameraAnglesRef.current.radius = Math.max(0.35, cameraAnglesRef.current.radius - 0.4);
        } else {
          cameraAnglesRef.current.phi = Math.min(1.40, cameraAnglesRef.current.phi + 0.04);
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) {
          cameraAnglesRef.current.radius = Math.min(30.0, cameraAnglesRef.current.radius + 0.4);
        } else {
          cameraAnglesRef.current.phi = Math.max(-0.35, cameraAnglesRef.current.phi - 0.04);
        }
      }
    };

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

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
    domEl.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      domEl.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('contextmenu', handleContextMenu);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      if (container.contains(domEl)) {
        container.removeChild(domEl);
      }
      renderer.dispose();
    };
  }, []);

  // Update Remote Players 3D Meshes & Floating Display Names
  useEffect(() => {
    if (!remotePlayersGroupRef.current) return;
    const group = remotePlayersGroupRef.current;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (remotePlayers && remotePlayers.length > 0) {
      remotePlayers.forEach((player, idx) => {
        const spot = spots.find(
          (s) => s.id === player.spotId || String(s.id) === String(player.spotId)
        ) || spots[idx % spots.length] || { position: [1.2 * (idx + 1), 0.02, 0], rotation: 0, type: 'pe' };

        const posX = spot.position?.[0] ?? (1.2 * (idx + 1));
        const posY = (spot.position?.[1] ?? 0.02) + 0.26;
        const posZ = spot.position?.[2] ?? 0;
        const rotY = THREE.MathUtils.degToRad(spot.rotation || 0);

        const poseGlbKey = player.pose?.glbKey || 'stand';
        const isSeated = poseGlbKey.includes('sit') || (spot as any).type === 'sentar';

        const avatarGlbUrl =
          player.avatar?.fileBlobUrl ||
          player.avatar?.asset_url ||
          player.customAvatarUrl ||
          player.avatarUrl;
        const playerContainer = new THREE.Group();
        playerContainer.position.set(posX, posY, posZ);
        playerContainer.rotation.y = rotY;

        // Create 3D floating canvas name tag above remote player's head
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(15, 17, 23, 0.90)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(6, 6, 244, 52, 10);
          } else {
            ctx.rect(6, 6, 244, 52);
          }
          ctx.fill();

          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(6, 6, 244, 52, 10);
          } else {
            ctx.rect(6, 6, 244, 52);
          }
          ctx.stroke();

          ctx.font = 'bold 20px sans-serif';
          ctx.fillStyle = '#ffd700';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(player.displayName || 'Usuário', 128, 32);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(0, 1.35, 0);
        sprite.scale.set(1.4, 0.35, 1);
        playerContainer.add(sprite);

        // Store remote player head position in 3D for floating SpeechBubbleOverlay projection
        const headHeight = isSeated ? 1.0 : 1.45;
        headPosRef.current[player.spotId] = new THREE.Vector3(posX, posY + headHeight, posZ);

        const remoteMesh = createCharacterMesh({
          skinColor: idx % 3 === 0 ? 0xdfb498 : idx % 3 === 1 ? 0x8d5524 : 0xf1c27d,
          hairColor: idx % 2 === 0 ? 0x1f1b18 : 0x4a2c11,
          clothColor: idx % 3 === 0 ? 0x2563eb : idx % 3 === 1 ? 0x10b981 : 0xd97706,
          pantsColor: 0x1e293b,
          hasGlasses: idx % 2 === 1,
          hasGoldChain: true,
          hairStyle: idx % 2 === 0 ? 'curly' : 'afro-short',
          currentPose: isSeated ? 'sentado' : 'stand',
        });
        remoteMesh.visible = true;
        playerContainer.add(remoteMesh);

        // Only attempt loading remote GLB if it is a valid web URL or non-stale blob
        if (avatarGlbUrl && (avatarGlbUrl.startsWith('http://') || avatarGlbUrl.startsWith('https://') || avatarGlbUrl.startsWith('data:'))) {
          const loader = new GLTFLoader();
          loader.load(
            avatarGlbUrl,
            (gltf) => {
              const glbModel = gltf.scene;
              const box = new THREE.Box3().setFromObject(glbModel);
              const size = box.getSize(new THREE.Vector3());
              const targetHeight = isSeated ? 1.0 : 1.6;
              const scale = size.y > 0 ? targetHeight / size.y : 1;
              glbModel.scale.set(scale, scale, scale);

              const center = box.getCenter(new THREE.Vector3());
              glbModel.position.x = -center.x * scale;
              glbModel.position.z = -center.z * scale;
              glbModel.position.y = -box.min.y * scale;

              remoteMesh.visible = false;
              playerContainer.add(glbModel);
            },
            undefined,
            (err) => {
              console.warn('Could not load remote player GLB model, using character mesh fallback:', err);
              remoteMesh.visible = true;
            }
          );
        }

        group.add(playerContainer);
      });
    }
  }, [remotePlayers, spots]);

  // Update Player transform & Spot position & Pose geometry
  useEffect(() => {
    if (!playerGroupRef.current) return;
    const player = playerGroupRef.current;

    // Spot position
    const activeSpot = spots.find((s) => s.id === currentSpotId) || spots[1];
    const offX = transform.positionOffset?.[0] || 0;
    const offY = transform.positionOffset?.[1] || 0;
    const offZ = transform.positionOffset?.[2] || 0;

    player.position.set(
      activeSpot.position[0] + offX,
      activeSpot.position[1] + (currentPose.heightOffset || 0) + offY,
      activeSpot.position[2] + offZ
    );

    // Transform from Gizmo (Scale, SizeY, Angle)
    player.scale.set(
      transform.scale,
      transform.scale * (transform.sizeY || 1.0),
      transform.scale
    );

    // Rotation: spot base angle + gizmo angle + pose angle offset
    const totalAngleDeg = activeSpot.rotation + transform.angle + (currentPose.rotationOffset || 0);
    player.rotation.y = THREE.MathUtils.degToRad(totalAngleDeg);
  }, [transform, currentPose, currentSpotId, spots]);

  // Synchronize TransformControls mode (mover -> translate, escalar -> scale, rodar -> rotate)
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc || !playerGroupRef.current) return;
    tc.attach(playerGroupRef.current);
    const m = gizmoMode === 'scale' ? 'escalar' : gizmoMode === 'angle' ? 'rodar' : gizmoMode;
    if (m === 'mover') {
      tc.setMode('translate');
      tc.showX = true;
      tc.showY = true;
      tc.showZ = true;
    } else if (m === 'escalar') {
      tc.setMode('scale');
      tc.showX = true;
      tc.showY = true;
      tc.showZ = true;
    } else if (m === 'rodar') {
      tc.setMode('rotate');
      tc.showX = false;
      tc.showY = true;
      tc.showZ = false;
    } else if (m === 'elevar') {
      tc.setMode('translate');
      tc.showX = false;
      tc.showY = true;
      tc.showZ = false;
    }
  }, [gizmoMode, currentSpotId]);

  // Synchronize Player Avatar 3D Model and Posture dynamically whenever activeUserAvatar, currentPose, customAvatarObject, or equippedAccessories changes
  useEffect(() => {
    if (!playerGroupRef.current) return;
    const playerGroup = playerGroupRef.current;

    // Clear previous avatar meshes from playerGroup
    while (playerGroup.children.length > 0) {
      const child = playerGroup.children[0];
      playerGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    const poseName = (currentPose?.name || '').toLowerCase();

    const applyModelPoseAdjustments = (m: THREE.Group) => {
      if (poseName.includes('sentar')) {
        m.position.y -= 0.38;
      } else if (poseName.includes('deitar') || poseName.includes('reclinad')) {
        m.rotation.x = -Math.PI / 4.2;
        m.position.y -= 0.25;
        m.position.z -= 0.2;
      } else if (poseName.includes('acenar')) {
        m.rotation.z = -0.06;
        m.rotation.y = 0.12;
      } else if (poseName.includes('rindo')) {
        m.rotation.x = 0.1;
        m.rotation.z = -0.03;
      } else if (poseName.includes('modelo') || poseName.includes('noir')) {
        m.rotation.y = 0.25;
        m.rotation.z = 0.04;
      }
    };

    const avatarUuid = extractAssetId(
      customAvatarObject?.assetId ||
      (customAvatarObject as any)?.asset_id ||
      customAvatarObject?.fileBlobUrl ||
      activeUserAvatar?.assetId ||
      (activeUserAvatar as any)?.asset_id ||
      activeUserAvatar?.fileBlobUrl
    );

    const tryLoadPlayerGlb = (modelUrl: string) => {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        modelUrl,
        (gltf) => {
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
          applyModelPoseAdjustments(m);
          m.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.frustumCulled = false;
            }
          });
          playerGroup.add(m);
        },
        undefined,
        (err) => {
          console.warn('[LoungeCanvas3D] Player GLB load error, fallback to character mesh:', err);
          renderDefaultCharacterMesh();
        }
      );
    };

    const renderDefaultCharacterMesh = () => {
      const isCyber =
        activeUserAvatar?.name?.toLowerCase().includes('cyber') ||
        activeUserAvatar?.tags?.includes('#streetwear');
      const isGala =
        activeUserAvatar?.name?.toLowerCase().includes('gala') ||
        activeUserAvatar?.tags?.includes('#formal');
      const isMinimal = activeUserAvatar?.name?.toLowerCase().includes('minimal');

      const defaultPlayerMesh = createCharacterMesh({
        skinColor: 0xcca080,
        hairColor: 0x1f1b18,
        clothColor: isCyber ? 0x14b8a6 : isGala ? 0x121316 : isMinimal ? 0xe2ded5 : 0x19191d,
        pantsColor: isCyber ? 0x1b1f24 : 0x202227,
        hasGlasses: isCyber || (Array.isArray(equippedAccessories) && equippedAccessories.some((acc: any) => acc === 'sunglasses' || acc?.id === 'sunglasses')),
        hasGoldChain: isGala || true,
        hairStyle: 'curly',
        currentPose: currentPose?.name || 'Em pé',
      });
      playerGroup.add(defaultPlayerMesh);
    };

    const directUrl =
      customAvatarObject?.fileBlobUrl || activeUserAvatar?.fileBlobUrl;

    if (avatarUuid) {
      fetch(`/api/v1/assets/${avatarUuid}/resolve`, {
        headers: { 'x-user-id': 'user-default' },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.download_url) {
            tryLoadPlayerGlb(data.download_url);
          } else if (directUrl && !directUrl.includes('?X-Amz-Signature=') && !directUrl.startsWith('blob:')) {
            tryLoadPlayerGlb(directUrl);
          } else {
            renderDefaultCharacterMesh();
          }
        })
        .catch(() => {
          if (directUrl && !directUrl.includes('?X-Amz-Signature=') && !directUrl.startsWith('blob:')) {
            tryLoadPlayerGlb(directUrl);
          } else {
            renderDefaultCharacterMesh();
          }
        });
    } else if (directUrl && !directUrl.includes('?X-Amz-Signature=') && !directUrl.startsWith('blob:')) {
      tryLoadPlayerGlb(directUrl);
    } else {
      renderDefaultCharacterMesh();
    }

    // Attach equipped accessories with their saved transforms to the player avatar
    if (Array.isArray(equippedAccessories) && equippedAccessories.length > 0) {
      equippedAccessories.forEach((acc: any) => {
        if (!acc || typeof acc !== 'object') return;
        if (!acc.equipped && !acc.isAccessory) return;
        const accGroup = new THREE.Group();
        const baseTrans: AccessoryTransform = acc.accessoryTransform || {
          position: [0.45, 1.45, 0.25],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        };
        const pos = baseTrans.position || [0.45, 1.45, 0.25];
        const rot = baseTrans.rotation || [0, 0, 0];
        const sca = baseTrans.scale || [1, 1, 1];
        accGroup.position.set(pos[0], pos[1], pos[2]);
        accGroup.rotation.set(rot[0], rot[1], rot[2]);
        accGroup.scale.set(sca[0], sca[1], sca[2]);

        if (acc.fileBlobUrl) {
          const accLoader = new GLTFLoader();
          accLoader.load(acc.fileBlobUrl, (accGltf) => {
            const accM = accGltf.scene;
            const accBox = new THREE.Box3().setFromObject(accM);
            const accSize = accBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(accSize.x, accSize.y, accSize.z, 0.05);
            const s = 0.45 / maxDim;
            accM.scale.set(s, s, s);
            accM.traverse((n) => {
              if ((n as THREE.Mesh).isMesh) {
                n.castShadow = true;
                n.receiveShadow = true;
                n.frustumCulled = false;
              }
            });
            accGroup.add(accM);
          });
        }
        playerGroup.add(accGroup);
      });
    }
  }, [activeUserAvatar, currentPose, customAvatarObject, equippedAccessories]);

  // Update spot visual style dynamically on config changes
  useEffect(() => {
    if (!spotAnimatedMeshesRef.current || spotAnimatedMeshesRef.current.length === 0) return;
    const style = spotVisualConfig?.indicatorStyle || 'full';
    const arrowScale = spotVisualConfig?.arrowScale || 1.0;
    const signalScale = spotVisualConfig?.signalScale || 1.0;
    const isWhitePulse = style === 'white_pulse';
    const isYellow = style === 'yellow_gold';
    const isArrowOnly = style === 'arrow_only';

    spotAnimatedMeshesRef.current.forEach((item) => {
      if (item.arrowMat) {
        item.arrowMat.color.setHex(isWhitePulse ? 0xffffff : 0xffd700);
      }
      if (item.outerRingMat) {
        item.outerRingMat.color.setHex(isWhitePulse ? 0xffffff : 0xffd700);
      }
      if (item.innerRingMat) {
        item.innerRingMat.color.setHex(isWhitePulse ? 0xffffff : 0xfff0a0);
      }
      if (item.arrowGroup) {
        item.arrowGroup.visible = isArrowOnly ? true : isYellow ? false : showSpotArrowsRef.current;
        item.arrowGroup.scale.set(arrowScale, arrowScale, arrowScale);
      }
      if (item.group) {
        item.group.children.forEach((child) => {
          if ((child as any).userData?.isSpotArrow) return;
          child.visible = !isArrowOnly;
          if ((child as THREE.Mesh).isMesh) {
            child.scale.set(signalScale, signalScale, signalScale);
          }
        });
      }
    });
  }, [spotVisualConfig]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden" ref={mountRef}>
      {/* Spot Click Targets Overlay */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
        {/* Helper overlay for spot clicks */}
      </div>
    </div>
  );
};

// Procedural stylized 3D avatar mesh builder matching the stylish figures in Reference 1
function createCharacterMesh(options: {
  skinColor: number;
  hairColor: number;
  clothColor: number;
  pantsColor: number;
  hasGlasses: boolean;
  hasGoldChain: boolean;
  hairStyle: 'female-long' | 'curly' | 'afro-short';
  currentPose?: string;
}) {
  const group = new THREE.Group();
  const poseName = (options.currentPose || 'Em pé').toLowerCase();
  const isSeated = poseName.includes('sentar');
  const isReclined = poseName.includes('deitar') || poseName.includes('reclinad');
  const isWaving = poseName.includes('acenar');
  const isLaughing = poseName.includes('rindo');
  const isModel = poseName.includes('modelo') || poseName.includes('noir');

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: options.skinColor,
    roughness: 0.6,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: options.hairColor,
    roughness: 0.8,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: options.clothColor,
    roughness: 0.7,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: options.pantsColor,
    roughness: 0.75,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // White clean sneakers matching reference
    roughness: 0.4,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.9,
    roughness: 0.2,
  });

  // Torso / Hoodie
  const torsoGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.45, 16);
  const torso = new THREE.Mesh(torsoGeo, clothMat);
  torso.position.y = 0.42;
  torso.castShadow = true;
  group.add(torso);

  // Hoodie collar / hood
  const hoodGeo = new THREE.TorusGeometry(0.16, 0.06, 12, 24);
  const hood = new THREE.Mesh(hoodGeo, clothMat);
  hood.rotation.x = Math.PI / 2.2;
  hood.position.set(0, 0.62, -0.04);
  group.add(hood);

  // Gold chain necklace (if equipped)
  if (options.hasGoldChain) {
    const chainGeo = new THREE.TorusGeometry(0.14, 0.018, 8, 24);
    const chain = new THREE.Mesh(chainGeo, goldMat);
    chain.rotation.x = Math.PI / 2.4;
    chain.position.set(0, 0.58, 0.05);
    group.add(chain);
  }

  // Head & Neck
  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.68;
  group.add(neck);

  const headGeo = new THREE.SphereGeometry(0.17, 24, 24);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.84, 0.02);
  head.castShadow = true;
  if (isLaughing) {
    head.rotation.z = 0.12;
    head.rotation.x = -0.05;
  }
  group.add(head);

  // Hair
  if (options.hairStyle === 'curly') {
    const hairGeo = new THREE.SphereGeometry(0.19, 16, 16);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.9, -0.02);
    group.add(hair);

    for (let i = -2; i <= 2; i++) {
      const curlGeo = new THREE.SphereGeometry(0.05, 8, 8);
      const curl = new THREE.Mesh(curlGeo, hairMat);
      curl.position.set(i * 0.05, 0.95, 0.12);
      group.add(curl);
    }
  } else if (options.hairStyle === 'female-long') {
    const topHairGeo = new THREE.SphereGeometry(0.185, 16, 16);
    const topHair = new THREE.Mesh(topHairGeo, hairMat);
    topHair.position.set(0, 0.88, -0.01);
    group.add(topHair);

    const backHairGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.45, 12);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 0.65, -0.1);
    group.add(backHair);
  } else {
    const afroGeo = new THREE.SphereGeometry(0.185, 16, 16);
    const afro = new THREE.Mesh(afroGeo, hairMat);
    afro.position.set(0, 0.88, 0);
    group.add(afro);
  }

  // Sunglasses / Glasses
  if (options.hasGlasses) {
    const glassesFrameMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.8,
      roughness: 0.2,
    });
    const glassesGeo = new THREE.BoxGeometry(0.24, 0.06, 0.05);
    const glasses = new THREE.Mesh(glassesGeo, glassesFrameMat);
    glasses.position.set(0, 0.85, 0.17);
    group.add(glasses);
  }

  // Posture Legs & Pelvis
  if (isSeated) {
    // Seated Cross-legged / Relaxed Legs on Pouf
    const pelvisGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.15, 16);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvis.position.y = 0.14;
    group.add(pelvis);

    const leftThighGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.35, 12);
    const leftThigh = new THREE.Mesh(leftThighGeo, pantsMat);
    leftThigh.rotation.set(Math.PI / 2.5, 0, -Math.PI / 4.5);
    leftThigh.position.set(-0.18, 0.12, 0.18);
    group.add(leftThigh);

    const leftShinGeo = new THREE.CylinderGeometry(0.075, 0.07, 0.34, 12);
    const leftShin = new THREE.Mesh(leftShinGeo, pantsMat);
    leftShin.rotation.set(0, 0, Math.PI / 2.3);
    leftShin.position.set(-0.08, 0.06, 0.32);
    group.add(leftShin);

    const rightThighGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.35, 12);
    const rightThigh = new THREE.Mesh(rightThighGeo, pantsMat);
    rightThigh.rotation.set(Math.PI / 2.5, 0, Math.PI / 4.5);
    rightThigh.position.set(0.18, 0.12, 0.18);
    group.add(rightThigh);

    const rightShinGeo = new THREE.CylinderGeometry(0.075, 0.07, 0.34, 12);
    const rightShin = new THREE.Mesh(rightShinGeo, pantsMat);
    rightShin.rotation.set(0, 0, -Math.PI / 2.3);
    rightShin.position.set(0.08, 0.06, 0.32);
    group.add(rightShin);

    const shoeLeftGeo = new THREE.BoxGeometry(0.1, 0.08, 0.18);
    const shoeLeft = new THREE.Mesh(shoeLeftGeo, shoeMat);
    shoeLeft.position.set(-0.25, 0.05, 0.35);
    group.add(shoeLeft);

    const shoeRight = new THREE.Mesh(shoeLeftGeo, shoeMat);
    shoeRight.position.set(0.25, 0.05, 0.35);
    group.add(shoeRight);
  } else if (isReclined) {
    // Reclined / Lying on lounge
    group.rotation.x = -Math.PI / 4.5;
    group.position.y -= 0.15;
    group.position.z -= 0.2;

    const pelvisGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.15, 16);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvis.position.y = 0.14;
    group.add(pelvis);

    const legGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.5, 12);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.1, -0.15, 0.08);
    legL.rotation.x = 0.2;
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.1, -0.15, 0.08);
    legR.rotation.x = 0.15;
    group.add(legR);

    const shoeLeftGeo = new THREE.BoxGeometry(0.1, 0.08, 0.18);
    const shoeL = new THREE.Mesh(shoeLeftGeo, shoeMat);
    shoeL.position.set(-0.1, -0.42, 0.12);
    group.add(shoeL);

    const shoeR = new THREE.Mesh(shoeLeftGeo, shoeMat);
    shoeR.position.set(0.1, -0.42, 0.12);
    group.add(shoeR);
  } else {
    // Standing legs (Em pé, Acenar, Rindo, Modelo Noir)
    const pelvisGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.16, 16);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvis.position.y = 0.22;
    group.add(pelvis);

    const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.44, 12);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.09, 0.0, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.09, 0.0, 0);
    group.add(rightLeg);

    const shoeLeftGeo = new THREE.BoxGeometry(0.1, 0.07, 0.18);
    const shoeLeft = new THREE.Mesh(shoeLeftGeo, shoeMat);
    shoeLeft.position.set(-0.09, -0.22, 0.03);
    group.add(shoeLeft);

    const shoeRight = new THREE.Mesh(shoeLeftGeo, shoeMat);
    shoeRight.position.set(0.09, -0.22, 0.03);
    group.add(shoeRight);
  }

  // Arms and Gestures
  const armLGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.32, 10);
  const armL = new THREE.Mesh(armLGeo, clothMat);
  const armRGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.32, 10);
  const armR = new THREE.Mesh(armRGeo, clothMat);

  if (isWaving) {
    // Right arm raised waving cordial greeting
    armR.rotation.set(-0.25, 0, -2.2);
    armR.position.set(0.26, 0.58, 0.05);
    armL.rotation.set(0.15, 0, 0.2);
    armL.position.set(-0.26, 0.38, 0.05);
  } else if (isLaughing) {
    // Hands playfully resting forward with laughter
    armL.rotation.set(0.5, 0, 0.35);
    armR.rotation.set(0.5, 0, -0.35);
    armL.position.set(-0.26, 0.36, 0.12);
    armR.position.set(0.26, 0.36, 0.12);
  } else if (isModel) {
    // Chic runway posture
    armL.rotation.set(-0.2, 0.2, 0.6);
    armL.position.set(-0.26, 0.38, 0.05);
    armR.rotation.set(0.1, 0, -0.2);
    armR.position.set(0.26, 0.36, 0.05);
    group.rotation.y = 0.2;
  } else if (isSeated) {
    armL.rotation.set(0.3, 0, 0.4);
    armL.position.set(-0.28, 0.36, 0.1);
    armR.rotation.set(0.3, 0, -0.4);
    armR.position.set(0.28, 0.36, 0.1);
  } else {
    // Default standing relaxed
    armL.rotation.set(0.15, 0, 0.15);
    armL.position.set(-0.26, 0.38, 0.02);
    armR.rotation.set(0.15, 0, -0.15);
    armR.position.set(0.26, 0.38, 0.02);
  }

  group.add(armL);
  group.add(armR);

  return group;
}
