import React, { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { NotoriousGame } from './game/NotoriousGame';
import { GameScreen } from './ui/GameScreen';

const NotoriousClient = Client({
  game: NotoriousGame,
  board: GameScreen,
  numPlayers: 4,
  debug: false,
});

export function App() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '2rem',
      }}>
        <h1 style={{ fontSize: '3rem', fontFamily: 'serif', letterSpacing: '0.1em' }}>
          NOTORIOUS
        </h1>
        <p style={{ color: '#8899aa', fontSize: '1.1rem' }}>A pirate board game</p>
        <button
          onClick={() => setStarted(true)}
          style={{
            padding: '0.8rem 2.5rem',
            fontSize: '1.2rem',
            background: '#2a5a8a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <NotoriousClient />
    </div>
  );
}
