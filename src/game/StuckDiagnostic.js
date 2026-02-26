/**
 * Stuck diagnostic + smart escape system.
 * Press D to toggle debug overlay showing stuck reasons + obstacles.
 *
 * Diagnoses WHY agents get stuck:
 *   - obstacle: pushed against playground equipment
 *   - boundary: at arena edge
 *   - agents: multiple agents pinning each other
 *   - post-fly: landed on obstacle after flying
 *
 * Smart escape: instead of random, find clearest direction.
 */
import * as THREE from 'three';

// All physics obstacles on the playground (center x,z + radius or half-extents)
const OBSTACLES = [
  { name: 'Горка',     x: -8,  z: -6.5, rx: 1.0, rz: 2.0 },
  { name: 'Качели',    x: 6,   z: -7,   rx: 2.3, rz: 0.8 },
  { name: 'Песочница', x: 0,   z: 7,    rx: 2.3, rz: 2.3 },
  { name: 'Рукоход',   x: -7,  z: 5,    rx: 1.8, rz: 0.8 },
  { name: 'Карусель',  x: 8,   z: 5,    r: 1.8 },
  { name: 'Скамейка1', x: -12, z: 0,    rx: 0.5, rz: 1.2 },
  { name: 'Скамейка2', x: 12,  z: -2,   rx: 0.5, rz: 1.2 },
  { name: 'Скамейка3', x: 3,   z: -13,  rx: 1.2, rz: 0.5 },
];

// Trees
[[-14,-14],[14,-14],[-14,10],[13,12],[-10,14],[10,-12],[-15,0],[15,3]].forEach(([x,z], i) => {
  OBSTACLES.push({ name: `Дерево${i+1}`, x, z, r: 0.6 });
});

const BOUND = 16;
const STUCK_THRESHOLD = 8;      // frames before diagnosed as stuck
const ESCAPE_THRESHOLD = 12;    // frames before smart escape kicks in
const WARP_THRESHOLD = 35;      // frames before warp to safety

export class StuckDiagnostic {
  constructor(scene) {
    this.scene = scene;
    this.debugVisible = false;
    this.agentData = new Map();  // agentId -> { stuckFrames, reason, stuckPos, escapeDir }
    this.debugMarkers = [];
    this.stuckHistory = [];      // last N stuck events for UI

    // Debug overlay DOM
    this.panel = document.createElement('div');
    this.panel.id = 'stuck-debug';
    this.panel.style.cssText = `
      position:absolute; top:50px; left:10px; color:#fff;
      font-family:Consolas,monospace; font-size:11px;
      background:rgba(0,0,0,0.75); padding:10px 14px;
      border-radius:8px; pointer-events:none; display:none;
      line-height:1.6; min-width:280px; border:1px solid #f44;
      z-index: 100;
    `;
    document.body.appendChild(this.panel);

    // Toggle with D key
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyD' && !e.ctrlKey && !e.altKey) {
        this.debugVisible = !this.debugVisible;
        this.panel.style.display = this.debugVisible ? 'block' : 'none';
        this._toggleMarkers(this.debugVisible);
      }
    });
  }

  initAgent(agentId) {
    this.agentData.set(agentId, {
      stuckFrames: 0,
      reason: '',
      nearestObstacle: '',
      obstDist: 999,
      atBoundary: false,
      nearAgents: 0,
      lastPos: null,
      escapedCount: 0,
      warpedCount: 0,
    });
  }

  /**
   * Main diagnostic + escape. Call from Agent.fixedUpdate AFTER velocity is set.
   * Returns escape velocity override if agent is stuck, or null.
   */
  diagnose(agent, allAgents) {
    const data = this.agentData.get(agent.id);
    if (!data) return null;

    const px = agent.body.position.x;
    const pz = agent.body.position.z;
    const vx = agent.body.velocity.x;
    const vz = agent.body.velocity.z;
    const speed = Math.sqrt(vx * vx + vz * vz);

    // Check movement
    if (data.lastPos) {
      const dx = px - data.lastPos.x;
      const dz = pz - data.lastPos.z;
      const moved = Math.sqrt(dx * dx + dz * dz);

      if (moved < 0.015 && speed > 0.5) {
        // Trying to move but can't = stuck
        data.stuckFrames++;
      } else {
        data.stuckFrames = Math.max(0, data.stuckFrames - 2); // cool down
      }
    }
    data.lastPos = { x: px, z: pz };

    // Diagnose reason
    data.reason = '';
    data.nearestObstacle = '';
    data.obstDist = 999;
    data.atBoundary = false;
    data.nearAgents = 0;

    // Check obstacles
    for (const obs of OBSTACLES) {
      const dist = this._distToObstacle(px, pz, obs);
      if (dist < data.obstDist) {
        data.obstDist = dist;
        data.nearestObstacle = obs.name;
      }
    }

    // Check boundary
    if (Math.abs(px) > BOUND - 1 || Math.abs(pz) > BOUND - 1) {
      data.atBoundary = true;
    }

    // Check nearby agents
    allAgents.forEach(other => {
      if (other.id === agent.id) return;
      const d = agent.distanceTo(other);
      if (d < 1.5) data.nearAgents++;
    });

    // Determine reason
    if (data.stuckFrames >= STUCK_THRESHOLD) {
      if (data.obstDist < 0.8) data.reason = `obstacle:${data.nearestObstacle}`;
      else if (data.atBoundary) data.reason = 'boundary';
      else if (data.nearAgents >= 2) data.reason = 'agents-pile';
      else if (agent.flying) data.reason = 'fly-collision';
      else data.reason = 'unknown';

      // Log event
      if (data.stuckFrames === STUCK_THRESHOLD) {
        this.stuckHistory.push({
          agentId: agent.id,
          name: agent.profile.name,
          reason: data.reason,
          x: px.toFixed(1),
          z: pz.toFixed(1),
          time: Date.now(),
        });
        if (this.stuckHistory.length > 20) this.stuckHistory.shift();
      }
    }

    // === SMART ESCAPE ===
    if (data.stuckFrames >= WARP_THRESHOLD) {
      // Emergency warp to nearest safe spot
      const safe = this._findSafeSpot(px, pz, allAgents);
      agent.body.position.x = safe.x;
      agent.body.position.z = safe.z;
      agent.body.position.y = 0.3;
      agent.body.velocity.set(0, 0, 0);
      data.stuckFrames = 0;
      data.warpedCount++;
      agent.say('Телепорт!', 1.5);
      return { x: 0, z: 0 };
    }

    if (data.stuckFrames >= ESCAPE_THRESHOLD) {
      // Smart escape: try 8 directions, pick the one furthest from obstacles
      const escape = this._findEscapeDir(px, pz, allAgents, agent.id);
      data.escapedCount++;
      data.stuckFrames = 0; // full reset after escape attempt
      return escape;
    }

    return null;
  }

  update() {
    if (!this.debugVisible) return;
    this._updatePanel();
    this._updateMarkers();
  }

  // --- Escape algorithms ---

  _findEscapeDir(px, pz, allAgents, myId) {
    let bestDir = { x: 0, z: 0 };
    let bestScore = -Infinity;
    const speed = 10;

    // Test 8 directions
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);

      // Score: distance from obstacles + distance from boundary
      const testX = px + dx * 2;
      const testZ = pz + dz * 2;
      let score = 0;

      // Prefer directions away from obstacles
      for (const obs of OBSTACLES) {
        const dist = this._distToObstacle(testX, testZ, obs);
        score += Math.min(dist, 3);
      }

      // Prefer staying in bounds
      if (Math.abs(testX) < BOUND - 2 && Math.abs(testZ) < BOUND - 2) {
        score += 5;
      }

      // Prefer center
      score -= Math.sqrt(testX * testX + testZ * testZ) * 0.1;

      // Avoid other agents
      allAgents.forEach(a => {
        if (a.id === myId) return;
        const adx = testX - a.body.position.x;
        const adz = testZ - a.body.position.z;
        const ad = Math.sqrt(adx * adx + adz * adz);
        if (ad < 2) score -= (2 - ad) * 3;
      });

      if (score > bestScore) {
        bestScore = score;
        bestDir = { x: dx * speed, z: dz * speed };
      }
    }
    return bestDir;
  }

  _findSafeSpot(px, pz, allAgents) {
    // Try a grid of positions, find the one furthest from all obstacles
    let bestPos = { x: 0, z: 0 };
    let bestScore = -Infinity;

    for (let x = -12; x <= 12; x += 3) {
      for (let z = -12; z <= 12; z += 3) {
        let score = 0;
        for (const obs of OBSTACLES) {
          score += Math.min(this._distToObstacle(x, z, obs), 4);
        }
        // Distance from current pos (don't warp too far if possible)
        const dpx = x - px;
        const dpz = z - pz;
        score -= Math.sqrt(dpx * dpx + dpz * dpz) * 0.3;

        // Avoid warping on top of another agent
        allAgents.forEach(a => {
          const ax = a.body.position.x - x;
          const az = a.body.position.z - z;
          const d = Math.sqrt(ax * ax + az * az);
          if (d < 2) score -= 10;
        });

        if (score > bestScore) {
          bestScore = score;
          bestPos = { x, z };
        }
      }
    }
    return bestPos;
  }

  _distToObstacle(px, pz, obs) {
    if (obs.r) {
      // Circular obstacle
      const dx = px - obs.x;
      const dz = pz - obs.z;
      return Math.sqrt(dx * dx + dz * dz) - obs.r;
    }
    // Rectangular obstacle
    const dx = Math.max(0, Math.abs(px - obs.x) - (obs.rx || 0));
    const dz = Math.max(0, Math.abs(pz - obs.z) - (obs.rz || 0));
    return Math.sqrt(dx * dx + dz * dz);
  }

  // --- Debug UI ---

  _updatePanel() {
    let html = '<b style="color:#f44">STUCK DIAGNOSTIC [D]</b><br><br>';

    this.agentData.forEach((data, agentId) => {
      const stuck = data.stuckFrames >= STUCK_THRESHOLD;
      const color = stuck ? '#f44' : '#4f4';
      const bar = '\u2588'.repeat(Math.min(10, Math.floor(data.stuckFrames / 10)));
      const empty = '\u2591'.repeat(Math.max(0, 10 - Math.floor(data.stuckFrames / 10)));

      html += `<span style="color:${color}">\u25CF Agent ${agentId}</span> `;
      html += `<span style="color:#888">${bar}${empty}</span> ${data.stuckFrames}f`;
      if (data.reason) html += ` <span style="color:#ff8">${data.reason}</span>`;
      html += `<br>`;
      html += `<span style="opacity:0.6;margin-left:14px">`;
      html += `obst: ${data.nearestObstacle || '-'} (${data.obstDist.toFixed(1)}m)`;
      html += ` | bound: ${data.atBoundary ? 'YES' : 'no'}`;
      html += ` | near: ${data.nearAgents} agents`;
      html += `</span><br>`;
      html += `<span style="opacity:0.5;margin-left:14px">`;
      html += `escapes: ${data.escapedCount} warps: ${data.warpedCount}`;
      html += `</span><br>`;
    });

    // Recent stuck events
    if (this.stuckHistory.length > 0) {
      html += '<br><b>HISTORY</b><br>';
      this.stuckHistory.slice(-8).reverse().forEach(ev => {
        const ago = ((Date.now() - ev.time) / 1000).toFixed(0);
        html += `<span style="opacity:0.7">${ago}s ago: ${ev.name} @ (${ev.x},${ev.z}) — ${ev.reason}</span><br>`;
      });
    }

    this.panel.innerHTML = html;
  }

  _updateMarkers() {
    // Show red cylinders at stuck agent positions
    this._clearMarkers();
    this.agentData.forEach((data, agentId) => {
      if (data.stuckFrames >= STUCK_THRESHOLD && data.lastPos) {
        const geo = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff0000, transparent: true, opacity: 0.3, depthWrite: false,
        });
        const marker = new THREE.Mesh(geo, mat);
        marker.position.set(data.lastPos.x, 1.5, data.lastPos.z);
        this.scene.add(marker);
        this.debugMarkers.push(marker);
      }
    });
  }

  _clearMarkers() {
    this.debugMarkers.forEach(m => this.scene.remove(m));
    this.debugMarkers = [];
  }

  _toggleMarkers(show) {
    if (!show) this._clearMarkers();
  }
}
