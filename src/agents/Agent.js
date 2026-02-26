import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { AgentBrain } from './AgentBrain.js';
import { createChildModel } from '../renderer/ChildModel.js';

const STATES = {
  ROAM: 'roam',
  FLEE: 'flee',
  HUNT: 'hunt',
  TAUNT: 'taunt',
};

export class Agent {
  constructor(id, profile, scene, world) {
    this.id = id;
    this.profile = profile;
    this.state = STATES.ROAM;
    this.isIt = false;
    this.score = 0;
    this.cooldownUntil = 0;
    this.tauntTimer = 0;
    this.stuckFrames = 0;
    this.speechText = '';
    this.speechTimer = 0;

    // AI decision (from Groq or heuristic)
    this.decision = { moveX: 0, moveZ: 0, sprint: false };

    // Learning brain
    this.brain = new AgentBrain(id, profile);
    this.decayTimer = 0;

    // Previous position for interpolation
    this.prevPosition = new THREE.Vector3();
    this.renderPosition = new THREE.Vector3();

    // Three.js mesh
    this.mesh = this.createMesh(profile.color);
    scene.add(this.mesh);

    // Cannon-es body — sphere at feet level, rests on ground
    this.body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(0.2),
      linearDamping: 0.9,
      angularDamping: 1.0,
      fixedRotation: true, // don't tumble
    });
    const angle = (id / 5) * Math.PI * 2;
    const spawnRadius = 5;
    this.body.position.set(
      Math.cos(angle) * spawnRadius,
      0.3, // slightly above ground, gravity will settle it
      Math.sin(angle) * spawnRadius
    );
    world.addBody(this.body);

    this.prevPosition.copy(this.body.position);
  }

  createMesh(color) {
    const group = createChildModel(this.id, color);

    // Glowing aura for IT agent (hidden by default)
    this.auraGroup = new THREE.Group();
    this.auraGroup.visible = false;

    // Inner glow sphere (around child body)
    const auraGeo = new THREE.SphereGeometry(0.5, 16, 12);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xFF4400,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    this.auraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.auraMesh.position.y = 0.4;
    this.auraGroup.add(this.auraMesh);

    // Outer glow ring
    const outerGeo = new THREE.SphereGeometry(0.75, 16, 12);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xFF6600,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    this.outerAura = new THREE.Mesh(outerGeo, outerMat);
    this.outerAura.position.y = 0.4;
    this.auraGroup.add(this.outerAura);

    // Floating crown above head
    const crownGeo = new THREE.ConeGeometry(0.12, 0.2, 5);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
    this.crown = new THREE.Mesh(crownGeo, crownMat);
    this.crown.position.y = 0.95;
    this.auraGroup.add(this.crown);

    // Light pillar
    const pillarGeo = new THREE.CylinderGeometry(0.04, 0.12, 1.2, 8);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xFF8800,
      transparent: true,
      opacity: 0.15,
    });
    this.pillar = new THREE.Mesh(pillarGeo, pillarMat);
    this.pillar.position.y = 1.4;
    this.auraGroup.add(this.pillar);

    group.add(this.auraGroup);

    // Blob shadow (bigger for child)
    const shadowGeo = new THREE.CircleGeometry(0.25, 8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -0.01;
    group.add(this.shadow);

    return group;
  }

  fixedUpdate(dt, allAgents, itAgentId, prevItAgentId) {
    this.prevPosition.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );

    // Update state
    this.isIt = this.id === itAgentId;
    this.auraGroup.visible = this.isIt;

    // Animate aura pulsing
    if (this.isIt) {
      const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5; // 0..1
      const scale = 1.0 + pulse * 0.3;
      this.auraMesh.scale.setScalar(scale);
      this.outerAura.scale.setScalar(scale * 1.2);
      this.auraMesh.material.opacity = 0.15 + pulse * 0.15;
      this.outerAura.material.opacity = 0.05 + pulse * 0.06;
      this.pillar.material.opacity = 0.1 + pulse * 0.1;
      // Crown floats up and down
      this.crown.position.y = 0.7 + Math.sin(Date.now() * 0.003) * 0.1;
      this.crown.rotation.y += 0.02;
    }

    // Taunt timer
    if (this.state === STATES.TAUNT) {
      this.tauntTimer -= dt;
      if (this.tauntTimer <= 0) {
        this.state = this.isIt ? STATES.HUNT : STATES.ROAM;
      }
      return; // Don't move during taunt
    }

    // Determine state based on situation
    if (this.isIt) {
      this.state = STATES.HUNT;
    } else {
      const itAgent = allAgents.find(a => a.id === itAgentId);
      if (itAgent) {
        const dist = this.distanceTo(itAgent);
        this.state = dist < this.profile.panicDistance ? STATES.FLEE : STATES.ROAM;
      }
    }

    // Compute velocity based on state and decision
    const speed = this.decision.sprint ? this.profile.speed * 1.4 : this.profile.speed;
    let vx = 0, vz = 0;

    switch (this.state) {
      case STATES.HUNT: {
        // Chase nearest non-IT agent (skip who just tagged us)
        const target = this.findNearestRunner(allAgents, itAgentId, prevItAgentId);
        if (target) {
          const dx = target.body.position.x - this.body.position.x;
          const dz = target.body.position.z - this.body.position.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          vx = (dx / d) * speed;
          vz = (dz / d) * speed;
          // Mix in AI decision
          vx = vx * 0.7 + this.decision.moveX * speed * 0.3;
          vz = vz * 0.7 + this.decision.moveZ * speed * 0.3;
        }
        break;
      }
      case STATES.FLEE: {
        // Run from IT
        const it = allAgents.find(a => a.id === itAgentId);
        if (it) {
          const dx = this.body.position.x - it.body.position.x;
          const dz = this.body.position.z - it.body.position.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          // Add scatter based on agent ID
          const scatter = (this.id / 5) * Math.PI * 2;
          vx = (dx / d + Math.cos(scatter) * 0.3) * speed;
          vz = (dz / d + Math.sin(scatter) * 0.3) * speed;
          // Mix in AI decision
          vx = vx * 0.6 + this.decision.moveX * speed * 0.4;
          vz = vz * 0.6 + this.decision.moveZ * speed * 0.4;
        }
        break;
      }
      case STATES.ROAM:
      default: {
        // Wander with AI decision
        vx = this.decision.moveX * speed * 0.6;
        vz = this.decision.moveZ * speed * 0.6;
        // Add gentle random wander
        vx += (Math.sin(Date.now() * 0.001 + this.id * 7) * 0.5) * speed * 0.3;
        vz += (Math.cos(Date.now() * 0.0013 + this.id * 11) * 0.5) * speed * 0.3;
        break;
      }
    }

    // Brain: apply learned spatial bias
    const myX = this.body.position.x;
    const myZ = this.body.position.z;
    const bias = this.brain.getMovementBias(myX, myZ, this.isIt);
    if (bias.confidence > 0.05) {
      vx += bias.x * speed * 1.5;
      vz += bias.z * speed * 1.5;
    }

    // Brain: record survival when not IT
    if (!this.isIt) {
      this.brain.recordSurvival(myX, myZ, dt);
    }

    // Brain: decay old memories periodically
    this.decayTimer += dt;
    if (this.decayTimer > 5.0) {
      this.decayTimer = 0;
      this.brain.decayMemories();
    }

    // Separation force (don't stack on each other)
    allAgents.forEach(other => {
      if (other.id === this.id) return;
      const dx = this.body.position.x - other.body.position.x;
      const dz = this.body.position.z - other.body.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.5 && dist > 0) {
        const force = (1.5 - dist) / 1.5;
        vx += (dx / dist) * force * 3;
        vz += (dz / dist) * force * 3;
      }
    });

    // Keep inside arena bounds
    const BOUND = 16;
    const px = this.body.position.x;
    const pz = this.body.position.z;
    if (px > BOUND) vx -= (px - BOUND) * 2;
    if (px < -BOUND) vx -= (px + BOUND) * 2;
    if (pz > BOUND) vz -= (pz - BOUND) * 2;
    if (pz < -BOUND) vz -= (pz + BOUND) * 2;

    // Apply velocity
    this.body.velocity.x = vx;
    this.body.velocity.z = vz;

    // Keep on ground — physics gravity pulls down, clamp at ground level
    if (this.body.position.y < 0.2) {
      this.body.position.y = 0.2;
      this.body.velocity.y = 0;
    }

    // Face movement direction
    if (Math.abs(vx) > 0.1 || Math.abs(vz) > 0.1) {
      const targetAngle = Math.atan2(vx, vz);
      this.mesh.rotation.y = targetAngle;
    }

    // Stuck detection
    const moved = this.prevPosition.distanceTo(
      new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
    );
    if (moved < 0.01) {
      this.stuckFrames++;
      if (this.stuckFrames > 60) {
        // Random escape
        this.body.velocity.x = (Math.random() - 0.5) * speed * 2;
        this.body.velocity.z = (Math.random() - 0.5) * speed * 2;
        this.stuckFrames = 0;
      }
    } else {
      this.stuckFrames = 0;
    }

    // Speech timer
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    // Score (survival time as non-IT)
    if (!this.isIt) {
      this.score += dt;
    }
  }

  interpolate(alpha) {
    this.renderPosition.lerpVectors(
      this.prevPosition,
      new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z),
      alpha
    );
    // Position mesh so feet touch the ground (body center is at physics y)
    this.mesh.position.set(
      this.renderPosition.x,
      this.renderPosition.y - 0.2, // offset: physics sphere center → feet
      this.renderPosition.z
    );

    const vx = this.body.velocity.x;
    const vz = this.body.velocity.z;
    const speed = Math.sqrt(vx * vx + vz * vz);

    const { leftArm, rightArm, leftLeg, rightLeg } = this.mesh.userData;

    if (speed > 0.5) {
      // Running animation
      const freq = 0.012 * (speed / 3);
      const t = Date.now() * freq;
      const amplitude = Math.min(speed * 0.12, 0.7);

      // Arms swing opposite to legs (natural running)
      if (leftArm) leftArm.rotation.x = Math.sin(t) * amplitude;
      if (rightArm) rightArm.rotation.x = -Math.sin(t) * amplitude;

      // Legs swing
      if (leftLeg) leftLeg.rotation.x = -Math.sin(t) * amplitude * 0.9;
      if (rightLeg) rightLeg.rotation.x = Math.sin(t) * amplitude * 0.9;

      // Body bounce (up-down hop while running)
      this.mesh.position.y += Math.abs(Math.sin(t * 2)) * 0.025;

      // Slight body lean forward when running fast
      this.mesh.rotation.x = Math.min(speed * 0.015, 0.1);
    } else {
      // Idle — gentle breathing
      const breathe = Math.sin(Date.now() * 0.002 + this.id) * 0.008;
      this.mesh.position.y += breathe;
      this.mesh.rotation.x = 0;

      // Arms relax with subtle sway
      const idleSway = Math.sin(Date.now() * 0.001 + this.id * 3) * 0.05;
      if (leftArm) leftArm.rotation.x = idleSway;
      if (rightArm) rightArm.rotation.x = -idleSway;
      if (leftLeg) leftLeg.rotation.x = 0;
      if (rightLeg) rightLeg.rotation.x = 0;
    }
  }

  distanceTo(other) {
    const dx = this.body.position.x - other.body.position.x;
    const dz = this.body.position.z - other.body.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  findNearestRunner(allAgents, itAgentId, skipAgentId) {
    let nearest = null;
    let minDist = Infinity;
    allAgents.forEach(a => {
      if (a.id === itAgentId) return;
      if (a.id === skipAgentId) return; // can't chase who just tagged us
      const d = this.distanceTo(a);
      if (d < minDist) {
        minDist = d;
        nearest = a;
      }
    });
    return nearest;
  }

  say(text, duration = 2.0) {
    this.speechText = text;
    this.speechTimer = duration;
  }

  startTaunt(duration = 1.2) {
    this.state = STATES.TAUNT;
    this.tauntTimer = duration;
  }
}
