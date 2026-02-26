import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { Playground } from '../game/Playground.js';
import { AgentManager } from '../agents/AgentManager.js';
import { SifaRules } from '../game/SifaRules.js';
import { UIOverlay } from '../renderer/UIOverlay.js';

export class GameEngine {
  constructor() {
    // Three.js
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 40, 80);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 18, 22);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 40;
    this.controls.target.set(0, 0, 0);

    // Lighting
    this.setupLighting();

    // Physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Game modules
    this.playground = new Playground(this.scene, this.world);
    this.agentManager = new AgentManager(this.scene, this.world);
    this.sifaRules = new SifaRules(this.agentManager);
    this.ui = new UIOverlay(this.agentManager, this.sifaRules);

    // Game loop
    this.fixedStep = 1 / 60;
    this.accumulator = 0;
    this.lastTime = 0;
    this.aiTimer = 0;
    this.AI_INTERVAL = 0.6; // seconds between AI decisions

    // Resize
    window.addEventListener('resize', () => this.onResize());
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(10, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88bbff, 0.3);
    fill.position.set(-5, 8, -5);
    this.scene.add(fill);
  }

  start() {
    this.sifaRules.initialize();
    this.lastTime = performance.now() / 1000;
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(timestamp) {
    requestAnimationFrame((t) => this.loop(t));

    const now = timestamp / 1000;
    const frameDt = Math.min(now - this.lastTime, 0.1);
    this.lastTime = now;
    this.accumulator += frameDt;

    // Fixed timestep physics
    while (this.accumulator >= this.fixedStep) {
      this.world.step(this.fixedStep);
      this.agentManager.fixedUpdate(this.fixedStep);
      this.sifaRules.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    // AI decisions (async, non-blocking)
    this.aiTimer += frameDt;
    if (this.aiTimer >= this.AI_INTERVAL) {
      this.aiTimer = 0;
      this.requestAIDecisions();
    }

    // Render
    const alpha = this.accumulator / this.fixedStep;
    this.agentManager.interpolate(alpha);
    this.controls.update();
    this.ui.update();
    this.renderer.render(this.scene, this.camera);
  }

  async requestAIDecisions() {
    const gameState = this.agentManager.compressState(this.sifaRules.itAgentId);
    try {
      const decisions = await window.electronAPI.askGroq(gameState);
      this.agentManager.applyDecisions(decisions);
    } catch (e) {
      // Fallback: agents continue with last decision
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
