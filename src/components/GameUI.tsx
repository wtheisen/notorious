import React, { useState, useEffect } from 'react';
import { NotoriousState, hexToKey } from '../game/types/GameState';
import { ActionType, ShipType, ChartType } from '../types/GameTypes';
import { HexCoord, hexEquals } from '../types/CoordinateTypes';
import { getPlayerShips, getInfluence, getHexController, getIslandByName, findPathOnBoard } from '../game/logic/BoardLogic';
import { getPowerStrategy } from '../core/powers';
import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../core/Chart';

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
  selectedAction, setSelectedAction, selectedHex, setSelectedHex, resetActionState
}) => {
  // Action-specific state
  const [buildShipType, setBuildShipType] = useState<'sloops' | 'galleon'>('sloops');
  const [bribeCount, setBribeCount] = useState(0);
  const [stealTargetPlayer, setStealTargetPlayer] = useState<string | null>(null);
  const [stealReplace, setStealReplace] = useState(true);
  const [sinkTargetPlayer, setSinkTargetPlayer] = useState<string | null>(null);
  const [sinkTargetShip, setSinkTargetShip] = useState<ShipType>(ShipType.SLOOP);
  const [chartDrawExtra, setChartDrawExtra] = useState(false);
  const [chartKeepExtra, setChartKeepExtra] = useState(false);

  // SAIL action state
  const [sailMoves, setSailMoves] = useState<Array<{shipType: ShipType; from: HexCoord; to: HexCoord}>>([]);
  const [sailSourceHex, setSailSourceHex] = useState<HexCoord | null>(null);

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
    setSailMoves([]);
    setSailSourceHex(null);
  }, [selectedAction]);

  // Handle SAIL action hex clicks
  useEffect(() => {
    if (selectedAction !== ActionType.SAIL || !selectedHex) return;

    const playerShips = getPlayerShips(G.board, selectedHex, effectivePlayerID);

    if (!sailSourceHex) {
      // First click - select source if player has ships there
      if (playerShips.length > 0) {
        setSailSourceHex(selectedHex);
        setSelectedHex(null); // Clear selection to prepare for destination
      }
    } else {
      // Second click - select destination and create move
      const shipToMove = getPlayerShips(G.board, sailSourceHex, effectivePlayerID)[0];
      if (shipToMove) {
        setSailMoves([...sailMoves, {
          shipType: shipToMove.type,
          from: sailSourceHex,
          to: selectedHex
        }]);
        setSailSourceHex(null);
        setSelectedHex(null);
      }
    }
  }, [selectedHex, selectedAction, sailSourceHex, effectivePlayerID, G.board]);

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

      {/* PLACE Phase UI */}
      {currentPhase === 'place' && isMyTurn && (
        <div style={styles.section}>
          <h3 style={styles.subheader}>Place Captain</h3>
          <p style={styles.info}>
            Placed: {player.placedCaptains.length} / {player.captainCount}
          </p>
          <div style={styles.buttonGrid}>
            {[ActionType.SAIL, ActionType.BUILD, ActionType.STEAL, ActionType.SINK, ActionType.CHART].map(action => (
              <button
                key={action}
                onClick={() => moves.placeCaptain(action)}
                disabled={player.placedCaptains.length >= player.captainCount}
                style={{
                  ...styles.button,
                  ...(player.placedCaptains.length >= player.captainCount ? styles.buttonDisabled : {})
                }}
              >
                {action}
              </button>
            ))}
          </div>
          {player.placedCaptains.length > 0 && (
            <div style={styles.info}>
              <strong>Captains placed on:</strong> {player.placedCaptains.join(', ')}
            </div>
          )}
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
                  {!selectedHex ? (
                    <p>Click a hex where you have ships AND opponent has sloop</p>
                  ) : (() => {
                    const hex = G.board.hexes[hexToKey(selectedHex)];
                    const opponentSloops = hex?.ships.filter(s => s.playerId !== effectivePlayerID && s.type === ShipType.SLOOP) || [];
                    const targetPlayers = [...new Set(opponentSloops.map(s => s.playerId))];
                    return (
                      <>
                        <p>Stealing at ({selectedHex.q}, {selectedHex.r})</p>
                        {targetPlayers.length > 1 && (
                          <div>
                            <p>Select target:</p>
                            {targetPlayers.map(pid => (
                              <button
                                key={pid}
                                onClick={() => setStealTargetPlayer(pid)}
                                style={{...styles.button, ...(stealTargetPlayer === pid ? styles.buttonSelected : {})}}
                              >
                                Player {parseInt(pid) + 1}
                              </button>
                            ))}
                          </div>
                        )}
                        <label style={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={stealReplace}
                            onChange={(e) => setStealReplace(e.target.checked)}
                            disabled={player.ships.sloops < 1}
                          />
                          Replace with your sloop
                        </label>
                        <button
                          onClick={() => {
                            const target = stealTargetPlayer || targetPlayers[0];
                            moves.steal({ hex: selectedHex, targetPlayerId: target, replaceWithSloop: stealReplace });
                            resetActionState();
                          }}
                          style={styles.executeButton}
                          disabled={targetPlayers.length === 0}
                        >
                          Steal Sloop
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* SINK Action Dialog */}
              {selectedAction === ActionType.SINK && (
                <div style={styles.actionDialog}>
                  <strong>SINK Action</strong>
                  {!selectedHex ? (
                    <p>Click a hex where you have ships AND opponent has ships</p>
                  ) : (() => {
                    const hex = G.board.hexes[hexToKey(selectedHex)];
                    const opponentShips = hex?.ships.filter(s => s.playerId !== effectivePlayerID) || [];
                    const targetPlayers = [...new Set(opponentShips.map(s => s.playerId))];
                    const playerInfluence = getInfluence(G.board, selectedHex, effectivePlayerID);

                    return (
                      <>
                        <p>Sinking at ({selectedHex.q}, {selectedHex.r})</p>
                        {targetPlayers.length > 1 && (
                          <div>
                            <p>Select target player:</p>
                            {targetPlayers.map(pid => (
                              <button
                                key={pid}
                                onClick={() => setSinkTargetPlayer(pid)}
                                style={{...styles.button, ...(sinkTargetPlayer === pid ? styles.buttonSelected : {})}}
                              >
                                Player {parseInt(pid) + 1}
                              </button>
                            ))}
                          </div>
                        )}
                        <div>
                          <p>Select ship to sink:</p>
                          {(() => {
                            const target = sinkTargetPlayer || targetPlayers[0];
                            const targetShips = hex?.ships.filter(s => s.playerId === target) || [];
                            const targetInfluence = getInfluence(G.board, selectedHex, target);
                            const canSinkGalleon = playerInfluence >= targetInfluence;
                            return (
                              <div style={styles.buttonGrid}>
                                {targetShips.some(s => s.type === ShipType.SLOOP) && (
                                  <button
                                    onClick={() => setSinkTargetShip(ShipType.SLOOP)}
                                    style={{...styles.button, ...(sinkTargetShip === ShipType.SLOOP ? styles.buttonSelected : {})}}
                                  >
                                    Sloop (+1 notoriety)
                                  </button>
                                )}
                                {targetShips.some(s => s.type === ShipType.GALLEON) && (
                                  <button
                                    onClick={() => setSinkTargetShip(ShipType.GALLEON)}
                                    style={{...styles.button, ...(sinkTargetShip === ShipType.GALLEON ? styles.buttonSelected : {})}}
                                    disabled={!canSinkGalleon}
                                    title={!canSinkGalleon ? 'Need more influence' : ''}
                                  >
                                    Galleon (+3 notoriety) {!canSinkGalleon && '⚠️'}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            const target = sinkTargetPlayer || targetPlayers[0];
                            moves.sink({
                              hex: selectedHex,
                              targetShipType: sinkTargetShip,
                              targetPlayerId: target,
                              bribesUsed: 0
                            });
                            resetActionState();
                          }}
                          style={styles.executeButton}
                          disabled={targetPlayers.length === 0}
                        >
                          Sink {sinkTargetShip}
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* SAIL Action Dialog */}
              {selectedAction === ActionType.SAIL && (
                <div style={styles.actionDialog}>
                  <strong>SAIL Action</strong>
                  {sailMoves.length === 0 && !sailSourceHex ? (
                    <p>Click a hex with your ships to select source</p>
                  ) : sailSourceHex && sailMoves.length === 0 ? (
                    <>
                      <p>Source: ({sailSourceHex.q}, {sailSourceHex.r})</p>
                      <p>Click destination hex (up to 2 hexes away)</p>
                      <button onClick={() => setSailSourceHex(null)} style={styles.button}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Moves planned: {sailMoves.length}</p>
                      {sailMoves.map((m, i) => (
                        <div key={i} style={styles.info}>
                          {m.shipType}: ({m.from.q},{m.from.r}) → ({m.to.q},{m.to.r})
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          moves.sail({ moves: sailMoves, bribesUsed: 0 });
                          resetActionState();
                        }}
                        style={styles.executeButton}
                      >
                        Execute Sail
                      </button>
                      <button
                        onClick={() => {
                          setSailMoves([]);
                          setSailSourceHex(null);
                        }}
                        style={styles.button}
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Cancel button */}
              {selectedAction && (
                <button
                  onClick={() => resetActionState()}
                  style={{...styles.button, marginTop: '10px', width: '100%'}}
                >
                  Cancel Action
                </button>
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
  }
};
