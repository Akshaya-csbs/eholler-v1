import React, { useState } from 'react';
import {
  Star,
  ArrowUpRight,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Search,
  FileText,
  Globe,
  BarChart2,
  Zap,
  Clock,
} from 'lucide-react';
import { AuditResponse, StructuredRecommendation } from '@/lib/types';

interface InsightsActionsProps {
  data: AuditResponse;
  onOpenAuditDrawer: () => void;
}

// Category display config
const categoryConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  missing_seo_field: { label: 'Missing SEO Field', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  inconsistent_info: { label: 'Inconsistent Info', icon: Shield, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  incomplete_description: { label: 'Incomplete Description', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  missing_meta: { label: 'Missing Meta', icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  content_optimization: { label: 'Content Optimization', icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  search_console: { label: 'Search Console', icon: BarChart2, color: 'text-teal-600', bgColor: 'bg-teal-50' },
  local_seo_priority: { label: 'Local SEO Priority', icon: Search, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
};

const severityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-800', bgColor: 'bg-red-100' },
  high: { label: 'High', color: 'text-amber-800', bgColor: 'bg-amber-100' },
  medium: { label: 'Medium', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
  low: { label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-200' },
};

const effortConfig: Record<string, { label: string; icon: React.ElementType }> = {
  quick_win: { label: 'Quick Win', icon: Zap },
  moderate: { label: 'Moderate', icon: Clock },
  significant: { label: 'Significant', icon: BarChart2 },
};

function RecommendationCard({ rec, index }: { rec: StructuredRecommendation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  const cat = categoryConfig[rec.category] || categoryConfig.local_seo_priority;
  const sev = severityConfig[rec.severity] || severityConfig.medium;
  const effort = effortConfig[rec.estimatedEffort] || effortConfig.moderate;
  const CatIcon = cat.icon;
  const EffortIcon = effort.icon;

  const handleCopySuggested = () => {
    if (rec.suggestedContent) {
      navigator.clipboard.writeText(rec.suggestedContent);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg bg-white hover:border-orange-200 transition">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3.5 flex items-start gap-3 text-left"
      >
        <div className={`w-7 h-7 rounded-lg ${cat.bgColor} ${cat.color} flex items-center justify-center shrink-0 mt-0.5`}>
          <CatIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-900">{rec.issueTitle}</span>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${sev.bgColor} ${sev.color}`}>
              {sev.label}
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
              <EffortIcon className="w-2.5 h-2.5" />
              {effort.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-600 mt-1 leading-relaxed line-clamp-2">{rec.explanation}</p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-gray-50">
          {/* Evidence */}
          <div className="mt-3">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Evidence</div>
            <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">{rec.evidence}</p>
          </div>

          {/* Recommended Action */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Recommended Action</div>
            <p className="text-xs text-gray-800 leading-relaxed">{rec.recommendedAction}</p>
          </div>

          {/* Suggested Content (Draft) */}
          {rec.suggestedContent && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Suggested Content (Draft — Review Before Using)</div>
                <button
                  onClick={handleCopySuggested}
                  className="text-[10px] font-semibold text-orange-600 hover:text-orange-800 flex items-center gap-1 transition"
                >
                  {copiedContent ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedContent ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="text-xs text-gray-700 bg-orange-50/50 p-3 rounded-lg border border-orange-200 font-mono whitespace-pre-wrap leading-relaxed">
                {rec.suggestedContent}
              </div>
            </div>
          )}

          {/* Category & Effort */}
          <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-400">
            <span className={`inline-flex items-center gap-1 ${cat.color}`}>
              <CatIcon className="w-3 h-3" />
              {cat.label}
            </span>
            <span>·</span>
            <span>All suggestions are drafts requiring your approval</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const InsightsActions: React.FC<InsightsActionsProps> = ({ data, onOpenAuditDrawer }) => {
  const { priorityActions, aiRecommendations, competitors, optimizedDescriptionDraft, structuredRecommendations } = data;
  const [copied, setCopied] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  // AI recommendations loading / retry state
  const [isLoadingAIRecs, setIsLoadingAIRecs] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [retryableError, setRetryableError] = useState(false);
  const [localStructuredRecs, setLocalStructuredRecs] = useState<StructuredRecommendation[] | undefined>(structuredRecommendations);
  const [localDescriptionDraft, setLocalDescriptionDraft] = useState<string>(optimizedDescriptionDraft);

  const hasStructuredRecs = localStructuredRecs && localStructuredRecs.length > 0;

  const handleRetryAIRecs = async () => {
    setIsLoadingAIRecs(true);
    setAiError(null);

    try {
      const response = await fetch('/api/ai-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditFindings: priorityActions,
          business: data.business,
          websiteAudit: undefined,
          competitors,
          searchConsole: data.searchConsole,
          missingFields: data.missingFields,
          inconsistentFields: data.inconsistentFields,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setAiError(result.error || 'Failed to generate recommendations.');
        setRetryableError(result.retryable ?? true);
        return;
      }

      setLocalStructuredRecs(result.recommendations);
      if (result.descriptionDraft) {
        setLocalDescriptionDraft(result.descriptionDraft);
      }
    } catch (err: any) {
      setAiError(err.message || 'Network error. Please check your connection and try again.');
      setRetryableError(true);
    } finally {
      setIsLoadingAIRecs(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localDescriptionDraft);
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
              <div className="flex items-center gap-2">
                {!isLoadingAIRecs && (
                  <button
                    onClick={handleRetryAIRecs}
                    className="text-[11px] font-semibold text-gray-500 hover:text-orange-600 flex items-center gap-1 transition"
                    title="Regenerate AI recommendations"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                )}
                <button
                  onClick={() => setShowDescriptionModal(true)}
                  className="text-[11px] font-semibold text-orange-600 hover:underline flex items-center gap-1"
                >
                  <span>Draft Profile Bio</span>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingAIRecs && (
              <div className="py-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-orange-600 animate-spin mx-auto" />
                <p className="text-xs text-gray-500">Generating AI-powered recommendations...</p>
                <p className="text-[10px] text-gray-400">Analyzing audit findings and business profile</p>
              </div>
            )}

            {/* Error State */}
            {aiError && !isLoadingAIRecs && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-800">AI Recommendation Error</p>
                    <p className="text-[11px] text-red-700 mt-0.5">{aiError}</p>
                    {retryableError && (
                      <button
                        onClick={handleRetryAIRecs}
                        className="mt-2 px-3 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Structured Recommendations (new) */}
            {!isLoadingAIRecs && hasStructuredRecs && (
              <div className="space-y-2">
                {localStructuredRecs!.map((rec, index) => (
                  <RecommendationCard key={index} rec={rec} index={index} />
                ))}
              </div>
            )}

            {/* Legacy flat recommendations (fallback) */}
            {!isLoadingAIRecs && !hasStructuredRecs && !aiError && (
              <ul className="space-y-3.5">
                {aiRecommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-xs text-gray-700 leading-relaxed">
                    <span className="w-2 h-2 rounded-full bg-orange-600 shrink-0 mt-1.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {hasStructuredRecs ? 'Powered by OpenAI Responses API' : 'Powered by OpenAI & Local SEO Models'}
            </span>
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
                {localDescriptionDraft}
              </div>
              <div className="text-[11px] text-gray-400 text-right mt-1.5">
                {localDescriptionDraft.length} / 750 characters
              </div>
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                ⚠️ This is a draft suggestion. Review carefully before publishing to your Google Business Profile.
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
