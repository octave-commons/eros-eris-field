"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarnesHutQuadTree = void 0;
var MIN_HALF = 1e-3;
var QuadNode = /** @class */ (function () {
    function QuadNode(cx, cy, half) {
        this.cx = cx;
        this.cy = cy;
        this.half = half;
        this.mass = 0;
        this.comX = 0;
        this.comY = 0;
        /** Leaf: index of one particle (if not subdivided). */
        this.body = null;
        /** Internal node children (NW, NE, SW, SE). */
        this.children = null;
    }
    QuadNode.prototype.insert = function (particles, index) {
        var p = particles[index];
        // Update mass + COM incrementally.
        var m0 = this.mass;
        var m1 = m0 + p.mass;
        if (m1 > 0) {
            this.comX = (this.comX * m0 + p.x * p.mass) / m1;
            this.comY = (this.comY * m0 + p.y * p.mass) / m1;
            this.mass = m1;
        }
        if (this.children) {
            this.childFor(p.x, p.y).insert(particles, index);
            return;
        }
        if (this.body === null) {
            this.body = index;
            return;
        }
        // Already occupied leaf → subdivide.
        if (this.half <= MIN_HALF) {
            // Too small to subdivide safely; treat as aggregate.
            this.body = null;
            return;
        }
        var existing = this.body;
        this.body = null;
        this.subdivide();
        // Reinsert existing + new.
        if (existing !== null) {
            var ep = particles[existing];
            this.childFor(ep.x, ep.y).insert(particles, existing);
        }
        this.childFor(p.x, p.y).insert(particles, index);
    };
    QuadNode.prototype.subdivide = function () {
        var q = this.half / 2;
        this.children = [
            new QuadNode(this.cx - q, this.cy + q, q), // NW
            new QuadNode(this.cx + q, this.cy + q, q), // NE
            new QuadNode(this.cx - q, this.cy - q, q), // SW
            new QuadNode(this.cx + q, this.cy - q, q), // SE
        ];
    };
    QuadNode.prototype.childFor = function (x, y) {
        if (!this.children)
            throw new Error("no children");
        var east = x >= this.cx;
        var north = y >= this.cy;
        if (!east && north)
            return this.children[0];
        if (east && north)
            return this.children[1];
        if (!east && !north)
            return this.children[2];
        return this.children[3];
    };
    return QuadNode;
}());
var BarnesHutQuadTree = /** @class */ (function () {
    function BarnesHutQuadTree(particles) {
        this.particles = particles;
        var _a = computeBounds(particles), cx = _a.cx, cy = _a.cy, half = _a.half;
        this.root = new QuadNode(cx, cy, half);
        for (var i = 0; i < particles.length; i += 1) {
            this.root.insert(particles, i);
        }
    }
    BarnesHutQuadTree.prototype.repulsionOn = function (index, opts) {
        var p = this.particles[index];
        var out = { fx: 0, fy: 0 };
        accumulateRepulsion(this.root, this.particles, index, p.x, p.y, opts, out);
        return out;
    };
    return BarnesHutQuadTree;
}());
exports.BarnesHutQuadTree = BarnesHutQuadTree;
function computeBounds(particles) {
    if (particles.length === 0)
        return { cx: 0, cy: 0, half: 1 };
    var minX = Number.POSITIVE_INFINITY;
    var maxX = Number.NEGATIVE_INFINITY;
    var minY = Number.POSITIVE_INFINITY;
    var maxY = Number.NEGATIVE_INFINITY;
    for (var _i = 0, particles_1 = particles; _i < particles_1.length; _i++) {
        var p = particles_1[_i];
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    var w = Math.max(1e-6, maxX - minX);
    var h = Math.max(1e-6, maxY - minY);
    var side = Math.max(w, h);
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var half = side / 2 + 1e-3;
    return { cx: cx, cy: cy, half: half };
}
function accumulateRepulsion(node, particles, selfIndex, x, y, opts, out) {
    if (node.mass <= 0)
        return;
    // Leaf with the same particle.
    if (!node.children && node.body === selfIndex)
        return;
    var dx = x - node.comX;
    var dy = y - node.comY;
    var dist2 = dx * dx + dy * dy + opts.softening;
    var dist = Math.sqrt(dist2);
    var size = node.half * 2;
    // Barnes–Hut criterion: far enough → approximate as one body.
    if (!node.children || size / dist < opts.theta) {
        var inv = 1 / dist;
        var inv3 = inv * inv * inv;
        var mag = opts.strength * node.mass * inv3;
        out.fx += dx * mag;
        out.fy += dy * mag;
        return;
    }
    // Recurse.
    var ch = node.children;
    if (!ch)
        return;
    for (var _i = 0, ch_1 = ch; _i < ch_1.length; _i++) {
        var child = ch_1[_i];
        // Quick prune: child with no mass.
        if (child.mass <= 0)
            continue;
        accumulateRepulsion(child, particles, selfIndex, x, y, opts, out);
    }
}
//# sourceMappingURL=quadtree.js.map