export type ShapeType = 'box' | 'mailer' | 'tuck' | 'bottle' | 'pouch' | 'can' | 'mannequin' | 'custom';

export interface PackagingState {
  shape: ShapeType;
  dimensions: { length: number; width: number; height: number };
  color: string;
  roughness: number;
  metalness: number;
  scale: [number, number, number];
  textureUrl: string | null;
  textureRotation: number;
  textureRepeat: [number, number];
  textureOffset: [number, number];
  customModelUrl?: string;
  category?: string; // Model category: 'hat', 't-shirt', 'hoodie', etc.
  // Dynamic SVG paths extracted from the model (Key: regionId/meshName)
  dynamicSVGPaths?: Record<string, { d: string, w: number, h: number }>;
}

// --- Admin / Data Types ---
export interface Category {
  id: string;
  name: string;
  displayName: string;
  icon?: string; // Icon name string for lookup
}

export interface ModelItem {
  id: string;
  name: string;
  file: string; // Path to glb file
  categoryId: string;
  thumbnail: string;
  config: Partial<PackagingState>;
}