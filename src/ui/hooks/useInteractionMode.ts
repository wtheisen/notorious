import { useCallback, useRef, useState } from 'react';
import type { AnyChart } from '../../core/Chart';
import { getPowerStrategy } from '../../core/powers';
import type { PiratePowerStrategy } from '../../core/powers/PiratePowerStrategy';
import { canSailBetween } from '../../game/logic/BoardLogic';
import { getReachableHexes, SailCheckFn } from '../../game/logic/SailLogic';
import type { NotoriousState } from '../../game/types/GameState';
import { hexToKey, HexCoord, hexEquals } from '../../types/CoordinateTypes';
import { ActionType, ShipType, PiratePower, WindDirection, GAME_CONSTANTS } from '../../types/GameTypes';
import { getValidNeighbors } from '../../config/HexConstants';

// ── Types ──────────────────────────────────────────────────────

export interface SailMove {
  shipType: ShipType;
  from: HexCoord;
  to: HexCoord;
  distance: number;
}

export type InteractionMode =
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

// ── Instruction text ───────────────────────────────────────────

export function getInstruction(
  mode: InteractionMode,
  phase: string,
  currentPlayer: NotoriousState['players'][number],
  power: PiratePowerStrategy | null,
): string {
  switch (mode.type) {
    case 'setup':
      return !currentPlayer.portLocation
        ? 'Click an ocean hex to place your port + 2 sloops'
        : 'Click an ocean hex to place a galleon + 2 sloops';
    case 'place_captain': return 'Choose an action to assign a captain';
    case 'sail': return `SAIL: ${mode.pointsLeft}/${mode.totalPoints} movement points left — drag a ship`;
    case 'sail_dragging': return `Drop on a blue hex (${mode.pointsLeft} pts left)`;
    case 'build_select_hex': return 'Click a hex with your pieces to build';
    case 'steal_select_hex': return 'Click a shared hex to steal a sloop';
    case 'sink_select_hex': return 'Click a hex with your ships and enemy ships';
    case 'sink_premove': {
      if (mode.selectedSloop) return 'Click an adjacent hex to move the sloop there';
      const moveCount = mode.sloopMoves.length;
      return moveCount > 0
        ? `SINK: ${moveCount} sloop move${moveCount > 1 ? 's' : ''} queued — click another sloop or proceed`
        : 'SINK: Click a sloop to pre-move it (1 dbl each), or skip to select target';
    }
    case 'sink_confirm': return 'Choose which ship to sink';
    case 'pirate': return 'Claim charts or click Done';
    case 'wind_token_decision': return 'You hold the Wind Token — choose position and direction';
    case 'idle':
      if (phase === 'play' && currentPlayer.placedCaptains.length > 0)
        return 'Choose an action, or drag a ship to sail';
      return '';
    default: return '';
  }
}

// ── Highlight computation ──────────────────────────────────────

export interface HighlightSet {
  selected: string[];
  valid: string[];
}

export function getHighlightsForMode(
  mode: InteractionMode,
  G: NotoriousState,
  currentPlayerId: string,
  currentPlayer: NotoriousState['players'][number],
): HighlightSet {
  const selected: string[] = [];
  const valid: string[] = [];

  if (mode.type === 'setup') {
    for (const [key, hex] of Object.entries(G.board.hexes)) {
      if (!hex.island && hex.ships.length === 0) valid.push(key);
    }
  } else if (mode.type === 'sail') {
    for (const [key, hex] of Object.entries(G.board.hexes)) {
      if (hex.ships.some(s => s.playerId === currentPlayerId && s.type !== ShipType.PORT)) {
        valid.push(key);
      }
    }
  } else if (mode.type === 'build_select_hex') {
    for (const [key, hex] of Object.entries(G.board.hexes)) {
      const myShips = hex.ships.filter(s => s.playerId === currentPlayerId);
      const isPort = currentPlayer.portLocation && hexEquals(currentPlayer.portLocation, hex.coord);
      const hasEnemy = hex.ships.some(s => s.playerId !== currentPlayerId);
      if ((myShips.length > 0 || isPort) && (!hasEnemy || isPort)) valid.push(key);
    }
  } else if (mode.type === 'steal_select_hex') {
    for (const [key, hex] of Object.entries(G.board.hexes)) {
      const myShips = hex.ships.filter(s => s.playerId === currentPlayerId);
      const enemyShips = hex.ships.filter(s => s.playerId !== currentPlayerId);
      if (myShips.length > 0 && enemyShips.length > 0) valid.push(key);
    }
  } else if (mode.type === 'sink_select_hex') {
    const sloopDestKeys = new Set(mode.sloopMoves.map(m => hexToKey(m.to)));
    for (const [key, hex] of Object.entries(G.board.hexes)) {
      const myShips = hex.ships.filter(s => s.playerId === currentPlayerId);
      const sloopMovedHere = sloopDestKeys.has(key);
      const enemyShips = hex.ships.filter(s => s.playerId !== currentPlayerId);
      if ((myShips.length > 0 || sloopMovedHere) && enemyShips.length > 0) valid.push(key);
    }
  } else if (mode.type === 'sink_premove') {
    if (mode.selectedSloop) {
      selected.push(hexToKey(mode.selectedSloop));
      valid.push(...mode.validDests);
    } else {
      const movedTo = mode.sloopMoves.map(m => hexToKey(m.to));
      for (const [key, hex] of Object.entries(G.board.hexes)) {
        const originalSloops = hex.ships.filter(
          s => s.playerId === currentPlayerId && s.type === ShipType.SLOOP
        ).length;
        const movedAway = mode.sloopMoves.filter(m => hexToKey(m.from) === key).length;
        const movedHere = movedTo.filter(k => k === key).length;
        if (originalSloops - movedAway + movedHere > 0) valid.push(key);
      }
    }
  }

  return { selected, valid };
}

// ── Hex click handler ──────────────────────────────────────────

export function handleHexClick(
  coord: HexCoord,
  mode: InteractionMode,
  G: NotoriousState,
  currentPlayerId: string,
  currentPlayer: NotoriousState['players'][number],
  power: PiratePowerStrategy | null,
  moves: Record<string, (...args: any[]) => void>,
  setMode: (mode: InteractionMode) => void,
): void {
  const key = hexToKey(coord);
  const hex = G.board.hexes[key];
  if (!hex) return;

  switch (mode.type) {
    case 'setup': {
      if (hex.island) break;
      if (!currentPlayer.portLocation) {
        moves.placePortAndShips(coord);
      } else {
        moves.placeGalleonAndShips(coord);
      }
      break;
    }

    case 'sail': {
      // In sail mode clicking a hex with ships could start selection — drag is primary
      break;
    }

    case 'build_select_hex': {
      const myShips = hex.ships.filter(s => s.playerId === currentPlayerId);
      const isPort = currentPlayer.portLocation && hexEquals(currentPlayer.portLocation, coord);
      const hasEnemy = hex.ships.some(s => s.playerId !== currentPlayerId);
      if ((myShips.length > 0 || isPort) && (!hasEnemy || isPort)) {
        setMode({ type: 'build_confirm', hex: coord });
      }
      break;
    }

    case 'steal_select_hex': {
      const myShips = hex.ships.filter(s => s.playerId === currentPlayerId);
      const enemySloops = hex.ships.filter(s => s.playerId !== currentPlayerId && s.type === ShipType.SLOOP);
      if (myShips.length > 0 && enemySloops.length > 0) {
        setMode({ type: 'steal_confirm', hex: coord });
      }
      break;
    }

    case 'sink_select_hex': {
      const myShips = hex.ships.filter(s => s.playerId === currentPlayerId);
      const sloopMovedHere = mode.sloopMoves.some(m => hexEquals(m.to, coord));
      const enemyShips = hex.ships.filter(s => s.playerId !== currentPlayerId);
      if ((myShips.length > 0 || sloopMovedHere) && enemyShips.length > 0) {
        setMode({ type: 'sink_confirm', hex: coord, sloopMoves: mode.sloopMoves });
      }
      break;
    }

    case 'sink_premove': {
      if (mode.selectedSloop) {
        if (mode.validDests.includes(key)) {
          const newMoves = [...mode.sloopMoves, { from: mode.selectedSloop, to: coord }];
          setMode({ type: 'sink_premove', sloopMoves: newMoves, selectedSloop: null, validDests: [] });
        } else {
          setMode({ ...mode, selectedSloop: null, validDests: [] });
        }
      } else {
        const currentMoveCost = power
          ? power.modifySinkCost(mode.sloopMoves.length + 1, { movingSloop: true })
          : mode.sloopMoves.length + 1;
        if (currentMoveCost > currentPlayer.doubloons) break;

        const movedTo = mode.sloopMoves.map(m => hexToKey(m.to));
        const originalSloops = hex.ships.filter(
          s => s.playerId === currentPlayerId && s.type === ShipType.SLOOP
        ).length;
        const movedAway = mode.sloopMoves.filter(m => hexEquals(m.from, coord)).length;
        const movedHere = movedTo.filter(k => k === key).length;
        const sloopsHere = originalSloops - movedAway + movedHere;

        if (sloopsHere > 0) {
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
}

// ── Sail helpers ───────────────────────────────────────────────

export function buildPowerSailCheck(power: PiratePowerStrategy | null): SailCheckFn {
  return (board, from, to) => {
    if (!power) return canSailBetween(board, from, to);
    return power.canSailBetween(board, from, to, () => canSailBetween(board, from, to));
  };
}

// ── Hook ───────────────────────────────────────────────────────

interface UseInteractionModeProps {
  G: NotoriousState;
  ctx: { currentPlayer: string; phase: string | null; gameover?: any; numPlayers: number };
  moves: Record<string, (...args: any[]) => void>;
}

export function useInteractionMode({ G, ctx, moves }: UseInteractionModeProps) {
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [windTokenPos, setWindTokenPos] = useState(0);
  const [windTokenFlip, setWindTokenFlip] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const currentPlayer = G.players[parseInt(ctx.currentPlayer)];
  const phase = ctx.phase ?? 'setup';
  const power = currentPlayer ? getPowerStrategy(currentPlayer.piratePower) : null;
  const sailMaxDist = currentPlayer ? power!.getSailMaxDistance() : 2;
  const sailBasePoints = 2;
  const powerSailCheck = buildPowerSailCheck(power);

  // ── Submit sail ──
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

  // ── Enter sail mode ──
  const enterSailMode = useCallback((existingMoves: SailMove[] = [], existingPointsUsed = 0) => {
    const pointsLeft = sailBasePoints - existingPointsUsed;
    setMode({ type: 'sail', pointsLeft, totalPoints: sailBasePoints, bribesUsed: 0, queuedMoves: existingMoves });
    setSelectedAction(ActionType.SAIL);
  }, [sailBasePoints]);

  // ── Execute action (from ActionBar or action space click) ──
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
        const baseDrawCount = 2;
        const baseKeepCount = 1;
        const maxBribes = currentPlayer.doubloons;
        const maxPeek = Math.min(baseDrawCount + maxBribes, G.chartDeck.drawPile.length);
        const peeked = G.chartDeck.drawPile.slice(0, maxPeek);
        if (peeked.length === 0) break;
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

  const handlePlaceCaptain = useCallback((action: ActionType) => { moves.placeCaptain(action); }, [moves]);

  const handleForfeit = useCallback(() => {
    moves.skipAction?.();
    setMode({ type: 'idle' });
    setSelectedAction(null);
  }, [moves]);

  const handleCancel = useCallback(() => {
    setMode({ type: 'idle' });
    setSelectedAction(null);
  }, []);

  const handleSailDone = useCallback(() => {
    if (mode.type === 'sail' && mode.queuedMoves.length > 0) {
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

  return {
    mode,
    setMode,
    modeRef,
    selectedAction,
    setSelectedAction,
    windTokenPos,
    setWindTokenPos,
    windTokenFlip,
    setWindTokenFlip,

    currentPlayer,
    phase,
    power,
    sailMaxDist,
    sailBasePoints,
    powerSailCheck,

    submitSail,
    enterSailMode,
    handleExecuteAction,
    handlePlaceCaptain,
    handleForfeit,
    handleCancel,
    handleSailDone,
    handleSailBuyPoint,
  };
}
