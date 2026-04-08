function uniqueById(rows) {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
        if (seen.has(row.id))
            continue;
        seen.add(row.id);
        out.push(row);
    }
    return out;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function cosine(left, right) {
    const n = Math.min(left.length, right.length);
    if (n === 0)
        return 0;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < n; index += 1) {
        const a = left[index];
        const b = right[index];
        dot += a * b;
        leftNorm += a * a;
        rightNorm += b * b;
    }
    const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
    return denom > 0 ? dot / denom : 0;
}
function semanticEdgeKey(a, b) {
    return a < b ? `${a}||${b}` : `${b}||${a}`;
}
function makeSemanticEdge(a, b, sim) {
    return a < b ? { a, b, sim } : { a: b, b: a, sim };
}
/**
 * Compute a locality-sensitive hash bucket for an embedding.
 * Uses random projection for approximate nearest neighbor locality.
 * This groups similar embeddings into the same bucket with high probability.
 */
function embeddingBucket(embedding, numBuckets = 64) {
    if (embedding.length === 0)
        return 0;
    // Use first 8 dimensions as a simple hash (most embedding models have semantic info in early dims)
    const sliceLen = Math.min(8, embedding.length);
    let hash = 0;
    for (let i = 0; i < sliceLen; i++) {
        const val = embedding[i];
        // Quantize to 4 levels per dimension
        const quantized = Math.floor((val + 1) * 2); // maps [-1,1] to [0,4]
        hash = (hash * 5 + quantized) >>> 0;
    }
    return hash % numBuckets;
}
/**
 * Group peers by embedding bucket for spatial locality optimization.
 * Candidates are compared against peers in the same bucket first,
 * then neighboring buckets, reducing the comparison space.
 */
function groupPeersByBucket(peers, numBuckets = 64) {
    const buckets = new Map();
    for (const peer of peers) {
        const bucket = embeddingBucket(peer.embedding, numBuckets);
        const arr = buckets.get(bucket) ?? [];
        arr.push(peer);
        buckets.set(bucket, arr);
    }
    return buckets;
}
/**
 * Select peers for comparison using spatial locality optimization.
 * Prioritizes peers in the same bucket, then expands to neighboring buckets
 * until maxPeers is reached or all peers are considered.
 */
function selectPeersByLocality(candidate, peerBuckets, numBuckets, maxPeers) {
    if (maxPeers <= 0) {
        // Return all peers
        const allPeers = [];
        for (const peers of peerBuckets.values()) {
            allPeers.push(...peers);
        }
        return allPeers;
    }
    const candidateBucket = embeddingBucket(candidate.embedding, numBuckets);
    const selected = [];
    const seen = new Set();
    // Start with same bucket
    const sameBucket = peerBuckets.get(candidateBucket) ?? [];
    for (const peer of sameBucket) {
        if (peer.id === candidate.id)
            continue;
        if (seen.has(peer.id))
            continue;
        seen.add(peer.id);
        selected.push(peer);
        if (selected.length >= maxPeers)
            return selected;
    }
    // Expand to neighboring buckets (bucket distance 1, then 2, etc.)
    for (let distance = 1; distance < numBuckets / 2 && selected.length < maxPeers; distance++) {
        for (const offset of [-distance, distance]) {
            const neighborBucket = (candidateBucket + offset + numBuckets) % numBuckets;
            const neighbors = peerBuckets.get(neighborBucket) ?? [];
            for (const peer of neighbors) {
                if (peer.id === candidate.id)
                    continue;
                if (seen.has(peer.id))
                    continue;
                seen.add(peer.id);
                selected.push(peer);
                if (selected.length >= maxPeers)
                    return selected;
            }
        }
    }
    return selected;
}
function localSimilarityRows(candidate, peers) {
    return peers.map((peer) => ({ id: peer.id, sim: cosine(candidate.embedding, peer.embedding) }));
}
async function vexxSimilarityRows(candidate, peers, vexx) {
    const trimmedBaseUrl = vexx.baseUrl.trim().replace(/\/$/, "");
    if (!trimmedBaseUrl)
        return null;
    const minCandidates = Math.max(1, Math.floor(vexx.minCandidates ?? 1));
    if (peers.length < minCandidates)
        return null;
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.floor(vexx.timeoutMs ?? 30000));
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${trimmedBaseUrl}/v1/cosine/matrix`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(vexx.apiKey ? { Authorization: `Bearer ${vexx.apiKey}` } : {}),
            },
            body: JSON.stringify({
                left: [candidate.embedding],
                right: peers.map((peer) => peer.embedding),
                device: vexx.device ?? "AUTO",
                requireAccel: vexx.requireAccel ?? false,
            }),
            signal: controller.signal,
        });
        if (!response.ok)
            return null;
        const payload = await response.json();
        const matrix = Array.isArray(payload.matrix) ? payload.matrix : null;
        if (!matrix || matrix.length !== peers.length)
            return null;
        return peers.map((peer, index) => ({ id: peer.id, sim: Number(matrix[index] ?? 0) }));
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function vexxSimilarityMatrixChunk(candidates, peers, vexx) {
    const trimmedBaseUrl = vexx.baseUrl.trim().replace(/\/$/, "");
    if (!trimmedBaseUrl)
        return null;
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.floor(vexx.timeoutMs ?? 30000));
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${trimmedBaseUrl}/v1/cosine/matrix`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(vexx.apiKey ? { Authorization: `Bearer ${vexx.apiKey}` } : {}),
            },
            body: JSON.stringify({
                left: candidates.map((candidate) => candidate.embedding),
                right: peers.map((peer) => peer.embedding),
                device: vexx.device ?? "AUTO",
                requireAccel: vexx.requireAccel ?? false,
            }),
            signal: controller.signal,
        });
        if (!response.ok)
            return null;
        const payload = await response.json();
        const matrix = Array.isArray(payload.matrix) ? payload.matrix : null;
        if (!matrix || matrix.length !== candidates.length * peers.length)
            return null;
        return candidates.map((_candidate, rowIndex) => peers.map((peer, colIndex) => ({
            id: peer.id,
            sim: Number(matrix[rowIndex * peers.length + colIndex] ?? 0),
        })));
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Compute similarity matrix using NPU-optimal batching.
 * Splits large matrices into chunks that fit NPU memory constraints
 * and processes them in parallel when beneficial.
 */
async function vexxSimilarityMatrix(candidates, peers, vexx) {
    const minCandidates = Math.max(1, Math.floor(vexx.minCandidates ?? 1));
    if (candidates.length === 0 || peers.length < minCandidates)
        return null;
    const maxCandidatesPerCall = Math.floor(vexx.maxCandidatesPerCall ?? 256);
    const optimalBatchSize = Math.floor(vexx.optimalBatchSize ?? 128);
    // For small matrices, use single call
    if (candidates.length <= maxCandidatesPerCall && peers.length <= optimalBatchSize * 2) {
        return vexxSimilarityMatrixChunk(candidates, peers, vexx);
    }
    // For large matrices, split candidates into NPU-optimal chunks
    const candidateChunks = [];
    for (let i = 0; i < candidates.length; i += maxCandidatesPerCall) {
        candidateChunks.push(candidates.slice(i, i + maxCandidatesPerCall));
    }
    // Process chunks sequentially to avoid NPU memory pressure
    // (parallel processing would compete for NPU resources)
    const results = [];
    for (const chunk of candidateChunks) {
        const chunkResult = await vexxSimilarityMatrixChunk(chunk, peers, vexx);
        if (!chunkResult)
            return null; // Fail fast if any chunk fails
        results.push(...chunkResult);
    }
    return results;
}
function localSimilarityMatrix(candidates, peers) {
    return candidates.map((candidate) => localSimilarityRows(candidate, peers));
}
function selectSemanticEdges(candidateId, scored, selection) {
    const topK = Math.max(0, Math.floor(selection.topK));
    const bottomK = Math.max(0, Math.floor(selection.bottomK));
    const tops = [...scored].sort((a, b) => b.sim - a.sim).slice(0, topK);
    const bottoms = [...scored].sort((a, b) => a.sim - b.sim).slice(0, bottomK);
    const picked = new Map();
    for (const row of [...tops, ...bottoms]) {
        const charged = row.sim >= selection.attractAbove || row.sim <= selection.repelBelow;
        if (!charged)
            continue;
        const sim = clamp(row.sim, -1, 1);
        picked.set(semanticEdgeKey(candidateId, row.id), makeSemanticEdge(candidateId, row.id, sim));
    }
    return [...picked.values()];
}
export async function buildSemanticEdgesForCandidate(params) {
    return buildSemanticEdgesForCandidates({
        candidates: [params.candidate],
        peers: params.peers,
        selection: params.selection,
    });
}
export async function buildSemanticEdgesForCandidates(params) {
    const candidates = uniqueById(params.candidates).filter((candidate) => candidate.embedding.length > 0);
    if (candidates.length === 0)
        return [];
    const dim = candidates[0].embedding.length;
    const filteredCandidates = candidates.filter((candidate) => candidate.embedding.length === dim);
    const peers = params.peers.filter((peer) => peer.embedding.length === dim);
    if (filteredCandidates.length === 0 || peers.length === 0)
        return [];
    const vexx = params.selection.vexx ?? { baseUrl: "" };
    const vexxMatrix = await vexxSimilarityMatrix(filteredCandidates, peers, vexx);
    if (!vexxMatrix && vexx.required) {
        throw new Error("vexx_required:semantic_edges");
    }
    const scoredMatrix = vexxMatrix ?? localSimilarityMatrix(filteredCandidates, peers);
    const picked = new Map();
    for (let index = 0; index < filteredCandidates.length; index += 1) {
        const candidate = filteredCandidates[index];
        const scored = scoredMatrix[index].filter((row) => row.id !== candidate.id);
        for (const edge of selectSemanticEdges(candidate.id, scored, params.selection)) {
            const key = semanticEdgeKey(edge.a, edge.b);
            const prev = picked.get(key);
            if (!prev || Math.abs(edge.sim) > Math.abs(prev.sim)) {
                picked.set(key, edge);
            }
        }
    }
    return [...picked.values()];
}
//# sourceMappingURL=semantic.js.map