import axios from 'axios';
import { GooglePlaceData, CompetitorItem } from './types';

/**
 * Resolves short Google Maps URLs, share URLs, and extracts place query or Place ID
 */
export async function parseMapUrl(
  rawUrl: string
): Promise<{ queryName?: string; placeId?: string; resolvedUrl: string }> {
  let resolvedUrl = rawUrl.trim();

  // 1. Direct Place ID detection (e.g. ChIJ... or standard 20+ char identifier)
  if (/^ChIJ[a-zA-Z0-9_-]{10,}$/.test(resolvedUrl) || (/^[a-zA-Z0-9_-]{24,}$/.test(resolvedUrl) && !resolvedUrl.includes('/') && !resolvedUrl.includes('.'))) {
    return { placeId: resolvedUrl, resolvedUrl };
  }

  // 2. Follow short link redirects (maps.app.goo.gl, goo.gl/maps)
  if (resolvedUrl.includes('maps.app.goo.gl') || resolvedUrl.includes('goo.gl/maps')) {
    try {
      const resp = await axios.get(resolvedUrl, {
        maxRedirects: 5,
        timeout: 6000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });
      resolvedUrl = resp.request?.res?.responseUrl || resolvedUrl;
    } catch (err: any) {
      console.warn('Failed to expand short map URL:', err.message);
    }
  }

  // 3. Check for explicit place_id in query params: ?q=place_id:ChIJ... or ?query_place_id=...
  const placeIdParam = resolvedUrl.match(/place_id:([a-zA-Z0-9_-]+)/i) || resolvedUrl.match(/[?&]query_place_id=([a-zA-Z0-9_-]+)/i);
  if (placeIdParam) {
    return { placeId: placeIdParam[1], resolvedUrl };
  }

  // 4. Extract place name from path: /maps/place/Business+Name/@...
  const placeMatch = resolvedUrl.match(/\/maps\/place\/([^\/@?]+)/i);
  if (placeMatch) {
    const rawName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    return { queryName: rawName, resolvedUrl };
  }

  // 5. Extract search query from ?q=...
  const qMatch = resolvedUrl.match(/[?&]q=([^&]+)/i);
  if (qMatch) {
    const rawQ = decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
    return { queryName: rawQ, resolvedUrl };
  }

  // 6. Extract search query from /maps/search/...
  const searchMatch = resolvedUrl.match(/\/maps\/search\/([^\/@?]+)/i);
  if (searchMatch) {
    const rawSearch = decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));
    return { queryName: rawSearch, resolvedUrl };
  }

  return { resolvedUrl };
}

const FULL_FIELD_MASK =
  'id,displayName,formattedAddress,addressComponents,location,websiteUri,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,primaryType,primaryTypeDisplayName,types,editorialSummary,regularOpeningHours,businessStatus,accessibilityOptions,paymentOptions,parkingOptions,photos';

/**
 * Fetches Google Place details using the Places API (New)
 */
export async function fetchGooglePlaceData(
  searchQuery: string,
  apiKey: string,
  specificPlaceId?: string
): Promise<GooglePlaceData | null> {
  try {
    if (specificPlaceId) {
      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FULL_FIELD_MASK,
      };
      const url = `https://places.googleapis.com/v1/places/${specificPlaceId}`;
      const res = await axios.get(url, { headers, timeout: 8000 });
      return formatPlace(res.data);
    }

    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const searchFieldMask = FULL_FIELD_MASK
      .split(',')
      .map((f) => `places.${f}`)
      .join(',');

    const searchHeaders = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': searchFieldMask,
    };
    const body = { textQuery: searchQuery, maxResultCount: 1 };
    const res = await axios.post(searchUrl, body, { headers: searchHeaders, timeout: 8000 });

    const place = res.data.places?.[0];
    if (!place) return null;

    return formatPlace(place);
  } catch (error: any) {
    console.error('Google Places API Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Searches and returns up to 5 candidates for identity confirmation
 */
export async function fetchGooglePlaceCandidates(
  searchQuery: string,
  apiKey: string,
  specificPlaceId?: string,
  maxResults = 5
): Promise<GooglePlaceData[]> {
  try {
    if (specificPlaceId) {
      const single = await fetchGooglePlaceData(searchQuery, apiKey, specificPlaceId);
      return single ? [single] : [];
    }

    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const searchFieldMask = FULL_FIELD_MASK
      .split(',')
      .map((f) => `places.${f}`)
      .join(',');

    const searchHeaders = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': searchFieldMask,
    };
    const body = { textQuery: searchQuery, maxResultCount: maxResults };
    const res = await axios.post(searchUrl, body, { headers: searchHeaders, timeout: 8000 });

    const places = res.data.places || [];
    return places.map(formatPlace);
  } catch (error: any) {
    console.error('Google Places Search Candidates Error:', error.response?.data || error.message);
    return [];
  }
}

function formatPlace(place: any): GooglePlaceData {
  return {
    id: place.id || '',
    displayName: place.displayName?.text || '',
    formattedAddress: place.formattedAddress || '',
    nationalPhoneNumber: place.nationalPhoneNumber || '',
    internationalPhoneNumber: place.internationalPhoneNumber || '',
    rating: place.rating || 0,
    userRatingCount: place.userRatingCount || 0,
    websiteUri: place.websiteUri || '',
    primaryType: place.primaryTypeDisplayName?.text || place.primaryType || 'Business',
    primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
    types: place.types || [],
    location: place.location
      ? {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        }
      : undefined,
    addressComponents: place.addressComponents || [],
    businessStatus: place.businessStatus || 'OPERATIONAL',
    editorialSummary: place.editorialSummary?.text || '',
    photosCount: place.photos?.length || 0,
    accessibilityOptions: place.accessibilityOptions,
    paymentOptions: place.paymentOptions,
    parkingOptions: place.parkingOptions,
    openingHours: {
      openNow: place.regularOpeningHours?.openNow,
      weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions || [],
      periods: place.regularOpeningHours?.periods,
    },
  };
}

import { identifyLocalCompetitors } from './competitor-service';

/**
 * Discovers local competitors in the same category & city
 * (Delegates to the targeted, scored competitor-service)
 */
export async function fetchLocalCompetitors(
  category: string,
  city: string,
  currentPlaceId: string,
  apiKey: string
): Promise<CompetitorItem[]> {
  try {
    const minimalPlace: GooglePlaceData = {
      id: currentPlaceId,
      displayName: '',
      formattedAddress: '',
      primaryType: category,
      primaryTypeDisplayName: category,
    };
    const res = await identifyLocalCompetitors({
      placeData: minimalPlace,
      city,
      apiKey,
      limit: 4,
    });
    return res.competitors;
  } catch (err: any) {
    console.warn('Failed to fetch competitors:', err.message);
    return [];
  }
}
