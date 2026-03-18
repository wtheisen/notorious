import * as THREE from 'three';
import { CameraController } from './CameraController';
import { HexGrid } from './objects/HexGrid';
import { WaterPlane } from './objects/WaterPlane';
import { ActionSpaces } from './objects/ActionSpaces';

export type QualityTier = 'high' | 'low';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly cameraController: CameraController;
  readonly hexGrid: HexGrid;
  readonly water: WaterPlane;
  readonly actionSpaces: ActionSpaces;

  private clock = new THREE.Clock();
  private animationId: number | null = null;
  private onFrameCallbacks: ((dt: number) => void)[] = [];

  constructor(canvas: HTMLCanvasElement, quality: QualityTier = 'high') {
    const isLow = quality === 'low';

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isLow,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLow ? 1.5 : 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    if (isLow) {
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc4b28a);
    this.scene.fog = new THREE.Fog(0xc4b28a, 15, 25);

    // Camera
    this.cameraController = new CameraController(canvas);

    // Lights — warm golden tones for aged map feel
    const ambientLight = new THREE.AmbientLight(0xccaa77, 0.7);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffe8c0, 1.1);
    sunLight.position.set(5, 10, 3);
    if (!isLow) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 25;
      sunLight.shadow.camera.left = -8;
      sunLight.shadow.camera.right = 8;
      sunLight.shadow.camera.top = 8;
      sunLight.shadow.camera.bottom = -8;
    }
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x998866, 0.3);
    fillLight.position.set(-3, 5, -5);
    this.scene.add(fillLight);

    // Hex Grid
    this.hexGrid = new HexGrid();
    this.scene.add(this.hexGrid.group);

    // Water (disabled for now)
    this.water = new WaterPlane();

    // Action spaces (below the board)
    this.actionSpaces = new ActionSpaces();
    this.scene.add(this.actionSpaces.group);

    // Resize handling
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  onFrame(cb: (dt: number) => void) {
    this.onFrameCallbacks.push(cb);
  }

  start() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      const dt = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      this.cameraController.update();
      this.water.update(elapsed);
      this.hexGrid.getWrapGlow().update(elapsed);

      for (const cb of this.onFrameCallbacks) {
        cb(dt);
      }

      this.renderer.render(this.scene, this.cameraController.camera);
    };
    animate();
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private handleResize() {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.cameraController.resize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.cameraController.dispose();
    this.renderer.dispose();
  }
}
