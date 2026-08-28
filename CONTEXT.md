# Base — glossary

Domain nouns. One line each. Not a design doc.

- **App / wallet** — A JSON-RPC client of a Base node. Not in this repository.
- **RPC node** — Process(es) that serve `eth_*` / `optimism_*` and optional Flashblocks pending state. `base rpc` or docker-compose EL+CL.
- **Execution engine** — Reth-based EL that runs the EVM and the Engine API.
- **Chain store** — On-disk Reth datadir (`reth-data/`). Local, not consensus.
- **Txpool** — Valid not-yet-included transactions on one node.
- **Ingress** — Builder-facing JSON-RPC for validated txs and bundles.
- **Builder** — Flashblocks payload job: sub-second chunks, then one sealed payload.
- **Flashblock** — One published delta (`FlashblocksPayloadV1`) of the block still being built.
- **Sequencer** — Consensus actor that starts, seals, and inserts L2 blocks on a wall-clock.
- **Conductor** — External HA raft; in-repo client commits unsafe payloads and gates who may sequence.
- **Gossip** — Consensus libp2p flood of signed unsafe payloads; separate from execution DevP2P.
- **Unsafe head** — Latest L2 block this node has, from sequencing or gossip, not yet L1-derived.
- **Safe head** — Latest L2 block derived from L1 batches/deposits.
- **Finalized head** — Safe L2 whose L1 inclusion block is finalized.
- **Derivation** — Pipeline from L1 data to L2 payload attributes (`base-consensus-derive`).
- **SafeDB** — Local redb index of safe head at each L1 block. Single-process.
- **Batcher** — Posts framed L2 data to the L1 inbox (blobs or calldata) and throttles DA.
- **Ethereum L1** — Data-availability and dispute-game host. Contracts not in this repo.
- **Output root** — Commitment to L2 state at a block, posted in a dispute game.
- **Proposer** — TEE-backed job that creates dispute games for output roots.
- **Challenger** — Watches games and disputes claims that do not match L2.
- **Prover service** — Queue + workers for TEE attestations and ZK proofs.
- **Follow node** — Consensus variant that mirrors a remote L2 and does not derive.
- **basectl** — Operator console. Beside the system, not a protocol structure.
