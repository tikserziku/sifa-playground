const SIFA_SHOUTS = [
  'СИФА!!!',
  'СИФА! Ты водишь!',
  'Сифа-а-а!',
  'СИФА! Лови!',
  'Поймал! СИФА!',
];

const FLEE_SHOUTS = [
  'Не догонишь!',
  'Ааа, убегаю!',
  'Нет-нет-нет!',
  'Быстрее, быстрее!',
  'За мной!',
];

const HUNT_SHOUTS = [
  'Сейчас поймаю!',
  'Не убежишь!',
  'Я иду за тобой!',
  'Ага, попался!',
  'Беги-беги!',
];

export class SifaRules {
  constructor(agentManager) {
    this.agentManager = agentManager;
    this.itAgentId = 0;
    this.cooldowns = new Map(); // agentId → expiry time
    this.COOLDOWN_TIME = 3.0; // seconds
    this.TAG_DISTANCE = 1.2;
    this.tagHistory = [];
    this.gameTime = 0;
    this.shoutTimer = 0;
  }

  initialize() {
    // Random first IT
    this.itAgentId = Math.floor(Math.random() * 5);
    const it = this.agentManager.agents[this.itAgentId];
    it.isIt = true;
    it.say('Я вожу!', 2.5);
  }

  update(dt) {
    this.gameTime += dt;
    this.shoutTimer -= dt;

    const agents = this.agentManager.agents;
    const it = agents[this.itAgentId];
    if (!it) return;

    // Random shouts from agents
    if (this.shoutTimer <= 0) {
      this.shoutTimer = 2 + Math.random() * 4;
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      if (randomAgent.state === 'flee' && Math.random() > 0.5) {
        randomAgent.say(FLEE_SHOUTS[Math.floor(Math.random() * FLEE_SHOUTS.length)]);
      } else if (randomAgent.isIt && Math.random() > 0.5) {
        randomAgent.say(HUNT_SHOUTS[Math.floor(Math.random() * HUNT_SHOUTS.length)]);
      }
    }

    // Check tag
    agents.forEach(target => {
      if (target.id === this.itAgentId) return;
      if (this.isOnCooldown(target.id)) return;

      const dist = it.distanceTo(target);
      if (dist < this.TAG_DISTANCE) {
        this.executeTag(it, target);
      }
    });

    // Update cooldowns
    this.cooldowns.forEach((expiry, agentId) => {
      if (this.gameTime >= expiry) this.cooldowns.delete(agentId);
    });
  }

  executeTag(tagger, tagged) {
    // Record
    this.tagHistory.push({
      from: tagger.id,
      to: tagged.id,
      time: this.gameTime,
    });

    // Shout СИФА!
    tagger.say(SIFA_SHOUTS[Math.floor(Math.random() * SIFA_SHOUTS.length)], 2.0);
    tagged.say('О нет!!! 😱', 1.5);

    // Tagger celebrates briefly
    tagger.startTaunt(1.0);

    // Transfer IT
    tagger.isIt = false;
    tagged.isIt = true;
    this.itAgentId = tagged.id;

    // Cooldown: tagger can't be tagged back immediately
    this.cooldowns.set(tagger.id, this.gameTime + this.COOLDOWN_TIME);
  }

  isOnCooldown(agentId) {
    const expiry = this.cooldowns.get(agentId);
    return expiry && this.gameTime < expiry;
  }
}
