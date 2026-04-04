import { BarnesHutQuadTree } from "./quadtree.js";
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function hypot(x, y) {
    return Math.sqrt(x * x + y * y);
}
function addForce(forces, i, fx, fy) {
    forces[i].fx += fx;
    forces[i].fy += fy;
}
export function stepField(params) {
    const { particles, dt, config, springs = [], semantic = [] } = params;
    if (particles.length === 0)
        return;
    // Keep integration stable even if callers pass a large wall-clock dt.
    const stepDt = clamp(dt, 0.001, 0.5);
    const forces = particles.map(() => ({ fx: 0, fy: 0 }));
    const indexById = new Map();
    for (let i = 0; i < particles.length; i += 1)
        indexById.set(particles[i].id, i);
    // --- global repulsion (Barnes–Hut)
    const tree = new BarnesHutQuadTree(particles);
    for (let i = 0; i < particles.length; i += 1) {
        const f = tree.repulsionOn(i, {
            theta: config.theta,
            strength: config.repulsionStrength,
            softening: config.softening,
        });
        addForce(forces, i, f.fx, f.fy);
    }
    // --- hard-core separation (grid-based, O(n))
    if (config.minSeparation > 0 && config.separationStrength > 0) {
        const cellSize = Math.max(1e-6, config.minSeparation);
        const grid = new Map();
        const keyFor = (x, y) => {
            const gx = Math.floor(x / cellSize);
            const gy = Math.floor(y / cellSize);
            return `${gx},${gy}`;
        };
        for (let i = 0; i < particles.length; i += 1) {
            const p = particles[i];
            const k = keyFor(p.x, p.y);
            const rows = grid.get(k) ?? [];
            rows.push(i);
            grid.set(k, rows);
        }
        for (let i = 0; i < particles.length; i += 1) {
            const a = particles[i];
            const gx = Math.floor(a.x / cellSize);
            const gy = Math.floor(a.y / cellSize);
            for (let ox = -1; ox <= 1; ox += 1) {
                for (let oy = -1; oy <= 1; oy += 1) {
                    const rows = grid.get(`${gx + ox},${gy + oy}`);
                    if (!rows)
                        continue;
                    for (const j of rows) {
                        if (j <= i)
                            continue;
                        const b = particles[j];
                        const dx = a.x - b.x;
                        const dy = a.y - b.y;
                        const d = hypot(dx, dy);
                        if (d <= 1e-6 || d >= config.minSeparation)
                            continue;
                        const ux = dx / d;
                        const uy = dy / d;
                        const push = (config.separationStrength * (config.minSeparation - d)) / config.minSeparation;
                        addForce(forces, i, ux * push, uy * push);
                        addForce(forces, j, -ux * push, -uy * push);
                    }
                }
            }
        }
    }
    // --- structural springs
    for (const e of springs) {
        const si = indexById.get(e.source);
        const ti = indexById.get(e.target);
        if (si === undefined || ti === undefined)
            continue;
        const a = particles[si];
        const b = particles[ti];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = hypot(dx, dy);
        if (d <= 1e-6)
            continue;
        const ux = dx / d;
        const uy = dy / d;
        const delta = d - e.restLength;
        const mag = -e.strength * delta;
        addForce(forces, si, ux * mag, uy * mag);
        addForce(forces, ti, -ux * mag, -uy * mag);
    }
    // --- semantic charge
    for (const s of semantic) {
        const ai = indexById.get(s.a);
        const bi = indexById.get(s.b);
        if (ai === undefined || bi === undefined)
            continue;
        const a = particles[ai];
        const b = particles[bi];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = hypot(dx, dy);
        if (d <= 1e-6)
            continue;
        const ux = dx / d;
        const uy = dy / d;
        if (s.sim >= config.semanticAttractAbove) {
            // Attraction as a spring with similarity-shortened rest length.
            const t = clamp((1 - s.sim) / Math.max(1e-6, 1 - config.semanticAttractAbove), 0, 1);
            const rest = config.semanticRestLength * (0.65 + t * 1.8);
            const delta = d - rest;
            const mag = -config.semanticAttractStrength * delta;
            addForce(forces, ai, ux * mag, uy * mag);
            addForce(forces, bi, -ux * mag, -uy * mag);
            continue;
        }
        if (s.sim <= config.semanticRepelBelow) {
            // Extra repulsion (beyond spatial repulsion) for very dissimilar nodes.
            const t = clamp((config.semanticRepelBelow - s.sim) / Math.max(1e-6, config.semanticRepelBelow), 0, 1);
            const mag = (config.semanticRepelStrength * (0.25 + t)) / (d + config.softening);
            // Push apart.
            addForce(forces, ai, -ux * mag, -uy * mag);
            addForce(forces, bi, ux * mag, uy * mag);
        }
    }
    // --- boundary pressure (soft circular wall)
    if (config.targetRadius > 0 && config.boundaryThickness > 0 && config.boundaryPressure > 0) {
        const outer = config.targetRadius;
        const thickness = Math.max(1e-6, config.boundaryThickness);
        const inner = Math.max(0, outer - thickness);
        const k = config.boundaryPressure;
        for (let i = 0; i < particles.length; i += 1) {
            const p = particles[i];
            const r = hypot(p.x, p.y);
            if (r <= inner || r <= 1e-6)
                continue;
            // t=0 at inner band edge; t=1 at outer radius.
            const t = clamp((r - inner) / thickness, 0, 4);
            const mag = k * t * t;
            const ux = p.x / r;
            const uy = p.y / r;
            addForce(forces, i, -ux * mag, -uy * mag);
        }
    }
    // --- integrate
    for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        const f = forces[i];
        const invM = 1 / Math.max(1e-6, p.mass);
        p.vx = (p.vx + f.fx * invM * stepDt) * config.damping;
        p.vy = (p.vy + f.fy * invM * stepDt) * config.damping;
        const sp = hypot(p.vx, p.vy);
        if (sp > config.maxSpeed) {
            const s = config.maxSpeed / sp;
            p.vx *= s;
            p.vy *= s;
        }
        p.x += p.vx * stepDt;
        p.y += p.vy * stepDt;
    }
    // keep the cloud roughly centered
    let meanX = 0;
    let meanY = 0;
    for (const p of particles) {
        meanX += p.x;
        meanY += p.y;
    }
    meanX /= particles.length;
    meanY /= particles.length;
    for (const p of particles) {
        p.x -= meanX;
        p.y -= meanY;
    }
    // Emergency hard clamp (rare): if something explodes, shrink back.
    if (config.targetRadius > 0) {
        let rMax = 0;
        for (const p of particles)
            rMax = Math.max(rMax, hypot(p.x, p.y));
        const hard = config.targetRadius * 2;
        if (rMax > hard && rMax > 0) {
            const s = config.targetRadius / rMax;
            for (const p of particles) {
                p.x *= s;
                p.y *= s;
                p.vx *= s;
                p.vy *= s;
            }
        }
    }
}
//# sourceMappingURL=sim.js.map