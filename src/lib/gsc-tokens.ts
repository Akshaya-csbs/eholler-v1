import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { COOKIE, GOOGLE_TOKEN_URL, isGoogleOAuthConfigured, tokenCookieOptions } from './gsc-config';

const ACCESS_COOKIE_MAX_AGE = 60 * 60;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiryMs: number;
}

function cookieStore() {
  return cookies();
}

function decodeCookieValue(value?: string): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function writeCookie(
  name: string,
  value: string,
  maxAge: number,
  res?: NextResponse
) {
  const options = tokenCookieOptions(maxAge);
  cookieStore().set(name, value, options);
  res?.cookies.set(name, value, options);
}

export function applyTokenCookies(
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  },
  res?: NextResponse
) {
  const expiresIn = Number(tokens.expires_in) > 0 ? Number(tokens.expires_in) : ACCESS_COOKIE_MAX_AGE;
  const expiryMs = Date.now() + expiresIn * 1000;

  writeCookie(COOKIE.access, tokens.access_token, expiresIn, res);
  writeCookie(COOKIE.expiry, String(expiryMs), REFRESH_COOKIE_MAX_AGE, res);

  if (tokens.refresh_token) {
    writeCookie(COOKIE.refresh, tokens.refresh_token, REFRESH_COOKIE_MAX_AGE, res);
  }
}

export function clearGscCookies(res?: NextResponse) {
  writeCookie(COOKIE.access, '', 0, res);
  writeCookie(COOKIE.refresh, '', 0, res);
  writeCookie(COOKIE.expiry, '', 0, res);
  writeCookie(COOKIE.property, '', 0, res);
  writeCookie(COOKIE.state, '', 0, res);
}

export function readStoredTokens(): StoredTokens | null {
  const store = cookieStore();
  const accessToken = store.get(COOKIE.access)?.value;
  if (!accessToken) return null;

  const expiryRaw = store.get(COOKIE.expiry)?.value;
  const expiryMs = expiryRaw ? Number(expiryRaw) : 0;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiryMs: Number.isFinite(expiryMs) ? expiryMs : 0,
  };
}

export function readSelectedProperty(): string | null {
  const raw = cookieStore().get(COOKIE.property)?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function saveSelectedProperty(siteUrl: string) {
  cookieStore().set(
    COOKIE.property,
    encodeURIComponent(siteUrl),
    tokenCookieOptions(REFRESH_COOKIE_MAX_AGE)
  );
}

export function isGscConnected(): boolean {
  const store = cookieStore();
  return Boolean(store.get(COOKIE.access)?.value || store.get(COOKIE.refresh)?.value);
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
} | null> {
  if (!isGoogleOAuthConfigured()) return null;

  try {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300 && response.data?.access_token) {
      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
        refresh_token: response.data.refresh_token,
      };
    }

    console.error('Google token refresh failed with status', response.status);
    return null;
  } catch {
    console.error('Google token refresh request failed');
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const stored = readStoredTokens();
  if (!stored) return null;

  const stillValid = stored.expiryMs - Date.now() > 60_000;
  if (stillValid) return stored.accessToken;

  if (!stored.refreshToken) {
    return stored.accessToken || null;
  }

  const refreshed = await refreshAccessToken(stored.refreshToken);
  if (!refreshed) return null;

  applyTokenCookies({
    access_token: refreshed.access_token,
    expires_in: refreshed.expires_in,
    refresh_token: refreshed.refresh_token || stored.refreshToken,
  });


  return refreshed.access_token;
}
