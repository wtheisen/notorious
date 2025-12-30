import React, { useState, useEffect } from 'react';
import { NotoriousState, hexToKey, Ship } from '../game/types/GameState';
import { ActionType, ShipType, ChartType } from '../types/GameTypes';
import { HexCoord, hexEquals } from '../types/CoordinateTypes';
import { getPlayerShips, getInfluence, getHexController, getIslandByName, findPathOnBoard } from '../game/logic/BoardLogic';
import { hexDistance } from '../utils/HexMath';
import { getPowerStrategy } from '../core/powers';
import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../core/Chart';
import { SailState, TargetSelection } from '../App';

/**
 * Get player color for UI elements
 */
function getPlayerColorForUI(playerId: string): string {
  const colors: Record<string, string> = {
    '0': '#4A90E2',  // Blue
    '1': '#E24A4A',  // Red
    '2': '#4AE290',  // Green
    '3': '#E2D24A'   // Yellow
  };
  return colors[playerId] || '#888888';
}

interface GameUIProps {
  G: NotoriousState;
  ctx: any;
  moves: any;
  playerID?: string | null;  // Optional - defaults to "0" (human player)
  selectedAction: ActionType | null;
  setSelectedAction: (action: ActionType | null) => void;
  selectedHex: HexCoord | null;
  setSelectedHex: (hex: HexCoord | null) => void;
  resetActionState: () => void;
  sailState: SailState;
  setSailState: (state: SailState) => void;
  targetSelection: TargetSelection | null;
  setTargetSelection: (target: TargetSelection | null) => void;
}

/**
 * Check if a chart can be claimed and return status info
 */
function getChartClaimStatus(
  chart: AnyChart,
  G: NotoriousState,
  playerId: string
): { canClaim: boolean; reason?: string; reward: string } {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: {
      const treasureMap = chart as TreasureMapChart;
      const playerShips = getPlayerShips(G.board, treasureMap.targetHex, playerId);
      const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
      const controller = getHexController(G.board, treasureMap.targetHex);

      if (!hasGalleon) {
        return { canClaim: false, reason: 'Need Galleon at target hex', reward: `${G.players.length}d` };
      }
      if (controller !== playerId) {
        return { canClaim: false, reason: 'Must control target hex', reward: `${G.players.length}d` };
      }
      return { canClaim: true, reward: `${G.players.length}d` };
    }

    case ChartType.ISLAND_RAID: {
      const islandRaid = chart as IslandRaidChart;
      const island = getIslandByName(G.board, islandRaid.targetIsland);
      if (!island) {
        return { canClaim: false, reason: 'Island not found', reward: `4n + ${islandRaid.doubloonsOnChart}d` };
      }

      const playerShips = getPlayerShips(G.board, island.hexCoord, playerId);
      const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
      const controller = getHexController(G.board, island.hexCoord);

      if (!hasGalleon) {
        return { canClaim: false, reason: 'Need Galleon on island', reward: `4n + ${islandRaid.doubloonsOnChart}d` };
      }
      if (controller !== playerId) {
        return { canClaim: false, reason: 'Must control island', reward: `4n + ${islandRaid.doubloonsOnChart}d` };
      }
      if (islandRaid.doubloonsOnChart < 2) {
        return { canClaim: false, reason: 'Needs 2+ doubloons', reward: `4n + ${islandRaid.doubloonsOnChart}d` };
      }
      return { canClaim: true, reward: `4n + ${islandRaid.doubloonsOnChart}d` };
    }

    case ChartType.SMUGGLER_ROUTE: {
      const smugglerRoute = chart as SmugglerRouteChart;
      const islandA = getIslandByName(G.board, smugglerRoute.islandA);
      const islandB = getIslandByName(G.board, smugglerRoute.islandB);

      if (!islandA || !islandB) {
        return { canClaim: false, reason: 'Islands not found', reward: '?d' };
      }

      const path = findPathOnBoard(G.board, islandA.hexCoord, islandB.hexCoord);
      if (path.length === 0) {
        return { canClaim: false, reason: 'No path between islands', reward: '?d' };
      }

      // Check player has ships on entire path
      for (const hexCoord of path) {
        const playerShips = getPlayerShips(G.board, hexCoord, playerId);
        if (playerShips.length === 0) {
          return { canClaim: false, reason: 'Need ships on entire path', reward: `${path.length}d` };
        }
      }

      return { canClaim: true, reward: `${path.length}d` };
    }

    default:
      return { canClaim: false, reason: 'Unknown chart type', reward: '?' };
  }
}

/**
 * Get human-readable description of a chart
 */
function getChartDescription(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: {
      const tm = chart as TreasureMapChart;
      return `Target: (${tm.targetHex.q}, ${tm.targetHex.r})`;
    }
    case ChartType.ISLAND_RAID: {
      const ir = chart as IslandRaidChart;
      return `Target: ${ir.targetIsland}, Reward: 4 notoriety + ${ir.doubloonsOnChart} doubloons`;
    }
    case ChartType.SMUGGLER_ROUTE: {
      const sr = chart as SmugglerRouteChart;
      return `Route: ${sr.islandA} to ${sr.islandB}`;
    }
    default:
      return 'Unknown chart';
  }
}

/**
 * Game UI component - displays player stats, action buttons, and game info
 */
export const GameUI: React.FC<GameUIProps> = ({
  G, ctx, moves, playerID,
  selectedAction, setSelectedAction, selectedHex, setSelectedHex, resetActionState,
  sailState, setSailState, targetSelection, setTargetSelection
}) => {
  // Action-specific state
  const [buildShipType, setBuildShipType] = useState<'sloops' | 'galleon'>('sloops');
  const [bribeCount, setBribeCount] = useState(0);
  const [stealTargetPlayer, setStealTargetPlayer] = useState<string | null>(null);
  const [stealReplace, setStealReplace] = useState(true);
  const [sinkTargetPlayer, setSinkTargetPlayer] = useState<string | null>(null);
  const [sinkTargetShip, setSinkTargetShip] = useState<ShipType>(ShipType.SLOOP);
  const [sinkAdditionalTargets, setSinkAdditionalTargets] = useState<Array<{ shipType: ShipType; playerId: string }>>([]);
  const [sinkSloopMoves, setSinkSloopMoves] = useState<Array<{ from: HexCoord; to: HexCoord }>>([]);
  const [sinkSloopMoveSource, setSinkSloopMoveSource] = useState<HexCoord | null>(null);
  const [chartDrawExtra, setChartDrawExtra] = useState(false);
  const [chartKeepExtra, setChartKeepExtra] = useState(false);

  // Default to player 0 (human player) if playerID not provided
  const effectivePlayerID = playerID ?? '0';
  const player = G.players.find(p => p.id === effectivePlayerID);

  // Reset action-specific state when action changes
  useEffect(() => {
    setBribeCount(0);
    setStealTargetPlayer(null);
    setStealReplace(true);
    setSinkTargetPlayer(null);
    setSinkTargetShip(ShipType.SLOOP);
    setSinkAdditionalTargets([]);
    setSinkSloopMoves([]);
    setSinkSloopMoveSource(null);
  }, [selectedAction]);

  // Sync targetSelection (from clicking ships on board) with local state
  useEffect(() => {
    if (targetSelection) {
      if (selectedAction === ActionType.STEAL) {
        setStealTargetPlayer(targetSelection.playerId);
      } else if (selectedAction === ActionType.SINK) {
        setSinkTargetPlayer(targetSelection.playerId);
        setSinkTargetShip(targetSelection.shipType);
      }
    }
  }, [targetSelection, selectedAction]);

  // Handle SAIL action hex clicks
  useEffect(() => {
    if (selectedAction !== ActionType.SAIL || !selectedHex) return;

    const playerShips = getPlayerShips(G.board, selectedHex, effectivePlayerID);
    const movableShips = playerShips.filter(s => s.type !== ShipType.PORT);

    // Step 1: No ship selected yet - clicked on a hex with player's ships
    if (!sailState.selectedShip && !sailState.sourceHex) {
      if (movableShips.length > 0) {
        // Auto-select if only one ship, otherwise set source for ship picker
        if (movableShips.length === 1) {
          setSailState({
            ...sailState,
            sourceHex: selectedHex,
            selectedShip: movableShips[0]
          });
        } else {
          // Multiple ships - show ship picker (sourceHex set, no ship yet)
          setSailState({
            ...sailState,
            sourceHex: selectedHex,
            selectedShip: null
          });
        }
        setSelectedHex(null);
      }
      return;
    }

    // Step 2: Source hex set but no ship selected (multiple ships case)
    // Ship selection is handled in the UI dialog, not here

    // Step 3: Ship selected - this is a destination click
    if (sailState.selectedShip && sailState.sourceHex) {
      // Add this move to planned moves
      const newMove = {
        shipType: sailState.selectedShip.type,
        from: sailState.sourceHex,
        to: selectedHex
      };
      setSailState({
        ...sailState,
        plannedMoves: [...sailState.plannedMoves, newMove],
        sourceHex: null,
        selectedShip: null
      });
      setSelectedHex(null);
    }
  }, [selectedHex, selectedAction, sailState, effectivePlayerID, G.board, setSailState, setSelectedHex]);

  if (!player) {
    return <div style={styles.container}>Loading...</div>;
  }

  const isMyTurn = ctx.currentPlayer === effectivePlayerID;
  const currentPhase = ctx.phase;

  return (
    <div style={styles.container}>
      {/* Player Info */}
      <div style={styles.section}>
        <h2 style={styles.header}>{player.name}</h2>
        {/* Pirate Power */}
        <div style={styles.powerBox}>
          <strong>{getPowerStrategy(player.piratePower).name}</strong>
          <div style={styles.powerDescription}>
            {getPowerStrategy(player.piratePower).description}
          </div>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Notoriety:</span>
          <span style={styles.statValue}>{player.notoriety} / 24</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Doubloons:</span>
          <span style={styles.statValue}>{player.doubloons}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Captains:</span>
          <span style={styles.statValue}>{player.captainCount}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Sloops:</span>
          <span style={styles.statValue}>{player.ships.sloops}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Galleons:</span>
          <span style={styles.statValue}>{player.ships.galleons}</span>
        </div>
      </div>

      {/* Phase and Turn Info */}
      <div style={styles.section}>
        <h3 style={styles.subheader}>Game Status</h3>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Phase:</span>
          <span style={styles.statValue}>{currentPhase}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Turn:</span>
          <span style={styles.statValue}>
            {isMyTurn ? 'YOUR TURN' : `Player ${parseInt(ctx.currentPlayer) + 1}'s turn`}
          </span>
        </div>
      </div>

      {/* SETUP Phase UI */}
      {currentPhase === 'setup' && (
        <div style={styles.section}>
          <h3 style={styles.subheader}>Game Setup</h3>
          {isMyTurn ? (
            <div style={styles.actionDialog}>
              <strong>Place Your Port</strong>
              <p>Click on any empty hex (not on an island) to place your port and 2 starting sloops.</p>
              {selectedHex && (
                <>
                  <p>Selected: ({selectedHex.q}, {selectedHex.r})</p>
                  <button
                    onClick={() => {
                      moves.placePortAndShips(selectedHex);
                      resetActionState();
                    }}
                    style={styles.executeButton}
                  >
                    Place Port Here
                  </button>
                </>
              )}
            </div>
          ) : (
            <p style={styles.info}>Waiting for Player {parseInt(ctx.currentPlayer) + 1} to place their port...</p>
          )}
        </div>
      )}

      {/* PLACE Phase UI - Captain Placement Board */}
      {currentPhase === 'place' && (
        <div style={styles.section}>
          <h3 style={styles.subheader}>Captain Placement</h3>
          {isMyTurn ? (
            <p style={styles.info}>
              Your turn! Place captains: {player.placedCaptains.length} / {player.captainCount}
            </p>
          ) : (
            <p style={styles.info}>
              Waiting for Player {parseInt(ctx.currentPlayer) + 1}...
            </p>
          )}

          {/* Action slots with captain indicators */}
          <div style={styles.captainBoard}>
            {[ActionType.SAIL, ActionType.BUILD, ActionType.STEAL, ActionType.SINK, ActionType.CHART].map(action => {
              // Count captains per player for this action
              const captainsByPlayer = G.players.map(p => ({
                playerId: p.id,
                playerName: p.name,
                color: getPlayerColorForUI(p.id),
                count: p.placedCaptains.filter(a => a === action).length
              }));

              const canPlace = isMyTurn && player.placedCaptains.length < player.captainCount;

              return (
                <div
                  key={action}
                  onClick={() => canPlace && moves.placeCaptain(action)}
                  style={{
                    ...styles.actionSlot,
                    cursor: canPlace ? 'pointer' : 'default',
                    backgroundColor: canPlace ? '#3a3a5e' : '#2a2a3e',
                    border: canPlace ? '2px solid #4CAF50' : '2px solid #444'
                  }}
                >
                  <div style={styles.actionName}>{action}</div>
                  <div style={styles.captainIndicators}>
                    {captainsByPlayer.map(({ playerId, color, count }) => (
                      <div key={playerId} style={styles.playerCaptains}>
                        {Array.from({ length: count }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              ...styles.captainDot,
                              backgroundColor: color
                            }}
                            title={`Player ${parseInt(playerId) + 1}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend showing player colors */}
          <div style={styles.playerLegend}>
            {G.players.map(p => (
              <div key={p.id} style={styles.legendItem}>
                <div style={{
                  ...styles.captainDot,
                  backgroundColor: getPlayerColorForUI(p.id)
                }} />
                <span style={{ fontSize: '11px', color: '#aaa' }}>
                  {p.name} ({p.placedCaptains.length}/{p.captainCount})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLAY Phase UI */}
      {currentPhase === 'play' && isMyTurn && (
        <div style={styles.section}>
          <h3 style={styles.subheader}>Execute Action</h3>
          {player.placedCaptains.length > 0 ? (
            <>
              <p style={styles.info}>Available captains:</p>
              <div style={styles.buttonGrid}>
                {player.placedCaptains.map((action, index) => (
                  <button
                    key={`${action}-${index}`}
                    onClick={() => setSelectedAction(action)}
                    style={{
                      ...styles.button,
                      ...(selectedAction === action ? styles.buttonSelected : {})
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* CHART Action Dialog */}
              {selectedAction === ActionType.CHART && (
                <div style={styles.actionDialog}>
                  <strong>CHART Action</strong>
                  <p>Draw charts and gain Wind Token</p>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={chartDrawExtra}
                      onChange={(e) => setChartDrawExtra(e.target.checked)}
                      disabled={player.doubloons < (chartDrawExtra ? 0 : 1)}
                    />
                    Draw 3 instead of 2 (1 doubloon)
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={chartKeepExtra}
                      onChange={(e) => setChartKeepExtra(e.target.checked)}
                      disabled={player.doubloons < (chartKeepExtra ? 0 : 1)}
                    />
                    Keep 2 instead of 1 (1 doubloon)
                  </label>
                  <button
                    onClick={() => {
                      const bribesUsed = (chartDrawExtra ? 1 : 0) + (chartKeepExtra ? 1 : 0);
                      moves.chart({ bribesUsed, drawExtra: chartDrawExtra, keepExtra: chartKeepExtra });
                      resetActionState();
                    }}
                    style={styles.executeButton}
                  >
                    Execute Chart ({(chartDrawExtra ? 1 : 0) + (chartKeepExtra ? 1 : 0)} doubloons)
                  </button>
                </div>
              )}

              {/* BUILD Action Dialog */}
              {selectedAction === ActionType.BUILD && (
                <div style={styles.actionDialog}>
                  <strong>BUILD Action</strong>
                  {!selectedHex ? (
                    <p>Click a hex where you have ships (or your port)</p>
                  ) : (
                    <>
                      <p>Building at ({selectedHex.q}, {selectedHex.r})</p>
                      <div style={styles.buttonGrid}>
                        <button
                          onClick={() => setBuildShipType('sloops')}
                          style={{...styles.button, ...(buildShipType === 'sloops' ? styles.buttonSelected : {})}}
                          disabled={player.ships.sloops < 2}
                        >
                          2 Sloops
                        </button>
                        <button
                          onClick={() => setBuildShipType('galleon')}
                          style={{...styles.button, ...(buildShipType === 'galleon' ? styles.buttonSelected : {})}}
                          disabled={player.ships.galleons < 1}
                        >
                          1 Galleon
                        </button>
                      </div>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={bribeCount > 0}
                          onChange={(e) => setBribeCount(e.target.checked ? 1 : 0)}
                          disabled={player.doubloons < 1 || player.ships.sloops < (buildShipType === 'sloops' ? 3 : 1)}
                        />
                        Add extra Sloop (1 doubloon)
                      </label>
                      <button
                        onClick={() => {
                          const placements = buildShipType === 'galleon'
                            ? [ShipType.GALLEON]
                            : [ShipType.SLOOP, ShipType.SLOOP];
                          if (bribeCount > 0) placements.push(ShipType.SLOOP);
                          moves.build({ hex: selectedHex, placements, bribesUsed: bribeCount });
                          resetActionState();
                        }}
                        style={styles.executeButton}
                      >
                        Build {buildShipType === 'galleon' ? '1 Galleon' : '2 Sloops'}{bribeCount > 0 ? ' + 1 Sloop' : ''}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STEAL Action Dialog */}
              {selectedAction === ActionType.STEAL && (
                <div style={styles.actionDialog}>
                  <strong>STEAL Action</strong>
                  <div style={styles.sailInfo}>
                    Take an opponent's sloop and send it back to their inventory
                  </div>

                  {/* Step 1: Select hex */}
                  {!selectedHex && (
                    <div style={styles.sailStep}>
                      <div style={styles.stepNumber}>1</div>
                      <p>Click a hex where you have ships AND an opponent has a sloop (highlighted in green)</p>
                    </div>
                  )}

                  {/* Step 2: Configure steal */}
                  {selectedHex && (() => {
                    const hex = G.board.hexes[hexToKey(selectedHex)];
                    const opponentSloops = hex?.ships.filter(s => s.playerId !== effectivePlayerID && s.type === ShipType.SLOOP) || [];
                    const targetPlayers = [...new Set(opponentSloops.map(s => s.playerId))];
                    const selectedTarget = stealTargetPlayer || targetPlayers[0];
                    const targetPlayer = G.players.find(p => p.id === selectedTarget);

                    return (
                      <div style={styles.sailStep}>
                        <div style={styles.stepNumber}>2</div>
                        <p style={{ marginBottom: '10px' }}>
                          Stealing at ({selectedHex.q}, {selectedHex.r})
                        </p>

                        {/* Target player selection */}
                        {targetPlayers.length > 1 ? (
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '13px', marginBottom: '6px' }}>Select target player:</p>
                            <div style={styles.shipPicker}>
                              {targetPlayers.map(pid => {
                                const p = G.players.find(pl => pl.id === pid);
                                return (
                                  <button
                                    key={pid}
                                    onClick={() => setStealTargetPlayer(pid)}
                                    style={{
                                      ...styles.shipButton,
                                      borderColor: getPlayerColorForUI(pid),
                                      backgroundColor: stealTargetPlayer === pid ? getPlayerColorForUI(pid) : '#fff',
                                      color: stealTargetPlayer === pid ? '#fff' : getPlayerColorForUI(pid)
                                    }}
                                  >
                                    {p?.name || `Player ${parseInt(pid) + 1}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: getPlayerColorForUI(selectedTarget), marginRight: '8px' }}></span>
                            Stealing from <strong>{targetPlayer?.name || `Player ${parseInt(selectedTarget) + 1}`}</strong>
                          </div>
                        )}

                        {/* Replace option */}
                        <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #ddd', marginBottom: '12px' }}>
                          <label style={{ ...styles.checkboxLabel, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={stealReplace}
                              onChange={(e) => setStealReplace(e.target.checked)}
                              disabled={player.ships.sloops < 1}
                            />
                            <span>
                              Replace with your sloop
                              {player.ships.sloops < 1 && <span style={{ color: '#E24A4A', fontSize: '12px' }}> (no sloops available)</span>}
                            </span>
                          </label>
                        </div>

                        <button
                          onClick={() => {
                            moves.steal({ hex: selectedHex, targetPlayerId: selectedTarget, replaceWithSloop: stealReplace });
                            resetActionState();
                          }}
                          style={styles.executeButton}
                          disabled={targetPlayers.length === 0}
                        >
                          Steal Sloop {stealReplace ? '& Replace' : ''}
                        </button>

                        <button
                          onClick={() => setSelectedHex(null)}
                          style={{ ...styles.button, marginTop: '8px', width: '100%' }}
                        >
                          ← Back
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SINK Action Dialog */}
              {selectedAction === ActionType.SINK && (() => {
                const power = getPowerStrategy(player.piratePower);
                const isRelentless = power.id === 'THE_RELENTLESS';

                // Calculate sloop move cost (Relentless gets first free)
                const sloopMoveCost = isRelentless
                  ? Math.max(0, sinkSloopMoves.length - 1)
                  : sinkSloopMoves.length;

                // Calculate total bribes needed
                const additionalSinkCost = sinkAdditionalTargets.length;
                const totalBribesNeeded = sloopMoveCost + additionalSinkCost;

                // Find hexes with player's sloops for movement
                const playerSloopHexes = Object.values(G.board.hexes).filter(hex =>
                  hex.ships.some(s => s.playerId === effectivePlayerID && s.type === ShipType.SLOOP)
                );

                // Get adjacent hexes for sloop movement destination
                const getAdjacentHexes = (coord: HexCoord): HexCoord[] => {
                  const directions = [
                    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
                    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
                  ];
                  return directions
                    .map(d => ({ q: coord.q + d.q, r: coord.r + d.r, s: -(coord.q + d.q) - (coord.r + d.r) }))
                    .filter(c => G.board.hexes[hexToKey(c)] !== undefined);
                };

                return (
                <div style={styles.actionDialog}>
                  <strong>SINK Action</strong>
                  <div style={styles.sailInfo}>
                    Remove an opponent's ship. Gain notoriety if they're at least as notorious as you.
                    {isRelentless && (
                      <div style={{ marginTop: '4px', color: '#4CAF50' }}>
                        ✨ The Relentless: First sloop move is FREE!
                      </div>
                    )}
                  </div>

                  {/* Step 1: Select hex */}
                  {!selectedHex && !sinkSloopMoveSource && (
                    <div style={styles.sailStep}>
                      <div style={styles.stepNumber}>1</div>
                      <p>Click a hex where you have ships AND an opponent has ships (highlighted in green)</p>
                    </div>
                  )}

                  {/* Sloop movement mode */}
                  {sinkSloopMoveSource && (
                    <div style={styles.sailStep}>
                      <div style={{ ...styles.stepNumber, backgroundColor: '#FFA500' }}>⛵</div>
                      <p style={{ marginBottom: '10px' }}>
                        Moving sloop from ({sinkSloopMoveSource.q}, {sinkSloopMoveSource.r})
                      </p>
                      <p style={{ fontSize: '13px', marginBottom: '10px' }}>Select destination (1 hex away):</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {getAdjacentHexes(sinkSloopMoveSource).map(dest => (
                          <button
                            key={hexToKey(dest)}
                            onClick={() => {
                              setSinkSloopMoves([...sinkSloopMoves, { from: sinkSloopMoveSource, to: dest }]);
                              setSinkSloopMoveSource(null);
                            }}
                            style={{ ...styles.button, padding: '8px 12px', fontSize: '12px' }}
                          >
                            ({dest.q}, {dest.r})
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setSinkSloopMoveSource(null)}
                        style={{ ...styles.button, marginTop: '10px', width: '100%' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Step 2: Configure sink */}
                  {selectedHex && !sinkSloopMoveSource && (() => {
                    const hex = G.board.hexes[hexToKey(selectedHex)];
                    const opponentShips = hex?.ships.filter(s => s.playerId !== effectivePlayerID && s.type !== ShipType.PORT) || [];
                    const targetPlayers = [...new Set(opponentShips.map(s => s.playerId))];
                    const selectedTarget = sinkTargetPlayer || targetPlayers[0];
                    const targetPlayer = G.players.find(p => p.id === selectedTarget);
                    const playerInfluence = getInfluence(G.board, selectedHex, effectivePlayerID);
                    const targetInfluence = getInfluence(G.board, selectedHex, selectedTarget);
                    const canSinkGalleon = playerInfluence >= targetInfluence;

                    // Get target's ships for counting
                    const targetShipsAtHex = hex?.ships.filter(s => s.playerId === selectedTarget) || [];
                    const targetSloopCount = targetShipsAtHex.filter(s => s.type === ShipType.SLOOP).length;
                    const targetGalleonCount = targetShipsAtHex.filter(s => s.type === ShipType.GALLEON).length;

                    // Calculate how many of each we're already sinking
                    const sinkingSloops = (sinkTargetShip === ShipType.SLOOP ? 1 : 0) +
                      sinkAdditionalTargets.filter(t => t.playerId === selectedTarget && t.shipType === ShipType.SLOOP).length;
                    const sinkingGalleons = (sinkTargetShip === ShipType.GALLEON ? 1 : 0) +
                      sinkAdditionalTargets.filter(t => t.playerId === selectedTarget && t.shipType === ShipType.GALLEON).length;

                    // Can add more sinks?
                    const canAddSloop = targetSloopCount > sinkingSloops;
                    const canAddGalleon = canSinkGalleon && targetGalleonCount > sinkingGalleons;

                    // Calculate notoriety gain
                    const willGainNotoriety = targetPlayer && targetPlayer.notoriety >= player.notoriety;
                    const baseNotoriety = sinkTargetShip === ShipType.SLOOP ? 1 : 3;
                    const additionalNotoriety = sinkAdditionalTargets.reduce((sum, t) => sum + (t.shipType === ShipType.SLOOP ? 1 : 3), 0);
                    const totalNotoriety = willGainNotoriety ? baseNotoriety + additionalNotoriety : 0;

                    return (
                      <div style={styles.sailStep}>
                        <div style={styles.stepNumber}>2</div>
                        <p style={{ marginBottom: '10px' }}>
                          Sinking at ({selectedHex.q}, {selectedHex.r})
                        </p>

                        {/* Influence comparison */}
                        <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Your influence: <strong>{playerInfluence}</strong></span>
                            <span>
                              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getPlayerColorForUI(selectedTarget), marginRight: '4px' }}></span>
                              Their influence: <strong>{targetInfluence}</strong>
                            </span>
                          </div>
                          {!canSinkGalleon && (
                            <div style={{ color: '#E24A4A', marginTop: '4px', fontSize: '12px' }}>
                              ⚠️ Need equal or greater influence to sink Galleons
                            </div>
                          )}
                        </div>

                        {/* Target player selection */}
                        {targetPlayers.length > 1 && (
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '13px', marginBottom: '6px' }}>Select target player:</p>
                            <div style={styles.shipPicker}>
                              {targetPlayers.map(pid => {
                                const p = G.players.find(pl => pl.id === pid);
                                return (
                                  <button
                                    key={pid}
                                    onClick={() => {
                                      setSinkTargetPlayer(pid);
                                      setSinkAdditionalTargets([]);
                                    }}
                                    style={{
                                      ...styles.shipButton,
                                      borderColor: getPlayerColorForUI(pid),
                                      backgroundColor: selectedTarget === pid ? getPlayerColorForUI(pid) : '#fff',
                                      color: selectedTarget === pid ? '#fff' : getPlayerColorForUI(pid)
                                    }}
                                  >
                                    {p?.name || `Player ${parseInt(pid) + 1}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Primary ship to sink */}
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '13px', marginBottom: '6px' }}>Ship to sink:</p>
                          <div style={styles.shipPicker}>
                            {targetSloopCount > 0 && (
                              <button
                                onClick={() => setSinkTargetShip(ShipType.SLOOP)}
                                style={{
                                  ...styles.shipButton,
                                  backgroundColor: sinkTargetShip === ShipType.SLOOP ? '#4A90E2' : '#fff',
                                  color: sinkTargetShip === ShipType.SLOOP ? '#fff' : '#4A90E2'
                                }}
                              >
                                ⛵ Sloop
                              </button>
                            )}
                            {targetGalleonCount > 0 && (
                              <button
                                onClick={() => canSinkGalleon && setSinkTargetShip(ShipType.GALLEON)}
                                disabled={!canSinkGalleon}
                                style={{
                                  ...styles.shipButton,
                                  backgroundColor: sinkTargetShip === ShipType.GALLEON ? '#4A90E2' : '#fff',
                                  color: sinkTargetShip === ShipType.GALLEON ? '#fff' : '#4A90E2',
                                  opacity: canSinkGalleon ? 1 : 0.5
                                }}
                              >
                                🚢 Galleon
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bribe: Move sloops before sinking */}
                        {playerSloopHexes.length > 0 && player.doubloons > totalBribesNeeded && (
                          <div style={styles.bribeOption}>
                            <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                              <strong>Bribe:</strong> Move sloops 1 hex before sinking
                              {isRelentless && <span style={{ color: '#4CAF50' }}> (1st FREE!)</span>}
                              {!isRelentless && <span> (1💰 each)</span>}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {playerSloopHexes.map(sloopHex => (
                                <button
                                  key={hexToKey(sloopHex.coord)}
                                  onClick={() => setSinkSloopMoveSource(sloopHex.coord)}
                                  style={{ ...styles.button, padding: '6px 10px', fontSize: '12px' }}
                                >
                                  ⛵ ({sloopHex.coord.q}, {sloopHex.coord.r})
                                </button>
                              ))}
                            </div>
                            {sinkSloopMoves.length > 0 && (
                              <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#fff', borderRadius: '4px' }}>
                                <span style={{ fontSize: '12px', color: '#666' }}>Sloop moves: </span>
                                {sinkSloopMoves.map((m, i) => (
                                  <span key={i} style={{ fontSize: '11px', marginRight: '8px' }}>
                                    ({m.from.q},{m.from.r})→({m.to.q},{m.to.r})
                                    {isRelentless && i === 0 && <span style={{ color: '#4CAF50' }}> FREE</span>}
                                  </span>
                                ))}
                                <button
                                  onClick={() => setSinkSloopMoves([])}
                                  style={{ ...styles.button, padding: '2px 8px', fontSize: '11px', marginLeft: '4px' }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bribe: Sink additional ships */}
                        {(canAddSloop || canAddGalleon) && player.doubloons > totalBribesNeeded && (
                          <div style={styles.bribeOption}>
                            <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                              <strong>Bribe:</strong> Sink additional ships (1💰 each)
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {canAddSloop && (
                                <button
                                  onClick={() => setSinkAdditionalTargets([...sinkAdditionalTargets, { shipType: ShipType.SLOOP, playerId: selectedTarget }])}
                                  style={{ ...styles.button, padding: '6px 12px', fontSize: '12px' }}
                                >
                                  + Sloop (1💰)
                                </button>
                              )}
                              {canAddGalleon && (
                                <button
                                  onClick={() => setSinkAdditionalTargets([...sinkAdditionalTargets, { shipType: ShipType.GALLEON, playerId: selectedTarget }])}
                                  style={{ ...styles.button, padding: '6px 12px', fontSize: '12px' }}
                                >
                                  + Galleon (1💰)
                                </button>
                              )}
                            </div>
                            {sinkAdditionalTargets.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#666' }}>Additional sinks: </span>
                                {sinkAdditionalTargets.map((t, i) => (
                                  <span key={i} style={{ marginRight: '8px', fontSize: '12px' }}>
                                    {t.shipType === ShipType.SLOOP ? '⛵' : '🚢'}
                                  </span>
                                ))}
                                <button
                                  onClick={() => setSinkAdditionalTargets([])}
                                  style={{ ...styles.button, padding: '2px 8px', fontSize: '11px', marginLeft: '8px' }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Summary */}
                        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#e8f8e8', borderRadius: '6px', border: '1px solid #4CAF50' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span>
                              Sinking: {sinkTargetShip === ShipType.SLOOP ? '⛵' : '🚢'}
                              {sinkAdditionalTargets.map((t, i) => (
                                <span key={i}> + {t.shipType === ShipType.SLOOP ? '⛵' : '🚢'}</span>
                              ))}
                            </span>
                            <span>Cost: {totalBribesNeeded}💰</span>
                          </div>
                          {sinkSloopMoves.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                              Pre-moves: {sinkSloopMoves.length} sloop{sinkSloopMoves.length !== 1 ? 's' : ''}
                              {isRelentless && sinkSloopMoves.length >= 1 && ' (1 free)'}
                            </div>
                          )}
                          <div style={{ marginTop: '4px', fontSize: '13px', color: willGainNotoriety ? '#4CAF50' : '#999' }}>
                            {willGainNotoriety
                              ? `+${totalNotoriety} notoriety`
                              : 'No notoriety (target has less than you)'}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            moves.sink({
                              hex: selectedHex,
                              targetShipType: sinkTargetShip,
                              targetPlayerId: selectedTarget,
                              sloopMovesBefore: sinkSloopMoves,
                              additionalSinks: sinkAdditionalTargets
                            });
                            resetActionState();
                          }}
                          style={styles.executeButton}
                          disabled={targetPlayers.length === 0 || totalBribesNeeded > player.doubloons}
                        >
                          Sink {1 + sinkAdditionalTargets.length} Ship{sinkAdditionalTargets.length > 0 ? 's' : ''} {totalBribesNeeded > 0 ? `(${totalBribesNeeded}💰)` : ''}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedHex(null);
                            setSinkAdditionalTargets([]);
                            setSinkSloopMoves([]);
                          }}
                          style={{ ...styles.button, marginTop: '8px', width: '100%' }}
                        >
                          ← Back
                        </button>
                      </div>
                    );
                  })()}
                </div>
                );
              })()}

              {/* SAIL Action Dialog */}
              {selectedAction === ActionType.SAIL && (() => {
                const power = getPowerStrategy(player.piratePower);
                const baseMovementPoints = power.getSailMaxDistance(); // 2 normally, 3 for Sailor
                const totalMovementPoints = baseMovementPoints + sailState.bribeCount;

                // Calculate movement points used by planned moves
                const usedMovementPoints = sailState.plannedMoves.reduce((sum, move) => {
                  return sum + hexDistance(move.from, move.to);
                }, 0);

                const remainingPoints = totalMovementPoints - usedMovementPoints;

                return (
                <div style={styles.actionDialog}>
                  <strong>SAIL Action</strong>
                  <div style={styles.sailInfo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Movement Points:</span>
                      <span><strong>{usedMovementPoints}</strong> / {totalMovementPoints} used</span>
                    </div>
                    {remainingPoints > 0 && (
                      <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>
                        {remainingPoints} point{remainingPoints !== 1 ? 's' : ''} remaining
                      </div>
                    )}
                  </div>

                  {/* Step 1: No source selected - prompt to click a hex */}
                  {!sailState.sourceHex && sailState.plannedMoves.length === 0 && (
                    <div style={styles.sailStep}>
                      <div style={styles.stepNumber}>1</div>
                      <p>Click a hex with your ships (highlighted in orange)</p>
                    </div>
                  )}

                  {/* Step 2: Source selected but need to pick which ship */}
                  {sailState.sourceHex && !sailState.selectedShip && (() => {
                    const shipsAtSource = getPlayerShips(G.board, sailState.sourceHex, effectivePlayerID)
                      .filter(s => s.type !== ShipType.PORT);
                    return (
                      <div style={styles.sailStep}>
                        <div style={styles.stepNumber}>2</div>
                        <p>Select which ship to move from ({sailState.sourceHex.q}, {sailState.sourceHex.r}):</p>
                        <div style={styles.shipPicker}>
                          {shipsAtSource.map((ship, i) => (
                            <button
                              key={i}
                              onClick={() => setSailState({ ...sailState, selectedShip: ship })}
                              style={styles.shipButton}
                            >
                              {ship.type === ShipType.SLOOP ? '⛵ Sloop' : '🚢 Galleon'}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setSailState({ ...sailState, sourceHex: null })}
                          style={{ ...styles.button, marginTop: '8px' }}
                        >
                          ← Back
                        </button>
                      </div>
                    );
                  })()}

                  {/* Step 3: Ship selected - show destination prompt */}
                  {sailState.sourceHex && sailState.selectedShip && (
                    <div style={styles.sailStep}>
                      <div style={styles.stepNumber}>3</div>
                      <p>
                        Moving {sailState.selectedShip.type === ShipType.SLOOP ? '⛵ Sloop' : '🚢 Galleon'}
                        from ({sailState.sourceHex.q}, {sailState.sourceHex.r})
                      </p>
                      <p>Click a destination (highlighted in green)</p>
                      <button
                        onClick={() => setSailState({ ...sailState, selectedShip: null })}
                        style={{ ...styles.button, marginTop: '8px' }}
                      >
                        ← Back
                      </button>
                    </div>
                  )}

                  {/* Planned moves display */}
                  {sailState.plannedMoves.length > 0 && (
                    <div style={styles.plannedMoves}>
                      <strong>Planned Moves:</strong>
                      {sailState.plannedMoves.map((m, i) => (
                        <div key={i} style={styles.plannedMove}>
                          {m.shipType === ShipType.SLOOP ? '⛵' : '🚢'}
                          ({m.from.q},{m.from.r}) → ({m.to.q},{m.to.r})
                        </div>
                      ))}

                      {/* Bribe option for extra movement points */}
                      {player.doubloons > 0 && (
                        <div style={styles.bribeOption}>
                          <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                            <strong>Bribes:</strong> +1 movement point per doubloon
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              onClick={() => setSailState({ ...sailState, bribeCount: Math.max(0, sailState.bribeCount - 1) })}
                              disabled={sailState.bribeCount === 0}
                              style={{ ...styles.button, padding: '5px 12px', opacity: sailState.bribeCount === 0 ? 0.5 : 1 }}
                            >
                              −
                            </button>
                            <span style={{ minWidth: '80px', textAlign: 'center' }}>
                              {sailState.bribeCount} bribe{sailState.bribeCount !== 1 ? 's' : ''} ({sailState.bribeCount}💰)
                            </span>
                            <button
                              onClick={() => setSailState({ ...sailState, bribeCount: Math.min(player.doubloons, sailState.bribeCount + 1) })}
                              disabled={sailState.bribeCount >= player.doubloons}
                              style={{ ...styles.button, padding: '5px 12px', opacity: sailState.bribeCount >= player.doubloons ? 0.5 : 1 }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={styles.sailActions}>
                        <button
                          onClick={() => {
                            moves.sail({ moves: sailState.plannedMoves, bribesUsed: sailState.bribeCount });
                            resetActionState();
                          }}
                          style={styles.executeButton}
                        >
                          Execute Sail {sailState.bribeCount > 0 ? `(${sailState.bribeCount} doubloon${sailState.bribeCount !== 1 ? 's' : ''})` : ''}
                        </button>
                        <button
                          onClick={() => setSailState({ sourceHex: null, selectedShip: null, plannedMoves: [], bribeCount: 0 })}
                          style={{ ...styles.button, marginTop: '8px' }}
                        >
                          Reset All
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Prompt to add another move or click hex for next move */}
                  {sailState.plannedMoves.length > 0 && !sailState.sourceHex && remainingPoints > 0 && (
                    <div style={{ ...styles.sailStep, marginTop: '15px' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                        You have {remainingPoints} movement point{remainingPoints !== 1 ? 's' : ''} left.
                        Click another hex with ships to add more moves.
                      </p>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* Cancel and Forfeit buttons */}
              {selectedAction && (
                <div style={{ marginTop: '15px' }}>
                  <button
                    onClick={() => resetActionState()}
                    style={{...styles.button, width: '100%'}}
                  >
                    Cancel (Pick Different Action)
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Forfeit this action? You will lose the captain without any effect.')) {
                        moves.skipAction();
                        resetActionState();
                      }
                    }}
                    style={{...styles.forfeitButton, marginTop: '8px', width: '100%'}}
                  >
                    Forfeit Action (No Valid Targets)
                  </button>
                </div>
              )}
            </>
          ) : (
            <p style={styles.info}>No captains remaining. Waiting for other players...</p>
          )}
        </div>
      )}

      {/* PIRATE Phase UI */}
      {currentPhase === 'pirate' && (
        <div style={styles.section}>
          <h3 style={styles.subheader}>Pirate Phase</h3>
          {isMyTurn ? (
            <div style={styles.actionDialog}>
              <strong>Claim Charts</strong>
              <p>You may claim any charts you've completed:</p>

              {/* Player's charts */}
              {player.charts.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong>Your Charts:</strong>
                  {player.charts.map((chart, i) => {
                    const claimStatus = getChartClaimStatus(chart, G, effectivePlayerID);
                    return (
                      <div key={i} style={{
                        ...styles.chart,
                        borderLeft: claimStatus.canClaim ? '3px solid #4CAF50' : '3px solid #999',
                        opacity: claimStatus.canClaim ? 1 : 0.7
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{chart.type}</strong>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {getChartDescription(chart)}
                            </div>
                            {!claimStatus.canClaim && (
                              <div style={{ fontSize: '11px', color: '#E24A4A' }}>
                                {claimStatus.reason}
                              </div>
                            )}
                          </div>
                          {claimStatus.canClaim && (
                            <button
                              onClick={() => moves.claimChart({ chartId: chart.id })}
                              style={{ ...styles.button, padding: '5px 10px', fontSize: '12px' }}
                            >
                              Claim (+{claimStatus.reward})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Island Raids (public) */}
              {G.chartDeck.islandRaids.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <strong>Island Raids (Public):</strong>
                  {G.chartDeck.islandRaids.map((raid, i) => {
                    const claimStatus = getChartClaimStatus(raid, G, effectivePlayerID);
                    return (
                      <div key={i} style={{
                        ...styles.chart,
                        borderLeft: claimStatus.canClaim ? '3px solid #4CAF50' : '3px solid #E2D24A',
                        backgroundColor: '#fff8e1'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>Island Raid: {(raid as IslandRaidChart).targetIsland}</strong>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              Doubloons: {(raid as IslandRaidChart).doubloonsOnChart}
                              {(raid as IslandRaidChart).doubloonsOnChart < 2 && ' (needs 2+)'}
                            </div>
                            {!claimStatus.canClaim && (
                              <div style={{ fontSize: '11px', color: '#E24A4A' }}>
                                {claimStatus.reason}
                              </div>
                            )}
                          </div>
                          {claimStatus.canClaim && (
                            <button
                              onClick={() => moves.claimChart({ chartId: raid.id })}
                              style={{ ...styles.button, padding: '5px 10px', fontSize: '12px' }}
                            >
                              Claim (+{claimStatus.reward})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {player.charts.length === 0 && G.chartDeck.islandRaids.length === 0 && (
                <p style={styles.info}>No charts available to claim.</p>
              )}

              <button
                onClick={() => moves.doneClaiming()}
                style={{ ...styles.executeButton, marginTop: '15px' }}
              >
                Done Claiming
              </button>
            </div>
          ) : (
            <p style={styles.info}>Waiting for Player {parseInt(ctx.currentPlayer) + 1} to claim charts...</p>
          )}
        </div>
      )}

      {/* Charts */}
      <div style={styles.section}>
        <h3 style={styles.subheader}>Charts ({player.charts.length})</h3>
        {player.charts.length > 0 ? (
          <div>
            {player.charts.map((chart, i) => (
              <div key={i} style={styles.chart}>
                {chart.type}
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.info}>No charts</p>
        )}
      </div>

      {/* Other Players */}
      <div style={styles.section}>
        <h3 style={styles.subheader}>Other Players</h3>
        {G.players.filter(p => p.id !== effectivePlayerID).map(p => (
          <div key={p.id} style={styles.otherPlayer}>
            <div><strong>{p.name}</strong> ({getPowerStrategy(p.piratePower).name})</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {p.notoriety} notoriety, {p.doubloons} doubloons
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    height: '100vh',
    overflowY: 'auto',
    fontFamily: 'Arial, sans-serif'
  },
  section: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  header: {
    margin: '0 0 15px 0',
    fontSize: '24px',
    color: '#333'
  },
  powerBox: {
    padding: '10px',
    marginBottom: '15px',
    backgroundColor: '#e8f4f8',
    borderRadius: '6px',
    borderLeft: '4px solid #4A90E2'
  },
  powerDescription: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
    fontStyle: 'italic'
  },
  subheader: {
    margin: '0 0 10px 0',
    fontSize: '18px',
    color: '#555'
  },
  stat: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid #eee'
  },
  statLabel: {
    fontWeight: 'bold',
    color: '#666'
  },
  statValue: {
    color: '#333'
  },
  info: {
    margin: '10px 0',
    fontSize: '14px',
    color: '#666'
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginTop: '10px'
  },
  button: {
    padding: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
    border: '2px solid #4A90E2',
    backgroundColor: '#fff',
    color: '#4A90E2',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  buttonSelected: {
    backgroundColor: '#4A90E2',
    color: '#fff'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  chart: {
    padding: '8px',
    margin: '5px 0',
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #4A90E2',
    fontSize: '14px'
  },
  otherPlayer: {
    padding: '8px 0',
    borderBottom: '1px solid #eee',
    fontSize: '14px'
  },
  actionDialog: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#f0f8ff',
    borderRadius: '8px',
    border: '2px solid #4A90E2'
  },
  checkboxLabel: {
    display: 'block',
    padding: '8px 0',
    fontSize: '14px',
    cursor: 'pointer'
  },
  executeButton: {
    width: '100%',
    padding: '12px',
    marginTop: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    backgroundColor: '#4CAF50',
    color: '#fff',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  forfeitButton: {
    padding: '10px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '2px solid #E24A4A',
    backgroundColor: '#fff',
    color: '#E24A4A',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  // Captain placement board styles
  captainBoard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '10px'
  },
  actionSlot: {
    padding: '10px',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  actionName: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#fff',
    marginBottom: '6px'
  },
  captainIndicators: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    minHeight: '20px'
  },
  playerCaptains: {
    display: 'flex',
    gap: '3px'
  },
  captainDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.5)'
  },
  playerLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '12px',
    padding: '8px',
    backgroundColor: '#2a2a3e',
    borderRadius: '4px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  // SAIL action styles
  sailInfo: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '10px',
    padding: '5px',
    backgroundColor: '#e8f4f8',
    borderRadius: '4px'
  },
  sailStep: {
    padding: '12px',
    marginTop: '10px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #ddd',
    position: 'relative' as const
  },
  stepNumber: {
    position: 'absolute' as const,
    top: '-10px',
    left: '10px',
    backgroundColor: '#4A90E2',
    color: '#fff',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  shipPicker: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px'
  },
  shipButton: {
    padding: '12px 20px',
    fontSize: '16px',
    border: '2px solid #4A90E2',
    backgroundColor: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flex: 1
  },
  plannedMoves: {
    marginTop: '15px',
    padding: '12px',
    backgroundColor: '#e8f8e8',
    borderRadius: '6px',
    border: '2px solid #4CAF50'
  },
  plannedMove: {
    padding: '6px 0',
    fontSize: '14px',
    borderBottom: '1px solid #c8e8c8'
  },
  bribeOption: {
    marginTop: '10px',
    padding: '8px',
    backgroundColor: '#fff',
    borderRadius: '4px'
  },
  sailActions: {
    marginTop: '10px'
  }
};
