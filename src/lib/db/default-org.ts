import { prisma } from '@/lib/prisma';
import { createOrgScope, OrgScope } from '@/lib/db/org-context';

const PRIMARY_WORKSPACE_SLUG = 'primary-workspace';
const PRIMARY_WORKSPACE_NAME = 'Primary Workspace';

/**
 * Resolves or initializes the single workspace organisation for the application.
 * All businesses, audits, and connections are scoped to this workspace.
 */
export async function getOrCreateDefaultOrganisation() {
  // Check for primary workspace first, then legacy default-org
  let org = await prisma.organisation.findFirst({
    where: {
      OR: [{ slug: PRIMARY_WORKSPACE_SLUG }, { slug: 'default-org' }],
    },
  });

  if (!org) {
    org = await prisma.organisation.create({
      data: {
        name: PRIMARY_WORKSPACE_NAME,
        slug: PRIMARY_WORKSPACE_SLUG,
      },
    });
  }

  return org;
}

/**
 * Returns a scoped data-isolation context for the primary workspace.
 */
export async function getDefaultOrgScope(): Promise<OrgScope> {
  const org = await getOrCreateDefaultOrganisation();
  return createOrgScope(org.id);
}

/**
 * Resolves the organisation scope for an API request.
 * If an explicit x-organisation-id header is provided, it validates ownership.
 * Otherwise, uses the single primary workspace.
 */
export async function resolveOrgScope(organisationId?: string | null): Promise<OrgScope> {
  if (organisationId) {
    const org = await prisma.organisation.findUnique({
      where: { id: organisationId },
    });
    if (org) {
      return createOrgScope(org.id);
    }
  }

  return getDefaultOrgScope();
}
