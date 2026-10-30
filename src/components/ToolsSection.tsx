import React from 'react';
import {
  ClipboardCheck,
  Target,
  Building,
  Image as ImageIcon,
  BarChart2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { AuditResponse } from '@/lib/types';

interface ToolsSectionProps {
  data: AuditResponse;
  onOpenAuditDrawer: () => void;
  onOpenGbpAudit?: () => void;
}

export const ToolsSection: React.FC<ToolsSectionProps> = ({
  data,
  onOpenAuditDrawer,
  onOpenGbpAudit,
}) => {
  const { business, competitors } = data;

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 leading-tight">Your tools</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Profile optimization, competitor insights, review management, image enhancement, and analytics.
        </p>
      </div>

      <div className="space-y-3">
        {/* 1. Profile Optimization */}
        <div
          onClick={onOpenGbpAudit || onOpenAuditDrawer}
          className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between hover:border-orange-200 hover:shadow transition cursor-pointer group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 group-hover:text-orange-600 transition">
                Profile Optimization
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Audit your Google Business Profile with a Maps link, see completion score, and get AI enhancement tips.
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600 transition" />
        </div>

        {/* 2. Competitor Analysis */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between hover:border-orange-200 hover:shadow transition">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Competitor Analysis</div>
              <div className="text-xs text-gray-500 mt-0.5">
                See if your category and location is low, medium, or high competition on Google Maps.
              </div>
              <div className="text-[11px] font-medium text-gray-700 mt-1">
                {business.category} · {business.city} · {competitors.length + 15} competitors
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-right">
            <span className="text-sm font-bold text-orange-600">High</span>
            <ChevronRight className="w-4 h-4 text-orange-600" />
          </div>
        </div>

        {/* 3. Franchise Tracking (Locked) */}
        <div className="bg-white/80 rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between opacity-80">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">Franchise Tracking</span>
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                See how many directories list your business profile and open each live listing or submit missing ones.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-right">
              <span className="text-sm font-bold text-gray-900">12</span>
              <span className="text-[11px] text-gray-400 block -mt-1">Live Listings</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* 4. Enhance Images (Locked) */}
        <div className="bg-white/80 rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between opacity-80">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">Enhance Images</span>
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Upload GBP photos, check compliance, and AI-enhance lighting, clarity, and color.
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>

        {/* 5. Analytics (Locked) */}
        <div className="bg-white/80 rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between opacity-80">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">Analytics</span>
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                30-day GBP traffic, reviews, footfall, hours comparison, and AI-powered competitor insights.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-xs font-bold text-gray-700">vs {competitors[0]?.name?.slice(0, 16) || 'Das Manpower'}</span>
              <span className="text-[10px] text-gray-400 block -mt-0.5">Competitor Benchmark</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
