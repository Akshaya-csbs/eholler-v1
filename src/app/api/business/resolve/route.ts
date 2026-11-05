import { NextRequest, NextResponse } from 'next/server';
import { parseMapUrl, fetchGooglePlaceCandidates, fetchGooglePlaceData } from '@/lib/google-places';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mapUrl, websiteUrl, businessName, city, placeId } = body;

    const trimmedMap = (mapUrl || '').trim();
    const trimmedName = (businessName || '').trim();
    const trimmedCity = (city || '').trim();
    const trimmedPlaceId = (placeId || '').trim();
    const trimmedWeb = (websiteUrl || '').trim();

    if (!trimmedMap && !trimmedName && !trimmedPlaceId) {
      return NextResponse.json(
        {
          error:
            'Please provide a Google Maps URL, Google Place ID, or Business Name to resolve.',
        },
        { status: 400 }
      );
    }

    if (trimmedWeb) {
      // Basic URL format validation
      if (!/^https?:\/\//i.test(trimmedWeb) && !/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmedWeb)) {
        return NextResponse.json(
          { error: 'Please enter a valid website URL (e.g. https://example.com).' },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key is not configured on the server.' },
        { status: 500 }
      );
    }

    let resolvedPlaceId: string | undefined = trimmedPlaceId || undefined;
    let queryToSearch = trimmedName ? `${trimmedName} ${trimmedCity}`.trim() : '';

    if (trimmedMap) {
      const parsed = await parseMapUrl(trimmedMap);
      if (parsed.placeId) {
        resolvedPlaceId = parsed.placeId;
      } else if (parsed.queryName) {
        queryToSearch = trimmedCity ? `${parsed.queryName} ${trimmedCity}` : parsed.queryName;
      } else if (!queryToSearch) {
        queryToSearch = trimmedMap;
      }
    }

    if (!resolvedPlaceId && !queryToSearch) {
      return NextResponse.json(
        {
          error:
            'Unable to extract a valid Place ID or business query from the input. Please enter a direct Google Maps link or exact business name.',
        },
        { status: 400 }
      );
    }

    // If we have an exact Place ID, fetch it directly
    if (resolvedPlaceId) {
      const place = await fetchGooglePlaceData('', apiKey, resolvedPlaceId);
      if (!place) {
        return NextResponse.json(
          {
            error: `No Google Business Profile found for Place ID "${resolvedPlaceId}". Please verify the Place ID or Google Maps URL.`,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        status: 'exact_match',
        candidate: place,
        candidates: [place],
      });
    }

    // Search for candidates
    const candidates = await fetchGooglePlaceCandidates(queryToSearch, apiKey, undefined, 5);

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error: `No Google Business Profile found for "${queryToSearch}". Try pasting the exact Google Maps URL or adding your city to the search.`,
        },
        { status: 404 }
      );
    }

    if (candidates.length === 1) {
      return NextResponse.json({
        status: 'exact_match',
        candidate: candidates[0],
        candidates,
      });
    }

    return NextResponse.json({
      status: 'multiple_candidates',
      candidate: candidates[0],
      candidates,
    });
  } catch (err: any) {
    console.error('Business resolution error:', err);
    return NextResponse.json(
      { error: 'Failed to resolve business: ' + (err.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

