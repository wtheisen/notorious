# Notorious - Game Rules

## Objective

First player to reach **24 notoriety** triggers end game. Finish the round, then highest notoriety wins.

## Game Phases

### 1. Setup Phase
Each player places their **port** and **2 starting sloops** on any empty hex (not on an island).

### 2. Place Phase
Players take turns placing **captains** on action slots. Each captain commits to one action:
- SAIL, BUILD, STEAL, SINK, or CHART
- Players have 3 captains by default
- Multiple captains can be placed on the same action

### 3. Play Phase
Players execute their placed captains in turn order. Actions resolve based on the action type (see below).

### 4. Pirate Phase
- Players gain **notoriety for each hex they control** (have majority influence)
- Players may **claim completed charts** for rewards
- Wind token holder changes

Then return to Place Phase for next round.

---

## Actions

### SAIL
Move ships up to **2 hexes total** (movement points).
- Can split between multiple ships (e.g., 2 ships × 1 hex each)
- **Bribe**: +1 movement point per doubloon
- Cannot cross impassable island edges
- The Sailor power: 3 base movement instead of 2

### BUILD
Place ships from inventory onto a hex where you have presence.
- **Base**: 2 sloops OR 1 galleon
- **Bribe**: +1 additional sloop per doubloon
- Must have ships in inventory to place

### STEAL
Take an opponent's **sloop** from a hex where you both have ships.
- Stolen sloop returns to opponent's inventory
- **Option**: Replace with your own sloop (costs 1 sloop from inventory)

### SINK
Remove an opponent's ship from a hex where you both have ships.
- Can always sink **sloops**
- Can only sink **galleons** if your influence ≥ their influence
- **Notoriety gain**: Only if target player has ≥ your notoriety
  - Sloop: +1 notoriety
  - Galleon: +3 notoriety
- **Bribe 1**: Move your sloops 1 hex before sinking (1 doubloon each)
  - The Relentless: First sloop move is FREE
- **Bribe 2**: Sink additional ships in same hex (1 doubloon each)

### CHART
Draw charts and gain the wind token.
- **Base**: Draw 2, keep 1
- **Bribe**: Draw 3 instead of 2 (1 doubloon)
- **Bribe**: Keep 2 instead of 1 (1 doubloon)

---

## Influence

Influence at a hex = sum of ship values:
- **Port**: 3 influence
- **Galleon**: 2 influence
- **Sloop**: 1 influence

The player with highest influence **controls** the hex and gains notoriety for it in the Pirate phase.

---

## Charts

### Treasure Map
- Target: Specific hex coordinate
- Requirement: Have a galleon at target hex AND control it
- Reward: Doubloons equal to player count

### Island Raid
- Target: Specific island
- Requirement: Have a galleon on island AND control it AND chart has 2+ doubloons
- Reward: 4 notoriety + doubloons on chart
- Note: Doubloons accumulate on unclaimed island raids each round

### Smuggler Route
- Target: Path between two islands
- Requirement: Have ships on every hex of the shortest path
- Reward: Doubloons equal to path length

---

## Pirate Powers

Each player has a unique pirate power that modifies rules. Powers use the **Strategy Pattern** - see `src/core/powers/`.

Current powers:
- **The Sailor**: 3 movement points instead of 2
- **The Islander**: Can ignore impassable island edges
- **The Peaceful**: Cannot use Sink action; gains 1 doubloon when their ship is sunk/stolen
- **The Relentless**: Free sloop move before Sink; doesn't gain notoriety from hex control

---

## Resources

- **Notoriety**: Victory points. First to 24 triggers endgame.
- **Doubloons**: Currency for bribes.
- **Sloops**: Small ships (1 influence). Start with 2 on board + more in inventory.
- **Galleons**: Large ships (2 influence). Required for claiming most charts.
- **Captains**: Determine how many actions you can take per round.
