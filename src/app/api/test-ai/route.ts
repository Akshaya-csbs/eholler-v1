import { NextRequest, NextResponse } from 'next/server';
import { generateStructuredRecommendations } from '@/lib/ai-recommendation-service';
import { classifyOpenAIError } from '@/lib/openai-client';

/**
 * GET /api/test-ai
 *
 * A small integration test that sends a sample SEO audit finding to OpenAI
 * and returns one structured recommendation. Used for verifying the API key
 * works and the full pipeline is healthy.
 *
 * NOT intended for production use — restrict or remove before deploying.
 */
export async function GET(req: NextRequest) {
  // Quick key check
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: 'OPENAI_API_KEY is not configured in .env.local',
        category: 'configuration',
      },
      { status: 503 }
    );
  }

  try {
    const result = await generateStructuredRecommendations({
      auditFindings: [
        {
          id: 'test-desc',
          title: 'Missing Business Description',
          field: 'description',
          status: 'missing',
          score: 0,
          severity: 'high',
          currentValue: 'Empty / Not provided on Google Business Profile',
          recommendedValue:
            'Comprehensive 750-character bio highlighting services and local service areas',
          explanation:
            'Google uses the business description to understand relevancy for local discovery queries.',
        },
      ],
      business: {
        name: 'eholler Test Business',
        city: 'Dublin',
        address: '123 Test Street, Dublin, Ireland',
        category: 'Web Development',
        phone: '+353 1 234 5678',
        websiteUrl: 'https://example.com',
        rating: 4.5,
        reviewCount: 42,
      },
      missingFields: ['Business Description'],
      inconsistentFields: [],
    });

    // Return only the first recommendation as a sanity check
    return NextResponse.json({
      success: true,
      message: 'OpenAI integration is working correctly.',
      modelUsed: result.modelUsed,
      generatedAt: result.generatedAt,
      totalRecommendations: result.recommendations.length,
      sampleRecommendation: result.recommendations[0] || null,
      descriptionDraftPreview: result.descriptionDraft
        ? result.descriptionDraft.slice(0, 150) + '...'
        : null,
    });
  } catch (err: any) {
    const classified = classifyOpenAIError(err.originalError || err);
    return NextResponse.json(
      {
        success: false,
        error: classified.message,
        category: classified.category,
        retryable: classified.retryable,
      },
      { status: classified.category === 'authentication' ? 401 : 500 }
    );
  }
}

