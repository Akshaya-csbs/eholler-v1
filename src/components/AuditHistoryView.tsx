'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  History,
  Building,
  Calendar,
  Award,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface AuditHistoryItem {
  id: string;
  businessId: string;
  businessName: string;
  city?: string;
  category?: string;
  status: string;
  authorityScore?: number;
  mapsRank?: number;
  gbpHealthScore?: number;
  createdAt: string;
  completedAt?: string;
}

interface AuditHistoryViewProps {
  onSelectAudit: (auditId: string) => void;
  currentAuditRunId?: string;
  onBackToDashboard?: () => void;
}

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({
  onSelectAudit,
  currentAuditRunId,
  onBackToDashboard,
}) => {
  const [audits, setAudits] = useState<AuditHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/audit?list=true');
        if (!cancelled) {
          setAudits(res.data?.audits || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to load audit history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">
            <History className="w-4 h-4" />
            <span>Audit Trail &amp; Version History</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Historical Local SEO Audits</h2>
          <p className="text-xs text-gray-500 mt-1">
            Every audit run is stored separately in PostgreSQL. Select any past audit to inspect its verified snapshot, scores, and recommendations.
          </p>
        </div>

        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="px-3.5 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Back to Dashboard
          </button>
        )}
      </div>

      {/* History List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto" />
            <div className="text-xs text-gray-500 font-medium">Loading historical audits from PostgreSQL...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-xs">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            {error}
          </div>
        ) : audits.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <History className="w-10 h-10 text-gray-400 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900">No Audits Recorded Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Run your first Local SEO audit using the dashboard to begin building your profile history.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {audits.map((item) => {
              const isCurrent = item.id === currentAuditRunId;
              const formattedDate = new Date(item.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-orange-50/20 transition ${
                    isCurrent ? 'bg-orange-50/40 border-l-4 border-orange-500' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{item.businessName}</span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-800">
                          Active View
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{item.category || 'Business'}</span>
                      <span>·</span>
                      <span>{item.city || 'Local Area'}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {item.status === 'COMPLETED' && (
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Authority</div>
                          <div className="text-sm font-bold text-purple-700">
                            {item.authorityScore ?? '—'}/100
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Maps Rank</div>
                          <div className="text-sm font-bold text-emerald-700">
                            #{item.mapsRank ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">GBP Health</div>
                          <div className="text-sm font-bold text-amber-700">
                            {item.gbpHealthScore ?? '—'}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => onSelectAudit(item.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        isCurrent
                          ? 'bg-gray-100 text-gray-700 cursor-default'
                          : 'bg-[#C84A22] text-white hover:bg-[#B33E1A] shadow-sm'
                      }`}
                    >
                      <span>{isCurrent ? 'Viewing' : 'Load Audit'}</span>
                      {!isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

