import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateDefaultOrganisation } from '@/lib/db/default-org';
import { OrgRole } from '@prisma/client';

export interface SyncedUser {
  id: string;
  clerkId?: string | null;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  organisationId: string;
}

/**
 * Safely synchronizes the current authenticated Clerk user with our Neon PostgreSQL database.
 * 
 * Security & Integrity Guarantees:
 * 1. Only links an existing database user to a Clerk account if Clerk confirms the email address
 *    is verified (ownership verified).
 * 2. Never creates duplicate user records for the same verified email address.
 * 3. Never touches, overwrites, or deletes passwords (passwords are securely managed by Clerk).
 * 4. Ensures the user is linked to the primary organisation workspace without breaking existing memberships.
 */
export async function syncCurrentUser(): Promise<SyncedUser | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return null;
  }

  // Find the primary email address and check its verification status
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  );

  const emailStr = primaryEmail?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
  const isVerified = primaryEmail?.verification?.status === 'verified';

  if (!emailStr || !isVerified) {
    // Unverified emails are strictly blocked from linking to database records
    return null;
  }

  const normalizedEmail = emailStr.trim().toLowerCase();
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;
  const avatarUrl = clerkUser.imageUrl || null;

  // 1. Try finding existing user by clerkId or verified email
  const existingUser = await (prisma.user as any).findFirst({
    where: {
      OR: [
        { clerkId: clerkUser.id },
        { email: normalizedEmail },
      ],
    },
    include: {
      memberships: true,
    },
  });

  let dbUserId: string;

  if (existingUser) {
    dbUserId = existingUser.id;

    // Link clerkId if not already set, and keep profile details fresh
    const updates: Record<string, any> = {};
    if (existingUser.clerkId !== clerkUser.id) {
      updates.clerkId = clerkUser.id;
    }
    if (!existingUser.name && fullName) {
      updates.name = fullName;
    }
    if (!existingUser.avatarUrl && avatarUrl) {
      updates.avatarUrl = avatarUrl;
    }

    if (Object.keys(updates).length > 0) {
      await (prisma.user as any).update({
        where: { id: existingUser.id },
        data: updates,
      });
    }
  } else {
    // 2. Create new user safely
    const createdUser = await (prisma.user as any).create({
      data: {
        clerkId: clerkUser.id,
        email: normalizedEmail,
        name: fullName,
        avatarUrl,
      },
    });
    dbUserId = createdUser.id;
  }

  // 3. Ensure primary workspace organisation membership
  const defaultOrg = await getOrCreateDefaultOrganisation();
  const existingMembership = await prisma.organisationMembership.findUnique({
    where: {
      organisationId_userId: {
        organisationId: defaultOrg.id,
        userId: dbUserId,
      },
    },
  });

  if (!existingMembership) {
    // Count existing memberships to decide if user is the first owner or member
    const memberCount = await prisma.organisationMembership.count({
      where: { organisationId: defaultOrg.id },
    });

    await prisma.organisationMembership.create({
      data: {
        organisationId: defaultOrg.id,
        userId: dbUserId,
        role: memberCount === 0 ? OrgRole.OWNER : OrgRole.MEMBER,
      },
    });
  }

  return {
    id: dbUserId,
    clerkId: clerkUser.id,
    email: normalizedEmail,
    name: fullName,
    avatarUrl,
    organisationId: defaultOrg.id,
  };
}

