# Attribution and originality

Original application: Memory Airlock. Domain rules, graph snapshot adapter, change-preview workflow, evidence links, agent-refresh simulation, UI and tests were authored for this project with AI assistance. No completed third-party hackathon submission was copied.

Dependencies and references:

- eve, Apache-2.0: project scaffold and optional agent runtime. https://github.com/vercel/eve
- Vercel AI SDK, Apache-2.0: three-stage model tool loops and the optional read-only reviewer. https://github.com/vercel/ai
- FalkorDB TypeScript client, MIT: database connection/query client. https://github.com/FalkorDB/falkordb-ts
- Zod, MIT: runtime input validation. https://github.com/colinhacks/zod
- Node.js: HTTP, persistence and test runner.
- Lucide, ISC: interface icons. License retained in `public/vendor/LUCIDE-LICENSE.txt`.
- Manrope and IBM Plex Mono, SIL Open Font License 1.1: locally hosted interface fonts. License notices retained in `public/vendor/`.

Graphiti and Mem0 were researched as possible foundations. The prototype does **not** embed either library or copy their agent applications. It uses a small explicit graph model so replacement/addition behavior and source authority are inspectable and testable.

Problem evidence (cite as user reports, not universal properties or independently reproduced results):

- Graphiti issue 1728, incorrect invalidation reported with a FalkorDB backend: https://github.com/getzep/graphiti/issues/1728
- Graphiti issue 1645, stale facts and retrieval configuration: https://github.com/getzep/graphiti/issues/1645

Preserve dependency license notices when distributing. See pnpm-lock.yaml for resolved versions. The proposal is an independently implemented application of known graph/provenance ideas; no global novelty or first-in-the-world claim is made.

- Ollama, MIT: local model runtime; https://github.com/ollama/ollama
- Qwen3:0.6b, Apache-2.0: locally downloaded model weights; https://ollama.com/library/qwen3:0.6b (weights are not bundled in this repository).
- AI SDK OpenAI-compatible provider, Apache-2.0: loopback Ollama adapter, part of https://github.com/vercel/ai
