'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { MetricCards } from '@/components/MetricCards';
import { OptimizationProgress } from '@/components/OptimizationProgress';
import { ToolsSection } from '@/components/ToolsSection';
import { InsightsActions } from '@/components/InsightsActions';
import { OnboardingModal } from '@/components/OnboardingModal';
import { AuditDetailModal } from '@/components/AuditDetailModal';
import { ConnectGscModal } from '@/components/ConnectGscModal';
import { AuditResponse, BusinessInput } from '@/lib/types';
import {
  AlertCircle,
  Search,
  Sparkles,
  RefreshCw,
  Building,
  MapPin,
  Globe,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isGscModalOpen, setIsGscModalOpen] = useState<boolean>(false);

  // Top Bar Search
  const [quickMapUrl, setQuickMapUrl] = useState<string>('');

  // Landing Form State (when no audit has been run yet)
  const [formMapUrl, setFormMapUrl] = useState<string>('');
  const [formBizName, setFormBizName] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formWebsite, setFormWebsite] = useState<string>('');

  const runAudit = async (input: BusinessInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/audit', input);
      setData(response.data);
      setIsOnboardingOpen(false);
    } catch (err: any) {
      console.error('Audit failed:', err);
      setError(
        err.response?.data?.error || err.message || 'Failed to complete audit for this business.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLandingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMapUrl.trim() && !formBizName.trim()) return;
    runAudit({
      mapUrl: formMapUrl.trim(),
      businessName: formBizName.trim(),
      city: formCity.trim(),
      websiteUrl: formWebsite.trim(),
    });
  };

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMapUrl.trim()) return;
    runAudit({ mapUrl: quickMapUrl.trim() });
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* 1. Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuditModal={() => setIsOnboardingOpen(true)}
        onOpenGscModal={() => setIsGscModalOpen(true)}
      />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        {data ? (
          <Header
            data={data}
            onRefresh={() =>
              runAudit({
                businessName: data.business.name,
                city: data.business.city,
                mapUrl: data.business.mapUrl,
                websiteUrl: data.business.websiteUrl,
              })
            }
            isLoading={isLoading}
            onOpenAuditModal={() => setIsOnboardingOpen(true)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
          />
        ) : (
          <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 font-medium">Local SEO Platform</div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Business Profile Auditor</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Places API Connected</span>
            </div>
          </div>
        )}

        {/* Top Quick Analyze Bar (always visible) */}
        <div className="bg-[#121A21] px-8 py-3 text-white border-b border-[#1E2B37] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-gray-200">Google Places API (New)</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Paste any Google Maps link:</span>
          </div>

          <form onSubmit={handleQuickSearch} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-96">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickMapUrl}
                onChange={(e) => setQuickMapUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/... or Maps place link"
                className="w-full bg-[#1A2632] border border-[#2A3C4D] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !quickMapUrl.trim()}
              className="px-3.5 py-1.5 bg-[#C84A22] hover:bg-[#B33E1A] text-white text-xs font-semibold rounded-lg shrink-0 transition disabled:opacity-50"
            >
              Analyze
            </button>
          </form>
        </div>

        {/* Content View */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="underline font-semibold hover:text-red-900 ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-orange-600 animate-spin mx-auto" />
              <div className="text-base font-bold text-gray-800">
                Fetching Google Business Profile &amp; Crawling Website...
              </div>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Resolving Google Places data, checking NAP consistency, analyzing SSL security, discovering competitors, and generating AI recommendations.
              </p>
            </div>
          ) : !data ? (
            /* Initial Welcome Box: Enter ANY Business */
            <div className="max-w-2xl mx-auto my-6 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-[#121A21] text-white p-6">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start a New Audit</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">Analyze Any Google Business Profile</h2>
                <p className="text-xs text-gray-300 mt-1">
                  Type or paste any Google Maps URL and website link below. The engine will inspect the profile, perform a complete Local SEO audit, and show missing &amp; inconsistent fields.
                </p>
              </div>

              <form onSubmit={handleLandingSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-orange-600" />
                    <span>Google Maps URL or Place ID (Required)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formMapUrl}
                    onChange={(e) => setFormMapUrl(e.target.value)}
                    placeholder="e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/place/..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/20"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Accepts short links (maps.app.goo.gl), Google Maps place URLs, or Place IDs.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                    <span>Website URL (Optional, for NAP &amp; SSL audit)</span>
                  </label>
                  <input
                    type="text"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="e.g. https://example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      <span>Business Name (Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formBizName}
                      onChange={(e) => setFormBizName(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>City or Region (Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="e.g. London, Chicago, Mumbai"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={!formMapUrl.trim() && !formBizName.trim()}
                    className="w-full py-3 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <span>Run Local SEO Audit &amp; Generate Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Dashboard Loaded for the specific Analyzed Business */
            <>
              {/* Local SEO Badge Banner matching screenshot 1 */}
              <div className="flex items-center justify-between pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-100/70 text-orange-800 text-[11px] font-bold tracking-wider uppercase">
                  <span>LOCAL SEO</span>
                </div>
                <div className="text-xs text-gray-500">Updated {data.business.updatedAt}</div>
              </div>

              {/* Business Name Subtitle */}
              <h2 className="text-xl font-bold text-gray-900 -mt-2">{data.business.name}</h2>

              {/* 1. Metric Cards (Authority Score, Organic Traffic, Keywords, Visibility, GBP Health) */}
              <MetricCards data={data} />

              {/* 2. Optimization Progress Bars */}
              <OptimizationProgress scores={data.scores} />

              {/* 3. Your Tools Section */}
              <ToolsSection data={data} onOpenAuditDrawer={() => setIsDrawerOpen(true)} />

              {/* 4. Insights & Actions (Priority Actions, AI Recommendations, Top Competitors) */}
              <InsightsActions data={data} onOpenAuditDrawer={() => setIsDrawerOpen(true)} />
            </>
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSubmit={runAudit}
        isLoading={isLoading}
      />

      <AuditDetailModal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={data}
      />

      <ConnectGscModal
        isOpen={isGscModalOpen}
        onClose={() => setIsGscModalOpen(false)}
        onConnect={() => {
          if (data) {
            setData({
              ...data,
              searchConsole: {
                ...data.searchConsole,
                connected: true,
              },
            });
          }
        }}
        isConnected={data?.searchConsole.connected || false}
      />
    </div>
  );
}
