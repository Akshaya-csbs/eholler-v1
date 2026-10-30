'use client';

import React, { useEffect, useState } from 'react';
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
import { SearchConsolePanel } from '@/components/SearchConsolePanel';
import { GbpAuditView } from '@/components/GbpAuditView';
import { AuditResponse, BusinessInput, GscAnalyticsResult } from '@/lib/types';
import { emptySearchConsoleMetrics, metricsFromAnalytics } from '@/lib/gsc-metrics';
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
  LayoutDashboard,
  FileCheck2,
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
  const [gscConnected, setGscConnected] = useState<boolean>(false);
  const [gscProperty, setGscProperty] = useState<string | null>(null);
  const [gscLoading, setGscLoading] = useState<boolean>(false);
  const [gscAnalytics, setGscAnalytics] = useState<GscAnalyticsResult | null>(null);

  // Top Bar Search
  const [quickMapUrl, setQuickMapUrl] = useState<string>('');

  // Landing Form State (when no audit has been run yet)
  const [formMapUrl, setFormMapUrl] = useState<string>('');
  const [formBizName, setFormBizName] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formWebsite, setFormWebsite] = useState<string>('');

  const applyGscAnalytics = (analytics: GscAnalyticsResult | null, connected: boolean, property: string | null) => {
    setGscConnected(connected);
    setGscProperty(property);
    setGscAnalytics(analytics);
    setData((current) => {
      if (!current) return current;
      const mapsVisibility = current.searchConsole.mapsVisibilityPercent;
      return {
        ...current,
        searchConsole: analytics
          ? metricsFromAnalytics(analytics, mapsVisibility)
          : {
              ...emptySearchConsoleMetrics(mapsVisibility),
              connected,
              selectedProperty: property,
            },
      };
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gsc') === 'connected' || params.get('gsc_error')) {
      setIsGscModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    let cancelled = false;
    const hydrateGsc = async () => {
      setGscLoading(true);
      try {
        const statusRes = await axios.get('/api/connections/google/status');
        if (cancelled) return;
        setGscConnected(Boolean(statusRes.data.connected));
        setGscProperty(statusRes.data.selectedProperty || null);

        if (statusRes.data.connected && statusRes.data.selectedProperty) {
          const analyticsRes = await axios.get<GscAnalyticsResult>('/api/connections/google/analytics');
          if (cancelled) return;
          applyGscAnalytics(analyticsRes.data, true, statusRes.data.selectedProperty);
        }
      } catch {
        if (!cancelled) {
          setGscConnected(false);
        }
      } finally {
        if (!cancelled) setGscLoading(false);
      }
    };

    hydrateGsc();
    return () => {
      cancelled = true;
    };
  }, []);

  const runAudit = async (input: BusinessInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/audit', input);
      const audit: AuditResponse = response.data;
      if (gscConnected && gscProperty) {
        try {
          const analyticsRes = await axios.get<GscAnalyticsResult>('/api/connections/google/analytics', {
            params: { siteUrl: gscProperty },
          });
          audit.searchConsole = metricsFromAnalytics(
            analyticsRes.data,
            audit.searchConsole.mapsVisibilityPercent
          );
        } catch {
          audit.searchConsole = {
            ...audit.searchConsole,
            connected: true,
            selectedProperty: gscProperty,
          };
        }
      }
      setData(audit);
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
        gscConnected={gscConnected}
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
            gscConnected={gscConnected}
            onOpenGscModal={() => setIsGscModalOpen(true)}
          />
        ) : (
          <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 font-medium">Local SEO Platform</div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Business Profile Auditor</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Google Places API Connected</span>
              </div>
              <button
                onClick={() => setIsGscModalOpen(true)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-semibold ${
                  gscConnected
                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                    : 'text-gray-600 bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${gscConnected ? 'bg-blue-500' : 'bg-gray-400'}`} />
                <span>{gscConnected ? 'Search Console Connected' : 'Connect Google Search Console'}</span>
              </button>
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
              <div className="flex items-center justify-center gap-3 mt-4 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Google Places API
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Website Crawler
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  OpenAI Recommendations
                </span>
              </div>
            </div>
          ) : !data ? (
            /* Initial Welcome Box: Enter ANY Business */
            <div className="max-w-2xl mx-auto my-6 space-y-4">
            <SearchConsolePanel
              metrics={
                gscAnalytics
                  ? metricsFromAnalytics(gscAnalytics, 0)
                  : {
                      ...emptySearchConsoleMetrics(),
                      connected: gscConnected,
                      selectedProperty: gscProperty,
                    }
              }
              onOpenConnect={() => setIsGscModalOpen(true)}
              loading={gscLoading}
            />
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
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
            </div>
          ) : (
            /* Analyzed Business Loaded View */
            <div className="space-y-6">
              {/* Top View Switcher: Overview Dashboard vs Complete GBP Audit */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      activeTab === 'dashboard'
                        ? 'bg-[#121A21] text-white shadow'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Overview Dashboard</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('profile-opt')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      activeTab === 'profile-opt'
                        ? 'bg-[#C84A22] text-white shadow'
                        : 'bg-white text-gray-700 border border-orange-200 hover:bg-orange-50/50'
                    }`}
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-orange-500" />
                    <span>Complete GBP Audit (57 Fields)</span>
                    {data.gbpCompleteAudit && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          activeTab === 'profile-opt'
                            ? 'bg-white/20 text-white'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {data.gbpCompleteAudit.completenessScore}% Complete
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-xs text-gray-500">Updated {data.business.updatedAt}</div>
              </div>

              {activeTab === 'profile-opt' ? (
                /* Complete AI-Powered Google Business Profile Audit */
                <GbpAuditView
                  auditResult={data.gbpCompleteAudit}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                />
              ) : (
                /* Overview Dashboard */
                <>
                  {/* Local SEO Badge Banner */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-100/70 text-orange-800 text-[11px] font-bold tracking-wider uppercase">
                      <span>LOCAL SEO</span>
                    </div>
                  </div>

                  {/* Business Name Subtitle */}
                  <h2 className="text-xl font-bold text-gray-900 -mt-2">{data.business.name}</h2>

                  {/* Highlight Banner to Open Complete GBP Audit */}
                  {data.gbpCompleteAudit && (
                    <div className="bg-gradient-to-r from-orange-50 via-white to-orange-50/40 p-4 rounded-2xl border border-orange-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#C84A22] text-white flex items-center justify-center font-bold shrink-0 shadow">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <span>AI-Powered Google Business Profile Audit</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              {data.gbpCompleteAudit.completenessScore}% Completeness
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            57 profile fields evaluated across 9 categories · {data.gbpCompleteAudit.missingCount} missing · {data.gbpCompleteAudit.needsImprovementCount} need improvement · AI ready-to-copy content generated.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('profile-opt')}
                        className="px-4 py-2 bg-[#C84A22] hover:bg-[#B33E1A] text-white text-xs font-bold rounded-xl shrink-0 transition flex items-center gap-1.5 shadow"
                      >
                        <span>Open Complete Audit &amp; Content</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* 1. Metric Cards (Authority Score, Organic Traffic, Keywords, Visibility, GBP Health) */}
                  <MetricCards data={data} onOpenGscModal={() => setIsGscModalOpen(true)} />

                  <SearchConsolePanel
                    metrics={data.searchConsole}
                    onOpenConnect={() => setIsGscModalOpen(true)}
                    loading={gscLoading}
                  />

                  {/* 2. Optimization Progress Bars */}
                  <OptimizationProgress scores={data.scores} />

                  {/* 3. Your Tools Section */}
                  <ToolsSection
                    data={data}
                    onOpenAuditDrawer={() => setIsDrawerOpen(true)}
                    onOpenGbpAudit={() => setActiveTab('profile-opt')}
                  />

                  {/* 4. Insights & Actions (Priority Actions, AI Recommendations, Top Competitors) */}
                  <InsightsActions data={data} onOpenAuditDrawer={() => setIsDrawerOpen(true)} />
                </>
              )}
            </div>
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
        onOpenGbpAudit={() => setActiveTab('profile-opt')}
      />

      <ConnectGscModal
        isOpen={isGscModalOpen}
        onClose={() => setIsGscModalOpen(false)}
        isConnected={gscConnected}
        selectedProperty={gscProperty}
        onConnectedChange={({ connected, selectedProperty, analytics }) => {
          applyGscAnalytics(analytics, connected, selectedProperty);
        }}
      />
    </div>
  );
}
