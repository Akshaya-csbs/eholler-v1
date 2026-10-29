import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import axios from 'axios';
import {
  COOKIE,
  GOOGLE_TOKEN_URL,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured,
  tokenCookieOptions,
} from '@/lib/gsc-config';
import { applyTokenCookies, clearGscCookies } from '@/lib/gsc-tokens';
import { cookies } from 'next/headers';

function safeEqual(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function redirectHome(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/', req.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(req: NextRequest) {
  const fail = (code: string) => {
    cookies().set(COOKIE.state, '', tokenCookieOptions(0));
    return NextResponse.redirect(redirectHome(req, { gsc_error: code }));
  };

  if (!isGoogleOAuthConfigured()) {
    return fail('oauth_not_configured');
  }

  const googleError = req.nextUrl.searchParams.get('error');
  if (googleError) {
    if (googleError === 'access_denied') return fail('access_denied');
    return fail('google_oauth_error');
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = req.cookies.get(COOKIE.state)?.value || cookies().get(COOKIE.state)?.value;

  if (!code) return fail('missing_code');
  if (!safeEqual(state, expectedState)) return fail('invalid_state');

  try {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: getGoogleRedirectUri(req),
      grant_type: 'authorization_code',
    });

    const tokenRes = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (tokenRes.status < 200 || tokenRes.status >= 300 || !tokenRes.data?.access_token) {
      console.error('Google authorization code exchange failed with status', tokenRes.status);
      return fail('token_exchange_failed');
    }

    const success = NextResponse.redirect(redirectHome(req, { gsc: 'connected' }));
    applyTokenCookies(
      {
        access_token: tokenRes.data.access_token,
        refresh_token: tokenRes.data.refresh_token,
        expires_in: tokenRes.data.expires_in,
      },
      success
    );
    success.cookies.set(COOKIE.state, '', tokenCookieOptions(0));
    return success;
  } catch {
    console.error('Google OAuth callback failed');
    const failure = NextResponse.redirect(redirectHome(req, { gsc_error: 'token_exchange_failed' }));
    clearGscCookies(failure);
    return failure;
  }
}
