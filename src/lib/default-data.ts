import { AuditResponse, GooglePlaceData, WebsiteAuditData, GbpCompleteAuditResult } from './types';
import { buildBusinessUnderstanding, evaluateAllGbpFields } from './gbp-audit-engine';

const PENTAGON_PLACE: GooglePlaceData = {
  id: 'ChIJ_pentagon_sample_id',
  displayName: 'Pentagon Quality Management Consultants.',
  formattedAddress: 'Tambaram, Chennai, Tamil Nadu 600045, India',
  nationalPhoneNumber: '+91 98400 12345',
  websiteUri: 'http://pentagonqmc.com',
  rating: 4.8,
  userRatingCount: 28,
  primaryType: 'business_management_consultant',
  primaryTypeDisplayName: 'Business management consultant',
  regularOpeningHours: {
    openNow: true,
    periods: [
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } },
      { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 18, minute: 0 } },
      { open: { day: 3, hour: 9, minute: 0 }, close: { day: 3, hour: 18, minute: 0 } },
      { open: { day: 4, hour: 9, minute: 0 }, close: { day: 4, hour: 18, minute: 0 } },
      { open: { day: 5, hour: 9, minute: 0 }, close: { day: 5, hour: 18, minute: 0 } },
      { open: { day: 6, hour: 9, minute: 0 }, close: { day: 6, hour: 14, minute: 0 } },
    ],
    weekdayDescriptions: [
      'Monday: 9:00 AM – 6:00 PM',
      'Tuesday: 9:00 AM – 6:00 PM',
      'Wednesday: 9:00 AM – 6:00 PM',
      'Thursday: 9:00 AM – 6:00 PM',
      'Friday: 9:00 AM – 6:00 PM',
      'Saturday: 9:00 AM – 2:00 PM',
      'Sunday: Closed',
    ],
  },
  photosCount: 3,
};

const PENTAGON_SITE: WebsiteAuditData = {
  url: 'http://pentagonqmc.com',
  isHttps: false,
  hasPhoneMatch: true,
  hasAddressMatch: true,
  hasSchema: true,
  schemaType: 'LocalBusiness',
  metaTitle: 'Pentagon Quality Management Consultants | ISO Certification & Audits Chennai',
  metaDescription: 'Leading ISO certification consultants in Tambaram, Chennai. ISO 9001, 14001, 45001, and quality management consulting services across Tamil Nadu.',
  headings: ['ISO 9001 Certification', 'ISO 14001 Environmental Management', 'ISO 45001 Health & Safety', 'Internal Audits', 'Quality Consulting'],
  servicesMentioned: ['ISO 9001 Certification', 'ISO 14001 Consulting', 'ISO 45001 Auditing', 'Quality Management System'],
  contactEmails: ['contact@pentagonqmc.com'],
};

const understanding = buildBusinessUnderstanding(PENTAGON_PLACE, PENTAGON_SITE);
const auditedFields = evaluateAllGbpFields(PENTAGON_PLACE, PENTAGON_SITE, understanding);

const noChangesCount = auditedFields.filter(f => f.status === 'NO CHANGES REQUIRED').length;
const missingCount = auditedFields.filter(f => f.status === 'MISSING').length;
const needsImprovementCount = auditedFields.filter(f => f.status === 'NEEDS IMPROVEMENT').length;
const unableToVerifyCount = auditedFields.filter(f => f.status === 'UNABLE TO VERIFY').length;
const verifiableTotal = noChangesCount + missingCount + needsImprovementCount;
const completenessScore = verifiableTotal > 0 ? Math.round((noChangesCount / verifiableTotal) * 100) : 50;

const sectionMap: Record<string, { title: string; items: any[] }> = {
  basic_info: { title: 'Basic Information & Categories', items: [] },
  location_area: { title: 'Location & Service Areas', items: [] },
  hours: { title: 'Business Hours', items: [] },
  services: { title: 'Services Catalog', items: [] },
  products: { title: 'Products & Packages', items: [] },
  attributes: { title: 'Attributes & Facilities', items: [] },
  contact: { title: 'Contact Information & Messaging', items: [] },
  photos: { title: 'Photos & Visual Content', items: [] },
  other: { title: 'Other Profile Fields', items: [] },
};

auditedFields.forEach(field => {
  if (field.status === 'MISSING' || field.status === 'NEEDS IMPROVEMENT') {
    if (field.recommended_content && field.recommended_content.trim().length > 0) {
      sectionMap[field.category]?.items.push({
        field_id: field.field_id,
        field_name: field.field_name,
        status: field.status,
        current_value: field.current_value,
        recommended_content: field.recommended_content,
        why_it_matters: field.why_it_matters || '',
        action: field.recommendation || '',
      });
    }
  }
});

const recommendedContentBySection = Object.entries(sectionMap)
  .filter(([_, section]) => section.items.length > 0)
  .map(([key, section]) => ({
    sectionKey: key,
    sectionTitle: section.title,
    items: section.items,
  }));

const defaultGbpAudit: GbpCompleteAuditResult = {
  business: {
    name: PENTAGON_PLACE.displayName,
    category: understanding.primaryCategory,
    location: PENTAGON_PLACE.formattedAddress,
    websiteUrl: PENTAGON_SITE.url,
    mapUrl: 'https://www.google.com/maps/place/Pentagon+Quality+Management+Consultants.',
    placeId: PENTAGON_PLACE.id,
    lastAuditedAt: 'Oct 29, 2026',
  },
  understanding,
  completenessScore,
  totalAuditedFields: auditedFields.length,
  noChangesRequiredCount: noChangesCount,
  missingCount,
  needsImprovementCount,
  unableToVerifyCount,
  fields: auditedFields,
  recommendedContentBySection,
};

export const DEFAULT_PENTAGON_AUDIT: AuditResponse = {
  business: {
    name: 'Pentagon Quality Management Consultants.',
    city: 'Tambaram',
    address: 'Tambaram, Chennai, Tamil Nadu 600045, India',
    category: 'Business management consultant',
    phone: '+91 98400 12345',
    websiteUrl: 'http://pentagonqmc.com',
    mapUrl: 'https://www.google.com/maps/place/Pentagon+Quality+Management+Consultants.',
    placeId: 'ChIJ_pentagon_sample_id',
    rating: 4.8,
    reviewCount: 28,
    updatedAt: 'Oct 29, 2026',
  },
  scores: {
    authorityScore: 78,
    mapsRank: 3,
    gbpHealth: 45,
    gbpHealthChange: -5,
    citationHealth: 100,
    gbpOptimization: 45,
    citationFixes: 100,
    reviewGrowth: 70,
    keywordRankings: 94,
  },
  searchConsole: {
    connected: false,
    selectedProperty: null,
    clicks: null,
    impressions: null,
    ctr: null,
    averagePosition: null,
    dateRange: null,
    organicTraffic: 2384,
    organicKeywordsCount: 4,
    mapsVisibilityPercent: 78,
    top10KeywordsCount: 4,
    trafficTrend: [1800, 2100, 2400, 2200, 2384],
    keywords: [
      { query: 'iso certification consultants chennai', clicks: 920, impressions: 8400, ctr: 0.109, position: 2.4 },
      { query: 'business management consultant tambaram', clicks: 640, impressions: 5200, ctr: 0.123, position: 1.8 },
      { query: 'iso 9001 audit consultants tamil nadu', clicks: 480, impressions: 4100, ctr: 0.117, position: 3.1 },
      { query: 'quality management consultants near me', clicks: 344, impressions: 3800, ctr: 0.091, position: 3.5 },
    ],
  },
  priorityActions: [
    {
      id: '1',
      title: 'Improve services (currently 35/100)',
      field: 'services',
      severity: 'medium',
      description: 'Your Google Business Profile only has 2 services listed while competitors list 10+ services.',
      action: 'Add ISO 9001, ISO 14001, ISO 45001, and Management Consulting services to your profile.',
    },
    {
      id: '2',
      title: 'Improve photos (currently 35/100)',
      field: 'photos',
      severity: 'medium',
      description: 'Profile has only 3 photos. Profiles with 20+ photos receive 42% more direction requests on Google Maps.',
      action: 'Upload high-resolution exterior, office interior, and client consultation photos.',
    },
    {
      id: '3',
      title: 'Improve description (currently 0/100)',
      field: 'description',
      severity: 'high',
      description: 'Your business profile description is missing or empty on Google Business Profile.',
      action: 'Add a 750-character keyword-rich business description highlighting your ISO certifications in Tambaram.',
    },
    {
      id: '4',
      title: 'Low review volume (28 reviews)',
      field: 'reviews',
      severity: 'medium',
      description: 'Top local competitors have 300+ reviews. Review velocity is critical for Local 3-Pack rankings.',
      action: 'Send review request links to recent certification clients to reach 100+ reviews.',
    },
  ],
  aiRecommendations: [
    'Launch an automated review collection campaign targeting existing and past clients to aggressively grow review volume from 28 toward at least 150+ high-quality Google reviews.',
    "Upgrade the website security by installing an SSL certificate and redirecting all traffic from HTTP to secure HTTPS ('https://pentagonqmc.com/').",
    'Post weekly updates on the Google Business Profile featuring case studies, ISO management consulting tips, and photos to boost engagement metrics.',
  ],
  optimizedDescriptionDraft:
    'Pentagon Quality Management Consultants is a leading ISO and management consulting firm based in Tambaram, Chennai. With over a decade of excellence, we specialize in ISO 9001, ISO 14001, ISO 45001, and comprehensive quality auditing services for businesses across Tamil Nadu. Contact us today for reliable business certification solutions.',
  competitors: [
    { id: 'c1', name: 'Das Manpower Consultancy Services', rating: 4.7, reviews: 714, isDominant: true },
    { id: 'c2', name: 'Job Seeks 4U Consultancy Services', rating: 4.7, reviews: 321 },
    { id: 'c3', name: 'Manav Corporate Consultants - Certificate Apostille and Attestation Services in Chennai', rating: 5.0, reviews: 907 },
  ],
  missingFields: ['Business Description', 'Appointment / Booking URL', 'Services Catalog', 'Cover Photo'],
  inconsistentFields: ['Website Protocol (HTTP vs HTTPS)', 'Service Area Radius'],
  whatNeedsToBeAdded: [
    'Add full 750-character business description with ISO consulting keywords',
    'Add Calendly or online appointment booking URL',
    'Add specific ISO certification service categories',
    'Add team and office visual photos',
  ],
  gbpCompleteAudit: defaultGbpAudit,
};
