export type ShapeType = 'box' | 'mailer' | 'tuck' | 'bottle' | 'pouch' | 'can' | 'mannequin';

// Layer type for texture editor
export interface Layer {
  id: string;
  type: 'image' | 'color' | 'text';
  src: string; // Image URL or Color Hex or Text Content
  x: number; // Center X in Canvas Coordinates
  y: number; // Center Y in Canvas Coordinates
  width: number; // Original Width
  height: number; // Original Height
  rotation: number; // Degrees
  scale: number;
  textProps?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textAlign?: 'left' | 'center' | 'right';
    textDecoration?: 'none' | 'underline' | 'line-through';
  };
}

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
  modelFileUrl?: string; // URL to the GLB model file
  category?: string; // Model category: 'hat', 't-shirt', 'hoodie', etc.
  material?: string; // Material type: '棉基', '涤纶', etc.
  // Dynamic SVG paths extracted from the model (Key: regionId/meshName)
  dynamicSVGPaths?: Record<string, { d: string, w: number, h: number }>;
  // List of mesh names to hide in the 3D scene
  hiddenMeshes?: string[];
  // Layer data for texture editor (preserves editable layers instead of rasterized image)
  layers?: Layer[];
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