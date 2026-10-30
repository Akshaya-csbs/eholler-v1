export interface BusinessInput {
  businessName?: string;
  city?: string;
  mapUrl: string;
  websiteUrl?: string;
}

export interface GooglePlaceData {
  id: string;
  displayName: string;
  formattedAddress: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: string;
  types?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
  openingHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | string;
  photosCount?: number;
  editorialSummary?: string;
  accessibilityOptions?: Record<string, boolean>;
  paymentOptions?: Record<string, boolean>;
  parkingOptions?: Record<string, boolean>;
}

export interface WebsiteAuditData {
  url: string;
  isHttps: boolean;
  statusCode?: number;
  title?: string;
  metaDescription?: string;
  hasPhoneMatch: boolean;
  hasAddressMatch: boolean;
  hasLocalBusinessSchema: boolean;
  loadTimeMs?: number;
  headings?: string[];
  paragraphs?: string[];
  servicesMentioned?: string[];
  productsMentioned?: string[];
  appointmentUrl?: string;
  contactEmails?: string[];
  aboutSnippet?: string;
}

export type GbpFieldStatus =
  | 'NO CHANGES REQUIRED'
  | 'MISSING'
  | 'NEEDS IMPROVEMENT'
  | 'UNABLE TO VERIFY';

export interface GbpAuditedField {
  field_id: string;
  field_name: string;
  category:
    | 'basic_info'
    | 'location_area'
    | 'hours'
    | 'services'
    | 'products'
    | 'attributes'
    | 'contact'
    | 'photos'
    | 'other';
  section_title: string;
  current_value: string;
  expected_value_or_requirement: string;
  status: GbpFieldStatus;
  issue_description?: string;
  why_it_matters?: string;
  recommendation?: string;
  recommended_content?: string;
  evidence_source: string;
  confidence: 'High' | 'Medium' | 'Low';
  applicable: boolean;
  verifiable: boolean;
}

export interface BusinessUnderstanding {
  summary: string;
  industryAndNiche: string;
  primaryCategory: string;
  secondaryCategories: string[];
  mainServices: string[];
  secondaryServices: string[];
  detectedProducts: string[];
  physicalLocation: string;
  serviceAreas: string[];
  targetCustomers: string;
  uniqueSellingPoints: string[];
  operatingHoursSummary: string;
  contactSummary: string;
  relevantSearchKeywords: string[];
  crossCheckNotes: string[];
}

export interface GbpCompleteAuditResult {
  business: {
    name: string;
    category: string;
    location: string;
    websiteUrl: string;
    mapUrl: string;
    placeId: string;
    lastAuditedAt: string;
  };
  understanding: BusinessUnderstanding;
  completenessScore: number;
  totalAuditedFields: number;
  noChangesRequiredCount: number;
  missingCount: number;
  needsImprovementCount: number;
  unableToVerifyCount: number;
  fields: GbpAuditedField[];
  recommendedContentBySection: {
    sectionKey: string;
    sectionTitle: string;
    items: Array<{
      field_id: string;
      field_name: string;
      status: 'MISSING' | 'NEEDS IMPROVEMENT';
      current_value: string;
      recommended_content: string;
      why_it_matters: string;
      action: string;
    }>;
  }[];
}

export interface CompetitorItem {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  address?: string;
  isDominant?: boolean;
}

export interface AuditFinding {
  id: string;
  title: string;
  field: string;
  status: 'missing' | 'inconsistent' | 'optimized' | 'needs_improvement';
  score: number; // 0 to 100
  severity: 'high' | 'medium' | 'low';
  currentValue: string;
  recommendedValue: string;
  explanation: string;
}

export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscAnalyticsResult {
  siteUrl: string;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  rowCount: number;
  queries: GscQueryRow[];
}

export interface SearchConsoleMetrics {
  connected: boolean;
  selectedProperty: string | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  averagePosition: number | null;
  dateRange: { startDate: string; endDate: string } | null;
  organicTraffic: number;
  organicKeywordsCount: number;
  mapsVisibilityPercent: number;
  top10KeywordsCount: number;
  trafficTrend: number[];
  keywords: GscQueryRow[];
}

export interface AuditResponse {
  business: {
    name: string;
    city: string;
    address: string;
    category: string;
    phone: string;
    websiteUrl: string;
    mapUrl: string;
    placeId: string;
    rating: number;
    reviewCount: number;
    updatedAt: string;
  };
  scores: {
    authorityScore: number;
    mapsRank: number;
    gbpHealth: number;
    gbpHealthChange: number;
    citationHealth: number;
    gbpOptimization: number;
    citationFixes: number;
    reviewGrowth: number;
    keywordRankings: number;
  };
  searchConsole: SearchConsoleMetrics;
  priorityActions: AuditFinding[];
  aiRecommendations: string[];
  optimizedDescriptionDraft: string;
  competitors: CompetitorItem[];
  missingFields: string[];
  inconsistentFields: string[];
  whatNeedsToBeAdded: string[];
  structuredRecommendations?: StructuredRecommendation[];
  gbpCompleteAudit?: GbpCompleteAuditResult;
}

export interface StructuredRecommendation {
  issueTitle: string;
  category:
    | 'missing_seo_field'
    | 'inconsistent_info'
    | 'incomplete_description'
    | 'missing_meta'
    | 'content_optimization'
    | 'search_console'
    | 'local_seo_priority';
  evidence: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
  recommendedAction: string;
  suggestedContent?: string;
  estimatedEffort: 'quick_win' | 'moderate' | 'significant';
}

export interface AIRecommendationRequest {
  auditFindings: AuditFinding[];
  business: {
    name: string;
    city: string;
    address: string;
    category: string;
    phone: string;
    websiteUrl: string;
    rating: number;
    reviewCount: number;
  };
  websiteAudit?: WebsiteAuditData;
  competitors?: CompetitorItem[];
  searchConsole?: SearchConsoleMetrics;
  missingFields?: string[];
  inconsistentFields?: string[];
}

export interface AIRecommendationResponse {
  recommendations: StructuredRecommendation[];
  descriptionDraft: string;
  generatedAt: string;
  modelUsed: string;
}
