/**
 * Agent Learning Brain — each agent learns from experience.
 *
 * What they learn:
 * - Which areas are dangerous (got tagged there)
 * - Which areas are safe hideouts (survived there)
 * - Which directions work for escaping
 * - Which targets are easier to catch
 * - Which obstacles are useful for cutting corners
 *
 * Spatial memory: arena divided into grid cells (2x2 units).
 * Each cell has a "danger score" and "success score".
 * Agents use these scores to modify their movement decisions.
 *
 * The learning is VISIBLE — agents clearly get smarter over 5-10 minutes.
 */

const GRID_SIZE = 2;       // cell size in world units
const GRID_CELLS = 20;     // 20x20 grid covering -20..+20 arena
const GRID_OFFSET = 20;    // offset so array indices are positive

export class AgentBrain {
  constructor(agentId, personality) {
    this.agentId = agentId;
    this.personality = personality;

    // Spatial memory grids (GRID_CELLS x GRID_CELLS)
    // dangerMap: how often I got tagged at this cell (0..1)
    // safeMap: how long I survived at this cell (0..1)
    // chaseMap: how often I tagged someone at this cell (0..1)
    this.dangerMap = this.createGrid(0);
    this.safeMap = this.createGrid(0);
    this.chaseMap = this.createGrid(0);

    // Per-agent target memory: success rate of chasing each agent
    this.targetSuccess = {};  // agentId → { attempts, catches }

    // Recent experience buffer
    this.positionHistory = []; // last 60 positions (1 per second)
    this.HISTORY_MAX = 60;

    // Learning rates (personality affects learning speed)
    this.LEARN_RATE = 0.1 + personality.aggression * 0.05;
    this.DECAY_RATE = 0.995; // slow decay so memories persist

    // Stats for display
    this.totalLessons = 0;
    this.smartMoves = 0;     // times brain overrode default behavior
    this.generation = 1;     // increases every 50 lessons

    // Position sampling timer
    this.sampleTimer = 0;
  }

  createGrid(defaultVal) {
    const grid = [];
    for (let i = 0; i < GRID_CELLS; i++) {
      grid[i] = [];
      for (let j = 0; j < GRID_CELLS; j++) {
        grid[i][j] = defaultVal;
      }
    }
    return grid;
  }

  worldToGrid(x, z) {
    const gx = Math.floor((x + GRID_OFFSET) / GRID_SIZE);
    const gz = Math.floor((z + GRID_OFFSET) / GRID_SIZE);
    return [
      Math.max(0, Math.min(GRID_CELLS - 1, gx)),
      Math.max(0, Math.min(GRID_CELLS - 1, gz)),
    ];
  }

  // === LEARNING EVENTS ===

  // Called when this agent gets tagged (bad outcome)
  onGotTagged(x, z, taggerId) {
    const [gx, gz] = this.worldToGrid(x, z);

    // Mark current area as dangerous
    this.dangerMap[gx][gz] = Math.min(1, this.dangerMap[gx][gz] + this.LEARN_RATE * 2);

    // Also mark recent positions as slightly dangerous (I was heading wrong way)
    const recent = this.positionHistory.slice(-5);
    recent.forEach((pos, i) => {
      const [rx, rz] = this.worldToGrid(pos.x, pos.z);
      const weight = (i + 1) / recent.length * this.LEARN_RATE;
      this.dangerMap[rx][rz] = Math.min(1, this.dangerMap[rx][rz] + weight);
    });

    this.totalLessons++;
    this.checkGeneration();
  }

  // Called when this agent successfully tags someone
  onTaggedSomeone(x, z, targetId) {
    const [gx, gz] = this.worldToGrid(x, z);

    // Mark area as good for chasing
    this.chaseMap[gx][gz] = Math.min(1, this.chaseMap[gx][gz] + this.LEARN_RATE * 2);

    // Remember this target is catchable
    if (!this.targetSuccess[targetId]) {
      this.targetSuccess[targetId] = { attempts: 0, catches: 0 };
    }
    this.targetSuccess[targetId].catches++;
    this.targetSuccess[targetId].attempts++;

    this.totalLessons++;
    this.smartMoves += 2;
    this.checkGeneration();
  }

  // Called when chase attempt fails (target escapes)
  onChaseFailed(targetId) {
    if (!this.targetSuccess[targetId]) {
      this.targetSuccess[targetId] = { attempts: 0, catches: 0 };
    }
    this.targetSuccess[targetId].attempts++;
    this.totalLessons++;
  }

  // Called every second to record survival at current position
  recordSurvival(x, z, dt) {
    this.sampleTimer += dt;
    if (this.sampleTimer < 1.0) return;
    this.sampleTimer = 0;

    const [gx, gz] = this.worldToGrid(x, z);
    this.safeMap[gx][gz] = Math.min(1, this.safeMap[gx][gz] + this.LEARN_RATE * 0.5);

    // Track position history
    this.positionHistory.push({ x, z, time: Date.now() });
    if (this.positionHistory.length > this.HISTORY_MAX) {
      this.positionHistory.shift();
    }
  }

  // === DECISION MAKING ===

  // Returns movement bias based on learned spatial memory
  // Output: { x: -1..1, z: -1..1, confidence: 0..1 }
  getMovementBias(myX, myZ, isIt) {
    const [gx, gz] = this.worldToGrid(myX, myZ);

    // Sample 8 neighboring cells + current
    let bestScore = -Infinity;
    let bestDx = 0, bestDz = 0;
    let totalConfidence = 0;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nx >= GRID_CELLS || nz < 0 || nz >= GRID_CELLS) continue;

        let score;
        if (isIt) {
          // As IT: prefer cells where I've caught people, avoid dead zones
          score = this.chaseMap[nx][nz] * 2 - this.safeMap[nx][nz] * 0.5;
        } else {
          // As runner: prefer safe cells, strongly avoid danger cells
          score = this.safeMap[nx][nz] * 1.5 - this.dangerMap[nx][nz] * 3;
        }

        if (score > bestScore) {
          bestScore = score;
          bestDx = dx;
          bestDz = dz;
          totalConfidence += Math.abs(score);
        }
      }
    }

    // Normalize direction
    const len = Math.sqrt(bestDx * bestDx + bestDz * bestDz) || 1;
    const confidence = Math.min(1, totalConfidence * 0.5) * (this.generation * 0.15);

    if (confidence < 0.05) {
      return { x: 0, z: 0, confidence: 0 }; // no useful memory yet
    }

    this.smartMoves++;
    return {
      x: (bestDx / len) * Math.min(confidence, 0.8),
      z: (bestDz / len) * Math.min(confidence, 0.8),
      confidence: Math.min(confidence, 0.8),
    };
  }

  // Which target should I chase? Returns best targetId or null
  getBestTarget(candidates) {
    if (candidates.length === 0) return null;
    if (Object.keys(this.targetSuccess).length === 0) return null;

    let bestId = null;
    let bestScore = -1;

    candidates.forEach(({ id, distance }) => {
      const stats = this.targetSuccess[id];
      let catchability = 0.5; // default

      if (stats && stats.attempts >= 2) {
        catchability = stats.catches / stats.attempts;
      }

      // Score = catchability / distance (prefer nearby + catchable)
      const score = catchability / (distance + 1);
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    });

    return bestId;
  }

  // === MAINTENANCE ===

  // Decay memories slowly (old experiences fade)
  decayMemories() {
    for (let i = 0; i < GRID_CELLS; i++) {
      for (let j = 0; j < GRID_CELLS; j++) {
        this.dangerMap[i][j] *= this.DECAY_RATE;
        this.safeMap[i][j] *= this.DECAY_RATE;
        this.chaseMap[i][j] *= this.DECAY_RATE;
      }
    }
  }

  checkGeneration() {
    const newGen = Math.floor(this.totalLessons / 50) + 1;
    if (newGen > this.generation) {
      this.generation = newGen;
      // Slightly increase learning rate with each generation
      this.LEARN_RATE = Math.min(0.3, this.LEARN_RATE + 0.01);
    }
  }

  // Stats for UI display
  getStats() {
    return {
      lessons: this.totalLessons,
      smartMoves: this.smartMoves,
      generation: this.generation,
      dangerZones: this.countHighCells(this.dangerMap, 0.3),
      safeZones: this.countHighCells(this.safeMap, 0.3),
      huntZones: this.countHighCells(this.chaseMap, 0.3),
    };
  }

  countHighCells(grid, threshold) {
    let count = 0;
    for (let i = 0; i < GRID_CELLS; i++) {
      for (let j = 0; j < GRID_CELLS; j++) {
        if (grid[i][j] > threshold) count++;
      }
    }
    return count;
  }
}
