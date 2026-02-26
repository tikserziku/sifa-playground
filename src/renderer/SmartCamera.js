import * as THREE from 'three';

// Known obstacle positions for camera avoidance
const OBSTACLE_POSITIONS = [
  [-14, -14], [14, -14], [-14, 10], [13, 12],
  [-10, 14], [10, -12], [-15, 0], [15, 3],
  [-8, -6], [6, -7], [-7, 5], [8, 5],
];
const OBSTACLE_RADIUS = 2.5;

/**
 * Camera modes:
 *   'ai'       — AI chase cam: follows IT, frames runner (default)
 *   'first'    — First-person: through agent's eyes (1-5 to pick agent)
 *   'spectator'— Overhead rotating view of entire arena
 *   'cycle'    — Auto-cycles first-person between all agents every 6s
 *   'free'     — OrbitControls (handled externally)
 */
export class SmartCamera {
  constructor(camera) {
    this.camera = camera;
    this.enabled = true;
    this.mode = 'ai'; // current mode

    // Smooth values
    this.currentPos = new THREE.Vector3(0, 18, 22);
    this.currentLookAt = new THREE.Vector3(0, 0, 0);
    this.currentFov = 60;
    this.targetPos = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.targetFov = 60;

    // === AI Chase mode ===
    this.BASE_HEIGHT = 5.5;
    this.BASE_DISTANCE = 7;
    this.CHASE_HEIGHT = 3.5;
    this.CHASE_DISTANCE = 5;
    this.POS_LERP = 2.5;
    this.LOOK_LERP = 3.5;
    this.FOV_LERP = 2.0;
    this.chaseIntensity = 0;
    this.INTENSITY_RISE = 2.0;
    this.INTENSITY_FALL = 0.8;
    this.lastItId = -1;
    this.itSwitchTimer = 0;
    this.IT_SWITCH_DURATION = 1.5;
    this.smoothDirection = new THREE.Vector3(0, 0, 1);
    this.shakeAmount = 0;
    this.SHAKE_DECAY = 4.0;

    // === First-person mode ===
    this.fpAgentId = 0;           // which agent we're looking through
    this.fpBobPhase = 0;          // head bob animation
    this.fpSmoothDir = new THREE.Vector3(0, 0, 1);
    this.FP_EYE_HEIGHT = 0.35;   // eye level above body center
    this.FP_BOB_SPEED = 8;       // bob frequency
    this.FP_BOB_AMOUNT = 0.06;   // bob amplitude

    // === Spectator mode ===
    this.specAngle = 0;
    this.SPEC_HEIGHT = 25;
    this.SPEC_RADIUS = 5;
    this.SPEC_SPEED = 0.15;      // rotation speed

    // === Cycle mode ===
    this.cycleTimer = 0;
    this.CYCLE_INTERVAL = 6.0;   // seconds per agent
    this.cycleAgentIndex = 0;

    // Helpers
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
  }

  update(dt, agents, itAgentId, sifaRules) {
    if (!this.enabled || !agents || agents.length === 0) return;

    switch (this.mode) {
      case 'ai':
        this.updateAIChase(dt, agents, itAgentId);
        break;
      case 'first':
        this.updateFirstPerson(dt, agents, this.fpAgentId);
        break;
      case 'spectator':
        this.updateSpectator(dt, agents);
        break;
      case 'cycle':
        this.updateCycleMode(dt, agents);
        break;
    }

    // Apply shake (all modes except spectator)
    if (this.mode !== 'spectator') {
      this.applyShake(dt);
    }
  }

  // ===========================
  //  AI CHASE MODE
  // ===========================
  updateAIChase(dt, agents, itAgentId) {
    const it = agents.find(a => a.id === itAgentId);
    if (!it) return;

    if (itAgentId !== this.lastItId) {
      if (this.lastItId >= 0) {
        this.itSwitchTimer = this.IT_SWITCH_DURATION;
        this.shakeAmount = 0.3;
      }
      this.lastItId = itAgentId;
    }
    if (this.itSwitchTimer > 0) this.itSwitchTimer -= dt;

    const nearestRunner = this.findNearestRunner(it, agents, itAgentId);
    this.updateIntensity(dt, it, nearestRunner);

    const itPos = new THREE.Vector3(it.body.position.x, 0, it.body.position.z);
    const itVel = new THREE.Vector3(it.body.velocity.x, 0, it.body.velocity.z);

    if (itVel.lengthSq() > 0.5) {
      this.smoothDirection.lerp(itVel.normalize(), dt * 3.0).normalize();
    }

    const intensity = this.chaseIntensity;
    const height = THREE.MathUtils.lerp(this.BASE_HEIGHT, this.CHASE_HEIGHT, intensity);
    const distance = THREE.MathUtils.lerp(this.BASE_DISTANCE, this.CHASE_DISTANCE, intensity);

    this._v1.copy(this.smoothDirection).negate().multiplyScalar(distance);
    this.targetPos.copy(itPos).add(this._v1);
    this.targetPos.y = height;

    if (nearestRunner) {
      const runnerPos = this._v2.set(nearestRunner.body.position.x, 0.5, nearestRunner.body.position.z);
      const itCenter = this._v1.copy(itPos).setY(0.5);
      const lookWeight = 0.3 + intensity * 0.35;
      this.targetLookAt.lerpVectors(itCenter, runnerPos, lookWeight);
      this.targetLookAt.y = 0.8;
    } else {
      this.targetLookAt.copy(itPos).setY(0.8);
    }

    this.targetFov = THREE.MathUtils.lerp(55, 70, intensity);

    let posLerp = this.POS_LERP;
    let lookLerp = this.LOOK_LERP;
    if (this.itSwitchTimer > 0) {
      const t = this.itSwitchTimer / this.IT_SWITCH_DURATION;
      posLerp *= (1 - t * 0.6);
      lookLerp *= (1 - t * 0.4);
    }

    this.smoothToTarget(dt, posLerp, lookLerp);
    this.avoidObstacles(this.currentPos);
    this.currentPos.y = Math.max(2.0, this.currentPos.y);
    this.clampBounds();
    this.applyToCamera();
  }

  // ===========================
  //  FIRST-PERSON MODE
  // ===========================
  updateFirstPerson(dt, agents, agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const px = agent.body.position.x;
    const pz = agent.body.position.z;
    const vx = agent.body.velocity.x;
    const vz = agent.body.velocity.z;
    const speed = Math.sqrt(vx * vx + vz * vz);

    // Smooth facing direction
    if (speed > 0.3) {
      const dir = this._v1.set(vx, 0, vz).normalize();
      this.fpSmoothDir.lerp(dir, dt * 5.0).normalize();
    }

    // Head bob when moving
    if (speed > 1.0) {
      this.fpBobPhase += dt * this.FP_BOB_SPEED * (speed / 4);
    } else {
      this.fpBobPhase *= 0.9; // settle when still
    }
    const bobY = Math.sin(this.fpBobPhase) * this.FP_BOB_AMOUNT;
    const bobX = Math.cos(this.fpBobPhase * 0.5) * this.FP_BOB_AMOUNT * 0.5;

    // Eye position: at agent center + eye height + bob
    this.targetPos.set(
      px + this.fpSmoothDir.x * 0.1 + bobX,
      0.5 + this.FP_EYE_HEIGHT + bobY,
      pz + this.fpSmoothDir.z * 0.1
    );

    // Look forward in movement direction (2 units ahead)
    this.targetLookAt.set(
      px + this.fpSmoothDir.x * 3,
      0.5 + this.FP_EYE_HEIGHT * 0.8,
      pz + this.fpSmoothDir.z * 3
    );

    // Sprint = wider FOV
    const isSprinting = agent.decision.sprint;
    this.targetFov = isSprinting ? 85 : 75;

    // Fast smoothing for responsive first-person feel
    this.smoothToTarget(dt, 8.0, 10.0);
    this.applyToCamera();
  }

  // ===========================
  //  SPECTATOR MODE (overhead)
  // ===========================
  updateSpectator(dt, agents) {
    this.specAngle += dt * this.SPEC_SPEED;

    // Compute center of all agents
    let cx = 0, cz = 0;
    agents.forEach(a => {
      cx += a.body.position.x;
      cz += a.body.position.z;
    });
    cx /= agents.length;
    cz /= agents.length;

    // Slowly orbit above center
    this.targetPos.set(
      cx + Math.cos(this.specAngle) * this.SPEC_RADIUS,
      this.SPEC_HEIGHT,
      cz + Math.sin(this.specAngle) * this.SPEC_RADIUS
    );
    this.targetLookAt.set(cx, 0, cz);
    this.targetFov = 65;

    this.smoothToTarget(dt, 1.5, 2.0);
    this.applyToCamera();
  }

  // ===========================
  //  CYCLE MODE (auto first-person)
  // ===========================
  updateCycleMode(dt, agents) {
    this.cycleTimer += dt;
    if (this.cycleTimer >= this.CYCLE_INTERVAL) {
      this.cycleTimer = 0;
      this.cycleAgentIndex = (this.cycleAgentIndex + 1) % agents.length;
      this.fpAgentId = agents[this.cycleAgentIndex].id;
      this.shakeAmount = 0.1; // subtle transition effect
    }
    this.updateFirstPerson(dt, agents, this.fpAgentId);
  }

  // ===========================
  //  SHARED UTILS
  // ===========================
  smoothToTarget(dt, posLerp, lookLerp) {
    const posAlpha = 1 - Math.exp(-posLerp * dt);
    const lookAlpha = 1 - Math.exp(-lookLerp * dt);
    const fovAlpha = 1 - Math.exp(-this.FOV_LERP * dt);

    this.currentPos.lerp(this.targetPos, posAlpha);
    this.currentLookAt.lerp(this.targetLookAt, lookAlpha);
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, this.targetFov, fovAlpha);
  }

  applyShake(dt) {
    if (this.shakeAmount > 0.01) {
      this.currentPos.x += (Math.random() - 0.5) * this.shakeAmount;
      this.currentPos.y += (Math.random() - 0.5) * this.shakeAmount * 0.5;
      this.currentPos.z += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= Math.exp(-this.SHAKE_DECAY * dt);
    }
  }

  applyToCamera() {
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }

  clampBounds() {
    const B = 20;
    this.currentPos.x = THREE.MathUtils.clamp(this.currentPos.x, -B, B);
    this.currentPos.z = THREE.MathUtils.clamp(this.currentPos.z, -B, B);
  }

  updateIntensity(dt, it, nearestRunner) {
    if (nearestRunner) {
      const dist = it.distanceTo(nearestRunner);
      const target = THREE.MathUtils.clamp(1 - (dist - 2) / 8, 0, 1);
      const rate = target > this.chaseIntensity ? this.INTENSITY_RISE : this.INTENSITY_FALL;
      this.chaseIntensity += (target - this.chaseIntensity) * rate * dt;
    } else {
      this.chaseIntensity *= Math.exp(-this.INTENSITY_FALL * dt);
    }
    this.chaseIntensity = THREE.MathUtils.clamp(this.chaseIntensity, 0, 1);
  }

  avoidObstacles(pos) {
    for (const [ox, oz] of OBSTACLE_POSITIONS) {
      const dx = pos.x - ox;
      const dz = pos.z - oz;
      const dist2d = Math.sqrt(dx * dx + dz * dz);
      if (dist2d < OBSTACLE_RADIUS) {
        if (dist2d < 0.1) { pos.x += 1; pos.z += 1; }
        else {
          const push = (OBSTACLE_RADIUS - dist2d) / OBSTACLE_RADIUS;
          pos.x += (dx / dist2d) * push * 2;
          pos.z += (dz / dist2d) * push * 2;
          pos.y += push * 3;
        }
      }
    }
  }

  findNearestRunner(it, agents, itAgentId) {
    let nearest = null, minDist = Infinity;
    for (const a of agents) {
      if (a.id === itAgentId) continue;
      const d = it.distanceTo(a);
      if (d < minDist) { minDist = d; nearest = a; }
    }
    return nearest;
  }

  // === MODE SWITCHING ===
  setMode(mode) {
    this.mode = mode;
    this.enabled = (mode !== 'free');
  }

  setFirstPersonAgent(agentId) {
    this.fpAgentId = agentId;
    this.shakeAmount = 0.05;
  }

  getModeName() {
    switch (this.mode) {
      case 'ai': return 'AI Погоня';
      case 'first': return 'От 1-го лица';
      case 'spectator': return 'Обзор';
      case 'cycle': return 'Авто-обзор';
      case 'free': return 'Свободная';
      default: return this.mode;
    }
  }

  getFirstPersonAgentName(agents) {
    if (this.mode !== 'first' && this.mode !== 'cycle') return null;
    const a = agents.find(ag => ag.id === this.fpAgentId);
    return a ? a.profile.name : null;
  }
}
