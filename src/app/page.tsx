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
import { GbpAuditView } from '@/components/GbpAuditView';
import { AuditResponse, BusinessInput, GscAnalyticsResult } from '@/lib/types';
import { emptySearchConsoleMetrics, metricsFromAnalytics } from '@/lib/gsc-metrics';
import {
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
  Building,
  MapPin,
  Globe,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';

export default function DashboardPage() {
  // Start with no business selected — empty state until user submits a business
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

  // Landing form state for empty dashboard view
  const [landingMapUrl, setLandingMapUrl] = useState<string>('');
  const [landingBizName, setLandingBizName] = useState<string>('');
  const [landingCity, setLandingCity] = useState<string>('');
  const [landingWebsite, setLandingWebsite] = useState<string>('');

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
      // Ensure no mock fallback or stale data is retained on failure
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLandingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingMapUrl.trim() && !landingBizName.trim()) return;
    runAudit({
      mapUrl: landingMapUrl.trim(),
      businessName: landingBizName.trim(),
      city: landingCity.trim(),
      websiteUrl: landingWebsite.trim(),
    });
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
        <Header
          data={data}
          onRefresh={() => setIsOnboardingOpen(true)}
          isLoading={isLoading}
          onOpenAuditModal={() => setIsOnboardingOpen(true)}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          gscConnected={gscConnected}
          onOpenGscModal={() => setIsGscModalOpen(true)}
        />

        {/* Content View */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="underline font-semibold hover:text-red-900 ml-4 shrink-0 text-xs"
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
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                Resolving Google Places data, checking NAP consistency, analyzing SSL security, discovering competitors, and evaluating profile completeness.
              </p>
            </div>
          ) : !data ? (
            /* Clean Empty State: No business selected yet */
            <div className="space-y-6">
              {activeTab === 'profile-opt' ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto my-8 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#C84A22] flex items-center justify-center mx-auto mb-4">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No Business Profile Selected</h3>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Please submit a business using the form below or the &quot;Run Analysis&quot; button to view its 57 Google Business Profile fields, completeness score, and AI-tailored content.
                  </p>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#C84A22] text-white text-xs font-semibold rounded-lg hover:bg-[#B33E1A] transition shadow-sm"
                  >
                    <span>Go to Dashboard to Start Audit</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Landing Audit Submission Card */}
                  <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-[#121A21] text-white p-6">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Start a New Audit</span>
                      </div>
                      <h2 className="text-xl font-bold tracking-tight">Analyze Any Google Business Profile</h2>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                        Enter any Google Maps URL or business details below. The audit engine will inspect live Google Places signals, crawl the website for NAP consistency, and generate actionable SEO recommendations.
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
                          value={landingMapUrl}
                          onChange={(e) => setLandingMapUrl(e.target.value)}
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
                          value={landingWebsite}
                          onChange={(e) => setLandingWebsite(e.target.value)}
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
                            value={landingBizName}
                            onChange={(e) => setLandingBizName(e.target.value)}
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
                            value={landingCity}
                            onChange={(e) => setLandingCity(e.target.value)}
                            placeholder="e.g. London, Chicago, Chennai"
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isLoading || (!landingMapUrl.trim() && !landingBizName.trim())}
                          className="w-full py-3 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                          <Search className="w-4 h-4" />
                          <span>Run Local SEO Audit &amp; Generate Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* 3 Pillar Features preview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-2">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#C84A22] flex items-center justify-center mb-3">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">57 GBP Field Evaluation</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Evaluates core profile completeness, category selection, hours, attributes, services, and photo coverage against local SEO standards.
                      </p>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                        <Globe className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">NAP &amp; Website Parity</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Crawls the business website to cross-verify Name, Address, and Phone parity, SSL encryption, and LocalBusiness schema markup.
                      </p>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">AI SEO Recommendations</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Grounded recommendations with issue severity, evidence, recommended action, and ready-to-copy profile descriptions powered by OpenAI.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'profile-opt' ? (
            /* Complete AI-Powered Google Business Profile Audit */
            <GbpAuditView
              auditResult={data.gbpCompleteAudit}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          ) : (
            /* Live Dashboard for the Analyzed Business */
            <>
              {/* Main Local SEO Card with terracotta top border */}
              <div className="bg-white rounded-2xl p-6 border-t-4 border-[#C84A22] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded bg-[#FFF5F2] text-[#C84A22] text-xs font-bold tracking-wider uppercase">
                    LOCAL SEO
                  </span>
                  <span className="text-xs text-gray-500">Updated {data.business.updatedAt}</span>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">{data.business.name}</h2>

                {/* 1. Metric Cards (Authority Score, Organic Traffic, Keywords, Visibility, GBP Health) */}
                <MetricCards data={data} onOpenGscModal={() => setIsGscModalOpen(true)} />
              </div>

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
