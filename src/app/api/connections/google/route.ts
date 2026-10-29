import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  COOKIE,
  GOOGLE_AUTH_URL,
  GSC_READONLY_SCOPE,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured,
  tokenCookieOptions,
} from '@/lib/gsc-config';

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    const home = new URL('/', req.nextUrl.origin);
    home.searchParams.set('gsc_error', 'oauth_not_configured');
    return NextResponse.redirect(home);
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = getGoogleRedirectUri(req);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GSC_READONLY_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  const res = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  res.cookies.set(COOKIE.state, state, tokenCookieOptions(600));
  return res;
}
