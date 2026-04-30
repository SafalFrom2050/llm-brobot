import * as THREE from "three";
import { DEFAULT_ACTION, normalizeRobotAction } from "./robotSchema.js";

const DEG_TO_RAD = Math.PI / 180;
const FACE_GOLD = "#f4a51c";
const FACE_GOLD_LIGHT = "#ffc13b";
const FACE_ORANGE = "#dd6f13";
const FACE_INK = "#241509";
const EYE_RED = "#d43222";
const EYE_RED_HOT = "#ff5a32";

const MOOD_COLORS = {
  curious: "#d43222",
  joy: "#ff5a32",
  shy: "#ff9db5",
  sleepy: "#b8281d",
  worried: "#c84332",
  surprised: "#ff6f38",
  focused: "#ff3f2e",
  loving: "#ff7aa2",
  confused: "#dd3a2a",
  proud: "#ffb21f"
};

export class RobotScene {
  constructor(container) {
    this.container = container;
    this.startTime = performance.now();
    this.action = normalizeRobotAction(DEFAULT_ACTION);
    this.target = this.action;
    this.speaking = false;
    this.dragging = false;
    this.presentationYaw = 0;
    this.presentationPitch = 0;
    this.motionStart = 0;
    this.motionDuration = 0.9;
    this.blinkUntil = 0;
    this.blinkMode = "soft";
    this.swirlMeshes = [];
    this.sparkleDots = [];

    this.initThree();
    this.createRobot();
    this.bindEvents();
    this.applyAction(this.action);
    this.animate();
  }

  applyAction(nextAction) {
    this.target = normalizeRobotAction(nextAction, this.action);
    this.action = this.target;
    this.motionStart = this.getElapsedTime();
    this.motionDuration = Math.max(0.35, this.action.neck.duration_ms / 1000);

    if (this.action.eyes.blink !== "none") {
      const blinkLength = this.action.eyes.blink === "long" ? 0.56 : 0.28;
      this.blinkUntil = this.getElapsedTime() + blinkLength;
      this.blinkMode = this.action.eyes.blink;
    }

    this.updateFaceTexture();
    this.updateEnvironment(this.getElapsedTime());
  }

  setSpeaking(isSpeaking) {
    this.speaking = Boolean(isSpeaking);
  }

  resetView() {
    this.presentationYaw = 0;
    this.presentationPitch = 0;
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#101113");

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0, 1.42, 5.15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.keyLight = new THREE.DirectionalLight("#fff0d4", 2.2);
    this.keyLight.position.set(2.5, 4.4, 4.4);
    this.keyLight.castShadow = true;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight("#4cf6ff", "#1b1611", 1.25);
    this.scene.add(this.fillLight);

    this.envLight = new THREE.PointLight("#10dff2", 4.2, 7.5);
    this.envLight.position.set(-1.6, 1.7, 2.25);
    this.scene.add(this.envLight);

    this.rimLight = new THREE.PointLight("#10dff2", 3.4, 7.5);
    this.rimLight.position.set(2.2, 1.4, -1.2);
    this.scene.add(this.rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 96),
      new THREE.MeshStandardMaterial({
        color: "#181a18",
        roughness: 0.86,
        metalness: 0.03
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 96),
      new THREE.MeshBasicMaterial({
        color: "#10dff2",
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.y = -0.075;
    this.scene.add(this.floorGlow);

    this.presentationGroup = new THREE.Group();
    this.scene.add(this.presentationGroup);

    this.resize();
  }

  createRobot() {
    this.robotRoot = new THREE.Group();
    this.robotRoot.position.y = 0.08;
    this.presentationGroup.add(this.robotRoot);

    this.createAmbientSwirl();

    const hoodMaterial = new THREE.MeshPhysicalMaterial({
      color: "#111315",
      roughness: 0.38,
      metalness: 0.04,
      clearcoat: 0.45,
      clearcoatRoughness: 0.5
    });

    const neckMaterial = new THREE.MeshStandardMaterial({
      color: "#161919",
      roughness: 0.58,
      metalness: 0.16
    });

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#25282a",
      roughness: 0.54,
      metalness: 0.12
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 0.18, 72), baseMaterial);
    base.position.y = 0.05;
    base.castShadow = true;
    base.receiveShadow = true;
    this.robotRoot.add(base);

    const footGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.63, 0.018, 12, 96),
      new THREE.MeshBasicMaterial({
        color: "#10dff2",
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending
      })
    );
    footGlow.rotation.x = Math.PI / 2;
    footGlow.position.y = 0.17;
    this.robotRoot.add(footGlow);
    this.swirlMeshes.push(footGlow);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.52, 42), neckMaterial);
    neck.position.y = 0.43;
    neck.castShadow = true;
    this.robotRoot.add(neck);

    this.facePivot = new THREE.Group();
    this.facePivot.position.set(0, 1.18, 0);
    this.robotRoot.add(this.facePivot);

    const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 48), hoodMaterial);
    hood.scale.set(1.24, 1.2, 0.36);
    hood.castShadow = true;
    hood.receiveShadow = true;
    this.facePivot.add(hood);

    const hoodRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.032, 16, 128),
      new THREE.MeshBasicMaterial({
        color: "#0ccfe4",
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending
      })
    );
    hoodRim.scale.set(1.09, 1.02, 1);
    hoodRim.position.z = 0.29;
    this.facePivot.add(hoodRim);
    this.swirlMeshes.push(hoodRim);

    this.createFaceCanvas();
    this.createForeheadAntenna();
    this.createEars();
    this.createCyanSweep();
  }

  createFaceCanvas() {
    const faceMaterial = new THREE.MeshPhysicalMaterial({
      color: FACE_GOLD_LIGHT,
      roughness: 0.48,
      metalness: 0.02,
      clearcoat: 0.42,
      clearcoatRoughness: 0.54,
      emissive: "#8f3a05",
      emissiveIntensity: 0.12
    });

    const faceShell = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 48), faceMaterial);
    faceShell.scale.set(0.78, 0.6, 0.13);
    faceShell.position.set(0, -0.04, 0.39);
    faceShell.castShadow = true;
    faceShell.receiveShadow = true;
    this.facePivot.add(faceShell);

    const lowerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 32),
      new THREE.MeshBasicMaterial({
        color: FACE_ORANGE,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    lowerGlow.scale.set(0.64, 0.22, 0.02);
    lowerGlow.position.set(0.08, -0.3, 0.525);
    this.facePivot.add(lowerGlow);

    const shine = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 48),
      new THREE.MeshBasicMaterial({
        color: "#ffd765",
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      })
    );
    shine.scale.set(1.42, 0.48, 1);
    shine.position.set(-0.25, 0.24, 0.537);
    shine.rotation.z = -0.2;
    this.facePivot.add(shine);

    this.faceCanvas = document.createElement("canvas");
    this.faceCanvas.width = 900;
    this.faceCanvas.height = 700;
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;

    const faceMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.18),
      new THREE.MeshBasicMaterial({
        map: this.faceTexture,
        transparent: true,
        depthWrite: false
      })
    );
    faceMesh.position.set(0, -0.04, 0.545);
    this.facePivot.add(faceMesh);
  }

  createForeheadAntenna() {
    const capMaterial = new THREE.MeshPhysicalMaterial({
      color: "#ff7542",
      roughness: 0.46,
      metalness: 0.02,
      clearcoat: 0.32,
      clearcoatRoughness: 0.48,
      emissive: "#b83619",
      emissiveIntensity: 0.18
    });
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#c5721e",
      roughness: 0.5,
      metalness: 0.04
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.035, 24), baseMaterial);
    base.position.set(-0.37, 0.37, 0.552);
    base.rotation.set(Math.PI / 2, 0.08, -0.34);
    this.facePivot.add(base);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 32, 18), capMaterial);
    cap.scale.set(1.48, 0.72, 0.32);
    cap.position.set(-0.41, 0.41, 0.585);
    cap.rotation.z = -0.28;
    cap.castShadow = false;
    this.facePivot.add(cap);
  }

  createEars() {
    const earMaterial = new THREE.MeshStandardMaterial({
      color: FACE_GOLD,
      roughness: 0.45,
      metalness: 0.02
    });
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: FACE_ORANGE,
      roughness: 0.62,
      metalness: 0.02
    });

    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.033, 14, 40), earMaterial);
      ear.position.set(side * 0.82, -0.14, 0.39);
      ear.rotation.y = side * 0.18;
      ear.castShadow = true;
      this.facePivot.add(ear);

      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 12), innerMaterial);
      inner.position.set(side * 0.82, -0.14, 0.405);
      inner.scale.set(1, 0.72, 0.28);
      this.facePivot.add(inner);
    });
  }

  createCyanSweep() {
    const sweepMaterial = new THREE.MeshBasicMaterial({
      color: "#10dff2",
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sweep = createArcTube(1.18, 1.03, -1.05, 1.08, 0.43, 0.018, sweepMaterial);
    sweep.rotation.z = -0.28;
    this.facePivot.add(sweep);
    this.swirlMeshes.push(sweep);

    const accentMaterial = new THREE.MeshBasicMaterial({
      color: "#1167ff",
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const accent = createArcTube(1.26, 1.1, -0.88, 0.88, 0.4, 0.011, accentMaterial);
    accent.rotation.z = -0.36;
    this.facePivot.add(accent);
    this.swirlMeshes.push(accent);
  }

  createAmbientSwirl() {
    this.ambientGroup = new THREE.Group();
    this.ambientGroup.position.set(0, 1.16, -0.18);
    this.robotRoot.add(this.ambientGroup);

    const ringData = [
      { rx: 1.7, ry: 1.35, start: -2.7, end: 0.95, z: -0.12, width: 0.018, color: "#10dff2", opacity: 0.58 },
      { rx: 1.92, ry: 1.48, start: -0.15, end: 2.48, z: -0.24, width: 0.012, color: "#1167ff", opacity: 0.44 },
      { rx: 1.54, ry: 1.22, start: 1.78, end: 4.8, z: -0.18, width: 0.01, color: "#59f8ff", opacity: 0.34 }
    ];

    ringData.forEach((ring) => {
      const material = new THREE.MeshBasicMaterial({
        color: ring.color,
        transparent: true,
        opacity: ring.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const arc = createArcTube(ring.rx, ring.ry, ring.start, ring.end, ring.z, ring.width, material);
      this.ambientGroup.add(arc);
      this.swirlMeshes.push(arc);
    });

    const dotGeometry = new THREE.SphereGeometry(0.025, 14, 8);
    for (let index = 0; index < 18; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? "#ffb21f" : "#10dff2",
        transparent: true,
        opacity: 0.54,
        blending: THREE.AdditiveBlending
      });
      const dot = new THREE.Mesh(dotGeometry, material);
      dot.userData = { index };
      this.sparkleDots.push(dot);
      this.ambientGroup.add(dot);
    }
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    this.renderer.domElement.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.renderer.domElement.setPointerCapture(event.pointerId);
    });

    this.renderer.domElement.addEventListener("pointermove", (event) => {
      if (!this.dragging || !this.lastPointer) {
        return;
      }
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.presentationYaw += dx * 0.006;
      this.presentationPitch = clamp(this.presentationPitch + dy * 0.003, -0.16, 0.2);
      this.lastPointer = { x: event.clientX, y: event.clientY };
    });

    this.renderer.domElement.addEventListener("pointerup", (event) => {
      this.dragging = false;
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(360, rect.height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const elapsed = this.getElapsedTime();
    this.updateMotion(elapsed);
    this.updateEnvironment(elapsed);
    this.updateFaceTexture(elapsed);
    this.renderer.render(this.scene, this.camera);
  }

  updateMotion(elapsed) {
    const action = this.action;
    const duration = Math.max(0.25, this.motionDuration);
    const rawPhase = clamp((elapsed - this.motionStart) / duration, 0, 1);
    const phase = easeInOutSine(rawPhase);
    const wave = Math.sin(rawPhase * Math.PI * 2);
    const wave2 = Math.sin(rawPhase * Math.PI * 4);
    const wave3 = Math.sin(rawPhase * Math.PI * 6);
    const softStop = Math.sin(rawPhase * Math.PI);
    const idleBreath = Math.sin(elapsed * 1.15);
    const idleSway = Math.sin(elapsed * 0.62);

    let yaw = action.neck.yaw * DEG_TO_RAD;
    let pitch = action.neck.pitch * DEG_TO_RAD;
    let roll = action.neck.roll * DEG_TO_RAD;
    let x = 0;
    let y = 0.08;
    let z = 0;
    let squashX = 1;
    let squashY = 1;

    yaw += idleSway * 0.012;
    pitch += idleBreath * 0.01;
    roll += Math.sin(elapsed * 0.48 + 1.6) * 0.008;
    y += idleBreath * 0.012;

    switch (action.neck.motion) {
      case "nod":
        pitch += Math.sin(rawPhase * Math.PI * 4) * 0.16 * (1 - rawPhase * 0.2);
        y += Math.max(0, Math.sin(rawPhase * Math.PI * 4)) * 0.025;
        break;
      case "shake":
        yaw += wave3 * 0.18 * (1 - rawPhase * 0.15);
        roll += wave3 * -0.035;
        break;
      case "peek_left":
        yaw += -0.26 * softStop;
        roll += -0.14 * softStop;
        x += -0.06 * softStop;
        break;
      case "peek_right":
        yaw += 0.26 * softStop;
        roll += 0.14 * softStop;
        x += 0.06 * softStop;
        break;
      case "nuzzle":
        yaw += Math.sin(rawPhase * Math.PI * 3) * 0.1;
        pitch += 0.08 * softStop;
        roll += Math.sin(rawPhase * Math.PI * 2) * 0.12;
        z += 0.07 * softStop;
        break;
      case "bounce":
        y += Math.max(0, Math.sin(rawPhase * Math.PI * 3)) * 0.08 * (1 - rawPhase * 0.25);
        pitch += wave * 0.07;
        squashX += Math.max(0, -wave) * 0.025;
        squashY -= Math.max(0, -wave) * 0.02;
        break;
      case "listen_scan":
        yaw += Math.sin(elapsed * 1.55) * 0.18;
        pitch += Math.sin(elapsed * 0.95) * 0.035;
        roll += Math.sin(elapsed * 1.25) * 0.025;
        break;
      case "tilt_left":
        roll += -0.22 * phase;
        yaw += -0.07 * phase;
        break;
      case "tilt_right":
        roll += 0.22 * phase;
        yaw += 0.07 * phase;
        break;
      case "shy_sway":
        yaw += -0.2 * softStop + wave2 * 0.045;
        roll += -0.18 * softStop + wave * 0.05;
        pitch += -0.045 * softStop;
        x += -0.045 * softStop + wave * 0.018;
        break;
      case "excited_wiggle":
        yaw += wave3 * 0.105;
        roll += wave2 * 0.12;
        pitch += Math.abs(wave3) * 0.045;
        y += Math.abs(wave3) * 0.055;
        squashX += Math.abs(wave2) * 0.03;
        squashY -= Math.abs(wave2) * 0.02;
        break;
      case "startle_pop":
        {
          const pop = Math.sin(rawPhase * Math.PI);
          const recoil = Math.sin(rawPhase * Math.PI * 0.65);
          pitch += -0.18 * pop;
          y += 0.14 * pop;
          z += -0.1 * recoil;
          roll += wave2 * 0.06;
          squashX += pop * 0.04;
          squashY += pop * 0.03;
        }
        break;
      case "sleepy_drift":
        pitch += -0.12 * phase + Math.sin(elapsed * 0.8) * 0.025;
        roll += 0.1 * Math.sin(elapsed * 0.42 + 0.7);
        yaw += 0.04 * Math.sin(elapsed * 0.52);
        y += -0.035 * phase + Math.sin(elapsed * 0.7) * 0.012;
        break;
      case "lean_in":
        pitch += 0.12 * phase + Math.sin(rawPhase * Math.PI * 2) * 0.025;
        z += 0.12 * phase;
        y += 0.025 * phase;
        break;
      case "lean_back":
        pitch += -0.1 * phase;
        z += -0.12 * phase;
        y += 0.025 * softStop;
        roll += Math.sin(rawPhase * Math.PI * 2) * 0.035;
        break;
      case "curious_loop":
        yaw += Math.sin(rawPhase * Math.PI * 2) * 0.18 * softStop;
        pitch += Math.cos(rawPhase * Math.PI * 2) * 0.075 * softStop;
        roll += Math.sin(rawPhase * Math.PI * 2 + Math.PI / 3) * 0.08 * softStop;
        x += Math.sin(rawPhase * Math.PI * 2) * 0.035 * softStop;
        y += Math.cos(rawPhase * Math.PI * 2) * 0.025 * softStop;
        break;
      default:
        break;
    }

    this.facePivot.rotation.y = damp(this.facePivot.rotation.y, yaw, 0.16);
    this.facePivot.rotation.x = damp(this.facePivot.rotation.x, pitch, 0.16);
    this.facePivot.rotation.z = damp(this.facePivot.rotation.z, roll, 0.16);
    this.robotRoot.position.x = damp(this.robotRoot.position.x, x, 0.18);
    this.robotRoot.position.y = damp(this.robotRoot.position.y, y, 0.18);
    this.robotRoot.position.z = damp(this.robotRoot.position.z, z, 0.18);
    this.robotRoot.scale.x = damp(this.robotRoot.scale.x, squashX, 0.2);
    this.robotRoot.scale.y = damp(this.robotRoot.scale.y, squashY, 0.2);
    this.robotRoot.scale.z = damp(this.robotRoot.scale.z, 1, 0.2);
    this.presentationGroup.rotation.y = damp(this.presentationGroup.rotation.y, this.presentationYaw, 0.18);
    this.presentationGroup.rotation.x = damp(this.presentationGroup.rotation.x, this.presentationPitch, 0.18);
  }

  updateEnvironment(elapsed) {
    const { pattern, primary_color, secondary_color, intensity, speed } = this.action.environment;
    const primary = new THREE.Color(primary_color);
    const secondary = new THREE.Color(secondary_color);
    const tempo = 0.22 + speed * 1.9;
    const pulse = (Math.sin(elapsed * tempo * Math.PI * 2) + 1) / 2;
    const calm = 0.35 + intensity * 0.65;

    this.envLight.color.copy(primary);
    this.envLight.intensity = 1.2 + calm * 4.5 + pulse * intensity * 1.4;
    this.rimLight.color.copy(pattern === "warm_orbit" || pattern === "blush" ? secondary : primary);
    this.rimLight.intensity = 1.0 + calm * 3.2;
    this.fillLight.color.copy(primary);
    this.floorGlow.material.color.copy(primary);
    this.floorGlow.material.opacity = clamp(0.08 + intensity * 0.34 + pulse * 0.08, 0.06, 0.58);

    const spin = elapsed * (0.12 + speed * 0.52);
    this.ambientGroup.rotation.z = spin * (pattern === "moon_drift" ? -0.32 : 1);
    this.ambientGroup.scale.setScalar(0.94 + pulse * 0.05 + intensity * 0.06);

    this.swirlMeshes.forEach((mesh, index) => {
      const material = mesh.material;
      const hueShift = (index + elapsed * speed * 0.12) % 2;
      material.color.copy(hueShift > 1 ? secondary : primary);

      if (pattern === "solid") {
        material.opacity = 0.16 + intensity * 0.22;
      } else if (pattern === "soft_glow") {
        material.opacity = 0.22 + pulse * 0.18 + intensity * 0.18;
      } else if (pattern === "warm_orbit") {
        material.color.copy(index % 2 === 0 ? secondary : primary);
        material.opacity = 0.3 + pulse * 0.3 + intensity * 0.2;
      } else if (pattern === "thinking_orbit") {
        material.opacity = (index + Math.floor(elapsed * 2.2)) % 2 === 0 ? 0.64 : 0.18;
      } else if (pattern === "sparkle") {
        material.opacity = fract(Math.sin(index * 19.27 + elapsed * 5.1) * 438.41) > 0.55 ? 0.76 : 0.18;
      } else if (pattern === "comet") {
        material.opacity = index === Math.floor(elapsed * 3) % this.swirlMeshes.length ? 0.92 : 0.22;
      } else if (pattern === "blush") {
        material.color.copy(secondary);
        material.opacity = 0.24 + pulse * 0.3 + intensity * 0.18;
      } else if (pattern === "moon_drift") {
        material.opacity = 0.16 + pulse * 0.12 + intensity * 0.16;
      } else {
        material.opacity = 0.34 + pulse * 0.28 + intensity * 0.22;
      }
    });

    this.sparkleDots.forEach((dot) => {
      const index = dot.userData.index;
      const angle = elapsed * (0.26 + speed * 0.7) + index * 0.47;
      const radius = 1.28 + (index % 5) * 0.08;
      dot.position.set(Math.cos(angle) * radius, Math.sin(angle) * (0.98 + (index % 3) * 0.07), -0.02 + (index % 4) * 0.035);
      dot.material.color.copy(index % 4 === 0 ? secondary : primary);
      dot.material.opacity = pattern === "sparkle"
        ? 0.25 + fract(Math.sin(index * 12.99 + elapsed * 7.8) * 437.58) * 0.72
        : 0.1 + intensity * 0.26;
      dot.scale.setScalar(0.8 + pulse * 0.35 + (index % 3) * 0.08);
    });
  }

  updateFaceTexture(elapsed = this.getElapsedTime()) {
    const blinkOpenness = this.getBlinkOpenness(elapsed);
    drawFace(this.faceCanvas, this.action, blinkOpenness, elapsed, this.speaking);
    this.faceTexture.needsUpdate = true;
  }

  getBlinkOpenness(elapsed) {
    if (elapsed >= this.blinkUntil) {
      return Math.sin(elapsed * 0.82) > 0.995 ? 0.35 : 1;
    }

    const remaining = this.blinkUntil - elapsed;
    const length = this.blinkMode === "long" ? 0.56 : 0.28;
    const progress = clamp(1 - remaining / length, 0, 1);
    const closure = Math.sin(progress * Math.PI);
    return this.blinkMode === "double" ? 1 - Math.pow(closure, 2) * 0.85 : 1 - closure * 0.92;
  }

  getElapsedTime() {
    return (performance.now() - this.startTime) / 1000;
  }
}

function drawFace(canvas, action, blinkOpenness, elapsed, speaking) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const moodColor = MOOD_COLORS[action.eyes.mood] || "#10dff2";

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  roundedRect(ctx, 160, 118, 580, 440, 205);
  ctx.clip();

  ctx.fillStyle = "rgba(255, 228, 112, 0.09)";
  ctx.beginPath();
  ctx.ellipse(330, 184, 136, 44, -0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(144, 58, 10, 0.22)";
  ctx.beginPath();
  ctx.ellipse(520, 610, 250, 95, -0.08, 0, Math.PI * 2);
  ctx.fill();

  drawCheeks(ctx, action, elapsed);
  drawEyes(ctx, action, blinkOpenness, elapsed, moodColor);
  drawMouth(ctx, action, elapsed, speaking);

  ctx.restore();

  ctx.globalAlpha = 1;
}

function drawCheeks(ctx, action, elapsed) {
  const blush = action.eyes.mood === "shy" || action.eyes.mood === "loving" ? 0.5 : 0.22;
  const pulse = (Math.sin(elapsed * 2.2) + 1) / 2;
  ctx.fillStyle = `rgba(255, 104, 102, ${blush + pulse * 0.08})`;
  ctx.beginPath();
  ctx.ellipse(284, 372, 54, 22, -0.12, 0, Math.PI * 2);
  ctx.ellipse(616, 372, 54, 22, 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyes(ctx, action, blinkOpenness, elapsed, moodColor) {
  const eye = action.eyes;
  const lidOpen = clamp(eye.lid_open * blinkOpenness, 0.04, 1);
  const y = 286 + eye.gaze_y * 30;
  const leftX = 338 + eye.gaze_x * 34;
  const rightX = 562 + eye.gaze_x * 34;
  const scale = eye.pupil_scale;

  drawBrow(ctx, leftX, y, -1, eye.mood, lidOpen);
  drawBrow(ctx, rightX, y, 1, eye.mood, lidOpen);
  drawSingleEye(ctx, leftX, y, -1, eye, lidOpen, scale, moodColor, elapsed);
  drawSingleEye(ctx, rightX, y, 1, eye, lidOpen, scale, moodColor, elapsed);
}

function drawBrow(ctx, x, y, side, mood, lidOpen) {
  ctx.save();
  ctx.strokeStyle = "rgba(74, 29, 10, 0.76)";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();

  const tilt = mood === "worried" ? side * 22 : mood === "focused" ? -side * 18 : mood === "surprised" ? -10 : 0;
  const lift = mood === "surprised" ? -52 : -34 + (1 - lidOpen) * 12;
  ctx.moveTo(x - 54, y + lift + tilt * 0.22);
  ctx.quadraticCurveTo(x, y + lift - 12, x + 54, y + lift - tilt * 0.22);
  ctx.stroke();
  ctx.restore();
}

function drawSingleEye(ctx, x, y, side, eye, lidOpen, scale, moodColor, elapsed) {
  const wide = eye.shape === "wide" || eye.mood === "surprised";
  const droopy = eye.shape === "droopy" || eye.mood === "sleepy" || eye.shape === "soft_arc";
  const eyeWidth = (wide ? 86 : 76) * scale;
  const eyeHeight = (wide ? 58 : 48) * scale;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (eye.shape === "heart") {
    drawHeart(ctx, x, y + 4, 56 * scale, "#2a150b");
    drawHeart(ctx, x + side * 6, y, 36 * scale, "#ff5f8d");
    ctx.restore();
    return;
  }

  if (eye.shape === "starry") {
    drawStar(ctx, x, y, 58 * scale, "#2a150b");
    drawSpark(ctx, x - side * 34, y - 30, 12, moodColor);
    ctx.restore();
    return;
  }

  if (eye.shape === "spiral") {
    ctx.strokeStyle = "#2a150b";
    ctx.lineWidth = 13;
    ctx.beginPath();
    for (let index = 0; index < 76; index += 1) {
      const angle = index * 0.34;
      const radius = index * 0.62;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (eye.shape === "pixel") {
    ctx.fillStyle = "#2a150b";
    const size = 28;
    for (let row = -1; row <= 1; row += 1) {
      for (let col = -1; col <= 1; col += 1) {
        if (Math.abs(col) !== 1 || row !== -1) {
          ctx.fillRect(x + col * size - size / 2, y + row * size - size / 2, size - 4, size - 4);
        }
      }
    }
    ctx.restore();
    return;
  }

  if (droopy || lidOpen < 0.38) {
    const sleepyDip = 8 + (1 - lidOpen) * 18;
    ctx.strokeStyle = "#2a150b";
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(x - eyeWidth, y - 2);
    ctx.quadraticCurveTo(x, y + sleepyDip, x + eyeWidth, y - 2);
    ctx.stroke();

    ctx.strokeStyle = EYE_RED_HOT;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - eyeWidth * 0.68, y + 5);
    ctx.quadraticCurveTo(x, y + sleepyDip + 8, x + eyeWidth * 0.68, y + 5);
    ctx.stroke();

    if (lidOpen > 0.18) {
      ctx.fillStyle = EYE_RED;
      ctx.globalAlpha = clamp(lidOpen * 1.4, 0.28, 0.74);
      ctx.beginPath();
      ctx.ellipse(x - side * 8, y + 4, 22 * scale, 7 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#2a150b";
  ctx.beginPath();
  ctx.ellipse(x, y, eyeWidth, eyeHeight * lidOpen, 0, 0, Math.PI * 2);
  ctx.fill();

  const irisRadius = 17 * scale * (wide ? 1.15 : 1);
  const irisGradient = ctx.createRadialGradient(x - side * 8, y - 2, 2, x - side * 8, y - 2, irisRadius);
  irisGradient.addColorStop(0, "#ffcc68");
  irisGradient.addColorStop(0.42, moodColor);
  irisGradient.addColorStop(1, "#8f150f");
  ctx.fillStyle = irisGradient;
  ctx.beginPath();
  ctx.arc(x - side * 8, y - 2, irisRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.beginPath();
  ctx.arc(x - side * 20, y - 16, 7 + Math.sin(elapsed * 3 + side) * 1.5, 0, Math.PI * 2);
  ctx.fill();

  if (lidOpen < 0.82) {
    ctx.fillStyle = FACE_GOLD;
    ctx.fillRect(x - eyeWidth - 20, y - eyeHeight - 26, eyeWidth * 2 + 40, (1 - lidOpen) * eyeHeight * 1.2);
  }

  ctx.restore();
}

function drawMouth(ctx, action, elapsed, speaking) {
  const mouth = action.mouth;
  const talk = speaking && mouth.sync_to_voice ? (Math.sin(elapsed * 18) + 1) * 0.5 : 0;
  const openness = clamp(mouth.openness + talk * 0.42, 0, 1);
  const x = 450;
  const y = 424;

  ctx.save();
  ctx.strokeStyle = FACE_INK;
  ctx.fillStyle = FACE_INK;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (mouth.shape === "small_o") {
    ctx.beginPath();
    ctx.ellipse(x, y, 28 + openness * 10, 18 + openness * 38, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mouth.shape === "open_smile") {
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 58, 18 + openness * 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd66b";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y - 12, 58, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  } else if (mouth.shape === "tiny_w") {
    ctx.beginPath();
    ctx.moveTo(x - 58, y - 4);
    ctx.quadraticCurveTo(x - 26, y + 18 + openness * 12, x, y + 2);
    ctx.quadraticCurveTo(x + 26, y + 18 + openness * 12, x + 58, y - 4);
    ctx.stroke();
  } else if (mouth.shape === "flat") {
    ctx.beginPath();
    ctx.moveTo(x - 52, y);
    ctx.lineTo(x + 52, y);
    ctx.stroke();
  } else if (mouth.shape === "frown" || mouth.shape === "wobble") {
    const wobble = mouth.shape === "wobble" ? Math.sin(elapsed * 12) * 8 : 0;
    ctx.beginPath();
    ctx.moveTo(x - 52, y + 14);
    ctx.quadraticCurveTo(x, y - 24 + wobble, x + 52, y + 14);
    ctx.stroke();
  } else if (mouth.shape === "tongue") {
    ctx.beginPath();
    ctx.arc(x, y - 12, 58, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "#ff7aa2";
    ctx.beginPath();
    ctx.ellipse(x + 28, y + 25, 18, 12 + openness * 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y - 26, 62, 0.22 * Math.PI, 0.78 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

function createArcTube(rx, ry, start, end, z, tubeRadius, material) {
  const points = [];
  const steps = 96;
  for (let index = 0; index <= steps; index += 1) {
    const t = start + (end - start) * (index / steps);
    points.push(new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, steps, tubeRadius, 10, false), material);
}

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.38);
  ctx.bezierCurveTo(x - size, y - size * 0.24, x - size * 0.45, y - size, x, y - size * 0.43);
  ctx.bezierCurveTo(x + size * 0.45, y - size, x + size, y - size * 0.24, x, y + size * 0.38);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, x, y, radius, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpark(ctx, x, y, radius, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - radius, y);
  ctx.lineTo(x + radius, y);
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x, y + radius);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function damp(current, target, factor) {
  return current + (target - current) * factor;
}

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fract(value) {
  return value - Math.floor(value);
}
