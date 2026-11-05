'use client';

import React from 'react';
import {
  AuditResponse,
  WebsiteAuditData,
} from '@/lib/types';
import {
  Globe,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Layers,
  Phone,
  MapPin,
  Building,
  Image as ImageIcon,
  ExternalLink,
  ArrowLeft,
  Clock,
  Sparkles,
  Link as LinkIcon,
  Search,
} from 'lucide-react';

interface WebsiteSeoViewProps {
  data: AuditResponse;
  onBackToDashboard?: () => void;
}

export const WebsiteSeoView: React.FC<WebsiteSeoViewProps> = ({
  data,
  onBackToDashboard,
}) => {
  const { business, websiteAudit } = data;

  if (!websiteAudit || !websiteAudit.url) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Globe className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-gray-900">No Website Crawl Data Available</h3>
        <p className="text-xs text-gray-500 mt-2">
          Please run an audit with a valid website URL to inspect on-page SEO, NAP parity, heading structure, and Schema markup.
        </p>
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#C84A22] text-white text-xs font-semibold rounded-lg hover:bg-[#B33E1A] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        )}
      </div>
    );
  }

  const titleLength = websiteAudit.title?.length || 0;
  const isTitleIdeal = titleLength >= 30 && titleLength <= 65;
  const metaDescLength = websiteAudit.metaDescription?.length || 0;
  const isMetaIdeal = metaDescLength >= 120 && metaDescLength <= 165;
  const h1Count = websiteAudit.h1Headings?.length || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">
            <Globe className="w-4 h-4" />
            <span>On-Page SEO &amp; NAP Parity Audit</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{business.name} Website Inspection</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <a
              href={websiteAudit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 font-medium hover:underline flex items-center gap-1"
            >
              {websiteAudit.url}
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>·</span>
            <span>Status: {websiteAudit.statusCode || 200} OK</span>
            {websiteAudit.loadTimeMs && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {websiteAudit.loadTimeMs}ms response
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {websiteAudit.isHttps ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Secure SSL (HTTPS)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Insecure HTTP
            </span>
          )}

          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* 1. NAP Consistency Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Building className="w-5 h-5 text-orange-600" />
          <span>NAP (Name, Address, Phone) Parity Cross-Check</span>
        </h3>
        <p className="text-xs text-gray-500 -mt-2 mb-4 leading-relaxed">
          Google checks consistency between your Google Maps Business Profile and your website text to establish domain authority and local search pack rankings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name Check */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-gray-400" />
                Business Name
              </span>
              {websiteAudit.napConsistency?.nameFound !== false ? (
                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Matches
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-800 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Verify
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-gray-900 truncate">{business.name}</div>
            <div className="text-[11px] text-gray-500 mt-1">Profile Name vs On-Site Brand</div>
          </div>

          {/* Phone Check */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-gray-400" />
                Telephone Match
              </span>
              {websiteAudit.hasPhoneMatch ? (
                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Matches
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-800 font-semibold flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-600" /> Not Detected
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-gray-900 truncate">
              {business.phone || 'No phone listed on profile'}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              {websiteAudit.hasPhoneMatch
                ? 'Phone numbers align across website & profile.'
                : 'Phone number was not detected in homepage text.'}
            </div>
          </div>

          {/* Address / City Check */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-400" />
                City / Region
              </span>
              {websiteAudit.hasAddressMatch ? (
                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Matches
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-800 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Verify
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-gray-900 truncate">
              {business.city || business.address || 'Local Area'}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              {websiteAudit.hasAddressMatch
                ? 'City / Region prominently detected on site.'
                : 'City was not explicitly identified in crawled text.'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metadata & Technical Directives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Title & Description */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Title Tag &amp; Meta Description</span>
          </h3>

          {/* Title */}
          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-gray-700">HTML Title</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  isTitleIdeal
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {titleLength} characters {isTitleIdeal ? '(Ideal)' : '(Optimal: 30-65)'}
              </span>
            </div>
            <div className="text-xs font-medium text-gray-900 leading-relaxed">
              {websiteAudit.title || <span className="text-red-500 font-bold">Missing Title Tag</span>}
            </div>
          </div>

          {/* Meta Description */}
          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-gray-700">Meta Description</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  isMetaIdeal
                    ? 'bg-emerald-100 text-emerald-800'
                    : metaDescLength === 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {metaDescLength} characters {metaDescLength === 0 ? '(Missing)' : isMetaIdeal ? '(Ideal)' : '(Optimal: 120-165)'}
              </span>
            </div>
            <div className="text-xs text-gray-700 leading-relaxed">
              {websiteAudit.metaDescription || (
                <span className="text-red-500 font-semibold">
                  Missing Meta Description. Search engines will generate snippets automatically.
                </span>
              )}
            </div>
          </div>

          {/* Canonical & Robots */}
          <div className="pt-2 border-t border-gray-100 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Canonical Tag:</span>
              <span className="text-gray-900 font-mono text-[11px] truncate max-w-xs">
                {websiteAudit.canonicalUrl || 'Self-referencing / Not specified'}
              </span>
            </div>
            {websiteAudit.robotsDirectives && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Robots Directives:</span>
                <span className="text-gray-900 font-mono text-[11px]">
                  {websiteAudit.robotsDirectives}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Schema.org & Headings Structure */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" />
            <span>Structured Data &amp; Headings</span>
          </h3>

          {/* Schema Section */}
          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-gray-700">Schema.org JSON-LD</span>
              {websiteAudit.hasLocalBusinessSchema ? (
                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> LocalBusiness Detected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-800 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-600" /> Missing LocalBusiness
                </span>
              )}
            </div>
            {websiteAudit.schemasFound && websiteAudit.schemasFound.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {websiteAudit.schemasFound.map((type, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] font-semibold border border-purple-200"
                  >
                    @{type}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                No JSON-LD structured data detected. Implementing LocalBusiness schema helps Google correlate your profile with search results.
              </p>
            )}
          </div>

          {/* Heading Structure */}
          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-gray-700">Headings Structure</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  h1Count === 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : h1Count === 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {h1Count} H1 {h1Count === 1 ? '(Optimal)' : h1Count === 0 ? '(Missing)' : '(Multiple H1s)'}
              </span>
            </div>

            {websiteAudit.h1Headings && websiteAudit.h1Headings.length > 0 && (
              <div className="space-y-1 mb-2">
                {websiteAudit.h1Headings.map((h1, i) => (
                  <div key={i} className="text-xs font-bold text-gray-900 truncate">
                    H1: &quot;{h1}&quot;
                  </div>
                ))}
              </div>
            )}

            {websiteAudit.h2Headings && websiteAudit.h2Headings.length > 0 && (
              <div className="text-[11px] text-gray-500">
                <span className="font-semibold text-gray-700">{websiteAudit.h2Headings.length} H2 tags: </span>
                {websiteAudit.h2Headings.slice(0, 3).join(', ')}...
              </div>
            )}
          </div>

          {/* Images Alt Text */}
          {websiteAudit.images && (
            <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <span className="font-semibold text-gray-700">Homepage Images:</span>
                <span className="text-gray-600">{websiteAudit.images.total} total</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className="text-emerald-700">{websiteAudit.images.withAlt} with alt</span>
                <span>·</span>
                <span className={websiteAudit.images.missingAlt > 0 ? 'text-amber-700' : 'text-gray-500'}>
                  {websiteAudit.images.missingAlt} missing alt
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Discovered Key Subpages & Services */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
          <LinkIcon className="w-5 h-5 text-emerald-600" />
          <span>Internal Key Pages &amp; Discovered Services</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subpages Crawled */}
          <div>
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Crawled Subpages ({websiteAudit.subpagesCrawled?.length || 0})
            </div>
            {websiteAudit.subpagesCrawled && websiteAudit.subpagesCrawled.length > 0 ? (
              <div className="space-y-1.5">
                {websiteAudit.subpagesCrawled.map((sub, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                        {sub.type}
                      </span>
                      <span className="truncate text-gray-800">{sub.title || sub.url}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono shrink-0 ml-2">
                      {sub.statusCode || 'OK'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
                No subpage links followed or single-page application.
              </div>
            )}
          </div>

          {/* Detected Services */}
          <div>
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Services Detected On-Site ({websiteAudit.servicesMentioned?.length || 0})
            </div>
            {websiteAudit.servicesMentioned && websiteAudit.servicesMentioned.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {websiteAudit.servicesMentioned.map((svc, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-800 text-xs font-semibold border border-orange-200"
                  >
                    {svc}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
                No distinct service catalog list detected on homepage.
              </div>
            )}

            {websiteAudit.appointmentUrl && (
              <div className="mt-4 p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs flex items-center justify-between">
                <span className="font-semibold text-blue-900">Booking / Appointment URL:</span>
                <a
                  href={websiteAudit.appointmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 font-semibold hover:underline flex items-center gap-1 truncate max-w-xs"
                >
                  {websiteAudit.appointmentUrl}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

