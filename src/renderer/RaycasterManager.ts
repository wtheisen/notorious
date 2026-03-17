import * as THREE from 'three';
import { HexCoord, hexToKey } from '../types/CoordinateTypes';
import { HexGrid } from './objects/HexGrid';
import { ActionSpaces } from './objects/ActionSpaces';
import { ActionType } from '../types/GameTypes';

export interface DragEvent {
  fromCoord: HexCoord;
  toCoord: HexCoord | null;
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08); // y=0.08 ship level

export class RaycasterManager {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private camera: THREE.Camera;
  private hexGrid: HexGrid;
  private actionSpaces: ActionSpaces | null = null;
  private canvas: HTMLCanvasElement;

  private onHexClick: ((coord: HexCoord) => void) | null = null;
  private onHexHover: ((coord: HexCoord | null) => void) | null = null;
  private onDragStart: ((coord: HexCoord) => void) | null = null;
  private onDragMove: ((from: HexCoord, to: HexCoord | null, worldPos: THREE.Vector3) => void) | null = null;
  private onDragEnd: ((from: HexCoord, to: HexCoord | null) => void) | null = null;
  private canDrag: ((coord: HexCoord) => boolean) | null = null;
  private onActionSpaceClick: ((action: ActionType) => void) | null = null;

  private lastHoveredKey: string | null = null;
  private lastHoverBorderKey: string | null = null;
  private dragFrom: HexCoord | null = null;
  private isDragging = false;
  private wantsDrag = false; // true if mousedown was on a draggable hex
  private mouseDownPos: { x: number; y: number } | null = null;
  private dragThreshold = 8;

  constructor(camera: THREE.Camera, hexGrid: HexGrid, scene: THREE.Scene, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.hexGrid = hexGrid;
    this.canvas = canvas;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    // Use capture phase so we fire before OrbitControls and can suppress it
    canvas.addEventListener('mousedown', this.handleMouseDown, true);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);
  }

  setOnHexClick(cb: (coord: HexCoord) => void) { this.onHexClick = cb; }
  setOnHexHover(cb: (coord: HexCoord | null) => void) { this.onHexHover = cb; }
  setOnDragStart(cb: (coord: HexCoord) => void) { this.onDragStart = cb; }
  setCanDrag(cb: (coord: HexCoord) => boolean) { this.canDrag = cb; }
  setActionSpaces(spaces: ActionSpaces) { this.actionSpaces = spaces; }
  setOnActionSpaceClick(cb: (action: ActionType) => void) { this.onActionSpaceClick = cb; }
  setOnDragMove(cb: (from: HexCoord, to: HexCoord | null, worldPos: THREE.Vector3) => void) { this.onDragMove = cb; }
  setOnDragEnd(cb: (from: HexCoord, to: HexCoord | null) => void) { this.onDragEnd = cb; }

  /** Programmatically set highlights (used by drag callbacks) */
  setHighlights(keys: string[], type: 'valid' | 'selected' | 'hover' | 'none') {
    for (const key of keys) {
      this.hexGrid.setHighlight(key, type);
    }
  }

  clearHighlights() {
    this.hexGrid.clearAllHighlights();
    this.lastHoveredKey = null;
  }

  private updateMouse(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastHex(): HexCoord | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hexGrid.getMeshes());
    if (intersects.length > 0) {
      return intersects[0].object.userData.coord as HexCoord ?? null;
    }
    return null;
  }

  /** Raycast to the ground plane to get a world-space XZ position */
  private raycastGround(): THREE.Vector3 {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, target);
    return target;
  }

  private clickedActionSpace = false;

  private handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    this.updateMouse(event);
    this.mouseDownPos = { x: event.clientX, y: event.clientY };
    this.isDragging = false;
    this.wantsDrag = false;
    this.clickedActionSpace = false;

    // Check action spaces first
    if (this.actionSpaces) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.actionSpaces.getPlatformMeshes());
      if (hits.length > 0) {
        this.clickedActionSpace = true;
        return;
      }
    }

    const coord = this.raycastHex();
    if (coord) {
      this.dragFrom = coord;
      if (this.canDrag?.(coord)) {
        this.wantsDrag = true;
        event.stopImmediatePropagation();
      }
    }
  }

  private handleMouseMove(event: MouseEvent) {
    this.updateMouse(event);
    const coord = this.raycastHex();

    // Check if we've crossed the drag threshold
    if (this.dragFrom && this.mouseDownPos && !this.isDragging) {
      const dx = event.clientX - this.mouseDownPos.x;
      const dy = event.clientY - this.mouseDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
        this.isDragging = true;
        this.onDragStart?.(this.dragFrom);
      }
    }

    // During drag - notify with world position and highlight drop target
    if (this.isDragging && this.dragFrom) {
      const worldPos = this.raycastGround();
      this.onDragMove?.(this.dragFrom, coord, worldPos);

      // Highlight hovered hex during drag with gold border
      const newKey = coord ? hexToKey(coord) : null;
      if (newKey !== this.lastHoveredKey) {
        if (this.lastHoveredKey) {
          this.hexGrid.setHighlight(this.lastHoveredKey, 'valid');
        }
        if (newKey) {
          this.hexGrid.setHighlight(newKey, 'hover');
        }
        this.lastHoveredKey = newKey;
      }
      // Gold border ring on hovered hex during drag
      if (newKey !== this.lastHoverBorderKey) {
        if (this.lastHoverBorderKey) {
          this.hexGrid.getTile(this.lastHoverBorderKey)?.setHoverBorder(false);
        }
        if (newKey) {
          this.hexGrid.getTile(newKey)?.setHoverBorder(true);
        }
        this.lastHoverBorderKey = newKey;
      }
      return;
    }

    // Check action space hover
    if (this.actionSpaces) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const actionHits = this.raycaster.intersectObjects(this.actionSpaces.getPlatformMeshes());
      const hoveredAction = actionHits.length > 0
        ? this.actionSpaces.getActionFromMesh(actionHits[0].object)
        : null;
      this.actionSpaces.updateHover(hoveredAction);
    }

    // Normal hex hover (not dragging)
    const newKey = coord ? hexToKey(coord) : null;
    if (newKey !== this.lastHoveredKey) {
      if (this.lastHoveredKey) {
        this.hexGrid.setHighlight(this.lastHoveredKey, 'none');
      }
      if (newKey) {
        this.hexGrid.setHighlight(newKey, 'hover');
      }
      this.lastHoveredKey = newKey;
    }

    this.onHexHover?.(coord);
  }

  private handleMouseUp(event: MouseEvent) {
    if (event.button !== 0) return;
    this.updateMouse(event);

    if (this.isDragging && this.dragFrom) {
      const coord = this.raycastHex();
      // Clear gold border
      if (this.lastHoverBorderKey) {
        this.hexGrid.getTile(this.lastHoverBorderKey)?.setHoverBorder(false);
        this.lastHoverBorderKey = null;
      }
      this.onDragEnd?.(this.dragFrom, coord);
      this.isDragging = false;
      this.dragFrom = null;
      this.mouseDownPos = null;
      this.lastHoveredKey = null;
      return;
    }

    // Action space click (detected on mousedown)
    if (this.clickedActionSpace) {
      this.updateMouse(event);
      if (this.actionSpaces && this.onActionSpaceClick) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.actionSpaces.getPlatformMeshes());
        if (hits.length > 0) {
          const action = this.actionSpaces.getActionFromMesh(hits[0].object);
          if (action) {
            this.onActionSpaceClick(action);
          }
        }
      }
      this.clickedActionSpace = false;
      this.isDragging = false;
      this.dragFrom = null;
      this.mouseDownPos = null;
      return;
    }

    // Hex click (not a drag)
    if (this.dragFrom) {
      const coord = this.raycastHex();
      if (coord && this.onHexClick) {
        this.onHexClick(coord);
      }
    }

    this.isDragging = false;
    this.dragFrom = null;
    this.mouseDownPos = null;
  }

  dispose() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown, true);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
  }
}
