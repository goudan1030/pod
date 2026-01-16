import * as THREE from 'three';

// --- Types ---

interface Edge {
    a: number; // Vertex Index A
    b: number; // Vertex Index B
    u1: number; v1: number; // UV Coordinate overlap vertex A
    u2: number; v2: number; // UV Coordinate overlap vertex B
}

interface UVLoop {
    points: { u: number; v: number }[];
    area: number;
}

// --- Constants ---
const PRECISION = 10000; // For float comparison

/**
 * Main function: Convert a Mesh's UVs into an SVG Path string
 * @param mesh The Three.js Mesh
 * @param canvasWidth Target canvas width (for scaling, optional)
 * @param canvasHeight Target canvas height
 */
export function extractSVGPathFromMesh(mesh: THREE.Mesh): { d: string; width: number; height: number; minU: number; minV: number } | null {
    const geometry = mesh.geometry;
    if (!geometry) return null;

    const uvAttribute = geometry.getAttribute('uv');
    const indexAttribute = geometry.getIndex();
    if (!uvAttribute) return null;

    // 1. Extract all edges and count occurrences
    // A boundary edge is an edge shared by exactly 1 triangle in UV space.
    // Note: In 3D space it might be shared, but in UV space (seams), it's a boundary.

    // Helper to generate a unique key for an edge based on UV coordinates
    // We use UVs instead of Vertex Indices because a single 3D vertex can have multiple UVs (seams)
    const uvKey = (u: number, v: number) => `${Math.round(u * PRECISION)}_${Math.round(v * PRECISION)}`;
    const edgeKey = (u1: number, v1: number, u2: number, v2: number) => {
        const k1 = uvKey(u1, v1);
        const k2 = uvKey(u2, v2);
        return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`; // Order independent
    };

    const edgeCounts = new Map<string, number>();
    const edgeData = new Map<string, { u1: number, v1: number, u2: number, v2: number }>();

    const vertexCount = indexAttribute ? indexAttribute.count : uvAttribute.count;
    const getUV = (i: number) => {
        let idx = i;
        if (indexAttribute) idx = indexAttribute.getX(i);
        return { u: uvAttribute.getX(idx), v: uvAttribute.getY(idx) };
    };

    for (let i = 0; i < vertexCount; i += 3) {
        const a = getUV(i);
        const b = getUV(i + 1);
        const c = getUV(i + 2);

        // Edges: AB, BC, CA
        const processEdge = (p1: { u: number, v: number }, p2: { u: number, v: number }) => {
            const key = edgeKey(p1.u, p1.v, p2.u, p2.v);
            edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
            if (!edgeData.has(key)) {
                edgeData.set(key, { u1: p1.u, v1: p1.v, u2: p2.u, v2: p2.v });
            }
        };

        processEdge(a, b);
        processEdge(b, c);
        processEdge(c, a);
    }

    // 2. Filter for Boundary Edges (count === 1)
    const boundarySegments: { u1: number, v1: number, u2: number, v2: number }[] = [];
    for (const [key, count] of edgeCounts.entries()) {
        if (count === 1) {
            boundarySegments.push(edgeData.get(key)!);
        }
    }

    if (boundarySegments.length < 3) return null;

    // 3. Stitch Segments into Loops (Ordered Polygons)
    const loops: UVLoop[] = StitchSegments(boundarySegments);

    if (loops.length === 0) return null;

    // 4. Calculate Bounds
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    loops.forEach(loop => {
        loop.points.forEach(p => {
            minU = Math.min(minU, p.u);
            maxU = Math.max(maxU, p.u);
            minV = Math.min(minV, p.v);
            maxV = Math.max(maxV, p.v);
        });
    });

    const width = maxU - minU;
    const height = maxV - minV;

    // Ignore tiny noise
    if (width < 0.01 || height < 0.01) return null;

    // 5. Generate SVG Path
    // Coordinate System Note:
    // UV: V grows UP (0 at bottom, 1 at top).
    // SVG: Y grows DOWN (0 at top).
    // Let's output in distinct "Shape Space" (0 to width, 0 to height).
    // So p.u - minU, and for V... 
    // Let's flip V so the shape looks "upright" in the SVG editor.
    // newV = maxV - p.v

    // NOTE: The SVG "d" string will be in normalized 0..1 units relative to the bounding box if we desire,
    // OR we output the exact width/height relative to UV space (0..1 global).
    // Let's keep the relative dimensions (e.g. 0.35 width) to maintain aspect ratio logic.

    const svgPaths: string[] = [];

    loops.forEach(loop => {
        const d = loop.points.map((p, i) => {
            const x = (p.u - minU);
            // V flip: map v=[minV, maxV] to y=[height, 0]
            const y = (maxV - p.v);

            // Note: If we want to keep high precision, we keep floats.
            const cmd = i === 0 ? 'M' : 'L';
            return `${cmd}${x.toFixed(5)},${y.toFixed(5)}`;
        }).join(' ') + ' Z';
        svgPaths.push(d);
    });

    return {
        d: svgPaths.join(' '),
        width: width,
        height: height,
        minU,
        minV
    };
}

/**
 * Stitch unordered segments into closed loops
 */
function StitchSegments(segments: { u1: number, v1: number, u2: number, v2: number }[]): UVLoop[] {
    // 1. Build Adjacency Graph
    const adj = new Map<string, string[]>(); // pointKey -> [pointKey, pointKey]
    const pKey = (u: number, v: number) => `${Math.round(u * PRECISION)}_${Math.round(v * PRECISION)}`;
    const pVal = (key: string) => {
        const [u, v] = key.split('_').map(n => parseInt(n) / PRECISION);
        return { u, v };
    };

    segments.forEach(seg => {
        const start = pKey(seg.u1, seg.v1);
        const end = pKey(seg.u2, seg.v2);

        if (!adj.has(start)) adj.set(start, []);
        if (!adj.has(end)) adj.set(end, []);

        // Avoid self-loops or duplicate entries if segments are unclean
        if (!adj.get(start)!.includes(end)) adj.get(start)!.push(end);
        if (!adj.get(end)!.includes(start)) adj.get(end)!.push(start);
    });

    // 2. Walk the graph
    const loops: UVLoop[] = [];
    const visited = new Set<string>();

    for (const [startKey, neighbors] of adj.entries()) {
        if (visited.has(startKey)) continue;
        // Ideally boundary points have degree 2. 
        // If >2, it means butterfly vertex or self-intersection. Simple walking might take a random turn.
        // For simple UV layouts, degree usually is 2.

        const loopPoints: { u: number, v: number }[] = [];
        let curr = startKey;
        let prev = '';

        // Trace loop
        while (!visited.has(curr)) {
            visited.add(curr);
            loopPoints.push(pVal(curr));

            const nextCandidates = adj.get(curr)!;
            // Find neighbor that isn't prev
            let next = nextCandidates.find(n => n !== prev);

            // Helper: if multiple choices (degree > 2), this naive approach picks the first one.
            // A more robust approach needs to follow "sharpest turn" or geometric continuity, 
            // but for standard UV shells naive is usually fine.

            if (!next) {
                // Dead end? Should not happen in closed loops.
                // Could handle "open" paths if needed.
                break;
            }

            prev = curr;
            curr = next;

            if (curr === startKey) break; // Closed loop
        }

        if (loopPoints.length > 2) {
            loops.push({ points: loopPoints, area: 0 });
        }
    }

    return loops;
}
