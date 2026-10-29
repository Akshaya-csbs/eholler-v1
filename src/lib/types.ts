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
  openingHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  photosCount?: number;
  editorialSummary?: string;
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

export interface SearchConsoleMetrics {
  connected: boolean;
  organicTraffic: number;
  organicKeywordsCount: number;
  mapsVisibilityPercent: number;
  top10KeywordsCount: number;
  trafficTrend: number[];
  keywords: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
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
}
