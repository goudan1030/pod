import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface ModelPreviewProps {
    modelUrl: string;
}

const Model: React.FC<{ url: string }> = ({ url }) => {
    const { scene } = useGLTF(url);

    // Clone the scene to avoid sharing materials between instances
    const clonedScene = React.useMemo(() => scene.clone(), [scene]);

    return (
        <Center>
            <primitive object={clonedScene} />
        </Center>
    );
};

const ModelPreview: React.FC<ModelPreviewProps> = ({ modelUrl }) => {
    return (
        <div className="w-full h-full">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                gl={{ alpha: true, antialias: true }}
                dpr={[1, 1.5]} // Limit pixel ratio for performance
            >
                <color attach="background" args={['#f8fafc']} />

                {/* Lighting */}
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
                <directionalLight position={[-5, 3, -5]} intensity={0.3} />

                {/* Model */}
                <Suspense fallback={null}>
                    <Model url={modelUrl} />
                </Suspense>

                {/* Controls - subtle auto-rotation */}
                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    autoRotate
                    autoRotateSpeed={2}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 3}
                />
            </Canvas>
        </div>
    );
};

export default ModelPreview;
