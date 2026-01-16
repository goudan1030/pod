import { storageService } from '../src/services/storageService';
import { Category, ModelItem, PackagingState } from '../types';

// Default Data Definitions (For Seeding)
const DEFAULT_CATEGORIES_DATA: Partial<Category>[] = [
    { id: 'all', name: 'all', displayName: 'All Models', icon: 'archive' },
    { id: 't-shirt', name: 't-shirt', displayName: 'T-Shirt', icon: 'shirt' },
    { id: 'hoodie', name: 'hoodie', displayName: 'Hoodie', icon: 'shirt' },
    { id: 'hat', name: 'hat', displayName: 'Hat', icon: 'crown' },
    { id: 'pillow', name: 'pillow', displayName: 'Pillow', icon: 'square' },
    { id: 'blanket', name: 'blanket', displayName: 'Blanket', icon: 'hexagon' },
    { id: 'box', name: 'box', displayName: 'Box', icon: 'box' },
    { id: 'pouch', name: 'pouch', displayName: 'Pouch', icon: 'shopping-bag' },
    { id: 'bottle', name: 'bottle', displayName: 'Bottle', icon: 'glass-water' },
    { id: 'can', name: 'can', displayName: 'Can', icon: 'spray-can' },
];

const DEFAULT_CONFIG: PackagingState = {
    shape: 'mannequin',
    customModelUrl: null,
    color: '#ffffff',
    textureUrl: null,
    roughness: 0.5,
    metalness: 0,
    scale: [1, 1, 1],
    dimensions: {
        length: 20,
        width: 15,
        height: 15,
    },
    textureOffset: [0, 0],
    textureRepeat: [1, 1],
    textureRotation: 0,
};

// Seed Models (Not really used for remote DB unless we want to upload default files to bucket automatically, 
// which is complex. For now, we skip auto-seeding models to remote DB to avoid complexity)
const SEED_MODELS_DATA: any[] = [];

// Helper to seed data if empty
export const initializeData = async () => {
    // Check if connected
    try {
        await storageService.initialize(DEFAULT_CATEGORIES_DATA as Category[], SEED_MODELS_DATA);
    } catch (e) {
        console.error("Failed to initialize data", e);
    }
}

// Initial call (Optional, can be called in App.tsx)
initializeData();

// Accessors - Now wrappers around async service
// Components must await these!
export const getCategories = async () => await storageService.getCategories();
export const getModels = async () => await storageService.getModels();
