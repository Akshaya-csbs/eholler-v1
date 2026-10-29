'use client';

import React from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { SearchConsoleMetrics } from '@/lib/types';

interface SearchConsolePanelProps {
  metrics: SearchConsoleMetrics;
  onOpenConnect: () => void;
  loading?: boolean;
}

function formatPercent(value: number | null): string {
  if (typeof value !== 'number') return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number | null): string {
  if (typeof value !== 'number') return '—';
  return value.toFixed(1);
}

export const SearchConsolePanel: React.FC<SearchConsolePanelProps> = ({
  metrics,
  onOpenConnect,
  loading = false,
}) => {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-gray-900">
            <BarChart2 className="w-4 h-4 text-teal-600" />
            Google Search Console
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.connected && metrics.selectedProperty
              ? `${metrics.selectedProperty}${metrics.dateRange ? ` · ${metrics.dateRange.startDate} to ${metrics.dateRange.endDate}` : ''}`
              : 'Connect a verified property to load live clicks, impressions, CTR, and average position.'}
          </p>
        </div>
        <button
          onClick={onOpenConnect}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          {metrics.connected ? 'Manage connection' : 'Connect Google Search Console'}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
          Loading Search Console data…
        </div>
      ) : !metrics.connected ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
          Search Console is not connected. Organic traffic numbers are hidden until Google authorization succeeds.
        </div>
      ) : !metrics.selectedProperty ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-xs text-amber-900">
          Google is connected, but no property is selected yet. Choose the website that matches this business.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Clicks</div>
              <div className="text-lg font-bold text-gray-900">{(metrics.clicks ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Impressions</div>
              <div className="text-lg font-bold text-gray-900">{(metrics.impressions ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">CTR</div>
              <div className="text-lg font-bold text-gray-900">{formatPercent(metrics.ctr)}</div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Avg. position</div>
              <div className="text-lg font-bold text-gray-900">{formatPosition(metrics.averagePosition)}</div>
            </div>
          </div>

          {metrics.keywords.length === 0 ? (
            <p className="text-xs text-gray-500 mt-4">
              No query-level rows were returned for this date range. Totals above still come from Search Console.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 font-semibold">Query</th>
                    <th className="py-2 font-semibold">Clicks</th>
                    <th className="py-2 font-semibold">Impressions</th>
                    <th className="py-2 font-semibold">CTR</th>
                    <th className="py-2 font-semibold">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.keywords.slice(0, 10).map((row) => (
                    <tr key={row.query} className="border-b border-gray-50">
                      <td className="py-2 pr-3 text-gray-800">{row.query}</td>
                      <td className="py-2">{row.clicks}</td>
                      <td className="py-2">{row.impressions}</td>
                      <td className="py-2">{formatPercent(row.ctr)}</td>
                      <td className="py-2">{formatPosition(row.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};
