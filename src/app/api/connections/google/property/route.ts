import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, isGscConnected, saveSelectedProperty } from '@/lib/gsc-tokens';
import { listSearchConsoleProperties } from '@/lib/gsc-api';

export async function POST(req: NextRequest) {
  if (!isGscConnected()) {
    return NextResponse.json(
      { error: 'Google Search Console is not connected.' },
      { status: 401 }
    );
  }

  let siteUrl = '';
  try {
    const body = await req.json();
    siteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Request body must include siteUrl.' }, { status: 400 });
  }

  if (!siteUrl) {
    return NextResponse.json({ error: 'Select a Search Console property.' }, { status: 400 });
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Search Console session expired. Reconnect your account.' },
      { status: 401 }
    );
  }

  try {
    const properties = await listSearchConsoleProperties(accessToken);
    const match = properties.find((property) => property.siteUrl === siteUrl);
    if (!match) {
      return NextResponse.json(
        { error: 'That property is not accessible on the connected Google account.' },
        { status: 403 }
      );
    }

    saveSelectedProperty(match.siteUrl);
    return NextResponse.json({ selectedProperty: match.siteUrl });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Could not save the selected property.' },
      { status: err.status === 401 ? 401 : 502 }
    );
  }
}
