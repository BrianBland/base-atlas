// Single source of truth for the Base node atlas.
// Build: node atlas/build.mjs  → writes SYSTEM.md and atlas.html

export const META = {
  title: 'Base',
  artifactUrl: '',
  sourcePath: 'atlas/data.mjs',
  buildCmd: 'node atlas/build.mjs',
  stats: [
    { k: 'System', v: 'base · node stack' },
    { k: 'Roles', v: 'sequencer · rpc · batcher · proposer · challenger' },
  ],
  intro: `_**This file is the living source of truth for how this repository fits together.** The interactive atlas is built from the same data._`,
  onePara: `This repo is the Base rollup stack: a Reth-based execution node, a consensus node that derives L2 from Ethereum and can sequence, a Flashblocks builder, a batcher that posts L2 data to L1, and a proving path that proposes output roots and challenges bad games. Apps talk to JSON-RPC; the sequencer builds a block every ~2s, streaming Flashblocks first; the batcher writes that history to Ethereum; every other node re-derives the same chain from L1.`,
  costModel: [
    'Not a per-user SaaS bill. The operating costs that matter here are L1 data availability (blob/calldata posted by `base-batcher`), L1 gas for output proposals and dispute games, and proving (TEE attestations plus optional SP1/Succinct ZK).',
    'Block time is `rollup_config.block_time` (2s on Base). Flashblocks are sub-second chunks of the same payload. DA throttle (`miner_setMaxDASize`) shrinks what the builder may include when the L1 backlog grows.',
    'Standalone ZK proving (`just prover up`) is user-funded: `network` pays PROVE on the Succinct marketplace; `dry-run` is free cycle counting; `cluster` is your own GPU farm. See `docs/guides/STANDALONE_PROVING.md`.',
    '',
  ],
  deepDive: '',
  platformGives:
    'Reth (execution, Engine API, DevP2P, RPC scaffolding), the OP-stack derivation spec and Engine API, Ethereum L1 + blob DA, libp2p gossipsub + discv5, and an external conductor RPC for HA leader election. `base-common-chains` embeds chain IDs, upgrade timestamps, and genesis.',
  weOwn:
    'The consensus actor graph (`base-consensus-node`), Flashblocks builder and pending-state RPC, Base txpool/forwarding/ingress, the batcher driver, TEE proposer + TEE prover, ZK prover, challenger, `basectl`, and the unified `base` binary.',
  filesystem: `bin/
  base/              unified process: \`base rpc\` | \`base sequencer\`
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
  CONTEXT.md         glossary`,
};

export const DECISIONS = [
  {
    axis: 'Execution client',
    decision: 'Reth-based Base EL (`bin/node`, `base-node-core`), not op-geth. Engine API over auth IPC when embedded in `base`.',
    adr: '[specs](https://specs.base.org)',
  },
  {
    axis: 'Consensus composition',
    decision: 'Actor-model `RollupNode` in `base-consensus-node`: engine, derivation, L1 watcher, network, optional sequencer + RPC. `FollowNode` skips derivation and mirrors a remote L2.',
    adr: '[crates/consensus/service/README.md](../../crates/consensus/service/README.md)',
  },
  {
    axis: 'Public node packaging',
    decision: 'Operator `docker compose` still ships split EL + CL containers. `base rpc` embeds both in one process and filters sequencer/builder/forwarding flags.',
    adr: '[bin/base/README.md](../../bin/base/README.md)',
  },
  {
    axis: 'Block production',
    decision: 'Sequencer ticks on `block_time`, builds via Engine `forkchoiceUpdated` + `getPayload`, then conductor-commit → gossip → insert. Recovery mode and upgrade blocks force empty payloads.',
    adr: '[docs/guides/BLOCK_PRODUCTION_REVIEW.md](../guides/BLOCK_PRODUCTION_REVIEW.md)',
  },
  {
    axis: 'Preconfirmation',
    decision: 'Flashblocks: sub-second payload deltas over WebSocket (`FlashblocksPayloadV1`), reconciled to the canonical block on the RPC node.',
    adr: '[crates/common/flashblocks](../../crates/common/flashblocks)',
  },
  {
    axis: 'Data availability',
    decision: 'Batcher posts frames as blobs or calldata to `batch_inbox_address`. Shadow mode may override the inbox only when paired with `--shadow-mode`.',
    adr: '[bin/batcher/README.md](../../bin/batcher/README.md)',
  },
  {
    axis: 'Fault proofs',
    decision: 'TEE proposer creates dispute games via `DisputeGameFactory.createWithInitData`. Challenger + ZK prover service invalidate bad games. Standalone proving is user-funded.',
    adr: '[docs/guides/STANDALONE_PROVING.md](../guides/STANDALONE_PROVING.md)',
  },
];

export const GROUPS = [
  { id: 'surf', title: 'Surfaces' },
  { id: 'loop', title: 'The production loop' },
  { id: 'mem', title: 'What the node remembers' },
  { id: 'da', title: 'Ethereum as data availability' },
  { id: 'honest', title: 'Keeping the chain honest' },
];

// Five participating roles. Surroundings (Apps, L1) stay on NODES.
// E2E plates are padded AABBs around each role’s components (Sequencer also wraps RPC).
export const ROLES = [
  {
    id: 'rpc',
    name: 'RPC',
    short: 'RPC',
    code: 'RPC',
    kind: 'screen',
    gx: 3.6, gy: 6.4, w: 3, d: 2.4, h: 50,
    one: 'Anyone-can-run validator node: serve JSON-RPC, hear blocks over P2P, forward txs toward the sequencer.',
    what: 'The public flavor of a Base node. It receives unsafe payloads over gossip, derives safe from L1, serves <code>eth_*</code>, and subscribes to Flashblocks for <code>pending</code>. It inserts a tx into the sequencer when it can; otherwise it forwards toward the cluster. Stock <code>base rpc</code> currently filters forwarding flags — the forward path lives in <code>base-tx-forwarding</code> / ingress.',
    how: '<code>base rpc</code> embeds EL+CL, or docker-compose split EL+CL. The e2e plate is the ordinary node: RPC, pool, engine, disk, Flashblocks subscribe, gossip, derivation, SafeDB. A sequencer is this plate plus builder, tx ingress, and conductor.',
    components: ['R', 'P', 'F', 'E', 'D', 'G', 'V', 'K'],
    layer: 1,
  },
  {
    id: 'seq',
    name: 'Sequencer',
    short: 'SEQUENCER',
    code: 'SEQ',
    kind: 'tall',
    gx: 6.6, gy: 0.2, w: 3.2, d: 2.4, h: 64,
    one: 'An RPC node plus the production extras: tx ingress, Flashblocks builder, and conductor.',
    what: 'A sequencer is a superset of an RPC node. Same engine, disk, gossip, and derivation — plus the door and lock that actually build blocks. Conductor is the per-replica raft lock; only the leader may seal. This map does not draw every replica.',
    how: '<code>base sequencer</code> embeds EL + Flashblocks builder + CL. Conductor is per replica; raft is conductor-to-conductor.',
    components: ['I', 'B', 'W'],
    layer: 0,
    contains: ['rpc'],
  },
  {
    id: 'batcher',
    name: 'Batcher',
    short: 'BATCHER',
    code: 'BCH',
    kind: 'job',
    gx: 10.4, gy: 7.2, w: 2.6, d: 2.2, h: 44,
    one: 'Reads unsafe L2 from the sequencer and posts frames to Ethereum.',
    what: 'Not a p2p node. Connects to sequencer RPC, compresses channels, submits blobs or calldata to the L1 inbox, and throttles the builder if DA backs up.',
    how: '<code>bin/batcher</code> / <code>base-batcher-service</code>. One job on the e2e map.',
    components: ['A'],
  },
  {
    id: 'proposer',
    name: 'Proposer',
    short: 'PROPOSER',
    code: 'PRP',
    kind: 'job',
    gx: 10.4, gy: 2.6, w: 2.6, d: 2.2, h: 44,
    one: 'Reads a validator’s L2 state, attests an output root in a TEE, posts a dispute game on L1.',
    what: 'Not the sequencer. Needs an L2 validator (usually an RPC node) plus L1. Parent game is always re-read from chain.',
    how: '<code>bin/proposer</code> / <code>base-proposer</code>. TEE path under <code>crates/proof/tee/</code>.',
    components: ['O', 'T'],
  },
  {
    id: 'challenger',
    name: 'Challenger',
    short: 'CHALLENGER',
    code: 'CHL',
    kind: 'gate',
    gx: 10.4, gy: 10.8, w: 2.6, d: 2.2, h: 46,
    one: 'Watches L1 games, recomputes against a validator, fetches a proof, publishes the challenge.',
    what: 'The ZK prover lives inside this role — a job queue for proof bytes, not a peer. Challenger connects to a validator and to L1. TEE attestations for proposals sit with the Proposer.',
    how: '<code>bin/challenger</code> / <code>base-challenger</code> plus <code>base-prover-service</code> ZK workers.',
    components: ['H', 'Z'],
  },
];

export const NETWORK_HOPS = [
  ['U', 'role:rpc', 'eth_sendRawTransaction', { raw: '0x02f8…' }, 'yx'],
  ['role:rpc', 'role:seq', 'insert or forward', { to: 'sequencer' }, 'xy'],
  ['role:seq', 'role:rpc', 'Flashblocks + gossip', { pending: true, unsafe: true }, 'yx'],
  ['role:seq', 'role:batcher', 'unsafe L2', { first: 42417600 }, 'xy'],
  ['role:batcher', 'L', 'blob batch', { inbox: 'batch_inbox' }, 'xy'],
  ['role:rpc', 'role:proposer', 'L2 state', { outputRoot: '0xout…' }, 'xy'],
  ['role:proposer', 'L', 'createWithInitData', { factory: 'DisputeGameFactory' }, 'xy'],
  ['role:rpc', 'role:challenger', 'L2 state', { l2Block: 42417000 }, 'yx'],
  ['role:challenger', 'L', 'challenge()', { game: '0xproxy…' }, 'yx'],
];

export const NODES = [
  {
    id: 'U', code: 'U', name: 'Apps and wallets', short: 'APPS', group: 'surf', surround: true,
    gx: -3.2, gy: 7.8, w: 2, d: 2, h: 44, kind: 'screen',
    net: { gx: 0.2, gy: 6.6, w: 2, d: 2, h: 44 },
    one: 'Wallets, dapps, and scripts that send transactions and read chain state.',
    what: 'Anything that speaks Ethereum JSON-RPC: a browser wallet, a bot, an indexer, or `cast`. It does not run the rollup. It posts a signed transaction or asks for a block, a receipt, or a `pending` view that may already include Flashblocks.',
    how: 'Talks to a public or self-hosted endpoint (`https://mainnet.base.org` or a local `base rpc` / docker-compose EL on <code>:8545</code>). This repo does not ship a wallet or explorer.',
    steps: [
      ['Sign', 'User or app signs an L2 transaction.'],
      ['Submit', 'eth_sendRawTransaction (or a bundle) to an RPC URL.'],
      ['Watch', 'Poll receipts or subscribe; pending may come from Flashblocks.'],
    ],
  },
  {
    id: 'R', code: 'R', name: 'JSON-RPC node', short: 'RPC NODE', group: 'surf', role: 'rpc',
    gx: 3.0, gy: 7.8, w: 2.4, d: 2, h: 48, kind: 'screen',
    one: 'The public face of a Base node: Ethereum JSON-RPC plus rollup and Flashblocks methods.',
    what: 'The process an operator runs to serve the chain. In docker-compose this is two containers (execution + consensus). `base rpc` embeds both in one process and hides sequencer flags. Replica nodes forward user transactions toward the sequencer and subscribe to Flashblocks so `pending` is live.',
    how: '<code>bin/base</code> (`base rpc`) or <code>docker-compose.yml</code> (`execution-entrypoint` + `consensus-entrypoint`). RPC crates: <code>base-execution-rpc</code>, <code>base-flashblocks</code>, <code>base-consensus-rpc</code> (`optimism_syncStatus`, admin, P2P). Ports 8545/8546 typical.',
    steps: [
      ['Admit', 'Accept eth_*, debug_*, optimism_*, flashblock subscriptions.'],
      ['Read', 'Serve canonical state from the execution DB; pending from Flashblocks.'],
      ['Forward', 'Insert into the sequencer when possible; otherwise forward toward ingress. Stock `base rpc` currently filters forwarding flags — the path lives in `base-tx-forwarding` / ingress.'],
    ],
  },
  {
    id: 'E', code: 'E', name: 'Execution engine', short: 'EXECUTION', group: 'loop', role: 'rpc',
    gx: 6.8, gy: 4.6, w: 3, d: 2.2, h: 40, kind: 'slab',
    one: 'The Reth-based EVM that executes transactions and answers the Engine API.',
    what: 'This is the computer that actually runs the block. Consensus never executes bytecode itself — it asks this engine to build or import a payload, then treats the resulting block hash as truth. Same engine on the sequencer and on every replica.',
    how: '<code>bin/node</code> / <code>base-node-core</code> + <code>base-execution-evm</code> + Base precompiles in <code>base-common-precompiles</code>. Engine types and API builder in <code>base-node-core</code>. Auth Engine API over IPC when embedded, HTTP+JWT when split. Fatal precompile/EVM errors here can halt block production — see <code>docs/guides/BLOCK_PRODUCTION_REVIEW.md</code>.',
    steps: [
      ['forkchoiceUpdated', 'Consensus sets head and, on the sequencer, starts a payload build.'],
      ['Execute', 'Apply deposits, then txpool or derived txs, against parent state.'],
      ['getPayload / newPayload', 'Return a sealed payload, or import one from gossip/derivation.'],
    ],
  },
  {
    id: 'D', code: 'D', name: 'Chain store', short: 'CHAIN DB', group: 'mem', role: 'rpc',
    gx: 6.8, gy: 7.8, w: 3, d: 2, h: 26, kind: 'store',
    one: 'The on-disk ledger: headers, bodies, receipts, and state the execution engine reads and writes.',
    what: 'Without this disk, the node is an empty process. Snapshots and `reth-data/` are how operators skip years of sync. It is local to one node; it is not shared consensus.',
    how: 'Reth database under <code>reth-data/</code> (docker-compose default). Snapshots via <code>bin/snapshotter</code>. Safe-head history is a different file — see SafeDB. Gitignores <code>/reth-data/</code>.',
    steps: [
      ['Open', 'EL starts and opens the datadir.'],
      ['Apply', 'Each imported or built block writes state, receipts, and indexes.'],
      ['Serve', 'RPC and proofs read historical blocks and storage proofs from here.'],
    ],
  },
  {
    id: 'P', code: 'P', name: 'Transaction pool', short: 'TXPOOL', group: 'loop', role: 'rpc',
    gx: 3.0, gy: 11.0, w: 2.4, d: 2, h: 28, kind: 'store',
    one: 'The mempool: valid not-yet-included transactions, ordered for the builder.',
    what: 'When you send a transaction, it sits here until a block (or Flashblock) takes it. Base adds L1-data-fee checks and its own ordering. Replica nodes can drain this pool toward tx ingress.',
    how: '<code>base-execution-txpool</code>: <code>BaseTransactionValidator</code>, <code>BaseOrdering</code>. Forwarding: <code>base-tx-forwarding</code> (`base_insertValidatedTransaction`). Inspect/clear via <code>basectl txpool</code>.',
    steps: [
      ['Validate', 'Signature, nonce, balance, L1 data fee, Base rules.'],
      ['Park', 'Pending vs queued by nonce.'],
      ['Select', 'Builder pulls best txs under gas/DA/metering limits.'],
    ],
  },
  {
    id: 'I', code: 'I', name: 'Tx ingress', short: 'TX INGRESS', group: 'loop', role: 'seq',
    gx: 3.0, gy: 0.4, w: 2.4, d: 2, h: 40, kind: 'box',
    one: 'The builder-facing JSON-RPC that accepts validated transactions and bundles.',
    what: 'The public RPC is not where searchers and mempool nodes dump inventory into the sequencer. Tx ingress is that door: validate a bundle, meter it, emit an audit event, hand it to the builder connection.',
    how: '<code>bin/ingress-rpc</code> / <code>ingress-rpc-lib</code>: <code>IngressService</code>, <code>validate_bundle</code>, <code>BuilderConnector</code>, health + metrics. Wire format for pool forwarding is <code>ValidatedTransaction</code> in <code>base-execution-txpool</code>.',
    steps: [
      ['Accept', 'JSON-RPC tx or bundle.'],
      ['Meter', 'Ask the builder connector whether it fits current limits.'],
      ['Emit', 'Audit event; builder sees the inventory.'],
    ],
  },
  {
    id: 'B', code: 'B', name: 'Flashblocks builder', short: 'BUILDER', group: 'loop', role: 'seq',
    gx: 6.8, gy: 0.4, w: 3, d: 2.2, h: 42, kind: 'job',
    one: 'Builds the next L2 block in public chunks, then seals one payload for conductor, engine, and gossip.',
    what: 'The producer in the Sequencer role. It streams Flashblocks on the WebSocket as the block fills, then the same job finalizes one canonical payload. That sealed payload is what conductor commits, the engine inserts, and gossip publishes. Empty or underfilled chunks are a production-halt risk if metering or size limits starve the loop.',
    how: '<code>base-builder-core</code> flashblocks loop; <code>base-builder-publish</code> WebSocket broadcast; metering in <code>base-builder-metering</code>. Embedded by <code>base sequencer</code> (`--flashblocks.port`) or standalone <code>bin/builder</code>. Payload type: <code>FlashblocksPayloadV1</code> in <code>base-common-flashblocks</code>.',
    steps: [
      ['Start job', 'Engine forkchoiceUpdated returns a PayloadId for this block.'],
      ['Chunk', 'build_next_flashblock: pick txs, execute, publish delta.'],
      ['Seal', 'Finalize the full payload; commit via conductor, insert in the engine, gossip to the fleet.'],
    ],
  },
  {
    id: 'F', code: 'F', name: 'Flashblocks stream', short: 'FLASH WS', group: 'surf', role: 'rpc',
    gx: 3.0, gy: 4.6, w: 2.4, d: 2, h: 40, kind: 'screen',
    one: 'The WebSocket door: Flashblock payloads leave the builder toward RPC nodes.',
    what: 'RPC nodes subscribe so `eth_getBlockByNumber("pending")` stays ahead of the sealed block. A proxy sits in front so the sequencer is not crushed by every replica opening a socket.',
    how: 'Publisher: <code>base-builder-publish</code>. Subscriber: <code>FlashblocksSubscriber</code> in <code>base-flashblocks</code>. Fan-out: <code>bin/websocket-proxy</code> (upstream rollup-boost / builder WS; optional Brotli). <code>basectl flashblocks</code> prints JSONL; <code>eth_subscribe("newFlashblocks")</code> on the node.',
    steps: [
      ['Publish', 'Builder broadcasts FlashblocksPayloadV1 (index 0 includes base).'],
      ['Proxy', 'websocket-proxy fans out to replicas.'],
      ['Reconcile', 'FlashblocksState + CanonicalBlockReconciler merge pending with canonical.'],
    ],
  },
  {
    id: 'W', code: 'W', name: 'Conductor', short: 'CONDUCTOR', group: 'loop', role: 'seq',
    gx: 10.6, gy: 0.4, w: 2.4, d: 2, h: 46, kind: 'gate',
    one: 'Per-replica raft lock: only the leader may commit a sealed payload.',
    what: 'Conductor is part of the Sequencer role, not a sibling of the builder. Each replica talks to its own conductor; raft is conductor-to-conductor. The builder hands the sealed payload here before gossip or insert. Only the leader replica may commit.',
    how: '<code>ConductorClient</code> in <code>base-consensus-node</code> (`conductor_leader`, commit HTTP or binary). Optional <code>--conductor.binary-commit</code>. The raft process is an external conductor RPC (`--conductor.rpc`).',
    steps: [
      ['Elect', 'Raft among conductors picks one replica as leader.'],
      ['Gate start', 'admin_startSequencer checks conductor_leader.'],
      ['Commit', 'Only the leader replica may commit_unsafe_payload, then gossip.'],
    ],
  },
  {
    id: 'G', code: 'G', name: 'P2P gossip', short: 'GOSSIP', group: 'loop', role: 'rpc',
    gx: 10.6, gy: 4.6, w: 2.4, d: 2, h: 40, kind: 'box',
    one: 'The libp2p door: signed unsafe L2 payloads leave the sequencer toward RPC nodes.',
    what: 'How sealed unsafe blocks reach the rest of the fleet without waiting for L1. Consensus uses libp2p gossipsub + discv5 (9222). Execution DevP2P (30303) is a different mesh for txs and EL peers. An RPC node that hears a payload inserts it as unsafe, then waits for derivation to make it safe.',
    how: '<code>base-consensus-gossip</code>, <code>base-consensus-disc</code>, <code>NetworkActor</code>. Signer address updates come from L1 SystemConfig. Guide: <code>docs/guides/P2P.md</code>. Reachability: <code>base-telemetry</code> + <code>basectl p2p reachability</code>.',
    steps: [
      ['Discover', 'discv5 ENR / bootnodes.'],
      ['Sign & publish', 'Sequencer publishes NetworkPayloadEnvelope on the timestamp-selected topic.'],
      ['Import', 'Replica engine newPayload + forkchoiceUpdated → new unsafe head.'],
    ],
  },
  {
    id: 'L', code: 'L', name: 'Ethereum L1', short: 'ETHEREUM', group: 'da', surround: true,
    gx: 23.6, gy: 6.4, w: 3, d: 2.2, h: 38, kind: 'slab',
    net: { gx: 18.4, gy: 6.2, w: 3, d: 2.2, h: 38 },
    one: 'The existing chain Base posts data to and derives from — not implemented in this repo.',
    what: 'L1 is the bulletin board and the court. Batches land as blobs or calldata on the inbox. SystemConfig logs can rotate the unsafe-block signer. Finalized L1 blocks finalize derived L2. Dispute games live in L1 contracts.',
    how: 'Operators pass <code>--l1-eth-rpc</code> and <code>--l1-beacon</code> (blob sidecars). L1 watcher in <code>base-consensus-node</code> polls latest (~4s) and finalized, applies <code>verifier_l1_confs</code>, fetches SystemConfig logs. This repo does not host those L1 contracts.',
    steps: [
      ['Watch', 'Poll latest/finalized; confirm-delay the derivation head.'],
      ['Inbox', 'Accept batcher txs at batch_inbox_address from the batcher key.'],
      ['Games', 'DisputeGameFactory stores proposals and challenges.'],
    ],
  },
  {
    id: 'A', code: 'A', name: 'Batcher', short: 'BATCHER', group: 'da', role: 'batcher',
    gx: 15.4, gy: 7.5, w: 2.4, d: 2, h: 42, kind: 'job',
    one: 'The scheduled writer that compresses unsafe L2 blocks and posts them to Ethereum.',
    what: 'Until the batcher lands, a block is only gossip. After it lands, anyone can re-derive the same chain from L1. If L1 DA backs up, the batcher throttles the sequencer (`miner_setMaxDASize`) so new blocks stay small enough to catch up.',
    how: '<code>bin/batcher</code> → <code>base-batcher-service</code> + <code>BatchDriver</code> in <code>base-batcher-core</code>. Frames: <code>base-batcher-encoder</code> / <code>base-blobs</code>. Source: <code>base-batcher-source</code>. Inbox from <code>optimism_rollupConfig</code> unless shadow-mode override. Parity check via <code>--parity-validator-l2-rpc-url</code>.',
    steps: [
      ['Read', 'Pull unsafe L2 blocks from the sequencer RPC.'],
      ['Frame', 'Compress into channel frames; pick blob vs calldata.'],
      ['Submit', 'TxManager posts to inbox; confirm; throttle builder if backlog grows.'],
    ],
  },
  {
    id: 'V', code: 'V', name: 'Derivation', short: 'DERIVE', group: 'da', role: 'rpc',
    gx: 10.6, gy: 7.8, w: 2.4, d: 2, h: 40, kind: 'box',
    one: 'The pipeline that turns L1 batches and deposits back into L2 payload attributes.',
    what: 'This is how a replica knows the sequencer was honest: it reads the same L1 data and produces the same blocks. The engine then consolidates those attributes as the safe head. Follow nodes skip this and just copy a remote L2.',
    how: '<code>base-consensus-derive</code> (`no_std` pipeline, also used in fault-proof VMs): <code>EthereumDataSource</code>, <code>StatefulAttributesBuilder</code>, <code>OnlinePipeline</code>. Actor: <code>DerivationActor</code> state machine (EL sync → deriving → await safe head). Delegation mode polls a remote sync-status instead.',
    steps: [
      ['Step', 'pipeline.step() → PreparedAttributes or NotEnoughData.'],
      ['Consolidate', 'Engine forkchoiceUpdated with derived attributes.'],
      ['Finalize', 'When L1 finalizes the inclusion block, mark the derived L2 finalized.'],
    ],
  },
  {
    id: 'K', code: 'K', name: 'Safe head DB', short: 'SAFEDB', group: 'mem', role: 'rpc',
    gx: 6.8, gy: 11.0, w: 2.4, d: 2, h: 26, kind: 'store',
    one: 'A small local index: which L2 safe head was derived from which L1 block.',
    what: 'RPC asks “what was safe when L1 was N?” This file answers. It is not the chain; it is a bookmark. Two processes must not open the same file.',
    how: '<code>base-consensus-safedb</code>, redb-backed <code>SafeDB</code>, or <code>DisabledSafeDB</code>. Written by the derivation actor; read for <code>optimism_safeHeadAtL1</code>. Disabled in derivation-delegation mode.',
    steps: [
      ['Record', 'On safe-head confirm, store (l1_block → l2_safe_head).'],
      ['Query', 'RPC optimism_safeHeadAtL1.'],
      ['Rewind', 'Reorg/reset clears or rewrites entries.'],
    ],
  },
  {
    id: 'O', code: 'O', name: 'Output proposer', short: 'PROPOSER', group: 'honest', role: 'proposer',
    gx: 15.4, gy: 2.4, w: 2.4, d: 2, h: 42, kind: 'job',
    one: 'Periodically claims “L2 at this block has this output root,” backed by a TEE signature.',
    what: 'Permissionless observers need a posted root to challenge. The proposer reads L2/L1, asks a TEE for a signed proposal, checks the output root locally, then calls `DisputeGameFactory.createWithInitData`. Parent game is always re-read from chain so two proposers cannot livelock.',
    how: '<code>bin/proposer</code> / <code>base-proposer</code>. TEE path: nitro host/enclave crates under <code>crates/proof/tee/</code>. Game type + factory from chain config. No cached parent — <code>recover_latest_state()</code> walks the factory (default 5000 entries) or falls back to <code>AnchorStateRegistry</code>.',
    steps: [
      ['Recover parent', 'Scan factory for latest matching game_type.'],
      ['Attest', 'TEE-signed proposal; verify output root locally.'],
      ['Create game', 'createWithInitData on L1.'],
    ],
  },
  {
    id: 'T', code: 'T', name: 'TEE prover', short: 'TEE PROVER', group: 'honest', role: 'proposer',
    gx: 18.4, gy: 2.4, w: 2.4, d: 2, h: 42, kind: 'cards',
    one: 'The enclave job that signs an output-root proposal for the proposer.',
    what: 'The proposer does not invent a signature. It asks this TEE worker for an attestation, then checks the output root locally before posting a dispute game. Same prover-service queue as the ZK path, different backend (nitro enclave).',
    how: '<code>bin/prover/nitro-host</code> + TEE crates under <code>crates/proof/tee/</code>. Sessions go through <code>base-prover-service</code>. Guide: <code>docs/guides/STANDALONE_PROVING.md</code>.',
    steps: [
      ['Queue', 'Proposer inserts a TEE proposal request.'],
      ['Attest', 'Nitro host claims the job and signs in the enclave.'],
      ['Return', 'Proposer verifies the output root, then createWithInitData.'],
    ],
  },
  {
    id: 'H', code: 'H', name: 'Challenger', short: 'CHALLENGER', group: 'honest', role: 'challenger',
    gx: 15.4, gy: 12.6, w: 2.4, d: 2, h: 46, kind: 'gate',
    one: 'Watches in-progress dispute games and posts a challenge when a claim does not match L2.',
    what: 'If a proposer (or a ZK claim) is wrong, this process proves it. It recomputes output roots from L2 headers and message-passer proofs, asks the prover service for a proof when needed, and calls `nullify()` / `challenge()` on L1. It also walks bond credits back out.',
    how: '<code>bin/challenger</code> / <code>base-challenger</code>: scanner → validator → pending proof sessions → submitter → bond claim. Categories: InvalidTeeProposal, FraudulentZkChallenge, InvalidZkProposal.',
    steps: [
      ['Scan', 'IN_PROGRESS games from DisputeGameFactory.'],
      ['Validate', 'Recompute OutputRoot vs onchain claim.'],
      ['Dispute', 'Request proof if needed; nullify/challenge; reclaim bonds.'],
    ],
  },
  {
    id: 'Z', code: 'Z', name: 'ZK prover', short: 'ZK PROVER', group: 'honest', role: 'challenger',
    gx: 18.4, gy: 12.6, w: 2.4, d: 2, h: 42, kind: 'cards',
    one: 'The job queue that turns a disputed range into a ZK proof for the challenger.',
    what: 'The challenger does not run SP1 on the hot path. It submits a session; a ZK worker claims it (Succinct network, cluster, or dry-run). TEE attestations for new proposals live with the Proposer, not here.',
    how: '<code>base-prover-service</code> JSON-RPC + postgres (`.zk-prover/<network>/`). Worker: <code>bin/prover/zk-host</code>. Operator: <code>basectl proofs</code>. Guide: <code>docs/guides/STANDALONE_PROVING.md</code>.',
    steps: [
      ['Queue', 'Challenger inserts a proof_requests row.'],
      ['Prove', 'ZK host claims the job; Succinct network/cluster/dry-run.'],
      ['Return', 'Challenger fetches bytes and challenge() on L1.'],
    ],
  },
];

export const FLOWS = [
  {
    id: 'tx',
    name: 'One user transaction',
    hops: [
      ['U', 'R', 'eth_sendRawTransaction', { method: 'eth_sendRawTransaction', raw: '0x02f8…' }, 'yx'],
      ['R', 'P', 'pool insert', { hash: '0xabc…', from: '0xuser', nonce: 12 }, 'xy'],
      ['P', 'I', 'base_insertValidatedTransaction', { hash: '0xabc…', forwarded: true }, 'xy'],
      ['I', 'B', 'inventory', { hash: '0xabc…', daBytes: 120 }, 'xy'],
      ['B', 'F', 'flashblock delta', { payload_id: '0x7a…', index: 3, txCount: 1 }, 'yx'],
      ['F', 'R', 'pending update', { tag: 'pending', includes: '0xabc…' }, 'yx'],
      ['B', 'W', 'commit_unsafe_payload', { blockHash: '0xseal…', number: 42417649 }, 'xy'],
      ['W', 'B', 'committed', { leader: true }, 'yx'],
      ['B', 'G', 'gossip unsafe', { topic: 'blocks/v1', signer: '0xseq…' }, 'yx'],
      ['B', 'E', 'insert unsafe', { method: 'engine_newPayload', hash: '0xseal…' }, 'xy'],
    ],
  },
  {
    id: 'da',
    name: 'Batch to L1 and derive',
    hops: [
      ['B', 'A', 'unsafe L2 blocks', { first: 42417600, last: 42417649 }, 'xy'],
      ['A', 'L', 'blob batch', { to: 'batch_inbox', da: 'blobs', frames: 3 }, 'xy'],
      ['L', 'V', 'L1 head + inbox data', { l1: 21200000, blobs: 3 }, 'yx'],
      ['V', 'E', 'derived attributes', { no_tx_pool: true, deposits: 1, txsFromBatch: 40 }, 'yx'],
      ['E', 'V', 'safe head', { l2Safe: 42417649, hash: '0xseal…' }, 'xy'],
      ['V', 'K', 'record safe-at-L1', { l1: 21200000, l2Safe: 42417649 }, 'yx'],
    ],
  },
  {
    id: 'proof',
    name: 'Propose and challenge',
    hops: [
      ['E', 'O', 'L2 state for proposal', { l2Block: 42417000, outputRoot: '0xout…' }, 'xy'],
      ['O', 'T', 'TEE proposal request', { gameType: 'tee', parent: '0xgame…' }, 'xy'],
      ['T', 'O', 'attestation', { outputRoot: '0xout…', valid: true }, 'yx'],
      ['O', 'L', 'createWithInitData', { factory: 'DisputeGameFactory', root: '0xout…' }, 'xy'],
      ['L', 'H', 'IN_PROGRESS game', { game: '0xproxy…', claim: '0xout…' }, 'yx'],
      ['H', 'E', 'recompute root', { l2Block: 42417000 }, 'yx'],
      ['H', 'Z', 'challenge proof', { kind: 'InvalidTeeProposal' }, 'xy'],
      ['Z', 'H', 'proof bytes', { backend: 'network', status: 'succeeded' }, 'yx'],
      ['H', 'L', 'challenge()', { game: '0xproxy…' }, 'xy'],
    ],
  },
  {
    id: 'ha',
    name: 'Conductor HA',
    hops: [
      ['B', 'W', 'conductor_leader?', { cluster: true }, 'xy'],
      ['W', 'B', 'leader elected', { role: 'leader' }, 'yx'],
      ['B', 'E', 'forkchoiceUpdated', { noTxPool: false }, 'xy'],
      ['B', 'W', 'commit_unsafe_payload', { blockHash: '0xseal…' }, 'xy'],
      ['W', 'B', 'committed', { role: 'leader' }, 'yx'],
    ],
  },
];

export const CH = [
  {
    id: 'you',
    title: 'You and the node',
    reveal: ['U', 'R'],
    lede: `Strip everything away and Base is a JSON-RPC URL you already know how to call.`,
    story: `<p>An app signs an L2 transaction and posts it to a node. That node is either the unified <code>base rpc</code> process or the public docker-compose pair. <mark>This repo is the node, not the wallet.</mark></p>`,
    flow: [
      ['U', 'R', 'eth_sendRawTransaction', { raw: '0x02f8…' }],
      ['R', 'U', 'tx hash', { result: '0xabc…' }],
    ],
  },
  {
    id: 'exec',
    title: 'The engine and the disk',
    reveal: ['E', 'D'],
    lede: `RPC is a window. The Reth engine and its datadir are the room behind it.`,
    story: `<p>Every read and every block execution hits the execution engine. Consensus never runs the EVM itself — it speaks the Engine API. <mark>The chain lives on disk in <code>reth-data/</code></mark>, which is why snapshots matter.</p>`,
    flow: [
      ['U', 'R', 'eth_getBlockByNumber', { block: 'latest' }],
      ['R', 'E', 'header + body', { number: 42417649 }],
      ['E', 'D', 'read', { kind: 'header', number: 42417649 }],
      ['D', 'E', 'block', { hash: '0xseal…' }],
      ['E', 'R', 'result', { number: 42417649 }],
      ['R', 'U', 'block json', { txCount: 120 }],
    ],
  },
  {
    id: 'pool',
    title: 'Getting into the mempool',
    reveal: ['P', 'I'],
    lede: `A submitted transaction parks in the pool, then (on replicas) is forwarded to the builder door.`,
    story: `<p>The public RPC validates and parks the tx. Replica nodes do not sequence — they <mark>forward validated inventory</mark> to tx ingress, which meters bundles into the builder.</p>`,
    flow: [
      ['U', 'R', 'eth_sendRawTransaction', { raw: '0x02f8…' }],
      ['R', 'P', 'insert', { hash: '0xabc…', nonce: 12 }],
      ['P', 'I', 'base_insertValidatedTransaction', { hash: '0xabc…' }],
      ['I', 'P', 'ack', { queued: true }],
    ],
  },
  {
    id: 'flash',
    title: 'Flashblocks',
    reveal: ['B', 'F'],
    lede: `The next block is built in public, a chunk at a time, before it has a hash you can finalize.`,
    story: `<p>The builder executes the best pool transactions in sub-second passes and publishes <code>FlashblocksPayloadV1</code> on a WebSocket. RPC nodes reconcile those deltas into <mark><code>pending</code></mark> so wallets do not wait for the 2s seal.</p>`,
    flow: [
      ['P', 'I', 'inventory', { hash: '0xabc…' }],
      ['I', 'B', 'select', { hash: '0xabc…' }],
      ['B', 'F', 'flashblock', { payload_id: '0x7a…', index: 3 }],
      ['F', 'R', 'pending', { includes: '0xabc…' }],
      ['R', 'U', 'eth_getTransactionReceipt', { status: 'pending-in-flashblock' }],
    ],
  },
  {
    id: 'seal',
    title: 'Sealing the block',
    reveal: ['W'],
    lede: `The same builder that streamed Flashblocks now seals one payload. Conductor is the lock.`,
    story: `<p>There is no extra Sequencer box. The builder commits through conductor, then the payload hits the engine. <mark>Raft is conductor-to-conductor</mark>; only the leader replica may seal. This map shows one sequencer’s internals.</p>`,
    flow: [
      ['B', 'W', 'conductor_leader?', {}],
      ['W', 'B', 'leader', { leader: true }],
      ['B', 'E', 'forkchoiceUpdated', { noTxPool: false }],
      ['B', 'W', 'commit_unsafe_payload', { blockHash: '0xseal…' }],
      ['W', 'B', 'committed', { leader: true }],
    ],
  },
  {
    id: 'net',
    title: 'Telling the rest of the fleet',
    reveal: ['G'],
    lede: `Flashblocks and the sealed payload leave the builder toward RPC nodes.`,
    story: `<p>The Flashblocks WebSocket and consensus gossip are how the Sequencer role speaks to RPC nodes. Those nodes take pending chunks from the stream and unsafe heads from gossip. <mark>Safe still requires L1.</mark></p>`,
    flow: [
      ['F', 'R', 'flashblocks', { kind: 'ws' }],
      ['B', 'G', 'publish unsafe', { hash: '0xseal…' }],
      ['G', 'R', 'import on RPC', { topic: 'blocks/v1' }],
    ],
  },
  {
    id: 'batch',
    title: 'Posting the history to Ethereum',
    reveal: ['L', 'A'],
    lede: `Gossip is fast. Ethereum is the copy of record.`,
    story: `<p>The batcher reads unsafe L2, frames it, and posts blobs (or calldata) to the inbox. If it falls behind, it <mark>throttles what the builder may include</mark> so DA can catch up. L1 contracts are not in this repo.</p>`,
    flow: [
      ['B', 'A', 'unsafe range', { first: 42417600, last: 42417649 }],
      ['A', 'L', 'submit blobs', { inbox: 'batch_inbox', frames: 3 }],
      ['L', 'A', 'receipt', { l1Block: 21200000, status: 1 }],
    ],
  },
  {
    id: 'derive',
    title: 'Deriving the safe chain',
    reveal: ['V', 'K'],
    lede: `Every honest node can rebuild the same safe head from L1 data alone.`,
    story: `<p>Derivation pulls inbox data and deposits, builds payload attributes, and asks the engine to consolidate them. The safe-head DB remembers the mapping so <code>optimism_safeHeadAtL1</code> is cheap. <mark>Follow nodes skip this and mirror a remote L2.</mark></p>`,
    flow: [
      ['L', 'V', 'inbox + deposits', { l1: 21200000 }],
      ['V', 'E', 'attributes', { no_tx_pool: true }],
      ['E', 'V', 'safe head', { l2: 42417649 }],
      ['V', 'K', 'index', { l1: 21200000, l2Safe: 42417649 }],
    ],
  },
  {
    id: 'proofs',
    title: 'Proposing and challenging roots',
    reveal: ['O', 'T', 'H', 'Z'],
    lede: `L1 also holds court: a TEE-backed proposer posts roots; a challenger and a ZK prover dispute the bad ones.`,
    story: `<p>Sequencing does not wait for a SNARK. The proposer asks the TEE prover for an attestation and opens a dispute game; the challenger can fetch a ZK proof from its own prover. <mark>Two backends, two boxes.</mark></p>`,
    flow: [
      ['E', 'O', 'output at block', { l2: 42417000 }],
      ['O', 'T', 'TEE sign', { root: '0xout…' }],
      ['T', 'O', 'attestation', { valid: true }],
      ['O', 'L', 'createWithInitData', { root: '0xout…' }],
      ['L', 'H', 'game', { status: 'IN_PROGRESS' }],
      ['H', 'Z', 'prove if needed', { kind: 'InvalidTeeProposal' }],
    ],
  },
  {
    id: 'all',
    title: 'The whole system',
    reveal: [],
    lede: `Everything at once — pick a flow in the bottom left.`,
    story: `<p>Choose a flow in the bottom left. The Sequencer plate wraps RPC — a sequencer is an RPC node plus tx ingress, builder, and conductor. Ethereum sits at the edge. <mark>Network overview</mark> backs out to the fleet.</p>`,
    flow: null,
  },
];

export const HOW_HTML = `<div class="eyebrow">base · node stack</div><h1 class="t">How it's built</h1><div class="sub">a network of roles, one repo, two ways to package a node</div>
<h3 class="sec">What this repo is</h3>
<p>The Base rollup implementation: execution (Reth), consensus (derive + sequencer actors), Flashblocks builder, batcher, and the proving/challenger path. The atlas opens on the <b>network overview</b> — five roles plus Apps and L1 — then walks the e2e map. Sequencer is a plate around RPC plus tx ingress, builder, and conductor. Ethereum sits at the edge. Specs live at <code>https://specs.base.org</code>.</p>
<h3 class="sec">Two node shapes</h3>
<p><b>Operators today:</b> <code>docker compose up</code> runs split EL (<code>bin/node</code>) and CL (<code>bin/consensus</code>) as in the old <code>base/node</code> image.</p>
<p><b>Unified:</b> <code>base rpc</code> embeds EL+CL; <code>base sequencer</code> embeds EL + Flashblocks builder + CL. Engine API is auth IPC inside the process.</p>
<h3 class="sec">Filesystem</h3>
<pre>bin/base, node, consensus, builder, batcher, proposer, challenger, …
crates/{consensus,execution,builder,batcher,proof,common,infra,utilities}
atlas/data.mjs   ← edit this
CONTEXT.md       ← glossary</pre>
<h3 class="sec">Not on this map</h3>
<p><code>basectl</code> (operator TUI/CLI), <code>base-telemetry</code> (P2P reachability), snapshotter, load-tester, sidecrush, shadow-metrics, system tests. They operate the map; they are not the map.</p>`;
