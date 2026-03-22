import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import * as THREE from 'three';
import { SceneManager, QualityTier } from '../renderer/SceneManager';
import { GameRenderer } from '../renderer/GameRenderer';
import type { NotoriousState } from '../game/types/GameState';
import { hexToKey, HexCoord, hexEquals } from '../types/CoordinateTypes';
import { ActionType, ShipType, WindDirection, GAME_CONSTANTS, ChartType } from '../types/GameTypes';
import { getReachableHexes } from '../game/logic/SailLogic';
import { getPlayerShips, getHexController, findPathOnBoard, getIslandByName } from '../game/logic/BoardLogic';
import { TreasureMapChart, SmugglerRouteChart, AnyChart } from '../core/Chart';
import './hud/hud.css';
import { ActionBar } from './hud/ActionBar';
import { PlayerPanel } from './hud/PlayerPanel';
import { WindTokenIndicator } from './hud/WindTokenIndicator';
import { PhaseIndicator } from './hud/PhaseIndicator';
import { ChartDialog } from './dialogs/ChartDialog';
import { StealDialog } from './dialogs/StealDialog';
import { SinkDialog } from './dialogs/SinkDialog';
import { BuildDialog } from './dialogs/BuildDialog';
import { PiratePower } from '../types/GameTypes';
import { ChartHand } from './hud/ChartHand';
import { ScoreTrack } from './hud/ScoreTrack';
import { chartLabel, chartColor } from './utils/chartFormatting';
import { MobilePlayerDrawer } from './hud/MobilePlayerDrawer';
import { useMobile } from './hooks/useMobile';
import { pickAIMove } from '../game/ai/AIPlayer';
import {
  useInteractionMode,
  handleHexClick,
  getInstruction,
  getHighlightsForMode,
  type SailMove,
} from './hooks/useInteractionMode';

function canClaimChart(chart: AnyChart, G: NotoriousState, playerId: string): boolean {
  if (chart.type === ChartType.TREASURE_MAP) {
    const tm = chart as unknown as TreasureMapChart;
    const ships = getPlayerShips(G.board, tm.targetHex, playerId);
    const hasGalleon = ships.some(s => s.type === ShipType.GALLEON);
    const controller = getHexController(G.board, tm.targetHex);
    return hasGalleon && controller === playerId;
  }
  if (chart.type === ChartType.SMUGGLER_ROUTE) {
    const sr = chart as unknown as SmugglerRouteChart;
    const islandA = getIslandByName(G.board, sr.islandA);
    const islandB = getIslandByName(G.board, sr.islandB);
    if (!islandA || !islandB) return false;
    const path = findPathOnBoard(G.board, islandA.hexCoord, islandB.hexCoord);
    if (path.length === 0) return false;
    return path.every(hexCoord => getPlayerShips(G.board, hexCoord, playerId).length > 0);
  }
  return false;
}

export function GameScreen({ G, ctx, moves }: BoardProps<NotoriousState>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const dragShipRef = useRef<any>(null);
  const lastShipHoverKey = useRef<string | null>(null);

  const { isMobile, isTablet, isTouchDevice } = useMobile();

  const {
    mode, setMode, modeRef,
    selectedAction, setSelectedAction,
    windTokenPos, setWindTokenPos,
    windTokenFlip, setWindTokenFlip,
    currentPlayer, phase, power,
    sailMaxDist, sailBasePoints, powerSailCheck,
    submitSail, enterSailMode,
    handleExecuteAction, handlePlaceCaptain,
    handleForfeit, handleCancel: handleCancelRaw,
    handleSailDone: handleSailDoneRaw,
    handleSailBuyPoint,
  } = useInteractionMode({ G, ctx, moves });

  // Wrap handleCancel to also sync renderer state
  const handleCancel = useCallback(() => {
    handleCancelRaw();
    const r = rendererRef.current;
    if (r) { r.clearHighlights(); r.clearPendingMoves(); r.syncState(G); }
  }, [handleCancelRaw, G]);

  // Wrap handleSailDone to clear pending moves
  const handleSailDone = useCallback(() => {
    rendererRef.current?.clearPendingMoves();
    handleSailDoneRaw();
  }, [handleSailDoneRaw]);

  // Init Three.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const quality: QualityTier = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'low' : 'high';
    const scene = new SceneManager(canvas, quality);
    const gameRenderer = new GameRenderer(scene);
    sceneRef.current = scene;
    rendererRef.current = gameRenderer;
    scene.start();
    return () => { gameRenderer.dispose(); scene.dispose(); sceneRef.current = null; rendererRef.current = null; };
  }, []);

  // Reset on phase/turn change
  useEffect(() => {
    // Release any in-progress drag state
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setDragLock(false);
      renderer.clearPendingMoves();
    }
    dragShipRef.current = null;

    if (phase === 'setup') setMode({ type: 'setup' });
    else if (phase === 'place') { setMode({ type: 'place_captain' }); setSelectedAction(null); }
    else if (phase === 'play') { setMode({ type: 'idle' }); setSelectedAction(null); }
    else if (phase === 'pirate') { setMode({ type: 'pirate' }); setSelectedAction(null); }
    else setMode({ type: 'idle' });
  }, [phase, ctx.currentPlayer]);

  // AI auto-play
  useEffect(() => {
    if (!currentPlayer?.isAI) return;
    if (ctx.gameover) return;

    const timer = setTimeout(() => {
      const aiMove = pickAIMove(G, ctx);
      if (aiMove && moves[aiMove.move]) {
        (moves as any)[aiMove.move](...aiMove.args);
      }
    }, 600);

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

      const maxReach = Math.min(pointsLeft, sailMaxDist);
      const reachable = getReachableHexes(G.board, coord, maxReach, powerSailCheck);
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

        if (shipMesh) {
          renderer.applyPendingMove(shipMesh, hexToKey(from), to);
        }

        if (newPointsLeft <= 0) {
          renderer.clearPendingMoves();
          submitSail(allMoves);
        } else {
          renderer.clearHighlights();
          setMode({ type: 'sail', pointsLeft: newPointsLeft, totalPoints: m.totalPoints, bribesUsed: m.bribesUsed, queuedMoves: allMoves });
        }
      } else {
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
      handleHexClick(coord, mode, G, ctx.currentPlayer, currentPlayer, power, moves, setMode);
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

    const highlights = getHighlightsForMode(mode, G, ctx.currentPlayer, currentPlayer);
    if (highlights.selected.length > 0) renderer.setHighlights(highlights.selected, 'selected');
    if (highlights.valid.length > 0) renderer.setHighlights(highlights.valid, 'valid');
  }, [G, mode, ctx.currentPlayer]);

  // Wire action space clicks
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

  let instruction = getInstruction(mode, phase, currentPlayer, power);
  // Override instruction when a hex-selection mode has no valid targets
  if (['steal_select_hex', 'sink_select_hex', 'build_select_hex'].includes(mode.type)) {
    const highlights = getHighlightsForMode(mode, G, ctx.currentPlayer, currentPlayer);
    if (highlights.valid.length === 0) {
      instruction = 'No valid targets — cancel to choose another action';
    }
  }
  const isSailActive = mode.type === 'sail' || mode.type === 'sail_dragging';
  const sailHasQueuedMoves = (mode.type === 'sail' && mode.queuedMoves.length > 0);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <PhaseIndicator phase={phase} currentPlayer={currentPlayer} windToken={G.windToken} players={G.players} instruction={instruction} />

      <div style={{
        position: 'absolute',
        top: isTablet ? 6 : 12,
        left: isTablet ? 6 : '50%',
        right: isTablet ? (isTablet ? 90 : undefined) : undefined,
        transform: isTablet ? 'none' : 'translateX(-50%)',
      }}>
        <ScoreTrack players={G.players} currentPlayerId={ctx.currentPlayer} />
      </div>

      {isTablet ? (
        <MobilePlayerDrawer players={G.players} currentPlayerId={ctx.currentPlayer} />
      ) : (
        <div data-testid="desktop-player-panels" style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {G.players.map((p, i) => (
            <React.Fragment key={p.id}>
              {i === G.windToken.position + 1 && (
                <WindTokenIndicator placeDirection={G.windToken.placeDirection} />
              )}
              <PlayerPanel player={p} isActive={ctx.currentPlayer === p.id} />
            </React.Fragment>
          ))}
          {G.windToken.position + 1 >= G.players.length && (
            <WindTokenIndicator placeDirection={G.windToken.placeDirection} />
          )}
        </div>
      )}

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
        const sloopMoveBribes = power ? power.modifySinkCost(mode.sloopMoves.length, { movingSloop: mode.sloopMoves.length > 0 }) : mode.sloopMoves.length;
        const isRelentless = currentPlayer.piratePower === PiratePower.THE_RELENTLESS;
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

      {hoveredHex && (() => {
        const hex = G.board.hexes[hoveredHex];
        const parts: string[] = [];
        if (hex?.island) parts.push(hex.island.name);
        if (hex?.ships.length) parts.push(`${hex.ships.length} ship${hex.ships.length > 1 ? 's' : ''}`);
        if (parts.length === 0) return null;
        return (
          <div className="hex-info" style={{
            position: 'absolute',
            bottom: isSailActive ? 70 : (phase === 'place' || phase === 'play' ? 80 : 12),
            left: 14,
          }}>
            {parts.join(' · ')}
          </div>
        );
      })()}

      {/* Pirate phase controls */}
      {mode.type === 'pirate' && (
        <div className="hud-panel pirate-panel" style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="pirate-panel__title">Pirate Phase</span>
            <button className="hud-btn hud-btn--confirm" onClick={() => {
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
              {currentPlayer.charts.map(chart => {
                const claimable = canClaimChart(chart as AnyChart, G, ctx.currentPlayer);
                return (
                  <div key={chart.id} className="claim-row"
                    style={{ borderLeft: `3px solid ${chartColor(chart)}` }}>
                    <span>{chartLabel(chart)}</span>
                    <button
                      className={`hud-btn claim-btn ${claimable ? 'hud-btn--confirm' : ''}`}
                      disabled={!claimable}
                      title={claimable ? 'Claim this chart' : 'Requirements not met to claim this chart'}
                      onClick={() => moves.claimChart({ chartId: chart.id })}>
                      Claim
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {G.chartDeck.islandRaids.length > 0 && (() => {
            const maxNot = Math.max(...G.players.map(p => p.notoriety));
            return (
              <div>
                <div className="pirate-panel__section-label">Island Raids</div>
                {G.chartDeck.islandRaids.map((raid) => {
                  const threshold = (raid as any).claimThreshold ?? GAME_CONSTANTS.ISLAND_RAID_THRESHOLDS[0];
                  const claimable = maxNot >= threshold;
                  return (
                    <div key={raid.id} className="claim-row" style={{
                      borderLeft: `3px solid ${claimable ? '#cc4444' : '#a89060'}`,
                      opacity: claimable ? 1 : 0.55,
                    }}>
                      <span>
                        {(raid as any).targetIsland} — {(raid as any).notorietyReward} not. + {(raid as any).doubloonsOnChart} dbl.
                        {!claimable && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                            (unlocks at {threshold})
                          </span>
                        )}
                      </span>
                      <button className="hud-btn hud-btn--confirm claim-btn"
                        disabled={!claimable}
                        style={!claimable ? { opacity: 0.4, cursor: 'default' } : {}}
                        onClick={() => claimable && moves.claimChart({ chartId: raid.id })}>
                        Claim
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

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
                  {G.players[i].name.charAt(0)}–{G.players[(i + 1) % G.players.length].name.charAt(0)}
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
