"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
exports.buildSemanticEdgesForCandidate = buildSemanticEdgesForCandidate;
exports.buildSemanticEdgesForCandidates = buildSemanticEdgesForCandidates;
function uniqueById(rows) {
    var seen = new Set();
    var out = [];
    for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
        var row = rows_1[_i];
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
    var n = Math.min(left.length, right.length);
    if (n === 0)
        return 0;
    var dot = 0;
    var leftNorm = 0;
    var rightNorm = 0;
    for (var index = 0; index < n; index += 1) {
        var a = left[index];
        var b = right[index];
        dot += a * b;
        leftNorm += a * a;
        rightNorm += b * b;
    }
    var denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
    return denom > 0 ? dot / denom : 0;
}
function semanticEdgeKey(a, b) {
    return a < b ? "".concat(a, "||").concat(b) : "".concat(b, "||").concat(a);
}
function makeSemanticEdge(a, b, sim) {
    return a < b ? { a: a, b: b, sim: sim } : { a: b, b: a, sim: sim };
}
/**
 * Compute a locality-sensitive hash bucket for an embedding.
 * Uses random projection for approximate nearest neighbor locality.
 * This groups similar embeddings into the same bucket with high probability.
 */
function embeddingBucket(embedding, numBuckets) {
    if (numBuckets === void 0) { numBuckets = 64; }
    if (embedding.length === 0)
        return 0;
    // Use first 8 dimensions as a simple hash (most embedding models have semantic info in early dims)
    var sliceLen = Math.min(8, embedding.length);
    var hash = 0;
    for (var i = 0; i < sliceLen; i++) {
        var val = embedding[i];
        // Quantize to 4 levels per dimension
        var quantized = Math.floor((val + 1) * 2); // maps [-1,1] to [0,4]
        hash = (hash * 5 + quantized) >>> 0;
    }
    return hash % numBuckets;
}
/**
 * Group peers by embedding bucket for spatial locality optimization.
 * Candidates are compared against peers in the same bucket first,
 * then neighboring buckets, reducing the comparison space.
 */
function groupPeersByBucket(peers, numBuckets) {
    var _a;
    if (numBuckets === void 0) { numBuckets = 64; }
    var buckets = new Map();
    for (var _i = 0, peers_1 = peers; _i < peers_1.length; _i++) {
        var peer = peers_1[_i];
        var bucket = embeddingBucket(peer.embedding, numBuckets);
        var arr = (_a = buckets.get(bucket)) !== null && _a !== void 0 ? _a : [];
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
    var _a, _b;
    if (maxPeers <= 0) {
        // Return all peers
        var allPeers = [];
        for (var _i = 0, _c = peerBuckets.values(); _i < _c.length; _i++) {
            var peers = _c[_i];
            allPeers.push.apply(allPeers, peers);
        }
        return allPeers;
    }
    var candidateBucket = embeddingBucket(candidate.embedding, numBuckets);
    var selected = [];
    var seen = new Set();
    // Start with same bucket
    var sameBucket = (_a = peerBuckets.get(candidateBucket)) !== null && _a !== void 0 ? _a : [];
    for (var _d = 0, sameBucket_1 = sameBucket; _d < sameBucket_1.length; _d++) {
        var peer = sameBucket_1[_d];
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
    for (var distance = 1; distance < numBuckets / 2 && selected.length < maxPeers; distance++) {
        for (var _e = 0, _f = [-distance, distance]; _e < _f.length; _e++) {
            var offset = _f[_e];
            var neighborBucket = (candidateBucket + offset + numBuckets) % numBuckets;
            var neighbors = (_b = peerBuckets.get(neighborBucket)) !== null && _b !== void 0 ? _b : [];
            for (var _g = 0, neighbors_1 = neighbors; _g < neighbors_1.length; _g++) {
                var peer = neighbors_1[_g];
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
    return peers.map(function (peer) { return ({ id: peer.id, sim: cosine(candidate.embedding, peer.embedding) }); });
}
function vexxSimilarityRows(candidate, peers, vexx) {
    return __awaiter(this, void 0, void 0, function () {
        var trimmedBaseUrl, minCandidates, controller, timeoutMs, timeout, response, payload, matrix_1, _a;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    trimmedBaseUrl = vexx.baseUrl.trim().replace(/\/$/, "");
                    if (!trimmedBaseUrl)
                        return [2 /*return*/, null];
                    minCandidates = Math.max(1, Math.floor((_b = vexx.minCandidates) !== null && _b !== void 0 ? _b : 1));
                    if (peers.length < minCandidates)
                        return [2 /*return*/, null];
                    controller = new AbortController();
                    timeoutMs = Math.max(1000, Math.floor((_c = vexx.timeoutMs) !== null && _c !== void 0 ? _c : 30000));
                    timeout = setTimeout(function () { return controller.abort(); }, timeoutMs);
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch("".concat(trimmedBaseUrl, "/v1/cosine/matrix"), {
                            method: "POST",
                            headers: __assign({ "Content-Type": "application/json" }, (vexx.apiKey ? { Authorization: "Bearer ".concat(vexx.apiKey) } : {})),
                            body: JSON.stringify({
                                left: [candidate.embedding],
                                right: peers.map(function (peer) { return peer.embedding; }),
                                device: (_d = vexx.device) !== null && _d !== void 0 ? _d : "AUTO",
                                requireAccel: (_e = vexx.requireAccel) !== null && _e !== void 0 ? _e : false,
                            }),
                            signal: controller.signal,
                        })];
                case 2:
                    response = _f.sent();
                    if (!response.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, response.json()];
                case 3:
                    payload = _f.sent();
                    matrix_1 = Array.isArray(payload.matrix) ? payload.matrix : null;
                    if (!matrix_1 || matrix_1.length !== peers.length)
                        return [2 /*return*/, null];
                    return [2 /*return*/, peers.map(function (peer, index) { var _a; return ({ id: peer.id, sim: Number((_a = matrix_1[index]) !== null && _a !== void 0 ? _a : 0) }); })];
                case 4:
                    _a = _f.sent();
                    return [2 /*return*/, null];
                case 5:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function vexxSimilarityMatrixChunk(candidates, peers, vexx) {
    return __awaiter(this, void 0, void 0, function () {
        var trimmedBaseUrl, controller, timeoutMs, timeout, response, payload, matrix_2, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    trimmedBaseUrl = vexx.baseUrl.trim().replace(/\/$/, "");
                    if (!trimmedBaseUrl)
                        return [2 /*return*/, null];
                    controller = new AbortController();
                    timeoutMs = Math.max(1000, Math.floor((_b = vexx.timeoutMs) !== null && _b !== void 0 ? _b : 30000));
                    timeout = setTimeout(function () { return controller.abort(); }, timeoutMs);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch("".concat(trimmedBaseUrl, "/v1/cosine/matrix"), {
                            method: "POST",
                            headers: __assign({ "Content-Type": "application/json" }, (vexx.apiKey ? { Authorization: "Bearer ".concat(vexx.apiKey) } : {})),
                            body: JSON.stringify({
                                left: candidates.map(function (candidate) { return candidate.embedding; }),
                                right: peers.map(function (peer) { return peer.embedding; }),
                                device: (_c = vexx.device) !== null && _c !== void 0 ? _c : "AUTO",
                                requireAccel: (_d = vexx.requireAccel) !== null && _d !== void 0 ? _d : false,
                            }),
                            signal: controller.signal,
                        })];
                case 2:
                    response = _e.sent();
                    if (!response.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, response.json()];
                case 3:
                    payload = _e.sent();
                    matrix_2 = Array.isArray(payload.matrix) ? payload.matrix : null;
                    if (!matrix_2 || matrix_2.length !== candidates.length * peers.length)
                        return [2 /*return*/, null];
                    return [2 /*return*/, candidates.map(function (_candidate, rowIndex) { return peers.map(function (peer, colIndex) {
                            var _a;
                            return ({
                                id: peer.id,
                                sim: Number((_a = matrix_2[rowIndex * peers.length + colIndex]) !== null && _a !== void 0 ? _a : 0),
                            });
                        }); })];
                case 4:
                    _a = _e.sent();
                    return [2 /*return*/, null];
                case 5:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Compute similarity matrix using NPU-optimal batching.
 * Splits large matrices into chunks that fit NPU memory constraints
 * and processes them in parallel when beneficial.
 */
function vexxSimilarityMatrix(candidates, peers, vexx) {
    return __awaiter(this, void 0, void 0, function () {
        var minCandidates, maxCandidatesPerCall, optimalBatchSize, candidateChunks, i, results, _i, candidateChunks_1, chunk, chunkResult;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    minCandidates = Math.max(1, Math.floor((_a = vexx.minCandidates) !== null && _a !== void 0 ? _a : 1));
                    if (candidates.length === 0 || peers.length < minCandidates)
                        return [2 /*return*/, null];
                    maxCandidatesPerCall = Math.floor((_b = vexx.maxCandidatesPerCall) !== null && _b !== void 0 ? _b : 256);
                    optimalBatchSize = Math.floor((_c = vexx.optimalBatchSize) !== null && _c !== void 0 ? _c : 128);
                    // For small matrices, use single call
                    if (candidates.length <= maxCandidatesPerCall && peers.length <= optimalBatchSize * 2) {
                        return [2 /*return*/, vexxSimilarityMatrixChunk(candidates, peers, vexx)];
                    }
                    candidateChunks = [];
                    for (i = 0; i < candidates.length; i += maxCandidatesPerCall) {
                        candidateChunks.push(candidates.slice(i, i + maxCandidatesPerCall));
                    }
                    results = [];
                    _i = 0, candidateChunks_1 = candidateChunks;
                    _d.label = 1;
                case 1:
                    if (!(_i < candidateChunks_1.length)) return [3 /*break*/, 4];
                    chunk = candidateChunks_1[_i];
                    return [4 /*yield*/, vexxSimilarityMatrixChunk(chunk, peers, vexx)];
                case 2:
                    chunkResult = _d.sent();
                    if (!chunkResult)
                        return [2 /*return*/, null]; // Fail fast if any chunk fails
                    results.push.apply(// Fail fast if any chunk fails
                    results, chunkResult);
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
function localSimilarityMatrix(candidates, peers) {
    return candidates.map(function (candidate) { return localSimilarityRows(candidate, peers); });
}
function selectSemanticEdges(candidateId, scored, selection) {
    var topK = Math.max(0, Math.floor(selection.topK));
    var bottomK = Math.max(0, Math.floor(selection.bottomK));
    var tops = __spreadArray([], scored, true).sort(function (a, b) { return b.sim - a.sim; }).slice(0, topK);
    var bottoms = __spreadArray([], scored, true).sort(function (a, b) { return a.sim - b.sim; }).slice(0, bottomK);
    var picked = new Map();
    for (var _i = 0, _a = __spreadArray(__spreadArray([], tops, true), bottoms, true); _i < _a.length; _i++) {
        var row = _a[_i];
        var charged = row.sim >= selection.attractAbove || row.sim <= selection.repelBelow;
        if (!charged)
            continue;
        var sim = clamp(row.sim, -1, 1);
        picked.set(semanticEdgeKey(candidateId, row.id), makeSemanticEdge(candidateId, row.id, sim));
    }
    return __spreadArray([], picked.values(), true);
}
function buildSemanticEdgesForCandidate(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, buildSemanticEdgesForCandidates({
                    candidates: [params.candidate],
                    peers: params.peers,
                    selection: params.selection,
                })];
        });
    });
}
function buildSemanticEdgesForCandidates(params) {
    return __awaiter(this, void 0, void 0, function () {
        var candidates, dim, filteredCandidates, peers, vexx, vexxMatrix, scoredMatrix, picked, _loop_1, index;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    candidates = uniqueById(params.candidates).filter(function (candidate) { return candidate.embedding.length > 0; });
                    if (candidates.length === 0)
                        return [2 /*return*/, []];
                    dim = candidates[0].embedding.length;
                    filteredCandidates = candidates.filter(function (candidate) { return candidate.embedding.length === dim; });
                    peers = params.peers.filter(function (peer) { return peer.embedding.length === dim; });
                    if (filteredCandidates.length === 0 || peers.length === 0)
                        return [2 /*return*/, []];
                    vexx = (_a = params.selection.vexx) !== null && _a !== void 0 ? _a : { baseUrl: "" };
                    return [4 /*yield*/, vexxSimilarityMatrix(filteredCandidates, peers, vexx)];
                case 1:
                    vexxMatrix = _b.sent();
                    if (!vexxMatrix && vexx.required) {
                        throw new Error("vexx_required:semantic_edges");
                    }
                    scoredMatrix = vexxMatrix !== null && vexxMatrix !== void 0 ? vexxMatrix : localSimilarityMatrix(filteredCandidates, peers);
                    picked = new Map();
                    _loop_1 = function (index) {
                        var candidate = filteredCandidates[index];
                        var scored = scoredMatrix[index].filter(function (row) { return row.id !== candidate.id; });
                        for (var _i = 0, _c = selectSemanticEdges(candidate.id, scored, params.selection); _i < _c.length; _i++) {
                            var edge = _c[_i];
                            var key = semanticEdgeKey(edge.a, edge.b);
                            var prev = picked.get(key);
                            if (!prev || Math.abs(edge.sim) > Math.abs(prev.sim)) {
                                picked.set(key, edge);
                            }
                        }
                    };
                    for (index = 0; index < filteredCandidates.length; index += 1) {
                        _loop_1(index);
                    }
                    return [2 /*return*/, __spreadArray([], picked.values(), true)];
            }
        });
    });
}
//# sourceMappingURL=semantic.js.map