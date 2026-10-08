import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CustomizationItem, ObjectAction, AccessoryTransform } from '../types';
import { getGlbFile, getAllGlbIds } from '../lib/storageIndexedDB';
import { extractAssetUuid, resolveAssetDownloadUrl } from '../lib/assetSyncClient';

const PEDESTAL_SURFACE_Y = 0.12;
const PEDESTAL_OBJECT_CLEARANCE = 0.06;

function alignObjectBottomToY(object: THREE.Object3D, targetY: number): void {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (!bounds.isEmpty() && bounds.min.y < targetY) {
    object.position.y += targetY - bounds.min.y;
  }
}

interface AvatarPedestal3DProps {
  currentPose: string; // 'Em pé' | 'Sentar' | 'Deitar' | 'Rindo' | 'Acenar' | 'Modelo Noir'
  equippedItems: CustomizationItem[];
  avatarModelUrl?: string;
  avatarAssetId?: string | null;
  isAvatarMissingAsset?: boolean;
  avatarName?: string;
  fineAdjustments: {
    panX: number;
    panY: number;
    rotationY: number;
    scale: number;
    elevationY: number;
  };
  onUpdateRotation?: (rotY: number) => void;
  onUpdateElevation?: (elevY: number) => void;
  onUpdateScale?: (scale: number) => void;
  onUpdatePan?: (x: number, y: number) => void;
  onRegisterSnapshotTaker?: (taker: () => string | null) => void;
  // Accessory positioning & Gizmo
  selectedItemToInspect?: CustomizationItem | null;
  selectedAccessoryId?: string | null;
  selectedAccessoryItem?: CustomizationItem | null;
  onSelectAccessory?: (id: string | null) => void;
  onUpdateAccessoryTransform?: (
    itemId: string,
    transform: AccessoryTransform
  ) => void;
  gizmoMode?: 'mover' | 'rodar' | 'escalar';
  activeAction?: ObjectAction | null;
  isPositionLocked?: boolean;
}

export function createMissingAssetMesh(itemName: string): THREE.Group {
  const group = new THREE.Group();
  group.name = '__missing_asset_placeholder__';

  // 1. Golden wireframe bounding box
  const boxGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const wireGeo = new THREE.WireframeGeometry(boxGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  wireframe.position.y = 0.52;
  group.add(wireframe);

  // 2. Alert beacon octahedron
  const coreGeo = new THREE.OctahedronGeometry(0.24);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    transparent: true,
    opacity: 0.8,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.52;
  group.add(core);

  // 3. Ground ring
  const ringGeo = new THREE.RingGeometry(0.42, 0.46, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  // 4. Text Label Sprite: "ARQUIVO 3D AUSENTE"
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(18, 19, 24, 0.95)';
    ctx.roundRect(10, 10, 492, 120, 18);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARQUIVO 3D AUSENTE', 256, 58);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '20px sans-serif';
    ctx.fillText(itemName.length > 28 ? itemName.slice(0, 28) + '...' : itemName, 256, 96);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.5, 0.42, 1);
  sprite.position.y = 1.25;
  group.add(sprite);

  return group;
}

export function createMissingAvatarPlaceholder(group: THREE.Group, avatarName: string) {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
  const placeholder = createMissingAssetMesh(avatarName);
  placeholder.position.y = 0.35;
  group.add(placeholder);
}

async function loadGlbWithIndexedDBFallback(
  url: string | undefined,
  itemId: string | undefined,
  originalItemId: string | undefined,
  onSuccess: (gltf: any) => void,
  onError: () => void,
  assetId?: string
) {
  const loader = new GLTFLoader();

  const tryLoad = (modelUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        loader.load(
          modelUrl,
          (gltf) => {
            onSuccess(gltf);
            resolve(true);
          },
          undefined,
          (err) => {
            console.warn('[Pedestal3D GLTFLoader warning]:', modelUrl, err);
            resolve(false);
          }
        );
      } catch (err) {
        resolve(false);
      }
    });
  };

  // 1. PRIORIDADE MÁXIMA: Se houver um UUID real (public.assets.id), resolve URL fresca assinada
  const validUuid =
    extractAssetUuid(assetId) ||
    extractAssetUuid(itemId) ||
    extractAssetUuid(originalItemId) ||
    extractAssetUuid(url);

  if (validUuid) {
    try {
      const freshDownloadUrl = await resolveAssetDownloadUrl(validUuid);
      if (freshDownloadUrl) {
        console.log(`[Pedestal3D] Carregando model.glb via URL resolvida para UUID ${validUuid}`);
        const ok = await tryLoad(freshDownloadUrl);
        if (ok) return;
      }
    } catch (e) {
      console.warn('[Pedestal3D] Erro ao resolver asset:', e);
    }
  }

  // 2. Se a URL fornecida for uma URL remota válida https:// (sem query expirada)
  if (
    url &&
    typeof url === 'string' &&
    url.startsWith('http') &&
    !url.includes('X-Amz-Signature') &&
    !url.includes('Expires=')
  ) {
    const ok = await tryLoad(url);
    if (ok) return;
  }

  // 3. Fallback para IndexedDB local (se houver cópia em cache local)
  if (itemId && !itemId.startsWith('blob:')) {
    try {
      const blob = await getGlbFile(itemId);
      if (blob) {
        const freshUrl = URL.createObjectURL(blob);
        const ok = await tryLoad(freshUrl);
        if (ok) return;
      }
    } catch (e) {}
  }

  if (originalItemId && !originalItemId.startsWith('blob:')) {
    try {
      const blob = await getGlbFile(originalItemId);
      if (blob) {
        const freshUrl = URL.createObjectURL(blob);
        const ok = await tryLoad(freshUrl);
        if (ok) return;
      }
    } catch (e) {}
  }

  // 4. Último recurso se ainda for blob e estiver vivo nesta aba
  if (url && url.startsWith('blob:')) {
    try {
      const testRes = await fetch(url).catch(() => null);
      if (testRes && testRes.ok) {
        const ok = await tryLoad(url);
        if (ok) return;
      }
    } catch (e) {}
  }

  // Falha na obtenção do arquivo 3D real
  onError();
}

export const AvatarPedestal3D: React.FC<AvatarPedestal3DProps> = ({
  currentPose,
  equippedItems,
  avatarModelUrl,
  avatarAssetId = null,
  isAvatarMissingAsset = false,
  avatarName = 'Noite de Gala',
  fineAdjustments,
  onUpdateRotation,
  onRegisterSnapshotTaker,
  selectedItemToInspect = null,
  selectedAccessoryId = null,
  selectedAccessoryItem = null,
  onSelectAccessory,
  onUpdateAccessoryTransform,
  gizmoMode = 'mover',
  activeAction = null,
  isPositionLocked = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const pedestalGroupRef = useRef<THREE.Group | null>(null);
  const isolatedGroupRef = useRef<THREE.Group | null>(null);
  const accessoryGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const transformControlsRef = useRef<TransformControls | null>(null);
  const isTransformDraggingRef = useRef(false);

  // Mouse interaction
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const internalRotationRef = useRef(fineAdjustments.rotationY);

  const selectedAccessoryIdRef = useRef(selectedAccessoryId);
  selectedAccessoryIdRef.current = selectedAccessoryId;

  const onUpdateAccessoryTransformRef = useRef(onUpdateAccessoryTransform);
  onUpdateAccessoryTransformRef.current = onUpdateAccessoryTransform;

  const gizmoModeRef = useRef(gizmoMode);
  gizmoModeRef.current = gizmoMode;

  const activeActionRef = useRef(activeAction);
  activeActionRef.current = activeAction;

  useEffect(() => {
    internalRotationRef.current = fineAdjustments.rotationY;
  }, [fineAdjustments.rotationY]);

  // Update TransformControls Gizmo mode
  useEffect(() => {
    if (transformControlsRef.current) {
      const mode = gizmoMode === 'rodar' ? 'rotate' : gizmoMode === 'escalar' ? 'scale' : 'translate';
      transformControlsRef.current.setMode(mode);
    }
  }, [gizmoMode]);

  // Main Scene & Renderer Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 650;

    // Scene setup with dark studio luxury backdrop
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0e);
    sceneRef.current = scene;

    // Camera setup with safe near/far to prevent any clipping/disappearing
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.01, 1000);
    camera.position.set(0, 1.45, 4.2);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    if (onRegisterSnapshotTaker) {
      onRegisterSnapshotTaker(() => {
        try {
          if (!rendererRef.current) return null;
          return rendererRef.current.domElement.toDataURL('image/png');
        } catch (err) {
          console.error('Failed to capture snapshot from WebGL canvas:', err);
          return null;
        }
      });
    }

    // Lighting (Dark Studio Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.6);
    keyLight.position.set(2.5, 4.5, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xddeeff, 1.1);
    rimLight.position.set(-2.5, 3.2, -2.8);
    scene.add(rimLight);

    const goldAccentLight = new THREE.PointLight(0xc5a059, 1.8, 5.0);
    goldAccentLight.position.set(0, 0.05, 0);
    scene.add(goldAccentLight);

    // PEDESTAL (Black Obsidian Cylindrical Podium)
    const pedestalGroup = new THREE.Group();
    pedestalGroupRef.current = pedestalGroup;

    const discGeo = new THREE.CylinderGeometry(1.28, 1.32, 0.12, 64);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x14151a,
      roughness: 0.22,
      metalness: 0.65,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.position.y = 0.06;
    discMesh.receiveShadow = true;
    pedestalGroup.add(discMesh);

    const goldRingGeo = new THREE.TorusGeometry(1.30, 0.022, 16, 64);
    const goldRingMat = new THREE.MeshStandardMaterial({
      color: 0xc5a059,
      roughness: 0.28,
      metalness: 0.9,
    });
    const goldRing = new THREE.Mesh(goldRingGeo, goldRingMat);
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.12;
    pedestalGroup.add(goldRing);

    const baseGeo = new THREE.CylinderGeometry(1.42, 1.48, 0.06, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0d0e12,
      roughness: 0.45,
      metalness: 0.4,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.01;
    baseMesh.receiveShadow = true;
    pedestalGroup.add(baseMesh);

    const floorGeo = new THREE.CircleGeometry(2.2, 48);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x050608,
      transparent: true,
      opacity: 0.85,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.042;
    pedestalGroup.add(floorMesh);

    scene.add(pedestalGroup);

    // GROUPS
    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;
    scene.add(avatarGroup);

    const isolatedGroup = new THREE.Group();
    isolatedGroupRef.current = isolatedGroup;
    scene.add(isolatedGroup);

    // TransformControls Gizmo for positioning accessories on the avatar
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.75;
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event: any) => {
      isTransformDraggingRef.current = Boolean(event.value);
      if (event.value) {
        isDraggingRef.current = false;
      }
    });

    transformControls.addEventListener('change', () => {
      if (isTransformDraggingRef.current && selectedAccessoryIdRef.current) {
        const accId = selectedAccessoryIdRef.current;
        const targetGroup = accessoryGroupsRef.current.get(accId);
        if (targetGroup && onUpdateAccessoryTransformRef.current) {
          const pos: [number, number, number] = [
            parseFloat(targetGroup.position.x.toFixed(3)),
            parseFloat(targetGroup.position.y.toFixed(3)),
            parseFloat(targetGroup.position.z.toFixed(3)),
          ];
          const rot: [number, number, number] = [
            parseFloat(targetGroup.rotation.x.toFixed(3)),
            parseFloat(targetGroup.rotation.y.toFixed(3)),
            parseFloat(targetGroup.rotation.z.toFixed(3)),
          ];
          const scl: [number, number, number] = [
            parseFloat(targetGroup.scale.x.toFixed(3)),
            parseFloat(targetGroup.scale.y.toFixed(3)),
            parseFloat(targetGroup.scale.z.toFixed(3)),
          ];
          onUpdateAccessoryTransformRef.current(accId, {
            position: pos,
            rotation: rot,
            scale: scl,
          });
        }
      }
    });

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop with Action Trajectory Simulation
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;

      if (avatarGroupRef.current) {
        avatarGroupRef.current.rotation.y = internalRotationRef.current;
        avatarGroupRef.current.position.set(
          fineAdjustments.panX,
          PEDESTAL_SURFACE_Y + PEDESTAL_OBJECT_CLEARANCE + fineAdjustments.elevationY,
          fineAdjustments.panY
        );
        const s = fineAdjustments.scale;
        avatarGroupRef.current.scale.set(s, s, s);
      }

      // If viewing isolated item on the pedestal, rotate slowly
      if (isolatedGroupRef.current && isolatedGroupRef.current.children.length > 0) {
        isolatedGroupRef.current.rotation.y = internalRotationRef.current + time * 0.15;
      }

      // Action Animation execution on the active accessory or inspected object
      const currAction = activeActionRef.current;
      if (currAction && currAction.motion && !isTransformDraggingRef.current) {
        const cfg = currAction.motion;
        const spd = cfg.speed || 1.0;
        const phase = (time * spd * 2.0) % (Math.PI * 2);
        const factor = cfg.loop ? (1 - Math.cos(phase)) / 2 : (time * spd) % 1.0;

        let posX = (cfg.deltaPosition?.[0] || 0) * factor;
        let posY = (cfg.deltaPosition?.[1] || 0) * factor;
        let posZ = (cfg.deltaPosition?.[2] || 0) * factor;

        const traj = cfg.curveTrajectory || 'linear';
        if (traj === 'arc') {
          const h = cfg.curveHeight !== undefined ? cfg.curveHeight : 1.2;
          posY += 4 * h * factor * (1 - factor);
        } else if (traj === 'circle_turn') {
          const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
          const rad = THREE.MathUtils.degToRad(turnDeg * factor);
          const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 1.2;
          posX = radius * Math.sin(rad);
          posZ = radius * (1 - Math.cos(rad));
        } else if (traj === 'spiral') {
          const turnDeg = cfg.turnAngle !== undefined ? cfg.turnAngle : 360;
          const rad = THREE.MathUtils.degToRad(turnDeg * factor);
          const radius = cfg.curveRadius !== undefined ? cfg.curveRadius : 0.8;
          posX = radius * Math.cos(rad);
          posZ = radius * Math.sin(rad);
          posY += factor * 0.5;
        } else if (traj === 'wave') {
          posY += Math.sin(factor * Math.PI * 4) * 0.25;
        }

        const rx = THREE.MathUtils.degToRad((cfg.deltaRotation?.[0] || 0) * factor);
        const ry = THREE.MathUtils.degToRad((cfg.turnAngle || cfg.deltaRotation?.[1] || 0) * factor);
        const rz = THREE.MathUtils.degToRad((cfg.deltaRotation?.[2] || 0) * factor);

        const scaleVal = cfg.scaleFactor !== undefined
          ? 1.0 + factor * (cfg.scaleFactor - 1.0)
          : 1.0;

        // Apply action trajectory to selected accessory
        if (selectedAccessoryIdRef.current) {
          const accGroup = accessoryGroupsRef.current.get(selectedAccessoryIdRef.current);
          if (accGroup && (accGroup as any)._baseTransform) {
            const bt = (accGroup as any)._baseTransform;
            accGroup.position.set(
              bt.position[0] + posX,
              bt.position[1] + posY,
              bt.position[2] + posZ
            );
            accGroup.rotation.set(
              bt.rotation[0] + rx,
              bt.rotation[1] + ry,
              bt.rotation[2] + rz
            );
            accGroup.scale.set(
              bt.scale[0] * scaleVal,
              bt.scale[1] * scaleVal,
              bt.scale[2] * scaleVal
            );
          }
        } else {
          const isolatedItem = isolatedGroupRef.current?.children[0];
          const baseTransform = isolatedItem?.userData.baseTransform;
          if (isolatedItem && baseTransform) {
            isolatedItem.position.set(
              baseTransform.position[0] + posX,
              baseTransform.position[1] + posY,
              baseTransform.position[2] + posZ
            );
            isolatedItem.rotation.set(
              baseTransform.rotation[0] + rx,
              baseTransform.rotation[1] + ry,
              baseTransform.rotation[2] + rz
            );
            isolatedItem.scale.set(
              baseTransform.scale[0] * scaleVal,
              baseTransform.scale[1] * scaleVal,
              baseTransform.scale[2] * scaleVal
            );
            alignObjectBottomToY(isolatedItem, PEDESTAL_SURFACE_Y + PEDESTAL_OBJECT_CLEARANCE);
          } else if (avatarGroupRef.current) {
            const avatarScale = fineAdjustments.scale * scaleVal;
            avatarGroupRef.current.position.set(
              fineAdjustments.panX + posX,
              PEDESTAL_SURFACE_Y + PEDESTAL_OBJECT_CLEARANCE + fineAdjustments.elevationY + posY,
              fineAdjustments.panY + posZ
            );
            avatarGroupRef.current.rotation.set(rx, internalRotationRef.current + ry, rz);
            avatarGroupRef.current.scale.set(avatarScale, avatarScale, avatarScale);
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Mouse Drag for Orbit Rotation
    const onMouseDown = (e: MouseEvent) => {
      if (isTransformDraggingRef.current) return;
      if (transformControlsRef.current && transformControlsRef.current.axis !== null) {
        return;
      }
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || isTransformDraggingRef.current) return;
      const deltaX = e.clientX - prevMouseRef.current.x;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      const newRot = internalRotationRef.current + deltaX * 0.012;
      internalRotationRef.current = newRot;
      if (onUpdateRotation) {
        onUpdateRotation(newRot);
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      cameraRef.current.position.z = THREE.MathUtils.clamp(
        cameraRef.current.position.z + e.deltaY * 0.003,
        2.0,
        7.0
      );
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
      renderer.dispose();
    };
  }, []);

  // UPDATE SCENE: Either ISOLATED ITEM or AVATAR WITH ACCESSORIES
  useEffect(() => {
    const avatarGroup = avatarGroupRef.current;
    const isolatedGroup = isolatedGroupRef.current;
    const transformControls = transformControlsRef.current;
    if (!avatarGroup || !isolatedGroup) return;

    // Detach Gizmo while rebuilding
    if (transformControls) transformControls.detach();

    // Clear previous children cleanly
    while (avatarGroup.children.length > 0) {
      avatarGroup.remove(avatarGroup.children[0]);
    }
    while (isolatedGroup.children.length > 0) {
      isolatedGroup.remove(isolatedGroup.children[0]);
    }
    accessoryGroupsRef.current.clear();

    // Helper to synchronize Gizmo attachment
    const syncGizmo = () => {
      const tc = transformControlsRef.current;
      if (!tc) return;

      if (isPositionLocked) {
        tc.detach();
        if (tc.getHelper()) tc.getHelper().visible = false;
        return;
      }

      if (selectedAccessoryId) {
        const accGroup = accessoryGroupsRef.current.get(selectedAccessoryId);
        if (accGroup) {
          accGroup.updateMatrixWorld(true);
          tc.attach(accGroup);
          tc.enabled = true;
          const mode = gizmoMode === 'rodar' ? 'rotate' : gizmoMode === 'escalar' ? 'scale' : 'translate';
          tc.setMode(mode);
          tc.size = 0.85;
          if (tc.getHelper()) tc.getHelper().visible = true;
          return;
        }
      } else if (selectedItemToInspect && isolatedGroupRef.current && isolatedGroupRef.current.children.length > 0) {
        const target = isolatedGroupRef.current.children[0];
        if (target) {
          target.updateMatrixWorld(true);
          tc.attach(target);
          tc.enabled = true;
          const mode = gizmoMode === 'rodar' ? 'rotate' : gizmoMode === 'escalar' ? 'scale' : 'translate';
          tc.setMode(mode);
          tc.size = 0.85;
          if (tc.getHelper()) tc.getHelper().visible = true;
          return;
        }
      }

      tc.detach();
      if (tc.getHelper()) tc.getHelper().visible = false;
    };

    // CASE 1: ISOLATED ITEM INSPECTION
    const isIsolatedItem =
      selectedItemToInspect &&
      !selectedItemToInspect.isAccessory &&
      selectedItemToInspect.category !== 'acessorios' &&
      !selectedItemToInspect.isAvatar &&
      selectedItemToInspect.category !== 'avatares';

    if (isIsolatedItem) {
      avatarGroup.visible = false;
      isolatedGroup.visible = true;

      const itemAssetUuid = extractAssetUuid(
        (selectedItemToInspect as any).assetId ||
        selectedItemToInspect.originalItemId ||
        selectedItemToInspect.id ||
        selectedItemToInspect.fileBlobUrl
      );

      if (selectedItemToInspect.isMissingAsset || (!itemAssetUuid && !selectedItemToInspect.fileBlobUrl)) {
        const missingMesh = createMissingAssetMesh(selectedItemToInspect.name);
        alignObjectBottomToY(missingMesh, PEDESTAL_SURFACE_Y + PEDESTAL_OBJECT_CLEARANCE);
        missingMesh.userData.baseTransform = {
          position: missingMesh.position.toArray(),
          rotation: missingMesh.rotation.toArray(),
          scale: missingMesh.scale.toArray(),
        };
        isolatedGroup.add(missingMesh);
        syncGizmo();
        return;
      }

      loadGlbWithIndexedDBFallback(
        selectedItemToInspect.fileBlobUrl,
        selectedItemToInspect.id,
        selectedItemToInspect.originalItemId,
        (gltf) => {
          const m = gltf.scene;
          const box = new THREE.Box3().setFromObject(m);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.1);
          const s = 1.3 / maxDim;
          m.scale.set(s, s, s);

          const scaledBox = new THREE.Box3().setFromObject(m);
          const center = scaledBox.getCenter(new THREE.Vector3());
          m.position.x = -center.x;
          m.position.z = -center.z;
          m.position.y = PEDESTAL_SURFACE_Y + PEDESTAL_OBJECT_CLEARANCE - scaledBox.min.y;

          m.traverse((node: any) => {
            if ((node as THREE.Mesh).isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              node.frustumCulled = false;
            }
          });
          m.userData.baseTransform = {
            position: m.position.toArray(),
            rotation: m.rotation.toArray(),
            scale: m.scale.toArray(),
          };
          isolatedGroup.add(m);
          syncGizmo();
        },
        () => {
          // Arquivo ausente ou erro no download: mostra marcador de arquivo ausente, sem simular objeto falso
          const missingMesh = createMissingAssetMesh(selectedItemToInspect.name);
          alignObjectBottomToY(missingMesh, PEDESTAL_SURFACE_Y + PEDESTAL_OBJECT_CLEARANCE);
          missingMesh.userData.baseTransform = {
            position: missingMesh.position.toArray(),
            rotation: missingMesh.rotation.toArray(),
            scale: missingMesh.scale.toArray(),
          };
          isolatedGroup.add(missingMesh);
          syncGizmo();
        },
        itemAssetUuid || undefined
      );
      return;
    }

    // CASE 2: AVATAR VIEW WITH EQUIPPED ACCESSORIES
    avatarGroup.visible = true;
    isolatedGroup.visible = false;

    // Helper to attach accessories to avatar
    const attachAccessories = (root: THREE.Group) => {
      const accessoriesMap = new Map<string, CustomizationItem>();
      equippedItems.forEach((i) => {
        if (i.isAccessory || i.category === 'acessorios' || i.equipped || i.id === selectedAccessoryId) {
          accessoriesMap.set(i.id, i);
        }
      });
      if (selectedAccessoryItem) {
        accessoriesMap.set(selectedAccessoryItem.id, selectedAccessoryItem);
      }
      const accessories = Array.from(accessoriesMap.values());

      accessories.forEach((acc) => {
        const accGroup = new THREE.Group();
        const baseTrans: AccessoryTransform = acc.accessoryTransform || {
          position: getDefaultAttachmentOffset(acc.accessoryAttachment),
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        };

        accGroup.position.set(...baseTrans.position);
        accGroup.rotation.set(...baseTrans.rotation);
        accGroup.scale.set(...baseTrans.scale);
        (accGroup as any)._baseTransform = baseTrans;
        (accGroup as any).userData = { accessoryId: acc.id };

        accessoryGroupsRef.current.set(acc.id, accGroup);
        root.add(accGroup);

        // Immediate visual marker so gizmo and preview are active with zero delay
        const tempPlaceholder = new THREE.Group();
        tempPlaceholder.name = '__temp_placeholder__';
        const ringGeo = new THREE.TorusGeometry(0.12, 0.02, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, wireframe: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        tempPlaceholder.add(ring);
        accGroup.add(tempPlaceholder);

        // Instant gizmo attachment if this is the active accessory
        if (acc.id === selectedAccessoryId) {
          syncGizmo();
        }

        const accAssetUuid = extractAssetUuid((acc as any).assetId || acc.originalItemId || acc.id || acc.fileBlobUrl);

        loadGlbWithIndexedDBFallback(
          acc.fileBlobUrl,
          acc.id,
          acc.originalItemId,
          (gltf) => {
            const temp = accGroup.getObjectByName('__temp_placeholder__');
            if (temp) accGroup.remove(temp);

            const m = gltf.scene;
            const box = new THREE.Box3().setFromObject(m);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z, 0.05);
            const s = 0.45 / maxDim;
            m.scale.set(s, s, s);

            m.traverse((n: any) => {
              if ((n as THREE.Mesh).isMesh) {
                n.castShadow = true;
                n.receiveShadow = true;
                n.frustumCulled = false;
              }
            });
            accGroup.add(m);
            syncGizmo();
          },
          () => {
            const temp = accGroup.getObjectByName('__temp_placeholder__');
            if (temp) accGroup.remove(temp);

            if (acc.isMissingAsset || !accAssetUuid) {
              const missingAcc = createMissingAssetMesh(acc.name);
              missingAcc.scale.set(0.35, 0.35, 0.35);
              accGroup.add(missingAcc);
            } else {
              const proceduralAcc = createProceduralAccessory(acc);
              accGroup.add(proceduralAcc);
            }
            syncGizmo();
          },
          accAssetUuid || undefined
        );
      });
    };

    const effectiveAvatarAssetId = extractAssetUuid(
      avatarAssetId ||
      avatarModelUrl
    );

    const isSystemDefaultAvatar =
      !avatarAssetId &&
      !avatarModelUrl &&
      (!avatarName || avatarName.toLowerCase().includes('luzenne') || avatarName.toLowerCase().includes('default'));

    // Se o avatar está explicitamente sem asset_id ou com arquivo ausente, não finge manequim calado!
    if (isAvatarMissingAsset || (!effectiveAvatarAssetId && !avatarModelUrl && !isSystemDefaultAvatar)) {
      createMissingAvatarPlaceholder(avatarGroup, avatarName);
      attachAccessories(avatarGroup);
      return;
    }

    if (effectiveAvatarAssetId || avatarModelUrl) {
      loadGlbWithIndexedDBFallback(
        avatarModelUrl,
        effectiveAvatarAssetId || undefined,
        effectiveAvatarAssetId || undefined,
        (gltf) => {
          const customModel = gltf.scene;
          const box = new THREE.Box3().setFromObject(customModel);
          const size = box.getSize(new THREE.Vector3());
          const targetHeight = 1.75;
          const s = targetHeight / Math.max(0.1, size.y);
          customModel.scale.set(s, s, s);

          const scaledBox = new THREE.Box3().setFromObject(customModel);
          const center = scaledBox.getCenter(new THREE.Vector3());
          customModel.position.x = -center.x;
          customModel.position.z = -center.z;
          customModel.position.y = PEDESTAL_SURFACE_Y - scaledBox.min.y;

          // Apply posture adjustments according to currentPose
          const poseLower = (currentPose || '').toLowerCase();
          if (poseLower.includes('sentar')) {
            customModel.position.y -= 0.38;
          } else if (poseLower.includes('deitar') || poseLower.includes('reclinad')) {
            customModel.rotation.x = -Math.PI / 4.2;
            customModel.position.y -= 0.25;
            customModel.position.z -= 0.2;
          } else if (poseLower.includes('acenar')) {
            customModel.rotation.z = -0.06;
            customModel.rotation.y = 0.12;
          } else if (poseLower.includes('rindo')) {
            customModel.rotation.x = 0.1;
            customModel.rotation.z = -0.03;
          } else if (poseLower.includes('modelo') || poseLower.includes('noir')) {
            customModel.rotation.y = 0.25;
            customModel.rotation.z = 0.04;
          }

          alignObjectBottomToY(customModel, 0);

          customModel.traverse((node: any) => {
            if ((node as THREE.Mesh).isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              node.frustumCulled = false; // Prevent mesh disappearing!
            }
          });

          avatarGroup.add(customModel);
          attachAccessories(avatarGroup);
        },
        () => {
          console.warn('[Pedestal3D] Could not load custom avatar GLB model:', avatarName);
          // Arquivo ausente ou URL expirada sem asset_id: mostra indicador de arquivo ausente
          createMissingAvatarPlaceholder(avatarGroup, avatarName);
          attachAccessories(avatarGroup);
        },
        effectiveAvatarAssetId || undefined
      );
      return;
    }

    // Default base procedural avatar (apenas para o manequim inicial do sistema)
    const baseModel = buildBaseProceduralAvatar(currentPose, equippedItems);
    alignObjectBottomToY(baseModel, 0);
    avatarGroup.add(baseModel);
    attachAccessories(avatarGroup);
  }, [
    currentPose,
    equippedItems,
    avatarModelUrl,
    avatarAssetId,
    isAvatarMissingAsset,
    avatarName,
    selectedItemToInspect,
    selectedAccessoryId,
    selectedAccessoryItem,
    isPositionLocked,
    gizmoMode,
  ]);

  // Synchronize TransformControls attachment whenever selection or gizmo mode changes
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;

    if (isPositionLocked) {
      tc.detach();
      if (tc.getHelper()) tc.getHelper().visible = false;
      return;
    }

    if (selectedAccessoryId) {
      const accGroup = accessoryGroupsRef.current.get(selectedAccessoryId);
      if (accGroup) {
        accGroup.updateMatrixWorld(true);
        if (tc.object !== accGroup) {
          tc.attach(accGroup);
        }
        tc.enabled = true;
        const mode = gizmoMode === 'rodar' ? 'rotate' : gizmoMode === 'escalar' ? 'scale' : 'translate';
        tc.setMode(mode);
        tc.size = 0.95;
        if (tc.getHelper()) tc.getHelper().visible = true;
        return;
      }
    } else if (selectedItemToInspect && isolatedGroupRef.current && isolatedGroupRef.current.children.length > 0) {
      const target = isolatedGroupRef.current.children[0];
      if (target) {
        target.updateMatrixWorld(true);
        if (tc.object !== target) {
          tc.attach(target);
        }
        tc.enabled = true;
        const mode = gizmoMode === 'rodar' ? 'rotate' : gizmoMode === 'escalar' ? 'scale' : 'translate';
        tc.setMode(mode);
        tc.size = 0.95;
        if (tc.getHelper()) tc.getHelper().visible = true;
        return;
      }
    }

    tc.detach();
    if (tc.getHelper()) tc.getHelper().visible = false;
  }, [selectedAccessoryId, selectedAccessoryItem, selectedItemToInspect, isPositionLocked, gizmoMode, equippedItems]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[460px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden"
    >
      {/* 3D Drag Hint */}
      <div className="absolute top-4 right-4 pointer-events-none text-[11px] text-zinc-400 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-1.5">
        <span>Girar 360°</span>
        {selectedAccessoryId && !isPositionLocked && (
          <span className="text-[#ffd700] font-bold">| Gizmo Acessório Ativo</span>
        )}
        {isPositionLocked && (
          <span className="text-emerald-400 font-bold">| Posição Travada 🔒</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// HELPER PROCEDURAL 3D MESH GENERATORS
// ============================================================================

function getDefaultAttachmentOffset(attachment?: string): [number, number, number] {
  switch (attachment) {
    case 'head':
      return [0, 1.72, 0];
    case 'chest':
      return [0, 1.35, 0.12];
    case 'left_hand':
      return [-0.26, 0.88, 0];
    case 'right_hand':
      return [0.26, 0.88, 0];
    case 'back':
      return [0, 1.35, -0.16];
    case 'companion_float':
    default:
      // Orbiting / floating companion drone next to avatar shoulder
      return [0.52, 1.48, 0.25];
  }
}

function createProceduralAccessory(item: CustomizationItem): THREE.Group {
  const group = new THREE.Group();
  const name = item.name.toLowerCase();
  const attachment = item.accessoryAttachment;

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.85,
  });
  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x141518,
    roughness: 0.4,
    metalness: 0.5,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 0.6,
  });

  if (name.includes('drone') || attachment === 'companion_float') {
    // High-tech Quad-Rotor Drone Companion
    const coreGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const core = new THREE.Mesh(coreGeo, blackMat);
    group.add(core);

    const ringGeo = new THREE.TorusGeometry(0.12, 0.015, 12, 32);
    const ring = new THREE.Mesh(ringGeo, glowMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // 4 rotor arms
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const armGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.14);
      const arm = new THREE.Mesh(armGeo, goldMat);
      arm.position.set(Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = angle;
      group.add(arm);

      // Micro propeller disc
      const propGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.005, 16);
      const prop = new THREE.Mesh(propGeo, blackMat);
      prop.position.set(Math.cos(angle) * 0.18, 0.02, Math.sin(angle) * 0.18);
      group.add(prop);
    }
  } else if (name.includes('relogio') || name.includes('pulseira') || attachment === 'left_hand' || attachment === 'right_hand') {
    // Luxury Watch
    const strapGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.04, 24);
    const strap = new THREE.Mesh(strapGeo, blackMat);
    group.add(strap);

    const dialGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.01, 24);
    const dial = new THREE.Mesh(dialGeo, goldMat);
    dial.position.set(0, 0, 0.045);
    dial.rotation.x = Math.PI / 2;
    group.add(dial);
  } else if (name.includes('chapeu') || name.includes('beret') || name.includes('fedora') || attachment === 'head') {
    // Hat
    const crownGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.12, 32);
    const crown = new THREE.Mesh(crownGeo, blackMat);
    group.add(crown);

    const brimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.015, 32);
    const brim = new THREE.Mesh(brimGeo, goldMat);
    brim.position.y = -0.055;
    group.add(brim);
  } else if (name.includes('oculos') || name.includes('glasses')) {
    // Sunglasses / Cyber Visor
    const visorGeo = new THREE.BoxGeometry(0.16, 0.035, 0.02);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    group.add(visor);
  } else {
    // Generic Luxury Artifact
    const orbGeo = new THREE.DodecahedronGeometry(0.08, 0);
    const orb = new THREE.Mesh(orbGeo, goldMat);
    group.add(orb);
  }

  group.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.frustumCulled = false;
    }
  });

  return group;
}

function createDecorativeObjectMesh(name: string): THREE.Group {
  const group = new THREE.Group();
  const lower = name.toLowerCase();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.85,
  });
  const darkVelvetMat = new THREE.MeshStandardMaterial({
    color: 0x1b1c22,
    roughness: 0.7,
    metalness: 0.1,
  });

  if (lower.includes('sofa') || lower.includes('poltrona')) {
    const seatGeo = new THREE.BoxGeometry(1.6, 0.35, 0.8);
    const seat = new THREE.Mesh(seatGeo, darkVelvetMat);
    seat.position.y = 0.24;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(1.6, 0.55, 0.22);
    const back = new THREE.Mesh(backGeo, darkVelvetMat);
    back.position.set(0, 0.55, -0.3);
    group.add(back);

    const trimGeo = new THREE.BoxGeometry(1.64, 0.04, 0.84);
    const trim = new THREE.Mesh(trimGeo, goldMat);
    trim.position.y = 0.08;
    group.add(trim);
  } else if (lower.includes('mesa') || lower.includes('table')) {
    const topGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 32);
    const top = new THREE.Mesh(topGeo, darkVelvetMat);
    top.position.y = 0.65;
    group.add(top);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.65, 16);
    const leg = new THREE.Mesh(legGeo, goldMat);
    leg.position.y = 0.325;
    group.add(leg);

    const baseGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.03, 32);
    const base = new THREE.Mesh(baseGeo, goldMat);
    base.position.y = 0.015;
    group.add(base);
  } else {
    // Sleek geometric sculpture
    const torusGeo = new THREE.TorusKnotGeometry(0.32, 0.08, 64, 16);
    const sculpture = new THREE.Mesh(torusGeo, goldMat);
    sculpture.position.y = 0.65;
    group.add(sculpture);

    const pedestalGeo = new THREE.BoxGeometry(0.4, 0.25, 0.4);
    const ped = new THREE.Mesh(pedestalGeo, darkVelvetMat);
    ped.position.y = 0.125;
    group.add(ped);
  }

  group.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.frustumCulled = false;
    }
  });

  return group;
}

function buildBaseProceduralAvatar(
  currentPose: string,
  equippedItems: CustomizationItem[]
): THREE.Group {
  const modelRoot = new THREE.Group();

  const poseLower = (currentPose || '').toLowerCase();
  const isSeated = poseLower.includes('sentar');
  const isReclined = poseLower.includes('deitar') || poseLower.includes('reclinad');
  const isLaughing = poseLower.includes('rindo');
  const isWaving = poseLower.includes('acenar');
  const isModelPose = poseLower.includes('modelo') || poseLower.includes('noir');

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf5cfb3,
    roughness: 0.55,
    metalness: 0.05,
  });
  const darkHairMat = new THREE.MeshStandardMaterial({
    color: 0x181310,
    roughness: 0.85,
    metalness: 0.1,
  });
  const blackFabricMat = new THREE.MeshStandardMaterial({
    color: 0x16171b,
    roughness: 0.72,
    metalness: 0.15,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.35,
    metalness: 0.35,
  });

  if (isSeated) {
    modelRoot.position.y = -0.38;
  } else if (isReclined) {
    modelRoot.rotation.x = -Math.PI / 4;
    modelRoot.position.y = -0.25;
    modelRoot.position.z = -0.2;
  }

  // Head & Neck
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.64, 0);

  const neckGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.16, 24);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.y = -0.06;
  headGroup.add(neckMesh);

  const collarGeo = new THREE.CylinderGeometry(0.075, 0.088, 0.12, 24);
  const collarMesh = new THREE.Mesh(collarGeo, blackFabricMat);
  collarMesh.position.y = -0.05;
  headGroup.add(collarMesh);

  const headGeo = new THREE.SphereGeometry(0.125, 24, 24);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.scale.set(0.9, 1.1, 0.95);
  headGroup.add(headMesh);

  const hairGeo = new THREE.SphereGeometry(0.135, 24, 24);
  const hairMesh = new THREE.Mesh(hairGeo, darkHairMat);
  hairMesh.scale.set(0.95, 1.05, 1.02);
  hairMesh.position.set(0, 0.04, -0.02);
  headGroup.add(hairMesh);

  modelRoot.add(headGroup);

  // Torso
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.25, 0);

  const jacketGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.50, 24);
  const jacketMesh = new THREE.Mesh(jacketGeo, leatherMat);
  torsoGroup.add(jacketMesh);
  modelRoot.add(torsoGroup);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.21, 1.42, 0);
  const armGeo = new THREE.CylinderGeometry(0.05, 0.042, 0.56, 16);
  const leftArmMesh = new THREE.Mesh(armGeo, blackFabricMat);
  leftArmMesh.position.y = -0.26;
  leftArm.add(leftArmMesh);
  modelRoot.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.21, 1.42, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, blackFabricMat);
  rightArmMesh.position.y = -0.26;
  rightArm.add(rightArmMesh);

  if (isWaving) {
    rightArm.rotation.z = -2.2;
    rightArm.rotation.x = -0.3;
  } else if (isLaughing) {
    leftArm.rotation.x = 0.5;
    rightArm.rotation.x = 0.8;
  } else if (isModelPose) {
    leftArm.rotation.z = 0.35;
    rightArm.rotation.z = -0.45;
  } else {
    leftArm.rotation.z = 0.12;
    rightArm.rotation.z = -0.12;
  }
  modelRoot.add(rightArm);

  // Legs
  const legsGroup = new THREE.Group();
  legsGroup.position.set(0, 0.95, 0);

  const legGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.82, 16);
  const leftLegMesh = new THREE.Mesh(legGeo, blackFabricMat);
  leftLegMesh.position.set(-0.09, -0.41, 0);
  legsGroup.add(leftLegMesh);

  const rightLegMesh = new THREE.Mesh(legGeo, blackFabricMat);
  rightLegMesh.position.set(0.09, -0.41, 0);
  legsGroup.add(rightLegMesh);

  if (isSeated) {
    legsGroup.rotation.x = Math.PI / 2.2;
    legsGroup.position.y = 0.55;
  }
  modelRoot.add(legsGroup);

  modelRoot.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.frustumCulled = false;
    }
  });

  return modelRoot;
}
