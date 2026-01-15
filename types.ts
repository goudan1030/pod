export type ShapeType = 'box' | 'mailer' | 'tuck' | 'bottle' | 'pouch' | 'can' | 'mannequin' | 'custom';

export interface PackagingState {
  shape: ShapeType;
  customModelUrl: string | null; // For uploaded GLB/GLTF
  color: string;
  textureUrl: string | null;
  roughness: number;
  metalness: number;
  scale: [number, number, number];
  dimensions: {
    length: number; // cm
    width: number;  // cm
    height: number; // cm
  };
  // UV Transform
  textureOffset: [number, number];
  textureRepeat: [number, number];
  textureRotation: number; // radians
}

export interface FeasibilityItem {
  title: string;
  score: number; // 0-100
  description: string;
  status: 'High' | 'Medium' | 'Low';
}