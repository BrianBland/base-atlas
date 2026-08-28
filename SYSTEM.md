# Base — System Definition

_**This file is the living source of truth for how this repository fits together.** The interactive atlas is built from the same data._

_Question status: **1 open · 10 resolved**._

## One paragraph

This repo is the Base rollup stack: a Reth-based execution node, a consensus node that derives L2 from Ethereum and can sequence, a Flashblocks builder, a batcher that posts L2 data to L1, and a proving path that proposes output roots and challenges bad games. Apps talk to JSON-RPC; the sequencer builds a block every ~2s, streaming Flashblocks first; the batcher writes that history to Ethereum; every other node re-derives the same chain from L1.

## Decisions locked

| Axis | Decision | ADR |
|---|---|---|
| Execution client | Reth-based Base EL (`bin/node`, `base-node-core`), not op-geth. Engine API over auth IPC when embedded in `base`. | [specs](https://specs.base.org) |
| Consensus composition | Actor-model `RollupNode` in `base-consensus-node`: engine, derivation, L1 watcher, network, optional sequencer + RPC. `FollowNode` skips derivation and mirrors a remote L2. | [crates/consensus/service/README.md](../../crates/consensus/service/README.md) |
| Public node packaging | Operator `docker compose` still ships split EL + CL containers. `base rpc` embeds both in one process and filters sequencer/builder/forwarding flags. | [bin/base/README.md](../../bin/base/README.md) |
| Block production | Sequencer ticks on `block_time`, builds via Engine `forkchoiceUpdated` + `getPayload`, then conductor-commit → gossip → insert. Recovery mode and upgrade blocks force empty payloads. | [docs/guides/BLOCK_PRODUCTION_REVIEW.md](../guides/BLOCK_PRODUCTION_REVIEW.md) |
| Preconfirmation | Flashblocks: sub-second payload deltas over WebSocket (`FlashblocksPayloadV1`), reconciled to the canonical block on the RPC node. | [crates/common/flashblocks](../../crates/common/flashblocks) |
| Data availability | Batcher posts frames as blobs or calldata to `batch_inbox_address`. Shadow mode may override the inbox only when paired with `--shadow-mode`. | [bin/batcher/README.md](../../bin/batcher/README.md) |
| Fault proofs | TEE proposer creates dispute games via `DisputeGameFactory.createWithInitData`. Challenger + ZK prover service invalidate bad games. Standalone proving is user-funded. | [docs/guides/STANDALONE_PROVING.md](../guides/STANDALONE_PROVING.md) |

## Cost model

Not a per-user SaaS bill. The operating costs that matter here are L1 data availability (blob/calldata posted by `base-batcher`), L1 gas for output proposals and dispute games, and proving (TEE attestations plus optional SP1/Succinct ZK).
Block time is `rollup_config.block_time` (2s on Base). Flashblocks are sub-second chunks of the same payload. DA throttle (`miner_setMaxDASize`) shrinks what the builder may include when the L1 backlog grows.
Standalone ZK proving (`just prover up`) is user-funded: `network` pays PROVE on the Succinct marketplace; `dry-run` is free cycle counting; `cluster` is your own GPU farm. See `docs/guides/STANDALONE_PROVING.md`.

## Reading order (the atlas chapters)

1. **You and the node** — Strip everything away and Base is a JSON-RPC URL you already know how to call. _(adds U, R)_
2. **The engine and the disk** — RPC is a window. The Reth engine and its datadir are the room behind it. _(adds E, D)_
3. **Getting into the mempool** — A submitted transaction parks in the pool, then (on replicas) is forwarded to the builder door. _(adds P, I)_
4. **Flashblocks** — The next block is built in public, a chunk at a time, before it has a hash you can finalize. _(adds B, F)_
5. **The sequencer and the lock** — Once a second-or-two clock fires, one leader seals the payload and commits it. _(adds S, W)_
6. **Telling the rest of the network** — The sealed unsafe block is gossiped so replicas do not wait for Ethereum. _(adds N)_
7. **Posting the history to Ethereum** — Gossip is fast. Ethereum is the copy of record. _(adds L, A)_
8. **Deriving the safe chain** — Every honest node can rebuild the same safe head from L1 data alone. _(adds V, K)_
9. **Proposing and challenging roots** — L1 also holds court: a TEE-backed proposer posts roots; a challenger and prover service dispute the bad ones. _(adds O, H, Z)_
10. **The whole system** — Everything at once — pick a flow in the bottom left.

## Structures

### Surfaces

#### U · Apps and wallets

**In one line.** Wallets, dapps, and scripts that send transactions and read chain state.

**What it does.** Anything that speaks Ethereum JSON-RPC: a browser wallet, a bot, an indexer, or `cast`. It does not run the rollup. It posts a signed transaction or asks for a block, a receipt, or a `pending` view that may already include Flashblocks.

**How it's built.** Talks to a public or self-hosted endpoint (`https://mainnet.base.org` or a local `base rpc` / docker-compose EL on `:8545`). This repo does not ship a wallet or explorer.

**Steps in execution.**

1. **Sign** — User or app signs an L2 transaction.
2. **Submit** — eth_sendRawTransaction (or a bundle) to an RPC URL.
3. **Watch** — Poll receipts or subscribe; pending may come from Flashblocks.

**Questions.**

- ~~**Q-U1** Do we map wallets/explorers as part of this atlas?~~ ✓ No — they are clients of this repo, not in-tree (2026-08-28).

#### R · JSON-RPC node

**In one line.** The public face of a Base node: Ethereum JSON-RPC plus rollup and Flashblocks methods.

**What it does.** The process an operator runs to serve the chain. In docker-compose this is two containers (execution + consensus). `base rpc` embeds both in one process and hides sequencer flags. Replica nodes forward user transactions toward the sequencer and subscribe to Flashblocks so `pending` is live.

**How it's built.** `bin/base` (`base rpc`) or `docker-compose.yml` (`execution-entrypoint` + `consensus-entrypoint`). RPC crates: `base-execution-rpc`, `base-flashblocks`, `base-consensus-rpc` (`optimism_syncStatus`, admin, P2P). Ports 8545/8546 typical.

**Steps in execution.**

1. **Admit** — Accept eth_*, debug_*, optimism_*, flashblock subscriptions.
2. **Read** — Serve canonical state from the execution DB; pending from Flashblocks.
3. **Forward** — If configured, send raw txs toward the sequencer / builder ingress.

**Questions.**

- **Q-R1** Should the published operator node stay as split EL+CL containers, or is `base rpc` the long-term public shape?

#### F · Flashblocks stream

**In one line.** The WebSocket that carries Flashblock payloads from the builder to RPC nodes and tools.

**What it does.** RPC nodes subscribe here so `eth_getBlockByNumber("pending")` and flashblock subscriptions stay ahead of the sealed block. A proxy sits in front so the sequencer is not crushed by every replica opening a socket.

**How it's built.** Publisher: `base-builder-publish`. Subscriber: `FlashblocksSubscriber` in `base-flashblocks`. Fan-out: `bin/websocket-proxy` (upstream rollup-boost / builder WS; optional Brotli). `basectl flashblocks` prints JSONL; `eth_subscribe("newFlashblocks")` on the node.

**Steps in execution.**

1. **Publish** — Builder broadcasts FlashblocksPayloadV1 (index 0 includes base).
2. **Proxy** — websocket-proxy fans out to replicas.
3. **Reconcile** — FlashblocksState + CanonicalBlockReconciler merge pending with canonical.

**Questions.**

- ~~**Q-F1** Is websocket-proxy production-hardened?~~ ✓ README still calls it alpha: one-way, no payload inspection (2026-08-28).

### The production loop

#### E · Execution engine

**In one line.** The Reth-based EVM that executes transactions and answers the Engine API.

**What it does.** This is the computer that actually runs the block. Consensus never executes bytecode itself — it asks this engine to build or import a payload, then treats the resulting block hash as truth. Same engine on the sequencer and on every replica.

**How it's built.** `bin/node` / `base-node-core` + `base-execution-evm` + Base precompiles in `base-common-precompiles`. Engine types and API builder in `base-node-core`. Auth Engine API over IPC when embedded, HTTP+JWT when split. Fatal precompile/EVM errors here can halt block production — see `docs/guides/BLOCK_PRODUCTION_REVIEW.md`.

**Steps in execution.**

1. **forkchoiceUpdated** — Consensus sets head and, on the sequencer, starts a payload build.
2. **Execute** — Apply deposits, then txpool or derived txs, against parent state.
3. **getPayload / newPayload** — Return a sealed payload, or import one from gossip/derivation.

**Questions.**

- ~~**Q-E1** Is this still op-geth?~~ ✓ No. This tree is Reth-based Base execution (2026-08-28).

#### P · Transaction pool

**In one line.** The mempool: valid not-yet-included transactions, ordered for the builder.

**What it does.** When you send a transaction, it sits here until a block (or Flashblock) takes it. Base adds L1-data-fee checks and its own ordering. Replica nodes can drain this pool toward builder URLs.

**How it's built.** `base-execution-txpool`: `BaseTransactionValidator`, `BaseOrdering`. Forwarding: `base-tx-forwarding` (`base_insertValidatedTransaction`). Inspect/clear via `basectl txpool`.

**Steps in execution.**

1. **Validate** — Signature, nonce, balance, L1 data fee, Base rules.
2. **Park** — Pending vs queued by nonce.
3. **Select** — Builder pulls best txs under gas/DA/metering limits.

**Questions.**

- ~~**Q-P1** Do replicas include txs locally?~~ ✓ No. Replicas forward; the sequencer/builder selects (2026-08-28).

#### I · Builder ingress

**In one line.** The builder-facing JSON-RPC that accepts validated transactions and bundles.

**What it does.** The public RPC is not where searchers and mempool nodes dump inventory into the sequencer. Ingress is that door: validate a bundle, meter it, emit an audit event, hand it to the builder connection.

**How it's built.** `bin/ingress-rpc` / `ingress-rpc-lib`: `IngressService`, `validate_bundle`, `BuilderConnector`, health + metrics. Wire format for pool forwarding is `ValidatedTransaction` in `base-execution-txpool`.

**Steps in execution.**

1. **Accept** — JSON-RPC tx or bundle.
2. **Meter** — Ask the builder connector whether it fits current limits.
3. **Emit** — Audit event; builder sees the inventory.

#### B · Flashblocks builder

**In one line.** Builds the next L2 block in sub-second chunks and publishes each chunk before the block is sealed.

**What it does.** Instead of waiting two seconds to learn what is in the block, the network sees Flashblocks as they fill. The same job later finalizes one canonical payload for the Engine API. Empty or underfilled chunks are a production-halt risk if metering or size limits starve the loop.

**How it's built.** `base-builder-core` flashblocks loop; `base-builder-publish` WebSocket broadcast; metering in `base-builder-metering`. Embedded by `base sequencer` (`--flashblocks.port`) or standalone `bin/builder`. Payload type: `FlashblocksPayloadV1` in `base-common-flashblocks`.

**Steps in execution.**

1. **Start job** — Engine forkchoiceUpdated returns a PayloadId for this block.
2. **Chunk** — build_next_flashblock: pick txs, execute, publish delta.
3. **Finalize** — Seal the full payload for getPayload / sequencer seal.

**Questions.**

- ~~**Q-B1** Can Flashblock publish fail without a final block?~~ ✓ Treated as critical: finalize must still produce a valid payload (BLOCK_PRODUCTION_REVIEW, 2026-08-28).

#### S · Sequencer

**In one line.** The brain of live Base: a wall-clock loop that starts, seals, and inserts each L2 block.

**What it does.** On a sequencing node this actor wakes every block time, picks the L1 origin, asks the engine to build, waits for the payload, then (if configured) asks the conductor to commit, gossips the block, and inserts it as the new unsafe head. Validators do not run this loop — they follow gossip and L1 derivation.

**How it's built.** `SequencerActor` in `base-consensus-node`. Build via `PayloadBuilder` + `L1OriginSelector` + `StatefulAttributesBuilder`. Seal pipeline: conductor commit → gossip → `insert_unsafe_payload`. Admin: `admin_startSequencer` / `admin_stopSequencer` (`basectl sequencer`). Requires a sequencer key. `--sequencer.recover` forces empty blocks.

**Steps in execution.**

1. **Tick** — Wall-clock block_time; parent must be the inserted unsafe head.
2. **Attributes** — L1 origin, deposits, pool-on/off, start_build_block → PayloadId.
3. **Seal** — getPayload, then commit / gossip / insert.

**Questions.**

- ~~**Q-S1** Who may sequence?~~ ✓ The configured sequencer key / signer endpoint; conductor leadership gates start when enabled (2026-08-28).

#### W · Conductor

**In one line.** The HA gate: only the raft leader may sequence and commit unsafe payloads.

**What it does.** If two sequencers built at once, the chain would split. Conductor is the lock. This repo owns the client and the seal-time `commit_unsafe_payload` call, plus `basectl conductor` for pause/transfer. The raft process itself is the external conductor RPC (`--conductor.rpc`).

**How it's built.** `ConductorClient` in `base-consensus-node` (`conductor_leader`, commit HTTP or binary). Optional `--conductor.binary-commit`. Operator UX: `basectl conductor status|transfer-leader|pause`.

**Steps in execution.**

1. **Leader?** — admin_startSequencer checks conductor_leader.
2. **Commit** — After seal, commit_unsafe_payload before gossip.
3. **Failover** — Transfer raft leader; the new leader starts sequencing.

**Questions.**

- ~~**Q-W1** Is the raft conductor implemented in this repo?~~ ✓ No — in-repo client + basectl against an external conductor RPC (2026-08-28).

#### N · P2P gossip

**In one line.** How unsafe L2 blocks and peers find each other without going through L1.

**What it does.** There are two meshes. Execution uses DevP2P (tx gossip, EL peers on 30303). Consensus uses libp2p gossipsub + discv5 (9222) to flood signed unsafe payloads. Replicas insert gossiped payloads as the unsafe head, then wait for L1 derivation to make them safe.

**How it's built.** `base-consensus-gossip`, `base-consensus-disc`, `NetworkActor`. Signer address updates come from L1 SystemConfig. Guide: `docs/guides/P2P.md`. Reachability: `base-telemetry` + `basectl p2p reachability`.

**Steps in execution.**

1. **Discover** — discv5 ENR / bootnodes.
2. **Sign & publish** — Sequencer publishes NetworkPayloadEnvelope on the timestamp-selected topic.
3. **Import** — Replica engine newPayload + forkchoiceUpdated → new unsafe head.

### What the node remembers

#### D · Chain store

**In one line.** The on-disk ledger: headers, bodies, receipts, and state the execution engine reads and writes.

**What it does.** Without this disk, the node is an empty process. Snapshots and `reth-data/` are how operators skip years of sync. It is local to one node; it is not shared consensus.

**How it's built.** Reth database under `reth-data/` (docker-compose default). Snapshots via `bin/snapshotter`. Safe-head history is a different file — see SafeDB. Gitignores `/reth-data/`.

**Steps in execution.**

1. **Open** — EL starts and opens the datadir.
2. **Apply** — Each imported or built block writes state, receipts, and indexes.
3. **Serve** — RPC and proofs read historical blocks and storage proofs from here.

#### K · Safe head DB

**In one line.** A small local index: which L2 safe head was derived from which L1 block.

**What it does.** RPC asks “what was safe when L1 was N?” This file answers. It is not the chain; it is a bookmark. Two processes must not open the same file.

**How it's built.** `base-consensus-safedb`, redb-backed `SafeDB`, or `DisabledSafeDB`. Written by the derivation actor; read for `optimism_safeHeadAtL1`. Disabled in derivation-delegation mode.

**Steps in execution.**

1. **Record** — On safe-head confirm, store (l1_block → l2_safe_head).
2. **Query** — RPC optimism_safeHeadAtL1.
3. **Rewind** — Reorg/reset clears or rewrites entries.

**Questions.**

- ~~**Q-K1** Can two nodes share one SafeDB file?~~ ✓ No — not multi-process safe (safedb README, 2026-08-28).

### Ethereum as data availability

#### L · Ethereum L1

**In one line.** The existing chain Base posts data to and derives from — not implemented in this repo.

**What it does.** L1 is the bulletin board and the court. Batches land as blobs or calldata on the inbox. SystemConfig logs can rotate the unsafe-block signer. Finalized L1 blocks finalize derived L2. Dispute games live in L1 contracts.

**How it's built.** Operators pass `--l1-eth-rpc` and `--l1-beacon` (blob sidecars). L1 watcher in `base-consensus-node` polls latest (~4s) and finalized, applies `verifier_l1_confs`, fetches SystemConfig logs. This repo does not host those L1 contracts.

**Steps in execution.**

1. **Watch** — Poll latest/finalized; confirm-delay the derivation head.
2. **Inbox** — Accept batcher txs at batch_inbox_address from the batcher key.
3. **Games** — DisputeGameFactory stores proposals and challenges.

**Questions.**

- ~~**Q-L1** Where do the L1 contracts live?~~ ✓ Outside this repo; addresses come from rollup config / base-common-chains (2026-08-28).

#### A · Batcher

**In one line.** The scheduled writer that compresses unsafe L2 blocks and posts them to Ethereum.

**What it does.** Until the batcher lands, a block is only gossip. After it lands, anyone can re-derive the same chain from L1. If L1 DA backs up, the batcher throttles the sequencer (`miner_setMaxDASize`) so new blocks stay small enough to catch up.

**How it's built.** `bin/batcher` → `base-batcher-service` + `BatchDriver` in `base-batcher-core`. Frames: `base-batcher-encoder` / `base-blobs`. Source: `base-batcher-source`. Inbox from `optimism_rollupConfig` unless shadow-mode override. Parity check via `--parity-validator-l2-rpc-url`.

**Steps in execution.**

1. **Read** — Pull unsafe L2 blocks from the sequencer RPC.
2. **Frame** — Compress into channel frames; pick blob vs calldata.
3. **Submit** — TxManager posts to inbox; confirm; throttle builder if backlog grows.

#### V · Derivation

**In one line.** The pipeline that turns L1 batches and deposits back into L2 payload attributes.

**What it does.** This is how a replica knows the sequencer was honest: it reads the same L1 data and produces the same blocks. The engine then consolidates those attributes as the safe head. Follow nodes skip this and just copy a remote L2.

**How it's built.** `base-consensus-derive` (`no_std` pipeline, also used in fault-proof VMs): `EthereumDataSource`, `StatefulAttributesBuilder`, `OnlinePipeline`. Actor: `DerivationActor` state machine (EL sync → deriving → await safe head). Delegation mode polls a remote sync-status instead.

**Steps in execution.**

1. **Step** — pipeline.step() → PreparedAttributes or NotEnoughData.
2. **Consolidate** — Engine forkchoiceUpdated with derived attributes.
3. **Finalize** — When L1 finalizes the inclusion block, mark the derived L2 finalized.

### Keeping the chain honest

#### O · Output proposer

**In one line.** Periodically claims “L2 at this block has this output root,” backed by a TEE signature.

**What it does.** Permissionless observers need a posted root to challenge. The proposer reads L2/L1, asks a TEE for a signed proposal, checks the output root locally, then calls `DisputeGameFactory.createWithInitData`. Parent game is always re-read from chain so two proposers cannot livelock.

**How it's built.** `bin/proposer` / `base-proposer`. TEE path: nitro host/enclave crates under `crates/proof/tee/`. Game type + factory from chain config. No cached parent — `recover_latest_state()` walks the factory (default 5000 entries) or falls back to `AnchorStateRegistry`.

**Steps in execution.**

1. **Recover parent** — Scan factory for latest matching game_type.
2. **Attest** — TEE-signed proposal; verify output root locally.
3. **Create game** — createWithInitData on L1.

#### H · Challenger

**In one line.** Watches in-progress dispute games and posts a challenge when a claim does not match L2.

**What it does.** If a proposer (or a ZK claim) is wrong, this process proves it. It recomputes output roots from L2 headers and message-passer proofs, asks the prover service for a proof when needed, and calls `nullify()` / `challenge()` on L1. It also walks bond credits back out.

**How it's built.** `bin/challenger` / `base-challenger`: scanner → validator → pending proof sessions → submitter → bond claim. Categories: InvalidTeeProposal, FraudulentZkChallenge, InvalidZkProposal.

**Steps in execution.**

1. **Scan** — IN_PROGRESS games from DisputeGameFactory.
2. **Validate** — Recompute OutputRoot vs onchain claim.
3. **Dispute** — Request proof if needed; nullify/challenge; reclaim bonds.

#### Z · Prover service

**In one line.** The job queue that turns a block range into a TEE attestation or a ZK proof.

**What it does.** Challengers and operators do not run SP1 themselves on the hot path. They submit a session; a worker host claims it. ZK workers talk to Succinct network/cluster/dry-run; TEE workers talk to the nitro enclave. `basectl proofs` is the operator door.

**How it's built.** `base-prover-service` JSON-RPC + postgres (`.zk-prover//`). Workers: `bin/prover/zk-host`, `bin/prover/nitro-host`. Operator: `basectl proofs propose|finalize|submit`. Guide: `docs/guides/STANDALONE_PROVING.md`.

**Steps in execution.**

1. **Queue** — Requester inserts proof_requests row.
2. **Prove** — Worker claims job; ZK or TEE backend.
3. **Return** — Poll status; submit bytes on L1 if that is the workflow.

**Questions.**

- ~~**Q-Z1** Is ZK required to sequence?~~ ✓ No. Sequencing is Engine+gossip+DA. ZK/TEE proving is the dispute/finality path (2026-08-28).

## Flows (representative packets)

Payload shapes are what the design implies, not measured traffic.

### One user transaction

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | U → R | eth_sendRawTransaction | `{"method":"eth_sendRawTransaction","raw":"0x02f8…"}` |
| 2 | R → P | pool insert | `{"hash":"0xabc…","from":"0xuser","nonce":12}` |
| 3 | P → I | base_insertValidatedTransaction | `{"hash":"0xabc…","forwarded":true}` |
| 4 | I → B | inventory | `{"hash":"0xabc…","daBytes":120}` |
| 5 | B → F | flashblock delta | `{"payload_id":"0x7a…","index":3,"txCount":1}` |
| 6 | F → R | pending update | `{"tag":"pending","includes":"0xabc…"}` |
| 7 | B → S | getPayload | `{"payloadId":"0x7a…","blockNumber":42417649}` |
| 8 | S → W | commit_unsafe_payload | `{"blockHash":"0xseal…","number":42417649}` |
| 9 | W → S | committed | `{"leader":true}` |
| 10 | S → N | gossip unsafe | `{"topic":"blocks/v1","signer":"0xseq…"}` |
| 11 | S → E | insert unsafe | `{"method":"engine_newPayload","hash":"0xseal…"}` |

### Batch to L1 and derive

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | S → A | unsafe L2 blocks | `{"first":42417600,"last":42417649}` |
| 2 | A → L | blob batch | `{"to":"batch_inbox","da":"blobs","frames":3}` |
| 3 | L → V | L1 head + inbox data | `{"l1":21200000,"blobs":3}` |
| 4 | V → E | derived attributes | `{"no_tx_pool":true,"deposits":1,"txsFromBatch":40}` |
| 5 | E → V | safe head | `{"l2Safe":42417649,"hash":"0xseal…"}` |
| 6 | V → K | record safe-at-L1 | `{"l1":21200000,"l2Safe":42417649}` |

### Propose and challenge

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | E → O | L2 state for proposal | `{"l2Block":42417000,"outputRoot":"0xout…"}` |
| 2 | O → Z | TEE proposal request | `{"gameType":"tee","parent":"0xgame…"}` |
| 3 | Z → O | attestation | `{"outputRoot":"0xout…","valid":true}` |
| 4 | O → L | createWithInitData | `{"factory":"DisputeGameFactory","root":"0xout…"}` |
| 5 | L → H | IN_PROGRESS game | `{"game":"0xproxy…","claim":"0xout…"}` |
| 6 | H → E | recompute root | `{"l2Block":42417000}` |
| 7 | H → Z | challenge proof | `{"kind":"InvalidTeeProposal"}` |
| 8 | Z → H | proof bytes | `{"backend":"network","status":"succeeded"}` |
| 9 | H → L | challenge() | `{"game":"0xproxy…"}` |

## Questions — index

Reference by ID. ✓ resolved (with date) · otherwise open.

- ~~**Q-U1**~~ (U) ✓ No — they are clients of this repo, not in-tree (2026-08-28).
- **Q-R1** (R) Should the published operator node stay as split EL+CL containers, or is `base rpc` the long-term public shape?
- ~~**Q-F1**~~ (F) ✓ README still calls it alpha: one-way, no payload inspection (2026-08-28).
- ~~**Q-E1**~~ (E) ✓ No. This tree is Reth-based Base execution (2026-08-28).
- ~~**Q-P1**~~ (P) ✓ No. Replicas forward; the sequencer/builder selects (2026-08-28).
- ~~**Q-B1**~~ (B) ✓ Treated as critical: finalize must still produce a valid payload (BLOCK_PRODUCTION_REVIEW, 2026-08-28).
- ~~**Q-S1**~~ (S) ✓ The configured sequencer key / signer endpoint; conductor leadership gates start when enabled (2026-08-28).
- ~~**Q-W1**~~ (W) ✓ No — in-repo client + basectl against an external conductor RPC (2026-08-28).
- ~~**Q-K1**~~ (K) ✓ No — not multi-process safe (safedb README, 2026-08-28).
- ~~**Q-L1**~~ (L) ✓ Outside this repo; addresses come from rollup config / base-common-chains (2026-08-28).
- ~~**Q-Z1**~~ (Z) ✓ No. Sequencing is Engine+gossip+DA. ZK/TEE proving is the dispute/finality path (2026-08-28).

## What the platform gives vs what we own

**Platform gives:** Reth (execution, Engine API, DevP2P, RPC scaffolding), the OP-stack derivation spec and Engine API, Ethereum L1 + blob DA, libp2p gossipsub + discv5, and an external conductor RPC for HA leader election. `base-common-chains` embeds chain IDs, upgrade timestamps, and genesis.

**We own:** The consensus actor graph (`base-consensus-node`), Flashblocks builder and pending-state RPC, Base txpool/forwarding/ingress, the batcher driver, TEE proposer, ZK/TEE prover service, challenger, `basectl`, and the unified `base` binary.

## Planned filesystem

```
bin/
  base/              unified process: `base rpc` | `base sequencer`
  node/              standalone Reth execution (docker-compose EL)
  consensus/         standalone consensus (docker-compose CL)
  builder/           Flashblocks payload builder
  batcher/           L2 → L1 DA
  proposer/          TEE output proposer
  challenger/        dispute-game challenger
  ingress-rpc/       builder tx/bundle intake
  websocket-proxy/   Flashblocks fan-out
  basectl/           operator console
crates/
  consensus/         derive · engine · gossip · service actors
  execution/         node · rpc · txpool · flashblocks · evm
  builder/           core · publish · metering
  batcher/           service · core · encoder · blobs
  proof/             proposer · challenger · prover-service · zk · tee
  common/            chains · genesis · flashblocks types · precompiles
  infra/             basectl · ingress-rpc · websocket-proxy · telemetry
(this atlas repo)
  atlas/data.mjs     single source
  atlas.html         generated map
  SYSTEM.md          generated text twin
  CONTEXT.md         glossary
```

## How this file is maintained

Generated from `atlas/data.mjs` by `node atlas/build.mjs`, which also builds the interactive atlas (`atlas.html`). Edit the data file, rebuild, republish — never edit this file by hand.
