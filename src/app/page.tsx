'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthSync } from '@/hooks/useAuthSync';
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
import { WebsiteSeoView } from '@/components/WebsiteSeoView';
import { AuditHistoryView } from '@/components/AuditHistoryView';
import { AuditResponse, BusinessInput, GooglePlaceData, GscAnalyticsResult } from '@/lib/types';
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
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Star,
  Phone,
  Users2,
  History,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  // Start with no business selected — empty state until user submits a business
  const [data, setData] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Sync the authenticated Clerk user to the Neon PostgreSQL database once on load.
  // Runs exactly once per session; does not block the dashboard from rendering.
  const { syncStatus, syncError, retrySync } = useAuthSync();

  // Modals state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isGscModalOpen, setIsGscModalOpen] = useState<boolean>(false);
  const [gscConnected, setGscConnected] = useState<boolean>(false);
  const [gscProperty, setGscProperty] = useState<string | null>(null);
  const [gscLoading, setGscLoading] = useState<boolean>(false);
  const [gscAnalytics, setGscAnalytics] = useState<GscAnalyticsResult | null>(null);

  // Landing form state for empty dashboard view
  const [landingStep, setLandingStep] = useState<'input' | 'confirm'>('input');
  const [landingMapUrl, setLandingMapUrl] = useState<string>('');
  const [landingBizName, setLandingBizName] = useState<string>('');
  const [landingCity, setLandingCity] = useState<string>('');
  const [landingWebsite, setLandingWebsite] = useState<string>('');
  const [isLandingResolving, setIsLandingResolving] = useState<boolean>(false);
  const [landingCandidates, setLandingCandidates] = useState<GooglePlaceData[]>([]);
  const [landingSelected, setLandingSelected] = useState<GooglePlaceData | null>(null);

  // Metadata of previously completed audit in PostgreSQL (available without auto-selecting)
  const [previousAuditSummary, setPreviousAuditSummary] = useState<{
    id: string;
    businessName: string;
    city?: string;
    category?: string;
    authorityScore?: number;
    gbpHealthScore?: number;
    createdAt: string;
  } | null>(null);

  const applyGscAnalytics = (
    analytics: GscAnalyticsResult | null,
    connected: boolean,
    property: string | null
  ) => {
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

    // Check for existing audits in PostgreSQL to offer "Open Last Audit"
    // without automatically hydrating or replacing the input screen
    const checkPreviousAudits = async () => {
      try {
        const listRes = await axios.get('/api/audit?list=true');
        if (!cancelled && listRes.data?.audits && listRes.data.audits.length > 0) {
          setPreviousAuditSummary(listRes.data.audits[0]);
        }
      } catch (e) {
        console.warn('Could not check audit history:', e);
      }
    };

    const hydrateGsc = async () => {
      setGscLoading(true);
      try {
        const statusRes = await axios.get('/api/connections/google/status');
        if (cancelled) return;
        setGscConnected(Boolean(statusRes.data.connected));
        setGscProperty(statusRes.data.selectedProperty || null);

        if (statusRes.data.connected && statusRes.data.selectedProperty) {
          const analyticsRes = await axios.get<GscAnalyticsResult>(
            '/api/connections/google/analytics'
          );
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

    checkPreviousAudits();
    hydrateGsc();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartNewAudit = () => {
    setData(null);
    setLandingStep('input');
    setLandingMapUrl('');
    setLandingBizName('');
    setLandingCity('');
    setLandingWebsite('');
    setLandingCandidates([]);
    setLandingSelected(null);
    setError(null);
    setActiveTab('dashboard');
  };

  const handleRerunCurrentAudit = () => {
    if (!data) return;
    runAudit({
      businessName: data.business.name,
      city: data.business.city || undefined,
      mapUrl: data.business.mapUrl || (data.business.placeId ? `https://www.google.com/maps/place/?q=place_id:${data.business.placeId}` : ''),
      websiteUrl: data.business.websiteUrl,
    });
  };

  const runAudit = async (input: BusinessInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/audit', input);
      const audit: AuditResponse = response.data;
      if (gscConnected && gscProperty) {
        try {
          const analyticsRes = await axios.get<GscAnalyticsResult>(
            '/api/connections/google/analytics',
            {
              params: { siteUrl: gscProperty },
            }
          );
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
      setLandingStep('input');
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error('Audit failed:', err);
      setError(
        err.response?.data?.error || err.message || 'Failed to complete audit for this business.'
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditById = async (auditId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/audit', { params: { auditId } });
      if (res.data?.audit) {
        setData(res.data.audit);
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load selected audit.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLandingResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedMap = landingMapUrl.trim();
    const trimmedName = landingBizName.trim();
    const trimmedWeb = landingWebsite.trim();

    if (!trimmedMap && !trimmedName) {
      setError('Please enter a Google Maps URL, Place ID, or Business Name.');
      return;
    }

    if (!trimmedWeb) {
      setError('Website URL is required for NAP verification and on-page SEO analysis.');
      return;
    }

    setIsLandingResolving(true);
    try {
      const res = await axios.post('/api/business/resolve', {
        mapUrl: trimmedMap,
        businessName: trimmedName,
        city: landingCity.trim(),
        websiteUrl: trimmedWeb,
      });

      const list: GooglePlaceData[] = res.data.candidates || [];
      if (list.length === 0) {
        setError('No matching Google Business Profile found. Please check the Maps URL or enter your exact business name.');
        return;
      }

      setLandingCandidates(list);
      setLandingSelected(list[0]);
      setLandingStep('confirm');
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || 'Failed to resolve business profile with Google Places API.'
      );
    } finally {
      setIsLandingResolving(false);
    }
  };

  const handleLandingConfirmAndRun = () => {
    if (!landingSelected) return;

    runAudit({
      businessName: landingSelected.displayName,
      city: landingCity.trim() || undefined,
      mapUrl: landingMapUrl.trim() || `https://www.google.com/maps/place/?q=place_id:${landingSelected.id}`,
      websiteUrl: landingWebsite.trim() || landingSelected.websiteUri || undefined,
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
        onNewAudit={handleStartNewAudit}
        gscConnected={gscConnected}
      />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <Header
          data={data}
          onRefresh={handleRerunCurrentAudit}
          isLoading={isLoading}
          onOpenAuditModal={() => setIsOnboardingOpen(true)}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onNewAudit={handleStartNewAudit}
          gscConnected={gscConnected}
          onOpenGscModal={() => setIsGscModalOpen(true)}
        />

        {/* Content View */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Auth sync error banner — shown only on failure, with retry action */}
          {syncStatus === 'error' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-medium">
                  Session sync failed: {syncError || 'Unknown error'}. Your work is safe — please retry.
                </span>
              </div>
              <button
                onClick={retrySync}
                className="underline font-semibold hover:text-amber-900 ml-4 shrink-0 text-xs"
              >
                Retry
              </button>
            </div>
          )}

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
                Resolving Places data, evaluating 57 GBP fields, crawling subpages for NAP &amp; Schema markup, and generating draft AI recommendations.
              </p>
            </div>
          ) : !data ? (
            /* Clean Empty State: No business selected yet */
            <div className="space-y-6">
              {activeTab === 'audit-history' ? (
                <AuditHistoryView
                  onSelectAudit={loadAuditById}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                />
              ) : (
                <>
                  {/* Previous Audit Notification Card */}
                  {previousAuditSummary && landingStep === 'input' && (
                    <div className="max-w-2xl mx-auto bg-gradient-to-r from-orange-50/90 to-amber-50/90 border border-orange-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                              <History className="w-3 h-3 text-orange-600" />
                              Previous Audit Found
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {new Date(previousAuditSummary.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-900">
                            {previousAuditSummary.businessName}
                            {previousAuditSummary.city ? ` · ${previousAuditSummary.city}` : ''}
                          </div>
                          <p className="text-xs text-gray-600">
                            A saved audit is available in PostgreSQL. You can open it directly or analyze a new business below.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => loadAuditById(previousAuditSummary.id)}
                            className="px-4 py-2 bg-[#C84A22] hover:bg-[#B33E1A] text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                          >
                            <span>Open Last Audit</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('audit-history')}
                            className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition"
                          >
                            View All History
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Landing Audit Submission Card with 2-Step Confirmation */}
                  <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-[#121A21] text-white p-6">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {landingStep === 'input'
                            ? 'Step 1: Enter Business Info'
                            : 'Step 2: Confirm Identity'}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold tracking-tight">
                        {landingStep === 'input'
                          ? 'Analyze Any Google Business Profile'
                          : 'Confirm Business Identity Before Audit'}
                      </h2>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                        {landingStep === 'input'
                          ? 'Enter any Google Maps URL or Place ID and website URL below. The engine will resolve live Google data, crawl the website for NAP consistency, and evaluate 57 Local SEO fields.'
                          : 'Review the verified Google Places profile below. Confirm to begin the deep audit.'}
                      </p>
                    </div>

                    {landingStep === 'input' ? (
                      <form onSubmit={handleLandingResolve} className="p-6 space-y-4">
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
                            placeholder="e.g. https://maps.app.goo.gl/... or Place ID (ChIJ...)"
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/20"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">
                            Accepts short links (maps.app.goo.gl), Google Maps place URLs, or direct Place IDs.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-blue-600" />
                            <span>Business Website URL (Required)</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={landingWebsite}
                            onChange={(e) => setLandingWebsite(e.target.value)}
                            placeholder="e.g. https://example.com"
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">
                            Used to inspect on-page SEO, crawl key subpages, and cross-verify NAP consistency.
                          </p>
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
                            disabled={
                              isLandingResolving ||
                              (!landingMapUrl.trim() && !landingBizName.trim()) ||
                              !landingWebsite.trim()
                            }
                            className="w-full py-3 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                          >
                            {isLandingResolving ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Resolving with Google Places API...</span>
                              </>
                            ) : (
                              <>
                                <Search className="w-4 h-4" />
                                <span>Verify Business &amp; Preview</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Landing Confirmation Step */
                      <div className="p-6 space-y-4">
                        {landingCandidates.length > 1 && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Multiple Places Matched ({landingCandidates.length}). Choose Yours:
                            </label>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {landingCandidates.map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => setLandingSelected(c)}
                                  className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                                    landingSelected?.id === c.id
                                      ? 'border-orange-500 bg-orange-50/50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div>
                                    <div className="font-bold text-gray-900">{c.displayName}</div>
                                    <div className="text-gray-500 text-[11px] truncate max-w-sm">
                                      {c.formattedAddress}
                                    </div>
                                  </div>
                                  <input
                                    type="radio"
                                    checked={landingSelected?.id === c.id}
                                    onChange={() => setLandingSelected(c)}
                                    className="text-orange-600 focus:ring-orange-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {landingSelected && (
                          <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/30 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-800">
                                  {landingSelected.primaryType || 'Local Business'}
                                </span>
                                <h3 className="text-lg font-bold text-gray-900 mt-1">
                                  {landingSelected.displayName}
                                </h3>
                              </div>
                              {landingSelected.rating > 0 && (
                                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded text-xs font-bold text-amber-900">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  <span>{landingSelected.rating}</span>
                                  <span className="text-gray-400 font-normal">
                                    ({landingSelected.userRatingCount})
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-gray-600 space-y-1.5 pt-1 border-t border-orange-100">
                              <div className="flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                <span>{landingSelected.formattedAddress}</span>
                              </div>
                              {landingSelected.nationalPhoneNumber && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span>{landingSelected.nationalPhoneNumber}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate">Website: {landingWebsite}</span>
                              </div>
                            </div>

                            <div className="text-[11px] text-gray-500 pt-1">
                              Place ID: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">{landingSelected.id}</code>
                            </div>
                          </div>
                        )}

                        <div className="pt-3 flex items-center justify-between border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => setLandingStep('input')}
                            className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Change Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleLandingConfirmAndRun}
                            disabled={isLoading}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirm &amp; Run Analysis</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
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
          ) : activeTab === 'website-seo' ? (
            /* On-Page Website SEO & NAP Parity View */
            <WebsiteSeoView
              data={data}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          ) : activeTab === 'audit-history' ? (
            /* Historical Audits View from PostgreSQL */
            <AuditHistoryView
              onSelectAudit={loadAuditById}
              currentAuditRunId={data.auditRunId}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          ) : activeTab === 'competitor-analysis' ? (
            /* Service-Based Competitor Intelligence Tab */
            (() => {
              const profile = data.targetServiceProfile;
              const directComps =
                data.directCompetitors || data.competitors.filter((c) => c.classification === 'direct');
              const relatedComps =
                data.relatedCompetitors || data.competitors.filter((c) => c.classification === 'related');

              return (
                <div className="space-y-6">
                  {/* Header Banner */}
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 mb-1">
                        <Users2 className="w-4 h-4" />
                        <span>Service-Driven Competitor Intelligence</span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">Local Service Competitor Analysis</h2>
                      <p className="text-xs text-gray-500 mt-1">
                        Competitors discovered and verified by matching actual services provided, strictly sorted by Google rating.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="px-3.5 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                      Back to Dashboard
                    </button>
                  </div>

                  {/* Target Business Service Profile Card */}
                  {profile && (
                    <div className="bg-gradient-to-br from-gray-900 to-[#121A21] text-white rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-orange-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                            Validated Commercial Service Profile
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.confidenceScore !== undefined && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {profile.confidenceScore}% Confidence
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400">
                            {profile.sourceSummary || 'Derived from crawled website & Google Places'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                          <span className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider block">
                            Actual Commercial Activity
                          </span>
                          <span className="text-white font-bold text-sm block">
                            {profile.actualBusinessType || profile.mainService}
                          </span>
                          <span className="text-gray-400 text-[11px] block">
                            Maps Category: {profile.mapsCategory || data.business.category}
                          </span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                          <span className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider block">
                            Primary Services ({profile.primaryServices?.length || 1})
                          </span>
                          <span className="text-gray-200 font-medium block truncate" title={profile.primaryServices?.join(', ') || profile.mainService}>
                            {profile.primaryServices?.length
                              ? profile.primaryServices.slice(0, 3).join(', ')
                              : profile.mainService}
                          </span>
                          <span className="text-gray-400 text-[11px] block">
                            Core offerings used for direct competitor discovery
                          </span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                          <span className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider block">
                            Secondary Services ({profile.secondaryServices?.length || 0})
                          </span>
                          <span className="text-gray-200 font-medium block truncate" title={profile.secondaryServices?.join(', ') || 'None'}>
                            {profile.secondaryServices?.length
                              ? profile.secondaryServices.slice(0, 3).join(', ')
                              : 'None detected'}
                          </span>
                          <span className="text-gray-400 text-[11px] block">
                            Used for related service provider discovery
                          </span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                          <span className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider block">
                            Market &amp; Customers
                          </span>
                          <span className="text-gray-200 font-medium block truncate">
                            {profile.serviceLocations?.join(', ') || profile.serviceArea || data.business.city || 'Regional'}
                          </span>
                          <span className="text-gray-400 text-[11px] block truncate" title={profile.targetCustomers}>
                            {profile.targetCustomers || 'Enterprise and commercial clients'}
                          </span>
                        </div>
                      </div>

                      {profile.conflictNotes && profile.conflictNotes.length > 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Listing Category Conflict: </span>
                            {profile.conflictNotes.join(' ')}
                          </div>
                        </div>
                      )}

                      {profile.isServiceProfileValidated === false && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Validation Notice: </span>
                            {profile.validationFailureReason || 'Website commercial service evidence could not be validated. Competitor discovery suspended.'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section A: Direct Competitors */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                          <span>Direct Competitors ({directComps.length})</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Verified local businesses offering the same core service (
                          <strong className="text-gray-700">
                            {profile?.mainService || data.business.category}
                          </strong>
                          ). Sorted by highest Google rating first.
                        </p>
                      </div>
                    </div>

                    {directComps.length === 0 ? (
                      <div className="p-8 bg-white rounded-2xl border border-dashed border-gray-300 text-center text-xs text-gray-500 space-y-1">
                        <p className="font-semibold text-gray-700">
                          No direct competitors identified for &quot;{profile?.mainService || data.business.category}&quot;
                        </p>
                        <p className="text-gray-400 text-[11px] max-w-md mx-auto">
                          No competing businesses in this immediate geographical market offered the exact same primary service.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {directComps.map((comp, idx) => (
                          <div
                            key={comp.id || idx}
                            className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-sm text-gray-900">{comp.name}</div>
                                <span className="text-[11px] text-gray-500">{comp.category || 'Local Business'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  <span>{comp.rating ? comp.rating.toFixed(1) : 'Unrated'}</span>
                                  <span className="text-gray-400 font-normal">({comp.reviews} reviews)</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-gray-600 space-y-1.5 pt-1 border-t border-gray-100">
                              <div className="flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                <span className="truncate">{comp.address || 'Local Service Area'}</span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>
                                  <strong>Main Service:</strong>{' '}
                                  {comp.mainServiceIdentified || profile?.mainService}
                                </span>
                              </div>
                            </div>

                            {comp.rationale && (
                              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-700 leading-relaxed">
                                {comp.rationale}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                  Direct Competitor
                                </span>
                                {comp.evidenceConfidence && (
                                  <span className="text-[10px] text-gray-500">
                                    {comp.evidenceConfidence === 'high' ? 'Verified Website' : 'Google Maps Profile'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {(comp.evidenceSourceUrl || comp.websiteUri) && (
                                  <a
                                    href={comp.evidenceSourceUrl || comp.websiteUri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:text-orange-800 font-medium inline-flex items-center gap-1"
                                    title={comp.evidenceSourceUrl ? `Verified source: ${comp.evidenceSourceUrl}` : 'Competitor Website'}
                                  >
                                    <span>{comp.evidenceSourceUrl && comp.evidenceSourceUrl !== comp.websiteUri ? 'Verified Service' : 'Website'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                {comp.mapUrl && (
                                  <a
                                    href={comp.mapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-500 hover:text-gray-800 font-medium inline-flex items-center gap-1"
                                  >
                                    <span>Maps</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section B: Related Competitors */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          <span>Related Competitors ({relatedComps.length})</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Local businesses offering overlapping secondary services or adjacent offerings. Sorted by highest Google rating first.
                        </p>
                      </div>
                    </div>

                    {relatedComps.length === 0 ? (
                      <div className="p-8 bg-white rounded-2xl border border-dashed border-gray-300 text-center text-xs text-gray-500 space-y-1">
                        <p className="font-semibold text-gray-700">No related competitors identified</p>
                        <p className="text-gray-400 text-[11px] max-w-md mx-auto">
                          No overlapping secondary service providers were discovered in this search radius.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedComps.map((comp, idx) => (
                          <div
                            key={comp.id || idx}
                            className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-sm text-gray-900">{comp.name}</div>
                                <span className="text-[11px] text-gray-500">{comp.category || 'Local Business'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  <span>{comp.rating ? comp.rating.toFixed(1) : 'Unrated'}</span>
                                  <span className="text-gray-400 font-normal">({comp.reviews} reviews)</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-gray-600 space-y-1.5 pt-1 border-t border-gray-100">
                              <div className="flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                <span className="truncate">{comp.address || 'Local Service Area'}</span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>
                                  <strong>Overlaps with:</strong>{' '}
                                  {comp.matchedTargetService || 'Secondary offering'}
                                </span>
                              </div>
                            </div>

                            {comp.rationale && (
                              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-700 leading-relaxed">
                                {comp.rationale}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Related Provider
                                </span>
                                {comp.evidenceConfidence && (
                                  <span className="text-[10px] text-gray-500">
                                    {comp.evidenceConfidence === 'high' ? 'Verified Website' : 'Google Maps Profile'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {(comp.evidenceSourceUrl || comp.websiteUri) && (
                                  <a
                                    href={comp.evidenceSourceUrl || comp.websiteUri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:text-orange-800 font-medium inline-flex items-center gap-1"
                                    title={comp.evidenceSourceUrl ? `Verified source: ${comp.evidenceSourceUrl}` : 'Competitor Website'}
                                  >
                                    <span>{comp.evidenceSourceUrl && comp.evidenceSourceUrl !== comp.websiteUri ? 'Verified Service' : 'Website'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                {comp.mapUrl && (
                                  <a
                                    href={comp.mapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-500 hover:text-gray-800 font-medium inline-flex items-center gap-1"
                                  >
                                    <span>Maps</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
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
              <InsightsActions
                data={data}
                onOpenAuditDrawer={() => setIsDrawerOpen(true)}
                onOpenCompetitors={() => setActiveTab('competitor-analysis')}
              />
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
        businessWebsiteUrl={data?.business.websiteUrl || landingWebsite}
        onConnectedChange={({ connected, selectedProperty, analytics }) => {
          applyGscAnalytics(analytics, connected, selectedProperty);
        }}
      />
    </div>
  );
}
