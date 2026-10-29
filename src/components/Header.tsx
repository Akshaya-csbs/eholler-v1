import React from 'react';
import { ExternalLink, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import { AuditResponse } from '@/lib/types';

interface HeaderProps {
  data: AuditResponse | null;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenAuditModal: () => void;
  onOpenDrawer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  onRefresh,
  isLoading,
  onOpenAuditModal,
  onOpenDrawer,
}) => {
  if (!data) return null;

  const { business } = data;
  const cleanWebsite = business.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-1.5">
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span>&rsaquo;</span>
          <span className="text-gray-900 font-semibold">{business.name}</span>
          <a
            href={business.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-orange-600 transition flex items-center gap-1"
          >
            {cleanWebsite}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Business Title & Details */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{business.name}</h1>
          {cleanWebsite && (
            <a
              href={business.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-orange-600 hover:underline flex items-center gap-1"
            >
              {cleanWebsite}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Metadata sub-row */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          <span className="font-medium text-gray-700">{business.city || 'Local Area'}</span>
          <span>·</span>
          <span>{business.category}</span>
          <span>·</span>
          <span>Updated {business.updatedAt}</span>
          {data.missingFields.length > 0 && (
            <button
              onClick={onOpenDrawer}
              className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition"
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              {data.missingFields.length} missing fields
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenDrawer}
          className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 flex items-center gap-2 transition"
        >
          <Layers className="w-4 h-4 text-gray-600" />
          <span>Audit Breakdown</span>
        </button>

        <button
          onClick={onOpenAuditModal}
          className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 transition"
        >
          Switch Business URL
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] shadow-sm flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Analyzing...' : 'Run analysis'}</span>
        </button>
      </div>
    </div>
  );
};
