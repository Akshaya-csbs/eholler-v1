import axios from 'axios';
import { CompetitorItem, GooglePlaceData, TargetServiceProfile, WebsiteAuditData } from './types';
import {
  determineTargetServiceProfile,
  isValidCommercialService,
  GENERIC_CATEGORY_STOPWORDS,
  FORBIDDEN_SERVICE_TERMS,
} from './business-understanding';
import { scrapeCandidateSummary } from './website-scraper';

interface CompetitorCacheEntry {
  timestamp: number;
  data: {
    directCompetitors: CompetitorItem[];
    relatedCompetitors: CompetitorItem[];
    competitors: CompetitorItem[];
    targetServiceProfile: TargetServiceProfile;
  };
}

const competitorCache = new Map<string, CompetitorCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Normalizes text for comparison (lowercased, alphanumeric tokens)
 */
function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts canonical domain hostname from a URL
 */
function extractHostname(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Normalizes phone numbers to digits only
 */
function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Universal dynamic service match evaluation.
 * Evaluates whether a candidate business genuinely provides the target commercial service.
 * Does NOT rely on hardcoded industry blacklists; instead, compares actual substantive domain tokens
 * between the target service and candidate offerings.
 */
export function checkServiceMatch(candidateText: string, targetService: string): {
  matched: boolean;
  score: number;
} {
  const cNorm = normalizeText(candidateText);
  const tNorm = normalizeText(targetService);

  if (!cNorm || !tNorm) return { matched: false, score: 0 };

  // Never match on generic category or establishment words
  if (
    FORBIDDEN_SERVICE_TERMS.has(tNorm) ||
    GENERIC_CATEGORY_STOPWORDS.has(tNorm) ||
    tNorm === 'services' ||
    tNorm === 'service' ||
    tNorm === 'solutions' ||
    tNorm === 'business services' ||
    tNorm === 'corporate office'
  ) {
    return { matched: false, score: 0 };
  }

  // 1. Exact phrase match: valid if target phrase is >= 2 words and >= 6 characters
  const tWords = tNorm.split(' ').filter(Boolean);
  if (tWords.length >= 2 && tNorm.length >= 6 && cNorm.includes(tNorm)) {
    return { matched: true, score: 95 };
  }

  // 2. Meaningful substantive domain token overlap
  // Exclude common language filler words, corporate suffixes, and generic structural words
  const stopWords = new Set([
    'and',
    'or',
    'in',
    'of',
    'for',
    'the',
    'with',
    'by',
    'to',
    'at',
    'from',
    'a',
    'an',
    'services',
    'service',
    'solutions',
    'solution',
    'company',
    'agency',
    'firm',
    'group',
    'ltd',
    'pvt',
    'private',
    'limited',
    'inc',
    'llc',
    'corporate',
    'office',
    'center',
    'centre',
  ]);

  const tTokens = tWords.filter((w) => w.length >= 3 && !stopWords.has(w));
  if (tTokens.length === 0) return { matched: false, score: 0 };

  const matchedTokens = tTokens.filter((token) => cNorm.includes(token));
  const ratio = matchedTokens.length / tTokens.length;

  // Single distinctive domain token (e.g. "cardiology", "plumbing", "pizza", "orthopedics", "cleaning")
  if (tTokens.length === 1 && tTokens[0].length >= 4 && matchedTokens.length === 1) {
    return { matched: true, score: 85 };
  }

  // Multi-token match: requires at least 60% token overlap with at least 2 tokens
  if (ratio >= 0.6 && matchedTokens.length >= 2) {
    return { matched: true, score: Math.round(ratio * 90) };
  }

  // Partial match: at least 50% overlap (useful for related competitors)
  if (ratio >= 0.5 && matchedTokens.length >= 1) {
    return { matched: false, score: Math.round(ratio * 60) };
  }

  return { matched: false, score: 0 };
}

/**
 * Sorts competitors by Google rating (highest first), review count (highest first),
 * placing businesses without ratings at the end (Rule 6).
 */
export function sortCompetitorsByRating(items: CompetitorItem[]): CompetitorItem[] {
  return [...items].sort((a, b) => {
    const aRating = typeof a.rating === 'number' && a.rating > 0 ? a.rating : -1;
    const bRating = typeof b.rating === 'number' && b.rating > 0 ? b.rating : -1;

    // 1. Highest Google rating first
    if (bRating !== aRating) {
      return bRating - aRating;
    }

    // 2. Highest review count first if ratings are equal
    const aReviews = a.reviews || 0;
    const bReviews = b.reviews || 0;
    if (bReviews !== aReviews) {
      return bReviews - aReviews;
    }

    // 3. Fallback to relevance score
    return (b.relevanceScore || 0) - (a.relevanceScore || 0);
  });
}

/**
 * Generates search queries dynamically from the target business's extracted profile.
 * Works for ANY business from ANY industry without hardcoded industry branches.
 */
export function generatePlacesSearchQueries(
  targetProfile: TargetServiceProfile,
  city: string
): string[] {
  const queries: string[] = [];
  const location = city && city !== 'Local Area' ? city : targetProfile.serviceArea || '';

  // 1. Primary commercial service query
  if (targetProfile.mainService && isValidCommercialService(targetProfile.mainService)) {
    queries.push(location ? `${targetProfile.mainService} in ${location}` : targetProfile.mainService);
    queries.push(
      location ? `${targetProfile.mainService} company in ${location}` : `${targetProfile.mainService} company`
    );
  }

  // 2. Additional verified primary services
  if (targetProfile.primaryServices && targetProfile.primaryServices.length > 0) {
    for (const service of targetProfile.primaryServices) {
      if (
        isValidCommercialService(service) &&
        service.toLowerCase() !== targetProfile.mainService?.toLowerCase()
      ) {
        queries.push(location ? `${service} in ${location}` : service);
        if (queries.length >= 4) break;
      }
    }
  }

  // 3. Actual business type query (if distinct and non-generic)
  if (
    targetProfile.actualBusinessType &&
    isValidCommercialService(targetProfile.actualBusinessType) &&
    targetProfile.actualBusinessType.toLowerCase() !== targetProfile.mainService?.toLowerCase() &&
    !GENERIC_CATEGORY_STOPWORDS.has(targetProfile.actualBusinessType.toLowerCase())
  ) {
    queries.push(
      location ? `${targetProfile.actualBusinessType} in ${location}` : targetProfile.actualBusinessType
    );
  }

  // Filter out any query that would search purely for generic terms
  const validQueries = queries.filter((q) => {
    const lower = q.toLowerCase();
    return (
      !lower.startsWith('services in ') &&
      !lower.startsWith('corporate office in ') &&
      !lower.startsWith('business in ') &&
      !lower.startsWith('point of interest in ') &&
      !lower.startsWith('establishment in ')
    );
  });

  return Array.from(new Set(validQueries)).slice(0, 3);
}

/**
 * Service-Based Competitor Identification Engine.
 * Fully dynamic and industry-agnostic:
 * 1. Validates target business's actual commercial services from website & GBP.
 * 2. Generates high-intent commercial search queries from the extracted profile.
 * 3. Enforces strict self-exclusion and closed-business filtering.
 * 4. Crawls and independently verifies every candidate's commercial offerings.
 * 5. Compares candidate offerings with target services to classify into DIRECT, RELATED, or EXCLUDED.
 * 6. Ranks verified competitors strictly by Google Rating descending, then Review Count descending.
 */
export async function identifyLocalCompetitors(params: {
  placeData: GooglePlaceData;
  siteAudit?: WebsiteAuditData;
  city?: string;
  apiKey?: string;
  limit?: number;
  forceFresh?: boolean;
}): Promise<{
  directCompetitors: CompetitorItem[];
  relatedCompetitors: CompetitorItem[];
  competitors: CompetitorItem[];
  targetServiceProfile: TargetServiceProfile;
}> {
  const { placeData, siteAudit, city, limit = 10, forceFresh = false } = params;
  const apiKey = params.apiKey || process.env.GOOGLE_MAPS_API_KEY;

  // 1. Build a complete, structured understanding of the target business's actual services
  const targetProfile = await determineTargetServiceProfile(placeData, siteAudit, city);

  // Phase 8: Fail safely if target service profile could not be validated
  if (!targetProfile.isServiceProfileValidated) {
    return {
      directCompetitors: [],
      relatedCompetitors: [],
      competitors: [],
      targetServiceProfile: targetProfile,
    };
  }

  const targetPlaceId = placeData.id;
  const targetNameNorm = normalizeText(placeData.displayName);
  const targetDomain = extractHostname(placeData.websiteUri || siteAudit?.url);
  const targetPhone = normalizePhone(
    placeData.nationalPhoneNumber || placeData.internationalPhoneNumber
  );
  const resolvedCity = targetProfile.serviceArea || city || 'Local Area';

  // Cache check: dynamic per business identity, domain, and market
  const cacheKey = `${targetPlaceId}_${targetDomain}_${resolvedCity}_v3`;
  if (!forceFresh) {
    const cached = competitorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Generate search queries dynamically from the current business profile
  const searchQueries = generatePlacesSearchQueries(targetProfile, resolvedCity);

  const rawPlaces: any[] = [];
  const seenPlaceIds = new Set<string>();

  // 3. Query Google Places API (New) Text Search
  if (apiKey) {
    for (const query of searchQueries) {
      try {
        const requestBody: any = {
          textQuery: query,
          pageSize: 10,
        };

        const res = await axios.post(
          'https://places.googleapis.com/v1/places:searchText',
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryType,places.primaryTypeDisplayName,places.types,places.editorialSummary,places.businessStatus,places.googleMapsUri',
            },
            timeout: 10000,
          }
        );

        const items = res.data?.places || [];
        for (const item of items) {
          if (item.id && !seenPlaceIds.has(item.id)) {
            seenPlaceIds.add(item.id);
            rawPlaces.push(item);
          }
        }
      } catch (err: any) {
        console.warn(`Places Text Search failed for query "${query}":`, err.message);
      }
    }
  }

  const directCandidates: CompetitorItem[] = [];
  const relatedCandidates: CompetitorItem[] = [];

  // 4. Inspect, Verify, and Classify Every Candidate Dynamically
  for (const candidate of rawPlaces) {
    const candidateId = candidate.id;
    const candidateName = candidate.displayName?.text || candidate.displayName || 'Competitor';
    const candidateNameNorm = normalizeText(candidateName);
    const candidateDomain = extractHostname(candidate.websiteUri);
    const candidatePhone = normalizePhone(candidate.nationalPhoneNumber);

    // Rule 1: Self-Exclusion (Target business never competes with itself)
    if (candidateId === targetPlaceId) continue;
    if (candidateNameNorm && targetNameNorm && candidateNameNorm === targetNameNorm) continue;
    if (
      targetDomain &&
      candidateDomain &&
      (candidateDomain === targetDomain || candidateDomain.endsWith(`.${targetDomain}`))
    ) {
      continue;
    }
    if (targetPhone && candidatePhone && candidatePhone === targetPhone) continue;

    // Rule 2: Exclude permanently or temporarily closed places
    if (
      candidate.businessStatus === 'CLOSED_PERMANENTLY' ||
      candidate.businessStatus === 'CLOSED_TEMPORARILY'
    ) {
      continue;
    }

    const candidatePrimaryType =
      candidate.primaryTypeDisplayName?.text ||
      candidate.primaryTypeDisplayName ||
      candidate.primaryType;

    const candidateCategory = candidatePrimaryType || 'Commercial Service';
    const candidateAddress = candidate.formattedAddress || `${resolvedCity}, India`;
    const candidateRating = candidate.rating || 0;
    const candidateReviews = candidate.userRatingCount || 0;
    const mapUrl =
      candidate.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${candidateId}`;

    // Rule 3: Crawl Candidate's Website to Extract Verified Commercial Services
    let candidateEvidence: {
      title?: string;
      metaDescription?: string;
      headings: string[];
      services: string[];
      isReachable: boolean;
      evidenceUrl: string;
    } | null = null;

    if (candidate.websiteUri) {
      candidateEvidence = await scrapeCandidateSummary(candidate.websiteUri);
    }

    // Build candidate text corpus for service matching
    const candidateCorpus = [
      candidateName,
      candidateCategory,
      candidate.editorialSummary?.text || candidate.editorialSummary || '',
      candidateEvidence?.title || '',
      candidateEvidence?.metaDescription || '',
      ...(candidateEvidence?.headings || []),
      ...(candidateEvidence?.services || []),
    ]
      .filter(Boolean)
      .join(' ');

    // Rule 4: Compare Candidate Services against Target's Primary and Secondary Services
    let bestPrimaryMatch = { matched: false, score: 0, service: targetProfile.mainService };
    for (const pService of targetProfile.primaryServices) {
      const match = checkServiceMatch(candidateCorpus, pService);
      if (match.matched && match.score > bestPrimaryMatch.score) {
        bestPrimaryMatch = { matched: true, score: match.score, service: pService };
      }
    }

    let bestSecondaryMatch = { matched: false, score: 0, service: '' };
    for (const sService of targetProfile.secondaryServices) {
      const match = checkServiceMatch(candidateCorpus, sService);
      if (match.matched && match.score > bestSecondaryMatch.score) {
        bestSecondaryMatch = { matched: true, score: match.score, service: sService };
      }
    }

    // Determine candidate verified service title
    let candidateMainService = candidateEvidence?.services?.[0] || candidateCategory;
    if (candidateEvidence?.title) {
      const parts = candidateEvidence.title.split(/[-–|:•]/).map((p) => p.trim());
      const nonBrand = parts.find(
        (p) => isValidCommercialService(p) && !candidateName.toLowerCase().includes(p.toLowerCase())
      );
      if (nonBrand) candidateMainService = nonBrand;
    }

    const evidenceConfidence: 'high' | 'medium' | 'limited' = candidateEvidence?.isReachable
      ? 'high'
      : candidate.websiteUri
      ? 'medium'
      : 'limited';

    const isDominant =
      candidateReviews > 100 || (candidateRating >= 4.7 && candidateReviews > 30);

    // Classification A: DIRECT COMPETITOR (matches primary commercial service, score >= 70)
    if (bestPrimaryMatch.matched && bestPrimaryMatch.score >= 60) {
      const rationale = `Direct competitor providing verified commercial service "${candidateMainService}" in ${resolvedCity}, directly competing with target business's primary service "${bestPrimaryMatch.service}".`;

      directCandidates.push({
        id: candidateId,
        name: candidateName,
        rating: candidateRating,
        reviews: candidateReviews,
        address: candidateAddress,
        isDominant,
        category: candidateCategory,
        relevanceScore: Math.min(100, Math.max(70, bestPrimaryMatch.score)),
        classification: 'direct',
        rationale,
        websiteUri: candidate.websiteUri,
        mapUrl,
        mainServiceIdentified: candidateMainService,
        matchedTargetService: bestPrimaryMatch.service,
        evidenceConfidence,
        evidenceSourceUrl: candidateEvidence?.evidenceUrl || candidate.websiteUri,
        comparisonReason: `Directly competes for clients requiring ${bestPrimaryMatch.service}.`,
      });
    }
    // Classification B: RELATED COMPETITOR (matches secondary service, score 45-69)
    else if (bestSecondaryMatch.matched && bestSecondaryMatch.score >= 45) {
      const rationale = `Related competitor offering specialized capabilities in "${candidateMainService}", overlapping with target business's secondary service "${bestSecondaryMatch.service}".`;

      relatedCandidates.push({
        id: candidateId,
        name: candidateName,
        rating: candidateRating,
        reviews: candidateReviews,
        address: candidateAddress,
        isDominant,
        category: candidateCategory,
        relevanceScore: Math.min(69, Math.max(45, bestSecondaryMatch.score)),
        classification: 'related',
        rationale,
        websiteUri: candidate.websiteUri,
        mapUrl,
        mainServiceIdentified: candidateMainService,
        matchedTargetService: bestSecondaryMatch.service,
        evidenceConfidence,
        evidenceSourceUrl: candidateEvidence?.evidenceUrl || candidate.websiteUri,
        comparisonReason: `Offers complementary services in ${bestSecondaryMatch.service}.`,
      });
    }
    // Otherwise: Discard completely (unrelated businesses with 0% service overlap are excluded)
  }

  // 5. Sort each group strictly by Google Rating descending, then Review Count descending (Phase 8)
  const sortedDirect = sortCompetitorsByRating(directCandidates).slice(0, limit);
  const sortedRelated = sortCompetitorsByRating(relatedCandidates).slice(0, limit);
  const combined = [...sortedDirect, ...sortedRelated];

  const resultData = {
    directCompetitors: sortedDirect,
    relatedCompetitors: sortedRelated,
    competitors: combined,
    targetServiceProfile: targetProfile,
  };

  // Cache verified result
  competitorCache.set(cacheKey, {
    timestamp: Date.now(),
    data: resultData,
  });

  return resultData;
}
