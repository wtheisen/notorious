import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import * as THREE from 'three';
import { SceneManager } from '../renderer/SceneManager';
import { GameRenderer } from '../renderer/GameRenderer';
import { hexToWorld } from '../renderer/helpers/HexGeometry';
import type { NotoriousState, WindTokenState } from '../game/types/GameState';
import { hexToKey, HexCoord, hexEquals } from '../types/CoordinateTypes';
import { getValidNeighbors } from '../config/HexConstants';
import { ActionType, ShipType, WindDirection } from '../types/GameTypes';
import { getPowerStrategy } from '../core/powers';
import { getReachableHexes, SailCheckFn } from '../game/logic/SailLogic';
import { canSailBetween } from '../game/logic/BoardLogic';
import './hud/hud.css';
import { ActionBar } from './hud/ActionBar';
import { PlayerPanel } from './hud/PlayerPanel';
import { PhaseIndicator } from './hud/PhaseIndicator';
import { ChartDialog } from './dialogs/ChartDialog';
import { StealDialog } from './dialogs/StealDialog';
import { SinkDialog } from './dialogs/SinkDialog';
import { BuildDialog } from './dialogs/BuildDialog';
import { PiratePower } from '../types/GameTypes';
import { ChartHand } from './hud/ChartHand';
import type { AnyChart } from '../core/Chart';
import { pickAIMove } from '../game/ai/AIPlayer';

interface SailMove {
  shipType: ShipType;
  from: HexCoord;
  to: HexCoord;
  distance: number;
}

type InteractionMode =
  | { type: 'idle' }
  | { type: 'setup' }
  | { type: 'place_captain' }
  | { type: 'sail'; pointsLeft: number; totalPoints: number; bribesUsed: number; queuedMoves: SailMove[] }
  | { type: 'sail_dragging'; pointsLeft: number; totalPoints: number; bribesUsed: number; queuedMoves: SailMove[]; shipType: ShipType; fromHex: HexCoord; reachable: Map<string, number> }
  | { type: 'build_select_hex' }
  | { type: 'build_confirm'; hex: HexCoord }
  | { type: 'steal_select_hex' }
  | { type: 'steal_confirm'; hex: HexCoord }
  | { type: 'sink_select_hex'; sloopMoves: { from: HexCoord; to: HexCoord }[] }
  | { type: 'sink_premove'; sloopMoves: { from: HexCoord; to: HexCoord }[]; selectedSloop: HexCoord | null; validDests: string[] }
  | { type: 'sink_confirm'; hex: HexCoord; sloopMoves: { from: HexCoord; to: HexCoord }[] }
  | { type: 'chart_pick'; drawnCharts: AnyChart[]; keepCount: number; maxDoubloons: number }
  | { type: 'pirate' }
  | { type: 'wind_token_decision' };

export function GameScreen({ G, ctx, moves }: BoardProps<NotoriousState>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dragShipRef = useRef<any>(null);
  const lastShipHoverKey = useRef<string | null>(null);

  const [windTokenPos, setWindTokenPos] = useState(0);
  const [windTokenFlip, setWindTokenFlip] = useState(false);
  const currentPlayer = G.players[parseInt(ctx.currentPlayer)];
  const phase = ctx.phase ?? 'setup';
  const sailMaxDist = currentPlayer
    ? getPowerStrategy(currentPlayer.piratePower).getSailMaxDistance()
    : 2;
  const sailBasePoints = 2;

  // Power-aware sail check (Islander ignores island edges)
  const power = currentPlayer ? getPowerStrategy(currentPlayer.piratePower) : null;
  const powerSailCheck: SailCheckFn = (board, from, to) => {
    if (!power) return canSailBetween(board, from, to);
    return power.canSailBetween(board, from, to, () => canSailBetween(board, from, to));
  };

  // Helper: submit all queued sail moves
  const submitSail = useCallback((queuedMoves: SailMove[]) => {
    if (queuedMoves.length === 0) return;
    const totalDist = queuedMoves.reduce((sum, m) => sum + m.distance, 0);
    const bribesNeeded = Math.max(0, totalDist - sailBasePoints);
    moves.sail({
      moves: queuedMoves.map(m => ({ shipType: m.shipType, from: m.from, to: m.to })),
      bribesUsed: bribesNeeded,
    });
    setMode({ type: 'idle' });
    setSelectedAction(null);
  }, [moves]);

  // Helper: enter sail mode
  const enterSailMode = useCallback((existingMoves: SailMove[] = [], existingPointsUsed = 0) => {
    const pointsLeft = sailBasePoints - existingPointsUsed;
    setMode({ type: 'sail', pointsLeft, totalPoints: sailBasePoints, bribesUsed: 0, queuedMoves: existingMoves });
    setSelectedAction(ActionType.SAIL);
  }, [sailBasePoints]);

  // Init Three.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new SceneManager(canvas);
    const gameRenderer = new GameRenderer(scene);
    sceneRef.current = scene;
    rendererRef.current = gameRenderer;
    scene.start();
    return () => { gameRenderer.dispose(); scene.dispose(); sceneRef.current = null; rendererRef.current = null; };
  }, []);

  // Reset on phase/turn change
  useEffect(() => {
    if (phase === 'setup') setMode({ type: 'setup' });
    else if (phase === 'place') { setMode({ type: 'place_captain' }); setSelectedAction(null); }
    else if (phase === 'play') { setMode({ type: 'idle' }); setSelectedAction(null); }
    else if (phase === 'pirate') { setMode({ type: 'pirate' }); setSelectedAction(null); }
    else setMode({ type: 'idle' });
  }, [phase, ctx.currentPlayer]);

  // AI auto-play: when it's an AI player's turn, execute a move after a delay
  useEffect(() => {
    if (!currentPlayer?.isAI) return;
    if (ctx.gameover) return;

    const timer = setTimeout(() => {
      const aiMove = pickAIMove(G, ctx);
      if (aiMove && moves[aiMove.move]) {
        (moves as any)[aiMove.move](...aiMove.args);
      }
    }, 600); // slight delay so human can see what's happening

    return () => clearTimeout(timer);
  }, [G, ctx, currentPlayer, moves]);

  // Wire drag events
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setCanDrag((coord: HexCoord) => {
      if (phase !== 'play') return false;
      if (!currentPlayer.placedCaptains.includes(ActionType.SAIL)) return false;
      const hex = G.board.hexes[hexToKey(coord)];
      if (!hex) return false;
      return hex.ships.some(s => s.playerId === ctx.currentPlayer && s.type !== ShipType.PORT);
    });

    renderer.setOnDragStart((coord: HexCoord) => {
      if (phase !== 'play') return;
      const key = hexToKey(coord);
      const hex = G.board.hexes[key];
      if (!hex) return;
      const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer && s.type !== ShipType.PORT);
      if (myShips.length === 0) return;
      if (!currentPlayer.placedCaptains.includes(ActionType.SAIL)) return;

      const ship = myShips.find(s => s.type === ShipType.SLOOP) ?? myShips.find(s => s.type === ShipType.GALLEON) ?? myShips[0];

      // Determine points left: if already in sail mode, use existing; otherwise start fresh
      const m = modeRef.current;
      let pointsLeft = sailBasePoints;
      let totalPoints = sailBasePoints;
      let queuedMoves: SailMove[] = [];
      let bribesUsed = 0;
      if (m.type === 'sail') {
        pointsLeft = m.pointsLeft;
        totalPoints = m.totalPoints;
        queuedMoves = m.queuedMoves;
        bribesUsed = m.bribesUsed;
      }

      // Limit reachable to remaining points (capped by ship's max distance)
      const maxReach = Math.min(pointsLeft, sailMaxDist);
      const reachable = getReachableHexes(G.board, coord, maxReach, powerSailCheck);
      // Filter to only hexes within remaining points
      for (const [rk, dist] of reachable) {
        if (dist > pointsLeft) reachable.delete(rk);
      }

      const shipMesh = renderer.getMovableShipAt(key);
      dragShipRef.current = shipMesh;
      if (shipMesh) shipMesh.setHighlight(true);

      renderer.setOrbitEnabled(false);
      renderer.setDragLock(true);
      renderer.clearHighlights();
      renderer.setHighlights([key], 'selected');
      renderer.setHighlights(Array.from(reachable.keys()), 'valid');

      setMode({
        type: 'sail_dragging', pointsLeft, totalPoints,
        bribesUsed, queuedMoves, shipType: ship.type, fromHex: coord, reachable,
      });
      setSelectedAction(ActionType.SAIL);
    });

    renderer.setOnDragMove((_from: HexCoord, _to: HexCoord | null, worldPos: THREE.Vector3) => {
      const shipMesh = dragShipRef.current;
      if (shipMesh && worldPos) renderer.moveShipTo(shipMesh, worldPos.x, worldPos.z);
    });

    renderer.setOnDragEnd((from: HexCoord, to: HexCoord | null) => {
      const m = modeRef.current;
      renderer.setOrbitEnabled(true);
      const shipMesh = dragShipRef.current;
      if (shipMesh) shipMesh.setHighlight(false);
      dragShipRef.current = null;

      if (m.type !== 'sail_dragging') {
        renderer.setDragLock(false);
        renderer.clearHighlights();
        return;
      }

      if (to && !hexEquals(from, to) && m.reachable.has(hexToKey(to))) {
        const distance = m.reachable.get(hexToKey(to))!;
        const newMove: SailMove = { shipType: m.shipType, from: m.fromHex, to, distance };
        const allMoves = [...m.queuedMoves, newMove];
        const newPointsLeft = m.pointsLeft - distance;

        // Rekey the ship mesh so it's tracked under the destination hex
        if (shipMesh) {
          renderer.applyPendingMove(shipMesh, hexToKey(from), to);
        }

        if (newPointsLeft <= 0) {
          // No points left, submit — clear pending moves so syncState can refresh
          renderer.clearPendingMoves();
          submitSail(allMoves);
        } else {
          // Points remaining — pending move keeps drag lock so syncState doesn't clobber
          renderer.clearHighlights();
          setMode({ type: 'sail', pointsLeft: newPointsLeft, totalPoints: m.totalPoints, bribesUsed: m.bribesUsed, queuedMoves: allMoves });
        }
      } else {
        // Invalid drop - snap back
        if (shipMesh) renderer.snapShipToHex(shipMesh, hexToKey(from), G);
        renderer.clearHighlights();
        setMode({ type: 'sail', pointsLeft: m.pointsLeft, totalPoints: m.totalPoints, bribesUsed: m.bribesUsed, queuedMoves: m.queuedMoves });
      }
    });
  }, [G, ctx.currentPlayer, phase, currentPlayer, sailMaxDist, sailBasePoints, moves, submitSail]);

  // Wire click events
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setOnHexClick((coord: HexCoord) => {
      const key = hexToKey(coord);
      const hex = G.board.hexes[key];
      if (!hex) return;

      switch (mode.type) {
        case 'setup': {
          if (hex.island) break;
          // First placement = port+sloops, second = galleon+sloops
          if (!currentPlayer.portLocation) {
            moves.placePortAndShips(coord);
          } else {
            moves.placeGalleonAndShips(coord);
          }
          break;
        }

        case 'sail': {
          // In sail mode, clicking a hex with your ships starts selecting that ship
          const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer && s.type !== ShipType.PORT);
          if (myShips.length > 0) {
            // Could start a click-based move from here
            // For now, drag is primary - click just highlights
          }
          break;
        }

        case 'build_select_hex': {
          const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer);
          const isPort = currentPlayer.portLocation && hexEquals(currentPlayer.portLocation, coord);
          const hasEnemy = hex.ships.some(s => s.playerId !== ctx.currentPlayer);
          if ((myShips.length > 0 || isPort) && (!hasEnemy || isPort)) {
            setMode({ type: 'build_confirm', hex: coord });
          }
          break;
        }

        case 'steal_select_hex': {
          const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer);
          const enemySloops = hex.ships.filter(s => s.playerId !== ctx.currentPlayer && s.type === ShipType.SLOOP);
          if (myShips.length > 0 && enemySloops.length > 0) {
            setMode({ type: 'steal_confirm', hex: coord });
          }
          break;
        }

        case 'sink_select_hex': {
          // Account for sloop pre-moves: a sloop moved to this hex counts as player presence
          const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer);
          const sloopMovedHere = mode.sloopMoves.some(m => hexEquals(m.to, coord));
          const enemyShips = hex.ships.filter(s => s.playerId !== ctx.currentPlayer);
          if ((myShips.length > 0 || sloopMovedHere) && enemyShips.length > 0) {
            setMode({ type: 'sink_confirm', hex: coord, sloopMoves: mode.sloopMoves });
          }
          break;
        }

        case 'sink_premove': {
          if (mode.selectedSloop) {
            // A sloop is selected — clicking a valid destination queues the move
            if (mode.validDests.includes(key)) {
              const newMoves = [...mode.sloopMoves, { from: mode.selectedSloop, to: coord }];
              setMode({ type: 'sink_premove', sloopMoves: newMoves, selectedSloop: null, validDests: [] });
            } else {
              // Clicked elsewhere — deselect
              setMode({ ...mode, selectedSloop: null, validDests: [] });
            }
          } else {
            // No sloop selected — check doubloon budget first
            const isRelentless = currentPlayer.piratePower === PiratePower.THE_RELENTLESS;
            const currentMoveCost = power
              ? power.modifySinkCost(mode.sloopMoves.length + 1, { movingSloop: true })
              : mode.sloopMoves.length + 1;
            if (currentMoveCost > currentPlayer.doubloons) break; // can't afford another move

            // Account for sloops already moved (track their current positions)
            const movedTo = mode.sloopMoves.map(m => hexToKey(m.to));
            const originalSloops = hex.ships.filter(
              s => s.playerId === ctx.currentPlayer && s.type === ShipType.SLOOP
            ).length;
            const movedAway = mode.sloopMoves.filter(m => hexEquals(m.from, coord)).length;
            const movedHere = movedTo.filter(k => k === key).length;
            const sloopsHere = originalSloops - movedAway + movedHere;

            if (sloopsHere > 0) {
              // Compute valid adjacent destinations
              const neighbors = getValidNeighbors(coord);
              const validDests = neighbors
                .filter(n => {
                  const nKey = hexToKey(n);
                  return G.board.hexes[nKey] && canSailBetween(G.board, coord, n);
                })
                .map(n => hexToKey(n));
              setMode({ ...mode, selectedSloop: coord, validDests });
            }
          }
          break;
        }
      }
    });

    renderer.setOnHexHover((coord: HexCoord | null) => {
      setHoveredHex(coord ? hexToKey(coord) : null);
      const m = modeRef.current;
      const isSailish = m.type === 'sail' || m.type === 'idle';
      if (phase === 'play' && isSailish && currentPlayer.placedCaptains.includes(ActionType.SAIL)) {
        if (lastShipHoverKey.current) { renderer.highlightShipsAt(lastShipHoverKey.current, false); lastShipHoverKey.current = null; }
        if (coord) {
          const key = hexToKey(coord);
          const hex = G.board.hexes[key];
          if (hex?.ships.some(s => s.playerId === ctx.currentPlayer && s.type !== ShipType.PORT)) {
            renderer.highlightShipsAt(key, true);
            lastShipHoverKey.current = key;
          }
        }
      }
    });
  }, [mode, G, ctx.currentPlayer, moves, currentPlayer, sailMaxDist, phase]);

  // Sync highlights
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.syncState(G);
    renderer.highlightActionSpaces(phase === 'place');
    if (mode.type === 'sail_dragging') return;
    renderer.clearHighlights();

    if (mode.type === 'sail') {
      // Highlight hexes with movable ships
      for (const [key, hex] of Object.entries(G.board.hexes)) {
        if (hex.ships.some(s => s.playerId === ctx.currentPlayer && s.type !== ShipType.PORT)) {
          renderer.setHighlights([key], 'valid');
        }
      }
    } else if (mode.type === 'build_select_hex') {
      for (const [key, hex] of Object.entries(G.board.hexes)) {
        const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer);
        const isPort = currentPlayer.portLocation && hexEquals(currentPlayer.portLocation, hex.coord);
        const hasEnemy = hex.ships.some(s => s.playerId !== ctx.currentPlayer);
        if ((myShips.length > 0 || isPort) && (!hasEnemy || isPort)) renderer.setHighlights([key], 'valid');
      }
    } else if (mode.type === 'steal_select_hex') {
      for (const [key, hex] of Object.entries(G.board.hexes)) {
        const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer);
        const enemyShips = hex.ships.filter(s => s.playerId !== ctx.currentPlayer);
        if (myShips.length > 0 && enemyShips.length > 0) renderer.setHighlights([key], 'valid');
      }
    } else if (mode.type === 'sink_select_hex') {
      const sloopDestKeys = new Set(mode.sloopMoves.map(m => hexToKey(m.to)));
      for (const [key, hex] of Object.entries(G.board.hexes)) {
        const myShips = hex.ships.filter(s => s.playerId === ctx.currentPlayer);
        const sloopMovedHere = sloopDestKeys.has(key);
        const enemyShips = hex.ships.filter(s => s.playerId !== ctx.currentPlayer);
        if ((myShips.length > 0 || sloopMovedHere) && enemyShips.length > 0) renderer.setHighlights([key], 'valid');
      }
    } else if (mode.type === 'sink_premove') {
      if (mode.selectedSloop) {
        // Highlight selected sloop and valid destinations
        renderer.setHighlights([hexToKey(mode.selectedSloop)], 'selected');
        renderer.setHighlights(mode.validDests, 'valid');
      } else {
        // Highlight hexes with our sloops (accounting for queued moves)
        const movedTo = mode.sloopMoves.map(m => hexToKey(m.to));
        for (const [key, hex] of Object.entries(G.board.hexes)) {
          const originalSloops = hex.ships.filter(
            s => s.playerId === ctx.currentPlayer && s.type === ShipType.SLOOP
          ).length;
          const movedAway = mode.sloopMoves.filter(m => hexToKey(m.from) === key).length;
          const movedHere = movedTo.filter(k => k === key).length;
          if (originalSloops - movedAway + movedHere > 0) {
            renderer.setHighlights([key], 'valid');
          }
        }
      }
    }
  }, [G, mode, ctx.currentPlayer]);

  // Handlers
  const handlePlaceCaptain = useCallback((action: ActionType) => { moves.placeCaptain(action); }, [moves]);

  const handleExecuteAction = useCallback((action: ActionType) => {
    setSelectedAction(action);
    switch (action) {
      case ActionType.SAIL: enterSailMode(); break;
      case ActionType.BUILD: setMode({ type: 'build_select_hex' }); break;
      case ActionType.STEAL: setMode({ type: 'steal_select_hex' }); break;
      case ActionType.SINK: {
        setMode({ type: 'sink_premove', sloopMoves: [], selectedSloop: null, validDests: [] });
        break;
      }
      case ActionType.CHART: {
        // Peek at extra charts in case player wants to bribe for more draws
        const baseDrawCount = 2;
        const baseKeepCount = 1;
        const maxBribes = currentPlayer.doubloons;
        // Pre-peek up to baseDrawCount + maxBribes (capped by deck size)
        const maxPeek = Math.min(baseDrawCount + maxBribes, G.chartDeck.drawPile.length);
        const peeked = G.chartDeck.drawPile.slice(0, maxPeek);
        if (peeked.length === 0) { break; }
        if (peeked.length <= baseKeepCount && maxBribes === 0) {
          moves.chart({ bribeChoices: [], selectedChartIds: peeked.map(c => c.id) });
          setMode({ type: 'idle' }); setSelectedAction(null);
        } else {
          setMode({ type: 'chart_pick', drawnCharts: peeked, keepCount: baseKeepCount, maxDoubloons: maxBribes });
        }
        break;
      }
    }
  }, [moves, enterSailMode, currentPlayer, G]);

  // Wire action space clicks (PLACE + PLAY phases)
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setOnActionSpaceClick((action: ActionType) => {
      if (phase === 'place') {
        moves.placeCaptain(action);
      } else if (phase === 'play') {
        if (currentPlayer.placedCaptains.includes(action)) {
          handleExecuteAction(action);
        }
      }
    });
  }, [phase, moves, currentPlayer, handleExecuteAction]);

  const handleForfeit = useCallback(() => { moves.skipAction?.(); setMode({ type: 'idle' }); setSelectedAction(null); }, [moves]);

  const handleCancel = useCallback(() => {
    setMode({ type: 'idle' }); setSelectedAction(null);
    const r = rendererRef.current;
    if (r) { r.clearHighlights(); r.clearPendingMoves(); r.syncState(G); }
  }, [G]);

  const handleSailDone = useCallback(() => {
    if (mode.type === 'sail' && mode.queuedMoves.length > 0) {
      rendererRef.current?.clearPendingMoves();
      submitSail(mode.queuedMoves);
    }
  }, [mode, submitSail]);

  const handleSailBuyPoint = useCallback(() => {
    if (mode.type !== 'sail') return;
    const doubloonsBudget = currentPlayer.doubloons - mode.bribesUsed;
    if (doubloonsBudget <= 0) return;
    setMode({
      ...mode,
      pointsLeft: mode.pointsLeft + 1,
      totalPoints: mode.totalPoints + 1,
      bribesUsed: mode.bribesUsed + 1,
    });
  }, [mode, currentPlayer]);

  // Instruction text
  let instruction = '';
  switch (mode.type) {
    case 'setup':
      instruction = !currentPlayer.portLocation
        ? 'Click an ocean hex to place your port + 2 sloops'
        : 'Click an ocean hex to place a galleon + 2 sloops';
      break;
    case 'place_captain': instruction = 'Choose an action to assign a captain'; break;
    case 'sail': instruction = `SAIL: ${mode.pointsLeft}/${mode.totalPoints} movement points left — drag a ship`; break;
    case 'sail_dragging': instruction = `Drop on a blue hex (${mode.pointsLeft} pts left)`; break;
    case 'build_select_hex': instruction = 'Click a hex with your pieces to build'; break;
    case 'steal_select_hex': instruction = 'Click a shared hex to steal a sloop'; break;
    case 'sink_select_hex': instruction = 'Click a hex with your ships and enemy ships'; break;
    case 'sink_premove': {
      if (mode.selectedSloop) {
        instruction = 'Click an adjacent hex to move the sloop there';
      } else {
        const moveCount = mode.sloopMoves.length;
        instruction = moveCount > 0
          ? `SINK: ${moveCount} sloop move${moveCount > 1 ? 's' : ''} queued — click another sloop or proceed`
          : 'SINK: Click a sloop to pre-move it (1 dbl each), or skip to select target';
      }
      break;
    }
    case 'sink_confirm': instruction = 'Choose which ship to sink'; break;
    case 'pirate': instruction = 'Claim charts or click Done'; break;
    case 'wind_token_decision': instruction = 'You hold the Wind Token — choose position and direction'; break;
    case 'idle':
      if (phase === 'play' && currentPlayer.placedCaptains.length > 0)
        instruction = 'Choose an action, or drag a ship to sail';
      break;
  }

  const isSailActive = mode.type === 'sail' || mode.type === 'sail_dragging';
  const sailHasQueuedMoves = (mode.type === 'sail' && mode.queuedMoves.length > 0);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <PhaseIndicator phase={phase} currentPlayer={currentPlayer} windToken={G.windToken} players={G.players} instruction={instruction} />

      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {G.players.map(p => <PlayerPanel key={p.id} player={p} isActive={ctx.currentPlayer === p.id} />)}
      </div>

      {(phase === 'place' || phase === 'play') && !isSailActive && (
        <ActionBar
          phase={phase as 'place' | 'play'}
          placedCaptains={currentPlayer.placedCaptains}
          captainCount={currentPlayer.captainCount}
          currentAction={selectedAction}
          disabledActions={power ? [
            ...(!power.canUseSink() ? [ActionType.SINK] : []),
            ...(!power.canUseSteal() ? [ActionType.STEAL] : []),
            ...(!power.canUseBuild() ? [ActionType.BUILD] : []),
            ...(!power.canUseChart() ? [ActionType.CHART] : []),
          ] : []}
          onPlaceCaptain={handlePlaceCaptain}
          onExecuteAction={handleExecuteAction}
          onForfeit={handleForfeit}
        />
      )}

      {/* Sail controls */}
      {isSailActive && (() => {
        const sailBribes = mode.type === 'sail' ? mode.bribesUsed : (mode.type === 'sail_dragging' ? mode.bribesUsed : 0);
        const canBuyMore = mode.type === 'sail' && (currentPlayer.doubloons - sailBribes) > 0;
        return (
          <div className="hud-panel sail-hud" style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          }}>
            <span className="sail-hud__label">SAIL</span>
            <span className="sail-hud__points">
              {mode.type === 'sail' ? mode.pointsLeft : (mode.type === 'sail_dragging' ? mode.pointsLeft : 0)} pts
            </span>
            {sailBribes > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#8b6914' }}>
                ({sailBribes} dbl)
              </span>
            )}
            {mode.type === 'sail' && mode.queuedMoves.length > 0 && (
              <span className="sail-hud__queued">
                {mode.queuedMoves.length} move{mode.queuedMoves.length > 1 ? 's' : ''} queued
              </span>
            )}
            {mode.type === 'sail' && (
              <button className="hud-btn" onClick={handleSailBuyPoint}
                disabled={!canBuyMore}
                style={{
                  padding: '6px 12px', fontSize: '0.72rem', fontWeight: 600,
                  background: canBuyMore ? 'rgba(184,150,62,0.3)' : 'rgba(139,115,85,0.15)',
                  color: canBuyMore ? '#8b6914' : '#a89060',
                  border: canBuyMore ? '1px solid #a89060' : '1px solid #c4b28a',
                  cursor: canBuyMore ? 'pointer' : 'default',
                }}>
                +1 pt (1 dbl)
              </button>
            )}
            {sailHasQueuedMoves && (
              <button className="hud-btn hud-btn--confirm" onClick={handleSailDone}
                style={{ padding: '6px 16px', fontSize: '0.78rem', fontWeight: 600 }}>
                Done
              </button>
            )}
            <button className="hud-btn hud-btn--danger" onClick={handleCancel}
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
              Cancel
            </button>
          </div>
        );
      })()}

      {/* Cancel for non-sail actions */}
      {(mode.type === 'build_select_hex' || mode.type === 'steal_select_hex' || mode.type === 'sink_select_hex') && (
        <button className="hud-btn hud-btn--danger" onClick={handleCancel} style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 16px', fontSize: '0.75rem',
        }}>
          Cancel
        </button>
      )}

      {/* Sink pre-move HUD */}
      {mode.type === 'sink_premove' && (() => {
        const isRelentless = currentPlayer.piratePower === PiratePower.THE_RELENTLESS;
        const sloopMoveBribes = power ? power.modifySinkCost(mode.sloopMoves.length, { movingSloop: mode.sloopMoves.length > 0 }) : mode.sloopMoves.length;
        const canAffordMore = sloopMoveBribes < currentPlayer.doubloons || (isRelentless && mode.sloopMoves.length === 0);
        return (
          <div className="hud-panel sail-hud" style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          }}>
            <span className="sail-hud__label">SINK — Pre-Move</span>
            {mode.sloopMoves.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#8b6914' }}>
                {mode.sloopMoves.length} move{mode.sloopMoves.length > 1 ? 's' : ''}
                {sloopMoveBribes > 0 && ` (${sloopMoveBribes} dbl)`}
                {isRelentless && mode.sloopMoves.length === 1 && ' (free!)'}
              </span>
            )}
            {!canAffordMore && mode.sloopMoves.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#8b7960' }}>max reached</span>
            )}
            <button className="hud-btn hud-btn--confirm" onClick={() => {
              setMode({ type: 'sink_select_hex', sloopMoves: mode.sloopMoves });
            }} style={{ padding: '6px 16px', fontSize: '0.78rem', fontWeight: 600 }}>
              {mode.sloopMoves.length > 0 ? 'Pick Target' : 'Skip'}
            </button>
            <button className="hud-btn hud-btn--danger" onClick={handleCancel}
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
              Cancel
            </button>
          </div>
        );
      })()}

      {hoveredHex && (
        <div className="hex-info" style={{
          position: 'absolute',
          bottom: isSailActive ? 70 : (phase === 'place' || phase === 'play' ? 80 : 12),
          left: 14,
        }}>
          {hoveredHex}
          {G.board.hexes[hoveredHex]?.island && ` · ${G.board.hexes[hoveredHex].island!.name}`}
          {G.board.hexes[hoveredHex]?.ships.length > 0 && ` · ${G.board.hexes[hoveredHex].ships.length} ship${G.board.hexes[hoveredHex].ships.length > 1 ? 's' : ''}`}
        </div>
      )}

      {/* Pirate phase controls */}
      {mode.type === 'pirate' && (
        <div className="hud-panel pirate-panel" style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="pirate-panel__title">Pirate Phase</span>
            <button className="hud-btn hud-btn--confirm" onClick={() => {
              // If current player holds the wind token, show decision UI first
              if (G.windToken.holder === ctx.currentPlayer && !currentPlayer.isAI) {
                setWindTokenPos(G.windToken.position);
                setWindTokenFlip(false);
                setMode({ type: 'wind_token_decision' });
              } else {
                moves.doneClaiming();
              }
            }}
              style={{ padding: '6px 18px', fontSize: '0.78rem', fontWeight: 600 }}>
              Done
            </button>
          </div>

          {currentPlayer.charts.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="pirate-panel__section-label">Your charts</div>
              {currentPlayer.charts.map(chart => (
                <div key={chart.id} className="claim-row"
                  style={{ borderLeft: `3px solid ${chart.type === 'TREASURE_MAP' ? '#c4a43a' : chart.type === 'SMUGGLER_ROUTE' ? '#4488cc' : '#cc4444'}` }}>
                  <span>
                    {chart.type === 'TREASURE_MAP' && `Treasure Map (${(chart as any).targetHex.q},${(chart as any).targetHex.r})`}
                    {chart.type === 'SMUGGLER_ROUTE' && `Route: ${(chart as any).islandA} — ${(chart as any).islandB}`}
                    {chart.type === 'ISLAND_RAID' && `Raid: ${(chart as any).targetIsland}`}
                  </span>
                  <button className="hud-btn hud-btn--confirm claim-btn"
                    onClick={() => moves.claimChart({ chartId: chart.id })}>
                    Claim
                  </button>
                </div>
              ))}
            </div>
          )}

          {G.chartDeck.islandRaids.length > 0 && (
            <div>
              <div className="pirate-panel__section-label">Island Raids</div>
              {G.chartDeck.islandRaids.map(raid => (
                <div key={raid.id} className="claim-row" style={{ borderLeft: '3px solid #cc4444' }}>
                  <span>
                    {(raid as any).targetIsland} — {(raid as any).notorietyReward} not. + {(raid as any).doubloonsOnChart} dbl.
                  </span>
                  <button className="hud-btn hud-btn--confirm claim-btn"
                    onClick={() => moves.claimChart({ chartId: raid.id })}>
                    Claim
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentPlayer.charts.length === 0 && G.chartDeck.islandRaids.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No charts to claim</div>
          )}
        </div>
      )}

      {/* Wind token decision UI */}
      {mode.type === 'wind_token_decision' && (() => {
        const currentDir = windTokenFlip
          ? (G.windToken.placeDirection === WindDirection.CLOCKWISE ? WindDirection.COUNTERCLOCKWISE : WindDirection.CLOCKWISE)
          : G.windToken.placeDirection;
        return (
          <div className="hud-panel" style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            padding: '14px 20px', minWidth: 320,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: 10, color: '#3b2a1a' }}>
              Wind Token
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.75rem', color: '#5c3a1e' }}>Position:</span>
              {G.players.map((_, i) => (
                <button key={i} className="hud-btn" onClick={() => setWindTokenPos(i)}
                  style={{
                    padding: '4px 10px', fontSize: '0.72rem',
                    background: windTokenPos === i ? 'rgba(184,150,62,0.4)' : 'rgba(139,115,85,0.1)',
                    border: windTokenPos === i ? '2px solid #b8963e' : '1px solid #8b7355',
                    color: '#3b2a1a',
                  }}>
                  {i}–{(i + 1) % G.players.length}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', color: '#5c3a1e' }}>Direction:</span>
              <button className="hud-btn" onClick={() => setWindTokenFlip(!windTokenFlip)}
                style={{
                  padding: '4px 14px', fontSize: '0.78rem',
                  background: 'rgba(139,115,85,0.15)', border: '1px solid #8b7355', color: '#3b2a1a',
                }}>
                {currentDir === WindDirection.CLOCKWISE ? '↻ CW' : '↺ CCW'} (click to flip)
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="hud-btn hud-btn--confirm" onClick={() => {
                moves.setWindToken({ flip: windTokenFlip, newPosition: windTokenPos });
                moves.doneClaiming();
                setMode({ type: 'idle' });
              }} style={{ padding: '6px 18px', fontSize: '0.78rem', fontWeight: 600 }}>
                Confirm
              </button>
            </div>
          </div>
        );
      })()}

      {/* Player's chart hand */}
      <ChartHand charts={currentPlayer.charts} />

      {/* Build dialog */}
      {mode.type === 'build_confirm' && (
        <BuildDialog
          hex={mode.hex}
          availableSloops={currentPlayer.ships.sloops}
          availableGalleons={currentPlayer.ships.galleons}
          doubloons={currentPlayer.doubloons}
          onConfirm={(placements, bribesUsed) => {
            moves.build({ hex: mode.hex, placements, bribesUsed });
            setMode({ type: 'idle' }); setSelectedAction(null);
          }}
          onCancel={() => { setMode({ type: 'build_select_hex' }); }}
        />
      )}

      {/* Steal confirmation dialog */}
      {mode.type === 'steal_confirm' && (() => {
        const hex = G.board.hexes[hexToKey(mode.hex)];
        if (!hex) return null;
        // Build target list: enemy players with sloops in this hex
        const enemyPlayerIds = new Set(
          hex.ships.filter(s => s.playerId !== ctx.currentPlayer && s.type === ShipType.SLOOP).map(s => s.playerId)
        );
        const targets = Array.from(enemyPlayerIds).map(pid => {
          const p = G.players.find(pl => pl.id === pid)!;
          return {
            playerId: pid,
            playerName: p.name,
            playerColor: p.color,
            sloopCount: hex.ships.filter(s => s.playerId === pid && s.type === ShipType.SLOOP).length,
          };
        });
        return (
          <StealDialog
            hex={mode.hex}
            targets={targets}
            canReplace={currentPlayer.ships.sloops > 0}
            onConfirm={(targetPlayerId, replaceWithSloop) => {
              moves.steal({ hex: mode.hex, targetPlayerId, replaceWithSloop });
              setMode({ type: 'idle' }); setSelectedAction(null);
            }}
            onCancel={() => { setMode({ type: 'steal_select_hex' }); }}
          />
        );
      })()}

      {/* Sink confirmation dialog */}
      {mode.type === 'sink_confirm' && (() => {
        const hex = G.board.hexes[hexToKey(mode.hex)];
        if (!hex) return null;
        const enemyShips = hex.ships.filter(s => s.playerId !== ctx.currentPlayer && s.type !== ShipType.PORT);
        const targets = enemyShips.map(s => {
          const p = G.players.find(pl => pl.id === s.playerId)!;
          return { playerId: s.playerId, playerName: p.name, playerColor: p.color, shipType: s.type };
        });
        // Reduce available doubloons by sloop pre-move cost
        const sloopMoveCost = power && mode.sloopMoves.length > 0
          ? power.modifySinkCost(mode.sloopMoves.length, { movingSloop: true })
          : mode.sloopMoves.length;
        const remainingDoubloons = currentPlayer.doubloons - sloopMoveCost;
        return (
          <SinkDialog
            hex={mode.hex}
            targets={targets}
            isRelentless={currentPlayer.piratePower === PiratePower.THE_RELENTLESS}
            doubloons={remainingDoubloons}
            onConfirm={(primaryIdx, additionalIndices) => {
              const primary = targets[primaryIdx];
              const additional = additionalIndices.map(i => ({
                shipType: targets[i].shipType,
                playerId: targets[i].playerId,
              }));
              moves.sink({
                hex: mode.hex,
                targetShipType: primary.shipType,
                targetPlayerId: primary.playerId,
                sloopMovesBefore: mode.sloopMoves,
                additionalSinks: additional,
              });
              setMode({ type: 'idle' }); setSelectedAction(null);
            }}
            onCancel={() => { setMode({ type: 'sink_select_hex', sloopMoves: mode.sloopMoves }); }}
          />
        );
      })()}

      {/* Chart pick dialog */}
      {mode.type === 'chart_pick' && (
        <ChartDialog
          drawnCharts={mode.drawnCharts}
          keepCount={mode.keepCount}
          maxDoubloons={mode.maxDoubloons}
          onConfirm={(selectedIds, bribeChoices) => {
            moves.chart({ bribeChoices, selectedChartIds: selectedIds });
            setMode({ type: 'idle' });
            setSelectedAction(null);
          }}
          onCancel={() => {
            setMode({ type: 'idle' });
            setSelectedAction(null);
          }}
        />
      )}

      {ctx.gameover && (
        <div className="game-over">
          <div className="game-over__title">GAME OVER</div>
          <div className="game-over__subtitle">
            {G.players.find(p => p.id === ctx.gameover.winner)?.name ?? ctx.gameover.winner} claims victory!
          </div>
          {ctx.gameover.finalScores && (
            <table className="game-over__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Captain</th>
                  <th>Score</th>
                  <th>Notoriety</th>
                  <th>Doubloons</th>
                  <th>Bounty</th>
                  <th>Islands</th>
                  <th>Galleons</th>
                </tr>
              </thead>
              <tbody>
                {ctx.gameover.finalScores.map((score: {
                  playerId: string;
                  playerName: string;
                  finalScore: number;
                  bounty: number;
                  notoriety: number;
                  islandsControlled: number;
                  galleonsOnBoard: number;
                }, idx: number) => (
                  <tr
                    key={score.playerId}
                    className={score.playerId === ctx.gameover.winner ? 'game-over__winner-row' : ''}
                  >
                    <td>{idx + 1}</td>
                    <td>{score.playerName}</td>
                    <td>{score.finalScore}</td>
                    <td>{score.notoriety}</td>
                    <td>{score.finalScore - score.notoriety}</td>
                    <td>{score.bounty}</td>
                    <td>{score.islandsControlled}</td>
                    <td>{score.galleonsOnBoard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            className="hud-btn hud-btn--confirm game-over__play-again"
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
