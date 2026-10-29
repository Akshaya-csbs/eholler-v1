import { getOpenAIClient, classifyOpenAIError } from './openai-client';
import {
  AuditFinding,
  GooglePlaceData,
  WebsiteAuditData,
  CompetitorItem,
  SearchConsoleMetrics,
  StructuredRecommendation,
  AIRecommendationRequest,
  AIRecommendationResponse,
} from './types';

// ── Constants ───────────────────────────────────────────────────────
const MODEL = 'gpt-4o-mini';
const MAX_PROMPT_CHARS = 12_000; // guard against accidentally huge payloads
const VALID_CATEGORIES = new Set([
  'missing_seo_field',
  'inconsistent_info',
  'incomplete_description',
  'missing_meta',
  'content_optimization',
  'search_console',
  'local_seo_priority',
]);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_EFFORTS = new Set(['quick_win', 'moderate', 'significant']);

// ── Prompt Builder ──────────────────────────────────────────────────

function buildPrompt(req: AIRecommendationRequest): string {
  const parts: string[] = [];

  parts.push('You are an expert Local SEO consultant. Analyze the audit findings below and generate structured recommendations.');
  parts.push('');
  parts.push('RULES:');
  parts.push('- Ground every recommendation in the supplied data. Do NOT invent traffic numbers, rankings, reviews, business details, or any data not provided.');
  parts.push('- If information is missing or unavailable, explicitly state that it could not be verified.');
  parts.push('- All recommendations are DRAFTS — do not instruct the user to publish, modify, or send anything automatically.');
  parts.push('- Do NOT calculate SEO scores or analytics; those are computed deterministically by our backend.');
  parts.push('- Focus on actionable, specific recommendations the user can review and approve.');
  parts.push('');

  // Business context
  parts.push('=== BUSINESS PROFILE ===');
  parts.push(`Name: ${req.business.name}`);
  parts.push(`Category: ${req.business.category}`);
  parts.push(`City: ${req.business.city}`);
  parts.push(`Address: ${req.business.address}`);
  parts.push(`Phone: ${req.business.phone}`);
  parts.push(`Website: ${req.business.websiteUrl || 'Not provided'}`);
  parts.push(`Rating: ${req.business.rating}★ (${req.business.reviewCount} reviews)`);
  parts.push('');

  // Audit findings
  if (req.auditFindings.length > 0) {
    parts.push('=== AUDIT FINDINGS ===');
    for (const f of req.auditFindings) {
      parts.push(`- [${f.severity.toUpperCase()}] ${f.title}: ${f.explanation} (Current: "${f.currentValue}", Recommended: "${f.recommendedValue}")`);
    }
    parts.push('');
  }

  // Website audit
  if (req.websiteAudit) {
    parts.push('=== WEBSITE AUDIT ===');
    parts.push(`URL: ${req.websiteAudit.url}`);
    parts.push(`HTTPS: ${req.websiteAudit.isHttps}`);
    parts.push(`Title tag: ${req.websiteAudit.title || 'Not found'}`);
    parts.push(`Meta description: ${req.websiteAudit.metaDescription || 'Not found'}`);
    parts.push(`Phone on page: ${req.websiteAudit.hasPhoneMatch}`);
    parts.push(`City/Address on page: ${req.websiteAudit.hasAddressMatch}`);
    parts.push(`LocalBusiness schema: ${req.websiteAudit.hasLocalBusinessSchema}`);
    if (req.websiteAudit.loadTimeMs != null) {
      parts.push(`Load time: ${req.websiteAudit.loadTimeMs}ms`);
    }
    parts.push('');
  }

  // Missing / inconsistent fields
  if (req.missingFields && req.missingFields.length > 0) {
    parts.push('=== MISSING PROFILE FIELDS ===');
    for (const f of req.missingFields) parts.push(`- ${f}`);
    parts.push('');
  }
  if (req.inconsistentFields && req.inconsistentFields.length > 0) {
    parts.push('=== INCONSISTENT FIELDS ===');
    for (const f of req.inconsistentFields) parts.push(`- ${f}`);
    parts.push('');
  }

  // Competitors
  if (req.competitors && req.competitors.length > 0) {
    parts.push('=== COMPETITOR LANDSCAPE ===');
    for (const c of req.competitors) {
      parts.push(`- ${c.name}: ${c.rating}★, ${c.reviews} reviews`);
    }
    parts.push('');
  }

  // Search Console data (only when real data is connected)
  if (req.searchConsole && req.searchConsole.connected) {
    parts.push('=== SEARCH CONSOLE DATA (REAL) ===');
    parts.push(`Organic Traffic (last 30 days): ${req.searchConsole.organicTraffic}`);
    parts.push(`Top 10 Keywords: ${req.searchConsole.top10KeywordsCount}`);
    if (req.searchConsole.keywords.length > 0) {
      parts.push('Top Queries:');
      for (const kw of req.searchConsole.keywords.slice(0, 10)) {
        parts.push(`  "${kw.query}" — ${kw.clicks} clicks, ${kw.impressions} impressions, position ${kw.position}`);
      }
    }
    parts.push('');
  } else {
    parts.push('NOTE: Search Console is NOT connected. Do NOT reference any organic traffic or keyword ranking numbers. State that Search Console data was not available if relevant.');
    parts.push('');
  }

  parts.push('=== OUTPUT FORMAT ===');
  parts.push('Return a JSON object with exactly two keys:');
  parts.push('1. "recommendations": an array of 4–8 recommendation objects, each with:');
  parts.push('   - "issueTitle": concise title of the issue');
  parts.push('   - "category": one of "missing_seo_field", "inconsistent_info", "incomplete_description", "missing_meta", "content_optimization", "search_console", "local_seo_priority"');
  parts.push('   - "evidence": the specific audit finding or data point this is based on');
  parts.push('   - "severity": one of "critical", "high", "medium", "low"');
  parts.push('   - "explanation": why this matters for local SEO');
  parts.push('   - "recommendedAction": specific step-by-step action the user should take');
  parts.push('   - "suggestedContent": draft text the user can review and approve (or null if not applicable)');
  parts.push('   - "estimatedEffort": one of "quick_win", "moderate", "significant"');
  parts.push('2. "descriptionDraft": a compelling 750-character Google Business Profile description optimized with local keywords for this business.');
  parts.push('');
  parts.push('Sort recommendations by severity: critical first, then high, medium, low.');

  const prompt = parts.join('\n');
  return prompt.slice(0, MAX_PROMPT_CHARS);
}

// ── Output Validation ───────────────────────────────────────────────

function validateRecommendation(rec: any): StructuredRecommendation | null {
  if (!rec || typeof rec !== 'object') return null;
  if (!rec.issueTitle || typeof rec.issueTitle !== 'string') return null;
  if (!rec.explanation || typeof rec.explanation !== 'string') return null;
  if (!rec.recommendedAction || typeof rec.recommendedAction !== 'string') return null;

  // Normalise and clamp category
  const category = VALID_CATEGORIES.has(rec.category) ? rec.category : 'local_seo_priority';
  const severity = VALID_SEVERITIES.has(rec.severity) ? rec.severity : 'medium';
  const effort = VALID_EFFORTS.has(rec.estimatedEffort) ? rec.estimatedEffort : 'moderate';

  return {
    issueTitle: String(rec.issueTitle).slice(0, 200),
    category,
    evidence: String(rec.evidence || 'Based on audit data').slice(0, 500),
    severity,
    explanation: String(rec.explanation).slice(0, 800),
    recommendedAction: String(rec.recommendedAction).slice(0, 800),
    suggestedContent: rec.suggestedContent ? String(rec.suggestedContent).slice(0, 2000) : undefined,
    estimatedEffort: effort,
  };
}

function validateAndCleanOutput(raw: any): {
  recommendations: StructuredRecommendation[];
  descriptionDraft: string;
} {
  const recs: StructuredRecommendation[] = [];

  if (Array.isArray(raw?.recommendations)) {
    for (const r of raw.recommendations) {
      const validated = validateRecommendation(r);
      if (validated) recs.push(validated);
    }
  }

  const descriptionDraft =
    typeof raw?.descriptionDraft === 'string' && raw.descriptionDraft.length > 10
      ? raw.descriptionDraft.slice(0, 800)
      : '';

  return { recommendations: recs, descriptionDraft };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generates structured AI recommendations from audit findings using the
 * OpenAI official SDK (chat completions with JSON mode). Returns validated,
 * grounded recommendations — never invented data.
 *
 * Uses the Responses API when available, falling back to Chat Completions.
 * Throws a classified error when the API call fails.
 */
export async function generateStructuredRecommendations(
  req: AIRecommendationRequest
): Promise<AIRecommendationResponse> {
  const client = getOpenAIClient();
  const prompt = buildPrompt(req);

  try {
    // Use Chat Completions API with JSON mode (broadly available across all tiers)
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a Local SEO analysis engine. Return only valid JSON — no markdown fencing, no commentary.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 3000,
    });

    const outputText = response.choices?.[0]?.message?.content || '';

    if (!outputText) {
      throw new Error('Empty response from OpenAI model');
    }

    const parsed = JSON.parse(outputText);
    const validated = validateAndCleanOutput(parsed);

    if (validated.recommendations.length === 0) {
      throw new Error('Model returned no valid recommendations');
    }

    return {
      recommendations: validated.recommendations,
      descriptionDraft: validated.descriptionDraft,
      generatedAt: new Date().toISOString(),
      modelUsed: MODEL,
    };
  } catch (err) {
    // Log the raw error details for debugging (never exposes API key)
    if (err && typeof err === 'object') {
      const e = err as any;
      console.error('OpenAI API Error Details:', {
        status: e.status,
        message: e.message,
        type: e.type,
        code: e.code,
        headers: e.headers ? Object.fromEntries(
          ['x-ratelimit-limit-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-requests', 'x-ratelimit-remaining-tokens', 'x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens', 'retry-after']
            .filter(h => e.headers?.[h] != null)
            .map(h => [h, e.headers[h]])
        ) : undefined,
      });
    }
    // Re-throw with classification so the route handler can respond safely
    const classified = classifyOpenAIError(err);
    const error = new Error(classified.message) as any;
    error.category = classified.category;
    error.retryable = classified.retryable;
    error.originalError = err;
    throw error;
  }
}

// ── Legacy-compatible wrapper ───────────────────────────────────────

/**
 * Drop-in replacement for the old generateAiRecommendations function.
 * Falls back to defaults if the API key is missing or the call fails.
 * Used by the existing /api/audit route.
 */
export async function generateAiRecommendationsV2(
  place: GooglePlaceData,
  siteAudit?: WebsiteAuditData,
  competitors: CompetitorItem[] = [],
  searchConsole?: SearchConsoleMetrics,
  auditFindings: AuditFinding[] = [],
  missingFields: string[] = [],
  inconsistentFields: string[] = [],
): Promise<{
  recommendations: string[];
  descriptionDraft: string;
  structuredRecommendations?: StructuredRecommendation[];
}> {
  const bizName = place.displayName || 'Business';
  const category = place.primaryType || 'Consultant';
  const city = place.formattedAddress?.split(',')?.slice(-4, -2)?.join(', ') || 'Local Region';
  const website = place.websiteUri || siteAudit?.url || '';
  const reviewCount = place.userRatingCount || 0;
  const rating = place.rating || 0;

  // Fallback defaults (preserved from original code)
  const defaultRecommendations = [
    `Launch an automated review collection campaign targeting existing and past clients to aggressively grow review volume from ${reviewCount} toward at least 150+ high-quality Google reviews.`,
    website.startsWith('http://') || !siteAudit?.isHttps
      ? `Upgrade the website security by installing an SSL certificate and redirecting all traffic from HTTP to secure HTTPS ('${website.replace('http://', 'https://')}').`
      : `Implement LocalBusiness JSON-LD Schema markup on ${website} to reinforce Name, Address, and Phone (NAP) parity for Google search crawlers.`,
    `Post weekly updates on the Google Business Profile featuring case studies, ${category} tips, and recent client outcomes to boost local engagement metrics.`,
    `Optimize Google Business Profile secondary categories and expand service catalog with specific service deliverables.`,
  ];

  const defaultDescription = `${bizName} is a premier ${category} dedicated to serving clients across ${city} and neighboring areas. We offer high-quality ${category} services, customer-first support, and dependable results (${rating}★ rating from ${reviewCount} client reviews). Our team is committed to excellence, transparent communication, and tailored solutions. Contact us today or visit our location in ${city} for inquiries or to schedule an appointment.`;

  if (!process.env.OPENAI_API_KEY) {
    return {
      recommendations: defaultRecommendations,
      descriptionDraft: defaultDescription,
    };
  }

  try {
    const result = await generateStructuredRecommendations({
      auditFindings,
      business: {
        name: bizName,
        city,
        address: place.formattedAddress || '',
        category,
        phone: place.nationalPhoneNumber || 'Not provided',
        websiteUrl: website,
        rating,
        reviewCount,
      },
      websiteAudit: siteAudit,
      competitors,
      searchConsole,
      missingFields,
      inconsistentFields,
    });

    // Return both the legacy flat list AND the new structured recs
    return {
      recommendations: result.recommendations.map(
        (r) => `[${r.severity.toUpperCase()}] ${r.issueTitle}: ${r.recommendedAction}`
      ),
      descriptionDraft: result.descriptionDraft || defaultDescription,
      structuredRecommendations: result.recommendations,
    };
  } catch (err: any) {
    console.warn('OpenAI structured recommendations failed, using fallback:', err.message);
    return {
      recommendations: defaultRecommendations,
      descriptionDraft: defaultDescription,
    };
  }
}

