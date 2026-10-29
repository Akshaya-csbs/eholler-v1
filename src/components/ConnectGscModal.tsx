'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  Search,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Unplug,
  BarChart2,
} from 'lucide-react';
import { GscAnalyticsResult, GscProperty } from '@/lib/types';

interface ConnectGscModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectedChange: (payload: {
    connected: boolean;
    selectedProperty: string | null;
    analytics: GscAnalyticsResult | null;
  }) => void;
  isConnected: boolean;
  selectedProperty: string | null;
}

const ERROR_COPY: Record<string, string> = {
  oauth_not_configured:
    'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.',
  access_denied: 'Google authorization was cancelled. No Search Console data was connected.',
  google_oauth_error: 'Google returned an OAuth error. Check the client ID, secret, and redirect URI.',
  missing_code: 'Google did not return an authorization code. Try connecting again.',
  invalid_state: 'The OAuth state check failed. This can happen if the login expired — try connecting again.',
  token_exchange_failed: 'Could not complete Google authorization. Confirm the redirect URI matches Google Cloud exactly.',
};

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  return value.toFixed(1);
}

export const ConnectGscModal: React.FC<ConnectGscModalProps> = ({
  isOpen,
  onClose,
  onConnectedChange,
  isConnected,
  selectedProperty,
}) => {
  const [oauthConfigured, setOauthConfigured] = useState(true);
  const [redirectUri, setRedirectUri] = useState('http://localhost:3000/api/connections/google/callback');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [properties, setProperties] = useState<GscProperty[]>([]);
  const [pendingProperty, setPendingProperty] = useState<string>('');
  const [analytics, setAnalytics] = useState<GscAnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async (siteUrl: string) => {
    setLoadingAnalytics(true);
    setError(null);
    try {
      const response = await axios.get<GscAnalyticsResult>('/api/connections/google/analytics', {
        params: { siteUrl },
      });
      setAnalytics(response.data);
      onConnectedChange({
        connected: true,
        selectedProperty: siteUrl,
        analytics: response.data,
      });
    } catch (err: any) {
      setAnalytics(null);
      setError(err.response?.data?.error || 'Could not load Search Console performance data.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadProperties = async (currentProperty: string | null) => {
    setLoadingProperties(true);
    setError(null);
    try {
      const response = await axios.get<{ properties: GscProperty[] }>('/api/connections/google/properties');
      const list = response.data.properties || [];
      setProperties(list);
      const initial = currentProperty && list.some((item) => item.siteUrl === currentProperty)
        ? currentProperty
        : list[0]?.siteUrl || '';
      setPendingProperty(initial);
      if (!list.length) {
        onConnectedChange({ connected: true, selectedProperty: null, analytics: null });
      }
    } catch (err: any) {
      setProperties([]);
      setError(err.response?.data?.error || 'Could not load Search Console properties.');
    } finally {
      setLoadingProperties(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const params = new URLSearchParams(window.location.search);
    const gscError = params.get('gsc_error');
    if (gscError) {
      setError(ERROR_COPY[gscError] || 'Google authorization failed.');
    }

    let cancelled = false;
    const hydrate = async () => {
      setLoadingStatus(true);
      try {
        const statusRes = await axios.get('/api/connections/google/status');
        if (cancelled) return;
        setOauthConfigured(Boolean(statusRes.data.oauthConfigured));
        if (statusRes.data.redirectUri) setRedirectUri(statusRes.data.redirectUri);
        if (statusRes.data.connected) {
          await loadProperties(statusRes.data.selectedProperty || selectedProperty);
          const property = statusRes.data.selectedProperty || selectedProperty;
          if (property) {
            setPendingProperty(property);
            await loadAnalytics(property);
          }
        } else {
          setProperties([]);
          setAnalytics(null);
        }
      } catch {
        if (!cancelled) setError('Could not read Search Console connection status.');
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = () => {
    window.location.href = '/api/connections/google';
  };

  const handleSelectProperty = async () => {
    if (!pendingProperty) return;
    setLoadingAnalytics(true);
    setError(null);
    try {
      await axios.post('/api/connections/google/property', { siteUrl: pendingProperty });
      await loadAnalytics(pendingProperty);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save the selected property.');
      setLoadingAnalytics(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await axios.post('/api/connections/google/disconnect');
      setProperties([]);
      setAnalytics(null);
      setPendingProperty('');
      onConnectedChange({ connected: false, selectedProperty: null, analytics: null });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not disconnect Search Console.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#121A21] text-white p-6 relative shrink-0">
          <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search Console Integration</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Connect Google Search Console</h2>
          <p className="text-xs text-gray-300 mt-1">
            Authorize read-only access, choose the property for this business website, then load live clicks, impressions, CTR, and average position.
          </p>
        </div>

        <div className="p-6 space-y-4 text-xs text-gray-700 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
            <div className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>OAuth 2.0 read-only scope</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              This app requests{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded text-[11px] font-mono">
                https://www.googleapis.com/auth/webmasters.readonly
              </code>
              . Tokens stay on the server and are never sent to the browser.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <div className="font-semibold text-gray-900 mb-1">Redirect URI to register in Google Cloud</div>
            <code className="block text-[11px] font-mono break-all text-gray-800">{redirectUri}</code>
          </div>

          {loadingStatus ? (
            <div className="py-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Checking connection status…
            </div>
          ) : !isConnected ? (
            <div className="space-y-3">
              {!oauthConfigured && (
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing from the server environment.
                </p>
              )}
              <button
                onClick={handleConnect}
                disabled={!oauthConfigured}
                className="w-full px-4 py-2.5 rounded-lg bg-[#176B72] hover:bg-[#125359] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <span>Connect Google Search Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Google account connected
                </span>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>

              {loadingProperties ? (
                <div className="py-6 text-center text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading Search Console properties…
                </div>
              ) : properties.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-gray-300 text-gray-500 text-center">
                  No Search Console properties were found for this Google account. Add and verify the business website in Google Search Console, then reconnect.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block font-bold text-gray-800">Select the property for this business website</label>
                  <select
                    value={pendingProperty}
                    onChange={(e) => setPendingProperty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white"
                  >
                    {properties.map((property) => (
                      <option key={property.siteUrl} value={property.siteUrl}>
                        {property.siteUrl} ({property.permissionLevel})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSelectProperty}
                    disabled={!pendingProperty || loadingAnalytics}
                    className="w-full px-4 py-2 rounded-lg bg-[#C84A22] hover:bg-[#B33E1A] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loadingAnalytics ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Loading performance data…
                      </>
                    ) : (
                      <>Load Search Console performance</>
                    )}
                  </button>
                </div>
              )}

              {analytics && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <BarChart2 className="w-4 h-4" />
                    <span>Live Search Console data</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {analytics.siteUrl} · {analytics.startDate} to {analytics.endDate}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Clicks</div>
                      <div className="text-sm font-bold text-gray-900">{analytics.clicks.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Impressions</div>
                      <div className="text-sm font-bold text-gray-900">{analytics.impressions.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">CTR</div>
                      <div className="text-sm font-bold text-gray-900">{formatPercent(analytics.ctr)}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Avg. position</div>
                      <div className="text-sm font-bold text-gray-900">{formatPosition(analytics.averagePosition)}</div>
                    </div>
                  </div>
                  {analytics.queries.length === 0 ? (
                    <p className="text-gray-500">
                      Google returned no query rows for this date range. The property is connected; performance totals above are live.
                    </p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {analytics.queries.slice(0, 8).map((row) => (
                        <div key={row.query} className="flex justify-between gap-2 text-[11px]">
                          <span className="truncate">{row.query}</span>
                          <span className="shrink-0 font-mono text-gray-800">
                            {row.clicks} clk · {row.impressions} imp
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
