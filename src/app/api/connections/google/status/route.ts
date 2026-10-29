import { NextRequest, NextResponse } from 'next/server';
import { getGoogleRedirectUri, isGoogleOAuthConfigured } from '@/lib/gsc-config';
import { isGscConnected, readSelectedProperty } from '@/lib/gsc-tokens';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    oauthConfigured: isGoogleOAuthConfigured(),
    connected: isGscConnected(),
    selectedProperty: readSelectedProperty(),
    redirectUri: getGoogleRedirectUri(req),
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  });
}
