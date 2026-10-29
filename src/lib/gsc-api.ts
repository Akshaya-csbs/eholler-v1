import axios from 'axios';
import { GSC_SITES_URL } from './gsc-config';
import { GscAnalyticsResult, GscProperty, GscQueryRow } from './types';

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function sanitizeGscError(status: number, data: unknown): string {
  const message =
    data && typeof data === 'object' && 'error' in data
      ? (data as { error?: { message?: string; status?: string } }).error?.message
      : undefined;

  if (status === 401 || status === 403) {
    return message || 'Google denied access to Search Console. Reconnect your account and confirm the property is verified.';
  }
  if (status === 404) {
    return 'The selected Search Console property was not found. Choose another property.';
  }
  if (status >= 500) {
    return 'Google Search Console is temporarily unavailable. Try again in a few minutes.';
  }
  return message || 'Search Console request failed.';
}

export async function listSearchConsoleProperties(accessToken: string): Promise<GscProperty[]> {
  const response = await axios.get(GSC_SITES_URL, {
    headers: authHeaders(accessToken),
    timeout: 20000,
    validateStatus: () => true,
  });

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error(sanitizeGscError(response.status, response.data)), {
      status: 401,
    });
  }

  if (response.status < 200 || response.status >= 300) {
    throw Object.assign(new Error(sanitizeGscError(response.status, response.data)), {
      status: response.status,
    });
  }

  const entries = Array.isArray(response.data?.siteEntry) ? response.data.siteEntry : [];
  return entries
    .map((entry: { siteUrl?: string; permissionLevel?: string }) => ({
      siteUrl: String(entry.siteUrl || ''),
      permissionLevel: String(entry.permissionLevel || 'unknown'),
    }))
    .filter((entry: GscProperty) => entry.siteUrl);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string
): Promise<GscAnalyticsResult> {
  const { startDate, endDate } = defaultDateRange();
  const endpoint = `${GSC_SITES_URL}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const [totalsRes, queriesRes] = await Promise.all([
    axios.post(
      endpoint,
      { startDate, endDate, rowLimit: 1 },
      { headers: authHeaders(accessToken), timeout: 25000, validateStatus: () => true }
    ),
    axios.post(
      endpoint,
      { startDate, endDate, dimensions: ['query'], rowLimit: 25, startRow: 0 },
      { headers: authHeaders(accessToken), timeout: 25000, validateStatus: () => true }
    ),
  ]);

  const failed = [totalsRes, queriesRes].find((r) => r.status < 200 || r.status >= 300);
  if (failed) {
    throw Object.assign(new Error(sanitizeGscError(failed.status, failed.data)), {
      status: failed.status === 403 ? 401 : failed.status,
    });
  }

  const totalRow = Array.isArray(totalsRes.data?.rows) ? totalsRes.data.rows[0] : null;
  const clicks = typeof totalRow?.clicks === 'number' ? totalRow.clicks : 0;
  const impressions = typeof totalRow?.impressions === 'number' ? totalRow.impressions : 0;
  const ctr = typeof totalRow?.ctr === 'number' ? totalRow.ctr : 0;
  const averagePosition = typeof totalRow?.position === 'number' ? totalRow.position : 0;

  const queryRows: GscQueryRow[] = Array.isArray(queriesRes.data?.rows)
    ? queriesRes.data.rows.map((row: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }) => ({
        query: row.keys?.[0] || '(not provided)',
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        ctr: Number(row.ctr) || 0,
        position: Number(row.position) || 0,
      }))
    : [];

  return {
    siteUrl,
    startDate,
    endDate,
    clicks,
    impressions,
    ctr,
    averagePosition,
    rowCount: queryRows.length,
    queries: queryRows,
  };
}
