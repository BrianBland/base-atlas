# Base system atlas

Standalone atlas of the [base/base](https://github.com/base/base) node stack.

Explorable map of this repository’s node stack: interactive isometric page plus a generated text twin.

| File | Role | Edit it? |
|---|---|---|
| `atlas/data.mjs` | Single source of truth: structures, flows, chapters, decisions | Yes |
| `atlas/template.html` + `atlas/build.mjs` | Rendering + generator | Presentation only |
| `atlas.html` | Built atlas | No (generated) |
| `SYSTEM.md` | Built text twin | No (generated) |
| `CONTEXT.md` | Glossary (domain nouns only) | By hand |
| `adr/` | Hard-to-reverse decisions | By hand — none added for this first map; decisions link to existing specs/READMEs |

## Build

```bash
node atlas/build.mjs
```

Then serve the folder (in-app `file://` often skips scripts/fonts):

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/atlas.html`.

## Scope

In: network roles (sequencer is a plate that wraps RPC plus tx ingress, builder, and conductor — not its own box), RPC’s ordinary node including the txpool, batcher, proposer + TEE prover, challenger + ZK prover, L1 at the edge.

Out: wallets, explorer, L1 contract implementations, `basectl` / telemetry as first-class boxes (they operate the map).
