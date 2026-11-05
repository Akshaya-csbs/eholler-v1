import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/gsc-tokens';
import { listSearchConsoleProperties, findMatchingProperty } from '@/lib/gsc-api';
import { getDefaultOrgScope } from '@/lib/db/default-org';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Search Console is not connected. Authorize your Google account first.' },
      { status: 401 }
    );
  }

  try {
    const properties = await listSearchConsoleProperties(accessToken);
    const websiteUrl = req.nextUrl.searchParams.get('websiteUrl')?.trim() || undefined;
    const match = findMatchingProperty(properties, websiteUrl);

    // Sync properties into PostgreSQL for the workspace
    try {
      const orgScope = await getDefaultOrgScope();
      const conn = await orgScope.getGoogleConnection();
      if (conn) {
        for (const prop of properties) {
          await prisma.searchConsoleProperty.upsert({
            where: {
              organisationId_siteUrl: {
                organisationId: conn.organisationId,
                siteUrl: prop.siteUrl,
              },
            },
            create: {
              organisationId: conn.organisationId,
              googleConnectionId: conn.id,
              siteUrl: prop.siteUrl,
              permissionLevel: prop.permissionLevel,
              isSelected: false,
            },
            update: {
              permissionLevel: prop.permissionLevel,
            },
          });
        }
      }
    } catch (syncErr) {
      console.warn('Could not sync GSC properties to database (non-fatal):', syncErr);
    }

    return NextResponse.json({
      properties,
      recommendedProperty: match?.siteUrl || null,
    });
  } catch (err: any) {
    const status = err.status === 401 ? 401 : 502;
    return NextResponse.json(
      { error: err.message || 'Could not load Search Console properties.' },
      { status }
    );
  }
}
