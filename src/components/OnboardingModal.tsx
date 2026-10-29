import React, { useState } from 'react';
import { MapPin, Globe, Building, Search, Sparkles, X, ArrowRight } from 'lucide-react';
import { BusinessInput } from '@/lib/types';

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
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapUrl.trim() && !businessName.trim()) return;
    onSubmit({
      businessName: businessName.trim(),
      city: city.trim(),
      mapUrl: mapUrl.trim(),
      websiteUrl: websiteUrl.trim(),
    });
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
            <span>Local SEO Audit Engine</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Connect &amp; Audit Any Business Profile</h2>
          <p className="text-xs text-gray-300 mt-1">
            Provide any Google Maps URL or Business details. Our backend will fetch live Google Places data, crawl the website, and cross-verify all Local SEO fields.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
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
              placeholder="e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/place/..."
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/20"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Paste any short link (maps.app.goo.gl), Google Maps place link, or Place ID.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-gray-400" />
              <span>Business Name (Optional if URL contains it)</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter exact business name if known"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>City or Region</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. New York, London, Chennai"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                <span>Website URL (Optional)</span>
              </label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Submit */}
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
              disabled={isLoading || (!mapUrl.trim() && !businessName.trim())}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-lg shadow-md flex items-center gap-2 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Running Audit...' : 'Start Local SEO Audit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
