import React, { useState, useEffect } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageService, StoredModel } from '../../src/services/storageService';
import { Category } from '../../types';
// We need to import the pipeline dynamically or ensure it's built
// import { extractSVGPathFromMesh } from '../../utils/uvPipeline'; 

const ModelManager: React.FC = () => {
    const navigate = useNavigate();
    const [models, setModels] = useState<StoredModel[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const mods = await storageService.getModels();
        // Ensure type compatibility if getModels returns ModelItem[]
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
                    <div key={model.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
                        <div className="aspect-[4/3] bg-gray-100 relative">
                            <img src={model.thumbnail} alt={model.name} className="w-full h-full object-cover" />
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => handleDelete(model.id)}
                                    className="p-2 bg-white text-red-600 rounded-full hover:bg-red-50"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-semibold text-gray-900 truncate">{model.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                                    {categories.find(c => c.id === model.categoryId)?.displayName || model.categoryId}
                                </span>
                                {model.uploadedAt && (
                                    <span className="text-xs text-gray-400">
                                        {new Date(model.uploadedAt).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ModelManager;
