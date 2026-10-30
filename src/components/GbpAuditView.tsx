'use client';

import React, { useState, useMemo } from 'react';
import {
  GbpCompleteAuditResult,
  GbpAuditedField,
  GbpFieldStatus,
  BusinessUnderstanding,
} from '@/lib/types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  ShieldCheck,
  Search,
  Building,
  MapPin,
  Globe,
  Clock,
  Briefcase,
  Package,
  Sliders,
  Phone,
  Image as ImageIcon,
  Layers,
  ArrowLeft,
  ChevronRight,
  FileText,
  BadgeCheck,
} from 'lucide-react';

interface GbpAuditViewProps {
  auditResult?: GbpCompleteAuditResult;
  onBackToDashboard?: () => void;
}

const SECTION_ICONS: Record<string, React.ElementType> = {
  basic_info: Building,
  location_area: MapPin,
  hours: Clock,
  services: Briefcase,
  products: Package,
  attributes: Sliders,
  contact: Phone,
  photos: ImageIcon,
  other: Layers,
};

export const GbpAuditView: React.FC<GbpAuditViewProps> = ({
  auditResult,
  onBackToDashboard,
}) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showUnderstanding, setShowUnderstanding] = useState<boolean>(true);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  if (!auditResult) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Sparkles className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-gray-900">No Google Business Profile Audit Data</h3>
        <p className="text-xs text-gray-500 mt-2">
          Please run an audit with a valid Google Maps URL or business query from the dashboard above to view the complete field-by-field audit.
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

  const {
    business,
    understanding,
    completenessScore,
    totalAuditedFields,
    noChangesRequiredCount,
    missingCount,
    needsImprovementCount,
    unableToVerifyCount,
    fields,
    recommendedContentBySection,
  } = auditResult;

  // Toggle Section Accordion
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const expandAll = () => setCollapsedSections({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    const categories = Array.from(new Set(fields.map(f => f.category)));
    categories.forEach(c => (allCollapsed[c] = true));
    setCollapsedSections(allCollapsed);
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedFieldId(id);
    setTimeout(() => setCopiedFieldId(null), 2200);
  };

  // Copy All Recommended Content
  const handleCopyAll = () => {
    const sectionsWithItems = recommendedContentBySection || [];
    let formattedText = `========================================================\n`;
    formattedText += `AI-RECOMMENDED GOOGLE BUSINESS PROFILE CONTENT\n`;
    formattedText += `Business: ${business.name}\n`;
    formattedText += `Category: ${business.category}\n`;
    formattedText += `Date: ${business.lastAuditedAt}\n`;
    formattedText += `========================================================\n\n`;

    sectionsWithItems.forEach(section => {
      formattedText += `--------------------------------------------------------\n`;
      formattedText += `SECTION: ${section.sectionTitle.toUpperCase()}\n`;
      formattedText += `--------------------------------------------------------\n\n`;

      section.items.forEach((item, idx) => {
        formattedText += `[${idx + 1}] ${item.field_name} (${item.status})\n`;
        formattedText += `Current: ${item.current_value || 'None'}\n`;
        formattedText += `Action: ${item.action}\n`;
        formattedText += `Recommended Content:\n${item.recommended_content}\n\n`;
      });
    });

    formattedText += `--------------------------------------------------------\n`;
    formattedText += `Note: Apply these changes manually in Google Business Profile (business.google.com).\n`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(formattedText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  // Filter fields
  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      const matchesStatus =
        selectedStatusFilter === 'ALL' || field.status === selectedStatusFilter;
      const matchesQuery =
        !searchQuery.trim() ||
        field.field_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.current_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (field.issue_description || field.expected_value_or_requirement || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (field.recommended_content &&
          field.recommended_content.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesQuery;
    });
  }, [fields, selectedStatusFilter, searchQuery]);

  // Group filtered fields by category preserving 9 logical sections order
  const sectionOrder = [
    'basic_info',
    'location_area',
    'hours',
    'services',
    'products',
    'attributes',
    'contact',
    'photos',
    'other',
  ];

  const groupedFields = useMemo(() => {
    const map = new Map<string, { title: string; category: string; fields: GbpAuditedField[] }>();
    sectionOrder.forEach(key => {
      const match = fields.find(f => f.category === key);
      const title = match?.section_title || key;
      map.set(key, { title, category: key, fields: [] });
    });

    filteredFields.forEach(field => {
      if (map.has(field.category)) {
        map.get(field.category)!.fields.push(field);
      }
    });

    return Array.from(map.values()).filter(g => g.fields.length > 0);
  }, [filteredFields, fields]);

  // Helper status color styling
  const getStatusBadge = (status: GbpFieldStatus) => {
    switch (status) {
      case 'NO CHANGES REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>No changes required</span>
          </span>
        );
      case 'NEEDS IMPROVEMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Needs improvement</span>
          </span>
        );
      case 'MISSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Missing</span>
          </span>
        );
      case 'UNABLE TO VERIFY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Unable to verify</span>
          </span>
        );
      default:
        return null;
    }
  };

  const totalVerifiable = noChangesRequiredCount + needsImprovementCount + missingCount;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Top Header Banner with Business Overview */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {onBackToDashboard && (
                <button
                  onClick={onBackToDashboard}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-semibold mr-2 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold tracking-wider uppercase">
                <Sparkles className="w-3 h-3 text-orange-600" />
                <span>AI-Powered GBP Audit</span>
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">Audited {business.lastAuditedAt}</span>
            </div>

            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>{business.name}</span>
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2 text-xs text-gray-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                <span>{business.category}</span>
              </span>
              <span className="flex items-center gap-1.5 text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="max-w-md truncate">{business.location}</span>
              </span>
              {business.websiteUrl && (
                <a
                  href={business.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Visit Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {business.mapUrl && (
                <a
                  href={business.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-600 hover:underline font-medium"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>View on Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Action Button to jump to AI Content */}
          <div className="flex items-center gap-3">
            <a
              href="#ai-recommended-content"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C84A22] hover:bg-[#B33E1A] text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Jump to Ready-to-Use Content</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics & Completeness Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Completeness Score Card */}
        <div className="bg-gradient-to-br from-[#121A21] to-[#1E2B37] text-white rounded-2xl p-5 shadow-sm border border-[#2A3C4D] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
              Completeness Score
            </span>
            <ShieldCheck className="w-4 h-4 text-orange-400" />
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{completenessScore}%</span>
              <span className="text-xs text-gray-400">overall</span>
            </div>
            <div className="w-full bg-[#2A3C4D] h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  completenessScore >= 80
                    ? 'bg-emerald-400'
                    : completenessScore >= 50
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${Math.max(5, completenessScore)}%` }}
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-300 leading-tight">
            Based on <strong className="text-white">{noChangesRequiredCount}</strong> complete out of{' '}
            <strong className="text-white">{totalVerifiable}</strong> verifiable fields.
          </p>
        </div>

        {/* Status Breakdown Card 1: No Changes Required */}
        <button
          onClick={() => setSelectedStatusFilter('NO CHANGES REQUIRED')}
          className={`text-left bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm ${
            selectedStatusFilter === 'NO CHANGES REQUIRED'
              ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20'
              : 'border-gray-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>NO CHANGES REQUIRED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-2">
            {noChangesRequiredCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {Math.round((noChangesRequiredCount / totalAuditedFields) * 100)}% of total fields
          </div>
        </button>

        {/* Status Breakdown Card 2: Needs Improvement */}
        <button
          onClick={() => setSelectedStatusFilter('NEEDS IMPROVEMENT')}
          className={`text-left bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm ${
            selectedStatusFilter === 'NEEDS IMPROVEMENT'
              ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50/20'
              : 'border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>NEEDS IMPROVEMENT</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-700 mt-2">
            {needsImprovementCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Incomplete or weak data
          </div>
        </button>

        {/* Status Breakdown Card 3: Missing */}
        <button
          onClick={() => setSelectedStatusFilter('MISSING')}
          className={`text-left bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm ${
            selectedStatusFilter === 'MISSING'
              ? 'border-rose-500 ring-2 ring-rose-100 bg-rose-50/20'
              : 'border-gray-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-700">
            <span>MISSING</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-700 mt-2">
            {missingCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            High priority additions
          </div>
        </button>

        {/* Status Breakdown Card 4: Unable to Verify */}
        <button
          onClick={() => setSelectedStatusFilter('UNABLE TO VERIFY')}
          className={`text-left bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm ${
            selectedStatusFilter === 'UNABLE TO VERIFY'
              ? 'border-slate-500 ring-2 ring-slate-100 bg-slate-50'
              : 'border-gray-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>UNABLE TO VERIFY</span>
            <HelpCircle className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-3xl font-black text-slate-700 mt-2">
            {unableToVerifyCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Private/limited API data
          </div>
        </button>
      </div>

      {/* Completeness Score Notice */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Independent Completeness Score Notice:</span>{' '}
          This score reflects profile completeness across all applicable and verifiable Google Business Profile fields.
          Fields marked as <span className="font-semibold text-slate-800">Unable to Verify</span> (due to private merchant center or restricted Google APIs) are excluded from the score denominator so the business is not unfairly penalized. This is an independent Local SEO metric and not an official Google ranking score.
        </div>
      </div>

      {/* 3. Synthesized AI Business Understanding Collapsible */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowUnderstanding(!showUnderstanding)}
          className="w-full p-5 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between border-b border-gray-200 hover:bg-gray-100/60 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900">
                AI Business Understanding &amp; Cross-Check Evidence
              </div>
              <div className="text-xs text-gray-500">
                Synthesized from authorized GBP data, website content, schema, and Google Maps listing.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <span>{showUnderstanding ? 'Hide Details' : 'View Synthesized Profile'}</span>
            {showUnderstanding ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showUnderstanding && (
          <div className="p-6 space-y-5 bg-white text-xs">
            {/* Core overview grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  What The Business Does
                </div>
                <p className="text-gray-800 leading-relaxed">{understanding.summary}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Target Customers
                </div>
                <p className="text-gray-800 leading-relaxed">{understanding.targetCustomers}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Niche &amp; Category
                </div>
                <p className="text-gray-800 leading-relaxed">
                  <strong>Primary:</strong> {understanding.primaryCategory}
                  <br />
                  <strong>Industry &amp; Niche:</strong> {understanding.industryAndNiche}
                </p>
              </div>
            </div>

            {/* Services Discovered */}
            <div className="p-4 rounded-xl bg-orange-50/40 border border-orange-200">
              <div className="font-bold text-orange-900 mb-2 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-orange-600" />
                <span>Services Discovered from Website &amp; Category</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {understanding.mainServices.map((service, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-white border border-orange-200 text-orange-950 font-medium"
                  >
                    ★ {service}
                  </span>
                ))}
                {understanding.secondaryServices.map((service, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-white/80 border border-gray-200 text-gray-700"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>

            {/* USPs & Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Unique Selling Points (USPs)
                </div>
                <ul className="space-y-1 text-gray-700 list-disc list-inside">
                  {understanding.uniqueSellingPoints.map((usp, idx) => (
                    <li key={idx}>{usp}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
                  Relevant Search Keywords
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {understanding.relevantSearchKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-gray-200/80 text-gray-800 text-[11px]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cross-check notes */}
            {understanding.crossCheckNotes && understanding.crossCheckNotes.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  <span>Website &amp; Profile Cross-Check Findings</span>
                </div>
                <ul className="space-y-1 text-emerald-950 list-disc list-inside">
                  {understanding.crossCheckNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Controls: Filter tabs, Search query, Accordion controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { key: 'ALL', label: `All (${fields.length})` },
            { key: 'MISSING', label: `Missing (${missingCount})` },
            { key: 'NEEDS IMPROVEMENT', label: `Needs Improvement (${needsImprovementCount})` },
            { key: 'NO CHANGES REQUIRED', label: `No Changes (${noChangesRequiredCount})` },
            { key: 'UNABLE TO VERIFY', label: `Unable to Verify (${unableToVerifyCount})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedStatusFilter === tab.key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Accordion Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search profile field..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            onClick={expandAll}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition shrink-0"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition shrink-0"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* 5. Field-by-Field Audit Sections A through I */}
      <div className="space-y-4">
        {groupedFields.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500 text-xs">
            No fields match your search or filter criteria.
          </div>
        ) : (
          groupedFields.map(group => {
            const isCollapsed = Boolean(collapsedSections[group.category]);
            const SectionIcon = SECTION_ICONS[group.category] || Layers;

            // Stats in this section
            const sectionMissing = group.fields.filter(f => f.status === 'MISSING').length;
            const sectionNeeds = group.fields.filter(f => f.status === 'NEEDS IMPROVEMENT').length;
            const sectionOk = group.fields.filter(f => f.status === 'NO CHANGES REQUIRED').length;
            const sectionUnverified = group.fields.filter(f => f.status === 'UNABLE TO VERIFY').length;

            return (
              <div
                key={group.category}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Section Header Button */}
                <button
                  onClick={() => toggleSection(group.category)}
                  className="w-full px-6 py-4 bg-gray-50/70 hover:bg-gray-100/60 border-b border-gray-200 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                      <SectionIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>{group.title}</span>
                        <span className="text-xs font-semibold text-gray-500">
                          ({group.fields.length} {group.fields.length === 1 ? 'field' : 'fields'})
                        </span>
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                        {sectionMissing > 0 && (
                          <span className="text-rose-600 font-semibold">{sectionMissing} Missing</span>
                        )}
                        {sectionNeeds > 0 && (
                          <span className="text-amber-600 font-semibold">{sectionNeeds} Needs Improvement</span>
                        )}
                        {sectionOk > 0 && (
                          <span className="text-emerald-600 font-semibold">{sectionOk} Complete</span>
                        )}
                        {sectionUnverified > 0 && (
                          <span className="text-slate-500 font-medium">{sectionUnverified} Unverified</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400">
                    {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </div>
                </button>

                {/* Section Fields Table / Content */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {group.fields.map(field => {
                      const hasRecommendation =
                        (field.status === 'MISSING' || field.status === 'NEEDS IMPROVEMENT') &&
                        Boolean(field.recommended_content);

                      return (
                        <div key={field.field_id} className="p-5 hover:bg-gray-50/50 transition">
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                            <div className="flex-1 space-y-1.5">
                              {/* Field Name & Status Pill */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-gray-900">
                                  {field.field_name}
                                </span>
                                {getStatusBadge(field.status)}
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                  Confidence: {field.confidence}
                                </span>
                              </div>

                              {/* Current Value */}
                              <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 inline-block max-w-full">
                                <span className="font-semibold text-gray-500">Current Value: </span>
                                <span className="font-mono text-gray-800">
                                  {field.current_value || 'Not configured / Empty'}
                                </span>
                              </div>

                              {/* Explanation & Why it matters */}
                              <div className="text-xs text-gray-600 space-y-1 pt-1">
                                <p>
                                  <strong className="text-gray-700">Audit Finding: </strong>
                                  {field.issue_description || field.expected_value_or_requirement}
                                </p>
                                {field.why_it_matters && (
                                  <p className="text-gray-500">
                                    <strong className="text-gray-600">Why it matters: </strong>
                                    {field.why_it_matters}
                                  </p>
                                )}
                              </div>

                              {/* Evidence source */}
                              <div className="text-[11px] text-gray-400 pt-0.5">
                                <span>Evidence: {field.evidence_source}</span>
                              </div>
                            </div>

                            {/* Ready-to-use Recommendation Box (if missing or needs improvement) */}
                            {hasRecommendation && (
                              <div className="w-full lg:w-[420px] bg-orange-50/50 rounded-xl p-3.5 border border-orange-200 shrink-0 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-orange-900">
                                  <span className="flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                                    <span>AI Suggested Content</span>
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleCopy(field.recommended_content || '', field.field_id)
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-orange-100 border border-orange-200 text-orange-800 text-[11px] font-semibold transition"
                                  >
                                    {copiedFieldId === field.field_id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span className="text-emerald-700">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 text-orange-600" />
                                        <span>Copy Content</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {field.recommendation && (
                                  <p className="text-[11px] text-orange-950 font-medium">
                                    {field.recommendation}
                                  </p>
                                )}

                                <div className="bg-white p-2.5 rounded-lg border border-orange-200/80 text-xs font-mono text-gray-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                                  {field.recommended_content}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 6. DEDICATED BOTTOM SECTION: AI-RECOMMENDED GOOGLE BUSINESS PROFILE CONTENT */}
      <section
        id="ai-recommended-content"
        className="bg-white rounded-2xl border-2 border-orange-300 shadow-xl overflow-hidden mt-12"
      >
        {/* Banner Top */}
        <div className="bg-[#121A21] text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Copy-Ready Recommendations</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              AI-RECOMMENDED GOOGLE BUSINESS PROFILE CONTENT
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl">
              Ready-to-use, fully customized content generated for every field requiring attention.
              Copy individual fields or click the button on the right to copy the entire recommendation package.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={handleCopyAll}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#C84A22] hover:bg-[#B33E1A] text-white text-xs font-bold shadow-lg transition"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>All Content Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white" />
                  <span>Copy All Recommended Content</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recommendations Grouped by Section */}
        <div className="p-6 sm:p-8 space-y-8">
          {(!recommendedContentBySection || recommendedContentBySection.length === 0) ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-800 text-sm">
                No recommended content updates needed!
              </p>
              <p className="mt-1">
                All verifiable Google Business Profile fields are fully filled and optimized.
              </p>
            </div>
          ) : (
            recommendedContentBySection.map(section => (
              <div key={section.sectionKey} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    {section.sectionTitle}
                  </h3>
                  <span className="text-xs text-gray-400">
                    ({section.items.length} {section.items.length === 1 ? 'item' : 'items'})
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {section.items.map(item => (
                    <div
                      key={item.field_id}
                      className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-orange-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {item.field_name}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>

                        <button
                          onClick={() => handleCopy(item.recommended_content, item.field_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-orange-50 border border-gray-300 text-gray-700 text-xs font-semibold transition"
                        >
                          {copiedFieldId === item.field_id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-orange-600" />
                              <span>Copy Suggested Content</span>
                            </>
                          )}
                        </button>
                      </div>

                      {item.why_it_matters && (
                        <p className="text-xs text-gray-500 mb-2">
                          <strong className="text-gray-600">Why it matters: </strong>
                          {item.why_it_matters}
                        </p>
                      )}

                      <div className="text-xs text-gray-600 mb-2">
                        <strong className="text-gray-700">Action: </strong>
                        {item.action}
                      </div>

                      {/* Code Block for Copying */}
                      <div className="relative mt-2">
                        <pre className="bg-white p-3.5 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {item.recommended_content}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Explicit Google Publishing Disclaimer Notice */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Manual Review &amp; Publishing Notice:</span> Changes and
              recommendations generated above are provided for your review and are{' '}
              <strong>NOT automatically published to Google</strong>. To apply these recommendations,
              copy the suggested text using the buttons above and update your official profile in the{' '}
              <a
                href="https://business.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-black"
              >
                Google Business Profile Dashboard (business.google.com)
              </a>
              .
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
