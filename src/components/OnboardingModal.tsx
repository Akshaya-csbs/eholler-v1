'use client';

import React, { useState } from 'react';
import axios from 'axios';
import {
  MapPin,
  Globe,
  Building,
  Search,
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Star,
  Phone,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { BusinessInput, GooglePlaceData } from '@/lib/types';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: BusinessInput) => void;
  isLoading: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [mapUrl, setMapUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');

  // Resolution state
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GooglePlaceData[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<GooglePlaceData | null>(null);

  if (!isOpen) return null;

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolveError(null);

    const trimmedMap = mapUrl.trim();
    const trimmedName = businessName.trim();
    const trimmedWeb = websiteUrl.trim();

    if (!trimmedMap && !trimmedName) {
      setResolveError('Please enter a Google Maps URL, Place ID, or Business Name.');
      return;
    }

    if (!trimmedWeb) {
      setResolveError('Website URL is required to cross-verify NAP consistency and on-page SEO.');
      return;
    }

    setIsResolving(true);
    try {
      const res = await axios.post('/api/business/resolve', {
        mapUrl: trimmedMap,
        businessName: trimmedName,
        city: city.trim(),
        websiteUrl: trimmedWeb,
      });

      const list: GooglePlaceData[] = res.data.candidates || [];
      if (list.length === 0) {
        setResolveError('No matching business found. Please check the Maps URL or enter your exact business name.');
        return;
      }

      setCandidates(list);
      setSelectedCandidate(list[0]);
      setStep('confirm');
    } catch (err: any) {
      setResolveError(
        err.response?.data?.error || err.message || 'Failed to resolve business profile with Google Places.'
      );
    } finally {
      setIsResolving(false);
    }
  };

  const handleConfirmAndRun = () => {
    if (!selectedCandidate) return;

    onSubmit({
      businessName: selectedCandidate.displayName,
      city: city.trim() || undefined,
      mapUrl: mapUrl.trim() || `https://www.google.com/maps/place/?q=place_id:${selectedCandidate.id}`,
      websiteUrl: websiteUrl.trim() || selectedCandidate.websiteUri || undefined,
    });
  };

  const handleResetToInput = () => {
    setStep('input');
    setResolveError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#121A21] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{step === 'input' ? 'Step 1: Business Details' : 'Step 2: Confirm Identity'}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {step === 'input' ? 'Connect & Audit Business Profile' : 'Confirm Business Identity'}
          </h2>
          <p className="text-xs text-gray-300 mt-1">
            {step === 'input'
              ? 'Enter your Google Maps URL or Place ID and website URL. Our system will resolve live Google data.'
              : 'Verify the resolved Google Place profile below before starting the deep audit.'}
          </p>
        </div>

        {/* Error Notification */}
        {resolveError && (
          <div className="m-6 mb-0 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Resolution Issue</div>
              <div>{resolveError}</div>
            </div>
          </div>
        )}

        {/* Step 1: Input Form */}
        {step === 'input' && (
          <form onSubmit={handleResolve} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-orange-600" />
                <span>Google Maps URL or Place ID (Required)</span>
              </label>
              <input
                type="text"
                required
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="e.g. https://maps.app.goo.gl/... or Place ID (ChIJ...)"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/20"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Paste any short link (maps.app.goo.gl), Google Maps place link, or Place ID.
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
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Used for cross-verifying NAP consistency, SSL, and LocalBusiness schema.
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
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Exact business name"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>City or Region (Optional)</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. London, Chicago, Chennai"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResolving || (!mapUrl.trim() && !businessName.trim()) || !websiteUrl.trim()}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50"
              >
                {isResolving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Resolving with Google Places...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Confirmation Step */}
        {step === 'confirm' && (
          <div className="p-6 space-y-4">
            {candidates.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Multiple Places Matched ({candidates.length}). Choose Yours:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCandidate(c)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        selectedCandidate?.id === c.id
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
                        checked={selectedCandidate?.id === c.id}
                        onChange={() => setSelectedCandidate(c)}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCandidate && (
              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/30 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-800">
                      {selectedCandidate.primaryType || 'Local Business'}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">
                      {selectedCandidate.displayName}
                    </h3>
                  </div>
                  {selectedCandidate.rating > 0 && (
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded text-xs font-bold text-amber-900">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{selectedCandidate.rating}</span>
                      <span className="text-gray-400 font-normal">
                        ({selectedCandidate.userRatingCount})
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-orange-100">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span>{selectedCandidate.formattedAddress}</span>
                  </div>
                  {selectedCandidate.nationalPhoneNumber && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{selectedCandidate.nationalPhoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">Website: {websiteUrl}</span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 pt-1">
                  Place ID: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">{selectedCandidate.id}</code>
                </div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-between border-t border-gray-100">
              <button
                type="button"
                onClick={handleResetToInput}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Search</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmAndRun}
                disabled={isLoading}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Full Audit...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Run Analysis</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
