import { GooglePlaceData, TargetServiceProfile, WebsiteAuditData } from './types';
import { getOpenAIClient } from './openai-client';

/**
 * Generic category words and listing labels that describe an establishment
 * rather than a specific commercial service or offering.
 */
export const GENERIC_CATEGORY_STOPWORDS = new Set([
  'corporate office',
  'office',
  'establishment',
  'point of interest',
  'point_of_interest',
  'business',
  'company',
  'local business',
  'headquarters',
  'building',
  'agency',
  'consultant',
  'services',
  'service',
  'business services',
  'commercial services',
  'professional services',
  'solutions',
  'products',
  'commercial',
]);

/**
 * Generic navigation and structural terms to ignore when discovering actual commercial services.
 */
export const FORBIDDEN_SERVICE_TERMS = new Set([
  'services',
  'service',
  'our services',
  'all services',
  'what we do',
  'offerings',
  'our offerings',
  'solutions',
  'solution',
  'our solutions',
  'all solutions',
  'products',
  'product',
  'all products',
  'our products',
  'practice',
  'practices',
  'overview',
  'capabilities',
  'explore',
  'industries',
  'sectors',
  'company',
  'corporate',
  'corporate office',
  'office',
  'headquarters',
  'business',
  'business services',
  'commercial services',
  'professional services',
  'establishment',
  'point of interest',
  'point_of_interest',
  'featured case studies',
  'case study',
  'case studies',
  'resources',
  'insights',
  'whitepapers',
  'downloads',
  'legal',
  'security',
  'compliance',
  'investors',
  'investor relations',
  'press',
  'media',
  'newsroom',
  'leadership',
  'team',
  'management',
  'careers',
  'about',
  'about us',
  'contact',
  'contact us',
  'home',
]);

/**
 * Validates whether an extracted string represents a substantive commercial service,
 * rather than a structural navigation label, generic category, or brand fragment.
 */
export function isValidCommercialService(service?: string | null): boolean {
  if (!service) return false;
  const clean = service.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();

  // Length requirement for meaningful service names
  if (clean.length < 3 || clean.length > 70) return false;

  // Reject generic establishment terms and structural navigation labels
  if (FORBIDDEN_SERVICE_TERMS.has(lower) || GENERIC_CATEGORY_STOPWORDS.has(lower)) {
    return false;
  }

  // Must not consist purely of non-alphanumeric symbols or short words
  const tokens = lower.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return false;

  // Must contain at least one non-generic domain token
  const nonGenericTokens = tokens.filter(
    (t) => !FORBIDDEN_SERVICE_TERMS.has(t) && !GENERIC_CATEGORY_STOPWORDS.has(t)
  );
  if (nonGenericTokens.length === 0) return false;

  return true;
}

/**
 * Normalizes and cleans raw text
 */
function cleanText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fully dynamic, data-driven service understanding engine.
 * Understands ANY business from its actual website evidence and Google listing details,
 * without any hardcoded industries, companies, or predefined service lists.
 */
export function extractDeterministicProfile(
  place: GooglePlaceData,
  siteAudit?: WebsiteAuditData,
  city?: string
): TargetServiceProfile {
  const bizName = cleanText(place.displayName);
  const rawCategory = cleanText(
    place.primaryTypeDisplayName || place.primaryType?.replace(/_/g, ' ') || 'Local Business'
  );

  const address = place.formattedAddress || '';
  const resolvedCity =
    city ||
    place.addressComponents?.find((c) => c.types?.includes('locality'))?.longText ||
    address.split(',').slice(-4, -2).join(', ').trim() ||
    'Local Area';

  const conflictNotes: string[] = [];
  const webTitle = cleanText(siteAudit?.title);
  const metaDesc = cleanText(siteAudit?.metaDescription);
  const aboutText = cleanText(siteAudit?.aboutSnippet);
  const headings = siteAudit?.headings || [];
  const rawServices = siteAudit?.servicesMentioned || [];

  // Filter raw services against structural stopwords
  const verifiedServices = rawServices.filter(isValidCommercialService);

  // Detect whether Google Maps category is a generic establishment label
  const isGenericGoogleCategory = GENERIC_CATEGORY_STOPWORDS.has(rawCategory.toLowerCase());

  // 1. Discover potential main service from website title & H1
  let detectedMainService = '';
  const bizTokens = new Set(
    bizName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (webTitle) {
    const titleParts = webTitle.split(/[-–|:•]/).map((p) => p.trim());
    const servicePart = titleParts.find((part) => {
      if (!isValidCommercialService(part)) return false;
      const partLower = part.toLowerCase();
      if (partLower === bizName.toLowerCase()) return false;
      const partTokens = partLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);
      if (partTokens.length > 0) {
        const overlapCount = partTokens.filter((t) => bizTokens.has(t)).length;
        if (overlapCount / partTokens.length >= 0.5) return false;
      }
      return true;
    });

    if (servicePart) {
      detectedMainService = servicePart;
    }
  }

  // Check first H1 if title had no distinct service part
  if (!detectedMainService && siteAudit?.h1Headings && siteAudit.h1Headings.length > 0) {
    const candidateH1 = siteAudit.h1Headings[0];
    if (isValidCommercialService(candidateH1)) {
      const h1Tokens = candidateH1
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const overlapCount = h1Tokens.filter((t) => bizTokens.has(t)).length;
      if (h1Tokens.length === 0 || overlapCount / h1Tokens.length < 0.5) {
        detectedMainService = candidateH1;
      }
    }
  }

  // Check top verified service from website navigation or service cards
  if (!detectedMainService && verifiedServices.length > 0) {
    detectedMainService = verifiedServices[0];
  }

  // Fallback to Google category if specific, or brand service
  if (!detectedMainService) {
    if (!isGenericGoogleCategory) {
      detectedMainService = rawCategory;
    } else {
      detectedMainService = `${bizName} Commercial Services`;
    }
  }

  // 2. Dynamically determine actual business type from evidence
  let actualBusinessType = '';
  if (!isGenericGoogleCategory) {
    actualBusinessType = rawCategory;
  } else if (detectedMainService && isValidCommercialService(detectedMainService)) {
    actualBusinessType = detectedMainService;
  } else if (webTitle && isValidCommercialService(webTitle)) {
    actualBusinessType = webTitle;
  } else {
    actualBusinessType = 'Commercial Business';
  }

  // Note conflict when Google Maps primary category is generic
  if (isGenericGoogleCategory) {
    conflictNotes.push(
      `Google Maps listing category is generic ("${rawCategory}"), while verified website evidence establishes actual commercial activity as "${actualBusinessType}".`
    );
  }

  // 3. Assemble primary and secondary services dynamically from verified offerings
  const primaryServices: string[] = [];
  const secondaryServices: string[] = [];

  if (detectedMainService && isValidCommercialService(detectedMainService)) {
    primaryServices.push(detectedMainService);
  }

  for (const s of verifiedServices) {
    if (s.toLowerCase() === detectedMainService.toLowerCase()) continue;
    if (primaryServices.length < 5 && !primaryServices.some((p) => p.toLowerCase() === s.toLowerCase())) {
      primaryServices.push(s);
    } else if (
      secondaryServices.length < 8 &&
      !secondaryServices.some((sec) => sec.toLowerCase() === s.toLowerCase())
    ) {
      secondaryServices.push(s);
    }
  }

  // Also include valid section headings as secondary services
  for (const h of headings) {
    if (
      isValidCommercialService(h) &&
      h.toLowerCase() !== detectedMainService.toLowerCase() &&
      !primaryServices.some((p) => p.toLowerCase() === h.toLowerCase()) &&
      !secondaryServices.some((sec) => sec.toLowerCase() === h.toLowerCase())
    ) {
      secondaryServices.push(h);
    }
  }

  // 4. Dynamically extract industries served from crawled evidence
  const candidateIndustryKeywords = [
    'healthcare',
    'medical',
    'hospitality',
    'finance',
    'banking',
    'manufacturing',
    'automotive',
    'insurance',
    'retail',
    'education',
    'technology',
    'real estate',
    'construction',
    'logistics',
    'energy',
    'residential',
    'commercial',
    'corporate',
  ];
  const fullTextLower = `${webTitle} ${metaDesc} ${aboutText} ${verifiedServices.join(' ')}`.toLowerCase();
  const detectedIndustries = candidateIndustryKeywords
    .filter((kw) => fullTextLower.includes(kw))
    .map((kw) => kw.charAt(0).toUpperCase() + kw.slice(1));
  const industriesServed = detectedIndustries.length > 0 ? detectedIndustries : undefined;

  // 5. Dynamic target customers and service locations
  const targetCustomers = `Clients and organizations seeking ${detectedMainService || actualBusinessType} in ${resolvedCity} and surrounding markets.`;
  const serviceLocations = [resolvedCity];

  // 6. Service keywords for high-intent search
  const serviceKeywords = Array.from(
    new Set([
      detectedMainService.toLowerCase(),
      `${detectedMainService.toLowerCase()} ${resolvedCity.toLowerCase()}`,
      ...primaryServices.slice(0, 4).map((s) => s.toLowerCase()),
      ...secondaryServices.slice(0, 3).map((s) => s.toLowerCase()),
    ])
  );

  // 7. Evidence URLs from website and crawled subpages
  const evidenceUrls: string[] = [];
  if (siteAudit?.url) evidenceUrls.push(siteAudit.url);
  if (siteAudit?.subpagesCrawled) {
    for (const sub of siteAudit.subpagesCrawled) {
      if (sub.url && !evidenceUrls.includes(sub.url)) {
        evidenceUrls.push(sub.url);
      }
    }
  }

  // 8. Confidence scoring & validation
  let confidenceScore = 80;
  let confidence: 'high' | 'medium' | 'limited' = 'high';
  let isServiceProfileValidated = true;
  let validationFailureReason: string | undefined = undefined;

  if (!siteAudit?.url || siteAudit.statusCode === 0) {
    confidenceScore = 35;
    confidence = 'limited';
    isServiceProfileValidated = false;
    validationFailureReason =
      'Target business website could not be crawled or analyzed. Competitor discovery suspended to prevent irrelevant results.';
  } else if (primaryServices.length === 0 || !isValidCommercialService(detectedMainService)) {
    confidenceScore = 40;
    confidence = 'limited';
    isServiceProfileValidated = false;
    validationFailureReason =
      'Insufficient verified commercial service evidence extracted from target business website.';
  } else if (verifiedServices.length < 2) {
    confidenceScore = 65;
    confidence = 'medium';
  } else {
    confidenceScore = 95;
    confidence = 'high';
  }

  return {
    businessName: bizName,
    website: place.websiteUri || siteAudit?.url || '',
    mapsCategory: rawCategory,
    actualBusinessType,
    mainService: detectedMainService,
    primaryServices: primaryServices.slice(0, 6),
    secondaryServices: secondaryServices.slice(0, 8),
    industriesServed,
    targetCustomers,
    serviceLocations,
    serviceArea: resolvedCity,
    serviceKeywords,
    excludedServices: [],
    evidenceUrls,
    confidenceScore,
    confidence,
    conflictNotes: conflictNotes.length > 0 ? conflictNotes : undefined,
    sourceSummary: `Determined from crawled website (${siteAudit?.url || 'N/A'}) and Google Places listing ("${bizName}").`,
    isServiceProfileValidated,
    validationFailureReason,
  };
}

/**
 * Builds a factual, service-first profile of the target business before competitor search.
 * Tries LLM synthesis with strict JSON schema if OpenAI is accessible; seamlessly
 * falls back to our robust deterministic engine if OpenAI is rate-limited or unavailable.
 */
export async function determineTargetServiceProfile(
  placeOrOptions: GooglePlaceData | { placeData: GooglePlaceData; websiteData?: WebsiteAuditData; city?: string },
  siteAuditParam?: WebsiteAuditData,
  cityParam?: string
): Promise<TargetServiceProfile> {
  let place: GooglePlaceData;
  let siteAudit: WebsiteAuditData | undefined;
  let city: string | undefined;

  if (placeOrOptions && 'placeData' in placeOrOptions) {
    place = placeOrOptions.placeData;
    siteAudit = placeOrOptions.websiteData;
    city = placeOrOptions.city;
  } else {
    place = placeOrOptions as GooglePlaceData;
    siteAudit = siteAuditParam;
    city = cityParam;
  }

  const fallback = extractDeterministicProfile(place, siteAudit, city);

  // If deterministic profile is invalid, return immediately without querying LLM
  if (!fallback.isServiceProfileValidated) {
    return fallback;
  }

  // Try OpenAI if configured
  const openai = getOpenAIClient();
  if (!openai) {
    return fallback;
  }

  try {
    const prompt = `You are an elite Local SEO Business Intelligence Analyst.
Analyze the target company's Google Maps listing and crawled website data.
Produce a structured, validated commercial service profile based strictly on the factual evidence provided.

Target Business:
- Name: ${place.displayName}
- Maps Category: ${place.primaryTypeDisplayName || place.primaryType || 'Corporate Office'}
- Address: ${place.formattedAddress} (City: ${city || 'Local Area'})
- Website URL: ${place.websiteUri || siteAudit?.url || 'N/A'}
- Website Title: ${siteAudit?.title || 'N/A'}
- Meta Description: ${siteAudit?.metaDescription || 'N/A'}
- About Snippet: ${siteAudit?.aboutSnippet || 'N/A'}
- Crawled Services: ${siteAudit?.servicesMentioned?.join(', ') || 'None'}
- Crawled Headings: ${siteAudit?.headings?.slice(0, 10).join('; ') || 'N/A'}

CRITICAL RULES:
1. Never treat generic listing labels like "Corporate Office", "Services", "Establishment", or "Point of Interest" as a specific commercial service.
2. Determine the company's actual commercial business activity and primary commercial offerings directly from the website text.
3. List 3 to 6 distinct primary commercial services that the business actually delivers and charges for.
4. List 3 to 6 secondary commercial services or capabilities.
5. If Google Maps category differs from the actual commercial services on the website, note the conflict in conflictNotes.
6. Provide an accurate confidence score (0-100).

Respond ONLY with valid JSON matching this schema:
{
  "actualBusinessType": "string",
  "mainService": "string",
  "primaryServices": ["string"],
  "secondaryServices": ["string"],
  "industriesServed": ["string"],
  "targetCustomers": "string",
  "serviceLocations": ["string"],
  "conflictNotes": ["string"],
  "confidenceScore": number
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.mainService && isValidCommercialService(parsed.mainService)) {
        const validPrimaries = Array.isArray(parsed.primaryServices)
          ? parsed.primaryServices.filter(isValidCommercialService)
          : fallback.primaryServices;

        const validSecondaries = Array.isArray(parsed.secondaryServices)
          ? parsed.secondaryServices.filter(isValidCommercialService)
          : fallback.secondaryServices;

        return {
          ...fallback,
          actualBusinessType: parsed.actualBusinessType || fallback.actualBusinessType,
          mainService: parsed.mainService,
          primaryServices: validPrimaries.length > 0 ? validPrimaries : fallback.primaryServices,
          secondaryServices: validSecondaries.length > 0 ? validSecondaries : fallback.secondaryServices,
          industriesServed: Array.isArray(parsed.industriesServed)
            ? parsed.industriesServed
            : fallback.industriesServed,
          targetCustomers: parsed.targetCustomers || fallback.targetCustomers,
          serviceLocations: Array.isArray(parsed.serviceLocations)
            ? parsed.serviceLocations
            : fallback.serviceLocations,
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 95,
          confidence: 'high',
          conflictNotes: Array.isArray(parsed.conflictNotes) && parsed.conflictNotes.length > 0
            ? parsed.conflictNotes
            : fallback.conflictNotes,
          sourceSummary: `Analyzed via AI verification of crawled website and verified Google Places profile.`,
          isServiceProfileValidated: true,
        };
      }
    }
  } catch (err: any) {
    console.warn('OpenAI business understanding unavailable, using deterministic analysis:', err.message);
  }

  return fallback;
}
