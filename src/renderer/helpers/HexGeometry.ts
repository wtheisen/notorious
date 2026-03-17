import { HexCoord } from '../../types/CoordinateTypes';
import * as THREE from 'three';

/**
 * Hex size in 3D world units.
 * This is the outer radius (center to corner).
 */
export const HEX_3D_SIZE = 1.0;

/** Inner radius (center to edge midpoint) */
export const HEX_3D_INNER = HEX_3D_SIZE * Math.sqrt(3) / 2;

/** Spacing between hex centers (flat-top) */
export const HEX_3D_WIDTH = Math.sqrt(3) * HEX_3D_SIZE;
export const HEX_3D_HEIGHT = 2 * HEX_3D_SIZE;

/**
 * Convert axial hex coordinate to 3D world position (x, z plane, y=0).
 * Uses flat-top hex orientation matching the existing 2D layout.
 */
export function hexToWorld(coord: HexCoord): THREE.Vector3 {
  const x = HEX_3D_SIZE * (Math.sqrt(3) * coord.q + Math.sqrt(3) / 2 * coord.r);
  const z = HEX_3D_SIZE * (3 / 2 * coord.r);
  return new THREE.Vector3(x, 0, z);
}

/**
 * Create a flat hexagonal shape (flat-top orientation) for ExtrudeGeometry.
 */
export function createHexShape(size: number = HEX_3D_SIZE): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30; // flat-top: first corner at -30°
    const angleRad = (Math.PI / 180) * angleDeg;
    const x = size * Math.cos(angleRad);
    const y = size * Math.sin(angleRad);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

/**
 * Create extruded hex geometry (thin prism for tiles).
 */
export function createHexGeometry(size: number = HEX_3D_SIZE, depth: number = 0.15): THREE.ExtrudeGeometry {
  const shape = createHexShape(size * 0.97); // slight gap between hexes
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
}
