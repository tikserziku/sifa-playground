export class UIOverlay {
  constructor(agentManager, sifaRules) {
    this.agentManager = agentManager;
    this.sifaRules = sifaRules;
    this.scoreboard = document.getElementById('scoreboard');
    this.overlay = document.getElementById('ui-overlay');
    this.speechContainer = document.getElementById('speech-container');
    this.speechBubbles = new Map();
    this.updateCounter = 0;
  }

  update() {
    this.updateCounter++;
    // Update scoreboard every 10 frames
    if (this.updateCounter % 10 === 0) {
      this.updateScoreboard();
    }
    // Update speech bubbles every frame (position tracking)
    this.updateSpeechBubbles();
  }

  updateScoreboard() {
    const agents = this.agentManager.agents;
    const sorted = [...agents].sort((a, b) => b.score - a.score);

    let html = '<b>⏱ СЧЁТ (выживание)</b><br>';
    sorted.forEach(a => {
      const mins = Math.floor(a.score / 60);
      const secs = Math.floor(a.score % 60);
      const time = `${mins}:${secs.toString().padStart(2, '0')}`;
      const marker = a.isIt ? ' 🏃 ВОДИТ' : '';
      const colorHex = '#' + a.profile.color.toString(16).padStart(6, '0');
      html += `<span style="color:${colorHex}">●</span> ${a.profile.name}: ${time}${marker}<br>`;
    });

    html += `<br><small>Тегов: ${this.sifaRules.tagHistory.length}</small>`;
    this.scoreboard.innerHTML = html;
  }

  updateSpeechBubbles() {
    const agents = this.agentManager.agents;

    agents.forEach(agent => {
      if (agent.speechText && agent.speechTimer > 0) {
        let bubble = this.speechBubbles.get(agent.id);
        if (!bubble) {
          bubble = document.createElement('div');
          bubble.className = 'speech-bubble';
          this.speechContainer.appendChild(bubble);
          this.speechBubbles.set(agent.id, bubble);
        }
        bubble.textContent = agent.speechText;
        bubble.style.display = 'block';

        // Position above agent (screen projection would need camera — simplified)
        // For now use fixed offset based on mesh position
        const x = agent.mesh.position.x;
        const z = agent.mesh.position.z;
        // Simple screen projection approximation
        const screenX = (x / 20 + 0.5) * window.innerWidth;
        const screenY = (0.3 - z / 40) * window.innerHeight;
        bubble.style.left = screenX + 'px';
        bubble.style.top = screenY + 'px';
      } else {
        const bubble = this.speechBubbles.get(agent.id);
        if (bubble) bubble.style.display = 'none';
      }
    });
  }
}
