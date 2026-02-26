/**
 * Self-evolving gene system for agents.
 * Each agent has genes that mutate through gameplay.
 * Genes unlock abilities when they cross thresholds.
 *
 * CONSTRAINT CODER: obvious = hardcode abilities as if/else per agent.
 * BANNED. Data-driven ability defs + generic executor instead.
 * WHY: adding new abilities = adding data, not touching movement code.
 */

const GENES = ['speed', 'agility', 'scream', 'fly', 'shield', 'stealth', 'dash'];

// Personality-based initial gene biases (indexed by agentId)
const PERSONALITY_GENES = [
  { dash: 0.2, scream: 0.15, speed: 0.2 },       // 0 Ваня — aggressive
  { stealth: 0.2, shield: 0.15, agility: 0.15 },  // 1 Маша — nervous
  { fly: 0.15, dash: 0.2, agility: 0.2 },         // 2 Коля — strategic
  { scream: 0.15, shield: 0.2, speed: 0.1 },      // 3 Даша — social
  { stealth: 0.15, fly: 0.2, agility: 0.15 },     // 4 Петя — clown
];

// Data-driven ability definitions
export const ABILITIES = {
  dash:    { gene: 'dash',    threshold: 0.5,  duration: 1.5, cooldown: 8,  name: 'Рывок',       icon: '\u{1F4A8}' },
  scream:  { gene: 'scream',  threshold: 0.6,  duration: 0.5, cooldown: 10, name: 'Крик',        icon: '\u{1F4E2}' },
  fly:     { gene: 'fly',     threshold: 0.7,  duration: 3.0, cooldown: 15, name: 'Полёт',       icon: '\u{1F985}' },
  stealth: { gene: 'stealth', threshold: 0.75, duration: 4.0, cooldown: 18, name: 'Невидимость', icon: '\u{1F47B}' },
  shield:  { gene: 'shield',  threshold: 0.8,  duration: 2.0, cooldown: 20, name: 'Щит',         icon: '\u{1F6E1}' },
};

// Ability order for unlocking (easiest first)
const ABILITY_ORDER = ['dash', 'scream', 'fly', 'stealth', 'shield'];

export class GeneSystem {
  constructor() {
    this.agentGenes = new Map();       // agentId -> { geneName: value }
    this.abilityCooldowns = new Map(); // agentId -> { abilityKey: remaining }
    this.activeAbilities = new Map();  // agentId -> { abilityKey: remaining }
    this.evolutionLog = [];            // { agentId, ability, name, icon, time }
    this.totalMutations = 0;
    this.bgTimer = 0;                  // background mutation timer
  }

  initAgent(agentId) {
    const genes = {};
    GENES.forEach(g => {
      genes[g] = 0.1 + Math.random() * 0.15;
    });
    const bias = PERSONALITY_GENES[agentId] || {};
    Object.entries(bias).forEach(([gene, bonus]) => {
      genes[gene] = (genes[gene] || 0) + bonus;
    });
    this.agentGenes.set(agentId, genes);
    this.abilityCooldowns.set(agentId, {});
    this.activeAbilities.set(agentId, {});
  }

  getGenes(agentId) {
    return this.agentGenes.get(agentId) || {};
  }

  getUnlockedAbilities(agentId) {
    const genes = this.getGenes(agentId);
    const result = [];
    ABILITY_ORDER.forEach(key => {
      const def = ABILITIES[key];
      if ((genes[def.gene] || 0) >= def.threshold) {
        result.push({ key, ...def, geneValue: genes[def.gene] });
      }
    });
    return result;
  }

  canUseAbility(agentId, abilityKey) {
    const genes = this.getGenes(agentId);
    const def = ABILITIES[abilityKey];
    if (!def) return false;
    if ((genes[def.gene] || 0) < def.threshold) return false;
    const cd = this.abilityCooldowns.get(agentId) || {};
    if ((cd[abilityKey] || 0) > 0) return false;
    const active = this.activeAbilities.get(agentId) || {};
    if ((active[abilityKey] || 0) > 0) return false;
    return true;
  }

  activateAbility(agentId, abilityKey) {
    if (!this.canUseAbility(agentId, abilityKey)) return false;
    const def = ABILITIES[abilityKey];
    const active = this.activeAbilities.get(agentId);
    active[abilityKey] = def.duration;
    return true;
  }

  isActive(agentId, abilityKey) {
    const active = this.activeAbilities.get(agentId) || {};
    return (active[abilityKey] || 0) > 0;
  }

  // Any ability active?
  hasAnyActive(agentId) {
    const active = this.activeAbilities.get(agentId) || {};
    return Object.values(active).some(v => v > 0);
  }

  update(dt) {
    // Tick active abilities -> start cooldown when expired
    this.activeAbilities.forEach((abilities, agentId) => {
      Object.keys(abilities).forEach(key => {
        if (abilities[key] > 0) {
          abilities[key] -= dt;
          if (abilities[key] <= 0) {
            abilities[key] = 0;
            const cd = this.abilityCooldowns.get(agentId);
            cd[key] = ABILITIES[key].cooldown;
          }
        }
      });
    });

    // Tick cooldowns
    this.abilityCooldowns.forEach(cooldowns => {
      Object.keys(cooldowns).forEach(key => {
        if (cooldowns[key] > 0) {
          cooldowns[key] -= dt;
          if (cooldowns[key] <= 0) cooldowns[key] = 0;
        }
      });
    });

    // Background mutation every 30s (all agents)
    this.bgTimer += dt;
    if (this.bgTimer >= 30) {
      this.bgTimer = 0;
      this.agentGenes.forEach((genes, agentId) => {
        this._backgroundMutate(agentId);
      });
    }
  }

  // Tagged agent gets stronger mutations (evolutionary pressure)
  mutateOnTagged(agentId) {
    const genes = this.getGenes(agentId);
    const count = Math.random() > 0.6 ? 2 : 1;
    const mutations = [];

    for (let i = 0; i < count; i++) {
      const gene = GENES[Math.floor(Math.random() * GENES.length)];
      const amount = 0.05 + Math.random() * 0.1;
      const oldVal = genes[gene] || 0;
      genes[gene] = Math.min(1.0, oldVal + amount);
      mutations.push({ gene, amount: genes[gene] - oldVal, newValue: genes[gene] });

      this._checkNewAbility(agentId, gene, oldVal, genes[gene]);
    }
    this.totalMutations++;
    return mutations;
  }

  // Tagger reinforces their strongest gene
  reinforceOnEscape(agentId) {
    const genes = this.getGenes(agentId);
    let strongest = null, maxVal = -1;
    GENES.forEach(g => {
      if ((genes[g] || 0) > maxVal) { maxVal = genes[g]; strongest = g; }
    });
    if (strongest) {
      const oldVal = genes[strongest];
      const amount = 0.02 + Math.random() * 0.03;
      genes[strongest] = Math.min(1.0, oldVal + amount);
      this._checkNewAbility(agentId, strongest, oldVal, genes[strongest]);
    }
  }

  // AI decides which ability to use (situation-aware)
  decideAbility(agentId, isIt, distToIt, isCorner) {
    const unlocked = this.getUnlockedAbilities(agentId);
    if (unlocked.length === 0) return null;

    for (const ab of unlocked) {
      if (!this.canUseAbility(agentId, ab.key)) continue;

      switch (ab.key) {
        case 'shield':
          if (!isIt && distToIt < 1.8) return ab.key;
          break;
        case 'fly':
          if (!isIt && (distToIt < 2.5 || isCorner)) return ab.key;
          break;
        case 'scream':
          if (!isIt && distToIt < 3) return ab.key;
          if (isIt && distToIt < 4) return ab.key;
          break;
        case 'stealth':
          if (!isIt && distToIt < 6 && distToIt > 3) return ab.key;
          break;
        case 'dash':
          if (!isIt && distToIt < 4) return ab.key;
          if (isIt && distToIt > 2 && distToIt < 6) return ab.key;
          break;
      }
    }
    return null;
  }

  // Recent evolution events for UI notifications
  getRecentEvolutions(maxAgeMs = 8000) {
    const now = Date.now();
    return this.evolutionLog.filter(e => now - e.time < maxAgeMs);
  }

  // Cooldown info for UI (returns 0-1 ratio, 1 = ready)
  getCooldownRatio(agentId, abilityKey) {
    if (this.isActive(agentId, abilityKey)) return -1; // active
    const cd = this.abilityCooldowns.get(agentId) || {};
    const remaining = cd[abilityKey] || 0;
    if (remaining <= 0) return 1;
    const total = ABILITIES[abilityKey]?.cooldown || 1;
    return 1 - (remaining / total);
  }

  // --- Private ---

  _backgroundMutate(agentId) {
    const genes = this.agentGenes.get(agentId);
    if (!genes) return;
    const gene = GENES[Math.floor(Math.random() * GENES.length)];
    const oldVal = genes[gene] || 0;
    const amount = 0.01 + Math.random() * 0.02;
    genes[gene] = Math.min(1.0, oldVal + amount);
    this._checkNewAbility(agentId, gene, oldVal, genes[gene]);
  }

  _checkNewAbility(agentId, gene, oldVal, newVal) {
    Object.entries(ABILITIES).forEach(([key, def]) => {
      if (def.gene === gene && newVal >= def.threshold && oldVal < def.threshold) {
        this.evolutionLog.push({
          agentId, ability: key, name: def.name, icon: def.icon,
          time: Date.now(),
        });
      }
    });
  }

  static getAbilityDefs() { return ABILITIES; }
  static getGeneNames() { return GENES; }
}
