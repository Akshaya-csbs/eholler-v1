import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/gsc-tokens';
import { listSearchConsoleProperties } from '@/lib/gsc-api';

export async function GET() {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Search Console is not connected. Authorize your Google account first.' },
      { status: 401 }
    );
  }

  try {
    const properties = await listSearchConsoleProperties(accessToken);
    return NextResponse.json({ properties });
  } catch (err: any) {
    const status = err.status === 401 ? 401 : 502;
    return NextResponse.json(
      { error: err.message || 'Could not load Search Console properties.' },
      { status }
    );
  }
}
