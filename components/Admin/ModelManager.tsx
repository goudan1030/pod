import React, { useState, useEffect, Suspense } from 'react';
import { Upload, Trash2, Edit, Eye, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageService, StoredModel } from '../../src/services/storageService';
import { Category } from '../../types';
import { Canvas } from '@react-three/fiber';
import { Stage, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Inline Preview Component for the Modal
const ModalPreview = ({ url, hiddenMeshes = [] }: { url: string; hiddenMeshes?: string[] }) => {
    const { scene } = useGLTF(url);
    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (hiddenMeshes.includes(child.name)) {
                    child.visible = false;
                } else {
                    child.visible = true;
                }
            }
        });
    }, [scene, hiddenMeshes]);

    return (
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 50 }}>
            <color attach="background" args={['#f9fafb']} />
            <Stage environment="city" intensity={0.6}>
                <primitive object={scene} />
            </Stage>
            <OrbitControls makeDefault />
        </Canvas>
    );
};

const ModelManager: React.FC = () => {
    const navigate = useNavigate();
    const [models, setModels] = useState<StoredModel[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [previewModel, setPreviewModel] = useState<StoredModel | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const mods = await storageService.getModels();
        setModels(mods as StoredModel[]);
        const cats = await storageService.getCategories();
        setCategories(cats);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this model?')) {
            await storageService.deleteModel(id);
            await loadData();
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Models</h1>
                    <p className="text-gray-500 mt-1">Upload and manage your 3D assets.</p>
                </div>
                <button
                    onClick={() => navigate('upload')}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-medium"
                >
                    <Upload size={18} />
                    Upload Model
                </button>
            </div>

            {/* Model List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {models.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        No models found. Upload one to get started.
                    </div>
                )}

                {models.map(model => (
                    <div key={model.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group relative">
                        <div className="aspect-[4/3] bg-gray-100 relative">
                            <img src={model.thumbnail} alt={model.name} className="w-full h-full object-cover" />
                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                <button
                                    onClick={() => setPreviewModel(model)}
                                    className="p-2 bg-white/90 text-gray-700 rounded-full hover:bg-white hover:text-brand-600 transition shadow-sm"
                                    title="Preview"
                                >
                                    <Eye size={20} />
                                </button>
                                <button
                                    onClick={() => navigate(`edit/${model.id}`)}
                                    className="p-2 bg-white/90 text-gray-700 rounded-full hover:bg-white hover:text-blue-600 transition shadow-sm"
                                    title="Edit"
                                >
                                    <Edit size={20} />
                                </button>
                                <button
                                    onClick={() => handleDelete(model.id)}
                                    className="p-2 bg-white/90 text-gray-700 rounded-full hover:bg-white hover:text-red-600 transition shadow-sm"
                                    title="Delete"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-semibold text-gray-900 truncate">{model.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                                    {categories.find(c => c.id === model.categoryId)?.displayName || model.categoryId}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Preview Modal */}
            {previewModel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold text-gray-900">{previewModel.name}</h3>
                            <button
                                onClick={() => setPreviewModel(null)}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="aspect-video bg-gray-100 relative">
                            <Suspense fallback={
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400 gap-2">
                                    <Loader2 className="animate-spin" /> Loading...
                                </div>
                            }>
                                <ModalPreview
                                    url={previewModel.file}
                                    hiddenMeshes={previewModel.config?.hiddenMeshes || []}
                                />
                            </Suspense>
                        </div>
                        <div className="p-4 bg-gray-50 text-sm text-gray-500 flex justify-between">
                            <span>ID: {previewModel.id}</span>
                            <span>{new Date(previewModel.uploadedAt).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelManager;
