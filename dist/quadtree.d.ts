import type { Particle, Force } from "./types.js";
export declare class BarnesHutQuadTree {
    private readonly particles;
    private readonly root;
    constructor(particles: Particle[]);
    repulsionOn(index: number, opts: {
        theta: number;
        strength: number;
        softening: number;
    }): Force;
}
//# sourceMappingURL=quadtree.d.ts.map