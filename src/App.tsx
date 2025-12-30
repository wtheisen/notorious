import React, { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import { NotoriousGame } from './game/NotoriousGame';
import { Board } from './components/Board';
import { GameUI } from './components/GameUI';
import { ActionType } from './types/GameTypes';
import { HexCoord } from './types/CoordinateTypes';

/**
 * Main game board component that combines the hex board and UI
 */
const NotoriousBoard = ({ G, ctx, moves, playerID }: any) => {
  // Shared state for action execution
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedHex, setSelectedHex] = useState<HexCoord | null>(null);

  // Handle hex clicks from the board
  const handleHexClick = (coord: HexCoord) => {
    setSelectedHex(coord);
  };

  // Reset action state after execution
  const resetActionState = () => {
    setSelectedAction(null);
    setSelectedHex(null);
  };

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
        />
      </div>
    </div>
  );
};

/**
 * Create the boardgame.io Client
 * For local development/testing with multiple players in same browser
 */
const NotoriousClient = Client({
  game: NotoriousGame,
  board: NotoriousBoard,
  numPlayers: 2,
  multiplayer: Local(),  // Local multiplayer for testing
  debug: true  // Enable debug panel
});

/**
 * Main App component
 * Renders two player views side-by-side for local testing
 */
export const App = () => {
  return (
    <div style={styles.app}>
      <h1 style={styles.title}>Notorious - boardgame.io Edition</h1>
      <div style={styles.playersContainer}>
        <div style={styles.playerView}>
          <h2 style={styles.playerTitle}>Player 1</h2>
          <NotoriousClient playerID="0" />
        </div>
        <div style={styles.playerView}>
          <h2 style={styles.playerTitle}>Player 2</h2>
          <NotoriousClient playerID="1" />
        </div>
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
  playersContainer: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  playerView: {
    border: '2px solid #333',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#2a2a3e'
  },
  playerTitle: {
    margin: 0,
    padding: '10px',
    backgroundColor: '#333',
    color: '#fff',
    textAlign: 'center'
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
