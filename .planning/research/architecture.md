# Architecture Research: AI Tag Game

## Three-Layer Architecture

```
GAME ENGINE (60fps) — Three.js render + cannon-es physics + FSM state
BEHAVIORAL LAYER (10fps) — Utility AI scoring + steering behaviors
AI DECISION LAYER (async, ~2fps) — Groq API → intent modifiers
```

## Key Decision: Groq = Intent Modifier, Not Position Controller
- Groq responses modify behavioral PARAMETERS, never positions directly
- Prevents rubber-banding when responses arrive late
- Agent continues moving smoothly between AI updates

## Agent State Machine (FSM)
```
ROAM_FREE → (tagger nearby) → FLEE_PANIC
FLEE_PANIC → (caught) → YOU_ARE_IT
YOU_ARE_IT → (tagged someone) → COOL_TAUNT → ROAM_FREE
```

## 5 Agent Personalities
| Name  | Speed | Aggression | Risk | Playfulness | Style |
|-------|-------|-----------|------|-------------|-------|
| Vanya | 1.0   | 0.9       | 0.8  | 0.4         | Aggressive bully |
| Masha | 0.85  | 0.4       | 0.2  | 0.9         | Nervous hider |
| Kolya | 1.1   | 0.6       | 0.9  | 0.6         | Strategic thinker |
| Dasha | 0.95  | 0.7       | 0.5  | 0.8         | Social, forms alliances |
| Petya | 1.2   | 0.5       | 0.3  | 1.0         | Clown, runs and laughs |

## File Structure
```
src/
├── engine/     GameLoop.js, EventBus.js
├── physics/    World.js, CollisionGroups.js
├── agents/     Agent.js, AgentFSM.js, UtilityAI.js, Personalities.js
├── ai/         GroqDecisionMaker.js, IntentMapper.js
├── game/       SifaRules.js, Playground.js
├── renderer/   SceneRenderer.js, AgentMesh.js, UIOverlay.js
└── main.js
```

## Game Loop: Fixed Timestep + Accumulator
- Physics at 60fps (fixed step)
- AI behavioral at 10fps
- Groq async every ~3s
- Render with interpolation
