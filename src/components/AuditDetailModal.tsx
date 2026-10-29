import React from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck, ExternalLink, ArrowRight } from 'lucide-react';
import { AuditResponse } from '@/lib/types';

interface AuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AuditResponse | null;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const { business, missingFields, inconsistentFields, whatNeedsToBeAdded, priorityActions, scores } = data;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#121A21] text-white p-6 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs uppercase font-semibold text-orange-400 tracking-wider">Audit Diagnostic</div>
            <h2 className="text-xl font-bold tracking-tight mt-0.5">Local SEO Field Cross-Verification</h2>
            <div className="text-xs text-gray-300 mt-1">
              Cross-verifying Google Business Profile against Website &amp; Local SERP signals.
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Summary Score Bar */}
          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <div className="text-xs text-gray-500 font-semibold">GBP Health Score</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{scores.gbpHealth}/100</div>
              <div className="text-[11px] text-amber-700 font-medium">Needs Attention</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold">Missing Fields</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{missingFields.length}</div>
              <div className="text-[11px] text-gray-500">Critical fields absent</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold">Inconsistent Fields</div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{inconsistentFields.length}</div>
              <div className="text-[11px] text-gray-500">Mismatched NAP / SSL</div>
            </div>
          </div>

          {/* 1. Missing Fields Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Missing Fields on Profile</span>
            </h3>
            {missingFields.length === 0 ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All core Google Business Profile fields are present.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {missingFields.map((field, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-red-50/70 border border-red-200 flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 mt-1.5" />
                    <div>
                      <div className="text-xs font-bold text-red-900">{field}</div>
                      <div className="text-xs text-red-700 mt-0.5">
                        This field is absent on Google Maps. Google prioritizes fully completed profiles in local 3-pack rankings.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Inconsistent Fields Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span>Inconsistent &amp; Discrepancy Findings</span>
            </h3>
            {inconsistentFields.length === 0 ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>No data inconsistencies between Google Maps and website.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {inconsistentFields.map((field, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-orange-600 shrink-0 mt-1.5" />
                    <div>
                      <div className="text-xs font-bold text-amber-950">{field}</div>
                      <div className="text-xs text-amber-800 mt-0.5">
                        Mismatch between Google Business Profile link ({business.websiteUrl}) and web security standards. Redirect HTTP to HTTPS.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Actionable Checklist */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>What Needs to Be Added (Action Checklist)</span>
            </h3>
            <div className="space-y-2">
              {whatNeedsToBeAdded.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer" />
                    <span className="text-xs text-gray-800 font-medium">{item}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Pending</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Detected Fields Cross-Verification Table */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Verified Business Profile Attributes</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left divide-y divide-gray-200">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Attribute</th>
                    <th className="px-4 py-2.5">Extracted Value from Google</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-900">Business Name</td>
                    <td className="px-4 py-2 text-gray-700">{business.name}</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">Verified</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-900">Address / City</td>
                    <td className="px-4 py-2 text-gray-700">{business.address}</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">Matched</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-900">Phone</td>
                    <td className="px-4 py-2 text-gray-700">{business.phone}</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">Matched</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-900">Website</td>
                    <td className="px-4 py-2 text-gray-700">{business.websiteUrl}</td>
                    <td className="px-4 py-2 text-orange-600 font-semibold">HTTP (Upgrade to HTTPS)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-900">Rating &amp; Reviews</td>
                    <td className="px-4 py-2 text-gray-700">{business.rating}★ ({business.reviewCount} reviews)</td>
                    <td className="px-4 py-2 text-gray-600">Review growth needed</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">Cross-verified via Google Places API &amp; Server Web Crawler</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] rounded-lg transition"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
