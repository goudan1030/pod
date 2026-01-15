import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { X, Layout, Upload, Undo2, Redo2, Trash2, MousePointer2, Hand, ZoomIn, ZoomOut, Move, Layers, GripVertical, Image as ImageIcon, Maximize, Palette, Check, Square, Plus } from 'lucide-react';
import { PackagingState } from '../types';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, OrbitControls, Environment } from '@react-three/drei';
import { PackagingMesh } from './Scene';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Constants for SVG Shapes ---
const REGION_SVG_PATHS: Record<string, { d: string, w: number, h: number }> = {
    front: {
        d: "M0,185Q154,430.5,48.5,527L48.5,1502.5L1017,1502.5L1017,527Q902.5,436,1065,185Q850,58,754,0Q717,234.5,533,234.5Q351,241.5,311,0L0,185Z",
        w: 1065,
        h: 1502.5
    },
    back: {
        d: "M0,1502.5006L1060.5,1502.5006L1060.5,510.00049Q895.5,385.50586,1028,106.00307Q793,36.505859,692.5,0Q591,39.005859,525,39.005859Q436.5,39.005859,373.5,0L38,106.00391Q152,441.00586,0.5,510.00049Q0.5,641.00049,0,1502.5006Z",
        w: 1060.5,
        h: 1502.5
    },
    sleeve_l: {
        d: "M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z",
        w: 773,
        h: 531
    },
    sleeve_r: {
        d: "M0,212L0,531L773,531L773,212C667.5,182,579.75,0,386.5,0C193.25,0,93.5,187,0,212Z",
        w: 773,
        h: 531
    },
    collar: {
        d: "M0,0L773,0L773,170L0,170Z",
        w: 773,
        h: 170
    }
};

// --- Types ---

interface Layer {
    id: string;
    type: 'image' | 'color';
    src: string; // Image URL or Color Hex
    imgElement: HTMLImageElement | null; // Null for color layers
    x: number; // Center X in Canvas Coordinates
    y: number; // Center Y in Canvas Coordinates
    width: number; // Original Width
    height: number; // Original Height
    rotation: number; // Degrees
    scale: number;
}

interface Region {
    id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    path?: string; // Optional SVG path for custom shapes
}

// UV Layout for auto-packing
interface UVLayout {
    partIndex: number;
    // Original UV bounds
    originalMinU: number;
    originalMaxU: number;
    originalMinV: number;
    originalMaxV: number;
    // Packed position on canvas (in pixels)
    packedX: number;
    packedY: number;
    packedW: number;
    packedH: number;
}

interface ViewportState {
    x: number; // Pan X
    y: number; // Pan Y
    scale: number; // Zoom Level
}

interface TextureEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (url: string) => void;
    initialImage: string | null;
    config: PackagingState;
}

// --- Helper: Color Picker Component ---
const ColorPickerPopup: React.FC<{
    color: string | null;
    onChange: (c: string | null) => void;
    position: { x: number, y: number };
    onClose: () => void;
}> = ({ color, onChange, position, onClose }) => {
    const [hex, setHex] = useState(color || '#ffffff');

    useEffect(() => {
        setHex(color || '#ffffff');
    }, [color]);

    const handleHexChange = (val: string) => {
        setHex(val);
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            onChange(val);
        }
    };

    return (
        <div
            className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-64 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: position.x, top: position.y }}
            onMouseDown={e => e.stopPropagation()} // Prevent canvas drag
        >
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Face Color</span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>

            {/* Transparent Option */}
            <div className="mb-4">
                <div className="text-xs font-medium text-gray-700 mb-1.5">Transparent</div>
                <button
                    onClick={() => onChange(null)}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${!color ? 'border-brand-500 ring-2 ring-brand-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                    {!color && <Check size={14} className="text-brand-600" />}
                    <div className="absolute inset-0 -z-10 rounded-full opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '4px 4px' }}></div>
                </button>
            </div>

            {/* Color Input */}
            <div className="mb-4">
                <div className="text-xs font-medium text-gray-700 mb-1.5">Color</div>
                <div className="relative w-full h-24 rounded-lg overflow-hidden cursor-pointer shadow-sm border border-gray-200 mb-2 group">
                    <input
                        type="color"
                        value={hex}
                        onChange={(e) => {
                            setHex(e.target.value);
                            onChange(e.target.value);
                        }}
                        className="absolute inset-0 w-full h-full p-0 border-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full h-full" style={{ backgroundColor: hex }}></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-black/10 pointer-events-none"></div>
                </div>

                {/* Hex Input */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: hex }}></div>
                    <input
                        type="text"
                        value={hex}
                        onChange={(e) => handleHexChange(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-mono text-gray-600 focus:outline-none focus:border-brand-500 uppercase"
                    />
                </div>
            </div>
        </div>
    );
};

// --- Optimized PreviewScene ---
const PreviewScene: React.FC<{ config: PackagingState; canvasRef: React.RefObject<HTMLCanvasElement | null>; version: number }> = ({ config, canvasRef, version }) => {
    const [canvasTexture, setCanvasTexture] = useState<THREE.CanvasTexture | null>(null);

    useEffect(() => {
        let tex: THREE.CanvasTexture | null = null;
        if (canvasRef.current) {
            tex = new THREE.CanvasTexture(canvasRef.current);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 16;
            tex.flipY = true; // Canvas Y-axis is inverted, need to flip
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            setCanvasTexture(tex);
        }
        // Cleanup texture on unmount or update to prevent GPU memory leaks
        return () => {
            if (tex) tex.dispose();
        };
    }, [version, canvasRef]);

    useFrame(() => {
        if (canvasTexture) canvasTexture.needsUpdate = true;
    });

    return (
        <React.Suspense fallback={null}>
            <color attach="background" args={['#f3f4f6']} />
            {/* Natural lighting environment */}
            <Environment preset="city" />

            {/* Subtle balanced lights */}
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-5, 5, 5]} intensity={0.3} />
            <Center>
                <PackagingMesh config={{ ...config, textureUrl: null }} overrideTexture={canvasTexture} />
            </Center>
            <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI} enablePan={false} autoRotate={true} autoRotateSpeed={1.0} />
        </React.Suspense>
    );
};

const TextureEditor: React.FC<TextureEditorProps> = ({ isOpen, onClose, onSave, initialImage, config }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // -- State --
    const [layers, setLayers] = useState<Layer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    // Face/Region Colors
    const [faceColors, setFaceColors] = useState<Record<string, string | null>>({});
    const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [colorPickerPos, setColorPickerPos] = useState<{ x: number, y: number } | null>(null);

    // Custom Model Data
    const [customUVs, setCustomUVs] = useState<Float32Array[]>([]);
    // Store named parts from the GLB with their boundary edges
    const [customParts, setCustomParts] = useState<{ name: string; uvs: Float32Array; boundaries: Float32Array }[]>([]);
    // Store UV layout mapping (for auto-packing)
    const [customPartsLayout, setCustomPartsLayout] = useState<UVLayout[]>([]);
    const [isLoadingUVs, setIsLoadingUVs] = useState(false);
    const [previewVersion, setPreviewVersion] = useState(0);
    const [cursorStyle, setCursorStyle] = useState('default');

    // Viewport State (Infinite Canvas)
    const [view, setView] = useState<ViewportState>({ x: 0, y: 0, scale: 0.4 }); // Start zoomed out slightly

    // Interaction State
    const interactionRef = useRef<{
        mode: 'none' | 'pan' | 'move_layer' | 'rotate_layer' | 'scale_layer';
        startMouse: { x: number; y: number }; // Screen Coords
        startView: ViewportState;
        startLayer: Layer | null;
        activeHandle?: string; // 'tl', 'tr', 'bl', 'br', 'rot'
    }>({
        mode: 'none',
        startMouse: { x: 0, y: 0 },
        startView: { x: 0, y: 0, scale: 1 },
        startLayer: null
    });

    // -- Config & Init --

    const canvasConfig = useMemo(() => {
        switch (config.shape) {
            case 'mannequin':
            case 'custom': return { width: 2048, height: 1024 };
            case 'bottle':
            case 'can': return { width: 2048, height: 1024 };
            default: return { width: 1024, height: 1024 };
        }
    }, [config.shape]);

    /**
     * 从 custom 模型的 UV 中生成多个区域
     * 这里采用「按 UV 网格聚类」的策略：
     * - 先把 UV 点落到一个固定分辨率的网格上（例如 64x64）
     * - 然后对网格里连续占用的格子做连通块分析，得到多个 UV 岛
     * 好处：复杂度近似 O(N)，比暴力 O(N^2) 聚类可靠很多。
     */
    const customUvIslands = useMemo(() => {
        if (!customUVs.length) return [];

        type Island = { minU: number; maxU: number; minV: number; maxV: number };
        const islands: Island[] = [];

        // 网格分辨率，越大越精细；提高到 128 以避免相邻大块被误连
        const GRID = 128;
        // 进入连通块时的最小占用阈值，避免“单点细线”把两块误连
        const MIN_COUNT = 2;

        // 记录哪些网格单元被 UV 点占用了，以及这个单元里的 UV 范围
        const cellBounds = new Map<string, Island & { count: number }>();

        customUVs.forEach(uvData => {
            for (let i = 0; i + 1 < uvData.length; i += 2) {
                const uRaw = uvData[i];
                const vRaw = uvData[i + 1];
                if (!Number.isFinite(uRaw) || !Number.isFinite(vRaw)) continue;

                // UV 理论范围是 0-1，但有些模型会略微越界，这里 clamp 一下
                const u = Math.min(1, Math.max(0, uRaw));
                const v = Math.min(1, Math.max(0, vRaw));

                const gx = Math.floor(u * (GRID - 1));
                const gy = Math.floor(v * (GRID - 1));
                const key = `${gx},${gy}`;

                const existed = cellBounds.get(key);
                if (existed) {
                    existed.minU = Math.min(existed.minU, u);
                    existed.maxU = Math.max(existed.maxU, u);
                    existed.minV = Math.min(existed.minV, v);
                    existed.maxV = Math.max(existed.maxV, v);
                    existed.count += 1;
                } else {
                    cellBounds.set(key, { minU: u, maxU: u, minV: v, maxV: v, count: 1 });
                }
            }
        });

        if (!cellBounds.size) return [];

        // 在网格上做连通块（4 邻接），把相邻的 cell 聚成一个 UV 岛
        const visited = new Set<string>();
        const directions = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        for (const [key, bounds] of cellBounds.entries()) {
            if (visited.has(key)) continue;

            const [startGX, startGY] = key.split(',').map(Number);
            let queue: Array<[number, number]> = [[startGX, startGY]];
            visited.add(key);

            let islandMinU = bounds.minU;
            let islandMaxU = bounds.maxU;
            let islandMinV = bounds.minV;
            let islandMaxV = bounds.maxV;

            while (queue.length) {
                const [cx, cy] = queue.pop()!;

                for (const [dx, dy] of directions) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
                    const nKey = `${nx},${ny}`;
                    if (visited.has(nKey)) continue;
                    const cell = cellBounds.get(nKey);
                    if (!cell || cell.count < MIN_COUNT) continue;

                    visited.add(nKey);
                    queue.push([nx, ny]);

                    islandMinU = Math.min(islandMinU, cell.minU);
                    islandMaxU = Math.max(islandMaxU, cell.maxU);
                    islandMinV = Math.min(islandMinV, cell.minV);
                    islandMaxV = Math.max(islandMaxV, cell.maxV);
                }
            }

            const area = (islandMaxU - islandMinU) * (islandMaxV - islandMinV);
            // 过滤非常小的噪点
            if (area > 0.001) {
                islands.push({ minU: islandMinU, maxU: islandMaxU, minV: islandMinV, maxV: islandMaxV });
            }
        }

        return islands;
    }, [customUVs]);

    // Define Clickable Regions based on Shape
    const getRegions = useCallback((w: number, h: number): Region[] => {
        // 1. Mannequin / T-shirt (Official Template)
        if (config.shape === 'mannequin') {
            return [
                { id: 'front', label: '前片 (Front)', x: 0, y: 0, w: w * 0.35, h: h },
                { id: 'back', label: '后片 (Back)', x: w * 0.35, y: 0, w: w * 0.35, h: h },
                { id: 'sleeve_l', label: '左袖 (Sleeve L)', x: w * 0.70, y: 0, w: w * 0.30, h: h * 0.34 },
                { id: 'sleeve_r', label: '右袖 (Sleeve R)', x: w * 0.70, y: h * 0.34, w: w * 0.30, h: h * 0.33 },
                { id: 'collar', label: '领口 (Collar)', x: w * 0.70, y: h * 0.67, w: w * 0.30, h: h * 0.33 },
            ];
        }

        // 1.5 Custom Model (Dynamic regions based on mesh parts)
        if (config.shape === 'custom' && customPartsLayout.length > 0) {
            return customPartsLayout.map(layout => {
                const part = customParts[layout.partIndex];
                return {
                    id: part.name,
                    label: part.name,
                    x: layout.packedX,
                    y: layout.packedY,
                    w: layout.packedW,
                    h: layout.packedH
                };
            });
        }
        // 2. Bottle / Can
        if (config.shape === 'bottle' || config.shape === 'can') {
            const spacing = 20;
            return [{ id: 'label_main', label: 'Wrap Label', x: spacing, y: spacing, w: w - spacing * 2, h: h - spacing * 2 }];
        }
        // 3. Pouch
        if (config.shape === 'pouch') {
            const spacing = 30;
            const halfW = (w - spacing * 3) / 2;
            return [
                { id: 'front', label: 'Front', x: spacing, y: spacing, w: halfW, h: h - spacing * 2 },
                { id: 'back', label: 'Back', x: halfW + spacing * 2, y: spacing, w: halfW, h: h - spacing * 2 },
            ];
        }
        // 4. Boxes
        if (['box', 'mailer', 'tuck'].includes(config.shape)) {
            const spacing = 15;
            const side = (w - spacing * 5) / 4;
            return [
                { id: 'top', label: 'Top', x: side + spacing * 2, y: spacing, w: side, h: side },
                { id: 'front', label: 'Front', x: side + spacing * 2, y: side + spacing * 2, w: side, h: side },
                { id: 'bottom', label: 'Bottom', x: side + spacing * 2, y: side * 2 + spacing * 3, w: side, h: side },
                { id: 'left', label: 'Left', x: spacing, y: side + spacing * 2, w: side, h: side },
                { id: 'right', label: 'Right', x: side * 2 + spacing * 3, y: side + spacing * 2, w: side, h: side },
                { id: 'back', label: 'Back', x: side * 3 + spacing * 4, y: side + spacing * 2, w: side, h: side },
            ];
        }
        return [];
    }, [config.shape, customUvIslands, customParts, customPartsLayout]);

    const regions = useMemo(() => getRegions(canvasConfig.width, canvasConfig.height), [getRegions, canvasConfig]);

    // Actions
    const fitToScreen = useCallback(() => {
        if (containerRef.current) {
            const cw = containerRef.current.clientWidth;
            const ch = containerRef.current.clientHeight;
            const scaleX = (cw - 100) / canvasConfig.width;
            const scaleY = (ch - 100) / canvasConfig.height;
            const newScale = Math.min(scaleX, scaleY, 0.9);
            setView({
                x: (cw - canvasConfig.width * newScale) / 2,
                y: (ch - canvasConfig.height * newScale) / 2,
                scale: newScale
            });
        }
    }, [canvasConfig]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(fitToScreen, 10);
        }
    }, [isOpen, fitToScreen]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
                setLayers(prev => prev.filter(l => l.id !== selectedLayerId));
                setSelectedLayerId(null);
                setPreviewVersion(v => v + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedLayerId]);

    // UV Auto-Layout Algorithm (Bin Packing)
    const computeUVLayout = (
        parts: { name: string; uvs: Float32Array; boundaries: Float32Array }[],
        canvasWidth: number,
        canvasHeight: number
    ): UVLayout[] => {
        if (parts.length === 0) return [];

        const layouts: UVLayout[] = [];
        const PADDING = 20; // 部件之间的间距

        // 1. 计算每个part的UV包围盒
        interface PartBounds {
            index: number;
            minU: number;
            maxU: number;
            minV: number;
            maxV: number;
            width: number;  // UV空间的宽度 (0-1)
            height: number; // UV空间的高度 (0-1)
        }

        const bounds: PartBounds[] = parts.map((part, index) => {
            let minU = 1, maxU = 0, minV = 1, maxV = 0;
            const uvs = part.uvs;

            for (let i = 0; i < uvs.length; i += 2) {
                const u = uvs[i];
                const v = uvs[i + 1];
                if (Number.isFinite(u) && Number.isFinite(v)) {
                    minU = Math.min(minU, u);
                    maxU = Math.max(maxU, u);
                    minV = Math.min(minV, v);
                    maxV = Math.max(maxV, v);
                }
            }

            return {
                index,
                minU, maxU, minV, maxV,
                width: maxU - minU,
                height: maxV - minV
            };
        });

        // 2. 按面积从大到小排序 (大的先放,提高装箱效率)
        bounds.sort((a, b) => (b.width * b.height) - (a.width * a.height));

        // 3. 简单行式装箱:从左到右,从上到下排列
        let currentX = PADDING;
        let currentY = PADDING;
        let rowHeight = 0;
        const maxWidth = canvasWidth - PADDING * 2;

        bounds.forEach(bound => {
            // 将UV尺寸转换为像素尺寸 (保持宽高比,缩放到合适大小)
            // 假设我们让最大的部件占画布的约40%宽度
            const scaleFactor = Math.min(
                (canvasWidth * 0.35) / bound.width,
                (canvasHeight * 0.35) / bound.height
            );
            const pixelW = Math.max(100, bound.width * scaleFactor);
            const pixelH = Math.max(100, bound.height * scaleFactor);

            // 检查是否需要换行
            if (currentX + pixelW > maxWidth && currentX > PADDING) {
                currentX = PADDING;
                currentY += rowHeight + PADDING;
                rowHeight = 0;
            }

            // 记录布局
            layouts.push({
                partIndex: bound.index,
                originalMinU: bound.minU,
                originalMaxU: bound.maxU,
                originalMinV: bound.minV,
                originalMaxV: bound.maxV,
                packedX: currentX,
                packedY: currentY,
                packedW: pixelW,
                packedH: pixelH
            });

            // 更新当前位置
            currentX += pixelW + PADDING;
            rowHeight = Math.max(rowHeight, pixelH);
        });

        return layouts;
    };

    // Load Custom UVs
    useEffect(() => {
        if (config.shape === 'custom' && config.customModelUrl) {
            setIsLoadingUVs(true);
            const loader = new GLTFLoader();
            loader.load(config.customModelUrl, (gltf) => {
                const allUvs: Float32Array[] = [];
                const parts: { name: string; uvs: Float32Array; boundaries: Float32Array }[] = [];

                // Helper to extract UVs
                const getUVs = (mesh: THREE.Mesh) => {
                    const uvAttr = mesh.geometry.getAttribute('uv');
                    const idxAttr = mesh.geometry.getIndex();
                    let uvData: Float32Array | null = null;

                    if (uvAttr) {
                        if (idxAttr) {
                            uvData = new Float32Array(idxAttr.count * 2);
                            for (let i = 0; i < idxAttr.count; i++) {
                                const idx = idxAttr.getX(i);
                                uvData[i * 2] = uvAttr.getX(idx);
                                uvData[i * 2 + 1] = uvAttr.getY(idx);
                            }
                        } else {
                            uvData = uvAttr.array as Float32Array;
                        }
                    }
                    return uvData;
                };

                // Helper: Calculate Boundary Edges (edges used only once)
                const getBoundaryEdges = (uvs: Float32Array): Float32Array => {
                    const edges = new Map<string, number>();
                    const PRE = 10000; // Precision for hashing (handling float drift)

                    // Helper to create edge key
                    const hashIdx = (u: number, v: number) => `${Math.round(u * PRE)}_${Math.round(v * PRE)}`;
                    const edgeKey = (u1: number, v1: number, u2: number, v2: number) => {
                        const h1 = hashIdx(u1, v1);
                        const h2 = hashIdx(u2, v2);
                        return h1 < h2 ? `${h1}|${h2}` : `${h2}|${h1}`;
                    };

                    // 1. Count edge occurrences
                    for (let i = 0; i < uvs.length; i += 6) {
                        // Triangle vertices: (0,1), (2,3), (4,5)
                        const k1 = edgeKey(uvs[i], uvs[i + 1], uvs[i + 2], uvs[i + 3]);
                        const k2 = edgeKey(uvs[i + 2], uvs[i + 3], uvs[i + 4], uvs[i + 5]);
                        const k3 = edgeKey(uvs[i + 4], uvs[i + 5], uvs[i], uvs[i + 1]);

                        edges.set(k1, (edges.get(k1) || 0) + 1);
                        edges.set(k2, (edges.get(k2) || 0) + 1);
                        edges.set(k3, (edges.get(k3) || 0) + 1);
                    }

                    // 2. Collect boundary edges (count === 1)
                    const boundarySegments: number[] = [];

                    // We need to reconstruct coordinates from keys?
                    // Or better: Iterate triangles again and check counts.
                    // Re-iteration is safer to retrieve exact float values.

                    for (let i = 0; i < uvs.length; i += 6) {
                        const checkEdge = (uA: number, vA: number, uB: number, vB: number) => {
                            const key = edgeKey(uA, vA, uB, vB);
                            if (edges.get(key) === 1) {
                                boundarySegments.push(uA, vA, uB, vB);
                            }
                        };

                        checkEdge(uvs[i], uvs[i + 1], uvs[i + 2], uvs[i + 3]);
                        checkEdge(uvs[i + 2], uvs[i + 3], uvs[i + 4], uvs[i + 5]);
                        checkEdge(uvs[i + 4], uvs[i + 5], uvs[i], uvs[i + 1]);
                    }

                    return new Float32Array(boundarySegments);
                };

                // Traverse entire scene graph
                gltf.scene.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        const uvData = getUVs(mesh);

                        // Filter: 至少需要3个三角形
                        if (uvData && uvData.length >= 18) {
                            // 计算UV面积
                            let minU = 1, maxU = 0, minV = 1, maxV = 0;
                            for (let i = 0; i < uvData.length; i += 2) {
                                const u = uvData[i];
                                const v = uvData[i + 1];
                                if (Number.isFinite(u) && Number.isFinite(v)) {
                                    minU = Math.min(minU, u);
                                    maxU = Math.max(maxU, u);
                                    minV = Math.min(minV, v);
                                    maxV = Math.max(maxV, v);
                                }
                            }

                            const uvArea = (maxU - minU) * (maxV - minV);
                            const vertexCount = uvData.length / 2;
                            // 只保留UV面积 > 0.01 或顶点数 > 1000的部件
                            const isSignificant = uvArea > 0.01 || vertexCount > 1000;

                            if (isSignificant) {
                                allUvs.push(uvData);
                                if (mesh.name) {
                                    const bounds = getBoundaryEdges(uvData);
                                    if (bounds.length > 0) {
                                        parts.push({
                                            name: mesh.name,
                                            uvs: uvData,
                                            boundaries: bounds
                                        });
                                    }
                                }
                            }
                        }
                    }
                });

                // Auto-pack UV islands to avoid overlap
                const layout = computeUVLayout(parts, canvasConfig.width, canvasConfig.height);

                setCustomUVs(allUvs);
                setCustomParts(parts);
                setCustomPartsLayout(layout);
                setIsLoadingUVs(false);
            });
        }
    }, [config.customModelUrl, config.shape]);

    useEffect(() => {
        if (initialImage && layers.length === 0) {
            addLayer(initialImage);
        }
    }, [initialImage]);

    const addLayer = (src: string) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const newLayer: Layer = {
                id: crypto.randomUUID(),
                type: 'image',
                src,
                imgElement: img,
                x: canvasConfig.width / 2,
                y: canvasConfig.height / 2,
                width: img.width,
                height: img.height,
                rotation: 0,
                scale: Math.min(500 / img.width, 1),
            };
            setLayers(prev => [...prev, newLayer]);
            setSelectedLayerId(newLayer.id);
            setPreviewVersion(v => v + 1);
        };
    };

    const addColorBlock = () => {
        const size = 300;
        const newLayer: Layer = {
            id: crypto.randomUUID(),
            type: 'color',
            src: '#3b82f6',
            imgElement: null,
            x: canvasConfig.width / 2,
            y: canvasConfig.height / 2,
            width: size,
            height: size,
            rotation: 0,
            scale: 1,
        };
        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        setPreviewVersion(v => v + 1);
    };

    const updateColorLayer = (id: string, color: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, src: color } : l));
        setPreviewVersion(v => v + 1);
    }

    // --- UV Boundary Helpers (for Custom Models/Hoodies) ---
    const getUVPath = useCallback((r: Region) => {
        // Find the custom part associated with this region
        const part = customParts.find(p => p.name === r.id);
        if (!part || !part.boundaries || part.boundaries.length === 0) return null;

        const layout = customPartsLayout.find(l => customParts[l.partIndex].name === r.id);
        if (!layout) return null;

        // Normalize segments to 0-1 within their own bounding box
        let path = "";
        const uvs = part.boundaries;
        // Optimization: Use a smaller coordinate space for SVG path to keep string short
        const W = 1000, H = 1000;

        for (let i = 0; i < uvs.length; i += 4) {
            const u1 = (uvs[i] - layout.originalMinU) / (layout.originalMaxU - layout.originalMinU);
            const v1 = (uvs[i + 1] - layout.originalMinV) / (layout.originalMaxV - layout.originalMinV);
            const u2 = (uvs[i + 2] - layout.originalMinU) / (layout.originalMaxU - layout.originalMinU);
            const v2 = (uvs[i + 3] - layout.originalMinV) / (layout.originalMaxV - layout.originalMinV);

            // Using Move-Line for segments. While not perfectly joined, it renders correctly 
            // and Path2D can handle it for clipping if they are coincident.
            path += `M ${u1 * W} ${v1 * H} L ${u2 * W} ${v2 * H} `;
        }
        return { d: path, w: W, h: H };
    }, [customParts, customPartsLayout]);

    // Math helpers...
    const screenToCanvas = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const relX = sx - rect.left - view.x;
        const relY = sy - rect.top - view.y;
        return { x: relX / view.scale, y: relY / view.scale };
    };

    const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = x - cx;
        const dy = y - cy;
        return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };

    const isPointInRotatedRect = (px: number, py: number, layer: Layer) => {
        const p = rotatePoint(px, py, layer.x, layer.y, -layer.rotation);
        const w = layer.width * layer.scale;
        const h = layer.height * layer.scale;
        return p.x >= layer.x - w / 2 && p.x <= layer.x + w / 2 &&
            p.y >= layer.y - h / 2 && p.y <= layer.y + h / 2;
    };

    // --- Render Logic (Split into Content and UI) ---

    // Helper: Check if a point is inside a region
    const isPointInRegion = (x: number, y: number, region: Region): boolean => {
        return x >= region.x && x <= region.x + region.w &&
            y >= region.y && y <= region.y + region.h;
    };

    // Helper: Get region for a layer (which region does this layer belong to)
    const getLayerRegion = (layer: Layer): Region | null => {
        // Check center point of layer
        const centerX = layer.x;
        const centerY = layer.y;

        // Find the region that contains this layer's center
        for (const region of regions) {
            if (isPointInRegion(centerX, centerY, region)) {
                return region;
            }
        }
        return null;
    };

    // 1. Render Content (The actual texture for the model)
    const renderContent = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render each region independently
        regions.forEach(region => {
            ctx.save();

            // 1. Set Shape Clipping
            const pathData = REGION_SVG_PATHS[region.id] || (config.shape === 'custom' ? getUVPath(region) : null);
            const isTshirtShape = config.shape === 'mannequin' || (config.shape === 'custom' && REGION_SVG_PATHS[region.id]);

            if (pathData) {
                const scaleX = region.w / pathData.w;
                const scaleY = region.h / pathData.h;
                const p = new Path2D(pathData.d);
                ctx.translate(region.x, region.y);
                ctx.scale(scaleX, scaleY);
                ctx.clip(p);
                // Fill background in normalized space
                ctx.fillStyle = faceColors[region.id] || config.color;
                ctx.fillRect(0, 0, pathData.w, pathData.h);
            } else {
                ctx.beginPath();
                if (isTshirtShape) {
                    const radius = Math.min(region.w, region.h) * 0.1;
                    ctx.roundRect(region.x, region.y, region.w, region.h, radius);
                } else {
                    ctx.rect(region.x, region.y, region.w, region.h);
                }
                ctx.clip();
                ctx.fillStyle = faceColors[region.id] || config.color;
                ctx.fillRect(region.x, region.y, region.w, region.h);
            }

            // 2. Render Layers belonging to this region
            layers.forEach(layer => {
                const layerRegion = getLayerRegion(layer);
                if (layerRegion && layerRegion.id === region.id) {
                    ctx.save();
                    // Critical: if we used pathData above, the matrix is currently scaled/translated.
                    // We need to either work in that space or reset to global.
                    // To keep layer positioning intuitive (global canvas coords), we reset.
                    if (pathData && isTshirtShape) {
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                    }

                    ctx.translate(layer.x, layer.y);
                    ctx.rotate((layer.rotation * Math.PI) / 180);
                    ctx.scale(layer.scale, layer.scale);

                    if (layer.type === 'color') {
                        ctx.fillStyle = layer.src;
                        ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
                    } else if (layer.imgElement) {
                        ctx.drawImage(layer.imgElement, -layer.width / 2, -layer.height / 2);
                    }
                    ctx.restore();
                }
            });

            ctx.restore();
        });

        // Render layers that don't belong to any region (fallback)
        layers.forEach(layer => {
            const layerRegion = getLayerRegion(layer);
            if (!layerRegion) {
                ctx.save();
                ctx.translate(layer.x, layer.y);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                ctx.scale(layer.scale, layer.scale);

                if (layer.type === 'color') {
                    ctx.fillStyle = layer.src;
                    ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
                } else if (layer.imgElement) {
                    ctx.drawImage(layer.imgElement, -layer.width / 2, -layer.height / 2);
                }
                ctx.restore();
            }
        });

    }, [layers, config.color, config.shape, regions, faceColors, canvasConfig]);

    // 2. Render UI (Overlays, Guides, Gizmos - NOT on the model)
    const renderUI = useCallback(() => {
        const canvas = uiCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Guides (Dashed Lines)
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5 / view.scale;
        ctx.setLineDash([10 / view.scale, 10 / view.scale]);

        // Draw the region boxes
        regions.forEach(r => {
            ctx.strokeRect(r.x, r.y, r.w, r.h);
        });

        ctx.restore();

        // Gizmos (Selection Box)
        if (selectedLayerId) {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer) {
                const w = layer.width * layer.scale;
                const h = layer.height * layer.scale;
                ctx.save();
                ctx.translate(layer.x, layer.y);
                ctx.rotate((layer.rotation * Math.PI) / 180);

                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1.5 / view.scale;
                ctx.strokeRect(-w / 2, -h / 2, w, h);

                const handleRadius = 5 / view.scale;
                const rotHandleDist = 30 / view.scale;
                ctx.fillStyle = '#ffffff';

                const drawHandle = (x: number, y: number) => {
                    ctx.beginPath();
                    ctx.arc(x, y, handleRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                };

                drawHandle(-w / 2, -h / 2); drawHandle(w / 2, -h / 2);
                drawHandle(-w / 2, h / 2); drawHandle(w / 2, h / 2);
                ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, -h / 2 - rotHandleDist); ctx.stroke();
                drawHandle(0, -h / 2 - rotHandleDist);

                ctx.restore();
            }
        }

        ctx.restore();

    }, [layers, selectedLayerId, config.shape, customUVs, customParts, view.scale, canvasConfig, regions]);

    // Trigger Renders
    useEffect(() => {
        renderContent();
    }, [renderContent]);

    useEffect(() => {
        renderUI();
    }, [renderUI]);

    // Hit testing & Interaction Handlers (same as before)
    const getHitInfo = (clientX: number, clientY: number) => {
        const canvasPt = screenToCanvas(clientX, clientY);
        if (selectedLayerId) {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (layer) {
                const w = layer.width * layer.scale;
                const h = layer.height * layer.scale;
                const rotRad = (layer.rotation * Math.PI) / 180;
                const checkHandle = (lx: number, ly: number) => {
                    const gx = layer.x + lx * Math.cos(rotRad) - ly * Math.sin(rotRad);
                    const gy = layer.y + lx * Math.sin(rotRad) + ly * Math.cos(rotRad);
                    return Math.hypot(canvasPt.x - gx, canvasPt.y - gy) < (15 / view.scale);
                };
                const rotDist = 30 / view.scale;
                if (checkHandle(0, -h / 2 - rotDist)) return { type: 'rotate', layer };
                if (checkHandle(w / 2, h / 2)) return { type: 'scale_br', layer };
                if (checkHandle(-w / 2, -h / 2)) return { type: 'scale_tl', layer };
                if (checkHandle(w / 2, -h / 2)) return { type: 'scale_tr', layer };
                if (checkHandle(-w / 2, h / 2)) return { type: 'scale_bl', layer };
            }
        }
        const labelPaddingX = 20 / view.scale;
        const labelPaddingY = 26 / view.scale;
        for (const region of regions) {
            const cx = region.x + region.w / 2;
            const cy = region.y + region.h / 2;
            if (Math.abs(canvasPt.x - cx) < 60 / view.scale && Math.abs(canvasPt.y - cy) < 15 / view.scale) {
                return { type: 'region', region };
            }
        }
        for (let i = layers.length - 1; i >= 0; i--) {
            if (isPointInRotatedRect(canvasPt.x, canvasPt.y, layers[i])) {
                return { type: 'body', layer: layers[i] };
            }
        }
        for (const region of regions) {
            if (canvasPt.x >= region.x && canvasPt.x <= region.x + region.w &&
                canvasPt.y >= region.y && canvasPt.y <= region.y + region.h) {
                return { type: 'region', region };
            }
        }
        return null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const newScale = Math.min(Math.max(0.1, view.scale - e.deltaY * zoomSensitivity), 5);
            const rect = containerRef.current!.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const wx = (mouseX - view.x) / view.scale;
            const wy = (mouseY - view.y) / view.scale;
            const newX = mouseX - wx * newScale;
            const newY = mouseY - wy * newScale;
            setView({ x: newX, y: newY, scale: newScale });
        } else {
            setView(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
        setActiveFaceId(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.nativeEvent.getModifierState('Space'))) {
            interactionRef.current = {
                mode: 'pan',
                startMouse: { x: e.clientX, y: e.clientY },
                startView: { ...view },
                startLayer: null
            };
            setCursorStyle('grabbing');
            return;
        }
        if (e.button === 0) {
            const hit = getHitInfo(e.clientX, e.clientY);
            if (hit) {
                if (hit.type === 'rotate') {
                    interactionRef.current = { mode: 'rotate_layer', startMouse: { x: e.clientX, y: e.clientY }, startView: view, startLayer: { ...hit.layer } };
                    return;
                }
                if (hit.type.startsWith('scale')) {
                    interactionRef.current = { mode: 'scale_layer', activeHandle: hit.type, startMouse: { x: e.clientX, y: e.clientY }, startView: view, startLayer: { ...hit.layer } };
                    return;
                }
                if (hit.type === 'body') {
                    setSelectedLayerId(hit.layer.id);
                    setActiveFaceId(null);
                    interactionRef.current = {
                        mode: 'move_layer',
                        startMouse: { x: e.clientX, y: e.clientY },
                        startView: view,
                        startLayer: { ...hit.layer }
                    };
                    return;
                }
                if (hit.type === 'region') {
                    setSelectedLayerId(null);
                    setActiveFaceId(hit.region.id);
                    const rect = containerRef.current!.getBoundingClientRect();
                    setColorPickerPos({
                        x: e.clientX - rect.left + 20,
                        y: e.clientY - rect.top - 50
                    });
                    return;
                }
            }
            setSelectedLayerId(null);
            setActiveFaceId(null);
            interactionRef.current = { mode: 'pan', startMouse: { x: e.clientX, y: e.clientY }, startView: view, startLayer: null };
            setCursorStyle('grabbing');
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const state = interactionRef.current;
        if (state.mode === 'none') {
            if (e.nativeEvent.getModifierState('Space')) {
                setCursorStyle('grab');
                return;
            }
            const hit = getHitInfo(e.clientX, e.clientY);
            if (hit) {
                if (hit.type === 'rotate') setCursorStyle('grab');
                else if (hit.type.startsWith('scale')) setCursorStyle('nwse-resize');
                else if (hit.type === 'body') setCursorStyle('move');
                else if (hit.type === 'region') setCursorStyle('pointer');
            } else {
                setCursorStyle('default');
            }
            return;
        }

        const dx = e.clientX - state.startMouse.x;
        const dy = e.clientY - state.startMouse.y;

        if (state.mode === 'pan') {
            setView({ ...view, x: state.startView.x + dx, y: state.startView.y + dy });
            setCursorStyle('grabbing');
        }
        else if (state.mode === 'move_layer' && state.startLayer) {
            const cdx = dx / view.scale;
            const cdy = dy / view.scale;
            setLayers(prev => prev.map(l => l.id === state.startLayer!.id ? {
                ...l,
                x: state.startLayer!.x + cdx,
                y: state.startLayer!.y + cdy
            } : l));
            setCursorStyle('move');
        }
        else if (state.mode === 'rotate_layer' && state.startLayer) {
            const rect = containerRef.current!.getBoundingClientRect();
            const cx = rect.left + view.x + state.startLayer.x * view.scale;
            const cy = rect.top + view.y + state.startLayer.y * view.scale;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
            setLayers(prev => prev.map(l => l.id === state.startLayer!.id ? { ...l, rotation: angle + 90 } : l));
            setCursorStyle('grabbing');
        }
        else if (state.mode === 'scale_layer' && state.startLayer) {
            const rect = containerRef.current!.getBoundingClientRect();
            const cx = rect.left + view.x + state.startLayer.x * view.scale;
            const cy = rect.top + view.y + state.startLayer.y * view.scale;
            const startDist = Math.hypot(state.startMouse.x - cx, state.startMouse.y - cy);
            const currDist = Math.hypot(e.clientX - cx, e.clientY - cy);
            const scaleFactor = currDist / startDist;
            setLayers(prev => prev.map(l => l.id === state.startLayer!.id ? { ...l, scale: state.startLayer!.scale * scaleFactor } : l));
            setCursorStyle('nwse-resize');
        }
    };

    const handleMouseUp = () => {
        if (interactionRef.current.mode !== 'none') {
            setPreviewVersion(v => v + 1);
            interactionRef.current = { mode: 'none', startMouse: { x: 0, y: 0 }, startView: view, startLayer: null };
            setCursorStyle('default');
        }
    };

    const handleSave = () => {
        // Since canvasRef now ONLY has content (no guides), we can just save it directly!
        if (canvasRef.current) {
            onSave(canvasRef.current.toDataURL('image/png'));
            onClose();
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = ev => { if (ev.target?.result) addLayer(ev.target.result as string); };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex bg-[#f3f4f6]">
            {/* 1. Sidebar - Layers */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-20 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Layers size={16} /> 图层管理</h2>
                    <div className="flex gap-2">
                        <label className="flex-1 py-2 px-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-medium shadow-sm" title="Add Image">
                            <Upload size={14} /><span>图片</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                        </label>
                        <button onClick={addColorBlock} className="flex-1 py-2 px-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-medium shadow-sm" title="Add Color Block">
                            <Square size={14} fill="currentColor" className="text-gray-400" /><span>色块</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {layers.length === 0 ? (
                        <div className="text-center text-gray-400 text-xs py-10 flex flex-col items-center"><ImageIcon size={32} className="mb-2 opacity-50" /><p>暂无图层</p><p>添加图片或色块开始设计</p></div>
                    ) : (
                        [...layers].reverse().map((layer, index) => (
                            <div key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={`group flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${selectedLayerId === layer.id ? 'bg-brand-50 border-brand-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <div className="cursor-grab text-gray-300 hover:text-gray-500"><GripVertical size={14} /></div>
                                <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden border border-gray-200 shrink-0 relative">
                                    {layer.type === 'color' ? (
                                        <><div className="w-full h-full" style={{ backgroundColor: layer.src }}></div>
                                            <input type="color" value={layer.src} onChange={(e) => updateColorLayer(layer.id, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></>
                                    ) : (
                                        <div className="w-full h-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${layer.src})` }} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0"><div className="text-xs font-medium text-gray-700 truncate">{layer.type === 'color' ? 'Color Block' : `Layer ${layers.length - index}`}</div><div className="text-[10px] text-gray-400 capitalize">{layer.type}</div></div>
                                <button onClick={(e) => { e.stopPropagation(); setLayers(prev => prev.filter(l => l.id !== layer.id)); if (selectedLayerId === layer.id) setSelectedLayerId(null); setPreviewVersion(v => v + 1); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"><Trash2 size={14} /></button>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-3 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 text-center">Tips: 点击画布背景可设置底色<br />添加色块可覆盖局部区域</div>
            </div>

            {/* 2. Main Canvas */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-[#f3f4f6]">
                <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-white z-20 shadow-sm">
                    <div className="flex items-center gap-4"><span className="font-bold text-gray-800 text-lg">2D 平面设计</span><div className="h-4 w-px bg-gray-200"></div><div className="flex gap-2"><button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="Undo"><Undo2 size={16} /></button><button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="Redo"><Redo2 size={16} /></button></div></div>
                    <div className="flex gap-3"><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">取消</button><button onClick={handleSave} className="px-6 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm shadow-brand-500/30">完成设计</button></div>
                </div>
                <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor: cursorStyle }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={e => e.preventDefault()}>
                    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0', width: canvasConfig.width, height: canvasConfig.height }}>
                        {/* Bottom: Content Canvas (Used for Texture) */}
                        <canvas ref={canvasRef} width={canvasConfig.width} height={canvasConfig.height} className="absolute inset-0 w-full h-full block" />

                        {/* Top: UI Canvas (Overlays, Guides - Invisible to Model) */}
                        <canvas ref={uiCanvasRef} width={canvasConfig.width} height={canvasConfig.height} className="absolute inset-0 w-full h-full block pointer-events-none" />

                        {/* SVG Regions Layer - Independent clickable regions */}
                        <svg
                            width={canvasConfig.width}
                            height={canvasConfig.height}
                            className="absolute inset-0 w-full h-full block pointer-events-auto"
                            style={{ overflow: 'visible' }}
                        >
                            {regions.map((region) => {
                                const isSelected = selectedRegionId === region.id;
                                const isHovered = selectedRegionId === region.id;
                                const hasColor = faceColors[region.id] !== null && faceColors[region.id] !== undefined;

                                // Get SVG Path and corresponding scale transform
                                const getRegionPathInfo = (r: Region) => {
                                    const pathData = REGION_SVG_PATHS[r.id] || (config.shape === 'custom' ? getUVPath(r) : null);
                                    const isTshirtShape = config.shape === 'mannequin' || (config.shape === 'custom' && REGION_SVG_PATHS[r.id]);

                                    if (pathData) {
                                        const scaleX = r.w / pathData.w;
                                        const scaleY = r.h / pathData.h;
                                        return {
                                            d: pathData.d,
                                            transform: `translate(${r.x}, ${r.y}) scale(${scaleX}, ${scaleY})`
                                        };
                                    }
                                    // Default rectangle
                                    return {
                                        d: `M 0 0 L ${r.w} 0 L ${r.w} ${r.h} L 0 ${r.h} Z`,
                                        transform: `translate(${r.x}, ${r.y})`
                                    };
                                };

                                const pathInfo = getRegionPathInfo(region);

                                return (
                                    <g
                                        key={region.id}
                                        onMouseEnter={() => setSelectedRegionId(region.id)}
                                        onMouseLeave={() => {
                                            // Keep selected if clicked, otherwise clear on leave
                                            if (!isSelected) {
                                                // setSelectedRegionId(null);
                                            }
                                        }}
                                    >
                                        {/* Region Background (if has color) */}
                                        {hasColor && (
                                            <path
                                                d={pathInfo.d}
                                                transform={pathInfo.transform}
                                                fill={faceColors[region.id] || 'transparent'}
                                                opacity={0.3}
                                                className="transition-opacity pointer-events-none"
                                            />
                                        )}

                                        {/* Region Border/Shape */}
                                        <path
                                            d={pathInfo.d}
                                            transform={pathInfo.transform}
                                            fill="rgba(255, 255, 255, 0.02)"
                                            stroke={isSelected || isHovered ? '#3b82f6' : 'rgba(0, 0, 0, 0.15)'}
                                            strokeWidth={isSelected || isHovered ? 2.5 : 1}
                                            strokeDasharray={isSelected ? '0' : '8,4'}
                                            className="cursor-pointer transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedRegionId(region.id);
                                                setActiveFaceId(region.id);
                                                const rect = containerRef.current?.getBoundingClientRect();
                                                if (rect) {
                                                    const canvasX = region.x * view.scale + view.x;
                                                    const canvasY = region.y * view.scale + view.y;
                                                    setColorPickerPos({
                                                        x: canvasX + 20,
                                                        y: canvasY - 50
                                                    });
                                                }
                                            }}
                                            style={{
                                                filter: isHovered ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none'
                                            }}
                                        />

                                        {/* Region Label - Simple Text */}
                                        <g transform={`translate(${region.x + region.w / 2}, ${region.y + region.h / 2})`}>
                                            <text
                                                x={0}
                                                y={0}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill="#666"
                                                fontSize="12"
                                                fontWeight="500"
                                                className="pointer-events-none select-none opacity-60"
                                            >
                                                {region.label}
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                    {activeFaceId && colorPickerPos && <ColorPickerPopup color={faceColors[activeFaceId]} position={colorPickerPos} onChange={(c) => { setFaceColors(prev => ({ ...prev, [activeFaceId]: c })); setPreviewVersion(v => v + 1); }} onClose={() => setActiveFaceId(null)} />}
                    <div className="absolute bottom-6 left-6 flex gap-2">
                        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center gap-1"><button onClick={() => setView(v => ({ ...v, scale: Math.max(0.1, v.scale - 0.1) }))} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"><ZoomOut size={14} /></button><span className="text-xs font-medium text-gray-600 w-10 text-center select-none">{Math.round(view.scale * 100)}%</span><button onClick={() => setView(v => ({ ...v, scale: Math.min(5, v.scale + 0.1) }))} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"><ZoomIn size={14} /></button></div>
                        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center gap-1">{[0.25, 0.5, 1.0].map(s => (<button key={s} onClick={() => setView(prev => ({ ...prev, scale: s }))} className="px-2 py-1.5 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-500 hover:text-gray-900 transition-colors">{s * 100}%</button>))}<div className="w-px h-3 bg-gray-200 mx-1"></div><button onClick={fitToScreen} className="px-2 py-1.5 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-500 hover:text-brand-600 transition-colors flex items-center gap-1" title="Fit to Screen"><Maximize size={10} /> Fit</button></div>
                    </div>
                </div>
            </div>

            {/* 3. 3D Preview */}
            <div className="absolute top-20 right-8 w-80 h-80 bg-white rounded-2xl border border-white/50 shadow-2xl overflow-hidden z-30 ring-1 ring-gray-100">
                <div className="relative w-full h-full bg-gray-50">
                    <Canvas
                        shadows
                        camera={{ position: [0, 0, 3.2], fov: 40 }}
                        gl={{
                            antialias: true,
                            toneMapping: THREE.ACESFilmicToneMapping,
                            toneMappingExposure: 1.0
                        }}
                    >
                        <React.Suspense fallback={null}>
                            <PreviewScene config={config} canvasRef={canvasRef} version={previewVersion} />
                        </React.Suspense>
                    </Canvas>
                    <div className="absolute top-3 left-3 bg-white/80 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold text-gray-500 shadow-sm uppercase tracking-wider border border-white">Live Preview</div>
                </div>
            </div>
        </div>
    );
};

export default TextureEditor;