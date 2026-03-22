import { describe, it, expect, beforeEach } from 'vitest';
import { ChartFactory } from '../core/Chart';
import { ChartType } from '../types/GameTypes';
import { createHexCoord } from '../types/CoordinateTypes';

beforeEach(() => {
  ChartFactory.resetIdCounter();
});

describe('ChartFactory', () => {
  describe('createTreasureMap', () => {
    it('creates with correct type', () => {
      const chart = ChartFactory.createTreasureMap(createHexCoord(1, -1));
      expect(chart.type).toBe(ChartType.TREASURE_MAP);
      expect(chart.isRevealed).toBe(false);
      expect(chart.targetHex).toEqual(createHexCoord(1, -1));
    });

    it('generates unique IDs', () => {
      const a = ChartFactory.createTreasureMap(createHexCoord(0, 0));
      const b = ChartFactory.createTreasureMap(createHexCoord(1, 0));
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('createIslandRaid', () => {
    it('creates with correct defaults', () => {
      const chart = ChartFactory.createIslandRaid('Havana', 14);
      expect(chart.type).toBe(ChartType.ISLAND_RAID);
      expect(chart.isRevealed).toBe(true);
      expect(chart.targetIsland).toBe('Havana');
      expect(chart.doubloonsOnChart).toBe(0);
      expect(chart.notorietyReward).toBe(4);
      expect(chart.claimThreshold).toBe(14);
    });
  });

  describe('createSmugglerRoute', () => {
    it('creates with correct islands', () => {
      const chart = ChartFactory.createSmugglerRoute('Nassau', 'Tortuga');
      expect(chart.type).toBe(ChartType.SMUGGLER_ROUTE);
      expect(chart.isRevealed).toBe(false);
      expect(chart.islandA).toBe('Nassau');
      expect(chart.islandB).toBe('Tortuga');
    });
  });

  describe('createAllSmugglerRoutes', () => {
    it('creates 10 routes (C(5,2))', () => {
      const routes = ChartFactory.createAllSmugglerRoutes();
      expect(routes).toHaveLength(10);
    });

    it('all routes have unique island pairs', () => {
      const routes = ChartFactory.createAllSmugglerRoutes();
      const pairs = routes.map(r => [r.islandA, r.islandB].sort().join('-'));
      const unique = new Set(pairs);
      expect(unique.size).toBe(10);
    });

    it('all routes have unique IDs', () => {
      const routes = ChartFactory.createAllSmugglerRoutes();
      const ids = new Set(routes.map(r => r.id));
      expect(ids.size).toBe(10);
    });
  });

  describe('resetIdCounter', () => {
    it('resets IDs', () => {
      ChartFactory.createTreasureMap(createHexCoord(0, 0));
      ChartFactory.resetIdCounter();
      const chart = ChartFactory.createTreasureMap(createHexCoord(0, 0));
      expect(chart.id).toBe('chart-0');
    });
  });
});
