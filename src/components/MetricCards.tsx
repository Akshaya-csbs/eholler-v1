import React, { useState } from 'react';
import {
  Award,
  TrendingUp,
  Search,
  MapPin,
  Building2,
  Info,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { AuditResponse } from '@/lib/types';

interface MetricCardsProps {
  data: AuditResponse;
  onOpenGscModal?: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ data, onOpenGscModal }) => {
  const [showKeywordsMenu, setShowKeywordsMenu] = useState(false);
  const { scores, searchConsole } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* 1. Authority Score */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
            <Award className="w-3.5 h-3.5" />
          </div>
          <span>Authority Score</span>
          <Info className="w-3 h-3 text-gray-400 cursor-pointer ml-auto" />
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-purple-600"
                strokeDasharray={`${scores.authorityScore}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xl font-bold text-gray-900">{scores.authorityScore}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50">
          <span className="text-gray-500">Maps rank</span>
          <span className="inline-flex items-center text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
            <ArrowUpRight className="w-3 h-3 mr-0.5" /> #{scores.mapsRank}
          </span>
        </div>
      </div>

      {/* 2. Organic Traffic */}
      <div
        onClick={!searchConsole.connected && onOpenGscModal ? onOpenGscModal : undefined}
        className={`bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between transition ${
          !searchConsole.connected ? 'cursor-pointer hover:border-blue-200 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          <div className="w-5 h-5 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <span>Organic Traffic</span>
          <Info className="w-3 h-3 text-gray-400 cursor-pointer ml-auto" />
        </div>

        <div className="my-3 flex items-baseline justify-between">
          <span className="text-2xl font-bold text-gray-900">
            {searchConsole.connected && searchConsole.clicks !== null
              ? searchConsole.clicks.toLocaleString()
              : '—'}
          </span>

          {searchConsole.connected ? (
            <div className="w-24 h-8">
              <svg viewBox="0 0 100 30" className="w-full h-full text-indigo-500 fill-none stroke-current stroke-2">
                <path d="M0 5 Q 20 25, 40 18 T 70 28 T 100 12" />
              </svg>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGscModal?.();
              }}
              className="text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition"
            >
              Connect GSC
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50 text-gray-500">
          <span>Search Console</span>
          <span className="text-gray-400 text-[11px]">
            {searchConsole.connected ? 'Last 28 days (live)' : 'Click to connect'}
          </span>
        </div>
      </div>

      {/* 3. Organic Keywords */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between relative">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Search className="w-3.5 h-3.5" />
          </div>
          <span>Organic Keywords</span>
          <Info className="w-3 h-3 text-gray-400 cursor-pointer ml-auto" />
        </div>

        <div className="my-2 flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">
            {searchConsole.connected ? searchConsole.organicKeywordsCount : '—'}
          </span>
          <div className="w-20 h-6">
            <svg viewBox="0 0 80 20" className="w-full h-full text-blue-500 fill-none stroke-current stroke-2">
              <path d="M0 12 L 20 12 L 30 4 L 45 15 L 60 8 L 80 8" />
            </svg>
          </div>
        </div>

        <div className="relative pt-2 border-t border-gray-50">
          <button
            onClick={() => setShowKeywordsMenu(!showKeywordsMenu)}
            className="w-full py-1 px-2.5 rounded bg-[#C84A22] hover:bg-[#B33E1A] text-white text-[11px] font-medium flex items-center justify-between transition"
          >
            <span>View keywords</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Dropdown for Keywords */}
          {showKeywordsMenu && (
            <div className="absolute left-0 bottom-12 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-30 text-xs">
              <div className="font-semibold text-gray-900 mb-2 pb-1 border-b">Tracked Queries</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {!searchConsole.connected ? (
                  <div className="text-gray-500">Connect Search Console to load live queries.</div>
                ) : searchConsole.keywords.length === 0 ? (
                  <div className="text-gray-500">No query rows returned for this date range.</div>
                ) : (
                  searchConsole.keywords.map((kw, i) => (
                    <div key={i} className="flex justify-between items-center text-gray-600 py-0.5">
                      <span className="truncate pr-2">{kw.query}</span>
                      <span className="font-mono text-gray-900 shrink-0 font-semibold">#{kw.position}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Maps Visibility */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span>Maps Visibility</span>
          <Info className="w-3 h-3 text-gray-400 cursor-pointer ml-auto" />
        </div>

        <div className="my-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">{searchConsole.mapsVisibilityPercent}%</span>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            +100%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50 text-gray-500">
          <span>Top 10 keywords</span>
          <span className="font-semibold text-gray-900">{searchConsole.top10KeywordsCount}</span>
        </div>
      </div>

      {/* 5. GBP Health */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          <div className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <span>GBP Health</span>
          <Info className="w-3 h-3 text-gray-400 cursor-pointer ml-auto" />
        </div>

        <div className="my-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">{scores.gbpHealth}</span>
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
            {scores.gbpHealthChange > 0 ? `+${scores.gbpHealthChange}` : scores.gbpHealthChange}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50 text-gray-500">
          <span>Citation health</span>
          <span className="font-semibold text-gray-900">{scores.citationHealth}/100</span>
        </div>
      </div>
    </div>
  );
};
