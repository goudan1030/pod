import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PackagingState } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface SceneProps {
  config: PackagingState;
  onModelClick?: () => void;
}

// Optimize CustomModel: Reuses material to avoid shader recompilation
export const CustomModel: React.FC<{ url: string; config: PackagingState; materialProps: any; onHover: (v: boolean) => void; onClick?: () => void; customParts?: any }> = ({ url, config, materialProps, onHover, onClick, customParts }) => {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone();

    // Apply hidden meshes logic immediately on clone
    if (config.hiddenMeshes && config.hiddenMeshes.length > 0) {
      c.traverse((child) => {
        if (child.name && config.hiddenMeshes?.includes(child.name)) {
          child.visible = false;
        }
      });
    }

    // 强制执行深度更新以确保 Box3 计算精确
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    // 设定目标标准尺寸为 1.5 单位 (人台标准尺寸约为 1.8-2.0)
    const targetSize = 1.5;
    const scale = targetSize / (maxDim || 1);

    c.scale.setScalar(scale);
    // 重置位置，使模型中心位于场景中心 (0, 0, 0)
    c.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    return c;
  }, [scene]);

  // 为custom模型创建部件纹理映射
  const partTextures = useMemo(() => {
    if (!materialProps.map || !customParts) return null;

    const createPartTexture = (uOff: number, vOff: number, uRep: number, vRep: number) => {
      const t = materialProps.map.clone();
      t.matrixAutoUpdate = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = true;
      t.repeat.set(uRep, vRep);
      t.offset.set(uOff, vOff);
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.updateMatrix();
      return t;
    };

    // Standard 35/35/30 Mapping Proportions (Synced with TextureEditor)
    const accW = 0.30; // Accessories width
    return {
      front: createPartTexture(0, 0, 0.35, 1),
      back: createPartTexture(0.35, 0, 0.35, 1),
      sleeve_left: createPartTexture(0.70, 0.66, accW, 0.34),
      sleeve_right: createPartTexture(0.70, 0.33, accW, 0.33),
      collar: createPartTexture(0.70, 0, accW, 0.33)
    };
  }, [materialProps.map, customParts]);

  // Apply material to meshes with part-specific textures
  useEffect(() => {
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const meshName = mesh.name.toLowerCase();

        // 创建新材质
        const mat = new THREE.MeshPhysicalMaterial({
          color: materialProps.color,
          roughness: materialProps.roughness,
          metalness: materialProps.metalness,
          sheen: materialProps.sheen,
          sheenColor: materialProps.sheenColor || new THREE.Color('#ffffff'),
          clearcoat: materialProps.clearcoat,
          side: materialProps.side,
          emissive: materialProps.emissive,
          emissiveIntensity: materialProps.emissiveIntensity,
        });

        // Check for specific part keywords using a more robust approach
        const fullSearchName = (mesh.name + " " + (mesh.parent?.name || "")).toLowerCase();
        const isPart = (keywords: string[]) => keywords.some(k => fullSearchName.includes(k.toLowerCase()));

        // Use bounding box to help with L/R detection if name is ambiguous
        const meshBox = new THREE.Box3().setFromObject(mesh);
        const meshCenter = meshBox.getCenter(new THREE.Vector3());

        // Standard L/R detection using keywords + spatial fallback (X+ is Left, X- is Right)
        const isLeft = isPart(['left', 'sleeve_l', '左', '_l', '.l']) || (!isPart(['right', '右', '_r', '.r']) && meshCenter.x > 0.1);
        const isRight = isPart(['right', 'sleeve_r', '右', '_r', '.r']) || (!isPart(['left', '左', '_l', '.l']) && meshCenter.x < -0.1);

        // Determine which mapped texture to use
        if (partTextures) {
          // Priority 1: Labels & Decorations
          if (isPart(['贴图', 'sticker', 'decal', 'label', 'logo'])) {
            mat.map = materialProps.map;
            mat.transparent = true;
          }
          // Priority 2: Collar (Check before sleeve to avoid crosstalk)
          else if (isPart(['领', 'collar', 'neck', 'neckband', 'rib'])) {
            mat.map = partTextures.collar;
          }
          // Priority 3: Main Body
          else if ((isPart(['主体', 'body', 'front', '正面', '前片']) || isPart(['main'])) && !isPart(['back', '后', '背面', '后片'])) {
            mat.map = partTextures.front;
          } else if (isPart(['back', '后片', '背面', '后部'])) {
            mat.map = partTextures.back;
          }
          // Priority 4: Sleeves
          else if (isPart(['sleeve', '袖子', 'arm', '袖', 'inside', 'inner']) || isPart(['cuff', '袖口'])) {
            if (isRight) {
              mat.map = partTextures.sleeve_right;
            } else if (isLeft) {
              mat.map = partTextures.sleeve_left;
            } else {
              // Spatial fallback for generic names like "Sleeve_Inner"
              mat.map = meshCenter.x > 0 ? partTextures.sleeve_left : partTextures.sleeve_right;
            }
          }
          // Priority 5: Utility
          else if (isPart(['缝纫', '线', 'stitch', 'thread'])) {
            mat.map = null;
          }
          // Fallback
          else {
            if (fullSearchName.includes('front')) mat.map = partTextures.front;
            else if (fullSearchName.includes('back')) mat.map = partTextures.back;
            else if (fullSearchName.includes('sleeve')) {
              mat.map = meshCenter.x > 0 ? partTextures.sleeve_left : partTextures.sleeve_right;
            } else {
              mat.map = materialProps.map;
            }
          }
        } else {
          mat.map = materialProps.map;
        }

        // Check if this part should be transparent (decals/stickers) or opaque (main fabric)
        const isDecal = isPart(['贴图', 'sticker', 'decal', 'label', 'logo']);

        // Fix for "Snowflake" flickering:
        // Main parts should NOT be transparent unless strictly needed, to ensure DepthWrite works correctly.
        mat.transparent = isDecal;
        mat.alphaTest = isDecal ? 0.05 : 0; // Use alphaTest for decals to help with sorting
        mat.depthWrite = true; // Always write to depth buffer to prevent Z-fighting snowflakes
        mat.side = THREE.DoubleSide; // Keep DoubleSide for single-walled meshes

        mesh.material = mat;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [clone, materialProps, partTextures]);

  // Click vs Drag Detection
  const downPoint = useRef<{ x: number, y: number } | null>(null);

  return (
    <primitive
      object={clone}
      scale={[1, 1, 1]}
      onPointerOver={(e: any) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={(e: any) => { e.stopPropagation(); onHover(false); }}
      onPointerDown={(e: any) => {
        e.stopPropagation();
        downPoint.current = { x: e.screenX, y: e.screenY };
      }}
      onPointerUp={(e: any) => {
        e.stopPropagation();
        if (!downPoint.current) return;

        const dist = Math.sqrt(
          Math.pow(e.screenX - downPoint.current.x, 2) +
          Math.pow(e.screenY - downPoint.current.y, 2)
        );

        // Only trigger click if movement is less than 5 pixels
        if (dist < 5 && onClick) {
          onClick();
        }
        downPoint.current = null;
      }}
    />
  );
};

export const PackagingMesh: React.FC<{ config: PackagingState; overrideTexture?: THREE.Texture | null; onClick?: () => void }> = ({ config, overrideTexture, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);

  useEffect(() => {
    if (overrideTexture === undefined) {
      document.body.style.cursor = hovered ? 'pointer' : 'auto';
    }
    return () => { document.body.style.cursor = 'auto'; };
  }, [hovered, overrideTexture]);

  const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  // 不再使用外部URL,避免网络错误
  const urlToLoad = (overrideTexture !== undefined) ? PLACEHOLDER_IMG : (config.textureUrl || PLACEHOLDER_IMG);

  const loadedTexture = useLoader(THREE.TextureLoader, urlToLoad);
  const activeTexture = overrideTexture !== undefined ? overrideTexture : (config.textureUrl ? loadedTexture : null);

  // Memoize material props to avoid unnecessary recalculations
  const baseMaterialProps = useMemo(() => ({
    color: config.color, // Always use config color as base
    roughness: config.shape === 'mannequin' ? 0.8 : config.roughness,
    metalness: config.shape === 'mannequin' ? 0.0 : config.metalness,
    sheen: config.shape === 'mannequin' ? 0.2 : 0,
    sheenColor: new THREE.Color('#ffffff'),
    clearcoat: (config.shape === 'bottle' || config.shape === 'can') ? 0.5 : 0,
    side: THREE.DoubleSide,
    emissive: hovered ? '#3b82f6' : '#000000',
    emissiveIntensity: hovered ? 0.2 : 0,
    map: activeTexture,
    transparent: false, // Default to false to prevent "snowflake" flickering in standard meshes too
  }), [config.color, config.roughness, config.metalness, config.shape, activeTexture, hovered]);

  // Texture Transformation Logic
  useEffect(() => {
    if (activeTexture && config.shape !== 'mannequin') {
      activeTexture.colorSpace = THREE.SRGBColorSpace;
      activeTexture.matrixAutoUpdate = false;
      activeTexture.center.set(0.5, 0.5);
      activeTexture.rotation = config.textureRotation;
      activeTexture.repeat.set(config.textureRepeat[0], config.textureRepeat[1]);
      activeTexture.offset.set(config.textureOffset[0], config.textureOffset[1]);
      activeTexture.wrapS = activeTexture.wrapT = THREE.RepeatWrapping;
      activeTexture.updateMatrix();
      activeTexture.needsUpdate = true;
    }
  }, [activeTexture, config.textureOffset, config.textureRepeat, config.textureRotation, config.shape]);

  // Mannequin specific texture splitting (Memoized)
  const mannequinParts = useMemo(() => {
    if (config.shape !== 'mannequin' || !activeTexture) return null;

    const createPart = (uOff: number, uRep: number, vOff: number, vRep: number) => {
      const t = activeTexture.clone();
      t.matrixAutoUpdate = false;
      t.colorSpace = THREE.SRGBColorSpace;
      // For Canvas textures, ensure flipY is set correctly
      if (t.flipY !== undefined) {
        t.flipY = true;
      }
      // UV coordinates: normalize to 0-1 range
      // uOff and vOff are normalized offsets (0-1)
      // uRep and vRep are normalized repeat values
      t.repeat.set(uRep, vRep);
      t.offset.set(uOff, vOff);
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.updateMatrix();
      return t;
    };

    // Proportional Mapping (0-1)
    return {
      front: createPart(0, 0.35, 0, 1),
      back: createPart(0.35, 0.35, 0, 1),
      sleeveL: createPart(0.70, 0.30, 0.66, 0.34), // Top 34%
      sleeveR: createPart(0.70, 0.30, 0.33, 0.33), // Middle 33%
      collar: createPart(0.70, 0.30, 0.0, 0.33),  // Bottom 33%
    };
  }, [activeTexture, config.shape]);

  // Ensure derived textures update when using live canvas texture
  useFrame(() => {
    if (mannequinParts && overrideTexture) {
      Object.values(mannequinParts).forEach((t) => { (t as THREE.Texture).needsUpdate = true; });
    }
  });

  const downPoint = useRef<{ x: number, y: number } | null>(null);

  const bindInteraction = {
    onPointerOver: (e: any) => { e.stopPropagation(); setHover(true); },
    onPointerOut: (e: any) => { e.stopPropagation(); setHover(false); },
    onPointerDown: (e: any) => {
      e.stopPropagation();
      downPoint.current = { x: e.screenX, y: e.screenY };
    },
    onPointerUp: (e: any) => {
      e.stopPropagation();
      if (!downPoint.current) return;

      const dist = Math.sqrt(
        Math.pow(e.screenX - downPoint.current.x, 2) +
        Math.pow(e.screenY - downPoint.current.y, 2)
      );

      if (dist < 5 && onClick) {
        onClick();
      }
      downPoint.current = null;
    }
  };

  // Custom模型的纹理分割(类似mannequin)
  const customParts = useMemo(() => {
    if (config.shape !== 'custom' || !activeTexture) return null;
    return {}; // 标记启用分割
  }, [activeTexture, config.shape]);

  if (config.shape === 'custom' && config.customModelUrl) {
    return <CustomModel url={config.customModelUrl} config={config} materialProps={baseMaterialProps} onHover={setHover} onClick={onClick} customParts={customParts} />;
  }

  const renderStandardMesh = (geometry: React.ReactNode, position: [number, number, number] = [0, 0, 0]) => (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      position={new THREE.Vector3(...position)}
      {...bindInteraction}
    >
      {geometry}
      <meshPhysicalMaterial {...baseMaterialProps} />
    </mesh>
  );

  switch (config.shape) {
    case 'mailer':
    case 'tuck':
    case 'box':
      const dim = config.dimensions;
      const scaleFactor = 0.1;
      return renderStandardMesh(<boxGeometry args={[dim.length * scaleFactor, dim.height * scaleFactor, dim.width * scaleFactor]} />);

    case 'mannequin':
      return (
        <group position={[0, -0.8, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.5, 0.01]} scale={[1, 1, 0.6]} rotation={[0, Math.PI, 0]} {...bindInteraction}>
            <cylinderGeometry args={[0.65, 0.60, 2.2, 32, 1, true, 0, Math.PI]} />
            <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.front || activeTexture} side={THREE.DoubleSide} />
          </mesh>

          <mesh castShadow receiveShadow position={[0, 0.5, -0.01]} scale={[1, 1, 0.6]} rotation={[0, 0, 0]} {...bindInteraction}>
            <cylinderGeometry args={[0.65, 0.60, 2.2, 32, 1, true, 0, Math.PI]} />
            <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.back || activeTexture} side={THREE.DoubleSide} />
          </mesh>

          <mesh castShadow receiveShadow position={[0.55, 1.35, 0.1]} scale={[1, 1, 0.6]} {...bindInteraction}>
            <sphereGeometry args={[0.25, 32, 16, 0, Math.PI]} />
            <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.front || activeTexture} />
          </mesh>
          <mesh castShadow receiveShadow position={[-0.55, 1.35, 0.1]} scale={[1, 1, 0.6]} {...bindInteraction}>
            <sphereGeometry args={[0.25, 32, 16, 0, Math.PI]} />
            <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.front || activeTexture} />
          </mesh>

          <group position={[-0.75, 1.25, 0]} rotation={[0, 0, Math.PI / 6]}>
            <mesh castShadow receiveShadow scale={[1, 1, 0.7]} {...bindInteraction}>
              <cylinderGeometry args={[0.24, 0.22, 0.6, 32]} />
              <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.sleeveR || activeTexture} />
            </mesh>
          </group>

          <group position={[0.75, 1.25, 0]} rotation={[0, 0, -Math.PI / 6]}>
            <mesh castShadow receiveShadow scale={[1, 1, 0.7]} {...bindInteraction}>
              <cylinderGeometry args={[0.24, 0.22, 0.6, 32]} />
              <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.sleeveL || activeTexture} />
            </mesh>
          </group>

          <group position={[0, 1.55, 0]}>
            <mesh castShadow receiveShadow rotation={[0, 0, 0]} scale={[1, 1, 0.7]} {...bindInteraction}>
              <torusGeometry args={[0.28, 0.06, 16, 32]} />
              <meshPhysicalMaterial {...baseMaterialProps} map={mannequinParts?.collar || activeTexture} />
            </mesh>
          </group>

          <group position={[0, 1.6, 0]} scale={[1, 1, 0.8]}>
            <mesh position={[0, -0.1, 0]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.3, 32]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>
          <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]}>
            <torusGeometry args={[0.6, 0.02, 16, 64]} />
            <meshPhysicalMaterial color="#e5e5e5" roughness={0.1} metalness={0.8} />
          </mesh>
        </group>
      );

    case 'bottle':
      return (
        <group position={[0, -0.5, 0]}>
          <mesh castShadow receiveShadow {...bindInteraction}>
            <cylinderGeometry args={[0.7, 0.7, 2.5, 64]} />
            <meshPhysicalMaterial {...baseMaterialProps} />
          </mesh>
          <mesh position={[0, 1.35, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 32]} />
            <meshStandardMaterial color="#222" roughness={0.2} />
          </mesh>
        </group>
      );

    case 'can':
      return renderStandardMesh(<cylinderGeometry args={[0.7, 0.7, 2.2, 64]} />);

    default:
      return renderStandardMesh(<boxGeometry args={[1.5, 1.5, 1.5]} />);
  }
};

const defaultCameraDistance = 9;

// Camera Controls Component to access OrbitControls
const CameraControls: React.FC<{
  controlsRef: React.MutableRefObject<any>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  onZoomChange: (zoom: number) => void;
}> = ({ controlsRef, cameraRef, onZoomChange }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      cameraRef.current = camera;
    }
  }, [camera, cameraRef]);

  useFrame(() => {
    if (cameraRef.current && controlsRef.current) {
      // Get the actual distance from OrbitControls if available
      // Otherwise calculate from camera position
      let distance = defaultCameraDistance;

      if (controlsRef.current.getDistance) {
        distance = controlsRef.current.getDistance();
      } else {
        distance = cameraRef.current.position.length();
      }

      // Clamp distance to valid range (1-30)
      const clampedDistance = Math.max(1, Math.min(30, distance));
      // Calculate zoom: default distance (9) / current distance
      // Smaller distance = closer = larger appearance = higher zoom %
      const zoom = defaultCameraDistance / clampedDistance;
      onZoomChange(zoom);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 1.5}
      minDistance={0.1}
      maxDistance={200}
      enableZoom={true}
      enablePan={true}
      enableRotate={true}
    />
  );
};

const Scene: React.FC<SceneProps> = ({ config, onModelClick }) => {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize zoom on mount - use default 100%
  useEffect(() => {
    // Start with 100% zoom (default distance)
    setZoom(1);
    setIsInitialized(true);
  }, []);

  // Convert zoom to percentage (zoom of 1 = 100%, zoom of 2 = 200%, etc.)
  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => {
    if (cameraRef.current && controlsRef.current) {
      // Zoom in by reducing distance (move camera closer)
      const currentPos = cameraRef.current.position;
      const currentDistance = currentPos.length();
      const newDistance = Math.max(1, currentDistance * 0.8);
      const ratio = newDistance / currentDistance;

      currentPos.multiplyScalar(ratio);
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current && controlsRef.current) {
      // Zoom out by increasing distance (move camera farther)
      const currentPos = cameraRef.current.position;
      const currentDistance = currentPos.length();
      const newDistance = Math.min(30, currentDistance * 1.25);
      const ratio = newDistance / currentDistance;

      currentPos.multiplyScalar(ratio);
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();
    }
  };

  const handlePresetZoom = (level: number) => {
    if (cameraRef.current && controlsRef.current) {
      // level: 0.25, 0.5, 1.0 as multipliers
      // level of 1.0 means 100% zoom (default distance)
      const targetDistance = defaultCameraDistance / level;
      const currentPos = cameraRef.current.position;
      const currentDistance = currentPos.length();

      // Normalize position to unit vector, then scale to target distance
      currentPos.normalize().multiplyScalar(targetDistance);
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();
    }
  };

  const handleFitToScreen = () => {
    if (cameraRef.current && controlsRef.current) {
      // Reset to default view
      const currentPos = cameraRef.current.position;
      currentPos.normalize().multiplyScalar(defaultCameraDistance);
      cameraRef.current.updateProjectionMatrix();

      // Reset rotation
      controlsRef.current.reset();
      controlsRef.current.update();
    }
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance"
        }}
        camera={{ fov: 35, position: [0, 0, defaultCameraDistance], near: 0.1, far: 1000 }}
      >
        <React.Suspense fallback={null}>
          <color attach="background" args={['#f3f4f6']} />
          {/* Natural lighting environment */}
          <Environment preset="city" />

          {/* Subtle balanced lights */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-5, 5, 5]} intensity={0.3} />
          <group position={[0, 0, 0]}>
            <Center>
              <PackagingMesh config={config} onClick={onModelClick} />
            </Center>
            <ContactShadows position={[0, -2.5, 0]} resolution={512} scale={10} blur={2} opacity={0.5} far={10} color="#000000" />
          </group>
          <CameraControls controlsRef={controlsRef} cameraRef={cameraRef} onZoomChange={setZoom} />
        </React.Suspense>
      </Canvas>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 flex gap-2 z-10">
        {/* Zoom In/Out Controls */}
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
            title="缩小"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-medium text-gray-600 w-10 text-center select-none">
            {zoomPercentage}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
            title="放大"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Preset Zoom & Fit */}
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center gap-1">
          {[0.25, 0.5, 1.0, 2.0].map(level => (
            <button
              key={level}
              onClick={() => handlePresetZoom(level)}
              className="px-2 py-1.5 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              {level * 100}%
            </button>
          ))}
          <div className="w-px h-3 bg-gray-200 mx-1"></div>
          <button
            onClick={handleFitToScreen}
            className="px-2 py-1.5 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-500 hover:text-brand-600 transition-colors flex items-center gap-1"
            title="适应屏幕"
          >
            <Maximize size={10} /> Fit
          </button>
        </div>
      </div>

      {/* Info Text */}
      <div className="absolute bottom-4 right-4 text-gray-400 text-xs text-right pointer-events-none select-none">
        <div>WebGL 2.0</div>
        <div>Engine: React Three Fiber</div>
      </div>
    </div>
  );
};

export default Scene;