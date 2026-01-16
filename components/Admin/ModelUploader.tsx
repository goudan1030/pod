import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, Save } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Stage, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { storageService } from '../../src/services/storageService';
import { Category } from '../../types';

// Dynamic import for extraction logic to avoid huge bundle
// (or just import if it's small enough, utils usually are)
import { extractSVGPathFromMesh } from '../../utils/uvPipeline';

// --- Sub-components for Preview ---

const ModelPreview = ({ url }: { url: string }) => {
    const { scene } = useGLTF(url);
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

// ... (SVGPreview and rest of code)



const SVGPreview = ({ paths }: { paths: Record<string, { d: string; w: number; h: number }> }) => {
    // Combine paths or show them?
    // Let's visualize them in a 1000x1000 box (normalized)

    // Find bounds to normalize viewbox
    const allPaths = Object.values(paths);
    if (allPaths.length === 0) return <div className="text-gray-400 text-sm">No UV paths found</div>;

    // Just take the first one or aggregate for preview
    // In our app, usually we care about the main UV parts.

    return (
        <div className="w-full h-full border border-gray-200 bg-white rounded-lg p-4 flex items-center justify-center">
            <svg viewBox="0 0 1024 1024" className="w-full h-full">
                {Object.entries(paths).map(([name, data], i) => (
                    <path
                        key={name}
                        d={data.d}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        transform={`translate(0,0)`} // We might need scaling logic depending on raw data
                    />
                ))}
            </svg>
        </div>
    );
};

const ModelUploader: React.FC = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileStats, setFileStats] = useState<{ size: string; name: string } | null>(null);

    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');

    const [extractedPaths, setExtractedPaths] = useState<Record<string, any>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStage, setProcessingStage] = useState('');

    useEffect(() => {
        const loadCats = async () => {
            const data = await storageService.getCategories();
            setCategories(data);
        };
        loadCats();
    }, []);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            setFile(selected);
            setFileStats({
                name: selected.name,
                size: (selected.size / 1024 / 1024).toFixed(2)
            });
            setName(selected.name.replace(/\.(glb|gltf)$/i, ''));

            // Create Local Preview
            const objectUrl = URL.createObjectURL(selected);
            setPreviewUrl(objectUrl);

            // Auto-extract logic for preview
            await analyzeModel(objectUrl);
        }
    };

    const analyzeModel = async (url: string) => {
        try {
            setProcessingStage('Analyzing 3D Structure...');
            setIsProcessing(true);

            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(url);

            const paths: Record<string, any> = {};
            gltf.scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const info = extractSVGPathFromMesh(child);
                    if (info) {
                        paths[child.name] = {
                            d: info.d,
                            w: info.width,
                            h: info.height
                        };
                    }
                }
            });

            setExtractedPaths(paths);
            setIsProcessing(false);
        } catch (error) {
            console.error("Analysis failed", error);
            setIsProcessing(false);
        }
    };

    const handleUpload = async () => {
        if (!file || !name || !categoryId) return;

        try {
            setIsProcessing(true);
            setProcessingStage('Uploading to Cloud Storage...');

            // 1. Upload
            const publicUrl = await storageService.uploadFile(file);
            if (!publicUrl) throw new Error("Upload failed");

            setProcessingStage('Saving Metadata...');

            // 2. Save Record
            await storageService.addModel({
                id: crypto.randomUUID(),
                name: name,
                categoryId: categoryId,
                file: publicUrl,
                thumbnail: `https://placehold.co/400x400/f1f5f9/64748b?text=${encodeURIComponent(name)}`,
                config: {
                    shape: 'custom',
                    category: categoryId,
                    customModelUrl: publicUrl,
                    dynamicSVGPaths: extractedPaths,
                    // Default values
                    color: '#ffffff',
                    dimensions: { length: 20, width: 20, height: 20 },
                    scale: [1, 1, 1],
                    metalness: 0,
                    roughness: 0.5,
                    textureUrl: null,
                    textureOffset: [0, 0],
                    textureRepeat: [1, 1],
                    textureRotation: 0,
                }
            });

            // Done
            navigate('/admin/models');

        } catch (error) {
            console.error(error);
            alert('Upload Failed');
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Upload New Model</h1>
                    <p className="text-gray-500">Preview 3D geometry and UV layout before publishing.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Preview Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 3D Preview */}
                    <div className="bg-gray-100 rounded-xl overflow-hidden aspect-video border border-gray-200 relative">
                        {previewUrl ? (
                            <Suspense fallback={
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 gap-2">
                                    <Loader2 className="animate-spin" /> Loading 3D Preview...
                                </div>
                            }>
                                <ModelPreview url={previewUrl} />
                            </Suspense>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                No Model Selected
                            </div>
                        )}
                    </div>

                    {/* UV / SVG Preview */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h3 className="font-semibold text-gray-800 mb-4">UV Layout (Dieline) Preview</h3>
                        <div className="aspect-[2/1] bg-gray-50 rounded-lg overflow-hidden flex">
                            {/* Render key paths */}
                            {Object.keys(extractedPaths).length > 0 ? (
                                <div className="p-4 w-full flex gap-4 overflow-x-auto">
                                    {Object.entries(extractedPaths).map(([key, val]) => (
                                        <div key={key} className="min-w-[150px] border rounded bg-white p-2">
                                            <div className="text-xs font-mono text-gray-500 mb-1 truncate">{key}</div>
                                            <svg viewBox={`0 0 ${val.w} ${val.h}`} className="w-full aspect-square border-t">
                                                <path d={val.d} fill="none" stroke="#2563eb" strokeWidth="2" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="w-full flex items-center justify-center text-gray-400 text-sm">
                                    {previewUrl ? 'No valid UV paths detected' : 'Upload a model to inspect UVs'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls Column */}
                <div className="space-y-6">
                    {/* File Input */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Source File</h3>
                        {!file ? (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                                <Upload className="text-gray-400 mb-2" size={24} />
                                <span className="text-sm text-gray-600">Click to upload .glb</span>
                                <input type="file" accept=".glb" onChange={handleFileSelect} className="hidden" />
                            </label>
                        ) : (
                            <div className="flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                                <div className="truncate pr-2">
                                    <div className="font-medium truncate">{fileStats?.name}</div>
                                    <div className="text-xs opacity-70">{fileStats?.size} MB</div>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setPreviewUrl(null); setExtractedPaths({}); }}
                                    className="text-xs underline hover:text-blue-800"
                                >
                                    Change
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Metadata Input */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <h3 className="font-semibold text-gray-900">Metadata</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="e.g. Cotton T-Shirt"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="">Select Category...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.displayName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Submit Action */}
                    <div className="pt-4">
                        <button
                            onClick={handleUpload}
                            disabled={!file || !name || !categoryId || isProcessing}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition
                                ${!file || !name || !categoryId ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98]'}
                            `}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>{processingStage || 'Processing...'}</span>
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    <span>Publish Model</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModelUploader;
