import React, { useState } from 'react';
import { Star, ArrowUpRight, Copy, Check, Sparkles } from 'lucide-react';
import { AuditResponse } from '@/lib/types';

interface InsightsActionsProps {
  data: AuditResponse;
  onOpenAuditDrawer: () => void;
}

export const InsightsActions: React.FC<InsightsActionsProps> = ({ data, onOpenAuditDrawer }) => {
  const { priorityActions, aiRecommendations, competitors, optimizedDescriptionDraft } = data;
  const [copied, setCopied] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(optimizedDescriptionDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Insights &amp; Actions</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Column 1: Priority Actions (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Priority Actions</h3>
              <button
                onClick={onOpenAuditDrawer}
                className="text-[11px] font-semibold text-orange-600 hover:underline"
              >
                View all ({priorityActions.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {priorityActions.slice(0, 5).map((action) => (
                <div
                  key={action.id}
                  onClick={onOpenAuditDrawer}
                  className="p-3 rounded-lg border border-gray-100 bg-gray-50/70 hover:bg-orange-50/50 hover:border-orange-200 transition cursor-pointer flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-gray-800 pr-2">{action.title}</span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                      action.severity === 'high'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {action.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">
            Click any action to inspect detected vs recommended values
          </div>
        </div>

        {/* Column 2: AI Recommendations (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-gray-900">AI Recommendations</h3>
              </div>
              <button
                onClick={() => setShowDescriptionModal(true)}
                className="text-[11px] font-semibold text-orange-600 hover:underline flex items-center gap-1"
              >
                <span>Draft Profile Bio</span>
              </button>
            </div>

            <ul className="space-y-3.5">
              {aiRecommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs text-gray-700 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-orange-600 shrink-0 mt-1.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Powered by OpenAI &amp; Local SEO Models</span>
            <button
              onClick={() => setShowDescriptionModal(true)}
              className="text-xs font-semibold text-[#C84A22] hover:text-[#A33815] transition"
            >
              Get Optimized Description &rarr;
            </button>
          </div>
        </div>

        {/* Column 3: Top Competitors (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">Top Competitors</h3>

            <div className="space-y-4">
              {competitors.slice(0, 3).map((comp) => (
                <div key={comp.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-semibold text-gray-900 leading-snug truncate">
                      {comp.name}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                    <span className="font-bold text-gray-900 flex items-center gap-0.5">
                      {comp.rating}
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                    </span>
                    <span>·</span>
                    <span>{comp.reviews} reviews</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <button className="text-xs font-semibold text-gray-500 hover:text-orange-600 transition flex items-center gap-1">
              <span>View competitor analysis</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: AI Generated Profile Bio */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-bold text-gray-900">AI-Optimized Google Description</h3>
              </div>
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">
                Google allows up to 750 characters. This bio weaves your primary category, local region ({data.business.city}), and trust factors for optimal local ranking:
              </p>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs text-gray-800 leading-relaxed font-mono whitespace-pre-wrap">
                {optimizedDescriptionDraft}
              </div>
              <div className="text-[11px] text-gray-400 text-right mt-1.5">
                {optimizedDescriptionDraft.length} / 750 characters
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Close
              </button>
              <button
                onClick={handleCopy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-lg shadow-sm flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Description'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
