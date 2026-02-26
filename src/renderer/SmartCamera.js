import * as THREE from 'three';

// Known obstacle positions (trees, playground equipment) for camera avoidance
const OBSTACLE_POSITIONS = [
  // Trees (from Playground.js)
  [-14, -14], [14, -14], [-14, 10], [13, 12],
  [-10, 14], [10, -12], [-15, 0], [15, 3],
  // Slide
  [-8, -6],
  // Swings
  [6, -7],
  // Monkey bars
  [-7, 5],
  // Merry-go-round
  [8, 5],
];
const OBSTACLE_RADIUS = 2.5; // avoidance radius

/**
 * AI-driven camera that follows the IT agent from behind,
 * framing both the chaser and the nearest fleeing target.
 *
 * Behavior:
 * - Orbits behind the IT agent's movement direction
 * - LookAt = weighted point between IT and nearest runner
 * - Gets closer + lower during intense chase moments
 * - Pulls back higher during calm roaming
 * - Cuts/swings smoothly on IT transfer (new sifa)
 * - Never clips through ground or obstacles
 */
export class SmartCamera {
  constructor(camera) {
    this.camera = camera;
    this.enabled = true;

    // Current smooth values
    this.currentPos = new THREE.Vector3(0, 18, 22);
    this.currentLookAt = new THREE.Vector3(0, 0, 0);
    this.currentFov = 60;

    // Target values (computed each frame, smoothed toward)
    this.targetPos = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.targetFov = 60;

    // Camera offset relative to IT agent's back
    this.BASE_HEIGHT = 5.5;       // height above agent
    this.BASE_DISTANCE = 7;       // distance behind agent
    this.CHASE_HEIGHT = 3.5;      // lower during intense chase
    this.CHASE_DISTANCE = 5;      // closer during chase
    this.OVERVIEW_HEIGHT = 12;    // high when nothing happening
    this.OVERVIEW_DISTANCE = 14;  // far overview

    // Smoothing speeds (lower = smoother/slower)
    this.POS_LERP = 2.5;         // position smoothing
    this.LOOK_LERP = 3.5;        // look-at smoothing (faster for responsiveness)
    this.FOV_LERP = 2.0;         // FOV smoothing

    // Chase intensity tracking
    this.chaseIntensity = 0;      // 0 = calm, 1 = max chase
    this.INTENSITY_RISE = 2.0;    // how fast intensity builds
    this.INTENSITY_FALL = 0.8;    // how fast intensity decays

    // IT tracking
    this.lastItId = -1;
    this.itSwitchTimer = 0;       // smooths camera during IT transfer
    this.IT_SWITCH_DURATION = 1.5; // seconds of smooth transition on tag

    // Direction tracking (IT agent's facing)
    this.smoothDirection = new THREE.Vector3(0, 0, 1);

    // Shake on tag
    this.shakeAmount = 0;
    this.SHAKE_DECAY = 4.0;

    // Helpers
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
  }

  update(dt, agents, itAgentId, sifaRules) {
    if (!this.enabled) return;
    if (!agents || agents.length === 0) return;

    const it = agents.find(a => a.id === itAgentId);
    if (!it) return;

    // Detect IT switch (new sifa)
    if (itAgentId !== this.lastItId) {
      if (this.lastItId >= 0) {
        this.itSwitchTimer = this.IT_SWITCH_DURATION;
        this.shakeAmount = 0.3; // camera shake on tag
      }
      this.lastItId = itAgentId;
    }
    if (this.itSwitchTimer > 0) this.itSwitchTimer -= dt;

    // Find nearest runner (target being chased)
    const nearestRunner = this.findNearestRunner(it, agents, itAgentId);

    // Compute chase intensity
    this.updateIntensity(dt, it, nearestRunner);

    // IT agent's movement direction
    const itPos = new THREE.Vector3(it.body.position.x, 0, it.body.position.z);
    const itVel = new THREE.Vector3(it.body.velocity.x, 0, it.body.velocity.z);

    if (itVel.lengthSq() > 0.5) {
      // Smooth the direction (avoids jittery cam when agent turns fast)
      const dir = itVel.normalize();
      this.smoothDirection.lerp(dir, dt * 3.0);
      this.smoothDirection.normalize();
    }

    // --- Compute target camera position: behind IT agent ---
    const intensity = this.chaseIntensity;

    // Interpolate height and distance based on intensity
    const height = THREE.MathUtils.lerp(this.BASE_HEIGHT, this.CHASE_HEIGHT, intensity);
    const distance = THREE.MathUtils.lerp(this.BASE_DISTANCE, this.CHASE_DISTANCE, intensity);

    // Camera sits behind the IT agent (opposite of movement direction)
    this._v1.copy(this.smoothDirection).negate().multiplyScalar(distance);
    this.targetPos.copy(itPos).add(this._v1);
    this.targetPos.y = height;

    // --- Compute look-at: weighted point between IT and runner ---
    if (nearestRunner) {
      const runnerPos = new THREE.Vector3(
        nearestRunner.body.position.x, 0.5, nearestRunner.body.position.z
      );
      const itCenter = this._v2.copy(itPos).setY(0.5);

      // Weight: look more toward runner when chase is intense
      const lookWeight = 0.3 + intensity * 0.35; // 0.3 calm → 0.65 intense
      this.targetLookAt.lerpVectors(itCenter, runnerPos, lookWeight);
      this.targetLookAt.y = 0.8; // slight up to keep horizon nice
    } else {
      // No runner nearby — look at IT
      this.targetLookAt.copy(itPos).setY(0.8);
    }

    // --- FOV: widen during intense chase for dramatic feel ---
    this.targetFov = THREE.MathUtils.lerp(55, 70, intensity);

    // --- If IT just switched, blend slower for cinematic transition ---
    let posLerp = this.POS_LERP;
    let lookLerp = this.LOOK_LERP;
    if (this.itSwitchTimer > 0) {
      const t = this.itSwitchTimer / this.IT_SWITCH_DURATION;
      posLerp *= (1 - t * 0.6);  // slower during transition
      lookLerp *= (1 - t * 0.4);
    }

    // --- Smooth interpolation ---
    const posAlpha = 1 - Math.exp(-posLerp * dt);
    const lookAlpha = 1 - Math.exp(-lookLerp * dt);
    const fovAlpha = 1 - Math.exp(-this.FOV_LERP * dt);

    this.currentPos.lerp(this.targetPos, posAlpha);
    this.currentLookAt.lerp(this.targetLookAt, lookAlpha);
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, this.targetFov, fovAlpha);

    // --- Obstacle avoidance: push camera away from trees/structures ---
    this.avoidObstacles(this.currentPos);

    // --- Clamp camera height (never go below ground) ---
    this.currentPos.y = Math.max(2.0, this.currentPos.y);

    // --- Keep camera inside arena bounds ---
    const BOUND = 20;
    this.currentPos.x = THREE.MathUtils.clamp(this.currentPos.x, -BOUND, BOUND);
    this.currentPos.z = THREE.MathUtils.clamp(this.currentPos.z, -BOUND, BOUND);

    // --- Camera shake on tag ---
    let shakeOffset = this._v3.set(0, 0, 0);
    if (this.shakeAmount > 0.01) {
      shakeOffset.set(
        (Math.random() - 0.5) * this.shakeAmount,
        (Math.random() - 0.5) * this.shakeAmount * 0.5,
        (Math.random() - 0.5) * this.shakeAmount
      );
      this.shakeAmount *= Math.exp(-this.SHAKE_DECAY * dt);
    }

    // --- Apply to camera ---
    this.camera.position.copy(this.currentPos).add(shakeOffset);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }

  updateIntensity(dt, it, nearestRunner) {
    if (nearestRunner) {
      const dist = it.distanceTo(nearestRunner);
      // Close = intense. dist < 3 = max, dist > 10 = zero
      const targetIntensity = THREE.MathUtils.clamp(1 - (dist - 2) / 8, 0, 1);

      if (targetIntensity > this.chaseIntensity) {
        // Rise fast when chase heats up
        this.chaseIntensity += (targetIntensity - this.chaseIntensity) * this.INTENSITY_RISE * dt;
      } else {
        // Decay slowly when chase cools
        this.chaseIntensity += (targetIntensity - this.chaseIntensity) * this.INTENSITY_FALL * dt;
      }
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
        if (dist2d < 0.1) {
          // Dead center — push in random direction
          pos.x += 1;
          pos.z += 1;
        } else {
          // Push camera outward from obstacle
          const pushStrength = (OBSTACLE_RADIUS - dist2d) / OBSTACLE_RADIUS;
          pos.x += (dx / dist2d) * pushStrength * 2;
          pos.z += (dz / dist2d) * pushStrength * 2;
          // Also push up to clear treetops
          pos.y += pushStrength * 3;
        }
      }
    }
  }

  findNearestRunner(it, agents, itAgentId) {
    let nearest = null;
    let minDist = Infinity;
    for (const a of agents) {
      if (a.id === itAgentId) continue;
      const d = it.distanceTo(a);
      if (d < minDist) {
        minDist = d;
        nearest = a;
      }
    }
    return nearest;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
