import { Agent } from './Agent.js';
import { AGENT_PROFILES } from './Personalities.js';

export class AgentManager {
  constructor(scene, world) {
    this.agents = [];
    this.speedMultiplier = 1.0; // UI slider coefficient
    for (let i = 0; i < 5; i++) {
      this.agents.push(new Agent(i, AGENT_PROFILES[i], scene, world));
    }
  }

  fixedUpdate(dt, prevItAgentId) {
    const itId = this.agents.find(a => a.isIt)?.id ?? 0;
    this.agents.forEach(a => a.fixedUpdate(dt, this.agents, itId, prevItAgentId, this.speedMultiplier));
  }

  interpolate(alpha) {
    this.agents.forEach(a => a.interpolate(alpha));
  }

  compressState(itAgentId) {
    return {
      agentIds: this.agents.map(a => a.id),
      itId: itAgentId,
      positions: this.agents.map(a => ({
        id: a.id,
        x: Math.round(a.body.position.x * 10) / 10,
        z: Math.round(a.body.position.z * 10) / 10,
        state: a.state,
      })),
    };
  }

  applyDecisions(decisions) {
    if (!Array.isArray(decisions)) return;
    decisions.forEach(d => {
      const agent = this.agents.find(a => a.id === d.id);
      if (agent) {
        agent.decision = {
          moveX: Math.max(-1, Math.min(1, d.moveX || 0)),
          moveZ: Math.max(-1, Math.min(1, d.moveZ || 0)),
          sprint: !!d.sprint,
        };
      }
    });
  }
}
