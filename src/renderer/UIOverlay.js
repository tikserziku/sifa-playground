export class UIOverlay {
  constructor(agentManager, sifaRules, smartCamera, supervisorBot) {
    this.agentManager = agentManager;
    this.sifaRules = sifaRules;
    this.smartCamera = smartCamera;
    this.supervisorBot = supervisorBot;
    this.scoreboard = document.getElementById('scoreboard');
    this.overlay = document.getElementById('ui-overlay');
    this.speechContainer = document.getElementById('speech-container');
    this.speechBubbles = new Map();
    this.updateCounter = 0;

    // Create learning stats panel
    this.learnPanel = document.createElement('div');
    this.learnPanel.id = 'learn-panel';
    this.learnPanel.innerHTML = '';
    document.body.appendChild(this.learnPanel);

    // First-person HUD overlay
    this.fpHud = document.createElement('div');
    this.fpHud.id = 'fp-hud';
    this.fpHud.style.display = 'none';
    document.body.appendChild(this.fpHud);
  }

  update() {
    this.updateCounter++;
    if (this.updateCounter % 10 === 0) {
      this.updateScoreboard();
    }
    if (this.updateCounter % 30 === 0) {
      this.updateLearningPanel();
    }
    this.updateSpeechBubbles();
    this.updateFirstPersonHud();
  }

  updateScoreboard() {
    const agents = this.agentManager.agents;
    const sorted = [...agents].sort((a, b) => b.score - a.score);

    let html = '<b>СЧЁТ (выживание)</b><br>';
    sorted.forEach(a => {
      const mins = Math.floor(a.score / 60);
      const secs = Math.floor(a.score % 60);
      const time = `${mins}:${secs.toString().padStart(2, '0')}`;
      const marker = a.isIt ? ' ВОДИТ' : '';
      const colorHex = '#' + a.profile.color.toString(16).padStart(6, '0');
      html += `<span style="color:${colorHex}">●</span> ${a.profile.name}: ${time}${marker}<br>`;
    });

    html += `<br><small>Тегов: ${this.sifaRules.tagHistory.length}</small>`;

    // Supervisor bot status
    if (this.supervisorBot) {
      const bot = this.supervisorBot;
      const stateEmoji = { patrol: '🛸', approach: '🚨', rescue: '🔧', returnToPatrol: '↩️' };
      const stateRu = { patrol: 'Патруль', approach: 'Лечу!', rescue: 'СПАСАЮ', returnToPatrol: 'Возврат' };
      html += `<br><small>${stateEmoji[bot.state] || '🤖'} Робот: ${stateRu[bot.state] || bot.state}`;
      if (bot.rescueCount > 0) html += ` · Спас: ${bot.rescueCount}`;
      html += `</small>`;
    }

    this.scoreboard.innerHTML = html;
  }

  updateLearningPanel() {
    const agents = this.agentManager.agents;

    let html = '<b>ОБУЧЕНИЕ</b><br>';
    agents.forEach(a => {
      const stats = a.brain.getStats();
      const colorHex = '#' + a.profile.color.toString(16).padStart(6, '0');

      // Generation bar (visual progress)
      const genBar = '■'.repeat(Math.min(stats.generation, 10));
      const genEmpty = '□'.repeat(Math.max(0, 10 - stats.generation));

      html += `<span style="color:${colorHex}">●</span> <b>${a.profile.name}</b> `;
      html += `Gen ${stats.generation} <span style="color:#4f4">${genBar}</span><span style="opacity:0.3">${genEmpty}</span><br>`;
      html += `<span style="opacity:0.7; margin-left:14px">`;
      html += `${stats.lessons} уроков · ${stats.smartMoves} решений`;
      if (stats.dangerZones > 0) html += ` · <span style="color:#f66">${stats.dangerZones} опасн</span>`;
      if (stats.safeZones > 0) html += ` · <span style="color:#6f6">${stats.safeZones} безоп</span>`;
      html += `</span><br>`;
    });

    // Global stats
    const totalLessons = agents.reduce((s, a) => s + a.brain.totalLessons, 0);
    const avgGen = (agents.reduce((s, a) => s + a.brain.generation, 0) / agents.length).toFixed(1);
    html += `<br><small>Всего: ${totalLessons} уроков · Среднее поколение: ${avgGen}</small>`;

    this.learnPanel.innerHTML = html;
  }

  updateSpeechBubbles() {
    const agents = this.agentManager.agents;
    // Hide speech bubbles in first-person mode (they'd be wrong position)
    const isFP = this.smartCamera && (this.smartCamera.mode === 'first' || this.smartCamera.mode === 'cycle');

    agents.forEach(agent => {
      if (!isFP && agent.speechText && agent.speechTimer > 0) {
        let bubble = this.speechBubbles.get(agent.id);
        if (!bubble) {
          bubble = document.createElement('div');
          bubble.className = 'speech-bubble';
          this.speechContainer.appendChild(bubble);
          this.speechBubbles.set(agent.id, bubble);
        }
        bubble.textContent = agent.speechText;
        bubble.style.display = 'block';

        const x = agent.mesh.position.x;
        const z = agent.mesh.position.z;
        const screenX = (x / 20 + 0.5) * window.innerWidth;
        const screenY = (0.3 - z / 40) * window.innerHeight;
        bubble.style.left = screenX + 'px';
        bubble.style.top = screenY + 'px';
      } else {
        const bubble = this.speechBubbles.get(agent.id);
        if (bubble) bubble.style.display = 'none';
      }
    });

    // Supervisor bot speech bubble
    if (this.supervisorBot && this.supervisorBot.speechText && this.supervisorBot.speechTimer > 0) {
      let botBubble = this.speechBubbles.get('bot');
      if (!botBubble) {
        botBubble = document.createElement('div');
        botBubble.className = 'speech-bubble';
        botBubble.style.background = 'rgba(68, 136, 255, 0.9)';
        botBubble.style.color = '#fff';
        botBubble.style.borderColor = '#44ddff';
        this.speechContainer.appendChild(botBubble);
        this.speechBubbles.set('bot', botBubble);
      }
      botBubble.textContent = '🤖 ' + this.supervisorBot.speechText;
      botBubble.style.display = 'block';
      const bx = this.supervisorBot.position.x;
      const bz = this.supervisorBot.position.z;
      const sx = (bx / 20 + 0.5) * window.innerWidth;
      const sy = (0.2 - bz / 40) * window.innerHeight;
      botBubble.style.left = sx + 'px';
      botBubble.style.top = sy + 'px';
    } else {
      const botBubble = this.speechBubbles.get('bot');
      if (botBubble) botBubble.style.display = 'none';
    }
  }

  updateFirstPersonHud() {
    if (!this.smartCamera) return;
    const mode = this.smartCamera.mode;
    const isFP = (mode === 'first' || mode === 'cycle');

    if (!isFP) {
      this.fpHud.style.display = 'none';
      return;
    }

    this.fpHud.style.display = 'block';
    const agents = this.agentManager.agents;
    const agent = agents.find(a => a.id === this.smartCamera.fpAgentId);
    if (!agent) return;

    const colorHex = '#' + agent.profile.color.toString(16).padStart(6, '0');
    const stats = agent.brain.getStats();
    const stateRu = {
      'roam': 'Гуляю',
      'flee': 'УБЕГАЮ!',
      'hunt': 'ЛОВЛЮ!',
      'taunt': 'Ха-ха!',
    };
    const stateText = stateRu[agent.state] || agent.state;

    let html = `<div class="fp-name" style="color:${colorHex}">${agent.profile.name}</div>`;
    html += `<div class="fp-state">${stateText}</div>`;
    html += `<div class="fp-desc">${agent.profile.description}</div>`;
    html += `<div class="fp-brain">Поколение: ${stats.generation} · Уроков: ${stats.lessons}</div>`;

    if (agent.isIt) {
      html += `<div class="fp-role" style="color:#ff4444">ВОДЯЩИЙ</div>`;
    } else {
      const mins = Math.floor(agent.score / 60);
      const secs = Math.floor(agent.score % 60);
      html += `<div class="fp-role">Выживание: ${mins}:${secs.toString().padStart(2, '0')}</div>`;
    }

    // Show nearby agents
    const nearby = agents
      .filter(a => a.id !== agent.id)
      .map(a => ({ name: a.profile.name, dist: agent.distanceTo(a), isIt: a.isIt, color: a.profile.color }))
      .sort((a, b) => a.dist - b.dist);

    html += `<div class="fp-nearby">`;
    nearby.forEach(n => {
      const c = '#' + n.color.toString(16).padStart(6, '0');
      const marker = n.isIt ? ' [СИФА!]' : '';
      html += `<span style="color:${c}">● ${n.name}</span>: ${n.dist.toFixed(1)}м${marker}<br>`;
    });
    html += `</div>`;

    // Supervisor bot status in FP
    if (this.supervisorBot) {
      const bot = this.supervisorBot;
      if (bot.state === 'rescue' || bot.state === 'approach') {
        html += `<div class="fp-bot" style="color:#44ddff">🤖 Робот: ${bot.speechText || 'Спасаю!'}</div>`;
      }
    }

    if (mode === 'cycle') {
      html += `<div class="fp-cycle">Авто-переключение</div>`;
    } else {
      html += `<div class="fp-cycle">Клавиши 1-5: сменить агента</div>`;
    }

    this.fpHud.innerHTML = html;
  }
}
