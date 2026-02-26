import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { Playground } from '../game/Playground.js';
import { AgentManager } from '../agents/AgentManager.js';
import { SifaRules } from '../game/SifaRules.js';
import { UIOverlay } from '../renderer/UIOverlay.js';
import { MusicPlayer } from '../audio/MusicPlayer.js';
import { VoiceManager } from '../audio/VoiceManager.js';
import { SmartCamera } from '../renderer/SmartCamera.js';

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

    // OrbitControls (free camera mode)
    this.orbitControls = new OrbitControls(this.camera, this.canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.maxPolarAngle = Math.PI / 2.2;
    this.orbitControls.minDistance = 8;
    this.orbitControls.maxDistance = 40;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.enabled = false; // AI camera is default

    // Smart AI camera (follows IT agent)
    this.smartCamera = new SmartCamera(this.camera);
    this.cameraMode = 'ai'; // 'ai' or 'free'

    // Lighting
    this.setupLighting();

    // Physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Game modules
    this.playground = new Playground(this.scene, this.world);
    this.agentManager = new AgentManager(this.scene, this.world);
    this.music = new MusicPlayer();
    this.voice = new VoiceManager();
    this.sifaRules = new SifaRules(this.agentManager, this.voice);
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

    // Start music on first user interaction (browser autoplay policy)
    const hint = document.getElementById('start-hint');
    const startAudio = () => {
      this.music.start();
      if (hint) hint.style.display = 'none';
      document.removeEventListener('click', startAudio);
      document.removeEventListener('keydown', startAudio);
    };
    document.addEventListener('click', startAudio);
    document.addEventListener('keydown', startAudio);

    // Control buttons
    const btnMusic = document.getElementById('btn-music');
    const btnVoice = document.getElementById('btn-voice');
    let musicOn = true, voiceOn = true;

    btnMusic.addEventListener('click', (e) => {
      e.stopPropagation();
      musicOn = !musicOn;
      if (musicOn) { this.music.start(); btnMusic.textContent = 'Музыка: ВКЛ'; }
      else { this.music.stop(); btnMusic.textContent = 'Музыка: ВЫКЛ'; }
    });
    btnVoice.addEventListener('click', (e) => {
      e.stopPropagation();
      voiceOn = !voiceOn;
      this.voice.setEnabled(voiceOn);
      btnVoice.textContent = voiceOn ? 'Голоса: ВКЛ' : 'Голоса: ВЫКЛ';
    });

    // Camera mode toggle
    const btnCamera = document.getElementById('btn-camera');
    btnCamera.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCamera();
      btnCamera.textContent = this.cameraMode === 'ai' ? 'Камера: AI' : 'Камера: Свободная';
    });

    // Keyboard: C = toggle camera
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' && !e.ctrlKey && !e.altKey) {
        this.toggleCamera();
        btnCamera.textContent = this.cameraMode === 'ai' ? 'Камера: AI' : 'Камера: Свободная';
      }
    });

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
      this.agentManager.fixedUpdate(this.fixedStep, this.sifaRules.prevItAgentId);
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

    // Camera update
    if (this.cameraMode === 'ai') {
      this.smartCamera.update(
        frameDt,
        this.agentManager.agents,
        this.sifaRules.itAgentId,
        this.sifaRules
      );
    } else {
      this.orbitControls.update();
    }

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

  toggleCamera() {
    if (this.cameraMode === 'ai') {
      this.cameraMode = 'free';
      this.smartCamera.setEnabled(false);
      this.orbitControls.enabled = true;
      // Set orbit target to current look-at so transition is smooth
      this.orbitControls.target.copy(this.smartCamera.currentLookAt);
    } else {
      this.cameraMode = 'ai';
      this.orbitControls.enabled = false;
      this.smartCamera.setEnabled(true);
      // Initialize smart camera from current position
      this.smartCamera.currentPos.copy(this.camera.position);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
