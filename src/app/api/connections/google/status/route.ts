import { NextRequest, NextResponse } from 'next/server';
import { getGoogleRedirectUri, isGoogleOAuthConfigured } from '@/lib/gsc-config';
import { isGscConnectedWithDb, readSelectedProperty, saveSelectedProperty } from '@/lib/gsc-tokens';
import { getDefaultOrgScope } from '@/lib/db/default-org';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const isConnected = await isGscConnectedWithDb();
  let selectedProperty = readSelectedProperty();

  // If cookie is empty but DB has a selected property, read and restore to cookie
  if (!selectedProperty && isConnected) {
    try {
      const orgScope = await getDefaultOrgScope();
      const savedProp = await prisma.searchConsoleProperty.findFirst({
        where: { organisationId: orgScope.organisationId, isSelected: true },
      });
      if (savedProp) {
        selectedProperty = savedProp.siteUrl;
        saveSelectedProperty(savedProp.siteUrl);
      }
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({
    oauthConfigured: isGoogleOAuthConfigured(),
    connected: isConnected,
    selectedProperty,
    redirectUri: getGoogleRedirectUri(req),
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  });
}
