import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(
      50,
      domElement.clientWidth / domElement.clientHeight,
      0.1,
      100
    );
    // Initial position: looking down at the board at an angle
    this.camera.position.set(0, 8, 7);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    // Limits
    this.controls.minDistance = 4;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.2; // don't go below board
    this.controls.maxPolarAngle = Math.PI / 2.3; // don't go fully side-on
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.5;

    this.controls.update();
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.controls.update();
  }

  dispose() {
    this.controls.dispose();
  }
}
