import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../../core/Chart';
import { ChartType } from '../../types/GameTypes';

export function chartLabel(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: {
      const tm = chart as TreasureMapChart;
      return `Treasure Map (${tm.targetHex.q}, ${tm.targetHex.r})`;
    }
    case ChartType.ISLAND_RAID:
      return `Island Raid: ${(chart as IslandRaidChart).targetIsland}`;
    case ChartType.SMUGGLER_ROUTE: {
      const sr = chart as SmugglerRouteChart;
      return `Route: ${sr.islandA} — ${sr.islandB}`;
    }
    default:
      return 'Chart';
  }
}

export function chartDescription(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: {
      const tm = chart as TreasureMapChart;
      return `Control hex (${tm.targetHex.q}, ${tm.targetHex.r}) to claim 1 doubloon per player`;
    }
    case ChartType.ISLAND_RAID: {
      const raid = chart as IslandRaidChart;
      return `Control ${raid.targetIsland} to claim 4 notoriety + ${raid.doubloonsOnChart} doubloons`;
    }
    case ChartType.SMUGGLER_ROUTE: {
      const route = chart as SmugglerRouteChart;
      return `Connect ${route.islandA} to ${route.islandB} with your ships for doubloons`;
    }
    default:
      return '';
  }
}

export function chartColor(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: return '#c4a43a';
    case ChartType.ISLAND_RAID: return '#8b2500';
    case ChartType.SMUGGLER_ROUTE: return '#4a6a5a';
    default: return '#8b7355';
  }
}
