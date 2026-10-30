import { NextRequest, NextResponse } from 'next/server';
import { parseMapUrl, fetchGooglePlaceData, fetchLocalCompetitors } from '@/lib/google-places';
import { scrapeWebsite } from '@/lib/website-scraper';
import { runLocalSeoAudit } from '@/lib/audit-engine';
import { executeGbpCompleteAudit } from '@/lib/gbp-audit-engine';
import { generateAiRecommendationsV2 } from '@/lib/ai-recommendation-service';
import { AuditResponse } from '@/lib/types';
import { emptySearchConsoleMetrics } from '@/lib/gsc-metrics';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mapUrl, businessName, city, websiteUrl } = body;

    if (!mapUrl && !businessName) {
      return NextResponse.json(
        { error: 'Please enter a Google Maps URL, Place ID, or Business Name to analyze.' },
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
    let queryToSearch = businessName ? `${businessName} ${city || ''}`.trim() : '';
    let extractedPlaceId: string | undefined;

    if (mapUrl) {
      const parsed = await parseMapUrl(mapUrl);
      if (parsed.placeId) {
        extractedPlaceId = parsed.placeId;
      } else if (parsed.queryName) {
        queryToSearch = city ? `${parsed.queryName} ${city}` : parsed.queryName;
      } else if (!queryToSearch) {
        queryToSearch = mapUrl.trim();
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
        { error: `Could not resolve Google Business Profile for "${queryToSearch}". Please check the Google Maps URL or enter the exact business name.` },
        { status: 404 }
      );
    }

    // 3. Resolve Website & City from Place Data
    const targetWebsite = websiteUrl || placeData.websiteUri || '';
    const addressParts = placeData.formattedAddress.split(',');
    const resolvedCity =
      city ||
      (addressParts.length >= 3 ? addressParts[addressParts.length - 3].trim() : 'Local Area');

    // 4. Crawl & Verify Website
    let siteAudit = undefined;
    if (targetWebsite) {
      siteAudit = await scrapeWebsite(
        targetWebsite,
        placeData.nationalPhoneNumber,
        resolvedCity
      );
    }

    // 5. Fetch Real Competitors dynamically from Google Places API
    const competitors = await fetchLocalCompetitors(
      placeData.primaryType || 'Business',
      resolvedCity,
      placeData.id,
      apiKey
    );

    // 6. Run Local SEO Audit & Rules Engine
    const auditEngineResult = runLocalSeoAudit(placeData, siteAudit, competitors);

    // 7. Generate AI Insights & Description Draft
    const aiResult = await generateAiRecommendationsV2(
      placeData,
      siteAudit,
      competitors,
      undefined, // searchConsole — not connected at this point
      auditEngineResult.priorityActions,
      auditEngineResult.missingFields,
      auditEngineResult.inconsistentFields,
    );

    // 8. Complete AI-Powered Google Business Profile Audit
    let gbpCompleteAudit = undefined;
    try {
      gbpCompleteAudit = await executeGbpCompleteAudit(placeData, siteAudit);
    } catch (gbpErr) {
      console.error('Error executing GBP complete audit:', gbpErr);
    }

    // 9. Dynamic Scores Calculation based on real profile signals
    const rating = placeData.rating || 0;
    const reviewCount = placeData.userRatingCount || 0;
    const photosCount = placeData.photosCount || 0;

    // Authority Score (0-100): Weighted formula
    const ratingContribution = (rating / 5) * 40;
    const reviewContribution = Math.min(30, Math.log10(reviewCount + 1) * 15);
    const webContribution = siteAudit?.isHttps ? 15 : targetWebsite ? 8 : 0;
    const photosContribution = Math.min(15, (photosCount / 10) * 15);
    const authorityScore = Math.min(99, Math.round(ratingContribution + reviewContribution + webContribution + photosContribution)) || 40;

    // Dynamic Rank Estimation relative to local competitors
    let calculatedMapsRank = 1;
    if (competitors.length > 0) {
      const betterCompetitors = competitors.filter(c => c.reviews > reviewCount && c.rating >= rating);
      calculatedMapsRank = Math.min(10, 1 + betterCompetitors.length);
    }

    const cat = placeData.primaryType || 'Service';
    const mapsVisibilityPercent = Math.min(
      98,
      Math.max(25, Math.round((11 - calculatedMapsRank) * 10 - 5))
    );

    // 9. Compile Complete Dynamic Audit Response
    const response: AuditResponse = {
      business: {
        name: placeData.displayName,
        city: resolvedCity,
        address: placeData.formattedAddress,
        category: cat,
        phone: placeData.nationalPhoneNumber || 'Not provided',
        websiteUrl: targetWebsite,
        mapUrl: mapUrl || `https://www.google.com/maps/place/?q=place_id:${placeData.id}`,
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
        gbpHealthChange: auditEngineResult.gbpHealth < 60 ? -5 : 5,
        citationHealth: siteAudit?.hasPhoneMatch ? 100 : 70,
        gbpOptimization: Math.round((auditEngineResult.gbpHealth / 100) * 100),
        citationFixes: siteAudit?.hasPhoneMatch ? 100 : 65,
        reviewGrowth: Math.min(100, Math.round((reviewCount / 100) * 100)) || 10,
        keywordRankings: Math.min(98, 70 + calculatedMapsRank * 3),
      },
      searchConsole: emptySearchConsoleMetrics(mapsVisibilityPercent),
      priorityActions: auditEngineResult.priorityActions,
      aiRecommendations: aiResult.recommendations,
      optimizedDescriptionDraft: aiResult.descriptionDraft,
      competitors: competitors,
      missingFields: auditEngineResult.missingFields,
      inconsistentFields: auditEngineResult.inconsistentFields,
      whatNeedsToBeAdded: auditEngineResult.whatNeedsToBeAdded,
      structuredRecommendations: aiResult.structuredRecommendations,
      gbpCompleteAudit,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Audit API error:', error);
    return NextResponse.json(
      { error: 'Internal audit error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
