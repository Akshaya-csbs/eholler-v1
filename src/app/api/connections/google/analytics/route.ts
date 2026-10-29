import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, readSelectedProperty } from '@/lib/gsc-tokens';
import { fetchSearchAnalytics } from '@/lib/gsc-api';

export async function GET(req: NextRequest) {
  const requestedSite = req.nextUrl.searchParams.get('siteUrl')?.trim();
  const siteUrl = requestedSite || readSelectedProperty();

  if (!siteUrl) {
    return NextResponse.json(
      { error: 'Select a Search Console property before loading performance data.' },
      { status: 400 }
    );
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Search Console is not connected. Authorize your Google account first.' },
      { status: 401 }
    );
  }

  try {
    const analytics = await fetchSearchAnalytics(accessToken, siteUrl);
    return NextResponse.json(analytics);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Could not load Search Console performance data.' },
      { status: err.status === 401 ? 401 : 502 }
    );
  }
}
