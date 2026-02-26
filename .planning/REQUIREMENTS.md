# REQUIREMENTS — Sifa Playground V1

## Phase 1: Foundation
- **REQ-001**: Electron app window 1280x720 with Three.js scene
- **REQ-002**: Procedural 3D playground (ground, fence, sky)
- **REQ-003**: Camera: orbital controls + auto-follow mode
- **REQ-004**: Basic lighting (directional + ambient, soft shadows)

## Phase 2: Playground Objects
- **REQ-010**: Горка (slide) — collidable obstacle
- **REQ-011**: Качели (swings) — animated, collidable
- **REQ-012**: Песочница (sandbox) — low obstacle, agents can enter
- **REQ-013**: Лесенка/турник (monkey bars) — tall obstacle
- **REQ-014**: Карусель (merry-go-round) — rotating obstacle
- **REQ-015**: Скамейки, деревья, забор — decorative + collision

## Phase 3: Agent System
- **REQ-020**: 5 colored capsule agents with eyes (direction indicator)
- **REQ-021**: Physics bodies for all agents (cannon-es)
- **REQ-022**: Agent FSM: ROAM_FREE, FLEE_PANIC, YOU_ARE_IT, COOL_TAUNT
- **REQ-023**: Steering behaviors: seek, flee, separation, obstacle avoidance
- **REQ-024**: Stuck detection + escape behavior
- **REQ-025**: 5 unique personalities (Vanya, Masha, Kolya, Dasha, Petya)

## Phase 4: Sifa Rules
- **REQ-030**: Random first IT at game start
- **REQ-031**: Tag on proximity (distance < 1.2 units)
- **REQ-032**: 3-second immunity cooldown after being tagged
- **REQ-033**: "СИФА!" speech bubble on tag event
- **REQ-034**: Score = survival time as non-IT
- **REQ-035**: Scoreboard UI overlay

## Phase 5: AI Integration
- **REQ-040**: Groq batch API call every 600ms (all 5 agents)
- **REQ-041**: Compressed game state prompt (< 200 tokens)
- **REQ-042**: JSON response format for decisions
- **REQ-043**: Timeout 800ms + local heuristic fallback
- **REQ-044**: Rate limiter (client-side, 25 req/min safety margin)
- **REQ-045**: Agent speech bubbles from LLM responses (taunts, emotions)

## Phase 6: Polish
- **REQ-050**: Dynamic difficulty adjustment (DDA)
- **REQ-051**: Agent emotions affect visual (glow for IT, shield for cooldown)
- **REQ-052**: Sound effects (tag, sprint, taunt)
- **REQ-053**: Start/pause/reset controls
- **REQ-054**: Electron packaging for Windows (NSIS installer)
