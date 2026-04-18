"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stepField = stepField;
var quadtree_js_1 = require("./quadtree.js");
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
function stepField(params) {
    var _a, _b;
    var particles = params.particles, dt = params.dt, config = params.config, _c = params.springs, springs = _c === void 0 ? [] : _c, _d = params.semantic, semantic = _d === void 0 ? [] : _d;
    if (particles.length === 0)
        return;
    // Keep integration stable even if callers pass a large wall-clock dt.
    var stepDt = clamp(dt, 0.001, 0.5);
    var forces = particles.map(function () { return ({ fx: 0, fy: 0 }); });
    var indexById = new Map();
    for (var i = 0; i < particles.length; i += 1)
        indexById.set(particles[i].id, i);
    // --- weak long-range repulsion (Barnes–Hut)
    if (config.repulsionStrength > 0) {
        var tree = new quadtree_js_1.BarnesHutQuadTree(particles);
        for (var i = 0; i < particles.length; i += 1) {
            var f = tree.repulsionOn(i, {
                theta: config.theta,
                strength: config.repulsionStrength,
                softening: config.softening,
            });
            addForce(forces, i, f.fx, f.fy);
        }
    }
    // --- strong node-local repulsion (grid-based, O(n))
    var localRadius = Math.max(config.minSeparation, config.localRepulsionRadius);
    if (localRadius > 0 && (config.localRepulsionStrength > 0 || config.separationStrength > 0)) {
        var cellSize_1 = Math.max(1e-6, localRadius);
        var grid = new Map();
        var keyFor = function (x, y) {
            var gx = Math.floor(x / cellSize_1);
            var gy = Math.floor(y / cellSize_1);
            return "".concat(gx, ",").concat(gy);
        };
        for (var i = 0; i < particles.length; i += 1) {
            var p = particles[i];
            var k = keyFor(p.x, p.y);
            var rows = (_a = grid.get(k)) !== null && _a !== void 0 ? _a : [];
            rows.push(i);
            grid.set(k, rows);
        }
        for (var i = 0; i < particles.length; i += 1) {
            var a = particles[i];
            var gx = Math.floor(a.x / cellSize_1);
            var gy = Math.floor(a.y / cellSize_1);
            for (var ox = -1; ox <= 1; ox += 1) {
                for (var oy = -1; oy <= 1; oy += 1) {
                    var rows = grid.get("".concat(gx + ox, ",").concat(gy + oy));
                    if (!rows)
                        continue;
                    for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                        var j = rows_1[_i];
                        if (j <= i)
                            continue;
                        var b = particles[j];
                        var dx = a.x - b.x;
                        var dy = a.y - b.y;
                        var d = hypot(dx, dy);
                        if (d <= 1e-6 || d >= localRadius)
                            continue;
                        var ux = dx / d;
                        var uy = dy / d;
                        var push = 0;
                        if (config.localRepulsionStrength > 0 && d < config.localRepulsionRadius) {
                            var t = clamp(1 - d / Math.max(1e-6, config.localRepulsionRadius), 0, 1);
                            push += config.localRepulsionStrength * Math.pow(t, config.localRepulsionPower);
                        }
                        if (config.minSeparation > 0 && config.separationStrength > 0 && d < config.minSeparation) {
                            var t = clamp(1 - d / Math.max(1e-6, config.minSeparation), 0, 1);
                            push += config.separationStrength * (1 + 24 * t * t * t);
                        }
                        if (push <= 0)
                            continue;
                        addForce(forces, i, ux * push, uy * push);
                        addForce(forces, j, -ux * push, -uy * push);
                    }
                }
            }
        }
    }
    // --- structural springs
    for (var _e = 0, springs_1 = springs; _e < springs_1.length; _e++) {
        var e = springs_1[_e];
        var si = indexById.get(e.source);
        var ti = indexById.get(e.target);
        if (si === undefined || ti === undefined)
            continue;
        var a = particles[si];
        var b = particles[ti];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var d = hypot(dx, dy);
        if (d <= 1e-6)
            continue;
        var ux = dx / d;
        var uy = dy / d;
        var delta = d - e.restLength;
        // Hooke-style spring: stretched edges pull together, compressed edges push apart.
        var mag = e.strength * delta;
        addForce(forces, si, ux * mag, uy * mag);
        addForce(forces, ti, -ux * mag, -uy * mag);
    }
    // --- semantic charge
    for (var _f = 0, semantic_1 = semantic; _f < semantic_1.length; _f++) {
        var s = semantic_1[_f];
        var ai = indexById.get(s.a);
        var bi = indexById.get(s.b);
        if (ai === undefined || bi === undefined)
            continue;
        var a = particles[ai];
        var b = particles[bi];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var d = hypot(dx, dy);
        if (d <= 1e-6)
            continue;
        var ux = dx / d;
        var uy = dy / d;
        if (s.sim >= config.semanticAttractAbove) {
            // Strong attraction as similarity rises; highly similar nodes should dominate local structure.
            var simT = clamp((s.sim - config.semanticAttractAbove) / Math.max(1e-6, 1 - config.semanticAttractAbove), 0, 1);
            var rest = config.semanticRestLength * (0.28 + (1 - simT) * 1.35);
            var delta = d - rest;
            // Strong semantic neighbors should collapse inward when far apart and only push apart when over-compressed.
            var mag = config.semanticAttractStrength * (1 + 4 * simT) * delta;
            addForce(forces, ai, ux * mag, uy * mag);
            addForce(forces, bi, -ux * mag, -uy * mag);
            continue;
        }
        if (s.sim <= config.semanticRepelBelow && d < config.semanticRepelRadius) {
            // Dissimilar nodes only repel when too close; they should not globally explode the field.
            var simT = clamp((config.semanticRepelBelow - s.sim) / Math.max(1e-6, config.semanticRepelBelow + 1), 0, 1);
            var distT = clamp(1 - d / Math.max(1e-6, config.semanticRepelRadius), 0, 1);
            var mag = config.semanticRepelStrength * (0.5 + simT) * Math.pow(distT, 3);
            // Push apart.
            addForce(forces, ai, -ux * mag, -uy * mag);
            addForce(forces, bi, ux * mag, uy * mag);
        }
    }
    // --- boundary pressure (soft circular wall on outermost edge nodes only)
    if (config.targetRadius > 0 && config.boundaryThickness > 0 && config.boundaryPressure > 0) {
        var outer = config.targetRadius;
        var thickness = Math.max(1e-6, config.boundaryThickness);
        var inner = Math.max(0, outer - thickness);
        var k = config.boundaryPressure;
        var edgeCount = Math.max(1, Math.ceil(particles.length * clamp(config.boundaryEdgeFraction, 0.001, 1)));
        var radii = particles.map(function (p) { return hypot(p.x, p.y); }).sort(function (a, b) { return a - b; });
        var edgeCutoff = (_b = radii[Math.max(0, radii.length - edgeCount)]) !== null && _b !== void 0 ? _b : inner;
        for (var i = 0; i < particles.length; i += 1) {
            var p = particles[i];
            var r = hypot(p.x, p.y);
            if (r <= inner || r < edgeCutoff || r <= 1e-6)
                continue;
            // t=0 at inner band edge; t=1 at outer radius.
            var t = clamp((r - inner) / thickness, 0, 4);
            var mag = k * t * t * t;
            var ux = p.x / r;
            var uy = p.y / r;
            addForce(forces, i, -ux * mag, -uy * mag);
        }
    }
    // --- integrate
    for (var i = 0; i < particles.length; i += 1) {
        var p = particles[i];
        var f = forces[i];
        var invM = 1 / Math.max(1e-6, p.mass);
        p.vx = (p.vx + f.fx * invM * stepDt) * config.damping;
        p.vy = (p.vy + f.fy * invM * stepDt) * config.damping;
        var sp = hypot(p.vx, p.vy);
        if (sp > config.maxSpeed) {
            var s = config.maxSpeed / sp;
            p.vx *= s;
            p.vy *= s;
        }
        p.x += p.vx * stepDt;
        p.y += p.vy * stepDt;
    }
    // keep the cloud roughly centered
    var meanX = 0;
    var meanY = 0;
    for (var _g = 0, particles_1 = particles; _g < particles_1.length; _g++) {
        var p = particles_1[_g];
        meanX += p.x;
        meanY += p.y;
    }
    meanX /= particles.length;
    meanY /= particles.length;
    for (var _h = 0, particles_2 = particles; _h < particles_2.length; _h++) {
        var p = particles_2[_h];
        p.x -= meanX;
        p.y -= meanY;
    }
    // Emergency hard clamp (rare): rein in only the offenders instead of crunching the whole graph.
    if (config.targetRadius > 0) {
        var hard = config.targetRadius + Math.max(1, config.boundaryThickness * 0.35);
        for (var _j = 0, particles_3 = particles; _j < particles_3.length; _j++) {
            var p = particles_3[_j];
            var r = hypot(p.x, p.y);
            if (r > hard && r > 0) {
                var s = hard / r;
                p.x *= s;
                p.y *= s;
                p.vx *= 0.35;
                p.vy *= 0.35;
            }
        }
    }
}
//# sourceMappingURL=sim.js.map