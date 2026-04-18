# eros-eris-field

Core semantic-force layout engine extracted from Fork Tales.

It provides the simulation primitives used to nudge graph nodes with:

- Barnes–Hut N-body repulsion
- structural spring forces
- semantic attraction / repulsion from embedding similarity
- soft circular boundary pressure

This package is intended to be consumed by `@workspace/eros-eris-field-app`.


> Built with [GLM-5](https://z.ai) — part of the [z.ai](https://z.ai) startup ecosystem and the [Ussyverse](https://ussy.cloud).

## Build

```bash
pnpm -C orgs/octave-commons/eros-eris-field build
```

## Exports

- `BarnesHutQuadTree`
- `stepField`
- `buildSemanticEdgesForCandidate`
- layout field types (`Particle`, `SpringEdge`, `SemanticEdge`, `FieldConfig`)

## Vexx integration

`buildSemanticEdgesForCandidate` can offload cosine matrix scoring to `vexx`
when given a `vexx` config. If `vexx` is unavailable, it falls back to local
cosine scoring.
