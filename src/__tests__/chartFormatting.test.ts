import { describe, it, expect, beforeEach } from 'vitest';
import { chartLabel, chartDescription, chartColor } from '../ui/utils/chartFormatting';
import { ChartFactory } from '../core/Chart';
import { createHexCoord } from '../types/CoordinateTypes';

beforeEach(() => {
  ChartFactory.resetIdCounter();
});

describe('chartLabel', () => {
  it('shows target hex coordinates for treasure map', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(1, -1));
    expect(chartLabel(chart)).toBe('Treasure Map (1, -1)');
  });

  it('shows zero coordinates correctly', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(0, 0));
    expect(chartLabel(chart)).toBe('Treasure Map (0, 0)');
  });

  it('shows negative coordinates correctly', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(-2, 3));
    expect(chartLabel(chart)).toBe('Treasure Map (-2, 3)');
  });

  it('shows island name for island raid', () => {
    const chart = ChartFactory.createIslandRaid('Havana', 14);
    expect(chartLabel(chart)).toBe('Island Raid: Havana');
  });

  it('shows both islands for smuggler route', () => {
    const chart = ChartFactory.createSmugglerRoute('Nassau', 'Tortuga');
    expect(chartLabel(chart)).toBe('Route: Nassau — Tortuga');
  });
});

describe('chartDescription', () => {
  it('includes target hex coordinates for treasure map', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(1, -1));
    expect(chartDescription(chart)).toBe('Control hex (1, -1) to claim 1 doubloon per player');
  });

  it('reflects different hex coords in description', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(3, -2));
    expect(chartDescription(chart)).toBe('Control hex (3, -2) to claim 1 doubloon per player');
  });

  it('includes island and reward info for island raid', () => {
    const chart = ChartFactory.createIslandRaid('Nassau', 14);
    expect(chartDescription(chart)).toContain('Nassau');
    expect(chartDescription(chart)).toContain('4 notoriety');
  });

  it('includes both island names for smuggler route', () => {
    const chart = ChartFactory.createSmugglerRoute('Port Royal', 'Hispaniola');
    expect(chartDescription(chart)).toContain('Port Royal');
    expect(chartDescription(chart)).toContain('Hispaniola');
  });
});

describe('chartColor', () => {
  it('returns gold for treasure map', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(0, 0));
    expect(chartColor(chart)).toBe('#c4a43a');
  });

  it('returns red for island raid', () => {
    const chart = ChartFactory.createIslandRaid('Havana', 14);
    expect(chartColor(chart)).toBe('#8b2500');
  });

  it('returns green for smuggler route', () => {
    const chart = ChartFactory.createSmugglerRoute('Nassau', 'Tortuga');
    expect(chartColor(chart)).toBe('#4a6a5a');
  });
});
