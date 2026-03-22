import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../../core/Chart';
import { ChartType } from '../../types/GameTypes';

/** Extract a short numeric ID from a chart's id string (e.g. "chart-5" → "5") */
function mapNumber(chart: AnyChart): string {
  const match = chart.id.match(/\d+/);
  return match ? match[0] : '?';
}

export function chartLabel(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP:
      return `Treasure Map #${mapNumber(chart)}`;
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

export function chartColor(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: return '#c4a43a';
    case ChartType.ISLAND_RAID: return '#8b2500';
    case ChartType.SMUGGLER_ROUTE: return '#4a6a5a';
    default: return '#8b7355';
  }
}
