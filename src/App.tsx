import React, { useState, useEffect } from 'react';
import { Client } from 'boardgame.io/react';
import { NotoriousGame } from './game/NotoriousGame';
import { GameScreen } from './ui/GameScreen';

const NotoriousClient = Client({
  game: NotoriousGame,
  board: GameScreen,
  numPlayers: 4,
  debug: false,
});

/* ═══════════════════════════════════════════════════
   CSS-in-JS styles for the landing page
   17th Century Copperplate Engraving / Maritime Atlas
   ═══════════════════════════════════════════════════ */

const cssText = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=IM+Fell+English:ital@0;1&display=swap');

.landing {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #e8dcc4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'IM Fell English', Georgia, serif;
  color: #3b2a1a;
}

/* Parchment paper texture via layered gradients */
.landing::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(92,58,30,0.015) 2px,
      rgba(92,58,30,0.015) 4px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(92,58,30,0.01) 2px,
      rgba(92,58,30,0.01) 4px
    ),
    radial-gradient(ellipse at 20% 50%, rgba(184,150,62,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 30%, rgba(139,37,0,0.04) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 80%, rgba(74,106,90,0.06) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Aged edges vignette */
.landing::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(92,58,30,0.15) 100%);
  pointer-events: none;
  z-index: 0;
}

/* Ornate double-line border frame */
.landing-frame {
  position: absolute;
  inset: 16px;
  border: 2px solid #8b7355;
  pointer-events: none;
  z-index: 1;
}
.landing-frame::before {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(139,115,85,0.5);
}
/* Corner ornaments */
.landing-frame::after {
  content: '';
  position: absolute;
  inset: -4px;
  background:
    radial-gradient(circle at 0% 0%, #8b7355 2px, transparent 2px),
    radial-gradient(circle at 100% 0%, #8b7355 2px, transparent 2px),
    radial-gradient(circle at 0% 100%, #8b7355 2px, transparent 2px),
    radial-gradient(circle at 100% 100%, #8b7355 2px, transparent 2px);
}

/* ── Compass Rose (pure CSS) ── */
.compass {
  position: absolute;
  bottom: 60px;
  right: 60px;
  width: 120px;
  height: 120px;
  z-index: 1;
  opacity: 0.2;
}
.compass::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1.5px solid #5c3a1e;
  border-radius: 50%;
}
.compass::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(92,58,30,0.5);
  border-radius: 50%;
}
.compass-star {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compass-star::before {
  content: '';
  width: 60px;
  height: 60px;
  background:
    linear-gradient(0deg, transparent 40%, #5c3a1e 40%, #5c3a1e 60%, transparent 60%),
    linear-gradient(90deg, transparent 40%, #5c3a1e 40%, #5c3a1e 60%, transparent 60%),
    linear-gradient(45deg, transparent 42%, rgba(92,58,30,0.5) 42%, rgba(92,58,30,0.5) 58%, transparent 58%),
    linear-gradient(-45deg, transparent 42%, rgba(92,58,30,0.5) 42%, rgba(92,58,30,0.5) 58%, transparent 58%);
}
.compass-n, .compass-s, .compass-e, .compass-w {
  position: absolute;
  font-family: 'Cinzel', serif;
  font-size: 11px;
  font-weight: 700;
  color: #5c3a1e;
  letter-spacing: 0.05em;
}
.compass-n { top: 10px; left: 50%; transform: translateX(-50%); }
.compass-s { bottom: 10px; left: 50%; transform: translateX(-50%); }
.compass-e { right: 10px; top: 50%; transform: translateY(-50%); }
.compass-w { left: 12px; top: 50%; transform: translateY(-50%); }

/* ── Top decorative cartouche ── */
.cartouche {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 60px 30px;
}
.cartouche::before {
  content: '— ✦ —';
  display: block;
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  letter-spacing: 0.4em;
  color: #b8963e;
  margin-bottom: 20px;
}

/* ── Title ── */
.title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-weight: 900;
  font-size: clamp(3rem, 8vw, 6rem);
  letter-spacing: 0.15em;
  color: #3b2a1a;
  text-shadow:
    1px 1px 0 rgba(244,232,193,0.8),
    2px 2px 0 rgba(92,58,30,0.1);
  margin: 0;
  line-height: 1;
  text-align: center;
  animation: titleReveal 1.2s ease-out both;
}

@keyframes titleReveal {
  from {
    opacity: 0;
    letter-spacing: 0.4em;
    filter: blur(2px);
  }
  to {
    opacity: 1;
    letter-spacing: 0.15em;
    filter: blur(0);
  }
}

/* Engraved underline */
.title-rule {
  width: 280px;
  height: 12px;
  margin: 16px auto 0;
  position: relative;
  opacity: 0;
  animation: fadeIn 0.8s ease-out 0.6s both;
}
.title-rule::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, #8b7355, transparent);
}
.title-rule::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30px;
  right: 30px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139,115,85,0.6), transparent);
}

.subtitle {
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  font-size: clamp(1rem, 2.5vw, 1.4rem);
  color: #6b5340;
  margin-top: 20px;
  letter-spacing: 0.08em;
  opacity: 0;
  animation: fadeIn 0.8s ease-out 0.8s both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Decorative divider ── */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 32px 0;
  opacity: 0;
  animation: fadeIn 0.6s ease-out 1s both;
  z-index: 2;
}
.divider-line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #8b7355);
}
.divider-line:last-child {
  background: linear-gradient(90deg, #8b7355, transparent);
}
.divider-diamond {
  width: 6px;
  height: 6px;
  background: #b8963e;
  transform: rotate(45deg);
}

/* ── Start button ── */
.start-btn {
  position: relative;
  z-index: 2;
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 16px 48px;
  color: #f4e8c1;
  background: linear-gradient(180deg, #5c3a1e 0%, #4a2e16 100%);
  border: 2px solid #8b7355;
  border-radius: 3px;
  cursor: pointer;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.1),
    inset 0 -2px 4px rgba(0,0,0,0.2),
    0 2px 8px rgba(60,40,20,0.4);
  transition: all 0.2s ease;
  opacity: 0;
  animation: fadeIn 0.6s ease-out 1.2s both;
}
.start-btn:hover {
  background: linear-gradient(180deg, #6b4828 0%, #5a3820 100%);
  border-color: #b8963e;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.15),
    inset 0 -2px 4px rgba(0,0,0,0.2),
    0 4px 16px rgba(60,40,20,0.5),
    0 0 0 1px rgba(184,150,62,0.3);
  transform: translateY(-1px);
}
.start-btn:active {
  transform: translateY(1px);
  box-shadow:
    inset 0 2px 4px rgba(0,0,0,0.3),
    0 1px 4px rgba(60,40,20,0.3);
}

/* ── Rules button ── */
.rules-btn {
  position: relative;
  z-index: 2;
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 10px 32px;
  color: #5c3a1e;
  background: transparent;
  border: 1.5px solid #8b7355;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 14px;
  transition: all 0.2s ease;
  opacity: 0;
  animation: fadeIn 0.6s ease-out 1.4s both;
}
.rules-btn:hover {
  color: #3b2a1a;
  border-color: #5c3a1e;
  background: rgba(184,150,62,0.1);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
}
.rules-btn:active {
  transform: translateY(1px);
}

/* ── Bottom inscription ── */
.inscription {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  font-family: 'IM Fell English', Georgia, serif;
  font-style: italic;
  font-size: 0.78rem;
  color: #8b7960;
  letter-spacing: 0.06em;
  opacity: 0;
  animation: fadeIn 0.6s ease-out 1.6s both;
  white-space: nowrap;
}

/* ── Map decorative lines (latitude/longitude) ── */
.map-lines {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.map-line-h, .map-line-v {
  position: absolute;
  background: rgba(139,115,85,0.08);
}
.map-line-h {
  left: 0;
  right: 0;
  height: 1px;
}
.map-line-v {
  top: 0;
  bottom: 0;
  width: 1px;
}

/* ── Decorative corner flourishes ── */
.corner-flourish {
  position: absolute;
  z-index: 1;
  width: 60px;
  height: 60px;
  pointer-events: none;
}
.corner-flourish::before,
.corner-flourish::after {
  content: '';
  position: absolute;
  background: #8b7355;
}
.corner-flourish--tl { top: 28px; left: 28px; }
.corner-flourish--tl::before { top: 0; left: 0; width: 20px; height: 1.5px; }
.corner-flourish--tl::after { top: 0; left: 0; width: 1.5px; height: 20px; }
.corner-flourish--tr { top: 28px; right: 28px; }
.corner-flourish--tr::before { top: 0; right: 0; width: 20px; height: 1.5px; }
.corner-flourish--tr::after { top: 0; right: 0; width: 1.5px; height: 20px; }
.corner-flourish--bl { bottom: 28px; left: 28px; }
.corner-flourish--bl::before { bottom: 0; left: 0; width: 20px; height: 1.5px; }
.corner-flourish--bl::after { bottom: 0; left: 0; width: 1.5px; height: 20px; }
.corner-flourish--br { bottom: 28px; right: 28px; }
.corner-flourish--br::before { bottom: 0; right: 0; width: 20px; height: 1.5px; }
.corner-flourish--br::after { bottom: 0; right: 0; width: 1.5px; height: 20px; }
`;

function LandingPage({ onStart }: { onStart: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <style>{cssText}</style>
      <div className="landing">
        {/* Parchment texture and vignette via ::before and ::after */}

        {/* Double-line border frame */}
        <div className="landing-frame" />

        {/* Corner flourishes */}
        <div className="corner-flourish corner-flourish--tl" />
        <div className="corner-flourish corner-flourish--tr" />
        <div className="corner-flourish corner-flourish--bl" />
        <div className="corner-flourish corner-flourish--br" />

        {/* Faint latitude/longitude map lines */}
        <div className="map-lines">
          {[20, 35, 50, 65, 80].map(pct => (
            <div key={`h${pct}`} className="map-line-h" style={{ top: `${pct}%` }} />
          ))}
          {[25, 40, 55, 70].map(pct => (
            <div key={`v${pct}`} className="map-line-v" style={{ left: `${pct}%` }} />
          ))}
        </div>

        {/* Compass rose */}
        <div className="compass">
          <div className="compass-star" />
          <span className="compass-n">N</span>
          <span className="compass-s">S</span>
          <span className="compass-e">E</span>
          <span className="compass-w">W</span>
        </div>

        {/* Main content */}
        <div className="cartouche">
          <h1 className="title">NOTORIOUS</h1>
          <div className="title-rule" />
          <p className="subtitle">A Game of Piracy &amp; Treachery on the High Seas</p>
        </div>

        <div className="divider">
          <div className="divider-line" />
          <div className="divider-diamond" />
          <div className="divider-line" />
        </div>

        <button className="start-btn" onClick={onStart}>
          Set Sail
        </button>

        <button className="rules-btn" onClick={() => window.open('https://docs.google.com/document/d/1IOipOCJRL1IJNccERc-0sSyc-rzzKfdzVAe5hGa3FLw/edit?tab=t.0', '_blank')}>
          Rules
        </button>

        <div className="inscription">
          Anno Domini MDCLXXVIII &middot; For 1&ndash;4 Players &middot; Rule the Caribbean
        </div>
      </div>
    </>
  );
}

export function App() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <LandingPage onStart={() => setStarted(true)} />;
  }

  return (
    <div className="game-root">
      <NotoriousClient />
    </div>
  );
}
