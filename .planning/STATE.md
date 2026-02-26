# STATE — Sifa Playground

## Current Phase: 4 (Sifa Rules)
## Status: PHASES 1-4 COMPLETE

## Decisions Log
| Date | Decision | Reason |
|------|----------|--------|
| 2026-02-26 | Three.js over Babylon.js | Faster prototype, larger community |
| 2026-02-26 | cannon-es over Rapier | Simpler, no WASM complexity |
| 2026-02-26 | Procedural geometry over 3D models | Zero loading, full control, no licensing |
| 2026-02-26 | Batch Groq calls (5 agents/call) | Rate limit solution (30 req/min free) |
| 2026-02-26 | 3-tier AI (render/behavior/LLM) | LLM latency never blocks game loop |
| 2026-02-26 | FSM over behavior trees | Simpler for well-defined tag states |
| 2026-02-26 | Детская площадка (playground) | User preference — fun obstacles |

## Completed
- [x] Phase 1: Electron + Three.js scaffold (1280x720, Vite HMR, lighting)
- [x] Phase 2: Playground (slide, swings, sandbox, monkey bars, merry-go-round, trees, benches, fence)
- [x] Phase 3: 5 Agents (capsules, physics, FSM, steering, personalities, stuck detection)
- [x] Phase 4: Sifa rules (tag, cooldown, speech bubbles, scoreboard)

## Blockers
- None

## Next Action
- Phase 5: Groq AI integration (batch API, compressed prompts, rate limiter)
- Phase 6: Polish (DDA, effects, sounds, installer)
