import { NextResponse } from 'next/server';
import { clearGscCookies } from '@/lib/gsc-tokens';
import { getDefaultOrgScope } from '@/lib/db/default-org';

export async function POST() {
  clearGscCookies();
  try {
    const orgScope = await getDefaultOrgScope();
    await orgScope.disconnectGoogle();
  } catch (err) {
    console.warn('Could not revoke Google connection in database (non-fatal):', err);
  }
  return NextResponse.json({ connected: false });
}
