import { GscAnalyticsResult, SearchConsoleMetrics } from './types';

export function emptySearchConsoleMetrics(mapsVisibilityPercent = 0): SearchConsoleMetrics {
  return {
    connected: false,
    selectedProperty: null,
    clicks: null,
    impressions: null,
    ctr: null,
    averagePosition: null,
    dateRange: null,
    organicTraffic: 0,
    organicKeywordsCount: 0,
    mapsVisibilityPercent,
    top10KeywordsCount: 0,
    trafficTrend: [],
    keywords: [],
  };
}

export function metricsFromAnalytics(
  analytics: GscAnalyticsResult,
  mapsVisibilityPercent: number
): SearchConsoleMetrics {
  return {
    connected: true,
    selectedProperty: analytics.siteUrl,
    clicks: analytics.clicks,
    impressions: analytics.impressions,
    ctr: analytics.ctr,
    averagePosition: analytics.averagePosition,
    dateRange: { startDate: analytics.startDate, endDate: analytics.endDate },
    organicTraffic: analytics.clicks,
    organicKeywordsCount: analytics.queries.length,
    mapsVisibilityPercent,
    top10KeywordsCount: analytics.queries.filter((row) => row.position > 0 && row.position <= 10).length,
    trafficTrend: [],
    keywords: analytics.queries.map((row) => ({
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: Math.round(row.position * 10) / 10,
    })),
  };
}
