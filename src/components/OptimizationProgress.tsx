import React from 'react';
import { AuditResponse } from '@/lib/types';

interface OptimizationProgressProps {
  scores: AuditResponse['scores'];
}

export const OptimizationProgress: React.FC<OptimizationProgressProps> = ({ scores }) => {
  const bars = [
    {
      label: 'GBP Optimization',
      value: scores.gbpOptimization,
      color: 'bg-amber-500',
    },
    {
      label: 'Citation Fixes',
      value: scores.citationFixes,
      color: 'bg-emerald-500',
    },
    {
      label: 'Review Growth',
      value: scores.reviewGrowth,
      color: 'bg-emerald-600',
    },
    {
      label: 'Keyword Rankings',
      value: scores.keywordRankings,
      color: 'bg-teal-600',
    },
  ];

  return (
    <div className="mt-8">
      <h2 className="text-base font-bold text-gray-900 mb-3">Optimization Progress</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {bars.map((bar, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
              <span>{bar.label}</span>
              <span className="font-bold text-gray-900">{bar.value}%</span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${bar.color}`}
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
