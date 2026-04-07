import type { SemanticEdge } from "./types.js";
export type SemanticEmbeddingNode = {
    id: string;
    embedding: number[];
};
export type VexxCosineConfig = {
    baseUrl: string;
    apiKey?: string;
    device?: "AUTO" | "CPU" | "GPU" | "NPU";
    requireAccel?: boolean;
    required?: boolean;
    timeoutMs?: number;
    minCandidates?: number;
    /** Optimal batch size for NPU throughput (default: 128) */
    optimalBatchSize?: number;
    /** Maximum candidates per Vexx call before splitting (default: 256) */
    maxCandidatesPerCall?: number;
};
export type SemanticEdgeSelection = {
    attractAbove: number;
    repelBelow: number;
    topK: number;
    bottomK: number;
    vexx?: VexxCosineConfig;
    /** Enable spatial locality optimization for large peer sets */
    useSpatialOptimization?: boolean;
    /** Maximum peers to compare against per candidate (0 = unlimited) */
    maxPeersPerCandidate?: number;
};
export declare function buildSemanticEdgesForCandidate(params: {
    candidate: SemanticEmbeddingNode;
    peers: SemanticEmbeddingNode[];
    selection: SemanticEdgeSelection;
}): Promise<SemanticEdge[]>;
export declare function buildSemanticEdgesForCandidates(params: {
    candidates: SemanticEmbeddingNode[];
    peers: SemanticEmbeddingNode[];
    selection: SemanticEdgeSelection;
}): Promise<SemanticEdge[]>;
//# sourceMappingURL=semantic.d.ts.map