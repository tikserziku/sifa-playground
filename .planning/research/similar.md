# Similar Projects Research

## Most Relevant Projects

### 1. AI Town (a16z) — CLOSEST MATCH
- Browser-based town simulation with LLM agents
- Decoupled simulation tick from render frame
- Activity/state machine: IDLE → SEEKING → CHASING → CAUGHT
- **Borrow**: tick-based decisions, proximity triggers

### 2. Stanford Generative Agents
- 25 LLM agents in town simulation
- Memory stream → retrieval → reflection → plan → action
- **Borrow**: status strings, personality seeding, importance scoring
- **Avoid**: full memory stream (too expensive for game)

### 3. OpenAI Hide-and-Seek (Baker et al.)
- Multi-agent RL, emergent strategies
- **Borrow**: reward shaping, line-of-sight mechanics, spatial reasoning
- **Avoid**: full RL training (days of compute)

### 4. Reynolds Steering Behaviors
- Seek, Flee, Arrive, Separation, Alignment, Cohesion
- Standard for ALL Three.js agent movement
- Directly applicable to tag game

## Key Pattern: "Desire to Play"
- **Best approach**: Pre-scripted enthusiasm phrases (cheap) + LLM for strategy (expensive)
- Agents with personality traits: "I love the thrill of the chase"
- Internal "drive" variable increases when idle → more aggressive behavior
- Tag = drive reset → natural rhythm of excitement

## Universal Finding
ALL LLM-agent game projects: **LLM decisions at 0.5-2s intervals, physics at 60fps**. Never call LLM every frame.
