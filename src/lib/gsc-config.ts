import { NextRequest } from 'next/server';

export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const GSC_CALLBACK_PATH = '/api/connections/google/callback';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GSC_SITES_URL = 'https://www.googleapis.com/webmasters/v3/sites';

export const COOKIE = {
  state: 'gsc_oauth_state',
  access: 'gsc_access_token',
  refresh: 'gsc_refresh_token',
  expiry: 'gsc_token_expiry',
  property: 'gsc_selected_property',
} as const;

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Canonical OAuth redirect URI used for both the authorization request and
 * the token exchange. Must match the URI registered in Google Cloud Console.
 */
export function getGoogleRedirectUri(req?: NextRequest): string {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;

  if (req) {
    return `${req.nextUrl.origin}${GSC_CALLBACK_PATH}`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (appUrl) return `${appUrl}${GSC_CALLBACK_PATH}`;

  return `http://localhost:3000${GSC_CALLBACK_PATH}`;
}

export function tokenCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
