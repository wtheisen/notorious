import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private needsInitialPosition = true;

  constructor(domElement: HTMLElement) {
    const aspect = domElement.clientWidth / domElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect || 1, 0.1, 100);

    // Position camera based on viewport aspect ratio:
    // - Portrait phone: nearly top-down so the board fills the narrow width.
    //   Hexes are large enough to tap; user pans to reach action spaces.
    // - Tablet / near-square: moderately overhead, shows most of the board.
    // - Desktop landscape: angled view for depth and drama.
    const pos = CameraController.cameraForAspect(aspect || 1.78);
    this.camera.position.copy(pos);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    // Limits — lower minDistance so mobile users can zoom in close
    this.controls.minDistance = 3;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.2; // don't go below board
    this.controls.maxPolarAngle = Math.PI / 2.3; // don't go fully side-on
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.5;

    this.controls.update();

    // If canvas had real dimensions at construction, position is already set
    if (aspect > 0) this.needsInitialPosition = false;
  }

  private static cameraForAspect(aspect: number): THREE.Vector3 {
    if (aspect < 0.8) {
      // Portrait phone — nearly top-down, zoomed in on the board center
      return new THREE.Vector3(0, 10, 2);
    }
    if (aspect < 1.2) {
      // Tablet / near-square — moderately overhead
      return new THREE.Vector3(0, 9, 4);
    }
    // Desktop landscape — angled view
    return new THREE.Vector3(0, 8, 7);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Apply viewport-aware camera position on the first real resize,
    // since the canvas may have had 0×0 dimensions at construction time.
    if (this.needsInitialPosition && width > 0 && height > 0) {
      this.needsInitialPosition = false;
      const pos = CameraController.cameraForAspect(width / height);
      this.camera.position.copy(pos);
      this.camera.lookAt(0, 0, 0);
      this.controls.update();
    }
  }

  update() {
    this.controls.update();
  }

  dispose() {
    this.controls.dispose();
  }
}
