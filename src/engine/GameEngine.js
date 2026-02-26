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
import { SupervisorBot } from '../game/SupervisorBot.js';
import { GeneSystem } from '../game/GeneSystem.js';
import { EvolutionEffects } from '../renderer/EvolutionEffects.js';
import { StuckDiagnostic } from '../game/StuckDiagnostic.js';

const CAMERA_MODES = ['ai', 'first', 'spectator', 'cycle', 'free'];

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

    // OrbitControls (free camera mode only)
    this.orbitControls = new OrbitControls(this.camera, this.canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.maxPolarAngle = Math.PI / 2.2;
    this.orbitControls.minDistance = 5;
    this.orbitControls.maxDistance = 40;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.enabled = false;

    // Smart camera (all modes except free)
    this.smartCamera = new SmartCamera(this.camera);
    this.cameraModeIndex = 0;

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
    // Supervisor rescue bot
    this.supervisorBot = new SupervisorBot(this.scene);

    // Evolution system
    this.geneSystem = new GeneSystem();
    this.evolutionFx = new EvolutionEffects(this.scene);
    this.sifaRules.geneSystem = this.geneSystem;

    // Stuck diagnostic
    this.stuckDiag = new StuckDiagnostic(this.scene);

    // Initialize genes + effects + diagnostics for each agent
    this.agentManager.agents.forEach(agent => {
      this.geneSystem.initAgent(agent.id);
      this.evolutionFx.initAgent(agent.id, agent.mesh);
      this.stuckDiag.initAgent(agent.id);
      agent.geneSystem = this.geneSystem;
      agent.evolutionFx = this.evolutionFx;
      agent.stuckDiag = this.stuckDiag;
    });

    this.ui = new UIOverlay(this.agentManager, this.sifaRules, this.smartCamera, this.supervisorBot, this.geneSystem);

    // Game loop
    this.fixedStep = 1 / 60;
    this.accumulator = 0;
    this.lastTime = 0;
    this.aiTimer = 0;
    this.AI_INTERVAL = 0.6;

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

    const hint = document.getElementById('start-hint');
    const btnCamera = document.getElementById('btn-camera');

    // Auto-start in cycle mode (first-person auto-switching)
    if (hint) hint.style.display = 'none';
    this.setCameraMode('cycle');
    if (btnCamera) this.updateCameraButton(btnCamera);

    // Auto-start music (Electron allows autoplay, browser may block)
    try { this.music.start(); } catch (_) { /* browser will need click */ }

    // Fallback: start music on first user interaction (for browsers)
    const startAudio = () => {
      this.music.start();
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
    btnCamera.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextCameraMode();
      this.updateCameraButton(btnCamera);
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.altKey) return;

      switch (e.code) {
        // C = next camera mode
        case 'KeyC':
          this.nextCameraMode();
          this.updateCameraButton(btnCamera);
          break;

        // 1-5 = first-person view of specific agent
        case 'Digit1': case 'Digit2': case 'Digit3':
        case 'Digit4': case 'Digit5': {
          const agentId = parseInt(e.code.charAt(5)) - 1;
          this.switchToFirstPerson(agentId);
          this.updateCameraButton(btnCamera);
          break;
        }

        // V = spectator overview
        case 'KeyV':
          this.setCameraMode('spectator');
          this.updateCameraButton(btnCamera);
          break;

        // A = auto-cycle between agents
        case 'KeyA':
          if (this.smartCamera.mode === 'cycle') {
            this.setCameraMode('ai');
          } else {
            this.setCameraMode('cycle');
          }
          this.updateCameraButton(btnCamera);
          break;
      }
    });

    // F11 fullscreen — separate listener to prevent default
    document.addEventListener('keydown', (e) => {
      if (e.code === 'F11') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.toggleFullscreen) {
          window.electronAPI.toggleFullscreen();
        }
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

    // Supervisor bot update
    this.supervisorBot.update(frameDt, this.agentManager.agents);

    // Evolution system + visual effects + stuck diagnostic
    this.geneSystem.update(frameDt);
    this.evolutionFx.update(frameDt);
    this.stuckDiag.update();

    // Camera update
    const mode = this.smartCamera.mode;
    if (mode === 'free') {
      this.orbitControls.update();
    } else {
      this.smartCamera.update(
        frameDt,
        this.agentManager.agents,
        this.sifaRules.itAgentId,
        this.sifaRules
      );
    }

    // Sync music theme to camera's current agent
    const camMode = this.smartCamera.mode;
    if (camMode === 'first' || camMode === 'cycle') {
      this.music.setAgent(this.smartCamera.fpAgentId);
    } else if (camMode === 'ai') {
      this.music.setAgent(this.sifaRules.itAgentId);
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

  // === CAMERA MODE MANAGEMENT ===

  nextCameraMode() {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % CAMERA_MODES.length;
    this.setCameraMode(CAMERA_MODES[this.cameraModeIndex]);
  }

  setCameraMode(mode) {
    const prevMode = this.smartCamera.mode;

    // Disable orbit when leaving free mode
    if (prevMode === 'free') {
      this.orbitControls.enabled = false;
    }

    if (mode === 'free') {
      this.orbitControls.enabled = true;
      this.orbitControls.target.copy(this.smartCamera.currentLookAt);
      this.smartCamera.setMode('free');
    } else {
      this.orbitControls.enabled = false;
      this.smartCamera.setMode(mode);
      // Init position from current camera
      if (prevMode === 'free') {
        this.smartCamera.currentPos.copy(this.camera.position);
      }
    }

    // Sync mode index
    this.cameraModeIndex = CAMERA_MODES.indexOf(mode);
    if (this.cameraModeIndex === -1) this.cameraModeIndex = 0;
  }

  switchToFirstPerson(agentId) {
    this.setCameraMode('first');
    this.smartCamera.setFirstPersonAgent(agentId);
  }

  updateCameraButton(btn) {
    const name = this.smartCamera.getModeName();
    const agentName = this.smartCamera.getFirstPersonAgentName(this.agentManager.agents);
    btn.textContent = agentName ? `${name}: ${agentName}` : name;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
