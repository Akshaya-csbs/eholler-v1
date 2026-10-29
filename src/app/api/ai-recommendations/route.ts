import { NextRequest, NextResponse } from 'next/server';
import { generateStructuredRecommendations } from '@/lib/ai-recommendation-service';
import { classifyOpenAIError } from '@/lib/openai-client';
import { AIRecommendationRequest } from '@/lib/types';

// ── Simple in-memory rate limiter ───────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;   // max requests per window per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodically clean up stale entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, 300_000);
}

// ── Input Validation ────────────────────────────────────────────────
const MAX_AUDIT_FINDINGS = 25;
const MAX_COMPETITORS = 10;
const MAX_STRING_LENGTH = 2000;
const MAX_BODY_SIZE = 50_000; // ~50 KB

function truncateStr(val: unknown, maxLen = MAX_STRING_LENGTH): string {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

function validateRequestBody(body: any): {
  valid: boolean;
  error?: string;
  data?: AIRecommendationRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  // Business info
  if (!body.business || typeof body.business !== 'object') {
    return { valid: false, error: 'Missing required "business" object in request body.' };
  }

  const biz = body.business;
  if (!biz.name || typeof biz.name !== 'string' || biz.name.trim().length === 0) {
    return { valid: false, error: 'business.name is required and must be a non-empty string.' };
  }

  // Audit findings
  if (!Array.isArray(body.auditFindings)) {
    return { valid: false, error: '"auditFindings" must be an array.' };
  }

  if (body.auditFindings.length > MAX_AUDIT_FINDINGS) {
    return {
      valid: false,
      error: `Too many audit findings (${body.auditFindings.length}). Maximum is ${MAX_AUDIT_FINDINGS}.`,
    };
  }

  // Build validated request
  const data: AIRecommendationRequest = {
    auditFindings: body.auditFindings.slice(0, MAX_AUDIT_FINDINGS).map((f: any) => ({
      id: truncateStr(f.id, 100),
      title: truncateStr(f.title),
      field: truncateStr(f.field, 100),
      status: ['missing', 'inconsistent', 'optimized', 'needs_improvement'].includes(f.status)
        ? f.status
        : 'needs_improvement',
      score: typeof f.score === 'number' ? Math.max(0, Math.min(100, f.score)) : 0,
      severity: ['high', 'medium', 'low'].includes(f.severity) ? f.severity : 'medium',
      currentValue: truncateStr(f.currentValue),
      recommendedValue: truncateStr(f.recommendedValue),
      explanation: truncateStr(f.explanation),
    })),
    business: {
      name: truncateStr(biz.name, 200),
      city: truncateStr(biz.city, 200),
      address: truncateStr(biz.address, 500),
      category: truncateStr(biz.category, 200),
      phone: truncateStr(biz.phone, 50),
      websiteUrl: truncateStr(biz.websiteUrl, 500),
      rating: typeof biz.rating === 'number' ? biz.rating : 0,
      reviewCount: typeof biz.reviewCount === 'number' ? biz.reviewCount : 0,
    },
    websiteAudit: body.websiteAudit
      ? {
          url: truncateStr(body.websiteAudit.url, 500),
          isHttps: !!body.websiteAudit.isHttps,
          title: truncateStr(body.websiteAudit.title),
          metaDescription: truncateStr(body.websiteAudit.metaDescription),
          hasPhoneMatch: !!body.websiteAudit.hasPhoneMatch,
          hasAddressMatch: !!body.websiteAudit.hasAddressMatch,
          hasLocalBusinessSchema: !!body.websiteAudit.hasLocalBusinessSchema,
          loadTimeMs: typeof body.websiteAudit.loadTimeMs === 'number'
            ? body.websiteAudit.loadTimeMs
            : undefined,
        }
      : undefined,
    competitors: Array.isArray(body.competitors)
      ? body.competitors.slice(0, MAX_COMPETITORS).map((c: any) => ({
          id: truncateStr(c.id, 100),
          name: truncateStr(c.name, 200),
          rating: typeof c.rating === 'number' ? c.rating : 0,
          reviews: typeof c.reviews === 'number' ? c.reviews : 0,
        }))
      : undefined,
    searchConsole: body.searchConsole
      ? {
          connected: !!body.searchConsole.connected,
          selectedProperty:
            typeof body.searchConsole.selectedProperty === 'string'
              ? body.searchConsole.selectedProperty
              : null,
          clicks: typeof body.searchConsole.clicks === 'number' ? body.searchConsole.clicks : null,
          impressions:
            typeof body.searchConsole.impressions === 'number' ? body.searchConsole.impressions : null,
          ctr: typeof body.searchConsole.ctr === 'number' ? body.searchConsole.ctr : null,
          averagePosition:
            typeof body.searchConsole.averagePosition === 'number'
              ? body.searchConsole.averagePosition
              : null,
          dateRange: body.searchConsole.dateRange?.startDate
            ? {
                startDate: String(body.searchConsole.dateRange.startDate),
                endDate: String(body.searchConsole.dateRange.endDate || ''),
              }
            : null,
          organicTraffic: typeof body.searchConsole.organicTraffic === 'number'
            ? body.searchConsole.organicTraffic
            : 0,
          organicKeywordsCount: typeof body.searchConsole.organicKeywordsCount === 'number'
            ? body.searchConsole.organicKeywordsCount
            : 0,
          mapsVisibilityPercent: typeof body.searchConsole.mapsVisibilityPercent === 'number'
            ? body.searchConsole.mapsVisibilityPercent
            : 0,
          top10KeywordsCount: typeof body.searchConsole.top10KeywordsCount === 'number'
            ? body.searchConsole.top10KeywordsCount
            : 0,
          trafficTrend: [],
          keywords: Array.isArray(body.searchConsole.keywords)
            ? body.searchConsole.keywords.slice(0, 20).map((kw: any) => ({
                query: truncateStr(kw.query, 200),
                clicks: typeof kw.clicks === 'number' ? kw.clicks : 0,
                impressions: typeof kw.impressions === 'number' ? kw.impressions : 0,
                ctr: typeof kw.ctr === 'number' ? kw.ctr : 0,
                position: typeof kw.position === 'number' ? kw.position : 0,
              }))
            : [],
        }
      : undefined,
    missingFields: Array.isArray(body.missingFields)
      ? body.missingFields.slice(0, 20).map((f: any) => truncateStr(f, 300))
      : undefined,
    inconsistentFields: Array.isArray(body.inconsistentFields)
      ? body.inconsistentFields.slice(0, 20).map((f: any) => truncateStr(f, 300))
      : undefined,
  };

  return { valid: true, data };
}

// ── Route Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please wait a moment before making another request.',
        category: 'rate_limit',
        retryable: true,
      },
      { status: 429 }
    );
  }

  try {
    // Parse and size-check body
    const rawText = await req.text();
    if (rawText.length > MAX_BODY_SIZE) {
      return NextResponse.json(
        {
          error: `Request body too large (${rawText.length} bytes). Maximum is ${MAX_BODY_SIZE} bytes.`,
          category: 'validation',
          retryable: false,
        },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body.', category: 'validation', retryable: false },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateRequestBody(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error, category: 'validation', retryable: false },
        { status: 400 }
      );
    }

    // Check API key availability before attempting the call
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the server.',
          category: 'configuration',
          retryable: false,
        },
        { status: 503 }
      );
    }

    // Generate recommendations
    const result = await generateStructuredRecommendations(validation.data);

    return NextResponse.json(result);
  } catch (err: any) {
    // Use classified error info if available
    const category = err.category || 'unknown';
    const retryable = err.retryable ?? true;
    const message = err.message || 'An unexpected error occurred.';

    // Determine HTTP status from category
    const statusMap: Record<string, number> = {
      authentication: 401,
      permissions: 403,
      rate_limit: 429,
      billing: 402,
      configuration: 503,
      openai_server_error: 502,
      network: 502,
    };

    const status = statusMap[category] || 500;

    return NextResponse.json(
      { error: message, category, retryable },
      { status }
    );
  }
}

