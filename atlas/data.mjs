// Single source of truth for the Base node atlas.
// Build: node atlas/build.mjs  → writes SYSTEM.md and atlas.html

export const META = {
  title: 'Base',
  artifactUrl: '',
  sourcePath: 'atlas/data.mjs',
  buildCmd: 'node atlas/build.mjs',
  stats: [
    { k: 'System', v: 'base · node stack' },
    { k: 'Roles', v: 'rpc · sequencer · batcher · prover' },
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
    'The consensus actor graph (`base-consensus-node`), Flashblocks builder and pending-state RPC, Base txpool/forwarding/ingress, the batcher driver, TEE proposer, ZK/TEE prover service, challenger, `basectl`, and the unified `base` binary.',
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

export const NODES = [
  {
    id: 'U', code: 'U', name: 'Apps and wallets', short: 'APPS', group: 'surf',
    gx: 0, gy: 10, w: 2, d: 2, h: 44, kind: 'screen',
    one: 'Wallets, dapps, and scripts that send transactions and read chain state.',
    what: 'Anything that speaks Ethereum JSON-RPC: a browser wallet, a bot, an indexer, or `cast`. It does not run the rollup. It posts a signed transaction or asks for a block, a receipt, or a `pending` view that may already include Flashblocks.',
    how: 'Talks to a public or self-hosted endpoint (`https://mainnet.base.org` or a local `base rpc` / docker-compose EL on <code>:8545</code>). This repo does not ship a wallet or explorer.',
    steps: [
      ['Sign', 'User or app signs an L2 transaction.'],
      ['Submit', 'eth_sendRawTransaction (or a bundle) to an RPC URL.'],
      ['Watch', 'Poll receipts or subscribe; pending may come from Flashblocks.'],
    ],
    cond: [
      { q: 'Do we map wallets/explorers as part of this atlas?', r: 'No — they are clients of this repo, not in-tree (2026-08-28).' },
    ],
  },
  {
    id: 'R', code: 'R', name: 'JSON-RPC node', short: 'RPC NODE', group: 'surf',
    gx: 3.5, gy: 8, w: 2.4, d: 2, h: 48, kind: 'screen',
    one: 'The public face of a Base node: Ethereum JSON-RPC plus rollup and Flashblocks methods.',
    what: 'The process an operator runs to serve the chain. In docker-compose this is two containers (execution + consensus). `base rpc` embeds both in one process and hides sequencer flags. Replica nodes forward user transactions toward the sequencer and subscribe to Flashblocks so `pending` is live.',
    how: '<code>bin/base</code> (`base rpc`) or <code>docker-compose.yml</code> (`execution-entrypoint` + `consensus-entrypoint`). RPC crates: <code>base-execution-rpc</code>, <code>base-flashblocks</code>, <code>base-consensus-rpc</code> (`optimism_syncStatus`, admin, P2P). Ports 8545/8546 typical.',
    steps: [
      ['Admit', 'Accept eth_*, debug_*, optimism_*, flashblock subscriptions.'],
      ['Read', 'Serve canonical state from the execution DB; pending from Flashblocks.'],
      ['Forward', 'If configured, send raw txs toward the sequencer / builder ingress.'],
    ],
    cond: [
      'Should the published operator node stay as split EL+CL containers, or is `base rpc` the long-term public shape?',
    ],
  },
  {
    id: 'E', code: 'E', name: 'Execution engine', short: 'EXECUTION', group: 'loop',
    gx: 7.2, gy: 7.6, w: 3, d: 2.2, h: 40, kind: 'slab',
    one: 'The Reth-based EVM that executes transactions and answers the Engine API.',
    what: 'This is the computer that actually runs the block. Consensus never executes bytecode itself — it asks this engine to build or import a payload, then treats the resulting block hash as truth. Same engine on the sequencer and on every replica.',
    how: '<code>bin/node</code> / <code>base-node-core</code> + <code>base-execution-evm</code> + Base precompiles in <code>base-common-precompiles</code>. Engine types and API builder in <code>base-node-core</code>. Auth Engine API over IPC when embedded, HTTP+JWT when split. Fatal precompile/EVM errors here can halt block production — see <code>docs/guides/BLOCK_PRODUCTION_REVIEW.md</code>.',
    steps: [
      ['forkchoiceUpdated', 'Consensus sets head and, on the sequencer, starts a payload build.'],
      ['Execute', 'Apply deposits, then txpool or derived txs, against parent state.'],
      ['getPayload / newPayload', 'Return a sealed payload, or import one from gossip/derivation.'],
    ],
    cond: [
      { q: 'Is this still op-geth?', r: 'No. This tree is Reth-based Base execution (2026-08-28).' },
    ],
  },
  {
    id: 'D', code: 'D', name: 'Chain store', short: 'CHAIN DB', group: 'mem',
    gx: 7.2, gy: 11.4, w: 3, d: 2, h: 26, kind: 'store',
    one: 'The on-disk ledger: headers, bodies, receipts, and state the execution engine reads and writes.',
    what: 'Without this disk, the node is an empty process. Snapshots and `reth-data/` are how operators skip years of sync. It is local to one node; it is not shared consensus.',
    how: 'Reth database under <code>reth-data/</code> (docker-compose default). Snapshots via <code>bin/snapshotter</code>. Safe-head history is a different file — see SafeDB. Gitignores <code>/reth-data/</code>.',
    steps: [
      ['Open', 'EL starts and opens the datadir.'],
      ['Apply', 'Each imported or built block writes state, receipts, and indexes.'],
      ['Serve', 'RPC and proofs read historical blocks and storage proofs from here.'],
    ],
    cond: [],
  },
  {
    id: 'P', code: 'P', name: 'Transaction pool', short: 'TXPOOL', group: 'loop',
    gx: 3.4, gy: 11.2, w: 2.4, d: 2, h: 28, kind: 'store',
    one: 'The mempool: valid not-yet-included transactions, ordered for the builder.',
    what: 'When you send a transaction, it sits here until a block (or Flashblock) takes it. Base adds L1-data-fee checks and its own ordering. Replica nodes can drain this pool toward builder URLs.',
    how: '<code>base-execution-txpool</code>: <code>BaseTransactionValidator</code>, <code>BaseOrdering</code>. Forwarding: <code>base-tx-forwarding</code> (`base_insertValidatedTransaction`). Inspect/clear via <code>basectl txpool</code>.',
    steps: [
      ['Validate', 'Signature, nonce, balance, L1 data fee, Base rules.'],
      ['Park', 'Pending vs queued by nonce.'],
      ['Select', 'Builder pulls best txs under gas/DA/metering limits.'],
    ],
    cond: [
      { q: 'Do replicas include txs locally?', r: 'No. Replicas forward; the sequencer/builder selects (2026-08-28).' },
    ],
  },
  {
    id: 'I', code: 'I', name: 'Builder ingress', short: 'INGRESS', group: 'loop',
    gx: 3.4, gy: 5.2, w: 2.4, d: 2, h: 40, kind: 'box',
    one: 'The builder-facing JSON-RPC that accepts validated transactions and bundles.',
    what: 'The public RPC is not where searchers and mempool nodes dump inventory into the sequencer. Ingress is that door: validate a bundle, meter it, emit an audit event, hand it to the builder connection.',
    how: '<code>bin/ingress-rpc</code> / <code>ingress-rpc-lib</code>: <code>IngressService</code>, <code>validate_bundle</code>, <code>BuilderConnector</code>, health + metrics. Wire format for pool forwarding is <code>ValidatedTransaction</code> in <code>base-execution-txpool</code>.',
    steps: [
      ['Accept', 'JSON-RPC tx or bundle.'],
      ['Meter', 'Ask the builder connector whether it fits current limits.'],
      ['Emit', 'Audit event; builder sees the inventory.'],
    ],
    cond: [],
  },
  {
    id: 'B', code: 'B', name: 'Flashblocks builder', short: 'BUILDER', group: 'loop',
    gx: 8, gy: 4.2, w: 3, d: 2.2, h: 42, kind: 'job',
    one: 'Builds the next L2 block in sub-second chunks and publishes each chunk before the block is sealed.',
    what: 'Instead of waiting two seconds to learn what is in the block, the network sees Flashblocks as they fill. The same job later finalizes one canonical payload for the Engine API. Empty or underfilled chunks are a production-halt risk if metering or size limits starve the loop.',
    how: '<code>base-builder-core</code> flashblocks loop; <code>base-builder-publish</code> WebSocket broadcast; metering in <code>base-builder-metering</code>. Embedded by <code>base sequencer</code> (`--flashblocks.port`) or standalone <code>bin/builder</code>. Payload type: <code>FlashblocksPayloadV1</code> in <code>base-common-flashblocks</code>.',
    steps: [
      ['Start job', 'Engine forkchoiceUpdated returns a PayloadId for this block.'],
      ['Chunk', 'build_next_flashblock: pick txs, execute, publish delta.'],
      ['Finalize', 'Seal the full payload for getPayload / sequencer seal.'],
    ],
    cond: [
      { q: 'Can Flashblock publish fail without a final block?', r: 'Treated as critical: finalize must still produce a valid payload (BLOCK_PRODUCTION_REVIEW, 2026-08-28).' },
    ],
  },
  {
    id: 'F', code: 'F', name: 'Flashblocks stream', short: 'FLASH WS', group: 'surf',
    gx: 11.6, gy: 6.4, w: 2.4, d: 2, h: 40, kind: 'screen',
    one: 'The WebSocket that carries Flashblock payloads from the builder to RPC nodes and tools.',
    what: 'RPC nodes subscribe here so `eth_getBlockByNumber("pending")` and flashblock subscriptions stay ahead of the sealed block. A proxy sits in front so the sequencer is not crushed by every replica opening a socket.',
    how: 'Publisher: <code>base-builder-publish</code>. Subscriber: <code>FlashblocksSubscriber</code> in <code>base-flashblocks</code>. Fan-out: <code>bin/websocket-proxy</code> (upstream rollup-boost / builder WS; optional Brotli). <code>basectl flashblocks</code> prints JSONL; <code>eth_subscribe("newFlashblocks")</code> on the node.',
    steps: [
      ['Publish', 'Builder broadcasts FlashblocksPayloadV1 (index 0 includes base).'],
      ['Proxy', 'websocket-proxy fans out to replicas.'],
      ['Reconcile', 'FlashblocksState + CanonicalBlockReconciler merge pending with canonical.'],
    ],
    cond: [
      { q: 'Is websocket-proxy production-hardened?', r: 'README still calls it alpha: one-way, no payload inspection (2026-08-28).' },
    ],
  },
  {
    id: 'S', code: 'S', name: 'Sequencer', short: 'SEQUENCER', group: 'loop',
    gx: 12.2, gy: 1.6, w: 3, d: 2.8, h: 64, kind: 'tall',
    one: 'The brain of live Base: a wall-clock loop that starts, seals, and inserts each L2 block.',
    what: 'On a sequencing node this actor wakes every block time, picks the L1 origin, asks the engine to build, waits for the payload, then (if configured) asks the conductor to commit, gossips the block, and inserts it as the new unsafe head. Validators do not run this loop — they follow gossip and L1 derivation.',
    how: '<code>SequencerActor</code> in <code>base-consensus-node</code>. Build via <code>PayloadBuilder</code> + <code>L1OriginSelector</code> + <code>StatefulAttributesBuilder</code>. Seal pipeline: conductor commit → gossip → <code>insert_unsafe_payload</code>. Admin: <code>admin_startSequencer</code> / <code>admin_stopSequencer</code> (`basectl sequencer`). Requires a sequencer key. <code>--sequencer.recover</code> forces empty blocks.',
    steps: [
      ['Tick', 'Wall-clock block_time; parent must be the inserted unsafe head.'],
      ['Attributes', 'L1 origin, deposits, pool-on/off, start_build_block → PayloadId.'],
      ['Seal', 'getPayload, then commit / gossip / insert.'],
    ],
    cond: [
      { q: 'Who may sequence?', r: 'The configured sequencer key / signer endpoint; conductor leadership gates start when enabled (2026-08-28).' },
    ],
  },
  {
    id: 'W', code: 'W', name: 'Conductor', short: 'CONDUCTOR', group: 'loop',
    gx: 16.4, gy: 1.2, w: 2.2, d: 2, h: 46, kind: 'gate',
    one: 'The HA gate: only the raft leader may sequence and commit unsafe payloads.',
    what: 'If two sequencers built at once, the chain would split. Conductor is the lock. This repo owns the client and the seal-time `commit_unsafe_payload` call, plus `basectl conductor` for pause/transfer. The raft process itself is the external conductor RPC (`--conductor.rpc`).',
    how: '<code>ConductorClient</code> in <code>base-consensus-node</code> (`conductor_leader`, commit HTTP or binary). Optional <code>--conductor.binary-commit</code>. Operator UX: <code>basectl conductor status|transfer-leader|pause</code>.',
    steps: [
      ['Leader?', 'admin_startSequencer checks conductor_leader.'],
      ['Commit', 'After seal, commit_unsafe_payload before gossip.'],
      ['Failover', 'Transfer raft leader; the new leader starts sequencing.'],
    ],
    cond: [
      { q: 'Is the raft conductor implemented in this repo?', r: 'No — in-repo client + basectl against an external conductor RPC (2026-08-28).' },
    ],
  },
  {
    id: 'N', code: 'N', name: 'P2P gossip', short: 'GOSSIP', group: 'loop',
    gx: 12.4, gy: -1.4, w: 2.4, d: 2, h: 40, kind: 'box',
    one: 'How unsafe L2 blocks and peers find each other without going through L1.',
    what: 'There are two meshes. Execution uses DevP2P (tx gossip, EL peers on 30303). Consensus uses libp2p gossipsub + discv5 (9222) to flood signed unsafe payloads. Replicas insert gossiped payloads as the unsafe head, then wait for L1 derivation to make them safe.',
    how: '<code>base-consensus-gossip</code>, <code>base-consensus-disc</code>, <code>NetworkActor</code>. Signer address updates come from L1 SystemConfig. Guide: <code>docs/guides/P2P.md</code>. Reachability: <code>base-telemetry</code> + <code>basectl p2p reachability</code>.',
    steps: [
      ['Discover', 'discv5 ENR / bootnodes.'],
      ['Sign & publish', 'Sequencer publishes NetworkPayloadEnvelope on the timestamp-selected topic.'],
      ['Import', 'Replica engine newPayload + forkchoiceUpdated → new unsafe head.'],
    ],
    cond: [],
  },
  {
    id: 'L', code: 'L', name: 'Ethereum L1', short: 'ETHEREUM', group: 'da',
    gx: 17.2, gy: 6.8, w: 3, d: 2.2, h: 38, kind: 'slab',
    one: 'The existing chain Base posts data to and derives from — not implemented in this repo.',
    what: 'L1 is the bulletin board and the court. Batches land as blobs or calldata on the inbox. SystemConfig logs can rotate the unsafe-block signer. Finalized L1 blocks finalize derived L2. Dispute games live in L1 contracts.',
    how: 'Operators pass <code>--l1-eth-rpc</code> and <code>--l1-beacon</code> (blob sidecars). L1 watcher in <code>base-consensus-node</code> polls latest (~4s) and finalized, applies <code>verifier_l1_confs</code>, fetches SystemConfig logs. This repo does not host those L1 contracts.',
    steps: [
      ['Watch', 'Poll latest/finalized; confirm-delay the derivation head.'],
      ['Inbox', 'Accept batcher txs at batch_inbox_address from the batcher key.'],
      ['Games', 'DisputeGameFactory stores proposals and challenges.'],
    ],
    cond: [
      { q: 'Where do the L1 contracts live?', r: 'Outside this repo; addresses come from rollup config / base-common-chains (2026-08-28).' },
    ],
  },
  {
    id: 'A', code: 'A', name: 'Batcher', short: 'BATCHER', group: 'da',
    gx: 13.6, gy: 9.2, w: 2.4, d: 2, h: 42, kind: 'job',
    one: 'The scheduled writer that compresses unsafe L2 blocks and posts them to Ethereum.',
    what: 'Until the batcher lands, a block is only gossip. After it lands, anyone can re-derive the same chain from L1. If L1 DA backs up, the batcher throttles the sequencer (`miner_setMaxDASize`) so new blocks stay small enough to catch up.',
    how: '<code>bin/batcher</code> → <code>base-batcher-service</code> + <code>BatchDriver</code> in <code>base-batcher-core</code>. Frames: <code>base-batcher-encoder</code> / <code>base-blobs</code>. Source: <code>base-batcher-source</code>. Inbox from <code>optimism_rollupConfig</code> unless shadow-mode override. Parity check via <code>--parity-validator-l2-rpc-url</code>.',
    steps: [
      ['Read', 'Pull unsafe L2 blocks from the sequencer RPC.'],
      ['Frame', 'Compress into channel frames; pick blob vs calldata.'],
      ['Submit', 'TxManager posts to inbox; confirm; throttle builder if backlog grows.'],
    ],
    cond: [],
  },
  {
    id: 'V', code: 'V', name: 'Derivation', short: 'DERIVE', group: 'da',
    gx: 13.6, gy: 12.4, w: 2.4, d: 2, h: 40, kind: 'box',
    one: 'The pipeline that turns L1 batches and deposits back into L2 payload attributes.',
    what: 'This is how a replica knows the sequencer was honest: it reads the same L1 data and produces the same blocks. The engine then consolidates those attributes as the safe head. Follow nodes skip this and just copy a remote L2.',
    how: '<code>base-consensus-derive</code> (`no_std` pipeline, also used in fault-proof VMs): <code>EthereumDataSource</code>, <code>StatefulAttributesBuilder</code>, <code>OnlinePipeline</code>. Actor: <code>DerivationActor</code> state machine (EL sync → deriving → await safe head). Delegation mode polls a remote sync-status instead.',
    steps: [
      ['Step', 'pipeline.step() → PreparedAttributes or NotEnoughData.'],
      ['Consolidate', 'Engine forkchoiceUpdated with derived attributes.'],
      ['Finalize', 'When L1 finalizes the inclusion block, mark the derived L2 finalized.'],
    ],
    cond: [],
  },
  {
    id: 'K', code: 'K', name: 'Safe head DB', short: 'SAFEDB', group: 'mem',
    gx: 10.2, gy: 13.4, w: 2.2, d: 2, h: 26, kind: 'store',
    one: 'A small local index: which L2 safe head was derived from which L1 block.',
    what: 'RPC asks “what was safe when L1 was N?” This file answers. It is not the chain; it is a bookmark. Two processes must not open the same file.',
    how: '<code>base-consensus-safedb</code>, redb-backed <code>SafeDB</code>, or <code>DisabledSafeDB</code>. Written by the derivation actor; read for <code>optimism_safeHeadAtL1</code>. Disabled in derivation-delegation mode.',
    steps: [
      ['Record', 'On safe-head confirm, store (l1_block → l2_safe_head).'],
      ['Query', 'RPC optimism_safeHeadAtL1.'],
      ['Rewind', 'Reorg/reset clears or rewrites entries.'],
    ],
    cond: [
      { q: 'Can two nodes share one SafeDB file?', r: 'No — not multi-process safe (safedb README, 2026-08-28).' },
    ],
  },
  {
    id: 'O', code: 'O', name: 'Output proposer', short: 'PROPOSER', group: 'honest',
    gx: 20.4, gy: 5.4, w: 2.4, d: 2, h: 42, kind: 'job',
    one: 'Periodically claims “L2 at this block has this output root,” backed by a TEE signature.',
    what: 'Permissionless observers need a posted root to challenge. The proposer reads L2/L1, asks a TEE for a signed proposal, checks the output root locally, then calls `DisputeGameFactory.createWithInitData`. Parent game is always re-read from chain so two proposers cannot livelock.',
    how: '<code>bin/proposer</code> / <code>base-proposer</code>. TEE path: nitro host/enclave crates under <code>crates/proof/tee/</code>. Game type + factory from chain config. No cached parent — <code>recover_latest_state()</code> walks the factory (default 5000 entries) or falls back to <code>AnchorStateRegistry</code>.',
    steps: [
      ['Recover parent', 'Scan factory for latest matching game_type.'],
      ['Attest', 'TEE-signed proposal; verify output root locally.'],
      ['Create game', 'createWithInitData on L1.'],
    ],
    cond: [],
  },
  {
    id: 'H', code: 'H', name: 'Challenger', short: 'CHALLENGER', group: 'honest',
    gx: 20.4, gy: 9.6, w: 2.4, d: 2, h: 46, kind: 'gate',
    one: 'Watches in-progress dispute games and posts a challenge when a claim does not match L2.',
    what: 'If a proposer (or a ZK claim) is wrong, this process proves it. It recomputes output roots from L2 headers and message-passer proofs, asks the prover service for a proof when needed, and calls `nullify()` / `challenge()` on L1. It also walks bond credits back out.',
    how: '<code>bin/challenger</code> / <code>base-challenger</code>: scanner → validator → pending proof sessions → submitter → bond claim. Categories: InvalidTeeProposal, FraudulentZkChallenge, InvalidZkProposal.',
    steps: [
      ['Scan', 'IN_PROGRESS games from DisputeGameFactory.'],
      ['Validate', 'Recompute OutputRoot vs onchain claim.'],
      ['Dispute', 'Request proof if needed; nullify/challenge; reclaim bonds.'],
    ],
    cond: [],
  },
  {
    id: 'Z', code: 'Z', name: 'Prover service', short: 'PROVER', group: 'honest',
    gx: 23.4, gy: 7.4, w: 2.4, d: 2, h: 42, kind: 'cards',
    one: 'The job queue that turns a block range into a TEE attestation or a ZK proof.',
    what: 'Challengers and operators do not run SP1 themselves on the hot path. They submit a session; a worker host claims it. ZK workers talk to Succinct network/cluster/dry-run; TEE workers talk to the nitro enclave. `basectl proofs` is the operator door.',
    how: '<code>base-prover-service</code> JSON-RPC + postgres (`.zk-prover/<network>/`). Workers: <code>bin/prover/zk-host</code>, <code>bin/prover/nitro-host</code>. Operator: <code>basectl proofs propose|finalize|submit</code>. Guide: <code>docs/guides/STANDALONE_PROVING.md</code>.',
    steps: [
      ['Queue', 'Requester inserts proof_requests row.'],
      ['Prove', 'Worker claims job; ZK or TEE backend.'],
      ['Return', 'Poll status; submit bytes on L1 if that is the workflow.'],
    ],
    cond: [
      { q: 'Is ZK required to sequence?', r: 'No. Sequencing is Engine+gossip+DA. ZK/TEE proving is the dispute/finality path (2026-08-28).' },
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
      ['B', 'S', 'getPayload', { payloadId: '0x7a…', blockNumber: 42417649 }, 'xy'],
      ['S', 'W', 'commit_unsafe_payload', { blockHash: '0xseal…', number: 42417649 }, 'xy'],
      ['W', 'S', 'committed', { leader: true }, 'yx'],
      ['S', 'N', 'gossip unsafe', { topic: 'blocks/v1', signer: '0xseq…' }, 'yx'],
      ['S', 'E', 'insert unsafe', { method: 'engine_newPayload', hash: '0xseal…' }, 'xy'],
    ],
  },
  {
    id: 'da',
    name: 'Batch to L1 and derive',
    hops: [
      ['S', 'A', 'unsafe L2 blocks', { first: 42417600, last: 42417649 }, 'xy'],
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
      ['O', 'Z', 'TEE proposal request', { gameType: 'tee', parent: '0xgame…' }, 'xy'],
      ['Z', 'O', 'attestation', { outputRoot: '0xout…', valid: true }, 'yx'],
      ['O', 'L', 'createWithInitData', { factory: 'DisputeGameFactory', root: '0xout…' }, 'xy'],
      ['L', 'H', 'IN_PROGRESS game', { game: '0xproxy…', claim: '0xout…' }, 'yx'],
      ['H', 'E', 'recompute root', { l2Block: 42417000 }, 'yx'],
      ['H', 'Z', 'challenge proof', { kind: 'InvalidTeeProposal' }, 'xy'],
      ['Z', 'H', 'proof bytes', { backend: 'network', status: 'succeeded' }, 'yx'],
      ['H', 'L', 'challenge()', { game: '0xproxy…' }, 'xy'],
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
    story: `<p>The public RPC validates and parks the tx. Replica nodes do not sequence — they <mark>forward validated inventory</mark> to ingress, which meters bundles into the builder.</p>`,
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
    story: `<p>The builder executes the best pool transactions in sub-second passes and publishes <code>FlashblocksPayloadV1</code> on a WebSocket. Replicas reconcile those deltas into <mark><code>pending</code></mark> so wallets do not wait for the 2s seal.</p>`,
    flow: [
      ['P', 'I', 'inventory', { hash: '0xabc…' }],
      ['I', 'B', 'select', { hash: '0xabc…' }],
      ['B', 'F', 'flashblock', { payload_id: '0x7a…', index: 3 }],
      ['F', 'R', 'pending', { includes: '0xabc…' }],
      ['R', 'U', 'eth_getTransactionReceipt', { status: 'pending-in-flashblock' }],
    ],
  },
  {
    id: 'seq',
    title: 'The sequencer and the lock',
    reveal: ['S', 'W'],
    lede: `Once a second-or-two clock fires, one leader seals the payload and commits it.`,
    story: `<p>The sequencer actor is the production loop: L1 origin, Engine build, seal. If a conductor is configured, <mark>only the raft leader may start or commit</mark>. Everyone else is a follower.</p>`,
    flow: [
      ['S', 'E', 'forkchoiceUpdated + attributes', { timestamp: 1700000000, noTxPool: false }],
      ['E', 'B', 'payload job', { payloadId: '0x7a…' }],
      ['B', 'S', 'getPayload', { blockHash: '0xseal…' }],
      ['S', 'W', 'commit_unsafe_payload', { blockHash: '0xseal…' }],
      ['W', 'S', 'ok', { leader: true }],
      ['S', 'E', 'insert unsafe', { hash: '0xseal…' }],
    ],
  },
  {
    id: 'net',
    title: 'Telling the rest of the network',
    reveal: ['N'],
    lede: `The sealed unsafe block is gossiped so replicas do not wait for Ethereum.`,
    story: `<p>Consensus P2P (libp2p + discv5) floods a signed payload. Replicas <code>newPayload</code> it and move their unsafe head. <mark>Safe still requires L1.</mark> Execution DevP2P is a second mesh for txs and EL peers.</p>`,
    flow: [
      ['S', 'N', 'publish unsafe', { hash: '0xseal…' }],
      ['N', 'E', 'engine_newPayload', { hash: '0xseal…' }],
      ['E', 'R', 'unsafe head', { number: 42417649 }],
    ],
  },
  {
    id: 'batch',
    title: 'Posting the history to Ethereum',
    reveal: ['L', 'A'],
    lede: `Gossip is fast. Ethereum is the copy of record.`,
    story: `<p>The batcher reads unsafe L2, frames it, and posts blobs (or calldata) to the inbox. If it falls behind, it <mark>throttles what the builder may include</mark> so DA can catch up. L1 contracts are not in this repo.</p>`,
    flow: [
      ['S', 'A', 'unsafe range', { first: 42417600, last: 42417649 }],
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
    reveal: ['O', 'H', 'Z'],
    lede: `L1 also holds court: a TEE-backed proposer posts roots; a challenger and prover service dispute the bad ones.`,
    story: `<p>Sequencing does not wait for a SNARK. Separately, the proposer opens a dispute game; the challenger recomputes the output root and can fetch a ZK or TEE proof from the prover service. <mark>That is the honesty path, not the 2s block loop.</mark></p>`,
    flow: [
      ['E', 'O', 'output at block', { l2: 42417000 }],
      ['O', 'Z', 'TEE sign', { root: '0xout…' }],
      ['Z', 'O', 'attestation', { valid: true }],
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
    story: `<p>Choose <mark>One user transaction</mark>, <mark>Batch to L1 and derive</mark>, or <mark>Propose and challenge</mark>. Hover a structure, click to pin, → goes inside. The Open questions tab is indexed by ID. Operator tooling (<code>basectl</code>, telemetry) sits beside this map, not on it.</p>`,
    flow: null,
  },
];

export const HOW_HTML = `<div class="eyebrow">base · node stack</div><h1 class="t">How it's built</h1><div class="sub">one repo, several roles, two ways to package a node</div>
<h3 class="sec">What this repo is</h3>
<p>The Base rollup implementation: execution (Reth), consensus (derive + sequencer actors), Flashblocks builder, batcher, and the proving/challenger path. Specs live at <code>https://specs.base.org</code>. Wallets, the explorer, and L1 contract implementations are not here.</p>
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
