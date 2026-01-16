
# How to add custom models

1. Place your `.glb` or `.gltf` model files in this directory (`public/models/`).
   Example: `public/models/my-bottle.glb`

2. Register the model in `src/data/mockData.tsx`:

   ```typescript
   export const MODELS: ModelItem[] = [
     // ...
     {
       id: 'my-bottle',
       name: 'My Custom Bottle',
       categoryId: 'bottle',
       thumbnail: '...', 
       config: {
         shape: 'custom',             // Must be 'custom' for uploaded files
         customModelUrl: '/models/my-bottle.glb', // Path relative to public folder
         dimensions: { length: 8, width: 8, height: 20 },
         scale: [1, 1, 1],
       }
     }
   ];
   ```
