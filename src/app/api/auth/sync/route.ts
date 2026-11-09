import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncCurrentUser } from '@/lib/auth/user-sync';

/**
 * GET /api/auth/sync
 *
 * Lightweight session bootstrap endpoint called once when an authenticated user
 * enters the dashboard. It synchronizes the Clerk session identity with the
 * application's Neon PostgreSQL database.
 *
 * Security:
 * - Requires a valid Clerk session. The middleware already blocks unauthenticated
 *   requests before this handler runs, but we double-check with auth() for defence
 *   in depth.
 * - User identity is retrieved from Clerk server-side. No browser-supplied user ID
 *   or email is ever trusted.
 * - Only verified email addresses are used to link Clerk accounts to database records.
 *
 * Idempotency:
 * - Repeated calls produce no duplicate User records or OrganisationMembership rows.
 * - If the user already exists and is fully linked, the response is 200 with
 *   "already_synced: true" and no writes are issued.
 *
 * Returns:
 *   200 { synced: true, userId: string, organisationId: string, alreadySynced?: true }
 *   401 { error: 'Unauthenticated' }
 *   422 { error: 'Email not verified. Cannot sync user.' }
 *   500 { error: 'Internal server error during user sync.' }
 */
export async function GET() {
  // Defence-in-depth auth check (middleware is the primary gate)
  const { userId: clerkUserId } = auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  try {
    const syncedUser = await syncCurrentUser();

    if (!syncedUser) {
      // syncCurrentUser returns null only when the email is not yet verified
      return NextResponse.json(
        { error: 'Email not verified. Cannot sync user.' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        synced: true,
        userId: syncedUser.id,
        organisationId: syncedUser.organisationId,
      },
      { status: 200 }
    );
  } catch (err) {
    // Log the full error server-side; never expose internal details to the client
    console.error('[/api/auth/sync] Sync error:', err);
    return NextResponse.json(
      { error: 'Internal server error during user sync.' },
      { status: 500 }
    );
  }
}

