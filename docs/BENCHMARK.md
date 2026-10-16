# Dependency invalidation comparison

Measured October 16, 2026 against FalkorDB Cloud: **18/18 fixtures passed**, 161 current-decision classifications, 44 requiring invalidation. Total run time was 11,756 ms, including connection and fixture setup.

| Method | Found affected | Missed affected | Unnecessary refreshes |
|---|---:|---:|---:|
| FalkorDB traversal | 44 | 0 | 0 |
| Full traversal in memory | 44 | 0 | 0 |
| Direct dependencies only | 14 | 30 | 0 |
| Refresh every current decision | 44 | 0 | 80 |

The original twelve cases cover three independent chains at depths 1, 3 and 6, policy replacement, new destinations, contact updates and rejected customer claims. Six additional cases cover branching and shared consumers, unrelated changes, an empty shipping collection, blocked updates and an already-stale intermediary with current consumers. Expected memberships are explicitly authored independently of either traversal. Previews must preserve the fixture revision.

All baselines use the same authority gate. The in-memory traversal is a correctness parity baseline, not a rival product. Both complete traversals are expected to succeed. This does not show that a graph database is the only way to implement dependencies.

queryMs measures the full persisted preview. referenceMs measures just in-memory traversal over an already-loaded snapshot. **These timings are not a fair speed comparison.** Total time includes connection/setup and varies with network and machine.

These small synthetic fixtures do not measure model quality, real customer outcomes, production throughput, concurrent writers or superiority over Graphiti/Mem0. Competing preview approvals are covered separately by functional tests. Current decisions are the scored universe; stale intermediaries remain traversable.

Run pnpm benchmark or Agent mission → Run comparison. It creates isolated synthetic workspaces and records its actual backend. No silent fallback. Raw results are in benchmark-results.json. Test fixtures are retained by this prototype; production needs a retention policy.
