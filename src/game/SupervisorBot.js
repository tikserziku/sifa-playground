import * as THREE from 'three';

const RESCUE_PHRASES = [
  'Помогу!', 'Держись!', 'Лечу на помощь!', 'Спасаю!',
  'Не бойся!', 'Вытащу!', 'Робот спешит!', 'Бип-бип!',
];

/**
 * SupervisorBot — a small flying rescue drone that patrols the playground
 * and rescues stuck agents by lifting them out.
 *
 * States: patrol → approach → rescue → returnToPatrol
 */
export class SupervisorBot {
  constructor(scene) {
    this.scene = scene;

    // Position & movement
    this.position = new THREE.Vector3(0, 4, 0);
    this.velocity = new THREE.Vector3();

    // Patrol
    this.patrolAngle = 0;
    this.PATROL_HEIGHT = 4.0;
    this.PATROL_RADIUS = 8;
    this.PATROL_SPEED = 0.4;

    // State machine
    this.state = 'patrol'; // patrol | approach | rescue | returnToPatrol
    this.targetAgent = null;
    this.rescueTimer = 0;
    this.RESCUE_DURATION = 1.5;
    this.STUCK_THRESHOLD = 40; // frames before we intervene (agent counts stuckFrames)
    this.cooldownMap = new Map(); // agentId → cooldown timer (don't spam rescue same agent)

    // Speech
    this.speechText = '';
    this.speechTimer = 0;

    // Visual
    this.propellerAngle = 0;
    this.bobPhase = 0;
    this.sirenPhase = 0;

    // Build mesh
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // Rescue beam (shown during rescue)
    this.beam = this.createBeam();
    this.beam.visible = false;
    scene.add(this.beam);

    // Helpers
    this._v1 = new THREE.Vector3();
    this.rescueCount = 0;
  }

  createMesh() {
    const group = new THREE.Group();

    // === Body (rounded capsule-like) ===
    const bodyGeo = new THREE.SphereGeometry(0.3, 12, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4488FF });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1, 0.7, 1);
    group.add(body);

    // Belly plate (lighter)
    const bellyGeo = new THREE.SphereGeometry(0.25, 10, 6);
    const bellyMat = new THREE.MeshLambertMaterial({ color: 0xCCDDFF });
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.scale.set(1, 0.5, 1);
    belly.position.y = -0.05;
    group.add(belly);

    // === Eyes (two glowing orbs) ===
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00FF88 });
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.1, 0.05, 0.25);
    group.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
    this.rightEye.position.set(0.1, 0.05, 0.25);
    group.add(this.rightEye);

    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x003322 });
    const lp = new THREE.Mesh(pupilGeo, pupilMat);
    lp.position.z = 0.05;
    this.leftEye.add(lp);
    const rp = new THREE.Mesh(pupilGeo, pupilMat);
    rp.position.z = 0.05;
    this.rightEye.add(rp);

    // === Propeller housing (top disc) ===
    const housingGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.08, 8);
    const housingMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.y = 0.25;
    group.add(housing);

    // Propeller blades (will spin)
    this.propellerGroup = new THREE.Group();
    this.propellerGroup.position.y = 0.30;
    const bladeGeo = new THREE.BoxGeometry(0.5, 0.02, 0.06);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x666666 });

    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.y = (i / 3) * Math.PI * 2;
      this.propellerGroup.add(blade);
    }
    group.add(this.propellerGroup);

    // === Antenna ===
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4);
    const antennaMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 0.38;
    group.add(antenna);

    // Antenna tip (blinks red)
    const tipGeo = new THREE.SphereGeometry(0.035, 6, 4);
    this.antennaTipMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    this.antennaTip = new THREE.Mesh(tipGeo, this.antennaTipMat);
    this.antennaTip.position.y = 0.48;
    group.add(this.antennaTip);

    // === Siren light (on top, visible during rescue) ===
    const sirenGeo = new THREE.SphereGeometry(0.06, 8, 4);
    this.sirenMat = new THREE.MeshBasicMaterial({ color: 0xFF4400, transparent: true, opacity: 0 });
    this.siren = new THREE.Mesh(sirenGeo, this.sirenMat);
    this.siren.position.set(0, 0.35, 0.15);
    group.add(this.siren);

    // === Small arms (manipulators) ===
    const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.28, -0.05, 0.1);
    const la = new THREE.Mesh(armGeo, armMat);
    la.rotation.z = Math.PI / 4;
    this.leftArm.add(la);
    // Claw
    const clawGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const clawMat = new THREE.MeshLambertMaterial({ color: 0xFFAA00 });
    const lc = new THREE.Mesh(clawGeo, clawMat);
    lc.position.set(-0.08, -0.08, 0);
    this.leftArm.add(lc);
    group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.28, -0.05, 0.1);
    const ra = new THREE.Mesh(armGeo, armMat);
    ra.rotation.z = -Math.PI / 4;
    this.rightArm.add(ra);
    const rc = new THREE.Mesh(clawGeo, clawMat);
    rc.position.set(0.08, -0.08, 0);
    this.rightArm.add(rc);
    group.add(this.rightArm);

    // === Red cross (rescue symbol) on belly ===
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xFF3333 });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.04), crossMat);
    crossH.position.set(0, -0.1, 0.26);
    group.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.15), crossMat);
    crossV.position.set(0, -0.1, 0.26);
    group.add(crossV);

    return group;
  }

  createBeam() {
    // Rescue tractor beam — a cone of light from bot to ground
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.6, 3, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x44DDFF,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beamMat = beamMat;
    const beam = new THREE.Mesh(beamGeo, beamMat);
    return beam;
  }

  update(dt, agents) {
    if (!agents || agents.length === 0) return;

    // Always spin propellers
    this.propellerAngle += dt * 25;
    this.propellerGroup.rotation.y = this.propellerAngle;

    // Bob up and down gently
    this.bobPhase += dt * 2;

    // Antenna blink
    const blink = Math.sin(Date.now() * 0.003) > 0.7 ? 1 : 0.2;
    this.antennaTipMat.opacity = blink;
    this.antennaTipMat.transparent = true;

    // Cooldown timers
    for (const [agentId, timer] of this.cooldownMap) {
      const newTimer = timer - dt;
      if (newTimer <= 0) this.cooldownMap.delete(agentId);
      else this.cooldownMap.set(agentId, newTimer);
    }

    // Speech timer
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    // State machine
    switch (this.state) {
      case 'patrol':
        this.updatePatrol(dt, agents);
        break;
      case 'approach':
        this.updateApproach(dt);
        break;
      case 'rescue':
        this.updateRescue(dt, agents);
        break;
      case 'returnToPatrol':
        this.updateReturn(dt);
        break;
    }

    // Apply position to mesh
    this.mesh.position.copy(this.position);
    this.mesh.position.y += Math.sin(this.bobPhase) * 0.1;

    // Siren effect during active states
    if (this.state === 'approach' || this.state === 'rescue') {
      this.sirenPhase += dt * 8;
      this.sirenMat.opacity = (Math.sin(this.sirenPhase) * 0.5 + 0.5) * 0.8;
      // Eyes turn red during rescue
      this.leftEye.material.color.setHex(0xFF4400);
      this.rightEye.material.color.setHex(0xFF4400);
    } else {
      this.sirenMat.opacity = 0;
      this.leftEye.material.color.setHex(0x00FF88);
      this.rightEye.material.color.setHex(0x00FF88);
    }

    // Face toward movement or target
    if (this.targetAgent && (this.state === 'approach' || this.state === 'rescue')) {
      const tx = this.targetAgent.body.position.x;
      const tz = this.targetAgent.body.position.z;
      const angle = Math.atan2(tx - this.position.x, tz - this.position.z);
      this.mesh.rotation.y = angle;
      // Arms reach down during rescue
      if (this.state === 'rescue') {
        this.leftArm.rotation.x = 0.5;
        this.rightArm.rotation.x = 0.5;
      }
    } else {
      this.mesh.rotation.y = this.patrolAngle + Math.PI;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
  }

  updatePatrol(dt, agents) {
    // Orbit around playground center
    this.patrolAngle += dt * this.PATROL_SPEED;
    this.position.set(
      Math.cos(this.patrolAngle) * this.PATROL_RADIUS,
      this.PATROL_HEIGHT,
      Math.sin(this.patrolAngle) * this.PATROL_RADIUS
    );

    // Scan for stuck agents
    const stuck = this.findStuckAgent(agents);
    if (stuck) {
      this.targetAgent = stuck;
      this.state = 'approach';
      this.say(RESCUE_PHRASES[Math.floor(Math.random() * RESCUE_PHRASES.length)]);
    }
  }

  updateApproach(dt) {
    if (!this.targetAgent) { this.state = 'patrol'; return; }

    const tx = this.targetAgent.body.position.x;
    const tz = this.targetAgent.body.position.z;
    const hoverY = 2.0; // hover above agent

    this._v1.set(tx, hoverY, tz);
    this.position.lerp(this._v1, dt * 4);

    const dist = this.position.distanceTo(this._v1);
    if (dist < 0.5) {
      // Arrived — start rescue
      this.state = 'rescue';
      this.rescueTimer = this.RESCUE_DURATION;
      this.beam.visible = true;
      this.say('Держу!');
    }

    // If agent unstuck itself, cancel
    if (this.targetAgent.stuckFrames < 5) {
      this.state = 'returnToPatrol';
      this.targetAgent = null;
    }
  }

  updateRescue(dt, agents) {
    if (!this.targetAgent) { this.state = 'returnToPatrol'; this.beam.visible = false; return; }

    this.rescueTimer -= dt;

    const ax = this.targetAgent.body.position.x;
    const az = this.targetAgent.body.position.z;

    // Keep hovering above agent
    this.position.x = THREE.MathUtils.lerp(this.position.x, ax, dt * 5);
    this.position.z = THREE.MathUtils.lerp(this.position.z, az, dt * 5);
    this.position.y = THREE.MathUtils.lerp(this.position.y, 2.0, dt * 3);

    // Beam tracks from bot to agent
    this.beam.position.set(ax, 1.0, az);
    const beamHeight = this.position.y - 0.2;
    this.beam.scale.y = beamHeight / 3;
    // Beam pulse
    this.beamMat.opacity = 0.15 + Math.sin(Date.now() * 0.01) * 0.1;

    // Push agent toward center of arena (safe zone)
    const centerX = 0, centerZ = 0;
    const dx = centerX - ax;
    const dz = centerZ - az;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const pushStrength = 3.0;
    this.targetAgent.body.velocity.x = (dx / dist) * pushStrength;
    this.targetAgent.body.velocity.z = (dz / dist) * pushStrength;
    this.targetAgent.stuckFrames = 0;

    if (this.rescueTimer <= 0) {
      // Rescue complete
      this.beam.visible = false;
      this.targetAgent.stuckFrames = 0;
      this.cooldownMap.set(this.targetAgent.id, 8.0); // don't rescue again for 8s
      this.rescueCount++;
      this.say('Готово! Беги!');
      this.targetAgent = null;
      this.state = 'returnToPatrol';
    }
  }

  updateReturn(dt) {
    // Fly back up to patrol height
    const patrolPos = this._v1.set(
      Math.cos(this.patrolAngle) * this.PATROL_RADIUS,
      this.PATROL_HEIGHT,
      Math.sin(this.patrolAngle) * this.PATROL_RADIUS
    );
    this.position.lerp(patrolPos, dt * 2);

    const dist = this.position.distanceTo(patrolPos);
    if (dist < 1.0) {
      this.state = 'patrol';
    }
  }

  findStuckAgent(agents) {
    let worstStuck = null;
    let maxStuck = this.STUCK_THRESHOLD;

    for (const agent of agents) {
      if (this.cooldownMap.has(agent.id)) continue;
      if (agent.stuckFrames > maxStuck) {
        maxStuck = agent.stuckFrames;
        worstStuck = agent;
      }
    }
    return worstStuck;
  }

  say(text) {
    this.speechText = text;
    this.speechTimer = 2.0;
  }
}
