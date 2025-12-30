import React, { useState, useEffect, useCallback } from 'react';
import { Client } from 'boardgame.io/react';
import { NotoriousGame } from './game/NotoriousGame';
import { Board } from './components/Board';
import { GameUI } from './components/GameUI';
import { ActionType, ShipType } from './types/GameTypes';
import { HexCoord } from './types/CoordinateTypes';
import { Ship } from './game/types/GameState';
import { enumerateMoves } from './game/ai/NotoriousBot';

/**
 * Target selection for STEAL/SINK actions
 */
export interface TargetSelection {
  hex: HexCoord;
  playerId: string;
  shipType: ShipType;
}

// AI Player IDs - Players 1, 2, 3 are AI controlled (player 0 is human)
const AI_PLAYER_IDS = ['1', '2', '3'];

/**
 * Sail action state - tracks the multi-step SAIL flow
 */
export interface SailState {
  sourceHex: HexCoord | null;
  selectedShip: Ship | null;
  plannedMoves: Array<{ shipType: ShipType; from: HexCoord; to: HexCoord }>;
  bribeCount: number;
}

/**
 * Main game board component that combines the hex board and UI
 */
const NotoriousBoard = ({ G, ctx, moves, playerID }: any) => {
  // Shared state for action execution
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedHex, setSelectedHex] = useState<HexCoord | null>(null);

  // SAIL action state - lifted up for Board/GameUI coordination
  const [sailState, setSailState] = useState<SailState>({
    sourceHex: null,
    selectedShip: null,
    plannedMoves: [],
    bribeCount: 0
  });

  // Target selection for STEAL/SINK - when clicking enemy ships on board
  const [targetSelection, setTargetSelection] = useState<TargetSelection | null>(null);

  // Track last AI move to prevent infinite retries
  const [lastAIMove, setLastAIMove] = useState<{ player: string; turn: number } | null>(null);

  // AI move handling - automatically execute moves for AI players
  useEffect(() => {
    // Check if it's an AI's turn
    const isAITurn = AI_PLAYER_IDS.includes(ctx.currentPlayer);
    if (isAITurn && !ctx.gameover) {
      // Prevent infinite loops - only try once per turn
      const turnKey = { player: ctx.currentPlayer, turn: ctx.turn };
      if (lastAIMove && lastAIMove.player === turnKey.player && lastAIMove.turn === turnKey.turn) {
        console.log(`[AI] Already tried this turn, skipping action...`);
        if (moves.skipAction) {
          moves.skipAction();
        } else if (moves.pass) {
          moves.pass();
        }
        return;
      }

      const aiDelay = 500; // Half second delay for AI moves

      const timer = setTimeout(() => {
        setLastAIMove(turnKey);

        // Get possible moves for AI
        const possibleMoves = enumerateMoves(G, ctx);

        console.log(`[AI Player ${ctx.currentPlayer}] Phase: ${ctx.phase}, Possible moves:`, possibleMoves.length);

        if (possibleMoves.length > 0) {
          // Pick a random move
          const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

          console.log(`[AI Player ${ctx.currentPlayer}] Executing:`, randomMove.move, randomMove.args);

          // Execute the move
          if (moves[randomMove.move]) {
            moves[randomMove.move](...randomMove.args);
          } else {
            console.error(`[AI] Move not found:`, randomMove.move, '- skipping action');
            if (moves.skipAction) moves.skipAction();
            else if (moves.pass) moves.pass();
          }
        } else {
          console.warn(`[AI Player ${ctx.currentPlayer}] No valid moves found - skipping action`);
          if (moves.skipAction) moves.skipAction();
          else if (moves.pass) moves.pass();
        }
      }, aiDelay);

      return () => clearTimeout(timer);
    }
  }, [ctx.currentPlayer, ctx.phase, ctx.turn, G, moves, ctx.gameover, lastAIMove]);

  // Handle hex clicks from the board
  const handleHexClick = (coord: HexCoord) => {
    setSelectedHex(coord);
  };

  // Reset action state after execution
  const resetActionState = () => {
    setSelectedAction(null);
    setSelectedHex(null);
    setSailState({ sourceHex: null, selectedShip: null, plannedMoves: [], bribeCount: 0 });
    setTargetSelection(null);
  };

  // Reset state when action changes
  useEffect(() => {
    if (selectedAction !== ActionType.SAIL) {
      setSailState({ sourceHex: null, selectedShip: null, plannedMoves: [], bribeCount: 0 });
    }
    setTargetSelection(null);
  }, [selectedAction]);

  return (
    <div style={styles.container}>
      <div style={styles.boardContainer}>
        <Board
          G={G}
          ctx={ctx}
          moves={moves}
          playerID={playerID}
          selectedAction={selectedAction}
          selectedHex={selectedHex}
          onHexClick={handleHexClick}
          sailState={sailState}
          setSailState={setSailState}
          targetSelection={targetSelection}
          setTargetSelection={setTargetSelection}
        />
      </div>
      <div style={styles.uiContainer}>
        <GameUI
          G={G}
          ctx={ctx}
          moves={moves}
          playerID={playerID}
          selectedAction={selectedAction}
          setSelectedAction={setSelectedAction}
          selectedHex={selectedHex}
          setSelectedHex={setSelectedHex}
          resetActionState={resetActionState}
          sailState={sailState}
          setSailState={setSailState}
          targetSelection={targetSelection}
          setTargetSelection={setTargetSelection}
        />
      </div>
    </div>
  );
};

/**
 * Create the boardgame.io Client
 * 4 players: 1 human (Player 1) + 3 AIs
 * No multiplayer - single client controls all players (AI handled via useEffect)
 */
const NotoriousClient = Client({
  game: NotoriousGame,
  board: NotoriousBoard,
  numPlayers: 4,
  debug: true  // Enable debug panel
});

/**
 * Main App component
 * Single human player view - AIs are controlled automatically
 */
export const App = () => {
  return (
    <div style={styles.app}>
      <h1 style={styles.title}>Notorious</h1>
      <div style={styles.singlePlayerContainer}>
        <NotoriousClient />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    padding: '20px'
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    marginBottom: '20px',
    fontSize: '32px'
  },
  singlePlayerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    border: '2px solid #333',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#2a2a3e'
  },
  container: {
    display: 'flex',
    backgroundColor: '#2a2a3e'
  },
  boardContainer: {
    flex: '1'
  },
  uiContainer: {
    width: '300px',
    borderLeft: '2px solid #333'
  }
};
