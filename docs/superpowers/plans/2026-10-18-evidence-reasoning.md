# Evidence reasoning implementation plan

**Goal:** Give the free researcher a real policy judgement, retain a separate deterministic review guard, and publish complete judging materials.

**Architecture:** Keep scoped graph reads and three existing model stages. Give Atlas raw evidence and typed case fields without precomputed answers or literal outcome constraints. Sage compares Atlas's persisted assessment with verified checks, records corrections, and Echo uses the reviewed handoff. Preserve graph dependency and revision safeguards.

**Tech Stack:** Existing Node 24, TypeScript, AI SDK, Ollama and FalkorDB.

**Spec:** The participant's approved improvement plan and free-only instruction; October 18 strict review identifies answer-fed inference and incomplete public materials as the remaining actionable gaps.

## Global constraints

- No paid inference, Composio, secrets in public files, or invented participant contributions.
- Server-controlled evidence scope remains explicit; do not claim autonomous tool selection.
- Use the existing app, keep history and reject stale or invalid completed runs atomically.

## Review focus

- Research can disagree with policy: preserve it, then visibly correct it in review.
- Missing facts mean confirmation, including future additions to watched collections.
- Customer text cannot add topics or replace typed fields.
- No expected research answer may leak through prompts or JSON schema.
- Model prose may contradict structured conclusions: disclose this limitation and retain unsent drafts.

## Tasks

- [x] Add local HTTP contract checks proving raw evidence, multiple allowed research outcomes, corrections, selected-topic scope and exclusion of unverified prose. Observe failures before implementation.
- [x] Modify src/team.ts; preserve reviewed-stage guards. Typecheck and the full local suite passed. A clean GitHub run passed all 56 tests and 18 fixtures with real FalkorDB.
- [x] Record real local inference with both tested local models using the local adapter. Retain prior Cloud inference proof separately; restoring the old Cloud endpoint awaits account sign-in.
- [x] Publish missing source files, demo video and updated truthful documentation.
- [x] Verify all 55 anonymous public source files match local Git blob hashes, with no missing or extra files. Build the 55-file source archive with no credentials, local state or dependencies included.

Execution: continue in this session under the participant's request to implement the improvement plan. No automatic local commits or new services.
