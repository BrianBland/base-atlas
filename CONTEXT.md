# Base — glossary

Domain nouns. One line each. Not a design doc.

- **Network overview** — Home view of the fleet: Sequencer, RPC, Batcher, Proposer, Challenger, plus Apps and Ethereum L1 as surroundings.
- **Sequencer** — Role, not a box: an RPC node plus tx ingress, Flashblocks builder, and conductor (`base sequencer`). The e2e plate wraps RPC. Leader election is a conductor noun, not its own map.
- **RPC** — Anyone-can-run validator node. Serves JSON-RPC, holds the txpool, hears unsafe over gossip, derives safe from L1, forwards txs toward the sequencer when it cannot insert them.
- **Batcher** — Reads unsafe L2 from the sequencer and posts frames to the L1 inbox. Not a p2p node.
- **Proposer** — Reads a validator’s L2 state, asks the TEE prover for an attestation, posts a dispute game on L1.
- **Challenger** — Watches L1 games, recomputes against a validator, fetches a ZK proof, publishes the challenge.
- **App / wallet** — A JSON-RPC client of a Base node. Not in this repository.
- **Execution engine** — Reth-based EL that runs the EVM and the Engine API. Lives on the RPC plate; the builder inserts sealed payloads into it.
- **Chain store** — On-disk Reth datadir (`reth-data/`). Local, not consensus.
- **Txpool** — The one mempool on this map: lives on the RPC plate. Replicas forward from it toward tx ingress.
- **Tx ingress** — Sequencer-side JSON-RPC for validated txs and bundles.
- **Builder** — The producer in the Sequencer role: Flashblocks on the WebSocket, then one sealed payload for conductor, engine, and gossip.
- **Flashblock** — One published delta (`FlashblocksPayloadV1`) of the block still being built.
- **Leader** — The sequencer replica whose conductor is raft leader. Only this one may build or commit.
- **Follower** — A sequencer replica that is not leader. Same binary; sequencer loop stays stopped.
- **Conductor** — Per-replica raft lock. Raft is conductor-to-conductor; each sequencer talks to its own conductor.
- **Gossip** — Consensus libp2p door for signed unsafe payloads toward RPC nodes. Separate from execution DevP2P.
- **Unsafe head** — Latest L2 block this node has, from sequencing or gossip, not yet L1-derived.
- **Safe head** — Latest L2 block derived from L1 batches/deposits.
- **Finalized head** — Safe L2 whose L1 inclusion block is finalized.
- **Derivation** — Pipeline from L1 data to L2 payload attributes (`base-consensus-derive`).
- **SafeDB** — Local redb index of safe head at each L1 block. Single-process.
- **Ethereum L1** — Data-availability and dispute-game host. Contracts not in this repo.
- **Output root** — Commitment to L2 state at a block, posted in a dispute game.
- **TEE prover** — Enclave worker that signs an output-root proposal. Lives with the Proposer.
- **ZK prover** — Job queue that turns a disputed range into a ZK proof. Lives with the Challenger.
- **Follow node** — Consensus variant that mirrors a remote L2 and does not derive. Not a first-class role.
- **basectl** — Operator console. Beside the system, not a protocol structure.
