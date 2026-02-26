# ROADMAP — Sifa Playground

## Phase 1: Electron + Three.js Scaffold [Foundation]
**Dependencies**: none
**Deliverables**:
- Electron app with Vite HMR
- Three.js scene (ground plane, sky, lighting)
- Orbital camera controls
- Game loop with fixed timestep
- REQ-001, REQ-002, REQ-003, REQ-004

## Phase 2: Playground Construction [Environment]
**Dependencies**: Phase 1
**Deliverables**:
- Procedural playground objects (slide, swings, sandbox, monkey bars, merry-go-round)
- Collision bodies for all objects
- Decorative elements (fence, trees, benches)
- REQ-010 through REQ-015

## Phase 3: Agent Movement [Core Gameplay]
**Dependencies**: Phase 1
**Deliverables**:
- 5 colored capsule agents with physics bodies
- Steering behaviors (seek, flee, separation, obstacle avoidance)
- Agent FSM (ROAM_FREE, FLEE_PANIC, YOU_ARE_IT, COOL_TAUNT)
- Stuck detection + escape
- 5 unique personality profiles
- REQ-020 through REQ-025

## Phase 4: Sifa Game Rules [Game Logic]
**Dependencies**: Phase 3
**Deliverables**:
- Tag detection (proximity-based)
- IT transfer with cooldown
- Score tracking (survival time)
- "СИФА!" speech bubble
- Scoreboard overlay
- REQ-030 through REQ-035

## Phase 5: Groq AI Integration [Intelligence]
**Dependencies**: Phase 3, Phase 4
**Deliverables**:
- Groq batch API integration in main process
- Compressed game state serialization
- JSON decision parsing with fallback
- Rate limiter + timeout
- Agent taunts/emotions from LLM
- REQ-040 through REQ-045

## Phase 6: Polish & Package [Release]
**Dependencies**: Phase 5
**Deliverables**:
- Dynamic difficulty adjustment
- Visual effects (glow, shield, emotions)
- Sound effects
- Start/pause/reset UI
- Electron Builder NSIS installer
- REQ-050 through REQ-054

## Parallel Execution
```
Phase 1 ─────────┐
                  ├── Phase 2 (env) ──┐
                  └── Phase 3 (agents)┼── Phase 4 (rules) ── Phase 5 (AI) ── Phase 6 (polish)
```
Phases 2 and 3 can run in parallel after Phase 1.
