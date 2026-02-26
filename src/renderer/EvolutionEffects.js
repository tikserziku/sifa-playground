/**
 * Visual effects for evolution abilities.
 * Each effect is a Three.js Object3D attached to an agent's mesh.
 *
 * CONSTRAINT CODER: obvious = add effects as inline code in Agent.js.
 * BANNED. Separate visual layer — Agent only calls show/hide.
 * WHY: keeps physics clean, effects can be swapped without touching movement.
 */
import * as THREE from 'three';

export class EvolutionEffects {
  constructor(scene) {
    this.scene = scene;
    this.effects = new Map();  // agentId -> { type -> mesh/group }
    this.screamRings = [];     // expanding rings to update
    this.dashTrails = [];      // fading trail particles
  }

  // Initialize effect holders for an agent
  initAgent(agentId, agentMesh) {
    this.effects.set(agentId, { mesh: agentMesh, active: {} });
  }

  // Show an ability effect
  show(agentId, abilityKey) {
    const data = this.effects.get(agentId);
    if (!data) return;

    // Don't recreate if already active
    if (data.active[abilityKey]) return;

    switch (abilityKey) {
      case 'shield': data.active.shield = this._createShield(data.mesh); break;
      case 'fly': data.active.fly = this._createWings(data.mesh); break;
      case 'scream': this._createScreamRing(data.mesh); break;
      case 'stealth': this._applyStealth(data.mesh, true); data.active.stealth = true; break;
      case 'dash': data.active.dash = this._createDashAura(data.mesh); break;
    }
  }

  // Hide an ability effect
  hide(agentId, abilityKey) {
    const data = this.effects.get(agentId);
    if (!data) return;

    const obj = data.active[abilityKey];
    if (!obj) return;

    switch (abilityKey) {
      case 'shield':
      case 'fly':
      case 'dash':
        if (obj.parent) obj.parent.remove(obj);
        break;
      case 'stealth':
        this._applyStealth(data.mesh, false);
        break;
    }
    delete data.active[abilityKey];
  }

  // Update per-frame animations
  update(dt) {
    const now = Date.now();

    // Scream rings: expand and fade
    for (let i = this.screamRings.length - 1; i >= 0; i--) {
      const ring = this.screamRings[i];
      ring.age += dt;
      const t = ring.age / ring.maxAge;
      const scale = 1 + t * 12;
      ring.mesh.scale.set(scale, 1, scale);
      ring.mesh.material.opacity = 0.6 * (1 - t);
      if (t >= 1) {
        if (ring.mesh.parent) ring.mesh.parent.remove(ring.mesh);
        this.screamRings.splice(i, 1);
      }
    }

    // Dash trails: fade and remove
    for (let i = this.dashTrails.length - 1; i >= 0; i--) {
      const trail = this.dashTrails[i];
      trail.age += dt;
      const t = trail.age / trail.maxAge;
      trail.mesh.material.opacity = 0.4 * (1 - t);
      trail.mesh.scale.multiplyScalar(0.95);
      if (t >= 1) {
        this.scene.remove(trail.mesh);
        this.dashTrails.splice(i, 1);
      }
    }

    // Shield pulse
    this.effects.forEach(data => {
      if (data.active.shield) {
        const s = 1 + Math.sin(now * 0.008) * 0.08;
        data.active.shield.scale.setScalar(s);
        data.active.shield.material.opacity = 0.2 + Math.sin(now * 0.006) * 0.08;
      }
      if (data.active.fly) {
        // Wing flap
        const flap = Math.sin(now * 0.015) * 0.4;
        const wings = data.active.fly.children;
        if (wings[0]) wings[0].rotation.z = 0.3 + flap;
        if (wings[1]) wings[1].rotation.z = -0.3 - flap;
      }
    });
  }

  // Spawn dash trail particle at position
  spawnDashTrail(x, y, z, color) {
    const geo = new THREE.SphereGeometry(0.12, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.3, z);
    this.scene.add(mesh);
    this.dashTrails.push({ mesh, age: 0, maxAge: 0.6 });
  }

  // --- Private effect creators ---

  _createShield(parentMesh) {
    const geo = new THREE.SphereGeometry(0.65, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x44aaff, transparent: true, opacity: 0.25,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const shield = new THREE.Mesh(geo, mat);
    shield.position.y = 0.35;
    parentMesh.add(shield);
    return shield;
  }

  _createWings(parentMesh) {
    const group = new THREE.Group();
    group.position.y = 0.45;

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(0.2, 0.2, 0.5, 0.15);
    wingShape.quadraticCurveTo(0.3, 0, 0.4, -0.15);
    wingShape.quadraticCurveTo(0.15, -0.05, 0, 0);

    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, depthWrite: false,
    });

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.x = 0.15;
    leftWing.rotation.y = Math.PI / 2;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat.clone());
    rightWing.position.x = -0.15;
    rightWing.rotation.y = -Math.PI / 2;
    rightWing.scale.x = -1;
    group.add(rightWing);

    parentMesh.add(group);
    return group;
  }

  _createScreamRing(parentMesh) {
    const geo = new THREE.RingGeometry(0.3, 0.5, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    parentMesh.add(ring);
    this.screamRings.push({ mesh: ring, age: 0, maxAge: 0.8 });
  }

  _applyStealth(mesh, enable) {
    mesh.traverse(child => {
      if (child.material) {
        if (enable) {
          child._origOpacity = child.material.opacity;
          child._origTransparent = child.material.transparent;
          child.material.transparent = true;
          child.material.opacity = 0.15;
        } else {
          child.material.opacity = child._origOpacity ?? 1;
          child.material.transparent = child._origTransparent ?? false;
        }
      }
    });
  }

  _createDashAura(parentMesh) {
    const geo = new THREE.ConeGeometry(0.25, 0.6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0.35,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.y = 0.3;
    cone.rotation.x = Math.PI; // point backward
    cone.position.z = -0.3;
    parentMesh.add(cone);
    return cone;
  }
}
