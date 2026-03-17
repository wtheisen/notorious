import * as THREE from 'three';

const waterVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(pos.x * 2.0 + uTime * 0.8) * 0.03
               + sin(pos.z * 3.0 + uTime * 0.6) * 0.02
               + sin((pos.x + pos.z) * 1.5 + uTime * 1.2) * 0.015;
    pos.y += wave;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vec3 deepColor = vec3(0.25, 0.36, 0.42);
    vec3 shallowColor = vec3(0.33, 0.45, 0.50);
    float mix_factor = smoothstep(-0.03, 0.03, vWave);
    vec3 color = mix(deepColor, shallowColor, mix_factor);

    // Foam-like highlights — warm parchment tint
    float foam = smoothstep(0.02, 0.035, vWave);
    color += vec3(0.15, 0.14, 0.10) * foam;

    gl_FragColor = vec4(color, 0.92);
  }
`;

export class WaterPlane {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geometry = new THREE.CircleGeometry(5.2, 6, Math.PI / 6); // hexagonal, matches board radius
    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -0.02; // just below hex tiles
    this.mesh.userData = { type: 'water' };
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }
}
