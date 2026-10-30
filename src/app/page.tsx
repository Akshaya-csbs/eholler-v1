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
import { DEFAULT_PENTAGON_AUDIT } from '@/lib/default-data';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  // Initialize with the authentic Pentagon Quality Management Consultants dashboard from screenshots
  const [data, setData] = useState<AuditResponse>(DEFAULT_PENTAGON_AUDIT);
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
        {/* Header matching original screenshot */}
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
                Resolving Google Places data, checking NAP consistency, analyzing SSL security, discovering competitors, and evaluating profile completeness.
              </p>
            </div>
          ) : activeTab === 'profile-opt' ? (
            /* Complete AI-Powered Google Business Profile Audit */
            <GbpAuditView
              auditResult={data.gbpCompleteAudit}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          ) : (
            /* Exact Screenshot Dashboard */
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
