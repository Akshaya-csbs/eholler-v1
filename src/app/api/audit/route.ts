import { NextRequest, NextResponse } from 'next/server';
import { parseMapUrl, fetchGooglePlaceData, fetchLocalCompetitors } from '@/lib/google-places';
import { identifyLocalCompetitors } from '@/lib/competitor-service';
import { scrapeWebsite } from '@/lib/website-scraper';
import { runLocalSeoAudit } from '@/lib/audit-engine';
import { executeGbpCompleteAudit, buildBusinessUnderstanding, evaluateAllGbpFields } from '@/lib/gbp-audit-engine';
import { generateAiRecommendationsV2 } from '@/lib/ai-recommendation-service';
import { AuditResponse, AuditFinding, StructuredRecommendation, CompetitorItem } from '@/lib/types';
import { emptySearchConsoleMetrics } from '@/lib/gsc-metrics';
import { resolveOrgScope } from '@/lib/db/default-org';
import {
  AuditStatus,
  GBPFieldStatus,
  RecommendationCategory,
  SeverityLevel,
  EffortLevel,
  SourceType,
} from '@prisma/client';

/**
 * Maps a stored AuditRun (with business, fieldAudits, aiRecommendations, snapshots)
 * back to the frontend AuditResponse structure.
 */
function mapAuditRunToResponse(auditRun: any): AuditResponse {
  const biz = auditRun.business;
  const rating = biz.rating ?? 0;
  const reviewCount = biz.reviewCount ?? 0;
  const authorityScore = auditRun.authorityScore ?? 50;
  const mapsRank = auditRun.mapsRank ?? 1;
  const gbpHealth = auditRun.gbpHealthScore ?? 70;
  const mapsVisibilityPercent = Math.min(98, Math.max(25, Math.round((11 - mapsRank) * 10 - 5)));

  // Extract raw website snapshot if captured
  const webSnapshot = auditRun.snapshots?.find((s: any) => s.sourceType === 'WEBSITE');
  const websiteAudit = webSnapshot?.rawData || undefined;

  const structuredRecommendations: StructuredRecommendation[] = (auditRun.aiRecommendations || []).map(
    (r: any) => ({
      issueTitle: r.issueTitle,
      category:
        (r.category.toLowerCase().replace(/_/g, '_') as StructuredRecommendation['category']) ||
        'local_seo_priority',
      evidence: r.evidence,
      severity: (r.severity.toLowerCase() as StructuredRecommendation['severity']) || 'medium',
      explanation: r.explanation,
      recommendedAction: r.recommendedAction,
      suggestedContent: r.suggestedContent || undefined,
      estimatedEffort: (r.estimatedEffort.toLowerCase() as StructuredRecommendation['estimatedEffort']) || 'moderate',
    })
  );

  const aiRecommendations = structuredRecommendations.map((r) => r.issueTitle);

  const priorityActions: AuditFinding[] = (auditRun.aiRecommendations || []).map(
    (r: any, idx: number) => ({
      id: `pa-${r.id || idx}`,
      title: r.issueTitle,
      field: r.category.toLowerCase().replace(/_/g, ' '),
      status: r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'missing' : 'needs_improvement',
      score: r.severity === 'CRITICAL' ? 30 : r.severity === 'HIGH' ? 50 : 75,
      severity: (r.severity.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
      currentValue: 'Needs verification/update',
      recommendedValue: r.recommendedAction,
      explanation: r.explanation,
    })
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Reconstruct GBP field audit
  // Self-healing: when fieldAudits is empty (failed/legacy audit), recover by
  // re-running the deterministic engine against stored source snapshots.
  // ─────────────────────────────────────────────────────────────────────────
  let gbpCompleteAudit = undefined;

  if (auditRun.fieldAudits && auditRun.fieldAudits.length > 0) {
    // Normal path: use persisted GBPFieldAudit records
    const fields = auditRun.fieldAudits.map((f: any) => ({
      field_id: f.fieldId,
      field_name: f.fieldName,
      category: f.category,
      section_title: f.category.replace(/_/g, ' ').toUpperCase(),
      current_value: f.currentValue || '',
      expected_value_or_requirement: f.whyItMatters || '',
      status: (f.status.replace(/_/g, ' ') as any) || 'UNABLE TO VERIFY',
      why_it_matters: f.whyItMatters || '',
      recommendation: f.action || '',
      recommended_content: f.recommendedContent || '',
      evidence_source: 'Google Places & Website Audit',
      confidence: (f.confidence as any) || 'Medium',
      applicable: f.applicable,
      verifiable: f.verifiable,
    }));

    const noChangesRequiredCount = fields.filter(
      (f: any) => f.status === 'OPTIMIZED' || f.status === 'NO CHANGES REQUIRED'
    ).length;
    const missingCount = fields.filter((f: any) => f.status === 'MISSING').length;
    const needsImprovementCount = fields.filter(
      (f: any) => f.status === 'NEEDS REVIEW' || f.status === 'NEEDS IMPROVEMENT'
    ).length;
    const unableToVerifyCount = fields.filter((f: any) => f.status === 'UNABLE TO VERIFY').length;

    gbpCompleteAudit = {
      auditMode: 'public_maps_and_website' as const,
      gbpConnected: false,
      business: {
        name: biz.name,
        category: biz.category || 'Business',
        location: biz.formattedAddress || biz.city || '',
        websiteUrl: biz.websiteUrl || '',
        mapUrl: biz.mapUrl || '',
        placeId: biz.placeId || '',
        lastAuditedAt: auditRun.completedAt
          ? new Date(auditRun.completedAt).toISOString()
          : new Date().toISOString(),
      },
      understanding: {
        summary: auditRun.summary || `Local business profile for ${biz.name}`,
        industryAndNiche: biz.category || 'Local Business',
        primaryCategory: biz.category || 'Business',
        secondaryCategories: [],
        mainServices: [],
        secondaryServices: [],
        detectedProducts: [],
        physicalLocation: biz.formattedAddress || biz.city || '',
        serviceAreas: [],
        targetCustomers: 'Local Customers',
        uniqueSellingPoints: [],
        operatingHoursSummary: 'Standard Business Hours',
        contactSummary: biz.phone || 'Phone',
        relevantSearchKeywords: [],
        crossCheckNotes: [],
      },
      completenessScore:
        auditRun.completenessScore ?? Math.round((noChangesRequiredCount / (fields.length || 1)) * 100),
      totalAuditedFields: fields.length,
      noChangesRequiredCount,
      missingCount,
      needsImprovementCount,
      unableToVerifyCount,
      fields,
      recommendedContentBySection: [],
    };
  } else {
    // ─────────────────────────────────────────────────────────────────────
    // SELF-HEALING PATH: fieldAudits is empty (crashed or legacy audit run).
    // Recover by re-running the deterministic GBP engine against the stored
    // GOOGLE_PLACES and WEBSITE source snapshots (no AI, no network).
    // ─────────────────────────────────────────────────────────────────────
    const placesSnap = auditRun.snapshots?.find((s: any) => s.sourceType === 'GOOGLE_PLACES');
    const recoveredPlace = placesSnap?.rawData;

    if (recoveredPlace && recoveredPlace.id) {
      try {
        const understanding = buildBusinessUnderstanding(recoveredPlace, websiteAudit);
        const recoveredFields = evaluateAllGbpFields(recoveredPlace, websiteAudit, understanding);

        const noChangesRequired = recoveredFields.filter(f => f.status === 'NO CHANGES REQUIRED').length;
        const missing = recoveredFields.filter(f => f.status === 'MISSING').length;
        const needsImprovement = recoveredFields.filter(f => f.status === 'NEEDS IMPROVEMENT').length;
        const unableToVerify = recoveredFields.filter(f => f.status === 'UNABLE TO VERIFY').length;

        const applicableVerifiable = recoveredFields.filter(f => f.applicable && f.verifiable);
        const recoveredCompleteness = applicableVerifiable.length > 0
          ? Math.round((applicableVerifiable.filter(f => f.status === 'NO CHANGES REQUIRED').length / applicableVerifiable.length) * 100)
          : 50;

        gbpCompleteAudit = {
          auditMode: 'public_maps_and_website' as const,
          gbpConnected: false,
          business: {
            name: recoveredPlace.displayName || biz.name,
            category: understanding.primaryCategory,
            location: recoveredPlace.formattedAddress || biz.formattedAddress || biz.city || '',
            websiteUrl: websiteAudit?.url || recoveredPlace.websiteUri || biz.websiteUrl || '',
            mapUrl: biz.mapUrl || `https://www.google.com/maps/place/?q=place_id:${recoveredPlace.id}`,
            placeId: recoveredPlace.id || biz.placeId || '',
            lastAuditedAt: auditRun.completedAt
              ? new Date(auditRun.completedAt).toISOString()
              : new Date().toISOString(),
          },
          understanding,
          completenessScore: recoveredCompleteness,
          totalAuditedFields: recoveredFields.length,
          noChangesRequiredCount: noChangesRequired,
          missingCount: missing,
          needsImprovementCount: needsImprovement,
          unableToVerifyCount: unableToVerify,
          fields: recoveredFields,
          recommendedContentBySection: [],
        };
      } catch (recoveryErr: any) {
        console.error('[GBP Self-Healing] Recovery failed:', recoveryErr?.message || recoveryErr);
        // gbpCompleteAudit remains undefined — UI will show diagnostic state
      }
    }
  }

  const placesMeta = (auditRun.snapshots?.find((s: any) => s.sourceType === 'GOOGLE_PLACES')?.metadata as any) || {};

  // Filter out legacy bogus competitor entries with generic stopword rationales or excluded classification
  const isBogusCompetitor = (c: any) => {
    if (!c) return true;
    if (c.classification === 'excluded') return true;
    const r = (c.rationale || '').toLowerCase();
    if (
      r.includes('shared business types') ||
      r.includes('matching service "services"') ||
      r.includes('provides matching service "services"')
    ) {
      return true;
    }
    return false;
  };

  const rawCompetitors: CompetitorItem[] = (placesMeta.competitors || []).filter((c: any) => !isBogusCompetitor(c));
  const directCompetitors: CompetitorItem[] = (
    placesMeta.directCompetitors || rawCompetitors.filter((c: any) => c.classification === 'direct')
  ).filter((c: any) => !isBogusCompetitor(c));
  const relatedCompetitors: CompetitorItem[] = (
    placesMeta.relatedCompetitors || rawCompetitors.filter((c: any) => c.classification === 'related')
  ).filter((c: any) => !isBogusCompetitor(c));
  const competitors: CompetitorItem[] = [...directCompetitors, ...relatedCompetitors];
  const targetServiceProfile = placesMeta.targetServiceProfile || undefined;

  const missingFields = (auditRun.fieldAudits || [])
    .filter((f: any) => f.status === 'MISSING')
    .map((f: any) => f.fieldName);

  const inconsistentFields = (auditRun.fieldAudits || [])
    .filter((f: any) => f.status === 'INCONSISTENT')
    .map((f: any) => f.fieldName);

  return {
    business: {
      name: biz.name,
      city: biz.city || '',
      address: biz.formattedAddress || '',
      category: biz.category || 'Business',
      phone: biz.phone || 'Not provided',
      websiteUrl: biz.websiteUrl || '',
      mapUrl: biz.mapUrl || (biz.placeId ? `https://www.google.com/maps/place/?q=place_id:${biz.placeId}` : ''),
      placeId: biz.placeId || '',
      rating,
      reviewCount,
      updatedAt: new Date(biz.updatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    },
    scores: {
      authorityScore,
      mapsRank,
      gbpHealth,
      gbpHealthChange: 0,
      citationHealth: inconsistentFields.length === 0 ? 100 : 70,
      gbpOptimization: Math.round((gbpHealth / 100) * 100),
      citationFixes: inconsistentFields.length === 0 ? 100 : 65,
      reviewGrowth: Math.min(100, Math.round((reviewCount / 100) * 100)) || 10,
      keywordRankings: 0,
    },
    searchConsole: emptySearchConsoleMetrics(mapsVisibilityPercent),
    priorityActions,
    aiRecommendations,
    optimizedDescriptionDraft: '',
    competitors,
    directCompetitors,
    relatedCompetitors,
    targetServiceProfile,
    missingFields,
    inconsistentFields,
    whatNeedsToBeAdded: missingFields,
    structuredRecommendations,
    gbpCompleteAudit,
    websiteAudit,
    auditRunId: auditRun.id,
  };
}

/**
 * GET /api/audit
 * Retrieves:
 * 1. An audit history list if ?list=true
 * 2. Specific audit by ?auditId=...
 * 3. Latest completed audit for the workspace
 */
export async function GET(req: NextRequest) {
  try {
    const orgIdHeader = req.headers.get('x-organisation-id');
    const orgScope = await resolveOrgScope(orgIdHeader);

    const { searchParams } = new URL(req.url);
    const auditId = searchParams.get('auditId');
    const businessId = searchParams.get('businessId');
    const isList = searchParams.get('list') === 'true';

    if (isList) {
      const runs = await orgScope.listAuditRuns(businessId || undefined, 20);
      return NextResponse.json({
        audits: runs.map((a) => ({
          id: a.id,
          businessId: a.businessId,
          businessName: a.business.name,
          city: a.business.city,
          category: a.business.category,
          status: a.status,
          authorityScore: a.authorityScore,
          mapsRank: a.mapsRank,
          gbpHealthScore: a.gbpHealthScore,
          createdAt: a.createdAt,
          completedAt: a.completedAt,
        })),
      });
    }

    let audit = null;
    if (auditId) {
      audit = await orgScope.getAuditRunById(auditId);
    } else {
      audit = await orgScope.getLatestCompletedAudit(businessId || undefined);
    }

    if (!audit) {
      return NextResponse.json({ audit: null }, { status: 200 });
    }

    const response = mapAuditRunToResponse(audit);
    return NextResponse.json({ audit: response }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching audit from database:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved audit: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit
 * Executes a full local SEO audit and records all stages, external source snapshots,
 * GBP field evaluations, and AI recommendations into PostgreSQL.
 */
export async function POST(req: NextRequest) {
  let createdAuditRunId: string | null = null;
  let activeOrgScope: any = null;

  try {
    const body = await req.json();
    const { mapUrl, businessName, city, websiteUrl, placeId } = body;

    const trimmedMap = (mapUrl || '').trim();
    const trimmedName = (businessName || '').trim();
    const trimmedCity = (city || '').trim();
    const trimmedWeb = (websiteUrl || '').trim();
    const trimmedPlaceId = (placeId || '').trim();

    if (!trimmedMap && !trimmedName && !trimmedPlaceId) {
      return NextResponse.json(
        { error: 'Please enter a Google Maps URL, Place ID, or Business Name to analyze.' },
        { status: 400 }
      );
    }

    if (!trimmedWeb) {
      return NextResponse.json(
        { error: 'Business website URL is required for the Local SEO and NAP audit.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_MAPS_API_KEY is not configured in .env.local' },
        { status: 500 }
      );
    }

    // 1. Resolve Map URL or Query
    let queryToSearch = trimmedName ? `${trimmedName} ${trimmedCity}`.trim() : '';
    let extractedPlaceId: string | undefined = trimmedPlaceId || undefined;

    if (trimmedMap) {
      const parsed = await parseMapUrl(trimmedMap);
      if (parsed.placeId) {
        extractedPlaceId = parsed.placeId;
      } else if (parsed.queryName) {
        queryToSearch = trimmedCity ? `${parsed.queryName} ${trimmedCity}` : parsed.queryName;
      } else if (!queryToSearch) {
        queryToSearch = trimmedMap;
      }
    }

    if (!queryToSearch && !extractedPlaceId) {
      return NextResponse.json(
        { error: 'Could not extract a valid business query or Place ID from the provided URL.' },
        { status: 400 }
      );
    }

    // 2. Fetch Google Place Details
    const placeData = await fetchGooglePlaceData(queryToSearch, apiKey, extractedPlaceId);
    if (!placeData) {
      return NextResponse.json(
        {
          error: `Could not resolve Google Business Profile for "${queryToSearch}". Please check the Google Maps URL or enter the exact business name.`,
        },
        { status: 404 }
      );
    }

    // 3. Resolve Website & City from Place Data
    const targetWebsite = trimmedWeb || placeData.websiteUri || '';
    const addressParts = placeData.formattedAddress.split(',');
    const resolvedCity =
      trimmedCity ||
      (addressParts.length >= 3 ? addressParts[addressParts.length - 3].trim() : 'Local Area');
    const cat = placeData.primaryType || 'Service';
    const rating = placeData.rating || 0;
    const reviewCount = placeData.userRatingCount || 0;
    const photosCount = placeData.photosCount || 0;

    // 4. Resolve Organisation Scope and Persist/Upsert Business
    const orgIdHeader = req.headers.get('x-organisation-id');
    activeOrgScope = await resolveOrgScope(orgIdHeader);

    const savedBusiness = await activeOrgScope.upsertBusiness({
      name: placeData.displayName,
      placeId: placeData.id,
      formattedAddress: placeData.formattedAddress,
      city: resolvedCity,
      category: cat,
      phone: placeData.nationalPhoneNumber,
      websiteUrl: targetWebsite,
      mapUrl: trimmedMap || `https://www.google.com/maps/place/?q=place_id:${placeData.id}`,
      rating,
      reviewCount,
    });

    // 5. Create initial AuditRun record with RUNNING status in PostgreSQL
    const auditRun = await activeOrgScope.startAuditRun(savedBusiness.id);
    createdAuditRunId = auditRun.id;

    // 7. Crawl & Verify Website
    let siteAudit = undefined;
    if (targetWebsite) {
      siteAudit = await scrapeWebsite(
        targetWebsite,
        placeData.nationalPhoneNumber,
        resolvedCity,
        placeData.displayName
      );

      // Save Website SourceSnapshot
      await activeOrgScope.saveSourceSnapshot(
        auditRun.id,
        savedBusiness.id,
        SourceType.WEBSITE,
        siteAudit,
        {
          targetUrl: targetWebsite,
          crawledAt: new Date().toISOString(),
        }
      );
    }

    // 8. Identify Real Local Competitors using service-first business understanding
    const competitorResult = await identifyLocalCompetitors({
      placeData,
      siteAudit,
      city: resolvedCity,
      apiKey,
      limit: 10,
      forceFresh: true,
    });

    const competitors = competitorResult.competitors;
    const directCompetitors = competitorResult.directCompetitors;
    const relatedCompetitors = competitorResult.relatedCompetitors;
    const targetServiceProfile = competitorResult.targetServiceProfile;

    // Save Google Places & Verified Competitors SourceSnapshot
    await activeOrgScope.saveSourceSnapshot(
      auditRun.id,
      savedBusiness.id,
      SourceType.GOOGLE_PLACES,
      placeData,
      {
        query: queryToSearch,
        placeId: placeData.id,
        capturedAt: new Date().toISOString(),
        competitors,
        directCompetitors,
        relatedCompetitors,
        targetServiceProfile,
      }
    );

    // 9. Run Local SEO Audit & Rules Engine
    const auditEngineResult = runLocalSeoAudit(placeData, siteAudit, competitors);

    // 10. Generate AI Insights & Description Draft
    const aiResult = await generateAiRecommendationsV2(
      placeData,
      siteAudit,
      competitors,
      undefined, // searchConsole
      auditEngineResult.priorityActions,
      auditEngineResult.missingFields,
      auditEngineResult.inconsistentFields
    );

    // 11. Complete AI-Powered Google Business Profile Audit (Mode A: Public Maps + Website)
    let gbpCompleteAudit = undefined;
    try {
      gbpCompleteAudit = await executeGbpCompleteAudit(placeData, siteAudit, false);
    } catch (gbpErr: any) {
      console.error('[GBP Audit] executeGbpCompleteAudit failed:', gbpErr?.message || gbpErr);
      // Log but do NOT abort the full audit — the response will show a diagnostic state
    }

    // 12. Dynamic Scores Calculation based on real profile signals
    const ratingContribution = (rating / 5) * 40;
    const reviewContribution = Math.min(30, Math.log10(reviewCount + 1) * 15);
    const webContribution = siteAudit?.isHttps ? 15 : targetWebsite ? 8 : 0;
    const photosContribution = Math.min(15, (photosCount / 10) * 15);
    const authorityScore =
      Math.min(99, Math.round(ratingContribution + reviewContribution + webContribution + photosContribution)) || 40;

    let calculatedMapsRank = 1;
    if (competitors.length > 0) {
      const betterCompetitors = competitors.filter(
        (c) => c.reviews > reviewCount && c.rating >= rating
      );
      calculatedMapsRank = Math.min(10, 1 + betterCompetitors.length);
    }

    const mapsVisibilityPercent = Math.min(
      98,
      Math.max(25, Math.round((11 - calculatedMapsRank) * 10 - 5))
    );

    // 13. Map Field Audits to persist in PostgreSQL
    const fieldAuditsToSave = gbpCompleteAudit?.fields?.slice(0, 60).map((f) => ({
      fieldId: f.field_id,
      fieldName: f.field_name,
      category: f.category,
      status: (f.status.replace(/\s+/g, '_') as GBPFieldStatus) || GBPFieldStatus.UNABLE_TO_VERIFY,
      currentValue: f.current_value || undefined,
      recommendedContent: f.recommended_content || undefined,
      whyItMatters: f.why_it_matters || undefined,
      action: f.recommendation || undefined,
      confidence: f.confidence,
      applicable: f.applicable,
      verifiable: f.verifiable,
    }));

    // 14. Map AI Recommendations to persist in PostgreSQL (with DRAFT status)
    const aiRecsToSave = aiResult.structuredRecommendations?.map((r) => ({
      issueTitle: r.issueTitle,
      category:
        (r.category.toUpperCase().replace(/\s+/g, '_') as RecommendationCategory) ||
        RecommendationCategory.LOCAL_SEO_PRIORITY,
      evidence: r.evidence,
      severity: (r.severity.toUpperCase() as SeverityLevel) || SeverityLevel.MEDIUM,
      explanation: r.explanation,
      recommendedAction: r.recommendedAction,
      suggestedContent: r.suggestedContent,
      estimatedEffort: (r.estimatedEffort.toUpperCase() as EffortLevel) || EffortLevel.MODERATE,
    }));

    // 15. Transition AuditRun status to COMPLETED with relational records in PostgreSQL
    await activeOrgScope.completeAuditRun(auditRun.id, {
      authorityScore,
      mapsRank: calculatedMapsRank,
      gbpHealthScore: auditEngineResult.gbpHealth,
      completenessScore: gbpCompleteAudit?.completenessScore,
      missingFieldsCount: auditEngineResult.missingFields.length,
      inconsistentFieldsCount: auditEngineResult.inconsistentFields.length,
      summary: `Audit completed for ${placeData.displayName}`,
      fieldAudits: fieldAuditsToSave,
      aiRecommendations: aiRecsToSave,
    });

    // 16. Compile Complete Dynamic Audit Response
    const response: AuditResponse = {
      business: {
        name: placeData.displayName,
        city: resolvedCity,
        address: placeData.formattedAddress,
        category: cat,
        phone: placeData.nationalPhoneNumber || 'Not provided',
        websiteUrl: targetWebsite,
        mapUrl: trimmedMap || `https://www.google.com/maps/place/?q=place_id:${placeData.id}`,
        placeId: placeData.id,
        rating: rating,
        reviewCount: reviewCount,
        updatedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      },
      scores: {
        authorityScore: authorityScore,
        mapsRank: calculatedMapsRank,
        gbpHealth: auditEngineResult.gbpHealth,
        gbpHealthChange: 0,
        citationHealth: siteAudit?.hasPhoneMatch ? 100 : 70,
        gbpOptimization: Math.round((auditEngineResult.gbpHealth / 100) * 100),
        citationFixes: siteAudit?.hasPhoneMatch ? 100 : 65,
        reviewGrowth: Math.min(100, Math.round((reviewCount / 100) * 100)) || 10,
        keywordRankings: 0,
      },
      searchConsole: emptySearchConsoleMetrics(mapsVisibilityPercent),
      priorityActions: auditEngineResult.priorityActions,
      aiRecommendations: aiResult.recommendations,
      optimizedDescriptionDraft: aiResult.descriptionDraft,
      competitors,
      directCompetitors,
      relatedCompetitors,
      targetServiceProfile,
      missingFields: auditEngineResult.missingFields,
      inconsistentFields: auditEngineResult.inconsistentFields,
      whatNeedsToBeAdded: auditEngineResult.whatNeedsToBeAdded,
      structuredRecommendations: aiResult.structuredRecommendations,
      gbpCompleteAudit,
      websiteAudit: siteAudit,
      auditRunId: auditRun.id,
      aiError: aiResult.aiError,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Audit API error:', error);

    // If an AuditRun record was created, record the failure state in PostgreSQL
    if (createdAuditRunId && activeOrgScope) {
      try {
        await activeOrgScope.failAuditRun(
          createdAuditRunId,
          error?.message || 'Unexpected error during audit execution'
        );
      } catch (failErr) {
        console.error('Failed to update audit run to FAILED status:', failErr);
      }
    }

    return NextResponse.json(
      { error: 'Internal audit error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
