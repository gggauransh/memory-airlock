# Verification

## October 18, 2026 — independent reasoning upgrade

- TypeScript and browser-script syntax passed. The complete local suite passed **53 tests, zero failures, three live database tests skipped** when run without Cloud configuration.
- A separate full run with the configured Cloud endpoint passed 53 tests and failed all three database cases with ENOTFOUND: persistence/workspace isolation, independent-case selective refresh/reload, and transitive handoff/scope traversal. The public FalkorDB website resolved normally while the configured instance hostname did not. Account sign-in/resume is needed to determine instance status. This is separate from the passing October 16 Cloud evidence below.
- The local SDK test first failed because research received precomputed answers. It now proves raw scoped evidence, no required research assessment or hidden check result, a schema that permits multiple topic-appropriate outcomes, visible correction of wrong research, and exclusion of unverified research prose from review context. Topic-scope and prose-contamination regressions were also observed failing before fixes.
- Real Qwen3:0.6b proof with the local adapter passed: independent cases, stale-draft rejection, selective refresh and retained runs. Raw evidence: local-proof-20261018.json. The researcher misclassified the 20-day case under the new 14-day policy; the recorded audit corrected it and the final draft said outside the window. Shipping research prose overstated missing evidence; the final draft correctly requested confirmation.
- Qwen3:1.7b was downloaded from official Ollama and tested locally for free. It initially expanded topics; the schema was tightened to exactly selected topics without supplying the correct answer. Its subsequent proof passed, but it also misclassified the changed return policy and some prose added unsupported region language. Raw evidence: local-proof-1.7b-20261018.json. The default remains 0.6b, and review remains required.
- A clean GitHub Actions run passed **56 tests, zero failures, zero skips**, including all three real-FalkorDB integration tests. Typecheck, browser-script syntax and the actual FalkorDB comparison passed **18/18**, with graph/reference TP 44, FP 0 and FN 0; direct-only missed 30. The comparison completed in 304 ms on that runner; this is not a fair cross-machine speed comparison with the earlier Cloud run. Public run: https://github.com/gggauransh/memory-airlock/actions/runs/39118219567 (commit 1f1422dc8f0c48d96f7d198b9cecb7c1f94fac2d). All step conclusions and the actual test totals were inspected. The workflow records the container digest used.
- The missing optional reviewer tools and source packager were published. The narrated video and transcript are publicly available in the v0.1.0-demo GitHub release. The release's source snapshot is from publication time; main contains subsequent updates.

## October 16, 2026 — earlier Cloud verification

## Current free-inference upgrade

- Full suite: **56 passed, zero failed, zero skipped**, including three real FalkorDB integration tests. TypeScript and browser-script syntax checks passed.
- Clean source copy: frozen-lockfile installation from cache and loopback-server startup succeeded without local credentials; **53 passed, zero failed, three database tests correctly skipped**. TypeScript passed in the clean copy.
- Expanded FalkorDB comparison: **18/18 fixtures passed**, 44 affected classifications, zero misses, zero unnecessary invalidations. Full in-memory traversal also passed. Direct-only missed 30; refresh-all caused 80 extra invalidations. Raw measured data: benchmark-results.json.
- Real local inference: Ollama Qwen3:0.6b, three generations per workflow, no Gateway calls. The complete scripted proof passed with FalkorDB after scoped prompt refinement. It created returns and shipping cases, blocked stale draft reuse, refreshed only the returns case and reloaded saved runs. Raw evidence: live-proof.json.
- Local SDK contract test: three HTTP generations after scoped mandatory evidence reads, structured schema transport, no Gateway credentials or unrelated fact leakage.
- Browser on port 4320, synthetic workspace competition-final-20261016: two real local model cases; review correction for a conflicting customer claim; 30-to-14-day preview with actual dependency paths; approval; return chain RECHECK while shipping remained CURRENT; disabled stale draft export; selective refresh generated a 14-day answer while preserving shipping; page reload retained both cases.
- Browser new-knowledge preview: adding Germany retired no fact and affected all three shipping decisions through the collection scope; the return case was unaffected. This preview was left uncommitted.
- Browser comparison: 18/18 live FalkorDB fixtures rendered, including the full in-memory parity baseline. The observed browser run took 11,249 ms; the separately saved run took 11,756 ms. Different timings are expected.
- HTTP boundary checks: stale draft 409, current draft 200, missing mutation token 403, foreign-origin write 403, invalid case input 422. Checks left the memory revision unchanged.
- Desktop layout checked at 1440px and phone at 390px. Phone page width 377px within a 390px viewport. Browser console had no warnings or errors. Temporary viewport overrides were reset.
- Rendered demo: 1280×720 H.264/AAC, 181.23 seconds. Video frames were visually inspected. Screenshots are retained under artifacts/demo. The demo video is an edited narrated sequence of captures from the working application, with offline synthetic voice narration; it is not an uninterrupted screen recording.

## Corrections and limits

The earlier DNS failures occurred in the restricted execution environment; the hostname resolved and database tests passed with network access. This was not evidence that the database instance was broken.

The configured Gateway account still requires payment-card setup. The participant explicitly required a free solution. The main workflow now defaults to local Ollama and requires no API key or payment card. Existing ignored credentials were preserved, never published. A Gateway probe occurred before the participant clarified the free-only constraint; it was rejected and generated no successful inference. No further paid-provider calls were made.

The 0.6b model did not reliably honor autonomous tool calls. The free path therefore uses **server-mandated evidence reads followed by real local inference**. It does not claim autonomous tool selection. During browser review, an earlier prompt produced a contradictory claim sentence despite correct structured outcomes. The local prompts were narrowed, then the full proof and browser flow were repeated successfully. This remains an example of why valid citation IDs and structured checks do not prove natural-language correctness.

One synthetic shop, three typed policy relations, local source-role selection, full-snapshot storage and bounded 16-hop traversal. No production-scale or high-concurrency validation. Source identities are not authenticated. Drafts are never sent. Worker restart examples simulate clearing caches.

Repository and video publication are complete. Participant technical understanding and final event submission remain outstanding. The contribution worksheet is preparation, not evidence that the participant completed it.
