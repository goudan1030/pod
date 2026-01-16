import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, Save, Camera } from 'lucide-react';
import { Canvas, useThree } from '@react-three/fiber';
import { Stage, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { storageService } from '../../src/services/storageService';
import { Category } from '../../types';
import { extractSVGPathFromMesh } from '../../utils/uvPipeline';

// --- Helper: Data URL to File ---
const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

// --- Sub-components for Preview ---

// Helper to expose capture method
const ScreenshotHandler = ({ captureRef }: { captureRef: React.MutableRefObject<any> }) => {
    const { gl, scene, camera } = useThree();
    useEffect(() => {
        captureRef.current = () => {
            // Hide helpers
            const hiddenObjects: THREE.Object3D[] = [];
            scene.traverse((child) => {
                if (
                    child instanceof THREE.GridHelper ||
                    child instanceof THREE.AxesHelper ||
                    child instanceof THREE.BoxHelper ||
                    (child instanceof THREE.LineSegments && child.name.toLowerCase().includes('helper')) ||
                    child.type === 'Helper'
                ) {
                    if (child.visible) {
                        child.visible = false;
                        hiddenObjects.push(child);
                    }
                }
            });

            gl.render(scene, camera);
            const dataUrl = gl.domElement.toDataURL('image/png');

            // Restore visibility
            hiddenObjects.forEach(obj => obj.visible = true);

            return dataUrl;
        };
    }, [gl, scene, camera, captureRef]);
    return null;
};

const ModelPreview = ({ url, hiddenMeshes = [], captureRef }: { url: string; hiddenMeshes?: string[], captureRef?: React.MutableRefObject<any> }) => {
    const { scene } = useGLTF(url);

    // Apply visibility settings
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
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
            {captureRef && <ScreenshotHandler captureRef={captureRef} />}
            <color attach="background" args={['#f9fafb']} />
            <Stage environment="city" intensity={0.6}>
                <primitive object={scene} />
            </Stage>
            <OrbitControls makeDefault />
        </Canvas>
    );
};

const ModelUploader: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;

    const [categories, setCategories] = useState<Category[]>([]);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileStats, setFileStats] = useState<{ size: string; name: string } | null>(null);

    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');

    // Thumbnail State
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const captureRef = useRef<(() => string) | null>(null);

    // New Category State
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [extractedPaths, setExtractedPaths] = useState<Record<string, any>>({});

    // Mesh Visibility State
    const [detectedMeshes, setDetectedMeshes] = useState<string[]>([]);
    const [hiddenMeshes, setHiddenMeshes] = useState<Set<string>>(new Set());

    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStage, setProcessingStage] = useState('');

    useEffect(() => {
        const loadInitialData = async () => {
            const cats = await storageService.getCategories();
            setCategories(cats);

            if (isEditing && id) {
                setProcessingStage('Loading Model Data...');
                setIsProcessing(true);
                const model = await storageService.getModel(id);
                if (model) {
                    setName(model.name);
                    setCategoryId(model.categoryId);
                    setPreviewUrl(model.file);
                    setThumbnailPreview(model.thumbnail); // Load existing thumbnail

                    if (model.config) {
                        if (model.config.dynamicSVGPaths) {
                            setExtractedPaths(model.config.dynamicSVGPaths);
                        }
                        if (model.config.hiddenMeshes) {
                            setHiddenMeshes(new Set(model.config.hiddenMeshes));
                        }
                    }

                    // Re-analyze model to get mesh list
                    analyzeModel(model.file);
                }
                setIsProcessing(false);
            }
        };
        loadInitialData();
    }, [id, isEditing]);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
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
            // Only update name if not editing or if name is empty
            if (!isEditing || !name) {
                setName(selected.name.replace(/\.(glb|gltf)$/i, ''));
            }

            // Reset mesh visibility and thumbnail
            setHiddenMeshes(new Set());
            // We usually want to keep the old thumbnail if just changing file unless user captures new one,
            // but for a new file, maybe clear it? Let's keep it flexible.
            if (!isEditing) setThumbnailPreview(null);

            // Create Local Preview
            const objectUrl = URL.createObjectURL(selected);
            setPreviewUrl(objectUrl);

            // Auto-extract logic for preview
            await analyzeModel(objectUrl, true);
        }
    };

    const analyzeModel = async (url: string, applyDefaults: boolean = false) => {
        try {
            if (!isProcessing) setIsProcessing(true);

            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(url);

            const paths: Record<string, any> = {};
            const meshes: string[] = [];
            const newHidden = new Set<string>();

            gltf.scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    meshes.push(child.name);

                    // Identify texture/decal meshes to hide by default
                    if (['贴图', 'sticker', 'decal', 'label', 'logo'].some(k => child.name.toLowerCase().includes(k))) {
                        newHidden.add(child.name);
                    }

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
            setDetectedMeshes(meshes);

            if (applyDefaults && newHidden.size > 0) {
                setHiddenMeshes(newHidden);
            }

            setIsProcessing(false);
        } catch (error) {
            console.error("Analysis failed", error);
            setIsProcessing(false);
        }
    };

    const toggleMeshVisibility = (meshName: string) => {
        const newSet = new Set(hiddenMeshes);
        if (newSet.has(meshName)) {
            newSet.delete(meshName);
        } else {
            newSet.add(meshName);
        }
        setHiddenMeshes(newSet);
    };

    const handleCaptureCover = () => {
        if (captureRef.current) {
            const dataUrl = captureRef.current();
            const file = dataURLtoFile(dataUrl, `model-cover-${Date.now()}.png`);
            if (file) {
                setThumbnailFile(file);
                setThumbnailPreview(dataUrl); // Show preview immediately
            }
        }
    };

    const handleUpload = async () => {
        if (!name) return;

        // If creating category, we need name
        if (isCreatingCategory && !newCategoryName) {
            alert("Please enter a category name");
            return;
        }
        // If selecting, we need ID
        if (!isCreatingCategory && !categoryId) {
            alert("Please select a category");
            return;
        }

        try {
            setIsProcessing(true);
            let finalCategoryId = categoryId;

            // 0. Create Category if needed
            if (isCreatingCategory) {
                setProcessingStage('Creating Category...');
                const slug = newCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const newCatId = slug || `cat-${Date.now()}`;

                await storageService.addCategory({
                    id: newCatId,
                    name: newCatId,
                    displayName: newCategoryName,
                    icon: 'box'
                });
                finalCategoryId = newCatId;
            }

            let publicUrl = previewUrl || '';

            // 1. Upload Model File if new
            if (file) {
                setProcessingStage('Uploading Model...');
                const url = await storageService.uploadFile(file);
                if (!url) throw new Error("Upload failed");
                publicUrl = url;
            } else if (!isEditing && !publicUrl) {
                alert("Please select a file");
                setIsProcessing(false);
                return;
            }

            // 2. Upload Thumbnail if captured
            let thumbnailUrl = thumbnailPreview; // Default to current preview (could be old URL)
            // If we have a new file, upload it
            if (thumbnailFile) {
                setProcessingStage('Uploading Cover...');
                const tUrl = await storageService.uploadFile(thumbnailFile);
                if (tUrl) thumbnailUrl = tUrl;
            }

            // Fallback default
            if (!thumbnailUrl) {
                thumbnailUrl = `https://placehold.co/400x400/f1f5f9/64748b?text=${encodeURIComponent(name)}`;
            }

            setProcessingStage('Saving Metadata...');

            const modelData = {
                id: isEditing && id ? id : crypto.randomUUID(),
                name: name,
                categoryId: finalCategoryId,
                file: publicUrl,
                thumbnail: thumbnailUrl,
                config: {
                    shape: 'custom',
                    category: finalCategoryId,
                    customModelUrl: publicUrl,
                    dynamicSVGPaths: extractedPaths,
                    hiddenMeshes: Array.from(hiddenMeshes),
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
            };

            // 3. Save/Update Record
            if (isEditing) {
                await storageService.updateModel(modelData as any);
            } else {
                await storageService.addModel(modelData as any);
            }

            // Done
            navigate('/admin/models');

        } catch (error) {
            console.error(error);
            alert('Operation Failed');
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
                    <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Model' : 'Upload New Model'}</h1>
                    <p className="text-gray-500">Preview 3D geometry and UV layout before publishing.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Preview Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 3D Preview */}
                    <div className="bg-gray-100 rounded-xl overflow-hidden aspect-video border border-gray-200 relative group">
                        {previewUrl ? (
                            <Suspense fallback={
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 gap-2">
                                    <Loader2 className="animate-spin" /> Loading 3D Preview...
                                </div>
                            }>
                                <ModelPreview
                                    url={previewUrl}
                                    hiddenMeshes={Array.from(hiddenMeshes)}
                                    captureRef={captureRef}
                                />
                            </Suspense>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                No Model Selected
                            </div>
                        )}

                        {/* Capture Button Overlay */}
                        {previewUrl && (
                            <div className="absolute bottom-4 right-4 z-10">
                                <button
                                    onClick={handleCaptureCover}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg shadow-sm hover:bg-white hover:text-brand-600 font-medium transition"
                                >
                                    <Camera size={18} />
                                    Capture Cover
                                </button>
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
                    {/* Thumbnail Preview */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Cover Image</h3>
                        <div className="aspect-[4/3] bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-dashed border-gray-300 relative">
                            {thumbnailPreview ? (
                                <img src={thumbnailPreview} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs text-gray-400 text-center px-4">Rotate model and click "Capture Cover"</span>
                            )}
                        </div>
                    </div>

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
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <button
                                    onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                                >
                                    {isCreatingCategory ? 'Select Existing' : 'Create New'}
                                </button>
                            </div>

                            {isCreatingCategory ? (
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="w-full px-3 py-2 border border-brand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-brand-50/20"
                                    placeholder="Enter new category name..."
                                />
                            ) : (
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
                            )}
                        </div>
                    </div>

                    {/* Mesh Visibility Controls */}
                    {detectedMeshes.length > 0 && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-semibold text-gray-900 mb-4">Texture Mesh Visibility</h3>
                            <p className="text-xs text-gray-500 mb-3">Uncheck meshes to hide them (e.g. internal helpers or duplicate geometry).</p>
                            <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2 bg-gray-50">
                                {detectedMeshes.map(meshName => (
                                    <label key={meshName} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 cursor-pointer hover:border-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={!hiddenMeshes.has(meshName)}
                                            onChange={() => toggleMeshVisibility(meshName)}
                                            className="rounded text-brand-600 focus:ring-brand-500"
                                        />
                                        <span className={`text-sm ${hiddenMeshes.has(meshName) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                            {meshName}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Submit Action */}
                    <div className="pt-4">
                        <button
                            onClick={handleUpload}
                            disabled={!name || !categoryId || isProcessing || (!isEditing && !file)}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition
                                ${!name || !categoryId ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98]'}
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
                                    <span>{isEditing ? 'Update Model' : 'Publish Model'}</span>
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
