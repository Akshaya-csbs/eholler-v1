import { NextResponse } from 'next/server';
import { clearGscCookies } from '@/lib/gsc-tokens';

export async function POST() {
  clearGscCookies();
  return NextResponse.json({ connected: false });
}
