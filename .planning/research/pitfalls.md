# Pitfalls Research: AI Tag Game

## Critical Pitfalls & Solutions

### 1. Groq Rate Limits (FREE tier: 30 req/min)
- **Problem**: 5 agents x 1 req/s = 300 req/min (10x over limit)
- **Solution**: Batch all 5 agents into 1 Groq call, fire every 600ms

### 2. Groq Latency Spikes
- **Problem**: 500ms+ response freezes game
- **Solution**: Timeout 800ms + local heuristic fallback, never block render loop

### 3. Three.js Memory Leaks
- **Problem**: GPU memory not freed by JS garbage collector
- **Solution**: Share geometries/materials, dispose removed objects, cap pixelRatio at 2

### 4. Agents Getting Stuck in Corners
- **Problem**: Direct vector chase + no stuck detection = infinite loop
- **Solution**: StuckDetector (check movement over 60 frames) + random escape vector

### 5. All Runners Flee Same Direction (Clustering)
- **Problem**: Same flee logic = everyone converges into corner
- **Solution**: Lateral scatter bias per agent ID + separation force > seek force

### 6. Physics Frame Rate Dependency
- **Problem**: At 30fps agents half speed, at 120fps tunnel through walls
- **Solution**: Fixed timestep accumulator pattern (deterministic physics)

### 7. Tag Too Instant (No Tension)
- **Problem**: Touch = instant tag, no drama
- **Solution**: Consider sustained proximity requirement (400ms in range)

### 8. Electron IPC Overhead
- **Problem**: Sending game state over IPC every frame
- **Solution**: Game loop 100% in renderer process, main only for Groq + OS tasks

### 9. Pathfinding Called Every Frame
- **Problem**: A* at 60fps with 5 agents
- **Solution**: Recompute path only when target moves >1.5 units

### 10. LLM Response Unparseable
- **Problem**: JSON parse fails crash agent
- **Solution**: try/catch + fallback to {moveX:0, moveZ:0}, use json response_format
