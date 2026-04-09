export type GraphAntConfig = {
    antCount: number;
    stepsPerTick: number;
    depositRate: number;
    evaporationRate: number;
    alpha: number;
    beta: number;
    revisitPenalty: number;
    forceScale: number;
    maxPheromone: number;
};
export type AntTrailEdge = {
    source: string;
    target: string;
    pheromone: number;
    strength: number;
    restLength: number;
};
export declare class GraphAntSystem {
    private readonly config;
    private readonly pheromone;
    private readonly visitCount;
    private ants;
    private adjacency;
    private tickCount;
    constructor(config: GraphAntConfig);
    updateGraph(springs: Array<{
        source: string;
        target: string;
        kind?: string;
        strength: number;
        restLength: number;
    }>): void;
    tick(): AntTrailEdge[];
    private stepAnt;
    private resetAnt;
    private buildForceEdges;
    stats(): {
        antCount: number;
        edgeCount: number;
        avgPheromone: number;
        tickCount: number;
    };
}
//# sourceMappingURL=graph-ant.d.ts.map