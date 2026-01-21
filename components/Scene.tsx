import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, ContactShadows, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PackagingState } from '../types';
import { ZoomIn, ZoomOut, Maximize, Loader2 } from 'lucide-react';

interface SceneProps {
  config: PackagingState;
  onModelClick?: () => void;
}

// GLB Model Loader Component
const GLBModel: React.FC<{ url: string; config: PackagingState; materialProps: any; onHover: (v: boolean) => void; onClick?: () => void }> = ({ url, config, materialProps, onHover, onClick }) => {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone();

    // Apply hidden meshes logic
    if (config.hiddenMeshes && config.hiddenMeshes.length > 0) {
      c.traverse((child) => {
        if (child.name && config.hiddenMeshes?.includes(child.name)) {
          child.visible = false;
        }
      });
    }

    // Calculate bounding box and scale model
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 1.0; // Standard size for GLB models
    const scale = targetSize / (maxDim || 1);

    c.scale.setScalar(scale);
    c.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    return c;
  }, [scene, config.hiddenMeshes]);

  // Apply material to meshes
  useEffect(() => {
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const meshName = mesh.name;

        // Apply texture to "贴图" mesh
        if (meshName === '贴图' || meshName.includes('贴图')) {
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
            map: materialProps.map,
            transparent: true,
            alphaTest: 0.05,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: -1, // Draw on top of the base mesh to prevent z-fighting
            polygonOffsetUnits: -1
          });

          if (mat.map) {
            mat.map.flipY = true;
            mat.map.needsUpdate = true;
          }

          mesh.material = mat;
          mesh.visible = true;
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [clone, materialProps]);

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
    // Only apply transforms if it's NOT an override texture (CanvasTexture)
    // CanvasTexture already has transforms applied during 2D drawing
    if (activeTexture && config.shape !== 'mannequin' && overrideTexture === undefined) {
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
  }, [activeTexture, config.textureOffset, config.textureRepeat, config.textureRotation, config.shape, overrideTexture]);

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
    return null; // 禁用分割，直接使用原始UV
  }, [activeTexture, config.shape]);

  // If modelFileUrl is provided, load GLB model
  if (config.modelFileUrl) {
    return <GLBModel url={config.modelFileUrl} config={config} materialProps={baseMaterialProps} onHover={setHover} onClick={onClick} />;
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

// Gradient Background Component - darker at top
const GradientBackground: React.FC = () => {
  const { scene, size } = useThree();
  
  useEffect(() => {
    // Create gradient texture using Canvas 2D API
    // Use larger canvas for better quality
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Create vertical gradient: darker at top (#9ca3af), lighter at bottom (#d1d5db)
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, '#9ca3af'); // Darker gray at top
      gradient.addColorStop(0.5, '#b8bcc5'); // Medium gray in middle
      gradient.addColorStop(1, '#d1d5db'); // Lighter gray at bottom
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.needsUpdate = true;
      
      // Set as scene background
      scene.background = texture;
    }
    
    return () => {
      if (scene.background && scene.background instanceof THREE.Texture) {
        scene.background.dispose();
        scene.background = null;
      }
    };
  }, [scene]);
  
  return null;
};

const defaultCameraDistance = 80; // Increased to 80 for optimal viewing distance

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
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [zoom, setZoom] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'building' | 'materials'>('building');

  // Simulate loading stages
  useEffect(() => {
    setIsLoading(true);
    setLoadingStage('building');

    const timer1 = setTimeout(() => {
      setLoadingStage('materials');
    }, 800);

    const timer2 = setTimeout(() => {
      setIsLoading(false);
    }, 1600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [config.modelFileUrl, config.shape]);
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
    <div className="relative w-full h-full bg-gray-50">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 backdrop-blur-md z-50">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex items-center gap-4 border border-gray-100">
            <Loader2 className="animate-spin text-brand-600" size={24} />
            <span className="text-lg font-medium text-gray-700">
              {loadingStage === 'building' ? '构建模型' : '准备材质'}
            </span>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
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
          {/* Gradient Background - darker at top */}
          <GradientBackground />
          {/* Natural lighting environment */}
          <Environment preset="city" />

          {/* Subtle balanced lights */}
          <ambientLight intensity={0.4} />
          {/* <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} /> */}
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