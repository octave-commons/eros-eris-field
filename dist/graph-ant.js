"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphAntSystem = void 0;
var GraphAntSystem = /** @class */ (function () {
    function GraphAntSystem(config) {
        this.pheromone = new Map();
        this.visitCount = new Map();
        this.ants = [];
        this.adjacency = new Map();
        this.tickCount = 0;
        this.config = config;
    }
    GraphAntSystem.prototype.updateGraph = function (springs) {
        var _a, _b;
        var next = new Map();
        for (var _i = 0, springs_1 = springs; _i < springs_1.length; _i++) {
            var e = springs_1[_i];
            var srcMap = next.get(e.source);
            if (!srcMap) {
                srcMap = new Map();
                next.set(e.source, srcMap);
            }
            srcMap.set(e.target, { kind: (_a = e.kind) !== null && _a !== void 0 ? _a : "structural" });
            var tgtMap = next.get(e.target);
            if (!tgtMap) {
                tgtMap = new Map();
                next.set(e.target, tgtMap);
            }
            tgtMap.set(e.source, { kind: (_b = e.kind) !== null && _b !== void 0 ? _b : "structural" });
            var key = edgeKey(e.source, e.target);
            if (!this.pheromone.has(key)) {
                this.pheromone.set(key, 0.5);
            }
        }
        this.adjacency = next;
        if (this.ants.length < this.config.antCount) {
            var nodes = __spreadArray([], this.adjacency.keys(), true);
            while (this.ants.length < this.config.antCount && nodes.length > 0) {
                var start = nodes[Math.floor(Math.random() * nodes.length)];
                this.ants.push({ at: start, visited: new Set([start]), stepsTaken: 0 });
            }
        }
    };
    GraphAntSystem.prototype.tick = function () {
        this.tickCount += 1;
        for (var _i = 0, _a = this.pheromone; _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], ph = _b[1];
            this.pheromone.set(key, Math.max(0.01, ph * (1 - this.config.evaporationRate)));
        }
        for (var _c = 0, _d = this.ants; _c < _d.length; _c++) {
            var ant = _d[_c];
            for (var step = 0; step < this.config.stepsPerTick; step++) {
                this.stepAnt(ant);
            }
            if (ant.stepsTaken > this.config.stepsPerTick * 3) {
                this.resetAnt(ant);
            }
        }
        return this.buildForceEdges();
    };
    GraphAntSystem.prototype.stepAnt = function (ant) {
        var _a, _b, _c, _d, _e;
        var neighbors = this.adjacency.get(ant.at);
        if (!neighbors || neighbors.size === 0) {
            this.resetAnt(ant);
            return;
        }
        var candidates = [];
        var weights = [];
        for (var _i = 0, neighbors_1 = neighbors; _i < neighbors_1.length; _i++) {
            var _f = neighbors_1[_i], neighborId = _f[0], edge = _f[1];
            var key_1 = edgeKey(ant.at, neighborId);
            var tau = Math.max(0.01, (_a = this.pheromone.get(key_1)) !== null && _a !== void 0 ? _a : 0.5);
            var visits = (_b = this.visitCount.get(key_1)) !== null && _b !== void 0 ? _b : 0;
            var novelty_1 = 1 / (1 + visits * this.config.revisitPenalty);
            var eta = Math.max(0.001, novelty_1);
            var w = Math.pow(tau, this.config.alpha) * Math.pow(eta, this.config.beta);
            candidates.push(neighborId);
            weights.push(w);
        }
        if (candidates.length === 0) {
            this.resetAnt(ant);
            return;
        }
        var chosen = weightedChoice(candidates, weights);
        var key = edgeKey(ant.at, chosen);
        var novelty = 1 / (1 + ((_c = this.visitCount.get(key)) !== null && _c !== void 0 ? _c : 0));
        this.pheromone.set(key, Math.min(this.config.maxPheromone, ((_d = this.pheromone.get(key)) !== null && _d !== void 0 ? _d : 0.5) + this.config.depositRate * novelty));
        this.visitCount.set(key, ((_e = this.visitCount.get(key)) !== null && _e !== void 0 ? _e : 0) + 1);
        ant.at = chosen;
        ant.visited.add(chosen);
        ant.stepsTaken += 1;
    };
    GraphAntSystem.prototype.resetAnt = function (ant) {
        var nodes = __spreadArray([], this.adjacency.keys(), true);
        if (nodes.length === 0)
            return;
        var start = nodes[Math.floor(Math.random() * nodes.length)];
        ant.at = start;
        ant.visited = new Set([start]);
        ant.stepsTaken = 0;
    };
    GraphAntSystem.prototype.buildForceEdges = function () {
        var edges = [];
        for (var _i = 0, _a = this.pheromone; _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], ph = _b[1];
            if (ph < 0.1)
                continue;
            var _c = parseEdgeKey(key), source = _c[0], target = _c[1];
            if (!source || !target)
                continue;
            var strength = this.config.forceScale * Math.min(1, ph / this.config.maxPheromone);
            if (strength < 0.001)
                continue;
            edges.push({
                source: source,
                target: target,
                pheromone: ph,
                strength: strength,
                restLength: 80 + 120 * (1 - Math.min(1, ph / this.config.maxPheromone)),
            });
        }
        return edges;
    };
    GraphAntSystem.prototype.stats = function () {
        var sum = 0;
        for (var _i = 0, _a = this.pheromone.values(); _i < _a.length; _i++) {
            var ph = _a[_i];
            sum += ph;
        }
        return {
            antCount: this.ants.length,
            edgeCount: this.pheromone.size,
            avgPheromone: this.pheromone.size > 0 ? sum / this.pheromone.size : 0,
            tickCount: this.tickCount,
        };
    };
    return GraphAntSystem;
}());
exports.GraphAntSystem = GraphAntSystem;
function edgeKey(a, b) {
    return a < b ? "".concat(a, "||").concat(b) : "".concat(b, "||").concat(a);
}
function parseEdgeKey(key) {
    var idx = key.indexOf("||");
    if (idx < 0)
        return ["", ""];
    return [key.slice(0, idx), key.slice(idx + 2)];
}
function weightedChoice(items, weights) {
    var _a;
    var total = 0;
    for (var _i = 0, weights_1 = weights; _i < weights_1.length; _i++) {
        var w = weights_1[_i];
        total += w;
    }
    if (total <= 0)
        return (_a = items[0]) !== null && _a !== void 0 ? _a : "";
    var r = Math.random() * total;
    for (var i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0)
            return items[i];
    }
    return items[items.length - 1];
}
//# sourceMappingURL=graph-ant.js.map