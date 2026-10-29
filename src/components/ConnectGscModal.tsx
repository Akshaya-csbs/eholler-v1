import React, { useState } from 'react';
import { X, Search, ShieldCheck, Key, CheckCircle2, ArrowRight } from 'lucide-react';

interface ConnectGscModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  isConnected: boolean;
}

export const ConnectGscModal: React.FC<ConnectGscModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isConnected,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#121A21] text-white p-6 relative">
          <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search Console Integration</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Connect Google Search Console</h2>
          <p className="text-xs text-gray-300 mt-1">
            Authorize your Google account to stream real-time Organic Traffic (clicks), impressions, and tracked keyword positions directly onto your dashboard.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-gray-700">
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
            <div className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>OAuth 2.0 Scope Requirements</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              Google requires explicit read-only authorization for verified properties via scope:{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded text-[11px] font-mono">
                https://www.googleapis.com/auth/webmasters.readonly
              </code>
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 text-[10px]">
                1
              </div>
              <div>
                <span className="font-bold text-gray-900">Add OAuth Credentials in Google Cloud</span>
                <p className="text-gray-500 mt-0.5">
                  Set up your OAuth Client ID &amp; Secret in GCP credentials and whitelist your redirect URI.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 text-[10px]">
                2
              </div>
              <div>
                <span className="font-bold text-gray-900">Verify Website Property Ownership</span>
                <p className="text-gray-500 mt-0.5">
                  Ensure your Google account is an owner or full user on Search Console for the business website.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 text-[10px]">
                3
              </div>
              <div>
                <span className="font-bold text-gray-900">Continuous Sync</span>
                <p className="text-gray-500 mt-0.5">
                  The application refreshes search analytics queries, top ranking keywords, and daily impression trends.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {isConnected ? 'Status: Active Connection' : 'Status: Ready to link'}
            </span>
            <button
              onClick={() => {
                onConnect();
                onClose();
              }}
              className="px-4 py-2.5 rounded-lg bg-[#176B72] hover:bg-[#125359] text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition"
            >
              <span>{isConnected ? 'Sync Fresh Search Console Data' : 'Authorize & Connect Property'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
