import axios from 'axios';
import { GooglePlaceData, CompetitorItem } from './types';

/**
 * Resolves short Google Maps URLs (maps.app.goo.gl) and extracts place query/id
 */
export async function parseMapUrl(rawUrl: string): Promise<{ queryName?: string; placeId?: string; resolvedUrl: string }> {
  let resolvedUrl = rawUrl.trim();

  // 1. Follow short link redirects if needed
  if (resolvedUrl.includes('maps.app.goo.gl') || resolvedUrl.includes('goo.gl/maps')) {
    try {
      const resp = await axios.get(resolvedUrl, {
        maxRedirects: 5,
        timeout: 5000,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      resolvedUrl = resp.request.res.responseUrl || resolvedUrl;
    } catch (err) {
      console.warn('Failed to expand short map URL:', err.message);
    }
  }

  // 2. Check for explicit place_id in query params: ?q=place_id:ChIJ...
  const placeIdParam = resolvedUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
  if (placeIdParam) {
    return { placeId: placeIdParam[1], resolvedUrl };
  }

  // 3. Extract place name from path: /maps/place/Pentagon+Quality+Management+Consultants/@...
  const placeMatch = resolvedUrl.match(/\/maps\/place\/([^\/@?]+)/);
  if (placeMatch) {
    const rawName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    return { queryName: rawName, resolvedUrl };
  }

  // 4. Extract search query from ?q=...
  const qMatch = resolvedUrl.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    const rawQ = decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
    return { queryName: rawQ, resolvedUrl };
  }

  return { resolvedUrl };
}

/**
 * Fetches Google Place details using the Places API (New)
 */
export async function fetchGooglePlaceData(
  searchQuery: string,
  apiKey: string,
  specificPlaceId?: string
): Promise<GooglePlaceData | null> {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,rating,userRatingCount,primaryTypeDisplayName,editorialSummary,regularOpeningHours,photos',
    };

    const fieldMask =
      'id,displayName,formattedAddress,addressComponents,location,websiteUri,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,primaryType,primaryTypeDisplayName,types,editorialSummary,regularOpeningHours,businessStatus,accessibilityOptions,paymentOptions,parkingOptions,photos';

    if (specificPlaceId) {
      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      };
      const url = `https://places.googleapis.com/v1/places/${specificPlaceId}`;
      const res = await axios.get(url, { headers, timeout: 8000 });
      return formatPlace(res.data);
    }

    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const searchFieldMask = fieldMask
      .split(',')
      .map((f) => `places.${f}`)
      .join(',');

    const searchHeaders = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': searchFieldMask,
    };
    const body = { textQuery: searchQuery };
    const res = await axios.post(searchUrl, body, { headers: searchHeaders, timeout: 8000 });

    const place = res.data.places?.[0];
    if (!place) return null;

    return formatPlace(place);
  } catch (error) {
    console.error('Google Places API Error:', error.response?.data || error.message);
    return null;
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

/**
 * Discovers local competitors in the same category & city
 */
export async function fetchLocalCompetitors(
  category: string,
  city: string,
  currentPlaceId: string,
  apiKey: string
): Promise<CompetitorItem[]> {
  try {
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const body = {
      textQuery: `${category} in ${city}`,
      maxResultCount: 6,
    };

    const res = await axios.post(searchUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress',
      },
      timeout: 8000,
    });

    const places = res.data.places || [];
    return places
      .filter((p: any) => p.id !== currentPlaceId)
      .slice(0, 4)
      .map((p: any) => ({
        id: p.id,
        name: p.displayName?.text || 'Local Competitor',
        rating: p.rating || 0,
        reviews: p.userRatingCount || 0,
        address: p.formattedAddress || '',
        isDominant: (p.userRatingCount || 0) > 300,
      }));
  } catch (err) {
    console.warn('Failed to fetch competitors:', err.message);
    return [];
  }
}
